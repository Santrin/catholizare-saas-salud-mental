# Fase 3 — Optimización e IA

**Objetivo:** cerrar el ciclo de coordinación clínica interna (supervisión de casos), bidireccionalidad con Google Calendar, asistencia de IA para revisión de casos, y ampliar el equipo operativo con rol contable.

**Grano de los items:** grueso. Los ítems aquí son exploratorios — muchos dependen de aprendizajes operativos de Fase 2 que aún no existen. Todos marcados `pendiente-refinar`.

---

## Criterios de cierre de la Fase 3

Fase 3 se cierra (estado global ✅) cuando:

1. Cambios creados en Google Calendar del profesional se reflejan automáticamente en OS (bidireccional).
2. Existe un panel de coordinación/supervisión donde profesionales senior revisan casos de profesionales junior con permisos graduados.
3. Al cerrar una sesión o un alta, una IA revisa el caso y sugiere observaciones al profesional (sin modificar el expediente directamente).
4. Hay un rol "contador invitado" con acceso de solo lectura a datos fiscales y pagos, sin acceso clínico.
5. Métricas de operación automatizadas con alertas (p.ej. reducir fricción en cobros, detectar patrones de abandono).

---

## Items

| ID | Nombre | Depende de | Tipo | Estado | Carpeta SDD |
|---|---|---|---|---|---|
| F3-001 | Google Calendar bidireccional (lectura + escritura) | F2-001 | feature | ⬜ pendiente-refinar | (pendiente) |
| F3-002 | Panel de coordinación clínica / supervisión | F1-006, F1-008 | feature | ⬜ pendiente-refinar | (pendiente) |
| F3-003 | IA revisión de casos (sugerencias post-sesión y al alta) | F1-008, F1-012 | feature | ⬜ pendiente-refinar | (pendiente) |
| F3-004 | Rol "contador invitado" (solo lectura fiscal) | F2-005 | feature | ⬜ pendiente-refinar | (pendiente) |

---

## Notas de alcance por item

Grano grueso exploratorio. Cada item abre `close-requirement` al acercarse su arranque, cuando haya aprendizajes reales de Fase 2.

### F3-001 — Google Calendar bidireccional

Grano grueso:
- Fase 2 (F2-001) solo escribe. Fase 3 también lee cambios hechos directamente en Google Calendar del profesional y los refleja en OS.
- Scope Google OAuth ampliado: `calendar.events` con read/write.
- Resolución de conflictos: si el profesional mueve una sesión en Google Calendar, OS actualiza; si un paciente confirma en OS, se empuja a Google.

A refinar: ventana de sincronización (polling vs push notifications de Google), manejo de eventos no creados por OS (otros compromisos del profesional), conflictos horarios.

### F3-002 — Panel de coordinación / supervisión

Grano grueso:
- Nuevo rol `supervisor` o jerarquía dentro de `profesional`.
- Un supervisor ve casos de profesionales junior que le están asignados.
- Revisión de notas y conceptualizaciones con comentarios privados (no visibles para el paciente).
- Aprobación o retroalimentación de plan de tratamiento antes de ejecutarse.

A refinar: qué datos ve el supervisor vs el profesional titular, política de consentimiento del paciente (NOM-004 exige que supervisión clínica esté declarada en el consentimiento informado), flujo de asignación supervisor→profesional.

### F3-003 — IA revisión de casos

Grano grueso:
- Al cerrar una sesión, una IA (Claude / GPT / modelo clínico especializado) genera sugerencias: técnicas TCC relevantes, riesgo detectado, tareas recomendadas.
- Al dar de alta, la IA revisa el expediente completo y sugiere si el alta es prematura o adecuada.
- Sugerencias son **solo lectura**: la IA no modifica expediente ni envía comunicaciones al paciente sin aprobación del profesional.

A refinar (alta criticidad):
- Modelo: Claude, GPT-5, o fine-tuning propio sobre corpus TCC.
- Política de privacidad: los datos del expediente **no pueden salir del ecosistema controlado**. Si se usa API externa, se requiere BAA/contrato de procesamiento y cumplimiento con LFPDPPP.
- Aceptación explícita del paciente en consentimiento informado para que su expediente sea procesado por IA.
- Trazabilidad: cada sugerencia de IA se registra en `audit_log` con el prompt y la respuesta.

### F3-004 — Rol contador invitado

Grano grueso:
- Nuevo rol `contador` con acceso de solo lectura a: pagos (F2-004), facturas CFDI (F2-005), métricas fiscales agregadas.
- **Sin acceso** a expediente, notas, tests, chat, identidad de pacientes más allá de lo estrictamente fiscal (RFC, razón social).
- Exportación de datos contables (CSV, Excel, XML SAT).

A refinar: alcance temporal (¿ve histórico completo o solo rango activo?), invitación por email con expiración, firma de NDA digital antes de otorgar acceso.

---

## Riesgos y consideraciones especiales de Fase 3

- **F3-003 (IA) es el item con mayor riesgo regulatorio.** Requiere revisión del abogado externo antes de siquiera escribir el Contract. Si el modelo se aloja fuera de México o fuera del control de Catholizare, puede violar LFPDPPP para datos de salud. Preferir modelos que corran en infraestructura controlada (self-hosted) o con BAA firmado (Anthropic, OpenAI tienen BAAs comerciales en algunos países).
- **F3-001 (bidireccional)** introduce complejidad de sincronización que puede causar duplicados o pérdida de sesiones. Requiere tests E2E robustos y plan de rollback.
- **F3-002 (supervisión)** obliga a actualizar el consentimiento informado de todos los pacientes existentes antes de activarlo retroactivamente.

---

## Orden de ejecución sugerido

Sin orden rígido — Fase 3 es más exploratoria:

```
F3-004 (contador) → simple, bajo riesgo, útil para operación
F3-002 (supervisión) → alto valor clínico, requiere cambios en consentimiento
F3-001 (calendar bidireccional) → mejora UX, moderado riesgo técnico
F3-003 (IA) → último, requiere todo lo anterior + revisión legal
```

Se recomienda arrancar F3-004 primero por ser el de menor riesgo y mayor utilidad inmediata al equipo Catholizare.

---

## Qué viene después de Fase 3

No está definido. Catholizare OS como MVP clínico + operación + IA cubre el alcance planeado. Posibles futuros:

- Portal público de profesionales (directorio).
- Integración con expedientes de otras plataformas (intercambio NOM-024).
- App móvil nativa (por ahora la web responsive cubre).
- Mercado internacional (requiere adaptar cumplimiento por país).

Estos quedan como ideas, no como compromiso del roadmap.
