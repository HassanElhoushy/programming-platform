"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { signInSchema, signUpSchema } from "@/lib/validation";

export interface FormState {
  error?: string;
}

/**
 * التسجيل يتم على السيرفر بالمفتاح السرّي لسببين:
 * أولاً حتى ننشئ الحساب بـ email_confirm فلا ينتظر الطالب رسالة بريد
 * لن يفتحها، وثانياً حتى نعطي رسائل خطأ عربية واضحة بدل أخطاء Supabase.
 *
 * الحساب يُنشأ دائماً بدور طالب وحالة "بانتظار الموافقة" — هذا مفروض في
 * قاعدة البيانات نفسها (trigger + قيود الجدول) ولا يمكن تجاوزه من هنا.
 */
export async function signUpAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signUpSchema.safeParse({
    full_name: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    password: formData.get("password"),
    track: formData.get("track"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "تحقق من البيانات المدخلة" };
  }

  const { full_name, phone, email, password, track } = parsed.data;
  const admin = createAdminClient();

  const { data: existingPhone } = await admin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existingPhone) {
    return { error: "رقم الموبايل ده مسجّل بحساب تاني. لو الحساب بتاعك كلّم المدرّس." };
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone },
  });

  if (createError) {
    const message = createError.message.toLowerCase();
    if (message.includes("already") || message.includes("registered")) {
      return { error: "البريد الإلكتروني ده مسجّل قبل كده. جرّب تسجّل الدخول." };
    }
    if (message.includes("database error")) {
      return { error: "رقم الموبايل أو البريد مستخدم بالفعل." };
    }
    return { error: "حصلت مشكلة أثناء إنشاء الحساب. حاول تاني." };
  }

  /*
   * المسار لا يُؤخذ من user_metadata: الطالب يقدر يعدّل البيانات دي بعد
   * التسجيل. الاختيار يصل من النموذج، ويُكتب هنا بمفتاح الخدمة على ملفه
   * بعد ما الـ trigger ينشئ الصف بحالة «بانتظار الموافقة».
   */
  const { data: profile, error: trackError } = await admin
    .from("profiles")
    .update({ track })
    .eq("id", created.user.id)
    .select("id")
    .maybeSingle();

  if (trackError || !profile) {
    return {
      error: "اتعمل الحساب، بس المسار ما اتسجلش. كلّم المدرّس قبل ما يوافق على الطلب.",
    };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: "اتعمل الحساب بنجاح، بس حصلت مشكلة في تسجيل الدخول. جرّب من صفحة الدخول." };
  }

  redirect("/pending");
}

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "تحقق من البيانات المدخلة" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." };
  }

  redirect("/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
