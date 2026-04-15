# Catholizare OS

Plataforma SaaS multi-tenant para práctica terapéutica, expediente clínico, marketplace y acompañamiento TCC.

**Producción:** [os.catholizare.com](https://os.catholizare.com) (en desarrollo)

---

## Visión general

Catholizare OS es el sistema clínico central del ecosistema Catholizare. Se conecta con:

- **Catholizare Care** ([catholizare.com](https://catholizare.com)) — catálogo, reserva y pago. WordPress + Elementor + Amelia + Stripe. Envía pacientes a OS vía webhook.
- **Catholizare Pro** ([profesionales.catholizare.com](https://profesionales.catholizare.com)) — cursos y mentorías para profesionales. WordPress.
- **Zoom** — clínica virtual (Fase 2).

OS implementa el proceso TCC completo de 16 sesiones: intake, consentimiento, historia clínica, conceptualización del caso, plan de tratamiento, tests psicológicos, notas de sesión, re-evaluaciones y alta.

Cumplimiento obligatorio: **NOM-004-SSA3-2012** y **NOM-024-SSA3-2012**.

---

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4**
- **Supabase** (PostgreSQL + Auth + Storage + RLS)
- **Resend** (email transaccional)
- **Stripe** (lectura de eventos en Fase 1, cobros en Fase 2)
- **Hosting:** Vercel (frontend + API routes), Supabase Cloud (DB + Auth)

Detalle arquitectónico: [`docs/doc_architecture.md`](docs/doc_architecture.md)

---

## Metodología — Spec-Driven Development (SDD)

Este repo implementa el flujo SDD con **dos agentes de IA colaborando**:

| Agente | Rol | Modelo | Tooling |
|---|---|---|---|
| **Planner** | Cierra requisitos, escribe Contracts y Specs, revisa PRs | Claude Opus 4.6 | Claude Code |
| **Implementing Agent** | Ejecuta specs aprobados, escribe código y tests, abre PRs | GPT-5 | Codex CLI |

**Product Owner humano** aprueba cada Contract antes de que se escriba código.

### Ciclo SDD aplicado

```
USER STORY → DECISION-CLOSED REFINEMENT → HIGH-LEVEL TECHNICAL CONTRACT →
IMPLEMENTATION SPEC → [IMPLEMENTING AGENT + SPEC REVIEW (loop)] →
FEATURE READY → FEATURE FOR PR → FEATURE PUBLISHED
```

Documentación:
- [`CLAUDE.md`](CLAUDE.md) — instrucciones del Planner
- [`docs/doc_ai_planning_mode.md`](docs/doc_ai_planning_mode.md) — reglas de planificación
- [`docs/doc_verification_guide.md`](docs/doc_verification_guide.md) — cómo validar cada tipo de cambio
- [`tasks_for_AI/README.md`](tasks_for_AI/README.md) — estructura de contracts y specs

---

## Estructura del repositorio

```
├── .claude/ .codex/ .cursor/    # Symlinks a ai-specs/ (multi-copilot)
├── ai-specs/                     # Canonical: agentes, skills, commands
├── tasks_for_AI/                 # Contracts y specs por funcionalidad
├── docs/                         # Arquitectura, planning mode, verificación
├── src/
│   ├── app/                      # Next.js App Router
│   ├── components/               # UI
│   ├── lib/                      # Clientes Supabase, Resend, etc.
│   ├── services/                 # Casos de uso
│   ├── domain/                   # Reglas puras (NOM, TCC, tests)
│   ├── repositories/             # Persistencia con significado
│   └── middleware.ts             # Sesión Supabase
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   └── seed.sql
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── .github/                      # PR template, workflows
├── CLAUDE.md                     # Instrucciones del Planner
├── package.json
└── README.md                     # ← este archivo
```

---

## Setup local

### Prerrequisitos

- Node.js 20 LTS o superior
- pnpm 9 (o npm)
- Docker Desktop (para Supabase local)
- Cuenta en [Supabase](https://supabase.com) y [Vercel](https://vercel.com) (solo para staging/prod)

### Primera vez

```bash
# 1. Clonar el repo
git clone https://github.com/Jesuscatholizare/catholizare-saas-salud-mental.git
cd catholizare-saas-salud-mental

# 2. Instalar dependencias
pnpm install

# 3. Crear archivo de entorno local
cp .env.example .env.local
# Editar .env.local con los valores reales

# 4. Levantar Supabase local (requiere Docker)
pnpm supabase:start

# 5. Aplicar migraciones y seed
pnpm supabase:reset

# 6. Correr Next.js
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

### Día a día

```bash
pnpm dev                  # Next.js dev server
pnpm lint                 # ESLint
pnpm type-check           # TypeScript
pnpm test                 # Unit + integration
pnpm test:e2e             # Playwright
pnpm supabase:gen-types   # Regenerar tipos de DB
```

---

## Fases del proyecto

### Fase 1 — MVP (actual)

Funcionalidades:

1. Login profesional (Supabase Auth + Google OAuth)
2. Login paciente (email + Google)
3. Webhook Amelia → alta automática de paciente
4. Dashboard profesional y paciente
5. Expediente clínico NOM-004 completo
6. Agenda con estructura TCC 16 sesiones
7. Notas de sesión estructuradas
8. Conceptualización del caso editable
9. Plan de tratamiento editable
10. Aplicación de tests psicológicos (4 iniciales + re-evaluaciones en sesiones 8 y 14)
11. Recomendación de 3 posts por sesión al paciente (vía WP REST API de Care)
12. Recordatorios automáticos por correo (Resend)
13. Generación de PDF del expediente al alta
14. Roles y permisos: paciente, profesional, admin Catholizare, sistema

Fuera de alcance en Fase 1: sincronización Google Calendar, Zoom integrado, chat, pagos dentro de OS, facturación CFDI, recepcionista, coordinación, IA revisión de casos.

### Fase 2

- Google Calendar (escritura unidireccional OS → Google)
- Zoom integrado
- Chat paciente-profesional
- Pagos/membresías dentro de OS
- Facturación CFDI vía Facturapi
- Recepcionista
- Dashboard administrativo Catholizare

### Fase 3

- Google Calendar bidireccional
- Coordinación clínica / supervisión
- IA revisión de casos
- Contador invitado

---

## Equipo

- **Director / Product Owner** — Jesús Catholizare
- **Directora de ejecución y contabilidad**
- **Experto clínico en TCC / Psicólogo**
- **Diseñador gráfico**
- **Abogado externo**
- **Planner agent** — Claude Opus 4.6
- **Implementing Agent** — GPT-5 (Codex)

---

## Licencia

Propietario. Todos los derechos reservados © Catholizare 2026.

---

## Créditos

Framework SDD inspirado en el trabajo de [Javier Vargas](https://www.linkedin.com/in/javiervargascaro/) (LIDR.co / AI4Devs).
