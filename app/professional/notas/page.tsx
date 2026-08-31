import Link from "next/link";

import { requireRole } from "@/lib/auth/profile";
import { getNotasForProfessional } from "@/lib/notas/queries";
import {
  NOTA_CLINICA_STATUSES,
  NOTA_CLINICA_TYPES,
  type NotaClinicaFilters
} from "@/lib/notas/types";
import { getPatientsForProfessional } from "@/lib/users/queries";
import { NotasFilterForm } from "@/components/notas/notas-filter-form";
import { NotasTable } from "@/components/notas/notas-table";

type ProfessionalNotasPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(searchParams: Record<string, string | string[] | undefined>) {
  const patientId = firstParam(searchParams.patientId)?.trim();
  const noteType = firstParam(searchParams.noteType)?.trim();
  const status = firstParam(searchParams.status)?.trim();
  const query = firstParam(searchParams.query)?.trim();
  const dateFrom = firstParam(searchParams.dateFrom)?.trim();
  const dateTo = firstParam(searchParams.dateTo)?.trim();
  const parsedNoteType = NOTA_CLINICA_TYPES.find((type) => type === noteType);
  const parsedStatus = NOTA_CLINICA_STATUSES.find((value) => value === status);

  return {
    patientId: patientId || undefined,
    noteType: parsedNoteType,
    status: parsedStatus,
    query: query || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  } satisfies NotaClinicaFilters;
}

function parseView(value: string | string[] | undefined) {
  return firstParam(value) === "confirmed" ? "confirmed" : "drafts";
}

export default async function ProfessionalNotasPage({
  searchParams
}: ProfessionalNotasPageProps) {
  const [profile, params] = await Promise.all([requireRole(["profesional"]), searchParams]);
  const filters = parseFilters(params);
  const view = parseView(params.view);
  const baseFilters = { ...filters, status: undefined };
  const visibleNotesPromise =
    view === "drafts"
      ? getNotasForProfessional(profile, { ...baseFilters, status: "borrador" })
      : Promise.all([
          getNotasForProfessional(profile, { ...baseFilters, status: "confirmada" }),
          getNotasForProfessional(profile, { ...baseFilters, status: "con_addendum" }),
          getNotasForProfessional(profile, { ...baseFilters, status: "exportada" })
        ]).then((groups) =>
          groups
            .flat()
            .sort(
              (left, right) =>
                new Date(right.session_date).getTime() - new Date(left.session_date).getTime()
            )
        );
  const [notas, patients] = await Promise.all([
    visibleNotesPromise,
    getPatientsForProfessional(profile.id)
  ]);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Panel del profesional
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">Notas clinicas</h1>
            <p className="mt-2 text-sm text-ink/65">
              Consulta de notas propias por Paciente, tipo, estado, fecha y texto clinico.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/professional" className="inline-flex min-h-10 items-center rounded-md border border-azulMedio bg-blanco px-4 text-sm font-bold text-azulMedio">
              Volver al panel
            </Link>
            <Link href="/professional/notas/template" className="inline-flex min-h-10 items-center rounded-md bg-principal px-4 text-sm font-bold text-blanco">
              Plantillas de notas clinicas
            </Link>
          </div>
        </div>

        <NotasFilterForm filters={filters} patients={patients} view={view} />

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-principal">
                {view === "drafts" ? "Borradores editables" : "Notas confirmadas no editables"}
              </h2>
              <p className="mt-1 text-sm text-ink/65">
                {view === "drafts"
                  ? "Notas guardadas como borrador editable."
                  : "Notas guardadas como confirmadas, exportadas o con correcciones historicas."}
              </p>
            </div>
            <div className="flex rounded-md border border-ink/10 bg-white p-1">
              <Link
                href="/professional/notas?view=drafts"
                className={`rounded px-3 py-2 text-sm font-medium ${
                  view === "drafts" ? "bg-azulMedio text-white" : "text-ink/65"
                }`}
              >
                Borradores
              </Link>
              <Link
                href="/professional/notas?view=confirmed"
                className={`rounded px-3 py-2 text-sm font-medium ${
                  view === "confirmed" ? "bg-azulMedio text-white" : "text-ink/65"
                }`}
              >
                Confirmadas
              </Link>
            </div>
          </div>
          <NotasTable
            notas={notas}
            showPatient
            emptyMessage={
              view === "drafts"
                ? "No hay borradores con estos filtros."
                : "No hay notas confirmadas con estos filtros."
            }
          />
        </section>
      </div>
    </main>
  );
}
