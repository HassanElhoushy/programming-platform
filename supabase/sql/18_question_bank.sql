-- =============================================================================
-- منصة البرمجة — 18: بنك الأسئلة
--
-- شغّل هذا الملف بعد 17_new_types_smoke.sql.
--
-- البنك ليس نظاماً جديداً: هو امتحان نوعه 'bank'. فيرث الاستيراد ولوحة
-- المدرّس وسياسات المفاتيح والصلاحيات كما هي، ويختلف في طريقة اللعب فقط —
-- بلا محاولة ولا مؤقّت ولا تسليم: الطالب يجيب فيعرف فوراً.
--
-- ─────────────────────────────────────────────────────────────────────────
-- أخطر ما في هذا الملف
-- ─────────────────────────────────────────────────────────────────────────
-- دالة تصحّح سؤالاً واحداً وترد "صح أم خطأ" هي آلة تخمين. من استطاع
-- مناداتها بسؤال من امتحان حقيقي سحب مفتاحه سؤالاً سؤالاً، بل استطاع
-- تجريب الخيارات حتى يصيب من غير أن يرى المفتاح أصلاً.
--
-- لذلك:
--   • grade_one مسحوبة من الجميع — لا anon ولا authenticated. تناديها
--     الدوال المالكة وحدها، ولا سبيل إلى ندائها من مفتاح عام.
--   • check_bank_answer هي الواجهة الوحيدة للطالب، وأول ما تفعله أن
--     ترفض أي سؤال ليس داخل عنصر نوعه 'bank'. الشرط في الدالة لا في
--     الواجهة: إخفاء زر ليس حماية.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) نوع العنصر الثالث
-- ---------------------------------------------------------------------------
alter type public.exam_kind add value if not exists 'bank';


-- ---------------------------------------------------------------------------
-- 2) شرح الخطأ
--
--    في الجدول المحمي لا في جدول الأسئلة: الشرح يقول الإجابة ضمناً غالباً
--    ("لأن GET لا يعدّل بيانات")، فيرث سياسة المفاتيح نفسها بلا تفكير.
-- ---------------------------------------------------------------------------
alter table public.question_keys
  add column if not exists explanation text;

comment on column public.question_keys.explanation is
  'لماذا الإجابة هي هذه. تظهر في البنك بعد إجابة الطالب.';


-- ---------------------------------------------------------------------------
-- 3) تقدّم الطالب في البنك
--
--    صف واحد لكل (طالب، سؤال). غياب الصف = لم يره بعد، فلا نكتب صفوفاً
--    لأسئلة لم تُفتح أصلاً.
--
--    نحفظ آخر إجابة خاطئة لا مجرد أنها خطأ: أن يختار نصف الفصل نفس البديل
--    الخاطئ يقول إن هناك مفهوماً متلخبطاً، وأن يتفرّقوا يقول إنه إهمال.
--    الفرق بينهما هو الفرق بين أن تعيد الشرح وأن تعيد التنبيه.
-- ---------------------------------------------------------------------------
create table if not exists public.bank_progress (
  student_id    uuid not null references public.profiles (id)  on delete cascade,
  question_id   uuid not null references public.questions (id) on delete cascade,
  state         text not null check (state in ('correct', 'wrong')),
  last_response jsonb,
  tries         integer not null default 1,
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (student_id, question_id)
);

create index if not exists bank_progress_question_idx
  on public.bank_progress (question_id);

create index if not exists bank_progress_student_state_idx
  on public.bank_progress (student_id, state);

alter table public.bank_progress enable row level security;

/*
 * قراءة فقط، ولا سياسة كتابة إطلاقاً: الكتابة تمر حصراً عبر
 * check_bank_answer، فلا يستطيع طالب أن يعلّم سؤالاً "صح" بطلب مباشر.
 */
drop policy if exists bank_progress_select on public.bank_progress;
create policy bank_progress_select on public.bank_progress
  for select to authenticated
  using ( public.is_admin() or student_id = (select auth.uid()) );


-- ---------------------------------------------------------------------------
-- 4) التصحيح المشترك
--
--    كان منطق التصحيح داخل submit_exam وحدها. البنك يحتاجه أيضاً، ونسخه
--    مرتين يعني أن يتباعدا: يُصلَح عيب في أحدهما ويبقى في الآخر، والطالب
--    يأخذ درجتين مختلفتين على السؤال نفسه.
--
--    مسحوبة من الجميع عمداً — انظر رأس الملف.
-- ---------------------------------------------------------------------------
create or replace function public.grade_one(
  p_question_id uuid,
  p_response    jsonb
)
returns table (is_correct boolean, awarded numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q          public.questions%rowtype;
  v_key        jsonb;
  v_correct    boolean := false;
  v_awarded    numeric(6, 2) := 0;
  v_given_ids  text[];
  v_key_ids    text[];
  v_parts_all  integer;
  v_parts_ok   integer;
  v_i          integer;
  v_given      text;
begin
  select * into v_q from public.questions where id = p_question_id;
  if not found or v_q.type = 'essay' then
    return query select false, 0::numeric;
    return;
  end if;

  select k.key into v_key from public.question_keys k where k.question_id = p_question_id;

  if p_response is null or v_key is null then
    return query select false, 0::numeric;
    return;
  end if;

  if v_q.type in ('mcq_single', 'mcq_multi') then
    select coalesce(array_agg(distinct x order by x), '{}')
      into v_given_ids
      from jsonb_array_elements_text(public.jsonb_arr(p_response -> 'option_ids')) as t(x);
    select coalesce(array_agg(distinct y order by y), '{}')
      into v_key_ids
      from jsonb_array_elements_text(public.jsonb_arr(v_key -> 'option_ids')) as t(y);

    v_correct := array_length(v_key_ids, 1) is not null and v_given_ids = v_key_ids;
    v_awarded := case when v_correct then v_q.points else 0 end;

  elsif v_q.type = 'true_false' then
    v_correct := jsonb_typeof(p_response -> 'value') = 'boolean'
                 and jsonb_typeof(v_key -> 'value') = 'boolean'
                 and (p_response -> 'value') = (v_key -> 'value');
    v_awarded := case when v_correct then v_q.points else 0 end;

  elsif v_q.type = 'fill_blank' then
    v_parts_all := jsonb_array_length(public.jsonb_arr(v_key -> 'blanks'));
    v_parts_ok  := 0;

    for v_i in 0 .. greatest(v_parts_all - 1, -1) loop
      v_given := public.normalize_ar(coalesce(p_response -> 'blanks' ->> v_i, ''));
      if v_given <> '' and exists (
        select 1
        from jsonb_array_elements_text(public.jsonb_arr(v_key -> 'blanks' -> v_i)) as t(a)
        where public.normalize_ar(a) = v_given
      ) then
        v_parts_ok := v_parts_ok + 1;
      end if;
    end loop;

    if v_parts_all > 0 then
      v_awarded := round(v_q.points * v_parts_ok::numeric / v_parts_all, 2);
      v_correct := v_parts_ok = v_parts_all;
    end if;

  elsif v_q.type in ('matching', 'ordering', 'classification') then
    v_parts_all := jsonb_array_length(public.jsonb_arr(v_key -> 'assign'));
    v_parts_ok  := 0;

    for v_i in 0 .. greatest(v_parts_all - 1, -1) loop
      v_given := coalesce(p_response -> 'assign' ->> v_i, '');
      if v_given <> '' and v_given = (v_key -> 'assign' ->> v_i) then
        v_parts_ok := v_parts_ok + 1;
      end if;
    end loop;

    if v_parts_all > 0 then
      v_awarded := round(v_q.points * v_parts_ok::numeric / v_parts_all, 2);
      v_correct := v_parts_ok = v_parts_all;
    end if;
  end if;

  return query select v_correct, v_awarded;
end;
$$;

-- آلة التخمين مقفولة على الجميع. تناديها الدوال المالكة وحدها.
revoke all on function public.grade_one(uuid, jsonb) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- 5) submit_exam تستدعي المشترك بدل أن تكرّره
-- ---------------------------------------------------------------------------
create or replace function public.submit_exam(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt   public.exam_attempts%rowtype;
  v_exam      public.exams%rowtype;
  v_q         record;
  v_ans       public.answers%rowtype;
  v_correct   boolean;
  v_awarded   numeric(6, 2);
  v_auto      numeric(7, 2) := 0;
  v_total     numeric(7, 2) := 0;
  v_has_essay boolean := false;
  v_elapsed   integer;
  v_exceeded  boolean;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id for update;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_attempt.student_id <> (select auth.uid()) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_attempt.voided_at is not null then
    raise exception 'ATTEMPT_VOIDED' using errcode = '42501';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'ALREADY_SUBMITTED' using errcode = '42501';
  end if;

  select * into v_exam from public.exams where id = v_attempt.exam_id;

  v_elapsed  := greatest(0, floor(extract(epoch from (now() - v_attempt.started_at)))::integer);
  v_exceeded := v_exam.duration_minutes is not null
                and v_elapsed > v_exam.duration_minutes * 60;

  for v_q in
    select q.id, q.type, q.points
    from public.questions q
    where q.exam_id = v_attempt.exam_id
    order by q.position
  loop
    v_total := v_total + v_q.points;

    if v_q.type = 'essay' then
      v_has_essay := true;
      continue;
    end if;

    v_ans := null;
    select * into v_ans from public.answers
      where attempt_id = p_attempt_id and question_id = v_q.id;

    select g.is_correct, g.awarded into v_correct, v_awarded
    from public.grade_one(v_q.id, v_ans.response) as g;

    v_auto := v_auto + v_awarded;

    -- نكتب صفاً حتى للأسئلة المتروكة فارغة، لتظهر في المراجعة بدرجة صفر
    insert into public.answers (attempt_id, question_id, response, awarded_points, is_correct, updated_at)
    values (p_attempt_id, v_q.id, v_ans.response, v_awarded, v_correct, now())
    on conflict (attempt_id, question_id) do update
      set awarded_points = excluded.awarded_points,
          is_correct     = excluded.is_correct;
  end loop;

  update public.exam_attempts set
    status             = case when v_has_essay then 'submitted' else 'graded' end::public.attempt_status,
    submitted_at       = now(),
    time_spent_seconds = v_elapsed,
    exceeded_duration  = v_exceeded,
    auto_score         = v_auto,
    manual_score       = case when v_has_essay then null else 0 end,
    total_points       = v_total
  where id = p_attempt_id;

  return jsonb_build_object(
    'attempt_id',        p_attempt_id,
    'auto_score',        v_auto,
    'total_points',      v_total,
    'has_essay',         v_has_essay,
    'time_spent_seconds', v_elapsed,
    'exceeded_duration', v_exceeded
  );
end;
$$;

revoke all on function public.submit_exam(uuid) from public, anon;
grant execute on function public.submit_exam(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- 6) إجابة سؤال في البنك — الواجهة الوحيدة للطالب
--
--    ترتيب الفحوص مقصود: النوع أولاً. لو انعكس الترتيب لصار الفرق بين
--    رسالة رفض ورسالة أخرى قناةً تُستخرَج منها معلومة عن أسئلة الامتحانات.
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
   * التقدّم للطالب وحده. من صحّت إجابته مرة تبقى حالته "صح" حتى لو عاد
   * فأخطأ لاحقاً وهو يراجع — البنك ليس امتحاناً، وتحويل مراجعةٍ إلى تراجع
   * يعاقب الطالب على أنه راجع.
   */
  if public.is_active_student() then
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


-- تحقّق سريع
select
  (select count(*) from pg_enum e
     join pg_type t on t.oid = e.enumtypid
    where t.typname = 'exam_kind' and e.enumlabel = 'bank')            as "قيمة bank",
  (select count(*) from information_schema.columns
    where table_name = 'question_keys' and column_name = 'explanation') as "عمود الشرح",
  (select count(*) from information_schema.tables
    where table_name = 'bank_progress')                                 as "جدول التقدّم",
  has_function_privilege('authenticated', 'public.grade_one(uuid, jsonb)', 'execute')
                                                                        as "الطالب ينادي grade_one",
  has_function_privilege('authenticated', 'public.check_bank_answer(uuid, jsonb)', 'execute')
                                                                        as "الطالب ينادي البنك";


-- ---------------------------------------------------------------------------
-- 7) الشرح وحده يكفي لوجود الصف
--
--    القيد الأصلي كان يشترط مفتاحاً أو إجابة نموذجية. وسؤال مقالي بشرح بلا
--    إجابة نموذجية صفٌّ مشروع، فكان يُرفض. الشرح ثالثُهما.
-- ---------------------------------------------------------------------------
alter table public.question_keys
  drop constraint if exists question_keys_has_content;

alter table public.question_keys
  add constraint question_keys_has_content
  check (
    key is not null
    or nullif(trim(model_answer), '') is not null
    or nullif(trim(explanation), '')  is not null
  );
