import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { GradingForm } from "./grading-form";
import { ReviewQuestionCard } from "@/components/review-question";
import { Badge, DataRow, SectionTitle } from "@/components/ui/primitives";
import {
  formatDateTime,
  formatDuration,
  formatPoints,
  lessonPath,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AttemptReview } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function GradeAttemptPage({
  params,
}: PageProps<"/admin/grading/[attemptId]">) {
  const { attemptId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_attempt_review", {
    p_attempt_id: attemptId,
  });

  if (error || !data) notFound();

  const review = data as AttemptReview;
  const { attempt, exam, questions } = review;

  // تسمية المفتاح إجبارية: exam_attempts مرتبط بـ profiles عبر student_id
  // وعبر voided_by، فترك الاسم مجرداً يجعل PostgREST يرفض الاستعلام.
  const { data: student } = await supabase
    .from("exam_attempts")
    .select("student_id, profiles!exam_attempts_student_id_fkey(full_name, phone)")
    .eq("id", attemptId)
    .maybeSingle();

  const profile = student?.profiles as unknown as {
    full_name: string;
    phone: string;
  } | null;

  const essays = questions.filter((q) => q.type === "essay");
  const objective = questions.filter((q) => q.type !== "essay");
  const alreadyGraded = attempt.status === "graded";

  return (
    <>
      <Link
        href="/admin/grading"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4" strokeWidth={1.5} />
        تصحيح الامتحانات
      </Link>

      <div className="mb-6">
        <p className="text-xs text-ink-3">
          {lessonPath(review.chapter_position, review.lesson_position, review.lesson_kind)} · {exam.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">
            {profile?.full_name}
          </h1>
          {alreadyGraded ? (
            <Badge tone="ok">تم التصحيح</Badge>
          ) : (
            <Badge tone="wait">بانتظار التصحيح</Badge>
          )}
          {attempt.exceeded_duration ? <Badge tone="muted">تجاوز الوقت</Badge> : null}
        </div>
        {profile?.phone ? (
          <p dir="ltr" className="tnum mt-1 text-right text-xs text-ink-3">
            {profile.phone}
          </p>
        ) : null}
      </div>

      <div className="card mb-8 px-4 py-2 sm:px-5">
        <div className="divide-y-[0.5px] divide-line">
          <DataRow label="درجة الأسئلة الموضوعية">
            {formatPoints(attempt.auto_score)} من{" "}
            {formatPoints(objective.reduce((s, q) => s + Number(q.points), 0))}
          </DataRow>
          <DataRow label="درجة الأسئلة المقالية">
            {attempt.manual_score === null
              ? "لسه ما اتصححتش"
              : `${formatPoints(attempt.manual_score)} من ${formatPoints(
                  essays.reduce((s, q) => s + Number(q.points), 0),
                )}`}
          </DataRow>
          <DataRow label="وقت التسليم">{formatDateTime(attempt.submitted_at)}</DataRow>
          <DataRow label="الوقت المستغرق">
            {formatDuration(attempt.time_spent_seconds)}
            {exam.duration_minutes ? (
              <span className="text-ink-3"> · المدة {exam.duration_minutes} دقيقة</span>
            ) : null}
          </DataRow>
        </div>
      </div>

      {essays.length > 0 ? (
        <section className="mb-8">
          <SectionTitle>الأسئلة المقالية</SectionTitle>
          <GradingForm
            attemptId={attemptId}
            questions={essays}
            alreadyGraded={alreadyGraded}
          />
        </section>
      ) : (
        <p className="card mb-8 px-4 py-6 text-center text-sm text-ink-3">
          الامتحان ده مافيهوش أسئلة مقالية.
        </p>
      )}

      {objective.length > 0 ? (
        <section>
          <SectionTitle>الأسئلة الموضوعية (اتصححت آلياً)</SectionTitle>
          <ol className="flex flex-col gap-4">
            {objective.map((question, index) => (
              <ReviewQuestionCard
                key={question.id}
                question={question}
                index={index}
                attemptId={attemptId}
              />
            ))}
          </ol>
        </section>
      ) : null}
    </>
  );
}
