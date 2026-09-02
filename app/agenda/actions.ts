"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/profile";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import { APPOINTMENT_TYPES } from "@/lib/agenda/types";
import { consentRequiredMessage, getConsentAccessPolicy } from "@/lib/consent/access-policy";
import {
  syncAppointmentCancelledToGoogleCalendar,
  syncAppointmentCreatedToGoogleCalendar
} from "@/lib/google-calendar/sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncAppointmentCancelledToZoom, syncAppointmentCreatedToZoom } from "@/lib/zoom/sync";

type AgendaActionState = {
  message?: string;
  ok?: boolean;
};

const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  scheduledAt: z.string().trim().min(16),
  timezoneOffsetMinutes: z.coerce.number().int().min(-840).max(840),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  type: z.enum(APPOINTMENT_TYPES)
});

const cancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  cancellationReason: z.string().trim().min(5).max(1000)
});

async function getActiveProfessional() {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "profesional" || profile.account_status !== "activo") {
    return null;
  }

  return profile;
}

async function assertActiveExpedienteForPatient(patientId: string, professionalId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("expedientes")
    .select("id, patient_id, professional_id, status, consent_status")
    .eq("patient_id", patientId)
    .eq("professional_id", professionalId)
    .eq("status", "activo")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as {
    id: string;
    patient_id: string;
    professional_id: string;
    status: string;
    consent_status: string;
  };
}

async function getPatientForAppointment(patientId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", patientId)
    .eq("role", "paciente")
    .single();

  if (error || !data) {
    return null;
  }

  return data as {
    id: string;
    full_name: string;
    email: string;
  };
}

function parseLocalDateTimeToUtc(value: string, timezoneOffsetMinutes: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute] = match;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);

  if (
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31 ||
    hourNumber > 23 ||
    minuteNumber > 59
  ) {
    return null;
  }

  const localMilliseconds = Date.UTC(
    yearNumber,
    monthNumber - 1,
    dayNumber,
    hourNumber,
    minuteNumber
  );
  const localDate = new Date(localMilliseconds);

  if (
    localDate.getUTCFullYear() !== yearNumber ||
    localDate.getUTCMonth() !== monthNumber - 1 ||
    localDate.getUTCDate() !== dayNumber
  ) {
    return null;
  }

  return new Date(localMilliseconds + timezoneOffsetMinutes * 60 * 1000);
}

export async function createAppointmentAction(
  _previousState: AgendaActionState,
  formData: FormData
): Promise<AgendaActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const scheduledDate = `${formData.get("scheduledDate") ?? ""}`;
  const scheduledTime = `${formData.get("scheduledTime") ?? ""}`;
  const parsed = createAppointmentSchema.safeParse({
    patientId: formData.get("patientId"),
    scheduledAt: `${scheduledDate}T${scheduledTime}`,
    timezoneOffsetMinutes: formData.get("timezoneOffsetMinutes"),
    durationMinutes: formData.get("durationMinutes"),
    type: formData.get("type")
  });

  if (!parsed.success) {
    return { message: "Datos de cita invalidos.", ok: false };
  }

  const scheduledAt = parseLocalDateTimeToUtc(
    parsed.data.scheduledAt,
    parsed.data.timezoneOffsetMinutes
  );

  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    return { message: "Fecha u hora invalida.", ok: false };
  }

  if (scheduledAt.getTime() <= Date.now()) {
    return { message: "La cita debe programarse en una fecha futura.", ok: false };
  }

  const expediente = await assertActiveExpedienteForPatient(parsed.data.patientId, actor.id);

  if (!expediente) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "appointment_create",
      entityType: "citas",
      result: "denied",
      metadata: {
        patient_id: parsed.data.patientId
      },
      context: "audit_appointment_create_denied_patient"
    });

    return { message: "Solo puedes agendar pacientes con expediente activo.", ok: false };
  }

  const consentPolicy = await getConsentAccessPolicy(expediente.id);

  if (!consentPolicy?.canScheduleAppointment) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "appointment_create",
      entityType: "citas",
      result: "denied",
      metadata: {
        patient_id: expediente.patient_id,
        reason: "consent_grace_session_used"
      },
      context: "audit_appointment_create_denied_consent"
    });
    return { message: consentRequiredMessage(), ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const patient = await getPatientForAppointment(expediente.patient_id);

  if (!patient) {
    return { message: "No fue posible cargar los datos del Paciente.", ok: false };
  }

  const overlapEnd = new Date(scheduledAt.getTime() + parsed.data.durationMinutes * 60 * 1000);
  const overlapSearchStart = new Date(scheduledAt.getTime() - 240 * 60 * 1000);
  const { data: possibleOverlaps, error: overlapError } = await supabaseAdmin
    .from("citas")
    .select("id, scheduled_at, duration_minutes")
    .eq("professional_id", actor.id)
    .eq("status", "programada")
    .gte("scheduled_at", overlapSearchStart.toISOString())
    .lt("scheduled_at", overlapEnd.toISOString());

  if (overlapError) {
    Sentry.captureException(overlapError, {
      extra: {
        professional_id: actor.id,
        patient_id: expediente.patient_id
      }
    });

    return { message: "No fue posible verificar disponibilidad.", ok: false };
  }

  const overlappingAppointment = (possibleOverlaps ?? []).find((appointment) => {
    const existingStart = new Date(appointment.scheduled_at).getTime();
    const existingEnd = existingStart + Number(appointment.duration_minutes) * 60 * 1000;

    return existingStart < overlapEnd.getTime() && existingEnd > scheduledAt.getTime();
  });

  if (overlappingAppointment) {
    return { message: "Ya existe una cita programada para este Profesional en esa franja.", ok: false };
  }

  const { data, error } = await supabaseAdmin
    .from("citas")
    .insert({
      professional_id: actor.id,
      patient_id: expediente.patient_id,
      scheduled_at: scheduledAt.toISOString(),
      duration_minutes: parsed.data.durationMinutes,
      type: parsed.data.type,
      created_by_user_id: actor.id
    })
    .select("id")
    .single();

  if (error || !data) {
    Sentry.captureException(error ?? new Error("Appointment insert did not return an id"), {
      extra: {
        professional_id: actor.id,
        patient_id: expediente.patient_id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "appointment_create",
      entityType: "citas",
      result: "error",
      metadata: {
        patient_id: expediente.patient_id
      },
      context: "audit_appointment_create_error"
    });

    return { message: "No fue posible crear la cita.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "appointment_create",
    entityType: "citas",
    entityId: data.id,
    result: "success",
    metadata: {
      patient_id: expediente.patient_id,
      type: parsed.data.type
    },
    context: "audit_appointment_create_success"
  });

  const zoomMeeting =
    parsed.data.type === "videollamada"
      ? await syncAppointmentCreatedToZoom({
          appointmentId: data.id,
          professional: actor,
          patientName: patient.full_name,
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: parsed.data.durationMinutes
        })
      : null;

  await syncAppointmentCreatedToGoogleCalendar({
    appointmentId: data.id,
    professional: actor,
    patientName: patient.full_name,
    patientEmail: patient.email,
    scheduledAt: scheduledAt.toISOString(),
    durationMinutes: parsed.data.durationMinutes,
    type: parsed.data.type,
    zoomJoinUrl: zoomMeeting?.joinUrl
  });

  revalidatePath("/professional/agenda");

  return {
    message: zoomMeeting?.joinUrl
      ? `Cita programada. Link de videollamada creado: ${zoomMeeting.joinUrl}`
      : parsed.data.type === "videollamada"
        ? "Cita programada. No se creo link automatico de Zoom; recuerda crear tu liga de sesion."
        : "Cita programada.",
    ok: true
  };
}

export async function cancelAppointmentAction(
  _previousState: AgendaActionState,
  formData: FormData
): Promise<AgendaActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = cancelAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    cancellationReason: formData.get("cancellationReason")
  });

  if (!parsed.success) {
    return { message: "Agrega un motivo de cancelacion.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: appointment, error: appointmentError } = await supabaseAdmin
    .from("citas")
    .select(
      "id, scheduled_at, professional_id, status, google_calendar_event_id, zoom_meeting_id"
    )
    .eq("id", parsed.data.appointmentId)
    .eq("professional_id", actor.id)
    .single();

  if (appointmentError || !appointment || appointment.status !== "programada") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "appointment_cancel",
      entityType: "citas",
      entityId: parsed.data.appointmentId,
      result: "denied",
      context: "audit_appointment_cancel_denied"
    });

    return { message: "Solo puedes cancelar citas programadas propias.", ok: false };
  }

  if (new Date(appointment.scheduled_at).getTime() <= Date.now()) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "appointment_cancel",
      entityType: "citas",
      entityId: appointment.id,
      result: "denied",
      context: "audit_appointment_cancel_denied_past"
    });

    return { message: "Las citas pasadas son de solo lectura.", ok: false };
  }

  const { error } = await supabaseAdmin
    .from("citas")
    .update({
      status: "cancelada",
      cancellation_reason: parsed.data.cancellationReason,
      cancelled_at: new Date().toISOString(),
      cancelled_by_user_id: actor.id
    })
    .eq("id", appointment.id)
    .eq("professional_id", actor.id)
    .eq("status", "programada");

  if (error) {
    Sentry.captureException(error, {
      extra: {
        appointment_id: appointment.id,
        professional_id: actor.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "appointment_cancel",
      entityType: "citas",
      entityId: appointment.id,
      result: "error",
      context: "audit_appointment_cancel_error"
    });

    return { message: "No fue posible cancelar la cita.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "appointment_cancel",
    entityType: "citas",
    entityId: appointment.id,
    result: "success",
    context: "audit_appointment_cancel_success"
  });

  await syncAppointmentCancelledToZoom(actor, appointment.id, appointment.zoom_meeting_id);

  await syncAppointmentCancelledToGoogleCalendar(
    actor,
    appointment.id,
    appointment.google_calendar_event_id
  );

  revalidatePath("/professional/agenda");

  return { message: "Cita cancelada.", ok: true };
}
