"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { updateExamAction } from "@/app/actions/admin-exams";
import type { ExamKind, ExamLevel } from "@/lib/types";

export function ExamSettingsForm({
  examId,
  title: initialTitle,
  level: initialLevel,
  kind: initialKind,
  durationMinutes: initialDuration,
}: {
  examId: string;
  title: string;
  level: ExamLevel;
  kind: ExamKind;
  durationMinutes: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const [level, setLevel] = useState<ExamLevel>(initialLevel);
  const [kind, setKind] = useState<ExamKind>(initialKind);
  const [duration, setDuration] = useState(
    initialDuration === null ? "" : String(initialDuration),
  );
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateExamAction({
        examId,
        title,
        level,
        kind,
        durationMinutes: duration.trim() === "" ? null : Number(duration),
      });

      if (result.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost text-xs"
        onClick={() => setOpen(true)}
      >
        تعديل البيانات
      </button>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="edit-title">
          العنوان
        </label>
        <input
          id="edit-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="edit-kind">
            النوع
          </label>
          <select
            id="edit-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as ExamKind)}
            className="input"
          >
            <option value="practice">تدريب</option>
            <option value="exam">امتحان</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="edit-level">
            المستوى
          </label>
          <select
            id="edit-level"
            value={level}
            onChange={(e) => setLevel(e.target.value as ExamLevel)}
            className="input"
          >
            <option value="basic">أساسي</option>
            <option value="advanced">متقدم</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="edit-duration">
            المدة بالدقائق
          </label>
          <input
            id="edit-duration"
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="input tnum"
            placeholder="فاضي = بدون وقت"
          />
        </div>
      </div>

      {error ? (
        <p className="badge badge-bad w-full justify-start px-3 py-2">{error}</p>
      ) : null}

      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : null}
          حفظ
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
