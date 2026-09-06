-- =============================================================================
-- منصة البرمجة — 21: وقت الحفظ من السيرفر
--
-- شغّل هذا الملف بعد 20_bank_insights.sql.
--
-- كان المتصفح يبعث updated_at من ساعة جهاز الطالب. وساعة جهاز طالبة عندنا
-- متأخرة إحدى عشرة ساعة، فبياناتها تقول إن إجاباتها حُفظت قبل أن يبدأ
-- الامتحان — وهو ما يجعل أي محاولة لتتبّع "متى حدث ماذا" عند شكوى عبثاً.
--
-- العمود له default now() أصلاً، فالإدراج كان سليماً. المشكلة في التحديث:
-- ON CONFLICT DO UPDATE يكتب ما أرسله العميل. المُحفِّز يحسم الأمر: أياً كان
-- ما أرسله أحد، الوقت وقت الخادم.
-- =============================================================================

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists answers_touch_updated_at on public.answers;
create trigger answers_touch_updated_at
  before update on public.answers
  for each row
  execute function public.touch_updated_at();


-- تحقّق: تحديث بوقت كاذب من "العميل" يُكتب بوقت الخادم.
-- داخل معاملة تنتهي بـ rollback: الفحص لا يترك أثراً في بيانات أحد.
begin;

do $$
declare
  v_a uuid;
  v_q uuid;
  v_written timestamptz;
  v_drift   interval;
begin
  select an.attempt_id, an.question_id into v_a, v_q
  from public.answers an limit 1;

  if v_a is null then
    raise notice 'لا توجد إجابات — يُتخطّى.';
    return;
  end if;

  update public.answers
     set updated_at = timestamptz '1999-01-01 00:00:00+00'
   where attempt_id = v_a and question_id = v_q
   returning updated_at into v_written;

  v_drift := greatest(now() - v_written, v_written - now());

  raise notice 'وقت كاذب أُرسل: 1999 — المكتوب فعلاً: % (فرق % عن الآن)',
    to_char(v_written, 'YYYY-MM-DD HH24:MI:SS'), v_drift;

  if v_drift > interval '5 seconds' then
    raise exception 'المُحفِّز لم يعمل: الوقت الكاذب اتكتب زي ما هو.';
  end if;

  raise notice 'المُحفِّز شغّال.';
end $$;

rollback;
