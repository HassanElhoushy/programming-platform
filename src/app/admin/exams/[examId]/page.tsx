import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Eye, EyeOff, Lock, Unlock } from "lucide-react";

import { ExamSettingsForm } from "./exam-settings";
import { QuestionImporter } from "./question-importer";
import {
  archiveExamAction,
  purgeExamImagesAction,
  setExamOpenAction,
  setRevealAnswersAction,
} from "@/app/actions/admin-exams";
import { deleteQuestionAction } from "@/app/actions/admin-exams";
import { ActionButton } from "@/components/action-button";
import { Badge, DataRow, SectionTitle } from "@/components/ui/primitives";
import {
  EXAM_LEVEL_LABELS,
  formatPoints,
  lessonPath,
  QUESTION_TYPE_LABELS,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { QuestionType } from "@/lib/types";

export const dynamic = "force-dynamic";

interface KeyRow {
  question_id: string;
  key:
    | { option_ids: string[] }
    | { value: boolean }
    | { blanks: string[][] };
}

export default async function AdminExamPage({
  params,
}: PageProps<"/admin/exams/[examId]">) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from("exams")
    .select(
      "id, title, level, duration_minutes, is_open, reveal_answers, lesson_id, lessons(position, title, chapters(position))",
    )
    .eq("id", examId)
    .maybeSingle();

  if (!exam) notFound();

  const lesson = exam.lessons as unknown as {
    position: number;
    title: string;
    chapters: { position: number } | null;
  } | null;

  const [questionsRes, optionsRes, keysRes, attemptsRes] = await Promise.all([
    supabase
      .from("questions")
      .select("id, position, type, body, points, blank_count")
      .eq("exam_id", examId)
      .order("position"),
    supabase
      .from("question_options")
      .select("id, question_id, position, body, questions!inner(exam_id)")
      .eq("questions.exam_id", examId)
      .order("position"),
    supabase
      .from("question_keys")
      .select("question_id, key, questions!inner(exam_id)")
      .eq("questions.exam_id", examId),
    supabase
      .from("exam_attempts")
      .select("id, status")
      .eq("exam_id", examId)
      .is("voided_at", null),
  ]);

  const questions = questionsRes.data ?? [];
  const attempts = attemptsRes.data ?? [];
  const pendingGrading = attempts.filter((a) => a.status === "submitted").length;
  const inProgress = attempts.filter((a) => a.status === "in_progress").length;

  const optionsByQuestion = new Map<string, { id: string; body: string }[]>();
  for (const option of optionsRes.data ?? []) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push({ id: option.id, body: option.body });
    optionsByQuestion.set(option.question_id, list);
  }

  const keyByQuestion = new Map<string, KeyRow["key"]>();
  for (const row of (keysRes.data ?? []) as unknown as KeyRow[]) {
    keyByQuestion.set(row.question_id, row.key);
  }

  const totalPoints = questions.reduce((s, q) => s + Number(q.points), 0);

  return (
    <>
      <Link
        href={`/admin/content/${exam.lesson_id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4" strokeWidth={1.5} />
        {lesson?.title ?? "الدرس"}
      </Link>

      <div className="mb-7">
        <p className="text-xs text-ink-3">
          {lessonPath(lesson?.chapters?.position ?? 0, lesson?.position ?? 0)}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
          {exam.title}
        </h1>
      </div>

      {/* ------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionTitle>الإعدادات</SectionTitle>

        <div className="card px-4 py-2 sm:px-5">
          <div className="divide-y-[0.5px] divide-line">
            <DataRow label="المستوى">{EXAM_LEVEL_LABELS[exam.level]}</DataRow>
            <DataRow label="المدة">
              {exam.duration_minutes
                ? `${exam.duration_minutes} دقيقة`
                : "بدون وقت محدد"}
            </DataRow>
            <DataRow label="عدد الأسئلة">{questions.length}</DataRow>
            <DataRow label="مجموع الدرجات">{formatPoints(totalPoints)}</DataRow>
            <DataRow label="التسليمات">
              {attempts.length}
              {inProgress > 0 ? (
                <span className="text-ink-3"> · {inProgress} تحت الحل</span>
              ) : null}
            </DataRow>
          </div>

          <div className="divider mt-2 pt-4">
            <ExamSettingsForm
              examId={exam.id}
              title={exam.title}
              level={exam.level}
              durationMinutes={exam.duration_minutes}
            />
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="card px-4 py-4">
            <div className="mb-1 flex items-center gap-2">
              {exam.is_open ? (
                <Unlock className="size-4 text-ink-3" strokeWidth={1.5} />
              ) : (
                <Lock className="size-4 text-ink-3" strokeWidth={1.5} />
              )}
              <p className="text-sm font-medium text-ink">
                {exam.is_open ? "الامتحان مفتوح" : "الامتحان مغلق"}
              </p>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-ink-2">
              {exam.is_open
                ? "الطلبة اللي عندهم صلاحية يقدروا يبدأوا دلوقتي."
                : "الإغلاق بيمنع البدايات الجديدة بس. اللي بدأ فعلاً بيكمّل ويسلّم."}
            </p>
            <ActionButton
              action={setExamOpenAction.bind(null, exam.id, !exam.is_open)}
              className="btn btn-secondary"
            >
              {exam.is_open ? "اقفل الامتحان" : "افتح الامتحان"}
            </ActionButton>
          </div>

          <div className="card px-4 py-4">
            <div className="mb-1 flex items-center gap-2">
              {exam.reveal_answers ? (
                <Eye className="size-4 text-ink-3" strokeWidth={1.5} />
              ) : (
                <EyeOff className="size-4 text-ink-3" strokeWidth={1.5} />
              )}
              <p className="text-sm font-medium text-ink">
                {exam.reveal_answers
                  ? "الإجابات النموذجية ظاهرة"
                  : "الإجابات النموذجية مخفية"}
              </p>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-ink-2">
              {exam.reveal_answers
                ? "الطالب اللي سلّم بيشوف الإجابة الصحيحة وصح وخطأ كل سؤال."
                : "الطالب بيشوف درجته بس. ما تفتحش ده غير بعد ما كل الطلبة يخلصوا، وإلا أول واحد يحل هيسرّبها."}
            </p>
            <ActionButton
              action={setRevealAnswersAction.bind(null, exam.id, !exam.reveal_answers)}
              className="btn btn-secondary"
              confirm={
                exam.reveal_answers
                  ? undefined
                  : "متأكد إن كل الطلبة خلصوا الامتحان ده؟"
              }
            >
              {exam.reveal_answers ? "اخفي الإجابات" : "اظهر الإجابات للطلبة"}
            </ActionButton>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionTitle
          action={
            pendingGrading > 0 ? (
              <Link
                href="/admin/grading"
                className="text-xs text-ink-2 hover:text-ink"
              >
                {pendingGrading} محتاج تصحيح
              </Link>
            ) : undefined
          }
        >
          الأسئلة
        </SectionTitle>

        <div className="mb-3">
          <QuestionImporter examId={examId} hasQuestions={questions.length > 0} />
        </div>

        {questions.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-ink-3">
            مفيش أسئلة لسه. استورد ملف JSON من فوق.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {questions.map((question, index) => (
              <li key={question.id} className="card px-4 py-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tnum text-sm font-semibold text-ink">
                      السؤال {index + 1}
                    </span>
                    <Badge tone="muted">
                      {QUESTION_TYPE_LABELS[question.type as QuestionType]}
                    </Badge>
                    <span className="tnum text-xs text-ink-3">
                      {formatPoints(question.points)} درجة
                    </span>
                  </div>

                  {attempts.length === 0 ? (
                    <ActionButton
                      action={deleteQuestionAction.bind(null, question.id, examId)}
                      className="btn btn-ghost text-xs"
                      confirm="هيتمسح نهائياً."
                    >
                      حذف
                    </ActionButton>
                  ) : null}
                </div>

                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {question.body}
                </p>

                <AnswerKeyPreview
                  type={question.type as QuestionType}
                  options={optionsByQuestion.get(question.id) ?? []}
                  answerKey={keyByQuestion.get(question.id)}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      <section>
        <SectionTitle>إدارة</SectionTitle>

        <div className="card flex flex-col gap-4 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm font-medium text-ink">حذف صور الإجابات المقالية</p>
            <p className="mb-2 mt-0.5 text-xs leading-relaxed text-ink-2">
              الصور أثقل حاجة على مساحة التخزين المجانية. بعد ما تخلص تصحيح
              الامتحان ده تقدر تمسح صوره — الدرجات والملاحظات والنص المكتوب كله
              بيفضل زي ما هو.
            </p>
            <ActionButton
              action={purgeExamImagesAction.bind(null, examId)}
              className="btn btn-secondary"
              confirm="الصور هتتمسح نهائياً ومش هتقدر ترجعها."
            >
              امسح الصور
            </ActionButton>
          </div>

          <div className="divider pt-4">
            <p className="text-sm font-medium text-ink">أرشفة الامتحان</p>
            <p className="mb-2 mt-0.5 text-xs leading-relaxed text-ink-2">
              هيختفي من حسابات الطلبة، والدرجات والتسليمات هتفضل محفوظة.
            </p>
            <ActionButton
              action={archiveExamAction.bind(null, examId, exam.lesson_id)}
              className="btn btn-danger"
              confirm="متأكد؟"
            >
              أرشفة الامتحان
            </ActionButton>
          </div>
        </div>
      </section>
    </>
  );
}

/** عرض الإجابة الصحيحة للمدرّس فقط — هذه الصفحة محميّة بـ requireAdmin و RLS */
function AnswerKeyPreview({
  type,
  options,
  answerKey,
}: {
  type: QuestionType;
  options: { id: string; body: string }[];
  answerKey: KeyRow["key"] | undefined;
}) {
  if (type === "essay") {
    return (
      <p className="mt-2 text-xs text-ink-3">سؤال مقالي — تصححه يدوياً.</p>
    );
  }

  if (!answerKey) {
    return (
      <p className="mt-2 text-xs text-bad">
        مفيش مفتاح إجابة للسؤال ده — هيتحسب صفر لكل الطلبة.
      </p>
    );
  }

  if ("value" in answerKey) {
    return (
      <p className="mt-2 text-xs text-ink-2">
        الإجابة الصحيحة: <span className="font-medium">{answerKey.value ? "صح" : "خطأ"}</span>
      </p>
    );
  }

  if ("blanks" in answerKey) {
    return (
      <ol className="mt-2 flex flex-col gap-0.5">
        {answerKey.blanks.map((accepted, i) => (
          <li key={i} className="text-xs text-ink-2">
            الفراغ {i + 1}: <span className="font-medium">{accepted.join(" أو ")}</span>
          </li>
        ))}
      </ol>
    );
  }

  const correctIds = new Set(answerKey.option_ids);

  return (
    <ul className="mt-2 flex flex-col gap-0.5">
      {options.map((option, i) => (
        <li key={option.id} className="text-xs text-ink-2">
          <span className="text-ink-3">{i + 1}. </span>
          {option.body}
          {correctIds.has(option.id) ? (
            <span className="badge badge-ok mr-2">صحيحة</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
