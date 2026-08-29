import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const TEXT = { "content-type": "text/plain; charset=utf-8" };

/**
 * عرض صورة إجابة مقالية.
 *
 * الإذن يُستمد من صف المحاولة نفسه: نقرأه بجلسة المستخدم، فترد RLS بصفّ
 * إن كانت المحاولة له أو كان هو المدرّس، وبلا شيء فيما عدا ذلك. ومسار الصورة
 * مشتق حسابياً من صاحب المحاولة ورقمها ورقم السؤال، فلا يستطيع أحد أن يطلب
 * صورة زميله بتغيير باراميتر في الرابط.
 */
export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const attemptId = request.nextUrl.searchParams.get("attempt");
  const questionId = request.nextUrl.searchParams.get("question");

  if (!attemptId || !questionId) {
    return new NextResponse("طلب غير مكتمل.", { status: 400, headers: TEXT });
  }

  const supabase = await createClient();
  const { data: attempt } = await supabase
    .from("exam_attempts")
    .select("id, student_id")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt) {
    return new NextResponse("غير متاح.", { status: 404, headers: TEXT });
  }

  const path = `${attempt.student_id}/${attempt.id}/${questionId}.jpg`;
  const admin = createAdminClient();

  const { data: signed, error } = await admin.storage
    .from("answers")
    .createSignedUrl(path, 3600);

  if (error || !signed) {
    return new NextResponse("مفيش صورة مرفوعة للسؤال ده.", {
      status: 404,
      headers: TEXT,
    });
  }

  return NextResponse.redirect(signed.signedUrl);
}
