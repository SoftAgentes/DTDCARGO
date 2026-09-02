# Stack técnico · DTD·CARGO

**Fecha:** 2 septiembre 2026
**Proyecto:** DTD Cargo · una aplicación Next.js con cuatro superficies aisladas
**Repo:** github.com/hailuwaycom-sketch/DTDCARGO · privado

---

## Resumen rápido

| # | Área | Tecnología | Versión | Notas |
|---|------|-----------|---------|-------|
| 1 | Framework frontend | Next.js | **16.2.11** | App Router, Server Components, Server Actions |
| | | React | **19.2.4** | + react-dom 19.2.4 |
| | | TypeScript | **^5** | strict: true, noEmit: true |
| 2 | Build tool / bundler | Turbopack (Next 16 default) | built-in | Visible en build output: bundler: turbopack |
| 3 | UI library | Tailwind CSS | **v4** | @tailwindcss/postcss + tailwind-merge |
| | | NO shadcn / MUI / Radix | — | Componentes custom inline o components/ propios |
| | | Fonts | next/font/google | Archivo + Archivo Black + Noto Sans SC |
| 4 | Backend | Next.js Server Actions + Route Handlers | n/a | No hay backend separado |
| | | Base de datos | Supabase Postgres | proyecto xpfuzqombmjmxvprjgmi (el nombre visible en el dashboard de Supabase todavía dice "DoorTuDoor" — pendiente de renombrar; lo que importa es el project_ref), us-east-1, Postgres **17.6** |
| | | ORM / queries | @supabase/supabase-js ^2.106.1 | Sin Prisma/Drizzle, queries directos con RLS |
| | | Storage | Supabase Storage (S3-compat) | Buckets privados por dominio; inventario en migraciones y runbooks |
| 5 | Auth | @supabase/ssr ^0.5.2 | — | Email+password vía Supabase Auth; cookie-based con proxy.ts que refresca JWT |
| | | Tablas auth | auth.users + public.user_tenants + public.back_user_roles (nuevo) | Multi-tenant con RLS |
| | | Operario mobile | PIN custom | `operario_pins` + cookie HTTP-only autenticada; no usa Supabase Auth |
| 6 | Runtime y paquetes | Node + **pnpm** | Node **>=24 <25** · pnpm **11.19.0** | Contrato en `package.json`; lock en `pnpm-lock.yaml` |
| 7 | Tests | Vitest 4.1.7 (unit) + Playwright 1.60.0 (E2E) | — | 5.947 unitarios en 512 archivos · 150 E2E ejecutables + 18 Tier 3 omitidos |

---

## Dependencias destacadas — production

| Categoría | Paquete | Versión | Para qué |
|-----------|---------|---------|----------|
| Core | next | 16.2.11 | Framework |
| | react / react-dom | 19.2.4 | UI runtime |
| Supabase | @supabase/supabase-js | ^2.106.1 | Cliente DB |
| | @supabase/ssr | ^0.5.2 | Cookies + SSR helpers |
| AI | @anthropic-ai/sdk | ^0.98.0 | Skills/agents del Studio (SDD-0020) |
| AWS | @aws-sdk/client-s3 + SQS + STS + CloudFormation | 3.1099.0 | Plano de adjuntos y respaldo externo, detrás de gates |
| Upload | @uppy/core + @uppy/tus | ^5.2.0 / ^5.1.1 | Carga reanudable de adjuntos |
| Image | sharp | ^0.35.3 | Optimización Next/Image + favicons |
| Bug Reporter | rrweb / rrweb-player | 2.0 / 1.0 alpha | Session replay (SDD-0036) |
| Notif | web-push | ^3.6.7 | Web push (futuro) |
| Util | clsx + tailwind-merge | 2.1.1 / 3.6.0 | Class helpers |

---

## Dependencias destacadas — dev

| Paquete | Versión | Para qué |
|---------|---------|----------|
| vitest + @vitejs/plugin-react + @vitest/ui | 4.1.7 / 6.0.2 / 4.1.7 | Unit/component tests |
| @testing-library/react + jest-dom + user-event | 16.3 / 6.9 / 14.6 | RTL stack |
| jsdom | ^29.1.1 | DOM env para tests |
| @playwright/test | ^1.60.0 | E2E |
| eslint + eslint-config-next | ^9 / 16.2.11 | Lint |
| tailwindcss + @tailwindcss/postcss | ^4 / ^4 | CSS framework v4 |
| tsx | ^4.22.3 | Run scripts TS directo (seed, generate-favicons) |

---

## Estructura de la aplicación

Hay **un único `package.json`** en la raíz, sin paquetes hijos. El archivo
`pnpm-workspace.yaml` centraliza configuración de pnpm; no convierte al repo en
un monorepo.

Pero conviven **4 productos** dentro del mismo Next.js app:

| Producto | Path en el repo | URL | Backend |
|----------|-----------------|-----|---------|
| Sitio público marketing | `app/` (raíz) | `dtdcargo.com` | Mostly static; futuro HTTP al ERP HailuWay |
| Studio ERP (DTD Cargo) | `app/studio/(app)/*` | `dtdcargo.com/studio/*` | Supabase propio |
| Back de admin contenido | `app/back/*` | `dtdcargo.com/back/*` | Supabase compartido con Studio |
| Operario mobile PWA | `app/m/cn/*` + `app/m/ve/*` | `dtdcargo.com/m/{cn,ve}` | Supabase + PIN auth custom |
| Admin CBM (privado) | `app/admin/cbm-estudio/*` | `dtdcargo.com/admin/cbm-estudio` | Formulario POST + cookie HttpOnly firmada |

---

## Deploy

| Servicio | Producto |
|----------|----------|
| Vercel (team `hailu-wey`) | dtdcargo.com (sitio público + Studio + back) |
| Hostinger | DNS + Email `@dtdcargo.com` (no web hosting) |
| Supabase (`xpfuzqombmjmxvprjgmi`) | DB + Auth + Storage |

---

## Migraciones SQL del repositorio

**397 archivos** en `supabase/migrations/`: 379 migraciones ejecutables y 18
entradas sólo-ledger. El gate reconstruye el esquema desde cero y valida el
aislamiento multi-tenant; Cloud se mide por separado con `migrations-applied`.

---

## Versiones críticas a recordar

- **Node 24.x LTS** requerido por `engines` (`>=24 <25`)
- **pnpm 11.19.0** fijado por `packageManager`; el rango aceptado es 11.x y la
  whitelist canónica de scripts vive en
  `pnpm-workspace.yaml` mediante `allowBuilds` para `better-sqlite3`, `esbuild`,
  `sharp` y `unrs-resolver`
- **Next 16** trajo cambios mayores: `middleware.ts` → `proxy.ts`; `revalidateTag()` ahora pide 2 args; bundler default = Turbopack

---

*Snapshot técnico medido desde el repo y el gate local · 2026-09-02*
