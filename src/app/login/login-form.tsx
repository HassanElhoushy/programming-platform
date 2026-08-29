"use client";

import { useActionState } from "react";

import { signInAction, type FormState } from "@/app/actions/auth";
import { FormError } from "@/components/ui/primitives";

const INITIAL: FormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, INITIAL);

  return (
    <form action={action} className="flex flex-col gap-4">
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
          autoComplete="current-password"
          required
          className="input"
        />
      </div>

      <FormError>{state.error}</FormError>

      <button type="submit" className="btn btn-primary mt-1" disabled={pending}>
        {pending ? "جارٍ الدخول…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}
