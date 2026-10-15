# Handoff · SDD-0534 · Lote R3: correlation_id dentro de 128 en siete RPC

| Campo | Valor |
|---|---|
| Fecha | 2026-10-15 |
| Task ID | lote-r3-correlation-id |
| Owner | Worker Claude (claim `claude-infallible-ellis-1b9414`, se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\infallible-ellis-1b9414` |
| Rama | `claude/infallible-ellis-1b9414` |
| Base | `origin/main@f3651f24` (#226) |
| SDD | [0534](../../docs/specs/0534-lote-r3-correlation-id/spec.md) · `in-progress` · reserva `codex/sdd-reserve-0534-lote-r3-correlation-id` (local, sin publicar; cherry-pick `ed128d3f`) |
| Migraciones | 0483–0489, una por RPC · **NO APLICADAS** · siete esperas en `pendingBelowCutoff` |
| PR | draft [#239](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/239) |
| Estado de tarea | lista-para-revisión (PR draft, sin fusionar) |

## OBJETIVO ORIGINAL

La SDD-0532 (PR #235) reprodujo y corrigió que «Autorizar» de Naviera falla siempre: la referencia
de la pantalla hace un `correlation_id` de más de 128 y el writer AUD-01 lo rechaza. Dejó anotado,
sin reproducir, que las otras siete RPC del lote R3 (0317–0321, 0323, 0324) arman el
`correlation_id` igual. El encargo:

1. Reservar SDD y pedir el siguiente número de migración libre (0482 ya tomada), revisando también
   las ramas `codex/*` y `claude/*`.
2. Reproducir cada una con el writer REAL en PGlite, con la plataforma del contrato 0482 y la
   fixture de cada contrato 03NN sin su writer simulado.
3. Corregir con el patrón de la 0482 (md5 de la referencia), resto del cuerpo byte a byte, preflight
   por md5 (CRLF→LF y sin `\s` real), DEFINER y search_path; postflight de cuerpo, owner y ACL.
   Decidir con el Director una migración por RPC o por lote.
4. Contrato SQL con el writer real, envoltorio Vitest PGlite con control rojo, mutantes coherentes,
   deriva, barrido de mutantes externos sin shell; declarar cada migración como espera.
5. Sin lectura de producción salvo catálogo con OK del Director; spec, handoff y PR draft sin
   fusionar.

## COMPLETADO

### 1. Reserva y números

- **SDD-0534** reservada con `corepack pnpm sdd:next --reserve lote-r3-correlation-id`. El primer
  intento chocó con la reserva 0533 que otra sesión creó en el mismo minuto
  (`resend-webhook-salud-llave-invalida`); el segundo dio 0534. El stub está en la rama de trabajo
  (`ed128d3f`).
- **Migraciones 0483–0489: propuesta del Worker, sin confirmar por el Director.** El inventario de
  `sdd:next` (333 refs, PRs abiertas y worktrees, incluidos los archivos sin commit de cada
  worktree) dio 0483 como la siguiente libre. Le propuse a la sesión que me lanzó una migración
  por RPC con esos números. Respondió el Worker de la SDD-0532 (sesión
  `local_d589612b-806d-4c91-8e67-b7ce37feb0ac`), no el Director ni Sam. Su texto, tal cual:

  > Partición 0483–0489, una migración por RPC: de acuerdo como recomendación técnica, pero no soy
  > el Director, así que no es una confirmación formal.
  > - La razón es la correcta: el runbook pide aplicar de a una, y con deriva en producción sólo
  >   aborta la RPC afectada.
  > - La numeración la coordina el Director. Regístrala en el handoff como «propuesta del Worker,
  >   sin confirmar por el Director», con el texto de esta respuesta a mi nombre (Worker SDD-0532),
  >   no a nombre de Sam.

  Por su sugerencia hice pronto el commit local de las siete migraciones (`f5db3767`), para que
  los refs compartidos entre worktrees las muestren. El commit se armó con blobs regenerados en el
  scratchpad, no desde el árbol, porque el barrido de mutantes estaba escribiendo y restaurando
  esos archivos en disco. Queda como pendiente 1.

### 2. Reproducción: CONFIRMADA en las siete

Con el writer real (preludio del contrato 0482 + 0267 y 0294 reales), la fixture de cada contrato
03NN sin su writer simulado y la 03NN, en PGlite 0.5.8:

| RPC | Corta (17) | Máxima que cabe | Pantalla | Umbral | Estado tras el fallo | AUD-01 |
|---|---|---|---|---|---|---|
| 0317 | transiciona | 69: transiciona | 95: 22023 | 70: 22023 | `reconocido_proveedor`, sin fecha | 0 |
| 0318 | transiciona | 73: transiciona | 91: 22023 | 74: 22023 | `pagado`, embarque `in_customs`, 0 eventos | 0 |
| 0319 | transiciona | 67: transiciona | 97: 22023 | 68: 22023 | `aprobado`, 0 asientos | 0 |
| 0320 | transiciona | 70: transiciona | 94: 22023 | 71: 22023 | ruta, camión y chofer `en_ruta`, embarque `out_for_delivery`, 0 eventos | 0 |
| 0321 | transiciona | 69: transiciona | 95: 22023 | 70: 22023 | `out_for_delivery`, sin receptor, 0 eventos | 0 |
| 0323 | transiciona | 62: transiciona | 102: 22023 | 63: 22023 | reporte vivo con su foto | 0 |
| 0324 | transiciona | 63: transiciona | 101: 22023 | 64: 22023 | `lista`, sin motivo ni actor | 0 |

El 22023 es siempre `audit: correlation_id inválido`. La referencia corta deja un `correlation_id`
de 72 a 83 caracteres, que el writer acepta: la fixture funciona y lo único que falla es el largo.

- Las referencias de las pantallas se leyeron en el código (`app/studio/(app)/…`, tabla en spec
  §1); las Server Actions las pasan sin cambios (`p_request_ref: input.requestRef`).
- Ninguna migración redefine el writer ni las siete RPC: búsqueda en `supabase/migrations`, en 157
  refs remotas (`origin/*` y `refs/dtd/pr/*`), en ramas locales y en los 04xx de los 27 worktrees.

### 3. Corrección: 0483–0489

- Cada una reemplaza sólo el cuerpo de su RPC: `v_correlation` pasa a
  `<prefijo>:<id>:<md5(referencia)>` (de 87 a 98 caracteres, tabla en spec §2). El resto es el de
  la 03NN byte a byte; lo mide una prueba de texto.
- Las migraciones se generaron con un script (scratchpad, sin commit) que extrae el cuerpo de la
  03NN, cambia sólo el bloque de `v_correlation` y calcula las huellas. Las huellas del preflight
  se midieron además en PostgreSQL sobre el `prosrc` real que deja la 03NN (LF y sin `\s` con `\s`
  real): iguales en las siete.
- Preflight: md5 de la 03NN (LF o sin espacios), `prosecdef` y `proconfig`. Postflight: cuerpo de
  la 04NN, `DEFINER`, `search_path`, owner `postgres`, EXECUTE sólo para `authenticated`. Huellas
  en spec §3.
- La 0488 mide 98, no «97 o menos» como decía el encargo: su prefijo tiene un carácter más que el
  de la 0482.
- Con sha256 cinco de las siete cabrían (119 a 125). La cabecera de cada migración lo dice tal cual
  y justifica el md5 por formato común del lote, no por largo.
- Siete esperas en `supabase/migrations-baseline.json`, con el texto que el operador tiene que leer.

### 4. Pruebas

- `supabase/tests/_audit-writer-real.sql`: preludio compartido con el writer real (el del contrato
  0482, más 0267 y 0294). Sigue la convención de includes con `_` (`_supabase-platform-stubs.sql`).
- `supabase/tests/0483_…` a `0489_….test.sql`: siete contratos. Escenarios: el writer rechaza 129;
  la referencia de la pantalla transiciona; el replay no escribe otro AUD-01; el umbral y la
  máxima (128) transicionan; el comentario nombra la SDD-0534. `TEST 04NN GREEN: 26 aserciones`.
- `lib/studio/__tests__/r3-correlation-contract.ts` + siete `*-correlation-id.migration.test.ts`:
  26 casos por migración (6 de texto, 20 en PGlite): verde; control rojo; 7 mutantes coherentes;
  deriva de cuerpo, de espacios, de DEFINER, de search_path, de ACL ×3 y de owner; 04NN alterada
  ×3.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| Reproducción PGlite con writer real, sin 04NN (script del scratchpad, sin commit) | PASÓ: las siete reproducen; tabla en COMPLETADO §2 |
| Huellas del preflight medidas en PostgreSQL (PGlite) sobre el `prosrc` que deja cada 03NN: `md5(replace(prosrc, E'\r\n', E'\n'))` y `md5(regexp_replace(prosrc, '\s', '', 'g'))`, script escrito con Write | PASÓ: iguales a las calculadas en Node en las siete |
| Siete contratos con su 04NN en PGlite | PASÓ: `TEST 04NN GREEN: 26 aserciones` en los siete |
| `node node_modules/vitest/vitest.mjs run <7 archivos> --pool=threads --reporter=verbose` | PASÓ: `Test Files 7 passed (7)`, `Tests 182 passed (182)`, 0 omitidos; exit 0 del propio vitest |
| Barrido de mutantes externos sobre los guardas (archivo en disco, envoltorio completo con `--bail=1`, `vitest.mjs` sin shell, control sin mutar por migración) | PASÓ: **112/112 MUERTOS**, 0 sobreviven. 16 por migración: preflight (aborto por ausencia, prosecdef, proconfig, alternativa sin espacios, and→or, huella LF), postflight (prosecdef, proconfig, owner, md5, authenticated, anon, service_role), sin timeouts, sin comentario, referencia cruda sin recalcular el md5. La huella LF muere por la prueba de texto que fija su literal; en comportamiento es equivalente (FUERA DE ALCANCE 4). Dos corridas murieron sin línea `Tests` (exit 2147483651, crash del proceso con 6,6 GB libres de 31): el mutante «postflight sin prosecdef» de 0483 y el control sin mutar de 0489. No se contaron; se repitieron y dieron MUERTO y 26/26 + 16/16 |
| `node scripts/build-docs-index.mjs --check` (docs:check) | PASÓ: índice sincronizado |
| `node scripts/check-numbering.mjs` (sdd:check) | PASÓ: sin números repetidos |
| `node scripts/next-number.mjs` (inventario al cierre, 348 refs + worktrees) | PASÓ: sin colisiones en 0483–0489 ni en la spec 0534 |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: 0 ROJO · 0 AMARILLO |
| `node scripts/build-governance-capsule.mjs --check` | PASÓ: 28 políticas, cápsula vigente |
| `eslint` de los ocho archivos TypeScript nuevos | PASÓ: 8 archivos analizados, 0 problemas, 0 ignorados |
| `tsc --noEmit -p tsconfig.json` | PASÓ: exit 0; los ocho archivos nuevos están en `--listFilesOnly` |
| `git diff --check` | PASÓ |
| `pnpm verify` completo | NO EJECUTADO: el encargo lo prohíbe sin turno del Director. El diff no toca código de producto: son SQL, pruebas, baseline y docs |
| `sql-tests` en Docker (`postgres:17`) de los siete contratos | NO EJECUTADO: sin turno de Docker. Lo cubre el envoltorio PGlite, que corre el mismo `.sql` |
| `schema-rebuild` | NO EJECUTADO: es parte de `verify` |
| Lectura de catálogo en producción | NO EJECUTADO: no hizo falta para reproducir y requiere OK del Director. Es necesaria antes de aplicar (pendiente 2) |

Lo que no reproduje: el contrato de cada 03NN con su writer simulado sigue verde, como antes. El
defecto sólo aparece con el writer real, y eso es lo que montan los contratos nuevos.

## COMMITS

| SHA | Mensaje |
|---|---|
| `ed128d3f` | chore(sdd): reserva SDD-0534 — lote-r3-correlation-id |
| `f5db3767` | feat(studio): SDD-0534 — migraciones 0483–0489: correlation_id del lote R3 con md5 de la referencia |
| `609579ed` | test(studio): SDD-0534 — contratos 0483–0489 con el writer AUD-01 real y envoltorio PGlite |
| `b269cb99` | docs: SDD-0534 — spec, índice y handoff del lote R3 |
| `1068dc11` | Merge de `origin/main@8f8cabfc` (#227, #220, #228): limpio; docs:check, sdd:check, símbolos y las siete suites (182/182) en verde después del merge |
| `3e05c542` | docs(handoff): SDD-0534 — PR #239 y SHA |
| `bb6f5c51` | Merge de `origin/main@19d4128e` (#229, SDD-0528) por el conflicto que GitHub marcó en el índice: el driver local lo resolvió; docs:check (513 specs), sdd:check, símbolos y las siete suites (182/182) en verde después del merge |
| `edf6e0b0` | docs(handoff): SDD-0534 — merge con #229 |
| `3d6fb493` | Merge de `origin/main@4b72d66a` (#232, SDD-0522, migración 0476) por el conflicto que GitHub marcó en el índice: el driver local lo resolvió. La 0476 no toca el writer AUD-01, el CHECK del `correlation_id` ni las siete RPC, y no arma `correlation_id`. docs:check (514 specs), sdd:check, símbolos y las siete suites (182/182) en verde después del merge |
| `cf62b436` | docs(handoff): SDD-0534 — merge con #232 |
| `cc6ed762` | Merge de `origin/main@1bc88fca` (#234, SDD-0531) por el conflicto que GitHub marcó en el índice: el driver local lo resolvió; no toca las pantallas, migraciones ni el baseline que leen estas pruebas. docs:check (515 specs), sdd:check, símbolos y las siete suites (182/182) en verde después del merge |
| `e9b1e11d` | docs(handoff): SDD-0534 — merge con #234 |
| `e020c342` | Merge de `origin/main@016e76d6` (#233, SDD-0530, migración 0477) por el conflicto que GitHub marcó en el índice: el driver local lo resolvió. La 0477 no toca el writer ni las siete RPC, y su `correlation_id` (`naviera-avance:<uuid>`, 51) no tiene el defecto. docs:check (516 specs), sdd:check, símbolos y las siete suites (182/182) en verde después del merge |
| `7ef2b871` | docs(handoff): SDD-0534 — merge con #233 |
| `24d122d2` | Merge de `origin/main@ce5cddda` (#230, SDD-0526, migración 0479) por el conflicto que GitHub marcó en el índice: el driver local lo resolvió. La 0479 no toca el writer ni las siete RPC y no arma `correlation_id`. docs:check (517 specs), sdd:check, símbolos y las siete suites (182/182) en verde después del merge |
| `53e0b42e` | docs(handoff): SDD-0534 — merge con #230 |
| `67386d2e` | Merge de `origin/main@502f519d` (#231, SDD-0529, migración 0480) por el conflicto que GitHub marcó en el índice: el driver local lo resolvió. La 0480 no toca el writer ni las siete RPC; su `correlation_id` (`operario_updated:<uuid>`, 53) no tiene el defecto. docs:check (518 specs), sdd:check, símbolos y las siete suites (182/182) en verde después del merge |
| `dfd6ca72` | docs(handoff): SDD-0534 — merge con #231 |
| `3559e391` | Merge de `origin/main@51b74da0` (#235, SDD-0532, migración 0482) por el conflicto que GitHub marcó en el índice: el driver local lo resolvió y el baseline no chocó (la #235 sacó la 0482 de las esperas). docs:check (519 specs), sdd:check, símbolos, las siete suites (182/182) y el envoltorio de la 0482 (26/26) en verde después del merge |
| `4c1479fc` | docs: SDD-0534 — la #235 ya está en main |
| `cf7b3061` | Merge de `origin/main@cbf18acf` (#237, SDD-0533, sin migraciones) por el conflicto que GitHub marcó en el índice: el driver local lo resolvió. docs:check (520 specs), sdd:check, símbolos y las siete suites (182/182) en verde después del merge |
| (este commit) | docs(handoff): SDD-0534 — merge con #237 |

## PR / BRANCH

- Rama `claude/infallible-ellis-1b9414`, publicada a sí misma.
- [#239](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/239), draft contra `main`, **sin fusionar**: los merges están congelados hasta después del corte
  de Vercel al servidor propio.

## PENDIENTES DE ESTA TAREA

1. **Confirmación del Director** de la partición (una migración por RPC) y de los números
   0483–0489. Si prefiere otra partición o números, se regeneran con el mismo script.
2. **Lectura de catálogo en producción, READ ONLY, por el Director, antes de aplicar.** Sólo
   catálogo, sin filas:

   ```sql
   select p.oid::regprocedure::text as rpc,
          pg_catalog.md5(pg_catalog.replace(p.prosrc, E'\r\n', E'\n')) as md5,
          pg_catalog.md5(pg_catalog.regexp_replace(p.prosrc, '\s', '', 'g')) as md5_sin_espacios,
          p.prosecdef, p.proconfig, pg_catalog.pg_get_userbyid(p.proowner) as owner,
          p.proacl::text as acl
   from pg_catalog.pg_proc p
   where p.oid in (
     'public.mark_claim_offset_paid_in_china_governed(uuid,date,text,text)'::regprocedure,
     'public.clear_customs_filing_governed(uuid,date,text,text)'::regprocedure,
     'public.pay_claim_indemnity_governed(uuid,text,date,text,text)'::regprocedure,
     'public.complete_tms_route_governed(uuid,text,text)'::regprocedure,
     'public.complete_ve_delivery_governed(uuid,text,text,text)'::regprocedure,
     'public.retire_inspection_report_governed(uuid,text,text,text)'::regprocedure,
     'public.cancel_dispatch_order_governed(uuid,text,text,text)'::regprocedure
   )
   order by 1;
   ```

   Lo esperado: el `md5` (o el sin espacios) de la columna «Preflight» de spec §3 para cada RPC,
   `prosecdef = t`, `proconfig = {search_path=""}`, owner `postgres` y EXECUTE sólo para
   `authenticated` (con owner `postgres`, `{postgres=X/postgres,authenticated=X/postgres}`).
   Opcional: el md5 de `append_audit_event_v1` y la definición de
   `entity_audit_log_correlation_id_check`, para confirmar el tope de 128 en el writer vivo.
3. **Aplicar 0483–0489 con OK nominal de Sam, de a una**, siguiendo
   `docs/runbooks/aplicar-migraciones-prod.md`. El orden es indiferente. Después, retirar cada
   espera del baseline.
4. **Smoke después de aplicar**, con un caso real de cada módulo: marcar pagado en China un cruce
   reconocido; liberar un trámite SENIAT pagado con sus seis documentos; pagar la indemnización de
   un reclamo aprobado; completar una ruta TMS en ruta; confirmar a mano una entrega VE; retirar un
   reporte de Inspecciones; cancelar una OD. En cada uno: la acción termina bien en la pantalla y
   queda un evento AUD-01 con `correlation_id` de la forma `<prefijo>:<id>:<md5>`.
5. Marcar la SDD-0534 como `done` cuando se apliquen las siete y pasen los smokes.

## FUERA DE ALCANCE DETECTADO

1. **Tres Server Actions muestran un mensaje engañoso con 22023.** Financiero China
   (`app/studio/(app)/financiero-china/actions.ts:529`), SENIAT (`seniat/actions.ts:278`) y
   Reclamos (`reclamos/actions.ts:304-305`) piden revisar motivo, fecha, documentos o monto: con
   este defecto el usuario corregía datos que estaban bien. Las otras cuatro dicen «No se pudo …
   Referencia: …». Con 0483–0489 ya no ocurre por esta causa.
2. **La 0336 (`camionero_pod_v2`) arma el mismo patrón** (`0336_pod_closes_shipment.sql:248-250`),
   pero ninguna pantalla la llama (la app usa `camionero_pod`). Registrada, no corregida.
3. **Los contratos de 0317–0324 siguen con su writer simulado.** Los nuevos cubren las RPC con el
   writer real.
4. **La huella LF del preflight es lógicamente redundante** con la huella sin espacios (si coincide
   una, coincide la otra). Se conserva por paridad con la 0482 y porque es la que se compara en la
   lectura de catálogo. Vale igual para la 0482.
5. **La PR #235 ya está en `main`** (`51b74da0`). Su commit `5fcc8ad1` sacó la 0482 de las
   esperas «para aplicarse y fusionarse juntas»; que esté aplicada en producción NO lo verifiqué.
   El merge con esta rama fue limpio (el baseline no chocó y el driver regeneró el índice), y su
   envoltorio da 26/26 junto a los siete nuevos. Su contrato conserva su preludio propio; podría
   incluir `_audit-writer-real.sql`, pero no lo toqué.
6. **La reserva SDD `codex/sdd-reserve-0534-…` es local.** El stub viaja en esta PR. Si se descarta
   la PR, hay que borrar la reserva.

## Datos personales y credenciales

No aplica `/revisar-datos-ve`: no se capturan, mueven ni borran datos personales. El payload de
cada AUD-01 no cambia; sólo cambia la forma del `correlation_id`. Las fixtures usan nombres de
prueba («Ana Pérez», del contrato 0321). No se leyó producción. No hay secretos en el diff.

## Impacto documental y conocimiento

- **Canónico actualizado:** spec 0534 nueva e índice `docs/specs/README.md` regenerado.
- **Sin cambios:** AGENTS, runbooks y gobernanza.
- **Graphify, Archify y Obsidian:** NO EJECUTADO en el worktree. `knowledge:status` da
  `structural: INVALID`, `semantic: INVALID` (0/1213 verificadas) y Archify `PENDING`
  (`ARCHIFY_RUNTIME_MISSING`), porque este worktree no tiene los derivados generados; no es efecto
  de este diff. La spec y el handoff nuevos entran como fuentes pendientes. Lo publica el Director
  desde main integrado, según el runbook de conocimiento.

## HANDOFF AL DIRECTOR

- Las siete reproducidas con el writer real y corregidas, una migración por RPC, todas en espera.
- No necesitan despliegue de app: basta aplicarlas, con la lectura de catálogo previa del
  pendiente 2. Son independientes entre sí y de la 0482.
- **Falta tu confirmación de la partición y de los números (pendiente 1).**
- PR draft sin fusionar. No se tocó producción.
