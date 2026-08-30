-- =============================================================================
-- منصة البرمجة — 10: الإجابة النموذجية للأسئلة المقالية
--
-- شغّل هذا الملف بعد 04_rpc.sql (وهو مضمَّن في 01 و04 للتنصيبات الجديدة،
-- فتشغيله على قاعدة قائمة لا يضر).
--
-- مكان التخزين مقصود: العمود يُضاف إلى question_keys لا إلى questions.
-- question_keys عليه سياسة RLS واحدة لا غير — للمدرّس فقط — فترث الإجابة
-- النموذجية نفس الحماية بالضبط دون سطر إضافي. وهي تستحقها أكثر من إجابة
-- الاختياري: تلك تكشف حرفاً واحداً، وهذه نصٌّ جاهز للنسخ.
--
-- ولأن السؤال المقالي لا مفتاح له، صار العمود key يقبل NULL: صف المقالي
-- يحمل model_answer بلا key.
-- =============================================================================

alter table public.question_keys
  add column if not exists model_answer text;

alter table public.question_keys
  alter column key drop not null;

-- صف بلا مفتاح وبلا إجابة نموذجية لا معنى له
alter table public.question_keys
  drop constraint if exists question_keys_has_content;

alter table public.question_keys
  add constraint question_keys_has_content
  check (key is not null or nullif(trim(model_answer), '') is not null);


-- ---------------------------------------------------------------------------
-- إعادة تعريف دالة المراجعة لتمرّر الإجابة النموذجية.
--
-- الشرط هو نفسه الذي يحكم الإجابات الصحيحة حرفياً: case when v_reveal.
-- ما دام المفتاح مقفولاً يصل الحقل null من قاعدة البيانات، فلا يُرسل النص
-- إلى المتصفح أصلاً ولا يظهر في تبويب الشبكة.
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

revoke all on function public.get_attempt_review(uuid) from public, anon;
grant execute on function public.get_attempt_review(uuid) to authenticated;
