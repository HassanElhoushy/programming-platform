import { cn } from "@/lib/utils";

/** مربع بزوايا 6px بخلفية لون التمييز، بداخله الرمز `</>` بالأبيض. */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[6px] bg-accent",
        "size-7 text-[11px] font-medium tracking-tight text-white",
        className,
      )}
    >
      &lt;/&gt;
    </span>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Logo />
      <span className="text-[15px] font-semibold text-ink">منصة البرمجة</span>
    </span>
  );
}
