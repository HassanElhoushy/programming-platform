/**
 * التسمية والتنسيق العربي المستخدم في كل المنصة.
 *
 * قاعدة ثابتة: نكتب دائماً "الفصل الأول · الدرس الثاني" ولا نكتب "1-2".
 */

const ORDINALS = [
  "",
  "الأول",
  "الثاني",
  "الثالث",
  "الرابع",
  "الخامس",
  "السادس",
  "السابع",
  "الثامن",
  "التاسع",
  "العاشر",
  "الحادي عشر",
  "الثاني عشر",
  "الثالث عشر",
  "الرابع عشر",
  "الخامس عشر",
  "السادس عشر",
  "السابع عشر",
  "الثامن عشر",
  "التاسع عشر",
  "العشرون",
];

export function ordinal(n: number): string {
  return ORDINALS[n] ?? `رقم ${n}`;
}

/**
 * "الفصل الأول" أو "مراجعة شاملة".
 *
 * حاوية المراجعات العابرة للفصول لا تأخذ رقماً: ترتيبها بين الفصول لا
 * معنى له، وهي أختٌ لها لا واحدةٌ منها.
 */
export function chapterName(position: number, kind: string = "chapter"): string {
  return kind === "review" ? "مراجعة شاملة" : `الفصل ${ordinal(position)}`;
}

/**
 * "الدرس الثاني" أو "مراجعة الفصل".
 *
 * المراجعة تسكن الهيكل كدرس لأن كل ملف وامتحان يحتاج درساً يحويه، لكنها
 * ليست درساً خامساً بل ختام الفصل — فالترقيم يبقى داخلياً للترتيب، والكلمة
 * وحدها تتبع النوع.
 */
export function lessonName(position: number, kind: string = "lesson"): string {
  return kind === "review" ? "مراجعة الفصل" : `الدرس ${ordinal(position)}`;
}

/** "الفصل الأول · الدرس الثاني" أو "الفصل الأول · مراجعة الفصل" */
export function lessonPath(
  chapterPosition: number,
  lessonPosition: number,
  lessonKind: string = "lesson",
  chapterKind: string = "chapter",
): string {
  // داخل حاوية المراجعات لا رقم فصل ولا رقم درس — العنوان وحده يكفي،
  // و"مراجعة شاملة · مراجعة الفصل" تكرار بلا فائدة.
  if (chapterKind === "review") return chapterName(0, "review");
  return `${chapterName(chapterPosition)} · ${lessonName(lessonPosition, lessonKind)}`;
}

export const CHAPTER_KIND_LABELS: Record<string, string> = {
  chapter: "فصل",
  review: "مراجعة شاملة",
};

export const LESSON_KIND_LABELS: Record<string, string> = {
  lesson: "درس",
  review: "مراجعة",
};

/*
 * المنطقة الزمنية مثبّتة على القاهرة عمداً: بدونها يُنسّق الخادم التاريخ
 * بتوقيت UTC ويُنسّقه المتصفح بتوقيت الجهاز، فيختلف النصّان ويشتكي React
 * من عدم تطابق الـ hydration.
 */
const DATE_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: "Africa/Cairo",
  year: "numeric",
  month: "long",
  day: "numeric",
};

const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTS,
  hour: "numeric",
  minute: "2-digit",
};

const LOCALE = "ar-EG-u-nu-latn";

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, DATE_OPTS).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, DATETIME_OPTS).format(new Date(value));
}

/** "٢٣ دقيقة و ١٢ ثانية" بصيغة مختصرة مناسبة للجداول */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds} ثانية`;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  if (mins < 60) {
    return secs === 0 ? `${mins} دقيقة` : `${mins} دقيقة و ${secs} ثانية`;
  }

  const hours = Math.floor(mins / 60);
  const restMins = mins % 60;
  return restMins === 0 ? `${hours} ساعة` : `${hours} ساعة و ${restMins} دقيقة`;
}

/** عدّاد الحل: mm:ss أو h:mm:ss */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** يحذف الأصفار العشرية غير المفيدة: 7.50 -> "7.5" و 7.00 -> "7" */
export function formatPoints(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return String(Math.round(n * 100) / 100);
}

export function formatScore(
  earned: number | null | undefined,
  total: number | null | undefined,
): string {
  if (earned == null || total == null) return "—";
  return `${formatPoints(earned)} من ${formatPoints(total)}`;
}

export function percentage(
  earned: number | null | undefined,
  total: number | null | undefined,
): string {
  if (earned == null || !total) return "—";
  return `${Math.round((Number(earned) / Number(total)) * 100)}%`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

/*
 * المسمّيات العربية. الدوال تقبل string لأن الحقول العائدة من Supabase بلا
 * أنواع مولّدة، فتصل كسلاسل عامة؛ والبحث الآمن أوضح من نثر التحويلات
 * في كل موضع استدعاء.
 */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq_single: "اختيار من متعدد",
  mcq_multi: "اختر كل ما ينطبق",
  true_false: "صح أو خطأ",
  fill_blank: "إكمال فراغات",
  essay: "سؤال مقالي",
  matching: "توصيل",
  ordering: "ترتيب",
  classification: "تصنيف",
};

export const EXAM_KIND_LABELS: Record<string, string> = {
  practice: "تدريب",
  exam: "امتحان",
  bank: "بنك أسئلة",
};

/** نكرة: "تدريب" أو "امتحان" */
export function kindNoun(kind: string): string {
  return EXAM_KIND_LABELS[kind] ?? "تدريب";
}

/**
 * معرفة: "التدريب" أو "الامتحان".
 * تُستخدم في الجمل الموجّهة للطالب — "ابدأ الامتحان"، "أسئلة التدريب" —
 * فتتبع الكلمة نوع العنصر بدل كلمة واحدة تخيف في موضع وتُضلّل في آخر.
 */
export function kindDefinite(kind: string): string {
  return `ال${kindNoun(kind)}`;
}

export const EXAM_LEVEL_LABELS: Record<string, string> = {
  basic: "أساسي",
  advanced: "متقدم",
};

export const FILE_KIND_LABELS: Record<string, string> = {
  explanation: "شرح",
  slides: "سلايدز",
};
