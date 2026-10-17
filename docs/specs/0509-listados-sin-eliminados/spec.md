---
sdd: "0509"
title: "Clientes y embarques eliminados fuera de los listados del Studio"
status: done
author: "Claude"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0010", "0012", "0013", "0017", "0465", "0469", "0472", "0494", "0498", "0507"]
confidencialidad: interno
---

# SDD-0509 — Clientes y embarques eliminados fuera de los listados del Studio

> Un cliente o un embarque con `deleted_at` no se lista, no se cuenta y no se
> ofrece en un selector del Studio. El filtro va en la CAPA DE CONSULTA, no en la
> RLS. Sin migración y sin tocar policies.

## Contexto

Eliminar es poner `deleted_at`, y nada más:

- **Clientes**: `softDeleteClientAction` llama a la RPC
  `soft_delete_client_with_audit_reason` (`0455_borrado_cliente_auditado.sql`,
  SDD-0469). Un cliente fusionado (`0341_client_merge_duplicados.sql`) también
  queda con `deleted_at` y conserva su Shipping Mark.
- **Embarques**: `deleteShipment` (`app/studio/(app)/tracking/[id]/actions.ts`)
  hace `update shipments set deleted_at = now()`. El trigger
  `cascade_soft_delete_events` (0003) marca también sus eventos.

La RLS **no** oculta esas filas:

- `0230_fix_rls_soft_delete_blocked.sql` recorrió `pg_policies` y quitó
  `AND deleted_at IS NULL` del USING de toda policy FOR ALL que lo tuviera,
  porque Postgres exige que la fila resultante de un UPDATE siga cumpliendo el
  USING y eso bloqueaba el propio soft delete. `"shipments by tenant"` (0012:228)
  y `"clients by tenant"` (0012:248) tenían exactamente esa forma. La 0230 **no
  nombra ninguna tabla**: un grep por `shipments` o `clients` no la encuentra.
- `0456_clients_write_rbac.sql:202-204` partió la policy de `clients` por
  comando y dejó `"clients by tenant"` como SELECT que solo compara tenant.

La cabecera de la 0230 dice que el filtro «ya lo hace la capa de aplicación en
cada query (`.is("deleted_at", null)` en `lib/studio/*-queries.ts`)». **Para
clientes y embarques no era cierto**: `construirQuery` (`listClients`,
`listClientsPage`), `listShipments`, `listActiveShipments` y
`listShipmentsByMarkbox` no lo pedían. Es el mismo agujero que SDD-0465 cerró
para facturas y SDD-0494 para cobros y órdenes de pago.

> **Estado en producción: VERIFICADO PARCIALMENTE.** La forma de las policies
> está verificada en Supabase Cloud el 2026-09-20 por el Director (SDD-0494:
> 85 de 89 policies FOR ALL «<tabla> by tenant» sin `deleted_at` en el USING;
> las 4 que lo conservan no incluyen `shipments` ni `clients`). La cuenta de
> filas eliminadas en el servidor propio, que es producción desde el
> 2026-10-14, está **NO VERIFICADA**: pide el OK nominal de Sam para un
> `count(*) … where deleted_at is not null` por tabla, sin leer filas.

La prueba de que el contrato era «solo vivos» está en el propio repo: el CSV del
operativo (`lib/studio/export/operativo-csv.ts`, `listarClientesParaExport` y
`listarEmbarquesParaExport`) ya filtra `deleted_at` y dice «TODOS los clientes
vivos». El RPC `shipments_dashboard_counts` (0014) también filtra. O sea que la
pantalla y el archivo de una misma cartera no coincidían.

### Lo que se veía

| Superficie | Lector |
|---|---|
| `/studio/clientes`: listado y total «N clientes» | `listClientsPage` |
| ⌘K, combobox de cédula, candidatos de Bitácora, CN, ERP móvil | `listClients` |
| Tarjeta «Clientes» del dashboard | `getClientCount` |
| `/studio/fidelizacion`: niveles y distribución | `clientsWithTier` |
| `/studio/embarques`, ⌘K, ERP móvil | `listShipments` |
| Barra lateral de `/studio/tracking` | `listActiveShipments` |
| Historial de envíos de la ficha del cliente | `listShipmentsByMarkbox` |
| Tool `search_shipments_by_customer` del agente | relectura en `shipment-tools.ts` |
| `/studio/ve` (Almacén VE): bandeja y cuatro KPIs | `listVeReceipts`, `computeVeKpis` |
| Selector de Aduana para abrir expediente (`/studio/seniat`) | `listShipmentsEligibleForFiling` |
| Selector de TMS para planificar ruta | `listEligibleShipmentsForRoute` |
| `/studio/calendario`: arribo, entrega, plan y zarpe | `listCalendarEvents` |
| `GET /api/studio/shipments` y `GET /api/studio/kpis` | rutas |

Los dos selectores son los más delicados: no solo mostraban el envío eliminado,
**dejaban crear** un expediente aduanal o una ruta sobre él.

El calendario tenía además un comentario falso: «embarque soft-deleted →
filtrado por RLS» en el embed `shipment:shipments(...)` del zarpe.

## Decisión

**El filtro va en la capa de consulta, no en la RLS**, por las mismas razones
que SDD-0494:

1. La 0230 y la 0456 están aplicadas y no se editan; reponer `deleted_at is null`
   en un USING FOR ALL vuelve a romper el soft delete.
2. Ocultar por RLS le quitaría a auditoría y a la fusión de duplicados la
   trazabilidad por SQL: el cliente fusionado conserva su Shipping Mark
   justamente para servir de alias.

**No hace falta migración.** La marca ya existe y los índices base ya son
parciales sobre ella (`shipments_tenant_status_idx` y
`shipments_tenant_service_idx`, 0002:56-62; `clients_tenant_tier_idx` y
`clients_tenant_name_idx`, 0006:29-33, todos `where deleted_at is null`).
`supabase/migrations-baseline.json` no se toca.

**Calendario, doble cierre.** El zarpe sale de `shipment_events`. Se filtra
`deleted_at` en el evento —la cascada marca los que existían al eliminar— **y**
se lee el `deleted_at` del embarque embebido, porque un evento insertado
después de eliminar el envío queda vivo y la cascada no lo alcanza.

**Tool del agente.** `search_shipments_by_customer` llamaba a
`listShipmentsByMarkbox` y después releía `shipments` sin filtro para traer más
columnas. Arreglar solo la consulta compartida no bastaba: la relectura repite
el filtro.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `lib/studio/client-queries.ts` | `construirQuery` (→ `listClients`, `listClientsPage`) y `listShipmentsByMarkbox` piden `deleted_at is null` |
| `lib/studio/shipment-queries.ts` | `listShipments` y `listActiveShipments` piden `deleted_at is null`; se corrige el comentario de `getShipmentEvents`, que decía que la RLS excluye eliminados |
| `lib/studio/dashboard-queries.ts` | `getClientCount` cuenta solo vivos |
| `lib/studio/fidelizacion/queries.ts` | `clientsWithTier` lee solo vivos |
| `lib/studio/warehouse-ve-queries.ts` | `listVeReceipts` y los cuatro contadores de `computeVeKpis` |
| `lib/studio/customs-queries.ts` | `listShipmentsEligibleForFiling` |
| `lib/studio/tms-queries.ts` | `listEligibleShipmentsForRoute` |
| `lib/studio/calendar-events-queries.ts` | arribo/entrega/plan filtran `shipments`; el zarpe filtra el evento y el embarque embebido; se quita el comentario falso |
| `lib/studio/agents/tools/shipment-tools.ts` | la relectura de `search_shipments_by_customer` repite el filtro |
| `app/api/studio/kpis/route.ts` · `app/api/studio/shipments/route.ts` | `GET` filtra eliminados |
| `lib/studio/__tests__/listados-double.ts` | doble de PostgREST que aplica filtros, orden, `limit` y `count`, y lanza si se filtra antes del `select()` |
| `lib/studio/__tests__/listados-sin-eliminados.test.ts` | regresión por lector, con controles |
| `app/api/studio/__tests__/listados-sin-eliminados.test.ts` | regresión de las dos rutas, con control |
| `app/api/studio/__tests__/route-auth.test.ts` · `lib/studio/calendar-events.test.ts` · `lib/studio/fidelizacion/__tests__/queries.test.ts` | sus dobles aceptan el `.is()` nuevo; no cambian lo que afirman |
| Esta spec, `docs/specs/README.md` y `.agents/handoffs/0509-listados-sin-eliminados.md` | documentación |

### Lo que NO se filtra, a propósito

- **Código del embarque al convertir un estimado** (`cotizador/actions.ts`,
  `select("id", { count: "exact", head: true })` sobre `shipments`). Ese conteo
  arma `DTDU-NNNN`, y `shipments` tiene `unique (tenant_id, code)` sin filtro de
  `deleted_at`: contar solo vivos repetiría códigos de eliminados y el INSERT
  chocaría. Debe seguir contando todo.
- **Enriquecimiento por Shipping Mark del despacho móvil**
  (`dispatch-mobile-queries.ts`). El Shipping Mark nunca se reutiliza
  (`unique (tenant_id, markbox)` sin filtro, 0006/0341), así que la única fila de
  ese Shipping Mark es la del cliente; ocultarla le quitaría la dirección de
  entrega a un paquete vivo.
- **Lecturas puntuales por id, código o Shipping Mark** (`getClientByMarkbox`,
  `getShipmentById`, tools `get_shipment`/`get_customer`, acciones). Qué debe
  mostrar la ficha de un cliente o envío eliminado —404, aviso o redirección al
  cliente que lo absorbió (`merged_into_client_id`)— es una decisión de
  producto. Va en FUERA DE ALCANCE del handoff.
- **Lectores con cliente admin** (`schedule-fanout.ts`, `kommo-contact-status.ts`,
  `mail-rule-engine.ts`): nunca pasaron por la RLS, así que no son regresión de
  la 0230. Van en FUERA DE ALCANCE con su riesgo.
- **Ya filtraban**: el CSV del operativo, `shipments_dashboard_counts`,
  `listShipmentsForPicker` de gastos y `costingRows` (en memoria).
- **`lib/studio/documents/adjuntos-queries.ts`** es de SDD-0507 y no se toca.

## Aceptación

> **`status: in-progress` a propósito.** Los criterios 1-6 tienen prueba
> automática con mutantes. `pnpm verify` está **NO EJECUTADO** a la espera del
> turno del Director, y la cuenta en producción (criterio 7) espera el OK de Sam.

1. Un cliente eliminado no aparece en `/studio/clientes`, ni suma al total, ni
   lo devuelven el ⌘K, el combobox de cédula, los candidatos de Bitácora, CN ni
   el ERP móvil. Tampoco cuenta en la tarjeta «Clientes» del dashboard ni recibe
   nivel en Fidelización.
2. Un embarque eliminado no aparece en `/studio/embarques`, en la barra lateral
   de `/studio/tracking`, en el historial de la ficha de su cliente ni en la
   respuesta de `search_shipments_by_customer`.
3. Un embarque eliminado no aparece en la bandeja de Almacén VE (`/studio/ve`) ni suma en
   ninguno de sus cuatro KPIs, ni en `GET /api/studio/kpis`, ni lo devuelve
   `GET /api/studio/shipments`.
4. Los selectores de Aduana y de TMS no ofrecen un embarque eliminado.
5. El calendario no muestra arribo, entrega, plan ni zarpe de un embarque
   eliminado, aunque tenga un evento vivo insertado después de eliminarlo.
6. Sin migración, sin cambio de policies, sin cambio en
   `migrations-baseline.json`.
7. *(Evidencia, no comportamiento.)* Cuántos clientes y embarques eliminados hay
   en producción, medido con `count(*)` sin leer filas, con OK nominal de Sam.

## Evidencia

**Rojo contra main.** Con el código de `origin/main` (`8824a9ac`),
`lib/studio/__tests__/listados-sin-eliminados.test.ts` da **15 rojos y 3
verdes**: los 3 verdes son los controles del doble, que afirman justamente el
comportamiento sin filtro. Cada rojo es el lector devolviendo la fila eliminada.

**Verde con el arreglo.** Las dos baterías nuevas (18 + 3 casos) y las seis
suites cuyos dobles se ajustaron: 9 archivos, 120 pruebas. `vitest related`
sobre los 11 archivos de producto tocados: 22 archivos, 237 pruebas.
`pnpm typecheck` y `eslint` sobre lo tocado: limpios.

**El doble aplica el filtro.** `listados-double.ts` filtra con
`eq/neq/is/in/not/gte/lte/ilike`, ordena, corta en `limit`/`range`, cuenta con
`count: "exact"` antes del `limit` y devuelve copias. `or` se registra pero no
filtra, así que una búsqueda matchea la fila viva y la eliminada. Y lanza si se
llama un filtro antes de `select()`, como supabase-js. El fixture es infeliz: la
fila eliminada es la más reciente y cumple todos los demás filtros.

**Mutantes.** Quitando una por una las 19 líneas de código del diff que filtran
eliminados, **las 19 matan al menos una prueba**. El script también tomó como
sitio una línea de comentario de `shipment-queries.ts` que contiene el texto
`.is("deleted_at", null)`: sobrevive, como corresponde a un comentario. El
control sin mutar y el control restaurado dieron 0 fallos.

## Riesgos y límites

- **Esto es lectura.** No reescribe historia ni toca lo asentado: el cliente o
  el embarque eliminado sigue en la base con su motivo de auditoría.
- **El cliente eliminado sigue accesible por URL directa** (`/studio/clientes/<markbox>`),
  con sus acciones de edición. Antes se llegaba desde el listado; ahora solo por
  enlace. Qué debe hacer esa ficha es decisión de Sam (ver Alcance).
- **Los expedientes y rutas no revalidan el embarque al crearse.** El selector
  ya no ofrece un eliminado, pero la action que crea el expediente o la ruta no
  comprueba `deleted_at` por su cuenta. Queda en FUERA DE ALCANCE.
- **El total de `/studio/clientes` baja** en tantos clientes como eliminados
  haya. Es el número correcto, pero quien lo compare con una captura vieja verá
  la diferencia: conviene decirlo al publicar.

## Cierre (2026-10-14)

Este cierre reemplaza la nota de `status: in-progress` de «Aceptación» y el
«NO VERIFICADA» de la cuenta en producción del «Contexto».

- **Criterio 7, la cuenta.** Conteo READ ONLY autorizado por Sam, a las
  04:23:39Z: clientes, 5 eliminados y 663 vivos; embarques, 0 eliminados y 19
  vivos.
- **Integración.** El Director resolvió el conflicto del índice con un merge
  de `origin/main` `55d1b871` (→ `0005c584`).
- **CI.** PASÓ (18m15s).
- **`pnpm verify` local:** NO EJECUTADO, por decisión de Sam. Literal: «ok,
  autorizo el conteo y fusiona la #203 con el CI».
- **Merge.** PR #203, merge `7f05a501` a las 04:47:19Z, con
  `--match-head-commit 0005c584`.
- **Deploy** a las 04:50:07Z.
- **Smoke.** PASÓ, Sam. Literal: «Aprobado, funcionan los listados».
