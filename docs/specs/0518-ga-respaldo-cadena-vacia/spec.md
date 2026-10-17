---
sdd: "0518"
title: "Google Analytics y la etiqueta de Ads cargan aunque NEXT_PUBLIC_GA_ID llegue vacía"
status: done
author: "Claude"
created: 2026-10-14
updated: 2026-10-15
supersedes: null
superseded_by: null
related: ["0505"]
confidencialidad: interno
---

# SDD-0518 — Google Analytics y la etiqueta de Ads cargan aunque `NEXT_PUBLIC_GA_ID` llegue vacía

> Una cadena vacía o con sólo espacios en `NEXT_PUBLIC_GA_ID` cuenta como «sin
> definir»: en producción cae al ID de la propiedad `G-25CD7BZH98` y se cargan GA4
> y Google Ads. Se inventaría el mismo patrón en el resto del código y se explica
> por qué no se corrige ningún otro caso.

## Contexto

La imagen Docker de la [0505](../0505-dockerizar-dtd-cargo-contabo/spec.md) recibe
cada `NEXT_PUBLIC_*` como build arg (`ARG` + `ENV` en el `Dockerfile`). Un build arg
sin valor no llega como `undefined`: llega como `""`. El 2026-10-14 la sesión de
Contabo midió que la imagen `sha-cf279d98` salía sin Google Analytics: 0 archivos de
`.next/static` con el ID ([handoff de la 0505](../../../.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md),
entrada de las 13:20Z).

La causa estaba en `components/Analytics.tsx:31-33` (base `d28fa515`):

```ts
const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID ??
  (process.env.NODE_ENV === "production" ? "G-25CD7BZH98" : "");
```

`??` sólo cae al respaldo con `null` o `undefined`. Con `""`, `GA_ID` quedaba
vacío, `AnalyticsRuntime` devolvía `null` y con eso tampoco se cargaba la etiqueta
de Ads `AW-561290482`, que viaja en el mismo init. Se resolvió con la variable de
repositorio `NEXT_PUBLIC_GA_ID` (13:26:40Z), pero el código seguía dependiendo de
que nadie la borrara.

## Decisión

```ts
const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID?.trim() ||
  (process.env.NODE_ENV === "production" ? "G-25CD7BZH98" : "");
```

- La cadena vacía o con sólo espacios cae al respaldo, igual que `undefined`.
- Un valor real se usa recortado. Sin `trim`, un valor con espacios generaba un
  loader `gtag/js?id= G-…` que no sirve.
- La semántica de entorno no cambia: en desarrollo y sin valor, GA sigue apagado.
  El respaldo no cambia.
- No se agrega un helper compartido: es un solo caso (ver el inventario) y la
  forma `process.env.NEXT_PUBLIC_X?.trim()` ya tiene precedente en
  `lib/db/session-cookie.ts:21`.
- Los otros IDs del componente (`ADS_ID` y `WHATSAPP_CONVERSION`) son constantes,
  no se leen del entorno: no tienen este problema.

### Next sigue inlineando la expresión

Una prueba en Vitest lee `process.env` real y no demuestra lo que hace el bundler.
Se midió con un proyecto Next mínimo (Next 16.2.11, `next build` con Turbopack, el
mismo bundler que usa `Dockerfile:88`), con la misma expresión en un componente
`"use client"`:

| Build | Chunk del navegador | HTML prerenderizado |
|---|---|---|
| `NEXT_PUBLIC_GA_ID="  G-SONDA-REAL "`, forma nueva | `let i="  G-SONDA-REAL ".trim()\|\|"RESPALDO-SONDA-0518"` | `[G-SONDA-REAL]` |
| `NEXT_PUBLIC_GA_ID=""`, forma nueva | `let i="".trim()\|\|"RESPALDO-SONDA-0518"` | `[RESPALDO-SONDA-0518]` |
| `NEXT_PUBLIC_GA_ID=""`, forma de main (`??`) | el respaldo no aparece en ningún chunk | `[]` |

En los dos builds de la forma nueva, ningún chunk conserva `NEXT_PUBLIC_GA_ID`. La
última fila reproduce lo que midió la 0505 en la imagen.

## Inventario del patrón

Búsqueda: `git grep -nE "process\.env\.NEXT_PUBLIC_[A-Z_]+[[:space:]]*\?\?" d28fa515 -- app components lib`.
Resultado: **51 líneas en 49 archivos**. Ninguna está en `lib/shared/`.

| Variable | Líneas | Respaldo | Qué hace `""` | Decisión |
|---|---|---|---|---|
| `NEXT_PUBLIC_GA_ID` | 1 (`components/Analytics.tsx:32`) | `G-25CD7BZH98` en producción | apaga GA4 y Ads sin avisar | **se corrige** |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | 3 | `null` | nada distinto de `null` | no se corrige |
| `NEXT_PUBLIC_BUILD_SHA` | 1 | `VERCEL_GIT_COMMIT_SHA`, luego `null` | nada visible | no se corrige |
| `NEXT_PUBLIC_SITE_URL` | 46 | `https://dtdcargo.com` (39) o `http://localhost:3000` (7) | el build falla de forma visible | no se corrige; ver abajo |

### `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (3)

`app/studio/(app)/admin/alertas-telegram/page.tsx:59`,
`app/studio/(app)/layout.tsx:131` y `app/studio/(app)/usuarios/actions.ts:1096`.
Todos los consumidores la evalúan por verdad o falsedad:
`TelegramAlertsPanel.tsx:297` (`botUsername ? … : null`) y `ProfileModal.tsx:1172`,
`:1301` y `:1370` (`linkCode && botUsername`, `!botUsername`). `""` y `null` dan lo
mismo: no se arma el enlace `t.me` y el perfil muestra «Bot no configurado». El
`botUsername` que devuelve `linkTelegramAccountAction` no lo lee nadie
(`ProfileModal.tsx:1180-1187` sólo usa `ok`, `linkCode` y `error`).

### `NEXT_PUBLIC_BUILD_SHA` (1)

`app/studio/(app)/layout.tsx:44-47`. Con `""` no cae a `VERCEL_GIT_COMMIT_SHA`,
pero esa variable sólo existe en Vercel, donde `NEXT_PUBLIC_BUILD_SHA` no está
definida (lista de 24 variables del handoff de la 0505), y en la imagen el workflow
la pasa siempre (`build-image.yml:88`, `github.sha`). Si llegara vacía, el único
consumidor (`BugReportModal.tsx:330` y `:595`) manda `""` en el campo oculto, igual
que con `null` (`buildSha ?? ""`), y oculta la etiqueta del SHA (`buildSha && …`).

### `NEXT_PUBLIC_SITE_URL` (46): se deja que el build falle

Con `""` las 46 lecturas rompen algo: todas arman URLs absolutas que salen de la
página (JSON-LD, `sitemap.xml`, `robots.txt`, `metadataBase`, enlaces de correos y
Telegram, el `redirectTo` y el enlace mágico del Portal, invitaciones y recuperación
del Studio). Pero hoy esa ruptura **no llega a producción**: `app/layout.tsx:26`
hace `new URL(SITE_URL)` en `metadataBase`, y con `""` el build se detiene con
«TypeError: Invalid URL · input: ''». Lo midió la 0505 en la primera corrida de
`build-image.yml` (handoff, «primer intento: FALLÓ»).

Ese fallo visible es el que protege a las otras 45 lecturas. Por eso no se corrige
ningún caso:

- **Corregir sólo `app/layout.tsx`** (o un subconjunto) dejaría pasar el build con
  enlaces relativos en las demás: por ejemplo, el enlace de acceso al Portal que
  recibe el cliente (`lib/studio/portal/access-link.ts:96`) saldría como
  `/entrar/<código>` en vez de una URL completa. Un error que hoy se ve se volvería
  invisible.
- **Corregir las 46** haría que una variable olvidada cayera a los respaldos, y 7
  de ellos son `http://localhost:3000`: invitaciones, recuperación de acceso y
  avisos del Studio
  (`app/studio/(app)/usuarios/_components/InvitationsTable.tsx:24`,
  `app/studio/(app)/usuarios/actions.ts:50`,
  `app/studio/(auth)/login/recuperar/actions.ts:30`,
  `lib/studio/bitacora/notify.ts:23`, `lib/studio/bug-email-notify.ts:63`,
  `lib/studio/identity/notify-mismatch.ts:24`,
  `lib/studio/notify/bug-notif-outbox.ts:37`). Una imagen de producción mandaría
  correos con enlaces a `localhost`. Cambiar esos respaldos está fuera de esta tarea.
- El runbook del servidor ya exige la variable (§3.1, punto 3) y está creada en el
  repositorio desde el 2026-10-13.

Si se quiere robustecer, la propuesta (no decidida) es un módulo único para la URL
del sitio que falle en el build con un mensaje claro cuando la variable esté vacía,
en vez de caer a un respaldo. Es una decisión de Sam y el Director, no de esta
tarea.

### Fuera del patrón literal

Hay lecturas que no usan `??`: `process.env.NEXT_PUBLIC_SITE_URL?.replace(…) ||`
en `app/noticias/[slug]/_components/NewsArticleJsonLd.tsx:43`, que ya cae con `""`;
las de `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_SUPABASE_*`,
`NEXT_PUBLIC_HAILUWAY_API` y `NEXT_PUBLIC_BUG_REPLAY_ENABLED` se asignan a una
variable o se usan con `!`. No forman parte del encargo y no se auditaron una por
una.

## Aceptación

- [x] En producción, con `NEXT_PUBLIC_GA_ID=""` o con sólo espacios, el componente
  usa `G-25CD7BZH98` y renderiza el loader y el init con GA4 y `AW-561290482`.
- [x] Sin definir, en producción, sigue usando el respaldo.
- [x] Con un valor real, usa ese valor (recortado).
- [x] En desarrollo, con `""`, sigue apagado; con un valor real, carga.
- [x] Control rojo contra main y mutantes muertos.
- [x] Inventario del patrón con la razón de cada caso no corregido.

## Allowlist

- `components/Analytics.tsx` — la expresión de `GA_ID` y su comentario.
- `components/Analytics.respaldo-ga.test.tsx` — prueba nueva.
- `docs/marketing/README.md` — una línea en Analítica.
- `docs/specs/0518-ga-respaldo-cadena-vacia/spec.md` y `docs/specs/README.md`
  (índice regenerado).
- `.agents/handoffs/0518-ga-respaldo-cadena-vacia.md`.

## Evidencia

- **Control rojo** (prueba nueva contra `components/Analytics.tsx` de `d28fa515`):
  3 fallan y 4 pasan. Vacía: «expected [] to have a length of 2 but got +0»; con
  espacios, el loader sale con `id= \t `.
- **Mutantes** (5, todos sobre la línea del diff, control verde 7/7 antes y
  después): vuelta a `??` (3 fallan), `||` sin `trim` (2), `trim` sólo para decidir
  con el valor crudo (1), ignorar la variable (3) y respaldo también fuera de
  producción (1). Los cinco mueren.
- **Bundle**: tabla de la sección «Next sigue inlineando la expresión».

## Riesgos

- Un build local de producción (`pnpm build` y `pnpm start`) con un `.env.local`
  copiado de `.env.example` (que trae `NEXT_PUBLIC_GA_ID=` vacía) ahora carga GA con
  el ID real, igual que ya pasaba sin la línea. Las e2e no se ven afectadas: corren
  con `next dev` (`playwright.config.ts:150`), donde GA sigue apagado.
- La variable de repositorio `NEXT_PUBLIC_GA_ID` deja de ser necesaria para que la
  imagen traiga GA. Mantenerla no hace daño; quitarla no es parte de esta tarea.

## Cierre (2026-10-15)

- **Merge:** PR #216, merge `103cfdaf` a las 22:51:38Z del 2026-10-14, con `--match-head-commit a1a60510` y el OK de Sam («ok, fusiona la #215, #216 y #217»).
- Deploy de las tres PR (#215, #216 y #217): «Deployment has completed», el último a las 23:07Z del 2026-10-14. La imagen Docker de main se construye en cada merge (workflow «Imagen Docker»; la última, de `1b19ba5c`, salió en success).
- **Comprobado por el Director en el servidor propio** (2026-10-15, alrededor de las 03:55Z, HTML y JS públicos):
  - `G-25CD7BZH98` está en un chunk JS de `nuevo.dtdcargo.com` (`1812jytps5u6r.js`), igual que en `dtdcargo.com` (`0bmkfo8qcfl67.js`); en ninguno de los dos está en el HTML inicial, porque `NEXT_PUBLIC_*` se inlinea en el cliente;
  - GA ya no queda apagado en la imagen Docker.
  - *No verificado:* si en ese build el ID salió del respaldo o de la variable de repositorio `NEXT_PUBLIC_GA_ID`, que creó la sesión de Contabo. Desde afuera no se distingue.
- Los criterios ya estaban marcados con evidencia de pruebas. Estado de la tarea: **integrada**.
