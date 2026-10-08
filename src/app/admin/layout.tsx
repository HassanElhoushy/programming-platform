import { AppShell } from "@/components/app-shell";
import { MotionBackdrop } from "@/components/motion-backdrop";
import { requireAdmin } from "@/lib/auth";
import { motionBackgroundEnabled } from "@/lib/motion-background";

const NAV = [
  { href: "/admin", label: "نظرة عامة" },
  // صفحة الامتحان تُفتح من داخل الدرس، فتبقى "المحتوى" هي التبويب النشط فيها
  { href: "/admin/content", label: "المحتوى", alsoUnder: ["/admin/exams"] },
  { href: "/admin/bank", label: "بنك الأسئلة" },
  { href: "/admin/grading", label: "التصحيح" },
  { href: "/admin/students", label: "الطلاب" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await requireAdmin();
  const motion = await motionBackgroundEnabled();

  return (
    <div className="relative min-h-dvh">
      <MotionBackdrop enabled={motion} />
      <AppShell items={NAV} userName={session.profile.full_name} homeHref="/admin">
        {children}
      </AppShell>
    </div>
  );
}
