# Handoff — C / L21: frontera Realtime de mensajes del Portal

Fecha: 2026-09-11. Task ID: `c-l21-portal-realtime-mensajes`.
Owner / sesión escritora: `c-l21-worker-20260911-claude` (Worker Claude Code asignado por el Director). No hubo subagentes.
Estado: lista-para-revision, con límites de entorno explícitos: E2E colgado y detenido a indicación del Director, build cubierto solo por CI, y ledger y Realtime real NO DISPONIBLES. No está integrada ni aplicada. El claim se adquirió después de `guard`, con el worktree asignado limpio y sin claim previo. Se libera después de publicar este documento y comprobar el CI del SHA final.

- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l21-portal-realtime-mensajes`.
- Rama: `codex/c-l21-portal-realtime-mensajes`.
- Base asignada y HEAD inicial: `3c6107012f754953323202a7386b3e7811593814`. Coincidía con origin/main después de `git fetch origin`, y siguió igual en la comprobación posterior, así que no hizo falta merge.
- Origen de solo lectura: `ea9952a47f4adf14c48c91e6d0147597beb94aa7`, head de la PR #21 (`codex/saneamiento-integral`), confirmado con `gh pr view 21`. Es el único ref que contiene las rutas 0433/0401 de este lote.
- SDD: `docs/specs/0401-portal-conversation-realtime-principal-tenant/spec.md`. Frontmatter y `status: done` históricos intactos; solo se añadió la nota de importación. No se reservó número. No se debe confundir con la migración `0401_portal_brand_por_principal` del lote L01.

## OBJETIVO ORIGINAL

Preparar L21 del bloque C para integrarlo en main mediante PR en borrador. L21 fija la frontera de principal y tenant del Realtime de mensajes del Portal. El trabajo consistía en importar la migración 0433, su contrato SQL y la spec 0401, y declarar `0433_portal_conversation_realtime_principal_tenant` pendiente de aplicar, sin cambios en app/lib. El Worker no fusiona ni aplica nada en producción.

## COMPLETADO

- Aceptación 1: la migración `supabase/migrations/0433_portal_conversation_realtime_principal_tenant.sql` es idéntica por blob al origen (`642226f8d4e3265f4051616330f0ce3813a45818`, 5633 bytes).
- Aceptación 2: el contrato `supabase/tests/0433_portal_conversation_realtime_principal_tenant.test.sql` es idéntico por blob (`0f6efeb3f1011bf9733361b53de00e0370dc7b3a`, 12467 bytes).
- Aceptación 3: la spec 0401 se importó desde el blob `6a14723e5e6e9f6ebf6504676caeb5c35a32d700` (2574 bytes) y solo se le añadió una nota fechada bajo el título, con la misma forma que la de la spec 0363. Si se retiran las líneas 16-22 (seis de nota y una en blanco), el archivo vuelve a ser el blob original byte a byte (`cmp` sin diferencias). Con la nota: `bf8688c204048c106fea3c0ab02724b7ca2264d5`, 3133 bytes, sin CR.
- Aceptación 4: en `supabase/migrations-baseline.json` solo se añade la clave `0433_portal_conversation_realtime_principal_tenant` en `pendingBelowCutoff`, con el formato de las esperas vigentes. El texto dice «bloque C L21 / SDD-0401», que fusionar NO autoriza aplicarla, que hace falta OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`, y que se aplica sola con `name` exacto. También recuerda validar después la suscripción Realtime de `/portal/soporte`. Una comprobación estructural contra HEAD confirmó: `cutoff` 238, `$doc` igual, las cuatro esperas previas sin cambios y el archivo 0433 presente.
- Aceptación 5: `docs/specs/README.md` se regeneró con `corepack pnpm docs:index` (416 specs, 36 huecos): se añade la fila 0401 y 0401 sale de la lista de huecos.
- Aceptación 6: la revisión de la función y la policy está documentada abajo con `archivo:línea`.
- Aceptación 7: este handoff y la PR en borrador #70 contra main.

Alcance exacto: los cinco archivos anteriores más este handoff. No se tocaron app/lib, otros lotes C (L19 cambia `portal_post_message` y no se mezcla), cutoff, esperas existentes, `supabase/pending-migration-symbol-declarations.json`, ruleset ni la rama de la PR #21.

### Revisión de `portal_can_read_conversation_message(uuid,uuid)` y de su policy

Las referencias `0433:N` apuntan a `supabase/migrations/0433_portal_conversation_realtime_principal_tenant.sql` y las `test:N` al contrato con el mismo prefijo.

**Definición**

- Es SECURITY DEFINER (`0433:57`), `stable` (`0433:56`), `language sql` (`0433:55`) y devuelve boolean (`0433:54`). El postflight exige `prosecdef`, volatilidad `s` y retorno boolean (`0433:101-111`).
- El search_path está sellado con `set search_path = ''` (`0433:58`). Todos los objetos van calificados: `public.client_users` (`0433:62`), `public.clients` (`0433:63`), `public.conversations` (`0433:67`) y `auth.uid()` (`0433:72`). El postflight exige `search_path=""` en `proconfig` (`0433:107-111`).
- El predicado exige principal activo (`0433:72-73`), cliente vivo y del mismo tenant que el vínculo (`0433:63-66`), hilo Portal vivo del mismo cliente y tenant (`0433:67-71`), que sea el hilo pedido (`0433:74`) y que el tenant del mensaje coincida con el del hilo (`0433:75`).
- Solo devuelve un boolean, sin contenido ni ids (`0433:54`, `0433:60-76`). No sirve como oráculo sobre hilos ajenos: el join parte del `client_users` del propio llamante, así que para cualquier hilo ajeno devuelve `false`, exista o no.

**Revoke y grant**

- La migración hace `revoke all ... from public, anon, service_role` (`0433:79-80`) y `grant execute ... to authenticated` (`0433:81-82`). El postflight exige que anon no tenga EXECUTE, que authenticated sí lo tenga, que service_role no lo tenga y que no haya entrada PUBLIC (`0433:125-136`). El contrato lo comprueba otra vez (`test:250-265`).
- `authenticated` **sí necesita** EXECUTE. PostgreSQL evalúa las expresiones de las policies con los privilegios de quien consulta, y las policies permisivas se combinan con OR. Sin ese grant fallaría por permiso de función cualquier SELECT de `authenticated` sobre `conversation_messages`, incluida la bandeja del equipo, no solo el Portal.
- `anon` no lo necesita. La policy es `to authenticated` (preflight `0433:28`, postflight `0433:141`) y no hay ninguna policy de anon sobre la tabla.
- `service_role` tampoco lo necesita. Esta policy no se le aplica y ese rol tiene su propia policy, `conversation_messages service_role all` (`0106_conversaciones.sql:147-151`). El contrato confirma que sigue leyendo los 5 mensajes (`test:240-247`).
- Hay un precedente aplicado: 0427, aplicada en producción según `b49f1c0b`, usa el mismo patrón de revoke/grant y el mismo postflight con `service_role` sin EXECUTE (`0427_portal_delete_delivery_address_command.sql:139-141`, `:155-163`). Esto sugiere, por analogía, que el postflight de 0433 se puede cumplir en el catálogo real. El catálogo de producción no se consultó.

**Policy**

- La migración ejecuta `alter policy "conv_messages portal client read own" ... using (public.portal_can_read_conversation_message(conversation_id, tenant_id))` (`0433:87-91`). ALTER POLICY conserva el nombre, el comando SELECT, el rol `authenticated` y el carácter permisivo.
- El preflight exige el inventario exacto de tres policies y la expresión histórica con `get_portal_client_id` (`0433:24-47`). El postflight exige la expresión nueva y que la histórica haya desaparecido (`0433:138-146`).
- El contrato verifica que no cambian las demás policies, la ACL de la tabla ni RLS (`test:136-142`, `test:176-195`). También comprueba que el preflight rechaza drift (`test:147-173`).

**¿El cliente sigue leyendo su propio hilo? Sí, y es la primera versión en que lo consigue por RLS.**

- La expresión histórica de 0217 (`0217_portal_conversation_read.sql:30-40`) filtra con una subconsulta sobre `conversations`, que corre con la RLS de quien consulta. La única policy de `authenticated` en `conversations` es `conversations by tenant` (`0106_conversaciones.sql:128-132`). Esa policy exige `get_user_tenant_id()`, que lee `user_tenants` (`0200_rbac_disabled_enforcement.sql:50-62`), y un cliente del Portal no tiene fila ahí (`0080_portal_cliente.sql:6-7`). Por eso la subconsulta queda vacía y Realtime no entregaba nada. En `supabase/migrations/` no existe ninguna otra policy sobre `conversations`. El contrato reproduce ese caso en RED: un principal válido recibe cero mensajes (`test:114-125`).
- La función nueva es SECURITY DEFINER y lee `conversations` sin la RLS de quien consulta. Así, el principal válido ve su mensaje coherente y solo ese (`test:197-206`, sobre los datos de `test:107-112`). Quedan fuera el mensaje de otro tenant, el mensaje con tenant discordante, el canal email y el hilo borrado. Un vínculo incoherente o revocado ve cero mensajes y el Portal no puede insertar directamente (`test:207-229`). El staff conserva su lectura por tenant (`test:230-237`).
- Las filas legítimas cumplen la coherencia de tenant que exige la función:
  - el mensaje del cliente se inserta con el tenant del cliente y en su propio hilo Portal (`0106_conversaciones.sql:228-250`);
  - la respuesta del equipo usa el tenant del staff después de leer el hilo bajo RLS de tenant (`app/studio/(app)/conversaciones/actions.ts:90-116`, `lib/studio/conversaciones/messages-queries.ts:52-60`), con la WITH CHECK `tenant_id = get_user_tenant_id()` (`0106_conversaciones.sql:141-145`);
  - el vínculo se crea con el tenant del cliente (`0080_portal_cliente.sql:106`, `:139`).
- Frente a 0217 la regla es más estricta. Además de canal Portal e hilo vivo, exige cliente vivo (`0433:66`) y tenant coherente entre vínculo, cliente, hilo y mensaje (`0433:65`, `0433:69`, `0433:75`). Un cliente con `deleted_at` o un vínculo con tenant incoherente deja de recibir Realtime. Eso es lo que busca la spec (sección «Contrato acotado»).

**Consumidor que no se toca: `app/portal/_components/PortalChatLive.tsx`**

- Se suscribe con `useRealtimeRefresh` sobre `conversation_messages`, con filtro `conversation_id=eq.<id>` y desactivado si no hay id (`PortalChatLive.tsx:30-34`). El hook abre `postgres_changes` con `event: "*"`, `schema: "public"`, esa tabla y ese filtro (`lib/studio/hooks/use-realtime-refresh.ts:73-91`). Solo dispara `router.refresh()` con debounce (`use-realtime-refresh.ts:83-90`) y no lee columnas del payload.
- Chequeo estático del filtro y las columnas:
  - el filtro usa `conversation_id`, que es columna de la tabla (`0106_conversaciones.sql:89`);
  - la policy recibe `conversation_id` y `tenant_id` de la propia fila (`0106_conversaciones.sql:88-89`, `0433:90`);
  - `authenticated` conserva SELECT sobre toda la tabla (`0106_conversaciones.sql:111`, `0217_portal_conversation_read.sql:25`) y la migración no toca la ACL de la tabla ni RLS (`0433:2-3`; contrato `test:189-193`);
  - la tabla sigue en la publicación `supabase_realtime` (`0106_conversaciones.sql:281`), que 0433 no toca.
- El id suscrito es el hilo Portal vivo del cliente (`app/portal/(app)/soporte/page.tsx:96-98`, que llama a `lib/portal/portal-conversation-queries.ts:67-79` con `client_id`, `channel = 'portal'` y `deleted_at is null`). Es justo el hilo que autoriza la función (`0433:67-75`).
- El respaldo es un sondeo que por defecto corre cada 45 s (`PortalChatLive.tsx:23`) con la pestaña visible y al volver a ella (`PortalChatLive.tsx:36-46`). El hilo que se muestra sale de `getPortalThread`, con cliente admin acotado por `client.id` (`soporte/page.tsx:89-94`, `portal-conversation-queries.ts:126-171`), y no depende de esta policy.
- **NO DISPONIBLE:** la suscripción Realtime autenticada real. En local no hay servidor Realtime de Supabase ni credenciales. El contrato simula el predicado con `set local role authenticated` y `request.jwt.claim.sub` (`test:115-116`, `test:197-198`), usando un stub de `auth.uid()` que solo lee ese setting (`test:22-25`). No reproduce el servidor Realtime ni el `auth.uid()` real de Supabase.

**Riesgo de rendimiento (no bloqueante, no medido).** La función es SECURITY DEFINER, así que no se inlinea, y forma parte del OR de las policies permisivas. Por eso puede evaluarse fila por fila también en las lecturas del equipo, por ejemplo `listMessages`, que trae hasta 500 filas (`lib/studio/conversaciones/messages-queries.ts:18-31`). Para el staff eso significa un sondeo por índice en `client_users` (`client_users_auth_idx`, `0080_portal_cliente.sql:36`) que no encuentra fila. La expresión histórica usaba una subconsulta. Cambiar el SQL queda fuera de esta importación, que exige identidad por blob.

**Datos personales: no aplica.** La migración no captura, mueve ni borra datos personales; solo restringe un predicado de lectura. La cabecera lo declara: sin DML, sin cambios de ACL de tablas y sin acceso a contenido (`0433:2-3`). La función lee identificadores, estado, tenant, canal y `deleted_at` para devolver un boolean, y no lee `body` (`0433:54`, `0433:60-76`). La policy solo cambia su USING (`0433:87-91`). El contrato usa principals sintéticos (`test:2`) y termina en rollback (`test:267-268`). Lo que puede ver un principal del Portal se reduce y nunca pasa de su propio hilo.

**Gobernanza**

- SGE-00.05: cumplimiento en el contrato local, con pruebas negativas de tenant ajeno, vínculo revocado o incoherente e inserción directa (`test:207-229`). No es evidencia de producción.
- SGE-00.07: cumplimiento local. Con 0433 aplicada, Realtime puede reflejar el estado durable del hilo. Mientras no se aplique, el Portal en producción sigue dependiendo del sondeo de 45 s. No muestra un estado falso, porque la pantalla lee la fuente de verdad.
- SGE-00.12: cumplimiento. Este Worker no aplica, no fusiona y no despliega; aplicar la migración requiere OK nominal de Sam.
- AUD-01 y MP-01: no aplica, porque no hay mutación ni cambio de permanencia. UI, marca y componentes: no aplica; `/ui-check` tampoco.

## VALIDACIÓN

Todo lo que sigue se midió sobre el commit de producto `4e100f8d6e500e4f47b360a6513876767006d543` (base `3c610701`). El commit posterior solo añade este handoff y no cambia el contenido probado.

- PASÓ: `guard`, `claim`, raíz, rama y base; estado inicial limpio; `git fetch origin` sin avance de main, confirmado también después.
- PASÓ: `corepack pnpm install --frozen-lockfile`, en 24 s. Node v24.20.0, pnpm 12.3.4; lockfile intacto.
- PASÓ: identidad por blob de los tres archivos, tanto en el árbol como en el índice (salida abajo).
- PASÓ: `node scripts/install-merge-drivers.mjs --check`; driver `dtd-generated-records` verificado.
- PASÓ: `corepack pnpm sdd:check` (numbering sin números repetidos; solo choques históricos ya aplicados y exentos), `corepack pnpm docs:index` (416 specs) y `corepack pnpm docs:check`.
- PASÓ: `node scripts/check-schema-rebuild.mjs` en 28 s: 421 archivos, 403 migraciones aplicadas desde cero y 18 solo-ledger verificadas sin tocar el esquema. Hubo barrido de aislamiento sobre 219 tablas y 2 tenants; el script los rotula «reales», pero son tenants sintéticos creados en PostgreSQL efímero, no de producción. HEAD tiene 420 migraciones y el árbol 421, así que el rebuild incluye 0433.
- PASÓ: `node scripts/check-pending-migration-symbols.mjs`, con `0 ROJO · 0 AMARILLO declarado(s)`. `supabase/pending-migration-symbol-declarations.json` intacto; ningún código llama a la función nueva.
- PASÓ: `git diff --cached --check` antes del commit, `git diff --check origin/main...HEAD` y allowlist exacta: cinco rutas en el commit de producto más este handoff.
- PASÓ: CI remoto «Calidad continua», job «Calidad local sin secretos», sobre el commit de producto `4e100f8d` ([run 34571137643](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34571137643), conclusión `success`). Incluye «Build de produccion sin secretos» (`node scripts/check-build.mjs`) y «Confirmar arbol reproducible». No ejecuta sql-tests, schema-rebuild, E2E ni el ledger de Supabase. El CI del commit final de handoff se registra en la PR. Vercel Preview de la rama dio `pass`; es un preview, no producción.
- NO EJECUTADO, porque no aplica: `/ui-check`, ya que no hay UI.
- NO EJECUTADO, porque no está autorizado: merge, aplicación de 0433 en producción, lectura de datos de producción y despliegue manual.

### `corepack pnpm verify`: FALLÓ (exit 1), no es verde completo

La corrida empezó a las `2026-09-11T06:42:11Z` sobre el contenido exacto de `4e100f8d` y se detuvo, a indicación del Director, a las `2026-09-11T07:55:34Z` (03:55:34 -04:00), colgada en E2E. De los 17 pasos: 14 PASÓ, `migrations-applied` NO DISPONIBLE, e2e FALLÓ/NO DISPONIBLE y build NO EJECUTADO. No reintenté el verify completo, por indicación del Director.

- PASÓ: harness (18), lint (0 errores y 8 advertencias preexistentes), rsc-boundary (1597 módulos), typecheck, edge-functions (4 funciones), test (526 archivos y 6684 tests), docs:check, numbering, feature-constants (5 banderas), components:check y governance:check.
- NO DISPONIBLE: `migrations-applied`. Salió SKIP por falta de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. No se consultó producción; el worktree no tiene credenciales y no se copiaron.
- PASÓ: pending-migration-symbols (0 ROJO · 0 AMARILLO).
- PASÓ: sql-tests, con 163 contratos, incluido `0433_portal_conversation_realtime_principal_tenant.test.sql`, y rollback total.
- PASÓ: schema-rebuild (421/403/18; barrido de 219 tablas y 2 tenants sintéticos).
- **FALLÓ/NO DISPONIBLE: e2e, colgado tras el test 123 de mobile-chrome y detenido por el Worker a indicación del Director.**
  - Dev server propio en el puerto 3655.
  - Pasada 1 (186 tests, 8 workers): 150 passed, 15 failed, 3 flaky y 18 skipped, en 13.5 min. Hubo además un error fuera de los tests: `worker-49 process did not exit within 300000ms after stop, force-killed it`.
  - Los 15 fallidos son `auth.spec.ts:21/91/98/105` y `global-search.spec.ts:22` en chromium, mobile-chrome y mobile-safari. Todos muestran `Your project's URL and Key are required to create a Supabase client!` en `proxy.ts:67:38`, por falta de configuración de Supabase.
  - Los 3 flaky son `auth.spec.ts:74` (chromium), `calculadora-semantic-colors.spec.ts:53` y `cbm-ayuda.spec.ts:111` (mobile-chrome).
  - Pasada 2 (reintento automático 1/1 de verify): parcial hasta `ok 123 [mobile-chrome] › e2e\smoke.spec.ts:97:7`, con 105 líneas `ok`, 20 intentos fallidos y 12 omitidos. Los 20 intentos corresponden a los mismos cinco tests de auth y global-search en chromium y mobile-chrome, cada uno con su retry. El log dejó de escribirse a las 03:16:12 -04:00.
  - Ningún fallo toca Portal Soporte/Realtime ni código de L21, que no cambia app/lib. No se modificaron tests, retries ni timeouts.
- NO EJECUTADO: build dentro de verify, porque va después de E2E. La cobertura de build es la del CI «Calidad local sin secretos» del SHA de producto `4e100f8d` (run 34571137643), que pasó «Build de produccion sin secretos».

### Detención del árbol de verify (indicación del Director)

- Identidad confirmada con `Get-CimInstance Win32_Process`, revisando PPID, CreationDate y CommandLine:
  - cadena: `sh.exe` 17588 (`corepack pnpm verify`, creado a las 02:42:11 -04:00, que coincide con `verify.start` 06:42:11Z) → `node` corepack 44188 → `pnpm-native` 39312 → `cmd` 33012 → `node scripts/verify.mjs` 33860 (02:42:15);
  - 29 descendientes: runner de Playwright 42972; `cmd` 42036 → `next dev --webpack --port 3655` 43316 → `start-server` 12676, único listener, en `:3655`; siete workers de Playwright (22644, 18952, 46812, 29836, 7372, 10604 y 3352) y 18 procesos `chrome-headless-shell`, todos con la ruta de este worktree.
- A las 03:55:34 -04:00, después de revalidar CreationDate, padre y CommandLine del PID 33860, se ejecutó `taskkill /PID 33860 /T /F`. Terminó 29 procesos. El 42036 ya había salido («No hay ninguna instancia activa»), y por eso taskkill devolvió 255.
- Comprobación posterior, a las 03:56:26:
  - ninguno de los 30 PID ni de los 4 ancestros sigue vivo;
  - no queda ningún proceso con `node_modules` de este worktree ni `next dev` en 3655;
  - el puerto 3655 no tiene conexiones ni listener;
  - los `verify`/`next dev` de otras sesiones no se tocaron (por ejemplo 43488, 44044, 4416 y `next dev --port 3220`).
- `verify.exit` = 1 (pnpm `ELIFECYCLE`). El árbol quedó sin cambios trackeados; solo hay artefactos ignorados: `.next/`, `test-results/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `public/norte.html` y `docs/design/studio/_norte/_norte.html`.

Identidad por blob (`git hash-object --no-filters` sobre el árbol y `git rev-parse :<ruta>` sobre el índice):

```text
PASO docs/specs/0401-portal-conversation-realtime-principal-tenant/spec.md bytes=2574 source=6a14723e5e6e9f6ebf6504676caeb5c35a32d700 worktree=6a14723e5e6e9f6ebf6504676caeb5c35a32d700
PASO supabase/migrations/0433_portal_conversation_realtime_principal_tenant.sql bytes=5633 source=642226f8d4e3265f4051616330f0ce3813a45818 worktree=642226f8d4e3265f4051616330f0ce3813a45818
PASO supabase/tests/0433_portal_conversation_realtime_principal_tenant.test.sql bytes=12467 source=0f6efeb3f1011bf9733361b53de00e0370dc7b3a worktree=0f6efeb3f1011bf9733361b53de00e0370dc7b3a
indice migracion=642226f8d4e3265f4051616330f0ce3813a45818 · indice contrato=0f6efeb3f1011bf9733361b53de00e0370dc7b3a
spec con nota=bf8688c204048c106fea3c0ab02724b7ca2264d5 (3133 bytes) · sin nota=6a14723e5e6e9f6ebf6504676caeb5c35a32d700 (2574 bytes)
```

Evidencia local fuera de Git: `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/454d97be-b1e0-4fc9-97e9-c6bb621ba84c/scratchpad/c-l21-portal-realtime-mensajes/`. Contiene:

- `install.log`, `blobs-iniciales.log`, `blobs-indice.log`, `spec-nota.log`;
- `docs-index.log`, `sdd-check.log`, `docs-check.log`, `rebuild.log`, `pending-symbols.log`;
- `verify.log` (5188 líneas), `verify.start`, `verify.end` y `verify.exit`;
- `ci-extraccion.log`;
- `procesos-antes.log`, `taskkill.log` y `postkill.log`, con los scripts `inventory.ps1`, `kill.ps1` y `postkill.ps1`;
- los bodies de la PR.

## COMMITS

- `4e100f8d6e500e4f47b360a6513876767006d543`: unidad lógica L21 con la spec y su nota, la migración y el contrato exactos, la espera en el baseline y el índice regenerado. Cinco archivos añadidos de forma selectiva.
- El commit que contiene este documento: cierre durable del Worker. Su SHA final queda en la PR, sin crear commits recursivos para registrar su propio hash.

## PR / BRANCH

[PR #70 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/70), con base main y rama `codex/c-l21-portal-realtime-mensajes`, publicada con push explícito de la rama a sí misma. El worktree es el indicado arriba. No se fusionó ni se desplegó.

## PENDIENTES DE ESTA TAREA

Ninguno de extracción o implementación. La integración no está hecha. Falta que el Director revise la PR #70 y sus checks por SHA, y que acepte los límites de entorno:

- E2E sin cierre: colgado en el reintento y detenido;
- build medido solo por CI;
- ledger de producción y Realtime autenticado real NO DISPONIBLES.

También falta unir las entradas de baseline e índice con L19/L20. No se aplicará ninguna migración para poner verdes esos gates. La aplicación de 0433 en producción es otra tarea, con OK nominal.

## FUERA DE ALCANCE DETECTADO

- Comentarios desactualizados en código que no se toca. `app/portal/_components/PortalChatLive.tsx:12-16` dice que basta la policy de 0217 para que el subscribe reciba filas, pero por la RLS de `conversations` esa policy nunca entregó filas al Portal (RED en `test:114-125`). Además, `lib/portal/portal-conversation-queries.ts:4-9` afirma que el cliente no tiene RLS de lectura sobre `conversation_messages`, y la tiene desde 0217, funcional con 0433. Cuando 0433 esté aplicada conviene corregirlos en otra tarea.
- `get_portal_client_id()` (`0080_portal_cliente.sql:40-44`) sigue sin comprobar coherencia de tenant para sus demás consumidores. 0433 deja de usarlo en esta policy; en esta tarea no se revisaron los otros consumidores.
- El riesgo de rendimiento no medido descrito en la revisión.
- E2E local frágil, sin relación con L21:
  - la pasada 1 terminó con `worker-49` forzado a los 300000 ms y el reintento se colgó sin escribir durante unos 40 min, el cuelgue de teardown y workers ya registrado en L09/L13;
  - el arranque del dev server emitió unos 120 `Request timed out after 3000ms` antes de empezar los tests, con otros Workers corriendo verify en paralelo;
  - hubo 3 flaky ajenos: `auth.spec.ts:74`, `calculadora-semantic-colors.spec.ts:53` y `cbm-ayuda.spec.ts:111`.
- Corepack resolvió pnpm 12.3.4 y avisó que `pnpm.onlyBuiltDependencies` de `package.json` ya no se lee. La instalación congelada terminó con exit 0, y el workflow usa pnpm 11.19.0. Es el mismo aviso que registró L12; no se tocó ninguna configuración.
- Lint: ocho advertencias preexistentes, sin errores.

## HANDOFF AL DIRECTOR

**Coincide con el plan:** `c-analisis-bloque-c.md:90` (L21 sin nueva allowlist app/lib; el consumidor inmediato es la policy de Realtime) y el anexo `c-analisis-bloque-c-sql.md:82`, `:120`, `:160` y `:262` (RPC booleana, sustitución de la expresión de la policy de 0217 y contrato que incluye solo 0433). No hay productor ni dependiente interno C; 0431 y 0433 no se llaman entre sí (`c-analisis-bloque-c-sql.md:29`). Los tamaños 2574/5633/12467 son exactos.

**Precisiones:** la allowlist histórica de la spec («auditoría, checklist y handoff del saneamiento») pertenece al origen, y manda la allowlist de este encargo. Las cifras y casillas `[x]` de la spec son del origen, no evidencia de esta ejecución; la evidencia vigente es la de este handoff. El verify local no cerró: E2E se colgó y se detuvo a tu indicación, y el build dentro de verify no corrió. La cobertura de build es la del CI del SHA de producto.

**Integración:** L19 (0431) y L20 (0432) comparten `supabase/migrations-baseline.json` y `docs/specs/README.md`. El Director debe **unir entradas y regenerar el índice**, sin elegir un lado; ambos archivos usan el merge driver `dtd-generated-records`. Revisa el SHA y la base vigentes antes de integrar. Fusionar NO autoriza aplicar `0433_portal_conversation_realtime_principal_tenant`: hace falta OK nominal de Sam y el runbook, aplicándola sola con `name` exacto. Después de aplicarla hay que validar aparte la suscripción autenticada de `/portal/soporte`. Si falla, el chat sigue funcionando con el sondeo de 45 s, pero sin inmediatez.

**Ownership:** sesión escritora única `c-l21-worker-20260911-claude`; no quedan procesos propios de validación. Secuencia de cierre: publicar este handoff, comprobar el CI del SHA final, revalidar remoto y estado, y liberar con `node scripts/harness-worktree.mjs release --owner c-l21-worker-20260911-claude`. El recibo de liberación queda en el reporte final al Director. No se borran ni la rama ni el worktree.
