export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="w-full max-w-2xl space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-brand-primary">
          Catholizare OS
        </h1>
        <p className="text-lg text-gray-600">
          Plataforma SaaS multi-tenant para práctica terapéutica.
        </p>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-left">
          <h2 className="mb-2 font-semibold text-gray-900">
            Estado del proyecto
          </h2>
          <p className="text-sm text-gray-700">
            Proyecto base configurado. Siguiente paso: arrancar el primer ciclo
            SDD con la historia de usuario T-001 (Login profesional con Google).
          </p>
        </div>
      </div>
    </main>
  );
}
