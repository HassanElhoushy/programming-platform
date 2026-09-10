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

const AUTH_PAGES = ["/login", "/signup"];
const PUBLIC_PATHS = ["/login", "/signup", "/icon", "/apple-icon"];

function matchesPath(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = matchesPath(pathname, PUBLIC_PATHS);
  const isAuthPage = matchesPath(pathname, AUTH_PAGES);

  // #region agent log
  if (
    pathname === "/icon" ||
    pathname.startsWith("/icon/") ||
    pathname === "/apple-icon" ||
    pathname.startsWith("/apple-icon/")
  ) {
    fetch("http://127.0.0.1:7488/ingest/7364cfdd-9ab8-40c6-a8cc-c4b17f786867", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "2f25a8",
      },
      body: JSON.stringify({
        sessionId: "2f25a8",
        hypothesisId: "A",
        location: "src/proxy.ts:icon",
        message: "icon request through proxy",
        data: { pathname, hasUser: Boolean(user), isPublic, isAuthPage },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  if (!user && !isPublic && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && isAuthPage) {
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
    "/((?!_next/static|_next/image|favicon.ico|icon(?:/|$)|apple-icon(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
