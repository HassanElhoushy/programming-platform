-- =============================================================================
-- منصة البرمجة — 30: خلفية متحركة يفتحها المدرّس
--
-- شغّل هذا الملف بعد 29_content_track.sql.
--
-- صف واحد. الطلبة يقرأونه، والمدرّس وحده يعدّله. الافتراضي مقفول.
-- =============================================================================

create table if not exists public.platform_settings (
  id boolean primary key default true check (id),
  motion_background boolean not null default false
);

insert into public.platform_settings (id, motion_background)
values (true, false)
on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

grant select, update on public.platform_settings to authenticated;

drop policy if exists platform_settings_read on public.platform_settings;
create policy platform_settings_read
  on public.platform_settings
  for select
  to authenticated
  using (true);

drop policy if exists platform_settings_update on public.platform_settings;
create policy platform_settings_update
  on public.platform_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
