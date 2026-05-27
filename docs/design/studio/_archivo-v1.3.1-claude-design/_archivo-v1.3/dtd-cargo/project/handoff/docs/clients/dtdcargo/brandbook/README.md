# DTD-Cargo · Brandbook handoff

**Versión:** 2.0
**Cierre:** 21 mayo 2026
**Brand book completo:** ver `Brand Book DTD v2.0.html` (single-file, 22 páginas)

Esta carpeta es el subset técnico que necesita el equipo de desarrollo / proveedor ERP para integrar la marca correctamente. Pensada para vivir en `docs/clients/dtdcargo/brandbook/` dentro del repositorio del cliente.

## Contenido

| Archivo | Para | Notas |
|---|---|---|
| `colors.json` | Tokens de color · brand + neutros + status + sombras | Incluye snippet CSS listo para `:root {}` |
| `typography.json` | Familias, escala, reglas tipográficas | Archivo Black + Archivo + Noto Sans SC |
| `dtdcargo-logo-lockup.svg` | Logo principal · DTD vino + CARGO navy | Sobre fondo claro |
| `dtdcargo-logo-light.svg` | Logo en versión clara | Sobre fondo oscuro / navy |
| `dtdcargo-isotipo.svg` | Solo símbolo, wrapper SVG | Referencia el PNG en la misma carpeta |
| `dtdcargo-isotipo.png` | Símbolo raster 1080×720 | Fuente original (PNG con transparencia) |
| `dtdcargo-isotipo.jpg` | Símbolo raster con fondo paper | Para contextos sin transparencia (email firma, Word) |

## Restricciones (no romper)

### Color
- **Vino #7F0F1A** sólo para CTAs primarios, acentos y badges activos. Nunca como background extenso (sobre 30% de la pantalla).
- **Navy #0F1E3D** es el fondo oscuro oficial. No mezclar con #000000.
- **Paper #FBFAF7** es el fondo base · NUNCA usar blanco puro #FFFFFF como background.
- **Sin gradientes inventados.** Los únicos permitidos están declarados en `colors.json`.

### Logo
- Usar **siempre** uno de los 3 archivos provistos. No recolorear vía CSS filter.
- Mantener clearspace de **2x la altura del trazo** alrededor del logo.
- Tamaño mínimo: **24 px de alto** en digital · 12 mm en impreso.
- En fondos oscuros usar `dtdcargo-logo-light.svg` (DTD rosa-vino + CARGO blanco + isótipo crema).
- No agregar sombras, gradientes ni efectos.

### Tipografía
- **Wordmark DTD-Cargo SIEMPRE en Archivo Black**, nunca simulado.
- Cargar fuentes desde Google Fonts (links en `typography.json`).
- No usar Inter, Roboto ni system-ui plana para titulares.

### Sombras
- **Todas las cards comparten la misma sombra estándar** (`shadows.card` en `colors.json`).
- Al hover: `shadows.card_hover` + `transform: translateY(-2px)`.
- Sobre fondos navy usar `shadows.card_on_dark`.

## Cómo usar en código

### CSS
```css
:root {
  --brand-primary: #7F0F1A;
  --brand-primary-deep: #5E0A12;
  --brand-ink: #0F1E3D;
  --brand-paper: #FBFAF7;
  --brand-radius: 14px;
  --brand-shadow:
    0 2px 4px rgba(15,30,61,0.08),
    0 8px 16px rgba(15,30,61,0.10),
    0 24px 48px -16px rgba(15,30,61,0.22);
}
```

### React (Next.js / Vite)
```tsx
import logo from '@/public/brand/dtdcargo-logo-lockup.svg';

export const BRAND_ASSETS = {
  logoFull:     "/brand/dtdcargo-logo-lockup.svg",
  logoFullDark: "/brand/dtdcargo-logo-light.svg",
  isotipo:      "/brand/dtdcargo-isotipo.svg",
  favicon:      "/brand/favicon.ico",
  ogImage:      "/brand/og-image.png",
};
```

### HTML email / impreso
Usar `dtdcargo-isotipo.jpg` cuando el cliente de email no soporte SVG (Outlook viejos). Para web siempre SVG.

## Contacto

Para pedidos de archivos fuente, variantes o nuevas aplicaciones: **Vzla@dtdcargo.com**

---

*Brand Book DTD v2.0 · 21 mayo 2026*
