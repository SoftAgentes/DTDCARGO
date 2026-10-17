# Handoff · SDD-0547 · Panel de publicaciones del Studio sin Vercel

| Campo | Valor |
|---|---|
| Fecha | 2026-10-17, de ~17:23 a ~18:40 UTC (Caracas: 13:23 a ~14:40) |
| Task ID / owner | `0547-panel-publicaciones-servidor` / subagente Worker lanzado por la sesión Director, claim `worker-panel-publicaciones-20261017` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a0f15ba72118d43b0` |
| Rama | `worktree-agent-a0f15ba72118d43b0` |
| Base | `origin/main` `c2fabdcc` (merge de la #263). No cambió durante la tarea |
| SDD | [0547](../../docs/specs/0547-panel-publicaciones-servidor/spec.md), `in-progress`. Reserva publicada `codex/sdd-reserve-0547` (`a34e93db`) |
| Estado de la tarea | lista para revisión (PR en borrador). Falta K1-K5, de la sesión de Contabo |
| Permisos | commits selectivos, push de la rama propia y de la reserva, PR en borrador contra `main`, sin fusionar (cada merge se publica solo, SDD-0541). Prohibidos: servidor (ssh), producción, prueba, configuración de Vercel o GitHub, datos de negocio y valores de `.env` |

## OBJETIVO ORIGINAL

Pedido literal de Sam al Director, el 2026-10-17: «arranca también la del panel de Vercel».

El Studio (`/studio/debug`, pestaña Estado) leía la API de Vercel para mostrar las publicaciones. Vercel está en pausa desde el 2026-10-16 y la web se publica sola en el servidor propio (SDD-0541). El encargo:

1. Reservar la SDD.
2. Diseñar de dónde lee el Studio el estado real de las publicaciones.
3. Implementarlo con pruebas, también sin datos o con error.
4. Quitar o aislar el código de Vercel que quede muerto y actualizar la documentación que lo nombre.

## COMPLETADO

### Reserva

- `corepack pnpm sdd:next --reserve panel-publicaciones-servidor --push`.
  - Salida: `413 refs + worktrees; spec siguiente: 0547`.
  - La reserva quedó publicada en `refs/heads/codex/sdd-reserve-0547` (`a34e93db`).
- La 0546 ya estaba reservada por el otro Worker (`codex/sdd-reserve-0546`, `e5ff9fc3`, «migraciones-servidor-propio»). **Sin choque.**
- `sdd:check` antes y después: `[OK] numbering: sin números repetidos`.
- El índice regenerado lista la 0546 como «hueco» porque su spec todavía no está en `main`. Se corrige solo cuando se integre: el driver del índice lo regenera.

### Decisión (spec §2)

Se elige la opción **(b)**: un archivo JSON que escribe `publicar-web.sh`, montado en solo lectura en el contenedor web. Se le suman el SHA y la URL que la instancia ya conoce.

- Es la única opción que muestra lo que el servidor de verdad hizo: publicada, retenida, vuelta atrás o congelado.
- No necesita secretos nuevos: el repo es privado, así que la API de GitHub exigiría un token.
- No le da al contenedor el host ni el socket de Docker.
- No depende de la red.

### Implementación del Studio

- `lib/studio/publicaciones-types.ts`: el contrato v1, su validación y los textos por código. Solo pasan valores con forma fija: SHA, hora UTC, código de una lista cerrada y nombre de migración.
- `lib/studio/publicaciones-loader.ts`: lee `/var/lib/dtd-cargo/publicacion/publicaciones.json` con un tope de 128 KB y nunca lanza.
- La card «Publicaciones del servidor» (`PublicacionesServidor.tsx`) reemplaza a «Deploys recientes».
- «Deploy actual» pasa a «Esta instancia» y ya no dice «(local)» en el servidor.
- Retiro de Vercel:
  - se borró `lib/studio/vercel-deploys.ts`;
  - `env-status.ts` ya no lista las `VERCEL_*`;
  - `.env.example` ya no tiene `VERCEL_API_TOKEN`;
  - la ayuda de mocks ya no recomienda `vercel env pull`.
- Bot local de deploy: cambian solo sus textos (título, destino Preview y mensaje después de subir). Se corrigieron los comentarios de `deployActions.ts`, `git-runner.ts`, `debug/actions.ts` y `debug/layout.tsx`.

### Lo que no se tocó, a propósito

- `infra/ops/web/*`, `infra/dtd-cargo/*`, `infra/ops/tests/*` y los workflows. El escritor y el montaje son de la sesión de Contabo, y `compose.yml` es huella bloqueante (spec §5).
- `lib/runtime/app-env.ts` y `app/api/debug/health/route.ts`. Los consume el vigía externo.
- `docs/runbooks/servidor-contabo.md` y `publicacion-automatica-web.md`.

## VALIDACIÓN

Sobre la punta `09c10bc8` (antes del commit de este handoff, que solo agrega este archivo):

| Comprobación | Resultado |
|---|---|
| `vitest run` de las 5 suites nuevas (tipos, loader, card, pestaña, bot) | **PASÓ**: 5 archivos, 82 pruebas |
| `vitest run` de las 5 nuevas y 5 vecinas: `DebugTabs`, `deployActions`, `resend-api-prueba` (importa `env-status`), `env-example-contract` e `infra-env-example` | **PASÓ**: 10 archivos, 122 pruebas, después del último ajuste de accesibilidad |
| Mutantes, sobre las suites nuevas (§ abajo) | **PASÓ**: 5 de 5 mueren |
| `tsc --noEmit` (proyecto completo) | **PASÓ**: exit 0, ~2 min, antes de los ajustes de accesibilidad. Después, el paso `typecheck` de `verify` sobre `09c10bc8` también **PASÓ** |
| `eslint` de los 16 archivos de código tocados | **PASÓ**: exit 0 |
| `pnpm docs:index` y `pnpm docs:check` | **PASÓ**: «índice sincronizado con 532 specs» |
| `pnpm sdd:check` | **PASÓ**: «sin números repetidos» |
| `pnpm governance:check` | **PASÓ**: «28 política(s) aprobada(s) · cápsula vigente» |
| `pnpm components:check` | **PASÓ**: «CMP-01 válido: 5 fuente(s)…» |
| `git diff --check` | **PASÓ** |
| `/ui-check` (rúbrica en línea, sin bloquear) | **PASÓ con ajustes aplicados**: ver abajo |
| `pnpm verify` (una vez, sobre `09c10bc8`) | **FALLÓ (exit 1) por el paso `test`**. Las causas son de tiempo bajo carga y ajenas al diff. Detalle abajo |
| Las 3 suites que cayeron en `verify`, corridas aisladas | **PASÓ**: 3 archivos, 135 pruebas, 154 s, sin otra corrida en la máquina |
| `pnpm knowledge:status` | **NO DISPONIBLE**: `structural`/`semantic` `UNAVAILABLE`, «Respuesta inválida del adaptador Graphify». El worktree no tiene Graphify |
| `pnpm knowledge:visual:check` | **NO DISPONIBLE**: `PENDING`, misma causa |
| Prueba en el servidor (K5) | **NO EJECUTADO**: fuera del permiso; es de Contabo |

**`pnpm verify`.**

- **Antes:** a las 17:50Z había otra sesión con `pnpm verify` (PID 27764). Esperé a que la máquina quedara libre dos minutos seguidos (18:08Z) y lancé la corrida a las 18:09:13Z. Terminó a las ~18:31Z (22 min).
- **Resultado por paso:**

  | Paso | Resultado |
  |---|---|
  | `harness`, `lint`, `rsc-boundary` (1687 módulos), `typecheck`, `edge-functions` (4) | **PASÓ** |
  | `docs:check`, `numbering`, `feature-constants` (6), `components:check`, `governance:check` | **PASÓ** |
  | `pending-migration-symbols` (0 ROJO · 0 AMARILLO) | **PASÓ** |
  | `sql-tests` (242 contratos), `schema-rebuild` (467 + 18 sólo-ledger, aislamiento de 219 tablas) | **PASÓ** |
  | `e2e` (177 pasadas, 20 omitidas, 1 inestable: `auth.spec.ts:81`, `ERR_ABORTED` en la primera vuelta) | **PASÓ** |
  | `build` | **PASÓ** |
  | `test` | **FALLÓ**: 11.112 pasadas y 2 caídas, las dos veces |
  | `migrations-applied` | **NO EJECUTADO** (SKIP: el worktree no tiene `.env.local`). Es la puerta del ledger de release. Esta PR no trae migraciones |

- **El paso `test`, en detalle:**
  - Primera corrida: `entorno-prueba-scripts.test.mjs` («crear rc=143», el doble recibió `Terminated`) y `pin-operarios-endurecer.migration.test.ts` (prueba «(texto)», 20,98 s contra un tope de 20 s).
  - El reintento: `entorno-prueba-scripts` pasó. Cayeron `operarios-editar-por-region.migration.test.ts` (20,8 s) y otra vez `pin-operarios-endurecer` (40,7 s).
  - Un conjunto distinto en cada corrida, y por reloj, no por aserción: es la firma de la contención.
  - La rama no toca esas pruebas ni lo que prueban (`git diff c2fabdcc..HEAD` sobre ellas, `infra/` y `supabase/`: vacío). Aisladas, pasan.

**Mutantes.** Cada uno se aplicó a mano y se revirtió. `grep "MUTANTE-[0-9]"` no deja restos.

| # | Mutante | Prueba que lo mata |
|---|---|---|
| 1 | `motivo()` devuelve el valor tal cual, sin lista cerrada | «un secreto puesto en cualquier campo…» y «un motivo desconocido se muestra como otro» |
| 2 | `faltan` sin el filtro por `motivo === "migraciones"` | «faltan: solo nombres de migración…» |
| 3 | Condición del mensaje del bot invertida (`!== "main"`) | Las dos pruebas «a main» y «a una rama» |
| 4 | «Esta instancia» dice «(local)» también en el servidor | «en el servidor sin datos no dice (local)» |
| 5 | El loader devuelve `ilegible` en lugar de `sin-archivo` ante `ENOENT` | «sin archivo» y «sin la carpeta» |

**`/ui-check`** (rúbrica de `.claude/commands/ui-check.md`, sobre `EstadoTab.tsx`, `PublicacionesServidor.tsx` y `DeployWebBot.tsx`):

- Hallazgo aplicado (media): los enlaces «Ver commit» eran iguales para destinos distintos. Ahora cada uno tiene `aria-label` con su commit y el aviso de otra pestaña, y está probado.
- Hallazgo aplicado (baja): la clave de lista no incluía el índice.
- Bien:
  - solo tokens;
  - `Badge` con texto e icono;
  - tonos permitidos (rojo solo en vuelta atrás);
  - `<ul>`, `<time>` y `role="status"`;
  - tuteo, sin voseo, sin emojis;
  - la columna de 140 px es un piso (`minmax(140px, auto)`) y la etiqueta más larga no se parte (`nowrap`).

Veredicto: OK para commit.

## COMMITS

| SHA | Propósito |
|---|---|
| `58daf1c3` | `docs(sdd)`: spec 0547, ejemplo canónico e índice |
| `50636aad` | `feat(studio)`: lector, card, «Esta instancia», retiro de `vercel-deploys.ts` y de las `VERCEL_*`, pruebas |
| `09c10bc8` | `feat(studio)`: textos del bot local y comentarios |
| commit que contiene este documento | handoff |

## PR / BRANCH

- Rama: `worktree-agent-a0f15ba72118d43b0`, base `main`, en el worktree de arriba.
- PR en borrador desde esta rama. La URL queda en la propia PR y en el informe al Director: este documento se escribió antes del push, para no mover la punta publicada.

## PENDIENTES DE ESTA TAREA

1. **K1-K5 de la spec §5 (sesión de Contabo):**
   - el escritor en `publicar-web.sh`, con códigos de motivo, historial y escritura atómica `644`;
   - sus pruebas en `prueba-publicar-web.sh`;
   - el montaje `./estado-publicacion:/var/lib/dtd-cargo/publicacion:ro` en `compose.yml`;
   - la instalación.

   Hasta entonces, la card dice «Sin datos» en producción, como está previsto y probado.

   **Ojo con el orden:** `compose.yml` es huella bloqueante. En la ventana del merge que lo cambie hay que copiarlo al servidor, o la siguiente publicación queda retenida por `huellas`.
2. El criterio 9 de la spec («en producción la card muestra el estado real») queda abierto hasta K5. Por eso la spec queda en `in-progress`.

## FUERA DE ALCANCE DETECTADO

- **El bot local de deploy** hace `git add -A` y `git push` directo a `main` (`deployActions.ts:164-195`). Desde la SDD-0541, eso publica en producción en ~5 min sin PR. Es la decisión 1 para Sam en la spec.
  - NO VERIFICADO: si el ruleset de `main` rechaza ese push.
- **`app/studio/(app)/layout.tsx:42-47`** calcula el SHA del bug reporter con `??`. Un `NEXT_PUBLIC_BUILD_SHA=""` daría `""`; `resolveBuildSha` lo trata.
- **`infra/dtd-cargo/.env.example:193`** sigue nombrando `VERCEL_API_TOKEN` entre las variables «para scripts locales». No rompe la prueba de deriva (solo exige raíz ⊆ infra). Es huella: lo corrige Contabo cuando toque el archivo.
- **`scripts/__tests__/env-example-contract.test.ts:36`** sigue ignorando `VERCEL_(PROJECT_ID|TEAM_ID)`, que ya nadie lee. Es inofensivo; se puede podar.
- **`VERCEL_API_TOKEN`** ya no lo lee nada. Revocarlo se puede adelantar al 30-oct (decisión 2 para Sam).
- **Pruebas «(texto)» de migraciones al límite de 20 s bajo la suite completa.** Las dos dieron rojo en `verify` y pasan aisladas:
  - `pin-operarios-endurecer.migration.test.ts:376`;
  - `operarios-editar-por-region.migration.test.ts:270`.

  Leen muchas migraciones, y con la suite entera en paralelo pasan del tope (es lo mismo que documenta `env-example-contract.test.ts` en su cabecera). Les falta el `vi.setConfig({ testTimeout })` local que ya usan otros contratos de I/O.
- **`entorno-prueba-scripts.test.mjs` (SDD-0540)** recibió `Terminated` (rc=143) en «crear» bajo carga y pasó en el reintento y aislada.

## Impacto documental y conocimiento

- **Documentos canónicos nuevos:**
  - la spec 0547;
  - su ejemplo `ejemplo-publicaciones.v1.json`.
- **Modificados:**
  - `docs/specs/README.md`, regenerado;
  - `.env.example`.
- **Sin cambios:**
  - los runbooks de Contabo;
  - `docs/runbooks/publicacion-automatica-web.md`.
- **Propuesta para cuando se instale K5:** una línea en `publicacion-automatica-web.md` («Panel del Studio: lee `estado-publicacion/publicaciones.json`, SDD-0547»). La agrega quien instale.
- **Graphify y Archify:** NO DISPONIBLES en este worktree. Queda un pendiente global visible: la actualización estructural de las fuentes nuevas (`lib/studio/publicaciones-*`, la card, la spec) al integrar. Ninguna está en el piloto semántico. Obsidian: sin preview.
- **Gobernanza:** spec §8.
  - Cumplimiento: ERR-01, LOD-01 (vacío y error), A11Y-01, VIS-01/BRAND.
  - No aplica: BTN-01, CMP-01, SGE-00, MP-01, AUD-01/02.
- **Datos personales:** no aplica `revisar-datos-ve`. Solo hay SHA, horas, códigos y nombres de migración.

## HANDOFF AL DIRECTOR

1. Revisar la PR en borrador, sobre todo:
   - la decisión (b) y el contrato §4;
   - que el servidor no tenga que cambiar nada para que esta PR se pueda fusionar. Sin el archivo, la card dice «Sin datos».
2. Fusionar esta PR no exige migraciones ni toca huellas. No cambia nada fuera de la imagen, así que el vigilante la publica como cualquier otra.
3. Pasarle a la sesión de Contabo la spec §5 (K1-K5) y el ejemplo canónico. Esa sesión decide cuándo y con qué OK instala.
4. Llevarle a Sam las decisiones 1 y 2 de la spec §9.
5. Ownership: el claim se libera al terminar la escritura. El worktree y la rama se conservan.
