# Rebrand del ERP · Qué podemos adaptar de Carbon y Ant Design para mejorar la experiencia del Studio

> Estado: **propuesta**. No cambia código, no instala nada y no reserva números de SDD. Insumos: [evaluación de Ant Design](evaluacion-ant-design.md), [evaluación de Carbon](evaluacion-carbon.md) y [versus](versus-ant-design-vs-carbon.md).
> Fecha: 2026-11-20. Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** no verificado.

## 1. La idea en corto

Todo lo de abajo se puede hacer **sin instalar ninguna de las dos librerías**: son reglas y piezas compartidas, escritas con nuestros tokens y nuestros colores. Lo que hace que el Studio «no se vea simétrico» no es el color ni el botón en sí: es que **cada módulo arma a mano su encabezado, su panel lateral, su tabla y sus espacios**. Carbon y Ant Design resuelven eso con piezas únicas; eso es lo que conviene copiar.

## 2. Por qué no se ve simétrico: lo medido

Medición de solo lectura sobre `app/studio/(app)/` (55 módulos, 96 páginas, 606 archivos TSX). **M**. Lo visual en pantalla sigue **NV**: no se abrió el Studio.

| Qué | Lo medido | Qué produce a la vista |
|---|---|---|
| **Encabezado de página** | 91 títulos `<h1>` en 87 archivos, armados a mano. **7 tamaños** (30 px en 60, 26 en 7, 24 y 28 en 4, 32 y 34 en uno, y 14 sin tamaño fijo), **20 combinaciones de margen** y **10 clases** distintas. Solo **una** página usa un componente de encabezado (`calendario/page.tsx:70`), y es local | El título, el subtítulo y los botones de arriba quedan a distinta altura y distancia en cada módulo |
| **Panel lateral (drawer)** | 117 `DrawerShell` con **13 anchos** distintos (de 480 a 760 px; 560 en 36, 520 en 19, 640 en 12, 620 en 11…) | El panel «salta» de ancho entre un módulo y otro |
| **Pie del drawer** | 45 archivos usan `DrawerShell` **sin** el pie compartido `DrawerFooter`: el pie y el orden de sus botones están hechos a mano | El botón principal no siempre está en el mismo sitio |
| **Tablas** | 73 `<table>` crudas en 50 archivos y 546 rejillas armadas a mano en 234; el marco compartido `TableFrame` se usa 10 veces en 8 archivos | Alto de fila, relleno y alineación de cifras cambian por pantalla |
| **Tamaños de letra** | **22 tamaños** escritos en línea (de 9 a 34 px, con medios puntos: 10,5 · 11,5 · 12,5 · 13,5) | Jerarquía de texto inconsistente |
| **Espacios** | 1.506 rellenos y 1.762 separaciones con número suelto, contra 354 y 712 con token | Ritmo vertical distinto en cada pantalla |
| **Esquinas** | 245 radios con número suelto en **15 valores** distintos, contra 777 con token | Tarjetas y cajas con redondeos distintos |
| **Rastro al guardar** | `useToast` en 132 archivos, pero el resalte de fila (`useRowHighlight`) en solo 14 | En la mayoría de los listados no se ve qué fila acabas de tocar |
| **Botones** | 244 de 1.044 fuera del sistema (ver [auditoría](evaluacion-ant-design.md#5-auditoría-del-dolor-de-sam-en-nuestro-erp-solo-lectura)) | Botones de distinto alto y estilo |

## 3. Qué adaptar, por prioridad

Tamaños: **S** pequeño · **M** mediano · **L** grande. «De dónde sale» cita lo que verifiqué en cada librería.

### 3.1 Piezas compartidas que hoy faltan (lo que más arregla la simetría)

| # | Mejora | De dónde sale | Qué haríamos nosotros | Tamaño |
|---|---|---|---|---|
| 1 | **Encabezado de página único** | Carbon `PageHeader`; Ant Design usa un patrón equivalente | Un componente `EncabezadoPagina`: eyebrow, título, subtítulo y zona de acciones, con **un solo tamaño y un solo margen**. Reemplaza los 91 títulos a mano | L (por tramos de módulos) |
| 2 | **Tres anchos de panel lateral** | Carbon `Modal`: tamaños `xs`, `sm`, `md`, `lg` (`Modal.tsx:59`) | `DrawerShell` acepta `tamano="sm \| md \| lg"` (por ejemplo 520, 640, 760) en vez de un número libre. De 13 anchos a 3 | M |
| 3 | **Pie de drawer obligatorio y orden automático** | Carbon `ButtonSet` ordena los botones por tipo (`ButtonSet.tsx:36,97`) | Los 45 drawers sin `DrawerFooter` pasan al pie compartido; el pie ordena solo: secundario a la izquierda, principal a la derecha, destructivo aparte (BTN-01 §4) | M |
| 4 | **Escala de texto cerrada** | Carbon tiene estilos con nombre (`heading01`…`heading07`, `body01/02`, `label01/02`, `helperText01/02`, `packages/type/src/styles.ts`) | 7 u 8 estilos con nombre (`titulo-pagina`, `titulo-seccion`, `cuerpo`, `etiqueta`, `ayuda`, `cifra`…) en `studio.css`; se dejan de escribir tamaños sueltos. De 22 tamaños a 8 | M-L |
| 5 | **Títulos con nivel calculado** | Carbon `Heading` + `Section` (`Heading/index.tsx`) | `Seccion` y `Titulo`: el nivel `h2`/`h3` sale de la anidación. Mejora lectores de pantalla y uniforma los títulos de sección | M |
| 6 | **Espaciador con tokens** | Carbon `Stack` (`gap` por pasos, `Stack.tsx:18,47`); Ant Design `Space`/`Flex` | `Pila`: apila con `gap` de `--s-*` únicamente. Ataca los 1.762 `gap` sueltos sin tocarlos uno por uno | S (pieza) + adopción gradual |
| 7 | **Marco de tabla único** | Ant Design `Table` (alineación por columna, `align`, columnas fijas); Carbon `DataTable` | Extender `TableFrame`/`Cell` (ya existen) con densidad, cifras a la derecha en mono y encabezado fijo, y migrar las tablas crudas por tramos | L |
| 8 | **Ficha de solo lectura** | Ant Design `Descriptions` (`column`, `layout`, `bordered`) | `Ficha`: pares etiqueta-valor con columnas y alineación fijas, para todo «lo que solo se lee» (BD-037 regla 3) | M |
| 9 | **Campo de formulario único** | Ant Design `Form` (`layout`, `requiredMark`, `colon`) | `Campo`: etiqueta, ayuda, error y marca de obligatorio iguales en todo el Studio. Hoy los ayudantes viven en `tms/_components/TruckDrawer.tsx` con prefijo fijo (deuda anotada en `app/studio/CLAUDE.md`) | M |

### 3.2 Reglas de botones para sumar a BTN-01

Lo que ya tenemos y coincide: una sola acción principal por contexto, principal a la derecha, destructiva separada, sentence case, verbos directos, nada bajo 32 px.

Lo que **no** tenemos escrito y conviene adoptar de Carbon (`carbondesignsystem.com/components/button/usage`, **M**):

| # | Regla | Qué cambia en la práctica |
|---|---|---|
| 10 | **Verbo + sustantivo** («Guardar cambios», «Crear embarque»), salvo los comunes («Cancelar», «Cerrar», «Eliminar») | Menos botones «Guardar» o «Aceptar» ambiguos |
| 11 | **Máximo tres acciones visibles por grupo**; la cuarta va a un menú (`ActionMenu` ya existe) | Encabezados y filas menos cargados |
| 12 | **Un solo tamaño dentro de un grupo de botones** y el tamaño acorde a los campos de al lado | Se acaba el botón de 36 al lado de uno de 32 |
| 13 | **Para navegar, enlace; para actuar, botón** | Ya está en BTN-01 §2, pero falta vigilarlo con un contrato |
| 14 | **Destructivo en tres énfasis** (relleno, contorno, texto) según el riesgo, y nunca icono solo | Hoy `danger` es solo relleno: «Eliminar» en una fila pesa igual que «Eliminar definitivamente» |
| 15 | **Posición fija del icono** respecto del texto, igual en todo el Studio (Carbon lo pone a la derecha; nosotros lo usamos a la izquierda: se elige una y se fija) | Botones con icono alineados entre módulos |
| 16 | **La etiqueta no se corta**: si no cabe, baja a segunda línea | Sin «Guardar camb…» |
| 17 | **Dos ejes: tono × forma** (idea de Ant Design: color × variante) | `dark`, `warning` y `danger` son tonos; `ghost` es forma. Con dos ejes el contrato es más corto y habilita la regla 14 |

### 3.3 Mensajes: separar qué es título, qué avisa y cuánto dura

Hoy tenemos `Aviso` (franja) y toast. Carbon agrega una **tabla de cuándo y cuánto dura cada uno** que no tenemos escrita:

| # | Mejora | Regla que adoptaríamos |
|---|---|---|
| 18 | **Cuatro tipos con nombre** | *En línea* (resultado de una acción, junto al campo o encima de los botones del formulario) · *Toast* (breve, no crítico) · *Accionable* (trae un siguiente paso) · *Llamada* (información que se necesita antes de actuar; carga con la página) |
| 19 | **Persistencia escrita** | En línea: se queda hasta cerrarla o resolver · Toast: ~5 s y la información debe poder encontrarse en otro lado · Accionable: se queda · Llamada: no se cierra |
| 20 | **Lugar fijo del aviso de formulario** | Siempre encima de la fila de botones del pie, nunca arriba del todo en un módulo y abajo en otro |
| 21 | **La llamada no es para éxito ni error** | Evita franjas verdes o rojas permanentes en pantallas (ya pasó con «créditos sin liberar», SDD-0603, enmienda de cierre) |
| 22 | **Título corto + subtítulo dentro del aviso** | `Aviso` ya acepta `titulo`; falta la pauta de longitud (una línea de título, una o dos de explicación) |

### 3.4 Guardado y respuesta del sistema

| # | Mejora | De dónde sale | Qué haríamos |
|---|---|---|---|
| 23 | **Cuatro estados con nombre** en toda acción que guarda: reposo, trabajando, terminado, error | Carbon `InlineLoading` (`InlineLoading.tsx:16-19`) | `ActionButton` ya tiene tres; falta que el **error** se vea en el propio botón (hoy depende de cada pantalla, BTN-01 §10). Va con SDD-0678, que ya trabaja «Guardando…» |
| 24 | **Duración única de la confirmación** | Carbon usa 1,5 s (`successDelay`); nosotros 2,5 s | Fijar un solo valor en un token de tiempo |
| 25 | **Rastro de fila en todos los listados** | Regla propia (`app/studio/CLAUDE.md`, «Trazabilidad visual») | Llevar `useRowHighlight` de 14 archivos a todos los listados con acciones. Es la mejora de experiencia con más efecto inmediato |
| 26 | **Esqueleto solo en tablas y tarjetas**, nunca en botones ni campos; espera larga con barra de progreso | Carbon, patrón de carga | Pauta para los estados de carga, que SDD-0603 dejó para una spec propia |

### 3.5 Tokens (de Ant Design, sin la librería)

| # | Mejora | Qué haríamos |
|---|---|---|
| 27 | **Semillas → derivados** | Hover, activo, fondo suave y borde salen de la semilla (vino, tinta, estados) en `tokens.css`, en vez de mantenerse a mano. Evita los 23 pares de respaldo desfasados que encontró la auditoría |
| 28 | **Radios y espacios solo por token, con contrato** | Una prueba que congele la lista de archivos con `borderRadius`, `gap` o `padding` numéricos (modelo `fechas-contract.test.ts`) y la haga bajar tramo a tramo |
| 29 | **Capas** (idea de Carbon `Layer`) | Una tarjeta dentro de otra cambia de tono sola (`--bg-surface` → `--bg-elevated`), en vez de escoger el fondo a mano en cada pantalla |

## 4. Por dónde empezar

Orden sugerido, de más efecto por menos riesgo:

1. **Encabezado de página único** (mejora 1) y **anchos y pie de drawer** (2 y 3): es lo que más se nota como «simétrico» y toca piezas, no reglas de negocio.
2. **Rastro de fila en todos los listados** (25) y **botones fuera del sistema** (fases A1 y A2 de la evaluación anterior).
3. **Reglas nuevas de botones** en BTN-01 (10 a 17) y **tabla de mensajes** (18 a 22): son documentos más un contrato; se aprueban antes de migrar.
4. **Escala de texto** (4), **espaciador** (6) y **tokens por contrato** (28): avance gradual.
5. **Tabla, ficha y campo** (7, 8 y 9): lo más grande; por módulo.

**Qué necesita SDD:** todas las mejoras tocan apariencia o comportamiento del Studio, así que cada una va con SDD y allowlist exacta, por tramos (AGENT-BRIEF: sin barrido masivo). Las piezas nuevas (1, 5, 6, 8, 9) entran por CMP-01 como `proposed`. Las reglas 10 a 22 son cambios a políticas aprobadas (BTN-01 y la de avisos): las aprueba Sam. Estimación sin reservar: **unos 8 a 10 SDD**, que se solapan con los 4 de la opción A.

**Qué no cambia:** colores, tipografías y marca. Nada de esto toca vino, navy, Nunito Sans ni Sora.

## 5. Límites

Las cifras de la sección 2 son conteos de código, no lo que se ve: un número suelto puede coincidir con el token y verse bien. Falta el recorrido en pantalla (claro, oscuro, compacto) y la lista de pantallas que Sam señale. Las reglas de Carbon vienen de su guía pública y de su código; no se probaron con usuarios nuestros.
