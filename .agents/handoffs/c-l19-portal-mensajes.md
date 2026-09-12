# Handoff — C / L19: frontera principal/tenant de `portal_post_message`

Fecha: 2026-09-11. Task ID: `c-l19-portal-mensajes`.
Owner / sesión escritora: `c-l19-worker-20260911-claude` (Worker Claude Code, sesión `454d97be-b1e0-4fc9-97e9-c6bb621ba84c`), asignado por el Director. Sin subagentes.
Estado de tarea: lista-para-revision. PR draft #69 publicada; no integrada ni aplicada. `verify` no quedó verde completo por límites de entorno (detalle en VALIDACIÓN).

- Repo: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`. El checkout principal, que tiene cambios ajenos, no se modificó.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l19-portal-mensajes`.
- Rama: `codex/c-l19-portal-mensajes`, publicada con upstream propio.
- Base asignada y HEAD inicial: `3c6107012f754953323202a7386b3e7811593814`, igual a `origin/main` al iniciar, antes del commit y al cerrar (`git fetch origin` a las 03:1x -04). Main no avanzó, así que no hizo falta merge.
- Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7` (head de PR #21). Solo se leyeron blobs; la PR y su rama no se tocaron.
- SDD: `docs/specs/0385-portal-conversation-message-principal-tenant/spec.md`, importada exacta con una nota aditiva. Su `status: done` es el histórico del origen: no es evidencia de esta ejecución ni de producción.

## OBJETIVO ORIGINAL

Preparar el lote L19 del bloque C (frontera principal/tenant de la RPC `portal_post_message`) para integrarlo en main mediante PR draft:

- importar la migración 0431, su contrato SQL y la spec 0385;
- declarar `0431_portal_post_message_principal_tenant` pendiente de aplicar;
- sin cambios en app/lib.

El Worker no fusiona ni aplica en producción.

## COMPLETADO

- **Aislamiento:** `guard` OK sobre árbol limpio y claim `c-l19-worker-20260911-claude` adquirido. Guard con owner y rama revalidados antes de cada commit y push.
- **Importación:** los tres archivos se copiaron con `git cat-file blob` desde los OID asignados. La identidad está en la tabla de abajo.
- **Nota de la spec:** nota de importación fechada bajo el título (L16-L21), con la misma forma que la de `docs/specs/0363-portal-reclamos-tenant-boundary/spec.md`. Retirarla devuelve el Buffer original de 3031 bytes y el OID `f39db7b3…`. Frontmatter intacto.
- **Baseline:** solo se añade la clave `0431_portal_post_message_principal_tenant`. La comparación estructural contra la base confirma que `$doc`, cutoff 238 y las esperas 0409/0418/0419/0430 son idénticos, que no se retiró ninguna y que se conserva el orden.
- **Índice:** regenerado con `corepack pnpm docs:index` (416 specs, 36 huecos). El diff es la fila 0385, el contador y la lista de huecos.
- **Declaraciones de símbolos:** `supabase/pending-migration-symbol-declarations.json` no se tocó, porque el gate dio 0 ROJO.
- **Compatibilidad del caller:** documentada, resultado COMPATIBLE (sección de abajo). **Datos personales:** no aplica.
- **Publicación:** push explícito de la rama a sí misma y PR draft #69 contra main.

Estado de la aceptación del encargo:

1. PASÓ: migración idéntica por blob a `f12f804047b4ef75c48e74977012ae0e02cb7038` (6041 bytes), en el worktree y en el índice del commit.
2. PASÓ: contrato idéntico por blob a `0f2868678aaf009fa58914c9e4306a17e57b9b0a` (13851 bytes).
3. PASÓ: al retirar solo la nota, la spec es igual byte a byte al origen `f39db7b30c59b429706bff83e559a263f8ab524a`.
4. PASÓ: el baseline solo añade la espera 0431. Menciona «bloque C L19 / SDD-0385», que fusionar NO autoriza aplicar, el OK nominal de Sam con `docs/runbooks/aplicar-migraciones-prod.md` y la aplicación individual con `name` exacto.
5. PASÓ: `docs/specs/README.md` regenerado por el generador, sin edición manual.
6. PASÓ: compatibilidad documentada con archivo:línea; no hay incompatibilidad.
7. PASÓ: este handoff y la PR draft #69.

### Identidad por blob

Salida de `blobs-iniciales.log`. Compara `git rev-parse ea9952a4:<ruta>`, `git hash-object --no-filters`, `git hash-object` con atributos y `cmp` contra `git cat-file blob`:

```text
PASO supabase/migrations/0431_portal_post_message_principal_tenant.sql bytes=6041 esperado=f12f804047b4ef75c48e74977012ae0e02cb7038 origen=f12f804047b4ef75c48e74977012ae0e02cb7038 worktree_raw=f12f804047b4ef75c48e74977012ae0e02cb7038 worktree_filtros=f12f804047b4ef75c48e74977012ae0e02cb7038 cmp=IGUAL
PASO supabase/tests/0431_portal_post_message_principal_tenant.test.sql bytes=13851 esperado=0f2868678aaf009fa58914c9e4306a17e57b9b0a origen=0f2868678aaf009fa58914c9e4306a17e57b9b0a worktree_raw=0f2868678aaf009fa58914c9e4306a17e57b9b0a worktree_filtros=0f2868678aaf009fa58914c9e4306a17e57b9b0a cmp=IGUAL
PASO docs/specs/0385-portal-conversation-message-principal-tenant/spec.md bytes=3031 esperado=f39db7b30c59b429706bff83e559a263f8ab524a origen=f39db7b30c59b429706bff83e559a263f8ab524a worktree_raw=f39db7b30c59b429706bff83e559a263f8ab524a worktree_filtros=f39db7b30c59b429706bff83e559a263f8ab524a cmp=IGUAL
```

La spec final con la nota tiene blob `7dbcf66a04bfcec596d6d2901acbcdd4eb6e7344` (3581 bytes). No se presenta como identidad del blob final: la nota la exige el encargo, y la igualdad se demuestra retirándola. En el índice del commit `727bdc90`, la migración es `f12f8040…` y el contrato `0f286867…`. Los tres blobs de origen solo tienen LF, y `.gitattributes` marca `supabase/{migrations,tests}/*.sql -text`.

### Compatibilidad del caller (aceptación 6): COMPATIBLE

Comparación de 0106 (`supabase/migrations/0106_conversaciones.sql:201-266`) contra 0431 (`supabase/migrations/0431_portal_post_message_principal_tenant.sql:52-130`):

- **Firma:** sin cambio. `portal_post_message(p_body text) returns uuid`, SECURITY DEFINER (0106:201-205, 0431:52-56). El pre y postflight lo exigen (0431:28-34, 137-142). El caller `app/portal/(app)/mensajes/actions.ts:33-36` llama `supabase.rpc("portal_post_message", { p_body: body })`: mismo nombre y mismo parámetro, que PostgREST resuelve por nombre.
- **Retorno:** sigue siendo el id del hilo (0106:259, 0431:122). `actions.ts:44-48` comprueba `typeof conversationId === "string"` y se lo pasa a `notifyConversationInbound`. Este lo lee por id con `service_role` (`lib/studio/conversation-inbound-notify.ts:64-80`) y avisa solo si `unread_count == 1` (`:83`). Esa semántica se conserva: el hilo nuevo nace con 0 y el UPDATE suma 1 (0431:106, 118); el contrato lo verifica en `test:219, 231-236`.
- **Errores:**
  - Validación del cuerpo, mismos textos (P0001): 0106:215-220, 0431:67-72.
  - Identidad: sigue siendo 42501 con otro texto (0106:224-226 → 0431:90-93).
  - Cliente retirado: pasa de P0001 «Cliente no encontrado» (0106:231-233) a 42501.
  - El caller no inspecciona código ni texto: cualquier `error` produce el mismo mensaje genérico (`actions.ts:38-40`). La pre-validación del action (`actions.ts:26-30`) coincide con la RPC.
- **ACL:** `authenticated` y `service_role` conservan EXECUTE; `PUBLIC` y `anon` siguen sin él (0431:129-130, igual al estado de 0209:102-103 y 0288:4365-4366). El pre y postflight verifican la ACL efectiva (0431:36-48, 153-165).
  - El caller usa el cliente de sesión, rol `authenticated` (`actions.ts:4, 32`).
  - Notify usa `service_role` pero no llama la RPC: lee y actualiza tablas (`conversation-inbound-notify.ts:69-72, 95-99, 156-160`).
- **`lib/portal/portal-conversation-queries.ts`:**
  - Qué lee: `getPortalLastReplyAt` (`:38-48`), `getPortalConversationId` (`:67-78`) y `getPortalThread` (`:126-136`) filtran con `service_role` por `client_id` + `channel='portal'` + `deleted_at is null`, con `maybeSingle`.
  - El hilo: 0431 crea o reutiliza el mismo hilo vivo (0431:95-99, igual que 0106:236-240). El índice único parcial `conversations_client_channel_live_idx` (0106:67-69) garantiza un solo hilo vivo.
  - De dónde sale `client.id`: de `getPortalClient` → principal de L18, en `app/portal/(app)/soporte/page.tsx:59-61, 91, 96` y `app/portal/(app)/layout.tsx:38-40, 58-61`. Ese principal (`lib/portal/portal-queries.ts:59-129`) exige vínculo activo, cliente vivo y tenant coherente (`:62-89`), lo mismo que 0431 (0431:74-93).
  - Efecto: con 0431 aplicada, quien escribe y quien lee el hilo resuelven el mismo cliente. Hoy, un vínculo incoherente escribe en el cliente B (`test:101-117`), mientras la app ya lo rechaza.
- **Unicidad:** `client_users.auth_user_id` es único (`0080_portal_cliente.sql:30`) y ninguna migración posterior lo altera (0226/0227 solo añaden columnas). Exigir «exactamente una coincidencia» no rechaza sesiones que hoy funcionan.
- **Matiz no bloqueante:** el principal TypeScript exige además `markbox` y `name` no vacíos (`portal-queries.ts:87-88`) y la RPC no. Toda sesión que la app acepta, la RPC también la acepta.
- **Resto de usos:** son comentarios (`lib/studio/conversaciones/messages-queries.ts:9, 86`; `lib/studio/conversaciones/inbound-email.ts:21, 265`). `app/portal/(app)/mensajes/page.tsx:9-11` solo redirige a Soporte.

### Datos personales: no aplica

0431 no cambia qué columnas ni qué datos se escriben:

- **Escrituras:** el INSERT de `conversations`, el INSERT de `conversation_messages` y el UPDATE (0431:101-120) usan las mismas columnas que 0106:244-257.
- **Datos:** `author_name` sigue saliendo de `clients.name` (0106:228, 0431:78) y `body` es el mismo texto que ya envía el cliente.
- **Lecturas:** solo se añade `client_users.tenant_id`, un identificador de tenant y no un dato personal.

Solo endurece identidad y tenant (0431:74-93): no hay captura, movimiento ni borrado nuevo. Por eso no se hizo la revisión focal de `.claude/skills/revisar-datos-ve/SKILL.md`.

### Gobernanza

Matriz SGE-00 (`docs/governance/policies/sge-00.md:47-60`). Es proporcional a una extracción solo SQL/documental, sin UI. No declara conforme el legado ni el estado productivo.

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.05 permisos/tenant/privacidad | cumple, evidencia local | La RPC exige tenant coherente en el servidor (0431:74-93). Hay pruebas negativas para vínculo de otro tenant, revocado, invitado, cliente retirado, sin vínculo y sin `auth.uid` (`test:189-206`), y ACL negativa para anon/PUBLIC (`test:252-261`). La app ya aplicaba el principal de L18; ahora la DB tampoco depende de la UI. Producción: NO VERIFICABLE hasta su aplicación nominal. |
| SGE-00.06 prevenir errores | cumple (se conserva) | La validación del cuerpo va antes de la mutación (0431:67-72, `test:238-250`) y un principal inválido falla antes de cualquier DML (`test:204-206`). |
| SGE-00.07 estado verdadero | no aplica | No cambian estados UI. El action solo devuelve `ok` después de que la RPC termina sin error (`actions.ts:38-52`, sin cambios). |
| SGE-00.11 lenguaje | no aplica | Cambia el texto del error 42501 en la DB, pero la UI muestra su propio mensaje genérico (`actions.ts:38-40`). |
| SGE-00.12 autoridad humana | no aplica a IA | No hay acción propuesta por IA en el producto. La acción crítica de este lote, aplicar 0431 en producción, conserva la autorización nominal de Sam. |
| SGE-00.01-.04, .08-.10 | no aplica | Sin verbos, acciones UI, fricción, auditoría financiera o de permanencia, pasos, componentes ni accesibilidad nuevos; app/lib no cambian. |

Backend Norte: `docs/design/studio/_norte/backend/README.md:18,21` pide que el servidor filtre por tenant y sea la frontera de seguridad. 0431 lleva esa regla a la RPC.

## VALIDACIÓN

- PASÓ: `guard` y claim; raíz, rama y base `3c610701`; árbol inicial limpio; `git fetch origin` sin avance de main al iniciar, antes del commit y al cerrar.
- PASÓ: `corepack pnpm install --frozen-lockfile`, exit 0 en 25.5 s, con Node v24.20.0 y pnpm 12.3.4. Lockfile intacto y árbol limpio después.
- PASÓ: identidad por blob, 3 de 3 (bloque anterior), y comprobación estructural de spec y baseline (`estructura.log`, 22 comprobaciones).
- PASÓ: `node scripts/install-merge-drivers.mjs --check`, driver `dtd-generated-records` verificado.
- PASÓ: `corepack pnpm sdd:check` (416 specs · 421 migraciones; solo choques históricos ya exentos), `corepack pnpm docs:index` (416 specs, 36 huecos) y `corepack pnpm docs:check`.
- PASÓ: `node scripts/check-schema-rebuild.mjs` standalone, exit 0 en 27 s.
  - Cubrió 421 archivos: 403 migraciones aplicadas desde cero y 18 solo-ledger verificadas sin tocar el esquema.
  - Barrido de aislamiento sobre 219 tablas. La salida habla de «2 tenants reales», pero son tenants que inserta `supabase/tests/_tenant-isolation.assert.sql:133` en el Postgres efímero, no de producción.
- PASÓ: `node scripts/check-pending-migration-symbols.mjs`, con 0 ROJO · 0 AMARILLO.
  - `findPendingOnlySymbols` (`scripts/check-pending-migration-symbols.mjs:220-249`) trata el `CREATE OR REPLACE` de 0431 sobre la función que crea 0106 como una redefinición.
  - Declaraciones intactas.
- PASÓ: contrato focal 0431, en el contenedor propio `dtd_l19_focal_1789108626` con PostgreSQL 17.11 (`postgres:17`).
  - GREEN: exit 0, 22 aserciones, `fixture_0431_rolled_back = t`.
  - RED causal (`-v apply_fix=false`): falla en `test:192` con «Vínculo tenant/cliente incoherente falla 42501 antes de escribir», como el contrato lo diseña. La aserción RED de base, que reproduce la escritura cruzada, se cumple en ambas corridas.
  - La base quedó vacía y el contenedor, retirado.
- PASÓ: `git diff --cached --check`, allowlist preparada de 5 rutas y OID del índice antes del commit `727bdc90`. También `git diff --check origin/main`, y `git diff --name-status origin/main` muestra exactamente esas 5 rutas.
- **FALLÓ `corepack pnpm verify`, exit 1**, entre `2026-09-11T02:38:51-04:00` y `03:10:04-04:00` (31 min), sobre el contenido exacto de `727bdc90`; este handoff estaba sin seguimiento. Sin variables `VERIFY_*`, `E2E_PORT` ni Supabase en el entorno; en el worktree solo hay `.env.example`.
  - Resultado: **16 de 17 pasos corrieron: 15 PASÓ, e2e FALLÓ y migrations-applied NO DISPONIBLE.**
  - Veredicto del runner: «1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied».
  - No es verde completo ni certificación de producción. El commit posterior solo agrega este handoff y no cambia el contenido probado.
  - PASÓ: harness, 18/18.
  - PASÓ: lint, 0 errores y 8 warnings preexistentes (ver fuera de alcance).
  - PASÓ: rsc-boundary, 1597 módulos.
  - PASÓ: typecheck.
  - PASÓ: edge-functions, 4 funciones compilan.
  - PASÓ: test (Vitest), 526 archivos y 6684 tests, sin fallos.
  - PASÓ: docs:check, numbering, feature-constants (5 banderas), components:check y governance:check.
  - NO DISPONIBLE: migrations-applied. SKIP explícito por falta de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se consultó producción.
  - PASÓ: pending-migration-symbols, 0 ROJO · 0 AMARILLO.
  - PASÓ: sql-tests, 163 contratos y 0 fallos, incluido `0431_portal_post_message_principal_tenant.test.sql`, con rollback total.
  - PASÓ: schema-rebuild, 421 archivos: 403 + 18 solo-ledger; 219 tablas.
  - **E2E: FALLÓ el comando (exit 1) y NO DISPONIBLE como cierre autenticado.** Dev server propio en el **puerto 3479**; 186 tests con 8 workers.
    - Primera pasada: 151 pasaron, 15 fallaron, 2 flaky y 18 omitidos (10.2 min).
    - Reintento propio del runner (1/1, «flaky conocido»): 153 pasaron, 15 fallaron y 18 omitidos (8.3 min).
    - Los 15 fallos, en ambas pasadas: `e2e/auth.spec.ts:21, :91, :98, :105` y `e2e/global-search.spec.ts:22`, en chromium, mobile-chrome y mobile-safari. El webServer registra «Your project's URL and Key are required to create a Supabase client!» en `proxy.ts:67`. Es el mismo patrón que registran L13 (`.agents/handoffs/c-l13-portal-reclamos.md:39`) y L18 (`.agents/handoffs/c-l18-portal-principal.md:131`).
    - Los 2 flaky de la primera pasada son `e2e/calculadora-semantic-colors.spec.ts:53` (light/dark, chromium) y quedaron verdes en la segunda.
    - No hubo timeout del webServer ni del teardown. Clasificación ambiental: esta tarea no cambia app/lib ni código que ejecuten esos specs.
    - No se modificaron retries, timeouts ni tests, no se reintentó a mano y no se buscaron credenciales.
  - PASÓ: build.
    - Next.js 16.2.11: compiló en 26.7 s, TypeScript en 77 s, 160 páginas estáticas y postbuild Norte.
    - Durante el prerender, los fetchers públicos registraron «Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY» y degradaron sin romper el build.
    - El runner restauró `tsconfig.json` y retiró `.next-verify`. Después se comprobó: árbol limpio salvo este handoff, sin contenedores `dtd_*` ni procesos node del worktree.
- PASÓ: CI remoto «Calidad local sin secretos» del commit `727bdc90`, [run 34571037173](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34571037173), 11m45s, evento `pull_request`. El CI del commit de cierre (este documento) se consulta aparte por SHA en la PR; no se le atribuye este verde. Un verde de CI no sustituye los contratos SQL efímeros, schema-rebuild, E2E autenticado ni el ledger Supabase de arriba.
- NO EJECUTADO: `/ui-check`, porque no hay UI.
- NO EJECUTADO, fuera de la autorización del Worker: merge, aplicar 0431 en producción, leer datos de producción, deploy manual y cambios al ruleset.
- Informativo: el preview automático de Vercel del push quedó en `pass`. No es un deploy manual ni una prueba.

Evidencia local fuera de Git, en `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/454d97be-b1e0-4fc9-97e9-c6bb621ba84c/scratchpad/c-l19-portal-mensajes/`: `install.log`, `blobs-iniciales.log`, `estructura.log`, `docs-index.log`, `sdd-check.log`, `docs-check.log`, `pending-symbols.log`, `schema-rebuild.log`, `sql-focal.log`, `verify.meta`, `verify.log`, `verify.exit` y el cuerpo de la PR.

## COMMITS

- `727bdc90153cf7357ec606c0550f0bb3811820a5` — `feat(studio): SDD-0385 — importar L19 portal_post_message pendiente de aplicar`. Contiene las cinco rutas: migración, contrato, spec con nota, espera en el baseline e índice regenerado. Es el contenido que midió `verify`.
- Commit que contiene este documento — cierre durable del Worker, solo documentación. Su SHA final queda en la PR, sin recursión de commits.

## PR / BRANCH

[PR #69 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/69): base `main`, rama `codex/c-l19-portal-mensajes`, publicada con `git push -u origin codex/c-l19-portal-mensajes:codex/c-l19-portal-mensajes`. El worktree es el indicado arriba. No se fusionó ni se desplegó manualmente.

## PENDIENTES DE ESTA TAREA

No quedan pendientes de extracción ni de preparación. Para integrar falta:

- que el Director revise la PR #69 y el CI del SHA final;
- aceptar los límites de entorno explícitos (E2E autenticado y `migrations-applied` NO DISPONIBLES);
- unir el baseline y regenerar el índice con L20/L21;
- la autorización de merge.

No se aplicará una migración para poner en verde un gate. La aplicación productiva de 0431 es otra tarea, con OK nominal.

## FUERA DE ALCANCE DETECTADO

- **Comentario desactualizado en `app/portal/(app)/mensajes/actions.ts:11-13`:** dice que la RPC resuelve la identidad con `get_portal_client_id`. Cuando 0431 se aplique, la RPC resolverá el principal directamente (0431:74-93). No se editó, porque app/** está excluido.
- **Comentario desactualizado en `app/portal/(app)/layout.tsx:29-31`:** dice que `getPortalClient()` usa `get_portal_client_id()`. Desde L18 delega en el principal (`lib/portal/portal-queries.ts:125-129`). Ajeno a L19.
- **Lint:** 8 warnings preexistentes y 0 errores. `app/portal/(app)/compras/nueva/NewPurchaseWizard.test.tsx` (4) y `PurchaseStepDetalle.test.tsx` (2) tienen argumentos sin uso; `app/studio/(app)/crm/_components/KommoBoardView.tsx` (1) y `KommoClient.tsx` (1), avisos de React. No se tocaron.
- **Entorno E2E y build sin configuración Supabase:** 15 fallos de auth/global-search (`proxy.ts:67`) y errores registrados, pero tolerados, de los fetchers públicos durante el prerender. La primera pasada tuvo además 2 flaky en `calculadora-semantic-colors.spec.ts:53`. Son límites o incidencias del entorno ajenos a L19; no se reprodujeron aparte.
- **Aviso de pnpm 12.3.4:** `pnpm.onlyBuiltDependencies` en package.json ya no se lee (`install.log:1`). La instalación congelada terminó en 0; no se cambió el manifiesto.
- **Redacción de `scripts/check-schema-rebuild.mjs:315`:** la salida «2 tenants reales» puede leerse como producción, pero son sintéticos (`_tenant-isolation.assert.sql:133`). No se cambió.
- **Ruta del README de backend Norte en AGENTS.md:** cita `_norte/backend/README.md`, pero el archivo vive en `docs/design/studio/_norte/backend/README.md`. Se leyó en esa ruta.

## HANDOFF AL DIRECTOR

**Coincide con el plan.** `docs/audits/c-analisis-bloque-c.md:88` (L19 sin allowlist app/lib; mensajes/actions ya llama la RPC; independiente de L21) y el anexo `docs/audits/c-analisis-bloque-c-sql.md:80, 158` (sustituye `portal_post_message(text)`, mantiene la ACL; antecedentes 0006/0080/0106) se confirman. El contrato incluye 0006/0080/0106 (`test:49-51`) y simula el estado de ACL posterior a los barridos (`test:53-57`). 0431 y 0433 no se llaman entre sí (`c-analisis-bloque-c-sql.md:29`).

**Precisiones:**

- La base `3c610701` ya contiene L09/L12/L13/L16/L18. Las esperas vigentes son 0409/0418/0419/0430; 0425/0427 figuran aplicadas en b49f1c0b.
- Con L19 hay 421 archivos de migración.
- La allowlist de la spec origen menciona «auditoría local del slice» y «checklist de arranque y handoff del saneamiento». Son rutas históricas de #21 que no se importaron; prevalece la allowlist de este encargo.
- Las cifras y casillas de la spec (15 refs, contrato y reconstrucción verdes) son del origen. La evidencia vigente es la de este handoff.

**Integración.** L20 (0432) y L21 (0433) comparten con esta PR solo `supabase/migrations-baseline.json` y `docs/specs/README.md`. Al integrar hay que **unir las entradas** y **regenerar** el índice, sin elegir un lado; el driver `dtd-generated-records` está verificado en este clon. Antes de integrar, revisa el SHA y la base vigentes.

**Aplicación en producción.** Fusionar NO autoriza aplicar `0431_portal_post_message_principal_tenant`: requiere OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`, con `name` exacto. El preflight de 0431 aborta sin cambios parciales si la ACL efectiva, la RLS de las cuatro tablas, la firma o SECURITY DEFINER del RPC no coinciden con lo esperado (0431:5-50; escenario de drift en `test:147-167`). Al aplicarse cambia quién puede publicar mensajes: los vínculos incoherentes, los revocados, los invitados y los clientes retirados quedan fuera con 42501.

**Ownership.** Única sesión escritora: `c-l19-worker-20260911-claude`, sin subagentes ni sesiones consumidoras delegadas. La secuencia de cierre es: commit y push de este documento, actualizar el cuerpo de la PR con el SHA final, consultar el CI de ese SHA y liberar con `node scripts/harness-worktree.mjs release --owner c-l19-worker-20260911-claude`. El recibo de liberación va en el reporte final al Director. No se borran la rama ni el worktree. Una sesión futura debe reclamar el ownership de nuevo.
