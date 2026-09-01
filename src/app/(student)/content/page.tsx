import Link from "next/link";
import { BookOpen, ChevronLeft } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { chapterName, lessonName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "المحتوى · منصة البرمجة" };
export const dynamic = "force-dynamic";

interface LessonRow {
  id: string;
  title: string;
  position: number;
  kind: string;
}

export default async function ContentPage() {
  const supabase = await createClient();

  const [chaptersRes, filesRes, examsRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, title, position, lessons(id, title, position, kind)")
      .is("archived_at", null)
      .order("position"),
    supabase.from("lesson_files").select("id, lesson_id").is("archived_at", null),
    supabase.from("exams").select("id, lesson_id").is("archived_at", null),
  ]);

  const chapters = chaptersRes.data ?? [];

  const fileCounts = new Map<string, number>();
  for (const f of filesRes.data ?? []) {
    fileCounts.set(f.lesson_id, (fileCounts.get(f.lesson_id) ?? 0) + 1);
  }

  const examCounts = new Map<string, number>();
  for (const e of examsRes.data ?? []) {
    examCounts.set(e.lesson_id, (examCounts.get(e.lesson_id) ?? 0) + 1);
  }

  const visible = chapters
    .map((c) => ({
      ...c,
      lessons: ((c.lessons as unknown as LessonRow[]) ?? []).sort(
        (a, b) => a.position - b.position,
      ),
    }))
    .filter((c) => c.lessons.length > 0);

  return (
    <>
      <PageHeader
        title="المحتوى"
        subtitle="دروسك وملفاتها مرتبة بالفصول"
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="لسه ما اتفتحش لك أي درس"
          hint="أول ما المدرّس يفتح لك درساً هتلاقيه هنا بملفاته."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {visible.map((chapter) => (
            <section key={chapter.id}>
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-ink">
                  {chapterName(chapter.position)}
                </h2>
                <p className="text-xs text-ink-3">{chapter.title}</p>
              </div>

              <div className="flex flex-col gap-2">
                {chapter.lessons.map((lesson) => {
                  const nFiles = fileCounts.get(lesson.id) ?? 0;
                  const nExams = examCounts.get(lesson.id) ?? 0;

                  const parts = [
                    nFiles > 0 ? `${nFiles} ملف` : null,
                    nExams > 0 ? `${nExams} تدريب أو امتحان` : null,
                  ].filter(Boolean);

                  return (
                    <Link
                      key={lesson.id}
                      href={`/content/${lesson.id}`}
                      className="card card-hover flex items-center gap-3 px-4 py-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-ink-3">
                          {lessonName(lesson.position, lesson.kind)}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-medium text-ink">
                          {lesson.title}
                        </p>
                        <p className="mt-1 text-xs text-ink-3">
                          {parts.length > 0 ? parts.join(" · ") : "لا يوجد محتوى متاح"}
                        </p>
                      </div>
                      <ChevronLeft
                        className="size-4 shrink-0 text-ink-3"
                        strokeWidth={1.5}
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
