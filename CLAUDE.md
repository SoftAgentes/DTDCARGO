# DTD·CARGO — Claude Code instructions

## Aislamiento crítico

Este proyecto vive **completamente afuera** de `~/Desktop/HailuWay/` y de `hailuway-erp/`.
**Cero imports, cero edits, cero refs cruzadas.** La única forma de comunicación con el
ERP es **HTTP a endpoints públicos** (`{NEXT_PUBLIC_HAILUWAY_API}/api/public/*`).

Si encontrás un import de `hailuway-erp`, `@supabase/*`, o cualquier referencia al ERP
fuera de URLs HTTP → **es un bug, removelo**.

## SDD propio

Este proyecto tiene su propio correlativo de specs desde 0001 (no comparte numeración
con HailuWay). Specs viven en `docs/specs/NNNN-slug/spec.md`.

Cada PR referencia su spec: `feat(DTD-0001): ...`.

## Stack

- **Next.js 16** App Router + **TypeScript** + **Tailwind v4** + **React 19**
- **pnpm** como package manager
- Tipografías de marca: **Archivo** (UI) + **Archivo Black** (display) + **Noto Sans SC** (CJK)
- Cargadas via `next/font/google` en `app/layout.tsx`

## Brand

Fuente canónica: [`_handoff_preview/dtd-cargo/project/Brand Book DTD.html`](_handoff_preview/dtd-cargo/project/Brand%20Book%20DTD.html).

- Paleta espejada en `lib/design-tokens.ts` (`DTD.*`) y `app/globals.css` (`--color-*`).
- Nunca hardcodear hex de brand fuera de estos archivos.
- Wine `#7F0F1A` = primary; Ink `#0F1E3D` = secondary; Paper `#FBFAF7` = surface alt.
- Brand mark: "DTD" (wine) + "CARGO" (ink), Archivo Black. Componente `<BrandMark/>`.

## Comandos

```bash
pnpm dev                  # Next.js dev (http://localhost:3000)
pnpm typecheck            # tsc --noEmit
pnpm build                # build producción
pnpm lint                 # ESLint flat config
```

## Variables de entorno

Ver `.env.example`. Las que usa el sitio:

- `NEXT_PUBLIC_HAILUWAY_API` — base URL del ERP (HTTP only).
- `DTD_API_KEY` — API key emitida por el ERP a DTD·CARGO como tenant.
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — número WhatsApp Business.
- `NEXT_PUBLIC_CONTACT_EMAIL` — email comercial mostrado en footer.
- `NEXT_PUBLIC_SITE_URL` — dominio canónico (default `https://dtdcargo.com`).

## Integraciones HTTP con el ERP

Estado actual:

| Endpoint del ERP | Estado | Usado por |
|---|---|---|
| `GET /api/public/track/[code]` | ✅ existe (SDD-0008 del ERP) — pero el sitio usa MOCK hasta confirmar URL pública | `/track/[code]` (server component) |
| `POST /api/public/cotizar` | ❌ no existe — sitio usa MOCK | `/cotizar` (client form) |
| `POST /api/public/leads` | ❌ no existe — sitio usa MOCK | `/contacto`, `/cotizar` (post-submit) |
| WhatsApp Business webhook | ❌ vive en el ERP, no acá | botón `wa.me` mientras tanto |

Cuando los endpoints del ERP estén listos, reemplazar `mockSubmit`/`getTracking` por
`fetch(...)` real. Buscar comentarios `// TODO: reemplazar por fetch real`.

## Convenciones

- **Componentes con estado** → `"use client"` en la primera línea. Forms, inputs interactivos.
- **Resto** → server components por default (mejor SEO, menos JS al cliente).
- **Path alias** → `@/*` resuelve a la raíz del proyecto.
- **Estilos** → preferí utilidades Tailwind. Para componentes brand (`.btn`, `.eyebrow`,
  `.h-display`, `.brand`) usá las clases definidas en `globals.css`. Inline style solo
  cuando necesités CSS vars (`var(--color-wine)`).
- **Imágenes** → siempre `<Image>` de `next/image`. Assets de brand en `public/brand/`.

## Logo provisional

El logo actual (`public/brand/dtdcargo-icon-navy.png`) es **provisional** — el founder
debe entregar la versión SVG final del lockup. El componente `<BrandMark/>` es el único
lugar donde se referencia el archivo → cambio de 1 archivo para actualizar todo el sitio.
