"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";

import { startExamAction } from "@/app/actions/exam";

export function StartExamButton({ examId }: { examId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startExamAction(examId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary w-full sm:w-auto"
        onClick={start}
        disabled={pending}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
        ) : (
          <PlayCircle className="size-4" strokeWidth={1.5} />
        )}
        {pending ? "جارٍ الفتح…" : "ابدأ الامتحان"}
      </button>

      {error ? (
        <p className="badge badge-bad mt-3 w-full justify-start px-3 py-2">{error}</p>
      ) : null}
    </div>
  );
}
