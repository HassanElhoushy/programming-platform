import Link from "next/link";
import { ChevronLeft, ClipboardCheck } from "lucide-react";

import { Badge, EmptyState, PageHeader, QueryError } from "@/components/ui/primitives";
import { formatDateTime, formatDuration, lessonPath } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "تصحيح الامتحانات · لوحة المدرّس" };
export const dynamic = "force-dynamic";

interface ExamRef {
  title: string;
  lessons: { position: number; chapters: { position: number } | null } | null;
}

export default async function GradingPage() {
  const supabase = await createClient();

  /*
   * لا بد من تسمية المفتاح الأجنبي صراحةً: exam_attempts مرتبط بـ profiles
   * مرتين، عبر student_id وعبر voided_by. وبدون التسمية يرد PostgREST بخطأ
   * PGRST201 بدل البيانات.
   */
  const { data, error } = await supabase
    .from("exam_attempts")
    .select(
      "id, status, submitted_at, time_spent_seconds, exceeded_duration, profiles!exam_attempts_student_id_fkey(full_name), exams(title, lessons(position, chapters(position)))",
    )
    .eq("status", "submitted")
    .is("voided_at", null)
    .order("submitted_at", { ascending: true });

  /*
   * فشل الاستعلام يجب أن يظهر كفشل. عرض قائمة فارغة هنا يعني إخبار المدرّس
   * أن لا شيء ينتظر التصحيح بينما هناك تسليمات فعلاً — وهو أسوأ من خطأ ظاهر.
   */
  if (error) {
    return (
      <>
        <PageHeader
          title="تصحيح الامتحانات"
          subtitle="التسليمات اللي فيها أسئلة مقالية لسه ما اتصححتش"
        />
        <QueryError message={error.message} />
      </>
    );
  }

  const attempts = data ?? [];

  return (
    <>
      <PageHeader
        title="تصحيح الامتحانات"
        subtitle="التسليمات اللي فيها أسئلة مقالية لسه ما اتصححتش"
      />

      {attempts.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="مفيش حاجة محتاجة تصحيح"
          hint="كل التسليمات اتصححت. أي تسليم جديد فيه سؤال مقالي هيظهر هنا."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {attempts.map((attempt) => {
            const exam = attempt.exams as unknown as ExamRef | null;
            const student = attempt.profiles as unknown as {
              full_name: string;
            } | null;

            return (
              <Link
                key={attempt.id}
                href={`/admin/grading/${attempt.id}`}
                className="card card-hover flex items-center gap-3 px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {student?.full_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-3">
                    {lessonPath(
                      exam?.lessons?.chapters?.position ?? 0,
                      exam?.lessons?.position ?? 0,
                    )}{" "}
                    · {exam?.title}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone="wait">بانتظار التصحيح</Badge>
                    {attempt.exceeded_duration ? (
                      <Badge tone="muted">تجاوز الوقت</Badge>
                    ) : null}
                    <span className="tnum text-xs text-ink-3">
                      {formatDuration(attempt.time_spent_seconds)} ·{" "}
                      {formatDateTime(attempt.submitted_at)}
                    </span>
                  </div>
                </div>

                <ChevronLeft className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
