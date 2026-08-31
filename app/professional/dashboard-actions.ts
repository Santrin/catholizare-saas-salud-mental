"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { safeWriteAuditLog } from "@/lib/audit/safe";
import { getCurrentProfile } from "@/lib/auth/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DashboardSettingsActionState = {
  message?: string;
  ok?: boolean;
};

const sessionPriceSchema = z.object({
  sessionPrice: z.coerce.number().min(0).max(1_000_000)
});

export async function updateDashboardSessionPriceAction(
  _previousState: DashboardSettingsActionState,
  formData: FormData
): Promise<DashboardSettingsActionState> {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "profesional" || profile.account_status !== "activo") {
    return { message: "No tienes permiso para actualizar esta tarifa.", ok: false };
  }

  const parsed = sessionPriceSchema.safeParse({
    sessionPrice: formData.get("sessionPrice")
  });

  if (!parsed.success) {
    return { message: "Ingresa una tarifa valida entre $0 y $1,000,000 MXN.", ok: false };
  }

  const sessionPriceCents = Math.round(parsed.data.sessionPrice * 100);
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("professional_dashboard_settings").upsert(
    {
      professional_id: profile.id,
      session_price_cents: sessionPriceCents,
      currency: "MXN"
    },
    { onConflict: "professional_id" }
  );

  if (error) {
    Sentry.captureException(error, { extra: { context: "professional_dashboard_price_update" } });
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "professional_dashboard_settings_update",
      entityType: "professional_dashboard_settings",
      result: "error",
      context: "audit_professional_dashboard_settings_update_error"
    });
    return { message: "No fue posible guardar la tarifa por sesion.", ok: false };
  }

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "professional_dashboard_settings_update",
    entityType: "professional_dashboard_settings",
    entityId: profile.id,
    result: "success",
    metadata: { currency: "MXN" },
    context: "audit_professional_dashboard_settings_update_success"
  });

  revalidatePath("/professional");
  return { message: "Tarifa por sesion actualizada.", ok: true };
}
