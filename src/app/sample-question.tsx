"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/primitives";

/**
 * عينة للصفحة الرئيسية فقط. الأسئلة مكتوبة هنا ومش من بنوك الطلاب،
 * عشان مفيش مفتاح امتحان يوصل للمتصفح.
 */
const QUESTIONS = [
  {
    body: "إيه اللي يُعدّ تحقّقًا بخطوتين؟",
    options: [
      "كلمتا سر مختلفتان",
      "كلمة سر ورمز يوصل للموبايل",
      "كلمة سر وتاريخ الميلاد",
      "سؤال سرّي واسم أول مدرسة",
    ],
    correct: 1,
    explanation:
      "الخطوتان لازم يكونوا من نوعين مختلفين: حاجة تعرفها، وحاجة معاك زي الموبايل. كلمتين سر، أو كلمة سر وتاريخ ميلاد، كلهم معرفة. ده مش تحقق بخطوتين.",
  },
  {
    body: "مين اللي بيكتب في قاعدة البيانات؟",
    options: [
      "واجهة الصفحة اللي الطالب بيشوفها",
      "تنسيق الصفحة وألوانها",
      "الخادم بعد ما يراجع الطلب",
      "المتصفح لوحده قبل ما يبعت الطلب",
    ],
    correct: 2,
    explanation:
      "الواجهة بتعرض وبتجمع. الكتابة في قاعدة البيانات قرار الخادم بعد ما يراجع الطلب، عشان القواعد زي منع الحجز المكرر متبقاش في إيد المتصفح.",
  },
  {
    body: "إجابة نموذج لغوي طلعت سلسة ومقنعة. ده معناه إيه؟",
    options: [
      "إنها صحيحة بالضرورة",
      "إن الطلاقة مش دليل على الصحة",
      "إن إعادة السؤال للنموذج نفسه بتأكد المعلومة",
      "إن النموذج بيختار الكلمة بوزن واحد",
    ],
    correct: 1,
    explanation:
      "الطلاقة مش صحة. التواريخ والأسماء والأرقام تتراجع من مصدر مستقل. سؤال النموذج نفسه تاني مش المراجعة دي.",
  },
];

const LETTERS = ["أ", "ب", "ج", "د"];

export function SampleQuestion() {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const question = QUESTIONS[index];
  const right = revealed && choice === question.correct;

  function choose(i: number) {
    if (revealed) return;
    setChoice(i);
  }

  function check() {
    if (choice === null) return;
    setRevealed(true);
  }

  function next() {
    setIndex((i) => (i + 1) % QUESTIONS.length);
    setChoice(null);
    setRevealed(false);
  }

  return (
    <div className="card px-4 py-4 sm:px-5">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Badge tone="muted">جرّب سؤال من البنك</Badge>
        <Badge tone="muted">تفريق</Badge>
        <span className="tnum text-xs text-ink-3">
          {index + 1} من {QUESTIONS.length}
        </span>
      </div>

      <p className="mb-4 text-sm leading-relaxed text-ink">{question.body}</p>

      <div className="flex flex-col gap-2">
        {question.options.map((option, i) => {
          const picked = choice === i;
          const isRight = revealed && i === question.correct;
          const wrongPick = revealed && picked && !isRight;
          return (
            <button
              key={option}
              type="button"
              onClick={() => choose(i)}
              className={[
                "flex items-start gap-3 rounded-[6px] border-[0.5px] px-3 py-2.5 text-start text-sm leading-relaxed",
                isRight
                  ? "border-ok/30 bg-ok-bg text-ink"
                  : wrongPick
                    ? "border-bad/30 bg-bad-bg text-ink"
                    : picked
                      ? "border-accent-line bg-accent-bg text-ink"
                      : "border-line text-ink hover:border-line-strong",
              ].join(" ")}
            >
              <span className="mt-px shrink-0 font-medium text-ink-3">{LETTERS[i]}</span>
              <span>{option}</span>
            </button>
          );
        })}
      </div>

      {revealed ? (
        <div className="divider mt-4 pt-4">
          <div className="mb-2 flex items-center gap-2">
            {right ? (
              <>
                <Check className="size-4 text-ok" strokeWidth={2} />
                <span className="text-sm font-medium text-ink">إجابة صحيحة</span>
              </>
            ) : (
              <>
                <X className="size-4 text-bad" strokeWidth={2} />
                <span className="text-sm font-medium text-ink">إجابة غير صحيحة</span>
              </>
            )}
          </div>
          {right ? null : (
            <p className="text-sm text-ink">
              <span className="text-ink-3">الصحيح: </span>
              {question.options[question.correct]}
            </p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-ink-2">{question.explanation}</p>
          <button type="button" onClick={next} className="btn btn-primary mt-4 w-full text-sm">
            السؤال اللي بعده
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={check}
          disabled={choice === null}
          className="btn btn-primary mt-4 w-full text-sm"
        >
          تأكيد الإجابة
        </button>
      )}
    </div>
  );
}
