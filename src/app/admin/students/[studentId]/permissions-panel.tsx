"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import {
  setLessonBundleAction,
  setPermissionAction,
} from "@/app/actions/admin-students";
import { chapterName, lessonName } from "@/lib/format";
import type { PermissionResource } from "@/lib/types";

export interface PermissionLesson {
  id: string;
  title: string;
  position: number;
  kind: string;
  files: { id: string; title: string; kind: string }[];
  exams: { id: string; title: string }[];
}

export interface PermissionChapter {
  id: string;
  title: string;
  position: number;
  lessons: PermissionLesson[];
}

function key(type: PermissionResource, id: string) {
  return `${type}:${id}`;
}

export function PermissionsPanel({
  studentId,
  chapters,
  granted,
  fullAccess,
}: {
  studentId: string;
  chapters: PermissionChapter[];
  granted: string[];
  fullAccess: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  /*
   * التبديل متفائل: العلامة تتغير فوراً في الواجهة ثم يُثبّتها router.refresh.
   * المصدر الحقيقي للصلاحية يبقى جدول permissions وسياسات RLS — هذه الحالة
   * للعرض فقط.
   */
  const [optimistic, setOptimistic] = useOptimistic(
    new Set(granted),
    (current: Set<string>, change: { k: string; on: boolean }) => {
      const next = new Set(current);
      if (change.on) next.add(change.k);
      else next.delete(change.k);
      return next;
    },
  );

  function toggle(type: PermissionResource, id: string, on: boolean) {
    const k = key(type, id);
    setBusyKey(k);
    startTransition(async () => {
      setOptimistic({ k, on });
      await setPermissionAction(studentId, type, id, on);
      setBusyKey(null);
      router.refresh();
    });
  }

  function toggleBundle(lesson: PermissionLesson, on: boolean) {
    const k = `bundle:${lesson.id}`;
    setBusyKey(k);
    startTransition(async () => {
      setOptimistic({ k: key("lesson", lesson.id), on });
      for (const file of lesson.files) setOptimistic({ k: key("file", file.id), on });
      for (const exam of lesson.exams) setOptimistic({ k: key("exam", exam.id), on });

      await setLessonBundleAction(studentId, lesson.id, on);
      setBusyKey(null);
      router.refresh();
    });
  }

  if (fullAccess) {
    return (
      <p className="card px-4 py-6 text-center text-sm leading-relaxed text-ink-2">
        الطالب ده عنده كل الصلاحيات، وبيشوف أي درس أو امتحان جديد تضيفه على
        طول. لو قفلت &quot;كل الصلاحيات&quot; هترجع الصلاحيات التفصيلية اللي
        تحت زي ما هي.
      </p>
    );
  }

  if (chapters.length === 0) {
    return (
      <p className="card px-4 py-6 text-center text-sm text-ink-3">
        ما فيش محتوى لسه عشان تفتحه.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {chapters.map((chapter) => (
        <div key={chapter.id}>
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-ink">
              {chapterName(chapter.position)}
            </h3>
            <p className="text-xs text-ink-3">{chapter.title}</p>
          </div>

          <div className="flex flex-col gap-2">
            {chapter.lessons.map((lesson) => {
              const items = [
                ...lesson.files.map((f) => key("file", f.id)),
                ...lesson.exams.map((e) => key("exam", e.id)),
                key("lesson", lesson.id),
              ];
              const allOn = items.every((k) => optimistic.has(k));
              const bundleBusy = busyKey === `bundle:${lesson.id}`;

              return (
                <div key={lesson.id} className="card px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-ink-3">
                        {lessonName(lesson.position, lesson.kind)}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium text-ink">
                        {lesson.title}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      onClick={() => toggleBundle(lesson, !allOn)}
                      disabled={pending}
                    >
                      {bundleBusy ? (
                        <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
                      ) : null}
                      {allOn ? "اسحب الدرس كله" : "افتح الدرس كله"}
                    </button>
                  </div>

                  {lesson.files.length + lesson.exams.length > 0 ? (
                    <div className="divider mt-3 flex flex-col gap-1.5 pt-3">
                      {lesson.files.map((file) => (
                        <Toggle
                          key={file.id}
                          label={file.title}
                          hint={file.kind === "slides" ? "سلايدز" : "شرح"}
                          on={optimistic.has(key("file", file.id))}
                          busy={busyKey === key("file", file.id)}
                          disabled={pending}
                          onToggle={(on) => toggle("file", file.id, on)}
                        />
                      ))}
                      {lesson.exams.map((exam) => (
                        <Toggle
                          key={exam.id}
                          label={exam.title}
                          hint="امتحان"
                          on={optimistic.has(key("exam", exam.id))}
                          busy={busyKey === key("exam", exam.id)}
                          disabled={pending}
                          onToggle={(on) => toggle("exam", exam.id, on)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="divider mt-3 pt-3 text-xs text-ink-3">
                      مفيش ملفات ولا امتحانات في الدرس ده
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Toggle({
  label,
  hint,
  on,
  busy,
  disabled,
  onToggle,
}: {
  label: string;
  hint: string;
  on: boolean;
  busy: boolean;
  disabled: boolean;
  onToggle: (on: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!on)}
      disabled={disabled}
      className="flex items-center gap-3 rounded-[6px] px-2 py-1.5 text-right transition-colors hover:bg-page disabled:opacity-60"
    >
      <span
        className={
          on
            ? "flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[0.5px] border-accent bg-accent text-white"
            : "flex size-4 shrink-0 items-center justify-center rounded-[4px] border-[0.5px] border-line-strong"
        }
      >
        {busy ? (
          <Loader2 className="size-3 animate-spin text-ink-3" strokeWidth={2} />
        ) : on ? (
          <Check className="size-3" strokeWidth={2.5} />
        ) : null}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm text-ink">{label}</span>
      <span className="shrink-0 text-xs text-ink-3">{hint}</span>
    </button>
  );
}
