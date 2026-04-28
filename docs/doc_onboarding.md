# Onboarding — Catholizare OS

## Para quién es este documento

Para cualquier persona (humano o agente de IA) que entre al proyecto por primera vez y necesite entender qué se está construyendo, con qué herramientas, quién hace qué, y cómo es el ciclo de trabajo día a día.

Lee este documento completo antes de tocar cualquier archivo del repo.

---

## 1. Qué es Catholizare OS

Catholizare OS es una **plataforma SaaS de salud mental** para terapeutas y pacientes en México.

**El problema que resuelve:** Un terapeuta hoy lleva su expediente clínico en papel o en Excel, agenda citas por WhatsApp, y no tiene forma de hacer seguimiento estructurado del proceso terapéutico de cada paciente.

**Lo que construimos:** Un sistema digital donde:
- El paciente llega a través de **Catholizare Care** (el sitio WordPress donde agenda su primera cita).
- El sistema crea automáticamente su expediente clínico.
- El terapeuta lleva un proceso estructurado de **16 sesiones de Terapia Cognitivo-Conductual (TCC)**.
- El paciente completa tests psicológicos en línea.
- El terapeuta accede al expediente, notas de sesión y resultados desde su dashboard.

**Cumplimiento legal:** Todo el manejo de datos clínicos sigue la **NOM-004-SSA3-2012** (expediente clínico) y la **NOM-024-SSA3-2012** (expediente clínico electrónico). Esto no es opcional.

**Modelo de negocio:** SaaS multi-tenant — cada terapeuta es un tenant independiente. Sus datos nunca se mezclan con los de otro terapeuta.

---

## 2. Stack tecnológico

| Capa | Tecnología | Para qué |
|---|---|---|
| Frontend / Backend | Next.js 15 (App Router) + TypeScript | Toda la aplicación web |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui | Componentes visuales |
| Base de datos | Supabase (PostgreSQL) con RLS | Persistencia + aislamiento clínico |
| Autenticación | Supabase Auth + Google OAuth 2.0 | Login de terapeutas |
| Storage | Supabase Storage | Archivos del expediente |
| Email | Resend | Emails transaccionales al paciente |
| Videollamadas | Zoom (Fase 2) | Sesiones remotas |
| Pagos | Stripe (Fase 2) | Suscripciones de terapeutas |
| Hosting | Railway | Deploy automático desde GitHub |
| Repositorio | GitHub / org: Santrin | Control de versiones |

---

## 3. Los actores del proyecto

El proyecto tiene tres actores, cada uno con un rol distinto:

### Product Owner (Jesús)
- Dueño del producto y del negocio.
- Da ideas y funcionalidades en lenguaje simple.
- Aprueba o rechaza los Contracts técnicos.
- Aprueba o rechaza los Pull Requests finales.
- **Herramienta:** Claude Code CLI en su máquina.

### Claude — Planner (`catholizare-planner-bot`)
- Agente de IA que convierte ideas en especificaciones ejecutables.
- **No escribe código de la aplicación.**
- Hace preguntas hasta cerrar los requerimientos.
- Escribe el High-Level Technical Contract y espera aprobación humana.
- Escribe el Implementation Spec para Codex.
- Revisa Pull Requests contra el Contract aprobado.
- Opera en GitHub bajo la cuenta **`catholizare-planner-bot`**: todo commit de spec, todo comentario de revisión, aparece con esa identidad.
- **Herramienta:** Claude Code CLI (sesión del Product Owner).

### Codex — Implementing Agent
- Agente de IA que ejecuta los specs escritos por Claude.
- Lee el `03-spec.md`, implementa el código, escribe migraciones, corre validaciones.
- Abre el Pull Request con el trabajo terminado.
- Si Claude detecta errores en el PR, Codex los corrige.
- **Nunca toma decisiones de arquitectura** — solo ejecuta lo que el spec indica.
- **Herramienta:** Codex CLI en la máquina del operador.

---

## 4. El flujo de trabajo SDD (Spec-Driven Development)

Todo el trabajo sigue este ciclo. No existe código sin spec aprobado.

```
IDEA (Product Owner)
    │
    ▼
CIERRE DE REQUERIMIENTO (Claude — Planner)
  Claude hace preguntas de trade-off hasta cerrar todas las decisiones.
    │
    ▼
HIGH-LEVEL TECHNICAL CONTRACT (Claude — Planner)
  Claude muestra el Contract. Product Owner aprueba o pide ajustes.
  Nada se guarda hasta aprobación explícita.
    │
    ▼ [APROBADO]
    │
    ▼
SPEC DE IMPLEMENTACIÓN (Claude — Planner)
  Claude guarda en tasks_for_AI/<NNN>-<slug>/02-contract.md
  Claude guarda en tasks_for_AI/<NNN>-<slug>/03-spec.md
  Claude hace commit y push como catholizare-planner-bot.
    │
    ▼
IMPLEMENTACIÓN (Codex — Implementing Agent)
  Codex lee el spec.
  Codex escribe código en src/.
  Si hay DB: Codex escribe migración en supabase/migrations/.
  Codex corre validaciones (tsc, lint, tests, supabase).
  Codex abre Pull Request en GitHub.
    │
    ▼
REVISIÓN (Claude — Planner como catholizare-planner-bot)
  Claude lee el PR.
  Claude comenta en GitHub como catholizare-planner-bot.
  Si hay errores → Codex corrige → nueva iteración.
  Si está bien → Claude aprueba.
    │
    ▼
MERGE (Product Owner)
  Product Owner hace merge del PR a main.
  Si hay migración → se aplica a Supabase de staging/producción.
    │
    ▼
DEPLOY AUTOMÁTICO
  Railway detecta el push a main y despliega la nueva versión.
```

---

## 5. Estructura de carpetas (lo que necesitas saber)

```
catholizare-saas-salud-mental/
│
├── docs/                       ← Documentación técnica. LEE ESTO PRIMERO.
│   ├── doc_architecture.md     ← Arquitectura completa del proyecto
│   ├── doc_ai_planning_mode.md ← Reglas del agente Planner
│   ├── doc_verification_guide.md ← Comandos de validación
│   └── doc_onboarding.md       ← Este archivo
│
├── tasks_for_AI/               ← Contratos y specs por funcionalidad
│   ├── README.md               ← Cómo se organizan los specs
│   └── 001-nombre-feature/
│       ├── 01-user-story.md
│       ├── 02-contract.md
│       └── 03-spec.md          ← AQUÍ empieza Codex
│
├── src/                        ← Código de la aplicación (Next.js)
│   ├── app/                    ← Rutas y páginas
│   ├── components/             ← Componentes de UI
│   ├── services/               ← Lógica de negocio (casos de uso)
│   ├── repositories/           ← Acceso a base de datos
│   ├── domain/                 ← Reglas puras (validaciones NOM-004, TCC)
│   ├── lib/                    ← Clientes de servicios externos
│   └── types/                  ← Tipos TypeScript globales
│
├── supabase/                   ← Base de datos
│   ├── migrations/             ← Migraciones SQL versionadas
│   ├── config.toml             ← Config de Supabase CLI local
│   └── seed.sql                ← Datos de prueba (solo dev)
│
├── tests/
│   ├── unit/                   ← Tests de lógica pura
│   ├── integration/            ← Tests contra Supabase local
│   └── e2e/                    ← Tests de flujo completo (Playwright)
│
├── CLAUDE.md                   ← Instrucciones para el agente Planner (Claude)
├── .env.example                ← Variables de entorno requeridas
└── package.json
```

---

## 6. Setup inicial — primer día en el proyecto

### Prerrequisitos (instalar una sola vez)

```bash
# Node.js 20 LTS
node --version   # debe ser v20.x

# pnpm
npm install -g pnpm

# Claude Code CLI (para el Planner)
npm install -g @anthropic-ai/claude-code

# Codex CLI (para el Implementing Agent)
npm install -g @openai/codex

# Supabase CLI
npm install -g supabase

# GitHub CLI
# macOS: brew install gh
# Linux: ver https://cli.github.com
gh --version
```

### Clonar y configurar el proyecto

```bash
# 1. Clonar el repo
git clone https://github.com/Santrin/catholizare-saas-salud-mental.git
cd catholizare-saas-salud-mental

# 2. Instalar dependencias
pnpm install

# 3. Crear archivo de entorno local
cp .env.example .env.local
# Editar .env.local con los valores reales (ver sección 7)

# 4. Autenticarse en GitHub CLI con la cuenta del bot o la propia
gh auth login

# 5. Levantar Supabase local
pnpm supabase start
# Guarda las keys que imprime en pantalla → van a .env.local

# 6. Aplicar migraciones
pnpm supabase db reset

# 7. Levantar el servidor de desarrollo
pnpm dev
# Abrir http://localhost:3000
```

### Verificar que todo funciona

```bash
pnpm tsc --noEmit    # Sin errores de TypeScript
pnpm lint            # Sin errores de ESLint
pnpm test:unit       # Tests unitarios en verde
```

---

## 7. Variables de entorno requeridas

Las variables van en `.env.local` (nunca se commitea).

| Variable | Descripción | Dónde obtenerla |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase local | `pnpm supabase start` imprime esto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase | `pnpm supabase start` imprime esto |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (solo server) | `pnpm supabase start` imprime esto |
| `RESEND_API_KEY` | API key de Resend | resend.com → API Keys |
| `RESEND_FROM_EMAIL` | Email remitente | `no-reply@catholizare.com` |
| `CATHOLIZARE_CARE_API_URL` | URL del WordPress de Care | Preguntar a Jesús |
| `AMELIA_WEBHOOK_SECRET` | Secreto para validar webhooks | Preguntar a Jesús |

Para staging/producción, estas variables están configuradas en Railway y en el dashboard de Supabase — nunca en el código.

---

## 8. El paso a paso de un ciclo completo

Este es el flujo operativo real, con cada actor y cada herramienta en su momento exacto.

---

### PASO 1 — Product Owner activa a Claude (Planner)

**Quién:** Product Owner (Jesús)
**Herramienta:** Claude Code CLI en su máquina

```bash
cd catholizare-saas-salud-mental
claude
```

El Product Owner describe la funcionalidad que quiere en español y en lenguaje simple.

---

### PASO 2 — Claude cierra el requerimiento

**Quién:** Claude (Planner)
**Acción:** Hace preguntas de trade-off (A vs B) hasta que todas las decisiones están cerradas. No escribe ningún archivo todavía.

---

### PASO 3 — Claude presenta el Contract y espera aprobación

**Quién:** Claude (Planner)
**Acción:** Muestra el High-Level Technical Contract en pantalla. El Product Owner lee y dice "aprobado" o pide ajustes. Claude no guarda nada hasta escuchar aprobación explícita.

El Contract incluye:
- Qué se construye y qué queda fuera
- Qué rutas o componentes se crean o modifican
- Qué tablas de Supabase se tocan y con qué políticas RLS
- Si genera entrada en `audit_log`
- Cómo se valida que está bien hecho

---

### PASO 4 — Claude guarda los archivos y hace push como `catholizare-planner-bot`

**Quién:** Claude (Planner) — opera en GitHub como `catholizare-planner-bot`
**Acción:** Guarda dos archivos en el repo:

```
tasks_for_AI/
  <NNN>-<slug>/
    02-contract.md    ← el contrato aprobado
    03-spec.md        ← instrucciones exactas para Codex
```

Hace commit y push a GitHub. En el historial de GitHub el autor aparece como **`catholizare-planner-bot`**, no como el Product Owner.

---

### PASO 5 — Product Owner activa a Codex (Implementing Agent)

**Quién:** Product Owner (o desarrollador asignado)
**Herramienta:** Codex CLI, en la misma carpeta del proyecto

```bash
codex
```

Le dice a Codex:

> *Ejecuta el spec que está en `tasks_for_AI/<NNN>-<slug>/03-spec.md`*

Codex lee el archivo completo y trabaja solo.

---

### PASO 6 — Codex implementa el código

**Quién:** Codex (Implementing Agent)
**Acción:** Ejecuta el spec paso a paso. Los sub-pasos dependen de qué toque la funcionalidad:

#### 6a — Escribe el código de la aplicación
Codex modifica o crea archivos en `src/` según el spec.

#### 6b — Si la funcionalidad toca la base de datos: escribe la migración
```
supabase/migrations/YYYYMMDDHHMMSS_nombre-migracion.sql
```
La migración incluye: creación de tablas, columnas, índices, políticas RLS, triggers de audit_log.

**Regla crítica:** nunca modificar una migración ya committeada. Siempre crear una nueva.

#### 6c — Aplica la migración en Supabase local para validar que no rompe nada
```bash
pnpm supabase db reset
# Re-aplica TODAS las migraciones desde cero en el entorno local.
# Si algo falla aquí, la migración tiene un error de SQL.
```

#### 6d — Regenera los tipos TypeScript desde el esquema actualizado
```bash
pnpm supabase gen types
# Actualiza src/types/database.ts con los nuevos tipos.
# Codex debe correr esto después de cualquier cambio de esquema.
```

#### 6e — Corre las validaciones del spec
```bash
pnpm tsc --noEmit        # Sin errores de tipos
pnpm lint                # Sin errores de ESLint
pnpm test:unit           # Tests unitarios en verde
pnpm test:integration    # Tests de integración contra Supabase local
```

Si alguna validación falla: Codex lee el error, hace el cambio mínimo necesario, y vuelve a correr la validación. Repite hasta que pase o identifica un bloqueador real.

#### 6f — Hace commit con todos los cambios

```bash
git add <archivos específicos>
git commit -m "feat: descripción de lo implementado"
git push origin feature/<NNN>-<slug>
```

#### 6g — Abre el Pull Request en GitHub

```bash
gh pr create \
  --title "feat: <nombre de la funcionalidad>" \
  --body "Implementación del spec tasks_for_AI/<NNN>-<slug>/03-spec.md"
```

---

### PASO 7 — Claude revisa el PR como `catholizare-planner-bot`

**Quién:** Product Owner reactiva Claude
**Herramienta:** Claude Code CLI

```bash
claude
# Le dice: "Revisa el PR #<número>"
```

**Acción de Claude:** Lee el PR en GitHub, lo compara contra el `02-contract.md` aprobado. Verifica:
- ¿Se implementó todo lo que decía el spec?
- ¿Se implementó algo que el spec NO decía? (eso es drift — no es aceptable)
- ¿Las políticas RLS están correctas?
- ¿Se generó el audit_log donde corresponde?
- ¿Los tests cubren los escenarios críticos?

Claude deja sus comentarios en el PR de GitHub. En GitHub el autor de los comentarios es **`catholizare-planner-bot`**.

---

### PASO 8 — Codex corrige los errores detectados (si aplica)

**Quién:** Product Owner reactiva Codex
**Acción:**

```bash
codex
# Le dice: "Lee los comentarios del PR #<número> y corrígelos"
```

Codex lee los comentarios de `catholizare-planner-bot`, hace las correcciones, pushea. El PR se actualiza automáticamente.

Se repiten los Pasos 7 y 8 hasta que Claude aprueba el PR.

---

### PASO 9 — Product Owner hace merge del PR

**Quién:** Product Owner (Jesús)
**Herramienta:** GitHub (web o CLI)

```bash
gh pr merge <número> --squash
```

---

### PASO 10 — Se aplica la migración en Supabase de staging/producción (si hubo cambios de BD)

**Quién:** Product Owner (o el responsable de deploy)
**Cuándo:** Solo si el PR incluía archivos en `supabase/migrations/`

```bash
# Apuntar al proyecto de Supabase de producción/staging
supabase link --project-ref <project-ref-de-supabase>

# Aplicar la migración
supabase db push
```

Este comando aplica las migraciones pendientes al proyecto real de Supabase. El código ya está en Railway (desplegó automáticamente al hacer merge), pero la base de datos necesita este paso por separado.

---

### PASO 11 — Deploy automático en Railway

**Automático.** Railway detecta el push a `main` y despliega la nueva versión del frontend/backend. No requiere acción manual.

---

## 9. Resumen visual del ciclo completo

```
Product Owner (idea)
    │
    ▼
Claude Planner
  ├─ Hace preguntas → cierra requerimiento
  ├─ Escribe Contract → espera aprobación
  └─ Guarda spec → push como catholizare-planner-bot
    │
    ▼
Codex Implementing Agent
  ├─ Lee 03-spec.md
  ├─ Escribe código en src/
  ├─ [Si hay BD] Escribe migración en supabase/migrations/
  ├─ [Si hay BD] pnpm supabase db reset → valida migración
  ├─ [Si hay BD] pnpm supabase gen types → actualiza tipos
  ├─ pnpm tsc --noEmit + pnpm lint + pnpm test
  └─ Abre Pull Request en GitHub
    │
    ▼
Claude Planner (como catholizare-planner-bot)
  ├─ Lee el PR
  ├─ Comenta errores en GitHub
  └─ Si hay errores → Codex corrige → loop
    │
    ▼ [PR aprobado]
Product Owner
  ├─ Hace merge del PR
  └─ [Si hay BD] supabase db push → aplica migración en prod/staging
    │
    ▼
Railway (automático)
  └─ Detecta push a main → despliega nueva versión
```

---

## 10. Reglas que no se rompen

1. **No existe código sin spec aprobado.** Nada entra a `src/` sin pasar por el ciclo SDD.
2. **No se deshabilita RLS** en ninguna tabla clínica, ni en dev, ni en tests.
3. **No se usan datos reales de pacientes** en dev o staging.
4. **No se commitean secretos.** `.env.local` está en `.gitignore`.
5. **No se modifica una migración ya committeada.** Siempre migración nueva.
6. **No se mezclan dos funcionalidades en un mismo PR.** Un spec = un PR.
7. **El Implementing Agent no toma decisiones de arquitectura.** Si el spec es ambiguo, bloquea y pregunta, no improvisa.

---

## 11. Primeros pasos para un colaborador nuevo

1. Lee `docs/doc_architecture.md` — entiende la estructura de capas del código.
2. Lee `docs/doc_verification_guide.md` — entiende qué comandos correr y cuándo.
3. Lee `tasks_for_AI/README.md` — entiende cómo están organizados los specs.
4. Completa el setup del Paso 6 de este documento.
5. Busca el primer spec disponible en `tasks_for_AI/` con estado "Spec en ejecución" (tiene `03-spec.md` pero no tiene PR abierto).
6. Abre Codex, apúntalo al spec, y arranca.

Si tienes dudas sobre el producto o el negocio, pregunta a Jesús. Si tienes dudas sobre el spec, pregunta a Claude.
