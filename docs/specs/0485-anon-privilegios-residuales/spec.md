---
sdd: "0485"
title: "anon y authenticated pierden los privilegios residuales sobre las tablas de public"
status: done
author: "founder + Claude Opus 5"
created: 2026-09-18
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0365", "0366"]
confidencialidad: interno
---

# DTD-0485 — anon y authenticated pierden los privilegios residuales sobre las tablas de public

> `anon` conservaba MAINTAIN, REFERENCES y TRIGGER sobre 180 relaciones de
> `public`, y `authenticated` sobre 196. Ningún camino de la API los usa. La
> migración `0465` los retira sin tocar lo que sí se usa: el SELECT público de
> 5 tablas, el DML de `authenticated`, los privilegios por columna y las
> funciones. **Aplicada en producción el 2026-09-19** (ver «Aplicación en
> producción»).

## Contexto

### La evidencia

Catálogo de producción (`xpfuzqombmjmxvprjgmi`), leído por el Director el
2026-09-18 a las 22:3x UTC con `aclexplode(relacl)`, `pg_default_acl` y
`pg_proc`, **sin filas de negocio**. Las consultas A–I están en
`docs/specs/0485-anon-privilegios-residuales/assets/catalogo.sql`, probadas
antes en `supabase/postgres:17.6.1.165` local.

| Lectura | Resultado |
| --- | --- |
| Identidad | `current_user` = `session_user` = `postgres`; PostgreSQL 17.6 (`170006`). `postgres` no actúa como `supabase_admin` ni es miembro de ese rol. |
| Relaciones de `public` | 264 tablas, 2 vistas y 5 secuencias, **todas de `postgres`**. Sin vistas materializadas, particionadas ni foráneas. |
| Privilegios de tabla | Todos con grantor `postgres` y sin grant option. PUBLIC no tiene ninguno. |
| `anon` | MAINTAIN, REFERENCES y TRIGGER en 179 tablas y 1 vista (180 relaciones). SELECT en 5 tablas. Nada más. |
| `authenticated` | SELECT 226, INSERT 174, UPDATE 166, DELETE 118, y MAINTAIN, REFERENCES y TRIGGER en 195 tablas. En vistas: SELECT 2; MAINTAIN, REFERENCES y TRIGGER 1. |
| Por columna | Sólo UPDATE de `authenticated` en 7 columnas de 2 relaciones. Nada para `anon` ni PUBLIC. |
| Default de `postgres` en `public` | tablas `{postgres=arwdDxtm, service_role=arwdDxtm}`, funciones `{postgres=X, service_role=X}`, secuencias `{postgres=rwU, service_role=rwU}`. Ya excluye a `anon` y `authenticated` (0263). |
| Default de `supabase_admin` en `public` | `arwdDxtm`, `X` y `rwU` para postgres, anon, authenticated y service_role. |
| Funciones INVOKER ejecutables por anon/authenticated | 172. Sólo una menciona mantenimiento: `extensions.pgrst_ddl_watch()`, y es el tag de comando del event trigger de PostgREST, no una operación. |
| Event triggers | `ensure_rls` (postgres, sólo enciende RLS) y los de plataforma de `supabase_admin`. Ninguno vuelve a dar privilegios a las tablas nuevas. |
| Vistas | `clients_phone_no_normalizable` y `supplier_scorecard_v`, las dos `security_invoker`. |

Las 5 tablas con SELECT de `anon`, todas con RLS y sin force (entre paréntesis,
las policies para `anon` o `public`): `back_glosario` (1), `back_noticias` (1),
`back_servicios` (1), `news_posts` (4) y `ve_locality_catalog` (1).

### De dónde sale

Es el default de Supabase recortado sólo en parte. Hasta 0263, cada tabla que
`postgres` creaba en `public` nacía con `arwdDxtm` para `anon` y
`authenticated`. Las migraciones siguientes quitaron el DML donde no
correspondía y la 0399 retiró TRUNCATE en todas. Su cabecera dejó escrito que
REFERENCES y TRIGGER quedaban fuera de su alcance. MAINTAIN llegó con
PostgreSQL 17 por la misma vía.

### Qué permiten y por qué el riesgo es bajo

- **MAINTAIN:** VACUUM, ANALYZE, CLUSTER, REINDEX, REFRESH MATERIALIZED VIEW y
  LOCK TABLE en cualquier modo.
- **REFERENCES:** crear una FK que apunte a la tabla.
- **TRIGGER:** crear triggers sobre la tabla.

PostgREST no ejecuta DDL, `anon` y `authenticated` son NOLOGIN, y ninguna
función INVOKER a su alcance los usa. Es **defensa en profundidad**: si mañana
aparece una función INVOKER con SQL dinámico expuesta por RPC, estos
privilegios permitirían bloquear tablas (LOCK en cualquier modo) o engancharles
triggers.

### Quién usa el SELECT de las 5 tablas

Revisado en el código con evidencia archivo:línea. No se leyó la base.

| Tabla | ¿`anon` la lee directo? | Consumidor |
| --- | --- | --- |
| `news_posts` | **Sí** | `lib/public/news-queries.ts` usa `getAnonClient()` (`lib/public/supabase-anon.ts`, anon key sin sesión) para `/noticias`, `/noticias/[slug]`, su imagen OG y `/sitemap.xml`. Policy `news_posts_public_select` (0055), filtra `published = true`. |
| `ve_locality_catalog` | **Sí** | `/registro` (pública, previa al login) llama `listRegisterCities` (`lib/portal/register-cities.ts`) con el cliente de servidor sin sesión. Policy de 0338 para `anon, authenticated`. |
| `back_servicios`, `back_noticias`, `back_glosario` | **No** | Único consumidor: el conteo de `app/back/(app)/page.tsx`, como `authenticated` detrás de `requireAnyBackRole()`. El sitio público no las toca: `/servicios` usa la RPC `public_servicios`, `/glosario` es estático. El grant y la policy para `anon` (0030) quedaron de un plan de publicarlas. |

Ninguna RPC ejecutable por `anon` lee estas tablas: la única función que las
lee es `seed_tenant_cities_from_ve_catalog`, SECURITY DEFINER y sin EXECUTE
para `anon` (0209). `/api/public/*` usa RPC con `anon` o el cliente admin.

## Alcance

1. Migración `0465_anon_privilegios_residuales.sql`: retira MAINTAIN,
   REFERENCES y TRIGGER de `anon` y de `authenticated` en todas las tablas y
   vistas de `public`.
2. `anon` conserva SELECT en las 5 tablas. Es la condición del Director, y dos
   de ellas tienen consumidores reales. El caso de las tres `back_*` va a FUERA
   DE ALCANCE.
3. Contrato SQL y prueba en PGlite, con control rojo, y la condición de L14.
4. Espera declarada en `supabase/migrations-baseline.json`.

**No alcance:** SELECT, INSERT, UPDATE y DELETE de `anon` o `authenticated`;
privilegios por columna; EXECUTE de funciones (condición de L14); secuencias;
policies; `service_role`; otros schemas (`storage`, `auth`, `realtime`,
`payment_private`…); default privileges.

## Diseño

### Un solo bloque DO

Preflight, foto de los ACL, `revoke` y postflight van en **un solo `DO`**. Si
algo no cuadra, la sentencia falla entera y no queda nada a medias, haya o no
transacción externa. Se probó en autocommit en PGlite y en `supabase/postgres`.
Antes van `set lock_timeout = '5s'` y `set statement_timeout = '30s'` a nivel
de sesión, como en 0422.

El cambio es una sola sentencia:

```sql
revoke maintain, references, trigger on all tables in schema public
  from anon, authenticated;
```

`ALL TABLES` cubre tablas, vistas, vistas materializadas, foráneas y
particionadas. No incluye secuencias. Al revocar REFERENCES de la tabla,
PostgreSQL retira también el REFERENCES por columna. En producción no hay
ninguno, y el postflight lo acepta.

### Preflight: aborta sin cambiar nada si…

1. el servidor no es PostgreSQL 17 o superior (MAINTAIN no existe antes);
2. faltan los roles `anon`, `authenticated`, `service_role` o `postgres`;
3. quien la corre no actúa como `postgres`. Un revoke hecho por otro rol no
   tiene efecto sobre tablas de `postgres`: sólo da un WARNING;
4. alguna relación de `public` no es de `postgres`. El revoke no la cubriría y
   el resultado mentiría (condición del Director);
5. `anon` o `authenticated` tienen grant option. Obligaría a revocar en
   cascada;
6. `anon` o PUBLIC tienen algo fuera del inventario. El inventario es
   MAINTAIN, REFERENCES y TRIGGER en cualquier relación, SELECT sólo en las 5
   tablas y nada por columna;
7. alguna de las 5 tablas perdió RLS o el SELECT de `anon`;
8. el default de `postgres` para tablas, en `public` o global, volvió a
   incluir a `anon`, `authenticated` o PUBLIC.

### Postflight, en el mismo bloque

- Foto de los ACL de tabla y de secuencia de `public`, antes y después, con
  clave por OID. No puede aparecer nada nuevo. Lo único que puede faltar es
  MAINTAIN, REFERENCES o TRIGGER de `anon` o `authenticated`.
- Foto de los ACL por columna: sólo puede faltar el REFERENCES de `anon` o
  `authenticated`. Así, el UPDATE por columna de `authenticated` queda
  intacto.
- Privilegios efectivos, incluidos los heredados de PUBLIC: 0 relaciones con
  MAINTAIN, REFERENCES o TRIGGER, de tabla o por columna, para los dos roles.
- `anon` lee **exactamente** las 5 tablas y no escribe en ninguna.

Con eso, los conteos de SELECT/INSERT/UPDATE/DELETE de `authenticated` quedan
intactos por construcción. Es la condición 4 del Director.

### Default privileges

- **`postgres`:** ya está limpio (0263), y es el rol que crea las tablas. No
  hace falta `ALTER DEFAULT PRIVILEGES`: el preflight **afirma** que sigue
  limpio, por schema y global, y aborta si se volvió a ensuciar.
- **`supabase_admin`:** sigue dando todo a `anon` y `authenticated`, pero
  `postgres` no lo puede cambiar. Medido en `supabase/postgres:17.6.1.165`:
  `alter default privileges for role supabase_admin …` como `postgres` da
  `ERROR: permission denied to change default privileges`. La lectura A
  confirma que en producción la identidad es `postgres` y no actúa como
  `supabase_admin`. Si la 0465 lo intentara, abortaría entera. Hoy no afecta
  nada: no hay objetos de `supabase_admin` en `public`. **Límite residual
  documentado.** Si algún día `supabase_admin` crea una tabla en `public` (por
  ejemplo, una extensión instalada ahí), nacería con todo para `anon` y
  `authenticated`. El preflight 4 de una migración como esta lo delataría.

### Locks

Medido en `supabase/postgres:17.6.1.165` local, con `postgres` sin
superusuario y un fixture a escala de producción: 264 tablas y 2 vistas, con
el residuo en 179+1 relaciones para `anon` y en 195+1 para `authenticated`, y
los mismos conteos de DML.

- El bloque DO tarda **110–170 ms** y el COMMIT, 4–9 ms.
- **Ningún lock sobre tablas de `public`.** Mientras la transacción sigue
  abierta sólo tiene AccessShareLock de catálogos: `pg_class`,
  `pg_attribute`, `pg_namespace`, `pg_authid`, `pg_default_acl`,
  `pg_db_role_setting`, `pg_roles` y sus índices. Además tiene su
  `transactionid` y su `virtualxid`. `REVOKE` reescribe las filas de
  `pg_class`; no pide locks de relación.
- Con la transacción abierta, un SELECT, un INSERT y un DELETE concurrentes
  sobre tablas tocadas pasan sin esperar. Un `ALTER TABLE` concurrente espera
  la fila de `pg_class` hasta el COMMIT (su `lock_timeout` de 1 s cortó).
- Al revés, si un `ALTER TABLE` está abierto sobre una tabla de `public`, el
  revoke espera esa fila y `lock_timeout` lo corta a los **5,1 s** en
  autocommit. Después, el residuo quedó idéntico (180/196): nada a medias.

### Vuelta atrás

Ningún camino conocido la necesita. Si hiciera falta, se reconstruye desde la
lista que el Director guarda antes de aplicar (consulta V1 de «Aplicación»):
`grant <privilegios> on <relación> to <rol>`, relación por relación. No hay
datos que restaurar.

## Condición de L14

La 0422 sigue pendiente, y su preflight exige tres cosas: SELECT de
`authenticated` en `public.user_tenants`, ningún privilegio API en
`payment_private.report_commands` y el EXECUTE de las cuatro funciones de
comandos. La 0465 no toca SELECT, no sale de `public` y no toca funciones.

**Prueba obligatoria (Director), cumplida en PGlite y en `postgres:17`:** se
corren los contratos completos de 0422 y de 0423 con la 0465 insertada justo
después de 0371. Ese es el punto donde termina lo que producción ya tiene: lo
que sigue en el contrato de 0422 es su fixture adversarial de grants por
columna, que nunca existió en producción. Los dos pasan, preflights incluidos.
Control rojo: si en ese mismo punto `authenticated` pierde SELECT en
`user_tenants`, el preflight de 0422 aborta con «0422 requiere SELECT de
membresías propio/activo».

La 0465 no depende del orden de L14: puede aplicarse antes o después de 0422 y
0423.

## Criterios de aceptación

- [x] `anon` sin MAINTAIN, REFERENCES ni TRIGGER en ninguna relación de
      `public`, y SELECT exactamente en las 5 tablas (postflight y contrato).
- [x] `authenticated` sin esos tres, con SELECT/INSERT/UPDATE/DELETE y
      privilegios por columna intactos (postflight y contrato 3).
- [x] Preflight de catálogo que aborta sin cambiar nada ante cada desvío del
      inventario (11 casos en PGlite).
- [x] `lock_timeout` y `statement_timeout`; locks y duración medidos a escala
      de producción.
- [x] Contrato SQL con control positivo y control rojo, en `postgres:17`, en
      `supabase/postgres` y en PGlite.
- [x] Preflights de 0422 y 0423 en verde con la 0465 aplicada, con control
      rojo.
- [x] Default privileges revisados: `postgres` limpio y afirmado;
      `supabase_admin` documentado como límite residual.
- [x] Aplicada en producción con OK nominal de Sam, por el Director, según
      `docs/runbooks/aplicar-migraciones-prod.md`, con la verificación V2 de
      abajo (2026-09-19; detalle en «Aplicación en producción»).

## Aplicación en producción (2026-09-19)

- **OK nominal de Sam:** 2026-09-19 a las 00:29 UTC, por AskUserQuestion al
  Director, nombrando «0465_anon_privilegios_residuales».
- **Aplicación:** la hizo el Director, sola y con `name` exacto, a las
  00:56:40 UTC (20:56 en Caracas), sin sesiones activas. El postflight interno
  de la migración pasó.
- **Identidad en el ledger:** `20260919005640 · 0465_anon_privilegios_residuales`,
  1 sentencia. `md5(array_to_string(statements, ''))` =
  `e87d496914c1344185718e758b3b4e5b` y 15 600 bytes, iguales al blob
  `863358f4` del repo (sólo LF). La cabecera del `.sql` no se toca.
- **V0 (antes, leído por el Director):** M/R/T de `anon` en 180 relaciones y
  de `authenticated` en 196; SELECT de `anon` en 5; DML de `authenticated`:
  SELECT 228, INSERT 174, UPDATE 166, DELETE 118.
- **V1:** la vuelta atrás (dos GRANT: `anon` sobre 180 relaciones y
  `authenticated` sobre 196) quedó fuera del repo, en el scratchpad del
  Director.
- **V2 (después):** residuo M/R/T **0** para los dos roles; `anon` lee
  exactamente las 5 tablas; DML de `authenticated` sin cambios; los 7 UPDATE
  por columna, intactos. Lo leyó el Director, y el Worker repitió el ledger y
  V2 por su cuenta, con el mismo resultado (sólo catálogo, sin filas).
- **Advisors de seguridad:** la misma huella antes y después (md5 normalizado
  `c80be095…`, leído por el Director).
- **Sitio público:** `/noticias` (200, con sus 5 artículos), `/`, `/registro`
  y `/tarifas` responden 200 (comprobado por el Director).
- La espera salió de `pendingBelowCutoff`. No hace falta prueba de Sam: V2 y
  las páginas públicas cubren lo que la 0465 podía afectar.

## Aplicación (para el Director)

> Registro del procedimiento que se siguió el 2026-09-19. Queda como
> referencia para una migración parecida.

Requiere OK nominal de Sam que nombre `0465_anon_privilegios_residuales`. Se
aplica sola, con `name` exacto. Fusionar la PR no la autoriza.

**V0 · antes, releer el inventario.** Las lecturas A–I de
`assets/catalogo.sql`, en particular B, C, D y F. Si algo cambió, el preflight
aborta sin cambiar nada y avisa qué.

**V1 · antes, guardar la lista para la vuelta atrás.** Sólo catálogo:

```sql
select c.oid::regclass as relacion, g.rolname as rol,
       string_agg(lower(a.privilege_type), ', ' order by a.privilege_type) as privilegios
from pg_class c
cross join lateral aclexplode(c.relacl) a
join pg_roles g on g.oid = a.grantee
where c.relnamespace = 'public'::regnamespace
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
  and g.rolname in ('anon', 'authenticated')
  and a.privilege_type in ('MAINTAIN', 'REFERENCES', 'TRIGGER')
group by 1, 2
order by 1, 2;
```

**V2 · después, verificar.** Resultado esperado: `0 · 0 · 5`, y los conteos
de `authenticated` iguales a la lectura C (226+2, 174, 166, 118).

```sql
select
  count(*) filter (where has_table_privilege('anon', c.oid, 'MAINTAIN, REFERENCES, TRIGGER')) as anon_residuo,
  count(*) filter (where has_table_privilege('authenticated', c.oid, 'MAINTAIN, REFERENCES, TRIGGER')) as auth_residuo,
  count(*) filter (where has_table_privilege('anon', c.oid, 'SELECT')) as anon_select,
  count(*) filter (where has_table_privilege('authenticated', c.oid, 'SELECT')) as auth_select,
  count(*) filter (where has_table_privilege('authenticated', c.oid, 'INSERT')) as auth_insert,
  count(*) filter (where has_table_privilege('authenticated', c.oid, 'UPDATE')) as auth_update,
  count(*) filter (where has_table_privilege('authenticated', c.oid, 'DELETE')) as auth_delete
from pg_class c
where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'f');
```

**Smoke:** no requiere pantallas nuevas. Si se quiere confirmar en vivo, basta
con que carguen `/noticias` y el selector de ciudades de `/registro` sin sesión,
que son las dos lecturas de `anon`.

## Evidencia

- `supabase/tests/0465_anon_privilegios_residuales.test.sql`: el contrato.
  Reproduce el residuo de producción, trae un control positivo y cinco
  contratos: sin residuo, lectura exacta de `anon`, todo lo demás intacto,
  idempotencia y tabla nueva limpia.
- `__tests__/anon-privilegios-residuales.migration.test.ts`: 26 casos en
  PGlite. Corre el contrato completo con control rojo, 11 preflights negativos
  y la atomicidad en autocommit. Suma 6 casos del postflight sobre mutantes del
  bloque: quitar de más, olvidar a `authenticated`, olvidar TRIGGER, conceder
  algo, tocar un privilegio por columna y la guarda que verifica el revoke que
  reemplazan. Agrega 2 de privilegios heredados por membresía y la guarda de
  `lock_timeout`/`statement_timeout`. Cierra con la cadena de L14 y su control
  rojo.
- Campaña de mutantes sobre el `.sql`: resultado en el handoff.
- El handoff `.agents/handoffs/0485-anon-privilegios-residuales.md` registra
  corridas, SHA y resultados.
