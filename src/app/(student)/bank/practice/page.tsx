import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { BankRunner, type BankQuestion } from "./bank-runner";
import { QueryError } from "@/components/ui/primitives";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { UiLocale } from "@/lib/format";
import { tierRank } from "@/lib/types";

export async function generateMetadata() {
  const session = await requireStudent();
  return {
    title: session.profile.track === "en" ? "Practice · Question bank" : "تدريب · بنك الأسئلة",
  };
}
export const dynamic = "force-dynamic";

/** أقصى ما تحمله الجلسة الواحدة. أطول من ذلك يُرهق ولا يُذاكَر. */
const SESSION_SIZE = 25;

/**
 * حالة الطالب في سؤال، كما تصنعها 23_bank_levels.sql:
 *
 *   لا صف        ما شافوش
 *   wrong        محتاج شغل — أخطأ ولم يصلحه بعد
 *   correct      مثبَّت
 *   correct+     محتاج مراجعة — كان مثبَّتاً ثم أخطأ فيه
 */
interface Progress {
  state: string;
  forgot: boolean;
  updated_at: string;
}

export default async function BankPracticePage({
  searchParams,
}: PageProps<"/bank/practice">) {
  const params = await searchParams;
  const sessionUser = await requireStudent();
  const locale: UiLocale = sessionUser.profile.track === "en" ? "en" : "ar";
  const examParam = typeof params.exam === "string" ? params.exam : null;
  const chapterParam = typeof params.chapter === "string" ? params.chapter : null;
  const review = params.mode === "review";

  /*
   * الدروس المختارة من صفحة الفلتر. الفلتر يرسم الشجرة الموجودة في قاعدة
   * البيانات كما هي، فمراجعة ختام الفصل تصل هنا كدرس مثل أي درس، ومراجعة
   * الترم تصل كدرسٍ في حاوية المراجعات — بلا حالة خاصة في هذا الملف.
   */
  const lessonParam =
    typeof params.lessons === "string"
      ? params.lessons.split(",").filter(Boolean)
      : null;

  const supabase = await createClient();

  /*
   * البنوك المتاحة فعلاً. RLS تتكفّل بالصلاحية، والفلتر هنا للنطاق الذي
   * اختاره الطالب لا للحماية.
   */
  let banksQuery = supabase
    .from("exams")
    .select("id, title, lesson_id, lessons(chapter_id, position, title)")
    .eq("kind", "bank")
    .eq("is_open", true)
    .is("archived_at", null);

  if (examParam) banksQuery = banksQuery.eq("id", examParam);
  if (lessonParam) banksQuery = banksQuery.in("lesson_id", lessonParam);

  const { data: bankRows, error: banksError } = await banksQuery;
  if (banksError) return <QueryError message={banksError.message} locale={locale} />;

  const banks = (bankRows ?? []).filter((b) => {
    if (!chapterParam) return true;
    const lesson = b.lessons as unknown as { chapter_id: string } | null;
    return lesson?.chapter_id === chapterParam;
  });

  const bankIds = banks.map((b) => b.id);

  if (bankIds.length === 0) {
    return <NothingHere review={review} locale={locale} />;
  }

  /*
   * الاختيارات لا تُجلب مع الأسئلة. صلاحية كل صف اختيار تستدعي دالة على
   * الامتحان، وجلب كل اختيارات المسار (آلاف الصفوف) كان يعلّق الصفحة ثم
   * يسقط الطلب، فتظهر «مفيش أسئلة» وبنك الدرس فيه أسئلة. نجلب أسئلة
   * النطاق أولاً، ثم اختيارات الجلسة وحدها بعد قصّها.
   */
  const [questionsRes, progressRes] = await Promise.all([
    supabase
      .from("questions")
      .select("id, exam_id, type, body, points, blank_count, tier, position")
      .in("exam_id", bankIds)
      .neq("type", "essay")
      .order("position"),
    supabase
      .from("bank_progress")
      .select("question_id, state, forgot, updated_at"),
  ]);

  if (questionsRes.error) return <QueryError message={questionsRes.error.message} locale={locale} />;
  if (progressRes.error) return <QueryError message={progressRes.error.message} locale={locale} />;

  const progressOf = new Map<string, Progress>(
    (progressRes.data ?? []).map((p) => [
      p.question_id,
      { state: p.state as string, forgot: !!p.forgot, updated_at: p.updated_at },
    ]),
  );

  const titleOf = new Map(banks.map((b) => [b.id, b.title]));

  const all = (questionsRes.data ?? []).map((q) => {
    const progress = progressOf.get(q.id);
    return {
      id: q.id,
      exam_id: q.exam_id,
      type: q.type,
      body: q.body,
      points: Number(q.points),
      blank_count: q.blank_count,
      tier: q.tier as string | null,
      bank_title: titleOf.get(q.exam_id) ?? "",
      options: [] as { id: string; body: string; role: "item" | "choice" }[],
      state: progress?.state ?? null,
      forgot: progress?.forgot ?? false,
      seen_at: progress?.updated_at ?? null,
      position: q.position as number,
    };
  });

  const ordered = review ? reviewOrder(all) : workOrder(all);
  const session = ordered.slice(0, SESSION_SIZE);

  if (session.length === 0) return <NothingHere review={review} locale={locale} />;

  const optionsRes = await supabase
    .from("question_options")
    .select("id, question_id, position, body, role")
    .in(
      "question_id",
      session.map((q) => q.id),
    )
    .order("position");

  if (optionsRes.error) return <QueryError message={optionsRes.error.message} locale={locale} />;

  const optionsByQuestion = new Map<
    string,
    { id: string; body: string; role: "item" | "choice" }[]
  >();
  for (const option of optionsRes.data ?? []) {
    const list = optionsByQuestion.get(option.question_id) ?? [];
    list.push({
      id: option.id,
      body: option.body,
      role: option.role === "item" ? "item" : "choice",
    });
    optionsByQuestion.set(option.question_id, list);
  }
  for (const question of session) {
    question.options = optionsByQuestion.get(question.id) ?? [];
  }

  /*
   * "جلسة تانية" لازم ترجع بالنطاق نفسه. بدون هذا كان من يتدرّب على فصل
   * واحد يجد نفسه في المنهج كله بعد خمسة وعشرين سؤالاً.
   */
  const scope = new URLSearchParams();
  if (examParam) scope.set("exam", examParam);
  if (chapterParam) scope.set("chapter", chapterParam);
  if (lessonParam) scope.set("lessons", lessonParam.join(","));
  if (review) scope.set("mode", "review");
  const query = scope.toString();

  return (
    <>
      <Link
        href="/bank"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4 ltr:rotate-180" strokeWidth={1.5} />
        {locale === "en" ? "Question bank" : "بنك الأسئلة"}
      </Link>

      <BankRunner
        questions={session}
        remaining={ordered.length - session.length}
        review={review}
        nextHref={query ? `/bank/practice?${query}` : "/bank/practice"}
        locale={locale}
      />
    </>
  );
}

/* ==========================================================================
   ترتيب الجلسة
   ========================================================================== */

type Sortable = BankQuestion & {
  exam_id: string;
  seen_at: string | null;
  position: number;
};

/**
 * الجلسة العادية: الغلط، ثم ما نُسي، ثم ما لم يُرَ، ثم ما أُتقِن.
 *
 * الغلط أولاً لأنه أرخص ما يمكن إصلاحه. والمنسيّ قبل الجديد لأن استعادة
 * ما كان معروفاً أقصر من تعلّم ما لم يُعرَف. والمتقَن آخراً ولا يُفرَض:
 * يظهر لمن لم يبق أمامه غيره وحده.
 *
 * ولا يعود السؤال الخاطئ في الجلسة نفسها: أن نسأله بعد ثانيتين من رؤية
 * الإجابة قياسٌ لذاكرة ثانيتين لا للفهم. يعود أول الجلسة القادمة.
 */
function workOrder<T extends Sortable>(items: T[]): T[] {
  const buckets: T[][] = [[], [], [], []];

  for (const q of items) {
    if (q.state === "wrong") buckets[0].push(q);
    else if (q.forgot) buckets[1].push(q);
    else if (q.state === null) buckets[2].push(q);
    else buckets[3].push(q);
  }

  // داخل كل رتبة: صعود من التعريف إلى التطبيق إلى التفريق
  return buckets.flatMap((bucket) =>
    spreadByLesson(
      bucket.sort(
        (a, b) => tierRank(a.tier) - tierRank(b.tier) || a.position - b.position,
      ),
    ),
  );
}

/**
 * جلسة المراجعة: ما أتقنه الطالب، من فوق لا من تحت.
 *
 * تبدأ بالتفريق ثم التطبيق ثم التعريف — عكس الجلسة العادية. من قدر على
 * أسئلة التفريق فهو فاهم ولا يحتاج أن يعيد التعريفات، فيقفل بعد قليل
 * ويمضي؛ ومن وقع فيها ينزل إلى ما تحتها. وهذا ما يجعل مراجعة درسٍ بعد
 * ستة أشهر عشرة أسئلة لا اثنين وعشرين.
 *
 * وجوه كل مستوى: الأقدم أولاً. ما جاوبه في سبتمبر قبل ما جاوبه أمس، فيصير
 * التباعد سلوكاً طبيعياً بلا نظام تكرار متباعد ولا جدول جديد.
 */
function reviewOrder<T extends Sortable>(items: T[]): T[] {
  const mastered = items.filter((q) => q.state === "correct");

  const [forgotten, rest] = [
    mastered.filter((q) => q.forgot),
    mastered.filter((q) => !q.forgot),
  ];

  const byTierThenAge = (a: T, b: T) =>
    tierRank(b.tier) - tierRank(a.tier) ||
    (a.seen_at ?? "").localeCompare(b.seen_at ?? "");

  return [forgotten, rest].flatMap((bucket) =>
    spreadByLesson(bucket.sort(byTierThenAge)),
  );
}

/**
 * توزيع الجلسة على الدروس المختارة بالتناوب.
 *
 * بدونه يأكل الدرس الأول الخمسة والعشرين كلها، فمن اختار فصلاً بستة دروس
 * أخذ جلسة في درس واحد وظنّ أنه راجع الفصل. التناوب يجعل نصيب كل درس
 * متناسباً مع ما بقي فيه بلا حساب نسب.
 */
function spreadByLesson<T extends { exam_id: string }>(items: T[]): T[] {
  const queues = new Map<string, T[]>();
  for (const item of items) {
    const queue = queues.get(item.exam_id) ?? [];
    queue.push(item);
    queues.set(item.exam_id, queue);
  }

  if (queues.size < 2) return items;

  const lists = [...queues.values()];
  const out: T[] = [];
  let moved = true;

  while (moved) {
    moved = false;
    for (const list of lists) {
      const next = list.shift();
      if (next) {
        out.push(next);
        moved = true;
      }
    }
  }

  return out;
}

function NothingHere({ review, locale = "ar" }: { review: boolean; locale?: UiLocale }) {
  const en = locale === "en";
  return (
    <>
      <Link
        href="/bank"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4 ltr:rotate-180" strokeWidth={1.5} />
        {en ? "Question bank" : "بنك الأسئلة"}
      </Link>
      <p className="card px-4 py-8 text-center text-sm leading-relaxed text-ink-3">
        {review
          ? en
            ? "Nothing in this range has been solved yet. Solve the questions first, then come back to review them."
            : "مفيش حاجة اتحلت في النطاق ده تراجعها. حلّ الأسئلة الأول وبعدين ارجع راجعها."
          : en
            ? "There are no questions in this range."
            : "مفيش أسئلة في النطاق ده."}
      </p>
    </>
  );
}
