import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * حارس مساحة التخزين.
 *
 * الباقة المجانية 1 جيجا. لما تخلص، Supabase بيرفض الرفع برسالة إنجليزية
 * غامضة وسط امتحان. الحارس ده بيوقف الرفع قبلها بهامش، برسالة عربية واضحة
 * وبديل عملي.
 *
 * ترتيب الحجب مقصود: المدرّس يتحجب قبل الطالب.
 *
 *   - المدرّس بيرفع ملف درس في وقت هادي، عنده بديل (يمسح المؤرشف) ويقدر
 *     يستنى. فبنوقفه بدري عند 85% عشان نسيب هامش للطلبة.
 *   - الطالب بيصوّر ورقته وسط امتحان بمؤقّت شغال. تسليمه مش بيستنى. فبناخد
 *     منه آخر 10% كاملة، ولما نوقفه بنقوله يكتب بالكيبورد — وده بديل حقيقي
 *     بيخليه يسلّم من غير ما يخسر حاجة.
 *
 * الرفع كله بيعدّي من دوال السيرفر اللي بتصدر إذن الرفع، والتخزين نفسه
 * مقفول بلا أي سياسة RLS. يعني الحارس ده مش إخفاء واجهة — من غير التوكن
 * اللي بيطلع من هنا مفيش رفع أصلاً.
 */

export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

/** يبدأ التحذير في لوحة المدرّس. */
export const WARN_PCT = 70;
/** يتوقف رفع ملفات المدرّس. */
export const TEACHER_BLOCK_PCT = 85;
/** يتوقف رفع صور الإجابات — آخر خط، وله بديل بالكيبورد. */
export const STUDENT_BLOCK_PCT = 95;

export interface StorageUsage {
  usedBytes: number;
  limitBytes: number;
  pct: number;
}

/**
 * يقرأ المستهلك الحالي. بيرجّع null لو القياس نفسه فشل.
 *
 * الاستدعاء بمفتاح السيرفر لأن storage.objects مش مكشوف للعميل.
 */
export async function readStorageUsage(): Promise<StorageUsage | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("storage_usage");

  if (error || !data) return null;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    usedBytes: Number(row.used_bytes),
    limitBytes: Number(row.limit_bytes) || STORAGE_LIMIT_BYTES,
    pct: Number(row.pct),
  };
}

/**
 * بيقرر لو الرفع مسموح عند العتبة دي.
 *
 * قرار مهم: لو القياس نفسه فشل بنسمح بالرفع.
 *
 * العدّاد اللي بايظ ميعرقلش طالب بيسلّم. أسوأ ما يحصل لو سمحنا خطأً إن
 * Supabase يرفض الرفع بنفسه — نفس النتيجة اللي كانت هتحصل من غير الحارس
 * أصلاً. لكن لو حجبنا خطأً بسبب عطل في القياس، بنكون إحنا اللي منعنا طالب
 * من التسليم. الخطأ الأول يتصلّح، والتاني لأ.
 */
export async function checkStorageRoom(
  blockAtPct: number,
): Promise<{ allowed: true } | { allowed: false; usage: StorageUsage }> {
  const usage = await readStorageUsage();

  if (!usage) return { allowed: true };
  if (usage.pct < blockAtPct) return { allowed: true };

  return { allowed: false, usage };
}
