# ui-pro reference: tipografía & lectura

Carga esto SOLO al evaluar la dimensión 3. Las familias permitidas/prohibidas viven en `BRAND.md` 🔤 — acá está el criterio de USO.

## Fuentes por superficie (split de marca — mapa completo en `contexto-superficies.md`)

- **Web pública:** Archivo (UI) + Archivo Black (display).
- **Studio / Portal / Móvil:** Nunito Sans (cuerpo/datos) + Sora (títulos) — sistema del Norte (BRAND-EXCEPTION documentada en `docs/design/studio/_norte/erp/tokens.css`, capa de sistema, no branding).
- **Wordmark:** SIEMPRE Archivo Black, en todas las superficies, vía `<BrandMark>` (`components/BrandMark.tsx:139`, que usa `fontFamily: var(--font-brand-display)`). Ese token de branding es **inmune** a la capa de sistema. **No** uses `--font-archivo-black` ni `--f-display` para el wordmark: dentro de `.studio-sys`/`.portal-sys`/`.calc-sys`, `--font-archivo-black` se remapea a Sora (`app/globals.css`), y `--f-display` de `app/studio/tokens.css:120` encadena por `--font-archivo-black` → resuelve a **Sora** (es el token de TÍTULOS del sistema, no el del wordmark). El branding-constante análogo en la capa Norte es `--f-brand-display` (`docs/design/studio/_norte/erp/tokens.css:108` → Archivo Black). Usa la variable, nunca el literal de la familia.
- **JetBrains Mono:** códigos en todas las superficies — Shipping Mark `DTD-XXXX`, containers `DTDU-XXXXXX`, facturas `F-2026-XXXX`, RIF, HS codes, fechas/horas y montos en tablas.
- **Noto Sans SC:** solo texto en chino.
- Cualquier otra familia → `BRAND-CHECK` (lista prohibida en `BRAND.md` 🔤).
- En código usa `var(--font-*)` / `var(--f-*)`, nunca el literal de la familia.

## Measure, cuerpo, interlineado

- **Measure 45–75 caracteres** (66 óptimo; `max-width: 65ch` en prosa). Más allá de 75ch el ojo pierde el retorno de línea.
- **Body ≥16px** en superficies de lectura (público, portal, noticias; 18px en lectura larga). El ERP opera a **14px base por diseño del Norte** (denso) — no es falla. Sí lo es texto informativo <12px.
- **Inputs ≥16px en móvil** (evita el auto-zoom de iOS Safari).
- **Interlineado:** body 1.5–1.75 (líneas más largas → más interlineado) · títulos 1.0–1.25.
- **Nunca weight <400 en body**; jamás light en tamaños chicos.

## Jerarquía tipográfica

- Entre niveles varía **1–2 palancas** de {size, weight, color}, nunca las 3 a la vez.
- Escala modular ~1.2–1.25; no inventes tamaños fuera de la escala del sistema.
- Labels secundarios (`--ink-soft`, weight normal) vs data protagonista — en el ERP el dato pesa más que su label.
- Máximo 2 familias por superficie (+ mono para códigos).

## Microtipografía (craft)

- `font-variant-numeric: tabular-nums` en KPIs y columnas numéricas comparables.
- Carácter `…` (no tres puntos sueltos); acciones que abren algo más terminan en `…` ("Renombrar…", "Cargando…").
- `&nbsp;` entre número y unidad (10 CBM, ⌘ K).
- `text-wrap: balance` en headings · `text-wrap: pretty` en párrafos; cuidar viudas/huérfanas.
- Comillas curvas “ ” en copy visible.

## Tests de diagnóstico

- **Squint test:** entrecierra los ojos (o desenfoca el screenshot) — ¿la jerarquía sobrevive?
- **Grayscale test:** en escala de grises — si la jerarquía dependía solo del color, falla.
- **Zoom 200%** (WCAG 1.4.4 AA): nada truncado ni solapado, cero funcionalidad perdida.
- El contraste del texto se mide en la dimensión 1 (`contraste-tokens.md`), no acá (anti-doble-conteo).

## Performance

- <200KB total de fuentes; WOFF2/variable. En este repo `next/font/google` (en `app/layout.tsx`) ya resuelve subsetting y `font-display` — no agregues `@font-face` manuales ni `<link>` a Google Fonts.
