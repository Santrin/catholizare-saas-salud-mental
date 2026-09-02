import Link from "next/link";

import { CreateNotaForm } from "@/components/notas/create-nota-form";
import { requireRole } from "@/lib/auth/profile";
import { getAppointmentDetail } from "@/lib/agenda/queries";
import { getLatestNotaTemplate } from "@/lib/notas/queries";

type AppointmentDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function appointmentDateInputValue(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function appointmentTimeInputValue(value: string) {
  return new Date(value).toTimeString().slice(0, 5);
}

export default async function AppointmentDetailPage({ params }: AppointmentDetailPageProps) {
  const [{ id }, profile] = await Promise.all([params, requireRole(["profesional"])]);
  const [detail, generalNoteTemplate, tccNoteTemplate] = await Promise.all([
    getAppointmentDetail(profile, id),
    getLatestNotaTemplate(profile, "general"),
    getLatestNotaTemplate(profile, "tcc")
  ]);

  if (!detail) {
    return (
      <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
        <div className="mx-auto max-w-4xl rounded-lg border border-ink/10 bg-white p-5">
          <h1 className="text-xl font-semibold text-ink">Cita no disponible</h1>
          <Link
            href="/professional/agenda"
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-principal px-4 text-sm font-bold text-blanco transition hover:bg-secundario"
          >
            Volver a agenda
          </Link>
        </div>
      </main>
    );
  }

  const { appointment, expediente, notes } = detail;
  const canCreateNote =
    appointment.status === "programada" &&
    expediente?.status === "activo" &&
    ["firmado_fisico", "firmado_digital", "excepcion_justificada"].includes(
      expediente.consent_status
    );

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Agenda
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">Detalle de cita</h1>
            <p className="mt-2 text-sm text-ink/65">
              {appointment.patient.full_name} - {formatDate(appointment.scheduled_at)}
            </p>
          </div>
          <Link
            href="/professional/agenda"
            className="inline-flex min-h-10 items-center rounded-md bg-principal px-4 text-sm font-bold text-blanco transition hover:bg-secundario"
          >
            Volver a agenda
          </Link>
        </div>

        <section className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-bold text-principal">Informacion de la cita</h2>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-ink/55">Estado</dt>
              <dd className="font-medium text-ink">{appointment.status}</dd>
            </div>
            <div>
              <dt className="text-ink/55">Tipo</dt>
              <dd className="font-medium text-ink">{appointment.type}</dd>
            </div>
            <div>
              <dt className="text-ink/55">Duracion</dt>
              <dd className="font-medium text-ink">{appointment.duration_minutes} min</dd>
            </div>
            <div>
              <dt className="text-ink/55">Notas relacionadas</dt>
              <dd className="font-medium text-ink">{notes.length}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-ink/55">Link de videollamada</dt>
              <dd className="mt-2">
                {appointment.zoom_start_url ? (
                  <a
                    href={appointment.zoom_start_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center rounded-md bg-azulMedio px-4 text-sm font-bold text-blanco transition hover:bg-principal"
                  >
                    Iniciar videollamada
                  </a>
                ) : appointment.zoom_join_url ? (
                  <a
                    href={appointment.zoom_join_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-10 items-center rounded-md border border-azulMedio px-4 text-sm font-bold text-azulMedio transition hover:bg-azulMedio hover:text-blanco"
                  >
                    Abrir videollamada
                  </a>
                ) : appointment.type === "videollamada" ? (
                  <span className="text-sm text-rojoRompe">
                    Esta cita es por videollamada, pero aun no tiene link registrado.
                  </span>
                ) : (
                  <span className="text-sm text-ink/55">No aplica para cita presencial.</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-principal">Nota clinica de esta sesion</h2>
              <p className="mt-1 text-sm leading-6 text-ink/65">
                Puedes comenzar una nota clinica desde esta cita. Se precargan la fecha y hora de
                la sesion para mantenerla relacionada con el historial de agenda.
              </p>
            </div>
            {expediente ? (
              <Link
                href={`/professional/expedientes/${expediente.id}#notas`}
                className="text-sm font-medium text-azulMedio"
              >
                Abrir en expediente
              </Link>
            ) : null}
          </div>

          {expediente ? (
            <div className="mt-4">
              <CreateNotaForm
                expedienteId={expediente.id}
                templates={{
                  general: generalNoteTemplate,
                  tcc: tccNoteTemplate
                }}
                initialValues={{
                  session_date: appointmentDateInputValue(appointment.scheduled_at),
                  session_time: appointmentTimeInputValue(appointment.scheduled_at)
                }}
                disabled={!canCreateNote}
              />
              {!canCreateNote ? (
                <p className="mt-3 rounded-md border border-gold/30 bg-gold/10 px-3 py-2 text-sm text-ink">
                  Para crear la nota desde esta cita se requiere expediente activo, cita programada
                  y consentimiento informado firmado o excepcion justificada.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-rojoRompe/30 bg-rojoRompe/10 px-3 py-2 text-sm text-ink">
              No se encontro un expediente activo para crear la nota de esta cita.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-bold text-principal">Notas clinicas del dia</h2>
          <div className="mt-4 divide-y divide-ink/10">
            {notes.map((note) => (
              <article key={note.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{note.note_type}</h3>
                    <p className="mt-1 text-sm text-ink/60">
                      {note.status} - {new Date(note.session_date).toLocaleDateString("es-MX")}
                    </p>
                    <p className="mt-2 text-sm text-ink/70">
                      {note.clinical_summary ?? "Sin resumen clinico."}
                    </p>
                  </div>
                  <Link href={`/professional/notas/${note.id}`} className="text-sm font-medium text-azulMedio">
                    Abrir nota
                  </Link>
                </div>
              </article>
            ))}

            {notes.length === 0 ? (
              <p className="text-sm text-ink/65">
                No hay notas clinicas asociadas a esta cita o a este dia.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
