"use client";

import { useActionState } from "react";

import { updateProcesoStepAction } from "@/app/procesos/actions";
import { AiStepDraftForm } from "@/components/procesos/ai-step-draft-form";
import { SubmitButton } from "@/components/auth/submit-button";
import { ActionMessage } from "@/components/users/action-message";
import type { ProcessTemplateField, ProcessTemplateStep, ProcesoDetail } from "@/lib/procesos/types";

type ProcessStepFormProps = {
  process: ProcesoDetail;
  step: ProcessTemplateStep;
};

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function FieldInput({
  field,
  value,
  disabled
}: {
  field: ProcessTemplateField;
  value: string | number | boolean | null | undefined;
  disabled: boolean;
}) {
  const name = `field_${field.id}`;
  const baseClass =
    "mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20";
  const currentValue =
    value ??
    (field.type === "date"
      ? toLocalDateInputValue(new Date())
      : "");

  if (field.type === "textarea") {
    return (
      <textarea
        name={name}
        rows={4}
        disabled={disabled}
        defaultValue={typeof currentValue === "string" ? currentValue : ""}
        className={baseClass}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select name={name} disabled={disabled} defaultValue={String(value ?? "")} className={baseClass}>
        <option value="">Seleccionar</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <input
        type="checkbox"
        name={name}
        disabled={disabled}
        defaultChecked={value === true || value === "true"}
        className="mt-3 h-4 w-4 rounded border-ink/20 text-azulMedio focus:ring-azulMedio"
      />
    );
  }

  return (
    <input
      type={field.type}
      name={name}
      disabled={disabled}
      defaultValue={String(currentValue)}
      className={baseClass}
    />
  );
}

export function ProcessStepForm({ process, step }: ProcessStepFormProps) {
  const [state, formAction] = useActionState(updateProcesoStepAction, {});
  const disabled = process.status !== "activo";
  const values = process.step_data?.[step.id] ?? {};
  const instructions = process.gpt_instructions?.[step.id] ?? "";

  return (
    <section className="space-y-4 rounded-lg border border-ink/10 bg-white p-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="processId" value={process.id} />
        <input type="hidden" name="stepId" value={step.id} />

        <div>
          <h2 className="text-lg font-semibold text-ink">{step.title}</h2>
          {step.description ? <p className="mt-1 text-sm text-ink/65">{step.description}</p> : null}
        </div>

        <ActionMessage message={state.message} ok={state.ok} />

        <div className="grid gap-4 md:grid-cols-2">
          {step.fields.map((field) => (
            <label key={field.id} className={field.type === "textarea" ? "block md:col-span-2" : "block"}>
              <span className="text-sm font-medium text-ink">{field.label}</span>
              <FieldInput field={field} value={values[field.id]} disabled={disabled} />
            </label>
          ))}
        </div>

        <label className="block">
          <span className="text-sm font-medium text-ink">Instrucciones para GPT-007</span>
          <textarea
            name="gptInstructions"
            rows={3}
            disabled={disabled}
            defaultValue={instructions}
            className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="completed"
            disabled={disabled}
            defaultChecked={values.completed === true}
          />
          Marcar paso como completado
        </label>

        <SubmitButton disabled={disabled}>Guardar paso</SubmitButton>
      </form>

      <AiStepDraftForm
        processId={process.id}
        stepId={step.id}
        disabled={disabled || !process.ai_conceptualization_enabled}
        disabledReason={
          !process.ai_conceptualization_enabled
            ? "Activa la asistencia de IA en la configuracion de reconceptualizacion para usar esta funcion."
            : undefined
        }
      />
    </section>
  );
}
