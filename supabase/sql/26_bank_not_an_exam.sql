-- =============================================================================
-- منصة البرمجة — 26: البنك ليس امتحاناً
--
-- شغّل هذا الملف بعد 25_hide_empty_lessons.sql.
--
-- البنك بلا محاولة ولا مؤقّت ولا تسليم. صفحة الدرس كانت تفتحه على
-- /exams/… فيبدأ start_exam محاولة، والطالب يرى «محاولة واحدة» ومؤقّتاً.
-- الشرط هنا حتى لو وُجد رابط قديم: لا تُنشأ محاولة على عنصر نوعه bank.
-- =============================================================================

create or replace function public.start_exam(p_exam_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_exam    public.exams%rowtype;
  v_attempt public.exam_attempts%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not public.is_active_student() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.can_access_exam(p_exam_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;

  if v_exam.kind = 'bank' then
    raise exception 'BANK_NOT_AN_EXAM' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.exam_attempts
  where exam_id = p_exam_id and student_id = v_uid and voided_at is null;

  if found then
    return v_attempt.id;
  end if;

  if not v_exam.is_open then
    raise exception 'EXAM_CLOSED' using errcode = '42501';
  end if;

  insert into public.exam_attempts (exam_id, student_id)
  values (p_exam_id, v_uid)
  returning * into v_attempt;

  return v_attempt.id;
end;
$$;
