import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "نظرة عامة" },
  { href: "/admin/content", label: "المحتوى" },
  { href: "/admin/grading", label: "تصحيح الامتحانات" },
  { href: "/admin/students", label: "الطلاب" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();

  return (
    <AppShell items={NAV} userName={session.profile.full_name} homeHref="/admin">
      {children}
    </AppShell>
  );
}
