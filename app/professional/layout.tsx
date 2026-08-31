import { RoleAppShell } from "@/components/navigation/role-app-shell";
import { requireRole } from "@/lib/auth/profile";
import { getProfessionalResourceNotificationCount } from "@/lib/pro/notifications";

function navigationGroups(resourceNotificationCount: number) {
  return [
  {
    label: "Atencion clinica",
    links: [
      { href: "/professional", label: "Inicio", hint: "Resumen de tu actividad" },
      { href: "/professional/patients", label: "Pacientes", hint: "Personas a tu cargo" },
      { href: "/professional/expedientes", label: "Expedientes", hint: "Informacion clinica" },
      { href: "/professional/notas", label: "Notas clinicas", hint: "Borradores y confirmadas" },
      { href: "/professional/procesos", label: "Procesos terapeuticos", hint: "Seguimiento de casos" }
    ]
  },
  {
    label: "Organizacion",
    links: [
      { href: "/professional/agenda", label: "Agenda", hint: "Citas y calendario" },
      { href: "/professional/integrations", label: "Integraciones", hint: "Google Calendar y Zoom" },
      { href: "/professional/notas/template", label: "Plantillas de notas" },
      { href: "/professional/procesos/template", label: "Plantillas de procesos" }
    ]
  },
  {
    label: "Apoyo",
    links: [
      { href: "/professional/resources", label: "Recursos", badgeCount: resourceNotificationCount },
      { href: "/professional/help", label: "Centro de ayuda" },
      { href: "/professional/export", label: "Solicitar exportacion" }
    ]
  }
  ];
}

export default async function ProfessionalLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await requireRole(["profesional"]);
  const resourceNotificationCount = await getProfessionalResourceNotificationCount(profile);

  return (
    <RoleAppShell
      homeHref="/professional"
      roleLabel="Espacio profesional"
      fullName={profile.full_name}
      navigationGroups={navigationGroups(resourceNotificationCount)}
    >
      {children}
    </RoleAppShell>
  );
}
