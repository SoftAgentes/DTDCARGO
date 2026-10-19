# PROMPT MAESTRO — Producción de los 5 videos de Pre-alertas del Portal DTD Cargo

> **Para:** una IA que trabaja con **Codex** en la máquina de Sam (founder de DTD Cargo).
> **Generado:** 2026-07-20 · **Fuente:** investigación completa del repo + disco local.
> **Cómo se usa:** pegar este archivo completo (o adjuntarlo) como primer mensaje de la sesión de Codex.

---

## 0. Quién eres y qué vas a hacer

Eres el productor técnico de una serie de **5 videos tutoriales verticales** que van **dentro del portal del cliente** de DTD Cargo. Su único objetivo: que un importador venezolano entienda, en menos de un minuto, **qué es una pre-alerta** y qué servicios puede pedir sobre su compra antes de que llegue a nuestra bodega en China.

Todo el trabajo previo ya está hecho: catálogo, guiones, guía de producción, arte final de Cloud Design. **Tu trabajo NO es inventar el contenido — es ejecutarlo.** Este documento te dice exactamente dónde está cada pieza.

**Antes de escribir una sola línea, lee los archivos de la sección 3 en el orden indicado.** No asumas nada que no esté en ellos.

---

## 1. Contexto del negocio (lo mínimo indispensable)

- **DTD Cargo** = marca pública **y también el nombre del ERP interno** (57 módulos; el ERP dejó de llamarse "DoorTuDoor" el 2026-07-14). **DoorTuDoor** hoy es sólo el **sello de herencia**. El handle es **@dtdcargo.ve**.
- Negocio: logística y trading **puerta a puerta China → Venezuela**. Equipo propio en **Yiwu (China)** y **Valencia (Venezuela)**.
- **Jamás Miami, jamás "casillero".** Nuestra ruta es China → Venezuela. (Esto importa porque la referencia de la que copiamos el *patrón* es un courier Miami→Venezuela.)
- **Fundación = 2015** (Venezuela). 2008 = "en el comercio con China desde…" (experiencia, no fundación). Nunca digas que la empresa existe desde 2008 o 2010.
- **Identificador del cliente:** se llama **"Shipping Mark"** en todo texto visible. **NUNCA "MARKBOX"** (ese es el nombre interno de la columna en base de datos).

### Qué es una pre-alerta en DTD (y por qué es distinta a la competencia)

El cliente compra en China → **avisa en el portal** que le va a llegar mercancía (eso es la pre-alerta) → el sistema le da un **link que él comparte con su proveedor chino** → el proveedor llena la factura y el packing list en línea → el sistema **genera las etiquetas** → el proveedor las pega → el operario en Yiwu **escanea** al recibir.

**El mensaje estrella: "Se acabaron los grupos de WeChat".** El link al proveedor reemplaza el caos de chats.

Sobre esa misma pre-alerta el cliente puede pedir **servicios adicionales (add-ons)**, y ahí entran los otros 4 videos.

> ⚠️ **Diferencia estructural con la competencia:** en su sistema la pre-alerta ES el contenedor y validación/HOLD/reempaque son *tipos* de pre-alerta. En DTD, la **pre-alerta es la compra** y los servicios son **add-ons encima**. Por eso nosotros necesitamos un "video madre" que explique qué es la pre-alerta — ellos no lo tienen.

### La distinción que el cliente SIEMPRE confunde (debe quedar explícita)

| | Qué es | ¿Fotos/videos del producto? |
|---|---|---|
| **Validación** (`verificacion`) | **Solo conteo**: ¿llegó la cantidad pedida? nº de cajas + nº de productos adentro, contra factura/packing | Fotos de confirmación sí; **no** es revisión de calidad |
| **Inspección de calidad** (`inspeccion_recepcion`) | Abrir una pieza, revisar interior, gramaje, grosor, etiquetado, los tecnicismos que el cliente especifique | Sí, fotos **y videos** |

---

## 2. De dónde salió la idea: **One Way Cargo / OneWayID**

> El founder recuerda el nombre como *"OneWeb"* — **es incorrecto**. La empresa se llama **One Way Cargo**, y su portal de clientes es **OneWayID**. No existe ninguna referencia a "OneWeb" en ningún archivo.

- Courier **Miami → Venezuela**. Sitio: `onewaycargo.net` (secciones `/servicios`, `/tarifas`, `/condiciones`).
- Su copy de pre-alerta, literal: *"Activa requerimientos para tus pedidos antes de que ingresen a nuestro almacén en Miami para garantizar una gestión rápida y sin errores."*
- Tienen una sección **"Infografía de pre-alerta"** — o sea, ellos también resolvieron esto con material visual, y de ahí salió nuestra idea.
- Su menú: aéreo · marítimo · **Pre-Alerta tus Pedidos** · compactación gratuita · reempaque · seguro · pick up en Miami · personal shopper (20%) · compra sin tarjeta internacional.
- Se hizo **ingeniería inversa autorizada por el founder** de su portal. Está documentado en `docs/specs/0098-prealerta-addons/spec.md:23`.

### 🔴 REGLA DURA — qué se toma y qué NO

Se toma **el patrón**: qué comunican primero, cuánto dura cada bloque, cómo enganchan en los primeros 3 segundos, cómo cierran.

**PROHIBIDO, sin excepción:**
- Copiar frases, guiones, voces, música, arte o capturas de One Way.
- Publicar, incrustar, citar o mencionar sus videos en nuestro contenido.
- Compartir las transcripciones de referencia con el productor externo — son **material interno**.
- Trasladar sus reglas de negocio (ellos cobran storage fee y manejan plazos de "3 días hábiles"; **nada de eso es nuestro**).

**El patrón que sí replicamos** (con contenido 100% propio):
1. Abren con una pregunta o situación en 2ª persona que describe el problema del cliente.
2. Nombran el servicio de inmediato (segundo 3–5).
3. El centro del video son **los pasos en la app**, en imperativo simple, un paso por corte.
4. Cierran **siempre** con la regla de validez temporal.

Nuestra versión del cierre (hablado **y** en pantalla, en los 5 videos):
> **"Pídelo ANTES de que tu compra llegue a nuestra bodega en China."**

Variantes válidas: **Re-Empaque** = *"antes de que llegue el PRIMER bulto"* · **Pre-alerta** = además cierra con *"la pre-alerta es GRATIS"*.

---

## 3. Dónde está TODO — mapa de archivos

### 3.1 En el repositorio

Raíz: `c:\Users\Trabajo\Desktop\Developer\software\DTDCargo\`

**📖 Lee en este orden exacto (los 4 primeros son obligatorios):**

| # | Archivo | Qué es |
|---|---|---|
| 1 | `docs/marketing/servicios-infografias/videos/GUIA-PRODUCCION.md` | **El contrato de producción.** Formato, marca, voz, reglas de edición, §6b (flujo de pantalla a grabar), checklist de entrega. **Esto manda.** |
| 2 | `docs/marketing/servicios-infografias/videos/ENTREGA-PRODUCTOR.md` | El "speech" de entrega al productor: las 11 recomendaciones que importan + tabla de los 5 videos. |
| 3 | `docs/marketing/servicios-infografias/HANDOFF-CLOUD-DESIGN.md` | Brief maestro **v3.1**. §1 = tabla de **naming canónico (esa tabla manda, no inventar sinónimos)** · §3 mapa de dependencias · §4 flujo del portal de pre-alertas · §8 las 8 reglas duras · §10 fases y gates. |
| 4 | `docs/marketing/servicios-infografias/CATALOGO-MAESTRO.md` | Catálogo reconciliado con el código. 5 grupos, los 3 servicios principales, las decisiones cerradas del founder del 18 y 19 de julio. |
| 5 | `docs/marketing/servicios-infografias/README.md` | Copy fuente: patrón de 7 secciones por infografía, reglas de redacción, bloque de contacto estándar, placeholders del founder. |

**Los 5 guiones** — `docs/marketing/servicios-infografias/videos/`:

| Video | Brief | Código / archivo final |
|---|---|---|
| 1. **Pre-alerta** (el video madre) | `brief-prealerta.md` | `prealerta` → `dtd-video-prealerta.mp4` |
| 2. **Validación** | `brief-validacion.md` | `verificacion` → `dtd-video-verificacion.mp4` |
| 3. **Etiquetado de piezas** | `brief-etiquetado.md` | `etiquetado_pieza` → `dtd-video-etiquetado_pieza.mp4` |
| 4. **HOLD** | `brief-hold.md` | `hold_consolidar` → `dtd-video-hold_consolidar.mp4` |
| 5. **Re-Empaque** | `brief-reempaque.md` | `reempaque_unificar` → `dtd-video-reempaque_unificar.mp4` |

Cada brief trae 3 secciones: **(a)** productor/diseñador — escenas, rótulos, duración · **(b)** guion palabra por palabra + tono · **(c)** edición — cortes, subtítulos, música, CTA.

**Fichas de servicio** (si el guion contradice la ficha, **gana la ficha**):
`docs/marketing/servicios-infografias/prealerta-compra.md` · `validacion.md` · `inspeccion-al-recibir.md` · `etiquetado-piezas.md` · `hold.md` · `reempaque.md` (24 fichas en total en esa carpeta).

**Entregable interactivo ya armado para el productor:**
`docs/marketing/assets/produccion-videos-dtd.html` — 1067 líneas, HTML offline autocontenido (doble clic, sin internet): trae el speech, la guía completa, los 5 guiones con **teleprompter** y **seguimiento de progreso por etapa** en localStorage. **Este es el archivo que se le manda a quien produce.**

**Documentos de origen (contexto histórico, contienen material interno):**
- `docs/specs/0098-prealerta-addons/spec.md` — la spec madre (`done`). Aquí está declarada la ingeniería inversa de One Way.
- `docs/specs/0098-prealerta-addons/assets/brief-videos-ayuda.md` — brief original. ⚠️ **Contiene las transcripciones literales de los videos de One Way** (validación, reempaque, HOLD). Es material **interno**: sirve para entender el flujo, **jamás se copia ni se comparte fuera**.
- `docs/specs/0098-prealerta-addons/assets/brief-rediseno-ventana-servicios.md` — propuesta de **rediseño video-first** del portal (hoy el video está a 3 clics; la propuesta ⭐ es "Galería seleccionable" donde el thumbnail 9:16 ES la tarjeta del servicio).
- `docs/specs/0163-orden-al-operario/spec.md` — ⚠️ hueco abierto: el operario en China **no ve** los servicios que el cliente pidió.

**Código relevante (para entender qué existe de verdad):**
- `lib/studio/prealertas/addons.ts` — el catálogo de los 7 add-ons. Los 7 tienen **`videoUrl: null`** hoy. Este es el campo que los videos van a llenar.
- `app/portal/_components/PrealertaAddons.tsx` — el componente del portal que embebe el YouTube Short (video contextual al marcar el servicio + galería permanente).
- `app/studio/(app)/admin/_components/RecepcionAddonsSection.tsx` — **la pantalla del ERP donde se pega el link del Short cuando el video esté listo** (Studio › Admin › add-ons de recepción). Valida que sea `https://` de `youtube.com` o `youtu.be`.

### 3.2 Fuera del repo — `C:\Users\Trabajo\Downloads\`

⚠️ **Esto NO está versionado en git.** Es el trabajo entregado por **Cloud Design** el 18 y 19 de julio. Si algo se borra de Descargas, se pierde.

**Briefs consolidados que se le pasaron a Cloud Design:**
- `DTD-brief-cloud-design-P1.md` (34 KB · 18-jul 21:28)
- `DTD-brief-cloud-design-P2.md` (39 KB · 19-jul 03:30)
- `DTD-brief-cloud-design-P3.md` (60 KB · 19-jul 05:32)

**Entregas de Cloud Design (arte final — HTML autocontenido, se abre con doble clic):**
| Archivo | Qué trae |
|---|---|
| `Gate 1 · Servicios · Cloud Design.html` | Aprobación del **Gate 1**: mapa general, portada de /servicios, plantilla de 7 zonas, naming |
| `Entrega · Tanda 1 · DTD-Cargo.html` | Speech de entrega de la Tanda 1 |
| `Tanda 1 · Arte Final · DTD-Cargo.html` | **P1**: mapa + Puerta a Puerta, LCL, FCL, **Pre-alerta**, **Validación** |
| `Tanda 2 · Arte Final · DTD-Cargo.html` | **P2**: Inspección al recibir, **Etiquetado**, **HOLD**, **Re-Empaque**, Seguro + el flujo del portal *"Tres entradas, cinco pasos, tres actores"* |
| `Tanda 3 · Arte Final · DTD-Cargo · OFFLINE.html` (505 KB) | **P3**: Verificación de proveedores, Pago asistido, Registro de marca, Compra asistida, Tránsito de aduana, PSI, Terrestre/Aéreo/Cursos |
| `Mapa de Servicios · Presentación Asesor.html` | Versión presentación del mapa |

> 🎨 **Estas 4 últimas son la fuente visual de los videos.** El arte final de las infografías de Pre-alerta, Validación, Etiquetado, HOLD y Re-Empaque ya existe ahí — los videos deben verse como una **animación de ese arte**, no como un estilo nuevo.

**PDFs de referencia (probablemente descargados del sitio de One Way el 18-jul 19:12–19:16 — verificar antes de usar):**
- `prealerta.pdf` (4.5 MB) + `prealerta (1).pdf` + `prealerta (2).pdf` — copias idénticas
- `reempaque.pdf` (4.5 MB)
- `handling-fee.pdf` (208 KB)

> ⚠️ Si estos PDFs son de One Way: son **referencia interna de estructura**, igual que sus videos. **No se copia su arte ni su copy.** Confirmar el origen con Sam antes de abrirlos como insumo de diseño.

**Assets de marca (logo kit, entregado el 20-jul):**
- `DTD-Cargo (1).zip` + carpeta `DTD-Cargo (1)/` — Logo Kit: isologo PNG/SVG + lockups
- `DTDCargo-Isologo-{Transparente,Navy}.png`, `DTDCargo-Logo-Apilado-Transparente.png`
- `DTDCargo-Lockup-{Hero-200px,Card-120px,Sidebar-80px,Mínimo-48px}@4x.png`
- `DTD-Cargo-handoff*.zip` (×4, ~460 MB c/u, 19-jul) — handoffs completos de Cloud Design
- `SYNC-DESIGN-SYSTEM-2026-07-19.md` y `-19b.md` — syncs del design system

**Fotos reales de la operación (b-roll):**
- En Descargas: `DTDCargo_Recibiendo_contendor*.png/jpg`, `DTDCargo_Puerto.jpg`
- En el repo: `docs/design/studio/_norte/assets/` — isologos + fotos reales de bodega, contenedor, producto, `insp-bat/*.jpg`

---

## 4. Las decisiones que YA están cerradas (no re-litigar)

| Decisión | Detalle | Fecha |
|---|---|---|
| **100% SIN CARA** | Nadie a cámara. Voz en off + animación branded + grabación de pantalla. Donde un brief diga "presentador a cámara", se lee como **voz en off + rótulo**. Las caras van **solo a redes sociales**; dentro de la plataforma → FAQ + Shorts sin cara. Ventaja: si cambia el personal, no hay que rehacer nada. | 19-jul |
| **Voz** | **Locución IA** (preferida — se re-edita si cambia el copy) o locutor DTD que no se muestra. | 19-jul |
| **Idioma** | Español **venezolano neutro, TUTEO**. "tú tienes / puedes / quieres". **CERO voseo** ("activá / pedí / mirá" = bug, es argentino). Cero anglicismos. | fija |
| **Formato de referencia** | Tutoriales tipo **Binance Academy** (gráfico, narrado, texto en pantalla) — **NO su estética amarilla**. El sistema visual es DTD. | 19-jul |
| **PRECIOS: JAMÁS** | Ningún monto, ninguna tarifa. La línea es: *"este servicio puede tener un cargo extra — lo ves al solicitarlo en tu portal"*. **Excepciones:** la pre-alerta se dice **GRATIS**, y en HOLD se puede decir **"15 días de bodegaje gratis"** (es un plazo, no un monto). | 18-jul |
| **Grabación de pantalla obligatoria** | En los 5 videos, con cuenta demo. Flujo exacto en §6b de la guía. | 18-jul |
| **Servicios fuera del menú** | `compactar` y `cotizar_medir` salieron del menú → **no llevan tutorial**. | 19-jul |
| **Inspección de calidad** | Quedó **sin tutorial** en la serie actual (el Draft A la reemplazó por el video madre de pre-alerta). Es una decisión a revisar con Sam, no un olvido tuyo. | 19-jul |

---

## 5. Especificaciones técnicas

| Ítem | Especificación |
|---|---|
| **Formato** | Vertical **9:16** · 1080×1920 (YouTube Short / Reel) |
| **Duración** | **30–45 s** objetivo · **máximo 60 s** (guion hablado 30–50 s) |
| **Estructura** | Gancho (0–3 s) → problema/qué es (3–12 s) → pasos en el portal (12–35 s) → regla + CTA (últimos 5–8 s) |
| **Plataforma** | Cada video se sube como **YouTube Short público** → se entrega el **link/ID** (alimenta el campo `videoUrl` del portal) |
| **Audio** | Voz clara + **subtítulos quemados** (la mayoría ve sin sonido) |
| **Nombre de archivo** | `dtd-video-<codigo>.mp4` con el código técnico exacto de la tabla §3.1 |
| **Miniatura** | Template de thumbnail consistente: mismo diseño, varía solo el nombre del servicio |

**Identidad visual** (`BRAND.md` manda — leerlo antes de tocar nada visual):
- **Colores:** vino `#7F0F1A` (acentos, CTA) · navy `#0F1E3D` (texto, fondos oscuros) · fondo claro `#FBFAF7`. **Cero hex inventados.**
- **Tipografía:** Archivo (UI) · **Archivo Black** (rótulos display) · JetBrains Mono solo si aparece un código o tracking en pantalla.
- **Isologo:** intro y outro de ~2 s + logo pequeño fijo en una esquina durante todo el video. Variantes en `public/brand/dtdcargo-isologo-*.png`.
- **Cero AI slop:** nada de gradientes coloridos, glassmorphism ni emojis decorativos.
- **Rótulos:** nombre canónico del servicio en los primeros 5 s (tabla §1 del HANDOFF).

**Edición:**
- Un corte cada 2–4 s en los bloques de pasos; el gancho puede ser un solo plano. Nada estático más de 5 s.
- B-roll **real** (bodega, cajas, cinta, etiquetas, manos contando) **sin rostros protagonistas**. Prohibido stock genérico reconocible como stock.
- Música de librería con licencia, ritmo medio, **-18 dB** bajo la voz. Sin drops estridentes. SFX sutiles.
- **CTA final estándar en los 5:** `dtdcargo.com` + WhatsApp **+58 412 166 8021** + **@dtdcargo.ve** (rótulo + hablado).

---

## 6. 🎬 Grabación de pantalla — dónde sacar exactamente las tomas

**Esta sección es la que suele quedar mal hecha. Léela dos veces.**

### 6.1 Reglas de la grabación

- **Cuenta DEMO siempre.** Jamás datos reales de clientes en pantalla.
- Pantalla limpia: sin notificaciones, sin pestañas ajenas, zoom cómodo para vertical.
- El **cursor (o el dedo) visible y pausado ~1 segundo en cada clic** — el espectador tiene que ver dónde se oprime.
- La grabación entra como **inserto** mientras la voz en off narra ese paso (pantalla completa o recuadro grande).
- Si el **rediseño del portal (Cloud Design) sale antes de grabar → grabar sobre el portal NUEVO.** Si no, se graba el actual y se regraba el inserto después. **El guion no cambia.**

### 6.2 Dónde está el portal

- **Producción:** `https://dtdcargo.com/portal` — login en `/portal/login`, acceso por **magic link** (enlace mágico al correo).
- **Local:** `pnpm dev` → `http://localhost:3000/portal`
  ⚠️ **Advertencia crítica:** el entorno local de DTD apunta **SIEMPRE a la base de datos de producción** (desde el corte del 2026-10-14, el Supabase del servidor propio, `https://supabase.dtdcargo.com`; antes, Supabase Cloud `xpfuzqombmjmxvprjgmi` · nota del 2026-10-19). **`pnpm dev` = PRODUCCIÓN.** No hay base local. Cualquier cosa que crees mientras grabas es un registro real. Por eso la cuenta demo es obligatoria — pídesela a Sam antes de grabar.

### 6.3 Rutas reales del portal (verificadas en el código)

```
/portal/login                          → entrada (magic link)
/portal/compras                        → "Mis compras" — la lista de pre-alertas
/portal/compras/[code]/etiquetas       → detalle de la compra: etiquetas + servicios
/portal/proveedores                    → "Tus proveedores" (otra entrada a Nueva compra)
/portal/envios · /portal/envios/[code] → seguimiento
/portal/facturas · /portal/finanzas · /portal/documentos · /portal/soporte
```

### 6.4 Flujo de clics a grabar, video por video

| Video | Flujo exacto de pantalla |
|---|---|
| **1. Pre-alerta** | Portal → **Mis compras** (`/portal/compras`) → botón **Nueva compra** → llenar el formulario (proveedor, descripción, cajas) → confirmar → pantalla de **etiquetas** (`/portal/compras/[code]/etiquetas`) → botón **Compartir con mi proveedor** (mostrar que se genera el link) |
| **2. Validación** | Compra → sección **Servicios** → tarjeta **Validación** → clic en solicitar → pantalla de confirmación |
| **3. Etiquetado** | Compra → **Servicios** → tarjeta **Etiquetado de piezas** → elegir la opción (código de barras / etiqueta física) → solicitar |
| **4. HOLD** | Compra → **Servicios** → tarjeta **HOLD** → indicar qué mercancía espera → solicitar |
| **5. Re-Empaque** | Compra → **Servicios** → tarjeta **Re-Empaque** → **lista de trackings** (este campo multi-tracking es el diferenciador, muéstralo bien) → solicitar |

> 💡 La sección "Servicios" vive en el componente `app/portal/_components/PrealertaAddons.tsx` y en `app/portal/(app)/compras/[code]/etiquetas/ServiceSection.tsx` (bloque **"+ Pedir un servicio"**). Hoy los servicios están **detrás de 3 clics** ("+ Ver servicios" → checkbox → "Mira el video") — eso es justamente lo que el rediseño video-first quiere arreglar. Grábalo tal como esté el día que grabes.

### 6.5 Herramienta sugerida para capturas reproducibles

El repo ya tiene **Playwright** configurado (`pnpm test:e2e`, MCP de Playwright disponible) y hay precedente: el video de registro se grabó con un demo HTML automatizado por Playwright (`docs/marketing/videos/registro-demo.html` + `video-registro-markbox.md`). Si necesitas capturas idénticas y repetibles, ese es el camino — no grabes a mano lo que puedes guionizar.

---

## 7. Núcleo de cada guion (el detalle completo está en su brief)

| # | Video | Duración | Núcleo del guion |
|---|---|---|---|
| 1 | **Pre-alerta** (madre) | ~46 s | Hilo conductor visual = **la etiqueta** (nace en el portal → el proveedor la pega → el operario la escanea). 7 escenas: gancho → chat caótico simulado → "Nueva compra" → el proveedor llena el packing list en línea → bodega de Yiwu escaneando → tarjetas de servicios de llegada → cierre. Rótulo estrella: **"Se acabaron los grupos de WeChat"**. Único video que dice un precio: **"la pre-alerta es GRATIS"**. |
| 2 | **Validación** | ~48 s | *"Confirma que llegó todo lo que pagaste."* Abrir caja → contar contra factura → fotos al cliente → cómo pedirla en el portal → **aclaración obligatoria: "Validación = conteo · Inspección = calidad"** (la confusión #1 del cliente) → cierre. |
| 3 | **Etiquetado de piezas** | ~48 s | *"Del contenedor al anaquel."* Problema: etiquetar producto por producto en Venezuela. **2 opciones como tarjetas gemelas** (código de barras / etiqueta física — ninguna es superior a la otra) → pedirlo en la pre-alerta → reporte con fotos → beneficio caja→producto→estante. **No confundir con los QR de las cajas.** |
| 4 | **HOLD** | ~50 s | Contraste en espejo: **SIN HOLD (tu caja se va sola) vs CON HOLD (viajan juntas)** → regla clave: el descuento aplica solo en el **MISMO contenedor** → cómo pedirlo → bloque de **honestidad**: esperar suma días, *"es el costo de ahorrar"*. Sí se pueden decir los **15 días de bodegaje gratis**. |
| 5 | **Re-Empaque** | ~46 s | *"Junta varias compras en un solo envío."* 5 bultos dispares → 1 caja DTD → **un solo packing list** → listar trackings en el portal (multi-tracking = el diferenciador) → regla especial: **"antes de que llegue el PRIMER bulto"**. Encuadre: unificar compras de Alibaba (NO el viejo encuadre de "cajas defectuosas"). Diferenciador: no genera bodegaje mientras se procesa. |

---

## 8. Cómo trabajar con Codex en esta máquina

**Configuración existente:**
- Config global: `C:\Users\Trabajo\.codex\config.toml` · `C:\Users\Trabajo\.codex\AGENTS.md`
- Config del proyecto: `.codex/config.toml` en la raíz del repo
- **Comandos disponibles:** `.codex/commands/` (40+ comandos: `avivar`, `build`, `plan`, `design`, `redesign`, `critique`, `polish`, `landing`, `inspeccionar`, `temple`, `ui-*`…)
- **Prompts:** `.codex/prompts/` — `el-yunque.md`, `bucle-agentico-sprint.md`, `agent-action-stream.md`, `agent-builder-vercel.md`
- **PRPs (planes de construcción):** `.codex/PRPs/` — `pieza-base.md`, `pieza-ai.md`
- **Skills y agentes:** `.codex/skills/`, `.codex/agents/`, `.codex/design-systems/`

**Qué debes hacer al arrancar:**
1. Correr `/avivar` (o leer `AGENTS.md` de la raíz) para cargar el contexto del proyecto.
2. Leer **`AGENTS.md`** de la raíz del repo — es el archivo fuente de las reglas (`CLAUDE.md` solo lo importa).
3. Leer **`BRAND.md`** antes de tocar cualquier cosa visual.
4. Si vas a generar un plan de trabajo, usa el formato de `.codex/PRPs/pieza-base.md`.
5. **No existe ningún plan previo guardado en Codex sobre estos videos** — se buscó y no hay. Todo el plan vive en los archivos markdown de la sección 3. Si generas uno, guárdalo en `docs/marketing/servicios-infografias/videos/`.

> **Nota de `~/.codex/AGENTS.md`:** cada respuesta final debe cerrar con dos secciones — **## Pendientes** (concreto, o `Ninguno`) y **## Recomendación** (`Recomiendo avanzar con: [acción]`).

---

## 9. Reglas del proyecto que NO se rompen

**De trato con Sam (el founder):**
- Español **venezolano neutro, TUTEO, CERO voseo**. Usa "tú tienes / puedes / quieres / mira". **Nunca** "vos tenés / podés / mirá / dale". El voseo es argentino y no se habla en Venezuela.
- Directo, sin relleno ni adulación. Salidas listas para copiar, con rutas explícitas.
- Opciones ordenadas por prioridad, con **⭐ en la #1**. Preguntas cortas.
- Decir "Fase 5", nunca "F5".

**De git:**
- **Verificar la rama antes de commitear.** **NO hacer push sin el OK explícito de Sam.**
- Commits **selectivos**, nunca `git add -A` (hay varias ventanas trabajando en paralelo).
- Formato: `feat(DTD-NNNN): …` (público) o `feat(studio): SDD-NNNN — título` (ERP).

**De contenido:**
- El mensaje de cada video = el de su ficha. **Si el guion contradice la ficha, gana la ficha.**
- **Sin WeChat** en ningún flujo mostrado (el link al proveedor lo reemplaza).
- **Sin nombrar terceros ejecutores** de ningún servicio (V-Trust, QIMA, SGS, CIS, WEINSPECTION, HQTS son white-label — nunca públicos). Todo es servicio DTD.
- Ruta y geografía: bodega en **Yiwu, China** → **Venezuela**. Nunca Miami, nunca "casillero".
- La razón social y el RIF van **solo en el schema** de la web, nunca en texto visible.

---

## 10. Checklist de entrega por video

- [ ] Vertical 9:16 · menos de 60 s
- [ ] **100% sin cara** (voz en off + gráfico + grabación de pantalla · nadie a cámara)
- [ ] Subtítulos quemados, legibles en teléfono (contraste AA mínimo)
- [ ] Intro/outro con isologo + logo en esquina
- [ ] Voz en off en tuteo venezolano, sin voseo
- [ ] Rótulo con el nombre canónico del servicio en los primeros 5 s
- [ ] Aparece la regla "antes de que llegue a la bodega" (hablado **y** en texto)
- [ ] **NO** menciona montos ni precios (salvo las 2 excepciones permitidas)
- [ ] Muestra los pasos reales en el portal (cuenta demo, cursor pausado)
- [ ] CTA final: `dtdcargo.com` + WhatsApp +58 412 166 8021 + @dtdcargo.ve
- [ ] Cero material (visual o verbal) de la competencia
- [ ] Archivo nombrado `dtd-video-<codigo>.mp4`
- [ ] Subido como YouTube Short **público** y el link entregado

**Cierre del ciclo (esto es lo que hace que el trabajo sirva de algo):**
El link de cada Short se pega en **Studio › Admin › add-ons de recepción** (`RecepcionAddonsSection.tsx`), campo `video_url`. Eso llena el `videoUrl` que hoy está en `null` para los 7 add-ons, y el video aparece automáticamente en el portal del cliente vía `PrealertaAddons.tsx`. **Hasta que ese link no se pegue, el cliente no ve nada.**

---

## 11. Estado real y qué falta

**✅ Hecho:**
- Spec SDD-0098 en producción — el menú de add-ons funciona en el portal.
- Catálogo maestro + 24 fichas de servicio.
- Los 5 guiones completos con teleprompter.
- Guía de producción + speech de entrega.
- HTML interactivo listo para el productor.
- Cloud Design: Gate 1 aprobado + arte final de las 3 tandas entregado.

**🔴 Falta:**
1. **Producir los 5 videos.** Nada grabado todavía.
2. **Los 7 add-ons tienen `videoUrl: null`** — el portal muestra "próximamente".
3. **Rediseño video-first del portal** (`brief-rediseno-ventana-servicios.md`) — propuesto, sin construir. Decide con Sam si se graba antes o después.
4. **SDD-0163 orden al operario** — hueco grave: el cliente pide el servicio y **el operario en China no lo ve** en su app (`app/m/cn`). Se vende algo que nadie ejecuta.
5. **Inconsistencia a resolver:** `compactar` y `cotizar_medir` figuran como "fuera del menú" desde el 19-jul, pero en `lib/studio/prealertas/addons.ts` siguen con `isActive: true`. Solo están apagados si alguien los desactivó por base de datos.
6. **Decidir** si "Inspección de calidad" recupera su tutorial (se cayó de la serie cuando entró el video madre).

---

## 12. Tu primer paso

No empieces a producir. Empieza así:

1. Lee los 5 archivos obligatorios de la §3.1 y los 5 briefs.
2. Abre los 3 HTML de arte final de Cloud Design en Descargas (Tanda 1 y 2 son las que contienen las 5 piezas de esta serie).
3. Devuelve a Sam un **plan de producción** con: orden de los 5 videos, qué assets faltan, qué necesitas de él (cuenta demo, acceso a b-roll, voz), y una estimación.
4. Pregunta lo que esté ambiguo **antes** de producir — sobre todo si se graba sobre el portal actual o se espera el rediseño.

**Recomiendo arrancar por el video 1 (Pre-alerta, el video madre):** es el único sin referencia de la competencia, es 100% propio, y los otros 4 dependen de que el cliente entienda primero qué es una pre-alerta.
