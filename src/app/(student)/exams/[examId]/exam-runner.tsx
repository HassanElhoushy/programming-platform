"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Send, Timer } from "lucide-react";

import { EssayInput } from "./essay-input";
import { QuestionInput, type RunnerQuestion } from "./question-input";
import { submitExamAction } from "@/app/actions/exam";
import { Badge } from "@/components/ui/primitives";
import { formatClock, formatPoints, QUESTION_TYPE_LABELS, withChoiceList } from "@/lib/format";
import {
  clearDraft,
  draftGain,
  readDraft,
  saveDraft,
} from "@/lib/exam-draft";
import { isQuestionAnswered } from "@/lib/answered";
import { createClient } from "@/lib/supabase/client";
import type { AnswerResponse } from "@/lib/types";

interface Props {
  attemptId: string;
  questions: RunnerQuestion[];
  initialAnswers: Record<string, { response: AnswerResponse; image_path: string | null }>;
  durationMinutes: number | null;
  initialElapsedSeconds: number;
  /** الطالب عاد إلى محاولة بدأها، لا يبدأ الآن */
  resuming?: boolean;
}

type SaveState = "idle" | "saving" | "saved" | "error";

const FLUSH_INTERVAL_MS = 1250;

export function ExamRunner({
  attemptId,
  questions,
  initialAnswers,
  durationMinutes,
  initialElapsedSeconds,
  resuming = false,
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
  const [failedTries, setFailedTries] = useState(0);
  const [restorable, setRestorable] = useState<string[]>([]);
  const [restored, setRestored] = useState(false);
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

      /*
       * PostgREST يرفض دفعةً اختلفت مفاتيح صفوفها: "All object keys must
       * match" برمز 400. وكان ذلك يحدث كلما غيّر الطالب سؤالين في نافذة
       * واحدة بحقلين مختلفين — نصاً في أحدهما وصورة في الآخر — فتُرفض
       * الدفعة كلها، وتعود إلى الطابور بالتركيبة نفسها، فتفشل مرة أخرى.
       * تعطّلٌ دائم لا يتوقف: من تلك اللحظة لا يُحفظ شيء.
       *
       * فنقسم حسب مجموعة الحقول ونرسل كل مجموعة وحدها. ولا نملأ الحقول
       * الناقصة بـ null لتتساوى: ذلك يمحو صورة الطالب حين يعدّل نصه.
       */
      const groups = new Map<string, Record<string, unknown>[]>();
      for (const [question_id, patch] of batch) {
        const signature = Object.keys(patch).sort().join(",");
        const rows = groups.get(signature) ?? [];
        rows.push({ attempt_id: attemptId, question_id, ...patch });
        groups.set(signature, rows);
      }

      /*
       * updated_at لا يُرسل: مُحفِّز في قاعدة البيانات يضعه بوقت الخادم.
       * ساعة جهاز الطالب قد تكون متأخرة ساعات، وقد كانت.
       */
      const results = await Promise.all(
        [...groups.values()].map((rows) =>
          supabase.from("answers").upsert(rows, {
            onConflict: "attempt_id,question_id",
          }),
        ),
      );

      const failure = results.find((r) => r.error);
      if (failure?.error) throw failure.error;

      setFailedTries(0);
      setSaveState(queueRef.current.size > 0 ? "saving" : "saved");
    } catch {
      for (const [key, patch] of batch) {
        if (!queueRef.current.has(key)) queueRef.current.set(key, patch);
      }
      setFailedTries((t) => t + 1);
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

  /*
   * هل على الجهاز نصٌّ لم يبلغ الخادم؟ لا نطبّقه من تلقائنا: قد يكون
   * الطالب مسح ما كتبه عمداً، فإحياؤه من ورائه أسوأ من فقدانه. نعرض
   * ونترك القرار له.
   *
   * قراءة localStorage لا تصحّ إلا بعد التركيب — على الخادم لا وجود
   * لـ window، ووضع القراءة في مُهيّئ الحالة يجعل ما يرسمه الخادم مخالفاً
   * لما يرسمه المتصفح. وهذه هي الحالة التي وُجد لها الأثر: قراءة واحدة من
   * مخزن خارجي عند التركيب، لا سلسلة تصييرات متتابعة تحذّر منها القاعدة.
   */
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    const draft = readDraft(attemptId);
    if (!draft) return;
    const fromServer = Object.fromEntries(
      Object.entries(initialAnswers).map(([k, v]) => [k, v.response]),
    );
    const gained = draftGain(draft, fromServer);
    if (gained.length > 0) setRestorable(gained);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

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
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: response };
      saveDraft(attemptId, next, images);
      return next;
    });
    queueSave(questionId, { response });
  }

  function setImage(questionId: string, path: string | null) {
    setImages((prev) => {
      const next = { ...prev, [questionId]: path };
      saveDraft(attemptId, answers, next);
      return next;
    });
    queueSave(questionId, { image_path: path });
  }

  /** يسترجع ما في المسودة ويدفعه إلى الحفظ فوراً */
  function restoreDraft() {
    const draft = readDraft(attemptId);
    if (!draft) return;

    setAnswers((prev) => {
      const next = { ...prev };
      for (const questionId of restorable) {
        next[questionId] = draft.answers[questionId];
        queueSave(questionId, { response: draft.answers[questionId] });
      }
      return next;
    });

    setRestorable([]);
    setRestored(true);
    void flush();
  }

  function isAnswered(q: RunnerQuestion): boolean {
    return isQuestionAnswered(q.type, answers[q.id] ?? null, images[q.id] ?? null);
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

    clearDraft(attemptId);
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

      {/*
        نصٌّ على الجهاز لم يبلغ الخادم. يظهر قبل الأسئلة لا بعدها: من فتح
        الصفحة بعد انقطاع يجب أن يرى هذا قبل أن يبدأ الكتابة من جديد.
      */}
      {/*
        من رجع بعد انقطاع يجب أن يعرف شيئين قبل أن يكتب حرفاً: أن ما حلّه
        باقٍ، وأن الوقت لم يقف في غيابه. الثاني أهم — من ظنّ أن المؤقّت
        توقّف حين خرج يوزّع وقته على غير الحقيقة.
      */}
      {resuming && restorable.length === 0 ? (
        <p className="card mb-5 px-4 py-3 text-sm leading-relaxed text-ink-2">
          إنت بتكمّل محاولة بدأتها قبل كده — <strong>إجاباتك محفوظة زي ما
          سبتها</strong>
          {durationMinutes ? "، والوقت كان ماشي وإنت بره" : ""}. كمّل عادي
          ولما تخلص اضغط إرسال.
        </p>
      ) : null}

      {restorable.length > 0 ? (
        <div className="card mb-5 px-4 py-4">
          <p className="text-sm font-medium text-ink">
            لقينا إجابات كتبتها على جهازك وما وصلتش المنصة
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            غالباً النت اتقطع وإنت بتكتب. عندنا نص{" "}
            <span className="tnum">{restorable.length}</span>{" "}
            {restorable.length === 1 ? "سؤال" : "أسئلة"} محفوظ على الجهاز.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="btn btn-primary text-sm"
            >
              رجّع اللي كتبته
            </button>
            <button
              type="button"
              onClick={() => setRestorable([])}
              className="btn btn-ghost text-sm"
            >
              تجاهل
            </button>
          </div>
        </div>
      ) : null}

      {restored ? (
        <p className="card mb-5 px-4 py-3 text-sm text-ink-2">
          رجّعنا اللي كان محفوظ على جهازك. راجعه قبل ما تسلّم.
        </p>
      ) : null}

      {/*
        التحذير الصامت أسوأ من عدمه. الشارة الصغيرة فوق لا يراها من يكتب
        مقالاً على موبايل، وكانت تقول "بنحاول تاني" فتطمئنه في اللحظة التي
        يجب أن يقلق فيها. بعد محاولتين فاشلتين نقول له الحقيقة كاملة.
      */}
      {saveState === "error" && failedTries >= 2 ? (
        <div className="card mb-5 border-bad px-4 py-4">
          <p className="text-sm font-medium text-ink">
            إجابتك مش بتتحفظ دلوقتي
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            النت مقطوع أو ضعيف. <strong>متقفلش الصفحة ومتعملش تحديث</strong> —
            اللي كتبته محفوظ على جهازك وهنكمّل المحاولة لوحدنا. أول ما النت
            يرجع هيتحفظ. لو اضطررت تقفل، صوّر الشاشة الأول.
          </p>
        </div>
      ) : null}

      {overtime ? (
        <p className="card mb-5 px-4 py-3 text-sm leading-relaxed text-ink-2">
          الوقت المحدد خلص، بس لسه مفتوح وتقدر تكمّل عادي. المدرّس
          هيشوف إنك أخدت وقتاً أطول.
        </p>
      ) : null}

      {/*
        onBlur هنا يلتقط ترك أي خانة داخل القائمة (React يستعمل focusout
        وهو يتصاعد). فمن انتقل من سؤال إلى سؤال حُفظ ما كتبه في اللحظة، ولم
        ينتظر النبضة.
      */}
      <ol className="flex flex-col gap-4" onBlur={() => void flush()}>
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
                {withChoiceList(question.type, question.body, question.options)}
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
              إرسال الإجابات
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
                {submitting ? "جارٍ التسليم…" : "أيوه، سلّم"}
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
