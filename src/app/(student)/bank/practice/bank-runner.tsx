"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import { QuestionInput, type RunnerQuestion } from "../../exams/[examId]/question-input";
import { checkBankAnswerAction, type BankResult } from "@/app/actions/bank";
import { Badge } from "@/components/ui/primitives";
import { QUESTION_TYPE_LABELS } from "@/lib/format";
import type { AnswerResponse, QuestionType } from "@/lib/types";

export interface BankQuestion {
  id: string;
  type: string;
  body: string;
  points: number;
  blank_count: number;
  bank_title: string;
  options: { id: string; body: string; role: "item" | "choice" }[];
  state: string | null;
}

/**
 * جلسة تدريب في البنك.
 *
 * سؤال واحد على الشاشة، والجواب يُصحَّح فور إرساله. هذا هو الفرق كله عن
 * الامتحان: هناك يجمع الطالب إجاباته ويسلّمها ولا يعرف شيئاً حتى ينتهي،
 * وهنا يعرف فوراً — ولذلك لا مؤقّت ولا درجة تُسجَّل ولا زر تسليم.
 *
 * ما لا يوجد هنا عمداً: عدّاد نقاط، وسلسلة أيام، ولوحة متصدرين. الطالب
 * الضعيف الذي يرى نفسه في ذيل ترتيبٍ يترك المنصة، لا يذاكر أكثر.
 */
export function BankRunner({
  questions,
  remaining,
}: {
  questions: BankQuestion[];
  remaining: number;
}) {
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<AnswerResponse>(null);
  const [result, setResult] = useState<BankResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState({ right: 0, wrong: 0 });
  const [pending, startTransition] = useTransition();

  const question = questions[index];
  const done = index >= questions.length;

  function submit() {
    if (answer === null) {
      setError("اختار إجابة الأول.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const outcome = await checkBankAnswerAction(question.id, answer);

      if (outcome.error || !outcome.result) {
        setError(outcome.error ?? "حصلت مشكلة. حاول تاني.");
        return;
      }

      setResult(outcome.result);
      setTally((t) =>
        outcome.result!.is_correct
          ? { ...t, right: t.right + 1 }
          : { ...t, wrong: t.wrong + 1 },
      );
    });
  }

  function next() {
    setIndex((i) => i + 1);
    setAnswer(null);
    setResult(null);
    setError(null);
  }

  if (done) {
    return (
      <div className="card px-5 py-8 text-center">
        <p className="text-base font-medium text-ink">خلّصت الجلسة</p>
        <p className="tnum mt-2 text-sm text-ink-2">
          {tally.right} صح · {tally.wrong} غلط
        </p>
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          {remaining > 0
            ? `لسه فيه ${remaining} سؤال في النطاق ده.`
            : "خلّصت كل اللي في النطاق ده."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {remaining > 0 ? (
            <Link href="/bank/practice" className="btn btn-primary text-sm">
              جلسة تانية
            </Link>
          ) : null}
          <Link href="/bank" className="btn btn-ghost text-sm">
            رجوع للبنك
          </Link>
        </div>
      </div>
    );
  }

  /* المكوّن نفسه المستعمل في الامتحان — نفس الشكل ونفس السلوك */
  const runnerQuestion: RunnerQuestion = {
    id: question.id,
    position: index + 1,
    type: question.type as QuestionType,
    body: question.body,
    points: question.points,
    blank_count: question.blank_count,
    options: question.options,
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="tnum text-xs text-ink-3">
          {index + 1} من {questions.length}
        </p>
        <p className="tnum text-xs text-ink-3">
          {tally.right} صح · {tally.wrong} غلط
        </p>
      </div>

      <article className="card px-5 py-5">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="muted">{QUESTION_TYPE_LABELS[question.type]}</Badge>
          {question.state === "wrong" ? (
            <Badge tone="wait">غلطت فيه قبل كده</Badge>
          ) : null}
          <span className="truncate text-xs text-ink-3">{question.bank_title}</span>
        </div>

        {question.type !== "fill_blank" ? (
          <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {question.body}
          </p>
        ) : null}

        {/*
          بعد التصحيح نمنع التغيير: السؤال انتهى، وتركُه قابلاً للتعديل
          يوهم الطالب أن إجابته لسه بتتحسب.
        */}
        <fieldset disabled={result !== null || pending} className="border-0 p-0">
          <QuestionInput
            question={runnerQuestion}
            value={answer}
            onChange={setAnswer}
          />
        </fieldset>

        {result ? (
          <Verdict result={result} question={question} />
        ) : (
          <>
            {error ? (
              <p className="mt-3 text-xs text-bad">{error}</p>
            ) : null}
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="btn btn-primary mt-4 w-full text-sm sm:w-auto"
            >
              {pending ? "بيتصحّح…" : "تأكيد الإجابة"}
            </button>
          </>
        )}
      </article>

      {result ? (
        <button
          type="button"
          onClick={next}
          className="btn btn-primary mt-3 w-full text-sm"
        >
          {index + 1 === questions.length ? "إنهاء الجلسة" : "السؤال اللي بعده"}
        </button>
      ) : null}
    </>
  );
}

/**
 * الحكم على الإجابة.
 *
 * الشرح يظهر في الحالتين لا عند الخطأ وحده: من أصاب بالتخمين يحتاج أن يعرف
 * لماذا أصاب بقدر حاجة من أخطأ.
 */
function Verdict({
  result,
  question,
}: {
  result: BankResult;
  question: BankQuestion;
}) {
  const partial =
    !result.is_correct && result.awarded > 0 && result.points > 0;

  return (
    <div className="divider mt-4 pt-4">
      <div className="mb-2 flex items-center gap-2">
        {result.is_correct ? (
          <>
            <Check className="size-4 text-ok" strokeWidth={2} />
            <span className="text-sm font-medium text-ink">إجابة صحيحة</span>
          </>
        ) : (
          <>
            <X className="size-4 text-bad" strokeWidth={2} />
            <span className="text-sm font-medium text-ink">
              {partial ? "صح جزئياً" : "إجابة غير صحيحة"}
            </span>
          </>
        )}
        {partial ? (
          <span className="tnum text-xs text-ink-3">
            {result.awarded} من {result.points}
          </span>
        ) : null}
      </div>

      <CorrectAnswer result={result} question={question} />

      {result.explanation ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
          {result.explanation}
        </p>
      ) : null}
    </div>
  );
}

/** الإجابة الصحيحة بصيغة يقرؤها الطالب، لا بصيغة المفتاح المخزَّن */
function CorrectAnswer({
  result,
  question,
}: {
  result: BankResult;
  question: BankQuestion;
}) {
  const key = result.correct;
  if (!key) return null;

  const bodyOf = (id: string) =>
    question.options.find((o) => o.id === id)?.body ?? "—";

  if ("option_ids" in key) {
    return (
      <Line label="الصحيح">{key.option_ids.map(bodyOf).join(" · ")}</Line>
    );
  }

  if ("value" in key) {
    return <Line label="الصحيح">{key.value ? "صح" : "خطأ"}</Line>;
  }

  if ("blanks" in key) {
    return (
      <Line label="الصحيح">
        {key.blanks.map((accepted, i) => `${i + 1}. ${accepted[0]}`).join(" · ")}
      </Line>
    );
  }

  if ("assign" in key) {
    const items = question.options.filter((o) => o.role === "item");
    const isOrdering = question.type === "ordering";

    return (
      <div className="flex flex-col gap-1.5">
        {items.map((item, i) => {
          const value = key.assign[i];
          return (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <span className="min-w-0 flex-1 text-ink-2">{item.body}</span>
              <span className="text-ink">
                {isOrdering ? `المكان ${value}` : bodyOf(String(value))}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-sm text-ink">
      <span className="text-ink-3">{label}: </span>
      {children}
    </p>
  );
}
