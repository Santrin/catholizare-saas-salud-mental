import { PortalAppointments } from "@/components/portal/portal-appointments";
import { PortalSummary } from "@/components/portal/portal-summary";
import { LifeHistoryForm } from "@/components/portal/life-history-form";
import { AssessmentUploadForm } from "@/components/portal/assessment-upload-form";
import { requireRole } from "@/lib/auth/profile";
import { getPortalDashboard } from "@/lib/portal/queries";
import { StandardConsentPanel } from "@/components/portal/standard-consent-panel";
import { PatientAnnouncements } from "@/components/portal/patient-announcements";
import { PortalSectionShell } from "@/components/portal/portal-section-shell";
import { PortalPatientDashboard } from "@/components/portal/portal-patient-dashboard";
import { PortalRecommendationsPanel } from "@/components/portal/portal-recommendations-panel";
import { PortalConsentStatusPanel } from "@/components/portal/portal-consent-status-panel";
import { PortalProcessResourcesPanel } from "@/components/portal/portal-process-resources-panel";
import { PortalAppointmentsTabs } from "@/components/portal/portal-appointments-tabs";
import { PortalCustomerSupportPanel } from "@/components/portal/portal-customer-support-panel";
import { PortalResourceRecommendationsPanel } from "@/components/portal/portal-resource-recommendations-panel";
import { SupportConversationPanel } from "@/components/support/support-conversation-panel";
import { getParticipantSupportConversation } from "@/lib/support/queries";

function lifeHistoryStatusText(status?: string | null) {
  if (status === "enviada") {
    return "Ya enviaste tu historia de vida";
  }

  if (status === "reabierta") {
    return "Reabierta para editar";
  }

  if (status === "borrador") {
    return "Disponible para completar";
  }

  return "Aun no activada por tu profesional";
}

export default async function PortalPage() {
  const profile = await requireRole(["paciente"]);
  const [dashboard, supportConversation] = await Promise.all([
    getPortalDashboard(profile),
    getParticipantSupportConversation(profile)
  ]);

  return (
    <main className="min-h-[calc(100vh-72px)] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <PortalSectionShell
          sections={[
            {
              id: "dashboard",
              label: "Inicio",
              description: "Tus proximos pasos y accesos importantes en un solo lugar.",
              group: "inicio",
              content: (
                <div className="space-y-8">
                  <PortalPatientDashboard
                    patientFullName={profile.full_name}
                    processHistory={dashboard.processHistory}
                    upcomingAppointments={dashboard.upcomingAppointments}
                    consentStatuses={dashboard.consentStatuses}
                  />
                  <PortalRecommendationsPanel recommendations={dashboard.recommendations} />
                  <PatientAnnouncements announcements={dashboard.announcements} />
                </div>
              )
            },
            {
              id: "consentimiento",
              label: "Consentimiento",
              description: "Consulta el estado y firma los documentos enviados por tu profesional.",
              group: "atencion",
              content: (
                <div className="space-y-6">
                  <PortalConsentStatusPanel statuses={dashboard.consentStatuses} />
                  <StandardConsentPanel consents={dashboard.standardConsents} />
                </div>
              )
            },
            {
              id: "historia",
              label: "Historia de vida",
              description: "Completa la informacion solicitada por tu profesional para tu proceso.",
              group: "atencion",
              statusText: lifeHistoryStatusText(dashboard.lifeHistory?.status),
              content: <LifeHistoryForm lifeHistory={dashboard.lifeHistory} />
            },
            {
              id: "pruebas",
              label: "Pruebas psicologicas",
              description: "Sube las pruebas que tu profesional te haya solicitado.",
              group: "atencion",
              content: (
                <AssessmentUploadForm
                  requests={dashboard.assessmentRequests}
                  uploads={dashboard.assessmentUploads}
                />
              )
            },
            {
              id: "citas",
              label: "Citas y videollamada",
              description: "Revisa tus proximas sesiones, enlaces de acceso y citas anteriores.",
              group: "atencion",
              content: (
                <PortalAppointmentsTabs
                  upcomingContent={
                    <PortalAppointments
                      title="Proximas citas"
                      appointments={dashboard.upcomingAppointments}
                      emptyMessage="No tienes citas programadas."
                      showRequests
                    />
                  }
                  historyContent={
                    <PortalAppointments
                      title="Historial"
                      appointments={dashboard.pastAppointments}
                      emptyMessage="Aun no hay citas pasadas para mostrar."
                      showReviews
                    />
                  }
                />
              )
            },
            {
              id: "procesos",
              label: "Procesos",
              description: "Consulta tus procesos terapeuticos y opciones para iniciar uno nuevo.",
              group: "atencion",
              content: (
                <PortalProcessResourcesPanel
                  processes={dashboard.processHistory}
                  links={dashboard.catholizareLinks}
                />
              )
            },
            {
              id: "recursos",
              label: "Recursos para mi",
              description: "Elige tus temas de interes y consulta lecturas recomendadas.",
              group: "apoyo",
              content: (
                <PortalResourceRecommendationsPanel
                  selectedTopics={dashboard.resourcePreferences.selected_topics}
                  recommendations={dashboard.resourcePreferences.recommendations}
                />
              )
            },
            {
              id: "soporte",
              label: "Atencion al cliente",
              description: "Encuentra ayuda para resolver dudas sobre tu cuenta o el portal.",
              group: "apoyo",
              content: (
                <div className="space-y-6">
                  <SupportConversationPanel conversation={supportConversation} audienceLabel="paciente" />
                  <PortalCustomerSupportPanel />
                </div>
              )
            },
            {
              id: "solicitudes",
              label: "Solicitudes",
              description: "Da seguimiento a tus solicitudes de cancelacion o reprogramacion.",
              group: "apoyo",
              content: (
                <section className="rounded-lg border border-ink/10 bg-white p-5">
                  <h2 className="text-lg font-semibold text-ink">Solicitudes recientes</h2>
                  <div className="mt-4 divide-y divide-ink/10">
                    {dashboard.requests.map((request) => (
                      <div key={request.id} className="py-3 first:pt-0 last:pb-0">
                        <p className="text-sm font-medium text-ink">{request.request_type}</p>
                        <p className="mt-1 text-xs text-ink/55">
                          Estado: {request.status} -{" "}
                          {new Date(request.created_at).toLocaleDateString("es-MX")}
                        </p>
                      </div>
                    ))}

                    {dashboard.requests.length === 0 ? (
                      <p className="text-sm text-ink/65">No hay solicitudes recientes.</p>
                    ) : null}
                  </div>
                </section>
              )
            },
            {
              id: "resumen",
              label: "Recursos compartidos",
              description: "Consulta la informacion que tu profesional publico para ti.",
              group: "apoyo",
              content: <PortalSummary summary={dashboard.summary} />
            }
          ]}
        />
      </div>
    </main>
  );
}
