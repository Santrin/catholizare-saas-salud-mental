import type { ReactNode } from "react";

import { RoleAppShell } from "@/components/navigation/role-app-shell";

type SuperAdminShellProps = {
  fullName: string;
  children: ReactNode;
};

const navigationGroups = [
  {
    label: "Control global",
    links: [
      { href: "/super-admin", label: "Inicio", hint: "Resumen de la plataforma" },
      { href: "/super-admin/users", label: "Usuarios", hint: "Cuentas y accesos" },
      { href: "/super-admin/reports", label: "Estadisticas", hint: "Indicadores globales" },
      { href: "/super-admin/audit", label: "Auditoria", hint: "Actividad trazable" },
      { href: "/super-admin/system-health", label: "Salud del sistema", hint: "Servicios esenciales" }
    ]
  },
  {
    label: "Custodia",
    links: [
      { href: "/super-admin/exports", label: "Exportaciones", hint: "Solicitudes profesionales" }
    ]
  },
  {
    label: "Comunicacion",
    links: [
      { href: "/super-admin/pro", label: "Anuncios profesionales" },
      { href: "/super-admin/patient-announcements", label: "Anuncios pacientes" },
      { href: "/super-admin/support", label: "Centros de atencion" },
      { href: "/super-admin/help", label: "Centro de ayuda" }
    ]
  }
];

export function SuperAdminShell({ fullName, children }: SuperAdminShellProps) {
  return (
    <RoleAppShell
      homeHref="/super-admin"
      roleLabel="Super administracion"
      fullName={fullName}
      navigationGroups={navigationGroups}
    >
      {children}
    </RoleAppShell>
  );
}
