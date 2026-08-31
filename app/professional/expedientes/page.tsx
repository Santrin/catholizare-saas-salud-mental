import Link from "next/link";

import { requireRole } from "@/lib/auth/profile";
import { getExpedientesForProfessional } from "@/lib/expedientes/queries";
import { getPatientsForProfessional } from "@/lib/users/queries";
import { CreateExpedienteForm } from "@/components/expedientes/create-expediente-form";
import { ExpedientesTable } from "@/components/expedientes/expedientes-table";
import { ActionDialog } from "@/components/ui/action-dialog";

export default async function ProfessionalExpedientesPage() {
  const profile = await requireRole(["profesional"]);
  const [expedientes, patients] = await Promise.all([
    getExpedientesForProfessional(profile),
    getPatientsForProfessional(profile.id)
  ]);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Panel del profesional
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">Expedientes clinicos</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ActionDialog buttonLabel="Crear expediente" title="Crear expediente clinico">
              <CreateExpedienteForm patients={patients} embedded />
            </ActionDialog>
            <Link href="/professional" className="text-sm font-medium text-azulMedio">
              Volver al panel
            </Link>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-principal">Expedientes por paciente</h2>
          <p className="mt-1 text-sm text-principal/60">
            Abre un expediente existente o crea uno nuevo desde el boton superior.
          </p>
        </div>
        <ExpedientesTable expedientes={expedientes} />
      </div>
    </main>
  );
}
