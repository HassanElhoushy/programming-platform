import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { LessonPicker, type PickerChapter } from "./lesson-picker";
import { PageHeader, QueryError } from "@/components/ui/primitives";
import { bankChapterHint, bankChapterName, bankLessonTitle, lessonName, reviewScope } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "اختار دروسك · بنك الأسئلة" };
export const dynamic = "force-dynamic";

interface BankRow {
  id: string;
  lesson_id: string;
  lessons: {
    id: string;
    position: number;
    title: string;
    kind: string;
    chapters: { id: string; position: number; title: string; kind: string } | null;
  } | null;
}

/**
 * اختيار نطاق التدريب.
 *
 * الصفحة ترسم الشجرة الموجودة في قاعدة البيانات كما هي: كل درس صفٌّ له
 * تشيك بوكس، وتشييك الفصل يشيّك دروسه. ولذلك لا حالة خاصة لمراجعة ختام
 * الفصل — هي درس نوعه review فتظهر صفاً مثل غيرها — ولا لمراجعة الترم:
 * هي درس في حاوية مراجعات، فتظهر مجموعةً أختاً للفصول لا داخلها.
 *
 * والأمر الثاني هو الذي يجعل هذه الصفحة ضرورية: من شيّك الفصول الأربعة
 * الأولى لا تصله أسئلة ختام الترم أبداً، لأنها ليست ابنة أي فصل منها.
 */
export default async function BankSelectPage() {
  const supabase = await createClient();

  const banksRes = await supabase
    .from("exams")
    .select(
      "id, lesson_id, lessons(id, position, title, kind, chapters(id, position, title, kind))",
    )
    .eq("kind", "bank")
    .eq("is_open", true)
    .is("archived_at", null);

  if (banksRes.error) return <QueryError message={banksRes.error.message} />;

  const banks = (banksRes.data ?? []) as unknown as BankRow[];
  const bankIds = banks.map((b) => b.id);

  if (bankIds.length === 0) {
    return (
      <>
        <BackLink />
        <p className="card px-4 py-8 text-center text-sm text-ink-3">
          مفيش بنوك متاحة لك دلوقتي.
        </p>
      </>
    );
  }

  const [questionsRes, progressRes] = await Promise.all([
    supabase.from("questions").select("id, exam_id").in("exam_id", bankIds),
    supabase.from("bank_progress").select("question_id, state, forgot"),
  ]);

  if (questionsRes.error) return <QueryError message={questionsRes.error.message} />;
  if (progressRes.error) return <QueryError message={progressRes.error.message} />;

  const progressOf = new Map(
    (progressRes.data ?? []).map((p) => [
      p.question_id,
      { state: p.state as string, forgot: !!p.forgot },
    ]),
  );

  /* عدّادات كل بنك: مثبَّت، ومحتاج شغل، ومحتاج مراجعة */
  const statsOf = new Map<
    string,
    { total: number; mastered: number; todo: number; forgot: number }
  >();

  for (const q of questionsRes.data ?? []) {
    const stats =
      statsOf.get(q.exam_id) ?? { total: 0, mastered: 0, todo: 0, forgot: 0 };
    const progress = progressOf.get(q.id);

    stats.total += 1;
    if (progress?.state === "correct") {
      stats.mastered += 1;
      if (progress.forgot) stats.forgot += 1;
    } else {
      stats.todo += 1;
    }

    statsOf.set(q.exam_id, stats);
  }

  /* الشجرة: فصل ← دروسه التي لها بنك */
  const byChapter = new Map<string, PickerChapter>();

  for (const bank of banks) {
    const lesson = bank.lessons;
    const chapter = lesson?.chapters;
    if (!lesson || !chapter) continue;

    const entry =
      byChapter.get(chapter.id) ??
      ({
        id: chapter.id,
        label: bankChapterName(chapter.position, chapter.kind),
        hint: bankChapterHint(chapter.kind),
        position: chapter.kind === "review" ? Number.MAX_SAFE_INTEGER : chapter.position,
        lessons: [],
      } satisfies PickerChapter);

    const stats = statsOf.get(bank.id) ?? {
      total: 0,
      mastered: 0,
      todo: 0,
      forgot: 0,
    };

    entry.lessons.push({
      id: lesson.id,
      title: chapter.kind === "review" ? bankLessonTitle(lesson.title) : lesson.title,
      /*
       * داخل الأسئلة الشاملة لا يُكتب "مراجعة الفصل" فوق كل صف: العنوان
       * يقول ما تغطّيه («الترم الأول»)، والكلمة تكرار.
       */
      label:
        chapter.kind === "review"
          ? "أسئلة"
          : lesson.kind === "review"
            ? "أسئلة الفصل"
            : lessonName(lesson.position, lesson.kind),
      blurb: chapter.kind === "review" ? reviewScope(lesson.position) : null,
      position: lesson.position,
      ...stats,
    });

    byChapter.set(chapter.id, entry);
  }

  // حاوية المراجعات أخت الفصول لا واحدة منها، ومكانها الطبيعي بعدها كلها
  const chapters = [...byChapter.values()]
    .sort((a, b) => a.position - b.position)
    .map((chapter) => ({
      ...chapter,
      lessons: [...chapter.lessons].sort((a, b) => a.position - b.position),
    }));

  return (
    <>
      <BackLink />
      <PageHeader
        title="اختار دروسك"
        subtitle="حدّد اللي عايز تتدرّب عليه — درس، فصل، أو خلطة من عندك"
      />
      <LessonPicker chapters={chapters} />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/bank"
      className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink"
    >
      <ChevronRight className="size-4" strokeWidth={1.5} />
      بنك الأسئلة
    </Link>
  );
}
