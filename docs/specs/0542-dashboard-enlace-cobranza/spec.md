---
sdd: "0542"
title: "Dashboard: los enlaces internos llevan a una pantalla que existe"
status: in-progress
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-16
updated: 2026-10-16
supersedes: null
superseded_by: null
related: ["0041", "0085", "0114"]
confidencialidad: interno
---

# SDD-0542 — Dashboard: los enlaces internos llevan a una pantalla que existe

> La alerta «N factura(s) vencida(s) · Gestionar cobranza» del Dashboard manda
> a `/studio/invoices`, que no existe: 404. El barrido encontró otros dos
> enlaces del Dashboard con el mismo defecto. Los tres pasan a su pantalla real
> y una prueba de contrato impide que vuelva a pasar.

## Contexto

El Director lo vio el 2026-10-16 en producción, con la sesión de admin de Sam:
`/studio/invoices` responde 404. En `origin/main` `6da8aebc`:

- `app/studio/(app)/dashboard/page.tsx:258` arma la alerta con
  `href: "/studio/invoices"`.
- No hay carpeta `invoices` en `app/studio/`. La facturación vive en
  `app/studio/(app)/facturacion/` y la cobranza en `app/studio/(app)/cobranzas/`.
- `next.config` no tiene redirección para esa ruta (sí las tiene para
  `/studio/kommo` y `/studio/leads`).

### Barrido de `href` del Dashboard

Todos los `href` con `/studio…` de `app/studio/(app)/dashboard/` y de las
consultas que lo alimentan, contra las carpetas con `page.tsx`:

| Enlace en `origin/main` | Texto | ¿Existe? |
|---|---|---|
| `page.tsx:258` → `/studio/invoices` | «Gestionar cobranza» | **no** |
| `DashboardWidgets.tsx:227` → `/studio/calendar` | «Calendario →» | **no** (la ruta es `calendario`) |
| `DashboardWidgets.tsx:315` → `/studio/quotes/nuevo` | «Nuevo estimado» | **no** (la ruta es `cotizador`, sin `nuevo`) |
| `/studio/tracking`, `/studio/tracking/${id}`, `/studio/tracking/nuevo`, `/studio/naviera`, `/studio/clientes`, `/studio/cn`, `/studio/nomina`, `/studio/cotizador`, `/studio/cotizador/${code}` | varios | sí |

## Decisión

### «Gestionar cobranza» → `/studio/cobranzas`

- **Es la pantalla de la acción.** Cobranzas es la cola de cuentas por cobrar:
  registra cobros con recibo y asiento, sigue promesas de pago y guarda la
  gestión. Facturación emite y lista facturas.
- **Ve las mismas facturas, con las vencidas arriba.** La cola toma las
  facturas no anuladas ni borradas con saldo (`lib/studio/payment-queries.ts:551`)
  y las ordena por vencimiento ascendente (`:541`). El KPI cuenta las que tienen
  saldo y están vencidas (`lib/studio/dashboard/dashboard-kpi-queries.ts:98`).
- **El gate no cambia quién llega.** La alerta sólo existe si se leyó el bundle
  de finanzas, que exige el módulo `invoices` (catálogo, `invoicesDue`,
  `dashboard-catalog.ts:61`). Cobranzas exige `collections`
  (`cobranzas/layout.tsx:12`). Los dos son `["accounting"]` (+admin)
  (`lib/studio/rbac.ts:115` y `:117`), y `MONEY_MODULES` (`:161`) fija que
  ambos sean exactamente eso.
- **Sin filtro en la URL.** El filtro por etapa de Cobranzas es estado del
  cliente (`CobranzasClient.tsx:84`, arranca en «all»), no un parámetro: no hay
  un filtro existente que enlazar, y crear uno queda fuera de esta tarea. El
  orden por vencimiento ya pone arriba lo que la alerta cuenta.

Descartada: `/studio/facturacion?tab=overdue`. Ese filtro existe
(`FacturacionClient.tsx:37`, `:318`) y su lista coincide con el conteo, pero
lleva a la pantalla de emitir, no a la de cobrar, y la alerta dice «Gestionar
cobranza».

### Los otros dos enlaces del Dashboard

- **«Calendario →» → `/studio/calendario`.** El widget `upcomingEta` es del
  módulo `tracking`; el calendario exige `calendar`
  (`calendario/layout.tsx:12`). Todos los roles de `tracking` están en
  `calendar` (`rbac.ts:62–63`).
- **«Nuevo estimado» → `/studio/cotizador`.** El cotizador abre el alta con un
  botón y estado local (`CotizadorClient.tsx:49`), no por la URL: el enlace
  lleva al listado, donde está «+ Nueva cotización». Abrir el alta desde la URL
  sería una función nueva.

Los tres son enlaces de navegación: siguen en la misma pestaña (LNK-01,
punto 2).

## Alcance

Sólo los tres `href` del Dashboard y su prueba. Sin cambios de datos, RBAC ni
consultas.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `app/studio/(app)/dashboard/page.tsx` | alerta de vencidas → `/studio/cobranzas` |
| `app/studio/(app)/dashboard/_components/DashboardWidgets.tsx` | «Calendario →» → `/studio/calendario`; «Nuevo estimado» → `/studio/cotizador` |
| `app/studio/(app)/dashboard/__tests__/dashboard-enlaces-existen.test.ts` | prueba de contrato nueva |
| `docs/specs/0542-dashboard-enlace-cobranza/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0542-dashboard-enlace-cobranza.md` | handoff |

## Criterios de aceptación

1. La alerta de facturas vencidas enlaza a `/studio/cobranzas`; «Calendario →»,
   a `/studio/calendario`; «Nuevo estimado», a `/studio/cotizador`.
2. La prueba de contrato lee los `href` con `/studio…` del código del Dashboard
   (`app/studio/(app)/dashboard/`, sin pruebas; `lib/studio/dashboard/`;
   `lib/studio/dashboard-queries.ts`) y falla, nombrando `archivo:línea → href`,
   si alguno no resuelve a una carpeta de `app/studio/` con `page.tsx`.
   Resuelve como el App Router: grupos y slots transparentes, carpetas privadas
   fuera, segmentos dinámicos y catch-all, sin query ni hash. Un `${…}` sólo
   casa con un segmento dinámico.
3. La prueba falla si el barrido deja de ver los enlaces conocidos (inventario
   mínimo): no puede pasar en vacío.
4. Control rojo: con el enlace viejo `/studio/invoices` en `page.tsx`, la
   prueba cae y nombra `page.tsx:260 → /studio/invoices`. Lo mismo con
   `/studio/calendar` y `/studio/quotes/nuevo`, uno por vez, y con un `${…}`
   bajo una ruta sin segmento dinámico. La prueba trae además el control con el
   texto viejo de la alerta.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec con allowlist exacta |
| LNK-01 | cumplimiento | navegación en la misma pestaña, con `<Link>` como antes |
| A11Y-01, BTN-01 | no aplica | no cambia texto, rol ni foco; sólo el destino |
| AUD-01 | no aplica | no hay escritura |

## FUERA DE ALCANCE DETECTADO

Barrido de los literales `"/studio/…"` de `app/`, `lib/`, `components/`,
`hooks/` y `proxy.ts` contra las carpetas con `page.tsx` o `route.ts`, en esta
rama:

1. **CN · `app/studio/(app)/cn/_components/NewReceiptDrawer.tsx:178` y `:186`**
   → `/studio/cn/${code}`. No hay `cn/[…]/page.tsx`: el «Abrir recibo» del
   aviso y la opción de registrar y abrir llevan a 404. Elegir el destino
   (¿`/studio/cn?q=${code}`, que el listado ya lee?) es decisión del módulo.
2. **Mis bugs · `app/studio/(app)/mis-bugs/page.tsx:109`**
   → `/studio/mis-bugs/${bug.id}`. No hay `mis-bugs/[id]/page.tsx` desde la
   SDD-0036: tocar una tarjeta lleva a 404.
3. **Acciones rápidas del Dashboard sin gate.** El widget `quickActions` es
   `module: null` (`dashboard-catalog.ts:92`), pero sus destinos sí tienen gate:
   p. ej. `accounting` ve «Recepción CN» y `cn` no lo incluye (`rbac.ts:67`).
   No es 404; es un enlace a una pantalla que ese rol no puede ver.
4. **Comentario vencido en `proxy.ts:130`.** Nombra `/studio/reset/confirmar`
   como puerta de entrada; la ruta `app/studio/(auth)/reset/confirmar/route.ts`
   se retiró en `d793c01d` y `isStudioEntryPoint` ya sólo acepta
   `/studio/login`. Sólo el comentario.

La prueba de esta SDD cubre el Dashboard; extenderla a todo el Studio
encontraría hoy los puntos 1 y 2.

## Validación

Ver el handoff `.agents/handoffs/0542-dashboard-enlace-cobranza.md`.
