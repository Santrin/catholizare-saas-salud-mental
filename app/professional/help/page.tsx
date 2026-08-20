import Link from "next/link";

import { HelpArticleList } from "@/components/help/help-article-list";
import { SupportTicketForm } from "@/components/help/support-ticket-form";
import { SupportTicketList } from "@/components/help/support-ticket-list";
import { requireRole } from "@/lib/auth/profile";
import { getProfessionalHelpDashboard } from "@/lib/help/queries";
import { SupportConversationPanel } from "@/components/support/support-conversation-panel";
import { getParticipantSupportConversation } from "@/lib/support/queries";

const faqItems = [
  {
    question: "Puedo enviar datos de pacientes por soporte?",
    answer: "No. Usa soporte solo para dudas operativas y describe el problema sin datos clinicos."
  },
  {
    question: "Que informacion ayuda a resolver un ticket?",
    answer:
      "Incluye el modulo, los pasos para reproducir el problema, el mensaje de error y capturas sin datos clinicos."
  },
  {
    question: "Donde pido apoyo clinico o supervision?",
    answer: "Usa los recursos de Catholizare Pro, mentorias o revision de casos; no el ticket tecnico."
  }
];

export default async function ProfessionalHelpPage() {
  const profile = await requireRole(["profesional"]);
  const [help, supportConversation] = await Promise.all([
    getProfessionalHelpDashboard(profile),
    getParticipantSupportConversation(profile)
  ]);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Centro de ayuda
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">Soporte operativo</h1>
            <p className="mt-2 text-sm text-ink/65">
              Guias de uso, preguntas frecuentes y contacto tecnico sin contenido clinico.
            </p>
          </div>
          <Link href="/professional" className="text-sm font-medium text-azulMedio">
            Volver al panel
          </Link>
        </div>

        <section className="rounded-lg border border-rojoRompe/30 bg-rojoRompe/10 p-5">
          <h2 className="text-lg font-bold text-principal">Separacion clinica</h2>
          <p className="mt-2 text-sm leading-6 text-ink/75">
            Este modulo no accede a expedientes, notas, evaluaciones ni imagenes clinicas. Para
            soporte tecnico, describe pasos, errores o pantallas sin incluir datos de Pacientes.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-principal">Guias y articulos</h2>
          <HelpArticleList articles={help.articles} />
        </section>

        <SupportConversationPanel conversation={supportConversation} audienceLabel="profesional" />

        <section className="grid gap-4 md:grid-cols-3">
          {faqItems.map((item) => (
            <article key={item.question} className="rounded-lg border border-ink/10 bg-white p-5">
              <h3 className="text-sm font-semibold text-ink">{item.question}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/70">{item.answer}</p>
            </article>
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <SupportTicketForm />
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-principal">Solicitudes recientes</h2>
            <SupportTicketList tickets={help.tickets} />
          </section>
        </div>
      </div>
    </main>
  );
}
