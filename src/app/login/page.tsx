import Link from "next/link";

import { AuthShell } from "@/components/auth-shell";
import { LandingField } from "@/app/landing-field";

import { LoginForm } from "./login-form";

export const metadata = { title: "تسجيل الدخول · منصة البرمجة" };

export default function LoginPage() {
  return (
    <div className="relative min-h-dvh">
      <LandingField tone="light" />
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
    </div>
  );
}
