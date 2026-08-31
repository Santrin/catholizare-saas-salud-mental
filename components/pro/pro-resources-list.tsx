import type { ProResource } from "@/lib/pro/types";

type ProResourcesListProps = {
  resources: ProResource[];
  newResourceIds?: string[];
};

export function ProResourcesList({ resources, newResourceIds = [] }: ProResourcesListProps) {
  const newIds = new Set(newResourceIds);
  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">Biblioteca</p>
      <h2 className="mt-1 text-xl font-bold text-principal">Recursos</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {resources.map((resource) => (
          <article key={resource.id} className="overflow-hidden rounded-lg border border-principal/10 bg-blanco transition hover:border-azulMedio">
            {resource.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resource.image_url}
                alt=""
                className="h-36 w-full object-cover"
                loading="lazy"
              />
            ) : null}
            <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-azulMedio">
                  {resource.category}
                </p>
                <h3 className="mt-2 font-bold text-principal">{resource.title}</h3>
              </div>
              {resource.featured ? (
                <span className="rounded-md bg-enfasis/20 px-2 py-1 text-xs font-semibold text-principal">
                  Destacado
                </span>
              ) : null}
              {newIds.has(resource.id) ? (
                <span className="rounded-md bg-rojoRompe px-2 py-1 text-xs font-bold text-blanco">Nuevo</span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-ink/65">{resource.description}</p>
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex text-sm font-bold text-azulMedio"
            >
              Ver mas
            </a>
            </div>
          </article>
        ))}

        {resources.length === 0 ? (
          <p className="text-sm text-ink/65">No hay recursos activos para mostrar.</p>
        ) : null}
      </div>
    </section>
  );
}
