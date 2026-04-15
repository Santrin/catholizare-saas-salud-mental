# Fase 0 — Setup e infraestructura

**Objetivo:** dejar la plataforma técnica lista para construir el MVP clínico. Todo item sigue **ciclo SDD completo** (decisión P2=A del roadmap maestro).

**Duración estimada:** grano medio (varía por item). No se dan fechas calendario; el roadmap avanza por terminación de items, no por tiempo.

---

## Criterios de cierre de la Fase 0

Fase 0 se cierra (estado global ✅) cuando:

1. Repositorio con ramas protegidas en GitHub, CODEOWNERS configurado, CI bloquea merge a `main` si falla.
2. Ambientes **dev / staging / prod** separados en Supabase y Vercel, con variables de entorno distintas.
3. Login con Google funcional en los 3 ambientes (paciente y profesional).
4. Modelo de datos inicial con RLS por tenant, `audit_log` activo, migraciones versionadas.
5. Shell visual (layouts, navegación, login/logout, estado vacío) deployada en **staging** y revisable.
6. Documento de runbook de setup externo (`docs/doc_setup.md`) escrito y validado manualmente al menos una vez.

---

## Items

| ID | Nombre | Depende de | Tipo | Estado | Carpeta SDD |
|---|---|---|---|---|---|
| P0-001 | Scaffolding local Next.js + Supabase SDK + docs base | — | setup | ✅ | — (hecho en commit `85fb706`, antes del primer ciclo SDD) |
| P0-002 | Ramas protegidas en GitHub + CODEOWNERS | P0-001 | setup | 🟡 | (en refinamiento) |
| P0-003 | Ambientes dev / staging / prod (Supabase Cloud + Vercel hosting) | P0-001 | setup | ⬜ | (pendiente) |
| P0-004 | Supabase Auth + Google OAuth (profesional y paciente) | P0-003 | feature | ⬜ | (pendiente) |
| P0-005 | Modelo de datos inicial + RLS + audit_log | P0-003 | feature | ⬜ | (pendiente) |
| P0-006 | Shell visual (layouts globales, navegación, login/logout) | P0-004, P0-005 | feature | ⬜ | (pendiente) |

---

## Notas de alcance por item

Estas notas son **esqueleto** para arrancar `close-requirement`, no son User Stories cerradas. Cada item abre su entrevista trade-off cuando el Director decida arrancarlo.

### P0-001 — Scaffolding local (✅ hecho)

Commit `85fb706` creó el **scaffolding local** del proyecto:
- Next.js 15 + React 19 + TypeScript 5.6 + Tailwind CSS 3.
- Supabase SSR: **solo el SDK y los clientes** (client, server, admin) — no hay proyectos Supabase Cloud conectados todavía.
- Middleware de sesión (referencia local, no valida contra Supabase real aún).
- Validación de env con Zod (`src/lib/env.ts`).
- `.env.example`, PR template, docs base.
- Symlinks `.claude/`, `.codex/`, `.cursor/` → `ai-specs/`.
- `supabase/config.toml` listo para `supabase start` local con Docker.

**Lo que NO cubre P0-001 y pasa a P0-003:**
- Proyectos reales en Supabase Cloud (dev, staging, prod).
- Cuenta y hosting en Vercel con el repo conectado.
- Dominio `os.catholizare.com` apuntando vía CNAME.
- Variables de entorno configuradas en Vercel dashboard.

Sin Contract formal por ser scaffolding previo al primer ciclo SDD.

### P0-002 — Ramas protegidas en GitHub

Temas a cerrar con `close-requirement`:
- ¿Qué ramas se protegen? (`main` obligatoria; ¿`develop`?).
- ¿Número de reviewers requeridos? (1 Planner + ¿Director también?).
- ¿Se bloquea force-push y auto-merge?
- CODEOWNERS: qué paths revisa el Planner automáticamente (`docs/`, `ai-specs/`, `tasks_for_AI/`, `supabase/migrations/`).
- ¿Se activa CI obligatorio antes de merge? (pnpm lint, type-check, test:unit).
- ¿Se usan conventional commits o formato libre?

### P0-003 — Ambientes separados

Temas a cerrar:
- 3 proyectos Supabase independientes (`catholizare-os-dev`, `-staging`, `-prod`) vs 1 proyecto con schemas separados. El default del architecture doc es **3 proyectos** por aislamiento real.
- Vercel: 3 environments (Development, Preview=Staging, Production) con variables distintas.
- ¿Quién tiene acceso admin a prod? (solo Director; Planner y Implementing Agent sin acceso a prod).
- Política de secretos: Vercel env vars + Supabase dashboard. Nunca en repo.
- Backups: frecuencia y retención (NOM-024 exige mínimo 5 años para expediente; backups automáticos de Supabase con retención adicional).

### P0-004 — Supabase Auth + Google OAuth

Temas a cerrar:
- ¿Signup abierto o por invitación? El `supabase/config.toml` actual lo tiene cerrado (`enable_signup = false`). Los pacientes entran por webhook Amelia, no por signup libre. Decisión: **signup cerrado**, alta vía webhook o invitación manual del Director/profesional.
- Google OAuth: dominios permitidos (¿todos los gmail o solo dominios corporativos para profesionales?).
- Flujo de primer login: cómo se asigna rol (`paciente`, `profesional`, `admin_catholizare`, `sistema`).
- Redirect URIs registrados en Google Cloud Console.
- Email + OTP para pacientes sin Google (vía Resend): ¿se habilita en P0-004 o se difiere?

### P0-005 — Modelo de datos + RLS + audit_log

Temas a cerrar:
- Tablas mínimas: `profiles`, `tenants`, `patients`, `professionals`, `audit_log`.
- Multi-tenancy: un tenant por profesional o tenant compartido Catholizare. Decisión del architecture doc: **tenant = profesional** (cada profesional aísla sus pacientes).
- Política RLS: todo acceso pasa por `auth.uid()` y `tenant_id`. Sin bypass.
- `audit_log`: qué writes registra, formato del payload, quién puede leerlo (solo admin Catholizare y sistema).
- Migraciones versionadas con `supabase db push`.

### P0-006 — Shell visual

Temas a cerrar:
- Rutas: `/login`, `/profesional/*`, `/paciente/*`, `/admin/*` (si aplica en Fase 0).
- Layout global: header con logo, nav lateral, footer, logout.
- Navegación: qué secciones aparecen en el nav lateral en Fase 0 (estado vacío para las que vendrán en Fase 1).
- Diseño: shadcn/ui + paleta Catholizare. ¿Se toma del branding existente de `catholizare.com`?
- Estados vacíos: copy y call-to-action para secciones sin datos aún.
- i18n: solo español en Fase 0 (el equipo trabaja en español).

---

## Próximo paso recomendado

Cuando el Director diga "arranquemos P0-002", el Planner inicia `close-requirement` para ese item. El orden sugerido:

```
P0-002 (ramas) → P0-003 (ambientes) → P0-004 (Auth) → P0-005 (datos+RLS) → P0-006 (shell)
```

Son secuenciales por dependencias; no se pueden paralelizar sin romper el flujo.
