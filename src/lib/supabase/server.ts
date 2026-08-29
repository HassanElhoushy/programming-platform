import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * عميل السيرفر لمكوّنات الخادم وServer Actions وRoute Handlers.
 * يعمل بجلسة المستخدم نفسه، فتنطبق عليه سياسات RLS كاملةً.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // الكتابة على الكوكيز ممنوعة داخل Server Component.
            // تجديد الجلسة يحدث في proxy.ts، فتجاهل هذه الحالة آمن.
          }
        },
      },
    },
  );
}
