---
sdd: "0551"
title: "Retirar el botón «Publicar» (bot de deploy) del Studio local"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-10-18
updated: 2026-10-18
supersedes: null
superseded_by: null
related: ["0547", "0541", "0505", "0235"]
confidencialidad: interno
---

# SDD-0551 — Retirar el botón «Publicar» del Studio local

> El Studio, corriendo en local, tenía un botón que hacía `git add -A`, `commit` y `push`, también directo a `main`. Desde la [SDD-0541](../0541-publicacion-automatica-vps/spec.md), lo que llega a `main` se publica en producción en unos 5 minutos. Ese botón publicaba sin PR ni revisión. Esta spec lo retira, junto con todo el código que solo existía para él, y agrega un contrato que impide que vuelva.

## 0 · Pedido y alcance

**Pedido.** Sam al Director, el 2026-10-17: «retira el botón «Publicar» del Studio local». Es la decisión 1 de la [SDD-0547](../0547-panel-publicaciones-servidor/spec.md) §9, que solo le corrigió los textos y recomendó retirarlo.

**Qué botón es.** En pantalla decía «Push» (título «Subir cambios pendientes a GitHub»), en `/studio/debug` › Estado › «Esta instancia», y solo aparecía en local. Es el único botón del Studio que publica la web. Los otros «Publicar» del Studio (tarifas, servicios, noticias, club) publican contenido en la base, no la web, y no son solo locales: no se tocan.

**Convención de evidencia.** Las rutas `archivo:línea` son de `main` en `d5ef42ea`.

## 1 · Situación en `main`

| Pieza | Evidencia | Qué hace |
|---|---|---|
| Botón y modal | `app/studio/_components/deploy/DeployWebBot.tsx:38,42,207-208` | Botón «Push» y modal con destino «Preview» (rama nueva) o «Producción» (`dtdcargo.com`) |
| Dónde se monta | `app/studio/(app)/debug/_components/EstadoTab.tsx:32,157` | `action={isLocal ? <DeployButton /> : undefined}` en la card «Esta instancia» |
| Server actions | `app/studio/(app)/_actions/deployActions.ts:66,102` | `getDeployStatusAction` y `gitPushAction`, detrás de `isLocalRuntime()` y rol `admin` (`:50`) |
| El push a `main` | `deployActions.ts:140,151,165,194-195` | Con «Producción», en `main`: `git add -A`, `commit` y `git push origin main` |
| Quién corre git | `lib/studio/deploy/git-runner.ts:15,28,84,102,106` | `execFile("git", …)` con `["add", "-A"]`, `["push", "-u", "origin", …]` y `["push", "origin", …]` |
| Tipos | `lib/studio/deploy/types.ts` | `DeployType`, `GitPushResult`, `GitStatusSnapshot`, `ScopeTag` |
| Ayuda que lo nombra | `EstadoTab.tsx:209` | «Sube los cambios pendientes con el bot y vuelve a recargar.» |

**Por qué contradice las reglas.**
- AGENTS.md: «PR es la frontera de integración» y «nunca `git add -A`».
- `git add -A` sube todo lo que haya en el árbol, también lo que no se quiso subir. El filtro del bot solo miraba nombres con `.env`, `secret` o `credential`.
- Un push a `main` se publica solo (SDD-0541): el botón publicaba en producción con un clic, sin PR, sin revisión y sin `pnpm verify`.

**Quién más lo usa.** Búsqueda por valor en todo el repo (`DeployWebBot`, `DeployButton`, `deployActions`, `getDeployStatusAction`, `gitPushAction`, `git-runner`, `lib/studio/deploy`, `_components/deploy`, `child_process`, «Subir cambios», «bot de deploy»):
- código: solo `EstadoTab.tsx` y las dos pruebas del bot;
- `git-runner.ts` y `types.ts`: solo `deployActions.ts`, `DeployWebBot.tsx` y sus pruebas;
- `child_process` en `app/`, `lib/`, `components/` y `proxy.ts`, fuera de pruebas: solo `git-runner.ts`;
- ninguna ruta, registro de componentes, regla ESLint ni runbook nombra el bot.

## 2 · Decisión

Se retira el botón y todo lo que solo existía para él. No se cambia por otro botón: lo que llega a producción entra por una PR revisada (AGENTS.md, [runbook](../../runbooks/codex-engineering.md)).

### Se borra

| Archivo | Motivo |
|---|---|
| `app/studio/_components/deploy/DeployWebBot.tsx` | El botón y su modal |
| `app/studio/_components/deploy/__tests__/DeployWebBot.test.tsx` | Prueba del botón (SDD-0547) |
| `app/studio/(app)/_actions/deployActions.ts` | Las dos server actions |
| `app/studio/(app)/_actions/__tests__/deployActions.test.ts` | Prueba del candado de las actions (SDD-0235, SDD-0505) |
| `lib/studio/deploy/git-runner.ts` | El que corría git; no tiene otro consumidor |
| `lib/studio/deploy/types.ts` | Tipos del bot; no tienen otro consumidor |

Las dos pruebas se borran porque el código que probaban ya no existe; no se debilitan. Lo que protegían (que el bot no corriera fuera de local, ni sin admin) queda cubierto de más por el contrato del §3: el camino no existe en ningún entorno.

### Se modifica

- **`EstadoTab.tsx`.** La card «Esta instancia» queda sin acción. La ayuda de «Status de Producción» dice: «Llega cuando su PR se integra a `main` y el servidor publica la imagen; vuelve a recargar después.»
- **`EstadoTab.test.tsx`.** Sin el doble del bot. En local y en el servidor la card no tiene botones; en local el único botón de la pestaña es «Re-checkear ahora», y la ayuda ya no manda a «subir con el bot».
- **Comentarios que decían que el bot existe:** `lib/runtime/app-env.ts`, `lib/runtime/__tests__/app-env.test.ts` y `.env.example`.

### Se conserva, y por qué

- **`isLocalRuntime()`** (`lib/runtime/app-env.ts`). Hoy no lo llama ningún camino de la app, pero no es código del bot:
  - es una primitiva del módulo de entorno (SDD-0505), de una línea, sobre `resolveAppEnv()`;
  - sus pruebas fijan el fallo cerrado («sin señal, nunca local»). Borrarla obligaría a quitar esas aserciones;
  - no ejecuta git ni lanza procesos.

  Su comentario dice ahora que no sirve para reabrir un camino que ejecute git.
- **`ModalShell`** (`app/studio/_components/wiring/ProfileModal.tsx`) y la clase `studio-spin`: son compartidos y tienen otros consumidores.
- **`lib/studio/env-status.ts:11-13`.** Su comentario cuenta, en pasado, que el panel decía «Local» en producción «justo al lado del botón del bot de deploy». Es historia cierta; no se reescribe.
- **Specs, auditorías y handoffs anteriores** (0235, 0295, 0505, 0541, 0547, auditoría 2026-07-31) nombran el bot como era entonces. Son evidencia fechada. Solo se agrega una línea de seguimiento a la 0547 y a su handoff, que dejaron esta decisión abierta.

## 3 · Contrato: la app no ejecuta git

`__tests__/sin-git-desde-la-app.test.ts` recorre `app/`, `lib/`, `components/` y `proxy.ts`, sin las pruebas. Lee cada archivo con el compilador de TypeScript: un comentario que cuente la historia no lo pone en rojo, y un literal en el código sí.

| Regla | Qué prohíbe | Cómo lo tenía el bot |
|---|---|---|
| `importa-procesos` | Importar `child_process` (con o sin `node:`, por `import`, `require`, `import()` o reexport) o una librería que lance procesos o hable git: `execa`, `zx`, `shelljs`, `cross-spawn`, `simple-git`, `isomorphic-git`, `nodegit` | `git-runner.ts:15` |
| `lanza-git` | `exec`/`execFile`/`spawn`/`fork` (y sus variantes `Sync`/`Async`) con `git` como programa | `git-runner.ts:28` |
| `comando-git` | Un literal `git push …` o `git add -A` / `--all` / `.` | — |
| `argumentos-git` | Un arreglo que arranca con `"add", "-A"` / `"--all"` / `"."`, o con `"push", "origin"` / `"push", "-…"` | `git-runner.ts:84,102,106` |

- **Excepciones: ninguna.** La lista está vacía y una prueba lo exige. Agregar una pide una SDD que diga por qué ese camino no publica sin PR.
- **No es verde por vacío.** Otra prueba exige más de 500 archivos y que estén `EstadoTab.tsx` (ruta con paréntesis), `_actions/comments.ts`, `lib/runtime/app-env.ts` y `proxy.ts`.
- **El detector tiene sus casos.** Encuentra las cinco piezas del bot retirado (copiadas de `git-runner.ts` en `d5ef42ea`) y las variantes de cada regla. No confunde comentarios, el canal `"push"` de las notificaciones, `["push", "email"]`, enlaces a GitHub, `git status`, `["add", "archivo.ts"]` ni otros programas. El prefiltro no se come ningún caso.
- **Fuera del barrido, a propósito:**
  - las pruebas, que no se publican y pueden leer el repo (`lib/shared/__tests__/shipment-public.test.ts` usa `git grep`);
  - `scripts/`, que es el harness y corre git por diseño;
  - `next.config.ts`, que corre al construir, no en la app.

**Control rojo.** Con los seis archivos del bot y `EstadoTab.tsx` restaurados desde `d5ef42ea`, fallan dos pruebas:
- el contrato, con seis hallazgos: `git-runner.ts:15` `importa-procesos`, `:28` `lanza-git`, `:84,102,106` `argumentos-git`, y `deployActions.ts:200` `comando-git`;
- la de la pestaña: en local, la card tiene el botón «Push».

El hallazgo de `deployActions.ts:200` es el mensaje «git push falló». La regla `comando-git` también ve un literal que solo nombra el comando. Se acepta: en la app, un mensaje sobre `git push` quiere decir que hay un camino que lo ejecuta. La evidencia está en el handoff.

## 4 · Seguridad, fronteras y datos

- **Superficie.** Desaparece la única server action que ejecutaba un programa del sistema. Es el M1 de la auditoría del 2026-07-31 (`deployActions` «RCE-equivalente» fuera de Vercel), que la SDD-0235 y la SDD-0505 habían acotado con rol y entorno. Ahora el camino no existe.
- **Fronteras ESLint.** Sin cambios: no hay imports nuevos entre superficies.
- **Secretos.** Ninguno nuevo; ninguno se lee.
- **Datos personales.** No aplica `revisar-datos-ve`: no se capturan, mueven ni borran datos.
- **Servidor y producción.** No se tocan. La imagen deja de traer el código del bot; la publicación sigue el camino de la SDD-0541. No hay migraciones.

## 5 · Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.03 (el riesgo determina la fricción) | cumplimiento | Publicar en producción con un clic de modal era la mutación de más riesgo del Studio. Se retira; la publicación pasa por PR, revisión y CI |
| SGE-00.04 (lo crítico se audita) | cumplimiento | El push a `main` no dejaba rastro en el Studio. Ya no hay acción que auditar |
| ERR-01 | cumplimiento | La ayuda de «Status de Producción» dice qué pasó y qué hacer, sin mandar a un botón que no existe |
| VIS-01 / BRAND | cumplimiento | Tuteo, sin voseo, sin emojis; tokens existentes |
| BTN-01 | no aplica | No hay botones nuevos; se retira uno |
| CMP-01 | no aplica | No hay componentes nuevos. `ModalShell` conserva sus consumidores |
| A11Y-01, LOD-01, MP-01, AUD-01/02 | no aplica | No hay elementos interactivos, cargas ni acciones nuevas |
| `/ui-check` | no aplica | No es UI sustancial: se quita un botón de una card |

## 6 · Aceptación

| # | Criterio | Estado |
|---|---|---|
| 1 | Los seis archivos del §2 no existen y nada los importa | Cumplido. `tsc --noEmit` y `eslint` sobre los archivos tocados (handoff) |
| 2 | «Esta instancia» no tiene botones, ni en local ni en el servidor, y la ayuda no nombra el bot | Cumplido. `EstadoTab.test.tsx` |
| 3 | Ningún camino de `app/`, `lib/`, `components/` ni `proxy.ts` lanza procesos ni ejecuta `git add -A` o `git push`, con la lista de excepciones vacía | Cumplido. `sin-git-desde-la-app.test.ts` |
| 4 | Con el bot restaurado, el contrato falla y nombra el archivo | Cumplido. Control rojo (handoff) |
| 5 | La documentación que decía que el bot existe queda al día | Cumplido. §2 y allowlist |
| 6 | En local (`pnpm dev`, admin), `/studio/debug` › Estado › «Esta instancia» se ve sin el botón «Push» | **Pendiente.** No se puede en este worktree: no tiene `.env.local` y no se copian credenciales. Lo mira Sam o el Director en su copia local |

## 7 · Allowlist de archivos

| Área | Archivos |
|---|---|
| Borrados | `app/studio/_components/deploy/DeployWebBot.tsx`, `app/studio/_components/deploy/__tests__/DeployWebBot.test.tsx`, `app/studio/(app)/_actions/deployActions.ts`, `app/studio/(app)/_actions/__tests__/deployActions.test.ts`, `lib/studio/deploy/git-runner.ts`, `lib/studio/deploy/types.ts` |
| Pantalla | `app/studio/(app)/debug/_components/EstadoTab.tsx`, `app/studio/(app)/debug/__tests__/EstadoTab.test.tsx` |
| Contrato (nuevo) | `__tests__/sin-git-desde-la-app.test.ts` |
| Comentarios | `lib/runtime/app-env.ts`, `lib/runtime/__tests__/app-env.test.ts`, `.env.example` |
| Documentación | esta spec, `docs/specs/README.md` (regenerado), `docs/specs/0547-panel-publicaciones-servidor/spec.md` (§13, una línea), `.agents/handoffs/0547-panel-publicaciones-servidor.md` (una línea), `.agents/handoffs/0551-retirar-bot-publicar-studio.md` (nuevo) |

**No se tocan:**
- `infra/**`, incluido `infra/dtd-cargo/compose.yml`: es huella que bloquea la publicación (SDD-0541) y su comentario de la línea 61 queda para quien toque ese archivo (§8);
- `.github/workflows/*`, `scripts/*` y `next.config.ts`;
- `lib/studio/env-status.ts` y las specs, auditorías y handoffs anteriores, salvo la línea de seguimiento de la 0547.

## 8 · Fuera de alcance

- **`infra/dtd-cargo/compose.yml:60-61`.** Dice que `NODE_ENV=production` «ya cierra el candado del bot de deploy». Después de esta spec el bot no existe. No rompe nada. Es huella bloqueante: lo corrige la sesión de Contabo cuando toque ese archivo, en la misma ventana en que lo copie al servidor.
- **Ruleset de `main`.** La SDD-0547 dejó NO VERIFICADO si GitHub rechaza un push directo a `main`. Con el bot retirado, el Studio ya no tiene ese camino. Una persona con permisos todavía puede empujar desde su terminal: eso lo decide la protección de la rama, no esta spec.
- **Escrituras por la API de GitHub.** El contrato vigila git y procesos. Hoy nada en `app/` ni `lib/` llama a `api.github.com` ni usa un token de GitHub (búsqueda por valor). Si algún día hiciera falta, iría con su propia SDD.

## 9 · Seguimiento

- 2026-10-18: reserva `codex/sdd-reserve-0551` (`f1dff3e1`). Implementación, contrato y pruebas en la rama `worktree-agent-a722a0de9ca4bb7a9`, PR en borrador. Sin fusionar.
