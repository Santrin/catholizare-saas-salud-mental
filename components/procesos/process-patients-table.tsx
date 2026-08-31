import Link from "next/link";

import { PROCESS_MODEL_LABEL, type ProcesoListItem } from "@/lib/procesos/types";

type ProcessPatient = {
  id: string;
  status: string;
  patient: {
    full_name: string;
    email: string;
  };
};

type ProcessPatientsTableProps = {
  expedientes: ProcessPatient[];
  procesos: ProcesoListItem[];
};

export function ProcessPatientsTable({ expedientes, procesos }: ProcessPatientsTableProps) {
  const processByExpediente = new Map<string, ProcesoListItem>();

  for (const process of procesos) {
    if (!processByExpediente.has(process.expediente_id)) {
      processByExpediente.set(process.expediente_id, process);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-principal/10 bg-blanco">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-principal text-blanco">
          <tr>
            <th className="px-4 py-3 font-semibold">Paciente</th>
            <th className="px-4 py-3 font-semibold">Modelo terapeutico</th>
            <th className="px-4 py-3 font-semibold">Estado</th>
            <th className="px-4 py-3 font-semibold">Ultima actualizacion</th>
            <th className="px-4 py-3 font-semibold">Conceptualizacion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-principal/10">
          {expedientes.map((expediente) => {
            const process = processByExpediente.get(expediente.id);

            return (
              <tr key={expediente.id}>
                <td className="px-4 py-3">
                  <p className="font-bold text-principal">{expediente.patient.full_name}</p>
                  <p className="mt-1 text-xs text-principal/50">{expediente.patient.email}</p>
                </td>
                <td className="px-4 py-3 text-principal/70">
                  {process ? PROCESS_MODEL_LABEL[process.model_type] : "Sin proceso asignado"}
                </td>
                <td className="px-4 py-3 text-principal/70">{process?.status ?? expediente.status}</td>
                <td className="px-4 py-3 text-principal/70">
                  {process ? new Date(process.updated_at).toLocaleDateString("es-MX") : "Pendiente"}
                </td>
                <td className="px-4 py-3">
                  {process ? (
                    <Link
                      href={`/professional/procesos/${process.id}`}
                      className="inline-flex min-h-9 items-center rounded-md bg-azulMedio px-3 text-xs font-bold text-blanco transition hover:bg-secundario"
                    >
                      Abrir conceptualizacion
                    </Link>
                  ) : (
                    <span className="text-xs text-principal/50">Asigna un proceso para comenzar</span>
                  )}
                </td>
              </tr>
            );
          })}

          {expedientes.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-principal/55">
                No hay pacientes con expediente activo.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
