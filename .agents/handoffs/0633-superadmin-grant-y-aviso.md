# Handoff · SDD-0633 · Superadmin: EXECUTE de is_platform_admin() y el aviso

- **Worker:** 10.5 (E10). Lo encargó el Subdirector Chatwoot, a pedido del DG, con la autorización de Sam («Sí, encárgala»). Sobre el aviso, Sam dijo: «tiene que salir un aviso o algo, tampoco se debe dejar así. Debe salir un aviso cuando te diga que no eres admin».
- **Rama:** `codex/is-platform-admin-grant`, en el worktree `DTD-worktrees/is-platform-admin-grant`, desde `origin/main` `aa5d4885a`. Se trajo el stub de la reserva, `ece297d3d` sobre `aee7d5d70`.
- **Reservas:**
  - **La SDD-0633:** su stub está en `refs/heads/codex/sdd-reserve-0633-superadmin-grant-y-aviso`, y la publicación fue create-only en `origin/codex/sdd-reserve-0633`.
  - **La migración 0542:** es la siguiente según `sdd:next` (1020 refs y worktrees). La 0541 ya está en main.
- **SDD nueva y no una enmienda:**
  - **No la 0250:** está cerrada como diseño del superadmin.
  - **No la 0586:** es la del portal de Chatwoot, y el bug no es suyo, solo la bloquea en la puerta 5.
  - **Lo que trae:** una migración nueva con su `created_by` (SDD-0633), una regresión de la 0211 que cruza tres módulos (feature flags, usuarios y el segundo candado de `rbac-guard`) y un aviso nuevo. Necesita su propia allowlist y su propio registro de aplicación.

## Qué cambió

1. **La migración `supabase/migrations/0542_is_platform_admin_execute_authenticated.sql`** (migrate-first):
   - Hace `revoke … from public, anon` y `grant … to authenticated, service_role`.
   - **El preflight:** exige DEFINER de postgres, SQL que devuelve boolean, `search_path` fijo y el cuerpo de la 0058 sin contar espacios.
   - **El postflight:** mide con `has_function_privilege` (authenticated y service_role sí, anon no) y revisa que PUBLIC no aparezca en el ACL.
   - Es idempotente.
   - **La espera:** está declarada en `migrations-baseline.json` (`pendingBelowCutoff`).
2. **El contrato:**
   - `supabase/tests/0542_….test.sql`, de 14 aserciones, más su envoltorio en PGlite `lib/studio/__tests__/is-platform-admin-grant.migration.test.ts`.
   - Trae el control rojo, 7 mutantes y 2 pruebas de barrido.
3. **El aviso:**
   - **`lib/studio/platform-admin.ts`:**
     - `platformAdminCheck` distingue «sí», «no» y «error».
     - `SUPERADMIN_DENIAL` empieza con «No eres superadministrador.».
     - `SUPERADMIN_CHECK_FAILED` sale cuando la RPC falla: no acusa a nadie y no deja hacer el cambio.
   - **`feature-flags/actions.ts`:** la denegación y el catch llevan `flagKey`.
   - **`FeatureFlagsClient.tsx`:** pinta `state.error` siempre, con `role="alert"`, porque cada tarjeta tiene su propio `useActionState`.
   - **`usuarios/actions.ts` y `UserDetailDrawer.tsx`:** suspender o reactivar a OTRO admin sin ser superadmin avisa antes de tocar Auth. El formulario manda `target_role` como pista, y la base sigue siendo el freno. Si la comprobación falla («error»), la acción no corta y decide la base: `studio_set_user_disabled` es DEFINER (0289:1144) y no depende del grant. Este ajuste es de la revisión de la #574.
4. **`pending-migration-symbol-declarations.json`:** tres citas de línea de la 0538 en `usuarios/actions.ts` corridas 34 líneas por este cambio, sin cambiar los símbolos. El gate da `0 ROJO · 3 AMARILLO`.

## La causa, con evidencia

| Migración | Línea | ¿Corre? | Efecto |
|---|---|---|---|
| 0058 | :66 | sí | grant a authenticated |
| 0209 | :49 | sí | grant a authenticated y service_role (y revoke de public y anon) |
| 0211 | :27 | sí | **revoke a authenticated** |
| 0248 | :25 | — | comentario: lo excluye a propósito del sweep-back |
| 0273 | :90 | **no** | dentro de `$sdd0118_platform_admin_target$ …`, que es texto del ledger |
| 0276 | :74 | **no** | dentro de `$sdd0118_revoke_anon_target$` (:26-149), texto del ledger |
| 0282 | :119 | **no** | dentro de `$sdd0118_platform_admin_split_patched_0273$` (:21-152), texto del ledger |
| 0285 | :99 | **no** | dentro de `$sdd0118_revoke_anon_target$` (:51-174), texto del ledger |
| 0287 | :3594 | **no** | dentro de `$sdd0118_replay_gate_2$` (:3468-3657), texto del ledger |
| 0288 | :3694 | **no** | dentro de `$sdd0118_replay_gate_2$` (:3568-3757), texto del ledger |
| 0355 | :137 | sí | la policy de `feature_flags` empieza a usar la función **con la sesión**, sin devolver el grant |
| 0356 | :47, :62, :78, :97, :112, :132 | sí | seis policies de authenticated la usan con la sesión (`legal_docs` insert, update y delete; `renditions` insert y update; `rendition_receipts` insert), sin devolver el grant |

**El origen:** la premisa de la 0211 (2026-07-03, «ningún caller con la sesión») era cierta cuando se escribió. El defecto es que la 0355 y la 0356 empezaron a usar la función con la sesión y ninguna devolvió el grant. Las correcciones de la revisión de la #574 van en la spec y aquí. La cabecera de la 0542 no se toca, porque su md5 `e6f1c9b137ba7eda3e7ca79e0b144da7` es el que se aplica.

**La cabecera de la 0542 (:7-9)** dice que, sin la migración, el superadmin ve «no eres superadministrador». Con esta PR ve «No pudimos comprobar si eres superadministrador…», porque la RPC da 403.

**Por qué nadie lo vio:**
- `supabase/tests/0273_skip_platform_admin_bootstrap_history.test.sql:260` afirma el EXECUTE, pero repasa solo el texto de la 0058, sin la 0211.
- Los fixtures de 0538, 0539 y 0540 hacen `grant execute … to authenticated` por su cuenta (por ejemplo, `0540_comercial_rls_por_modulo.test.sql:80`). Es un fixture feliz.
- Ningún gate mide el ACL final de las RPC.

**Efectos, leídos en el código:**
- `platformAdminDenial` niega siempre.
- `requireModuleView` y `moduleViewDenial` de `rbac-guard.ts` (:168-200 y :244) niegan los `SUPERADMIN_ONLY_MODULES`.
- La policy `feature_flags_platform_admin_update` lanza «permission denied for function» para authenticated (contrato, caso (0)). Pero el bloqueo efectivo de los flags es `platformAdminDenial`: la escritura real va por `audit_d1_execute` (0289:632-650), DEFINER, que la policy no alcanza.
- Las seis policies de la 0356 sobre `legal_docs`, `renditions` y `rendition_receipts` revientan igual para authenticated. Con la 0542, el superadmin que además sea admin del tenant puede escribirlas, que es lo que quería la 0356. Está en el smoke de la spec §6.
- **Lo que no cambia:** `studio_set_user_disabled` y `studio_change_user_role` (0355) y `studio_grant_user_module` (0538) son DEFINER de postgres. Llaman a la función como dueño y **no** dependen de este grant. En esos tres el único efecto es el de la server action.

## Pruebas

| Comprobación | Resultado |
|---|---|
| `docs:index` / `docs:check` (node directo) | PASÓ (618 specs) |
| `sdd:check` (node directo) | PASÓ (sin números repetidos) |
| `pending-migration-symbols` (node directo) | PASÓ: 0 ROJO · 3 AMARILLO declarados (antes de corregir las líneas: FALLÓ por las citas corridas, ya arreglado) |
| `migrations-lock` (node directo) | PASÓ: 0542 en espera sin sellar, 0 nuevas sin sellar |
| Contrato 0542 en PGlite, control rojo, 7 mutantes y barrido (`is-platform-admin-grant.migration.test.ts`, 11 casos) | PASÓ (vitest 4.1.7, 2026-11-15, con turno del Subdirector) |
| Pruebas de acción y UI: `aviso-superadmin.test.tsx` (8) y `suspender-admin-superadmin.test.ts` (10) | PASÓ. Las 3 juntas: 29/29, exit 0, 18 s |
| `pnpm verify` | NO EJECUTADO, por orden del DG (2026-11-15, relayada por el Subdirector): la memoria de la PC está justa. El portón es el CI de GitHub más la revisión independiente que lanza el DG |
| `sql-tests` (Postgres 17) | Lo corre el CI (`sql-tests.yml`, que se dispara por `supabase/tests/**` y `supabase/migrations/**`) |

## Pendientes de esta tarea

- El vitest de los 3 archivos ya corrió: 29/29. `pnpm verify` no se corre en la PC, por decisión del DG; el portón es el CI.
- `/ui-check` (2026-11-15): OK para commit. Una media: la tarjeta, que ya existía, usa `var(--font-sans, 'Archivo')` y px fuera de escala (`FeatureFlagsClient.tsx:235-245`), y va a FUERA DE ALCANCE. Una baja: el aviso no se puede cerrar a mano, y es aceptable por `role="alert"`.
- `/ui-check` del ajuste de la revisión (2026-11-15): el aviso pasa a cuerpo neutro (`var(--ink)`) con el rojo solo en el borde superior (`2px solid var(--danger)`), como pide BRAND para un error. OK para commit.
- **La aplicación en producción la hace el DG:** con el OK nominal de Sam, el paquete `preparar.mjs` sobre la cabeza final, la lectura previa y después la fusión. La previa va a decir que la 0542 no crea funciones, así que no hay deriva que medir. El preflight propio compara el cuerpo vivo.

## FUERA DE ALCANCE DETECTADO

1. **ALTO · `audit_d1_execute` deja que cualquier admin del tenant encienda o apague módulos por PostgREST.**
   - **Dónde:** `0289_audit_d1_access_configuration.sql`.
     - La función es DEFINER de postgres (:930-935) y tiene `grant execute … to authenticated`.
     - La rama `feature_flag.toggle` (:632-655) solo exige `audit_d1_admin_tenant()` (:132-160), que pide rol admin del tenant.
   - **Por qué la policy no la frena:** escribe como dueño y `feature_flags` no tiene `FORCE ROW LEVEL SECURITY` (0042:37), así que la policy de la 0355 no la alcanza. Un admin que no es superadmin puede llamar `rpc('audit_d1_execute', {p_operation_type:'feature_flag.toggle', …})` sin pasar por `platformAdminDenial`.
   - **Lo que no se hizo:** el arreglo es redefinir `audit_d1_execute`, unas 800 líneas, con su preflight de deriva, o sacar esa rama a una RPC propia que exija `is_platform_admin()`. No entra aquí: es otra migración con su propio ensayo y su propio OK.
   - **Cómo se sabe:** leído en el código, no ejecutado.
   - **Lo que no empeora la 0542:** ese hueco ya está abierto hoy.
2. **MEDIO · Un contrato que mida el ACL final de todas las RPC después del replay completo.** Hoy cada fixture concede por su cuenta, y la deriva de la 0211 pasó por todos.
3. **BAJO · La prueba de la 0273** afirma el EXECUTE sobre un replay parcial. Habría que aclararlo en su comentario, porque se lee como cobertura del estado final.
4. **BAJO · La 0355 trae un correo literal** en un `raise notice` y en una búsqueda (0355:~110-125). Ya está en main y es anterior a esta tarea. Se anota por la regla de no tener PII en Git, sin copiarlo aquí.
5. **BAJO · Tipografía de la tarjeta de feature flags** (`FeatureFlagsClient.tsx`, toda la tarjeta): usa `var(--font-sans, 'Archivo')` y tamaños en px fuera de la escala, en lugar de `var(--f-sans)` del Studio. Viene de antes; lo señaló el `/ui-check` de esta tarea.

## Impacto documental

- La spec 0633 es nueva. Solo cambia el índice de specs, que es generado.
- No toca el runbook de migraciones: la 0542 sigue el camino normal.
