import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSupportCenter } from "@/components/support/admin-support-center";
import { requireRole } from "@/lib/auth/profile";
import { getAdminSupportCenter } from "@/lib/support/queries";

export default async function AdminSupportPage() {
  const profile = await requireRole(["administrador"]);
  const dashboard = await getAdminSupportCenter(profile);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <AdminPageHeader
          eyebrow="Operacion y comunicacion"
          title="Centros de atencion"
          description="Atiende a pacientes y profesionales sin acceder a contenido clinico."
        />
        <AdminSupportCenter dashboard={dashboard} />
      </div>
    </main>
  );
}

