"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireStudent } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkStorageRoom, STUDENT_BLOCK_PCT } from "@/lib/storage-quota";
import { createClient } from "@/lib/supabase/server";

const RPC_MESSAGES: Record<string, string> = {
  EXAM_CLOSED: "ده مقفول دلوقتي.",
  FORBIDDEN: "ده مش متاح لحسابك.",
  ATTEMPT_NOT_FOUND: "مش لاقيين المحاولة دي.",
  ATTEMPT_VOIDED: "المحاولة دي اتلغت. ابدأ من جديد.",
  ALREADY_SUBMITTED: "ده اتسلّم قبل كده.",
  NOT_SUBMITTED: "ده لسه ما اتسلّمش.",
};

function messageFor(error: { message: string }): string {
  for (const [code, text] of Object.entries(RPC_MESSAGES)) {
    if (error.message.includes(code)) return text;
  }
  return "حصلت مشكلة. حاول تاني.";
}

export async function startExamAction(examId: string): Promise<{ error?: string }> {
  await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.rpc("start_exam", { p_exam_id: examId });
  if (error) return { error: messageFor(error) };

  revalidatePath(`/exams/${examId}`);
  return {};
}

export async function submitExamAction(
  attemptId: string,
): Promise<{ error?: string }> {
  await requireStudent();
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_exam", { p_attempt_id: attemptId });
  if (error) return { error: messageFor(error) };

  redirect(`/results/${attemptId}?submitted=1`);
}

/**
 * رابط رفع موقّع لصورة إجابة مقالية.
 *
 * الصورة تُرفع من المتصفح مباشرة إلى Supabase Storage ولا تمر بسيرفر Vercel،
 * لكن الإذن بالرفع يصدر من هنا فقط وبعد التأكد أن هذه المحاولة لهذا الطالب
 * وأنها ما زالت قيد الحل. المسار مشتق من المحاولة والسؤال، فلا يستطيع الطالب
 * اختيار مكان الكتابة ولا الكتابة فوق صورة زميله.
 */
export async function createAnswerImageUploadAction(
  attemptId: string,
  questionId: string,
): Promise<{ path?: string; token?: string; error?: string }> {
  const session = await requireStudent();
  const supabase = await createClient();

  const { data: ok } = await supabase.rpc("can_write_answer", {
    p_attempt_id: attemptId,
    p_question_id: questionId,
  });

  if (ok !== true) {
    return { error: "مش مسموح بالرفع للسؤال ده دلوقتي." };
  }

  // آخر خط قبل امتلاء مساحة الباقة المجانية. الرسالة بتدي بديل فوري
  // عشان الطالب يسلّم دلوقتي، مش عشان يستنى حد يفضّي مساحة.
  const room = await checkStorageRoom(STUDENT_BLOCK_PCT);
  if (!room.allowed) {
    return {
      error:
        "مساحة المنصة خلصت تقريباً فمش قادرين نستقبل صور دلوقتي. " +
        "اكتب إجابتك بالكيبورد عادي — هتتحسب كاملة — وبلّغ المدرّس.",
    };
  }

  const path = `${session.id}/${attemptId}/${questionId}.jpg`;
  const admin = createAdminClient();

  const { data, error } = await admin.storage
    .from("answers")
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    return { error: "تعذّر تجهيز رفع الصورة. حاول تاني." };
  }

  return { path: data.path, token: data.token };
}
