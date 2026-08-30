-- =============================================================================
-- منصة البرمجة — 07: اختبار الأمان (شغّله وقتما تشاء)
--
-- ينتحل شخصية طالب حقيقي داخل قاعدة البيانات نفسها، بنفس الصلاحيات التي
-- يملكها متصفحه بالضبط، ثم يحاول الوصول لما لا يُفترض أن يصل إليه.
--
-- الاختبار يبني سيناريوه بنفسه بدل الاعتماد على بياناتك الحالية: يوقف
-- "كل الصلاحيات" عن الطالب مؤقتاً، وينشئ محتوىً نصفه مسموح ونصفه محجوب،
-- فتصير الأرقام المتوقعة معروفة سلفاً بدل أن تتغير بتغيّر بياناتك.
--
-- كل ذلك داخل transaction ينتهي بـ rollback: لا يتغير شيء في بياناتك.
-- المطلوب فقط: حساب مدرّس وحساب طالب مفعّل.
-- =============================================================================

begin;

create temporary table _sec (
  n        integer generated always as identity,
  test     text,
  expected text,
  actual   text,
  "نجح"    boolean
) on commit drop;

do $$
declare
  v_student uuid;
  v_admin   uuid;
  v_name    text;

  v_chapter uuid;
  v_lesson  uuid;
  v_ok_exam uuid;
  v_no_exam uuid;
  v_ok_file uuid;
  v_no_file uuid;
  v_ok_q    uuid;
  v_no_q    uuid;
  v_other   uuid;

  v_keys      integer;
  v_exams     integer;
  v_files     integer;
  v_questions integer;
  v_options   integer;
  v_people    integer;
  v_attempts  integer;
  v_answers   integer;
  v_perms     integer;
  v_direct    integer;

  v_esc_perm   text;
  v_esc_role   text;
  v_esc_review text;
  v_esc_start  text;
begin
  ---------------------------------------------------------------------------
  -- من نختبر
  ---------------------------------------------------------------------------
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  if v_admin is null then
    raise exception 'لا يوجد حساب مدرّس. شغّل 06_make_admin.sql أولاً.';
  end if;

  select id, full_name into v_student, v_name
  from public.profiles
  where role = 'student' and status = 'active'
  order by created_at
  limit 1;

  if v_student is null then
    raise exception 'لا يوجد طالب مفعّل. فعّل حساب طالب من لوحة المدرّس.';
  end if;

  ---------------------------------------------------------------------------
  -- سيناريو محكوم: لا صلاحيات شاملة، ومحتوى نصفه محجوب
  ---------------------------------------------------------------------------
  update public.profiles set full_access = false where id = v_student;
  delete from public.permissions where student_id = v_student;

  insert into public.chapters (title, position)
  values ('فصل اختبار أمان', 9101) returning id into v_chapter;

  insert into public.lessons (chapter_id, title, position)
  values (v_chapter, 'درس اختبار أمان', 9101) returning id into v_lesson;

  insert into public.exams (lesson_id, title, level, is_open)
  values (v_lesson, 'امتحان مسموح', 'basic', true) returning id into v_ok_exam;

  insert into public.exams (lesson_id, title, level, is_open)
  values (v_lesson, 'امتحان محجوب', 'basic', true) returning id into v_no_exam;

  insert into public.lesson_files (lesson_id, title, kind, storage_path)
  values (v_lesson, 'ملف مسموح', 'explanation', 'x/ok.pdf') returning id into v_ok_file;

  insert into public.lesson_files (lesson_id, title, kind, storage_path)
  values (v_lesson, 'ملف محجوب', 'explanation', 'x/no.pdf') returning id into v_no_file;

  insert into public.questions (exam_id, position, type, body, points)
  values (v_ok_exam, 1, 'true_false', 'سؤال في امتحان مسموح', 1) returning id into v_ok_q;

  insert into public.questions (exam_id, position, type, body, points)
  values (v_no_exam, 1, 'mcq_single', 'سؤال في امتحان محجوب', 1) returning id into v_no_q;

  insert into public.question_keys (question_id, key)
  values (v_ok_q, '{"value": true}'::jsonb);

  insert into public.question_options (question_id, position, body)
  values (v_no_q, 1, 'خيار محجوب أول'), (v_no_q, 2, 'خيار محجوب ثانٍ');

  insert into public.question_keys (question_id, key)
  values (v_no_q, jsonb_build_object('option_ids', jsonb_build_array(
    (select id from public.question_options where question_id = v_no_q order by position limit 1))));

  -- امنح المسموح فقط
  insert into public.permissions (student_id, resource_type, resource_id, granted_by)
  values (v_student, 'exam', v_ok_exam, v_admin),
         (v_student, 'file', v_ok_file, v_admin);

  -- محاولة تخص شخصاً آخر (نستخدم حساب المدرّس كصاحبها)
  insert into public.exam_attempts (exam_id, student_id, status, submitted_at, total_points, auto_score)
  values (v_ok_exam, v_admin, 'graded', now(), 1, 1) returning id into v_other;

  insert into public.answers (attempt_id, question_id, response, awarded_points, is_correct)
  values (v_other, v_ok_q, '{"value": true}'::jsonb, 1, true);

  ---------------------------------------------------------------------------
  -- صِر الطالب. من هنا الصلاحيات هي صلاحيات متصفحه بالضبط.
  ---------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text,
    true
  );

  select count(*) into v_keys      from public.question_keys;
  select count(*) into v_exams     from public.exams where id in (v_ok_exam, v_no_exam);
  select count(*) into v_files     from public.lesson_files where id in (v_ok_file, v_no_file);
  select count(*) into v_questions from public.questions where exam_id in (v_ok_exam, v_no_exam);
  select count(*) into v_options   from public.question_options where question_id = v_no_q;
  select count(*) into v_people    from public.profiles where id <> v_student;
  select count(*) into v_attempts  from public.exam_attempts where student_id <> v_student;
  select count(*) into v_direct    from public.exams where id = v_no_exam;

  select count(*) into v_answers
  from public.answers a
  join public.exam_attempts t on t.id = a.attempt_id
  where t.student_id <> v_student or t.status <> 'in_progress';

  select count(*) into v_perms from public.permissions where student_id <> v_student;

  -- منح النفس صلاحية على الامتحان المحجوب
  begin
    insert into public.permissions (student_id, resource_type, resource_id)
    values (v_student, 'exam', v_no_exam);
    v_esc_perm := 'نجح (خطر!)';
  exception when others then
    v_esc_perm := 'مرفوض';
  end;

  -- ترقية النفس إلى مدرّس
  begin
    update public.profiles set role = 'admin', full_access = true where id = v_student;
    if found then v_esc_role := 'نجح (خطر!)'; else v_esc_role := 'مرفوض'; end if;
  exception when others then
    v_esc_role := 'مرفوض';
  end;

  -- فتح مراجعة محاولة شخص آخر
  begin
    perform public.get_attempt_review(v_other);
    v_esc_review := 'نجح (خطر!)';
  exception when others then
    v_esc_review := 'مرفوض';
  end;

  -- بدء امتحان محجوب
  begin
    perform public.start_exam(v_no_exam);
    v_esc_start := 'نجح (خطر!)';
  exception when others then
    v_esc_start := 'مرفوض';
  end;

  ---------------------------------------------------------------------------
  -- سجّل النتائج
  ---------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);

  insert into _sec (test, expected, actual, "نجح") values
    ('الطالب المُختبَر', '—', v_name || ' (صلاحيات تفصيلية مؤقتة)', true),
    ('قراءة مفاتيح الإجابات question_keys', '0', v_keys::text, v_keys = 0),
    ('الامتحانات المرئية من اثنين', '1', v_exams::text, v_exams = 1),
    ('الملفات المرئية من اثنين', '1', v_files::text, v_files = 1),
    ('الأسئلة المرئية من اثنين', '1', v_questions::text, v_questions = 1),
    ('خيارات سؤال في امتحان محجوب', '0', v_options::text, v_options = 0),
    ('استعلام مباشر عن الامتحان المحجوب بمعرّفه', '0', v_direct::text, v_direct = 0),
    ('بيانات المستخدمين الآخرين', '0', v_people::text, v_people = 0),
    ('محاولات الآخرين', '0', v_attempts::text, v_attempts = 0),
    ('إجابات غير قيد الحل', '0', v_answers::text, v_answers = 0),
    ('صلاحيات الآخرين', '0', v_perms::text, v_perms = 0),
    ('منح النفس صلاحية امتحان محجوب', 'مرفوض', v_esc_perm, v_esc_perm = 'مرفوض'),
    ('ترقية النفس إلى مدرّس', 'مرفوض', v_esc_role, v_esc_role = 'مرفوض'),
    ('فتح مراجعة محاولة شخص آخر', 'مرفوض', v_esc_review, v_esc_review = 'مرفوض'),
    ('بدء امتحان محجوب', 'مرفوض', v_esc_start, v_esc_start = 'مرفوض');
end $$;

select n as "#", test as "الاختبار", expected as "المتوقع", actual as "الفعلي", "نجح"
from _sec
order by n;

rollback;
