import { AppShell } from "@/components/app-shell";
import { requireStudent } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "الرئيسية" },
  { href: "/content", label: "المحتوى" },
  { href: "/exams", label: "الأسئلة" },
  { href: "/results", label: "النتائج" },
];

export default async function StudentLayout({ children }: LayoutProps<"/">) {
  const session = await requireStudent();

  return (
    <AppShell items={NAV} userName={session.profile.full_name} homeHref="/dashboard">
      {children}
    </AppShell>
  );
}
