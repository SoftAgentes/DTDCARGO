# ui-pro reference: contraste & tokens

Carga esto SOLO al evaluar la dimensión 1 (Legibilidad & contraste) o para verificar un par color/fondo puntual.

**Matriz verificada 2026-07-06** por recómputo independiente (luminancia relativa WCAG 2.1). Fuentes hex: `BRAND.md` + `docs/design/studio/_norte/erp/tokens.css` (leer, nunca editar).

**Auto-verificación obligatoria (parte del check 1.1):** antes de medir contra esta tabla, lee los hexes vigentes de `app/studio/tokens.css` + `docs/design/studio/_norte/erp/tokens.css` + `app/globals.css` y confirma que coinciden con la matriz. Si difieren, re-computa el par con el snippet de abajo y **reporta el drift** — la marca deriva con el tiempo; no confíes en una tabla congelada ni midas contra hexes viejos.

## Umbrales (WCAG 2.1/2.2 AA)

- Texto normal ≥ **4.5:1** (SC 1.4.3).
- Texto grande ≥ **3:1** — grande = **≥24px**, o **≥18.66px en negrita** (18pt / 14pt bold; W3C aproxima "24px y 18.5px"). OJO: NO es "18px o 14px bold". Con el body del ERP en 14px, casi nada del Studio califica como grande: el umbral operativo real ahí es 4.5:1.
- No-texto ≥ **3:1** (SC 1.4.11): focus ring, bordes que identifican componentes, iconos informativos, estados.
- **Sin redondeo:** 2.999:1 FALLA el umbral 3:1.
- **Placeholder NO está exento:** si transmite información en un input activo necesita ≥4.5:1 (usa `--ink-soft` o duplica la info en el label/helper). La exención de 1.4.3 cubre solo componentes INACTIVOS (disabled) y decoración pura.
- **APCA:** existe como verificación perceptual complementaria (cuando un par pasa AA pero "se ve" flojo, típico con `--warning`), pero la vara normativa de DTD es WCAG 2.1 AA — no cambies de vara.

## Algoritmo (para pares que no estén en la matriz, o para re-computar ante drift)

```python
def _chan(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def lum(hexcolor):
    h = hexcolor.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return 0.2126 * _chan(r) + 0.7152 * _chan(g) + 0.0722 * _chan(b)

def ratio(fg, bg):
    l1, l2 = sorted((lum(fg), lum(bg)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)   # NO redondear hacia arriba

def comp(rgb, alpha, bg):
    """rgba sobre fondo: compositar ANTES de medir. rgb/bg = tuplas (r,g,b)."""
    return tuple(round(a * alpha + b * (1 - alpha)) for a, b in zip(rgb, bg))
```

```js
const chan = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = h => { const [r, g, b] = h.replace('#','').match(/../g).map(x => parseInt(x, 16));
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b); };
const ratio = (fg, bg) => { const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05); };
```

En `--live`, extrae los colores reales con `getComputedStyle(el).color/backgroundColor` (Playwright `browser_evaluate`) y computa sobre eso.

## LIGHT · texto sobre fondo

| Texto | Fondo | Ratio | Veredicto |
|---|---|---|---|
| `--ink` #0F1E3D | white #FFFFFF | 16.49 | ✅ body |
| `--ink` #0F1E3D | `--bg-base` #FBFAF7 | 15.80 | ✅ body |
| `--ink` #0F1E3D | `--bg-elevated` #F2F0EC | 14.49 | ✅ body |
| `--ink-soft` #6B6B6B | white | 5.33 | ✅ body |
| `--ink-soft` #6B6B6B | `--bg-base` | 5.11 | ✅ body |
| `--ink-soft` #6B6B6B | `--bg-elevated` | 4.68 | ✅ body (justo) |
| `--ink-mute` #9B9B9B | white | 2.78 | ❌ FALLA (ni grande) |
| `--ink-mute` #9B9B9B | `--bg-base` | 2.66 | ❌ FALLA |
| `--ink-mute` #9B9B9B | `--bg-elevated` | 2.44 | ❌ FALLA |
| `--wine` #7F0F1A | white | 10.58 | ✅ body |
| `--wine` #7F0F1A | `--bg-base` | 10.13 | ✅ body |
| `--wine-deep` #5E0A12 | white | 13.74 | ✅ body |
| `--wine-soft` #C2747F | white | 3.44 | ⚠️ solo grande |
| `--wine-soft` #C2747F | `--bg-base` | 3.30 | ⚠️ solo grande |

## LIGHT · semánticos como TEXTO

| Texto | /white | /bg-base | Veredicto |
|---|---|---|---|
| `--success` #1F8A5B | 4.33 | 4.15 | ⚠️ solo grande |
| `--warning` #B8893A | 3.14 | 3.01 | ⚠️ solo grande (3.01 = margen 0.01) |
| `--danger` #A8323E | 6.58 | 6.31 | ✅ body |
| `--info` #2A6FDB | 4.78 | 4.58 | ✅ body |
| `--neutral` #6B6B6B | 4.68* | — | ✅ body (*sobre neutral-bg compuesto) |

## LIGHT · texto sobre relleno (CTAs)

| Par | Ratio | Veredicto |
|---|---|---|
| white / `--wine` | 10.58 | ✅ |
| white / `--danger` | 6.58 | ✅ |
| white / `--success` | 4.33 | ⚠️ solo grande/bold |
| `--ink` / `--warning` | 5.24 | ✅ (nunca blanco sobre warning) |

## LIGHT · badges (texto semántico sobre su `*-bg` compositado en white)

| Badge | bg compuesto | Ratio | Veredicto |
|---|---|---|---|
| success #1F8A5B / rgba(31,138,91,.10) | #E9F3EF | 3.83 | ⚠️ falla body — solo grande/bold |
| warning #B8893A / rgba(184,137,58,.12) | #F6F1E7 | **2.79** | ❌ FALLA hasta grande |
| danger #A8323E / rgba(168,50,62,.10) | #F6EAEC | 5.61 | ✅ body |
| info #2A6FDB / rgba(42,111,219,.10) | #EAF1FB | 4.20 | ⚠️ falla body por poco |
| neutral #6B6B6B / rgba(107,107,107,.10) | #F0F0F0 | 4.68 | ✅ body |

## NAVY sidebar light (#0F1E3D)

| Par | Ratio | Veredicto |
|---|---|---|
| cream #F2F0EC / sidebar | 14.49 | ✅ |
| `--ink-side` rgba(255,255,255,.85) comp | 12.14 | ✅ |
| `--ink-side-soft` rgba(255,255,255,.55) comp | 5.83 | ✅ body |
| `--ink-soft` #6B6B6B / sidebar | 3.09 | ⚠️ solo grande — NO body sobre navy |
| `--wine` #7F0F1A / sidebar | 1.56 | ❌ invisible (por eso el logo primary jamás va sobre navy) |

## DARK · texto sobre fondo

| Texto | Fondo | Ratio | Veredicto |
|---|---|---|---|
| `--ink` #F2F0EC | `--bg-base` #0B1428 | 16.12 | ✅ body |
| `--ink` #F2F0EC | `--bg-surface` #16264A | 13.08 | ✅ body |
| `--ink` #F2F0EC | `--bg-elevated` #1F3055 | 11.44 | ✅ body |
| `--ink-soft` #A8B0C4 | `--bg-base` | 8.45 | ✅ body |
| `--ink-soft` #A8B0C4 | `--bg-surface` | 6.86 | ✅ body |
| `--ink-soft` #A8B0C4 | `--bg-elevated` | 6.00 | ✅ body |
| `--ink-mute` #6E7896 | `--bg-base` | 4.18 | ⚠️ solo grande — NO body |
| `--ink-mute` #6E7896 | `--bg-surface` | 3.40 | ⚠️ solo grande |
| `--ink-mute` #6E7896 | `--bg-elevated` | **2.97** | ❌ falla hasta grande (por 0.03) |
| `--wine` #A8323E TEXTO | `--bg-base` | 2.79 | ❌ FALLA — wine en dark es RELLENO |
| `--wine` #A8323E TEXTO | `--bg-surface` | 2.26 | ❌ FALLA |
| `--wine` #A8323E TEXTO | `--bg-elevated` | 1.98 | ❌ FALLA |
| `--wine-soft` #D89AA4 | `--bg-base` | 7.93 | ✅ body — acento de TEXTO en dark |
| `--wine-soft` #D89AA4 | `--bg-surface` | 6.44 | ✅ body |
| `--wine-soft` #D89AA4 | `--bg-elevated` | 5.63 | ✅ body |
| white / `--wine` relleno | — | 6.58 | ✅ (CTA wine dark OK) |

## DARK · semánticos como TEXTO (`[data-theme="dark"]` de `_norte/erp/tokens.css`)

| Texto | /bg-base #0B1428 | /bg-surface #16264A | Veredicto |
|---|---|---|---|
| `--success` #5BCFA0 | 9.50 | 7.71 | ✅ body |
| `--warning` #DCAB6B | 8.80 | 7.15 | ✅ body |
| `--danger` #E07785 | 6.24 | 5.07 | ✅ body |
| `--info` #6FA0E8 | 6.87 | 5.58 | ✅ body |
| `--neutral` #A8B0C4 | 8.45 | 6.86 | ✅ body |

⭐ **Asimetría clave:** en LIGHT los semánticos como texto chico fallan (salvo danger/info); en DARK todos pasan body. La paridad NO se hereda — verifica cada par por tema.

## DARK · texto sobre relleno semántico (TRAMPA)

| Par | Ratio | Veredicto |
|---|---|---|
| white / `--success` #5BCFA0 | **1.93** | ❌ NUNCA blanco |
| white / `--danger` #E07785 | **2.94** | ❌ NUNCA blanco |
| `--ink-inv` #0F1E3D / success | 8.54 | ✅ |
| `--ink-inv` #0F1E3D / warning #DCAB6B | 7.92 | ✅ |
| `--ink-inv` #0F1E3D / danger | 5.61 | ✅ |

En dark, el texto sobre relleno semántico es `--ink-inv` — el patrón light "blanco sobre relleno" NO se hereda. Excepción: `--wine` dark sigue aceptando blanco (6.58).

## DARK · badges (semántico sobre su `*-bg` compositado en bg-surface)

| Badge | bg compuesto | Ratio | Veredicto |
|---|---|---|---|
| success #5BCFA0 / rgba(.14) | #203E56 | 5.77 | ✅ body |
| warning #DCAB6B / rgba(.14) | #32394F | 5.50 | ✅ body |
| danger #E07785 / rgba(.14) | #323152 | 4.21 | ⚠️ solo grande/bold |
| info #6FA0E8 / rgba(.14) | #223760 | 4.41 | ⚠️ solo grande/bold |
| neutral #A8B0C4 / rgba(.12) | #283759 | 5.43 | ✅ body |

## Sidebar/nav dark (#060D1C — el sidebar dark es MÁS oscuro que el navy light)

| Par | Ratio | Veredicto |
|---|---|---|
| `--ink-side` rgba(255,255,255,.88) comp #E1E2E4 | 14.97 | ✅ |
| `--ink-side-soft` rgba(255,255,255,.55) comp #8F9299 | 6.23 | ✅ body |
| `--ink-nav-soft` dark rgba(255,255,255,.5) sobre `--bg-nav` #0F1E3D | 5.02 | ✅ body |

## No-texto (WCAG 1.4.11 · ≥3:1)

| Par | Ratio | Veredicto |
|---|---|---|
| Focus ring light: `--wine` #7F0F1A / bg-base | 10.13 | ✅ |
| Focus ring dark: `--wine` #A8323E / bg-base #0B1428 | **2.79** | ❌ FALLA 1.4.11 |
| Focus ring dark: `--wine` / bg-surface | **2.26** | ❌ FALLA 1.4.11 |
| `--border` light #E8E6E2 / white | 1.25 | ❌ como ÚNICA frontera de input |
| `--border-strong` light #D8D4CE / white | 1.48 | ❌ ídem |
| `--border` dark rgba(255,255,255,.08) comp / bg-base | 1.23 | ❌ ídem |
| `--border-strong` dark rgba(.14) comp / bg-base | 1.49 | ❌ ídem |

Bordes decorativos/separadores están exentos de 1.4.11. El fallo aplica solo cuando el borde es la ÚNICA señal que identifica el componente (input sin fondo diferenciado). Regla: inputs con fondo diferenciado (`--bg-surface` sobre `--bg-base`) o borde reforzado + focus ring visible.

## ::selection

| Tema | Par | Ratio |
|---|---|---|
| light | white / `--wine` #7F0F1A | 10.58 ✅ |
| dark | white / `--wine` #A8323E | 6.58 ✅ |

## Hallazgos vigentes del sistema (contexto conocido — repórtalos si aparecen en el alcance, no los "re-descubras" como novedad)

1. **Focus ring en dark falla 1.4.11** — `_norte/erp/tokens.css:230` usa `outline: 2px solid var(--wine)` sin distinción de tema (2.79/2.26 en dark). El fix del sistema es `--wine-soft` o `--ink` en dark. `_norte/` NO se toca: si lo ves replicado en código del repo, repórtalo; la corrección del Norte va vía doc de sync a Cloud Design.
2. **Badge warning light ilegible** (2.79 sobre su `*-bg`) — patrón badge estándar falla en light para warning/success/info como body.
3. **`--ink-mute` no es texto en NINGÚN tema**; sobre `--bg-elevated` dark ni siquiera alcanza 3:1.
4. **Blanco sobre relleno semántico en dark** = trampa (usar `--ink-inv`).

## Reglas rápidas (resumen operativo)

- `--ink-mute`: solo disabled/decoración; jamás texto ni placeholder informativo.
- `--wine` en dark = RELLENO; acento de texto dark = `--wine-soft`.
- Semánticos light = relleno/estado, no texto chico · semánticos dark SÍ sirven como texto body (asimetría medida).
- Sobre `--warning` light → texto `--ink`, nunca blanco.
- Sobre navy sidebar: `--ink-side`/`--ink-side-soft` o cream; nunca `--wine`; nunca `rgba(255,255,255,X)` inline (usa los tokens).
- Paridad: verifica el par en AMBOS temas, siempre.
