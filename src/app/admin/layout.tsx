import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "نظرة عامة" },
  // صفحة الامتحان تُفتح من داخل الدرس، فتبقى "المحتوى" هي التبويب النشط فيها
  { href: "/admin/content", label: "المحتوى", alsoUnder: ["/admin/exams"] },
  { href: "/admin/grading", label: "التصحيح" },
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
