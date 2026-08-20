import { dismissProBannerAction } from "@/app/pro/actions";
import type { ProBanner } from "@/lib/pro/types";

type ProBannerListProps = {
  banners: ProBanner[];
  compact?: boolean;
};

export function ProBannerList({ banners, compact = false }: ProBannerListProps) {
  if (banners.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">Actualizaciones</p>
        <h2 className="mt-1 text-xl font-bold text-principal">Anuncios para ti</h2>
      </div>
      <div className={compact ? "grid gap-3" : "grid gap-4 lg:grid-cols-2"}>
      {banners.map((banner) => (
        <article
          key={banner.id}
          className="relative overflow-hidden rounded-lg border border-principal/10 bg-blanco shadow-sm"
        >
          {banner.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={banner.image_url}
              alt=""
              className={compact ? "h-28 w-full object-cover" : "h-40 w-full object-cover"}
              loading="lazy"
            />
          ) : (
            <div className="h-2 bg-enfasis" />
          )}
          <div className={compact ? "p-4" : "p-5 sm:p-6"}>
            <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">Catholizare Pro</p>
            <h3 className={compact ? "mt-2 text-base font-bold text-principal" : "mt-2 text-lg font-bold text-principal"}>
              {banner.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-principal/65">{banner.body}</p>
              {banner.cta_url ? (
                <a
                  href={banner.cta_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex min-h-10 items-center rounded-md bg-azulMedio px-4 text-sm font-bold text-blanco transition hover:bg-secundario"
                >
                  {banner.cta_label || "Ver mas"}
                </a>
              ) : null}
            {banner.dismissible ? (
              <form action={dismissProBannerAction} className="absolute right-3 top-3">
                <input type="hidden" name="bannerId" value={banner.id} />
                <button
                  type="submit"
                  className="grid h-9 w-9 place-items-center rounded-md border border-principal/10 bg-blanco text-lg font-medium leading-none text-principal shadow-sm transition hover:border-rojoRompe hover:text-rojoRompe"
                  title="Cerrar anuncio"
                  aria-label="Cerrar anuncio"
                >
                  ×
                </button>
              </form>
            ) : null}
          </div>
        </article>
      ))}
      </div>
    </section>
  );
}
