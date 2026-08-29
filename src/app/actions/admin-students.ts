"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PermissionResource, UserStatus } from "@/lib/types";
import type { ActionResult } from "@/app/actions/admin-content";

const GENERIC = "حصلت مشكلة أثناء الحفظ. حاول تاني.";

export async function setStudentStatusAction(
  studentId: string,
  status: UserStatus,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ status })
    .eq("id", studentId)
    .eq("role", "student");

  if (error) return { error: GENERIC };

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true };
}

/**
 * "فتح كل الصلاحيات". هذا العَلَم يتخطّى جدول الصلاحيات التفصيلي، ومعناه
 * أن أي درس أو ملف أو امتحان تضيفه لاحقاً يظهر لهذا الطالب فوراً بلا خطوة
 * إضافية. سحبه يعيده إلى الصلاحيات التفصيلية المسجّلة له، ولا يمسحها.
 */
export async function setFullAccessAction(
  studentId: string,
  fullAccess: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ full_access: fullAccess })
    .eq("id", studentId)
    .eq("role", "student");

  if (error) return { error: GENERIC };

  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true };
}

export async function setPermissionAction(
  studentId: string,
  resourceType: PermissionResource,
  resourceId: string,
  granted: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  if (granted) {
    const { error } = await supabase.from("permissions").upsert(
      {
        student_id: studentId,
        resource_type: resourceType,
        resource_id: resourceId,
        granted_by: admin.id,
      },
      { onConflict: "student_id,resource_type,resource_id" },
    );
    if (error) return { error: GENERIC };
  } else {
    const { error } = await supabase
      .from("permissions")
      .delete()
      .eq("student_id", studentId)
      .eq("resource_type", resourceType)
      .eq("resource_id", resourceId);
    if (error) return { error: GENERIC };
  }

  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true };
}

/**
 * منح أو سحب درس بكل ما فيه بضغطة واحدة.
 * التخزين يبقى تفصيلياً — صف لكل ملف وكل امتحان — حتى يستطيع المدرّس بعدها
 * سحب عنصر واحد بعينه دون أن ينهار الباقي.
 */
export async function setLessonBundleAction(
  studentId: string,
  lessonId: string,
  granted: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [filesRes, examsRes] = await Promise.all([
    supabase.from("lesson_files").select("id").eq("lesson_id", lessonId),
    supabase.from("exams").select("id").eq("lesson_id", lessonId),
  ]);

  const targets: { type: PermissionResource; id: string }[] = [
    { type: "lesson", id: lessonId },
    ...(filesRes.data ?? []).map((f) => ({ type: "file" as const, id: f.id })),
    ...(examsRes.data ?? []).map((e) => ({ type: "exam" as const, id: e.id })),
  ];

  if (granted) {
    const { error } = await supabase.from("permissions").upsert(
      targets.map((t) => ({
        student_id: studentId,
        resource_type: t.type,
        resource_id: t.id,
        granted_by: admin.id,
      })),
      { onConflict: "student_id,resource_type,resource_id" },
    );
    if (error) return { error: GENERIC };
  } else {
    const { error } = await supabase
      .from("permissions")
      .delete()
      .eq("student_id", studentId)
      .in(
        "resource_id",
        targets.map((t) => t.id),
      );
    if (error) return { error: GENERIC };
  }

  revalidatePath(`/admin/students/${studentId}`);
  return { ok: true };
}

/**
 * تصفير كلمة مرور طالب.
 * لا يوجد استرجاع ذاتي لأننا لا نستخدم تأكيد البريد أصلاً، فهذه هي الطريقة
 * الوحيدة: تولّد كلمة جديدة وتبعتها للطالب على الواتساب.
 */
export async function resetStudentPasswordAction(
  studentId: string,
  newPassword: string,
): Promise<ActionResult> {
  await requireAdmin();

  if (newPassword.length < 8) {
    return { error: "كلمة المرور لازم تكون 8 حروف أو أرقام على الأقل." };
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", studentId)
    .maybeSingle();

  if (!profile || profile.role !== "student") {
    return { error: "مش لاقيين الطالب ده." };
  }

  const { error } = await admin.auth.admin.updateUserById(studentId, {
    password: newPassword,
  });

  if (error) return { error: "تعذّر تغيير كلمة المرور. حاول تاني." };

  return { ok: true };
}

export async function voidAttemptAction(
  attemptId: string,
  studentId: string,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("void_attempt", { p_attempt_id: attemptId });
  if (error) return { error: GENERIC };

  revalidatePath(`/admin/students/${studentId}`);
  revalidatePath("/admin/grading");
  return { ok: true };
}

/* ==========================================================================
   تصحيح المقالي
   ========================================================================== */

export async function gradeAttemptAction(
  attemptId: string,
  grades: { question_id: string; awarded_points: number; feedback: string }[],
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.rpc("grade_attempt", {
    p_attempt_id: attemptId,
    p_grades: grades,
  });

  if (error) return { error: "تعذّر حفظ التصحيح. حاول تاني." };

  revalidatePath("/admin/grading");
  revalidatePath(`/admin/grading/${attemptId}`);
  return { ok: true };
}
