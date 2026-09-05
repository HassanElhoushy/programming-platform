"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { createExamAction } from "@/app/actions/admin-exams";
import type { ActionResult } from "@/app/actions/admin-content";
import { FormError } from "@/components/ui/primitives";

type ExamFormState = ActionResult & { examId?: string };

const INITIAL: ExamFormState = {};

export function CreateExamForm({ lessonId }: { lessonId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  const [state, action, pending] = useActionState(
    async (prev: ExamFormState, formData: FormData) => {
      const result = await createExamAction(prev, formData);
      if (result.ok && result.examId) {
        formRef.current?.reset();
        setOpen(false);
        // ننتقل مباشرة لصفحة الامتحان لأن الخطوة التالية دائماً استيراد الأسئلة
        router.push(`/admin/exams/${result.examId}`);
      }
      return result;
    },
    INITIAL,
  );

  if (!open) {
    return (
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Plus className="size-4" strokeWidth={1.5} />
        امتحان جديد
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="card flex flex-col gap-3 px-4 py-4">
      <input type="hidden" name="lesson_id" value={lessonId} />

      <div>
        <label className="label" htmlFor="exam-title">
          عنوان الامتحان
        </label>
        <input
          id="exam-title"
          name="title"
          type="text"
          required
          className="input"
          placeholder="مثال: امتحان الدرس الأول"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="exam-kind">
            النوع
          </label>
          <select id="exam-kind" name="kind" className="input" defaultValue="practice">
            <option value="practice">تدريب</option>
            <option value="exam">امتحان</option>
            <option value="bank">بنك أسئلة</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="exam-level">
            المستوى
          </label>
          <select id="exam-level" name="level" className="input" defaultValue="basic">
            <option value="basic">أساسي</option>
            <option value="advanced">متقدم</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="exam-duration">
            المدة بالدقائق
          </label>
          <input
            id="exam-duration"
            name="duration_minutes"
            type="number"
            min={1}
            className="input tnum"
            placeholder="فاضية = بدون وقت"
          />
        </div>
      </div>

      <p className="-mt-1 text-xs leading-relaxed text-ink-3">
        النوع بيحدد الكلام اللي الطالب يشوفه قبل ما يبدأ. الاتنين محاولة واحدة
        بس، بس الامتحان بيجيله تحذير أوضح.
      </p>

      <FormError>{state.error}</FormError>

      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "جارٍ الإنشاء…" : "إنشاء ومتابعة"}
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
