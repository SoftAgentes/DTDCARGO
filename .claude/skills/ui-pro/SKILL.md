---
name: ui-pro
description: "Auditoría profunda de diseño UI/UX en 10 dimensiones (contraste WCAG medido contra la matriz verificada de tokens, jerarquía, tipografía, spacing por densidad, estados, heurísticas Nielsen/Krug/Norman, accesibilidad WCAG 2.2 AA, motion, AI slop, copy) con score 0–10 y hallazgos archivo:línea. Advisory read-only por default; --fix aplica correcciones con tokens del sistema; --live audita píxeles con Playwright MCP. Úsalo cuando el usuario pida 'auditoría de diseño profunda', 'revisa la UI a fondo', 'audita accesibilidad y contraste', 'qué tan pro se ve esta pantalla', o ejecute /ui-pro. NO confundir con /ui-check (check liviano pre-commit del diff)."
---

# UI-Pro — Auditoría profunda de diseño

> *"El herrero mide dos veces: con el ojo y con la regla."*

## Propósito

Un solo comando (`/ui-pro`) que audita una superficie de DTD Cargo con ojo de
design director Y regla de medir. Reutiliza piezas que ya existen; **NO duplica
su lógica**:

- **`BRAND.md`** (raíz del repo) — fuente de verdad de marca: tokens, fuentes,
  AI slop, tono, formato `BRAND-CHECK`. Este skill lo **cita y aplica**, no lo copia.
- **Norte vigente** — `docs/design/studio/_norte/` (la versión vive al tope de
  `HANDOFF.md` en `## 🟢 Estado actual · vX.Y`; detectala en vivo, nunca la
  hardcodees). `_norte/` es **read-only** — viene de Cloud Design vía NORTE-SYNC.
- **`references/` propias** — matriz de contraste verificada, heurísticas,
  tipografía, AI slop, mapa de superficies. Se cargan **solo cuando su dimensión
  lo requiere** (progressive disclosure).
- **Agente `design-critic`** (`.claude/agents/design-critic.md`) — comparte
  rúbrica; /ui-pro corre inline, pero en modo full puedes delegarle el gut-check
  de resonancia emocional vía Task si el contexto lo amerita.

## Cuándo activarse

- Usuario ejecuta `/ui-pro` (full / `--live` / `--fix` / una dimensión).
- Usuario pide: "auditoría de diseño profunda", "revisa la UI a fondo",
  "audita accesibilidad y contraste", "¿qué tan pro se ve esta pantalla?".
- **NO** activarse para el check liviano pre-commit del diff — eso es `/ui-check`.

## Paso 0 — Brief: superficie y calibración (obligatorio, antes de juzgar)

1. **Resuelve el alcance.** Si hay argumento (ruta/glob), úsalo. Si no, toma los
   archivos UI del diff:
   ```
   git diff --name-only main...HEAD -- '*.tsx' '*.css' 'app/**' 'components/**'
   git status --short -- '*.tsx' '*.css'
   ```
   Si no hay archivos UI → responde "Sin superficie que auditar" y termina.
2. **Detecta la superficie.** Carga `references/contexto-superficies.md` y
   clasifica cada archivo (Público / Studio / Portal / Móvil / Back). Eso fija:
   sistema tipográfico, término MARKBOX vs "Shipping Mark", perfil de densidad,
   **archivo de tokens y si hay escala de tokens (`--s-*`, `--ease`) o no** (el
   público usa Tailwind + px de `globals.css`, no `--s-*`), y temas a verificar.
   Si el alcance mezcla superficies, audita cada una por separado.
3. **Detecta la versión del Norte EN VIVO** leyendo el tope de
   `docs/design/studio/_norte/HANDOFF.md`. Nunca asumas ni escribas la versión en duro.
4. **Carga los guardrails:** `BRAND.md` completo. Las reglas duras de marca viven
   ahí — acá solo se aplican.
5. Anota el brief en una línea: `superficie · densidad esperada · tema(s) light/dark · escala (tokens --s-* / Tailwind)`.

## Las 10 dimensiones

Cada dimensión tiene checks pass/fail. Un check sin evidencia observable en el
alcance = **no aplicable** (no penaliza). Score de dimensión =
`round(checks_pass / checks_aplicables × 10)`. Una dimensión con 0 checks
aplicables es **N/A** y se excluye del score global (ver Scoring).

### 1 · 🔆 Legibilidad & contraste (⭐ siempre primero)

Carga `references/contraste-tokens.md` SOLO al correr esta dimensión.

**Auto-verificación de drift (antes de confiar en la matriz):** lee los hexes
vigentes de `app/studio/tokens.css`, `docs/design/studio/_norte/erp/tokens.css` y
`app/globals.css`, y confirma que coinciden con la tabla de la reference. Si algún
token cambió, re-computa ese par con el snippet y reporta el drift — la marca
deriva con el tiempo; no midas contra hexes viejos.

| # | Check pass/fail |
|---|---|
| 1.1 | Todo par texto/fondo alcanza AA en el tema donde se renderiza: normal ≥4.5:1 · grande (≥24px, o ≥18.66px **negrita**) ≥3:1. Busca el par en la matriz (ya validada por el auto-check de arriba); si no está, compútalo con el snippet de la reference |
| 1.2 | Paridad light/dark: el par pasa en AMBOS temas si la superficie tiene dark — no asumir herencia |
| 1.3 | `--ink-mute` no aparece como texto legible ni como placeholder informativo (`rg -n "ink-mute" <alcance>`) — es decorativo/disabled en los dos temas |
| 1.4 | En dark, `--wine` no es color de TEXTO (2.79:1) — es relleno; el acento de texto en dark es `--wine-soft` |
| 1.5 | En dark, texto sobre relleno semántico = `--ink-inv`, nunca blanco (white/success dark = 1.93) |
| 1.6 | Semánticos light (`--success`, `--warning`, `--wine-soft`) no van como texto chico; sobre `--warning` el texto es `--ink`, nunca blanco |
| 1.7 | No-solo-color (WCAG 1.4.1, nivel A): estados/links/errores llevan icono, texto o subrayado además del color |
| 1.8 | Texto sobre imagen/gradiente → scrim/overlay oscuro; nunca texto directo sobre foto |
| 1.9 | Indicadores no-texto (focus ring, borde que identifica un input, iconos informativos) ≥3:1 (WCAG 1.4.11; sin redondeo: 2.999 falla) |

### 2 · 👁️ Jerarquía visual

| # | Check |
|---|---|
| 2.1 | Squint/grayscale test: lo más importante domina sin depender del color |
| 2.2 | UN solo CTA primario por vista |
| 2.3 | Entre niveles se varían 1–2 palancas (size/weight/color), nunca las 3 a la vez |
| 2.4 | Labels secundarios discretos, data protagonista (en el ERP el dato pesa más que su label) |
| 2.5 | Nunca weight <400 en body |

### 3 · 🔤 Tipografía & lectura

Carga `references/tipografia.md`.

| # | Check |
|---|---|
| 3.1 | Measure 45–75ch en prosa (`max-width: 65ch`) |
| 3.2 | Body ≥16px en superficies de lectura (público/portal); el ERP a 14px base es diseño del Norte, NO falla |
| 3.3 | Interlineado: body 1.5–1.75 · títulos 1.0–1.25 |
| 3.4 | Familias correctas por superficie (split del Paso 0); wordmark SIEMPRE Archivo Black vía `<BrandMark>` |
| 3.5 | JetBrains Mono en códigos + `tabular-nums` en números comparables (KPIs, columnas) |

### 4 · 📐 Spacing & layout (surface-aware)

| # | Check |
|---|---|
| 4.1 | Escala 4px **según la superficie del Paso 0**: · **Studio/Portal/Móvil** = solo `var(--s-*)`, cero px arbitrarios (`rg -n "(padding\|margin\|gap):\s*[0-9]+px" <alcance>`, y filtra los que ya son múltiplo exacto vía token). · **Público** = utilidades Tailwind `p-`/`gap-`/`m-` (grid de 4px) **y** los px crudos de `app/globals.css` son convención existente — `globals.css` NO define `--s-*`, así que NO marques esos px como violación (p. ej. `padding: 0 22px`, `0.625rem` son legítimos) |
| 4.2 | Densidad calibrada por superficie: tabla ERP compacta correcta ≠ "apretada" · hero público con aire ≠ "vacío" |
| 4.3 | Espacio ENTRE grupos > espacio DENTRO de grupos |
| 4.4 | Left-align por default; centrado solo headlines cortos, heros y empty states |
| 4.5 | Forms 300–500px de ancho; el layout aguanta contenido corto, promedio y larguísimo (nombres reales del ERP) |

### 5 · 🔁 Estados & edge cases

| # | Check |
|---|---|
| 5.1 | Interactivos con los 6 estados: default · hover · focus (visible) · active · disabled · loading |
| 5.2 | Datos con los 5 estados: empty (con CTA) · sparse · dense · error · success, al mismo cuidado que el happy path |
| 5.3 | Loading anti-flicker: show-delay ~150–300ms + mínimo visible ~300–500ms; el botón en loading conserva su label |
| 5.4 | Skeletons espejan el contenido final exactamente (cero layout shift); imágenes con dimensiones explícitas |
| 5.5 | Toda pantalla ofrece próximo paso o ruta de recuperación (cero dead-ends); disabled explica por qué |
| 5.6 | Pre-flight: sin Lorem/placeholder genérico ni `TODO: brand-review` sin resolver en pantallas vivas |

### 6 · 🧭 Heurísticas de usabilidad

Carga `references/heuristicas.md`.

| # | Check |
|---|---|
| 6.1 | Nielsen 1–10 sobre el flujo principal del alcance (red flags por heurística en la reference) |
| 6.2 | Krug: no me hagas pensar · clicks obvios > pocos clicks · elimina la mitad de las palabras |
| 6.3 | Trunk test (6 preguntas) en la vista principal |
| 6.4 | Norman: sin golfo de ejecución (test de 10 segundos) ni golfo de evaluación (todo estado del sistema es visible) |

### 7 · ♿ Accesibilidad WCAG 2.2 AA

| # | Check |
|---|---|
| 7.1 | Targets ≥24×24px (SC 2.5.8 AA, con excepción de spacing en tablas densas); en `app/m/` y portal móvil, regla de casa 44px |
| 7.2 | Todo input con `<label>` clickeable; errores junto al campo + focus al primer error al enviar; `aria-describedby`/`aria-invalid`; permitir enviar incompleto para que aflore la validación |
| 7.3 | Nunca bloquear paste; `autocomplete`/`inputmode`/`type` correctos; inputs ≥16px en móvil (evita auto-zoom iOS); nunca deshabilitar zoom |
| 7.4 | Teclado completo: navegación con `<a>`/`<Link>` (jamás div con onClick); sin `tabindex>0`; `:focus-visible` siempre (`rg -n "outline-none|outline:\s*none"` → falla si no hay reemplazo) |
| 7.5 | Drawers/modales (patrón `DrawerShell`): focus trap + focus inicial adentro + restaurar focus al trigger al cerrar + Escape cierra + `overscroll-behavior: contain` |
| 7.6 | Nativo antes que aria; decorativos con `aria-hidden`; `aria-live="polite"` en toasts/validación; un toast nunca es el único canal de info crítica |
| 7.7 | Headings sin saltos de nivel; reflow a 320px (tablas de datos con su propio `overflow-x: auto` están EXENTAS del 2D — WCAG 1.4.10); zoom 200% sin pérdida (1.4.4) |
| 7.8 | 2.4.11: sticky headers/toolbars no tapan el foco por completo · 3.3.7: no re-pedir datos ya ingresados en el mismo proceso · NO auditar 4.1.1 (eliminado en WCAG 2.2) |
| 7.9 | `prefers-reduced-motion` respetado (SC 2.3.3 es AAA — se exige como regla de casa, cítalo así) |

### 8 · 🫰 Microinteracciones & motion (surface-aware en 8.6)

| # | Check |
|---|---|
| 8.1 | Feedback ≤100ms a toda acción; duración de interacción ≤200ms; ease-out en entradas |
| 8.2 | Solo `transform`/`opacity` animados (GPU); nunca `transition: all`; `transform-origin` donde físicamente nace el movimiento |
| 8.3 | Anima el elemento mismo (el botón), no un toast aparte; feedback proporcional — el menos notorio que aún comunica |
| 8.4 | Progreso honesto: determinista si se conoce, spinner indeterminado si no; NUNCA progreso falso; escalera 0.1s / 1s (cursor) / 10s (progreso) / >10s (porcentaje) |
| 8.5 | Nada hover-only (touch existe); animaciones cancelables por input; sin autoplay; loops pausados fuera de viewport |
| 8.6 | Easings/duraciones del sistema **según superficie (Paso 0)**: · **Studio/Portal/Móvil** usan `var(--ease)` y `var(--dur-fast/--dur/--dur-slow)` de los tokens. · **Público** (`app/globals.css`) NO define esos tokens — ahí exige coherencia (ease-out en entradas, ≤200ms) sin buscar `--ease`/`--dur` inexistentes. Nunca inventar curvas ad-hoc por componente |

### 9 · 🧨 AI slop & craft

Carga `references/ai-slop.md` y corre sus greps.

| # | Check |
|---|---|
| 9.1 | Cero patrones de la lista determinista (greps 1–15 de la reference) |
| 9.2 | Craft: radio hijo ≤ radio padre (concéntricos); sombras del sistema; sobre navy, bordes/sombras/texto tintados hacia el hue |
| 9.3 | Componentes del sistema primero (`app/studio/_components/ui/` en Studio) antes de inventar |
| 9.4 | Microtipografía cuidada; el `…` en acciones que cargan/abren otro paso es opcional — las CTAs de crear/editar del Studio van SIN ellipsis por convención de la casa |

### 10 · ✍️ Copy & tono

| # | Check |
|---|---|
| 10.1 | Tuteo VE, cero voseo: `rg -n "\b(mirá|hacé|podés|tenés|querés|sabés|cotizá|pagás|escribinos|ingresá|usá|hacelo|usalo|dale)\b" <alcance>` (excluir docs históricos y citas de terceros) |
| 10.2 | Término correcto por superficie: MARKBOX (público) · "Shipping Mark" (portal/studio/móvil); `markbox` crudo jamás visible al usuario |
| 10.3 | DDP = "Pagas al llegar" (la palabra "prepago" SOLO en T&C); sin la palabra "responsabilidad" → "hasta dónde llega el servicio" |
| 10.4 | CTAs con verbo directo ("Cotizar DDP", "Crear embarque"); nunca "Click acá"/"Submit" |
| 10.5 | Sin "¡Genial!"/emoji de éxito; sin anglicismos innecesarios; errores útiles sin `error.message` crudo |

## Scoring y severidad

- **Score de dimensión** = `round(checks_pass / checks_aplicables × 10)`.
- **Score global** = promedio **ponderado de SOLO las dimensiones evaluadas**
  (las que tienen ≥1 check aplicable):
  `score = round( Σ(peso · score_dim) / Σ(peso) )`, con **peso 2 para D1**
  (contraste) y **peso 1** para el resto. Una dimensión sin checks aplicables
  (**N/A**) se EXCLUYE del numerador Y del denominador — nunca cuenta como 0 ni
  como 10, ni fuerza el divisor a 11. Ej.: si en modo full aplican D1..D9 y D10
  queda N/A, el divisor es `2 + 1·8 = 10`. La D1 pesa doble porque el contraste
  roto castiga a usuarios reales. En modo una-dimensión, solo se reporta el score
  de esa dimensión.
- **Severidad por hallazgo** = frecuencia × impacto × persistencia → 4 niveles:
  `[catastrófico]` `[mayor]` `[menor]` `[cosmético]` (tabla de cómputo en
  `references/heuristicas.md`).
- **Regla de bloqueo advisory:** cualquier violación de las reglas duras de
  `BRAND.md` → emitir `BRAND-CHECK` (formato de BRAND.md) y el veredicto no puede
  ser mejor que "revisar antes". Sigue siendo advisory: el founder decide.
- **Veredicto:** 9–10 = OK · 6–8 = OK con ajustes · ≤5 = revisar antes.

## Modos

- **Default:** advisory, read-only. No edites nada.
- **`--fix`:** única excepción al read-only. SOLO correcciones **mecánicas, seguras
  y reversibles 1:1** dentro del sistema:
  - hex → su token equivalente EXACTO.
  - px que **ya es múltiplo exacto** de la escala → su `--s-*` equivalente 1:1
    (16px→`var(--s-4)`, 8px→`var(--s-2)`). **Cualquier px que NO calce exacto en la
    escala se REPORTA como hallazgo, nunca se reescribe** — redondear al vecino
    (17px→16px, 22px→24px) cambia la intención de spacing y puede romper layout, y
    en el público los px fuera de la escala del ERP son legítimos.
  - fuente prohibida → la del sistema de esa superficie.
  - término mal usado (MARKBOX↔Shipping Mark) → el correcto por superficie.
  - voseo → tuteo: **se PROPONE el reemplazo en el reporte, no se reescribe copy a
    ciegas** (una conjugación puede cambiar la estructura de la frase).
  NUNCA con `--fix`: cambiar valores de tokens, tocar `docs/design/studio/_norte/`,
  rediseñar layout ni "mejorar" jerarquía. Cada fix se lista en el reporte con
  `archivo:línea — antes → después`. Sin commit: eso lo decide el founder.
- **`--live [url]`:** usa Playwright MCP (`browser_navigate`,
  `browser_take_screenshot`, `browser_evaluate` con `getComputedStyle`) para medir
  contraste sobre píxeles renderizados, verificar estados hover/focus reales y
  correr el squint test sobre el screenshot en grises. Complementa el análisis
  estático, no lo reemplaza. Si Playwright MCP no está disponible: avisa
  "modo --live omitido (Playwright MCP no disponible)" y sigue en estático —
  nunca falles por su ausencia.
- **Una dimensión:** corre solo esa dimensión inline, con su reference.

## Formato de salida

Produce exactamente este template:

```
🔬 UI-PRO · <superficie> · <alcance>
Score: N/10 (D1 contraste: n · D2 jerarquía: n · … solo las evaluadas; N/A las no aplicables)
Hallazgos (N):
1 ⭐ [mayor] archivo:línea — qué + regla citada (dimensión o SC WCAG) + fix dentro del sistema
2   [menor] archivo:línea — …
✅ Lo que está bien: …
Veredicto: OK · OK con ajustes · revisar antes (advisory, no bloqueante)
```

- Si hubo violación dura de marca, el bloque `BRAND-CHECK` va ANTES del reporte.
- Si corrió `--fix`, agrega: `🔧 Fixes aplicados (N): archivo:línea — antes → después`.

## Instrucciones al auditor

1. **Mide antes de juzgar** — corre cada grep y cada cómputo de contraste real;
   nunca inventes hallazgos, ratios ni métricas.
2. **Reusa, no dupliques** — las reglas de marca viven en `BRAND.md`; cítalas por
   referencia ("BRAND.md 🚫"), no las copies.
3. **No penalices lo no observable** — check sin evidencia en el alcance = no aplicable.
4. **Surface-aware** — aplica la regla del ERP al ERP y la del público al público;
   no marques px de Tailwind/`globals.css` ni busques `--s-*`/`--ease` en el sitio público.
5. **Un hallazgo, una dimensión** (anti-doble-conteo); si aplica a dos, va en la
   de mayor severidad.
6. **Read-only salvo `--fix` explícito**; jamás edites `docs/design/studio/_norte/`.
7. **Todo hallazgo con `archivo:línea`** y fix DENTRO del sistema (tokens y
   componentes existentes).
8. **La versión del Norte se detecta en vivo** (`_norte/HANDOFF.md`); nunca la
   escribas en duro. **Español tuteo VE, terse, #1 con ⭐.**

## Relacionado

- `/ui-check` — el mismo ojo pero liviano, sobre el diff pre-commit.
- `.claude/agents/design-critic.md` — agente de crítica de diseño (gut-check de design director); comparte rúbrica.
- `/radar` — drift de config y de versión del Norte (no audita UI).
- `/temple` — auditoría full-project de seguridad/datos/perf/web (no diseño).
- `BRAND.md` — fuente de verdad de marca; este skill la aplica, no la reemplaza.
