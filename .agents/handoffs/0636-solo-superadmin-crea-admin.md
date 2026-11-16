# Handoff · SDD-0636 · Política de roles: solo el superadministrador crea administradores

- **Worker:** 10.5 (E10). Lo encargó el Subdirector Chatwoot, por decisión del DG y de Sam (2026-11-15).
- **Rama:** `codex/superadmin-crea-admin`, en el worktree `DTD-worktrees/superadmin-crea-admin`, desde `origin/main` `bd873493e` (contiene la #583).
- **Reservas:**
  - **La SDD-0636:** el stub `2ec1e6982` está en `codex/sdd-reserve-0636-solo-superadmin-crea-admin` y en `refs/dtd/reservations/0636`, publicado en `origin/codex/sdd-reserve-0636`.
  - **La migración 0545:** `sdd:next` la dio libre (1039 refs y worktrees).

## Qué cambió

1. **La migración `supabase/migrations/0545_solo_superadmin_crea_admin.sql`** (detalle en la spec §2):
   - `user_invitations_exige_superadmin`: BEFORE INSERT OR UPDATE OF role, ENABLE ALWAYS. Una invitación con rol admin exige `is_platform_admin()`.
   - `user_tenants_exige_superadmin`: BEFORE INSERT OR UPDATE, ENABLE ALWAYS. Quedar admin viniendo de no serlo, o volver activo siendo admin, exige `is_platform_admin()`. La excepción es para el invitado que acepta una invitación vigente de admin emitida por un superadministrador.
   - `user_tenants_audit_alta`: AFTER INSERT, escribe el alta en `user_role_audit`.
   - La invitación con sesión pasa por una sola vía, auditada (`audit_d1_execute`). La función interna `studio_invite_user` no se expone directamente.
   - La sesión se detecta por los claims del JWT, como en la 0543.
   - El preflight guarda el ACL de `audit_d1_execute`, `is_platform_admin()` y `studio_accept_invitation`, y el postflight lo exige igual.
   - La espera está declarada en `migrations-baseline.json`. El desarme está en `supabase/desarmes/`.
2. **El contrato** `supabase/tests/0545_….test.sql` (47 aserciones en Postgres 17 con la 0545 real dos veces; 49 en PGlite, donde el runner agrega la vuelta del desarme «(j)», porque el control C4 del CI no copia `supabase/desarmes/`) y su envoltorio PGlite `lib/studio/__tests__/solo-superadmin-crea-admin.migration.test.ts`:
   - 8 anti-drift: seis copias literales que siguen siendo la última definición, las ramas D1, y que la app invita solo por `audit_d1_execute`. Además, el mensaje del raise.
   - El control rojo, 21 casos de mutante y 3 del preflight.
3. **La pantalla:**
   - `inviteUserAction` avisa antes con rol admin cuando la base dice que no eres superadmin. Si no se pudo preguntar, decide la base, y su 42501 sale con el mismo aviso. Otro 42501 dice que no eres admin del equipo.
   - `InviteUserDrawer` muestra un `Aviso` de atención al elegir admin, con la clave i18n `users.invite.admin_superadmin` en es-VE y zh-CN.
   - `app/invitar` rechaza antes de crear la cuenta una invitación de admin que no emitió un superadministrador.
4. **`lib/studio/user-queries.ts`:** sale `inviteUserRPC`, que no tenía uso. **`lib/studio/platform-admin.ts`:** el comentario nombra la 0545.

## Pruebas

| Comprobación | Resultado |
|---|---|
| `docs:check` (node directo) | PASÓ: 620 specs |
| `check-numbering` (node directo) | PASÓ: sin números repetidos |
| `pending-migration-symbols` (node directo) | PASÓ: 0 ROJO · 0 AMARILLO |
| `migrations-lock` (node directo) | PASÓ: 1 espera sin sellar (la 0545), 0 nuevas sin sellar |
| La focal, con turno del Subdirector (5 archivos, incluido `spec-migration-refs`) | PASÓ en la tercera corrida: 53/53, exit 0, 46 s. Por archivo: migración PGlite 35, acción de invitar 7, aviso del formulario 2, `app/invitar` 4, `spec-migration-refs` 5 |
| Primera corrida de la focal | FALLÓ 20/53: el postflight comparaba `pg_trigger.tgattr::int2[]` con un arreglo normal, pero el int2vector empieza en 0. Ahora se compara como texto. No se publicó |
| Segunda corrida de la focal | FALLÓ 1/53: el regex del mutante sin `search_path` vacío esperaba `public.` delante del nombre, y `regprocedure` lo imprime sin esquema. Se arregló solo la prueba (prefijo opcional; el resto del mensaje sigue exacto). No se publicó |
| md5 de la 0545 | `e0dba88d4e317fc8da3f9af3d295f640`, 21106 B (igual antes y después de la tercera corrida) |
| `pnpm verify` | NO EJECUTADO, por orden del DG: el portón es el CI más la revisión del DG |

## Pendientes de esta tarea

- La aplicación de la 0545 en producción: la hace el DG con OK nominal de Sam y el runbook. Antes, el conteo de solo lectura de invitaciones pendientes con rol admin, que el DG le pide a Sam.
- La revisión independiente la lanza el DG.

## Impacto documental

- La spec 0636 y este handoff. El índice `docs/specs/README.md` está regenerado.

## Seguimientos posibles (spec §8)

- **Reinvitar como admin una invitación pendiente que emitió un admin del equipo:** el superadministrador la reutiliza con el `invited_by` del admin y la aceptación falla. Por ahora: revocar e invitar de nuevo. Seguimiento: que la re-invitación registre como emisor a quien invita.
- **Las altas** quedan en `user_role_audit` pero no en la línea de tiempo de acceso de la SDD-0635.
- **Límites que se dejan anotados sin tocar el SQL:** el comentario de cabecera de la 0545 abarca más de lo que cubre, y el desarme no tiene postflight propio (lo cubre el runner PGlite).

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo en esta tarea.
