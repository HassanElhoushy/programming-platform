import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Presentation } from "lucide-react";

import { CreateExamForm } from "./create-exam-form";
import { FileUploader } from "./file-uploader";
import { archiveFileAction } from "@/app/actions/admin-content";
import { ActionButton } from "@/components/action-button";
import { Badge, SectionTitle } from "@/components/ui/primitives";
import {
  EXAM_LEVEL_LABELS,
  FILE_KIND_LABELS,
  formatDate,
  formatFileSize,
  lessonPath,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLessonPage({
  params,
}: PageProps<"/admin/content/[lessonId]">) {
  const { lessonId } = await params;
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, title, position, chapters(position, title)")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) notFound();

  const chapter = lesson.chapters as unknown as {
    position: number;
    title: string;
  } | null;

  const [filesRes, examsRes, attemptsRes] = await Promise.all([
    supabase
      .from("lesson_files")
      .select("id, title, kind, size_bytes, created_at")
      .eq("lesson_id", lessonId)
      .is("archived_at", null)
      .order("position"),
    supabase
      .from("exams")
      .select("id, title, level, duration_minutes, is_open, reveal_answers")
      .eq("lesson_id", lessonId)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("exam_attempts")
      .select("exam_id, status")
      .is("voided_at", null),
  ]);

  const files = filesRes.data ?? [];
  const exams = examsRes.data ?? [];

  const attemptStats = new Map<string, { total: number; pending: number }>();
  for (const attempt of attemptsRes.data ?? []) {
    const entry = attemptStats.get(attempt.exam_id) ?? { total: 0, pending: 0 };
    entry.total += 1;
    if (attempt.status === "submitted") entry.pending += 1;
    attemptStats.set(attempt.exam_id, entry);
  }

  return (
    <>
      <Link
        href="/admin/content"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4" strokeWidth={1.5} />
        المحتوى
      </Link>

      <div className="mb-7">
        <p className="text-xs text-ink-3">
          {lessonPath(chapter?.position ?? 0, lesson.position)}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
          {lesson.title}
        </h1>
      </div>

      <section className="mb-8">
        <SectionTitle>الملفات</SectionTitle>

        <div className="mb-3">
          <FileUploader lessonId={lessonId} />
        </div>

        {files.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-ink-3">
            مفيش ملفات مرفوعة للدرس ده
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {files.map((file) => {
              const Icon = file.kind === "slides" ? Presentation : FileText;
              return (
                <div
                  key={file.id}
                  className="card flex items-center gap-3 px-4 py-3"
                >
                  <Icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />

                  <a
                    href={`/files/${file.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1"
                  >
                    <p className="truncate text-sm font-medium text-ink">
                      {file.title}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {FILE_KIND_LABELS[file.kind]} ·{" "}
                      {formatFileSize(file.size_bytes)} ·{" "}
                      {formatDate(file.created_at)}
                    </p>
                  </a>

                  <ActionButton
                    action={archiveFileAction.bind(null, file.id, lessonId)}
                    className="btn btn-ghost text-xs"
                    confirm="هيختفي من حسابات الطلبة."
                  >
                    حذف
                  </ActionButton>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle>الامتحانات</SectionTitle>

        <div className="mb-3">
          <CreateExamForm lessonId={lessonId} />
        </div>

        {exams.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-ink-3">
            مفيش امتحانات على الدرس ده
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {exams.map((exam) => {
              const stats = attemptStats.get(exam.id);
              return (
                <Link
                  key={exam.id}
                  href={`/admin/exams/${exam.id}`}
                  className="card card-hover flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {exam.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone="muted">{EXAM_LEVEL_LABELS[exam.level]}</Badge>
                      <Badge tone={exam.is_open ? "ok" : "muted"}>
                        {exam.is_open ? "مفتوح" : "مغلق"}
                      </Badge>
                      {exam.reveal_answers ? (
                        <Badge tone="accent">الإجابات ظاهرة</Badge>
                      ) : null}
                      {stats?.pending ? (
                        <Badge tone="wait">{stats.pending} محتاج تصحيح</Badge>
                      ) : null}
                      <span className="tnum text-xs text-ink-3">
                        {stats?.total ?? 0} تسليم
                      </span>
                    </div>
                  </div>
                  <ChevronLeft
                    className="size-4 shrink-0 text-ink-3"
                    strokeWidth={1.5}
                  />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
