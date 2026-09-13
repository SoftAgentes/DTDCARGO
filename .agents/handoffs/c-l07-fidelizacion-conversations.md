# L07 — RBAC de facturas y facades de Fidelización, Conversaciones y Órdenes de venta (0407, 0411–0413 → 0414)

Fecha: 2026-09-12 (rondas 1 y 2) y 2026-09-13 (rondas 3 y 4). Task ID: `c-l07-fidelizacion-conversations`.
Owner / sesión escritora: `c-l07-fidelizacion-conversations-20260912` (Worker asignado por el Director; sin subagentes ni otras sesiones escritoras).
Rondas: cuatro, en la misma sesión y con el mismo owner.
- **Ronda 1.** Importa el lote y publica la PR #106 en `0d247073`.
- **Ronda 2.** Aplica la revisión del Director sobre ese head: cambios visibles y frontera del Portal en la PR, test de inventario, esperas y notas, y vuelta atrás probada de 0407 y 0414. Publica `c09b5155`.
- **Ronda 3.** Tres cambios:
  - incorpora `main` `a3dbac04` por merge (PR #107, SDD-0462; PR #108, SDD-0463);
  - reescribe los textos de la frontera del Portal para que valgan en los dos órdenes respecto de `0452_portal_invoices_tenant_rls`;
  - rehace la vuelta atrás de 0414 para que nunca restaure la policy Portal de 0085.

  Como el merge trae código y SQL nuevos, repite `verify` completo. El primero, sobre `799c8ae3`, falló en `test` sólo por el tope de 20 s del test de inventario. Con el tope propio de 60 s se repitió sobre `dd7e6f49`. La corrida intermedia sobre `2abd3e0d` se interrumpió a propósito (ver «Ronda 3»).
- **Ronda 4.** El Director aplicó 0407, 0411, 0412 y 0413 a producción el 2026-09-13. La rama incorpora `main` por merge dos veces (`76797beb`, con PR #109 y PR #105; y `a9a12eed`, con PR #110), retira esas cuatro esperas y las tres declaraciones, reescribe la espera de 0414 y las notas de las specs con el patrón de migración aplicada, y la PR deja de ser migrate-first. Repite `verify` completo sobre el head de código de la ronda. Registro en «RONDA 4».

Estado de tarea: lista-para-revision. PR #106 en borrador. **Ya no aplica el bloqueo migrate-first:** `0407_invoices_write_rbac`, `0411_client_annual_billing_facade`, `0412_conversation_outstanding_facade` y `0413_sales_order_invoice_facade` fueron aplicadas a producción el 2026-09-13 con OK nominal de Sam (ledgers `20260913224300`, `20260913224418`, `20260913224437` y `20260913224453`), así que la rama dejó de declararlas como espera y la PR puede integrarse en el orden normal; `0414_invoices_read_rbac` sigue pendiente y va sólo después del despliegue de esta PR y del smoke por roles. Release y aplicación de migraciones quedan fuera de esta tarea.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal en `main`, sin tocar).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l07-fidelizacion-conversations`.
Rama: `codex/c-l07-fidelizacion-conversations`.
- **Base original.** `origin/main` `bca98147672a6255192b62b247ab3f5c44061bb2`, sin cambios hasta la ronda 2.
- **Base efectiva de la PR.** En la ronda 3 la rama incorporó `origin/main` `a3dbac042de81a17bc38e50833ea40651a878f1c` con el merge `0d166684`. En la ronda 4 incorporó `origin/main` `76797beb3bb30c05ff493b388bb28b0cfb6314b7` con el merge `94e42666` y, por aviso del Director antes del push, `origin/main` `a9a12eed87ed10f5eb14d80dbd591de64b1da698` con el merge `2c04e369`; sin rebase ni force en ninguna ronda.

Origen de solo lectura: `refs/dtd/pr/21` = `origin/codex/saneamiento-integral` = `ea9952a47f4adf14c48c91e6d0147597beb94aa7`. Base común de la PR #21 con `main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`. Commits de origen del lote: `ff3b4fa1` (SDD-0350), `a5d9c897` y `219f9400` (SDD-0354), `8b112b5a` (SDD-0355), `3ca9a79d` (SDD-0356) y `702de3f4` (SDD-0357).
SDD:
- **Specs.** `docs/specs/0350-invoices-write-rbac`, `0354-client-annual-billing-facade`, `0355-conversation-outstanding-facade`, `0356-sales-order-invoice-facade` y `0357-invoices-read-rbac`, con el frontmatter de origen (`status: done`) y nota de importación.
- **Migraciones.** `0407_invoices_write_rbac`, `0411_client_annual_billing_facade`, `0412_conversation_outstanding_facade` y `0413_sales_order_invoice_facade`, aplicadas a producción el 2026-09-13 (ronda 4); `0414_invoices_read_rbac`, declarada pendiente.
- **Numeración.** Sin reserva de número: se conserva la de origen. Ninguna ref local o remota fuera de la PR #21 tiene esas migraciones ni esas carpetas de spec.

Permisos: commits selectivos; push de la rama a sí misma y PR en borrador contra `main`, autorizados por Sam. Prohibidos: merge a `main`, sacar la PR de borrador, deploy, aplicar migraciones, tocar el ruleset, borrar ramas o worktrees y leer filas de negocio.
Aceptación:
- L07 extraído desde la PR #21 con SQL, contratos, specs, código y pruebas, conservando lo que `main` agregó.
- Una espera por migración con orden obligatorio, locks medidos y párrafo literal de autorización, sin tocar `cutoff`.
- Declaración migrate-first de las tres RPC e índice de specs regenerado con el script.
- Cinco análisis antes de publicar: migrate-first por facade, inventario de lectores y escritores de `invoices`, paridad con controles rojos, datos personales y financieros, y locks con timeouts.
- `lock_timeout` y `statement_timeout` pre-autorizados en las migraciones con ACCESS EXCLUSIVE sobre `invoices`, con aserción estática.
- `corepack pnpm verify` completo sobre el head de código, con veredicto por paso y archivo meta.
- **Ronda 2:**
  - Sección «Cambios de comportamiento visibles al desplegar» en la PR.
  - Frontera del Portal de 0414 explícita en su espera y en la PR, con la ausencia de mensaje de error.
  - `invoice-read-boundary.test.mjs` importado si pasa contra el código real sin requerir código ausente, con control rojo.
  - Vuelta atrás de 0407 y 0414 escrita, probada con comparación de catálogo y citada desde las esperas.
  - Validación proporcional sin verify completo, con `git diff --stat 961ec85e..HEAD` limitado al test, las notas, las esperas y el handoff.
- **Ronda 3:**
  - Merge de `origin/main` sin rebase ni force, con el driver semántico para baseline, declaraciones e índice, conservando la espera de 0452 y las de L07, e índice regenerado con el script.
  - Espera de 0414, nota de 0357 y sección de la PR correctas en los dos órdenes respecto de 0452.
  - Vuelta atrás de 0414 que nunca recrea la policy de 0085, con postflight de expresión exacta, probada en dos escenarios (con 0452 y sin ella) con fotos de catálogo y la cadena 0414 → 0407.
  - `verify` completo sobre el head de código final y allowlist cubriendo el diff contra `main`.
- **Ronda 4:**
  - Claim con el mismo owner; árbol limpio y head `42dd00c2` al empezar.
  - Merge de `origin/main` `76797beb` y, antes del push, de `a9a12eed`, sin rebase ni force, con el driver semántico de `main`; índice regenerado con el script.
  - Esperas de 0407, 0411, 0412 y 0413 y las tres declaraciones de L07 retiradas; espera de 0414 actualizada con las cuatro aplicadas y el paso siguiente; `cutoff` intacto; gate `0 ROJO · 0 AMARILLO`.
  - Notas de 0350, 0354, 0355 y 0356 con el patrón de migración aplicada; en 0357 sólo lo que mencionaba a 0407 y 0411–0413 como pendientes; frontmatter intacto.
  - PR sin bloqueo migrate-first, con el estado real en la primera línea.
  - `verify` completo sobre el head final con veredicto por paso y meta, lanzado sólo cuando no corría otro verify.
  - Todos los commits antes de un único push normal; PR en borrador; claim liberado.

## OBJETIVO ORIGINAL

Extraer el lote L07 del bloque C desde la PR #21: el RBAC de escritura y lectura de `invoices` (0407 y 0414) y las tres facades que lo preparan, que son la facturación anual de Fidelización, CRM y Reportes (0411), el saldo de Conversaciones (0412) y las referencias de facturas de Órdenes de venta (0413). Traer su SQL, specs, código y pruebas, listo para revisión en una PR borrador contra `main`, sin aplicar nada a producción ni leer filas de negocio. Es el lote de mayor riesgo del bloque: restringe quién lee y escribe facturas.

Ronda 2, revisión del Director sobre `0d247073`. Acepta la PR en lo sustancial y decide seis puntos:
1. Acepta las divergencias de paridad y pide listarlas en lenguaje llano en la PR.
2. Acepta como intencional la frontera del Portal de 0414 y pide declararla, con la ausencia de mensaje de error, en la espera y en la PR.
3. Deja sin cambios la fuga del Portal mientras dimensiona su exposición con Sam.
4. Confirma fuera de alcance la página de Órdenes de venta.
5. Pide importar el test de inventario si pasa contra el código real.
6. Pide la vuelta atrás de 0407 y 0414, probada con comparación de catálogo.

Ronda 3, sobre `c09b5155`. `main` avanzó a `a3dbac04` con la PR #107 (SDD-0462: lecturas de facturas del Portal por tenant del principal, PDF y datos del emisor incluidos) y la PR #108 (SDD-0463: migración `0452_portal_invoices_tenant_rls`, pendiente, que deja la policy Portal con la expresión de 0414). El Director pide:
1. Incorporar `main` por merge, con el driver semántico.
2. Adaptar los textos de la frontera a los dos órdenes, partiendo del «TEXTO PROPUESTO PARA LA PR #106» de `.agents/handoffs/portal-facturas-rls.md`.
3. Por decisión suya, que la vuelta atrás de 0414 nunca recree la policy vulnerable de 0085, con postflight de expresión exacta y prueba en los dos escenarios.
4. `verify` completo.
5. Un único push normal.

Ronda 4, sobre `42dd00c2`. El Director aplicó a producción `0407_invoices_write_rbac`, `0411_client_annual_billing_facade`, `0412_conversation_outstanding_facade` y `0413_sales_order_invoice_facade` el 2026-09-13, de a una y en ese orden, con autorización de Sam, desde los archivos exactos de ese head. Pide dejar la PR lista para fusionar, como L01, L10 y L14 en sus rondas «migración aplicada»:
1. Claim con el mismo owner; árbol limpio y head `42dd00c2`.
2. Incorporar `origin/main` `76797beb` por merge, con el driver semántico de `main`, y regenerar el índice. Aviso posterior, antes del push: `main` avanzó a `a9a12eed` (PR #110, registro de 0451 aplicada; retira su espera); volver a mergear con el driver y correr el verify sobre el head final.
3. Retirar las esperas de 0407, 0411, 0412 y 0413 y las tres declaraciones; actualizar la espera de 0414; `cutoff` intacto.
4. Notas de importación con el patrón «migración aplicada»; en 0357 sólo lo que las mencionaba como pendientes.
5. Primera línea de la PR con el estado real.
6. `verify` completo sobre el head final, sin pisar el verify del Worker de L14.
7. Sección «RONDA 4» en este handoff, sin marcadores.
8. Todos los commits antes de un único push normal; PR en borrador; liberar el claim.

## COMPLETADO

> Lo que sigue describe las rondas 1 a 3 y se conserva como evidencia fechada. Quedaron superados por la ronda 4: las esperas y declaraciones de 0407 y 0411–0413, que ya no existen porque esas migraciones están aplicadas; el bloqueo migrate-first y la primera línea de la PR; las notas de importación de 0350, 0354, 0355 y 0356; la frontera del Portal «en los dos órdenes», que en producción quedó en el caso de 0452 aplicada antes que 0407; y la secuencia de release, cuyos pasos 1 y 2 ya ocurrieron. La sección «RONDA 4» manda sobre esos puntos.

### Archivos y relación con el origen

Diff contra `origin/main` `a3dbac04`, después del merge de la ronda 3: 29 archivos más este handoff, los mismos que en la ronda 2. `node allowlist-coverage.mjs origin/main` da 30 archivos y 0 sin cubrir: 27 por la allowlist exacta de alguna spec y 3 declarados en las notas de importación (la baseline, las declaraciones y este handoff). Tras la ronda 4 (base `76797beb`) son 28 archivos más este handoff: las declaraciones ya no aparecen porque quedaron iguales a `main`; 27 por allowlist y 2 por notas (ver «RONDA 4»).

| Archivo | Relación con el origen |
|---|---|
| `supabase/migrations/0407_invoices_write_rbac.sql` | origen `fd09c451` más la cabecera de importación `:24-30` y los timeouts `:32-33`; preflight, DDL, ACL, comentario y postflight idénticos |
| `supabase/migrations/0411_client_annual_billing_facade.sql` | idéntico (`7d44ed29`) |
| `supabase/migrations/0412_conversation_outstanding_facade.sql` | idéntico (`e2c519ac`) |
| `supabase/migrations/0413_sales_order_invoice_facade.sql` | idéntico (`4d927a53`) |
| `supabase/migrations/0414_invoices_read_rbac.sql` | origen `2d10396e` más la cabecera `:4-10` y los timeouts `:12-13`; resto idéntico |
| `supabase/tests/0407_invoices_write_rbac.test.sql` | origen `3077b0dd` más la aserción estática y la comprobación en transacción `:92-119` |
| `supabase/tests/0411…`, `0412…` y `0413…test.sql` | idénticos (`fde20368`, `0e724c0f`, `4f72b295`) |
| `supabase/tests/0414_invoices_read_rbac.test.sql` | origen `f6a2f59d` más la anulación de los topes de 0407 `:130-133` y la aserción estática y comprobación `:136-163` |
| `lib/studio/fidelizacion/queries.ts` | idéntico (`2fe1bfe2`); `main` tenía el blob de la base común |
| `lib/studio/fidelizacion/__tests__/queries.test.ts` | idéntico (`bd5511d5`) |
| `lib/studio/reports/__tests__/queries.test.ts` | idéntico (`02541fde`) |
| `app/api/studio/conversaciones/[id]/route.ts` | idéntico (`964ac7d4`) |
| `lib/studio/conversaciones/conversations-queries.ts` | idéntico (`be3f333b`) |
| `lib/studio/conversaciones/conversations-types.ts` | `main` más sólo el comentario del saldo del origen (`:108`); conserva `STATUS_TONES.abierto = "info"` de `main` |
| `lib/studio/conversaciones/__tests__/conversaciones.test.ts` | `main` menos el import y el bloque de `aggregateOutstanding`; conserva la expectativa `info` de `main` |
| `lib/studio/conversaciones/__tests__/client-context.test.ts` | nuevo, idéntico (`c82f3013`) |
| `lib/studio/sales-orders/queries.ts` | `main` más sólo los trozos de SDD-0356: import de `fetchAllByIds` (`:16`), `SalesOrderInvoiceRef` sin fechas (`:207-212`) y `listInvoicesForSalesOrder` sobre `listInvoicesBySalesOrder` (`:218-262`) |
| `lib/studio/__tests__/orders-relations-batch.test.ts` | nuevo, recortado: el origen `e813f645` mezclaba SDD-0322 y SDD-0356 |
| `scripts/__tests__/invoice-read-boundary.test.mjs` | ronda 2: nuevo, idéntico (`97c82149`), sin ajustar su lista de lectores. Ronda 3 (`dd7e6f49`): sólo suma el tope propio de 60 s de la primera prueba y su comentario; lista, recorrido y aserciones idénticos |
| las cinco `docs/specs/…/spec.md` | origen más la nota de importación; frontmatter intacto. En las rondas 2 y 3, las notas de 0350 y 0357 suman la vuelta atrás, la frontera del Portal en los dos órdenes, el test y su tope propio |
| `docs/specs/README.md` | regenerado con `node scripts/build-docs-index.mjs`. Tras el merge de la ronda 3 da 446 specs, con 0462 y 0463 de `main` |
| `supabase/migrations-baseline.json` | cinco esperas de L07 más 0451 y 0452 de `main`; `cutoff 238` y `$doc` idénticos a `main`, comprobado por valor. En la ronda 3 cambian las esperas de 0414 y 0407. Ronda 4: sólo la espera de 0414, reescrita, más 0451 y 0415 de `main`; 3 líneas de diff |
| `supabase/pending-migration-symbol-declarations.json` | tres declaraciones AMARILLO; `schemaVersion` y `$doc` idénticos a `main`. Ronda 4: byte a byte igual a `main` (`degradations: []`); ya no está en el diff |

La identidad se comprobó con `git hash-object` al importar y con `git rev-parse HEAD:<ruta>` contra `refs/dtd/pr/21:<ruta>`: el primer commit (`6330cb46`) guarda los diez SQL idénticos al origen y la desviación queda sola en el segundo (`b6fdf92f`). El test de la ronda 2 se comprobó igual en `e952e4bd`; en la ronda 3, `git diff e952e4bd dd7e6f49` sobre el test da sólo el comentario y el tope (5 líneas más y 1 menos). Los SQL van byte a byte (`-text` en `.gitattributes`) y se comprobó con Node que ningún archivo tocado tiene CR.

### Solapamientos con `main` y resolución

- Desde la base común, `main` sólo tocó dos líneas del alcance: `STATUS_TONES.abierto` pasó de `warning` a `info` y su expectativa en el test. Se conservan; de esos dos archivos sólo entra lo de L07.
- En el origen, `lib/studio/sales-orders/queries.ts` y `orders-relations-batch.test.ts` mezclan SDD-0322 (commit `1faff60b`: `listPrealertasBySalesOrder`, columna `sales_order_id` de prealertas, ítems de compra y lectura de las páginas) con SDD-0356 (`3ca9a79d`). Entra sólo 0356. La spec 0322 está en `main` sin ese código. El test recortado conserva los casos de facturas (agrupación por RPC sin consulta por orden, error que no se vuelve vacío y lote vacío) y agrega uno: el helper de una orden delega en la misma RPC. En el cliente falso, `from` lanza para probar que no hay lectura directa.
- `digest-extract.ts` y `monthly-digest.ts`, que la PR #21 cambió en la misma carpeta por observabilidad, no entran.
- `scripts/__tests__/invoice-read-boundary.test.mjs`, de la allowlist de SDD-0357, quedó fuera en la ronda 1 y entró en la ronda 2 por decisión del Director.
- **Ronda 3, merge de `a3dbac04`** (`git merge --no-ff --no-commit origin/main`, commit `0d166684`, padres `c09b5155` y `a3dbac04`):
  - **Sin conflictos textuales.** El driver `dtd-generated-records`, verificado con `node scripts/install-merge-drivers.mjs --check`, fusionó los dos registros que tocaban ambos lados («✓ merge semántico» en los dos).
    - `supabase/migrations-baseline.json`: siete esperas. 0451 y 0452 son idénticas a `main`, y 0407 y 0411–0414, a la rama; `cutoff` y `$doc` sin cambios.
    - `docs/specs/README.md`: `node scripts/build-docs-index.mjs` lo regeneró sin diferencias frente al resultado del driver (446 specs).
  - `supabase/pending-migration-symbol-declarations.json` no cambió: `main` no lo tocó.
  - Ningún archivo de código, migración ni prueba de L07 se solapa con los de #107 y #108.

### Esperas y declaración

- `supabase/migrations-baseline.json`: una espera por migración, en el estilo de las PR #104 y #105. Cada una lleva lo que hace la migración, el orden obligatorio de L07, las lecturas de catálogo previas (0407), la condición transaccional literal de `set local` (0407 y 0414), locks y contención medidos, qué rompe en silencio (0414) y el párrafo literal de autorización.
  - En la ronda 2, las de 0407 y 0414 remiten a la vuelta atrás probada.
  - En la ronda 3, la de 0414 declara la frontera del Portal en los dos órdenes respecto de 0452 y la vuelta atrás que no restaura la policy de 0085; la de 0407, que su vuelta atrás no toca la policy Portal.
- `supabase/pending-migration-symbol-declarations.json`: `studio_client_annual_billing`, `conversation_client_outstanding` y `sales_order_invoice_refs` quedan AMARILLO con su sitio de llamada y la evidencia del degradado. El gate da `0 ROJO · 3 AMARILLO`.

### Specs importadas

Las cinco conservan el frontmatter de origen. Cada nota de importación, con el patrón de `0352-bank-reconciliation-rbac`, registra el origen y sus commits, los cortes, la paridad medida, el estado real **pendiente de aplicar** y los archivos que entran fuera de su allowlist: los registros de pendientes y este handoff. Las notas de 0350 y 0357 registran además la desviación de timeouts y la vuelta atrás. La de 0357 suma la frontera del Portal en los dos órdenes, el test de inventario con su tope propio y la vuelta atrás que no restaura la policy de 0085.

### Ronda 2

**Decisiones del Director aplicadas:**
1. **Divergencias de paridad, aceptadas.** El cuerpo de la PR #106 tiene «Cambios de comportamiento visibles al desplegar», con los siete cambios en lenguaje llano y lo que no tiene efecto visible.
2. **Frontera del Portal con 0414, aceptada.** La espera de 0414, la nota de 0357 y la PR la declaran explícita, sin mensaje de error. Su redacción se rehízo en la ronda 3.
3. **Fuga del Portal.** Sin cambios en esa ronda. En la ronda 3, `main` la cerró en la app (SDD-0462) y la 0452 la cierra en la base (SDD-0463).
4. **Órdenes de venta y SDD-0322.** Fuera de alcance, en «FUERA DE ALCANCE DETECTADO» 3.
5. **Test de inventario.** Importado sin ajustes en esa ronda. En la ronda 3 recibe un tope propio de 60 s (ver «Ronda 3»).
6. **Vuelta atrás de 0407 y 0414.** Escrita y probada. Se rehízo en la ronda 3.

**Test de inventario.**
- **Qué entra.** Entra idéntico al origen: blob `97c82149` en `e952e4bd`. Congela 45 llamadas directas `from("invoices")` en 18 archivos de `app/`, `lib/` y `supabase/functions/`, sin contar tests, comentarios ni ejemplos. Además comprueba que los widgets `monthRevenue`, `invoicesDue`, `pendingCollect` y `avgTicket` siguen en el módulo `invoices`, cerrado a overrides para los cinco roles no financieros.
- **Sin ajustes en la ronda 2.** Su lista coincide archivo por archivo con el inventario AST de esta rama. Sus imports existen en `main`: `canAccessModule` (`lib/studio/rbac.ts:318`) y `KPI_CATALOG` (`lib/studio/dashboard/dashboard-catalog.ts:51`). No requiere SDD-0322, SDD-0390 ni otro código ausente.
- **Vitest lo descubre.** `vitest.config.ts` no restringe `include` y sólo excluye `node_modules`, `.next`, `.claude` y `e2e` (`:31`).
- **Focal.** PASÓ, 3/3.
- **Control rojo.** Un `db.from("invoices")` en `lib/studio/__l07_control_rojo_lector_facturas.ts` hizo fallar la primera prueba con `expected { …(19) } to deeply equal { …(18) }`. Retirado, volvió a pasar 3/3.
- **PR #104 y #105.** El conteo AST de los 14 y 1 archivos de producción que tocan da 0 cambios.

La ronda 2 midió la frontera del Portal sobre `bca98147`, con el código del Portal anterior a SDD-0462. Sus cifras de la ruta del PDF («hoy entrega la factura y tras 0414 responde 404») ya no valen en `main`: la ronda 3 las reemplaza (ver «Ronda 3»).

### Ronda 3

**Merge.** Ver «Solapamientos con `main` y resolución». Tras el merge:
- `invoice-read-boundary.test.mjs` pasó focal 3/3 (`round3/test-invoice-read-boundary-post-merge.log`).
- El inventario AST propio sigue en 45 llamadas en 18 archivos (`round3/inventory-post-merge.txt`): SDD-0462 cambió cómo se leen las facturas del Portal, pero no la cantidad de llamadas directas.
- Pasaron los gates de símbolos (0 ROJO · 3 AMARILLO), índice (446 specs) y numeración, y la cobertura de allowlists (`round3/allowlist-coverage-post-merge.txt`).

**Test de inventario: tope propio de 60 s (`dd7e6f49`).**
- **Qué falló.** El `verify` completo sobre `799c8ae3` salió en rojo en `test` sólo por la primera prueba de `invoice-read-boundary.test.mjs`, en el intento y en el reintento: `Test timed out in 20000ms`, con 22.381 ms y 20.821 ms. Las otras 6.838 pruebas pasaron.
- **Causa.** La prueba lee y parsea con TypeScript unos 1.600 módulos de `app/`, `lib/` y `supabase/functions/`. Sola tarda unos 2,5 s, pero bajo la carga de la suite pasa del tope global de 20 s (`vitest.config.ts:50`).
- **Ajuste.** `60_000` como tercer argumento de `it`, con un comentario que lo justifica. La lista, el recorrido y las aserciones quedan idénticos al origen, y la nota de 0357 registra el cambio.
- **Por qué no debilita la prueba.** Es sincrónica: Vitest no puede cortarla a mitad y sólo compara la duración cuando termina (`withTimeout`, `node_modules/.pnpm/@vitest+runner@4.1.7/node_modules/@vitest/runner/dist/chunk-artifact.js:2288-2291`). Una copia temporal con tope de 1 ms falló con `Test timed out in 1ms.` a los 2.198 ms, después de recorrer todo.
- **Controles.**
  - Focal: 3/3.
  - Control rojo del inventario, repetido con el tope nuevo: `expected { …(19) } to deeply equal { …(18) }`, y verde al retirar el lector ficticio.
  - Suite completa, con el mismo comando que el paso `test` de `verify`: 547 archivos y 6.839 pruebas. Esta prueba tardó 18.943 ms y es la más lenta de la suite; la siguiente, 7.046 ms.
- **Descartado: prefiltrar por el texto `invoices`.** Se probó primero y se retiró antes del commit. Medición con el mismo AST sobre el árbol real (`round3/prefilter-variants.log`):

  | Variante | Módulos parseados | Inventario del árbol | Mediana de 5 |
  |---|---|---|---|
  | sin prefiltro (origen) | 1.612 | 45 en 18 | 1.605 ms |
  | texto `invoices` | 66 | 45 en 18 | 759 ms |
  | texto `invoices` o un escape que deletree sus letras | 175 | 45 en 18 | 848 ms |
  | texto `invoices` o una barra invertida | 350 | 45 en 18 | 969 ms |
  | sólo recorrer y leer | 0 | — | 674 ms |

  - **El primero pierde casos.** En el árbol actual da el mismo inventario, pero deja fuera literales escritos con escapes que el AST sí cuenta: `'inv\x6fices'`, `` `\u{69}nvoices` ``, `"inv\oices"`, el escape unicode de cuatro dígitos de la `i` y la continuación de línea dentro del literal. Pierde 5 de los 6 casos sintéticos.
  - **Las variantes sin pérdida ahorran poco.** Bajan de 1,6 a 0,85 o 1,0 s, porque leer los archivos cuesta 0,7 s. Bajo carga quedarían cerca del tope, así que no lo evitan.
  - **Para recortar la prueba.** Si el Director quiere hacerlo, la variante segura más simple es «texto `invoices` o una barra invertida».
- **Commit rehecho antes de publicar.** El primer commit del ajuste, `2abd3e0d`, dejó mal un ejemplo en la nota de 0357 y en su mensaje: el escape unicode de cuatro dígitos se decodificó al escribirlo y quedó el literal plano `"invoices"`, que no ilustra nada.
  - Su `verify` se detuvo en `e2e`. Hasta ahí todo había pasado, `test` incluido.
  - El ejemplo pasó a ser `'inv\x6fices'` y el commit local, nunca publicado, se rehízo como `dd7e6f49`: mismo padre, mismo blob del test (`b40e3936`) y una sola línea distinta en la nota.
  - El árbol de procesos de ese verify se terminó con `taskkill /T /F` desde su `corepack`. No quedaron procesos ni contenedores.

**Qué cambió en `main` y cómo lo toma L07:**
- **SDD-0462 (PR #107).** `listMyInvoices`, `getMyInvoice` y `getMyInvoiceForPrincipal` resuelven primero el principal Portal vivo y coherente y filtran por su `tenant_id` y su Shipping Mark (`lib/portal/portal-queries.ts:242-253` y `:283-308`). La ruta del PDF resuelve el principal antes de leer la factura y responde 404 sin él (`app/portal/(app)/facturas/[code]/pdf/route.ts:50-51`). Los datos del emisor se filtran por el tenant del principal (`lib/studio/company-queries.ts:125` y `:132`). En la app, la frontera del Portal ya no depende de la RLS.
- **SDD-0463 (PR #108).** `0452_portal_invoices_tenant_rls`, pendiente, reemplaza sólo `invoices portal self read` por la expresión idéntica a la de 0414 dentro de un único `do`. Su preflight acepta la forma de 0085 (la reemplaza) o la final (no la toca).
  - **Su medición.** El catálogo de policies converge con L07 en orden cronológico, en el rebuild numérico y con L07 sola (md5 `345b2d1080a2e87e93639f2f0be8b28b`).
  - **La mía, en esta ronda.** La foto tras 0414 es idéntica con 0452 previa y sin ella.

**Textos en los dos órdenes.** Adaptan el «TEXTO PROPUESTO PARA LA PR #106» de `.agents/handoffs/portal-facturas-rls.md`, que sólo valía si 0452 se aplicaba antes.
- **Espera de 0414.**
  - Qué hace 0414 con la policy Portal y qué pasa con 0452 aplicada antes y sin ella.
  - Su preflight pasa con las dos formas.
  - Frontera aceptada sin mensaje de error, que rige desde la primera de las dos migraciones que se aplique.
  - En la app no cambia nada en ningún orden, por SDD-0462.
  - La vuelta atrás nueva y la remisión a sus recibos.
- **Espera de 0407.** La vuelta atrás no toca la policy Portal y está probada con 0452 y sin ella.
- **Notas de 0357 y 0350.** Lo mismo que las esperas, más el test de inventario tras el merge.
- **PR #106.** «Frontera del Portal al aplicar 0414», «Vuelta atrás de 0407 y 0414, probada», «Qué trae», validación y decisiones de la ronda 3.

**Sonda de la app con el código de `main`.** `tools/portal-app-probe-r3.mts` llama a `listMyInvoices` y `getMyInvoice` de la rama tras el merge, con un cliente que simula la sesión de supabase-js (`auth.getUser()` devuelve el `sub` del JWT). Además hace `GET /invoices` directo por PostgREST v16.1 con el JWT de cada identidad, en cuatro estados:
- sin 0452, antes de 0414 (policy de 0085);
- con 0452, antes de 0414;
- tras 0414;
- tras revertir 0414.

Resultado (`results/rollback-r3/portal-app-*.json` y `portal-directo-resumen.txt`):
- **App.** La lista y el detalle son idénticos en los cuatro estados para las seis identidades: DUP T1 ve D01 y D02; DUP T2 ve D2-01, S2-01 y S2-X; cliente borrado, incoherente y revocado, nada; el comercial con vínculo Portal en T2, A2-01.
- **Lectura directa de las cinco identidades Portal puras.** Con la policy de 0085, DUP T1 lee también D2-01, S2-01 y S2-X de T2; el vínculo con cliente borrado lee X01; el incoherente, cinco facturas de los dos tenants. Con 0452, tras 0414 y tras revertir 0414 es la misma: DUP T1 sólo sus dos de T1, y cero filas para el borrado y el incoherente.

```
SIN 0452, ANTES DE 0414 (0085)
portal DUP T1 (coherente): D01@T1,D02@T1,D2-01@T2,S2-01@T2,S2-X@T2
portal DUP T2 (coherente): D01@T1,D02@T1,D2-01@T2,S2-01@T2,S2-X@T2
portal cliente borrado: X01@T1
portal incoherente (vínculo T1, cliente T2): D01@T1,D02@T1,D2-01@T2,S2-01@T2,S2-X@T2
portal revocado: (0 filas)
commercial T1 con vínculo Portal en T2: 1000 filas (tope de PostgREST), T1 1000

CON 0452, ANTES DE 0414
portal DUP T1 (coherente): D01@T1,D02@T1
portal DUP T2 (coherente): D2-01@T2,S2-01@T2,S2-X@T2
portal cliente borrado: (0 filas)
portal incoherente (vínculo T1, cliente T2): (0 filas)
portal revocado: (0 filas)
commercial T1 con vínculo Portal en T2: 1000 filas (tope de PostgREST), T1 1000

TRAS 0414
portal DUP T1 (coherente): D01@T1,D02@T1
portal DUP T2 (coherente): D2-01@T2,S2-01@T2,S2-X@T2
portal cliente borrado: (0 filas)
portal incoherente (vínculo T1, cliente T2): (0 filas)
portal revocado: (0 filas)
commercial T1 con vínculo Portal en T2: A2-01@T2

TRAS REVERTIR 0414 (sin 0452)
portal DUP T1 (coherente): D01@T1,D02@T1
portal DUP T2 (coherente): D2-01@T2,S2-01@T2,S2-X@T2
portal cliente borrado: (0 filas)
portal incoherente (vínculo T1, cliente T2): (0 filas)
portal revocado: (0 filas)
commercial T1 con vínculo Portal en T2: 1000 filas (tope de PostgREST), T1 1000
```

## RONDA 4 — 2026-09-13 · 0407 y 0411–0413 aplicadas y rama al día con `main`

Misma sesión y mismo owner que las rondas 1 a 3 (`c-l07-fidelizacion-conversations-20260912`), con el claim reclamado de nuevo. Antes de editar: `guard` OK, `git status --porcelain` vacío y `HEAD = 42dd00c2f5eac2eb23300ea83a1e64fdb49cbca5`, la cabeza publicada de la ronda 3. No se creó otra rama ni otro worktree; desde esta sesión no se ejecutó nada contra Supabase. Precedente: la ronda 2 de L10 (`.agents/handoffs/c-l10-recordatorios-cobranzas.md`, «RONDA 2»).

### Lo que cambió

- **0407, 0411, 0412 y 0413 dejaron de ser esperas.** Las cuatro fueron aplicadas a producción el 2026-09-13 por el Director, de a una y en ese orden, con autorización de Sam, desde los archivos exactos de `42dd00c2`. Evidencia entregada por el Director (recibos fuera de Git en `…/scratchpad/prod-l07/` y `prod-l14/`), copiada tal cual:
  - Ledger de producción, una fila por migración, con name exacto:
    - `20260913224300 | 0407_invoices_write_rbac | 1 sentencia | md5 57b489f7c181f930a3dce82bb15dc449 | 5355 bytes`
    - `20260913224418 | 0411_client_annual_billing_facade | md5 f178a2d028f658b8d84da36005bc58ee | 5628 bytes`
    - `20260913224437 | 0412_conversation_outstanding_facade | md5 ed692e75b4ea9e3dba1799dbbfec613d | 4024 bytes`
    - `20260913224453 | 0413_sales_order_invoice_facade | md5 f501e4e17df340b6dc9dbf86e19c721a | 3337 bytes`
    - Ledger total tras las cuatro: 457 filas.
  - Preflight de 0407, leído del catálogo sin filas: policies `invoices by tenant` [ALL] e `invoices portal self read` [SELECT, ya con la expresión de 0452]; relacl `authenticated=arwdxtm`.
  - Postflight de 0407: policies `invoices_team_select`, `invoices_accounting_insert`, `invoices_accounting_update` e `invoices portal self read`; 0 restos de la histórica; `authenticated` SELECT, INSERT y UPDATE true y DELETE false (relacl `arwxtm`); comentario de tabla actualizado.
  - Postflight de las tres RPC: SECURITY DEFINER, STABLE, `search_path=""`, owner postgres, EXECUTE `authenticated=true` y `anon=false`, comentario presente.
  - Advisors de seguridad de producción antes y después del bloque, comparados hallazgo por hallazgo. Antes (tras L14): `rls_enabled_no_policy` INFO 22 · `extension_in_public` WARN 1 · `anon_security_definer_function_executable` WARN 22 · `authenticated_security_definer_function_executable` WARN 175. Después: idéntico salvo `authenticated_security_definer_function_executable` WARN 178. Los tres hallazgos nuevos son exactamente `public.studio_client_annual_billing`, `public.conversation_client_outstanding` y `public.sales_order_invoice_refs`: RPC SECURITY DEFINER con EXECUTE para `authenticated`, con el control de rol y de módulo (overrides de SDD-0252) adentro; `anon` sigue sin EXECUTE (su lint quedó en 22). 0407 no cambió ningún hallazgo. Es el efecto esperado, el mismo lint que cargan las demás RPC definer del Studio; no es una regresión.
  - Conector: `claude.ai Supabase`, proyecto `xpfuzqombmjmxvprjgmi`, `apply_migration` con name exacto, `{"success": true}` al primer intento en las cuatro. No se leyó ninguna fila de negocio.
  - Contexto: producción tiene un solo tenant (conteo agregado autorizado del 2026-09-13), así que la frontera entre tenants de las policies es preventiva. `0452_portal_invoices_tenant_rls` ya estaba aplicada antes de 0407 (ledger `20260913175856`, registrada por la PR #109): el preflight de 0407 encontró la policy Portal con su expresión.
  - **Identidad comprobada aquí, en local:** `git show HEAD:supabase/migrations/<archivo> | md5sum` y `wc -c` sobre `42dd00c2` dan exactamente los md5 y bytes del ledger: 0407 `57b489f7…` y 5355 (blob `8b55df68`), 0411 `f178a2d0…` y 5628 (blob `7d44ed29`), 0412 `ed692e75…` y 4024 (blob `e2c519ac`) y 0413 `f501e4e1…` y 3337 (blob `4d927a53`); 0 CR. Ninguno de esos archivos existe en `main`, así que el merge no los tocó. No se consultó producción desde esta sesión.
  - **Lo que esto cierra:** el análisis 1 (MIGRATE-FIRST POR FACADE) ya no bloquea. Las tres RPC existen en la base antes de fusionar el código que las consume, así que `clientAnnualBilling` y `listInvoicesForSalesOrder` no pueden caer en `PGRST202` en producción y `getClientContext` no degrada a `null` por RPC ausente. La medición de la ronda 1 sigue valiendo como descripción de lo que pasaría sin ellas. También quedó cumplido el preflight de 0411 (exigía `invoices_team_select`, que creó 0407) y el de 0414 (exige las tres RPC como SECURITY DEFINER y exactamente `invoices_team_select` e `invoices portal self read`): el postflight de producción dio eso.
- **Merge de `origin/main` `76797beb`** (commit `94e42666`, padres `42dd00c2` y `76797beb`), sin rebase ni force. Desde `a3dbac04` entraron la PR #109 (registro de 0452 aplicada; retiró su espera) y la PR #105 (L10: 0410 aplicada, 0415 pendiente, código de Cobranzas y sus specs): 13 archivos, ninguno de L07. Se usó el driver de `main` con el override (`git -c merge.dtd-generated-records.driver="node \"<driver-de-main>\" %O %A %B %P" merge --no-commit --no-ff origin/main`), con el driver extraído de `origin/main:scripts/merge-generated-records.mjs` a un archivo fuera del repo; el de esta rama es idéntico (md5 `b4563696716d6893d48e619ec0e9eca4` en ambos).
  - **Conflictos: ninguno.** «✓ merge semántico» en dos registros:
    - `supabase/migrations-baseline.json`: quedaron 0451 y 0415 idénticas a `main` (0452 salió, como en #109) y 0407, 0411–0414 idénticas a la rama; `cutoff 238` y `$doc` iguales a `main`, comprobado por valor. La retirada de las cuatro aplicadas va en el commit siguiente.
    - `docs/specs/README.md`: unión de las filas 0353 y 0358 de `main` con 0350 y 0354–0357 de la rama; `node scripts/build-docs-index.mjs` después no cambió un byte (448 specs, 15 huecos).
  - `supabase/pending-migration-symbol-declarations.json` no lo tocó `main`, así que Git conservó el de la rama sin ejecutar el driver; se vacía en el commit siguiente.
  - `git diff --check` limpio.
- **Segundo merge, de `origin/main` `a9a12eed`** (commit `2c04e369`, padres `e9ed92ab` y `a9a12eed`), por aviso del Director antes del push: entró la PR #110 (registro de 0451 aplicada; retira su espera y actualiza la spec 0461), 3 archivos ajenos a L07. Mismo driver de `main` (md5 sin cambios). **Conflictos: ninguno.** «✓ merge semántico» en `supabase/migrations-baseline.json`: en `main` queda sólo la espera de 0415 y en la rama la de 0414, comprobado por valor (`cutoff 238`, `$doc` y 0415 iguales a `main`; 0414 igual al texto de la ronda). El índice regenerado no cambió (448 specs). Las declaraciones ya eran iguales a `main`. Es el head de código de la ronda 4.
- **Registros** (commit `fd6044d4`, antes del segundo merge). `supabase/migrations-baseline.json` queda con las esperas de `main` (0451 y 0415 en ese momento; tras el segundo merge, sólo 0415) más la única espera viva de L07, `0414_invoices_read_rbac`, reescrita: dice que 0407, 0411, 0412 y 0413 quedaron aplicadas el 2026-09-13 con sus ledgers, md5 y bytes, que su postflight dio exactamente lo que el preflight de 0414 exige, que 0452 está aplicada antes que 0407 y que producción tiene un solo tenant; que el paso siguiente es fusionar y desplegar esta PR y hacer el smoke por roles, y que 0414 se aplica sólo después de ese smoke. Conserva la frase literal de la condición transaccional de `set local`, la frontera del Portal, los locks, la vuelta atrás que no restaura la policy de 0085 y el párrafo literal de autorización. `git diff origin/main -- supabase/migrations-baseline.json` son 3 líneas: la coma que gana 0415 y la línea de 0414. `supabase/pending-migration-symbol-declarations.json` es byte a byte el de `main` (`degradations: []`, md5 `d2ff7560a84064be086a7dd96efb62c5`) y ya no aparece en el diff de la PR. Gate: `0 ROJO · 0 AMARILLO declarado(s)`. `apply-registers-r4.mjs` hizo 25 comprobaciones por valor, todas OK (`round4/registers.log`).
- **Notas de las specs** (commit `e9ed92ab`). Las de 0350, 0354, 0355 y 0356 pasan al patrón de una migración aplicada (`0353` en L10, ronda 2): fecha, ledger, identidad del archivo comprobada aquí, conector y name exacto, preflight y postflight, advisors comparados y registro en esta sección; cada una dice por qué su migración ya no figura como espera ni tiene declaración, y que el orden migrate-first se cumplió. En la de 0357 sólo cambió lo que mencionaba a 0407 y 0411–0413 como pendientes, más el estado real de 0452 (aplicada antes que 0407) y el contexto de un solo tenant, que el Director pidió para la nota. Frontmatter intacto en las cinco, comprobado contra `refs/dtd/pr/21`. El índice no cambia por esto.
- **Cuerpo de la PR.** La primera línea deja de ser «No fusionar antes de aplicar y verificar 0407, 0411, 0412 y 0413» y pasa a decir el estado real: las cuatro aplicadas; fusionar y desplegar es el paso 3 del orden; 0414 va después del smoke por roles. La tabla de migraciones lleva los ledgers, «Frontera del Portal» pasa al caso real (0452 aplicada antes, un solo tenant) y hay una sección nueva con la evidencia de producción.
- **Sin cambios de código ni de SQL.** Los 10 SQL y los 12 archivos de código y pruebas de L07 son los mismos de `dd7e6f49`.

### Diff contra `origin/main` por archivo tras la ronda 4

`git diff --stat origin/main...HEAD` sobre la cabeza de código `2c04e369` (base `a9a12eed`): 28 archivos más este handoff, 29 en total, 4041 líneas más y 217 menos. `node allowlist-coverage.mjs origin/main` da 0 sin cubrir: 27 por la allowlist exacta de alguna spec y 2 declarados en las notas de importación (la baseline y este handoff). Ya no aparece `supabase/pending-migration-symbol-declarations.json`, que quedó igual a `main`.

| Archivo | Δ | Qué es |
|---|---|---|
| `supabase/migrations/0407_invoices_write_rbac.sql` | +124 | **Aplicada en prod el 2026-09-13**; blob `8b55df68`, idéntico al ledger (md5 `57b489f7…`, 5355 B) |
| `supabase/migrations/0411_client_annual_billing_facade.sql` | +159 | **Aplicada en prod el 2026-09-13**; blob `7d44ed29` (md5 `f178a2d0…`, 5628 B) |
| `supabase/migrations/0412_conversation_outstanding_facade.sql` | +108 | **Aplicada en prod el 2026-09-13**; blob `e2c519ac` (md5 `ed692e75…`, 4024 B) |
| `supabase/migrations/0413_sales_order_invoice_facade.sql` | +85 | **Aplicada en prod el 2026-09-13**; blob `4d927a53` (md5 `f501e4e1…`, 3337 B) |
| `supabase/migrations/0414_invoices_read_rbac.sql` | +104 | **Pendiente**, después del despliegue y del smoke; sin cambios desde `b6fdf92f` |
| `supabase/tests/0407…`, `0411…`, `0412…`, `0413…` y `0414…test.sql` | +283, +254, +189, +165 y +298 | Contratos SQL, sin cambios desde la ronda 1 |
| `lib/studio/fidelizacion/queries.ts`, `fidelizacion/__tests__/queries.test.ts` y `reports/__tests__/queries.test.ts` | 80, 110 y 36 líneas | SDD-0354, idénticos al origen |
| `app/api/studio/conversaciones/[id]/route.ts`, `conversations-queries.ts`, `conversations-types.ts`, `conversaciones.test.ts` y `client-context.test.ts` | 2, 58, 2 y 25 líneas, y +98 | SDD-0355, con los cortes de la ronda 1 |
| `lib/studio/sales-orders/queries.ts` y `lib/studio/__tests__/orders-relations-batch.test.ts` | 67 líneas y +109 | SDD-0356, sólo esa spec |
| `scripts/__tests__/invoice-read-boundary.test.mjs` | +92 | Inventario de lectores, con el tope propio de la ronda 3 |
| las cinco `docs/specs/…/spec.md` | +133, +134, +124, +118 y +193 | Specs con las notas de la ronda 4 |
| `docs/specs/README.md` | 9 líneas | Filas 0350 y 0354–0357 y su retiro de los huecos; 448 specs con lo que trae `main` |
| `supabase/migrations-baseline.json` | +2 −1 | Sólo la espera de 0414 y la coma que gana 0415; `cutoff`, `$doc` y 0415 iguales a `main` |
| `.agents/handoffs/c-l07-fidelizacion-conversations.md` | +1096 en `2c04e369`; crece con esta ronda | Este documento |

`git diff --check origin/main...HEAD` limpio.

### Validación de la ronda 4

Recibos fuera de Git en `round4/` del scratchpad de esta tarea: `merge.log`, `merge-2.log`, `registers.log`, `notes.log`, `allowlist-coverage-e9ed92ab.txt`, `allowlist-coverage-2c04e369.txt`, `test-invoice-read-boundary-r4.log`, `precheck-verify-r4.log`, `verify-2c04e369.log`, `.meta` y `.exit`, `orphans-r4.log`, y los scripts `apply-registers-r4.mjs`, `apply-notes-r4.mjs`, `whose-verify.ps1`, `running-verify-check.ps1` y el driver extraído `tools/dtd-merge-driver-main.mjs`. No se copiaron credenciales ni se tocó Supabase.

| Comprobación | Estado y evidencia |
|---|---|
| `claim` / `guard --owner` | PASÓ: claim reclamado de nuevo con el mismo owner; guard antes del merge, de cada commit, del verify y del push. Árbol limpio y `HEAD = 42dd00c2` al empezar |
| Identidad de 0407, 0411, 0412 y 0413 contra el ledger | PASÓ: md5 y bytes de `git show HEAD:<archivo>` iguales a los cuatro ledgers; 0 CR. Comprobación local; no se consultó producción |
| Merges con el driver de `main` (override): `76797beb` y `a9a12eed` | PASÓ: sin conflictos en ninguno; «✓ merge semántico» en baseline (dos veces) e índice; índice regenerado sin cambios (448 specs) las dos veces |
| `git diff origin/main -- supabase/migrations-baseline.json` | PASÓ: 3 líneas; `cutoff 238`, `$doc` y 0415 iguales a `main`; sólo 0415 y 0414 como esperas |
| `git diff origin/main -- supabase/pending-migration-symbol-declarations.json` | PASÓ: vacío, byte a byte igual (md5 `d2ff7560…`) |
| `apply-registers-r4.mjs` (25 comprobaciones) | PASÓ: claves exactas, ledgers, md5, «quedaron APLICADAS», paso siguiente, un solo tenant, frase literal de la condición transaccional, párrafo literal de autorización, sin el orden obligatorio viejo |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: `0 ROJO · 0 AMARILLO declarado(s)` |
| `node scripts/build-docs-index.mjs --check` y `corepack pnpm sdd:check` | PASÓ: 448 specs sincronizadas; sin números repetidos |
| Frontmatter de las cinco specs | PASÓ: igual al del origen `refs/dtd/pr/21` |
| `git diff --check` | PASÓ, en cada commit y en `origin/main...HEAD` |
| Cobertura de allowlists contra `origin/main` | PASÓ, sobre `e9ed92ab` y de nuevo sobre `2c04e369`: 29 archivos, 0 sin cubrir |
| Gates tras el segundo merge (`2c04e369`) | PASÓ: `0 ROJO · 0 AMARILLO`; 448 specs sincronizadas; sin números repetidos; `git diff --check origin/main...HEAD` limpio |
| `invoice-read-boundary.test.mjs` focal tras el merge | PASÓ: 3/3; `main` no sumó llamadas directas a `invoices` desde `a3dbac04` (L10 toca `mail_logs`). Tardó 45 s con el verify ajeno corriendo, dentro de su tope propio |
| Chequeo previo al verify | PASÓ, con espera: un `node scripts/verify.mjs` ajeno (pid 43508, iniciado a las 18:56 −04:00; presumiblemente el del Worker de L14 que el Director anticipó, su worktree no se ve en las líneas de comando) siguió vivo durante toda la preparación de la ronda. Sondeos con `whose-verify.ps1` (`wait-foreign-verify.log`): vivo a las 23:13:21Z, 23:14:34Z, 23:16:20Z y 23:16:39Z; «sin verify.mjs vivo» a las 23:17:05Z y confirmado 20 s después. En ese momento (`precheck-verify-r4.log`): ningún proceso de verify, vitest, playwright, next ni rebuild; sin puertos 3100–3799 en escucha; 0 contenedores. Las dos entradas `bash.exe` del recibo son los shells del propio lanzador en segundo plano, cuya línea de comandos incluye el texto del script (la palabra `verify.mjs` va en un comentario), no un verify. El verify propio arrancó a las 23:17:29Z |
| **`corepack pnpm verify` sobre `2c04e369`** | **FALLÓ, exit 1, sólo por `e2e`**, entre las 23:17:28Z y las 23:42:25Z, con HEAD `2c04e369` y árbol limpio al inicio y al final (`verify-2c04e369.meta`). Corrieron 16 de 17 pasos: 15 PASÓ, `migrations-applied` NO DISPONIBLE y `e2e` FALLÓ por las 15 ambientales conocidas, en las dos pasadas, sin watchdog. Veredicto literal: `[FAIL] verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` Detalle por paso abajo. No se absuelve ni se presenta como verde |
| Procesos tras el verify | PASÓ: ninguno del árbol propio. Al terminar (23:42:25Z) no quedó ningún proceso de vitest, playwright, next ni chrome-headless-shell, ningún puerto 3100–3799 en escucha y 0 contenedores (`orphans-r4.log`). Sí apareció un `node scripts/verify.mjs` ajeno nuevo (pid 30368, iniciado a las 23:42:34Z, nueve segundos después del fin del mío y con otro árbol de procesos), que no se tocó. El árbol siguió limpio en `2c04e369` |
| Producción / Supabase | NO EJECUTADO por límite del encargo: la aplicación la hizo el Director; desde esta sesión no se abrió conexión, no se aplicó nada y no se leyeron filas |
| `/ui-check` | NO EJECUTADO por no aplicar: la ronda no toca UI |

Detalle por paso de `corepack pnpm verify` sobre `2c04e369` (`verify-2c04e369.log`; Node 24.20.0, pnpm 12.3.4, Docker 29.7.2; 23:17:28Z → 23:42:25Z; lanzado con `run_in_background` desde `wait-then-verify-r4.sh`, que esperó a que terminara el verify ajeno y volvió a comprobar antes de arrancar):

| Paso | Estado y evidencia |
|---|---|
| harness | PASÓ |
| lint | PASÓ, 0 errores y 8 advertencias en archivos que esta PR no toca; las mismas de las rondas anteriores |
| rsc-boundary | PASÓ |
| typecheck | PASÓ |
| edge-functions | PASÓ, 4 funciones compilan |
| test | PASÓ en el primer intento, sin reintento: 548 archivos y 6.842 pruebas (`main` sumó los tests de L10), incluida la del inventario con su tope propio |
| docs:check | PASÓ, 448 specs sincronizadas |
| numbering | PASÓ, 448 specs · 445 migraciones, sin números repetidos |
| feature-constants | PASÓ, 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ, 28 políticas aprobadas |
| migrations-applied | NO DISPONIBLE: `[SKIP] migrations-applied: sin NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY`. El ledger real no se midió en este árbol; la evidencia de que 0407 y 0411–0413 están aplicadas es la que entregó el Director, no una consulta hecha aquí. No autoriza copiar credenciales |
| pending-migration-symbols | PASÓ, `0 ROJO · 0 AMARILLO declarado(s)` |
| sql-tests | PASÓ, 188 contratos con rollback total, incluidos los cinco de L07 (0407, 0411, 0412, 0413 y 0414) y los de 0410, 0415, 0451 y 0452 que trae `main` |
| schema-rebuild | PASÓ: 427 migraciones desde cero y aislamiento multi-tenant en 219 tablas con 2 tenants |
| e2e | **FALLÓ**, en las dos pasadas, por las 15 ambientales conocidas; sin watchdog del verify. Detalle abajo |
| build | PASÓ: `[build] build de producción OK` |

Diagnóstico del e2e, leído del log sin volver a correrlo:
- **Las dos pasadas** dieron 15 fallidas, 1 flaky, 18 omitidas y 152 aprobadas: 186 pruebas con 8 workers, 11,1 min la primera y 4,6 min el reintento.
- **Las 15 fallidas son las mismas de las rondas 1 a 3 y de L10:** `auth.spec.ts:21`, `:91`, `:98` y `:105` y `global-search.spec.ts:22`, en chromium, mobile-chrome y mobile-safari. Fallan porque el worktree no tiene configuración de Supabase.
- **Flaky, ajenos a L07:** `attachments-gastos-pilot.spec.ts:20` en chromium en la primera pasada y `auth.spec.ts:74` en chromium en el reintento; los dos pasaron en su segundo intento interno de Playwright.
- **Por qué la primera pasada tardó 11,1 min:** Playwright registró `worker-46 process did not exit within 300000ms after stop, force-killed it`; lo cortó el propio Playwright a los 300 s, no el watchdog del verify, y la pasada llegó a su resumen. En el reintento no se repitió. Es el mismo síntoma que L10 registró en su ronda 2.
- **Relación con L07:** ningún spec de `e2e/` cubre Fidelización, Conversaciones ni Órdenes de venta, y la ronda no toca UI ni rutas del e2e.

Veredicto literal: `[FAIL] verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` No se absuelve ni se presenta como verde.
- `verify-2c04e369.meta`: inicio 23:17:28Z, fin 23:42:25Z, exit 1, HEAD `2c04e369` al inicio y al final, y 0 líneas de `git status --porcelain` al inicio y al final.
- Recibos: `verify-2c04e369.log`, `.meta`, `.exit`, `precheck-verify-r4.log`, `wait-foreign-verify.log` y `orphans-r4.log`.

### Secuencia de release, actualizada

1. **0452: hecho.** Aplicada el 2026-09-13 (ledger `20260913175856`), antes que 0407; registrada por la PR #109.
2. **0407 → 0411, 0412 y 0413: hecho.** Aplicadas el 2026-09-13 (ledgers `20260913224300`, `20260913224418`, `20260913224437` y `20260913224453`); esperas y declaraciones retiradas en esta rama.
3. **Fusionar (Director) y desplegar esta PR.** Smoke por roles con cuentas reales: Fidelización, CRM (Dirección) y Reportes → Comercial con commercial, support y accounting; panel de Conversaciones con commercial, operations, support y admin; drawer de Órdenes de venta con commercial, operations y accounting; lista y detalle de facturas del Portal con un cliente. Deben verse los datos de hoy con los cambios listados en la PR («Cambios de comportamiento visibles al desplegar»), sin errores de RPC.
4. **0414**, sólo después de ese smoke, con OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`, dentro de una transacción y en baja actividad (su `lock_timeout` de 5 s la corta y la revierte si hay contención; se reintenta). Verificar `invoices_accounting_select`, `invoices portal self read` con la expresión coherente y la ACL sin DELETE, y otra vez las pantallas por rol. Retirar su espera en una rama propia.

## ANÁLISIS 1 — MIGRATE-FIRST POR FACADE

> Ronda 4: este análisis ya no bloquea. Las tres RPC existen en producción desde el 2026-09-13, antes de fusionar el código que las consume (ver «RONDA 4»). La medición sigue valiendo como descripción de lo que pasaría sin ellas.

**Veredicto: las tres facades son MIGRATE-FIRST.** 0411 y 0413 fallan ruidosamente; 0412 degrada en silencio. 0407 es requisito de 0411: su preflight exige `invoices_team_select` (`0411:30-39`).

Método. Se usó postgrest-js 2.106.1, el cliente que usa supabase-js en la app, contra PostgREST v16.1 con `db-max-rows` 1.000. Debajo corría el esquema de `main` reconstruido en `postgres:17` (17.11) con 419 migraciones, sin las 18 sólo-ledger ni las cinco de L07. Cada rol entró con su propio JWT HS256 y datos sintéticos. Se ejecutaron lado a lado las funciones reales de esta rama y las de `main` (`bca98147`, copiadas fuera del repo con `git show`). La ronda 3 no cambia estos consumidores: #107 y #108 no tocan Fidelización, CRM, Reportes, Conversaciones ni Órdenes de venta.

| Facade | Sin la RPC, medido | Consumidores y efecto |
|---|---|---|
| 0411 `studio_client_annual_billing` | PGRST202 «Could not find the function public.studio_client_annual_billing(p_as_of) in the schema cache»; `clientAnnualBilling` lanza por `fetchAllPaged` (`lib/db/paginate.ts:131`) | `clientsWithTier` y `tierCounts` lanzan: Fidelización cae al error del segmento (`app/studio/(app)/fidelizacion/page.tsx:33-41`). `getKommoAnalytics` lanza (`lib/studio/kommo-analytics.ts:497`) y el CRM falla completo, porque su analítica corre en todas las pestañas (`app/studio/(app)/crm/page.tsx:82-87`). `commercialByClient` lanza (`lib/studio/reports/queries.ts:529`) y Reportes → Comercial falla (`app/studio/(app)/reportes/page.tsx:74-79`). `commercialByAgent` traga el error (`:619`) y dejaría ingresos por asesor en cero, pero comparte la carga con `commercialByClient` |
| 0412 `conversation_client_outstanding` | PGRST202; `getClientContext` devuelve null (`lib/studio/conversaciones/conversations-queries.ts:326`) | La API responde 200 con `context: null` (`app/api/studio/conversaciones/[id]/route.ts:57`). El panel muestra sólo el nombre del cliente, «Sin envíos en curso» (`app/studio/(app)/conversaciones/_components/ConversationThread.tsx:618`) y saldo «—» (`:653`) en todos los hilos, sin error |
| 0413 `sales_order_invoice_refs` | PGRST202 «Could not find the function public.sales_order_invoice_refs(p_sales_order_ids) in the schema cache»; `listInvoicesBySalesOrder` y `listInvoicesForSalesOrder` lanzan | La página de Órdenes de venta espera las referencias de cada orden en un `Promise.all` (`app/studio/(app)/ordenes-venta/page.tsx:49-57`) y cae al error del segmento en cuanto hay una orden |

Con las RPC aplicadas, cada rol autorizado recibe lo mismo que deja pasar el gate de su página. Los defaults son los de `lib/studio/rbac.ts:91`, `:96`, `:99` y `:104`, y los overrides vienen de `studio_role_module_overrides`, que la RPC lee igual que `getRoleModuleOverrides` (`lib/studio/role-module-overrides-queries.ts:28-35`). Medido:
- 0411: operations, warehouse, marketing y un accounting desactivado reciben 42501; sus páginas ya no los dejan entrar por defecto.
- 0413: support recibe 42501; el layout exige `sales-orders` (`app/studio/(app)/ordenes-venta/layout.tsx:12`).
- 0412: accounting recibe null; la ruta ya lo rechaza con 403 (`route.ts:36-37`).

Consecuencias:
- La primera línea de la PR dice «No fusionar antes de aplicar y verificar 0407, 0411, 0412 y 0413».
- Las tres declaraciones quedan AMARILLO en el gate de símbolos.
- Las esperas de 0411, 0412 y 0413 llevan el texto MIGRATE-FIRST.

Las tres son aditivas. Tras aplicarlas, el código de `main` devuelve lo mismo que antes: se midieron idénticas la facturación, el contexto y las referencias de `main` en las etapas «main» y «tras 0413». Aplicarlas antes de fusionar no cambia el comportamiento vigente.

## ANÁLISIS 2 — LECTORES Y ESCRITORES DE `invoices`

Medido en las rondas 1 y 2 sobre `main` `bca98147`. La ronda 3 lo revisó tras incorporar `a3dbac04`:
- el inventario sigue en 45 llamadas directas en 18 archivos con L07;
- SDD-0462 cambió cómo filtran las lecturas del Portal, no quién llega;
- 0452 sólo cambia la policy Portal.

Método:
- **Inventario AST propio.** Recorre con TypeScript cada `from("invoices")`, con su cadena de métodos y su receptor, en `app/`, `lib/`, `components/`, `scripts/` y `supabase/functions/`. En `bca98147` da 48 llamadas de producción en 21 archivos y ninguna `.delete()`. Con L07 quedan 45 en 18, antes y después del merge de la ronda 3, el mismo inventario que congela el test de la ronda 2.
- **Embeds.** Se buscaron `invoices(`, `invoices!` e `invoice_id(`: no hay ninguno.
- **SQL.** Las funciones que leen o escriben `invoices` se sacaron por `grep` sobre las migraciones, con su modo `SECURITY`.
- **Vistas y Realtime.** No hay vistas ni publicación Realtime sobre `invoices`. Los helpers de documentos y comentarios que la consultan son definer.
- **Matriz por rol.** La lectura (PostgREST, `count exact`) y la escritura (SQL como `authenticated`, con rollback) se midieron en tres etapas: en `main`, tras 0407 y tras 0414.

Hecho previo verificado en el catálogo: la policy efectiva `invoices by tenant` es `tenant_id = get_user_tenant_id()`, sin `deleted_at is null`. Ese filtro lo retiró `0230_fix_rls_soft_delete_blocked.sql:36`. Por eso los fixtures de 0407 y 0414 la reproducen fielmente, y ni 0407 ni 0414 cambian la visibilidad de las facturas borradas.

### Escritores

| Escritor | Cliente | Quién llega | Hoy | Tras 0407 | Tras 0414 |
|---|---|---|---|---|---|
| `createInvoice`, `updateInvoice`, `emitInvoice`, `softDeleteInvoice` y `duplicateInvoice` (`app/studio/(app)/facturacion/actions.ts:350`, `:434`, `:535`, `:722` y `:789`) | sesión | `moduleEditDenial("invoices")`: accounting y admin | escriben | igual (medido) | igual; el UPDATE necesita leer su WHERE y `accounting_select` lo permite (medido «actualiza 1») |
| `voidInvoice` → `void_invoice_with_audit_reason`, invoker (`facturacion/actions.ts:683`; `0294:143-170`) | sesión | invoices edit | anula | igual (medido) | igual (medido) |
| `registerPayment` (`facturacion/actions.ts:627`) y `registerCollection`, `identifyPayment` y `voidReceipt` (`app/studio/(app)/cobranzas/actions.ts:52-196`), vía `lib/studio/collections-actions.ts:178`, `:432` y `:537` | sesión | invoices edit o collections edit: accounting y admin | actualizan saldo y estado | igual | igual |
| `applyReferralCredit` (`app/studio/(app)/fidelizacion/actions.ts:507`, gate `:356`) | sesión | `moduleEditDenial("accounting")` | actualiza con `.select()` | igual | igual |
| `revertReferralCreditsForInvoice` (`lib/studio/accounting/referral-credit-posting.ts:360`) | service_role | proceso | escribe | igual | igual |
| `sales_order_claim_and_invoice` (`0128:134`, definer; EXECUTE sólo service_role; `lib/studio/sales-orders/actions.ts:553` con admin) | service_role | proceso | inserta | igual | igual |
| `confirm_payment_report` (`0359:44`), `rename_client_markbox` (`0371:110`), `rename_legacy_markboxes` y los triggers `audit_d2_invoices` e `invoices_accredit_referral` | definer | según su propio gate | escriben | igual | igual |
| Comandos de reportes de pago de la PR #104: `payment_private.run_report_command`, definer; sus envoltorios públicos son invoker y sólo lo llaman | definer | según su gate | escriben | igual | igual |
| commercial, operations, warehouse, support y marketing por PostgREST directo | sesión | — | **INSERT, UPDATE, soft-delete, anulación y DELETE** (medido) | INSERT 42501; UPDATE, soft-delete y anulación **0 filas sin error**; DELETE 42501 | igual que tras 0407 |

**Veredicto 0407: puede aplicarse antes del despliegue.** Ningún escritor legítimo pierde permisos. Todos los que escriben por sesión exigen un módulo de dinero, que es exactamente accounting y admin: los overrides no lo abren (`rbac.ts:161-190` y `:318-331`). Ningún código de producción borra facturas, así que revocar DELETE no rompe nada. La lectura por rol queda idéntica: 1.355 filas del tenant en `main` y tras 0407. La falla silenciosa de 0407 (UPDATE a 0 filas) sólo alcanza a quien escribe por PostgREST sin pasar por la app.

### Lectores

| Lector | Cliente | Quién llega | Hoy | Tras 0407 | Tras 0414 |
|---|---|---|---|---|---|
| Facturación: `listInvoices`, `getInvoiceByCode` e `invoiceKpis` (`lib/studio/invoice-queries.ts:72`, `:130` y `:166`). Estado de cuenta y su PDF (`app/studio/(app)/clientes/[markbox]/estado-de-cuenta/page.tsx:77-86`). Export comercial `tipo=facturas` (`app/api/studio/comercial/export/route.ts:89-100`) | sesión | módulo `invoices`: accounting y admin | tenant completo | igual | igual |
| Cobranzas: `receivablesQueue` (`lib/studio/payment-queries.ts:502`), que usan la página, los recordatorios y el export operativo con gate `collections` (`app/api/studio/operativo/export/route.ts:72-75`). También `logActivity` (`cobranzas/actions.ts:163`) y el recibo (`cobranzas/recibo/[code]/page.tsx:118`) | sesión | `collections`: accounting y admin | igual | igual | igual |
| Créditos de referidos: `applicableInvoicesForReferrer` (`lib/studio/fidelizacion/referral-credit-queries.ts:131`), por `listApplicableInvoices` y `applyReferralCredit` (`fidelizacion/actions.ts:297-302` y `:387`) | sesión | accounting edit | igual | igual | igual |
| Tablero: `financeInvoiceKpis` (`lib/studio/dashboard/dashboard-kpi-queries.ts:49`), sólo con KPI de módulo `invoices` (`app/studio/(app)/dashboard/page.tsx:124`; `dashboard-catalog.ts:60-68`) | sesión | accounting y admin | igual | igual | igual |
| Costeo (`lib/studio/costing/queries.ts:152` y `:509`), Fiscal (`lib/studio/fiscal/queries.ts:217`), Rendiciones (`lib/studio/renditions/queries.ts:120`, `:307` y `:478`) y Reportes contables (`lib/studio/reports/queries.ts:230`, `:786`, `:892` y `:1063`) | sesión | módulos de dinero o sólo admin | igual | igual | igual |
| Búsqueda global, faceta `invoices` bloqueada por la matriz (`lib/studio/global-search/search-action.ts:256-262`) | sesión | accounting y admin | igual | igual | igual |
| **Fidelización, CRM y Reportes → Comercial**: `clientAnnualBilling` de `main` (`lib/studio/fidelizacion/queries.ts:71`) | sesión | fidelizacion (commercial, support), kommo (commercial) y reports (accounting) | tenant completo | igual | **código de `main`: cero filas sin error y todos los clientes en Bronze** (medido); código L07: RPC definer, igual para los autorizados |
| **Conversaciones**: `getClientContext` de `main` (`conversations-queries.ts:348`) | sesión | conversaciones (commercial, operations, support) | lee | igual | **código de `main`: saldo 0 falso sin error** (medido; el principal dual ve 777 USD de otro tenant); código L07: RPC |
| **Órdenes de venta**: `listInvoicesForSalesOrder` de `main` (`sales-orders/queries.ts:226`) | sesión | sales-orders (commercial, operations, accounting) | lee | igual | **código de `main`: «Facturas · 0» sin error para commercial y operations** (medido); código L07: RPC |
| **Portal**: `listMyInvoices`, `getMyInvoice` y `getMyInvoiceForPrincipal` (`lib/portal/portal-queries.ts:242-253` y `:283-308`, tras SDD-0462) para lista, detalle y los dos PDF | sesión, policy Portal | cliente Portal con principal vivo y coherente | desde SDD-0462 filtran por tenant y Shipping Mark del principal; sin principal no consultan. La RLS de 0085 igual deja leer por PostgREST directo facturas de otro tenant con el mismo Shipping Mark y las de vínculos con cliente borrado o incoherente (medido) | igual | la app lee lo mismo (medido en los dos órdenes). **Frontera aceptada:** por PostgREST directo, un vínculo coherente ya no ve las de otro tenant y uno con cliente borrado o incoherente lee cero filas, sin error. Con 0452 aplicada antes, eso rige desde 0452 y 0414 no lo cambia |
| Portal con service_role: `lib/portal/portal-legal-queries.ts:116`, `:200` y `:261` y `app/portal/(app)/facturas/[code]/reportar/actions.ts:86`, tras resolver el principal por sesión | service_role | cliente Portal | igual | igual | igual |
| Procesos: cron `kommo-contact-status` (`lib/studio/kommo-contact-status.ts:214`) | service_role | cron | igual | igual | igual |
| Funciones SQL definer que leen `invoices`: `next_invoice_code`, `comment_entity_in_tenant`, `document_entity_in_tenant` (0215/0314), `payment_reports_validate_invoice`, `get_portal_referral_program` (0404), `sales_order_claim_and_invoice` y `confirm_payment_report` | definer | según su gate | igual | igual | igual |
| Roles no financieros por PostgREST directo | sesión | — | 1.355 filas, incluidas 2 borradas | igual | **0 filas sin error** |

Fallas silenciosas marcadas:
1. 0414 con el código de `main` todavía desplegado, o revirtiendo sólo la app después de 0414.
2. 0412 aplicada sin el despliegue es inocua, pero desplegar sin 0412 degrada el panel en silencio.
3. Portal por PostgREST directo tras 0414, o tras 0452: un vínculo con cliente borrado o incoherente lee cero filas. Es frontera aceptada por el Director. En la app no se nota, porque desde SDD-0462 esos principales no leen facturas.
4. 0407 para escrituras por PostgREST de roles no financieros, sin camino desde la app.

Con L07 desplegado, ningún lector ni escritor legítimo se rompe, así que no hizo falta ningún arreglo fuera del allowlist.

## ANÁLISIS 3 — PARIDAD DE CADA FACADE CON EL CONSUMIDOR DE `main`

Cifras medidas con el arnés de postgrest-js y datos sintéticos, en la etapa «tras 0413»: RPC aplicadas y RLS todavía de `main` + 0407. Los tenants T1 y T2 comparten Shipping Marks. En la ronda 2 el Director aceptó todas las divergencias; la PR las lista en lenguaje llano. #107 y #108 no tocan estos consumidores.

**0411 — facturación anual por Shipping Mark (USD, accounting de T1)**

| Caso sintético (disposición infeliz) | `main` | L07 | Resultado |
|---|---|---|---|
| L07-EDGE: `issued_at` exactamente hace un año (entra), un día antes (sale), fallback `created_at` 23:59:59 UTC del día previo (sale) y 00:00 UTC del día de inicio (entra) | 90 | 90 | igual |
| L07-BIG: 1.100 facturas, por encima del tope de 1.000 de PostgREST | 1.100 | 1.100 | igual (ambos paginan) |
| L07-ANUL: emitida 100 y anulada 1.000 | 100 | 100 | igual |
| L07-TIE: VES sin tasa 100 y USD 100 | 100 | 100 | igual |
| L07-OLD: cliente fusionado; facturas con el Shipping Mark viejo | 60 | 60 | igual: ninguno las suma al sobreviviente |
| DEAD: cliente borrado con facturas vivas | 80 | 80 | igual |
| DUP en T1 (2 × 10 más un borrador) y en T2; T2 ve DUP 906 y L07-A 777 | 20 | 20 | igual |
| **L07-A**: USD, USDT, VES con tasa 36,5, VES sin tasa, CNY, borrador, anulada, vieja, fallback, **una borrada de 800, una con `issued_at` futuro de 123,45 y una negativa de −50** | 3.623,45 | 2.650 | **diverge**: `main` suma la borrada y la futura e ignora la negativa |
| **L07-DEC**: 12 × 12.500,00 VES con tasa 3,0000 | 49.999,99999999999, **Bronze** | 50.000, **Silver** | **diverge**: suma flotante contra `numeric` en el umbral |
| **L07-SO**: incluye una borrada de 60 | 690 | 630 | **diverge**: borrada |
| **Principal dual**: commercial de T1 con vínculo Portal activo en T2 a L07-A | L07-A 4.400,45 | 2.650 | **diverge**: `main` suma la factura de T2 por la policy Portal histórica |
| operations, warehouse, marketing y accounting desactivado | datos (vacío el desactivado) | 42501 | sin efecto visible: sus páginas no los dejan entrar |

Borde bisiesto: `trailingStart` de `main` da 2027-03-01 para el 29/02/2028 (medido en Node), mientras la RPC resta `interval '1 year'` sobre `date`.
Medido en PostgreSQL 17.11 (`results/bisiesto.txt`): `(date '2028-02-29' - interval '1 year')::date` = 2027-02-28. Ese único día cada cuatro años la RPC cuenta las facturas del 2027-02-28 y `main` no; el resto del año las ventanas coinciden (medido en L07-EDGE). No se midió punta a punta porque la RPC sólo acepta `p_as_of` en hoy ± 1 día.

**0412 — saldo por hilo**

| Caso sintético | `main` | L07 | Resultado |
|---|---|---|---|
| L07-A: moneda dominante VES 37.600, con sobrepago USDT | 37.600 VES | 37.600 VES | igual |
| DUP en T1; DUP en T2 desde commercial de T2 | 20 USD; 906 USD | 20 USD; 906 USD | igual |
| Cliente borrado; hilo de otro tenant | null | null | igual |
| Hilo borrado | contexto (función aislada) | null | sin efecto: la ruta responde 404 antes (`route.ts:41-48`) |
| accounting sin Conversaciones | contexto | null (42501) | sin efecto: la ruta responde 403 antes |
| **L07-TIE**: VES 100 insertada primero; USD 100 con pagado 30 | VES 100 | USD 70 | **diverge**: el empate en `main` depende del orden de filas; la RPC ordena por código |
| **L07-ANUL**: emitida 100 y anulada 1.000 | 1.100 USD | 100 USD | **diverge**: `main` incluía anuladas; es la decisión 3 de SDD-0355 |
| **L07-BIG**: 1.100 facturas de 1 USD | 1.000 USD | 1.100 USD | **diverge**: `main` truncaba en 1.000 sin paginar |

**0413 — referencias por orden de venta**

| Caso sintético | `main` | L07 | Resultado |
|---|---|---|---|
| OV-L07-1: emitida, borrador, anulada, borrada y pagada, más una factura de T2 que apunta a esta OV | 4 | 4 | igual en códigos y estados; el empate de `created_at` sale por id |
| OV de T2 vista desde T1 | 0 | 0 | igual |
| **OV-L07-BIG**: 210 facturas | 200 | 210 | **diverge**: `main` truncaba en 200 |
| OV-L07-DEL: orden borrada con una factura | 1 | 0 | diverge sin efecto visible: la página lista órdenes vivas |
| commercial de T2 pidiendo la OV de T1 | 1 (S2-X de T2) | 0 | diverge sin camino desde la UI |
| support, sin Órdenes de venta | lista | 42501 | sin efecto: el layout ya lo bloquea |

Búsqueda activa de divergencias como la de L10:
- Estas RPC no normalizan texto. La igualdad por Shipping Mark es exacta en ambos lados: `.eq("client_markbox", …)` en `main` y `i.client_markbox = v_markbox` en la RPC.
- `client_markbox <> ''` equivale a `if (!r.client_markbox) continue`; moneda y estado son enums.
- Montos: `numeric(14,2)` y `numeric(14,4)`. La RPC divide y suma en `numeric` y PostgREST entrega un string que la app convierte con `Number`. `main` sumaba flotantes por factura: de ahí L07-DEC.
- Zona horaria: la RPC toma la fecha UTC de `created_at` y `p_as_of` es la fecha UTC del servidor web; `main` corta el ISO que PostgREST emite en la zona de la sesión. En la base efímera es UTC; en producción es NO VERIFICABLE sin `show timezone`.

## ANÁLISIS 4 — DATOS PERSONALES Y FINANCIEROS (`revisar-datos-ve`)

Resumen: 3 ENCONTRADO que L07 cierra al aplicarse, 1 ENCONTRADO preexistente que L07 no cambia, 5 CORRECTO y 4 NO VERIFICABLE.

Inventario de lo que cruza la frontera en este lote:

| Campo | Qué es | Finalidad | Quién lo ve |
|---|---|---|---|
| `studio_client_annual_billing.client_markbox` | Shipping Mark: identifica a una persona natural o empresa | nivel de fidelización y cruce del CRM | roles con Fidelización, CRM o Reportes efectivos |
| `studio_client_annual_billing.billed_usd` | dato económico agregado del cliente | nivel | ídem |
| `conversation_client_outstanding.client_id`, `balance` y `currency` | saldo por cobrar del cliente | panel del hilo | Conversaciones efectivo |
| `sales_order_invoice_refs`: `id`, `sales_order_id`, `invoice_code`, `total_amount`, `status` y `created_at` | referencia económica sin identidad del cliente | drawer de la OV; `created_at` sólo pagina | Órdenes de venta efectivo |
| Facturas leídas por el Portal (`getMyInvoiceForPrincipal`: `client_name`, `client_rif`, `client_doc_kind`, montos, líneas y notas; `lib/portal/portal-queries.ts:297-308`) | identidad fiscal y datos económicos | autoservicio del cliente | el principal Portal |

Hallazgos:
1. **ENCONTRADO, grave; en la app lo cerró `main`, en la base lo cierran 0452 o 0414.** Con la policy Portal histórica (`supabase/migrations/0085_portal_invoices_rls.sql:19-25`) y el mismo Shipping Mark en dos tenants, un cliente Portal lee facturas de otro tenant, con nombre, RIF, montos y líneas. Le corresponden la CRBV art. 28 (acceso a los datos propios) y el art. 60 (confidencialidad).
   - **Medido.** En la ronda 1, D2-01 desde un vínculo de T1. En la ronda 3, por PostgREST directo, D2-01, S2-01 y S2-X desde DUP T1.
   - **En la app.** Desde SDD-0462 (PR #107), `main` ya no lo expone.
   - **En la base.** La consulta directa a PostgREST con el JWT del propio usuario la cierra la primera de 0452 (SDD-0463) o 0414 (`0414:62-80`), que exigen vínculo, cliente y tenant coherentes. Medido en los dos órdenes; pendientes de aplicar.
   - **Vuelta atrás.** La de 0414 no la reabre (ronda 3).
2. **ENCONTRADO; lo cierran 0411–0413 con 0414.** Hoy commercial, operations, warehouse, support y marketing leen cada factura del tenant con moneda, tasa, estado, fechas, RIF, líneas y notas (policy `invoices by tenant` y `0230:36`), aunque sólo necesitan agregados. Es el punto 2 del checklist, minimización (SC 332/2001: finalidad). Tras 0414 leen 0 filas y reciben sólo las columnas de las RPC.
3. **ENCONTRADO; lo cierra 0407.** Esos cinco roles también pueden crear, modificar, anular y borrar facturas por PostgREST (medido).
4. **CORRECTO. Minimización de columnas:** 2 columnas en `0411:44-47`, 3 en `0412:20` y 6 en `0413:19-22`, sin cliente, líneas, tasa, notas ni datos fiscales. El helper de OV descarta `created_at` antes de la UI (`lib/studio/sales-orders/queries.ts:254-259`), y el test lo afirma.
5. **CORRECTO. EXECUTE:** `revoke all … from public, anon, authenticated` y `grant execute … to authenticated` (`0411:136-139`, `0412:93-96` y `0413:72-74`). Medido en el catálogo: anon sin EXECUTE; service_role con EXECUTE por el privilegio por defecto del esquema, sin consumidor en el repo.
6. **CORRECTO. Cruce de tenants:** ninguna RPC recibe el tenant. Lo derivan de `get_user_tenant_id()` (`0411:54`, `0412:27` y `0413:29`) y lo filtran en cada tabla (`0411:111`, `0412:56-61` y `:73`, `0413:62-67`). Medido con dos tenants y Shipping Marks repetidos.
7. **CORRECTO. Límites de volumen:** 0411 agrega por Shipping Mark y fija `p_as_of` en hoy ± 1 día (`0411:92-97`), sin enumerar historia. 0412 devuelve una fila. 0413 corta en 500 órdenes (`0413:55-57`) y el helper pagina por lotes.
8. **CORRECTO. Roles efectivos**, con overrides y membresía activa (`0411:58-88`, `0412:33-53` y `0413:33-50`). Medido: 42501 para roles sin acceso y para la membresía desactivada.
9. **ENCONTRADO, preexistente; L07 no lo cambia.** Desde 0230 el equipo lee facturas borradas y `accounting_select` de 0414 mantiene esa lectura para accounting y admin (`0414:52-57`). Varios lectores financieros no filtran `deleted_at` (sección FUERA DE ALCANCE). Es temporalidad (SC 332/2001).

NO VERIFICABLE:
- Zona horaria de la base de producción.
- ACL y policies reales de `invoices` en producción. La espera de 0407 trae la lectura de catálogo.
- Si hoy existe en producción el mismo Shipping Mark en dos tenants: el conteo agregado necesita autorización y no se leyó. El Director lo pide a Sam.
- Base de licitud, retención y avisos, que están fuera del repo.

Fuera de alcance legal: redacción de políticas, contratos con encargados y decisión sobre la base de licitud. Conviene pedir una segunda opinión de otro modelo sobre este análisis. Esto no es asesoría legal.

## ANÁLISIS 5 — ORDEN DE APLICACIÓN, LOCKS Y TIMEOUTS

Medición local y efímera, no de producción:
- **Contenedor y base.** `dtd_l07_pg` (`postgres:17`, 17.11), con los stubs de plataforma del repo y las 419 migraciones de `main` `bca98147`. La ronda 3 no cambia 0407 ni 0414, y la 0452 de `main` toca otra sentencia de la misma tabla.
- **Datos.** Sintéticos, 1.355 facturas en T1 y 5 en T2, insertados con `session_replication_role = replica`.
- **Aplicación.** Cada migración en su propia transacción, leyendo `pg_locks` del propio backend antes del COMMIT.
- **Limpieza.** Contenedores y red retirados antes de cada verify. El stack ajeno `dtd-pr28-auth-*` no se tocó.

| Paso | Migración | Qué hace | Requiere | Locks retenidos hasta COMMIT | Timeouts | Compatibilidad |
|---|---|---|---|---|---|---|
| 0 (recomendado, SDD-0463) | 0452 | policy Portal coherente por tenant | la de 0085 o la final | ACCESS EXCLUSIVE sobre `invoices` y ACCESS SHARE sobre `client_users` y `clients` (medido en SDD-0463) | dentro de su `do` | independiente de L07; converge en los dos órdenes |
| 1 | 0407 | policies separadas y ACL sin DELETE | `invoices`, helpers de 0200 y la policy histórica `invoices by tenant` con cmd ALL (preflight `0407:35-57`) | **ACCESS EXCLUSIVE sobre `invoices`**, más AccessShare y ShareUpdateExclusive; objeto `pg_policy` en AccessExclusive; 16 de catálogo; ~14 ms sin contención | **propios, en la transacción: 5 s y 60 s**; medidos en `5s` y `1min` con la sesión en `0` | compatible con `main`, con 0452 o sin ella: misma lectura y escritores legítimos intactos (medido) |
| 2 | 0411 | RPC de facturación anual | 0407 (`0411:30-39`), `studio_role_module_overrides` y helpers | ninguno sobre tablas de usuario; objeto de la función en ShareUpdateExclusive; ~10 ms | sin propios: no toma locks de tabla | aditiva |
| 3 | 0412 | RPC de saldo por hilo | conversations, clients, invoices, overrides y helpers | ídem; ~10 ms | sin propios | aditiva |
| 4 | 0413 | RPC de referencias por OV | sales_orders, invoices, overrides y helpers | ídem; ~8 ms | sin propios | aditiva |
| 5 | — | **despliegue de esta PR** y smoke por roles: Fidelización, CRM (Dirección) y Reportes → Comercial con commercial, support y accounting; panel de Conversaciones con commercial, operations, support y admin; drawer de OV con commercial, operations y accounting; lista y detalle de facturas del Portal | 0407 y 0411–0413 aplicadas y verificadas | — | — | antes de este paso el código nuevo no opera (MIGRATE-FIRST) |
| 6 | 0414 | lectura interna sólo accounting y admin; policy Portal coherente por tenant (idéntica si 0452 ya está) | las tres RPC como definer y exactamente las dos policies de lectura previas (`0414:15-48`) | **ACCESS EXCLUSIVE sobre `invoices`**, más AccessShare y ShareUpdateExclusive; **ACCESS SHARE sobre `clients` y `client_users`**; dos objetos `pg_policy` en AccessExclusive; 19 de catálogo; ~14 ms | **propios: 5 s y 60 s**; medidos en `5s` y `1min` | rompe **en silencio** el código anterior (análisis 2) |

**Contención**, con otra sesión que retenía ACCESS SHARE sobre `invoices` durante 15 s. En los cuatro casos la migración se aplicó dentro de una transacción, desde una sesión **sin** `lock_timeout` propio. Un lector nuevo, también sin `lock_timeout`, llegó 2 s después de empezar la migración:

| Archivo | Resultado de la migración | Espera del lector nuevo |
|---|---|---|
| 0407 de origen | la primera `DROP POLICY` esperó 13,99 s, hasta que terminó el retenedor | 11,99 s en cola |
| 0407 actual | cortó en `DROP POLICY` (`0407:59`) a los 5,001 s con `canceling statement due to lock timeout`; la transacción se revirtió entera | 2,985 s, terminó normal |
| 0414 de origen | esperó 13,99 s | 11,99 s en cola |
| 0414 actual | cortó en `DROP POLICY` (`0414:51`) a los 5,001 s con el mismo error; se revirtió entera | 2,997 s |

Desviación pre-autorizada y su condición:
- **Qué cambia.** 0407 y 0414 fijan `set local lock_timeout = '5s'` y `set local statement_timeout = '60s'` al nivel superior del archivo, antes del primer lock, como L10 y a diferencia de 0450, 0451 y 0452, que lo fijan dentro de su `do`.
- **Autorización cumplida.** Ningún preflight, postflight ni contrato depende de la identidad o posición del archivo: sólo hay `\ir` en los contratos y el texto de un mensaje en `0411:38`.
- **Contratos.** Agregan la aserción estática: los timeouts van antes de la primera sentencia `do|create|alter|drop|grant|revoke|comment|lock|select|insert|update|delete|truncate`, leída sin comentarios. También comprueban en la transacción `pg_settings` 5000 y 60000.
- **Autocommit.** El tope de lock_timeout/statement_timeout rige solo si se aplica dentro de una transacción, como hace apply_migration; si se aplicara en autocommit, no tiene efecto: usar entonces una sesión con `set lock_timeout`. Medido: `SET LOCAL` fuera de transacción emite `WARNING: SET LOCAL can only be used in transaction blocks` y `lock_timeout` sigue en `0`.

Riesgos operativos:
- Mientras 0407 o 0414 esperan, hasta 5 s, queda en cola toda lectura de facturas: Facturación, Cobranzas, Portal, tablero y reportes. Conviene aplicarlas en baja actividad; si cortan, se reintentan.
- La vuelta atrás de 0407 y 0414 está escrita y probada en local (sección siguiente). Ninguna pierde datos:
  - revertir 0414 reabre la lectura cruda del equipo, pero **no** la del Portal;
  - revertir 0407 reabre la escritura y el DELETE de los roles no financieros.

  Primero 0414, después 0407.

## VUELTA ATRÁS DE 0407 Y 0414 (PROBADA)

La ronda 3 la rehízo por decisión del Director: **la vuelta atrás de 0414 nunca restaura la policy Portal vulnerable de 0085.** La versión de la ronda 2 la recreaba y su postflight la exigía. Con 0452 aplicada eso reabría la lectura del Portal entre tenants, y sin 0452 la reintroducía.
- **Qué son.** Ninguno de estos dos bloques SQL es una migración: no se guardan en `supabase/migrations` ni se registran en el ledger.
- **Cómo se aplican.** Sólo con OK nominal de Sam, siguiendo `docs/runbooks/aplicar-migraciones-prod.md` y dentro de una transacción.
- **Locks y timeouts.** Los dos fijan `lock_timeout` 5 s y `statement_timeout` 60 s, como las migraciones, y toman el mismo ACCESS EXCLUSIVE sobre `invoices`.
- **Controles.** El preflight comprueba que la tabla está exactamente como la deja su migración, con la lista exacta de policies (nombre:comando). El postflight comprueba que quedó como se espera.
- **Normalización.** Las expresiones Portal se comparan como en 0452: `pg_get_expr` con `search_path` vacío y sin espacios, restaurando el `search_path` al terminar.

Qué hace cada una:
- **Vuelta atrás de 0414:**
  - borra `invoices_accounting_select`, recrea `invoices_team_select` como la dejó 0407 y restaura el comentario de 0407;
  - **no toca `invoices portal self read`**. El preflight exige que esté con la expresión coherente por tenant, que es la que deja 0414 en cualquier escenario. El postflight exige esa misma expresión exacta y que ninguna policy de `invoices` use `get_portal_client_markbox()`.
  - **No restaura la policy vulnerable, a propósito.**
- **Vuelta atrás de 0407:**
  - borra sus tres policies, recrea `invoices by tenant` con su expresión de `main`, devuelve DELETE a `authenticated` y restaura el comentario de `main`;
  - **no toca `invoices portal self read`**. Acepta la de 0085 o la coherente, guarda su forma en `l07.forma_portal_antes` y el postflight comprueba que no cambió.

Orden y alcance:
- **Sólo 0407 aplicada:** se revierte 0407.
- **0414 aplicada:** primero se revierte 0414. Revertir 0407 con 0414 aplicada aborta en su preflight con «revertir 0414 primero» y no deja nada a medias (medido).
- **Volver la app a `main` con 0414 aplicada** rompe en silencio Fidelización, CRM, Reportes, Conversaciones y Órdenes de venta (análisis 2). Antes de volver la app, se revierte 0414.
- **Las tres RPC de 0411–0413 quedan.** No son parte de esta vuelta atrás; retirarlas con la app de L07 desplegada rompe esas pantallas (MIGRATE-FIRST).
- **Estado final sin 0452.** Tras las dos vueltas atrás, `invoices` queda como `main` más 0452: la policy Portal coherente por tenant (medido). Aplicar 0452 después no cambia nada: su preflight reconoce la forma final.
- **Producción.**
  - Antes de aplicar 0407 conviene guardar la lectura de catálogo de su espera: esta vuelta atrás devuelve el estado anterior a 0407 y debe coincidir con lo capturado.
  - En producción `authenticated` puede tener además REFERENCES, TRIGGER o MAINTAIN, que la base local no tiene. La vuelta atrás sólo toca DELETE, que es lo que 0407 quita, y GRANT y REVOKE editan la misma entrada del ACL, así que el resto queda igual (en local, `relacl` idéntico).

### SQL de la vuelta atrás de 0414

```sql
-- VUELTA ATRÁS DE 0414 · L07 / SDD-0357 (ronda 3). NO es una migración: no se
-- guarda en supabase/migrations ni se registra en el ledger. Aplicar sólo con OK
-- nominal de Sam, siguiendo docs/runbooks/aplicar-migraciones-prod.md y dentro
-- de una transacción. No toca filas, la ACL ni las tres RPC de 0411–0413.
--
-- Revierte sólo lo interno de 0414: borra invoices_accounting_select, recrea
-- invoices_team_select como la dejó 0407 y restaura el comentario de 0407.
--
-- A PROPÓSITO, NO RESTAURA LA POLICY PORTAL VULNERABLE, EN NINGÚN ESCENARIO.
-- "invoices portal self read" queda con la expresión coherente por tenant que
-- dejan 0452 y 0414: vínculo activo, cliente vivo, tenant coincidente en
-- vínculo, cliente y factura, y Shipping Mark. La de 0085 compara sólo el
-- Shipping Mark: recrearla reabriría, con 0452 aplicada, o reintroduciría, sin
-- 0452, la lectura del Portal entre tenants con Shipping Mark repetido. El
-- preflight y el postflight exigen esa expresión exacta, normalizada como en
-- 0452 (pg_get_expr con search_path vacío y sin espacios).
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  c_forma_coherente constant text :=
    '((deleted_atISNULL)AND(status<>''borrador''::public.invoice_status)AND(client_markboxISNOTNULL)'
    || 'AND(EXISTS(SELECT1FROM(public.client_userscuJOINpublic.clientscON'
    || '(((c.id=cu.client_id)AND(c.tenant_id=cu.tenant_id)AND(c.deleted_atISNULL))))'
    || 'WHERE((cu.auth_user_id=(SELECTauth.uid()ASuid))AND(cu.status=''active''::text)'
    || 'AND(cu.tenant_id=invoices.tenant_id)AND(c.markbox=invoices.client_markbox)))))';
  v_search_path text := pg_catalog.current_setting('search_path');
  v_policies text;
  v_forma text;
begin
  perform pg_catalog.set_config('search_path', '', true);

  select pg_catalog.string_agg(p.polname::text || ':' || p.polcmd::text, ', ' order by p.polname::text collate "C")
    into v_policies
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass;

  if v_policies is distinct from
     'invoices portal self read:r, invoices_accounting_insert:a, invoices_accounting_select:r, invoices_accounting_update:w' then
    raise exception 'vuelta atrás de 0414: invoices no tiene las policies que deja 0414 (policies: %)', v_policies;
  end if;

  select pg_catalog.regexp_replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '\s', '', 'g')
    into v_forma
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and p.polname = 'invoices portal self read'
     and p.polcmd = 'r'
     and p.polpermissive
     and p.polroles = array[pg_catalog.to_regrole('authenticated')::pg_catalog.oid]
     and p.polwithcheck is null;

  if v_forma is distinct from c_forma_coherente then
    raise exception 'vuelta atrás de 0414: la policy "invoices portal self read" no tiene la expresión coherente por tenant de 0452/0414; revisar antes de seguir';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception 'vuelta atrás de 0414: authenticated tiene DELETE; la ACL no es la de 0407';
  end if;

  perform pg_catalog.set_config('search_path', v_search_path, true);
end;
$preflight$;

drop policy invoices_accounting_select on public.invoices;
create policy invoices_team_select
  on public.invoices for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );

comment on table public.invoices is
  'SDD-0021/0350: facturas operativas y financieras. SELECT interno permanece tenant-wide por compatibilidad con consumidores agregados; INSERT/UPDATE requieren accounting o admin en RLS (0407). authenticated no tiene DELETE físico: borradores usan soft-delete y hechos emitidos se anulan. service_role queda reservado a jobs/RPCs controladas.';

do $postflight$
declare
  c_forma_coherente constant text :=
    '((deleted_atISNULL)AND(status<>''borrador''::public.invoice_status)AND(client_markboxISNOTNULL)'
    || 'AND(EXISTS(SELECT1FROM(public.client_userscuJOINpublic.clientscON'
    || '(((c.id=cu.client_id)AND(c.tenant_id=cu.tenant_id)AND(c.deleted_atISNULL))))'
    || 'WHERE((cu.auth_user_id=(SELECTauth.uid()ASuid))AND(cu.status=''active''::text)'
    || 'AND(cu.tenant_id=invoices.tenant_id)AND(c.markbox=invoices.client_markbox)))))';
  v_search_path text := pg_catalog.current_setting('search_path');
  v_policies text;
  v_forma text;
  v_con_helper bigint;
begin
  perform pg_catalog.set_config('search_path', '', true);

  select pg_catalog.string_agg(p.polname::text || ':' || p.polcmd::text, ', ' order by p.polname::text collate "C")
    into v_policies
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass;

  select pg_catalog.regexp_replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '\s', '', 'g')
    into v_forma
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and p.polname = 'invoices portal self read'
     and p.polcmd = 'r'
     and p.polpermissive
     and p.polroles = array[pg_catalog.to_regrole('authenticated')::pg_catalog.oid]
     and p.polwithcheck is null;

  select count(*)
    into v_con_helper
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and (coalesce(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '') like '%get_portal_client_markbox%'
          or coalesce(pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid), '') like '%get_portal_client_markbox%');

  if v_policies is distinct from
       'invoices portal self read:r, invoices_accounting_insert:a, invoices_accounting_update:w, invoices_team_select:r'
     or v_forma is distinct from c_forma_coherente
     or v_con_helper <> 0
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'INSERT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'UPDATE')
     or pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception 'vuelta atrás de 0414: estado final inválido (policies: %; policy Portal coherente: %; policies con get_portal_client_markbox: %)',
      v_policies, v_forma is not distinct from c_forma_coherente, v_con_helper;
  end if;

  perform pg_catalog.set_config('search_path', v_search_path, true);
end;
$postflight$;
```

### SQL de la vuelta atrás de 0407

```sql
-- VUELTA ATRÁS DE 0407 · L07 / SDD-0350 (ronda 3). NO es una migración: no se
-- guarda en supabase/migrations ni se registra en el ledger. Aplicar sólo con OK
-- nominal de Sam, siguiendo docs/runbooks/aplicar-migraciones-prod.md, dentro de
-- una transacción y, si 0414 estaba aplicada, después de revertir 0414. No toca
-- filas.
--
-- Borra las tres policies de 0407, recrea "invoices by tenant" con su expresión
-- de main, devuelve DELETE a authenticated y restaura el comentario de main.
-- NO toca "invoices portal self read": la deja exactamente como la encuentra,
-- sea la de 0085 (0407 sin 0414 ni 0452) o la coherente por tenant de 0452/0414,
-- y el postflight comprueba que no cambió.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  c_forma_0085 constant text :=
    '((deleted_atISNULL)AND(status<>''borrador''::public.invoice_status)AND(client_markboxISNOTNULL)'
    || 'AND(client_markbox=public.get_portal_client_markbox()))';
  c_forma_coherente constant text :=
    '((deleted_atISNULL)AND(status<>''borrador''::public.invoice_status)AND(client_markboxISNOTNULL)'
    || 'AND(EXISTS(SELECT1FROM(public.client_userscuJOINpublic.clientscON'
    || '(((c.id=cu.client_id)AND(c.tenant_id=cu.tenant_id)AND(c.deleted_atISNULL))))'
    || 'WHERE((cu.auth_user_id=(SELECTauth.uid()ASuid))AND(cu.status=''active''::text)'
    || 'AND(cu.tenant_id=invoices.tenant_id)AND(c.markbox=invoices.client_markbox)))))';
  v_search_path text := pg_catalog.current_setting('search_path');
  v_policies text;
  v_forma text;
begin
  perform pg_catalog.set_config('search_path', '', true);

  select pg_catalog.string_agg(p.polname::text || ':' || p.polcmd::text, ', ' order by p.polname::text collate "C")
    into v_policies
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass;

  if v_policies like '%invoices_accounting_select%' then
    raise exception 'vuelta atrás de 0407: 0414 sigue aplicada; revertir 0414 primero (policies: %)', v_policies;
  end if;

  if v_policies is distinct from
     'invoices portal self read:r, invoices_accounting_insert:a, invoices_accounting_update:w, invoices_team_select:r' then
    raise exception 'vuelta atrás de 0407: invoices no tiene las policies que deja 0407 (policies: %)', v_policies;
  end if;

  select pg_catalog.regexp_replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '\s', '', 'g')
    into v_forma
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and p.polname = 'invoices portal self read'
     and p.polcmd = 'r'
     and p.polpermissive
     and p.polroles = array[pg_catalog.to_regrole('authenticated')::pg_catalog.oid]
     and p.polwithcheck is null;

  if v_forma is null or (v_forma <> c_forma_0085 and v_forma <> c_forma_coherente) then
    raise exception 'vuelta atrás de 0407: la policy "invoices portal self read" no es la de 0085 ni la coherente por tenant; revisar antes de seguir';
  end if;

  if pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception 'vuelta atrás de 0407: authenticated ya tiene DELETE; comparar con la ACL capturada antes de 0407';
  end if;

  -- La policy Portal no se toca: se guarda su forma para comprobarlo al final.
  perform pg_catalog.set_config('l07.forma_portal_antes', v_forma, true);
  perform pg_catalog.set_config('search_path', v_search_path, true);
end;
$preflight$;

drop policy invoices_team_select on public.invoices;
drop policy invoices_accounting_insert on public.invoices;
drop policy invoices_accounting_update on public.invoices;

create policy "invoices by tenant"
  on public.invoices for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

grant delete on public.invoices to authenticated;

comment on table public.invoices is
  'SDD-0021: facturas operativas. State machine borrador → emitida → parcial/pagada · vencida (visual) · anulada. paid_amount es acumulador (el ledger de pagos es Cobranzas, Bloque 2). Soft delete via deleted_at. RLS por tenant_id.';

do $postflight$
declare
  v_search_path text := pg_catalog.current_setting('search_path');
  v_policies text;
  v_forma text;
begin
  perform pg_catalog.set_config('search_path', '', true);

  select pg_catalog.string_agg(p.polname::text || ':' || p.polcmd::text, ', ' order by p.polname::text collate "C")
    into v_policies
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass;

  select pg_catalog.regexp_replace(pg_catalog.pg_get_expr(p.polqual, p.polrelid), '\s', '', 'g')
    into v_forma
    from pg_catalog.pg_policy as p
   where p.polrelid = 'public.invoices'::pg_catalog.regclass
     and p.polname = 'invoices portal self read'
     and p.polcmd = 'r'
     and p.polpermissive
     and p.polroles = array[pg_catalog.to_regrole('authenticated')::pg_catalog.oid]
     and p.polwithcheck is null;

  if v_policies is distinct from 'invoices by tenant:*, invoices portal self read:r'
     or v_forma is distinct from pg_catalog.current_setting('l07.forma_portal_antes', true)
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'INSERT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'UPDATE')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception 'vuelta atrás de 0407: estado final inválido (policies: %; policy Portal intacta: %)',
      v_policies, v_forma is not distinct from pg_catalog.current_setting('l07.forma_portal_antes', true);
  end if;

  perform pg_catalog.set_config('search_path', v_search_path, true);
end;
$postflight$;
```

### Prueba

Local y efímera, nunca producción:
- **Base.** `postgres:17` (17.11) con las migraciones de `main` `a3dbac04`, sin las 18 sólo-ledger, sin L07 y sin 0452, más la siembra sintética de la ronda 1. Cada escenario corre en su propia base, copiada de esa.
- **Foto de catálogo de la ronda 3.** Es determinística, sin OID, con `search_path` vacío y un registro por línea. Incluye:
  - todas las policies de `invoices`, con nombre, permissive, roles, comando, `qual` y `with_check` normalizados, y su comentario;
  - la forma de la policy Portal (`coherente-por-tenant`, `0085-solo-shipping-mark` u otra);
  - `relacl` y los flags de RLS, más el ACL por columna;
  - el comentario de la tabla;
  - los privilegios efectivos de anon, authenticated y service_role en los ocho verbos;
  - `proacl`, `prosecdef` y `proconfig` de los helpers y de las tres RPC.
- **Comportamiento.** Además de la foto, la matriz de lectura de 16 identidades y la matriz de escritura de 10 identidades y 5 operaciones.
- **Escenario (i): `main` con 0452 aplicada, más L07.**
  1. 0452.
  2. 0407 y su vuelta atrás, más 0407 otra vez en transacción revertida.
  3. 0407 a 0413.
  4. 0414.
  5. Vuelta atrás de 0407 fuera de orden, revertida.
  6. Vuelta atrás de 0414.
  7. 0414 otra vez en transacción revertida.
  8. Cadena 0414 → vuelta atrás de 0414 → vuelta atrás de 0407.
- **Escenario (ii): `main` sin 0452, más L07.**
  1. 0407 a 0413.
  2. 0414.
  3. Vuelta atrás de 0414.
  4. 0414 otra vez en transacción revertida.
  5. Cadena 0414 → vuelta atrás de 0414 → vuelta atrás de 0407.
  6. 0452 al final, en transacción revertida.
- **Complemento.**
  - La vuelta atrás de 0407 sola sobre `main` sin 0452, con la policy de 0085.
  - La foto tras 0414 comparada entre los dos escenarios.
- **Primera corrida de la ronda 3** (`results/rollback-r3-corrida1/`). Todas sus comprobaciones de catálogo, matrices y cadenas dieron OK. Marcó FALLA sólo la comparación de la lectura directa por PostgREST, por un error de mi expectativa: incluía al comercial dual, que además es del equipo, y cuya lectura directa sigue la policy de equipo (1.000 filas de T1 antes de 0414 y tras revertirla) y no la del Portal. Se corrigió la expectativa para comparar sólo las cinco identidades Portal puras, se sumó un control explícito del dual y se repitió todo desde una base nueva. Los recibos de abajo son de esa segunda corrida.

### Recibos

`results/rollback-r3/recibo.txt` (indentado cuatro espacios dentro del bloque):

```
    # Ronda 3 · vuelta atrás de 0414 y 0407 en dos escenarios · 2026-09-13T15:54:09.849Z
    PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
    base: main a3dbac04 sin L07 ni 0452 (sin las 18 sólo-ledger) + siembra sintética; cada escenario en su propia base copiada

    ## Escenario (i) · main con 0452 aplicada + L07
    OK    · 0452 aplica sobre main y reemplaza la policy de 0085 (NOTICE «reemplazada»)
    OK    · 0452 sólo cambia la policy Portal (2 líneas sólo antes y 2 sólo después, todas de la policy Portal; forma coherente-por-tenant)
    OK    · 0407 aplica encima de main + 0452
    OK    · vuelta atrás de 0407 aplica con la policy Portal de 0452
    OK    · catálogo tras 0407 → vuelta atrás idéntico a main + 0452 (md5 4b36e49903b18fd1eeacf1cf5350f214 = 4b36e49903b18fd1eeacf1cf5350f214; 15 líneas)
    OK    · matrices de lectura y escritura idénticas a main + 0452 tras revertir 0407
    OK    · 0407 vuelve a pasar su preflight sobre ese estado (transacción revertida)
    OK    · 0407, 0411, 0412 y 0413 aplican (commit)
    OK    · 0414 aplica con 0452 ya aplicada (su preflight pasa)
    OK    · 0414 no cambia la policy Portal cuando 0452 está aplicada (3 líneas sólo antes y 3 sólo después, ninguna de la policy Portal)
    OK    · control: revertir 0407 con 0414 aplicada aborta en su preflight
    OK    · ese intento no deja nada a medias
    OK    · vuelta atrás de 0414 aplica (commit)
    OK    · (i) catálogo tras revertir 0414 idéntico al estado posterior a 0452 y previo a 0414 (md5 431f3a4285e63a8618e5ad35f5622e2e = 431f3a4285e63a8618e5ad35f5622e2e; 22 líneas; forma Portal coherente-por-tenant)
    OK    · (i) matrices de lectura y escritura idénticas a las de antes de 0414
    OK    · (i) 0414 se puede volver a aplicar: su preflight pasa (transacción revertida)
    OK    · (i) tras esa prueba el catálogo sigue idéntico al de antes de 0414
    OK    · (i) cadena 0414 → vuelta atrás de 0414 → vuelta atrás de 0407 aplica (tres commits)
    OK    · (i) tras la cadena, invoices y helpers idénticos a main + 0452 (md5 4b36e49903b18fd1eeacf1cf5350f214 = 4b36e49903b18fd1eeacf1cf5350f214; 15 líneas; quedan las tres RPC)
    OK    · (i) matrices idénticas a main + 0452 tras la cadena

    ## Escenario (ii) · main sin 0452 + L07
    OK    · main sin 0452 tiene la policy Portal de 0085 (forma 0085-solo-shipping-mark)
    OK    · 0407, 0411, 0412 y 0413 aplican (commit)
    OK    · 0414 aplica sin 0452
    OK    · 0414 deja la policy Portal coherente por tenant (forma coherente-por-tenant)
    OK    · vuelta atrás de 0414 aplica (commit)
    OK    · (ii) policies de equipo y contabilidad, ACL, comentario y helpers vuelven al estado previo a 0414; sólo difiere la policy Portal, que queda coherente por tenant y no vuelve a la de 0085 (2 líneas sólo antes y 2 sólo después)
    OK    · (ii) sin las líneas de la policy Portal, catálogo idéntico al previo a 0414 (md5 f077a4c5b7737a65f3595305bd443d1b = f077a4c5b7737a65f3595305bd443d1b; 19 líneas)
    OK    · (ii) matriz de escritura idéntica a la de antes de 0414
    OK    · (ii) matriz de lectura: el equipo lee igual que antes de 0414; sólo cambian identidades Portal (4: portal DUP T1: 5 | 0 | 3 → 2 | 0 | 0 ; portal DUP T2: 5 | 0 | 3 → 3 | 0 | 3 ; portal cliente borrado: 1 | 0 | 0 → 0 | 0 | 0 ; portal incoherente: 5 | 0 | 3 → 0 | 0 | 0)
    OK    · (ii) 0414 se puede volver a aplicar: su preflight pasa (transacción revertida)
    OK    · (ii) cadena 0414 → vuelta atrás de 0414 → vuelta atrás de 0407 aplica (tres commits)
    OK    · (ii) tras la cadena, todo idéntico a main salvo la policy Portal, que queda coherente por tenant (md5 sin Portal 1c446612844bda6f29f9592ea33d238b = 1c446612844bda6f29f9592ea33d238b)
    OK    · (ii) el estado final de la cadena coincide con main + 0452 del escenario (i) (md5 4b36e49903b18fd1eeacf1cf5350f214 = 4b36e49903b18fd1eeacf1cf5350f214)
    OK    · (ii) tras la cadena, escritura idéntica a main y lectura idéntica a main + 0452
    OK    · (ii) 0452 aplicada después sigue pasando: «ya tenía la forma final; sin cambios» (transacción revertida)
    OK    · app del Portal (listMyInvoices y getMyInvoice, código de main tras SDD-0462): mismas facturas con 0085, con 0452, con 0414 y tras revertir 0414
    OK    · lectura directa por PostgREST de las 5 identidades Portal puras: con 0085 difiere; con 0452 (antes de 0414), tras 0414 y tras revertir 0414 es la misma
    OK    · control del comercial dual (equipo + Portal): lee T1 por la policy de equipo antes de 0414 y tras revertirla, y sólo su factura Portal A2-01@T2 tras 0414
```

`results/rollback-r3/recibo-complemento.txt`:

```
    # Ronda 3 · complemento · 2026-09-13T15:54:30.640Z
    PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
    OK    · main sin 0452 conserva la policy Portal de 0085
    OK    · 0407 aplica sobre main sin 0452
    OK    · vuelta atrás de 0407 (ronda 3) aplica con la policy Portal de 0085 y la deja intacta
    OK    · catálogo tras 0407 → vuelta atrás idéntico a main sin 0452 (md5 37386ed4d1021b86710b9af9256649e5 = 37386ed4d1021b86710b9af9256649e5; 15 líneas)
    OK    · matrices de lectura y escritura idénticas a main sin 0452 tras revertir 0407
    OK    · 0407 vuelve a pasar su preflight sobre ese estado (transacción revertida)
    OK    · la foto tras 0414 es idéntica con 0452 previa y sin ella (md5 8fad4fbd84318c8ac7dab3763b24d2eb = 8fad4fbd84318c8ac7dab3763b24d2eb; 22 líneas)
    md5 de las líneas de policies tras 0414: (i) 41eb5bc28ebfb8290f964ebb5e843021 · (ii) 41eb5bc28ebfb8290f964ebb5e843021
```

Escenario (i): qué cambia 0414 con 0452 aplicada, sin ninguna línea de la policy Portal (`results/rollback-r3/i-06-diff-before-vs-0414.txt`). La vuelta atrás lo devuelve exacto:

```
SOLO ANTES
comment|SDD-0021/0350: facturas operativas y financieras. SELECT interno permanece tenant-wide por compatibilidad con consumidores agregados; INSERT/UPDATE requieren accounting o admin en RLS (0407). authenticated no tiene DELETE físico: borradores usan soft-delete y hechos emitidos se anulan. service_role queda reservado a jobs/RPCs controladas.
policy-comment|invoices_team_select|-
policy|invoices_team_select|PERMISSIVE|authenticated|r|(tenant_id = ( SELECT public.get_user_tenant_id() AS get_user_tenant_id))|-

SOLO DESPUES
comment|SDD-0021/0350/0357: lectura y escritura internas requieren accounting/admin activos del tenant. Portal sólo lee sus facturas no borrador/vivas mediante vínculo activo, cliente vivo y tenant coincidente. Módulos no financieros usan RPCs minimizadas 0411–0413. authenticated no tiene DELETE físico; service_role se reserva a procesos controlados.
policy-comment|invoices_accounting_select|-
policy|invoices_accounting_select|PERMISSIVE|authenticated|r|((tenant_id = ( SELECT public.get_user_tenant_id() AS get_user_tenant_id)) AND (( SELECT public.current_studio_role() AS current_studio_role) = ANY (ARRAY['accounting'::text, 'admin'::text])))|-
```

Escenario (ii): qué queda distinto del estado previo a 0414 después de revertir 0414. Es sólo la policy Portal, que queda coherente por tenant en lugar de la de 0085 (`results/rollback-r3/ii-03-diff-before-vs-revert-0414.txt`):

```
SOLO ANTES
policy|invoices portal self read|PERMISSIVE|authenticated|r|((deleted_at IS NULL) AND (status <> 'borrador'::public.invoice_status) AND (client_markbox IS NOT NULL) AND (client_markbox = public.get_portal_client_markbox()))|-
portal-forma|0085-solo-shipping-mark

SOLO DESPUES
policy|invoices portal self read|PERMISSIVE|authenticated|r|((deleted_at IS NULL) AND (status <> 'borrador'::public.invoice_status) AND (client_markbox IS NOT NULL) AND (EXISTS ( SELECT 1 FROM (public.client_users cu JOIN public.clients c ON (((c.id = cu.client_id) AND (c.tenant_id = cu.tenant_id) AND (c.deleted_at IS NULL)))) WHERE ((cu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (cu.status = 'active'::text) AND (cu.tenant_id = invoices.tenant_id) AND (c.markbox = invoices.client_markbox)))))|-
portal-forma|coherente-por-tenant
```

### Qué no vuelve igual

- **Policy Portal.** A propósito, nunca vuelve a la de 0085:
  - con 0452 aplicada, no hay diferencia, porque 0452 ya la dejó coherente;
  - sin 0452, la policy Portal queda coherente por tenant en lugar de la de 0085. Se nota sólo en la lectura directa de identidades Portal: DUP T1 5 → 2, DUP T2 5 → 3, vínculo con cliente borrado 1 → 0 e incoherente 5 → 0. El equipo, la escritura y la app quedan iguales.
- **OID internos.** Cambian los de las policies recreadas; no son semánticos y la foto los excluye.
- **Filas.** La vuelta atrás no deshace filas escritas mientras la migración estuvo aplicada. 0407 y 0414 no escriben filas, y las escrituras legítimas de ese periodo quedan con su auditoría.
- **Seguridad.** Se pierde, que es el objetivo de las migraciones:
  - revertir 0414 reabre la lectura cruda de facturas para todo el equipo del tenant, pero no la del Portal;
  - revertir 0407 reabre INSERT, UPDATE y DELETE por PostgREST a commercial, operations, warehouse, support y marketing.

Recibos en el scratchpad de la tarea:
- **Ronda 3:**
  - `results/rollback-r3/`: fotos, logs, matrices, diffs, JSON de la sonda y recibos.
  - `results/rollback-r3-corrida1/`: la primera corrida.
  - `tools/rollback/r3/`: `revert-0414.sql`, `revert-0407.sql`, `snapshot.sql`, `rollback-test-r3.mjs` y `extra-0407-y-convergencia.mjs`.
  - `tools/`: `portal-app-probe-r3.mts` y `measure-db.mjs`, que ahora admite `L07_EXTRA_SKIP` y `L07_WORK_DB`.
- **Ronda 2, reemplazada:** `results/rollback/` y `tools/rollback/`.

## COORDINACIÓN CON PR ABIERTAS Y HALLAZGOS PREVIOS

- **PR #107 y #108, ya en `main` (ronda 3).** L07 las incorpora por merge.
  - **#107 (SDD-0462).** Cierra la frontera del Portal en la app; L07 no toca esos archivos.
  - **#108 (SDD-0463).** Su `0452_portal_invoices_tenant_rls` deja la misma expresión que 0414.
    - **Convergencia.** Su preflight acepta las dos formas y el de 0414 pide la policy por nombre, así que convergen en cualquier orden (SDD-0463 y ronda 3).
    - **Orden recomendado.** SDD-0463 recomienda aplicar 0452 antes de L07, sin despliegue asociado. Las esperas y textos de L07 valen en los dos órdenes.
    - **Su FUERA DE ALCANCE 2** (la vuelta atrás de 0414 recreaba 0085) queda resuelto en la ronda 3.
- **PR #104 (L14, 0420–0423).** No comparte archivos de código con L07; comparte `supabase/migrations-baseline.json`, `supabase/pending-migration-symbol-declarations.json` y `docs/specs/README.md`. Los tres usan el driver `dtd-generated-records`, que los fusionó sin conflicto en la ronda 3 (medido con `main`; SDD-0463 midió lo mismo con #104, #105 y #106). Interacción SQL:
  - Los comandos de L14 leen y actualizan `invoices` dentro de `payment_private.run_report_command`, que es definer y no pasa por RLS. Da igual el orden respecto de 0407, 0414 y 0452.
  - Los preflights de 0421 y 0422 sólo exigen `relrowsecurity` en `invoices`, sin huellas de sus policies ni de su ACL.
  - `reportar/actions.ts` de L14 lee la factura con service_role después de resolver el principal, así que 0414 no lo afecta.
  - No hay solape de locks: 0414 bloquea `invoices` y 0420/0422 bloquean `payment_reports`.
- **PR #105 (L10, 0410 → 0415).** Sólo comparte los mismos tres registros. 0410 lee `invoices` como definer, y 0415 no toca `invoices`.
- **Test de inventario.** Ninguna de las PR abiertas ni #107 alteran sus 45 llamadas: el conteo AST de los archivos de producción de #104 y #105 da 0 cambios, y con #107 incorporada el test pasa 3/3.
- **SDD-0390 y SDD-0397**, `done` en `main` sin todo su código. L07 no depende de ellas: la policy Portal de 0414 es autocontenida, con EXISTS sobre `client_users` y `clients`, evaluable con la RLS que `main` ya da al Portal (`client_users self or tenant read` y `clients portal self read`, verificadas en el catálogo). 0414 no corrige `get_portal_client_markbox()` (`limit 1` sin tenant).

## CONTROLES ROJOS

1. **Aserción estática de timeouts.** El contrato de 0407 contra el archivo de origen falla con `TEST 0407: lock_timeout y statement_timeout deben ir antes del primer lock o DDL (lock_timeout=0, statement_timeout=0, primera sentencia=25)`. El de 0414 falla con el mismo mensaje y `primera sentencia=5`. Con los archivos actuales, los cinco contratos pasan en bases limpias.
2. **Contención.** Sin tope, 13,99 s de espera y 11,99 s de cola. Con tope, 5,0 s y unos 3,0 s.
3. **Migrate-first.** PGRST202 en las tres RPC antes de aplicarlas; los consumidores lanzan (0411 y 0413) o devuelven null (0412).
4. **Paridad.** Casos donde `main` difiere: L07-DEC en Bronze frente a Silver, L07-A 3.623,45 frente a 2.650, principal dual 4.400,45 frente a 2.650, TIE en VES 100 frente a USD 70, ANUL 1.100 frente a 100, BIG 1.000 frente a 1.100 y OV-BIG 200 frente a 210.
5. **Falla silenciosa de 0414 con el código de `main`.** Fidelización `{}` para support, todo Bronze. Conversaciones con saldo 0, y 777 USD de T2 para el dual. OV «Facturas · 0».
6. **Fuga del Portal por RLS.** Sin 0452 ni 0414, DUP T1 lee D2-01, S2-01 y S2-X de T2 por PostgREST directo (ronda 3); deja de verlas con 0452 o con 0414. El bloque `regression_reproduced` del contrato 0414 reproduce la lectura cruzada antes de aplicar.
7. **Matriz de escritura.** En `main` los roles no financieros escriben y borran; tras 0407 no.
8. **Test de inventario.** Un lector ficticio de `invoices` fuera de la lista lo hace fallar (19 archivos contra 18); retirado, vuelve a verde.
   - En la ronda 3 se repitió con el tope de 60 s y dio el mismo resultado.
   - Una copia con tope de 1 ms falló con `Test timed out in 1ms.` a los 2.198 ms: el tope se aplica y se mide al terminar.
9. **Vuelta atrás (ronda 3).**
   - La foto detecta cada cambio: 0452 cambia sólo la policy Portal; 0414 con 0452 aplicada no toca la policy Portal; 0414 sin 0452 sí la cambia.
   - Revertir 0407 con 0414 aplicada aborta con «revertir 0414 primero» sin dejar nada a medias.
   - La primera corrida de la ronda 3 demostró que el arnés falla ante una expectativa mal planteada (la del comercial dual).

## VALIDACIÓN

### Ronda 4 — verify completo sobre el head de código

Está en «RONDA 4 › Validación de la ronda 4», con el veredicto por paso, la meta y el diagnóstico del e2e.

### Ronda 3 — verify completo sobre el head de código

**Head verificado: `dd7e6f4940b987d6b3a9e070b109862ddf470905`.** Meta en `round3/verify-dd7e6f49.meta`:
- rama `codex/c-l07-fidelizacion-conversations`, árbol limpio;
- `origin/main` y merge-base `a3dbac04`;
- inicio 16:51:38Z y fin 17:07:44Z;
- Node v24.20.0, pnpm 12.3.4 y Docker 29.7.2.

Se lanzó con `run_in_background` después de comprobar que no corría otro verify, Vitest ni Playwright.

`corepack pnpm verify` salió con exit 1, sólo por `e2e`. Su línea final: `[FAIL] verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.`
- **PASÓ:**
  - harness, lint, typecheck y components:check;
  - rsc-boundary: sin cruces server→client ni client→node;
  - edge-functions: 4 funciones compilan;
  - test: 547 archivos y 6.839 pruebas en el primer intento, sin reintento, incluida la prueba del inventario con su tope propio;
  - docs:check (446 specs) y numbering (446 specs y 443 migraciones, sin números repetidos);
  - feature-constants (5 banderas) y governance:check (28 políticas);
  - pending-migration-symbols: 0 ROJO · 3 AMARILLO;
  - sql-tests: 186 contratos, con 0407, 0411, 0412, 0413, 0414 y 0452 en verde;
  - schema-rebuild: 425 migraciones desde cero y aislamiento multi-tenant (219 tablas y 2 tenants);
  - build.
- **NO DISPONIBLE:** `migrations-applied`, porque el worktree no tiene `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`.
- **FALLÓ:** `e2e`, también en su reintento, sin watchdog ni workers colgados.
  - Primera pasada: 15 fallidas, 1 flaky, 18 omitidas y 152 aprobadas, en 4,5 min.
  - Reintento: 15 fallidas, 2 flaky, 18 omitidas y 151 aprobadas, en 4,6 min.
  - Las 15 fallidas son las mismas en las dos pasadas y en `799c8ae3`: `auth.spec.ts:21`, `:91`, `:98` y `:105` y `global-search.spec.ts:22`, en chromium, mobile-chrome y mobile-safari. Fallan porque el worktree no tiene configuración de Supabase.
  - Flaky: `auth.spec.ts:74` en chromium, en las dos pasadas. En el reintento se sumó `smoke.spec.ts:150` en chromium, con `page.goto: net::ERR_ABORTED` sobre `/track/S-2026-0142`; pasó en su segundo intento. Ninguno de los dos toca archivos de L07.
- **Al terminar:** no quedaron procesos de verify, Vitest, Playwright ni Next, ni contenedores, y el árbol seguía limpio en `dd7e6f49`.

**Corridas anteriores de la ronda 3:**
- **`799c8ae3`**, de 16:01:46Z a 16:22:16Z, exit 1 (`round3/verify-799c8ae3.*`).
  - FALLÓ `test` sólo por el tope de 20 s del test de inventario: 547 archivos y 6.839 pruebas, 1 fallida, con 22.381 ms en el intento y 20.821 ms en el reintento.
  - FALLÓ `e2e`: en las dos pasadas, las 15 conocidas sin configuración de Supabase y el flaky `auth.spec.ts:74`, sin watchdog.
  - PASÓ el resto: harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols (0 ROJO · 3 AMARILLO), sql-tests (186 contratos), schema-rebuild (425 migraciones) y build. `migrations-applied` quedó NO DISPONIBLE.
- **`2abd3e0d`**, desde las 16:43:19Z, detenido a propósito a las 16:50:14Z durante `e2e` (`round3/verify-2abd3e0d-interrumpido.*`).
  - Hasta ahí pasaron todos los pasos, `test` incluido: 547 archivos y 6.839 pruebas.
  - Se detuvo para corregir un ejemplo de la nota de 0357 y rehacer el commit (ver «Ronda 3»).

Comprobaciones focales de la ronda 3 (recibos en `round3/` y `results/rollback-r3/` del scratchpad):

| Comprobación | Veredicto | Cifras |
|---|---|---|
| Merge con el driver semántico | PASÓ | «✓ merge semántico» en la baseline y el índice; sin conflictos; driver verificado con `install-merge-drivers.mjs --check` (`round3/merge.log`) |
| Índice regenerado con `node scripts/build-docs-index.mjs` | PASÓ | 446 specs, sin diferencias frente al driver |
| Baseline y declaraciones tras el merge | PASÓ | siete esperas, cada una idéntica a su lado; `cutoff` y `$doc` iguales; declaraciones iguales a la rama |
| `invoice-read-boundary.test.mjs` tras el merge | PASÓ | 3/3; inventario AST propio: 45 llamadas en 18 archivos |
| Tope propio del test de inventario (`dd7e6f49`) | PASÓ | focal 3/3; control rojo del inventario, 19 contra 18 y verde al retirarlo; copia con tope de 1 ms en rojo a los 2.198 ms (`round3/test-tope-*.log`) |
| Suite completa con el tope (`node node_modules/vitest/vitest.mjs run`, reporter JSON) | PASÓ | sobre `2abd3e0d`, con el mismo blob del test que el head final (`b40e3936`): 547 archivos y 6.839 pruebas en 151 s; la prueba del inventario tardó 18.943 ms (`round3/vitest-full-2abd3e0d.log` y `.json`) |
| `verify` sobre `2abd3e0d`, detenido a propósito en `e2e` | NO EJECUTADO desde `e2e` | antes de detenerlo pasaron harness, lint, rsc-boundary, typecheck, edge-functions, `test` (547 archivos y 6.839 pruebas), docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols, sql-tests (186 contratos) y schema-rebuild (`round3/verify-2abd3e0d-interrumpido.*`) |
| Medición del prefiltro descartado | PASÓ | mismo inventario en el árbol; el prefiltro por texto pierde 5 de 6 literales con escapes (`round3/prefilter-variants.log`) |
| Gates de símbolos, índice y numeración tras el merge | PASÓ | 0 ROJO · 3 AMARILLO; 446 specs; sin números repetidos |
| Cobertura de allowlists contra `origin/main` | PASÓ | tras el merge y de nuevo sobre `dd7e6f49`: 30 archivos, 0 sin cubrir, 27 por allowlist y 3 por notas (`round3/allowlist-coverage-dd7e6f49.txt`) |
| Aplicación de las esperas de 0414 y 0407 | PASÓ | por literal JSON exacto; `cutoff`, `$doc`, las otras cinco esperas y el párrafo literal intactos, comprobado por valor |
| Vuelta atrás en los dos escenarios | PASÓ | recibo con todas las comprobaciones en OK (segunda corrida) |
| Complemento: 0407 sola sin 0452 y convergencia tras 0414 | PASÓ | recibo con todas las comprobaciones en OK |
| `/ui-check` | NO EJECUTADO | sin cambios de UI |

### Ronda 2 — validación proporcional

Sin verify completo en esa ronda, porque no cambió código de producto ni SQL de migraciones desde `961ec85e`. La corrida fue sobre `4200d1d669cabac8edcad951a004dbf9bea0a07f`, con el árbol limpio:

| Comprobación | Veredicto | Cifras |
|---|---|---|
| `invoice-read-boundary.test.mjs` focal | PASÓ | 3/3; su control rojo falló como se esperaba y volvió a verde |
| `corepack pnpm test` | PASÓ | 546 archivos y 6.820 pruebas |
| `corepack pnpm harness:test` | PASÓ | 87 pruebas |
| `docs:check`, `sdd:check`, `git diff --check`, eslint focal, pending-migration-symbols y governance:check | PASÓ | 444 specs; 0 ROJO · 3 AMARILLO; 28 políticas |
| Prueba de vuelta atrás de la ronda 2 | PASÓ | 23 comprobaciones OK; su SQL de 0414 quedó reemplazado en la ronda 3 |

### Ronda 1 — verify sobre `961ec85e`

`corepack pnpm verify` sobre `961ec85eaf612b6ec9c6064721b56b6ef7ce2bf5` salió con 1 por `e2e`.
- **PASÓ:** harness, lint, rsc-boundary, typecheck, edge-functions, docs:check, numbering, feature-constants, components:check, governance:check y build.
  - test: 545 archivos y 6.817 pruebas.
  - pending-migration-symbols: 0 ROJO · 3 AMARILLO.
  - sql-tests: 185 contratos.
  - schema-rebuild: 424 migraciones.
- **NO DISPONIBLE:** `migrations-applied`.
- **FALLÓ:** `e2e`, con las 15 fallidas de `auth.spec.ts` y `global-search.spec.ts` sin configuración de Supabase y el flaky ajeno de `calculadora-semantic-colors.spec.ts:53`. En la primera pasada un worker de Playwright no terminó y lo forzó el propio Playwright a los 300 s. Recibos: `verify-961ec85e.log`, `.meta` y `.exit`.

Además, en la ronda 1:
- Vitest focal: 14 archivos y 235 pruebas.
- Los cinco contratos pasaron en bases limpias, y sus controles rojos de timeouts fallaron como se esperaba.
- Inventario AST: 48 llamadas en 21 archivos en `bca98147`, y 45 en 18 con L07.
- Mediciones: paridad, matrices, locks y contención en `results/`.

## COMMITS

Ronda 1:
- `6330cb46` feat(studio): SDD-0350 y SDD-0354 a SDD-0357 — importar L07 SQL 0407, 0411–0414 y contratos, pendientes. Diez SQL idénticos al origen.
- `b6fdf92f` fix(db): SDD-0350 y SDD-0357 — 0407 y 0414 fijan lock_timeout y statement_timeout (L07). Desviación y aserciones.
- `f9bbf24d` feat(studio): SDD-0354, SDD-0355 y SDD-0356 — Fidelización, Conversaciones y Órdenes de venta leen facturas por RPC minimizada.
- `dddd918a` chore(db): declarar 0407 y 0411–0414 pendientes de aplicar y el degradado migrate-first (L07).
- `961ec85e` docs(specs): SDD-0350 y SDD-0354 a SDD-0357 — importar specs de L07 con nota de importación. Head de código verificado en la ronda 1.
- `0d247073` docs(handoff): L07 — RBAC de facturas y facades de Fidelización, Conversaciones y Órdenes de venta. Primera versión de este documento.

Ronda 2:
- `e952e4bd` test(studio): SDD-0357 — importar el test de inventario de lectores de invoices (L07, ronda 2).
- `4200d1d6` docs(db): SDD-0350 y SDD-0357 — esperas y notas de 0407 y 0414 con la vuelta atrás probada y la frontera del Portal (L07, ronda 2).
- `c09b5155` docs(handoff): L07 — ronda 2: vuelta atrás probada, frontera del Portal, test de inventario y decisiones del Director.

Ronda 3:
- `0d166684` Merge origin/main (a3dbac04: PR #107 SDD-0462 y PR #108 SDD-0463) en codex/c-l07-fidelizacion-conversations. Sin conflictos textuales; driver semántico en la baseline y el índice.
- `799c8ae3` docs(db): SDD-0350 y SDD-0357 — ronda 3: frontera del Portal en los dos órdenes con 0452 y vuelta atrás de 0414 que no restaura la policy de 0085. Su `verify` falló en `test` por el tope de 20 s del test de inventario.
- `dd7e6f49` test(studio): SDD-0357 — tope propio de 60 s para el inventario de lectores de invoices (L07, ronda 3). Rehace el commit local `2abd3e0d`, nunca publicado, para corregir un ejemplo de la nota. Head de código verificado en la ronda 3.
- `42dd00c2` docs(handoff): L07 — ronda 3: merge de main con 0452, frontera en los dos órdenes y vuelta atrás de 0414 sin la policy de 0085. Sólo cambia este archivo.

Ronda 4:
- `94e42666` Merge origin/main (76797beb: PR #109 registro de 0452 aplicada y PR #105 L10) en codex/c-l07-fidelizacion-conversations. Sin conflictos; driver semántico de `main` en la baseline y el índice.
- `fd6044d4` chore(db): SDD-0350 y SDD-0354 a SDD-0357 — retirar las esperas y declaraciones de 0407 y 0411–0413, aplicadas el 2026-09-13 (L07, ronda 4).
- `e9ed92ab` docs(specs): SDD-0350 y SDD-0354 a SDD-0357 — notas de importación con 0407 y 0411–0413 aplicadas (L07, ronda 4).
- `2c04e369` Merge origin/main (a9a12eed: PR #110 registro de 0451 aplicada) en codex/c-l07-fidelizacion-conversations. Sin conflictos; driver semántico en la baseline. Head de código verificado en la ronda 4.
- Commit que contiene este documento: docs(handoff): L07 — ronda 4. Sólo cambia este archivo.

## PR / BRANCH

- Rama `codex/c-l07-fidelizacion-conversations`, publicada a sí misma con un único push normal por ronda, sin force. Ronda 1 en `0d247073`, ronda 2 en `c09b5155`, ronda 3 en `42dd00c2` y ronda 4 después de todos sus commits.
- PR #106 en borrador contra `main`: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/106. El cuerpo se actualizó en cada ronda; el head final queda en la PR. Desde la ronda 4 no tiene bloqueo migrate-first.
- Base `main` `a9a12eed`, incorporada por merge en la ronda 4 (primero `76797beb`, después `a9a12eed`; antes `a3dbac04` en la ronda 3).
- Worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l07-fidelizacion-conversations`, conservado.

## PENDIENTES DE ESTA TAREA

Ninguno para la aceptación de la extracción ni de las rondas 2, 3 y 4. Lo que sigue pertenece a release o a decisión del Director, no a esta tarea:
- fusionar y desplegar esta PR (paso 3 del orden; 0452, 0407 y 0411–0413 ya están aplicadas);
- el smoke por roles;
- 0414, sólo después de ese smoke, con OK nominal de Sam y el runbook, y el retiro de su espera en una rama propia.

Ya resueltos fuera de esta tarea: el conteo agregado del Portal (hecho por el Director con autorización de Sam el 2026-09-13: un solo tenant), la aplicación de 0452 (PR #109) y la de 0407 y 0411–0413 (ronda 4).

## FUERA DE ALCANCE DETECTADO

1. **Facturas borradas en lectores financieros.** Desde `0230_fix_rls_soft_delete_blocked.sql:36`, la RLS del equipo no filtra `deleted_at` y varios lectores tampoco lo hacen:
   - `listInvoices`, `getInvoiceByCode` e `invoiceKpis` (`lib/studio/invoice-queries.ts:72`, `:130` y `:166`).
   - `receivablesQueue` (`lib/studio/payment-queries.ts:502`), que alimenta la cola de Cobranzas y los recordatorios por correo.
   - `financeInvoiceKpis` (`dashboard-kpi-queries.ts:49`), `revenueByShipment` (`costing/queries.ts:152`) y `applicableInvoicesForReferrer` (`referral-credit-queries.ts:131`).

   `softDeleteInvoice` no restringe el estado (`app/studio/(app)/facturacion/actions.ts:715-731`), así que una factura emitida borrada puede seguir contando o recibir recordatorios. 0414 conserva esa lectura para accounting y admin. Preexistente.
2. `commercialByAgent` traga el error de la facturación y publica ingresos por asesor en cero sin aviso (`lib/studio/reports/queries.ts:619`).
3. La página de Órdenes de venta pide relaciones por orden (`app/studio/(app)/ordenes-venta/page.tsx:39-57`). SDD-0322 está en `main` como spec, pero su código batch y el de la página no. En la ronda 2 el Director lo confirmó fuera del alcance de L07.
4. `get_portal_client_markbox()` y `get_user_tenant_id()` resuelven con `limit 1` sin orden. Un principal con varios vínculos o membresías obtiene un Shipping Mark o tenant arbitrario, y las tres RPC dependen de `get_user_tenant_id()`. Las lecturas de facturas del Portal ya no usan la primera desde SDD-0462.
5. La server action `getReceivableHistory` no tiene gate de módulo (`app/studio/(app)/cobranzas/actions.ts:208-221`). Lee recibos y gestiones bajo RLS, no `invoices`.
6. `app/api/studio/__tests__/route-auth.test.ts:190` mockea `getClientContext` sin afirmar su argumento: no detectaría una vuelta a `conv.client_id`.
7. **Ruta del PDF del Portal sin guard de principal (ronda 2): resuelto en `main` por SDD-0462 (PR #107).** Ahora resuelve el principal antes de leer la factura y responde 404 sin él (`app/portal/(app)/facturas/[code]/pdf/route.ts:50-51`), y lee los datos del emisor con el tenant del principal.

## HANDOFF AL DIRECTOR

- **Siguiente acción.** Revisar la ronda 4 de la PR #106 y fusionarla en el orden normal: ya no hay bloqueo migrate-first. Orden de release: 0452 (hecho) → 0407 → 0411, 0412 y 0413 (hecho el 2026-09-13) → **fusión y despliegue de esta PR → smoke por roles** → 0414 con OK nominal de Sam y el runbook. Con la ronda 4 no quedan decisiones abiertas de L07.
- **Decisiones del Director (ronda 4), aplicadas:**
  1. **Merge de `origin/main` `76797beb` y, por su aviso antes del push, de `a9a12eed`:** hechos sin rebase ni force, sin conflictos, con el driver semántico de `main` e índice regenerado. En `main` queda sólo la espera de 0415; en la rama, la de 0414.
  2. **Registros:** salen las esperas de 0407, 0411, 0412 y 0413 y las tres declaraciones; la espera de 0414 queda actualizada con las cuatro aplicadas y el paso siguiente; `cutoff` intacto; gate `0 ROJO · 0 AMARILLO`.
  3. **Notas de las specs:** 0350, 0354, 0355 y 0356 con el patrón de migración aplicada; 0357 sólo en lo que las mencionaba como pendientes; advisors registrados como efecto esperado.
  4. **PR sin migrate-first:** primera línea con el estado real.
  5. **Verify completo** sobre el head de código de la ronda 4, lanzado sólo cuando terminó el verify ajeno.
  6. **Un único push normal**, PR en borrador y claim liberado.
- **Decisiones del Director (ronda 3), aplicadas:**
  1. **Merge de `origin/main`:** hecho sin rebase ni force, sin conflictos textuales, con el driver semántico e índice regenerado.
  2. **Textos en los dos órdenes:** la espera de 0414, la nota de 0357 y la sección de la PR valen con 0452 aplicada antes y sin ella; la espera de 0407 y la nota de 0350 describen su vuelta atrás.
  3. **Vuelta atrás de 0414:** nunca recrea la policy de 0085. Tiene postflight de expresión exacta y está probada en los dos escenarios con fotos de catálogo, la cadena 0414 → 0407 y la vuelta atrás de 0407 sola sin 0452.
  4. **Verify completo:** sobre el head de código de la ronda 3, con veredicto por paso.
     - El primero (`799c8ae3`) falló en `test` por el tope de 20 s del test de inventario.
     - El ajuste está en `dd7e6f49`: tope propio de 60 s, sin tocar lista, recorrido ni aserciones. El verify se repitió sobre ese head.
     - La corrida intermedia sobre `2abd3e0d` se detuvo a propósito en `e2e` para corregir un ejemplo de la nota; hasta ahí había pasado todo, `test` incluido.
- **Decisiones anteriores**, ya aplicadas en la ronda 2: divergencias de paridad, frontera del Portal, SDD-0322 fuera de alcance, test de inventario y vuelta atrás.
- **Pendiente del Director: el conteo agregado.** Con autorización de Sam, sirve para dimensionar la exposición histórica del Portal. Consulta sugerida, no ejecutada: sólo conteos y ninguna fila.

  ```sql
  select count(*) filter (where i.tenant_id <> cu.tenant_id) as facturas_de_otro_tenant,
         count(*) filter (where c.deleted_at is not null) as con_cliente_borrado,
         count(*) filter (where c.tenant_id <> cu.tenant_id) as con_vinculo_incoherente,
         count(distinct cu.auth_user_id) as principales
  from public.client_users cu
  join public.clients c on c.id = cu.client_id
  join public.invoices i on i.client_markbox = c.markbox
  where cu.status = 'active' and cu.auth_user_id is not null
    and i.deleted_at is null and i.status <> 'borrador'
    and (i.tenant_id <> cu.tenant_id or c.deleted_at is not null or c.tenant_id <> cu.tenant_id);
  ```

  - **Límite.** Es una cota superior: `get_portal_client_markbox()` toma un solo vínculo activo por usuario (`limit 1`).
- **Cambios compartidos.** La baseline, las declaraciones y el índice se fusionan con el driver semántico; conviene integrar en serie y regenerar el índice con el script.
- **Sesiones consumidoras.** Ninguna.
  - **Rondas 1 y 2.** Contenedores y red retirados.
  - **Ronda 3.** Se levantaron y retiraron `dtd_l07_pg`, `dtd_l07_rest` y la red `dtd_l07_net` (dos corridas y el complemento), antes del verify.
    - El verify detenido sobre `2abd3e0d` se terminó con `taskkill /T /F` desde su `corepack`.
    - Después no quedaron procesos de verify, Vitest, Playwright ni Next, ni contenedores.
  - **Ronda 4.** Sin contenedores ni servicios propios: no se levantó PostgreSQL ni PostgREST. El verify propio se lanzó sólo cuando terminó el ajeno (ver «RONDA 4 › Validación de la ronda 4») y al final no quedaron procesos suyos.
  - **Claim.** Liberado al terminar la escritura de cada ronda.
