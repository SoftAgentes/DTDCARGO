---
sdd: "0507"
title: "Adjuntos visibles en el Studio: conteo por fila en Clientes, Embarques y Tracking, y «Todos los adjuntos» en la ficha del cliente"
status: proposed
author: "Claude + founder"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0049", "0060", "0042", "0411", "0012", "0013", "0265"]
confidencialidad: interno
---

# SDD-0507 · Adjuntos visibles en el Studio

> Que el equipo sepa desde el listado qué clientes y qué embarques tienen
> documentos o fotos, y que en la ficha del cliente estén todos juntos.

Reserva local `codex/sdd-reserve-0507-adjuntos-visibles-studio` (`32e4b66e`),
hecha por el Worker con `pnpm sdd:next --reserve` sobre `origin/main`
`221c48f4`. Sin publicar todavía.

## El pedido (Sam, 2026-10-14, durante el corte al servidor propio)

> «que cuando un cliente tiene algún adjunto, salga algo que se vean todos los
> adjuntos. Igual un embarque, que se vea visible si tiene adjuntos o no tiene»

Probando el Studio, Sam no encontraba qué clientes o embarques tenían documentos
o fotos. Hoy sólo se ven entrando a cada ficha.

## Contexto (medido en el código de `221c48f4`)

### Dónde viven hoy los adjuntos que muestran las fichas

| Fuente | Qué es | Dónde se ve hoy | Bucket |
|---|---|---|---|
| `documents` con `entity_type = 'client'` | Hub de documentos (SDD-0049), versionado (SDD-0060): RIF, contratos, KYC | Ficha del cliente, panel «Documentos · hub» (`app/studio/(app)/clientes/[markbox]/page.tsx:163` y `:575-580`) | `documents` |
| `documents` con `entity_type = 'shipment'` | Documentos internos del embarque | Ficha del envío, «Documentos internos · hub» (`app/studio/(app)/tracking/[id]/page.tsx:70` y `:236-243`) | `documents` |
| `shipment_documents` | BL, POD y otros del embarque que el cliente ve en su portal (SDD-0042) | Ficha del envío, «Documentos del cliente · portal» (`tracking/[id]/_components/ShipmentDocsPanel.tsx:82-85`) | `shipment-docs` |

- `documents` es polimórfica: `entity_type` + `entity_id`, sin FK
  (`supabase/migrations/0097_documentos_hub.sql:61-83`). El panel sólo lista la
  versión vigente y no borrada: `is_current = true` y `deleted_at is null`
  (`lib/studio/documents/queries.ts:28-44`).
- Un embarque se liga a su cliente sólo por texto: `shipments.client_markbox`
  (`0002_shipments.sql:35-36`). No hay `client_id` ni índice por markbox.
- **No existe** vista ni RPC que cuente documentos por cliente o por embarque.

### Permisos que aplican (y que esta SDD no cambia)

- `documents` · SELECT: `tenant_id = get_user_tenant_id()` y
  `document_entity_authorized(entity_type, tenant_id, 'view')`
  (`0438_expense_document_entity_rbac.sql:173-178`). Un documento de cliente
  pide el módulo `clients`; uno de embarque, el módulo `tracking`
  (`0444_unlinked_document_entity_rbac.sql:72-94`).
- `shipment_documents` · SELECT: `deleted_at is null`, tenant y
  `document_entity_authorized('shipment', …, 'view')`
  (`0439_shipment_document_entity_rbac.sql:153-158`).
- Ninguna de las dos policies filtra `is_current`, y la de `documents` tampoco
  filtra `deleted_at` (la 0230 lo sacó de todas las policies FOR ALL). Ese
  filtro lo pone la aplicación en cada consulta.

### Restricción: hoy no se pueden aplicar migraciones en producción

Desde el 2026-10-14 producción es Supabase en el servidor propio.
`docs/runbooks/servidor-contabo.md` §4 condiciona aplicar migraciones ahí a que
`aplicar-migraciones-prod.md` se reescriba para el servidor: «Hasta que ese
runbook exista, no se aplican migraciones en el VPS». Al 2026-10-14 ese runbook
sigue describiendo Supabase Cloud. Una vista o RPC nueva quedaría en espera sin
fecha.

## Decisión técnica (propuesta)

**Sin migración.** Los conteos y la sección se calculan en el servidor de Next
con el cliente de sesión del usuario (`createClient()`), leyendo las mismas
tablas con los mismos filtros que las fichas. La RLS hace el resto: lo que el
usuario no puede ver no se cuenta.

### Definición única de «adjunto vivo»

Vive en un solo módulo, `lib/studio/documents/adjuntos-queries.ts`, y la usan
los tres listados y la ficha. Así no puede pasar que el número de una fila
diga una cosa y la ficha otra.

- **De un embarque S:** documentos de `documents` con `entity_type = 'shipment'`,
  `entity_id = S.id`, `is_current` y `deleted_at is null`, más filas de
  `shipment_documents` con `shipment_id = S.id` y `deleted_at is null`.
- **De un cliente C:** documentos de `documents` con `entity_type = 'client'`,
  `entity_id = C.id`, `is_current` y `deleted_at is null`, más los adjuntos de
  cada embarque con `client_markbox = C.markbox` y `deleted_at is null`.
- Un embarque eliminado no suma al total de su cliente. Si un listado lo
  muestra igual (ver «Fuera de alcance detectado»), su fila cuenta sus propios
  adjuntos.

### Cómo se consulta

- Sólo columnas mínimas para contar (`entity_id`, `shipment_id`, `id` y
  `client_markbox`); nada de nombres de archivo en los listados.
- Las listas de IDs se parten en bloques de 100 para `.in()` (la URL queda por
  debajo de 4 KB). Cada bloque se lee paginado con `.range()` de 1000 en 1000,
  ordenado por `id`, hasta agotar: el techo de filas de PostgREST no puede
  truncar un conteo en silencio.
- Costo esperado: Embarques (hasta 100 filas) 2 consultas; Tracking (hasta
  200) 4; Clientes con 200 filas, alrededor de 6 a 12, según cuántos embarques
  tengan. Si el volumen crece, el plan B es una vista `security_invoker` + RPC
  de conteo con su contrato SQL, cuando exista el procedimiento para migrar en
  el servidor. Las firmas de las funciones del módulo no cambian.
- Si una consulta falla, la función devuelve `null`: la pantalla dice que no se
  pudo contar. **Nunca muestra «Ninguno» sin haber contado.**

## Contrato funcional

Mockup para validar: <https://claude.ai/artifact/SkR6QtFSXCLdaQcwGTCsVx>.

### Indicador (componente nuevo `AdjuntosConteo`)

- Con adjuntos: ficha neutra (`--neutral-bg`, texto `--ink`), icono `doc` del
  set del Studio y el número en JetBrains Mono. Lector de pantalla: «5
  adjuntos» (o «1 adjunto»).
- Sin adjuntos: la palabra «Ninguno» (en la tarjeta de Tracking, «Sin
  adjuntos») en `--ink-soft`. No depende del color: la diferencia es la ficha
  y el texto.
- El atributo `title` da el desglose. Cliente: «5 adjuntos: 2 en su ficha · 3
  en sus embarques (2 los ve el cliente en el portal)». Embarque: «2 adjuntos:
  1 interno · 1 lo ve el cliente en el portal».

### Clientes (`/studio/clientes`)

- Columna nueva «Adjuntos» entre «Tier» y «Contacto» con el indicador.
- El número es el total del cliente (su ficha + sus embarques) y coincide con
  el de «Todos los adjuntos».
- Si el conteo falla, la columna no se pinta y debajo de la tabla, junto a
  «Mostrando N de M», se lee «No se pudieron contar los adjuntos.».

### Embarques (`/studio/embarques`)

- Columna nueva «Adjuntos» antes de «Creado» en las filas de cada grupo.
- Mismo comportamiento ante error que Clientes.

### Tracking (`/studio/tracking`)

- En la línea inferior de cada tarjeta de envío activo, entre el progreso y la
  ETA: «2 adjuntos» o «Sin adjuntos».

### Ficha del cliente (`/studio/clientes/[markbox]`)

- En la cabecera, junto a los badges de tipo y tier, un enlace «5 adjuntos ·
  ver todos» que baja a `#adjuntos`. Sin adjuntos no se muestra.
- Sección nueva «Todos los adjuntos», en la columna ancha después del
  historial de envíos, de solo lectura:
  - Agrupada por origen: «En la ficha del cliente» primero; después un grupo
    por embarque («Embarque S-2026-0412 · Yiwu → Valencia», con enlace a su
    detalle), ordenados por el adjunto más reciente.
  - Cada fila: extensión, nombre, versión cuando la tiene, tipo o carpeta,
    tamaño, fecha, «Interno» o «Portal» (lo ve el cliente) y el botón «Ver».
  - «Ver» firma la URL al tocarlo, con TTL de 60 s y el cliente de sesión:
    `signDocumentUrl` (bucket `documents`) y una acción nueva
    `signShipmentDocumentUrl` (bucket `shipment-docs`). La RLS de Storage
    decide; ningún cliente admin.
  - Para subir, versionar o eliminar se sigue usando el panel de la ficha o del
    embarque. La sección no duplica esas acciones.
  - Vacía: «Este cliente todavía no tiene adjuntos, ni en su ficha ni en sus
    embarques.». Error: «No se pudieron cargar los adjuntos. Recarga la
    página; si sigue igual, avísale a soporte.» con `role="alert"`.

### Rótulo del panel del portal (detalle del envío)

«Documentos del cliente · portal» pasa a «Documentos del embarque · los ve el
cliente». Es el panel donde Sam vio el documento de un embarque y parecía del
cliente. El subtítulo y el comportamiento no cambian.

## Permisos, privacidad y gobernanza

- **No se amplía acceso.** Todo se lee con el cliente de sesión y las mismas
  tablas que ya usan las fichas. No hay `createAdminClient`, vista nueva ni RPC
  nueva. Un rol sin el módulo `tracking` ve y cuenta sólo los documentos de la
  ficha del cliente, igual que hoy en la ficha.
- **Sin nombres en logs.** Los errores se registran, si acaso, con el código de
  PostgREST; nunca con nombres de archivo, rutas de Storage ni datos del
  cliente.
- **Datos personales.** No se captura ni se mueve nada nuevo: sólo se muestra
  junto lo que ya se mostraba por separado. La revisión `revisar-datos-ve` se
  registra en el handoff como «no aplica», con ese motivo.
- **Políticas:** LOD-01 y ERR-01 (estados vacío y error con texto y acción),
  A11Y-01 (texto para lector de pantalla, no sólo color), VIS-01 (tokens y
  jerarquía), CMP-01 (componente nuevo en `app/studio/_components/documents/`,
  junto a `DocsPanel`).

## Allowlist exacta

Documentación y control:

- `docs/specs/0507-adjuntos-visibles-studio/spec.md`
- `docs/specs/README.md` (regenerado con `pnpm docs:index`)
- `.agents/handoffs/0507-adjuntos-visibles-studio.md`

Producto:

- `lib/studio/documents/adjuntos.ts` (tipos, desglose, textos y agrupación; puro)
- `lib/studio/documents/adjuntos-queries.ts` (lecturas)
- `app/studio/_components/documents/AdjuntosConteo.tsx`
- `app/studio/(app)/clientes/page.tsx`
- `app/studio/(app)/clientes/_components/ClientsClient.tsx`
- `app/studio/(app)/clientes/[markbox]/page.tsx`
- `app/studio/(app)/clientes/_components/TodosLosAdjuntos.tsx`
- `app/studio/(app)/embarques/page.tsx`
- `app/studio/(app)/embarques/_components/EmbarquesClient.tsx`
- `app/studio/(app)/tracking/page.tsx`
- `app/studio/(app)/tracking/_components/ActiveShipmentList.tsx`
- `app/studio/(app)/tracking/[id]/_components/ShipmentDocsPanel.tsx` (sólo el rótulo)
- `app/studio/(app)/tracking/[id]/document-actions.ts` (sólo `signShipmentDocumentUrl`)

Pruebas:

- `lib/studio/documents/__tests__/adjuntos.test.ts`
- `lib/studio/documents/__tests__/adjuntos-queries.test.ts`
- `app/studio/_components/documents/__tests__/AdjuntosConteo.test.tsx`
- `app/studio/(app)/clientes/_components/__tests__/TodosLosAdjuntos.test.tsx`
- Ajustes en pruebas existentes de esos componentes si fijan el texto o las
  columnas que cambian.

Si Sam aprueba el filtro opcional, se suman sólo los archivos de los listados
que lo llevan; se anota aquí antes de tocarlos.

## Criterios de aceptación

1. **Una sola definición.** Para cualquier cliente, el número de su fila en
   Clientes es igual al total de su «Todos los adjuntos». Lo prueba un test que
   corre las dos funciones sobre el mismo doble de PostgREST.
2. **El doble filtra de verdad.** El doble aplica `.eq`, `.is`, `.in`, `.range`
   y `.order`; un mutante que quita cualquiera de los filtros de «adjunto vivo»
   (`is_current`, `deleted_at` en las tres fuentes, `entity_type`, embarque
   eliminado) pone la prueba en rojo.
3. **Sin truncar.** Con más de 1000 documentos en una fuente, el conteo los
   lee todos (prueba con 2.500 filas en el doble).
4. **Lo que la RLS oculta no se cuenta.** Si el doble devuelve menos filas para
   un rol (simulación de RLS), los conteos y la sección bajan igual, y ninguna
   función usa otro cliente.
5. **Fallo honesto.** Si cualquier lectura falla, los conteos son `null` y la
   pantalla dice «No se pudieron contar los adjuntos.»; nunca «Ninguno».
6. **Indicador accesible.** «5 adjuntos», «1 adjunto» y «Ninguno» se leen como
   texto; el desglose sale en `title`.
7. **Ver.** Cada fila de la sección abre su archivo con la acción del bucket
   que corresponde; `signShipmentDocumentUrl` rechaza rutas que no tengan la
   forma `{tenant}/{embarque}/{archivo}` antes de firmar.
8. **Rótulo.** El panel del portal en el detalle del envío dice «Documentos del
   embarque · los ve el cliente».
9. `pnpm verify` completo, con turno pedido al Director.

## Fuera de alcance

- Fotos de recepción en China (`warehouse_receipt_photos`), documentos de
  prealertas, evidencias de reclamos, comprobantes de pago, foto de la cédula y
  foto de la fachada. Cada una tiene su propio permiso; sumarlas es una segunda
  parte con su propia revisión de permisos (pendiente de la decisión de Sam).
- Subir o borrar desde «Todos los adjuntos».
- Vista o RPC de conteo (plan B, cuando se pueda migrar en el servidor).
- Filtro «con / sin adjuntos» en Clientes, salvo que Sam lo pida ahora: el
  listado se pagina en el servidor y el filtro tiene que contar antes de
  paginar.

## Fuera de alcance detectado

- Los listados de Clientes (`lib/studio/client-queries.ts:77-117`), Embarques
  (`lib/studio/shipment-queries.ts:51-116`) y Tracking (`:122-132`) no filtran
  `deleted_at`, y desde la 0230 la RLS tampoco: un cliente o un envío
  eliminado sigue apareciendo en el listado. Lo mismo pasa en el historial de
  envíos de la ficha del cliente (`client-queries.ts:216-231`).
- `DOCUMENT_ENTITY_TYPES` en `lib/studio/documents/types.ts:96-108` no incluye
  `expense`, que la base tiene desde la 0314.
- `addDocumentVersion` (`app/studio/(app)/documentos/actions.ts:175-277`) no
  tiene el gate de módulo que sí tienen subir y borrar; depende sólo de la base.
- La reserva SDD-0506 `bitacora-adjuntos-entidad` (Codex, 2026-10-14 01:01 UTC)
  puede tocar el mismo dominio. Pendiente de confirmar con Sam o el Director.

## Decisiones pendientes de Sam

1. Aprobación del mockup.
2. Qué cuenta como adjunto en esta primera parte.
3. Filtro «con / sin adjuntos» y en qué listados.
