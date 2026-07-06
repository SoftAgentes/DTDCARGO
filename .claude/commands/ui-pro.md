# /ui-pro — Auditoría profunda de diseño UI/UX (10 dimensiones, score 0–10)

> *"La pieza no está lista cuando brilla: está lista cuando se mide."*

Auditoría de diseño **profesional y profunda** de una superficie del producto:
contraste WCAG medido contra la matriz verificada de tokens, jerarquía visual,
tipografía, spacing calibrado por densidad, estados, heurísticas de usabilidad,
accesibilidad, motion, AI slop y copy. **Advisory, no bloqueante** — señala, no traba.

A diferencia de `/ui-check` (check liviano pre-commit sobre el diff), `/ui-pro`
audita la superficie completa con método: primero detecta QUÉ superficie es
(split de marca + perfil de densidad), corre checks pass/fail por dimensión y
entrega un score 0–10 con hallazgos `archivo:línea`.

## Dimensiones

| # | Dimensión | Qué cubre |
|---|-----------|-----------|
| 1 | 🔆 Legibilidad & contraste ⭐ | Pares texto/fondo vs matriz verificada, AMBOS temas, no-solo-color |
| 2 | 👁️ Jerarquía visual | Squint/grayscale test, 1 CTA primario, palancas size/weight/color |
| 3 | 🔤 Tipografía & lectura | Measure 45–75ch, interlineado, familias correctas por superficie |
| 4 | 📐 Spacing & layout | Escala 4px (`--s-*` en ERP; Tailwind en público), densidad, left-align |
| 5 | 🔁 Estados & edge cases | hover/focus/disabled/loading + empty/sparse/dense/error/success |
| 6 | 🧭 Heurísticas de usabilidad | Nielsen 10 + Krug + Trunk test + golfos de Norman |
| 7 | ♿ Accesibilidad WCAG 2.2 AA | Targets, labels, teclado, focus, aria, reflow, zoom 200% |
| 8 | 🫰 Microinteracciones & motion | Feedback ≤100ms, duración ≤200ms, GPU props, no hover-only |
| 9 | 🧨 AI slop & craft | Lista determinista grep-able + detalles de terminación |
| 10 | ✍️ Copy & tono | Tuteo VE, "Pagas al llegar", MARKBOX/Shipping Mark, CTAs directos |

## Modos de invocación

| Modo | Sintaxis | Qué hace |
|------|----------|----------|
| Full (default) | `/ui-pro [ruta\|glob]` | Las 10 dimensiones sobre esa ruta; vacío = archivos UI del diff vs main |
| Live | `/ui-pro --live [url]` | Además navega la URL con Playwright MCP: contraste sobre píxeles renderizados, estados reales |
| Fix | `/ui-pro --fix [ruta]` | Audita Y aplica solo correcciones seguras con tokens válidos del sistema |
| Una dimensión | `/ui-pro contraste` · `jerarquia` · `tipografia` · `spacing` · `estados` · `heuristicas` · `a11y` · `motion` · `slop` · `copy` | Solo esa dimensión |

Los modos se combinan: `/ui-pro contraste --live http://localhost:3000/portal`.

## Ejecución

Lee y ejecuta `.claude/skills/ui-pro/SKILL.md`.

## Ejemplo

```
/ui-pro app/studio/(app)/reclamos
/ui-pro --live http://localhost:3000/estimacion
/ui-pro contraste app/portal
/ui-pro --fix components/
```
