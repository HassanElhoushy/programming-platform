import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { BankRunner, type BankQuestion } from "./bank-runner";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "تدريب · بنك الأسئلة" };
export const dynamic = "force-dynamic";

/** أقصى ما تحمله الجلسة الواحدة. أطول من ذلك يُرهق ولا يُذاكَر. */
const SESSION_SIZE = 25;

export default async function BankPracticePage({
  searchParams,
}: PageProps<"/bank/practice">) {
  const params = await searchParams;
  const examParam = typeof params.exam === "string" ? params.exam : null;
  const chapterParam = typeof params.chapter === "string" ? params.chapter : null;

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

  const { data: bankRows } = await banksQuery;

  const banks = (bankRows ?? []).filter((b) => {
    if (!chapterParam) return true;
    const lesson = b.lessons as unknown as { chapter_id: string } | null;
    return lesson?.chapter_id === chapterParam;
  });

  const bankIds = banks.map((b) => b.id);

  if (bankIds.length === 0) {
    return <NothingHere />;
  }

  const [questionsRes, optionsRes, progressRes] = await Promise.all([
    supabase
      .from("questions")
      .select("id, exam_id, type, body, points, blank_count, position")
      .in("exam_id", bankIds)
      .neq("type", "essay")
      .order("position"),
    supabase
      .from("question_options")
      .select("id, question_id, position, body, role")
      .order("position"),
    supabase.from("bank_progress").select("question_id, state"),
  ]);

  const stateOf = new Map(
    (progressRes.data ?? []).map((p) => [p.question_id, p.state as string]),
  );

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

  const titleOf = new Map(banks.map((b) => [b.id, b.title]));

  /*
   * الترتيب: ما أخطأ فيه أولاً، ثم ما لم يره، ثم ما أصابه. المراجعة متاحة
   * لمن طلبها ولا تُفرَض على من أمامه ما لم يحلّه بعد.
   */
  const rank = (id: string) => {
    const state = stateOf.get(id);
    if (state === "wrong") return 0;
    if (state === undefined) return 1;
    return 2;
  };

  const all = (questionsRes.data ?? []).map((q) => ({
    id: q.id,
    type: q.type,
    body: q.body,
    points: Number(q.points),
    blank_count: q.blank_count,
    bank_title: titleOf.get(q.exam_id) ?? "",
    options: optionsByQuestion.get(q.id) ?? [],
    state: stateOf.get(q.id) ?? null,
  })) satisfies BankQuestion[];

  const ordered = all
    .map((q, i) => ({ q, i }))
    .sort((a, b) => rank(a.q.id) - rank(b.q.id) || a.i - b.i)
    .map((x) => x.q);

  const session = ordered.slice(0, SESSION_SIZE);

  if (session.length === 0) return <NothingHere />;

  const remaining = ordered.length - session.length;

  return (
    <>
      <Link
        href="/bank"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4" strokeWidth={1.5} />
        بنك الأسئلة
      </Link>

      <BankRunner questions={session} remaining={remaining} />
    </>
  );
}

function NothingHere() {
  return (
    <>
      <Link
        href="/bank"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
      >
        <ChevronRight className="size-4" strokeWidth={1.5} />
        بنك الأسئلة
      </Link>
      <p className="card px-4 py-8 text-center text-sm text-ink-3">
        مفيش أسئلة في النطاق ده.
      </p>
    </>
  );
}
