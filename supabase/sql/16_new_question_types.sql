-- =============================================================================
-- منصة البرمجة — 16: توصيل وترتيب وتصنيف
--
-- شغّل هذا الملف بعد 15_storage_quota.sql.
--
-- الأنواع الثلاثة تبدو مختلفة وهي سؤال واحد: "لكل عنصر في قائمة، اختر قيمة".
--   توصيل  — لكل وصف، اختر مصطلحاً
--   تصنيف  — لكل عنصر، اختر سلّة
--   ترتيب  — لكل خطوة، اختر مكانها
-- فلها فرع تصحيح واحد ومفتاح واحد الشكل: {"assign": [...]}, عنصراً بعنصر.
--
-- خطر التسريب: صفحة الحل ترسل question_options.position إلى المتصفح. فلو
-- خُزّنت خطوات سؤال الترتيب بترتيبها الصحيح لقرأ الطالب الإجابة من طلبات
-- الشبكة. لذلك تبعثر المنصة ما يجب بعثرته وقت الاستيراد، لا وقت العرض:
-- بعثرةُ العرض تترك الترتيب المخزَّن كما هو وهو الذي يصل المتصفح.
--
-- عمود role يفصل عناصر السؤال عن اختياراته داخل نفس الجدول، فترث الأنواع
-- الجديدة سياسات RLS والاستعلامات الموجودة بلا جدول جديد ولا استعلام زائد.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) قيم النوع الجديدة. خارج أي كتلة معاملات عمداً: Postgres لا يسمح
--    باستعمال قيمة enum في نفس المعاملة التي أضافتها.
-- ---------------------------------------------------------------------------
alter type public.question_type add value if not exists 'matching';
alter type public.question_type add value if not exists 'ordering';
alter type public.question_type add value if not exists 'classification';


-- ---------------------------------------------------------------------------
-- 2) دور الصف في جدول الخيارات
--
--    item   — عنصر يجيب عنه الطالب (وصف، عنصر، خطوة)
--    choice — قيمة يختار منها (مصطلح، سلّة)
--
--    الصفوف الموجودة كلها اختيارات MCQ فتبقى صحيحة بالقيمة الافتراضية.
-- ---------------------------------------------------------------------------
alter table public.question_options
  add column if not exists role text not null default 'choice';

do $$ begin
  alter table public.question_options
    add constraint question_options_role_check
    check (role in ('item', 'choice'));
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 3) إصلاح تطبيع العربية: ؤ وئ كانا يصيران حرفين مختلفين
--
--    "المسؤول" و"المسئول" نفس الكلمة بيد كاتبين مختلفين، وكانت المنصة
--    تحوّلهما إلى "المسوول" و"المسيول" فترفض الصحيحة منهما. توحيدهما على
--    الهمزة يجعلهما متطابقين.
--
--    ما لا يُصلَح هنا عمداً: الخطأ الإملائي الحقيقي مثل "التشفيير". قبوله
--    يعني قبول إجابات خاطئة، والتسامح الذي يبلغ هذا الحد يفقد السؤال معناه.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_ar(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    trim(regexp_replace(
      translate(
        translate(
          regexp_replace(lower(t), '[ًٌٍَُِّْـٰ]', '', 'g'),
          'أإآٱىةؤئ',
          'اااايهءء'
        ),
        '٠١٢٣٤٥٦٧٨٩',
        '0123456789'
      ),
      '\s+', ' ', 'g'
    )),
    ''
  );
$$;


-- ---------------------------------------------------------------------------
-- 4) التصحيح: فرع واحد للأنواع الثلاثة
--
--    المفتاح {"assign": [...]} وإجابة الطالب بنفس الشكل، والمقارنة عنصراً
--    بعنصر بالنص. توصيل وتصنيف يحملان معرّفات الاختيارات (uuid) لا أرقامها،
--    فترتيب العرض لا يدل على شيء — نفس منطق MCQ. والترتيب يحمل أرقام
--    المواضع، وهي ليست سرّاً لأن السرّ هو أي خطوة تأخذ أي رقم.
--
--    الدرجة الجزئية بنفس صيغة أكمل الفراغ الموجودة: نسبة الصحيح من الكل.
--    قاعدة واحدة للطالب أسهل من قاعدتين، والصيغة مجرّبة أصلاً.
-- ---------------------------------------------------------------------------
create or replace function public.submit_exam(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt     public.exam_attempts%rowtype;
  v_exam        public.exams%rowtype;
  v_q           record;
  v_ans         public.answers%rowtype;
  v_key         jsonb;
  v_correct     boolean;
  v_awarded     numeric(6, 2);
  v_auto        numeric(7, 2) := 0;
  v_total       numeric(7, 2) := 0;
  v_has_essay   boolean := false;
  v_elapsed     integer;
  v_exceeded    boolean;
  v_given_ids   text[];
  v_key_ids     text[];
  v_parts_all   integer;
  v_parts_ok    integer;
  v_i           integer;
  v_given       text;
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
    v_key := null;
    select * into v_ans from public.answers
      where attempt_id = p_attempt_id and question_id = v_q.id;
    select k.key into v_key from public.question_keys k where k.question_id = v_q.id;

    v_correct := false;
    v_awarded := 0;

    if v_ans.id is not null and v_ans.response is not null and v_key is not null then

      if v_q.type in ('mcq_single', 'mcq_multi') then
        select coalesce(array_agg(distinct x order by x), '{}')
          into v_given_ids
          from jsonb_array_elements_text(public.jsonb_arr(v_ans.response -> 'option_ids')) as t(x);
        select coalesce(array_agg(distinct y order by y), '{}')
          into v_key_ids
          from jsonb_array_elements_text(public.jsonb_arr(v_key -> 'option_ids')) as t(y);

        v_correct := array_length(v_key_ids, 1) is not null and v_given_ids = v_key_ids;
        v_awarded := case when v_correct then v_q.points else 0 end;

      elsif v_q.type = 'true_false' then
        v_correct := jsonb_typeof(v_ans.response -> 'value') = 'boolean'
                     and jsonb_typeof(v_key -> 'value') = 'boolean'
                     and (v_ans.response -> 'value') = (v_key -> 'value');
        v_awarded := case when v_correct then v_q.points else 0 end;

      elsif v_q.type = 'fill_blank' then
        v_parts_all := jsonb_array_length(public.jsonb_arr(v_key -> 'blanks'));
        v_parts_ok  := 0;

        for v_i in 0 .. greatest(v_parts_all - 1, -1) loop
          v_given := public.normalize_ar(coalesce(v_ans.response -> 'blanks' ->> v_i, ''));
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
          v_given := coalesce(v_ans.response -> 'assign' ->> v_i, '');
          if v_given <> '' and v_given = (v_key -> 'assign' ->> v_i) then
            v_parts_ok := v_parts_ok + 1;
          end if;
        end loop;

        if v_parts_all > 0 then
          v_awarded := round(v_q.points * v_parts_ok::numeric / v_parts_all, 2);
          v_correct := v_parts_ok = v_parts_all;
        end if;
      end if;
    end if;

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
-- 5) المراجعة تُعيد دور كل خيار
--
--    بدونه لا تستطيع صفحة النتيجة أن تفرّق بين "الأوصاف" و"المصطلحات"،
--    فتعرضهما قائمة واحدة بلا معنى. تغيير حرفي واحد على الدالة، وباقيها
--    كما هو من 14_chapter_kind.sql.
-- ---------------------------------------------------------------------------
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt   public.exam_attempts%rowtype;
  v_exam      public.exams%rowtype;
  v_lesson    public.lessons%rowtype;
  v_chapter   public.chapters%rowtype;
  v_is_admin  boolean := public.is_admin();
  v_reveal    boolean;
  v_questions jsonb;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not v_is_admin then
    if v_attempt.student_id <> (select auth.uid()) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    if v_attempt.status = 'in_progress' then
      raise exception 'NOT_SUBMITTED' using errcode = '42501';
    end if;
  end if;

  select * into v_exam    from public.exams    where id = v_attempt.exam_id;
  select * into v_lesson  from public.lessons  where id = v_exam.lesson_id;
  select * into v_chapter from public.chapters where id = v_lesson.chapter_id;

  v_reveal := v_is_admin or v_exam.reveal_answers;

  select coalesce(jsonb_agg(s.payload order by s.pos), '[]'::jsonb)
    into v_questions
  from (
    select
      q.position as pos,
      jsonb_build_object(
        'id',          q.id,
        'position',    q.position,
        'type',        q.type,
        'body',        q.body,
        'points',      q.points,
        'blank_count', q.blank_count,
        'options', coalesce((
          select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body, 'role', o.role) order by o.position)
          from public.question_options o
          where o.question_id = q.id
        ), '[]'::jsonb),
        'response',       a.response,
        'image_path',     a.image_path,
        'feedback',       a.feedback,
        'awarded_points', case when v_reveal or q.type = 'essay' then a.awarded_points end,
        'is_correct',     case when v_reveal then a.is_correct end,
        'correct',        case when v_reveal then k.key end,
        'model_answer',   case when v_reveal then nullif(trim(coalesce(k.model_answer, '')), '') end
      ) as payload
    from public.questions q
    left join public.answers a
      on a.attempt_id = p_attempt_id and a.question_id = q.id
    left join public.question_keys k
      on k.question_id = q.id
    where q.exam_id = v_attempt.exam_id
  ) s;

  return jsonb_build_object(
    'attempt', jsonb_build_object(
      'id',                 v_attempt.id,
      'status',             v_attempt.status,
      'started_at',         v_attempt.started_at,
      'submitted_at',       v_attempt.submitted_at,
      'time_spent_seconds', v_attempt.time_spent_seconds,
      'exceeded_duration',  v_attempt.exceeded_duration,
      'auto_score',         v_attempt.auto_score,
      'manual_score',       v_attempt.manual_score,
      'total_points',       v_attempt.total_points
    ),
    'exam', jsonb_build_object(
      'id',               v_exam.id,
      'title',            v_exam.title,
      'level',            v_exam.level,
      'kind',             v_exam.kind,
      'duration_minutes', v_exam.duration_minutes,
      'reveal_answers',   v_exam.reveal_answers
    ),
    'lesson_position',  v_lesson.position,
    'lesson_title',     v_lesson.title,
    'lesson_kind',      v_lesson.kind,
    'chapter_position', v_chapter.position,
    'chapter_title',    v_chapter.title,
    'chapter_kind',     v_chapter.kind,
    'reveal',           v_reveal,
    'questions',        v_questions
  );
end;
$$;

revoke all on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.get_attempt_review(uuid) to authenticated;
