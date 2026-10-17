---
sdd: "0549"
title: "Portal: lecturas restantes por principal de sesión y tenant"
status: done
author: "Codex"
created: 2026-10-17
updated: 2026-10-17
supersedes: null
superseded_by: null
related: ["0390", "0397", "0402", "0418", "0419", "0453", "0462", "0543"]
confidencialidad: interno
---

# SDD-0549 — Portal: lecturas restantes por principal de sesión y tenant

> El Portal resuelve al cliente desde la sesión con `getPortalClientPrincipal` y filtra por su tenant
> y su Shipping Mark. Esta spec lleva ese mismo corte a las pantallas que quedaron fuera de la PR #114.

## Contexto

La PR #114 (SDD-0390 y SDD-0397), fusionada el 2026-10-17, pasó lecturas y acciones del Portal a
`getPortalClientPrincipal(session)` (`lib/portal/portal-queries.ts`). Esa función exige sesión, un
vínculo `client_users` activo y un cliente vivo del mismo tenant que el vínculo. Las lecturas
filtran explícito por `tenant_id` además del Shipping Mark, porque el Shipping Mark es único **por
tenant** (`0006`) y las policies «`<tabla>` by tenant» son permisivas. Una sesión híbrida (miembro
de equipo de un tenant y cliente Portal de otro) recibe por RLS las filas del otro tenant que tengan
el mismo Shipping Mark. El único corte que queda es el filtro de la aplicación.

El Worker de esa PR dejó en su handoff (`.agents/handoffs/portal-reportes-principal-0390-0397.md`,
FUERA DE ALCANCE 1, 2 y 4) los lugares donde el patrón seguía igual. Los comprobé uno por uno contra
`origin/main` `cdb7ff76`:

| Hallazgo | Archivo y líneas en `cdb7ff76` | Qué hacía |
|---|---|---|
| 1 | `lib/portal/pending-acceptance.ts:31-42` (`tenantDe`) | Releía `clients.tenant_id` con el admin client por el id del cliente. Lo usaban «Mis facturas», su estado de cuenta y la puerta del detalle (SDD-0543). |
| 2 | `app/portal/(app)/facturas/[code]/aceptar/page.tsx:50-61` | `getPortalClient` y después `admin.from("clients").select("tenant_id")`. Ese tenant iba a la orden, a los documentos vigentes y a la aceptación previa. |
| 3a | `lib/portal/portal-academy-queries.ts:83` | Helper `portalMarkbox` con la RPC `get_portal_client_markbox`. Inscripciones, diplomas y progreso filtraban sólo por Shipping Mark; el catálogo (cursos, módulos, lecciones), sólo por id. |
| 3b | `app/portal/(app)/academia/actions.ts:26` | Igual. Además, el tenant del upsert salía de la RPC `get_portal_client_tenant`. |
| 3c | `app/portal/(app)/proveedores/actions.ts:177` | Igual, para el duplicado, la edición, el borrado, el conteo de compras y el alta. Las compras leídas por código no se comparaban con ningún tenant. El catálogo de servicios se leía sin `{ tenantId }`, aunque las páginas sí lo pasan (SDD-0402). |
| 3d | `lib/portal/portal-claims.ts:39` | `listMyClaims` con la RPC y filtro sólo por Shipping Mark. |

Columnas: todas las tablas tocadas tienen `tenant_id uuid not null` desde su migración de origen
(`academy_courses`, `academy_modules`, `academy_lessons`, `academy_enrollments` y
`academy_diplomas` en `0144`; `academy_lesson_progress` en `0149`; `suppliers_cn` y `prealertas` en
`0105`; `prealerta_service_requests` en `0150`; `client_claims` en `0152`). Ninguna migración
posterior elimina la columna. No hizo falta omitir ningún filtro.

## Alcance

**Entra:**

1. `loadPendingAcceptanceForClient(principal, admin?)` y
   `loadPendingAcceptanceDetailForClient(principal, code, admin?)` reciben el principal ya resuelto.
   Sin tenant o sin Shipping Mark devuelven vacío/null (falla cerrado). El admin client sigue
   creándose dentro del `try`.
2. «Mis facturas» y el detalle resuelven el principal una vez y se lo pasan al loader.
3. La página de aceptación usa `getPortalClientPrincipal`. Con el tenant del principal lee la orden,
   los documentos vigentes y la aceptación previa. Sin principal redirige a `/entrar` antes de
   construir el admin client.
4. Academia (consultas y acción), Reclamos y Proveedores/Compras resuelven el principal y filtran
   cada consulta por `tenant_id` y Shipping Mark. El catálogo de la Academia filtra por `tenant_id`.
   Las compras leídas por código con `getPrealertaByCode` se comprueban contra el tenant del principal,
   como ya hace `compras/[code]/etiquetas/page.tsx`. El catálogo de servicios de las acciones recibe
   `{ tenantId }`.
5. Las inserciones toman el tenant del principal, no de `get_portal_client_tenant`.

**No entra:** migraciones, RLS, RPC, UI, copy, documentos legales, Studio, y la medida sellada con
varios embarques (ver «Pregunta para Sam»).

## Contrato

- Lo que ve un cliente Portal **coherente** (un vínculo activo, cliente vivo del mismo tenant) no
  cambia. Su RLS Portal (`0417`, `0418`, `0419`, `0434`) ya exige ese mismo tenant. El filtro
  explícito sólo recorta lo que la policy permisiva de equipo le daba a una sesión híbrida.
- Un principal inválido o incoherente corta antes de consultar las tablas de dominio y sin las RPC
  legadas. Es el mismo criterio de `getPortalClientPrincipal`, que ya aplican las lecturas de 0390.
- Diferencias que sólo ve una sesión híbrida o incoherente:
  - un proveedor homónimo de otro tenant ya no bloquea el alta como «duplicado»;
  - un id o código de otro tenant que llegue en el formulario ya no se edita, borra ni cuelga
    compras o servicios;
  - las compras de otro tenant ya no impiden borrar un proveedor propio.
- `getPortalClientPrincipal` exige además un nombre de cliente no vacío. Un cliente vivo con nombre
  en blanco ya no veía facturas desde 0462, y ahora tampoco ve estas pantallas. Es el criterio
  vigente del principal; no se cambia aquí.

## Allowlist exacta

- `lib/portal/pending-acceptance.ts`
- `lib/portal/portal-academy-queries.ts`
- `lib/portal/portal-claims.ts`
- `app/portal/(app)/facturas/page.tsx`
- `app/portal/(app)/facturas/[code]/page.tsx`
- `app/portal/(app)/facturas/[code]/aceptar/page.tsx`
- `app/portal/(app)/academia/actions.ts`
- `app/portal/(app)/proveedores/actions.ts`
- `lib/portal/__tests__/portal-tenant-double.ts` (nuevo)
- `lib/portal/__tests__/pending-acceptance.test.ts`
- `lib/portal/__tests__/portal-principal-tenant-reads.test.ts` (nuevo)
- `app/portal/(app)/facturas/page.test.tsx`
- `app/portal/(app)/facturas/[code]/page.test.tsx`
- `app/portal/(app)/facturas/[code]/aceptar/__tests__/page.test.tsx` (nuevo)
- `app/portal/(app)/academia/__tests__/actions.test.ts` (nuevo)
- `app/portal/(app)/proveedores/__tests__/actions-tenant-scope.test.ts` (nuevo)
- `app/portal/(app)/proveedores/__tests__/update-prealerta-detalle.test.ts` (SDD-0173: su doble
  atendía las RPC legadas; ahora el principal llega por mock de `getPortalClientPrincipal`, la compra
  trae `tenant_id`, el UPDATE exige también el tenant y hay un caso nuevo para una compra del mismo
  Shipping Mark en otro tenant. No se quitó ni relajó ninguna aserción.)
- Esta spec, `docs/specs/README.md` (índice regenerado) y
  `.agents/handoffs/portal-lecturas-principal-tenant-0549.md`.

## Pruebas

El doble `lib/portal/__tests__/portal-tenant-double.ts` aplica de verdad `eq`, `neq`,
`is(col, null)` e `in` en lecturas, UPDATE y DELETE. Devuelve copias. `from()` sólo expone
`select/insert/update/upsert/delete`, así que un filtro antes de `select()` lanza. No modela la RLS:
devuelve las filas de los dos tenants que pasen la consulta, que es lo que recibe una sesión
híbrida. Las RPC legadas se siembran con el valor que devolvían, para que el código anterior tenga
con qué correr. Así, la diferencia la hace el filtro y no la RPC.

- **Al revés:** con los ocho archivos de producto de `origin/main` y las pruebas nuevas, caen 29 de
  41 pruebas. Las 12 que pasan cubren comportamiento que no debía cambiar: vacíos, redirecciones sin
  principal, totales y medida de 0543.
- **Mutantes:** se quitó un filtro o una comprobación de tenant por vez (24 mutantes). Mueren 23, con
  control verde antes y después (31 de 31). Sobrevive uno: el UPDATE de `suppliers_cn` que guarda el
  WeChat del proveedor al registrar la compra. Filtra por un id que la misma acción acaba de validar
  contra el tenant, y el id es PK global, así que el filtro es redundante por construcción. Se
  conserva por el criterio «todo acotado por tenant + Shipping Mark» del archivo.

## Aceptación

- [x] Hallazgos 1 y 2: ninguna pantalla de facturas del Portal relee `clients.tenant_id` con el admin
  client. Las pruebas siembran un tenant legado distinto en `clients` y fallan con el código anterior.
- [x] Hallazgo 3: Academia, Reclamos y Proveedores/Compras filtran por el tenant del principal. Las
  pruebas con sesión híbrida fallan con el código anterior.
- [x] Principal inválido, incoherente o sin sesión: cero consultas de dominio y cero RPC legadas.
- [x] Para un cliente coherente las pruebas de 0543 siguen verdes sin cambios en sus aserciones; la
  de 0173 (detalle de la compra) sólo cambia de mock de identidad y gana aserciones.
- [x] Sin migración, RLS, RPC ni UI nuevas.
- [x] `pnpm verify` sobre `d40f4afd`: exit 0, 16 de 17 pasos medidos sin fallos. `migrations-applied`
  quedó en SKIP sin credenciales; no aplica, porque esta SDD no trae migración. El detalle por paso
  está en el handoff. Los commits posteriores sólo tocan esta spec, el índice y el handoff.

## Pregunta para Sam (no se cambia en esta SDD)

**Factura que junta varios embarques: ¿qué medida se sella al aceptar?**

Hoy pasa esto (SDD-0543, «limitación conocida que se decide aparte»):

- La página de aceptación y la puerta del detalle muestran los códigos de todos los embarques y la
  medida **sumada** (`medidaDeLaFactura`).
- La acción sella en la evidencia legal la medida del **primer** envío, el enlazado a la factura
  (`order.cbm` y `order.weightKg`, con `quote_code` igual a su código).
- El gate de emisión de Facturación (`evaluateLegalGate` en `app/studio/(app)/facturacion/actions.ts`)
  busca una aceptación con la medida de ese mismo envío enlazado. Por eso hoy la emisión funciona.

Consecuencia: el cliente aceptó viendo «Volumen total X m³», pero el acuse guarda la medida de un
solo embarque.

Opciones para decidir:

- **A. Dejarlo así.** La emisión sigue igual, pero el acuse no refleja lo que el cliente vio.
- **B. Sellar la suma y cambiar el gate de emisión para que compare contra la suma de los embarques
  de la factura.** Toca Portal y Studio y cambia el hash de la evidencia. Necesita su propia SDD.
  Inferencia, no medida: las aceptaciones ya selladas de facturas con varios embarques dejarían de
  coincidir con el gate nuevo y pedirían aceptar de nuevo.
- **C. Mostrar sólo la medida del primer envío.** Se descartó en la revisión de 0543 porque engaña
  al aceptar.

## Gobernanza y datos

- **Frontera Portal ↔ principal y tenant (0390/0397/0462):** cumplimiento.
- **Políticas visuales y de interacción** (VIS, FRM, BTN, A11Y): no aplica. No hay cambio de UI ni
  de copy; los mensajes de error son los existentes.
- **Datos personales (revisar-datos-ve):** no aplica. No se captura, mueve ni borra ninguna categoría
  nueva; los filtros sólo reducen lo que se lee. Los fixtures son sintéticos.
- **Producción:** no se leyó ni escribió nada. No hay migración que aplicar.

## Riesgos y límites

- Una sesión híbrida legítima (equipo de DTD y cliente Portal de otro tenant a la vez) deja de ver
  en el Portal lo del tenant de equipo. Es el comportamiento buscado: el Portal muestra el tenant del
  vínculo Portal.
- Las RPC `next_supplier_seq` y `next_order_seq` (`0105`) siguen resolviendo el tenant en SQL con
  `coalesce(get_portal_client_tenant(), get_user_tenant_id())`. Para un vínculo coherente coincide
  con el principal. No se tocan aquí (fuera de alcance, en el handoff).
