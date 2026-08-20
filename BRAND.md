# DTD Cargo · Brand Guardrails

> **Para Claude Code:** este archivo define las reglas de marca y sistema de diseño de DTD Cargo. Antes de aplicar **cualquier** cambio visual (colores, tipografía, componentes, espaciado, copy), valida contra estas reglas. Si lo que te piden contradice una regla, **avisa al usuario antes de aplicar el cambio** con el formato definido al final.

---

## 🚨 Comportamiento esperado

1. **Lee este archivo completo al inicio de cada sesión.** No lo resumas, no lo saltes.
2. **Antes de aplicar cualquier cambio visual**, compáralo contra las reglas de abajo.
3. **Si detectás una violación**, NO apliques el cambio en silencio. Muestra el aviso con el formato `BRAND-CHECK` (definido al final) y espera confirmación explícita del usuario.
4. **Si el usuario insiste**, anota que es una excepción documentada (con su responsabilidad), aplícalo, y registra la decisión como comentario en el código:
   ```
   /* BRAND-EXCEPTION: <descripción> — autorizado por <usuario> el <fecha> */
   ```
5. **Nunca inventes valores nuevos** de color, fuente, radius, sombra o spacing. Usa **siempre** las variables CSS del sistema (`var(--*)`). Si necesitas algo que no existe, pregunta primero.

---

## 🖼 Logo y wordmark · sistema oficial

> **Fuente de verdad = el Brand Book vigente del Norte** (el de mayor versión en
> [`docs/design/studio/_norte/`](docs/design/studio/_norte/), hoy **v4.6** — regla de gobernanza: el book vigente es UNO solo).
> Spec del logo: [`docs/design/studio/_norte/BRAND-MIGRATION-2026-05.md`](docs/design/studio/_norte/BRAND-MIGRATION-2026-05.md) y [`Logo Oficial.html`](docs/design/studio/_norte/Logo%20Oficial.html).
> Implementación en este repo: [`components/BrandMark.tsx`](components/BrandMark.tsx).

### Las 4 variantes oficiales del isólogo

| Variante | Archivo | Sobre fondo | Ratio WCAG |
|---|---|---|---|
| **primary** | `/brand/dtdcargo-isologo-primary.png` | light, paper, white | 14.8 : 1 |
| **reverse** | `/brand/dtdcargo-isologo-reverse.png` | navy, ink, sidebar | 12.4 : 1 |
| **mono-light** | `/brand/dtdcargo-isologo-mono-light.png` | wine, CTAs, alertas | 7.2 : 1 |
| **mono-dark** | `/brand/dtdcargo-isologo-mono-dark.png` | paper, B&W, sello jurídico | 15.3 : 1 |

### Wordmark · "DTD Cargo" (DOS palabras, NO "DTDCARGO")

- Fuente: **`Archivo Black`** (font-weight 900)
- `DTD` color wine `#7F0F1A` · `Cargo` color ink `#0F1E3D` (primary)
- Letter-spacing: `-0.02em`
- Gap entre palabras: `0.15em` vía `<span style="display:inline-block; width:0.15em">` (no espacio HTML, no margin-left)
- **Nunca** "DTDCARGO" todo mayúsculas — siempre "DTD Cargo"
- **Nunca** "CARGO" todo mayúsculas en el wordmark — siempre "Cargo" capitalizado

### Reglas absolutas del logo

1. **Nunca** `dtdcargo-isologo-primary.png` sobre fondo navy/wine — ratio 1.1:1 → invisible.
2. **Nunca** `filter: brightness(0) invert(1)` sobre el isólogo. Ya existe `mono-light` que es cream sólido nativo.
3. **Nunca** usar `var(--color-wine-soft)` en el texto "DTD" del wordmark. `wine-soft` es acento decorativo (charts, badges, hover), no del logo.
4. **Nunca** inventar variantes nuevas. Son exactamente 4: primary · reverse · mono-light · mono-dark.
5. **Nunca** usar `Inter`, `Roboto`, `system-ui` para el wordmark. Solo `Archivo Black`.

### Uso

```tsx
import { BrandMark } from "@/components/BrandMark";

<BrandMark asLink />                          // Nav (fondo claro) → primary
<BrandMark onDark size={48} />                // Footer (fondo ink) → reverse
<BrandMark variant="mono-light" size={44} />  // Sobre wine
<BrandMark variant="mono-dark" size={60} />   // B&W sello
<BrandMark variant="primary" isologoOnly />   // Solo símbolo (favicon, avatar)
```

---

## ✨ Tagline oficial

```
Con Confianza,
de China a tu puerta.
```

- Línea 1 (`Con Confianza,`) → color **wine** `#7F0F1A`
- Línea 2 (`de China a tu puerta.`) → color **ink/navy** (default)
- **Casing (2026-06-05 · autorizado por el founder):** "Confianza" va con **C mayúscula** — palabra-valor de marca. Aplica en UI, portal, emails, brand book, piezas sociales y metadata SEO. El sub-claim y los "niveles de confianza" siguen en minúscula.
- 2 líneas. **NO** hay tercera línea kicker como v2.x ("Sin intermediarios" desapareció).

**Sub-claim** (voz interna, footer y copy secundario, no para hero):
> Construyendo confianza cliente a cliente, contenedor a contenedor.

**Por qué cambió** (del brand book):
> "Antepone el valor diferencial (confianza, construida cliente a cliente) antes que la promesa funcional. La voz pasa de transaccional a relacional, sin perder claridad."

Source of truth en código: `HERO.headline` en [`lib/design-tokens.ts`](lib/design-tokens.ts).

---

## 🎨 Sistema de color · ÚNICA fuente de verdad

Los valores canónicos viven en el Norte (`docs/design/studio/_norte/erp/tokens.css`); en este repo los equivalentes están en `app/globals.css` / `lib/design-tokens.ts` (web) y `app/studio/tokens.css` (Studio). **Nunca** uses hex literales en HTML/JSX cuando exista un token equivalente.

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
--ink-mute:    #9B9B9B   /* disabled / decorativo — NO texto legible ni placeholder de input activo (2.78:1); ver ♿ */

--border:      #E8E6E2

--success: #1F8A5B   /* Solo para confirmaciones reales */
--warning: #B8893A   /* Riesgo real (ETA en demora, etc.) — dorado. Como TEXTO de badge NO se lee (2.79:1) → texto --ink + dot dorado (ver ♿) */
--danger:  #A8323E   /* Errores y vencidos · ERP / Portal */
--danger-web: #C2353F /* Errores · marketing / web pública — split por superficie (BD-020) */
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
- **NUNCA** uses `red`, `blue`, `green`, `orange`, `purple` como nombres CSS. Usa los tokens.
- **NUNCA** inventes hex como `#FF5733`, `#00FFAA`, etc.
- **NUNCA** uses gradientes coloridos / arcoíris / "AI slop". Los **coloridos/arcoíris siguen prohibidos**; lo permitido es **tonal navy → ink** (familia `#0B1428`→`#0F1E3D`→`#1F3055`), **nunca hacia blanco**. En heros con texto (left-aligned) va **horizontal, azul FUERTE a la izquierda → navy más claro a la derecha**: `linear-gradient(90deg, #0B1428 0%, #0F1E3D 44%, #1F3055 100%)` (BD-022). **Hex explícito siempre, nunca `var(--ink)`/`var(--ink2)` dentro del gradiente** (BD-023) — si el token no resuelve, el fondo cae a blanco con texto claro encima (invisible); en dark, `var(--ink)` además se invierte a cream y voltea la tarjeta. En cards/botones chicos el diagonal `135deg` del mismo par es aceptable.
  - **Glow de fondo (BD-030, 2026-07-12):** además del hero, se **permite —y se recomienda para no dejar fondos planos—** un **glow radial *tonal* navy→ink** como fondo: `radial-gradient(135% 100% at 50% -12%, #1F3055 0%, #0F1E3D 42%, #0B1428 100%)` en dark; en claro, el equivalente sutil en papel `#FBFAF7`→`#F2F0EC`. Token: **`var(--bg-glow)`** (`app/globals.css`). Sigue las reglas de BD-022/023 (hex explícito, nunca hacia blanco en la familia navy) y **no** sustituye el gradiente de hero horizontal. Es **tonal, no colorido** — el glow no es una puerta a gradientes de color.
  - **Texto display editorial (autorizado por el founder, 2026-07-23):** en infografías, portadas sociales, cifras KPI y titulares grandes se permite aplicar el mismo **degradado tonal monocromático navy**, de izquierda a derecha, para evitar que el azul se vea plano: `linear-gradient(90deg, #0B1428 0%, #0F1E3D 55%, #1F3055 100%)`. El cambio debe ser sutil — navy profundo a navy ligeramente más claro, sin pasar a azul brillante, cian ni blanco. Se usa únicamente en texto display grande, con fallback sólido `#0F1E3D`; cuerpo, subtítulos pequeños y datos técnicos permanecen en color sólido para conservar legibilidad. **Nunca se aplica al isólogo, al wordmark ni a ninguna variante oficial del logo.**
- **NUNCA** uses morados, púrpuras o azules brillantes para alertas. El warning es **dorado** (#B8893A), no naranja chillón.

---

## ♿ Contraste & legibilidad (WCAG 2.1 AA)

Los hex de la paleta no dicen **qué par se lee**. Estas reglas cierran ese hueco. Ratios verificados sobre los tokens reales (2026-07-06).

### Umbrales
- Texto normal ≥ **4.5:1** · texto grande (≥24px, o ≥18.66px en negrita) ≥ **3:1** · iconos, bordes de foco y componentes ≥ **3:1** (WCAG 1.4.11).

### Tokens que NO son color de texto de párrafo (medido)
- `--ink-mute #9B9B9B` → 2.78:1 sobre blanco → solo **disabled/decorativo**, **jamás** body ni placeholder de input activo (WCAG: el placeholder informativo también exige 4.5:1).
- `--wine-soft #C2747F` (light) → 3.44:1 → acento/borde/hover; como texto, solo grande.
- `--warning #B8893A` → 3.14:1 como texto → no en texto chico.
- `--success #1F8A5B` → 4.33:1 como texto → queda bajo 4.5; para texto normal, sube el tamaño o usa relleno.

### Los semánticos son colores de RELLENO/estado, no de texto
`--success / --warning / --danger / --info` marcan estado. Como texto chico sobre blanco no siempre alcanzan AA → úsalos en texto grande o como relleno con `--ink`/blanco encima (verifica el par).

### Relleno + texto (CTAs / badges)
- Sobre `--wine` / `--danger` → texto **blanco** (10.6:1 / 6.6:1).
- Sobre `--warning` → texto `--ink` (5.24:1), **nunca** blanco. Token canónico ambos temas: **`--on-warning`** (#0F1E3D fijo · BD-027) — `--ink` en dark es cream y falla (~1.7:1) sobre el gold.
- Sobre `--success` → texto `--ink`, o blanco solo en texto grande.
- En dark, texto sobre cualquier relleno semántico → `--ink-inv`, nunca blanco (excepción: `--wine` dark sí acepta blanco).

### Rol de `--wine` en dark
Como **texto** sobre fondos oscuros falla (`#A8323E` → 2.79:1). En dark, `--wine` es **relleno** (texto blanco encima, 6.58:1); el acento de **texto** en dark es `--wine-soft #D89AA4` (7.93:1). **Token canónico para wine-como-texto en ambos temas: `--wine-text`** (BD-026: `#7F0F1A` light · `#D89AA4` dark) — usalo en Shipping Mark por fila, saldos, tabs activas, KPI values, links y badge tono wine. Los tokens dark que falten (`--ink-mute`, `--border`, semánticos) se toman de `docs/design/studio/_norte/erp/tokens.css` — **no inventar**.

### Wine sobre las bandas navy de la web pública
El sitio público escribe wine sobre `--grad-navy-hero` (#16274B → **#26406F**). El peor caso es siempre el **extremo claro #26406F**: `--wine-soft #C2747F` mide ahí **2.98:1** y reprueba (los eyebrows son de 12px). Token canónico para ese uso: **`--color-wine-on-dark` (#D59FA7)** — mismo tono y saturación que `wine-soft`, solo más claro → **4.57:1** sobre #26406F · 6.55:1 sobre #16274B · 8.64:1 sobre el #060D1C del collage. Lo consumen los alias `--wine-on-dark` de `.home-surface`, `.sm-surface` y `.cx-surface`. Es token de **web pública**: el ERP no lo usa (su equivalente es `--wine-text` dark).

### Paridad light/dark
Todo par texto/fondo debe pasar el umbral en **ambos** temas. No asumas que un token de texto en light hereda contraste en dark — verifica el equivalente.

### Fondo variable
- Texto sobre imagen/gradiente → **scrim/overlay** oscuro detrás; nunca texto directo sobre foto.
- **No comuniques solo por color** (WCAG 1.4.1): estados, links y errores llevan ícono, texto o subrayado además del color.

---

## 🏷 Terminología · Shipping Mark (unificado en todas las superficies)

**BD-022 (2026-07-18, enmienda BD-021 — decisión founder):** el término visible es **"Shipping Mark"
(唛头) en TODAS las superficies** — web pública, Studio (ERP), Portal y apps de operario. El split por
superficie de BD-021 (web = "MARKBOX") queda **derogado**. El **valor** del registro (`DTD-XXXX`) y la
**clave de datos `markbox`** no cambian en ningún caso — solo la etiqueta visible.

- ❌ Nunca "MARKBOX" visible en NINGUNA superficie nueva (fichas de servicios, infografías, portal, web).
- ⚠️ Sweep pendiente del sitio público: las páginas que hoy dicen "MARKBOX" (`app/{faq,glosario,servicios,registro,...}` + `components/` raíz) migran a "Shipping Mark" — hasta entonces el texto viejo es deuda, no regla.
- Historial: BD-004 → BD-021 (split, 2026-07-06) → **BD-022 (unificación, 2026-07-18)**. Detalle en `AGENTS.md` §Patrones del Studio ERP y `docs/design/studio/_norte/BRAND-DECISIONS.md`.

---

## 🔤 Tipografía

Tres familias, **ninguna otra**:

```
--f-sans:    'Archivo', system-ui, sans-serif
--f-display: 'Archivo Black', 'Archivo', sans-serif
--f-mono:    'JetBrains Mono', ui-monospace, monospace
--f-cn:      'Noto Sans SC', 'Archivo', sans-serif   /* solo para chino mandarín */
--f-cn-document: 'Noto Serif SC', 'Noto Sans SC', serif /* excepción BD-036: solo documento formal zh-CN */
```

### Reglas
- **Archivo Black** se usa SOLO para títulos y display (H1, H2 grandes, KPI values, codes destacados).
- **Archivo regular** para todo el body, labels, buttons.
- **JetBrains Mono** para códigos: Shipping Mark (`DTD-XXXX` — nombre visible "Shipping Mark", SDD-0065; `markbox` solo como identificador interno), container IDs (`DTDU-XXXXXX`), factura IDs (`F-2026-XXXX`), HS codes, RIF, tarifas, fechas/horas en tablas.
- **Noto Sans SC** SOLO para texto en chino mandarín (direcciones de almacén CN, nombres bilingües).
- **Noto Serif SC** es una excepción documental estrecha (BD-036): solo para
  bloques con `lang="zh-CN"` en cartas, contratos, transcripciones, correos
  formales y PDF dirigidos a clientes/oficina en China. Nunca se usa en UI,
  navegación, formularios, marketing, texto latino, títulos de marca o como
  serif editorial general. Sin la fuente disponible, el fallback obligatorio
  es Noto Sans SC y la estructura debe seguir siendo comprensible.

### ❌ Fuentes PROHIBIDAS
- Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Helvetica, Arial — son AI slop.
- Fuentes serif: Fraunces, Playfair, Georgia y Times no van con el sistema.
  Noto Serif SC es la única excepción y únicamente bajo BD-036.
- Cualquier fuente cursiva o decorativa.

---

## 📖 Legibilidad de lectura

Complementa la tipografía (no la cambia): reglas de lectura cómoda.
- **Measure** (ancho de línea): 45–75 caracteres, 66 óptimo (`max-width: 65ch` en prosa).
- **Tamaño body** ≥ 16px (18px en páginas de lectura larga).
- **Interlineado:** body 1.5–1.75 · títulos 1.0–1.25 (líneas largas → más interlineado).

---

## 📐 Spacing & Layout

Escala de 4px (todo múltiplo). Usa las variables:
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

## 🎚️ Perfil de densidad por superficie

La densidad correcta depende de la superficie — calibra el juicio de spacing **sin** romper la escala 4px.
- **Público** = espacioso · **Studio / ERP** = denso (tablas, KPIs) · **Portal / Móvil** = medio.
- Una tabla ERP densa y correcta **no** es "demasiado apretada"; un landing público apretado **sí** es un problema.

---

## 🧩 Componentes

Los componentes viven en `erp/components.jsx` (ERP) y se reusan en `portal/app.jsx` (Portal).

### Reglas de uso

- **Siempre** usa los componentes existentes antes de crear uno nuevo: `<Btn>`, `<Input>`, `<Select>`, `<Badge>`, `<Card>`, `<Table>`, `<KPI>`, `<Drawer>`, `<Modal>`, `<Tabs>`, `<Avatar>`, `<Progress>`, `<EmptyState>`.
- Si te falta un componente, **constrúyelo siguiendo el estilo de los existentes** (mismas variables, mismo radius, mismas sombras) y deja un comentario `/* TODO: brand-review */` para que el equipo de diseño lo apruebe.
- **Botones**: usar las 6 variantes oficiales — `primary`, `secondary`, `ghost`, `danger`, `dark`, `soft`. No inventes.
- **Badges**: usar tonos `success`, `warning`, `danger`, `info`, `wine`, `neutral`. No inventes tonos.

---

## ✅ Estados obligatorios

Cada pantalla los cubre con el mismo cuidado que el "happy path".
- **Interactivos:** hover · focus (visible) · active · disabled.
- **Vistas de datos:** empty · loading · error · success.
- **Pre-flight:** sin Lorem/placeholder ni `TODO: brand-review` sin resolver en pantallas ya vivas.

---

## ✍️ Tono y voz

- **Castellano venezolano neutro, tuteo** — usar "tú" (recibes, rastrea, cotiza, confirma). **Sin voseo** (nada de vos / sos / arrancá / mirá). *(Regla del founder 2026-06-08: en Venezuela no se usa voseo. Aplica a copy de marca y a la comunicación de los agentes.)*
- **Verbos directos** en CTAs: "Cotizar envío", "Crear embarque", "Enviar correo". **NUNCA** "Click acá", "Enviar formulario", "Submit".
  - ⚠️ El ejemplo decía "Cotizar DDP" y contradecía la decisión del founder (2026-07-17): **"DDP" no se usa como nombre de servicio de cara al cliente** — el servicio es "Puerta a puerta". DDP solo vale como aclaración entre paréntesis, en el glosario y en keywords SEO.
- Sin emoji en UI de producto **a menos que la marca lo apruebe**. Si necesitas un símbolo, usa un icono del set `window.Icon`.
- Sin signos de exclamación múltiples. Sin mayúsculas sostenidas (excepto en eyebrows que ya lo hacen vía `text-transform: uppercase`).

### ❌ Copy PROHIBIDO
- "¡Genial!", "¡Increíble!", "🎉", "✨" en mensajes de éxito → usar texto simple ("Embarque creado").
- "Lorem ipsum" en producción. Si necesitas placeholder, escribe algo verosímil de DTD Cargo.
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
- ⚠️ Modo "glassmorphism" / acrylic blur **como default en todos lados** — permitido SOLO en superficies elevadas/flotantes (ver ✅ Excepción · Glass · BD-031, abajo)
- ❌ Texto centrado por defecto · usar left-align
- ❌ Frases como "Made with ❤️", "Powered by AI", "Designed in 2026"
- ❌ Dashboards con barras chart de colores aleatorios

Si el usuario pide algo así, **avisarle** y proponer alternativa que respete el sistema.

### ✅ Excepción · Glass (BD-031, founder 2026-07-17)

El glassmorphism dejó de estar prohibido en bloque: se **permite acotado** a superficies **elevadas/flotantes** — calculadora flotante (FAB + panel), botón "Calcular", modales/overlays y popovers que floten sobre navy o imagen. **Nunca** en tablas, body, cards de contenido denso ni fondos de página (ahí sigue siendo AI slop).

**Reglas (para no recaer en slop):**
1. Solo superficies elevadas/flotantes, nunca "en todos lados".
2. **El texto sobre el vidrio cumple AA** contra el peor caso del fondo — crema sobre glass navy, navy sobre glass blanco (nunca gris tenue). Token de texto: `--glass-ink`.
3. El vidrio **no** reemplaza `--bg-surface` / `--color-white` en cards de contenido.
4. Sin blur difuso estilo macOS en botones chicos de contenido.
5. **Siempre** con `-webkit-backdrop-filter` de respaldo + relleno translúcido como fallback si el navegador no soporta blur.

**Tokens (nunca hex sueltos):** `--glass-bg` · `--glass-border` · `--glass-hi` (highlight interior) · `--glass-blur` (`blur(18px) saturate(150%)`) · `--glass-ink` · `--glass-shadow` · `--glass-key` · `--glass-inset`. Voltean por tema (claro = vidrio blanco translúcido + texto navy; oscuro = vidrio navy translúcido + texto crema). Definidos en `app/globals.css` (web/portal) y `app/studio/tokens.css` (ERP), espejo 1:1 del Norte. Acentos y "=" en wine (`--color-wine` / `--wine-text` según tema).

**Dónde está aplicado (no expandir sin BD nueva):**
- **Web/Portal:** calculadora flotante del portal (`PortalCalcFab`, panel de vidrio) · glow de fondo `--bg-glow` en el embed de la calculadora (BD-030).
- **ERP Studio (BD-033):** *scrim frosteado* — `backdrop-filter: var(--scrim-blur)` (blur suave 4px) en el overlay de todos los modales/drawers (`DrawerShell`, `ConfirmDialog`, `GlobalSearchModal`) · *panel de vidrio* del buscador ⌘K (`GlobalSearchModal`). **No** en toasts, paneles de drawer, tablas, KPIs ni fondos. Token del scrim: `--scrim-blur` (`app/studio/tokens.css`), distinto del `--glass-blur` de paneles.
- **ERP Studio · fondos (BD-034):** las superficies vino/navy llevan **degradado tonal `--grad-*`** (sidebar navy, hero vino, KPI destacado, fondo de página, cards) + **marca de agua del isotipo "D"** (`public/brand/dtdcargo-isologo-mono-light.png`, wallpaper, opacidad baja .05–.10). Extiende BD-030 (tonal, **nunca** rainbow ni textura).
- **ERP Studio · tipografía (BD-035):** el ERP corre en **Nunito Sans** (cuerpo/nav) + **Sora** (títulos) vía `--f-sans`/`--f-display` scopeados a `.studio-sys` (`app/studio/tokens.css`) — alinea el ERP con su fuente de diseño del Norte (BD-001). El wordmark `<BrandMark>` no migra.

---

## 📋 Convenciones de código

- React + JSX inline (no JSX module mode). Componentes con PascalCase.
- Estilos: **inline styles con tokens CSS** o classes del sistema. **No** Tailwind, **no** CSS-in-JS libs, **no** styled-components.
- Archivos `.jsx` cargados via `<script type="text/babel" src=...>`.
- Cada componente que se reutiliza globalmente se expone en `window.*` (ej: `window.ERPUI`, `window.Icon`, `window.ERPData`).
- Mock data realista de DTD Cargo: rutas CN→VE, Shipping Mark `DTD-XXXX`, containers `DTDU-XXXXXX`, RIF venezolano, nombres verosímiles.

---

## ⚠️ Formato del aviso BRAND-CHECK

Cuando detectes una violación, antes de aplicar el cambio, muestra esto en tu respuesta:

```
🛑 BRAND-CHECK

Lo que pediste:          <descripción>
Regla que rompe:         <regla específica del CLAUDE.md>
Por qué no va:           <2 líneas de razón>
Alternativa que respeta: <propuesta dentro del sistema>

¿Lo aplicamos igual (queda como excepción documentada) o
prefieres la alternativa?
```

**Ejemplos de cosas que disparan BRAND-CHECK:**
- "Cambia los botones a verde fosforescente" → ❌ rompe paleta
- "Usa Inter como fuente" → ❌ rompe tipografía
- "Agrega un gradiente arcoíris en el header" → ❌ AI slop prohibido
- "Pone emojis en los buttons de éxito" → ❌ rompe tono
- "Haz el border-radius de 40px" → ❌ rompe escala
- "Usa `#FF00FF` para el badge" → ❌ rompe sistema de color
- Texto que no alcanza el contraste AA sobre su fondo real (ej. `--ink-mute` como body, `--warning` como texto chico) → ❌ rompe legibilidad

**Cosas que NO disparan BRAND-CHECK** (son válidas dentro del sistema):
- "Cambia este botón de secondary a primary" → ✅ ambas variantes existen
- "Pasa el texto a Archivo Black" → ✅ es del sistema
- "Sube el padding a `var(--s-6)`" → ✅ token válido
- "Pone esa badge en tono `warning`" → ✅ tono permitido

---

## 🧱 Stack y arquitectura

- **ERP (admin):** `DTD Studio · ERP.html` + `erp/` (tokens, components, shell, modules).
- **Portal (cliente):** `Portal del Cliente.html` + `portal/app.jsx`. Reusa `erp/tokens.css`, `erp/icons.jsx`, `erp/components.jsx`.
- **Brand Book:** `docs/design/studio/_norte/Brand Book DTD v4.6.html` (vigente; el book es UNO solo) — fuente de verdad de la identidad visual. Publicado privado en `/marca/brand-book`. **No** mezclar pantallas de producto adentro.
- Mock data en `erp/data.jsx`. Cualquier dato nuevo se agrega ahí y se expone vía `window.ERPData`.

---

## 🔒 Resumen ejecutivo · 6 reglas que NO se rompen

1. **Solo usar tokens CSS** (`var(--*)`). Cero hex inventados.
2. **Solo fuentes Archivo + JetBrains Mono + Noto Sans SC**. Nada más.
3. **Cero AI slop**: sin gradientes **coloridos** (el glow tonal navy→ink de fondo sí, BD-030), sin emojis decorativos, sin glassmorphism **como default** (Glass permitido solo en superficies elevadas/flotantes · BD-031), sin shadcn-defaults visibles.
4. **Componentes del sistema** primero. Inventar solo con `/* TODO: brand-review */`.
5. **Avisar antes de violar**. Formato `BRAND-CHECK` explícito.
6. **Todo texto se lee.** Contraste AA: normal ≥4.5:1, grande ≥3:1. Un color de marca que no alcanza el ratio sobre su fondo real no se usa como texto (ver ♿).

Cuando dudes, **preguntá**. Es preferible una pregunta extra antes que un cambio que el equipo de diseño tenga que revertir.
