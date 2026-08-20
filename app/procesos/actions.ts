"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/profile";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import { consentRequiredMessage, getConsentAccessPolicy } from "@/lib/consent/access-policy";
import {
  PROCESS_FIELD_TYPES,
  PROCESS_MODEL_TYPES,
  PROCESS_MODEL_LABEL,
  PROCESS_DEFAULT_TEMPLATE_STEPS,
  type ProcessModelType,
  type ProcessTemplateStep,
  type ProcesoTerapeutico
} from "@/lib/procesos/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type ProcesoActionState = {
  message?: string;
  ok?: boolean;
};

type ExpedienteAccess = {
  id: string;
  patient_id: string;
  professional_id: string;
  status: string;
};

const fieldSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(PROCESS_FIELD_TYPES),
  options: z.array(z.string().trim().min(1)).optional()
});

const stepSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  fields: z.array(fieldSchema).min(1)
});

const templateStepsSchema = z
  .array(stepSchema)
  .min(1)
  .superRefine((steps, context) => {
    const stepIds = new Set<string>();

    steps.forEach((step, stepIndex) => {
      if (stepIds.has(step.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Los IDs de pasos deben ser unicos.",
          path: [stepIndex, "id"]
        });
      }

      stepIds.add(step.id);

      const fieldIds = new Set<string>();
      step.fields.forEach((field, fieldIndex) => {
        if (fieldIds.has(field.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Los IDs de campos deben ser unicos dentro del paso.",
            path: [stepIndex, "fields", fieldIndex, "id"]
          });
        }

        if (field.type === "select" && (!field.options || field.options.length === 0)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Los campos de seleccion requieren opciones.",
            path: [stepIndex, "fields", fieldIndex, "options"]
          });
        }

        fieldIds.add(field.id);
      });
    });
  });

const templateSchema = z.object({
  modelType: z.enum(PROCESS_MODEL_TYPES),
  stepsJson: z.string().trim().min(2)
});

const startProcessSchema = z.object({
  expedienteId: z.string().uuid(),
  modelType: z.enum(PROCESS_MODEL_TYPES).default("general")
});

const updateStepSchema = z.object({
  processId: z.string().uuid(),
  stepId: z.string().trim().min(1),
  gptInstructions: z.string().trim().optional(),
  completed: z.boolean()
});

const linkNoteSchema = z.object({
  processId: z.string().uuid(),
  noteId: z.string().uuid()
});

const closeProcessSchema = z.object({
  processId: z.string().uuid(),
  closureNoteId: z.string().uuid()
});

async function getActiveProfessional() {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "profesional" || profile.account_status !== "activo") {
    return null;
  }

  return profile;
}

async function assertExpedienteOwner(expedienteId: string, professionalId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("expedientes")
    .select("id, patient_id, professional_id, status")
    .eq("id", expedienteId)
    .eq("professional_id", professionalId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ExpedienteAccess;
}

async function assertProcessOwner(processId: string, professionalId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .select("*")
    .eq("id", processId)
    .eq("professional_id", professionalId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ProcesoTerapeutico;
}

function parseTemplateSteps(raw: string) {
  try {
    return templateStepsSchema.safeParse(JSON.parse(raw));
  } catch {
    return templateStepsSchema.safeParse(null);
  }
}

function normalizeStepValues(formData: FormData, step: ProcessTemplateStep) {
  const values: Record<string, string | number | boolean | null> = {
    completed: formData.get("completed") === "on"
  };

  for (const field of step.fields) {
    const rawValue = formData.get(`field_${field.id}`);
    const value = typeof rawValue === "string" ? rawValue.trim().slice(0, 10000) : "";

    if (field.type === "checkbox") {
      values[field.id] = rawValue === "on";
    } else if (field.type === "number") {
      const numericValue = Number(value);
      values[field.id] = value === "" || !Number.isFinite(numericValue) ? null : numericValue;
    } else {
      values[field.id] = value.length > 0 ? value : null;
    }
  }

  return values;
}

async function getOrCreateLatestTemplate(professionalId: string, modelType: ProcessModelType) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: latestTemplate, error: latestError } = await supabaseAdmin
    .from("plantillas_proceso")
    .select("id, version, steps")
    .eq("professional_id", professionalId)
    .eq("model_type", modelType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw latestError;
  }

  if (latestTemplate) {
    return latestTemplate as {
      id: string;
      version: number;
      steps: ProcessTemplateStep[];
    };
  }

  const { data: createdTemplate, error: createError } = await supabaseAdmin
    .from("plantillas_proceso")
    .insert({
      professional_id: professionalId,
      model_type: modelType,
      version: 1,
      steps: PROCESS_DEFAULT_TEMPLATE_STEPS[modelType],
      created_by_user_id: professionalId
    })
    .select("id, version, steps")
    .single();

  if (createError || !createdTemplate) {
    throw createError ?? new Error("Default process template insert did not return a row");
  }

  return createdTemplate as {
    id: string;
    version: number;
    steps: ProcessTemplateStep[];
  };
}

async function getProcessTemplateSnapshot(professionalId: string, modelType: ProcessModelType) {
  return getOrCreateLatestTemplate(professionalId, modelType);
}

export async function saveProcessTemplateAction(
  _previousState: ProcesoActionState,
  formData: FormData
): Promise<ProcesoActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = templateSchema.safeParse({
    modelType: formData.get("modelType"),
    stepsJson: formData.get("stepsJson")
  });

  if (!parsed.success) {
    return { message: "Define la plantilla en formato JSON.", ok: false };
  }

  const steps = parseTemplateSteps(parsed.data.stepsJson);

  if (!steps.success) {
    return {
      message: steps.error.issues[0]?.message ?? "La estructura de pasos no es valida.",
      ok: false
    };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: latestTemplate } = await supabaseAdmin
    .from("plantillas_proceso")
    .select("version")
    .eq("professional_id", actor.id)
    .eq("model_type", parsed.data.modelType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Number(latestTemplate?.version ?? 0) + 1;
  const { error } = await supabaseAdmin.from("plantillas_proceso").insert({
    professional_id: actor.id,
    model_type: parsed.data.modelType,
    version: nextVersion,
    steps: steps.data,
    created_by_user_id: actor.id
  });

  if (error) {
    Sentry.captureException(error, {
      extra: {
        professional_id: actor.id,
        model_type: parsed.data.modelType,
        version: nextVersion
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_template_update",
      entityType: "plantillas_proceso",
      result: "error",
      context: "audit_proceso_template_update_error"
    });

    return {
      message:
        error.code === "23505"
          ? "La plantilla cambio mientras guardabas. Recarga e intenta de nuevo."
          : "No fue posible guardar la plantilla.",
      ok: false
    };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "proceso_template_update",
    entityType: "plantillas_proceso",
    result: "success",
      metadata: {
        model_type: parsed.data.modelType,
        version: nextVersion
      },
    context: "audit_proceso_template_update_success"
  });

  revalidatePath("/professional/procesos/template");
  revalidatePath("/professional/procesos");

  return { message: `Plantilla version ${nextVersion} guardada.`, ok: true };
}

export const saveGeneralTemplateAction = saveProcessTemplateAction;

export async function startProcessAction(
  _previousState: ProcesoActionState,
  formData: FormData
): Promise<ProcesoActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = startProcessSchema.safeParse({
    expedienteId: formData.get("expedienteId"),
    modelType: formData.get("modelType")
  });

  if (!parsed.success) {
    return { message: "Datos invalidos.", ok: false };
  }

  const expediente = await assertExpedienteOwner(parsed.data.expedienteId, actor.id);

  if (!expediente) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_start",
      entityType: "procesos_terapeuticos",
      entityId: parsed.data.expedienteId,
      result: "denied",
      context: "audit_proceso_start_denied"
    });

    return { message: "No tienes permiso para iniciar proceso en este expediente.", ok: false };
  }

  if (expediente.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_start",
      entityType: "procesos_terapeuticos",
      entityId: expediente.id,
      result: "denied",
      context: "audit_proceso_start_denied_not_active"
    });

    return { message: "El expediente no esta activo.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: activeProcess } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .select("id")
    .eq("patient_id", expediente.patient_id)
    .eq("professional_id", actor.id)
    .eq("status", "activo")
    .maybeSingle();

  if (activeProcess) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_start",
      entityType: "procesos_terapeuticos",
      entityId: activeProcess.id,
      result: "denied",
      metadata: {
        patient_id: expediente.patient_id
      },
      context: "audit_proceso_start_denied_active_exists"
    });

    return { message: "Ya existe un proceso activo para este Paciente.", ok: false };
  }

  let latestTemplate: Awaited<ReturnType<typeof getProcessTemplateSnapshot>>;

  try {
    latestTemplate = await getProcessTemplateSnapshot(actor.id, parsed.data.modelType);
  } catch (templateError) {
    Sentry.captureException(templateError, {
      extra: {
        professional_id: actor.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_start",
      entityType: "procesos_terapeuticos",
      entityId: expediente.id,
      result: "error",
      context: "audit_proceso_start_template_error"
    });

    return { message: "No fue posible preparar la plantilla del proceso.", ok: false };
  }

  const { data, error } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .insert({
      expediente_id: expediente.id,
      patient_id: expediente.patient_id,
      professional_id: actor.id,
      model_type: parsed.data.modelType,
      template_id: latestTemplate.id,
      template_version: latestTemplate.version,
      template_snapshot: {
        steps: latestTemplate.steps
      },
      created_by_user_id: actor.id
    })
    .select("id")
    .single();

  if (error || !data) {
    Sentry.captureException(error ?? new Error("Process insert did not return an id"), {
      extra: {
        expediente_id: expediente.id,
        patient_id: expediente.patient_id,
        professional_id: actor.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_start",
      entityType: "procesos_terapeuticos",
      entityId: expediente.id,
      result: "error",
      context: "audit_proceso_start_error"
    });

    return { message: "No fue posible iniciar el proceso.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "proceso_start",
    entityType: "procesos_terapeuticos",
    entityId: data.id,
    result: "success",
    metadata: {
      expediente_id: expediente.id,
      model_type: parsed.data.modelType,
      template_version: latestTemplate.version
    },
    context: "audit_proceso_start_success"
  });

  revalidatePath(`/professional/expedientes/${expediente.id}`);
  revalidatePath("/professional/procesos");

  return {
    message: `Proceso terapeutico ${PROCESS_MODEL_LABEL[parsed.data.modelType]} iniciado.`,
    ok: true
  };
}

export const startGeneralProcessAction = startProcessAction;

export async function updateProcesoStepAction(
  _previousState: ProcesoActionState,
  formData: FormData
): Promise<ProcesoActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = updateStepSchema.safeParse({
    processId: formData.get("processId"),
    stepId: formData.get("stepId"),
    gptInstructions: formData.get("gptInstructions"),
    completed: formData.get("completed") === "on"
  });

  if (!parsed.success) {
    return { message: "Datos invalidos.", ok: false };
  }

  const process = await assertProcessOwner(parsed.data.processId, actor.id);

  if (!process) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_step_update",
      entityType: "procesos_terapeuticos",
      entityId: parsed.data.processId,
      result: "denied",
      context: "audit_proceso_step_update_denied"
    });

    return { message: "No tienes permiso para modificar este proceso.", ok: false };
  }

  if (process.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_step_update",
      entityType: "procesos_terapeuticos",
      entityId: process.id,
      result: "denied",
      context: "audit_proceso_step_update_denied_closed"
    });

    return { message: "Los procesos cerrados son de solo lectura.", ok: false };
  }

  const consentPolicy = await getConsentAccessPolicy(process.expediente_id);

  if (!consentPolicy?.canAdvanceClinicalWork) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_step_update",
      entityType: "procesos_terapeuticos",
      entityId: process.id,
      result: "denied",
      metadata: { reason: "consent_grace_session_used" },
      context: "audit_proceso_step_update_denied_consent"
    });
    return { message: consentRequiredMessage(), ok: false };
  }

  const step = process.template_snapshot.steps.find((item) => item.id === parsed.data.stepId);

  if (!step) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_step_update",
      entityType: "procesos_terapeuticos",
      entityId: process.id,
      result: "denied",
      metadata: {
        step_id: parsed.data.stepId
      },
      context: "audit_proceso_step_update_denied_step"
    });

    return { message: "El paso no existe en la plantilla del proceso.", ok: false };
  }

  const nextStepData = {
    ...(process.step_data ?? {}),
    [step.id]: normalizeStepValues(formData, step)
  };
  const nextGptInstructions = {
    ...(process.gpt_instructions ?? {}),
    [step.id]: parsed.data.gptInstructions?.trim() ?? ""
  };

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .update({
      step_data: nextStepData,
      gpt_instructions: nextGptInstructions
    })
    .eq("id", process.id)
    .eq("professional_id", actor.id)
    .eq("status", "activo");

  if (error) {
    Sentry.captureException(error, {
      extra: {
        process_id: process.id,
        step_id: step.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_step_update",
      entityType: "procesos_terapeuticos",
      entityId: process.id,
      result: "error",
      context: "audit_proceso_step_update_error"
    });

    return { message: "No fue posible guardar el paso.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "proceso_step_update",
    entityType: "procesos_terapeuticos",
    entityId: process.id,
    result: "success",
    metadata: {
      step_id: step.id
    },
    context: "audit_proceso_step_update_success"
  });

  revalidatePath(`/professional/procesos/${process.id}`);

  return { message: "Paso guardado.", ok: true };
}

export async function linkNoteToProcessAction(
  _previousState: ProcesoActionState,
  formData: FormData
): Promise<ProcesoActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = linkNoteSchema.safeParse({
    processId: formData.get("processId"),
    noteId: formData.get("noteId")
  });

  if (!parsed.success) {
    return { message: "Datos invalidos.", ok: false };
  }

  const process = await assertProcessOwner(parsed.data.processId, actor.id);

  if (!process || process.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_note_link",
      entityType: "procesos_terapeuticos",
      entityId: parsed.data.processId,
      result: "denied",
      context: "audit_proceso_note_link_denied_process"
    });

    return { message: "El proceso no esta activo.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: note, error: noteError } = await supabaseAdmin
    .from("notas_clinicas")
    .select("id, expediente_id, professional_id, status")
    .eq("id", parsed.data.noteId)
    .eq("expediente_id", process.expediente_id)
    .eq("professional_id", actor.id)
    .single();

  if (noteError || !note || !["confirmada", "con_addendum", "exportada"].includes(note.status)) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_note_link",
      entityType: "procesos_terapeuticos",
      entityId: process.id,
      result: "denied",
      metadata: {
        note_id: parsed.data.noteId
      },
      context: "audit_proceso_note_link_denied"
    });

    return { message: "Solo puedes vincular notas confirmadas del mismo expediente.", ok: false };
  }

  const linkedNoteIds = Array.from(new Set([...(process.linked_note_ids ?? []), note.id]));
  const { error: processError } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .update({ linked_note_ids: linkedNoteIds })
    .eq("id", process.id)
    .eq("professional_id", actor.id)
    .eq("status", "activo");

  if (processError) {
    Sentry.captureException(processError, {
      extra: {
        process_id: process.id,
        note_id: note.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_note_link",
      entityType: "procesos_terapeuticos",
      entityId: process.id,
      result: "error",
      metadata: {
        note_id: note.id
      },
      context: "audit_proceso_note_link_error"
    });

    return { message: "No fue posible vincular la nota.", ok: false };
  }

  const { error: noteUpdateError } = await supabaseAdmin
    .from("notas_clinicas")
    .update({ process_id: process.id })
    .eq("id", note.id)
    .eq("professional_id", actor.id);

  if (noteUpdateError) {
    Sentry.captureException(noteUpdateError, {
      extra: {
        process_id: process.id,
        note_id: note.id
      }
    });

    const { error: rollbackError } = await supabaseAdmin
      .from("procesos_terapeuticos")
      .update({ linked_note_ids: process.linked_note_ids ?? [] })
      .eq("id", process.id)
      .eq("professional_id", actor.id)
      .eq("status", "activo");

    if (rollbackError) {
      Sentry.captureException(rollbackError, {
        extra: {
          process_id: process.id,
          note_id: note.id,
          state: "diverged_process_note"
        }
      });
    }

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_note_link",
      entityType: "procesos_terapeuticos",
      entityId: process.id,
      result: "error",
      metadata: {
        note_id: note.id,
        rollback_success: rollbackError === null
      },
      context: "audit_proceso_note_link_note_update_error"
    });

    return { message: "No fue posible vincular la nota.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "proceso_note_link",
    entityType: "procesos_terapeuticos",
    entityId: process.id,
    result: "success",
    metadata: {
      note_id: note.id
    },
    context: "audit_proceso_note_link_success"
  });

  revalidatePath(`/professional/procesos/${process.id}`);

  return { message: "Nota vinculada al proceso.", ok: true };
}

export async function closeGeneralProcessAction(
  _previousState: ProcesoActionState,
  formData: FormData
): Promise<ProcesoActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = closeProcessSchema.safeParse({
    processId: formData.get("processId"),
    closureNoteId: formData.get("closureNoteId")
  });

  if (!parsed.success) {
    return { message: "Datos invalidos.", ok: false };
  }

  const process = await assertProcessOwner(parsed.data.processId, actor.id);

  if (!process || process.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_close",
      entityType: "procesos_terapeuticos",
      entityId: parsed.data.processId,
      result: "denied",
      context: "audit_proceso_close_denied_process"
    });

    return { message: "El proceso no esta activo.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: note, error: noteError } = await supabaseAdmin
    .from("notas_clinicas")
    .select("id, expediente_id, professional_id, note_type, status")
    .eq("id", parsed.data.closureNoteId)
    .eq("expediente_id", process.expediente_id)
    .eq("professional_id", actor.id)
    .single();

  if (
    noteError ||
    !note ||
    note.note_type !== "egreso" ||
    !["confirmada", "con_addendum", "exportada"].includes(note.status)
  ) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_close",
      entityType: "procesos_terapeuticos",
      entityId: process.id,
      result: "denied",
      metadata: {
        note_id: parsed.data.closureNoteId
      },
      context: "audit_proceso_close_denied"
    });

    return { message: "El cierre requiere una nota de egreso confirmada.", ok: false };
  }

  const now = new Date().toISOString();
  const linkedNoteIds = Array.from(new Set([...(process.linked_note_ids ?? []), note.id]));
  const { error } = await supabaseAdmin
    .from("procesos_terapeuticos")
    .update({
      status: "cerrado",
      closed_at: now,
      closed_by_note_id: note.id,
      linked_note_ids: linkedNoteIds
    })
    .eq("id", process.id)
    .eq("professional_id", actor.id)
    .eq("status", "activo");

  if (error) {
    Sentry.captureException(error, {
      extra: {
        process_id: process.id,
        note_id: note.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "proceso_close",
      entityType: "procesos_terapeuticos",
      entityId: process.id,
      result: "error",
      context: "audit_proceso_close_error"
    });

    return { message: "No fue posible cerrar el proceso.", ok: false };
  }

  const { error: linkError } = await supabaseAdmin
    .from("notas_clinicas")
    .update({ process_id: process.id })
    .eq("id", note.id)
    .eq("professional_id", actor.id);

  if (linkError) {
    Sentry.captureException(linkError, {
      extra: {
        process_id: process.id,
        note_id: note.id
      }
    });
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "proceso_close",
    entityType: "procesos_terapeuticos",
    entityId: process.id,
    result: "success",
    metadata: {
      note_id: note.id
    },
    context: "audit_proceso_close_success"
  });

  revalidatePath(`/professional/procesos/${process.id}`);
  revalidatePath("/professional/procesos");

  return { message: "Proceso terapeutico cerrado.", ok: true };
}
