import Link from "next/link";
import { ChevronLeft, Layers } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { chapterName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "بنك الأسئلة · منصة البرمجة" };
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

/**
 * بنك الأسئلة.
 *
 * ليس امتحاناً: بلا مؤقّت ولا تسليم ولا درجة تُسجَّل. الطالب يجيب فيعرف
 * فوراً ويرى الصحيح وسببه، ثم يمضي.
 *
 * الصفحة تفتح على "اللي محتاج شغل" لا على قائمة الفصول، لأن أكثر ما يحتاجه
 * من فتحها أن يبدأ لا أن يختار.
 */
export default async function BankPage() {
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
    supabase.from("bank_progress").select("question_id, state"),
  ]);

  const banks = (banksRes.data ?? []) as unknown as BankRow[];

  if (banks.length === 0) {
    return (
      <>
        <PageHeader title="بنك الأسئلة" subtitle="تدرّب على كل أنواع الأسئلة" />
        <EmptyState
          icon={Layers}
          title="مفيش أسئلة متاحة لك دلوقتي"
          hint="أول ما المدرّس يفتح لك بنك أسئلة هتلاقيه هنا."
        />
      </>
    );
  }

  /* عدد أسئلة كل بنك، وحالة الطالب في كل سؤال */
  const bankIds = banks.map((b) => b.id);
  const { data: questionRows } = await supabase
    .from("questions")
    .select("id, exam_id")
    .in("exam_id", bankIds);

  const stateOf = new Map(
    (progressRes.data ?? []).map((p) => [p.question_id, p.state]),
  );

  const perBank = new Map<string, { total: number; correct: number; todo: number }>();
  let allCorrect = 0;
  let allTodo = 0;

  for (const q of questionRows ?? []) {
    const entry = perBank.get(q.exam_id) ?? { total: 0, correct: 0, todo: 0 };
    entry.total += 1;
    if (stateOf.get(q.id) === "correct") {
      entry.correct += 1;
      allCorrect += 1;
    } else {
      entry.todo += 1;
      allTodo += 1;
    }
    perBank.set(q.exam_id, entry);
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
    byChapter.set(chapter.id, entry);
  }

  const chapters = [...byChapter.entries()].sort(
    (a, b) => a[1].position - b[1].position,
  );

  return (
    <>
      <PageHeader
        title="بنك الأسئلة"
        subtitle="تدرّب براحتك — مفيش وقت ولا درجة، والغلط هنا بيتشرح"
      />

      {/*
        المدخل الأساسي: يبدأ من الغلط ثم مما لم يره. الطالب الذي يفتح البنك
        يريد أن يحلّ، فلا نجعل أول ما يواجهه اختياراً.
      */}
      {allTodo > 0 ? (
        <Link
          href="/bank/practice"
          className="card card-hover mb-6 flex items-center gap-3 px-4 py-4"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">ابدأ اللي محتاج شغل</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-3">
              <span className="tnum">{allTodo}</span> سؤال لسه محتاج منك —
              اللي غلطت فيه الأول، وبعده اللي ما شفتهوش.
            </p>
          </div>
          <ChevronLeft className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
        </Link>
      ) : (
        <div className="card mb-6 px-4 py-4">
          <p className="text-sm font-medium text-ink">خلّصت كل المتاح</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            حلّيت <span className="tnum">{allCorrect}</span> سؤال صح. تقدر
            تراجع أي فصل تحت.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {chapters.map(([chapterId, chapter]) => {
          const totals = chapter.banks.reduce(
            (acc, b) => {
              const s = perBank.get(b.id);
              return {
                total: acc.total + (s?.total ?? 0),
                correct: acc.correct + (s?.correct ?? 0),
                todo: acc.todo + (s?.todo ?? 0),
              };
            },
            { total: 0, correct: 0, todo: 0 },
          );

          return (
            <section key={chapterId}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">
                  {chapterName(chapter.position, chapter.kind)}
                </h2>
                <span className="tnum text-xs text-ink-3">
                  {totals.correct} من {totals.total} صح
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {totals.todo > 0 ? (
                  <Link
                    href={`/bank/practice?chapter=${chapterId}`}
                    className="card card-hover flex items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        تدرّب على {chapter.title}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        <span className="tnum">{totals.todo}</span> سؤال محتاج شغل
                      </p>
                    </div>
                    <ChevronLeft
                      className="size-4 shrink-0 text-ink-3"
                      strokeWidth={1.5}
                    />
                  </Link>
                ) : null}

                {chapter.banks.map((bank) => {
                  const stats = perBank.get(bank.id);
                  return (
                    <Link
                      key={bank.id}
                      href={`/bank/practice?exam=${bank.id}`}
                      className="card card-hover flex items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink">{bank.title}</p>
                        <p className="mt-0.5 text-xs text-ink-3">
                          <span className="tnum">{stats?.correct ?? 0}</span> من{" "}
                          <span className="tnum">{stats?.total ?? 0}</span> صح
                          {stats?.todo ? ` · ${stats.todo} فاضل` : " · خلّصته"}
                        </p>
                      </div>
                      <ChevronLeft
                        className="size-4 shrink-0 text-ink-3"
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
        مدرّسك بيشوف إجاباتك هنا عشان يعرف إيه اللي محتاج يعيد شرحه. مفيش
        درجة بتتحسب من البنك، والغلط فيه مش محسوب عليك.
      </p>
    </>
  );
}
