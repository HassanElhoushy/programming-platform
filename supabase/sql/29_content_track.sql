-- =============================================================================
-- منصة البرمجة — 29: مسار عربي أو لغات
--
-- شغّل هذا الملف بعد 28_last_seen.sql.
--
-- طالب اللغات يشوف فصول اللغات فقط. الصلاحية الشاملة تفتح محتوى مساره،
-- ولا تعبر إلى المسار الآخر. الفصول الحالية كلها عربي، والحسابات الحالية
-- كذلك، فلا يتغير ما يراه أحمد وإسراء.
-- =============================================================================

do $$ begin
  create type public.content_track as enum ('ar', 'en');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists track public.content_track not null default 'ar';

alter table public.chapters
  add column if not exists track public.content_track not null default 'ar';

create or replace function public.my_content_track()
returns public.content_track
language sql
stable
security definer
set search_path = ''
as $$
  select p.track
  from public.profiles p
  where p.id = (select auth.uid());
$$;

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
        and c.track = public.my_content_track()
    ) and public.has_grant('lesson', p_lesson_id)
  end;
$$;

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
        and c.track = public.my_content_track()
    ) and public.has_grant('file', p_file_id)
  end;
$$;

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
        and c.track = public.my_content_track()
    ) and public.has_grant('exam', p_exam_id)
  end;
$$;

revoke all on function public.my_content_track() from public, anon;
grant execute on function public.my_content_track() to authenticated;
