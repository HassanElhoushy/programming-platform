import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";

import { ExamCard, FileRow } from "@/components/shared";
import { Badge, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { lessonPath, reviewScope, type UiLocale } from "@/lib/format";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LessonPage({ params }: PageProps<"/content/[lessonId]">) {
  const { lessonId } = await params;
  const session = await requireStudent();
  const locale: UiLocale = session.profile.track === "en" ? "en" : "ar";
  const en = locale === "en";
  const supabase = await createClient();

  // لو لم يمنح المدرّس صلاحية الدرس، لا يعود صف أصلاً — RLS هي التي ترفض.
  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, position, kind, chapters(position, title, kind)")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) notFound();

  const chapter = lesson.chapters as unknown as {
    position: number;
    title: string;
    kind: string;
  } | null;

  const [filesRes, examsRes, attemptsRes] = await Promise.all([
    supabase
      .from("lesson_files")
      .select("id, title, kind, created_at, position")
      .eq("lesson_id", lessonId)
      .is("archived_at", null)
      .order("position"),
    supabase
      .from("exams")
      .select("id, title, level, kind, duration_minutes, is_open")
      .eq("lesson_id", lessonId)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("exam_attempts")
      .select("id, exam_id, status")
      .is("voided_at", null),
  ]);

  const files = filesRes.data ?? [];
  /*
   * البنك له خانته في الشريط. المحتوى هنا ملف ثم تدريب/امتحان — لو البنك
   * ظهر جوّه الدرس انخلط مع الامتحان (مؤقّت ومحاولة واحدة) والطالب يفتكرهم
   * حاجة واحدة.
   */
  const exams = (examsRes.data ?? []).filter((exam) => exam.kind !== "bank");
  const attemptByExam = new Map(
    (attemptsRes.data ?? []).map((a) => [a.exam_id, a]),
  );

  return (
    <>
      <Link
        href="/content"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4 ltr:rotate-180" strokeWidth={1.5} />
        {en ? "Content" : "المحتوى"}
      </Link>

      <div className="mb-7">
        <p className="text-xs text-ink-3">
          {lessonPath(chapter?.position ?? 0, lesson.position, lesson.kind, chapter?.kind, locale)}
        </p>
        {chapter?.kind === "review" ? (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
            {reviewScope(lesson.position, locale)}
          </p>
        ) : null}
        <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
          {lesson.title}
        </h1>
      </div>

      <section className="mb-8">
        <SectionTitle>{en ? "Files" : "الملفات"}</SectionTitle>

        {files.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={en ? "No files in this lesson" : "مفيش ملفات متاحة في الدرس ده"}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {files.map((file) => (
              <FileRow
                key={file.id}
                id={file.id}
                title={file.title}
                kind={file.kind}
                createdAt={file.created_at}
                locale={locale}
              />
            ))}
          </div>
        )}
      </section>

      {exams.length > 0 ? (
        <section>
          <SectionTitle>{en ? "Questions" : "الأسئلة"}</SectionTitle>
          <div className="flex flex-col gap-2">
            {exams.map((exam) => {
              const attempt = attemptByExam.get(exam.id);

              const status = attempt
                ? attempt.status === "in_progress"
                  ? { tone: "wait" as const, label: en ? "Not submitted" : "لسه ما اتسلّمش" }
                  : attempt.status === "submitted"
                    ? { tone: "wait" as const, label: en ? "Waiting to be graded" : "بانتظار التصحيح" }
                    : { tone: "ok" as const, label: en ? "Graded" : "تم التصحيح" }
                : exam.is_open
                  ? null
                  : { tone: "muted" as const, label: en ? "Closed" : "مغلق" };

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
                  kind={exam.kind}
                  durationMinutes={exam.duration_minutes}
                  chapterPosition={chapter?.position ?? 0}
                  lessonPosition={lesson.position}
                  lessonKind={lesson.kind}
                  chapterKind={chapter?.kind}
                  locale={locale}
                  right={status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
                  cta={
                    attempt?.status === "in_progress"
                      ? en
                        ? "Continue"
                        : "أكمل"
                      : !attempt && exam.is_open
                        ? en
                          ? "Start"
                          : "ابدأ"
                        : undefined
                  }
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
