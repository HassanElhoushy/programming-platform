"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { planQuestion } from "@/lib/question-plan";
import type { ExamKind } from "@/lib/types";
import {
  countBlankMarkers,
  importFileSchema,
  validateImport,
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
  const kind = String(formData.get("kind") ?? "practice");
  const rawDuration = String(formData.get("duration_minutes") ?? "").trim();

  if (!lessonId) return { error: "اختر الدرس." };
  if (title.length < 2) return { error: "اكتب عنوان الامتحان." };
  if (level !== "basic" && level !== "advanced") return { error: "اختر المستوى." };
  if (kind !== "practice" && kind !== "exam" && kind !== "bank") {
    return { error: "اختر النوع: تدريب أو امتحان أو بنك أسئلة." };
  }

  let duration: number | null = null;
  if (rawDuration !== "") {
    duration = Number(rawDuration);
    if (!Number.isInteger(duration) || duration < 1) {
      return { error: "المدة لازم تكون عدد دقائق صحيحاً، أو اتركها فاضية." };
    }
  }

  const { data, error } = await supabase
    .from("exams")
    .insert({ lesson_id: lessonId, title, level, kind, duration_minutes: duration })
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
  kind: ExamKind;
  durationMinutes: number | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const title = input.title.trim();
  if (title.length < 2) return { error: "اكتب عنوان الامتحان." };

  if (!["practice", "exam", "bank"].includes(input.kind)) {
    return { error: "النوع غير معروف." };
  }

  const { error } = await supabase
    .from("exams")
    .update({
      title,
      level: input.level,
      kind: input.kind,
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

  /*
   * أي محاولة غير ملغاة تمنع الاستبدال، لا الجارية وحدها: حذف الأسئلة
   * القديمة يحذف معها إجابات المحاولات المصحَّحة (حذف متسلسل)، فيبقى للطالب
   * درجة بلا إجابات تشرحها. الرسالة تفصّل النوعين لأن علاجهما مختلف.
   */
  const { data: blocking } = await supabase
    .from("exam_attempts")
    .select("status")
    .eq("exam_id", examId)
    .is("voided_at", null);

  const attempts = blocking ?? [];
  if (attempts.length > 0) {
    const running = attempts.filter((a) => a.status === "in_progress").length;
    const done = attempts.length - running;

    const parts = [
      running > 0 ? `${running} محاولة لسه جارية` : null,
      done > 0 ? `${done} تسليم متسجّل` : null,
    ].filter(Boolean);

    return {
      error: `مش ممكن نستبدل الأسئلة: فيه ${parts.join(" و")} على الامتحان ده. استبدال الأسئلة هيمسح إجاباتهم. ألغِ المحاولات من قسم "المحاولات" تحت، أو اعمل امتحاناً جديداً بدل ما تعدّل ده.`,
    };
  }

  const questions = parsed.data.questions;

  // امسح الأسئلة القديمة — الحذف المتسلسل يزيل خياراتها ومفاتيحها معها
  const { error: clearError } = await supabase
    .from("questions")
    .delete()
    .eq("exam_id", examId);

  if (clearError) return { error: GENERIC };

  /*
   * خطة لكل سؤال تحدّد صفوف خياراته وكيف يُبنى مفتاحه. هنا تحدث بعثرة ما
   * يجب بعثرته، فيُخزَّن السؤال بترتيب لا يدل على إجابته.
   */
  const plans = questions.map((q) => planQuestion(q));

  const { data: insertedQuestions, error: qError } = await supabase
    .from("questions")
    .insert(
      questions.map((q, i) => ({
        exam_id: examId,
        position: i + 1,
        type: q.type,
        body: q.body.trim(),
        points: q.points,
        blank_count: plans[i].blankCount,
      })),
    )
    .select("id, position");

  if (qError || !insertedQuestions) return { error: GENERIC };

  const idByPosition = new Map(
    insertedQuestions.map((q) => [q.position, q.id as string]),
  );

  /* الخيارات: دفعة واحدة، ثم نستعيد معرّفاتها لبناء المفاتيح */
  const optionRows: {
    question_id: string;
    position: number;
    body: string;
    role: string;
  }[] = [];
  plans.forEach((plan, i) => {
    const questionId = idByPosition.get(i + 1)!;
    plan.options.forEach((o) => {
      optionRows.push({ question_id: questionId, ...o });
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

  /* المفاتيح والإجابات النموذجية — كلاهما في الجدول المحمي نفسه */
  const keyRows: {
    question_id: string;
    key: unknown;
    model_answer: string | null;
    explanation: string | null;
  }[] = [];

  questions.forEach((q, i) => {
    const questionId = idByPosition.get(i + 1)!;
    const key = plans[i].buildKey((pos) => optionIdMap.get(`${questionId}:${pos}`));
    const modelAnswer =
      q.type === "essay" ? (q.model_answer?.trim() || null) : null;
    const explanation = q.explanation?.trim() || null;

    if (key !== null || modelAnswer !== null || explanation !== null) {
      keyRows.push({
        question_id: questionId,
        key,
        model_answer: modelAnswer,
        explanation,
      });
    }
  });

  if (keyRows.length > 0) {
    const { error: kError } = await supabase.from("question_keys").insert(keyRows);
    if (kError) return { error: GENERIC };
  }

  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true, count: questions.length };
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
  const plan = planQuestion(question);

  const { data: inserted, error: qError } = await supabase
    .from("questions")
    .insert({
      exam_id: examId,
      position,
      type: question.type,
      body: question.body.trim(),
      points: question.points,
      blank_count: plan.blankCount,
    })
    .select("id")
    .single();

  if (qError || !inserted) return { error: GENERIC };

  const questionId = inserted.id as string;
  const optionIdMap = new Map<string, string>();

  if (plan.options.length > 0) {
    const { data: options, error: oError } = await supabase
      .from("question_options")
      .insert(plan.options.map((o) => ({ question_id: questionId, ...o })))
      .select("id, position");

    if (oError || !options) return { error: GENERIC };

    for (const option of options) {
      optionIdMap.set(`${questionId}:${option.position}`, option.id as string);
    }
  }

  const key = plan.buildKey((pos) => optionIdMap.get(`${questionId}:${pos}`));
  const modelAnswer =
    question.type === "essay" ? (question.model_answer?.trim() || null) : null;
  const explanation = question.explanation?.trim() || null;

  if (key !== null || modelAnswer !== null || explanation !== null) {
    const { error: kError } = await supabase
      .from("question_keys")
      .insert({
        question_id: questionId,
        key,
        model_answer: modelAnswer,
        explanation,
      });
    if (kError) return { error: GENERIC };
  }

  revalidatePath(`/admin/exams/${examId}`);
  return { ok: true };
}

/* ==========================================================================
   المحاولات
   ========================================================================== */

/**
 * إلغاء محاولة من صفحة الامتحان.
 *
 * الإلغاء لا يحذف شيئاً: يضع voided_at فيخرج الصف من الفهرس الفريد الجزئي
 * الذي يسمح بمحاولة فعّالة واحدة لكل طالب، فيستطيع الطالب البدء من جديد
 * بينما يبقى سجل المحاولة القديمة وإجاباتها للاطّلاع.
 */
export async function voidExamAttemptAction(
  attemptId: string,
  examId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("void_attempt", { p_attempt_id: attemptId });
  if (error) return { error: "تعذّر إلغاء المحاولة. حاول تاني." };

  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/admin/grading");
  revalidatePath("/admin");
  return { ok: true };
}

/* ==========================================================================
   الإجابة النموذجية للسؤال المقالي
   ========================================================================== */

/**
 * تُحفظ في question_keys لا في questions، فترث سياسة RLS الوحيدة لذلك
 * الجدول: المدرّس فقط. ولا تصل الطالب إلا عبر get_attempt_review وبنفس
 * شرط إظهار الإجابات الصحيحة.
 *
 * النص الفارغ يمسح الصف كله إن لم يكن يحمل مفتاحاً — فالمكان لا يظهر
 * للطالب أصلاً ما لم تُكتب إجابة.
 */
export async function setModelAnswerAction(
  questionId: string,
  examId: string,
  text: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const value = text.trim();

  const { data: question } = await supabase
    .from("questions")
    .select("id, type")
    .eq("id", questionId)
    .eq("exam_id", examId)
    .maybeSingle();

  if (!question || question.type !== "essay") {
    return { error: "السؤال ده مش سؤال مقالي في الامتحان ده." };
  }

  if (value === "") {
    const { error } = await supabase
      .from("question_keys")
      .delete()
      .eq("question_id", questionId)
      .is("key", null);

    if (error) return { error: GENERIC };
  } else {
    const { error } = await supabase
      .from("question_keys")
      .upsert(
        { question_id: questionId, key: null, model_answer: value },
        { onConflict: "question_id" },
      );

    if (error) return { error: GENERIC };
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
