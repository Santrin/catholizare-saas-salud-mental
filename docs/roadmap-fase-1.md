# Fase 1 — MVP clínico

**Objetivo:** implementar el proceso TCC completo de 16 sesiones con cumplimiento NOM-004 y NOM-024, entregable y usable por profesionales y pacientes reales de Catholizare.

**Regla de origen de la User Story (P1=B):** cada item abre su propia entrevista `close-requirement` cuando arranca el ciclo SDD. El esqueleto aquí es solo guía de alcance, no user story cerrada.

---

## Criterios de cierre de la Fase 1

Fase 1 se cierra (estado global ✅) cuando:

1. Un profesional puede dar de alta (vía webhook Amelia) a un paciente y verlo en su dashboard.
2. El expediente clínico cubre los campos obligatorios de NOM-004-SSA3-2012.
3. Las 16 sesiones TCC son registrables con nota estructurada por sesión.
4. Los 4 tests psicológicos iniciales y las re-evaluaciones (sesión 8 y 14) son aplicables desde la plataforma.
5. Se recomiendan 3 posts del blog de Catholizare Care por sesión al paciente (vía WP REST API).
6. Recordatorios automáticos de sesión llegan por email (Resend) a paciente y profesional.
7. Al alta del paciente se genera un PDF del expediente completo, descargable y firmable.
8. Los 4 roles (paciente, profesional, admin Catholizare, sistema) tienen permisos distintos verificables por RLS.
9. Todas las escrituras clínicas generan entrada en `audit_log`.
10. E2E tests cubren los 6 flujos críticos: login-google, amelia-alta, crear-expediente, aplicar-test, registrar-nota, exportar-pdf.

---

## Items

| ID | Nombre | Depende de | Tipo | Estado | Carpeta SDD |
|---|---|---|---|---|---|
| F1-001 | Login paciente (Google + email/OTP) | P0-004 | feature | ⬜ | (pendiente) |
| F1-002 | Roles y permisos (4 roles) + middleware | P0-004, P0-005 | feature | ⬜ | (pendiente) |
| F1-003 | Webhook Amelia — alta automática de paciente | P0-005, F1-002 | feature | ⬜ | (pendiente) |
| F1-004 | Dashboard profesional (lista pacientes, próximas sesiones) | F1-003 | feature | ⬜ | (pendiente) |
| F1-005 | Dashboard paciente (próxima sesión, tareas, posts recomendados) | F1-003 | feature | ⬜ | (pendiente) |
| F1-006 | Expediente clínico NOM-004 (historia clínica, consentimiento, datos) | F1-004 | feature | ⬜ | (pendiente) |
| F1-007 | Agenda con estructura TCC 16 sesiones | F1-006 | feature | ⬜ | (pendiente) |
| F1-008 | Notas de sesión estructuradas + conceptualización + plan de tratamiento | F1-007 | feature | ⬜ | (pendiente) |
| F1-009 | Tests psicológicos (4 iniciales + re-evaluaciones sesión 8 y 14) | F1-006 | feature | ⬜ | (pendiente) |
| F1-010 | Recomendación de 3 posts por sesión (WP REST API Care) | F1-007 | feature | ⬜ | (pendiente) |
| F1-011 | Recordatorios automáticos por email (Resend) | F1-007 | feature | ⬜ | (pendiente) |
| F1-012 | Generación de PDF del expediente al alta | F1-006, F1-008, F1-009 | feature | ⬜ | (pendiente) |
| F1-013 | E2E tests de los 6 flujos críticos | F1-001 a F1-012 | test | ⬜ | (pendiente) |

---

## Notas de alcance por item

Esqueleto inicial. Cada item abre su `close-requirement` al arrancar el ciclo.

### F1-001 — Login paciente

Temas a cerrar:
- Google OAuth ya activo en P0-004. Para pacientes sin Google, ¿email + magic link o email + OTP?
- El architecture doc y el README mencionan "email + Google" para paciente. Cerrar si se implementan ambos desde el inicio o solo Google en F1-001 y email se difiere.
- UX del primer login: onboarding mínimo, aceptación de términos y consentimiento informado electrónico.

### F1-002 — Roles y permisos

Temas a cerrar:
- Los 4 roles (`paciente`, `profesional`, `admin_catholizare`, `sistema`) ya definidos en architecture.
- Matriz de permisos: qué recurso puede ver/editar cada rol. Base: cada rol solo ve lo suyo; admin Catholizare ve agregados sin PII clínica.
- Middleware Next.js redirige según rol: `/paciente/*`, `/profesional/*`, `/admin/*`.
- Tests unitarios y de integración para cada combinación rol × recurso.

### F1-003 — Webhook Amelia

Temas a cerrar:
- Endpoint en Next.js API Route: `POST /api/webhooks/amelia`.
- Firma HMAC con `AMELIA_WEBHOOK_SECRET` para validar autenticidad.
- Payload esperado: datos mínimos del paciente (nombre, email, teléfono, profesional asignado, fecha primera sesión).
- Idempotencia: evitar alta duplicada por reintentos del webhook.
- Qué pasa si el profesional no existe en OS: crear stub o rechazar con log.
- Envío de email de bienvenida al paciente con enlace de primer login.

### F1-004 — Dashboard profesional

Temas a cerrar:
- KPIs visibles: pacientes activos, próximas sesiones hoy/semana, pacientes en alerta (tests con score alto, faltas consecutivas).
- Lista de pacientes con filtros (activos, en alta, suspendidos).
- Acceso rápido a expediente, notas de última sesión, agenda.
- Notificaciones en navbar (recordatorios pendientes, mensajes del sistema).

### F1-005 — Dashboard paciente

Temas a cerrar:
- Próxima sesión (fecha, hora, profesional, link de Zoom en Fase 2).
- Tareas asignadas por el profesional (lectura, registro emocional, ejercicios TCC).
- 3 posts recomendados por sesión actual (F1-010).
- Historial de sesiones pasadas (resumen mínimo, sin datos sensibles del profesional).
- Acceso a descarga del PDF del expediente al alta.

### F1-006 — Expediente clínico NOM-004

Temas a cerrar (alta criticidad — afecta cumplimiento legal):
- Campos obligatorios de NOM-004-SSA3-2012: identificación paciente, antecedentes, exploración, diagnóstico, plan.
- Campos NOM-024-SSA3-2012: formato electrónico estándar, trazabilidad, firmado digital o aceptación registrada.
- Consentimiento informado electrónico: texto legal revisado por abogado externo antes del merge.
- Historia clínica estructurada vs libre: ¿todo formulario o campos libres? Default: híbrido (campos obligatorios estructurados + notas libres).
- Clasificación del dato: expediente = altamente sensible, RLS estricta, audit_log obligatorio.

### F1-007 — Agenda 16 sesiones

Temas a cerrar:
- Estructura fija del tratamiento: 16 sesiones TCC con objetivos distintos por sesión (según manual TCC del experto clínico).
- Re-evaluación en sesiones 8 y 14 (hook a F1-009).
- Agenda por profesional: calendario interno, sin sync a Google Calendar todavía (eso es Fase 2).
- Reagenda y cancelación: política y límites (¿cuántas cancelaciones antes de alerta?).
- Visibilidad: paciente ve solo sus sesiones; profesional ve todas las suyas.

### F1-008 — Notas + conceptualización + plan

Temas a cerrar:
- Nota de sesión estructurada: fecha, duración, agenda planificada vs ejecutada, observaciones, intervenciones, tareas asignadas.
- Conceptualización del caso: editable a lo largo del tratamiento, versionada.
- Plan de tratamiento: objetivos SMART, técnicas TCC por sesión, tareas entre sesiones.
- Separación de lo que ve el paciente vs solo el profesional (notas privadas del profesional).

### F1-009 — Tests psicológicos

Temas a cerrar:
- 4 tests iniciales: definir cuáles (el experto clínico decide; típicamente Beck Depression Inventory, Beck Anxiety Inventory, PSS, y uno específico del caso).
- Re-evaluaciones en sesión 8 y 14: mismos tests o subset.
- Scoring automático + interpretación + almacenamiento de resultados.
- Alertas: score alto dispara notificación al profesional.
- Validez y licencias de los tests (algunos requieren licencia comercial).

### F1-010 — Recomendación 3 posts por sesión

Temas a cerrar:
- Fuente: WP REST API de `catholizare.com`. Tenemos ~2000 posts.
- Lógica de recomendación: ¿manual por profesional, automática por taxonomía/sesión, o IA? Default Fase 1: **manual + taxonomía** (profesional etiqueta sesiones y posts se filtran por tag).
- Cache local en OS para no pegar a WP en cada carga del dashboard paciente.
- Fallback si WP está caído.

### F1-011 — Recordatorios por email

Temas a cerrar:
- Eventos que disparan recordatorio: 24h antes de sesión, 1h antes, post-sesión (tareas), re-evaluación próxima.
- Template por tipo en Resend (React Email o MJML).
- Idempotencia: no enviar duplicado si la sesión se reagenda.
- Tracking: qué se registra en `audit_log` (envío, bounce, open si Resend lo provee).
- Unsubscribe: obligatorio por ley para emails transaccionales no críticos; los de sesión son críticos y no llevan unsubscribe.

### F1-012 — PDF del expediente al alta

Temas a cerrar:
- Contenido: todo el expediente NOM-004 + historial de sesiones + resultados de tests + notas de alta.
- Firma: electrónica del profesional (¿solo registro de aceptación o firma digital real con e.firma del SAT?).
- Almacenamiento: Supabase Storage, retención 5 años mínimo.
- Acceso: paciente descarga una vez; profesional y admin Catholizare lo conservan indefinidamente.
- Plantilla visual: branding Catholizare, legible, cumple requisitos de NOM-024.

### F1-013 — E2E tests

Temas a cerrar:
- 6 flujos mínimos: `login-google`, `amelia-alta`, `crear-expediente`, `aplicar-test`, `registrar-nota`, `exportar-pdf`.
- Playwright ya instalado en `package.json`.
- Datos de prueba sintéticos: nunca datos reales de paciente (regla dura de `CLAUDE.md`).
- Ejecución: local (`pnpm test:e2e`) y en CI antes de merge a `main`.

---

## Orden de ejecución sugerido

Varios items se pueden paralelizar una vez que F1-003 esté listo, pero el orden con menor riesgo es:

```
F1-001 → F1-002 → F1-003 → F1-004 + F1-005 (paralelizable)
  → F1-006 → F1-007 → F1-008 + F1-009 (paralelizable)
  → F1-010 + F1-011 (paralelizable)
  → F1-012 → F1-013
```

F1-013 (E2E) se puede comenzar de forma incremental desde F1-004, agregando flujos conforme los features se completan.
