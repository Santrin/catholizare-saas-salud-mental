import type { UserRole } from "@/lib/auth/types";

export type SupportConversationStatus = "abierto" | "resuelto" | "cerrado";
export type SupportMessageKind = "mensaje" | "recordatorio" | "sistema";

export type SupportMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  kind: SupportMessageKind;
  body: string;
  created_at: string;
};

export type SupportConversation = {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_email: string;
  participant_role: "paciente" | "profesional";
  assigned_admin_id: string | null;
  subject: string;
  status: SupportConversationStatus;
  created_at: string;
  updated_at: string;
  messages: SupportMessage[];
};

export type SupportPersonOption = {
  id: string;
  label: string;
  email: string;
  role: "paciente" | "profesional";
};

export type SupportAppointmentOption = {
  id: string;
  patient_name: string;
  professional_name: string;
  scheduled_at: string;
  status: string;
};

export type SupportCenterDashboard = {
  conversations: SupportConversation[];
  patients: SupportPersonOption[];
  professionals: SupportPersonOption[];
  appointments: SupportAppointmentOption[];
};

