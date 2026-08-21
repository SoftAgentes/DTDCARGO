# SDD-0277 · acta de cierre — 2026-08-21

## Alcance

El replay de un branch efímero de Supabase moría en la `0355` y dejaba los 18
tests e2e Tier 3 en `skipped`. Se encontró la causa, se escribió la migración
sólo-ledger `0388`, **se aplicó a producción con OK del founder nombrándola** y
se validó creando y destruyendo un branch real.

## Rutas propias (las únicas que se tocaron)

| Ruta | Qué |
|---|---|
| `supabase/migrations/0388_replay_gate_platform_admins_history.sql` | nueva · sólo-ledger |
| `supabase/tests/0388_replay_gate_platform_admins_history.test.sql` | nueva · contrato con mutación |
| `scripts/check-schema-rebuild.mjs` | 1 línea: alta en `LEDGER_ONLY` |
| `docs/specs/0277-replay-branch-efimero-platform-admins/` | el spec y esta acta |
| `docs/specs/README.md` | índice **generado** (`pnpm docs:index`) |

Ninguna otra ventana usaba este worktree. El árbol quedó limpio antes del merge.

## Verificación

| Qué | Resultado |
|---|---|
| `node scripts/run-sql-tests.mjs` | 114/114 |
| `node scripts/check-schema-rebuild.mjs` | 367 aplicadas + 18 sólo-ledger; huella del schema intacta |
| `pnpm docs:check` | exit 0 |
| Mutación del artefacto | reemplazo no-op → rojo · guards silenciados → rojo |
| `node scripts/verify.mjs` sobre el SHA que se publica | corrido con `.next` limpio antes del push (ver abajo) |

### ⚠️ El primer gate sobre el SHA fusionado salió ROJO por residuo de `.next`

Tras `git merge origin/main`, `typecheck` falló con tres `TS2307` **dentro de
`.next/dev/types/`**, apuntando a `app/portal/(auth)/login/page.tsx` — un fuente
que el merge **borró** (SDD-0276 lo unificó en `/entrar`). Los tipos generados
del route viejo quedaron en `.next` y `tsc` los seguía compilando.

Confirmado por ablación: **misma SHA, único cambio borrar `.next`** → typecheck
pasa de rojo a verde. No se tocó una línea de código para arreglarlo.

**Regla que confirma:** después de un `merge`/`checkout` que borre rutas, hay que
limpiar `.next` antes de leerle el color al gate. Es el mismo residuo que ya
mordió con el CSS servido viejo.

## Producción

**Aplicada** como `20260821171956 · 0388_replay_gate_platform_admins_history`,
de a una, con el basename exacto como `name`. Medida por efecto: el payload de
la 0355 pasó de 8275 a 8272 caracteres — los 3 exactos de `exception`→`notice`.

## Branch de validación

`sdd0277-verifica-replay` · `tmhvzeuzlfgxmpjgjdqp` · branch_id
`e9668752-7bf0-4359-bb16-67c1b16af11d`. Replayó **396 entradas** hasta la 0388,
con `platform_admins` en 0 filas. Llegaron las 30 que morían, incluida la 0387.

**Teardown por los tres criterios del runbook:** `delete_branch` con éxito ·
`list_branches` ya no devuelve ese `branch_id` ni su `project_ref` · `main`
intacta.

## Lo que queda abierto — y de quién es

🔴 **Los 18 tests Tier 3 siguen sin correr.** No es por el replay, que ya está
sano: falta la `service_role` del branch, que **sólo puede poner el founder** a
mano en `.env.local` desde el dashboard (el conector únicamente expone
`get_publishable_keys`, que es la anon). Con eso más las variables que lista
`docs/runbooks/e2e-supabase-efimero.md`, la secuencia es crear branch →
`pnpm seed:e2e` → los 4 specs → `delete_branch`.

**Decisión pendiente, no olvido:** sembrar un platform admin en
`scripts/seed-e2e.ts` para que un entorno efímero tenga superadmin. Hoy no hace
falta —ninguno de los 4 specs toca feature flags, Legal ni Rendiciones— y por eso
no se hizo por iniciativa propia.

## Siguiente responsable

El founder, para la corrida Tier 3. No queda trabajo de agente pendiente.
