-- =============================================================================
-- منصة البرمجة — 20: تشخيص البنك
--
-- شغّل هذا الملف بعد 19_bank_security_check.sql.
--
-- ما الذي يجعل البنك يستحق بناءه: أن يقول لك أين يخطئ الفصل قبل أن يقوله
-- الامتحان. الامتحان يخبرك بعد فوات الأوان.
--
-- محورا التشخيص يأتيان من بيانات موجودة بلا حقل جديد يُكتب:
--   • الدرس — "سبعة من اثني عشر أخطأوا في 2-3" فتعيد شرحه
--   • نوع السؤال — "فلانة تخطئ في الترتيب في كل الفصول" فمشكلتها في
--     الشكل لا في المادة
--
-- ولذلك لا نضيف "تصنيف مواضيع" لكل سؤال: الدرس هو الموضوع، وثلاثة وعشرون
-- درساً تفصيلٌ كافٍ. وما هو أدق منه يزيد عبء الكتابة بلا عائد.
--
-- ملاحظة: لا مقارنة بين الطلاب ولا ترتيب. الجدول يقول أين الضعف لا من
-- الأضعف — والفرق بينهما هو الفرق بين أداة تشخيص ولوحة متصدرين.
-- =============================================================================

create or replace function public.bank_insights()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_by_lesson   jsonb;
  v_by_type     jsonb;
  v_by_student  jsonb;
  v_hardest     jsonb;
  v_totals      jsonb;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  ---------------------------------------------------------------------------
  -- حيث يخطئ الفصل: أين تعيد الشرح
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(x order by x ->> 'sort'), '[]'::jsonb)
    into v_by_lesson
  from (
    select jsonb_build_object(
      'sort',            lpad(c.position::text, 3, '0') || lpad(l.position::text, 3, '0'),
      'chapter_position', c.position,
      'chapter_kind',    c.kind,
      'lesson_position', l.position,
      'lesson_kind',     l.kind,
      'lesson_title',    l.title,
      'wrong',           count(*) filter (where p.state = 'wrong'),
      'correct',         count(*) filter (where p.state = 'correct'),
      'students_wrong',  count(distinct p.student_id) filter (where p.state = 'wrong')
    ) as x
    from public.bank_progress p
    join public.questions q on q.id = p.question_id
    join public.exams    e on e.id = q.exam_id and e.kind = 'bank'
    join public.lessons  l on l.id = e.lesson_id
    join public.chapters c on c.id = l.chapter_id
    group by c.position, c.kind, l.position, l.kind, l.title
  ) s;

  ---------------------------------------------------------------------------
  -- حيث يخطئ الشكل لا المادة
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(x order by (x ->> 'wrong')::integer desc), '[]'::jsonb)
    into v_by_type
  from (
    select jsonb_build_object(
      'type',    q.type,
      'wrong',   count(*) filter (where p.state = 'wrong'),
      'correct', count(*) filter (where p.state = 'correct')
    ) as x
    from public.bank_progress p
    join public.questions q on q.id = p.question_id
    join public.exams    e on e.id = q.exam_id and e.kind = 'bank'
    group by q.type
  ) s;

  ---------------------------------------------------------------------------
  -- كل طالب على حدة، ومعه النوع الذي يتعثّر فيه أكثر
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(x order by x ->> 'name'), '[]'::jsonb)
    into v_by_student
  from (
    select jsonb_build_object(
      'student_id', pr.id,
      'name',       pr.full_name,
      'wrong',      count(*) filter (where p.state = 'wrong'),
      'correct',    count(*) filter (where p.state = 'correct'),
      'weak_type',  (
        select q2.type
        from public.bank_progress p2
        join public.questions q2 on q2.id = p2.question_id
        join public.exams e2 on e2.id = q2.exam_id and e2.kind = 'bank'
        where p2.student_id = pr.id and p2.state = 'wrong'
        group by q2.type
        order by count(*) desc, q2.type
        limit 1
      )
    ) as x
    from public.bank_progress p
    join public.profiles pr on pr.id = p.student_id
    join public.questions q on q.id = p.question_id
    join public.exams    e on e.id = q.exam_id and e.kind = 'bank'
    group by pr.id, pr.full_name
  ) s;

  ---------------------------------------------------------------------------
  -- الأسئلة التي يسقط فيها أكثر من طالب
  --
  -- سؤال يخطئ فيه نصف الفصل إما أن المفهوم لم يصل أو أن صياغته ملتبسة.
  -- الحالتان تستدعيان نظرك، وأيّهما لا يظهر إلا بفتح السؤال.
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(x order by (x ->> 'wrong')::integer desc), '[]'::jsonb)
    into v_hardest
  from (
    select jsonb_build_object(
      'question_id', q.id,
      'exam_id',     e.id,
      'body',        left(q.body, 120),
      'type',        q.type,
      'wrong',       count(*) filter (where p.state = 'wrong'),
      'correct',     count(*) filter (where p.state = 'correct')
    ) as x
    from public.bank_progress p
    join public.questions q on q.id = p.question_id
    join public.exams    e on e.id = q.exam_id and e.kind = 'bank'
    group by q.id, e.id, q.body, q.type
    having count(*) filter (where p.state = 'wrong') > 0
    order by count(*) filter (where p.state = 'wrong') desc
    limit 12
  ) s;

  ---------------------------------------------------------------------------
  -- الأرقام الكبيرة
  ---------------------------------------------------------------------------
  select jsonb_build_object(
    'banks',     (select count(*) from public.exams
                   where kind = 'bank' and archived_at is null),
    'questions', (select count(*) from public.questions q
                   join public.exams e on e.id = q.exam_id
                  where e.kind = 'bank' and e.archived_at is null),
    'answered',  (select count(*) from public.bank_progress),
    'students',  (select count(distinct student_id) from public.bank_progress)
  ) into v_totals;

  return jsonb_build_object(
    'totals',     v_totals,
    'by_lesson',  v_by_lesson,
    'by_type',    v_by_type,
    'by_student', v_by_student,
    'hardest',    v_hardest
  );
end;
$$;

revoke all on function public.bank_insights() from public, anon;
grant execute on function public.bank_insights() to authenticated;


-- تحقّق: مرفوضة على من ليس مدرّساً، وتعمل للمدرّس وترد الأقسام الخمسة
do $$
declare
  v_admin uuid;
  v_out   jsonb;
  v_err   text;
begin
  select id into v_admin from public.profiles where role = 'admin' limit 1;
  if v_admin is null then
    raise notice 'لا يوجد مدرّس — تُخطّى.';
    return;
  end if;

  -- طالب: مرفوض
  perform set_config('role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', (select id from public.profiles where role = 'student' limit 1),
      'role', 'authenticated'
    )::text, true);
  begin
    perform public.bank_insights();
    v_err := 'نجح — تسريب';
  exception when others then
    v_err := 'مرفوض';
  end;
  raise notice 'الطالب ينادي التشخيص: %', v_err;

  -- مدرّس: يعمل
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  v_out := public.bank_insights();

  raise notice 'الأقسام: %', (
    select string_agg(k, ', ') from jsonb_object_keys(v_out) as k
  );
  raise notice 'البنوك: % — الأسئلة: % — إجابات مسجّلة: %',
    v_out -> 'totals' ->> 'banks',
    v_out -> 'totals' ->> 'questions',
    v_out -> 'totals' ->> 'answered';

  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', null, true);
end $$;
