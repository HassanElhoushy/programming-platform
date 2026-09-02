"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  error?: string;
  ok?: boolean;
}

const GENERIC = "حصلت مشكلة أثناء الحفظ. حاول تاني.";

/* ==========================================================================
   الفصول
   ========================================================================== */

export async function createChapterAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const position = Number(formData.get("position"));
  const kind = String(formData.get("kind") ?? "chapter");

  if (title.length < 2) return { error: "اكتب عنوان الفصل." };
  if (!Number.isInteger(position) || position < 1) {
    return { error: "رقم الفصل لازم يكون عدداً صحيحاً أكبر من صفر." };
  }

  if (kind !== "chapter" && kind !== "review") return { error: "اختر النوع." };

  const { error } = await supabase.from("chapters").insert({ title, position, kind });
  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  return { ok: true };
}

export async function updateChapterAction(
  chapterId: string,
  title: string,
  position: number,
  kind: "chapter" | "review",
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("chapters")
    .update({ title: title.trim(), position, kind })
    .eq("id", chapterId);

  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  return { ok: true };
}

/**
 * الأرشفة بدل الحذف: الدرجات والسجلات المرتبطة بالمحتوى لا تضيع، والعنصر
 * يختفي من حسابات الطلاب فوراً لأن كل دوال الصلاحية تشترط archived_at is null.
 */
export async function archiveChapterAction(chapterId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("chapters")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", chapterId);

  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  return { ok: true };
}

export async function restoreChapterAction(chapterId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("chapters")
    .update({ archived_at: null })
    .eq("id", chapterId);

  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  return { ok: true };
}

/* ==========================================================================
   الدروس
   ========================================================================== */

export async function createLessonAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const chapterId = String(formData.get("chapter_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const position = Number(formData.get("position"));
  const kind = String(formData.get("kind") ?? "lesson");

  if (!chapterId) return { error: "اختر الفصل." };
  if (title.length < 2) return { error: "اكتب عنوان الدرس." };
  if (!Number.isInteger(position) || position < 1) {
    return { error: "رقم الدرس لازم يكون عدداً صحيحاً أكبر من صفر." };
  }

  if (kind !== "lesson" && kind !== "review") return { error: "اختر النوع." };

  const { error } = await supabase
    .from("lessons")
    .insert({ chapter_id: chapterId, title, position, kind });

  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  return { ok: true };
}

export async function updateLessonAction(
  lessonId: string,
  title: string,
  position: number,
  kind: "lesson" | "review",
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lessons")
    .update({ title: title.trim(), position, kind })
    .eq("id", lessonId);

  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  revalidatePath(`/admin/content/${lessonId}`);
  return { ok: true };
}

export async function archiveLessonAction(lessonId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lessons")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", lessonId);

  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  return { ok: true };
}

export async function restoreLessonAction(lessonId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lessons")
    .update({ archived_at: null })
    .eq("id", lessonId);

  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  return { ok: true };
}

/* ==========================================================================
   الحذف النهائي
   ==========================================================================

   الأرشفة هي التصرف الافتراضي، والحذف استثناء لما أُنشئ بالخطأ.

   القيود هنا ليست تجميلاً: سلسلة الحذف المتتالي في قاعدة البيانات تمتد من
   الفصل إلى الدروس إلى الامتحانات إلى المحاولات إلى إجابات الطلاب. فحذف
   فصل واحد فيه محتوى يمحو درجات كل من حلّ تحته، بصمت وبلا رجعة.

   لذلك شرطان معاً، ويُفحصان على الخادم لا في الواجهة:
     • أن يكون العنصر مؤرشفاً — فالأرشفة خطوة أولى تمنح مهلة للتراجع
     • أن يكون فارغاً — فلا يُحذف شيء لم يقصد المدرّس حذفه
   وما لا يستوفيهما يُرفض برسالة تقول ما الذي يمنعه.
*/

export async function deleteChapterAction(chapterId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, archived_at")
    .eq("id", chapterId)
    .maybeSingle();

  if (!chapter) return { error: "الفصل ده مش موجود." };
  if (!chapter.archived_at) {
    return { error: "أرشِف الفصل الأول، وبعدين تقدر تحذفه نهائياً." };
  }

  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("chapter_id", chapterId);

  if ((count ?? 0) > 0) {
    return {
      error: `الفصل ده جواه ${count} درس. احذفهم الأول واحد واحد — كده تكون شايف بعينك كل حاجة بتتمسح.`,
    };
  }

  const { error } = await supabase.from("chapters").delete().eq("id", chapterId);
  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  return { ok: true };
}

export async function deleteLessonAction(lessonId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("id, archived_at")
    .eq("id", lessonId)
    .maybeSingle();

  if (!lesson) return { error: "الدرس ده مش موجود." };
  if (!lesson.archived_at) {
    return { error: "أرشِف الدرس الأول، وبعدين تقدر تحذفه نهائياً." };
  }

  const [files, exams] = await Promise.all([
    supabase
      .from("lesson_files")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", lessonId),
    supabase
      .from("exams")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", lessonId),
  ]);

  const nFiles = files.count ?? 0;
  const nExams = exams.count ?? 0;

  if (nFiles > 0 || nExams > 0) {
    const parts = [
      nFiles > 0 ? `${nFiles} ملف` : null,
      nExams > 0 ? `${nExams} تدريب أو امتحان` : null,
    ].filter(Boolean);

    return {
      error: `الدرس ده جواه ${parts.join(" و")}. الامتحانات بتتأرشف بس مش بتتمسح — لو الدرس غلط خالص سيبه مؤرشف.`,
    };
  }

  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) return { error: GENERIC };

  revalidatePath("/admin/content");
  return { ok: true };
}

/**
 * حذف ملف نهائياً: من التخزين ومن قاعدة البيانات معاً.
 *
 * الملفات وحدها التي يُتاح حذفها كاملةً لأن ما يضيع بضياعها نسخةٌ عندك
 * أصلاً، ولأن التخزين المجاني جيجابايت واحد فالملف المرفوع بالخطأ يأكل منه.
 * ويُحذف من التخزين أولاً حتى لا يبقى ملف يتيم يشغل مساحة بلا صف يدل عليه.
 */
export async function deleteFileAction(
  fileId: string,
  lessonId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: file } = await supabase
    .from("lesson_files")
    .select("id, storage_path, archived_at")
    .eq("id", fileId)
    .maybeSingle();

  if (!file) return { error: "الملف ده مش موجود." };
  if (!file.archived_at) {
    return { error: "أرشِف الملف الأول، وبعدين تقدر تحذفه نهائياً." };
  }

  const admin = createAdminClient();
  const { error: storageError } = await admin.storage
    .from("files")
    .remove([file.storage_path]);

  if (storageError) return { error: "تعذّر حذف الملف من التخزين. حاول تاني." };

  const { error } = await supabase.from("lesson_files").delete().eq("id", fileId);
  if (error) return { error: GENERIC };

  revalidatePath(`/admin/content/${lessonId}`);
  return { ok: true };
}

/* ==========================================================================
   الملفات
   ========================================================================== */

/** يجهّز إذن رفع لملف PDF واحد. الرفع نفسه يتم من المتصفح مباشرة للتخزين. */
export async function createFileUploadAction(
  lessonId: string,
): Promise<{ path?: string; token?: string; error?: string }> {
  await requireAdmin();

  const path = `lessons/${lessonId}/${crypto.randomUUID()}.pdf`;
  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from("files")
    .createSignedUploadUrl(path);

  if (error || !data) return { error: "تعذّر تجهيز الرفع. حاول تاني." };

  return { path: data.path, token: data.token };
}

/** يسجّل الملف في قاعدة البيانات بعد نجاح رفعه. */
export async function finalizeFileAction(input: {
  lessonId: string;
  storagePath: string;
  title: string;
  kind: "explanation" | "slides";
  sizeBytes: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const title = input.title.trim();
  if (title.length < 2) return { error: "اكتب عنوان الملف." };

  const { count } = await supabase
    .from("lesson_files")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", input.lessonId);

  const { error } = await supabase.from("lesson_files").insert({
    lesson_id: input.lessonId,
    title,
    kind: input.kind,
    storage_path: input.storagePath,
    size_bytes: input.sizeBytes,
    position: count ?? 0,
  });

  if (error) return { error: GENERIC };

  revalidatePath(`/admin/content/${input.lessonId}`);
  return { ok: true };
}

export async function archiveFileAction(
  fileId: string,
  lessonId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lesson_files")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", fileId);

  if (error) return { error: GENERIC };

  revalidatePath(`/admin/content/${lessonId}`);
  return { ok: true };
}

export async function restoreFileAction(
  fileId: string,
  lessonId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lesson_files")
    .update({ archived_at: null })
    .eq("id", fileId);

  if (error) return { error: GENERIC };

  revalidatePath(`/admin/content/${lessonId}`);
  return { ok: true };
}

export async function renameFileAction(
  fileId: string,
  lessonId: string,
  title: string,
  kind: "explanation" | "slides",
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("lesson_files")
    .update({ title: title.trim(), kind })
    .eq("id", fileId);

  if (error) return { error: GENERIC };

  revalidatePath(`/admin/content/${lessonId}`);
  return { ok: true };
}
