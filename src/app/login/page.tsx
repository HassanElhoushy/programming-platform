import Link from "next/link";

import { LoginForm } from "./login-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata = { title: "تسجيل الدخول · منصة البرمجة" };

export default function LoginPage() {
  return (
    <AuthShell
      title="منصة البرمجة"
      subtitle="سجّل دخولك للمتابعة"
      footer={
        <>
          ماعندكش حساب؟{" "}
          <Link href="/signup" className="font-medium text-accent underline-offset-4 hover:underline">
            سجّل حساب جديد
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthShell>
  );
}
