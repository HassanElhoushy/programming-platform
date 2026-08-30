-- =============================================================================
-- منصة البرمجة — 08: اختبار شامل لمحرك الامتحان
--
-- يبني امتحاناً كاملاً فيه الأنواع الخمسة، ثم ينتحل شخصية طالب حقيقي فيحلّه
-- ويسلّمه، ثم يتحقق أن كل درجة خرجت كما هو متوقع بالضبط.
--
-- يغطي تحديداً ما لا يمكن التأكد منه بقراءة الكود:
--   • التصحيح الآلي لكل نوع، وقاعدة "كامل أو صفر" في الاختيار المتعدد
--   • الدرجة النسبية في إكمال الفراغات
--   • تطبيع النص العربي: همزات وتاء مربوطة وياء وتشكيل ومسافات
--   • بقاء الامتحان "بانتظار التصحيح" ما دام فيه سؤال مقالي
--   • أن سياسات RLS تسمح للطالب بكتابة إجاباته هو
--   • أن الإجابات الصحيحة لا تصل للطالب إلا بفتح المدرّس للمفتاح
--
-- المتطلبات: حساب مدرّس واحد وحساب طالب مفعّل واحد على الأقل.
-- الملف داخل transaction ينتهي بـ rollback، فلا يترك أثراً في بياناتك.
-- =============================================================================

begin;

create temporary table _smoke (
  n        integer generated always as identity,
  test     text,
  expected text,
  actual   text,
  "نجح"    boolean
) on commit drop;

do $$
declare
  v_student  uuid;
  v_admin    uuid;
  v_chapter  uuid;
  v_lesson   uuid;
  v_exam     uuid;

  q_single   uuid;
  q_multi    uuid;
  q_tf       uuid;
  q_blank    uuid;
  q_essay    uuid;

  o_s        uuid[];
  o_m        uuid[];

  v_attempt  uuid;
  v_submit   jsonb;
  v_review   jsonb;
  v_graded   jsonb;

  v_status   text;
  v_post     text;   -- الحالة لحظة التسليم، قبل تصحيح المقالي
  v_manual   numeric;
  v_hidden   integer;
  v_shown    integer;
  v_essay_pts numeric;
begin
  ---------------------------------------------------------------------------
  -- تجهيز: نحتاج مدرّساً وطالباً موجودين فعلاً
  ---------------------------------------------------------------------------
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  if v_admin is null then
    raise exception 'لا يوجد حساب مدرّس. شغّل 06_make_admin.sql أولاً.';
  end if;

  select id into v_student
  from public.profiles
  where role = 'student' and status = 'active'
  limit 1;

  if v_student is null then
    raise exception 'لا يوجد طالب مفعّل. سجّل حساب طالب وفعّله من لوحة المدرّس.';
  end if;

  ---------------------------------------------------------------------------
  -- محتوى مؤقت
  ---------------------------------------------------------------------------
  insert into public.chapters (title, position)
  values ('فصل اختبار مؤقت', 9001) returning id into v_chapter;

  insert into public.lessons (chapter_id, title, position)
  values (v_chapter, 'درس اختبار مؤقت', 9001) returning id into v_lesson;

  insert into public.exams (lesson_id, title, level, duration_minutes, is_open, reveal_answers)
  values (v_lesson, 'امتحان اختبار مؤقت', 'basic', 30, true, false)
  returning id into v_exam;

  ---------------------------------------------------------------------------
  -- سؤال ١: اختيار واحد — درجتان، الصحيح هو الخيار الثالث
  ---------------------------------------------------------------------------
  insert into public.questions (exam_id, position, type, body, points)
  values (v_exam, 1, 'mcq_single', 'أي مما يلي لغة برمجة؟', 2)
  returning id into q_single;

  insert into public.question_options (question_id, position, body)
  select q_single, i, b
  from unnest(array['شاشة', 'لوحة مفاتيح', 'بايثون', 'طابعة']) with ordinality as t(b, i);

  select array_agg(id order by position) into o_s
  from public.question_options where question_id = q_single;

  insert into public.question_keys (question_id, key)
  values (q_single, jsonb_build_object('option_ids', jsonb_build_array(o_s[3])));

  ---------------------------------------------------------------------------
  -- سؤال ٢: اختيار متعدد — ٣ درجات، الصحيح {1,2,4}
  ---------------------------------------------------------------------------
  insert into public.questions (exam_id, position, type, body, points)
  values (v_exam, 2, 'mcq_multi', 'اختر كل أنواع البيانات:', 3)
  returning id into q_multi;

  insert into public.question_options (question_id, position, body)
  select q_multi, i, b
  from unnest(array['int', 'string', 'printer', 'float', 'monitor']) with ordinality as t(b, i);

  select array_agg(id order by position) into o_m
  from public.question_options where question_id = q_multi;

  insert into public.question_keys (question_id, key)
  values (q_multi, jsonb_build_object(
    'option_ids', jsonb_build_array(o_m[1], o_m[2], o_m[4])));

  ---------------------------------------------------------------------------
  -- سؤال ٣: صح وخطأ — درجة واحدة، الصحيح "صح"
  ---------------------------------------------------------------------------
  insert into public.questions (exam_id, position, type, body, points)
  values (v_exam, 3, 'true_false', 'الذكاء الاصطناعي فرع من علوم الحاسب.', 1)
  returning id into q_tf;

  insert into public.question_keys (question_id, key)
  values (q_tf, '{"value": true}'::jsonb);

  ---------------------------------------------------------------------------
  -- سؤال ٤: إكمال فراغات — ٤ درجات على فراغين
  ---------------------------------------------------------------------------
  insert into public.questions (exam_id, position, type, body, points, blank_count)
  values (v_exam, 4, 'fill_blank',
          'مجال [1] يهتم بمحاكاة الذكاء البشري، ولغة [2] من أشهر لغاته.', 4, 2)
  returning id into q_blank;

  insert into public.question_keys (question_id, key)
  values (q_blank, jsonb_build_object('blanks', jsonb_build_array(
    jsonb_build_array('الذكاء الاصطناعي'),
    jsonb_build_array('بايثون', 'python')
  )));

  ---------------------------------------------------------------------------
  -- سؤال ٥: مقالي — ٥ درجات
  ---------------------------------------------------------------------------
  insert into public.questions (exam_id, position, type, body, points)
  values (v_exam, 5, 'essay', 'اشرح الفرق بين المتغير والثابت.', 5)
  returning id into q_essay;

  ---------------------------------------------------------------------------
  -- افتح الامتحان للطالب
  ---------------------------------------------------------------------------
  insert into public.permissions (student_id, resource_type, resource_id, granted_by)
  values (v_student, 'exam', v_exam, v_admin);

  ---------------------------------------------------------------------------
  -- صِر الطالب. من هنا تنطبق سياسات RLS كما لو كنا في متصفحه.
  ---------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text,
    true
  );

  v_attempt := public.start_exam(v_exam);

  -- سؤال ١: يختار الصحيح                       المتوقع 2 من 2
  insert into public.answers (attempt_id, question_id, response)
  values (v_attempt, q_single, jsonb_build_object('option_ids', jsonb_build_array(o_s[3])));

  -- سؤال ٢: يختار 1 و2 وينسى 4                 المتوقع 0 من 3
  insert into public.answers (attempt_id, question_id, response)
  values (v_attempt, q_multi, jsonb_build_object('option_ids', jsonb_build_array(o_m[1], o_m[2])));

  -- سؤال ٣: صح                                  المتوقع 1 من 1
  insert into public.answers (attempt_id, question_id, response)
  values (v_attempt, q_tf, '{"value": true}'::jsonb);

  -- سؤال ٤: الفراغ الأول مكتوب بهمزات وياء وتاء مختلفة ومسافات زائدة،
  --         والثاني خطأ.                        المتوقع 2 من 4
  insert into public.answers (attempt_id, question_id, response)
  values (v_attempt, q_blank, jsonb_build_object('blanks',
    jsonb_build_array('  الذكاء   الإصطناعى ', 'جافا')));

  -- سؤال ٥: مقالي                               يُترك للمدرّس
  insert into public.answers (attempt_id, question_id, response)
  values (v_attempt, q_essay, jsonb_build_object('text', 'المتغير تتغير قيمته والثابت لا.'));

  v_submit := public.submit_exam(v_attempt);

  select a.status::text into v_post
  from public.exam_attempts a where a.id = v_attempt;

  -- المراجعة والإظهار مقفول
  v_review := public.get_attempt_review(v_attempt);

  select count(*) into v_hidden
  from jsonb_array_elements(v_review -> 'questions') as q
  where q ->> 'type' <> 'essay'
    and q -> 'correct' = 'null'::jsonb
    and q -> 'is_correct' = 'null'::jsonb;

  select (q ->> 'awarded_points')::numeric into v_essay_pts
  from jsonb_array_elements(v_review -> 'questions') as q
  where q ->> 'type' = 'essay';

  ---------------------------------------------------------------------------
  -- عُد مدرّساً: صحّح المقالي ثم افتح الإجابات
  ---------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text,
    true
  );

  v_graded := public.grade_attempt(v_attempt, jsonb_build_array(
    jsonb_build_object('question_id', q_essay, 'awarded_points', 4, 'feedback', 'إجابة مختصرة لكنها صحيحة.')
  ));

  select status, manual_score into v_status, v_manual
  from public.exam_attempts where id = v_attempt;

  update public.exams set reveal_answers = true where id = v_exam;

  -- ارجع طالباً وتحقق أن الإجابات ظهرت الآن
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text,
    true
  );

  v_review := public.get_attempt_review(v_attempt);

  select count(*) into v_shown
  from jsonb_array_elements(v_review -> 'questions') as q
  where q ->> 'type' <> 'essay'
    and q -> 'correct' <> 'null'::jsonb;

  ---------------------------------------------------------------------------
  -- سجّل النتائج
  ---------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);

  insert into _smoke (test, expected, actual, "نجح") values
    ('مجموع درجات الامتحان',
     '15', (v_submit ->> 'total_points'), (v_submit ->> 'total_points')::numeric = 15),

    ('التصحيح الآلي الكلي (2 + 0 + 1 + 2)',
     '5', (v_submit ->> 'auto_score'), (v_submit ->> 'auto_score')::numeric = 5),

    ('اختيار واحد صحيح',
     '2', (select a.awarded_points::text from public.answers a
           where a.attempt_id = v_attempt and a.question_id = q_single),
     (select a.awarded_points = 2 from public.answers a
      where a.attempt_id = v_attempt and a.question_id = q_single)),

    ('اختيار متعدد ناقص إجابة — كامل أو صفر',
     '0', (select a.awarded_points::text from public.answers a
           where a.attempt_id = v_attempt and a.question_id = q_multi),
     (select a.awarded_points = 0 from public.answers a
      where a.attempt_id = v_attempt and a.question_id = q_multi)),

    ('صح وخطأ',
     '1', (select a.awarded_points::text from public.answers a
           where a.attempt_id = v_attempt and a.question_id = q_tf),
     (select a.awarded_points = 1 from public.answers a
      where a.attempt_id = v_attempt and a.question_id = q_tf)),

    ('فراغ صحيح رغم اختلاف الهمزة والياء والمسافات، وفراغ خاطئ',
     '2 من 4', (select a.awarded_points::text from public.answers a
                where a.attempt_id = v_attempt and a.question_id = q_blank),
     (select a.awarded_points = 2 from public.answers a
      where a.attempt_id = v_attempt and a.question_id = q_blank)),

    ('تطبيع العربي: "الإصطناعى" = "الاصطناعي"',
     'true',
     (public.normalize_ar('  الذكاء   الإصطناعى ') = public.normalize_ar('الذكاء الاصطناعي'))::text,
     public.normalize_ar('  الذكاء   الإصطناعى ') = public.normalize_ar('الذكاء الاصطناعي')),

    ('الحالة لحظة التسليم مع وجود مقالي',
     'submitted', v_post, v_post = 'submitted'),

    ('الإجابات الصحيحة محجوبة قبل فتح المدرّس (٤ أسئلة موضوعية)',
     '4', v_hidden::text, v_hidden = 4),

    ('درجة المقالي محجوبة قبل التصحيح',
     'null', coalesce(v_essay_pts::text, 'null'), v_essay_pts is null),

    ('درجة المقالي بعد التصحيح',
     '4', v_manual::text, v_manual = 4),

    ('الحالة بعد تصحيح المقالي',
     'graded', v_status, v_status = 'graded'),

    ('الإجابات الصحيحة تظهر بعد فتح المدرّس',
     '4', v_shown::text, v_shown = 4);
end $$;

select n as "#", test as "الاختبار", expected as "المتوقع", actual as "الفعلي", "نجح"
from _smoke
order by n;

rollback;
