# Handoff · borrado-cliente-auditado (SDD-0469)

- **Fecha:** 2026-09-15
- **Owner / sesión:** worker-borrado-cliente-auditado-20260915 (Claude Code, subagente Worker asignado por el Director)
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/borrado-cliente-auditado`
- **Rama:** `codex/borrado-cliente-auditado`
- **Base:** `origin/main` `c70956bf8b58b70e7e49676f29264d11796d7f81`. Revisada otra vez antes de publicar: sin cambios.
- **SDD:** `docs/specs/0469-borrado-cliente-auditado/spec.md` (status `in-progress`: falta `/ui-check`)
- **Migración:** `supabase/migrations/0455_borrado_cliente_auditado.sql`. Número asignado por el Director; no hay otro 0455 en refs ni worktrees.
- **Estado de tarea:** lista-para-revision
- **Permisos usados:** commits locales selectivos, push de la rama propia y PR en borrador contra `main`. Sin merge, deploy, migraciones, lecturas de producción ni borrado de ramas o worktrees.

## OBJETIVO ORIGINAL

El borrado de un cliente desde el Studio cumple las políticas de permanencia y auditoría:

- se confirma con un `ConfirmDialog` R2 que nombra al cliente y su consecuencia;
- deja un evento de auditoría atómico con la mutación;
- la acción detecta cuando no borró ninguna fila.

## COMPLETADO

- **Migración 0455.**
  - **Trigger `clients_audit_soft_delete`.** Es AFTER UPDATE en `clients` y dispara cuando `deleted_at` pasa de NULL a un valor.
    - En la misma transacción escribe `client_deleted`, o `client_merged` si el mismo UPDATE fija `merged_into_client_id`.
    - El evento lleva tenant, actor, `deleted_at` y `merged_into_client_id` antes y después, motivo, correlación D5 y payload P2 (permanencia, consecuencia, recuperación y archivos).
    - No copia datos personales.
  - **RPC `soft_delete_client_with_audit_reason(uuid, text)`.** Es SECURITY INVOKER con `search_path` vacío y EXECUTE sólo para `authenticated`.
    - Borra por id y por RLS, con motivo opcional de 4 a 1000 caracteres.
    - Devuelve `false` si no alcanzó ninguna fila.
  - Preflight y postflight en el estilo de 0454, con huella del catálogo dependiente. Sin backfill.
- **Decisiones documentadas en la spec.**
  - **Motivo opcional** (MP-01 R2 y AUD-01 §3). Sin motivo humano, el evento lleva «Cliente eliminado sin motivo indicado (SDD-0469).».
  - **Las fusiones escriben `client_merged`**, nunca `client_deleted`. `merge_clients` no se redefine: el preflight exige que retire con un solo UPDATE.
  - **Trigger más RPC INVOKER**, y no una RPC DEFINER: el trigger cubre también el UPDATE directo del código desplegado y la RLS sigue siendo la frontera de tenant.
  - **Migrate-first**: 0455 se aplica antes de desplegar esta PR.
- **Acción `softDeleteClientAction(clientId, reason)`.** Valida permiso, id y motivo, y llama a la RPC. Sólo `data === true` es `ok`; cualquier otro valor da «No se eliminó ningún cliente…».
- **`ClientDrawer`.** Usa el `ConfirmDialog` canónico:
  - danger, con nombre, Shipping Mark y consecuencia, sin prometer restauración;
  - motivo opcional con la etiqueta «sin datos personales»;
  - el error queda en el diálogo y se puede reintentar;
  - el éxito avisa con `toast.show` (AVS-01).
- **Espera en el baseline y declaración de símbolos.** La espera de 0455 va en el baseline, con locks y contención medidos. La degradación de la RPC queda declarada en `supabase/pending-migration-symbol-declarations.json`, porque el gate la exige.
- **Mapa de borrado §10.** Suma el evento del borrado y su estado.
- **Criterios de aceptación.**
  - Cumplidos: 1 a 7.
  - Pendiente: el 8, `/ui-check`, que no pude correr.

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| `harness-worktree guard --owner` antes de cada commit | `dedbc7ce`, `78069e39`, `37455877` y el commit que contiene este documento | PASÓ |
| Vitest focal: `soft-delete-client.test.ts` y `ClientDrawer.confirm-delete.test.tsx` | árbol de `78069e39` | PASÓ, 29 de 29 |
| ESLint de los cuatro archivos TS tocados | árbol de `78069e39` | PASÓ |
| Contrato `0455_borrado_cliente_auditado.test.sql` | árbol de `dedbc7ce` | PASÓ, 85 aserciones |
| Control rojo `-v apply_fix=false` | ídem | PASÓ: falla como corresponde en «El UPDATE directo del código desplegado deja exactamente un evento client_deleted» |
| Mutantes SQL, serie 1 (copia de `supabase/`, sha256 verificado) | migración 0455 | PASÓ: 23 de 23 muertos, con los dos controles en verde |
| Mutantes SQL, serie 2: muertes revisadas por causa | ídem | PASÓ: «evento tragado» corregido y 4 de la RPC con la aserción estática neutralizada, 5 de 5 muertos por comportamiento, controles en verde |
| Mutantes de acción y drawer contra vitest | `actions.ts` y `ClientDrawer.tsx` | PASÓ: 16 de 16 muertos, controles en verde, archivos restaurados |
| `node scripts/run-sql-tests.mjs` completo (incluye 0267, 0293, 0294, 0341, 0358, 0454 y 0455) | árbol previo a los commits, idéntico en contenido | PASÓ, 196 de 196 |
| Sondeo de locks y contención de 0455 (PostgreSQL 17 local) | ídem | PASÓ: SHARE ROW EXCLUSIVE sobre `clients`; 18,8 ms; reaplicación sin ese lock; corte a los 5,4 s por `lock_timeout` con reversión entera |
| `node scripts/check-numbering.mjs` (`sdd:check`) | ídem | PASÓ |
| `node scripts/check-pending-migration-symbols.mjs` | ídem | PASÓ: 0 ROJO · 1 AMARILLO declarado |
| `node scripts/build-docs-index.mjs` y `--check` | ídem | PASÓ: 457 specs |
| `governance:check` y `components:check` | ídem | PASÓ |
| `git diff --check` | ídem | PASÓ |
| `corepack pnpm verify`, resumen | contenido idéntico a `37455877` | FALLÓ, sólo e2e, por entorno. 16 de 17 pasos corrieron; exit 1 |
| verify · harness, lint, rsc-boundary, typecheck, edge-functions | ídem | PASÓ. Lint: 0 errores; los 8 warnings son previos y están en archivos no tocados (tests de compras del Portal, `KommoBoardView.tsx`, `KommoClient.tsx`) |
| verify · test, docs:check, numbering, feature-constants, components:check, governance:check | ídem | PASÓ |
| verify · pending-migration-symbols, sql-tests, schema-rebuild | ídem | PASÓ (0 ROJO · 1 AMARILLO declarado) |
| verify · migrations-applied | ídem | NO DISPONIBLE: SKIP sin `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY` en el worktree. 0455 está pendiente por diseño y declarada en el baseline |
| verify · e2e | ídem | FALLÓ por entorno: 15 fallos en `e2e/auth.spec.ts` y `e2e/global-search.spec.ts` (Tier 1), en chromium, mobile-chrome y mobile-safari. El WebServer revienta en `createServerClient` con `NEXT_PUBLIC_SUPABASE_URL` indefinida. Pasaron 152 y 153 en las dos pasadas; 18 omitidos (Tier 3 con seed); 1 flaky en la primera. Ninguno toca Clientes |
| verify · build | ídem | PASÓ |
| `/ui-check` del diálogo | — | NO EJECUTADO: esta sesión de subagente no tiene la skill; lo corre el Director |
| Lecturas o escrituras de producción | — | NO EJECUTADO a propósito (fuera de autorización) |

## COMMITS

- `5021933b` — chore(sdd): reserva SDD-0469. Es el cherry-pick de `c66e1e95`, la reserva del Director.
- `dedbc7ce` — feat(db): SDD-0469 — 0455 borrado de cliente auditado. Migración, contrato y espera en el baseline.
- `78069e39` — feat(studio): SDD-0469 — borrado de cliente con ConfirmDialog R2 y cero filas. Acción, drawer, tests y declaración de símbolos.
- `37455877` — docs(studio): SDD-0469 — spec, índice y mapa de borrado.
- Commit que contiene este documento — docs(handoff): SDD-0469. Toca `.agents/`, que no excluye el `ignoreCommand` de Vercel, así que el head dispara la vista previa.

## PR / BRANCH

- **Rama:** `codex/borrado-cliente-auditado`, publicada con `git push -u origin codex/borrado-cliente-auditado`.
- **PR:** en borrador contra `main`, abierta después del push. La URL y el SHA del head van en la respuesta al Director. La rama queda congelada al publicar.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/borrado-cliente-auditado`, conservado.

## PENDIENTES DE ESTA TAREA

- `/ui-check` del `ConfirmDialog` del borrado (criterio 8 de la spec). Hasta entonces la SDD sigue `in-progress`.
- `pnpm verify` en verde completo:
  - **e2e:** FALLÓ por entorno, no por este cambio. Sin variables de Supabase fallan `auth.spec` y `global-search`; lo está arreglando el Worker de `verify-e2e-sin-supabase`.
  - **`migrations-applied`:** no se pudo medir sin credenciales, que no se copian al worktree.
- Fuera de esta sesión y con sus autorizaciones propias:
  - la revisión y el merge de la PR (Director);
  - aplicar `0455_borrado_cliente_auditado` con el OK nominal de Sam y antes del despliegue (migrate-first);
  - retirar después la espera y la declaración de símbolos;
  - el smoke de Sam: borrar un cliente de prueba con y sin motivo y ver `client_deleted` en Auditoría.

## FUERA DE ALCANCE DETECTADO

1. **Borrado físico de clientes sin auditoría.** `authenticated` conserva DELETE sobre `clients` (`supabase/migrations/0006_clients.sql:63`) y «clients by tenant» es FOR ALL (`0012_rls_perf_and_rpc_guards.sql:248-251`). Un miembro del tenant puede borrar una ficha por PostgREST, sin evento y con cascada sobre las tablas de §3.A del mapa. Ningún código del repo lo hace.
2. **La base no aplica la matriz de roles a `clients`.** Cualquier miembro del tenant puede poner `deleted_at` por PostgREST sin pasar por `moduleEditDenial`. Desde 0455 queda auditado, pero no se impide.
3. **MP-01: los clientes son P2 sin restauración.** MP-01 pide P1 con restauración para maestros (`docs/governance/policies/mp-01.md:69`, MP-D2). Requiere su propia SDD; la UI de restauración estaba excluida.
4. **La restauración no se audita.** No existe el camino. Cuando exista, AUD-01 §2 y §8 exigen un evento enlazado al original.
5. **`source` siempre es `rpc`.** Los eventos de trigger D5, y ahora `client_deleted`, no distinguen Studio de PostgREST directo. Es transversal a D5.
6. **Largo del motivo medido distinto en TS y en SQL.** `validateAuditReason` (`lib/studio/audit/reason.ts:17`) mide unidades UTF-16 y el writer mide `char_length`. Un motivo de 2 emojis pasa en TS y falla en SQL con un error genérico. Afecta a todos los flujos R3 que lo usan; es menor.
7. **Registro de `ConfirmDialog`.** `docs/governance/components/confirm-dialog.json` no lista a `ClientDrawer` entre sus consumidores. El validador no lo exige.
8. **Retención del vínculo revocado.** Ya conocida: sigue 🔴 SIN FUNDAMENTO en el mapa §10 y es la siguiente tarea (30 días, decisión de Sam).

## HANDOFF AL DIRECTOR

- **Siguiente acción:**
  - revisar la PR en borrador;
  - correr `/ui-check` sobre el diálogo en la vista previa;
  - confirmar por nombre el check «Calidad local sin secretos» sobre el head.
- **Orden de integración.** Sin dependencias de código.
  - **Índice de specs:** se comparte con el Worker de SDD-0470. Si hay choque, regenerarlo con `node scripts/build-docs-index.mjs`, nunca a mano.
  - **`migrations-baseline.json`:** también lo edita el Director. Esta PR sólo agrega la espera de 0455 al final de `pendingBelowCutoff`.
- **Producción: migrate-first.**
  - Aplicar 0455 con OK nominal y el runbook antes de desplegar el merge. Con 0455 aplicada, el código hoy desplegado sigue borrando y queda auditado con el motivo por defecto.
  - Si el despliegue llegara antes, borrar clientes da error sin borrado a medias hasta aplicar 0455.
  - La lectura previa y el postflight recomendados están en la spec, sección Producción.
- **Contratos compartidos:**
  - `entity_audit_log` y `append_audit_event`, sin cambios;
  - el trigger de 0454, sin cambios y exigido por el preflight;
  - `merge_clients`, sin cambios; su forma se exige en el preflight;
  - RLS de `clients`, sin cambios.
- **Sesiones consumidoras:** ninguna aparte de ésta.
- **Ownership:** claim liberado al terminar, con `release --owner worker-borrado-cliente-auditado-20260915`.
