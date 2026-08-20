import Link from "next/link";

import { ProfessionalMembershipPanel } from "@/components/professional/professional-membership-panel";
import { ProBannerList } from "@/components/pro/pro-banner-list";
import { ProfessionalActivityHighlights } from "@/components/pro/professional-activity-highlights";
import { RotatingProResource } from "@/components/pro/rotating-pro-resource";
import { requireRole } from "@/lib/auth/profile";
import { getProfessionalProDashboard } from "@/lib/pro/queries";

export default async function ProfessionalPage() {
  const profile = await requireRole(["profesional"]);
  const pro = await getProfessionalProDashboard(profile, "dashboard");
  const firstName = profile.full_name.trim().split(" ")[0] || profile.full_name;
  const menuLinks = [
    {
      label: "Agenda",
      href: "/professional/agenda",
      description: "Organiza tus proximas citas y videollamadas."
    },
    {
      label: "Conceptualizar tu caso",
      href: "/professional/procesos#conceptualizar-caso",
      description: "Selecciona un paciente y abre su proceso para completar la conceptualizacion."
    }
  ];

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <section className="overflow-hidden rounded-lg bg-principal text-blanco">
          <div className="grid gap-6 px-5 py-6 sm:px-7 md:grid-cols-[minmax(0,1fr)_300px] md:items-center md:py-8">
            <div>
              <p className="text-sm font-semibold text-enfasis">Hola, {firstName}</p>
              <h1 className="mt-2 max-w-xl text-2xl font-bold leading-tight sm:text-3xl">
                Tu practica organizada con calma y claridad.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-blanco/75">
                Accede a pacientes, expedientes, notas y agenda desde un mismo espacio.
              </p>
            </div>
            <div className="border-l-4 border-enfasis bg-blanco px-4 py-4 text-principal">
              <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">Sesion activa</p>
              <p className="mt-2 text-base font-bold">{profile.full_name}</p>
              <p className="mt-1 text-sm leading-5 text-principal/65">
                Tu informacion clinica permanece separada de la administracion global.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          <div className="space-y-8">
            <section>
              <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">Accesos frecuentes</p>
              <h2 className="mt-1 text-xl font-bold text-principal">Que necesitas hacer?</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {menuLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group flex min-h-[150px] flex-col border border-principal/10 bg-blanco p-5 transition hover:border-azulMedio"
                  >
                    <span className="mb-4 h-1 w-10 bg-enfasis" />
                    <span className="font-bold text-principal">{item.label}</span>
                    <span className="mt-2 flex-1 text-sm leading-5 text-principal/60">
                      {item.description}
                    </span>
                    <span className="mt-4 text-sm font-bold text-azulMedio transition group-hover:text-secundario">
                      Abrir seccion
                    </span>
                  </Link>
                ))}
              </div>
            </section>

            <RotatingProResource
              resources={pro.resources}
              initialBucket={Math.floor(Date.now() / 600_000)}
            />
            <ProfessionalActivityHighlights events={pro.events} />
            <ProfessionalMembershipPanel />
          </div>

          <aside className="lg:sticky lg:top-24">
            <ProBannerList banners={pro.banners} compact />
          </aside>
        </div>
      </div>
    </main>
  );
}
