---
sdd: "0656"
title: "Actualizar el stack: inventario, riesgos, avisos de seguridad y plan por oleadas"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-17
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0505", "0541", "0621"]
confidencialidad: interno
---

# SDD-0656 — Actualizar el stack: inventario, riesgos, avisos de seguridad y plan por oleadas

> Sam preguntó cuándo conviene actualizar el stack, ya que salió una versión nueva de Next.js, y qué más hay que llevar a la última versión. Este documento solo analiza y propone. **No actualiza nada.** Cada oleada necesita un OK aparte de Sam.

## Contexto

- El ERP corre en Next.js 16.2.11 y React 19.2.4, con Supabase autoalojado en el VPS. Se publica como imagen Docker con `infra/ops/web/publicar-web.sh`, que tiene las puertas, el relevo sin corte, la prueba rápida (`smoke-web.sh`) y la vuelta atrás (SDD-0541).
- **Fusionar en `main` publica en producción**: el workflow `publicable.yml` mueve la etiqueta `:publicable` cuando la imagen y el CI están en verde, y el vigilante del servidor la publica. Por eso cada oleada es una PR propia, y su merge equivale a un despliegue.
- El CI corre en GitHub Actions (`quality.yml` y `sql-tests.yml`) con Node 24.22.1 y pnpm 11.19.0. El repo es público.
- Medición del 2026-11-17 sobre `origin/main` en `3f496f3de`. Las versiones actuales salen del `pnpm-lock.yaml`, que es lo que de verdad se instala, y no del rango del `package.json`. Las últimas versiones salen de `npm view <paquete> version` y de `registry.npmjs.org` (campo `time`). Los avisos salen de la API de GitHub Advisory (`gh api advisories?ecosystem=npm&affects=<paquete>@<versión>`).

## Alcance

- **Entra:** el inventario de versiones, el riesgo de cada salto según su changelog o guía oficial, los avisos de seguridad de las versiones actuales, un plan por oleadas con sus pruebas y su vuelta atrás, y una recomendación de cuándo hacerlo.
- **No entra:** tocar `package.json`, el lockfile, `pnpm-workspace.yaml`, el `Dockerfile` o los workflows. No se corrió `pnpm install`, `pnpm up`, `pnpm outdated`, `pnpm audit` ni `pnpm verify`. Tampoco se tocó producción.

## 1. Inventario

Leyenda del salto: **patch** (x.y.**z**), **minor** (x.**y**.0), **major** (**x**.0.0). En los paquetes 0.x, un cambio en el segundo número rompe según semver y se trata como major.

### Runtime y herramientas de base

| Pieza | Dónde está fijada | Actual | Última estable | Salto | Fecha de la última |
|---|---|---|---|---|---|
| Node (imagen Docker) | `Dockerfile:20` `NODE_IMAGE=node:24.22.1-bookworm-slim@sha256:…` | 24.22.1 | **24.22.3** (línea 24, LTS «Krypton»). También existe 26.13.1 (LTS «Lithium») | patch (**seguridad**). A 26 sería major | 2026-11-10 |
| Node (CI) | `quality.yml:46`, `sql-tests.yml:56`, `chatwoot-portal-poc.yml:65`: `runtime: node@24.22.1` | 24.22.1 | 24.22.3 | patch | 2026-11-10 |
| `engines.node` | `package.json` | `>=24` | — | — | — |
| pnpm | `Dockerfile:30` y `:42`, `quality.yml:45`, `sql-tests.yml:55`, `chatwoot-portal-poc.yml:64` | 11.19.0 | 12.21.0 (la línea 11 llega hasta 11.28.12) | major (o minor dentro de 11) | 2026-11-13 |

### Dependencias

| Paquete | Actual (lockfile) | Última estable | Salto | Fecha de la última |
|---|---|---|---|---|
| `next` | 16.2.11 | **16.4.6** (la línea 16.2 llega hasta 16.2.12) | minor | 2026-11-09 |
| `eslint-config-next` | 16.2.11 | 16.4.6 | minor | 2026-11-09 |
| `react` / `react-dom` | 19.2.4 | 19.3.1 (la línea 19.2 llega hasta 19.2.9) | minor | 2026-10-14 |
| `@types/react` / `@types/react-dom` | 19.2.14 / 19.2.3 | 19.3.0 / 19.3.0 | minor | 2026-09-09 |
| `typescript` | 5.9.3 | 7.0.2 (también existe 6.0.3) | major | 2026-07-08 |
| `@types/node` | 20.19.41 (rango `^20`, mientras `engines` pide Node ≥ 24) | 26.6.6. Para Node 24, la última es 24.19.2 | major (20 → 24) | 2026-10-09 (24.19.2) |
| `@supabase/supabase-js` | 2.106.1 | 2.119.0 | minor | 2026-11-04 |
| `@supabase/ssr` | 0.5.2 | 0.12.7 | 0.x: rompe según semver | 2026-09-08 |
| `vitest` / `@vitest/ui` | 4.1.7 | 5.1.0 (la línea 4 llega hasta 4.1.12) | major | 2026-11-02 |
| `@vitejs/plugin-react` | 6.0.2 | 6.3.0 | minor | 2026-11-09 |
| `vite` (override en `pnpm-workspace.yaml`) | 8.0.16 | 8.3.8 | minor | 2026-11-11 |
| `eslint` | 9.39.4 (npm marca la línea 9 como «no longer supported») | 10.15.0 (la línea 9 llega hasta 9.39.5) | major | 2026-11-13 |
| `tailwindcss` / `@tailwindcss/postcss` | 4.3.0 | 4.3.5 | patch | 2026-11-06 |
| `@playwright/test` | 1.60.0 | 1.65.1 | minor | 2026-11-13 |
| `jsdom` | 29.1.1 | 31.0.1 | major | 2026-11-13 |
| `@react-pdf/renderer` (PDF) | 4.5.1 | 4.9.0 | minor | 2026-08-27 |
| `exceljs` (Excel) | 4.4.0 | 4.4.0 | al día (sin versiones desde 2023-10-19) | — |
| `sharp` (override en `pnpm-workspace.yaml:22`) | **0.35.3** | **0.35.5** | patch (**seguridad**) | 2026-09-27 |
| `@anthropic-ai/sdk` | 0.98.0 | 1.9.0 | major (1.0.0 salió el 2026-10-21) | 2026-11-16 |
| `@uppy/core` / `@uppy/tus` (subida de adjuntos) | 5.2.0 / 5.1.1 | 6.3.1 / 6.0.1 | major | 2026-11-03 |
| `@electric-sql/pglite` (contratos SQL) | 0.5.8 | 0.5.16 | patch | 2026-11-09 |
| `tsx` | 4.22.3 | 4.23.15 | minor | 2026-09-20 |
| `tailwind-merge` | 3.6.0 | 3.7.0 | minor | 2026-09-12 |
| `@testing-library/react` | 16.3.2 | 16.3.3 | patch | 2026-08-27 |
| `file-type` | 22.0.1 | 22.3.0 | minor | 2026-10-29 |
| `qrcode.react` | 4.2.0 | 4.2.0 | al día | — |

Queda fuera de la tabla el resto de dependencias menores: los clientes AWS, `web-push`, `rrweb`, `clsx`, `qrcode`, `parse5`, `ajv` y los `@testing-library/*` restantes. Entran en la oleada A2 si `pnpm outdated`, corrido en un worktree, muestra patch o minor.

## 2. Avisos de seguridad de las versiones en uso

Fuente: GitHub Advisory Database, consultada el 2026-11-17 con `gh api "advisories?ecosystem=npm&affects=<paquete>@<versión>"`. Las URL son `https://github.com/advisories/<GHSA>`. Para `next@16.4.6`, la misma consulta devuelve **0** avisos.

**Hay avisos aplicables a la versión en uso. Se analizaron y se reportaron al DG; el detalle de cómo afectan a nuestra configuración queda fuera de este repo, que es público.** Abajo solo va la lista pública de cada aviso y la versión que lo corrige.

| Paquete y versión en uso | Avisos públicos (GHSA) | Corregidos en |
|---|---|---|
| `next` 16.2.11 (11 avisos: 5 críticos, 2 altos, 3 medios, 1 bajo) | [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr), [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r), [GHSA-4jqv-mc3x-m676](https://github.com/advisories/GHSA-4jqv-mc3x-m676), [GHSA-39w2-rjm5-chcv](https://github.com/advisories/GHSA-39w2-rjm5-chcv), [GHSA-f87g-xv8r-7p7x](https://github.com/advisories/GHSA-f87g-xv8r-7p7x), [GHSA-mcj8-r9mp-w47p](https://github.com/advisories/GHSA-mcj8-r9mp-w47p), [GHSA-cjq9-62q9-8jv4](https://github.com/advisories/GHSA-cjq9-62q9-8jv4), [GHSA-vcvr-r3jv-pc5j](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j), [GHSA-2xp9-vwfh-vxw4](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), [GHSA-p293-qw3h-jr36](https://github.com/advisories/GHSA-p293-qw3h-jr36) | Todos en ≤ 16.4.1. No hay parche en la línea 16.2 (16.2.12 no los corrige) |
| `sharp` 0.35.3 (override en `pnpm-workspace.yaml`) | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c) | 0.35.5 |
| `vitest` / `@vitest/mocker` 4.1.7 | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) | 4.1.12. Son herramientas de desarrollo y CI |
| Node 24.22.1 | Publicación de seguridad 24.22.3 (`security: true` en `https://nodejs.org/dist/index.json`, 2026-11-10) | 24.22.3 |

Sin avisos en la base de GitHub para las versiones que usamos de: `react`/`react-dom` 19.2.4, `@supabase/supabase-js` 2.106.1, `@supabase/ssr` 0.5.2, `eslint` 9.39.4, `@playwright/test` 1.60.0, `@react-pdf/renderer` 4.5.1, `exceljs` 4.4.0, `@anthropic-ai/sdk` 0.98.0, `pnpm` 11.19.0, `web-push` 3.6.7, `qrcode` 1.5.4 y `rrweb` 2.0.0-alpha.4. Las dependencias transitivas **no se midieron**, porque `pnpm audit` no se corrió (NO EJECUTADO, por la regla de esta fase). La oleada A1 lo corre en su worktree.

**Conclusión:** la versión en uso tiene avisos públicos de gravedad crítica y alta que solo se corrigen subiendo de versión. Por eso este plan **adelanta una oleada de seguridad (A1)**, en vez de tratar todo como mantenimiento.

## 3. Riesgo por paquete y usos afectados en el código

### Next.js 16.2.11 → 16.4.6 (riesgo: bajo a medio)

- Es un minor dentro de la 16. Las notas de [v16.3.0](https://github.com/vercel/next.js/releases/tag/v16.3.0) y [v16.4.0](https://github.com/vercel/next.js/releases/tag/v16.4.0) no traen cambios que rompan la API pública que usamos. Lo que traen es Turbopack, limpieza interna y la retirada de `experimental.appNewScrollHandler`, que no usamos.
- **`proxy.ts`** (antes `middleware.ts`) ya tiene el nombre de Next 16. La 16.4 corrige su detección con `pageExtensions` compuestos (#93246). Nosotros no definimos `pageExtensions`.
- **`cookies()`/`headers()`** ya se esperan con `await`, como pide Next 16: `lib/db/server.ts:21` hace `const cookieStore = await cookies()`.
- **APIs `unstable_`**: `lib/shared/use-action-keeping-draft.ts:1` importa `unstable_rethrow` y `unstable_isUnrecognizedActionError` de `next/navigation`. Siguen siendo inestables y pueden cambiar entre minors, así que hay que revisar el build y el tipo de los dos en la oleada.
- **`experimental.serverActions.bodySizeLimit`** (`next.config.ts:224-235`) lo usa el registro para subir la foto de la cédula (12 MB). Hay que confirmar que sigue vigente en la 16.4; la prueba es subir una foto de más de 1 MB en `/registro`.
- **Image Optimization y `sharp`:** el `Dockerfile` (líneas 99-114) copia a mano los paquetes `@img/*` y prueba que `sharp` convierte. Si sube `sharp`, cambia la versión de libvips y esa prueba tiene que seguir en verde. Además, la puerta de `publicar-web.sh` vuelve a probar `sharp` dentro de la imagen.
- **Override de `sharp`:** `sharp: 0.35.3`, en `pnpm-workspace.yaml:22`, lo introdujo el commit `b1aa30d99` (SDD-0224) como pin de seguridad. Next 16.4.6 ya declara `sharp ^0.35.5`, así que en A1 se puede subir el pin a 0.35.5 o quitarlo y dejar que mande Next (D10).
- **`next/og`:** `app/noticias/[slug]/opengraph-image.tsx` necesita una revisión visual de la imagen OG de una noticia.
- `eslint-config-next` sube con Next: mismo número de versión y peer `eslint >= 9`.

### React 19.2.4 → 19.3.1 (riesgo: bajo)

- Es un minor. Next 16.4.6 acepta `react ^19.0.0`. El App Router usa su propia copia de React, así que el cambio pesa sobre todo en los tipos y en las pruebas con jsdom. `@types/react` y `@types/react-dom` 19.3.0 tienen que subir en la misma PR.
- Según el [CHANGELOG de React](https://github.com/facebook/react/blob/main/CHANGELOG.md), la 19.3.0 trae `<ViewTransition>` y revela en lote los límites de `Suspense`. Además, **los IDs de `useId` pasan a usar `_` en vez de `:`**, lo que puede romper selectores o snapshots de pruebas que usen esos IDs. El changelog no tiene una sección de cambios que rompan.

### `@supabase/supabase-js` 2.106.1 → 2.119.0 (riesgo: bajo)

- Es un minor dentro de la v2. `@supabase/ssr` 0.12.x **exige** `@supabase/supabase-js ^2.114.0` como peer, así que este salto va antes que el de la oleada C, o en la misma PR.
- Se usa en el Studio, en el móvil y en `lib/db/*`. El sitio público no lo importa, por la frontera de ESLint.

### `@supabase/ssr` 0.5.2 → 0.12.7 (riesgo: medio, por la sesión)

Fuente: [CHANGELOG oficial](https://github.com/supabase/ssr/blob/main/CHANGELOG.md).

- **La API de cookies no cambia para nosotros.** Ya usamos `getAll()`/`setAll()`, la API vigente desde la 0.5. La quitada fue la de `get`/`set`/`remove`. Usos: `proxy.ts:59` y `:87-100`, `lib/db/server.ts:14` y `:29-42`, y `lib/db/client.ts:13` (`createBrowserClient`).
- **0.8.0:** agrega la opción `cookies.encode`, que achica la cookie; el valor por defecto se conserva. **0.8.1:** pasa a usar `skipAutoInitialize` para evitar la carrera del refresco del token en SSR, lo que cambia el momento en que se refresca la sesión.
- **0.10.0:** `setAll` recibe un segundo argumento con cabeceras de caché, para que un CDN no guarde respuestas de autenticación. Nuestro `setAll(cookiesToSet)` en `proxy.ts:90` lo ignora. Conviene aplicar esas cabeceras a `supabaseResponse`, sobre todo si hay Cloudflare delante (inferencia: sin medir la configuración de caché del proxy).
- **0.12.0:** la dependencia `cookie` pasa a 1.0.2, se reescribe el troceado de cookies y llega `clearAuthCookiesAtScopes`. **0.12.1:** se deduplican las escrituras de cookies en el servidor. **0.12.3:** se conserva el borrado por dominio.
- **Riesgo concreto:** que una sesión abierta con 0.5.2 no se lea con 0.12.7 (cookies troceadas o en base64) y la gente tenga que volver a entrar, o que se rompa el dominio compartido de la sesión (`sessionCookieOptions()`). Lo cubre `lib/db/__tests__/session-cookie.test.ts`. Hace falta además una prueba manual: entrar con 0.5.2, publicar la 0.12.7 y comprobar que la sesión sigue viva en el Studio, el portal y `/invitar`. **`smoke-web.sh` no inicia sesión**, así que no lo detecta.

### Vitest 4.1.7 → 5.1.0 (riesgo: medio)

Fuente: la [guía de migración](https://github.com/vitest-dev/vitest/blob/main/docs/guide/migration/index.md) y las [notas de v5.0.0](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0).

- Pide Node ≥ 22.12, Vite ≥ 6.4 y `@types/node ^22 || >=24`. **Sube junto con `@types/node` 24.**
- **`clearMocks` pasa a estar activo por defecto.** Las pruebas que dependían de que un mock conservara sus llamadas entre `it` cambian de resultado. `vitest.config.ts` no lo define.
- Las aserciones asíncronas sin `await` ahora fallan, y `vi.mock` tiene que ir en el nivel superior del archivo. Pueden aparecer rojos legítimos: se corrige la prueba, no se debilita.
- Los reportes `json` y `junit` dejan de escribir en stdout y van a `.vitest/`. Hay que revisar si `scripts/verify.mjs` o el CI leen la salida JSON de Vitest. El reporter `list,json` de `scripts/verify.mjs:517` es de Playwright y no cambia.
- Con jsdom, lo que se asigna a `window` o `globalThis` ahora llega a la ventana real (`environment: "jsdom"` en `vitest.config.ts:26`, con `globals: true` en `:27`).

### jsdom 29 → 31 (riesgo: medio)

- Según las notas de [v30](https://github.com/jsdom/jsdom/releases/tag/v30.0.0), la 30 pide Node `^24.15` o superior.
- Según las de [v31](https://github.com/jsdom/jsdom/releases/tag/v31.0.0), la 31 trae una implementación nueva de CSS (parser, selectores y `getComputedStyle`), así que pueden cambiar las pruebas de componentes que miran estilos.
- `@types/jsdom` solo llega a la 30.0.0. Recomendación: pasar a jsdom 30 en la oleada B y dejar la 31 para cuando salgan sus tipos.

### ESLint 9.39.4 → 10.x (riesgo: medio a alto)

Fuente: [guía «migrate to v10»](https://github.com/eslint/eslint/blob/main/docs/src/use/migrate-to-10.0.0.md).

- Nuestro flat config (`eslint.config.mjs`, con `defineConfig` y `globalIgnores`) sigue siendo válido.
- La configuración se busca desde el directorio de cada archivo, y `eslint:recommended` suma `no-unassigned-vars`, `no-useless-assignment` y `preserve-caught-error`. Saldrán avisos nuevos.
- **El freno:** `eslint-config-next` 16.4.6 acepta `eslint >=9`, pero tres plugins que arrastra no declaran soporte para la 10: `eslint-plugin-react` (`^9.7`), `jsx-a11y` (`^9`) e `import` (`^9`). Darían advertencias de peer, y no está verificado si fallan al correr. Las fronteras ESLint del proyecto (público ↔ ERP) son críticas y no pueden quedar en duda.

### TypeScript 5.9.3 → 6.0.3 → 7.0.2 (riesgo: medio para la 6, alto para la 7)

Fuentes: los anuncios de [TypeScript 6.0](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) y [TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

- **6.0** cambia valores por defecto (`types: []`, `rootDir: "."`) y depreca `baseUrl`, `moduleResolution node10`, `target es5` y otras opciones. Nuestro `tsconfig.json` ya usa `moduleResolution: "bundler"` (línea 15), `target: "ES2022"` (línea 3), `strict` (línea 11) y `paths` sin `baseUrl` (línea 25), así que el impacto esperado es chico. Hay que revisar `types`, porque con `[]` hace falta declarar `node` y `vitest/globals` (usamos `globals: true`).
- **7.0** es el compilador nativo en Go y no trae API programática. `typescript-eslint` 8.73 y `eslint-config-next` 16.4.6 piden `typescript >=4.8.4 <6.1.0`, así que **hoy TS 7 rompe el lint con tipos**.

### pnpm 11.19.0 → 12.x (riesgo: bajo a medio)

Fuente: [notas de v12.0.0](https://github.com/pnpm/pnpm/releases/tag/v12.0.0).

- Una clave desconocida en `pnpm-workspace.yaml` pasa a dar error (`ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`).
- El primer install que vuelva a resolver reescribe las claves de algunos ciclos de peers.
- `--frozen-lockfile false` ya no se acepta.
- Las notas no mencionan cambios en `allowBuilds` ni en `overrides` (sin verificar).
- Varios handoffs (por ejemplo `.agents/handoffs/0574-embarques-sin-facturar.md:333`) muestran que Corepack ya resuelve pnpm 12 en las PC cuando no se fija la versión, así que conviene alinear. Primero 11.28.12 en la oleada B; la 12 va en la C.

### `@anthropic-ai/sdk` 0.98 → 1.x (riesgo: medio a alto)

Fuente: [guía de migración 2026-10-21](https://platform.claude.com/docs/en/api/migration-2026-10-21), enlazada desde el [MIGRATION.md del SDK](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/MIGRATION.md).

- Con la versión de API 2026-10-21, **mandar `temperature`, `top_p` o `top_k` devuelve 400.** Nosotros lo mandamos en `lib/studio/chatwoot/analisis-motor.ts:128` (`temperature: 0.2`) y en `lib/studio/document-import/anthropic.ts:50` (`temperature: 0`). Hay que quitarlo en la misma PR y revisar que el análisis y la importación de documentos sigan dando lo mismo.

### Uppy 5 → 6 (riesgo: bajo a medio)

Fuente: la [guía de migración de Uppy](https://github.com/transloadit/uppy/blob/main/website/docs/guides/migration-guides.md).

- Solo se usan `Uppy` y `Tus`, en `app/studio/_components/attachments/useAttachmentUpload.ts:4-5`. `@uppy/tus` 6 ya no aborta la petición cuando falla: el error del servidor llega a `upload-error` con `file.response`. Hay que revisar cómo ese hook muestra los errores de subida.

### `@types/node` ^20 → ^24 (riesgo: bajo)

- Alinea los tipos con el Node que de verdad corre: `engines >=24`, el Dockerfile y el CI. Se pueden destapar errores de tipos en APIs que cambiaron entre la 20 y la 24, como `fetch`, `Buffer` y `stream/web`. Lo detecta `tsc --noEmit` en el CI. No cambia nada en tiempo de ejecución.

### Node 24.22.1 → 24.22.3 (riesgo: bajo) y Node 26 (más adelante)

- Es un patch de seguridad. Se cambia en cuatro sitios que tienen que ir juntos: `Dockerfile:20` (etiqueta **y digest** `sha256`), `quality.yml:46`, `sql-tests.yml:56` y `chatwoot-portal-poc.yml:65`. `.agents/handoffs/node24-22-1-builds-20261025.md` explica por qué se fijó la 24.22.1 con Debian 12 Bookworm; esa decisión se mantiene.
- Node 26 es LTS, pero conviene esperar a que Next declare soporte explícito y a que se estabilice `sharp`/libvips en esa base. Queda como decisión aparte (D6).

## 4. Plan por oleadas

Reglas comunes a todas las oleadas:

- **Una oleada, una PR, un worktree, una sesión Worker.** La SDD de cada oleada es esta (0656) con su fase, salvo que el DG asigne otra.
- **Ventana de congelamiento:** antes de empezar, el DG confirma que no hay PR abiertas que toquen `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, el `Dockerfile` o `.github/workflows/`. Hoy, 2026-11-17, ninguna de las 13 PR abiertas los toca. Durante la oleada no se fusiona ninguna otra PR: un merge ajeno publica en producción y mezcla dos causas si algo falla. Si se congela o no el vigilante es la decisión D11. Si se congela, se usa `publicar-web.sh congelar "SDD-0656 oleada X"` y se descongela para publicar la oleada a mano.
- **Instalación:** solo en el worktree de la oleada, con `pnpm install` (que actualiza el lockfile), y después `pnpm install --frozen-lockfile` limpio para comprobar. Nunca en el checkout principal.
- **Pruebas antes de pedir el merge:** `pnpm verify` en el worktree, que incluye build, lint, typecheck, Vitest, contratos SQL y e2e, más el CI de GitHub en verde (`quality.yml`, `sql-tests.yml`) y la revisión independiente que lanza el DG.
- **Verificación en el servidor propio:** el workflow `build-image.yml` construye la imagen; su prueba de `sharp` está en el `Dockerfile`, líneas 107-114. Al fusionar, `publicar-web.sh` pasa las puertas, levanta la imagen nueva al lado de la vieja, espera *healthy*, corre `smoke-web.sh --host dtdcargo.com --www` y, si falla, vuelve sola a la imagen anterior.
- **Criterio de vuelta atrás:** se vuelve atrás con `publicar-web.sh volver` si pasa cualquiera de estas cosas en las primeras 24 h:
  - la prueba rápida falla,
  - aparecen errores 5xx nuevos en `docker logs` del web,
  - no se puede iniciar sesión,
  - falla la subida de un adjunto o de la foto de la cédula,
  - un PDF sale distinto.
  Después se revierte la PR con `git revert`, sin reescribir la historia. Ninguna oleada trae migraciones de base de datos, así que la vuelta atrás es solo de imagen.

### Oleada A1 — Seguridad (urgente)

| | |
|---|---|
| **Qué** | `next` y `eslint-config-next` a 16.4.6; el override `sharp` a 0.35.5, o quitarlo (D10); Node 24.22.3 (Docker y CI); `vitest`/`@vitest/ui` a 4.1.12, sin cambiar de major |
| **Allowlist** | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (solo la línea de `sharp`), `Dockerfile` (`NODE_IMAGE` con su digest), `.github/workflows/quality.yml`, `sql-tests.yml` y `chatwoot-portal-poc.yml` (solo `runtime: node@…`), `.agents/handoffs/0656-*.md`. El código solo se toca si el build lo exige |
| **Pruebas** | `pnpm verify`, CI en verde, `pnpm audit --prod` en el worktree (antes y después), la prueba de `sharp` del `Dockerfile` y, a mano en producción tras publicar: una página con `next/image` desde Storage, la imagen OG de una noticia, `/registro` con una foto de más de 1 MB, entrar al Studio y al portal, y un PDF del ERP |
| **Esfuerzo** | 2 a 3 h de Worker, más 1 h de revisión y publicación |

### Oleada A2 — Minors y patches de bajo riesgo

| | |
|---|---|
| **Qué** | `react`/`react-dom` 19.3.1 con `@types/react`/`@types/react-dom` 19.3.0; `@supabase/supabase-js` 2.119.0; `tailwindcss`/`@tailwindcss/postcss` 4.3.5; `@playwright/test` 1.65.1; `@react-pdf/renderer` 4.9.0; `vite` 8.3.8 (override); `@vitejs/plugin-react` 6.3.0; `@electric-sql/pglite` 0.5.16; `tsx`, `tailwind-merge`, `@testing-library/react`, `file-type`; y los patch o minor del resto que muestre `pnpm outdated` en el worktree |
| **Allowlist** | `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (override de `vite`), `.agents/handoffs/0656-*.md` |
| **Pruebas** | `pnpm verify` (con e2e de Playwright, por el cambio de navegadores de la 1.65), CI y contratos SQL con PGlite. A mano: un PDF de cada tipo (recibo, guía, packing list) comparado con uno anterior, y la vista de Tailwind en el Studio y en la web pública |
| **Esfuerzo** | 3 a 4 h, más 1 h de revisión |

### Oleada B — Tipos y herramientas

| | |
|---|---|
| **Qué** | `@types/node` a ^24 (24.19.2); TypeScript 6.0.3; ESLint 9.39.5 (sin cambiar de major); Vitest 5.1.0 con `@vitest/ui`; `jsdom` 30 con `@types/jsdom` 30; pnpm 11.28.12 (sin cambiar de major) en el `Dockerfile` y los 3 workflows |
| **Allowlist** | `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `vitest.setup.ts`, `Dockerfile` (pnpm), `.github/workflows/{quality,sql-tests,chatwoot-portal-poc}.yml` (pnpm), `scripts/verify.mjs` si cambia la salida de Vitest, los archivos de código o de prueba que pida el compilador o el linter (sin debilitar pruebas), y el handoff |
| **Pruebas** | `pnpm verify`. Comparar el **número de pruebas** de Vitest antes y después: un reporter o un patrón `include` que cambie puede dar un verde falso con menos pruebas. `pnpm harness:test` y `node scripts/check-build.mjs`. No necesita prueba manual en producción más allá de la prueba rápida, porque no cambia nada en tiempo de ejecución |
| **Pendiente que viene de la A2** | `expectPdfIntegro`, en `recibo-pdf.test.ts` y `finiquito-pdf.test.ts`, pasaba si ningún `/Length` hacía match. Ahora exige que el número de streams con `/Length` sea igual al número de `stream`. Era una recomendación de la revisión de #643; se hizo en la PR de seguimiento (rama `claude/0656-seguimiento-docs`) |
| **Lo que salió de la B** | jsdom 30 no entró: con él fallaban 27 pruebas. Los fixtures de `MobileErpClient.fechas-caracas` (18) y `payment-report-ui` (8) llenan el FileList con el símbolo interno `impl`, que la 30 ya no tiene, y tampoco existe `DataTransfer`. En `CommentsThread` (1), el motor de CSS nuevo no reporta `flex` ni `minWidth`. Por decisión del DG, la B se cerró con jsdom ^29.1.1 y la 30 pasa a la oleada C |
| **Esfuerzo** | 4 a 8 h; depende de cuántos errores nuevos destape TypeScript o ESLint |

### Oleada C — Majors con cambio de API

| | |
|---|---|
| **Qué** | `@supabase/ssr` 0.12.7, incluidas las cabeceras de caché en `setAll`; y en PR aparte cada una: `@anthropic-ai/sdk` 1.x, `@uppy/core`/`@uppy/tus` 6, pnpm 12, jsdom 30 (viene de la B: reescribir los fixtures de FileList y revisar `CommentsThread`, sin debilitar pruebas) y, si se decide, TypeScript 7 |
| **Allowlist (`ssr`)** | `package.json`, `pnpm-lock.yaml`, `proxy.ts`, `lib/db/server.ts`, `lib/db/client.ts`, `lib/db/__tests__/session-cookie.test.ts` (solo para ampliarlo) y el handoff |
| **Pruebas (`ssr`)** | `pnpm verify` y una prueba nueva de compatibilidad: una cookie escrita con el formato de 0.5.2 se lee con 0.12.7. A mano en la prueba (no en producción): entrar con la imagen vieja, cambiar a la nueva y confirmar que la sesión sigue en el Studio, el portal, `/invitar` y el móvil; cerrar sesión, y volver a entrar |
| **Esfuerzo** | `ssr`: 4 a 6 h, más una prueba manual de 30 min con Sam. Cada uno de los demás: 2 a 6 h |

## 5. Cuándo hacerlo

**Recomendación:**

1. **A1 (seguridad) hoy mismo, después de la reunión del 2026-11-17, o a más tardar mañana 18 en la mañana.** Hay que hacerla antes de la próxima tanda grande de fusiones. Los avisos críticos de la versión en uso son públicos desde el 2026-09-08 y el 2026-10-22, y se corrigen subiendo de versión. Las mitigaciones temporales, si A1 se retrasa, están en el análisis fuera del repo (D2).
2. **A2 al día siguiente de publicar A1**, cuando la A1 haya pasado 24 h sin vuelta atrás.
3. **B en una ventana tranquila de la semana**, sin otras PR de producto en vuelo. B no cambia nada en tiempo de ejecución, pero choca con cualquier PR que toque código que TypeScript o ESLint vayan a marcar.
4. **C (`@supabase/ssr`) con Sam disponible para la prueba de sesión**, en horario de poco uso, porque si falla obliga a volver a entrar. Los demás majors de C van sin prisa, uno por PR.

**Condición para abrir cada ventana:** las PR abiertas no tocan `package.json`, el lockfile, `pnpm-workspace.yaml`, el `Dockerfile` ni los workflows; no hay una publicación pendiente en el vigilante; y no hay una migración en espera que frene la publicación.

| Oleada | Esfuerzo de Worker | Revisión y publicación | Riesgo | Prisa |
|---|---|---|---|---|
| A1 | 2 a 3 h | 1 h | bajo | **urgente (seguridad)** |
| A2 | 3 a 4 h | 1 h | bajo | esta semana |
| B | 4 a 8 h | 1 a 2 h | medio (CI) | esta semana o la próxima |
| C `ssr` | 4 a 6 h | 1 h, más 30 min con Sam | medio (sesión) | próximas dos semanas |
| C otros | 2 a 6 h cada uno | 1 h cada uno | bajo a medio | sin prisa |

## Decisiones para Sam

- **D1 — ¿Adelantamos la A1 (seguridad) a hoy, después de la reunión?** Recomendación: **sí**. La versión en uso tiene avisos públicos críticos y altos que se corrigen subiendo de versión. Es un salto minor de Next más dos patch (`sharp` y Node).
- **D2 — Si la A1 no puede salir en 24 h, ¿aplicamos una mitigación temporal?** Recomendación: **no hace falta si la A1 sale mañana a más tardar**. Si se retrasa, el DG trae a Sam las opciones del análisis fuera del repo, con su costo.
- **D3 — ¿Revisamos los hosts permitidos para imágenes remotas en `next.config.ts`?** Recomendación: **sí, en una PR propia después de la A1**. Antes hay que medir qué noticias publicadas siguen usando cada host.
- **D4 — ¿TypeScript 6.0 o directo a la 7 en la oleada B?** Recomendación: **6.0.3**. La 7 hoy rompe `typescript-eslint` y `eslint-config-next`, que piden TypeScript menor que 6.1. Se retoma cuando salga la 7.1 con su API y esos paquetes la acepten.
- **D5 — ¿ESLint 10 en la oleada B o nos quedamos en 9.39.5?** Recomendación: **quedarnos en 9.39.5 por ahora.** Tres plugins de `eslint-config-next` (`react`, `jsx-a11y` e `import`) no declaran soporte para la 10, y las fronteras ESLint público ↔ ERP no pueden quedar en duda. Pasamos a la 10 cuando Next lo declare.
- **D6 — ¿Node 26 LTS ahora o más adelante?** Recomendación: **más adelante**, en una SDD propia cuando Next declare soporte y lo hayamos probado en `bookworm`. Por ahora, 24.22.3.
- **D7 — ¿Prueba de sesión de `@supabase/ssr` en el servidor de prueba o directo en producción con la vuelta atrás lista?** Recomendación: **en la prueba primero**, con Sam presente. Si falla en producción, todos tienen que volver a entrar.
- **D8 — ¿Una revisión mensual de versiones y avisos?** Recomendación: **sí**, el primer lunes de cada mes: consultar los avisos de `next`, `sharp`, `@supabase/*` y Node, y abrir una A1 si aparece algo que nos aplique. Así no se vuelven a acumular cinco meses de parches.
- **D9 — ¿Dónde vive el análisis de aplicabilidad hasta publicar la A1?** Recomendación: **fuera de este repo público, en el repo privado de memoria compartida**, con el DG como destinatario. Después de publicar la A1 se decide si pasa a un documento de seguridad o se archiva.
- **D10 — ¿Subimos el override de `sharp` a 0.35.5 o lo quitamos?** Recomendación: **subirlo a 0.35.5 en la A1** y dejar para una PR aparte la decisión de quitarlo. Se puso como pin de seguridad (`b1aa30d99`, SDD-0224), y Next 16.4.6 ya pide `^0.35.5`. Mantener el pin evita que otra dependencia arrastre una versión distinta sin que nadie lo vea. El costo es que hay que subirlo a mano en cada aviso.
- **D11 — ¿La A1 congela el vigilante de publicación?** Recomendación: **sí**. Congelar antes del merge y publicar la A1 a mano con `publicar-web.sh publicar <sha>`, para mirar la prueba rápida en vivo. Si no, otro merge que llegue en la misma ventana se publica solo.

### Decisiones tomadas (2026-11-17)

- **D1, D2, D9, D10 y D11** se resolvieron con la oleada A1, según las recomendaciones:
  - A1 salió el mismo día y no hizo falta mitigación temporal.
  - El análisis de aplicabilidad quedó fuera de este repo.
  - El override de `sharp` subió a 0.35.5.
  - El DG publicó la A1 a mano.
- **D3 a D8:** Sam aceptó las recomendaciones en el chat del DG. A la pregunta «¿acepto las 6 recomendaciones del stack?» contestó: «Sí, las 6».

| Decisión | Queda así |
|---|---|
| D3 | Sí: revisar los hosts de imágenes remotas en una PR propia, midiendo antes qué noticias usan cada uno |
| D4 | TypeScript 6.0.3 en la oleada B |
| D5 | Se sigue en ESLint 9.39.5 |
| D6 | Node 26 más adelante, en una SDD propia |
| D7 | `@supabase/ssr` se prueba primero en el servidor de prueba, con Sam presente; lo coordina el DG |
| D8 | Revisión mensual de versiones y avisos, el primer lunes de cada mes |

## Estado de las oleadas

| Oleada | Estado | PR |
|---|---|---|
| A1 (seguridad) | Hecha, fusionada y publicada | [#636](https://github.com/SoftAgentes/DTDCARGO/pull/636) |
| A1 complemento: Node 24.22.3 en Chatwoot y el cable | Hecha y fusionada | [#639](https://github.com/SoftAgentes/DTDCARGO/pull/639) |
| `agentRules: false` (efecto de Next 16.4 sobre `AGENTS.md`) | Hecha y fusionada | [#644](https://github.com/SoftAgentes/DTDCARGO/pull/644) |
| A2 (minors y patches) | Hecha y fusionada | [#643](https://github.com/SoftAgentes/DTDCARGO/pull/643) |
| B (tipos y herramientas) | Hecha y fusionada, con jsdom 29 | [#650](https://github.com/SoftAgentes/DTDCARGO/pull/650) |
| Seguimiento: pin de pnpm en la plantilla, `expectPdfIntegro` y notas | En revisión | rama `claude/0656-seguimiento-docs` |
| C (majors con cambio de API) | Pendiente; `@supabase/ssr` con la prueba de D7; incluye jsdom 30 | — |

## Criterios de aceptación de esta SDD (fase de análisis)

- [x] Inventario con la versión actual, la última estable, el tipo de salto y la fecha.
- [x] Avisos de seguridad públicos con su fuente oficial y su versión corregida. La aplicabilidad se reportó al DG fuera del repo.
- [x] Riesgo por paquete con `archivo:línea` de los usos afectados.
- [x] Plan por oleadas con su allowlist, sus pruebas, la verificación en el servidor, la ventana y la vuelta atrás.
- [x] Recomendación de cuándo hacerlo y esfuerzo de cada oleada.
- [x] Decisiones D1 a D11 contestadas por Sam (2026-11-17). Ejecutar cada oleada es trabajo aparte, con su OK.
