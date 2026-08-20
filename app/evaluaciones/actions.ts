"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { generateClinicalDraft } from "@/lib/ai/openai";
import type { ClinicalContextPackage } from "@/lib/ai/types";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import { getCurrentProfile } from "@/lib/auth/profile";
import { consentRequiredMessage, getConsentAccessPolicy } from "@/lib/consent/access-policy";
import {
  ASSESSMENT_INPUT_METHODS,
  PATIENT_ASSESSMENT_UPLOAD_LABEL,
  PATIENT_ASSESSMENT_UPLOAD_TYPES,
  PSYCHOLOGICAL_ASSESSMENT_TYPES
} from "@/lib/evaluaciones/types";
import { sanitizeAssessmentUploadResults } from "@/lib/evaluaciones/upload-results";
import { anonymizeLifeHistoryAnswers } from "@/lib/life-history/anonymize";
import type { LifeHistoryAnswers } from "@/lib/life-history/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type EvaluationActionState = {
  message?: string;
  ok?: boolean;
  draft?: string;
};

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

const jsonObjectText = z
  .string()
  .trim()
  .max(50000, "El JSON excede el tamano permitido.")
  .transform((value, ctx) => {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe ser un objeto JSON." });
        return z.NEVER;
      }
      return parsed as Record<string, unknown>;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "JSON invalido." });
      return z.NEVER;
    }
  });

const createAssessmentSchema = z.object({
  expedienteId: z.string().uuid(),
  assessmentName: z.string().trim().min(2).max(180),
  assessmentType: z.enum(PSYCHOLOGICAL_ASSESSMENT_TYPES),
  assessmentPurpose: z.string().trim().min(5).max(1200),
  appliedAt: z.string().trim().min(8),
  inputMethod: z.enum(ASSESSMENT_INPUT_METHODS),
  observations: optionalText
});

const aiDraftSchema = z.object({
  assessmentId: z.string().uuid(),
  directives: z.string().trim().min(10).max(4000)
});

const uploadResultsSchema = z.object({
  uploadId: z.string().uuid(),
  extractedResults: jsonObjectText,
  professionalNotes: optionalText
});

const requestAssessmentUploadSchema = z.object({
  expedienteId: z.string().uuid(),
  assessmentCode: z.enum(PATIENT_ASSESSMENT_UPLOAD_TYPES),
  otherAssessmentLabel: z.string().trim().max(120).optional()
});

const validateAssessmentSchema = z.object({
  assessmentId: z.string().uuid(),
  rawScores: jsonObjectText,
  scaledScores: jsonObjectText,
  percentiles: jsonObjectText,
  cutoffPoints: jsonObjectText,
  interpretation: z.string().trim().min(10).max(8000),
  limitations: optionalText,
  implications: optionalText,
  comparisonNotes: optionalText
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

  return data as {
    id: string;
    patient_id: string;
    professional_id: string;
    status: string;
  };
}

async function getAssessmentOwner(assessmentId: string, professionalId: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("psychological_assessments")
    .select(
      "id, expediente_id, patient_id, professional_id, assessment_name, assessment_type, assessment_purpose, applied_at, input_method, status, raw_scores, scaled_scores, percentiles, cutoff_points, ai_draft_interpretation"
    )
    .eq("id", assessmentId)
    .eq("professional_id", professionalId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as {
    id: string;
    expediente_id: string;
    patient_id: string;
    professional_id: string;
    assessment_name: string;
    assessment_type: string;
    assessment_purpose: string;
    applied_at: string;
    input_method: string;
    status: string;
    raw_scores: Record<string, unknown>;
    scaled_scores: Record<string, unknown>;
    percentiles: Record<string, unknown>;
    cutoff_points: Record<string, unknown>;
    ai_draft_interpretation: string | null;
  };
}

export async function createAssessmentAction(
  _previousState: EvaluationActionState,
  formData: FormData
): Promise<EvaluationActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = createAssessmentSchema.safeParse({
    expedienteId: formData.get("expedienteId"),
    assessmentName: formData.get("assessmentName"),
    assessmentType: formData.get("assessmentType"),
    assessmentPurpose: formData.get("assessmentPurpose"),
    appliedAt: formData.get("appliedAt"),
    inputMethod: formData.get("inputMethod"),
    observations: formData.get("observations")
  });

  if (!parsed.success) {
    return { message: "Datos de evaluacion invalidos.", ok: false };
  }

  const appliedAt = new Date(`${parsed.data.appliedAt}T00:00:00`);

  if (Number.isNaN(appliedAt.getTime()) || appliedAt > new Date()) {
    return { message: "La fecha de aplicacion debe ser valida y no puede ser futura.", ok: false };
  }

  const expediente = await assertExpedienteOwner(parsed.data.expedienteId, actor.id);

  if (!expediente || expediente.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_create",
      entityType: "psychological_assessments",
      entityId: parsed.data.expedienteId,
      result: "denied",
      context: "audit_assessment_create_denied"
    });

    return { message: "Solo puedes registrar evaluaciones en expedientes activos propios.", ok: false };
  }

  const consentPolicy = await getConsentAccessPolicy(expediente.id);

  if (!consentPolicy?.canAdvanceClinicalWork) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_create",
      entityType: "psychological_assessments",
      entityId: expediente.id,
      result: "denied",
      metadata: { reason: "consent_grace_session_used" },
      context: "audit_assessment_create_denied_consent"
    });
    return { message: consentRequiredMessage(), ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("psychological_assessments")
    .insert({
      expediente_id: expediente.id,
      patient_id: expediente.patient_id,
      professional_id: actor.id,
      assessment_name: parsed.data.assessmentName,
      assessment_type: parsed.data.assessmentType,
      assessment_purpose: parsed.data.assessmentPurpose,
      applied_at: parsed.data.appliedAt,
      input_method: parsed.data.inputMethod,
      comparison_notes: parsed.data.observations,
      created_by: actor.id
    })
    .select("id")
    .single();

  if (error || !data) {
    Sentry.captureException(error ?? new Error("Assessment insert did not return id"), {
      extra: {
        expediente_id: expediente.id,
        professional_id: actor.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_create",
      entityType: "psychological_assessments",
      entityId: expediente.id,
      result: "error",
      context: "audit_assessment_create_error"
    });

    return { message: "No fue posible registrar la evaluacion.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "assessment_create",
    entityType: "psychological_assessments",
    entityId: data.id,
    result: "success",
    context: "audit_assessment_create_success"
  });

  revalidatePath(`/professional/expedientes/${expediente.id}`);

  return { message: "Evaluacion registrada.", ok: true };
}

export async function requestAssessmentAiDraftAction(
  _previousState: EvaluationActionState,
  formData: FormData
): Promise<EvaluationActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = aiDraftSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    directives: formData.get("directives")
  });

  if (!parsed.success) {
    return { message: "Agrega directrices clinicas de al menos 10 caracteres.", ok: false };
  }

  const assessment = await getAssessmentOwner(parsed.data.assessmentId, actor.id);

  const expediente = assessment
    ? await assertExpedienteOwner(assessment.expediente_id, actor.id)
    : null;

  if (
    !assessment ||
    !expediente ||
    expediente.status !== "activo" ||
    !["borrador", "analizada"].includes(assessment.status)
  ) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_ai_request",
      entityType: "psychological_assessments",
      entityId: parsed.data.assessmentId,
      result: "denied",
      context: "audit_assessment_ai_request_denied"
    });

    return { message: "No puedes solicitar IA para esta evaluacion.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: lifeHistory } = await supabaseAdmin
    .from("patient_life_histories")
    .select("status, answers, submitted_at")
    .eq("expediente_id", expediente.id)
    .in("status", ["enviada", "reabierta"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const anonymizedLifeHistory = lifeHistory
    ? anonymizeLifeHistoryAnswers((lifeHistory.answers ?? {}) as LifeHistoryAnswers)
    : null;
  const lifeHistoryContext =
    lifeHistory && anonymizedLifeHistory
      ? {
          status: lifeHistory.status as string,
          submitted_at: lifeHistory.submitted_at as string | null,
          answers: anonymizedLifeHistory
        }
      : null;

  const contextPackage: ClinicalContextPackage = {
    task: "analisis_evaluacion_imagen",
    assessment: {
      id: assessment.id,
      name: assessment.assessment_name,
      type: assessment.assessment_type,
      purpose: assessment.assessment_purpose,
      applied_at: assessment.applied_at,
      input_method: assessment.input_method,
      raw_scores: assessment.raw_scores,
      scaled_scores: assessment.scaled_scores,
      percentiles: assessment.percentiles,
      cutoff_points: assessment.cutoff_points
    },
    ...(lifeHistoryContext ? { life_history: lifeHistoryContext } : {})
  };

  let draft;

  try {
    draft = await generateClinicalDraft({
      contextPackage,
      directives: parsed.data.directives
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        assessment_id: assessment.id,
        function_type: "analisis_evaluacion_imagen"
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_ai_request",
      entityType: "psychological_assessments",
      entityId: assessment.id,
      result: "error",
      context: "audit_assessment_ai_request_error"
    });

    return { message: "No fue posible generar el borrador con IA.", ok: false };
  }

  const { data: aiSession, error: sessionError } = await supabaseAdmin
    .from("ai_sessions")
    .insert({
      professional_id: actor.id,
      patient_id: assessment.patient_id,
      expediente_id: assessment.expediente_id,
      ai_function_type: "analisis_evaluacion_imagen",
      clinical_context_package: contextPackage,
      professional_directives: parsed.data.directives,
      model_provider: "openai",
      model_name: draft.model,
      suggested_content: draft.content
    })
    .select("id")
    .single();

  if (sessionError || !aiSession) {
    Sentry.captureException(sessionError ?? new Error("AI session insert did not return id"), {
      extra: {
        assessment_id: assessment.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_ai_request",
      entityType: "psychological_assessments",
      entityId: assessment.id,
      result: "error",
      context: "audit_assessment_ai_session_error"
    });

    return { message: "El borrador se genero, pero no pudo registrarse la sesion de IA.", ok: false };
  }

  const { error: updateError } = await supabaseAdmin
    .from("psychological_assessments")
    .update({
      ai_draft_interpretation: draft.content,
      ai_session_id: aiSession.id,
      status: "analizada"
    })
    .eq("id", assessment.id)
    .eq("professional_id", actor.id)
    .in("status", ["borrador", "analizada"]);

  if (updateError) {
    Sentry.captureException(updateError, {
      extra: {
        assessment_id: assessment.id,
        ai_session_id: aiSession.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_ai_request",
      entityType: "psychological_assessments",
      entityId: assessment.id,
      result: "error",
      metadata: {
        ai_session_id: aiSession.id
      },
      context: "audit_assessment_ai_link_error"
    });

    return { message: "El borrador se genero, pero no pudo vincularse.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "assessment_ai_request",
    entityType: "psychological_assessments",
    entityId: assessment.id,
    result: "success",
    metadata: {
      ai_session_id: aiSession.id
    },
    context: "audit_assessment_ai_request_success"
  });

  revalidatePath(`/professional/expedientes/${assessment.expediente_id}`);

  return {
    message: "Borrador generado. Revisalo antes de validar resultados.",
    ok: true,
    draft: draft.content
  };
}

export async function updateAssessmentUploadResultsAction(
  _previousState: EvaluationActionState,
  formData: FormData
): Promise<EvaluationActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = uploadResultsSchema.safeParse({
    uploadId: formData.get("uploadId"),
    extractedResults: formData.get("extractedResults"),
    professionalNotes: formData.get("professionalNotes")
  });

  if (!parsed.success) {
    return { message: "Captura los resultados como objeto JSON valido.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: upload, error: loadError } = await supabaseAdmin
    .from("patient_assessment_uploads")
    .select("id, expediente_id, professional_id, assessment_code, status")
    .eq("id", parsed.data.uploadId)
    .eq("professional_id", actor.id)
    .single();

  const expediente = upload ? await assertExpedienteOwner(upload.expediente_id, actor.id) : null;

  if (loadError || !upload || !expediente || expediente.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_upload_results_update",
      entityType: "patient_assessment_uploads",
      entityId: parsed.data.uploadId,
      result: "denied",
      context: "audit_assessment_upload_results_denied"
    });

    return { message: "No puedes actualizar este envio de prueba.", ok: false };
  }

  const { error } = await supabaseAdmin
    .from("patient_assessment_uploads")
    .update({
      extracted_results: sanitizeAssessmentUploadResults(
        upload.assessment_code,
        parsed.data.extractedResults
      ),
      professional_notes: parsed.data.professionalNotes,
      status: "analizada"
    })
    .eq("id", upload.id)
    .eq("professional_id", actor.id);

  if (error) {
    Sentry.captureException(error, {
      extra: {
        context: "assessment_upload_results_update",
        upload_id: upload.id,
        expediente_id: upload.expediente_id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_upload_results_update",
      entityType: "patient_assessment_uploads",
      entityId: upload.id,
      result: "error",
      context: "audit_assessment_upload_results_error"
    });

    return { message: "No fue posible guardar los resultados.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "assessment_upload_results_update",
    entityType: "patient_assessment_uploads",
    entityId: upload.id,
    result: "success",
    metadata: {
      result_key_count: Object.keys(parsed.data.extractedResults).length,
      result_keys: Object.keys(parsed.data.extractedResults).join(",")
    },
    context: "audit_assessment_upload_results_success"
  });

  revalidatePath(`/professional/expedientes/${upload.expediente_id}`);

  return { message: "Resultados guardados.", ok: true };
}

export async function requestPatientAssessmentUploadAction(
  _previousState: EvaluationActionState,
  formData: FormData
): Promise<EvaluationActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = requestAssessmentUploadSchema.safeParse({
    expedienteId: formData.get("expedienteId"),
    assessmentCode: formData.get("assessmentCode"),
    otherAssessmentLabel: `${formData.get("otherAssessmentLabel") ?? ""}` || undefined
  });

  if (!parsed.success) {
    return { message: "Selecciona una prueba valida.", ok: false };
  }

  const expediente = await assertExpedienteOwner(parsed.data.expedienteId, actor.id);

  if (!expediente || expediente.status !== "activo") {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_upload_request",
      entityType: "patient_assessment_requests",
      entityId: parsed.data.expedienteId,
      result: "denied",
      context: "audit_assessment_upload_request_denied"
    });

    return { message: "No puedes solicitar pruebas para este expediente.", ok: false };
  }

  const assessmentLabel =
    parsed.data.assessmentCode === "otra"
      ? parsed.data.otherAssessmentLabel?.trim()
      : PATIENT_ASSESSMENT_UPLOAD_LABEL[parsed.data.assessmentCode];

  if (!assessmentLabel || assessmentLabel.length < 2) {
    return { message: "Escribe el nombre de la prueba.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("patient_assessment_requests")
    .insert({
      expediente_id: expediente.id,
      patient_id: expediente.patient_id,
      professional_id: actor.id,
      assessment_code: parsed.data.assessmentCode,
      assessment_label: assessmentLabel,
      requested_by: actor.id
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { message: "Ya hay una solicitud pendiente para esta prueba.", ok: false };
    }

    Sentry.captureException(error ?? new Error("Assessment request insert did not return id"), {
      extra: {
        expediente_id: expediente.id,
        assessment_code: parsed.data.assessmentCode
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_upload_request",
      entityType: "patient_assessment_requests",
      entityId: expediente.id,
      result: "error",
      context: "audit_assessment_upload_request_error"
    });

    return { message: "No fue posible solicitar la prueba.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "assessment_upload_request",
    entityType: "patient_assessment_requests",
    entityId: data.id,
    result: "success",
    metadata: {
      assessment_code: parsed.data.assessmentCode
    },
    context: "audit_assessment_upload_request_success"
  });

  revalidatePath(`/professional/expedientes/${expediente.id}`);
  revalidatePath("/portal");

  return { message: "Prueba activada para el paciente.", ok: true };
}

export async function validateAssessmentAction(
  _previousState: EvaluationActionState,
  formData: FormData
): Promise<EvaluationActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = validateAssessmentSchema.safeParse({
    assessmentId: formData.get("assessmentId"),
    rawScores: formData.get("rawScores"),
    scaledScores: formData.get("scaledScores"),
    percentiles: formData.get("percentiles"),
    cutoffPoints: formData.get("cutoffPoints"),
    interpretation: formData.get("interpretation"),
    limitations: formData.get("limitations"),
    implications: formData.get("implications"),
    comparisonNotes: formData.get("comparisonNotes")
  });

  if (!parsed.success) {
    return { message: parsed.error.issues[0]?.message ?? "Datos invalidos.", ok: false };
  }

  const assessment = await getAssessmentOwner(parsed.data.assessmentId, actor.id);

  const expediente = assessment
    ? await assertExpedienteOwner(assessment.expediente_id, actor.id)
    : null;

  if (
    !assessment ||
    !expediente ||
    expediente.status !== "activo" ||
    !["borrador", "analizada"].includes(assessment.status)
  ) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_validate",
      entityType: "psychological_assessments",
      entityId: parsed.data.assessmentId,
      result: "denied",
      context: "audit_assessment_validate_denied"
    });

    return { message: "No puedes validar esta evaluacion.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { error } = await supabaseAdmin
    .from("psychological_assessments")
    .update({
      raw_scores: parsed.data.rawScores,
      scaled_scores: parsed.data.scaledScores,
      percentiles: parsed.data.percentiles,
      cutoff_points: parsed.data.cutoffPoints,
      interpretation: parsed.data.interpretation,
      limitations: parsed.data.limitations,
      implications: parsed.data.implications,
      comparison_notes: parsed.data.comparisonNotes,
      professional_validation_status: "validado",
      validated_by_user_id: actor.id,
      validated_at: new Date().toISOString(),
      status: "validada"
    })
    .eq("id", assessment.id)
    .eq("professional_id", actor.id)
    .in("status", ["borrador", "analizada"]);

  if (error) {
    Sentry.captureException(error, {
      extra: {
        assessment_id: assessment.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "assessment_validate",
      entityType: "psychological_assessments",
      entityId: assessment.id,
      result: "error",
      context: "audit_assessment_validate_error"
    });

    return { message: "No fue posible validar la evaluacion.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "assessment_validate",
    entityType: "psychological_assessments",
    entityId: assessment.id,
    result: "success",
    context: "audit_assessment_validate_success"
  });

  revalidatePath(`/professional/expedientes/${assessment.expediente_id}`);

  return { message: "Evaluacion validada e incorporada al expediente.", ok: true };
}
