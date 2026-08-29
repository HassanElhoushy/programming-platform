-- =============================================================================
-- منصة البرمجة — 06: تعيين حساب المدرّس
--
-- شغّل هذا الملف **بعد** أن تسجّل حساباً بنفسك من صفحة التسجيل في المنصة
-- بالبريد hassanelhushy@gmail.com. التسجيل ينشئ لك حساب طالب بانتظار
-- الموافقة، وهذا الملف يرفعه إلى مدرّس.
--
-- لو أردت لاحقاً تعيين بريد آخر، غيّر القيمة في السطر التالي فقط.
-- =============================================================================

do $$
declare
  v_email text := 'hassanelhushy@gmail.com';
  v_id    uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);

  if v_id is null then
    raise exception
      'لا يوجد مستخدم بالبريد %. سجّل حساباً من صفحة التسجيل في المنصة أولاً ثم أعد تشغيل هذا الملف.',
      v_email;
  end if;

  update public.profiles
  set role        = 'admin',
      status      = 'active',
      full_access = true
  where id = v_id;

  raise notice 'تم تعيين % كحساب مدرّس.', v_email;
end $$;

-- تحقّق: يجب أن يظهر صف واحد دوره admin
select p.id, p.full_name, p.phone, p.role, p.status
from public.profiles p
where p.role = 'admin';
