import { Fragment } from "react";
import Image from "next/image";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import { formatPoints, QUESTION_TYPE_LABELS } from "@/lib/format";
import type { ReviewQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * عرض سؤال بعد التسليم.
 *
 * الحقول السرّية (correct و is_correct) تصل من قاعدة البيانات بقيمة null
 * عندما يكون إظهار الإجابات مقفولاً. لا نخفيها هنا — هي غير موجودة أصلاً في
 * البيانات التي وصلت للصفحة، فلا شيء يمكن استخراجه من مصدر الصفحة أو من
 * تبويب الشبكة.
 */
export function ReviewQuestionCard({
  question,
  index,
  attemptId,
  showEssayImage = true,
}: {
  question: ReviewQuestion;
  index: number;
  attemptId: string;
  showEssayImage?: boolean;
}) {
  const revealed = question.correct !== null;

  return (
    <li className="card px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tnum text-sm font-semibold text-ink">
            السؤال {index + 1}
          </span>
          <Badge tone="muted">{QUESTION_TYPE_LABELS[question.type]}</Badge>
          {question.is_correct === true ? (
            <Badge tone="ok">
              <Check className="size-3" strokeWidth={2} />
              إجابة صحيحة
            </Badge>
          ) : question.is_correct === false ? (
            <Badge tone="bad">
              <X className="size-3" strokeWidth={2} />
              إجابة خاطئة
            </Badge>
          ) : null}
        </div>

        <span className="tnum text-xs text-ink-3">
          {question.awarded_points !== null
            ? `${formatPoints(question.awarded_points)} من ${formatPoints(question.points)}`
            : `${formatPoints(question.points)} درجة`}
        </span>
      </div>

      {question.type !== "fill_blank" ? (
        <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {question.body}
        </p>
      ) : null}

      {question.type === "mcq_single" || question.type === "mcq_multi" ? (
        <ChoiceReview question={question} />
      ) : null}

      {question.type === "true_false" ? <TrueFalseReview question={question} /> : null}

      {question.type === "fill_blank" ? <FillBlankReview question={question} /> : null}

      {question.type === "essay" ? (
        <EssayReview
          question={question}
          attemptId={attemptId}
          showImage={showEssayImage}
        />
      ) : null}

      {question.type !== "essay" && !revealed ? (
        <p className="mt-3 text-xs text-ink-3">
          المدرّس لسه ما فتحش عرض الإجابات النموذجية للامتحان ده.
        </p>
      ) : null}

      {question.feedback ? (
        <div className="divider mt-4 pt-3">
          <p className="mb-1 text-xs font-medium text-ink-2">ملاحظات المدرّس</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {question.feedback}
          </p>
        </div>
      ) : null}
    </li>
  );
}

const OPTION_LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];

function ChoiceReview({ question }: { question: ReviewQuestion }) {
  const chosen =
    question.response && "option_ids" in question.response
      ? question.response.option_ids
      : [];
  const correct =
    question.correct && "option_ids" in question.correct
      ? question.correct.option_ids
      : null;

  return (
    <div className="flex flex-col gap-2">
      {question.options.map((option, i) => {
        const picked = chosen.includes(option.id);
        const isRight = correct?.includes(option.id) ?? false;

        return (
          <div
            key={option.id}
            className={cn(
              "flex items-start gap-3 rounded-[6px] border-[0.5px] px-3 py-2.5",
              correct && isRight
                ? "border-ok/30 bg-ok-bg"
                : picked
                  ? "border-accent-line bg-accent-bg"
                  : "border-line",
            )}
          >
            <span className="mt-px shrink-0 text-sm font-medium text-ink-3">
              {OPTION_LETTERS[i] ?? i + 1}
            </span>
            <span className="flex-1 text-sm leading-relaxed text-ink">
              {option.body}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {picked ? <Badge tone="muted">إجابتك</Badge> : null}
              {correct && isRight ? <Badge tone="ok">الصحيحة</Badge> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrueFalseReview({ question }: { question: ReviewQuestion }) {
  const chosen =
    question.response && "value" in question.response ? question.response.value : null;
  const correct =
    question.correct && "value" in question.correct ? question.correct.value : null;

  const label = (v: boolean | null) => (v === null ? "لم تُجب" : v ? "صح" : "خطأ");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="muted">إجابتك: {label(chosen)}</Badge>
      {correct !== null ? <Badge tone="ok">الصحيحة: {label(correct)}</Badge> : null}
    </div>
  );
}

function FillBlankReview({ question }: { question: ReviewQuestion }) {
  const given =
    question.response && "blanks" in question.response ? question.response.blanks : [];
  const accepted =
    question.correct && "blanks" in question.correct ? question.correct.blanks : null;

  const parts = question.body.split(/(\[\d+\])/g);

  return (
    <div>
      <p className="text-sm leading-[2.4] text-ink">
        {parts.map((part, i) => {
          const marker = part.match(/^\[(\d+)\]$/);
          if (!marker) return <Fragment key={i}>{part}</Fragment>;

          const index = Number(marker[1]) - 1;
          const text = given[index]?.trim();

          return (
            <span
              key={i}
              className={cn(
                "mx-1 inline-block rounded-[6px] border-[0.5px] px-2 py-0.5 align-middle text-sm",
                text ? "border-accent-line bg-accent-bg" : "border-line text-ink-3",
              )}
            >
              {text || "فارغ"}
            </span>
          );
        })}
      </p>

      {accepted ? (
        <div className="divider mt-3 pt-3">
          <p className="mb-1.5 text-xs font-medium text-ink-2">الإجابات الصحيحة</p>
          <ol className="flex flex-col gap-1">
            {accepted.map((options, i) => (
              <li key={i} className="text-sm text-ink">
                <span className="text-ink-3">الفراغ {i + 1}: </span>
                {options.join(" أو ")}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function EssayReview({
  question,
  attemptId,
  showImage,
}: {
  question: ReviewQuestion;
  attemptId: string;
  showImage: boolean;
}) {
  const text =
    question.response && "text" in question.response
      ? question.response.text.trim()
      : "";

  return (
    <div className="flex flex-col gap-3">
      {text ? (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-2">إجابتك المكتوبة</p>
          <p className="whitespace-pre-wrap rounded-[6px] border-[0.5px] border-line px-3 py-2.5 text-sm leading-relaxed text-ink">
            {text}
          </p>
        </div>
      ) : null}

      {showImage && question.image_path ? (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-2">صورة إجابتك</p>
          <a
            href={`/answer-image?attempt=${attemptId}&question=${question.id}`}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-[6px] border-[0.5px] border-line"
          >
            <Image
              src={`/answer-image?attempt=${attemptId}&question=${question.id}`}
              alt="صورة الإجابة"
              width={1000}
              height={750}
              unoptimized
              className="h-auto w-full object-contain"
            />
          </a>
          <p className="mt-1 text-xs text-ink-3">اضغط على الصورة لتكبيرها</p>
        </div>
      ) : null}

      {!text && !question.image_path ? (
        <p className="text-sm text-ink-3">ما جاوبتش على السؤال ده.</p>
      ) : null}

      {/*
        تصل من قاعدة البيانات بقيمة null ما دام المدرّس لم يفتح إظهار
        الإجابات، فلا يظهر هذا القسم أصلاً — لا فارغاً ولا مخفياً بـ CSS.
        وتغيب كذلك عن الأسئلة التي لم تُكتب لها إجابة نموذجية.
      */}
      {question.model_answer ? (
        <div className="divider pt-3">
          <p className="mb-1 text-xs font-medium text-accent">الإجابة النموذجية</p>
          <p className="whitespace-pre-wrap rounded-[6px] border-[0.5px] border-accent-line bg-accent-bg px-3 py-2.5 text-sm leading-relaxed text-ink">
            {question.model_answer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
