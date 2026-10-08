import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import { Check, ChevronLeft, Minus, X } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import { isQuestionAnswered } from "@/lib/answered";
import { splitModelAnswer } from "@/lib/model-answer";
import {
  choiceShortLabel,
  formatPoints,
  formatScore,
  normalizeAr,
  questionTypeLabel,
  withChoiceList,
  type UiLocale,
} from "@/lib/format";
import type { ReviewQuestion } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * عرض سؤال بعد التسليم.
 *
 * الحقول السرّية (correct و is_correct) تصل من قاعدة البيانات بقيمة null
 * عندما يكون إظهار الإجابات مقفولاً. لا نخفيها هنا — هي غير موجودة أصلاً في
 * البيانات التي وصلت للصفحة، فلا شيء يمكن استخراجه من مصدر الصفحة أو من
 * تبويب الشبكة.
 *
 * اختيار الطالب يظهر دائماً إن وُجد في الإجابة المحفوظة. إن لم توجد إجابة
 * محفوظة نكتب ذلك صراحةً — «إجابة خاطئة» وحدها مع تظليل الصحيح كانت تخفي
 * أن الطالبة ما جاوبتش أو أن الاختيار ما وصلش المنصة.
 */
export function ReviewQuestionCard({
  question,
  index,
  attemptId,
  showEssayImage = true,
  viewer = "student",
  locale = "ar",
  children,
}: {
  question: ReviewQuestion;
  index: number;
  attemptId: string;
  showEssayImage?: boolean;
  viewer?: "student" | "teacher";
  locale?: UiLocale;
  children?: ReactNode;
}) {
  const en = locale === "en";
  const revealed = question.correct !== null;
  const answered = isQuestionAnswered(
    question.type,
    question.response,
    question.image_path,
  );
  const pickLabel =
    viewer === "teacher" ? (en ? "Student's choice" : "اختيار الطالب") : en ? "Your answer" : "إجابتك";

  return (
    <li className="card px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="tnum text-sm font-semibold text-ink">
            {en ? `Question ${index + 1}` : `السؤال ${index + 1}`}
          </span>
          <Badge tone="muted">{questionTypeLabel(question.type, locale)}</Badge>
          {question.is_correct === true ? (
            <Badge tone="ok">
              <Check className="size-3" strokeWidth={2} />
              {en ? "Correct" : "إجابة صحيحة"}
            </Badge>
          ) : question.is_correct === false && !answered ? (
            <Badge tone="wait">
              <Minus className="size-3" strokeWidth={2} />
              {en ? "No answer" : "بدون إجابة"}
            </Badge>
          ) : question.is_correct === false ? (
            <Badge tone="bad">
              <X className="size-3" strokeWidth={2} />
              {en ? "Incorrect" : "إجابة خاطئة"}
            </Badge>
          ) : null}
        </div>

        <span className="tnum text-xs text-ink-3">
          {question.awarded_points !== null
            ? formatScore(question.awarded_points, question.points, locale)
            : en
              ? `${formatPoints(question.points)} points`
              : `${formatPoints(question.points)} درجة`}
        </span>
      </div>

      {question.type !== "fill_blank" ? (
        <p dir="auto" className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {withChoiceList(question.type, question.body, question.options, locale)}
        </p>
      ) : null}

      {!answered && question.type !== "essay" ? (
        <p className="mb-3 text-sm leading-relaxed text-ink-2">
          {viewer === "teacher"
            ? en
              ? "No saved choice for this question. They either left it blank, or the answer did not reach the platform when they submitted."
              : "مافيش اختيار محفوظ للسؤال ده. يا إما ما جاوبتش، يا إما الإجابة ما وصلتش المنصة وقت التسليم."
            : en
              ? "You did not answer this question."
              : "ما جاوبتش على السؤال ده."}
        </p>
      ) : null}

      {question.type === "mcq_single" || question.type === "mcq_multi" ? (
        <ChoiceReview question={question} pickLabel={pickLabel} locale={locale} />
      ) : null}

      {question.type === "true_false" ? (
        <TrueFalseReview question={question} pickLabel={pickLabel} locale={locale} />
      ) : null}

      {question.type === "fill_blank" ? <FillBlankReview question={question} locale={locale} /> : null}

      {question.type === "matching" ||
      question.type === "ordering" ||
      question.type === "classification" ? (
        <AssignReview question={question} pickLabel={pickLabel} locale={locale} />
      ) : null}

      {question.type === "essay" ? (
        <EssayReview
          question={question}
          attemptId={attemptId}
          showImage={showEssayImage}
          viewer={viewer}
          locale={locale}
        />
      ) : null}

      {question.type !== "essay" && !revealed ? (
        <p className="mt-3 text-xs text-ink-3">
          {en
            ? "Your teacher has not opened the model answers here yet."
            : "المدرّس لسه ما فتحش عرض الإجابات النموذجية هنا."}
        </p>
      ) : null}

      {question.feedback ? (
        <div className="divider mt-4 pt-3">
          <p className="mb-1 text-xs font-medium text-ink-2">{en ? "Teacher's notes" : "ملاحظات المدرّس"}</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {question.feedback}
          </p>
        </div>
      ) : null}

      {/*
        بعد الملاحظة عمداً: الملاحظة مكتوبة لإجابة هذا الطالب بعينه، والإجابة
        النموذجية عامة. ولو سبقتها لذهب البصر إليها أولاً.
      */}
      {question.model_answer ? <ModelAnswer text={question.model_answer} locale={locale} /> : null}

      {children}
    </li>
  );
}

/**
 * الإجابة النموذجية، مطويّة افتراضياً.
 *
 * الطي بصري بحت وليس حماية: ما يصل إلى هنا أصلاً لا يصل إلا بعد أن يفتح
 * المدرّس "إظهار الإجابات"، وقبل ذلك يعود الحقل null من قاعدة البيانات فلا
 * يُصيَّر هذا العنصر إطلاقاً. الغرض من الطي أن يقرأ الطالب ملاحظة مدرّسه
 * ويراجع إجابته قبل أن يرى النموذج.
 *
 * توزيع الدرجات طيّ ثانٍ داخل الإجابة حتى لا يُقرأ كأنه بقية المطلوب.
 * details/summary لا يحتاج جافاسكربت، فيبقى المكوّن على الخادم، ويعمل
 * بلوحة المفاتيح ومع قارئات الشاشة بلا كود إضافي.
 */
function ModelAnswer({ text, locale = "ar" }: { text: string; locale?: UiLocale }) {
  const { answer, scheme } = splitModelAnswer(text);
  const en = locale === "en";

  return (
    <details className="group/answer divider mt-4 pt-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-accent [&::-webkit-details-marker]:hidden">
        <ChevronLeft
          className="size-3.5 transition-transform ltr:rotate-180 group-open/answer:-rotate-90"
          strokeWidth={2}
        />
        {en ? "Model answer" : "الإجابة النموذجية"}
      </summary>

      <p className="mt-2 whitespace-pre-wrap rounded-[6px] border-[0.5px] border-accent-line bg-accent-bg px-3 py-2.5 text-sm leading-relaxed text-ink">
        {answer}
      </p>

      {scheme ? (
        <details className="group/scheme mt-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-ink-2 [&::-webkit-details-marker]:hidden">
            <ChevronLeft
              className="size-3.5 transition-transform ltr:rotate-180 group-open/scheme:-rotate-90"
              strokeWidth={2}
            />
            {en ? "Mark scheme" : "توزيع الدرجات"}
          </summary>
          <p className="mt-2 whitespace-pre-wrap rounded-[6px] border-[0.5px] border-line px-3 py-2.5 text-sm leading-relaxed text-ink-2">
            {scheme}
          </p>
        </details>
      ) : null}
    </details>
  );
}

const OPTION_LETTERS_AR = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];
const OPTION_LETTERS_EN = ["A", "B", "C", "D", "E", "F", "G", "H"];

function ChoiceReview({
  question,
  pickLabel,
  locale = "ar",
}: {
  question: ReviewQuestion;
  pickLabel: string;
  locale?: UiLocale;
}) {
  const letters = locale === "en" ? OPTION_LETTERS_EN : OPTION_LETTERS_AR;
  const correctLabel = locale === "en" ? "Correct" : "الصحيحة";
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
        const wrongPick = picked && correct !== null && !isRight;

        return (
          <div
            key={option.id}
            className={cn(
              "flex items-start gap-3 rounded-[6px] border-[0.5px] px-3 py-2.5",
              correct && isRight
                ? "border-ok/30 bg-ok-bg"
                : wrongPick
                  ? "border-bad/30 bg-bad-bg"
                  : picked
                    ? "border-accent-line bg-accent-bg"
                    : "border-line",
            )}
          >
            <span className="mt-px shrink-0 text-sm font-medium text-ink-3">
              {letters[i] ?? i + 1}
            </span>
            <span className="flex-1 text-sm leading-relaxed text-ink">
              {option.body}
            </span>
            <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
              {picked ? (
                <Badge tone={wrongPick ? "bad" : "muted"}>{pickLabel}</Badge>
              ) : null}
              {correct && isRight ? <Badge tone="ok">{correctLabel}</Badge> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TrueFalseReview({
  question,
  pickLabel,
  locale = "ar",
}: {
  question: ReviewQuestion;
  pickLabel: string;
  locale?: UiLocale;
}) {
  const en = locale === "en";
  const chosen =
    question.response && "value" in question.response ? question.response.value : null;
  const correct =
    question.correct && "value" in question.correct ? question.correct.value : null;

  const label = (v: boolean | null) =>
    v === null ? (en ? "No answer" : "ما جاوبتش") : v ? (en ? "True" : "صح") : en ? "False" : "خطأ";
  const wrong = chosen !== null && correct !== null && chosen !== correct;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={wrong ? "bad" : "muted"}>
        {pickLabel}: {label(chosen)}
      </Badge>
      {correct !== null ? (
        <Badge tone="ok">
          {en ? "Correct" : "الصحيحة"}: {label(correct)}
        </Badge>
      ) : null}
    </div>
  );
}

function FillBlankReview({
  question,
  locale = "ar",
}: {
  question: ReviewQuestion;
  locale?: UiLocale;
}) {
  const en = locale === "en";
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
          const text = given[index]?.trim() ?? "";
          const ok =
            accepted && index < accepted.length
              ? blankMatches(text, accepted[index])
              : null;

          return (
            <span
              key={i}
              className={cn(
                "mx-1 inline-flex items-center gap-1 rounded-[6px] border-[0.5px] px-2 py-0.5 align-middle text-sm",
                ok === true
                  ? "border-ok/30 bg-ok-bg"
                  : ok === false
                    ? "border-bad/30 bg-bad-bg"
                    : text
                      ? "border-accent-line bg-accent-bg"
                      : "border-line text-ink-3",
              )}
            >
              {text || (en ? "empty" : "فارغ")}
              {ok === true ? <Badge tone="ok">{en ? "Right" : "صح"}</Badge> : null}
              {ok === false ? <Badge tone="bad">{en ? "Wrong" : "غلط"}</Badge> : null}
            </span>
          );
        })}
      </p>

      {accepted ? (
        <div className="divider mt-3 pt-3">
          <p className="mb-1.5 text-xs font-medium text-ink-2">{en ? "Correct answers" : "الإجابات الصحيحة"}</p>
          <ol className="flex flex-col gap-1">
            {accepted.map((options, i) => (
              <li key={i} className="text-sm text-ink">
                <span className="text-ink-3">{en ? `Blank ${i + 1}: ` : `الفراغ ${i + 1}: `}</span>
                {options.join(en ? " or " : " أو ")}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function blankMatches(given: string, accepted: string[]): boolean {
  const normalized = normalizeAr(given);
  if (!normalized) return false;
  return accepted.some((option) => normalizeAr(option) === normalized);
}

function EssayReview({
  question,
  attemptId,
  showImage,
  viewer,
  locale = "ar",
}: {
  question: ReviewQuestion;
  attemptId: string;
  showImage: boolean;
  viewer: "student" | "teacher";
  locale?: UiLocale;
}) {
  const en = locale === "en";
  const text =
    question.response && "text" in question.response
      ? question.response.text.trim()
      : "";
  const writtenLabel =
    viewer === "teacher"
      ? en
        ? "Written answer"
        : "إجابتها المكتوبة"
      : en
        ? "Your written answer"
        : "إجابتك المكتوبة";
  const imageLabel =
    viewer === "teacher"
      ? en
        ? "Photo of the answer"
        : "صورة إجابتها"
      : en
        ? "Photo of your answer"
        : "صورة إجابتك";

  return (
    <div className="flex flex-col gap-3">
      {text ? (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-2">{writtenLabel}</p>
          <p className="whitespace-pre-wrap rounded-[6px] border-[0.5px] border-line px-3 py-2.5 text-sm leading-relaxed text-ink">
            {text}
          </p>
        </div>
      ) : null}

      {showImage && question.image_path ? (
        <div>
          <p className="mb-1 text-xs font-medium text-ink-2">{imageLabel}</p>
          <a
            href={`/answer-image?attempt=${attemptId}&question=${question.id}`}
            target="_blank"
            rel="noreferrer"
            className="block overflow-hidden rounded-[6px] border-[0.5px] border-line"
          >
            <Image
              src={`/answer-image?attempt=${attemptId}&question=${question.id}`}
              alt={en ? "Photo of the answer" : "صورة الإجابة"}
              width={1000}
              height={750}
              unoptimized
              className="h-auto w-full object-contain"
            />
          </a>
          <p className="mt-1 text-xs text-ink-3">{en ? "Open the photo to enlarge it" : "اضغط على الصورة لتكبيرها"}</p>
        </div>
      ) : null}

      {!text && !question.image_path ? (
        <p className="text-sm text-ink-3">
          {en ? "No answer was saved for this question." : "ما جاوبتش على السؤال ده."}
        </p>
      ) : null}
    </div>
  );
}

/**
 * مراجعة التوصيل والتصنيف والترتيب.
 *
 * صف لكل عنصر: ما اختاره الطالب، وبجانبه الصحيح إن فتح المدرّس الإظهار.
 * الصف الصحيح لا يُعلَّم بلون خلفية — الشارة الصغيرة تكفي، وهذا هو نظام
 * الألوان في المنصة كلها.
 *
 * ولأن الدرجة جزئية، يرى الطالب أي بند بالضبط ضيّع فيه، لا مجرد أنه أخطأ.
 */
function AssignReview({
  question,
  pickLabel,
  locale = "ar",
}: {
  question: ReviewQuestion;
  pickLabel: string;
  locale?: UiLocale;
}) {
  const en = locale === "en";
  const rows = question.options.filter((o) => o.role === "item");
  const picks = question.options.filter((o) => o.role === "choice");

  const given =
    question.response && "assign" in question.response ? question.response.assign : [];
  const correct =
    question.correct && "assign" in question.correct ? question.correct.assign : null;

  const isOrdering = question.type === "ordering";

  /** نص ما اختاره الطالب: اسم الاختيار في التوصيل والتصنيف، ورقم في الترتيب */
  function label(v: string | number | null | undefined): string {
    if (v === null || v === undefined || v === "") return "—";
    if (isOrdering) return String(v);
    const body = picks.find((p) => p.id === v)?.body;
    return body ? choiceShortLabel(body) : "—";
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => {
        const mine = given[i] ?? null;
        const right = correct ? correct[i] : null;
        const matched = correct !== null && String(mine ?? "") === String(right ?? "");

        return (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-2 rounded-[6px] border-[0.5px] border-line px-3 py-2.5"
          >
            <span className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
              {row.body}
            </span>
            <span className="text-sm text-ink-2">
              {pickLabel}: {label(mine)}
            </span>
            {correct !== null ? (
              matched ? (
                <Badge tone="ok">{en ? "Right" : "صح"}</Badge>
              ) : (
                <Badge tone="bad">
                  {en ? "Correct" : "الصحيح"}: {label(right)}
                </Badge>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
