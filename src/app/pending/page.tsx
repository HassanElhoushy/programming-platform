import { redirect } from "next/navigation";
import { Clock, Ban } from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "بانتظار الموافقة · منصة البرمجة" };

export default async function PendingPage() {
  const session = await getSessionUser();

  if (!session) redirect("/login");
  if (session.profile.role === "admin") redirect("/admin");
  if (session.profile.status === "active") redirect("/dashboard");

  const blocked = session.profile.status === "blocked";
  const Icon = blocked ? Ban : Clock;

  return (
    <AuthShell title={blocked ? "الحساب موقوف" : "حسابك بانتظار الموافقة"}>
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <Icon className="size-6 text-ink-3" strokeWidth={1.5} />

        <p className="text-sm leading-relaxed text-ink-2">
          {blocked ? (
            <>
              حسابك موقوف حالياً. كلّم المدرّس لو تفتكر إن فيه خطأ.
            </>
          ) : (
            <>
              أهلاً {session.profile.full_name.split(" ")[0]}. اتعمل حسابك بنجاح
              والمدرّس هيراجعه ويفتح لك المحتوى. سجّل دخولك تاني بعد شوية
              وهتلاقي دروسك وامتحاناتك ظاهرة.
            </>
          )}
        </p>

        <form action={signOutAction} className="w-full">
          <button type="submit" className="btn btn-secondary w-full">
            تسجيل الخروج
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
