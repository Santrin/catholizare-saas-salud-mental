import type { ReactNode } from "react";

import { RoleAppShell } from "@/components/navigation/role-app-shell";

type AdminShellProps = {
  fullName: string;
  children: ReactNode;
};

const navigationGroups = [
  {
    label: "Operacion",
    links: [
      { href: "/admin", label: "Inicio", hint: "Vista general" },
      { href: "/admin/users", label: "Usuarios", hint: "Cuentas y accesos" },
      { href: "/admin/reports", label: "Reportes", hint: "Actividad operativa" }
    ]
  },
  {
    label: "Comunicacion",
    links: [
      { href: "/admin/pro", label: "Anuncios profesionales", hint: "Recursos y eventos" },
      {
        href: "/admin/patient-announcements",
        label: "Anuncios pacientes",
        hint: "Contenido del portal"
      },
      { href: "/admin/support", label: "Centros de atencion", hint: "Pacientes y profesionales" },
      { href: "/admin/help", label: "Centro de ayuda", hint: "Articulos y tickets" }
    ]
  }
];

export function AdminShell({ fullName, children }: AdminShellProps) {
  return (
    <RoleAppShell
      homeHref="/admin"
      roleLabel="Administracion"
      fullName={fullName}
      navigationGroups={navigationGroups}
    >
      {children}
    </RoleAppShell>
  );
}
