import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { Badge, Fold } from "@/components/ui/primitives";
import {
  QUESTION_TIER_LABELS,
  QUESTION_TYPE_LABELS,
  bankChapterName,
  bankLessonTitle,
  formatDateTime,
  lessonPath,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

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
  exam_id: string;
  exams: ExamRef | null;
}

interface ProgressRow {
  question_id: string;
  state: "correct" | "wrong";
  forgot: boolean;
  tries: number;
  updated_at: string;
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
}

/**
 * تقدّم هذا الطالب في البنك، لا الفصل كله.
 *
 * صفحة بنك الأسئلة عند المدرّس تجيب «فين الغلط في الفصل». هنا السؤال
 * المعكوس: هذا الطالب بدأ إيه، ثبّت إيه، ولسه واقف فين. القائمة مجمّعة
 * على البنك لا على كل سؤال على حدة، وإلا ستمائة سؤال تُخفي الغلط.
 */
export async function StudentBankSection({ studentId }: { studentId: string }) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("bank_progress")
    .select(
      "question_id, state, forgot, tries, updated_at, questions(body, type, tier, exam_id, exams(id, title, kind, lessons(title, position, kind, chapters(position, kind))))",
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
      };
      groups.set(exam.id, group);
    }

    if (row.state === "correct") group.mastered += 1;
    else group.todo += 1;

    if (row.forgot) {
      group.forgot += 1;
      group.forgotten.push(row);
    }
    if (row.state === "wrong") group.wrong.push(row);
  }

  const banks = [...groups.values()].sort((a, b) =>
    a.crumb === b.crumb ? a.title.localeCompare(b.title, "ar") : a.crumb.localeCompare(b.crumb, "ar"),
  );

  const mastered = banks.reduce((sum, bank) => sum + bank.mastered, 0);
  const todo = banks.reduce((sum, bank) => sum + bank.todo, 0);
  const forgot = banks.reduce((sum, bank) => sum + bank.forgot, 0);

  const hint =
    banks.length === 0
      ? "ما حلّش حاجة لسه"
      : [
          `${mastered} اتحل`,
          todo > 0 ? `${todo} لسه ما اتحلتش` : null,
          forgot > 0 ? `${forgot} بدأ ينساه` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <Fold title="بنك الأسئلة" hint={hint}>
      {banks.length === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-ink-3">
          ما حلّش أي سؤال في البنك لسه. أول ما يبدأ، هتشوف هنا بدأ أنهي
          درس، حل كام، والأسئلة اللي لسه غلط فيها.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {banks.map((bank) => (
            <article key={bank.examId} className="card px-4 py-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-ink-3">{bank.crumb}</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink">
                    {bank.title}
                  </p>
                  <p className="tnum mt-2 text-xs text-ink-3">
                    {bank.mastered} من {bank.total || "—"} اتحل
                    {bank.todo > 0 ? ` · ${bank.todo} لسه ما اتحلتش` : ""}
                    {bank.forgot > 0 ? ` · ${bank.forgot} بدأ ينساه` : ""}
                    {` · آخر مرة ${formatDateTime(bank.last)}`}
                  </p>
                </div>
                <Link
                  href={`/admin/exams/${bank.examId}`}
                  className="btn btn-ghost inline-flex shrink-0 items-center gap-1 text-xs"
                >
                  الأسئلة
                  <ChevronLeft className="size-3.5" strokeWidth={1.5} />
                </Link>
              </div>

              {bank.wrong.length > 0 ? (
                <QuestionList
                  title={`لسه غلط فيها (${bank.wrong.length})`}
                  rows={bank.wrong}
                />
              ) : null}

              {bank.forgotten.length > 0 ? (
                <QuestionList
                  title={`كان عارفها ونسيها (${bank.forgotten.length})`}
                  rows={bank.forgotten}
                />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </Fold>
  );
}

function QuestionList({ title, rows }: { title: string; rows: ProgressRow[] }) {
  return (
    <details className="group divider mt-3 pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-accent [&::-webkit-details-marker]:hidden">
        <ChevronLeft
          className="size-3.5 transition-transform group-open:-rotate-90"
          strokeWidth={2}
        />
        {title}
      </summary>
      <ul className="mt-2 flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.question_id} className="rounded-[6px] border-[0.5px] border-line px-3 py-2">
            <p className="text-sm leading-relaxed text-ink">
              {snippet(row.questions?.body ?? "سؤال محذوف")}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {row.questions?.type ? (
                <Badge tone="muted">
                  {QUESTION_TYPE_LABELS[row.questions.type] ?? row.questions.type}
                </Badge>
              ) : null}
              {row.questions?.tier ? (
                <Badge tone="muted">
                  {QUESTION_TIER_LABELS[row.questions.tier] ?? row.questions.tier}
                </Badge>
              ) : null}
              <span className="tnum text-xs text-ink-3">
                {row.tries === 1 ? "محاولة واحدة" : `${row.tries} محاولات`}
                {` · ${formatDateTime(row.updated_at)}`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function snippet(body: string, n = 120): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length <= n ? text : `${text.slice(0, n).trim()}…`;
}
