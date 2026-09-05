import Link from "next/link";
import { ChevronLeft, Layers } from "lucide-react";

import {
  Badge,
  EmptyState,
  PageHeader,
  QueryError,
  SectionTitle,
} from "@/components/ui/primitives";
import { QUESTION_TYPE_LABELS, lessonPath } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "بنك الأسئلة · لوحة المدرّس" };
export const dynamic = "force-dynamic";

interface Insights {
  totals: { banks: number; questions: number; answered: number; students: number };
  by_lesson: {
    chapter_position: number;
    chapter_kind: string;
    lesson_position: number;
    lesson_kind: string;
    lesson_title: string;
    wrong: number;
    correct: number;
    students_wrong: number;
  }[];
  by_type: { type: string; wrong: number; correct: number }[];
  by_student: {
    student_id: string;
    name: string;
    wrong: number;
    correct: number;
    weak_type: string | null;
  }[];
  hardest: {
    question_id: string;
    exam_id: string;
    body: string;
    type: string;
    wrong: number;
    correct: number;
  }[];
}

interface BankRow {
  id: string;
  title: string;
  is_open: boolean;
  lessons: {
    position: number;
    kind: string;
    chapters: { position: number; kind: string } | null;
  } | null;
}

export default async function AdminBankPage() {
  const supabase = await createClient();

  const [banksRes, insightsRes, questionsRes] = await Promise.all([
    supabase
      .from("exams")
      .select("id, title, is_open, lessons(position, kind, chapters(position, kind))")
      .eq("kind", "bank")
      .is("archived_at", null)
      .order("created_at"),
    supabase.rpc("bank_insights"),
    supabase.from("questions").select("id, exam_id"),
  ]);

  if (banksRes.error) return <QueryError message={banksRes.error.message} />;
  if (insightsRes.error) return <QueryError message={insightsRes.error.message} />;

  const banks = (banksRes.data ?? []) as unknown as BankRow[];
  const insights = insightsRes.data as Insights;

  const countByBank = new Map<string, number>();
  for (const q of questionsRes.data ?? []) {
    countByBank.set(q.exam_id, (countByBank.get(q.exam_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="بنك الأسئلة"
        subtitle="تدريب حر بلا درجة — وأين يخطئ الفصل"
      />

      {/* ------------------------------------------------------------- */}
      <section className="mb-8">
        <SectionTitle>البنوك</SectionTitle>

        <p className="mb-3 text-xs leading-relaxed text-ink-3">
          بنك الأسئلة عنصر جوّه الدرس زي التدريبات والامتحانات، بس نوعه
          «بنك أسئلة». اعمله من صفحة الدرس واستورد فيه الأسئلة عادي، وهيبان
          هنا. الصلاحية زي أي امتحان — تفتحه للطالب من صفحة الطلاب.
        </p>

        {banks.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="لسه ما عملتش أي بنك"
            hint="من المحتوى ← اختر درساً ← تدريب أو امتحان جديد ← النوع «بنك أسئلة»."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {banks.map((bank) => {
              const chapter = bank.lessons?.chapters;
              return (
                <Link
                  key={bank.id}
                  href={`/admin/exams/${bank.id}`}
                  className="card card-hover flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink-3">
                      {lessonPath(
                        chapter?.position ?? 0,
                        bank.lessons?.position ?? 0,
                        bank.lessons?.kind,
                        chapter?.kind,
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-sm font-medium text-ink">
                      {bank.title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={bank.is_open ? "ok" : "muted"}>
                        {bank.is_open ? "مفتوح" : "مغلق"}
                      </Badge>
                      <span className="tnum text-xs text-ink-3">
                        {countByBank.get(bank.id) ?? 0} سؤال
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {insights.totals.answered === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-ink-3">
          لسه محدش حلّ في البنك. أول ما الطلبة يبدأوا هتلاقي هنا إيه اللي
          بيغلطوا فيه.
        </p>
      ) : (
        <>
          {/* ----------------------------------------------------- */}
          <section className="mb-8">
            <SectionTitle>فين الغلط — بالدرس</SectionTitle>
            <p className="mb-3 text-xs leading-relaxed text-ink-3">
              الدرس اللي بيغلط فيه عدد أكبر من الطلبة هو اللي محتاج إعادة شرح.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[26rem] text-sm">
                <thead>
                  <tr className="text-xs text-ink-3">
                    <th className="pb-2 text-start font-medium">الدرس</th>
                    <th className="pb-2 text-start font-medium">طلبة غلطوا</th>
                    <th className="pb-2 text-start font-medium">غلط</th>
                    <th className="pb-2 text-start font-medium">صح</th>
                  </tr>
                </thead>
                <tbody>
                  {insights.by_lesson.map((row) => (
                    <tr
                      key={`${row.chapter_position}-${row.lesson_position}`}
                      className="divider"
                    >
                      <td className="py-2 pe-3">
                        <p className="text-ink">{row.lesson_title}</p>
                        <p className="text-xs text-ink-3">
                          {lessonPath(
                            row.chapter_position,
                            row.lesson_position,
                            row.lesson_kind,
                            row.chapter_kind,
                          )}
                        </p>
                      </td>
                      <td className="tnum py-2 pe-3 text-ink">{row.students_wrong}</td>
                      <td className="tnum py-2 pe-3 text-ink-2">{row.wrong}</td>
                      <td className="tnum py-2 text-ink-2">{row.correct}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ----------------------------------------------------- */}
          <section className="mb-8">
            <SectionTitle>فين الغلط — بنوع السؤال</SectionTitle>
            <p className="mb-3 text-xs leading-relaxed text-ink-3">
              غلط مركّز في نوع واحد عبر كل الفصول معناه إن المشكلة في شكل
              السؤال مش في المادة.
            </p>

            <div className="flex flex-col gap-2">
              {insights.by_type.map((row) => {
                const total = row.wrong + row.correct;
                const pct = total > 0 ? Math.round((row.wrong / total) * 100) : 0;
                return (
                  <div
                    key={row.type}
                    className="card flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <span className="min-w-0 flex-1 text-sm text-ink">
                      {QUESTION_TYPE_LABELS[row.type] ?? row.type}
                    </span>
                    <span className="tnum text-xs text-ink-3">
                      {row.wrong} غلط من {total}
                    </span>
                    <span className="tnum text-sm font-medium text-ink">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ----------------------------------------------------- */}
          <section className="mb-8">
            <SectionTitle>كل طالب</SectionTitle>

            <div className="flex flex-col gap-2">
              {insights.by_student.map((row) => (
                <div
                  key={row.student_id}
                  className="card flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 text-sm text-ink">{row.name}</span>
                  {row.weak_type ? (
                    <Badge tone="wait">
                      بيتعثّر في {QUESTION_TYPE_LABELS[row.weak_type] ?? row.weak_type}
                    </Badge>
                  ) : null}
                  <span className="tnum text-xs text-ink-3">
                    {row.correct} صح · {row.wrong} غلط
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ----------------------------------------------------- */}
          <section>
            <SectionTitle>الأسئلة اللي بيقعوا فيها</SectionTitle>
            <p className="mb-3 text-xs leading-relaxed text-ink-3">
              سؤال بيغلط فيه نص الفصل يا إما المفهوم ما وصلش، يا إما صياغة
              السؤال ملتبسة. الاتنين محتاجين تفتحه.
            </p>

            <div className="flex flex-col gap-2">
              {insights.hardest.map((row) => (
                <Link
                  key={row.question_id}
                  href={`/admin/exams/${row.exam_id}`}
                  className="card card-hover flex items-start gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-ink">{row.body}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="muted">
                        {QUESTION_TYPE_LABELS[row.type] ?? row.type}
                      </Badge>
                      <span className="tnum text-xs text-ink-3">
                        {row.wrong} غلط · {row.correct} صح
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className="size-4 shrink-0 text-ink-3" strokeWidth={1.5} />
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
