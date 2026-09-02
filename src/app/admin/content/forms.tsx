"use client";

import { useActionState, useRef, useState } from "react";
import { Plus } from "lucide-react";

import {
  createChapterAction,
  createLessonAction,
  type ActionResult,
} from "@/app/actions/admin-content";
import { FormError } from "@/components/ui/primitives";

const INITIAL: ActionResult = {};

export function CreateChapterForm({ nextPosition }: { nextPosition: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  /*
   * الإغلاق بعد النجاح يحدث داخل دالة الإجراء لا في useEffect: هنا نحن في
   * سياق transition فالتحديث آمن، بينما setState داخل effect يسبب دورة
   * render إضافية بلا داعٍ. وتحديث الصفحة يتكفل به revalidatePath على السيرفر.
   */
  const [state, action, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await createChapterAction(prev, formData);
      if (result.ok) {
        formRef.current?.reset();
        setOpen(false);
      }
      return result;
    },
    INITIAL,
  );

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" strokeWidth={1.5} />
        فصل جديد
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="card flex flex-col gap-3 px-4 py-4">
      <div className="grid gap-3 sm:grid-cols-[6rem_9rem_1fr]">
        <div>
          <label className="label" htmlFor="chapter-position">
            الترتيب
          </label>
          <input
            id="chapter-position"
            name="position"
            type="number"
            min={1}
            defaultValue={nextPosition}
            required
            className="input tnum"
          />
        </div>

        <div>
          <label className="label" htmlFor="chapter-kind">
            النوع
          </label>
          <select id="chapter-kind" name="kind" className="input" defaultValue="chapter">
            <option value="chapter">فصل</option>
            <option value="review">مراجعة شاملة</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="chapter-title">
            عنوان الفصل
          </label>
          <input
            id="chapter-title"
            name="title"
            type="text"
            required
            className="input"
            placeholder="مثال: أساسيات البرمجة"
          />
        </div>
      </div>

      <p className="-mt-1 text-xs leading-relaxed text-ink-3">
        «مراجعة شاملة» حاوية للمراجعات اللي بتغطي أكتر من فصل — مش بتاخد رقم
        فصل في العرض. حط فيها ختام الفصل الأول والثاني، والمراجعة النهائية،
        وهكذا.
      </p>

      <FormError>{state.error}</FormError>

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}

export function CreateLessonForm({
  chapterId,
  nextPosition,
}: {
  chapterId: string;
  nextPosition: number;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  const [state, action, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const result = await createLessonAction(prev, formData);
      if (result.ok) {
        formRef.current?.reset();
        setOpen(false);
      }
      return result;
    },
    INITIAL,
  );

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost text-xs"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-3.5" strokeWidth={1.5} />
        درس جديد
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="card flex flex-col gap-3 px-4 py-4">
      <input type="hidden" name="chapter_id" value={chapterId} />

      <div className="grid gap-3 sm:grid-cols-[6rem_8rem_1fr]">
        <div>
          <label className="label" htmlFor={`lesson-position-${chapterId}`}>
            الرقم
          </label>
          <input
            id={`lesson-position-${chapterId}`}
            name="position"
            type="number"
            min={1}
            defaultValue={nextPosition}
            required
            className="input tnum"
          />
        </div>

        <div>
          <label className="label" htmlFor={`lesson-kind-${chapterId}`}>
            النوع
          </label>
          <select
            id={`lesson-kind-${chapterId}`}
            name="kind"
            className="input"
            defaultValue="lesson"
          >
            <option value="lesson">درس</option>
            <option value="review">مراجعة</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor={`lesson-title-${chapterId}`}>
            عنوان الدرس
          </label>
          <input
            id={`lesson-title-${chapterId}`}
            name="title"
            type="text"
            required
            className="input"
            placeholder="مثال: المتغيرات وأنواع البيانات"
          />
        </div>
      </div>

      <p className="-mt-1 text-xs leading-relaxed text-ink-3">
        اختار «مراجعة» لختام الفصل — الترقيم بيفضل زي ما هو، بس السطر فوق
        المحتوى بيبقى «مراجعة الفصل» بدل «الدرس الخامس».
      </p>

      <FormError>{state.error}</FormError>

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
