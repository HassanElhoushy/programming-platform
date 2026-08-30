/**
 * يشغّل كل استعلام Supabase مكتوب في الكود على المشروع الحقيقي، ويبلّغ عمّا
 * يرد بخطأ.
 *
 * السبب: استعلام فاشل في مكوّن خادم يعود بـ data = null، وأغلب الصفحات
 * تكتب `data ?? []`، فيظهر الخطأ كقائمة فارغة — أي "مفيش حاجة محتاجة تصحيح"
 * بينما هناك تسليم فعلاً. الفئة الأخطر من هذه الأخطاء هي embed غامض
 * (PGRST201) على جدول مرتبط بجدول آخر بأكثر من مفتاح أجنبي.
 *
 * التشغيل:  node scripts/check-queries.mjs
 * يحتاج SUPABASE_SECRET_KEY في .env.local — ولذلك لا يعمل إلا محلياً.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);

const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;

if (!BASE || !KEY) {
  console.error("ناقص NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SECRET_KEY في .env.local");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx?$/.test(path)) out.push(path);
  }
  return out;
}

/* يلتقط ‎.from("table") متبوعاً بـ ‎.select("...") ولو كانا على أسطر متفرقة */
const PATTERN = /\.from\(\s*"(\w+)"\s*\)\s*\.select\(\s*"([^"]*)"/g;

const queries = [];
for (const file of walk("src")) {
  const source = readFileSync(file, "utf8").replace(/\s*\n\s*/g, " ");
  let match;
  while ((match = PATTERN.exec(source))) {
    const [, table, select] = match;
    if (!select.trim() || select.includes("${")) continue;
    queries.push({ file: file.replace(/\\/g, "/"), table, select: select.trim() });
  }
}

console.log(`استعلامات وُجدت في الكود: ${queries.length}\n`);

let failures = 0;

for (const q of queries) {
  const url = `${BASE}/rest/v1/${q.table}?select=${encodeURIComponent(q.select)}&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });

  if (res.ok) continue;

  const body = await res.json().catch(() => ({}));
  failures++;
  console.log(`✘ ${q.file}`);
  console.log(`   ${q.table} :: ${q.select.slice(0, 100)}${q.select.length > 100 ? "…" : ""}`);
  console.log(`   HTTP ${res.status} ${body.code ?? ""} — ${(body.message ?? "").slice(0, 140)}`);
  if (body.hint) console.log(`   ${String(body.hint).slice(0, 160)}`);
  console.log("");
}

console.log(
  failures === 0
    ? "كل الاستعلامات ترد بنجاح."
    : `استعلامات فاشلة: ${failures} — كل واحد منها يظهر للمستخدم كقائمة فارغة.`,
);

process.exitCode = failures ? 1 : 0;
