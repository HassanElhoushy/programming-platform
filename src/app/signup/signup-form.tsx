"use client";

import { useActionState } from "react";

import { signUpAction, type FormState } from "@/app/actions/auth";
import { FormError } from "@/components/ui/primitives";

const INITIAL: FormState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signUpAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="full_name">
          الاسم الكامل
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          minLength={3}
          maxLength={80}
          className="input"
          placeholder="مثال: أحمد محمود علي"
        />
      </div>

      <div>
        <label className="label" htmlFor="phone">
          رقم الموبايل
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          required
          pattern="01[0125][0-9]{8}"
          dir="ltr"
          className="input text-right"
          placeholder="01012345678"
        />
        <p className="mt-1.5 text-xs text-ink-3">11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015</p>
      </div>

      <div>
        <label className="label" htmlFor="email">
          البريد الإلكتروني
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          required
          className="input text-right"
          placeholder="name@example.com"
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          كلمة المرور
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="input"
        />
        <p className="mt-1.5 text-xs text-ink-3">8 حروف أو أرقام على الأقل</p>
      </div>

      <FormError>{state.error}</FormError>

      <button type="submit" className="btn btn-primary mt-1" disabled={pending}>
        {pending ? "جارٍ إنشاء الحساب…" : "إنشاء الحساب"}
      </button>
    </form>
  );
}
