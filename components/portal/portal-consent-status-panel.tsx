import type { PortalConsentStatus } from "@/lib/portal/types";

type PortalConsentStatusPanelProps = {
  statuses: PortalConsentStatus[];
};

function statusLabel(status: PortalConsentStatus["status"]) {
  const labels: Record<PortalConsentStatus["status"], string> = {
    pendiente: "Pendiente de firma",
    firmado_fisico: "Firmado fisico",
    firmado_digital: "Firmado digital",
    excepcion_justificada: "Excepcion justificada"
  };

  return labels[status];
}

export function PortalConsentStatusPanel({ statuses }: PortalConsentStatusPanelProps) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5">
      <h2 className="text-lg font-semibold text-ink">Estado de consentimiento informado</h2>
      <div className="mt-4 space-y-3">
        {statuses.map((status) => (
          <article key={status.expediente_id} className="rounded-md border border-ink/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-ink">{status.title}</p>
                <p className="mt-1 text-xs text-ink/55">
                  Version {status.version} - {status.professional.full_name}
                </p>
              </div>
              <span className="rounded-full bg-azulMedio/10 px-3 py-1 text-xs font-semibold text-azulMedio">
                {statusLabel(status.status)}
              </span>
            </div>
            {status.signed_at ? (
              <p className="mt-2 text-xs text-ink/55">
                Firmado el {new Date(status.signed_at).toLocaleString("es-MX")}.
              </p>
            ) : (
              <div className="mt-3 rounded-md border border-rojoRompe/25 bg-rojoRompe/5 p-3 text-xs leading-5 text-principal/75">
                {status.grace_session_used
                  ? "La sesion inicial de gracia ya fue utilizada. Firma el consentimiento para que puedan programarse nuevas sesiones y continuar el registro clinico."
                  : "Aun esta pendiente. Puedes tener una primera sesion de gracia; completa la firma cuanto antes para evitar que el proceso se bloquee despues de esa sesion."}
              </div>
            )}
          </article>
        ))}

        {statuses.length === 0 ? (
          <p className="text-sm text-ink/65">
            Aun no tienes un consentimiento informado enviado para firma.
          </p>
        ) : null}
      </div>
    </section>
  );
}
