# portal-facturas-rls — Por RLS, el Portal sólo lee facturas del tenant de su vínculo (SDD-0463 / migración 0452)

Fecha: 2026-09-13. Task ID: `portal-facturas-rls`. Estado de tarea: lista-para-revision; la PR en borrador se abre justo después del push de este commit. Estado SDD-0463: `done`, que no significa aplicada.
Owner / sesión escritora: `portal-facturas-rls-20260913`, subagente Worker lanzado por el Director. Sin subagentes escritores propios.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO`, sin ninguna escritura en el checkout principal.
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/portal-facturas-rls`.
Rama: `codex/portal-facturas-rls`. Base: origin/main `bca98147`, actualizada por merge con origin/main `4c07759c` (PR #107) en `4a6dc6dc`, sin rebase. Reserva del Director: `63fadfc9`, incorporada con cherry-pick como `8763025e`.
SDD: `docs/specs/0463-portal-facturas-rls/spec.md`. Migración asignada: 0452, confirmada libre al empezar con `node scripts/next-number.mjs` («spec siguiente: 0464; migración siguiente: 0452»).

Permisos del encargo:
- **Autorizado:** commits locales selectivos; publicar la rama y abrir la PR en borrador contra `main`.
- **Prohibido:**
  - merge o sacar la PR de borrador, y deploy;
  - leer o escribir datos en producción y aplicar migraciones;
  - ruleset, y borrar ramas o worktrees;
  - tocar los worktrees o las ramas de las PR #104, #105 y #106 (y de la #107 mientras estuvo abierta);
  - escribir en el checkout principal.

**Ronda 2 (2026-09-13, aviso del Director antes de publicar).** `main` avanzó a `4c07759c` al fusionarse la PR #107. Se hizo lo siguiente:
- **Merge:** se incorporó origin/main por merge (`4a6dc6dc`), con el driver semántico. El único archivo compartido fue `docs/specs/README.md`, regenerado con el script.
- **Textos:** la spec y la espera parten de la capa de aplicación ya cerrada en main y citan el código de main.
- **Re-medición:** PostgREST, convergencia y locks se repitieron sobre `da6fcd42`. Sus migraciones y tests son idénticos a los del head final.
- **Verify:** completo sobre el head final `840202bf`.

Recibos y scripts de medición, fuera del repo: scratchpad de la sesión, carpeta `portal-facturas-rls/`.
- **Ronda 2:** `env/r2.log`, `env/converge.log`, `env/locks.log`, `env/results-antes.json`, `env/results-despues.json`, `verify-2.log` y `verify-2.meta`.
- **Ronda 1:** `env/r1-bca98147/`, `verify.log` y `verify.meta`.
- **Ambas:** `env/catalogo-helper.log`, `mut/mutantes.log` y `mut/mutantes-extra.log`.

## OBJETIVO ORIGINAL

Cerrar en la base (RLS) que un usuario del Portal lea facturas de otro tenant consultando PostgREST con su propio JWT, antes de que llegue L07. Es el riesgo residual que dejó la PR #107 (SDD-0462), que lo cierra solo en la aplicación. Encargo:

1. Una migración 0452 que reemplace solo `invoices portal self read` con el predicado idéntico al de la 0414 de L07, con `lock_timeout` y `statement_timeout` dentro de un único `do`, preflight que falle cerrado, postflight de forma exacta, idempotente y sin DML.
2. Convergencia medida en PostgreSQL 17 en tres escenarios, con su md5.
3. Contrato SQL con RED, frontera, drift, aserción estática de los timeouts y control rojo.
4. `GET /invoices` por PostgREST efímero con un JWT de Portal, antes y después.
5. Espera en `supabase/migrations-baseline.json`.
6. Texto exacto para la PR #106, sin tocar su rama.
7. Solapes con #104 a #107 por `git merge-tree`.
8. Revisión de datos personales.

Ronda 2: incorporar origin/main `4c07759c` por merge; verify y convergencia sobre el head que se publique; spec y espera que digan que la capa de aplicación ya está cerrada en main y que la 0452 cierra la consulta directa a PostgREST; en la spec, citar la PR o la rama en vez de rutas de otras PR abiertas.

## COMPLETADO

- **`supabase/migrations/0452_portal_invoices_tenant_rls.sql`**, un único `do $migracion$`:
  - `set local lock_timeout = '5s'` y `statement_timeout = '60s'` (líneas 91-92), antes de todo;
  - existencia de `invoices`, `client_users`, `clients`, `auth.uid()` y el rol `authenticated`;
  - `lock table public.invoices in access exclusive mode` (102), antes de leer el catálogo;
  - `search_path` vacío para comparar expresiones sin depender de la sesión (104), restaurado al final (203);
  - preflight (106-146): la policy es permisiva, SELECT, solo `authenticated` y sin WITH CHECK; su expresión normalizada es la de 0085 o la final; ninguna otra policy de `invoices` usa `get_portal_client_markbox()`. Si algo falla, P0001 sin ids ni Shipping Marks;
  - reemplazo (148-172): con la forma de 0085, `drop policy` + `create policy` con la expresión de 0414:66-79; con la forma final, nada. Un NOTICE dice qué rama tomó;
  - postflight (174-201): forma final exacta y huella md5 de las demás policies igual antes y después.
- **Bug encontrado por el contrato antes del primer commit.** La huella de las demás policies concatenaba `p.polcmd` (`"char"`) con `||` y fallaba con 42725 `operator is not unique: text || "char"`. Con el archivo así, aplicar la 0452 sobre main habría fallado. Se corrigió con `::text` explícitos y el contrato quedó verde.
- **`supabase/tests/0452_portal_invoices_tenant_rls.test.sql`**, sobre las migraciones reales 0080, 0430, 0085 y 0452, con stubs mínimos, fixtures ficticios y rollback. Ocho puntos:
  1. RED: sin 0452, T1 lee `F-T2-0001` de T2; T2 lee `F-T1-0001` y `F-T1-0002` de T1; el vínculo con cliente borrado lee `F-T1-0005`; el incoherente, `F-T1-0006`.
  2. Estático: único `do`, timeouts dentro y antes del lock, orden lock → preflight → DDL → postflight, un solo lock, un `drop` y un `create`, sin DML, grants, comentarios, alter ni funciones.
  3. Drift: siete escenarios con P0001 exacto y catálogo intacto.
  4. Postflight: dos variantes del archivo que el preflight deja pasar.
  5. Aplicación: la transacción queda con 5 s y 60 s; el `search_path` no cambia.
  6. Comportamiento y frontera, con equipo, service_role y escritura del Portal.
  7. Catálogo contra el predicado de 0414 copiado sobre `ref0452.invoices`.
  8. Idempotencia por oid y filas.
- **`supabase/migrations-baseline.json`**: espera `0452_portal_invoices_tenant_rls`, escrita y reescrita con scripts que exigen la serialización `JSON.stringify(…, null, 2)` y dejan intactos `cutoff` 238, `$doc` y la espera de la 0451.
  - **Ronda 2:** empieza por «La capa de aplicación ya está cerrada en main desde 4c07759c (PR #107, SDD-0462); 0452 cierra lo que queda: la consulta directa a PostgREST con el JWT del propio usuario». La frontera describe la app de main: el layout y la ruta del PDF, que resuelve el principal y responde 404. Las duraciones de lock son las de las dos corridas.
- **`docs/specs/0463-portal-facturas-rls/spec.md`** y **`docs/specs/README.md`**, regenerado con 441 specs tras el merge.
  - **Ronda 2:** la spec parte de la capa de aplicación cerrada en main (`4c07759c`) y cita SDD-0462 por su ruta, que ya existe en main.
  - Las citas de código ahora son las de main: `lib/portal/portal-queries.ts:131-135`, `app/portal/(app)/layout.tsx:40` y `app/portal/(app)/facturas/[code]/pdf/route.ts:50-54`. La 0414 se cita por nombre y rama, sin ruta de archivo.
  - `related` suma `0462`, y los solapes quedan solo con #104, #105 y #106.
- **Merge `4a6dc6dc`** de origin/main `4c07759c`: `git merge --no-commit --no-ff`, driver `dtd-generated-records`, sin conflictos. El índice se regeneró dentro del mismo merge.

## CONVERGENCIA CON L07 (PostgreSQL 17.11 efímero)

- **Método:** main reconstruido con el método de `scripts/check-schema-rebuild.mjs` y sembrado. Cada escenario parte de una copia de esa base y aplica cada migración con `--single-transaction`.
- **L07:** los cinco archivos leídos de `origin/codex/c-l07-fidelizacion-conversations` en `c09b5155`, sin tocar su worktree.
- **md5:** catálogo de policies de `invoices` (nombre, comando, roles, USING y WITH CHECK), el mismo cálculo de SDD-0462.
- **Dos corridas con las mismas md5:** sobre `3bce2f48` (base `bca98147`) y sobre `da6fcd42` (con `4c07759c`).

| Escenario | Secuencia | Resultado | md5 del catálogo | md5 de la policy Portal |
|---|---|---|---|---|
| main | — | — | `6a7f22fb9b4d93198cdc71002195ae47` | `eb6108542378105a4b34631f9f0c904a` |
| **(a) main + 0452** | 0452 | NOTICE «reemplazada» | `97d3ae96a41f0bea5f7a11a152ccd80f` | `fd8dddf9c2906545230ef715274680d5` |
| (a) reaplicada | 0452 → 0452 | la segunda: «ya tenía la forma final; sin cambios» | `97d3ae96a41f0bea5f7a11a152ccd80f` | `fd8dddf9c2906545230ef715274680d5` |
| **(b) cronológico, producción** | 0452 → 0407 → 0411 → 0412 → 0413 → 0414 | todo OK; **el preflight de 0414 pasa** | `345b2d1080a2e87e93639f2f0be8b28b` | `fd8dddf9c2906545230ef715274680d5` |
| **(c) numérico, schema-rebuild** | contenedor propio desde cero: 443 archivos (main, 5 de L07 y 0452), 425 aplicadas sin las 18 LEDGER_ONLY, la 0414 antes que la 0452 | todo OK; **0452: «ya tenía la forma final; sin cambios»** | `345b2d1080a2e87e93639f2f0be8b28b` | `fd8dddf9c2906545230ef715274680d5` |
| Referencia: PR #106 sola | 0407 → 0411 → 0412 → 0413 → 0414 | todo OK | `345b2d1080a2e87e93639f2f0be8b28b` | `fd8dddf9c2906545230ef715274680d5` |

- (b), (c) y la referencia coinciden también con `permissive`, los comentarios de las policies y el comentario de la tabla.
- La md5 de (a) coincide con la que midió SDD-0462 para su candidata sobre la base principal (`97d3ae96…`).
- (a) no puede tener el catálogo completo de (b) y (c), porque no trae las policies de equipo de L07. Frente a main, (a) solo cambia la policy Portal:
  - **Primera corrida, por SQL:** las demás policies (`3b3c0061d43f111e8a1ee0ea3ffc3c8e`), la ACL, el comentario de la tabla y las filas dan el mismo md5 antes y después.
  - **Segunda corrida:** lo exigió el postflight de la propia 0452 (huella de las demás policies), que pasó sobre el esquema real.
  - **Ojo con el script:** la línea «a sólo cambia la policy Portal frente a main: false» de `converge.log` es un artefacto. El filtro por líneas no quita las líneas de continuación del `qual` multilínea.
- En (a), (b), (c) y la referencia, los clientes Portal leen lo mismo: T1 `F-2026-0001,F-T1-0001,F-T1-0002`; T2 `F-2026-0001,F-T2-0009`; cliente borrado e incoherente, ninguna.

## CONTROL ROJO Y MUTANTES

Cada caso corre el contrato en su propio PostgreSQL 17 desechable, sobre una copia de los archivos que usa. Corrido sobre `3bce2f48`.

- Los cinco archivos que usa (0080, 0430, 0085, 0452 y el test) son idénticos en `840202bf`: `git diff` vacío. El merge no tocó `supabase/` ni los scripts de rebuild y de `sql-tests`.
- El contrato volvió a pasar dentro de `sql-tests` del verify final.
- Los 26 casos dieron el resultado esperado.

| Caso | Esperado | Primera aserción que falla |
|---|---|---|
| C0 original | pasa | — (pasa) |
| C1 sin los `\ir` de 0452 | falla | punto 5: «La transacción de aplicación no quedó con lock_timeout 5 s y statement_timeout 60 s» |
| C2 sin los `\ir` de 0452 ni el punto 5 | falla | punto 6: «Con 0452 el cliente de T1 debía dejar de leer la factura de T2 y conservar las suyas; leyó [F-T1-0001,F-T1-0002,F-T2-0001]» |
| C3 cliente de T2 con otro Shipping Mark (fixture feliz) | falla | punto 1: «RED: sin 0452 el cliente de T2 debía leer las facturas de T1…; leyó []» |
| M01 DDL con la expresión de 0085 y constante final igual | falla | punto 4, variante sin tenant: «dio [ok\|\|\|]» |
| M01b M01 sin el punto 4 | falla | punto 6: «…leyó [F-T1-0001,F-T1-0002,F-T2-0001]» |
| M02 sin `cu.tenant_id = invoices.tenant_id` | falla | punto 4: «dio [ok\|\|\|]» |
| M02b M02 sin el punto 4 | falla | punto 6: «…leyó [F-T1-0001,F-T1-0002,F-T2-0001]» |
| M03 sin `c.deleted_at is null` | falla | punto 3, casi final: «dio [ok\|\|\|]». En filas no se ve: la RLS de `clients` de la 0430 ya exige cliente vivo |
| M04 sin `c.tenant_id = cu.tenant_id` | falla | punto 7: «La policy Portal no es idéntica al predicado de 0414». En filas lo enmascara la 0430 |
| M05 sin `cu.status = 'active'` | falla | punto 7, igual que M04. En filas lo enmascara la 0430 |
| M06 timeouts fuera del `do` | falla | punto 2: «Fuera del bloque do quedó SQL» |
| M07 sin `statement_timeout` | falla | punto 2: orden roto, `statement_timeout 0` |
| M08 sin `lock_timeout` | falla | punto 2: orden roto, `lock_timeout 0` |
| M09 `lock_timeout` después del lock | falla | punto 2: orden roto |
| M10 lock después del preflight | falla | punto 2: orden roto |
| M11 sin lock | falla | punto 2: orden roto, `lock 0` |
| M12 preflight acepta cualquier expresión | falla | punto 3: sale el mensaje del postflight en vez del del preflight |
| M13 preflight acepta roles de más | falla | punto 3, con `anon`: «dio [ok\|\|\|]» |
| M14 sin chequeo de la helper en otra policy | falla | punto 3: «dio [ok\|\|\|]» |
| M15 postflight sin forma exacta | falla | punto 2: orden roto, `postflight 0`. Sin el estático lo caza el punto 4 |
| M16 postflight sin huella de las demás policies | falla | punto 4: «dio [ok\|\|\|]» |
| M17 no restaura el `search_path` | falla | punto 5: «0452 cambió el search_path de la sesión: []» |
| M18 reaplicar recrea la policy | falla | punto 8: «Reaplicar 0452 recreó o cambió la policy» |
| M19 con DML | falla | punto 2: «La migración contiene DML» |
| M20 compara sin `search_path` vacío | falla | punto 3: rechaza la policy legítima de 0085 porque el deparse cambia |

## POSTGREST 16.1: `GET /invoices` ANTES Y DESPUÉS

Medido dos veces con el mismo resultado: sobre `3bce2f48` y sobre `da6fcd42`.

- **Entorno:** main reconstruido (419 migraciones, PostgreSQL 17.11) en red interna, con PostgREST publicado solo en 127.0.0.1. Las únicas adaptaciones fueron que `auth.uid()` lea los claims y habilitar `authenticator`.
- **Datos sintéticos:**
  - T1 y T2 con un cliente `DTD-9901` cada uno;
  - cinco vínculos Portal: coherente en T1, coherente en T2, con cliente borrado en T1, incoherente (vínculo en T2, cliente en T1) y revocado;
  - un usuario `accounting` de T1;
  - nueve facturas, con código repetido entre tenants, una anulada y un borrador.
- **JWT:** HS256 con el secreto local y `role` `authenticated`, `anon` o `service_role`.
- **Aplicación:** la 0452 sobre la base principal con `psql --single-transaction`, como `apply_migration`, con NOTICE «reemplazada».

`GET /invoices?select=invoice_code,tenant_id,client_markbox,client_name,client_rif,total_amount,status&order=tenant_id.asc,invoice_code.asc`:

| JWT | Antes (main) | Después (0452) |
|---|---|---|
| Portal T1, coherente | 200 · 5: `F-2026-0001@T1`, `F-T1-0001@T1`, `F-T1-0002@T1`, **`F-2026-0001@T2` (Cliente sintético T2, J-00000022-2, 250)** y **`F-T2-0009@T2` (Cliente sintético T2, J-00000022-2, 777)** | 200 · 3: `F-2026-0001@T1`, `F-T1-0001@T1`, `F-T1-0002@T1` |
| Portal T2, coherente | 200 · 5: sus 2 y **3 de T1** (150, 100 y 40) | 200 · 2: `F-2026-0001@T2`, `F-T2-0009@T2` |
| Portal con cliente borrado | 200 · 1: `F-T1-0005@T1` | 200 · 0 |
| Portal incoherente | 200 · 1: `F-T1-0006@T1` | 200 · 0 |
| Portal revocado | 200 · 0 | 200 · 0 |
| Equipo T1 (`accounting`) | 200 · 6 de T1 | 200 · las mismas 6 |
| anon | 401 · 42501 `permission denied for table invoices` | igual |
| service_role | 200 · 9 | 200 · 9 |

En la primera ronda, un intento de «antes» midió la base vacía y se descartó:
- el seed falló por la FK `user_tenants_user_id_profile_fkey`;
- un `tee` ocultó el código de salida, así que la cadena siguió;
- se agregó al seed la fila de `user_profiles` y se repitió con `pipefail`. Las mediciones de arriba son las válidas.

## LOCKS Y CONTENCIÓN (PostgreSQL 17.11 local, encima de todo main sembrado)

| Caso | Locks de `public` retenidos al terminar, dentro de la transacción | Duración: corrida 1 (`3bce2f48`) · corrida 2 (`da6fcd42`) |
|---|---|---|
| Rama de reemplazo (forma 0085) | `invoices` AccessExclusiveLock y AccessShareLock; `client_users` AccessShareLock; `clients` AccessShareLock | 6,874 ms · 8,893 ms |
| Rama sin cambios (forma final, base de (b)) | `invoices` AccessExclusiveLock; `client_users` y `clients` AccessShareLock, que toma el deparse de `pg_get_expr` | 4,879 ms · 5,663 ms |

En los dos casos la transacción quedó con `lock_timeout` 5s y `statement_timeout` 1min.

Contención: un lector retiene `invoices` 15 s (`begin; select count(*) from public.invoices; select pg_sleep(15)`), la 0452 arranca 1,5 s después y un lector nuevo llega 1 s después de la migración.

| Modo | Migración | Lector nuevo | Lector que retenía | Policy después |
|---|---|---|---|---|
| `--single-transaction` | exit 3 a los 5,22 s · 5,23 s: `canceling statement due to lock timeout` en `lock table public.invoices in access exclusive mode` | 4,20 s · 4,22 s | 15,26 s · 15,25 s | forma 0085: revertida entera |
| autocommit (`psql -f` sin `-1`) | exit 3 a los 5,22 s · 5,23 s, mismo error | 4,20 s · 4,22 s | 15,23 s · 15,25 s | forma 0085 |

`statement_timeout` fijado dentro de un `do`, medido aparte:
- **En autocommit:** un `do` que lo fija en 1 s y duerme 2,5 s terminó bien, a los 2,72 s · 2,73 s.
- **En una transacción:** tras ese `do`, `select pg_sleep(2.5)` cortó a los 1,21 s · 1,22 s con `canceling statement due to statement timeout`.

Conclusión: dentro del `do`, `lock_timeout` rige también en autocommit, y `statement_timeout` solo rige para las sentencias siguientes de la transacción.

## TEXTO PROPUESTO PARA LA PR #106 (cuando 0452 ya esté aplicada)

No se tocó la rama `codex/c-l07-fidelizacion-conversations`; se leyó su head `c09b5155`. Estos cambios valen **solo si `0452_portal_invoices_tenant_rls` se aplica antes que L07**, como recomienda SDD-0463. El SQL de 0407 a 0414 no cambia.

### 1. Espera de `0414_invoices_read_rbac` en `supabase/migrations-baseline.json`

**a) Qué hace.** Reemplazar:

> y reemplaza invoices portal self read por una versión que exige vínculo client_users activo del auth.uid(), cliente vivo y tenant coincidente en vínculo, cliente y factura, además del Shipping Mark, sin borradores ni borradas.

por:

> y vuelve a crear invoices portal self read con la misma expresión que dejó 0452_portal_invoices_tenant_rls (SDD-0463, ya aplicada): vínculo client_users activo del auth.uid(), cliente vivo y tenant coincidente en vínculo, cliente y factura, además del Shipping Mark, sin borradores ni borradas. Para el Portal, aplicar 0414 no cambia nada.

**b) Frontera.** Reemplazar el párrafo que empieza «FRONTERA DEL PORTAL, aceptada por el Director como intencional (ronda 2 de L07)» y termina «que la policy histórica exponía (medido).» por:

> FRONTERA DEL PORTAL, aceptada por el Director como intencional (ronda 2 de L07): rige desde 0452_portal_invoices_tenant_rls (SDD-0463), que aplicó la misma expresión antes que L07. Un vínculo client_users activo cuyo cliente está borrado, o cuyo vínculo y cliente no coinciden de tenant, ya no lee facturas y no recibe ningún mensaje de error; un vínculo coherente conserva las suyas y no ve las de otro tenant. 0414 no cambia esa lectura: su preflight pide invoices portal self read por nombre y su drop + create la deja idéntica (convergencia medida en SDD-0463: catálogo de policies de invoices con md5 345b2d1080a2e87e93639f2f0be8b28b en orden cronológico, en rebuild numérico y con la PR #106 sola).

El párrafo que se reemplaza también afirma que la descarga del PDF «hoy entrega la factura y tras 0414 responde 404». Desde `4c07759c` (PR #107) eso ya no es cierto en main, con o sin 0452: la ruta resuelve el principal antes de leer la factura.

**c) Vuelta atrás.** Reemplazar:

> borra invoices_accounting_select, recrea invoices_team_select y la policy Portal de 0085 y restaura el comentario de 0407.

por:

> borra invoices_accounting_select, recrea invoices_team_select, deja invoices portal self read como la dejó 0452 y restaura el comentario de 0407. NO recrear la policy Portal de 0085: con 0452 aplicada, eso reabre la lectura del Portal entre tenants con Shipping Mark repetido que 0452 cerró.

y, en la misma espera, reemplazar:

> No se pierden datos, pero la vuelta atrás reabre la lectura cruda de facturas para todo el equipo del tenant y la exposición del Portal entre tenants con Shipping Mark repetido;

por:

> No se pierden datos, pero la vuelta atrás reabre la lectura cruda de facturas para todo el equipo del tenant; la lectura del Portal queda la de 0452;

### 2. Sección «Frontera del Portal al aplicar 0414» del cuerpo de la PR #106

Reemplazar la sección completa por:

```markdown
## Frontera del Portal al aplicar 0414

La frontera del Portal ya rige desde `0452_portal_invoices_tenant_rls` (SDD-0463), aplicada antes que L07 con la misma expresión. **Aplicar 0414 no cambia lo que el Portal deja leer**, y en ningún caso aparece un mensaje de error.

- **Cliente con vínculo coherente:** conserva sus facturas. Desde 0452 no ve las de otro tenant con su mismo Shipping Mark.
- **Vínculo activo cuyo cliente está borrado, o cuyo vínculo y cliente son de tenants distintos:** desde 0452 no lee facturas, sin mensaje de error: la lectura devuelve cero filas. El Director aceptó esta frontera como intencional.
- **Vuelta atrás de 0414:** deja la policy Portal de 0452 y no recrea la de 0085.
```

### 3. SQL de la vuelta atrás de 0414 en `.agents/handoffs/c-l07-fidelizacion-conversations.md`

La sección «SQL de la vuelta atrás de 0414» hoy recrea la expresión de 0085, y su postflight exige `qual like '%get_portal_client_markbox%'`. Cambios:

- **Quitar** el bloque `drop policy "invoices portal self read" on public.invoices;` + `create policy "invoices portal self read" … client_markbox = public.get_portal_client_markbox()`.
- **Postflight:** cambiar `and qual like '%get_portal_client_markbox%'` por `and qual like '%client_users%' and qual not like '%get_portal_client_markbox%'`.
- **Volver a probar** la vuelta atrás encima de main + 0452 + 0407–0414. La foto «idéntica a la de antes de 0414» se compara contra ese estado, que ya trae la policy de 0452.

La nota de SDD-0357 que declara la frontera y la vuelta atrás necesita el mismo ajuste.

## SOLAPES CON LAS PR ABIERTAS

Medido sobre el head final `840202bf`, con `git fetch origin` antes; los heads coinciden con `gh pr list`.

- **Con driver:** `git merge-tree --write-tree --name-only --messages`, con el driver `dtd-generated-records` que el repo declara en `.gitattributes` para los registros generados.
- **Sin driver:** `git merge-file` con las tres versiones de cada registro.

| PR | Head | Archivos tocados por ambos lados | Con driver | Sin driver |
|---|---|---|---|---|
| #104 L14 | `93f1cbed` (merge-base `42c8839e`) | `docs/specs/README.md`, `supabase/migrations-baseline.json` | exit 0, merge semántico de los dos | 1 conflicto en la baseline; 0 en el índice |
| #105 L10 | `f555f5eb` | los mismos | exit 0 | 1 en la baseline; 0 en el índice |
| #106 L07 | `c09b5155` | los mismos | exit 0 | 1 en la baseline; 1 en el índice |
| #107 SDD-0462 | fusionada en main (`4c07759c`) | incorporada por el merge `4a6dc6dc` | el driver fusionó `docs/specs/README.md`, único compartido, y el script lo regeneró | — |

- Los árboles fusionados conservan `cutoff` 238 y todas las esperas de cada lado, incluida `0452_portal_invoices_tenant_rls`.
- El índice queda con 444, 443 y 446 specs.
- Ningún archivo de código, migración ni prueba se comparte.
- **Ronda 1**, sobre `3bce2f48`, antes de #107: los cuatro merges también salieron limpios con el driver. Sin driver, el índice daba 2 conflictos con #104, #105 y #106, y 1 con #107, que compartía solo el índice.

## DATOS PERSONALES (`revisar-datos-ve`)

No es asesoría legal. Detalle en la spec. Se aplica sobre el inventario y los hallazgos de SDD-0462.

- **Campos.** `invoices.client_name`, `client_rif` y `client_doc_kind` son identidad fiscal. `total_amount`, `paid_amount`, `lines`, `notes` (texto libre) y `shipment_code` son datos económicos y de mercancía.
- **ENCONTRADO en main; esta SDD lo corrige.** Es el hallazgo 3 de SDD-0462: `supabase/migrations/0085_portal_invoices_rls.sql:19-26` permite leerlos por PostgREST desde otro tenant, aunque la app ya no los muestra desde `4c07759c`. Normas: CRBV art. 28 y art. 60.
- **CORRECTO, en local.** `supabase/migrations/0452_portal_invoices_tenant_rls.sql:150-168` limita la lectura al tenant del vínculo, medido con PostgREST y datos sintéticos.
- **CORRECTO.** La migración no agrega campos, logs ni tratamientos. Sus mensajes no llevan ids ni Shipping Marks (contrato, punto 3). No hubo ninguna lectura de producción.
- **NO VERIFICABLE.** No se sabe si la exposición ocurrió en producción. Hace falta el conteo agregado que el Director tiene pendiente con Sam y, si es mayor que cero, los registros de acceso de la API.
- **De otro dueño.** `payment_reports` por Shipping Mark (`supabase/migrations/0195_payment_reports.sql:119-125`) lo cierra la 0420 de la PR #104.

## VALIDACIÓN

### Verify canónico, sobre el head final `840202bf`

- **HEAD verificado:** `840202bf911b83915b820fd3ceb073e4edba7fff`, rama `codex/portal-facturas-rls`, con main `4c07759c` incorporado.
- **Árbol:** limpio al empezar y al terminar (`verify-2.meta`: `tree_clean_at_start=yes`, `head_after` igual y `status_after` vacío).
- **Antes de lanzarlo:** no corría otro verify ni e2e, y el entorno de medición ya estaba retirado.
- **Corrida:** de 2026-09-13T10:35:50Z a 10:52:11Z, exit 1.
- **Resumen del gate:** «16 de 17 pasos corrieron de verdad», «1 fallo(s) → e2e» y «CRÍTICOS SIN MEDIR: migrations-applied». **El gate no está completo.**

| Paso | Veredicto | Detalle |
|---|---|---|
| harness | PASÓ | 41 pruebas |
| lint | PASÓ | — |
| rsc-boundary | PASÓ | 1599 módulos, sin cruces |
| typecheck | PASÓ | — |
| edge-functions | PASÓ | 4 funciones compilan |
| test | PASÓ | 544 archivos, 6830 pruebas, incluidas las que trajo #107 |
| docs:check | PASÓ | índice sincronizado con 441 specs |
| numbering | PASÓ | sin números repetidos |
| feature-constants | PASÓ | 5 banderas |
| components:check | PASÓ | CMP-01 válido |
| governance:check | PASÓ | 28 políticas aprobadas |
| migrations-applied | NO DISPONIBLE | SKIP: el worktree no tiene `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`. La 0452 lleva su espera; no se aplica nada para pasar el gate |
| pending-migration-symbols | PASÓ | 0 ROJO · 0 AMARILLO |
| sql-tests | PASÓ | 181 contratos, incluido `0452_portal_invoices_tenant_rls.test.sql` |
| schema-rebuild | PASÓ | 438 archivos: 420 migraciones desde cero con la 0452, 18 sólo-ledger que no tocan el schema, y aislamiento multi-tenant (219 tablas) |
| e2e | FALLÓ | por entorno, ver abajo |
| build | PASÓ | build de producción OK |

**e2e, diagnosticado con el log, sin volver a correrlo:**

- **Dos pasadas de 186 pruebas.** La primera: 15 fallidas, 1 flaky, 18 omitidas y 152 pasadas, en 4,4 min. La segunda: 15 fallidas, 18 omitidas y 153 pasadas, en 4,2 min, sin flaky.
- **Las 15 fallidas.** Son la misma lista en las dos pasadas y la misma de la ronda 1, comparadas línea a línea: los 5 escenarios de `e2e/auth.spec.ts` (líneas 21, 91, 98 y 105) y `e2e/global-search.spec.ts` (línea 22), en chromium, mobile-chrome y mobile-safari.
- **Causa en el log:** `Your project's URL and Key are required to create a Supabase client!`, el mismo error de `proxy.ts:67` de la ronda 1. El worktree no tiene configuración Supabase; es el fallo sabido de antemano.
- **Flaky de la primera pasada:** `e2e/auth.spec.ts:74` en chromium. No toca archivos de esta PR.
- **Sin cortes ni restos.**
  - El watchdog no cortó nada.
  - Al terminar no quedaron procesos `node` de verify, Playwright ni Next, ni contenedores `dtd_*` o `pfr_*`.
  - El puerto 3563 solo tenía conexiones en `TIME_WAIT`, sin servidor escuchando.

### Verify de la ronda 1, sobre `3bce2f48` (base `bca98147`)

- **Corrida:** de 2026-09-13T10:01:23Z a 10:20:06Z, exit 1, con el árbol limpio al empezar y al terminar.
- **PASARON 15 de 17 pasos**, con `sql-tests` (181 contratos, con el de la 0452) y `schema-rebuild` (420 migraciones).
- **e2e FALLÓ:** los mismos 15 escenarios en las dos pasadas, sin configuración Supabase (`proxy.ts:67`). Flaky: `e2e/auth.spec.ts:74` y `e2e/calculadora-semantic-colors.spec.ts:53` en la primera, y `e2e/attachments-gastos-pilot.spec.ts:20` en la segunda.
- **`migrations-applied`:** NO DISPONIBLE.
- Queda como antecedente: la corrida canónica es la de arriba.

### Comprobaciones focales

| Comprobación | Alcance | Veredicto |
|---|---|---|
| Contrato 0452 en PostgreSQL 17.11 propio | worktree, antes del primer commit | FALLÓ la primera vez con 42725, que destapó el bug de la huella; PASÓ tras la corrección. Después PASÓ también dentro de `sql-tests` en los dos verify |
| Control rojo y mutantes | 26 casos sobre `3bce2f48`; archivos idénticos en `840202bf` | PASÓ: 26 de 26 con el resultado esperado |
| Convergencia (a), (b), (c) y referencia #106 | `3bce2f48` y `da6fcd42` | PASÓ, con las mismas md5 en las dos |
| `GET /invoices` por PostgREST 16.1 | 8 JWT, antes y después, en `3bce2f48` y `da6fcd42` | PASÓ, con el mismo resultado |
| Locks y contención | 5 bases efímeras, dos corridas | medido |
| Merge de origin/main `4c07759c` | `4a6dc6dc` | PASÓ: sin conflictos; driver en `docs/specs/README.md`; índice regenerado |
| `node scripts/build-docs-index.mjs --check` | `3bce2f48`, `4a6dc6dc`, `5d84556b` y `840202bf` | PASÓ; 441 specs desde el merge |
| `node scripts/check-numbering.mjs` | `3bce2f48` y `5d84556b` | PASÓ |
| `vitest run scripts/__tests__/spec-migration-refs.test.ts` | `3bce2f48` y `5d84556b` | PASÓ, 5/5 |
| `node scripts/check-pending-migration-symbols.mjs` | `7a48d31b` | PASÓ, 0 ROJO · 0 AMARILLO |
| `git diff --check` y `git diff --cached --check` | cada commit | PASÓ |
| `git merge-tree` contra #104, #105, #106 y #107 | `3bce2f48`, y contra #104 a #106 en `da6fcd42` y `840202bf` | PASÓ con el driver del repo; tabla en «SOLAPES» |
| Catálogo de policies que usan `get_portal_client_markbox()` | main reconstruido, con y sin 0452 | medido: ver FUERA DE ALCANCE |
| `/ui-check` | — | NO EJECUTADO: no aplica, la PR no tiene UI |
| Producción | — | NO EJECUTADO: fuera del permiso; ninguna lectura ni escritura |

Tras el commit que solo agrega este documento, verify no se repite.

## COMMITS

- `8763025e` chore(sdd): reserva SDD-0463 — portal-facturas-rls. Cherry-pick de `63fadfc9`.
- `917296cc` fix(studio): SDD-0463 — migración 0452: la RLS de facturas del Portal exige el tenant del vínculo. Migración y contrato SQL.
- `7a48d31b` chore(db): SDD-0463 — espera de la 0452 en migrations-baseline.json.
- `3bce2f48` docs(sdd): SDD-0463 — spec de la RLS de facturas del Portal por tenant e índice. Head del verify de la ronda 1.
- `4a6dc6dc` Merge origin/main (4c07759c, PR #107) en codex/portal-facturas-rls. Índice regenerado.
- `5d84556b` docs(sdd): SDD-0463 — la spec parte de la capa de aplicación ya cerrada en main (4c07759c).
- `da6fcd42` chore(db): SDD-0463 — la espera de la 0452 parte de la capa de aplicación en main. Head de la re-medición de base.
- `840202bf` docs(sdd): SDD-0463 — duraciones de locks de las dos corridas en la spec y la espera. Head de código verificado.
- Commit que contiene este documento: docs(handoff): SDD-0463 — cierre de portal-facturas-rls. Solo agrega este archivo.

## PR / BRANCH

- **Rama:** `codex/portal-facturas-rls`, publicada con un único push después del commit de este documento.
- **PR:** en borrador contra `main`, abierta después del push. Su URL y el SHA final van en el reporte al Director y en la propia PR.
- **Base:** `main` `4c07759c`, incorporada por merge.
- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/portal-facturas-rls`.

## PENDIENTES DE ESTA TAREA

- **Ninguno para la aceptación.**
- El gate local no está completo: e2e FALLÓ por entorno y `migrations-applied` quedó NO DISPONIBLE. Ninguno de los dos pide cambios en esta rama.
- El resultado del CI de la PR, que corre después del push, va en el reporte al Director y no en este documento.

## FUERA DE ALCANCE DETECTADO

1. **`statement_timeout` fijado dentro de un `do` no acota ese mismo `do`** (medido dos veces en PostgreSQL 17.11, sección «LOCKS Y CONTENCIÓN»).
   - El patrón de la 0450 y la 0451 fija los dos timeouts dentro del `do` para que rijan en autocommit. `lock_timeout` sí rige; `statement_timeout` no.
   - La espera de `0451_aliados_cadena_mismo_tenant`, pendiente de aplicar, dice «lock_timeout 5 s acota la espera y statement_timeout 60 s la corrida». La segunda mitad no se cumple para el propio `do`.
   - El impacto es bajo, porque la corrida es corta y la espera la corta `lock_timeout`. No se tocó.
2. **La vuelta atrás de la 0414 que documenta L07 recrea la policy de la 0085.** Con la 0452 aplicada antes, reabriría la lectura del Portal entre tenants. El cambio exacto está en «TEXTO PROPUESTO PARA LA PR #106». No se tocó su rama.
3. **`payment_reports` conserva tres policies Portal sin tenant**, en main y también con la 0452 aplicada (catálogo de main reconstruido):
   - `payment_reports portal self read` (USING);
   - `payment_reports portal self insert` (WITH CHECK);
   - `payment_reports portal self update` (USING y WITH CHECK).

   Las tres usan `get_portal_client_markbox()` y las cubre la 0420 de la PR #104, según su espera. Fuera de esas tres y de la de facturas, ninguna otra policy del catálogo de main usa la helper: las de envíos, documentos, prealertas, `suppliers_cn`, academia y cotizaciones ya se reemplazaron en la 0416, 0417, 0418 y 0428.
4. **La función `client_delivery_addresses_validate_client()` también llama a `get_portal_client_markbox()`** (según `pg_proc.prosrc` en main reconstruido). No se revisó si deja cruzar tenants; queda para su dueño.
5. **E2e inestables ajenos, distintos en cada pasada.** Ronda 1: `e2e/auth.spec.ts:74` y `e2e/calculadora-semantic-colors.spec.ts:53` en la primera pasada, y `e2e/attachments-gastos-pilot.spec.ts:20` (un 500 donde esperaba 404) en la segunda. Verify final: `e2e/auth.spec.ts:74` en la primera pasada; ninguno en la segunda.

## HANDOFF AL DIRECTOR

- **Revisión:** la PR sobre su head. El diff contra main son exactamente los seis archivos de la «Allowlist exacta» de la spec.
- **Orden recomendado:** integrar y aplicar la 0452 **antes** de L07. No depende de ningún despliegue, porque la capa de aplicación ya está en main desde `4c07759c`, y converge con L07 en los dos órdenes (medido).
- **Para aplicarla**, con OK nominal de Sam y el runbook:
  1. Leer el catálogo de policies de `invoices`, sin filas. La 0085 se aplicó fuera de banda: si su `qual` no es la del repo, el preflight aborta.
  2. El conteo agregado ya pendiente.
  3. Aplicar individualmente con name `0452_portal_invoices_tenant_rls`, en baja actividad de facturas.
  4. Smoke de la lista y el detalle de facturas del Portal y de Facturación con `accounting`.
- **Coordinación con #106:** asignar al Worker de L07 el texto de «TEXTO PROPUESTO PARA LA PR #106». Lo más importante es su vuelta atrás de la 0414: hoy recrea la policy de 0085 y, con la 0452 aplicada, reabriría la fuga.
- **Integración:** comparte con #104, #105 y #106 la baseline y el índice. El driver `dtd-generated-records` los fusiona sin conflicto (medido sobre `840202bf`). Conviene integrar en serie y regenerar el índice con el script si un merge se hace sin driver.
- **Sesiones consumidoras:** ninguna. Los contenedores y la red efímeros de medición (`pfr_db`, `pfr_db_c`, `pfr_cat`, `pfr_rest`, `pfr_net_int`, y los `pfr_mut_*` y `pfr_sqltest_*`) están retirados.
- **Ownership:** `portal-facturas-rls-20260913` se libera con `node scripts/harness-worktree.mjs release` después del push y de abrir la PR; el reporte final lo confirma.
