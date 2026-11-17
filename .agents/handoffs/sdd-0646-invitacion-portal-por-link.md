# Handoff — SDD-0646, invitación al portal por link

Fecha: 2026-11-16. Task ID: `sdd-0646-invitacion-portal-por-link`.
Owner / sesión escritora: `local-0646-worker` (Worker Claude Code, lanzado por el DG `local_25e2dded…`). Sin subagentes.

- **Worktree:** `.claude/worktrees/0646-invitacion-por-link-475356`; `guard` y `claim --owner local-0646-worker` PASARON antes de editar y se revalidaron antes de cada commit.
- **Rama:** `claude/0646-invitacion-por-link-475356`, base `cb199c4a7` (main del 2026-11-16).
- **SDD:** `docs/specs/0646-invitacion-portal-por-link/spec.md`, en `in-progress`. Reservada con `node scripts/next-number.mjs --number 0646 --reserve invitacion-portal-por-link`, que dejó las refs `codex/sdd-reserve-0646-invitacion-portal-por-link` y `refs/dtd/reservations/0646`, ambas locales; la incorporé por cherry-pick. El DG la confirmó.
- **Migración:** `0552_registro_portal_por_link`, confirmada por el DG. La 0551 está en reasignar-embarque y la 0553 en la sesión de CRM (SDD-0647). **NO APLICADA.**

## OBJETIVO ORIGINAL

Los 361 clientes del legado (DTD-8001…8361) no tienen correo ni acceso al portal. Desde la ficha, el equipo genera un link de registro y lo manda por WhatsApp. El cliente completa SU ficha con su código fijo y entra a su portal. El equipo revisa qué cambió. Además, el código real se puede escribir a mano en el alta, y un cliente puede recuperar su propio código retirado.

## COMPLETADO

- **Migración 0552.**
  - Tabla `client_registration_links`: hash sha256 del token, un solo uso, 14 días, un solo link vivo por cliente, antes y después, duplicado, `rif_skipped` y `access_error`.
  - RPC `create` / `mark_reviewed` para el equipo; `peek` / `complete` / `bind` / `access_error` solo para `service_role`.
  - `find_duplicate_client_except_service`, a la que `find_duplicate_client_service` llama con el mismo resultado de antes.
  - Trigger `clients_guard_markbox_retirado_t` en INSERT.
  - `rename_client_markbox` recupera el código retirado propio.
  - Preflight por md5 de los dos cuerpos que reemplaza (0371 `ed233ed2…`, 0342 `61d5707d…`).
  - Desarme en `supabase/desarmes/0552_desarme.sql`.
  - Entradas en `migrations-baseline.json` y `pending-migration-symbol-declarations.json`.
- **Página pública `/registro/link/[token]`.**
  - El GET solo lee y no se indexa; el Shipping Mark sale de la base y se muestra congelado.
  - El POST valida con `validateRegisterInput`, completa la ficha existente (sin `next_markbox_service` ni insert), crea la cuenta con contraseña aleatoria, vincula `client_users` y devuelve un magic-link de un clic.
  - Muestra el mensaje final pedido.
- **Studio.**
  - «Generar link de registro» en `PortalAccessCard`: link copiable y botón de WhatsApp. Aparece aunque la ficha no tenga correo.
  - Shipping Mark opcional en «Nuevo cliente». Si el código es el retirado de otra ficha, manda a recuperarlo ahí.
  - Pantalla «Registros por link» (`/studio/clientes/registros-link`, menú Mantenimiento): antes y después, avisos de duplicado / cédula no copiada / acceso fallido, y «Marcar comprobado».
- **Pruebas.**
  - Contrato SQL `supabase/tests/0552_registro_portal_por_link.test.sql`.
  - Envoltorio PGlite con control rojo, 7 mutantes y prueba del desarme.
  - Vitest de las acciones pública y del Studio, y de token/URL/textos.
  - e2e de la cara pública sin base.
- `/ui-check` corrido: tres ajustes aplicados (foco al primer error, tokens de espaciado, tabla con scroll).

## VALIDACIÓN

`pnpm verify` completo sobre `fe1b8bcf9`: **FALLÓ** en `test` y `docs:check`; 14 de 17 pasos se midieron.

| Comprobación | Resultado |
|---|---|
| harness, lint, rsc-boundary, typecheck, edge-functions, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 rojo · 2 amarillo declarados), build | PASÓ |
| e2e | PASÓ con aviso: 241 pasaron, 3 flaky, ninguno falló; el worker de WebKit no cierra en Windows |
| test | FALLÓ (10 casos), ver abajo |
| docs:check | FALLÓ: índice desactualizado → regenerado; ahora PASÓ |
| migrations-applied | NO EJECUTADO: el worktree no tiene `.env.local`, a propósito |
| sql-tests, schema-rebuild | NO DISPONIBLE: sin Docker. El contrato de la 0552 se corrió en PGlite: **12/12 PASÓ** |

Fallos de `test`, uno por uno:

- **Míos, corregidos en `71802d25f`:**
  - `rbac-actions-guard` (inventario 472 → 474, por dos acciones nuevas con su justificación).
  - `spec-migration-refs` (la spec citaba el archivo del desarme por nombre).
- **Timeouts por carga** (el DG avisó que otra sesión corrió vitest a la vez):
  - `seo-auditoria-json-ld`, `solo-superadmin-crea-admin.migration`, `conservar-lo-escrito`: repetidas solas con `--maxWorkers=2`, **PASÓ** (5 archivos, 554 pruebas).
  - `infra/ops/tests/migraciones.test.mjs` y `scripts/__tests__/entorno-prueba-scripts.test.mjs`: repetidas solas, **PASÓ** (32 pruebas, 425 s).
- Una corrida anterior de las suites vecinas tuvo 23 forks que no arrancaron por la misma carga. Repetida con `--maxWorkers=3`: **PASÓ** (108 archivos, 1446 pruebas).

Hallazgo del contrato: sin duplicado, `rif_skipped` quedaba en NULL y rompía el NOT NULL. Corregido con `coalesce` en `0cbfbc698`, y quedó un mutante que lo vigila. El mutante «copia la cédula de otra ficha» es **equivalente**: el índice único lo ataja y el respaldo da el mismo resultado. Se reemplazó por uno que rompe el respaldo.

## COMMITS

`4523411c0` reserva · `5a4533800` spec · `2d35dd7b6` migración + contrato · `49dc7cb06` página pública · `560d922d5` Studio · `a585dea21` declaraciones del gate · `0cbfbc698` fix `rif_skipped` / fixture / desarme · `3c25617ae` tipo explícito · `fe1b8bcf9` ajustes de /ui-check · `71802d25f` inventario RBAC, cita e índice.

## PR / BRANCH

Rama `claude/0646-invitacion-por-link-475356`; la PR se registra abajo al abrirla. No fusioné ni apliqué nada en producción.

## PENDIENTES DE ESTA TAREA

- Revisión independiente (la lanza el DG) y el CI de la PR.
- Aplicar la 0552 en producción: OK nominal de Sam por el DG y el [runbook](../../docs/runbooks/aplicar-migraciones-prod.md). Antes, comparar los md5 vivos de `rename_client_markbox` y `find_duplicate_client_service` con los del preflight.
- Smoke con sesión real después de aplicar. Como `operations`:
  - generar el link en una ficha del legado sin correo;
  - abrirlo en otro navegador, completar y entrar al portal;
  - verlo en «Registros por link» y marcarlo comprobado;
  - recuperar el código viejo de una ficha 8xxx con «Cambiar Shipping Mark»;
  - crear un cliente con su código escrito a mano.
- **Decisión de Sam (privacidad, spec §5):** cuánto se conservan las copias `prev_data`/`submitted_data` después de «comprobado». Propuesta: 90 días. Hoy no hay flujo de supresión que las alcance.

## FUERA DE ALCANCE DETECTADO

- `next_markbox` hace max()+1: un código `DTD-9xxx` escrito a mano por encima del correlativo lo adelanta. No es un problema con los códigos del legado, que no tienen ese formato. Si se quiere, la UI podría advertirlo.
- El e2e del camino feliz necesita una base con la 0552 y Auth. Hoy el arnés no levanta Supabase para el e2e.

## HANDOFF AL DIRECTOR

- Impacto documental: spec nueva; índice de specs regenerado.
- `RegisterForm.tsx` solo cambió `export` en seis campos.
- La página pública sigue el patrón de `app/registro`: admin client y token como control.
- La acción importa `generatePortalAccessLink` de `@/lib/studio`, igual que `app/entrar`. La página y el formulario no importan `@/lib/studio`.
