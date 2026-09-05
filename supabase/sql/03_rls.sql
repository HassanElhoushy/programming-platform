-- =============================================================================
-- منصة البرمجة — 03: تفعيل RLS وكتابة السياسات
-- شغّل هذا الملف بعد 02_functions.sql
--
-- المبدأ: المفتاح العام (publishable) يظهر في المتصفح بطبيعته، فكل الحماية
-- الحقيقية هنا. RLS مفعّل على كل جدول بلا استثناء، والافتراضي هو المنع:
-- ما لا تسمح به سياسة صراحةً فهو ممنوع.
-- =============================================================================

alter table public.profiles         enable row level security;
alter table public.chapters         enable row level security;
alter table public.lessons          enable row level security;
alter table public.lesson_files     enable row level security;
alter table public.exams            enable row level security;
alter table public.questions        enable row level security;
alter table public.question_options enable row level security;
alter table public.question_keys    enable row level security;
alter table public.permissions      enable row level security;
alter table public.exam_attempts    enable row level security;
alter table public.answers          enable row level security;
alter table public.file_events      enable row level security;
alter table public.heartbeat        enable row level security;

-- صلاحيات الجداول على مستوى Postgres. RLS هو ما يحدد الصفوف بعد ذلك.
grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.chapters, public.lessons, public.lesson_files,
  public.exams, public.questions, public.question_options, public.question_keys,
  public.permissions, public.exam_attempts, public.answers, public.file_events
  to authenticated;

grant select on public.heartbeat to anon, authenticated;


-- =============================================================================
-- profiles
-- =============================================================================
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) or public.is_admin() );

-- الطالب لا يعدّل بياناته بنفسه (منع تغيير الهوية بعد التسجيل).
-- لا توجد سياسة INSERT: الصف يُنشأ حصراً بواسطة trigger على auth.users.
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using ( public.is_admin() );


-- =============================================================================
-- chapters — الطالب يرى الفصل فقط إن كان فيه درس واحد على الأقل متاح له
-- =============================================================================
drop policy if exists chapters_select on public.chapters;
create policy chapters_select on public.chapters
  for select to authenticated
  using (
    public.is_admin()
    or (
      archived_at is null
      and exists (
        select 1 from public.lessons l
        where l.chapter_id = chapters.id
          and l.archived_at is null
          and public.can_see_lesson(l.id)
      )
    )
  );

drop policy if exists chapters_admin_write on public.chapters;
create policy chapters_admin_write on public.chapters
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- lessons
-- =============================================================================
drop policy if exists lessons_select on public.lessons;
create policy lessons_select on public.lessons
  for select to authenticated
  using ( public.can_see_lesson(id) );

drop policy if exists lessons_admin_write on public.lessons;
create policy lessons_admin_write on public.lessons
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- lesson_files
-- =============================================================================
drop policy if exists lesson_files_select on public.lesson_files;
create policy lesson_files_select on public.lesson_files
  for select to authenticated
  using ( public.can_access_file(id) );

drop policy if exists lesson_files_admin_write on public.lesson_files;
create policy lesson_files_admin_write on public.lesson_files
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- exams — الطالب لا يرى حتى عنوان امتحان غير مصرّح له به
-- =============================================================================
drop policy if exists exams_select on public.exams;
create policy exams_select on public.exams
  for select to authenticated
  using ( public.can_access_exam(id) );

drop policy if exists exams_admin_write on public.exams;
create policy exams_admin_write on public.exams
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- questions — نص السؤال فقط. لا يوجد في هذا الجدول ما يدل على الإجابة.
-- =============================================================================
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select to authenticated
  using ( public.can_read_exam_questions(exam_id) );

drop policy if exists questions_admin_write on public.questions;
create policy questions_admin_write on public.questions
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- question_options — نص الخيارات فقط، بلا أي إشارة للصحة
-- =============================================================================
drop policy if exists question_options_select on public.question_options;
create policy question_options_select on public.question_options
  for select to authenticated
  using (
    exists (
      select 1 from public.questions q
      where q.id = question_options.question_id
        and public.can_read_exam_questions(q.exam_id)
    )
  );

drop policy if exists question_options_admin_write on public.question_options;
create policy question_options_admin_write on public.question_options
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- question_keys — الجدول السرّي.
--
-- سياسة واحدة فقط، للمدرّس. لا توجد أي سياسة تسمح للطالب بالقراءة، لا قبل
-- الامتحان ولا بعده. حتى لو استعلم الطالب عن الجدول مباشرة بالمفتاح العام
-- من الـ console، النتيجة صفوف صفر — لا خطأ يكشف وجود بيانات، ولا بيانات.
--
-- الطالب يرى الإجابات الصحيحة حصراً عبر public.get_attempt_review() في 04،
-- وهي دالة SECURITY DEFINER تتحقق أنه سلّم الامتحان وأن المدرّس فعّل
-- مفتاح reveal_answers لهذا الامتحان.
-- =============================================================================
drop policy if exists question_keys_admin_only on public.question_keys;
create policy question_keys_admin_only on public.question_keys
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- permissions — الطالب يرى صلاحياته هو فقط، ولا يعدّلها
-- =============================================================================
drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select to authenticated
  using ( student_id = (select auth.uid()) or public.is_admin() );

drop policy if exists permissions_admin_write on public.permissions;
create policy permissions_admin_write on public.permissions
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- exam_attempts
-- الطالب يقرأ محاولاته فقط. لا يُنشئها ولا يعدّلها مباشرة:
-- البدء عبر public.start_exam() والتسليم عبر public.submit_exam().
-- =============================================================================
drop policy if exists exam_attempts_select on public.exam_attempts;
create policy exam_attempts_select on public.exam_attempts
  for select to authenticated
  using ( student_id = (select auth.uid()) or public.is_admin() );

drop policy if exists exam_attempts_admin_write on public.exam_attempts;
create policy exam_attempts_admin_write on public.exam_attempts
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- answers
--
-- أثناء الحل: الطالب يقرأ ويكتب إجاباته (الحفظ التلقائي).
-- بعد التسليم: تتوقف قراءته المباشرة تماماً، وتمر المراجعة عبر
-- get_attempt_review() التي تقرر ماذا يُعرض حسب reveal_answers.
-- وشرط WITH CHECK يمنعه من كتابة درجة أو تصحيح لنفسه.
-- =============================================================================
drop policy if exists answers_select on public.answers;
create policy answers_select on public.answers
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.exam_attempts a
      where a.id = answers.attempt_id
        and a.student_id = (select auth.uid())
        and a.status = 'in_progress'
    )
  );

drop policy if exists answers_student_insert on public.answers;
create policy answers_student_insert on public.answers
  for insert to authenticated
  with check (
    public.can_write_answer(attempt_id, question_id)
    and awarded_points is null
    and is_correct is null
    and feedback is null
    and graded_by is null
    and graded_at is null
  );

drop policy if exists answers_student_update on public.answers;
create policy answers_student_update on public.answers
  for update to authenticated
  using ( public.can_write_answer(attempt_id, question_id) )
  with check (
    public.can_write_answer(attempt_id, question_id)
    and awarded_points is null
    and is_correct is null
    and feedback is null
    and graded_by is null
    and graded_at is null
  );

drop policy if exists answers_admin_write on public.answers;
create policy answers_admin_write on public.answers
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- file_events — يُكتب من السيرفر بالمفتاح السرّي فقط، فلا سياسة كتابة هنا
-- =============================================================================
drop policy if exists file_events_select on public.file_events;
create policy file_events_select on public.file_events
  for select to authenticated
  using ( student_id = (select auth.uid()) or public.is_admin() );

drop policy if exists file_events_admin_write on public.file_events;
create policy file_events_admin_write on public.file_events
  for all to authenticated
  using ( public.is_admin() )
  with check ( public.is_admin() );


-- =============================================================================
-- heartbeat — قراءة فقط، لأجل الـ cron الذي يمنع توقّف المشروع
-- =============================================================================
drop policy if exists heartbeat_read on public.heartbeat;
create policy heartbeat_read on public.heartbeat
  for select to anon, authenticated
  using ( true );


-- =============================================================================
-- Storage: لا سياسات إطلاقاً على الـ buckets.
--
-- RLS مفعّل على storage.objects افتراضياً في Supabase، وغياب السياسات يعني
-- منع الجميع. كل وصول للملفات يمر عبر السيرفر بالمفتاح السرّي بعد التحقق
-- من الصلاحية، ثم يُصدر رابطاً موقّعاً قصير العمر. المتصفح لا يملك أي
-- طريق مباشر إلى التخزين.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- تقدّم البنك: قراءة فقط، ولا سياسة كتابة إطلاقاً.
--
-- الكتابة تمر حصراً عبر public.check_bank_answer وهي security definer، فلا
-- يستطيع طالب أن يعلّم سؤالاً "صح" بطلب مباشر على الجدول.
-- ---------------------------------------------------------------------------
alter table public.bank_progress enable row level security;

drop policy if exists bank_progress_select on public.bank_progress;
create policy bank_progress_select on public.bank_progress
  for select to authenticated
  using ( public.is_admin() or student_id = (select auth.uid()) );
