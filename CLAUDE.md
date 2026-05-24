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

## Brand — ⚠️ leer SIEMPRE antes de tocar visuales

**Fuente canónica de reglas de marca:** [`BRAND.md`](BRAND.md) en la raíz del repo.

Antes de aplicar **cualquier** cambio visual (color, tipografía, spacing, componente,
copy, badge, button variant) → leer BRAND.md primero. Define:

- Sistema de color completo (light + dark) — wine / ink / paper / success / warning / danger
- Colores **prohibidos** (verde fosfo, neón, gradientes coloridos, "AI slop")
- 3 fuentes únicas: Archivo + JetBrains Mono + Noto Sans SC. **Prohibidas**: Inter, Roboto, Poppins, etc.
- Spacing scale estricta 4px (nada de `padding: 17px` arbitrario)
- 6 variantes oficiales de botones + 6 tonos de badges
- Formato `BRAND-CHECK` que debo mostrar antes de violar cualquier regla
- Formato `DESIGN-CHECK` cuando me piden algo sin diseño aprobado (ver HANDOFF.md)

**Tokens del Studio:** [`app/studio/tokens.css`](app/studio/tokens.css) — adoptados del
diseño v1 (Claude Design handoff en `docs/design/v1-studio/`). Light + Dark themes,
density modifiers (compact / spacious), motion, reset.

**Brand Book HTML actual:** v2.4 vive en [`docs/design/v1-studio/source/Brand Book DTD v2.4.html`](docs/design/v1-studio/source/).
Las versiones anteriores en `_handoff_preview/` / `BANDBOOK V1/` están **archivadas** —
no consultar para decisiones nuevas.

**Resumen ejecutivo (5 reglas que NO se rompen — ver BRAND.md sec. final):**
1. Solo tokens CSS (`var(--*)`). Cero hex inventados fuera del tokens.css.
2. Solo fuentes Archivo + JetBrains Mono + Noto Sans SC.
3. Cero AI slop (gradientes coloridos, glassmorphism, emojis decorativos).
4. Componentes del sistema primero. Inventar solo con `/* TODO: brand-review */`.
5. Avisar antes de violar con formato `BRAND-CHECK` explícito.

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
