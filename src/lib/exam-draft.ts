import type { AnswerResponse } from "@/lib/types";

/**
 * مسودة محلية لإجابات محاولة جارية.
 *
 * لماذا وُجدت: طالبة كانت تكتب سؤالاً مقالياً فانقطعت الكهرباء. الراوتر
 * يموت قبل الجهاز، فبقيت تكتب دقائق والشبكة مقطوعة، ثم مات التبويب.
 * إجاباتها الاختيارية كانت محفوظة من قبل — لأن الاختياري يحتاج نجاح حفظ
 * واحداً في عمره كله، والمقالي يحتاج نجاح حفظ في اللحظة الأخيرة، إذ تُكتب
 * قيمته فوق نفسها كل ثانية.
 *
 * localStorage يكتب على القرص فوراً ولا يحتاج شبكة، فهو الطبقة الوحيدة
 * التي تنجو من هذا. وهو نسخة احتياطية لا مصدر حقيقة: مصدر الحقيقة
 * الخادم، ولا تُستعمل المسودة إلا بطلب الطالب صراحةً.
 */

const PREFIX = "exam-draft:";

export interface ExamDraft {
  answers: Record<string, AnswerResponse>;
  images: Record<string, string | null>;
  savedAt: number;
}

function keyFor(attemptId: string) {
  return `${PREFIX}${attemptId}`;
}

/*
 * كل وصول إلى localStorage داخل try: المتصفح في وضع التصفّح الخاص يرمي
 * عند الكتابة، وبعض الإعدادات ترمي عند القراءة نفسها. فشل المسودة يجب ألا
 * يُسقط صفحة الامتحان.
 */
export function saveDraft(
  attemptId: string,
  answers: Record<string, AnswerResponse>,
  images: Record<string, string | null>,
): void {
  try {
    const draft: ExamDraft = { answers, images, savedAt: Date.now() };
    window.localStorage.setItem(keyFor(attemptId), JSON.stringify(draft));
  } catch {
    // لا شيء: المسودة رفاهية، والحفظ على الخادم هو الأصل
  }
}

export function readDraft(attemptId: string): ExamDraft | null {
  try {
    const raw = window.localStorage.getItem(keyFor(attemptId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      !("answers" in parsed) ||
      !("images" in parsed)
    ) {
      return null;
    }
    return parsed as ExamDraft;
  } catch {
    return null;
  }
}

export function clearDraft(attemptId: string): void {
  try {
    window.localStorage.removeItem(keyFor(attemptId));
  } catch {
    // تجاهَل
  }
}

/** نص الإجابة المقالية إن كانت مقالية، وإلا فسلسلة فارغة */
function essayText(value: AnswerResponse): string {
  return value && "text" in value ? value.text.trim() : "";
}

/**
 * كم سؤالاً في المسودة يحمل شيئاً لا يحمله ما جاء من الخادم؟
 *
 * لا نعرض على الطالب استرجاعاً إلا إذا كان في المسودة ما يكسب فعلاً.
 * والمقارنة على النص المقالي وحده عمداً: هو الشيء القابل للضياع، أما
 * الاختياري فنقرة واحدة تُحفظ من أول مرة، ولو اختلف عن الخادم فالأرجح أن
 * الطالب غيّر رأيه بعدها لا أن الحفظ ضاع.
 */
export function draftGain(
  draft: ExamDraft,
  serverAnswers: Record<string, AnswerResponse>,
): string[] {
  const gained: string[] = [];

  for (const [questionId, value] of Object.entries(draft.answers)) {
    const local = essayText(value);
    if (local === "") continue;

    const server = essayText(serverAnswers[questionId] ?? null);
    if (local !== server && local.length > server.length) {
      gained.push(questionId);
    }
  }

  return gained;
}
