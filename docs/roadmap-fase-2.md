# Fase 2 — Expansión operativa

**Objetivo:** pasar de MVP clínico a plataforma operativa completa con pagos, facturación, videollamada integrada, chat paciente-profesional y dashboard administrativo para el equipo Catholizare.

**Grano de los items:** medio. El detalle granular no existe aún en el documento estratégico de GPT — estos items están marcados como `pendiente-refinar` y se refinan a grano fino cuando se acerque su arranque (Fase 1 cerrada o avanzada).

---

## Criterios de cierre de la Fase 2

Fase 2 se cierra (estado global ✅) cuando:

1. El profesional puede crear una sesión que genera automáticamente un link de Zoom válido y lo envía al paciente.
2. El paciente puede pagar su membresía/paquete de sesiones desde OS sin salir a Care/WordPress.
3. Se emiten facturas CFDI 4.0 automáticamente tras cada pago, con validación SAT.
4. Paciente y profesional pueden chatear dentro de OS con historial persistente.
5. Hay al menos un rol "recepcionista" operativo con permisos limitados (agenda + pagos, sin acceso a expediente clínico).
6. El equipo Catholizare tiene un dashboard administrativo que muestra métricas agregadas sin exponer PII clínica.
7. La escritura de sesiones de OS a Google Calendar (unidireccional) funciona para profesionales que opten.

---

## Items

| ID | Nombre | Depende de | Tipo | Estado | Carpeta SDD |
|---|---|---|---|---|---|
| F2-001 | Google Calendar — escritura unidireccional OS → Google | F1-007 | feature | ⬜ pendiente-refinar | (pendiente) |
| F2-002 | Zoom integrado (creación automática de meeting por sesión) | F1-007 | feature | ⬜ pendiente-refinar | (pendiente) |
| F2-003 | Chat paciente ↔ profesional dentro de OS | F1-004, F1-005 | feature | ⬜ pendiente-refinar | (pendiente) |
| F2-004 | Pagos dentro de OS (membresías y paquetes de sesiones) | F1-002 | feature | ⬜ pendiente-refinar | (pendiente) |
| F2-005 | Facturación CFDI 4.0 vía Facturapi | F2-004 | feature | ⬜ pendiente-refinar | (pendiente) |
| F2-006 | Rol "recepcionista" + interfaz operativa | F1-002, F2-004 | feature | ⬜ pendiente-refinar | (pendiente) |
| F2-007 | Dashboard administrativo Catholizare (agregados, sin PII clínica) | F1-002, F2-004 | feature | ⬜ pendiente-refinar | (pendiente) |

---

## Notas de alcance por item

Estas notas son **grano grueso**. Al acercarse cada item, se abre `close-requirement` para cerrarlas a grano fino.

### F2-001 — Google Calendar unidireccional

Grano grueso:
- OS escribe a Google Calendar del profesional cuando se crea/reagenda/cancela una sesión.
- Sin lectura desde Google Calendar (eso es Fase 3).
- OAuth con Google: scope `calendar.events`.
- Opt-in del profesional desde su panel (puede no conectar).

A refinar: qué datos van al evento (título genérico sin PII o con nombre del paciente — depende de privacidad), manejo de reagendas/cancelaciones sin duplicar, fallback si Google API falla.

### F2-002 — Zoom integrado

Grano grueso:
- Zoom Server-to-Server OAuth (no Zoom Marketplace App) — ya mencionado en architecture doc.
- Al crear sesión en OS, se genera meeting Zoom automáticamente.
- Link se incluye en recordatorios por email (F1-011) y en dashboard paciente (F1-005).
- Grabación: **no por default**; si el profesional opta, se almacena cifrada y se trata como PII clínica.

A refinar: cuenta Zoom compartida Catholizare o cada profesional conecta la suya, política de grabación y retención, qué pasa si el paciente no se presenta.

### F2-003 — Chat paciente ↔ profesional

Grano grueso:
- Chat asíncrono dentro de OS. No tiempo real tipo WhatsApp en Fase 2.
- Persistencia en Supabase con RLS estricta: solo los dos participantes y admin Catholizare (solo en auditoría).
- Adjuntos: limitado (tamaño y tipo) para evitar fuga de PII por imagen.
- Notificación por email cuando hay mensaje nuevo si el destinatario no está logueado.

A refinar: tiempo real opcional (Supabase Realtime), moderación, archivo automático al alta del paciente, tratamiento del chat como parte del expediente (NOM-004 lo considera comunicación clínica).

### F2-004 — Pagos dentro de OS

Grano grueso:
- Stripe (ya mencionado en architecture doc; en Fase 1 solo lectura de webhooks, en Fase 2 cobros reales).
- Productos: membresías mensuales/anuales, paquetes de N sesiones, sesión individual.
- Checkout embebido o redirección a Stripe Checkout.
- Webhook Stripe → actualización de estado de paciente (activo, moroso, suspendido).

A refinar: métodos de pago (tarjeta, OXXO, SPEI), política de reembolsos, prorrateo en cambios de plan, prueba gratuita.

### F2-005 — Facturación CFDI 4.0

Grano grueso:
- Facturapi.com como proveedor (mencionado en architecture doc y `.env.example`).
- Emisión automática tras pago exitoso en F2-004.
- Datos fiscales del paciente capturados en onboarding o al primer pago.
- Almacenamiento de XML y PDF en Supabase Storage, acceso del paciente vía dashboard.

A refinar: uso CFDI (P01 default), régimen fiscal, notas de crédito por reembolso, cancelaciones SAT.

### F2-006 — Rol recepcionista

Grano grueso:
- Nuevo rol `recepcionista` con permisos: ver agenda, confirmar pagos, responder dudas administrativas. **Sin acceso a expediente clínico**.
- RLS estricta para garantizar que no puede leer notas, tests ni conceptualización.
- UI separada en `/recepcion/*`.

A refinar: asignación multi-tenant (recepcionista de varios profesionales o uno solo), logs de acciones.

### F2-007 — Dashboard administrativo Catholizare

Grano grueso:
- Para el equipo Catholizare (Director, Directora de ejecución): métricas agregadas.
- Sin PII clínica visible (número de pacientes activos, tasa de alta, ingresos, pero no qué dice el expediente).
- Filtros por profesional, rango de fechas, plan.

A refinar: qué métricas exactas, exportación a CSV/PDF, alertas automáticas (caída de ingresos, alza de cancelaciones).

---

## Dependencias externas de Fase 2

Antes de arrancar, deben estar resueltos estos pendientes del roadmap maestro:

- Cuenta Stripe Mx activada y KYC aprobado.
- Cuenta Facturapi con e.firma del emisor (Catholizare o cada profesional — decisión legal pendiente).
- Cuenta Zoom con plan Pro mínimo (meetings sin límite de 40 min).
- Google Cloud Console con OAuth consent screen verificado para producción.
- Dominio `os.catholizare.com` activo (CNAME Hostinger → Vercel).

---

## Orden de ejecución sugerido

```
F2-001 + F2-002 (paralelizable, ambos tocan agenda) 
  → F2-003 (chat, independiente, puede adelantarse)
  → F2-004 → F2-005 (CFDI depende de pagos reales)
  → F2-006 (recepcionista necesita agenda + pagos)
  → F2-007 (dashboard admin necesita datos reales)
```

F2-003 (chat) es el menos dependiente y puede adelantarse si el equipo tiene capacidad paralela.
