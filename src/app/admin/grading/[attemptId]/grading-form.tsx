"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";

import { gradeAttemptAction } from "@/app/actions/admin-students";
import { Badge } from "@/components/ui/primitives";
import { formatPoints } from "@/lib/format";
import type { ReviewQuestion } from "@/lib/types";

interface Draft {
  awarded: string;
  feedback: string;
}

export function GradingForm({
  attemptId,
  questions,
  alreadyGraded,
}: {
  attemptId: string;
  questions: ReviewQuestion[];
  alreadyGraded: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      questions.map((q) => [
        q.id,
        {
          awarded: q.awarded_points === null ? "" : String(q.awarded_points),
          feedback: q.feedback ?? "",
        },
      ]),
    ),
  );

  function update(questionId: string, patch: Partial<Draft>) {
    setSaved(false);
    setDrafts((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));
  }

  function submit() {
    setError(null);

    const missing = questions.find(
      (q) => (drafts[q.id]?.awarded ?? "").trim() === "",
    );
    if (missing) {
      setError("اكتب درجة لكل سؤال مقالي قبل الإرسال.");
      return;
    }

    const outOfRange = questions.find((q) => {
      const value = Number(drafts[q.id].awarded);
      return Number.isNaN(value) || value < 0 || value > Number(q.points);
    });
    if (outOfRange) {
      setError(
        `الدرجة لازم تكون بين صفر و ${formatPoints(outOfRange.points)} لكل سؤال.`,
      );
      return;
    }

    startTransition(async () => {
      const result = await gradeAttemptAction(
        attemptId,
        questions.map((q) => ({
          question_id: q.id,
          awarded_points: Number(drafts[q.id].awarded),
          feedback: drafts[q.id].feedback,
        })),
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <>
      <ol className="flex flex-col gap-4">
        {questions.map((question, index) => {
          const text =
            question.response && "text" in question.response
              ? question.response.text.trim()
              : "";
          const imageSrc = question.image_path
            ? `/answer-image?attempt=${attemptId}&question=${question.id}`
            : null;

          return (
            <li key={question.id} className="card px-4 py-4 sm:px-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="tnum text-sm font-semibold text-ink">
                  السؤال المقالي {index + 1}
                </span>
                <span className="tnum text-xs text-ink-3">
                  من {formatPoints(question.points)} درجة
                </span>
              </div>

              <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {question.body}
              </p>

              <div className="divider pt-4">
                <p className="mb-2 text-xs font-medium text-ink-2">إجابة الطالب</p>

                {text ? (
                  <p className="mb-3 whitespace-pre-wrap rounded-[6px] border-[0.5px] border-line px-3 py-2.5 text-sm leading-relaxed text-ink">
                    {text}
                  </p>
                ) : null}

                {imageSrc ? (
                  <a
                    href={imageSrc}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-1 block overflow-hidden rounded-[6px] border-[0.5px] border-line"
                  >
                    <Image
                      src={imageSrc}
                      alt="صورة إجابة الطالب"
                      width={1200}
                      height={900}
                      unoptimized
                      className="h-auto w-full object-contain"
                    />
                  </a>
                ) : null}

                {imageSrc ? (
                  <p className="mb-3 text-xs text-ink-3">اضغط على الصورة لتكبيرها</p>
                ) : null}

                {!text && !imageSrc ? (
                  <p className="mb-3 text-sm text-ink-3">الطالب ما جاوبش على السؤال ده.</p>
                ) : null}
              </div>

              <div className="divider grid gap-3 pt-4 sm:grid-cols-[8rem_1fr]">
                <div>
                  <label className="label" htmlFor={`points-${question.id}`}>
                    الدرجة
                  </label>
                  <input
                    id={`points-${question.id}`}
                    type="number"
                    step="0.5"
                    min={0}
                    max={Number(question.points)}
                    value={drafts[question.id]?.awarded ?? ""}
                    onChange={(e) => update(question.id, { awarded: e.target.value })}
                    className="input tnum"
                  />
                </div>

                <div>
                  <label className="label" htmlFor={`feedback-${question.id}`}>
                    ملاحظات للطالب
                  </label>
                  <textarea
                    id={`feedback-${question.id}`}
                    rows={3}
                    value={drafts[question.id]?.feedback ?? ""}
                    onChange={(e) => update(question.id, { feedback: e.target.value })}
                    className="input resize-y leading-relaxed"
                    placeholder="اختياري"
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="card mt-6 px-4 py-5 sm:px-5">
        {error ? (
          <p className="badge badge-bad mb-3 w-full justify-start px-3 py-2">{error}</p>
        ) : null}

        {saved ? (
          <p className="badge badge-ok mb-3 w-full justify-start px-3 py-2">
            اتحفظ التصحيح ووصل للطالب.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <Send className="size-4" strokeWidth={1.5} />
            )}
            {pending ? "جارٍ الإرسال…" : alreadyGraded ? "حفظ التعديلات" : "إرسال التصحيح"}
          </button>

          {alreadyGraded ? (
            <Badge tone="muted">
              الامتحان ده اتصحح قبل كده — أي تعديل هنا هيوصل للطالب على طول
            </Badge>
          ) : null}
        </div>
      </div>
    </>
  );
}
