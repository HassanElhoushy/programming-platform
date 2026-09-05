-- =============================================================================
-- منصة البرمجة — 19: فحص أمن بنك الأسئلة
--
-- البنك يضيف إلى المنصة شيئاً لم يكن فيها: دالة تقول للطالب "إجابتك صح أم
-- خطأ" فوراً. هذه بطبيعتها آلة تخمين، وقيمتها في البنك بقدر خطرها خارجه.
--
-- الملف يبني المشهد بنفسه فلا يعتمد على بيانات قائمة: بنكاً مسموحاً،
-- وبنكاً غير مسموح، وامتحاناً حقيقياً — ثم ينتحل شخصية طالب ويحاول:
--
--   • أن ينادي دالة التصحيح المشتركة مباشرة
--   • أن يسأل عن سؤال من امتحان حقيقي
--   • أن يسأل عن بنك لم يُفتح له
--   • أن يسأل عن بنك مغلق
--   • أن يكتب في جدول تقدّمه بيده
--   • أن يقرأ تقدّم زميله
--
-- وأن الطريق الشرعي يعمل: يجيب فيُصحَّح ويُسجَّل تقدّمه ويرى الشرح.
--
-- داخل transaction ينتهي بـ rollback.
-- =============================================================================

begin;

create temporary table _t19 (
  n        integer generated always as identity,
  test     text,
  expected text,
  actual   text,
  "نجح"    boolean
) on commit drop;

grant insert, select on _t19 to authenticated;

do $$
declare
  v_admin    uuid;
  v_student  uuid;
  v_other    uuid;
  v_chapter  uuid;
  v_lesson   uuid;

  v_bank_ok  uuid;   -- بنك مسموح ومفتوح
  v_bank_no  uuid;   -- بنك لم يُفتح لهذا الطالب
  v_bank_shut uuid;  -- بنك مسموح لكنه مغلق
  v_exam     uuid;   -- امتحان حقيقي

  q_ok       uuid;
  q_no       uuid;
  q_shut     uuid;
  q_exam     uuid;

  o_ok       uuid[];
  o_exam     uuid[];

  v_res      jsonb;
  v_err      text;
  v_state    text;
  v_tries    integer;
  v_seen     integer;
begin
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  if v_admin is null then raise exception 'لا يوجد مدرّس.'; end if;

  select id into v_student
  from public.profiles where role = 'student' and status = 'active' limit 1;
  if v_student is null then raise exception 'لا يوجد طالب مفعّل.'; end if;

  -- طالب آخر لاختبار عزل التقدّم. لو لم يوجد نستعمل المدرّس كصاحب صف آخر.
  select id into v_other
  from public.profiles where id <> v_student order by created_at limit 1;

  ---------------------------------------------------------------------------
  -- مشهد محكم: نغلق full_access حتى لا تفتح الصلاحية الشاملة كل شيء
  ---------------------------------------------------------------------------
  update public.profiles set full_access = false where id = v_student;

  insert into public.chapters (title, position)
  values ('فصل اختبار 19', 9019) returning id into v_chapter;

  insert into public.lessons (chapter_id, title, position)
  values (v_chapter, 'درس اختبار 19', 9019) returning id into v_lesson;

  insert into public.exams (lesson_id, title, level, kind, is_open)
  values (v_lesson, 'بنك مسموح',      'basic', 'bank', true)  returning id into v_bank_ok;
  insert into public.exams (lesson_id, title, level, kind, is_open)
  values (v_lesson, 'بنك غير مسموح',  'basic', 'bank', true)  returning id into v_bank_no;
  insert into public.exams (lesson_id, title, level, kind, is_open)
  values (v_lesson, 'بنك مغلق',       'basic', 'bank', false) returning id into v_bank_shut;
  insert into public.exams (lesson_id, title, level, kind, is_open)
  values (v_lesson, 'امتحان حقيقي',   'basic', 'exam', true)  returning id into v_exam;

  -- سؤال البنك المسموح
  insert into public.questions (exam_id, position, type, body, points)
  values (v_bank_ok, 1, 'mcq_single', 'أي مما يلي بروتوكول مشفّر؟', 1)
  returning id into q_ok;
  insert into public.question_options (question_id, position, body)
  select q_ok, i, b from unnest(array['HTTP', 'HTTPS', 'FTP']) with ordinality as t(b, i);
  select array_agg(id order by position) into o_ok
  from public.question_options where question_id = q_ok;
  insert into public.question_keys (question_id, key, explanation)
  values (q_ok, jsonb_build_object('option_ids', jsonb_build_array(o_ok[2])),
          'الحرف S في HTTPS من Secure: طبقة تشفير فوق HTTP.');

  -- سؤال في بنك غير مسموح
  insert into public.questions (exam_id, position, type, body, points)
  values (v_bank_no, 1, 'true_false', 'سؤال في بنك مقفول عن الطالب', 1)
  returning id into q_no;
  insert into public.question_keys (question_id, key)
  values (q_no, jsonb_build_object('value', true));

  -- سؤال في بنك مغلق
  insert into public.questions (exam_id, position, type, body, points)
  values (v_bank_shut, 1, 'true_false', 'سؤال في بنك مغلق', 1)
  returning id into q_shut;
  insert into public.question_keys (question_id, key)
  values (q_shut, jsonb_build_object('value', true));

  -- سؤال في امتحان حقيقي — هذا هو ما لا يجوز أن يُسأل عنه أبداً
  insert into public.questions (exam_id, position, type, body, points)
  values (v_exam, 1, 'mcq_single', 'سؤال امتحان حقيقي', 2)
  returning id into q_exam;
  insert into public.question_options (question_id, position, body)
  select q_exam, i, b from unnest(array['أ', 'ب', 'ج']) with ordinality as t(b, i);
  select array_agg(id order by position) into o_exam
  from public.question_options where question_id = q_exam;
  insert into public.question_keys (question_id, key)
  values (q_exam, jsonb_build_object('option_ids', jsonb_build_array(o_exam[3])));

  -- الطالب مسموح له بالبنك الأول والمغلق فقط
  insert into public.permissions (student_id, resource_type, resource_id, granted_by)
  values (v_student, 'exam', v_bank_ok,   v_admin),
         (v_student, 'exam', v_bank_shut, v_admin),
         (v_student, 'exam', v_exam,      v_admin);

  -- صف تقدّم لطالب آخر، لنتأكد أن صاحبنا لا يراه
  if v_other is not null then
    insert into public.bank_progress (student_id, question_id, state)
    values (v_other, q_ok, 'wrong');
  end if;

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
  -- 1) آلة التصحيح المشتركة ممنوعة عليه
  ---------------------------------------------------------------------------
  begin
    perform public.grade_one(q_exam, jsonb_build_object(
      'option_ids', jsonb_build_array(o_exam[1]::text)));
    v_err := 'نجح النداء — تسريب';
  exception when others then
    v_err := 'مرفوض';
  end;
  insert into _t19 (test, expected, actual, "نجح") values
    ('الطالب ينادي grade_one مباشرة', 'مرفوض', v_err, v_err = 'مرفوض');

  ---------------------------------------------------------------------------
  -- 2) سؤال من امتحان حقيقي — أخطر محاولة على الإطلاق
  ---------------------------------------------------------------------------
  begin
    v_res := public.check_bank_answer(q_exam, jsonb_build_object(
      'option_ids', jsonb_build_array(o_exam[1]::text)));
    v_err := 'رد: ' || coalesce(v_res::text, 'null');
  exception when others then
    v_err := sqlerrm;
  end;
  insert into _t19 (test, expected, actual, "نجح") values
    ('يسأل البنك عن سؤال امتحان', 'NOT_A_BANK_QUESTION', v_err,
     v_err like '%NOT_A_BANK_QUESTION%');

  ---------------------------------------------------------------------------
  -- 3) بنك لم يُفتح له
  ---------------------------------------------------------------------------
  begin
    v_res := public.check_bank_answer(q_no, jsonb_build_object('value', true));
    v_err := 'رد: ' || coalesce(v_res::text, 'null');
  exception when others then
    v_err := sqlerrm;
  end;
  insert into _t19 (test, expected, actual, "نجح") values
    ('يسأل عن بنك بلا صلاحية', 'FORBIDDEN', v_err, v_err like '%FORBIDDEN%');

  ---------------------------------------------------------------------------
  -- 4) بنك مغلق وإن كان مسموحاً
  ---------------------------------------------------------------------------
  begin
    v_res := public.check_bank_answer(q_shut, jsonb_build_object('value', true));
    v_err := 'رد: ' || coalesce(v_res::text, 'null');
  exception when others then
    v_err := sqlerrm;
  end;
  insert into _t19 (test, expected, actual, "نجح") values
    ('يسأل عن بنك مغلق', 'BANK_CLOSED', v_err, v_err like '%BANK_CLOSED%');

  ---------------------------------------------------------------------------
  -- 5) يكتب في تقدّمه بيده
  ---------------------------------------------------------------------------
  begin
    insert into public.bank_progress (student_id, question_id, state)
    values (v_student, q_exam, 'correct');
    v_err := 'نجحت الكتابة';
  exception when others then
    v_err := 'مرفوض';
  end;
  insert into _t19 (test, expected, actual, "نجح") values
    ('الطالب يكتب في bank_progress مباشرة', 'مرفوض', v_err, v_err = 'مرفوض');

  ---------------------------------------------------------------------------
  -- 6) يقرأ تقدّم زميله
  ---------------------------------------------------------------------------
  select count(*) into v_seen
  from public.bank_progress where student_id <> v_student;
  insert into _t19 (test, expected, actual, "نجح") values
    ('الطالب يقرأ تقدّم غيره', '0 صف', v_seen::text, v_seen = 0);

  ---------------------------------------------------------------------------
  -- 7) الطريق الشرعي: إجابة خاطئة
  ---------------------------------------------------------------------------
  v_res := public.check_bank_answer(q_ok, jsonb_build_object(
    'option_ids', jsonb_build_array(o_ok[1]::text)));

  insert into _t19 (test, expected, actual, "نجح") values
    ('إجابة خاطئة: is_correct = false', 'false',
     (v_res ->> 'is_correct'), (v_res ->> 'is_correct') = 'false'),
    ('إجابة خاطئة: يرى المفتاح الصحيح', 'يحتوي معرّف HTTPS',
     case when v_res ->> 'correct' like '%' || o_ok[2]::text || '%'
          then 'نعم' else 'لا' end,
     v_res ->> 'correct' like '%' || o_ok[2]::text || '%'),
    ('إجابة خاطئة: يرى الشرح', 'موجود',
     coalesce(left(v_res ->> 'explanation', 20), 'غائب'),
     v_res ->> 'explanation' like '%Secure%');

  ---------------------------------------------------------------------------
  -- 8) الطريق الشرعي: إجابة صحيحة، والتقدّم يُسجَّل
  ---------------------------------------------------------------------------
  v_res := public.check_bank_answer(q_ok, jsonb_build_object(
    'option_ids', jsonb_build_array(o_ok[2]::text)));

  insert into _t19 (test, expected, actual, "نجح") values
    ('إجابة صحيحة: is_correct = true', 'true',
     (v_res ->> 'is_correct'), (v_res ->> 'is_correct') = 'true'),
    ('إجابة صحيحة: الدرجة كاملة', '1',
     (v_res ->> 'awarded'), (v_res ->> 'awarded')::numeric = 1);

  select state, tries into v_state, v_tries
  from public.bank_progress
  where student_id = v_student and question_id = q_ok;

  insert into _t19 (test, expected, actual, "نجح") values
    ('التقدّم صار "صح" بعد الإصابة', 'correct', v_state, v_state = 'correct'),
    ('عدد المحاولات اتسجّل', '2', v_tries::text, v_tries = 2);

  ---------------------------------------------------------------------------
  -- 9) من أصاب ثم عاد فأخطأ وهو يراجع لا يفقد "صح"
  ---------------------------------------------------------------------------
  v_res := public.check_bank_answer(q_ok, jsonb_build_object(
    'option_ids', jsonb_build_array(o_ok[3]::text)));

  select state into v_state
  from public.bank_progress
  where student_id = v_student and question_id = q_ok;

  insert into _t19 (test, expected, actual, "نجح") values
    ('المراجعة لا تُنقص من أصاب', 'correct', v_state, v_state = 'correct');

  ---------------------------------------------------------------------------
  -- 10) مفاتيح الامتحان الحقيقي ما زالت غير مقروءة بأي طريق
  ---------------------------------------------------------------------------
  select count(*) into v_seen from public.question_keys;
  insert into _t19 (test, expected, actual, "نجح") values
    ('جدول المفاتيح ما زال مقفولاً تماماً', '0 صف', v_seen::text, v_seen = 0);
end $$;

select n as "#", test as "الاختبار", expected as "المتوقع",
       actual as "الفعلي", "نجح"
from _t19 order by n;

select count(*) filter (where "نجح") || '/' || count(*) as "النتيجة" from _t19;

rollback;
