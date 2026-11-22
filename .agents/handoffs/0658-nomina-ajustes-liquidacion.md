# Handoff — SDD-0658: el finiquito lee y conserva sus ajustes de liquidación

- Fecha: 2026-11-18
- Rama: `claude/0658-nomina-ajustes-0179` (worktree `DTD-worktrees/nomina-0658-ajustes-0179`), base `main` 9a0186228
- Pedido: Sam, en la sesión del Director General: «Haz esta tarea aquí».
- Spec: `docs/specs/0658-nomina-ajustes-liquidacion/spec.md`

## Qué cambió

- `lib/studio/nomina/payroll-rules-queries.ts`:
  - la lectura pide `prestaciones_method`, `prestaciones_interest_pct` y `ajena_78_incluye_92`, y las convierte;
  - guardar los conserva: sin la 0556 van en el insert; con la 0556 se fijan con un `update` sobre la versión
    recién creada, con un error propio si ese paso falla.
- `lib/studio/nomina/payroll-rules-types.ts`: tipos, opciones, validador y `resolverAjustesLiquidacion` (formulario →
  vigente → default de la 0179).
- `app/studio/(app)/nomina/actions.ts`: el formulario manda los tres campos.
- `app/studio/(app)/nomina/_components/ReglasDrawer.tsx`: grupo «Liquidación (finiquito)».
- El `rules_snapshot` del finiquito los congela sin otro cambio, porque guarda las reglas leídas.

Sin migración y sin cambio de defaults.

## Evidencia

| Comprobación | Resultado |
|---|---|
| `pnpm vitest run lib/studio/nomina/ app/studio/(app)/nomina/` | PASÓ, 650 de 650 |
| `pnpm typecheck` | PASÓ |
| `eslint` de los tres archivos tocados | PASÓ |
| `pnpm docs:check` y `pnpm sdd:check` | PASÓ |
| Mutante: quitar las columnas de la lectura | 1 prueba en rojo |
| Mutante: `update({})` en vez de los ajustes | 3 pruebas en rojo |
| `pnpm verify`, build, e2e | NO EJECUTADO (lo cubre el CI) |
| Prueba en la pantalla con un navegador | NO EJECUTADO |

## Pendientes de esta tarea

- Revisión independiente y CI, y después fusionar y publicar.
- Que el contador confirme los tres valores, sobre todo el interés de fábrica en 0 %, antes del próximo finiquito.

## FUERA DE ALCANCE DETECTADO

- Guardado atómico: reemplazar `nomina_guardar_reglas` para que copie los tres ajustes. Es una migración nueva y
  necesita el OK nominal de Sam.
- Los finiquitos emitidos antes conservan su snapshot con los valores de fábrica, por diseño.
