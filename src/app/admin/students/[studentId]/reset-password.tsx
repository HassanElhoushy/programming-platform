"use client";

import { useState, useTransition } from "react";
import { KeyRound, Loader2 } from "lucide-react";

import { resetStudentPasswordAction } from "@/app/actions/admin-students";

/**
 * لا يوجد "نسيت كلمة المرور" للطلبة لأننا لا نستخدم تأكيد البريد أصلاً،
 * فهذه هي طريقة الاسترجاع الوحيدة: تولّد كلمة جديدة وتبعتها للطالب بنفسك.
 */
export function ResetPassword({ studentId }: { studentId: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function generate() {
    const digits = Math.floor(100000 + Math.random() * 900000);
    setPassword(`code${digits}`);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await resetStudentPasswordAction(studentId, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(password);
      setPassword("");
      setOpen(false);
    });
  }

  if (done) {
    return (
      <div>
        <p className="text-sm text-ink-2">كلمة المرور الجديدة — ابعتها للطالب:</p>
        <p
          dir="ltr"
          className="mt-2 rounded-[6px] border-[0.5px] border-line bg-page px-3 py-2 text-right font-mono text-sm text-ink"
        >
          {done}
        </p>
        <button
          type="button"
          className="btn btn-ghost mt-2 text-xs"
          onClick={() => setDone(null)}
        >
          تمام، اخفيها
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setOpen(true);
          generate();
        }}
      >
        <KeyRound className="size-4" strokeWidth={1.5} />
        غيّر كلمة المرور
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="label" htmlFor="new-password">
          كلمة المرور الجديدة
        </label>
        <input
          id="new-password"
          type="text"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input text-right font-mono"
        />
        <button type="button" className="btn btn-ghost mt-1 text-xs" onClick={generate}>
          ولّد واحدة تانية
        </button>
      </div>

      {error ? (
        <p className="badge badge-bad w-full justify-start px-3 py-2">{error}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={pending || password.length < 8}
        >
          {pending ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} /> : null}
          احفظ
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
