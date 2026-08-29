-- =============================================================================
-- منصة البرمجة — 07: اختبار الأمان (شغّله وقتما تشاء)
--
-- هذا الملف ينتحل شخصية طالب حقيقي داخل قاعدة البيانات نفسها، بنفس الصلاحيات
-- التي يملكها متصفحه بالضبط، ثم يحاول الوصول لما لا يُفترض أن يصل إليه.
-- إن كان كل شيء سليماً سيعود عمود "نجح" بقيمة true في كل الصفوف.
--
-- ملاحظتان:
--   • الملف داخل transaction ينتهي بـ rollback، فلا يغيّر أي بيانات.
--   • لكي يكون الاختبار ذا معنى يجب أن يكون لديك طالب واحد على الأقل،
--     وامتحان واحد على الأقل غير مصرّح له به.
-- =============================================================================

begin;

create temporary table _sec_results (
  n        integer generated always as identity,
  test     text,
  expected text,
  actual   text,
  "نجح"    boolean
) on commit drop;

do $$
declare
  v_student   uuid;
  v_name      text;
  v_full      boolean;

  -- الحقيقة كما يراها postgres (بلا RLS)
  v_all_exams   integer;
  v_all_files   integer;
  v_all_keys    integer;
  v_all_people  integer;
  v_exp_exams   integer;
  v_exp_files   integer;
  v_exp_lessons integer;

  -- ما يراه الطالب فعلاً عبر RLS
  v_saw_keys      integer;
  v_saw_exams     integer;
  v_saw_files     integer;
  v_saw_lessons   integer;
  v_saw_options   integer;
  v_saw_people    integer;
  v_saw_attempts  integer;
  v_saw_answers   integer;
  v_saw_perms     integer;
  v_esc_perm      text;
  v_esc_role      text;
  v_esc_review    text;

  v_other_attempt uuid;
begin
  -- ---------------------------------------------------------------------
  -- المرحلة أ: اختر طالباً واحسب الحقيقة كاملةً بصلاحيات postgres
  -- ---------------------------------------------------------------------
  select p.id, p.full_name, p.full_access
    into v_student, v_name, v_full
  from public.profiles p
  where p.role = 'student' and p.status = 'active'
  order by p.created_at
  limit 1;

  if v_student is null then
    raise exception 'لا يوجد طالب مفعّل. فعّل حساب طالب واحد على الأقل ثم أعد التشغيل.';
  end if;

  select count(*) into v_all_exams  from public.exams;
  select count(*) into v_all_files  from public.lesson_files;
  select count(*) into v_all_keys   from public.question_keys;
  select count(*) into v_all_people from public.profiles;

  select count(*) into v_exp_exams
  from public.exams e
  join public.lessons l  on l.id = e.lesson_id
  join public.chapters c on c.id = l.chapter_id
  where e.archived_at is null and l.archived_at is null and c.archived_at is null
    and (v_full or exists (
      select 1 from public.permissions pm
      where pm.student_id = v_student and pm.resource_type = 'exam' and pm.resource_id = e.id));

  select count(*) into v_exp_files
  from public.lesson_files f
  join public.lessons l  on l.id = f.lesson_id
  join public.chapters c on c.id = l.chapter_id
  where f.archived_at is null and l.archived_at is null and c.archived_at is null
    and (v_full or exists (
      select 1 from public.permissions pm
      where pm.student_id = v_student and pm.resource_type = 'file' and pm.resource_id = f.id));

  select count(*) into v_exp_lessons
  from public.lessons l
  join public.chapters c on c.id = l.chapter_id
  where l.archived_at is null and c.archived_at is null
    and (v_full or exists (
      select 1 from public.permissions pm
      where pm.student_id = v_student and pm.resource_type = 'lesson' and pm.resource_id = l.id));

  select a.id into v_other_attempt
  from public.exam_attempts a
  where a.student_id <> v_student
  limit 1;

  -- ---------------------------------------------------------------------
  -- المرحلة ب: صِر هذا الطالب. من هنا فصاعداً الصلاحيات هي صلاحيات متصفحه.
  -- ---------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text,
    true
  );

  select count(*) into v_saw_keys    from public.question_keys;
  select count(*) into v_saw_exams   from public.exams;
  select count(*) into v_saw_files   from public.lesson_files;
  select count(*) into v_saw_lessons from public.lessons;
  select count(*) into v_saw_people  from public.profiles where id <> v_student;
  select count(*) into v_saw_perms   from public.permissions where student_id <> v_student;

  select count(*) into v_saw_options
  from public.question_options o
  where not exists (
    select 1 from public.questions q where q.id = o.question_id
  );

  select count(*) into v_saw_attempts
  from public.exam_attempts a where a.student_id <> v_student;

  select count(*) into v_saw_answers
  from public.answers a
  join public.exam_attempts at2 on at2.id = a.attempt_id
  where at2.student_id <> v_student or at2.status <> 'in_progress';

  -- محاولة منح النفس صلاحية
  begin
    insert into public.permissions (student_id, resource_type, resource_id)
    values (v_student, 'exam', gen_random_uuid());
    v_esc_perm := 'نجح الإدراج (خطر!)';
  exception when others then
    v_esc_perm := 'مرفوض';
  end;

  -- محاولة ترقية النفس إلى مدرّس
  begin
    update public.profiles set role = 'admin', status = 'active', full_access = true
    where id = v_student;
    if found then
      v_esc_role := 'نجح التعديل (خطر!)';
    else
      v_esc_role := 'مرفوض';
    end if;
  exception when others then
    v_esc_role := 'مرفوض';
  end;

  -- محاولة مراجعة محاولة طالب آخر
  if v_other_attempt is null then
    v_esc_review := 'تخطّي (لا توجد محاولة لطالب آخر)';
  else
    begin
      perform public.get_attempt_review(v_other_attempt);
      v_esc_review := 'نجحت القراءة (خطر!)';
    exception when others then
      v_esc_review := 'مرفوض';
    end;
  end if;

  -- ---------------------------------------------------------------------
  -- المرحلة ج: عُد إلى postgres وسجّل النتائج
  -- ---------------------------------------------------------------------
  perform set_config('role', 'postgres', true);

  insert into _sec_results (test, expected, actual, "نجح") values
    ('الطالب المُختبَر',
     '—', v_name || case when v_full then ' (كل الصلاحيات)' else ' (صلاحيات تفصيلية)' end, true),

    ('قراءة مفاتيح الإجابات question_keys',
     '0 من ' || v_all_keys, v_saw_keys::text, v_saw_keys = 0),

    ('الامتحانات المرئية',
     v_exp_exams || ' من ' || v_all_exams, v_saw_exams::text, v_saw_exams = v_exp_exams),

    ('الملفات المرئية',
     v_exp_files || ' من ' || v_all_files, v_saw_files::text, v_saw_files = v_exp_files),

    ('الدروس المرئية',
     v_exp_lessons::text, v_saw_lessons::text, v_saw_lessons = v_exp_lessons),

    ('خيارات أسئلة من امتحان محجوب',
     '0', v_saw_options::text, v_saw_options = 0),

    ('بيانات الطلاب الآخرين',
     '0 من ' || (v_all_people - 1), v_saw_people::text, v_saw_people = 0),

    ('محاولات الطلاب الآخرين',
     '0', v_saw_attempts::text, v_saw_attempts = 0),

    ('إجابات غير قيد الحل (تشمل إجاباته هو بعد التسليم)',
     '0', v_saw_answers::text, v_saw_answers = 0),

    ('صلاحيات الطلاب الآخرين',
     '0', v_saw_perms::text, v_saw_perms = 0),

    ('محاولة منح النفس صلاحية امتحان',
     'مرفوض', v_esc_perm, v_esc_perm = 'مرفوض'),

    ('محاولة ترقية النفس إلى مدرّس',
     'مرفوض', v_esc_role, v_esc_role = 'مرفوض'),

    ('محاولة فتح مراجعة طالب آخر',
     'مرفوض', v_esc_review, v_esc_review like 'مرفوض%' or v_esc_review like 'تخطّي%');
end $$;

select n as "#", test as "الاختبار", expected as "المتوقع", actual as "الفعلي", "نجح"
from _sec_results
order by n;

rollback;
