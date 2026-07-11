# Pedido a Cloud Design — Token de acento-texto temático · 2026-07-10

> Para el proyecto de branding/Norte en Cloud Design. Es un **agregado de token** (no cambia ningún valor existente). Registralo como `BD-NNN` con fuente = auditoría `/ui-pro` 2026-07-10.

## El problema (medido)

`var(--wine)` se usa como **color de TEXTO** en el ERP: el **Shipping Mark de cada fila**, saldos, la tab activa, valores de KPI, links. En **light** funciona (≈10:1). En **dark FALLA WCAG AA** en todos los fondos:

| `--wine` dark (#A8323E) como texto sobre… | Ratio | |
|---|---|---|
| `--bg-base` #0B1428 | 2.79:1 | ❌ |
| `--bg-surface` #16264A | 2.26:1 | ❌ |
| `--bg-elevated` #1F3055 | 1.98:1 | ❌ |

**La raíz:** ningún token es correcto como texto en **ambos** temas.
- `--wine` → perfecto en light (10.58), falla en dark.
- `--wine-soft` → perfecto en dark (7.93), en light solo pasa como texto **grande** (3.44).

No se arregla módulo por módulo: se necesita **un token que voltee de valor por tema**.

## La solución: token nuevo `--wine-text`

Acento wine usado **como texto**, con valor por tema (reusa hexes que ya existen):
- **light:** `#7F0F1A` (= el `--wine` actual)
- **dark:** `#D89AA4` (= el `--wine-soft` dark actual)

Verificado **AA body (≥4.5:1) en todos los fondos, ambos temas**:

| `--wine-text` sobre… | Ratio | |
|---|---|---|
| **light** bg-base / surface / elevated | 10.13 / 10.58 / 9.29 | ✅ |
| **dark** bg-base / surface / elevated | 7.93 / 6.44 / 5.63 | ✅ |

## Qué NO cambia (importante)

- **`--wine` como RELLENO** (botones/CTAs con texto blanco encima) → **intacto**, ya funciona en ambos temas.
- **`--wine-soft` decorativo** (acento/borde/hover sobre oscuro) → **intacto**.
- **`--wine` como texto en light** sigue siendo válido, pero se **prefiere** `--wine-text` para que herede el fix dark automáticamente.
- Ningún valor existente se toca. **Solo se agrega el token nuevo.**

## Dónde ponerlo

1. `colors_and_type.css`: en `:root` → `--wine-text: #7F0F1A;` y en `[data-theme="dark"]` → `--wine-text: #D89AA4;`
2. Norte `erp/tokens.css` (mismo par).
3. Comentario de rol: `/* wine como TEXTO (acento legible). NO usar --wine crudo como texto: falla AA en dark (2.79:1). Fill de botones sigue en --wine. */`
4. En la sección ♿ del Brand Book / CLAUDE.md: agregar la regla "acento de texto = `--wine-text` (temático); `--wine` es fill, no texto".

## Migración (lado repo — la hago yo después del sync)

Cuando el token baje al repo (`app/studio/tokens.css` vía NORTE-SYNC), migro `color: var(--wine)` → `var(--wine-text)` **solo donde wine es texto** (no en fills): Shipping Mark de filas, saldos, tabs activas, KpiCard values, links. ~8 sitios confirmados en facturación, replicado en todo el ERP.

## Naming

Propongo **`--wine-text`** (claro y auto-explicativo). Alternativas si calzan mejor con tu convención: `--wine-ink` (paralelo a `--ink`) o `--accent-text`. Elegí uno y lo uso tal cual en el repo.

---

# Segundo token pedido — `--on-warning` (texto sobre relleno warning) · 2026-07-10 (Fase C)

> Mismo espíritu: **agregado de token**, no cambia valores. Registralo como otro `BD-NNN`, fuente = auditoría `/ui-pro` del shell del ERP (Fase C).

## El problema (medido)

El **badge de alerta de gastos** del sidebar (`StudioSidebar.tsx`) es un relleno sólido `background: var(--warning)` con el conteo encima en `color: var(--ink)`. Pasa en light pero **falla en dark**:

| Texto sobre `--warning` fill | light (#B8893A) | dark (#DCAB6B) | |
|---|---|---|---|
| `--ink` (light #0F1E3D / dark #F2F0EC) | 5.24:1 ✅ | **~1.7:1** ❌ | el problema |
| `--ink-inv` (light #FBFAF7 / dark #0F1E3D) | 3.14:1 ⚠️ | 7.92:1 ✅ | tampoco sirve en ambos |

**La raíz (idéntica a `--wine-text`):** el texto correcto sobre el gold del warning es **navy #0F1E3D en AMBOS temas**, pero ningún token global es navy en ambos — `--ink` es navy solo en light, `--ink-inv` es navy solo en dark. El patrón "blanco sobre relleno" NO se hereda a dark.

## La solución: token nuevo `--on-warning`

Color de texto/icono a poner **sobre relleno `--warning` sólido**, navy en ambos temas:
- **light:** `#0F1E3D` · sobre `--warning` #B8893A = **5.24:1** ✅
- **dark:** `#0F1E3D` · sobre `--warning` #DCAB6B = **7.92:1** ✅

(Mismo hex en ambos temas — el fill cambia, el texto no. Si preferís un par `--on-warning` / `--on-danger` / `--on-success` completo para todos los rellenos sólidos, mejor aún; hoy el único caso vivo es warning.)

## Migración (lado repo — la hago yo después del sync)

Cuando baje: en `StudioSidebar.tsx` el badge de gastos → `color: var(--on-warning)`. Si aparecen más rellenos warning sólidos con texto, mismo cambio.

---

*Fuente: `--wine-text` de auditoría `/ui-pro` sobre `facturacion` (2026-07-10, D1.4); `--on-warning` de auditoría `/ui-pro` del shell (sidebar/topbar) en Fase C — hallazgo D1.2 (paridad light/dark). Mismo patrón que el focus-ring dark ya sincronizado el 2026-07-06.*
