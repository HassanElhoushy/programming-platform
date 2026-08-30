-- =============================================================================
-- منصة البرمجة — 12: نوع العنصر (تدريب أو امتحان)
--
-- شغّل هذا الملف بعد 10_model_answer.sql.
--
-- التبويب عند الطالب اسمه "الأسئلة" ليتّسع للنوعين، ولذلك صار لا بد أن تعرف
-- المنصة أيّهما هذا العنصر: طالب يظن نفسه يتصفح تدريباً فيحرق محاولته
-- الوحيدة في امتحان — وهي حالة وقعت فعلاً — أسوأ من كلمة تُخيفه.
--
-- القيمة الافتراضية "تدريب": كل ما أُنشئ قبل هذا الحقل كان تدريبات، والأقل
-- ضرراً أن يُعامل المجهول على أنه الأخف لا الأثقل.
-- =============================================================================

do $$ begin
  create type public.exam_kind as enum ('practice', 'exam');
exception when duplicate_object then null; end $$;

alter table public.exams
  add column if not exists kind public.exam_kind not null default 'practice';

create index if not exists exams_kind_idx on public.exams (kind);
