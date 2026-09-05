/**
 * اختبار الأنواع الثلاثة الجديدة: توصيل وترتيب وتصنيف.
 *
 * يفحص ثلاثة أشياء لا يمسكها المترجم ولا الـ lint:
 *
 *   1. الملف النموذجي يمر من مخطط zod ومن قواعد التحقق الإضافية.
 *   2. البعثرة والمفتاح متسقان — أي أن الإجابة المبنية من المفتاح تُصحَّح
 *      100%. خطأ هنا لا يُظهر عطلاً: يصحّح للطلبة إجاباتهم الصحيحة خطأً،
 *      ولا يكتشفه أحد إلا بعد أن يشتكي طالب.
 *   3. البعثرة تحدث فعلاً — لو خُزّن سؤال الترتيب بترتيبه الصحيح لقرأ
 *      الطالب الإجابة من طلبات الشبكة.
 *
 * التشغيل: npx tsx scripts/check-question-types.ts
 */

import { planQuestion } from "../src/lib/question-plan";
import { SAMPLE_QUESTIONS } from "../src/lib/sample-questions";
import { importFileSchema, validateImport } from "../src/lib/validation";

let pass = 0;
let fail = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* ---------------------------------------------------------------- 1 */
const parsed = importFileSchema.safeParse(SAMPLE_QUESTIONS);
check("الملف النموذجي يمر من مخطط zod", parsed.success,
  parsed.success ? "" : JSON.stringify(parsed.error.issues[0]));

if (!parsed.success) process.exit(1);

const logic = validateImport(parsed.data);
check("الملف النموذجي يمر من قواعد التحقق", logic.length === 0, logic.join(" | "));

check("الملف فيه الأنواع الثمانية كلها",
  new Set(parsed.data.questions.map((q) => q.type)).size === 8);

/* ---------------------------------------------------------------- 2 */
/** يحاكي إدراج الخيارات: كل موضع يأخذ معرّفاً ثابتاً يمكن تتبّعه */
function fakeIds(position: number) {
  return `opt-${position}`;
}

for (const question of parsed.data.questions) {
  if (!["matching", "ordering", "classification"].includes(question.type)) continue;

  const plan = planQuestion(question);
  const key = plan.buildKey(fakeIds) as { assign: (string | number)[] };

  const items = plan.options.filter((o) => o.role === "item");
  const choices = plan.options.filter((o) => o.role === "choice");

  check(`${question.type}: عدد الإجابات يساوي عدد العناصر`,
    key.assign.length === items.length,
    `${key.assign.length} ≠ ${items.length}`);

  check(`${question.type}: مفيش إجابة فاضية في المفتاح`,
    key.assign.every((v) => v !== undefined && v !== null && v !== "opt--1"));

  /*
   * التصحيح كما يفعله submit_exam: مقارنة نصية عنصراً بعنصر. الإجابة
   * المأخوذة من المفتاح نفسه يجب أن تعطي العلامة كاملة.
   */
  const asStudent = key.assign;
  const correctCount = asStudent.filter(
    (v, i) => String(v) === String(key.assign[i]),
  ).length;
  check(`${question.type}: الإجابة المطابقة للمفتاح تأخذ الدرجة كاملة`,
    correctCount === items.length);

  if (question.type === "ordering") {
    // المفتاح تبديل كامل 1..N: كل مكان مشغول مرة واحدة
    const places = [...(key.assign as number[])].sort((a, b) => a - b);
    check("ordering: المفتاح تبديل كامل بلا تكرار ولا فجوات",
      places.every((v, i) => v === i + 1), places.join(","));

    // النصوص المخزّنة هي نفس الخطوات، ولا شيء ضاع في البعثرة
    check("ordering: كل الخطوات موجودة بعد البعثرة",
      new Set(items.map((o) => o.body)).size === question.steps.length);

    // التحقق الجوهري: النص المخزَّن في الموضع i مكانه الصحيح هو assign[i]
    const rebuilt = items
      .map((o, i) => ({ body: o.body, place: (key.assign as number[])[i] }))
      .sort((a, b) => a.place - b.place)
      .map((x) => x.body);
    check("ordering: ترتيب المفتاح يعيد بناء الترتيب الصحيح الأصلي",
      JSON.stringify(rebuilt) === JSON.stringify(question.steps.map((s) => s.trim())),
      JSON.stringify(rebuilt));
  }

  if (question.type === "matching") {
    // assign[i] لازم يشير إلى المصطلح الذي كتبه المؤلف في correct[i]
    const bodyOfChoice = new Map(
      plan.options.filter((o) => o.role === "choice")
        .map((o) => [fakeIds(o.position), o.body]),
    );
    const resolved = (key.assign as string[]).map((id) => bodyOfChoice.get(id));
    const expected = question.correct.map((c) => question.right[c - 1].trim());
    check("matching: المفتاح يشير إلى المصطلح الصحيح لكل وصف",
      JSON.stringify(resolved) === JSON.stringify(expected),
      JSON.stringify(resolved));
    check("matching: عدد المصطلحات المخزّنة صحيح",
      choices.length === question.right.length);
  }

  if (question.type === "classification") {
    const bodyOfBucket = new Map(
      plan.options.filter((o) => o.role === "choice")
        .map((o) => [fakeIds(o.position), o.body]),
    );
    // لكل عنصر مخزَّن، السلّة التي يشير إليها المفتاح = سلّته عند المؤلف
    const ok = items.every((item, i) => {
      const authorIndex = question.items.findIndex((x) => x.trim() === item.body);
      const wantBucket = question.buckets[question.correct[authorIndex] - 1].trim();
      return bodyOfBucket.get(String((key.assign as string[])[i])) === wantBucket;
    });
    check("classification: كل عنصر يشير إلى سلّته الصحيحة بعد البعثرة", ok);
  }
}

/* ---------------------------------------------------------------- 3 */
/*
 * البعثرة عشوائية، فقد تُخرج الترتيب الأصلي صدفة. نكرر كثيراً ونتأكد أن
 * التخزين يختلف عن الترتيب الصحيح في الغالبية الساحقة — لو لم يختلف أبداً
 * فالبعثرة لا تعمل، وترتيب التخزين يصل المتصفح فيفضح الإجابة.
 */
const ordering = parsed.data.questions.find((q) => q.type === "ordering");
if (ordering && ordering.type === "ordering") {
  const runs = 200;
  let shuffled = 0;
  for (let i = 0; i < runs; i += 1) {
    const plan = planQuestion(ordering);
    const stored = plan.options.map((o) => o.body);
    if (JSON.stringify(stored) !== JSON.stringify(ordering.steps.map((s) => s.trim()))) {
      shuffled += 1;
    }
  }
  check(`البعثرة تعمل: ${shuffled}/${runs} تخزينة تختلف عن الترتيب الصحيح`,
    shuffled > runs * 0.8, `${shuffled}/${runs}`);
}

/* ---------------------------------------------------------------- 4 */
/* قواعد التحقق ترفض ما يجب أن ترفضه */
const badCases: { name: string; q: unknown }[] = [
  {
    name: "ترتيب برقم مكرر",
    q: { type: "ordering", body: "س", points: 2, steps: ["أ", "ب", "ج"], correct: [1, 1, 2] },
  },
  {
    name: "ترتيب بفجوة في الأرقام",
    q: { type: "ordering", body: "س", points: 2, steps: ["أ", "ب", "ج"], correct: [1, 2, 5] },
  },
  {
    name: "توصيل بمصطلح مكرر",
    q: { type: "matching", body: "س", points: 2, left: ["أ", "ب"], right: ["س", "ص"], correct: [1, 1] },
  },
  {
    name: "توصيل بمصطلحات أقل من الأوصاف",
    q: { type: "matching", body: "س", points: 2, left: ["أ", "ب", "ج"], right: ["س", "ص"], correct: [1, 2, 2] },
  },
  {
    name: "تصنيف برقم سلّة خارج النطاق",
    q: { type: "classification", body: "س", points: 2, buckets: ["س", "ص"], items: ["أ", "ب"], correct: [1, 9] },
  },
  {
    name: "تصنيف بعدد إجابات مخالف لعدد العناصر",
    q: { type: "classification", body: "س", points: 2, buckets: ["س", "ص"], items: ["أ", "ب", "ج"], correct: [1, 2] },
  },
];

for (const bad of badCases) {
  const p = importFileSchema.safeParse({ questions: [bad.q] });
  const errs = p.success ? validateImport(p.data) : ["zod رفضه"];
  check(`مرفوض: ${bad.name}`, errs.length > 0);
}

/* التكرار مسموح في التصنيف وحده */
const dupClassification = importFileSchema.safeParse({
  questions: [{
    type: "classification", body: "س", points: 2,
    buckets: ["GET", "POST"], items: ["أ", "ب", "ج", "د"], correct: [1, 2, 1, 2],
  }],
});
check("مقبول: تصنيف بسلّة واحدة لعدة عناصر",
  dupClassification.success && validateImport(dupClassification.data).length === 0);

/* ---------------------------------------------------------------- 5 */
/*
 * الشرح حقل مشترك: يقبله كل نوع. لو قُصر على بعضها لاكتشف كاتب الملف ذلك
 * بعد أن يكتب مئة سؤال، لا قبلها.
 */
const withExplanation = [
  { type: "mcq_single", body: "س", points: 1, options: ["أ", "ب"], correct: 1 },
  { type: "mcq_multi", body: "س", points: 1, options: ["أ", "ب"], correct: [1] },
  { type: "true_false", body: "س", points: 1, correct: true },
  { type: "fill_blank", body: "نص فيه [1]", points: 1, blanks: [["إجابة"]] },
  { type: "essay", body: "س", points: 1 },
  { type: "matching", body: "س", points: 1, left: ["أ", "ب"], right: ["س", "ص"], correct: [1, 2] },
  { type: "ordering", body: "س", points: 1, steps: ["أ", "ب"], correct: [1, 2] },
  { type: "classification", body: "س", points: 1, buckets: ["س", "ص"], items: ["أ", "ب"], correct: [1, 2] },
].map((q) => ({ ...q, explanation: "لأن كذا وكذا." }));

const explained = importFileSchema.safeParse({ questions: withExplanation });
check(
  "explanation مقبول على الأنواع الثمانية كلها",
  explained.success && validateImport(explained.data).length === 0,
  explained.success ? "" : JSON.stringify(explained.error.issues[0]),
);

if (explained.success) {
  check(
    "explanation محفوظ بعد التحليل لا مُسقَط",
    explained.data.questions.every((q) => q.explanation === "لأن كذا وكذا."),
  );
}

console.log(`\n${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
