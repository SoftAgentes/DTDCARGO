# Rebrand del ERP · Evaluación de Carbon (IBM)

> Estado: **análisis y recomendación**. Mismo método y mismos límites que la [evaluación de Ant Design](evaluacion-ant-design.md); la comparación entre los dos está en [versus-ant-design-vs-carbon.md](versus-ant-design-vs-carbon.md).
> Fecha: 2026-11-19 · Rama `rebrand-design` · Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** no verificado.

## 0. Cómo se hizo

- Fork del repositorio en GitHub (autorizado por Sam: «haz lo mismo») y clon **superficial y parcial** (`--depth 1`, solo los paquetes `react`, `styles`, `themes`, `colors`, `type`, `layout`, `motion`, `grid`, `utilities`, `feature-flags` y `docs`) en una carpeta hermana del repo. El repo completo pesa unos 8 GB. Commit analizado: `3011e16b77b6b4af5c4156f4014486cddac25573` (2026-11-19).
- Del paquete publicado `@carbon/react@1.121.0` y de `@ibm/telemetry-js` se descargó el `.tgz` **como archivo** y se leyó sin instalar. **No se ejecutó nada de terceros.** Las páginas de uso de `carbondesignsystem.com` se leyeron con el navegador de documentación, solo lectura.
- **No** se abrió el Studio ni se tocó producción. Lo visual queda **NV** hasta el laboratorio de mañana.

## 1. Qué es y qué hace realmente

| Dato | Valor | Etiqueta |
|---|---|---|
| Qué es | Sistema de diseño de IBM: especificaciones + componentes React (`@carbon/react`), Web Components, iconos y tokens. Apache-2.0 | M |
| Versión | `@carbon/react` 1.121.0 (2026-11-18); **la 2.0.0 está en alfa** (alfa 12 publicada hoy) | M |
| Ritmo | menor cada ~2 semanas (1.119 el 10-21, 1.120 el 11-04, 1.121 el 11-18); 100 o más commits y 161 PR fusionados en 30 días | M |
| Comunidad | 9.631 estrellas, 2.306 forks, unos 377 contribuyentes, 1.181 incidencias abiertas; **170.891 descargas semanales** de `@carbon/react` | M |
| Tamaño | `@carbon/react` 5,8 MB descomprimido (2.184 archivos); `@carbon/styles` 4,3 MB; `@carbon/icons-react` 17,2 MB (11.261 archivos, un archivo por icono) | M |
| Dependencias | 19 directas; **59 paquetes** en el árbol (profundidad 6): 11 `@carbon/*`, 10 `@ibm/*` (fuentes Plex) y 38 de terceros (`downshift`, `flatpickr`, `@floating-ui/*`, `motion`/`framer-motion`, `temporal-*`, `es-toolkit`…) | M |

### Arquitectura (lo que cambia respecto a Ant Design)

- **Estilos en Sass, CSS estático.** Carbon pinta con clases `cds--*` y **variables CSS `--cds-*`**; no inyecta CSS desde JavaScript en tiempo de ejecución. Es la diferencia central con Ant Design (CSS-in-JS). Para consumir los estilos hay que compilar Sass (`sass` es dependencia par opcional, `^1.33`). **C**
- **Tokens y temas.** Cuatro temas oficiales (`white`, `g10`, `g90`, `g100`; los dos últimos son oscuros) con tokens por intención (`background`, `layer-01`, `text-primary`, `support-error`, `button-primary`, `notification-background-error`, `focus`…) definidos en JSON (`packages/themes/tokens/themes/*`). Modelo de **capas** (`Layer`) para que una tarjeta sobre un fondo cambie de tono sola. **C**
- **Escala de alturas** (`packages/styles/scss/utilities/_layout.scss:12-34`): `xs` 24 · `sm` 32 · `md` 40 · `lg` 48 · `xl` 64 · `2xl` 80 px. **Por defecto el botón es `lg` (48 px).** **C**
- **Radio de esquina.** Los botones salen **cuadrados** (`$button-border-radius: 0`, `components/button/_vars.scss:24`), configurables con la variable `--cds-button-radius` y variables por esquina. **C**
- **Colores por defecto.** Azul `#0f62fe` (botón primario, enlaces y foco), rojo `#da1e28` (peligro/error), tinta `#161616`. Contraste con blanco calculado: **5,00:1, 5,00:1 y 18,10:1**: pasan AA. **M** (valores leídos en el repo; cálculo propio).

### Compatibilidad con nuestro stack

| Requisito | Resultado | Etiqueta |
|---|---|---|
| React 19.3.1 | Peer `^16.8 \|\| … \|\| ^19`; el propio repo desarrolla con React 19.2 | C |
| Next.js 16 / App Router | Sin prueba. La directiva `"use client"` aparece **solo en la entrada raíz** del paquete publicado (`es/index.js`); los componentes sueltos no la llevan, así que cada uso desde un Server Component exige nuestro propio archivo `"use client"` | M / I |
| Server Components | Los componentes con estado (menús, modales, tablas) son de cliente. Sin SSR sin hidratación | I |
| Estilos y CSP | Sin estilos inyectados en ejecución, que es lo mejor para una CSP estricta (**I**; no se escaneó cada paquete). Nuestra CSP ya permite `style-src 'unsafe-inline'` de todos modos (`next.config.ts:67`) | C / I |
| Idioma es-VE | No hay paquete de idiomas: los textos van por propiedades y `translateWithId`; el DatePicker usa `flatpickr` y su `locale`. Habría que escribir nuestro diccionario | I / NV |
| Accesibilidad | Pruebas de accesibilidad en Storybook (`addon-a11y`) y componentes diseñados para AA; **no medí** la cobertura | C / NV |

### Componentes que cubren casos de ERP

`DataTable` (ordenar, seleccionar, acciones sobre varias filas, expandir, skeleton), `Modal`/`ComposedModal`/`Tearsheet`, `Notification` (inline, toast, accionable), `InlineLoading`/`Loading`/`ProgressBar`, `Tag`, `Tabs`/`ContentSwitcher`, `Dropdown`/`ComboBox`/`MultiSelect`, `DatePicker`, `NumberInput`, `FileUploader`, `TreeView`, `UIShell` (encabezado y menú lateral), `PageHeader`, `Heading`/`Section`, `Layer`, `Stack`, `OverflowMenu`/`MenuButton`/`ComboButton`, `ConditionBuilder` y más (`packages/react/src/components/`, **C**). Cubre el mismo terreno que nuestras primitivas; la tabla es menos potente que la de Ant Design (**I**, no comparado en uso).

## 2. Seguridad

| # | Tema | Hallazgo | Nivel |
|---|---|---|---|
| 1 | **Script de instalación** | **Sí hay.** 20 de los 59 paquetes del árbol declaran `postinstall`: todos los `@carbon/*` y los `@ibm/plex*`. Es `ibmtelemetry --config=telemetry.yml` (`packages/react/package.json`, scripts) | M |
| 2 | Qué hace esa telemetría | Según su README, recopila **uso anónimo** del paquete: qué componentes y atributos aparecen en el JSX del proyecto que lo instala (lista de ~1.200 nombres de atributo en `telemetry.yml`), con valores sensibles reducidos a hash SHA-256, y lo envía a `https://www-api.ibm.com/ibm-telemetry/v1/metrics`. Dice que corre **solo en CI**, pero que los contenedores (Docker) cuentan como CI. Se apaga con `IBM_TELEMETRY_DISABLED='true'` | C (README) / **I** (comportamiento real no ejecutado) |
| 3 | Nuestra situación | Construimos en Docker con `pnpm install --frozen-lockfile` (`Dockerfile:36`), justo el entorno donde correría. Pero pnpm 11 solo ejecuta scripts de los paquetes de `allowBuilds` (`better-sqlite3`, `esbuild`, `sharp`, `unrs-resolver`, `pnpm-workspace.yaml`), y `.npmrc` trae `strict-dep-builds=false` (se omiten sin fallar). **Inferencia:** no correría; se deja además `IBM_TELEMETRY_DISABLED=true` por doble seguridad | C / I |
| 4 | Avisos de seguridad | **Ninguno** en los 59 paquetes (endpoint «bulk advisories» de npm, verificado con un caso positivo) ni en la consulta de GitHub para `@carbon/react` | M (resolutor propio; no es un `package-lock`) |
| 5 | Publicación | **Con atestación de procedencia** (`dist.attestations` presente) en `@carbon/react`, `styles`, `themes`, `colors`, `icons-react`, `layout`, `type`; el flujo de publicación está declarado (`publishConfig.provenance: true`). **Mejor que Ant Design** (ninguno). Excepción: `@ibm/telemetry-js` no la trae y tiene 21 cuentas mantenedoras | M |
| 6 | Mantenedores | `@carbon/react`: 2 cuentas (`carbon-bot`, `sstrubberg`); resto de `@carbon/*`: 5 | M |
| 7 | `eval`, `dangerouslySetInnerHTML`, red, almacenamiento | **No hay** `eval`, `new Function`, `dangerouslySetInnerHTML`, `fetch`, XHR, `sendBeacon`, `localStorage`, `sessionStorage`, cookies ni `<script>` dinámico en `es/` de `@carbon/react`. Un `innerHTML`: `DatePicker.js:131` (quita espacios de un nodo del calendario) | M (solo `@carbon/react`) |
| 8 | **Fuentes desde un dominio externo** | Los estilos traen por defecto `@font-face` que apuntan a la CDN de IBM (`1.www.s81c.com/common/carbon/plex/fonts/…`, `fonts/_src.scss:113-118`), con `$css--font-face: true` (`_config.scss:19`). Se apaga con `$css--font-face: false`. **Nuestra CSP lo bloquearía** (`font-src 'self' data:`, `next.config.ts:68`) | C |
| 9 | Dominios de la regla D-2 | IBM es de EE. UU.; no hay dominios de proveedores chinos en el código escaneado | M |
| 10 | Origen del riesgo | Un único flujo de publicación verificable, menos cuentas y atestación: menor riesgo de cadena de suministro que Ant Design. El riesgo propio de Carbon es **la telemetría y la CDN de fuentes**, ambas con apagado | I |

**No verificado:** los otros 58 paquetes más allá de avisos e instalación; `@ibm/telemetry-js` línea por línea; comportamiento en vivo; coincidencia entre paquete publicado y repo.

## 3. Qué nos sirve de Carbon

| Pieza | Veredicto | Costo y riesgo |
|---|---|---|
| **Reglas de botones** | **Sirve como norma casi tal cual** (ver §4): una primaria por pantalla, orden y agrupación, verbo + sustantivo, sentence case | Costo bajo; ya están en BTN-01 |
| **Tokens por intención y temas** (`--cds-*`) | **Sirve como idea o como base** | Ya tenemos tokens; Carbon aporta capas (`Layer`) y temas oscuros derivados |
| **Taxonomía de notificaciones** (en línea, toast, accionable, llamada) | **Sirve como idea** para ordenar `Aviso` y `ToastProvider` | Bajo |
| **`InlineLoading`** (inactivo/activo/terminado/error) | **Sirve como patrón** para «Guardando… / Guardado» | Bajo; nuestro `ActionButton` ya lo cubre |
| **`Heading` + `Section`** (nivel de título automático por anidación) | **Sirve como idea** para la jerarquía de títulos | Bajo-medio |
| **Librería `@carbon/react` entera** | **Posible, con condiciones** | Dependencia de Sass, wrappers `"use client"`, diccionario es-VE, tema propio sobre sus tokens, y aspecto «IBM» (cuadrado, 48 px) que habría que domar; ver el versus |
| `DataTable`, `UIShell`, `Tearsheet` | **Sin necesidad hoy** | Candidatos si aparece un módulo que los pida |
| Iconos | **No** | 17 MB; ya tenemos `icons.tsx` |

## 4. Botones, títulos, mensajes y guardado en Carbon (lo que pediste mirar)

**Botones** (`carbondesignsystem.com/components/button/usage`, **M**; props en `Button.tsx:15-30`, **C**):

- Ocho tipos: `primary`, `secondary`, `tertiary`, `ghost`, `danger`, `danger--primary`, `danger--tertiary`, `danger--ghost`. Seis tamaños (`xs`–`2xl`).
- **Una sola primaria por pantalla** (encabezado, modal y panel lateral no cuentan). Más de tres llamadas a la acción: usar terciario o fantasma, y más de tres opciones en grupo: menú.
- **`secondary` es la acción negativa de un par** (Cancelar, Volver), no una alternativa importante. `tertiary` (contorno) es la acción menos prominente que puede ir sola. `ghost` es lo más discreto.
- Orden: en diálogos y asistentes, **primaria abajo a la derecha, a la derecha de la secundaria**; `ButtonSet` ordena los botones por tipo automáticamente (`ButtonSet.tsx:36,97`, **C**). Mismo ancho en un grupo.
- Etiquetas: sentence case, **verbo + sustantivo** («Guardar cambios»), sin sustantivo suelto, alineadas a la izquierda, icono a la **derecha**, sin truncar. **No usar botón para navegar: usar enlace.**
- Cargando: botón deshabilitado con `InlineLoading` dentro. **Danger sin icono solo.**

**Títulos y mensajes.** Carbon separa dos cosas: los **títulos de página** (`Heading`/`Section`: el nivel `h1`…`h6` se calcula solo por anidación, `Heading/index.tsx`) y los **mensajes** (`Notification`, con su propio *título corto* y *subtítulo* dentro de la franja). Mensajes:

| Tipo | Cuándo | Persistencia |
|---|---|---|
| **En línea** | Estado de una acción, junto al campo o encima de los botones del formulario | Se queda hasta cerrarla o resolver |
| **Toast** | Aviso breve y no crítico | Opcional: se cierra solo a los ~5 s |
| **Accionable** | Hay un siguiente paso (un botón o enlace) | Se queda; recibe foco |
| **Llamada (callout)** | Información necesaria **antes** de actuar; carga con la página | No se puede cerrar; no para éxito ni error |

Tonos: información (azul), éxito (verde), advertencia (amarillo), error (rojo); «úsalas con moderación». Propiedades: `title`, `subtitle`, `lowContrast`, `hideCloseButton`, `timeout`, `statusIconDescription` (`Notification.tsx:343-395`, **C**). La página no fija el rol ARIA (`status` o `alert`); eso se decide en cada uso (**NV**).

**Guardado y feedback.** `InlineLoading` tiene cuatro estados (`inactive`, `active`, `finished`, `error`), un `onSuccess` y un `successDelay` de 1.500 ms (`InlineLoading.tsx:16-19,63-72`, **C**): «guardando → guardado → vuelve a reposo». Para esperas largas, `ProgressBar`; para carga inicial, *skeleton* (nunca en botones ni entradas). Las pautas de «Guardado» son específicas de cada patrón y no hay una página única (**M**: la página de carga no habla de «Guardando…/Guardado»).

## 5. Lo que NO se verificó

El aspecto en pantalla con nuestros datos; el peso real del CSS y del JavaScript; el comportamiento con Next 16 (Sass, wrappers `"use client"`); `DatePicker` con es-VE; tablas con miles de filas; si la telemetría correría en nuestro build; la accesibilidad medida con axe.
