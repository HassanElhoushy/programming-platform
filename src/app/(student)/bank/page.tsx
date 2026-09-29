import Link from "next/link";
import { ChevronLeft, Layers } from "lucide-react";

import { EmptyState, PageHeader, QueryError } from "@/components/ui/primitives";
import { bankChapterHint, bankChapterName, bankLessonTitle, lessonName, reviewScope, type UiLocale } from "@/lib/format";
import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata() {
  const session = await requireStudent();
  return {
    title: session.profile.track === "en" ? "Question bank · Programming" : "بنك الأسئلة · منصة البرمجة",
  };
}
export const dynamic = "force-dynamic";

interface BankRow {
  id: string;
  title: string;
  lessons: {
    position: number;
    title: string;
    kind: string;
    chapters: { id: string; position: number; title: string; kind: string } | null;
  } | null;
}

interface Counts {
  total: number;
  mastered: number;
  todo: number;
  forgot: number;
}

const ZERO: Counts = { total: 0, mastered: 0, todo: 0, forgot: 0 };

function add(a: Counts, b: Counts): Counts {
  return {
    total: a.total + b.total,
    mastered: a.mastered + b.mastered,
    todo: a.todo + b.todo,
    forgot: a.forgot + b.forgot,
  };
}

function bankLabel(bank: BankRow, locale: UiLocale): { title: string; blurb: string | null } {
  const lesson = bank.lessons;
  const en = locale === "en";
  if (!lesson) return { title: bank.title, blurb: null };
  if (lesson.chapters?.kind === "review") {
    return {
      title: bankLessonTitle(lesson.title, locale),
      blurb: reviewScope(lesson.position, locale),
    };
  }
  if (lesson.kind === "review") {
    return {
      title: en ? "Chapter questions" : "أسئلة الفصل",
      blurb: en
        ? "Questions that mix this chapter's lessons. Not a new lesson, so you can tell the earlier ones apart."
        : "أسئلة تخلط دروس الفصل مع بعض — مش درس جديد، عشان تفرّق بين اللي فات",
    };
  }
  return {
    title: `${lessonName(lesson.position, lesson.kind, locale)} · ${lesson.title}`,
    blurb: null,
  };
}

/**
 * خانة الخلط فوق دروس الفصل. جواها البنوك الظاهرة للطالب فقط —
 * RLS والصلاحية — فلا نقول «من أول درس لآخر الفصل» وهو فاتح درسين.
 */
function mixScope(banks: BankRow[], chapterKind: string, locale: UiLocale): string {
  const en = locale === "en";
  if (chapterKind === "review") return en ? "The mixed questions in front of you" : "الأسئلة الشاملة اللي قدامك";

  const n = banks.filter((b) => b.lessons?.kind !== "review").length;
  const hasReview = banks.some((b) => b.lessons?.kind === "review");
  const lessonsWord = en
    ? n === 1
      ? "1 lesson"
      : `${n} lessons`
    : n === 1
      ? "درس"
      : n === 2
        ? "درسان"
        : `${n} دروس`;

  if (en) {
    if (hasReview && n === 0) return "The chapter questions in front of you";
    if (hasReview) return `${lessonsWord} and the chapter questions in front of you`;
    if (n === 2) return "The two lessons in front of you";
    return `${lessonsWord} in front of you`;
  }

  if (hasReview && n === 0) return "أسئلة الفصل اللي قدامك";
  if (hasReview) return `${lessonsWord} وأسئلة الفصل اللي قدامك`;
  if (n === 2) return "الدرسان اللي قدامك";
  return `${lessonsWord} اللي قدامك`;
}

/**
 * بنك الأسئلة.
 *
 * ليس امتحاناً: بلا مؤقّت ولا تسليم ولا درجة تُسجَّل. الطالب يجيب فيعرف
 * فوراً ويرى الصحيح وسببه، ثم يمضي.
 *
 * الصفحة تفتح على "اللي محتاج شغل" لا على قائمة الفصول، لأن أكثر ما يحتاجه
 * من فتحها أن يبدأ لا أن يختار. ومن لم يبق عليه شيء لا يُقال له "خلّصت"
 * ويُترك: يُعرَض عليه أن يراجع، فالمراجعة هي ما جاء من أجله.
 */
export default async function BankPage() {
  const session = await requireStudent();
  const locale: UiLocale = session.profile.track === "en" ? "en" : "ar";
  const en = locale === "en";
  const supabase = await createClient();

  const [banksRes, progressRes] = await Promise.all([
    supabase
      .from("exams")
      .select(
        "id, title, lessons(position, title, kind, chapters(id, position, title, kind))",
      )
      .eq("kind", "bank")
      .eq("is_open", true)
      .is("archived_at", null),
    supabase.from("bank_progress").select("question_id, state, forgot"),
  ]);

  if (banksRes.error) return <QueryError message={banksRes.error.message} locale={locale} />;
  if (progressRes.error) return <QueryError message={progressRes.error.message} locale={locale} />;

  const banks = (banksRes.data ?? []) as unknown as BankRow[];

  if (banks.length === 0) {
    return (
      <>
        <PageHeader
          title={en ? "Question bank" : "بنك الأسئلة"}
          subtitle={en ? "Practice every kind of question" : "تدرّب على كل أنواع الأسئلة"}
        />
        <EmptyState
          icon={Layers}
          title={en ? "No questions are open for you right now" : "مفيش أسئلة متاحة لك دلوقتي"}
          hint={
            en
              ? "When your teacher opens a question bank, you will find it here."
              : "أول ما المدرّس يفتح لك بنك أسئلة هتلاقيه هنا."
          }
        />
      </>
    );
  }

  /* عدد أسئلة كل بنك، وحالة الطالب في كل سؤال */
  const bankIds = banks.map((b) => b.id);
  const questionsRes = await supabase
    .from("questions")
    .select("id, exam_id")
    .in("exam_id", bankIds);

  if (questionsRes.error) return <QueryError message={questionsRes.error.message} locale={locale} />;

  const progressOf = new Map(
    (progressRes.data ?? []).map((p) => [
      p.question_id,
      { state: p.state as string, forgot: !!p.forgot },
    ]),
  );

  const perBank = new Map<string, Counts>();
  let all = ZERO;

  for (const q of questionsRes.data ?? []) {
    const entry = perBank.get(q.exam_id) ?? { ...ZERO };
    const progress = progressOf.get(q.id);

    entry.total += 1;
    if (progress?.state === "correct") {
      entry.mastered += 1;
      if (progress.forgot) entry.forgot += 1;
    } else {
      entry.todo += 1;
    }

    perBank.set(q.exam_id, entry);
    all = add(all, {
      total: 1,
      mastered: progress?.state === "correct" ? 1 : 0,
      todo: progress?.state === "correct" ? 0 : 1,
      forgot: progress?.forgot ? 1 : 0,
    });
  }

  /* تجميع حسب الفصل — هو وحدة التنقّل الطبيعية عند الطالب */
  const byChapter = new Map<
    string,
    { position: number; title: string; kind: string; banks: BankRow[] }
  >();

  for (const bank of banks) {
    const chapter = bank.lessons?.chapters;
    if (!chapter) continue;
    const entry = byChapter.get(chapter.id) ?? {
      position: chapter.position,
      title: chapter.title,
      kind: chapter.kind,
      banks: [],
    };
    entry.banks.push(bank);
    entry.banks.sort(
      (a, b) => (a.lessons?.position ?? 0) - (b.lessons?.position ?? 0),
    );
    byChapter.set(chapter.id, entry);
  }

  const chapters = [...byChapter.entries()].sort(
    (a, b) => a[1].position - b[1].position,
  );

  return (
    <>
      <PageHeader
        title={en ? "Question bank" : "بنك الأسئلة"}
        subtitle={
          en
            ? "Practice at your own pace. No timer and no grade, and a wrong answer is explained."
            : "تدرّب براحتك — مفيش وقت ولا درجة، والغلط هنا بيتشرح"
        }
      />

      {/*
        المدخل الأساسي: يبدأ من الغلط ثم مما لم يره. الطالب الذي يفتح البنك
        يريد أن يحلّ، فلا نجعل أول ما يواجهه اختياراً.
      */}
      {all.todo > 0 ? (
        <Link
          href="/bank/practice"
          className="card card-hover mb-3 flex items-center gap-3 px-4 py-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{en ? "Start practicing" : "ابدأ حل"}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              {en ? (
                <>
                  These are the bank questions you have not solved yet:{" "}
                  <span className="tnum">{all.todo}</span>. You either missed them or have not seen them. Come in here to practice, not to review something you already finished.
                </>
              ) : (
                <>
                  دي كل أسئلة البنك اللي لسه ما حليتهاش:{" "}
                  <span className="tnum">{all.todo}</span> سؤال — إمّا غلطت فيهم
                  وإمّا ما شفتهمش. ادخل هنا وأنت بتحل، مش وأنت بتراجع حاجة خلّصتها.
                </>
              )}
            </p>
          </div>
          <ChevronLeft className="size-4 shrink-0 text-ink-3 ltr:rotate-180" strokeWidth={1.5} />
        </Link>
      ) : (
        <div className="card mb-3 px-4 py-4">
          <p className="text-sm font-medium text-ink">
            {en ? "You have solved every bank question" : "حليت كل أسئلة البنك"}
          </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              {en
                ? "What is left is to review what you solved, from the box below. There are no new questions here."
                : "اللي فاضل تراجع اللي اتحل من الخانة اللي تحت — مش هتلاقي هنا أسئلة جديدة."}
            </p>
        </div>
      )}

      <Link
        href="/bank/select"
        className={
          all.mastered > 0
            ? "card card-hover mb-3 flex items-center gap-3 px-4 py-3.5"
            : "card card-hover mb-6 flex items-center gap-3 px-4 py-3.5"
        }
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">{en ? "Choose the lessons yourself" : "اختار دروسك بنفسك"}</p>
          <p className="mt-0.5 text-xs text-ink-3">
            {en
              ? "What is still unsolved: a lesson, two chapters, or the mixed questions."
              : "اللي لسه ما اتحلتش: درس، أو فصلين، أو أسئلة الخلط."}
          </p>
        </div>
        <ChevronLeft className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
      </Link>

      {/*
        المراجعة ليست جائزةً لمن خلّص: من نسي سؤالاً كان يعرفه محتاجٌ لها
        ولو كان أمامه أسئلة لم يرها بعد. فالمدخل معروض دائماً، ونبرته تتبع
        ما إذا كان هناك منسيٌّ فعلاً. تحت اختيار الدروس لأنها بعد الشغل لا قبله.
      */}
      {all.mastered > 0 ? (
        <Link
          href="/bank/select?mode=review"
          className="card card-hover mb-6 flex items-center gap-3 px-4 py-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">
              {all.forgot > 0
                ? en
                  ? "Review what you are starting to forget"
                  : "راجع اللي بدأت تنساه"
                : en
                  ? "Review what you solved"
                  : "راجع اللي اتحل"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              {all.forgot > 0 ? (
                en ? (
                  <>
                    <span className="tnum">{all.forgot}</span> questions you solved and then got wrong again. Pick the lesson and review what you forgot. These are not new questions.
                  </>
                ) : (
                <>
                  <span className="tnum">{all.forgot}</span> سؤال حليته وبعدين
                  رجعت غلطت فيه. اختار الدرس وراجع اللي نسيته — مش أسئلة جديدة.
                </>
                )
              ) : en ? (
                <>
                  The questions you got right. Pick the lesson or chapter you want to check that you still remember, especially after a while. If you are still learning the lesson, start practicing above.
                </>
              ) : (
                <>
                  الأسئلة اللي حلّيتها صح. اختار الدرس أو الفصل اللي عايز
                  تتأكد إنك لسه فاكره، خصوصاً بعد فترة. لو لسه بتتعرّف على
                  الدرس، ابدأ حل فوق أنسب.
                </>
              )}
            </p>
          </div>
          <ChevronLeft className="size-4 shrink-0 text-ink-3 ltr:rotate-180" strokeWidth={1.5} />
        </Link>
      ) : null}

      <div className="flex flex-col gap-6">
        {chapters.map(([chapterId, chapter]) => {
          const totals = chapter.banks.reduce(
            (acc, b) => add(acc, perBank.get(b.id) ?? ZERO),
            ZERO,
          );

          return (
            <section key={chapterId}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-ink">
                    {bankChapterName(chapter.position, chapter.kind, locale)}
                  </h2>
                  {bankChapterHint(chapter.kind, locale) ? (
                    <p className="mt-0.5 text-xs text-ink-3">
                      {bankChapterHint(chapter.kind, locale)}
                    </p>
                  ) : null}
                </div>
                <span className="tnum text-xs text-ink-3">
                  {en
                    ? `${totals.mastered} of ${totals.total} solved`
                    : `${totals.mastered} من ${totals.total} اتحل`}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {chapter.banks.length >= 2 ? (
                  totals.todo > 0 ? (
                    <Link
                      href={`/bank/practice?chapter=${chapterId}`}
                      className="card card-hover flex items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          {chapter.kind === "review"
                            ? en
                              ? "The open questions here are mixed"
                              : "الأسئلة المفتوحة هنا مخلوطة"
                            : en
                              ? "The open questions in the chapter are mixed"
                              : "الأسئلة المفتوحة في الفصل مخلوطة"}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
                          {en ? (
                            <>
                              {mixScope(chapter.banks, chapter.kind, locale)} together, not one lesson on its own.{" "}
                              <span className="tnum">{totals.todo}</span> questions are still unsolved
                            </>
                          ) : (
                            <>
                          {mixScope(chapter.banks, chapter.kind, locale)} مع بعض — مش درس
                          لوحده — <span className="tnum">{totals.todo}</span>{" "}
                          سؤال لسه ما اتحلتش
                            </>
                          )}
                        </p>
                      </div>
                      <ChevronLeft
                        className="size-4 shrink-0 text-ink-3 ltr:rotate-180"
                        strokeWidth={1.5}
                      />
                    </Link>
                  ) : (
                    <Link
                      href={`/bank/practice?chapter=${chapterId}&mode=review`}
                      className="card card-hover flex items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">
                          {chapter.kind === "review"
                            ? en
                              ? "Review what you solved here, mixed"
                              : "راجع اللي اتحل هنا مخلوط"
                            : en
                              ? "Review what you solved in the chapter, mixed"
                              : "راجع اللي اتحل في الفصل مخلوط"}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
                          {en
                            ? `You finished ${mixScope(chapter.banks, chapter.kind, locale)}. Review starts with the distinction questions.`
                            : `خلّصت ${mixScope(chapter.banks, chapter.kind, locale)} — المراجعة تبدأ بأسئلة التفريق`}
                        </p>
                      </div>
                      <ChevronLeft
                        className="size-4 shrink-0 text-ink-3 ltr:rotate-180"
                        strokeWidth={1.5}
                      />
                    </Link>
                  )
                ) : null}

                {chapter.banks.map((bank) => {
                  const stats = perBank.get(bank.id) ?? ZERO;
                  const { title, blurb } = bankLabel(bank, locale);
                  return (
                    <Link
                      key={bank.id}
                      href={`/bank/practice?exam=${bank.id}`}
                      className="card card-hover flex items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed text-ink">{title}</p>
                        {blurb ? (
                          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
                            {blurb}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-ink-3">
                          {en ? (
                            <>
                              <span className="tnum">{stats.mastered}</span> of{" "}
                              <span className="tnum">{stats.total}</span> solved
                              {stats.todo > 0 ? ` · ${stats.todo} still unsolved` : ""}
                              {stats.forgot > 0 ? ` · ${stats.forgot} you are starting to forget` : ""}
                            </>
                          ) : (
                            <>
                          <span className="tnum">{stats.mastered}</span> من{" "}
                          <span className="tnum">{stats.total}</span> اتحل
                          {stats.todo > 0 ? ` · ${stats.todo} لسه ما اتحلتش` : ""}
                          {stats.forgot > 0 ? ` · ${stats.forgot} بدأت تنساه` : ""}
                            </>
                          )}
                        </p>
                      </div>
                      <ChevronLeft
                        className="size-4 shrink-0 text-ink-3 ltr:rotate-180"
                        strokeWidth={1.5}
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/*
        يُقال للطالب صراحةً لا يُكتشف بالصدفة: أن يعرف أن مدرّسه يتابع
        تدريبه اطمئنانٌ، وأن يكتشفه بعد شهر شعورٌ بأنه كان مُراقَباً.
      */}
      <p className="divider mt-8 pt-4 text-xs leading-relaxed text-ink-3">
        {en
          ? "Your teacher can see your answers here, so they know what needs explaining again. The bank does not give a grade, and a wrong answer here is not counted against you."
          : "مدرّسك بيشوف إجاباتك هنا عشان يعرف إيه اللي محتاج يعيد شرحه. مفيش درجة بتتحسب من البنك، والغلط فيه مش محسوب عليك."}
      </p>
    </>
  );
}
