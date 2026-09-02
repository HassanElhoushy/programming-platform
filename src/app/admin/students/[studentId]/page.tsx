import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import {
  PermissionsPanel,
  type PermissionChapter,
} from "./permissions-panel";
import { ResetPassword } from "./reset-password";
import {
  setFullAccessAction,
  setStudentStatusAction,
  voidAttemptAction,
} from "@/app/actions/admin-students";
import { ActionButton } from "@/components/action-button";
import { Badge, DataRow, SectionTitle } from "@/components/ui/primitives";
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatScore,
  lessonPath,
  percentage,
} from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { UserStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<UserStatus, { tone: "ok" | "wait" | "bad"; label: string }> = {
  active: { tone: "ok", label: "مفعّل" },
  pending: { tone: "wait", label: "بانتظار الموافقة" },
  blocked: { tone: "bad", label: "موقوف" },
};

interface LessonRow {
  id: string;
  title: string;
  position: number;
  kind: string;
}

export default async function StudentDetailPage({
  params,
}: PageProps<"/admin/students/[studentId]">) {
  const { studentId } = await params;
  const supabase = await createClient();

  const { data: student } = await supabase
    .from("profiles")
    .select("id, full_name, phone, status, full_access, created_at, role")
    .eq("id", studentId)
    .maybeSingle();

  if (!student || student.role !== "student") notFound();

  const [chaptersRes, filesRes, examsRes, permsRes, eventsRes, attemptsRes] =
    await Promise.all([
      supabase
        .from("chapters")
        .select("id, title, position, kind, lessons(id, title, position, kind)")
        .is("archived_at", null)
        .order("position"),
      supabase
        .from("lesson_files")
        .select("id, lesson_id, title, kind")
        .is("archived_at", null)
        .order("position"),
      supabase
        .from("exams")
        .select("id, lesson_id, title")
        .is("archived_at", null)
        .order("created_at"),
      supabase
        .from("permissions")
        .select("resource_type, resource_id")
        .eq("student_id", studentId),
      supabase
        .from("file_events")
        .select("file_id, action, created_at")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("exam_attempts")
        .select(
          "id, status, started_at, submitted_at, time_spent_seconds, exceeded_duration, auto_score, manual_score, total_points, voided_at, exams(title, lessons(position, kind, chapters(position, kind)))",
        )
        .eq("student_id", studentId)
        .order("started_at", { ascending: false }),
    ]);

  const filesByLesson = new Map<string, { id: string; title: string; kind: string }[]>();
  for (const file of filesRes.data ?? []) {
    const list = filesByLesson.get(file.lesson_id) ?? [];
    list.push({ id: file.id, title: file.title, kind: file.kind });
    filesByLesson.set(file.lesson_id, list);
  }

  const examsByLesson = new Map<string, { id: string; title: string }[]>();
  for (const exam of examsRes.data ?? []) {
    const list = examsByLesson.get(exam.lesson_id) ?? [];
    list.push({ id: exam.id, title: exam.title });
    examsByLesson.set(exam.lesson_id, list);
  }

  const chapters: PermissionChapter[] = (chaptersRes.data ?? []).map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    position: chapter.position,
    kind: chapter.kind,
    lessons: ((chapter.lessons as unknown as LessonRow[]) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        position: lesson.position,
        kind: lesson.kind,
        files: filesByLesson.get(lesson.id) ?? [],
        exams: examsByLesson.get(lesson.id) ?? [],
      })),
  }));

  const granted = (permsRes.data ?? []).map(
    (p) => `${p.resource_type}:${p.resource_id}`,
  );

  /* نشاط الملفات: عدد المرات وآخر مرة لكل ملف */
  const fileStats = new Map<
    string,
    { views: number; downloads: number; last: string }
  >();
  for (const event of eventsRes.data ?? []) {
    const entry = fileStats.get(event.file_id) ?? {
      views: 0,
      downloads: 0,
      last: event.created_at,
    };
    if (event.action === "download") entry.downloads += 1;
    else entry.views += 1;
    fileStats.set(event.file_id, entry);
  }

  const fileTitles = new Map(
    (filesRes.data ?? []).map((f) => [f.id, f.title as string]),
  );

  const attempts = attemptsRes.data ?? [];
  const badge = STATUS_BADGE[student.status as UserStatus];

  return (
    <>
      <Link
        href="/admin/students"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4" strokeWidth={1.5} />
        الطلاب
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">
            {student.full_name}
          </h1>
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {student.full_access ? <Badge tone="accent">كل الصلاحيات</Badge> : null}
        </div>
        <p dir="ltr" className="tnum mt-1 text-right text-sm text-ink-2">
          {student.phone}
        </p>
        <p className="mt-0.5 text-xs text-ink-3">
          سجّل في {formatDate(student.created_at)}
        </p>
      </div>

      {/* ------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionTitle>الحساب</SectionTitle>

        <div className="card flex flex-col gap-4 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            {student.status !== "active" ? (
              <ActionButton
                action={setStudentStatusAction.bind(null, studentId, "active")}
                className="btn btn-primary"
              >
                فعّل الحساب
              </ActionButton>
            ) : null}

            {student.status !== "blocked" ? (
              <ActionButton
                action={setStudentStatusAction.bind(null, studentId, "blocked")}
                className="btn btn-danger"
                confirm="الطالب مش هيقدر يدخل حسابه. درجاته هتفضل محفوظة."
              >
                أوقف الحساب
              </ActionButton>
            ) : null}

            {student.status === "blocked" ? (
              <ActionButton
                action={setStudentStatusAction.bind(null, studentId, "pending")}
                className="btn btn-secondary"
              >
                رجّعه بانتظار الموافقة
              </ActionButton>
            ) : null}
          </div>

          <div className="divider pt-4">
            <ResetPassword studentId={studentId} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionTitle
          action={
            <ActionButton
              action={setFullAccessAction.bind(null, studentId, !student.full_access)}
              className="btn btn-secondary text-xs"
            >
              {student.full_access ? "اسحب كل الصلاحيات" : "افتح كل الصلاحيات"}
            </ActionButton>
          }
        >
          الصلاحيات
        </SectionTitle>

        <PermissionsPanel
          studentId={studentId}
          chapters={chapters}
          granted={granted}
          fullAccess={student.full_access}
        />
      </section>

      {/* ------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionTitle>الامتحانات</SectionTitle>

        {attempts.length === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-ink-3">
            ما دخلش أي امتحان لسه
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {attempts.map((attempt) => {
              const exam = attempt.exams as unknown as {
                title: string;
                lessons: { position: number; kind: string; chapters: { position: number; kind: string } | null } | null;
              } | null;

              const earned =
                Number(attempt.auto_score ?? 0) + Number(attempt.manual_score ?? 0);
              const graded = attempt.status === "graded";

              return (
                <div key={attempt.id} className="card px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-ink-3">
                        {lessonPath(
                          exam?.lessons?.chapters?.position ?? 0,
                          exam?.lessons?.position ?? 0,
                          exam?.lessons?.kind,
                          exam?.lessons?.chapters?.kind,
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium text-ink">
                        {exam?.title}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {attempt.voided_at ? (
                          <Badge tone="muted">محاولة ملغاة</Badge>
                        ) : attempt.status === "in_progress" ? (
                          <Badge tone="wait">تحت الحل</Badge>
                        ) : graded ? (
                          <Badge tone="ok">تم التصحيح</Badge>
                        ) : (
                          <Badge tone="wait">بانتظار التصحيح</Badge>
                        )}
                        {attempt.exceeded_duration ? (
                          <Badge tone="bad">تجاوز الوقت</Badge>
                        ) : null}
                      </div>

                      <p className="tnum mt-2 text-xs text-ink-3">
                        بدأ {formatDateTime(attempt.started_at)}
                        {attempt.submitted_at
                          ? ` · سلّم ${formatDateTime(attempt.submitted_at)}`
                          : ""}
                        {attempt.time_spent_seconds !== null
                          ? ` · استغرق ${formatDuration(attempt.time_spent_seconds)}`
                          : ""}
                      </p>
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
                      ) : null}
                    </div>
                  </div>

                  <div className="divider mt-3 flex flex-wrap items-center gap-2 pt-3">
                    {attempt.status !== "in_progress" && !attempt.voided_at ? (
                      <Link
                        href={`/admin/grading/${attempt.id}`}
                        className="btn btn-secondary text-xs"
                      >
                        افتح التسليم
                      </Link>
                    ) : null}

                    {!attempt.voided_at ? (
                      <ActionButton
                        action={voidAttemptAction.bind(null, attempt.id, studentId)}
                        className="btn btn-ghost text-xs"
                        confirm="المحاولة دي هتتلغي والطالب هيقدر يحل الامتحان من جديد. السجل القديم هيفضل محفوظ."
                      >
                        اسمح بإعادة المحاولة
                      </ActionButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------- */}
      <section>
        <SectionTitle>الملفات اللي فتحها</SectionTitle>

        {fileStats.size === 0 ? (
          <p className="card px-4 py-6 text-center text-sm text-ink-3">
            ما فتحش أي ملف لسه
          </p>
        ) : (
          <div className="card px-4 py-2 sm:px-5">
            <div className="divide-y-[0.5px] divide-line">
              {Array.from(fileStats.entries()).map(([fileId, stats]) => (
                <DataRow key={fileId} label={fileTitles.get(fileId) ?? "ملف محذوف"}>
                  <span className="text-ink-2">
                    {stats.views > 0 ? `${stats.views} فتح` : ""}
                    {stats.views > 0 && stats.downloads > 0 ? " · " : ""}
                    {stats.downloads > 0 ? `${stats.downloads} تحميل` : ""}
                    {" · آخر مرة "}
                    {formatDateTime(stats.last)}
                  </span>
                </DataRow>
              ))}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
