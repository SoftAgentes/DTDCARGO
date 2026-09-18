# retencion-vinculo-portal-revocado — Retención de 30 días del vínculo del Portal revocado (SDD-0477)

- Fecha: 2026-09-18.
- Owner / sesión escritora: `worker-retencion-portal-20260918`, sesión Claude Code `dtdcargo-09`
  (Worker). Coordinación: Director `dtdcargo-18` (números y orden) y supervisor `dtdcargo-53`.
- Encargo de Sam, textual: «Migraciones 0414 y 0415, la retención de 30 días y las tres decisiones
  de la SDD-0470». Esta rama cubre la retención. 0414 y 0415 tienen su registro en
  `codex/0414-0415-aplicacion-prod-20260918`, y SDD-0479 va en `codex/e2e-supabase-sintetico-deny-only`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/retencion-vinculo-portal-revocado`.
- Rama: `codex/retencion-vinculo-portal-revocado`, desde `origin/main` `78410913`, más el stub local de
  reserva `1be6e59e`. dtdcargo-18 publicó otra rama stub con el mismo nombre (`826e75ac`), pero esta
  spec la reemplaza.
- SDD: `docs/specs/0477-retencion-vinculo-portal-revocado/spec.md`, `in-progress`. Migración
  asignada por dtdcargo-18: **0460**. La 0459 es de otra tarea.
- Estado de tarea: lista-para-revision, sin publicar.
- Permisos: edición focal, instalación congelada, pruebas locales y efímeras (Docker), commits
  selectivos. Publicar la rama y abrir la PR requiere la autorización de Sam; merge y producción, otras
  aparte.

## OBJETIVO ORIGINAL

Aplicar la decisión de Sam del 2026-09-15: «30 dias se gusrdan guardamos el email y las fechas de un
vínculo del Portal revocado.». Sam la completó el 2026-09-18 con «Queda como «Revocado»», por
AskUserQuestion.

## COMPLETADO

- **Migración `0460_retencion_vinculo_portal_revocado`:**
  - CHECK `client_users_erased_only_when_revoked`: `email` e `invited_at` admiten NULL sólo en una
    fila `revoked`;
  - RPC `erase_revoked_portal_access_data(p_limit, p_dry_run)`, SECURITY DEFINER, `search_path` vacío
    y sólo para `service_role`.
  - Pasados 30 días de la revocación, la RPC borra nueve campos: correo, las seis fechas, identidad y
    token. La fila queda `revoked`.
  - Escribe un evento `portal_access_data_erased` por fila, sin valores, en la misma transacción.
  - Respeta los holds de 0301, tiene tope por corrida, `SKIP LOCKED`, dry run e idempotencia.
  - Preflight que falla cerrado, postflight con huella y sin backfill. Diseño completo en la spec.
- **Cron `/api/cron/portal-revoked-retention`,** diario a las 04:30 UTC:
  - `CRON_SECRET` por header;
  - dry-run salvo `PORTAL_REVOKED_RETENTION_ENABLED === "true"`, y `?dryRun=1` lo fuerza;
  - sólo reporta conteos; un error o una respuesta con otra forma da 500 genérico.
  - Entra en `vercel.json` y `.env.example`.
- **Studio:** `ClientPortalAccess.email` e `invitedAt` pasan a `string | null`. La tarjeta sigue
  mostrando «Revocado» y no usa esos campos para una fila revocada.
- **Registros:**
  - la espera `0460_retencion_vinculo_portal_revocado` en `supabase/migrations-baseline.json`, con
    orden migrate-first y el párrafo de autorización;
  - la degradación `sdd-0477-retencion-vinculo-portal-revocado` en
    `supabase/pending-migration-symbol-declarations.json`: sin 0460, el cron responde 500 y no borra.
- **Documentos:**
  - `mapa-de-borrado.md` §10: de 🔴 SIN FUNDAMENTO a 30 días, con lo que se conserva declarado;
  - `registro-tratamiento.md` v1.5;
  - la spec, con la revisión `revisar-datos-ve`.

### Revisión `revisar-datos-ve` (focal)

- **6 CORRECTO**: temporalidad, evento sin PII, holds, logs sólo con conteos, sólo filas `revoked` y
  verificación contra datos en una base efímera.
- **3 ENCONTRADO, fuera de alcance:**
  - la cuenta de Supabase Auth del antiguo titular sobrevive: ningún código borra `auth.users`;
  - los eventos de auditoría conservan las horas de invitación y revocación, sin correo;
  - `clients.email` de la ficha borrada.
- **3 NO VERIFICABLE**: conteos en producción, PITR y logs de Vercel, y el comportamiento en
  producción.
- Detalle y normas en la spec (sección «Revisión de datos personales»). No es asesoría legal.

## VALIDACIÓN

Por comprobación, sobre el SHA indicado:

- **PASÓ** · contrato SQL `supabase/tests/0460_retencion_vinculo_portal_revocado.test.sql`, en
  `postgres:17` efímero sobre `4765a196`:
  - verde, 73 aserciones;
  - rojo con `-v apply_fix=false`: reproduce el hueco.
- **PASÓ** · control rojo por mutantes sobre la migración real: 20/20 muertos. 19/20 mueren por
  comportamiento; el de `SKIP LOCKED` sólo muere por la aserción estática, porque la concurrencia no se
  prueba en una sola sesión.
  - El mutante M8 (elegible sin datos que borrar) sobrevivía en la primera ronda. Faltaba una prueba:
    una fila ya borrada con `updated_at` viejo. Se agregó, y ahora muere.
- **PASÓ** · Vitest focal, con `--pool=threads` por la carga de la máquina: `portal-revoked-retention`
  17/17 y `purge-throttle` 7/7.
- **PASÓ** · `tsc --noEmit` 0 y ESLint de lo tocado 0.
- **PASÓ** · `check-pending-migration-symbols`: 0 ROJO · 1 AMARILLO declarado.
- **PASÓ** · `docs:index` (465 specs), `docs:check`, `check-numbering`, `governance:check` y
  `git diff --check`.
- **FALLÓ · `corepack pnpm verify` completo**, sobre `2582615a` y sobre `75e69d76`. Sólo falla el
  paso `test`, por pruebas ajenas que pasan aisladas. El detalle por paso está en «Resultado de
  verify».

## Resultado de verify

**Corrida 1**, `corepack pnpm verify` sobre `2582615a`, de 01:38:11 a 02:04:13 (−04:00). Mismo HEAD al
inicio y al final, y el árbol sólo tenía este handoff sin commit. Sin variables de Supabase y con la
máquina muy cargada: otras sesiones, más mis mutantes y el typecheck de otra rama en paralelo.
Resultado: **exit 1**.

- **PASÓ:**
  - harness, lint, rsc-boundary (1624 módulos), typecheck y edge-functions (4);
  - docs:check, numbering, feature-constants, components:check y governance:check;
  - pending-migration-symbols: 0 ROJO · 1 AMARILLO declarado, el de esta rama;
  - sql-tests, con el contrato de 0460 incluido;
  - schema-rebuild y build.
- **FALLÓ, `test`:** 7806/7809 en el reintento. Fallaron dos pruebas **por timeout**, no por
  aserciones, y ninguna toca archivos de esta rama:
  - `scripts/__tests__/invoice-read-boundary.test.mjs` expiró a los 60 s;
  - `app/p/[token]/PackingListProductsStep.test.tsx` expiró a los 20 s.
  Corridas aisladas sobre el mismo `2582615a`, con la máquina más libre: **PASÓ**,
  `invoice-read-boundary` 3/3 en 5,4 s y `PackingListProductsStep` 9/9 en 23,5 s.
- **e2e, `[OK]` con cobertura parcial:** 153 passed, 33 skipped (las 15 de 0470 más los Tier 3) y 0
  failed, en 5,3 min. Esta rama no incluye SDD-0479.
- **NO DISPONIBLE:** `migrations-applied`, SKIP sin credenciales.
- **Veredicto literal:** `verify: 1 fallo(s) → test CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR:
  migrations-applied. CRÍTICOS CON COBERTURA PARCIAL: e2e [15 prueba(s) omitidas sin Supabase público
  (…)]`.

**Merge de `origin/main` `56fa2ae0`** en `75e69d76`: limpio con el driver. Sale la espera de 0458 y
queda la de 0460. `docs:check` (465 specs) y pending-migration-symbols (0 ROJO · 1 AMARILLO) PASÓ.

**Corrida 2**, `corepack pnpm verify` sobre `75e69d76` (con main traído), de 02:32:16 a 03:00:12
(−04:00). Mismo HEAD al inicio y al final; el árbol sólo tenía este handoff sin commit. Sin carga
propia en paralelo. Resultado: **exit 1**.

- **PASÓ:**
  - harness, lint, rsc-boundary, typecheck y edge-functions;
  - docs, numbering, feature-constants, components y governance;
  - pending-migration-symbols (0 ROJO · 1 AMARILLO), sql-tests, schema-rebuild y build.
- **FALLÓ, `test`:**
  - **Primer intento:** fallaron `PackingListProductsStep` (timeout a los 20 s) y
    `app/studio/(app)/clientes/_components/ClientDrawer.confirm-delete.test.tsx` «si no se borró
    ninguna fila…», en 547 ms: no encontró el botón «Eliminar cliente». Es de SDD-0469 y esta rama no
    toca `ClientDrawer`.
  - **Reintento:** sólo `PackingListProductsStep` (timeout).
  - **Aisladas sobre `75e69d76`, PASÓ:** `ClientDrawer.confirm-delete` 3 corridas de 9/9, y
    `PackingListProductsStep` 9/9 en 19,9 s, justo al borde de su timeout de 20 s.
- **e2e, `[OK] (con aviso)` y cobertura parcial:** 153 passed, 33 skipped y 0 failed, en 9,5 min.
  - El proceso salió ≠0 por «worker-16 process did not exit within 300000ms after stop,
    force-killed it». El gate lo absolvió como el cierre de WebKit en Windows.
  - Es el dato que pide la decisión 3 de SDD-0470 («Medir y no cambiar»). Salió en 1 de las 2
    corridas de esta rama, que no incluye SDD-0479, y en 0 de 1 corrida de la rama de SDD-0479. Ver
    «FUERA DE ALCANCE DETECTADO».
- **NO DISPONIBLE:** `migrations-applied`, SKIP sin credenciales.
- **Veredicto literal:** `verify: 1 fallo(s) → test CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR:
  migrations-applied. CRÍTICOS CON COBERTURA PARCIAL: e2e [15 prueba(s) omitidas …]`.

**Conclusión:** lo propio de esta rama pasa en todas las corridas. Eso incluye el contrato de 0460
dentro de `sql-tests`, las pruebas del cron dentro de `test`, typecheck, lint y build. El cierre de
`verify` queda **FALLÓ** por pruebas ajenas inestables bajo carga, que pasan aisladas. No es un
cierre verde.

## COMMITS

- `1be6e59e` chore(sdd): reserva SDD-0477.
- `4765a196` feat(db): SDD-0477 — 0460 borra a los 30 días el correo y las fechas del vínculo revocado.
- `4b5dad91` feat(studio): SDD-0477 — cron diario de retención del vínculo revocado, apagado por
  defecto.
- `2582615a` docs(SDD-0477): spec, mapa de borrado §10 y registro de tratamiento.
- `75e69d76`: merge de `origin/main` `56fa2ae0`.
- «commit que contiene este documento»: handoff.

## PR / BRANCH

- Rama `codex/retencion-vinculo-portal-revocado`, sin publicar. Requiere la autorización de Sam.

## Aplicación de 0460 en producción (2026-09-18)

`0460_retencion_vinculo_portal_revocado` **quedó APLICADA** a las 17:04:51 UTC, migrate-first y antes
de integrar la #140. Conector `claude.ai Supabase`, proyecto `xpfuzqombmjmxvprjgmi`.

- **Autorizaciones de Sam** (AskUserQuestion, textual):
  - «Autorizo aplicar 0460 antes (Recomendado)» — «Autorizo aplicar 0460_retencion_vinculo_portal_revocado
    con el runbook y confirmación del Director, justo antes de fusionar la #140. El cron sigue apagado
    (solo cuenta).»;
  - para hacerlo de día, después de escribir «aplicar ahora no importa»: «Sí, aplícala ya»;
  - «Autorizo el conteo por status»: el conteo agregado de `client_users`, sin valores.
- **Director `dtdcargo-18`:** primero recomendó esperar a la noche por la hora pico. Después confirmó la
  ventana libre: la 0459 ya estaba cerrada y no había otras aplicaciones.
- **Justo antes, 17:03:35Z:**
  - 0 locks ajenos sobre `client_users`;
  - 0 transacciones `idle in transaction` de más de 30 s y 0 activas de más de 1 min;
  - ledger con 466 filas, la última `20260918155832` (0459).
- **Preflight de catálogo:** se cumplieron todas sus condiciones.
  - `client_users` tiene RLS sin FORCE, sus 14 columnas y el CHECK de status exacto.
  - `email` e `invited_at` eran NOT NULL, sin el CHECK nuevo ni la RPC.
  - El writer es SECURITY DEFINER y quien aplica puede ejecutarlo.
  - `portal_invitation` está activo y los holds de 0301 están completos.
  - `postgres` tiene BYPASSRLS.
- **Aplicación:** `apply_migration`, name exacto, con el blob de `5c1e2999` sin modificar. Salió
  `{"success": true}` al primer intento, sin reintentos por `lock_timeout`.
- **Ledger:** 467 filas; `20260918170451`, 1 sentencia, md5 `d86cf096e91c58546dc7c90b032d0bc2` y 27.067
  bytes, idénticos al blob.
- **Postflight (los 4 puntos del Director):**
  1. Ninguna fila cambió: por status, active 225, invited 14 y revoked 2, antes y después. 0 eventos
     `portal_access_data_erased`.
  2. El CHECK `client_users_erased_only_when_revoked` existe y está validado. `email` e `invited_at`
     quedaron anulables y el CHECK de status sigue intacto.
  3. La RPC es SECURITY DEFINER, volátil y con `search_path` vacío, con dueño `postgres`. ACL
     `{postgres=X,service_role=X}`: `service_role` sí, y `authenticated`, `anon` y PUBLIC no. Es la
     única firma.
  4. Login del Portal: **PASÓ**. Sam entró con una cuenta de cliente después de aplicar, textual: «ya
     entré al portal, el login funciona bien».
- **Sin cambios:** triggers, policy, ACL de `client_users` y md5 del writer.
- **Advisors de seguridad:** idénticos antes y después (230 hallazgos, md5 `8ef43bf4…`). Ninguno nombra la
  RPC.
- **Registros en esta rama:**
  - sale la espera `0460_retencion_vinculo_portal_revocado` del baseline;
  - sale la degradación `sdd-0477-retencion-vinculo-portal-revocado`, y las declaraciones vuelven a ser
    iguales a las de `main`;
  - pending-migration-symbols queda en 0 ROJO · 0 AMARILLO;
  - la spec registra la aplicación en «Producción».

## Puesta al día con main antes del push final

- **`origin/main` `0e58762c`** (con #137, #139, #141, #142 y #144) traído en el merge `e746d137`, sin
  conflictos. El driver dejó el baseline igual al de `main`: sólo las esperas `0422` y `0423`, sin la
  0460. Las declaraciones también quedaron iguales a las de `main`.
- **Comprobaciones sobre `e746d137`, todas PASÓ:**
  - `docs:check` (467 specs) y `check-numbering`;
  - `check-pending-migration-symbols`: 0 ROJO · 0 AMARILLO;
  - `git diff --check`;
  - Vitest de `portal-revoked-retention`, 17/17;
  - `tsc --noEmit`, exit 0.
- **NO DISPONIBLE · contrato SQL de 0460 sobre `e746d137`:** Docker Desktop no arranca («Docker Desktop is
  unable to start»). No se reinició, porque otras sesiones pueden estar usándolo.
  - Evidencia que lo sustituye: la migración y su contrato no cambiaron desde `75e69d76`, donde el paso
    `sql-tests` de `verify` PASÓ. La única migración nueva que trajo main es la 0459, de tarifas, que no
    toca `client_users`.
  - Además, la 0460 ya está aplicada y verificada en producción.

## PENDIENTES DE ESTA TAREA

- **Aplicar 0460: HECHO** (ver arriba), con el smoke del login del Portal PASÓ.
- **Traer main e integrar:** cuando dtdcargo-18 pase el SHA, después de la #137 y la #144, traer main con
  el driver y hacer un único push. Después dtdcargo-18 integra la #140, y ese merge despliega.
- **Leer el primer dry-run del cron después del deploy.** Con esos conteos, Sam decide si activa
  `PORTAL_REVOKED_RETENTION_ENABLED` en Vercel.

- ~~Confirmación de la excepción MP-D3~~: **aprobada por Sam el 2026-09-18**, textual: «Acepto la
  excepción (Recomendado)». Queda registrada en la tabla de gobernanza de la spec.
- ~~Publicar la rama y abrir la PR en borrador~~: **autorizado por Sam el 2026-09-18**, textual:
  «Autorizo publicar las tres», con las tres ramas nombradas en la pregunta y sin merge ni
  producción. La PR va en borrador.
- **Release, cada paso con su autorización:**
  1. aplicar 0460 con OK nominal y el runbook, migrate-first, y con confirmación de dtdcargo-18;
  2. merge;
  3. leer el primer dry-run del cron;
  4. que Sam active `PORTAL_REVOKED_RETENTION_ENABLED` en Vercel, con la variable nombrada;
  5. retirar la espera y la declaración.
- El criterio 9 de la spec (producción) queda abierto hasta el release.

## FUERA DE ALCANCE DETECTADO

- **Seguimiento de SDD-0479, observación de dtdcargo-18 al aprobar la #141 (no bloqueante).** Con el
  Supabase sintético, el resumen final de `verify` ya no dice «CRÍTICOS CON COBERTURA PARCIAL: e2e».
  Quien lea sólo el resumen puede entender que el e2e corrió contra un Supabase real. Conviene que el
  resumen diga algo como «e2e contra Supabase sintético deny-only: flujos con datos reales NO
  cubiertos». Es tarea aparte, no de esta PR.

- **La cuenta de Supabase Auth del antiguo titular del Portal no se borra nunca:** `auth.users` guarda
  el correo y el último ingreso. Necesita su propia decisión y su propia SDD.
- **Pruebas inestables bajo carga, ajenas a esta rama:**
  - `invoice-read-boundary.test.mjs`, timeout a los 60 s; aislada, 3/3 en 5,4 s;
  - `PackingListProductsStep.test.tsx`, timeout a los 20 s; aislada tarda de 19,9 a 23,5 s, así que
    su timeout es insuficiente;
  - `ClientDrawer.confirm-delete.test.tsx`, que falló una vez por un botón ausente y pasó 3/3
    aislada.
  Por la segunda, el paso `test` de `verify` no cierra verde en esta máquina.
- **Decisión 3 de SDD-0470 (WebKit en Windows).** Volvió a salir «worker-16 process did not exit
  within 300000ms after stop» en la corrida 2 de esta rama, que no incluye SDD-0479. Sam decidió que,
  si reaparecía, se abre la spec del remedio. Sugiero medir primero con SDD-0479 integrada, porque en
  su corrida no apareció: WebKit deja de navegar a páginas caídas. Queda a decisión de Sam y del
  Director.
- La prueba de frontera de facturas no cubre `components/` ni tiene par para `mail_logs` (anotado en
  el registro de 0414/0415).

## Cierre documental

- **Impacto documental:**
  - `docs/specs/0477-…/spec.md`, nueva;
  - `docs/legal/privacidad/mapa-de-borrado.md` §10;
  - `docs/legal/privacidad/registro-tratamiento.md` v1.5;
  - `.env.example`;
  - `docs/specs/README.md`, regenerado;
  - este handoff.
- **Graphify:** no hay grafo local en este worktree. Con las mismas condiciones, el de SDD-0479 dio
  estructural `INVALID` (4196 pendientes previos), Archify `PENDING` (runtime ausente, que exige una
  descarga no autorizada) y Obsidian `PENDING`.
- El Director actualiza las capas desde `main` integrado. Ninguna se declara actualizada.

## Antes de publicar (2026-09-18)

- Se trajo `origin/main` `b43a39a5` (#138, sólo `docs/marketing/` y `public/interno/guia-peso.html`) en el merge `dd17d14e`, sin conflictos. `docs:check` y `check-pending-migration-symbols` PASÓ después del merge. Ese cambio no toca código ni pruebas de esta rama; las validaciones de arriba siguen vigentes.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar la PR cuando Sam autorice publicarla.
- Orden: esta rama toca `supabase/migrations-baseline.json` y el índice de specs. Según dtdcargo-18,
  entra después de la de `dtdcargo-c9` (0458) y de la del registro de 0414/0415. Resolver con los
  drivers de merge.
- Contratos compartidos:
  - `client_users`, con dos columnas anulables sólo en `revoked`;
  - `append_audit_event`, sin cambios;
  - la nueva entrada en `vercel.json`.
- El claim `worker-retencion-portal-20260918` se libera al cerrar la escritura.
