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

Tres familias, **ninguna otra**:

```
--f-sans:    'Archivo', system-ui, sans-serif
--f-display: 'Archivo Black', 'Archivo', sans-serif
--f-mono:    'JetBrains Mono', ui-monospace, monospace
--f-cn:      'Noto Sans SC', 'Archivo', sans-serif   /* solo para chino mandarín */
```

### Reglas
- **Archivo Black** se usa SOLO para títulos y display (H1, H2 grandes, KPI values, codes destacados).
- **Archivo regular** para todo el body, labels, buttons.
- **JetBrains Mono** para códigos: MARKBOX (`DTD-XXXX`), container IDs (`DTDU-XXXXXX`), factura IDs (`F-2026-XXXX`), HS codes, RIF, tarifas, fechas/horas en tablas.
- **Noto Sans SC** SOLO para texto en chino mandarín (direcciones de almacén CN, nombres bilingües).

### ❌ Fuentes PROHIBIDAS
- Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Helvetica, Arial — son AI slop.
- Fuentes serif: Fraunces, Playfair, Georgia, Times — no van con el sistema.
- Cualquier fuente cursiva o decorativa.

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

## ✍️ Tono y voz

- **Castellano rioplatense/venezolano neutro** — usá voseo si encaja (vos / sos / arrancá / mirá).
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
- **Brand Book:** `Brand Book DTD v2.4.html` — fuente de verdad de la identidad visual. **No** mezclar pantallas de producto adentro.
- Mock data en `erp/data.jsx`. Cualquier dato nuevo se agrega ahí y se expone vía `window.ERPData`.

---

## 🔒 Resumen ejecutivo · 5 reglas que NO se rompen

1. **Solo usar tokens CSS** (`var(--*)`). Cero hex inventados.
2. **Solo fuentes Archivo + JetBrains Mono + Noto Sans SC**. Nada más.
3. **Cero AI slop**: sin gradientes coloridos, sin emojis decorativos, sin glassmorphism, sin shadcn-defaults visibles.
4. **Componentes del sistema** primero. Inventar solo con `/* TODO: brand-review */`.
5. **Avisar antes de violar**. Formato `BRAND-CHECK` explícito.

Cuando dudes, **preguntá**. Es preferible una pregunta extra antes que un cambio que el equipo de diseño tenga que revertir.
