"use client";

import { useActionState, useState } from "react";

import { createNotaClinicaAction } from "@/app/notas/actions";
import { ActionMessage } from "@/components/users/action-message";
import { NotaFields } from "@/components/notas/nota-fields";
import {
  DEFAULT_NOTA_TEMPLATE_SECTIONS,
  NOTA_CLINICA_TYPES,
  NOTA_TEMPLATE_MODEL_LABEL,
  NOTA_TEMPLATE_MODEL_TYPES,
  type NotaTemplate,
  type NotaTemplateModelType
} from "@/lib/notas/types";

type CreateNotaFormProps = {
  expedienteId: string;
  templates?: Partial<Record<NotaTemplateModelType, NotaTemplate | null>>;
  initialValues?: Record<string, string | number | boolean | null>;
  disabled?: boolean;
};

const noteTypeLabels: Record<(typeof NOTA_CLINICA_TYPES)[number], string> = {
  sesion: "Sesion",
  interconsulta: "Interconsulta",
  referencia_traslado: "Referencia o traslado",
  egreso: "Egreso"
};

export function CreateNotaForm({
  expedienteId,
  templates = {},
  initialValues,
  disabled = false
}: CreateNotaFormProps) {
  const [state, formAction] = useActionState(createNotaClinicaAction, {});
  const [modelType, setModelType] = useState<NotaTemplateModelType>("general");
  const sections = templates[modelType]?.sections ?? DEFAULT_NOTA_TEMPLATE_SECTIONS;

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-ink/10 bg-white p-5">
      <input type="hidden" name="expedienteId" value={expedienteId} />
      <input type="hidden" name="modelType" value={modelType} />
      <div>
        <h2 className="text-lg font-semibold text-ink">Nueva nota clinica</h2>
        <p className="mt-1 text-sm text-ink/65">
          Se guarda como borrador. Al confirmar, el contenido queda inmutable.
        </p>
      </div>

      <ActionMessage message={state.message} ok={state.ok} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Tipo de nota</span>
          <select
            name="noteType"
            disabled={disabled}
            defaultValue="sesion"
            className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
          >
            {NOTA_CLINICA_TYPES.map((type) => (
              <option key={type} value={type}>
                {noteTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Modelo de plantilla</span>
          <select
            value={modelType}
            disabled={disabled}
            onChange={(event) => setModelType(event.target.value as NotaTemplateModelType)}
            className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
          >
            {NOTA_TEMPLATE_MODEL_TYPES.map((type) => (
              <option key={type} value={type}>
                {NOTA_TEMPLATE_MODEL_LABEL[type]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <NotaFields sections={sections} initialValues={initialValues} disabled={disabled} />

      <p className="rounded-md border border-rojoRompe/30 bg-rojoRompe/10 px-3 py-2 text-sm font-semibold text-rojoRompe">
        Al guardar y confirmar la nota clinica ya no se podra modificar y en caso de requerirlo se
        debera anular y crear una nueva.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="submit"
          name="intent"
          value="draft"
          disabled={disabled}
          className="inline-flex h-11 items-center justify-center rounded-md border border-azulMedio px-4 text-sm font-semibold text-azulMedio transition hover:bg-azulMedio hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Crear borrador
        </button>
        <button
          type="submit"
          name="intent"
          value="confirm"
          disabled={disabled}
          className="inline-flex h-11 items-center justify-center rounded-md bg-azulMedio px-4 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          Guardar y confirmar nota clinica
        </button>
      </div>
    </form>
  );
}
