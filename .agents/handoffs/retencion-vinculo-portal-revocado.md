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

## PENDIENTES DE ESTA TAREA

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
