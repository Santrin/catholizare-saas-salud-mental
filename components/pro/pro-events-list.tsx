import type { ProEvent } from "@/lib/pro/types";

type ProEventsListProps = {
  events: ProEvent[];
  newEventIds?: string[];
};

export function ProEventsList({ events, newEventIds = [] }: ProEventsListProps) {
  const newIds = new Set(newEventIds);
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">Agenda Catholizare</p>
      <h2 className="mt-1 text-xl font-bold text-principal">Proximas actividades</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {events.map((event) => (
          <article key={event.id} className="overflow-hidden rounded-lg border border-principal/10 bg-blanco">
            {event.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="h-40 w-full object-cover" src={event.image_url} />
            ) : null}
            <div className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-azulMedio">
              {event.event_type}
            </p>
            <h3 className="mt-2 font-bold text-principal">{event.title}</h3>
            {newIds.has(event.id) ? (
              <span className="mt-2 inline-flex rounded-md bg-rojoRompe px-2 py-1 text-xs font-bold text-blanco">Nuevo</span>
            ) : null}
            <p className="mt-1 text-sm text-ink/65">
              {new Date(event.starts_at).toLocaleString("es-MX")} - {event.modality}
            </p>
            <p className="mt-2 text-sm leading-6 text-ink/65">{event.description}</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {event.info_url ? (
                <a href={event.info_url} target="_blank" rel="noreferrer" className="text-sm font-bold text-azulMedio">
                  Ver detalles
                </a>
              ) : null}
              {event.registration_url ? (
                <a
                  href={event.registration_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-bold text-azulMedio"
                >
                  Registrarme
                </a>
              ) : null}
            </div>
            </div>
          </article>
        ))}

        {events.length === 0 ? (
          <p className="rounded-lg border border-dashed border-principal/20 bg-blanco p-6 text-sm text-principal/65">No hay actividades programadas.</p>
        ) : null}
      </div>
    </section>
  );
}
