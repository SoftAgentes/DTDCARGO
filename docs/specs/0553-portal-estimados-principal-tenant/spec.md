---
sdd: "0553"
title: "Portal: avanzar estimado a cotización por principal y tenant"
status: in-progress
author: "Claude Code"
created: 2026-10-18
updated: 2026-10-18
supersedes: null
superseded_by: null
related: ["0061", "0380", "0549", "0552"]
confidencialidad: interno
---

# SDD-0553 — Portal: avanzar estimado a cotización por principal y tenant

> «Avanzar a cotización» resuelve al cliente con `getPortalClientPrincipal` y lee y actualiza el
> estimado con el admin filtrando por el `tenant_id` y el Shipping Mark del principal. Cierra el
> hallazgo FUERA DE ALCANCE 3 de la SDD-0552.

## Contexto

`advanceEstimateToCotizacionAction` (`app/portal/(app)/estimados/actions.ts`) toma un estimado web
del cliente (`quotes.source='web'`) y lo pasa a la pista formal (`source='studio'`). En `origin/main`
`a6b06205`:

- `:63-71` leía el estimado con el **admin** filtrando por `quote_code` y `client_markbox`;
- `:96-102` lo actualizaba con el admin por `id`, `client_markbox` y `source='web'`;
- `:107` avisaba al asesor del `q.tenant_id` de la fila leída.

Ninguno filtraba por `tenant_id`. El Shipping Mark es único **por tenant** (`0006`) y el código
también (`unique (tenant_id, quote_code)` en `0007`; la serie `EST-AAAA-NNNN` de `next_estimate_code`
se repite entre tenants). El admin no tiene RLS, así que no hacía falta una sesión híbrida: bastaba un
cliente Portal de otro tenant con el mismo Shipping Mark.

- **Código sólo en el otro tenant:** el cliente avanzaba el estimado ajeno y se avisaba al asesor
  del otro tenant.
- **Código en los dos tenants:** `maybeSingle` recibía dos filas y fallaba; el cliente legítimo veía
  «No pudimos avanzar tu estimado. Intenta de nuevo.». Lo medí con el doble (control rojo), no en
  producción.

La identidad ya salía de la sesión (`getPortalClient`, que desde la SDD-0552 es
`getPortalClientPrincipal(...)?.client`), pero se descartaba el tenant del principal.

**Columnas comprobadas** en `supabase/migrations/`: `quotes.tenant_id uuid not null` desde `0007`;
ninguna migración la elimina ni la renombra. La policy Portal de `quotes` es sólo SELECT
(`0117`, reescrita en `0428`); no hay policy Portal de UPDATE, así que el admin es necesario para
escribir.

## Decisión

- **El admin se conserva** para la lectura y el UPDATE, con el filtro de tenant. La lectura podría
  ir con la sesión y su RLS, pero una sesión híbrida vería igual las filas de su tenant de equipo por
  la policy permisiva «quotes by tenant»: el filtro explícito sigue siendo el corte. Leer y escribir
  con el mismo cliente evita además que la lectura y el UPDATE vean conjuntos distintos.
- **El tenant sale del principal**, no de la fila: el aviso al asesor usa `principal.tenantId`. Con
  el filtro, coincide con el de la fila.
- **El UPDATE también filtra por tenant.** Va por `id`, que es PK global: con datos reales el tenant
  del UPDATE no cambia la fila tocada. Es la segunda valla, por si la lectura cambia algún día, como
  en el resto del Portal. Su prueba lo exige sobre los filtros de la operación.

## Alcance

**Entra:** `app/portal/(app)/estimados/actions.ts`, sólo `advanceEstimateToCotizacionAction`:

1. `getPortalClientPrincipal` en vez de `getPortalClient`; se toman `client` y `tenantId`.
2. La lectura de `quotes` filtra por `tenant_id`, `quote_code`, `client_markbox` y `deleted_at is null`.
3. El UPDATE filtra por `id`, `tenant_id`, `client_markbox` y `source='web'`.
4. `notifyCotizacionRequestToAdmin` recibe `tenantId` del principal. `tenant_id` sale del `select`.

**Revisado sin cambio:**

- `app/portal/(app)/estimados/page.tsx` usa `listMyEstimates` (`lib/portal/portal-queries.ts`), que
  ya resuelve el vínculo de la sesión (`portalQuoteScope`) y filtra por tenant y Shipping Mark
  (SDD-0380, policy `0428`). La prueba `lib/portal/__tests__/portal-quote-scope.test.ts` ya siembra
  cotizaciones y envíos de otro tenant. Cumplimiento.
- Búsqueda por valor de `quotes`, `quote_code`, `next_estimate_code` y `next_quote_code` en
  `app/portal` y `lib/portal`: `cotizaciones/actions.ts` (alta con el tenant del principal desde la
  SDD-0552) y `portal-queries.ts` (la lista de arriba). Los `quote_code` de
  `facturas/[code]/aceptar/actions.ts` y `lib/portal/portal-legal-queries.ts` son de
  `legal_acceptances` y ya filtran por tenant. No hay otro uso del mismo tipo.

**No entra:** migraciones, RLS, RPC, UI y copy. Studio (`app/studio/(app)/cotizador`,
`lib/studio/quote-queries.ts`): sesión de equipo con RLS por tenant, otro dominio.

## Contrato

- Un cliente Portal **coherente** que avanza su propio estimado no nota diferencia: la fila es de su
  tenant, y el gate de sesión es el mismo (`getPortalClient` ya era el principal).
- Diferencias con el otro tenant con el mismo Shipping Mark:
  - código sólo en el otro tenant: «No encontramos ese estimado en tu cuenta.»; no se toca ni se
    avisa;
  - código en los dos tenants: avanza el propio y deja intacto el ajeno (antes, error);
  - el propio ya formal y el ajeno web con el mismo código: redirige a Cotizaciones sin tocar el
    ajeno (antes, error).
- Sin principal válido (sin sesión, vínculo con cliente de otro tenant, cliente borrado): «Tu sesión
  expiró…» sin construir el admin client, como antes.

## Allowlist exacta

- Producto: `app/portal/(app)/estimados/actions.ts`.
- Prueba nueva: `app/portal/(app)/estimados/__tests__/principal-tenant.test.ts`.
- Documentación: esta spec, `docs/specs/README.md` (índice regenerado) y
  `.agents/handoffs/portal-estimados-principal-tenant-0553.md`.

## Pruebas

`app/portal/(app)/estimados/__tests__/principal-tenant.test.ts` (9 pruebas). El admin es el doble
`lib/portal/__tests__/portal-tenant-double.ts` (SDD-0549), que aplica de verdad `eq` e `is` en
lecturas y UPDATE y no modela la RLS. El principal **no se simula**: lo resuelve
`getPortalClientPrincipal` real contra el doble de sesión, con el vínculo Portal activo del cliente A.
El tenant B tiene un estimado web con el mismo Shipping Mark y, según el caso, el mismo código.

**Al revés (control rojo):** con `actions.ts` de `a6b06205` caen 4 de 9, por la razón esperada: dos
filas en `maybeSingle` (casos 1 y 3), el estimado de B avanzado (caso 2) y la lectura sin tenant
(caso 4). Las 5 que pasan cubren lo que no debía cambiar: otro cliente del mismo tenant, el admin que
no lee `clients` ni `client_users`, y los tres casos sin principal.

**Mutantes** (uno por vez, control verde 9 de 9 antes y después): lectura sin tenant, UPDATE sin
tenant, lectura y UPDATE con el tenant forjado en el formulario y aviso al tenant del formulario.
Mueren los 5. «UPDATE sin tenant» sólo lo mata la aserción sobre los filtros de la operación, porque
el `id` es PK global (ver Decisión). Dos controles de filtros que ya existían (Shipping Mark en la
lectura y en el UPDATE) también mueren.

## Aceptación

- [x] La lectura y el UPDATE de `quotes` filtran por el `tenant_id` y el Shipping Mark del principal.
- [x] La identidad y el tenant salen de la sesión; el admin no lee `clients` ni `client_users`.
- [x] El aviso al asesor va al tenant del principal.
- [x] Con el estimado del otro tenant con el mismo Shipping Mark, las pruebas fallan con el código de
  `a6b06205` y pasan con el nuevo.
- [x] Mutantes de los filtros nuevos: 5 de 5 mueren.
- [x] Sin migración, RLS, RPC ni UI nuevas.
- [x] `pnpm verify` sin fallos en lo medido: exit 0 sobre `5dc38d63`, 16 de 17 pasos. El que falta,
  `migrations-applied`, quedó NO DISPONIBLE (sin credenciales; esta SDD no trae migración). Detalle
  en el handoff.

## Gobernanza y datos

- **Frontera Portal ↔ principal y tenant (0380/0549/0552):** cumplimiento.
- **Políticas visuales y de interacción** (VIS, FRM, BTN, A11Y): no aplica. Sin cambio de UI ni de
  copy: los mensajes son los existentes.
- **Datos personales (revisar-datos-ve):** no aplica. No se captura, mueve ni borra ninguna categoría.
  Los fixtures son sintéticos.
- **Producción:** no se leyó ni escribió nada. No hay migración que aplicar.

## Fuera de alcance (anotado, sin cambio aquí)

Los hallazgos ajenos se registran en el handoff de esta tarea.
