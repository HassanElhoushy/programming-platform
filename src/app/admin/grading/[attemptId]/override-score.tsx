"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { overrideAutoGradeAction } from "@/app/actions/admin-students";
import { formatPoints } from "@/lib/format";

export function OverrideScore({
  attemptId,
  questionId,
  points,
  awarded,
}: {
  attemptId: string;
  questionId: string;
  points: number;
  awarded: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(
    awarded === null ? "" : String(awarded),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save() {
    setError(null);
    setSaved(false);

    const next = Number(value);
    if (value.trim() === "" || Number.isNaN(next) || next < 0 || next > points) {
      setError(`الدرجة لازم تكون بين صفر و ${formatPoints(points)}.`);
      return;
    }

    startTransition(async () => {
      const result = await overrideAutoGradeAction(attemptId, questionId, next);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="divider mt-4 pt-3">
      <p className="mb-2 text-xs font-medium text-ink-2">تعديل درجة السؤال</p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label" htmlFor={`override-${questionId}`}>
            الدرجة
          </label>
          <input
            id={`override-${questionId}`}
            type="number"
            step="0.5"
            min={0}
            max={points}
            value={value}
            onChange={(e) => {
              setSaved(false);
              setValue(e.target.value);
            }}
            className="input tnum w-28"
          />
        </div>
        <span className="mb-2 text-xs text-ink-3">من {formatPoints(points)}</span>
        <button
          type="button"
          className="btn btn-secondary mb-0.5"
          onClick={save}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
          ) : null}
          {pending ? "جارٍ الحفظ…" : "حفظ الدرجة"}
        </button>
      </div>
      {error ? (
        <p className="badge badge-bad mt-2 w-full justify-start px-3 py-2">{error}</p>
      ) : null}
      {saved ? (
        <p className="badge badge-ok mt-2 w-full justify-start px-3 py-2">
          اتحفظت الدرجة واتحدّث مجموع الامتحان.
        </p>
      ) : null}
    </div>
  );
}
