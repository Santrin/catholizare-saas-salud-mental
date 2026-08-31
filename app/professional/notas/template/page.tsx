import Link from "next/link";

import { archiveNotaTemplateAction, renameNotaTemplateAction } from "@/app/notas/actions";
import { requireRole } from "@/lib/auth/profile";
import { getLatestNotaTemplates, getNotaTemplateVersions } from "@/lib/notas/queries";
import { getUsedProcessModelTypes } from "@/lib/procesos/queries";
import {
  DEFAULT_NOTA_TEMPLATE_SECTIONS,
  NOTA_TEMPLATE_MODEL_LABEL,
  NOTA_TEMPLATE_MODEL_TYPES,
  type NotaTemplate,
  type NotaTemplateModelType
} from "@/lib/notas/types";
import { NotaTemplateForm } from "@/components/notas/nota-template-form";

type ProfessionalNotaTemplatePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseModelType(value: string | string[] | undefined): NotaTemplateModelType {
  const candidate = firstParam(value);
  return NOTA_TEMPLATE_MODEL_TYPES.find((type) => type === candidate) ?? "general";
}

function templateName(template: NotaTemplate | null, modelType: NotaTemplateModelType) {
  return template?.name ?? `Plantilla de nota clinica ${NOTA_TEMPLATE_MODEL_LABEL[modelType]}`;
}

function versionHref(modelType: NotaTemplateModelType, version: number, mode: "view" | "edit") {
  return `/professional/notas/template?modelType=${modelType}&version=${version}&mode=${mode}`;
}

function TemplatePreview({ template }: { template: NotaTemplate }) {
  return (
    <section className="space-y-4 rounded-lg border border-ink/10 bg-white p-5">
      <div>
        <h2 className="text-lg font-bold text-principal">{template.name}</h2>
        <p className="mt-1 text-sm text-ink/60">
          Version {template.version} - {NOTA_TEMPLATE_MODEL_LABEL[template.model_type]}
        </p>
      </div>

      {template.sections.map((section) => (
        <div key={section.id} className="rounded-md border border-ink/10 bg-grisMuyClaro p-4">
          <h3 className="text-sm font-semibold text-ink">{section.title}</h3>
          {section.description ? (
            <p className="mt-1 text-xs text-ink/60">{section.description}</p>
          ) : null}
          <ul className="mt-3 space-y-2 text-sm text-ink/70">
            {section.fields.map((field) => (
              <li key={field.id}>
                {field.label} <span className="text-xs text-ink/45">({field.type})</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export default async function ProfessionalNotaTemplatePage({
  searchParams
}: ProfessionalNotaTemplatePageProps) {
  const [profile, params] = await Promise.all([requireRole(["profesional"]), searchParams]);
  const modelType = parseModelType(params.modelType);
  const mode = firstParam(params.mode);
  const source = firstParam(params.source);
  const catalog = firstParam(params.catalog) === "other" ? "other" : "used";
  const versionParam = Number(firstParam(params.version));
  const [latestTemplates, versions, usedProcessTypes] = await Promise.all([
    getLatestNotaTemplates(profile),
    getNotaTemplateVersions(profile, modelType),
    getUsedProcessModelTypes(profile)
  ]);
  const usedTypes = [...new Set<NotaTemplateModelType>(["general", ...usedProcessTypes])];
  const otherTypes = NOTA_TEMPLATE_MODEL_TYPES.filter((type) => !usedTypes.includes(type));
  const visibleTypes = catalog === "used" ? usedTypes : otherTypes;
  const selectedTemplate =
    versions.find((template) => template.version === versionParam) ?? versions[0] ?? null;
  const editSections =
    source === "empty"
      ? [
          {
            id: "seccion_inicial",
            title: "Nueva seccion",
            fields: [{ id: "campo_inicial", label: "Nuevo campo", type: "textarea" as const }]
          }
        ]
      : selectedTemplate?.sections ?? DEFAULT_NOTA_TEMPLATE_SECTIONS;
  const nextVersion = Math.max(0, ...versions.map((template) => template.version)) + 1;
  const editName = source === "empty"
    ? `Plantilla de nota clinica ${NOTA_TEMPLATE_MODEL_LABEL[modelType]} - Version ${nextVersion}`
    : templateName(selectedTemplate, modelType);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Notas clinicas
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">Notas clinicas</h1>
            <p className="mt-2 text-sm text-ink/65">
              Cada plantilla corresponde a un enfoque terapeutico y sirve como punto de partida.
              Puedes visualizarla, personalizarla y crear versiones propias cuando lo necesites.
            </p>
          </div>
          <Link
            href="/professional/notas"
            className="inline-flex min-h-10 items-center rounded-md bg-principal px-4 text-sm font-bold text-blanco transition hover:bg-secundario"
          >
            Volver a notas
          </Link>
        </div>

        {mode ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2 border-b border-principal/10 pb-4">
              {versions.map((template) => (
                <Link
                  key={template.id}
                  href={versionHref(modelType, template.version, "view")}
                  className={`rounded-md border px-3 py-2 text-sm font-medium ${
                    selectedTemplate?.version === template.version
                      ? "border-enfasis bg-enfasis/15 text-principal"
                      : "border-ink/10 bg-white text-ink/70"
                  }`}
                >
                  {template.name} · Version {template.version}
                </Link>
              ))}
              {versions.length === 0 ? (
                <span className="rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-ink/60">
                  Sin versiones guardadas
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href={`/professional/notas/template?modelType=${modelType}`}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium text-ink"
              >
                Volver al listado
              </Link>
              {selectedTemplate ? (
                <Link
                  href={versionHref(modelType, selectedTemplate.version, "edit")}
                  className="rounded-md bg-azulMedio px-4 py-2 text-sm font-semibold text-white"
                >
                  Crear nueva nota clinica a partir de esta plantilla
                </Link>
              ) : null}
            </div>

            {selectedTemplate ? (
              <section className="grid gap-3 border border-principal/10 bg-blanco p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <form action={renameNotaTemplateAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="templateId" value={selectedTemplate.id} />
                  <label className="min-w-56 flex-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-principal/55">
                      Nombre de esta version
                    </span>
                    <input
                      name="name"
                      defaultValue={selectedTemplate.name}
                      maxLength={120}
                      required
                      className="mt-2 h-10 w-full border border-principal/15 px-3 text-sm outline-none focus:border-azulMedio"
                    />
                  </label>
                  <button className="min-h-10 rounded-md border border-azulMedio px-4 text-sm font-bold text-azulMedio">
                    Cambiar nombre
                  </button>
                </form>
                <form action={archiveNotaTemplateAction}>
                  <input type="hidden" name="templateId" value={selectedTemplate.id} />
                  <button className="min-h-10 rounded-md border border-rojoRompe px-4 text-sm font-bold text-rojoRompe">
                    Eliminar esta version
                  </button>
                </form>
              </section>
            ) : null}

            {versions.length >= 3 ? (
              <p className="border-l-4 border-rojoRompe bg-rojoRompe/10 px-4 py-3 text-sm text-principal">
                Alcanzaste el limite de 3 versiones activas. Elimina una version para crear otra.
              </p>
            ) : null}

            {mode === "edit" ? (
              <NotaTemplateForm
                key={`${modelType}-${source ?? selectedTemplate?.id ?? "base"}-${selectedTemplate?.version ?? 0}`}
                modelType={modelType}
                name={editName}
                sections={editSections}
                version={selectedTemplate?.version}
              />
            ) : selectedTemplate ? (
              <TemplatePreview template={selectedTemplate} />
            ) : (
              <NotaTemplateForm
                key={`${modelType}-base`}
                modelType={modelType}
                name={editName}
                sections={DEFAULT_NOTA_TEMPLATE_SECTIONS}
              />
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <nav className="flex flex-wrap gap-2" aria-label="Catalogo de plantillas">
              <Link
                href="/professional/notas/template?catalog=used"
                className={`rounded-md px-4 py-2 text-sm font-bold ${
                  catalog === "used" ? "bg-principal text-blanco" : "border border-principal/15 bg-blanco text-principal"
                }`}
              >
                Plantillas de procesos terapeuticos que usas
              </Link>
              <Link
                href="/professional/notas/template?catalog=other"
                className={`rounded-md px-4 py-2 text-sm font-bold ${
                  catalog === "other" ? "bg-principal text-blanco" : "border border-principal/15 bg-blanco text-principal"
                }`}
              >
                Plantillas de mas procesos terapeuticos
              </Link>
            </nav>

            <section className="grid gap-4 md:grid-cols-2">
            {visibleTypes.map((type) => {
              const latest = latestTemplates.get(type) ?? null;

              return (
                <article key={type} className="rounded-lg border border-ink/10 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-azulMedio">
                    Plantilla de nota clinica {NOTA_TEMPLATE_MODEL_LABEL[type]}
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-principal">
                    {templateName(latest, type)}
                  </h2>
                  <p className="mt-1 text-sm text-ink/60">
                    Version vigente: {latest?.version ?? "base Catholizare"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/professional/notas/template?modelType=${type}&mode=view`}
                      className="rounded-md border border-azulMedio/30 px-3 py-2 text-sm font-medium text-azulMedio"
                    >
                      Visualizar plantilla
                    </Link>
                    <Link
                      href={`/professional/notas/template?modelType=${type}&mode=edit`}
                      className="rounded-md bg-azulMedio px-3 py-2 text-sm font-semibold text-white"
                    >
                      Editar plantilla
                    </Link>
                  </div>
                </article>
              );
            })}

            {catalog === "used" ? (
            <article className="rounded-lg border border-dashed border-azulMedio/40 bg-white p-5">
              <h2 className="text-lg font-bold text-principal">Crear nueva plantilla de nota clinica</h2>
              <p className="mt-1 text-sm text-ink/60">
                Crea una plantilla vacia y guarda una nueva version para usarla en notas futuras.
              </p>
              <Link
                href="/professional/notas/template?modelType=general&mode=edit&source=empty"
                className="mt-4 inline-flex rounded-md bg-azulMedio px-3 py-2 text-sm font-semibold text-white"
              >
                Crear nueva nota con plantilla vacia
              </Link>
            </article>
            ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
