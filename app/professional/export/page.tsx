import Link from "next/link";

import { ProfessionalExportRequestForm } from "@/components/data-export/professional-export-request-form";
import { requireRole } from "@/lib/auth/profile";
import { getProfessionalExportRequests } from "@/lib/data-export/queries";

export default async function ProfessionalExportPage() {
  const profile = await requireRole(["profesional"]);
  const requests = await getProfessionalExportRequests(profile);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Exportacion total
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">Descarga de expedientes</h1>
            <p className="mt-2 text-sm text-ink/65">
              Solicita autorizacion para descargar tus expedientes y archivos clinicos.
            </p>
          </div>
          <Link href="/professional" className="text-sm font-medium text-azulMedio">
            Volver al panel
          </Link>
        </div>

        <section className="rounded-lg border border-principal/10 bg-white p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-azulMedio">
            Proceso de aceptacion en dos pasos
          </p>
          <h2 className="mt-1 text-xl font-bold text-principal">Antes de solicitar la exportacion</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-ink/10 bg-grisMuyClaro p-4">
              <span className="text-xs font-bold uppercase text-azulMedio">Paso 1</span>
              <h3 className="mt-2 font-semibold text-ink">Solicitud profesional</h3>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Debes describir el motivo. La solicitud queda auditada y no genera ninguna descarga
                inmediata.
              </p>
            </div>
            <div className="rounded-md border border-ink/10 bg-grisMuyClaro p-4">
              <span className="text-xs font-bold uppercase text-azulMedio">Paso 2</span>
              <h3 className="mt-2 font-semibold text-ink">Revision de Super Admin</h3>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Super Admin aprueba o rechaza. Si aprueba, se crea un link temporal con expiracion
                y trazabilidad.
              </p>
            </div>
            <div className="rounded-md border border-ink/10 bg-grisMuyClaro p-4">
              <span className="text-xs font-bold uppercase text-azulMedio">Paso 3</span>
              <h3 className="mt-2 font-semibold text-ink">Firma y descarga</h3>
              <p className="mt-2 text-sm leading-6 text-ink/65">
                Antes de descargar debes autenticarte, firmar responsabilidad y aceptar la custodia
                legal de los expedientes.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gold/30 bg-gold/10 p-5">
          <h2 className="text-lg font-bold text-principal">Contrato de descargo de responsabilidades</h2>
          <p className="mt-2 text-sm leading-6 text-ink/70">
            Pendiente MVP: aqui se agregara el contrato formal para que el profesional lo descargue,
            lea y conserve antes de continuar con la aceptacion de exportacion.
          </p>
          <button
            type="button"
            disabled
            className="mt-4 inline-flex min-h-10 cursor-not-allowed items-center rounded-md border border-principal/20 bg-white px-4 text-sm font-semibold text-ink/45"
          >
            Descargar contrato pendiente
          </button>
        </section>

        <ProfessionalExportRequestForm />

        <section className="rounded-lg border border-ink/10 bg-white p-5">
          <h2 className="text-lg font-bold text-principal">Solicitudes recientes</h2>
          <div className="mt-4 divide-y divide-ink/10">
            {requests.map((request) => (
              <div key={request.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-semibold text-ink">
                  {request.folio} | {request.status}
                </p>
                <p className="mt-1 text-xs text-ink/55">
                  Solicitada: {new Date(request.requested_at).toLocaleString("es-MX")}
                  {request.token_expires_at
                    ? ` | Link expira: ${new Date(request.token_expires_at).toLocaleString("es-MX")}`
                    : ""}
                </p>
                {request.accepted_at ? (
                  <p className="mt-1 text-xs text-ink/55">
                    Aceptacion: {request.acceptance_folio} |{" "}
                    {new Date(request.accepted_at).toLocaleString("es-MX")}
                  </p>
                ) : null}
              </div>
            ))}

            {requests.length === 0 ? (
              <p className="text-sm text-ink/65">No hay solicitudes registradas.</p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
