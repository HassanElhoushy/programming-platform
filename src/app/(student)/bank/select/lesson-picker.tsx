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

type Mode = "work" | "review";

/**
 * شجرة اختيار الدروس.
 *
 * تشييك الفصل يشيّك دروسه كلها ومنها مراجعة ختامه، ويستطيع الطالب أن
 * يشيّل التشييك عن أي درس بعدها — فيحلّ على أول درسين من فصل، أو على
 * أسئلة الخلط وحدها بلا إعادة الدروس المنفردة.
 *
 * ولا زر "اختر الكل": من يريد المنهج كله يدخل البنك ويبدأ من الصفحة
 * الأولى، والزر هنا يجعل الشاشة كلها خياراً واحداً يُضغط بلا قراءة.
 */
export function LessonPicker({ chapters }: { chapters: PickerChapter[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("work");
  const [going, setGoing] = useState(false);

  const totals = useMemo(() => {
    let todo = 0;
    let mastered = 0;
    let forgot = 0;

    for (const chapter of chapters) {
      for (const lesson of chapter.lessons) {
        if (!picked.has(lesson.id)) continue;
        todo += lesson.todo;
        mastered += lesson.mastered;
        forgot += lesson.forgot;
      }
    }

    return { todo, mastered, forgot };
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
    if (mode === "review") params.set("mode", "review");
    router.push(`/bank/practice?${params.toString()}`);
  }

  /* ما سيحصل عليه فعلاً بالاختيار الحالي — لا عدد الأسئلة الكلي */
  const available = mode === "review" ? totals.mastered : totals.todo;

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
                        {lesson.mastered} من {lesson.total} مثبَّت
                        {lesson.todo > 0 ? ` · ${lesson.todo} محتاج شغل` : ""}
                        {lesson.forgot > 0 ? ` · ${lesson.forgot} محتاج مراجعة` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/*
        الوضع سؤال منفصل عن النطاق: من راجع بعد ستة أشهر كل أسئلته مثبَّتة،
        فلو كان الوضع مشتقّاً من العدّادات لقالت له الصفحة "مفيش حاجة" وهو
        بالضبط ما جاء من أجله.
      */}
      <div className="divider mt-8 pt-5">
        <p className="mb-2 text-sm font-semibold text-ink">تحلّ على إيه؟</p>
        <div className="flex flex-col gap-1.5">
          <ModeRow
            checked={mode === "work"}
            onSelect={() => setMode("work")}
            title="اللي محتاج شغل"
            hint="الأسئلة اللي لسه ما ثبّتتْهاش: غلط أو ما اتشافت. اختار ده وأنت بتتعلم."
          />
          <ModeRow
            checked={mode === "review"}
            onSelect={() => setMode("review")}
            title="مراجعة اللي مثبَّت"
            hint="الأسئلة اللي خلّصتها صح. اختار ده لما تراجع بعد فترة وتتأكد إنك لسه فاكر."
          />
        </div>
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
              ? mode === "review"
                ? "مفيش حاجة مثبَّتة في اللي اخترته"
                : "خلّصت كل اللي اخترته"
              : going
                ? "بيفتح…"
                : `ابدأ · ${available} سؤال متاح`}
        </button>
      </div>
    </>
  );
}

function ModeRow({
  checked,
  onSelect,
  title,
  hint,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
}) {
  return (
    <label className={rowClass(checked)}>
      <input
        type="radio"
        name="bank-mode"
        checked={checked}
        onChange={onSelect}
        className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{hint}</span>
      </span>
    </label>
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
