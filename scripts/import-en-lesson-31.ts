/**
 * يستورد تدريب وامتحان الدرس 3-1 لمسار اللغات.
 * الملفات في curriculum/ ولا تُرفع. التشغيل يعيد الاستيراد لو الامتحان فاضي،
 * ويرفض لو فيه محاولة غير ملغاة.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { planQuestion } from "../src/lib/question-plan";
import { importFileSchema, validateImport } from "../src/lib/validation";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL أو SUPABASE_SECRET_KEY ناقص");
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function load(path: string) {
  const file = importFileSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  const errors = validateImport(file);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return file.questions;
}

async function main() {
  const practice = await load("curriculum/practice_3_1_en.json");
  const exam = await load("curriculum/exam_3_1_en.json");

  const { data: existing } = await supabase
    .from("chapters")
    .select("id")
    .eq("track", "en")
    .eq("position", 3)
    .eq("kind", "chapter")
    .is("archived_at", null)
    .maybeSingle();

  let chapterId = existing?.id as string | undefined;
  if (!chapterId) {
    const { data, error } = await supabase
      .from("chapters")
      .insert({
        title: "Web Applications",
        position: 3,
        kind: "chapter",
        track: "en",
      })
      .select("id")
      .single();
    if (error || !data?.id) throw error ?? new Error("chapter");
    chapterId = data.id;
  }
  if (!chapterId) throw new Error("chapter");

  const { data: lessonRow } = await supabase
    .from("lessons")
    .select("id")
    .eq("chapter_id", chapterId)
    .eq("position", 1)
    .eq("kind", "lesson")
    .is("archived_at", null)
    .maybeSingle();

  let lessonId = lessonRow?.id as string | undefined;
  if (!lessonId) {
    const { data, error } = await supabase
      .from("lessons")
      .insert({
        chapter_id: chapterId,
        title: "The Overall Structure of Web Applications",
        position: 1,
        kind: "lesson",
      })
      .select("id")
      .single();
    if (error || !data?.id) throw error ?? new Error("lesson");
    lessonId = data.id;
  }
  if (!lessonId) throw new Error("lesson");

  await ensureExam(lessonId, {
    title: "Lesson 1 practice",
    kind: "practice",
    level: "basic",
    duration_minutes: null,
    questions: practice,
  });
  await ensureExam(lessonId, {
    title: "Lesson 1 exam",
    kind: "exam",
    level: "advanced",
    duration_minutes: 60,
    questions: exam,
  });

  console.log("lesson", lessonId);
}

async function ensureExam(
  lessonId: string,
  spec: {
    title: string;
    kind: "practice" | "exam";
    level: "basic" | "advanced";
    duration_minutes: number | null;
    questions: ReturnType<typeof importFileSchema.parse>["questions"];
  },
) {
  const { data: found } = await supabase
    .from("exams")
    .select("id")
    .eq("lesson_id", lessonId)
    .eq("kind", spec.kind)
    .is("archived_at", null)
    .maybeSingle();

  let examId = found?.id as string | undefined;
  if (!examId) {
    const { data, error } = await supabase
      .from("exams")
      .insert({
        lesson_id: lessonId,
        title: spec.title,
        kind: spec.kind,
        level: spec.level,
        duration_minutes: spec.duration_minutes,
        is_open: true,
        reveal_answers: false,
      })
      .select("id")
      .single();
    if (error || !data?.id) throw error ?? new Error(spec.kind);
    examId = data.id;
  }
  if (!examId) throw new Error(spec.kind);

  const { count } = await supabase
    .from("exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId)
    .is("voided_at", null);
  if ((count ?? 0) > 0) throw new Error(`${spec.kind}: فيه محاولات`);

  const { count: existingQuestions } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId);
  if ((existingQuestions ?? 0) > 0) {
    console.log(spec.kind, "already has", existingQuestions, "questions");
    return;
  }

  const plans = spec.questions.map((q) => planQuestion(q));
  const { data: inserted, error: qError } = await supabase
    .from("questions")
    .insert(
      spec.questions.map((q, i) => ({
        exam_id: examId,
        position: i + 1,
        type: q.type,
        body: q.body.trim(),
        points: q.points,
        blank_count: plans[i].blankCount,
        tier: null,
      })),
    )
    .select("id, position");
  if (qError || !inserted) throw qError ?? new Error("questions");

  const idByPosition = new Map(inserted.map((q) => [q.position as number, q.id as string]));
  const optionRows: {
    question_id: string;
    position: number;
    body: string;
    role: string;
  }[] = [];
  plans.forEach((plan, i) => {
    const questionId = idByPosition.get(i + 1)!;
    plan.options.forEach((o) => optionRows.push({ question_id: questionId, ...o }));
  });

  const optionIdMap = new Map<string, string>();
  if (optionRows.length > 0) {
    const { data: options, error } = await supabase
      .from("question_options")
      .insert(optionRows)
      .select("id, question_id, position");
    if (error || !options) throw error ?? new Error("options");
    for (const option of options) {
      optionIdMap.set(`${option.question_id}:${option.position}`, option.id as string);
    }
  }

  const keyRows = spec.questions.flatMap((q, i) => {
    const questionId = idByPosition.get(i + 1)!;
    const key = plans[i].buildKey((pos) => optionIdMap.get(`${questionId}:${pos}`));
    const modelAnswer = q.type === "essay" ? q.model_answer?.trim() || null : null;
    if (key === null && modelAnswer === null) return [];
    return [{ question_id: questionId, key, model_answer: modelAnswer, explanation: null }];
  });

  if (keyRows.length > 0) {
    const { error } = await supabase.from("question_keys").insert(keyRows);
    if (error) throw error;
  }

  console.log(spec.kind, spec.questions.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
