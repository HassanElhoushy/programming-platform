import { cn } from "@/lib/utils";

/**
 * مربع بزوايا 6px بداخله الرمز `</>`.
 * `invert` لشريط صفحة الزائر الغامق فقط. الافتراضي `ink` حتى لا تتغير الشاشات القائمة.
 */
export function Logo({
  className,
  tone = "ink",
}: {
  className?: string;
  tone?: "ink" | "invert";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[6px]",
        "size-7 text-[11px] font-medium tracking-tight text-white",
        tone === "invert" ? "bg-white/10" : "bg-accent",
        className,
      )}
    >
      &lt;/&gt;
    </span>
  );
}

export function LogoWordmark({
  className,
  label = "منصة البرمجة",
  tone = "ink",
}: {
  className?: string;
  label?: string;
  tone?: "ink" | "invert";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo tone={tone} />
      <span
        className={cn(
          "text-[15px] font-semibold",
          tone === "invert" ? "text-band-ink" : "text-ink",
        )}
      >
        {label}
      </span>
    </span>
  );
}
