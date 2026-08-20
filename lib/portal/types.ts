export const APPOINTMENT_REQUEST_TYPES = ["cancelacion", "reprogramacion"] as const;
export type AppointmentRequestType = (typeof APPOINTMENT_REQUEST_TYPES)[number];

export type PatientPortalSummary = {
  expediente_id: string;
  content: string;
  source: "manual" | "ia_asistida";
  published_at: string | null;
  professional: {
    full_name: string;
    email: string;
  };
};

export type PortalAppointment = {
  id: string;
  professional_id: string;
  scheduled_at: string;
  duration_minutes: number;
  type: "presencial" | "videollamada";
  status: "programada" | "completada" | "cancelada";
  cancellation_reason: string | null;
  has_zoom_link: boolean;
  can_join_zoom: boolean;
  can_request_change: boolean;
  can_review: boolean;
  has_review: boolean;
  professional: {
    full_name: string;
    email: string;
  };
};

export type PortalProcessHistory = {
  id: string;
  expediente_id: string;
  model_type: string;
  model_label: string;
  status: "activo" | "cerrado";
  started_at: string;
  closed_at: string | null;
  consultation_reason: string | null;
  professional: {
    full_name: string;
    email: string;
  };
};

export type PortalRecommendation = {
  id: string;
  session_date: string | null;
  topic: string | null;
  techniques: string | null;
  homework: string | null;
  professional: {
    full_name: string;
    email: string;
  };
};

export type PortalAppointmentRequest = {
  id: string;
  appointment_id: string;
  request_type: AppointmentRequestType;
  status: "recibida" | "revisada" | "resuelta" | "rechazada";
  created_at: string;
};

export type PortalLifeHistory = {
  id: string;
  expediente_id: string;
  status: "borrador" | "enviada" | "reabierta";
  answers: Record<string, string | string[]>;
  submitted_at: string | null;
  updated_at: string;
  professional: {
    full_name: string;
    email: string;
  };
};

export type PortalStandardConsent = {
  id: string;
  expediente_id: string;
  status: "pendiente" | "firmado_digital";
  title: string;
  version: string;
  sent_at: string | null;
  document_text: Array<{
    title: string;
    body: string;
  }>;
  professional: {
    full_name: string;
    email: string;
  };
};

export type PortalConsentStatus = {
  expediente_id: string;
  status: "pendiente" | "firmado_fisico" | "firmado_digital" | "excepcion_justificada";
  title: string;
  version: string;
  signed_at: string | null;
  grace_session_used: boolean;
  professional: {
    full_name: string;
    email: string;
  };
};

export type PortalCatholizareLink = {
  title: string;
  description: string;
  href: string;
  category: "recurso" | "evento" | "proceso" | "test" | "podcast";
};

export type PortalResourcePreferences = {
  selected_topics: import("@/lib/portal/resource-recommendations").PortalResourceTopic[];
  recommendations: import("@/lib/portal/resource-recommendations").PortalBlogRecommendation[];
};

export type PortalAssessmentExpedienteOption = {
  id: string;
  professional: {
    full_name: string;
    email: string;
  };
};

export type PortalAssessmentUpload = {
  id: string;
  expediente_id: string;
  assessment_label: string;
  file_name: string;
  status: "recibida" | "analizada" | "vinculada" | "rechazada";
  created_at: string;
};

export type PortalAssessmentRequest = {
  id: string;
  expediente_id: string;
  assessment_label: string;
  status: "pendiente" | "subida" | "cancelada";
  requested_at: string;
};

export type PortalDashboard = {
  summary: PatientPortalSummary | null;
  upcomingAppointments: PortalAppointment[];
  pastAppointments: PortalAppointment[];
  requests: PortalAppointmentRequest[];
  standardConsents: PortalStandardConsent[];
  consentStatuses: PortalConsentStatus[];
  lifeHistory: PortalLifeHistory | null;
  recommendations: PortalRecommendation[];
  resourcePreferences: PortalResourcePreferences;
  processHistory: PortalProcessHistory[];
  catholizareLinks: PortalCatholizareLink[];
  assessmentExpedientes: PortalAssessmentExpedienteOption[];
  assessmentRequests: PortalAssessmentRequest[];
  assessmentUploads: PortalAssessmentUpload[];
  announcements: import("@/lib/pro/types").PatientAnnouncementsDashboard;
};
