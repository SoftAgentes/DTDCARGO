# Handoff — borrar-cliente-revoca-portal (SDD-0467, migración 0454)

- **Fechas:** 2026-09-14 (ronda 1) · 2026-09-15 (ronda 2, endurecimiento pedido en la revisión de la PR #120)
- **Owner / sesión:** worker-borrar-cliente-revoca-portal-20260914 (Claude Code, subagente Worker)
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/borrar-cliente-revoca-portal`
- **Rama:** `codex/borrar-cliente-revoca-portal`
- **Base:** `origin/main` 2b1d7d84, con `origin/main` 08af6abc (PR #119) fusionado en `6446288a`
  - Reverificada con fetch antes del push de la ronda 2: `origin/main` seguía en 08af6abc.
- **Reserva SDD:** cherry-pick de 7690b674 como 9124411f
- **PR:** https://github.com/hailuwaycom-sketch/DTDCARGO/pull/120 (draft)
- **Estado de la tarea:** lista-para-revision
- **Estado SDD:** in-progress (lo decide el Director al aceptar)

## Contrato de la tarea

**Objetivo.** Al borrar un cliente en el Studio (borrado lógico), su acceso al Portal se revoca en
el mismo acto: su vínculo en `client_users` queda revocado y ningún enlace corto pendiente en
`portal_access_links` sirve. Decisión de Sam del 2026-09-14, textual: «borrar un cliente: debe
revocar el acceso. Así debe ser.»

**SDD.** `docs/specs/0467-borrar-cliente-revoca-portal/spec.md`. Migración asignada: 0454.

**Aceptación.** Los siete criterios del encargo, copiados en la spec (§ Aceptación).

**Alcance.**
- Migración y contrato 0454, y la espera en `supabase/migrations-baseline.json`.
- `app/studio/(app)/clientes/actions.ts`, el texto de `ClientDrawer.tsx` y sus tests.
- `lib/studio/portal/access-link.ts`, sólo si el canje no rechaza clientes borrados.
- La spec 0467 y el índice.
- `docs/legal/privacidad/mapa-de-borrado.md` y este handoff.

**Excluidos.**
- Aplicar migraciones o leer producción.
- Las esperas y los archivos de 0414, 0415, 0422 y 0423.
- La PR #114 y SDD-0468.
- Las helpers con `limit 1`.
- Rehacer `merge_clients`.

**Permisos.**
- Commits selectivos.
- Push de la rama propia y PR draft contra main.
- Sin merge, deploy, migraciones, lectura de producción ni borrado de ramas o worktrees.

**Encargo de la ronda 2 (Director, 2026-09-15).**
- Forma completa de los triggers en el preflight y en el postflight.
- Precondición de RLS del dueño en el preflight y en el postflight, con un caso rojo de FORCE en
  el contrato.
- FOR SHARE versionado en `$static$`.
- Opcional: mensaje honesto en `actions.ts`.
- Notas nuevas en la spec, § Producción.
- Handoff con el SHA de cada comprobación.
- Un solo push, PR en draft y sin `verify` completo.

## OBJETIVO ORIGINAL

Que todo borrado lógico de un cliente (acción del Studio o `merge_clients`) revoque en la misma
transacción su acceso al Portal: vínculos `client_users` revocados del todo y cero códigos cortos
utilizables.
- Si la revocación falla, el borrado no ocurre y el Studio muestra el error.
- `portal_bind_session()` y el canje no reabren el acceso.
- Restaurar la ficha tampoco lo devuelve.
- La confirmación del drawer avisa la consecuencia.

## COMPLETADO

### Ronda 1 (2026-09-14, hasta `5af835a5`)

- **Migración 0454:**
  - trigger AFTER UPDATE `clients_revoke_portal_on_soft_delete` y guardas BEFORE en
    `client_users` y `portal_access_links` (23514), con FOR SHARE en INSERT o cambio de
    `client_id`;
  - dos funciones SECURITY DEFINER con `search_path` vacío y sin EXECUTE para la API;
  - backfill idempotente con conteos agregados y motivo D5;
  - preflight y postflight con huella e invariante en cero;
  - no redefine RPC, policies ni ACL.
- **Contrato SQL** de 73 aserciones y **espera 0454** en el baseline.
- **Aplicación:** aviso del drawer, mensaje de error de la acción y sus tests.
- **Documentación:** spec 0467, índice y mapa de borrado §10.
- **Evidencia:** 35 mutantes, 4 carreras de dos sesiones y contención.
- **CI:** según el Director, en `5af835a5` «Calidad local sin secretos» dio SUCCESS con build de
  producción, y Vercel también SUCCESS.

### Ronda 2 (2026-09-15)

1. **Forma completa de los triggers** (`85ef8d85`):
   - El preflight de reaplicación exige, para cada uno de los tres triggers con el nombre de la
     migración: `tgenabled = 'O'`, su función y `pg_get_triggerdef` normalizado idéntico a la
     constante (evento, momento, columnas y WHEN).
   - La normalización colapsa espacios y quita el esquema de la función, que depende del
     `search_path`.
   - El postflight exige lo mismo para los tres. Antes sólo comparaban `tgtype`, `tgfoid` y
     `tgattr`.
2. **Precondición de RLS** (`85ef8d85`):
   - El preflight aborta si alguna de las tres tablas tiene `relforcerowsecurity`, aunque el rol
     tenga BYPASSRLS, por conservadurismo.
   - También aborta si el rol que aplica no es superusuario, no tiene BYPASSRLS y no es dueño de la
     tabla. La pertenencia se mide con `pg_has_role(..., 'USAGE')`, como PostgreSQL evalúa la
     exención del dueño.
   - Cada caso tiene su mensaje claro. Van antes del chequeo D5, que ya necesita leer
     `audit_entity_types`.
   - El postflight exige lo mismo sobre el `proowner` de las dos funciones, más la ausencia de
     FORCE.
   - Contrato: drift de FORCE en `portal_access_links` y drift de un rol sin BYPASSRLS que no es
     dueño, ambos antes de aplicar. Desde `ea21ad14` exigen su mensaje exacto.
   - Sondas del postflight: función con dueño sin BYPASSRLS y FORCE en `client_users`.
3. **FOR SHARE versionado** (`85ef8d85`): `$static$` exige, sobre el `prosrc` aplicado de
   `portal_access_require_live_client()` sin comentarios ni espacios, la rama
   `iftg_op='INSERT'…thenperform1…forshareofc;v_alive:=found;else`.
4. **Drift de reaplicación, contrato 3c** (`85ef8d85`): un trigger con otro WHEN en `clients` o en
   `portal_access_links`, otras columnas en `client_users` o deshabilitado aborta la reaplicación
   en el preflight. Catálogo y filas quedan intactos.
5. **Mensaje de la acción** (`0967016e`):
   - Ahora dice «No se pudo confirmar el borrado. Recarga la lista: si el cliente sigue ahí,
     conserva su acceso al Portal y puedes intentarlo de nuevo.».
   - Motivo: un fallo de red después del COMMIT también llega como error, así que el mensaje ya no
     afirma que no se borró nada.
   - Tests de la acción y del drawer al día.
6. **Espera 0454 del baseline** (`85ef8d85`). Agrega:
   - la precondición de RLS y la forma completa de los triggers;
   - la lectura previa de dueño, FORCE y BYPASSRLS;
   - los conteos esperables del NOTICE por fusiones históricas (0361:124-126);
   - la ventana entre el merge y la aplicación;
   - el deadlock posible con escrituras concurrentes.
7. **Spec** (`eacdceda`):
   - Diseño: preflight y postflight.
   - Frontera: mensaje nuevo.
   - Evidencia: 84 aserciones, filas 2b, 3, 3c y 3b, control rojo por caso y 43 mutantes.
   - Aceptación: criterio 5.
   - § Producción:
     - lectura previa con `relowner`, `relforcerowsecurity` y `rolsuper`/`rolbypassrls`;
     - NOTICE con «revocados incompletos» y códigos > 0 como esperables;
     - ventana desde el deploy del merge hasta aplicar, con recomendación de aplicar poco
       después y en baja actividad;
     - deadlock `40P01` con reintento.
   - `updated: 2026-09-15`.

**Criterios de aceptación:**
- Los siete siguen cumplidos en local.
- El 2 se refuerza: el mensaje ya no promete de más.
- El 5 se refuerza: preflight y postflight más estrictos, y mutantes muertos en la suite versionada.
- Las funciones de revocación y de guarda no cambiaron en la ronda 2, así que las carreras de la
  ronda 1 siguen valiendo.

## VALIDACIÓN

### Ronda 2 (PostgreSQL 17 en Docker 29.7.2, datos sintéticos, cero lecturas de producción)

| Comprobación | SHA | Resultado |
|---|---|---|
| Vitest focal: `soft-delete-client.test.ts` y `ClientDrawer.confirm-delete.test.tsx` | `0967016e` | PASÓ (2 archivos, 7 tests) |
| `node scripts/check-numbering.mjs` | `0967016e` y `eacdceda` (dentro de `sdd:check`) | PASÓ |
| `node scripts/check-pending-migration-symbols.mjs` | `0967016e` y `eacdceda` | PASÓ (0 ROJO · 0 AMARILLO) |
| Contrato `0454_borrar_cliente_revoca_portal.test.sql` | `0967016e` y `ea21ad14` | PASÓ (84 aserciones) |
| Contratos vecinos 0341, 0358, 0360, 0293 y 0453 | `0967016e` y `ea21ad14` | PASÓ |
| Control rojo `-v apply_fix=false` | `0967016e` y `ea21ad14` | FALLÓ como se espera, en «Backfill: el vínculo activo, el invitado y el revocado a medias…» |
| Control rojo del contrato nuevo contra la 0454 de `5af835a5` (sha256 `3f3abc08…` frente a `6f58da4e…`) | contrato de `ea21ad14` | FALLÓ como se espera, en «preflight aceptó drift o alteró catálogo: alter table public.portal_access_links force row level security» |
| Mutantes, primera serie (41) | `0967016e` | 41/41 muertos, controles VERDES; los dos de RLS murieron por un aborto secundario (ver notas) |
| Mutantes, serie final (43 = 35 de la ronda 1 + 8 nuevos) | `ea21ad14` | 43/43 muertos en la suite versionada, controles VERDES (detalle por caso en las notas) |
| `corepack pnpm docs:index` + `node scripts/build-docs-index.mjs --check` | `eacdceda` | PASÓ (456 specs; el índice no cambió) |
| `corepack pnpm sdd:check` | `eacdceda` | PASÓ |
| `git diff --check` y `guard --owner` antes de cada commit | cada commit de la ronda | PASÓ |
| `corepack pnpm verify` completo | — | NO EJECUTADO (el Director pidió no repetirlo; lo cubre el CI sobre el head nuevo) |
| Carreras de dos sesiones y medición de locks | — | NO EJECUTADO: no cambiaron las funciones de revocación ni de guarda, ni el orden de creación de triggers. Vale la medición de la ronda 1 |
| eslint y typecheck de `actions.ts` | — | NO EJECUTADO en local: sólo cambió un literal y un comentario; lo cubre el CI |

**Notas de la ronda 2**

- **Primera serie, mutantes de RLS.** En `0967016e`, «preflight sin chequeo de FORCE» murió porque
  abortó el postflight en vez del preflight, y «sin chequeo de dueño o BYPASSRLS» por un 42501 al
  leer `audit_entity_types`. Morían, pero el contrato aceptaba cualquier aborto del preflight.
  `ea21ad14` exige el mensaje claro de cada caso.
- **Control rojo por caso, serie final (todos mueren en la suite versionada):**
  - **Forma completa de triggers:**
    - «preflight triggers sin definición completa»;
    - «preflight triggers sin tgenabled»;
    - «postflight triggers sin definición completa».
  - **RLS del dueño:**
    - «preflight sin chequeo de FORCE»;
    - «preflight sin chequeo de dueño o BYPASSRLS»;
    - «preflight FORCE con mensaje genérico» y «preflight dueño con mensaje genérico», que mueren
      en «el drift de RLS abortó sin su mensaje claro»;
    - «postflight sin chequeo de dueño y FORCE».
  - **FOR SHARE:** «guarda INSERT sin FOR SHARE», que en la ronda 1 sobrevivía en una sesión, muere
    en la aserción estática.
  - **Cambio de motivo en la ronda 1:** «guarda INSERT acepta cliente borrado» ahora muere en esa
    misma aserción estática, porque altera el texto de la rama.
- **Docker.** Estaba apagado al retomar y se arrancó Docker Desktop desde
  `%LOCALAPPDATA%\Programs\DockerDesktop`, con la ruta literal. `$env:` dentro de comillas dobles
  de bash no se expande.

### Ronda 1 (resumen; detalle en la spec)

| Comprobación | SHA | Resultado |
|---|---|---|
| Contrato 0454 (73 aserciones), control rojo, 35 mutantes (34 en una sesión y el restante con carreras) y 4 carreras | `e4c3b736` | PASÓ |
| `pnpm verify`: 15 pasos de código, sql-tests (195) y schema-rebuild | `e4c3b736` y `6446288a` | PASÓ |
| `pnpm verify`: build local | `e4c3b736` y `6446288a` | FALLÓ por entorno (red de fuentes de Google) |
| `pnpm verify`: e2e | `e4c3b736` | FALLÓ por entorno (sin `.env.local`) |
| `pnpm verify`: migrations-applied | — | NO DISPONIBLE |
| CI de la PR (según el Director): «Calidad local sin secretos» con build y Vercel | `5af835a5` | SUCCESS |

## COMMITS

- Ronda 1: `9124411f` reserva · `c90152a8` contrato · `f6d9ed6c` migración, contrato y espera ·
  `88144707` app · `e4c3b736` spec, índice y mapa · `6446288a` merge de `origin/main` (PR #119) ·
  `5af835a5` cierre del handoff
- Ronda 2:
  - `85ef8d85` feat(studio): 0454 ronda 2, RLS del dueño y forma completa de triggers
    (migración, contrato y espera)
  - `0967016e` fix(studio): el error del borrado no afirma que no se borró nada (acción y tests)
  - `ea21ad14` test(studio): el drift de RLS de la 0454 exige su mensaje claro
  - `eacdceda` docs(studio): ronda 2 de la 0454 en la spec
  - El commit que contiene este documento cierra la ronda 2 del handoff; su hash es el head
    publicado de la PR.

## PR / BRANCH

- **PR:** https://github.com/hailuwaycom-sketch/DTDCARGO/pull/120, draft, base `main`
- **Rama:** `codex/borrar-cliente-revoca-portal`
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/borrar-cliente-revoca-portal`

## PENDIENTES DE ESTA TAREA

- **CI sobre el head nuevo:** «Calidad local sin secretos», con build, y Vercel. Si falla por algo
  distinto del entorno, la tarea vuelve a este Worker.
- **Revisión del Director de la ronda 2** y decisión del estado SDD (`done` al aceptar).
- **Release, fuera de la autoridad del Worker:** aplicar `0454_borrar_cliente_revoca_portal` con OK
  nominal de Sam, poco después del merge y en baja actividad.
  - Antes, la lectura previa de la spec (§ Producción), que ahora incluye dueño, FORCE y BYPASSRLS.
  - Después, el postflight recomendado y el smoke de borrar un cliente de prueba con acceso.

## FUERA DE ALCANCE DETECTADO

1. **MP-01 / SGE-00.03 (deuda anterior):** la confirmación inline no es un ConfirmDialog R2 y no
   hay restauración en la UI.
2. **AUD-01 §2 (deuda anterior):** el borrado lógico del cliente no deja evento de auditoría
   (`audit_d5_clients_contact` sólo mira `email` y `phone`, `0293:517`). La revocación sí queda
   auditada.
3. **Retención sin plazo:** la fila revocada de `client_users` conserva `email`, `invited_at`,
   `bound_at` y `last_login_at`. Queda 🔴 en el mapa de borrado §10.
4. **`softDeleteClientAction` sin detección de cero filas:** devuelve `ok` si RLS o el Shipping
   Mark no alcanzan ninguna fila. Agregar `RETURNING` cambia la evaluación de RLS.
5. **Guarda frágil ante cambios:** si alguien agrega `FOR SHARE` a la rama UPDATE de la guarda, se
   abre un interbloqueo (spec § Concurrencia).
6. **Sin contrato propio de 0080:** no existe `supabase/tests/0080_*.test.sql`.
7. **Entorno de esta máquina:**
   - sin `.env.local`, e2e falla en vez de omitirse y su reintento se cuelga hasta el watchdog;
   - Turbopack pierde fuentes de Google de forma intermitente;
   - Docker Desktop se apaga entre sesiones.
8. **Decisiones de criterio de la ronda 2, para revisar:**
   - la precondición acepta también `rolsuper` (un superusuario siempre evita la RLS), además de
     dueño o BYPASSRLS;
   - FORCE aborta aunque el rol tenga BYPASSRLS, que en PostgreSQL sí la evitaría. Es
     conservadurismo pedido, no una limitación técnica.

## HANDOFF AL DIRECTOR

- **Siguiente acción:**
  - revisar el diff de la ronda 2 (`5af835a5..HEAD`) y el CI del head nuevo;
  - decidir la integración;
  - por separado, la lectura previa de catálogo con OK de Sam y la aplicación de la 0454.
- **Cambios compartidos:** `supabase/migrations-baseline.json` (sólo la espera 0454) y
  `docs/specs/README.md` (sin cambios en la ronda 2). No se tocó `module-sdd-map.md`.
- **Dependencias:** ninguna. `origin/main` sigue en 08af6abc, ya fusionado.
- **Sesiones consumidoras del worktree:** ninguna además de esta. El claim se libera tras el push de
  la ronda 2.
