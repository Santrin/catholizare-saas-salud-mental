import "server-only";

import { notFound } from "next/navigation";
import type { AuthProfile } from "@/lib/auth/types";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  NotaTemplate,
  NotaTemplateModelType,
  NotaClinica,
  NotaClinicaExportData,
  NotaClinicaFilters,
  NotaClinicaListItem,
  NotaClinicaSummary,
  ExpedienteNotaMetric
} from "@/lib/notas/types";

const NOTA_SELECT = "*";
const NOTA_SUMMARY_SELECT =
  "id, expediente_id, note_type, status, session_date, clinical_summary, created_at, confirmed_at, addendum_to_note_id";
const NOTA_METRIC_SELECT =
  "id, note_type, status, session_date, mood_review, tcc_session_number, note_template_values";
const NOTA_TEMPLATE_SELECT =
  "id, professional_id, model_type, name, version, sections, created_by_user_id, created_at, archived_at, archived_by_user_id";

export async function getLatestNotaTemplate(
  profile: AuthProfile,
  modelType: NotaTemplateModelType = "general"
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("plantillas_nota_clinica")
    .select(NOTA_TEMPLATE_SELECT)
    .eq("professional_id", profile.id)
    .eq("model_type", modelType)
    .is("archived_at", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_template_read",
      entityType: "plantillas_nota_clinica",
      result: "error",
      metadata: {
        model_type: modelType
      },
      context: "audit_nota_template_read_error"
    });

    throw new Error(`Unable to load clinical note template: ${error.message}`);
  }

  return (data as NotaTemplate | null) ?? null;
}

export async function getNotaTemplateVersions(
  profile: AuthProfile,
  modelType: NotaTemplateModelType
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("plantillas_nota_clinica")
    .select(NOTA_TEMPLATE_SELECT)
    .eq("professional_id", profile.id)
    .eq("model_type", modelType)
    .is("archived_at", null)
    .order("version", { ascending: false });

  if (error) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_template_read",
      entityType: "plantillas_nota_clinica",
      result: "error",
      metadata: {
        model_type: modelType,
        scope: "versions"
      },
      context: "audit_nota_template_versions_read_error"
    });

    throw new Error(`Unable to load clinical note template versions: ${error.message}`);
  }

  return (data ?? []) as NotaTemplate[];
}

export async function getLatestNotaTemplates(profile: AuthProfile) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("plantillas_nota_clinica")
    .select(NOTA_TEMPLATE_SELECT)
    .eq("professional_id", profile.id)
    .is("archived_at", null)
    .order("model_type", { ascending: true })
    .order("version", { ascending: false });

  if (error) {
    throw new Error(`Unable to load latest note templates: ${error.message}`);
  }

  const latestByModel = new Map<string, NotaTemplate>();
  for (const template of (data ?? []) as NotaTemplate[]) {
    if (!latestByModel.has(template.model_type)) {
      latestByModel.set(template.model_type, template);
    }
  }

  return latestByModel;
}

async function getPatientsById(patientIds: string[]) {
  if (patientIds.length === 0) {
    return new Map<string, NotaClinicaListItem["patient"]>();
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", patientIds);

  if (error) {
    throw new Error(`Unable to load clinical note patients: ${error.message}`);
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

export async function getNotasForExpediente(profile: AuthProfile, expedienteId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: expediente, error: expedienteError } = await supabaseAdmin
    .from("expedientes")
    .select("id")
    .eq("id", expedienteId)
    .eq("professional_id", profile.id)
    .single();

  if (expedienteError || !expediente) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_clinica_read",
      entityType: "notas_clinicas",
      entityId: expedienteId,
      result: "denied",
      metadata: {
        scope: "expediente_list"
      },
      context: "audit_nota_clinica_list_denied"
    });

    notFound();
  }

  const { data, error } = await supabaseAdmin
    .from("notas_clinicas")
    .select(NOTA_SUMMARY_SELECT)
    .eq("expediente_id", expedienteId)
    .eq("professional_id", profile.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_clinica_read",
      entityType: "notas_clinicas",
      entityId: expedienteId,
      result: "error",
      metadata: {
        scope: "expediente_list"
      },
      context: "audit_nota_clinica_list_error"
    });

    throw new Error(`Unable to load clinical notes: ${error.message}`);
  }

  const rows = (data ?? []) as NotaClinicaSummary[];

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "nota_clinica_read",
    entityType: "notas_clinicas",
    entityId: expedienteId,
    result: "success",
    metadata: {
      scope: "expediente_list",
      count: rows.length
    },
    context: "audit_nota_clinica_list_read"
  });

  return rows;
}

export async function getNotaMetricsForExpediente(profile: AuthProfile, expedienteId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: expediente, error: expedienteError } = await supabaseAdmin
    .from("expedientes")
    .select("id")
    .eq("id", expedienteId)
    .eq("professional_id", profile.id)
    .single();

  if (expedienteError || !expediente) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_clinica_read",
      entityType: "notas_clinicas",
      entityId: expedienteId,
      result: "denied",
      metadata: {
        scope: "expediente_metrics"
      },
      context: "audit_nota_clinica_metrics_denied"
    });

    notFound();
  }

  const { data, error } = await supabaseAdmin
    .from("notas_clinicas")
    .select(NOTA_METRIC_SELECT)
    .eq("expediente_id", expedienteId)
    .eq("professional_id", profile.id)
    .neq("status", "anulada_logicamente")
    .order("session_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_clinica_read",
      entityType: "notas_clinicas",
      entityId: expedienteId,
      result: "error",
      metadata: {
        scope: "expediente_metrics"
      },
      context: "audit_nota_clinica_metrics_error"
    });

    throw new Error(`Unable to load clinical note metrics: ${error.message}`);
  }

  return (data ?? []) as ExpedienteNotaMetric[];
}

export async function getNotaClinicaDetail(profile: AuthProfile, noteId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("notas_clinicas")
    .select(NOTA_SELECT)
    .eq("id", noteId)
    .eq("professional_id", profile.id)
    .single();

  if (error || !data) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_clinica_read",
      entityType: "notas_clinicas",
      entityId: noteId,
      result: "denied",
      metadata: {
        scope: "detail"
      },
      context: "audit_nota_clinica_detail_denied"
    });

    notFound();
  }

  const note = data as NotaClinica;

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "nota_clinica_read",
    entityType: "notas_clinicas",
    entityId: note.id,
    result: "success",
    metadata: {
      expediente_id: note.expediente_id,
      scope: "detail"
    },
    context: "audit_nota_clinica_detail_read"
  });

  return note;
}

export async function getNotaClinicaExportData(profile: AuthProfile, noteId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("notas_clinicas")
    .select(NOTA_SELECT)
    .eq("id", noteId)
    .eq("professional_id", profile.id)
    .single();

  if (error || !data) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_clinica_export",
      entityType: "notas_clinicas",
      entityId: noteId,
      result: "denied",
      context: "audit_nota_clinica_export_denied"
    });

    notFound();
  }

  const note = data as NotaClinica;

  if (!["confirmada", "con_addendum", "exportada"].includes(note.status)) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_clinica_export",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      metadata: {
        current_status: note.status
      },
      context: "audit_nota_clinica_export_denied_status"
    });

    notFound();
  }

  const { data: patient } = await supabaseAdmin
    .from("profiles")
    .select("full_name, email")
    .eq("id", note.patient_id)
    .single();

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "nota_clinica_export",
    entityType: "notas_clinicas",
    entityId: note.id,
    result: "success",
    metadata: {
      expediente_id: note.expediente_id,
      source: "print_view"
    },
    context: "audit_nota_clinica_export_print_view"
  });

  return {
    note,
    patient: patient ?? {
      full_name: "Paciente no disponible",
      email: ""
    },
    professional: {
      full_name: profile.full_name,
      email: profile.email
    }
  } satisfies NotaClinicaExportData;
}

export async function getNotasForProfessional(
  profile: AuthProfile,
  filters: NotaClinicaFilters = {}
) {
  const supabaseAdmin = createSupabaseAdminClient();
  let query = supabaseAdmin
    .from("notas_clinicas")
    .select(`${NOTA_SUMMARY_SELECT}, patient_id`)
    .eq("professional_id", profile.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.patientId) {
    query = query.eq("patient_id", filters.patientId);
  }

  if (filters.noteType) {
    query = query.eq("note_type", filters.noteType);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.dateFrom) {
    query = query.gte("session_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("session_date", filters.dateTo);
  }

  if (filters.query) {
    const sanitizedQuery = filters.query
      .replace(/[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñÜü\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (sanitizedQuery.length > 0) {
      query = query.or(
        `content.ilike.%${sanitizedQuery}%,clinical_summary.ilike.%${sanitizedQuery}%`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    await safeWriteAuditLog({
      userId: profile.id,
      role: profile.role,
      action: "nota_clinica_read",
      entityType: "notas_clinicas",
      result: "error",
      metadata: {
        scope: "professional_list"
      },
      context: "audit_nota_clinica_professional_list_error"
    });

    throw new Error(`Unable to load clinical notes: ${error.message}`);
  }

  const rows = (data ?? []) as Array<NotaClinicaSummary & { patient_id: string }>;
  const patients = await getPatientsById([...new Set(rows.map((row) => row.patient_id))]);

  await safeWriteAuditLog({
    userId: profile.id,
    role: profile.role,
    action: "nota_clinica_read",
    entityType: "notas_clinicas",
    result: "success",
    metadata: {
      scope: "professional_list",
      count: rows.length
    },
    context: "audit_nota_clinica_professional_list_read"
  });

  return rows.map((row) => ({
    id: row.id,
    expediente_id: row.expediente_id,
    note_type: row.note_type,
    status: row.status,
    session_date: row.session_date,
    clinical_summary: row.clinical_summary,
    created_at: row.created_at,
    confirmed_at: row.confirmed_at,
    addendum_to_note_id: row.addendum_to_note_id,
    patient: patients.get(row.patient_id) ?? {
      full_name: "Paciente no disponible",
      email: ""
    }
  })) satisfies NotaClinicaListItem[];
}
