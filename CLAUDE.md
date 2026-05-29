# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# DTD Cargo — Claude Code instructions

## Arquitectura del repo (leer primero)

Este repo aloja **dos productos** en el mismo Next.js app:

| Carpeta | Producto | Backend |
|---|---|---|
| `app/` (raíz: `cotizar`, `track`, `contacto`, `calculadora`, `servicios`, `noticias`, `glosario`) | **Sitio público DTD Cargo** (marketing + tracking público) | **HTTP-only** contra ERP HailuWay externo (`NEXT_PUBLIC_HAILUWAY_API`). Hoy con mocks hasta que el ERP exponga endpoints. |
| `app/studio/(app)/` (20+ módulos: dashboard, tracking, calendario, clientes, cotizador, embarques, tarifas, almacén CN/VE, SENIAT, TMS, etc.) | **DTD Studio ERP** (operación interna — "DoorTuDoor") | **Supabase propio** (`@/lib/db/server`) + Server Actions. |
| `app/api/studio/` | Endpoints internos del Studio | Supabase propio. |

## Aislamiento crítico (solo sitio público)

El **sitio público** (`app/` fuera de `app/studio/`) vive **completamente afuera** de
`~/Desktop/HailuWay/` y de `hailuway-erp/`. **Cero imports, cero edits, cero refs cruzadas.**
La única forma de comunicación con el ERP HailuWay es **HTTP a endpoints públicos**
(`{NEXT_PUBLIC_HAILUWAY_API}/api/public/*`).

Si encontrás un import de `hailuway-erp` desde una ruta de `app/` (no studio) → **es un
bug, removelo**.

**El Studio (`app/studio/`) sí usa `@supabase/*`** — es su backend propio (no es el de
HailuWay). Server Actions hablan con Supabase via `@/lib/db/server`.

## SDD propio

Este proyecto tiene su propio correlativo de specs desde 0001 (no comparte numeración
con HailuWay). Specs viven en `docs/specs/NNNN-slug/spec.md`. 19 specs cerradas hasta
ahora (0001-0019), ver `docs/specs/` para el índice completo.

**Naming de commits visto en el historial:** `feat(studio): SDD-NNNN — título` para los
del Studio, `feat(DTD-NNNN): ...` para el sitio público.

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

### 📂 `docs/design/` — home único de TODO lo visual (regla establecida 2026-05-24)

**Carpeta predeterminada para CUALQUIER material visual, de marca, mockup, handoff
o asset.** Antes de poner archivos visuales en otro lado, va acá. Sub-organización
por **producto**:

```
docs/design/
├── README.md                              ← índice maestro (leer al arrancar)
├── studio/                                ← Producto: ERP Studio (interno)
│   ├── v1-studio/                         ← handoff inicial
│   └── v1.3.1-claude-design/              ← entrega Claude Design 2026-05-24
├── sitio-publico/                         ← Producto: dtdcargo.com
├── mobile/                                ← Producto: app móvil nativa (futuro)
├── micro-sites/                           ← landings standalone
├── brand-assets/                          ← logos, isotipos, favicons (transversal)
├── tokens/                                ← colors.json + typography.json
├── rollbacks/                             ← cambios visuales revertidos
└── handoffs-archive/                      ← backups ZIP originales
```

**Reglas de ubicación**:

| Tipo de material | Va a |
|---|---|
| Handoff visual nuevo (Claude Design, freelancer, agencia) | `docs/design/<producto>/<vM.m.p-origen>/` + `README.md` adentro con contexto |
| Asset de marca (logo, isotipo, favicon, OG image) | `docs/design/brand-assets/<categoría>/` |
| Rollback visual | `docs/design/rollbacks/YYYY-MM-DD-<feature>/` |
| Tokens documentados (colors.json, typography.json) | `docs/design/tokens/` |
| Backup ZIP de entrega | `docs/design/handoffs-archive/<nombre>-<version>.zip` |

**Naming**:

- Versión: `vM.m.p-<origen>` (ej: `v1.3.1-claude-design`, `v2.0-figma`)
- Carpeta del proyecto descomprimido: siempre `proyecto/`
- Versiones anteriores archivadas: prefijo `_archivo-` (ej: `_archivo-v1.3/`)
- Rollbacks: `YYYY-MM-DD-<slug-feature>/`

**Prohibido**:

- ❌ NO usar `_handoff_preview/` para nada nuevo (queda como legacy histórico, no se borra para no romper paths)
- ❌ NO usar `BANDBOOK V1/` para nada nuevo (legacy)
- ❌ NO dejar ZIPs en `~/Downloads/` después de procesarlos — siempre mover a `handoffs-archive/`
- ❌ NO crear estructura ad-hoc tipo `mockups-vN/` o `01-foo/` dentro de un handoff

**Por qué `design/` y no `marketing/` o `brand/`**:

- `BRAND.md` raíz ya tiene las **reglas** de marca → no duplicar
- `docs/design/` es para **materiales** que aplican esas reglas
- "Design" abarca: mockups, handoffs, brand-assets, tokens, rollbacks (todo lo visual)
- Si en el futuro aparece "marketing" como vertical distinto (campañas, content strategy,
  copy para ads, performance creative, etc.), se abre `docs/marketing/` ese día
  como hermana de `docs/design/`. Hoy NO existe ese vertical, no anticipamos.

**Comportamiento esperado en futuras sesiones**:

Cuando el founder mencione "diseño", "branding", "handoff", "mockup", "Claude Design",
"entregable visual", "rollback", "assets de marca", "logo":

1. Asumir que el material va a `docs/design/<producto>/<version>/`
2. Si llega vía `~/Downloads/`: extraer ZIPs → mover a destino → backup ZIP en `handoffs-archive/` → crear `README.md` contextual → reportar
3. NO sugerir `_handoff_preview/` ni otras ubicaciones legacy
4. Si el founder propone otra ubicación, recordarle esta regla y proponer migración

Memoria persistente con la regla: `~/.claude/projects/.../memory/convention_design_handoffs_folder.md`.

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

pnpm test                 # vitest run (unit tests)
pnpm test:watch           # vitest en watch mode
pnpm test:ui              # vitest UI
pnpm test:e2e             # playwright test
pnpm test:e2e:ui          # playwright UI

pnpm seed                 # tsx scripts/seed.ts — siembra datos demo del Studio
pnpm payload              # CLI de Payload CMS (admin headless)
pnpm generate:types       # tipos de Payload
```

**Correr un test puntual:** `pnpm test path/to/file.test.ts` o `pnpm test -t "nombre del test"`.

## Variables de entorno

Ver `.env.example`. Las que usa el sitio:

- `NEXT_PUBLIC_HAILUWAY_API` — base URL del ERP (HTTP only).
- `DTD_API_KEY` — API key emitida por el ERP a DTD Cargo como tenant.
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

## Patrones del Studio ERP (`app/studio/`)

- **Server Actions** (`app/studio/(app)/<módulo>/actions.ts`): `"use server"` +
  `useActionState` desde el client + parsing manual de `FormData` + validación con
  `validate*Input()` propio (no Zod — patrón del proyecto, definido en
  `lib/studio/<entidad>-types.ts`). Mutación → `revalidatePath()`.
- **Queries server-side**: `lib/studio/<entidad>-queries.ts` con funciones puras que
  reciben `SupabaseClient` y devuelven data tipada. Llamadas desde `page.tsx` server
  components.
- **Types compartidos**: `lib/studio/<entidad>-types.ts` (enums, validators,
  helpers de label/badge tone).
- **Drawer compartido**: `app/studio/_components/ui/drawer/DrawerShell.tsx` exporta
  `DrawerShell` + `DrawerFooter`. Patrón submit obligatorio: `<form id="X">` en el
  cuerpo + `<button type="submit" form="X">` en el footer (HTML5 estándar — **no**
  `closest().querySelector().requestSubmit()`).
- **UI primitivas compartidas**: `app/studio/_components/ui/` (Avatar, Badge,
  EmptyState, KpiCard) + `_components/icons.tsx`.
- **Tokens visuales**: solo `var(--*)` desde `app/studio/tokens.css`. Para text sobre
  fondo navy (`background: var(--ink)`) usar `--ink-inv-soft` (text secundario) /
  `--ink-inv-mute` (text terciario), nunca `rgba(255,255,255,X)` inline.
- **MARKBOX** = ID estable de cliente (formato `DTD-NNNN`), autogenerado por
  `rpc('next_markbox')` de Supabase.

## Proceso UI/UX

Toda pantalla nueva o modificación visual sustancial **pasa por el agente
`ui-ux-designer` antes del commit** (regla persistente del founder). Es un check
liviano, no un bloqueo — verifica spacing, jerarquía, AI slop, hover states.

## Brand Book v3.0 · logo + lockup

Sistema oficial v3.0 (mayo 2026). Las 4 variantes PNG del isólogo viven en
`public/brand/dtdcargo-isologo-{primary|reverse|mono-light|mono-dark}.png`.
Único punto de entrada: el componente `<BrandMark variant={...} />` en
[`components/BrandMark.tsx`](components/BrandMark.tsx). El raster legacy
`dtdcargo-icon-navy.png` fue eliminado del repo el 2026-05-27 — todas las
referencias migraron al lockup oficial.

**Fuente de verdad del rebrand:**
- [`docs/design/brand-book/v3.0/proyecto/CLAUDE.md`](docs/design/brand-book/v3.0/proyecto/CLAUDE.md) — guardrails
- [`docs/design/brand-book/v3.0/proyecto/BRAND-MIGRATION-2026-05.md`](docs/design/brand-book/v3.0/proyecto/BRAND-MIGRATION-2026-05.md) — spec completa del Lockup
- `docs/design/brand-book/v3.0/proyecto/Logo Oficial.html` — preview en vivo

## Protocolo UI · handoff-first (v1.7)

**Fuente única de verdad Claude Design**: `docs/design/studio/v1.7-claude-design/project/`.
Versiones anteriores quedaron como `_archivo-*` (legacy histórico, no consultar
para decisiones nuevas).

### Lectura obligatoria al INICIO de sesión visual

1. `docs/design/studio/v1.7-claude-design/project/CLAUDE.md` — reglas de marca
2. `docs/design/studio/v1.7-claude-design/project/HANDOFF.md` — qué está diseñado, qué falta
3. `docs/design/studio/v1.7-claude-design/project/nuevo/README.md` — convención v1.0 / nuevo/
4. `docs/design/studio/v1.7-claude-design/project/nuevo/CHANGELOG.md` — bitácora completa
5. `docs/design/studio/v1.7-claude-design/project/nuevo/PROMPT-CLAUDE-CODE.md` — prompt para mí

### Antes de tocar UI de un módulo

1. **v1.0 (referencia, no tocar)**:
   `docs/design/studio/v1.7-claude-design/project/erp/modules/<modulo>.jsx`
2. **v1.1+ (overrides actuales)**:
   `docs/design/studio/v1.7-claude-design/project/nuevo/modules/<modulo>.jsx`
   (si existe override, ése es el actual)
3. **Pantallas standalone** (perfiles, estados):
   `docs/design/studio/v1.7-claude-design/project/nuevo/pantallas/<nombre>.jsx`
4. **Screenshots de referencia** (67 PNG):
   `docs/design/studio/v1.7-claude-design/project/uploads/*.png`
5. **Si no hay diseño** → AVISAR al founder antes de inventar; pedir guía
6. **Al cerrar la tarea**: reportar "alineado a v1.7 archivo X líneas Y-Z" o
   flag "divergencia documentada porque…"

### Brand assets

- Reglas: `docs/design/studio/v1.7-claude-design/project/CLAUDE.md`
  (sección Logo / Color / Tipografía)
- Migración v3.0: `docs/design/studio/v1.7-claude-design/project/BRAND-MIGRATION-2026-05.md`
- 4 variantes PNG isólogo: `public/brand/dtdcargo-isologo-{primary|reverse|mono-light|mono-dark}.png`
- Componente: `components/BrandMark.tsx`

### Cuándo aplica el protocolo

✅ Aplica: nuevos módulos, redesigns, agregar componentes a módulo existente,
ajustes visuales no triviales, pantallas nuevas.

❌ NO aplica: bugfixes lógicos sin cambio visual, hooks/server actions,
migraciones de DB, fixes de tipos TS.

### Convención v1.0 / nuevo/ del handoff

Claude Design separa: `erp/modules/*.jsx` (v1.0 congelado) vs
`nuevo/modules/*.jsx` (v1.1+ overrides). Cuando porto algo al Next.js, si
hay versión en `nuevo/`, **esa es la que vale**. Si solo está en `erp/`,
ese es el original.

## Organización · ISO 9001 §7.5 (reorg ISO — rama `reorg/iso-folders`)

> Disciplina, no certificación. Índice maestro de docs: [`docs/README.md`](docs/README.md).
> Plan completo del reorden: `~/.claude/plans/eres-un-especialista-en-reflective-puffin.md`.

### Las 4 superficies del repo

| Superficie | Rutas | Backend | Frontera |
|---|---|---|---|
| **Sitio público** | `app/{cotizar,track,contacto,calculadora,servicios,noticias,glosario}` + `components/` (raíz) | HTTP al ERP externo | ❌ NUNCA importa `@/lib/studio`, `@/lib/db`, `@supabase/*` |
| **Studio ERP** | `app/studio/(app)/<modulo>/` | Supabase (`@/lib/db`) | — |
| **Móvil PWA** | `app/m/{cn,ve,erp}/` | Supabase (reusa `lib/studio`, permitido) | — |
| **Back (CMS público)** | `app/back/(app)/` | Supabase (`lib/back/`) | no importa `@/lib/studio` |

`app/invitar/` es **onboarding del Studio** (usa DB por diseño, NO es ruta pública).

### Dónde va el código nuevo

```
1. ¿Material VISUAL/marca? → docs/design/<producto>/<version>/  (no en código)
2. ¿Qué SUPERFICIE? → ver tabla de arriba
   - Studio: page.tsx + actions.ts ("use server") + _components/ en el módulo;
     queries → lib/studio/<entidad>-queries.ts ; types → lib/studio/<entidad>-types.ts
   - API (solo webhook/cron/externo): app/api/.../route.ts FINO (sin lógica de negocio)
3. ¿Feature TRANSVERSAL (push/mail/telegram/agents)? → un hogar en lib/studio/<feature>/; rutas finas
4. ¿Tipo/helper compartido público↔ERP? → lib/shared/ (único puente que cruza la frontera)
5. ¿Util genérico sin dominio? → lib/<nombre>.ts (raíz)

Regla lib/studio: dominio con ≥3 archivos → carpeta; 1-2 → par plano <entidad>-queries/-types.
NUNCA tirar un archivo suelto en lib/studio raíz si el dominio ya tiene hogar.
```

### Adjuntos (2 planos — no confundir)

- **Documentación** (diagrama de spec, captura de runbook) → `docs/.../assets/` al lado del doc. En git si <1 MB.
- **Runtime** (foto operario, recibo, upload de cliente) → **Supabase Storage**, path `{tenant_id}/{entidad}/{id}/archivo`, signed URL. **Nunca en git.**

### Nombres

- Carpetas de **código** NO se renombran (Next.js las exige como estructura/URL).
- Carpetas de `docs/`: técnicas en inglés (`specs`, `runbooks`, `architecture`); negocio en español (`legal`, `operaciones`).
- Archivos en `docs/.../assets/`: kebab-case, sin acentos, fechas ISO-8601.

### Front-matter de specs (§7.5 = dueño/estado/fecha)

`sdd · title · status · author · created · updated · supersedes · superseded_by · related · confidencialidad`
(`review-by` solo en docs vivos: runbooks, architecture, índices).

### Nunca en git

Secretos (`.env*`), PII de clientes (solo Supabase+RLS), financieros/contratos crudos (→ Drive + puntero en `docs/legal/`).
