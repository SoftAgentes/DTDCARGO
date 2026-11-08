# Runbook · Ensayo y aplicación de la 0519 (`chatwoot_portal`, SDD-0586 paso 10.5)

> **Preparado, NO corrido.** Lo preparó el Worker de la 10.5 el 2026-11-08, por pedido del Director General (vía el Subdirector de Chatwoot). Cada paso que toca una base, prueba o producción, lo corre el Director General con el OK nominal de Sam. Nada de este documento enciende `chatwoot_portal`, crea la bandeja ni carga variables.
>
> Sigue `docs/runbooks/aplicar-migraciones-prod.md` (producción) y `docs/runbooks/entorno-prueba.md` §4 (ensayo, D6). Lo que aquí se dice de esos scripts sale de esos runbooks; no se midió en el VPS.

## 0 · Por qué ahora

La #424 se fusionó con la 0519 en espera (`main` en `caca3438b`). Según `aplicar-migraciones-prod.md` §10, `publicar-web.sh` no publica una imagen si en el ledger falta una migración que el commit exige, **esperas incluidas**. Desde `caca3438b`, **ninguna publicación entra hasta aplicar la 0519**. Hay dos salidas, cada una con OK de Sam:

- **(a)** este ensayo y después producción;
- **(b)** mientras tanto, `publicar-web.sh aceptar-pendiente 0519_chatwoot_portal` en el servidor, como con la 0422 y la 0423.

## 1 · Identidad

Sale de `infra/ops/migraciones/preparar.mjs --sha caca3438b08c53c44a94693a7fcef7df67496a51 --migracion 0519_chatwoot_portal --sdd 0586`, corrido en el checkout del Worker el 2026-11-08. No toca ninguna base. **Antes de aplicar, se prepara otra vez desde el SHA de `main` del día y se copian los valores de esa salida**, no de aquí.

| Qué | Valor |
|---|---|
| Archivo | `supabase/migrations/0519_chatwoot_portal.sql` |
| SDD y PR | SDD-0586 (10.5, PR 1a) · #424, fusionada en `caca3438b` |
| Blob | `02b9d160285f640bdc6b2be63481119584a76f54` |
| Bytes y md5 | 30710 · `f613559d5ca34b2932995c8ff051e97e` |
| `aplicar.sql` (producción) | md5 `d9e4c9c66d6b716d0c5f003bbb136464`, con `created_by servidor-propio:psql:SDD-0586` |
| Lectura previa | ledger, deriva de 5 funciones y el preflight propio de la 0519 |
| Verificación | md5 y bytes del ledger, y cuerpo vivo de las 5 funciones |
| Funciones que crea o reemplaza | `chatwoot_portal_tomar`, `chatwoot_portal_marcar`, `chatwoot_portal_vincular`, `chatwoot_portal_rezagados` y `feature_flag_catalog()`, redefinida desde la 0503 |
| Locks | Solo objetos nuevos, salvo `feature_flag_catalog()` (`create or replace`) y un `insert … on conflict do nothing` en `feature_flags`. `lock_timeout` de 5 s. Sin locks largos sobre tablas de negocio |

En prueba, `aplicar-migracion.sh --generar` arma su propio paquete, con `created_by …:prueba:SDD-0586`. El md5 del blob es el mismo, y por eso coincide el md5 del ledger de prueba y el de producción (§7 del runbook de producción).

## 2 · Orden

1. **Ensayo en prueba** (`entorno-prueba.md` §4):
   1. Reset de la base de prueba al SHA de `main` (§5). El reset salta las esperas, así que la 0519 no queda aplicada.
   2. Desplegar la imagen de prueba de `main` (§3). Ya trae el código de la #424, inerte sin la 0519, sin flag y sin variables.
   3. Generar el paquete desde ese SHA, copiarlo y ejecutarlo con el md5 que imprimió `--generar` (los comandos están en §4.2 de ese runbook).
   4. Las consultas de «Después» (§3) y el **smoke** (§5), con la misma imagen: aquí la app vieja y la nueva son la misma.
   5. Sam dice «aprobado en prueba».
2. **Pedido de OK para producción** (`aplicar-migraciones-prod.md` §3): el archivo, SDD-0586, la #424, el md5 y los bytes, la lectura previa de producción con su evidencia, el ensayo y su smoke, y el orden. **No hace falta fusionar después**: la PR ya está en `main`, y aplicar destraba la publicación.
3. **Producción**: lectura previa (`--paso previa`), `--en-seco` y después el apply con `--autorizacion` (el OK literal tiene que nombrar `0519`). Las consultas de «Después» en `dtd-cargo` y el smoke.
4. **Cierre** (§6): en una rama de cierre, `retirar-espera.mjs 0519_chatwoot_portal --md5 <blob_md5 de IDENTIDAD.txt de la evidencia>` y `migrations-lock.mjs`. También cambian las pruebas que afirman la espera: `lib/studio/__tests__/chatwoot-portal.migration.test.ts`, en «la 0519 está declarada como espera». La cabecera «NO APLICADA» del `.sql` **no** se corrige.

## 3 · Qué se mide antes y después

Solo lectura del catálogo y del ledger, en `begin transaction read only; … rollback;`. Lo único que se cuenta de una tabla son las filas del flag `chatwoot_portal` en `feature_flags`, que es configuración y no datos de personas.

**Antes** (lo cubre la lectura previa; esto es el detalle a mirar):

```sql
begin transaction read only;
select count(*) as filas_0519 from supabase_migrations.schema_migrations where name = '0519_chatwoot_portal';  -- 0
select to_regclass('public.chatwoot_portal_salida') is null as sin_tablas;                                     -- true
select count(*) as flags, bool_or(key = 'chatwoot_portal') as ya_tiene from public.feature_flag_catalog();     -- 23, false
select count(*) as filas_flag from public.feature_flags where key = 'chatwoot_portal';                          -- 0
rollback;
```

**Después:**

```sql
begin transaction read only;
-- El flag: en el catálogo, apagado; una fila por tenant, todas apagadas.
select count(*) as flags,
       bool_and(not enabled) filter (where key = 'chatwoot_portal') as portal_apagado
from public.feature_flag_catalog();                                                    -- 24, true
select (select count(*) from public.tenants) as tenants,
       count(*) as filas_flag, count(*) filter (where enabled) as encendidas
from public.feature_flags where key = 'chatwoot_portal';                               -- filas_flag = tenants, encendidas = 0
-- RLS y permisos de las cuatro tablas: RLS sí, nada para anon ni authenticated.
select c.relname, c.relrowsecurity,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_lee,
       has_table_privilege('authenticated', c.oid, 'SELECT') as auth_lee,
       has_table_privilege('authenticated', c.oid, 'INSERT') as auth_escribe
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'chatwoot\_portal\_%' order by 1;           -- 4 filas: t, f, f, f
-- Funciones: security definer, search_path vacío y EXECUTE solo para service_role.
select p.oid::regprocedure, p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname like 'chatwoot\_portal\_%' order by 1;           -- 4 filas: t, {search_path=""}, f, f, t
-- La cola está inerte: sin corte y sin filas.
select (select count(*) from public.chatwoot_portal_estado) as cortes,
       (select count(*) from public.chatwoot_portal_salida) as en_cola;                -- 0, 0
rollback;
```

La verificación de `aplicar.sh` ya compara el md5 del ledger y el cuerpo vivo de las 5 funciones. Esto suma el flag, la RLS y los permisos. El postflight de la 0519 los exige también, y aborta el apply si no se cumplen.

## 4 · Vuelta atrás

- **Antes del COMMIT** (códigos 5 y 6): no hay nada que deshacer (§8 del runbook de producción).
- **Después**, lo recomendado es **no deshacer**. La 0519 solo agrega objetos, y queda inerte con `chatwoot_portal` apagado, sin `CHATWOOT_INBOX_PORTAL_ID` y sin `corte`: la cola no toma nada y el aviso da cero. Si la web falla, `publicar-web.sh volver`, que no toca la base.
- **Si hubiera que sacarla**, va una migración nueva y numerada que la desarme, con su PR, sus pruebas y el mismo procedimiento. Tendría que:
  - borrar las cuatro funciones y las cuatro tablas, que no tienen datos mientras el flag esté apagado;
  - redefinir `feature_flag_catalog()` como en la 0503;
  - borrar las filas `chatwoot_portal` de `feature_flags`.

  **No está escrita ni ensayada.** Nunca se borra ni se edita la fila del ledger.

## 5 · Smoke (en prueba y en producción), con el flag apagado

Lo que tiene que seguir igual:

| Rol | Pantalla | Qué se mira |
|---|---|---|
| Cliente del portal (en prueba, uno de prueba) | `/portal/soporte`, el chat | Manda un mensaje: se guarda y aparece, sin error. Mismo comportamiento que antes |
| Admin de Studio | Conversaciones | El mensaje aparece en su hilo; se responde como hoy |
| Admin de Studio | Admin → Feature flags | «Conversaciones del portal en Chatwoot» apagado, con el texto «Al apagar: se detiene una integración del servidor» |
| Cron | `GET /api/cron/chatwoot-reintentos` con `CRON_SECRET` | 200, y en la respuesta `portal: { omitido: "sin_configurar" }` (o `"apagado"`) y `avisoPortal` igual |
| Base (solo lectura) | Las consultas de «Después» | `en_cola = 0` después del mensaje del smoke: con el flag apagado no se reclama nada |

## 6 · Lo que este ensayo NO hace

- No crea la bandeja «Conversaciones del portal» en Chatwoot ni carga `CHATWOOT_INBOX_PORTAL_ID`, que es la puerta 3 de §10.5.9.
- No enciende `chatwoot_portal`, que es la puerta 6 y exige T1 a T4 publicados y la vía de destrabe de la 1b.
- No fija el `corte` ni corre la carga P4.
