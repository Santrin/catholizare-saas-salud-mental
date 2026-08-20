import "server-only";

import type { AuthProfile } from "@/lib/auth/types";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import {
  STANDARD_CONSENT_TEXT,
  STANDARD_CONSENT_TITLE,
  STANDARD_CONSENT_VERSION
} from "@/lib/consent/standard-consent";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPatientAnnouncementsDashboard } from "@/lib/pro/queries";
import { PROCESS_MODEL_LABEL, type ProcessModelType } from "@/lib/procesos/types";
import type {
  PatientPortalSummary,
  PortalAppointment,
  PortalAppointmentRequest,
  PortalAssessmentExpedienteOption,
  PortalAssessmentRequest,
  PortalAssessmentUpload,
  PortalCatholizareLink,
  PortalConsentStatus,
  PortalLifeHistory,
  PortalProcessHistory,
  PortalRecommendation,
  PortalStandardConsent
} from "@/lib/portal/types";
import {
  getPortalBlogRecommendations,
  PORTAL_RESOURCE_TOPICS,
  type PortalResourceTopic
} from "@/lib/portal/resource-recommendations";

type AppointmentRow = {
  id: string;
  professional_id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: "presencial" | "videollamada";
  status: "programada" | "completada" | "cancelada";
  cancellation_reason: string | null;
  zoom_join_url: string | null;
};

type NotaTemplateValues = Record<string, Record<string, string | number | boolean | null>>;

const ZOOM_JOIN_WINDOW_MS = 24 * 60 * 60 * 1000;
const LIFE_HISTORY_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CATHOLIZARE_LINKS: PortalCatholizareLink[] = [
  {
    title: "Herramientas para tu motivo de consulta",
    description: "Explora respuestas del blog y recursos psicoespirituales de Catholizare.",
    href: "https://catholizare.com/ciencia-y-fe-para-la-vida-real/",
    category: "recurso"
  },
  {
    title: "Oratorio",
    description: "Espacio de oracion y comunidad disponible desde Catholizare.",
    href: "https://catholizare.com/oratorio/",
    category: "evento"
  },
  {
    title: "Terapia individual",
    description: "Busca un profesional para un proceso individual.",
    href: "https://catholizare.com/psicologos-catolicos/terapia-individual/",
    category: "proceso"
  },
  {
    title: "Terapia de pareja",
    description: "Encuentra acompanamiento para pareja.",
    href: "https://catholizare.com/psicologos-catolicos/terapia-de-pareja/",
    category: "proceso"
  },
  {
    title: "Terapia familiar",
    description: "Encuentra acompanamiento familiar.",
    href: "https://catholizare.com/psicologos-catolicos/terapia-familiar/",
    category: "proceso"
  },
  {
    title: "Para consagrados",
    description: "Atencion psicologica para sacerdotes, consagrados o laicos.",
    href: "https://catholizare.com/psicologos-catolicos/psicologos-catolicos-para-sacerdotes-consagrados-o-laicos/",
    category: "proceso"
  },
  {
    title: "Tests autoadministrables",
    description: "Accede a tests y quizzes de orientacion desde Catholizare.",
    href: "https://catholizare.com/category/test/",
    category: "test"
  },
  {
    title: "Podcast",
    description: "Seccion reservada para contenidos de audio.",
    href: "https://catholizare.com/category/formatos/podcast/",
    category: "podcast"
  }
];

async function getProfilesById(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, PortalAppointment["professional"]>();
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);

  if (error) {
    throw new Error(`Unable to load portal profile data: ${error.message}`);
  }

  return new Map(
    (data ?? []).map((profile) => [
      profile.id,
      {
        full_name: profile.full_name,
        email: profile.email
      }
    ])
  );
}

async function getReviewedAppointmentIds(patientId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("patient_experience_reviews")
    .select("appointment_id")
    .eq("patient_id", patientId);

  if (error) {
    throw new Error(`Unable to load patient reviews: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.appointment_id as string));
}

function mapPortalAppointment(
  row: AppointmentRow,
  professionals: Map<string, PortalAppointment["professional"]>,
  reviewedAppointmentIds: Set<string>
) {
  const now = Date.now();
  const startsAt = new Date(row.scheduled_at).getTime();
  const endsAt = startsAt + row.duration_minutes * 60 * 1000;
  const isFuture = startsAt > now;
  const isPast = endsAt < now;
  const hasZoomLink = row.type === "videollamada" && Boolean(row.zoom_join_url);
  const canJoinZoom =
    row.status === "programada" &&
    hasZoomLink &&
    startsAt - now <= ZOOM_JOIN_WINDOW_MS &&
    endsAt > now;
  const hasReview = reviewedAppointmentIds.has(row.id);

  return {
    id: row.id,
    professional_id: row.professional_id,
    scheduled_at: row.scheduled_at,
    duration_minutes: row.duration_minutes,
    type: row.type,
    status: row.status,
    cancellation_reason: row.cancellation_reason,
    has_zoom_link: hasZoomLink,
    can_join_zoom: canJoinZoom,
    can_request_change: row.status === "programada" && isFuture,
    can_review: isPast && !hasReview,
    has_review: hasReview,
    professional: professionals.get(row.professional_id) ?? {
      full_name: "Profesional no disponible",
      email: ""
    }
  } satisfies PortalAppointment;
}

export async function getPortalDashboard(profile: AuthProfile) {
  const supabaseAdmin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data: expedientes, error: expedientesError } = await supabaseAdmin
    .from("expedientes")
    .select("id, professional_id, initial_consultation_reason")
    .eq("patient_id", profile.id)
    .eq("status", "activo");

  if (expedientesError) {
    throw new Error(`Unable to load patient portal expedientes: ${expedientesError.message}`);
  }

  const activeExpedientes = (expedientes ?? []) as Array<{
    id: string;
    professional_id: string;
    initial_consultation_reason: string | null;
  }>;
  const expedienteIds = activeExpedientes.map((row) => row.id);
  const summaryQuery =
    expedienteIds.length > 0
      ? supabaseAdmin
          .from("resumenes_terapeuticos")
          .select("expediente_id, content, source, published_at")
          .eq("status", "publicado")
          .in("expediente_id", expedienteIds)
          .order("published_at", { ascending: false })
          .limit(1)
      : Promise.resolve({ data: [], error: null });
  const [{ data: summaryRows, error: summaryError }, { data: appointments, error: appointmentsError }] =
    await Promise.all([
      summaryQuery,
      supabaseAdmin
        .from("citas")
        .select(
          "id, professional_id, scheduled_at, duration_minutes, type, status, cancellation_reason, zoom_join_url"
        )
        .eq("patient_id", profile.id)
        .order("scheduled_at", { ascending: true })
    ]);

  if (summaryError) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "portal_summary_read",
      entityType: "resumenes_terapeuticos",
      result: "error",
      context: "audit_portal_summary_read_error"
    });
    throw new Error(`Unable to load patient portal summary: ${summaryError.message}`);
  }

  if (appointmentsError) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "portal_appointments_read",
      entityType: "citas",
      result: "error",
      context: "audit_portal_appointments_read_error"
    });
    throw new Error(`Unable to load patient portal appointments: ${appointmentsError.message}`);
  }

  const appointmentRows = (appointments ?? []) as AppointmentRow[];
  const [professionals, reviewedAppointmentIds] = await Promise.all([
    getProfilesById([...new Set(appointmentRows.map((row) => row.professional_id))]),
    getReviewedAppointmentIds(profile.id)
  ]);
  const portalAppointments = appointmentRows.map((row) =>
    mapPortalAppointment(row, professionals, reviewedAppointmentIds)
  );
  const upcomingAppointments = portalAppointments.filter(
    (appointment) =>
      appointment.status === "programada" && new Date(appointment.scheduled_at).toISOString() >= nowIso
  );
  const pastAppointments = portalAppointments
    .filter((appointment) => new Date(appointment.scheduled_at).toISOString() < nowIso)
    .sort(
      (left, right) =>
        new Date(right.scheduled_at).getTime() - new Date(left.scheduled_at).getTime()
    )
    .slice(0, 10);
  const summary = await enrichSummary(
    summaryRows?.[0] as Omit<PatientPortalSummary, "professional"> | undefined
  );
  const [
    requests,
    standardConsents,
    consentStatuses,
    lifeHistory,
    recommendations,
    resourcePreferences,
    processHistory,
    assessmentRequests,
    assessmentUploads,
    assessmentExpedientes,
    announcements
  ] = await Promise.all([
    getPortalAppointmentRequests(profile.id),
    getPortalStandardConsents(activeExpedientes),
    getPortalConsentStatuses(activeExpedientes),
    getPortalLifeHistory(profile.id),
    getPortalRecommendations(expedienteIds),
    getPortalResourcePreferences(profile.id),
    getPortalProcessHistory(activeExpedientes),
    getPortalAssessmentRequests(profile.id),
    getPortalAssessmentUploads(profile.id),
    enrichAssessmentExpedientes(activeExpedientes),
    getPatientAnnouncementsDashboard(profile)
  ]);

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "portal_dashboard_read",
    entityType: "portal",
    result: "success",
    metadata: {
      upcoming_count: upcomingAppointments.length,
      past_count: pastAppointments.length,
      has_summary: Boolean(summary),
      standard_consent_count: standardConsents.length,
      has_life_history: Boolean(lifeHistory),
      assessment_upload_count: assessmentUploads.length
    },
    context: "audit_portal_dashboard_read_success"
  });

  return {
    summary,
    upcomingAppointments,
    pastAppointments,
    requests,
    standardConsents,
    consentStatuses,
    lifeHistory,
    recommendations,
    resourcePreferences,
    processHistory,
    catholizareLinks: CATHOLIZARE_LINKS,
    assessmentExpedientes,
    assessmentRequests,
    assessmentUploads,
    announcements
  };
}

async function getPortalResourcePreferences(patientId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("patient_resource_preferences")
    .select("selected_topics")
    .eq("patient_id", patientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load portal resource preferences: ${error.message}`);
  }

  const allowedTopics = new Set<string>(PORTAL_RESOURCE_TOPICS);
  const selectedTopics = ((data?.selected_topics ?? []) as string[]).filter(
    (topic): topic is PortalResourceTopic => allowedTopics.has(topic)
  );

  return {
    selected_topics: selectedTopics,
    recommendations: getPortalBlogRecommendations(selectedTopics)
  };
}

async function getPortalStandardConsents(
  expedientes: Array<{ id: string; professional_id: string }>
): Promise<PortalStandardConsent[]> {
  if (expedientes.length === 0) {
    return [];
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const expedienteIds = expedientes.map((expediente) => expediente.id);
  const { data, error } = await supabaseAdmin
    .from("consentimientos")
    .select(
      "id, expediente_id, status, standard_document_title, standard_document_version, standard_sent_at, created_at"
    )
    .in("expediente_id", expedienteIds)
    .eq("consent_flow", "standard")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load portal standard consents: ${error.message}`);
  }

  const latestByExpediente = new Map<string, (typeof data)[number]>();

  for (const row of data ?? []) {
    if (!latestByExpediente.has(row.expediente_id as string)) {
      latestByExpediente.set(row.expediente_id as string, row);
    }
  }

  const professionals = await getProfilesById([
    ...new Set(expedientes.map((expediente) => expediente.professional_id))
  ]);
  const professionalByExpediente = new Map(
    expedientes.map((expediente) => [expediente.id, expediente.professional_id])
  );

  return [...latestByExpediente.values()]
    .filter((row) => row.status === "pendiente")
    .map((row) => {
      const professionalId = professionalByExpediente.get(row.expediente_id as string) ?? "";

      return {
        id: row.id as string,
        expediente_id: row.expediente_id as string,
        status: row.status as "pendiente",
        title: (row.standard_document_title as string | null) ?? STANDARD_CONSENT_TITLE,
        version: (row.standard_document_version as string | null) ?? STANDARD_CONSENT_VERSION,
        sent_at: row.standard_sent_at as string | null,
        document_text: STANDARD_CONSENT_TEXT,
        professional: professionals.get(professionalId) ?? {
          full_name: "Profesional no disponible",
          email: ""
        }
      };
    });
}

async function getPortalConsentStatuses(
  expedientes: Array<{ id: string; professional_id: string }>
): Promise<PortalConsentStatus[]> {
  if (expedientes.length === 0) {
    return [];
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const expedienteIds = expedientes.map((expediente) => expediente.id);
  const { data, error } = await supabaseAdmin
    .from("consentimientos")
    .select(
      "id, expediente_id, status, standard_document_title, standard_document_version, signed_at, created_at"
    )
    .in("expediente_id", expedienteIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load portal consent statuses: ${error.message}`);
  }

  const latestByExpediente = new Map<string, (typeof data)[number]>();

  for (const row of data ?? []) {
    if (!latestByExpediente.has(row.expediente_id as string)) {
      latestByExpediente.set(row.expediente_id as string, row);
    }
  }

  const [professionals, { data: graceNotes, error: graceNotesError }] = await Promise.all([
    getProfilesById([...new Set(expedientes.map((expediente) => expediente.professional_id))]),
    supabaseAdmin
      .from("notas_clinicas")
      .select("expediente_id")
      .in("expediente_id", expedienteIds)
      .neq("note_type", "addendum")
      .neq("status", "anulada_logicamente")
  ]);

  if (graceNotesError) {
    throw new Error(`Unable to load portal consent grace status: ${graceNotesError.message}`);
  }

  const graceUsedExpedienteIds = new Set(
    (graceNotes ?? []).map((note) => note.expediente_id as string)
  );
  const professionalByExpediente = new Map(
    expedientes.map((expediente) => [expediente.id, expediente.professional_id])
  );

  return [...latestByExpediente.values()].map((row) => {
    const professionalId = professionalByExpediente.get(row.expediente_id as string) ?? "";

    return {
      expediente_id: row.expediente_id as string,
      status: row.status as PortalConsentStatus["status"],
      title: (row.standard_document_title as string | null) ?? STANDARD_CONSENT_TITLE,
      version: (row.standard_document_version as string | null) ?? STANDARD_CONSENT_VERSION,
      signed_at: row.signed_at as string | null,
      grace_session_used: graceUsedExpedienteIds.has(row.expediente_id as string),
      professional: professionals.get(professionalId) ?? {
        full_name: "Profesional no disponible",
        email: ""
      }
    };
  });
}

function getNotaTemplateText(values: NotaTemplateValues | null, fieldId: string) {
  for (const section of Object.values(values ?? {})) {
    const value = section[fieldId];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

async function getPortalRecommendations(expedienteIds: string[]): Promise<PortalRecommendation[]> {
  if (expedienteIds.length === 0) {
    return [];
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("notas_clinicas")
    .select("id, professional_id, session_date, note_template_values")
    .in("expediente_id", expedienteIds)
    .eq("status", "confirmada")
    .order("session_date", { ascending: false })
    .limit(6);

  if (error) {
    throw new Error(`Unable to load portal recommendations: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    professional_id: string;
    session_date: string | null;
    note_template_values: NotaTemplateValues | null;
  }>;
  const professionals = await getProfilesById([...new Set(rows.map((row) => row.professional_id))]);

  return rows
    .map((row) => ({
      id: row.id,
      session_date: row.session_date,
      topic: getNotaTemplateText(row.note_template_values, "follow_up_topic"),
      techniques: getNotaTemplateText(row.note_template_values, "follow_up_techniques"),
      homework:
        getNotaTemplateText(row.note_template_values, "follow_up_homework") ??
        getNotaTemplateText(row.note_template_values, "home_action_plan"),
      professional: professionals.get(row.professional_id) ?? {
        full_name: "Profesional no disponible",
        email: ""
      }
    }))
    .filter((row) => row.topic || row.techniques || row.homework);
}

async function getPortalProcessHistory(
  expedientes: Array<{
    id: string;
    professional_id: string;
    initial_consultation_reason: string | null;
  }>
): Promise<PortalProcessHistory[]> {
  if (expedientes.length === 0) {
    return [];
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const expedienteIds = expedientes.map((expediente) => expediente.id);
  const { data, error } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .select("id, expediente_id, professional_id, model_type, status, started_at, closed_at")
    .in("expediente_id", expedienteIds)
    .order("started_at", { ascending: false });

  if (error) {
    throw new Error(`Unable to load portal process history: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    expediente_id: string;
    professional_id: string;
    model_type: ProcessModelType;
    status: "activo" | "cerrado";
    started_at: string;
    closed_at: string | null;
  }>;
  const professionals = await getProfilesById([...new Set(rows.map((row) => row.professional_id))]);
  const expedienteById = new Map(expedientes.map((expediente) => [expediente.id, expediente]));

  return rows.map((row) => ({
    id: row.id,
    expediente_id: row.expediente_id,
    model_type: row.model_type,
    model_label: PROCESS_MODEL_LABEL[row.model_type] ?? row.model_type,
    status: row.status,
    started_at: row.started_at,
    closed_at: row.closed_at,
    consultation_reason: expedienteById.get(row.expediente_id)?.initial_consultation_reason ?? null,
    professional: professionals.get(row.professional_id) ?? {
      full_name: "Profesional no disponible",
      email: ""
    }
  }));
}

async function enrichSummary(
  summary: Omit<PatientPortalSummary, "professional"> | undefined
): Promise<PatientPortalSummary | null> {
  if (!summary) {
    return null;
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: expediente, error } = await supabaseAdmin
    .from("expedientes")
    .select("professional_id")
    .eq("id", summary.expediente_id)
    .single();

  if (error || !expediente) {
    return null;
  }

  const professionals = await getProfilesById([expediente.professional_id]);

  return {
    ...summary,
    professional: professionals.get(expediente.professional_id) ?? {
      full_name: "Profesional no disponible",
      email: ""
    }
  };
}

async function getPortalAppointmentRequests(patientId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("patient_appointment_requests")
    .select("id, appointment_id, request_type, status, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Unable to load appointment requests: ${error.message}`);
  }

  return (data ?? []) satisfies PortalAppointmentRequest[];
}

async function getPortalLifeHistory(patientId: string): Promise<PortalLifeHistory | null> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("patient_life_histories")
    .select("id, expediente_id, professional_id, status, answers, submitted_at, updated_at")
    .eq("patient_id", patientId)
    .in("status", ["borrador", "enviada", "reabierta"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const isExpiredDraft =
    data.status === "borrador" &&
    !data.submitted_at &&
    Date.now() - new Date(data.updated_at as string).getTime() > LIFE_HISTORY_DRAFT_TTL_MS;

  if (isExpiredDraft) {
    await supabaseAdmin
      .from("patient_life_histories")
      .delete()
      .eq("id", data.id as string)
      .eq("patient_id", patientId)
      .eq("status", "borrador");

    return null;
  }

  const professionals = await getProfilesById([data.professional_id as string]);

  return {
    id: data.id as string,
    expediente_id: data.expediente_id as string,
    status: data.status as PortalLifeHistory["status"],
    answers: (data.answers ?? {}) as Record<string, string | string[]>,
    submitted_at: data.submitted_at as string | null,
    updated_at: data.updated_at as string,
    professional: professionals.get(data.professional_id as string) ?? {
      full_name: "Profesional no disponible",
      email: ""
    }
  };
}

async function enrichAssessmentExpedientes(
  expedientes: Array<{ id: string; professional_id: string }>
): Promise<PortalAssessmentExpedienteOption[]> {
  const professionals = await getProfilesById([
    ...new Set(expedientes.map((expediente) => expediente.professional_id))
  ]);

  return expedientes.map((expediente) => ({
    id: expediente.id,
    professional: professionals.get(expediente.professional_id) ?? {
      full_name: "Profesional no disponible",
      email: ""
    }
  }));
}

async function getPortalAssessmentUploads(patientId: string): Promise<PortalAssessmentUpload[]> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("patient_assessment_uploads")
    .select("id, expediente_id, assessment_label, file_name, status, created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(`Unable to load patient assessment uploads: ${error.message}`);
  }

  return (data ?? []) as PortalAssessmentUpload[];
}

async function getPortalAssessmentRequests(patientId: string): Promise<PortalAssessmentRequest[]> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("patient_assessment_requests")
    .select("id, expediente_id, assessment_label, status, requested_at")
    .eq("patient_id", patientId)
    .in("status", ["pendiente", "subida"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Unable to load patient assessment requests: ${error.message}`);
  }

  return (data ?? []) as PortalAssessmentRequest[];
}
