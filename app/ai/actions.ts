"use server";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { getCurrentProfile } from "@/lib/auth/profile";
import { safeWriteAuditLog } from "@/lib/audit/safe";
import { generateClinicalDraft } from "@/lib/ai/openai";
import type { ClinicalContextPackage } from "@/lib/ai/types";
import { anonymizeLifeHistoryAnswers } from "@/lib/life-history/anonymize";
import type { LifeHistoryAnswers } from "@/lib/life-history/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ProcessTemplateStep, ProcesoTerapeutico } from "@/lib/procesos/types";

type AiActionState = {
  message?: string;
  ok?: boolean;
  suggestion?: string;
  aiSessionId?: string;
};

const stepDraftSchema = z.object({
  processId: z.string().uuid(),
  stepId: z.string().trim().min(1),
  directives: z.string().trim().min(10).max(4000)
});

async function getActiveProfessional() {
  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "profesional" || profile.account_status !== "activo") {
    return null;
  }

  return profile;
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

async function buildStepContextPackage(
  process: ProcesoTerapeutico,
  step: ProcessTemplateStep
): Promise<ClinicalContextPackage> {
  const supabaseAdmin = createSupabaseAdminClient();
  const stepValues = process.step_data?.[step.id] ?? {};
  const [{ data: lifeHistory }, { data: assessments }, { data: assessmentUploads }] =
    await Promise.all([
      supabaseAdmin
        .from("patient_life_histories")
        .select("status, answers, submitted_at")
        .eq("expediente_id", process.expediente_id)
        .in("status", ["enviada", "reabierta"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("psychological_assessments")
        .select("id, assessment_type, status, applied_at, raw_scores, scaled_scores, percentiles, cutoff_points, interpretation")
        .eq("expediente_id", process.expediente_id)
        .in("status", ["analizada", "validada"])
        .order("applied_at", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("patient_assessment_uploads")
        .select("id, assessment_code, status, extracted_results")
        .eq("expediente_id", process.expediente_id)
        .in("status", ["analizada", "vinculada"])
        .order("created_at", { ascending: false })
        .limit(6)
    ]);
  const lifeHistoryContext = lifeHistory
    ? {
        status: lifeHistory.status as string,
        submitted_at: lifeHistory.submitted_at as string | null,
        answers: anonymizeLifeHistoryAnswers((lifeHistory.answers ?? {}) as LifeHistoryAnswers)
      }
    : undefined;
  const assessmentSummary = [
    ...((assessments ?? []) as Array<{
      id: string;
      assessment_type: string;
      status: string;
      applied_at: string | null;
      raw_scores: Record<string, unknown> | null;
      scaled_scores: Record<string, unknown> | null;
      percentiles: Record<string, unknown> | null;
      cutoff_points: Record<string, unknown> | null;
      interpretation: string | null;
    }>).map((assessment) => ({
      id: assessment.id,
      type: assessment.assessment_type,
      status: assessment.status,
      applied_at: assessment.applied_at,
      scores: {
        raw_scores: assessment.raw_scores,
        scaled_scores: assessment.scaled_scores,
        percentiles: assessment.percentiles,
        cutoff_points: assessment.cutoff_points
      },
      interpretation_available: Boolean(assessment.interpretation)
    })),
    ...((assessmentUploads ?? []) as Array<{
      id: string;
      assessment_code: string;
      status: string;
      extracted_results: Record<string, unknown> | null;
    }>).map((upload) => ({
      id: upload.id,
      type: upload.assessment_code,
      status: upload.status,
      scores: upload.extracted_results,
      interpretation_available: false
    }))
  ].slice(0, 8);

  return {
    task: "prellenado_paso",
    process: {
      id: process.id,
      model_type: process.model_type,
      status: process.status
    },
    step: {
      id: step.id,
      title: step.title,
      description: step.description,
      completed: stepValues.completed === true,
      fields: step.fields.map((field) => ({
        id: field.id,
        label: field.label,
        current_value: stepValues[field.id] ?? null
      }))
    },
    previous_steps: process.template_snapshot.steps
      .filter((candidate) => candidate.id !== step.id)
      .map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        completed: process.step_data?.[candidate.id]?.completed === true
      })),
    ...(lifeHistoryContext ? { life_history: lifeHistoryContext } : {}),
    ...(assessmentSummary.length > 0 ? { assessment_summary: assessmentSummary } : {})
  };
}

export async function requestStepAiDraftAction(
  _previousState: AiActionState,
  formData: FormData
): Promise<AiActionState> {
  const actor = await getActiveProfessional();

  if (!actor) {
    return { message: "No tienes una sesion profesional activa.", ok: false };
  }

  const parsed = stepDraftSchema.safeParse({
    processId: formData.get("processId"),
    stepId: formData.get("stepId"),
    directives: formData.get("directives")
  });

  if (!parsed.success) {
    return {
      message: "Agrega directrices clinicas de al menos 10 caracteres.",
      ok: false
    };
  }

  const process = await assertProcessOwner(parsed.data.processId, actor.id);

  if (!process || process.status !== "activo" || !process.ai_conceptualization_enabled) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "ai_request",
      entityType: "ai_sessions",
      result: "denied",
      metadata: {
        function_type: "prellenado_paso"
      },
      context: "audit_ai_step_draft_denied_process"
    });

    return {
      message: "Activa la asistencia de IA en la configuracion de reconceptualizacion del proceso.",
      ok: false
    };
  }

  const step = process.template_snapshot.steps.find((item) => item.id === parsed.data.stepId);

  if (!step) {
    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "ai_request",
      entityType: "ai_sessions",
      entityId: process.id,
      result: "denied",
      metadata: {
        function_type: "prellenado_paso",
        process_id: process.id,
        step_id: parsed.data.stepId
      },
      context: "audit_ai_step_draft_denied_step"
    });

    return { message: "El paso del proceso no existe.", ok: false };
  }

  const contextPackage = await buildStepContextPackage(process, step);

  let draft;

  try {
    draft = await generateClinicalDraft({
      contextPackage,
      directives: parsed.data.directives
    });
  } catch (error) {
    Sentry.captureException(error, {
      extra: {
        process_id: process.id,
        step_id: step.id,
        function_type: "prellenado_paso"
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "ai_request",
      entityType: "ai_sessions",
      entityId: process.id,
      result: "error",
      metadata: {
        function_type: "prellenado_paso"
      },
      context: "audit_ai_step_draft_error"
    });

    return { message: "No fue posible generar el borrador con IA.", ok: false };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: aiSession, error: sessionError } = await supabaseAdmin
    .from("ai_sessions")
    .insert({
      professional_id: actor.id,
      patient_id: process.patient_id,
      expediente_id: process.expediente_id,
      process_id: process.id,
      step_id: step.id,
      ai_function_type: "prellenado_paso",
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
        process_id: process.id,
        step_id: step.id
      }
    });

    await safeWriteAuditLog({
      userId: actor.id,
      role: actor.role,
      action: "ai_request",
      entityType: "ai_sessions",
      entityId: process.id,
      result: "error",
      metadata: {
        function_type: "prellenado_paso"
      },
      context: "audit_ai_step_draft_session_insert_error"
    });

    return { message: "El borrador se genero, pero no pudo registrarse la sesion de IA.", ok: false };
  }

  await safeWriteAuditLog({
    userId: actor.id,
    role: actor.role,
    action: "ai_request",
    entityType: "ai_sessions",
    entityId: aiSession.id,
    result: "success",
    metadata: {
      function_type: "prellenado_paso",
      process_id: process.id,
      step_id: step.id
    },
    context: "audit_ai_step_draft_success"
  });

  return {
    message: "Borrador generado. Revisalo antes de copiarlo o guardarlo.",
    ok: true,
    suggestion: draft.content,
    aiSessionId: aiSession.id
  };
}
