-- =============================================================================
-- منصة البرمجة — 05: التخزين
-- شغّل هذا الملف بعد 04_rpc.sql
--
-- كلا الـ bucket خاصّان بلا أي سياسة وصول للعملاء. لا المتصفح ولا المفتاح
-- العام يستطيعان لمس ملف. كل رفع وكل فتح يمر عبر مسار على السيرفر يتحقق من
-- الصلاحية أولاً ثم يصدر رابطاً موقّعاً ينتهي بعد ساعة.
-- =============================================================================

-- bucket ملفات الدروس (PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('files', 'files', false, 20971520, array['application/pdf'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = 20971520,
      allowed_mime_types = array['application/pdf'];

-- bucket صور الإجابات المقالية (أنشأته أنت بالفعل — هنا نضبط قيوده فقط)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('answers', 'answers', false, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = 1048576,
      allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png'];

-- تنظيف احترازي: لو كانت هناك سياسات وصول قديمة على هذين الـ bucket من
-- تجارب سابقة في لوحة تحكم Supabase، أزلها. الافتراضي المطلوب هو المنع.
do $$
declare
  v_policy record;
begin
  for v_policy in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (qual like '%''files''%' or qual like '%''answers''%'
        or with_check like '%''files''%' or with_check like '%''answers''%')
  loop
    execute format('drop policy if exists %I on storage.objects', v_policy.policyname);
  end loop;
end $$;
