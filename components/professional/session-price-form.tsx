"use client";

import { useActionState } from "react";

import {
  updateDashboardSessionPriceAction,
  type DashboardSettingsActionState
} from "@/app/professional/dashboard-actions";
import { ActionMessage } from "@/components/users/action-message";
import { SubmitButton } from "@/components/auth/submit-button";

type SessionPriceFormProps = {
  sessionPriceCents: number;
};

const initialState: DashboardSettingsActionState = {};

export function SessionPriceForm({ sessionPriceCents }: SessionPriceFormProps) {
  const [state, formAction] = useActionState(updateDashboardSessionPriceAction, initialState);

  return (
    <form action={formAction} className="border-t border-principal/10 pt-4">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-principal/55">
          Tarifa por sesion
        </span>
        <div className="mt-2 flex gap-2">
          <span className="flex h-10 items-center border border-principal/15 bg-grisMuyClaro px-3 text-sm text-principal/60">
            MXN $
          </span>
          <input
            name="sessionPrice"
            type="number"
            min="0"
            max="1000000"
            step="0.01"
            defaultValue={(sessionPriceCents / 100).toFixed(2)}
            className="h-10 min-w-0 flex-1 border border-principal/15 bg-blanco px-3 text-sm outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
            aria-label="Tarifa por sesion en pesos mexicanos"
          />
          <SubmitButton>Guardar</SubmitButton>
        </div>
      </label>
      <div className="mt-2">
        <ActionMessage message={state.message} ok={state.ok} />
      </div>
      <p className="mt-2 text-xs leading-5 text-principal/50">
        Se usa solo para estimar el acumulado de citas completadas. No sustituye facturacion.
      </p>
    </form>
  );
}
