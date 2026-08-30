"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil } from "lucide-react";

import { setModelAnswerAction } from "@/app/actions/admin-exams";

/**
 * محرّر الإجابة النموذجية لسؤال مقالي.
 *
 * اختيارية: تركها فارغة يمسح الصف، فلا يظهر للطالب مكان فارغ بعنوان
 * "الإجابة النموذجية". والأسئلة القديمة التي أُنشئت قبل هذه الخاصية تبقى
 * كما هي بلا إجابة.
 */
export function ModelAnswerEditor({
  questionId,
  examId,
  value,
}: {
  questionId: string;
  examId: string;
  value: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setModelAnswerAction(questionId, examId, text);
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
      <div className="divider mt-3 pt-3">
        {value ? (
          <>
            <p className="mb-1 text-xs font-medium text-ink-2">الإجابة النموذجية</p>
            <p className="whitespace-pre-wrap rounded-[6px] border-[0.5px] border-accent-line bg-accent-bg px-3 py-2.5 text-sm leading-relaxed text-ink">
              {value}
            </p>
          </>
        ) : (
          <p className="mb-1 text-xs text-ink-3">
            مفيش إجابة نموذجية — مش هيظهر للطالب أي مكان فاضي.
          </p>
        )}

        <button
          type="button"
          className="btn btn-ghost mt-2 text-xs"
          onClick={() => {
            setText(value ?? "");
            setOpen(true);
          }}
        >
          <Pencil className="size-3.5" strokeWidth={1.5} />
          {value ? "تعديل الإجابة النموذجية" : "اكتب إجابة نموذجية"}
        </button>
      </div>
    );
  }

  return (
    <div className="divider mt-3 pt-3">
      <label className="label" htmlFor={`model-${questionId}`}>
        الإجابة النموذجية
      </label>
      <textarea
        id={`model-${questionId}`}
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="input resize-y leading-relaxed"
        placeholder="اكتب الإجابة اللي تتوقعها من الطالب. اختيارية."
      />
      <p className="mt-1.5 text-xs text-ink-3">
        مش هتظهر للطالب غير لما تفتح «إظهار الإجابات للطلبة». سيبها فاضية عشان
        تمسحها.
      </p>

      {error ? (
        <p className="badge badge-bad mt-2 w-full justify-start px-3 py-2">{error}</p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Check className="size-4" strokeWidth={1.5} />
          )}
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
