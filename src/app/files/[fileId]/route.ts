import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** جلسة واحدة: إعادة فتح نفس الملف خلال هذه المدة لا تُعدّ فتحة جديدة. */
const EVENT_GAP_MS = 30 * 60 * 1000;

/**
 * طلب تجهيز مسبق من المتصفح أو من Next — الطالب ما ضغطش. لا نسجّل ولا نحوّل
 * لملف، وإلا الصفحة اللي فيها أربعة روابط تحسب أربعة فتوحات.
 */
function isPrefetch(request: NextRequest): boolean {
  const purpose =
    request.headers.get("Purpose") ?? request.headers.get("Sec-Purpose") ?? "";
  if (purpose.toLowerCase().includes("prefetch")) return true;
  if (request.headers.get("Next-Router-Prefetch")) return true;
  if (request.headers.get("RSC") === "1") return true;
  return false;
}

/**
 * فتح أو تحميل ملف درس.
 *
 * التخزين مقفول تماماً: لا توجد أي سياسة تسمح للمتصفح بالوصول إليه، فالمسار
 * الوحيد هو هنا. والترتيب مقصود:
 *   1. من المستخدم؟
 *   2. هل يراه فعلاً؟ نسأل قاعدة البيانات بجلسته هو، فتجيب RLS. لا نتحقق
 *      من الصلاحية في الكود — نترك نفس الطبقة التي تحمي بقية المنصة تجيب.
 *   3. سجّل الحدث للمتابعة — ضغط حقيقي فقط، لا تجهيز الصفحة.
 *   4. أصدر رابطاً موقّعاً ينتهي بعد ساعة، وحوّل إليه.
 *
 * الرابط الموقّع قصير العمر، فمشاركته مع طالب آخر لا تفيده طويلاً، والأهم
 * أنه لا يُصدر أصلاً إلا بعد أن تقول RLS إن لهذا الطالب حق في هذا الملف.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ fileId: string }> },
) {
  const { fileId } = await ctx.params;

  const session = await getSessionUser();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPrefetch(request)) {
    return new NextResponse(null, { status: 204 });
  }

  const supabase = await createClient();
  const { data: file } = await supabase
    .from("lesson_files")
    .select("id, title, storage_path")
    .eq("id", fileId)
    .is("archived_at", null)
    .maybeSingle();

  if (!file) {
    return new NextResponse("لا يوجد ملف بهذا العنوان، أو ليس متاحاً لك.", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const admin = createAdminClient();

  if (session.profile.role === "student") {
    const action = download ? "download" : "view";
    const since = new Date(Date.now() - EVENT_GAP_MS).toISOString();
    const { data: recent } = await admin
      .from("file_events")
      .select("id")
      .eq("student_id", session.id)
      .eq("file_id", file.id)
      .eq("action", action)
      .gte("created_at", since)
      .limit(1);

    if (!recent?.length) {
      await admin.from("file_events").insert({
        student_id: session.id,
        file_id: file.id,
        action,
      });
    }
  }

  const { data: signed, error } = await admin.storage
    .from("files")
    .createSignedUrl(file.storage_path, 3600,
      download ? { download: `${file.title}.pdf` } : undefined);

  if (error || !signed) {
    return new NextResponse("تعذّر فتح الملف. حاول تاني بعد شوية.", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return NextResponse.redirect(signed.signedUrl);
}
