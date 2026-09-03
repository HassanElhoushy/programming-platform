-- =============================================================================
-- منصة البرمجة — 15: قياس المساحة المستهلكة
--
-- الباقة المجانية بتدي 1 جيجا تخزين. لما تخلص، Supabase بيرفض أي رفع جديد —
-- والطالب اللي بيصوّر ورقته وسط امتحان هو أسوأ حد ممكن يتفاجئ بده.
--
-- الجدول storage.objects مش مكشوف لواجهة الـ API، فمحتاجين دالة SECURITY
-- DEFINER تقراه وترجّع رقم مجمّع بس. الرقم ده مش محتوى ولا بيدل على ملف
-- بعينه، فكشفه للمستخدم المسجّل مش تسريب.
--
-- قابل لإعادة التشغيل.
-- =============================================================================

create or replace function public.storage_usage()
returns table (used_bytes bigint, limit_bytes bigint, pct numeric)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint            as used_bytes,
    (1024::bigint * 1024 * 1024)                                        as limit_bytes,
    round(
      coalesce(sum((o.metadata ->> 'size')::bigint), 0) * 100.0
      / (1024::bigint * 1024 * 1024)
    , 2)                                                                as pct
  from storage.objects o;
$fn$;

revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated, service_role;

comment on function public.storage_usage() is
  'المساحة المستهلكة من تخزين Supabase بالبايت مقابل حد الباقة المجانية.';


-- تحقّق
select
  used_bytes                          as "بايت مستهلك",
  pg_size_pretty(used_bytes)          as "المستهلك",
  pg_size_pretty(limit_bytes)         as "الحد",
  pct                                 as "النسبة %"
from public.storage_usage();
