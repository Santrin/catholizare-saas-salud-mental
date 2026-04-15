# tasks_for_AI/

Aquí viven los **contratos técnicos** y **task briefs** generados por el agente Planner (Claude) tras aprobación del Product Owner, y consumidos por el agente Implementing (Codex/GPT).

## Estructura de archivos

Cada funcionalidad genera 3 archivos secuenciales:

```
tasks_for_AI/
├── 001-login-profesional-google/
│   ├── 01-user-story.md          # Historia cerrada (tras close-requirement)
│   ├── 02-contract.md            # High-Level Technical Contract (aprobado)
│   └── 03-spec.md                # Implementation Spec (ejecutable por Codex)
├── 002-webhook-amelia/
│   ├── 01-user-story.md
│   ├── 02-contract.md
│   └── 03-spec.md
└── ...
```

## Convenciones

- **Numeración de 3 dígitos** para ordenamiento estable (`001-`, `002-`, `010-`).
- **Slug en kebab-case** que describe la funcionalidad.
- **Archivos numerados** dentro de cada carpeta para mostrar el orden del ciclo.

## Estados del ciclo SDD

Cada carpeta avanza por estos estados:

| Estado | Archivos presentes | Responsable activo |
|---|---|---|
| 🟡 Refinando | `01-user-story.md` | Claude + Tú |
| 🟠 Contract en revisión | `+ 02-contract.md` | Claude + Tú (aprobación) |
| 🔵 Spec lista para ejecutar | `+ 03-spec.md` | Codex (ejecuta) |
| 🟢 En implementación | `+ branch asociada` | Codex (marca `[x]`) |
| ✅ Feature lista para PR | tests verdes + spec completa | Claude (revisa) |
| 🚀 Publicada | merge a main | Vercel (deploy) |

## Reglas

1. **No se crea `02-contract.md` sin `01-user-story.md` cerrado.**
2. **No se crea `03-spec.md` sin aprobación explícita del Contract.**
3. **El `03-spec.md` no introduce decisiones nuevas** respecto al Contract.
4. **Al terminar la implementación**, el Implementing Agent llena el Execution Report al final de `03-spec.md`.
5. **Una vez publicada** (merged a main), la carpeta se mantiene como historial inmutable.

## Índice de funcionalidades

El índice vivo se mantiene en [`../docs/manual-ejecucion.md`](../docs/manual-ejecucion.md) (se generará al arrancar la Fase 1).
