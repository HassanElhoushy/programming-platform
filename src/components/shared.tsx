import Link from "next/link";
import { FileText, Presentation, ChevronLeft, Download } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import {
  examKindLabel,
  examLevelLabel,
  fileKindLabel,
  formatDate,
  lessonPath,
  type UiLocale,
} from "@/lib/format";
import type { ExamKind, ExamLevel, FileKind } from "@/lib/types";

/** "الفصل الأول · الدرس الثاني" بالتنسيق الخافت الموحّد */
export function LessonCrumb({
  chapterPosition,
  lessonPosition,
  lessonKind = "lesson",
  chapterKind = "chapter",
  lessonTitle,
  locale = "ar",
  className,
}: {
  chapterPosition: number;
  lessonPosition: number;
  lessonKind?: string;
  chapterKind?: string;
  lessonTitle?: string;
  locale?: UiLocale;
  className?: string;
}) {
  return (
    <p className={className ?? "text-xs text-ink-3"}>
      {lessonPath(chapterPosition, lessonPosition, lessonKind, chapterKind, locale)}
      {lessonTitle ? ` · ${lessonTitle}` : null}
    </p>
  );
}

export function LevelBadge({ level, locale = "ar" }: { level: ExamLevel; locale?: UiLocale }) {
  return <Badge tone="muted">{examLevelLabel(level, locale)}</Badge>;
}

/**
 * تدريب أم امتحان — أول شارة على الكارت.
 * الطالب لازم يعرف ده قبل ما يفتح، لأن المحاولة واحدة لا تتكرر.
 */
export function KindBadge({ kind, locale = "ar" }: { kind: ExamKind; locale?: UiLocale }) {
  return (
    <Badge tone={kind === "exam" ? "wait" : "accent"}>
      {examKindLabel(kind, locale)}
    </Badge>
  );
}

/**
 * صف ملف بعنوانه ونوعه، يفتح عبر مسار موقّع على السيرفر.
 *
 * `<a>` عمداً لا `Link`: المسار يحوّل إلى تخزين خارجي ويسجّل الفتح، و`Link`
 * كان يجهّز الرابط قبل الضغط فيُحسب فتحاً كل مرة تظهر الصفحة.
 */
export function FileRow({
  id,
  title,
  kind,
  createdAt,
  crumb,
  locale = "ar",
}: {
  id: string;
  title: string;
  kind: FileKind;
  createdAt?: string;
  locale?: UiLocale;
  crumb?: {
    chapterPosition: number;
    lessonPosition: number;
    lessonKind?: string;
    chapterKind?: string;
  };
}) {
  const Icon = kind === "slides" ? Presentation : FileText;

  return (
    <div className="card card-hover flex items-center gap-1 pe-2 ps-4">
      <a
        href={`/files/${id}`}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3 py-3"
      >
        <Icon className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          <p className="mt-0.5 truncate text-xs text-ink-3">
            {crumb
              ? `${lessonPath(crumb.chapterPosition, crumb.lessonPosition, crumb.lessonKind, crumb.chapterKind, locale)} · `
              : ""}
            {fileKindLabel(kind, locale)}
            {createdAt ? ` · ${formatDate(createdAt, locale)}` : ""}
          </p>
        </div>
      </a>

      <a
        href={`/files/${id}?download=1`}
        className="btn btn-ghost shrink-0 px-2"
        aria-label={locale === "en" ? `Download ${title}` : `تحميل ${title}`}
        title={locale === "en" ? "Download" : "تحميل"}
      >
        <Download className="size-4" strokeWidth={1.5} />
      </a>
    </div>
  );
}

/** كارت امتحان في قوائم الطالب */
export function ExamCard({
  href,
  title,
  level,
  kind,
  durationMinutes,
  chapterPosition,
  lessonPosition,
  lessonKind = "lesson",
  chapterKind = "chapter",
  right,
  cta,
  locale = "ar",
}: {
  href: string;
  title: string;
  level: ExamLevel;
  kind: ExamKind;
  durationMinutes: number | null;
  chapterPosition: number;
  lessonPosition: number;
  lessonKind?: string;
  chapterKind?: string;
  right?: React.ReactNode;
  cta?: string;
  locale?: UiLocale;
}) {
  return (
    <Link href={href} className="card card-hover block px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <LessonCrumb
            chapterPosition={chapterPosition}
            lessonPosition={lessonPosition}
            lessonKind={lessonKind}
            chapterKind={chapterKind}
            locale={locale}
          />
          <p className="mt-1 text-sm font-medium text-ink">{title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <KindBadge kind={kind} locale={locale} />
            <LevelBadge level={level} locale={locale} />
            {kind !== "bank" ? (
              <Badge tone="muted">
                {durationMinutes
                  ? locale === "en"
                    ? `${durationMinutes} min`
                    : `${durationMinutes} دقيقة`
                  : locale === "en"
                    ? "No time limit"
                    : "بدون وقت محدد"}
              </Badge>
            ) : null}
            {right}
          </div>
        </div>

        {cta ? (
          <span className="shrink-0 text-sm font-medium text-accent">{cta}</span>
        ) : (
          <ChevronLeft className="size-4 shrink-0 text-ink-3 ltr:rotate-180" strokeWidth={1.5} />
        )}
      </div>
    </Link>
  );
}
