"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface Result {
  error?: string;
  ok?: boolean;
}

/**
 * زر ينفّذ server action مربوطاً بوسائطه مسبقاً عبر .bind، ويعرض حالة
 * الانتظار والخطأ. يوفّر كتابة نموذج كامل لكل إجراء صغير في لوحة المدرّس.
 *
 * confirm: نص تأكيد يظهر كخطوة ثانية قبل التنفيذ، للإجراءات التي يصعب التراجع عنها.
 */
export function ActionButton({
  action,
  children,
  className = "btn btn-secondary",
  confirm,
  onDone,
}: {
  action: () => Promise<Result>;
  children: ReactNode;
  className?: string;
  confirm?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result?.error) {
        setError(result.error);
        setArmed(false);
        return;
      }
      setArmed(false);
      onDone?.();
      router.refresh();
    });
  }

  if (confirm && armed) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-2">{confirm}</span>
        <button
          type="button"
          className="btn btn-danger py-1 text-xs"
          onClick={run}
          disabled={pending}
        >
          {pending ? <Loader2 className="size-3 animate-spin" /> : null}
          تأكيد
        </button>
        <button
          type="button"
          className="btn btn-ghost py-1 text-xs"
          onClick={() => setArmed(false)}
          disabled={pending}
        >
          إلغاء
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={cn(className)}
        onClick={() => (confirm ? setArmed(true) : run())}
        disabled={pending}
      >
        {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : null}
        {children}
      </button>
      {error ? <span className="badge badge-bad">{error}</span> : null}
    </span>
  );
}
