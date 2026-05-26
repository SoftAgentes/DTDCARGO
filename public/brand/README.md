# DTD Cargo · Brand assets (sitio público)

> **Fuente de verdad:** [`docs/design/brand-book/v3.0/`](../../docs/design/brand-book/v3.0/) · Brand Book DTD v3.0 mayo 2026.
> **Reglas:** [`BRAND.md`](../../BRAND.md) raíz del repo.

Esta carpeta contiene los assets que sirve el sitio público (`/brand/*.png|svg`) desde `next/image` y `<link rel="icon">`. Son **copias derivadas** del brand book — si el brand book cambia, regenerar (no editar a mano).

---

## Isólogo oficial v3.0 · 4 variantes

| Archivo | Sobre fondo | Ratio WCAG | Uso típico |
|---|---|---|---|
| `dtdcargo-isologo-primary.png` | light, paper, white | 14.8 : 1 | Nav, hero, body |
| `dtdcargo-isologo-reverse.png` | navy, ink, sidebar | 12.4 : 1 | Footer |
| `dtdcargo-isologo-mono-light.png` | wine, CTAs, alertas | 7.2 : 1 | Sobre botón primario |
| `dtdcargo-isologo-mono-dark.png` | paper, B&W, sello | 15.3 : 1 | Imprenta a tinta |
| `dtdcargo-isologo.png` | (neutral, sin pintar) | — | Solo si necesitás el "raw" |

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

## Legacy

`dtdcargo-icon-navy.png` queda como provisional **solo para el Studio** ERP — su sidebar lo importa hasta que se migre al sistema `<Lockup>` v3.0 (tarea pendiente del equipo Studio). El sitio público no lo referencia.

---

## Versión

Brand Book DTD v3.0 · mayo 2026.
Ver [`docs/design/brand-book/v3.0/proyecto/BRAND-MIGRATION-2026-05.md`](../../docs/design/brand-book/v3.0/proyecto/BRAND-MIGRATION-2026-05.md) para el changelog completo del rebrand.
