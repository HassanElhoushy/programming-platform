\-- =============================================================================
-- منصة البرمجة — 11: اختبار سرّية الإجابة النموذجية
--
-- الإجابة النموذجية أخطر من مفتاح الاختياري: نص جاهز للنسخ حرفياً. هذا
-- الملف يكتب واحدة على سؤال حقيقي ثم يقرأ الحمولة بصلاحيات الطالب مرتين،
-- والمفتاح مقفول ثم مفتوح، ويبحث عن النص في الحمولة كلها لا في حقله فقط.
--
-- transaction ينتهي بـ rollback: لا يغيّر بياناتك ولا إعداد الامتحان.
-- =============================================================================

pset border 2
-- يكتب إجابة نموذجية على سؤال مقالي حقيقي، ثم يقرأ الحمولة بصلاحيات الطالب
-- مرتين: والمفتاح مقفول ثم مفتوح. كل شيء داخل transaction ينتهي بـ rollback.
begin;

do $$
declare
  v_student uuid;
  v_admin   uuid;
  v_attempt uuid;
  v_exam    uuid;
  v_essay   uuid;
  v_review  jsonb;

  v_secret  text := 'نص سرّي جداً للإجابة النموذجية لا يجوز أن يراه الطالب قبل الفتح';

  v_closed_model   integer;
  v_closed_correct integer;
  v_open_model     integer;
  v_direct_read    integer;
  v_payload_has    boolean;
begin
  select id into v_admin   from public.profiles where role = 'admin' limit 1;

  select a.id, a.exam_id, a.student_id into v_attempt, v_exam, v_student
  from public.exam_attempts a
  where a.status <> 'in_progress' and a.voided_at is null
  order by a.submitted_at desc limit 1;

  select q.id into v_essay
  from public.questions q
  where q.exam_id = v_exam and q.type = 'essay'
  order by q.position limit 1;

  if v_essay is null then
    raise exception 'لا يوجد سؤال مقالي في هذا الامتحان.';
  end if;

  -- اكتب الإجابة النموذجية كما يفعل زر لوحة المدرّس
  insert into public.question_keys (question_id, key, model_answer)
  values (v_essay, null, v_secret)
  on conflict (question_id) do update set model_answer = excluded.model_answer;

  ---------------------------------------------------------------------------
  -- الحالة الأولى: المفتاح مقفول
  ---------------------------------------------------------------------------
  update public.exams set reveal_answers = false where id = v_exam;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  -- هل يستطيع الطالب قراءة الجدول المحمي مباشرة؟
  select count(*) into v_direct_read from public.question_keys;

  v_review := public.get_attempt_review(v_attempt);

  select count(*) into v_closed_model
  from jsonb_array_elements(v_review -> 'questions') q
  where q -> 'model_answer' <> 'null'::jsonb;

  select count(*) into v_closed_correct
  from jsonb_array_elements(v_review -> 'questions') q
  where q -> 'correct' <> 'null'::jsonb;

  -- هل النص السرّي موجود في أي مكان من الحمولة كاملةً؟
  v_payload_has := v_review::text like '%' || v_secret || '%';

  ---------------------------------------------------------------------------
  -- الحالة الثانية: المفتاح مفتوح
  ---------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  update public.exams set reveal_answers = true where id = v_exam;

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text, true);

  v_review := public.get_attempt_review(v_attempt);

  select count(*) into v_open_model
  from jsonb_array_elements(v_review -> 'questions') q
  where q ->> 'model_answer' = v_secret;

  perform set_config('role', 'postgres', true);

  create temporary table _m (
    n integer generated always as identity,
    test text, expected text, actual text, "نجح" boolean
  ) on commit drop;

  insert into _m (test, expected, actual, "نجح") values
    ('قراءة الطالب المباشرة لجدول question_keys', '0',
     v_direct_read::text, v_direct_read = 0),

    ('الإجابة النموذجية والمفتاح مقفول', '0',
     v_closed_model::text, v_closed_model = 0),

    ('الإجابات الصحيحة والمفتاح مقفول', '0',
     v_closed_correct::text, v_closed_correct = 0),

    ('النص السرّي في أي موضع من الحمولة', 'غير موجود',
     case when v_payload_has then 'موجود (خطر!)' else 'غير موجود' end,
     not v_payload_has),

    ('الإجابة النموذجية بعد فتح المفتاح', '1',
     v_open_model::text, v_open_model = 1);
end $$;

select n as "#", test as "الاختبار", expected as "المتوقع", actual as "الفعلي", "نجح"
from _m order by n;

rollback;
