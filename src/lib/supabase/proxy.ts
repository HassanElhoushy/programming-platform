import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * تجديد جلسة المستخدم على كل طلب.
 *
 * هذه الدالة هي سبب بقاء الطالب مسجّلاً لشهور: نداء getUser() هنا يجبر
 * مكتبة Supabase على استخدام refresh token لتجديد access token قبل انتهائه،
 * ثم نكتب الكوكيز المحدَّثة على الـ response. لو لم يحدث هذا النداء **قبل**
 * إرجاع الـ response، لخرج الطالب من حسابه بمجرد انتهاء صلاحية التوكن.
 *
 * ترتيب الخطوات هنا حسّاس ولا يجوز العبث به:
 *   1. أنشئ response
 *   2. أنشئ العميل وهو يكتب الكوكيز على الـ request وعلى الـ response معاً
 *   3. await supabase.auth.getUser()
 *   4. أرجِع نفس الـ response
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
