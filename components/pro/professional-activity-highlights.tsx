import type { ProEvent } from "@/lib/pro/types";

type ProfessionalActivityHighlightsProps = {
  events: ProEvent[];
};

const ACTIVITIES_URL = "https://profesionales.catholizare.com/discusion-de-casos/";

function normalizedEventText(event: ProEvent) {
  return `${event.title} ${event.event_type} ${event.description}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function findEvent(events: ProEvent[], searchTerms: string[]) {
  return events.find((event) => {
    const text = normalizedEventText(event);
    return searchTerms.some((term) => text.includes(term));
  });
}

function ActivityCard({
  event,
  title,
  description
}: {
  event?: ProEvent;
  title: string;
  description: string;
}) {
  const isDatedEvent = event && !event.id.startsWith("public-event-");
  const url = event?.info_url ?? event?.registration_url ?? ACTIVITIES_URL;

  return (
    <article className="border border-principal/10 bg-blanco p-5">
      <span className="block h-1 w-10 bg-enfasis" />
      <h3 className="mt-4 font-bold text-principal">{title}</h3>
      {isDatedEvent ? (
        <p className="mt-2 text-sm font-semibold text-azulMedio">
          {new Date(event.starts_at).toLocaleString("es-MX")}
        </p>
      ) : (
        <p className="mt-2 text-sm font-semibold text-azulMedio">Consulta las fechas publicadas</p>
      )}
      <p className="mt-2 text-sm leading-6 text-principal/65">{event?.description ?? description}</p>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex text-sm font-bold text-azulMedio hover:text-secundario"
      >
        Ver fechas y detalles
      </a>
    </article>
  );
}

export function ProfessionalActivityHighlights({ events }: ProfessionalActivityHighlightsProps) {
  const contagioEvent = findEvent(events, ["contagio de fe", "contagio_fe"]);
  const integrationEvent = findEvent(events, ["reunion de integracion", "reuniones de integracion"]);

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">Agenda Catholizare</p>
      <h2 className="mt-1 text-xl font-bold text-principal">Proximas actividades</h2>
      <p className="mt-2 text-sm leading-6 text-principal/65">
        Estas actividades estan dirigidas a profesionales miembros de Catholizare.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ActivityCard
          event={contagioEvent}
          title="Contagios de Fe"
          description="Consulta las proximas fechas para compartir la fe y fortalecer la vida profesional en comunidad."
        />
        <ActivityCard
          event={integrationEvent}
          title="Reuniones de integracion"
          description="Encuentros entre colegas para compartir experiencias y fortalecer la comunidad profesional."
        />
      </div>
    </section>
  );
}
