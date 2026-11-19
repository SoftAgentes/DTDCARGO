---
sdd: "NNNN"
title: "Almacén China sin lo consolidado, lista activa de Embarques y «Contenedores en camino»"
status: draft
author: "Claude (Worker) + Sam"
created: 2026-11-19
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0016", "0029", "0543", "0643", "0659", "0674"]
confidencialidad: interno
---

# SDD-NNNN — Lo consolidado sale de Almacén China y de la lista activa

> Sam, 2026-11-19: lo que se metió en el contenedor 64 sigue saliendo en Almacén China. Lo consolidado no
> debería estar ahí: debería verse «en ruta», en una opción de «contenedores en camino». Y los embarques ya
> no deberían salir en la lista activa.

**Borrador.** Nada de producto se toca hasta que Sam apruebe por el DG. Se midió solo en código y
migraciones (base `origin/main` `c04f18fca`); no se leyó ninguna fila de producción.

## 1. «Confirmen»: qué pasa hoy (medido)

### 1.1 La carga del 64 sí marcó lo consolidado

La carga de consolidados (`scripts/consolidados/lote-sql.ts`, SDD-0543) deja todo con el estado de «ya
salió», no de «en almacén»:

| Qué crea | Estado que queda | Dónde |
|---|---|---|
| Consolidación (DTD-CONSOL-0004) | `zarpado` | `scripts/consolidados/lote-sql.ts:441` |
| Embarque por remitente | se inserta `in_warehouse` y se pasa a `in_transit` | `scripts/consolidados/lote-sql.ts:583`, `:588` |
| Recepción `WR-C64-<remitente>` | `consolidado` (con `shipment_id`) | `scripts/consolidados/lote-sql.ts:600-605` |
| Embarque FCL del dueño | `in_transit` | `scripts/consolidados/lote-sql.ts:653` |

O sea: la hipótesis «la carga no cambia el estado» **no** se cumple. Las recepciones del 64 nacen
`consolidado` y sus embarques `in_transit`.

### 1.2 Almacén China muestra todo por defecto, consolidado incluido

- El filtro de estado arranca en «todos»: sin `?status=` en la URL, `status = "all"`
  (`lib/studio/warehouse-cn-queries.ts:339`), y con «all» no se filtra
  (`lib/studio/warehouse-cn-queries.ts:116`).
- El selector de la pantalla arranca vacío = «Todos» (`app/studio/(app)/cn/_components/AlmacenCnClient.tsx:159`, `:275`).
- La lista trae las 100 recepciones más recientes por `received_at` (`lib/studio/warehouse-cn-queries.ts:114`).
  Las del 64 tienen la fecha del packing list, que es reciente, así que entran arriba.
- Los KPI sí distinguen: «pendientes» y «CBM en almacén» cuentan solo `pendiente_consolidacion`
  (`lib/studio/warehouse-cn-queries.ts:296`). La tabla no.

**Causa:** la pantalla no esconde lo consolidado; lo pinta con la insignia «Consolidado». Es la tabla, no
el dato.

### 1.3 Lo que no se puede confirmar sin leer producción

Si la oficina registró a mano en Almacén China la mercancía del 64 **antes** de la carga, esas recepciones
siguen `pendiente_consolidacion`: la carga crea recepciones nuevas `WR-C64-*` y no enlaza ni cierra las
anteriores (`scripts/consolidados/lote-sql.ts:600`). Eso sería un duplicado, y con los KPI arriba contándolo
como «en almacén». Para saberlo hace falta un conteo (§5, pregunta 1).

### 1.4 Embarques: «Activos» incluye lo que va en el mar

- La pestaña por defecto es «Todos» (`app/studio/(app)/embarques/_components/EmbarquesClient.tsx:233`).
- «Activos» = todo lo que no sea `delivered` o `cancelled`
  (`app/studio/(app)/embarques/_components/EmbarquesClient.tsx:115`, `:121`; el conteo usa la misma regla en
  `lib/studio/shipment-queries.ts:404`). Un embarque `in_transit` del 64 cuenta como activo.

### 1.5 «Contenedores en camino» ya existe a medias: Tracking

La pantalla de Tracking (SDD-0659) lista contenedores y no envíos sueltos, con el grupo «En mar» para todo
contenedor `zarpado` (`lib/studio/tracking-contenedores.ts:212`). El rol `warehouse` ya ve Tracking
(`lib/studio/rbac.ts:65`), y Almacén China lo ven `operations`, `warehouse` y `support` (`lib/studio/rbac.ts:70`).
Lo que falta es el camino desde Almacén China hasta ahí, y saber si el equipo de China tiene Tracking en su
menú (§5, pregunta 4).

## 2. Propuesta

### 2.1 Almacén China: la vista por defecto es «En almacén»

- Sin filtro en la URL, la tabla muestra `pendiente_consolidacion` + `incidencia` (lo que está físicamente
  en la bodega). El selector de estado gana la opción «En almacén» como primera y por defecto; «Consolidado»
  y «Todos» se siguen pudiendo elegir.
- Arriba de la tabla, un aviso de una línea: «N recepciones ya consolidadas no se muestran · Ver
  contenedores en camino».
- Sin migración: es un filtro de lectura sobre `warehouse_receipts_cn.status` (índice
  `warehouse_receipts_cn_tenant_status_idx`, migración 0008).

### 2.2 Embarques: la lista activa deja fuera lo que ya salió

Dos lecturas posibles de lo que dijo Sam (§5, pregunta 3):

- **(a)** «Activos» pasa a ser «en origen»: `draft`, `in_warehouse`, `consolidating`, `exception`. Se agrega la
  pestaña «En camino» (`in_transit`, `shipped`, …) y «Entregados» sigue igual. La pestaña por defecto pasa de
  «Todos» a «Activos».
- **(b)** «Activos» no cambia de regla; solo la pestaña por defecto pasa a «Activos» y la vista por
  contenedor pliega los contenedores `zarpado`.

Recomendación: **(a)**. Sin migración; regla única en `lib/studio/shipment-queries.ts` para que el conteo y el
filtro no se separen.

### 2.3 «Contenedores en camino»

Recomendación: reutilizar Tracking, filtro «En mar», en vez de una pantalla nueva:

- Enlace desde Almacén China (cabecera y aviso del §2.1) a `/studio/tracking?g=mar`: Tracking ya lee el
  grupo de la URL (`app/studio/(app)/tracking/page.tsx:274`), así que no hay que tocar Tracking.
- La privacidad de China (solo MARKBOX, SDD-0531) ya rige en Tracking.
- Si Sam quiere la lista dentro de Almacén China, una pestaña «En camino» que lea los mismos datos de
  `lib/studio/tracking-contenedores.ts` (sin duplicar la regla de grupos).

## 3. Fuera de alcance

- Cerrar o borrar recepciones duplicadas en producción (si el conteo las encuentra): se decide aparte, con
  OK de Sam y el runbook.
- Cambiar la carga de consolidados para que enlace recepciones existentes: otra SDD si hace falta.

## 4. Pruebas previstas

- Unitarias de `parseReceiptFiltersFromSearchParams` (por defecto «En almacén»; `?status=all` sigue dando
  todo) y de `listReceipts` con el filtro nuevo.
- Unitarias de la regla de pestañas de Embarques (conteo = filtro).
- Componente: el aviso de «N consolidadas no se muestran» y su enlace.
- Cierre con `pnpm verify` en turno de PC del DG; `/ui-check` por ser UI.

## 5. Preguntas para Sam

1. ¿Autorizas un conteo en producción, sin nombres ni montos: cuántas recepciones de Almacén China están
   `pendiente_consolidacion` con marcas del contenedor 64, y cuántas `WR-C64-*` hay `consolidado`? Es lo
   único que confirma si hay duplicado (§1.3).
2. Almacén China por defecto: ¿solo lo que está en bodega (pendiente + incidencia), con «Consolidado» y
   «Todos» a un clic? (recomendado)
3. Embarques: ¿«Activos» debe dejar fuera lo que va en el mar, con una pestaña «En camino» aparte (a), o
   solo plegar los contenedores zarpados (b)?
4. «Contenedores en camino»: ¿basta con llevar al equipo de China a Tracking, «En mar» (recomendado), o la
   quieres como pestaña dentro de Almacén China? ¿El equipo de China tiene hoy Tracking en su menú?
