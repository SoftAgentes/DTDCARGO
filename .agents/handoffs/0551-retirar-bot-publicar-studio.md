# Handoff · SDD-0551 · Retirar el botón «Publicar» del Studio local

| Campo | Valor |
|---|---|
| Fecha | 2026-10-18, de ~03:40 a ~04:30 UTC (Caracas: 2026-10-17 ~23:40 a 2026-10-18 ~00:30) |
| Task ID / owner | `0551-retirar-bot-publicar-studio` / subagente Worker lanzado por la sesión Director, claim `worker-retirar-publicar-studio-20261017` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a722a0de9ca4bb7a9` |
| Rama | `worktree-agent-a722a0de9ca4bb7a9` |
| Base | `origin/main` `d5ef42ea` (merge de la #271). No cambió durante la tarea |
| SDD | [0551](../../docs/specs/0551-retirar-bot-publicar-studio/spec.md), `in-progress` (falta el criterio 6, el smoke visual). Reserva publicada `codex/sdd-reserve-0551` (`f1dff3e1`) |
| Estado de la tarea | lista para revisión (PR en borrador) |
| Permisos | commits selectivos en la rama propia, push de la rama propia y de la reserva, PR en borrador contra `main`, sin fusionar (cada merge se publica solo, SDD-0541). Prohibidos: servidor, producción, datos de negocio y valores de `.env` |

## OBJETIVO ORIGINAL

Pedido literal de Sam al Director, el 2026-10-17: «retira el botón «Publicar» del Studio local».

En el Studio, solo en local, había un bot que hacía `git add -A`, `commit` y `push`, también directo a `main`. Desde la SDD-0541 un push a `main` se publica en producción en ~5 min, sin PR ni revisión. La SDD-0547 solo le corrigió los textos y recomendó retirarlo (su decisión 1).

## COMPLETADO

### Reserva

- `corepack pnpm sdd:next --reserve retirar-bot-publicar-studio --push`.
  - Salida: `328 refs + worktrees; spec siguiente: 0551; migración siguiente: 0492`.
  - Quedan tres refs: `refs/heads/codex/sdd-reserve-0551-retirar-bot-publicar-studio` y `refs/dtd/reservations/0551` (locales), y `origin/codex/sdd-reserve-0551` (publicada). Las tres apuntan a `f1dff3e1`.
- `sdd:check` después de reservar: `[OK] numbering: sin números repetidos`.
- La spec se escribió en esta rama. El stub de la reserva no se fusiona.

### Qué botón es

En pantalla decía «Push» (título «Subir cambios pendientes a GitHub»), en `/studio/debug` › Estado › «Esta instancia», y solo salía en local. Es el único botón del Studio que publica la web. Los otros «Publicar» (tarifas, servicios, noticias, club) publican contenido en la base y no son solo locales: no se tocaron.

### Búsqueda por valor

En todo el repo, buscando por valor: `DeployWebBot`, `DeployButton`, `deployActions`, `getDeployStatusAction`, `gitPushAction`, `git-runner`, `lib/studio/deploy`, `_components/deploy`, `child_process`, `execFile`, «Subir cambios», «bot de deploy», `api.github.com` y `octokit`.

- Solo `EstadoTab.tsx` y las dos pruebas del bot consumían el código del bot.
- `git-runner.ts` y `types.ts` no tenían otro consumidor.
- Fuera de pruebas, `child_process` solo aparecía en `git-runner.ts` dentro de `app/`, `lib/`, `components/` y `proxy.ts`.
- Ningún registro de componentes, regla ESLint, e2e ni runbook nombra el bot. El guion de smokes (`smokes-app-l14-0454-0472-guion.md`) tampoco.

### Cambios

**Borrados** (commit `453f17ec`):
- `app/studio/_components/deploy/DeployWebBot.tsx`;
- `app/studio/_components/deploy/__tests__/DeployWebBot.test.tsx`;
- `app/studio/(app)/_actions/deployActions.ts`;
- `app/studio/(app)/_actions/__tests__/deployActions.test.ts`;
- `lib/studio/deploy/git-runner.ts`;
- `lib/studio/deploy/types.ts`.

**Modificados:**
- `EstadoTab.tsx`. La card «Esta instancia» queda sin acción. La ayuda de «Status de Producción» decía «Sube los cambios pendientes con el bot…». Ahora dice «Llega cuando su PR se integra a `main` y el servidor publica la imagen; vuelve a recargar después.»
- `EstadoTab.test.tsx`. Ya no tiene el doble del bot. La card no tiene botones, ni en local ni en el servidor. En local, el único botón de la pestaña es «Re-checkear ahora», y la ayuda no dice «con el bot».
- Comentarios: `lib/runtime/app-env.ts` (cabecera y `isLocalRuntime`), `lib/runtime/__tests__/app-env.test.ts` y `.env.example`.

**Conservado:**
- `isLocalRuntime()`. Es una primitiva de la SDD-0505 y sus pruebas fijan el fallo cerrado. No ejecuta git. La razón está en la spec §2.
- `ModalShell` y `studio-spin`, que son compartidos.

**Contrato nuevo:** `__tests__/sin-git-desde-la-app.test.ts`, con 26 pruebas. Usa el compilador de TypeScript y tiene cuatro reglas:
- `importa-procesos`;
- `lanza-git`;
- `comando-git`;
- `argumentos-git`.

La lista de excepciones está vacía, y una prueba exige que siga vacía. Otra prueba exige que el barrido no sea vacío: más de 500 archivos, con `EstadoTab.tsx` (una ruta con paréntesis) y `proxy.ts`. También hay casos positivos y negativos del detector y una prueba de su prefiltro.

### Control rojo (criterio 4)

Se restauraron desde `d5ef42ea`, solo en el árbol de trabajo (`git restore --source=d5ef42ea --worktree`), los seis archivos del bot y `EstadoTab.tsx`. Con `vitest run` del contrato y de `EstadoTab.test.tsx`, el resultado fue exit 1 y **2 pruebas FALLARON**, que es lo esperado:

```
app/studio/(app)/_actions/deployActions.ts:200 comando-git
lib/studio/deploy/git-runner.ts:15 importa-procesos
lib/studio/deploy/git-runner.ts:28 lanza-git
lib/studio/deploy/git-runner.ts:84 argumentos-git
lib/studio/deploy/git-runner.ts:102 argumentos-git
lib/studio/deploy/git-runner.ts:106 argumentos-git: expected [ …(6) ] to deeply equal []
```

En `EstadoTab.test.tsx` falló «en local conserva las marcas «(local)» y no ofrece subir ni publicar». Recibió `<button … title="Subir cambios pendientes a GitHub">↑ Push</button>`.

Después se borraron los restaurados y se volvió `EstadoTab.tsx` a `HEAD`. Las tres suites focalizadas salieron otra vez en verde: 68/68.

`deployActions.ts:200` es el mensaje «git push falló». La regla `comando-git` también ve un literal que solo nombra el comando. Se acepta, y la spec §3 lo dice.

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| `vitest run` del contrato, `EstadoTab.test.tsx` y `app-env.test.ts` | árbol de `453f17ec` | **PASÓ**: 3 archivos, 68 pruebas (verbose: contrato 26 y pestaña 11) |
| Control rojo (bot y `EstadoTab.tsx` de `d5ef42ea`) | árbol temporal | **FALLÓ como se esperaba**: 2 pruebas, con los 6 hallazgos de arriba |
| Mismas suites, después de limpiar | árbol de `453f17ec` | **PASÓ**: 68/68 |
| `pnpm typecheck` (`tsc --noEmit` completo) | árbol de `453f17ec` | **PASÓ** |
| `eslint` de los 5 archivos de código tocados | árbol de `453f17ec` | **PASÓ** (sin salida) |
| `governance:check` · `components:check` | árbol de `453f17ec` | **PASÓ**: 28 políticas, cápsula vigente · CMP-01 válido |
| `docs:index` y `docs:check` | árbol de `6f382816` | **PASÓ**: 538 specs |
| `sdd:check` | después de reservar | **PASÓ** |
| `git diff --check d5ef42ea..HEAD` | `6f382816` | **PASÓ** |
| **`pnpm verify`** (una corrida, sin otras pesadas en la máquina: 0 procesos `vitest`, `verify`, `next build` o `playwright`) | `6f382816` | exit 0. **CIERRE INCOMPLETO**: «CRÍTICOS SIN MEDIR: migrations-applied», 16 de 17 pasos medidos sin fallos. Detalle abajo |
| Smoke visual en local (criterio 6) | — | **NO DISPONIBLE**: el worktree no tiene `.env.local` y no se copian credenciales |
| `/ui-check` | — | **NO EJECUTADO**: no aplica. Se quita un botón de una card y no hay UI nueva |

Pasos de `pnpm verify`, en `6f382816`:

| Paso | Resultado |
|---|---|
| harness | **PASÓ**: 215/215 |
| lint | **PASÓ** |
| rsc-boundary | **PASÓ**: 1683 módulos |
| typecheck | **PASÓ** |
| edge-functions | **PASÓ**: 4 |
| test | **PASÓ**: 795 archivos más 1 omitido; 11225 pruebas más 1 omitida |
| docs:check, numbering, feature-constants (6), components:check, governance:check | **PASÓ** |
| migrations-applied | **NO DISPONIBLE**: «sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY». Esta PR no trae migraciones |
| pending-migration-symbols | **PASÓ**: 0 ROJO, 0 AMARILLO |
| sql-tests | **PASÓ** |
| schema-rebuild | **PASÓ** |
| e2e | **PASÓ** (ver abajo) |
| build | **PASÓ**: `tsconfig.json` restaurado |

Detalle del e2e:
- 177 pruebas pasaron y 20 se omitieron. Las omitidas son las que el propio spec salta, como Tier 3 «requiere seed». `verify` no las marcó como cobertura parcial.
- Una prueba fue inestable: `[chromium] auth.spec.ts:81`, `page.goto: net::ERR_ABORTED` en la primera navegación. Pasó en el reintento, y también en mobile-chrome y mobile-safari.

## COMMITS

- `453f17ec` · `feat(studio)`: retira el bot, ajusta `EstadoTab` y su prueba, agrega el contrato y corrige los comentarios.
- `6f382816` · `docs(sdd)`: la spec 0551, el índice regenerado y la línea de seguimiento en la spec y el handoff de la 0547.
- El commit que contiene este documento: `docs(handoff)`, este handoff.

## PR / BRANCH

- Rama `worktree-agent-a722a0de9ca4bb7a9`, publicada a sí misma. PR en borrador contra `main`; la URL y el SHA final están en la PR.
- Worktree: el de la tabla de arriba.

## PENDIENTES DE ESTA TAREA

1. **Criterio 6, el smoke visual.** En una copia local con `.env.local`, entrar como admin con `pnpm dev` y abrir `/studio/debug` › Estado. La card «Esta instancia» tiene que verse sin el botón «Push». Lo hace Sam o el Director. Por eso la spec queda en `in-progress`.

## FUERA DE ALCANCE DETECTADO

- **`infra/dtd-cargo/compose.yml:60-61`.** Su comentario dice que `NODE_ENV=production` «ya cierra el candado del bot de deploy», y ese bot ya no existe. No rompe nada. Es una huella que bloquea la publicación (SDD-0541): lo corrige la sesión de Contabo cuando toque el archivo, en la misma ventana en que lo copie al servidor.
- **`.agents/handoffs/plan-retiro-vercel-supabase-20261016.md:48`.** El plan del Director nombra `deployActions.ts` entre los archivos que leían Vercel. El archivo ya no existe: el Director actualiza su plan.
- **e2e inestable.** `auth.spec.ts:81` dio `net::ERR_ABORTED` en la primera navegación de chromium, con el `next dev` recién levantado. Pasó en el reintento. No tiene relación con este cambio.
- **Ruleset de `main`.** Sigue NO VERIFICADO si GitHub rechaza un push directo a `main`. El Studio ya no tiene ese camino, pero una terminal con permisos sí lo tiene.
- **Aviso del build.** Next infiere como raíz del workspace el `pnpm-workspace.yaml` del checkout principal, porque este worktree vive dentro de `.claude/worktrees/`. El build sale bien. Es del entorno, no del cambio.

## Impacto documental y conocimiento

- **Documentos canónicos:**
  - nuevo: la spec 0551;
  - modificados: `docs/specs/README.md` (regenerado), una línea de §13 en la spec 0547, una línea en el handoff de la 0547 y el comentario de `.env.example`.
- **Sin cambios:** runbooks (ninguno nombraba el bot) y el guion de smokes.
- **Historia que no se reescribe:**
  - las specs 0235, 0295 y 0505;
  - las auditorías del 2026-07-31;
  - los handoffs 0505 y 0541;
  - los comentarios en pasado de `lib/studio/env-status.ts:11-13` y `lib/runtime/app-env.ts:7`.
- **Graphify:** NO DISPONIBLE en este worktree. `knowledge:status` da `structural: INVALID` (3548 sin grafo) y `semantic: INVALID`. Queda como pendiente global visible actualizar en la estructura las fuentes borradas y nuevas al integrar. Ninguna está en el piloto semántico.
- **Archify:** NO DISPONIBLE. `knowledge:visual build` da `ARCHIFY_RUNTIME_MISSING` (falta `graphify-out/archify-package`).
- **Obsidian:** NO EJECUTADO; no hay vista previa.
- **Gobernanza** (spec §5):
  - cumplimiento: SGE-00.03, SGE-00.04, ERR-01, VIS-01/BRAND;
  - no aplica: BTN-01, CMP-01, A11Y-01, LOD-01, MP-01, AUD-01/02 y `/ui-check`.
- **Datos personales:** no aplica `revisar-datos-ve`.

## HANDOFF AL DIRECTOR

1. Revisar la PR en borrador, sobre todo:
   - el contrato (§3 de la spec): sus cuatro reglas, la lista vacía y lo que queda fuera del barrido (pruebas, `scripts/`, `next.config.ts`);
   - la decisión de conservar `isLocalRuntime()`.
2. Fusionar no exige migraciones ni toca huellas. Pero un merge a `main` se publica solo (SDD-0541), así que la autorización tiene que cubrir ese efecto en producción.
3. Hacer o pedirle a Sam el smoke del criterio 6. Cuando pase, la spec puede pasar a `done`.
4. Cuando la spec esté en `main`, borrar la reserva: `origin/codex/sdd-reserve-0551`, la rama local `codex/sdd-reserve-0551-retirar-bot-publicar-studio` y `refs/dtd/reservations/0551`.
5. Graphify, Archify y Obsidian quedan para la publicación desde `main` integrado.
6. Ownership: el claim se libera al terminar la escritura. El worktree y la rama se conservan.
