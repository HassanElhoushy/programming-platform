import { redirect } from "next/navigation";

import { getSessionUser, hasOrphanSession } from "@/lib/auth";

/** نقطة الدخول: توجّه كل مستخدم إلى مكانه حسب دوره وحالته. */
export default async function RootPage() {
  const session = await getSessionUser();

  if (!session) {
    // جلسة قائمة بلا ملف مستخدم — /pending تشرح الحالة وتوقف حلقة التحويل
    redirect((await hasOrphanSession()) ? "/pending" : "/login");
  }

  if (session.profile.role === "admin") redirect("/admin");
  if (session.profile.status !== "active") redirect("/pending");

  redirect("/dashboard");
}
