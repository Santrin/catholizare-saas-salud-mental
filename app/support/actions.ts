"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { safeWriteAuditLog } from "@/lib/audit/safe";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getConsentAccessPolicy, consentRequiredMessage } from "@/lib/consent/access-policy";
import { sendEmail } from "@/lib/email/resend";
import { getPublicAppUrl } from "@/lib/integrations/public-url";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SupportActionState = { message?: string; ok?: boolean };

const messageSchema = z.object({
  conversationId: z.string().uuid().optional().or(z.literal("")),
  subject: z.string().trim().min(3).max(180).optional().or(z.literal("")),
  body: z.string().trim().min(1).max(4000)
});

const conversationStatusSchema = z.object({
  conversationId: z.string().uuid(),
  status: z.enum(["abierto", "resuelto", "cerrado"])
});

const adminAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  professionalId: z.string().uuid(),
  scheduledAt: z.string().trim().min(16),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  type: z.enum(["presencial", "videollamada"])
});

const cancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().trim().min(5).max(1000)
});

const referralSchema = z.object({
  patientId: z.string().uuid(),
  targetProfileId: z.string().uuid().optional().or(z.literal("")),
  targetType: z.string().trim().min(3).max(80),
  operationalNote: z.string().trim().min(5).max(1000)
});

const patientIdSchema = z.object({ patientId: z.string().uuid() });
const legalNoticeSchema = z.object({
  userId: z.string().uuid(),
  noticeType: z.enum(["documento_legal", "recordatorio_operativo"]),
  message: z.string().trim().min(5).max(500)
});

async function getActiveAdmin() {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !["administrador", "super_administrador"].includes(profile.role) ||
    profile.account_status !== "activo"
  ) {
    return null;
  }
  return profile;
}

function parseLocalDateTimeToUtc(value: string, timezoneOffsetMinutes: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  const milliseconds = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(milliseconds);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) return null;
  return new Date(milliseconds + timezoneOffsetMinutes * 60 * 1000);
}

async function auditSupport(
  actor: NonNullable<Awaited<ReturnType<typeof getCurrentProfile>>>,
  action: string,
  result: "success" | "denied" | "error",
  entityId?: string,
  metadata?: Record<string, string | number | boolean | null>
) {
  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action,
    entityType: "support_center",
    entityId,
    result,
    metadata,
    context: `audit_${action}_${result}`
  });
}

export async function sendSupportMessageAction(
  _previousState: SupportActionState,
  formData: FormData
): Promise<SupportActionState> {
  const actor = await getCurrentProfile();
  if (!actor || actor.account_status !== "activo") {
    return { message: "No tienes una sesion activa.", ok: false };
  }

  const parsed = messageSchema.safeParse({
    conversationId: formData.get("conversationId"),
    subject: formData.get("subject"),
    body: formData.get("body")
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message, ok: false };

  const isAdmin = ["administrador", "super_administrador"].includes(actor.role);
  const isParticipant = ["paciente", "profesional"].includes(actor.role);
  if (!isAdmin && !isParticipant) return { message: "Rol no permitido.", ok: false };

  const supabaseAdmin = createSupabaseAdminClient();
  let conversationId = parsed.data.conversationId || null;

  if (isAdmin) {
    if (!conversationId) return { message: "Selecciona una conversacion.", ok: false };
    const { data: conversation } = await supabaseAdmin
      .from("support_conversations")
      .select("id, status")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conversation || conversation.status === "cerrado") {
      return { message: "La conversacion no esta disponible.", ok: false };
    }
  } else if (!conversationId) {
    const { data: existing } = await supabaseAdmin
      .from("support_conversations")
      .select("id")
      .eq("participant_id", actor.id)
      .neq("status", "cerrado")
      .maybeSingle();
    conversationId = existing?.id ?? null;

    if (!conversationId) {
      const { data: created, error: createError } = await supabaseAdmin
        .from("support_conversations")
        .insert({
          participant_id: actor.id,
          participant_role: actor.role,
          subject: parsed.data.subject || "Atencion operativa"
        })
        .select("id")
        .single();
      if (createError || !created) {
        Sentry.captureException(createError);
        return { message: "No fue posible abrir el canal de atencion.", ok: false };
      }
      conversationId = created.id;
    }
  } else {
    const { data: owned } = await supabaseAdmin
      .from("support_conversations")
      .select("id, status")
      .eq("id", conversationId)
      .eq("participant_id", actor.id)
      .maybeSingle();
    if (!owned || owned.status === "cerrado") {
      return { message: "La conversacion no esta disponible.", ok: false };
    }
  }

  const { error } = await supabaseAdmin.from("support_messages").insert({
    conversation_id: conversationId,
    sender_id: actor.id,
    kind: "mensaje",
    body: parsed.data.body
  });

  if (error) {
    Sentry.captureException(error, { extra: { conversation_id: conversationId } });
    await auditSupport(actor, "support_message_send", "error", conversationId ?? undefined);
    return { message: "No fue posible enviar el mensaje.", ok: false };
  }

  await auditSupport(actor, "support_message_send", "success", conversationId ?? undefined);
  revalidatePath("/portal");
  revalidatePath("/professional/help");
  revalidatePath("/admin/support");
  revalidatePath("/super-admin/support");
  return { message: "Mensaje enviado.", ok: true };
}

export async function updateSupportConversationStatusAction(
  _previousState: SupportActionState,
  formData: FormData
): Promise<SupportActionState> {
  const actor = await getActiveAdmin();
  if (!actor) return { message: "No tienes permisos.", ok: false };
  const parsed = conversationStatusSchema.safeParse({
    conversationId: formData.get("conversationId"),
    status: formData.get("status")
  });
  if (!parsed.success) return { message: "Datos invalidos.", ok: false };

  const { data, error } = await createSupabaseAdminClient()
    .from("support_conversations")
    .update({ status: parsed.data.status, assigned_admin_id: actor.id })
    .eq("id", parsed.data.conversationId)
    .select("id")
    .single();
  if (error || !data) return { message: "No fue posible actualizar el canal.", ok: false };
  await auditSupport(actor, "support_conversation_update", "success", data.id, { status: parsed.data.status });
  revalidatePath("/admin/support");
  revalidatePath("/super-admin/support");
  return { message: "Canal actualizado.", ok: true };
}

export async function adminCreateAppointmentAction(
  _previousState: SupportActionState,
  formData: FormData
): Promise<SupportActionState> {
  const actor = await getActiveAdmin();
  if (!actor) return { message: "No tienes permisos.", ok: false };
  const scheduledDate = `${formData.get("scheduledDate") ?? ""}`;
  const scheduledTime = `${formData.get("scheduledTime") ?? ""}`;
  const parsed = adminAppointmentSchema.safeParse({
    patientId: formData.get("patientId"),
    professionalId: formData.get("professionalId"),
    scheduledAt: `${scheduledDate}T${scheduledTime}`,
    timezoneOffsetMinutes: formData.get("timezoneOffsetMinutes"),
    durationMinutes: formData.get("durationMinutes"),
    type: formData.get("type")
  });
  if (!parsed.success) return { message: "Completa correctamente los datos de la cita.", ok: false };
  const scheduledAt = parseLocalDateTimeToUtc(parsed.data.scheduledAt, parsed.data.timezoneOffsetMinutes);
  if (!scheduledAt || scheduledAt.getTime() <= Date.now()) {
    return { message: "La cita debe tener una fecha futura valida.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: expediente } = await supabaseAdmin
    .from("expedientes")
    .select("id")
    .eq("patient_id", parsed.data.patientId)
    .eq("professional_id", parsed.data.professionalId)
    .eq("status", "activo")
    .maybeSingle();
  if (!expediente) return { message: "No existe un expediente activo para esta relacion.", ok: false };
  const policy = await getConsentAccessPolicy(expediente.id);
  if (!policy?.canScheduleAppointment) {
    await auditSupport(actor, "admin_appointment_create", "denied", undefined, { expediente_id: expediente.id });
    return { message: consentRequiredMessage(), ok: false };
  }

  const overlapEnd = new Date(scheduledAt.getTime() + parsed.data.durationMinutes * 60000);
  const overlapStart = new Date(scheduledAt.getTime() - 240 * 60000);
  const { data: overlaps, error: overlapError } = await supabaseAdmin
    .from("citas")
    .select("scheduled_at, duration_minutes")
    .eq("professional_id", parsed.data.professionalId)
    .eq("status", "programada")
    .gte("scheduled_at", overlapStart.toISOString())
    .lt("scheduled_at", overlapEnd.toISOString());
  if (overlapError) return { message: "No fue posible verificar disponibilidad.", ok: false };
  const hasOverlap = (overlaps ?? []).some((item) => {
    const start = new Date(item.scheduled_at).getTime();
    return start < overlapEnd.getTime() && start + Number(item.duration_minutes) * 60000 > scheduledAt.getTime();
  });
  if (hasOverlap) return { message: "El profesional ya tiene una cita en ese horario.", ok: false };

  const { data, error } = await supabaseAdmin
    .from("citas")
    .insert({
      professional_id: parsed.data.professionalId,
      patient_id: parsed.data.patientId,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: parsed.data.durationMinutes,
      type: parsed.data.type,
      created_by_user_id: actor.id
    })
    .select("id")
    .single();
  if (error || !data) {
    Sentry.captureException(error);
    return { message: "No fue posible crear la cita.", ok: false };
  }
  await auditSupport(actor, "admin_appointment_create", "success", data.id, {
    patient_id: parsed.data.patientId,
    professional_id: parsed.data.professionalId
  });
  revalidatePath("/admin/support");
  return { message: "Cita programada. Las integraciones personales deben revisarse con el profesional.", ok: true };
}

export async function adminCancelAppointmentAction(
  _previousState: SupportActionState,
  formData: FormData
): Promise<SupportActionState> {
  const actor = await getActiveAdmin();
  if (!actor) return { message: "No tienes permisos.", ok: false };
  const parsed = cancelAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: formData.get("reason")
  });
  if (!parsed.success) return { message: "Selecciona la cita y escribe el motivo.", ok: false };
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("citas")
    .update({
      status: "cancelada",
      cancellation_reason: parsed.data.reason,
      cancelled_at: new Date().toISOString(),
      cancelled_by_user_id: actor.id
    })
    .eq("id", parsed.data.appointmentId)
    .eq("status", "programada")
    .gt("scheduled_at", new Date().toISOString())
    .select("id")
    .single();
  if (error || !data) return { message: "La cita no existe, ya paso o no esta programada.", ok: false };
  await auditSupport(actor, "admin_appointment_cancel", "success", data.id);
  revalidatePath("/admin/support");
  return { message: "Cita cancelada. El profesional debe revisar sus integraciones externas.", ok: true };
}

export async function adminCreateReferralAction(
  _previousState: SupportActionState,
  formData: FormData
): Promise<SupportActionState> {
  const actor = await getActiveAdmin();
  if (!actor) return { message: "No tienes permisos.", ok: false };
  const parsed = referralSchema.safeParse({
    patientId: formData.get("patientId"),
    targetProfileId: formData.get("targetProfileId"),
    targetType: formData.get("targetType"),
    operationalNote: formData.get("operationalNote")
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message, ok: false };
  const { data, error } = await createSupabaseAdminClient()
    .from("support_referrals")
    .insert({
      patient_id: parsed.data.patientId,
      created_by_admin_id: actor.id,
      target_profile_id: parsed.data.targetProfileId || null,
      target_type: parsed.data.targetType,
      operational_note: parsed.data.operationalNote
    })
    .select("id")
    .single();
  if (error || !data) return { message: "No fue posible registrar la canalizacion.", ok: false };
  await auditSupport(actor, "support_referral_create", "success", data.id, { patient_id: parsed.data.patientId });
  return { message: "Canalizacion registrada.", ok: true };
}

export async function adminSendConsentReminderAction(
  _previousState: SupportActionState,
  formData: FormData
): Promise<SupportActionState> {
  const actor = await getActiveAdmin();
  if (!actor) return { message: "No tienes permisos.", ok: false };
  const parsed = patientIdSchema.safeParse({ patientId: formData.get("patientId") });
  if (!parsed.success) return { message: "Selecciona un paciente.", ok: false };
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: patient } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", parsed.data.patientId)
    .eq("role", "paciente")
    .maybeSingle();
  const { data: expediente } = await supabaseAdmin
    .from("expedientes")
    .select("id")
    .eq("patient_id", parsed.data.patientId)
    .eq("status", "activo")
    .maybeSingle();
  if (!patient || !expediente) return { message: "Paciente o expediente no disponible.", ok: false };
  const { data: consent } = await supabaseAdmin
    .from("consentimientos")
    .select("id, status, standard_document_title, standard_document_version")
    .eq("expediente_id", expediente.id)
    .eq("consent_flow", "standard")
    .eq("status", "pendiente")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!consent) return { message: "No existe consentimiento estandar pendiente.", ok: false };

  const portalUrl = new URL("/portal", getPublicAppUrl()).toString();
  const result = await sendEmail({
    to: patient.email,
    subject: "Recordatorio de consentimiento informado",
    html: `<p>Hola ${patient.full_name},</p><p>Tienes pendiente revisar y firmar ${consent.standard_document_title ?? "el consentimiento informado"} version ${consent.standard_document_version ?? "vigente"}.</p><p><a href="${portalUrl}">Abrir portal de paciente</a></p>`,
    text: `Hola ${patient.full_name},\n\nTienes pendiente revisar y firmar el consentimiento informado.\n\n${portalUrl}`
  });
  await supabaseAdmin.from("consent_reminders").insert({
    consentimiento_id: consent.id,
    patient_id: patient.id,
    sent_by_user_id: actor.id,
    reminder_stage: `manual_${new Date().toISOString()}`.slice(0, 80),
    delivery_status: result.ok ? "sent" : "failed",
    provider_status: result.ok ? null : result.status ?? null
  });
  await auditSupport(actor, "consent_reminder_send", result.ok ? "success" : "error", consent.id, {
    patient_id: patient.id
  });
  return result.ok
    ? { message: "Recordatorio enviado.", ok: true }
    : { message: `No fue posible enviar el correo: ${result.error}`, ok: false };
}

export async function adminSendLegalNoticeAction(
  _previousState: SupportActionState,
  formData: FormData
): Promise<SupportActionState> {
  const actor = await getActiveAdmin();
  if (!actor) return { message: "No tienes permisos.", ok: false };
  const parsed = legalNoticeSchema.safeParse({
    userId: formData.get("userId"),
    noticeType: formData.get("noticeType"),
    message: formData.get("message")
  });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message, ok: false };

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: target } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", parsed.data.userId)
    .in("role", ["paciente", "profesional"])
    .maybeSingle();
  if (!target) return { message: "Usuario no disponible.", ok: false };

  const destination = target.role === "paciente" ? "/portal" : "/professional";
  const actionUrl = new URL(destination, getPublicAppUrl()).toString();
  const subject = parsed.data.noticeType === "documento_legal"
    ? "Documento legal disponible en Catholizare OS"
    : "Recordatorio de Catholizare OS";
  const result = await sendEmail({
    to: target.email,
    subject,
    html: `<p>Hola ${target.full_name},</p><p>${parsed.data.message}</p><p><a href="${actionUrl}">Abrir Catholizare OS</a></p><p>Este correo no incluye contenido clinico ni archivos privados.</p>`,
    text: `Hola ${target.full_name},\n\n${parsed.data.message}\n\n${actionUrl}\n\nEste correo no incluye contenido clinico ni archivos privados.`
  });
  await auditSupport(actor, "support_legal_notice_send", result.ok ? "success" : "error", target.id, {
    notice_type: parsed.data.noticeType,
    target_role: target.role
  });
  return result.ok
    ? { message: "Aviso enviado.", ok: true }
    : { message: `No fue posible enviar el aviso: ${result.error}`, ok: false };
}
