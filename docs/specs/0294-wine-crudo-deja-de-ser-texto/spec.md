---
sdd: "0294"
title: "El vino crudo deja de usarse como texto — y la prioridad estaba invertida"
status: in-progress
author: "founder"
created: 2026-08-25
updated: 2026-08-25
supersedes: null
superseded_by: null
related: ["0176"]
confidencialidad: interno
---

# DTD-0294 — `--wine` deja de ser texto

> Cierra el hallazgo sistémico #1 de la Fase B del rediseño ERP
> (`docs/design/studio/erp-faseb-pendientes.md`, 2026-07-10).

## El hallazgo original y lo que quedaba

Fase B midió que `color: var(--wine)` **como texto** da **2,79:1 en tema
oscuro** — falla AA. La corrección de raíz era el token `--wine-text`, que Cloud
Design entregó y que hoy tiene **601 usos**. Pero quedaban **48 sin migrar**.

## 🔴 La prioridad estaba invertida

El reparto de esos 48 parecía decir una cosa y decía otra:

| Superficie | Usos | ¿Falla hoy? |
|---|---|---|
| `app/m/` — PWAs del operario | 43 (13 archivos) | **No** |
| Studio — `PortalBackfillSection` | 5 | **Sí** |

**Las PWAs del operario no fallaban**, y eso hay que medirlo antes de "arreglarlo":
`app/m/layout.tsx` envuelve todo en `data-theme="light"` **fijo**, y el tema
oscuro de `tokens.css` entra **sólo** por `[data-theme="dark"]` — nunca por
`prefers-color-scheme`. En claro los dos tokens son **el mismo hex**
(`#7F0F1A`), así que ahí `--wine` como texto era idéntico a `--wine-text`.

El que sí fallaba era el único del Studio, que es donde el tema oscuro existe de
verdad: 5 usos en `PortalBackfillSection`, resolviendo a `#A8323E` (2,79:1) en
oscuro.

## Alcance

Los **48 usos migrados**, en 14 archivos. Los 5 del Studio porque fallan hoy;
los 43 de `app/m/` porque el cambio es **visualmente nulo** (mismo hex en claro)
y desactiva una mina: el día que alguien encienda tema oscuro en las PWAs, los 43
habrían fallado de golpe.

### Lo que NO se tocó

- **Los 11 `background: var(--wine)`** de `app/m/`. El propio token lo dice:
  *"Fill de botones sigue en `--wine`"*. El fallo es del vino como TINTA, no como
  relleno.
- **`inspecciones/_components/report-css.ts`** (3 usos): es CSS de impresión, y
  Fase B ya lo excluyó a propósito — el documento que recibe el cliente no
  responde al tema de la app.

## Verificación

Grep posterior: **0** ocurrencias de `color: "var(--wine)"` en `app/`. Los 11
fills siguen en pie. Lint y typecheck limpios.

⚠️ **No se midió el contraste renderizado**, ni antes ni después: se razonó
sobre los valores de los tokens y sobre qué tema aplica cada superficie. La
medición con `getComputedStyle` sigue pendiente, como en el resto del carril.

## Adjuntos

Ninguno.
