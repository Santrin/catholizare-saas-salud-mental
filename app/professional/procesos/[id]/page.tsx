import Link from "next/link";

import { markProcessReconceptualizedAction } from "@/app/procesos/actions";
import { requireRole } from "@/lib/auth/profile";
import { getNotasForExpediente } from "@/lib/notas/queries";
import { getProcesoDetail, getProcessConfirmedSessionCount } from "@/lib/procesos/queries";
import { PROCESS_MODEL_LABEL } from "@/lib/procesos/types";
import { LinkNoteForm } from "@/components/procesos/link-note-form";
import { ProcessStepForm } from "@/components/procesos/process-step-form";
import { ReconceptualizationSettings } from "@/components/procesos/reconceptualization-settings";

type ProcesoDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function ProcesoDetailPage({ params }: ProcesoDetailPageProps) {
  const [{ id }, profile] = await Promise.all([params, requireRole(["profesional"])]);
  const process = await getProcesoDetail(profile, id);
  const [notes, confirmedSessionCount] = await Promise.all([
    getNotasForExpediente(profile, process.expediente_id),
    getProcessConfirmedSessionCount(profile, process.id)
  ]);
  const sessionsSinceReconceptualization = Math.max(
    0,
    confirmedSessionCount - process.last_reconceptualized_session_count
  );
  const shouldReconceptualize = Boolean(
    process.reconceptualization_interval &&
      sessionsSinceReconceptualization >= process.reconceptualization_interval
  );

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Proceso terapeutico {PROCESS_MODEL_LABEL[process.model_type]}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">{process.patient.full_name}</h1>
            <p className="mt-2 text-sm text-ink/65">
              Estado: {process.status} | Plantilla version {process.template_version}
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              href={`/professional/expedientes/${process.expediente_id}`}
              className="inline-flex min-h-10 items-center rounded-md border border-azulMedio bg-blanco px-4 text-sm font-bold text-azulMedio"
            >
              Abrir expediente
            </Link>
            <Link href="/professional/procesos" className="inline-flex min-h-10 items-center rounded-md bg-principal px-4 text-sm font-bold text-blanco">
              Volver a procesos
            </Link>
          </div>
        </div>

        {process.status === "cerrado" ? (
          <p className="rounded-md border border-rojoRompe/30 bg-rojoRompe/10 px-4 py-3 text-sm text-ink">
            Este proceso esta cerrado y se conserva como solo lectura.
          </p>
        ) : null}

        <section className="border-l-4 border-enfasis bg-enfasis/10 px-5 py-4">
          <h2 className="font-bold text-principal">Seguimiento de la conceptualizacion</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-principal/70">
            No necesitas recordar en que parte del proceso va tu paciente. Esta plantilla organiza
            el seguimiento y el sistema te avisara cuando convenga reconceptualizar el caso.
          </p>
        </section>

        {shouldReconceptualize ? (
          <section className="flex flex-wrap items-center justify-between gap-4 border border-rojoRompe/30 bg-rojoRompe/10 p-5">
            <div>
              <h2 className="font-bold text-principal">Es momento de reconceptualizar este caso</h2>
              <p className="mt-1 text-sm text-principal/70">
                Han transcurrido {sessionsSinceReconceptualization} sesiones desde la ultima
                reconceptualizacion registrada.
              </p>
            </div>
            <form action={markProcessReconceptualizedAction}>
              <input type="hidden" name="processId" value={process.id} />
              <button className="min-h-10 rounded-md bg-principal px-4 text-sm font-bold text-blanco">
                Registrar reconceptualizacion completada
              </button>
            </form>
          </section>
        ) : null}

        <ReconceptualizationSettings process={process} />

        {process.template_snapshot.steps.map((step) => (
          <ProcessStepForm key={step.id} process={process} step={step} />
        ))}

        <LinkNoteForm process={process} notes={notes} />
      </div>
    </main>
  );
}
