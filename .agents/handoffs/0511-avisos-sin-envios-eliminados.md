# Handoff 0511 · Envíos y clientes eliminados fuera de los avisos, Kommo y el correo por regla

- Fecha: 2026-10-14 03:12Z → 03:55Z (2026-10-13 noche, Caracas). Estado: **arreglo implementado y
  probado en local; `pnpm verify` NO EJECUTADO** (falta el turno del Director).
- Owner/sesión: `claude-funny-chatterjee-390769` (Claude Opus 5.5, Worker, sesión de la app de
  escritorio).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/funny-chatterjee-390769`,
  creado por la app para esta sesión. `harness-worktree.mjs guard` lo acepta (no es main, ni detached,
  ni el checkout principal), así que no se creó otro. Claim con `claim --owner claude-funny-chatterjee-390769`;
  `guard --owner` revalidado antes de cada commit.
- Rama: `claude/funny-chatterjee-390769`, desde `origin/main` = `c80eea64`.
- SDD: [0511](../../docs/specs/0511-avisos-sin-envios-eliminados/spec.md), reservada en local con
  `sdd:next --reserve avisos-sin-envios-eliminados` (rama `codex/sdd-reserve-0511-avisos-sin-envios-eliminados`,
  commit `ea580b44`, **sin push**). La 0510 la reservó otra sesión entre mi inventario y mi reserva
  (`codex/sdd-reserve-0510-generar-bl-envios-enum`). Sin migración.
- Permisos del encargo (Sam): worktree propio, SDD reservada, **PR al final, sin merge**. No cambiar
  policies ni aplicar migraciones.

## OBJETIVO ORIGINAL

Hallazgo de SDD-0509: `schedule-fanout.ts` lee `shipments` con el cliente admin y sin
`deleted_at is null` en tres lugares (consolidación, arribo VE, recepción Yiwu); relacionados,
`kommo-contact-status.ts` y `mail-rule-engine.ts`. 1) Confirmarlo con un doble de PostgREST que
aplique filtros y un fixture con el eliminado como el más reciente. 2) Decidir con Sam qué lectores
excluyen eliminados. 3) Implementar con pruebas, controles del doble y mutantes. 4) Cierre del
runbook y handoff.

## COMPLETADO

### Confirmación (rojo antes de tocar código)

Batería `lib/studio/__tests__/avisos-sin-eliminados.test.ts` con el doble nuevo
`lib/studio/__tests__/lectores-admin-double.ts`. El `listados-double.ts` de SDD-0509 sigue en la
PR #203 sin fusionar, así que escribí uno equivalente en vez de copiarlo (AGENTS: no copiar cambios
ajenos). Primera corrida, solo fan-out y Kommo: **7 rojos, 6 verdes** (los 6 controles).

### Decisiones de Sam (2026-10-14 ~03:23Z, AskUserQuestion, texto literal de la opción elegida)

1. Correo por regla: «Excluir; fusionado → superviviente (Recomendado)».
2. Avisos ya programados: «Revalidar al despachar (Recomendado)».
3. Kommo saldo: «Sí, también facturas (Recomendado)».

El fan-out lo decidía el encargo: «un aviso sobre un envío eliminado no debería salir».

### Arreglo (commit `82b54183`)

| Archivo | Cambio |
|---|---|
| `lib/studio/notifications/schedule-fanout.ts` | `.is("deleted_at", null)` en los 3 lectores; la consolidación salta el envío que no vuelve vivo y, si la lectura falla, no avisa y lo deja en el log |
| `lib/studio/notifications/drain-client-notifications.ts` | `enviosEliminados` por lote; esos avisos quedan `canceled` con `error = 'envío eliminado'` (UPDATE condicional `status = 'scheduled'`); `DrainResult.canceled`; si no puede leer los envíos, el lote no se despacha |
| `lib/studio/kommo-contact-status.ts` | `.is("deleted_at", null)` en `invoices` y `shipments` |
| `lib/studio/mail/mail-rule-engine.ts` | `emailDelShippingMark`: ficha viva → su correo; eliminada → `resolve_markbox` y relectura del resultado con `deleted_at is null` (fusionado → vigente; sin fusión → nadie) |
| `lib/studio/notifications/__tests__/drain-client-notifications.test.ts` | su doble acepta `.in()` y el resultado vacío lleva `canceled: 0`; no cambia lo que afirma |

Sin migración, sin policies, sin `migrations-baseline.json`.

**Un mutante me corrigió la lectura del código.** En la primera corrida sobrevivió M10 (quitar
`if (!fila?.client_id) return null`). Lo había anotado como equivalente; no lo es: sin ese corte,
una RPC fallida lanza `TypeError`, el `catch` general de `fireMailEvent` lo atrapa y se pierden
**las demás reglas del mismo evento**. Faltaba la prueba: «si la RPC falla, al cliente no le llega y
las demás reglas siguen». Con ella, 21/21.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Batería final contra el código de `c80eea64` (archivos de producto restaurados después; `git diff --stat` igual antes y después) | **FALLÓ como se esperaba**: `Tests  15 failed \| 14 passed (29)`. Los 14 verdes: 10 controles del doble y 4 de no-regresión (fila tomada por otro worker, aviso de compra, cliente vivo, Shipping Mark sin ficha) |
| Batería con el arreglo | PASÓ: 29/29 |
| `vitest run` de la batería + `lib/studio/notifications/__tests__` + `kommo-contact-status.test.ts` | PASÓ: 14 archivos, 154 pruebas (antes de la prueba nueva de M10) |
| `vitest related --run` sobre los 4 archivos de producto | PASÓ: 19 archivos, 174 pruebas (lista por archivo abajo) |
| Mutantes (`mutantes-0511.cjs` en el scratchpad; reemplazo exacto de la n-ésima ocurrencia, sin sed; muere solo con «N failed», N > 0) | **21/21 mueren**. Control sin mutar al inicio y al final: `Tests  68 passed (68)` las dos veces |
| `pnpm typecheck` | PASÓ |
| `eslint` sobre los 7 archivos tocados | PASÓ |
| `git diff --check` y espacios finales en los archivos nuevos | PASÓ |
| `docs:check` · `sdd:check` | PASÓ (`índice sincronizado con 494 specs`) · PASÓ (`sin números repetidos`) |
| `pnpm verify` completo | **NO EJECUTADO**: corrida pesada; se le pide turno al Director |
| Cuenta en producción | **NO EJECUTADO**: opcional, pide OK nominal de Sam (pendiente 2) |
| Smoke | **NO APLICA** como pantalla: el cambio no tiene UI. Lo observable es el log del cron y la columna `status` de la agenda (pendiente 3) |

`vitest related`, pruebas por archivo: `RecibirClient.test.tsx` 3 · `m/cn/recibir/actions.test.ts` 3 ·
`pantallas-muestran-la-denegacion.test.tsx` 9 · `create-receipt-code.test.ts` 4 ·
`AlmacenCnClient.test.ts` 2 · `NewReceiptDrawer.test.tsx` 3 · `ReceiptRowActions.test.tsx` 3 ·
`receivable-history-gate.test.ts` 11 · `CotizadorClient.borrado.test.tsx` 4 ·
`softDeleteQuote.test.ts` 5 · `soft-delete-invoice.test.ts` 13 ·
`void-invoice-referral-warning.test.ts` 19 · `consolidation-authorize.test.ts` 8 ·
`delete-shipment-gate.test.ts` 8 · `avisos-sin-eliminados.test.ts` 29 ·
`kommo-contact-status.test.ts` 17 · `drain-client-notifications.test.ts` 5 ·
`schedule-client-notifications.test.ts` 11 · `schedule-fanout.test.ts` 17.

Mutantes (todos mueren): M01 consolidación sin `.is` · M02 sin la rama de lectura fallida ·
M03 no salta el eliminado · M04 arribo VE sin `.is` · M05 Yiwu sin `.is` · M06 Kommo facturas sin `.is` ·
M07 Kommo embarques sin `.is` · M08 correo sin corte de ficha inexistente · M09 la ficha viva no
devuelve su correo · M10 sin corte de RPC sin cliente · M11 vigente releído sin `.is` · M12 vuelve la
lectura vieja del correo · M13 drain despacha sin saber · M14 nunca cancela · M15 cancel sin condición
de estado · M16 cuenta la cancelación aunque no ocurra · M17 no sigue tras cancelar · M18 cancel sin
motivo · M19 lee envíos con lote sin envíos · M20 ignora el error de lectura · M21 toma todo envío como
eliminado.

### Coordinación

- PRs abiertas: con #203 (SDD-0509) solo comparto `docs/specs/README.md`, que es índice generado; #200
  ya entró a main; #114 no comparte archivos (`git diff --name-only origin/main...<rama>`).
- `origin/main` avanzó a `ddf14c06` (PR #200, SDD-0508) durante la tarea. `sync_with_base_branch` de la
  app se negó (archivos con filtro git-lfs), así que hice `git merge --no-ff origin/main` en mi rama
  (`fb37587f`): limpio, el driver `dtd-generated-records` resolvió el índice. Después del merge:
  `docs:check` PASÓ (495 specs), `sdd:check` PASÓ, `pnpm typecheck` PASÓ y `vitest related` sobre los
  4 archivos de producto PASÓ (19 archivos, 174 pruebas).

## Impacto documental y conocimiento

- Documentos: esta spec, el índice `docs/specs/README.md` (regenerado con `docs:index`) y este handoff.
  No cambia ningún runbook ni regla estable.
- `revisar-datos-ve`: consultada. No hay captura, movimiento ni borrado de datos personales; el cambio
  reduce comunicaciones a fichas eliminadas y reutiliza el correo del cliente vigente en una fusión.
  No requiere auditoría completa.
- Graphify estructural: **NO EJECUTADO**. Este worktree no tiene grafo (`knowledge:status`:
  `structural INVALID`, `GRAPH_ISSUES: graph_missing_or_invalid; graph_empty`); construirlo desde
  cero es una corrida pesada y la estructura se actualiza desde main tras integrar.
- Graphify semántico: ninguna fuente del piloto (`semanticPilot`, 16 documentos) cambió. Los
  documentos nuevos quedan en `SEMANTIC_GLOBAL_PENDING`, como el resto fuera del piloto.
- Archify: **NO DISPONIBLE** (`ARCHIFY_RUNTIME_MISSING`); sus fuentes no cambiaron.
- Vista previa de Obsidian: **NO DISPONIBLE** (`publish --preview` → `No hay grafo comprobable para publicar`).

## COMMITS

- `ea580b44` chore(sdd): reserva SDD-0511 — avisos-sin-envios-eliminados (stub de la reserva)
- `82b54183` fix(studio): SDD-0511 — envíos y clientes eliminados fuera de avisos, Kommo y correo por regla
- `821d5465` docs(sdd): SDD-0511 — spec, índice y handoff de los avisos sin envíos eliminados
- `fb37587f` Merge remote-tracking branch `origin/main` (PR #200, SDD-0508)
- (último) docs(sdd): SDD-0511 — handoff con el merge y la PR

## PR / BRANCH

`claude/funny-chatterjee-390769` contra `main`, en **draft** mientras falte `pnpm verify`.

## PENDIENTES DE ESTA TAREA

1. **Turno de `pnpm verify`** con el Director (una corrida pesada a la vez).
2. *(Opcional, evidencia)* **OK nominal de Sam** para contar en el servidor propio, en transacción de
   solo lectura y sin leer filas, cuántos avisos cancelará el primer cron después del deploy:
   `begin transaction read only; select count(*) from public.client_notification_schedule s join public.shipments sh on sh.id = s.shipment_id where s.status = 'scheduled' and sh.deleted_at is not null; select count(*) from public.clients where deleted_at is not null and merged_into_client_id is not null; rollback;`
   Vía `ssh.exe root@217.216.54.70` + `docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X`.
3. **Después del deploy** (lectura): la respuesta JSON del cron `client-notifications-drain` trae
   `canceled`; los cancelados quedan con `error = 'envío eliminado'` en la agenda.
4. Cuando #203 y esta PR estén en main: unir `lectores-admin-double.ts` y `listados-double.ts` en un
   solo doble.

## FUERA DE ALCANCE DETECTADO

- **El despacho de avisos de journey no sigue fusiones.** `dispatchEmail`/`dispatchPush` resuelven al
  cliente por Shipping Mark con `deleted_at is null`: un envío con el código retirado de un fusionado
  no tiene destino. Ahora el correo por regla sí lo sigue; alinear los dos es decisión de Sam.
- **Kommo no suma lo del Shipping Mark viejo de un fusionado** (envíos y facturas con el código
  retirado no cuentan para el vigente).
- **Avisos que cuelgan de una compra**: el despacho no revalida la prealerta; si se elimina, su aviso
  sale.
- **`transitionShipment` sobre un envío eliminado** (la ficha sigue accesible por URL, SDD-0509) puede
  programar un aviso; ahora lo cancela el despacho, pero la acción misma no lo impide.
- **`deleteShipment` no cancela sus avisos programados**: con este cambio se cancelan al vencer, no al
  eliminar. Si se quiere verlos cancelados de inmediato en el historial, es otra tarea.

## HANDOFF AL DIRECTOR

- Rama lista para revisión con la batería, los controles y los mutantes. Falta solo `pnpm verify`.
- Ojo al desplegar: el primer cron **escribe** en producción (marca `canceled` los avisos vencidos de
  envíos eliminados). Es lo pedido; la cuenta previa (pendiente 2) dice cuántos.
- El índice de specs choca con #203 por diseño; al integrar la segunda, regenerar con `pnpm docs:index`.
