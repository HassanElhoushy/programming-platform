import type { ImportQuestion } from "@/lib/validation";

/**
 * تحويل سؤال من صيغة ملف الاستيراد إلى صفوف قاعدة البيانات.
 *
 * كاتب الملف يكتب سؤاله بترتيبه الطبيعي: خطوات مرتّبة، ومصطلحات أمام
 * أوصافها. لو خُزّن ذلك كما هو لانكشفت الإجابة، لأن صفحة الحل ترسل
 * question_options.position إلى المتصفح — فيقرأ الطالب الترتيب الصحيح من
 * طلبات الشبكة بلا أي حيلة.
 *
 * فالبعثرة هنا: وقت التخزين مرة واحدة، لا وقت العرض. بعثرةُ العرض تترك
 * الترتيب المخزَّن كما هو وهو الذي يصل المتصفح.
 *
 * والمفتاح يُبنى بعد البعثرة ليصف الحالة المخزَّنة، ويشير إلى الاختيارات
 * بمعرّفاتها (uuid) لا بأرقامها — نفس منطق الاختيار من متعدد، فلا يدل
 * ترتيب العرض على شيء.
 */

export type OptionRole = "item" | "choice";

export interface PlannedOption {
  position: number;
  body: string;
  role: OptionRole;
}

export interface QuestionPlan {
  options: PlannedOption[];
  /** يُستدعى بعد إدراج الخيارات ومعرفة معرّفاتها */
  buildKey: (idAtPosition: (position: number) => string | undefined) => unknown;
  blankCount: number;
}

/** خلط يحتفظ بموضع كل عنصر الأصلي، فنعرف بعده أي عنصر ذهب أين */
function shuffle<T>(items: T[]): { value: T; from: number }[] {
  const mixed = items.map((value, from) => ({ value, from }));
  for (let i = mixed.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = mixed[i];
    mixed[i] = mixed[j];
    mixed[j] = swap;
  }
  return mixed;
}

const clean = (s: string) => s.trim();

export function planQuestion(question: ImportQuestion): QuestionPlan {
  switch (question.type) {
    case "mcq_single":
    case "mcq_multi": {
      const correct =
        question.type === "mcq_single" ? [question.correct] : question.correct;

      return {
        options: question.options.map((body, i) => ({
          position: i + 1,
          body: clean(body),
          role: "choice",
        })),
        buildKey: (idAt) => ({ option_ids: correct.map((c) => idAt(c)) }),
        blankCount: 0,
      };
    }

    case "true_false":
      return {
        options: [],
        buildKey: () => ({ value: question.correct }),
        blankCount: 0,
      };

    case "fill_blank":
      return {
        options: [],
        buildKey: () => ({ blanks: question.blanks }),
        blankCount: question.blanks.length,
      };

    case "essay":
      return { options: [], buildKey: () => null, blankCount: 0 };

    /*
     * توصيل: الأوصاف تبقى بترتيب الكاتب لأنها نص يُقرأ، والمصطلحات تُبعثر
     * لأن ترتيبها هو الإجابة. المفتاح يشير إلى المصطلح بمعرّفه.
     */
    case "matching": {
      const itemCount = question.left.length;
      const mixed = shuffle(question.right);

      const positionOfChoice = new Map<number, number>();
      mixed.forEach((entry, i) => {
        positionOfChoice.set(entry.from + 1, itemCount + i + 1);
      });

      return {
        options: [
          ...question.left.map((body, i) => ({
            position: i + 1,
            body: clean(body),
            role: "item" as const,
          })),
          ...mixed.map((entry, i) => ({
            position: itemCount + i + 1,
            body: clean(entry.value),
            role: "choice" as const,
          })),
        ],
        buildKey: (idAt) => ({
          assign: question.correct.map((c) => idAt(positionOfChoice.get(c) ?? -1)),
        }),
        blankCount: 0,
      };
    }

    /*
     * ترتيب: الخطوات نفسها هي الإجابة، فتُبعثر. لا اختيارات — الطالب يحرّك
     * الخطوة لا يختار لها قيمة، والمفتاح أرقام المواضع.
     */
    case "ordering": {
      const mixed = shuffle(question.steps);

      return {
        options: mixed.map((entry, i) => ({
          position: i + 1,
          body: clean(entry.value),
          role: "item" as const,
        })),
        buildKey: () => ({
          assign: mixed.map((entry) => question.correct[entry.from]),
        }),
        blankCount: 0,
      };
    }

    /*
     * تصنيف: السلال أسماء ثابتة تبقى بترتيب الكاتب، والعناصر تُبعثر — لأن
     * الكاتب يكتبها عادةً مجمّعة حسب سلّتها، فيخمّن الطالب من التجاور.
     */
    case "classification": {
      const itemCount = question.items.length;
      const mixed = shuffle(question.items);

      return {
        options: [
          ...mixed.map((entry, i) => ({
            position: i + 1,
            body: clean(entry.value),
            role: "item" as const,
          })),
          ...question.buckets.map((body, i) => ({
            position: itemCount + i + 1,
            body: clean(body),
            role: "choice" as const,
          })),
        ],
        buildKey: (idAt) => ({
          assign: mixed.map((entry) =>
            idAt(itemCount + question.correct[entry.from]),
          ),
        }),
        blankCount: 0,
      };
    }
  }
}
