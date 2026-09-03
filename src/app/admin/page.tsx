import Link from "next/link";
import { ChevronLeft, HardDrive } from "lucide-react";

import { PageHeader } from "@/components/ui/primitives";
import { formatFileSize } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  readStorageUsage,
  TEACHER_BLOCK_PCT,
  WARN_PCT,
} from "@/lib/storage-quota";

export const metadata = { title: "لوحة المدرّس · منصة البرمجة" };
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const supabase = await createClient();

  const [usage, [pendingRes, ungradedRes, openExamsRes, activeRes]] = await Promise.all([
    readStorageUsage(),
    Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .eq("status", "pending"),
    supabase
      .from("exam_attempts")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted")
      .is("voided_at", null),
    supabase
      .from("exams")
      .select("id", { count: "exact", head: true })
      .eq("is_open", true)
      .is("archived_at", null),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student")
      .eq("status", "active"),
    ]),
  ]);

  const cards = [
    {
      href: "/admin/students?filter=pending" as const,
      label: "حسابات بانتظار الموافقة",
      value: pendingRes.count ?? 0,
      hint: "طلبة سجّلوا ولسه ما اتفتحلهمش المحتوى",
    },
    {
      href: "/admin/grading" as const,
      label: "تسليمات محتاجة تصحيح",
      value: ungradedRes.count ?? 0,
      hint: "امتحانات فيها أسئلة مقالية لسه ما اتصححتش",
    },
    {
      href: "/admin/content" as const,
      label: "امتحانات مفتوحة",
      value: openExamsRes.count ?? 0,
      hint: "الطلبة يقدروا يبدأوا فيها دلوقتي",
    },
    {
      href: "/admin/students" as const,
      label: "طلبة مفعّلين",
      value: activeRes.count ?? 0,
      hint: "حسابات شغالة على المنصة",
    },
  ];

  return (
    <>
      <PageHeader title="نظرة عامة" subtitle="اللي محتاج منك دلوقتي" />

      {/*
        تحذير المساحة بيظهر بدري عمداً، وقت ما لسه فيه متسع للتصرّف.
        الحجب الفعلي بيحصل في السيرفر وقت الرفع، وده تنبيه بس.
      */}
      {usage && usage.pct >= WARN_PCT ? (
        <div className="card mb-3 flex items-start gap-3 px-4 py-3.5">
          <HardDrive className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              مساحة التخزين وصلت{" "}
              <span className="tnum">{usage.pct}%</span>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              {formatFileSize(usage.usedBytes)} من{" "}
              {formatFileSize(usage.limitBytes)}.{" "}
              {usage.pct >= TEACHER_BLOCK_PCT
                ? "رفع الملفات متوقف دلوقتي عشان نسيب مكان لصور إجابات الطلبة."
                : `عند ${TEACHER_BLOCK_PCT}% هيتوقف رفع الملفات عشان نسيب مكان لصور إجابات الطلبة.`}{" "}
              امسح ملفات مؤرشفة مش محتاجها من صفحات الدروس.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="card card-hover flex items-start justify-between gap-3 px-4 py-4"
          >
            <div>
              <p className="text-sm text-ink-2">{card.label}</p>
              <p className="tnum mt-1 text-2xl font-semibold text-ink">{card.value}</p>
              <p className="mt-1 text-xs text-ink-3">{card.hint}</p>
            </div>
            <ChevronLeft className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
          </Link>
        ))}
      </div>
    </>
  );
}
