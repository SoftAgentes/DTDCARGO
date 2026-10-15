---
sdd: "0520"
title: "Operarios: columnas ajustables y botones compactos"
status: done
author: "Sam (founder) + Claude Opus 5.5 (Worker)"
created: 2026-10-14
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0028", "0513", "0515"]
confidencialidad: interno
---

# SDD-0520 — Operarios: columnas ajustables y botones compactos

> En `/studio/operarios` el nombre de cada operario se vuelve a leer: la columna
> «Operario» tiene un piso legible y, si la tabla no cabe, hace scroll
> horizontal en vez de aplastarla. Los botones de la fila pasan al tamaño
> compacto `xs`. Cada columna se ajusta arrastrando el borde del encabezado o
> con el teclado, y el ancho queda guardado en el navegador. La primitiva es
> reutilizable; en esta tarea sólo la adopta Operarios.

## Contexto

Pedido de Sam (2026-10-14), literal:

> «Que yo pueda cambiar el tamaño de las columnas para poder organizarlo. Mira
> que no se ve qué usuario es. Entonces, hazme un poco más pequeños los botones
> de la derecha y también dame la opción de poder mover las columnas un poquito
> para ajustarles el tamaño.»

En su captura el nombre salía cortado («L…», «W.», «Y…», con la segunda línea
«E…») y «Ver PIN» y «Restablecer PIN» ocupaban mucho.

Diagnóstico del Director, comprobado en el código: en
`app/studio/(app)/operarios/_components/OperariosClient.tsx` la grilla era
`const GRID_COLUMNS = "1fr 130px 130px 160px 90px 290px"`, compartida por el
encabezado y las filas. Las cinco columnas fijas más 5 gaps de 12 px y 2 × 20 px
de padding suman 900 px; la única flexible era «Operario» (`1fr`) y, con el
contenido del Studio en una ventana de 1280 px (968 px útiles: sidebar
`--sb-expanded` 248 px + padding 2 × 32 px), le quedaban unos 68 px: el avatar
y nada más.

## Alcance

Sólo UI del Studio. Sin base de datos, migraciones, server actions, RPC ni
lógica de PIN; «Ver PIN», «Restablecer PIN», «Reactivar» y el lápiz hacen lo
mismo que antes.

1. **El nombre se ve.** «Operario» absorbe el espacio libre como antes, pero
   con piso de 260 px; el nombre y «Entra por …» llevan `title` con el texto
   completo; si la suma de columnas no cabe, el contenedor hace scroll
   horizontal.
2. **Botones compactos.** «Ver PIN», «Restablecer PIN» y el lápiz usan
   `studio-btn-xs` (existente en `app/studio/studio.css`); la columna
   «Acciones» baja de 290 px a 232 px. Textos y `aria-label` sin cambios; el
   lápiz suma `title="Editar"` (BTN-01 §7: icono con tooltip).
3. **Columnas ajustables.** Primitiva `useColumnWidths` + `ColumnResizeHandle`
   en `app/studio/_components/ui/columns/ColumnResize.tsx`, con la lógica pura
   en `column-widths.ts`. Operarios es el único consumidor.

## Criterios de aceptación

| # | Criterio | Cómo se verifica |
|---|---|---|
| A1 | Con los defaults el template es `minmax(260px, 1fr) 88px 104px 96px 64px 232px` y la tabla pide 944 px: cabe sin scroll en 968 px útiles | `OperariosClient.test.tsx` «Operario absorbe el espacio libre…»; Chromium: a 1000 px útiles «Operario» mide 314 px y no hay scroll |
| A2 | A 900, 700 y 343 px útiles «Operario» queda en 260 px y el contenedor hace scroll horizontal; el nombre no se aplasta | Chromium (arnés): `scrollWidth` 944 contra `clientWidth` 898/698/341; ningún nombre ni «Entra por …» cortado en la muestra |
| A3 | El nombre completo (con el chino) y «Entra por …» están en `title` | test «el nombre completo (con el chino)…» |
| A4 | Cada columna ajustable tiene un asa `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`/`min`/`max`, `aria-label` «Ajustar ancho de …» y `tabindex="0"`; «Acciones» no tiene asa | test «cada columna ajustable tiene su asa…» |
| A5 | ArrowLeft/ArrowRight cambian el ancho en 16 px; Home y End llevan al mínimo y al máximo; nunca se pasan; otra tecla no hace nada | tests de «asas por teclado» |
| A6 | Encabezado y filas comparten un solo template en todo momento | `sharedTemplate()` compara el encabezado con cada fila en cada aserción; mutante M5 |
| A7 | Arrastrar con puntero captura el puntero, ajusta en vivo y guarda sólo al soltar; respeta mínimo y máximo; otro puntero o un botón que no es el principal no ajusta | tests de «arrastre con puntero»; Chromium: arrastre que sale del asa sigue ajustando |
| A8 | Ajustar «Operario» la deja exacta (el espacio libre pasa a «Acciones») y el ajuste arranca desde el ancho que se ve, no desde el piso | test «la primera flecha sobre Operario arranca desde el ancho que se ve»; Chromium: −40 px desde 366 → 326 |
| A9 | Doble clic en el asa restablece esa columna; «Restablecer columnas» aparece sólo cuando hay algo que restablecer y vuelve todo al default | tests de «restablecer» |
| A10 | Se guarda en `localStorage` bajo `dtd-operarios-col-widths-v1` sólo lo que el usuario fijó; lo corrupto, fuera de rango, desconocido o de una columna fija se ignora y se limpia | tests de «lo guardado» y `column-widths.test.ts` |
| A11 | Si el almacenamiento lanza en lectura o escritura, la tabla queda con los defaults y se puede ajustar en memoria | test «si el almacenamiento lanza…» |
| A12 | El render del servidor no lee `localStorage` y sale con los defaults | test con `renderToString` y espía sobre `Storage.prototype.getItem`; Chromium: cero errores de consola al recargar con anchos guardados |
| A13 | Los botones de cada fila son `studio-btn studio-btn-ghost studio-btn-xs`, `type="button"`, con «Ver PIN de …», «Restablecer PIN de …» y «Editar» | test «botones de la fila» |
| A14 | Las pruebas existentes de `app/studio/(app)/operarios/**` siguen verdes sin tocarlas | corrida focalizada |

## Diseño

### Estado: sólo lo que el usuario fijó

`ColumnWidths` guarda los anchos que el usuario fijó; una columna sin entrada
usa su default. Así, si mañana cambia un default, quien nunca tocó esa columna
lo recibe, y «fijada» no se confunde con «tiene el valor del default» (con una
comparación por valor, fijar «Operario» exactamente en su piso la habría
devuelto a crecer).

### Una sola columna crece

La primera columna `grow` sin fijar toma `minmax(<ancho>px, 1fr)`. Con los
defaults es «Operario»: igual que antes, en pantallas anchas el nombre se lleva
el espacio libre, pero ya no baja de 260 px. Si el usuario la fija, queda
exacta y el espacio libre pasa a «Acciones», que va al final, no se ajusta (su
asa quedaría en el borde de la tabla) y deja los botones pegados a la derecha.
Nunca crecen dos a la vez.

Se descartó «todas exactas y crece Acciones desde el inicio»: en pantallas
anchas abría un hueco de 300 px entre «Activo» y los botones mientras el nombre
seguía en su ancho fijo.

### Ajustar la columna que crece

Mientras «Operario» crece, lo que se ve es más que su piso. El asa mide la
celda (`getBoundingClientRect`) al empezar el arrastre o la primera flecha, y
ajusta desde ahí; sin medida (0), usa el piso. `aria-valuetext` dice
«Automático, ocupa el espacio libre; mínimo 260 px» mientras crece y
«<n> px» cuando está fijada.

### Persistencia

`localStorage`, clave `dtd-operarios-col-widths-v1`, formato `{ "<key>": px }`
sólo con lo fijado; sin nada fijado, la clave se borra. Lectura después del
montaje en un `queueMicrotask` cancelable, el mismo patrón que `useColumnConfig`
y que vigila `browser-preference-hydration-contract.test.ts`. Escritura en
try/catch; durante un arrastre no se escribe en cada movimiento, sólo al
soltar. Lo leído que no sirve se ignora (no se recorta: un valor fuera de rango
no lo escribió esta versión de la tabla) y, si el contenido cambió al
normalizarlo, se reescribe limpio.

### Asa

`role="separator"` enfocable (patrón «window splitter» del APG): flechas con
paso de 16 px, Home/End, doble clic restablece. Pointer events con
`setPointerCapture` (mismo patrón que el ancho del sidebar en
`StudioSidebar.tsx`), `touch-action: none`. Se centra en el gap de 12 px con un
área de 16 px de ancho y el alto completo del encabezado. Estilos en
`.studio-col-resize` (`studio.css`): línea de 1 px `--border-strong` en reposo
(divisor decorativo) y 2 px `--wine-text` en hover, foco y arrastre; foco con
`outline` 2 px `--wine-text` hacia adentro para que el `overflow` no lo
recorte; transición anulada con `prefers-reduced-motion`.

### «Restablecer columnas»

Botón `studio-btn-ghost studio-btn-xs` junto al conteo, visible sólo cuando hay
anchos fijados (BTN-01 §6: un deshabilitado sin explicación no ayuda; aquí la
acción no existe hasta que hay algo que restablecer).

## Medidas (Chromium real, tipografía del repositorio)

Medido el 2026-10-14 con un arnés que empaqueta el `OperariosClient` real
(server actions sustituidas por stubs) con `tokens.css`, `studio.css` y las
fuentes de `lib/font-files/` (Nunito Sans, Sora, JetBrains Mono), en el
Chromium de Playwright del repositorio. Se midió también con la mono del
sistema porque el Studio no carga JetBrains Mono (ver FUERA DE ALCANCE): se
toma el peor de los dos.

| Peor caso | JetBrains Mono | Mono del sistema | Columna: default / mínimo |
|---|---|---|---|
| «Entra por dtdcargo.com/m/cn/login» (11,5 px) | 209,8 px | 196,5 px | Operario: 260 / 260 (36 avatar + 12 gap + 209,8) |
| Encabezado «WAREHOUSE» (9,5 px, +0,08 em) | 69,6 px | — | Warehouse: 88 / 72 |
| Código «GZ-CANTON-01» (12 px mono) | 86,4 px | 79,2 px | (cabe en 88; más largo se corta con `title`) |
| Badge «Bodeguero» (sm) | 84,9 px | — | Rol: 104 / 88 |
| «28 sept. 2026», la más larga de las fechas es-VE del año (12 px) · encabezado «ÚLTIMO LOGIN» | 75,9 px · 76,3 px | — | Último login: 96 / 80 |
| Encabezado «ACTIVO» · interruptor | 40,5 px · 38 px | — | Activo: 64 / 48 |
| «Ver PIN» + «Restablecer PIN» + lápiz en xs, con 2 gaps de 6 | 66,1 + 110,3 + 35 + 12 = 223,4 px; alto 27 px | — | Acciones: 232 fija |

Altura de fila: 60–61 px. Los máximos (640, 240, 200, 200, 120) sólo acotan.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `app/studio/_components/ui/columns/column-widths.ts` | nuevo · lógica pura: rango, lectura y escritura de lo guardado, reset, teclado, template |
| `app/studio/_components/ui/columns/column-widths.test.ts` | nuevo · pruebas unitarias del módulo puro |
| `app/studio/_components/ui/columns/ColumnResize.tsx` | nuevo · `useColumnWidths` + `ColumnResizeHandle` |
| `app/studio/(app)/operarios/_components/OperariosClient.tsx` | adopta la primitiva; piso, scroll, `title`, botones xs, «Restablecer columnas» |
| `app/studio/(app)/operarios/_components/OperariosClient.test.tsx` | pruebas de componente nuevas; las dos de SDD-0515 quedan intactas |
| `app/studio/studio.css` | clase `.studio-col-resize` (el asa necesita `:hover`, `:focus-visible` y `::before`, que no se escriben inline) |
| `app/studio/_components/__tests__/browser-preference-hydration-contract.test.ts` | suma `ColumnResize.tsx` al inventario de consumidores de `localStorage` con lectura diferida: el hook es uno nuevo y el inventario dejaría de estar completo |
| `app/studio/CLAUDE.md` | sección «Ancho ajustable» bajo «Columnas configurables»: es donde el Studio documenta sus primitivas de tabla, y sin ella la siguiente tabla no la encuentra |
| `docs/specs/0520-operarios-columnas-ajustables/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0520-operarios-columnas-ajustables.md` | handoff |

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| A11Y-01 punto 1 (teclado) | cumplimiento | flechas, Home y End sobre el asa; test A5 |
| A11Y-01 punto 2 y 3 (foco visible, 3:1) | cumplimiento | `outline` 2 px `--wine-text` (claro #7F0F1A, oscuro #D89AA4) sobre `--bg-elevated`; capturas en claro y oscuro en el handoff |
| A11Y-01 punto 4 (nombre accesible) | cumplimiento | «Ajustar ancho de …» y valor; botones con sus `aria-label` de siempre |
| A11Y-01 punto 6 (zoom 200 % / reflow) | cumplimiento | scroll horizontal del contenedor a 700 y 343 px útiles, sin texto aplastado |
| A11Y-01 punto 7 (movimiento reducido) | cumplimiento | `prefers-reduced-motion` anula la transición de la línea |
| A11Y-01 punto 8 (alternativa a drag) | **no conformidad parcial** | hay alternativa de teclado; no hay alternativa de puntero sin arrastre (WCAG 2.5.7). Se propone en FUERA DE ALCANCE |
| A11Y-01 punto 10 (tablas) | no conformidad preexistente, fuera de alcance | la tabla sigue siendo una grilla de `div` sin roles de tabla, como antes |
| A11Y-01 objetivos táctiles / BTN-01 §7 | excepción por densidad, pedida por Sam | botones xs de 27 px de alto: cumplen el mínimo WCAG de 24 × 24, no el estándar interno de 32 × 32. El control equivalente es el mismo botón por teclado. El lápiz suma `title` (tooltip) |
| BTN-01 §2 y §6 | cumplimiento | acciones de fila en ghost; «Restablecer columnas» ghost xs, visible sólo cuando aplica |
| TBL-01 (columnas, móvil) | cumplimiento para el ancho | ajuste persistente por navegador; en móvil scroll en vez de comprimir texto |
| CMP-01 | experimental | primitiva nueva con un consumidor; no se registra en el catálogo de componentes en esta tarea (ver FUERA DE ALCANCE) |
| BRAND (tokens, tipografía, tuteo) | cumplimiento | sólo `var(--*)` en la clase nueva; copy en tuteo («Arrastra para ajustar el ancho · doble clic para restablecerlo», «Vuelve todas las columnas a su ancho original») |
| Norte | no aplica / DESIGN-CHECK | el Norte no trae un diseño de asas de columna; se construyó con los tokens y el patrón de arrastre del sidebar del propio Studio |

## Revisión de datos (`/revisar-datos-ve`)

No aplica: no se capturan, mueven ni borran datos personales. Lo guardado en
`localStorage` son anchos en px por columna, sin identificar a nadie.

## Riesgos

- **El asa mide la celda.** Si una columna `grow` no tuviera celda medible
  (render sin layout), el ajuste arranca desde el piso. En jsdom pasa siempre y
  la prueba lo cubre simulando la medida.
- **Cinco tab stops más** en el encabezado antes de las filas. Es el costo del
  acceso por teclado (patrón APG); el orden es el de lectura.
- **Anchos medidos con datos ficticios.** Un código de warehouse o un nombre
  más largo que la muestra se corta con `…` y queda en `title`; no re-maqueta
  la fila.
- **`NEXT_PUBLIC_SITE_URL` distinto** (preview) alarga «Entra por …»; se corta
  con `title`, el piso no cambia.
- **Por navegador.** Los anchos no viajan entre equipos ni usuarios, como
  `useColumnConfig`.

## FUERA DE ALCANCE DETECTADO

Ver el handoff: alternativa de puntero sin arrastre, registro CMP-01, mono del
Studio sin JetBrains Mono, edición de operarios de Venezuela sin warehouse y
tabla sin semántica de tabla.

## Cierre (2026-10-15)

- **Merge:** PR #219, merge `530a3158` a las 02:50:11Z del 2026-10-15, con `--match-head-commit 0c23ad38` y el OK de Sam («ok, fusiona la #219 cuando esté en verde»).
- **Validación:** CI «Calidad continua» PASÓ sobre la cabeza fusionada. `pnpm verify` local sobre `71c3cceb` FALLÓ en `test` (3 de 9664), con archivos rojos idénticos a main que pasan aislados; la carrera de foco de `PinViewDialog.test.tsx` se trata en la PR #220. Los demás pasos PASARON, incluido el build.
- **Deploy:** «Deployment has completed» a las 02:51:58Z.
- **Smoke en producción: PASÓ.** Sam, literal: «ya probé las columnas, funcionan».
- Fuera de alcance que sigue abierto, ya anotado en el handoff:
  - ajustar el ancho sin arrastrar (A11Y-01);
  - la ficha de catálogo de la primitiva;
  - JetBrains Mono en el Studio;
  - editar operarios de Venezuela.
- Estado de la tarea: **integrada**.
