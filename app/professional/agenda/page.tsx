import Link from "next/link";

import { CreateAppointmentForm } from "@/components/agenda/create-appointment-form";
import { AppointmentsTable } from "@/components/agenda/appointments-table";
import { AppointmentStatsPanel } from "@/components/agenda/appointment-stats";
import { GoogleCalendarPanel } from "@/components/agenda/google-calendar-panel";
import { PatientAppointmentFilter } from "@/components/agenda/patient-appointment-filter";
import { WeeklyAgenda } from "@/components/agenda/weekly-agenda";
import { ActionDialog } from "@/components/ui/action-dialog";
import { requireRole } from "@/lib/auth/profile";
import {
  getAgendaPatientOptions,
  getAppointmentStatsForProfessional,
  getAppointmentsForProfessional
} from "@/lib/agenda/queries";
import { getGoogleCalendarConnection } from "@/lib/google-calendar/connections";

type ProfessionalAgendaPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProfessionalAgendaPage({ searchParams }: ProfessionalAgendaPageProps) {
  const profile = await requireRole(["profesional"]);
  const params = await searchParams;
  const selectedPatientId = firstParam(params.patientId);
  const [appointments, patients, stats, googleConnection] = await Promise.all([
    getAppointmentsForProfessional(profile, selectedPatientId),
    getAgendaPatientOptions(profile),
    getAppointmentStatsForProfessional(profile, selectedPatientId),
    getGoogleCalendarConnection(profile.id)
  ]);

  return (
    <main className="px-4 py-6 sm:px-6 sm:py-8 xl:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-azulMedio">
              Panel del profesional
            </p>
            <h1 className="mt-1 text-2xl font-bold text-principal sm:text-3xl">Agenda de citas</h1>
            <p className="mt-2 text-sm text-ink/65">
              Gestiona citas programadas, presenciales o por videollamada, para pacientes con
              expediente activo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ActionDialog buttonLabel="Crear cita" title="Programar una nueva cita">
              <CreateAppointmentForm patients={patients} embedded />
            </ActionDialog>
            <Link
              href="/professional"
              className="inline-flex min-h-10 items-center rounded-md bg-principal px-4 text-sm font-bold text-blanco transition hover:bg-secundario"
            >
              Volver al panel
            </Link>
          </div>
        </div>

        <WeeklyAgenda appointments={appointments} />
        <GoogleCalendarPanel connection={googleConnection} />

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5">
            <PatientAppointmentFilter
              patients={patients}
              selectedPatientId={selectedPatientId}
            />
            <AppointmentsTable appointments={appointments} />
          </div>
          <AppointmentStatsPanel stats={stats} />
        </section>
      </div>
    </main>
  );
}
