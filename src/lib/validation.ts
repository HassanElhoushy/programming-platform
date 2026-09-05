import { z } from "zod";

/** أرقام الموبايل المصرية: 11 رقماً تبدأ بـ 010 أو 011 أو 012 أو 015 */
export const PHONE_RE = /^01[0125][0-9]{8}$/;

export const signUpSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, "اكتب اسمك الكامل")
    .max(80, "الاسم طويل أكثر من اللازم"),
  phone: z
    .string()
    .trim()
    .regex(PHONE_RE, "رقم الموبايل غير صحيح. اكتبه 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015"),
  email: z.email("البريد الإلكتروني غير صحيح").trim().toLowerCase(),
  password: z.string().min(8, "كلمة المرور لازم تكون 8 حروف أو أرقام على الأقل"),
});

export const signInSchema = z.object({
  email: z.email("البريد الإلكتروني غير صحيح").trim().toLowerCase(),
  password: z.string().min(1, "اكتب كلمة المرور"),
});

/* ==========================================================================
   صيغة ملف استيراد الأسئلة (JSON)
   ========================================================================== */

const pointsSchema = z
  .number()
  .positive("الدرجة لازم تكون أكبر من صفر")
  .max(1000, "الدرجة كبيرة أكثر من اللازم");

const baseQuestion = {
  body: z.string().trim().min(1, "نص السؤال مطلوب"),
  points: pointsSchema.default(1),
};

const mcqSingle = z.object({
  ...baseQuestion,
  type: z.literal("mcq_single"),
  options: z.array(z.string().trim().min(1)).min(2, "لازم خيارين على الأقل"),
  correct: z
    .number()
    .int("رقم الإجابة الصحيحة لازم يكون عدداً صحيحاً")
    .min(1, "ترقيم الخيارات يبدأ من 1"),
});

const mcqMulti = z.object({
  ...baseQuestion,
  type: z.literal("mcq_multi"),
  options: z.array(z.string().trim().min(1)).min(2, "لازم خيارين على الأقل"),
  correct: z
    .array(z.number().int().min(1))
    .min(1, "اختر إجابة صحيحة واحدة على الأقل"),
});

const trueFalse = z.object({
  ...baseQuestion,
  type: z.literal("true_false"),
  correct: z.boolean(),
});

const fillBlank = z.object({
  ...baseQuestion,
  type: z.literal("fill_blank"),
  // لكل فراغ قائمة إجابات مقبولة. المقارنة تتم بعد تطبيع النص العربي.
  blanks: z
    .array(z.array(z.string().trim().min(1)).min(1, "اكتب إجابة مقبولة واحدة على الأقل"))
    .min(1, "لازم فراغ واحد على الأقل"),
});

const essay = z.object({
  ...baseQuestion,
  type: z.literal("essay"),
  /*
   * الإجابة النموذجية اختيارية، وتُخزَّن في جدول المفاتيح المحمي لا مع نص
   * السؤال، ولا تصل الطالب إلا بعد أن يفتح المدرّس إظهار الإجابات.
   */
  model_answer: z.string().trim().min(1).optional(),
});

const labelList = (min: number, what: string) =>
  z.array(z.string().trim().min(1, `${what} فاضي`)).min(min, `لازم ${min} ${what} على الأقل`);

/*
 * الأنواع الثلاثة سؤال واحد: "لكل عنصر، اختر قيمة". أسماء الحقول تختلف
 * لأن كاتب الملف يفكّر بمفردات سؤاله لا بمفردات المنصة، والمنصة توحّدها
 * داخلياً إلى {"assign": [...]}.
 */
const matching = z.object({
  ...baseQuestion,
  type: z.literal("matching"),
  left: labelList(2, "وصف"),
  right: labelList(2, "مصطلح"),
  // correct[i] = رقم المصطلح المناسب للوصف i، والترقيم يبدأ من 1
  correct: z.array(z.number().int().min(1)).min(2, "لازم إجابتين على الأقل"),
});

const ordering = z.object({
  ...baseQuestion,
  type: z.literal("ordering"),
  steps: labelList(2, "خطوة"),
  // correct[i] = مكان الخطوة i في الترتيب الصحيح
  correct: z.array(z.number().int().min(1)).min(2, "لازم خطوتين على الأقل"),
});

const classification = z.object({
  ...baseQuestion,
  type: z.literal("classification"),
  buckets: labelList(2, "سلّة"),
  items: labelList(2, "عنصر"),
  // correct[i] = رقم سلّة العنصر i، والتكرار مسموح هنا وحده
  correct: z.array(z.number().int().min(1)).min(2, "لازم إجابتين على الأقل"),
});

export const importQuestionSchema = z.discriminatedUnion("type", [
  mcqSingle,
  mcqMulti,
  trueFalse,
  fillBlank,
  essay,
  matching,
  ordering,
  classification,
]);

export const importFileSchema = z.object({
  questions: z
    .array(importQuestionSchema)
    .min(1, "الملف لا يحتوي على أي سؤال"),
});

export type ImportQuestion = z.infer<typeof importQuestionSchema>;
export type ImportFile = z.infer<typeof importFileSchema>;

/**
 * تحقّق إضافي لا يستطيع الـ schema وحده التعبير عنه: أرقام الإجابات الصحيحة
 * لازم تكون داخل نطاق الخيارات، وعدد الفراغات في النص لازم يطابق المفتاح.
 * يعيد رسائل عربية مرقّمة بالسؤال ليعرف المدرّس أين الخطأ بالضبط.
 */
export function validateImport(file: ImportFile): string[] {
  const errors: string[] = [];

  file.questions.forEach((q, i) => {
    const n = i + 1;

    if (q.type === "mcq_single") {
      if (q.correct > q.options.length) {
        errors.push(
          `السؤال ${n}: رقم الإجابة الصحيحة ${q.correct} خارج نطاق الخيارات (عددها ${q.options.length})`,
        );
      }
    }

    if (q.type === "mcq_multi") {
      const outOfRange = q.correct.filter((c) => c > q.options.length);
      if (outOfRange.length > 0) {
        errors.push(
          `السؤال ${n}: أرقام إجابات صحيحة خارج نطاق الخيارات: ${outOfRange.join("، ")}`,
        );
      }
      if (new Set(q.correct).size !== q.correct.length) {
        errors.push(`السؤال ${n}: رقم إجابة صحيحة مكرر`);
      }
    }

    /*
     * الأنواع الثلاثة: طول المفتاح لازم يطابق عدد العناصر، وكل رقم داخل
     * نطاق الاختيارات. التكرار مسموح في التصنيف وحده — سلّة واحدة تأخذ
     * عدة عناصر — وممنوع في التوصيل والترتيب لأن المصطلح يُستعمل مرة
     * والمكان لا يُشغَل مرتين.
     */
    if (q.type === "matching" || q.type === "ordering" || q.type === "classification") {
      const items =
        q.type === "matching" ? q.left : q.type === "ordering" ? q.steps : q.items;
      const choices =
        q.type === "matching" ? q.right : q.type === "ordering" ? q.steps : q.buckets;
      const itemWord =
        q.type === "matching" ? "وصف" : q.type === "ordering" ? "خطوة" : "عنصر";
      const choiceWord =
        q.type === "matching" ? "مصطلح" : q.type === "ordering" ? "مكان" : "سلّة";

      if (q.correct.length !== items.length) {
        errors.push(
          `السؤال ${n}: عدد الإجابات ${q.correct.length} مش مطابق لعدد الـ${itemWord} ${items.length}`,
        );
      }

      const outOfRange = q.correct.filter((c) => c > choices.length);
      if (outOfRange.length > 0) {
        errors.push(
          `السؤال ${n}: أرقام خارج نطاق الـ${choiceWord} (عددها ${choices.length}): ${outOfRange.join("، ")}`,
        );
      }

      if (q.type !== "classification" && new Set(q.correct).size !== q.correct.length) {
        errors.push(
          `السؤال ${n}: رقم ${choiceWord} مكرر. كل ${choiceWord} يُستعمل مرة واحدة في ${
            q.type === "matching" ? "التوصيل" : "الترتيب"
          }.`,
        );
      }

      if (q.type === "matching" && q.right.length < q.left.length) {
        errors.push(
          `السؤال ${n}: المصطلحات (${q.right.length}) أقل من الأوصاف (${q.left.length})، فمفيش مصطلح لكل وصف`,
        );
      }

      if (q.type === "ordering" && q.correct.length === q.steps.length) {
        // الترتيب لازم يكون تبديلاً كاملاً 1..N: كل مكان مشغول مرة واحدة
        const sorted = [...q.correct].sort((a, b) => a - b);
        if (sorted.some((v, i) => v !== i + 1)) {
          errors.push(
            `السؤال ${n}: الترتيب لازم يستعمل الأرقام من 1 لـ ${q.steps.length} كلها مرة واحدة. الموجود: ${q.correct.join("، ")}`,
          );
        }
      }
    }

    if (q.type === "fill_blank") {
      const markers = blankMarkerNumbers(q.body);

      if (markers.length !== q.blanks.length) {
        errors.push(
          `السؤال ${n}: النص فيه ${markers.length} فراغاً بينما المفتاح فيه ${q.blanks.length}. استخدم [1] و [2] لتحديد الفراغات في نص السؤال.`,
        );
      } else {
        /*
         * الترقيم لازم يكون 1..N بالترتيب بلا قفزات. الواجهة تستعمل رقم
         * العلامة فهرساً في مصفوفة إجابات الطالب، فعلامة [3] في سؤال بفراغين
         * تكتب خارج المصفوفة: يكتب الطالب إجابته ولا تُحفظ، ولا يظهر خطأ.
         */
        const expected = Array.from({ length: q.blanks.length }, (_, i) => i + 1);
        if (markers.some((m, i) => m !== expected[i])) {
          errors.push(
            `السؤال ${n}: ترقيم الفراغات لازم يبدأ من [1] ويتسلسل بلا قفزات. الموجود: ${markers
              .map((m) => `[${m}]`)
              .join(" ")}`,
          );
        }
      }
    }
  });

  return errors;
}

/** أرقام علامات الفراغات [1] [2] [3] الموجودة في النص، مرتبةً وبلا تكرار */
export function blankMarkerNumbers(body: string): number[] {
  const matches = body.match(/\[\d+\]/g) ?? [];
  const numbers = matches.map((m) => Number(m.slice(1, -1)));
  return [...new Set(numbers)].sort((a, b) => a - b);
}

/** عدد الفراغات المميزة في نص السؤال */
export function countBlankMarkers(body: string): number {
  return blankMarkerNumbers(body).length;
}
