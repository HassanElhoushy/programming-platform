"use client";

import { useState, type ReactNode } from "react";
import { FileText, PlayCircle, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * نماذج ساكنة لشاشات المنصة الحقيقية. التبويبات وحدها قابلة للنقر.
 * المحتوى aria-hidden حتى لا يقرأه قارئ الشاشة كواجهة حقيقية.
 */

const TABS = [
  { id: "dashboard", label: "الداشبورد" },
  { id: "lesson", label: "الدرس" },
  { id: "review", label: "تفسير إجابة" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function LandingPreview() {
  const [tab, setTab] = useState<TabId>("dashboard");
  const current = TABS.find((item) => item.id === tab) ?? TABS[0];

  return (
    <div>
      <div
        role="tablist"
        aria-label="شاشات من المنصة"
        className="on-band mb-3 hidden justify-center gap-1 sm:flex"
      >
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-[6px] px-3 py-1.5 text-sm transition-colors duration-150",
                selected
                  ? "bg-band-ink font-medium text-band"
                  : "text-band-ink-2 hover:text-band-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* على الموبايل: لوحة فاتحة من غير تبويبات، عشان النص الغامق ما يقعدش على الشريط */}
      <div className="rounded-[10px] bg-page px-4 py-4 sm:hidden">
        <MockFrame>
          <DashboardMock />
        </MockFrame>
      </div>

      <div className="card hidden overflow-hidden sm:block">
        <div className="border-b-[0.5px] border-line bg-surface px-4 py-2.5">
          <p className="text-xs text-ink-3">{current.label}</p>
        </div>
        <div className="bg-page px-4 py-4">
          <MockFrame>
            {tab === "dashboard" ? <DashboardMock /> : null}
            {tab === "lesson" ? <LessonMock /> : null}
            {tab === "review" ? <ReviewMock /> : null}
          </MockFrame>
        </div>
      </div>
    </div>
  );
}

function MockFrame({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="pointer-events-none select-none">
      {children}
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-base font-semibold text-ink">أهلاً أحمد</p>

      <div className="card flex items-center gap-3 px-4 py-3.5">
        <PlayCircle className="size-5 shrink-0 text-ink-3" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">تدريب الدرس الثاني</p>
            <span className="badge badge-wait">لسه ما اتسلّمش</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-3">
            بدأت ده وما سلّمتوش. إجاباتك محفوظة زي ما سبتها.
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium text-accent">أكمل</span>
      </div>

      <div className="card flex items-center gap-3 px-4 py-3.5">
        <Sparkles className="size-5 shrink-0 text-ink-3" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">امتحان الدرس الأول</p>
            <span className="badge badge-ok">تم التصحيح</span>
          </div>
          <p className="tnum mt-0.5 text-xs text-ink-3">درجتك 8 من 10 · فيه تصحيح جديد لسه ما شفتوش</p>
        </div>
        <span className="shrink-0 text-sm font-medium text-accent">اطّلع</span>
      </div>

      <div className="card grid grid-cols-2 divide-x-[0.5px] divide-line rtl:divide-x-reverse">
        <div className="px-4 py-3.5">
          <p className="text-xs text-ink-2">حليتها</p>
          <p className="tnum mt-0.5 text-lg font-semibold text-ink">6</p>
        </div>
        <div className="px-4 py-3.5">
          <p className="text-xs text-ink-2">متوسط درجاتك</p>
          <p className="tnum mt-0.5 text-lg font-semibold text-ink">82%</p>
        </div>
      </div>

      <p className="mb-0.5 mt-2 text-xs font-medium text-ink-2">متاح لك دلوقتي</p>
      <div className="card px-4 py-3">
        <p className="text-xs text-ink-3">الفصل الأول · الدرس الثالث</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink">تدريب الدرس</p>
          <span className="shrink-0 text-sm font-medium text-accent">ابدأ</span>
        </div>
      </div>
      <div className="card px-4 py-3">
        <p className="text-xs text-ink-3">الفصل الثاني · الدرس الأول</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink">امتحان الدرس</p>
          <span className="shrink-0 text-sm font-medium text-accent">ابدأ</span>
        </div>
      </div>
    </div>
  );
}

function LessonMock() {
  return (
    <div>
      <p className="text-xs text-ink-3">الفصل الأول</p>
      <p className="mt-1 text-base font-semibold text-ink">الدرس الثاني</p>

      <p className="mb-2 mt-4 text-xs font-medium text-ink-2">الملفات</p>
      <div className="card flex items-center gap-3 px-4 py-3">
        <FileText className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
        <p className="min-w-0 flex-1 text-sm text-ink">شرح الدرس</p>
      </div>

      <p className="mb-2 mt-4 text-xs font-medium text-ink-2">الأسئلة</p>
      <div className="flex flex-col gap-2">
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-3">الفصل الأول · الدرس الثاني</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">تدريب الدرس</p>
            <span className="shrink-0 text-sm font-medium text-accent">ابدأ</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="badge badge-muted">تدريب</span>
            <span className="badge badge-muted">15 دقيقة</span>
          </div>
        </div>
        <div className="card px-4 py-3">
          <p className="text-xs text-ink-3">الفصل الأول · الدرس الثاني</p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">امتحان الدرس</p>
            <span className="badge badge-ok">تم التصحيح</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="badge badge-muted">امتحان</span>
            <span className="badge badge-muted">20 دقيقة</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const CHOICES = [
  { letter: "أ", body: "المتغير", picked: true, right: false },
  { letter: "ب", body: "الحلقة التكرارية", picked: false, right: true },
  { letter: "ج", body: "الشرط", picked: false, right: false },
  { letter: "د", body: "الدالة", picked: false, right: false },
];

function ReviewMock() {
  return (
    <div className="card px-4 py-4">
      <p className="text-sm font-medium leading-relaxed text-ink">
        أي مما يلي يُستخدم لتكرار مجموعة من الأوامر عدداً محدداً من المرات؟
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {CHOICES.map((choice) => (
          <div
            key={choice.letter}
            className={cn(
              "flex items-start gap-3 rounded-[6px] border-[0.5px] px-3 py-2.5",
              choice.right
                ? "border-ok/30 bg-ok-bg"
                : choice.picked
                  ? "border-bad/30 bg-bad-bg"
                  : "border-line",
            )}
          >
            <span className="mt-px shrink-0 text-sm font-medium text-ink-3">{choice.letter}</span>
            <span className="flex-1 text-sm leading-relaxed text-ink">{choice.body}</span>
            {choice.picked ? <span className="badge badge-bad">اختيارك</span> : null}
            {choice.right ? <span className="badge badge-ok">الصحيحة</span> : null}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-[6px] border-[0.5px] border-accent-line bg-accent-bg px-3 py-2.5">
        <p className="text-xs font-medium text-accent">تفسير</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">
          الحلقة التكرارية بتنفّذ نفس الأوامر أكتر من مرة. الشرط بيختار مساراً واحداً، والمتغير بيخزّن قيمة.
        </p>
      </div>
    </div>
  );
}
