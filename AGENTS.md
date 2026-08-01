# AGENTS.md — DTD Cargo

Guía para agentes de IA (Claude Code, etc.) que trabajan en este repositorio.

> **Carga:** Claude Code lee `CLAUDE.md`, que importa este archivo vía `@AGENTS.md`. **Este es el archivo fuente — editá acá, no en CLAUDE.md.**
> **Antes de tocar visuales** → leé [`BRAND.md`](BRAND.md). **Diseño / handoffs / mockups** → [`docs/design/README.md`](docs/design/README.md). **Arquitectura** → [`docs/architecture/`](docs/architecture/).

## Las 4 superficies del repo (leer primero)

Un solo Next.js app con **4 superficies** y una **frontera dura** entre el sitio público y el ERP:

| Superficie | Rutas | Backend | Frontera |
|---|---|---|---|
| **Sitio público** | `app/{cotizar,track,contacto,calculadora,servicios,noticias,glosario}` + `components/` (raíz) | HTTP al ERP HailuWay externo (`NEXT_PUBLIC_HAILUWAY_API`; hoy mocks) | ❌ NUNCA importa `@/lib/studio`, `@/lib/db`, `@supabase/*` |
| **Studio ERP** ("DTD Cargo") | `app/studio/(app)/<modulo>/` (55 módulos) + `app/api/studio/` | Supabase propio (`@/lib/db/server`) + Server Actions | — |
| **Móvil PWA** | `app/m/{cn,ve,erp}/` | Supabase (reusa `lib/studio`, permitido) | — |
| **Back (CMS público)** | `app/back/(app)/` | Supabase (`lib/back/`) | no importa `@/lib/studio` ni `app/studio` |

`app/invitar/` es onboarding del Studio (usa DB por diseño, **no** es ruta pública).

## Aislamiento crítico (sitio público ↔ ERP)

El sitio público vive **completamente afuera** del ERP. **Cero imports, cero refs cruzadas.** Única vía: **HTTP** a `{NEXT_PUBLIC_HAILUWAY_API}/api/public/*`. La frontera está **forzada por ESLint** (`eslint.config.mjs`, `no-restricted-imports`) **como error**. Único puente público↔ERP: **`lib/shared/`**.

Si ves un import de `@/lib/studio` / `@/lib/db` / `@supabase/*` desde `app/` fuera de studio → **es un bug, removelo.** El Studio sí usa `@supabase/*` (es su backend propio).

## SDD propio (spec-driven)

Specs en `docs/specs/NNNN-slug/spec.md`, correlativo propio desde 0001 (no comparte con HailuWay). Front-matter ISO 9001 §7.5: `sdd · title · status · author · created · updated · supersedes · superseded_by · related · confidencialidad`. Estados: `draft | proposed | approved | in-progress | done | superseded`. Validación: `pnpm docs:check` (`scripts/build-docs-index.mjs`); índice generado en `docs/specs/README.md` (no editar a mano). Mapa módulo↔spec: `docs/architecture/module-sdd-map.md`.

**Commits:** `feat(studio): SDD-NNNN — título` (Studio) · `feat(DTD-NNNN): …` (público).

### Numerar sin chocar (regla del founder · 2026-07-29)

Con 15-20 worktrees en paralelo, **mirar el disco local para tomar "el siguiente número" es un bug**. El 29-jul hubo **cuatro colisiones en un día** — y una fue *después* de haber chequeado `origin/main`, porque entre numerar y pushear pasaron horas.

1. **Pedí el número, no lo adivines:** `pnpm sdd:next` (hace `fetch` y mira **todas** las refs, locales y remotas — no sólo tu rama).
2. **Reservalo si el trabajo va a durar:** `pnpm sdd:next --reserve <slug>` prepara un commit sobre `origin/main` con un `spec.md` stub y te imprime el `git push`. **No pushea solo.** La reserva **no es un commit vacío**: un commit sin archivos no reserva nada, porque el escaneo mira carpetas, no mensajes.
3. **El gate te cubre igual:** el paso `numbering` de `verify.mjs` falla si hay dos specs o dos migraciones con el mismo número, o si el `sdd:` del front-matter no coincide con su carpeta (el residuo típico de una renumeración a medias). Salta al **mergear**, que es cuando todavía podés renumerar.

**Al renumerar: la que se mueve es la que NO está en `main`.** Y ⚠️ **una migración ya aplicada NUNCA se renumera** — su cabecera debe seguir diciendo el número con el que corrió (ver `docs/runbooks/aplicar-migraciones-prod.md`).

## Ventanas autónomas + Modo Forja

**Ventanas autónomas (default).** No hay coordinador central. Cada ventana/sesión es **su propia coordinadora**: trabaja en su `git worktree` + rama, hace commits **atómicos y selectivos** (nunca `git add -A`), integra y publica **su propio** trabajo (`git push origin HEAD:main`) y limpia su worktree al cerrar. El "OK del founder" para publicar es que el usuario diga **"cerrar"** (ciclo completo en el skill `/avivar`: contexto → tarea → worktree → ¿avanzar/cerrar? → cierre autónomo). Los pushes no se cruzan porque cada rama lleva solo su trabajo; un choque *non-fast-forward* al pushear se resuelve con `git merge origin/main` y reintento. Runbooks obligatorios: `docs/runbooks/git-worktrees-multiventana.md` · `docs/runbooks/multi-ventanas-buena-practica.md`.

**Modo Forja** (competitivo, vía `/build` → Forja): N agentes implementan la MISMA spec en worktrees aislados y al final el founder compara y cherry-pickea lo mejor. Solo para tareas grandes y bien delimitadas — no para hotfixes urgentes, cambios de una línea ni migrations críticas. En Forja, los agentes secundarios:
- trabajan solo en su `git worktree` + rama; nunca directo en `main`; nunca hacen push;
- nunca aplican migrations a producción; las escriben como archivos en su rama cuando aplique;
- hacen commits atómicos y selectivos, nunca `git add -A`;
- reportan rama, worktree, commits, archivos tocados y pendientes;
- dejan `RESUMEN.md` cuando operen en Modo Forja; `PROBLEMAS.md` si se bloquean.

## Stack

- **Next.js 16** App Router · **React 19** · **TypeScript** strict · **Tailwind v4** · **pnpm**
- Backend Studio: **Supabase** (Postgres). Tests: **Vitest** (unit) + **Playwright** (e2e).
- Fuentes de marca (vía `next/font/google` en `app/layout.tsx`): **Archivo** (UI) · **Archivo Black** (display) · **JetBrains Mono** (código) · **Noto Sans SC** (CJK).

## Comandos

```bash
pnpm dev                 # Next.js dev (http://localhost:3000)
pnpm build / pnpm start  # producción
pnpm typecheck           # tsc --noEmit
pnpm lint                # ESLint (incluye la frontera público↔ERP)
pnpm test / test:watch   # Vitest
pnpm test:e2e            # Playwright
pnpm seed                # datos demo del Studio (tsx scripts/seed.ts)
pnpm docs:index / docs:check   # índice + validación de specs SDD
```
Test puntual: `pnpm test path/to/file.test.ts` o `pnpm test -t "nombre"`. E2e puntual: `pnpm test:e2e path/to/spec.ts` o `pnpm test:e2e -g "nombre"` (modo interactivo: `pnpm test:e2e:ui`).

## Mapa del repo (graphify) — exploración para agentes

`graphify-out/graph.json` = grafo de conocimiento del repo (AST: god nodes, comunidades por dominio, edges de llamadas/imports). Sirve para "¿qué llama a X?", "¿qué se rompe si toco Y?", trazar flujos — sin re-escanear todo.

- **Consultar:** `/graphify query "<pregunta>"` · `/graphify path "A" "B"` · `/graphify explain "X"` (basta con que exista `graph.json`).
- **MCP** (server `graphify` en `.mcp.json`, local y gitignored): expone tools `query_graph`/`get_node`/`get_neighbors`/`god_nodes`/`shortest_path`. Requiere el extra `graphifyy[mcp]` instalado.
- **Refrescar:** `/graphify update` re-extrae solo los archivos cambiados (AST, sin LLM, gratis). ⚠️ **El server MCP lee el grafo al arrancar → después de un `update`, reiniciar Claude Code para que sirva la versión nueva (regla: update → reiniciar).**
- **Windows:** leer `graphify-out/.graphify_root` y `.graphify_python` con `utf-8-sig` (PowerShell les mete BOM y rompe el walk); los scripts que llaman `extract()` necesitan guard `if __name__ == '__main__':`.

## Variables de entorno (ver `.env.example`)

`NEXT_PUBLIC_HAILUWAY_API` (base URL del ERP, HTTP) · `DTD_API_KEY` · `NEXT_PUBLIC_WHATSAPP_NUMBER` · `NEXT_PUBLIC_CONTACT_EMAIL` · `NEXT_PUBLIC_SITE_URL` (default `https://dtdcargo.com`).

## Supabase MCP y credenciales de agentes

- **Acceso interactivo:** usa el MCP hospedado de Supabase con **OAuth**, `project_ref=xpfuzqombmjmxvprjgmi`, `read_only=true` y `features=database,docs`.
- **Nunca guardes un PAT de Supabase** (`sbp_*` / `SUPABASE_ACCESS_TOKEN`) dentro del árbol del proyecto, aunque el archivo esté gitignored (`.env.local`, `.mcp.json`, `.codex/`, worktrees o archivos temporales).
- **Producción:** este `project_ref` corresponde al proyecto real. El uso normal del MCP se limita a documentación y metadatos; leer filas de negocio o PII requiere autorización explícita del founder.
- **Escrituras:** el MCP habitual no autoriza escrituras. Prepara migrations como archivos, valida localmente y usa una conexión temporal separada solo cuando el founder autorice aplicar el cambio concreto. **Aplicar a prod → runbook obligatorio: [`docs/runbooks/aplicar-migraciones-prod.md`](docs/runbooks/aplicar-migraciones-prod.md)** (OK del founder NOMBRANDO la migración · de a UNA, nunca en bundle · `name` = basename exacto del archivo). El gate lo vigila: el paso `migrations-applied` de `verify.mjs` grita si un archivo del repo no está en prod — así se dejaron de perder migraciones (la 0228 estuvo 2 rondas perdida; la 0169 sigue).
- **CI/automatización:** si una tarea no admite OAuth, guarda el PAT únicamente en el secret manager del proveedor, con expiración y propósito identificable; nunca en archivos locales del repo.

## Integraciones del sitio público (estado · actualizado 2026-07-05)

Los mocks originales **ya no existen** (`mockSubmit` desapareció del código). La captación es real:

| Endpoint | Estado | Usado por |
|---|---|---|
| RPC pública `public_track_shipment` (consulta server-side) | ✅ real | `/track/[code]` |
| `POST /api/public/estimacion` | ✅ real — crea `EST-XXXX` en el ERP | `/estimacion` y `/calculadora` (EstimadoModal) |
| `POST /api/contact` | ✅ real — Resend equipo + cliente, honeypot + throttle IP | `/contacto` |
| Server Action de registro + `POST /api/registro/check` | ✅ real — alta cliente + MARKBOX | `/registro` |

`/cotizar` fue renombrada a `/estimacion` (301 en `next.config.ts`, SDD-0061).

## Convenciones

- **Componentes con estado** → `"use client"` en la 1ª línea. Resto → server components por default.
- **Path alias** → `@/*` = raíz del proyecto.
- **Estilos** → utilidades Tailwind + clases brand de `globals.css`. Inline solo para CSS vars (`var(--color-wine)`).
- **Imágenes** → `<Image>` de `next/image`. Assets de marca en `public/brand/`.

## Patrones del Studio ERP (`app/studio/`)

- **Server Actions** (`app/studio/(app)/<módulo>/actions.ts`): `"use server"` + `useActionState` + parsing manual de `FormData` + `validate*Input()` propio (**no Zod**) + `revalidatePath()`.
- **Queries**: `lib/studio/<entidad>-queries.ts` (funciones puras que reciben `SupabaseClient`).
- **Types**: `lib/studio/<entidad>-types.ts` (enums, validators, helpers de label/badge tone).
- **Drawer**: `app/studio/_components/ui/drawer/DrawerShell.tsx` — `<form id="X">` en el cuerpo + `<button type="submit" form="X">` en el footer (HTML5; **no** `requestSubmit()` hack).
- **UI primitivas**: `app/studio/_components/ui/` (Avatar, Badge, EmptyState, KpiCard) + `_components/icons.tsx`.
- **Tokens**: solo `var(--*)` desde `app/studio/tokens.css`. Sobre fondo navy usar `--ink-inv-soft` / `--ink-inv-mute`, nunca `rgba(255,255,255,X)` inline.
- **MARKBOX** = ID de cliente (`DTD-NNNN`), autogenerado por `rpc('next_markbox')`. Nombre VISIBLE al usuario: **"Shipping Mark"** (SDD-0065, display-only); `markbox` sigue siendo el identificador interno (columnas, RPCs, props).
- **Dónde va el código nuevo**: dominio con ≥3 archivos → carpeta `lib/studio/<feature>/`; 1-2 → par plano `<entidad>-{queries,types}.ts`. Transversal (push/mail/telegram/agents) → `lib/studio/<feature>/`. Compartido público↔ERP → `lib/shared/`. Util genérico sin dominio → `lib/`. API (webhook/cron/externo) → `app/api/.../route.ts` fino (sin lógica de negocio).

## Proceso UI/UX

Toda pantalla nueva o cambio visual sustancial **pasa por `/ui-check`** antes del commit (regla del founder; check liviano, no bloqueo — spacing, jerarquía, AI slop, hover states). Para auditoría **profunda** (10 dimensiones, contraste WCAG medido, score 0–10) usar **`/ui-pro`**. Lente de "design director" opcional: agente `design-critic`. *(El agente `ui-ux-designer` de la plantilla Forge NO existe — no lo invoques.)*

## Brand y diseño → punteros (no duplicar acá)

- **Reglas de marca** → [`BRAND.md`](BRAND.md). **Leé siempre antes de tocar visuales.** Las 6 que no se rompen: (1) solo tokens CSS `var(--*)`, cero hex inventados · (2) solo Archivo + JetBrains Mono + Noto Sans SC · (3) cero AI slop (gradientes coloridos, glassmorphism, emojis decorativos) · (4) componentes del sistema primero · (5) avisar con formato `BRAND-CHECK` antes de violar · (6) todo texto se lee: contraste AA ≥4.5:1 / grande ≥3:1.
- **Materiales visuales / handoffs / mockups / assets** → [`docs/design/README.md`](docs/design/README.md) (índice maestro). Lo vigente vive en `docs/design/studio/_norte/` (NORTE-SYNC); material nuevo fuera del Norte va a `docs/design/<producto>/<vM.m.p-origen>/`.
- **Logo / Brand Book** → el book vigente es **UNO solo**: el de mayor versión en `docs/design/studio/_norte/` (cuál es la vigente vive al tope de `_norte/HANDOFF.md` — no se hardcodea acá para no desfasarse); publicado privado en `/marca/brand-book`, hub interno `/interno/marca`. Al llegar un book nuevo desde el Norte: reemplazar y **borrar el anterior** (en `_norte/` y en `private/marca/`). Único punto de entrada del logo: el componente `<BrandMark variant={…} />` en [`components/BrandMark.tsx`](components/BrandMark.tsx); 4 variantes PNG en `public/brand/dtdcargo-isologo-{primary|reverse|mono-light|mono-dark}.png`.
- **Protocolo UI handoff-first** → el **norte vigente** (diseño de Cloud Design, actualizado vía NORTE-SYNC; **la versión vigente vive al tope de `_norte/HANDOFF.md` en `## 🟢 Estado actual · vX.Y` — no se hardcodea acá para no desfasarse; corré `/radar` para detectar drift de versión**) vive en `docs/design/studio/_norte/`. Al iniciar sesión visual, leer ahí **en orden**: `CLAUDE.md` (marca), `HANDOFF.md` (ESTADO ACTUAL al tope), `CHANGELOG.md` (bitácora). **Backend del Studio** → leer `backend/README.md` (modelo multi-tenant + auth + endpoints). **Ver el norte navegable:** `node scripts/norte.mjs` → `npx serve docs/design/studio/_norte -l 3010` → http://localhost:3010/_norte. Aplica a módulos nuevos, redesigns, ajustes visuales no triviales. Si no hay diseño aprobado → avisar antes de inventar (`DESIGN-CHECK`). *(Las carpetas de diseño pre-Norte se **eliminaron** del working tree el 2026-06-10 — la historia vive en git. El único material de diseño vigente es `_norte/`.)*

## Marketing / SEO / Ads → tree único `docs/marketing/`

**Regla del founder (2026-06-07):** TODO lo externo para captar clientes — **SEO, publicidad (Google Ads), analítica (GA4/GTM), CRM, contenido, captación de leads, marca→web** — vive en **[`docs/marketing/`](docs/marketing/README.md)**. Siempre que trabajes un tema de marketing, **leé y actualizá ese tree** (no lo disperses en memoria suelta ni en specs). Entrada = `docs/marketing/README.md` (índice + estado + reglas); bitácora SEO = `docs/marketing/seo.md`. Lo que ya existe en otras carpetas (brand-books en `docs/design/`, `docs/pendientes-seo-ads-*.md`, memoria) **NO se mueve — se indexa** desde ese README. **Reglas SEO que no se rompen:** nunca quitar el 301 `doortudoor.com → dtdcargo.com` · no dejar expirar el dominio viejo · GA fuera de rutas privadas (PII).

## Identidad pública, founder y trato

- **Identidad / nombres / NAP** → fuente única [`docs/marketing/identidad.md`](docs/marketing/identidad.md). Marca pública = **DTD Cargo** · sello de herencia + nombre del ERP interno = **DoorTuDoor** · handle **@doortudoor_**. La **razón social (INVERSIONES DTD SERVICES, C.A) y el RIF (J-50648869-8) van SOLO en el schema** (`legalName`/`taxID`), **nunca en texto visible**. Versión-máquina = `@graph` en [`app/layout.tsx`](app/layout.tsx) (`#organization` + `#website`); datos desde `CONTACT` en `lib/design-tokens.ts`.
- **Estrategia / misión-visión / valores / ventas** → [`docs/marketing/estrategia.md`](docs/marketing/estrategia.md) + [`docs/marketing/ventas.md`](docs/marketing/ventas.md). Misión/visión/valores son **canónicos** (reemplazan los de 2020). Norte **interno** = **2 contenedores/mes** (umbral de equilibrio, **no se publica**) vía mayoristas recurrentes + aliados white-label.
- **Negocio:** logística + trading puerta a puerta China↔Venezuela; equipo propio en Yiwu y Valencia. **Cronología (founder 2026-07-17):** **2008-2010** = inicios en China — etapa histórica que sustenta la **experiencia** con China, **NO es la fundación** (vive en Stats: "En el comercio con China desde 2008", KPI autocalculado) · **2015** = **fundación e inauguración en Venezuela = EL año de fundación** (`foundingDate` del schema, y todo copy de "opera/operando desde") · **2010** = solo hito histórico (se formalizó la empresa de carga), nunca un claim de "empresa desde". El trading propio es **interno** (la web vende el servicio). El ERP (Studio "DoorTuDoor", 55 módulos en prod) apunta a **cerrar el loop comercial** (recompra día 30/45 + alertas de cadencia + KPI 2 cont./mes + white-label aliados); **no es greenfield**.
- **Trato con el founder (Sam):** español **venezolano neutro, TUTEO, CERO voseo** (regla dura, no negociable). Usar **"tú tienes / puedes / quieres / necesitas / mira"**; **NUNCA** "vos tenés / podés / querés / necesitás / mirá" ni imperativos voseo ("cotizá", "pagás", "escribinos", "dale"). El voseo es argentino, **no se habla en Venezuela** — si lo uso es un bug. Además: directo, sin relleno ni adulación; salidas listas para copiar con rutas explícitas; opciones por prioridad con **⭐ en la #1**; preguntas cortas; decir "Fase 5", no "F5". **Verificar la rama antes de commit; NO hacer push sin su OK; commits selectivos si hay varias ventanas.**

## Organización · ISO 9001 §7.5 → detalle en `docs/README.md`

- **Índice maestro de docs** ("dónde va cada cosa"): [`docs/README.md`](docs/README.md).
- **Adjuntos (2 planos):** documentación (diagrama de spec, captura de runbook) → `docs/.../assets/` (en git si <1 MB). Runtime (foto de operario, recibo, upload de cliente) → **Supabase Storage** (`{tenant_id}/{entidad}/{id}/archivo`, signed URL). **Nunca en git.**
- **Nombres:** carpetas de código NO se renombran (Next.js las exige). Docs técnicas en inglés (`specs`, `runbooks`, `architecture`); negocio en español (`legal`, `operaciones`). Archivos de assets: kebab-case, sin acentos, fechas ISO-8601.
- **Nunca en git:** secretos (`.env*`), PII de clientes (solo Supabase + RLS), financieros/contratos crudos (→ Drive + puntero en `docs/legal/`).
