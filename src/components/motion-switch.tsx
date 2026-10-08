"use client";

import { useState } from "react";

import { setMotionBackgroundAction } from "@/app/actions/motion-background";
import { cn } from "@/lib/utils";

export function MotionSwitch({ enabled }: { enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setPending(true);
    setError(null);
    const result = await setMotionBackgroundAction(next);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOn(next);
  }

  return (
    <div className="card mb-4 flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">الخلفية المتحركة</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
          بتظهر في الداشبورد وصفحات التصفح، عندك وعند الطلبة. مش بتظهر وهم بيحلوا.
        </p>
        {error ? <p className="mt-1 text-xs text-bad">{error}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="الخلفية المتحركة"
        disabled={pending}
        onClick={toggle}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border-[0.5px] transition-colors duration-150",
          on ? "border-accent bg-accent" : "border-line bg-page",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-surface transition-[inset-inline-start] duration-150",
            on ? "start-5" : "start-0.5",
          )}
        />
      </button>
    </div>
  );
}
