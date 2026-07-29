# Guía de producción — Videos de servicios DTD Cargo

> **Estado:** borrador · 2026-07-18 · Hilo de marketing (`docs/marketing/servicios-infografias/`).
> Aplica a los **5 briefs** de esta carpeta (serie confirmada por el founder 18-jul):
> [brief-prealerta.md](brief-prealerta.md) · [brief-validacion.md](brief-validacion.md) ·
> [brief-etiquetado.md](brief-etiquetado.md) · [brief-hold.md](brief-hold.md) ·
> [brief-reempaque.md](brief-reempaque.md).
> **Relación con el brief previo:** reusa las especificaciones técnicas de
> `docs/specs/0098-prealerta-addons/assets/brief-videos-ayuda.md` (SDD-0098). Estos briefs
> **desarrollan y reemplazan** los mini-briefs #1 (`verificacion`), #5 (`etiquetado_pieza`),
> #7 (`hold_consolidar`) y #3 (`reempaque_unificar`) de aquel documento; el resto sigue vigente.

> ### ⚠️ FORMATO ACTUALIZADO — decisión founder 2026-07-19: **100% SIN CARA**
> Estos son **tutoriales**, no comerciales: **nadie aparece a cámara**. Se resuelven con **voz en off**
> (locución IA o locutor DTD que no se muestra) + **animación/gráfico branded** + **grabación de pantalla**
> del portal, en formato **YouTube Short**. **Donde cualquier brief diga "presentador a cámara", se lee
> como voz en off + gráfico/rótulo** — nunca una persona. El b-roll de operación (cajas, manos, bodega)
> sigue válido como apoyo, sin rostros protagonistas.
> **Split de canal (regla founder):** las **caras van SOLO en redes sociales** (explicar los dolores del
> cliente, captación). **Dentro de la plataforma** (cliente ya adentro) → **FAQ + Shorts tutoriales sin
> cara**. Este cambio deja sin efecto la premisa "Fiorella a cámara" del 18-jul.

---

## 1. Regla de oro (antes que todo)

Se estudiaron videos de un courier de la competencia **solo para extraer su ESTRUCTURA y ritmo**
(qué comunican primero, cuánto dura cada bloque, cómo cierran). Eso es todo lo que se toma.

- **NUNCA copiar frases, guiones, voces, música, arte ni capturas de la competencia.** Es su IP.
- Las transcripciones de referencia son **material interno** — no se publican, no se citan, no se
  embeben, no se comparten con el productor externo.
- Nuestro guion es 100% DTD: **nuestro proceso** (pre-alerta en el portal, link al proveedor,
  bodega en Yiwu), nuestra ruta (**China → Venezuela**, jamás Miami) y nuestra voz.
- La competencia cobra "storage fee" y maneja plazos propios (3 días hábiles, etc.): **nada de eso
  se traslada a nuestros videos**. Nuestras reglas son las de nuestras fichas.

## 2. Qué aprendimos de la referencia (estructura, no copy)

Patrón que funciona y que replicamos con contenido propio:

1. **Abren con una pregunta o situación en 2ª persona** que describe el problema del cliente
   ("¿quieres estar seguro de que…?", "tienes varios paquetes por llegar…").
2. **Nombran el servicio de inmediato** (segundo 3–5) — el espectador sabe qué está viendo.
3. **El centro del video son los pasos en la app**, en imperativo simple, uno por corte.
4. **Cierran SIEMPRE con la regla de validez temporal** ("debe crearse antes de que la mercancía
   llegue al almacén") — es lo último que se escucha y se ve.

Nuestra versión de ese cierre (hablado **y** en pantalla, en los 5 videos):
**"Pídelo ANTES de que tu compra llegue a nuestra bodega en China."**
*(Variantes válidas: Re-Empaque = "antes de que llegue el PRIMER bulto" · Pre-alerta = cierra con
"la pre-alerta es GRATIS" además de la regla.)*

## 3. Formato

| Ítem | Especificación |
|---|---|
| Formato | Vertical **9:16** · 1080×1920 (YouTube Short / Reel) |
| Duración | **30–45 s** objetivo · máximo 60 s (guion hablado: 30–50 s) |
| Estructura | Gancho (0–3 s) → problema/qué es (3–12 s) → solución + pasos en el portal (12–35 s) → regla + CTA (últimos 5–8 s) |
| Plataforma | Cada video se sube como **YouTube Short público** → se entrega el link/ID (alimenta el campo `videoUrl` del portal) |
| Audio | Voz clara + **subtítulos quemados** (muchos clientes ven sin sonido) |
| Nombre de archivo | `dtd-video-<codigo>.mp4` con el código técnico del portal: `dtd-video-prealerta.mp4` (sin add-on: la pre-alerta no es un servicio) · `dtd-video-verificacion.mp4` · `dtd-video-etiquetado_pieza.mp4` · `dtd-video-hold_consolidar.mp4` · `dtd-video-reempaque_unificar.mp4` |
| Miniatura | Template de thumbnail consistente: mismo diseño, varía solo el nombre del servicio |

## 4. Identidad visual (BRAND.md manda)

- **Colores** (tokens del sistema, cero hex inventados): vino `#7F0F1A` (acentos, CTA) · navy
  `#0F1E3D` (texto, fondos oscuros) · fondo claro `#FBFAF7`. Nada de gradientes coloridos,
  glassmorphism ni emojis decorativos (**cero AI slop**).
- **Tipografía:** Archivo (UI/textos) · **Archivo Black** (rótulos y títulos display) ·
  JetBrains Mono solo si aparece un código/tracking en pantalla.
- **Isologo:** intro y outro de ~2 s con el isologo DTD (variantes aprobadas en
  `public/brand/dtdcargo-isologo-*.png`); logo pequeño fijo en una esquina durante el video.
- **Rótulos:** el nombre del servicio aparece como rótulo en los primeros 5 s, con el naming
  canónico de `HANDOFF-CLOUD-DESIGN.md` §1 (esa tabla manda — no inventar sinónimos).
- Identificador del cliente = **"Shipping Mark"**, jamás "MARKBOX", si llegara a verse en pantalla.

## 5. La voz y el formato (SIN CARA)

- **Nadie aparece a cámara.** La narración es **voz en off**: locución IA (preferida — se re-edita si
  cambia el copy) o un locutor DTD que **no se muestra**. Cero rostro protagonista, cero avatar IA con cara.
- **Español venezolano neutro, TUTEO** ("tú tienes / puedes / quieres"). **CERO voseo** (nada de
  "activá / pedí / mirá") y cero anglicismos innecesarios.
- Tono: cálido, directo, de asesor que te resuelve — no de locutor de comercial. Frases cortas.
- **Cómo se llena la pantalla sin cara:** animación/ilustración branded (estilo tutorial, no estética de
  la competencia) + **grabación de pantalla** del portal (§6b) + rótulos con el mensaje clave + b-roll de
  operación (cajas, manos, etiquetas) **sin rostros protagonistas**.
- Ventaja del sin-cara: si cambia el personal de la empresa, **no hay que rehacer ningún video**.

## 6. Reglas de edición

- **Subtítulos quemados** en todo el video (Archivo, alto contraste sobre navy o fondo claro;
  legible en pantalla de teléfono — contraste AA mínimo).
- **Ritmo:** un corte cada 2–4 s en los bloques de pasos; el gancho puede ser un solo plano.
  Nada de pantallas estáticas de más de 5 s.
- **B-roll real:** bodega, cajas, cinta de embalar, etiquetas, manos contando/empacando —
  material propio de la operación (Yiwu u oficina). **Prohibido** stock genérico de "warehouse"
  reconocible como stock, y prohibido cualquier material de la competencia.
- **Capturas del portal:** grabaciones de pantalla reales del portal del cliente (flujo
  "Nueva compra" → marcar el servicio → notas → registrar). Sin datos reales de clientes en
  pantalla (usar cuenta demo).
- **Rótulos:** nombre del servicio al inicio; palabras clave del mensaje como texto de apoyo
  (máximo 4–6 palabras por rótulo); la regla "antes de la bodega" SIEMPRE como rótulo al cierre.
- **Música:** de librería con licencia, ritmo medio, volumen bajo la voz (-18 dB aprox). Sin
  drops estridentes. SFX sutiles para transiciones y aparición de rótulos (whoosh/pop discretos).
- **CTA final estándar (los 5 videos):** portal **dtdcargo.com** + WhatsApp **+58 412 166 8021**
  + "@doortudoor_" · rótulo + hablado.

## 6b. Grabación de pantalla del portal (OBLIGATORIA en los 5 videos — founder 18-jul)

Cada video incluye **tomas de pantalla del portal del cliente en movimiento** (screen recording), para
que el espectador vea **exactamente dónde oprimir** para solicitar el servicio mientras la voz en off narra.

- **Cuenta DEMO siempre** — jamás datos reales de clientes. Pantalla limpia (sin notificaciones,
  sin pestañas ajenas, zoom cómodo para móvil vertical).
- **Qué grabar por video** (el flujo de clics del cliente):
  | Video | Flujo de pantalla a grabar |
  |---|---|
  | Pre-alerta | Portal → **Mis compras** → botón **Nueva compra** → llenar (proveedor, descripción, cajas) → confirmar → pantalla de **etiquetas** → botón **Compartir con mi proveedor** (el link) |
  | Validación | Compra → sección **Servicios** → tarjeta **Validación** → clic solicitar → confirmación |
  | Etiquetado | Compra → **Servicios** → tarjeta **Etiquetado de piezas** → elegir opción → solicitar |
  | HOLD | Compra → **Servicios** → tarjeta **HOLD** → indicar qué espera → solicitar |
  | Re-Empaque | Compra → **Servicios** → tarjeta **Re-Empaque** → lista de trackings → solicitar |
- **Montaje:** la grabación de pantalla entra como **inserto** mientras la voz en off narra ese paso
  (pantalla completa o recuadro grande; el cursor/dedo visible y pausado en cada clic ~1 s).
- **Si el rediseño del portal (Cloud Design) llega antes de grabar → grabar sobre el portal NUEVO;**
  si no, se graba el actual y se regraba el inserto cuando salga el rediseño (el guion no cambia).

## 7. Reglas de contenido que NO se rompen

- **NUNCA mencionar precios, montos ni tarifas** (regla founder 18-jul). El cierre de costo siempre es:
  *"este servicio puede tener un cargo extra — lo ves al solicitarlo en tu portal"* (el monto vive en el
  ERP y el portal lo muestra cuando esté configurado; también vale "lo cotiza tu asesor" como refuerzo).
- **En los videos** aparece (hablado y en texto): *"Pídelo antes de que tu compra llegue a
  nuestra bodega en China."* **Excepción Re-Empaque:** su variante correcta es *"antes de que llegue
  el PRIMER bulto"* (la ficha manda — no "corregir" el guion del Re-Empaque a la frase estándar).
- El mensaje de cada video = el de su ficha (`validacion.md`, `hold.md`, copy de Re-Empaque del
  `CATALOGO-MAESTRO.md`). Si el guion contradice la ficha, gana la ficha.
- Sin WeChat en ningún flujo mostrado (el link al proveedor lo reemplaza).
- Sin nombrar terceros ejecutores de ningún servicio. Todo es servicio DTD.
- Ruta y geografía: bodega en **Yiwu, China** → **Venezuela**. Nunca Miami, nunca "casillero".

## 8. Checklist de entrega (por video)

- [ ] Vertical 9:16 · menos de 60 s
- [ ] **100% sin cara** (voz en off + gráfico + grabación de pantalla · nadie a cámara)
- [ ] Subtítulos quemados legibles en teléfono
- [ ] Intro/outro con isologo + logo en esquina
- [ ] Voz en OFF en tuteo venezolano, sin voseo
- [ ] Rótulo con el nombre canónico del servicio en los primeros 5 s
- [ ] Aparece la regla "antes de que llegue a la bodega" (hablado + texto)
- [ ] NO menciona montos/precios ni plazos sin confirmar
- [ ] Muestra los pasos reales en el portal (cuenta demo)
- [ ] CTA final: dtdcargo.com + WhatsApp +58 412 166 8021
- [ ] Cero material (visual o verbal) de la competencia
- [ ] Archivo nombrado `dtd-video-<codigo>.mp4`
