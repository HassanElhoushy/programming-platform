/**
 * فحص ثابت لملفات SQL قبل تنفيذها على Supabase.
 *
 * ليس بديلاً عن التنفيذ، لكنه يمسك أكثر الأخطاء شيوعاً وأغلاها وقتاً:
 * اسم جدول أو عمود أو دالة مكتوب خطأ، أو اقتباس $$ غير مغلق، أو قيمة enum
 * غير معرّفة، أو دالة تُمنح صلاحية تنفيذ وهي غير موجودة.
 *
 * التشغيل:  node supabase/check-sql.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SQL_DIR = join(dirname(fileURLToPath(import.meta.url)), "sql");

const files = readdirSync(SQL_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sources = new Map(
  files.map((f) => [f, readFileSync(join(SQL_DIR, f), "utf8")]),
);

const problems = [];
const fail = (file, message) => problems.push(`${file}: ${message}`);

/** يزيل التعليقات حتى لا تُقرأ أسماء من داخل الشرح العربي */
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => {
      // لا نقص داخل نص مقتبس بعلامة واحدة
      let out = "";
      let inString = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === "'") inString = !inString;
        if (!inString && c === "-" && line[i + 1] === "-") break;
        out += c;
      }
      return out;
    })
    .join("\n");
}

const clean = new Map([...sources].map(([f, s]) => [f, stripComments(s)]));
const allSql = [...clean.values()].join("\n");

/* ------------------------------------------------------------------ */
/* 1. توازن اقتباس الدولار                                             */
/* ------------------------------------------------------------------ */
for (const [file, sql] of clean) {
  const count = (sql.match(/\$\$/g) ?? []).length;
  if (count % 2 !== 0) {
    fail(file, `عدد علامات $$ فردي (${count}) — فيه كتلة غير مغلقة`);
  }

  /*
   * علامة دولار مفردة حول كتلة كود.
   *
   * فحص التوازن أعلاه لا يمسكها: كتلة مكتوبة `do $ begin … end $;` فيها
   * صفر من `$$` فيبقى العدد زوجياً وتمر. وهذه ليست حالة نظرية — أفسدَت
   * دالةُ استبدال نصية هذا الملفَ فعلاً، لأن `$$` في نص الاستبدال بلغة
   * جافاسكربت تعني "علامة دولار واحدة".
   */
  const lines = sql.split("\n");
  lines.forEach((line, i) => {
    if (/(^|\s)do\s+\$\s/.test(line) || /end\s+\$\s*;/.test(line)) {
      fail(file, `سطر ${i + 1}: علامة $ مفردة حول كتلة — المطلوب $$`);
    }
  });
}

/* ------------------------------------------------------------------ */
/* 2. الجداول وأعمدتها                                                 */
/* ------------------------------------------------------------------ */
const tables = new Map();

for (const [, sql] of clean) {
  const re =
    /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/gi;
  let m;
  while ((m = re.exec(sql))) {
    const [, name, body] = m;
    const columns = new Set();
    let depth = 0;
    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      // تجاهل أسطر القيود
      if (!/^(constraint|primary key|unique|foreign key|check)\b/i.test(line)) {
        const col = line.match(/^(\w+)\s+/);
        if (col && depth === 0) columns.add(col[1]);
      }
      depth += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
    }
    tables.set(name, columns);
  }
}

/* ------------------------------------------------------------------ */
/* 3. الأنواع المعدودة وقيمها                                          */
/* ------------------------------------------------------------------ */
const enums = new Map();
{
  const re = /create type public\.(\w+) as enum\s*\(([^)]*)\)/gi;
  let m;
  while ((m = re.exec(allSql))) {
    const values = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    enums.set(m[1], new Set(values));
  }
}

/* ------------------------------------------------------------------ */
/* 4. الدوال المعرّفة                                                   */
/* ------------------------------------------------------------------ */
const functions = new Set();
{
  const re = /create (?:or replace )?function public\.(\w+)\s*\(/gi;
  let m;
  while ((m = re.exec(allSql))) functions.add(m[1]);
}

/* ------------------------------------------------------------------ */
/* 5. كل استدعاء public.something(...) لازم يكون دالة معرّفة            */
/* ------------------------------------------------------------------ */
for (const [file, sql] of clean) {
  const re = /public\.(\w+)\s*\(/g;
  let m;
  while ((m = re.exec(sql))) {
    const name = m[1];
    // تخطَّ تعريف الدالة نفسه وتعريف النوع
    const before = sql.slice(Math.max(0, m.index - 60), m.index).toLowerCase();
    if (/function\s+$/.test(before) || /type\s+$/.test(before)) continue;
    if (tables.has(name) || enums.has(name)) continue;
    if (!functions.has(name)) {
      fail(file, `استدعاء دالة غير معرّفة: public.${name}()`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6. كل جدول مُشار إليه لازم يكون معرّفاً                              */
/* ------------------------------------------------------------------ */
const KNOWN_SCHEMAS = ["auth.", "storage.", "pg_", "information_schema."];

for (const [file, sql] of clean) {
  const re =
    /\b(?:from|join|update|into|on|table)\s+public\.(\w+)\b/gi;
  let m;
  while ((m = re.exec(sql))) {
    const name = m[1];
    if (tables.has(name) || functions.has(name) || enums.has(name)) continue;
    fail(file, `إشارة إلى جدول غير معرّف: public.${name}`);
  }
  for (const s of KNOWN_SCHEMAS) void s;
}

/* ------------------------------------------------------------------ */
/* 7. أعمدة الإدراج لازم تكون موجودة                                    */
/* ------------------------------------------------------------------ */
for (const [file, sql] of clean) {
  const re = /insert into public\.(\w+)\s*\(([^)]*)\)/gi;
  let m;
  while ((m = re.exec(sql))) {
    const [, table, cols] = m;
    const known = tables.get(table);
    if (!known) continue;
    for (const raw of cols.split(",")) {
      const col = raw.trim();
      if (!col || !/^\w+$/.test(col)) continue;
      if (!known.has(col)) {
        fail(file, `إدراج في عمود غير موجود: ${table}.${col}`);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 8. الأعمدة المؤهَّلة باسم جدولها                                     */
/* ------------------------------------------------------------------ */
for (const [file, sql] of clean) {
  for (const [table, columns] of tables) {
    const re = new RegExp(`\\b${table}\\.(\\w+)\\b`, "g");
    let m;
    while ((m = re.exec(sql))) {
      const col = m[1];
      // public.<table> نفسها، لا عمود
      const before = sql.slice(Math.max(0, m.index - 7), m.index);
      if (before.endsWith("public.")) continue;
      if (!columns.has(col)) {
        fail(file, `عمود غير موجود: ${table}.${col}`);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 9. صلاحيات التنفيذ لدوال موجودة                                      */
/* ------------------------------------------------------------------ */
for (const [file, sql] of clean) {
  const re = /(?:grant execute|revoke all) on function public\.(\w+)\s*\(/gi;
  let m;
  while ((m = re.exec(sql))) {
    if (!functions.has(m[1])) {
      fail(file, `منح صلاحية تنفيذ لدالة غير موجودة: public.${m[1]}()`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 10. كل جدول لازم يكون عليه RLS مفعّل                                 */
/* ------------------------------------------------------------------ */
{
  const enabled = new Set(
    [...allSql.matchAll(/alter table public\.(\w+)\s+enable row level security/gi)].map(
      (m) => m[1],
    ),
  );
  for (const table of tables.keys()) {
    if (!enabled.has(table)) {
      fail("03_rls.sql", `جدول بلا RLS مفعّل: public.${table}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 11. كل جدول لازم يكون عليه سياسة واحدة على الأقل                     */
/* ------------------------------------------------------------------ */
{
  const withPolicy = new Set(
    [...allSql.matchAll(/create policy \w+ on public\.(\w+)/gi)].map((m) => m[1]),
  );
  for (const table of tables.keys()) {
    if (!withPolicy.has(table)) {
      fail("03_rls.sql", `جدول بلا أي سياسة (سيُمنع الجميع): public.${table}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 12. قيم enum المستخدمة في النصوص المقتبسة                            */
/* ------------------------------------------------------------------ */
{
  const columnTypes = new Map();
  for (const [, sql] of clean) {
    const re = /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/gi;
    let m;
    while ((m = re.exec(sql))) {
      for (const line of m[2].split("\n")) {
        const c = line.trim().match(/^(\w+)\s+public\.(\w+)/);
        if (c && enums.has(c[2])) columnTypes.set(`${m[1]}.${c[1]}`, c[2]);
      }
    }
  }

  for (const [file, sql] of clean) {
    /*
     * متغيرات plpgsql المعرّفة بـ %rowtype تُعامَل كأنها الجدول نفسه، وإلا
     * مرّت أخطاء مثل v_attempt.status <> 'in_progres' بلا اعتراض — وهي أخطاء
     * لا تظهر إلا وقت التشغيل، أي في وسط امتحان.
     */
    const aliases = new Map();
    for (const m of sql.matchAll(/(\w+)\s+public\.(\w+)%rowtype/gi)) {
      if (tables.has(m[2])) aliases.set(m[1], m[2]);
    }

    /*
     * وأسماء الأعمدة التي نوعها enum تُفحص أياً كان الاسم المستعار قبلها،
     * لأن أليَس السجلات في حلقات plpgsql (q.type مثلاً) لا يمكن ربطها
     * بجدولها ثابتاً. عند تكرار اسم العمود في أكثر من جدول نقبل اتحاد
     * القيم — يظل ذلك كافياً لالتقاط الأخطاء الإملائية.
     */
    const byColumnName = new Map();
    for (const [qualified, enumName] of columnTypes) {
      const col = qualified.split(".")[1];
      const set = byColumnName.get(col) ?? new Set();
      for (const v of enums.get(enumName)) set.add(v);
      byColumnName.set(col, set);
    }

    const re = /(\w+)\.(\w+)\s*(?:=|<>|!=)\s*'([^']+)'/g;
    let m;
    while ((m = re.exec(sql))) {
      const [, alias, column, literal] = m;
      const table = aliases.get(alias) ?? alias;

      const exact = columnTypes.get(`${table}.${column}`);
      if (exact) {
        if (!enums.get(exact).has(literal)) {
          fail(
            file,
            `قيمة غير موجودة في النوع ${exact}: '${literal}' (المسموح: ${[...enums.get(exact)].join(", ")})`,
          );
        }
        continue;
      }

      const loose = byColumnName.get(column);
      if (loose && !loose.has(literal)) {
        fail(
          file,
          `قيمة مشبوهة للعمود ${alias}.${column}: '${literal}' (المعروف: ${[...loose].join(", ")})`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 12.5 ملف التنصيب لا بد أن يكون مكتفياً بذاته                         */
/*                                                                     */
/* 01_schema.sql يُشغَّل وحده على قاعدة فارغة، فكل نوع يستعمله عموداً    */
/* يجب أن يُنشأ فيه هو لا في ملف ترحيل لاحق. وفحص الأنواع أعلاه يجمع    */
/* الملفات كلها، فلا يرى هذه الفجوة: نوعٌ معرَّف في 13 ومستعمَل في 01   */
/* يمر سليماً بينما ينهار أول تنصيب جديد.                              */
/* ------------------------------------------------------------------ */
{
  const bootstrap = clean.get("01_schema.sql");

  if (bootstrap) {
    const declared = new Set(
      [...bootstrap.matchAll(/create type public\.(\w+) as enum/gi)].map((m) => m[1]),
    );

    const used = new Set(
      [...bootstrap.matchAll(/^\s*\w+\s+public\.(\w+)\s/gim)].map((m) => m[1]),
    );

    for (const type of used) {
      if (!enums.has(type)) continue; // ليس نوعاً معدوداً — جدول أو دالة
      if (!declared.has(type)) {
        fail(
          "01_schema.sql",
          `عمود بنوع public.${type} والنوع غير مُنشأ في هذا الملف — أي تنصيب جديد سيفشل`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 13. تطابق الأنواع المعدودة مع اتحادات TypeScript                     */
/*                                                                     */
/* قيمة موجودة في قاعدة البيانات وناقصة في types.ts تمر من المترجم بلا  */
/* اعتراض وتنكشف في وقت التشغيل فقط، فنقارنها هنا.                     */
/* ------------------------------------------------------------------ */
{
  const typesPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "lib",
    "types.ts",
  );

  let ts = "";
  try {
    ts = readFileSync(typesPath, "utf8");
  } catch {
    fail("types.ts", "تعذّر قراءة src/lib/types.ts");
  }

  const pascal = (snake) =>
    snake
      .split("_")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join("");

  for (const [enumName, values] of enums) {
    const tsName = pascal(enumName);
    const decl = ts.match(
      new RegExp(`export type ${tsName}\\s*=([\\s\\S]*?);`),
    );
    if (!decl) continue; // لا مقابل في TS — مقبول

    const tsValues = new Set([...decl[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));

    for (const v of values) {
      if (!tsValues.has(v)) {
        fail("types.ts", `النوع ${tsName} ناقصة منه القيمة '${v}' الموجودة في SQL`);
      }
    }
    for (const v of tsValues) {
      if (!values.has(v)) {
        fail("types.ts", `النوع ${tsName} فيه قيمة '${v}' غير موجودة في enum ${enumName}`);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* التقرير                                                             */
/* ------------------------------------------------------------------ */
console.log(`الملفات: ${files.length}`);
console.log(`الجداول: ${tables.size} — ${[...tables.keys()].join(", ")}`);
console.log(`الأنواع المعدودة: ${enums.size}`);
console.log(`الدوال: ${functions.size} — ${[...functions].join(", ")}`);
console.log("");

if (problems.length === 0) {
  console.log("لا توجد مشاكل.");
} else {
  console.log(`المشاكل (${problems.length}):`);
  for (const p of problems) console.log(`  • ${p}`);
  process.exitCode = 1;
}
