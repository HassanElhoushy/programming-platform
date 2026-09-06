/**
 * يتحقق من سلوك حفظ الإجابات على المشروع الحقيقي.
 *
 * ثلاثة أشياء لا تكفي قراءة الكود للتأكد منها:
 *
 *   1. أن الدفعة المختلطة المفاتيح تُرفض فعلاً — وهي العلة التي كانت تعطّل
 *      الحفظ تعطّلاً دائماً، فنثبت وجودها لئلا يعود أحد فيجمع الصفوف.
 *   2. أن التقسيم حسب الحقول يمر.
 *   3. أن حفظ النص وحده لا يمحو صورة الطالب — وهو ما يمنعنا من "توحيد
 *      المفاتيح بملء الناقص بـ null"، وهو الحل الذي يبدو أبسط.
 *
 * يبني بيانات مؤقتة ويمحوها في النهاية مهما حدث.
 *
 * التشغيل: node scripts/check-answer-save.mjs
 */

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SECRET_KEY;

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, options = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function insert(table, row) {
  const res = await rest(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (res.status >= 300) {
    throw new Error(`فشل إدراج ${table}: ${JSON.stringify(res.body)}`);
  }
  return res.body[0];
}

function upsert(rows) {
  return rest("answers?on_conflict=attempt_id,question_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });
}

let pass = 0;
let fail = 0;

function check(name, ok, detail = "") {
  if (ok) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

let chapterId = null;

try {
  const students = await rest("profiles?role=eq.student&select=id&limit=1");
  const studentId = students.body?.[0]?.id;
  if (!studentId) throw new Error("لا يوجد طالب في المشروع.");

  const chapter = await insert("chapters", {
    title: "فصل فحص حفظ مؤقت",
    position: 9099,
  });
  chapterId = chapter.id;

  const lesson = await insert("lessons", {
    chapter_id: chapterId,
    title: "درس فحص مؤقت",
    position: 9099,
  });
  const exam = await insert("exams", {
    lesson_id: lesson.id,
    title: "امتحان فحص مؤقت",
    level: "basic",
  });

  const qEssay = await insert("questions", {
    exam_id: exam.id,
    position: 1,
    type: "essay",
    body: "سؤال مقالي للفحص",
    points: 5,
  });
  const qMcq = await insert("questions", {
    exam_id: exam.id,
    position: 2,
    type: "mcq_single",
    body: "سؤال اختياري للفحص",
    points: 1,
  });

  const attempt = await insert("exam_attempts", {
    exam_id: exam.id,
    student_id: studentId,
    status: "in_progress",
  });

  const base = { attempt_id: attempt.id };

  /* ---------------------------------------------------------------- 1 */
  const mixed = await upsert([
    { ...base, question_id: qEssay.id, response: { text: "نص المقالي" } },
    { ...base, question_id: qMcq.id, image_path: "x/y.jpg" },
  ]);
  check(
    "الدفعة المختلطة المفاتيح ما زالت مرفوضة (العلة موجودة فعلاً)",
    mixed.status === 400 && mixed.body?.code === "PGRST102",
    `HTTP ${mixed.status} ${JSON.stringify(mixed.body)}`,
  );

  /* ---------------------------------------------------------------- 2 */
  const groupA = await upsert([
    { ...base, question_id: qEssay.id, response: { text: "نص المقالي" } },
  ]);
  const groupB = await upsert([
    { ...base, question_id: qMcq.id, image_path: "x/y.jpg" },
  ]);
  check(
    "التقسيم حسب الحقول يمر: المجموعتان تُقبلان",
    groupA.status < 300 && groupB.status < 300,
    `${groupA.status} / ${groupB.status}`,
  );

  /* ---------------------------------------------------------------- 3 */
  await upsert([
    { ...base, question_id: qEssay.id, image_path: "essay/photo.jpg" },
  ]);
  await upsert([
    { ...base, question_id: qEssay.id, response: { text: "نص معدّل" } },
  ]);

  const after = await rest(
    `answers?attempt_id=eq.${attempt.id}&question_id=eq.${qEssay.id}` +
      `&select=response,image_path,updated_at`,
  );
  const row = after.body?.[0];

  check(
    "تعديل النص لا يمحو الصورة",
    row?.image_path === "essay/photo.jpg",
    `image_path = ${JSON.stringify(row?.image_path)}`,
  );
  check(
    "النص المعدّل محفوظ",
    row?.response?.text === "نص معدّل",
    JSON.stringify(row?.response),
  );

  /* ---------------------------------------------------------------- 4 */
  const lie = await upsert([
    {
      ...base,
      question_id: qEssay.id,
      response: { text: "بوقت كاذب" },
      updated_at: "1999-01-01T00:00:00Z",
    },
  ]);
  const afterLie = await rest(
    `answers?attempt_id=eq.${attempt.id}&question_id=eq.${qEssay.id}&select=updated_at`,
  );
  const written = new Date(afterLie.body?.[0]?.updated_at ?? 0);
  const driftMinutes = Math.abs(Date.now() - written.getTime()) / 60000;

  check(
    "وقت كاذب من العميل يُكتب بوقت الخادم",
    lie.status < 300 && driftMinutes < 5,
    `المكتوب ${written.toISOString()}`,
  );
} catch (error) {
  fail += 1;
  console.log(`FAIL  ${error.message}`);
} finally {
  if (chapterId) {
    // الحذف المتسلسل يزيل الدرس والامتحان والأسئلة والمحاولة والإجابات
    const cleanup = await rest(`chapters?id=eq.${chapterId}`, {
      method: "DELETE",
    });
    check("البيانات المؤقتة اتمسحت", cleanup.status < 300, `HTTP ${cleanup.status}`);
  }
}

console.log(`\n${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);
