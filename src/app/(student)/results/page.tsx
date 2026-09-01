import Link from "next/link";
import { ChevronLeft, ClipboardCheck } from "lucide-react";

import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDate, formatScore, lessonPath, percentage } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "النتائج · منصة البرمجة" };
export const dynamic = "force-dynamic";

interface ExamRef {
  title: string;
  lessons: { position: number; kind: string; chapters: { position: number } | null } | null;
}

export default async function ResultsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("exam_attempts")
    .select(
      "id, status, submitted_at, auto_score, manual_score, total_points, exceeded_duration, exams(title, lessons(position, kind, chapters(position)))",
    )
    .is("voided_at", null)
    .neq("status", "in_progress")
    .order("submitted_at", { ascending: false });

  const attempts = data ?? [];

  return (
    <>
      <PageHeader title="النتائج" subtitle="اللي حليته قبل كده ودرجاتك فيه" />

      {attempts.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="ما حليتش حاجة لسه"
          hint="أول ما تسلّم تدريب أو امتحان هتلاقي نتيجته هنا."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {attempts.map((attempt) => {
            const exam = attempt.exams as unknown as ExamRef | null;
            const graded = attempt.status === "graded";
            const earned =
              Number(attempt.auto_score ?? 0) + Number(attempt.manual_score ?? 0);

            return (
              <Link
                key={attempt.id}
                href={`/results/${attempt.id}`}
                className="card card-hover flex items-center gap-3 px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-3">
                    {lessonPath(
                      exam?.lessons?.chapters?.position ?? 0,
                      exam?.lessons?.position ?? 0,
                      exam?.lessons?.kind,
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink">
                    {exam?.title}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {graded ? (
                      <Badge tone="ok">تم التصحيح</Badge>
                    ) : (
                      <Badge tone="wait">بانتظار التصحيح</Badge>
                    )}
                    {attempt.exceeded_duration ? (
                      <Badge tone="muted">تجاوز الوقت</Badge>
                    ) : null}
                    <span className="text-xs text-ink-3">
                      {formatDate(attempt.submitted_at)}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-left">
                  {graded ? (
                    <>
                      <p className="tnum text-sm font-semibold text-ink">
                        {percentage(earned, attempt.total_points)}
                      </p>
                      <p className="tnum text-xs text-ink-3">
                        {formatScore(earned, attempt.total_points)}
                      </p>
                    </>
                  ) : (
                    <ChevronLeft className="size-4 text-ink-3" strokeWidth={1.5} />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
