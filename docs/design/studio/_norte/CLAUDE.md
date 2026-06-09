# DTD-Cargo · Brand Guardrails

> **Para Claude Code:** este archivo define las reglas de marca y sistema de diseño de DTD-Cargo. Antes de aplicar **cualquier** cambio visual (colores, tipografía, componentes, espaciado, copy), validá contra estas reglas. Si lo que te piden contradice una regla, **avisá al usuario antes de aplicar el cambio** con el formato definido al final.

---

## 🚨 Comportamiento esperado

1. **Leé este archivo completo al inicio de cada sesión.** No lo resumas, no lo skipees.
2. **Antes de aplicar cualquier cambio visual**, comparalo contra las reglas de abajo.
3. **Si detectás una violación**, NO apliques el cambio en silencio. Mostrá el aviso con el formato `BRAND-CHECK` (definido al final) y esperá confirmación explícita del usuario.
4. **Si el usuario insiste**, anotá que es una excepción documentada (con su responsabilidad), aplicalo, y registrá la decisión como comentario en el código:
   ```
   /* BRAND-EXCEPTION: <descripción> — autorizado por <usuario> el <fecha> */
   ```
5. **Nunca inventes valores nuevos** de color, fuente, radius, sombra o spacing. Usá **siempre** las variables CSS del sistema (`var(--*)`). Si necesitás algo que no existe, preguntá primero.

---

## 🖼 Logo y lockup · sistema oficial v1.0

> **Para cualquier uso del logo, leé `BRAND-MIGRATION-2026-05.md` en la raíz del proyecto.** Ese archivo tiene la spec completa, el componente `<Lockup>`, y la auditoría de migración.

### Las 4 variantes oficiales

| Variante | Archivo | Sobre fondo | Ratio WCAG |
|---|---|---|---|
| **Primary** | `assets/dtdcargo-isologo-primary.png` | Light, paper, white | 14.8 : 1 |
| **Reverse** | `assets/dtdcargo-isologo-reverse.png` | Navy, ink, sidebar | 12.4 : 1 |
| **Mono light** | `assets/dtdcargo-isologo-mono-light.png` | Wine, CTA, alerta | 7.2 : 1 |
| **Mono dark** | `assets/dtdcargo-isologo-mono-dark.png` | Paper, B&W, sello | 15.3 : 1 |

### Componente

```jsx
<ERPUI.Lockup variant="primary" size={40} />
<ERPUI.Lockup variant="reverse" size={36} orientation="isologo-only" />
<ERPUI.Lockup variant="mono-light" size={44} />
```

### Wordmark · "DTD Cargo" (DOS palabras)

- Fuente: **`Archivo Black`** (`font-weight: 900`)
- `DTD` en wine `#7F0F1A` · `Cargo` en navy `#0F1E3D` (primary)
- Letter-spacing: `-0.02em`
- Gap entre palabras: `0.15em` vía `<span style="display:inline-block; width:0.15em;">`
- **Nunca** "DTDCARGO" (todo mayúsculas, una palabra) → siempre "DTD Cargo"

### Reglas absolutas del logo

1. **Nunca** `dtdcargo-isologo-primary.png` sobre fondo navy/wine — ratio 1.1:1 → invisible.
2. **Nunca** `filter: brightness(0) invert(1)` sobre el isólogo. Ya existe la variante `mono-light` que es cream sólido nativo.
3. **Nunca** usar `var(--wine-soft)` (`#C2747F`) en el texto "DTD" del wordmark. `wine-soft` es un acento decorativo (charts, badges, hover), no del logo.
4. **Nunca** inventar variantes nuevas (`super-dark`, `accent`, etc.). Son exactamente 4.
5. **Nunca** usar `Inter`, `Roboto`, `Helvetica` o `system-ui` para el wordmark. Solo `Archivo Black`.

### Para ver el sistema en vivo

Abrir **`Logo Oficial.html`** — el carrusel muestra las 4 variantes con sus fondos correspondientes, ratio WCAG, y archivo asociado. Sliders en vivo para ajustar tamaño/spacing y un diff panel que muestra cualquier cambio vs los valores default.

---

## 🎨 Sistema de color · ÚNICA fuente de verdad

Los colores viven en `erp/tokens.css`. **Nunca** uses hex literales en HTML/JSX cuando exista un token equivalente.

### Light theme
```
--wine:        #7F0F1A   /* Acento primario · CTAs · links · acentos */
--wine-deep:   #5E0A12   /* Hover de wine */
--wine-soft:   #C2747F   /* Acento secundario · solo sobre fondo oscuro */

--bg-base:     #FBFAF7   /* Fondo de página */
--bg-surface:  #FFFFFF   /* Cards */
--bg-elevated: #F2F0EC   /* Hover · modales */
--bg-sidebar:  #0F1E3D   /* Sidebar / superficies oscuras */

--ink:         #0F1E3D   /* Texto principal · navy */
--ink-soft:    #6B6B6B   /* Texto secundario */
--ink-mute:    #9B9B9B   /* Caption / placeholder */

--border:      #E8E6E2

--success: #1F8A5B   /* Solo para confirmaciones reales */
--warning: #B8893A   /* Solo para riesgo real (ETA en demora, etc.) */
--danger:  #A8323E   /* Solo para errores y vencidos */
--info:    #2A6FDB
```

### Dark theme — `[data-theme="dark"]`
```
--wine:        #A8323E
--wine-soft:   #D89AA4
--bg-base:     #0B1428
--bg-surface:  #16264A
--bg-elevated: #1F3055
--ink:         #F2F0EC
--ink-soft:    #A8B0C4
```

### ❌ Colores PROHIBIDOS
- **NUNCA** uses verde fosforescente, lima, neón, fucsia eléctrico o ningún color saturado fuera de la paleta.
- **NUNCA** uses `red`, `blue`, `green`, `orange`, `purple` como nombres CSS. Usá los tokens.
- **NUNCA** inventes hex como `#FF5733`, `#00FFAA`, etc.
- **NUNCA** uses gradientes coloridos / arcoíris / "AI slop". Único gradiente permitido: dark navy → ink (`linear-gradient(135deg, var(--ink), #1F3055)`) en el login/portal hero.
- **NUNCA** uses morados, púrpuras o azules brillantes para alertas. El warning es **dorado** (#B8893A), no naranja chillón.

---

## 🔤 Tipografía

> **Actualización 2026-05-31 · capa de SISTEMA redefinida (BRAND-EXCEPTION autorizada por el usuario).**
> El sistema (ERP, portal, pantallas de producto) usa **Nunito Sans** (cuerpo/datos) + **Sora**
> (títulos). El **branding** (logo corporativo "DTD Cargo", wordmark, plantillas de correo, firma)
> sigue en **Archivo / Archivo Black**, intacto. Dos capas, un solo punto de control en `tokens.css`.

```
/* SISTEMA (plataforma) */
--f-sans:    'Nunito Sans', system-ui, sans-serif       /* cuerpo, datos, labels, buttons */
--f-display: 'Sora', 'Nunito Sans', sans-serif          /* títulos, H1/H2, KPI values */
--f-mono:    'JetBrains Mono', ui-monospace, monospace  /* códigos */
--f-cn:      'Noto Sans SC', 'Nunito Sans', sans-serif  /* solo chino mandarín */

/* BRANDING (constante · nunca afectado por el sistema) */
--f-brand:         'Archivo', system-ui, sans-serif
--f-brand-display: 'Archivo Black', 'Archivo', sans-serif
```

### Reglas
- **Sora** (`--f-display`) para títulos y display del sistema (H1, H2 grandes, KPI values, codes destacados).
- **Nunito Sans** (`--f-sans`) para todo el body, labels, buttons del sistema.
  - ⚠ Nunito Sans no trae figuras tabulares; en columnas de montos la alineación no es perfecta (límite conocido y aceptado).
- **Archivo / Archivo Black** (`--f-brand` / `--f-brand-display`) para el **logo corporativo, wordmark "DTD Cargo", plantillas de correo y firma**. El wordmark sigue en Archivo Black (ver `BRAND-MIGRATION`).
- **JetBrains Mono** para códigos: MARKBOX (`DTD-XXXX`), container IDs (`DTDU-XXXXXX`), factura IDs (`F-2026-XXXX`), HS codes, RIF, tarifas, fechas/horas en tablas.
- **Noto Sans SC** SOLO para texto en chino mandarín (direcciones de almacén CN, nombres bilingües).
- **Revertir** a la marca = igualar `--f-sans`/`--f-display` a `'Archivo'`/`'Archivo Black'` en `tokens.css` (una línea cada una).

### ❌ Fuentes PROHIBIDAS
- Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Helvetica, Arial — son AI slop.
- Fuentes serif: Fraunces, Playfair, Georgia, Times — no van con el sistema.
- Cualquier fuente cursiva o decorativa.
- **Excepción vigente:** Nunito Sans + Sora son las fuentes oficiales de la **capa de sistema** desde 2026-05-31 (autorizado por el usuario). No agregar NINGUNA otra fuera de: Nunito Sans, Sora, Archivo/Archivo Black (branding), JetBrains Mono, Noto Sans SC.

---

## 📐 Spacing & Layout

Escala de 4px (todo múltiplo). Usá las variables:
```
--s-1: 4px   --s-2: 8px    --s-3: 12px   --s-4: 16px
--s-5: 20px  --s-6: 24px   --s-8: 32px   --s-10: 40px
--s-12: 48px --s-16: 64px
```

**Nunca** uses pixels arbitrarios como `padding: 17px` o `margin: 23px`. Si te falta una medida, preguntá.

### Radius
```
--r-xs: 3px    --r-sm: 5px    --r-md: 7px
--r-lg: 10px   --r-xl: 14px   --r-pill: 999px
```

### Sombras
Solo las del sistema: `--shadow-xs`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-pop`. Nunca sombras inventadas.

---

## 🧩 Componentes

Los componentes viven en `erp/components.jsx` (ERP) y se reusan en `portal/app.jsx` (Portal).

### Reglas de uso

- **Siempre** usá los componentes existentes antes de crear uno nuevo: `<Btn>`, `<Input>`, `<Select>`, `<Badge>`, `<Card>`, `<Table>`, `<KPI>`, `<Drawer>`, `<Modal>`, `<Tabs>`, `<Avatar>`, `<Progress>`, `<EmptyState>`.
- Si te falta un componente, **construilo siguiendo el estilo de los existentes** (mismas variables, mismo radius, mismas sombras) y dejá un comentario `/* TODO: brand-review */` para que el equipo de diseño lo apruebe.
- **Botones**: usar las 6 variantes oficiales — `primary`, `secondary`, `ghost`, `danger`, `dark`, `soft`. No inventes.
- **Badges**: usar tonos `success`, `warning`, `danger`, `info`, `wine`, `neutral`. No inventes tonos.

---

## 🏷 Terminología · MARKBOX / Shipping Mark (regla de contexto)

> **MARKBOX y Shipping Mark son la MISMA cosa** — el identificador que marca la caja. El término estándar del sistema es **"Shipping Mark"** (la marca de envío que usan los chinos, 唛头); como era muy largo se abrevió a **MARKBOX**. Siempre apunta a un registro de cliente (`DTD-XXXX`).

**Cuál mostrar según quién lee** (regla absoluta):

| Contexto | Término que se muestra |
|---|---|
| **Público / cliente** (portal, registro, login, emails, app) | **MARKBOX** |
| **Proveedor en China** (instructivos WeChat/WhatsApp, etiquetas, packing list) | **Shipping Mark** (唛头) |
| **Glosario de marca** (Brand Book) | **MARKBOX** · "marca la caja" |

- En texto de cara al **proveedor**, liderá con **Shipping Mark / 唛头**; podés aclarar `(MARKBOX)` entre paréntesis la primera vez si ayuda, pero el término principal es Shipping Mark.
- En texto de cara al **cliente**, NUNCA uses "Shipping Mark" como término principal — siempre **MARKBOX**.
- El **valor** del código no cambia nunca según contexto (`DTD-5532`, `DTD-5532-1-1`): lo único que cambia es la **etiqueta** con que lo nombramos.

## 🏷 Terminología · Compra / Orden / Prealerta (regla de audiencia)

> **Compra, Orden y Prealerta son el MISMO registro** — el pedido del cliente que avisa que
> viene mercancía de China. Cambia solo la etiqueta según quién lee:

| Contexto | Término que se muestra |
|---|---|
| **Cliente (Portal, app)** | **Compra** (CTA "Nueva compra") · anclado al concepto **prealerta** |
| **Interno / operativo (ERP)** | **Orden** (`DTD-XXXX-x-x`) |
| **Concepto puerta-a-puerta US/VE** | **Prealerta** (el cliente avisa que viene carga) |

- En el portal, "Compra" es el CTA principal; se ancla "prealerta" en el subtítulo para que el
  cliente acostumbrado al modelo casillero/courier reconozca el concepto. **No** renombrar el
  CTA a "Compra / Prealerta".
- El **valor** del registro no cambia según contexto: cambia solo la etiqueta.

---

## ✍️ Tono y voz

- **Tagline oficial:** **"Con Confianza, de China a tu puerta."** — antepone el valor diferencial (confianza) a la promesa funcional. NO usar la versión vieja "De China a tu puerta. Sin intermediarios."
  - **Casing (2026-06-05 · autorizado por el usuario):** "Confianza" va con **C mayúscula** en el tagline (`Con Confianza, …`), tratada como palabra-valor de marca. Aplica en UI de producto, portal, emails, brand book y piezas sociales. El sub-claim y los "niveles de confianza" (IA/ferias) siguen en minúscula.
- **Sub-claim / filosofía:** "Construyendo confianza cliente a cliente, contenedor a contenedor."
- **Castellano venezolano neutro, con tuteo (tú) — sin voseo** (tú / eres / inicia / mira). NUNCA voseo (vos / sos / arrancá / mirá): no aplica en Venezuela.
- **Verbos directos** en CTAs: "Cotizar DDP", "Crear embarque", "Enviar correo". **NUNCA** "Click acá", "Enviar formulario", "Submit".
- Sin emoji en UI de producto **a menos que la marca lo apruebe**. Si necesitás un símbolo, usá un icono del set `window.Icon`.
- Sin signos de exclamación múltiples. Sin mayúsculas sostenidas (excepto en eyebrows que ya lo hacen vía `text-transform: uppercase`).

### ❌ Copy PROHIBIDO
- "¡Genial!", "¡Increíble!", "🎉", "✨" en mensajes de éxito → usar texto simple ("Embarque creado").
- "Lorem ipsum" en producción. Si necesitás placeholder, escribí algo verosímil de DTD-Cargo.
- Anglicismos innecesarios: "Login" sí (común), "Sign in" no. "Onboarding" sí, "Welcome flow" no.

---

## 🚫 AI Slop · prohibido absolutamente

Estos patrones gritan "generado por AI" y **destruyen** la credibilidad del producto:

- ❌ Gradiente coloridos (rosa-naranja, púrpura-azul, "vaporwave")
- ❌ Tarjetas con `border-left: 4px solid <random-color>` random
- ❌ Iconos circulares con gradiente y emoji adentro (🚀, 💼, 📊)
- ❌ "Empty states" con ilustraciones genéricas tipo undraw.co
- ❌ Bordes redondeados de 24px+ en todo
- ❌ Drop shadows muy difusas estilo macOS Sequoia
- ❌ Modo "glassmorphism" / acrylic blur en todos lados
- ❌ Texto centrado por defecto · usar left-align
- ❌ Frases como "Made with ❤️", "Powered by AI", "Designed in 2026"
- ❌ Dashboards con barras chart de colores aleatorios

Si el usuario pide algo así, **avisarle** y proponer alternativa que respete el sistema.

---

## 📋 Convenciones de código

- **Regla calculadora (sistema):** todo input numérico/monetario evalúa sumas/restas tipo
  calculadora — el usuario escribe `32+1` y queda `33` (muestra "= 33" en vivo, colapsa al
  total al salir). En el ERP web es automático en `ERPUI.Input` con `type="number"` (o prop
  `calc`); en las apps de operario está en `MobileInput` con prop `calc`. Soporta decimales
  y restas. No inventar otra mecánica de suma.
- React + JSX inline (no JSX module mode). Componentes con PascalCase.
- Estilos: **inline styles con tokens CSS** o classes del sistema. **No** Tailwind, **no** CSS-in-JS libs, **no** styled-components.
- Archivos `.jsx` cargados via `<script type="text/babel" src=...>`.
- Cada componente que se reutiliza globalmente se expone en `window.*` (ej: `window.ERPUI`, `window.Icon`, `window.ERPData`).
- Mock data realista de DTD-Cargo: rutas CN→VE, MARKBOX `DTD-XXXX`, containers `DTDU-XXXXXX`, RIF venezolano, nombres verosímiles.

---

## ⚠️ Formato del aviso BRAND-CHECK

Cuando detectes una violación, antes de aplicar el cambio, mostrá esto en tu respuesta:

```
🛑 BRAND-CHECK

Lo que pediste:          <descripción>
Regla que rompe:         <regla específica del CLAUDE.md>
Por qué no va:           <2 líneas de razón>
Alternativa que respeta: <propuesta dentro del sistema>

¿Lo aplicamos igual (queda como excepción documentada) o
preferís la alternativa?
```

**Ejemplos de cosas que disparan BRAND-CHECK:**
- "Cambiá los botones a verde fosforescente" → ❌ rompe paleta
- "Usá Inter como fuente" → ❌ rompe tipografía
- "Agregá un gradiente arcoíris en el header" → ❌ AI slop prohibido
- "Pone emojis en los buttons de éxito" → ❌ rompe tono
- "Hacé el border-radius de 40px" → ❌ rompe escala
- "Usá `#FF00FF` para el badge" → ❌ rompe sistema de color

**Cosas que NO disparan BRAND-CHECK** (son válidas dentro del sistema):
- "Cambiá este botón de secondary a primary" → ✅ ambas variantes existen
- "Pasá el texto a Archivo Black" → ✅ es del sistema
- "Subí el padding a `var(--s-6)`" → ✅ token válido
- "Pone esa badge en tono `warning`" → ✅ tono permitido

---

## 🧱 Stack y arquitectura

- **ERP (admin):** `DTD Studio · ERP.html` + `erp/` (tokens, components, shell, modules).
- **Portal (cliente):** `Portal del Cliente.html` + `portal/app.jsx`. Reusa `erp/tokens.css`, `erp/icons.jsx`, `erp/components.jsx`.
- **Brand Book:** `Brand Book DTD v3.5.html` — fuente de verdad de la identidad visual. **No** mezclar pantallas de producto adentro.
- **Colateral impreso de marca:** `Tarjeta de Presentación.html` — tarjeta a doble cara (85×55 mm, sangrado 3 mm), lockup canónico + datos por persona, dorso navy con isólogo + tagline + QR vCard, spec de imprenta e imposición. Usa `erp/tokens.css` + `assets/dtdcargo-isologo-*.png`. Pendiente del set impreso: membrete A4, credencial/carnet, uniforme, vinilos de camión, roll-up. **No** inventar datos de contacto: RIF `J-410322887`, Av. Bolívar Norte 14 (Valencia), `info@dtdcargo.com` (correo de branding · 2026-06), `+58 241 414 7886`.
- **Documentos legales:** carpeta `legal/` — T&C de DTD (cliente), Acuerdo con el operador de
  consolidación (interno) y Brief de seguro (interno). Cada uno en `.md` (canónico, lo lee
  Claude Code) + `.docx` (original para subir/firmar). Ver `legal/README.md`. La T&C v2.1 de
  cara al cliente vive además embebida en `erp/modules/admin-legal.jsx` (`LEGAL_BODY.tyc`) y
  el modal del Portal — si cambia, actualizar ambos y subir la versión.
- Mock data en `erp/data.jsx`. Cualquier dato nuevo se agrega ahí y se expone vía `window.ERPData`.
- **Backend (producción):** carpeta `backend/` — `API-CONTRACT.md` mapea cada seam
  (`window.DTDData`/`DTDFlags`/`LegalData`) a su endpoint REST. El prototipo es 100% mock en el
  navegador; para producto real se reescribe el cuerpo de los seams (misma firma, llama a la API).

---

## 🔒 Resumen ejecutivo · 5 reglas que NO se rompen

1. **Solo usar tokens CSS** (`var(--*)`). Cero hex inventados.
2. **Fuentes:** sistema → **Nunito Sans + Sora**; branding → **Archivo / Archivo Black**; + **JetBrains Mono** y **Noto Sans SC**. Ninguna otra.
3. **Cero AI slop**: sin gradientes coloridos, sin emojis decorativos, sin glassmorphism, sin shadcn-defaults visibles.
4. **Componentes del sistema** primero. Inventar solo con `/* TODO: brand-review */`.
5. **Avisar antes de violar**. Formato `BRAND-CHECK` explícito.

Cuando dudes, **preguntá**. Es preferible una pregunta extra antes que un cambio que el equipo de diseño tenga que revertir.
