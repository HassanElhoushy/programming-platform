import type { ReactNode } from "react";

import { Logo } from "@/components/logo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Logo className="size-9 text-[13px]" />
          <div>
            <h1 className="text-lg font-semibold text-ink">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="card px-5 py-6">{children}</div>

        {footer ? (
          <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}
