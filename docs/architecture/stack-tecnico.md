# Stack técnico · DTD·CARGO

**Fecha:** 27 mayo 2026
**Proyecto:** DTD-Cargo monorepo (sitio público + Studio ERP + back de administración)
**Repo:** github.com/hailuwaycom-sketch/DTDCARGO · privado

---

## Resumen rápido

| # | Área | Tecnología | Versión | Notas |
|---|------|-----------|---------|-------|
| 1 | Framework frontend | Next.js | **16.2.6** | App Router, Server Components, Server Actions |
| | | React | **19.2.4** | + react-dom 19.2.4 |
| | | TypeScript | **^5** | strict: true, noEmit: true |
| 2 | Build tool / bundler | Turbopack (Next 16 default) | built-in | Visible en build output: bundler: turbopack |
| 3 | UI library | Tailwind CSS | **v4** | @tailwindcss/postcss + tailwind-merge |
| | | NO shadcn / MUI / Radix | — | Componentes custom inline o components/ propios |
| | | Fonts | next/font/google | Archivo + Archivo Black + Noto Sans SC |
| 4 | Backend | Next.js Server Actions + Route Handlers | n/a | No hay backend separado |
| | | Base de datos | Supabase Postgres | proyecto xpfuzqombmjmxvprjgmi (DoorTuDoor), us-east-1, Postgres **17.6** |
| | | ORM / queries | @supabase/supabase-js ^2.106.1 | Sin Prisma/Drizzle, queries directos con RLS |
| | | Storage | Supabase Storage (S3-compat) | buckets receipt-photos + futuro back-assets |
| 5 | Auth | @supabase/ssr ^0.5.2 | — | Email+password vía Supabase Auth; cookie-based con proxy.ts que refresca JWT |
| | | Tablas auth | auth.users + public.user_tenants + public.back_user_roles (nuevo) | Multi-tenant con RLS |
| | | Operario mobile | PIN custom | operario_pins tabla, cookie HTTP-only, NO usa Supabase Auth |
| 6 | Gestor de paquetes | **pnpm** | **11.1.2** | Lock: pnpm-lock.yaml. Node **24.15.0** |
| 7 | Tests | Vitest 4.1.7 (unit) + Playwright 1.60.0 (E2E) | — | 44 unit + 12 E2E passing |

---

## Dependencias destacadas — production

| Categoría | Paquete | Versión | Para qué |
|-----------|---------|---------|----------|
| Core | next | 16.2.6 | Framework |
| | react / react-dom | 19.2.4 | UI runtime |
| Supabase | @supabase/supabase-js | ^2.106.1 | Cliente DB |
| | @supabase/ssr | ^0.5.2 | Cookies + SSR helpers |
| AI | @anthropic-ai/sdk | ^0.98.0 | Skills/agents del Studio (SDD-0020) |
| Payload (off) | @payloadcms/db-postgres, @payloadcms/next, @payloadcms/richtext-lexical, @payloadcms/storage-s3, payload | ^3.84.1 | Files en `_payload-disabled/`, NO se ejecuta. Quedó en deps por si reactivan |
| Image | sharp | ^0.34.5 | Optimización Next/Image + favicons |
| Bug Reporter | rrweb / rrweb-player | 2.0 / 1.0 alpha | Session replay (SDD-0036) |
| Notif | web-push | ^3.6.7 | Web push (futuro) |
| GraphQL | graphql | ^16.14.0 | Solo para Payload (deshabilitado) |
| Util | clsx + tailwind-merge | 2.1.1 / 3.6.0 | Class helpers |

---

## Dependencias destacadas — dev

| Paquete | Versión | Para qué |
|---------|---------|----------|
| vitest + @vitejs/plugin-react + @vitest/ui | 4.1.7 / 6.0.2 / 4.1.7 | Unit/component tests |
| @testing-library/react + jest-dom + user-event | 16.3 / 6.9 / 14.6 | RTL stack |
| jsdom | ^29.1.1 | DOM env para tests |
| @playwright/test | ^1.60.0 | E2E |
| eslint + eslint-config-next | ^9 / 16.2.6 | Lint |
| tailwindcss + @tailwindcss/postcss | ^4 / ^4 | CSS framework v4 |
| tsx | ^4.22.3 | Run scripts TS directo (seed, generate-favicons) |
| to-ico | ^1.1.5 | Generación favicon.ico desde PNGs |

---

## Estructura del monorepo

**1 único `package.json`** en la raíz. No hay workspaces ni sub-paquetes.

Pero conviven **4 productos** dentro del mismo Next.js app:

| Producto | Path en el repo | URL | Backend |
|----------|-----------------|-----|---------|
| Sitio público marketing | `app/` (raíz) | `dtdcargo.com` | Mostly static; futuro HTTP al ERP HailuWay |
| Studio ERP (DoorTuDoor) | `app/studio/(app)/*` | `dtdcargo.com/studio/*` | Supabase propio (DoorTuDoor) |
| Back de admin contenido | `app/back/*` | `dtdcargo.com/back/*` | Supabase compartido con Studio |
| Operario mobile PWA | `app/m/cn/*` + `app/m/ve/*` | `dtdcargo.com/m/{cn,ve}` | Supabase + PIN auth custom |
| Admin CBM (privado) | `app/admin/cbm-estudio/*` | `dtdcargo.com/admin/cbm-estudio` | Token URL único |

---

## Stack que NO se usa (a pesar de estar en deps)

- **Payload CMS** · Deshabilitado en `_payload-disabled/`, sin rutas mounted. Las deps (`@payloadcms/*`, `graphql`) quedan instaladas "por si reactivan". 11 CVEs moderate en transitivas, **no alcanzables** porque no hay rutas Payload mounted.
- **GraphQL** · Solo se usa vía Payload, así que efectivamente no se usa.

---

## Deploy

| Servicio | Producto |
|----------|----------|
| Vercel (team `hailu-wey`) | dtdcargo.com (sitio público + Studio + back) |
| Hostinger | DNS + Email `@dtdcargo.com` (no web hosting) |
| Supabase (`xpfuzqombmjmxvprjgmi`) | DB + Auth + Storage |

---

## Migraciones SQL aplicadas

**30 migraciones** numeradas en `supabase/migrations/`. Última: `0030_back_content_admin.sql` (back de contenido — esquema `back_*` con RLS por rol). Ver el directorio para el listado completo.

---

## Versiones críticas a recordar

- **Node 24.x** requerido (npm advierte si se usa una versión vieja)
- **pnpm 11.x** — el repo tiene `pnpm.onlyBuiltDependencies` configurado para `sharp`, `unrs-resolver`, `@tailwindcss/oxide`, `esbuild`
- **Next 16** trajo cambios mayores: `middleware.ts` → `proxy.ts`; `revalidateTag()` ahora pide 2 args; bundler default = Turbopack

---

*Documento generado automáticamente · DTD·CARGO technical stack snapshot · 2026-05-27*
