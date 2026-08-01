---
sdd: "0179"
title: "Portal — podar el código pre-Norte inalcanzable"
status: done
author: "Sam (founder) + Claude Code"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0042", "0169", "0173", "0177"]
confidencialidad: interno
---

# SDD-0179 — Podar el código pre-Norte del portal

## 1. Decisión aprobada

Borrar las ramas del portal que quedaron **inalcanzables** cuando
`NORTE_PORTAL_LIVE` pasó a `true`. Estaban anotadas como ruido en el mapa de la
Fase 7 (SDD-0169) y el founder aprobó la poda el 2026-07-29.

**817 líneas netas menos** (864 borradas · 47 agregadas).

## 2. Por qué SÍ se borra (y no es lo mismo que el formulario de compras)

El instinto correcto ante un `if (flag) { nuevo } else { viejo }` es **conservar
el `else`**: es el botón de pánico. Ayer mismo, al prender el asistente de Nueva
compra (SDD-0173), `NewPurchaseForm.tsx` **se dejó en el árbol** justamente por
eso.

Acá es distinto, y el dato que lo decide es la **fecha**:

- `NORTE_PORTAL_LIVE = true` desde el **2026-06-20** (`33798b00`) — **cinco
  semanas** en producción sin un solo apagado.
- En esas cinco semanas el camino Norte se llevó Club, Reclamos, push, tracking
  de SeaRates, reportes de pago con archivo, comprobante imprimible, historial de
  notificaciones… y el camino viejo **no recibió nada**.

O sea: apagar el flag hoy no sería un rollback, sería **degradar al cliente a una
UI vieja y peor**. El kill-switch ya no protege de nada — es peso muerto que
ensucia cada búsqueda, cada refactor y cada barrido (el de SDD-0176 tuvo que
declarar dos hallazgos "no tocados" que vivían justo acá).

**Regla que queda:** un fallback detrás de un flag se conserva mientras el flag
sea joven. Cuando lleva semanas prendido y las dos ramas divergieron, deja de ser
reversión y pasa a ser deuda.

## 3. Qué se borró

| Qué | Dónde | Líneas |
|---|---|---|
| `PortalDashboard` | `app/portal/(app)/_components/PortalDashboard.tsx` | 378 |
| `PortalTimeline` | `app/portal/_components/PortalTimeline.tsx` | 174 |
| `FallbackList` + su guard | `app/portal/(app)/envios/page.tsx` | 61 |
| detalle de envío pre-Norte + `Field`/`formatDate` | `app/portal/(app)/envios/[code]/page.tsx` | 239 |
| `SoporteHubTabs` (export huérfano) | `app/portal/_components/PortalHubTabs.tsx` | 21 |
| ternario + imports muertos | `app/portal/(app)/page.tsx` | 38 |

En los dos `page.tsx` de envíos el `if (showNortePortal(...))` desapareció: el
camino Norte pasó a ser **el único**, sin condicional.

## 4. Verificado ANTES de borrar (no asumido por la bandera)

`PortalDashboard` y `PortalTimeline` **seguían importados** — "muerto" era la
rama, no el import. Se comprobó uno por uno que:

- `showNortePortal()` devuelve `NORTE_PORTAL_LIVE || isDemoMarkbox(...)` → con el
  flag en `true` es **siempre true**, así que el `else` no se alcanza nunca;
- `PortalDocsCard`, `PortalNotificationHistory`, `StatusBadge` y `ShipmentRow`
  **siguen vivos** (los usa `PortalShipmentDetailNorte` / `PortalDashboardNorte`)
  → se quitaron sólo los *imports* del archivo podado, no los componentes;
- `PortalTimeline` no lo usa nadie más → el archivo sí se borra;
- `EnviosHubTabs` sigue vivo en Compras, Documentos y Proveedores.

## 5. 🔴 Hallazgo: `/portal/envios` se quedó sin sus tabs (preexistente)

Al podar salió a la luz que **`<EnviosHubTabs />` sólo se renderizaba dentro de
`FallbackList`** — o sea, dentro del código muerto. Consecuencia, y **desde el
20-jun, no desde esta poda**: el cliente ve la fila de tabs (Envíos · Compras ·
Documentos · Proveedores) en **tres** de las cuatro páginas del hub, y en
`/portal/envios` **no**.

No se arregló acá a propósito: agregar UI a una pantalla viva es un cambio
visual, no una poda, y mezclarlo escondería ambas cosas. Queda reportado al
founder para decidir — el arreglo es de dos líneas (`<EnviosHubTabs />` arriba
del `<PortalAlertasHub>`).

## 6. Verificación

- `node scripts/verify.mjs` en verde (incluye el paso `numbering` nuevo).
- Barrido programático de imports y funciones huérfanas en los tres archivos
  tocados → limpio (ni `tsc` ni ESLint reportan símbolos sin uso, así que el
  chequeo se hizo aparte).
- Cero cambios de comportamiento para el cliente: lo que se borró no se
  ejecutaba.

## 7. Bitácora

- **2026-07-29** — poda aprobada y aplicada. Salió del "ruido" anotado en
  SDD-0169 y de los dos hallazgos que SDD-0176 tuvo que dejar sin tocar porque
  vivían en código muerto.
