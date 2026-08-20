"use client";

import { useActionState, useMemo } from "react";

import {
  adminCancelAppointmentAction,
  adminCreateAppointmentAction,
  adminCreateReferralAction,
  adminSendConsentReminderAction,
  adminSendLegalNoticeAction,
  sendSupportMessageAction,
  updateSupportConversationStatusAction
} from "@/app/support/actions";
import { sendPasswordChangeEmailAction } from "@/app/users/actions";
import { SearchablePersonSelect } from "@/components/forms/searchable-person-select";
import { ActionMessage } from "@/components/users/action-message";
import type { SupportCenterDashboard, SupportConversation } from "@/lib/support/types";

function ConversationCard({ conversation }: { conversation: SupportConversation }) {
  const [messageState, messageAction, messagePending] = useActionState(sendSupportMessageAction, {});
  const [statusState, statusAction] = useActionState(updateSupportConversationStatusAction, {});

  return (
    <article className="space-y-4 rounded-lg border border-principal/10 bg-blanco p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-principal">{conversation.participant_name}</p>
          <p className="text-xs text-grisTextos">
            {conversation.participant_role} | {conversation.participant_email}
          </p>
          <p className="mt-1 text-sm text-principal/70">{conversation.subject}</p>
        </div>
        <span className="rounded-md bg-grisMuyClaro px-2 py-1 text-xs font-semibold text-principal">
          {conversation.status}
        </span>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-md bg-grisMuyClaro p-3">
        {conversation.messages.map((message) => (
          <div key={message.id} className="rounded-md bg-blanco p-3 text-sm">
            <div className="flex justify-between gap-3 text-xs text-grisTextos">
              <span className="font-semibold text-principal">{message.sender_name}</span>
              <span>{new Date(message.created_at).toLocaleString("es-MX")}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-principal/80">{message.body}</p>
          </div>
        ))}
      </div>

      <form action={messageAction} className="space-y-2">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <textarea name="body" rows={3} required maxLength={4000} placeholder="Responder o enviar recordatorio operativo..." className="w-full rounded-md border px-3 py-2" />
        <ActionMessage message={messageState.message} ok={messageState.ok} />
        <button disabled={messagePending || conversation.status === "cerrado"} className="rounded-md bg-azulMedio px-3 py-2 text-xs font-semibold text-blanco disabled:opacity-50">
          Responder
        </button>
      </form>

      <form action={statusAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <label>
          <span className="block text-xs font-medium text-principal">Estado</span>
          <select name="status" defaultValue={conversation.status} className="mt-1 rounded-md border px-2 py-2 text-sm">
            <option value="abierto">Abierto</option>
            <option value="resuelto">Resuelto</option>
            <option value="cerrado">Cerrado</option>
          </select>
        </label>
        <button className="rounded-md border border-principal/15 px-3 py-2 text-xs font-semibold text-principal">Actualizar</button>
        <ActionMessage message={statusState.message} ok={statusState.ok} />
      </form>
    </article>
  );
}

function OperationsPanel({ dashboard }: { dashboard: SupportCenterDashboard }) {
  const [appointmentState, appointmentAction] = useActionState(adminCreateAppointmentAction, {});
  const [cancelState, cancelAction] = useActionState(adminCancelAppointmentAction, {});
  const [referralState, referralAction] = useActionState(adminCreateReferralAction, {});
  const [reminderState, reminderAction] = useActionState(adminSendConsentReminderAction, {});
  const [passwordState, passwordAction] = useActionState(sendPasswordChangeEmailAction, {});
  const [legalState, legalAction] = useActionState(adminSendLegalNoticeAction, {});
  const personOptions = useMemo(
    () => [...dashboard.patients, ...dashboard.professionals].map((person) => ({ id: person.id, label: person.label, detail: `${person.role} - ${person.email}` })),
    [dashboard]
  );
  const patientOptions = dashboard.patients.map((person) => ({ id: person.id, label: person.label, detail: person.email }));
  const professionalOptions = dashboard.professionals.map((person) => ({ id: person.id, label: person.label, detail: person.email }));
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const localTime = new Date(today.getTime() + 60 * 60000 - today.getTimezoneOffset() * 60000).toISOString().slice(11, 16);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <form action={appointmentAction} className="space-y-3 rounded-lg border border-principal/10 bg-blanco p-5">
        <h3 className="font-bold text-principal">Agendar cita por apoyo administrativo</h3>
        <SearchablePersonSelect name="patientId" label="Paciente" options={patientOptions} required />
        <SearchablePersonSelect name="professionalId" label="Profesional" options={professionalOptions} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="text-sm font-medium">Fecha</span><input name="scheduledDate" type="date" defaultValue={localDate} required className="mt-2 w-full rounded-md border px-3 py-2" /></label>
          <label><span className="text-sm font-medium">Hora</span><input name="scheduledTime" type="time" defaultValue={localTime} required className="mt-2 w-full rounded-md border px-3 py-2" /></label>
          <label><span className="text-sm font-medium">Duracion</span><input name="durationMinutes" type="number" min={15} max={240} defaultValue={60} className="mt-2 w-full rounded-md border px-3 py-2" /></label>
          <label><span className="text-sm font-medium">Modalidad</span><select name="type" className="mt-2 w-full rounded-md border px-3 py-2"><option value="videollamada">Videollamada</option><option value="presencial">Presencial</option></select></label>
        </div>
        <input type="hidden" name="timezoneOffsetMinutes" value={today.getTimezoneOffset()} />
        <ActionMessage message={appointmentState.message} ok={appointmentState.ok} />
        <button className="rounded-md bg-azulMedio px-4 py-2 text-sm font-semibold text-blanco">Programar cita</button>
      </form>

      <form action={cancelAction} className="space-y-3 rounded-lg border border-principal/10 bg-blanco p-5">
        <h3 className="font-bold text-principal">Cancelar cita</h3>
        <label className="block"><span className="text-sm font-medium">Cita</span><select name="appointmentId" required className="mt-2 w-full rounded-md border px-3 py-2"><option value="">Selecciona una cita</option>{dashboard.appointments.filter((item) => item.status === "programada").map((item) => <option key={item.id} value={item.id}>{new Date(item.scheduled_at).toLocaleString("es-MX")} | {item.patient_name} | {item.professional_name}</option>)}</select></label>
        <label className="block"><span className="text-sm font-medium">Motivo operativo</span><textarea name="reason" required minLength={5} maxLength={1000} rows={3} className="mt-2 w-full rounded-md border px-3 py-2" /></label>
        <ActionMessage message={cancelState.message} ok={cancelState.ok} />
        <button className="rounded-md bg-rojoRompe px-4 py-2 text-sm font-semibold text-blanco">Cancelar cita</button>
      </form>

      <form action={referralAction} className="space-y-3 rounded-lg border border-principal/10 bg-blanco p-5">
        <h3 className="font-bold text-principal">Canalizar paciente</h3>
        <SearchablePersonSelect name="patientId" label="Paciente" options={patientOptions} required />
        <SearchablePersonSelect name="targetProfileId" label="Profesional destino (opcional)" options={professionalOptions} />
        <label className="block"><span className="text-sm font-medium">Tipo de destino</span><input name="targetType" required placeholder="Profesional, servicio u orientacion" className="mt-2 w-full rounded-md border px-3 py-2" /></label>
        <label className="block"><span className="text-sm font-medium">Nota operativa, sin datos clinicos</span><textarea name="operationalNote" required maxLength={1000} rows={3} className="mt-2 w-full rounded-md border px-3 py-2" /></label>
        <ActionMessage message={referralState.message} ok={referralState.ok} />
        <button className="rounded-md bg-azulMedio px-4 py-2 text-sm font-semibold text-blanco">Registrar canalizacion</button>
      </form>

      <section className="space-y-5 rounded-lg border border-principal/10 bg-blanco p-5">
        <h3 className="font-bold text-principal">Correos de apoyo</h3>
        <form action={reminderAction} className="space-y-3">
          <SearchablePersonSelect name="patientId" label="Recordar consentimiento a paciente" options={patientOptions} required />
          <ActionMessage message={reminderState.message} ok={reminderState.ok} />
          <button className="rounded-md bg-azulMedio px-3 py-2 text-sm font-semibold text-blanco">Enviar recordatorio</button>
        </form>
        <form action={passwordAction} className="space-y-3 border-t border-principal/10 pt-4">
          <SearchablePersonSelect name="userId" label="Enviar cambio de contrasena" options={personOptions} required />
          <ActionMessage message={passwordState.message} ok={passwordState.ok} />
          <button className="rounded-md border border-principal/15 px-3 py-2 text-sm font-semibold text-principal">Enviar enlace seguro</button>
        </form>
        <form action={legalAction} className="space-y-3 border-t border-principal/10 pt-4">
          <SearchablePersonSelect name="userId" label="Reenviar aviso legal u operativo" options={personOptions} required />
          <select name="noticeType" className="w-full rounded-md border px-3 py-2 text-sm">
            <option value="documento_legal">Documento legal disponible</option>
            <option value="recordatorio_operativo">Recordatorio operativo</option>
          </select>
          <textarea name="message" required minLength={5} maxLength={500} rows={3} placeholder="Describe el aviso sin incluir datos clinicos." className="w-full rounded-md border px-3 py-2" />
          <ActionMessage message={legalState.message} ok={legalState.ok} />
          <button className="rounded-md border border-principal/15 px-3 py-2 text-sm font-semibold text-principal">Enviar aviso</button>
        </form>
      </section>
    </div>
  );
}

export function AdminSupportCenter({ dashboard }: { dashboard: SupportCenterDashboard }) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-xl font-bold text-principal">Conversaciones</h2>
        <p className="mt-1 text-sm text-principal/65">Canales operativos separados para pacientes y profesionales. No contienen contenido clinico.</p>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {dashboard.conversations.map((conversation) => <ConversationCard key={conversation.id} conversation={conversation} />)}
          {dashboard.conversations.length === 0 ? <p className="rounded-lg bg-grisMuyClaro p-5 text-sm text-grisTextos">No hay conversaciones abiertas.</p> : null}
        </div>
      </section>
      <section>
        <h2 className="text-xl font-bold text-principal">Operaciones de apoyo</h2>
        <p className="mt-1 text-sm text-principal/65">Todas las acciones quedan auditadas por usuario, fecha y entidad.</p>
        <div className="mt-4"><OperationsPanel dashboard={dashboard} /></div>
      </section>
    </div>
  );
}
