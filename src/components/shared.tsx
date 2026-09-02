import Link from "next/link";
import { FileText, Presentation, ChevronLeft, Download } from "lucide-react";

import { Badge } from "@/components/ui/primitives";
import {
  EXAM_KIND_LABELS,
  EXAM_LEVEL_LABELS,
  FILE_KIND_LABELS,
  formatDate,
  lessonPath,
} from "@/lib/format";
import type { ExamKind, ExamLevel, FileKind } from "@/lib/types";

/** "الفصل الأول · الدرس الثاني" بالتنسيق الخافت الموحّد */
export function LessonCrumb({
  chapterPosition,
  lessonPosition,
  lessonKind = "lesson",
  chapterKind = "chapter",
  lessonTitle,
  className,
}: {
  chapterPosition: number;
  lessonPosition: number;
  lessonKind?: string;
  chapterKind?: string;
  lessonTitle?: string;
  className?: string;
}) {
  return (
    <p className={className ?? "text-xs text-ink-3"}>
      {lessonPath(chapterPosition, lessonPosition, lessonKind, chapterKind)}
      {lessonTitle ? ` · ${lessonTitle}` : null}
    </p>
  );
}

export function LevelBadge({ level }: { level: ExamLevel }) {
  return <Badge tone="muted">{EXAM_LEVEL_LABELS[level]}</Badge>;
}

/**
 * تدريب أم امتحان — أول شارة على الكارت.
 * الطالب لازم يعرف ده قبل ما يفتح، لأن المحاولة واحدة لا تتكرر.
 */
export function KindBadge({ kind }: { kind: ExamKind }) {
  return (
    <Badge tone={kind === "exam" ? "wait" : "accent"}>
      {EXAM_KIND_LABELS[kind]}
    </Badge>
  );
}

/** صف ملف بعنوانه ونوعه، يفتح عبر مسار موقّع على السيرفر */
export function FileRow({
  id,
  title,
  kind,
  createdAt,
  crumb,
}: {
  id: string;
  title: string;
  kind: FileKind;
  createdAt?: string;
  crumb?: {
    chapterPosition: number;
    lessonPosition: number;
    lessonKind?: string;
    chapterKind?: string;
  };
}) {
  const Icon = kind === "slides" ? Presentation : FileText;

  return (
    <div className="card card-hover flex items-center gap-1 pl-2 pr-4">
      <Link
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
              ? `${lessonPath(crumb.chapterPosition, crumb.lessonPosition, crumb.lessonKind, crumb.chapterKind)} · `
              : ""}
            {FILE_KIND_LABELS[kind]}
            {createdAt ? ` · ${formatDate(createdAt)}` : ""}
          </p>
        </div>
      </Link>

      <a
        href={`/files/${id}?download=1`}
        className="btn btn-ghost shrink-0 px-2"
        aria-label={`تحميل ${title}`}
        title="تحميل"
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
          />
          <p className="mt-1 text-sm font-medium text-ink">{title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <KindBadge kind={kind} />
            <LevelBadge level={level} />
            <Badge tone="muted">
              {durationMinutes ? `${durationMinutes} دقيقة` : "بدون وقت محدد"}
            </Badge>
            {right}
          </div>
        </div>

        {cta ? (
          <span className="shrink-0 text-sm font-medium text-accent">{cta}</span>
        ) : (
          <ChevronLeft className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
        )}
      </div>
    </Link>
  );
}
