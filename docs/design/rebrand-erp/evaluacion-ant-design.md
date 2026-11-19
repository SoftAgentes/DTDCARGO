# Rebrand del ERP · Evaluación de Ant Design y auditoría del dolor de Sam

> Estado: **análisis y recomendación**. No cambia código del producto ni del ERP, no reserva números de SDD y no autoriza nada por sí sola.
> Fecha: 2026-11-19 · Rama `rebrand-design` · Base `main` `9ba6bcf32`.
> Etiquetas de evidencia (las mismas de SDD-0678): **C** código leído · **M** medido · **I** inferencia · **NV** no verificado.

## 0. Qué se pidió y qué se hizo

**Pedido de Sam (resumen fiel):** evaluar `ant-design/ant-design`, probarlo y ver si se puede usar más adelante. Quiere un nuevo rebrand **solo del ERP (Studio)**, no de la web pública. Le molestan botones que no le gustan y lecturas (textos, cifras, etiquetas) que no se actualizaron con el rebrand anterior (SDD-0603). Puede cambiar los colores o mantener los básicos y está confundido.

**Cómo se hizo (y límites):**

- Se hizo fork del repositorio en GitHub, autorizado por Sam, y un clon **superficial** (`--depth 1`) del fork en una carpeta hermana del repo, fuera de DTDCARGO. El fork completo pesa unos 280 MB; se clonó superficial para no cargar la PC compartida. Commit analizado: `ee8db7734e6a4d2387a55324e7e35eecb5535e72` (2026-11-19).
- El código de terceros se trató como **dato no confiable**: **no** se ejecutó nada (ni `pnpm install`, ni `npm install`, ni scripts, ni builds, ni ejemplos). Solo lectura estática, `gh api`, el registro público de npm y la web de documentación en el navegador integrado.
- Del paquete publicado (`antd@6.7.1`) y de otros 7 paquetes clave se descargó el `.tgz` **como archivo** y se leyó sin instalarlo.
- **«Probarlo» quedó en lectura, no en ejecución.** Probar de verdad (medir peso real, SSR, CSP) exige instalar paquetes de terceros: eso necesita turno de PC del Director y una carpeta desechable. Está propuesto como la Fase B0, opcional (sección 6).
- Auditoría de nuestro ERP: **solo lectura** sobre el árbol del repo. No se abrió el Studio en el navegador (necesita `pnpm install` y base de datos), no se tocó producción ni se leyó ninguna fila de negocio. Lo visual queda como **NV** donde se indica.

## 1. Veredicto corto (para Sam)

1. **Ant Design es serio y seguro de leer, pero no es lo que resuelve tu problema.** Es una librería gigante de componentes con su propio aspecto. Tu problema es que **parte de nuestros botones y cifras quedó sin migrar** al sistema que ya tenemos.
2. **Lo que duele está medido:** de 1.044 botones del Studio, 800 (77 %) siguen el sistema; 244 no. El grupo más claro es el módulo **Noticias Web**, que está pintado con el estilo de la web pública, no con el del Studio.
3. **Las cifras se leen de dos maneras a la vez:** la regla del 2026-08-11 es `$1,234.50`, pero 50 usos siguen formateando como `1.234,50` y 47 archivos formatean el dinero a mano en vez de usar el formateador único.
4. **No recomiendo adoptar Ant Design (opción C).** Habría que reescribir 657 archivos, chocaría con el Norte (que prohíbe librerías CSS-in-JS) y con los contratos de prueba que ya cuidan los botones. Sí vale la pena tomar **ideas** suyas (opción B), después de arreglar lo pendiente.
5. **Recomendación: A ahora y B después, con tus ojos de por medio.** Primero arreglar botones y lecturas con lo que ya tenemos (A). Luego, si todavía quieres otro aspecto, decidir colores con maquetas aprobadas por ti (B). Para empezar necesito que me marques **3 a 5 pantallas** que te disgusten.

## 2. Qué es Ant Design y qué hace realmente

### 2.1 Qué es y a quién sirve

- Librería de componentes React «de clase empresarial», de Ant Group, MIT, creada en 2015. **M**: 100.298 estrellas, 54.626 forks, 5,45 millones de descargas semanales de `antd` en npm (semana del 2026-11-12 al 2026-11-18).
- Sirve a **aplicaciones internas densas**: tablas, formularios largos, paneles. Es decir, el mismo terreno de un ERP. Su filosofía de botones es casi la nuestra: «una sola acción primaria por sección», con tipos primario, por defecto, discontinuo, texto y enlace, más variantes de peligro y fantasma. **M** (documentación oficial vista en el navegador).
- Trae **más de 60 componentes** (`components/`, **C**), 70 locales y el soporte de accesibilidad con pruebas automáticas (**C**: `tests/shared/accessibilityTest.tsx` usa `jest-axe`; 70 archivos `a11y.test.ts` bajo `components/*/__tests__`).

### 2.2 Versión, mantenimiento y tamaño

| Dato | Valor | Etiqueta |
|---|---|---|
| Versión actual | `antd` 6.7.1, publicada 2026-11-16 (anterior 6.7.0 el 2026-11-04) | M |
| Ritmo de publicación | versiones menores cada 1-2 semanas desde agosto (6.5.4 → 6.7.1) | M |
| Actividad | 100 o más commits y 181 PR fusionados en los últimos 30 días; último push hace horas | M |
| Contribuyentes | unos 379 en GitHub | M |
| Incidencias abiertas | 1.156 (cuenta incidencias y PR) | M |
| Versiones con parches de seguridad | 6.x y 5.x (`SECURITY.md`) | C |
| Paquete publicado | 10,7 MB comprimido, 49,5 MB descomprimido, 3.998 archivos (incluye `es`, `lib`, `dist`, locales) | M |
| Dependencias | 48 directas; **66 paquetes** en el árbol de ejecución (profundidad 3) | M, con un resolutor propio (ver 3.2) |

**Peso en el navegador.** El propio repo fija topes de tamaño por componente, **comprimido (gzip), importando el componente solo** (`.size-limit.ts`, **C**):

| Componente | Tope (KiB gzip) | Componente | Tope (KiB gzip) |
|---|---|---|---|
| Button | 71 | Select | 95 |
| ConfigProvider | 43 | Modal | 87 |
| Form | 82 | Drawer | 72 |
| Input | 89 | DatePicker | 117 |
| **Table** | **197** | Transfer | 151 |

Esos topes **no se suman**: cada componente incluye el mismo núcleo (estilos en JavaScript, tokens, iconos). Una pantalla con Table + Form + Select + DatePicker + Drawer + Modal quedaría, por **inferencia**, en el orden de **250 a 350 KiB gzip** adicionales. **I / NV**: no se midió; se mediría en la Fase B0. Para comparar: hoy el Studio **no usa ninguna librería de UI** (sus dependencias de interfaz son solo `clsx` y `tailwind-merge`, `package.json`, **C**), y sus 13 primitivas hechas a mano suman más de 5.000 líneas (`app/studio/_components/ui/`, **M**).

### 2.3 Arquitectura (verificada en el código)

- **Tokens de tres capas** (`components/theme/interface/seeds.ts`, **C**): *Seed* (un puñado de valores: `colorPrimary` `#1677ff`, `borderRadius` 6, `controlHeight` 32, `fontSize` 14) → *Map* (los deriva un algoritmo: paleta de 10 pasos por color, alturas, sombras) → *Alias* (nombres por intención) → *tokens por componente*. Una persona cambia 3 o 4 semillas y se recalcula todo.
- **Algoritmos de tema**: `default`, `dark` y `compact` (`components/theme/themes/`, **C**), combinables. Nosotros ya tenemos oscuro y compacto, hechos a mano en `tokens.css` por tema y por densidad.
- **`ConfigProvider`**: punto único para tema, tamaño, idioma, CSP y modo. **C**.
- **Estilos**: la versión 6 usa **variables CSS por defecto** y un CSS-in-JS propio (`@ant-design/cssinjs`), que **inyecta etiquetas `<style>` en tiempo de ejecución**. Hay un modo `zeroRuntime` (`docs/react/customize-theme.en-US.md:78`) que no genera estilos al ejecutar y exige importar un `antd.css` aparte. **C**. Ya no soporta IE ni React 17 (`docs/react/migration-v6.en-US.md:18-19`, **C**).
- **Slots de estilo**: cada componente expone `classNames` y `styles` por parte interna («Semantic DOM»), lo que permite retocar sin pelear con la especificidad. **I** (vi las pruebas `semantic.test.tsx`, no los probé).
- **DESIGN.md**: publican el sistema de diseño en un archivo legible por máquinas (`DESIGN.md`, **C**), con colores, tipografías, radios y estados de cada componente. Es el mismo espíritu de nuestro `BRAND.md`.

### 2.4 Compatibilidad con nuestro stack

| Requisito | Resultado | Etiqueta |
|---|---|---|
| React 19 (usamos 19.3.1) | Peer `react >=18`; la v6 ya no necesita el parche de React 19 (`migration-v6.en-US.md:36`). El código compilado cita la entrada del blog de React 19.3 | C |
| Next.js 16 (usamos 16.4.6), App Router | La documentación pide `@ant-design/nextjs-registry` (1.3.0, peer `next >=14`) para pintar los estilos de la primera pantalla. **No** hay prueba de que 1.3.0 se haya validado con Next 16 | C / **NV** |
| Server Components | Los **292 archivos** de `es/` del paquete publicado empiezan con `"use client"` (**M**, en el `.tgz`). El código fuente (`components/`) **no** los lleva: la directiva se agrega al compilar. En la práctica **todo antd es componente de cliente**; no hay SSR en servidor sin hidratar | M |
| Subcomponentes con punto | La documentación advierte que App Router **no** admite `<Select.Option />` ni `<Typography.Text />`: hay que importarlos por ruta (`use-with-next.en-US.md`) | C |
| Formularios | `Form` es de **estado de cliente** (`@rc-component/form`). Nuestro patrón es `<form action>` + `useActionState` + `FormData` + validador propio (`app/studio/CLAUDE.md`, **C**). Se puede combinar, pero **no encaja de fábrica** | I |
| Accesibilidad | Pruebas automáticas con axe en CI (arriba). Nuestro tema oscuro y de contraste es más estricto (ver 4.4) | C |
| Idioma | Hay `es_ES` y `es_US`, **no** `es_VE` (`components/locale/`, **C**). Se resuelve con un objeto de idioma propio; el DatePicker saldría en `dd/mm/aaaa` por `es_ES` | C / I |

### 2.5 Qué componentes cubren casos de ERP

| Necesidad nuestra | Componente de Ant Design | Lo que ya tenemos |
|---|---|---|
| Tablas densas, ordenar, filtrar, fijar columnas, virtualizar, filas expandibles, árbol | `Table` (`@rc-component/table`, virtual list) | `DataTable.tsx` (251 líneas: marco, celda y fila accionable) + columnas configurables propias (`ColumnConfig.tsx`) |
| Formularios con validación | `Form` + `Input` + `InputNumber` | `FormularioAccion`, server actions, `NumericInput` (acepta `32+1` y muestra `= 33`) |
| Drawer y modal | `Drawer`, `Modal`, `Popconfirm` | `DrawerShell`, `ConfirmDialog` (canónico en CMP-01) |
| Selects y buscadores | `Select`, `AutoComplete`, `Cascader`, `TreeSelect` | `ClientCombobox` |
| Fechas | `DatePicker`, `TimePicker`, `Calendar` | `DateField` (818 líneas, SDD-0660: `dd/mm/aaaa`, atajos T/+/−, ISO al formulario) |
| Botones | `Button` (tipos × peligro × fantasma × carga × deshabilitado) | `ActionButton`, `SplitActionButton`, `.studio-btn-*` con 5 variantes, 3 tamaños y elevación |
| Notificaciones | `message`, `notification`, `Alert` | `ToastProvider` (993 líneas), `Aviso` (franja plana) |
| Pestañas, segmentados | `Tabs`, `Segmented` | `.studio-tab`, `SegmentedControl` |
| Estadísticas | `Statistic`, `Descriptions`, `Progress`, `Skeleton` | `KpiCard`, `CapBar` |
| Transferir, árbol, subir archivos | `Transfer`, `Tree`, `Upload` | Uppy en el proyecto (`@uppy/*`) |

**Lectura honesta:** Ant Design cubre **todo** y a nivel muy profundo, pero casi todo eso **ya lo tenemos a medida**, con reglas de marca y pruebas de contrato propias. Donde Ant Design supera claramente lo nuestro es la **tabla** (virtualización, columnas fijas, filtros integrados) y el **árbol/transferencia**; hoy no son nuestro dolor.

## 3. Seguridad: revisión estática y cadena de suministro

> Separo lo **verificado** de lo **inferido** y de lo **no verificado**. No afirmo ausencia de problemas: afirmo lo que se encontró con qué método y qué no se miró.

### 3.1 Resultado por tema

| # | Tema | Hallazgo | Nivel |
|---|---|---|---|
| 1 | Scripts de instalación | **Ninguno.** El `package.json` publicado de `antd` no declara `preinstall`, `install` ni `postinstall` (los scripts `prepare` y `install-react-18` solo corren al desarrollar el propio repo, no en quien lo instala). Revisado también en los 66 paquetes del árbol con el campo `hasInstallScript` del registro: **0** | M |
| 2 | Avisos de seguridad publicados | **Ninguno** para `antd` ni para ninguno de los 66 paquetes resueltos, con el endpoint «bulk advisories» de npm (se comprobó que el endpoint sí responde con avisos cuando existen: `lodash@4.17.20` devuelve uno). La consulta GraphQL de GitHub para `antd` también dio 0 (el listado de avisos del repositorio no es público) | M (limitado: versiones resueltas con mi resolutor, no un `package-lock` real) |
| 3 | `eval`, `new Function`, `dangerouslySetInnerHTML` | **No hay** en `es/` de `antd`, ni en `cssinjs`, `icons`, `@rc-component/{util,table,select,form,picker}` | M (8 de 66 paquetes escaneados: `antd` y 7 más; ver 3.3) |
| 4 | `innerHTML` | Solo para **inyectar texto CSS** en una etiqueta `<style>`: `@rc-component/util` `dynamicCSS.js:57,150-151`, `@ant-design/icons` `cssUtils.js:67,129-130`, `cssinjs` `cacheMapUtil.js:68` (lectura). El CSS sale de los tokens del tema, no de datos del usuario. Riesgo si alguien metiera texto ajeno en un token de tema: **nosotros no lo haríamos** | M / I |
| 5 | Peticiones de red y telemetría de la **librería** | **Ninguna encontrada.** En `es/` de `antd` no hay `fetch`, `XMLHttpRequest`, `sendBeacon`, `localStorage`, `sessionStorage` ni `document.cookie`; tampoco `fetch`/XHR/`sendBeacon` en los 7 paquetes auxiliares escaneados. Solo `new Image()` en `upload/utils.js:90` y `watermark/index.js:165`, que cargan el archivo del propio usuario | M (por patrones; ver 3.3) |
| 6 | Telemetría de la **web de documentación** | `ant.design` (no la librería) manda `POST /cdn-cgi/rum` de Cloudflare y usa `gtag` (`.dumi/…`). **No** forma parte del paquete que instalaríamos | M |
| 7 | Dominios externos dentro de la librería (**regla D-2**) | Las URLs de `gw.alipayobjects.com` (Alibaba) aparecen **solo dentro de comentarios** de los estilos de `card`, `input` y `radio` (p. ej. `components/card/style/index.ts:110`); no se cargan. No hay CDN, fuentes ni analítica: usa la pila de fuentes del sistema y los iconos son SVG en línea | M |
| 8 | La única vía que sí abre un dominio externo | `createFromIconfontCN({ scriptUrl })` en `@ant-design/icons` (`IconFont.js:5-22`) **crea un `<script src>`** con la URL que le pasen; en la práctica `iconfont.cn` (Alibaba). Es **opt-in**: solo ocurre si alguien lo llama. Si se adopta algo, se prohíbe esa función con una regla de ESLint | C |
| 9 | CSP | Nuestra CSP **ya** permite `style-src 'self' 'unsafe-inline'` y `script-src … 'unsafe-inline'` (`next.config.ts:66-67`, comentario en `:37`: «los `style={{…}}` están en todo el código»). Los estilos que inyecta antd **no obligan a relajar nada que no esté ya relajado**. Además antd acepta **nonce** (`ConfigProvider csp={{ nonce }}`, `components/config-provider/index.tsx:119-123`; `cssinjs` `injectCSPNonce`), y `zeroRuntime` evita la inyección. *Matiz:* la CSP del Studio no es estricta hoy por estilos; endurecerla pasa por quitar estilos en línea, con o sin antd | C |
| 10 | Mantenedores y publicación | `antd` y 43 paquetes `@rc-component/*` los publica **el mismo grupo de 5 a 7 cuentas** (`afc163, zombiej, madccc, peachscript, chenshuai2144…`). **Ningún** paquete revisado trae **atestación de procedencia** (`dist.attestations` ausente) y los flujos de GitHub no usan `id-token`: la publicación **no** es verificable desde CI. Sí traen firma de registro (`signatures`). Una cuenta comprometida es un punto único de falla para ~50 paquetes | M / I |
| 11 | Paquetes pequeños de un solo autor en el árbol | `json2mq`, `string-convert` (una persona, sin atestación), `is-mobile`, `compute-scroll-into-view`, `stylis`, `dayjs`, `clsx`. Superficie pequeña pero real | M |
| 12 | Repo: flujos de GitHub | Siete flujos mencionan `pull_request_target` (`pr-check-merge`, `pr-contributor-welcome`, `pr-open-check`, `pr-open-notify`, `preview-start`, `verify-files-modify`, `visual-regression-diff-start`). Es un patrón delicado **del repo de ellos**, no del paquete que instalamos | C |
| 13 | `.npmrc` del repo | Apunta a `cdn.npmmirror.com` (espejo de Alibaba) para descargar binarios de desarrollo. **Solo afecta a quien construya el repo de antd**, no a quien instale el paquete | C |
| 14 | Archivos dirigidos a agentes dentro del repo clonado | El repo trae `CLAUDE.md`, `AGENTS.md` y carpetas `.claude/`, `.agents/`, `.cursor/` con *skills*. Se trataron como **datos**; no se siguió ninguna instrucción de ahí | C |

### 3.2 Cómo se obtuvo cada cosa (para que se pueda repetir)

- **Árbol de dependencias:** script propio de solo lectura (no instala) que resuelve versiones contra los metadatos del registro público de npm. **I**: es una aproximación; un `package-lock` real podría traer versiones distintas. Resultado: 66 paquetes, 8 de `@ant-design/*`, 43 de `@rc-component/*` y 15 de terceros.
- **Escaneo de patrones:** `grep` sobre el `.tgz` de `antd@6.7.1` descomprimido y sobre los `.tgz` de `@ant-design/cssinjs`, `@ant-design/icons` y `@rc-component/{util,table,select,form,picker}`.

### 3.3 Lo que NO se verificó

- **No** se revisaron los otros 55 paquetes del árbol más allá de los avisos y los scripts de instalación; tampoco `@ant-design/nextjs-registry`.
- **No** se descompiló ni se auditó línea por línea el código de `antd` (49 MB): el escaneo fue por patrones, y un patrón ausente no prueba la ausencia de comportamiento.
- **No** se ejecutó nada, así que el comportamiento en vivo (red, almacenamiento, hidratación en Next 16) es **NV**.
- **No** se comparó el contenido del paquete publicado con el repo para detectar diferencias (ataque de «paquete distinto al código»). Pendiente si algún día se adopta.
- **No** se revisó el historial de compromisos de cuentas de mantenedores ni de dependencias comprometidas en el pasado.

### 3.4 Riesgo que añade a un ERP con datos personales

- **Datos de clientes a un proveedor chino (regla D-2): sin evidencia de envío.** La librería corre entera en el navegador y no hace ninguna llamada de red propia (filas 5 y 7). El origen chino de la librería es un riesgo de **cadena de suministro** (quién publica el paquete), no de **flujo de datos**, y es el mismo tipo de riesgo que cualquier otro paquete de npm. **Nivel: M para «no hay red en la librería», I para la conclusión.**
- **Riesgo principal real:** una versión maliciosa publicada desde una cuenta comprometida (fila 10), que correría **dentro de las pantallas del Studio** con acceso a las mismas cookies y datos que el resto del código. Mitigaciones estándar, ya usadas en el repo: fijar versión exacta, `--ignore-scripts`, esperar unos días antes de actualizar, revisar el diff del paquete al subir de versión.
- **Riesgo operativo:** son más piezas de terceros en pantallas que muestran datos personales (cédula, RIF, direcciones). Cualquier adopción pasa por `/revisar-datos-ve` antes de usarla en una pantalla que los capture.

## 4. Qué nos sirve de Ant Design

### 4.1 Lo que ya tenemos (resumen de lo leído)

Leído en este orden: `BRAND.md`, `docs/design/README.md`, el Norte (`_norte/CLAUDE.md`, `HANDOFF.md`; el `CHANGELOG.md` de 4.249 líneas solo por consulta), `docs/engineering/project-rules.md`, `app/studio/CLAUDE.md`, `app/studio/tokens.css` (510 líneas), `app/studio/studio.css` (2.641 líneas), BTN-01, CMP-01 y SDD-0603.

- **Sistema de color y tipografía propio y estricto:** vino `#7F0F1A` para marca y acción principal, navy `#0F1E3D` para tinta y superficies oscuras, dorado de atención, rojo de error; Nunito Sans + Sora; reglas de contraste AA medidas por token (`BRAND.md`, `_norte/CLAUDE.md`).
- **Sistema de botones ya maduro** (SDD-0603, en producción desde 2026-11-15): lo que se oprime lleva relleno o contorno de tinta y sombra; lo que avisa es una franja plana; lo que solo se lee es texto. Cinco variantes, tres tamaños (40/36/32 px, nada oprimible bajo 32), elevación por niveles, verbos en negrita, contraste vigilado por contrato (`claridad-controles-contract.test.ts`).
- **Gobernanza ejecutable:** 29 políticas (BTN-01, VIS-01, A11Y-01…), registro CMP-01 de componentes canónicos y 22 archivos de prueba (21 de ellos «contratos») bajo `app/studio/_components/__tests__/`.
- **Restricción dura del Norte:** «**No** Tailwind, **no** CSS-in-JS libs, **no** styled-components» (`_norte/CLAUDE.md:339`, **C**). Ant Design es CSS-in-JS. Adoptarlo exige una excepción de marca (BD nuevo) y que Cloud Design la lleve por NORTE-SYNC. El Norte es la fuente de apariencia y solo cambia por ese protocolo (`docs/design/README.md:28`).

### 4.2 Pieza por pieza

| Pieza de Ant Design | Veredicto | Por qué y a qué costo |
|---|---|---|
| **Librería completa (`antd`)** | **No sirve entera** | Choca con el Norte (CSS-in-JS), con 657 archivos TSX y 9.316 estilos en línea ya escritos, con 21 contratos de prueba sobre nuestro CSS y comportamiento, y con el patrón de server actions. Peso estimado de 250-350 KiB gzip adicionales (**I**). Su aspecto por defecto no cumple nuestras reglas (4.4) |
| **Arquitectura de tokens (Seed → Map → Alias)** | **Sirve como idea** | Hoy `tokens.css` es una lista plana mantenida a mano (hay 23 de 34 pares token/respaldo desfasados, ver 5.2). Una capa de «semillas» (marca, tinta, estados) de la que se deriven hover, activo, fondos y bordes reduciría esos desfases. Costo: S-M, sin dependencias nuevas |
| **Modelo de botón: color × variante** | **Sirve como idea** | Ant separa el *color/tono* (marca, peligro, advertencia) de la *variante* (sólido, contorno, relleno suave, texto, enlace). Nuestras 5 variantes mezclan los dos ejes (`dark`, `warning`, `danger` son tonos; `ghost` es una variante). Pasaría a ser un contrato más corto de explicar. Costo: M, por contrato y por 78 archivos con `ActionButton` |
| **Escala de alturas por semilla** | **Sirve como idea, con ajuste** | Ant: `controlHeight` 32 → SM 24, XS 16, LG 40 (`genControlHeight.ts`). Nosotros ya tenemos 40/36/32. **No** copiar las alturas de Ant: 24 y 16 px rompen BD-037 («nada que se oprima baja de 32 px») |
| **Slots de estilo (`classNames`/`styles`)** | **Sirve como idea** | Permite retocar partes internas sin `!important`. Aplicable a `DataTable`, `DrawerShell`, `Aviso` si se rehacen |
| **`DESIGN.md` legible por máquina** | **Sirve como idea** | Cabría una versión de `BRAND.md` con colores, radios y estados en bloques validables. Ya tenemos tests que leen CSS; sería un complemento, no un reemplazo |
| **Paleta derivada** (`@ant-design/colors`, 32 KB, y `@ant-design/fast-color`, 56 KB, sin dependencias) | **Podría servir suelta** | Dos paquetes MIT, muy pequeños, que generan los 10 tonos de un color. Servirían **en tiempo de diseño** para proponer escalas a Cloud Design, sin entrar al bundle. **NV**: no los ejecuté. **Ojo:** inventar tonos fuera de la paleta aprobada rompe la regla 1 de BRAND; se haría solo con BRAND-CHECK y aprobación de Sam |
| **`Table`** | **Sirve entera, solo si algún día hace falta** | Virtualización, columnas fijas y filtros integrados superan a `DataTable` + `useColumnConfig`. Es la pieza de mayor valor y también la más pesada (197 KiB) |
| **`Form`/`InputNumber`/`DatePicker`** | **No sirve** | Duplican `FormularioAccion`, `NumericInput` (expresiones tipo calculadora) y `DateField` (SDD-0660, a medida de Venezuela) |
| **`Modal`/`Drawer`/`Popconfirm`/`message`** | **No sirve** | `ConfirmDialog` y `ToastProvider` están registrados como canónicos y cubiertos por pruebas |
| **Iconos (`@ant-design/icons`)** | **No sirve** | 11 MB descomprimidos, aspecto distinto al nuestro; ya tenemos `icons.tsx` con la misma metáfora en todos los módulos (BTN-01 §7) |
| **`Tree`, `Transfer`, `Cascader`** | **Sin necesidad hoy** | Candidatos solo si aparece un módulo que los pida |

### 4.3 Alternativas más ligeras

1. **Tomar solo las ideas (opción B de abajo):** costo de librería cero.
2. **Piezas «sin cabeza» (Radix UI, React Aria):** dan accesibilidad y comportamiento sin imponer estilo, encajan con CSS propio y con RSC. **NV**: no se evaluaron en esta tarea; si se quiere un componente complejo (tabla con teclado, combobox), conviene evaluarlas **antes** que Ant Design.
3. **Ant Design como referencia de patrones y de reglas** (la guía de diseño de `ant.design` y su `DESIGN.md`), sin dependencia.

### 4.4 Su aspecto por defecto no cumple nuestras reglas (medido)

Contraste del texto blanco sobre los colores por defecto de Ant Design, calculado con la fórmula WCAG:

| Color de Ant Design | vs blanco | Nuestra regla (texto normal) |
|---|---|---|
| Primario `#1677FF` | 4,10:1 | ≥ 4,5:1 → **no pasa** |
| Error `#FF4D4F` | 3,27:1 | **no pasa** |
| Éxito `#52C41A` | 2,27:1 | **no pasa** |
| Advertencia `#FAAD14` | 1,90:1 | **no pasa** |
| Nuestro vino `#7F0F1A` | 10,58:1 | pasa |
| Nuestro rojo `#A8323E` | 6,58:1 | pasa |

Se podría configurar un tema con nuestros colores, pero entonces se pierde la ventaja de «usarlo como viene». **M** (cálculo propio; coincide con las cifras de `_norte/CLAUDE.md`).

## 5. Auditoría del dolor de Sam en nuestro ERP (solo lectura)

> Método: scripts de solo lectura sobre `app/studio/` (657 archivos TSX sin pruebas; los comentarios se excluyeron). Cifras **M**. **Lo visual (cómo se ve cada pantalla en claro/oscuro/compacto) es NV**: no se abrió el Studio. El conteo dice qué **no usa el sistema**; no dice cuáles Sam ve como feos. Por eso la sección 7 pide pantallas concretas.

### 5.1 Botones que no siguen el sistema

**Cifras globales:** 1.044 `<button>` en 657 archivos. **800 (77 %)** usan clases del sistema (`studio-btn`, `studio-tab`, `studio-chip`). **244 (23 %)** no: 197 con estilo en línea y 47 con clases sueltas. Además, 331 archivos usan `<button>` crudo; BTN-01 §10 ya lo anotaba como indicador de alcance, no como falla automática.

**Hallazgo 1 (el mayor): Noticias Web está pintado con el estilo de la web pública.** 23 botones en 9 archivos usan clases de Tailwind y variables `--color-*` de la web (no existen en `tokens.css`): `bg-wine text-white px-5 py-3 rounded-lg`, `border-grey-200 text-grey-700`, `text-[12px]`. Efectos probables (**I**, sin verlo en pantalla):

- Hay **varios botones rellenos de vino en una misma pantalla** (regla: una sola acción principal por contexto, BTN-01 §2 y VIS-01 §5).
- Las variables `--color-*` solo se «oscurecen» con `[data-portal-theme="dark"]` (`app/globals.css:140-150`), y el Studio, que abre **oscuro por defecto**, usa `data-theme="dark"` (`tokens.css`). Por eso las tarjetas y bordes de este módulo se verían **claros sobre fondo oscuro**.
- Letra de 12 a 13 px y alturas por `py-1.5`/`w-9 h-9`, no los 32/36/40 del sistema.

Ubicaciones (todas bajo `app/studio/(app)/marketing/noticias-web/_components/`): `CategoryDetector.tsx:192`, `CategoryDetector.tsx:205`, `KeywordPanel.tsx:53`, `KeywordPanel.tsx:91`, `KeywordPanel.tsx:161`, `KeywordPanel.tsx:221`, `ManualPromptModal.tsx:122`, `ManualPromptModal.tsx:140`, `ManualPromptModal.tsx:206`, `ManualPromptModal.tsx:214`, `NoticiasWebClient.tsx:958`, `PublishModal.tsx:253`, `PublishModal.tsx:351`, `PublishModal.tsx:489`, `Step0Brief.tsx:134`, `Step0Brief.tsx:147`, `Step1Headlines.tsx:226`, `Step1Headlines.tsx:290`, `Step1Headlines.tsx:311`, `Step2Outlines.tsx:322`, `Step3Article.tsx:94`, `Step3Article.tsx:341`, `Step3Article.tsx:359`. La SDD-0603 trató los avisos y pestañas de este módulo (tramo 4d) pero no estos botones.

**Hallazgo 2: botones con alto fijo menor a 32 px** (BD-037: «nada que se oprima baja de 32 px»). 20 botones fuera del sistema declaran `height`/`minHeight` de 22 a 30 px:

| Alto | Archivo:línea |
|---|---|
| 22 | `(app)/admin/notificaciones/_components/NotificationsClient.tsx:566` |
| 24 | `(app)/admin/feature-flags/_components/FeatureFlagsClient.tsx:143` · `(app)/admin/rutas/_components/RouteDrawer.tsx:734` · `(app)/admin/_components/RecepcionAddonsSection.tsx:116` · `(app)/inspecciones/_components/PhotoManager.tsx:167` · `(app)/nomina/_components/NominaClient.tsx:935` · `(app)/reclamos/_components/ReclamosClient.tsx:1251` · `(app)/_components/comments/CommentsThread.tsx:408` |
| 26 | `(app)/academia/_components/AcademiaClient.tsx:833` · `(app)/_components/comments/CommentItem.tsx:238` · `(app)/_components/StudioSidebar.tsx:610` |
| 28 | `(app)/admin/rutas/_components/RouteDrawer.tsx:446` · `(app)/admin/_components/calculator/CiudadesPanel.tsx:228` · `(app)/financiero-china/_components/StatementDetail.tsx:685` · `(app)/gastos/_components/ExpenseRowActions.tsx:125` · `(app)/reportes/_components/BuilderView.tsx:84` · `(app)/tarifas/_components/TarifasClient.tsx:532` · `(app)/ve/_components/VeRowActions.tsx:203` |
| 30 | `(app)/bitacora/_components/BitacoraClient.tsx:333` · `(app)/mailing/_components/ScheduledView.tsx:228` |

(Rutas relativas a `app/studio/`. **I**: el alto fijo del propio botón; si el área clicable la agranda un contenedor, el caso cambia. Se confirma en pantalla.)

**Hallazgo 3: botones sin `type` declarado.** 11 (BTN-01 §2: todo botón declara `type`). Dentro de un `<form>` el valor por defecto es `submit`: `(app)/_components/NotificationBell.tsx:264`, `StudioSidebar.tsx:610`, `StudioSidebar.tsx:765`, `StudioTopbar.tsx:152`, `:226`, `:376`, `:453`, `_components/wiring/GlobalSearchModal.tsx:488`, `:763` y, ya con clases del sistema, `NotificationBell.tsx:200` y `StudioTopbar.tsx:289`. Riesgo bajo (están en el *chrome*, fuera de formularios), pero es una no conformidad con la política.

**Hallazgo 4: el login del Studio lleva colores a mano.** El inicio de sesión del Studio (la primera pantalla que se ve) tiene sus colores escritos a mano: `(auth)/login/LoginForm.tsx:37` (`#16264A`), `:48` (`#FFFFFF`), `:52` y `:203` (`#C2747F`), `:66` (`#A7E8C8`, un verde menta que no está en la paleta), `:175` (`#FFC2C7`, un rosa que tampoco está), `:124`, `:192`, `:194` (`rgba(255,255,255,…)`).

**Lo que NO es un problema (para no confundir):** 800 botones sí siguen el sistema; el sistema de elevación, contraste y tamaños está probado por contrato. El trabajo de los estados «guardando» y doble envío lo cubre SDD-0678 (en curso, no se duplica aquí).

### 5.2 «Lecturas» que no se actualizaron con el rebrand

**Lo que salió limpio:** no hay «MARKBOX» visible, ni etiquetas de versión vieja (v2.x–v5.x) en textos de pantalla, ni voseo en cadenas de interfaz. Las pocas coincidencias de voseo están en **comentarios** de código (p. ej. `cn/_components/ReceiptStatusBadge.tsx:7`, `ClientCombobox.tsx:42`). **Los textos de marca sí se actualizaron.**

**Lo que falta, por categoría:**

| # | Qué | Cifra | Dónde (muestra) | Etiqueta |
|---|---|---|---|---|
| L1 | **Cifras: dos formas de leer el dinero.** La decisión del fundador del 2026-08-11 es `$1,234.50` con un formateador único (`lib/money.ts`, cabecera). Siguen **47 archivos** que formatean con `toLocaleString("en-US")` a mano y **51** con una función local `fmt*`; solo **31** importan `lib/money` | 47 / 51 / 31 | `cobranzas/_components/CobranzaDrawer.tsx:57`, `CobranzasClient.tsx:53`, `IdentifyPaymentDrawer.tsx:29`, `PendingReportsNotice.tsx:16`, `contabilidad/_components/format.ts:5`, `facturacion/_components/FacturacionClient.tsx:42,49`, `clientes/[markbox]/estado-de-cuenta/page.tsx:77` | M |
| L2 | **Cifras: `1.234,50` frente a `1,234.50`.** 50 usos de `toLocaleString`/`NumberFormat` con `es-VE` (coma decimal) conviviendo con la regla `en-US` | 50 vs 47 archivos | `admin/_components/ExchangeRatesSection.tsx`, `admin/_components/AuditLogSection.tsx`, `bugs/_components/BugDrawer.tsx`, `clientes/_components/IdentityVerificationCard.tsx` | M |
| L3 | **Colores de respaldo viejos.** 302 usos de `var(--token, #hex)`; en **23 de 34** combinaciones distintas el hex de respaldo **no coincide** con el valor vigente del token. El caso más visible: `--info` respalda `#2A6FDB` (el azul de información anterior) cuando hoy `--info` es tinta navy; `--info-bg` respalda un azul claro cuando hoy es gris neutro. Hoy no se nota porque el token existe; se notaría si el token faltara | 23/34 pares | `bugs/_components/BugDrawer.tsx:73`, `:64`, `BugKanban.tsx:90`, `:81`, `BugStats.tsx:39`, `BugTable.tsx:42`, `mailing/_components/MailingClient.tsx:70`, `RulesView.tsx:49`, `mis-bugs/_components/BugCard.tsx:212` | M (latente) |
| L4 | **Hex sueltos fuera de tokens.** 150 en 33 archivos. Muchos son legítimos (documentos impresos, logos de canales, pruebas de impresión: `legal/`, `rendiciones/`, `cobranzas/recibo/`, `academia/diplomas/`, `etiquetas/Label.tsx`, `inspecciones/report-css.ts`, `crm/CanalLogo.tsx`, que el Norte exceptúa como «render fijo en blanco»). Los de pantalla: login (arriba), `usuarios/_components/InviteUserDrawer.tsx:763` (degradado con hex), `fiscal/_components/FiscalClient.tsx`, `fiscal/_components/WithholdingsView.tsx`, `reportes/_components/BuilderView.tsx` | ~60 de pantalla (estimado) | ver arriba | M / I |
| L5 | **`rgba(255,255,255,…)` en línea**, que `app/studio/CLAUDE.md` prohíbe (usar `--ink-inv-soft`, etc.) | 12 en 8 archivos | `cotizador/[code]/page.tsx:159,184`, `cotizador/_components/QuoteDrawer.tsx:806`, `seniat/_components/FilingDetailDrawer.tsx:284`, `usuarios/_components/InviteUserDrawer.tsx:785`, `login/LoginForm.tsx:124,192,194`, `login/recuperar/RecoveryForm.tsx:48,68,129,131` | M |
| L6 | **Estilos en línea en todas partes.** 9.316 `style={{…}}` en TSX. No es un defecto en sí, pero es lo que hace costosa cualquier migración de aspecto (un cambio de tokens no alcanza lo que está escrito en línea con valores fijos) y es la razón de que la CSP permita `unsafe-inline` | 9.316 | transversal | M |
| L7 | **Noticias Web** usa además `var(--color-grey-*)`, `--color-wine`, `--color-status-*` (variables de la web que el Studio no define): 51 usos de `var(--color-*)` y 123 líneas con clases de color de Tailwind (`bg-wine`, `text-grey-*`, `border-grey-*`). Las lecturas de ese módulo no siguen el tema del Studio | 51 + 123 | `marketing/noticias-web/page.tsx`, `publicadas/_components/EditarNoticiaForm.tsx`, `_components/NoticiasTabs.tsx` | M |

**Lo que NO pude medir (NV):** si hay **cifras o etiquetas con datos viejos** en dashboards (por ejemplo, un KPI que no se refresca o que usa un cálculo anterior), si el **tema oscuro** se ve bien en cada pantalla (la SDD-0603 lo dejó como pendiente «recorrer en la imagen de prueba»), el aspecto real de los botones deshabilitados y en curso, y si algún texto sigue con terminología desfasada que no sea «MARKBOX»/versión/voseo. Esto último se resuelve con la lista de Sam y un recorrido en la imagen de prueba (sección 7).

### 5.3 Pendientes que ya están escritos por SDD-0603 (para no duplicarlos)

De `docs/specs/0603-claridad-controles/spec.md` («Pendientes escritos»): siete pantallas detenidas por la PR #318 (Almacén CN, Naviera, Tracking, VE…), el relleno de `CapBar` (necesita token nuevo y decisión), el borde de la franja del portal, las 11 excepciones de contorno del tramo 4d, hallazgos del tramo 5e (chip «Total» de Mis reportes, código en el encabezado de la factura, «Admin»/«DTD» fijos en el menú de usuario, folio en vino en `BugCard.tsx`), `pestanas-contract` que excluye `crm/`, y los estados de carga (cubiertos por SDD-0678). **Esta auditoría no los repite; los suma como contexto.**

## 6. Estructura para decidir

### 6.1 Las tres opciones

| | **A · Mantener nuestro sistema y arreglar lo pendiente** | **B · Ajustar nuestra paleta tomando ideas de Ant Design (sin la librería)** | **C · Adoptar Ant Design con tema propio** |
|---|---|---|---|
| **En una frase** | Terminar de migrar botones, cifras y colores al sistema que ya tenemos | A + rediseñar los *tokens* (semillas → derivados), el modelo de botón y, si Sam quiere, los colores | Reemplazar nuestras primitivas por `antd` y dar a `ConfigProvider` los colores de DTD |
| **Colores** | Se mantienen (vino, navy, dorado) | Se pueden cambiar o afinar, con maquetas aprobadas por Sam | Los de DTD por tema, pero su aspecto base manda (alturas, radios, sombras) |
| **Resuelve el dolor de Sam** | Sí, directamente (botones y lecturas) | Sí, y además da el «aire nuevo» | Sí, a un costo enorme; el aspecto cambiaría **todo** |
| **Pros** | Rápido; sin dependencias nuevas; respeta el Norte, BRAND y los 21 contratos; riesgo bajo y reversible | Rebrand visual real con control; los desfases de tokens dejan de aparecer; reutiliza lo mejor de Ant Design sin su peso | Componentes complejos ya hechos (tabla, árbol); miles de usuarios y pruebas de accesibilidad |
| **Contras** | No cambia el «look»; si Sam quiere otro estilo, no lo da | Exige decisión de color y NORTE-SYNC con Cloud Design; toca CSS de todo el Studio (pero solo valores, no estructura) | Choca con el Norte (CSS-in-JS prohibido); 657 archivos; ~250-350 KiB gzip extra (**I**); `Form` de cliente vs server actions; `DateField` y `NumericInput` se pierden; los 21 contratos se rehacen; riesgo de cadena de suministro; aspecto genérico «tipo Ant» |
| **Costo (tamaño)** | **M**: 4 SDD pequeños a medianos | **L**: A + 3 SDD (diseño de tokens, aprobación, adopción) | **XL**: más de 10 SDD, migración por tandas y meses de convivencia |
| **Riesgo** | Bajo | Medio (color y marca) | Alto (producto entero) |
| **Seguridad** | Sin cambios | Sin cambios | Suma 66 paquetes de terceros a pantallas con datos personales |

### 6.2 Recomendación

**A ahora, B después y solo si Sam lo pide tras ver maquetas; C no.**

Por qué:

1. El dolor está **medido y es acotado**: un módulo entero con el estilo equivocado (Noticias Web), 20 botones bajo el mínimo, cifras con dos formatos y colores a mano en el login. Eso es de la opción A.
2. Cambiar la paleta **antes** de corregir lo pendiente sería pintar encima de botones y cifras que todavía no usan el sistema: cada color nuevo se vería inconsistente en las 244 excepciones.
3. Ant Design resuelve problemas que **no tenemos hoy** (tablas gigantes, árboles) y crea otros nuevos (Norte, formularios, peso, seguridad). Su valor para nosotros está en **ideas**, y esas se toman sin la librería (opción B).
4. Si en el futuro hace falta una tabla muy pesada, se evalúa `Table` o una pieza sin cabeza **para ese caso**, no el sistema completo.

### 6.3 Plan por fases (tamaño aproximado, SDD y allowlist)

> El Director asigna los números de SDD. Aquí solo propongo **cuántos**: **4 SDD para A** y **3 más para B**, más 1 opcional de prueba aislada. Todo cambio de comportamiento o aspecto del Studio exige SDD con allowlist exacta (`docs/governance/AGENT-BRIEF.md` pasos 3 y 5; `project-rules.md`); no hay barrido masivo (AGENT-BRIEF «Límites»): cada slice lleva su SDD. Ninguna fase de abajo toca la web pública.

**Fase 0 · Insumo de Sam (sin código, sin SDD).** Sam nombra 3 a 5 pantallas o botones que le molestan, y confirma tres decisiones: (1) formato de cifras (se mantiene `$1,234.50` o se cambia a `1.234,50`), (2) si quiere mantener vino y navy, (3) si le molestan más los botones o las cifras. Tamaño: S. Sin SDD.

**Fase A1 · Noticias Web al sistema del Studio** (1 SDD). Pasar los 23 botones y los `--color-*` a `.studio-btn-*` y tokens del Studio. Allowlist: los 9 archivos de `marketing/noticias-web/_components/` listados arriba, más `page.tsx`, `publicadas/` y `retirar/` que usan `--color-*`, y una prueba de contrato. Tamaño: **S-M**.

**Fase A2 · Botones bajo 32 px y sin `type`** (1 SDD). Los 20 botones de 5.1 y los 11 sin `type`, más una regla de contrato que impida `height` menor a 32 en un `<button>`. Allowlist: esos ~28 archivos y `claridad-controles-contract.test.ts`. Tamaño: **M**.

**Fase A3 · Lecturas: cifras** (1 SDD, en 2-3 tandas por AGENT-BRIEF). Migrar los 47 archivos a `lib/money.ts` (o decidir el formato con Sam) y cerrar los 50 usos de `es-VE` numérico. Allowlist por tanda: p. ej. cobranzas (4 archivos), facturación (4), financiero-china (5), cotizador (4), más prueba de contrato que congele la lista (modelo `fechas-contract.test.ts`, que ya congela pendientes de fechas). Tamaño: **M-L**.

**Fase A4 · Higiene de tokens** (1 SDD). Corregir los 23 pares de respaldos desfasados, los 12 `rgba(255,255,255,…)`, los hex de pantalla del login e `InviteUserDrawer`, y la regla de contrato que lo vigile. Allowlist: ~20 archivos más `tokens.css` si hiciera falta algún token (dos tokens nuevos para el login si Sam lo aprueba: hoy usa un menta y un rosa fuera de paleta). Tamaño: **S-M**.

**Fase B0 · Prueba aislada de Ant Design (opcional, 1 SDD de docs).** Carpeta desechable fuera del repo, `pnpm install --ignore-scripts` con turno de PC del Director, para **medir** peso real, hidratación con Next 16 y CSP. Se haría solo si Sam quiere seguir considerando la opción C. Tamaño: **S**.

**Fase B1 · Propuesta de tokens v2** (1 SDD de diseño, con Cloud Design). Semillas → derivados, eje color × variante para botones, escala de alturas. Maquetas en claro y oscuro con **3 variantes de paleta** para que Sam elija. Incluye BRAND-CHECK y un BD nuevo si cambia un color. Allowlist: `docs/design/rebrand-erp/`, `BRAND.md`, `BRAND-DECISIONS.md`. Tamaño: **M**. Requiere decisión de Sam.

**Fase B2 · Adopción de tokens v2 en el Studio** (1 SDD, por tramos como la 0603). `app/studio/tokens.css`, `studio.css`, componentes de `app/studio/_components/ui/` y contratos de prueba. Tamaño: **L**.

**Cuánto suma:** A = 4 SDD (S-M, M, M-L, S-M). B = 3 SDD más (M, L y la prueba opcional S). **Orden obligatorio:** A1 y A2 antes de B1; A3 y A4 pueden ir en paralelo con B1 si no comparten archivos (cada una trabaja en su rama y worktree).

### 6.4 Decisiones que necesito de Sam (máximo tres)

1. **Pantallas:** ¿cuáles 3 a 5 te disgustan? Con eso priorizo A1 y A2.
2. **Cifras:** ¿mantenemos `$1,234.50` (decisión del 2026-08-11) o prefieres `1.234,50`?
3. **Colores:** ¿mantenemos vino y navy como base (A) o quieres ver maquetas de otra paleta (B)?

## 7. Qué quedó por hacer o por verificar

**Pendientes de esta tarea (no hechos, a propósito):**

- Recorrer el Studio en la imagen de prueba, en claro, oscuro y compacto, para ver los botones y cifras que Sam señale. Necesita turno de PC y el entorno de prueba.
- Fase B0 (prueba aislada de `antd`), solo si Sam la pide.
- Verificar `@ant-design/nextjs-registry` con Next 16 y el resto de los 55 paquetes del árbol.

**Fuera de alcance detectado:** ver el handoff `.agents/handoffs/rebrand-design-evaluacion-ant-design.md`.

## Anexo · cómo repetir las mediciones

Todas las cifras de la sección 5 salen de recorrer `app/studio/` en solo lectura:

- Botones: se extrae cada `<button …>` (respetando las llaves anidadas y quitando comentarios) y se clasifica por clase (`studio-btn|studio-tab|studio-chip`), estilo en línea, `type` y alto fijo.
- Hex fuera de tokens: se quitan comentarios y los `var(--token, #hex)` y se cuentan los `#RRGGBB` restantes; los respaldos se comparan con el valor del bloque `:root` de `tokens.css`.
- Cifras: `toLocaleString`/`Intl.NumberFormat` por *locale* y consumidores de `@/lib/money`.
- Árbol de `antd@6.7.1`: resolutor de versiones propio sobre el registro público de npm, avisos con el endpoint «bulk advisories».

Los scripts viven en la carpeta temporal de la sesión; si el Director los quiere versionados, se pueden mover a `scripts/` con SDD propio.
