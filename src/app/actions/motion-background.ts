"use server";

import { revalidatePath } from "next/cache";

import type { ActionResult } from "@/app/actions/admin-content";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const GENERIC = "حصلت مشكلة أثناء الحفظ. حاول تاني.";

/** يفتح الخلفية المتحركة أو يقفلها عند المدرّس والطلبة مع بعض. */
export async function setMotionBackgroundAction(enabled: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("platform_settings")
    .update({ motion_background: enabled })
    .eq("id", true);

  if (error) return { error: GENERIC };

  revalidatePath("/", "layout");
  return { ok: true };
}
