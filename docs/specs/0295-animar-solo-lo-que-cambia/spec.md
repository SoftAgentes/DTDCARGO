---
sdd: "0295"
title: "`transition: all` deja de existir — cada sitio anima solo lo que cambia"
status: in-progress
author: "founder"
created: 2026-08-25
updated: 2026-08-25
supersedes: null
superseded_by: null
related: ["0294"]
confidencialidad: interno
---

# DTD-0295 — Animar solo lo que cambia

> Cierra el hallazgo #3 de la Fase B del rediseño ERP
> (`docs/design/studio/erp-faseb-pendientes.md`, 2026-07-10) — y lo cierra en
> las **cuatro** superficies, no solo en el Studio.

## El hallazgo se había cerrado y volvió

La Fase B (10-jul-2026) listó **3** sitios con `transition: all`:

| Sitio de la Fase B | Estado hoy (medido 2026-08-25) |
|---|---|
| `academia/_components/AcademiaClient.tsx:873` | ✅ ya corregido a lista explícita |
| `academia/diplomas/_components/DiplomasClient.tsx:369` | ✅ ya corregido |
| `marketing/noticias-web/_components/Step2Outlines.tsx:123` | ✅ ya es `transition-colors` |

Los tres se cerraron en algún momento entre julio y hoy. **Y hoy había 17.**
Ninguno de los 17 es uno de los 3 originales: son sitios nuevos, escritos
después. El hallazgo no es una deuda que se paga una vez — es una que **vuelve
a nacer** cada vez que alguien escribe un componente con estados.

Por eso esta spec no solo corrige: deja constancia de la regla en un lugar donde
se lee antes de escribir (ver *Lo que NO trae*).

## El inventario real

Barrido multilínea sobre `app/`, `components/` y `lib/` (`.ts`, `.tsx`, `.css`).
Un primer barrido devolvió **13** porque la expresión regular se cortaba en la
coma de `var(--dur, 180ms)`; el segundo, que busca el valor entrecomillado
completo, devolvió **17** (más un falso positivo: el nombre de un test,
`"all devuelve todo"`).

**9 en objetos de estilo** (Studio + móvil) · **8 en clases Tailwind**
(sitio público).

## Qué anima cada sitio ahora

La lista de cada uno **no se copió de una plantilla**: se leyó el componente y
se anotó qué propiedades cambian de verdad entre sus estados.

### Studio ERP

| Archivo | Propiedades que cambian | Antes |
|---|---|---|
| `admin/rutas/…/CityPicker.tsx` | `border-color`, `color`, `opacity`, `box-shadow` | `all 160ms` |
| `admin/rutas/…/RouteDrawer.tsx` (riel del switch) | `background-color`, `border-color` | `all 160ms` |
| `bugs/…/BugsAdminClient.tsx` (tab) | `background-color`, `color`, `box-shadow` | `all var(--dur)` |
| `mailing/…/MailingClient.tsx` (tab) | `background-color`, `color`, `box-shadow` | `all var(--dur)` |
| `mailing/…/TemplateEditorDrawer.tsx` (tab) | `background-color`, `color` | `all var(--dur)` |
| `_components/bug-reporter/BugReportModal.tsx` (chip) | `border-color`, `background-color`, `color` | `all var(--dur)` |
| `_components/deploy/DeployWebBot.tsx` (tarjeta) | `border-color`, `background-color` | `all 120ms` |

### Móvil PWA

`m/erp/…/MobileErpClient.tsx` y `m/erp/bitacora/…/HoyClient.tsx` — las dos
pastillas de filtro: `background-color`, `color`, `box-shadow`.

### Sitio público (Tailwind)

| Archivo | Queda |
|---|---|
| `registro/RegisterForm.tsx` ×2 | `transition-[opacity,transform]` |
| `components/EstimacionForm.tsx` | `transition-[opacity,transform]` |
| `components/CalculadoraForm.tsx` (perilla) | `transition-[left]` |
| `components/ServicesGrid.tsx` | `transition-[transform,background-color,border-color]` |
| `components/servicios/OfertaWizard.tsx` | `transition-[transform,border-color,box-shadow]` |
| `components/UltimoKmCalculator.tsx` | `transition-colors` |
| `components/YiwuAdvantage.tsx` (tooltip) | `transition-[opacity,visibility]` |

La forma de valor arbitrario no se inventó acá: `transition-[box-shadow,border-color]`
ya vivía en
[`ToolCard.tsx:24`](../../../app/interno/_components/ToolCard.tsx) y en
[`Nav.tsx:218`](../../../components/Nav.tsx).

## Las tres decisiones que cambian algo visible

Quitar `all` **no es neutro**. En tres sitios el cambio se ve, y en los tres se
eligió a propósito.

### 1 · El peso de la fuente ahora salta (5 sitios)

Las pastillas de tab pasan de `font-weight: 500` a `600` al activarse. Con
`all`, ese peso **se interpolaba durante 180 ms** — y como el texto en negrita
es más ancho, la pastilla entera se reacomodaba mientras duraba la animación.
Es exactamente el reflow que hace que `transition: all` sea un problema de
rendimiento y no una preferencia de estilo.

Ahora el peso cambia de golpe y solo animan color, fondo y sombra. **Es la
mejora, no un efecto colateral.**

### 2 · El grosor del borde ahora salta (1 sitio)

`DeployWebBot` pasa de `1px solid` a `2px solid` al seleccionar. Animar el
grosor corría 1 px el contenido de adentro durante toda la transición. El
desplazamiento de 1 px ocurre igual —lo pide el diseño—, pero ahora ocurre de
una vez en vez de arrastrarse 120 ms.

### 3 · 🔴 `visibility` se queda en la lista a propósito

El tooltip de `YiwuAdvantage` combina `opacity-0` con `invisible`. Si se
hubiera dejado solo `opacity`, al **salir** el mouse la propiedad `visibility`
volvería a `hidden` de inmediato y el tooltip desaparecería de golpe, comiéndose
el fundido de salida de 200 ms. `visibility` en la lista es lo que hace que el
navegador la mantenga en `visible` hasta que termina el fundido.

Este es el sitio donde "quitar `all` y listar lo obvio" habría roto algo sin dar
ningún error.

## Lo que se dejó a propósito

- **La perilla del switch sigue animando `left`**, no `transform`. Pasarla a
  `translateX` sería el arreglo de rendimiento de verdad, pero es reescribir el
  posicionamiento de un control sin poder verlo en pantalla en esta sesión.
  `RouteDrawer` ya animaba `left` explícitamente desde antes: `transition-[left]`
  deja las dos perillas del repo diciendo lo mismo. Queda anotado como mejora.
- **Los HTML de `docs/`** (Norte, brand book, mockups de Cloud Design) tienen
  `transition: all` en decenas de lugares. No son código del repo: son material
  de diseño recibido. Tocarlos rompería la comparación contra el Norte.
- **`app/admin/cbm-estudio/content.html`** — HTML embebido de un estudio, mismo
  criterio.

## ⚠️ Escribir un nombre de clase de ejemplo en un .md lo mete al CSS

Tailwind v4 en este repo **no tiene config ni `@source`**, así que escanea el
proyecto entero — `docs/` y `.claude/` incluidos. Un borrador de esta misma
spec decía `transition-` + corchetes con `a,b` adentro como ejemplo genérico, y
el build emitió una regla `transition-property:a,b` de verdad en el bundle.

Por eso los ejemplos de acá usan **clases que ya existen en el código**: nombrarlas
no agrega nada al CSS. Un nombre inventado, sí.

El mismo escaneo explica por qué el bundle todavía trae `transition-property:all`
aunque el código ya no lo use: sale de la prosa de `.claude/skills/…` y
`.claude/agents/…`, que hablan de `transition-all` para prohibirlo. **Acotar las
fuentes de Tailwind es una tarea aparte** — hacerlo mal borra clases en silencio,
que es justo lo que esta spec vino a evitar.

## Lo que NO trae, y por qué

**No trae una regla de ESLint.** Se evaluó, porque el hallazgo demostró que
vuelve. Pero una regla que prohíba `transition: all` no puede distinguir el caso
legítimo del ilegítimo, y las dos formas del repo (objeto de estilo y clase
Tailwind) necesitarían dos reglas distintas — una de ellas sobre el contenido de
un `className`, que es una cadena de texto. El costo de los falsos positivos es
mayor que el del barrido periódico. Si vuelve a crecer, se reevalúa con el dato
de cuánto creció.

## Verificación — lo que se midió

1. **Barrido multilínea posterior al cambio:** 0 sitios en `app/`, `components/`
   y `lib/`.
2. **El CSS existe de verdad.** Un valor arbitrario que Tailwind no reconoce **no
   da error**: no emite la regla y la animación deja de existir en silencio. Se
   buscaron las reglas en el CSS compilado y las cinco están:

   ```
   transition-property: opacity,transform                        ✅
   transition-property: left                                     ✅
   transition-property: transform,background-color,border-color  ✅
   transition-property: transform,border-color,box-shadow        ✅
   transition-property: opacity,visibility                       ✅
   ```

   Más la lista fija de `transition-colors` para `UltimoKmCalculator`.
3. **Gate completo:** `node scripts/verify.mjs` → 15/15 pasos, exit 0.

## Lo que esta spec NO puede afirmar

Ningún sitio se abrió en un navegador. Las tres decisiones de arriba están
razonadas sobre cómo el navegador trata cada propiedad, y la generación del CSS
sí se mide — pero **que las 17 transiciones se vean bien es lo único que sigue
sin verificarse en pantalla**.
