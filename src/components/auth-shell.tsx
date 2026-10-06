import type { ReactNode } from "react";
import Link from "next/link";

import { Logo } from "@/components/logo";

const BRAND = "منصة البرمجة";

export function AuthShell({
  title,
  subtitle,
  quietTitle = false,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  quietTitle?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="flex flex-col items-center gap-3 text-ink"
            aria-label="الصفحة الرئيسية"
          >
            <Logo className="size-9 text-[13px]" />
            {title === BRAND ? (
              <h1 className="text-lg font-semibold">{title}</h1>
            ) : (
              <span className="text-lg font-semibold">{BRAND}</span>
            )}
          </Link>
          {title === BRAND ? (
            subtitle ? <p className="text-sm text-ink-2">{subtitle}</p> : null
          ) : (
            <div>
              <h1 className={quietTitle ? "text-sm text-ink-2" : "text-lg font-semibold text-ink"}>
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
              ) : null}
            </div>
          )}
        </div>

        <div className="card px-5 py-6">{children}</div>

        {footer ? (
          <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>
        ) : null}
      </div>
    </main>
  );
}
