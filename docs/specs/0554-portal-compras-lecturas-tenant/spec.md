---
sdd: "0554"
title: "Portal: lecturas de compras por tenant del principal"
status: in-progress
author: "Claude Code"
created: 2026-10-18
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0057", "0361", "0381", "0549", "0552", "0553"]
confidencialidad: interno
---

# SDD-0554 — Portal: lecturas de compras por tenant del principal

> El Portal lee compras, proveedores y adjuntos con el tenant **y** el Shipping Mark del principal
> de sesión (`getPortalClientPrincipal`). Cierra el FUERA DE ALCANCE 4 de la SDD-0552.

## Contexto

Las SDD-0549, 0552 y 0553 llevaron las lecturas del Portal al principal de sesión, con filtro
explícito por su `tenant_id` además del Shipping Mark. El handoff de la 0552
(`.agents/handoffs/portal-relecturas-principal-tenant-0552.md`, FUERA DE ALCANCE 4) dejó las
lecturas de compras de `lib/studio/prealertas/queries.ts` que el Portal llama sólo con el Shipping
Mark. Las busqué por valor en `app/portal` y `lib/portal` sobre `origin/main` `77035907` y confirmé
cada una:

| Lectura | Llamadas del Portal | ¿Filtraba por tenant? |
|---|---|---|
| `listPrealertas` | `compras/page.tsx`, `compras/nueva/page.tsx`, `proveedores/page.tsx`, `envios/page.tsx` | **No** |
| `listSuppliers` | las cuatro anteriores, `compras/[code]/page.tsx` y `compras/[code]/etiquetas/page.tsx` | **No** |
| `listPrealertaDocuments` | `envios/page.tsx` y `compras/[code]/etiquetas/page.tsx` | **No** |
| `listPrealertaServiceRequests` | `compras/page.tsx`, `compras/[code]/page.tsx` y `etiquetas/page.tsx` | **Sí**, desde la SDD-0381 |
| `listPredeclaredBoxes`, `listPackingListSubmissions` | detalle y etiquetas | No aplica: van por el id de una compra ya resuelta con el tenant (SDD-0552) |
| `listActivePrealertaAddons` | nueva compra, proveedores, etiquetas y acciones | Sí, con `tenantId` del principal (SDD-0402) |
| `prealertasConPackingList` (`lib/portal`) | `envios/page.tsx`, con el **admin** | Por los ids que salen de `listPrealertas` |

`listPrealertaServiceRequests` ya resolvía el vínculo de sesión y filtraba por su tenant (SDD-0381,
`portalServiceRequestTenant`); la prueba `lib/studio/prealertas/__tests__/service-request-scope.test.ts`
«excluye mismo Shipping Mark de otro tenant» lo cubre. La 0552 la incluyó por error en su lista. No
cambia.

**Por qué importa.** El Shipping Mark es único **por tenant** (`0006`) y la policy de equipo
«tenant read» de `suppliers_cn` y `prealertas` (`0105`) y «by tenant» de `prealerta_documents`
(`0118`) son permisivas. Desde la `0417` (SDD-0361) las policies Portal de esas tablas ya exigen
tenant y Shipping Mark del vínculo; según la SDD-0361, la `0417` se aplicó en producción el
2026-09-11 (no lo comprobé aquí). El cruce que queda es el de una **sesión híbrida** (equipo del
tenant B y cliente Portal del tenant A): recibía las compras, los proveedores y los adjuntos del B
con el mismo Shipping Mark. En `envios/page.tsx`, además, los ids de esas compras iban al **admin
client** en `prealertasConPackingList`, que no tiene RLS.

## Decisión sobre la firma

Hay dos casos distintos, y cada uno tiene su respuesta:

- **`listPrealertaDocuments`: `markbox` y `tenantId` obligatorios.** Sus dos llamadores son del
  Portal y ya tienen el principal, como en `getPrealertaByCode` (SDD-0552). La base no ata el
  `tenant_id` del adjunto al de su compra (`0118`: FK sólo a `prealertas(id)`), así que el id de la
  compra no basta.
- **`listPrealertas` y `listSuppliers`: tipo discriminado `StudioPurchaseScope | PortalPurchaseScope`.**
  Tienen cinco llamadores Studio sin opciones (abajo) que dependen de la RLS de equipo. Se
  descartaron dos opciones:
  - *`tenantId` obligatorio para todos:* obligaría al Studio a resolver su tenant en cinco pantallas.
    Eso cambia el Studio y no lo pide el encargo.
  - *Una variante del Portal:* duplica consulta y paginación, y deja la función genérica aceptando
    `{ markbox }` sin tenant, que es justo el defecto.

  Con el tipo discriminado, el modo Portal (`PortalPurchaseScope = { markbox; tenantId }`) exige los
  dos juntos: pasar el Shipping Mark sin el tenant es error de tipos. El modo Studio (sin opciones)
  conserva su consulta byte por byte.
- **En tiempo de ejecución** (JS o un `as`): un ámbito Portal incompleto (falta una clave, cadena
  vacía o en blanco, o un valor que no es texto) devuelve `[]` **sin consultar**. Es el mismo
  criterio de la SDD-0381: no cae al modo Studio, que devolvería el tenant entero.

`tsc` mostró 12 llamadas en 6 archivos, todas del Portal; ninguna del Studio. Las revisé una por una.

**Llamadores del Studio, sin cambio de comportamiento:** `app/studio/(app)/etiquetas/page.tsx:93`
(`listSuppliers`), `ordenes-compra/page.tsx:36-37`, `ordenes-venta/page.tsx:36` y
`proveedores/page.tsx:56-57` (`listPrealertas` y `listSuppliers`). `tesoreria` y `financiero-china`
llaman a otro `listSuppliers`, el de `lib/studio/treasury/supplier-queries.ts`.

## Alcance

**Entra** (líneas en la punta de esta rama):

1. `lib/studio/prealertas/queries.ts`:
   - `PortalPurchaseScope` (`:113`) y `portalPurchaseScope` (`:124`);
   - `listSuppliers` (`:141`) y `listPrealertas` (`:179`): en modo Portal, `.eq("tenant_id")` y
     `.eq("client_markbox")`;
   - `listPrealertaDocuments` (`:447`): los dos filtros, siempre.
2. Las pantallas del Portal pasan el tenant del principal:
   - `compras/page.tsx:37-38`: pasa además de `getPortalClient` a `getPortalClientPrincipal`;
   - `compras/nueva/page.tsx:39-40` y `proveedores/page.tsx:35-36`;
   - `envios/page.tsx:54-55` y `:86` (adjuntos). Los ids que llegan al admin en
     `prealertasConPackingList` quedan acotados al tenant del principal;
   - `compras/[code]/page.tsx:93` y `compras/[code]/etiquetas/page.tsx:67` y `:104`.

**Columnas comprobadas** en `supabase/migrations/`: `suppliers_cn` y `prealertas` (`0105`),
`prealerta_documents` (`0118`), `packing_list_submissions` (`0147`) y `prealerta_service_requests`
(`0150`) tienen `tenant_id uuid not null` desde su migración de origen. Ninguna migración la elimina.

**No entra:** migraciones, RLS, RPC, UI y copy. Tampoco `listPrealertaServiceRequests` (ya
cumple), `prealertasConPackingList` (va por ids ya acotados) ni las acciones de
`proveedores/actions.ts`, que ya filtran por el tenant de `portalScope`.

## Contrato

- **Cliente Portal coherente:** lo que ve no cambia. Su tenant es el del vínculo, y las policies
  Portal (`0417`) ya exigen ese tenant.
- **Sesión híbrida:** Mis compras, Nueva compra, Tus proveedores, el hub de envíos, el detalle de la
  compra y sus etiquetas dejan de mostrar compras, proveedores y adjuntos del otro tenant con el mismo
  Shipping Mark. Las etiquetas ya no firman con el admin un adjunto del otro tenant colgado de la
  compra propia.
- **Studio:** sin ámbito, misma consulta (sólo `deleted_at is null`, más `status` si se pide). La
  RLS de equipo sigue decidiendo.
- **Sin principal:** las pantallas devuelven `null` antes de consultar, como antes.

## Allowlist exacta

Producto:

- `lib/studio/prealertas/queries.ts`
- `app/portal/(app)/compras/page.tsx`
- `app/portal/(app)/compras/nueva/page.tsx`
- `app/portal/(app)/proveedores/page.tsx`
- `app/portal/(app)/envios/page.tsx`
- `app/portal/(app)/compras/[code]/page.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/page.tsx`

Pruebas nuevas:

- `lib/studio/prealertas/__tests__/portal-purchase-scope.test.ts`
- `app/portal/(app)/compras/__tests__/principal-tenant.test.tsx`
- `app/portal/(app)/proveedores/__tests__/page-principal-tenant.test.tsx`
- `app/portal/(app)/envios/__tests__/compras-principal-tenant.test.tsx`
- `app/portal/(app)/compras/[code]/__tests__/compras-lecturas-tenant.test.tsx`

Prueba adaptada: `lib/portal/__tests__/portal-tenant-double.ts` gana `range(desde, hasta)`, con los
dos extremos incluidos como en PostgREST, para las lecturas paginadas con `fetchAllPaged`. No se
quitó ni relajó ninguna aserción existente.

Documentación: esta spec, `docs/specs/README.md` (índice regenerado) y
`.agents/handoffs/portal-compras-lecturas-tenant-0554.md`.

## Pruebas

El doble de la SDD-0549 aplica de verdad `eq`, `neq`, `is(col, null)`, `in`, `gte` y ahora `range`,
devuelve copias y no modela la RLS. Cada tabla siembra cuatro filas:

- la fila propia (tenant A, Shipping Mark del cliente);
- el mismo Shipping Mark en el tenant B, que es lo que corta el tenant;
- otro cliente del tenant A, que es lo que corta el Shipping Mark;
- una fila borrada.

En adjuntos y proveedores, la disposición «incoherente» cuelga de la compra de A una fila del tenant
B. La base no lo impide: la FK es sólo por id. Las lecturas de `queries.ts` son las reales en
todas las pruebas de página.

**Al revés (control rojo):** con los 7 archivos de producto de `origin/main` `77035907` y las
pruebas nuevas, caen 40 de 47. Las 7 que pasan cubren lo que no debía cambiar:

- 5 «sin principal no consulta»;
- 2 «el Studio sin ámbito conserva su consulta».

Los 40 rojos son de aserción; ninguno es un error de arranque.

**Mutantes:** se quitó un filtro, una valla o un tenant por vez: 23 mutantes, con
`mutantes-0554.mjs` en el scratchpad de la sesión. El control dio 47 de 47 antes y después:

- los filtros de tenant y de Shipping Mark de las tres lecturas (6);
- la valla de ámbito inválido de cada lectura (3);
- las cuatro condiciones de `portalPurchaseScope` (4);
- el tenant en cada llamada de las seis pantallas (10).

Mueren los 23.

## Aceptación

- [x] `listPrealertas`, `listSuppliers` y `listPrealertaDocuments` filtran por tenant y Shipping
  Mark del principal cuando las llama el Portal. Con sesión híbrida, las pruebas fallan con el código
  anterior.
- [x] Pasar el Shipping Mark sin el tenant es error de tipos; en ejecución, un ámbito Portal
  incompleto devuelve `[]` sin consultar.
- [x] El Studio sin ámbito conserva su consulta; las pruebas de sus pantallas siguen verdes.
- [x] `listPrealertaServiceRequests` comprobada: ya filtraba por tenant (SDD-0381), sin cambio.
- [x] Sin migración, RLS, RPC ni UI nuevas.
- [ ] `pnpm verify` en verde. Resultado en el handoff.

## Gobernanza y datos

- **Frontera Portal ↔ principal y tenant (0361/0381/0549/0552):** cumplimiento.
- **Políticas visuales y de interacción** (VIS, FRM, BTN, A11Y): no aplica. No hay cambio de UI ni de
  copy.
- **Datos personales (revisar-datos-ve):** no aplica. No se captura, mueve ni borra ninguna
  categoría. La lectura se acota más; los fixtures son sintéticos.
- **Producción:** no se leyó ni escribió nada. No hay migración que aplicar.

## Fuera de alcance

Se registra en el handoff de esta tarea.
