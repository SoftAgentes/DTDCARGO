---
sdd: "0176"
title: "Portal — el ámbar deja de usarse como texto (barrido AA)"
status: done
author: "Sam (founder) + Claude Code"
created: 2026-07-29
updated: 2026-07-29
supersedes: null
superseded_by: null
related: ["0098", "0138", "0169", "0173", "0177"]
confidencialidad: interno
---

# SDD-0176 — El ámbar deja de usarse como texto en el portal

## 1. Decisión aprobada

Barrer `--color-status-warning` usado como **color de texto** en el portal.
BRAND §♿ ya lo prohíbe ("un color de marca que no alcanza el ratio sobre su
fondo real no se usa como texto") y dos componentes del repo ya lo habían
resuelto a mano — `ProfilePendingBanner` y `CedulaPhotoRow`, cada uno con su
comentario explicando el mismo hallazgo. Esta spec convierte ese parche
repetido en un barrido.

## 2. El problema, medido

Medido en el navegador con `getComputedStyle` + fórmula WCAG, **en los dos
temas**:

| Par | Claro | Oscuro |
|---|---|---|
| ámbar sobre card | **3.14** ❌ | 6.41 ✅ |
| ámbar sobre paper | **3.01** ❌ | 7.89 ✅ |
| ámbar sobre su propio tinte 8% | **2.91** ❌ | 5.65 ✅ |
| ámbar sobre su propio tinte 14% | **2.74** ❌ | 5.08 ✅ |

**El bug es SOLO del tema claro.** Es el espejo exacto del hallazgo de SDD-0173
(los tokens con nombre de color que voltean y rompen en oscuro): acá el tema
oscuro salva al ámbar porque sube a `#d3a24a` sobre navy, y el claro lo hunde.
Verificar un solo tema no alcanza — nunca alcanzó.

**Y no era solo el ámbar.** El patrón de badge "texto del tono sobre tinte del
tono" también hunde al verde: `success` sobre su tinte 8% mide **3.93** en
claro. El barrido arregla el patrón, no un color.

## 3. Alcance — 8 arreglos

El criterio es siempre el mismo, y es el que BRAND ya prescribe: **el color se
queda en el punto, el ícono, el borde y el fondo; el texto pasa a `--color-ink`
o `--color-grey-700`.** No se inventa ningún token nuevo.

| # | Dónde | Qué era | Ahora |
|---|---|---|---|
| 1 | `PrealertaStatusBadge` | texto del tono sobre tinte 8% | texto `--color-ink` |
| 2 | `PrealertaServiceBadge` | ídem | texto `--color-ink` |
| 3 | `ReferralStatusBadge` (`referidos/page.tsx`) | ídem, tinte 10% | texto `--color-ink` |
| 4 | `ProfileIncompleteCard` | eyebrow 11px en ámbar | `text-grey-700` |
| 5 | `PendingAcceptanceCard` | eyebrow 11px en ámbar | `text-grey-700` |
| 6 | `ServiceSection` · chip "Pedida tarde" | texto ámbar sobre tinte 10% | texto `--color-ink` |
| 7 | `ServiceSection` · aviso "ya llegó a la bodega" | texto ámbar sobre tinte 8% | texto `--color-ink` |
| 8 | `PortalTopbar` · `SailingPill` | los días en ámbar sobre tinte 12% | texto `--color-ink` |

Después del cambio, medido: **15.25 / 11.54** (tinte 8%), **14.95 / 11.14**
(10%), **14.09 / 13.44** (12%) y **12.63 / 7.33** (grey-700 sobre card).

Ninguno de los ocho pierde la señal de estado: en los tres badges el color
sigue en el punto, el borde y el fondo; en las dos cards sigue en el borde
izquierdo; en los dos avisos de `ServiceSection` sigue en el fondo; en la
píldora del topbar sigue en el ícono, el borde y el fondo. **Nada quedó
distinguido sólo por color** (WCAG 1.4.1).

## 4. Lo que se revisó y NO se tocó (con el motivo)

- **KPIs de saldo** (`facturas/page.tsx`, `finanzas/page.tsx`,
  `PortalDashboardNorte` › `SaldoCard`): el ámbar es el valor a **26px Archivo
  Black** → texto grande, umbral 3:1, mide 3.14. **Pasa.**
- **`PortalAlertasHub`**: ya tiñe sólo íconos y fondos; su comentario lo dice.
- **`PortalTopbar` › `ProfilePill`**: ya usaba `--color-ink`.
- **`PortalVerifyGate`**: el aro y el candado cargan el color; el número del
  paso ya iba en ink.
- **`PortalSidebar`** › candado de módulo bloqueado: es un **ícono** con
  `opacity .72` → 3.80 en claro, sobre el umbral de no-texto (3:1), y además
  lleva texto `sr-only`. Pasa.
- **`ProfilePendingBanner`, `CedulaPhotoRow`**: ya estaban arreglados; de ahí
  salió el patrón.
- **`PortalDashboard.tsx`** (líneas 164 y 346): **código muerto**. Es parte de
  las ~600 líneas inalcanzables tras `NORTE_PORTAL_LIVE=true` (SDD-0169). No se
  toca acá: borrarlo es su propio trabajo y mezclarlo escondería este barrido.

**Anotado, no arreglado:** los íconos de tono sobre tinte 16-18% de
`ComprasList` y `NorteKpi` miden ~2.7 en claro, bajo el umbral de no-texto.
Son decorativos y redundantes (al lado va siempre el rótulo o el badge con el
mismo estado en texto), así que quedan exentos — pero si algún día el ícono es
la única señal, hay que subir el tinte.

## 5. Verificación

- `node scripts/verify.mjs` en verde.
- Contraste **medido** con `getComputedStyle` + WCAG en los dos temas, antes y
  después de cada cambio (tabla de §2 y §3).
- Cero cambios de estructura: sólo la propiedad `color`. Ningún test cambia de
  expectativa.

## 6. Bitácora

- **2026-07-29** — barrido completo en una sola pasada. El disparador fue el
  hallazgo de SDD-0173 sobre los tokens que voltean: al medir el otro lado del
  espejo (tema claro) apareció esta familia entera. Se midió cada par en vez de
  mirarlo, que es la única razón por la que se vio que el problema también
  alcanzaba al verde de `success` y no sólo al ámbar.
