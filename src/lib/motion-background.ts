import { createClient } from "@/lib/supabase/server";

/** الخلفية المتحركة يفتحها المدرّس. لو الإعداد مش متاح، تفضل مقفولة. */
export async function motionBackgroundEnabled(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_settings")
    .select("motion_background")
    .eq("id", true)
    .maybeSingle();

  return data?.motion_background === true;
}
