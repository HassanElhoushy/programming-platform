import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";

import { ReviewQuestionCard } from "@/components/review-question";
import { Badge, DataRow } from "@/components/ui/primitives";
import {
  formatDateTime,
  formatDuration,
  formatScore,
  lessonPath,
  percentage,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AttemptReview } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ResultPage({
  params,
  searchParams,
}: PageProps<"/results/[attemptId]">) {
  const { attemptId } = await params;
  const { submitted } = await searchParams;

  const supabase = await createClient();

  /*
   * كل بيانات هذه الصفحة تأتي من دالة واحدة على السيرفر. هي التي تقرر ماذا
   * يُرسل: إن كان المدرّس لم يفعّل إظهار الإجابات، تصل الحقول السرّية بقيمة
   * null من قاعدة البيانات نفسها ولا تُرسل أصلاً إلى المتصفح.
   */
  const { data, error } = await supabase.rpc("get_attempt_review", {
    p_attempt_id: attemptId,
  });

  if (error || !data) notFound();

  const review = data as AttemptReview;
  const { attempt, exam, questions } = review;

  await supabase.rpc("mark_feedback_seen", { p_attempt_id: attemptId });

  const graded = attempt.status === "graded";
  const earned = Number(attempt.auto_score ?? 0) + Number(attempt.manual_score ?? 0);
  const essayCount = questions.filter((q) => q.type === "essay").length;

  return (
    <>
      <Link
        href="/results"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4" strokeWidth={1.5} />
        نتائج الامتحانات
      </Link>

      {submitted === "1" ? (
        <div className="card mb-5 flex items-start gap-3 px-4 py-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ink-3" strokeWidth={1.5} />
          <div>
            <p className="text-sm font-medium text-ink">تم تسليم الامتحان</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-2">
              {essayCount > 0
                ? "الأسئلة الموضوعية اتصححت على طول، والأسئلة المقالية عند المدرّس دلوقتي وهتوصلك درجتها والملاحظات عليها هنا."
                : "امتحانك اتصحح بالكامل. درجتك تحت."}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-6">
        <p className="text-xs text-ink-3">
          {lessonPath(review.chapter_position, review.lesson_position)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">{exam.title}</h1>
          {graded ? (
            <Badge tone="ok">تم التصحيح</Badge>
          ) : (
            <Badge tone="wait">بانتظار التصحيح</Badge>
          )}
          {attempt.exceeded_duration ? <Badge tone="muted">تجاوز الوقت</Badge> : null}
        </div>
      </div>

      <div className="card mb-8 px-4 py-2 sm:px-5">
        <div className="divide-y-[0.5px] divide-line">
          <DataRow label="الدرجة النهائية">
            {graded ? (
              <>
                {formatScore(earned, attempt.total_points)}{" "}
                <span className="text-ink-2">
                  ({percentage(earned, attempt.total_points)})
                </span>
              </>
            ) : (
              "بانتظار تصحيح الأسئلة المقالية"
            )}
          </DataRow>

          {essayCount > 0 ? (
            <>
              <DataRow label="الأسئلة الموضوعية">
                {formatScore(attempt.auto_score, null) === "—"
                  ? "—"
                  : `${Number(attempt.auto_score ?? 0)}`}
              </DataRow>
              <DataRow label="الأسئلة المقالية">
                {attempt.manual_score === null
                  ? "بانتظار التصحيح"
                  : `${Number(attempt.manual_score)}`}
              </DataRow>
            </>
          ) : null}

          <DataRow label="وقت التسليم">{formatDateTime(attempt.submitted_at)}</DataRow>
          <DataRow label="الوقت المستغرق">
            {formatDuration(attempt.time_spent_seconds)}
            {exam.duration_minutes ? (
              <span className="text-ink-3"> · المدة {exam.duration_minutes} دقيقة</span>
            ) : null}
          </DataRow>
        </div>
      </div>

      <ol className="flex flex-col gap-4">
        {questions.map((question, index) => (
          <ReviewQuestionCard
            key={question.id}
            question={question}
            index={index}
            attemptId={attempt.id}
          />
        ))}
      </ol>
    </>
  );
}
