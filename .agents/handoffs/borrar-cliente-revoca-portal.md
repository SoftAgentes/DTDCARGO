# Handoff — borrar-cliente-revoca-portal (SDD-0467, migración 0454)

- **Fecha:** 2026-09-14
- **Owner / sesión:** worker-borrar-cliente-revoca-portal-20260914 (Claude Code, subagente Worker)
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/borrar-cliente-revoca-portal`
- **Rama:** `codex/borrar-cliente-revoca-portal`
- **Base:** `origin/main` 2b1d7d84. Luego, a pedido del Director, se fusionó `origin/main` 08af6abc
  (PR #119, SDD-0468) en `6446288a`.
- **Reserva SDD:** cherry-pick de 7690b674 (`codex/sdd-reserve-0467-borrar-cliente-revoca-portal`),
  incorporado como 9124411f.
- **Estado de la tarea:** lista-para-revision.
- **Estado SDD:** in-progress (ver HANDOFF AL DIRECTOR).

## Contrato de la tarea

**Objetivo.** Al borrar un cliente en el Studio (borrado lógico), su acceso al Portal se revoca en
el mismo acto: su vínculo en `client_users` queda revocado y ningún enlace corto pendiente en
`portal_access_links` sirve. Decisión de Sam del 2026-09-14, textual: «borrar un cliente: debe
revocar el acceso. Así debe ser.»

**SDD.** `docs/specs/0467-borrar-cliente-revoca-portal/spec.md`. Migración asignada: 0454.

**Aceptación.** Los siete criterios del encargo, copiados en la spec (§ Aceptación).

**Alcance.**
- La migración y el contrato 0454.
- La espera en `supabase/migrations-baseline.json`.
- La declaración de símbolos, sólo si su gate la exige.
- `app/studio/(app)/clientes/actions.ts`, el texto de `ClientDrawer.tsx` y sus tests.
- `lib/studio/portal/access-link.ts`, sólo si el canje no rechaza clientes borrados.
- La spec 0467 y el índice regenerado.
- `docs/legal/privacidad/mapa-de-borrado.md`.
- Este handoff.

**Excluidos.**
- Aplicar migraciones, leer producción o revocar a mano el vínculo huérfano.
- 0414, 0415, 0422, 0423 y sus esperas.
- Los archivos de la PR #114 y del rediseño del enlace del proveedor (SDD-0468).
- Las helpers con `limit 1`.
- Rehacer `merge_clients` más allá del contrato.

**Permisos.** Commits locales selectivos, push de la rama propia y PR draft contra main. Sin merge,
deploy, migraciones, lectura de producción ni borrado de ramas o worktrees.

## OBJETIVO ORIGINAL

Que todo borrado lógico de un cliente (acción del Studio o `merge_clients`) revoque en la misma
transacción su acceso al Portal: vínculos de `client_users` revocados del todo y cero códigos
cortos utilizables.
- Si la revocación falla, el borrado no ocurre y el Studio muestra el error.
- `portal_bind_session()` y el canje no reabren el acceso, y restaurar la ficha tampoco.
- La confirmación del drawer avisa la consecuencia.

## COMPLETADO

- **Migración** `supabase/migrations/0454_borrar_cliente_revoca_portal.sql`:
  - Trigger AFTER UPDATE `clients_revoke_portal_on_soft_delete`: revoca todo `client_users` del
    cliente (con `revoked_at`, sin `auth_user_id` ni `token`) y todos sus `portal_access_links`.
  - Guardas BEFORE `client_users_require_live_client` y `portal_access_links_require_live_client`:
    rechazan con 23514 cualquier acceso vigente sobre un cliente inexistente o borrado. Toman
    `FOR SHARE` en INSERT o cambio de `client_id`.
  - Dos funciones SECURITY DEFINER con `search_path` vacío y `revoke all` para `public`, `anon`,
    `authenticated` y `service_role`.
  - Backfill idempotente con conteos agregados y motivo D5.
  - Preflight que falla cerrado: orden de `merge_clients`, forma de `portal_bind_session`, CHECK
    de status, D5, triggers propios y huella.
  - Postflight: forma final, huella intacta e invariante en cero.
  - No redefine `merge_clients` ni ninguna RPC, policy ni ACL.
- **Contrato** `supabase/tests/0454_borrar_cliente_revoca_portal.test.sql`, 73 aserciones: RED,
  estático, 10 casos de drift, postflight, aplicada y reaplicada, backfill y comportamiento
  completo.
- **Espera 0454** en `supabase/migrations-baseline.json`, con el `cutoff` 238 y las otras cuatro
  esperas intactas.
- **`softDeleteClientAction`:** si falla, devuelve un error que no promete un borrado a medias,
  registra el mensaje crudo y no revalida.
- **`ClientDrawer.tsx`:** la confirmación dice «¿Seguro? El cliente pierde su acceso al Portal.».
  Tests nuevos de la acción y del drawer.
- **`lib/studio/portal/access-link.ts` sin cambios:** el canje ya rechaza clientes borrados por
  `loadAccessTarget` (`access-link.ts:229-242`), que usan `app/entrar/[code]/actions.ts:52-53` y
  `page.tsx:71`.
- **Documentación:** spec 0467 completa (diseño, evidencia, `revisar-datos-ve`, gobernanza,
  allowlist exacta, aceptación y producción), índice regenerado y mapa de borrado §10.
- **Criterios de aceptación, todos cumplidos en local:**
  1. **Trigger:** el contrato cubre el borrado del Studio y los dos caminos de `merge_clients`.
  2. **Fallo atómico:** lo prueban el contrato y el vitest del error en el drawer.
  3. **`merge_clients`:** el acceso mudado sigue activo; el duplicado queda revocado del todo y la
     persona se vincula a otra ficha.
  4. **Sin reapertura:** `portal_bind_session()` no activa ni reconoce, el sellado del código no
     encuentra fila, restaurar no reactiva y una invitación nueva sí.
  5. **Migración y contrato:** migración, espera y contrato, con control rojo, 35 mutantes y 4
     carreras.
  6. **Confirmación:** texto del drawer y su test.
  7. **Documentación:** mapa de borrado §10 y spec con allowlist y `revisar-datos-ve`.

## VALIDACIÓN

Código validado en `e4c3b736` y, tras fusionar main, en `6446288a`. El commit que contiene este
documento sólo agrega el handoff.

**Contrato 0454, mutantes y carreras** (PostgreSQL 17 en Docker 29.7.2, datos sintéticos)

| Comprobación | Resultado |
|---|---|
| Contrato `0454_borrar_cliente_revoca_portal.test.sql`, corredor focal equivalente a `run-sql-tests` | PASÓ, 73 aserciones |
| El mismo contrato con `-v apply_fix=false` (control rojo) | FALLÓ como se espera, en «Backfill: el vínculo activo, el invitado y el revocado a medias…» |
| 35 mutantes y 2 controles sobre una copia de `supabase/` (sha256 verificado) | 34 muertos en una sesión y los dos controles VERDES. «guarda INSERT sin FOR SHARE» sobrevive en una sesión y muere en las carreras 1 y 4. «search_path public» murió primero por un defecto del corredor (`$$` en `String.replace`); se repitió corregido y murió por la causa correcta |
| 4 carreras de dos sesiones sobre el original y sobre el mutante sin FOR SHARE | PASÓ. Original sin interbloqueos e invariante 0; mutante con invariante 1 |
| Contención con `lock_timeout` | PASÓ. Corte a los 5,3 s, sin triggers ni funciones, sesión restaurada |
| Contratos vecinos 0341, 0358, 0360, 0293 y 0453 | PASÓ. No existe `0080_*.test.sql`: 0080 lo aplican 0453 y los contratos de frontera del Portal |

**Pruebas focales y gates antes de commitear**

| Comprobación | Resultado |
|---|---|
| `corepack pnpm exec vitest run` de los dos tests nuevos | PASÓ, 7 tests |
| `eslint` de los 4 archivos TS tocados | PASÓ |
| `corepack pnpm typecheck` | PASÓ |
| `check-numbering`, `check-pending-migration-symbols` (0 ROJO · 0 AMARILLO), `docs:index` + `--check`, `sdd:check` | PASÓ, en `e4c3b736` y de nuevo tras el merge (456 specs) |

**`corepack pnpm verify` completo en `e4c3b736`**

| Paso | Resultado |
|---|---|
| harness | PASÓ, 98 tests |
| lint, rsc-boundary, typecheck, edge-functions | PASÓ |
| test | PASÓ, 560 archivos, 7263 tests |
| docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols | PASÓ |
| sql-tests | PASÓ, 195 contratos, 0454 incluido |
| schema-rebuild | PASÓ, 433 migraciones desde cero, 0454 incluida, más 18 que sólo tocan el ledger |
| migrations-applied | NO DISPONIBLE. El worktree no tiene `.env.local` y no se copian credenciales |
| e2e | FALLÓ por entorno. Primer intento con 15 rojos en `auth.spec.ts` y `global-search.spec.ts`: `proxy.ts:67` lanza «Your project's URL and Key are required» sin variables de Supabase. El reintento quedó sin salida y lo cortó el watchdog («COLGADO/TIMEOUT: sin salida durante 10 min»; 25 procesos del árbol propio, 0 sobrevivientes) |
| build | FALLÓ por entorno. 212 errores, todos de `next/font/google` en `app/layout.tsx` (woff2 de Noto CJK no descargados) |

**`VERIFY_SKIP_E2E=1 corepack pnpm verify` en `6446288a`, tras el merge**

| Paso | Resultado |
|---|---|
| 15 pasos de código | PASÓ, igual que arriba |
| migrations-applied | NO DISPONIBLE, mismo motivo |
| e2e | NO EJECUTADO. Omitido a propósito: ya falló por entorno en `e4c3b736` y la PR #119 no toca las rutas de esos specs |
| build | FALLÓ por entorno. 64 errores, todos de fuentes en `app/layout.tsx` |
| `node scripts/check-build.mjs`, un reintento | FALLÓ por entorno. 76 errores, todos de fuentes en `app/layout.tsx` |

**Diagnóstico del build**
- En las tres corridas, el 100 % de las trazas apunta a `./app/layout.tsx` y ninguna menciona
  Clientes ni `"use server"`.
- El número de recursos fallidos cambia entre corridas.
- Uno de los woff2 fallidos, bajado a mano, responde HTTP 200 en 0,6 s.
- Conclusión: red intermitente durante la descarga concurrente de fuentes.
- La única regla de build que este cambio podría romper no la cubre `tsc`: un archivo
  `"use server"` sólo puede exportar funciones async. Se comprobó por grep que `actions.ts` sólo
  exporta funciones async; la constante del mensaje no se exporta.
- **Queda sin build local verde.** La evidencia de build la dará el CI o el build de Vercel de la
  PR.

## COMMITS

- `9124411f` chore(sdd): reserva SDD-0467 (cherry-pick de la reserva del Director)
- `c90152a8` docs(handoff): contrato de la tarea
- `f6d9ed6c` feat(studio): la 0454 revoca el acceso al Portal al borrar un cliente (migración,
  contrato y espera)
- `88144707` feat(studio): el borrado de un cliente avisa que pierde el Portal (acción, drawer y
  tests)
- `e4c3b736` docs(studio): spec, índice y mapa de borrado
- `6446288a` merge de `origin/main` 08af6abc (PR #119). El índice lo resolvió el driver
  `dtd-generated-records` y la regeneración no dejó diff
- Commit que contiene este documento: cierre del handoff (hash final en la PR)

## PR / BRANCH

- **PR:** draft contra `main`, creada al publicar esta rama. La URL figura en la PR y en la
  respuesta al Director.
- **Base:** `main` (`08af6abc` fusionado en la rama).
- **Rama:** `codex/borrar-cliente-revoca-portal`.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/borrar-cliente-revoca-portal`.

## PENDIENTES DE ESTA TAREA

- **Build verde:** el local no se pudo obtener por la red de fuentes. Hay que confirmarlo en el
  CI o en el build de Vercel de la PR. Si ahí falla por algo que no sean fuentes, vuelve a esta
  tarea.
- **e2e y `migrations-applied`:** sin medir en local por falta de credenciales. Lo mide el CI o
  el Director con un entorno que las tenga.
- **Estado SDD:** pasa de `in-progress` a `done` cuando el Director acepte la PR con el build
  confirmado.
- **Release** (fuera de la autoridad del Worker): aplicar `0454_borrar_cliente_revoca_portal` con
  OK nominal de Sam, con la lectura previa de catálogo y el postflight de la spec (§ Producción),
  y hacer el smoke de borrar un cliente de prueba con acceso.

## FUERA DE ALCANCE DETECTADO

1. **MP-01 y SGE-00.03, no conformidad preexistente.** MP-01 clasifica a los clientes como
   maestros P1/R2: ConfirmDialog con el nombre del registro y la consecuencia, y restauración. El
   drawer usa una confirmación inline (bloque `confirmDelete` de `ClientDrawer.tsx`) y no hay
   restauración en la UI. Esta tarea sólo agregó la consecuencia al texto.
2. **AUD-01 §2 «eliminar», no conformidad preexistente.** El borrado lógico del cliente
   (`clients.deleted_at`) no deja evento de auditoría: `audit_d5_clients_contact` sólo mira
   `email` y `phone` (`0293:517`). La revocación del acceso sí queda auditada.
3. **Retención sin fundamento.** La fila revocada de `client_users` conserva `email`,
   `invited_at`, `bound_at` y `last_login_at` (`0080_portal_cliente.sql:17-26`) sin plazo. Queda
   en 🔴 en el mapa de borrado §10; decide la revisión legal.
4. **`softDeleteClientAction` no detecta cero filas.** Si RLS o el Shipping Mark no alcanzan
   ninguna fila, igual devuelve `ok`. No se cambió: agregar `RETURNING` altera la evaluación de
   RLS y el contrato no lo exigía.
5. **Diseño de concurrencia frágil ante cambios.** Si alguien agrega `FOR SHARE` en la rama
   UPDATE de la guarda, una activación y un borrado simultáneos se interbloquean. Está
   documentado en la spec (§ Concurrencia).
6. **Falta un contrato SQL propio de 0080** (`supabase/tests/0080_*.test.sql`). El encargo lo
   nombraba; hoy 0080 se ejercita en 0453, 0454 y los contratos de frontera del Portal.
7. **Entorno de esta máquina.**
   - Sin `.env.local`, e2e falla en `proxy.ts:67` en vez de omitirse, y su reintento se cuelga
     hasta el watchdog.
   - El build de Turbopack pierde fuentes de Google de forma intermitente.
   - Docker Desktop no estaba corriendo al empezar: se lanzó desde
     `%LOCALAPPDATA%\Programs\DockerDesktop`.

## HANDOFF AL DIRECTOR

- **Siguiente acción:**
  - revisar la PR draft: diff completo, allowlist de la spec, contrato y evidencia;
  - confirmar que el build del CI o de Vercel salga verde;
  - decidir la integración y, por separado, la aplicación de la 0454 con OK nominal de Sam.
- **Cambios compartidos:**
  - `supabase/migrations-baseline.json`: espera nueva al final, sin tocar 0414, 0415, 0422 ni 0423.
  - `docs/specs/README.md`: generado. Si choca al integrar, usar el driver del repo o regenerarlo;
    nunca a mano sobre esperas ajenas.
  - `docs/architecture/module-sdd-map.md` no se tocó, así que la fila de la 0468 queda como vino de
    main.
- **Dependencias:** ninguna. La 0414 es coherente con esta tarea.
- **Orden de release:** la migración no depende del despliegue. La app nueva sólo mejora el mensaje
  y el aviso, así que puede ir antes o después.
- **Contención con SDD-0468:** no hubo. Su PR se fusionó durante esta tarea y no apareció ningún
  contenedor ajeno mientras corría `verify`.
- **Sesiones consumidoras del worktree:** ninguna además de esta. El claim se libera al publicar.
