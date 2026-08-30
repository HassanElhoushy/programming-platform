"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, PlayCircle } from "lucide-react";

import { startExamAction } from "@/app/actions/exam";
import { kindDefinite } from "@/lib/format";
import type { ExamKind } from "@/lib/types";

/**
 * البدء بخطوتين عمداً.
 *
 * المحاولة واحدة لا تتكرر، وقد حدث فعلاً أن فتحت طالبة عنصراً لتتصفحه ثم
 * خرجت، فبقيت محاولتها مفتوحة تمنع تعديل الأسئلة ولا تستطيع هي البدء من
 * جديد. الشارة على الكارت وحدها لا تمنع ذلك — من يفتح ليتصفح لا يقرأ
 * الشارات. فالخطوة الثانية هي التي تجعل البدء فعلاً واعياً.
 *
 * النص يشتد على الامتحان ويلين على التدريب، لأن الكلفة مختلفة فعلاً.
 */
export function StartExamButton({
  examId,
  kind,
  durationMinutes,
}: {
  examId: string;
  kind: ExamKind;
  durationMinutes: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const noun = kindDefinite(kind);
  const isExam = kind === "exam";

  function start() {
    setError(null);
    startTransition(async () => {
      const result = await startExamAction(examId);
      if (result.error) {
        setError(result.error);
        setArmed(false);
        return;
      }
      router.refresh();
    });
  }

  if (!armed) {
    return (
      <div>
        <button
          type="button"
          className="btn btn-primary w-full sm:w-auto"
          onClick={() => setArmed(true)}
        >
          <PlayCircle className="size-4" strokeWidth={1.5} />
          ابدأ {noun}
        </button>

        {error ? (
          <p className="badge badge-bad mt-3 w-full justify-start px-3 py-2">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[6px] border-[0.5px] border-line bg-page px-4 py-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className={isExam ? "mt-0.5 size-5 shrink-0 text-bad" : "mt-0.5 size-5 shrink-0 text-ink-3"}
          strokeWidth={1.5}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {isExam ? "ده امتحان — اقرا ده قبل ما تبدأ" : `قبل ما تبدأ ${noun}`}
          </p>

          <ul className="mt-2 flex list-disc flex-col gap-1.5 pr-4 text-sm leading-relaxed text-ink-2">
            <li>
              <span className="font-medium text-ink">عندك محاولة واحدة بس.</span>{" "}
              أول ما تدوس ابدأ، تكون بدأت فعلاً.
            </li>
            <li>
              لو قفلت الصفحة أو النت قطع، هترجع تكمّل من نفس المكان بإجاباتك —
              بس <span className="font-medium text-ink">مش هتقدر تبدأ من الأول</span>.
            </li>
            {durationMinutes ? (
              <li>
                الوقت ({durationMinutes} دقيقة) بيبدأ من دلوقتي ومش بيقف لو خرجت.
              </li>
            ) : null}
            {isExam ? (
              <li>
                لو حصلت مشكلة حقيقية، المدرّس وحده اللي يقدر يفتحه لك من جديد.
              </li>
            ) : null}
          </ul>

          {error ? (
            <p className="badge badge-bad mt-3 w-full justify-start px-3 py-2">{error}</p>
          ) : null}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={start}
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <PlayCircle className="size-4" strokeWidth={1.5} />
              )}
              {pending ? "جارٍ الفتح…" : `أيوه، ابدأ ${noun}`}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setArmed(false)}
              disabled={pending}
            >
              مش دلوقتي
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
