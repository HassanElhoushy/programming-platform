export type UserRole = "admin" | "student";
export type UserStatus = "pending" | "active" | "blocked";
export type FileKind = "explanation" | "slides";
export type ExamLevel = "basic" | "advanced";
export type ExamKind = "practice" | "exam";
export type LessonKind = "lesson" | "review";
export type ChapterKind = "chapter" | "review";
export type AttemptStatus = "in_progress" | "submitted" | "graded";
export type PermissionResource = "lesson" | "file" | "exam";

export type QuestionType =
  | "mcq_single"
  | "mcq_multi"
  | "true_false"
  | "fill_blank"
  | "essay"
  | "matching"
  | "ordering"
  | "classification";

/** الأنواع التي يجيب فيها الطالب عن كل عنصر على حدة */
export const ASSIGN_TYPES = ["matching", "ordering", "classification"] as const;

export function isAssignType(type: string): boolean {
  return (ASSIGN_TYPES as readonly string[]).includes(type);
}

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  full_access: boolean;
  created_at: string;
}

export interface Chapter {
  id: string;
  title: string;
  position: number;
  kind: ChapterKind;
  archived_at: string | null;
}

export interface Lesson {
  id: string;
  chapter_id: string;
  title: string;
  position: number;
  kind: LessonKind;
  archived_at: string | null;
}

export interface LessonFile {
  id: string;
  lesson_id: string;
  title: string;
  kind: FileKind;
  storage_path: string;
  size_bytes: number | null;
  video_url: string | null;
  position: number;
  archived_at: string | null;
  created_at: string;
}

export interface Exam {
  id: string;
  lesson_id: string;
  title: string;
  level: ExamLevel;
  kind: ExamKind;
  duration_minutes: number | null;
  is_open: boolean;
  reveal_answers: boolean;
  archived_at: string | null;
  created_at: string;
}

export interface Question {
  id: string;
  exam_id: string;
  position: number;
  type: QuestionType;
  body: string;
  points: number;
  blank_count: number;
}

export interface QuestionOption {
  id: string;
  role: "item" | "choice";
  question_id: string;
  position: number;
  body: string;
}

export interface ExamAttempt {
  id: string;
  exam_id: string;
  student_id: string;
  status: AttemptStatus;
  started_at: string;
  submitted_at: string | null;
  time_spent_seconds: number | null;
  exceeded_duration: boolean;
  auto_score: number | null;
  manual_score: number | null;
  total_points: number | null;
  voided_at: string | null;
}

/** شكل إجابة الطالب حسب نوع السؤال */
export type AnswerResponse =
  | { option_ids: string[] }
  | { value: boolean }
  | { blanks: string[] }
  | { text: string }
  /*
   * توصيل وتصنيف وترتيب. assign[i] هو ما اختاره الطالب للعنصر رقم i:
   * معرّف اختيار في التوصيل والتصنيف، ورقم مكان في الترتيب.
   */
  | { assign: (string | number | null)[] }
  | null;

export interface Answer {
  id: string;
  attempt_id: string;
  question_id: string;
  response: AnswerResponse;
  image_path: string | null;
  awarded_points: number | null;
  is_correct: boolean | null;
  feedback: string | null;
  graded_at: string | null;
  updated_at: string;
}

/**
 * مفتاح الإجابة الصحيحة كما تعيده get_attempt_review، وفقط عندما يكون
 * المدرّس قد فعّل إظهار الإجابات. في غير ذلك يصل الحقل بقيمة null من
 * قاعدة البيانات نفسها.
 */
export type CorrectKey =
  | { option_ids: string[] }
  | { value: boolean }
  | { blanks: string[][] }
  | { assign: (string | number)[] }
  | null;

/** الشكل الذي تعيده public.get_attempt_review */
export interface AttemptReview {
  attempt: {
    id: string;
    status: AttemptStatus;
    started_at: string;
    submitted_at: string | null;
    time_spent_seconds: number | null;
    exceeded_duration: boolean;
    auto_score: number | null;
    manual_score: number | null;
    total_points: number | null;
  };
  exam: {
    id: string;
    title: string;
    level: ExamLevel;
    kind: ExamKind;
    duration_minutes: number | null;
    reveal_answers: boolean;
  };
  lesson_position: number;
  lesson_title: string;
  lesson_kind: LessonKind;
  chapter_position: number;
  chapter_title: string;
  chapter_kind: ChapterKind;
  reveal: boolean;
  questions: ReviewQuestion[];
}

export interface ReviewQuestion {
  id: string;
  position: number;
  type: QuestionType;
  body: string;
  points: number;
  blank_count: number;
  options: { id: string; body: string; role: "item" | "choice" }[];
  response: AnswerResponse;
  image_path: string | null;
  feedback: string | null;
  awarded_points: number | null;
  is_correct: boolean | null;
  correct: CorrectKey;
  /** الإجابة النموذجية للمقالي — تصل null ما لم يفتح المدرّس إظهار الإجابات */
  model_answer: string | null;
}
