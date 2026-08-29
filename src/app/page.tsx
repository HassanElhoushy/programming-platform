import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

/** نقطة الدخول: توجّه كل مستخدم إلى مكانه حسب دوره وحالته. */
export default async function RootPage() {
  const session = await getSessionUser();

  if (!session) redirect("/login");
  if (session.profile.role === "admin") redirect("/admin");
  if (session.profile.status !== "active") redirect("/pending");

  redirect("/dashboard");
}
