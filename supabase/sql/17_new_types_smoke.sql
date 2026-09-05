-- =============================================================================
-- منصة البرمجة — 17: اختبار تصحيح الأنواع الثلاثة الجديدة
--
-- يبني امتحاناً فيه توصيل وترتيب وتصنيف، ينتحل شخصية طالب حقيقي، يجيب
-- إجابات محسوبة (بعضها كامل وبعضها ناقص)، يسلّم، ثم يتحقق أن كل درجة
-- جزئية خرجت بالرقم المتوقع تماماً.
--
-- ما يغطيه ولا تكفي قراءة الكود للتأكد منه:
--   • الدرجة الجزئية: نسبة العناصر الصحيحة من مجموعها
--   • أن العنصر المتروك فارغاً يُحسب خطأً لا يُتجاهل
--   • أن is_correct لا تصير true إلا إذا صح كل عنصر
--   • أن الترتيب يُصحَّح بأرقام المواضع لا بمعرّفات
--   • أن الإجابات الصحيحة لا تصل الطالب والمفتاح مقفول
--
-- المتطلبات: حساب مدرّس وحساب طالب مفعّل.
-- داخل transaction ينتهي بـ rollback، فلا يترك أثراً.
-- =============================================================================

begin;

create temporary table _t17 (
  n        integer generated always as identity,
  test     text,
  expected text,
  actual   text,
  "نجح"    boolean
) on commit drop;

-- جزء من الاختبار يجري بدور الطالب، فيحتاج الكتابة في جدول النتائج
grant insert, select on _t17 to authenticated;

do $$
declare
  v_student uuid;
  v_admin   uuid;
  v_chapter uuid;
  v_lesson  uuid;
  v_exam    uuid;

  q_match   uuid;
  q_order   uuid;
  q_class   uuid;

  o_match   uuid[];   -- 3 أوصاف ثم 4 مصطلحات
  o_order   uuid[];   -- 4 خطوات
  o_class   uuid[];   -- 4 عناصر ثم سلّتان

  v_attempt uuid;
  v_submit  jsonb;
  v_review  jsonb;

  v_pts     numeric;
  v_ok      boolean;
  v_leak    integer;
begin
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  if v_admin is null then
    raise exception 'لا يوجد حساب مدرّس.';
  end if;

  select id into v_student
  from public.profiles where role = 'student' and status = 'active' limit 1;
  if v_student is null then
    raise exception 'لا يوجد طالب مفعّل.';
  end if;

  insert into public.chapters (title, position)
  values ('فصل اختبار 17', 9017) returning id into v_chapter;

  insert into public.lessons (chapter_id, title, position)
  values (v_chapter, 'درس اختبار 17', 9017) returning id into v_lesson;

  insert into public.exams (lesson_id, title, level, duration_minutes, is_open, reveal_answers)
  values (v_lesson, 'امتحان الأنواع الجديدة', 'basic', 30, true, false)
  returning id into v_exam;

  ---------------------------------------------------------------------------
  -- سؤال ١: توصيل — 3 درجات، 3 أوصاف و4 مصطلحات (الرابع مموّه)
  --
  -- المخزَّن: 1..3 أوصاف، 4..7 مصطلحات. المفتاح يشير بالمعرّفات.
  ---------------------------------------------------------------------------
  insert into public.questions (exam_id, position, type, body, points)
  values (v_exam, 1, 'matching', 'طابق كل وصف بمصطلحه:', 3)
  returning id into q_match;

  insert into public.question_options (question_id, position, body, role)
  select q_match, i, b, case when i <= 3 then 'item' else 'choice' end
  from unnest(array[
    'نقل مشفّر', 'طلب بيانات', 'إرسال بيانات',      -- الأوصاف
    'HTTPS', 'GET', 'POST', 'FTP'                    -- المصطلحات
  ]) with ordinality as t(b, i);

  select array_agg(id order by position) into o_match
  from public.question_options where question_id = q_match;

  insert into public.question_keys (question_id, key)
  values (q_match, jsonb_build_object('assign', jsonb_build_array(
    o_match[4]::text, o_match[5]::text, o_match[6]::text)));

  ---------------------------------------------------------------------------
  -- سؤال ٢: ترتيب — 4 درجات، 4 خطوات. المفتاح أرقام مواضع لا معرّفات.
  --
  -- المخزَّن مبعثر عمداً: الخطوة المخزّنة أولاً مكانها الصحيح الثالث.
  ---------------------------------------------------------------------------
  insert into public.questions (exam_id, position, type, body, points)
  values (v_exam, 2, 'ordering', 'رتّب خطوات الاتصال:', 4)
  returning id into q_order;

  insert into public.question_options (question_id, position, body, role)
  select q_order, i, b, 'item'
  from unnest(array['ج', 'أ', 'د', 'ب']) with ordinality as t(b, i);

  select array_agg(id order by position) into o_order
  from public.question_options where question_id = q_order;

  -- المخزَّن [ج، أ، د، ب] ومكان كل منها الصحيح [3، 1، 4، 2]
  insert into public.question_keys (question_id, key)
  values (q_order, jsonb_build_object('assign', jsonb_build_array(3, 1, 4, 2)));

  ---------------------------------------------------------------------------
  -- سؤال ٣: تصنيف — 4 درجات، 4 عناصر وسلّتان. التكرار مسموح هنا.
  ---------------------------------------------------------------------------
  insert into public.questions (exam_id, position, type, body, points)
  values (v_exam, 3, 'classification', 'صنّف كل عملية:', 4)
  returning id into q_class;

  insert into public.question_options (question_id, position, body, role)
  select q_class, i, b, case when i <= 4 then 'item' else 'choice' end
  from unnest(array[
    'عرض المنتجات', 'تسجيل حساب', 'بحث', 'إرسال نموذج',  -- العناصر
    'GET', 'POST'                                          -- السلال
  ]) with ordinality as t(b, i);

  select array_agg(id order by position) into o_class
  from public.question_options where question_id = q_class;

  -- الصحيح: GET، POST، GET، POST
  insert into public.question_keys (question_id, key)
  values (q_class, jsonb_build_object('assign', jsonb_build_array(
    o_class[5]::text, o_class[6]::text, o_class[5]::text, o_class[6]::text)));

  ---------------------------------------------------------------------------
  -- افتح الامتحان للطالب، ثم صِر هو
  ---------------------------------------------------------------------------
  insert into public.permissions (student_id, resource_type, resource_id, granted_by)
  values (v_student, 'exam', v_exam, v_admin);

  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text,
    true
  );

  v_attempt := public.start_exam(v_exam);

  -- توصيل: أول اثنين صح والثالث غلط (اختار FTP)   المتوقع 2 من 3
  insert into public.answers (attempt_id, question_id, response)
  values (v_attempt, q_match, jsonb_build_object('assign', jsonb_build_array(
    o_match[4]::text, o_match[5]::text, o_match[7]::text)));

  -- ترتيب: عكس آخر اثنين                          المتوقع 2 من 4
  insert into public.answers (attempt_id, question_id, response)
  values (v_attempt, q_order, jsonb_build_object('assign', jsonb_build_array(3, 1, 2, 4)));

  -- تصنيف: ثلاثة صح، والرابع تُرك فارغاً          المتوقع 3 من 4
  insert into public.answers (attempt_id, question_id, response)
  values (v_attempt, q_class, jsonb_build_object('assign', jsonb_build_array(
    o_class[5]::text, o_class[6]::text, o_class[5]::text, null)));

  v_submit := public.submit_exam(v_attempt);

  ---------------------------------------------------------------------------
  -- تحقّق من الدرجات
  --
  -- نعود لدور المدرّس هنا عمداً: سياسة answers_select تمنع الطالب من قراءة
  -- جدول الإجابات بعد التسليم، ومراجعته تمر حصراً عبر get_attempt_review.
  -- أن يفشل القراءة المباشرة هنا هو الوضع الصحيح، لا عائق في الاختبار.
  ---------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);

  select awarded_points, is_correct into v_pts, v_ok
  from public.answers where attempt_id = v_attempt and question_id = q_match;
  insert into _t17 (test, expected, actual, "نجح") values
    ('توصيل: 2 من 3 صح', '2.00 من 3', v_pts::text, v_pts = 2.00),
    ('توصيل: is_correct = false لأن عنصراً غلط', 'false', v_ok::text, v_ok is false);

  select awarded_points into v_pts
  from public.answers where attempt_id = v_attempt and question_id = q_order;
  insert into _t17 (test, expected, actual, "نجح") values
    ('ترتيب: مكانان صح من أربعة', '2.00 من 4', v_pts::text, v_pts = 2.00);

  select awarded_points into v_pts
  from public.answers where attempt_id = v_attempt and question_id = q_class;
  insert into _t17 (test, expected, actual, "نجح") values
    ('تصنيف: 3 من 4 والمتروك فارغاً يُحسب خطأً', '3.00 من 4', v_pts::text, v_pts = 3.00);

  insert into _t17 (test, expected, actual, "نجح") values
    ('المجموع الآلي 2+2+3',
     '7.00',
     (v_submit ->> 'auto_score'),
     (v_submit ->> 'auto_score')::numeric = 7.00),
    ('مجموع الدرجات 3+4+4',
     '11.00',
     (v_submit ->> 'total_points'),
     (v_submit ->> 'total_points')::numeric = 11.00),
    ('الحالة "مصحّح" لأن مفيش مقالي',
     'graded',
     (select status::text from public.exam_attempts where id = v_attempt),
     (select status::text from public.exam_attempts where id = v_attempt) = 'graded');

  ---------------------------------------------------------------------------
  -- الأمان: المفتاح مقفول، فلا شيء من الإجابات يصل الطالب
  ---------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text,
    true
  );

  v_review := public.get_attempt_review(v_attempt);

  select count(*) into v_leak
  from jsonb_array_elements(v_review -> 'questions') as q
  where q -> 'correct' <> 'null'::jsonb;

  insert into _t17 (test, expected, actual, "نجح") values
    ('صفر مفتاح يصل الطالب والإظهار مقفول', '0', v_leak::text, v_leak = 0);

  -- ولا حتى نصاً: معرّف المصطلح الصحيح لا يظهر في أي مكان من الحمولة
  insert into _t17 (test, expected, actual, "نجح") values
    ('is_correct مخفية أيضاً',
     '0',
     (select count(*)::text from jsonb_array_elements(v_review -> 'questions') as q
       where q -> 'is_correct' <> 'null'::jsonb),
     (select count(*) from jsonb_array_elements(v_review -> 'questions') as q
       where q -> 'is_correct' <> 'null'::jsonb) = 0);

  -- ومع ذلك الدرجة الكلية تظهر فوراً: الدرجة شيء والمفتاح شيء آخر
  insert into _t17 (test, expected, actual, "نجح") values
    ('الدرجة الكلية ظاهرة رغم قفل المفتاح',
     '7.00',
     (v_review -> 'attempt' ->> 'auto_score'),
     (v_review -> 'attempt' ->> 'auto_score')::numeric = 7.00);

  ---------------------------------------------------------------------------
  -- افتح الإظهار: الآن يرى الطالب المفتاح ودور كل خيار
  ---------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
  update public.exams set reveal_answers = true where id = v_exam;

  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text,
    true
  );

  v_review := public.get_attempt_review(v_attempt);

  insert into _t17 (test, expected, actual, "نجح") values
    ('بعد الفتح: المفاتيح الثلاثة كلها تظهر',
     '3',
     (select count(*)::text from jsonb_array_elements(v_review -> 'questions') as q
       where q -> 'correct' <> 'null'::jsonb),
     (select count(*) from jsonb_array_elements(v_review -> 'questions') as q
       where q -> 'correct' <> 'null'::jsonb) = 3),
    ('دور كل خيار يصل الواجهة لتفرّق العناصر عن الاختيارات',
     'item و choice موجودان',
     (select string_agg(distinct o ->> 'role', ' و ')
        from jsonb_array_elements(v_review -> 'questions') as q,
             jsonb_array_elements(q -> 'options') as o),
     (select count(distinct o ->> 'role')
        from jsonb_array_elements(v_review -> 'questions') as q,
             jsonb_array_elements(q -> 'options') as o) = 2);
end $$;

select n as "#", test as "الاختبار", expected as "المتوقع",
       actual as "الفعلي", "نجح"
from _t17 order by n;

select count(*) filter (where "نجح") || '/' || count(*) as "النتيجة" from _t17;

rollback;
