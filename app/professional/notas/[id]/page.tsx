import Link from "next/link";

import { prepareNotaExportAction } from "@/app/notas/actions";
import { requireRole } from "@/lib/auth/profile";
import { getNotaClinicaDetail } from "@/lib/notas/queries";
import { AnnulNotaForm } from "@/components/notas/annul-nota-form";
import { NotaDetailForm } from "@/components/notas/nota-detail-form";

type NotaClinicaDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function NotaClinicaDetailPage({ params }: NotaClinicaDetailPageProps) {
  const [{ id }, profile] = await Promise.all([params, requireRole(["profesional"])]);
  const note = await getNotaClinicaDetail(profile, id);
  const canExport = ["confirmada", "con_addendum", "exportada"].includes(note.status);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Nota clinica
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">{note.note_type}</h1>
            <p className="mt-2 text-sm text-ink/65">
              Fecha: {new Date(note.session_date).toLocaleDateString("es-MX")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/professional/expedientes/${note.expediente_id}`}
              className="inline-flex min-h-10 items-center rounded-md bg-principal px-4 text-sm font-bold text-blanco transition hover:bg-secundario"
            >
              Volver al expediente
            </Link>
            {canExport ? (
              <form action={prepareNotaExportAction}>
                <input type="hidden" name="noteId" value={note.id} />
                <button
                  type="submit"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-azulMedio px-4 text-sm font-semibold text-white transition hover:bg-ink"
                >
                  Exportar PDF
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <NotaDetailForm note={note} />
        <AnnulNotaForm note={note} />
      </div>
    </main>
  );
}
