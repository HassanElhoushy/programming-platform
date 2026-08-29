"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Send, Timer } from "lucide-react";

import { EssayInput } from "./essay-input";
import { QuestionInput, type RunnerQuestion } from "./question-input";
import { submitExamAction } from "@/app/actions/exam";
import { Badge } from "@/components/ui/primitives";
import { formatClock, formatPoints, QUESTION_TYPE_LABELS } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { AnswerResponse } from "@/lib/types";

interface Props {
  attemptId: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, { response: AnswerResponse; image_path: string | null }>;
  durationMinutes: number | null;
  initialElapsedSeconds: number;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const FLUSH_INTERVAL_MS = 1250;

export function ExamRunner({
  attemptId,
  questions,
  initialAnswers,
  durationMinutes,
  initialElapsedSeconds,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, AnswerResponse>>(() =>
    Object.fromEntries(
      Object.entries(initialAnswers).map(([k, v]) => [k, v.response]),
    ),
  );
  const [images, setImages] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      Object.entries(initialAnswers).map(([k, v]) => [k, v.image_path]),
    ),
  );

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [elapsed, setElapsed] = useState(initialElapsedSeconds);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /*
   * طابور الحفظ.
   *
   * كل تغيير يدخل الطابور فوراً، ونبضة ثابتة كل ثانية وربع تكتب ما تجمّع.
   * لو فشلت الكتابة ترجع الصفوف إلى الطابور فتلتقطها النبضة التالية —
   * فانقطاع النت يؤخّر الحفظ ولا يضيّع إجابة، والطالب لا يحتاج أن يعرف
   * أن هناك شيئاً يُحفظ أصلاً.
   */
  const queueRef = useRef(new Map<string, Record<string, unknown>>());
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushingRef.current || queueRef.current.size === 0) return;

    flushingRef.current = true;
    const batch = Array.from(queueRef.current.entries());
    queueRef.current.clear();

    try {
      const supabase = createClient();
      const rows = batch.map(([question_id, patch]) => ({
        attempt_id: attemptId,
        question_id,
        ...patch,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("answers")
        .upsert(rows, { onConflict: "attempt_id,question_id" });

      if (error) throw error;
      setSaveState(queueRef.current.size > 0 ? "saving" : "saved");
    } catch {
      for (const [key, patch] of batch) {
        if (!queueRef.current.has(key)) queueRef.current.set(key, patch);
      }
      setSaveState("error");
    } finally {
      flushingRef.current = false;
    }
  }, [attemptId]);

  const queueSave = useCallback(
    (questionId: string, patch: Record<string, unknown>) => {
      const existing = queueRef.current.get(questionId) ?? {};
      queueRef.current.set(questionId, { ...existing, ...patch });
      setSaveState("saving");
    },
    [],
  );

  useEffect(() => {
    const interval = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [flush]);

  // احفظ فوراً لو الطالب قفل الصفحة أو نقل التطبيق للخلفية
  useEffect(() => {
    function onHide() {
      if (document.visibilityState === "hidden") void flush();
    }
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function setResponse(questionId: string, response: AnswerResponse) {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
    queueSave(questionId, { response });
  }

  function setImage(questionId: string, path: string | null) {
    setImages((prev) => ({ ...prev, [questionId]: path }));
    queueSave(questionId, { image_path: path });
  }

  function isAnswered(q: RunnerQuestion): boolean {
    const a = answers[q.id];
    if (q.type === "essay") {
      const hasText = !!a && "text" in a && a.text.trim().length > 0;
      return hasText || !!images[q.id];
    }
    if (!a) return false;
    if ("option_ids" in a) return a.option_ids.length > 0;
    if ("value" in a) return true;
    if ("blanks" in a) return a.blanks.some((b) => b.trim().length > 0);
    return false;
  }

  const answeredCount = questions.filter(isAnswered).length;
  const unanswered = questions.length - answeredCount;

  const limitSeconds = durationMinutes ? durationMinutes * 60 : null;
  const remaining = limitSeconds === null ? null : limitSeconds - elapsed;
  const overtime = remaining !== null && remaining < 0;

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    await flush();

    if (queueRef.current.size > 0) {
      setSubmitError("لسه فيه إجابات ما اتحفظتش. اتأكد من النت وجرّب تاني.");
      setSubmitting(false);
      return;
    }

    const result = await submitExamAction(attemptId);
    if (result?.error) {
      setSubmitError(result.error);
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="sticky top-[3.9rem] z-10 -mx-4 mb-5 border-b-[0.5px] border-line bg-page/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-ink-3" strokeWidth={1.5} />
            {remaining === null ? (
              <span className="tnum text-sm text-ink-2">
                {formatClock(elapsed)}
              </span>
            ) : overtime ? (
              <Badge tone="wait">
                تجاوزت الوقت بـ {formatClock(-remaining)}
              </Badge>
            ) : (
              <span className="tnum text-sm font-medium text-ink">
                {formatClock(remaining)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="tnum text-xs text-ink-2">
              {answeredCount} من {questions.length}
            </span>
            <SaveIndicator state={saveState} />
          </div>
        </div>
      </div>

      {overtime ? (
        <p className="card mb-5 px-4 py-3 text-sm leading-relaxed text-ink-2">
          الوقت المحدد خلص، بس الامتحان لسه مفتوح وتقدر تكمّل عادي. المدرّس
          هيشوف إنك أخدت وقتاً أطول.
        </p>
      ) : null}

      <ol className="flex flex-col gap-4">
        {questions.map((question, index) => (
          <li key={question.id} className="card px-4 py-4 sm:px-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="tnum text-sm font-semibold text-ink">
                  السؤال {index + 1}
                </span>
                <Badge tone="muted">{QUESTION_TYPE_LABELS[question.type]}</Badge>
              </div>
              <span className="tnum text-xs text-ink-3">
                {formatPoints(question.points)} درجة
              </span>
            </div>

            {question.type !== "fill_blank" ? (
              <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {question.body}
              </p>
            ) : null}

            {question.type === "essay" ? (
              <EssayInput
                attemptId={attemptId}
                questionId={question.id}
                text={
                  answers[question.id] && "text" in answers[question.id]!
                    ? (answers[question.id] as { text: string }).text
                    : ""
                }
                imagePath={images[question.id] ?? null}
                onChangeText={(text) => setResponse(question.id, { text })}
                onChangeImage={(path) => setImage(question.id, path)}
              />
            ) : (
              <QuestionInput
                question={question}
                value={answers[question.id] ?? null}
                onChange={(value) => setResponse(question.id, value)}
              />
            )}
          </li>
        ))}
      </ol>

      <div className="card mt-6 px-4 py-5 sm:px-5">
        {!confirming ? (
          <>
            <p className="text-sm text-ink-2">
              {unanswered === 0
                ? "جاوبت على كل الأسئلة."
                : `لسه فاضل ${unanswered} ${unanswered === 1 ? "سؤال" : "أسئلة"} من غير إجابة.`}
            </p>
            <button
              type="button"
              className="btn btn-primary mt-3 w-full sm:w-auto"
              onClick={() => setConfirming(true)}
            >
              <Send className="size-4" strokeWidth={1.5} />
              إرسال الامتحان
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-ink">متأكد إنك عايز تسلّم؟</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              بعد التسليم مش هتقدر تعدّل إجاباتك.
              {unanswered > 0
                ? ` وفيه ${unanswered} ${unanswered === 1 ? "سؤال" : "أسئلة"} من غير إجابة هتتحسب صفر.`
                : ""}
            </p>

            {submitError ? (
              <p className="badge badge-bad mt-3 w-full justify-start px-3 py-2">
                {submitError}
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleSubmit()}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={1.5} />
                ) : (
                  <Send className="size-4" strokeWidth={1.5} />
                )}
                {submitting ? "جارٍ التسليم…" : "أيوه، سلّم الامتحان"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                رجوع للحل
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;

  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-ink-3">
        <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
        جارٍ الحفظ
      </span>
    );
  }

  if (state === "saved") {
    return (
      <span className="flex items-center gap-1 text-xs text-ink-3">
        <Check className="size-3" strokeWidth={1.5} />
        اتحفظ
      </span>
    );
  }

  return (
    <Badge tone="bad">
      <AlertCircle className="size-3" strokeWidth={1.5} />
      الحفظ متأخر، بنحاول تاني
    </Badge>
  );
}
