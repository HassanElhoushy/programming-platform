import Link from "next/link";
import { ChevronLeft, Users } from "lucide-react";

import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { UserStatus } from "@/lib/types";

export const metadata = { title: "الطلاب · لوحة المدرّس" };
export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "الكل" },
  { key: "pending", label: "بانتظار الموافقة" },
  { key: "active", label: "مفعّل" },
  { key: "blocked", label: "موقوف" },
] as const;

const STATUS_BADGE: Record<UserStatus, { tone: "ok" | "wait" | "bad"; label: string }> = {
  active: { tone: "ok", label: "مفعّل" },
  pending: { tone: "wait", label: "بانتظار الموافقة" },
  blocked: { tone: "bad", label: "موقوف" },
};

export default async function StudentsPage({
  searchParams,
}: PageProps<"/admin/students">) {
  const { filter } = await searchParams;
  const active = typeof filter === "string" ? filter : "all";

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, phone, status, full_access, created_at")
    .eq("role", "student")
    .order("created_at", { ascending: false });

  if (active !== "all") {
    query = query.eq("status", active);
  }

  const { data } = await query;
  const students = data ?? [];

  return (
    <>
      <PageHeader title="الطلاب" subtitle="الحسابات المسجّلة وصلاحياتها" />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-1">
          {FILTERS.map((option) => (
            <Link
              key={option.key}
              href={
                option.key === "all"
                  ? "/admin/students"
                  : `/admin/students?filter=${option.key}`
              }
              className={
                active === option.key
                  ? "rounded-[6px] bg-accent-bg px-3 py-1.5 text-sm font-medium text-accent"
                  : "rounded-[6px] px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
              }
            >
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title="مفيش طلبة في القائمة دي"
          hint="الطلبة بيسجّلوا بنفسهم من صفحة التسجيل، وبيظهروا هنا بانتظار موافقتك."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {students.map((student) => {
            const badge = STATUS_BADGE[student.status as UserStatus];

            return (
              <Link
                key={student.id}
                href={`/admin/students/${student.id}`}
                className="card card-hover flex items-center gap-3 px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {student.full_name}
                  </p>
                  <p dir="ltr" className="tnum mt-0.5 text-right text-xs text-ink-3">
                    {student.phone}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    {student.full_access ? (
                      <Badge tone="accent">كل الصلاحيات</Badge>
                    ) : null}
                    <span className="text-xs text-ink-3">
                      سجّل {formatDate(student.created_at)}
                    </span>
                  </div>
                </div>

                <ChevronLeft className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
