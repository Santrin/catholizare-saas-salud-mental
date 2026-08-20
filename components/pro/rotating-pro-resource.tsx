"use client";

import { useEffect, useState } from "react";

import type { ProResource } from "@/lib/pro/types";

type RotatingProResourceProps = {
  resources: ProResource[];
  initialBucket: number;
};

const ROTATION_MS = 10 * 60 * 1000;

function resourceIndex(bucket: number, length: number) {
  const mixedBucket = Math.imul(bucket ^ (bucket >>> 16), 0x45d9f3b);
  return (mixedBucket >>> 0) % length;
}

export function RotatingProResource({ resources, initialBucket }: RotatingProResourceProps) {
  const [bucket, setBucket] = useState(initialBucket);

  useEffect(() => {
    const refreshBucket = () => setBucket(Math.floor(Date.now() / ROTATION_MS));
    const timer = window.setInterval(refreshBucket, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const publicResources = resources.filter((resource) => resource.id.startsWith("public-resource-"));
  const availableResources = publicResources.length > 0 ? publicResources : resources;

  if (availableResources.length === 0) {
    return null;
  }

  const resource = availableResources[resourceIndex(bucket, availableResources.length)];

  return (
    <section>
      <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">Recurso recomendado</p>
      <h2 className="mt-1 text-xl font-bold text-principal">Una lectura para tu practica</h2>
      <article className="mt-4 grid overflow-hidden rounded-lg border border-principal/10 bg-blanco sm:grid-cols-[13rem_minmax(0,1fr)]">
        {resource.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resource.image_url}
            alt=""
            className="h-44 w-full object-cover sm:h-full"
            loading="lazy"
          />
        ) : (
          <div className="min-h-3 bg-enfasis sm:min-h-full" />
        )}
        <div className="p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-azulMedio">{resource.category}</p>
          <h3 className="mt-2 text-lg font-bold text-principal">{resource.title}</h3>
          <p className="mt-2 text-sm leading-6 text-principal/65">{resource.description}</p>
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex min-h-10 items-center rounded-md bg-azulMedio px-4 text-sm font-bold text-blanco transition hover:bg-secundario"
          >
            Ver publicacion
          </a>
          <p className="mt-3 text-xs text-principal/45">La recomendacion cambia cada 10 minutos.</p>
        </div>
      </article>
    </section>
  );
}
