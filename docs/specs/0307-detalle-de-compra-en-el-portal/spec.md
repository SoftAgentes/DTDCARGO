---
sdd: "0307"
title: "El detalle de compra del portal: qué llegó a Yiwu"
status: done
author: "founder"
created: 2026-08-24
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0057","0281","0283","0308"]
confidencialidad: interno
---

# DTD-0307 — El detalle de compra que no existía

> **Spec retroactiva.** El trabajo se construyó y se publicó el 2026-08-24 en el
> commit `b5af1821`, pero **bajo el número 0281, que pertenece a otro trabajo**.
> Este documento le da su número propio y recoge la descripción que había
> quedado dentro de la spec ajena. **El código no cambia**: sólo se corrigen las
> citas. Ver §5.

## 1. El hueco

Medido: `app/portal/(app)/compras/` tenía `page.tsx` (listado), `nueva/`
(asistente) y `[code]/etiquetas/`. **No había `[code]/page.tsx`.** El cliente
anunciaba la compra, imprimía sus etiquetas, y desde ahí quedaba a ciegas hasta
que la mercancía aparecía dentro de un envío. Cada "¿ya llegó a la bodega?" y
"¿cuántas cajas les llegaron?" salía del ERP por WhatsApp, escrito a mano.

Los datos ya estaban todos: `warehouse_receipts_cn.prealerta_id` existe desde la
migración 0127 (con índice), y `getPrealertaByCode` ya estaba escrita —con filtro
por markbox— para una página de detalle que nunca se construyó.

## 2. Lo que responde, en el orden en que el cliente pregunta

1. ¿Llegó a Yiwu? ¿Cuándo?
2. **¿Llegaron TODAS las cajas que anuncié?** ← lo primero y en grande
3. ¿Cuánto midió y pesó de verdad?
4. ¿Ya va en un envío?

**El desajuste se muestra, no se esconde.** Si anunció 10 cajas y llegaron 7, la
pantalla dice "Llegaron 7 de 10 cajas · faltan 3". Mostrar sólo "7 recibidas"
sería técnicamente cierto y prácticamente una omisión: el cliente quiere
enterarse ahí y no cuando le llegue la factura.

**Y un CBM sin medir no es 0.** `sumaOculta` devuelve `null` cuando ninguna
recepción trae la medida, y la pantalla imprime `— m³`. Un `0.000 m³` le diría al
cliente que su carga no ocupa nada.

## 3. Por qué usa el admin client, y por qué es seguro

`warehouse_receipts_cn` sólo tiene la policy `by tenant`
(`tenant_id = get_user_tenant_id()`). Un cliente del portal **no está en
`user_tenants`**, así que con su sesión esa consulta vuelve vacía siempre — no
"casi vacía": vacía, y en silencio.

Se aplica el mismo patrón que el detalle de envío ya usa para consolidaciones:
**primero se prueba la propiedad con las credenciales del propio cliente
(`getPrealertaByCode` con RLS + filtro por `client_markbox`; si es null → 404), y
sólo con el id ya verificado se lee con el admin client.** La función que usa el
admin vive aislada en su propio módulo, con esa condición escrita en su
encabezado, para que no se pierda de vista al leer la página.

Es el mismo patrón que después reusó [SDD-0308](../0308-packing-list-en-el-portal/spec.md)
para el packing list del proveedor, en esta misma pantalla.

## 4. Alcance construido (commit `b5af1821`)

| Archivo | Acción |
|---|---|
| `app/portal/(app)/compras/[code]/page.tsx` | nuevo — la pantalla |
| `lib/portal/purchase-reception-queries.ts` | nuevo — lectura aislada con admin client |
| `lib/portal/__tests__/purchase-reception-queries.test.ts` | nuevo — helpers puros |
| `app/portal/(app)/compras/ComprasList.tsx` | edita — la card lleva al detalle |

## 5. Por qué esta spec nace retroactiva

El 2026-08-24 dos ventanas trabajaron en paralelo y **ambas tomaron el número
0281**, con ocho minutos de diferencia:

| Commit | Hora | Trabajo | Carpeta de spec |
|---|---|---|---|
| `b5af1821` | 06:35:01 | **Este** (detalle de compra) | ninguna — se escribió dentro de la ajena |
| `3fce82a9` | 06:43:30 | Estado de cuenta · carril comercial | `0281-documentos-del-carril-comercial` |

Las dos llegaron a `main`, así que la regla habitual —*se mueve la que NO está
en `main`*— no decidía nada. Se resolvió por **quién tiene carpeta propia**: la
0281 la tiene y ~33 archivos la citan legítimamente (facturación, cotizador,
cobranzas, dashboard, PDF, CSV). Este trabajo no la tenía, y sólo **6** archivos
citaban el número por él. Mover los 6 es barato; renumerar la 0281 habría roto
33 referencias correctas.

⚠️ **El gate no podía detectarlo.** `check-numbering.mjs` compara **carpetas** de
spec y de migración. Como este trabajo nunca creó carpeta, no había duplicado que
ver: `numbering` salía verde y el correlativo tampoco mostraba hueco. El punto
ciego es la cita en comentarios, que ningún paso mira.

## 6. Qué se corrigió al renumerar (2026-08-26)

Sólo citas. **Cero cambios de comportamiento.**

| Archivo | Qué decía |
|---|---|
| `lib/portal/purchase-reception-queries.ts` | "Lo que pasó en la bodega de Yiwu con UNA compra" |
| `lib/portal/__tests__/purchase-reception-queries.test.ts` | "Los helpers puros del detalle de compra del portal" |
| `app/portal/(app)/compras/[code]/page.tsx` | "Detalle de UNA compra en el portal" |
| `app/portal/(app)/compras/ComprasList.tsx` | "la card lleva al DETALLE de la compra" |
| `app/studio/(app)/cn/actions.ts` | "`/portal/compras/[code]` (SDD-0281) le dice…" |
| `lib/studio/notifications/schedule-client-notifications.ts` | "El aviso de una COMPRA lleva a `/portal/compras/[code]`" |

En `0281-documentos-del-carril-comercial/spec.md` la sección que describía esta
pantalla se reemplaza por un puntero a este documento, para que no queden dos
descripciones del mismo trabajo divergiendo con el tiempo.
