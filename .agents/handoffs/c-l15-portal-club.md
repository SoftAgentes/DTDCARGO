# Handoff — C / L15: frontera principal/tenant del helper Club Portal

Fecha: 2026-09-11. Task ID: `c-l15-portal-club`.
Owner / sesión escritora: `c-l15-worker-20260911-claude` (Worker Claude Code asignado por el Director; sin subagentes).
Estado: lista-para-revision en PR draft; no integrada ni aplicada.

- Repo: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal no modificado: tiene cambios ajenos).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l15-portal-club`.
- Rama: `codex/c-l15-portal-club`.
- Base asignada y HEAD inicial: `3c6107012f754953323202a7386b3e7811593814`, igual a origin/main tras `git fetch origin` al iniciar.
- Origen solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, head de la PR #21 (OPEN, draft), comprobado con `gh pr view 21`. No se modificaron la PR ni su rama.
- SDD: `docs/specs/0368-portal-club-principal-tenant/spec.md`. Conserva `status: in-progress` del origen; nota de importación fechada en las líneas 16-22.

## OBJETIVO ORIGINAL

Preparar el lote L15 del bloque C para integrarlo en main mediante PR draft. L15 es la frontera principal/tenant del helper `get_portal_person_id()` que usan las policies Club del Portal. Hay que importar la migración 0424, su contrato SQL y la spec 0368, y declarar `0424_portal_club_principal_tenant` pendiente de aplicar. Sin cambios de app/lib. El Worker no fusiona ni aplica a producción.

## COMPLETADO

- Aislamiento: `guard` OK, claim `c-l15-worker-20260911-claude` adquirido y árbol limpio en la base asignada. Todo comando corrió dentro de este worktree.
- Lecturas:
  - AGENTS, skill Worker, runbook, `docs/engineering/project-rules.md`, AGENT-BRIEF y `docs/governance/policies/sge-00.md`.
  - Plan C: `c-analisis-bloque-c.md:58,84`.
  - Anexo SQL: `c-analisis-bloque-c-sql.md:74,114,154,254`.
  - Medición: `c-analisis-bloque-c-medicion.md:189-190`.
  - Producto: `c-analisis-bloque-c-producto.md:211,259`.
  - Precedentes L12/L13.
- Importación con `git cat-file blob` de los tres blobs del origen: OID y bytes idénticos, LF sin CR.
- Spec: nota de 7 líneas bajo el título, adaptada a `in-progress`. Retirarla devuelve el Buffer original de 11376 B; el frontmatter es idéntico.
- Baseline: +1 línea, clave `0424_portal_club_principal_tenant` entre 0419 y 0430 (orden numérico). `cutoff: 238`, `$doc` y las cuatro esperas previas son idénticos a origin/main.
- Índice regenerado con `corepack pnpm docs:index`: 416 specs, 36 huecos. Añade la fila 0368 `in-progress` y 0368 sale de los huecos.
- Análisis estático de los seis consumidores `pg_depend` y de los consumidores de app (sección HANDOFF AL DIRECTOR). Sin impacto sobre consumidores legítimos, así que no hubo que detenerse ni adaptar código.
- Sonda focal efímera del contrato 0424 en modo GREEN y RED, además de los gates pedidos.

**Alcance exacto:** los cinco archivos del commit de producto y este handoff. `supabase/pending-migration-symbol-declarations.json` sin tocar. Excluidos: app/**, lib/**, otros lotes C, cutoff, esperas existentes, ruleset y rama de #21.

**Aceptación:**

1. Cumplido: `supabase/migrations/0424_portal_club_principal_tenant.sql` = `56849a7bd89da604491816a4ea59e096bb7d9911`, 6696 B.
2. Cumplido: `supabase/tests/0424_portal_club_principal_tenant.test.sql` = `c0c9143d7fab2776658494e639a56586dab8d87f`, 37265 B.
3. Cumplido: la spec sin la nota es igual byte a byte al blob `afb117bfe4674f07014de6cea4d759906bd253ad`. Con nota: `2469e25c50276197313cf8989ac7185a8778c069`, 11963 B.
4. Cumplido: la única espera nueva menciona L15 / SDD-0368, que fusionar NO autoriza aplicar, OK nominal de Sam más runbook, aplicación individual con `name` exacto, y que el preflight exige el cuerpo exacto de 0187 y aborta si hay drift. El cutoff 238 y las demás entradas quedan intactos.
5. Cumplido: índice regenerado por generador, nunca a mano.
6. Cumplido: evidencia archivo:línea abajo.
7. Cumplido: este handoff y la PR draft.

**Gobernanza:**

- SGE-00.05 (`sge-00.md:53`), cumplimiento local: prueba negativa de tenant ajeno. RED reproduce los dos cruces; GREEN los niega y conserva las lecturas legítimas exactas.
- SGE-00.06 (`:54`), cumplimiento local: preflight fail-closed, con 27 derivas rechazadas sin escribir catálogo ni filas.
- SGE-00.07 (`:55`), cumplimiento: la evidencia local se separa de la de producción y ninguna comprobación incompleta se presenta como verde.
- SGE-00.12 (`:60`), cumplimiento: ninguna acción irreversible sin autorización humana nominal (sin merge, aplicación ni deploy).
- No aplica: SGE-00 restante, MP-01, BTN-01, AUD-01/02 y UI/marca. No hay controles, pantallas, verbos, escritores ni exportaciones nuevas. No se declara conforme el legado completo del Club.

**Datos personales** (`.claude/skills/revisar-datos-ve/SKILL.md`): no aplica.

- 0424 no captura, mueve ni borra datos personales. Su cuerpo es un SELECT que resuelve el id de persona del propio principal Portal (`0424:112-119`), sin DML: el grep de DDL/DML da 0 coincidencias.
- El contrato usa solo datos sintéticos (`test:2`; ids md5 en `:90-92`; correos `@example.invalid` en `:143`).
- No se leyeron filas de producción.

## VALIDACIÓN

Base `3c610701`. El contenido probado es el del commit `19a28b13`: el commit siguiente solo agrega este handoff. Node v24.20.0 y pnpm 12.3.4 vía Corepack.

1. Aislamiento e instalación:
   - PASÓ: `guard` y `claim --owner c-l15-worker-20260911-claude`; `guard --owner` y rama revalidados antes de cada commit.
   - PASÓ: `corepack pnpm install --frozen-lockfile`, exit 0 en 43 s, con el lockfile intacto.
2. PASÓ: identidad por blob. Se usaron `git hash-object` con y sin filtros, `git cat-file` y comparación de Buffers:

   ```text
   docs/specs/0368-portal-club-principal-tenant/spec.md          origen=afb117bfe4674f07014de6cea4d759906bd253ad 11376B  commit=2469e25c50276197313cf8989ac7185a8778c069 11963B (con nota; sin nota = origen)
   supabase/migrations/0424_portal_club_principal_tenant.sql     origen=56849a7bd89da604491816a4ea59e096bb7d9911 6696B   commit=56849a7bd89da604491816a4ea59e096bb7d9911 6696B
   supabase/tests/0424_portal_club_principal_tenant.test.sql     origen=c0c9143d7fab2776658494e639a56586dab8d87f 37265B  commit=c0c9143d7fab2776658494e639a56586dab8d87f 37265B
   ```

3. PASÓ: `node scripts/install-merge-drivers.mjs --check`, driver `dtd-generated-records` verificado.
4. Numeración e índice:
   - PASÓ: `corepack pnpm sdd:check`, sin números repetidos y solo con las exenciones históricas ya declaradas.
   - PASÓ: `corepack pnpm docs:index`, 416 specs y 36 huecos.
   - PASÓ: `corepack pnpm docs:check`, índice sincronizado.
5. Reconstrucción, símbolos y sonda:
   - PASÓ: `node scripts/check-schema-rebuild.mjs`, exit 0 (07:23:52Z–07:24:22Z). Inventarió 421 migraciones: 403 aplicadas desde cero y 18 solo-ledger verificadas sin cambio de esquema. Barrió 219 tablas con dos tenants sintéticos del Postgres efímero. Midió la base completa más solo 0424.
   - PASÓ: `node scripts/check-pending-migration-symbols.mjs`, `0 ROJO · 0 AMARILLO`; `supabase/pending-migration-symbol-declarations.json` intacto.
   - PASÓ, prueba efímera adicional: sonda focal del contrato 0424 con `postgres:17` (PostgreSQL 17.11, imagen `sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675`). El contenedor propio `dtd_l15probe_3e7114eb` quedó retirado.
     - GREEN, exit 0: 364 aserciones de la matriz principal más 10 del canario restrictivo en conexión nueva, **374** en total. Rechazó 26 + 1 = **27** derivas de preflight. `rollback_clean = t` en ambas conexiones.
     - RED (`-v apply_fix=false`), exit 3: 12 avisos de baseline. `bad-link` y `bad-person` obtienen persona-B y leen una fila de tenant-B en cada una de las seis tablas. Falla por conducta en `test:472` («bad-link: helper debe denegar vínculo incoherente»), no por ausencia de 0424.
     - La base quedó limpia tras ambos modos.
6. `corepack pnpm verify` sobre `19a28b13`, sin variables `VERIFY_SKIP` y sin credenciales Supabase:
   - PASÓ:
     - harness 18/18;
     - lint, 0 errores y 8 advertencias preexistentes;
     - rsc-boundary, 1597 módulos;
     - typecheck;
     - edge-functions, 4;
     - test, 526 archivos y 6684 tests;
     - docs:check, 416 specs;
     - numbering;
     - feature-constants, 5 banderas;
     - components:check;
     - governance:check;
     - pending-migration-symbols, 0/0;
     - sql-tests: **163 contratos** en `postgres:17` efímero, 163 en ✓, incluido `0424_portal_club_principal_tenant.test.sql` (`verify.log:297`), con rollback total;
     - schema-rebuild: 421 inventariadas, 403 desde cero y 18 solo-ledger; 219 tablas y dos tenants sintéticos.
   - NO DISPONIBLE: `migrations-applied`, SKIP explícito por falta de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. No se consultó producción ni se copiaron secretos.
   - E2E: el comando FALLÓ (`[FAIL] e2e (exit 1)`, `verify.log:6524`) y el E2E autenticado queda NO DISPONIBLE. Playwright levantó su propio dev server en el puerto **3685**, sin que el webServer expirara, y corrió 186 tests con 8 workers.
     - Primera pasada, 9.9 min: **151 pasaron, 16 fallaron, 1 flaky y 18 omitidos**.
     - Segunda pasada automática del runner (`retry: 1` en `scripts/verify.mjs:400`; aviso en `verify.log:3735`), 8.6 min: **151 pasaron, 15 fallaron, 2 flaky y 18 omitidos** (`verify.log:6503-6523`).
     - Los 15 fallos de ambas pasadas son la familia conocida por falta de configuración Supabase: «Your project's URL and Key are required…» en `proxy.ts:67` (`verify.log:711-717`). Son `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22`, en chromium, mobile-chrome y mobile-safari.
     - El flaky de la primera pasada, `auth.spec.ts:74` en chromium, es de la misma familia.
     - El fallo 16 de la primera pasada es `calculadora-sin-peso.spec.ts:63` en chromium: en ambos intentos, `escribir.ts:82` informa «React nunca recibió "12" (el tecleo se perdió)», con React viendo "" y la pantalla "12". En la segunda pasada pasó.
     - Los 2 flaky de la segunda pasada son `calculadora-semantic-colors.spec.ts:53` en mobile-chrome y mobile-safari, que pasaron al reintentar.
     - Todo lo de la calculadora se clasifica en FUERA DE ALCANCE.
     - No se modificaron tests, retries ni timeouts, y no se copiaron credenciales.
   - PASÓ: build de producción (`scripts/check-build.mjs`; Next 16.2.11 con Turbopack). Compiló en 28.9 s, con TypeScript y postbuild Norte OK. El runner restauró `tsconfig.json` (`verify.log:6857-6859`); al terminar, `tsconfig.json` quedó intacto y `.next-verify` ausente.
   - **Resultado global: FALLÓ, exit 1** (07:26:12Z–07:57:07Z, unos 31 min). Corrieron 16 de 17 pasos: **15 PASÓ, E2E FALLÓ** y `migrations-applied` quedó **NO DISPONIBLE**. El runner lo marca «CIERRE ADEMÁS INCOMPLETO» (`verify.log:6862-6864`). No es verde completo ni certificación de producción.
   - Limpieza comprobada al terminar: sin contenedores propios (`dtd_*_3e7114eb`), sin listener en el puerto 3685 y `git status` solo con este handoff.
7. Diff y alcance, comprobados antes y después del commit del handoff:
   - PASÓ: `git diff --check`, sobre el commit de producto y sobre el handoff staged.
   - PASÓ: allowlist exacta con `git diff --name-only origin/main...HEAD`. Son seis rutas: los cinco archivos de L15 y este handoff. Sin app/lib, scripts, workflows, lockfile, package.json, tsconfig ni declaraciones de símbolos.
8. NO EJECUTADO, no aplica: `/ui-check`. No hay UI ni cambios visuales.

- NO EJECUTADO, fuera de la autorización Worker: merge, aplicación de 0424 a producción, lectura de datos productivos, deploy manual y cambios de ruleset.
- CI remoto:
  - PASÓ: **Calidad local sin secretos** para `19a28b13`, [run 34575107475](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34575107475) (evento `pull_request`). Sus pasos incluyen ESLint, frontera RSC, TypeScript, Edge Functions, Unitarios, Harness, Documentación y numeración SDD, código contra migraciones pendientes, constantes, registro de componentes, gobernanza, build de producción sin secretos y árbol reproducible; todos terminaron en success.
  - Vercel Preview: deployment `6388664403`, entorno `Preview` con `production_environment=false`; no es producción ni sustituye pruebas.
  - Ese workflow no ejecuta SQL, schema-rebuild, E2E autenticado ni ledger Supabase. El CI del commit final de handoff se comprueba aparte por SHA en la PR.

Evidencia local fuera de Git, en `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/454d97be-b1e0-4fc9-97e9-c6bb621ba84c/scratchpad/c-l15-portal-club/`:

- instalación e identidad: `install.log`, `blobs-iniciales.log`, `blobs-finales.log`, `validacion-ediciones.log`;
- índice y numeración: `docs-index.log`, `sdd-check.log`, `docs-check.log`;
- gates: `merge-drivers.log`, `pending-symbols.log`, `schema-rebuild.log`;
- sonda: `probe-0424.log`, `probe-0424-summary.json`;
- verify: `verify.log`, `verify.exit`;
- publicación: `push-*.log`, `pr-create.log`, `pr-body.md`.

## COMMITS

- `19a28b130796fe6f6bc69e6bca3675ca940098a8`: unidad L15 (spec con nota, migración, contrato, espera en baseline e índice regenerado), cinco archivos añadidos de forma selectiva.
- Commit que contiene este documento: cierre durable del Worker. Su SHA final se registra en la PR, sin recursión de commits para anotar su propio hash.

## PR / BRANCH

[PR #73 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/73), base `main`, rama `codex/c-l15-portal-club`. Se publicó con push explícito de la rama a sí misma (`git push -u origin codex/c-l15-portal-club:codex/c-l15-portal-club`), con el primer push en `19a28b13`. El SHA final, que incluye este handoff, queda registrado en la PR. Worktree indicado arriba. origin/main seguía en `3c610701` al publicar, así que no hizo falta merge. No se fusionó ni desplegó manualmente.

## PENDIENTES DE ESTA TAREA

Ninguno de extracción ni de implementación. Para integrar faltan:

- Revisión del Director y CI del SHA final.
- Unir registros con #69 (L19), #70 (L21) y #72 (L20).
- Autorización de merge.

E2E autenticado y ledger productivo siguen NO DISPONIBLE en este entorno; no se aplica una migración para ponerlos en verde. La aplicación productiva de 0424 es una tarea nominal separada.

## FUERA DE ALCANCE DETECTADO

- Corepack resolvió pnpm 12.3.4 y avisó que `pnpm.onlyBuiltDependencies` en package.json ya no se lee (`install.log:1`). La instalación congelada terminó en 0 con el lockfile intacto; no se tocó configuración.
- ESLint: 0 errores y 8 advertencias preexistentes (`verify.log:76`), fuera del diff:
  - `app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx`
  - `app/portal/(app)/compras/nueva/PurchaseStepDetalle.test.tsx`
  - `app/studio/(app)/crm/_components/KommoBoardView.tsx`
  - `app/studio/(app)/crm/_components/KommoClient.tsx`
- `scripts/check-schema-rebuild.mjs:315` imprime «2 tenants reales». Son tenants que crea `supabase/tests/_tenant-isolation.assert.sql` dentro del Postgres efímero: «reales» alude al esquema completo de 219 tablas (`:293`), no a producción. Es solo redacción y no se tocó.
- `0172_clients_person_link.sql:4-6` anuncia que los clientes nuevos reciben `person_id` en el alta (capa app). En app/lib, supabase/migrations, supabase/functions y scripts solo encontré dos escritores de `clients.person_id`: el backfill `0172:19-24` y la herencia al fusionar `0361:258`, que es del mismo tenant por `0361:100-101`. Si no existe otro escritor fuera de ese alcance, un cliente creado después del backfill y sin fusión no resuelve persona Portal, igual antes que después de 0424. Es una observación de producto preexistente; no se investigó más ni se tocó.
- E2E `calculadora-sin-peso.spec.ts:63` (chromium) falló en ambos intentos: «React nunca recibió "12" (el tecleo se perdió)» en `e2e/_helpers/escribir.ts:82`, al teclear el CBM (`calculadora-sin-peso.spec.ts:69`). No lo toca este lote:
  - Este diff no cambia app, lib ni e2e, y `/tarifas` no lee las tablas Club.
  - Los otros dos tests del mismo spec pasaron en chromium, y el spec completo pasó en mobile-chrome y mobile-safari.
  - El mismo test pasó en 7.4 s en la corrida guardada de L13, con la misma falta de configuración Supabase.
  - Durante esta corrida, `c-l21-portal-realtime-mensajes` corría su propio E2E: 7 procesos de Playwright y 1 `next`, según `concurrencia-e2e.log` (07:43:52Z).
  - `escribir.ts:28-48` documenta ese síntoma cuando el tecleo le gana a la hidratación.
  - No se reintentó en bucle ni se tocaron tests o timeouts.
  - En la segunda pasada automática del runner, el mismo test **pasó**: 6.6 s en chromium y 3.1 s en mobile-chrome. Esa segunda pasada viene de `retry: 1` en `scripts/verify.mjs:400`; su aviso («e2e falló (exit 1) → reintento 1/1 (flaky conocido)») está en `verify.log:3735`.
  - Clasificación: flaky de entorno por hidratación bajo carga concurrente, preexistente y ajeno a L15. Por eso no agregué una re-ejecución aislada propia.

## HANDOFF AL DIRECTOR

**Exacto en el plan.** `c-analisis-bloque-c.md:84` (L15), el anexo `:74` y `:154` (SQL-15) y `:114` (raíz persons/Club) describen 0424 como sustitución del helper externo de 0187, sin nueva allowlist app/lib y con seis consumidores `pg_depend`. Se confirma sobre la base 3c610701. Los rangos del anexo son del blob 0424:

- `L105-120`: `create or replace function public.get_portal_person_id()`, misma firma: sin argumentos, `returns uuid`, `language sql`, `stable`, `security definer`.
- `L11-97`: preflight, compuesto por:
  - tablas con RLS `:11-23`;
  - firma, owner `postgres`, configuración, md5 y ACL del helper `:24-41`;
  - inventario de 12 policies `:43-72`;
  - `pg_depend` exacto `:74-98`.

**Solo cambia el cuerpo; se conservan OID, ACL y policies:**

- `0424:102-103` declara que `CREATE OR REPLACE` conserva identidad/OID, propietario y ACL. PostgreSQL documenta que, al reemplazar una función, owner y permisos no cambian.
- El grep de `grant|revoke|drop|alter|insert|update|delete|truncate|create policy|create trigger|create table` en 0424 da 0 coincidencias. Además del `CREATE OR REPLACE` solo hay un COMMENT (`:122-123`) y dos bloques DO de lectura con `raise` (`:5-100`, `:125-141`).
- Cambian el cuerpo y `search_path` (`public` pasa a `''`). El postflight `:127-136` exige el md5 final, owner `postgres`, EXECUTE de authenticated y ninguno de anon.
- La sonda comprobó que catálogo y dependencias quedan iguales antes y después (`test:298-313,643-646`) y que la reejecución es idempotente (`test:647-652`).

**Preflight contra la base real del repo.** El md5 del cuerpo de `0187_club_portal_read.sql:34-40` es `d6d407d74ea4426a960fe03991625b35`, la constante de `0424:34`. El del cuerpo nuevo es `4dca9b6a048929d7fcfaf2314c6ff61f` (`0424:35,133`). En migraciones no hay barridos `ALTER FUNCTION` con format() que puedan desviar su configuración. La reconstrucción aplicó 0424 sobre toda la base sin abortar.

**Los seis consumidores `pg_depend`**, sin cambios de SQL:

| Tabla | Policy | Definición | Lector Portal |
|---|---|---|---|
| `club_members` | `club_members portal read` | `0187:49-55` | `portal-club-queries.ts:144-152,160-165` |
| `club_group_buys` | `club_group_buys portal read` | `0187:60-73` | `:186-191` |
| `club_group_buy_participants` | `club_gb_participants portal read` | `0187:78-89` | `:192-195` |
| `academy_cohorts` | `club_events portal read` | `0235:229-242` | `:196-203` |
| `club_event_registrations` | `club_event_registrations portal read` | `0235:245-256` | `:204-207` |
| `club_featured_suppliers` | `club_featured_suppliers portal read` | `0235:259-272` | `:208-215` |

**Cliente Portal legítimo** (principal y tenant coherentes: vínculo active, cliente vivo y persona ligada, todo en el tenant T):

- Antes: `get_portal_client_id()` (`0080:40-45`: `auth.uid()`, `status='active'`) → cliente → `clients.person_id` con `deleted_at is null` (`0187:35-39`).
- Ahora (`0424:112-118`): exactamente esas condiciones más `c.tenant_id = cu.tenant_id` y `p.tenant_id = c.tenant_id`, que en datos coherentes siempre se cumplen.
- Ninguna versión revoca por `persons.deleted_at` (`0424:104`).
- `client_users` tiene `unique (auth_user_id)` (`0080:30`): a lo sumo un vínculo por usuario, así que `limit 1` es determinista en ambas.
- Mismo `P`, mismas policies y mismo tenant de membresía: `club_members` exige persona del mismo tenant por trigger (`0185:113-115`). **Las seis devuelven las mismas filas.**
- Solo pasan a NULL los vínculos incoherentes (vínculo → cliente de otro tenant, cliente → persona de otro tenant). Es el defecto corregido: sonda RED 12/12 cruces, GREEN 0.

**Los flujos legítimos crean datos coherentes:**

- Invitación: tenant del propio cliente (`0080:106-113,139-140`).
- Autorregistro: mismo `tenantId` en cliente y vínculo (`app/registro/actions.ts:232-235,370-374`).
- Fusión: exige mismo tenant antes de mover el acceso (`0361:100-101,129-131`) y de heredar `person_id` del fusionado (`0361:258`).
- Vínculo de persona: nace del backfill de 0172 con persona derivada del cliente y su tenant (`0170:69-73`, `0172:19-24`).
- En app/lib, supabase/functions y scripts no hay escritores de `clients.person_id`: `club-member-queries.ts:40-42` y `academia/queries.ts:461-463` solo lo leen, y functions/scripts no lo mencionan.

**Consumidores de app, sin tocar:**

- `app/portal/(app)/club/page.tsx:13-21,39-41` → `getPortalClub` (`lib/portal/portal-club-queries.ts:159-216`), que lee las seis tablas con la sesión y confía en RLS (`:8`).
- Consumidor extra no listado en el encargo: `app/portal/(app)/layout.tsx:11,53` usa `isPortalClubMember` (`portal-club-queries.ts:144-152`) para mostrar el menú Club. Misma conclusión.
- Studio (`lib/studio/club/*`, `app/studio/(app)/club/*`, Academia) lee por las policies `by tenant` (p. ej. `0235:70-73,178-181`). Para usuarios de equipo sin vínculo active, el helper devuelve NULL antes y después.
- Llamadas directas a `get_portal_person_id` en app/lib/components/scripts/e2e/tests: **0**, lo que confirma el grep del Director.

**Precisión sobre `app/portal/(app)/proveedores/*`.** "Tus proveedores" (SDD-0057) **no lee ninguna de las seis tablas ni el helper**:

- `page.tsx:29-36` → `lib/studio/prealertas/queries.ts:104-113` (`suppliers_cn`), `:135-140` (`prealertas`) y `:471-476` (`prealerta_addons`).
- `actions.ts` usa `get_portal_client_markbox` (`:174-180`), `get_portal_client_tenant` (`:358,536,660,752`), `suppliers_cn`, `prealertas`, `prealerta_service_requests` y `prealerta_documents`.
- `SuppliersClient.tsx:22-26` solo importa esas actions.

Es decir, 0424 no lo afecta, ni para bien ni para mal. El "proveedores" del inventario `pg_depend` es `club_featured_suppliers` (Proveedor del mes), que se pinta en `club/page.tsx:246-265`.

**Diferencias frente a la spec histórica.** La spec y su allowlist son del origen: la allowlist actual del encargo prevalece, y `docs/audits/2026-09-02-codex-arranque-checklist.md` y el handoff de saneamiento no se importaron. Las cifras de la spec coinciden con esta medición:

- 374 aserciones y 27 derivas (`spec:125-126`).
- 421/403/18 (`spec:143`).

Las líneas `spec:NN` usan la numeración del archivo importado, con la nota incluida. Aun así, la evidencia vigente es la de este handoff. Los tests `lib/studio/club/__tests__` (4 archivos) son de tipos, no de RLS. El catálogo alojado de `spec:38-43` (2026-09-02) es evidencia histórica: el preflight debe repetirse fresco al aplicar (`spec:75`).

**Coordinación.** Esta PR comparte `supabase/migrations-baseline.json` y `docs/specs/README.md` con #69 (L19, 0431), #70 (L21, 0433) y #72 (L20). #71 no se solapa. Al integrar hay que **unir entradas y regenerar el índice**, sin elegir un lado; el driver `dtd-generated-records` está verificado en este clon. No hay dependencia SQL con otros lotes.

Fusionar NO autoriza aplicar `0424_portal_club_principal_tenant`. Hace falta OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`, de a una y con `name` exacto. Si el catálogo real se desvía de 0187, el preflight aborta sin escribir: no editar 0424, sino preparar una migración de avance con número asignado por el Director.

**Ownership.** Hay una sola sesión escritora, `c-l15-worker-20260911-claude`, sin subagentes ni otros procesos escritores. Secuencia de cierre:

1. Commit y push de este handoff.
2. `gh pr edit` del cuerpo con el SHA final.
3. Revalidar remoto y estado.
4. Liberar con `node scripts/harness-worktree.mjs release --owner c-l15-worker-20260911-claude` y confirmarlo con `finish c-l15-portal-club` (solo informe).

El recibo de liberación va en la respuesta final al Director. No se borran rama ni worktree.

Procesos propios de esta sesión: el `verify` de este worktree, cuyo dev server E2E en el puerto 3685 cierra el propio runner, y los contenedores `dtd_sqltest_*`, `dtd_rebuild_*` y `dtd_l15probe_*` derivados de esta ruta. No se tocaron contenedores ni sesiones ajenas: la pila `supabase_*_dtd-pr28-auth-*` sigue activa en Docker y es de otra tarea. Una sesión futura debe reclamar ownership de nuevo.
