---
sdd: "0164"
title: "Unificación de nombres de servicios: un servicio, un nombre, un valor de enum"
status: in-progress
author: "founder"
created: 2026-07-20
updated: 2026-07-20
supersedes: null
superseded_by: null
related: ["0055", "0061", "0063", "0076", "0090"]
confidencialidad: interno
---

# DTD-0164 — Unificación de nombres de servicios

> El mismo servicio se llamaba distinto en cada pantalla, el Studio y la web se
> contradecían sobre cómo se paga el puerta a puerta, y dos productos distintos
> compartían un solo valor de enum. Esta spec deja **un nombre por servicio, en
> una sola fuente de verdad, y un valor de enum por producto**.

## Contexto

Quien llegue a esto en seis meses necesita saber tres cosas antes de leer nada más:

1. En Postgres existe el enum `shipment_service`. Lo usan **seis** tablas:
   `rates`, `quotes`, `shipments`, `sales_orders`, `route_cost_templates` y
   `service_configs`. Es el eje operativo: define tarifa, cotización, orden de
   venta, plantilla de costos y ficha pública de un servicio.
2. Encima de eso hay un **catálogo comercial** de 20 servicios en
   `lib/shared/service-catalog.ts` (SDD-0076). Cinco de ellos son "núcleo"
   (mueven un embarque, tienen tarifa y factura); el resto son add-ons.
3. El nombre que ve el cliente salía de sitios distintos según la pantalla, y
   nadie era la fuente de verdad.

### Las tres desalineaciones (todas verificadas antes de escribir esto)

**1 · El mismo servicio, tres nombres.** Tomando `consolidacion` como ejemplo,
antes de esta spec convivían:

| Dónde | Cómo se llamaba |
|---|---|
| `lib/studio/rate-types.ts` › `RATE_SERVICE_OPTIONS` | "Consolidación (LCL)" |
| `lib/studio/shipment-types.ts` › `SERVICE_OPTIONS` | "Consolidación (LCL)" |
| `lib/shared/shipment-public.ts` › `SERVICE_LABELS` | "Consolidación · LCL" |
| `lib/portal/portal-types.ts` › `SERVICE_SHORT_LABELS` | "LCL" |
| `lib/shared/service-catalog.ts` › entrada `lcl-consolidado` | "LCL Consolidado (carga compartida, con BL propio)" |
| `service_configs.title_public` (DB de prod) | "LCL Consolidado (carga compartida, con BL propio)" |

La causa no era descuido: cada archivo **redefinía su propia lista** de
etiquetas en vez de derivarla. Cuatro listas paralelas con los mismos cuatro
valores de enum, mantenidas a mano.

**2 · Una contradicción de fondo sobre cómo se cobra.** El Studio etiquetaba el
puerta a puerta como *"Puerta a Puerta DDP (prepago)"* mientras el sitio público
y la FAQ decían **"Pagas al llegar"**. La verdad comercial es *pagas al llegar*;
"prepago" es un término retirado el 2026-06-04 que había sobrevivido en los
selects internos. Un asesor leyendo la pantalla del ERP le decía al cliente lo
contrario de lo que el cliente había leído en la web.

**3 · Dos productos, un solo valor de enum.** `fcl-bodega` (contenedor completo
consolidado en la bodega de Yiwu) y `fcl-directo` (contenedor cargado en la
fábrica del proveedor) son productos distintos —precio distinto, operación
distinta— y ambos mapeaban a `reserva_FCL`. Consecuencias concretas: no se les
podía cargar tarifa distinta en `rates`, no se podían medir por separado en
Reportes, y `serviceIdsForShipment()` tenía que devolver un array porque el
mapeo era N:1.

Como daño colateral de (1) y (2), la tarifa pública del calculador —que es del
**puerta a puerta**— está guardada en prod como `service = 'consolidacion'`. Es
el dato mal clasificado que motivó esta spec.

## Alcance

**Entra:** el enum de Postgres, la fuente única de etiquetas en `lib/shared/`,
todas las superficies que consumen el enum (Studio, portal, móvil, sitio
público), los tests, y la documentación de qué queda pendiente.

**No entra:** cambiar precios; corregir filas de datos por migración (ver
[Operación](#operación--lo-que-no-va-por-migración)); rediseñar la ficha pública
de cada servicio; el mapeo contable.

## La propuesta aprobada

| Código en el enum | Nombre único (el mismo en TODAS partes) | Aclaración corta |
|---|---|---|
| `puerta_a_puerta_DDP` *(sin cambio)* | **Puerta a Puerta** | Todo pagado · pagas al llegar |
| `consolidacion` → **`consolidado_lcl`** | **Consolidado LCL** | Hasta puerto · con tu BL |
| `reserva_FCL` → **`fcl_directo`** | **FCL directo de fábrica** | Contenedor cargado en origen |
| **`fcl_bodega`** *(valor nuevo)* | **FCL en bodega** | Contenedor completo, consolidado en Yiwu |
| `transporte_terrestre` *(sin cambio)* | **Transporte terrestre** | Nacional en Venezuela · próximamente |

### El razonamiento de cada decisión

**Por qué renombrar `consolidacion` es obligatorio y no cosmético.** La palabra
significa dos cosas en este negocio: el *producto* (LCL hasta puerto, con BL
propio del cliente) y la *operación* de juntar carga de varios clientes en un
contenedor, que también hace el puerta a puerta. Un dato ya se guardó mal en
producción por esa ambigüedad. `consolidado_lcl` nombra el producto y deja la
palabra "consolidación" libre para la operación.

**Por qué `reserva_FCL` se RENOMBRA en vez de crear un valor nuevo.** "Reserva
de contenedor" es literalmente lo que significa el FCL directo — su `legacySlug`
histórico en el catálogo es `reserva-contenedores`, y las filas que hoy tienen
ese valor (3 embarques, 2 tarifas) son directos de fábrica. Renombrando, esas
filas migran solas y ninguna queda huérfana. Si en cambio se hubiera creado un
valor nuevo, habría que decidir a mano el destino de cada fila vieja, con una
ventana en la que el dato queda inconsistente.

**Por qué `fcl_bodega` sí es valor nuevo.** No hay filas que le correspondan
automáticamente: separar cuáles de los contenedores históricos se consolidaron
en bodega es una reclasificación comercial que hace una persona, no una
migración que adivine. Arranca vacío.

**Por qué el nombre visible no lleva "DDP".** Decisión del founder (2026-07-17):
de cara al cliente el servicio se llama "Puerta a Puerta"; "DDP" es jerga de
comercio exterior que se usa solo como aclaración técnica cuando hace falta. El
enum interno sigue siendo `puerta_a_puerta_DDP` — cambiarlo no aporta nada y
costaría otra migración.

**Por qué desaparece "prepago".** Es falso: el cliente paga al llegar. Ver la
desalineación 2.

## Diseño

### La fuente única

Todo el naming vive ahora en **`lib/shared/shipment-public.ts`**. Se eligió
`lib/shared/` porque es el **único puente permitido** entre el sitio público y
el ERP (regla dura de `AGENTS.md`, forzada por ESLint): el sitio público no
puede importar `@/lib/studio`, así que cualquier cosa que necesiten los dos
lados tiene que vivir ahí.

Lo que exporta, y qué reemplazó:

| Símbolo | Qué es | A quién reemplaza |
|---|---|---|
| `SHIPMENT_SERVICES` | tupla `as const` con los 5 valores, en orden comercial | las ~8 listas `ShipmentService[]` escritas a mano |
| `ShipmentService` | el tipo, **derivado** de la tupla | la unión de strings escrita a mano |
| `isShipmentService()` | guard para texto crudo (querystring, FormData, CSV) | los `VALID_SERVICES.includes(...)` de cada archivo |
| `SERVICE_LABELS` | `{ primary, sub }` por servicio — **el nombre** | las 4 tablas de etiquetas paralelas |
| `SERVICE_SHORT_LABELS` | variante corta para chips | la copia que vivía en `lib/portal/portal-types.ts` |
| `SERVICE_OPTIONS` | opciones de select, **derivadas** de `SERVICE_LABELS` | `SERVICE_OPTIONS` de shipment-types + `RATE_SERVICE_OPTIONS` de rate-types |
| `serviceLabel()` | nombre de un servicio, tolerante a basura de la DB | helpers locales repetidos |

La regla que sostiene esto: **una pantalla que necesite una variante la DERIVA;
no la redefine.** `RATE_SERVICE_OPTIONS` quedó como re-export de
`SERVICE_OPTIONS` (alias, un solo origen). `lib/portal/portal-types.ts`
re-exporta las etiquetas en vez de declararlas.

Como `ShipmentService` se deriva de la tupla, agregar un servicio en el futuro
es editar **un** array: TypeScript pasa a reclamar en cada `Record<ShipmentService, …>`
del repo hasta que se cubran todos los casos.

### La migración del enum

`supabase/migrations/0256_shipment_service_nombres_unicos.sql` — **escrita, NO
aplicada** (ver [Estado](#estado-y-orden-de-despliegue)).

```sql
alter type shipment_service rename value 'consolidacion' to 'consolidado_lcl';
alter type shipment_service rename value 'reserva_FCL'   to 'fcl_directo';
alter type shipment_service add value 'fcl_bodega';
```

Tres cosas que hay que entender de esa migración:

**El rename migra las filas solo.** Un enum guarda el OID del valor, no el
texto; la etiqueta es solo un nombre para mostrar. Por eso el rename no necesita
ningún `UPDATE` y no tiene ventana de inconsistencia.

**Pero rompe todo lo que compare contra el TEXTO viejo.** Se barrió el catálogo
del sistema de producción, objeto por objeto (2026-07-20, solo lectura):

| Tipo de objeto | Resultado |
|---|---|
| Constraints CHECK | ninguno. El único match del grep (`club_group_buys_status_chk`) contiene `en_consolidacion`, un estado de compra grupal en columna `text` → falso positivo |
| Vistas / matviews | ninguna |
| Políticas RLS | ninguna |
| Índices parciales | ninguno con predicado sobre estos valores. Los tres índices que tocan la columna (`rates_tenant_service_idx`, `shipments_tenant_service_idx`, `route_cost_templates_route_uniq`) indexan el *valor*, no el texto → sobreviven intactos |
| Triggers | ninguno |
| Defaults de columna | **uno**: `sales_orders.service default 'consolidacion'::shipment_service`. No hay que reescribirlo — guarda el OID, así que tras el rename apunta al mismo valor ya llamado `consolidado_lcl` |
| Funciones / RPC | **una de verdad**: `public_fcl_rates()` compara `r.service = 'reserva_FCL'` como texto → **la migración la recrea**. Otras tres (`receive_prealerta_as_operario`, `operario_action`, `create_receipt_as_operario`) contienen `pendiente_consolidacion`, que es `warehouse_receipt_status` → falsos positivos, no se tocan |

Sin recrear `public_fcl_rates()`, la calculadora FCL del sitio público reventaría
en la primera llamada después del rename.

**El gotcha de `ADD VALUE`.** No podía correr dentro de una transacción hasta
PG 11, y el valor recién agregado **no se puede usar en la misma transacción que
lo crea**. Producción corre **PostgreSQL 17.6** (verificado), así que la primera
restricción no aplica; la segunda sigue vigente, y por eso la migración **no usa
`fcl_bodega` en ningún lado**: no lo compara, no lo inserta, no lo mete en un
default.

### Impacto por superficie

| Superficie | Qué cambia |
|---|---|
| **Studio ERP** | Los selects de Tracking, Tarifas, Cotizador, Órdenes de venta y Costing muestran los nombres nuevos. Desaparece "(prepago)". Reportes agrupa por los nombres nuevos |
| **Portal del cliente** | Chips y detalle de envío usan `SERVICE_SHORT_LABELS` de la fuente única. El chip del LCL pasa de "LCL" a "Consolidado LCL" |
| **Móvil (`/m/erp`)** | Lee `SERVICE_LABELS`; cambia solo el texto |
| **Sitio público** | Ver abajo — es el único con texto ya publicado |
| **Frontera público↔ERP** | Intacta. Todo lo compartido vive en `lib/shared/`; ningún archivo público importa `@/lib/studio`, `@/lib/db` ni `@supabase/*` |

**Textos visibles que cambian en el sitio publicado:** solo
**`/servicios`**, en el componente `components/servicios/OfertaWizard.tsx`, que
lee el `nombre` del catálogo. Los nombres de los cinco servicios núcleo pasan a
ser los de la tabla aprobada (p. ej. "LCL Consolidado (carga compartida, con BL
propio)" → "Consolidado LCL"). Las **fichas** de `/servicios` no cambian acá:
su título sale de `service_configs.title_public` en la DB, que edita el founder
desde `/studio/servicios` (queda como pendiente alinearlos). `/tarifas`,
`/fcl`, `/calculadora`, `/track` y `/estimacion` no muestran el nombre del enum
→ sin cambio visible.

## Operación — lo que NO va por migración

La fila pública de `rates` (`id = f988b289-d862-4766-b8cb-84153ffd290b`,
China → Venezuela, `is_public = true`) está mal clasificada: tiene
`service = 'consolidacion'` pero su propia nota dice *"LCL DDP estándar"* y
alimenta la pestaña **Puerta a Puerta** del calculador.

**No se corrige por migración.** Decisión del founder: el precio es dato
**operativo**, no estructura. Una migración con un precio adentro deja ese
número congelado para siempre, y cualquiera que reconstruya la base desde cero
termina sembrando una tarifa vieja. Los tres campos los edita el founder en
`/studio/tarifas`, que es la pantalla hecha para eso:

- `service`: `consolidacion` → `puerta_a_puerta_DDP`
- `per_cbm`: 850 → **800**
- `valid_until`: renovar (la vigencia comercial es de un mes a 45 días)

### El riesgo del vencimiento

`public_cbm_rate()` filtra por `valid_until >= current_date`. Cuando la tarifa
pública se vence, **la RPC no devuelve nada** y el calculador del sitio cae al
respaldo `CONFIG.tarifaBaseCBM` de `lib/calculadora.ts`. Sin avisarle a nadie:
no hay error, no hay alerta, la página sigue cotizando como si nada.

**Hoy el riesgo es tolerable** porque el respaldo y la tarifa real coinciden en
**800**: al vencer, el precio que ve el cliente no cambia. Esa coincidencia está
documentada en el comentario de `CONFIG.tarifaBaseCBM` — no es casualidad y no
se toca a la ligera.

**Igual hay que cerrarlo**, porque la coincidencia es frágil: el día que suban
la tarifa en el Studio sin subir la constante, se reabre la grieta y el sitio
empieza a cotizar por debajo del precio real, en silencio, hasta que alguien lo
note por casualidad.

## Pendientes

**⭐ 1 · Alerta en el ERP: tarifa pública por vencer.** Es el arreglo de fondo
del riesgo de arriba. Descripción suficiente para construirlo sin volver a
investigar:

- **Qué vigilar:** filas de `rates` con `is_public = true`, `status = 'published'`,
  `deleted_at is null` y `valid_until` no nulo. Son las que sirve
  `public_cbm_rate()` y `public_fcl_rates()` al sitio. Hoy son poquísimas (una
  per_cbm por modalidad de calculador tras la migr 0255, más las rutas FCL
  públicas).
- **Cuándo avisar:** `valid_until - current_date <= 7` (por vencer) y
  `valid_until < current_date` (ya vencida, el sitio ya está cayendo al
  respaldo). Dos niveles, no uno: el segundo es incidente, no recordatorio.
- **A quién:** al founder y al rol comercial. Los canales ya existen —
  Telegram (`@DTDStudioBot`) y el motor de correo del Studio.
- **Dónde engancharlo:** el motor de avisos ya tiene cron y fan-out
  (`lib/studio/notifications/`); esto es una regla más, no infraestructura nueva.
- **Qué mostrar:** además del aviso, un badge en `/studio/tarifas` sobre la fila
  pública, para que se vea sin depender de que llegue el mensaje.
- **Criterio de cierre:** que una tarifa pública no pueda vencerse sin que
  alguien se haya enterado antes.

2 · Reclasificar en `/studio/servicios` la ficha `fcl-bodega`: hoy su
`service_configs.shipment_service` apunta a `reserva_FCL` (tras el rename
quedará en `fcl_directo`) y debe pasar a `fcl_bodega`. Es un clic, pero si no se
hace los dos FCL siguen indistinguibles del lado de la DB.

3 · Alinear los `service_configs.title_public` de los cinco núcleo con los
nombres de la tabla aprobada (hoy son los largos). Los edita el founder desde
`/studio/servicios`, sin deploy.

4 · Decidir si `public_fcl_rates()` debe incluir también `fcl_bodega`. La
migración mantiene el comportamiento actual (solo `fcl_directo`) a propósito:
ampliarlo cambia qué rutas ve el público y es decisión comercial.

5 · Revisar si el FCL en bodega necesita tarifa propia en `rates` ahora que
puede tenerla — que era, justamente, el motivo de separarlo.

## Estado y orden de despliegue

⚠️ **El código y la migración van juntos.** El código del repo ya usa
`consolidado_lcl` / `fcl_directo`; producción todavía tiene `consolidacion` /
`reserva_FCL`. Desplegar el código **antes** de aplicar la migración rompe el
ERP: Postgres rechaza los valores nuevos del enum.

Orden obligatorio, sin saltos:

1. Aplicar **`0255_rates_public_calc_modo.sql`** — va primero porque inserta con
   el literal `'consolidacion'`, que la 0256 elimina.
2. Aplicar **`0256_shipment_service_nombres_unicos.sql`**.
3. Recién ahí, desplegar el código.

Las dos están declaradas como espera conocida en
`supabase/migrations-baseline.json` › `pendingBelowCutoff`, con su motivo, así
que el paso `migrations-applied` de `scripts/verify.mjs` las muestra en amarillo
en lugar de romper el gate. Aplicarlas exige OK del founder **nombrando el
archivo**, de a una, según `docs/runbooks/aplicar-migraciones-prod.md`.

## Verificación

- `node scripts/verify.mjs` verde: lint · rsc-boundary · typecheck · vitest ·
  docs:check · e2e; `migrations-applied` en amarillo con las dos esperas
  declaradas.
- Tests nuevos en `lib/shared/__tests__/shipment-public.test.ts`: los 5 servicios
  con nombre y aclaración, las variantes derivadas de la fuente única, los dos
  FCL distinguibles, ninguna etiqueta con "prepago", y un **guardia
  anti-regresión** que recorre todos los `.ts`/`.tsx` del repo y falla —nombrando
  el archivo culpable— si alguien vuelve a escribir `"consolidacion"` o
  `"reserva_FCL"` como valor de servicio.
