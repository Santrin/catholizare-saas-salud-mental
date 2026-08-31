import Link from "next/link";

import { SessionPriceForm } from "@/components/professional/session-price-form";
import type { ProfessionalDashboardMetrics } from "@/lib/professional/dashboard";

type ProfessionalDashboardMetricsProps = {
  metrics: ProfessionalDashboardMetrics;
};

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN"
});

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeZone: "America/Mexico_City"
  }).format(new Date(value));
}

export function ProfessionalDashboardMetricsPanel({ metrics }: ProfessionalDashboardMetricsProps) {
  return (
    <section aria-labelledby="professional-metrics-title">
      <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">Resumen de tu practica</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="professional-metrics-title" className="text-2xl font-bold text-principal">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-principal/60">Indicadores operativos para tomar decisiones rapidamente.</p>
        </div>
        <Link href="/professional/agenda" className="text-sm font-bold text-azulMedio hover:text-secundario">
          Abrir agenda
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="border-l-4 border-enfasis bg-blanco p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-principal/50">Proximas citas</p>
          <p className="mt-3 text-3xl font-bold text-principal">{metrics.upcomingAppointmentsCount}</p>
          <p className="mt-1 text-sm text-principal/60">Citas programadas pendientes</p>
        </article>
        <article className="border-l-4 border-azulMedio bg-blanco p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-principal/50">Pacientes activos</p>
          <p className="mt-3 text-3xl font-bold text-principal">{metrics.activePatients.length}</p>
          <p className="mt-1 text-sm text-principal/60">Con expediente activo</p>
        </article>
        <article className="border-l-4 border-rojoRompe bg-blanco p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-principal/50">Cancelaciones</p>
          <p className="mt-3 text-3xl font-bold text-principal">{metrics.cancellationsThisMonth}</p>
          <p className="mt-1 text-sm capitalize text-principal/60">Durante {metrics.monthLabel}</p>
        </article>
        <article className="bg-principal p-5 text-blanco shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blanco/60">Acumulado del mes</p>
          <p className="mt-3 text-2xl font-bold">
            {moneyFormatter.format(metrics.estimatedRevenueCents / 100)}
          </p>
          <p className="mt-1 text-sm text-blanco/70">
            {metrics.completedSessionsThisMonth} sesiones completadas
          </p>
        </article>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <article className="border border-principal/10 bg-blanco p-5">
          <h3 className="font-bold text-principal">Proximas citas</h3>
          <div className="mt-4 space-y-3">
            {metrics.upcomingAppointments.map((appointment) => (
              <Link
                key={appointment.id}
                href={`/professional/agenda/${appointment.id}`}
                className="block border-b border-principal/10 pb-3 last:border-0 last:pb-0"
              >
                <p className="text-sm font-bold text-principal">{appointment.patient.fullName}</p>
                <p className="mt-1 text-xs text-principal/55">
                  {formatDateTime(appointment.scheduledAt)} · {appointment.type}
                </p>
              </Link>
            ))}
            {metrics.upcomingAppointments.length === 0 ? (
              <p className="text-sm text-principal/55">No hay citas proximas programadas.</p>
            ) : null}
          </div>
        </article>

        <article className="border border-principal/10 bg-blanco p-5">
          <h3 className="font-bold text-principal">Ultimas notas clinicas</h3>
          <div className="mt-4 space-y-3">
            {metrics.recentNotes.map((note) => (
              <Link
                key={note.id}
                href={`/professional/notas/${note.id}`}
                className="block border-b border-principal/10 pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-principal">{note.patient.fullName}</p>
                  <span className="text-xs font-semibold text-azulMedio">{note.status}</span>
                </div>
                <p className="mt-1 text-xs text-principal/55">
                  {formatDate(note.sessionDate)} · {note.noteType}
                </p>
              </Link>
            ))}
            {metrics.recentNotes.length === 0 ? (
              <p className="text-sm text-principal/55">Aun no hay notas clinicas.</p>
            ) : null}
          </div>
        </article>

        <article className="border border-principal/10 bg-blanco p-5">
          <h3 className="font-bold text-principal">Pacientes activos</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {metrics.activePatients.slice(0, 10).map((patient) => (
              <Link
                key={patient.id}
                href={`/professional/expedientes/${patient.expedienteId}`}
                className="border border-principal/10 bg-grisMuyClaro px-3 py-2 text-sm font-semibold text-principal hover:border-azulMedio"
              >
                {patient.fullName}
              </Link>
            ))}
            {metrics.activePatients.length > 10 ? (
              <span className="px-3 py-2 text-sm text-principal/55">
                +{metrics.activePatients.length - 10} mas
              </span>
            ) : null}
            {metrics.activePatients.length === 0 ? (
              <p className="text-sm text-principal/55">No hay pacientes activos.</p>
            ) : null}
          </div>
        </article>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <article className="border border-principal/10 bg-blanco p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-bold text-principal">Pacientes que no regresaron</h3>
              <p className="mt-1 text-xs leading-5 text-principal/55">
                Sin cita futura y sin actividad de agenda durante al menos 3 semanas.
              </p>
            </div>
            <span className="text-2xl font-bold text-rojoRompe">{metrics.inactivePatients.length}</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {metrics.inactivePatients.slice(0, 8).map((patient) => (
              <Link
                key={patient.id}
                href={`/professional/expedientes/${patient.expedienteId}`}
                className="border-l-2 border-rojoRompe bg-grisMuyClaro px-3 py-2"
              >
                <p className="text-sm font-semibold text-principal">{patient.fullName}</p>
                <p className="mt-1 text-xs text-principal/50">
                  Ultima actividad: {formatDate(patient.lastActivityAt)}
                </p>
              </Link>
            ))}
            {metrics.inactivePatients.length === 0 ? (
              <p className="text-sm text-principal/55">No hay pacientes en este seguimiento.</p>
            ) : null}
          </div>
        </article>

        <article className="border border-principal/10 bg-blanco p-5">
          <h3 className="font-bold text-principal">Calculo mensual</h3>
          <p className="mt-1 text-sm leading-5 text-principal/55">
            Configura lo que cobras por sesion para estimar el acumulado.
          </p>
          <div className="mt-4">
            <SessionPriceForm sessionPriceCents={metrics.sessionPriceCents} />
          </div>
        </article>
      </div>
    </section>
  );
}
