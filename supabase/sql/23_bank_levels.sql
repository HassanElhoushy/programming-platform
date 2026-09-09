-- =============================================================================
-- منصة البرمجة — 23: مستويات أسئلة البنك وعلامة النسيان
--
-- شغّل هذا الملف بعد 22_override_auto_grade.sql.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ١) المستوى: ثلاث درجات لا وسمُ صعوبة
-- ─────────────────────────────────────────────────────────────────────────
-- "سهل ومتوسط وصعب" حكمٌ من كاتب السؤال على طالب لا يعرفه: ما هو صعب على
-- من لم يفهم المفهوم سهلٌ على من فهمه، فالوسم يقيس ظنّ الكاتب لا السؤال.
--
-- والدرجات الثلاث هنا تصف ما يطلبه السؤال، وهو أمر يُفحَص لا يُظَن:
--
--   definition   يطلب استرجاع تعريف أو تمييز مصطلح
--   application  يطلب تطبيق المفهوم على حالة لم ترد في الكتاب
--   trap         يطلب التفريق بين مفهومين متقاربين يخلط بينهما الطلبة
--
-- وترتيب الـ enum مقصود: الجلسة العادية تصعد من التعريف إلى الفخ، وجلسة
-- المراجعة تهبط من الفخ إلى التعريف — من قدر على الفخ لا يحتاج التعريف.
--
-- العمود على questions لا على question_keys: المستوى ليس سرّاً، والطالب
-- يستفيد من رؤيته ("ده سؤال تفريق") أكثر مما يستفيد خصمٌ من معرفته.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ٢) علامة النسيان: كيف يعود سؤال أُتقِن دون أن يُسحب الإتقان
-- ─────────────────────────────────────────────────────────────────────────
-- 18_question_bank.sql قرّر أن من صحّت إجابته مرة تبقى حالته "صح" وإن عاد
-- فأخطأ، لأن تحويل مراجعةٍ إلى تراجع يعاقب الطالب على أنه راجع. والقرار
-- سليم للأسبوع، وغير كافٍ لستة أشهر: أن يخطئ اليوم في سؤال أتقنه في
-- سبتمبر ليس تراجعاً في التقدير بل خبرٌ جديد — نسي — والسؤال يجب أن يعود.
--
-- فصلٌ بين الأمرين: state لا ينزل أبداً (فالعدّاد لا يتراجع ولا نسبة تقلّ)،
-- و forgot تُرفع فيرجع السؤال أول جلسة المراجعة. يعود السؤال دون أن يشعر
-- الطالب أنه خسر شيئاً.
--
-- وعند المدرّس يصير الفرق تشخيصاً: خطأٌ من أول مرة معناه أن المفهوم لم
-- يصل، وخطأٌ بعد إتقانٍ معناه نسيان — والأول يستدعي إعادة شرح والثاني
-- إعادة تمرير سريعة.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) مستوى السؤال
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.question_tier as enum ('definition', 'application', 'trap');
exception when duplicate_object then null; end $$;

alter table public.questions
  add column if not exists tier public.question_tier;

comment on column public.questions.tier is
  'ما يطلبه السؤال: تعريف أم تطبيق أم تفريق. مطلوب في البنك، وبلا معنى في الامتحانات.';


-- ---------------------------------------------------------------------------
-- 2) علامة النسيان
--
--    لا nullable ولا ثلاثية: إما أن آخر إجابة على سؤال مُتقَن كانت خطأ أو
--    لا. وغياب الصف أصلاً معناه أنه لم يره، فلا حالة ثالثة تحتاج تمثيلاً.
-- ---------------------------------------------------------------------------
alter table public.bank_progress
  add column if not exists forgot boolean not null default false;

comment on column public.bank_progress.forgot is
  'مُتقَن وأخطأ فيه بعد ذلك. يرجّع السؤال في المراجعة دون أن يسحب الإتقان.';

/*
 * فهرس للاستعلام الذي تصنعه صفحة البنك: أسئلة طالب واحد المحتاجة مراجعة.
 * جزئي لأن الغالب false، وفهرسة الغالب لا تنفي قراءة الجدول.
 */
create index if not exists bank_progress_forgot_idx
  on public.bank_progress (student_id)
  where forgot;


-- ---------------------------------------------------------------------------
-- 3) check_bank_answer — نفس البوابة، وقاعدة تقدّم أدق
--
--    ما لم يتغيّر ولا يجوز أن يتغيّر: الفحوص الأربعة بترتيبها، وأولها أن
--    السؤال داخل عنصر نوعه 'bank'. انظر رأس 18_question_bank.sql.
-- ---------------------------------------------------------------------------
create or replace function public.check_bank_answer(
  p_question_id uuid,
  p_response    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q       public.questions%rowtype;
  v_exam    public.exams%rowtype;
  v_correct boolean;
  v_awarded numeric(6, 2);
  v_key     jsonb;
  v_expl    text;
begin
  select * into v_q from public.questions where id = p_question_id;
  if not found then
    raise exception 'QUESTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_exam from public.exams where id = v_q.exam_id;

  -- الشرط الحاكم: هذه الدالة لا تعمل إلا داخل البنك، مهما كان المنادي.
  if v_exam.kind <> 'bank' then
    raise exception 'NOT_A_BANK_QUESTION' using errcode = '42501';
  end if;

  if v_exam.archived_at is not null or not v_exam.is_open then
    raise exception 'BANK_CLOSED' using errcode = '42501';
  end if;

  if not public.can_access_exam(v_q.exam_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- المقالي لا مكان له هنا: قيمة البنك في الرد الفوري وهو لا يملكه.
  if v_q.type = 'essay' then
    raise exception 'ESSAY_NOT_IN_BANK' using errcode = '42501';
  end if;

  select g.is_correct, g.awarded into v_correct, v_awarded
  from public.grade_one(p_question_id, p_response) as g;

  select k.key, k.explanation into v_key, v_expl
  from public.question_keys k where k.question_id = p_question_id;

  /*
   * الإتقان لا يُسحَب، والنسيان يُسجَّل:
   *
   *   أخطأ ولم يُتقِنه قبلاً  →  state = wrong   (اللي محتاج شغل)
   *   أخطأ وكان مُتقِناً      →  state = correct، forgot = true (محتاج مراجعة)
   *   أصاب                    →  state = correct، forgot = false
   *
   * والسطر الأخير يشمل من كان قد نسي فراجع: العلامة تُطفأ لأنها وصفٌ لآخر
   * إجابة لا سجلٌّ دائم.
   */
  if public.is_active_student() then
    -- forgot تأخذ false من الافتراضي: أول رؤية للسؤال لا يمكن أن تكون نسياناً
    insert into public.bank_progress (student_id, question_id, state, last_response)
    values (
      (select auth.uid()),
      p_question_id,
      case when v_correct then 'correct' else 'wrong' end,
      case when v_correct then null else p_response end
    )
    on conflict (student_id, question_id) do update
      set state         = case when public.bank_progress.state = 'correct' or v_correct
                               then 'correct' else 'wrong' end,
          forgot        = not v_correct and public.bank_progress.state = 'correct',
          last_response = case when v_correct then public.bank_progress.last_response
                               else p_response end,
          tries         = public.bank_progress.tries + 1,
          updated_at    = now();
  end if;

  return jsonb_build_object(
    'is_correct',  v_correct,
    'awarded',     v_awarded,
    'points',      v_q.points,
    'correct',     v_key,
    'explanation', nullif(trim(coalesce(v_expl, '')), '')
  );
end;
$$;

revoke all on function public.check_bank_answer(uuid, jsonb) from public, anon;
grant execute on function public.check_bank_answer(uuid, jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- 4) التشخيص يفرّق بين لم-يفهم ونسي، ويضيف محور المستوى
--
--    محور المستوى يجيب سؤالاً لم يكن يُجاب: هل الفصل يحفظ ولا يفهم؟ غلطٌ
--    قليل في التعريفات مع غلطٍ كثيف في التطبيق جوابٌ صريح بنعم، وهو أمر
--    لا يظهر في جدول الدروس لأن الدرس يخلط المستويات الثلاثة.
-- ---------------------------------------------------------------------------
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
  v_by_tier     jsonb;
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
      'forgot',          count(*) filter (where p.forgot),
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
  -- حفظٌ أم فهم: الغلط موزّعاً على المستويات الثلاثة
  ---------------------------------------------------------------------------
  select coalesce(jsonb_agg(x order by x ->> 'tier'), '[]'::jsonb)
    into v_by_tier
  from (
    select jsonb_build_object(
      'tier',    q.tier,
      'wrong',   count(*) filter (where p.state = 'wrong'),
      'correct', count(*) filter (where p.state = 'correct'),
      'forgot',  count(*) filter (where p.forgot)
    ) as x
    from public.bank_progress p
    join public.questions q on q.id = p.question_id
    join public.exams    e on e.id = q.exam_id and e.kind = 'bank'
    where q.tier is not null
    group by q.tier
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
      'forgot',     count(*) filter (where p.forgot),
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
      'tier',        q.tier,
      'wrong',       count(*) filter (where p.state = 'wrong'),
      'correct',     count(*) filter (where p.state = 'correct')
    ) as x
    from public.bank_progress p
    join public.questions q on q.id = p.question_id
    join public.exams    e on e.id = q.exam_id and e.kind = 'bank'
    group by q.id, e.id, q.body, q.type, q.tier
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
    'forgot',    (select count(*) from public.bank_progress where forgot),
    'students',  (select count(distinct student_id) from public.bank_progress)
  ) into v_totals;

  return jsonb_build_object(
    'totals',     v_totals,
    'by_lesson',  v_by_lesson,
    'by_type',    v_by_type,
    'by_tier',    v_by_tier,
    'by_student', v_by_student,
    'hardest',    v_hardest
  );
end;
$$;

revoke all on function public.bank_insights() from public, anon;
grant execute on function public.bank_insights() to authenticated;


-- ---------------------------------------------------------------------------
-- تحقّق: العمودان موجودان، والبوابة ما زالت مقفولة، وقاعدة النسيان تعمل
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name = 'questions' and column_name = 'tier')          as "عمود المستوى",
  (select count(*) from information_schema.columns
    where table_name = 'bank_progress' and column_name = 'forgot')    as "عمود النسيان",
  has_function_privilege('authenticated', 'public.grade_one(uuid, jsonb)', 'execute')
                                                                      as "الطالب ينادي grade_one",
  has_function_privilege('authenticated', 'public.check_bank_answer(uuid, jsonb)', 'execute')
                                                                      as "الطالب ينادي البنك";

-- قاعدة الإتقان والنسيان تُفحَص على الدالة نفسها في 24_bank_levels_check.sql.
