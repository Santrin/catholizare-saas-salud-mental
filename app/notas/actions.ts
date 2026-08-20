"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/profile";
import { consentRequiredMessage, getConsentAccessPolicy } from "@/lib/consent/access-policy";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import {
  DEFAULT_NOTA_TEMPLATE_SECTIONS,
  NOTA_TEMPLATE_MODEL_LABEL,
  NOTA_CLINICA_TYPES,
  NOTA_TEMPLATE_FIELD_TYPES,
  NOTA_TEMPLATE_MODEL_TYPES,
  type NotaTemplate,
  type NotaTemplateModelType,
  type NotaTemplateSection
} from "@/lib/notas/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type NotaActionState = {
  message?: string;
  ok?: boolean;
};

type ExpedienteAccess = {
  id: string;
  patient_id: string;
  professional_id: string;
  status: string;
  consent_status: string;
};

type NotaAccess = {
  id: string;
  expediente_id: string;
  patient_id: string;
  professional_id: string;
  created_by_user_id: string | null;
  status: string;
  note_type: string;
  note_template_values: NotaTemplateValues | null;
  note_template_snapshot: {
    sections: NotaTemplateSection[];
  } | null;
};

const allowedMoodReviewValues = new Set(["-5", "-3", "0", "3", "5"]);

const optionalScore = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().min(1).max(10).optional()
);

const createNotaSchema = z.object({
  expedienteId: z.string().uuid(),
  noteType: z.enum(NOTA_CLINICA_TYPES),
  modelType: z.enum(NOTA_TEMPLATE_MODEL_TYPES).default("general"),
  intent: z.enum(["draft", "confirm"]).default("draft")
});

const updateDraftSchema = z.object({
  noteId: z.string().uuid()
});

const fieldSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.enum(NOTA_TEMPLATE_FIELD_TYPES),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1)).optional()
});

const sectionSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().optional(),
  fields: z.array(fieldSchema).min(1)
});

const templateSectionsSchema = z
  .array(sectionSchema)
  .min(1)
  .superRefine((sections, context) => {
    const sectionIds = new Set<string>();

    sections.forEach((section, sectionIndex) => {
      if (sectionIds.has(section.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Los IDs de secciones deben ser unicos.",
          path: [sectionIndex, "id"]
        });
      }

      sectionIds.add(section.id);

      const fieldIds = new Set<string>();
      section.fields.forEach((field, fieldIndex) => {
        if (fieldIds.has(field.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Los IDs de campos deben ser unicos dentro de la seccion.",
            path: [sectionIndex, "fields", fieldIndex, "id"]
          });
        }

        if (field.type === "select" && (!field.options || field.options.length === 0)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Los campos de seleccion requieren opciones.",
            path: [sectionIndex, "fields", fieldIndex, "options"]
          });
        }

        fieldIds.add(field.id);
      });
    });
  });

const templateSchema = z.object({
  modelType: z.enum(NOTA_TEMPLATE_MODEL_TYPES),
  name: z.string().trim().min(1).max(120),
  sectionsJson: z.string().trim().min(2)
});

const noteIdSchema = z.object({
  noteId: z.string().uuid()
});

const annulSchema = z.object({
  noteId: z.string().uuid(),
  annulmentReason: z.string().trim().min(5, "Describe el motivo de la anulacion logica.")
});

type NotaTemplateValues = Record<string, Record<string, string | number | boolean | null>>;

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
    .select("id, patient_id, professional_id, status, consent_status")
    .eq("id", expedienteId)
    .eq("professional_id", professionalId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as ExpedienteAccess;
}

async function assertNotaOwner(noteId: string, professionalId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("notas_clinicas")
    .select(
      "id, expediente_id, patient_id, professional_id, created_by_user_id, status, note_type, note_template_values, note_template_snapshot"
    )
    .eq("id", noteId)
    .eq("professional_id", professionalId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as NotaAccess;
}

function appendOnlyTextValue(previous: string | number | boolean | null | undefined, next: string | number | boolean | null) {
  if (previous === null || previous === undefined || previous === "") {
    return next;
  }

  if (next === null || next === "") {
    return previous;
  }

  if (typeof previous !== "string" || typeof next !== "string") {
    return next;
  }

  const previousText = previous.trim();
  const nextText = next.trim();

  if (!previousText) {
    return nextText || null;
  }

  if (!nextText || nextText === previousText) {
    return previousText;
  }

  if (nextText.includes(previousText)) {
    return nextText;
  }

  return `${previousText}\n\nAgregado ${new Date().toLocaleString("es-MX")}:\n${nextText}`;
}

function mergeNotaDraftValuesAppendOnly(
  previousValues: NotaTemplateValues | null,
  nextValues: NotaTemplateValues
) {
  const merged: NotaTemplateValues = {};

  for (const [sectionId, sectionValues] of Object.entries(nextValues)) {
    merged[sectionId] = {};
    const previousSection = previousValues?.[sectionId] ?? {};

    for (const [fieldId, nextValue] of Object.entries(sectionValues)) {
      merged[sectionId][fieldId] = appendOnlyTextValue(previousSection[fieldId], nextValue);
    }
  }

  for (const [sectionId, previousSection] of Object.entries(previousValues ?? {})) {
    merged[sectionId] = merged[sectionId] ?? {};

    for (const [fieldId, previousValue] of Object.entries(previousSection)) {
      if (merged[sectionId][fieldId] === undefined) {
        merged[sectionId][fieldId] = previousValue;
      }
    }
  }

  return merged;
}

async function writeDraftRevisionSnapshot(input: {
  note: NotaAccess;
  actorId: string;
  previousValues: NotaTemplateValues | null;
  nextValues: NotaTemplateValues;
  event: "draft_update" | "confirm";
}) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin.from("nota_clinica_draft_revisions").insert({
    note_id: input.note.id,
    expediente_id: input.note.expediente_id,
    patient_id: input.note.patient_id,
    professional_id: input.note.professional_id,
    edited_by_user_id: input.actorId,
    revision_event: input.event,
    previous_values: input.previousValues ?? {},
    next_values: input.nextValues
  });

  if (error) {
    Sentry.captureException(error, {
      extra: {
        note_id: input.note.id,
        expediente_id: input.note.expediente_id,
        context: "nota_draft_revision_snapshot"
      }
    });
  }
}

function parseScores(formData: FormData) {
  return {
    moodScore: optionalScore.safeParse(formData.get("mood_score")),
    anxietyScore: optionalScore.safeParse(formData.get("anxiety_score")),
    hopeScore: optionalScore.safeParse(formData.get("hope_score"))
  };
}

function parseTemplateSections(raw: string) {
  try {
    return templateSectionsSchema.safeParse(JSON.parse(raw));
  } catch {
    return templateSectionsSchema.safeParse(null);
  }
}

function normalizeTemplateValues(formData: FormData, sections: NotaTemplateSection[]) {
  const values: NotaTemplateValues = {};

  for (const section of sections) {
    values[section.id] = {};

    for (const field of section.fields) {
      const rawValue = formData.get(`field_${section.id}_${field.id}`);
      const value = typeof rawValue === "string" ? rawValue.trim().slice(0, 10000) : "";

      if (field.type === "checkbox") {
        values[section.id][field.id] = rawValue === "on";
        continue;
      }

      if (field.required && value.length === 0) {
        return {
          success: false as const,
          message: `Completa el campo obligatorio: ${field.label}`
        };
      }

      if (field.id === "mood_review") {
        if (value !== "" && !allowedMoodReviewValues.has(value)) {
          return {
            success: false as const,
            message: "La revision del estado de animo debe ser -5, -3, 0, +3 o +5."
          };
        }

        values[section.id][field.id] = value === "" ? null : Number(value);
        continue;
      }

      if (field.type === "number") {
        const numericValue = Number(value);
        values[section.id][field.id] =
          value === "" || !Number.isFinite(numericValue) ? null : numericValue;
      } else {
        values[section.id][field.id] = value.length > 0 ? value : null;
      }
    }
  }

  return { success: true as const, values };
}

function getTemplateValue(values: NotaTemplateValues, fieldId: string) {
  for (const sectionValues of Object.values(values)) {
    const value = sectionValues[fieldId];

    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      return value;
    }
  }

  return null;
}

function getTextTemplateValue(values: NotaTemplateValues, fieldId: string) {
  const value = getTemplateValue(values, fieldId);
  return value === null ? undefined : String(value);
}

function noteBodyPayload(values: NotaTemplateValues, scores: ReturnType<typeof parseScores>) {
  const sessionDate =
    getTextTemplateValue(values, "session_date") ?? new Date().toISOString().slice(0, 10);
  const tccSessionNumber = getTemplateValue(values, "tcc_session_number");
  const content = Object.entries(values)
    .flatMap(([sectionId, sectionValues]) =>
      Object.entries(sectionValues).map(([fieldId, value]) =>
        value === null ? null : `${sectionId}.${fieldId}:\n${String(value)}`
      )
    )
    .filter(Boolean)
    .join("\n\n");

  return {
    session_date: sessionDate,
    session_time: getTextTemplateValue(values, "session_time"),
    tcc_session_number: typeof tccSessionNumber === "number" ? tccSessionNumber : null,
    objective_scores: getTextTemplateValue(values, "objective_scores"),
    patient_plan: getTextTemplateValue(values, "patient_plan"),
    therapist_objectives: getTextTemplateValue(values, "therapist_objectives"),
    mood_review: getTextTemplateValue(values, "mood_review"),
    previous_session_bridge: getTextTemplateValue(values, "previous_session_bridge"),
    session_agenda: getTextTemplateValue(values, "session_agenda"),
    action_plan_review: getTextTemplateValue(values, "action_plan_review"),
    key_session_points: getTextTemplateValue(values, "key_session_points") ?? content,
    session_summary_feedback: getTextTemplateValue(values, "session_summary_feedback"),
    home_action_plan: getTextTemplateValue(values, "home_action_plan"),
    patient_feedback: getTextTemplateValue(values, "patient_feedback"),
    observations: getTextTemplateValue(values, "observations"),
    next_session_at: getTextTemplateValue(values, "next_session_at"),
    content,
    clinical_summary: getTextTemplateValue(values, "session_summary_feedback"),
    interventions: getTextTemplateValue(values, "key_session_points"),
    patient_response: getTextTemplateValue(values, "patient_feedback"),
    plan_next_session: getTextTemplateValue(values, "observations"),
    risk_flags: getTextTemplateValue(values, "risk_flags"),
    homework_or_tasks: getTextTemplateValue(values, "home_action_plan"),
    mood_score: scores.moodScore.success ? scores.moodScore.data ?? null : null,
    anxiety_score: scores.anxietyScore.success ? scores.anxietyScore.data ?? null : null,
    hope_score: scores.hopeScore.success ? scores.hopeScore.data ?? null : null
  };
}

async function getOrCreateLatestNotaTemplate(
  professionalId: string,
  modelType: NotaTemplateModelType
) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data: latestTemplate, error: latestError } = await supabaseAdmin
    .from("plantillas_nota_clinica")
    .select("id, version, sections")
    .eq("professional_id", professionalId)
    .eq("model_type", modelType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw latestError;
  }

  if (latestTemplate) {
    return latestTemplate as Pick<NotaTemplate, "id" | "version" | "sections">;
  }

  const { data: createdTemplate, error: createError } = await supabaseAdmin
    .from("plantillas_nota_clinica")
    .insert({
      professional_id: professionalId,
      model_type: modelType,
      name: `Nota clinica ${NOTA_TEMPLATE_MODEL_LABEL[modelType]}`,
      version: 1,
      sections: DEFAULT_NOTA_TEMPLATE_SECTIONS,
      created_by_user_id: professionalId
    })
    .select("id, version, sections")
    .single();

  if (createError || !createdTemplate) {
    throw createError ?? new Error("Default note template insert did not return a row");
  }

  return createdTemplate as Pick<NotaTemplate, "id" | "version" | "sections">;
}

export async function createNotaClinicaAction(
  _previousState: NotaActionState,
  formData: FormData
): Promise<NotaActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = createNotaSchema.safeParse({
    expedienteId: formData.get("expedienteId"),
    noteType: formData.get("noteType"),
    modelType: formData.get("modelType"),
    intent: formData.get("intent") === "confirm" ? "confirm" : "draft"
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Datos invalidos.", ok: false };
  }

  const expediente = await assertExpedienteOwner(parsed.data.expedienteId, actor.id);

  if (!expediente) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_create",
      entityType: "notas_clinicas",
      entityId: parsed.data.expedienteId,
      result: "denied",
      context: "audit_nota_clinica_create_denied"
    });

    return { message: "No tienes permiso para crear notas en este expediente.", ok: false };
  }

  if (expediente.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_create",
      entityType: "notas_clinicas",
      entityId: expediente.id,
      result: "denied",
      context: "audit_nota_clinica_create_denied_not_active"
    });

    return { message: "El expediente no esta activo y no puede modificarse.", ok: false };
  }

  const consentPolicy = await getConsentAccessPolicy(expediente.id);

  if (!consentPolicy?.canCreateClinicalNote) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_create",
      entityType: "notas_clinicas",
      entityId: expediente.id,
      result: "denied",
      metadata: {
        consent_status: expediente.consent_status,
        reason: "consent_grace_session_used"
      },
      context: "audit_nota_clinica_create_denied_consent"
    });

    return { message: consentRequiredMessage(), ok: false };
  }

  let template: Pick<NotaTemplate, "id" | "version" | "sections">;

  try {
    template = await getOrCreateLatestNotaTemplate(actor.id, parsed.data.modelType);
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        professional_id: actor.id,
        model_type: parsed.data.modelType
      }
    });

    return { message: "No fue posible cargar la plantilla de nota.", ok: false };
  }

  const normalizedValues = normalizeTemplateValues(formData, template.sections);

  if (!normalizedValues.success) {
    return { message: normalizedValues.message, ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const shouldConfirm = parsed.data.intent === "confirm";
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("notas_clinicas")
    .insert({
      expediente_id: expediente.id,
      patient_id: expediente.patient_id,
      professional_id: actor.id,
      created_by_user_id: actor.id,
      note_type: parsed.data.noteType,
      status: shouldConfirm ? "confirmada" : "borrador",
      confirmed_at: shouldConfirm ? now : null,
      confirmed_by_user_id: shouldConfirm ? actor.id : null,
      note_template_id: template.id,
      note_template_version: template.version,
      note_template_snapshot: {
        sections: template.sections
      },
      note_template_values: normalizedValues.values,
      ...noteBodyPayload(normalizedValues.values, parseScores(formData))
    })
    .select("id")
    .single();

  if (error || !data) {
    Sentry.captureException(error ?? new Error("Clinical note insert did not return an id"), {
      extra: {
        expediente_id: expediente.id,
        professional_id: actor.id,
        note_type: parsed.data.noteType
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_create",
      entityType: "notas_clinicas",
      entityId: expediente.id,
      result: "error",
      metadata: {
        note_type: parsed.data.noteType
      },
      context: "audit_nota_clinica_create_error"
    });

    return { message: "No fue posible crear la nota clinica.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "nota_clinica_create",
    entityType: "notas_clinicas",
    entityId: data.id,
    result: "success",
    metadata: {
      expediente_id: expediente.id,
      note_type: parsed.data.noteType
    },
    context: "audit_nota_clinica_create_success"
  });

  if (shouldConfirm) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: data.id,
      result: "success",
      metadata: {
        expediente_id: expediente.id,
        source: "create_and_confirm"
      },
      context: "audit_nota_clinica_create_confirm_success"
    });
  }

  revalidatePath(`/professional/expedientes/${expediente.id}`);

  return {
    message: shouldConfirm ? "Nota clinica guardada y confirmada." : "Nota clinica creada en borrador.",
    ok: true
  };
}

export async function saveNotaTemplateAction(
  _previousState: NotaActionState,
  formData: FormData
): Promise<NotaActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = templateSchema.safeParse({
    modelType: formData.get("modelType"),
    name: formData.get("name"),
    sectionsJson: formData.get("sectionsJson")
  });

  if (!parsed.success) {
    return { message: "Define la plantilla en formato valido.", ok: false };
  }

  const sections = parseTemplateSections(parsed.data.sectionsJson);

  if (!sections.success) {
    return {
      message: sections.error.issues[0]?.message ?? "La estructura de secciones no es valida.",
      ok: false
    };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: latestTemplate } = await supabaseAdmin
    .from("plantillas_nota_clinica")
    .select("version")
    .eq("professional_id", actor.id)
    .eq("model_type", parsed.data.modelType)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersion = Number(latestTemplate?.version ?? 0) + 1;
  const { error } = await supabaseAdmin.from("plantillas_nota_clinica").insert({
    professional_id: actor.id,
    model_type: parsed.data.modelType,
    name: parsed.data.name,
    version: nextVersion,
    sections: sections.data,
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
      action: "nota_template_update",
      entityType: "plantillas_nota_clinica",
      result: "error",
      metadata: {
        model_type: parsed.data.modelType,
        name: parsed.data.name
      },
      context: "audit_nota_template_update_error"
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
    action: "nota_template_update",
    entityType: "plantillas_nota_clinica",
    result: "success",
    metadata: {
      model_type: parsed.data.modelType,
      name: parsed.data.name,
      version: nextVersion
    },
    context: "audit_nota_template_update_success"
  });

  revalidatePath("/professional/notas/template");
  revalidatePath("/professional/notas");

  return { message: `Plantilla version ${nextVersion} guardada.`, ok: true };
}

export async function updateDraftNotaClinicaAction(
  _previousState: NotaActionState,
  formData: FormData
): Promise<NotaActionState> {
  if (formData.get("intent") === "confirm") {
    return updateAndConfirmNotaClinicaAction(_previousState, formData);
  }

  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = updateDraftSchema.safeParse({
    noteId: formData.get("noteId")
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Datos invalidos.", ok: false };
  }

  const note = await assertNotaOwner(parsed.data.noteId, actor.id);

  if (!note) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_update_draft",
      entityType: "notas_clinicas",
      entityId: parsed.data.noteId,
      result: "denied",
      context: "audit_nota_clinica_update_denied"
    });

    return { message: "No tienes permiso para modificar esta nota.", ok: false };
  }

  if (note.status !== "borrador") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_update_draft",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      context: "audit_nota_clinica_update_denied_immutable"
    });

    return { message: "Solo las notas en borrador pueden editarse.", ok: false };
  }

  if (note.created_by_user_id !== actor.id) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_update_draft",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      context: "audit_nota_clinica_update_denied_creator"
    });

    return { message: "Solo quien creo el borrador puede modificarlo.", ok: false };
  }

  const expediente = await assertExpedienteOwner(note.expediente_id, actor.id);

  if (!expediente || expediente.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_update_draft",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      context: "audit_nota_clinica_update_denied_not_active"
    });

    return { message: "El expediente no esta activo y no puede modificarse.", ok: false };
  }

  const sections = note.note_template_snapshot?.sections ?? DEFAULT_NOTA_TEMPLATE_SECTIONS;
  const normalizedValues = normalizeTemplateValues(formData, sections);

  if (!normalizedValues.success) {
    return { message: normalizedValues.message, ok: false };
  }

  const mergedValues = mergeNotaDraftValuesAppendOnly(
    note.note_template_values,
    normalizedValues.values
  );

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("notas_clinicas")
    .update({
      note_template_values: mergedValues,
      ...noteBodyPayload(mergedValues, parseScores(formData))
    })
    .eq("id", note.id)
    .eq("professional_id", actor.id)
    .eq("created_by_user_id", actor.id)
    .eq("status", "borrador");

  if (error) {
    Sentry.captureException(error, {
      extra: {
        note_id: note.id,
        expediente_id: note.expediente_id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_update_draft",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "error",
      context: "audit_nota_clinica_update_error"
    });

    return { message: "No fue posible guardar el borrador.", ok: false };
  }

  await writeDraftRevisionSnapshot({
    note,
    actorId: actor.id,
    previousValues: note.note_template_values,
    nextValues: mergedValues,
    event: "draft_update"
  });

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "nota_clinica_update_draft",
    entityType: "notas_clinicas",
    entityId: note.id,
    result: "success",
    metadata: {
      expediente_id: note.expediente_id
    },
    context: "audit_nota_clinica_update_success"
  });

  revalidatePath(`/professional/notas/${note.id}`);
  revalidatePath(`/professional/expedientes/${note.expediente_id}`);

  return { message: "Borrador guardado.", ok: true };
}

export async function updateAndConfirmNotaClinicaAction(
  _previousState: NotaActionState,
  formData: FormData
): Promise<NotaActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = updateDraftSchema.safeParse({
    noteId: formData.get("noteId")
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Datos invalidos.", ok: false };
  }

  const note = await assertNotaOwner(parsed.data.noteId, actor.id);

  if (!note) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: parsed.data.noteId,
      result: "denied",
      context: "audit_nota_clinica_update_confirm_denied"
    });

    return { message: "No tienes permiso para confirmar esta nota.", ok: false };
  }

  if (note.status !== "borrador") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      metadata: {
        current_status: note.status
      },
      context: "audit_nota_clinica_update_confirm_denied_status"
    });

    return { message: "Solo las notas en borrador pueden confirmarse.", ok: false };
  }

  if (note.created_by_user_id !== actor.id) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      context: "audit_nota_clinica_update_confirm_denied_creator"
    });

    return { message: "Solo quien creo el borrador puede confirmarlo.", ok: false };
  }

  const expediente = await assertExpedienteOwner(note.expediente_id, actor.id);

  if (!expediente || expediente.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      context: "audit_nota_clinica_update_confirm_denied_not_active"
    });

    return { message: "El expediente no esta activo y no puede modificarse.", ok: false };
  }

  const sections = note.note_template_snapshot?.sections ?? DEFAULT_NOTA_TEMPLATE_SECTIONS;
  const normalizedValues = normalizeTemplateValues(formData, sections);

  if (!normalizedValues.success) {
    return { message: normalizedValues.message, ok: false };
  }

  const mergedValues = mergeNotaDraftValuesAppendOnly(
    note.note_template_values,
    normalizedValues.values
  );

  const now = new Date().toISOString();
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("notas_clinicas")
    .update({
      note_template_values: mergedValues,
      ...noteBodyPayload(mergedValues, parseScores(formData)),
      status: "confirmada",
      confirmed_at: now,
      confirmed_by_user_id: actor.id
    })
    .eq("id", note.id)
    .eq("professional_id", actor.id)
    .eq("created_by_user_id", actor.id)
    .eq("status", "borrador");

  if (error) {
    Sentry.captureException(error, {
      extra: {
        note_id: note.id,
        expediente_id: note.expediente_id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "error",
      context: "audit_nota_clinica_update_confirm_error"
    });

    return { message: "No fue posible guardar y confirmar la nota.", ok: false };
  }

  await writeDraftRevisionSnapshot({
    note,
    actorId: actor.id,
    previousValues: note.note_template_values,
    nextValues: mergedValues,
    event: "confirm"
  });

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "nota_clinica_confirm",
    entityType: "notas_clinicas",
    entityId: note.id,
    result: "success",
    metadata: {
      expediente_id: note.expediente_id,
      source: "save_and_confirm"
    },
    context: "audit_nota_clinica_update_confirm_success"
  });

  revalidatePath(`/professional/notas/${note.id}`);
  revalidatePath(`/professional/expedientes/${note.expediente_id}`);

  return { message: "Nota clinica guardada y confirmada.", ok: true };
}

export async function confirmNotaClinicaAction(
  _previousState: NotaActionState,
  formData: FormData
): Promise<NotaActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = noteIdSchema.safeParse({
    noteId: formData.get("noteId")
  });

  if (!parsed.success) {
    return { message: "Datos invalidos.", ok: false };
  }

  const note = await assertNotaOwner(parsed.data.noteId, actor.id);

  if (!note) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: parsed.data.noteId,
      result: "denied",
      context: "audit_nota_clinica_confirm_denied"
    });

    return { message: "No tienes permiso para confirmar esta nota.", ok: false };
  }

  if (note.status !== "borrador") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      metadata: {
        current_status: note.status
      },
      context: "audit_nota_clinica_confirm_denied_status"
    });

    return { message: "Solo las notas en borrador pueden confirmarse.", ok: false };
  }

  if (note.created_by_user_id !== actor.id) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      context: "audit_nota_clinica_confirm_denied_creator"
    });

    return { message: "Solo quien creo el borrador puede confirmarlo.", ok: false };
  }

  const expediente = await assertExpedienteOwner(note.expediente_id, actor.id);

  if (!expediente || expediente.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      context: "audit_nota_clinica_confirm_denied_not_active"
    });

    return { message: "El expediente no esta activo y no puede modificarse.", ok: false };
  }

  const now = new Date().toISOString();
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("notas_clinicas")
    .update({
      status: "confirmada",
      confirmed_at: now,
      confirmed_by_user_id: actor.id
    })
    .eq("id", note.id)
    .eq("professional_id", actor.id)
    .eq("created_by_user_id", actor.id)
    .eq("status", "borrador");

  if (error) {
    Sentry.captureException(error, {
      extra: {
        note_id: note.id,
        expediente_id: note.expediente_id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_confirm",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "error",
      context: "audit_nota_clinica_confirm_error"
    });

    return { message: "No fue posible confirmar la nota.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "nota_clinica_confirm",
    entityType: "notas_clinicas",
    entityId: note.id,
    result: "success",
    metadata: {
      expediente_id: note.expediente_id
    },
    context: "audit_nota_clinica_confirm_success"
  });

  revalidatePath(`/professional/notas/${note.id}`);
  revalidatePath(`/professional/expedientes/${note.expediente_id}`);

  return { message: "Nota clinica confirmada.", ok: true };
}

export async function annulNotaClinicaAction(
  _previousState: NotaActionState,
  formData: FormData
): Promise<NotaActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = annulSchema.safeParse({
    noteId: formData.get("noteId"),
    annulmentReason: formData.get("annulmentReason")
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Datos invalidos.", ok: false };
  }

  const note = await assertNotaOwner(parsed.data.noteId, actor.id);

  if (!note) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_annul",
      entityType: "notas_clinicas",
      entityId: parsed.data.noteId,
      result: "denied",
      context: "audit_nota_clinica_annul_denied"
    });

    return { message: "No tienes permiso para anular esta nota.", ok: false };
  }

  if (!["confirmada", "con_addendum", "exportada"].includes(note.status)) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_annul",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      metadata: {
        current_status: note.status
      },
      context: "audit_nota_clinica_annul_denied_status"
    });

    return { message: "Solo las notas confirmadas pueden anularse logicamente.", ok: false };
  }

  const expediente = await assertExpedienteOwner(note.expediente_id, actor.id);

  if (!expediente || expediente.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_annul",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      context: "audit_nota_clinica_annul_denied_not_active"
    });

    return { message: "El expediente no esta activo y no puede modificarse.", ok: false };
  }

  const now = new Date().toISOString();
  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("notas_clinicas")
    .update({
      status: "anulada_logicamente",
      annulment_reason: parsed.data.annulmentReason,
      annulled_at: now,
      annulled_by_user_id: actor.id
    })
    .eq("id", note.id)
    .eq("professional_id", actor.id);

  if (error) {
    Sentry.captureException(error, {
      extra: {
        note_id: note.id,
        expediente_id: note.expediente_id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_annul",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "error",
      context: "audit_nota_clinica_annul_error"
    });

    return { message: "No fue posible anular logicamente la nota.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "nota_clinica_annul",
    entityType: "notas_clinicas",
    entityId: note.id,
    result: "success",
    metadata: {
      expediente_id: note.expediente_id
    },
    context: "audit_nota_clinica_annul_success"
  });

  revalidatePath(`/professional/notas/${note.id}`);
  revalidatePath(`/professional/expedientes/${note.expediente_id}`);

  return { message: "Nota anulada logicamente.", ok: true };
}

export async function prepareNotaExportAction(formData: FormData) {
  const actor = await getActiveProfessional();

  if (!actor) {
    redirect("/auth/login");
  }

  const parsed = noteIdSchema.safeParse({
    noteId: formData.get("noteId")
  });

  if (!parsed.success) {
    redirect("/professional/notas");
  }

  const note = await assertNotaOwner(parsed.data.noteId, actor.id);

  if (!note) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_export",
      entityType: "notas_clinicas",
      entityId: parsed.data.noteId,
      result: "denied",
      context: "audit_nota_clinica_export_denied"
    });

    redirect("/professional/notas");
  }

  if (!["confirmada", "con_addendum", "exportada"].includes(note.status)) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_export",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "denied",
      metadata: {
        current_status: note.status
      },
      context: "audit_nota_clinica_export_denied_status"
    });

    redirect(`/professional/notas/${note.id}`);
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("notas_clinicas")
    .update({
      status: note.status === "confirmada" ? "exportada" : note.status,
      exported_at: new Date().toISOString()
    })
    .eq("id", note.id)
    .eq("professional_id", actor.id)
    .in("status", ["confirmada", "con_addendum", "exportada"]);

  if (error) {
    Sentry.captureException(error, {
      extra: {
        note_id: note.id,
        expediente_id: note.expediente_id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "nota_clinica_export",
      entityType: "notas_clinicas",
      entityId: note.id,
      result: "error",
      context: "audit_nota_clinica_export_error"
    });

    redirect(`/professional/notas/${note.id}`);
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "nota_clinica_export",
    entityType: "notas_clinicas",
    entityId: note.id,
    result: "success",
    metadata: {
      expediente_id: note.expediente_id
    },
    context: "audit_nota_clinica_export_success"
  });

  revalidatePath(`/professional/notas/${note.id}`);
  redirect(`/professional/notas/${note.id}/export`);
}
