# Roadmap — Catholizare OS

Documento maestro con el desglose de trabajo por fase. Cada fila corresponde a un **item** que se convertirá en un **ciclo SDD** (carpeta en `tasks_for_AI/<NNN>-<slug>/`) cuando arranque.

> Este roadmap es el **backlog vivo** del proyecto. Actualizar el estado de cada item conforme avanza su ciclo SDD.

---

## Índice de fases

| Fase | Nombre | Archivo | Estado global |
|---|---|---|---|
| 0 | Setup e infraestructura | [roadmap-fase-0.md](roadmap-fase-0.md) | 🟠 en curso |
| 1 | MVP clínico | [roadmap-fase-1.md](roadmap-fase-1.md) | ⬜ pendiente |
| 2 | Expansión operativa | [roadmap-fase-2.md](roadmap-fase-2.md) | ⬜ pendiente |
| 3 | Optimización e IA | [roadmap-fase-3.md](roadmap-fase-3.md) | ⬜ pendiente |

---

## Estados usados en las tablas

| Símbolo | Significado | Archivos presentes en `tasks_for_AI/<NNN>-<slug>/` |
|---|---|---|
| ⬜ | Pendiente — en backlog, sin ciclo iniciado | (no existe carpeta) |
| 🟡 | Contract en revisión — user story cerrada, Contract esperando aprobación | `01-user-story.md` |
| 🟠 | Spec en ejecución — Codex trabajando | `01-user-story.md`, `02-contract.md`, `03-spec.md` |
| 🟢 | En PR — esperando review del Planner y merge del Director | los 3 + rama abierta con PR |
| ✅ | Publicado — merged a `main` | los 3 + Execution Report completo |

---

## Cómo se convierte una fila del roadmap en un ciclo SDD

Cada fila con ID (ej. `P0-004`, `F1-006`) sigue este ciclo:

1. **Backlog (⬜)** — existe solo como fila en el roadmap. No hay carpeta.
2. **Inicio de ciclo** — el Director le dice al Planner "vamos con P0-004". El Planner:
   - Ejecuta `close-requirement` (skill `enrich-user-story`) contigo hasta cerrar todas las decisiones abiertas.
   - Crea `tasks_for_AI/<NNN>-<slug>/01-user-story.md` con la historia cerrada.
3. **Contract (🟡)** — el Planner escribe el High-Level Technical Contract y lo muestra al Director. El Director aprueba explícitamente. Se guarda como `02-contract.md`.
4. **Spec (🟠)** — el Planner escribe el Implementation Spec con checkboxes `[ ] T<fase>.<índice>` y comandos de validación. Se entrega a Codex.
5. **Ejecución** — Codex crea rama, implementa, marca checkboxes, llena el Execution Report al final del spec.
6. **PR (🟢)** — Codex abre PR desde su rama. El Planner revisa contra el Contract aprobado (sin drift). Itera si hace falta.
7. **Publicado (✅)** — el Director hace merge a `main`. Vercel despliega automáticamente.

Referencias detalladas:
- Flujo del Planner: [doc_ai_planning_mode.md](doc_ai_planning_mode.md)
- Validación por tipo de cambio: [doc_verification_guide.md](doc_verification_guide.md)
- Estructura de `tasks_for_AI/`: [../tasks_for_AI/README.md](../tasks_for_AI/README.md)
- Instrucciones del Planner: [../CLAUDE.md](../CLAUDE.md)

---

## Regla de origen de la User Story

**Decisión del Product Owner (P1=B):** cada item hace `close-requirement` completo cuando arranca su ciclo SDD. El roadmap solo guarda el **nombre** y las **dependencias**; el contenido clínico/funcional se cierra entrevista por entrevista, no se copia literal del documento estratégico de GPT.

## Regla de ejecución en Fase 0

**Decisión del Product Owner (P2=A):** todos los items de Fase 0 (incluso los de configuración de plataforma externa) siguen ciclo SDD completo. Sin excepciones por ser "infraestructura".

## Regla de creación de carpetas

**Decisión del Product Owner (P5=B):** las carpetas `tasks_for_AI/<NNN>-<slug>/` se crean **solo cuando se aprueba el Contract** de ese item. No se pre-crean carpetas vacías.

---

## Criterios de cierre por fase (resumen)

Cada fase se considera **cerrada** cuando todos sus items están ✅ y se cumplen los criterios específicos descritos en el archivo de la fase. Resumen:

- **Fase 0** — login con Google funcional en los 3 ambientes, modelo de datos inicial con RLS y audit_log activo, shell visual deployada en staging.
- **Fase 1** — expediente clínico NOM-004 completo, 16 sesiones TCC registrables, PDF generable al alta, recordatorios por email funcionando en producción.
- **Fase 2** — Zoom integrado, pagos dentro de OS, CFDI emitible, dashboard administrativo para Catholizare, chat paciente-profesional.
- **Fase 3** — Google Calendar bidireccional, panel de coordinación/supervisión, módulo de IA para revisión de casos, rol de contador invitado.

---

## Pendientes menores que no bloquean arrancar

Items que no impiden el inicio de Fase 0/1 pero deben documentarse antes de Fase 2:

- Configuración del dominio `os.catholizare.com` vía CNAME en Hostinger apuntando a Vercel.
- Decisión final sobre proveedor de CFDI (Facturapi es el default del architecture doc).
- Política de retención de backups de Supabase (mínimo NOM-024: 5 años para expediente clínico).
- Definición de SLA de respuesta de Resend para emails transaccionales críticos (recordatorios de sesión).
- Plan de migración de datos si hay pacientes en WordPress/Amelia que deban importarse al nuevo OS.
- Política de versionado y releases (semantic versioning + changelog automático).
- Inventario de DPO / responsable legal de datos personales (LFPDPPP).

Estos items se resuelven como **setup directo** o como **ciclo SDD menor** cuando cada uno se convierta en un bloqueador real.

---

## Mantenimiento del roadmap

- **Quién actualiza:** el Planner, después de cada merge de PR o de cada cambio de estado.
- **Cómo:** cambia el símbolo de estado en la tabla de la fase y, cuando todos los items de una fase estén ✅, cambia el estado global en este índice.
- **Cuándo se agregan nuevos items:** solo tras aprobación del Director. Nuevos items se numeran continuando la serie de su fase (ej. F1-014, F2-008).
