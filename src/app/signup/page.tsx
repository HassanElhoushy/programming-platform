import Link from "next/link";

import { LandingField } from "@/app/landing-field";
import { AuthShell } from "@/components/auth-shell";

import { SignupForm } from "./signup-form";

export const metadata = { title: "حساب جديد · منصة البرمجة" };

export default function SignupPage() {
  return (
    <div className="relative min-h-dvh">
      <LandingField tone="light" />
      <AuthShell
        title="حساب جديد"
        subtitle="بعد التسجيل هيراجع المدرّس حسابك ويفتح لك المحتوى"
        footer={
          <>
            عندك حساب بالفعل؟{" "}
            <Link href="/login" className="font-medium text-accent underline-offset-4 hover:underline">
              سجّل الدخول
            </Link>
          </>
        }
      >
      <SignupForm />
    </AuthShell>
    </div>
  );
}
