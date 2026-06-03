---
sdd: "0050"
title: "Torre de control en /studio/debug — Estado + Bugs + Norte + Radar unificados (vivo/snapshot/local)"
status: in-progress
author: "DTD Cargo"
created: 2026-06-03
updated: 2026-06-03
supersedes: null
superseded_by: null
related: ["0036"]
confidencialidad: interno
---

# DTD-0050 — Torre de control en `/studio/debug`

> Un solo módulo en `/studio/debug` con pestañas que junta las herramientas hoy dispersas:
> **Estado** (deploys/prod/integraciones, ya existe), **Bugs**, **Norte** (progreso del proyecto) y
> **Radar** (auditoría del workspace). Regla de oro: **cada pestaña declara su modo** —
> *vivo* / *snapshot de build* / *solo local* — para no mentir sobre qué funciona en la web.

---

## 1. Resumen en una línea

`/studio/debug` pasa de página lineal a **torre de control con pestañas** (`?tab=`), reusando el server component actual. Dos pestañas son **vivas en web** (Estado, Bugs), una es **snapshot horneado en build** (Norte) y una es **artefacto generado en local** (Radar). El requisito no-negociable: **banners de limitación explícitos** en Norte y Radar cuando se ven en la web.

## 2. Contexto / por qué

Hoy hay 4 herramientas separadas: `/studio/debug` (web), el Norte visual (`scripts/norte.mjs` → `_norte.html`, solo local en :3010), el Radar (skill de Claude Code, solo chat/local) y el Bug Reporter (SDD-0036). El founder quiere verlas **juntas en un solo lugar, accesible en local y en la web**.

**Corte técnico que define el diseño** (verificado contra el código):
- **Estado + Bugs** → corren en Vercel (consultan DB / APIs / health). Vivos.
- **Norte** → `norte.mjs` lee el filesystem del repo (specs, código, `schema-reconciliation.md`). En la web no corre vivo, pero **sí se puede hornear en el build** y servir como HTML estático (precedente real: `public/marca/Brand Book DTD v3.2.html` con CSP propia en `next.config.ts`).
- **Radar** → es una skill de Claude Code: necesita el runtime de Claude **y** el filesystem. **No puede correr en la web de ninguna forma razonable.** En la web solo se muestra su último informe guardado.

## 3. Alcance

### Pestañas (un solo `/studio/debug`)
| Pestaña | Modo | Qué muestra |
|---|---|---|
| **Estado** | 🟢 vivo | Lo de hoy: entorno, deploy actual, deploys recientes, status de producción, 8 integraciones health, env vars. **Sin cambios de contenido.** |
| **Bugs** | 🟢 vivo | Lista de bugs del Studio (reusa queries de SDD-0036), con su estado. Read-only embebida + link al módulo completo. |
| **Norte** | 🟡 snapshot | `<iframe>` al `_norte.html` horneado en el build. **Banner obligatorio:** "Snapshot del último deploy · la versión viva/interactiva del Norte es **local** (`node scripts/norte.mjs` → :3010)." |
| **Radar** | ⚪ solo local | Último informe del Radar (si existe artefacto). **Banner obligatorio en web:** "El Radar **no es funcional en la web** — corre solo en local con `/radar` en Claude Code; los informes **no aparecen ni se actualizan acá**." |

### Regla transversal (requisito founder)
**Cada pestaña indica su modo y sus limitaciones.** Detección de entorno con `lib/studio/env-status.ts` (ya distingue local/preview/prod):
- En **local**: Norte muestra "vivo en :3010"; Radar puede ofrecer "corré `/radar`".
- En **web** (preview/prod): Norte = banner de snapshot; Radar = banner de "no funcional acá / generado en local".

## 4. No-goals (explícito)
- **NO** intentar correr el Radar en la web (endpoint que ejecute la auditoría) — sería circular y frágil. El Radar es local-first por diseño.
- **NO** generar el Norte en vivo en runtime web — solo snapshot por build.
- **NO** tocar la lógica/contenido de las cards de Estado existentes (solo moverlas a su pestaña).
- **NO** reescribir el Bug Reporter — solo embeber/enlazar.

## 5. Diseño

Sin mockup de Cloud Design (herramienta interna). Sigue el sistema del Studio (`app/studio/tokens.css`, primitivas de `_components/ui/`) y el estilo actual de `/studio/debug`. El `_norte.html` mantiene su propio diseño (se embebe tal cual). Pasa por el agente `ui-ux-designer` antes del commit (proceso founder).

**Componentes:**
- `app/studio/(app)/debug/page.tsx` (server) — fetchea en paralelo lo de cada pestaña; pasa todo a un client `DebugTabs`.
- `app/studio/(app)/debug/_components/DebugTabs.tsx` (client) — switch de pestañas vía `?tab=` (default `estado`); badge de modo por pestaña.
- Tab components: `EstadoTab` (extrae las cards actuales), `BugsTab`, `NorteTab` (iframe + banner), `RadarTab` (artefacto + banner).
- **Norte bake:** hook `postbuild` en `package.json` → `node scripts/norte.mjs && cp docs/design/studio/_norte/_norte.html public/norte.html`. CSP para `/norte.html` en `next.config.ts` (clonar el patrón de `/marca/*`: `style-src/script-src 'unsafe-inline'` + Google Fonts + `frame-ancestors 'self'`).
- **Radar artefacto:** `public/api/radar-report.json` (JSON versionado en git; sin migración). Estructura: `{ generatedAt, norteVersion, partA, partB }`. El skill `/radar` (`.claude/commands/radar.md`) se extiende para escribir ese JSON además del informe en chat. Si el archivo no existe → la pestaña Radar muestra solo el banner de limitación + cómo generarlo.

## 6. Slices (orden para el harness)
- **Slice A — Shell de pestañas + Estado + Bugs (vivos).** ✅ **shipped 2026-06-03** (harness, APPROVED 1 ronda). Refactor de `/studio/debug` a tabbed (`?tab=`, default `estado`), cards movidas a `EstadoTab` (las 7, sin cambiar contenido), `BugsTab` read-only reusa `listBugsForAdmin` (RLS, cero SQL nuevo), `DebugTabs` con badges de modo tokenizados + placeholders Norte/Radar. 21 tests nuevos.
- **Slice B — Norte snapshot.** ✅ **shipped 2026-06-03** (harness). `postbuild` en `package.json` = `node scripts/norte.mjs` (la copia a `public/norte.html` la hace el propio script con `fs.writeFileSync` — portable Windows↔Linux, sin `cp`). CSP `/norte.html` en `next.config.ts` (clon del header del Brand Book + `frame-ancestors 'self'` + noindex; el catch-all lo excluye con negative lookahead). `NorteTab` = `<iframe src="/norte.html">` (height `calc(100vh − 240px)`) + **banner de limitación mode-aware** (recibe `EnvName` desde el server vía `getEnvStatus`): web/preview/prod = ámbar "Snapshot del último deploy · links 'Abrir ↗' no funcionan (solo local)"; local = verde "Snapshot local · regenerá con `node scripts/norte.mjs`". Wireado en `DebugTabs` (el banner genérico de la pestaña Norte se omite porque `NorteTab` trae el suyo). 7 tests nuevos (`NorteTab.test.tsx` + smoke `scripts/__tests__/norte-bake.test.mjs`).
- **Slice C — Radar artefacto.** Definir `public/api/radar-report.json`, extender `/radar` para escribirlo, `RadarTab` (lee artefacto + banner "no funcional en web").

Cada slice pasa por `node scripts/verify.mjs` + reviewer del harness.

## 7. Verificación
1. `node scripts/verify.mjs` verde antes y después de cada slice.
2. **Local:** `/studio/debug` → las 4 pestañas; Estado y Bugs con datos vivos; Norte con iframe del `_norte.html` + banner "vivo en :3010"; Radar con último informe (o banner de cómo generarlo).
3. **Web (prod):** `npm run build` corre el `postbuild` (verificar en logs de Vercel que generó `public/norte.html`); en `dtdcargo.com/studio/debug` → Norte muestra snapshot + **banner de snapshot**; Radar muestra **banner "no funcional en la web"** (los informes no aparecen/actualizan ahí).
4. Edge: sin `radar-report.json` → la pestaña Radar no rompe (banner + instrucciones).

## 8. Adjuntos
N/A (sin diagramas/payloads; el diseño es el sistema del Studio existente).
