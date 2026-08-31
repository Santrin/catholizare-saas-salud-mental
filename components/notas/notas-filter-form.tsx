import { NOTA_CLINICA_TYPES, type NotaClinicaFilters } from "@/lib/notas/types";
import { SearchablePersonSelect } from "@/components/forms/searchable-person-select";
import type { UserManagementProfile } from "@/lib/users/types";

type NotasFilterFormProps = {
  filters: NotaClinicaFilters;
  patients: UserManagementProfile[];
  view?: "drafts" | "confirmed";
};

const noteTypeLabels: Record<(typeof NOTA_CLINICA_TYPES)[number], string> = {
  sesion: "Sesion",
  interconsulta: "Interconsulta",
  referencia_traslado: "Referencia o traslado",
  egreso: "Egreso"
};

export function NotasFilterForm({ filters, patients, view = "drafts" }: NotasFilterFormProps) {
  return (
    <form className="grid gap-3 rounded-lg border border-ink/10 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(10rem,1.2fr)_8rem_8rem_8rem_minmax(8rem,1fr)_auto] xl:items-end">
      <input type="hidden" name="view" value={view} />

      <SearchablePersonSelect
        name="patientId"
        label="Paciente"
        options={patients.map((patient) => ({
          id: patient.id,
          label: patient.full_name,
          detail: patient.email
        }))}
        defaultValue={filters.patientId ?? ""}
        placeholder="Buscar paciente por nombre..."
        emptyHint="Deja el campo vacio para ver todos."
      />

      <label className="block">
        <span className="text-sm font-medium text-ink">Tipo</span>
        <select
          name="noteType"
          defaultValue={filters.noteType ?? ""}
          className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        >
          <option value="">Todos</option>
          {NOTA_CLINICA_TYPES.map((type) => (
            <option key={type} value={type}>
              {noteTypeLabels[type]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Desde</span>
        <input
          type="date"
          name="dateFrom"
          defaultValue={filters.dateFrom ?? ""}
          className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Hasta</span>
        <input
          type="date"
          name="dateTo"
          defaultValue={filters.dateTo ?? ""}
          className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Texto</span>
        <input
          name="query"
          defaultValue={filters.query ?? ""}
          className="mt-2 w-full rounded-md border border-ink/15 px-3 py-2 outline-none focus:border-azulMedio focus:ring-2 focus:ring-azulMedio/20"
        />
      </label>

      <div>
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-md bg-azulMedio px-5 text-sm font-semibold text-white transition hover:bg-ink"
        >
          Filtrar notas
        </button>
      </div>
    </form>
  );
}
