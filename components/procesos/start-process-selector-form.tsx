"use client";

import { useActionState } from "react";

import { startGeneralProcessAction } from "@/app/procesos/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { ActionMessage } from "@/components/users/action-message";
import { PROCESS_MODEL_LABEL, PROCESS_MODEL_TYPES } from "@/lib/procesos/types";

type StartProcessSelectorFormProps = {
  expedientes: Array<{
    id: string;
    status: string;
    patient: {
      full_name: string;
      email: string;
    };
  }>;
  embedded?: boolean;
};

export function StartProcessSelectorForm({
  expedientes,
  embedded = false
}: StartProcessSelectorFormProps) {
  const [state, formAction] = useActionState(startGeneralProcessAction, {});
  const activeExpedientes = expedientes.filter((expediente) => expediente.status === "activo");

  return (
    <form
      action={formAction}
      className={embedded ? "space-y-4" : "space-y-4 rounded-lg border border-ink/10 bg-white p-5"}
    >
      <div>
        <h2 className="text-lg font-semibold text-ink">Iniciar proceso</h2>
        <p className="mt-1 text-sm text-ink/65">
          Selecciona un expediente activo. Solo puede existir un proceso activo por Paciente y
          Profesional.
        </p>
      </div>

      <ActionMessage message={state.message} ok={state.ok} />

      <label className="block">
        <span className="text-sm font-medium text-ink">Expediente</span>
        <select
          name="expedienteId"
          disabled={activeExpedientes.length === 0}
          className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        >
          <option value="">Seleccionar expediente</option>
          {activeExpedientes.map((expediente) => (
            <option key={expediente.id} value={expediente.id}>
              {expediente.patient.full_name} - {expediente.patient.email}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Enfoque terapeutico</span>
        <select
          name="modelType"
          disabled={activeExpedientes.length === 0}
          className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        >
          {PROCESS_MODEL_TYPES.map((modelType) => (
            <option key={modelType} value={modelType}>
              {PROCESS_MODEL_LABEL[modelType]}
            </option>
          ))}
        </select>
      </label>

      <SubmitButton disabled={activeExpedientes.length === 0}>Iniciar proceso</SubmitButton>
    </form>
  );
}
