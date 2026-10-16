# Handoff · SDD-0540 · Fase 1 · Entorno de prueba (solo repo)

| Campo | Valor |
|---|---|
| Fecha | 2026-10-16, de 07:54 a 09:10 UTC aprox. (Caracas: 03:54 a 05:10) |
| Task ID / owner | `0540-fase-1-entorno-prueba` / subagente Worker lanzado por la sesión Director, claim `worker-0540-fase1-a7c2c1ce` |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a7c2c1ce96270fc41` |
| Rama | `worktree-agent-a7c2c1ce96270fc41` |
| Base | `origin/main` `6da8aebc`, más el merge (`2b0ac5a9`, sin rebase) de `worktree-agent-a3485995997ab5c0f`: PR #246, cabeza `e6c67c4e`, con la spec de la 0540 |
| SDD | [0540](../../docs/specs/0540-entorno-prueba-staging/spec.md), `proposed`. La spec vive en la PR #246 y esta rama **no la modifica** |
| Estado de la tarea | lista para revisión. Quedan pendientes las dos corridas pesadas, que esperan el turno del Director |
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
| `infra/ops/tests/prueba-resetear-base-efimera.sh` | **pesada**, todas las migraciones del HEAD |
| `scripts/__tests__/entorno-prueba-{compose,semilla,runbook,scripts}.test.mjs`, `build-image-prueba-workflow.test.mjs` | Vitest, sin Docker; entran a `pnpm test` y al CI |

## VALIDACIÓN

Todo sobre la cabeza `e2f32947` (los cinco commits de producto). El commit del handoff no toca código.

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
| `bash infra/ops/tests/prueba-aplicar-migracion-efimera.sh` | **NO EJECUTADO**: corrida pesada, la pide el Director. Comando exacto: `bash infra/ops/tests/prueba-aplicar-migracion-efimera.sh`. Levanta `zz540e-staging-db-1` sin red y lo borra |
| `bash infra/ops/tests/prueba-resetear-base-efimera.sh` | **NO EJECUTADO**: corrida pesada (484 migraciones), la pide el Director. Comando exacto: `bash infra/ops/tests/prueba-resetear-base-efimera.sh`, desde este worktree en la cabeza de la PR, que ya trae los archivos de la Fase 1 |
| `pnpm verify` | **NO EJECUTADO**: lo excluye el encargo. No cambia código de producto: `app/`, `lib/`, `components/` y `supabase/` quedan intactos |
| `pnpm typecheck` y `pnpm lint` completos | **NO EJECUTADO**: las pruebas nuevas son `.mjs`, fuera del `include` de tsconfig; ESLint se corrió sobre ellas |
| `corepack pnpm knowledge:status` | **NO DISPONIBLE**: `structural INVALID`, `semantic INVALID`, `archify PENDING` («ARCHIFY_RUNTIME_MISSING») y `obsidian PENDING`. Este worktree no tiene los derivados |
| `knowledge:visual` / `knowledge:visual:check` | **NO DISPONIBLE**: falta el runtime de Archify 2.16.0 en el worktree |

## COMMITS

- `2b0ac5a9` · merge de la rama de la spec (PR #246) en esta rama, sin rebase.
- `9634de08` · `feat(infra): SDD-0540 — overlay del entorno de prueba con clave, noindex y 3.072 MiB`.
- `9a21949b` · `feat(ops): SDD-0540 — aplicar-migracion.sh versiona el método del Director`.
- `8b747383` · `feat(ops): SDD-0540 — scripts del entorno de prueba y semilla sintética`.
- `98df92b3` · `ci: SDD-0540 — workflow build-image-prueba.yml con guard y etiqueta prueba-sha-*`.
- `e2f32947` · `docs(runbooks): SDD-0540 — runbook del entorno de prueba`.
- Además, el commit que contiene este documento.

## PR / BRANCH

- Rama `worktree-agent-a7c2c1ce96270fc41`, PR en **borrador** contra `main`. La URL va en el reporte al Director y en la descripción de la PR.
- La PR contiene la spec (el merge de la #246). **Conviene fusionar primero la #246.** Si la #246 cambia la spec antes, esta rama hace merge de su cabeza nueva.

## PENDIENTES DE ESTA TAREA

1. **Las dos corridas pesadas,** con turno del Director: `prueba-aplicar-migracion-efimera.sh` y `prueba-resetear-base-efimera.sh`. La del reset es la primera vez que las migraciones de `main` corren con el envoltorio y la plataforma de prueba:
   - si falla en una migración, la evidencia trae `falla-<nombre>.err`;
   - si falla en la semilla, `semilla.out` dice qué tabla o columna quedó fuera de lo reservado.

   La acción de la semilla sobre esos datos se decidió así, sin una regla escrita que la pidiera: reemplaza en `public` toda columna de texto cuyo nombre termina en email, phone, telefono, whatsapp o celular.
2. **`smoke-web.sh` con la clave del web.** Es la fila opcional de la Fase 1 y **no se hizo**: el archivo es de la sesión de Contabo. Propuesta:
   - agregar `--credenciales <archivo>` (una línea `usuario:clave`);
   - armar un `curl -K` con `user = "…"` en un archivo 600, como `prueba_smoke_puerta` de `infra/ops/staging/lib-prueba.sh`;
   - con la opción, esperar 401 sin la clave y 200 con ella.

   Mientras tanto, `desplegar-prueba.sh` y `crear-prueba.sh` hacen el smoke de la puerta.
3. **Decisiones de diseño para que el Director las confirme o cambie.** No son decisiones de Sam:
   - el reset **salta** las esperas de `pendingBelowCutoff` (hoy la 0422 y la 0423), porque producción no las tiene. Para ensayarlas se usa `aplicar-migracion.sh` sobre la base reseteada. Con esto el ledger queda con una fila por archivo **menos las pendientes**, no por todos los archivos como decía la letra del §3;
   - las 18 `LEDGER_ONLY` del rebuild registran su fila sin ejecutarse;
   - la 0336 está en CRLF en el blob: el reset acepta CR en las históricas y `aplicar-migracion.sh` lo rechaza en las nuevas;
   - el reset levanta GoTrue y storage-api **antes** de las migraciones. Es el orden de la CLI de Supabase, pero en este servidor está **NO VERIFICADO**: depende de que `postgres` pueda crear policies sobre `storage.objects`, que es de storage-api, y lo mide la Fase 3. La prueba efímera usa el camino sin servicios, el mismo del rebuild;
   - el workflow acepta `PRUEBA_VAPID_PUBLIC_KEY` vacía, porque el §2.7 permite prueba sin push. El texto del guard del §2.5 pedía todas no vacías;
   - el `basicAuth` usa un bcrypt `$2a$` calculado con pgcrypto, porque en el VPS no hay `htpasswd`. Traefik lo acepta (inferencia sobre `go-http-auth`); la Fase 3 lo mide;
   - Mailpit está en `dtd_edge` para que Traefik llegue a `/correo/`. Antes estaba solo en la red interna, pero sin `MP_SMTP_RELAY_*` no reenvía nada (lo vigila el revisor).

## FUERA DE ALCANCE DETECTADO

1. **Las migraciones siembran demo con contactos de formato real.**
   - **Qué hay.** La 0006 siembra clientes con correos `@demosa.com.ve`, `@cargaejemplo.com`, `@localpyme.ve`, … y teléfonos `+58 414 1234567`, `+58 412 8888888`, …. La 0010 trae agentes de aduana, la 0011 choferes con cédulas `V-15.342.881`, … y la 0160 y la 0161 nómina y contratistas.
   - **Riesgo.** Esos números o dominios pueden ser de personas o empresas reales. Están también en producción (inferencia: las migraciones se aplicaron allá). En prueba los neutraliza la semilla.
   - **Propuesta.** Revisarlo con `revisar-datos-ve` en otra tarea.
2. **`IDENTITY_CNE_PROVIDER` sin valor cae a `cedulave`** (`lib/studio/identity/index.ts:51`). En prueba, verificar una cédula llamaría al servicio externo con el número inventado (`V-99990002` o el de un demo). Hace falta un modo apagado o mock para `APP_ENV=staging`: es producto, Fase 2 o una SDD aparte.
3. **`docs/runbooks/servidor-contabo.md`** sigue describiendo el staging de la Fase 2: §1.9 dice `dtd-cargo-staging` con el host `staging.dtdcargo.com` y la lista de IP. Le corresponde a la sesión de Contabo (SDD-0505) apuntar ahí a `docs/runbooks/entorno-prueba.md`. No lo toqué.
4. **`smoke-web.sh` no conoce la puerta del web.** Contra prueba, todo da 401 (pendiente 2, propuesta para su dueño).

## Dependencias con otros trabajos

- **SDD-0541** (publicación automática a producción): no se tocaron `infra/ops/web/` ni `build-image.yml`. Dependencia: si la 0541 cambia `build-image.yml` para limitar `sha-*` a `main` (§6, punto 2 de la 0540), el workflow de prueba no se ve afectado, porque solo publica `prueba-sha-*`.
- **SDD-0505 / sesión de Contabo:** no se tocaron `corte-paso2.sh`, `telegram-webhook.sh`, `smoke-web.sh` ni las etiquetas de Traefik de `compose.yml`. Le tocan el §2 del runbook nuevo (Fase 3) y la propuesta de `smoke-web.sh`.

## Impacto documental y conocimiento

- **Documentos canónicos.** Hay uno nuevo, `docs/runbooks/entorno-prueba.md`. En `infra/dtd-cargo/README.md` y `infra/ops/README.md` cambiaron solo las filas del overlay y de las piezas nuevas.
- **La spec 0540 no se modificó.** Propuesta para el Director: al integrar, sumar en la spec un §9 «Seguimiento · Fase 1» que apunte a esta PR y a este handoff, y registrar los pendientes 1 y 3.
- **Graphify, Archify y Obsidian:** NO DISPONIBLE en este worktree (ver VALIDACIÓN). Nada de esta rama está en `semanticPilot`. El Director publica desde main integrado.

## HANDOFF AL DIRECTOR

1. Revisar la PR, en borrador. Es contra `main`, que está congelado: no se fusiona sin tu decisión.
2. Dar turno a las dos corridas pesadas, con los comandos de VALIDACIÓN, y registrar su resultado aquí o en la PR.
3. Confirmar o cambiar las decisiones de diseño del pendiente 3.
4. Pasarle a la sesión de Contabo la propuesta de `smoke-web.sh` y el punto 3 de FUERA DE ALCANCE.
5. Fase 3: el §2 de `docs/runbooks/entorno-prueba.md`. Antes, Sam confirma D4–D11 por nombre, como pide el §8 de la spec.
6. Ownership: claim `worker-0540-fase1-a7c2c1ce` liberado al cerrar. El worktree y la rama se conservan.
