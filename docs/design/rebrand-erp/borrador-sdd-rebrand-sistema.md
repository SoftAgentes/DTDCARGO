# Borrador de SDD · Rebrand del sistema completo: color de acción, cifras y simetría

> Estado: **adoptado** en tres SDD, con números del Director General (2026-11-20): [SDD-0686 color de acción](../../specs/0686-rebrand-color-accion-azul/spec.md) (reserva `codex/sdd-reserve-0686`), [SDD-0687 formato de cifras](../../specs/0687-rebrand-cifras-formato-ve/spec.md) (`codex/sdd-reserve-0687`) y [SDD-0688 simetría de pantallas](../../specs/0688-rebrand-simetria-pantallas/spec.md) (`codex/sdd-reserve-0688`). Las specs mandan; este borrador queda como evidencia fechada. Las specs 0687 y 0688 llegan a `main` en sus propias PR; hasta entonces sus enlaces no resuelven.
> Fecha: 2026-11-20 · Rama `rebrand-design`. Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** no verificado.
> Insumos: [checklist-y-color.md](checklist-y-color.md), [mejoras-ux-adaptables.md](mejoras-ux-adaptables.md), [evaluacion-ant-design.md](evaluacion-ant-design.md), [evaluacion-carbon.md](evaluacion-carbon.md).

## 1. Decisiones de Sam (2026-11-20, en el chat de esta sesión, literal)

1. **Color:** «opcion 2  Completamente todo el proyecto web, portal y ERP; todo el sistema completo.» → opción 2, «Azul DTD», como color de acción en **web pública, Portal y ERP**.
2. **Pantallas:** «Tres o cinco pantallas que más me molestan. Tú tienes que revisar con calma, tómate el tiempo necesario; todas las vamos a cambiar.» → se revisan y se cambian **todas**; el orden lo propone esta revisión (sección 3).
3. **Marca:** «Si hay que cambiar el branding completo, se puede cambiar. Si hay que eliminar algo que nos pueda dar errores adentro del brand.md, hay que cambiarlo.» → autoriza reescribir las reglas de `BRAND.md` que choquen (sección 5).
4. **Cifras:** «El formato que se usa va a ser el segundo, el que dice 1.235,50: la coma siempre va a ser los decimales.» → **punto para miles, coma para decimales**. Sustituye la decisión del 2026-08-11 (`$1,234.50`, cabecera de `lib/money.ts`).
5. **Tecleo de cifras:** a la pregunta «Al teclear «1.234» en un campo de dinero, ¿qué debe entender el sistema?», Sam eligió «Pedir que se aclare». → en campos de **dinero**, un punto seguido de exactamente tres cifras **no se interpreta**: el campo lo rechaza y pide escribirlo con coma decimal o sin punto. El sistema nunca adivina un monto.

**Lo que estas decisiones NO cubren** (se pide aparte, con el tramo a la vista): fusionar, publicar a producción, escribir en la base de datos y cambiar el logo.

## 2. Lo que falta confirmar antes de tocar código (tres puntos; el tecleo ya está decidido)

| # | Punto | Mi propuesta | Por qué importa |
|---|---|---|---|
| 1 | **Tono exacto del azul** | Partir de `#1F4FA8` (claro) y `#7FAAF0` (oscuro) y **verlo en la imagen de prueba** antes de fijarlo | Son valores calculados; nadie los ha visto en pantalla |
| 2 | **Símbolo de moneda** con el formato nuevo | `$1.234,50` (símbolo adelante, sin espacio) | `Intl` en `es-VE` escribe `USD 1.234,50`; hay que elegir una sola forma |
| 3 | ~~Escritura de cifras en los campos~~ | **Decidido por Sam (2026-11-20): pedir que se aclare.** Falta solo la regla para CBM y peso, donde `0.125` es legítimo | Puede multiplicar o dividir un monto por mil |
| 4 | **Logo y wordmark** («DTD» en vino) | No se tocan en este SDD | Son archivos de diseño (4 variantes PNG); rehacerlos es trabajo de Cloud Design |

## 3. Revisión de todas las pantallas

### 3.1 ERP · los 55 módulos, de más a menos inconsistencia

Puntaje propio de solo lectura (**M**): suma botones fuera del sistema, botones bajo 32 px, títulos fuera del patrón, anchos de drawer distintos, pies a mano, tablas crudas, tamaños de letra, espacios y radios sueltos, colores a mano y dinero formateado a mano. **No mide cuánto se usa cada pantalla (NV).**

| # | Módulo | Puntos | Archivos | Botones fuera | Títulos fuera | Drawers (anchos distintos) · sin pie | Tablas crudas | Dinero a mano |
|---|---|---|---|---|---|---|---|---|
| 1 | `admin` (11 secciones) | 355 | 86 | 35 de 119 | 5 de 12 | 10 (7) · 9 | 13 | 0 |
| 2 | `marketing` (Noticias Web) | 263 | 42 | 28 de 46 | 3 de 7 | 0 | 2 | 1 |
| 3 | `clientes` | 91 | 36 | 6 de 38 | 3 de 6 | 1 · 1 | 3 | 2 |
| 4 | `academia` | 82 | 13 | 5 de 20 | 5 de 6 | 6 (4) · 1 | 0 | 0 |
| 5 | `mailing` | 75 | 14 | 5 de 20 | 0 de 1 | 2 (2) · 2 | 4 | 0 |
| 6 | `contabilidad` | 74 | 25 | 10 de 55 | 0 de 1 | 0 | 5 | 4 |
| 7 | `financiero-china` | 73 | 17 | 4 de 26 | 0 de 1 | 5 (3) · 0 | 2 | 14 |
| 8 | `inspecciones` | 73 | 11 | 1 de 19 | 2 de 3 | 1 · 0 | 15 | 0 |
| 9 | `usuarios` | 70 | 17 | 13 de 40 | 0 de 1 | 2 (1) · 0 | 3 | 0 |
| 10 | `bitacora` | 69 | 15 | 11 de 42 | 2 de 2 | 2 (2) · 1 | 0 | 0 |
| 11 | `nomina` | 67 | 37 | 3 de 66 | 1 de 2 | 18 (6) · 1 | 0 | 0 |
| 12 | `proveedores` | 66 | 14 | 5 de 18 | 0 de 1 | 7 (4) · 3 | 0 | 3 |
| 13 | `tracking` | 60 | 34 | 4 de 39 | 0 de 2 | 0 | 1 | 1 |
| 14 | `cn` (Almacén China) | 59 | 13 | 13 de 25 | 0 de 1 | 2 (2) · 1 | 0 | 1 |
| 15 | `seniat` | 53 | 13 | 2 de 12 | 0 de 1 | 2 (2) · 2 | 0 | 12 |
| 16 | `bugs` | 52 | 8 | 3 de 12 | 0 de 1 | 1 · 1 | 2 | 0 |
| 17 | `reportes` | 51 | 6 | 3 de 4 | 1 de 2 | 0 | 2 | 2 |
| 18 | `crm` | 50 | 25 | 4 de 19 | 0 de 1 | 3 (2) · 2 | 1 | 0 |
| 19 | `fiscal` | 50 | 7 | 0 de 16 | 0 de 1 | 1 · 0 | 5 | 9 |
| 20 | `cobranzas` | 48 | 11 | 0 de 15 | 0 de 1 | 4 (2) · 4 | 0 | 5 |

Siguen `cotizador` (45), `rendiciones` (42), `etiquetas` (39), `despacho` (38), `facturacion` (38), `legal` (38), `embarques` (36), `fidelizacion` (33), `calendario` (32), `costing` (31) y 25 módulos más con menos de 31 puntos.

**Además, lo que se ve en todas las pantallas** (no es un módulo): menú lateral y barra superior (`StudioSidebar.tsx`, `StudioTopbar.tsx`: botones a mano, uno de 26 px) y el **inicio de sesión** (`(auth)/login/LoginForm.tsx`: colores a mano, incluidos un menta y un rosa fuera de la paleta).

### 3.2 Portal y web pública

Aquí la revisión es **menos profunda**: se midió dónde vive el color, no botón por botón (**M** para los conteos; el resto **NV**).

| Superficie | Usos del vino por token o clase | Dónde se concentra |
|---|---|---|
| **Portal** | 259 usos en 73 archivos | `_components` (59), `perfil` (53), `compras` (51), `envios` (17), `facturas` (16), `proveedores` (14) |
| **Web pública** | 412 usos en 35 archivos + 200 en `components/` | `registro` (55), `p` (45), `noticias` (32), `entrar` (19) y los componentes compartidos |
| **Móvil (operarios y empleados)** | 131 usos en 25 archivos | `app/m` |
| **Back, Marca, Invitar** | pocos usos; 14 hex a mano | `app/back`, `app/marca`, `app/invitar` |

### 3.3 Orden propuesto (todas se cambian; este es el orden)

1. **Lo que se ve siempre:** tokens de color, menú lateral, barra superior e inicio de sesión del ERP; menú y encabezado del Portal; encabezado, pie y botones de la web.
2. **Operación diaria** (**I**: son el núcleo del negocio): `dashboard`, `embarques`, `tracking`, `clientes`, `cn`, `cobranzas`, `facturacion`, `crm`.
3. **Los más inconsistentes:** `admin`, `marketing` (Noticias Web), `academia`, `mailing`, `inspecciones`, `usuarios`, `bitacora`.
4. **Dinero:** `contabilidad`, `financiero-china`, `seniat`, `fiscal`, `cotizador`, `nomina`, `proveedores`, `tesoreria`, `gastos` (van con el tramo de cifras).
5. **El resto de los 55 módulos**, por grupos de 5 a 8.

## 4. Color · alcance en todo el sistema

**Regla nueva (propuesta de texto):** el **azul** es el color de acción (botón principal, enlaces, foco). El **rojo** queda solo para peligro y error. El **vino** queda solo para la identidad (logo, wordmark, sello, documentos de marca). La **selección** sigue en tinta (BD-037). Los **saldos y cifras** van en tinta; rojo solo si están vencidos.

### 4.1 Inventario medido

| Superficie | Por token o clase (cambia desde un solo sitio) | Hex de la familia vino a mano (se revisan uno por uno) |
|---|---|---|
| ERP (`app/studio`) | 1.018 usos en 276 archivos | 97 en 36 |
| Portal (`app/portal`) | 259 en 73 | 2 en 1 |
| Web pública (`app/*` + `components/`) | 612 en 64 | 30 en 7 |
| Móvil (`app/m`) | 131 en 25 | 2 en 2 |
| `lib/` (correos, PDF, tokens) | 20 en 9 | 49 en 22 |
| Back, Marca, Invitar | 11 en 6 | 14 en 5 |
| Otros | — | `infra/chatwoot` (13 archivos), `supabase/migrations` (8), `infra/dtd-cargo` (5), scripts (5), `public/` (3) |

Fuentes del color: `app/studio/tokens.css` (ERP), `app/globals.css` (web y Portal; 234 líneas nombran el vino), `lib/design-tokens.ts:12-14`.

### 4.2 Cómo se hace

- **Tokens de acción nuevos** (`--accion`, `--accion-hover`, `--accion-text`, `--accion-tint` y sus pares `--color-accion*` en la web y el Portal). El botón principal, los enlaces y el foco leen de ahí.
- **Reparto del vino actual en tres destinos**, por token y no pantalla por pantalla: acción → azul; cifras, KPI y saldos → tinta; identidad (logo, wordmark, Shipping Mark si Sam lo quiere así) → vino.
- **`--wine` no se borra**: queda como token de identidad, para no romper el logo ni los documentos de marca.
- **Excepción vigente que se cierra:** el «vino claro» de la Vista simple del Portal (EXC-0654-01, `BRAND.md:388-398`) nació del mismo problema («El rojo siempre llama como si fuera un error»). Con el azul deja de hacer falta: se sustituye y se anota como cerrada.

### 4.3 Lo que no cambia solo (y necesita decisión u OK aparte)

- **Correos y plantillas guardadas en la base de datos:** 8 migraciones ya aplicadas llevan el vino en plantillas. Una migración aplicada no se edita: haría falta una **migración nueva** y **escritura en producción con OK nominal de Sam** y el runbook.
- **Chatwoot** (`infra/chatwoot`, 13 archivos) y **`infra/dtd-cargo`**: se despliegan aparte.
- **PDF y documentos** (factura, estado de cuenta, etiquetas, diplomas): son documentos de marca; propongo que **conserven el vino** salvo que digas lo contrario.
- **Logo, favicon e imágenes** de `public/brand`: no se tocan.

## 5. `BRAND.md` y Norte · reglas que chocan con las decisiones

Líneas de `BRAND.md` (**C**) que hoy obligarían a un agente a deshacer el cambio. Se reescriben en el **primer tramo**, junto con un BD nuevo en `docs/design/studio/_norte/BRAND-DECISIONS.md` (el último es BD-070).

| Línea | Qué dice hoy | Qué pasa a decir |
|---|---|---|
| `BRAND.md:104` | «Marca · Identidad, selección o acción · Vino en el acento o CTA» | Marca = identidad (vino). Acción = azul |
| `BRAND.md:121-123` | `--wine` = «Acento primario · CTAs · links · acentos» | `--wine` = identidad; se documentan los tokens de acción |
| `BRAND.md:145-146` | valores de `--wine` en oscuro | se añaden los de acción en oscuro |
| `BRAND.md:162` | «NUNCA uses morados, púrpuras o azules brillantes para alertas» | Se mantiene para **alertas**; se aclara que el azul de acción no es alerta |
| `BRAND.md:183` y `:186` | «Sobre `--wine` / `--danger` → texto blanco»; excepción de `--wine` en oscuro | Se añade la fila del azul (blanco en claro, navy en oscuro) |
| `BRAND.md:188-189` | «Rol de `--wine` en dark» como relleno de acción | Se reescribe: el relleno de acción es el azul |
| `BRAND.md:309` | BD-037: «El vino queda para la acción principal y la identidad» | «El azul es la acción principal; el vino, la identidad» |
| `BRAND.md:324-325` | 6 variantes de botón; tono de badge `wine` | Se alinean con las 5 variantes reales del Studio y se decide el badge |
| `BRAND.md:388-398` | Excepción «vino claro» del Portal | Cerrada, sustituida por el azul |

**También se actualizan** (mismas reglas, otros archivos): `docs/design/studio/_norte/CLAUDE.md` §Sistema de color y §Contraste (es espejo de `BRAND.md`; el Norte solo cambia por NORTE-SYNC, así que se anota la enmienda local como se hizo en SDD-0441 y se envía a Cloud Design), `app/studio/CLAUDE.md` («`primary` (wine)», «Convención de formato (V1)»), `docs/governance/policies/vis-01.md` §3 y `btn-01.md` §2 («el vino de marca no sustituye `danger`»), y la cabecera de `lib/money.ts`.

**Errores que conviene quitar de paso** (lo que pediste): `BRAND.md:324` habla de 6 variantes de botón (`secondary`, `soft`) que el Studio no tiene; `docs/engineering/project-rules.md` resume las fuentes como «solo Archivo + JetBrains Mono + Noto Sans SC» cuando el sistema usa Nunito Sans y Sora desde 2026-05-31. Son contradicciones que hoy pueden llevar a un agente a aplicar la regla equivocada.

## 6. Cifras · `1.234,50` en todo el sistema

**Regla nueva:** punto para miles y coma para decimales en **todo lo que se muestra**. Lo que viaja a la base de datos, a las API y a los formularios sigue en formato de máquina (`1234.50`): no cambia.

### 6.1 Inventario medido

| Qué | Cifra |
|---|---|
| Formateador único (`lib/money.ts`: `fmtUsd`, `fmtAmount`, `fmtUsdCompact`) | Lo usan 40 archivos (31 ERP, 3 móvil, 1 Portal, 5 `lib`). **Cambiarlo ahí cambia esos 40 de una vez** |
| Archivos que formatean `en-US` a mano | 65 (47 ERP, 12 `lib`, 2 Portal, 3 componentes de la web, 1 `app/p`) |
| Archivos con `toFixed(2)` | 49 |
| Archivos que ya formatean en `es-VE` | 54 (35 ERP, 13 `lib`, y sueltos en Portal, móvil y web) |
| Pruebas con cifras escritas como `1,234.50` | 34 archivos (hay que actualizarlas, no debilitarlas) |
| Pruebas con cifras como `1.234,50` | 14 archivos |
| Campo numérico (`NumericInput.tsx:464-467`) | Vista previa en `en-US` «por pedido del founder»: se invierte |

### 6.2 Riesgos (los tres importan)

- **R1 · Lo que se teclea.** Hoy el analizador (`lib/studio/util/parse-numeric-expression.ts:273-302`) trata **un solo separador como decimal**: `1.234` se guarda como **1,234** (uno coma dos tres cuatro), no como mil doscientos treinta y cuatro. Con el formato nuevo en pantalla, alguien que copie o teclee `1.234` esperando mil doscientos treinta y cuatro guardaría un monto mil veces menor. Y al revés no se puede «adivinar»: en CBM `0.125` es legítimo. **Decidido para dinero (Sam, 2026-11-20): se rechaza y se pide aclarar**, con un mensaje de campo (ERR-01) que dice cómo escribirlo con coma decimal o sin punto. **Queda por decidir CBM y peso** (propuesta: se mantiene el punto decimal, con el valor interpretado a la vista). La prueba del tramo T3 debe cubrir `1.234`, `1.234,50`, `1234,5`, `1,234` y `0.125`, con mutante.
- **R2 · Lo que sale del sistema.** Excel y CSV (`exceljs`), PDF de factura y estado de cuenta, textos de WhatsApp del cotizador y correos: cada uno necesita decisión. Propuesta: **documentos para personas, `1.234,50`; archivos para máquinas (CSV, Excel con celdas numéricas), número real** sin texto formateado.
- **R3 · Dos idiomas.** El ERP también se muestra en chino (`zh-CN`), donde `lib/i18n/format.ts` escribe `12,323.50`. Hay que decidir si la regla es por idioma de la persona o fija para todos. Propuesta: fija, `1.234,50`, también en chino, porque las cifras se comparan entre oficinas.

## 7. Tramos (cada uno con su allowlist exacta, su PR y su verificación)

La allowlist de abajo es por carpeta; **se congela archivo por archivo en la spec** al asignarse el número. Sin barrido masivo (AGENT-BRIEF): un tramo, una rama, una PR.

| Tramo | Qué | Allowlist (nivel carpeta) | Tamaño | Cómo se verifica |
|---|---|---|---|---|
| **T0** | Spec, BD nuevo, `BRAND.md`, Norte (enmienda local), políticas VIS-01 y BTN-01 | `docs/specs/NNNN-…/`, `BRAND.md`, `docs/design/studio/_norte/BRAND-DECISIONS.md`, `docs/governance/policies/` | S | `docs:check`, `sdd:check`, `governance:check` |
| **T1** | Tokens de acción y botón principal, enlaces y foco en el **ERP**; contratos de contraste | `app/studio/tokens.css`, `app/studio/studio.css`, `app/studio/_components/__tests__/` | M | Contratos con mutante; imagen de prueba en claro y oscuro |
| **T2** | Lo mismo en **web y Portal** | `app/globals.css`, `lib/design-tokens.ts`, pruebas de color del Portal | M | Igual; `/ui-check` |
| **T3** | Formato de cifras: `lib/money.ts`, `NumericInput`, analizador (R1) y sus pruebas | `lib/money.ts`, `lib/studio/util/parse-numeric-expression.ts`, `app/studio/_components/ui/NumericInput.tsx`, pruebas | M-L | Pruebas de ida y vuelta (mostrar → teclear → guardar), mutantes |
| **T4** | Piezas compartidas: encabezado de página, tamaños de drawer, pie obligatorio, escala de texto | `app/studio/_components/ui/`, `docs/governance/components/` | M | CMP-01 `proposed`, pruebas de cada pieza |
| **T5…** | Adopción por grupos de módulos en el orden de 3.3: color a mano, botones, encabezado, drawers, cifras a mano | carpetas de cada grupo | L en total | Contrato que congela la lista de pendientes y baja por tramo |
| **T-doc** | Documentos y correos de marca (lo que Sam decida en 4.3) | `lib/…/mail`, plantillas, PDF | M | Con OK nominal si toca la base de datos |
| **T-fin** | Recorrido completo, NORTE-SYNC, cierre | — | S | Recorrido en claro, oscuro y compacto; `/ui-pro` |

**Estimación sin reservar:** un SDD paraguas (como la 0603) o, si el Director lo prefiere, **3 SDD**: color, cifras y simetría. Recomiendo **tres**, porque el de cifras tiene un riesgo de datos (R1) que no debe viajar mezclado con cambios de apariencia.

## 8. Qué necesito para arrancar

- **Del Director:** número(s) de SDD, turno de PC para la imagen de prueba y para `pnpm verify`, y el orden frente a las sesiones en curso que tocan los mismos archivos (`tokens.css`, `studio.css`, `globals.css`, `BRAND.md`).
- **De Sam:** los cuatro puntos de la sección 2 (el tono se confirma viéndolo) y qué hacer con correos, PDF y Chatwoot (4.3).

## 9. Límites

No se abrió ninguna pantalla: todo es lectura de código. El puntaje de la sección 3 es una heurística propia. El Portal y la web se revisaron por color, no botón por botón. Los hex del azul son propuestas calculadas. No se midió el impacto en rendimiento ni en accesibilidad en vivo.
