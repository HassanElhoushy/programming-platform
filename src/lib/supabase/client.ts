import { createBrowserClient } from "@supabase/ssr";

/**
 * عميل المتصفح. المفتاح هنا عام بطبيعته ويظهر في الـ bundle — الحماية كلها
 * في سياسات RLS على قاعدة البيانات، لا في إخفاء هذا المفتاح.
 *
 * createBrowserClient يستخدم singleton داخلياً، فالنداء المتكرر آمن.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    },
  );
}
