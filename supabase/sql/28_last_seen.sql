-- =============================================================================
-- منصة البرمجة — 28: آخر فتح للمنصة، لا آخر كلمة سر
--
-- شغّل هذا الملف بعد 27_student_last_sign_in.sql.
--
-- auth.users.last_sign_in_at يتحدث عند إدخال كلمة السر فقط. الجلسة تبقى
-- شهوراً (proxy يجدّد التوكن)، فطالب فتح المنصة النهاردة يظهر دخوله من
-- أسبوع. العمود هنا يتحدث كل ما فتح صفحة وهو داخل.
--
-- الطالب ممنوع من تعديل صفّه (الاسم والحالة). لذلك الكتابة عبر دالة لا
-- تمس إلا last_seen_at لصفّه هو، ولا تكتب لو اتحدثت من دقيقتين — عشان
-- الباقة المجانية ما تتشبعش كتابة على كل طلب.
-- =============================================================================

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

update public.profiles p
set last_seen_at = u.last_sign_in_at
from auth.users u
where u.id = p.id
  and p.last_seen_at is null;

create or replace function public.touch_last_seen()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return;
  end if;

  update public.profiles
  set last_seen_at = now()
  where id = v_uid
    and (last_seen_at is null or last_seen_at < now() - interval '2 minutes');
end;
$$;

revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;
