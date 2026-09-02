import "server-only";

import type { AuthProfile } from "@/lib/auth/types";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AgendaPatientOption, AppointmentListItem, AppointmentStats } from "@/lib/agenda/types";
import type { NotaClinicaSummary } from "@/lib/notas/types";

const APPOINTMENT_SELECT =
  "id, professional_id, patient_id, process_id, tcc_process_id, tcc_session_plan_item_id, scheduled_at, duration_minutes, type, status, zoom_meeting_id, zoom_join_url, zoom_start_url, google_calendar_event_id, cancellation_reason, created_by_user_id, created_at, updated_at, cancelled_at, cancelled_by_user_id";
const BUSINESS_TIME_ZONE = "America/Mexico_City";

async function getPatientsById(patientIds: string[]) {
  if (patientIds.length === 0) {
    return new Map<string, AppointmentListItem["patient"]>();
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", patientIds);

  if (error) {
    throw new Error(`Unable to load appointment patients: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((patient) => [
      patient.id,
      {
        full_name: patient.full_name,
        email: patient.email
      }
    ])
  );
}

function localDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}-${month}-${day}`;
}

async function getRelatedNotesCount(
  professionalId: string,
  appointments: Array<Omit<AppointmentListItem, "patient">>
) {
  if (appointments.length === 0) {
    return new Map<string, number>();
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const patientIds = [...new Set(appointments.map((appointment) => appointment.patient_id))];
  const dates = [...new Set(appointments.map((appointment) => localDateKey(appointment.scheduled_at)))];
  const { data, error } = await supabaseAdmin
    .from("notas_clinicas")
    .select("id, patient_id, session_date")
    .eq("professional_id", professionalId)
    .in("patient_id", patientIds)
    .in("session_date", dates)
    .neq("status", "anulada_logicamente");

  if (error) {
    throw new Error(`Unable to load appointment related notes: ${error.message}`);
  }

  const counts = new Map<string, number>();

  for (const note of data ?? []) {
    const key = `${note.patient_id}:${note.session_date}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export async function getAppointmentsForProfessional(profile: AuthProfile, patientId?: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  let query = supabaseAdmin
    .from("citas")
    .select(APPOINTMENT_SELECT)
    .eq("professional_id", profile.id)
    .order("scheduled_at", { ascending: true });

  if (patientId) {
    query = query.eq("patient_id", patientId);
  }

  const { data, error } = await query;

  if (error) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "appointment_read",
      entityType: "citas",
      result: "error",
      metadata: {
        scope: "professional_list"
      },
      context: "audit_appointment_list_error"
    });

    throw new Error(`Unable to load appointments: ${error.message}`);
  }

  const rows = (data ?? []) as Array<Omit<AppointmentListItem, "patient">>;
  const [patients, noteCounts] = await Promise.all([
    getPatientsById([...new Set(rows.map((row) => row.patient_id))]),
    getRelatedNotesCount(profile.id, rows)
  ]);

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "appointment_read",
    entityType: "citas",
    result: "success",
    metadata: {
      scope: "professional_list",
      count: rows.length
    },
    context: "audit_appointment_list_success"
  });

  return rows.map((row) => ({
    ...row,
    related_notes_count: noteCounts.get(`${row.patient_id}:${localDateKey(row.scheduled_at)}`) ?? 0,
    patient: patients.get(row.patient_id) ?? {
      full_name: "Paciente no disponible",
      email: ""
    }
  })) satisfies AppointmentListItem[];
}

export async function getAppointmentStatsForProfessional(profile: AuthProfile, patientId?: string) {
  const appointments = await getAppointmentsForProfessional(profile, patientId);
  const now = Date.now();
  const stats = appointments.reduce<AppointmentStats>(
    (stats, appointment) => {
      if (appointment.status === "programada") {
        stats.programadas += 1;

        if (new Date(appointment.scheduled_at).getTime() < now) {
          stats.no_tomadas += 1;
        }
      }

      if (appointment.status === "completada") {
        stats.completadas += 1;
      }

      if (appointment.status === "cancelada") {
        stats.canceladas += 1;
      }

      if (appointment.type === "videollamada") {
        stats.videollamadas += 1;
      } else {
        stats.presenciales += 1;
      }

      return stats;
    },
    {
      programadas: 0,
      completadas: 0,
      no_tomadas: 0,
      canceladas: 0,
      reagendadas: 0,
      videollamadas: 0,
      presenciales: 0
    }
  );
  const appointmentIds = appointments.map((appointment) => appointment.id);

  if (appointmentIds.length > 0) {
    const supabaseAdmin = createSupabaseAdminClient();
    const { count } = await supabaseAdmin
      .from("patient_appointment_requests")
      .select("id", { count: "exact", head: true })
      .in("appointment_id", appointmentIds)
      .eq("request_type", "reprogramacion");

    stats.reagendadas = count ?? 0;
  }

  return stats;
}

export async function getAppointmentDetail(profile: AuthProfile, appointmentId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("citas")
    .select(APPOINTMENT_SELECT)
    .eq("id", appointmentId)
    .eq("professional_id", profile.id)
    .single();

  if (error || !data) {
    return null;
  }

  const row = data as Omit<AppointmentListItem, "patient">;
  const [patients, expedienteResult] = await Promise.all([
    getPatientsById([row.patient_id]),
    supabaseAdmin
      .from("expedientes")
      .select("id, status, consent_status")
      .eq("professional_id", profile.id)
      .eq("patient_id", row.patient_id)
      .eq("status", "activo")
      .maybeSingle()
  ]);

  if (expedienteResult.error) {
    throw new Error(`Unable to load appointment expediente: ${expedienteResult.error.message}`);
  }

  const dateKey = localDateKey(row.scheduled_at);
  const { data: notes, error: notesError } = await supabaseAdmin
    .from("notas_clinicas")
    .select("id, expediente_id, note_type, status, session_date, clinical_summary, created_at, confirmed_at, addendum_to_note_id")
    .eq("professional_id", profile.id)
    .eq("patient_id", row.patient_id)
    .eq("session_date", dateKey)
    .neq("status", "anulada_logicamente")
    .order("created_at", { ascending: false });

  if (notesError) {
    throw new Error(`Unable to load appointment notes: ${notesError.message}`);
  }

  return {
    appointment: {
      ...row,
      related_notes_count: notes?.length ?? 0,
      patient: patients.get(row.patient_id) ?? {
        full_name: "Paciente no disponible",
        email: ""
      }
    } satisfies AppointmentListItem,
    expediente: expedienteResult.data as {
      id: string;
      status: string;
      consent_status: string;
    } | null,
    notes: (notes ?? []) as NotaClinicaSummary[]
  };
}

export async function getAgendaPatientOptions(profile: AuthProfile) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("expedientes")
    .select("patient_id")
    .eq("professional_id", profile.id)
    .eq("status", "activo");

  if (error) {
    throw new Error(`Unable to load agenda patients: ${error.message}`);
  }

  const patientIds = [...new Set((data ?? []).map((row) => row.patient_id as string))];

  if (patientIds.length === 0) {
    return [] satisfies AgendaPatientOption[];
  }

  const { data: patients, error: patientsError } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", patientIds)
    .eq("account_status", "activo")
    .order("full_name", { ascending: true });

  if (patientsError) {
    throw new Error(`Unable to load agenda patient profiles: ${patientsError.message}`);
  }

  return (patients ?? []).map((patient) => ({
    id: patient.id,
    full_name: patient.full_name,
    email: patient.email
  })) satisfies AgendaPatientOption[];
}
