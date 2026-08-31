import {
  PROCESS_MODEL_LABEL,
  PROCESS_MODEL_TYPES,
  type ProcessModelType
} from "@/lib/procesos/types";

export const NOTA_CLINICA_TYPES = [
  "sesion",
  "interconsulta",
  "referencia_traslado",
  "egreso"
] as const;

export const LEGACY_NOTA_CLINICA_TYPES = [
  "admision",
  "evolucion",
  "addendum"
] as const;
export type NotaClinicaType =
  | (typeof NOTA_CLINICA_TYPES)[number]
  | (typeof LEGACY_NOTA_CLINICA_TYPES)[number];

export const NOTA_TEMPLATE_MODEL_TYPES = PROCESS_MODEL_TYPES;
export type NotaTemplateModelType = ProcessModelType;
export const NOTA_TEMPLATE_MODEL_LABEL: Record<NotaTemplateModelType, string> = PROCESS_MODEL_LABEL;

export const NOTA_TEMPLATE_FIELD_TYPES = [
  "text",
  "textarea",
  "select",
  "date",
  "time",
  "number",
  "checkbox"
] as const;
export type NotaTemplateFieldType = (typeof NOTA_TEMPLATE_FIELD_TYPES)[number];

export type NotaTemplateField = {
  id: string;
  label: string;
  type: NotaTemplateFieldType;
  required?: boolean;
  options?: string[];
};

export type NotaTemplateSection = {
  id: string;
  title: string;
  description?: string;
  fields: NotaTemplateField[];
};

export type NotaTemplate = {
  id: string;
  professional_id: string;
  model_type: NotaTemplateModelType;
  name: string;
  version: number;
  sections: NotaTemplateSection[];
  created_by_user_id: string | null;
  created_at: string;
  archived_at: string | null;
  archived_by_user_id: string | null;
};

export const NOTA_CLINICA_STATUSES = [
  "borrador",
  "confirmada",
  "con_addendum",
  "anulada_logicamente",
  "exportada"
] as const;
export type NotaClinicaStatus = (typeof NOTA_CLINICA_STATUSES)[number];

export type NotaClinica = {
  id: string;
  expediente_id: string;
  patient_id: string;
  professional_id: string;
  appointment_id: string | null;
  process_id: string | null;
  tcc_process_id: string | null;
  tcc_session_plan_item_id: string | null;
  tcc_session_number: number | null;
  tcc_phase: string | null;
  session_time: string | null;
  note_template_id: string | null;
  note_template_version: number | null;
  note_template_snapshot: {
    sections: NotaTemplateSection[];
  } | null;
  note_template_values: Record<string, Record<string, string | number | boolean | null>> | null;
  note_type: NotaClinicaType;
  status: NotaClinicaStatus;
  session_date: string;
  content: string;
  clinical_summary: string | null;
  interventions: string | null;
  patient_response: string | null;
  plan_next_session: string | null;
  risk_flags: string | null;
  homework_or_tasks: string | null;
  mood_score: number | null;
  anxiety_score: number | null;
  hope_score: number | null;
  objective_scores: string | null;
  patient_plan: string | null;
  therapist_objectives: string | null;
  mood_review: string | null;
  previous_session_bridge: string | null;
  session_agenda: string | null;
  action_plan_review: string | null;
  key_session_points: string | null;
  session_summary_feedback: string | null;
  home_action_plan: string | null;
  patient_feedback: string | null;
  observations: string | null;
  next_session_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  confirmed_by_user_id: string | null;
  confirmed_at: string | null;
  addendum_to_note_id: string | null;
  correction_reason: string | null;
  annulment_reason: string | null;
  annulled_at: string | null;
  annulled_by_user_id: string | null;
  pdf_file_id: string | null;
  exported_at: string | null;
  ai_used: boolean;
  ai_session_id: string | null;
};

export type NotaClinicaSummary = Pick<
  NotaClinica,
  | "id"
  | "expediente_id"
  | "note_type"
  | "status"
  | "session_date"
  | "clinical_summary"
  | "created_at"
  | "confirmed_at"
  | "addendum_to_note_id"
>;

export type NotaClinicaListItem = NotaClinicaSummary & {
  patient: {
    full_name: string;
    email: string;
  };
};

export type ExpedienteNotaMetric = Pick<
  NotaClinica,
  | "id"
  | "note_type"
  | "status"
  | "session_date"
  | "mood_review"
  | "tcc_session_number"
  | "note_template_values"
>;

export type NotaClinicaExportData = {
  note: NotaClinica;
  patient: {
    full_name: string;
    email: string;
  };
  professional: {
    full_name: string;
    email: string;
  };
};

export type NotaClinicaFilters = {
  patientId?: string;
  noteType?: NotaClinicaType;
  status?: NotaClinicaStatus;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
};

export const DEFAULT_NOTA_TEMPLATE_SECTIONS: NotaTemplateSection[] = [
  {
    id: "datos_sesion",
    title: "Nota de sesion",
    fields: [
      { id: "tcc_session_number", label: "Numero de sesion:", type: "number" },
      { id: "session_date", label: "Fecha:", type: "date", required: true },
      { id: "session_time", label: "Hora:", type: "time" }
    ]
  },
  {
    id: "informacion_guia",
    title: "Informacion guia",
    fields: [
      { id: "objective_scores", label: "Puntajes objetivos:", type: "textarea" },
      { id: "patient_plan", label: "Plan del paciente:", type: "textarea" },
      { id: "therapist_objectives", label: "Objetivos del terapeuta:", type: "textarea" }
    ]
  },
  {
    id: "fase_inicial",
    title: "Fase inicial de sesion 10 min.",
    fields: [
      { id: "mood_review", label: "1. Revision del estado de animo (-5 a +5):", type: "number" },
      { id: "previous_session_bridge", label: "2. Puente con la sesion anterior:", type: "textarea" },
      { id: "session_agenda", label: "3. Establecer la agenda de la sesion:", type: "textarea" },
      { id: "action_plan_review", label: "4. Revision de la tarea o plan de accion:", type: "textarea" }
    ]
  },
  {
    id: "fase_media",
    title: "Fase media de la sesion 30 min.",
    fields: [
      { id: "key_session_points", label: "5. Puntos importantes de la sesion:", type: "textarea", required: true }
    ]
  },
  {
    id: "fase_final",
    title: "Fase final de la sesion 15 min.",
    fields: [
      {
        id: "session_summary_feedback",
        label: "6. Resumen general de la sesion y retroalimentacion del terapeuta al paciente:",
        type: "textarea"
      },
      {
        id: "home_action_plan",
        label: "7. Asignacion de tareas para el hogar o plan de accion:",
        type: "textarea"
      },
      { id: "patient_feedback", label: "8. Retroalimentacion del paciente:", type: "textarea" }
    ]
  },
  {
    id: "seguimiento",
    title: "Observaciones",
    fields: [
      { id: "observations", label: "Observaciones:", type: "textarea" },
      { id: "follow_up_topic", label: "Plan de seguimiento - tema a tratar:", type: "textarea" },
      { id: "follow_up_techniques", label: "Plan de seguimiento - tecnicas a usar:", type: "textarea" },
      { id: "follow_up_homework", label: "Plan de seguimiento - tarea a dejar:", type: "textarea" },
      { id: "next_session_at", label: "Proxima sesion:", type: "date" },
      { id: "risk_flags", label: "Riesgos o alertas:", type: "textarea" }
    ]
  }
];
