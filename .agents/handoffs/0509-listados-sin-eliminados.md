# Handoff 0509 · Clientes y embarques eliminados fuera de los listados del Studio

- Fecha: 2026-10-14 02:31Z → 03:05Z (2026-10-13 noche, Caracas). Estado: **arreglo implementado
  y probado en local; `pnpm verify` NO EJECUTADO** (falta el turno del Director) y **cuenta en
  producción NO VERIFICADA** (falta el OK nominal de Sam).
- Owner/sesión: `claude-listados-sin-eliminados` (Claude Opus 5.5, Worker). Sesión de la app:
  «Ocultar eliminados en listados del Studio».
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/listados-sin-eliminados`,
  creado con `harness-worktree.mjs start listados-sin-eliminados`. Claim con
  `claim --owner claude-listados-sin-eliminados`; `guard --owner` revalidado antes del commit.
- Rama: `codex/listados-sin-eliminados`, desde `origin/main` = `8824a9ac`.
- SDD: [0509](../../docs/specs/0509-listados-sin-eliminados/spec.md), reservada en local con
  `next-number.mjs --reserve listados-sin-eliminados` (rama `codex/sdd-reserve-0509-listados-sin-eliminados`,
  commit `8bad5681`, **sin push**). Sin migración (la siguiente libre sigue siendo 0474).
- Permisos del encargo (Sam): worktree propio, SDD reservada, **PR al final, sin merge**. Sin
  cambiar policies ni aplicar migraciones sin su OK. La cuenta en producción solo con OK nominal.

## OBJETIVO ORIGINAL

Hallazgo de SDD-0507: los listados del Studio muestran clientes y envíos con `deleted_at` no nulo.
1) Confirmarlo con una prueba (doble de PostgREST que aplique filtros) y, si Sam lo autoriza,
contar filas eliminadas en producción sin leer PII. 2) Proponer el arreglo en una SDD (filtrar
`.is("deleted_at", null)` y revisar otros listados con el mismo patrón, incluido el CSV del
operativo). 3) Implementar con pruebas y `pnpm verify` pidiendo turno al Director. Coordinar con
SDD-0507 si se toca `lib/studio/documents/adjuntos-queries.ts`.

## COMPLETADO

### Diagnóstico (medido en el repo)

- **Policies**: `"shipments by tenant"` y `"clients by tenant"` (0012:228 y 0012:248) tenían
  `deleted_at is null` en el USING de una FOR ALL; la 0230 lo quitó con un `do $$` sobre
  `pg_policies` que no nombra tablas, y la 0456 (:202-204) dejó `clients by tenant` como SELECT
  solo por tenant. La forma está verificada en Cloud por el Director el 2026-09-20 (SDD-0494).
- **Barrido**: 181 lecturas `.from("clients"|"shipments")` en `app/` y `lib/`, clasificadas con un
  script: 73 ya filtraban, 25 escrituras, 49 puntuales por id y 34 sin filtro. De esas 34 revisé
  cada una; las que son listado, contador o selector del Studio con sesión de usuario entraron al
  arreglo. El resto queda con su motivo en la spec («Lo que NO se filtra») o abajo en FUERA DE
  ALCANCE.
- **El CSV del operativo ya filtraba** clientes y embarques (`operativo-csv.ts:111` y `:217`), y
  también `shipments_dashboard_counts` (0014), el selector de gastos y `costingRows` (en
  memoria). La pantalla y el CSV de la misma cartera no coincidían.
- **Hallazgos extra dentro del alcance**: el calendario decía «embarque soft-deleted → filtrado
  por RLS» (falso desde la 0230); la tool `search_shipments_by_customer` releía `shipments` sin
  filtro después de llamar a `listShipmentsByMarkbox`; los selectores de Aduana y TMS dejaban
  crear expediente o ruta sobre un envío eliminado.
- **No se filtra a propósito** el conteo del cotizador que arma `DTDU-NNNN`: el
  `unique (tenant_id, code)` de `shipments` no libera códigos de eliminados.

### Arreglo

Commit `2c5115c9`: `.is("deleted_at", null)` en 19 sitios de 11 archivos de producto (lista exacta
en la spec, § Alcance). Sin migración, sin policies, sin `migrations-baseline.json`.
`lib/studio/documents/adjuntos-queries.ts` (SDD-0507) **no se toca**, y las ramas de 0507/0508 no
comparten archivos con esta (comprobado con `git diff --name-only origin/main...<rama>`).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Batería nueva contra `origin/main` sin arreglo | **FALLÓ como se esperaba**: 15 rojos, 3 verdes (los controles) |
| `vitest run` de las 2 baterías nuevas + 7 suites afectadas | PASÓ: 9 archivos, 120 pruebas |
| `vitest related --run` sobre los 11 archivos de producto | PASÓ: 22 archivos, 237 pruebas |
| Mutantes, uno por línea del diff (script en el scratchpad) | 19/19 de código **mueren**; 1 «sobrevive» y es una línea de comentario que contiene el texto `.is("deleted_at", null)`. Control sin mutar y restaurado: 0 fallos |
| `pnpm typecheck` | PASÓ |
| `eslint` sobre los 17 archivos tocados | PASÓ |
| `git diff --check` | PASÓ |
| `docs:check` · `sdd:check` | PASÓ · PASÓ (sin números repetidos) |
| `pnpm verify` completo | **NO EJECUTADO**: pedí turno a la sesión «Revisión de tareas en progreso» hacia las 02:55Z; el mensaje quedó retenido y **expiró sin entregarse** (la otra sesión corre en otro modo de permisos). No lo lancé sin turno |
| Cuenta de eliminados en producción | **NO VERIFICADO**: pide el OK nominal de Sam |
| Smoke en la UI | **NO EJECUTADO**: depende del deploy |

## COMMITS

- `2c5115c9` fix(studio): SDD-0509 — clientes y embarques eliminados fuera de los listados
- (siguiente) docs(sdd): SDD-0509 — spec, índice y handoff

## PR / BRANCH

`codex/listados-sin-eliminados` contra `main`. PR en **draft** mientras falten verify y la cuenta.

## PENDIENTES DE ESTA TAREA

1. **Turno de `pnpm verify`** con el Director (una corrida pesada a la vez).
2. **OK nominal de Sam** para contar en el servidor propio, en transacción de solo lectura y sin
   leer filas:
   `begin transaction read only; select 'clients', count(*) from public.clients where deleted_at is not null union all select 'shipments', count(*) from public.shipments where deleted_at is not null; rollback;`
   Vía `ssh.exe root@217.216.54.70` + `docker exec -i dtd-cargo-db-1 psql -U postgres -d postgres -X`.
3. **Smoke después del deploy** (lectura): `/studio/clientes` (total), ficha de un cliente con un
   envío eliminado, `/studio/embarques`, `/studio/tracking`, `/studio/ve`, `/studio/calendario`.
   Con la cuenta del punto 2 se puede comparar el total de clientes antes y después.
4. Pasar la spec a `done` cuando 1-3 den PASÓ.

## FUERA DE ALCANCE DETECTADO

- **`GenerateBLModal.tsx:46` nunca lista envíos.** Filtra `.not("status", "in", "(entregado,cancelado)")`,
  pero el enum `shipment_status` (0002:15-29, sin `alter type` posterior) no tiene esas etiquetas:
  Postgres rechaza el valor y el modal cae a lista vacía. INFERIDO del código, no reproducido.
- **Ficha de cliente y detalle de envío eliminados accesibles por URL**, con sus acciones de
  edición (`getClientByMarkbox`, `getShipmentById`). Decisión de producto: 404, aviso o redirección
  al cliente que lo absorbió (`merged_into_client_id`, 0341).
- **Crear expediente aduanal o ruta TMS no revalida `deleted_at`** del envío en la action; el
  selector ya no lo ofrece, pero la action acepta el id.
- **Lectores con cliente admin** (nunca pasaron por la RLS, no son regresión de la 0230):
  `schedule-fanout.ts:80/190/304` puede programar un aviso al cliente sobre un envío eliminado;
  `kommo-contact-status.ts:221` cuenta envíos eliminados en el estado del contacto;
  `mail-rule-engine.ts:103` toma el correo de un cliente eliminado.
- **Tools del agente por código o Shipping Mark** (`get_shipment`, `get_shipment_timeline`,
  `get_customer`) devuelven eliminados; son lecturas puntuales.
- `tracking/nuevo/page.tsx:23` sugiere nombres de cliente sacados de envíos eliminados (menor).
- **El mismo agujero en otras tablas**: la 0230 dejó sin predicado 85 policies. Una auditoría
  sistemática (o una prueba estática que exija el filtro en los listados de tablas con
  `deleted_at`) cerraría la clase entera en vez de tabla por tabla.

## Conocimiento

- Impacto documental: spec nueva 0509 e índice `docs/specs/README.md` regenerado con
  `build-docs-index.mjs`. Ningún documento del piloto semántico cambió.
- `knowledge:status`: `structural INVALID` y `semantic INVALID` porque este worktree nuevo no tiene
  `graphify-out/graph.json`. Graphify **no se corrió** (corrida pesada; la publica el Director
  desde main). `knowledge:visual:check`: `PENDING — ARCHIFY_RUNTIME_MISSING`; no descargué el
  runtime. Ambos quedan NO DISPONIBLES en este worktree.

## HANDOFF AL DIRECTOR

Diff de producto chico y mecánico, con prueba roja contra main y mutantes. Falta: turno de verify,
la cuenta con OK de Sam y el smoke después del deploy. El índice de specs choca con 0507/0508 al
integrar: usar el driver de main y regenerar con el script.

## CIERRE (Director, 2026-10-14)

- **Integración.** El Director resolvió el conflicto del índice con un merge de `origin/main`
  `55d1b871` (→ `0005c584`).
- **Cuenta en producción.** Conteo READ ONLY autorizado por Sam, a las 04:23:39Z: clientes, 5
  eliminados y 663 vivos; embarques, 0 eliminados y 19 vivos.
- **CI.** PASÓ (18m15s).
- **`pnpm verify` local:** NO EJECUTADO, por decisión de Sam. Literal: «ok, autorizo el conteo y
  fusiona la #203 con el CI».
- **Merge.** PR #203, merge `7f05a501` a las 04:47:19Z, con `--match-head-commit 0005c584`.
- **Deploy** a las 04:50:07Z.
- **Smoke.** PASÓ, Sam. Literal: «Aprobado, funcionan los listados».
- Pendientes de arriba: 1 (verify) NO EJECUTADO por decisión de Sam, con el CI como evidencia; 2
  (cuenta) y 3 (smoke) hechos; 4: **SDD-0509 → `done`** en la PR de cierre
  `codex/cierres-noche-20261014`, con una sección «Cierre (2026-10-14)» en la spec.
