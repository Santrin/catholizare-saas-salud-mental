# Arquitectura — Catholizare OS

## Propósito

Este documento es la **guía canónica de arquitectura** para los agentes de IA (Planner e Implementing Agent) que trabajan en este repositorio.

Úsalo para decidir:

1. dónde vive cada archivo nuevo,
2. cómo se estructuran los módulos,
3. cómo se organizan los flujos principales en runtime,
4. qué contratos y límites no se deben cambiar por accidente.

Para comandos de verificación concretos, consulta [`docs/doc_verification_guide.md`](./doc_verification_guide.md).

---

## Principios rectores

1. **Plataforma SaaS multi-tenant vertical** para terapeutas y pacientes. No es software de clínica tradicional.
2. **Multi-tenant desde el día 1**: separación estricta entre datos globales y datos privados por tenant.
3. **Cumplimiento NOM-004-SSA3-2012 y NOM-024-SSA3-2012** (expediente clínico y expediente clínico electrónico) no es opcional.
4. **Row Level Security (RLS) de Postgres** es el mecanismo primario de aislamiento de datos clínicos.
5. **Mínimo acceso por rol**: paciente, profesional, admin Catholizare, sistema.
6. **Bitácora de accesos al expediente**: toda lectura/escritura de datos clínicos queda registrada.
7. **Secretos fuera del código**: variables de entorno exclusivamente.
8. **Ambientes separados**: dev, staging, producción.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript |
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui |
| Base de datos | Supabase (PostgreSQL administrado) con RLS |
| Autenticación | Supabase Auth + Google OAuth 2.0 |
| Storage | Supabase Storage (buckets privados + URLs firmadas) |
| Email transaccional | Resend |
| Videollamadas | Zoom Server-to-Server OAuth (Fase 2) |
| Pagos | Stripe (ya en uso en Care y Pro) |
| Facturación CFDI MX | Facturapi (Fase 2) |
| Hosting frontend | Vercel |
| Repositorio | GitHub |

---

## Estructura del proyecto (fuente de verdad)

El código vive bajo `src/` con estructura de App Router de Next.js.

```
src/
├── app/                    # App Router — rutas y layouts
│   ├── (marketing)/        # Rutas públicas (landing, precios)
│   ├── (auth)/             # Login, registro, recuperación
│   ├── (app)/              # Zona autenticada
│   │   ├── paciente/       # Dashboard y flujos del paciente
│   │   ├── profesional/    # Dashboard y flujos del profesional
│   │   └── admin/          # Dashboard del admin Catholizare
│   ├── api/                # Route handlers (webhooks, integraciones)
│   │   ├── webhooks/
│   │   │   └── amelia/     # Webhook de alta desde Catholizare Care
│   │   └── ...
│   ├── layout.tsx          # Layout raíz
│   └── page.tsx            # Landing
│
├── components/             # Componentes de UI reutilizables
│   ├── ui/                 # Primitivos de shadcn/ui
│   ├── forms/              # Formularios clínicos
│   ├── expediente/         # Componentes del expediente
│   └── agenda/             # Componentes de agenda/sesiones
│
├── lib/                    # Utilidades y clientes de servicios
│   ├── supabase/           # Clientes Supabase (server, client, admin)
│   ├── resend/             # Cliente de Resend (emails)
│   ├── wordpress/          # Cliente API REST de Catholizare Care
│   ├── stripe/             # Cliente Stripe (solo lectura de eventos en Fase 1)
│   └── zoom/               # Cliente Zoom (Fase 2)
│
├── services/               # Casos de uso (lógica de aplicación)
│   ├── auth/               # Registro, login, sesión
│   ├── expediente/         # CRUD del expediente clínico
│   ├── agenda/             # Gestión de citas y sesiones TCC
│   ├── tests-psicologicos/ # Aplicación y scoring de tests
│   ├── notas-sesion/       # Creación y consulta de notas
│   ├── recomendaciones/    # Recomendación de 3 posts por sesión
│   └── pacientes/          # Alta desde webhook Amelia
│
├── domain/                 # Reglas puras y transformaciones
│   ├── expediente/         # Validaciones NOM-004/024
│   ├── tcc/                # Estructura del proceso TCC 16 sesiones
│   ├── tests/              # Interpretación y scoring
│   └── errors/             # Errores tipados de dominio
│
├── repositories/           # Operaciones de persistencia con significado
│   ├── paciente-repository.ts
│   ├── expediente-repository.ts
│   ├── sesion-repository.ts
│   ├── nota-repository.ts
│   ├── test-repository.ts
│   └── audit-log-repository.ts
│
├── middleware.ts           # Middleware de sesión Supabase
│
└── types/                  # Tipos globales TypeScript
    └── database.ts         # Tipos generados de Supabase
```

### Infraestructura y operación

```
supabase/
├── config.toml             # Config local de Supabase CLI
├── migrations/             # Migraciones SQL versionadas
└── seed.sql                # Datos de ejemplo (solo dev)

tests/
├── unit/                   # Lógica pura, rápidos
├── integration/            # Integración con Supabase de test
└── e2e/                    # Playwright, flujos completos

ai-specs/                   # Canonical de SDD (agentes, skills, comandos)
tasks_for_AI/               # Contracts y specs generados por el Planner
docs/                       # Documentación técnica del proyecto
.github/                    # Templates de PR, workflows
```

---

## Flujos principales (puntos de entrada)

Usa estas rutas para orientarte rápido:

### Alta automática de paciente desde Catholizare Care
- Entrada: `POST /api/webhooks/amelia`
- Flujo: validación de firma → normalización de datos → `services/pacientes/crear-desde-amelia.ts` → inserta en `public.pacientes` → envía email de bienvenida vía Resend → retorna 200
- Archivos: `src/app/api/webhooks/amelia/route.ts`, `src/services/pacientes/crear-desde-amelia.ts`

### Login del profesional con Google
- Entrada: `/login` → botón OAuth Google
- Flujo: redirect a Google → callback `/auth/callback` → Supabase crea sesión → middleware valida rol → redirect a `/profesional/dashboard`
- Archivos: `src/app/(auth)/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/middleware.ts`

### Expediente clínico del paciente
- Entrada: `/profesional/pacientes/[id]/expediente`
- Flujo: middleware de sesión → verificación de ownership (profesional asignado) → `repositories/expediente-repository.ts` con RLS → render + audit log
- Archivos: `src/app/(app)/profesional/pacientes/[id]/expediente/page.tsx`, `src/services/expediente/*`

### Aplicación de test psicológico
- Entrada: `/paciente/tests/[test-id]`
- Flujo: verificación de asignación → presentación de ítems → cálculo de score → persistencia en `test_resultados` → notificación al profesional
- Archivos: `src/app/(app)/paciente/tests/[testId]/page.tsx`, `src/services/tests-psicologicos/*`

### Recomendación de 3 posts por sesión
- Se ejecuta tras crear cada nota de sesión
- Flujo: lee motivo de consulta + categorías mapeadas → consulta WP REST API de Care → filtra 3 posts → guarda referencia (no el contenido)
- Archivos: `src/services/recomendaciones/*`, `src/lib/wordpress/client.ts`

---

## Responsabilidades por capa

### `app/` (transporte HTTP)
- Rutas, layouts, páginas, route handlers.
- Solo recibe requests, llama a `services/`, devuelve respuesta.
- **Prohibido**: lógica de negocio dentro de rutas.

### `services/`
- Orquestación de casos de uso.
- Coordina `repositories/` + `lib/` (clientes externos).
- Valida entradas del caso de uso.
- Mapea salidas del dominio al formato de respuesta.

### `domain/`
- Lógica pura: validaciones NOM-004, reglas del proceso TCC, scoring de tests.
- Independiente de HTTP y SDKs externos.

### `repositories/`
- Operaciones de persistencia con intención de negocio.
- Usa los clientes de Supabase desde `lib/supabase/`.
- Los métodos expresan intención ("obtener expediente del paciente X"), no SQL crudo.

### `lib/`
- Clientes de bajo nivel a servicios externos.
- Inicialización, auth, configuración de SDKs.
- **Prohibido**: lógica de negocio.

### `middleware.ts`
- Valida sesión de Supabase en cada request a zona autenticada.
- Redirige a `/login` si no hay sesión.
- Adjunta rol y tenant al contexto.

---

## Reglas de multi-tenancy y RLS

### Tenants
- Un **tenant = un profesional** en Fase 1 (cada profesional es su propio aislamiento).
- Tenant global: **Catholizare** (datos compartidos: catálogo de tests, plantillas de consentimiento).

### Convenciones de tablas
- Toda tabla clínica tiene columna `profesional_id` (UUID, FK a `auth.users`).
- Toda tabla tiene `created_at`, `updated_at`, `created_by`, `updated_by`.
- Tablas sensibles tienen trigger de `audit_log`.

### RLS obligatorio
Para cada tabla clínica:
- Política `SELECT`: solo si `auth.uid() = profesional_id` **o** el usuario actual es paciente asignado a ese expediente.
- Política `INSERT/UPDATE/DELETE`: solo profesional dueño.
- Rol `service_role` solo se usa en server actions o route handlers protegidos.

**Prohibido**: deshabilitar RLS en ninguna tabla clínica, ni siquiera temporalmente en dev.

---

## Reglas de colocación de archivos

Cuando agregues código, decide por intención:

1. Ruta nueva → `app/(segmento)/ruta/page.tsx` o `app/api/ruta/route.ts`
2. Caso de uso nuevo → `services/<bounded_context>/`
3. Regla pura o validación → `domain/<subdomain>/`
4. Persistencia con significado de negocio → `repositories/`
5. Adaptador a servicio externo → `lib/<proveedor>/`
6. Componente UI → `components/<contexto>/`
7. Tipo global → `types/`

Si un módulo necesita tanto SDK de proveedor como lógica de negocio, divídelo:
- Setup del SDK en `lib/`
- Operaciones de negocio en `repositories/` o `services/`

---

## Contratos de API y salida

Preservar contratos existentes a menos que la tarea explícitamente los cambie.

Ejemplos:
- Respuesta del webhook Amelia debe retornar `{ ok: true, paciente_id: string }` o error HTTP.
- Shape de expediente al exportar a PDF debe mantener campos requeridos por NOM-024.

---

## Manejo de errores

Usar errores tipados de `domain/errors`:

- `ValidationError` → input inválido (HTTP 400)
- `DomainError` → regla de dominio violada (HTTP 422)
- `AuthorizationError` → sin permiso (HTTP 403)
- `NotFoundError` → recurso no existe (HTTP 404)
- `InfrastructureError` → falla Supabase, Resend, etc. (HTTP 500/503)
- `ExternalServiceError` → falla en Care, Pro, Zoom, Stripe (HTTP 502)

**Prohibido**: exponer errores crudos de SDK a capas superiores o al cliente.

---

## Configuración y entorno

- Runtime: Node 20 LTS
- Package manager: `pnpm` (preferido) o `npm`
- Variables de entorno en `.env.local` (dev) y Vercel (staging/prod)
- Ver `.env.example` para la lista canónica de variables

---

## Anti-patrones (no introducir)

- Lógica de negocio en `app/api/*/route.ts` o en páginas
- Query semántica a Supabase en `lib/`
- Exponer errores de SDK al cliente
- Duplicar la misma responsabilidad en varias capas
- Deshabilitar RLS
- Usar el `service_role` de Supabase en el cliente (browser)
- Hardcodear secretos en el código
- Crear tablas sin RLS ni audit_log cuando son clínicas
- Usar datos reales de paciente en entornos dev/staging
