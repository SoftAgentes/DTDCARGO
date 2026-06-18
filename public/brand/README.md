# DTD Cargo · Brand assets (sitio público)

> **Fuente de verdad:** el Brand Book vigente del Norte — el de mayor versión en [`docs/design/studio/_norte/`](../../docs/design/studio/_norte/) (hoy **Brand Book DTD v4.3**; el book es UNO solo).
> **Reglas:** [`BRAND.md`](../../BRAND.md) raíz del repo.

Esta carpeta contiene los assets que sirve el sitio público (`/brand/*.png|svg`) desde `next/image` y `<link rel="icon">`. Son **copias derivadas** del brand book — si el brand book cambia, regenerar (no editar a mano).

---

## Isólogo oficial · 4 variantes

| Archivo | Sobre fondo | Ratio WCAG | Uso típico |
|---|---|---|---|
| `dtdcargo-isologo-primary.png` | light, paper, white | 14.8 : 1 | Nav, hero, body |
| `dtdcargo-isologo-reverse.png` | navy, ink, sidebar | 12.4 : 1 | Footer |
| `dtdcargo-isologo-mono-light.png` | wine, CTAs, alertas | 7.2 : 1 | Sobre botón primario |
| `dtdcargo-isologo-mono-dark.png` | paper, B&W, sello | 15.3 : 1 | Imprenta a tinta |
| `dtdcargo-isologo.png` | (neutral, sin pintar) | — | Solo si necesitas el "raw" |

**Componente:** [`components/BrandMark.tsx`](../../components/BrandMark.tsx).
**API:** `<BrandMark variant="primary|reverse|mono-light|mono-dark" size={N} />`.

---

## Iconos del browser y home screen

| Archivo | Tamaño | Generado por | Destino |
|---|---|---|---|
| `favicon-16.png` | 16×16 | `scripts/generate-favicons.mjs` | Browser tab |
| `favicon-32.png` | 32×32 | `scripts/generate-favicons.mjs` | Browser tab (retina) |
| `favicon.ico` | 16+32+48 | `scripts/generate-favicons.mjs` | Legacy fallback IE |
| `apple-touch-icon.png` | 180×180 | `scripts/generate-favicons.mjs` | iOS home screen (fondo paper) |

**Regenerar todos:** `node scripts/generate-favicons.mjs`

---

## Otros assets

| Archivo | Uso |
|---|---|
| `og-image.png` | 1200×630 · preview en WhatsApp / X / LinkedIn / FB |
| `container.svg` | Ilustración del hero (contenedor flotante) |
| `dtdcargo-dimensions-box.svg` | Diagrama educativo L×A×H en `/cotizar` y `/calculadora` |

---

## Versión

Brand Book vigente: **v4.3** (sync 2026-06-17) · el lockup/isólogo no cambió desde el rebrand de mayo 2026.
Changelog del rebrand: [`docs/design/studio/_norte/BRAND-MIGRATION-2026-05.md`](../../docs/design/studio/_norte/BRAND-MIGRATION-2026-05.md) · historial del book: changelog interno de `Brand Book DTD v4.3.html`.
