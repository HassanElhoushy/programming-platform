import { notFound, redirect } from "next/navigation";

import { ExamRunner } from "./exam-runner";
import type { RunnerQuestion } from "./question-input";
import { StartExamButton } from "./start-exam";
import { Badge, DataRow, EmptyState } from "@/components/ui/primitives";
import { Lock } from "lucide-react";
import {
  EXAM_KIND_LABELS,
  EXAM_LEVEL_LABELS,
  formatPoints,
  kindDefinite,
  lessonPath,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AnswerResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExamPage({ params }: PageProps<"/exams/[examId]">) {
  const { examId } = await params;
  const supabase = await createClient();

  // امتحان لا صلاحية عليه لا يعود من قاعدة البيانات — لا يظهر مقفولاً، بل لا يظهر.
  const { data: exam } = await supabase
    .from("exams")
    .select(
      "id, title, level, kind, duration_minutes, is_open, lessons(position, title, kind, chapters(position, kind))",
    )
    .eq("id", examId)
    .is("archived_at", null)
    .maybeSingle();

  if (!exam) notFound();

  const lesson = exam.lessons as unknown as {
    position: number;
    title: string;
    kind: string;
    chapters: { position: number; kind: string } | null;
  } | null;

  const crumb = lessonPath(lesson?.chapters?.position ?? 0, lesson?.position ?? 0, lesson?.kind, lesson?.chapters?.kind);
  const noun = kindDefinite(exam.kind);

  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id, status, started_at")
    .eq("exam_id", examId)
    .is("voided_at", null)
    .maybeSingle();

  if (attempt && attempt.status !== "in_progress") {
    redirect(`/results/${attempt.id}`);
  }

  const { data: questionRows } = await supabase
    .from("questions")
    .select("id, position, type, body, points, blank_count")
    .eq("exam_id", examId)
    .order("position");

  const questions = questionRows ?? [];
  const totalPoints = questions.reduce((s, q) => s + Number(q.points), 0);

  /* ------------------------------------------------------------------ */
  /* شاشة ما قبل البدء                                                   */
  /* ------------------------------------------------------------------ */
  if (!attempt) {
    return (
      <>
        <p className="text-xs text-ink-3">{crumb}</p>
        <h1 className="mt-1 mb-6 text-xl font-semibold text-ink sm:text-2xl">
          {exam.title}
        </h1>

        {!exam.is_open ? (
          <EmptyState
            icon={Lock}
            title={`${noun} ده مقفول دلوقتي`}
            hint="المدرّس هو اللي بيفتح. تابع معاه."
          />
        ) : (
          <div className="card px-4 py-2 sm:px-5">
            <div className="divide-y-[0.5px] divide-line">
              <DataRow label="النوع">{EXAM_KIND_LABELS[exam.kind]}</DataRow>
              <DataRow label="المستوى">{EXAM_LEVEL_LABELS[exam.level]}</DataRow>
              <DataRow label="عدد الأسئلة">{questions.length}</DataRow>
              <DataRow label="مجموع الدرجات">{formatPoints(totalPoints)}</DataRow>
              <DataRow label="المدة">
                {exam.duration_minutes
                  ? `${exam.duration_minutes} دقيقة`
                  : "بدون وقت محدد"}
              </DataRow>
            </div>

            <div className="divider mt-2 py-4">
              <p className="mb-4 text-sm leading-relaxed text-ink-2">
                إجاباتك بتتحفظ أول بأول، فلو النت قطع أو الصفحة قفلت هترجع
                تكمّل من نفس المكان.
                {exam.duration_minutes
                  ? " ولو الوقت خلص مش هيتقفل، هتكمّل عادي والمدرّس هيشوف الوقت اللي أخدته."
                  : ""}{" "}
                لما تسلّم مش هتقدر تحل تاني.
              </p>
              <StartExamButton
                examId={exam.id}
                kind={exam.kind}
                durationMinutes={exam.duration_minutes}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  /* ------------------------------------------------------------------ */
  /* شاشة الحل                                                           */
  /* ------------------------------------------------------------------ */
  const questionIds = questions.map((q) => q.id);

  const [optionsRes, answersRes] = await Promise.all([
    questionIds.length > 0
      ? supabase
          .from("question_options")
          .select("id, question_id, position, body, role")
          .in("question_id", questionIds)
          .order("position")
      : Promise.resolve({ data: [] }),
    supabase
      .from("answers")
      .select("question_id, response, image_path")
      .eq("attempt_id", attempt.id),
  ]);

  const optionsByQuestion = new Map<
    string,
    { id: string; body: string; role: "item" | "choice" }[]
  >();
  for (const option of optionsRes.data ?? []) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push({
      id: option.id,
      body: option.body,
      role: option.role === "item" ? "item" : "choice",
    });
    optionsByQuestion.set(option.question_id, list);
  }

  const runnerQuestions: RunnerQuestion[] = questions.map((q) => ({
    id: q.id,
    position: q.position,
    type: q.type,
    body: q.body,
    points: Number(q.points),
    blank_count: q.blank_count,
    options: optionsByQuestion.get(q.id) ?? [],
  }));

  const initialAnswers = Object.fromEntries(
    (answersRes.data ?? []).map((a) => [
      a.question_id,
      {
        response: a.response as AnswerResponse,
        image_path: a.image_path as string | null,
      },
    ]),
  );

  // الزمن يُحسب على السيرفر ثم يمشي محلياً، حتى لا تختلف ساعة الجهاز عن الحقيقة
  const elapsed = Math.max(
    0,
    Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000),
  );

  return (
    <>
      <div className="mb-1">
        <p className="text-xs text-ink-3">{crumb}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ink sm:text-xl">{exam.title}</h1>
          <Badge tone={exam.kind === "exam" ? "wait" : "accent"}>
            {EXAM_KIND_LABELS[exam.kind]}
          </Badge>
          <Badge tone="muted">{EXAM_LEVEL_LABELS[exam.level]}</Badge>
        </div>
      </div>

      <ExamRunner
        attemptId={attempt.id}
        questions={runnerQuestions}
        initialAnswers={initialAnswers}
        durationMinutes={exam.duration_minutes}
        initialElapsedSeconds={elapsed}
      />
    </>
  );
}
