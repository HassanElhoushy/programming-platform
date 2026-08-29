"use client";

import { Fragment } from "react";

import type { AnswerResponse, QuestionType } from "@/lib/types";

export interface RunnerQuestion {
  id: string;
  position: number;
  type: QuestionType;
  body: string;
  points: number;
  blank_count: number;
  options: { id: string; body: string }[];
}

interface Props {
  question: RunnerQuestion;
  value: AnswerResponse;
  onChange: (value: AnswerResponse) => void;
}

/* الأحرف المستخدمة في ترقيم الخيارات، بترتيب أبجدي عربي مألوف للطالب */
const OPTION_LETTERS = ["أ", "ب", "ج", "د", "هـ", "و", "ز", "ح"];

export function QuestionInput({ question, value, onChange }: Props) {
  switch (question.type) {
    case "mcq_single":
      return <SingleChoice question={question} value={value} onChange={onChange} />;
    case "mcq_multi":
      return <MultiChoice question={question} value={value} onChange={onChange} />;
    case "true_false":
      return <TrueFalse question={question} value={value} onChange={onChange} />;
    case "fill_blank":
      return <FillBlank question={question} value={value} onChange={onChange} />;
    default:
      return null;
  }
}

function optionRowClass(selected: boolean) {
  return [
    "flex cursor-pointer items-start gap-3 rounded-[6px] border-[0.5px] px-3 py-2.5 transition-colors",
    selected
      ? "border-accent-line bg-accent-bg"
      : "border-line bg-surface hover:border-line-strong",
  ].join(" ");
}

function SingleChoice({ question, value, onChange }: Props) {
  const selected =
    value && "option_ids" in value ? (value.option_ids[0] ?? null) : null;

  return (
    <div className="flex flex-col gap-2">
      {question.options.map((option, i) => (
        <label key={option.id} className={optionRowClass(selected === option.id)}>
          <input
            type="radio"
            name={`q-${question.id}`}
            className="sr-only"
            checked={selected === option.id}
            onChange={() => onChange({ option_ids: [option.id] })}
          />
          <span className="mt-px shrink-0 text-sm font-medium text-ink-3">
            {OPTION_LETTERS[i] ?? i + 1}
          </span>
          <span className="text-sm leading-relaxed text-ink">{option.body}</span>
        </label>
      ))}
    </div>
  );
}

function MultiChoice({ question, value, onChange }: Props) {
  const selected = value && "option_ids" in value ? value.option_ids : [];

  function toggle(id: string) {
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onChange({ option_ids: next });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-0.5 text-xs text-ink-3">اختر كل الإجابات الصحيحة</p>
      {question.options.map((option, i) => (
        <label key={option.id} className={optionRowClass(selected.includes(option.id))}>
          <input
            type="checkbox"
            className="sr-only"
            checked={selected.includes(option.id)}
            onChange={() => toggle(option.id)}
          />
          <span className="mt-px shrink-0 text-sm font-medium text-ink-3">
            {OPTION_LETTERS[i] ?? i + 1}
          </span>
          <span className="text-sm leading-relaxed text-ink">{option.body}</span>
        </label>
      ))}
    </div>
  );
}

function TrueFalse({ question, value, onChange }: Props) {
  const current = value && "value" in value ? value.value : null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { label: "صح", val: true },
        { label: "خطأ", val: false },
      ].map((choice) => (
        <label
          key={choice.label}
          className={`${optionRowClass(current === choice.val)} justify-center`}
        >
          <input
            type="radio"
            name={`q-${question.id}`}
            className="sr-only"
            checked={current === choice.val}
            onChange={() => onChange({ value: choice.val })}
          />
          <span className="text-sm font-medium text-ink">{choice.label}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * الفراغات مكتوبة في نص السؤال بالصيغة [1] و [2]، فنقسم النص عليها ونضع
 * حقل الإدخال في موضعه من الجملة بدل قائمة منفصلة تحت السؤال.
 */
function FillBlank({ question, value, onChange }: Props) {
  const blanks = value && "blanks" in value ? value.blanks : [];
  const parts = question.body.split(/(\[\d+\])/g);

  function setBlank(index: number, text: string) {
    const next = Array.from({ length: question.blank_count }, (_, i) =>
      i === index ? text : (blanks[i] ?? ""),
    );
    onChange({ blanks: next });
  }

  return (
    <p className="text-sm leading-[2.4] text-ink">
      {parts.map((part, i) => {
        const marker = part.match(/^\[(\d+)\]$/);
        if (!marker) return <Fragment key={i}>{part}</Fragment>;

        const index = Number(marker[1]) - 1;
        return (
          <input
            key={i}
            type="text"
            aria-label={`الفراغ رقم ${index + 1}`}
            value={blanks[index] ?? ""}
            onChange={(e) => setBlank(index, e.target.value)}
            className="input mx-1 inline-block w-32 px-2 py-1 align-middle text-sm sm:w-40"
          />
        );
      })}
    </p>
  );
}
