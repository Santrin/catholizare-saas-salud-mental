"use client";

import { useActionState, useState } from "react";

import { createAppointmentAction } from "@/app/agenda/actions";
import { SubmitButton } from "@/components/auth/submit-button";
import { SearchablePersonSelect } from "@/components/forms/searchable-person-select";
import { ActionMessage } from "@/components/users/action-message";
import { APPOINTMENT_TYPES, type AgendaPatientOption, type AppointmentType } from "@/lib/agenda/types";

type CreateAppointmentFormProps = {
  patients: AgendaPatientOption[];
  embedded?: boolean;
};

function toLocalDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function CreateAppointmentForm({ patients, embedded = false }: CreateAppointmentFormProps) {
  const [state, formAction] = useActionState(createAppointmentAction, {});
  const [appointmentType, setAppointmentType] = useState<AppointmentType>("presencial");
  const now = new Date();
  const defaultDate = toLocalDateInputValue(now);
  const defaultTime = now.toTimeString().slice(0, 5);
  const timezoneOffsetMinutes = new Date().getTimezoneOffset();

  return (
    <form
      action={formAction}
      className={embedded ? "space-y-4" : "space-y-4 rounded-lg border border-ink/10 bg-white p-5"}
    >
      <input type="hidden" name="timezoneOffsetMinutes" value={timezoneOffsetMinutes} />

      <div>
        <h2 className="text-lg font-semibold text-ink">Programar cita</h2>
        <p className="mt-1 text-sm text-ink/65">
          Selecciona un Paciente con expediente activo.
        </p>
      </div>

      <ActionMessage message={state.message} ok={state.ok} />

      <div className="rounded-md border border-azulMedio/20 bg-azulMedio/5 p-3 text-sm leading-6 text-ink/70">
        Si conectas tu cuenta de Google Calendar, las citas que agregues aqui se sincronizaran en tu
        calendario automaticamente.
      </div>

      <SearchablePersonSelect
        name="patientId"
        label="Paciente"
        options={patients.map((patient) => ({
          id: patient.id,
          label: patient.full_name,
          detail: patient.email
        }))}
        placeholder="Buscar paciente por nombre..."
        emptyHint="Selecciona un paciente de la lista."
        required
        disabled={patients.length === 0}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Fecha</span>
          <input
            name="scheduledDate"
            type="date"
            required
            defaultValue={defaultDate}
            className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Hora</span>
          <input
            name="scheduledTime"
            type="time"
            required
            defaultValue={defaultTime}
            className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Duracion</span>
          <select
            name="durationMinutes"
            defaultValue="50"
            className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
          >
            <option value="30">30 minutos</option>
            <option value="50">50 minutos</option>
            <option value="60">60 minutos</option>
            <option value="90">90 minutos</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Tipo</span>
          <select
            name="type"
            value={appointmentType}
            onChange={(event) => setAppointmentType(event.target.value as AppointmentType)}
            className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
          >
            {APPOINTMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      </div>

      {appointmentType === "videollamada" ? (
        <div className="rounded-md border border-rojoRompe/30 bg-rojoRompe/10 p-3 text-sm leading-6 text-ink/75">
          Si no has conectado tu cuenta de Zoom, la sesion no se creara automaticamente. Puedes
          conectarla para crear la liga de forma automatica o agendar la cita ahora y crear la liga
          por tu cuenta.
        </div>
      ) : null}

      <SubmitButton disabled={patients.length === 0}>Crear cita</SubmitButton>
    </form>
  );
}
