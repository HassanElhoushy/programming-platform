"use client";

import { Fragment } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import type { AnswerResponse, QuestionType } from "@/lib/types";

export interface RunnerQuestion {
  id: string;
  position: number;
  type: QuestionType;
  body: string;
  points: number;
  blank_count: number;
  options: { id: string; body: string; role: "item" | "choice" }[];
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
    case "matching":
      return <Assign question={question} value={value} onChange={onChange} hint="اختر المصطلح المناسب لكل وصف" />;
    case "classification":
      return <Assign question={question} value={value} onChange={onChange} hint="اختر السلّة المناسبة لكل عنصر" />;
    case "ordering":
      return <Ordering question={question} value={value} onChange={onChange} />;
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

/* ==========================================================================
   توصيل وتصنيف وترتيب
   ========================================================================== */

const items = (q: RunnerQuestion) => q.options.filter((o) => o.role === "item");
const choices = (q: RunnerQuestion) => q.options.filter((o) => o.role === "choice");

function currentAssign(value: AnswerResponse, length: number): (string | number | null)[] {
  const stored = value && "assign" in value ? value.assign : [];
  return Array.from({ length }, (_, i) => stored[i] ?? null);
}

/**
 * توصيل وتصنيف: صف لكل عنصر وجنبه قائمة اختيار.
 *
 * لا سحب ولا إفلات عمداً. أغلب الطلبة على الموبايل، والسحب باللمس يتنازع
 * مع تمرير الصفحة — يحاول الطالب سحب عنصر فتتحرك الصفحة تحته والمؤقّت
 * شغّال. والقائمة أقرب إلى ورقة الامتحان نفسها: حرف أمام رقم.
 */
function Assign({
  question,
  value,
  onChange,
  hint,
}: Props & { hint: string }) {
  const rows = items(question);
  const picks = choices(question);
  const assign = currentAssign(value, rows.length);

  function setAt(index: number, choiceId: string) {
    onChange({
      assign: assign.map((v, i) => (i === index ? (choiceId || null) : v)),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-0.5 text-xs text-ink-3">{hint}</p>
      {rows.map((row, i) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center gap-2 rounded-[6px] border-[0.5px] border-line bg-surface px-3 py-2.5"
        >
          <span className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
            {row.body}
          </span>
          <select
            aria-label={`الاختيار للعنصر رقم ${i + 1}`}
            value={typeof assign[i] === "string" ? (assign[i] as string) : ""}
            onChange={(e) => setAt(i, e.target.value)}
            className="input w-36 shrink-0 px-2 py-1.5 text-sm sm:w-44"
          >
            <option value="">— اختر —</option>
            {picks.map((choice, ci) => (
              <option key={choice.id} value={choice.id}>
                {OPTION_LETTERS[ci] ? `${OPTION_LETTERS[ci]}. ` : ""}
                {choice.body}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

/**
 * ترتيب: أسهم فوق وتحت.
 *
 * القائمة المنسدلة بالأرقام تسمح للطالب أن يعطي رقم 2 لعنصرين فيقع في
 * حالة باطلة عليه هو أن يحلّها. الأسهم لا تستطيع إنتاج ترتيب باطل: أي
 * ضغطة تعطي تبديلاً صحيحاً.
 *
 * المخزَّن assign[i] = مكان العنصر i المعروض. فترتيب العرض هو الإجابة،
 * ولا يتغيّر ترتيب الصفوف نفسها إلا بيد الطالب.
 */
function Ordering({ question, value, onChange }: Props) {
  const rows = items(question);

  // ترتيب المعروض حالياً: قائمة فهارس العناصر من الأول إلى الأخير
  const stored = currentAssign(value, rows.length);
  const placed = stored.every((v) => typeof v === "number")
    ? rows
        .map((_, i) => i)
        .sort((a, b) => (stored[a] as number) - (stored[b] as number))
    : rows.map((_, i) => i);

  function move(at: number, delta: number) {
    const to = at + delta;
    if (to < 0 || to >= placed.length) return;

    const next = [...placed];
    next[at] = placed[to];
    next[to] = placed[at];

    // نحوّل الترتيب المعروض إلى "مكان كل عنصر" لأنه شكل المفتاح
    const assign = Array.from({ length: rows.length }, (_, itemIndex) =>
      next.indexOf(itemIndex) + 1,
    );
    onChange({ assign });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-0.5 text-xs text-ink-3">
        رتّب من الأول للأخير بالسهمين
      </p>
      {placed.map((itemIndex, slot) => (
        <div
          key={rows[itemIndex].id}
          className="flex items-center gap-3 rounded-[6px] border-[0.5px] border-line bg-surface px-3 py-2.5"
        >
          <span className="tnum shrink-0 text-sm font-medium text-ink-3">
            {slot + 1}
          </span>
          <span className="min-w-0 flex-1 text-sm leading-relaxed text-ink">
            {rows[itemIndex].body}
          </span>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              aria-label="حرّك لفوق"
              disabled={slot === 0}
              onClick={() => move(slot, -1)}
              className="btn btn-ghost px-2 py-1 disabled:opacity-30"
            >
              <ArrowUp className="size-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              aria-label="حرّك لتحت"
              disabled={slot === placed.length - 1}
              onClick={() => move(slot, 1)}
              className="btn btn-ghost px-2 py-1 disabled:opacity-30"
            >
              <ArrowDown className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
