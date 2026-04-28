## Referencia

- Spec: `tasks_for_AI/<NNN>-<slug>/03-spec.md`
- Contract aprobado: `tasks_for_AI/<NNN>-<slug>/02-contract.md`

## Resumen

<!-- 1-3 bullets de qué hace este PR. -->

## Execution Report

<!--
Pegar aquí el Execution Report completado del spec.
Debe incluir:
- Total execution tasks, completed, blocked, skipped
- Task Status con [x] o [BLOCKED]
- Validation Executed con [x] o [SKIPPED]
- Blockers
- Files Changed
- Final Statement con las 4 casillas
-->

## Cumplimiento clínico

- [ ] No aplica — cambio no toca datos de paciente
- [ ] NOM-004-SSA3-2012: verificado
- [ ] NOM-024-SSA3-2012: verificado
- [ ] Policies RLS en tablas nuevas o modificadas
- [ ] Audit log en writes clínicos
- [ ] Sin datos reales en tests/seed

## Validación ejecutada

- [ ] `pnpm type-check`
- [ ] `pnpm lint`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:integration`
- [ ] `pnpm test:e2e` (si aplica)
- [ ] Smoke manual en preview Vercel (si aplica)

## Riesgos conocidos y rollback

<!-- Qué podría salir mal y cómo revertir si es necesario. -->

## Review del Planner

<!-- Claude (Planner) completa esta sección tras revisar contra el Contract aprobado. -->

- [ ] El PR implementa el Contract sin drift
- [ ] No hay decisiones nuevas introducidas en la implementación
- [ ] Naming consistente con el Contract
- [ ] Cobertura de tests adecuada al riesgo
