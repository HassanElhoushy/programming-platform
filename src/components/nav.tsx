"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  /** مسارات إضافية يُعدّ هذا التبويب نشطاً داخلها، لصفحات لا تقع تحت href */
  alsoUnder?: string[];
}

function covers(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * التبويب النشط هو صاحب أطول مسار مطابق، لا أول مطابقة.
 *
 * بدون ذلك يبتلع "/admin" كلَّ ما تحته: تقف في /admin/content فيضيء
 * "نظرة عامة" لأن مساره بادئة لكل مسارات اللوحة.
 */
function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: { href: string; depth: number } | null = null;

  for (const item of items) {
    for (const prefix of [item.href, ...(item.alsoUnder ?? [])]) {
      if (!covers(pathname, prefix)) continue;
      if (!best || prefix.length > best.depth) {
        best = { href: item.href, depth: prefix.length };
      }
    }
  }

  return best?.href ?? null;
}

export function Nav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const current = activeHref(pathname, items);

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max items-center gap-1">
        {items.map((item) => {
          const active = item.href === current;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-[6px] px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-accent-bg font-medium text-accent"
                    : "text-ink-2 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
