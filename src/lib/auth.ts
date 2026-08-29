import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface SessionUser {
  id: string;
  email: string | null;
  profile: Profile;
}

/**
 * المستخدم الحالي مع ملفه. مغلّفة بـ cache() فلا تتكرر الاستعلامات
 * عندما ينادي أكثر من مكوّن في نفس الطلب.
 *
 * نستخدم getUser() لا getSession(): الأولى تتحقق من التوكن مع خادم Auth،
 * والثانية تكتفي بما في الكوكي وهو مصدر غير موثوق للتفويض.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return { id: user.id, email: user.email ?? null, profile: profile as Profile };
});

/** يضمن أن المستخدم طالب مفعّل، وإلا حوّله للمكان المناسب. */
export async function requireStudent(): Promise<SessionUser> {
  const session = await getSessionUser();

  if (!session) redirect("/login");
  if (session.profile.role === "admin") redirect("/admin");
  if (session.profile.status !== "active") redirect("/pending");

  return session;
}

/** يضمن أن المستخدم هو المدرّس. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSessionUser();

  if (!session) redirect("/login");
  if (session.profile.role !== "admin" || session.profile.status !== "active") {
    redirect("/");
  }

  return session;
}

/** يضمن وجود جلسة فقط، بلا شرط على الدور. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  return session;
}
