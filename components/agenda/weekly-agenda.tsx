import Link from "next/link";

import type { AppointmentListItem } from "@/lib/agenda/types";

type WeeklyAgendaProps = {
  appointments: AppointmentListItem[];
};

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function WeeklyAgenda({ appointments }: WeeklyAgendaProps) {
  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const programmed = appointments.filter((appointment) => appointment.status === "programada");

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Agenda semanal</h2>
          <p className="mt-1 text-sm text-ink/60">Citas pendientes de la semana actual.</p>
        </div>
        <Link href="/professional/agenda?view=create#agregar-cita" className="text-sm font-medium text-azulMedio">
          Agregar cita
        </Link>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day);
          const dayAppointments = programmed.filter(
            (appointment) => dateKey(new Date(appointment.scheduled_at)) === key
          );

          return (
            <div key={key} className="min-h-40 rounded-md border border-ink/10 bg-grisMuyClaro p-3">
              <p className="text-sm font-semibold text-ink">
                {day.toLocaleDateString("es-MX", { weekday: "short", day: "2-digit" })}
              </p>
              <div className="mt-3 space-y-2">
                {dayAppointments.map((appointment) => (
                  <Link
                    key={appointment.id}
                    href={`/professional/agenda/${appointment.id}`}
                    className="block rounded-md bg-white p-2 text-xs text-ink shadow-sm transition hover:text-azulMedio"
                  >
                    <span className="font-semibold">{formatTime(appointment.scheduled_at)}</span>
                    <span className="mt-1 block">{appointment.patient.full_name}</span>
                    <span className="mt-1 block text-ink/55">{appointment.type}</span>
                    {appointment.type === "videollamada" ? (
                      <span className="mt-2 block rounded bg-azulMedio px-2 py-1 text-center font-semibold text-blanco">
                        Ver link de sesion
                      </span>
                    ) : null}
                  </Link>
                ))}
                {dayAppointments.length === 0 ? (
                  <p className="text-xs text-ink/45">Sin citas pendientes.</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
