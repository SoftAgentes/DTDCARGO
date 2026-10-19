# Handoff · SDD-0559 · Radiografía de integridad contable repetible

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19; en Caracas, de 05:00 a 05:55 aprox. (UTC 09:00 a 09:55) |
| Task ID / owner | `contabilidad-2026-10-18` / subagente escritor de la sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0559-radiografia-integridad` |
| Rama | `codex/sdd-0559-radiografia-integridad`, desde `origin/main` `7fba5711` (merge de la #282). La reserva entró por cherry-pick (`1b36a1ef`). `origin/main` avanzó con la #283 (SDD-0557) y se fusionó sin rebase (`5935b093`, sin conflictos: el driver resolvió el índice) |
| SDD | [0559](../../docs/specs/0559-radiografia-integridad-repetible/spec.md), `in-progress` |
| Estado | commits locales, **sin push ni PR**. Falta el paso con Docker, que espera el turno de verify |
| Permisos | El encargo de la Worker autoriza commits selectivos en la rama propia. No incluye push, PR, producción ni base de datos. `pnpm verify` y `check-schema-rebuild` (Docker) necesitan turno del Director |

## OBJETIVO ORIGINAL

Es la tarea 1.1 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, §8, fase 1): convertir la consulta con la que el Director midió producción el 2026-10-18 en un script versionado de solo lectura, probado, con las definiciones corregidas y las filas que faltaban, para correrlo antes de cada migración de reparación de la fase 2.

## COMPLETADO

- `scripts/qa/radiografia-integridad.sql`: la radiografía, con una sola tabla de salida (`orden · seccion · indicador · n · monto_usd`).
  - Por defecto, solo conteos. Con `-v montos=on`, monto en seis filas de documentos en USD/USDT y la marca `MONTOS-NO-VA-A-GIT · ` en cada sección (E4). La cabecera dice «seis filas» y la prueba lo verifica.
  - Aplica las definiciones canónicas: asiento vivo, origen por `source` y vínculo en los dos sentidos.
  - 1.1.2 y 2.1.1 se comparan por tenant y cada tenant cae en uno de seis estados, con el orden de las decisiones 6 y 7 del Director (E1).
  - Filas nuevas (E2):
    - VES/CNY con asiento;
    - documentos con más de un asiento vivo, por tipo;
    - recibos identificados sin reclasificación;
    - créditos de referido sin asiento y asientos de crédito sin crédito aplicado;
    - USDT sin tasa, informativa;
    - reporte «cancelado»;
    - 0 contra 0 y «sin movimiento en el mayor», cada una en su fila;
    - documentos abiertos en VES/CNY fuera de la suma.
- `scripts/qa/radiografia-integridad.fixture.sql`:
  - aplica las 8 migraciones reales y las tres columnas de 0421 que lee el script;
  - siembra doce tenants trampa (A-L) con CENTINELA en cada texto (E3, E9);
  - aborta si la base ya tiene objetos de aplicación.
- `scripts/__tests__/radiografia-integridad.test.ts`: 49 casos en PGlite (E5, E9). Los esperados y los mutantes viven en el archivo. Cada esperado se revisó a mano contra la fixture, y cada fila lleva un comentario con los documentos que la producen. Los casos:
  - el esquema vacío (60 filas fijas en cero);
  - los 89 conteos;
  - cada tenant en un solo estado por cuenta;
  - la privacidad de los conteos;
  - el modo montos;
  - **38 mutantes**, cada uno afirmado sobre todas las filas que cambia y solo sobre esas: 7 de la consulta del Director y 31 de las reglas nuevas;
  - los controles rojos de fuga (`client_name`) y de máscara;
  - la revisión estática: identificadores prohibidos y sentencias de escritura;
  - la forma psql (`begin;` y `commit;` fallan);
  - la guarda de la fixture;
  - la guarda de Git sobre `docs/` y `.agents/`.
- `scripts/check-schema-rebuild.mjs` (E6): después del contrato de aislamiento, la radiografía corre por stdin sobre el esquema completo, una sola vez y en modo conteos. El paso exige exit 0 y la forma de la salida. `SCHEMA_REBUILD_RADIOGRAFIA` permite el control rojo, y `LEDGER_ONLY` no cambió.
- La spec, con:
  - las 14 correcciones y su evidencia;
  - las definiciones canónicas y las decisiones 6 y 7, citadas literalmente como revisables por Sam;
  - los cinco escritores de `paid_amount` (E7);
  - dónde coincide con la SDD-0557 y dónde no;
  - cómo se corre en producción, incluida la mención de `public.referrals` para la próxima autorización;
  - la allowlist exacta, lo que queda fuera con su dueño (E8) y la gobernanza.

  El índice se regeneró.

Commits (todos con `Co-Authored-By`):

| SHA | Commit |
|---|---|
| `0d9b0f13` | `feat(qa): SDD-0559 — radiografía de integridad contable repetible` |
| `ef93839b` | `feat(qa): SDD-0559 — check-schema-rebuild corre la radiografía sobre el esquema completo` |
| `9c45213b` | `docs(sdd): SDD-0559 — radiografía de integridad contable repetible` |
| `5935b093` | merge de `origin/main` (`bb6bb3e4`) |

Este handoff va en el commit siguiente.

## Desvíos respecto del plan y del prototipo

Todos están verificados contra el código o las migraciones reales:

1. **La numeración de las filas cambió.** Ahora va de la 10 a la 131, con una sección nueva, la 5 (más de un asiento vivo). La prueba es la fuente de verdad.
2. **Recibos anulados con asiento vivo, en dos filas.** La 42 cuenta solo el origen `receipt`, como la SDD-0557 (`libro-control.ts`, `ORIGEN_POR_TIPO`). La 43 cuenta la reclasificación. El prototipo las juntaba.
3. **2.1.1 «no comparable»** lo vuelve una CxP no anulada o un pago vivo, fuera de USD/USDT, con su asiento vivo. La CxP anulada no lo vuelve, a diferencia de la factura anulada: la CxP se asienta convertida (`bill-posting.ts:63-73`), así que su asiento ya está en USD; la factura se asienta al nominal (B2). La trampa es BG2.
4. **La regla de «no comparable» de la factura no filtra `borrador`.** La SDD-0557 los excluye porque no los lee. No difieren porque el asiento de venta nace al emitir (`facturacion/actions.ts:396`, `:565`). Esto es INFERIDO. Por la misma razón, la fila 23 dice «facturas en VES/CNY con asiento de venta vivo», sin «no borrador».
5. **Crédito ↔ asiento.** El vínculo es `journal_entries.referral_id` y, para los asientos viejos sin `referral_id`, la factura donde se aplicó. `referral-credit-posting.ts:463` documenta esos asientos viejos. Por eso el script lee también `referrals.id`, que E9 no listaba.
6. **0421 no se aplica en la fixture.** Su preflight pide auditoría, identidad y el bucket. La fixture agrega sus tres columnas y el CHECK de cancelación (`0421_payment_report_commands.sql:41-50`), que hacen falta para el estado «cancelado» (E2). El esquema completo lo cubre `check-schema-rebuild`.
7. **La fixture tiene doce tenants, no seis.** C ganó una factura con asiento: con la decisión 6, sin movimiento en 1.1.2 habría dejado de dar la diferencia que cancela la de D.
8. **38 mutantes, no 12.**
   - El del prototipo «4.5 contra '4.50'» se reemplazó por mutantes de subcuentas reales: la fixture ahora asienta en 1.1.2.1, 2.1.1.1, 4.5.1 y 2.1.5.1.
   - «Abierta» es una sola definición, compartida por B3 y el cuadre. Por eso «sin vencida» mueve las dos.
   - El mutante «1.1.2 abiertas solo emitida/parcial» quedó cubierto por ese y por la tasa cero.
9. **Fila del comentario de la invariante:** `scripts/qa/cobro-factura-race.mjs:20-22`, no 21-22.
10. **«Sin movimiento»** se mide como debe = 0 y haber = 0 sumados, igual que `subdiario.ts` (`estadoDe`), y no como «ninguna línea». Solo difiere con líneas en cero.
11. `je_vivo` es `not materialized`, para que cada subconsulta use los índices por `invoice_id`, `receipt_id`, `bill_id` y `supplier_payment_id`.

## VALIDACIÓN

Todo corrió en este worktree y en la rama de la tarea. Se repitió después del merge de `origin/main`.

| Comprobación | Alcance | Resultado |
|---|---|---|
| `corepack pnpm exec vitest run scripts/__tests__/radiografia-integridad.test.ts` | la prueba nueva | PASÓ: `Test Files 1 passed (1)`, `Tests 49 passed (49)`. Después del merge, junto con `spec-migration-refs`: `Tests 54 passed (54)`, exit 0 |
| Controles rojos en el lugar (script del scratchpad; restaura en `finally`) | el SQL sin `vencida`; el esperado de la fila 10 alterado; el origen libre sin reducir; la fixture sin la trampa G | los 4 en ROJO, exit 1: `40 failed \| 9 passed`, `40 failed \| 9 passed`, `42 failed \| 7 passed` (cae también la privacidad de los conteos) y `40 failed \| 9 passed`. Después, `git status` mostró solo los archivos de la tarea |
| Mutantes | 38, dentro de la prueba | los 38 MUERTOS, cada uno con su diferencia exacta de filas |
| `corepack pnpm exec vitest run scripts/__tests__/spec-migration-refs.test.ts scripts/next-number.test.mjs` | contratos que leen las specs | PASÓ |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0), antes y después del merge |
| `eslint --max-warnings=0` | `scripts/__tests__/radiografia-integridad.test.ts` y `scripts/check-schema-rebuild.mjs` | PASÓ (exit 0, sin salida) |
| `node --check scripts/check-schema-rebuild.mjs` | sintaxis | PASÓ |
| `node scripts/build-docs-index.mjs` y `corepack pnpm docs:check` | índice | PASÓ: «índice sincronizado con 547 specs» después del merge |
| `corepack pnpm sdd:check` | numeración | PASÓ («sin números repetidos»; avisa los choques históricos ya conocidos) |
| `corepack pnpm governance:check` | cápsula | PASÓ (28 políticas, cápsula vigente) |
| `corepack pnpm components:check` | registro CMP | PASÓ |
| `node scripts/migrations-lock.mjs verificar` | candado | PASÓ: 483 selladas, 2 esperas sin sellar (0422, 0423), 0 nuevas, contra `bb6bb3e4` |
| `git diff --check` | diff de la tarea | PASÓ |
| `node scripts/check-schema-rebuild.mjs` (Docker), con el paso nuevo y su control rojo con `SCHEMA_REBUILD_RADIOGRAFIA` | esquema completo | **NO EJECUTADO**: necesita Docker y el turno de verify que da el Director |
| `corepack pnpm verify` | completo | **NO EJECUTADO**: fuera del encargo, que pide turno del Director |
| `/ui-check`, `revisar-datos-ve` | — | NO APLICA: no hay UI; solo agregados, sin captura ni movimiento de datos personales (ver «Gobernanza» en la spec) |

## Impacto documental y conocimiento

- **Documentos canónicos:** la spec 0559, con las definiciones canónicas que ya cita la spec 0557 de `main`, y `docs/specs/README.md`.
- **Pendiente de adopción:** la SDD-0558 (saldo único del cliente) tiene que adoptar las definiciones para el lado «facturas». La spec lo dice; lo coordina el Director.
- **Graphify y Archify:** la tarea no cambia esquema, RBAC ni rutas.
- **`knowledge:status`:** salió con exit 0. En el worktree marca `structural` y `semantic` como INVALID porque aquí no están los derivados de Graphify. Lo revisa y publica el Director desde `main` integrado.
- **Obsidian:** sin cambios.

## PENDIENTES DE ESTA TAREA

1. **El turno de verify con Docker.** Hay que correr `node scripts/check-schema-rebuild.mjs` (o el paso `schema-rebuild` de `pnpm verify`) y anotar la línea «radiografía de integridad verificada sobre el esquema completo (N filas, conteos)». Después va el control rojo:
   - copiar el script a `C:\tmp\radiografia-mutante.sql` cambiando `je.receipt_id` por `je.recibo_id`;
   - correr `node -e "process.env.SCHEMA_REBUILD_RADIOGRAFIA='C:/tmp/radiografia-mutante.sql';import('./scripts/check-schema-rebuild.mjs')"`;
   - tiene que salir 1, con «la radiografía de integridad no corre sobre el esquema completo» y el ERROR de columna inexistente.
2. **Push de la rama y PR en borrador**, cuando el encargo lo autorice.
3. **La próxima corrida en producción** la hace el Director, con autorización escrita de Sam que nombre la radiografía SDD-0559, diga si es con montos, nombre la migración que dimensiona y mencione que ahora lee `public.referrals` (`id`, `status`, `reward_usd`, `applied_invoice_id`, `deleted_at`). En Git solo va la salida de conteos.

## FUERA DE ALCANCE DETECTADO

Es material para la SDD 2.2 (asientos sin fallos silenciosos):

1. **`lib/studio/accounting/invoice-posting.ts:62-71`** da por existente cualquier asiento no borrado con `invoice_id`, incluidos el anulado y el de `referral_credit`. Esa factura nunca se vuelve a asentar.
2. **`lib/studio/accounting/receipt-posting.ts:203-211`** tiene el mismo defecto por `receipt_id`. Es el caso del recibo de producción que apunta a un asiento anulado. La reclasificación (`receipt-posting.ts:464-473`) lo repite por `receipt_id` y `receipt_reclass`.
3. **`lib/studio/collections-actions.ts:215-219`** no guarda `journal_entry_id` cuando el asiento ya existía.
4. **`scripts/qa/cobro-factura-race.mjs:20-22`**: el comentario de la invariante (`paid_amount` = recibos + reportes) no incluye los créditos de referido aplicados (0471).
5. **Gastos vivos sin asiento `expense`**: es el quinto documento best-effort (`expense-posting.ts:1-20`) y la radiografía no lo mide (E8).
