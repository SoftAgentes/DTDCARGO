# 🎨 DTD-Cargo · Brand Migration 2026-05 → v1.0

> **Para Claude Code**: este documento es la **única fuente de verdad** del rebrand de DTD-Cargo. Leelo entero antes de modificar nada. Cualquier asset del logo viejo (`dtdcargo-icon-navy.png`, `DTD_LOGO` base64, `"DTDCARGO"` concatenado) debe ser reemplazado por el sistema nuevo descrito acá.

---

## 🎯 Objetivo del rebrand

Migrar todo el codebase del isólogo viejo (raster `dtdcargo-icon-navy.png` + wordmark "DTDCARGO" concatenado en `Archivo Black`) al sistema oficial **v1.0**:

1. **Isólogo** con **4 variantes oficiales** según fondo (resuelve el problema de contraste).
2. **Wordmark separado en dos palabras**: `DTD` + espacio + `Cargo` — nunca más `DTDCARGO`.
3. **Componente único** `<Lockup variant="..." />` reusable en ERP, Portal, Brand Book, mockups.

La página de referencia ejecutable es **`Logo Oficial.html`** — abrir esa primero para ver el sistema en vivo.

---

## 📦 Assets oficiales · `assets/`

Estos 4 PNGs son la nueva fuente de verdad. **No usar ningún otro** isólogo en el codebase.

| Archivo | Color D | Color flexión | Tamaño base | Uso |
|---|---|---|---|---|
| `assets/dtdcargo-isologo-primary.png` | Navy `#0F1E3D` | Wine `#7F0F1A` | 741 × 764, transparente | Sobre fondos light (`#FBFAF7`, `#FFFFFF`, `#F2F0EC`) |
| `assets/dtdcargo-isologo-reverse.png` | Cream `#FBFAF7` | Wine `#7F0F1A` | 741 × 764, transparente | Sobre **navy/dark** (`#0F1E3D`, `#16264A`, sidebar) |
| `assets/dtdcargo-isologo-mono-light.png` | Cream `#FBFAF7` | Cream `#FBFAF7` | 741 × 764, transparente | Sobre wine (`#7F0F1A`), CTA primario, alerta |
| `assets/dtdcargo-isologo-mono-dark.png` | Navy `#0F1E3D` | Navy `#0F1E3D` | 741 × 764, transparente | B&W, imprenta a tinta, sello jurídico, fax |

**Original sin tocar**: `assets/dtdcargo-isologo.png` (variante primary cropeada). Solo úsala si necesitás el archivo "neutral" — para casos normales preferí `dtdcargo-isologo-primary.png`.

---

## 🚨 Archivos a ELIMINAR

Estos referenciaban el isólogo viejo. **Reemplazar todas las referencias antes de borrar**.

- ~~`assets/dtdcargo-icon-navy.png` — raster viejo de 1080 × 720.~~ **ELIMINADO (2026-06-05)** — todas las referencias migradas al sistema v1.0 (ERP, Portal, operario). Ya no existe en el proyecto.

Referencias actuales detectadas (auditoría a fecha 2026-05-26):

```
operario/almacenista.jsx:92                                src="assets/dtdcargo-icon-navy.png"
operario/ve.jsx:116                                      src="assets/dtdcargo-icon-navy.png"
portal/app-standalone.jsx:257                            src="assets/dtdcargo-icon-navy.png"
handoff/SDD-2026-05-25-sesion/source/erp/shell.jsx:47    src="assets/dtdcargo-icon-navy.png"
iconos-perfiles/icons-1.jsx                              path data del trazado viejo (en DTDAnchor)
Brand Book DTD v2.4.html:926                             const DTD_LOGO = "data:image/png;base64,..." (raster embebido)
Brand Book DTD v2.4.html (~30 usos)                      <img src={DTD_LOGO} .../>
Brand Book DTD v2.2 · standalone.html                    bundle viejo — regenerar o eliminar
```

---

## ✍️ Cambios en wordmark · "DTDCARGO" → "DTD Cargo"

**Regla absoluta**: en cualquier lugar donde aparezca el wordmark como texto, **es dos palabras separadas** con tipografía y colores distintos.

### Spec del wordmark

```css
font-family: 'Archivo Black', 'Archivo', sans-serif;
font-weight: 900;
letter-spacing: -0.02em;
line-height: 0.9;

/* DTD */
color: #7F0F1A;       /* wine */

/* Gap entre palabras — usar inline-block span, NO un espacio normal */
.space { display: inline-block; width: 0.15em; }

/* Cargo */
color: #0F1E3D;       /* navy / ink */
```

### Find/replace

Buscar **todo** uso de `"DTDCARGO"` (sin espacio, una palabra) y reemplazar por el nuevo lockup:

```jsx
// ❌ ANTES
<span style={{ color: 'var(--wine)' }}>DTD</span>
<span style={{ color: 'var(--ink)' }}>CARGO</span>

// ✅ DESPUÉS
<span style={{ color: 'var(--wine)' }}>DTD</span>
<span style={{ display: 'inline-block', width: '0.15em' }}></span>
<span style={{ color: 'var(--ink)' }}>Cargo</span>
```

**Cambios clave**:
- `CARGO` (todo mayúsculas) → `Cargo` (capitalizado)
- Sin espacio entre los spans → ahora hay un `<span>` con `width: 0.15em` como separador
- Letter-spacing pasa de `-0.01em` a `-0.02em`

### Variante reverse (sobre fondo navy/dark)

```jsx
// ❌ ANTES — usaba wine-soft para DTD
<span style={{ color: 'var(--wine-soft)' }}>DTD</span>
<span style={{ color: '#fff' }}>CARGO</span>

// ✅ DESPUÉS — wine sólido para DTD, cream para Cargo
<span style={{ color: '#7F0F1A' }}>DTD</span>
<span style={{ display: 'inline-block', width: '0.15em' }}></span>
<span style={{ color: '#FBFAF7' }}>Cargo</span>
```

**Importante**: `var(--wine-soft)` (`#C2747F`) **no se usa más** para el wordmark. Es un color decorativo del sistema, no del logo.

---

## 🧩 Componente `<Lockup>` · crear y reusar

Crear este componente en `erp/components.jsx` (o donde vivan los UI primitives) y exportarlo a `window.ERPUI.Lockup`. Reusarlo en cada lugar que hoy tenga el lockup hard-coded.

### Implementación

```jsx
// Lockup oficial DTD-Cargo · v1.0
// Spec: Logo Oficial.html en la raíz del proyecto

const LOCKUP_VARIANTS = {
  primary: {
    file: 'assets/dtdcargo-isologo-primary.png',
    dtd: '#7F0F1A',
    cargo: '#0F1E3D',
  },
  reverse: {
    file: 'assets/dtdcargo-isologo-reverse.png',
    dtd: '#7F0F1A',
    cargo: '#FBFAF7',
  },
  'mono-light': {
    file: 'assets/dtdcargo-isologo-mono-light.png',
    dtd: '#FBFAF7',
    cargo: '#FBFAF7',
  },
  'mono-dark': {
    file: 'assets/dtdcargo-isologo-mono-dark.png',
    dtd: '#0F1E3D',
    cargo: '#0F1E3D',
  },
};

function Lockup({
  variant = 'primary',
  size = 40,             // ancho del isólogo en px
  orientation = 'horizontal', // 'horizontal' | 'vertical' | 'isologo-only'
  showWordmark = true,
}) {
  const v = LOCKUP_VARIANTS[variant];
  if (!v) return null;
  const markSize = size * 0.34; // wordmark = ~34% del ancho del isólogo
  const gap = size * 0.18;
  const isVertical = orientation === 'vertical';

  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: isVertical ? 'column' : 'row',
      alignItems: 'center',
      gap: gap + 'px',
    }}>
      <img
        src={v.file}
        alt="DTD Cargo"
        style={{
          width: size,
          height: size * (764 / 741),
          objectFit: 'contain',
          display: 'block',
        }}
      />
      {showWordmark && orientation !== 'isologo-only' && (
        <span style={{
          fontFamily: "'Archivo Black', 'Archivo', sans-serif",
          fontWeight: 900,
          fontSize: markSize + 'px',
          letterSpacing: '-0.02em',
          lineHeight: 0.9,
          whiteSpace: 'nowrap',
        }}>
          <span style={{ color: v.dtd }}>DTD</span>
          <span style={{ display: 'inline-block', width: '0.15em' }}></span>
          <span style={{ color: v.cargo }}>Cargo</span>
        </span>
      )}
    </div>
  );
}

// Exponer global
window.ERPUI = window.ERPUI || {};
window.ERPUI.Lockup = Lockup;
```

### Uso · ejemplos

```jsx
// ERP shell sidebar (light bg)
<ERPUI.Lockup variant="primary" size={30} />

// Portal header oscuro
<ERPUI.Lockup variant="reverse" size={36} />

// Sobre wine button / hero
<ERPUI.Lockup variant="mono-light" size={44} />

// Sello / B&W
<ERPUI.Lockup variant="mono-dark" size={60} />

// Solo isólogo, sin wordmark (favicon, avatar, etc.)
<ERPUI.Lockup variant="primary" size={40} orientation="isologo-only" />

// Vertical (factura, sello)
<ERPUI.Lockup variant="mono-dark" size={120} orientation="vertical" />
```

---

## 📋 Archivos a actualizar · checklist

Auditoría exhaustiva del codebase a 2026-05-26. Cada item tiene un patrón de búsqueda y la acción esperada.

### Críticos (rompen el branding)

- [ ] **`Brand Book DTD v2.4.html`** — ~30 usos de `DTD_LOGO` base64 + `DTDCARGO`. Reemplazar todos por `<Lockup>` o `<img src="assets/dtdcargo-isologo-{variant}.png">` según el contexto del fondo. Eliminar la const `DTD_LOGO`. Regenerar/borrar el bundle `Brand Book DTD v2.2 · standalone.html` (es un fork viejo).
- [ ] **`operario/almacenista.jsx:92`** — fondo es `linear-gradient(... var(--ink) ...)` (oscuro). Cambiar a `<Lockup variant="reverse" size={40} orientation="isologo-only" />`. Eliminar el filtro `brightness(0) invert(1)`.
- [ ] **`operario/ve.jsx:116`** — mismo caso. `variant="reverse"`, eliminar filtro CSS.
- [ ] **`portal/app-standalone.jsx:257`** — actualmente usa `dtdcargo-icon-navy.png` con fallback. Cambiar a `dtdcargo-isologo-primary.png` (el portal va sobre fondo light). Si el header es dark, usar reverse.
- [ ] **`handoff/SDD-2026-05-25-sesion/source/erp/shell.jsx:47`** — ERP sidebar. El sidebar es navy oscuro → `variant="reverse"`, `orientation="isologo-only"`.
- [ ] **`iconos-perfiles/icons-1.jsx`** — el componente `DTDAnchor` tiene el path data del trazado vector viejo (auto-trace que ya no usamos). Cambiar a `<image href="assets/dtdcargo-isologo-mono-light.png" />` o equivalente, según el fondo del ícono.

### Verificación

Después de los cambios, **buscar** estos patrones en todo el proyecto y confirmar que **no quedan ocurrencias** fuera de este documento:

```bash
grep -rn "dtdcargo-icon-navy.png" .         # 0 resultados esperados
grep -rn "DTD_LOGO" .                       # 0 resultados esperados (la const desaparece)
grep -rn 'CARGO</span>' .                   # 0 resultados (todos pasan a "Cargo")
grep -rn "DTDCARGO" .                       # 0 resultados (todos pasan a "DTD Cargo")
grep -rn "wine-soft.*DTD\|DTD.*wine-soft" . # 0 resultados (DTD nunca va en wine-soft)
```

`wine-soft` (`#C2747F`) sigue existiendo como color decorativo del sistema (charts, badges, hover states) — no eliminar de los tokens.

---

## 🚫 Reglas que NO se rompen

1. **Nunca** usar `dtdcargo-isologo-primary.png` (navy + wine) sobre fondo navy o wine. Ratio de contraste 1.1:1 → invisible.
2. **Nunca** escribir `DTDCARGO` (una sola palabra, todo mayúsculas). Siempre `DTD Cargo` (dos palabras, capitalizado).
3. **Nunca** usar `filter: brightness(0) invert(1)` sobre el isólogo para "blanquearlo" — es un parche CSS, ya tenés la variante `mono-light`. Si necesitás cream sólido, usá esa variante.
4. **Nunca** inventar nuevas variantes (`super-dark`, `accent`, etc.). Son exactamente 4: primary · reverse · mono-light · mono-dark.
5. **Nunca** usar `Inter`, `Roboto`, `system-ui` para el wordmark. **Solo** `Archivo Black`.

---

## 🎨 Spec del lockup · parámetros oficiales

Valores derivados de iteración con el equipo. Si Cloud Code ve un lockup con valores diferentes, **es un bug**, actualizar.

| Parámetro | Valor oficial | Nota |
|---|---|---|
| Wordmark font | `Archivo Black`, 900 weight | Cargar desde Google Fonts |
| Letter-spacing | `-0.02em` | Tight tracking |
| Gap DTD ↔ Cargo | `0.15em` | Vía `<span>` inline-block, no espacio |
| Wordmark size vs isólogo | ≈ 30-34% del ancho del isólogo | Auto-calculado en el componente |
| Gap iso ↔ wordmark | ≈ 18-22% del alto del isólogo | Auto-calculado |
| Mínimo viable | Isólogo 24 px | Por debajo, perder wordmark |
| Mínimo con wordmark | Isólogo 48 px | Bajo eso, el wordmark se vuelve ilegible |

---

## 🧪 Cómo testear que la migración está OK

1. Abrir `Logo Oficial.html` — debe verse el lockup oficial v1.0 con las 4 variantes en el carrusel.
2. Abrir `Brand Book DTD v2.4.html` — todos los lockups deben verse coherentes con `Logo Oficial.html`. No debe haber ninguna variante "DTDCARGO" (una palabra) ni ningún uso de `var(--wine-soft)` en el texto "DTD".
3. Abrir `DTD Studio · ERP.html` — sidebar muestra el isólogo reverse (cream) sobre navy.
4. Abrir `Portal del Cliente.html` — header muestra el lockup primary completo.
5. Abrir `Operario Multi.html` (almacenista, conductor, transportista) — todos usan reverse.
6. Buscar `DTDCARGO` y `dtdcargo-icon-navy` en el proyecto — 0 resultados.

---

## 📞 Si dudás

- **Ver el lockup en vivo**: abrir `Logo Oficial.html` y navegá las 4 variantes con las flechas.
- **Calcular contraste**: la sección "Regla de oro · contraste" de `Logo Oficial.html` muestra los ratios WCAG de cada combinación válida y prohibida.
- **Antes de aplicar un cambio que NO está cubierto acá**: avisar al usuario con el formato `BRAND-CHECK` definido en `CLAUDE.md`.

---

*Última actualización: 2026-05-26 · DTD-Cargo brand system v1.0*
