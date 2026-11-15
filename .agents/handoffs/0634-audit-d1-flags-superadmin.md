# Handoff · SDD-0634 · Feature flags: el superadministrador por cualquier camino

- **Worker:** 10.5 (E10). Lo encargó el Subdirector Chatwoot, autorizado por el DG, con prioridad alta.
- **Rama:** `codex/audit-d1-flags-superadmin`, en el worktree `DTD-worktrees/audit-d1-flags-superadmin`, desde `origin/main` `42daa3d2c` (con la #574 ya integrada).
- **Reservas:**
  - **La SDD-0634:** el stub `f6d830093` está en `codex/sdd-reserve-0634-audit-d1-flags-superadmin` y en `refs/dtd/reservations/0634`. La publicación fue create-only en `origin/codex/sdd-reserve-0634`.
  - **La migración 0543:** la medí libre con `sdd:next` (1030 refs y worktrees), en todas las refs remotas y `refs/dtd`, y en los archivos de las PR abiertas.
- **SDD nueva:** el arreglo es una migración propia, con su orden (después de la 0542), su espera y su registro de aplicación. Enmendar la 0633, ya fusionada, mezclaría dos aplicaciones distintas.

## Qué cambió

1. **La migración `supabase/migrations/0543_feature_flags_exige_superadmin.sql`:**
   - Crea `public.feature_flags_exige_superadmin()` (DEFINER, sin EXECUTE para nadie) y su disparador BEFORE UPDATE FOR EACH ROW en `feature_flags`.
   - **La regla, con las 5 condiciones del DG (2026-11-15):**
     - La sesión se detecta por los claims del JWT (`request.jwt.claims` y la forma antigua), no por `current_user`: service_role o sin claims pasa; anon se niega siempre; cualquier otra sesión exige `is_platform_admin()`.
     - El disparador queda ENABLE ALWAYS.
     - INSERT y DELETE no se cubren: el preflight exige que authenticated y anon no tengan INSERT, DELETE ni TRUNCATE sobre la tabla (detalle en la spec §2).
     - El postflight mide el disparador ALWAYS, la función DEFINER de postgres con `search_path` vacío y sin EXECUTE para nadie, y los ACL sin cambios.
   - No reemplaza `audit_d1_execute`. El porqué está en la spec §2.
   - **El preflight y el postflight:** el preflight guarda el ACL de `audit_d1_execute` y el de `is_platform_admin()`, y el postflight los exige iguales. Es la lección de la 0542.
   - **La espera:** está declarada en `migrations-baseline.json`.
2. **El contrato:**
   - `supabase/tests/0543_….test.sql`, de 25 aserciones, más su envoltorio PGlite `lib/studio/__tests__/feature-flags-superadmin.migration.test.ts`.
   - Ese envoltorio trae 3 anti-drift contra la 0289, el control rojo, 13 mutantes de la migración (los (a) a (e) del DG y los del postflight) y 3 del preflight.
   - **El primer intento de la focal salió rojo, 3 de 22.** Tres mutantes caían en otra aserción que la esperada: el bloque (d) no capturaba su error, y dos mutantes del preflight rompían el fixture antes del bloque (0). Se arregló sin relajar ningún regex, y no se publicó.
3. **La server action** (`feature-flags/actions.ts`): `permission_denied` del guardado se convierte en `SUPERADMIN_DENIAL`, el aviso de la #574. Tiene su caso en `aviso-superadmin.test.tsx`, y el mock del adaptador D1 ahora conserva `D1OperationError`.
4. **Los comentarios** de `feature-flags/actions.ts` y `lib/studio/platform-admin.ts` nombran el disparador como control real.

## Revisión de las otras ramas

La tabla completa está en la spec §4.
- **`membership.role_change` y la suspensión** ya están cubiertas por `studio_change_user_role` y `studio_set_user_disabled` (0355), que exigen superadmin para tocar a otro admin.
- **Las demás ramas** son de admin por decisión de la 0355.
- **`membership.invite`** queda abierta (ver abajo).

## Pruebas

| Comprobación | Resultado |
|---|---|
| `docs:check` y `sdd:check` (node directo) | PASÓ: 619 specs, sin números repetidos |
| `pending-migration-symbols` (node directo) | PASÓ: 0 ROJO · 3 AMARILLO declarados. La 0543 no crea símbolos que use el código |
| `migrations-lock` (node directo) | PASÓ: la 0543 está en espera sin sellar, y hay 0 nuevas sin sellar |
| La focal (2026-11-15, con turno del Subdirector): `feature-flags-superadmin.migration.test.ts` y `aviso-superadmin.test.tsx` | PASÓ: 29/29, exit 0, 12 s (20 + 9 casos). El primer intento, sobre el diseño anterior, dio 19/22 y no se publicó |
| `pnpm verify` | NO EJECUTADO, por orden del DG: el portón es el CI de GitHub más la revisión independiente |
| `sql-tests` (Postgres 17) | Lo corre el CI (`sql-tests.yml`) |

## Pendientes de esta tarea

- La focal ya corrió: 29/29.
- Publicar la rama y abrir la PR. Reportar la cabeza.
- **La aplicación la hace el DG:** con OK nominal de Sam, `preparar.mjs` sobre la cabeza final y la lectura previa. La migración no reemplaza funciones existentes, así que no hay deriva que medir. Después se fusiona, y se hace el smoke de la spec §8.

## FUERA DE ALCANCE DETECTADO

1. **MEDIO · Invitar como admin sin ser superadmin.**
   - **Dónde:** la rama `membership.invite` de `audit_d1_execute` (0289:240) llama a `studio_invite_user` (0203:65-79), que solo exige que quien invita sea admin del tenant.
   - **El efecto:** un admin puede «fabricarse aliados» invitando a alguien como admin, que es justo lo que la 0355 cerró para el cambio de rol (0355:244-252).
   - **Por qué no entra:** la 0355 no lo listó como llave, y decidirlo es del founder.
   - **Cómo se sabe:** leído en el código, no ejecutado.
2. **BAJO · El baseline todavía declara la espera de la 0542,** que ya se aplicó el 2026-11-15 a las 08:09Z. Retirarla y sellarla es parte del cierre del runbook de quien la aplicó, no de esta PR.
3. **BAJO · `feature_flags` no tiene FORCE ROW LEVEL SECURITY** (0042:37). Cualquier DEFINER de postgres que escriba en una tabla con policies se salta esas policies. Con la 0543 los flags no dependen de eso, pero el patrón se repite en otras tablas: vale una auditoría de los DEFINER que escriben tablas «con candado de policy».

## Impacto documental

- La spec 0634 es nueva y el índice se regenera.
- No toca el runbook: la 0543 sigue el camino normal.
