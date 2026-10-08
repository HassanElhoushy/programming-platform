import { notFound, redirect } from "next/navigation";

import { ExamRunner } from "./exam-runner";
import type { RunnerQuestion } from "./question-input";
import { StartExamButton } from "./start-exam";
import { Badge, DataRow, EmptyState } from "@/components/ui/primitives";
import { Lock } from "lucide-react";
import {
  examKindLabel,
  examLevelLabel,
  formatPoints,
  kindDefinite,
  lessonPath,
  type UiLocale,
} from "@/lib/format";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AnswerResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/** وقت السيرفر لحظة فتح الصفحة. العدّ بعدها يمشي في المتصفح. */
function elapsedSeconds(startedAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
}

export default async function ExamPage({ params }: PageProps<"/exams/[examId]">) {
  const { examId } = await params;
  const session = await requireStudent();
  const locale: UiLocale = session.profile.track === "en" ? "en" : "ar";
  const en = locale === "en";
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

  // البنك بلا محاولة: محرّك الامتحان يخوّف ويحسب مؤقّتاً. جلسته في /bank.
  if (exam.kind === "bank") {
    redirect(`/bank/practice?exam=${exam.id}`);
  }

  const lesson = exam.lessons as unknown as {
    position: number;
    title: string;
    kind: string;
    chapters: { position: number; kind: string } | null;
  } | null;

  const crumb = lessonPath(lesson?.chapters?.position ?? 0, lesson?.position ?? 0, lesson?.kind, lesson?.chapters?.kind, locale);
  const noun = kindDefinite(exam.kind, locale);

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
            title={
              en
                ? `This ${examKindLabel(exam.kind, "en").toLowerCase()} is closed right now`
                : `${noun} ده مقفول دلوقتي`
            }
            hint={en ? "Your teacher opens it. Check with them." : "المدرّس هو اللي بيفتح. تابع معاه."}
          />
        ) : (
          <div className="card px-4 py-2 sm:px-5">
            <div className="divide-y-[0.5px] divide-line">
              <DataRow label={en ? "Type" : "النوع"}>{examKindLabel(exam.kind, locale)}</DataRow>
              <DataRow label={en ? "Level" : "المستوى"}>{examLevelLabel(exam.level, locale)}</DataRow>
              <DataRow label={en ? "Questions" : "عدد الأسئلة"}>{questions.length}</DataRow>
              <DataRow label={en ? "Total points" : "مجموع الدرجات"}>{formatPoints(totalPoints)}</DataRow>
              <DataRow label={en ? "Time" : "المدة"}>
                {exam.duration_minutes
                  ? en
                    ? `${exam.duration_minutes} min`
                    : `${exam.duration_minutes} دقيقة`
                  : en
                    ? "No time limit"
                    : "بدون وقت محدد"}
              </DataRow>
            </div>

            <div className="divider mt-2 py-4">
              <p className="mb-4 text-sm leading-relaxed text-ink-2">
                {en
                  ? "Your answers are saved as you go. If the connection drops or the page closes, you come back and continue from the same place."
                  : "إجاباتك بتتحفظ أول بأول، فلو النت قطع أو الصفحة قفلت هترجع تكمّل من نفس المكان."}
                {exam.duration_minutes
                  ? en
                    ? " If the time runs out it does not close. You can continue, and your teacher will see how long you took."
                    : " ولو الوقت خلص مش هيتقفل، هتكمّل عادي والمدرّس هيشوف الوقت اللي أخدته."
                  : ""}{" "}
                {en ? "After you submit, you cannot answer again." : "لما تسلّم مش هتقدر تحل تاني."}
              </p>
              <StartExamButton
                examId={exam.id}
                kind={exam.kind}
                durationMinutes={exam.duration_minutes}
                locale={locale}
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

  const elapsed = elapsedSeconds(attempt.started_at);

  return (
    <>
      <div className="mb-1">
        <p className="text-xs text-ink-3">{crumb}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ink sm:text-xl">{exam.title}</h1>
          <Badge tone={exam.kind === "exam" ? "wait" : "accent"}>
            {examKindLabel(exam.kind, locale)}
          </Badge>
          <Badge tone="muted">{examLevelLabel(exam.level, locale)}</Badge>
        </div>
      </div>

      <ExamRunner
        attemptId={attempt.id}
        questions={runnerQuestions}
        initialAnswers={initialAnswers}
        durationMinutes={exam.duration_minutes}
        initialElapsedSeconds={elapsed}
        /*
          دقيقة كاملة مضت منذ البدء تعني أن هذه ليست اللحظة التي ضغط فيها
          "ابدأ"، فهو راجع أو محدِّث للصفحة. وفي الحالتين يطمئنه أن يقرأ أن
          إجاباته مكانها.
        */
        resuming={elapsed > 60}
        locale={locale}
      />
    </>
  );
}
