---
sdd: "0466"
title: "Helpers del Portal por principal, deterministas y sin cruce de tenant"
status: done
author: "Claude"
created: 2026-09-14
updated: 2026-09-14
supersedes: null
superseded_by: null
related: ["0042", "0085", "0138", "0354", "0372", "0377", "0382", "0461", "0463"]
confidencialidad: interno
---

# SDD-0466 · Helpers del Portal por principal, deterministas y sin cruce de tenant

> Tres funciones SQL de las que cuelga la identidad del ERP resolvían con `limit 1` sin orden o
> sin mirar el principal: `get_user_tenant_id()`, `get_portal_client_markbox()` y el trigger
> `client_delivery_addresses_validate_client()`. La migración `0453_portal_helpers_principal_determinista`
> las redefine para que resuelvan por una regla explícita o fallen cerrado, sin tocar policies,
> ACL, tablas ni la aplicación.

## Contexto

- **`get_user_tenant_id()`** (`supabase/migrations/0200_rbac_disabled_enforcement.sql:50-62`) toma
  la primera membresía activa con `limit 1` sin `order by`. `user_tenants` admite N membresías
  por usuario (PK `(user_id, tenant_id)`, `supabase/migrations/0001_init_tenancy.sql:28`;
  «preparada para N:M»). Con dos membresías activas, el tenant que gobierna ~480 policies
  «`<tabla>` by tenant» y las RPC de 0411, 0412 y 0413 es el que el planificador encuentre
  primero. No hay claim de tenant en el JWT (la única lectura de `auth.jwt()` en las migraciones
  es el `aal` de 0270) ni selector de tenant en la aplicación; `getStudioAccess`
  (`lib/studio/rbac-guard.ts:72-78`) toma su propia fila de `user_tenants` con `limit(1)`, así
  que la fila que la aplicación cree y la que la base usa podrían ser distintas.
- **`get_portal_client_markbox()`** (`supabase/migrations/0080_portal_cliente.sql:49-55`) devuelve
  el Shipping Mark del cliente del vínculo activo sin comprobar que el cliente viva ni que
  vínculo y cliente sean del mismo tenant. El Shipping Mark es único **por tenant**
  (`supabase/migrations/0006_clients.sql:23`): un vínculo incoherente (vínculo en T1, cliente en
  T2) o con cliente borrado obtiene un Shipping Mark, y por las policies que comparaban sólo ese
  valor (`shipments portal self read` de 0080, entre otras) leía filas de otro tenant. Las
  migraciones de frontera del Portal por principal y tenant reemplazaron esas policies (0416 la
  de envíos y 0452 la de facturas, entre otras): sobre el schema de main reconstruido ninguna
  policy ni función nombra ya la helper. Lo que queda es la RPC, que sigue entregándoles ese
  Shipping Mark a los lectores y las acciones del Portal. Además usa `limit 1` sin orden: hoy
  `unique (auth_user_id)`
  (`0080_portal_cliente.sql:30`) impide dos vínculos por usuario, y ninguna migración la retiró
  (verificado sobre `supabase/migrations/*.sql`; el handoff `c-l02-portal-visibilidad`, hallazgo
  13, ya había anotado que esa garantía vive en otra migración y nadie la declara donde se usa).
  Si se retira, cuatro o más funciones del Portal se vuelven no deterministas en silencio.
- **`client_delivery_addresses_validate_client()`**
  (`supabase/migrations/0198_client_delivery_addresses.sql:125-152`) sella `tenant_id` y
  `client_markbox` desde `clients` por `client_id` sin mirar el principal. Con RLS, la 0425 y la
  policy de equipo ya exigen vínculo coherente o membresía; pero cuando la RLS no aplica (dueño
  de la tabla, comandos SECURITY DEFINER como `merge_clients`, `rename_client_markbox` o el de
  0427, `service_role`) el trigger es la última defensa y acepta cualquier cliente vivo: un
  vínculo de otro tenant o con cliente borrado escribe direcciones de un cliente que no es suyo.
- Producción tiene un solo tenant según el conteo autorizado del 2026-09-13. La lectura agregada
  que autorizó Sam el 2026-09-14, sin ids ni datos, dio 0 usuarios con más de una membresía
  activa, 1 vínculo `client_users` activo cuyo cliente está borrado y 0 vínculos activos con
  tenant distinto al de su cliente: la frontera es preventiva para las membresías y los tenants,
  y correctiva para ese vínculo.
- La lectura de catálogo del mismo día, sin filas, encontró una deriva: producción corre el
  cuerpo de 0198 **sin su comentario interno** de tres líneas, con md5(prosrc)
  `7db6f812a549df579f2d7d0d6cd72298`, `search_path=public` y ACL
  `{postgres=X/postgres,service_role=X/postgres}`. Con ese cuerpo, el preflight de la ronda 3
  abortaba. Los otros dos coinciden con 0200 y 0080.

## Alcance

- Migración `0453_portal_helpers_principal_determinista`: redefine sólo las tres funciones con
  `create or replace`, con preflight que falla cerrado y postflight de catálogo. Sin DML, grants,
  policies, tablas, índices ni triggers nuevos.
- Contrato SQL desechable `supabase/tests/0453_portal_helpers_principal_determinista.test.sql`.
- Esta spec, el índice generado y el handoff de la tarea.
- `supabase/migrations-baseline.json`, únicamente para declarar la espera
  `0453_portal_helpers_principal_determinista` en `pendingBelowCutoff` (sin subir el `cutoff`
  238 ni tocar las otras esperas), porque el gate `migrations-applied` lo exige hasta que la
  migración se aplique. El gate de símbolos pendientes sigue sin exigir declaración: la 0453 no
  crea símbolos y da 0 ROJO · 0 AMARILLO.
- Fuera de alcance:
  - `app/` y `lib/`: cero cambios; los consumidores que convendría ajustar se reportan en el
    handoff como FUERA DE ALCANCE;
  - `current_studio_role()` (`0200:70-82`), `get_portal_client_id()` (`0080:40-45`),
    `get_portal_client_tenant()` (`0105:44-49`) y `get_portal_person_id()` (`0187:28-40`), que
    comparten el `limit 1` y quedan para su propia tarea;
  - las policies del Portal, que ya no usan la helper: sobre el schema de main reconstruido,
    cero policies y cero funciones la nombran, así que la 0453 no cambia ninguna lectura por RLS;
  - aplicar en producción.

## Diseño

### La regla

| Función | main (0200 / 0080 / 0198) | 0453 |
|---|---|---|
| `get_user_tenant_id()` | primera membresía activa, `limit 1` sin orden | el tenant de la **única** membresía activa; con cero o con más de una, `NULL` |
| `get_portal_client_markbox()` | Shipping Mark del cliente del primer vínculo activo, sin tenant ni `deleted_at` | el Shipping Mark del **único** vínculo activo cuyo cliente vive y comparte tenant con el vínculo; con cero o con más de uno, `NULL` |
| `client_delivery_addresses_validate_client()` | cliente vivo por `client_id`; sella tenant y Shipping Mark | igual, y además: si hay principal (`auth.uid()`), tiene que ser **miembro activo del tenant del cliente** o **titular del Portal de ese cliente por un vínculo activo del mismo tenant**; si no, `42501`. Sin principal (lotes, `service_role`, backfill de 0198) conserva el sellado |

Con una sola membresía activa y un vínculo coherente, las tres devuelven exactamente lo que
devolvían: el contrato lo prueba sobre la RPC real de 0411 y sobre las policies reales de
0006, 0080, 0198, 0230 y 0425.

### Por qué `NULL` y no una elección

- No existe un dato de sesión que diga «en qué tenant está trabajando» este usuario: el JWT no
  trae tenant y la aplicación no tiene selector. Cualquier orden (`created_at`, `tenant_id`)
  sería una elección silenciosa que además podría no coincidir con la fila que
  `getStudioAccess` toma por su cuenta: la interfaz diría «tenant B» y la base filtraría por A.
- `NULL` cierra todo de forma visible y verificable: `tenant_id = NULL` es falso en cada policy,
  las RPC de 0411-0413 responden `42501` y los comandos que empiezan por
  `get_user_tenant_id()` (por ejemplo `portal_invite_client`, `studio_set_user_disabled`)
  rechazan. Es el mismo criterio de fail-closed de 0200 para una membresía desactivada.
- Para el Portal, «vínculo activo del tenant del principal» es exactamente la frontera que
  0430 y 0452 ya aplican por RLS (vínculo activo, cliente vivo, mismo tenant). La helper deja de
  contradecirlas. El caso de dos vínculos es hoy imposible por `unique (auth_user_id)`; la función
  ya no depende de esa garantía, y la spec la declara donde se usa.
- El trigger no tiene la ambigüedad de la helper: el tenant del cliente es concreto, y la
  membresía se verifica contra ese tenant. Por eso un miembro activo de dos tenants sí puede
  escribir sin RLS en cualquiera de los dos (el contrato lo prueba); lo que no puede es escribir
  quien no es miembro de ese tenant ni titular de ese cliente.

### El trigger, caso por caso (sin RLS: dueño de la tabla o comando SECURITY DEFINER)

| Principal | Cliente de la dirección | main | 0453 |
|---|---|---|---|
| vínculo activo en T1 → cliente de T2 (incoherente) | ese cliente de T2 | acepta, sella T2 | `42501` |
| vínculo activo con cliente borrado | otro cliente vivo de T1 | acepta | `42501` |
| miembro activo de T1 | cliente de T2 | acepta, sella T2 | `42501` |
| titular de A | cliente B del mismo tenant | acepta | `42501` |
| titular de T2 con el mismo Shipping Mark | cliente de T1 | acepta | `42501` |
| membresía desactivada, vínculo revocado, sin vínculo | cualquiera | acepta | `42501` |
| titular de A | su cliente A, `tenant_id`/Shipping Mark forjados | sella | sella (igual) |
| miembro activo de T1 | cliente de T1; mover una dirección entre clientes de T1 | sella | sella (igual, camino de `merge_clients` y `rename_client_markbox`) |
| miembro activo de T1 y T2 | cliente de T1 o de T2 | sella | sella (membresía contra el tenant concreto) |
| sin principal (`service_role`, lotes) | cualquiera | sella | sella (igual) |
| cualquiera | cliente inexistente o borrado | `23514` con el uuid en el mensaje | `23514` sin el uuid |

Con RLS (sesión del Portal o del Studio) los resultados no cambian: el trigger corre antes de la
`WITH CHECK` y rechaza con el mismo `42501` que ya devolvían 0425 y «by tenant».

### La migración

`supabase/migrations/0453_portal_helpers_principal_determinista.sql`, con la forma de 0422:

1. `set lock_timeout = '5s'` y `set statement_timeout = '30s'` de sesión al inicio del archivo.
2. `do $preflight$`, que falla cerrado con `P0001` y mensajes sin ids ni Shipping Marks:
   - `auth.uid()` y los roles `authenticated` y `anon` existen;
   - `user_tenants`, `client_users`, `clients` y `client_delivery_addresses` con RLS y las
     columnas que las funciones nombran;
   - las tres funciones existen con su forma: retorno, lenguaje, `SECURITY DEFINER`,
     volatilidad (`stable` las helpers, `volatile` el trigger) y ACL (`authenticated` ejecuta
     las helpers y no la función del trigger, y `anon` no ejecuta ninguna; el resto de la ACL,
     como `service_role` en producción, no se exige y la huella la conserva);
   - el cuerpo normalizado (sin espacios) de cada una es el histórico de 0200 / 0080 / 0198 o
     el final de 0453. Para la función del trigger acepta además la **forma Cloud** de 0198, el
     mismo cuerpo sin su comentario interno, que corre en producción: la constante
     `c_validate_0198_cloud` es la lectura del 2026-09-14 carácter por carácter, como 0423 acepta
     el cuerpo de 0195 del repo o de Cloud. Cualquier otro cuerpo aborta para revisar antes de
     aplicar;
   - el trigger `client_delivery_addresses_validate_trg` está vivo: `BEFORE INSERT OR UPDATE
     FOR EACH ROW`, habilitado y apuntando a la función;
   - guarda en un GUC de sesión la huella md5 del catálogo dependiente: oid, dueño, ACL y
     `SECURITY DEFINER` de las tres funciones; oid, cuerpo, ACL y `proconfig` de toda función
     de `public` que nombre las helpers; toda policy que las nombre; y los triggers de la tabla.
3. Tres `create or replace function` con sus `comment on function`. `create or replace`
   conserva oid, dueño y ACL, y el trigger sigue apuntando a la misma función. Las tres quedan
   con `search_path = ''` y nombres calificados; `(select auth.uid())` para el caching por query
   de 0012.
4. `do $postflight$`: cuerpos finales exactos, `SECURITY DEFINER`, volatilidad y `search_path`
   vacío; la huella del catálogo dependiente idéntica; y, sin principal, las dos helpers
   devuelven `NULL`.
5. `reset statement_timeout` y `reset lock_timeout`.

Idempotente: reaplicada sobre la forma final no cambia nada (mismo oid, misma huella).

### Locks y tiempos (PostgreSQL 17.11 local, schema completo con la forma de producción)

Medido sobre las 431 migraciones de main sin la 0453 (603 policies), con los tres cuerpos y las
ACL que se leyeron en producción el 2026-09-14 y la migración en su propia transacción:

- Locks retenidos hasta el COMMIT: sólo `AccessShareLock` sobre tablas del producto, 19 tablas y
  28 índices. `clients`, `client_users` y `user_tenants` los toma el smoke del postflight; el
  resto (`shipments`, `prealertas`, `client_claims`, `documents`, `dispatch_orders`, `academy_*`
  y otras) los toma el deparse con `pg_get_expr` de la huella, sobre las tablas que nombran las
  subconsultas de las policies. En catálogos, `RowExclusiveLock` sobre `pg_description` por los
  comentarios. **Ningún lock hace esperar lecturas ni escrituras.**
- Contención: con otra sesión reteniendo `ACCESS EXCLUSIVE` sobre `clients`, como haría un DDL
  concurrente, la 0453 cortó a los 5,0 s por `lock_timeout` en la huella del preflight, se
  revirtió, las tres funciones quedaron intactas y los timeouts de la sesión volvieron a 0.
- Duración: de 63 a 89 ms la aplicación (tres corridas) y de 67 a 68 ms la reaplicación.
- Corrección de las rondas 1 a 3, que decían «sólo `AccessShareLock` sobre `clients`,
  `client_users` y `user_tenants`; 26,6 ms»: se había medido sobre el fixture mínimo del
  contrato, sin policies con subconsultas, y no representaba producción.
- Las sesiones en curso adoptan la definición nueva cuando se invalida su caché de planes; las
  policies no se reescriben porque referencian la función por oid.

### Frontera e impacto en la aplicación

- **Usuario con dos membresías activas** (0 en la lectura agregada del 2026-09-14): con 0453 no ve filas en
  ninguna tabla «by tenant», no puede insertar ni actualizar, y las RPC responden `42501`;
  `getUserTenantId()` (`lib/auth/session.ts:31-36`) devuelve `null`. `getStudioAccess`
  (`lib/studio/rbac-guard.ts:72-78`) seguiría devolviendo un rol por su propio `limit(1)`, así
  que el usuario vería el Studio vacío en lugar de un mensaje claro. Es el estado seguro; el
  mensaje claro es un cambio de aplicación fuera de este alcance y queda reportado.
- **Vínculo del Portal incoherente o con cliente borrado** (el 2026-09-14 había 1 con cliente
  borrado y 0 incoherentes): `get_portal_client_markbox()` le devuelve `NULL`. En el schema de
  main ninguna policy ni función nombra ya la helper, así que no cambia ninguna lectura por RLS.
  Cambia la RPC que usan los lectores del Portal, que con `NULL` devuelven vacío
  (`lib/portal/portal-queries.ts:173-174`, entre otros), y sus acciones, que responden «Tu sesión
  expiró. Vuelve a entrar.» sin escribir (`app/portal/(app)/proveedores/actions.ts:326-327`,
  `app/portal/(app)/academia/actions.ts:39-40`). En la app ese principal ya no entra:
  `resolvePortalClientPrincipal` devuelve `null` si el cliente del vínculo está borrado
  (`lib/portal/portal-queries.ts:89-95`) y el layout lo manda a `/entrar`
  (`app/portal/(app)/layout.tsx:39-40`).
- **Escrituras de direcciones sin RLS:** los tres escritores SECURITY DEFINER de producción
  (`merge_clients` 0361, `rename_client_markbox` 0371 y `delete_delivery_address` 0427) validan
  antes la membresía o el vínculo del principal contra el tenant del cliente; el trigger nuevo
  vuelve a exigir lo mismo y los tres pasan (el contrato ejecuta el de 0427 real y reproduce las
  primitivas de los otros dos). `service_role` sin JWT (cron, seeds, backfill) conserva el sellado.

## Evidencia

Todo sobre PostgreSQL 17.11 en Docker 29.7.2, con fixtures sintéticos y rollback; las cifras y
los recibos están en `.agents/handoffs/portal-helpers-principal-determinista.md`.

### Contrato SQL con control rojo

`supabase/tests/0453_portal_helpers_principal_determinista.test.sql` corre como
`scripts/run-sql-tests.mjs`. Aplica las migraciones reales 0006, 0080, 0081, 0198, 0230, 0347,
0425, 0411, 0258, 0261, 0267, 0294 y 0427 sobre stubs mínimos, y toma `get_user_tenant_id()` y
`current_studio_role()` del propio archivo 0200 por regexp, así el RED corre contra las
definiciones de main. 119 aserciones.

| Punto | Qué defiende |
|---|---|
| 1. RED | Sin 0453: con dos membresías `get_user_tenant_id()` eligió un tenant y «clients by tenant» mostró 5 filas de ese tenant; el vínculo con cliente borrado obtuvo Shipping Mark y leyó 1 envío; el incoherente (vínculo en A, cliente en B) leyó 2 envíos `DUP`, uno por tenant; con la unique retirada y dos vínculos activos la helper eligió uno; sin RLS, el vínculo de otro tenant, el de cliente borrado, el equipo de otro tenant y el titular de otro cliente escribieron direcciones, también por un comando SECURITY DEFINER real |
| 2. Estático | Timeouts de sesión antes del preflight; preflight → tres `create or replace` → postflight → `reset`; exactamente tres funciones y tres comentarios; sin DML, grants, policies, triggers, tablas, índices, locks ni `ALTER`; bloques `do` cerrados |
| 3. Huellas | Las formas históricas que acepta el preflight coinciden con las definiciones reales de 0200, 0080 y 0198 |
| 3b. Forma de producción | En un savepoint: el cuerpo de 0198 sin su comentario (construido desde el archivo real), `search_path=public`, las ACL exactas y los dos triggers de producción coinciden con el literal de la lectura del 2026-09-14, copiado en el contrato y no tomado de la migración. El preflight acepta, la 0453 deja las tres formas finales y conserva las ACL exactas y el trigger, y `c_validate_0198_cloud` es esa lectura carácter por carácter. Un cuerpo casi Cloud, sin el filtro de cliente vivo, aborta en el preflight con «0453 abortada: el cuerpo de client_delivery_addresses_validate_client()…» y no toca el catálogo |
| 4. Drift (13 casos) y postflight | Trigger ausente o deshabilitado; cuerpo desconocido en cada una de las tres; sin `SECURITY DEFINER`; `anon` con EXECUTE, `authenticated` sin EXECUTE en la helper o con EXECUTE en la función del trigger; `client_users` sin RLS; `disabled_at` renombrada; `auth.uid()` ausente: `P0001` **en el preflight** («0453 requiere…» / «0453 abortada…»), sin uuid ni Shipping Marks, y catálogo intacto. El bloque del postflight, ejecutado solo con una huella sintética, rechaza con «0453: cambió el catálogo dependiente…» |
| 5. Aplicada | Timeouts restaurados; policies, funciones dependientes, trigger y ACL de tablas idénticos; las tres funciones conservan oid, dueño, ACL, `SECURITY DEFINER` y volatilidad y quedan con `search_path` vacío; filas idénticas; reaplicar no cambia nada |
| 6. Comportamiento | Una membresía activa (o una activa y otra desactivada) resuelve su tenant y la RPC 0411 responde `DUP=1000,OTHER=250` para A y `DUP=777` para B; dos membresías → `NULL`, cero clientes, direcciones y facturas, `INSERT` en `42501`, `UPDATE` sobre cero filas y la RPC en `42501`. Vínculo coherente → su Shipping Mark; borrado, incoherente, revocado, invitado, equipo, sin vínculo o sin identidad → `NULL` y cero envíos; dos vínculos activos → `NULL`, y al revocar el segundo vuelve a resolver. El trigger sin RLS rechaza con `42501` los ocho cruces de la tabla y acepta con sellado al equipo del tenant, al titular, al miembro de dos tenants y a las escrituras sin principal; `23514` sin uuid para el cliente borrado; el comando DEFINER real repite los rechazos y aceptaciones; los caminos con RLS no cambian; el comando 0427 borra la dirección propia con un solo evento y sigue rechazando al incoherente y al de cliente borrado; el renombre de Shipping Mark por el equipo pasa el trigger y la helper lo sigue |

### Control rojo y mutantes

- **Control rojo** (`-v apply_fix=false`): el contrato falla en la primera aserción de
  comportamiento, «Dos membresías activas → NULL (fail-closed), ya no un tenant cualquiera».
- **Mutantes de la migración:** 30, generados sobre una copia del archivo y corridos contra el
  contrato con el original restaurado y verificado por sha256 después de cada uno; los dos
  controles con el original en verde. Los de cuerpo recalculan la huella final en preflight y
  postflight, para que sea el comportamiento quien los delate.
  - Cuerpos (15), todos muertos: tenant sin `having` o sin `disabled_at`; Shipping Mark sin
    tenant coherente, sin cliente vivo, sin `having` o sin `status = 'active'`; trigger sin el
    chequeo de principal, membresía sin `disabled_at`, vínculo sin tenant, sin `client_id` o sin
    `status`, sin cliente vivo, con el uuid en el mensaje, con `check_violation` en vez de
    `insufficient_privilege`, y sin sellado.
  - Estructura y preflight (15): sin `lock_timeout`, `statement_timeout` distinto, sin `reset`,
    preflight sin chequeo del trigger, de cuerpos (tres), de ACL, de forma, de RLS o de columnas,
    helper con `search_path = public`, helper sin `SECURITY DEFINER`, migración con `grant` a
    `anon`, postflight sin huella. En la primera serie sobrevivieron dos: «preflight sin chequeo
    de forma», porque la huella del postflight atrapaba igual el drift y el contrato aceptaba
    cualquier «0453…» como rechazo; y «postflight sin huella», que no era observable. El contrato
    se endureció (el drift debe rechazarse en el preflight, y el bloque del postflight se ejecuta
    solo con una huella sintética) y los dos murieron. Resultado final: 30 de 30.
- **Ronda 4, control rojo sobre la versión anterior:** con la 0453 de la ronda 3 (`d224613d`),
  el contrato nuevo aborta en el caso de producción con «0453 abortada: el cuerpo de
  client_delivery_addresses_validate_client() no es el de 0198 ni el final», el mismo mensaje
  que midió el Director en producción. Tres mutantes nuevos, todos muertos en ese preflight: la
  condición sin la forma Cloud, la constante Cloud igual a la de 0198 del repo y la constante
  Cloud sin el filtro de cliente vivo. La serie completa (30, más los 3 y la versión de la
  ronda 3) dio 34 de 34, con los dos controles en verde.
- **El md5 de producción no se reproduce en local.** Ninguna versión de 0198 en git
  (`2678d4f2`, `f27f4941`) carece del comentario, y 1152 variantes de espacios, sangría, líneas
  en blanco, bordes y fin de línea sobre el archivo sin comentario no dan `7db6f812…`: el texto de
  producción difiere también en espacios. Por eso el preflight y el contrato comparan la forma
  normalizada, que sí coincide.
- **Sobre el schema completo reconstruido** con la forma y las ACL de producción: la 0453 de la
  ronda 3 aborta con ese mismo mensaje y la de la ronda 4 aplica, deja las tres formas finales y
  conserva las ACL exactas.

### Gates

`corepack pnpm sdd:check` sin números repetidos; `scripts/check-pending-migration-symbols.mjs`
0 ROJO · 0 AMARILLO sin declaración, porque la 0453 no crea símbolos: redefine tres nombres que
ya existen y que el código ya consume. `pnpm verify` con su veredicto por paso queda en el
handoff.

## Datos personales (`revisar-datos-ve`)

No es asesoría legal.

- **ENCONTRADO en main; esta SDD lo corrige.** `get_portal_client_markbox()` le entrega un
  Shipping Mark a un vínculo del Portal incoherente o con cliente borrado
  (`0080_portal_cliente.sql:49-55`). Por RLS ya no expone filas: las policies que lo usaban para
  leer envíos de otro tenant, como la de `0080_portal_cliente.sql:79-85`, se reemplazaron y en
  main ninguna lo nombra. Sin RLS, el trigger dejaba crear direcciones postales bajo un cliente
  que no es suyo (`0198_client_delivery_addresses.sql:125-152`).
  Normas de referencia: CRBV art. 28 (acceso a los datos propios y conocer su uso) y art. 60
  (confidencialidad y vida privada).
- **CORRECTO, en local.** La 0453 devuelve `NULL` a esos vínculos y el trigger rechaza al
  principal que no es miembro ni titular, medido en PostgreSQL efímero con datos sintéticos.
  En producción sigue abierto hasta aplicar.
- **CORRECTO.** La migración no agrega campos, columnas, logs ni tratamientos. Sus mensajes no
  llevan ids ni Shipping Marks; el mensaje de cliente borrado deja de incluir el uuid que 0198
  incluía. No se leyó ninguna fila de producción.
- **Conteos del 2026-09-14,** agregados, autorizados por Sam y sin ids ni datos: 0 vínculos
  activos con tenant distinto al de su cliente y un solo tenant, así que a esa fecha el cruce
  entre tenants no era posible en producción; 1 vínculo activo con cliente borrado, al que la
  helper le entregaba el Shipping Mark de su propio cliente borrado, del mismo tenant.
- **NO VERIFICABLE:** si ese principal llegó a usar ese valor. Haría falta revisar registros de
  acceso de la API con retención suficiente; no se pidieron ni se leyeron.

## Allowlist exacta

- `supabase/migrations/0453_portal_helpers_principal_determinista.sql`
- `supabase/tests/0453_portal_helpers_principal_determinista.test.sql`
- `docs/specs/0466-portal-helpers-principal-determinista/spec.md`
- `docs/specs/README.md`: generado por `node scripts/build-docs-index.mjs`.
- `supabase/migrations-baseline.json` (únicamente la espera `0453_portal_helpers_principal_determinista`
  en `pendingBelowCutoff`, sin subir el `cutoff` 238 ni tocar las otras esperas).
- `.agents/handoffs/portal-helpers-principal-determinista.md`

## Aceptación

- [x] Contrato SQL que reproduce el cruce contra `client_delivery_addresses_validate_client()`
      (vínculo de otro tenant y cliente borrado), rojo sobre main y verde con 0453.
- [x] Contrato SQL que muestra qué devuelven `get_portal_client_markbox()` y
      `get_user_tenant_id()` con dos vínculos o dos membresías; la corrección devuelve `NULL`
      fail-closed y elige el único vínculo activo coherente; esta spec documenta la regla y por qué.
- [x] La RPC real de 0411 y las policies reales que dependen de `get_user_tenant_id()`
      conservan su comportamiento con un solo vínculo; postflight de catálogo en la migración;
      los contratos existentes de 0411, 0412 y 0413 y el barrido multi-tenant de la
      reconstrucción quedan en verde según el handoff.
- [x] Cero cambios en `app` y `lib`; los consumidores que convendría ajustar están en el
      handoff como FUERA DE ALCANCE.
- [x] Migración única 0453 con timeouts de sesión, preflight que falla cerrado y postflight;
      idempotente y sin DML. Locks, contención y tiempos medidos sobre el schema completo.
- [x] Control rojo y mutantes con el resultado esperado.
- [x] Ronda 4: el preflight acepta la forma Cloud de 0198 medida en producción el 2026-09-14 y
      ninguna otra. El contrato lo prueba con la forma y las ACL de producción, con un cuerpo
      casi Cloud que aborta, con la 0453 de la ronda 3 como control rojo y con tres mutantes
      nuevos, todos muertos.
- [x] Revisión de datos personales con lo no verificable declarado.

## Producción

`0453_portal_helpers_principal_determinista` **no está aplicada**. `done` en esta spec no
acredita la aplicación; lo acredita el ledger.

- Aplicarla exige el OK nominal de Sam y `docs/runbooks/aplicar-migraciones-prod.md`: de a una,
  con el name exacto. No depende de ningún despliegue: la aplicación no cambia.
- **Lectura previa hecha el 2026-09-14,** con autorización de Sam y sólo catálogo y agregados:
  la deriva del cuerpo de 0198 (ver Contexto) y los conteos 0 / 1 / 0. La ronda 4 acepta esa
  forma; sobre el schema completo, la 0453 de la ronda 3 aborta con el mismo mensaje que en
  producción y la de la ronda 4 aplica.
- Antes de aplicar, repetir esa lectura: `pg_get_functiondef` de las tres funciones y del
  trigger, cero policies que nombren la helper y los tres conteos. Entre la lectura y la
  aplicación pueden cambiar. Si aparece otro cuerpo, el preflight aborta y hay que revisar. Un
  conteo mayor que cero no impide aplicar: identifica a quién la 0453 le cierra la resolución.
- Después: smoke de una sesión del Studio (lista de clientes) y de una del Portal (Mi perfil ›
  Direcciones y envíos), y `migrations-applied` en verde.
- Gobernanza: no conformidad de aislamiento multi-tenant corregida localmente y verificada en
  PostgreSQL efímero; en producción NO VERIFICABLE hasta aplicar. Sin cambio visual: `/ui-check`
  no aplica.
