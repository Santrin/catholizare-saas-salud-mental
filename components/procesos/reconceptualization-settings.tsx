"use client";

import { useActionState } from "react";

import { updateReconceptualizationSettingsAction } from "@/app/procesos/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { ActionMessage } from "@/components/users/action-message";
import type { ProcesoDetail } from "@/lib/procesos/types";

const INTERVALS = [
  { value: "none", label: "Ninguno" },
  { value: "4", label: "4" },
  { value: "8", label: "8" },
  { value: "10", label: "10" },
  { value: "12", label: "12" }
] as const;

export function ReconceptualizationSettings({ process }: { process: ProcesoDetail }) {
  const [state, formAction] = useActionState(updateReconceptualizationSettingsAction, {});
  const selectedInterval = process.reconceptualization_interval?.toString() ?? "none";

  return (
    <form action={formAction} className="border border-principal/10 bg-blanco p-5">
      <input type="hidden" name="processId" value={process.id} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
        <fieldset>
          <legend className="font-bold text-principal">Reconceptualizar caso en bloques de:</legend>
          <p className="mt-1 text-sm text-principal/55">Selecciona el numero de sesiones por bloque.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {INTERVALS.map((interval) => (
              <label key={interval.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="interval"
                  value={interval.value}
                  defaultChecked={selectedInterval === interval.value}
                  className="peer sr-only"
                />
                <span className="inline-flex min-h-10 items-center border border-principal/15 bg-blanco px-4 text-sm font-bold text-principal transition peer-checked:border-enfasis peer-checked:bg-enfasis/20">
                  {interval.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="font-bold text-principal">Apoyo de inteligencia artificial</legend>
          <label className="flex items-start gap-3 text-sm leading-5 text-principal/75">
            <input
              type="checkbox"
              name="aiConceptualization"
              defaultChecked={process.ai_conceptualization_enabled}
              className="mt-1 h-4 w-4"
            />
            Usar inteligencia artificial para la conceptualizacion del caso
          </label>
          <label className="flex items-start gap-3 text-sm leading-5 text-principal/75">
            <input
              type="checkbox"
              name="aiNextBlockPlan"
              defaultChecked={process.ai_next_block_plan_enabled}
              className="mt-1 h-4 w-4"
            />
            Usar inteligencia artificial para generar el plan del siguiente bloque de sesiones
          </label>
        </fieldset>
      </div>
      <div className="mt-5 max-w-56">
        <SubmitButton disabled={process.status !== "activo"}>Guardar configuracion</SubmitButton>
      </div>
      <div className="mt-3"><ActionMessage message={state.message} ok={state.ok} /></div>
    </form>
  );
}
