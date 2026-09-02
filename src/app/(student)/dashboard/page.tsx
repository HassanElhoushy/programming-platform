import Link from "next/link";
import { ClipboardList, FileText, PlayCircle, Sparkles } from "lucide-react";

import { ExamCard, FileRow } from "@/components/shared";
import { Badge, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { requireStudent } from "@/lib/auth";
import { formatScore } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "الرئيسية · منصة البرمجة" };
export const dynamic = "force-dynamic";

interface LessonRef {
  position: number;
  title: string;
  kind: string;
  chapters: { position: number; kind: string } | null;
}

export default async function DashboardPage() {
  const session = await requireStudent();
  const supabase = await createClient();

  /*
   * كل الاستعلامات هنا محكومة بـ RLS: ما لا يملك الطالب صلاحيته لا يعود من
   * قاعدة البيانات أصلاً. الفلترة في الكود للترتيب والعرض فقط، لا للحماية.
   */
  const [attemptsRes, openExamsRes, filesRes] = await Promise.all([
    supabase
      .from("exam_attempts")
      .select(
        "id, exam_id, status, submitted_at, auto_score, manual_score, total_points, feedback_seen_at, exams(title, level, lessons(position, title, chapters(position)))",
      )
      .is("voided_at", null)
      .order("started_at", { ascending: false }),

    supabase
      .from("exams")
      .select(
        "id, title, level, kind, duration_minutes, created_at, lessons(position, title, kind, chapters(position, kind))",
      )
      .eq("is_open", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),

    supabase
      .from("lesson_files")
      .select("id, title, kind, created_at, lessons(position, title, kind, chapters(position, kind))")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const attempts = attemptsRes.data ?? [];
  const openExams = openExamsRes.data ?? [];
  const files = filesRes.data ?? [];

  const inProgress = attempts.find((a) => a.status === "in_progress");

  const newFeedback = attempts.find(
    (a) => a.status === "graded" && a.feedback_seen_at === null,
  );

  const attemptedExamIds = new Set(attempts.map((a) => a.exam_id));
  const available = openExams.filter((e) => !attemptedExamIds.has(e.id));

  const finished = attempts.filter((a) => a.status !== "in_progress");
  const scored = finished.filter(
    (a) => a.status === "graded" && Number(a.total_points) > 0,
  );
  const average =
    scored.length > 0
      ? Math.round(
          (scored.reduce(
            (sum, a) =>
              sum +
              (Number(a.auto_score ?? 0) + Number(a.manual_score ?? 0)) /
                Number(a.total_points),
            0,
          ) /
            scored.length) *
            100,
        )
      : null;

  const firstName = session.profile.full_name.trim().split(/\s+/)[0];

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold text-ink sm:text-2xl">
        أهلاً {firstName}
      </h1>

      {/* أول ما يشوفه الطالب: الحاجة اللي محتاجة منه */}
      {inProgress ? (
        <Link
          href={`/exams/${inProgress.exam_id}`}
          className="card card-hover mb-4 flex items-center gap-3 px-4 py-4"
        >
          <PlayCircle className="size-5 shrink-0 text-ink-3" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-ink">
                {(inProgress.exams as unknown as { title: string })?.title}
              </p>
              <Badge tone="wait">لسه ما اتسلّمش</Badge>
            </div>
            <p className="mt-0.5 text-xs text-ink-3">
              بدأت ده وما سلّمتوش. إجاباتك محفوظة زي ما سبتها.
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-accent">أكمل</span>
        </Link>
      ) : null}

      {newFeedback ? (
        <Link
          href={`/results/${newFeedback.id}`}
          className="card card-hover mb-4 flex items-center gap-3 px-4 py-4"
        >
          <Sparkles className="size-5 shrink-0 text-ink-3" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-ink">
                {(newFeedback.exams as unknown as { title: string })?.title}
              </p>
              <Badge tone="ok">تم التصحيح</Badge>
            </div>
            <p className="tnum mt-0.5 text-xs text-ink-3">
              درجتك{" "}
              {formatScore(
                Number(newFeedback.auto_score ?? 0) +
                  Number(newFeedback.manual_score ?? 0),
                newFeedback.total_points,
              )}{" "}
              · فيه تصحيح جديد لسه ما شفتوش
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-accent">اطّلع</span>
        </Link>
      ) : null}

      {/* ملخص بسيط */}
      {finished.length > 0 ? (
        <div className="card mb-8 grid grid-cols-2 divide-x-[0.5px] divide-x-reverse divide-line">
          <div className="px-4 py-3.5">
            <p className="text-xs text-ink-2">حليتها</p>
            <p className="tnum mt-0.5 text-lg font-semibold text-ink">
              {finished.length}
            </p>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-xs text-ink-2">متوسط درجاتك</p>
            <p className="tnum mt-0.5 text-lg font-semibold text-ink">
              {average === null ? "—" : `${average}%`}
            </p>
          </div>
        </div>
      ) : null}

      <section className="mb-8">
        <SectionTitle
          action={
            available.length > 0 ? (
              <Link href="/exams" className="text-xs text-ink-2 hover:text-ink">
                الكل
              </Link>
            ) : undefined
          }
        >
          متاح لك دلوقتي
        </SectionTitle>

        {available.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="مفيش حاجة جديدة دلوقتي"
            hint="أول ما المدرّس يفتح حاجة جديدة هتلاقيها هنا."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {available.slice(0, 4).map((exam) => {
              const lesson = exam.lessons as unknown as LessonRef | null;
              return (
                <ExamCard
                  key={exam.id}
                  href={`/exams/${exam.id}`}
                  title={exam.title}
                  level={exam.level}
                  kind={exam.kind}
                  durationMinutes={exam.duration_minutes}
                  chapterPosition={lesson?.chapters?.position ?? 0}
                  lessonPosition={lesson?.position ?? 0}
                  lessonKind={lesson?.kind}
                  chapterKind={lesson?.chapters?.kind}
                  cta="ابدأ"
                />
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          action={
            files.length > 0 ? (
              <Link href="/content" className="text-xs text-ink-2 hover:text-ink">
                كل المحتوى
              </Link>
            ) : undefined
          }
        >
          آخر الملفات
        </SectionTitle>

        {files.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="مفيش ملفات متاحة لك لسه"
            hint="المدرّس هيفتح لك الدروس وملفاتها، وهتلاقيها هنا."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {files.map((file) => {
              const lesson = file.lessons as unknown as LessonRef | null;
              return (
                <FileRow
                  key={file.id}
                  id={file.id}
                  title={file.title}
                  kind={file.kind}
                  createdAt={file.created_at}
                  crumb={{
                    chapterPosition: lesson?.chapters?.position ?? 0,
                    lessonPosition: lesson?.position ?? 0,
                    lessonKind: lesson?.kind,
                    chapterKind: lesson?.chapters?.kind,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

    </>
  );
}
