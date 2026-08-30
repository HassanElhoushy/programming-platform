-- =============================================================================
-- منصة البرمجة — 01: الأنواع والجداول
-- شغّل هذا الملف أولاً في Supabase SQL Editor.
-- الملف قابل لإعادة التشغيل (idempotent).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- الأنواع (enums)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('pending', 'active', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.file_kind as enum ('explanation', 'slides');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.exam_level as enum ('basic', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_type as enum
    ('mcq_single', 'mcq_multi', 'true_false', 'fill_blank', 'essay');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attempt_status as enum ('in_progress', 'submitted', 'graded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.permission_resource as enum ('lesson', 'file', 'exam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.file_event_action as enum ('view', 'download');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- profiles — ملف المستخدم. الدور والحالة لا يأتيان أبداً من user_metadata.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  role        public.user_role   not null default 'student',
  status      public.user_status not null default 'pending',
  full_access boolean            not null default false,
  created_at  timestamptz        not null default now(),
  constraint profiles_full_name_len check (char_length(trim(full_name)) between 3 and 80),
  constraint profiles_phone_format check (phone ~ '^01[0125][0-9]{8}$')
);

create unique index if not exists profiles_phone_key on public.profiles (phone);
create index if not exists profiles_role_status_idx on public.profiles (role, status);


-- ---------------------------------------------------------------------------
-- الفصول والدروس
-- ---------------------------------------------------------------------------
create table if not exists public.chapters (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  position    integer not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists chapters_position_idx on public.chapters (position);

create table if not exists public.lessons (
  id          uuid primary key default gen_random_uuid(),
  chapter_id  uuid not null references public.chapters (id) on delete cascade,
  title       text not null,
  position    integer not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists lessons_chapter_id_idx on public.lessons (chapter_id, position);


-- ---------------------------------------------------------------------------
-- ملفات الدرس. video_url مجهّز للمستقبل ولا تستخدمه الواجهة الآن.
-- ---------------------------------------------------------------------------
create table if not exists public.lesson_files (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references public.lessons (id) on delete cascade,
  title        text not null,
  kind         public.file_kind not null default 'explanation',
  storage_path text not null,
  size_bytes   bigint,
  video_url    text,
  position     integer not null default 0,
  archived_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists lesson_files_lesson_id_idx on public.lesson_files (lesson_id, position);


-- ---------------------------------------------------------------------------
-- الامتحانات. reveal_answers مقفول افتراضياً — المدرّس يفتحه يدوياً.
-- ---------------------------------------------------------------------------
create table if not exists public.exams (
  id               uuid primary key default gen_random_uuid(),
  lesson_id        uuid not null references public.lessons (id) on delete cascade,
  title            text not null,
  level            public.exam_level not null default 'basic',
  duration_minutes integer,
  is_open          boolean not null default false,
  reveal_answers   boolean not null default false,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  constraint exams_duration_positive check (duration_minutes is null or duration_minutes > 0)
);

create index if not exists exams_lesson_id_idx on public.exams (lesson_id);


-- ---------------------------------------------------------------------------
-- الأسئلة. لا يوجد أي حقل هنا يدل على الإجابة الصحيحة.
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id          uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references public.exams (id) on delete cascade,
  position    integer not null,
  type        public.question_type not null,
  body        text not null,
  points      numeric(6, 2) not null default 1,
  blank_count integer not null default 0,
  constraint questions_points_positive check (points > 0)
);

create index if not exists questions_exam_id_idx on public.questions (exam_id, position);


-- ---------------------------------------------------------------------------
-- خيارات الاختيار من متعدد.
-- ملاحظة أمنية: لا يوجد عمود is_correct هنا إطلاقاً — الصحة تُخزَّن في
-- جدول question_keys المنفصل. هذا يجعل تسريب الإجابة من هذا الجدول مستحيلاً
-- بنيوياً، وليس معتمداً على تذكّر إخفاء عمود.
-- ---------------------------------------------------------------------------
create table if not exists public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  position    integer not null,
  body        text not null
);

create index if not exists question_options_question_id_idx
  on public.question_options (question_id, position);


-- ---------------------------------------------------------------------------
-- مفاتيح الإجابات. جدول سرّي: لا يقرؤه إلا المدرّس (سياسة RLS في 03).
-- شكل العمود key حسب نوع السؤال:
--   mcq_single : {"option_ids": ["<uuid>"]}
--   mcq_multi  : {"option_ids": ["<uuid>", "<uuid>", ...]}
--   true_false : {"value": true}
--   fill_blank : {"blanks": [["إجابة", "مرادف مقبول"], ["إجابة الفراغ الثاني"]]}
--   essay      : لا يوجد صف
-- ---------------------------------------------------------------------------
create table if not exists public.question_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  key         jsonb not null
);


-- ---------------------------------------------------------------------------
-- الصلاحيات — صف لكل عنصر مسموح لكل طالب.
-- منح "درس بكل محتوياته" = إدراج صف للدرس + صف لكل ملف + صف لكل امتحان.
-- full_access على profiles يتخطّى هذا الجدول ويشمل المحتوى الجديد تلقائياً.
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references public.profiles (id) on delete cascade,
  resource_type public.permission_resource not null,
  resource_id   uuid not null,
  granted_by    uuid references public.profiles (id) on delete set null,
  granted_at    timestamptz not null default now(),
  unique (student_id, resource_type, resource_id)
);

create index if not exists permissions_student_idx on public.permissions (student_id, resource_type);
create index if not exists permissions_resource_idx on public.permissions (resource_type, resource_id);


-- ---------------------------------------------------------------------------
-- محاولات الامتحان.
-- voided_at: المدرّس يبطل المحاولة للسماح بإعادة الحل مع حفظ السجل القديم.
-- ---------------------------------------------------------------------------
create table if not exists public.exam_attempts (
  id                 uuid primary key default gen_random_uuid(),
  exam_id            uuid not null references public.exams (id) on delete cascade,
  student_id         uuid not null references public.profiles (id) on delete cascade,
  status             public.attempt_status not null default 'in_progress',
  started_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  time_spent_seconds integer,
  exceeded_duration  boolean not null default false,
  auto_score         numeric(7, 2),
  manual_score       numeric(7, 2),
  total_points       numeric(7, 2),
  -- متى اطّلع الطالب على تصحيح هذا الامتحان — تستخدمه الصفحة الرئيسية
  -- لإبراز "فيه تصحيح جديد لسه ما شفتوش" في أعلى الشاشة
  feedback_seen_at   timestamptz,
  voided_at          timestamptz,
  voided_by          uuid references public.profiles (id) on delete set null
);

-- محاولة واحدة فعّالة فقط لكل طالب في كل امتحان.
create unique index if not exists exam_attempts_one_active_idx
  on public.exam_attempts (exam_id, student_id)
  where voided_at is null;

create index if not exists exam_attempts_student_idx on public.exam_attempts (student_id, status);
create index if not exists exam_attempts_exam_idx on public.exam_attempts (exam_id);


-- ---------------------------------------------------------------------------
-- الإجابات. الحفظ التلقائي يعمل upsert على (attempt_id, question_id).
-- شكل response حسب النوع:
--   mcq_single/mcq_multi : {"option_ids": ["<uuid>", ...]}
--   true_false           : {"value": true}
--   fill_blank           : {"blanks": ["نص", "نص"]}
--   essay                : {"text": "..."}  ويُرفع image_path اختيارياً
-- ---------------------------------------------------------------------------
create table if not exists public.answers (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null references public.exam_attempts (id) on delete cascade,
  question_id    uuid not null references public.questions (id) on delete cascade,
  response       jsonb,
  image_path     text,
  awarded_points numeric(6, 2),
  is_correct     boolean,
  feedback       text,
  graded_by      uuid references public.profiles (id) on delete set null,
  graded_at      timestamptz,
  updated_at     timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists answers_attempt_idx on public.answers (attempt_id);
create index if not exists answers_question_idx on public.answers (question_id);


-- ---------------------------------------------------------------------------
-- سجل فتح وتحميل الملفات — للمتابعة في لوحة المدرّس.
-- ---------------------------------------------------------------------------
create table if not exists public.file_events (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  file_id    uuid not null references public.lesson_files (id) on delete cascade,
  action     public.file_event_action not null,
  created_at timestamptz not null default now()
);

create index if not exists file_events_file_student_idx
  on public.file_events (file_id, student_id, created_at desc);
create index if not exists file_events_student_idx
  on public.file_events (student_id, created_at desc);


-- ---------------------------------------------------------------------------
-- إنشاء ملف المستخدم تلقائياً عند التسجيل.
-- الدور دائماً 'student' والحالة دائماً 'pending' — لا يمكن رفعهما من العميل.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'طالب'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'phone'), ''), '01000000000')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- هذه دالة trigger فقط. بدون هذا السطر تصبح نقطة نداء عامة على
-- /rest/v1/rpc/handle_new_user لأن Postgres يمنح EXECUTE لـ PUBLIC افتراضياً.
-- المنع لا يؤثر على الـ trigger: صلاحية التنفيذ تُفحص عند إنشائه لا عند إطلاقه.
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- استكمال بأثر رجعي.
--
-- الـ trigger أعلاه لا يعمل إلا على التسجيلات الجديدة. فلو حاول أحد التسجيل
-- قبل تنفيذ هذا الملف، يكون قد بقي له حساب في auth.users بلا صف في profiles،
-- وهي حالة تُدخل التطبيق في تحويل لا ينتهي بين الصفحة الرئيسية وصفحة الدخول.
-- هذا الاستعلام يعطي كل مستخدم بلا ملف صفَّه.
--
-- الاسم والهاتف يؤخذان من بيانات التسجيل إن وُجدت. وإن لم تُوجد يُركَّب رقم
-- صناعي بادئته 01099 ليمر من قيد الصيغة ويبقى مميزاً، فيغيّره المدرّس بعدها.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, phone)
select
  s.id,
  s.full_name,
  case
    when s.phone ~ '^01[0125][0-9]{8}$'
     and not exists (select 1 from public.profiles p where p.phone = s.phone)
    then s.phone
    else '01099' || lpad(s.rn::text, 6, '0')
  end
from (
  select
    u.id,
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'مستخدم') as full_name,
    nullif(trim(u.raw_user_meta_data ->> 'phone'), '') as phone,
    row_number() over (order by u.created_at) as rn
  from auth.users u
  where not exists (select 1 from public.profiles p where p.id = u.id)
) s
on conflict (id) do nothing;


-- ---------------------------------------------------------------------------
-- جدول صغير للـ keep-alive cron (GitHub Actions يقرأ منه كل يومين).
-- ---------------------------------------------------------------------------
create table if not exists public.heartbeat (
  id         smallint primary key default 1,
  pinged_at  timestamptz not null default now(),
  constraint heartbeat_single_row check (id = 1)
);

insert into public.heartbeat (id) values (1) on conflict (id) do nothing;
