-- =============================================================================
-- منصة البرمجة — 25: درس بلا محتوى مفتوح لا يظهر للطالب
--
-- شغّل هذا الملف بعد 24_bank_levels_check.sql.
--
-- صلاحية `lesson` وحدها كانت تكفي لظهور البطاقة. بقي صف على عنوان مراجعة
-- شاملة بعد ما المحتوى نفسه ما اتفتحش (أو اتنسحب)، فالطالب شاف «مراجعة
-- شاملة» و«لا يوجد محتوى متاح» والمدرّس يقول أنا ما فتحتها.
--
-- الظهور مربوط بملف أو امتحان مفتوح له. اسم الدرس فوق امتحان واحد ممنوح
-- يفضل يظهر — ذلك الامتحان نفسه يمر من can_access_exam.
-- =============================================================================

create or replace function public.can_see_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then true
    when not public.is_active_student() then false
    else exists (
      select 1 from public.lesson_files f
      where f.lesson_id = p_lesson_id and public.can_access_file(f.id)
    ) or exists (
      select 1 from public.exams e
      where e.lesson_id = p_lesson_id and public.can_access_exam(e.id)
    )
  end;
$$;
