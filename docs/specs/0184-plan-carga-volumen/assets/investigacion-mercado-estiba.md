# Planificador de estiba DTD — consolidado de inteligencia externa sobre EasyCargo y el mercado

**Marcado de evidencia.** Cada afirmación relevante lleva una de estas dos marcas:
- **`V`** = VERIFICADA. Hay fuente externa citable (texto del vendor, documentación pública, captura, paper, norma).
- **`I`** = INFERIDA. Deducción razonable a partir de fuentes verificadas, pero nadie lo dice literal. Todo lo marcado `I` es discutible y debe validarse antes de que decida arquitectura.

Este documento consolida dos síntesis independientes (una funcional-visual, otra algorítmica). **Donde se contradicen, se dice; no se promedia.**

---

## 0. Contradicciones que hay que resolver antes de escribir código

Estas son las divergencias reales del material. Ninguna se puede cerrar leyendo más; cada una lleva su vía de cierre.

| # | Contradicción | Posición A | Posición B | Qué hacer |
|---|---|---|---|---|
| C1 | **Tiempo real del algoritmo Extreme Points** | Crainet/Perboli/Tadei miden **<10⁻² s** sin agrupamiento y **<0,5 s** con agrupamiento `V` | GENPACK (arXiv 2026) mide **14,29 ± 6,69 s** para su reimplementación de Extreme Points `V` | No se sabe el `n` de GENPACK ni si su versión incluye la capa de estabilidad. **Medir el nuestro.** No comprometer un presupuesto de tiempo con ninguno de los dos números. |
| C2 | **Orden de la lista de puntos extremos** | Teorema 1 del paper: *"by non increasing values"* `V` | Algoritmo 1 del mismo paper: *"non-decreasing"* `V` | Es una contradicción **interna del paper**, no entre síntesis. La práctica correcta es **no decreciente** (se elige el punto de menor z, luego y, luego x) `I`. Se fija con test de instantánea, no leyendo. |
| C3 | **Umbral de centro de gravedad vertical** | CTU Code Anexo 7 §1.11, texto oficial: *"below **half** the height of the cargo space"* → 50% `V` | Fuentes comerciales secundarias citan 40% `V` (que existan, no que sean normativas) | El 40% **no aparece en el CTU Code**. Usar 50% como umbral citable y 40% como advertencia interna sin atribuírselo al CTU. |
| C4 | **Carga de piso del contenedor** | CTU Code: **0,5 kN/cm²** de carga **concentrada** por rueda de montacargas, que limita bultos a ~3–3,5 t `V`; y payload *"if homogeneously distributed"* `V` | gocubic (comercial): **1.450 kg/m²** uniforme `V`; otra fuente cita 1.500 kg/m² | El CTU **no da un kg/m² uniforme**. Modelar presión concentrada por bulto + bandera de "requiere vigas de reparto", no un kg/m² plano. El número uniforme exigiría ISO 1496-1, que es norma de pago. |
| C5 | **Dimensiones de contenedor** | Gateway: 20' = 5,90 m / 28.200 kg `V` | 3DContainer: 589 cm / 21,7 t `V`; SeaRates: 5.890 mm / 28.230 kg `V` | **No existe tabla canónica.** DTD fija la suya, la versiona como dato y la trata como configuración, no como constante. |
| C6 | **Controles de cámara de EasyCargo** | Artículo 92 del centro de ayuda llama "pan" al botón izquierdo `V` | Artículos 12 y 56 y el Handbook v7 dicen: izquierdo = rotar/orbitar, derecho = pan `V` | Gana B (tres fuentes contra una, incluido el manual oficial). El artículo 92 tiene un error editorial. |
| C7 | **"EasyCargo no tiene atajos de teclado"** | La síntesis funcional afirma *"100% mouse: cero atajos"* `I` | La misma síntesis documenta que **Delete y Backspace borran** en el editor manual `V` | La afirmación absoluta es falsa. Lo correcto: **no hay un esquema de atajos**, hay dos teclas destructivas. Cube-IQ sí tiene 20 comandos de teclado `V` y Cargo-Planner también `V`. |
| C8 | **Quién tiene grupos de prioridad** | La matriz competitiva de 11 apps dice que **solo CargoWiz y EasyCargo** los tienen `V` | Cargo-Planner tiene `group_by` `V`, MaxLoad tiene *Maximum Priority Overlap* en pulgadas `V`, packVol tiene `max mixing` numérico `V` | **La matriz la publicó EasyCargo: es parte interesada.** No usarla como mapa del mercado. Al menos cinco herramientas tienen alguna forma de agrupamiento con prioridad. |
| C9 | **Cuántas reglas de restricción tiene Cargo-Planner** | Las fuentes citan, según la página, "~34", "30+", "~29" y "~25 condiciones de `LoadRule`" `V` | — | Conteo inconsistente entre páginas del mismo vendor. Se cierra en 10 minutos leyendo el OpenAPI público (§8). |
| C10 | **Rejilla: ¿sí o no?** | La síntesis visual recomienda copiar la **rejilla de 20 cm** de EasyCargo `V` | La síntesis algorítmica dice **no discretizar en rejilla**: *"when cargo stability is enforced, grids of points may lead to the loss of stable packings"* `V` | **No es contradicción: son capas distintas.** La rejilla va en el **editor visual** (un `<pattern>` SVG, ayuda de escala). El **solver nunca discretiza**. Escribirlo así en el código para que nadie lo "unifique" después. |
| C11 | **Licencia de boxologic** | Suposición previa: GPL | Verificación: `src/binpack.c` **no declara licencia ni copyright** y el README tampoco `V` | **Leer sí, portar no.** Queda bloqueado para copiar código hasta resolverlo. |

---

## 1. Cómo se ve y cómo se usa EasyCargo — reconstrucción

### 1.1 La premisa que explica toda la interfaz

**EasyCargo no es 3D web nativo: es una compilación de Unity 3D exportada a WebGL.** `V` — confirmado por tres vías independientes: nota de versión del 4-ago-2020 (*"Faster process of loading Unity settings"*), FAQ oficial sobre el "Unity Web Player" en Firefox, y el origen de la empresa (Bee Interactive s.r.o. venía de juegos publicitarios).

Consecuencias verificadas, todas citables:
- Requisito de **2+ GB de RAM** y *"recomendamos una computadora de no más de 4 años"* `V`
- Conexión obligatoria, sin modo sin conexión en escritorio `V`
- Una versión completa (21-oct-2024) cuyo único contenido fue *"Performance, memory (RAM) consumption and startup time has been significantly improved"* `V`

**Corolario duro:** el solver corre **dentro del navegador del cliente**. Por eso su API **no puede calcular** (§2.9). Esto no es una decisión de producto reversible: es arquitectura. `I` pero con altísima confianza, porque explica simultáneamente los requisitos de RAM, la ausencia de cálculo por API y el modo sin conexión limitado a "ver planes ya calculados".

**Lo que significa para DTD:** el diferencial estructural de un motor server-side en Next.js no es "mejor código" — es que **hacemos algo que ellos no pueden hacer**, no algo que no quisieron hacer.

### 1.2 Distribución de pantalla

Una sola pantalla, seis paneles, barra de pestañas arriba. El marketing insiste: *"displays the arrangement of cargo items and the results all on one screen, which means there's no need to toggle between multiple tabs"* `V`.

```
┌─ PESTAÑAS ─────────────────────────────────────────────────────────────────┐
│ EasyCargo · Shipments & Reports · Cargo items · Cargo spaces · Users ·      │
│ Licenses · User Profile      [rol User: solo las 2 primeras pestañas]       │
├──────────────┬──────────────────────────────────────────┬──────────────────┤
│ ENTRADA DEL  │  INFO DEL ESPACIO DE CARGA (3 líneas)     │ PANEL DE VISTAS  │
│ ENVÍO        │  1) datos del espacio VACÍO               │ (sup. der.,      │
│ (izquierda)  │  2) datos del envío                       │  desplazable)    │
│              │  3) espacio ocupado + metros libres +      │                  │
│ ☰ menú junto │     desplazamiento longitudinal y lateral  ├──────────────────┤
│ al nombre    │  al pasar el cursor sobre el icono → %     │ LISTA DE         │
│              ├──────────────────────────────────────────┤ ESPACIOS         │
│ □ + ítem     │                                          │ recientes + "+"  │
│ Grupos "+"   │        ESCENA 3D                         │                  │
│ (máx. 50)    │        (fondo blanco puro en el reporte) │ ⬆ al colapsar,   │
│              │                                          │ el panel pasa a  │
│ LISTA DE     │                                          │ DISTRIBUCIÓN     │
│ RESULTADO    │                                          │ DE PESO          │
├──────────────┴──────────────────────────────────────────┴──────────────────┤
│ AJUSTES DE CÁLCULO  [camión: tamaño usable] [balanza: respetar/ignorar peso]│
│ [◎ centrar masa] [▦ grupos de prioridad → 4 modos]  [✋ carga 100% manual]   │
│                                          ( Load )   ⬡cine ⬡impresora ⬡share │
│                       [solo manual: 🧲 imán · ⟳ autorrotación, inf. der.]   │
└────────────────────────────────────────────────────────────────────────────┘
```

**Marcado honesto:** el diagrama completo es `I`. Está reconstruido del recorrido narrado (artículo 88) + Handbook v7 + artículos 55/56/58/893. **No existe en el material recopilado una sola captura de la pantalla principal completa con las tres columnas juntas.** Los elementos individuales sí están verificados uno por uno; su posición relativa es reconstrucción.

Dos precisiones verificadas que corrigen la reconstrucción ingenua:
- La mano de "carga manual" y la barra de ajustes comparten franja a la izquierda del botón Load; la ayuda es ambigua sobre el orden exacto `V` (la ambigüedad, no la posición).
- **Los interruptores de multicontenedor NO viven en la barra inferior.** Viven en el diálogo del reporte básico `V`. Esto importa: revela que el multicontenedor de EasyCargo es una función del reporte, no del motor (§2.6).

### 1.3 El grupo de acción (única lectura sobre captura real) `V`

- **Botón `Load`**: círculo grande gris oscuro (~#5a5a5a) con anillo blanco, palabra en blanco, tipografía condensada, esquina inferior derecha.
- A su derecha, **tres botones hexagonales blancos con icono negro, apilados en zigzag**: cámara de cine antigua = reporte paso a paso · impresora = reporte imprimible · tres nodos = enlace público.
- A la izquierda del círculo, **botón circular blanco con mano sobre una caja** = carga 100% manual desde cero.
- Fondo del panel: gris claro con textura sutil de puntos.
- Junto a Load, iconos con flecha para borrar una caja o todas.
- Pulido documentado (dic-2024): *"Wider clickable area of Load Setting options"*, *"Better style for disabled buttons"* `V`.

### 1.4 Tipografía

- **Noto Sans**, cambio explícito en la versión del 19-ago-2025 `V`. La razón es cobertura de glifos (japonés, vietnamita, árabe, catalán; arrastraron fallas con caracteres vietnamitas).
- **Superíndice real para m³** (8-ene-2026: *"Superscript font for volume data (m³)"*) `V`.
- Problema recurrente y directamente aplicable a nosotros: *"Load Settings labels can display longer text"*, *"Wider Main Menu to accommodate longer localizations"*, y en 2020 *"Corrected sizes inside the form of a new Cargo space for long-text localizations (Polish and others)"* `V`.

**Para DTD:** el español revienta diseños pensados en inglés. "Grupos de prioridad" mide casi el doble que "Priority groups". Todo rótulo de la barra de ajustes tiene que probarse en español antes del commit. Y la fuente es Archivo, no Noto Sans — pero el problema de longitud es el mismo.

### 1.5 Cómo se ven las cajas

| Elemento | Descripción | Ev. |
|---|---|---|
| Color | Uno por **tipo de ítem**, saturado. Paleta de preajustes + campo libre de código hex. Persistido como campo `color` (cadena) **en el reporte**, no derivado en el cliente | `V` |
| Etiqueta | Campo `sign` = **la LETRA** (A, B, C…) impresa sobre la caja. Casilla por ítem: mostrar solo la letra en vez de la descripción completa | `V` |
| Columna de color | En la lista de entrada, cada tipo tiene una **columna vertical de color rotulada con su letra**; al hacer clic abre el selector. Cambiarla *"propaga a la visualización inmediatamente"* | `V` |
| Base de la caja | *"The dark bar indicates the bottom of the box"* — barra oscura en el icono del editor | `V` |
| Paso actual (paso a paso) | Color saturado **+ aristas de alambre visibles + el nombre impreso en su cara** | `V` |
| Resto de la escena en paso a paso | **Desaturado casi a blanco** | `V` |
| Dos paletas separadas | Saturada **por ítem** y pastel **por grupo**; el clic en la leyenda alterna el coloreado de la escena entre ambos niveles | `V` |
| Selección múltiple | **Amarillo = seleccionado · Azul = candidato agregable** | `V` |
| Posición inválida | **Marco rojo** | `V` |
| Sobrecarga | Ítems cargados por encima del plan → **negrita** en la lista de resultado (ago-2025) | `V` |

### 1.6 Cómo se ve el contenedor

- **Casi fotorrealista**: paredes corrugadas con sombreado, cabina, guardafangos, ruedas con llanta detallada y sombra de contacto suave sobre suelo blanco (8-ene-2026: *"Enhanced graphics of cargo space cabin, mudguards & shadows"*) `V`
- Color del camión configurable por el usuario (ene-2026) `V`
- **En modo manual: cuadrícula de piso donde cada cuadro = 20 cm** (7,874 pulgadas) `V`
- **En modo manual: los huecos libres se pintan como volúmenes verdes** (*"Green Free spaces in Manual Load are now without glitching when viewed from a distance"*) `V`
- Modo *"see through cargo"*: transparencia tipo rayos X `V`
- Escena del reporte sobre fondo blanco puro `V`

**Tensión de diseño que hay que nombrar:** invierten versiones enteras en realismo del vehículo, que no comunica información, mientras el dato útil lo transmiten por desaturación + chip de color + letra. **La parte informativa es 100% replicable en SVG y es barata. El realismo del camión no vale la pena y encima es donde ellos gastan.** `I`

### 1.7 La leyenda del reporte — verificada sobre GIF oficial `V`

Barra superior gris claro. Izquierda: dos casillas, `Shipment Legend` y `Step Legend`. Derecha: dos iconos monocromos, hoja con "PDF" e impresora.

Tabla, **una fila por tipo**, columnas en este orden exacto:

```
[CHIP CUADRADO DE COLOR con la letra en blanco] · nombre · cantidad · largo · ancho · alto · peso · [3 pictogramas]
```

Ejemplo real de la captura: chip `E` naranja, chip `F` amarillo; "Box 5", 18, 120,0 / 120,0 / 55,0, 12600,0.

Los tres pictogramas: flechas hacia arriba (apilable), reloj de arena tachado (no volcar), paraguas / este lado arriba. **Inactivos en gris claro, activos en negro**, con globo de ayuda (ago-2020) `V`.

**Esta fila es el entregable más copiable de todo el dossier y no necesita una sola línea de 3D.**

### 1.8 Distribución de peso — semántica cromática completa `V`

| Señal | Significado |
|---|---|
| Flecha de eje **verde** | Dentro de límite. Es **clicable** y despliega tres valores: peso máximo permitido, peso actual, peso mínimo del espacio vacío |
| Flecha de eje **roja** | *"in case the weight limit is not respected, the green weight distribution arrows turn into red ones"* |
| Flecha de eje **azul** | **Carga negativa**: *"occurs when the cargo is unevenly distributed – for example, when the weight on one side of the cargo area causes the other side to lift as a result of leverage"* |
| **Parte transparente** de la flecha | El **margen restante** hasta el máximo |
| Número **morado** | Metros de carga disponibles = `free_distance` |
| Número **amarillo** | Desplazamiento longitudinal = `forward_shift` |
| Número **verde** | Desplazamiento lateral = `left_shift` |

**Cobertura legal permanente** `V`: desde dic-2019 hay un *"Weight Distribution Disclaimer text at the bottom of the screen"* — *"even the best effort is done to provide a precise calculation… still, it is only the mathematical simulation"*. Se les cayó por accidente en una versión y **lo reintrodujeron por parche urgente** el 10-abr-2020. Esa reacción es la señal de dónde está el riesgo legal del producto. **Copiar el patrón tal cual en toda superficie de DTD que muestre centro de gravedad, ejes o VGM.**

### 1.9 Semántica de color de interacción — cinco usos, no cuatro `V`

1. **Verde (áreas/volúmenes)** = destino válido al mover una caja
2. **Rojo (marco)** = posición inválida
3. **Rojo (número)** = en multicontenedor, los ítems pendientes no caben en un solo compartimento
4. **Amarillo (cajas)** = seleccionado · **Azul (cajas)** = candidato agregable
5. **Flechas de eje**: verde / rojo / azul (§1.8). Filas con error de importación: rojo

**No hay que inventar vocabulario. Está probado en producción y el usuario de la industria ya lo lee.** Los tonos exactos salen de los tokens `var(--*)` de DTD, no de los suyos.

### 1.10 Vocabulario de estado de la lista de entrada — seis estados por tipo `V`

1. Todos los ítems de este tipo se cargaron
2. **Algunos** no se cargaron
3. **Ninguno** se cargó
4. **Contador**: "2 de 31 ítems de este tipo se cargaron"
5. **Signo de interrogación (?)** = el ítem se modificó de forma que exige recálculo
6. Icono de **ítem excluido** del plan

Además: un punto verde por tipo; al pasar el cursor a su derecha aparece un **"+"** para añadir piezas por encima de la cantidad original, **solo si la lista de ítems individuales está colapsada** `V`.

### 1.11 Modelo de invalidación campo por campo — el contrato de reactividad `V`

| Campo editado | Efecto |
|---|---|
| **Nombre** | *"immediately appears on the boxes in the cargo space"* — cosmético, en vivo |
| **Cantidad** | Se refleja al instante en el panel de información — contable |
| **Peso** | *"will trigger an automatic recalculation in the cargo space info panel"* — recalcula métricas, no el plan |
| **Dimensiones** | *"requires items to be removed or reloaded"* → marca los afectados con **?**. Invalida geometría |
| **Restricciones** | Se muestran al instante en las cajas **pero** *"still requires a manual recalculation of the entire loading plan"* |

**Sin esta tabla implementada, la herramienta miente.** Es el contrato de feedback mínimo y es barato.

### 1.12 Cámara `V` (con C6 resuelta)

- **Botón izquierdo sostenido + mover = rotar/orbitar**
- **Botón derecho sostenido + mover = desplazar (pan)**
- **Rueda = acercar/alejar**
- Panel táctil: arrastrar = rotar · clic de dos dedos + mover = desplazar · dos dedos = acercar
- **Vistas preestablecidas** en el panel superior derecho, desplazable desde abr-2020 porque en monitores pequeños tapaba los botones
- Clic en la lista de resultado → **localiza el ítem en la escena**; lo mismo a nivel de grupo entero
- Perfil de usuario: ajustes de velocidad de zoom y movimiento del ratón (abr-2024)

### 1.13 Editor manual — mecánica exacta `V`

1. **Clic izquierdo** toma la caja
2. **Áreas verdes** = destinos válidos; se apunta y **clic de nuevo** deposita
3. Se puede **sostener el botón izquierdo para rotar la cámara mientras se lleva la caja**
4. **Enganche automático** a la caja más cercana; **el acercamiento modula la distancia de imantado**: *"you can zoom in and snapping distance will decrease"*
5. **Clic derecho** conmuta a modo manipulación: aparecen **flechas** sobre la caja; clic en la flecha del eje rota; segundo clic derecho vuelve a mover
6. **Marco rojo** = inválido
7. **Delete** o **Backspace** borran; hay botón para vaciar todo
8. Reinsertar: **icono de flecha negra** en la lista de resultado
9. **Arrastrar y soltar directo** desde el panel de entrada hacia el espacio de carga

**Interruptores solo del modo manual, esquina inferior derecha**: imán (apagar enganche) y autorrotación (*"autorotation prioritizes upright position"*) `V`.

**Selección múltiple** `V`: clic en la caja **inferior** de una columna → toda la columna en **amarillo**; segundo clic → las demás en **azul**; clic sobre las azules las pasa a amarillo; un clic final confirma. Sobre el conjunto se puede mover, borrar y rotar. Sin selección por rectángulo.

### 1.14 Barras de utilización — laguna declarada

**Confirmado que los datos existen** `V`: el panel de información muestra **% de espacio usado y % de capacidad de peso**, y al pasar el cursor sobre el icono del espacio cargado aparece el porcentaje de uso.

**Ninguna fuente textual dice si eso se dibuja como barra, anillo o solo texto.** Solo se cerraría con una captura. Dato lateral: el blog de EasyCargo recomienda dejar ~10% de espacio libre como colchón `V`, lo que sugiere que podría haber zona de umbral `I`.

Referencias alternativas para diseñar la nuestra, todas `V`:
- **SeaRates devuelve DOS proporciones independientes**, `volumeRatio` y `weightRatio` (0–1). **Son dos barras, no una.**
- SeaRates v1 devolvía además `limits` = *"Limiting factor description"* — **qué te frenó: volumen, peso o altura**. Una línea de texto, valor operativo enorme, casi nadie lo expone.
- Cargo-Planner tiene un bloque de reporte dedicado `Container Utilization`.
- Cubic publica umbrales de negocio: LCL por debajo de 30%, FCL económico por encima de 50%, y zonas de advertencia/peligro para el balance 60/40.

---

## 2. Inventario de funcionalidades — EasyCargo vs. competencia

Convención: **[EC]** lo tiene EasyCargo · **[NO-EC]** solo competidores (se nombra cuál) · **[EC-débil]** lo tiene degradado. Todo el inventario es `V` salvo marca contraria.

### 2.1 Modelo del ítem

| Función | Estado |
|---|---|
| `group_name`, `description` (0–160), `pieces` (0–10.000), `width/height/length`, `total_weight` | **[EC]** |
| `is_stackable`, `is_tiltable`, `is_rotable` — **solo tres booleanos**, mostrados en negativo ("Do not tilt / Do not stack on this cargo item / Do not rotate") | **[EC]** |
| Peso total **o** por pieza (*"always use only one type of value"*) | **[EC]** |
| Excluir ítem del cálculo automático dejándolo disponible para colocación manual | **[EC]** |
| **Capacidad portante (kg admisibles encima)** | **[NO-EC]** — Cargo-Planner `max_load`, Goodloading `maxWeightOnTop`, Cube-IQ *Supported Weight* **por orientación**, MaxLoad *Maximum Stack Weight*, packVol lo convierte a **tensión kg/área** |
| **Máximo de capas** | **[NO-EC]** — Cargo-Planner (0–255), Goodloading (`stacking` entero), CargoWiz *Max Can Stack* (**incluye la base**), packVol `xs` |
| **`bottom_only` (debe ir al piso)** | **[NO-EC]** — Cargo-Planner, CargoWiz, CubeMaster (*Bottom Only / No Bottom / Best Fit*), MaxLoad con **5 niveles** (Must / Must Not / Best Fit / **Prefer On Floor** / **Prefer On Top**) |
| **Factor de soporte parcial (%)** | **[NO-EC]** — Goodloading `pctSupport`, Cargo-Planner *allowed overhang*, CubeMaster *Min support rate*, packVol `g_back_face_perc` (por omisión 30) |
| **Orientaciones como máscara de bits 1–63** | **[NO-EC]** — Cargo-Planner (1=Longship, 3=Rotatable, 63=Tiltable) y packVol, **que además aplica máscaras a cada restricción por separado** |
| **Matriz de apilado tipo-sobre-tipo** | **[NO-EC]** — MaxLoad (*Stack Matrix*, 4 códigos y precedencias documentadas), Cube-IQ (3 matrices), packVol (**excepciones por cara de contacto**), CargoWiz (*Taboo-On-Top*, prohibición de **columna** no de contacto), Goodloading `boxesBelowAllowed` |
| Clase / segregación de mercancía incompatible | **[NO-EC]** — Cargo-Planner (`class_id` + tabla), Cube-IQ |
| Destino por ítem (multiparada) | **[NO-EC]** — Cargo-Planner (`destination` + lat/lon + rutas), Goodloading (`stops[]` con coordenadas), CubeMaster, packVol (`ds` con cuatro niveles) |
| Holgura para trincas | **[NO-EC]** — Cargo-Planner `Margin`, MaxLoad `Slack` |
| Metadatos libres de ida y vuelta | **[NO-EC]** — SeaRates `attr` (*"Any data, copied to results"*), Cargo-Planner `metadata` |
| **Formas no cúbicas** | **[NO-EC]** — declaración textual de EC: *"only works with cuboid rectangular shapes… Other shapes are not supported yet"*; cilindros son *"rather a long-term goal"*; **triángulos descartados explícitamente**. Sí lo tienen: Cargo-Planner (caja/cilindro/cilindro hueco/complejo + **espacios interiores**), SeaRates (rollos/barriles/tubos/sacos/bolsones + **empaque hexagonal**), Cube-IQ (incluye **forma en L**, T, trapezoidal), MaxLoad (cilindros con patrones None/Tight/Spread/**Pyramid**), Goodloading |

### 2.2 Modelo del espacio de carga

- **[EC]** Dimensiones **internas** con advertencia explícita (*"Do not confuse them with the external dimensions. If the floor slopes, fill in the lesser of the clearances"*), `max_load` (subido de 50 t a **99 t** el 29-may-2025), volumen, tipo, **tara**, y por eje: distancia desde el frente, tara del eje y carga máxima. Carga de perno rey para camión + semirremolque.
- **[EC]** **45 espacios predefinidos**, 12 de ellos tipos de contenedor. Familias: contenedores, cabinas de día (2–3 ejes), plataformas (1–3), paletas (**EPAL 1/2/3/6 + US**), cabinas dormitorio, camiones/remolques, semirremolques, tractores. Camiones estadounidenses desde ene-2026.
- **[EC]** Filtros por tipo/popularidad/nombre/fecha/autor, favoritos con estrella, duplicar, editar, crear a medida. **Solo rol Administrator**; para rol User la sección no existe.
- **[EC]** Validación de compatibilidad tractora↔semirremolque (ene-2026).
- **[NO-EC]** **Dimensiones de PUERTA modeladas aparte del interior** — Cargo-Planner (`HoldDoor` con alto, ancho y `longside`), Gateway Lines (tabla ISO 668 con abertura por tipo). **Es la restricción que decide de verdad si una pieza alta entra.**
- **[NO-EC]** Límites `max_length/max_width/max_height` **separados** del casco (Cargo-Planner).
- **[NO-EC]** **Zonas y espacios inutilizables** dentro del contenedor (Cube-IQ, pestañas *Zones* y *Unusable Spaces*), **paso de rueda con 4 números** y obstáculos fijos (CBM3).
- **[NO-EC]** Un contenedor con **varios espacios** para camión+remolque o compartimentos (SeaRates `spaces`, Goodloading `parts[]`: *"a road train will have two parts"*).
- **[EC-débil]** Open-top y flat-rack **no existen como espacios predefinidos**: se emulan con el truco de *Loading size* (§2.4).

### 2.3 Motor y algoritmo

- **[EC]** Heurística declarada verbatim: *"By default, the order of loading is defined by the size of items: **the largest boxes are loaded first**"* + *"the software loads the container **from the front to the back**"*. Es First-Fit-Decreasing por tamaño con barrido longitudinal, construcción por muros. `V`
- **[EC]** **Sesgo oculto a apilar en altura** — el hallazgo más importante del Handbook (p.35) `V`: *"EasyCargo **primarily stacks the items up heightwise in order to use as little floor space** of the cargo space as possible. To prevent this, you can either set the items as non-stackable, adjust the load plan manually, or divide the items into groups and disable the stacking of groups."*

  **Su función objetivo real no es maximizar volumen: es minimizar huella de piso. Y está cableada, no es parámetro.** Esto es directamente perjudicial para travesía marítima (torres altas = peor estabilidad + peor descarga).
- **[EC-débil]** **Dos algoritmos distintos**: contenedor/camión = frente→fondo; paleta = **capas de abajo hacia arriba con capas idénticas**, pero *"you can only load **one type of item** at a time"*; con mezcla de tipos **revierte al secuencial**. `V`
- **[EC]** **~7% de mejora promedio de uso de espacio** — su propia cifra de venta `V`. **La vara real no es 30%.**
- **[NO-EC]** **Objetivo secundario declarativo** — Cargo-Planner `secondary_goal` ∈ {minimize_length, minimize_height, stability} + `load_style` ∈ {auto, bottom_up, front_to_back} + `stack_iterator` ∈ {auto, row_loading, column_loading, stack_loading}; PTV `focus` ∈ {BUILD_LAYERS, REDUCE_LOADING_METERS}; SeaRates `loadType` ∈ {auto, wallLength, wallWidth, floor}; **CBM3 genera TRES planes comparables** (Max Volume / Easy Loading / Best Balance); MaxLoad nombra 5 algoritmos en su interfaz.
- **[NO-EC]** Tolerancias numéricas del motor — Cargo-Planner `height_tolerance` **5 mm por omisión**, `error_margin` −50…+50%, `max_calculation_time` 0–15 s **con 2 s por omisión**; Cube-IQ *Maximum run time* + *Maximum non-improving iterations* (**y admiten que su motor es no determinista**); MaxLoad con deslizador velocidad↔espacio 1..200 y botón de parada; CargoWiz con número de intentos.
- **[NO-EC]** **Optimización global multicontenedor** — Cube-IQ tiene **7 reglas de selección** de equipo (Best fill, Largest first, Minimum overall cost, One container only, y tres más); Cargo-Planner tiene `cost_function`, `max_cost`, `greedy_container_selection`; packVol tiene el método `mbin`.
- **[NO-EC]** **Entre 25 y 34 reglas de restricción expresables** (Cargo-Planner; ver C9 sobre el conteo): `cannot_be_loaded_with`, `must_be_on_top_of`, `can_only_support`, `must_be_loaded_along_centerline`, `must_touch_side`, `must_be_loaded_in_zone`, `must_keep_distance`, `group_by`, `set_as_fillers`, `allowed_oog`, `must_load_with_pattern`, `minimize_mixing`, `require_front_support`… **Implementar 6–8 de estas ya supera a EasyCargo entero.** `I` pero sólido: EasyCargo tiene tres booleanos.
- **[NO-EC]** **Centro de gravedad como RESTRICCIÓN**, no como reporte — Cube-IQ (rango mín/máx en % del largo, con dos ejemplos numéricos), Cargo-Planner (`cog_limit`).

### 2.4 Ajustes de cálculo `V`

- **[EC] `Loading size` (icono de camión)** — ajusta el tamaño **usable** del espacio por envío en las tres direcciones; incremento relativo (prefijo `-` para reducir), cambio absoluto y **reinicio**. Usos documentados por el propio vendor: voladizos, forzar carga por capas bajando el techo, **simular open-top** (subir altura) y **flat-rack** (subir altura y ancho). Ejemplo oficial: paleta 120×80 con 40 cm de voladizo pasa de 8 a 16 cajas por capa.
- **[EC]** `respect/ignore weight limits` — **se desactiva automáticamente con más de 10.000 ítems**.
- **[EC]** `shift loaded items to mass center` — realinea la carga con el centro del espacio; *"can lead to loading more items even within the specified weight limits"*. El desplazamiento sale impreso (`forward_shift`/`left_shift`).
- **[EC]** Botón de grupos de prioridad → los 4 modos.

### 2.5 Grupos de prioridad

**Semántica LIFO explícita** `V`: *"Group 1 goes into the truck FIRST. This means Group 1 will be placed **deepest** in the cargo space"* / *"the first priority group will be loaded first and **unloaded last**"*. Hasta **50 grupos**. Modelan orden de paradas o separación por cliente.

**Los cuatro modos, rótulos verbatim** `V`:

| Modo | Semántica | Costo declarado |
|---|---|---|
| `Respect separation into priority groups` (por omisión) | Carga en orden de creación **pero permite** que grupos posteriores se apilen sobre los anteriores | 0 |
| `No stacking of priority groups allowed` | Impide que el grupo 2 se apoye sobre el 1 (frágiles, sensibles al peso) | *"will slightly reduce the usable cargo space"* |
| `Split of priority groups with an invisible wall` | Divide el espacio en **secciones físicas**, una por grupo; permite división real con barras de apoyo (peligrosos, alta seguridad, clientes que no deben tocarse) | idem |
| `Ignore separation into priority groups` | Calcula sin limitación **sin deshacer** la asignación de grupos (para ver capacidad teórica) | 0 |

Otros detalles verificados: asignación por cuatro vías (creación directa, arrastrar y soltar, base de datos de ítems, importación Excel); renumeración automática al borrar **manteniendo el color**; clic en el grupo de la leyenda resalta ese grupo; desde ene-2022 *"potentially wrong usage of Priority Groups is detected, and the app provides help"*. **Trampa:** *"When deleting a group, the items in the given group will also be deleted!"*

**[NO-EC]** Grados de mezcla intermedios: CargoWiz tiene **tres** (`Mix` / **`Mix if Within`**, mezcla acotada a una distancia / `No Mixing`); MaxLoad tiene `Maximum Priority Overlap` **en pulgadas**; packVol tiene `max mixing` numérico donde **vacío = minimizar solape y cero = prohibirlo**.

Sobre quién más los tiene, ver **C8**: la matriz que dice "solo EC y CargoWiz" la publicó EasyCargo.

### 2.6 Multicontenedor

**[EC-débil] No es optimización, es desborde secuencial** `V`: dos casillas en el diálogo del reporte (`Load remaining items into additional cargo spaces` + `Remove loaded items from input list`), llena un contenedor completo antes de pasar al siguiente **siempre del mismo tipo**, y tope en **10 reportes** (9 adicionales). Para mezclar tipos hay que desmarcar y elegir a mano. **No decide qué mezcla de 20'/40'/40HQ minimiza costo.**

### 2.7 Persistencia, importación/exportación y colaboración `V`

- Autoguardado **cada 2 min**, solo **10 respaldos** retenidos y **privados del usuario**; guardados manuales visibles para otros administradores; **999 versiones** por envío; envíos ilimitados; **envío por omisión** como plantilla de arranque; archivado + borrado automático; borrar una versión (verde) vs. todas (rojo).
- Base de datos de ítems: **1.000 plantillas** por cuenta, `description` **única** ignorando mayúsculas y espacios, **autocompletado con precarga de todas las propiedades** + confirmación con Enter; dos modos de importación (*Import new* vs. *Replace all*, este con confirmación extra).
- **Importación Excel**: plantilla descargable **solo desde dentro de la app**, métrica o imperial; regla dura *"Never change the names of the Excel sheet tabs, nor adjust columns A to J"* → **10 columnas fijas**; .xlsx (Excel 2007+); **250 tipos por importación**; casilla *"Also import items with zero count"*; ítems iguales **se fusionan**; al importar a la base de ítems **no entran ni grupos ni cantidades**; solución oficial ante fallo: subir a Google Sheets y volver a bajar.
- **El Excel exportado es reimportable** (ciclo completo de ida y vuelta).
- Autenticación única con Google y Microsoft. Integración SAP vía terceros ("status C"), aplicación de Make.com.
- **[NO-EC]** Mapeo manual de columnas para archivos con esquema arbitrario (CubeMaster, asistente de 3 pasos).

### 2.8 Compartir y consumo en piso `V`

- **Enlace público, dos sabores**: (a) envío + reporte = visor 3D interactivo + paso a paso + reporte imprimible, **sin cuenta**; (b) **"Report only"** optimizado para móvil (sin 3D, solo PDF con exportación a Excel). URL corta observada: `s1.easycargo3d.com/View/{código}`. Se crean por API desde ene-2024.
- **Atadura dura**: *"the link only works if there is an **active license** in the company under which Public Link was created"* — **si vence la licencia, los enlaces ya compartidos con clientes mueren.**
- **Aplicación de tableta Android/iPad (ago-2025) SOLO VISOR**: no crea ni edita. Ve planes guardados, abre enlaces públicos, **reproduce la animación paso a paso**, ve distribución por eje, peso, volumen y espacio libre. **Funciona sin conexión una vez abierto el plan.** Público declarado: *"warehouse staff, drivers, and logistics managers"*.

  **Esto valida exactamente el patrón que DTD ya tiene en producción** (PWA de operario con QR). No hay que inventar la categoría: hay que ganarla con el retorno de datos que ellos no tienen.

### 2.9 API — la debilidad estructural `V`

- Base `https://go.easycargo3d.com/api/v1`. Autenticación `POST /authentication` {username, api_key, bind_token_to_ip} → testigo válido **1,5 h**, cabecera `X-AuthenticationToken`, **atado a la IP** por omisión. Límites **60 peticiones/60 min y 480/24 h**. Paginación desplazamiento/límite (máx. 100) + `X-Total-Count`. Endpoints: shipments, shipment-inputs, shipment-public-link-inputs, shipment-reports, **shipment-output-placements**, cargospaces (POST solo acepta `type=1`), users, cargo-item-templates. La clave de API **no es autoservicio**.
- **El agujero**, en negrita en su propia documentación: ***"The load planning calculation cannot be executed through the API."*** El usuario tiene que entrar a la aplicación para que se calcule.

  **Esto descalifica a EasyCargo como motor de fondo aunque se pagara la licencia.** Es la consecuencia directa de §1.1.
- **[NO-EC]** **Cálculo sin interfaz, de verdad** — Cargo-Planner `POST /api/2/calculate/` **más edición incremental por API**: `insert_items`, `load_into_space`, `move_items`, `remove_items`. **Eso es literalmente el caso híbrido de DTD**: el operario ya cargó tres paletas escaneadas y el motor replanifica el resto. También PTV (modo asíncrono con sondeo), SeaRates (`POST /stuffing/api`), MagicLogic BlackBox REST `/sync` y `/async`, sin estado.

### 2.10 Escala, roles y precio `V`

Más de 10.000 ítems de **250 tipos**; 50 grupos; 45 espacios; 999 versiones; 1.000 plantillas; **solo dos roles** (Administrator / User); 14–17 idiomas según la página; 17 monedas con fuerte presencia latinoamericana; prueba de 10 días sin tarjeta. Precio: boleto de 24 h $9,70 (paquetes mínimos de 10, válidos 5 años) · mes $79/usuario · año $799 ($67/mes) · 30% desde 3 usuarios · Enterprise 30% sobre más de $2.400. **Una licencia se comparte pero no en simultáneo.**

### 2.11 El hueco de mercado — donde DTD ya está parado

Dos pasadas de búsqueda: los siete planificadores revisados (EasyCargo, Cube-IQ, CubeMaster, CargoWiz, packVol, MaxLoad, Goodloading) son **exclusivamente de planificación previa**. **Ninguno documenta escaneo, foto, confirmación del operario en piso ni reconciliación plan-vs-real.** `V` en cuanto a lo revisado.

Lo más cerca: EasyCargo genera paso a paso + enlace público para el galpón, y Cube-IQ parte la salida por producto — **ambos son instrucciones de ida, sin retorno de datos** `V`. La verificación por escaneo sí existe pero en el mundo WMS/TMS **sin geometría 3D** (Scandit, CodeREADr, CartonCloud, Track-POD) `V`.

**Las dos familias no están unidas en ningún producto documentado.** `I` — no se puede probar una no existencia. Queda por revisar el mundo WMS de primer nivel (Körber, Blue Yonder, Manhattan) que integra el motor Cube-IQ y sí tiene módulos de escaneo.

---

## 3. El reporte de salida, en detalle

### 3.1 Los cinco canales `V`

| # | Salida | ¿Se guarda en servidor? | Cómo se dispara |
|---|---|---|---|
| 1 | Vista 3D interactiva | — | en la aplicación |
| 2 | **PDF imprimible** (Basic View / Current View) | **Sí, y queda buscable** | icono de impresora |
| 3 | **Reporte paso a paso** | **No** (hay que imprimir o bajar PDF) | icono de cámara de cine |
| 4 | **Excel, 3 pestañas** | — (reimportable) | desde el reporte imprimible |
| 5 | **Enlace público** (2 sabores) | — | icono de compartir / menú / Shipments & Reports |

### 3.2 PDF básico — contenido exacto `V`

Verbatim de la fuente: contiene *"**two views of the loading area (right and left)**, the name of the cargo space (with dimensions), the weight of the load, the volume"*, el espacio libre restante y **la lista completa de ítems cargados con sus restricciones**.

**Encabezado y resumen**
- Nombre del espacio **con sus dimensiones**
- **Peso total** (`total_weight`) · **Volumen total** (`total_volume`) · **% de espacio utilizado**
- **Los tres números de espacio libre**:
  - `free_distance` = *"Free length from the last cargo item to the back of the cargo space"* (el número morado)
  - `forward_shift` = *"Shift of cargo items from front of cargo space"* (amarillo)
  - `left_shift` = *"Shift of cargo items from left side of cargo space"* (verde)
- Logo de la empresa, opcional (ago-2023)

**Imágenes**
- **Dos vistas renderizadas**: `first_image_url` = *"Left view if second image is present, otherwise Custom (Own) view"* · `second_image_url` = *"Right view if present"*. Se sirven como **objetos S3 firmados con caducidad** (`X-Amz-Expires`, desde 14-mar-2026).
- Variante **Current View**: los mismos datos con **el encuadre exacto que el usuario tiene en pantalla**.
- **Falla de maquetación conocida** (3-jul-2025): *"Extra tall images in Print Report will no longer split to multiple pages"*. Cuidado con imágenes altas partiéndose entre páginas.

**Tabla de ítems** — estructura `groups[] → items[]`, es decir **agrupada por grupo de prioridad**. Por grupo: `number`, `name`. Por ítem (`ShipmentReportItem`), en este orden:

```
color · sign (la LETRA) · description · pieces · width · height · length · total_weight
· is_stackable · is_tiltable · is_rotable  → renderizados como 3 pictogramas
```

### 3.3 PDF paso a paso — composición exacta, verificada sobre GIF oficial `V`

```
┌────────────────────────────────────────────────────────────────────┐
│ ☐ Shipment Legend   ☐ Step Legend                       [PDF] [🖨] │  barra gris claro
├────────────────────────────────────────────────────────────────────┤
│  [E]  Box 5    18   120.0  120.0   55.0   12600.0    ↑  ⧗̸  ☂       │  chip color + letra
│  [F]  Box 6    ...                                    ↑  ⧗̸  ☂       │  pictogramas gris/negro
├────────────────────────────────────────────────────────────────────┤
│        ESCENA · FONDO BLANCO PURO                                  │
│        · todo lo que no es el paso actual → DESATURADO casi a blanco│
│        · la caja del paso actual → COLOR SATURADO                  │
│          + ARISTAS DE ALAMBRE + el NOMBRE impreso en su cara       │
├────────────────────────────────────────────────────────────────────┤
│  (opcional) TABLA de los ítems agregados EN ESTE PASO              │
└────────────────────────────────────────────────────────────────────┘
```

Mecánica verificada:
- **Una fase por paso**; reproducción automática, pausa y navegación manual
- **Clic en un ítem o grupo de la lista de resultado → salta al paso de su primera aparición** (19-may-2020)
- El plan paso a paso **permanece visible al cambiar de vista de cámara** (ago-2021)
- La leyenda por paso se añadió el 13-sep-2022; desmarcando `Step Legend` se quita
- **Tarda más con muchos ítems**; hubo congelamiento al cerrar la ventana durante el cálculo (corregido sep-2024)
- Explícitamente pensado para **personal de almacén**

**Esto es lo más copiable de todo el dossier y no necesita una sola línea de 3D.** N pasos = N SVG estáticos renderizados en servidor, cada uno con dos capas: relleno gris casi blanco con opacidad baja para lo ya colocado, color saturado + `stroke` de aristas + `<text>` en la cara para el paso actual. **El "efecto animación" es solo navegar entre SVG.** `I` en cuanto a nuestra implementación; la composición de origen es `V`.

### 3.4 Excel — tres pestañas exactas `V`

1. Todos los ítems cargados con sus restricciones
2. El plan de carga con los datos del espacio (tamaño, metros libres, etc.)
3. Combinación de ítems + datos del espacio + **la visualización**

*"Any Print Report can be exported into .xlsx… contains all the load plan information and images and **can be also imported back into EasyCargo**"* (desde 30-ene-2020).

### 3.5 El modelo de reporte superior — a copiar en vez del de EasyCargo `V`

**Cargo-Planner no tiene tipos de reporte fijos: tiene un editor de maquetación sobre lienzo de rejilla de 12 columnas**, con arrastrar y soltar y **18 tipos de bloque**:

- **Globales** (una vez): `Summary Table`, `Notes`, `Unloaded Items`
- **De conjunto**: `Set Overview` (multicontenedor)
- **Por contenedor** (se repiten): `Container Title`, `3D View`, `Container Images`, `Container Info`, `Container Utilization`, `Container Totals`, `Center of Gravity`, `Loading Instructions`, `Items Table`, `Container Notes`, `Container Metadata`
- **A medida**: `Custom Text` (**con soporte de fórmulas**), `Spacer`, `Page Break`

Cada bloque configura ancho (1–12 columnas), alto, sección (encabezado/contenedor/pie) y **condiciones de visibilidad por campo** (`hasImages`, `hasContainerNotes`, `simpleMode`, `isFirstInSet`). PDF por parámetros de consulta.

Interruptores complementarios: `Simple Mode`, `Flatten Items Table` (resumir por SKU), **`Show Ruler`** (regla con marcas indicando las dimensiones del contenedor — trivial en SVG), `Print with Company Watermark`, **`Group Similar Containers`** (agrupa contenedores cargados idénticamente mostrando ID inicial y final), `Show Instructions`, `Show Dimensions`.

**Este sistema de bloques sobre rejilla de 12 es directamente portable a un generador en servidor de DTD, sin ninguna librería, y habilita que cada aliado white-label tenga su propia maquetación sin tocar código.** `I`

### 3.6 Contrato de datos del visor — lo único que necesita el SVG

**Formato de EasyCargo** (`GET /shipment-output-placements/{id}`) `V`: por pieza `{description, position: {in_width, in_height, in_length}, width, height, length}`, donde las dimensiones vienen **ya rotadas** (*"Actual item size considering rotation"*, sin campo de rotación) y **`position` es el CENTRO de la pieza**, con origen `[0,0,0]` en **frente-piso-centro**; `in_width` lleva signo.

**Las cuatro convenciones del mercado son incompatibles entre sí** `V`:

| Vendor | Origen | Salida |
|---|---|---|
| EasyCargo | frente-piso-**centro**; posición = centro de la pieza | dimensiones ya rotadas, sin campo de rotación |
| Goodloading | **esquina inferior derecha vista desde el frente**; x=ancho, y=alto, z=largo | `loadsPerAxis {x,y,z}` — **comprime bloques repetidos** |
| SeaRates | `location {x,y,z}` | **`complex {x,y,z}` = codificación por longitud de secuencia en 3D**: 240 cajas idénticas = **un** nodo con complex 10×4×6 |
| Cargo-Planner | `pos` (punto) **+ `bb` (caja envolvente explícita)** | más fácil de consumir y de probar colisión |
| PTV | `position` + `dimensions` + `orientation` reducida a enum `ORIGINAL\|ROTATED` | + `loadingMeters` por contenedor |

**Recomendación consolidada:** adoptar **esquina mínima + caja envolvente explícita** (estilo Cargo-Planner), porque la prueba de colisión y el render isométrico salen directos y el centro se deriva solo para el reporte.

**Y adoptar la compresión de SeaRates en la capa de render.** Para un visor SVG renderizado en servidor, la codificación por longitud de secuencia 3D reduce los nodos del DOM en uno o dos órdenes de magnitud. **En un consolidado de miles de cajas iguales, esa es la diferencia entre un SVG usable y uno que tumba el navegador.** `I` con alta confianza — es aritmética directa sobre el conteo de nodos.

---

## 4. Qué robar, ordenado por valor/esfuerzo

Restricción de destino asumida en toda la tabla: **SVG a mano, renderizado en servidor, sin librerías de visualización.** El orden combina el impacto visual/operativo y el impacto de motor.

| # | Qué | Valor | Esfuerzo | Ev. | Nota de implementación |
|---|---|---|---|---|---|
| **1** | **Reporte paso a paso con desaturación selectiva** | Máximo | Bajo | `V` | N pasos = N SVG estáticos. Dos capas: colocado en gris casi blanco con opacidad baja; paso actual en color saturado + `stroke` de aristas + `<text>` del nombre en la cara. La animación es navegación entre pasos. Añadir el salto: clic en ítem/grupo → paso de su primera aparición. **Es lo que EasyCargo renderiza con Unity y a nosotros nos sale gratis.** |
| **2** | **Chip de color + LETRA en la caja + leyenda tabular con pictogramas** | Máximo | Mínimo | `V` | Persistir `color` y `sign` **como datos del reporte**, no derivarlos en el cliente. Fila exacta: `[chip + letra blanca] · nombre · cantidad · L · A · H · peso · 3 pictogramas` (gris inactivo / negro activo, con globo). Casilla "mostrar solo la letra". Colores desde tokens `var(--*)`. **Es el mecanismo por el que un plan se ejecuta sin leer texto corrido.** |
| **3** | **Los tres números con nombre y color** | Alto | Mínimo | `V` | `free_distance` (morado), `forward_shift` (amarillo), `left_shift` (verde). Salen gratis del motor y son lo que un jefe de galpón necesita. Van en el panel y en el PDF. **Sumar el campo `limits` de SeaRates**: "qué te frenó — volumen, peso o altura". Una línea de texto, valor enorme. |
| **4** | **Modelo de invalidación campo por campo + los 6 estados de la lista** | Alto | Bajo | `V` | §1.10 y §1.11 tal cual. Sin esto la herramienta miente sobre si el plan que se ve corresponde a los datos que hay. |
| **5** | **Semántica de color de interacción** | Alto | Mínimo | `V` | Verde = destino válido · rojo (marco) = inválido · rojo (número) = no entra en un solo espacio · amarillo = seleccionado · azul = candidato. Vocabulario ya probado en la industria; solo hay que traducirlo. |
| **6** | **`Loading size`: redefinir el volumen útil en las 3 direcciones, con reinicio** | Alto | Bajo | `V` | Un solo mecanismo cubre voladizos, margen de seguridad, forzar capas (bajar techo), simular open-top y flat-rack, y el doble piso (recortar carga útil a la mitad + limitar altura + ítem ficticio como plataforma). Relativo con prefijo `-`, absoluto, y **botón de reinicio**. |
| **7** | **Descargo de responsabilidad permanente en toda pantalla de peso** | Alto | Trivial | `V` | *"es solo una simulación matemática"*. Ellos lo perdieron por accidente y lo repusieron por parche urgente. Va en centro de gravedad, ejes y VGM. |
| **8** | **Rejilla de piso de 20 cm como `<pattern>` SVG + regla con marcas** | Medio-alto | Trivial | `V` | Escala visual gratis; hace que el editor se sienta preciso sin motor. La regla es el `Show Ruler` de Cargo-Planner: `<line>` + `<text>`. **Solo visual — ver C10.** |
| **9** | **Grupos de prioridad con los 4 modos y semántica LIFO** | Máximo | Medio (toca el motor) | `V` | Grupo 1 = primero cargado = más al fondo = último descargado. Los cuatro modos traducidos, con su costo declarado visible en la interfaz. **Mapea 1:1 al consolidado de DTD: un grupo = un cliente / Shipping Mark.** Añadir el `Mix if Within` de CargoWiz como quinto modo si el motor lo soporta. |
| **10** | **Enlace público sin cuenta + variante "solo reporte" para móvil** | Alto | Bajo | `V` | Código corto, cero autenticación, dos sabores. **Mejora obligatoria: el enlace nunca debe morir por estado de licencia** (§5). |
| **11** | **Sistema de reporte por bloques sobre rejilla de 12 columnas** | Alto | Medio | `V` | 18 bloques, ancho 1–12, sección, condiciones de visibilidad por campo. Generador en servidor, cero librerías. Estrictamente superior a "Basic vs Current View" y habilita maquetación por aliado white-label. |
| **12** | **Compresión por longitud de secuencia 3D en el contrato del visor** | Alto | Bajo | `V` (el formato) / `I` (el beneficio) | Un nodo por bloque repetido en vez de uno por caja. Es la optimización más importante del render SVG para consolidados grandes. |
| **13** | **Excel de ida y vuelta, tres pestañas, contrato de columnas fijas** | Medio-alto | Medio | `V` | Exportar → editar → **reimportar**. Copiar del importador de EC: fusión de ítems iguales, opción "importar también con cantidad cero", filas con error en rojo, y **no crear envío si todos los ítems son inválidos**. El orden exacto de columnas A–J de EC es laguna; fijamos el nuestro. |
| **14** | **Editor manual con enganche modulado por acercamiento y selección múltiple por columna — pero validando** | Alto | Alto | `V` | Copiar la mecánica completa de §1.13. **La mejora que los supera: validar restricciones en vivo y avisar**, en lugar de su *"no constraints are applied"*. Si se implementan ambos interruptores, probar la combinación *ambos apagados* (a ellos les causó congelamiento). |
| **15** | **Dos barras de utilización, no una** | Medio | Trivial | `V` | `volumeRatio` y `weightRatio` independientes (SeaRates). Una sola barra oculta cuál es el factor limitante. |

**Fuera de la tabla, porque no es "robar" sino simplemente superarlos** — y sale gratis por la arquitectura de DTD:

- **Motor en servidor sin interfaz**: cálculo dentro de un Server Action, en cron o disparado por webhook. **EasyCargo estructuralmente no puede.**
- **Endpoints incrementales** al estilo Cargo-Planner (`insert_items` / `move_items` / `remove_items` / recalcular). Es literalmente el caso híbrido: el operario ya cargó tres paletas escaneadas y el motor replanifica el resto.
- **La reconciliación plan-vs-real**: el plan como hipótesis, el escaneo QR como verdad, y **el diferencial entre ambos como el entregable**. Dos pasadas de investigación no encontraron competidor que lo haga.

---

## 5. Qué NO copiar, y por qué

### 5.1 Primero, la laguna que hay que declarar: no existe corpus de quejas

Verificado plataforma por plataforma `V`:

| Plataforma | Estado |
|---|---|
| **Trustpilot** | Perfil reclamado desde feb-2020. TrustScore 3,7 basado en **UNA (1) reseña en toda la historia** (Lukas, CZ, 30-jul-2024, 5 estrellas, positiva) + *"0 reviews in the last 12 months"* |
| **Capterra** | *"Based on 0 user reviews"*, 0.0 en todas las dimensiones |
| **GetApp** | "No reviews", 0.0/10 |
| **SourceForge** | *"This software hasn't been reviewed yet."* |
| **GoodFirms** | Sin reseñas |
| **SoftwareAdvice** | 4/5 de **0 usuarios** |
| **G2** | HTTP 403, bloqueo anti-bot. **No verificable** |

**Implicación estratégica de primer orden:** el líder percibido de la categoría no tiene validación social pública. **La barrera de entrada por reputación es muchísimo más baja de lo que aparenta.** `I` — con la salvedad de G2, aunque con las otras cinco vacías la probabilidad de un corpus real es baja.

Por lo tanto, "qué no copiar" se construye con las tres fuentes que sí son evidencia dura: la única reseña independiente, las limitaciones que el propio fabricante admite por escrito, y los errores que ellos mismos publican en sus notas de versión.

### 5.2 La única reseña independiente (ucompares) — los contras literales `V`

1. **"Missing advanced stackability options"** → no hay peso máximo soportado por caja ni reglas de qué apila sobre qué. Confirmado contra la ficha de ítem: **un solo booleano**.
2. **"Missing palletization"** (con mejoras prometidas).
3. **"Can work with cuboid shapes only"**.
4. Soporte limitado de idiomas para la integración SAP.

### 5.3 Limitaciones que el propio fabricante admite

| No copiar | Evidencia | Ev. |
|---|---|---|
| **Editor manual que no valida NADA** | *"**No constraints are applied** when adjusting the load plan manually… a box can be placed on non-stackable items as well. **It is solely up to the user** to respect the loading rules."* Solo valida colisión (marco rojo) | `V` |
| **Sesgo a apilar en altura cableado** | Minimiza huella de piso construyendo torres; el usuario solo lo evita marcando no apilable, editando a mano o partiendo en grupos. **Debe ser un parámetro, no una decisión oculta** | `V` |
| **Modelo de tres booleanos** | Sin capacidad portante, sin máximo de capas, sin fragilidad, sin destino, sin clase | `V` |
| **Solo formas cúbicas, y triángulos descartados** *"porque el cálculo sería demasiado complejo"* | Diez años de producto y siguen siendo solo cajas. Su solución oficial es "modela dos triángulos como una caja" | `V` |
| **Paletización que se degrada a un solo SKU** | Con mezcla de dimensiones vuelve al secuencial frente→fondo | `V` |
| **Multicontenedor secuencial, tope de 10, mismo tipo** | No decide qué mezcla de 20'/40'/40HQ minimiza costo | `V` |
| **API que no puede calcular** | Consecuencia de poner el solver en el navegador | `V` |
| **Enlaces públicos que MUEREN al vencer la licencia** | *"the link only works if there is an active license"*. **DTD nunca debe atar un enlace operativo a un estado de licencia o suscripción** | `V` |
| **Más de 10.000 ítems desactiva automáticamente el respeto a los límites de peso** | Confesión de que el cálculo se degrada a esa escala. **Nosotros no podemos hacer eso: el peso es el gate marítimo** | `V` |
| **Requisitos de máquina** | 2+ GB de RAM, *"no más de 4 años"*, sin modo sin conexión en escritorio | `V` |
| **Solo dos roles** y la sección Cargo Spaces no existe para el rol User | Modelo de permisos pobre frente al RBAC por módulo que DTD ya tiene | `V` |

### 5.4 Sus errores publicados = nuestro mapa de minas

Estos no son hipótesis. Son fallas que el líder del mercado publicó en sus propias notas de versión `V`:

- **18-nov-2025**: *"different cargo items with **same dimensions** could be **visually wrongly rotated** and colliding with other items"*
- **26-nov-2025**, ocho días después: *"**successive** cargo items with **same dimensions** could be **wrongly placed** and colliding"*
- **27-may-2024**: *"loading of **same cargo items placed in multiple Priority Groups** now works without issues"*
- **24-ene-2023**: *"in manual load, **automatic rotation** of a cargo item could break placement of subsequent items on this cargo item"*
- **dic-2024**: congelamiento en carga manual *"when **both snapping and autorotation were turned off**"*
- **jun-2022**: rotación errónea del resultado con paletas cuadradas
- **19-may-2026**: *"Several loading algorithm fixes"*

**Los cuatro casos de prueba que hay que escribir antes de la primera línea de motor** (detalle en §6.6): ítems distintos con dimensiones idénticas; ítems sucesivos de dimensiones idénticas; el mismo tipo repetido en varios grupos; autorrotación que corrompe lo apoyado encima.

**Hipótesis de causa raíz de los dos primeros** `I`: deduplicación o hashing de tipos por dimensiones. **Regla derivada: nunca indexar puntos extremos ni colocaciones por hash de dimensiones, y nunca fusionar tipos de ítem que difieran en grupo o destino.**

### 5.5 Lo que no vale la pena por costo/beneficio

- **El realismo del vehículo** (cabina, guardafangos, ruedas con llanta, sombras). No aporta información y es donde metieron versiones enteras. El dato útil lo comunican por desaturación + chip + letra.
- **La ausencia de esquema de atajos de teclado** (ver C7). Cube-IQ tiene 20 comandos (SHIFT+C comprimir, SHIFT+D bajar al piso, SHIFT+X intercambiar dos ítems, CTRL+T rotar alrededor de un centro común) y Cargo-Planner tiene Tab/Enter/Ctrl+A/flechas/Space/Del. **Se puede mucho mejor y es barato.**
- **Diseños que se rompen con rótulos largos** — riesgo directo y verificado en español.
- **Motores no deterministas.** Cube-IQ lo admite en un artículo dedicado: *"in one run the optimizer may reach iteration 48... in another only 47"* `V`. **Inaceptable para un plan que se imprime, se firma y se le entrega a un operario.**

---

## 6. El motor de estiba: heurística recomendada + pseudocódigo

### 6.1 Cuatro decisiones que son de negocio, no de algoritmo

Hay que cerrarlas antes de codificar porque cambian la función objetivo:

1. **Objetivo primario: minimizar huella de piso (torres) o minimizar altura (capas).** EasyCargo lo tiene cableado a torres `V`. Cargo-Planner lo expone como parámetro `V`. Para consolidado marítimo China→Venezuela, las torres altas empeoran estabilidad y descarga; las capas empeoran el aprovechamiento de CBM. **Recomendación: parámetro, no constante.**
2. **Umbral de centro de gravedad vertical.** Ver C3: 50% como umbral citable, 40% como advertencia interna sin atribuirlo al CTU.
3. **Tabla canónica de contenedores.** Ver C5: la fijamos nosotros, la versionamos como dato, con `door_h` y `door_w` **separados** del interior.
4. **Factor de soporte mínimo α.** El espectro publicado va de 100% (usado en ~50% de los papers que tratan estabilidad) a 70% (Hemminki y otros, suficiente en la práctica con paleta enfilmada) a 75% (posproceso de GENPACK) a 50% (validación final de GENPACK) `V`.

### 6.2 Comparación de candidatas

| Criterio | **A. Puntos extremos (C-EPBFD)** | **B. Espacios maximales + bloques** | **C. Muros/capas FFD (lo de EasyCargo)** | **D. Metaheurística (GA/GRASP/tabú)** |
|---|---|---|---|---|
| Calidad | 743,4 contenedores vs. 802,9 (S-Pack) y 775,4 (MPV-BS) en 240 instancias; **<5% de la cota inferior de Boschetti**, <1% en Clase IV; **<2% de GLS**; gana a la ramificación y acotación MPV `V` | Base de los GRASP/VNS de Parreño. **Sin número absoluto en el material** | El propio vendor promete **+7%**, no más `V`. El paper de EP dice que el enfoque de estantes/muros *"introduces guillotine cuts on the depth and height... leading to the underutilization of the containers"* `V` | Cube-IQ y packVol sacan 3/3 en "calidad de cálculo" en la comparativa checa (de EasyCargo, ver C8) |
| Tiempo | **Ver C1** — hay contradicción no resuelta | n/d | milisegundos | GENPACK 3,84 ± 2,15 s de núcleo, **29,20 s** con posproceso; Cube-IQ recomienda 10–15 s por contenedor `V` |
| Complejidad de implementación | Dos algoritmos publicados verbatim, ~50 líneas de núcleo. Cada ítem genera **≤6 puntos**; actualizar la lista es **O(n)**; el procedimiento completo es **O(n³)** `V` | Alta: los espacios maximales **no son disjuntos**; hay que recortar los que intersecan y *"check the list and eliminate possible inclusions"* en cada paso `V` | Trivial | Alta: población 100, 50 generaciones, élite 10%, rejilla de vóxeles 20³, posproceso en 3 etapas `V` |
| **Determinismo** | **Total** (sin aleatoriedad, sin corte por tiempo) | Total | Total | **No.** Cube-IQ lo admite `V`; packVol tiene semilla verificable |
| Soporte lateral (métrica SideSup de GENPACK) | **0,264 — el peor de los tres medidos** `V` | n/d | por construcción las paredes se tocan | GENPACK 0,382 · MaxRects **0,436** `V` |
| Centro de gravedad (CoG3D de GENPACK) | **0,697 — el mejor** `V` | n/d | n/d | GENPACK 0,670 `V` |
| Legibilidad del plan para el operario | Media | Alta: llena esquinas → lados → interior por diseño | La más legible | Impredecible. MagicLogic describe sus planes estables como *"less structured, but that do not show the chimneys typical of fill rate optimized loads"* `V` |

### 6.3 Recomendación

**Puntos extremos, variante Best-Fit-Decreasing con función de mérito de espacio residual y ordenamiento agrupado (C-EPBFD), envuelto en una capa de factibilidad física separada del colocador.**

Razones concretas:

1. **Es la mejor relación calidad/simplicidad publicada y está publicada verbatim.** Los dos algoritmos están completos en el material. No hay que reconstruir el núcleo. `V`
2. **Nuestro régimen es exactamente donde más gana.** Medición del paper: con ordenamiento previo, la mejora va de −0,11% (Clase 4, ítems grandes) a **−22,35% (Clase 7)**, y la explicación es literal: *"The improvement yielded by using the EPs is more significant when the items are small compared to the bin size"* `V`. **Un consolidado de muchas cajas chicas heterogéneas en un 40' es Clase 7, no Clase 4.**
3. **Es determinista por construcción.** Sin aleatoriedad, sin corte por tiempo. **Un plan que se imprime y se firma no puede cambiar entre corridas.**
4. **No hay retroceso: es constructiva pura y polinomial.** Las heurísticas constructivas previas (S-Pack, HA) **no son polinomiales** porque usan ramificación y acotación internamente `V`.
5. **Su debilidad conocida se compensa afuera.** Es el peor en soporte lateral (0,264). Eso **no se arregla cambiando de colocador**, se arregla con la capa de estabilidad de §6.5 y midiendo el KPI de Bischoff & Ratcliff. Cambiar a MaxRects por soporte lateral nos costaría el centro de gravedad (donde EP gana) y la simplicidad.
6. **El costo de exigir estabilidad es bajo y está cuantificado.** MagicLogic midió su motor con estabilidad como objetivo principal contra el de máximo llenado: *"less than 1% on the average... the MPE average only 0.6% behind"*, con 85–92% de llenado típico en paletas `V`. **Renunciar a la estabilidad no compra casi nada.**

**Plan B medido, por si el soporte lateral resulta inaceptable en operación:** MaxRects (0,436 vs. 0,264). Está disponible con licencia MIT y sin dependencias en `binpackingjs`.

### 6.4 Parámetros exactos (del paper, no inventados) `V`

- **Función de mérito: espacio residual.** `f = (RSx − dx) + (RSy − dy) + (RSz − dz)`; se elige el punto que la **minimiza**. Justificación literal: *"the EP-BFD heuristic providing the best results is using the Residual Space criterion... Consider the Residual Space of each EP as a virtual bin"*. La alternativa de volumen libre *"yields results which are far from those of the EP-FFD procedure"*.
- **Ordenamiento: doble pasada determinista.**
  - Pasada 1: agrupado área-altura con **ε = 10** (óptimo publicado para EP-BFD: ε ∈ [5,15])
  - Pasada 2: agrupado altura-área con **ε = 22** (óptimo publicado: ε ∈ [21,24])
  - Se corren las dos y se queda la mejor por objetivo. Eso es literalmente C-EPBFD.
  - **No usar ε > 60**: *"for ε>50, the clustering splits the items into two clusters only"*.
- **Motivo del agrupamiento** (para que nadie lo "simplifique" después): *"the sorting rules without clustering introduce an ordering based mainly on the first parameter, neglecting the others"*. Ordenar por volumen a secas rinde 807,5 contenedores; agrupado altura-área rinde 746,5.
- **Rotaciones:** el paper las introduce duplicando cada ítem por orientación con exclusión mutua. En la práctica lo implementamos como bucle sobre orientaciones permitidas dentro de la evaluación del punto — mismo efecto, sin inflar la lista.

### 6.5 Lo que NO hay que hacer

- **No discretizar en rejilla.** *"when cargo stability is enforced, grids of points may lead to the loss of stable packings"* y *"more unstable solutions emerge from refined grids"* `V`. Ver **C10**.
- **No confiar en el espacio residual como prueba de colisión.** Advertencia literal: *"For complex packings, the RS gives only an estimate... potential overlaps with other items have to be verified when accommodating a new item on the chosen EP"* `V`. El espacio residual es un filtro barato **antes** de la caja envolvente, nunca en lugar de ella.
- **No cortar por tiempo.** Es la fuente del no determinismo de Cube-IQ.

### 6.6 Un solo solver, N objetivos — el patrón más barato del dossier

Cuatro herramientas convergen en lo mismo de forma independiente `V`: SeaRates `loadType`, PTV `focus`, Cargo-Planner `load_style` + `secondary_goal`, y CBM3 que genera **tres planes comparables** (Max Volume / Easy Loading / Best Balance).

Si una corrida cuesta menos de un segundo, DTD puede generar **cuatro planes del mismo cargamento** y ponerlos lado a lado:

| Plan | Orden | Desempate del mérito | Para qué |
|---|---|---|---|
| Máximo CBM | agrupado área-altura ε=10 | espacio residual puro | cotizar |
| Menos metros de piso | agrupado altura-área ε=22 | + penalizar crecer en el eje largo | carga parcial / LTL |
| Más estable | agrupado área-altura ε=10 | + penalizar soporte lateral bajo y centro de gravedad excéntrico | travesía marítima |
| Descarga fácil | orden por grupo/parada | + penalizar violación de "visible" | multicliente |

**El operador elige.** Es diferencial de producto casi gratis y está respaldado por cuatro competidores. `I` en cuanto a la viabilidad de tiempo — depende de C1.

### 6.7 Convenciones no negociables (fuente del determinismo)

- **Todo en enteros.** Longitudes en **milímetros enteros**, pesos en **gramos enteros**. Cero coma flotante en el motor. Los porcentajes se calculan como enteros y se dividen solo al reportar.
- **Ejes:** `x` = ancho (transversal), `y` = largo (frente → puerta), `z` = alto. Origen `(0,0,0)` en **frente-izquierda-piso**, todas las coordenadas ≥ 0.
- **Posición = esquina mínima + caja envolvente explícita** (§3.6).
- **Sin aleatoriedad, sin `Date.now()`, sin corte por tiempo, sin iteración sobre `Set`.** Todo desempate es explícito y termina en `uid`.

### 6.8 Tipos

```ts
type Mm = number;   // entero
type Gr = number;   // entero (gramos)

const enum Rot { XYZ = 0, YXZ = 1, ZYX = 2, YZX = 3, XZY = 4, ZXY = 5 }
// máscara de bits 1..63 (Cargo-Planner / packVol): bit i => Rot i permitida
// 1 = solo a lo largo · 3 = gira en el plano (por omisión para cajas) · 63 = las 6

interface ItemType {
  id: string;
  l: Mm; w: Mm; h: Mm;
  weightPiece: Gr;
  qty: number;
  orientations: number;          // 1..63

  // --- restricciones físicas ---
  stackabilityId: string;        // solo apila sobre el mismo id
  maxWeightAbove: Gr;            // 0 = frágil, nada encima
  maxPressureAbove: number;      // gramos por mm² (packVol convierte peso -> tensión)
  maxLayers: number;             // 0..255
  bottomOnly: boolean;
  nestingHeight: Mm;             // altura extra al anidar sobre uno igual
  margin: Mm;                    // holgura para trincas

  // --- negocio ---
  groupId: number;               // 1 = se carga primero = va más al fondo (LIFO)
  classId?: string;              // tabla de segregación
  destinationId?: string;        // multiparada
}

interface EP {                   // punto extremo con espacio residual
  x: Mm; y: Mm; z: Mm;
  rsx: Mm; rsy: Mm; rsz: Mm;
}

interface Placement {
  uid: number; typeId: string;
  x: Mm; y: Mm; z: Mm;           // esquina mínima
  dx: Mm; dy: Mm; dz: Mm;        // dimensiones YA rotadas
  rot: Rot;
  step: number;                  // paso de carga (reporte paso a paso)
  supportedBy: number[];         // uids que lo sostienen
  grounded: boolean;             // la cadena de soporte llega al piso
}

interface Bin {
  L: Mm; W: Mm; H: Mm;           // interiores USABLES (ya con "loading size" aplicado)
  doorW: Mm; doorH: Mm;          // abertura de puerta, SEPARADA del interior
  payload: Gr; tare: Gr;
  maxPressureFloor: number;      // g/mm² concentrada (ver C4)
}

type Status = 'success' | 'noItems' | 'tooManyItems' | 'tooSmallItems'
            | 'couldNotLoadAnyItems' | 'couldNotLoadAllItems'
            | 'couldNotPalletizeSomeItems';   // vocabulario de Cargo-Planner
```

### 6.9 Núcleo

```
function pack(bin, types, opts) -> Solution
  best = null
  for (orden, eps) in [ (agrupadoAreaAltura, 10), (agrupadoAlturaArea, 22) ]:
      sol = packOnce(bin, orden(types, eps), opts)
      if best == null or objetivo(sol, opts) < objetivo(best, opts): best = sol
  return best                              // C-EPBFD: dos pasadas, la mejor gana


function packOnce(bin, piezasOrdenadas, opts) -> Solution
  EPs  = [ {x:0, y:0, z:0, rsx:bin.W, rsy:bin.L, rsz:bin.H} ]
  P    = []
  step = 0

  for pieza in piezasOrdenadas:            // el orden ya trae grupos y prioridades
      cand = null
      for ep in EPs:                       // ordenados por (z, y, x) NO DECRECIENTE
        for rot in orientacionesPermitidas(pieza):
          (dx, dy, dz) = aplicarRot(pieza, rot) + 2*pieza.margin

          // 1. filtro barato: espacio residual y paredes
          if dx > ep.rsx or dy > ep.rsy or dz > ep.rsz: continue
          if ep.x+dx > bin.W or ep.y+dy > bin.L or ep.z+dz > bin.H: continue

          // 1b. PUERTA: gate propio, no derivable del interior
          if not cabePorPuerta(dx, dy, dz, bin.doorW, bin.doorH): continue

          // 2. gravedad: bajar hasta apoyo
          z2 = caerHasta(P, ep.x, ep.y, dx, dy, ep.z)

          // 3. colisión REAL (el espacio residual NO basta)
          if solapaAABB(P, ep.x, ep.y, z2, dx, dy, dz): continue

          // 4. capa física (soporte, peso, presión, capas, grupos, clase)
          if not factible(P, bin, pieza, ep.x, ep.y, z2, dx, dy, dz, opts): continue

          // 5. mérito: espacio residual
          m = (ep.rsx-dx) + (ep.rsy-dy) + (ep.rsz-dz)
          if mejor(m, z2, ep, cand):       // desempate: m -> z2 -> (z,y,x) -> uid
              cand = { ep, rot, x:ep.x, y:ep.y, z:z2, dx, dy, dz, m }

      if cand == null: registrarNoCargado(pieza); continue
      P.push({ ...cand, uid: pieza.uid, step: step++ })
      EPs = actualizarEPs(EPs, P, cand)    // Algoritmo 1
      EPs = updateResidualSpace(EPs, cand) // Algoritmo 2
      EPs = ordenarYDeduplicar(EPs)        // por z, y, x no decreciente

  return { placements: P, unloaded: [...], metrics: calcularMetricas(P, bin) }
```

### 6.10 Algoritmo 1 — generación de puntos extremos (adaptado verbatim) `V`

Ítem nuevo `k` en `(xk,yk,zk)` con dimensiones `(wk,dk,hk)`; ítems ya colocados `i`.

```
function actualizarEPs(EPs, I, k):
  maxBound = [-1,-1,-1,-1,-1,-1]     // YX, YZ, XY, XZ, ZX, ZY
  neweps   = [null x 6]

  for i in I:
    if canTakeProjection(k,i,YX) and (i.x+i.w > maxBound[YX]):
        neweps[YX] = (i.x+i.w, k.y+k.d, k.z);  maxBound[YX] = i.x+i.w
    if canTakeProjection(k,i,YZ) and (i.z+i.h > maxBound[YZ]):
        neweps[YZ] = (k.x, k.y+k.d, i.z+i.h);  maxBound[YZ] = i.z+i.h
    if canTakeProjection(k,i,XY) and (i.y+i.d > maxBound[XY]):
        neweps[XY] = (k.x+k.w, i.y+i.d, k.z);  maxBound[XY] = i.y+i.d
    if canTakeProjection(k,i,XZ) and (i.z+i.h > maxBound[XZ]):
        neweps[XZ] = (k.x+k.w, k.y, i.z+i.h);  maxBound[XZ] = i.z+i.h
    if canTakeProjection(k,i,ZX) and (i.x+i.w > maxBound[ZX]):
        neweps[ZX] = (i.x+i.w, k.y, k.z+k.h);  maxBound[ZX] = i.x+i.w
    if canTakeProjection(k,i,ZY) and (i.y+i.d > maxBound[ZY]):
        neweps[ZY] = (k.x, i.y+i.d, k.z+k.h);  maxBound[ZY] = i.y+i.d

  EPs = EPs ∪ {neweps no nulos}
  return ordenar(EPs) por z, y, x NO DECRECIENTE, eliminando duplicados
```

- **Caso base:** contenedor vacío, ítem en `(0,0,0)` genera exactamente tres puntos: `(wk,0,0)`, `(0,dk,0)`, `(0,0,hk)` `V`
- **Desempate de proyección:** *"If there are more than one item on which a point can be projected, the algorithm chooses the nearest one"* `V` — de ahí el `maxBound`
- **`canTakeProjection` NO está definido verbatim en el material.** `I` — definición operativa a usar: *el ítem `i` intersecta el rayo de proyección, es decir se solapa con `k` en los dos ejes ortogonales a la dirección y está por detrás de `k` en el eje de proyección.* **Este es el punto exacto donde el motor se rompe si se implementa mal. Lleva prueba de propiedades propia (§6.13, T8).**
- **Contradicción C2**: se resuelve por test, no leyendo.

### 6.11 Algoritmo 2 — actualización del espacio residual (verbatim) `V`

```
function updateResidualSpace(EPs, n):        // n = ítem recién colocado
  for ep in EPs:
    if ep.z >= n.z and ep.z < n.z + n.dz:
        if ep.x <= n.x and isOnSide(n, Y): ep.rsx = min(ep.rsx, n.x - ep.x)
        if ep.y <= n.y and isOnSide(ep, n, X): ep.rsy = min(ep.rsy, n.y - ep.y)
    if ep.z <= n.z and isOnSide(n, XY):     ep.rsz = min(ep.rsz, n.z - ep.z)
  return EPs
```

Al crearse un punto, *"its Residual Space on each axis is set equal to the distance from its position to the side of the bin along that axis"* `V`.

**Complejidad** `V`: actualizar la lista es O(n) por colocación, con ≤6 puntos nuevos por ítem; el procedimiento completo es O(n³), y sigue siendo O(n³) con cualquiera de las cuatro funciones de mérito.

### 6.12 La capa física, separada del colocador

**Soporte estático vertical.** Las restricciones MILP de Junqueira se reducen a **ancho de solape por eje** — dos líneas, sin nada de MILP `V`:

```
ovX = max(0, min(a.x+a.dx, b.x+b.dx) - max(a.x, b.x))
ovY = max(0, min(a.y+a.dy, b.y+b.dy) - max(a.y, b.y))

areaSoporte = Σ ovX(cand, j) * ovY(cand, j)
              sobre los j con | (j.z + j.dz) - cand.z | <= HEIGHT_TOL
ratio = areaSoporte / (cand.dx * cand.dy)
aceptar si ratio >= α
```

- **`HEIGHT_TOL = 5 mm`** — valor por omisión explícito de Cargo-Planner: *"Largest accepted difference in height between packages the system should allow to consider the space on top a single loadable area"* `V`. **Sin esta tolerancia, un techo irregular por 1 mm deja de ser superficie apilable y el motor no apila nada.**
- **α recomendado:** 0,75 en colocación, 0,50 en validación final (umbrales de GENPACK) `V`. Referencia práctica: 70% basta con paleta enfilmada `V`.
- **Regla de rescate:** si `ratio < α`, aceptar solo si **los cuatro vértices inferiores** están apoyados `V`.
- **Soporte parcial por eje separado** (`αX`, `αY`) si hiciera falta: Techanitisawad & Tangwiwatwong especifican porcentajes distintos para largo y ancho `V`.

**El punto que rompe a casi todos: validar por TORRE, no por caja.** `V`
- De Castro Silva y otros *"demonstrate that a load may be unstable even if the center of gravity of each box is supported from below"*
- Mack y otros: con voladizos en varias capas *"the gravity center of a box may be supported by another box beneath but not (indirectly) by the container floor"*

Implementación: cada colocación lleva `grounded`, calculado recursivamente. Un ítem está apoyado si `z == 0` o si todos sus soportes lo están y la cadena acumulada de solape sigue cumpliendo α. **Una torre que "camina" fuera del piso se rechaza aunque cada caja pase el test local.**

**Soporte horizontal: KPI obligatorio, no restricción.** Puntos extremos es el peor de los tres motores medidos (0,264). Por eso hay que **medirlo y mostrarlo**, con la métrica de Bischoff & Ratcliff: *"the percentage of items which are not in contact with either another item or a container wall on at least three of the four (side) surfaces"* `V`, más el número medio de cajas que soportan a cada ítem no apoyado en el piso. Advertencia directa del review: *"Loading patterns which are vertically stable may prove to be horizontally unstable, e.g. if the solutions are built by means of box towers"* — **exactamente el sesgo de EasyCargo.**

**Peso apilado — dos métricas, no una** `V`:

| Campo | Fuente | Semántica |
|---|---|---|
| `maxWeightAbove` | PackingSolver / Cargo-Planner | Peso máximo encima, **acumulado por toda la columna** |
| `maxPressureAbove` | packVol | packVol **no compara kilos contra kilos**: *"converts it internally in the normal stress through division by the area of the supporting surface... the object cannot be positioned above because, although its weight is lower than pm, it generates a stress higher than the maximum allowed"* |
| `maxLayers` | Cargo-Planner (0..255) | Máximo de capas por SKU |
| `stackabilityId` | PackingSolver | *"An item can be packed over another item only if they have the same x and y dimensions and the same stackability_id"* |
| `nestingHeight` | Cube-IQ | Altura extra al anidar. Aritmética exacta: altura 10, nesting 2,5 → 1 unidad = 10; 2 = 12,5; 3 = 15 |

**Implementar las dos métricas.** Una caja liviana con base chica puede ser rechazada encima de otra por concentrar presión. Ese es el aporte único de packVol y nadie más lo documenta. Truco documentado para prohibir apilado sobre una cara: poner un valor pequeño no cero (0,01), **no** cero `V`.

**Acumulación por columna, no por contacto.** Regla verificada de CargoWiz: *"The Taboo cargo will not load on top even if it is only partially on top"* y *"even if there is other cargo in between"* `V`.

**Precedencias — MaxLoad es el único que las documenta, y hay que copiarlas** `V`:
- *"When stacking same SKUs, MaxLoad will refer to Maximum Stack Height instead of the Stack Code"*
- *"When building a stack of like SKU's, Maximum Stack Height takes precedence over Maximum Stack Weight"*
- *"Maximum Stack Height also takes precedence over the stack matrix"*

**Error de uno crítico:** CargoWiz `Max Can Stack` **incluye la base**: *"a Max Can Stack of 3 means there will be a total of 3 items in the stack"* `V`. Definir el nuestro y probarlo.

**Salvedad física que no podemos resolver con datos:** Bortfeldt & Wäscher advierten que *"the load-bearing strength cannot necessarily be simply measured by the maximum weight which can be applied per unit area... the edge crush... can be a more appropriate measure"* `V`. Nuestro `maxPressureAbove` modela el caso de tapa blanda, que es el más exigente. **No vamos a tener datos de resistencia de bordes por bulto y no los vamos a pedir al cliente.**

**Multiparada — los tres tipos formalizados en la literatura** `V`:

1. **Visible** (el básico, barato, implementar primero):
   > *"This constraint is violated if for any pair of boxes i and j such that i has to be unloaded before than j, j is on top of i (i.e. the base of j is higher than the top of i and they overlap horizontally), or j is in front of i (i.e. the back of j is in front of the front of i, and they overlap across the container)."*

   En TypeScript son dos condiciones de solape por eje. Refleja la descarga real con montacargas.
2. **Alcanzable** (Liu y otros): además de visible, alcanzable. Fórmula literal en cm: `L + H < 200` y `L < min(200 − z_i, 60)`.
3. **Separado** (Junqueira y otros): paredes virtuales con parámetro `δ` = *"how many units of length beyond the border between boxes of consecutive destinations the worker is allowed to go"*. `δ=0` = separación total, que **es la "pared invisible" de EasyCargo**.

**Ortogonal: restringido vs. no restringido.** Restringido = *"it is not possible to pack some boxes for customer j unless all the boxes for customer i have been packed"*. **El costo de la restricción dura es medible y grande:** en el ejemplo 2D del paper (contenedor (6,2), 3 clientes) el óptimo restringido vale 10, saltando al cliente 2 vale 11, y el no restringido parcial vale **12** `V`. **Hasta 20% de capacidad.**

**Recomendación:** implementar **visible como restricción blanda con penalización** en la función de mérito, más un indicador `estricto` que la vuelve dura. Motivo: el 11,4% de los papers que tratan multiparada lo hacen *"mostly as a hard constraint"* y pagan ese 20% `V`; nosotros podemos mostrarle al operador los dos planes lado a lado.

**Trampa de datos:** no fusionar tipos de ítem por dimensiones si tienen grupo o destino distintos. **EasyCargo tuvo un error exactamente ahí** (§5.4).

### 6.13 Tests desde el día uno

**Los que rompieron a EasyCargo — evidencia dura, no hipótesis** `V`:

| # | Caso | Prueba |
|---|---|---|
| T1 | Ítems **distintos** con dimensiones idénticas | 3 tipos distintos, mismas dimensiones, 20 piezas cada uno. Aserciones: cero solapamiento, rotación coherente con `orientations` |
| T2 | Ítems **sucesivos** de dimensiones idénticas | 50 cajas idénticas consecutivas. **Nunca indexar puntos ni colocaciones por hash de dimensiones** |
| T3 | Mismo ítem en varios grupos de prioridad | Tipo A en grupos 1, 2 y 3. Aserción: el orden LIFO se respeta y no se fusionan tipos |
| T4 | Autorrotación corrompe lo que está encima | Colocar B sobre A, rotar A, verificar que B se recalcula o se rechaza |
| T5 | Imantado y autorrotación **ambos apagados** | Las cuatro combinaciones de los dos interruptores en el editor manual |

**Los que rompen la matemática:**

| # | Caso | Prueba |
|---|---|---|
| T6 | **Cubo perfecto** (`l==w==h`) | 6 orientaciones idénticas → 6 puntos duplicados → desempate inestable. boxologic tiene guarda explícita `V`. Aserción: se evalúa **una** orientación, se generan **tres** puntos |
| T7 | Espacio residual pasa, caja envolvente falla | Construir un caso donde el residual sea optimista. Aserción: rechazo por colisión |
| T8 | **`canTakeProjection` mal implementado** | Prueba de propiedades: para toda colocación, **ningún punto cae dentro** del volumen de una pieza, y **todo punto es alcanzable** |
| T9 | Empate exacto de la función de mérito | **Prueba de instantánea: la misma entrada da byte a byte el mismo plan, 100 corridas.** Cadena de desempate `f → z → y → x → uid` |
| T10 | Torre con voladizos escalonados que "camina" fuera del piso | Escalera de 5 cajas con 40% de voladizo cada una. Aserción: `grounded == false` en la tercera |
| T11 | Centro de gravedad soportado pero conjunto inestable | Caja apoyada solo en su centro por una pieza estrecha. Aserción: falla el ratio α |
| T12 | Altura casi igual (4 mm de diferencia) | Dos cajas vecinas con 4 mm y con 6 mm de diferencia. Aserción: en el primer caso apila cruzando ambas, en el segundo no |

**Los que rompen los datos:**

| # | Caso | Prueba |
|---|---|---|
| T13 | **Caja que entra al volumen pero NO por la puerta** | 40'HC: interior 2,70 m de alto, puerta 2,59 m. Una caja de 2,65 m **cabe y no entra**. Aserción: `couldNotLoadAllItems` con motivo "abertura de puerta" |
| T14 | Cantidad 0, peso 0, dimensión 0 | CubeMaster clasifica cuáles son críticos: *"The quantity of [K] is 0"* → no crítico, la simulación sigue; *"Both of set ratio and quantity of [K] are 0"* → crítico, no continúa `V` |
| T15 | Todos los ítems de la importación son inválidos | EasyCargo tuvo que arreglarlo (9-jun-2026) `V`. Aserción: `noItems`, no se persiste nada |
| T16 | Ítem más grande que el contenedor | Aserción: `tooSmallItems` / `couldNotLoadAnyItems` con aviso visible |
| T17 | Error de uno en `maxLayers` | Fijar si incluye o no la base, con test explícito |
| T18 | Reglas en conflicto | packVol lo documenta: *"Max depth tends to 'bring forward', while Rear Balance tends to 'bring backwards'"* `V`. Aserción: el motor detecta el conflicto y lo reporta, **no oscila** |
| T19 | Escala: 10.000 piezas / 250 tipos | A esa escala EasyCargo desactiva los límites de peso. **Nosotros no podemos: el peso es el gate marítimo.** Aserción: tiempo dentro de presupuesto o degradación explícita y reportada |
| T20 | Unidades | Aserción: ningún `Number.isInteger` falla en la frontera del motor |

**El caso híbrido — nuestro diferencial:**

| # | Caso | Prueba |
|---|---|---|
| T21 | **Arranque desde estado real**: el operario ya cargó 3 paletas escaneadas por QR | El motor **siembra los puntos extremos desde las colocaciones existentes**, no desde el contenedor vacío. Aserción: el plan resultante **no mueve nada ya colocado** |
| T22 | **Reconciliación plan vs. real**: la caja escaneada quedó 30 cm corrida | Aserción: el motor recalcula el remanente sin invalidar todo, y el diferencial es un entregable |
| T23 | **Revalidación de estabilidad tras cada parada de descarga** | *"A load which is initially stable may become unstable after parts of it have been unloaded"* `V`. **Nadie en el material lo hace** |

### 6.14 Qué código leer antes de escribir el nuestro

| # | Repositorio | Licencia | Qué leer y por qué |
|---|---|---|---|
| 1 | **fontanf/packingsolver** | **MIT** | `include/packingsolver/boxstacks/instance.hpp` — el modelo de datos a copiar: `enum Rotation`, `stackability_id`, `nesting_height`, `maximum_stackability`, `maximum_weight_above`, `BinType.maximum_stack_density`, y sobre todo **`fixed_items`** (= nuestro caso híbrido). Y `algorithms/truck.hpp`: `compute_axle_weights()`, **la física de ejes que EasyCargo vende como diferencial, resuelta con dos agregados** |
| 2 | **jerry800416/3D-bin-packing** | **MIT** | La capa de estabilidad completa y con nombre: `fix_point` (*"resolves floating items via gravity simulation"*), `check_stable`, `support_surface_ratio`, `loadbear`, y `bin.gravity` que *"divides container into four equal sections and calculates weight ratios per section"* — **ese KPI por cuadrantes se dibuja en SVG casi gratis** y es el mismo análisis de 4 zonas que vende Gateway. Salvedad del propio repositorio: la función `binding` *"reported to crash"* |
| 3 | **olragon/binpackingjs** | **MIT** | La única base JS/TS portable sin fricción: cero dependencias de ejecución, con sacudida de árbol, ESM+CJS. Leer por la forma de la API en TypeScript y por sus cuatro heurísticas MaxRects (el **plan B medido** de §6.3) |
| 4 | **ptv-logistics/tutorials-bin-packing** | **Apache-2.0** | `convertResponsePackedBins.js` — el mapeo respuesta de API → visor. Es exactamente el problema `Solution` → SVG isométrico. También el patrón `switchSelectedBin(step)` |
| 5 | **thebitpusher/boxologic** | **SIN LICENCIA** — ver C11 | **Leer, NO portar.** Vale por el modo capa/paleta: `analyze_box` con prioridad de cuatro niveles estricta, las cuatro situaciones de `pack_layer`, el `layerinlayer` de `checkfound`, y la guarda de cubo |
| 6 | **enzoruiz/3dbinpacking** (py3dbp) | — | El linaje del que descienden casi todos los ports JS/TS. Leerlo para saber qué se heredaría si alguien propone "usemos una librería" |
| 7 | **zhanghx0905/binpacking-visualizer** | **SIN LICENCIA** | Solo por el esquema JSON de solución. Es TypeScript + Next.js, mismo stack. **No reutilizable legalmente** |

**Y el mejor contrato de datos gratuito que existe, aunque no sea código abierto:** el **OpenAPI 3.0.3 de Cargo-Planner** (`api.cargo-planner.com/api/2/schema/`, 215 KB, **público sin autenticación**, 41 endpoints, 101 esquemas). De ahí se copia la máscara de orientaciones, el vocabulario de reglas, el `StatusEnum` de errores, la salida `pos` + `bb`, y los endpoints incrementales.

**Papers a leer antes de la primera línea:** Crainic/Perboli/Tadei CIRRELT-2007-41 (algoritmos verbatim y tablas de decisión) · Junqueira & Queiroz, Pesquisa Operacional 2021 (restricciones de factor de soporte) · GRASP multiparada, Pesquisa Operacional 2015 (los tres tipos formalizados) · Bortfeldt & Wäscher WP 7/2012 (la taxonomía completa; **dato de calibración: solo 74 de 158 papers (46,9%) tratan dos o más restricciones a la vez, y el máximo observado es siete simultáneas — si nuestro motor cubre 6-8 restricciones reales, está por encima del 95% de la literatura**) `V` · CTU Code 2014.

---

## 7. Restricciones y normas marítimas que nos diferencian

**Ninguna herramienta del material las implementa.** `V` en cuanto a lo revisado. Todas modelan **camión**: ejes, perno rey, EC 96/53, FHWA, metros de carga. Cube-IQ tiene centro de gravedad como rango en porcentaje, pero es genérico, no normativo. Gateway tiene marcador de centro de gravedad y mapa de calor, sin norma detrás. **Nadie emite VGM. Nadie chequea excentricidad ISO. Nadie documenta retención de registros.**

Esto no es un detalle: DTD hace China→Venezuela por mar. **La capa marítima es el diferencial que ninguna herramienta del mercado nos puede quitar copiando la interfaz.**

### 7.1 Excentricidad del centro de gravedad — CTU Code Anexo 7 §3.1, verbatim `V`

> *"Where freight containers, including flatracks or platforms, will be lifted and handled in a level state during transport, the cargo should be so arranged and secured in the freight container that its joint centre of gravity is close to the mid-length and mid-width of the freight container. **The eccentricity of the centre of gravity of the cargo should not exceed ±5% in general.** As a rule of thumb this can be taken as **60% of the cargo's total mass in 50% of the freight container's length**. Under particular circumstances an eccentricity of **up to ±10% could be accepted**, as advanced spreaders for handling freight containers are capable of adjusting for such eccentricity."*

Y el capítulo de terminales confirma que **es un chequeo operativo real, no teoría** `V`:

> *"Ensure, during the lifting of the CTU by any terminal equipment, that an evaluation is made by the operator to check that the mass of the cargo is reasonably evenly distributed. If it is determined to exceed the '60% within half the length rule', the terminal should take steps to rectify the problem."*

### 7.2 Centro de gravedad transversal y vertical — Anexo 7 §1.11, verbatim `V`

> *"In longitudinal direction the centre of gravity of the packed cargo should be within allowed limits. In transverse direction the centre of gravity should be close to the half width of the CTU. **In vertical direction the centre of gravity should be below half the height of the cargo space of the unit.**"*

Ver **C3** sobre el 50% vs. 40%.

**Escape operativo que da la propia norma** `V`: *"If these conditions cannot be met, suitable measures should be taken... e.g. by external marking of the centre of gravity and/or by instructing forwarders/carriers."*

→ **El reporte de DTD debería imprimir la marca externa de centro de gravedad cuando el plan no cumple. Eso es un entregable que nadie más produce.**

### 7.3 Fórmula oficial — Apéndice 4 §3 `V`

`d = Σ(mn · dn) / Σ mn`, con `mn` en toneladas y `dn` la distancia del centro de gravedad de esa masa desde el frente del área de estiba, en metros.

**Ejemplo oficial, que es el test unitario número 1 del módulo:** 3,5 / 4,2 / 3,7 / 2,2 / 4,9 t a 0,7 / 1,4 / 3,0 / 3,8 / 5,1 m → Σm = 18,5 t, Σ(m·d) = 52,78 t·m, **d = 2,85 m**.

**El cálculo es O(1) por colocación.** Se mantienen cuatro acumuladores enteros:

```
sumW, sumWx, sumWy, sumWz     // gramos y gramos·mm
cog = { x: sumWx/sumW, y: sumWy/sumW, z: sumWz/sumW }
```

PackingSolver confirma el mismo patrón para ejes: `compute_axle_weights(weight_weighted_sum, weight)` toma **solo dos agregados** `V`. **Es decir: el chequeo de centro de gravedad y de ejes se puede evaluar dentro de la función de mérito sin costo apreciable.**

### 7.4 Los gates

```
excentricidad_long = |cog.y - L/2| / L
  <= 0.05  → OK           (CTU Anexo 7 §3.1)                          V
  <= 0.10  → ADVERTENCIA  (aceptable con esparcidores avanzados)       V
  >  0.10  → BLOQUEO                                                   I (nuestra política)

excentricidad_transv:  cerca de la mitad del ancho                     V (cualitativo)
cog.z <= H/2                                                           V

regla 60/50: ventana deslizante de largo L/2 sobre el eje Y;
  si la masa máxima en cualquier ventana > 60% del total → bandera     I (operacionalización)
```

**La operacionalización de la regla 60/50 con ventana deslizante es INFERIDA.** El CTU dice qué chequear, no cómo. Marcarlo así en el código y en el reporte: es interpretación operativa, no texto normativo.

**No confundir dos reglas distintas de 60** — mezclarlas es un error de negocio `V`:
- **CTU 60/50** = 60% de la masa en el 50% del largo → chequeo de **excentricidad marítima**
- **Regla 60/40 de gocubic** = ~60% del peso hacia el frente y 40% atrás, óptimo 55–60%, advertencia 50–55 o 60–65, peligro <50 o >65 → chequeo de **distribución en camión**

**El centro de gravedad como restricción, no solo como reporte.** Cube-IQ lo hace con rango mínimo/máximo en porcentaje del largo y da dos ejemplos numéricos: sin control, coloca los pesados al fondo; con 40–60%, quedan centrados; con 75–95%, quedan al frente `V`. Advertencia honesta de Cargo-Planner sobre su `cog_limit`: *"will most likely affect the utilization... in a negative way"* `V`.

**Por eso va como penalización en la función de mérito en modo normal, y como rechazo duro solo en modo marítimo estricto.**

### 7.5 Carga concentrada y piso — ver C4

Lo que sí dice el texto oficial `V`:
- Cap. 7: *"modern freight containers are designed to withstand a force of **0,5 kN/cm²** which may limit package masses to approximately **3 to 3,5 tons** depending on the type of forklift truck used"* — límite de **carga concentrada por rueda de montacargas**
- Anexo 7 §3.1.1: el piso está diseñado para que *"the permissible payload P, **if homogeneously distributed** over the entire loading floor, can safely be transferred to the four corner posts"*, incluyendo *"a safety margin for temporary weight increase due to vertical accelerations during a sea passage"*
- Cuando la carga **no** es homogénea, *"the limitations for concentrated loads should be considered"* y puede requerirse repartir con **vigas de reparto** cuyo dimensionamiento *"should be designed in consultation with the CTU operator"*
- Paredes laterales de open-top: soportan *"a uniform load equal to 60% of the payload"*

**Gate correcto para DTD** (esto es diferencial puro):
1. Presión concentrada por bulto = peso / huella, contra el límite del piso
2. Bandera **"requiere vigas de reparto"** cuando un bulto excede el límite concentrado, con la nota de que el dimensionamiento va consultado con el operador del CTU
3. **No** un simple kg/m² uniforme

### 7.6 VGM — SOLAS VI/2 `V`

- **Responsable:** *"The shipper named on the ocean bill of lading"*. La obligación **no se delega** usando terceros como agentes.
- **Método 1** (pesaje del contenedor lleno): el comprobante exige **ocho datos** — número de aprobación de la báscula, nombre de la empresa de pesaje, fecha, dirección, número de contenedor, número de precinto, nombre y firma del operador, sello de la empresa.
- **Método 2** (suma): tara + masa del producto sin empaque + masa del empaque primario + *"the mass of all other packaging, pallets, dunnage, space fillers and securing material"*.
- **Salvedad crítica del Método 2 para nuestro diseño:** la información de masa *"is only reliable when clearly and permanently marked on the surfaces of individual, original sealed packages and cargo items"*; si no, *"the mass must be determined by weighing"*.

  → **Un VGM calculado por el motor solo es defendible si los pesos por bulto vienen marcados o documentados, no estimados.** Hay que modelar la **procedencia del peso** por bulto (`marcado | declarado | estimado`) y **bloquear la emisión de VGM cuando hay estimados**.
- **Tolerancias** (Hong Kong como referencia de jurisdicción): ±5% para masa bruta > 10 t; ±0,5 t para ≤ 10 t.
- **Retención:** *"shall retain all the documents and records related to verification of gross mass of a packed container for a period not less than 1 year"*. **Encaja directo con ISO 9001 §7.5 del repositorio**: el VGM emitido se archiva con trazabilidad.
- Transportista y terminal *"have no legal obligation to check the value so communicated"* → **si el VGM está mal, el problema es del embarcador. Es decir, de DTD.**
- Solo aplica a contenedores con carga, no vacíos.

### 7.7 Descargo legal — patrón a copiar tal cual

EasyCargo mantiene un texto permanente al pie de la pantalla de distribución de peso: *"Even the best effort is done to provide a precise calculation of weight distribution, still, **it is only the mathematical simulation**"* `V`. **Se cayó por accidente en una versión y lo repusieron por parche urgente.** CargoWiz es aún más directo: *"The program creates a load plan without regard to safety considerations."* `V`

**DTD debe mostrar el equivalente en toda superficie que muestre centro de gravedad, ejes o VGM.** Es la señal más clara del dossier sobre dónde está el riesgo legal del producto.

---

## 8. Lagunas: qué sigue sin saberse y cómo se averiguaría

Ordenadas por relación valor de cierre / costo de cierre.

| # | Laguna | Costo de cierre | Cómo se cierra |
|---|---|---|---|
| **1** | **Las ~60 capturas del Handbook v7 nunca se analizaron.** Está descargado (13,7 MB, `ec_handbook.pdf`) pero **solo se extrajo el TEXTO.** Esto cierra de un golpe: aspecto de las barras de utilización, forma de las flechas de eje, cómo se dibuja la parte transparente, aspecto del "muro invisible", flechas de rotación, diseño del reproductor paso a paso, y la captura de pantalla completa que falta | **Minutos.** Es la mejor relación de todo el listado | `pdfimages` sobre el PDF ya descargado |
| **2** | **Conteo real de reglas de Cargo-Planner** (C9: 25 / 29 / 30+ / 34) y el vocabulario exacto de cada una | **Minutos** | Descargar `api.cargo-planner.com/api/2/schema/` (público, sin autenticación, 215 KB) y contar los enum de `LoadRule` |
| **3** | **Tiempo real del algoritmo de puntos extremos** (C1) | Horas | Implementar el núcleo (~50 líneas) y medir con un consolidado real de DTD. **No hay atajo: los dos números publicados difieren en tres órdenes de magnitud** |
| **4** | **Cómo se renderizan las barras de utilización de EasyCargo** | Ver #1 | Cierra con las capturas del Handbook. Si no aparecen, no importa: usar dos barras (volumen y peso) + campo "factor limitante" es estrictamente mejor |
| **5** | **Definición verbatim de `canTakeProjection`** — la única pieza reconstruida del núcleo del algoritmo | Horas | Solo se cierra con el paper completo de INFORMS JoC (de pago) o validando por pruebas de propiedades (T8). **La segunda vía es suficiente y gratis** |
| **6** | **No hay vara absoluta de utilización.** El porcentaje de llenado sobre las instancias BR1–BR15 sigue inaccesible (ScienceDirect 403). Las únicas cifras publicadas son relativas: +7% de mejora (claim de EasyCargo) y 85–92% de llenado **en paletas** (MagicLogic, no contenedor) | Alto | **Consecuencia práctica: no se puede fijar una meta numérica de % de llenado como criterio de aceptación.** Usar comparación relativa contra el plan manual actual de DTD. Eso además es más honesto comercialmente |
| **7** | **Umbral de carga uniforme por m² del piso** (C4). Requiere **ISO 1496-1**, norma de pago | Costo de la norma | Comprar la ISO, o no comprarla y quedarse con presión concentrada + bandera de vigas de reparto, que es lo que el CTU realmente exige |
| **8** | **Tabla canónica de contenedores** (C5) | Decisión propia | No se cierra con fuentes: hay cuatro tablas incompatibles. **DTD fija la suya, la versiona como dato, y separa `door_h`/`door_w` del interior.** Contrastar con las especificaciones de los contenedores que DTD realmente embarca |
| **9** | **Restricciones MILP formales de resistencia al apilado y fragilidad** (Junqueira 2012, Computers & OR 39(1):74-85) — tras muro de pago. Sí tenemos las de factor de soporte de 2021 | Costo del paper | Comprarlo si se decide ir más allá del factor de soporte. **No hace falta para la v1** |
| **10** | **Licencia de boxologic** (C11) | Minutos | Abrir un issue en el repositorio preguntando. Mientras tanto: leer sí, portar no |
| **11** | **El cuerpo de `compute_axle_weights` de PackingSolver** — solo se leyeron README y encabezados | Horas | Leer `src/algorithms/truck.cpp`. Solo hace falta si se quiere portar la física de ejes de camión |
| **12** | **Hex exactos de la paleta de EasyCargo** | **Irresoluble** | El cliente es un binario Unity/WebGL: **los colores viven en el binario y no son extraíbles del DOM.** No importa: nuestra paleta sale de los tokens `var(--*)` de BRAND.md. Lo que sí copiamos es la **semántica**, que está completa |
| **13** | **El algoritmo interno de EasyCargo** | **Irresoluble por fuentes externas** | Se leyó el Handbook completo (53 pp.), el FAQ, la API y todas las notas de versión. Lo máximo que publican es "las cajas más grandes primero", "del frente al fondo", "por capas para paletas" y "apila en altura para minimizar piso". **No hay patente ni paper de Bee Interactive s.r.o.** Ya no vale la pena atacarla: el modelo de Cargo-Planner más la literatura de puntos extremos cubren toda la necesidad de diseño |
| **14** | **¿Existe un competidor que una plan 3D con captura en piso?** Dos pasadas de búsqueda no lo encuentran | Medio | **No se puede probar una no existencia.** Lo que falta revisar es el mundo WMS de primer nivel que integra el motor Cube-IQ (Körber, Blue Yonder, Manhattan) y que también tiene módulos de escaneo. Si alguien lo tiene, está ahí |
| **15** | **Corpus de quejas de usuarios de EasyCargo** — cinco plataformas vacías, G2 bloqueado por anti-bot | Medio | Único camino: G2 con extracción sigilosa, o buscar en foros de logística (Reddit r/logistics, foros checos). **Pero el hallazgo ya es la respuesta: el líder no tiene validación social pública** |
| **16** | **Orden exacto de las columnas A–J del Excel de EasyCargo** | Bajo | Su plantilla solo se descarga desde dentro de la app (que no tenemos). **No importa: el contrato de columnas de DTD lo fijamos propio** |
| **17** | **Cómo se ve el "muro invisible" de los grupos de prioridad, las flechas de rotación y el reproductor paso a paso** | Ver #1 | Todas cierran con las capturas del Handbook |

---

## Resumen ejecutable

- **Motor:** puntos extremos, Best-Fit-Decreasing, mérito de espacio residual, doble pasada agrupada (área-altura ε=10 y altura-área ε=22), la mejor gana. Determinista, enteros en mm/g, sin aleatoriedad, sin corte por tiempo.
- **Capa física separada del colocador:** gravedad → caja envolvente real → factor de soporte α=0,75 con tolerancia de 5 mm → validación por **torre** (`grounded`) → peso acumulado por columna **y** presión por área → matriz de apilado → multiparada "visible" como restricción blanda.
- **Puerta como gate propio**, separada del interior. Es la restricción que decide de verdad y **ninguna caja de EasyCargo la modela**.
- **Modelo de datos:** máscara de bits de orientaciones 1..63, `stackabilityId`, `maxWeightAbove`, `maxPressureAbove`, `maxLayers`, `bottomOnly`, `nestingHeight`, `margin`, `groupId`, `classId`, `destinationId`. Salida = esquina mínima + caja envolvente + rotación + paso + `supportedBy` + `grounded`.
- **Cuatro planes comparables** del mismo cargamento, si el tiempo lo permite (C1 sin resolver).
- **Visual:** el reporte paso a paso con desaturación selectiva es el entregable número uno, es 100% SVG estático, y es lo que ellos necesitan Unity para producir.
- **Capa marítima como diferencial:** excentricidad ±5%/±10%, regla 60/50, centro de gravedad vertical <50% H, presión concentrada con bandera de vigas de reparto, VGM Método 2 con procedencia del peso por bulto y retención de un año.
- **Capa híbrida como diferencial:** siembra de puntos extremos desde el estado escaneado + endpoints incrementales + el diferencial plan-vs-real como entregable. **Ninguna herramienta del material lo hace, y EasyCargo estructuralmente no puede.**
- **El KPI que hay que medir desde el día uno porque es la debilidad conocida de la heurística elegida:** soporte lateral (Bischoff & Ratcliff), no solo porcentaje de volumen.
- **Antes de escribir la primera línea:** correr `pdfimages` sobre `ec_handbook.pdf` y descargar el OpenAPI de Cargo-Planner. Son minutos y cierran las dos lagunas más grandes.