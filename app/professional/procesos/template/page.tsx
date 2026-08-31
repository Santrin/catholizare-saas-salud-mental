import Link from "next/link";

import { requireRole } from "@/lib/auth/profile";
import { getLatestProcessTemplate } from "@/lib/procesos/queries";
import {
  PROCESS_DEFAULT_TEMPLATE_STEPS,
  PROCESS_MODEL_LABEL,
  PROCESS_MODEL_TYPES,
  type ProcessModelType
} from "@/lib/procesos/types";
import { TemplateForm } from "@/components/procesos/template-form";

type ProfessionalProcesoTemplatePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseModelType(value: string | string[] | undefined): ProcessModelType {
  const modelType = firstParam(value);
  return PROCESS_MODEL_TYPES.find((type) => type === modelType) ?? "general";
}

export default async function ProfessionalProcesoTemplatePage({
  searchParams
}: ProfessionalProcesoTemplatePageProps) {
  const [profile, params] = await Promise.all([requireRole(["profesional"]), searchParams]);
  const modelType = parseModelType(params.modelType);
  const template = await getLatestProcessTemplate(profile, modelType);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Enfoques terapeuticos
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">
              Plantilla de proceso terapeutico
            </h1>
            <p className="mt-2 text-sm text-ink/65">
              Los cambios aplican solo a procesos nuevos. Cada enfoque conserva versiones propias.
            </p>
          </div>
          <Link href="/professional/procesos" className="text-sm font-medium text-azulMedio">
            Volver a procesos
          </Link>
        </div>

        <section className="rounded-lg border border-ink/10 bg-white p-4">
          <p className="text-sm font-semibold text-ink">Selecciona enfoque</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PROCESS_MODEL_TYPES.map((type) => (
              <Link
                key={type}
                href={`/professional/procesos/template?modelType=${type}`}
                className={`rounded-md border px-3 py-2 text-sm font-medium ${
                  type === modelType
                    ? "border-azulMedio bg-azulMedio text-white"
                    : "border-ink/15 text-ink"
                }`}
              >
                {PROCESS_MODEL_LABEL[type]}
              </Link>
            ))}
          </div>
        </section>

        <TemplateForm
          modelType={modelType}
          steps={template?.steps ?? PROCESS_DEFAULT_TEMPLATE_STEPS[modelType]}
          version={template?.version}
        />
      </div>
    </main>
  );
}
