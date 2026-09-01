import Link from "next/link";
import { BookOpen, ChevronLeft } from "lucide-react";

import { CreateChapterForm, CreateLessonForm } from "./forms";
import {
  archiveChapterAction,
  archiveLessonAction,
  restoreChapterAction,
  restoreLessonAction,
} from "@/app/actions/admin-content";
import { ActionButton } from "@/components/action-button";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { chapterName, lessonName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "المحتوى · لوحة المدرّس" };
export const dynamic = "force-dynamic";

interface LessonRow {
  id: string;
  title: string;
  position: number;
  kind: string;
  archived_at: string | null;
}

export default async function AdminContentPage() {
  const supabase = await createClient();

  const [chaptersRes, filesRes, examsRes] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, title, position, archived_at, lessons(id, title, position, kind, archived_at)")
      .order("position"),
    supabase.from("lesson_files").select("id, lesson_id").is("archived_at", null),
    supabase.from("exams").select("id, lesson_id, is_open").is("archived_at", null),
  ]);

  const chapters = (chaptersRes.data ?? []).map((c) => ({
    ...c,
    lessons: ((c.lessons as unknown as LessonRow[]) ?? []).sort(
      (a, b) => a.position - b.position,
    ),
  }));

  const fileCounts = new Map<string, number>();
  for (const f of filesRes.data ?? []) {
    fileCounts.set(f.lesson_id, (fileCounts.get(f.lesson_id) ?? 0) + 1);
  }

  const examCounts = new Map<string, { total: number; open: number }>();
  for (const e of examsRes.data ?? []) {
    const entry = examCounts.get(e.lesson_id) ?? { total: 0, open: 0 };
    entry.total += 1;
    if (e.is_open) entry.open += 1;
    examCounts.set(e.lesson_id, entry);
  }

  const nextChapterPosition =
    Math.max(0, ...chapters.map((c) => c.position)) + 1;

  return (
    <>
      <PageHeader
        title="المحتوى"
        subtitle="الفصول والدروس وما بداخلها"
        action={<CreateChapterForm nextPosition={nextChapterPosition} />}
      />

      {chapters.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="لسه ما أضفتش أي فصل"
          hint="ابدأ بإضافة فصل، وبعدين ضيف دروسه وملفاته وتدريباته."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {chapters.map((chapter) => {
            const nextLessonPosition =
              Math.max(0, ...chapter.lessons.map((l) => l.position)) + 1;

            return (
              <section key={chapter.id}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-ink">
                        {chapterName(chapter.position)}
                      </h2>
                      {chapter.archived_at ? <Badge tone="muted">مؤرشف</Badge> : null}
                    </div>
                    <p className="text-xs text-ink-3">{chapter.title}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <CreateLessonForm
                      chapterId={chapter.id}
                      nextPosition={nextLessonPosition}
                    />
                    {chapter.archived_at ? (
                      <ActionButton
                        action={restoreChapterAction.bind(null, chapter.id)}
                        className="btn btn-ghost text-xs"
                      >
                        استرجاع
                      </ActionButton>
                    ) : (
                      <ActionButton
                        action={archiveChapterAction.bind(null, chapter.id)}
                        className="btn btn-ghost text-xs"
                        confirm="هيختفي من حسابات الطلبة بكل دروسه. الدرجات مش هتضيع."
                      >
                        أرشفة
                      </ActionButton>
                    )}
                  </div>
                </div>

                {chapter.lessons.length === 0 ? (
                  <p className="card px-4 py-6 text-center text-sm text-ink-3">
                    مفيش دروس في الفصل ده لسه
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {chapter.lessons.map((lesson) => {
                      const exams = examCounts.get(lesson.id);
                      const parts = [
                        `${fileCounts.get(lesson.id) ?? 0} ملف`,
                        `${exams?.total ?? 0} تدريب أو امتحان`,
                        exams?.open ? `${exams.open} مفتوح` : null,
                      ].filter(Boolean);

                      return (
                        <div
                          key={lesson.id}
                          className="card card-hover flex items-center gap-2 px-4 py-3.5"
                        >
                          <Link
                            href={`/admin/content/${lesson.id}`}
                            className="min-w-0 flex-1"
                          >
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-ink-3">
                                {lessonName(lesson.position, lesson.kind)}
                              </p>
                              {lesson.archived_at ? (
                                <Badge tone="muted">مؤرشف</Badge>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-sm font-medium text-ink">
                              {lesson.title}
                            </p>
                            <p className="mt-1 text-xs text-ink-3">
                              {parts.join(" · ")}
                            </p>
                          </Link>

                          {lesson.archived_at ? (
                            <ActionButton
                              action={restoreLessonAction.bind(null, lesson.id)}
                              className="btn btn-ghost text-xs"
                            >
                              استرجاع
                            </ActionButton>
                          ) : (
                            <ActionButton
                              action={archiveLessonAction.bind(null, lesson.id)}
                              className="btn btn-ghost text-xs"
                              confirm="هيختفي من حسابات الطلبة."
                            >
                              أرشفة
                            </ActionButton>
                          )}

                          <ChevronLeft
                            className="size-4 shrink-0 text-ink-3"
                            strokeWidth={1.5}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
