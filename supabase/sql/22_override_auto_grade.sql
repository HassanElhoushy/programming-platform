-- =============================================================================
-- منصة البرمجة — 22: تعديل درجة سؤال موضوعي بعد التسليم
--
-- شغّل هذا الملف بعد 21_answer_timestamps.sql.
--
-- التصحيح الآلي نهائي بالنسبة للطالب، لكن المدرّس أحياناً يقبل إجابة
-- إكمال فراغات قريبة (مثل «الذكاء الاصطناعي» بدل «التوليدي») أو يرفع
-- درجة بعد ما يشوف الاختيار. grade_attempt ترفض غير المقالي عمداً.
-- الدالة دي هي الثقب الوحيد: مدرّس، محاولة مسلَّمة، سؤال غير مقالي.
-- =============================================================================

create or replace function public.override_auto_grade(
  p_attempt_id     uuid,
  p_question_id    uuid,
  p_awarded_points numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_points  numeric(6, 2);
  v_type    public.question_type;
  v_awarded numeric(6, 2);
  v_auto    numeric(7, 2);
  v_uid     uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_attempt
    from public.exam_attempts
   where id = p_attempt_id
   for update;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_attempt.status = 'in_progress' then
    raise exception 'NOT_SUBMITTED' using errcode = '42501';
  end if;
  if v_attempt.voided_at is not null then
    raise exception 'ATTEMPT_VOIDED' using errcode = '42501';
  end if;

  select q.points, q.type
    into v_points, v_type
  from public.questions q
  where q.id = p_question_id
    and q.exam_id = v_attempt.exam_id;

  if not found then
    raise exception 'QUESTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_type = 'essay' then
    raise exception 'NOT_AN_AUTO_QUESTION' using errcode = '22023';
  end if;

  v_awarded := least(greatest(coalesce(p_awarded_points, 0), 0), v_points);

  update public.answers
     set awarded_points = v_awarded,
         is_correct     = (v_awarded = v_points),
         graded_by      = v_uid,
         graded_at      = now()
   where attempt_id = p_attempt_id
     and question_id = p_question_id;

  if not found then
    insert into public.answers (
      attempt_id, question_id, awarded_points, is_correct, graded_by, graded_at
    ) values (
      p_attempt_id, p_question_id, v_awarded, (v_awarded = v_points), v_uid, now()
    );
  end if;

  select coalesce(sum(a.awarded_points), 0)
    into v_auto
  from public.questions q
  join public.answers a
    on a.question_id = q.id
   and a.attempt_id = p_attempt_id
  where q.exam_id = v_attempt.exam_id
    and q.type <> 'essay';

  update public.exam_attempts
     set auto_score = v_auto
   where id = p_attempt_id;

  return jsonb_build_object(
    'awarded_points', v_awarded,
    'auto_score',     v_auto
  );
end;
$$;

revoke all on function public.override_auto_grade(uuid, uuid, numeric) from public, anon;
grant execute on function public.override_auto_grade(uuid, uuid, numeric) to authenticated;
