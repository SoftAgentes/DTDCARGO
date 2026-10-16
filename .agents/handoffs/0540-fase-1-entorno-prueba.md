# Handoff · SDD-0540 · Fase 1 · Entorno de prueba (solo repo)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-16, de 07:54 a 09:10 UTC aprox. (Caracas: 03:54 a 05:10) |
| Task ID / owner | `0540-fase-1-entorno-prueba` / subagente Worker lanzado por la sesión Director, claim `worker-0540-fase1-a7c2c1ce` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a7c2c1ce96270fc41` |
| Rama | `worktree-agent-a7c2c1ce96270fc41` |
| Base | `origin/main` `6da8aebc`, más el merge (`2b0ac5a9`, sin rebase) de `worktree-agent-a3485995997ab5c0f`: PR #246, cabeza `e6c67c4e`, con la spec de la 0540 |
| SDD | [0540](../../docs/specs/0540-entorno-prueba-staging/spec.md), `proposed`. La spec vive en la PR #246 y esta rama **no la modifica** |
| Estado de la tarea | lista para revisión. Las dos corridas pesadas PASARON (seguimiento del 2026-10-16) |
| Permisos | commits selectivos, push de la rama propia y PR en borrador contra `main`, sin fusionar (main congelado). Prohibidos: producción, SSH, DNS, Vercel, GHCR con credenciales y secretos reales. Sin `pnpm verify`, suites Docker ni Postgres efímero |

## OBJETIVO ORIGINAL

Entregar la Fase 1 de la SDD-0540: los entregables de la tabla «Fase 1» del §3, con su aceptación medible y sin tocar el servidor.

Decisiones:
- **Aprobadas por Sam:** D1 (tres peldaños), D2 (datos sintéticos) y D3 (`prueba.dtdcargo.com` y `supabase-prueba.dtdcargo.com`).
- **Con la recomendación del §4:** D4 (clave en el web), D5 (sin OK por despliegue a prueba), D6 (migración obligatoria por prueba), D8 (sin integraciones), D9 (correos simulados), D10 (≤ 3.072 MiB) y D11 (aviso visible). D11 es producto: va en la Fase 2.

## COMPLETADO

### 1. Overlay `infra/dtd-cargo/compose.staging.yml`

Reemplaza el overlay de la Fase 2 de la SDD-0505, que era la lista de IP del staging con copia real.

- **Límites del §2.8.** Suman **3.072 MiB** en los 12 servicios activos. Medido con `docker compose config`: db 1024, web 576, realtime 320, functions 256, imgproxy 256, storage 192, rest 128, auth 96, api-gw 96, mailpit 64, auth-templates 32 y cron 32.
- **`X-Robots-Tag: noindex, nofollow`** en los tres routers: web, API y buzón. También agrega la cabecera `X-DTD-Entorno: prueba con datos sinteticos`.
- **Puerta D4.** `basicAuth` en el web y en `/correo/`, con `removeheader=true`. Los usuarios salen de `${PRUEBA_WEB_USUARIOS:?…}`: sin la variable, el compose no arranca. La API queda sin clave.
- **Mailpit sin relay,** en `/correo/` del host del web y detrás de la misma clave. GoTrue entrega ahí.
- **Postgres** con `config_file` conservado, `shared_buffers=256MB`, `effective_cache_size=768MB`, `work_mem=4MB` y `max_connections=60`.
- **La cabecera del archivo** está reescrita: «prueba con datos sintéticos».

### 2. `.env` de prueba

- `infra/ops/staging/prueba.sets` reúne los valores fijos, que no son secretos:
  - hosts D3 y `APP_ENV=staging`;
  - `DISABLE_SIGNUP=true` y `ENABLE_ANONYMOUS_USERS=false`;
  - cookie propia `sb-prueba-auth-token`;
  - `BACKUP_RCLONE_REMOTE` inválido a propósito, para que un `backup.sh` corrido por error falle.
- `infra/ops/staging/env-prueba.sh` corre `new-env.sh` con esos `--set` y además:
  - fija `DTD_DATA_DIR=<carpeta del .env>/data`, la imagen `prueba-sha-*` y la puerta cerrada `PRUEBA_WEB_USUARIOS=pendiente:sin-clave`;
  - **borra toda línea `X=` vacía** y las marcas `<…>`. Con eso desaparecen las 73 claves del bloque de integraciones y las extra.

### 3. `infra/ops/staging/verificar-aislamiento.sh`

Nunca imprime un valor. Comprueba:
1. Ningún valor de prueba de ≥ 8 caracteres coincide **por sha256** con un secreto de producción. También atrapa una clave copiada con otro nombre. Usa un solo `sha256sum` sobre archivos en `/dev/shm`.
2. Hosts, URLs, cookie y carpeta de datos distintos de producción. Ningún valor apunta al host de producción ni a la ref de Cloud.
3. `APP_ENV`, `DISABLE_SIGNUP` y los usuarios anónimos.
4. Integraciones vacías o ausentes. Lee el bloque del `.env.example` más una lista extra; `--permitir` sale como AVISO.
5. Ni líneas vacías ni marcas.
6. La puerta: bcrypt, o el marcador inicial como AVISO solo con `--sin-base`.
7. La imagen: `prueba-sha-<40 hex>`.
8. Vault y `kommo_connections` en 0.
9. El bundle, en `docker run --network none`:
   - el host de prueba ≥ 1;
   - producción y Cloud en 0;
   - **la anon y la cookie de este `.env` presentes**;
   - GA y Ads como AVISO, o FALLÓ con `--exigir-sin-ga`.

### 4. Scripts del entorno de prueba

`desplegar-prueba.sh`, `resetear-base-prueba.sh` y `crear-prueba.sh`, con dos auxiliares (`clave-web-prueba.sh` y `sembrar-prueba.sh`) y la librería común `lib-prueba.sh`.

- **Guardas comunes.** Rechazan `dtd-cargo`, cualquier proyecto sin `-staging` y una carpeta de producción. `resetear` y `crear` exigen `--confirm`. `desplegar` rechaza `sha-*`, `:main` y la imagen de otro SHA. `--dry-run` no llama a docker; lo prueban los dobles.
- **`desplegar-prueba.sh`** hace, en orden:
  - `pull`;
  - verificar completo (si falla, sale 4 sin cambiar el `.env`);
  - respaldo del `.env` y `DTD_WEB_IMAGE` nuevo;
  - `up -d --no-deps web`;
  - healthcheck y smoke de la puerta: 401 sin clave, 200 con clave en `/`, `/studio/login` y `/correo/`, `noindex` en los dos hosts y la API sin apikey 401. La clave va a curl en un archivo de configuración 600;
  - `EN-PRUEBA.txt` y la evidencia `prueba-desplegar-<ts>.txt`.
- **`resetear-base-prueba.sh`** tiene dos pasos:
  - `--preparar`, en el checkout: blobs exactos del SHA, más `SOLO-LEDGER.txt`, `PENDIENTES.txt`, plataforma, semilla, MANIFIESTO y SHA256SUMS;
  - en el VPS: integridad, revisión de todas las migraciones antes de borrar nada, `destroy-staging.sh`, `db` y después `auth rest storage imgproxy`, plataforma, todas las migraciones con el envoltorio común, RLS de cron otra vez encendida, semilla y la cuenta del ledger.
- **`crear-prueba.sh`** orquesta, en este orden:
  - la primera corrida crea el `.env` y **se detiene**, porque la imagen tiene que construirse con su anon;
  - pull y verificar con `--sin-base`;
  - reset y clave;
  - verificar completo;
  - con `--con-dns`: DNS al VPS (`getent`), el resto del stack y el smoke.
- **`clave-web-prueba.sh`** calcula el bcrypt con pgcrypto en la base de prueba. La clave queda solo en `secretos/clave-web.txt`.

### 5. `infra/ops/migrate/aplicar-migracion.sh` y `infra/ops/lib/migracion.sh`

Reproduce el método del Director.

- **`--generar`, en el checkout.** Escribe `\set ON_ERROR_STOP on`, `begin;`, el blob exacto con `git cat-file`, `insert into supabase_migrations.schema_migrations (version, statements, name, created_by)` con `to_char(clock_timestamp() at time zone 'utc','YYYYMMDDHH24MISS')` y `array[$migNNNN$…$migNNNN$]`, y `commit;`. La previa y la verificación van en `begin transaction read only … rollback`.
- **Rechaza** CR, una línea que empieza con barra invertida, el delimitador dentro del texto y un begin, commit o rollback propio. El `end;` de plpgsql no cuenta.
- **`--ejecutar`, en el VPS.** Comprueba SHA256SUMS, el md5 de `aplicar.sql` en destino, la primera línea útil y que `aplicar.sql` sea el envoltorio del blob. Después corre previa, apply y verificación (md5 y bytes del ledger contra el blob) y deja la evidencia `apply-NNNN-<proyecto>-<ts>/` con su SHA256SUMS.
- **Códigos de salida:** 3 guarda, 4 integridad, 5 previa, 6 apply (psql deshace todo) y 7 verificación.
- **Solo `*-staging`**, con `created_by = servidor-propio:psql:prueba:SDD-NNNN`.

### 6. Semilla sintética

`semilla-prueba.sql`, `sembrar-prueba.sh` y `plataforma-prueba.sql`.

- **Roles:** admin del Studio (Auth con clave, identidad, perfil y `user_tenants` admin), cliente del Portal (Auth sin clave, ficha aprobada y `client_users` activo), operario VE bodeguero y operario CN con PIN (bcrypt y `operario_pin_cifrar`), y proveedor CN con una prealerta y su link `/p/<token>`.
- **Idempotente:** UUID fijos `05400000-…` y `on conflict` en cada insert. Las claves nacen una vez en `secretos/cuentas-prueba.txt` y se reusan.
- **Correos y teléfonos:** `.test` y `+1 202 555 0100`–`0199`. También **reemplaza los contactos demo que siembran las migraciones** (0006, 0010, 0011, 0160, …) y lo comprueba sobre la base al final; si queda uno fuera de lo reservado, aborta.
- **Kommo:** sin fila en `kommo_connections` y sin claves en Vault.
- **Plataforma:**
  - default privileges idénticos a los de los stubs del rebuild, con una prueba que los compara;
  - ledger con `created_by`, `idempotency_key` y `rollback`;
  - las tablas de auth y storage, solo si faltan.

### 7. `.github/workflows/build-image-prueba.yml`

- Solo `workflow_dispatch` con `sha` obligatorio y `environment: prueba`.
- Guard de las `PRUEBA_*`: vacías, URL exacta, producción o Cloud, e iguales a las variables de producción del repo.
- Build `push: false`, después la comprobación del bundle sin red y recién entonces `docker push …:prueba-sha-<sha>`.
- `build-args` solo con `vars.PRUEBA_*` y el SHA. El SHA del input no entra crudo a ningún `run:`.

### 8. Runbook

[`docs/runbooks/entorno-prueba.md`](../../docs/runbooks/entorno-prueba.md) cubre:
- crear prueba en el orden real: `.env` → GitHub → build → paquete → base → DNS → stack;
- subir una rama;
- ensayar una migración (smokes A y B);
- resetear, verificar, rotar la clave y destruir;
- las pruebas y las dependencias.

Una prueba falla si el runbook le pasa a un script una opción que su `case` no conoce.

Una línea más en `infra/dtd-cargo/README.md` y dos filas en `infra/ops/README.md`.

### Pruebas nuevas

| Archivo | Tipo |
|---|---|
| `infra/ops/tests/prueba-scripts-entorno-prueba.sh` | bash con dobles de docker, curl y getent (`dobles-prueba.sh`) |
| `infra/ops/tests/prueba-aplicar-migracion.sh` | bash con dobles |
| `infra/ops/tests/prueba-compose-prueba.sh` | `docker compose config` real, solo valida; reglas en `revisar-compose-prueba.mjs` |
| `infra/ops/tests/prueba-aplicar-migracion-efimera.sh` | **pesada**, supabase/postgres efímero |
| `infra/ops/tests/prueba-resetear-base-efimera.sh` | **pesada**: todas las migraciones del HEAD, con GoTrue y storage-api arriba |
| `infra/ops/tests/prueba-smoke-web-credenciales.sh` | bash con dobles de curl, openssl y date |
| `scripts/__tests__/entorno-prueba-{compose,semilla,runbook,scripts}.test.mjs`, `build-image-prueba-workflow.test.mjs` | Vitest, sin Docker; entran a `pnpm test` y al CI |

### 9. Seguimiento del 2026-10-16, a pedido del Director

- **Prueba pesada del reset con el orden real.** La base, GoTrue y storage-api arrancan antes de las migraciones, como en el servidor.
- **La semilla exige el esquema de GoTrue.** El cambio y la decisión están en el §9 de la spec.
- **`plataforma-prueba-cierre.sql`, nuevo.** Con la plataforma, deja pasar la 0038 con los servicios arriba.
- **GoTrue ya no responde 500 al listar usuarios.** Ver «Corridas pesadas» en VALIDACIÓN.
- **`infra/ops/web/smoke-web.sh --credenciales <archivo>`,** con las condiciones de la sesión de Contabo:
  - es opcional e idéntico sin la opción;
  - `-K` en `pedir()` y también en la llamada de `--www`;
  - nada por argv; los `openssl` no la usan;
  - un archivo inválido sale 2;
  - el resumen dice «con credenciales: sí».
- **`docs/runbooks/servidor-contabo.md` §1.9:** el entorno de prueba, con el staging de la Fase 2 como histórico fechado.
- **`docs/runbooks/entorno-prueba.md`:** usa `--credenciales`.

## VALIDACIÓN

Las filas de la primera entrega se midieron sobre `e2f32947`. Las del seguimiento del 2026-10-16 (pruebas pesadas, `--credenciales`) se midieron sobre los commits que se nombran en cada una. Sobre la cabeza final (`16802ca4` más este handoff, con `origin/main` `acd4f53d` ya integrado) se repitieron:
- **Vitest** (5 archivos nuevos + 2 vecinos): PASÓ, 76/76, 70 s;
- **`prueba-compose-prueba.sh`**: PASÓ, 7 · 0;
- **`docs:check`**: PASÓ, 526 specs;
- **`sdd:check`**: OK;
- **`git diff --check origin/main HEAD`**: PASÓ;
- **ESLint de los `.mjs`**: PASÓ.

| Comprobación | Resultado |
|---|---|
| `bash infra/ops/tests/prueba-scripts-entorno-prueba.sh` | **PASÓ**: `RESULTADO: 76 PASÓ · 0 FALLÓ · 3 NO VERIFICADO`. Los 3 NO VERIFICADO son los permisos 600: NTFS no los guarda, en Linux (CI, VPS) se comprueban. Los controles rojos fallan como deben: service_role copiada, secreto con otro nombre, integración encendida, línea vacía, URL de producción, `APP_ENV=production`, imagen `sha-*`, Vault con Kommo, bundle con producción, anon o cookie de otra imagen, GA con `--exigir-sin-ga`, migración que falla, web abierto sin clave y DNS ajeno |
| `bash infra/ops/tests/prueba-aplicar-migracion.sh` | **PASÓ**: `RESULTADO: 35 PASÓ · 0 FALLÓ` |
| `bash infra/ops/tests/prueba-compose-prueba.sh` (Docker 29.7.2, Compose v5.5.1; solo `config`) | **PASÓ**: `RESULTADO: 7 PASÓ · 0 FALLÓ`. Las 15 reglas del revisor pasan, la suma es 3.072 MiB, sin la puerta no valida, los controles rojos fallan y producción sin el overlay sigue en 9.728 MiB |
| Vitest: los 5 archivos nuevos más `ci-workflow-contract.test.mjs` e `infra-env-example.test.ts` | **PASÓ**: `Test Files 7 passed (7)`, `Tests 75 passed (75)`, 87 s en Windows (las dos pruebas bash corren en paralelo) |
| `bash -n` de los 17 scripts nuevos | **PASÓ** (dentro de `entorno-prueba-scripts.test.mjs`) |
| `corepack pnpm exec eslint` de los `.mjs` nuevos | **PASÓ**: 0 errores. `infra/` está ignorado por la configuración |
| `corepack pnpm docs:check` | **PASÓ**: «índice sincronizado con 525 specs» |
| `corepack pnpm sdd:check` | **PASÓ**: `[OK] numbering: sin números repetidos` (solo choques históricos) |
| `git diff --check` y `git diff --cached --check` en cada commit | **PASÓ** |
| `node scripts/check-feature-constants.mjs` · `node scripts/check-pending-migration-symbols.mjs` | **PASÓ**: 6 banderas coinciden · 0 ROJO, 0 AMARILLO |
| `bash infra/ops/tests/prueba-aplicar-migracion-efimera.sh` | **PASÓ**: 11 · 0 FALLÓ. La corrió primero el Director sobre `cd8f1352` (09:38–09:48Z) y la repetí sobre `6b098a50`, porque cambió `plataforma-prueba.sql`. Incluye que un error a la mitad no deja ni la tabla ni la fila, y que la lectura previa frena la segunda corrida |
| `bash infra/ops/tests/prueba-resetear-base-efimera.sh` | **PASÓ**: 19 · 0 FALLÓ sobre `6b098a50`, con el turno que dio el Director. Detalle en la sección «Corridas pesadas» de abajo |
| `bash infra/ops/tests/prueba-smoke-web-credenciales.sh` (dobles de curl, openssl y date) | **PASÓ**: 15 · 0 FALLÓ · 1 NO VERIFICADO (el archivo ilegible no se puede armar en NTFS; en Linux, sin root, sí) |
| `smoke-web.sh` sin la opción contra el script anterior (blob `4a281263`), con los mismos dobles | **PASÓ**: salida (19 líneas), 16 llamadas de curl y llamadas de openssl idénticas; con `--www`, 21 líneas y 17 llamadas, también idénticas. El log de openssl se compara ordenado: `s_client` y `x509` escriben a la vez en la misma tubería |
| `pnpm verify` | **NO EJECUTADO**: lo excluye el encargo. No cambia código de producto: `app/`, `lib/`, `components/` y `supabase/` quedan intactos |
| `pnpm typecheck` y `pnpm lint` completos | **NO EJECUTADO**: las pruebas nuevas son `.mjs`, fuera del `include` de tsconfig; ESLint se corrió sobre ellas |
| `corepack pnpm knowledge:status` | **NO DISPONIBLE**: `structural INVALID`, `semantic INVALID`, `archify PENDING` («ARCHIFY_RUNTIME_MISSING») y `obsidian PENDING`. Este worktree no tiene los derivados |
| `knowledge:visual` / `knowledge:visual:check` | **NO DISPONIBLE**: falta el runtime de Archify 2.16.0 en el worktree |

### Corridas pesadas (seguimiento del 2026-10-16, 09:38–10:50Z)

1. **Primera corrida, del Director, sobre `cd8f1352`.** La de aplicar-migración PASÓ (11 · 0). La del reset FALLÓ (5 · 7):
   - el paquete, las 482 migraciones, el ledger, las versiones y los default privileges dieron bien;
   - la semilla falló con `column "email_confirmed_at" of relation "users" does not exist`.
   - **Causa:** la prueba corría sin GoTrue y `auth.users` tenía el esquema base de la imagen.
2. **Decisión:** que la prueba reproduzca el orden real, y no que la semilla dependa de dos esquemas. Está explicada en el §9 de la spec. La prueba levanta, en una red interna desechable, la base y GoTrue `v2.197.0` + storage-api `v1.77.6`, que salen de `compose.supabase.yml`. La semilla exige el esquema de GoTrue y falla con un mensaje claro si no lo encuentra.
3. **Lo que destapó el orden real**, que en el servidor habría pasado igual:
   - **La 0038 se rompía:** «relation "public.instances" does not exist». Evalúa `has_table_privilege('service_role', 'public.' || relname)` sobre toda tabla con RLS antes de filtrar por esquema, y GoTrue y storage-api dejan RLS en `auth.*` y `storage.*`. Arreglo: `plataforma-prueba.sql` anota y apaga esa RLS durante las migraciones, y `plataforma-prueba-cierre.sql`, que es nuevo y entra en el paquete, la vuelve a encender en exactamente esas tablas y lo comprueba.
   - **GoTrue respondía 500 al listar usuarios:** tokens y `created_at` en NULL en los tres usuarios fijos de la plataforma. Lo medí en un banco aparte con base y GoTrue. Arreglo: fechas y `''` en la plataforma, y `created_at` y `updated_at` también en la normalización de la semilla.
   - **Detalles de la prueba:** los healthchecks y las llamadas a GoTrue usan `127.0.0.1`, porque `localhost` no llega al servidor en esas imágenes. Además, `MSYS_NO_PATHCONV` evita que Git Bash convierta `/tmp/…` en una ruta de Windows.
   - **De paso,** la semilla y `sembrar-prueba.sh` corren psql con `VERBOSITY terse` y `SHOW_CONTEXT never`, para que un error no copie la sentencia con las claves ya sustituidas.
4. **Corrida final, sobre `6b098a50`: 19 PASÓ · 0 FALLÓ.** Detalle:
   - paquete de 485 migraciones, 18 sólo-ledger y 3 pendientes;
   - GoTrue y storage-api arriba con su esquema; reset completo en 429 s;
   - una fila del ledger por archivo (482), sin las de `pendingBelowCutoff`, con versiones únicas;
   - default privileges como producción;
   - semilla con `semilla_conteo|2|1|1|1|2|1|1`; operarios VE y CN con PIN bcrypt y cifrado; segunda corrida con los mismos conteos;
   - ningún correo ni teléfono fuera de lo reservado y Vault sin Kommo;
   - **`postgres` creó las 44 policies sobre el `storage.objects` de storage-api**, que estaba NO VERIFICADO;
   - GoTrue lista las cuentas y el admin sintético entra con su clave.
   - Al terminar no quedan contenedores ni redes `zz540*`.

## COMMITS

- `2b0ac5a9` · merge de la rama de la spec (PR #246) en esta rama, sin rebase.
- `9634de08` · `feat(infra): SDD-0540 — overlay del entorno de prueba con clave, noindex y 3.072 MiB`.
- `9a21949b` · `feat(ops): SDD-0540 — aplicar-migracion.sh versiona el método del Director`.
- `8b747383` · `feat(ops): SDD-0540 — scripts del entorno de prueba y semilla sintética`.
- `98df92b3` · `ci: SDD-0540 — workflow build-image-prueba.yml con guard y etiqueta prueba-sha-*`.
- `e2f32947` · `docs(runbooks): SDD-0540 — runbook del entorno de prueba`.
- `353b34e6` · `docs(handoff): SDD-0540 — handoff de la Fase 1 del entorno de prueba`.
- `181dda66` · merge de `origin/main` (`b089422d`, que trae la SDD-0539 y el registro del corte) en esta rama, sin rebase.
  - El índice de specs quedó resuelto sin conflicto: `docs:check` da 526 specs y `sdd:check` sale OK.
  - Las pruebas rápidas de Vitest dan 48/48 después del merge.
  - `main` no cambió nada de `infra/`, `.github/` ni `scripts/`.
- `0097f3a7` · `docs(handoff): SDD-0540 — PR #251 y merge de main en el handoff de la Fase 1`.
- `669c3dc0` · `fix(ops): SDD-0540 — la semilla no desborda abs(hashtext()) con el entero mínimo`: pasa a bigint antes del `abs`. `entorno-prueba-semilla.test.mjs` da 15/15 después del cambio.
- `cd8f1352` · `docs(handoff): SDD-0540 — último commit de la Fase 1 en el handoff`. Es la cabeza que tuvo el CI verde (run 38878089858) y sobre la que el Director corrió las pruebas pesadas.
- **Seguimiento del 2026-10-16:**
  - `f4a442c4` · la semilla corre sobre el esquema de GoTrue y la prueba efímera lo levanta;
  - `8ede9ba5` · la 0038 corre con GoTrue y storage-api arriba (`plataforma-prueba-cierre.sql`);
  - `6b098a50` · GoTrue lista las cuentas de prueba sin el 500;
  - `3552aee7` · `smoke-web.sh --credenciales`, con su prueba;
  - `82c87a87` · §1.9 de `servidor-contabo.md` y §9 de la spec;
  - `e6799269` · merge de `origin/main` (`acd4f53d`, con la #246 ya fusionada);
  - `16802ca4` · espacio que faltaba en la prueba de `--credenciales`;
  - el commit que contiene este documento.

## PR / BRANCH

- Rama `worktree-agent-a7c2c1ce96270fc41` → PR [#251](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/251), en **borrador** contra `main`.
- La #246 (la spec) quedó fusionada en `main` a las 10:04Z (`acd4f53d`), y esta rama ya la tiene por merge. La PR solo suma el §9 al final de la spec.

## PENDIENTES DE ESTA TAREA

1. **CI de la PR sobre la cabeza nueva.** El resultado se lee en la #251. Después del verde no se publica nada más.
2. **Decisiones de diseño para que el Director las confirme o cambie.** No son decisiones de Sam, y las que ya se midieron están en el §9 de la spec:
   - el reset **salta** las esperas de `pendingBelowCutoff` (hoy la 0422 y la 0423), porque producción no las tiene. Medido: 482 filas;
   - las 18 `LEDGER_ONLY` del rebuild registran su fila sin ejecutarse;
   - la 0336 está en CRLF en el blob: el reset acepta CR en las migraciones históricas y `aplicar-migracion.sh` lo rechaza en las nuevas;
   - **la RLS fuera de `public` se apaga durante las migraciones** para que pase la 0038, y el cierre la vuelve a encender en las mismas tablas. La alternativa, editar la 0038, no se puede: está aplicada en producción;
   - la semilla reemplaza en `public` toda columna de texto cuyo nombre termina en email, phone, telefono, whatsapp o celular. Ninguna regla escrita lo pedía;
   - el workflow acepta `PRUEBA_VAPID_PUBLIC_KEY` vacía, porque el §2.7 permite prueba sin push;
   - el `basicAuth` usa un bcrypt `$2a$` calculado con pgcrypto, porque en el VPS no hay `htpasswd`. Que Traefik lo acepte es una inferencia sobre `go-http-auth` y lo mide la Fase 3;
   - Mailpit está en `dtd_edge` para que Traefik llegue a `/correo/`; sin `MP_SMTP_RELAY_*` no reenvía nada.
3. **Revisión de Contabo de `smoke-web.sh --credenciales`.** Lo pidió como condición de su OK.

## FUERA DE ALCANCE DETECTADO

1. **Las migraciones siembran demo con contactos de formato real.**
   - **Qué hay.** La 0006 siembra clientes con correos `@demosa.com.ve`, `@cargaejemplo.com`, `@localpyme.ve`, … y teléfonos `+58 414 1234567`, `+58 412 8888888`, …. La 0010 trae agentes de aduana, la 0011 choferes con cédulas `V-15.342.881`, … y la 0160 y la 0161, nómina y contratistas.
   - **Riesgo.** Esos números o dominios pueden ser de personas o empresas reales. También están en producción (inferencia: las migraciones se aplicaron allá). En prueba los neutraliza la semilla, comprobado en la prueba efímera.
   - **Propuesta.** Revisarlo con `revisar-datos-ve` en otra tarea.
2. **`IDENTITY_CNE_PROVIDER` sin valor cae a `cedulave`** (`lib/studio/identity/index.ts:51`). En prueba, verificar una cédula llamaría al servicio externo con el número inventado. Hace falta un modo apagado o mock para `APP_ENV=staging`: es producto, de la Fase 2 o de una SDD aparte.
3. **La 0038 y la RLS de GoTrue y storage-api.** Fuera de prueba, cualquier base que se reconstruya con los servicios arriba (restore de desastre, otro entorno) se encuentra con la misma rotura. Hoy lo resuelve solo la plataforma de prueba.

## Dependencias con otros trabajos

- **SDD-0541** (publicación automática a producción): no se tocaron `build-image.yml` ni `infra/ops/web/desplegar.sh`. Si la 0541 limita `sha-*` a `main` (§6, punto 2 de la 0540), el workflow de prueba no se ve afectado: solo publica `prueba-sha-*`.
- **SDD-0505 / sesión de Contabo.**
  - `infra/ops/web/smoke-web.sh` cambió **con su aprobación y sus condiciones**: lo opcional, `-K` en `pedir()`, nada por argv, salida 2 y los `openssl` sin la clave.
  - Su §1.9 de `servidor-contabo.md` se reescribió por pedido suyo.
  - No se tocaron `corte-paso2.sh`, `telegram-webhook.sh` ni las etiquetas de Traefik de `compose.yml`.
  - Le toca el §2 del runbook nuevo, en la Fase 3.

## Impacto documental y conocimiento

- **Documentos canónicos:**
  - `docs/runbooks/entorno-prueba.md`, nuevo, con `smoke-web.sh --credenciales`;
  - `docs/runbooks/servidor-contabo.md` §1.9: entorno de prueba e histórico fechado del staging de la Fase 2;
  - spec 0540, §9 «Seguimiento de la Fase 1»;
  - las filas del overlay y de las piezas nuevas en `infra/dtd-cargo/README.md` e `infra/ops/README.md`.
- **Graphify, Archify y Obsidian:** NO DISPONIBLE en este worktree (ver VALIDACIÓN). Nada de esta rama está en `semanticPilot`. El Director publica desde main integrado.

## HANDOFF AL DIRECTOR

1. Revisar la PR #251, en borrador. Es contra `main`, que está congelado: no se fusiona sin tu decisión.
2. Ver el CI de la cabeza nueva en la #251.
3. Confirmar o cambiar las decisiones del pendiente 2.
4. Pasarle a la sesión de Contabo `smoke-web.sh --credenciales` y su prueba para que los revise.
5. Fase 3: el §2 de `docs/runbooks/entorno-prueba.md`. Antes, Sam confirma D4–D11 por nombre, como pide el §8 de la spec.
6. Ownership: el claim `worker-0540-fase1-a7c2c1ce` se libera al cerrar. El worktree y la rama se conservan.
