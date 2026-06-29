---
sdd: "0118"
title: "Seed migrations idempotentes — habilitar validación en branch efímero de Supabase"
status: draft
author: "Claude Code (Director) + founder"
created: 2026-06-29
updated: 2026-06-29
supersedes: null
superseded_by: null
related: ["0116"]
confidencialidad: interno
---

# SDD-0118 · Seed migrations idempotentes — habilitar branch efímero de Supabase

> **Deuda técnica descubierta aplicando SDD-0116 Slice B (migr 0186).** El flujo de
> validación que pide §7 ("migración probada en branch efímero de Supabase, no prod")
> es **infeasible hoy** porque el replay del historial completo de migraciones revienta
> en una migración de *seed* no idempotente. Esta spec lo documenta y propone el arreglo.

## 0. Problema

Al crear un branch efímero de Supabase (`create_branch`, `with_data: false`) para validar
una migración nueva, el branch **replaya todo el historial** de migraciones desde cero. En el
proyecto DTD (`xpfuzqombmjmxvprjgmi`) ese replay **falla a las 32/185** migraciones, en:

```
20260526213130 · seed_team_invitation_template
```

Es una migración de **seed** que hace `INSERT` asumiendo filas (tenant / datos) que **solo
existen en producción**. En un DB fresco esas filas no están → la migración aborta →
`status: MIGRATIONS_FAILED`. El branch queda a medio construir (sin `persons`,
`consolidations`, ni nada posterior a mayo) y **no sirve para validar** ninguna migración que
dependa del schema real. **Cualquier** branch nuevo morirá en el mismo punto.

## 1. Impacto

- **No se puede cumplir §7 literal** ("validar en branch efímero") para ninguna migración nueva.
- Workaround vigente (probado en 0186): **dry-run en transacción sobre prod** —
  `begin; <DDL>; rollback;` + `select to_regclass(...)` para confirmar que no persistió.
  Valida que el DDL ejecuta limpio contra el schema real, **pero no corre `get_advisors`**
  (los advisors necesitan los objetos creados de verdad). Para advisors hay que aplicar a
  prod (additivo/idempotente) y correr advisors después.
- Mientras el historial tenga seeds no idempotentes, el branching de Supabase queda inutilizable
  (también para previews de Vercel/Supabase si algún día se conectan).

## 2. Alcance propuesto

Hacer **idempotentes y fail-safe** las migraciones de seed del historial, para que un replay en
DB fresco (sin datos) no aborte:

- **Auditar** todas las migraciones que hacen `INSERT`/seed de datos (no solo
  `seed_team_invitation_template` — barrer el historial completo).
- **Patrón de arreglo** (sin reescribir historia aplicada en prod; additivo):
  - Seeds que dependen de filas existentes → envolver en guard
    (`insert ... where exists (...)` / `on conflict do nothing` / `if exists` en bloque `do`).
  - Seeds de catálogo/plantillas globales → `on conflict do nothing` con clave natural.
  - Lo que dependa de un tenant concreto → mover fuera del historial de migraciones a un
    **script de seed** (`pnpm seed`) que NO corre en el replay del branch.
- **Validar** creando un branch efímero limpio que llegue a `MIGRATIONS_PASSED` end-to-end.

## 3. Decisión de diseño (a confirmar founder)

- **¿Tocar el historial aplicado?** Postgres/Supabase ya tienen esas migraciones registradas en
  `schema_migrations` de prod; **NO** se re-ejecutan en prod. Editar el `.sql` histórico solo
  afecta replays nuevos (branches). Riesgo: divergencia entre lo aplicado en prod y el archivo.
  Alternativa más limpia: **dejar el histórico tal cual** y agregar una migración nueva que
  "repare" o un `seeds/` aparte — pero eso no arregla el replay (el branch sigue corriendo el
  `.sql` viejo). → **Para habilitar branching hay que editar los `.sql` de seed históricos**
  para que sean idempotentes/guardados. Confirmar que se acepta esa edición.
- **¿Vale la pena?** Si el dry-run tx cubre el 90% del valor (validar ejecución sin tocar prod),
  quizás el branching real no justifica el esfuerzo. Decisión founder: **arreglar seeds** vs
  **formalizar el dry-run tx como el método oficial de §7** y cerrar esta deuda como "won't fix".

## 4. Criterios de aceptación

- Un branch efímero nuevo del proyecto llega a `MIGRATIONS_PASSED` (replay completo 185+).
- `get_advisors` corre en el branch sobre una migración nueva sin deps faltantes.
- Si se opta por "won't fix": §7 de la plantilla de spec se actualiza para documentar el
  **dry-run tx** como método de validación aceptado, y se referencia esta spec.

## 5. Notas

- Descubierto por el Director aplicando 0116/0186 el 2026-06-29.
- Workaround dry-run tx documentado en memoria y reutilizable.
- No bloquea ningún slice en curso; es habilitador de tooling + higiene de migraciones.
