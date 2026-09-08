import type { AnswerResponse } from "@/lib/types";

/**
 * هل هذا السؤال له إجابة في العدّاد؟
 *
 * التوصيل والتصنيف والترتيب يخزَّنون في assign. الشرط يقرأ شكل الإجابة
 * نفسه، لا يعتمد على role الخيارات: لو كل خانة اتملت، السؤال محلول.
 */
export function isQuestionAnswered(
  type: string,
  answer: AnswerResponse,
  imagePath: string | null = null,
): boolean {
  const kind = String(type ?? "").trim();

  if (kind === "essay") {
    const hasText =
      !!answer &&
      typeof answer === "object" &&
      "text" in answer &&
      typeof answer.text === "string" &&
      answer.text.trim().length > 0;
    return hasText || !!imagePath;
  }

  if (!answer || typeof answer !== "object") return false;

  const slots = readAssign(answer);
  if (slots !== null) {
    if (slots.length === 0) return false;
    if (kind === "ordering") {
      return slots.every((v) => typeof v === "number");
    }
    return slots.every((v) => typeof v === "string" && v.length > 0);
  }

  if ("option_ids" in answer && Array.isArray(answer.option_ids)) {
    return answer.option_ids.length > 0;
  }
  if ("value" in answer && typeof answer.value === "boolean") {
    return true;
  }
  if ("blanks" in answer && Array.isArray(answer.blanks)) {
    return answer.blanks.some(
      (b) => typeof b === "string" && b.trim().length > 0,
    );
  }
  return false;
}

function readAssign(answer: object): unknown[] | null {
  if (!("assign" in answer)) return null;
  const value = (answer as { assign: unknown }).assign;
  return Array.isArray(value) ? value : null;
}
