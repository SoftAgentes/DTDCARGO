# DTD-CARGO · Brand assets v1.0

Archivos listos para colocar en `public/brand/` del proyecto.

| Archivo | Uso | `BRAND_ASSETS` key |
|---|---|---|
| `dtdcargo-logo.svg` | Lockup completo (DTD vino + CARGO navy) sobre fondos claros | `logoFull` |
| `dtdcargo-logo-light.svg` | Lockup para fondos oscuros (DTD rosa-vino + CARGO blanco) | `logoFullDark` |
| `dtdcargo-isotipo.svg` | Sólo símbolo, vector wrapper | `isotipo` |
| `dtdcargo-isotipo.png` | Sólo símbolo, raster 1080×720 (fuente original) | `isotipo` (fallback) |
| `apple-touch-icon.png` | 180×180, iOS home screen, fondo navy | `appleIcon` |
| `favicon.ico` | Multi-size 16+32 px | `favicon` |
| `favicon-16.png` · `favicon-32.png` | PNGs sueltos por si los pide separados | — |
| `og-image.png` | 1200×630, preview WhatsApp/FB/X/LinkedIn | `ogImage` |

## Cómo instalar

1. Copiar **toda** la carpeta `brand-export/` al proyecto como `public/brand/`.
2. Actualizar `lib/design-tokens.ts`:

```ts
export const BRAND_ASSETS = {
  logoFull:     "/brand/dtdcargo-logo.svg",
  logoFullDark: "/brand/dtdcargo-logo-light.svg",
  isotipo:      "/brand/dtdcargo-isotipo.svg",
  isotipoDark:  null,  // se invierte con CSS filter
  favicon:      "/brand/favicon.ico",
  appleIcon:    "/brand/apple-touch-icon.png",
  ogImage:      "/brand/og-image.png",
}
```

3. Listo. `<BrandMark variant="lockup" />`, `<BrandMark variant="isotipo" />` y `<BrandMark variant="wordmark" />` levantan automáticamente.

## Notas técnicas

- Los SVG referencian **`dtdcargo-isotipo.png` por nombre relativo**. Por eso los dos archivos tienen que vivir **en la misma carpeta**. Si los movés, ajustá el `xlink:href`.
- La tipografía del wordmark usa Archivo Black como primaria, con fallbacks: Arial Black → Impact → sans-serif. Si cargás `@font-face Archivo Black` en la app, los SVGs lo levantan.
- Colores oficiales:
  - Vino primario: `#7F0F1A`
  - Vino-rosa (reverso oscuro): `#C2747F`
  - Navy primario: `#0F1E3D`
  - Crema (isotipo sobre oscuro): `#E8DCC8`

## Versión

Brand Book DTD v1.0 · 19 mayo 2026
