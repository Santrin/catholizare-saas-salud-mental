import { AdminSupportCenter } from "@/components/support/admin-support-center";
import { SuperAdminPageHeader } from "@/components/super-admin/super-admin-page-header";
import { requireRole } from "@/lib/auth/profile";
import { getAdminSupportCenter } from "@/lib/support/queries";

export default async function SuperAdminSupportPage() {
  const profile = await requireRole(["super_administrador"]);
  const dashboard = await getAdminSupportCenter(profile);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <SuperAdminPageHeader
          index="06"
          title="Centros de atencion"
          description="Supervisa conversaciones y operaciones de apoyo sin contenido clinico."
        />
        <AdminSupportCenter dashboard={dashboard} />
      </div>
    </main>
  );
}
