import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/* --------------------------------------------------------------------------
   عناصر مشتركة صغيرة. القواعد المطبّقة هنا:
   حدود 0.5px بدل الظلال، ألوان الحالة في الشارات فقط، ومسافات سخية.
-------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  hover,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={cn("card", hover && "card-hover", className)}>{children}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-ink-2">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-ink-2">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
}) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Icon className="size-6 text-ink-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-ink-3">{hint}</p> : null}
    </div>
  );
}

type BadgeTone = "ok" | "wait" | "bad" | "accent" | "muted";

export function Badge({
  tone = "muted",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("badge", `badge-${tone}`, className)}>{children}</span>
  );
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="badge badge-bad w-full justify-start px-3 py-2 text-[13px] leading-relaxed">
      {children}
    </p>
  );
}

export function FormNote({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="badge badge-ok w-full justify-start px-3 py-2 text-[13px] leading-relaxed">
      {children}
    </p>
  );
}

/** صف بيانات "المسمّى: القيمة" بالتنسيق المتكرر في صفحات التفاصيل */
export function DataRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="tnum text-sm font-medium text-ink">{children}</span>
    </div>
  );
}
