import { ClipboardList } from "lucide-react";

import { ExamCard } from "@/components/shared";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "الامتحانات · منصة البرمجة" };
export const dynamic = "force-dynamic";

interface LessonRef {
  position: number;
  chapters: { position: number } | null;
}

export default async function ExamsPage() {
  const supabase = await createClient();

  const [examsRes, attemptsRes] = await Promise.all([
    supabase
      .from("exams")
      .select(
        "id, title, level, duration_minutes, is_open, created_at, lessons(position, chapters(position))",
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("exam_attempts")
      .select("id, exam_id, status")
      .is("voided_at", null),
  ]);

  const exams = examsRes.data ?? [];
  const attemptByExam = new Map(
    (attemptsRes.data ?? []).map((a) => [a.exam_id, a]),
  );

  // المفتوح وغير المحلول أولاً، فالباقي — الطالب يهمه ما عليه فعله الآن
  const todo = exams.filter(
    (e) => e.is_open && !attemptByExam.has(e.id),
  );
  const started = exams.filter(
    (e) => attemptByExam.get(e.id)?.status === "in_progress",
  );
  const rest = exams.filter(
    (e) => !todo.includes(e) && !started.includes(e),
  );

  const ordered = [...started, ...todo, ...rest];

  return (
    <>
      <PageHeader title="الامتحانات" subtitle="الامتحانات المتاحة لك" />

      {ordered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="مفيش امتحانات متاحة لك"
          hint="أول ما المدرّس يفتح لك امتحان هتلاقيه هنا."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {ordered.map((exam) => {
            const lesson = exam.lessons as unknown as LessonRef | null;
            const attempt = attemptByExam.get(exam.id);

            const status = attempt
              ? attempt.status === "in_progress"
                ? { tone: "wait" as const, label: "لسه ما اتسلّمش" }
                : attempt.status === "submitted"
                  ? { tone: "wait" as const, label: "بانتظار التصحيح" }
                  : { tone: "ok" as const, label: "تم التصحيح" }
              : exam.is_open
                ? null
                : { tone: "muted" as const, label: "مغلق" };

            const href =
              attempt && attempt.status !== "in_progress"
                ? `/results/${attempt.id}`
                : `/exams/${exam.id}`;

            return (
              <ExamCard
                key={exam.id}
                href={href}
                title={exam.title}
                level={exam.level}
                durationMinutes={exam.duration_minutes}
                chapterPosition={lesson?.chapters?.position ?? 0}
                lessonPosition={lesson?.position ?? 0}
                right={status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                cta={
                  attempt?.status === "in_progress"
                    ? "أكمل"
                    : !attempt && exam.is_open
                      ? "ابدأ"
                      : undefined
                }
              />
            );
          })}
        </div>
      )}
    </>
  );
}
