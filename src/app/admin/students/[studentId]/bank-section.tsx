import { ChevronLeft } from "lucide-react";

import { ReviewQuestionCard } from "@/components/review-question";
import { Badge, Fold } from "@/components/ui/primitives";
import {
  QUESTION_TIER_LABELS,
  bankChapterName,
  bankLessonTitle,
  formatDateTime,
  lessonPath,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type {
  AnswerResponse,
  CorrectKey,
  QuestionType,
  ReviewQuestion,
} from "@/lib/types";

interface LessonRef {
  title: string;
  position: number;
  kind: string;
  chapters: { position: number; kind: string } | null;
}

interface ExamRef {
  id: string;
  title: string;
  kind: string;
  lessons: LessonRef | null;
}

interface QuestionRef {
  body: string;
  type: string;
  tier: string | null;
  points: number;
  blank_count: number;
  exam_id: string;
  exams: ExamRef | null;
}

interface ProgressRow {
  question_id: string;
  state: "correct" | "wrong";
  forgot: boolean;
  tries: number;
  updated_at: string;
  last_response: AnswerResponse | null;
  questions: QuestionRef | null;
}

interface BankGroup {
  examId: string;
  title: string;
  crumb: string;
  total: number;
  mastered: number;
  todo: number;
  forgot: number;
  last: string;
  wrong: ProgressRow[];
  forgotten: ProgressRow[];
  recovered: ProgressRow[];
}

interface OptionRow {
  id: string;
  body: string;
  role: "item" | "choice";
}

/**
 * تقدّم هذا الطالب في البنك، لا الفصل كله.
 *
 * الضغط على الدرس يعرض غلطاته هنا: إجابته، والصحيح، والشرح. لا يذهب
 * لصفحة البنك — دي ورقة الأسئلة، مش تشخيص الطالب.
 */
export async function StudentBankSection({ studentId }: { studentId: string }) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bank_progress")
    .select(
      "question_id, state, forgot, tries, updated_at, last_response, questions(body, type, tier, points, blank_count, exam_id, exams(id, title, kind, lessons(title, position, kind, chapters(position, kind))))",
    )
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as unknown as ProgressRow[];
  const examIds = [
    ...new Set(
      rows
        .map((row) => row.questions?.exam_id)
        .filter((id): id is string => !!id),
    ),
  ];

  const totals = new Map<string, number>();
  if (examIds.length > 0) {
    const { data: questions } = await supabase
      .from("questions")
      .select("exam_id")
      .in("exam_id", examIds);
    for (const question of questions ?? []) {
      totals.set(question.exam_id, (totals.get(question.exam_id) ?? 0) + 1);
    }
  }

  const groups = new Map<string, BankGroup>();
  for (const row of rows) {
    const exam = row.questions?.exams;
    if (!exam || exam.kind !== "bank") continue;

    const lesson = exam.lessons;
    let group = groups.get(exam.id);
    if (!group) {
      group = {
        examId: exam.id,
        title: bankLessonTitle(lesson?.title ?? exam.title),
        crumb:
          lesson?.chapters?.kind === "review"
            ? bankChapterName(0, "review")
            : lessonPath(
                lesson?.chapters?.position ?? 0,
                lesson?.position ?? 0,
                lesson?.kind,
                lesson?.chapters?.kind,
              ),
        total: totals.get(exam.id) ?? 0,
        mastered: 0,
        todo: 0,
        forgot: 0,
        last: row.updated_at,
        wrong: [],
        forgotten: [],
        recovered: [],
      };
      groups.set(exam.id, group);
    }

    if (row.state === "correct") group.mastered += 1;
    else group.todo += 1;

    if (row.state === "wrong") group.wrong.push(row);
    else if (row.forgot) {
      group.forgot += 1;
      group.forgotten.push(row);
    } else if (row.last_response) {
      group.recovered.push(row);
    }
  }

  const banks = [...groups.values()].sort((a, b) =>
    a.crumb === b.crumb ? a.title.localeCompare(b.title, "ar") : a.crumb.localeCompare(b.crumb, "ar"),
  );

  const diagnosticIds = [
    ...new Set(
      banks.flatMap((bank) =>
        [...bank.wrong, ...bank.forgotten, ...bank.recovered].map((row) => row.question_id),
      ),
    ),
  ];

  const optionsByQuestion = new Map<string, OptionRow[]>();
  const keyByQuestion = new Map<string, CorrectKey>();
  const explanationByQuestion = new Map<string, string>();

  if (diagnosticIds.length > 0) {
    const [optionsRes, keysRes] = await Promise.all([
      supabase
        .from("question_options")
        .select("id, question_id, position, body, role")
        .in("question_id", diagnosticIds)
        .order("position"),
      supabase
        .from("question_keys")
        .select("question_id, key, explanation")
        .in("question_id", diagnosticIds),
    ]);

    for (const option of optionsRes.data ?? []) {
      const list = optionsByQuestion.get(option.question_id) ?? [];
      list.push({
        id: option.id,
        body: option.body,
        role: option.role === "item" ? "item" : "choice",
      });
      optionsByQuestion.set(option.question_id, list);
    }

    for (const row of keysRes.data ?? []) {
      keyByQuestion.set(row.question_id, (row.key ?? null) as CorrectKey);
      const explanation = row.explanation?.trim();
      if (explanation) explanationByQuestion.set(row.question_id, explanation);
    }
  }

  const mastered = banks.reduce((sum, bank) => sum + bank.mastered, 0);
  const todo = banks.reduce((sum, bank) => sum + bank.todo, 0);
  const forgot = banks.reduce((sum, bank) => sum + bank.forgot, 0);

  const hint =
    banks.length === 0
      ? "ما حلّش حاجة لسه"
      : [
          `${mastered} اتحل`,
          todo > 0 ? `${todo} لسه غلط` : null,
          forgot > 0 ? `${forgot} بدأ ينساه` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Fold title="بنك الأسئلة" hint={hint}>
      {banks.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-ink-3">
          ما حلّش أي سؤال في البنك لسه. أول ما يبدأ، دوس على الدرس عشان تشوف
          الأسئلة اللي غلط فيها.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {banks.map((bank) => {
            const mistakes = bank.wrong.length + bank.forgotten.length + bank.recovered.length;
            return (
              <article key={bank.examId} className="card px-4 py-3.5">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    <div className="min-w-0">
                      <p className="text-xs text-ink-3">{bank.crumb}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-ink">
                        {bank.title}
                      </p>
                      <p className="tnum mt-2 text-xs text-ink-3">
                        {bank.mastered} من {bank.total || "—"} اتحل
                        {bank.todo > 0 ? ` · ${bank.todo} لسه غلط` : ""}
                        {bank.forgot > 0 ? ` · ${bank.forgot} بدأ ينساه` : ""}
                        {` · آخر مرة ${formatDateTime(bank.last)}`}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-xs font-medium text-accent">
                      {bank.todo > 0
                        ? `${bank.todo} غلط`
                        : mistakes > 0
                          ? "الغلطات"
                          : "التفاصيل"}
                      <ChevronLeft
                        className="size-3.5 transition-transform group-open:-rotate-90"
                        strokeWidth={1.5}
                      />
                    </span>
                  </summary>

                  <div className="divider mt-3 pt-3">
                    <WeaknessHint rows={[...bank.wrong, ...bank.forgotten, ...bank.recovered]} />

                    {bank.wrong.length > 0 ? (
                      <MistakeList
                        title={`لسه غلط فيها (${bank.wrong.length})`}
                        rows={bank.wrong}
                        optionsByQuestion={optionsByQuestion}
                        keyByQuestion={keyByQuestion}
                        explanationByQuestion={explanationByQuestion}
                      />
                    ) : null}

                    {bank.forgotten.length > 0 ? (
                      <MistakeList
                        title={`كان عارفها ونسيها (${bank.forgotten.length})`}
                        rows={bank.forgotten}
                        optionsByQuestion={optionsByQuestion}
                        keyByQuestion={keyByQuestion}
                        explanationByQuestion={explanationByQuestion}
                        note="اتحلت صح قبل كده، وبعدين رجع غلط فيها."
                      />
                    ) : null}

                    {bank.recovered.length > 0 ? (
                      <MistakeList
                        title={`غلط فيها وبعدين اتحلت (${bank.recovered.length})`}
                        rows={bank.recovered}
                        optionsByQuestion={optionsByQuestion}
                        keyByQuestion={keyByQuestion}
                        explanationByQuestion={explanationByQuestion}
                        note="دي آخر غلطة قبل ما يصلحها. بتبيّن وين تلخبط."
                      />
                    ) : null}

                    {mistakes === 0 ? (
                      <p className="text-sm leading-relaxed text-ink-3">
                        اللي لمسه في الدرس ده اتحل صح. الأسئلة اللي لسه ما
                        لمسهاش مش بتظهر هنا — دي مش غلطات.
                      </p>
                    ) : null}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </Fold>
  );
}

function WeaknessHint({ rows }: { rows: ProgressRow[] }) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const tier = row.questions?.tier;
    if (!tier) continue;
    counts.set(tier, (counts.get(tier) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topTier, topCount] = ranked[0];
  const rest = ranked
    .slice(1)
    .map(([tier, n]) => `${QUESTION_TIER_LABELS[tier] ?? tier} (${n})`)
    .join(" · ");

  return (
    <p className="mb-3 text-sm leading-relaxed text-ink-2">
      أكتر غلط في{" "}
      <span className="font-medium text-ink">
        {QUESTION_TIER_LABELS[topTier] ?? topTier}
      </span>{" "}
      ({topCount})
      {rest ? ` · ${rest}` : ""}
    </p>
  );
}

function MistakeList({
  title,
  rows,
  optionsByQuestion,
  keyByQuestion,
  explanationByQuestion,
  note,
}: {
  title: string;
  rows: ProgressRow[];
  optionsByQuestion: Map<string, OptionRow[]>;
  keyByQuestion: Map<string, CorrectKey>;
  explanationByQuestion: Map<string, string>;
  note?: string;
}) {
  return (
    <section className="mb-4 last:mb-0">
      <p className="text-xs font-medium text-ink-2">{title}</p>
      {note ? <p className="mt-1 text-xs leading-relaxed text-ink-3">{note}</p> : null}
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row, index) => {
          const explanation = explanationByQuestion.get(row.question_id);
          return (
            <ReviewQuestionCard
              key={row.question_id}
              question={toReviewQuestion(
                row,
                optionsByQuestion.get(row.question_id) ?? [],
                keyByQuestion.get(row.question_id) ?? null,
              )}
              index={index}
              attemptId=""
              showEssayImage={false}
              viewer="teacher"
            >
              {row.questions?.tier ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge tone="muted">
                    {QUESTION_TIER_LABELS[row.questions.tier] ?? row.questions.tier}
                  </Badge>
                  <span className="tnum text-xs text-ink-3">
                    {row.tries === 1 ? "محاولة واحدة" : `${row.tries} محاولات`}
                    {` · ${formatDateTime(row.updated_at)}`}
                  </span>
                </div>
              ) : (
                <p className="tnum mt-3 text-xs text-ink-3">
                  {row.tries === 1 ? "محاولة واحدة" : `${row.tries} محاولات`}
                  {` · ${formatDateTime(row.updated_at)}`}
                </p>
              )}
              {explanation ? (
                <div className="divider mt-3 pt-3">
                  <p className="mb-1 text-xs font-medium text-ink-2">ليه الإجابة دي</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                    {explanation}
                  </p>
                </div>
              ) : null}
            </ReviewQuestionCard>
          );
        })}
      </ul>
    </section>
  );
}

function toReviewQuestion(
  row: ProgressRow,
  options: OptionRow[],
  key: CorrectKey,
): ReviewQuestion {
  const question = row.questions;
  return {
    id: row.question_id,
    position: 0,
    type: (question?.type ?? "mcq_single") as QuestionType,
    body: question?.body ?? "سؤال محذوف",
    points: Number(question?.points ?? 0),
    blank_count: question?.blank_count ?? 0,
    options,
    response: row.last_response ?? null,
    image_path: null,
    feedback: null,
    awarded_points: null,
    is_correct: false,
    correct: key,
    model_answer: null,
  };
}
