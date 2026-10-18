---
sdd: "0552"
title: "Portal: relecturas de tenant con el admin, por principal de sesión"
status: in-progress
author: "Claude Code"
created: 2026-10-18
updated: 2026-10-18
supersedes: null
superseded_by: null
related: ["0390", "0397", "0453", "0462", "0481", "0549", "0361"]
confidencialidad: interno
---

# SDD-0552 — Portal: relecturas de tenant con el admin, por principal de sesión

> El Portal resuelve al cliente desde la sesión con `getPortalClientPrincipal` (vínculo activo,
> cliente vivo del mismo tenant) y filtra por su tenant y su Shipping Mark. Esta spec cierra los
> tres hallazgos que la SDD-0549 dejó fuera de alcance.

## Contexto

La SDD-0549 (PR #270, fusionada el 2026-10-17) llevó facturas, Academia, Reclamos y Compras al
principal de sesión. Su handoff (`.agents/handoffs/portal-lecturas-principal-tenant-0549.md`, FUERA
DE ALCANCE 1, 2 y 3) dejó tres hallazgos. Los comprobé uno por uno contra `origin/main` `e27c6747`.

**Hallazgo 1: trece lecturas que releen `clients.tenant_id` con el cliente admin.** El cliente ya
venía de la sesión, pero el tenant (y en perfil también el Shipping Mark) salía de leer `clients`
con `service_role`, que no tiene RLS:

| # | Archivo y línea en `e27c6747` | Para qué usaba el tenant |
|---|---|---|
| 1 | `app/portal/(app)/page.tsx:105` | próximo zarpe de la portada |
| 2 | `app/portal/(app)/page.tsx:193` | órdenes DDP por aceptar de la portada |
| 3 | `app/portal/(app)/envios/page.tsx:188` | banner del próximo consolidado |
| 4 | `app/portal/(app)/envios/[code]/page.tsx:144` | orden por aceptar de ese envío |
| 5 | `app/portal/(app)/layout.tsx:123` | píldora «Próxima salida» |
| 6 | `app/portal/(app)/cotizaciones/actions.ts:69` | correlativo, alta y aviso de la cotización |
| 7 | `app/portal/(app)/reclamos/actions.ts:76` | correlativo, alta y evidencia del reclamo |
| 8 | `app/portal/(app)/referidos/actions.ts:47` | invitación, ajustes y correo del referido |
| 9 | `app/portal/(app)/perfil/actions.ts:80` | prefijo de la foto de cédula (tenant + Shipping Mark) |
| 10 | `app/portal/(app)/perfil/actions.ts:139` | reconciliación de la foto si se pierde la respuesta |
| 11 | `app/portal/(app)/perfil/actions.ts:257` | tipo de documento y aviso de bloqueo al asesor |
| 12 | `app/portal/(app)/perfil/avatar-actions.ts:62` | prefijo del avatar |
| 13 | `app/portal/(app)/perfil/billing-actions.ts:81` | aviso de bloqueo de facturación al asesor |

En perfil, además, la identidad salía de la RPC `get_portal_client_id` (forma de 0080: no mira si
el cliente vive ni si vínculo y cliente comparten tenant).

**Hallazgo 2: `portalMarkbox`** (`lib/portal/portal-queries.ts:48`) usaba la RPC
`get_portal_client_markbox` y devolvía sólo el Shipping Mark. `listMyShipments`, `getMyShipment`,
`listMyDocuments`, `getPortalActivation` y `getNextArrival` filtraban sólo por él. El Shipping Mark
es único **por tenant** (`0006`) y la policy de equipo «by tenant» es permisiva: una sesión híbrida
(equipo del tenant B y cliente Portal del tenant A) recibía los envíos y documentos del B con el
mismo Shipping Mark; con el mismo código de envío en los dos tenants (único por tenant, `0002`), el
detalle propio daba 404.

**Hallazgo 3: `getPrealertaByCode`** (`lib/studio/prealertas/queries.ts:203`) filtraba por código y
Shipping Mark. Sus seis llamadores son del Portal. Cuatro comparaban `pre.tenant_id` después
(etiquetas, documento y las dos acciones de proveedores); **dos no**: el detalle de la compra
(`compras/[code]/page.tsx`) y «Completar detalle» (`compras/[code]/detalle/page.tsx`), que mostraban
la compra del otro tenant como propia.

## Decisión sobre `getPrealertaByCode`

Se agrega `tenantId` **obligatorio** a sus opciones y la consulta filtra por él. Se descartan las
dos opciones del encargo:

- **Dejarlo como está:** los dos llamadores sin comparación quedaban abiertos, y en los otros cuatro
  la compra compartida (mismo código y Shipping Mark en dos tenants) devolvía dos filas,
  `maybeSingle` fallaba y el cliente legítimo veía «Esa compra no es válida» o un 404.
- **`tenantId` opcional:** todos los llamadores son del Portal y ya tienen el principal. Opcional
  deja que un llamador nuevo lo olvide en silencio, que es justo el defecto que se corrige.
  Obligatorio lo convierte en error de tipos. Las comparaciones posteriores de los cuatro
  llamadores se conservan como segunda valla.

`listActivePrealertaAddons` (SDD-0402) sí lo tiene opcional porque tiene llamadores Studio sin
tenant explícito; `getPrealertaByCode` no tiene ninguno.

## Alcance

**Entra:**

1. `lib/portal/portal-queries.ts`: `portalMarkbox` se reemplaza por `portalScope`, que resuelve el
   principal. Envíos, detalle, documentos, conteo de activación y próximo arribo filtran por
   `tenant_id` **y** Shipping Mark del principal. `getPortalActivation` lee `portal_approved_at` con
   el `client.id` del principal (antes, RPC `get_portal_client_id`).
2. `getPrealertaByCode` exige `tenantId`; sus seis llamadores lo pasan. Detalle y «Completar
   detalle» de la compra pasan a `getPortalClientPrincipal`.
3. Las trece relecturas toman tenant (y Shipping Mark) del principal:
   - portada: órdenes por aceptar con `loadPendingAcceptanceForClient(principal)`, el mismo loader
     de «Mis facturas» (SDD-0549); zarpe con `principal.tenantId`;
   - layout, envíos y detalle de envío: zarpe y orden por aceptar con el principal;
   - cotizaciones, reclamos y referidos: correlativo, alta, avisos y correo con el tenant del
     principal. El reclamo busca el embarque con el tenant del principal y toma `created_by` de
     `principal.userId` (antes, un segundo `auth.getUser()`);
   - perfil: identidad por el principal en la foto de cédula, la edición directa, el avatar (subir
     y quitar) y el aviso de bloqueo de facturación. El admin sólo lee lo que el principal no trae:
     el puntero de la foto, el avatar y el asesor. La reconciliación de la foto (SDD-0481) resuelve
     el principal otra vez y exige el mismo cliente, tenant y Shipping Mark.
4. El admin client sigue donde hace falta (zarpes, órdenes por aceptar, Storage, inserts sin RLS
   de portal, historial de avisos, naviera), pero ya no es la fuente de la identidad ni del tenant.

**Columnas comprobadas** en `supabase/migrations/`: `shipments` (`0002`), `clients` (`0006`),
`shipment_documents` (`0086`), `sailings` (`0096`, ya filtrada) y `prealertas` (`0105`) tienen
`tenant_id uuid not null` desde su migración de origen, y ninguna migración la elimina. No hubo que
omitir ningún filtro.

**No entra:** migraciones, RLS, RPC, UI y copy. Tampoco:

- `getProfileCompleteness` (`portal-queries.ts`) y `cancelDataChangeRequestAction` (perfil): siguen
  con `get_portal_client_id`, pero no releen tenant ni Shipping Mark; leen o borran por `client_id`,
  que es PK global.
- Las lecturas por `client.id` con el admin (`getPortalLastReplyAt`, hilo de soporte, avisos al
  asesor del cliente en conflicto): el id ya viene del principal y es PK global.
- Ver «Fuera de alcance» abajo.

## Contrato

- Lo que ve un cliente Portal **coherente** (un vínculo activo, cliente vivo del mismo tenant) no
  cambia: su tenant de `clients` es el del vínculo, y su RLS Portal ya exige ese tenant. El layout
  ya exigía el principal (con nombre no vacío) para entrar a `(app)`, así que ninguna pantalla
  interna pierde a un cliente que antes entraba.
- Diferencias que sólo ve una sesión híbrida o incoherente:
  - envíos, documentos, próximo arribo, conteo de activación y compras del otro tenant con el mismo
    Shipping Mark ya no aparecen; el envío o la compra con el mismo código en los dos tenants deja
    de dar 404 al cliente legítimo;
  - un reclamo ya no vincula un embarque del otro tenant (antes lo vinculaba si coincidía el
    Shipping Mark, y el trigger `client_claims_check` rechazaba el alta);
  - perfil exige un principal coherente: un vínculo incoherente ya no sube fotos ni edita datos.
- Sin principal: las lecturas de dominio devuelven vacío o null antes de consultar y sin llamar a
  las RPC legadas; las acciones responden «sesión expirada» sin construir el admin client.
- Costo: cada lectura que antes llamaba a la RPC ahora resuelve el principal (`auth.getUser()` +
  `client_users`). Es el mismo patrón que `listMyInvoices` desde la SDD-0462. En la portada son
  llamadas en paralelo.

## Allowlist exacta

Producto:

- `lib/portal/portal-queries.ts`
- `lib/studio/prealertas/queries.ts` (sólo `getPrealertaByCode`)
- `app/portal/(app)/page.tsx`
- `app/portal/(app)/layout.tsx`
- `app/portal/(app)/envios/page.tsx`
- `app/portal/(app)/envios/[code]/page.tsx`
- `app/portal/(app)/compras/[code]/page.tsx`
- `app/portal/(app)/compras/[code]/detalle/page.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/page.tsx`
- `app/portal/(app)/compras/[code]/documento/page.tsx`
- `app/portal/(app)/proveedores/actions.ts`
- `app/portal/(app)/cotizaciones/actions.ts`
- `app/portal/(app)/reclamos/actions.ts`
- `app/portal/(app)/referidos/actions.ts`
- `app/portal/(app)/perfil/actions.ts`
- `app/portal/(app)/perfil/avatar-actions.ts`
- `app/portal/(app)/perfil/billing-actions.ts`

Pruebas nuevas:

- `lib/portal/__tests__/portal-queries-principal-scope.test.ts`
- `lib/portal/__tests__/prealerta-by-code-tenant.test.ts`
- `app/portal/(app)/__tests__/principal-tenant-home.test.tsx`
- `app/portal/(app)/__tests__/principal-tenant-actions.test.ts`
- `app/portal/(app)/envios/__tests__/principal-tenant.test.tsx`
- `app/portal/(app)/compras/[code]/__tests__/principal-tenant.test.tsx`
- `app/portal/(app)/perfil/__tests__/principal-tenant.test.ts`

Pruebas adaptadas (la identidad llega del principal y no de las RPC legadas; no se quitó ni relajó
ninguna aserción):

- `lib/portal/__tests__/portal-tenant-double.ts`: agrega `gte` (cut-off de zarpes), con `NULL` que
  no pasa, como en SQL.
- `lib/portal/__tests__/activation.test.ts`: el stub resuelve un principal en vez de dos RPC.
- `app/portal/(app)/page.test.tsx` y `app/portal/(app)/compras/[code]/page.test.tsx`: mock de
  `getPortalClientPrincipal`.
- `app/portal/(app)/perfil/AvatarAction.test.ts`, `BillingAction.test.ts` y
  `DataChangeAction.test.ts`: mock del principal con la misma ficha. «Sin sesión» de
  `DataChangeAction` gana una aserción (no llama a ninguna RPC).
- `app/portal/(app)/perfil/IdentityPhotoAction.test.ts` (SDD-0481): el principal es un mock que
  cuenta resoluciones. Los casos de tenant y Shipping Mark que cambian durante la subida pasan de
  «lectura» a «identidad», porque ahora se ven al resolver el principal otra vez. Esos casos ganan
  dos aserciones (el objeto subido se conserva y no se vuelve a leer `clients`). La lectura del
  admin exige el `select` sin tenant ni Shipping Mark.
- `app/portal/(app)/proveedores/__tests__/update-prealerta-detalle.test.ts` (SDD-0173): la consulta
  exige además `tenantId` del principal, con un tenant forjado en el formulario que no cuenta.

Documentación: esta spec, `docs/specs/README.md` (índice regenerado) y
`.agents/handoffs/portal-relecturas-principal-tenant-0552.md`.

## Pruebas

El doble `lib/portal/__tests__/portal-tenant-double.ts` (SDD-0549) aplica de verdad `eq`, `neq`,
`is(col, null)`, `in` y ahora `gte`, devuelve copias y no modela la RLS: devuelve las filas de los
dos tenants que pasen la consulta, que es lo que recibe una sesión híbrida. Dos disposiciones:

- **Sesión híbrida:** el mismo Shipping Mark (y a veces el mismo código) en los tenants A y B, más
  otro cliente del tenant A para que el filtro por Shipping Mark tenga qué cortar. Las RPC legadas se
  siembran con el valor que devolvían, para que el código anterior tenga con qué correr.
- **Tenant legado:** el admin trae en `clients` un tenant (y en perfil un Shipping Mark) distinto
  del del principal. El código anterior lo leía; el nuevo no lee `clients` para eso.

**Al revés (control rojo):** con los 17 archivos de producto de `origin/main` `e27c6747` y las
pruebas nuevas, caen 29 de 43. Las 14 que pasan cubren lo que no debía cambiar: sin principal no
se lee nada (portada, layout, envíos, detalle, compra y las tres acciones), los filtros por Shipping
Mark que ya existían, la aprobación leída por id y la compra borrada.

**Mutantes:** se quitó un filtro o una comprobación por vez (16 mutantes, script en el scratchpad
de la sesión), con control verde de 89 de 89 antes y después:

- `portal-queries.ts`: tenant y Shipping Mark de envíos, detalle, documentos, conteo de activación
  y próximo arribo (10);
- `getPrealertaByCode` sin tenant; embarque del reclamo sin tenant;
- reconciliación de la foto sin comparar tenant, Shipping Mark o cliente (3);
- `getNextOpenSailing` sin tenant (código ajeno, pero las pruebas de portada, layout y envíos
  dependen de él).

Mueren los 16. En la primera vuelta sobrevivió «próximo arribo sin Shipping Mark»: el envío activo
del otro cliente iba después del propio y el doble no ordena. Una prueba con ese envío primero lo
mató.

## Aceptación

- [x] Ninguna de las trece lecturas relee `clients.tenant_id` (ni `markbox`) con el admin. Las
  pruebas siembran un tenant legado y fallan con el código anterior.
- [x] Envíos, detalle, documentos, activación y próximo arribo filtran por tenant y Shipping Mark
  del principal; con sesión híbrida fallan con el código anterior.
- [x] `getPrealertaByCode` exige `tenantId`; detalle y «Completar detalle» de la compra lo pasan.
- [x] Sin principal válido: cero consultas de dominio, cero RPC legadas y sin admin client.
- [x] Para un cliente coherente, las pruebas existentes de portada, compra, perfil, activación,
  dashboard y facturas siguen verdes sin relajar aserciones.
- [x] Sin migración, RLS, RPC ni UI nuevas.
- [ ] `pnpm verify` sobre el head de producto (detalle en el handoff).

## Gobernanza y datos

- **Frontera Portal ↔ principal y tenant (0390/0397/0462/0549):** cumplimiento.
- **Políticas visuales y de interacción** (VIS, FRM, BTN, A11Y): no aplica. No hay cambio de UI ni de
  copy; los mensajes de error son los existentes. Desaparecen tres que sólo salían si fallaba la
  relectura del tenant: «No pudimos registrar tu cotización. Intenta más tarde.» (cotizaciones) y
  «No se pudo resolver tu cuenta…» (reclamos y referidos). Ese caso ya no existe: el principal trae
  siempre el tenant, y sin principal la acción responde el mensaje de sesión que ya tenía.
- **Datos personales (revisar-datos-ve):** no aplica. No se captura, mueve ni borra ninguna categoría
  nueva. La foto de cédula y el avatar siguen el mismo flujo y el mismo bucket privado; el prefijo
  del path sale del principal y, para un cliente coherente, es el mismo de antes. Los fixtures son
  sintéticos.
- **Producción:** no se leyó ni escribió nada. No hay migración que aplicar.

## Fuera de alcance (anotado, sin cambio aquí)

1. **RPC `next_supplier_seq` / `next_order_seq` (`0105`)**: resuelven el tenant con
   `coalesce(get_portal_client_tenant(), get_user_tenant_id())`. Piden migración y el OK nominal de
   Sam.
2. **Catálogo de la Academia sin restricción de coherencia en la base** (módulo o lección de un tenant
   colgado del curso de otro). Una FK compuesta lo cerraría; pide migración y el OK nominal de Sam.
3. Otros detalles se registran en el handoff de esta tarea.
