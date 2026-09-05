/**
 * يتحقق أن كل مثال JSON في صفحة "صيغة ملف الأسئلة" يمر فعلاً من المستورد.
 *
 * الصفحة تَعِد القارئ بأن ما فيها مطابق لما يفحصه المستورد. الوعد هذا لا
 * قيمة له ما لم يُختبر: مثال خاطئ في مرجعٍ يُنسخ منه أسوأ من لا مرجع.
 *
 * التشغيل: npx tsx scripts/check-spec-page.ts <path-to-html>
 */

import { readFileSync } from "node:fs";

import { importFileSchema, validateImport } from "../src/lib/validation";

const html = readFileSync(process.argv[2], "utf8");

const blocks = [...html.matchAll(/<pre>(\{[\s\S]*?)<\/pre>/g)]
  .map((m) => m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"))
  .filter((text) => !text.includes("..."));

let pass = 0;
let fail = 0;

blocks.forEach((text, i) => {
  const raw: unknown = JSON.parse(text);
  // بعض الكتل سؤال مفرد وبعضها ملف كامل — نغلّف المفرد لنمرّر الاثنين
  const file =
    raw !== null && typeof raw === "object" && "questions" in raw
      ? raw
      : { questions: [raw] };

  const parsed = importFileSchema.safeParse(file);
  if (!parsed.success) {
    fail += 1;
    console.log(`FAIL  كتلة ${i + 1}: ${JSON.stringify(parsed.error.issues[0])}`);
    return;
  }

  const errors = validateImport(parsed.data);
  if (errors.length > 0) {
    fail += 1;
    console.log(`FAIL  كتلة ${i + 1}: ${errors.join(" | ")}`);
    return;
  }

  pass += 1;
  const types = parsed.data.questions.map((q) => q.type).join("، ");
  console.log(`PASS  كتلة ${i + 1} — ${types}`);
});

/* الوعد الثاني في الصفحة: أنها تغطي الأنواع الثمانية كلها */
const all = new Set<string>();
for (const text of blocks) {
  for (const m of text.matchAll(/"type"\s*:\s*"(\w+)"/g)) all.add(m[1]);
}
const expected = [
  "mcq_single", "mcq_multi", "true_false", "fill_blank",
  "essay", "matching", "ordering", "classification",
];
const missing = expected.filter((t) => !all.has(t));
if (missing.length === 0) {
  pass += 1;
  console.log("PASS  الصفحة تغطي الأنواع الثمانية");
} else {
  fail += 1;
  console.log(`FAIL  أنواع غائبة عن الصفحة: ${missing.join("، ")}`);
}

console.log(`\n${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
