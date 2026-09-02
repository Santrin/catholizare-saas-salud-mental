"use client";

import { useActionState, useMemo, useState } from "react";

import { requestProfessionalExportAction } from "@/app/data-export/actions";
import { SubmitButton } from "@/components/auth/submit-button";

const initialState = {
  message: "",
  ok: false
};

export function ProfessionalExportRequestForm() {
  const [state, formAction] = useActionState(requestProfessionalExportAction, initialState);
  const [confirmationStep, setConfirmationStep] = useState(0);
  const confirmationText = useMemo(() => {
    if (confirmationStep === 0) {
      return "Solicitar revision";
    }

    if (confirmationStep === 1) {
      return "Entiendo que Super Admin revisara esta solicitud";
    }

    return "Confirmar y enviar solicitud delicada";
  }, [confirmationStep]);

  return (
    <form action={formAction} className="rounded-lg border border-ink/10 bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">Solicitar descarga total</h2>
      <p className="mt-2 text-sm leading-6 text-ink/65">
        Esta solicitud sera revisada por Super Admin. La descarga requiere aceptacion legal
        posterior y queda auditada.
      </p>

      <label className="mt-4 block text-sm font-medium text-ink">
        Motivo de la solicitud
        <textarea
          name="reason"
          rows={5}
          minLength={10}
          maxLength={2000}
          required
          className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 text-sm"
        />
      </label>

      <div className="mt-4 space-y-3">
        {confirmationStep > 0 ? (
          <div className="rounded-md border border-gold/30 bg-gold/10 p-3 text-sm leading-6 text-ink">
            <p className="font-semibold text-principal">
              Confirmacion {confirmationStep} de 2
            </p>
            <p className="mt-1">
              Esta solicitud puede habilitar una descarga total de expedientes y archivos
              clinicos. Debe existir una razon operativa o legal clara, sera revisada por Super
              Admin y posteriormente tendras que firmar una aceptacion de responsabilidad.
            </p>
          </div>
        ) : null}

        {confirmationStep < 2 ? (
          <button
            type="button"
            onClick={() => setConfirmationStep((step) => step + 1)}
            className="inline-flex min-h-11 items-center rounded-md bg-principal px-4 text-sm font-bold text-blanco transition hover:bg-secundario"
          >
            {confirmationText}
          </button>
        ) : (
          <SubmitButton>{confirmationText}</SubmitButton>
        )}
      </div>
      {state.message ? (
        <p className={`mt-3 text-sm ${state.ok ? "text-azulMedio" : "text-rojoRompe"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
