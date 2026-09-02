# AGENTS.md — DTD Cargo

Guía para agentes de IA (Claude Code, etc.) que trabajan en este repositorio.

> **Carga:** Claude Code lee `CLAUDE.md`, que importa este archivo vía `@AGENTS.md`. **Este es el archivo fuente — edita acá, no en CLAUDE.md.**
> **Antes de tocar visuales** → lee [`BRAND.md`](BRAND.md). **Diseño / handoffs / mockups** → [`docs/design/README.md`](docs/design/README.md). **Arquitectura** → [`docs/architecture/`](docs/architecture/).

## Arranque mínimo para Codex

El proyecto está activo y no es un scaffold. Empieza por [`README.md`](README.md)
y este archivo; el estado medido vive en [`docs/audits/`](docs/audits/) y la
continuidad por tarea en [`.agents/handoffs/`](.agents/handoffs/).

```bash
pnpm install --frozen-lockfile
pnpm dev
node scripts/verify.mjs
```

`verify.mjs` es el cierre canónico. Un paso marcado `SKIP` significa que faltó
entorno y no equivale a una validación completa. Commit, push, Cloud,
Producción, Vercel y limpieza siguen siendo gates independientes.

## Las 4 superficies del repo (leer primero)

Un solo Next.js app con **4 superficies** y una **frontera dura** entre el sitio público y el ERP:

| Superficie | Rutas | Backend | Frontera |
|---|---|---|---|
| **Sitio público** | `app/{tarifas,fcl,shipping-mark,pre-alertas,contacto,calculadora-terrestre,servicios,academia,noticias,glosario,importar-de-china,brochure,nosotros,faq,enlaces}` + `components/` (raíz) | HTTP al ERP HailuWay externo (`NEXT_PUBLIC_HAILUWAY_API`; hoy mocks) | ❌ NUNCA importa `@/lib/studio`, `@/lib/db`, `@supabase/*` |
| **Studio ERP** ("DTD Cargo") | `app/studio/(app)/<modulo>/` (56 módulos en `lib/studio/modules.ts`) + `app/api/studio/` | Supabase propio (`@/lib/db/server`) + Server Actions | — |
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

1. **Pide el número, no lo adivines:** `pnpm sdd:next` (hace `fetch` y mira **todas** las refs, locales y remotas — no sólo tu rama).
2. **Resérvalo si el trabajo va a durar:** `pnpm sdd:next --reserve <slug>` prepara un commit sobre `origin/main` con un `spec.md` stub y te imprime el `git push`. **No pushea solo.** La reserva **no es un commit vacío**: un commit sin archivos no reserva nada, porque el escaneo mira carpetas, no mensajes.
3. **El gate te cubre igual:** el paso `numbering` de `verify.mjs` falla si hay dos specs o dos migraciones con el mismo número, o si el `sdd:` del front-matter no coincide con su carpeta (el residuo típico de una renumeración a medias). Salta al **mergear**, que es cuando todavía puedes renumerar.

**Al renumerar: la que se mueve es la que NO está en `main`.** Y ⚠️ **una migración ya aplicada NUNCA se renumera** — su cabecera debe seguir diciendo el número con el que corrió (ver `docs/runbooks/aplicar-migraciones-prod.md`).

## Gobernanza ejecutable de experiencia

Antes de cambiar comportamiento, componentes o patrones del Studio, lee
[`docs/governance/AGENT-BRIEF.md`](docs/governance/AGENT-BRIEF.md) y abre desde
allí las políticas aplicables. El registro maestro
[`docs/governance/README.md`](docs/governance/README.md) es la fuente normativa;
la cápsula generada y cualquier plugin son derivados read-only.

- Un cambio de comportamiento usa SDD y allowlist exacta.
- Clasifica evidencia como `cumplimiento`, `no aplica`, `excepción` o
  `no conformidad`.
- Usa componentes `canonical`; no agregues consumidores de un `deprecated`.
- Ejecuta `pnpm governance:check` y `pnpm components:check`; `pnpm verify` los
  incluye en el cierre canónico.
- Sólo reglas aprobadas pueden bloquear. Investigación o recomendaciones no se
  elevan automáticamente.

### ⚠️ El último commit del push decide si hay deploy

`vercel.json` trae un `ignoreCommand` que mira **sólo `HEAD^ HEAD`**, es decir,
el último commit, no el push completo. Excluye `docs/**` y los `*.md` de la
raíz, pero comprueba `docs/marketing` por separado: sus cambios no se omiten.
**No significa «todo commit documental se omite»**: el patrón
`:(exclude,glob)*.md` no excluye Markdown anidado fuera de `docs/`.
Por ejemplo, modificar `.agents/handoffs/*.md` permite el build aunque todo
el commit sea documental (comprobado el 2026-09-02).

**Consecuencia:** si empujas código y documentación juntos y el último commit
sólo toca las rutas excluidas, **el build se cancela en silencio** y el código se queda en
`main` sin publicar. Pasó el 2026-08-02 con SDD-0238: el sistema navegable de
`/marca` viajó en un commit y el último del push era una respuesta a Cloud
Design en `.md`.

**Cómo evitarlo:** que el ÚLTIMO commit del push toque código, o redesplegar a
mano desde Vercel. **Cómo detectarlo sin adivinar** — se ejecuta el mismo
comando que corre Vercel; si sale `0`, no va a desplegar:

```bash
git diff --quiet HEAD^ HEAD -- . ':(exclude)docs/**' ':(exclude,glob)*.md' \
  && git diff --quiet HEAD^ HEAD -- docs/marketing && echo "NO despliega"
```

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
- Fuentes de marca, todas por `next/font/google` — pero **NO se cargan todas en el mismo sitio**:
  - **Globales**, en `app/layout.tsx`: **Archivo** (UI) · **Archivo Black** (display) · **Noto Sans SC** y **Noto Serif SC** (CJK).
  - 🔴 **`JetBrains Mono` NO está en el layout** — vive en [`lib/fonts.ts`](lib/fonts.ts) (`jetbrainsMono` para el sitio público, `jetbrainsMonoUi` para portal/cuenta) y **cada página que la use tiene que meter su `.variable` en el árbol**, como hace `/faq`. Sin eso `--font-mono` no resuelve y el texto cae a la mono del sistema **en silencio**: se ve distinto en cada máquina y nada falla. Pasó en `/tarifas` y `/shipping-mark`, que pintaban códigos con `FONT_MONO` sin cargarla (corregido 2026-08-19). Si agregas una página que muestre códigos, cifras o direcciones en mono, cárgala ahí.

## Comandos

```bash
pnpm install --frozen-lockfile
pnpm dev                 # Next.js dev (http://localhost:3000)
pnpm build / pnpm start  # producción
pnpm typecheck           # tsc --noEmit
pnpm lint                # ESLint (incluye la frontera público↔ERP)
pnpm test / test:watch   # Vitest
pnpm test:e2e            # Playwright
pnpm seed                # datos demo del Studio (tsx scripts/seed.ts)
pnpm docs:index / docs:check   # índice + validación de specs SDD
pnpm verify              # gate canónico: lint, tipos, tests, SQL, e2e y build
node scripts/run-sql-tests.mjs # contratos SQL (RLS/GRANT/triggers) en Postgres desechable
node scripts/check-schema-rebuild.mjs  # ¿el schema se reconstruye desde cero? (el script cuenta solo)
node scripts/check-edge-functions.mjs  # deno check sobre supabase/functions (tsc NO las mira)
node scripts/check-migrations-applied.mjs  # compara archivos con el ledger de producción (lectura)
```
Test puntual: `pnpm test path/to/file.test.ts` o `pnpm test -t "nombre"`. E2e puntual: `pnpm test:e2e path/to/spec.ts` o `pnpm test:e2e -g "nombre"` (modo interactivo: `pnpm test:e2e:ui`).

### ⚠️ Las Edge Functions viven FUERA de `tsc` — las chequea Deno

`supabase/functions` está en el `exclude` de `tsconfig.json`, así que **`pnpm typecheck` no las mira**, y Vitest sólo ejecuta los módulos puros de `_shared/` *transpilando sin chequear tipos*. Hasta el 2026-08-11 eso dejaba sin ninguna verificación estática al código que escribe a Kommo (`kommo-writeback`, LIVE) y al que **poda embudos y etapas del espejo** (`kommo-sync`). Lo cierra el paso **`edge-functions`** de `verify.mjs` (`scripts/check-edge-functions.mjs`): corre `deno check` sobre las 4 entradas `supabase/functions/*/index.ts` y, por el grafo de imports, cubre de rebote los 5 módulos de `_shared/`. Usa el `deno` del PATH si existe; si no, `npx --yes deno@2` (no instala nada permanente). **Sin poder obtener Deno → SKIP, nunca rojo**; `VERIFY_SKIP_EDGE=1` lo omite a pedido.

Si lo corres a mano, respeta las dos banderas: **`--no-lock`** (si no, deja un `deno.lock` en la raíz del repo) y **`--node-modules-dir=none`** (si no, Deno ve el `package.json`, se cree un proyecto Node y baja el árbol entero de dependencias a `node_modules/.deno` de *cada* worktree — 42 s la primera vez). Hueco conocido que **no** cubre: `_shared/__tests__/*.test.ts`, cuyos imports van sin extensión (ilegal en Deno) y no los alcanza ninguna entrada.

## Mapa del repo (graphify) — exploración para agentes

`graphify-out/graph.json` = grafo de conocimiento del repo (AST: god nodes, comunidades por dominio, edges de llamadas/imports). Sirve para "¿qué llama a X?", "¿qué se rompe si toco Y?", trazar flujos — sin re-escanear todo.

- **Consultar:** `/graphify query "<pregunta>"` · `/graphify path "A" "B"` · `/graphify explain "X"` (basta con que exista `graph.json`).
- **MCP** (server `graphify` en `.mcp.json`, local y gitignored): expone tools `query_graph`/`get_node`/`get_neighbors`/`god_nodes`/`shortest_path`. Requiere el extra `graphifyy[mcp]` instalado.
- **Refrescar:** `/graphify update` re-extrae solo los archivos cambiados (AST, sin LLM, gratis). ⚠️ **El server MCP lee el grafo al arrancar → después de un `update`, reiniciar Claude Code para que sirva la versión nueva (regla: update → reiniciar).**
- **Windows:** leer `graphify-out/.graphify_root` y `.graphify_python` con `utf-8-sig` (PowerShell les mete BOM y rompe el walk); los scripts que llaman `extract()` necesitan guard `if __name__ == '__main__':`.

## Variables de entorno

La fuente única es [`.env.example`](.env.example), con cada variable y su
propósito. No mantengas una segunda lista en este archivo: se desactualiza. Un
worktree sin `.env.local` puede omitir gates por falta de entorno; reporta esos
pasos como `SKIP`, nunca como verdes.

## Supabase MCP y credenciales de agentes

- **Acceso interactivo:** usa el MCP hospedado de Supabase con **OAuth**, `project_ref=xpfuzqombmjmxvprjgmi`, `read_only=true` y `features=database,docs`. ⚠️ **Hay DOS y no se comportan igual:** el MCP **local** sí es read-only, pero el **conector de claude.ai escribe** — medido el 2026-08-13, un `DELETE` por su `execute_sql` corrió sin rechazo ni confirmación. **No asumas cuál tienes.** El detalle y cómo sondearlo, en el runbook de migraciones.
- **Nunca guardes un PAT de Supabase** (`sbp_*` / `SUPABASE_ACCESS_TOKEN`) dentro del árbol del proyecto, aunque el archivo esté gitignored (`.env.local`, `.mcp.json`, `.codex/`, worktrees o archivos temporales).
- **Producción:** este `project_ref` corresponde al proyecto real. El uso normal del MCP se limita a documentación y metadatos; leer filas de negocio o PII requiere autorización explícita del founder.
- **Escrituras:** 🔴 **no cuentes con que la herramienta te frene — con el conector de claude.ai la regla se cumple por disciplina.** Prepara migrations como archivos, valida localmente y aplica sólo cuando el founder autorice el cambio concreto. Cualquier operación que escriba —incluido un `DELETE` de datos derivados o de caché— va con **OK del founder nombrando la tabla y las filas** antes de mandarla. **Aplicar a prod → runbook obligatorio: [`docs/runbooks/aplicar-migraciones-prod.md`](docs/runbooks/aplicar-migraciones-prod.md)** (OK del founder NOMBRANDO la migración · de a UNA, nunca en bundle · `name` = basename exacto del archivo). El gate lo vigila: el paso `migrations-applied` de `verify.mjs` grita si un archivo del repo no está en prod — así se dejaron de perder migraciones (la 0228 estuvo 2 rondas perdida y la 0169 una ronda entera; **ambas aplicadas y cerradas**). ✅ **Punto ciego cerrado (SDD-0248, 2026-08-05):** el gate ya mide **`origin/main` ∪ el checkout**, así que un árbol atrasado no vuelve a salir verde por omisión (era el caso de las 0318–0324, que estaban en `main` y en el código desplegado pero no en la DB). Si no puede consultar git —sin remoto, clone shallow, sin red— lo dice en pantalla con `[AVISO]` en vez de callarse.

✅ **Y mide en las DOS direcciones (2026-08-05).** Antes sólo comparaba *archivo del repo → ledger de prod*; una entrada del ledger **sin archivo en el repo** le era invisible, y ése es el caso peligroso: no revienta nunca, revienta el día que haya que reconstruir el schema desde cero. Así estuvieron 3 días las `0336_pod_closes_shipment`, `0337_feature_flags_seed_and_trigger` y `0338_ve_locality_catalog_read_policy` — aplicadas en prod, con sus archivos colgando de un worktree sin pushear. Ahora una huérfana **recién aplicada** sale amarilla (con 38 worktrees, pushear el archivo minutos después es lo normal) y una de **más de 24 h** sale **roja**.
- **CI/automatización:** si una tarea no admite OAuth, guarda el PAT únicamente en el secret manager del proveedor, con expiración y propósito identificable; nunca en archivos locales del repo.

## Integraciones del sitio público (estado · **medido** 2026-08-19)

⚠️ Esta tabla estuvo desactualizada y mandó a más de un agente a buscar rutas
que ya no existen. Lo de abajo se midió contra el código, no se recordó — si la
vas a cambiar, **mide igual**: `find app -name page.tsx` para las rutas, los
`redirects()` de `next.config.ts` para los 301, y un `grep` de llamadores para
saber si un endpoint está vivo o sólo existe.

🔴 **Y decir "medido" no alcanza: el 2026-08-19 esta tabla daba `/api/contact`
por huérfano y `/academia` lo llamaba en vivo.** El error fue de método —
se miró el sospechoso obvio (`/contacto`) y se concluyó de ahí, en vez de barrer
el árbol entero. **Grepea el endpoint en todo `app/`, `components/` y `lib/`, no
sólo donde esperas encontrarlo.** Y un `fetch` en un archivo **no** prueba que
esté vivo: hay que seguir la cadena hasta una página que se monte de verdad
(`EstimadoModal` la tiene cortada por una bandera, no por falta de importador).

| Endpoint | Estado | Lo llama |
|---|---|---|
| `POST /api/public/calc-event` | ✅ **vivo** — telemetría anónima (SDD-0259) | `/tarifas` (las 2 pestañas), en el CTA |
| Server Action de registro + `POST /api/registro/check` | ✅ **vivo** — alta cliente + MARKBOX | `/registro` |
| `POST /api/public/estimacion` | 🟠 **sin llamadores** — y ya **NO crea `EST-`**: sólo avisa al equipo | nadie (`EstimadoModal` sólo se monta si NO es `directWhatsApp`, y las calculadoras vivas lo son) |
| `POST /api/contact` | ✅ **vivo** — notifica al equipo + confirma al cliente + throttle | `/academia`, vía [`AcademiaLeadForm.tsx:45`](app/academia/_components/AcademiaLeadForm.tsx). ⚠️ `/contacto` **no** lo usa: manda sólo por WhatsApp — de ahí venía el error de creerlo huérfano |
| RPC `public_track_shipment` | 🟠 **sin llamadores** — `lib/public/tracking-queries.ts` está huérfano | nadie — `/track` hace 301 a `/entrar` |

### Las rutas que ya NO existen (todas son 301, no páginas)

`/cotizar` · `/estimacion` · `/calculadora` · `/calculadora/embed` →
**`/tarifas`** · `/calculadora-fcl` y `/cotizador-flete` → **`/fcl`** ·
`/markbox` → **`/shipping-mark`** · `/track`, `/track/*` y
`/portal/login` → **`/entrar`** · `/studio/{kommo,leads}` →
**`/studio/crm`**.

Las calculadoras públicas vivas son **`/tarifas`** (LCL puerta a puerta +
consolidado), **`/tarifas/embed`**, **`/fcl`** y **`/calculadora-terrestre`**.

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

## Datos personales y privacidad

Todo cambio que **capture, mueva o borre datos personales** —campo nuevo en un formulario, columna nueva, bucket, integración con un tercero, captura en campo— pasa por **`/revisar-datos-ve`** ([`.claude/skills/revisar-datos-ve/`](.claude/skills/revisar-datos-ve/)). Es **advisory**: entrega hallazgos con `archivo:línea` y **nunca** afirma que el proyecto cumple (solo `ENCONTRADO` / `CORRECTO` / `NO VERIFICABLE`).

Marco: **Venezuela no tiene ley especial de datos personales.** Las anclas son CRBV arts. 28 y 60, la jurisprudencia vinculante de la Sala Constitucional del TSJ (332/2001 y 759/2025), la Ley Especial contra los Delitos Informáticos (arts. 20-22, **penal**) y la Ley sobre Mensajes de Datos y Firmas Electrónicas. **PIPL de China** aplica al tratamiento del equipo en Yiwu. RGPD y Chile 21.719 son **referencia, no obligación**. Detalle en `references/marco-legal-ve.md` y `references/marco-legal-cn-pipl.md` — **citá desde ahí, nunca de memoria**.

Tres reglas que no se rompen: (1) **no importar derecho ajeno** — "derechos ARCO" es México, el binomio responsable/encargado es RGPD; (2) la política **no puede prometer lo que el sistema no hace**; (3) la aceptación electrónica sin certificado de un PSC acreditado por SUSCERTE es **art. 17** (sana crítica), **no** firma autógrafa — no escribir "firmado" en la UI si el respaldo es ese.

Fork MIT de [Carlos Domínguez](https://github.com/Carlos-Dominguez-faber/revisar-datos-personales), re-anclado a VE + China; qué cambió y por qué está en el `README.md` de la skill.

## Brand y diseño → punteros (no duplicar acá)

- **Reglas de marca** → [`BRAND.md`](BRAND.md). **Lee siempre antes de tocar visuales.** Las 6 que no se rompen: (1) solo tokens CSS `var(--*)`, cero hex inventados · (2) solo Archivo + JetBrains Mono + Noto Sans SC · (3) cero AI slop (gradientes coloridos, glassmorphism, emojis decorativos) · (4) componentes del sistema primero · (5) avisar con formato `BRAND-CHECK` antes de violar · (6) todo texto se lee: contraste AA ≥4.5:1 / grande ≥3:1.
- **Materiales visuales / handoffs / mockups / assets** → [`docs/design/README.md`](docs/design/README.md) (índice maestro). Lo vigente vive en `docs/design/studio/_norte/` (NORTE-SYNC); material nuevo fuera del Norte va a `docs/design/<producto>/<vM.m.p-origen>/`.
- **Logo / Brand Book** → el book vigente es **UNO solo**: el de mayor versión en `docs/design/studio/_norte/` (cuál es la vigente vive al tope de `_norte/HANDOFF.md` — no se hardcodea acá para no desfasarse). Al llegar un book nuevo desde el Norte: reemplazar, **borrar el anterior** (en `_norte/` y en `private/marca/`) y actualizar las **dos constantes de [`lib/marca/brand-book.ts`](lib/marca/brand-book.ts)** — ese es el punto único (antes había que tocar cuatro archivos que se desincronizaban). Único punto de entrada del logo: el componente `<BrandMark variant={…} />` en [`components/BrandMark.tsx`](components/BrandMark.tsx); 4 variantes PNG en `public/brand/dtdcargo-isologo-{primary|reverse|mono-light|mono-dark}.png`.
- **Centro de marca → `/marca`** (SDD-0238). **Es el link que se le manda a diseño externo**: una sola URL con código de 4-6 dígitos (3 fallos → 5 min · 3 más → 1 h). El equipo entra con su sesión del ERP, sin código. Cada sección trae su propia descarga (.zip). Se administra en **Studio › Marketing › HUB de marca**: ahí se suben los archivos (van a Supabase Storage, **no a git**) y se pone el código. `/interno/marca` es un redirect 308 a `/marca`. Arranque del catálogo: `pnpm seed:marca`.
- **⚠️ El Brand Book se publica DOS veces, y son cosas distintas.** El book es el índice de un sistema de 35 documentos que se enlazan entre sí: (1) el **standalone autocontenido** que se descarga para trabajar sin internet — se sube por el HUB y se apunta con las constantes de `lib/marca/brand-book.ts`; (2) el **sistema navegable** que se lee en pantalla, donde `<a href="Logo Oficial.html">` de verdad abre — se publica con `pnpm tsx scripts/upload-brand-proyecto.ts "<carpeta del PROYECTO COMPLETO>"`. **Si sólo se hace (1), el navegable se queda en la versión anterior sin avisar.** Se corre sobre el proyecto completo de Cloud Design, **no** sobre la carpeta `Handoff v5.0/`: esa trae 7 de los 54 documentos que el book enlaza. Qué se publica y qué no (el producto interno queda fuera) vive en `lib/marca/proyecto.ts`.
- **🛑 No republiques desde una copia vieja: hoy PRODUCCIÓN es la copia más completa que existe.** El subidor hace `upsert`, así que pisa lo publicado — y la carpeta que produjo lo que está vivo ya no existe intacta en ningún disco. Medido el 2026-08-11 por huella (la clave lleva un hash de la ruta original): `dtd-cargo/project` reproduce 231 de 319 claves, `Handoff v5.0` otras 110, y **las dos fusionadas 297 (93,1%)**; los 22 que faltan (`erp-mockups-v5/`) sólo sobreviven en el bucket. De las 297 que sí coinciden, **40 difieren en contenido**. Republicar desde `Downloads/` regresaría 40 archivos y dejaría 22 colgando. Hazlo sólo con la carpeta que llegue por NORTE-SYNC, y con `--dry-run` primero. El detalle está en la cabecera del script.
- **⚠️ El `--dry-run` de ese script NO dice si los documentos funcionan.** Sólo resuelve archivos locales: no ve los `<script src>` a CDN —eso lo decide la CSP de `/marca/doc/*` en `next.config.ts` (`CDN_DOCUMENTOS`)— ni distingue una referencia real de un string dentro de `<script>` o de un `<pre>`. El 2026-08-11 decía "0 referencias rotas" con 14 de 35 documentos rotos en producción. Para saber si funcionan, se abren en el navegador. Ver [`docs/design/studio/cloud-design-2026-08-11-isotipo-y-favicons-falsos-positivos.md`](docs/design/studio/cloud-design-2026-08-11-isotipo-y-favicons-falsos-positivos.md).
- **Protocolo UI handoff-first** → el **norte vigente** (diseño de Cloud Design, actualizado vía NORTE-SYNC; **la versión vigente vive al tope de `_norte/HANDOFF.md` en `## 🟢 Estado actual · vX.Y` — no se hardcodea acá para no desfasarse; corre `/radar` para detectar drift de versión**) vive en `docs/design/studio/_norte/`. Al iniciar sesión visual, leer ahí **en orden**: `CLAUDE.md` (marca), `HANDOFF.md` (ESTADO ACTUAL al tope), `CHANGELOG.md` (bitácora). **Backend del Studio** → leer `backend/README.md` (modelo multi-tenant + auth + endpoints). **Ver el norte navegable:** `node scripts/norte.mjs` → `npx serve docs/design/studio/_norte -l 3010` → http://localhost:3010/_norte. Aplica a módulos nuevos, redesigns, ajustes visuales no triviales. Si no hay diseño aprobado → avisar antes de inventar (`DESIGN-CHECK`). *(Las carpetas de diseño pre-Norte se **eliminaron** del working tree el 2026-06-10 — la historia vive en git. El único material de diseño vigente es `_norte/`.)*

## Marketing / SEO / Ads → tree único `docs/marketing/`

**Regla del founder (2026-06-07):** TODO lo externo para captar clientes — **SEO, publicidad (Google Ads), analítica (GA4/GTM), CRM, contenido, captación de leads, marca→web** — vive en **[`docs/marketing/`](docs/marketing/README.md)**. Siempre que trabajes un tema de marketing, **lee y actualiza ese tree** (no lo disperses en memoria suelta ni en specs). Entrada = `docs/marketing/README.md` (índice + estado + reglas); bitácora SEO = `docs/marketing/seo.md`. Lo que ya existe en otras carpetas (brand-books en `docs/design/`, `docs/pendientes-seo-ads-*.md`, memoria) **NO se mueve — se indexa** desde ese README. **Reglas SEO que no se rompen:** nunca quitar el 301 `doortudoor.com → dtdcargo.com` · no dejar expirar el dominio viejo · GA fuera de rutas privadas (PII).

## Identidad pública, founder y trato

- **Identidad / nombres / NAP** → fuente única [`docs/marketing/identidad.md`](docs/marketing/identidad.md). Marca pública = **DTD Cargo** · sello de herencia + nombre del ERP interno = **DoorTuDoor** · handles **@dtdcargo.ve** (IG/TikTok) y **@dtdcargo** (YouTube) — ⚠️ **`@doortudoor_` ya NO existe**, las redes migraron (verificado 2026-08-04); el sello "DoorTuDoor" y el dominio `doortudoor.com` sí siguen vivos. La **razón social (INVERSIONES DTD SERVICES, C.A) y el RIF (J-50648869-8) van SOLO en el schema** (`legalName`/`taxID`), **nunca en texto visible**. Versión-máquina = `@graph` en [`app/layout.tsx`](app/layout.tsx) (`#organization` + `#website`); datos desde `CONTACT` en `lib/design-tokens.ts`.
- **Estrategia / misión-visión / valores / ventas** → [`docs/marketing/estrategia.md`](docs/marketing/estrategia.md) + [`docs/marketing/ventas.md`](docs/marketing/ventas.md). Misión/visión/valores son **canónicos** (reemplazan los de 2020). Norte **interno** = **2 contenedores/mes** (umbral de equilibrio, **no se publica**) vía mayoristas recurrentes + aliados white-label.
- **Negocio:** logística + trading puerta a puerta China↔Venezuela; equipo propio en Yiwu y Valencia. **Cronología (founder 2026-07-20):** **2008** = empezamos a trabajar con China y sustenta la **experiencia**, no la fundación; **2010** = abrimos la primera oficina propia en China, tampoco es el año de fundación; **2015** = **fundación e inauguración en Venezuela = EL año de fundación** (`foundingDate` del schema y todo copy de "opera/operando desde"). Frase modelo: *"En el comercio con China desde 2008, con oficina propia en China desde 2010 y operando en Venezuela desde 2015."* Los años de experiencia se calculan con `aniosComercioChina()`: nunca escribir un total fijo. El trading propio es **interno** (la web vende el servicio). El ERP (Studio "DoorTuDoor", 56 módulos registrados) apunta a **cerrar el loop comercial** (recompra día 30/45 + alertas de cadencia + KPI 2 cont./mes + white-label aliados); **no es greenfield**.
- **Trato con el founder (Sam):** español **venezolano neutro, TUTEO, CERO voseo** (regla dura, no negociable). Usar **"tú tienes / puedes / quieres / necesitas / mira"**; **NUNCA** "vos tenés / podés / querés / necesitás / mirá" ni imperativos voseo ("cotizá", "pagás", "escribinos", "dale"). El voseo es argentino, **no se habla en Venezuela** — si lo uso es un bug. Además: directo, sin relleno ni adulación; salidas listas para copiar con rutas explícitas; opciones por prioridad con **⭐ en la #1**; preguntas cortas; decir "Fase 5", no "F5". **Verificar la rama antes de commit; NO hacer push sin su OK; commits selectivos si hay varias ventanas.**

## Organización · ISO 9001 §7.5 → detalle en `docs/README.md`

- **Índice maestro de docs** ("dónde va cada cosa"): [`docs/README.md`](docs/README.md).
- **Adjuntos (2 planos):** documentación (diagrama de spec, captura de runbook) → `docs/.../assets/` (en git si <1 MB). Runtime (foto de operario, recibo, upload de cliente) → **Supabase Storage** (`{tenant_id}/{entidad}/{id}/archivo`, signed URL). **Nunca en git.**
- **Nombres:** carpetas de código NO se renombran (Next.js las exige). Docs técnicas en inglés (`specs`, `runbooks`, `architecture`); negocio en español (`legal`, `operaciones`). Archivos de assets: kebab-case, sin acentos, fechas ISO-8601.
- **Nunca en git:** secretos (`.env*`), PII de clientes (solo Supabase + RLS), financieros/contratos crudos (→ Drive + puntero en `docs/legal/`).
