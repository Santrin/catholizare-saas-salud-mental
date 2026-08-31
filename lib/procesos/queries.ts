import "server-only";

import { notFound } from "next/navigation";

import type { AuthProfile } from "@/lib/auth/types";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ProcessModelType,
  ProcessTemplate,
  ProcesoDetail,
  ProcesoListItem,
  ProcesoTerapeutico
} from "@/lib/procesos/types";

const PROCESO_SELECT =
  "id, expediente_id, patient_id, professional_id, model_type, template_id, template_version, template_snapshot, status, started_at, closed_at, closed_by_note_id, step_data, gpt_instructions, linked_note_ids, linked_assessment_ids, created_by_user_id, created_at, updated_at, reconceptualization_interval, last_reconceptualized_session_count, ai_conceptualization_enabled, ai_next_block_plan_enabled";

const TEMPLATE_SELECT =
  "id, professional_id, model_type, version, steps, created_by_user_id, created_at";

async function getPatientsById(patientIds: string[]) {
  if (patientIds.length === 0) {
    return new Map<string, ProcesoListItem["patient"]>();
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", patientIds);

  if (error) {
    throw new Error(`Unable to load process patients: ${error.message}`);
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

export async function getLatestProcessTemplate(
  profile: AuthProfile,
  modelType: ProcessModelType = "general"
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("plantillas_proceso")
    .select(TEMPLATE_SELECT)
    .eq("professional_id", profile.id)
    .eq("model_type", modelType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load process template: ${error.message}`);
  }

  return (data as ProcessTemplate | null) ?? null;
}

export const getLatestGeneralTemplate = getLatestProcessTemplate;

export async function getProcesosForProfessional(profile: AuthProfile) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .select("id, expediente_id, patient_id, model_type, status, started_at, closed_at, updated_at")
    .eq("professional_id", profile.id)
    .order("updated_at", { ascending: false });

  if (error) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "proceso_read",
      entityType: "procesos_terapeuticos",
      result: "error",
      metadata: {
        scope: "list"
      },
      context: "audit_proceso_list_error"
    });

    throw new Error(`Unable to load therapeutic processes: ${error.message}`);
  }

  const rows = (data ?? []) as Array<Omit<ProcesoListItem, "patient">>;
  const patients = await getPatientsById([...new Set(rows.map((row) => row.patient_id))]);

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "proceso_read",
    entityType: "procesos_terapeuticos",
    result: "success",
    metadata: {
      scope: "list",
      count: rows.length
    },
    context: "audit_proceso_list_read"
  });

  return rows.map((row) => ({
    ...row,
    patient: patients.get(row.patient_id) ?? {
      full_name: "Paciente no disponible",
      email: ""
    }
  })) satisfies ProcesoListItem[];
}

export async function getExpedientesForProcessStart(profile: AuthProfile) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("expedientes")
    .select("id, patient_id, status")
    .eq("professional_id", profile.id)
    .eq("status", "activo")
    .order("last_clinical_activity_at", { ascending: false });

  if (error) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "proceso_read",
      entityType: "expedientes",
      result: "error",
      metadata: {
        scope: "process_start_selector"
      },
      context: "audit_proceso_start_expediente_selector_error"
    });

    throw new Error(`Unable to load expedientes for process start: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    patient_id: string;
    status: string;
  }>;
  const patients = await getPatientsById([...new Set(rows.map((row) => row.patient_id))]);

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    patient: patients.get(row.patient_id) ?? {
      full_name: "Paciente no disponible",
      email: ""
    }
  }));
}

export async function getProcesoForExpediente(profile: AuthProfile, expedienteId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .select(PROCESO_SELECT)
    .eq("professional_id", profile.id)
    .eq("expediente_id", expedienteId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load expediente process: ${error.message}`);
  }

  return (data as ProcesoTerapeutico | null) ?? null;
}

export async function getProcesoDetail(profile: AuthProfile, processId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .select(PROCESO_SELECT)
    .eq("id", processId)
    .eq("professional_id", profile.id)
    .single();

  if (error || !data) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "proceso_read",
      entityType: "procesos_terapeuticos",
      entityId: processId,
      result: "denied",
      context: "audit_proceso_detail_denied"
    });

    notFound();
  }

  const process = data as ProcesoTerapeutico;
  const patients = await getPatientsById([process.patient_id]);

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "proceso_read",
    entityType: "procesos_terapeuticos",
    entityId: process.id,
    result: "success",
    metadata: {
      scope: "detail"
    },
    context: "audit_proceso_detail_read"
  });

  return {
    ...process,
    patient: patients.get(process.patient_id) ?? {
      full_name: "Paciente no disponible",
      email: ""
    }
  } satisfies ProcesoDetail;
}

export async function getUsedProcessModelTypes(profile: AuthProfile) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .select("model_type")
    .eq("professional_id", profile.id);

  if (error) {
    throw new Error(`Unable to load used process model types: ${error.message}`);
  }

  return [...new Set((data ?? []).map((row) => row.model_type as ProcessModelType))];
}

export async function getProcessConfirmedSessionCount(profile: AuthProfile, processId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { count, error } = await supabaseAdmin
    .from("notas_clinicas")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", profile.id)
    .eq("process_id", processId)
    .in("status", ["confirmada", "con_addendum", "exportada"])
    .neq("note_type", "addendum");

  if (error) {
    throw new Error(`Unable to load process confirmed session count: ${error.message}`);
  }

  return count ?? 0;
}
