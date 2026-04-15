# Guía de verificación — Catholizare OS

## Propósito

Usa este documento para elegir el camino correcto de verificación sin redescubrir scripts, servicios o suites de test.

No es un catálogo de todos los comandos. Es una guía curada para:

- chequeos locales rápidos,
- validación de integración,
- validación end-to-end,
- depuración de flujos de auth, expediente y webhooks.

**Regla general:** usa la verificación más barata que pueda detectar el riesgo introducido por el cambio.

---

## Estrategia de verificación

Orden preferido:

1. **Type check** (`pnpm tsc --noEmit`) para cambios que tocan tipos o contratos TS
2. **Lint** (`pnpm lint`) para cambios de estilo y convenciones
3. **Unit tests** (`pnpm test:unit`) para lógica pura, validaciones, scoring de tests
4. **Integration tests** (`pnpm test:integration`) para repositorios, services, policies RLS
5. **E2E tests** (`pnpm test:e2e`) para flujos completos de usuario (login, crear expediente, aplicar test)
6. **Smoke manual** solo cuando los tests son indirectos y necesitas inspeccionar payloads en vivo

**No** usar E2E como default para todo cambio.
**Sí** usar E2E cuando el criterio de éxito real es comportamiento en browser, flujo OAuth, o integración real con Supabase/Resend/Stripe.

---

## Mapa rápido por tipo de cambio

### Cambié lógica pura (domain/)

```bash
pnpm test:unit
```

Mejor para:
- validadores NOM-004
- scoring de tests psicológicos
- reglas del proceso TCC 16 sesiones
- normalizadores de datos del webhook Amelia

### Cambié services/ o repositories/

```bash
pnpm test:integration
```

Mejor para:
- casos de uso que tocan Supabase
- validación de policies RLS
- flujos de escritura en audit_log

Prerrequisito: Supabase local corriendo (`pnpm supabase start`).

### Cambié rutas de app/ o route handlers API

```bash
pnpm test:integration -- <archivo>
# + verificación manual
pnpm dev
```

Para webhooks, además:
```bash
# Simular webhook de Amelia
curl -X POST http://localhost:3000/api/webhooks/amelia \
  -H "Content-Type: application/json" \
  -H "X-Amelia-Signature: <firma>" \
  -d @tests/fixtures/amelia-payload.json
```

### Cambié componentes UI (components/)

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test:unit -- <componente>
```

Si el cambio es visible al usuario, abrir en navegador:
```bash
pnpm dev
# http://localhost:3000
```

### Cambié migraciones SQL (supabase/migrations/)

```bash
pnpm supabase db reset          # Re-aplica todas las migraciones desde cero
pnpm supabase db diff           # Verifica que no haya drift
pnpm test:integration           # Corre tests contra la nueva estructura
```

**Regla crítica:** nunca editar una migración ya committeada. Crear una nueva.

### Cambié clientes externos (lib/wordpress, lib/stripe, lib/resend, lib/zoom)

```bash
pnpm test:integration -- <lib>
```

Para verificación manual con servicios reales, usar entorno de **staging** (nunca producción):
```bash
pnpm dev:staging
```

---

## Comandos de desarrollo base

### Setup inicial

```bash
pnpm install                    # Instalar dependencias
cp .env.example .env.local      # Crear archivo de entorno local
pnpm supabase start             # Levantar Supabase local
pnpm supabase db reset          # Aplicar migraciones iniciales
pnpm dev                        # Correr Next.js en http://localhost:3000
```

### Día a día

```bash
pnpm dev                        # Dev server
pnpm build                      # Build de producción (valida type-check)
pnpm lint                       # ESLint
pnpm lint:fix                   # ESLint con autofix
pnpm format                     # Prettier
pnpm test                       # Todos los tests (unit + integration)
pnpm test:watch                 # Modo watch
pnpm test:e2e                   # Playwright
```

### Supabase local

```bash
pnpm supabase start             # Levantar servicios locales
pnpm supabase stop              # Detener
pnpm supabase status            # Ver estado
pnpm supabase db reset          # Re-aplicar migraciones
pnpm supabase db diff           # Ver cambios entre schema y migrations
pnpm supabase gen types         # Regenerar tipos TypeScript
```

### Deploy

```bash
# Automático al hacer push a main (via Vercel + GitHub Action)
# Manual:
pnpm deploy:staging             # Deploy a entorno de staging
pnpm deploy:production          # Deploy a producción (requiere aprobación)
```

---

## Tests de RLS (críticos para cumplimiento clínico)

Para cada tabla clínica, los integration tests deben cubrir:

1. **Dueño puede leer sus datos**: profesional A lee expedientes de sus pacientes → OK
2. **No-dueño no puede leer**: profesional B intenta leer expedientes de profesional A → bloqueado
3. **Paciente puede leer solo su propio expediente**: paciente asignado → OK
4. **Paciente no puede leer expedientes ajenos**: bloqueado
5. **Sin sesión no puede leer nada**: bloqueado
6. **Writes generan audit_log**: verificar que cada INSERT/UPDATE/DELETE dejó registro

Ubicación: `tests/integration/rls/`

---

## Tests E2E obligatorios por flujo

Cada flujo clínico crítico tiene al menos un test E2E:

| Flujo | Archivo |
|---|---|
| Login profesional con Google | `tests/e2e/auth/login-google.spec.ts` |
| Alta paciente desde webhook Amelia | `tests/e2e/webhooks/amelia-alta.spec.ts` |
| Crear expediente NOM-004 | `tests/e2e/expediente/crear-expediente.spec.ts` |
| Aplicar test psicológico | `tests/e2e/tests/aplicar-test.spec.ts` |
| Registrar nota de sesión | `tests/e2e/sesiones/registrar-nota.spec.ts` |
| Generar PDF de expediente | `tests/e2e/expediente/exportar-pdf.spec.ts` |

---

## Cuándo NO hacer smoke manual

- Cuando existe un test E2E que cubre el flujo → corre el test
- Cuando el cambio es de lógica pura → unit tests son suficientes
- Cuando el cambio es en staging y no puedes reproducirlo en local → usa logs + tracing, no pruebes en ciego

## Cuándo SÍ hacer smoke manual

- Primer smoke después de configurar un servicio externo (Resend, Zoom, Google OAuth)
- Depurar comportamiento de Stripe con eventos reales en staging
- Validar experiencia visual tras cambios de UI

---

## Ciclo fix + rerun del Implementing Agent

Cuando una validación falla:

1. Leer el error completo (no asumir causa).
2. Hacer un cambio mínimo enfocado en la causa.
3. Re-ejecutar la validación exacta que falló.
4. Repetir hasta que pase o hasta identificar un bloqueador real.
5. Si es bloqueador real, marcar `[BLOCKED]` en el Execution Report con:
   - comando ejecutado
   - salida completa del error
   - hipótesis
   - qué se necesita para desbloquear

**Prohibido**: marcar `[x]` una validación sin haberla corrido, o marcar `[SKIPPED]` sin razón documentada.
