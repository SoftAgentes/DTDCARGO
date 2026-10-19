# Handoff · SDD-0555 · El borrador de factura conserva el embarque de cada línea

| Campo | Valor |
|---|---|
| Fecha | 2026-10-18; en Caracas, de 19:30 a 20:50 aprox. (UTC 2026-10-18 23:30 a 2026-10-19 00:50) |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» del worktree `quizzical-lehmann-d70032` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\quizzical-lehmann-d70032` |
| Rama | `claude/sdd-0555-borrador-conserva-embarque`, desde `origin/main` `77035907` (merge de la #276) |
| SDD | [0555](../../docs/specs/0555-borrador-factura-conserva-embarque/spec.md), `in-progress`. La reserva es `codex/sdd-reserve-0555` (`9d7bd14d`) y entró a esta rama por cherry-pick (`e5165fce`) |
| Estado | lista para revisión, con PR en borrador |
| Permisos | Sam autorizó la fase 1 completa: «Arranca con la fase 1 completa (las cinco tareas que no dependen de decisiones)». Eso cubre commits selectivos, push de la rama propia y PR en borrador contra `main`, sin fusionar. No incluye producción ni base de datos. `pnpm verify` necesita turno del Director |

## OBJETIVO ORIGINAL

Es la tarea 1.5 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, fase 1) y responde al hallazgo FAC-08: editar en el Studio un borrador de varios embarques del cargador de consolidados (SDD-0543) borraba el `shipmentCode` de sus líneas. Con eso el Portal perdía la lista de embarques de la factura y la medida sumada.

## COMPLETADO

- El código se perdía en **tres puntos**, no en dos como decía el plan:
  - `coerce`, al leer (`lib/studio/invoice-queries.ts`);
  - `toDraft` y `draftToLines`, en el drawer (`InvoiceDrawer.tsx`);
  - `normalizeLines`, al guardar (`lib/studio/invoice-types.ts`, por donde pasan `parseLines` y `validateInvoiceInput`).

  Los tres conservan ahora el código, con un único lector, `lineShipmentCode`.
- Las funciones del drawer pasaron a `lib/studio/invoice-types.ts` como `linesToDraft` y `draftToLines` (tipo `DraftInvoiceLine`), así que se prueban sin montar el componente. El código viaja oculto: no se muestra ni se edita, y una línea nueva nace sin él.
- Una factura sin códigos persiste el mismo JSON que antes, sin claves nuevas.
- Tres pruebas nuevas, con 12 casos:
  - `lib/studio/__tests__/invoice-lines-shipment-code.test.ts` cubre las funciones puras y su encadenado. Usa un fixture con la forma real del cargador: el exceso de peso también lleva el código de su embarque. El doble devuelve copias, como PostgREST.
  - `app/studio/(app)/facturacion/_components/InvoiceDrawer.conserva-embarque.test.tsx` monta el drawer en edición, corrige un precio, agrega una línea y lee el input oculto `lines`.
  - `app/studio/(app)/facturacion/__tests__/update-invoice-conserva-embarque.test.ts` revisa lo que `updateInvoice` persiste en `invoices.lines`.
- **Revisión adversaria** (un workflow con 11 agentes: tres lentes, más dos escépticos por hallazgo). No encontró defectos en el código. Dejó tres mejoras de prueba, todas aplicadas:
  - el fixture no tenía la forma real del cargador;
  - `toEqual` no distingue una clave ausente de `undefined`; ahora se afirma con `toHaveProperty`;
  - no había prueba del drawer montado ni de la action.

  La lente de caminos recorrió todos los lectores y escritores de `invoices.lines`: crear, duplicar (copia en crudo), emitir, anular, cobros, reportes de pago, PDF, Portal, RPC y triggers. Ninguno más pierde el código en una edición.
- Límite conocido, anotado en la spec: como el código va oculto, una línea reutilizada o un borrador pasado a otro Shipping Mark conserva el código viejo.

## VALIDACIÓN

Todo sobre este worktree, en la rama de la tarea, después de la revisión adversaria.

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run "app/studio/(app)/facturacion"` + `invoice-lines-shipment-code`, `invoice-types` e `invoice-queries` | las tres pruebas nuevas y las vecinas de facturación | PASÓ: `Test Files 7 passed (7)`, `Tests 99 passed (99)`, exit 0 |
| Mutantes (script del scratchpad; restaura en `finally`) | 8 mutantes, uno por vez: `normalizeLines`, `coerce`, `linesToDraft`, `draftToLines`; `toDraft` local en el drawer; `parseLines` que suelta el código; `linesToDraft` y `draftToLines` con la clave `undefined` | los 8 MUERTOS, con exit 1 y la línea `Tests … failed` (3, 2, 5, 5, 2, 1, 1 y 2 fallos). `git status` después: solo los cambios de la tarea |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0) |
| `eslint --max-warnings=0` | los seis archivos tocados | PASÓ (exit 0, sin salida) |
| `corepack pnpm docs:check` | índice de specs | PASÓ (541 specs, tras regenerar el índice) |
| `corepack pnpm sdd:check` | numeración | PASÓ («sin números repetidos»; avisa los choques históricos ya conocidos) |
| `corepack pnpm governance:check` | cápsula | PASÓ (28 políticas, cápsula vigente) |
| `corepack pnpm components:check` | registro CMP | PASÓ |
| `git diff --check` | diff de la tarea | PASÓ |
| `/ui-check` | — | NO APLICA: no cambia nada visible |
| `corepack pnpm verify` | completo, sobre `77e9e57f`, con el turno que dio el Director; de 2026-10-19 01:30:42Z a 01:51:54Z; Docker Desktop encendido; antes de lanzarlo, sin procesos pesados colgados, CPU al 20 % | exit 0, **16 de 17 pasos medidos y en verde**: `harness`, `lint`, `rsc-boundary`, `typecheck`, `edge-functions`, `test` (`Test Files 806 passed \| 1 skipped`, `Tests 11289 passed \| 1 skipped`), `docs:check`, `numbering`, `feature-constants`, `components:check`, `governance:check`, `pending-migration-symbols` (0 rojo, 0 amarillo), `sql-tests`, `schema-rebuild`, `e2e` (177 passed, 20 skipped, 1 flaky) y `build`. **NO MEDIDO: `migrations-applied`**, porque el worktree no tiene `.env.local`; es a propósito, no se copian secretos a los worktrees. El verify mismo lo marca como «CIERRE INCOMPLETO». La prueba inestable es `e2e/auth.spec.ts:81` («un token inválido renderiza el mismo error las dos veces»): en el primer intento, `page.goto: net::ERR_ABORTED` en `/acceso/<token>`; pasó en el reintento. Es ajena al diff (login, no facturas). El registro completo quedó guardado desde la primera corrida en el scratchpad de la sesión (`verify-0555.log`) |
| Comprobación en el navegador | — | NO EJECUTADA: requiere un borrador con varios embarques en una base de prueba; la prueba del recorrido cubre el camino de datos, no el render |

## Impacto documental y conocimiento

- Documentos canónicos actualizados: la spec 0555 y `docs/specs/README.md` (índice).
- No hay cambios de esquema, RBAC ni rutas, así que Graphify y Archify no cambian de forma. `knowledge:status` salió con exit 0, en modo `integrated`, con los enlaces faltantes ya conocidos (0483). Los derivados los publica el Director desde main integrado.
- Obsidian: sin cambios.

## PENDIENTES DE ESTA TAREA

1. Integración por el Director. El merge publica por el VPS en unos 5 minutos; no lleva migración. `migrations-applied` no se pudo medir desde el worktree; como esta tarea no trae migración, no cambia el ledger.

## FUERA DE ALCANCE DETECTADO

1. **El drawer no muestra a qué embarque pertenece cada línea.** El hallazgo lo sugería; es un cambio visible y necesita su propia spec con `/ui-check`. También resolvería el límite conocido: hoy, una línea reutilizada o un borrador pasado a otro Shipping Mark conserva el código viejo, y el Portal, que no filtra por Shipping Mark, sumaría ese embarque.
2. **La aceptación de T&C sella la medida del primer envío** (`shipment_code`), no la suma. Es una limitación conocida de la SDD-0543 y se decide aparte.
3. **La tabla `invoice_lines` con `shipment_id`, servicio y cuenta de ingreso** queda para la fase 2 del plan (B6).
