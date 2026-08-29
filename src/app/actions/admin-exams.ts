"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  countBlankMarkers,
  importFileSchema,
  validateImport,
  type ImportQuestion,
} from "@/lib/validation";
import type { ActionResult } from "@/app/actions/admin-content";

const GENERIC = "حصلت مشكلة أثناء الحفظ. حاول تاني.";

/* ==========================================================================
   الامتحان
   ========================================================================== */

export async function createExamAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult & { examId?: string }> {
  await requireAdmin();
  const supabase = await createClient();

  const lessonId = String(formData.get("lesson_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const level = String(formData.get("level") ?? "basic");
  const rawDuration = String(formData.get("duration_minutes") ?? "").trim();

  if (!lessonId) return { error: "اختر الدرس." };
  if (title.length < 2) return { error: "اكتب عنوان الامتحان." };
  if (level !== "basic" && level !== "advanced") return { error: "اختر المستوى." };

  let duration: number | null = null;
  if (rawDuration !== "") {
    duration = Number(rawDuration);
    if (!Number.isInteger(duration) || duration < 1) {
      return { error: "المدة لازم تكون عدد دقائق صحيحاً، أو اتركها فاضية." };
    }
  }

  const { data, error } = await supabase
    .from("exams")
    .insert({ lesson_id: lessonId, title, level, duration_minutes: duration })
    .select("id")
    .single();

  if (error || !data) return { error: GENERIC };

  revalidatePath(`/admin/content/${lessonId}`);
  return { ok: true, examId: data.id };
}

export async function updateExamAction(input: {
  examId: string;
  title: string;
  level: "basic" | "advanced";
  durationMinutes: number | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const title = input.title.trim();
  if (title.length < 2) return { error: "اكتب عنوان الامتحان." };

  const { error } = await supabase
    .from("exams")
    .update({
      title,
      level: input.level,
      duration_minutes: input.durationMinutes,
    })
    .eq("id", input.examId);

  if (error) return { error: GENERIC };

  revalidatePath(`/admin/exams/${input.examId}`);
  return { ok: true };
}

export async function setExamOpenAction(
  examId: string,
  isOpen: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("exams")
    .update({ is_open: isOpen })
    .eq("id", examId);

  if (error) return { error: GENERIC };

  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true };
}

/**
 * مفتاح إظهار الإجابات النموذجية للطلاب.
 *
 * مقفول افتراضياً عند إنشاء أي امتحان. ما دام مقفولاً فإن دالة
 * get_attempt_review لا ترسل الإجابة الصحيحة ولا حتى صواب أو خطأ كل سؤال
 * إلى متصفح الطالب. افتحه بعد ما يخلص كل الطلبة، وإلا سرّبها أول من يحل.
 */
export async function setRevealAnswersAction(
  examId: string,
  reveal: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("exams")
    .update({ reveal_answers: reveal })
    .eq("id", examId);

  if (error) return { error: GENERIC };

  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true };
}

export async function archiveExamAction(
  examId: string,
  lessonId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("exams")
    .update({ archived_at: new Date().toISOString(), is_open: false })
    .eq("id", examId);

  if (error) return { error: GENERIC };

  revalidatePath(`/admin/content/${lessonId}`);
  return { ok: true };
}

/* ==========================================================================
   استيراد الأسئلة من JSON
   ========================================================================== */

/**
 * الاستيراد يستبدل كل أسئلة الامتحان. لذلك يُرفض إن كان أحد الطلاب قد بدأ
 * الامتحان بالفعل: استبدال الأسئلة تحت محاولة جارية يفسد إجاباتها ودرجاتها.
 *
 * المفاتيح تُكتب في جدول question_keys المنفصل، ولا يُكتب في جدول الخيارات
 * أي حقل يدل على الصحة.
 */
export async function importQuestionsAction(
  examId: string,
  rawJson: string,
): Promise<ActionResult & { count?: number; details?: string[] }> {
  await requireAdmin();
  const supabase = await createClient();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return { error: "الملف مش JSON صالح. اتأكد إنك نسخته كامل بأقواسه." };
  }

  const parsed = importFileSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 8).map((issue) => {
      const at = issue.path
        .map((p) => (typeof p === "number" ? `السؤال ${p + 1}` : String(p)))
        .join(" ← ");
      return at ? `${at}: ${issue.message}` : issue.message;
    });
    return { error: "الملف فيه أخطاء:", details };
  }

  const logicErrors = validateImport(parsed.data);
  if (logicErrors.length > 0) {
    return { error: "الملف فيه أخطاء:", details: logicErrors };
  }

  const { count: attemptCount } = await supabase
    .from("exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId)
    .is("voided_at", null);

  if ((attemptCount ?? 0) > 0) {
    return {
      error:
        "فيه طلبة بدأوا الامتحان ده بالفعل، فمش ممكن نستبدل أسئلته. اعمل امتحاناً جديداً، أو ألغِ محاولاتهم من صفحة كل طالب.",
    };
  }

  const questions = parsed.data.questions;

  // امسح الأسئلة القديمة — الحذف المتسلسل يزيل خياراتها ومفاتيحها معها
  const { error: clearError } = await supabase
    .from("questions")
    .delete()
    .eq("exam_id", examId);

  if (clearError) return { error: GENERIC };

  const { data: insertedQuestions, error: qError } = await supabase
    .from("questions")
    .insert(
      questions.map((q, i) => ({
        exam_id: examId,
        position: i + 1,
        type: q.type,
        body: q.body.trim(),
        points: q.points,
        blank_count: q.type === "fill_blank" ? q.blanks.length : 0,
      })),
    )
    .select("id, position");

  if (qError || !insertedQuestions) return { error: GENERIC };

  const idByPosition = new Map(
    insertedQuestions.map((q) => [q.position, q.id as string]),
  );

  /* الخيارات: دفعة واحدة، ثم نستعيد معرّفاتها لبناء المفاتيح */
  const optionRows: { question_id: string; position: number; body: string }[] = [];
  questions.forEach((q, i) => {
    if (q.type !== "mcq_single" && q.type !== "mcq_multi") return;
    const questionId = idByPosition.get(i + 1)!;
    q.options.forEach((body, oi) => {
      optionRows.push({ question_id: questionId, position: oi + 1, body: body.trim() });
    });
  });

  const optionIdMap = new Map<string, string>();
  if (optionRows.length > 0) {
    const { data: insertedOptions, error: oError } = await supabase
      .from("question_options")
      .insert(optionRows)
      .select("id, question_id, position");

    if (oError || !insertedOptions) return { error: GENERIC };

    for (const option of insertedOptions) {
      optionIdMap.set(`${option.question_id}:${option.position}`, option.id as string);
    }
  }

  /* المفاتيح */
  const keyRows: { question_id: string; key: unknown }[] = [];
  questions.forEach((q, i) => {
    const questionId = idByPosition.get(i + 1)!;
    const key = buildKey(q, questionId, optionIdMap);
    if (key !== null) keyRows.push({ question_id: questionId, key });
  });

  if (keyRows.length > 0) {
    const { error: kError } = await supabase.from("question_keys").insert(keyRows);
    if (kError) return { error: GENERIC };
  }

  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true, count: questions.length };
}

function buildKey(
  question: ImportQuestion,
  questionId: string,
  optionIds: Map<string, string>,
): unknown {
  switch (question.type) {
    case "mcq_single":
      return { option_ids: [optionIds.get(`${questionId}:${question.correct}`)] };
    case "mcq_multi":
      return {
        option_ids: question.correct.map((c) => optionIds.get(`${questionId}:${c}`)),
      };
    case "true_false":
      return { value: question.correct };
    case "fill_blank":
      return { blanks: question.blanks };
    default:
      return null;
  }
}

/* ==========================================================================
   تعديل سؤال مفرد يدوياً
   ========================================================================== */

export async function deleteQuestionAction(
  questionId: string,
  examId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { count } = await supabase
    .from("exam_attempts")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", examId)
    .is("voided_at", null);

  if ((count ?? 0) > 0) {
    return { error: "فيه محاولات على الامتحان ده، فحذف سؤال هيبوّظ الدرجات." };
  }

  const { error } = await supabase.from("questions").delete().eq("id", questionId);
  if (error) return { error: GENERIC };

  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true };
}

/** إضافة سؤال واحد بنفس صيغة الاستيراد، للحالات الفردية بعد الاستيراد الجماعي */
export async function addQuestionAction(
  examId: string,
  rawJson: string,
): Promise<ActionResult & { details?: string[] }> {
  await requireAdmin();
  const supabase = await createClient();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawJson);
  } catch {
    return { error: "النص مش JSON صالح." };
  }

  const parsed = importFileSchema.safeParse({ questions: [parsedJson] });
  if (!parsed.success) {
    return {
      error: "السؤال فيه أخطاء:",
      details: parsed.error.issues.slice(0, 6).map((i) => i.message),
    };
  }

  const logicErrors = validateImport(parsed.data);
  if (logicErrors.length > 0) return { error: "السؤال فيه أخطاء:", details: logicErrors };

  const question = parsed.data.questions[0];

  if (question.type === "fill_blank" && countBlankMarkers(question.body) === 0) {
    return { error: "سؤال إكمال الفراغات لازم يحتوي على [1] و [2] في نصه." };
  }

  const { data: last } = await supabase
    .from("questions")
    .select("position")
    .eq("exam_id", examId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const position = (last?.position ?? 0) + 1;

  const { data: inserted, error: qError } = await supabase
    .from("questions")
    .insert({
      exam_id: examId,
      position,
      type: question.type,
      body: question.body.trim(),
      points: question.points,
      blank_count: question.type === "fill_blank" ? question.blanks.length : 0,
    })
    .select("id")
    .single();

  if (qError || !inserted) return { error: GENERIC };

  const questionId = inserted.id as string;
  const optionIdMap = new Map<string, string>();

  if (question.type === "mcq_single" || question.type === "mcq_multi") {
    const { data: options, error: oError } = await supabase
      .from("question_options")
      .insert(
        question.options.map((body, i) => ({
          question_id: questionId,
          position: i + 1,
          body: body.trim(),
        })),
      )
      .select("id, position");

    if (oError || !options) return { error: GENERIC };

    for (const option of options) {
      optionIdMap.set(`${questionId}:${option.position}`, option.id as string);
    }
  }

  const key = buildKey(question, questionId, optionIdMap);
  if (key !== null) {
    const { error: kError } = await supabase
      .from("question_keys")
      .insert({ question_id: questionId, key });
    if (kError) return { error: GENERIC };
  }

  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true };
}

/* ==========================================================================
   إدارة صور الإجابات — لتوفير مساحة التخزين المجانية
   ========================================================================== */

/**
 * يحذف صور الإجابات المقالية لامتحان اكتمل تصحيحه.
 * الدرجات والفيدباك والنص المكتوب كله يبقى — الصور فقط هي التي تُمسح، لأنها
 * أثقل ما في المشروع على باقة التخزين المجانية.
 */
export async function purgeExamImagesAction(
  examId: string,
): Promise<ActionResult & { removed?: number }> {
  await requireAdmin();
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: attemptRows } = await supabase
    .from("exam_attempts")
    .select("id, student_id, status")
    .eq("exam_id", examId);

  const attempts = attemptRows ?? [];

  const pending = attempts.filter((a) => a.status === "submitted");
  if (pending.length > 0) {
    return {
      error: `لسه فيه ${pending.length} تسليم محتاج تصحيح. صحّحهم الأول قبل ما تمسح الصور.`,
    };
  }

  const attemptIds = attempts.map((a) => a.id);
  if (attemptIds.length === 0) return { ok: true, removed: 0 };

  const { data: answers } = await admin
    .from("answers")
    .select("attempt_id, question_id, image_path")
    .not("image_path", "is", null)
    .in("attempt_id", attemptIds);

  const paths = (answers ?? [])
    .map((a) => a.image_path as string)
    .filter(Boolean);

  if (paths.length === 0) return { ok: true, removed: 0 };

  const { error: removeError } = await admin.storage.from("answers").remove(paths);
  if (removeError) return { error: "تعذّر حذف الصور. حاول تاني." };

  await admin
    .from("answers")
    .update({ image_path: null })
    .in("attempt_id", attemptIds)
    .not("image_path", "is", null);

  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true, removed: paths.length };
}
