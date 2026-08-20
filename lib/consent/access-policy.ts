import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const VALID_CONSENT_STATUSES = new Set([
  "firmado_fisico",
  "firmado_digital",
  "excepcion_justificada"
]);

export type ConsentAccessPolicy = {
  expedienteId: string;
  consentStatus: string;
  hasValidConsent: boolean;
  appointmentCount: number;
  clinicalNoteCount: number;
  graceSessionUsed: boolean;
  canScheduleAppointment: boolean;
  canCreateClinicalNote: boolean;
  canAdvanceClinicalWork: boolean;
};

export async function getConsentAccessPolicy(expedienteId: string): Promise<ConsentAccessPolicy | null> {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: expediente, error } = await supabaseAdmin
    .from("expedientes")
    .select("id, patient_id, professional_id, consent_status, status")
    .eq("id", expedienteId)
    .maybeSingle();

  if (error || !expediente || expediente.status !== "activo") return null;

  const [{ count: appointmentCount, error: appointmentError }, { count: noteCount, error: noteError }] =
    await Promise.all([
      supabaseAdmin
        .from("citas")
        .select("id", { count: "exact", head: true })
        .eq("patient_id", expediente.patient_id)
        .eq("professional_id", expediente.professional_id)
        .neq("status", "cancelada"),
      supabaseAdmin
        .from("notas_clinicas")
        .select("id", { count: "exact", head: true })
        .eq("expediente_id", expediente.id)
        .neq("note_type", "addendum")
        .neq("status", "anulada_logicamente")
    ]);

  if (appointmentError || noteError) throw new Error("Unable to evaluate consent access policy.");

  const appointments = appointmentCount ?? 0;
  const notes = noteCount ?? 0;
  const hasValidConsent = VALID_CONSENT_STATUSES.has(expediente.consent_status);
  const graceSessionUsed = notes > 0;

  return {
    expedienteId: expediente.id,
    consentStatus: expediente.consent_status,
    hasValidConsent,
    appointmentCount: appointments,
    clinicalNoteCount: notes,
    graceSessionUsed,
    canScheduleAppointment: hasValidConsent || (appointments === 0 && notes === 0),
    canCreateClinicalNote: hasValidConsent || notes === 0,
    canAdvanceClinicalWork: hasValidConsent || notes === 0
  };
}

export function consentRequiredMessage() {
  return "La sesion de gracia ya fue utilizada. Se requiere consentimiento informado firmado o excepcion justificada para continuar.";
}

