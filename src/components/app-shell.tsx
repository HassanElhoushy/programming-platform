import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/actions/auth";
import { LogoWordmark } from "@/components/logo";
import { Nav, type NavItem } from "@/components/nav";

export function AppShell({
  items,
  userName,
  homeHref,
  children,
}: {
  items: NavItem[];
  userName: string;
  homeHref: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b-[0.5px] border-line bg-page/95 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            <Link href={homeHref} className="shrink-0">
              <LogoWordmark />
            </Link>

            <div className="flex items-center gap-1">
              <span className="hidden max-w-40 truncate text-sm text-ink-2 sm:block">
                {userName}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="btn btn-ghost px-2"
                  aria-label="تسجيل الخروج"
                  title="تسجيل الخروج"
                >
                  <LogOut className="size-4" strokeWidth={1.5} />
                </button>
              </form>
            </div>
          </div>

          <div className="pb-1.5">
            <Nav items={items} />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
