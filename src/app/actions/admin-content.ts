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
