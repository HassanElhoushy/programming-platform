"use server";

import { requireStudent } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AnswerResponse, CorrectKey } from "@/lib/types";

export interface BankResult {
  is_correct: boolean;
  awarded: number;
  points: number;
  correct: CorrectKey;
  explanation: string | null;
}

const RPC_MESSAGES: Record<string, string> = {
  NOT_A_BANK_QUESTION: "السؤال ده مش من بنك الأسئلة.",
  BANK_CLOSED: "البنك ده مقفول دلوقتي.",
  FORBIDDEN: "ده مش متاح لحسابك.",
  QUESTION_NOT_FOUND: "مش لاقيين السؤال ده.",
  ESSAY_NOT_IN_BANK: "الأسئلة المقالية مش في البنك.",
};

/**
 * يصحّح سؤال بنك واحداً ويعيد الصحيح وشرحه.
 *
 * لا تصحيح هنا ولا في المتصفح: النداء يذهب إلى check_bank_answer في قاعدة
 * البيانات، وهي التي تتحقق أن السؤال داخل عنصر نوعه bank وأن الطالب يملك
 * صلاحيته. هذا الملف ناقلٌ للرسالة لا حارس — الحارس في السيرفر.
 */
export async function checkBankAnswerAction(
  questionId: string,
  response: AnswerResponse,
): Promise<{ result?: BankResult; error?: string }> {
  await requireStudent();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("check_bank_answer", {
    p_question_id: questionId,
    p_response: response,
  });

  if (error) {
    for (const [code, text] of Object.entries(RPC_MESSAGES)) {
      if (error.message.includes(code)) return { error: text };
    }
    return { error: "حصلت مشكلة. حاول تاني." };
  }

  return { result: data as BankResult };
}
