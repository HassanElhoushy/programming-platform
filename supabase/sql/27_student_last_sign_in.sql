-- =============================================================================
-- منصة البرمجة — 27: آخر دخول للطالب
--
-- شغّل هذا الملف بعد 26_bank_not_an_exam.sql.
--
-- وقت آخر تسجيل دخول موجود في auth.users.last_sign_in_at، والمدرّس لا
-- يصل لذلك الجدول من جلسته. الدالة تقرأه له فقط: قائمة الطلاب وصفحة
-- الحساب تحتاجان الساعة لا اليوم وحده، عشان يعرف الطالب فتح امتى.
-- =============================================================================

create or replace function public.student_last_sign_ins()
returns table (student_id uuid, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select p.id, u.last_sign_in_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'student';
end;
$$;

revoke all on function public.student_last_sign_ins() from public, anon;
grant execute on function public.student_last_sign_ins() to authenticated;
