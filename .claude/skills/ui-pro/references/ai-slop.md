# ui-pro reference: AI slop & craft

Carga esto SOLO al evaluar la dimensión 9 (y la sección Motion aplica también a la 8). Fuente normativa: `BRAND.md` 🚫 — esta lista la vuelve OPERATIVA con patrones grep-ables, fusionada con los tells de `design-critic` y reglas destiladas de impeccable.style. Ante conflicto, gana `BRAND.md`.

## Greps deterministas (corre cada uno sobre el alcance; no inventes hallazgos)

| # | Patrón | Comando | Excepciones legítimas (NO flag) |
|---|---|---|---|
| 1 | Hex inventado en JSX/CSS | `rg -nE "#[0-9a-fA-F]{6}\b" <alcance> --glob '!**/tokens.css' --glob '!app/globals.css'` | archivos de tokens; `lib/design-tokens.ts` (fuente); tests; comentarios `BRAND-EXCEPTION` |
| 2 | Gradiente colorido | `rg -nE "linear-gradient|bg-gradient|from-[a-z]+-[0-9]" <alcance>` | ÚNICO permitido: navy→ink `linear-gradient(135deg, var(--ink), #1F3055)` en login/portal hero (`BRAND.md` 🎨) |
| 3 | Gradient text | `rg -n "bg-clip-text|text-transparent" <alcance>` | ninguna |
| 4 | Glassmorphism | `rg -n "backdrop-blur|backdrop-filter" <alcance>` | overlay ya aprobado en componentes del sistema; en duda → BRAND-CHECK |
| 5 | Border-stripe random | `rg -nE "border-l-4|border-left:\s*[0-9]+px solid" <alcance>` | ninguna en cards |
| 6 | Over-rounding | `rg -nE "rounded-3xl|border-radius:\s*(2[4-9]|[3-9][0-9])px" <alcance>` | `--r-pill` (999px) en pills/avatars/badges es del sistema; el FAB redondo de la calculadora |
| 7 | Fuentes prohibidas | `rg -niE "font-family[^;]*(Inter|Roboto|Open Sans|Lato|Montserrat|Poppins|Playfair|Fraunces|Georgia)" <alcance>` | ninguna |
| 8 | Emoji decorativo en UI | `rg -n "🚀|✨|🎉|💼|📊|🔥|💡" <alcance>` | contenido de datos (mensajes de usuarios); docs |
| 9 | Frases AI-slop | `rg -ni "made with|powered by ai|designed in 20" <alcance>` | ninguna |
| 10 | Ilustración genérica | `rg -ni "undraw|unsplash.com" <alcance>` | ninguna en producto |
| 11 | `transition: all` | `rg -nE "transition:\s*all|transition-all" <alcance>` | ninguna — listar propiedades intencionadas |
| 12 | Blanco rgba inline sobre navy | `rg -nE "rgba\(255,\s*255,\s*255" app/studio` | deuda conocida pre-Sprint 3; el fix es `--ink-inv-soft`/`--ink-inv-mute` o `--ink-side-*` |
| 13 | Diálogos nativos | `rg -nE "window\.(confirm|prompt|alert)" <alcance>` | tests; el sistema tiene `ConfirmDialog` (`app/studio/_components/ui/ConfirmDialog.tsx`) |
| 14 | Foco asesinado | `rg -nE "outline-none|outline:\s*none" <alcance>` | si hay `:focus-visible` de reemplazo en el mismo componente |
| 15 | `h-screen` en móvil | `rg -n "h-screen" app/m` | usar `h-dvh` (viewport dinámico móvil) |

## Tells que requieren ojo (no grep-ables)

- Card grids idénticas (icon + heading + text × 3) sin razón de contenido.
- Hero metric layout genérico (número grande + label + stats en fila).
- Sparklines/charts decorativos sin data real.
- Dark mode con glowing accents / cyan-on-dark.
- Texto centrado por defecto (la casa es left-align).
- Sombras difusas gigantes estilo macOS en todo — solo las `--shadow-*` del sistema.
- Empty states genéricos sin CTA ni voz de DTD.

## Craft (lo que separa un 7/10 de un 9/10 — positivo, no slop)

- Radio del hijo ≤ radio del padre; curvas concéntricas (alineadas).
- Borde + sombra combinados; bordes semi-transparentes para definir el canto.
- Sobre fondos NO neutros (navy sidebar) → tinta bordes/sombras/texto hacia el mismo hue; los grises puros se ven sucios sobre #0F1E3D.
- Sombras de 2 capas (las `--shadow-*` del sistema ya lo son — úsalas).
- `tabular-nums` en números comparables; alineación óptica ±1px cuando la percepción le gana a la geometría; todo elemento alineado a ALGO (grid, baseline, borde u óptico).
- `color-scheme: dark` en `<html>` cuando hay tema oscuro + `theme-color` meta; `<select>` nativo con `background-color`/`color` explícitos (bug dark de Windows).

## Motion (higiene — checklist compartido con la dimensión 8 y con design-critic)

- ≤200ms para feedback de interacción; ease-out en entradas. **Según superficie:** en **Studio/Portal/Móvil** usa los easings/duraciones del sistema (`var(--ease)`, `var(--dur-fast/--dur/--dur-slow)`); el **sitio público** (`app/globals.css`) NO define esos tokens — ahí basta coherencia (ease-out, ≤200ms) sin exigir `--ease`/`--dur`. Prohibido inventar curvas ad-hoc por componente.
- Solo `transform`/`opacity`; nunca animar blur/`backdrop-filter` en superficies grandes (blur ≤8px y solo one-shot).
- `transform-origin` donde físicamente nace el movimiento; FLIP para efectos de layout.
- Cancelable por input del usuario; sin autoplay — animar en respuesta a acciones; el motion nunca bloquea la interacción.
- Pausar loops fuera del viewport (IntersectionObserver); `will-change` solo durante la animación activa.
- Nunca animar desde eventos scroll — usar Scroll/View Timelines o IntersectionObserver; no rAF sin condición de parada.
- Parallax JAMÁS sobre texto o contenido crítico; 60fps o simplificar; degradar la técnica antes que eliminar el motion.
- Toda animación responde "¿por qué se mueve?" — sin narrativa, se corta. 3 cosas perfectas > 10 mediocres.
- `prefers-reduced-motion` respetado (regla de casa; SC 2.3.3 es AAA).
