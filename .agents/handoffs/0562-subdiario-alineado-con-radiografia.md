# Handoff · SDD-0562 · «Por contabilizar» cuenta los recibos como la radiografía

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19, en Caracas de 10:00 a 11:40 aprox. (UTC 14:00 a 15:40) |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0562-subdiario-alineado` |
| Rama | `codex/sdd-0562-subdiario-alineado`, desde `origin/main` `4728a8ca` (con la 0557 y la 0559 integradas) |
| SDD | [0562](../../docs/specs/0562-subdiario-alineado-con-radiografia/spec.md), `in-progress`. La reserva es `codex/sdd-reserve-0562` (`78bdfe51`) y entró por cherry-pick |
| Estado | lista para revisión, con PR en borrador #287; `pnpm verify` PASÓ en lo medido (16/17) sobre `d9300e88` |
| Permisos | Sam pidió el 2026-10-19 hacer esta alineación como la siguiente tarea, después de la 0558 («4. Para la siguiente tarea, alinear la 0557»). Eso cubre commits selectivos, push de la rama propia y PR en borrador. No incluye producción ni base de datos |

## OBJETIVO ORIGINAL

Es la decisión del Director del 2026-10-19 sobre la divergencia que encontró la revisión de la SDD-0559, revisable por Sam:

> «Divergencia con la 0557: se alinea, no se acepta. La definición canónica es la de la radiografía, la que cuenta solo los recibos que tocan 1.1.2. [...] Abre una SDD de seguimiento chica, que alinee el K10 de la 0557 con la 0559 y lleve una prueba que compare las dos definiciones sobre el mismo fixture.»

## COMPLETADO

- **`reciboVuelveNoComparable`**, en `lib/studio/accounting/libro-control.ts`, es una función pura con la regla de la radiografía. El recibo cuenta si cumple todo esto:
  - está vivo y en VES o CNY;
  - tiene factura;
  - si fue identificado, tiene su reclasificación viva;
  - tiene su asiento de cobro vivo.
- **`reclasificacionesPorRecibo`** cuenta los `receipt_reclass` vivos por los dos lados, sin contar dos veces el mismo asiento.
- **`cuadreDelLibro`** lee además `invoice_id` e `identified_at` de los recibos y `receipt_reclass` entre los asientos, y calcula el K10 con la regla nueva.
- **Las pruebas:**
  - las puras de la regla y del conteo;
  - en el lector: el recibo del K10 con factura, el pago sin referencia (cuadra), el identificado sin reclasificar o con la reclasificación anulada (cuadra) y el reclasificado (no comparable);
  - **la paridad pedida por el Director**, `scripts/__tests__/subdiario-radiografia-paridad.test.ts`. Sobre la fixture real de la radiografía en PGlite compara, tenant por tenant, «no comparable» en 1.1.2 de «Por contabilizar» contra la fila 91 de la radiografía, corriendo el script real. Coinciden en E, G, J, N y T. Con la regla vieja del K10 el conteo pasa de 5 a 6 (entra K).
- **La spec de la 0557** anota que su K10 se alineó aquí.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run lib/studio/accounting "app/studio/(app)/contabilidad" "app/studio/(app)/reportes" lib/studio/reports lib/studio/direccion` | contabilidad y sus consumidores | PASÓ: `Test Files  24 passed (24)`, `Tests  402 passed (402)` |
| `vitest run scripts/__tests__/subdiario-radiografia-paridad.test.ts scripts/__tests__/radiografia-integridad.test.ts lib/studio/accounting` | la paridad, la radiografía y contabilidad | PASÓ: `Test Files  14 passed (14)`, `Tests  292 passed (292)` (la paridad, 5 casos) |
| Control rojo de la paridad (8 mutantes, restaurados por copia, con la huella sha256 igual antes y después) | quitar `conFactura`; quitar la cláusula de identificado; «identificado nunca cuenta»; `asientosCobro > 0` → `true`; quitar `vivo`; no leer `invoice_id`, `identified_at` ni `receipt_reclass` | los 8 hacen fallar (a) y (b) de la paridad |
| `typecheck`, eslint `--max-warnings=0` (5 archivos), `check-rsc-boundary` | repo y archivos tocados | PASÓ |
| `docs:check` (548 specs), `sdd:check`, `governance:check`, `components:check`, `migrations-lock verificar` | documentación y candado | PASÓ |
| `pnpm verify` sobre `d9300e88` (turno del Director, 2026-10-19 14:26:39Z a 15:00:47Z) | completo | `VERIFY_EXIT=0`, «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17)». Detalle abajo |

Detalle del `verify`, copiado de su salida:
- **PASÓ:** harness, lint, rsc-boundary, typecheck, edge-functions, test, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols («0 ROJO · 0 AMARILLO»), sql-tests, schema-rebuild, e2e y build.
- **test:** la primera vuelta dio `Tests  1 failed | 11860 passed | 1 skipped (11862)`. El rojo fue `scripts/__tests__/radiografia-integridad.test.ts` › «guarda de Git: ninguna salida en modo montos en docs/ ni en .agents/», con `Test timed out in 20000ms` (20940ms). El reintento dio `Tests  11861 passed | 1 skipped (11862)`. Esa prueba es de la SDD-0559, ya en `main`, y esta rama no la toca: es el tope de 20 s bajo la carga del `verify`.
- **e2e:** `1 flaky` y `177 passed (7.3m)`. La inestable es `[chromium] › e2e\calculadora-semantic-colors.spec.ts:53:7 › Selector combinado: teclado, Escape, clic y cursor en light`, de la calculadora pública, ajena a esta rama.
- **NO DISPONIBLE:** migrations-applied, porque el worktree no tiene `.env.local`. Esta SDD no lleva migración.

## Impacto documental y conocimiento

La spec de la 0562 y la de la 0557 (nota de alineación). No hay cambios de esquema, RBAC ni pantallas. Graphify y Archify los publica el Director desde `main`.

## PENDIENTES DE ESTA TAREA

1. Integración por el Director. No lleva migración; el merge publica por el VPS.
2. Las decisiones del Director sobre los puntos 1 a 3 de abajo (2026-10-19) siguen en la SDD-0563. La #287 queda como está.

## FUERA DE ALCANCE DETECTADO (para el Director)

La prueba de paridad midió también estas diferencias entre las dos definiciones. No se aplicaron:

1. **Diferencia conocida en «cuadra» (tenant H de la fixture).** La radiografía suma solo USD/USDT (`radiografia-integridad.sql:170` y `:185-186`) y da «cuadra» más la fila 96. «Por contabilizar» convierte la VES con tasa (`subdiario.ts:86`, `:142`) y da «no cuadra» por 100. La 0559 ya la documenta como su única divergencia (filas 96 y 106). Decidir si se alinea.
2. **Latente: factura borrador en VES con asiento `invoice` vivo.** La radiografía la cuenta como «no comparable» (`fac` no filtra borradores, `:80` y `:187-188`). «Por contabilizar» no lee borradores (`libro-control-queries.ts:248`, `subdiario.ts:131`). Hoy no pasa, porque el asiento de venta nace al emitir. Propuesta mínima: `and f.estado <> 'borrador'` en `radiografia-integridad.sql:187-188`, con su trampa y su mutante, en otra SDD.
3. **NO VERIFICADO, por lectura de código:**
   - sin cuenta 1.1.2, «Por contabilizar» da `sin_cuenta` antes que «no comparable», y la radiografía no tiene ese estado;
   - el rollup de subcuentas por `parentCode` podría no subir una subcuenta sin su cuenta intermedia, mientras la radiografía usa `like '1.1.2.%'`.
