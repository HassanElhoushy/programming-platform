-- =============================================================================
-- منصة البرمجة — 24: فحص قاعدة الإتقان والنسيان
--
-- 23_bank_levels.sql يقوم على تمييزٍ سهل الانكسار: أن الحالة لا تنزل أبداً
-- وأن علامة النسيان ترتفع وتنخفض. وكلاهما تعبيرٌ واحد داخل ON CONFLICT، وأي
-- تعديل عليه يبدو صحيحاً بالقراءة ويكسر الفرق بين "لم يفهم" و"نسي" في صمت.
--
-- الملف ينتحل شخصية طالب وينادي check_bank_answer كما يناديها المتصفح، ويمشي
-- الطريق الكامل: يخطئ ثم يصيب ثم ينسى ثم يراجع. وفي كل خطوة يسأل عن الحالة
-- والعلامة معاً، لأن الخطأ المتوقَّع هو أن تصحّ إحداهما وتفسد الأخرى.
--
-- داخل transaction ينتهي بـ rollback.
-- =============================================================================

begin;

create temporary table _t24 (
  n        integer generated always as identity,
  test     text,
  expected text,
  actual   text,
  "نجح"    boolean
) on commit drop;

grant insert, select on _t24 to authenticated;

do $$
declare
  v_admin   uuid;
  v_student uuid;
  v_chapter uuid;
  v_lesson  uuid;
  v_bank    uuid;
  q         uuid;
  o         uuid[];
  v_state   text;
  v_forgot  boolean;
  v_tries   integer;
begin
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  if v_admin is null then raise exception 'لا يوجد مدرّس.'; end if;

  select id into v_student
  from public.profiles where role = 'student' and status = 'active' limit 1;
  if v_student is null then raise exception 'لا يوجد طالب مفعّل.'; end if;

  update public.profiles set full_access = false where id = v_student;

  insert into public.chapters (title, position)
  values ('فصل اختبار 24', 9024) returning id into v_chapter;

  insert into public.lessons (chapter_id, title, position)
  values (v_chapter, 'درس اختبار 24', 9024) returning id into v_lesson;

  insert into public.exams (lesson_id, title, level, kind, is_open)
  values (v_lesson, 'بنك اختبار 24', 'basic', 'bank', true)
  returning id into v_bank;

  insert into public.questions (exam_id, position, type, body, points, tier)
  values (v_bank, 1, 'mcq_single', 'أي مما يلي مثال على بيانات شخصية؟', 1, 'trap')
  returning id into q;

  insert into public.question_options (question_id, position, body)
  select q, i, b
  from unnest(array['سرعة المعالج', 'الرقم القومي', 'إصدار النظام'])
       with ordinality as t(b, i);

  select array_agg(id order by position) into o
  from public.question_options where question_id = q;

  insert into public.question_keys (question_id, key, explanation)
  values (q, jsonb_build_object('option_ids', jsonb_build_array(o[2])),
          'الرقم القومي يدل على شخص بعينه، والاثنان الآخران يصفان جهازاً.');

  insert into public.permissions (student_id, resource_type, resource_id, granted_by)
  values (v_student, 'exam', v_bank, v_admin);

  ---------------------------------------------------------------------------
  -- صِر الطالب
  ---------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text,
    true
  );

  ---------------------------------------------------------------------------
  -- 1) أخطأ من أول مرة: "محتاج شغل" بلا علامة نسيان
  --
  --    الفرق بين هذه الحالة والثالثة هو كل ما بُني هذا الملف من أجله.
  ---------------------------------------------------------------------------
  perform public.check_bank_answer(q, jsonb_build_object(
    'option_ids', jsonb_build_array(o[1]::text)));

  select state, forgot into v_state, v_forgot from public.bank_progress
   where student_id = v_student and question_id = q;

  insert into _t24 (test, expected, actual, "نجح") values
    ('أخطأ أول مرة: الحالة wrong', 'wrong', v_state, v_state = 'wrong'),
    ('أخطأ أول مرة: مش نسيان', 'f', v_forgot::text, v_forgot = false);

  ---------------------------------------------------------------------------
  -- 2) أصاب: مثبَّت
  ---------------------------------------------------------------------------
  perform public.check_bank_answer(q, jsonb_build_object(
    'option_ids', jsonb_build_array(o[2]::text)));

  select state, forgot into v_state, v_forgot from public.bank_progress
   where student_id = v_student and question_id = q;

  insert into _t24 (test, expected, actual, "نجح") values
    ('أصاب: الحالة correct', 'correct', v_state, v_state = 'correct'),
    ('أصاب: مش نسيان', 'f', v_forgot::text, v_forgot = false);

  ---------------------------------------------------------------------------
  -- 3) أخطأ بعد الإتقان: الحالة تثبت والعلامة ترتفع
  --
  --    جوهر الملف: العدّاد لا يتراجع، والسؤال يعود.
  ---------------------------------------------------------------------------
  perform public.check_bank_answer(q, jsonb_build_object(
    'option_ids', jsonb_build_array(o[3]::text)));

  select state, forgot, tries into v_state, v_forgot, v_tries
  from public.bank_progress
  where student_id = v_student and question_id = q;

  insert into _t24 (test, expected, actual, "نجح") values
    ('نسي: الإتقان ما اتسحبش', 'correct', v_state, v_state = 'correct'),
    ('نسي: العلامة ارتفعت', 't', v_forgot::text, v_forgot = true),
    ('المحاولات اتسجّلت كلها', '3', v_tries::text, v_tries = 3);

  ---------------------------------------------------------------------------
  -- 4) راجع فأصاب: العلامة تُطفأ
  --
  --    العلامة وصفٌ لآخر إجابة لا سجلٌّ دائم. ولو بقيت مرفوعة لظلّ السؤال
  --    يعود إلى الأبد في المراجعة وإن كان الطالب قد أصلحه.
  ---------------------------------------------------------------------------
  perform public.check_bank_answer(q, jsonb_build_object(
    'option_ids', jsonb_build_array(o[2]::text)));

  select state, forgot into v_state, v_forgot from public.bank_progress
   where student_id = v_student and question_id = q;

  insert into _t24 (test, expected, actual, "نجح") values
    ('راجع فأصاب: الحالة correct', 'correct', v_state, v_state = 'correct'),
    ('راجع فأصاب: العلامة اتطفت', 'f', v_forgot::text, v_forgot = false);

  ---------------------------------------------------------------------------
  -- 5) المستوى يصل الطالب، والمفتاح لا
  --
  --    المستوى على questions فيقرؤه الطالب بحكم صلاحيته على البنك، وهو
  --    مقصود: أن يعرف أن ما بين يديه سؤال تفريق يفيده. والمفتاح في الجدول
  --    المحمي، والسطر الثاني يتأكد أن إضافة عمود لم تفتح باباً.
  ---------------------------------------------------------------------------
  insert into _t24 (test, expected, actual, "نجح")
  select 'الطالب يقرأ مستوى سؤال البنك', 'trap', coalesce(t, 'محجوب'), t = 'trap'
  from (select (select tier::text from public.questions where id = q) as t) s;

  insert into _t24 (test, expected, actual, "نجح")
  select 'جدول المفاتيح ما زال مقفولاً', '0 صف', c::text, c = 0
  from (select count(*) as c from public.question_keys) s;
end $$;

select n as "#", test as "الاختبار", expected as "المتوقع",
       actual as "الفعلي", "نجح"
from _t24 order by n;

select count(*) filter (where "نجح") || '/' || count(*) as "النتيجة" from _t24;

rollback;
