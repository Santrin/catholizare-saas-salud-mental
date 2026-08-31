import Link from "next/link";

import { ProBannerList } from "@/components/pro/pro-banner-list";
import { ProEventsList } from "@/components/pro/pro-events-list";
import { ProResourcesList } from "@/components/pro/pro-resources-list";
import { ResourceSeenMarker } from "@/components/pro/resource-seen-marker";
import { requireRole } from "@/lib/auth/profile";
import { getProfessionalProDashboard } from "@/lib/pro/queries";
import { getResourceNovelty } from "@/lib/pro/notifications";

export default async function ProfessionalResourcesPage() {
  const profile = await requireRole(["profesional"]);
  const pro = await getProfessionalProDashboard(profile, "resources");
  const novelty = await getResourceNovelty(profile, pro);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <ResourceSeenMarker contentKeys={novelty.keys} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Catholizare Pro
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">Recursos</h1>
            <p className="mt-2 text-sm text-ink/65">
              Materiales, formacion y actividades para acompanar tu practica profesional.
            </p>
          </div>
          <Link
            href="/professional"
            className="inline-flex min-h-10 items-center rounded-md bg-principal px-4 text-sm font-bold text-blanco transition hover:bg-secundario"
          >
            Volver al panel
          </Link>
        </div>

        <ProBannerList banners={pro.banners} />
        <ProEventsList events={pro.events} newEventIds={novelty.eventIds} />
        <ProResourcesList resources={pro.resources} newResourceIds={novelty.resourceIds} />
      </div>
    </main>
  );
}
