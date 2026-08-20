import Link from "next/link";

import { requireRole } from "@/lib/auth/profile";
import {
  getExpedientesForProcessStart,
  getProcesosForProfessional
} from "@/lib/procesos/queries";
import { ProcessesTable } from "@/components/procesos/processes-table";
import { StartProcessSelectorForm } from "@/components/procesos/start-process-selector-form";

export default async function ProfessionalProcesosPage() {
  const profile = await requireRole(["profesional"]);
  const [procesos, expedientes] = await Promise.all([
    getProcesosForProfessional(profile),
    getExpedientesForProcessStart(profile)
  ]);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Panel del profesional
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">Procesos terapeuticos</h1>
            <p className="mt-2 text-sm text-ink/65">
              Enfoques terapeuticos configurables por plantilla y version para cada caso clinico.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/professional/procesos/template" className="text-sm font-medium text-azulMedio">
              Editar plantillas
            </Link>
            <Link href="/professional" className="text-sm font-medium text-azulMedio">
              Volver al panel
            </Link>
          </div>
        </div>

        <section id="conceptualizar-caso" className="scroll-mt-24">
          <StartProcessSelectorForm expedientes={expedientes} />
        </section>
        <ProcessesTable procesos={procesos} />
      </div>
    </main>
  );
}
