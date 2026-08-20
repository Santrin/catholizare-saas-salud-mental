import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { sendEmail } from "@/lib/email/resend";
import { getServerEnv } from "@/lib/env";
import { getPublicAppUrl } from "@/lib/integrations/public-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function secretsMatch(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function runConsentReminders(request: NextRequest) {
  const env = getServerEnv();
  const configuredSecret = env.CONSENT_REMINDER_CRON_SECRET;
  const receivedSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";

  if (!configuredSecret || !secretsMatch(receivedSecret, configuredSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: consents, error } = await supabaseAdmin
    .from("consentimientos")
    .select("id, expediente_id, standard_sent_at, standard_document_title, standard_document_version")
    .eq("consent_flow", "standard")
    .eq("status", "pendiente")
    .not("standard_sent_at", "is", null)
    .lte("standard_sent_at", cutoff)
    .limit(200);

  if (error) {
    Sentry.captureException(error, { extra: { context: "consent_reminder_query" } });
    return NextResponse.json({ error: "Unable to load pending consents" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const portalUrl = new URL("/portal", getPublicAppUrl()).toString();

  for (const consent of consents ?? []) {
    const { data: expediente } = await supabaseAdmin
      .from("expedientes")
      .select("patient_id")
      .eq("id", consent.expediente_id)
      .maybeSingle();
    if (!expediente) {
      skipped += 1;
      continue;
    }

    const [{ data: patient }, { data: graceUsed }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", expediente.patient_id)
        .maybeSingle(),
      supabaseAdmin.rpc("expediente_grace_session_used", {
        target_expediente_id: consent.expediente_id
      })
    ]);
    if (!patient) {
      skipped += 1;
      continue;
    }

    const ageHours = (Date.now() - new Date(consent.standard_sent_at).getTime()) / 3600000;
    const stage = graceUsed ? "grace_session_used" : ageHours >= 72 ? "72h" : "24h";
    const { data: prior } = await supabaseAdmin
      .from("consent_reminders")
      .select("id")
      .eq("consentimiento_id", consent.id)
      .eq("reminder_stage", stage)
      .maybeSingle();
    if (prior) {
      skipped += 1;
      continue;
    }

    const result = await sendEmail({
      to: patient.email,
      subject: stage === "grace_session_used"
        ? "Accion requerida: firma tu consentimiento informado"
        : "Recordatorio de consentimiento informado",
      html: `<p>Hola ${patient.full_name},</p><p>Tienes pendiente revisar y firmar ${consent.standard_document_title ?? "el consentimiento informado"} version ${consent.standard_document_version ?? "vigente"}.</p>${stage === "grace_session_used" ? "<p>La sesion inicial de gracia ya fue utilizada. No se podran programar nuevas sesiones ni generar nuevas notas hasta completar la firma.</p>" : ""}<p><a href="${portalUrl}">Revisar consentimiento en el portal</a></p>`,
      text: `Hola ${patient.full_name},\n\nTienes pendiente firmar el consentimiento informado.${stage === "grace_session_used" ? " La sesion inicial de gracia ya fue utilizada y el avance se encuentra bloqueado." : ""}\n\n${portalUrl}`
    });

    const reminderStage = result.ok ? stage : `${stage}_failed_${Date.now()}`.slice(0, 80);
    await supabaseAdmin.from("consent_reminders").insert({
      consentimiento_id: consent.id,
      patient_id: patient.id,
      reminder_stage: reminderStage,
      delivery_status: result.ok ? "sent" : "failed",
      provider_status: result.ok ? null : result.status ?? null
    });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: null,
      role: null,
      action: "consent_reminder_automatic",
      entity_type: "consentimientos",
      entity_id: consent.id,
      result: result.ok ? "success" : "error",
      metadata: { stage, patient_id: patient.id }
    });

    if (result.ok) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({ processed: consents?.length ?? 0, sent, failed, skipped });
}

export async function GET(request: NextRequest) {
  return runConsentReminders(request);
}

export async function POST(request: NextRequest) {
  return runConsentReminders(request);
}

