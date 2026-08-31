"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export type RoleNavigationGroup = {
  label: string;
  links: Array<{
    href: string;
    label: string;
    hint?: string;
    badgeCount?: number;
  }>;
};

type RoleAppShellProps = {
  homeHref: string;
  roleLabel: string;
  fullName: string;
  navigationGroups: RoleNavigationGroup[];
  children: ReactNode;
};

function initialsForName(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function activeHrefForPath(
  pathname: string,
  homeHref: string,
  groups: RoleNavigationGroup[]
) {
  if (pathname === homeHref) {
    return homeHref;
  }

  return groups
    .flatMap((group) => group.links)
    .filter((link) => pathname === link.href || pathname.startsWith(`${link.href}/`))
    .sort((left, right) => right.href.length - left.href.length)[0]?.href;
}

function RoleNavigation({
  pathname,
  homeHref,
  groups,
  onNavigate
}: {
  pathname: string;
  homeHref: string;
  groups: RoleNavigationGroup[];
  onNavigate?: () => void;
}) {
  const activeHref = activeHrefForPath(pathname, homeHref, groups);

  return (
    <nav aria-label="Navegacion principal" className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-wider text-grisTextos">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.links.map((link) => {
              const active = activeHref === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "relative block min-h-11 border-l-4 px-3 py-2 pr-10 transition",
                    active
                      ? "border-azulMedio bg-grisMuyClaro text-principal"
                      : "border-transparent text-principal/70 hover:bg-grisMuyClaro hover:text-principal"
                  ].join(" ")}
                >
                  <span className="block text-sm font-semibold">{link.label}</span>
                  {link.hint ? (
                    <span className="mt-0.5 block text-[11px] leading-4 text-grisTextos">
                      {link.hint}
                    </span>
                  ) : null}
                  {!active && link.badgeCount && link.badgeCount > 0 ? (
                    <span className="absolute right-2 top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rojoRompe px-1.5 py-0.5 text-[10px] font-bold text-blanco">
                      {link.badgeCount > 99 ? "99+" : link.badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SessionBlock({ fullName, roleLabel }: { fullName: string; roleLabel: string }) {
  return (
    <div className="border-t border-principal/10 pt-4">
      <div className="flex items-center gap-3 px-2">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-enfasis/25 text-xs font-bold text-principal">
          {initialsForName(fullName)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-principal">{fullName}</span>
          <span className="block text-xs text-grisTextos">{roleLabel}</span>
        </span>
      </div>
      <form action="/api/auth/logout" method="post" className="mt-3">
        <button
          type="submit"
          className="min-h-10 w-full rounded-md border border-principal/15 bg-blanco px-3 text-sm font-semibold text-principal transition hover:border-rojoRompe hover:text-rojoRompe"
        >
          Cerrar sesion
        </button>
      </form>
    </div>
  );
}

export function RoleAppShell({
  homeHref,
  roleLabel,
  fullName,
  navigationGroups,
  children
}: RoleAppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="catholizare-app min-h-screen bg-grisMuyClaro text-principal lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-principal/10 bg-blanco px-4 py-5 lg:flex">
        <Link href={homeHref} className="flex items-center gap-3 px-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-principal text-sm font-bold text-blanco">
            C
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold text-principal">Catholizare OS</span>
            <span className="block text-xs font-medium text-grisTextos">{roleLabel}</span>
          </span>
        </Link>

        <div className="mt-8 flex-1 overflow-y-auto pr-1">
          <RoleNavigation
            pathname={pathname}
            homeHref={homeHref}
            groups={navigationGroups}
          />
        </div>
        <SessionBlock fullName={fullName} roleLabel={roleLabel} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-50 border-b border-principal/10 bg-blanco/95 backdrop-blur lg:hidden">
          <div className="flex min-h-[72px] items-center justify-between gap-4 px-4 sm:px-6">
            <Link href={homeHref} className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-principal text-sm font-bold text-blanco">
                C
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-bold text-principal">Catholizare OS</span>
                <span className="block truncate text-xs font-medium text-grisTextos">{roleLabel}</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="mobile-role-navigation"
              className="min-h-10 rounded-md border border-principal/15 bg-blanco px-4 text-sm font-semibold text-principal transition hover:border-azulMedio"
            >
              {menuOpen ? "Cerrar" : "Menu"}
            </button>
          </div>

          {menuOpen ? (
            <div
              id="mobile-role-navigation"
              className="max-h-[calc(100vh-72px)] overflow-y-auto border-t border-principal/10 bg-blanco px-4 py-5 shadow-xl sm:px-6"
            >
              <RoleNavigation
                pathname={pathname}
                homeHref={homeHref}
                groups={navigationGroups}
                onNavigate={() => setMenuOpen(false)}
              />
              <div className="mt-6">
                <SessionBlock fullName={fullName} roleLabel={roleLabel} />
              </div>
            </div>
          ) : null}
        </header>

        {children}
      </div>
    </div>
  );
}
