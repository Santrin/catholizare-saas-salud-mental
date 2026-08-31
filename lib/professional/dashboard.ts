import "server-only";

import type { AuthProfile } from "@/lib/auth/types";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUSINESS_TIME_ZONE = "America/Mexico_City";
const INACTIVITY_DAYS = 21;

type DashboardPatient = {
  id: string;
  fullName: string;
  expedienteId: string;
};

export type ProfessionalDashboardMetrics = {
  sessionPriceCents: number;
  currency: "MXN";
  monthLabel: string;
  completedSessionsThisMonth: number;
  cancellationsThisMonth: number;
  estimatedRevenueCents: number;
  upcomingAppointmentsCount: number;
  upcomingAppointments: Array<{
    id: string;
    scheduledAt: string;
    type: string;
    patient: DashboardPatient;
  }>;
  recentNotes: Array<{
    id: string;
    sessionDate: string;
    status: string;
    noteType: string;
    patient: DashboardPatient;
  }>;
  activePatients: DashboardPatient[];
  inactivePatients: Array<DashboardPatient & { lastActivityAt: string }>;
  reconceptualizationAlerts: Array<{
    processId: string;
    patient: DashboardPatient;
    sessionsSinceLastReview: number;
    interval: number;
  }>;
};

function mexicoCityMonthBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? now.getUTCFullYear());
  const month = Number(parts.find((part) => part.type === "month")?.value ?? now.getUTCMonth() + 1);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const monthLabel = new Intl.DateTimeFormat("es-MX", {
    timeZone: BUSINESS_TIME_ZONE,
    month: "long",
    year: "numeric"
  }).format(now);

  return {
    start: `${year}-${String(month).padStart(2, "0")}-01T00:00:00-06:00`,
    end: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00-06:00`,
    monthLabel
  };
}

export async function getProfessionalDashboardMetrics(
  profile: AuthProfile
): Promise<ProfessionalDashboardMetrics> {
  const supabaseAdmin = createSupabaseAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const inactivityCutoff = new Date(now.getTime() - INACTIVITY_DAYS * 86_400_000);
  const month = mexicoCityMonthBounds(now);

  const [
    { data: settings, error: settingsError },
    { data: expedientes, error: expedientesError },
    { data: upcoming, error: upcomingError, count: upcomingCount },
    { data: recentNotes, error: notesError },
    { data: monthlyAppointments, error: monthlyError },
    { data: appointmentHistory, error: historyError },
    { data: activeProcesses, error: processesError },
    { data: processNotes, error: processNotesError }
  ] = await Promise.all([
    supabaseAdmin
      .from("professional_dashboard_settings")
      .select("session_price_cents, currency")
      .eq("professional_id", profile.id)
      .maybeSingle(),
    supabaseAdmin
      .from("expedientes")
      .select("id, patient_id, created_at")
      .eq("professional_id", profile.id)
      .eq("status", "activo")
      .order("last_clinical_activity_at", { ascending: false }),
    supabaseAdmin
      .from("citas")
      .select("id, patient_id, scheduled_at, type", { count: "exact" })
      .eq("professional_id", profile.id)
      .eq("status", "programada")
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true }),
    supabaseAdmin
      .from("notas_clinicas")
      .select("id, patient_id, session_date, status, note_type")
      .eq("professional_id", profile.id)
      .neq("status", "anulada_logicamente")
      .order("created_at", { ascending: false })
      .limit(5),
    supabaseAdmin
      .from("citas")
      .select("id, status")
      .eq("professional_id", profile.id)
      .gte("scheduled_at", month.start)
      .lt("scheduled_at", month.end),
    supabaseAdmin
      .from("citas")
      .select("patient_id, scheduled_at")
      .eq("professional_id", profile.id)
      .neq("status", "cancelada")
      .order("scheduled_at", { ascending: false }),
    supabaseAdmin
      .from("procesos_terapeuticos")
      .select("id, patient_id, reconceptualization_interval, last_reconceptualized_session_count")
      .eq("professional_id", profile.id)
      .eq("status", "activo")
      .not("reconceptualization_interval", "is", null),
    supabaseAdmin
      .from("notas_clinicas")
      .select("process_id")
      .eq("professional_id", profile.id)
      .in("status", ["confirmada", "con_addendum", "exportada"])
      .neq("note_type", "addendum")
      .not("process_id", "is", null)
  ]);

  const queryError =
    settingsError ??
    expedientesError ??
    upcomingError ??
    notesError ??
    monthlyError ??
    historyError ??
    processesError ??
    processNotesError;

  if (queryError) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "professional_dashboard_read",
      entityType: "professional_dashboard",
      result: "error",
      context: "audit_professional_dashboard_read_error"
    });
    throw new Error(`Unable to load professional dashboard metrics: ${queryError.message}`);
  }

  const expedienteRows = (expedientes ?? []) as Array<{
    id: string;
    patient_id: string;
    created_at: string;
  }>;
  const patientIds = [...new Set(expedienteRows.map((row) => row.patient_id))];
  const { data: patientProfiles, error: patientsError } = patientIds.length
    ? await supabaseAdmin
        .from("profiles")
        .select("id, full_name, account_status")
        .in("id", patientIds)
        .eq("account_status", "activo")
    : { data: [], error: null };

  if (patientsError) {
    throw new Error(`Unable to load professional dashboard patients: ${patientsError.message}`);
  }

  const profilesById = new Map(
    (patientProfiles ?? []).map((patient) => [patient.id, patient.full_name as string])
  );
  const expedientesByPatient = new Map(
    expedienteRows.map((expediente) => [expediente.patient_id, expediente])
  );
  const activePatients = expedienteRows
    .filter((expediente) => profilesById.has(expediente.patient_id))
    .map((expediente) => ({
      id: expediente.patient_id,
      fullName: profilesById.get(expediente.patient_id) ?? "Paciente no disponible",
      expedienteId: expediente.id
    }));
  const patientFor = (patientId: string): DashboardPatient => ({
    id: patientId,
    fullName: profilesById.get(patientId) ?? "Paciente no disponible",
    expedienteId: expedientesByPatient.get(patientId)?.id ?? ""
  });

  const futurePatientIds = new Set(
    (upcoming ?? []).map((appointment) => appointment.patient_id as string)
  );
  const lastActivityByPatient = new Map<string, string>();

  for (const appointment of appointmentHistory ?? []) {
    const patientId = appointment.patient_id as string;
    if (!lastActivityByPatient.has(patientId) && appointment.scheduled_at < nowIso) {
      lastActivityByPatient.set(patientId, appointment.scheduled_at as string);
    }
  }

  const inactivePatients = activePatients
    .filter((patient) => !futurePatientIds.has(patient.id))
    .map((patient) => ({
      ...patient,
      lastActivityAt:
        lastActivityByPatient.get(patient.id) ??
        expedientesByPatient.get(patient.id)?.created_at ??
        nowIso
    }))
    .filter((patient) => new Date(patient.lastActivityAt).getTime() <= inactivityCutoff.getTime())
    .sort(
      (left, right) =>
        new Date(left.lastActivityAt).getTime() - new Date(right.lastActivityAt).getTime()
    );

  const completedSessionsThisMonth = (monthlyAppointments ?? []).filter(
    (appointment) => appointment.status === "completada"
  ).length;
  const cancellationsThisMonth = (monthlyAppointments ?? []).filter(
    (appointment) => appointment.status === "cancelada"
  ).length;
  const sessionPriceCents = Number(settings?.session_price_cents ?? 0);
  const sessionsByProcess = new Map<string, number>();
  for (const note of processNotes ?? []) {
    const processId = note.process_id as string;
    sessionsByProcess.set(processId, (sessionsByProcess.get(processId) ?? 0) + 1);
  }
  const reconceptualizationAlerts = (activeProcesses ?? []).flatMap((process) => {
    const interval = Number(process.reconceptualization_interval ?? 0);
    const sessionsSinceLastReview = Math.max(
      0,
      (sessionsByProcess.get(process.id as string) ?? 0) -
        Number(process.last_reconceptualized_session_count ?? 0)
    );

    if (!interval || sessionsSinceLastReview < interval) {
      return [];
    }

    return [{
      processId: process.id as string,
      patient: patientFor(process.patient_id as string),
      sessionsSinceLastReview,
      interval
    }];
  });

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "professional_dashboard_read",
    entityType: "professional_dashboard",
    result: "success",
    metadata: {
      active_patients_count: activePatients.length,
      upcoming_appointments_count: upcomingCount ?? 0,
      inactive_patients_count: inactivePatients.length,
      month_completed_sessions_count: completedSessionsThisMonth,
      reconceptualization_alerts_count: reconceptualizationAlerts.length
    },
    context: "audit_professional_dashboard_read_success"
  });

  return {
    sessionPriceCents,
    currency: "MXN",
    monthLabel: month.monthLabel,
    completedSessionsThisMonth,
    cancellationsThisMonth,
    estimatedRevenueCents: completedSessionsThisMonth * sessionPriceCents,
    upcomingAppointmentsCount: upcomingCount ?? 0,
    upcomingAppointments: (upcoming ?? []).slice(0, 5).map((appointment) => ({
      id: appointment.id as string,
      scheduledAt: appointment.scheduled_at as string,
      type: appointment.type as string,
      patient: patientFor(appointment.patient_id as string)
    })),
    recentNotes: (recentNotes ?? []).map((note) => ({
      id: note.id as string,
      sessionDate: note.session_date as string,
      status: note.status as string,
      noteType: note.note_type as string,
      patient: patientFor(note.patient_id as string)
    })),
    activePatients,
    inactivePatients,
    reconceptualizationAlerts
  };
}
