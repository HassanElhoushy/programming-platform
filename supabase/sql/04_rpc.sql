-- =============================================================================
-- منصة البرمجة — 04: دوال العمليات (RPC)
-- شغّل هذا الملف بعد 03_rls.sql
--
-- كل ما يمكن للطالب التلاعب به لو حدث في المتصفح، يحدث هنا على السيرفر:
-- بدء المحاولة، التصحيح، وقرار إظهار الإجابات الصحيحة.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- حارس صغير: يضمن أن ما نمرره لـ jsonb_array_elements مصفوفة فعلاً،
-- حتى لا يستطيع طالب عبث بجسم الطلب أن يُسقط دالة التصحيح باستثناء.
-- ---------------------------------------------------------------------------
create or replace function public.jsonb_arr(j jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end;
$$;


-- ---------------------------------------------------------------------------
-- بدء الامتحان (أو استئناف محاولة قائمة).
-- ملاحظة: لو أغلق المدرّس الامتحان بعد أن بدأ الطالب، يكمل الطالب ويسلّم.
-- الإغلاق يمنع البدايات الجديدة فقط.
-- ---------------------------------------------------------------------------
create or replace function public.start_exam(p_exam_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_exam    public.exams%rowtype;
  v_attempt public.exam_attempts%rowtype;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if not public.is_active_student() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not public.can_access_exam(p_exam_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;

  select * into v_attempt
  from public.exam_attempts
  where exam_id = p_exam_id and student_id = v_uid and voided_at is null;

  if found then
    return v_attempt.id;
  end if;

  if not v_exam.is_open then
    raise exception 'EXAM_CLOSED' using errcode = '42501';
  end if;

  insert into public.exam_attempts (exam_id, student_id)
  values (p_exam_id, v_uid)
  returning * into v_attempt;

  return v_attempt.id;
end;
$$;


-- ---------------------------------------------------------------------------
-- تسليم الامتحان والتصحيح الآلي.
--
-- هذه هي الجهة الوحيدة التي تُقرأ فيها question_keys أثناء الحل، وهي تعمل
-- على السيرفر داخل الداتابيز. الإجابة الصحيحة لا تغادر قاعدة البيانات هنا:
-- المُرجَع درجات فقط.
--
-- قواعد التصحيح:
--   اختيار واحد / متعدد : كامل أو صفر (تطابق تام للمجموعة)
--   صح وخطأ             : كامل أو صفر
--   إكمال فراغات        : درجة نسبية بعدد الفراغات الصحيحة، مع تطبيع عربي
--   مقالي               : يُترك للمدرّس
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
  v_blanks_all  integer;
  v_blanks_ok   integer;
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
        v_blanks_all := jsonb_array_length(public.jsonb_arr(v_key -> 'blanks'));
        v_blanks_ok  := 0;

        for v_i in 0 .. greatest(v_blanks_all - 1, -1) loop
          v_given := public.normalize_ar(coalesce(v_ans.response -> 'blanks' ->> v_i, ''));
          if v_given <> '' and exists (
            select 1
            from jsonb_array_elements_text(public.jsonb_arr(v_key -> 'blanks' -> v_i)) as t(a)
            where public.normalize_ar(a) = v_given
          ) then
            v_blanks_ok := v_blanks_ok + 1;
          end if;
        end loop;

        if v_blanks_all > 0 then
          v_awarded := round(v_q.points * v_blanks_ok::numeric / v_blanks_all, 2);
          v_correct := v_blanks_ok = v_blanks_all;
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
    status             = case when v_has_essay then 'submitted' else 'graded' end,
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


-- ---------------------------------------------------------------------------
-- مراجعة محاولة بعد التسليم.
--
-- هذه هي البوابة الوحيدة التي يمكن أن تصل منها إجابة صحيحة إلى الطالب.
-- الشرط: أن تكون المحاولة له، وأن يكون قد سلّمها، وأن يكون المدرّس قد فعّل
-- reveal_answers لهذا الامتحان. غير ذلك تعود الحقول السرّية بقيمة null
-- قبل أن تغادر الداتابيز — لا تُرسَل ثم تُخفى في الواجهة.
--
-- عندما يكون الإظهار مقفولاً يرى الطالب درجته الكلية فقط، ولا يرى حتى
-- أي سؤال أصاب فيه وأي سؤال أخطأ، لأن ذلك بحد ذاته يكشف مفتاح الإجابة.
-- درجة وفيدباك الأسئلة المقالية يظهران دائماً لأنهما تصحيح المدرّس نفسه.
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
          select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body) order by o.position)
          from public.question_options o
          where o.question_id = q.id
        ), '[]'::jsonb),
        'response',       a.response,
        'image_path',     a.image_path,
        'feedback',       a.feedback,
        'awarded_points', case when v_reveal or q.type = 'essay' then a.awarded_points end,
        'is_correct',     case when v_reveal then a.is_correct end,
        'correct',        case when v_reveal then k.key end
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
      'duration_minutes', v_exam.duration_minutes,
      'reveal_answers',   v_exam.reveal_answers
    ),
    'lesson_position',  v_lesson.position,
    'lesson_title',     v_lesson.title,
    'chapter_position', v_chapter.position,
    'chapter_title',    v_chapter.title,
    'reveal',           v_reveal,
    'questions',        v_questions
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- تصحيح المقالي (المدرّس). قابلة للاستدعاء مرة أخرى لتعديل درجة أو فيدباك
-- بعد الإرسال — تُعيد الحساب في كل مرة.
-- p_grades = [{"question_id": "...", "awarded_points": 3.5, "feedback": "..."}]
-- ---------------------------------------------------------------------------
create or replace function public.grade_attempt(p_attempt_id uuid, p_grades jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt      public.exam_attempts%rowtype;
  v_uid          uuid := (select auth.uid());
  v_g            jsonb;
  v_qid          uuid;
  v_points       numeric(6, 2);
  v_awarded      numeric(6, 2);
  v_manual       numeric(7, 2);
  v_pending      integer;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_attempt from public.exam_attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_attempt.status = 'in_progress' then
    raise exception 'NOT_SUBMITTED' using errcode = '42501';
  end if;

  for v_g in select * from jsonb_array_elements(public.jsonb_arr(p_grades))
  loop
    v_qid := (v_g ->> 'question_id')::uuid;

    select q.points into v_points
    from public.questions q
    where q.id = v_qid
      and q.exam_id = v_attempt.exam_id
      and q.type = 'essay';

    if not found then
      continue;  -- سؤال لا ينتمي لهذا الامتحان أو ليس مقالياً: يُتجاهل
    end if;

    v_awarded := least(greatest(coalesce((v_g ->> 'awarded_points')::numeric, 0), 0), v_points);

    insert into public.answers (attempt_id, question_id, awarded_points, feedback, graded_by, graded_at, updated_at)
    values (p_attempt_id, v_qid, v_awarded, nullif(trim(coalesce(v_g ->> 'feedback', '')), ''), v_uid, now(), now())
    on conflict (attempt_id, question_id) do update
      set awarded_points = excluded.awarded_points,
          feedback       = excluded.feedback,
          graded_by      = excluded.graded_by,
          graded_at      = excluded.graded_at;
  end loop;

  select coalesce(sum(a.awarded_points), 0)
    into v_manual
  from public.questions q
  join public.answers a on a.question_id = q.id and a.attempt_id = p_attempt_id
  where q.exam_id = v_attempt.exam_id and q.type = 'essay';

  select count(*)
    into v_pending
  from public.questions q
  left join public.answers a on a.question_id = q.id and a.attempt_id = p_attempt_id
  where q.exam_id = v_attempt.exam_id
    and q.type = 'essay'
    and (a.graded_at is null);

  update public.exam_attempts set
    manual_score = v_manual,
    status       = case when v_pending = 0 then 'graded' else 'submitted' end
  where id = p_attempt_id;

  return jsonb_build_object(
    'manual_score', v_manual,
    'pending',      v_pending,
    'status',       case when v_pending = 0 then 'graded' else 'submitted' end
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- تسجيل أن الطالب اطّلع على تصحيح امتحانه.
-- الطالب لا يملك صلاحية UPDATE على exam_attempts، فيمر عبر هذه الدالة التي
-- تكتب حقلاً واحداً لا غير.
-- ---------------------------------------------------------------------------
create or replace function public.mark_feedback_seen(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.exam_attempts
  set feedback_seen_at = now()
  where id = p_attempt_id
    and student_id = (select auth.uid())
    and status = 'graded'
    and feedback_seen_at is null;
end;
$$;


-- ---------------------------------------------------------------------------
-- إبطال محاولة للسماح للطالب بإعادة الحل. السجل القديم يبقى محفوظاً.
-- ---------------------------------------------------------------------------
create or replace function public.void_attempt(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update public.exam_attempts
  set voided_at = now(),
      voided_by = (select auth.uid())
  where id = p_attempt_id and voided_at is null;
end;
$$;


-- ---------------------------------------------------------------------------
-- صلاحيات التنفيذ: المسجّلون فقط. لا شيء لغير المسجّلين.
-- ---------------------------------------------------------------------------
revoke all on function public.start_exam(uuid)                  from public, anon;
revoke all on function public.submit_exam(uuid)                 from public, anon;
revoke all on function public.get_attempt_review(uuid)          from public, anon;
revoke all on function public.grade_attempt(uuid, jsonb)        from public, anon;
revoke all on function public.void_attempt(uuid)                from public, anon;
revoke all on function public.mark_feedback_seen(uuid)          from public, anon;
revoke all on function public.jsonb_arr(jsonb)                  from public, anon;
revoke all on function public.is_admin()                        from public, anon;
revoke all on function public.is_active_student()               from public, anon;
revoke all on function public.has_grant(public.permission_resource, uuid) from public, anon;
revoke all on function public.can_access_lesson(uuid)           from public, anon;
revoke all on function public.can_see_lesson(uuid)              from public, anon;
revoke all on function public.can_read_exam_questions(uuid)     from public, anon;
revoke all on function public.can_access_file(uuid)             from public, anon;
revoke all on function public.can_access_exam(uuid)             from public, anon;
revoke all on function public.can_write_answer(uuid, uuid)      from public, anon;

grant execute on function public.start_exam(uuid)                  to authenticated;
grant execute on function public.submit_exam(uuid)                 to authenticated;
grant execute on function public.get_attempt_review(uuid)          to authenticated;
grant execute on function public.grade_attempt(uuid, jsonb)        to authenticated;
grant execute on function public.void_attempt(uuid)                to authenticated;
grant execute on function public.mark_feedback_seen(uuid)          to authenticated;
grant execute on function public.jsonb_arr(jsonb)                  to authenticated;
grant execute on function public.is_admin()                        to authenticated;
grant execute on function public.is_active_student()               to authenticated;
grant execute on function public.has_grant(public.permission_resource, uuid) to authenticated;
grant execute on function public.can_access_lesson(uuid)           to authenticated;
grant execute on function public.can_see_lesson(uuid)              to authenticated;
grant execute on function public.can_read_exam_questions(uuid)     to authenticated;
grant execute on function public.can_access_file(uuid)             to authenticated;
grant execute on function public.can_access_exam(uuid)             to authenticated;
grant execute on function public.can_write_answer(uuid, uuid)      to authenticated;
