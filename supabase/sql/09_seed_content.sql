-- =============================================================================
-- منصة البرمجة — 09: الفصول والدروس
--
-- قابل لإعادة التشغيل: المطابقة بالترتيب لا بالعنوان، فإعادة التشغيل تصحّح
-- العناوين ولا تُنشئ صفوفاً مكررة. غيّر عنواناً هنا وأعد التشغيل فيُحدَّث.
--
-- ما لا يفعله عمداً: لا يُلغي أرشفة فصل أو درس أرشفته بنفسك. لو أخفيت درساً
-- عن الطلاب فإعادة تشغيل هذا الملف لن تعيده لهم من وراء ظهرك.
--
-- ملاحظة في التسمية: العناوين هنا بلا بادئة "الفصل الأول". المنصة تركّبها
-- من حقل position عبر public.chapterName/lessonName في الواجهة، فتظهر دائماً
-- بصيغة "الفصل الأول · الدرس الثاني".
-- =============================================================================

do $$
declare
  c         record;
  l         record;
  v_chapter uuid;
  v_added_c integer := 0;
  v_added_l integer := 0;
begin
  for c in
    select * from (values
      (1, 'تكنولوجيا المعلومات والمجتمع'),
      (2, 'الأمن السيبراني'),
      (3, 'تطبيقات الويب'),
      (4, 'تصميم الويب والوسائط')
    ) as t(pos, title)
  loop
    select id into v_chapter
    from public.chapters
    where position = c.pos
    order by created_at
    limit 1;

    if v_chapter is null then
      insert into public.chapters (position, title)
      values (c.pos, c.title)
      returning id into v_chapter;
      v_added_c := v_added_c + 1;
    else
      update public.chapters set title = c.title where id = v_chapter;
    end if;

    for l in
      select * from (values
        -- الفصل الأول
        (1, 1, 'تطور تكنولوجيا المعلومات والتحول الاجتماعي'),
        (1, 2, 'كيف يعمل الذكاء الاصطناعي'),
        (1, 3, 'الذكاء الاصطناعي في الحياة اليومية والصناعة'),
        (1, 4, 'القضايا الأخلاقية المتعلقة بالذكاء الاصطناعي'),
        -- الفصل الثاني
        (2, 1, 'تقنيات التشفير والمصادقة'),
        (2, 2, 'تصميم أمن الشبكات'),
        (2, 3, 'الاستجابة للحوادث وإدارة المخاطر'),
        -- الفصل الثالث
        (3, 1, 'البنية العامة لتطبيقات الويب'),
        (3, 2, 'طرق الاتصال في تطبيقات الويب'),
        (3, 3, 'أساسيات تكنولوجيا الواجهة الأمامية'),
        -- الفصل الرابع
        (4, 1, 'أنواع الوسائط وخصائصها'),
        (4, 2, 'تصميم المعلومات وتجربة المستخدم للمواقع'),
        (4, 3, 'أساليب تقييم المواقع الإلكترونية'),
        (4, 4, 'عملية التحسين التكراري للمواقع')
      ) as t(chapter_pos, pos, title)
      where t.chapter_pos = c.pos
      order by t.pos
    loop
      if exists (
        select 1 from public.lessons
        where chapter_id = v_chapter and position = l.pos
      ) then
        update public.lessons
        set title = l.title
        where chapter_id = v_chapter and position = l.pos;
      else
        insert into public.lessons (chapter_id, position, title)
        values (v_chapter, l.pos, l.title);
        v_added_l := v_added_l + 1;
      end if;
    end loop;
  end loop;

  raise notice 'فصول جديدة: % — دروس جديدة: %', v_added_c, v_added_l;
end $$;


-- تحقّق: الشكل الذي ستظهر به الأسماء في المنصة
select
  'الفصل ' || case c.position
    when 1 then 'الأول' when 2 then 'الثاني' when 3 then 'الثالث' when 4 then 'الرابع'
    else 'رقم ' || c.position end
  || ' · الدرس ' || case l.position
    when 1 then 'الأول' when 2 then 'الثاني' when 3 then 'الثالث' when 4 then 'الرابع'
    else 'رقم ' || l.position end                        as "المسار",
  l.title                                                as "عنوان الدرس",
  c.title                                                as "عنوان الفصل"
from public.lessons l
join public.chapters c on c.id = l.chapter_id
order by c.position, l.position;
