---
sdd: "0463"
title: "Por RLS, el Portal sólo lee facturas del tenant de su vínculo"
status: done
author: "Claude"
created: 2026-09-13
updated: 2026-09-13
supersedes: null
superseded_by: null
related: ["0042", "0359", "0382"]
confidencialidad: interno
---

# SDD-0463 · Por RLS, el Portal sólo lee facturas del tenant de su vínculo

> La base deja de entregarle a un cliente del Portal, por PostgREST y con su propio JWT,
> las facturas de otra empresa que tenga un cliente con su mismo Shipping Mark. La
> migración `0452_portal_invoices_tenant_rls` reemplaza solo la policy Portal de
> `invoices` por la expresión idéntica a la de la 0414 de L07 (PR #106). Así converge con
> L07 en cualquier orden y puede aplicarse antes, sin despliegue.

## Contexto

- El Shipping Mark es único **por tenant** (`supabase/migrations/0006_clients.sql:23`).
- `invoices portal self read` (`supabase/migrations/0085_portal_invoices_rls.sql:19-26`)
  compara solo `client_markbox = public.get_portal_client_markbox()`. Esa helper
  (`supabase/migrations/0080_portal_cliente.sql:49-55`) no mira el tenant ni la baja del
  cliente.
- SDD-0462 (PR #107) cerró la exposición en la aplicación y la midió abierta en la base:
  con PostgREST efímero, `GET /invoices` con el JWT de un cliente devolvía facturas de
  otro tenant antes y después de su arreglo.
- L07 (PR #106) reemplaza esa policy en `0414_invoices_read_rbac`, líneas 62-80 de su
  archivo en la rama `codex/c-l07-fidelizacion-conversations`. Pero la 0414 es el último
  paso de su lote MIGRATE-FIRST y no se puede adelantar.
- En main, la RLS de `clients` para el Portal ya exige un vínculo activo del mismo tenant
  y el cliente vivo
  (`supabase/migrations/0430_portal_profile_change_requests_principal_tenant.sql:46-55`),
  y `client_users self or tenant read` deja leer el propio vínculo
  (`supabase/migrations/0080_portal_cliente.sql:68-70`). El `EXISTS` de la expresión
  nueva se evalúa con esas RLS, que son las del invocador.
- La 0085 figura aplicada fuera de banda en producción
  (`docs/runbooks/aplicar-migraciones-prod.md`, tabla de nombres del ledger). La forma
  exacta de su expresión en producción no está verificada.

## Alcance

- Migración `0452_portal_invoices_tenant_rls`: un único bloque `do`, sin DML.
- Contrato SQL desechable `supabase/tests/0452_portal_invoices_tenant_rls.test.sql`.
- Espera de la 0452 en `pendingBelowCutoff` de `supabase/migrations-baseline.json`.
- Fuera de alcance:
  - el código de la aplicación, que es de SDD-0462;
  - `payment_reports`, que cierra la 0420 de la PR #104;
  - los archivos de L07, incluida la 0414, y los de las PR #104, #105 y #107;
  - la helper `get_portal_client_markbox()`, que otras policies siguen usando;
  - aplicar en producción.

## Diseño

### La policy

Mismo nombre, permisiva, `for select to authenticated`, y la expresión idéntica a la de
la 0414 (sus líneas 66-79).

| Condición para que el Portal lea una factura | 0085 (main) | 0452 = 0414 |
|---|---|---|
| La factura no está borrada ni es borrador | sí | sí |
| La factura tiene Shipping Mark | sí | sí |
| Vínculo `client_users` activo del `auth.uid()` | sí, dentro de la helper | sí |
| El Shipping Mark del cliente del vínculo es el de la factura | sí, sin mirar el tenant | sí |
| El cliente del vínculo está vivo | no | sí |
| El vínculo y su cliente son del mismo tenant | no | sí |
| Ese tenant es el de la factura | no | sí |

### Un solo bloque `do`

- **Orden** en `supabase/migrations/0452_portal_invoices_tenant_rls.sql`:
  1. `set local lock_timeout = '5s'` y `statement_timeout = '60s'` (líneas 91-92);
  2. existencia de las tablas, de `auth.uid()` y del rol;
  3. `lock table public.invoices in access exclusive mode` (102);
  4. `search_path` vacío (104);
  5. preflight (106-146);
  6. reemplazo (148-172);
  7. postflight (174-201);
  8. `search_path` restaurado (203).
- **Timeouts, medidos en PostgreSQL 17.11:**
  - `lock_timeout` rige sobre el lock también en autocommit.
  - `statement_timeout` **no** acota el propio `do`, porque PostgreSQL arma ese reloj al
    empezar cada sentencia. Un `do` que lo fija en 1 s y duerme 2,5 s termina bien; en una
    transacción, la sentencia siguiente sí corta a los 1,2 s.
  - El bloque solo toca catálogo. Lo que puede tardar es la espera del lock, y esa la
    corta `lock_timeout`.
- **Comparación de expresiones:** `pg_get_expr` con `search_path` vacío y sin espacios, así
  el resultado no depende de la sesión que aplica. Las dos formas normalizadas son
  constantes del bloque.

### Preflight, que falla cerrado sin cambiar nada

1. La policy existe y es permisiva, SELECT, solo de `authenticated` y sin WITH CHECK.
2. Su expresión es la de 0085, y entonces se reemplaza, o la final, y entonces no se toca:
   NOTICE «ya tenía la forma final; sin cambios».
3. Ninguna otra policy de `invoices` usa `get_portal_client_markbox()`.

No mira las policies de equipo: vale con `invoices by tenant` de main y con las de L07.
Los mensajes llevan la regla incumplida o un conteo, nunca ids ni Shipping Marks.

### Postflight

- La policy quedó con la forma final exacta.
- Las demás policies de `invoices` quedaron idénticas, por huella md5 antes y después.

### Convergencia con L07

- **Producción, orden cronológico:** 0452 → 0407 → 0411–0413 → 0414. El preflight de la
  0414 pide sus dos policies de lectura por nombre, y su `drop` + `create` deja la misma
  expresión.
- **Rebuild, orden numérico:** 0407 … 0414 → 0452. La 0452 reconoce la forma final y no
  cambia nada.
- La condición es que las dos expresiones sigan idénticas. El contrato compara la de 0452
  con el predicado de la 0414 copiado sobre una tabla de referencia.

### Frontera

Es la misma de la 0414, que el Director aceptó como intencional en L07:

- Un vínculo activo cuyo cliente está borrado, o cuyo vínculo y cliente son de tenants
  distintos, deja de leer facturas **sin ningún mensaje de error**: cero filas.
- En la app esos principales ya no entran a las páginas del Portal. `getPortalClient`
  delega en `getPortalClientPrincipal` (`lib/portal/portal-queries.ts:125-129`) y el
  layout redirige a `/entrar` (`app/portal/(app)/layout.tsx:39`).
- La descarga del PDF por URL no pasa por el layout
  (`app/portal/(app)/facturas/[code]/pdf/route.ts:43-44` en main). Sin la PR #107, pasa
  de entregar la factura a responder 404, como midió L07 para la 0414.
- Un vínculo coherente conserva sus facturas, incluida la anulada.

## Evidencia

### Contrato SQL con control rojo

Corre como `scripts/run-sql-tests.mjs`: PostgreSQL 17.11 desechable, las migraciones reales
0080, 0430, 0085 y 0452 sobre stubs mínimos, fixtures ficticios y rollback.

| Punto | Qué defiende |
|---|---|
| 1. RED | Sin 0452, el cliente de T1 lee por RLS la factura de T2 con su Shipping Mark y el de T2 las de T1; el vínculo con cliente borrado y el incoherente leen facturas |
| 2. Estático | Un único `do`; timeouts dentro y antes del lock; lock antes del preflight y preflight antes del DDL; un solo lock, un `drop` y un `create` de esa policy; sin DML, grants, comentarios, alter ni funciones |
| 3. Drift | Policy ausente, con `anon`, restrictiva, FOR ALL, sin filtro de borradores, casi final sin cliente vivo, u otra policy con la helper: P0001 sin ids ni Shipping Marks y catálogo intacto |
| 4. Postflight | El archivo con el DDL sin el tenant de la factura, o tocando la policy de equipo, falla |
| 5. Aplicación | La transacción queda con 5 s y 60 s, y el `search_path` de la sesión no cambia |
| 6. Comportamiento | T1 lee `F-T1-0001,F-T1-0002`; T2 lee `F-T2-0001`; cliente borrado, incoherente, revocado y sin identidad leen cero; equipo y service_role, igual que antes; el Portal no escribe |
| 7. Catálogo | Expresión idéntica al predicado de la 0414 copiado; permisiva, SELECT y solo `authenticated`; ninguna policy con la helper; demás policies y filas iguales |
| 8. Idempotencia | Reaplicar deja la misma policy, con el mismo oid, y las mismas filas |

Control rojo y mutantes: 26 casos, todos con el resultado esperado.

- El original pasa.
- **Sin 0452.** Sin sus dos `\ir`, el contrato falla en el punto 5. Sin ellos y sin el
  punto 5, falla en el 6: «el cliente de T1 … leyó [F-T1-0001,F-T1-0002,F-T2-0001]».
- **Fixture.** Con el cliente de T2 bajo otro Shipping Mark, falla el RED del punto 1.
- **22 mutantes de la migración, todos en rojo:**
  - la expresión de 0085 y la expresión sin el tenant de la factura caen en el punto 4, y
    sin el punto 4 caen en el 6 con la misma lectura cruzada;
  - sin cliente vivo cae en el punto 3; sin coherencia vínculo-cliente y sin vínculo activo
    caen en el 7. En filas no se ven, porque la RLS de `clients` de la 0430 ya exige lo
    mismo para el Portal;
  - timeouts fuera del `do`, sin alguno de los dos, `lock_timeout` después del lock, lock
    después del preflight, sin lock, con DML y postflight sin forma exacta caen en el 2;
  - preflight que acepta cualquier expresión, roles de más o la helper en otra policy, y
    comparación sin `search_path` vacío, caen en el 3;
  - postflight sin huella de las demás policies cae en el 4;
  - sin restaurar el `search_path` cae en el 5, y reaplicar recreando la policy, en el 8.

### PostgREST 16.1 efímero

- **Esquema:** main reconstruido con el método de `scripts/check-schema-rebuild.mjs`, 419
  migraciones sobre PostgreSQL 17.11. Red interna y PostgREST publicado solo en
  127.0.0.1. Las únicas adaptaciones fueron que `auth.uid()` lea los claims de PostgREST y
  habilitar el rol `authenticator`.
- **Datos sintéticos:** T1 y T2, cada uno con un cliente `DTD-9901`; cinco vínculos Portal
  (coherente en T1, coherente en T2, con cliente borrado en T1, incoherente con vínculo en
  T2 y cliente en T1, y revocado) y un usuario `accounting` de T1.
- **Aplicación:** la 0452 con `psql --single-transaction`, como `apply_migration`.

`GET /invoices?select=invoice_code,tenant_id,client_markbox,client_name,client_rif,total_amount,status`:

| JWT | Antes (main) | Después (0452) |
|---|---|---|
| Portal T1, vínculo coherente | 200 · 5 filas: sus 3 y **2 de T2** (`F-2026-0001` y `F-T2-0009`, con nombre, RIF y totales 250 y 777) | 200 · sus 3 filas |
| Portal T2, vínculo coherente | 200 · 5 filas: sus 2 y **3 de T1** | 200 · sus 2 filas |
| Portal con cliente borrado | 200 · 1 fila | 200 · 0 filas |
| Portal incoherente (vínculo T2, cliente T1) | 200 · 1 fila, de T1 | 200 · 0 filas |
| Portal revocado | 200 · 0 filas | 200 · 0 filas |
| Equipo T1 (`accounting`) | 200 · 6 filas de T1 | 200 · las mismas 6 |
| anon | 401 · 42501 | 401 · 42501 |
| service_role | 200 · 9 filas | 200 · 9 filas |

### Convergencia con L07

L07 tomada de la PR #106 en `c09b5155`. Cada escenario parte de una copia de la base
sembrada y aplica cada migración con `--single-transaction`. El md5 es el del catálogo de
policies de `invoices` (nombre, comando, roles, USING y WITH CHECK), con el mismo cálculo
de SDD-0462.

| Escenario | Secuencia | Resultado | md5 del catálogo | md5 de la policy Portal |
|---|---|---|---|---|
| main | — | — | `6a7f22fb9b4d93198cdc71002195ae47` | `eb6108542378105a4b34631f9f0c904a` |
| (a) main + 0452 | 0452 | reemplaza | `97d3ae96a41f0bea5f7a11a152ccd80f` | `fd8dddf9c2906545230ef715274680d5` |
| (a) reaplicada | 0452 → 0452 | la segunda no cambia nada | `97d3ae96a41f0bea5f7a11a152ccd80f` | `fd8dddf9c2906545230ef715274680d5` |
| (b) cronológico, producción | 0452 → 0407 → 0411 → 0412 → 0413 → 0414 | completa; el preflight de la 0414 pasa | `345b2d1080a2e87e93639f2f0be8b28b` | `fd8dddf9c2906545230ef715274680d5` |
| (c) numérico, rebuild desde cero con L07 | 425 migraciones en orden `LC_ALL=C`, la 0414 antes que la 0452 | completa; la 0452 «ya tenía la forma final; sin cambios» | `345b2d1080a2e87e93639f2f0be8b28b` | `fd8dddf9c2906545230ef715274680d5` |
| Referencia: PR #106 sola | 0407 → 0411 → 0412 → 0413 → 0414 | completa | `345b2d1080a2e87e93639f2f0be8b28b` | `fd8dddf9c2906545230ef715274680d5` |

- (b), (c) y la referencia coinciden también con `permissive`, los comentarios de las
  policies y el comentario de la tabla.
- (a) no puede tener el catálogo completo de (b) y (c), porque no trae las policies de
  equipo de L07. Frente a main, (a) solo cambia la policy Portal: el resto de las policies,
  la ACL, el comentario de la tabla y las filas dan el mismo md5.
- En todos los escenarios con 0452 o 0414, los clientes Portal leen lo mismo: T1 sus 3,
  T2 sus 2, y el de cliente borrado y el incoherente, cero.

### Locks y contención

PostgreSQL 17.11 local, encima de todo main sembrado:

| Caso | Locks retenidos hasta el COMMIT | Duración |
|---|---|---|
| Reemplazo (forma 0085) | ACCESS EXCLUSIVE sobre `invoices`; ACCESS SHARE sobre `client_users` y `clients` | 6,9 ms |
| Sin cambios (forma final, después de L07) | Los mismos: el deparse de `pg_get_expr` también toma ACCESS SHARE sobre las tablas que nombra la expresión | 4,9 ms |

Contención, con un lector que retenía `invoices` 15 s:

- con `--single-transaction` y en autocommit, la 0452 cortó a los 5,2 s en su
  `lock table` con `canceling statement due to lock timeout`;
- se revirtió entera: la policy siguió en la forma de 0085;
- un lector nuevo que llegó 1 s después de la migración esperó 4,2 s y terminó normal;
- el lector que retenía `invoices` terminó sin cambios, a los 15,2 s.

## Coordinación con las PR abiertas

- **#106 (L07):** su SQL no cambia. Cuando la 0452 esté aplicada, su espera de la 0414 y su
  sección «Frontera del Portal al aplicar 0414» describen como nuevo algo que ya rige. El
  texto propuesto está en el handoff, para que el Director se lo asigne al Worker de L07.
- **#107 (SDD-0462):** complementaria. Allí va la capa de aplicación y acá la de RLS.
- El detalle de `git merge-tree` contra #104, #105, #106 y #107 queda en el handoff.

## Datos personales (`revisar-datos-ve`)

No es asesoría legal.

| Campo | Qué es | Quién lo leía de más por PostgREST |
|---|---|---|
| `invoices.client_name`, `client_rif` y `client_doc_kind` | Identidad fiscal de una persona natural o jurídica | El cliente Portal de otro tenant con el mismo Shipping Mark, y el vínculo con cliente borrado o incoherente |
| `invoices.total_amount`, `paid_amount`, `lines`, `notes` y `shipment_code` | Datos económicos y detalle de la mercancía; `notes` es texto libre | Ídem |

Hallazgos, sobre los de SDD-0462:

1. **ENCONTRADO en main; esta SDD lo corrige (hallazgo 3 de SDD-0462).**
   `supabase/migrations/0085_portal_invoices_rls.sql:19-26` permite esa lectura por
   PostgREST. Normas: CRBV art. 28, acceso a los datos propios y a conocer su uso y
   finalidad; y CRBV art. 60, confidencialidad y vida privada.
2. **CORRECTO, en local.** `supabase/migrations/0452_portal_invoices_tenant_rls.sql:150-168`
   limita la lectura al tenant del vínculo, medido con PostgREST y datos sintéticos. En
   producción sigue abierto hasta aplicar la 0452 o la 0414.
3. **CORRECTO.** La migración no agrega campos, columnas, logs ni tratamientos. Sus mensajes
   de error no llevan ids ni Shipping Marks (contrato, punto 3). La medición usó solo datos
   sintéticos, sin ninguna lectura de producción.
4. **NO VERIFICABLE: si la exposición ocurrió en producción.** Hacen falta el conteo agregado
   de Shipping Marks repetidos entre tenants con vínculo Portal activo y facturas no
   borrador, que el Director tiene pendiente con Sam, y, si es mayor que cero, los registros
   de acceso de la API con retención suficiente.
5. **De otro dueño:** `payment_reports` por Shipping Mark
   (`supabase/migrations/0195_payment_reports.sql:119-125`), que cierra la 0420 de la
   PR #104 (hallazgo 4 de SDD-0462).

## Allowlist exacta

- `supabase/migrations/0452_portal_invoices_tenant_rls.sql`
- `supabase/tests/0452_portal_invoices_tenant_rls.test.sql`
- `supabase/migrations-baseline.json`: solo la espera `0452_portal_invoices_tenant_rls` en
  `pendingBelowCutoff`.
- `docs/specs/0463-portal-facturas-rls/spec.md`
- `docs/specs/README.md`: generado por `node scripts/build-docs-index.mjs`.
- `.agents/handoffs/portal-facturas-rls.md`

## Aceptación

- [x] `0452_portal_invoices_tenant_rls` reemplaza solo `invoices portal self read`: mismo
      nombre, permisiva, SELECT, solo `authenticated` y la expresión idéntica a la de la
      0414 de L07.
- [x] Un único bloque `do` con `lock_timeout` de 5 s y `statement_timeout` de 60 s, lock,
      preflight que falla cerrado salvo con la forma de 0085 o la final, DDL y postflight de
      forma exacta. Idempotente y sin DML.
- [x] Contrato SQL con el RED sin 0452, el comportamiento con 0452, la frontera de vínculos
      con cliente borrado o incoherentes, drift, postflight, la aserción estática de los
      timeouts dentro del `do`, catálogo e idempotencia. Control rojo demostrado y los 22
      mutantes en rojo.
- [x] Convergencia medida en PostgreSQL 17 en los tres escenarios, más la referencia de la
      PR #106 sola.
- [x] `GET /invoices` por PostgREST 16.1 con JWT sintéticos, antes y después.
- [x] Locks y contención medidos.
- [x] Espera en `supabase/migrations-baseline.json`, sin tocar el `cutoff` ni las demás
      esperas.
- [x] Revisión de datos personales, con lo no verificable declarado.
- [x] Ningún archivo propio de las PR #104 a #107. Solo se comparten los registros comunes:
      `docs/specs/README.md` con las cuatro y `supabase/migrations-baseline.json` con #104,
      #105 y #106.

`pnpm verify`, con su veredicto por paso y el HEAD verificado, queda registrado en el handoff.

## Producción

`0452_portal_invoices_tenant_rls` no está aplicada, y `done` en esta spec no significa
aplicada.

- Aplicarla exige el OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`: de a
  una, con el name exacto y en baja actividad de facturas.
- Antes, con su autorización, hay que leer el catálogo de policies de `invoices`, sin filas.
  La 0085 se aplicó fuera de banda: si su expresión en producción no es la del repo, el
  preflight aborta y hay que revisar antes de aplicar.
- Se recomienda aplicarla **antes** de L07. No depende de ningún despliegue.
- La espera en `pendingBelowCutoff` lleva el impacto de locks, la lectura previa y el smoke.
  Se retira únicamente tras la aplicación y la verificación autorizadas.

Gobernanza:

- **No conformidad** de aislamiento multi-tenant en la base, corregida localmente y
  verificada en PostgreSQL y PostgREST efímeros. En producción queda NO VERIFICABLE hasta
  aplicar.
- Sin cambio visual ni de mensajes: `/ui-check` no aplica.
