# Brief de rediseño — Ventana "Servicios sobre tu compra" (video-first)
### Portal del cliente · DTD Cargo · para Cloud Design

> **Para:** Cloud Design · **De:** DTD Cargo
> **Qué es:** rediseño de la pantalla donde el cliente, al registrar una compra, pide **servicios de
> recepción** (verificar, inspeccionar, reempacar, etiquetar, hold, etc.). Hoy los videos tutoriales
> existen pero están **escondidos detrás de 3 clics**. Queremos que el **video de cada servicio sea
> protagonista**: que el cliente entienda en segundos qué es cada alerta, viéndola, antes de decidir.
> **Referencia de concepto:** el courier de la competencia ya incrusta el tutorial dentro de la ventana
> de alertas — ese es el nivel de claridad que buscamos, con **material y guion 100% DTD** (ver más abajo).

---

## 1. El problema (estado actual)

El flujo hoy obliga a: **"+ Ver servicios" → marcar el checkbox del servicio → botón "Mira el video"**
→ recién ahí carga un iframe pequeño. Tres interacciones antes de ver el tutorial. Consecuencia: el
cliente marca (o descarta) servicios **sin entender qué son**. El video llega tarde, cuando ya decidió.

**Objetivo del rediseño:** el video es lo primero que ve el cliente en cada servicio, **integrado con la
decisión de pedirlo** — aprender y elegir en el mismo lugar.

---

## 2. Dirección recomendada — "Galería seleccionable" (⭐)

Una sola ventana que **fusiona** la galería de videos con el selector. Cada servicio es una tarjeta que
muestra su **video vertical** (miniatura con botón ▶) + nombre + una línea + control claro para pedirlo.

### Wireframe · móvil (prioridad — el portal se usa desde el teléfono)

```
┌─────────────────────────────────────────────┐
│  Servicios sobre tu compra                   │  ← título de la sección
│  Míralos, y pídenos lo que necesites al       │
│  llegar tu compra a la bodega.                │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ ✓ Pídelos ANTES de que tu compra llegue │ │  ← aviso "antes de bodega" (verde, ya existe)
│  │   a nuestra bodega en China.            │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌───────┐  Verificación al recibir          │  ← TARJETA de servicio
│  │  ▶    │  Abrimos, contamos contra tu       │
│  │ 9:16  │  factura y te enviamos fotos.      │
│  │ thumb │                                    │
│  │ 0:38  │              [  Pedir este  ]      │  ← toggle/checkbox claro
│  └───────┘                                    │
│                                               │
│  ┌───────┐  Inspección de calidad al recibir │
│  │  ▶    │  Revisión técnica: interior,       │
│  │ 9:16  │  etiquetado y gramaje.             │
│  │ thumb │              [  Pedir este  ]      │
│  └───────┘                                    │
│                                               │
│  … (una tarjeta por servicio activo) …        │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ ☐ Entiendo que estos servicios los       │ │  ← consent (aparece si hay ≥1 pedido)
│  │   coordina y cotiza mi asesor…           │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│           [   Registrar compra   →   ]        │
└─────────────────────────────────────────────┘
```

### Tarjeta al marcar "Pedir" — se expande hacia abajo

```
┌───────┐  Verificación al recibir            ✓
│  ▶    │  Abrimos, contamos y te enviamos fotos.
│ 9:16  │
│ thumb │  ┌────────────────────────────────────┐
└───────┘  │ Notas: detalla qué debe traer tu    │  ← textarea (ya existe)
           │ compra (cantidades, tallas…)        │
           └────────────────────────────────────┘
           ┌────────────────────────────────────┐
           │ Trackings a unificar (uno por línea)│  ← SOLO servicios multi-tracking
           └────────────────────────────────────┘     (Reempaque · Hold)
```

### Comportamiento del video
- La miniatura muestra el **poster del short** (thumbnail de YouTube) con un botón ▶ y la duración.
- **Tap en el poster → reproduce.** Puede ser inline (crece la tarjeta) o en un **lightbox** vertical
  centrado — a criterio de Cloud Design, lo que se sienta más limpio en móvil.
- **Nunca se autoreproducen varios videos a la vez** (perf + datos móviles): la miniatura es una imagen; el
  reproductor real carga solo al tap. Esto ya está resuelto en el código, respétenlo en el diseño.
- Formato de todos los videos: **vertical 9:16** (estilo Shorts). Ya especificado en el brief de
  producción — no cambia.

**Por qué esta dirección:** conecta el aprendizaje con la decisión en el mismo golpe de vista. El cliente
ve el video → entiende → pide. Sin ventanas intermedias, sin galería separada que nadie abre.

---

## 3. Alternativa — "Tira de reels" arriba + checklist compacto abajo

Si Cloud Design prefiere separar "mirar" de "elegir": una **tira horizontal de videos verticales**
(estilo historias) arriba, que el cliente desliza para aprender; y debajo, una lista compacta de
casillas para pedir. Válida, pero nos gusta menos: reintroduce la desconexión entre ver y decidir.
Inclúyanla solo como comparación si les aporta.

---

## 4. Matriz de estados (el diseño DEBE cubrirlos todos)

| Estado | Qué mostrar |
|---|---|
| Servicio **con** video (interruptor de video ON + URL) | Miniatura (poster) + ▶ + duración. Tap reproduce. |
| Servicio con video **ON pero sin URL aún** | Placeholder sobrio: "Video de ayuda próximamente" (nunca un iframe roto). Mismo tamaño de tarjeta. |
| Servicio con **video OCULTO por el admin** (interruptor de video OFF) | **No muestra el video ni "próximamente"** — la tarjeta queda solo con nombre + descripción + "Pedir". El servicio sigue disponible; solo se esconde su tutorial. |
| Servicio **inactivo** (admin apagó el servicio) | **No aparece** en la lista. |
| Servicio **pedido** (marcado) | Tarjeta resaltada + se expande con notas (+ trackings si es multi-tracking). |
| **≥1 servicio pedido** | Aparece el consentimiento obligatorio antes de "Registrar compra". |
| **Ningún servicio activo** | La sección entera no se muestra. |

**El set de servicios es configurable.** El admin activa/desactiva/agrega servicios desde configuración
(los precios se atan a tarifas del ERP). **El diseño NO asume una lista fija**: renderiza los servicios
**activos** que le llegan — hoy **5**. Debe verse bien con 3, con 5 o con 8. Cada servicio trae, aparte,
su propio **interruptor de video** (mostrar/ocultar su tutorial) independiente del on/off del servicio.

**Servicios multi-tracking** (muestran el campo extra de varios trackings): **Reempaque** y **Hold**.
El resto, no.

---

## 5. Reglas de marca y copy (no se rompen)

- **Solo tokens `var(--*)`** del portal — cero hex inventados. Paleta: **vino** + **navy** sobre fondo
  claro/paper. Tipografía **Archivo** (la capa producto Sora/Nunito del Norte NO aplica a este archivo:
  el portal real corre Archivo).
- **Cero AI slop**: nada de gradientes coloridos, glassmorphism ni emojis decorativos. Sobrio, confiable.
- **Copy en tuteo venezolano, cero voseo** ("pídenos", "mira", "elige" — nunca "pedí/mirá/elegí").
- **Nunca precios ni montos.** El cierre siempre es *"lo coordina y cotiza tu asesor"*.
- **Palabra "responsabilidad" prohibida** de cara al cliente (deberes del cliente = "corre por tu cuenta").
- **No** usar "MARKBOX" en texto visible (el término al cliente es "Shipping Mark", pero acá ni aparece).
- Contraste **AA** en todo texto (≥4.5:1; grande ≥3:1).

---

## 6. Qué ya está construido (no rediseñar el backend)

- El admin ya gestiona los servicios desde configuración: activa/desactiva/agrega cada uno + interruptor
  de video + (a futuro) precios atados a tarifas del ERP. **Ese lado es backend — no es parte de este
  rediseño.** El diseño solo consume la lista de servicios activos que le llega.
- El cliente ya envía la selección dentro del `<form>` de "Nueva compra": casillas + notas + trackings
  + consentimiento. El rediseño es **puramente visual/UX de esa ventana** — mismos datos de salida.
- **Los 5 servicios activos hoy** y su copy oficial (nombre + descripción) — úsenlos textual:
  **Verificación al recibir · Inspección de calidad al recibir · Reempaque (unificar bultos) ·
  Etiquetado por pieza · Hold (retener para consolidar).**
  *(Compactar y Cotizar/medir salieron del menú del cliente; no los incluyan. Como el set es
  configurable, diseñen para "N servicios", no para estos 5 exactos.)*

---

## 7. Qué necesitamos de Cloud Design (entregable)

1. **Mockup navegable en HTML** de la ventana rediseñada, en móvil (prioridad) y desktop, mostrando:
   - estado "explorando" (videos visibles, nada pedido),
   - estado "pidiendo" (2-3 servicios marcados + notas expandidas + consentimiento),
   - el caso "video próximamente".
2. Que respete la **matriz de estados** (§4) y las **reglas de marca** (§5).
3. Entrega por el flujo habitual (HTML plano o bundle offline) para que lo auditemos antes de aprobar.

> **Método de auditoría nuestro (FYI):** desempacamos el HTML y verificamos cero términos vetados
> (responsabilidad / DDP / MARKBOX / montos / voseo) + contraste + fidelidad a los 7 servicios.

---

## Anexo — Referencia de concepto (NO copiar)

El courier de la competencia incrusta el tutorial dentro de su ventana de alertas. Es la **idea de
producto** que validamos, no un diseño a copiar: guion, voz, material y paleta son **100% DTD**, y el
recorrido va de **China a Venezuela**. Las transcripciones de esos videos están en
[brief-videos-ayuda.md](./brief-videos-ayuda.md) solo como apoyo de mensaje.
