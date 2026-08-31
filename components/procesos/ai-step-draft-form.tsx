"use client";

import { useActionState } from "react";

import { requestStepAiDraftAction } from "@/app/ai/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { ActionMessage } from "@/components/users/action-message";

type AiStepDraftFormProps = {
  processId: string;
  stepId: string;
  disabled: boolean;
  disabledReason?: string;
};

export function AiStepDraftForm({
  processId,
  stepId,
  disabled,
  disabledReason
}: AiStepDraftFormProps) {
  const [state, formAction] = useActionState(requestStepAiDraftAction, {});

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-azulMedio/20 bg-azulMedio/5 p-4">
      <input type="hidden" name="processId" value={processId} />
      <input type="hidden" name="stepId" value={stepId} />

      <div>
        <h3 className="text-sm font-semibold text-ink">Generar previo asistido por IA</h3>
        <p className="mt-1 text-xs text-ink/60">
          La sugerencia no se guarda automaticamente. Revisala y copia solo lo que decidas usar.
        </p>
        {disabledReason ? (
          <p className="mt-2 text-xs font-semibold text-principal/65">{disabledReason}</p>
        ) : null}
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">Directrices clinicas</span>
        <textarea
          name="directives"
          rows={3}
          disabled={disabled}
          className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        />
      </label>

      <ActionMessage message={state.message} ok={state.ok} />

      {state.suggestion ? (
        <div className="rounded-md border border-ink/10 bg-white p-3">
          <p className="text-xs font-semibold uppercase text-ink/50">Sugerencia</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{state.suggestion}</pre>
        </div>
      ) : null}

      <SubmitButton disabled={disabled}>Generar previo</SubmitButton>
    </form>
  );
}
