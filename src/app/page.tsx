import { redirect } from "next/navigation";

import { getSessionUser, hasOrphanSession } from "@/lib/auth";

import { Landing } from "./landing";

export const metadata = {
  title: "منصة البرمجة والذكاء الاصطناعي",
  description:
    "منصة مذاكرة وحل لمادة البرمجة والذكاء الاصطناعي، الصف الثاني الثانوي. مسار عربي ومسار لغات.",
};

/** نقطة الدخول: الزائر يرى التعريف، ومن له جلسة يذهب إلى مكانه من غير تسجيل خروج. */
export default async function RootPage() {
  const session = await getSessionUser();

  if (!session) {
    // جلسة قائمة بلا ملف مستخدم — /pending تشرح الحالة وتوقف حلقة التحويل
    if (await hasOrphanSession()) redirect("/pending");
    return <Landing />;
  }

  if (session.profile.role === "admin") redirect("/admin");
  if (session.profile.status !== "active") redirect("/pending");

  redirect("/dashboard");
}
