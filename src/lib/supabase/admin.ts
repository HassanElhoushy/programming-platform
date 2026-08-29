import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import "server-only";

/**
 * عميل بالمفتاح السرّي. يتخطّى RLS بالكامل.
 *
 * لا يُستدعى إلا داخل كود يعمل على السيرفر وبعد التحقق من هوية المستخدم
 * وصلاحيته يدوياً. استخداماته المشروعة في هذا المشروع:
 *   • إنشاء الحسابات بدون تأكيد بريد
 *   • تصفير كلمة مرور طالب من لوحة المدرّس
 *   • إصدار روابط تخزين موقّعة بعد التحقق من الصلاحية
 *   • تسجيل أحداث فتح وتحميل الملفات
 */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new Error("SUPABASE_SECRET_KEY غير موجود في متغيرات البيئة");
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
