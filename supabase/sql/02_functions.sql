-- =============================================================================
-- منصة البرمجة — 02: دوال مساعدة تستخدمها سياسات RLS
-- شغّل هذا الملف بعد 01_schema.sql
--
-- كل الدوال هنا SECURITY DEFINER لأنها تقرأ من جداول محميّة بـ RLS
-- (وإلا لدارت السياسات على نفسها). كلها تتحقق من هوية المستدعي داخلياً
-- عبر auth.uid()، فلا تكشف أي شيء عن مستخدم آخر حتى لو استدعاها الطالب
-- مباشرة عبر RPC: أقصى ما يعرفه هو صلاحياته هو.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- هل المستدعي هو المدرّس؟
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and p.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- هل المستدعي طالب مفعّل (وليس بانتظار الموافقة ولا موقوفاً)؟
-- ---------------------------------------------------------------------------
create or replace function public.is_active_student()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'student'
      and p.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- هل للمستدعي صلاحية على عنصر بعينه؟
-- إما full_access (يشمل المحتوى الجديد تلقائياً) أو صف في جدول permissions.
-- ---------------------------------------------------------------------------
create or replace function public.has_grant(
  p_type public.permission_resource,
  p_id   uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
        and p.full_access
    )
    or exists (
      select 1 from public.permissions pm
      where pm.student_id = (select auth.uid())
        and pm.resource_type = p_type
        and pm.resource_id = p_id
    );
$$;

-- ---------------------------------------------------------------------------
-- صلاحية الوصول لدرس (مع التأكد أن الدرس وفصله غير مؤرشفين)
-- ---------------------------------------------------------------------------
create or replace function public.can_access_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then true
    when not public.is_active_student() then false
    else exists (
      select 1
      from public.lessons l
      join public.chapters c on c.id = l.chapter_id
      where l.id = p_lesson_id
        and l.archived_at is null
        and c.archived_at is null
    ) and public.has_grant('lesson', p_lesson_id)
  end;
$$;

-- ---------------------------------------------------------------------------
-- صلاحية الوصول لملف
-- ---------------------------------------------------------------------------
create or replace function public.can_access_file(p_file_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then true
    when not public.is_active_student() then false
    else exists (
      select 1
      from public.lesson_files f
      join public.lessons l  on l.id = f.lesson_id
      join public.chapters c on c.id = l.chapter_id
      where f.id = p_file_id
        and f.archived_at is null
        and l.archived_at is null
        and c.archived_at is null
    ) and public.has_grant('file', p_file_id)
  end;
$$;

-- ---------------------------------------------------------------------------
-- صلاحية الوصول لامتحان
-- ---------------------------------------------------------------------------
create or replace function public.can_access_exam(p_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then true
    when not public.is_active_student() then false
    else exists (
      select 1
      from public.exams e
      join public.lessons l  on l.id = e.lesson_id
      join public.chapters c on c.id = l.chapter_id
      where e.id = p_exam_id
        and e.archived_at is null
        and l.archived_at is null
        and c.archived_at is null
    ) and public.has_grant('exam', p_exam_id)
  end;
$$;

-- ---------------------------------------------------------------------------
-- متى يُسمح بقراءة نصوص أسئلة امتحان؟
--
-- لا يكفي أن يكون الامتحان متاحاً للطالب: لا بد أن يكون مفتوحاً، أو أن تكون
-- للطالب محاولة فيه (ليراجعها بعد أن يغلقه المدرّس). هذا يمنع قراءة أسئلة
-- امتحان مُعدّ ولم يُفتح بعد.
-- ---------------------------------------------------------------------------
create or replace function public.can_read_exam_questions(p_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then true
    when not public.can_access_exam(p_exam_id) then false
    else exists (
      select 1 from public.exams e where e.id = p_exam_id and e.is_open
    ) or exists (
      select 1 from public.exam_attempts a
      where a.exam_id = p_exam_id
        and a.student_id = (select auth.uid())
        and a.voided_at is null
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- هل يظهر الدرس في قائمة الطالب؟
--
-- فرق مقصود عن can_access_lesson: الدرس هنا مجرد عنوان يجمع محتوى، وليس
-- محتوىً بذاته. فلو منح المدرّس الطالب امتحاناً واحداً داخل درس ولم يمنحه
-- الدرس، وجب أن يظهر اسم الدرس وإلا استحال كتابة
-- "الفصل الأول · الدرس الثاني" فوق ذلك الامتحان.
-- ما يبقى محجوباً هو محتوى الدرس نفسه: كل ملف وكل امتحان يُفحص على حدة.
-- ---------------------------------------------------------------------------
create or replace function public.can_see_lesson(p_lesson_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then true
    when not public.is_active_student() then false
    when public.can_access_lesson(p_lesson_id) then true
    else exists (
      select 1 from public.lesson_files f
      where f.lesson_id = p_lesson_id and public.can_access_file(f.id)
    ) or exists (
      select 1 from public.exams e
      where e.lesson_id = p_lesson_id and public.can_access_exam(e.id)
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- هل يحق للمستدعي كتابة إجابة على هذا السؤال داخل هذه المحاولة؟
-- يتحقق من: المحاولة له، وما زالت قيد الحل وغير مُبطلة،
-- وأن السؤال ينتمي فعلاً لامتحان هذه المحاولة (منع حقن أسئلة من امتحان آخر).
-- ---------------------------------------------------------------------------
create or replace function public.can_write_answer(
  p_attempt_id  uuid,
  p_question_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.exam_attempts a
    join public.questions q on q.exam_id = a.exam_id
    where a.id = p_attempt_id
      and q.id = p_question_id
      and a.student_id = (select auth.uid())
      and a.status = 'in_progress'
      and a.voided_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- تطبيع النص العربي قبل مقارنة إجابات "إكمال الفراغات".
-- يزيل التشكيل والتطويل، ويوحّد الألف والياء والتاء المربوطة والهمزات،
-- ويحوّل الأرقام العربية إلى لاتينية، ويضغط المسافات.
-- بدون هذا، "الذكاء الإصطناعى" و "الذكاء الاصطناعي" يُحسبان مختلفين.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_ar(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    trim(regexp_replace(
      translate(
        translate(
          regexp_replace(lower(t), '[ًٌٍَُِّْـٰ]', '', 'g'),
          'أإآٱىةؤئ',
          'اااايهوي'
        ),
        '٠١٢٣٤٥٦٧٨٩',
        '0123456789'
      ),
      '\s+', ' ', 'g'
    )),
    ''
  );
$$;
