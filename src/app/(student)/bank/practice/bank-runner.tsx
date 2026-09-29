"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import { QuestionInput, type RunnerQuestion } from "../../exams/[examId]/question-input";
import { checkBankAnswerAction, type BankResult } from "@/app/actions/bank";
import { Badge } from "@/components/ui/primitives";
import {
  questionTypeLabel,
  tierLabel,
  choiceShortLabel,
  withChoiceList,
  type UiLocale,
} from "@/lib/format";
import type { AnswerResponse, QuestionType } from "@/lib/types";

export interface BankQuestion {
  id: string;
  type: string;
  body: string;
  points: number;
  blank_count: number;
  tier: string | null;
  bank_title: string;
  options: { id: string; body: string; role: "item" | "choice" }[];
  state: string | null;
  /** مثبَّت وأخطأ فيه بعد ذلك */
  forgot: boolean;
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
  review = false,
  nextHref = "/bank/practice",
  locale = "ar",
}: {
  questions: BankQuestion[];
  remaining: number;
  review?: boolean;
  nextHref?: string;
  locale?: UiLocale;
}) {
  const en = locale === "en";
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
      setError(en ? "Choose an answer first." : "اختار إجابة الأول.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const outcome = await checkBankAnswerAction(question.id, answer);

      if (outcome.error || !outcome.result) {
        setError(outcome.error ?? (en ? "Something went wrong. Try again." : "حصلت مشكلة. حاول تاني."));
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
        <p className="text-base font-medium text-ink">{en ? "Session finished" : "خلّصت الجلسة"}</p>
        <p className="tnum mt-2 text-sm text-ink-2">
          {en ? `${tally.right} right · ${tally.wrong} wrong` : `${tally.right} صح · ${tally.wrong} غلط`}
        </p>
        {/*
          الغلط لا يعود في الجلسة نفسها، فيُقال للطالب متى يعود. بدون هذا
          السطر يظن أن غلطه اتفلت منه.
        */}
        <p className="mt-3 text-xs leading-relaxed text-ink-3">
          {tally.wrong > 0
            ? en
              ? "What you missed will come back at the start of the next session."
              : "اللي غلطت فيه هتلاقيه أول الجلسة الجاية."
            : review
              ? en
                ? "You still remember all of it."
                : "لسه فاكر كل حاجة."
              : en
                ? "All correct."
                : "كله صح."}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-3">
          {remaining > 0
            ? en
              ? `${remaining} questions left in this range.`
              : `لسه فيه ${remaining} سؤال في النطاق ده.`
            : en
              ? "You finished everything in this range."
              : "خلّصت كل اللي في النطاق ده."}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          {remaining > 0 ? (
            <Link href={nextHref} className="btn btn-primary text-sm">
              {en ? "Another session" : "جلسة تانية"}
            </Link>
          ) : null}
          <Link href="/bank" className="btn btn-ghost text-sm">
            {en ? "Back to the bank" : "رجوع للبنك"}
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
          {en ? `${index + 1} of ${questions.length}` : `${index + 1} من ${questions.length}`}
        </p>
        <p className="tnum text-xs text-ink-3">
          {en ? `${tally.right} right · ${tally.wrong} wrong` : `${tally.right} صح · ${tally.wrong} غلط`}
        </p>
      </div>

      <article className="card px-5 py-5">
        {/*
          المستوى معلَن للطالب لا مخفيّ عنه: أن يعرف أن السؤال يطلب تفريقاً
          بين مفهومين متقاربين يوجّه انتباهه، ولا يقول له الإجابة.
        */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="muted">{questionTypeLabel(question.type, locale)}</Badge>
          {question.tier ? (
            <Badge tone="muted">{tierLabel(question.tier, locale)}</Badge>
          ) : null}
          {question.state === "wrong" ? (
            <Badge tone="wait">{en ? "You missed this before" : "غلطت فيه قبل كده"}</Badge>
          ) : question.forgot ? (
            <Badge tone="wait">{en ? "You had this right" : "كنت حالّه صح"}</Badge>
          ) : null}
          <span className="truncate text-xs text-ink-3">{question.bank_title}</span>
        </div>

        {question.type !== "fill_blank" ? (
          <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {withChoiceList(question.type, question.body, question.options, locale)}
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
            locale={locale}
          />
        </fieldset>

        {result ? (
          <Verdict result={result} question={question} locale={locale} />
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
              {pending ? (en ? "Checking…" : "بيتصحّح…") : en ? "Check the answer" : "تأكيد الإجابة"}
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
          {index + 1 === questions.length
            ? en
              ? "Finish the session"
              : "إنهاء الجلسة"
            : en
              ? "Next question"
              : "السؤال اللي بعده"}
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
  locale = "ar",
}: {
  result: BankResult;
  question: BankQuestion;
  locale?: UiLocale;
}) {
  const en = locale === "en";
  const partial =
    !result.is_correct && result.awarded > 0 && result.points > 0;

  return (
    <div className="divider mt-4 pt-4">
      <div className="mb-2 flex items-center gap-2">
        {result.is_correct ? (
          <>
            <Check className="size-4 text-ok" strokeWidth={2} />
            <span className="text-sm font-medium text-ink">{en ? "Correct" : "إجابة صحيحة"}</span>
          </>
        ) : (
          <>
            <X className="size-4 text-bad" strokeWidth={2} />
            <span className="text-sm font-medium text-ink">
              {partial ? (en ? "Partly correct" : "صح جزئياً") : en ? "Incorrect" : "إجابة غير صحيحة"}
            </span>
          </>
        )}
        {partial ? (
          <span className="tnum text-xs text-ink-3">
            {en ? `${result.awarded} of ${result.points}` : `${result.awarded} من ${result.points}`}
          </span>
        ) : null}
      </div>

      <CorrectAnswer result={result} question={question} locale={locale} />

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
  locale = "ar",
}: {
  result: BankResult;
  question: BankQuestion;
  locale?: UiLocale;
}) {
  const en = locale === "en";
  const right = en ? "Correct" : "الصحيح";
  const key = result.correct;
  if (!key) return null;

  const bodyOf = (id: string) => {
    const body = question.options.find((o) => o.id === id)?.body ?? "—";
    if (question.type === "matching" || question.type === "classification") {
      return choiceShortLabel(body);
    }
    return body;
  };

  if ("option_ids" in key) {
    return (
      <Line label={right}>{key.option_ids.map(bodyOf).join(" · ")}</Line>
    );
  }

  if ("value" in key) {
    return <Line label={right}>{key.value ? (en ? "True" : "صح") : en ? "False" : "خطأ"}</Line>;
  }

  if ("blanks" in key) {
    return (
      <Line label={right}>
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
                {isOrdering ? (en ? `Place ${value}` : `المكان ${value}`) : bodyOf(String(value))}
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
