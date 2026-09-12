"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export interface PickerLesson {
  id: string;
  title: string;
  /** "الدرس الثاني" أو "مراجعة" داخل الحاوية */
  label: string | null;
  /** جملة «أسئلة على إيه» لمراجعات الحاوية */
  blurb: string | null;
  position: number;
  total: number;
  mastered: number;
  todo: number;
  forgot: number;
}

export interface PickerChapter {
  id: string;
  label: string;
  hint: string | null;
  position: number;
  lessons: PickerLesson[];
}

/**
 * شجرة اختيار الدروس.
 *
 * الوضع يجي من الصفحة اللي فتحتها: «اختار دروسك» شغل جديد، و«راجع اللي
 * اتحل» مراجعة. مش اختيار جوّه الشاشة — الخانتين على رأس البنك هما اللي
 * يفرّقوا، وهنا الطالب يحدّد النطاق بس.
 *
 * تشييك الفصل يشيّك دروسه كلها ومنها مراجعة ختامه، ويستطيع أن يشيّل
 * التشييك عن أي درس بعدها.
 *
 * ولا زر "اختر الكل": من يريد المنهج كله وهو بيحل يدخل «ابدأ حل» من
 * الصفحة الأولى. في المراجعة يشيّك الفصول اللي عايزها، بما فيها الكل.
 */
export function LessonPicker({
  chapters,
  review = false,
}: {
  chapters: PickerChapter[];
  review?: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [going, setGoing] = useState(false);

  const totals = useMemo(() => {
    let todo = 0;
    let mastered = 0;

    for (const chapter of chapters) {
      for (const lesson of chapter.lessons) {
        if (!picked.has(lesson.id)) continue;
        todo += lesson.todo;
        mastered += lesson.mastered;
      }
    }

    return { todo, mastered };
  }, [chapters, picked]);

  function toggleLesson(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleChapter(chapter: PickerChapter) {
    const ids = chapter.lessons.map((l) => l.id);
    const allPicked = ids.every((id) => picked.has(id));

    setPicked((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (allPicked) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function start() {
    if (picked.size === 0) return;
    setGoing(true);

    const params = new URLSearchParams({ lessons: [...picked].join(",") });
    if (review) params.set("mode", "review");
    router.push(`/bank/practice?${params.toString()}`);
  }

  /* ما سيحصل عليه فعلاً بالاختيار الحالي — لا عدد الأسئلة الكلي */
  const available = review ? totals.mastered : totals.todo;

  return (
    <>
      <div className="flex flex-col gap-5">
        {chapters.map((chapter) => {
          const ids = chapter.lessons.map((l) => l.id);
          const allPicked = ids.every((id) => picked.has(id));
          const somePicked = !allPicked && ids.some((id) => picked.has(id));

          return (
            <section key={chapter.id}>
              <label className="mb-2 flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={allPicked}
                  ref={(el) => {
                    if (el) el.indeterminate = somePicked;
                  }}
                  onChange={() => toggleChapter(chapter)}
                  className="size-4 shrink-0 accent-[var(--color-accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">
                    {chapter.label}
                  </span>
                  {chapter.hint ? (
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {chapter.hint}
                    </span>
                  ) : null}
                </span>
              </label>

              <div className="flex flex-col gap-1.5 ps-6">
                {chapter.lessons.map((lesson) => (
                  <label
                    key={lesson.id}
                    className={rowClass(picked.has(lesson.id))}
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(lesson.id)}
                      onChange={() => toggleLesson(lesson.id)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      {lesson.label ? (
                        <span className="block text-xs text-ink-3">{lesson.label}</span>
                      ) : null}
                      <span className="block text-sm text-ink">{lesson.title}</span>
                      {lesson.blurb ? (
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">
                          {lesson.blurb}
                        </span>
                      ) : null}
                      <span className="tnum mt-0.5 block text-xs text-ink-3">
                        {lesson.mastered} من {lesson.total} اتحل
                        {lesson.todo > 0 ? ` · ${lesson.todo} لسه ما اتحلتش` : ""}
                        {lesson.forgot > 0 ? ` · ${lesson.forgot} بدأت تنساه` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-6">
        <button
          type="button"
          onClick={start}
          disabled={picked.size === 0 || available === 0 || going}
          className="btn btn-primary w-full text-sm"
        >
          {picked.size === 0
            ? "اختار درس على الأقل"
            : available === 0
              ? review
                ? "مفيش حاجة اتحلت في اللي اخترته"
                : "خلّصت كل اللي اخترته"
              : going
                ? "بيفتح…"
                : `ابدأ · ${available} سؤال متاح`}
        </button>
      </div>
    </>
  );
}

function rowClass(selected: boolean) {
  return [
    "flex cursor-pointer items-start gap-3 rounded-[6px] border-[0.5px] px-3 py-2.5 transition-colors",
    selected
      ? "border-accent-line bg-accent-bg"
      : "border-line bg-surface hover:border-line-strong",
  ].join(" ");
}
