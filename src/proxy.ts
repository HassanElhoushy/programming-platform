import { NextResponse, type NextRequest, type ProxyConfig } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

/**
 * في Next.js 16 صار اسم هذا الملف proxy.ts بدلاً من middleware.ts.
 * الوظيفة هي نفسها: يعمل قبل كل طلب صفحة.
 *
 * مهمته هنا شيئان: تجديد جلسة Supabase (وهو ما يبقي الطالب مسجّلاً لشهور)،
 * وتحويل غير المسجّلين إلى صفحة الدخول. التحقق من الدور والصلاحيات ليس هنا
 * بل في layouts الخادم وفي RLS — الاعتماد على التحويل وحده ليس حماية.
 */

const PUBLIC_PATHS = ["/login", "/signup"];

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config: ProxyConfig = {
  matcher: [
    /*
     * كل المسارات عدا الملفات الساكنة والصور — لا داعي لتجديد جلسة
     * على طلب أيقونة.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
