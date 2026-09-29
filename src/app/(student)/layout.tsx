import { AppShell } from "@/components/app-shell";
import { requireStudent } from "@/lib/auth";
import type { UiLocale } from "@/lib/format";

const NAV: Record<UiLocale, { href: string; label: string }[]> = {
  ar: [
    { href: "/dashboard", label: "الرئيسية" },
    { href: "/content", label: "المحتوى" },
    { href: "/bank", label: "بنك الأسئلة" },
    { href: "/results", label: "النتائج" },
  ],
  en: [
    { href: "/dashboard", label: "Home" },
    { href: "/content", label: "Content" },
    { href: "/bank", label: "Question bank" },
    { href: "/results", label: "Results" },
  ],
};

export default async function StudentLayout({ children }: LayoutProps<"/">) {
  const session = await requireStudent();
  const locale: UiLocale = session.profile.track === "en" ? "en" : "ar";

  return (
    <div lang={locale === "en" ? "en" : "ar"} dir={locale === "en" ? "ltr" : "rtl"} className="min-h-dvh">
      <AppShell
        items={NAV[locale]}
        userName={session.profile.full_name}
        homeHref="/dashboard"
        wordmark={locale === "en" ? "Programming" : "منصة البرمجة"}
        signOutLabel={locale === "en" ? "Sign out" : "تسجيل الخروج"}
        navLabel={locale === "en" ? "Main" : "التنقل الرئيسي"}
      >
        {children}
      </AppShell>
    </div>
  );
}
