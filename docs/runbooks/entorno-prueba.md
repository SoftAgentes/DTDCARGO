# Runbook · Entorno de prueba (`prueba.dtdcargo.com`) · SDD-0540

Cómo se crea, se usa, se resetea y se destruye el entorno de prueba del VPS. Es la Fase 1 de la [SDD-0540](../specs/0540-entorno-prueba-staging/spec.md): piezas del repo. Levantarlo en el servidor es la Fase 3, con su propio encargo.

## 0 · Qué es y qué no

- **Tres peldaños (D1).**
  - Local: el Worker programa y prueba.
  - Prueba: Sam mira la rama en `https://prueba.dtdcargo.com` y la aprueba.
  - Producción: se llega solo con la autorización de Sam.
- **Mismo VPS, otro proyecto.** El proyecto compose es `dtd-cargo-staging`, en `/srv/dtd-cargo-staging`. Tiene su propia base, Auth, Storage, functions y secretos. Los hosts son `prueba.dtdcargo.com` y `supabase-prueba.dtdcargo.com` (D3).
- **Solo datos sintéticos (D2).** Ningún cliente real:
  - correos `@….test`;
  - teléfonos `+1 202 555 0100` a `0199`;
  - RIF y nombres marcados con `PRUEBA`.
  Lo vigilan la semilla y `scripts/__tests__/entorno-prueba-semilla.test.mjs`.
- **Puerta (D4).** El web y el buzón `/correo/` piden una clave (basicAuth de Traefik). La API queda como en producción: sin `apikey` responde 401. Los dos hosts mandan `X-Robots-Tag: noindex, nofollow`. Si algún día entra una copia real, antes se vuelve a la lista de IP en los dos hosts (otra SDD).
- **Sin integraciones (D8 y D9).** No hay Resend, Telegram, Kommo, VAPID, Anthropic, SeaRates ni R2. Los correos de Auth caen en Mailpit; los de la app quedan en modo mock.
- **Un despliegue a prueba no necesita el OK de Sam (D5).** Producción sí lo necesita, y cada migración en producción también.
- **No es producción.** Nada de aquí escribe en `dtd-cargo`. Todos los scripts rechazan el proyecto `dtd-cargo` y cualquier proyecto que no termine en `-staging`.

Fase 2 (SDD-0544): la imagen de prueba se construye con `NEXT_PUBLIC_GA_ID=off`, que apaga Google Analytics y Ads. El smoke lo comprueba con `--sin-ga` (§3) y `verificar-aislamiento.sh --exigir-sin-ga` lo exige en `.next/static`. Una imagen construida antes de la Fase 2 todavía trae GA: sale AVISO, o FALLÓ con `--exigir-sin-ga`.

## 1 · Piezas

| Archivo | Dónde corre | Qué hace |
|---|---|---|
| `infra/dtd-cargo/compose.staging.yml` | VPS | overlay: límites de RAM (3.072 MiB en total, D10), `noindex`, clave del web, Mailpit en `/correo/`, Postgres de prueba |
| `infra/ops/staging/prueba.sets` | VPS | valores fijos del `.env` de prueba (hosts, `APP_ENV=staging`, `DISABLE_SIGNUP=true`) |
| `infra/ops/staging/env-prueba.sh` | VPS | genera el `.env` con `new-env.sh` y borra las líneas `X=` vacías y las marcas |
| `infra/ops/staging/clave-web-prueba.sh` | VPS | clave de la puerta del web: bcrypt en la base de prueba y la clave en `secretos/clave-web.txt` |
| `infra/ops/staging/verificar-aislamiento.sh` | VPS | prueba no comparte secretos, hosts ni integraciones con producción; Vault y bundle limpios |
| `infra/ops/staging/resetear-base-prueba.sh` | checkout y VPS | base desde cero con las migraciones de un SHA de `main` y la semilla |
| `infra/ops/staging/plataforma-prueba.sql` | VPS | extensiones, default privileges de producción y ledger, antes de las migraciones |
| `infra/ops/staging/semilla-prueba.sql` · `sembrar-prueba.sh` | VPS | admin, operario VE, operario CN, cliente del Portal y proveedor CN |
| `infra/ops/staging/crear-prueba.sh` | VPS | orquesta todo lo anterior |
| `infra/ops/staging/desplegar-prueba.sh` | VPS | sube la imagen de una rama a prueba |
| `infra/ops/migrate/aplicar-migracion.sh` | checkout y VPS | una migración con su fila del ledger, con el método del Director (§2.6) |
| `.github/workflows/build-image-prueba.yml` | GitHub | imagen `prueba-sha-<sha>` con las variables `PRUEBA_*` |

Los scripts del VPS viven en `/srv/ops` (copia de `infra/ops/`). Los paquetes que se copian por `scp` van a `/srv/ops/paquetes/` (700). Las evidencias quedan en `/srv/ops/evidencias/`.

## 2 · Crear prueba desde cero (Fase 3)

Actores: **Sam** (DNS y GitHub), **Contabo** (la sesión con SSH) y el **Director** (pide y revisa). `<sha>` es el SHA completo de `main` que se monta.

1. **Medir antes (Contabo).** `free -m`, `df -h /` y `docker stats --no-stream`. Anotar el `RestartCount` de los contenedores de producción.
2. **Limpiar los restos de 2026-10 (Contabo).** Usar `destroy-staging.sh` con `--purge-config` (§7).
3. **Copiar las piezas (Contabo).** Desde su checkout en `<sha>`:
   - `infra/dtd-cargo/` a `/srv/dtd-cargo-staging/` (700);
   - `infra/ops/` a `/srv/ops/`;
   - armar `/srv/dtd-cargo-staging/functions/` con el README de `infra/dtd-cargo` › Arrancar;
   - verificar el sha256 de lo copiado.
4. **Generar el `.env` (Contabo).** La primera corrida de `crear-prueba.sh` lo genera y se detiene: la imagen tiene que llevar la anon de ese `.env`.

   ```bash
   /srv/ops/staging/crear-prueba.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --sha <sha> --bundle /srv/ops/paquetes/prueba-<sha12>
   ```

5. **Entorno `prueba` de GitHub (Sam o Director).** Las variables tienen nombres distintos de los de producción. La anon sale del `.env` del servidor por SSH, sin pasar por el chat. Es la anon de prueba y es pública: viaja en el JavaScript.

   ```bash
   gh api -X PUT repos/hailuwaycom-sketch/DTDCARGO/environments/prueba
   gh variable set PRUEBA_SITE_URL --env prueba --body https://prueba.dtdcargo.com
   gh variable set PRUEBA_SUPABASE_URL --env prueba --body https://supabase-prueba.dtdcargo.com
   gh variable set PRUEBA_AUTH_COOKIE --env prueba --body sb-prueba-auth-token
   ssh root@217.216.54.70 "grep -E '^ANON_KEY=' /srv/dtd-cargo-staging/.env | cut -d= -f2-" | gh variable set PRUEBA_SUPABASE_ANON_KEY --env prueba
   gh variable list --env prueba
   ```

   `PRUEBA_VAPID_PUBLIC_KEY` queda sin definir: en prueba no hay push (D8).

6. **Imagen de `main` (Director).**

   ```bash
   gh workflow run build-image-prueba.yml --ref main -f sha=<sha>
   gh run watch <id> --exit-status
   ```

   El workflow falla antes de construir en cualquiera de estos casos:
   - falta una variable `PRUEBA_*`;
   - `PRUEBA_SUPABASE_URL` no es `https://supabase-prueba.dtdcargo.com`;
   - un valor apunta a producción o a Supabase Cloud.

   Publica la imagen recién cuando el bundle, revisado sin red, nombra el host de prueba y no el de producción.
7. **Paquete de la base (en el checkout, en `<sha>`).**

   ```bash
   infra/ops/staging/resetear-base-prueba.sh --preparar /tmp/prueba-<sha12> --to-sha <sha>
   scp -r /tmp/prueba-<sha12> root@217.216.54.70:/srv/ops/paquetes/
   ```

8. **Base, semilla y clave (Contabo).** Es el mismo comando del paso 4: ahora el `.env` existe y sigue de largo. Corre `verificar-aislamiento.sh` antes de levantar nada y otra vez con la base arriba, y termina con «base lista».
9. **DNS (Sam).** Registros A `prueba` y `supabase-prueba` a `217.216.54.70`, con TTL 300, en Hostinger.
10. **El resto del stack (Contabo),** recién con el DNS resolviendo: Let's Encrypt corta a los 5 fallos por hora.

    ```bash
    /srv/ops/staging/crear-prueba.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --sha <sha> --solo-arrancar --con-dns
    ```

    Comprueba que los dos hosts resuelvan al VPS y levanta `api-gw realtime functions mailpit web cron`. Después corre el smoke de la puerta:
    - sin clave, 401;
    - con clave, 200 en `/`, `/studio/login` y `/correo/`;
    - `noindex` en los dos hosts;
    - la API sin `apikey`, 401.
11. **Cuentas (Sam).** Sam las lee por SSH:
    - la clave del web, en `/srv/dtd-cargo-staging/secretos/clave-web.txt`;
    - las cuentas sintéticas, en `/srv/dtd-cargo-staging/secretos/cuentas-prueba.txt`: admin, PIN VE, PIN CN, correo del Portal y link del proveedor.

    Las guarda en su gestor. Los scripts nunca las imprimen.
12. **Smoke por rol (Sam).** Las pantallas están en la aceptación de la Fase 3, §3 de la spec:
    - Studio;
    - `/m/ve` y `/m/cn` con PIN;
    - Portal con el enlace mágico leído en `/correo/`;
    - una subida y su descarga;
    - Realtime;
    - service worker y manifiesto de la PWA detrás de la clave.

## 3 · Subir una rama a prueba

1. **Director.** Construye la imagen del head:

   ```bash
   gh workflow run build-image-prueba.yml --ref <rama> -f sha=<sha del head>
   gh run watch <id> --exit-status
   ```

2. **Contabo.** Despliega:

   ```bash
   /srv/ops/staging/desplegar-prueba.sh --project dtd-cargo-staging --sha <sha> --image ghcr.io/hailuwaycom-sketch/dtdcargo:prueba-sha-<sha> --pr <número> --quien "<sesión>"
   ```

   El script hace, en orden:
   - `pull`;
   - `verificar-aislamiento.sh` completo (si falla, no cambia nada);
   - respaldo del `.env`;
   - `DTD_WEB_IMAGE` nuevo y `up -d --no-deps web`;
   - healthcheck y smoke de la puerta;
   - `EN-PRUEBA.txt` y la evidencia en `/srv/ops/evidencias/prueba-desplegar-<ts>.txt`.

   Si falla después del cambio, imprime cómo volver a la imagen anterior.
3. **Contabo, opcional.** Corre el smoke completo de la web, detrás de la clave. Sin `--credenciales`, contra prueba todo da 401.

   ```bash
   /srv/ops/web/smoke-web.sh --host prueba.dtdcargo.com --credenciales /srv/dtd-cargo-staging/secretos/clave-web.txt \
       --sin-ga --supabase-host supabase-prueba.dtdcargo.com
   ```

   La clave viaja a curl en un archivo `-K` 600 y nunca por argumentos. El resumen agrega «con credenciales: sí». Dos opciones adaptan el smoke de producción a prueba:
   - `--sin-ga` invierte la regla de Google Analytics. La imagen de prueba (Fase 2, SDD-0544) se construye con `NEXT_PUBLIC_GA_ID=off`, así que se exige que ni el HTML ni los chunks de la portada traigan GA, Ads ni googletagmanager.
   - `--supabase-host supabase-prueba.dtdcargo.com` es el host que tiene que nombrar la CSP en `connect-src`, en lugar del de producción.

   `verificar-aislamiento.sh --exigir-sin-ga` decide con `/app/.next/static`, que es lo que llega al navegador. Si solo el código del servidor nombra el ID, sale PASÓ con aviso, y el `--sin-ga` del smoke lo confirma en el HTML.
4. **Sam.** Abre `https://prueba.dtdcargo.com`. El panel de entorno del Studio muestra `staging`, el SHA y las integraciones en `mock`.

Una sola ranura: prueba muestra una rama a la vez y el Director decide el turno.

## 4 · Ensayar una migración (D6)

La evidencia vale para **un SHA**. Un commit nuevo que toque la migración o su código obliga a repetir desde el paso 1.

1. **Base de prueba igual a `main`.** Reset al SHA de `main` (§5).
2. **Ventana migrate-first: app vieja con base nueva.**
   - Desplegar la imagen de prueba de `main` (§3).
   - Generar en el checkout, desde el blob del head de la PR. El script revisa CR, barras invertidas, el delimitador y los begin/commit propios.

     ```bash
     infra/ops/migrate/aplicar-migracion.sh --project dtd-cargo-staging --sha <sha del head> --file <NNNN_nombre.sql> --sdd <NNNN> --generar /tmp/apply-<NNNN>
     scp -r /tmp/apply-<NNNN> root@217.216.54.70:/srv/ops/paquetes/
     ```

   - Ejecutar en el VPS con el md5 que imprimió `--generar`:

     ```bash
     /srv/ops/migrate/aplicar-migracion.sh --project dtd-cargo-staging --sha <sha del head> --file <NNNN_nombre.sql> --ejecutar /srv/ops/paquetes/apply-<NNNN> --md5 <md5 de aplicar.sql>
     ```

     Corre la lectura previa (read only), el apply en una transacción con su fila del ledger y la verificación (read only, md5 y bytes del ledger contra el blob). La evidencia queda en `/srv/ops/evidencias/apply-<NNNN>-dtd-cargo-staging-<ts>/`.
   - **Smoke A**, con las pantallas nombradas.
3. **App nueva con base nueva.** Desplegar la imagen del head (§3) y correr el **smoke B** por rol. Sam dice «aprobado en prueba».
4. **El pedido de OK nominal para producción** cita:
   - el md5 de la migración;
   - la salida del apply;
   - los smokes A y B;
   - el SHA.

   Después del apply en producción, el md5 del ledger de producción tiene que ser el de prueba.

`aplicar-migracion.sh` rechaza `dtd-cargo`. Usarlo en producción exige reescribir `docs/runbooks/aplicar-migraciones-prod.md` en otra PR (§6 de la spec).

## 5 · Resetear la base

Hace falta cuando una migración ensayada se abandona o cambia, o cuando la semilla cambió. El reset baja todo el proyecto (`destroy-staging.sh` borra contenedores, volúmenes y datos) y conserva compose, `.env` y `secretos/`.

```bash
infra/ops/staging/resetear-base-prueba.sh --preparar /tmp/prueba-<sha12> --to-sha <sha>
scp -r /tmp/prueba-<sha12> root@217.216.54.70:/srv/ops/paquetes/
/srv/ops/staging/resetear-base-prueba.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --to-sha <sha> --bundle /srv/ops/paquetes/prueba-<sha12>
/srv/ops/staging/crear-prueba.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --sha <sha> --solo-arrancar --con-dns
```

El reset hace, en orden:
- levanta `db`, `auth`, `rest`, `storage` e `imgproxy`;
- aplica `plataforma-prueba.sql`;
- aplica **todas** las migraciones del paquete en orden, cada una en una transacción con su fila del ledger. Se saltan las esperas de `pendingBelowCutoff`, que producción no tiene. Las sólo-ledger (`LEDGER_ONLY` del rebuild) registran su fila sin ejecutarse;
- carga la semilla;
- comprueba una fila del ledger por archivo aplicado o registrado.

La evidencia queda en `/srv/ops/evidencias/reset-dtd-cargo-staging-<ts>/`. Las claves de `secretos/` se conservan entre resets: el admin y los PIN son los mismos.

## 6 · Comprobar el aislamiento a mano

```bash
/srv/ops/staging/verificar-aislamiento.sh --env /srv/dtd-cargo-staging/.env --prod-env /srv/dtd-cargo/.env --project dtd-cargo-staging
```

Da una línea PASÓ, FALLÓ o AVISO por regla y nunca muestra un valor. Compara por sha256 cada valor de prueba con todos los secretos de producción. Si una integración hace falta de verdad (por ejemplo, un bot de Telegram **de prueba**, D8), se permite con nombre: `--permitir TELEGRAM_BOT_TOKEN`. Nunca se copia la clave de producción.

## 7 · Rotar la clave del web y destruir

Para rotar la clave del web, cuando alguien deja de probar:

```bash
/srv/ops/staging/clave-web-prueba.sh --project dtd-cargo-staging --usuario sam
cd /srv/dtd-cargo-staging && docker compose -p dtd-cargo-staging -f compose.yml -f compose.supabase.yml -f compose.staging.yml up -d --no-deps --force-recreate web mailpit
```

Para destruir prueba, con cero restos y sin el `.env`:

```bash
/srv/ops/staging/destroy-staging.sh --project dtd-cargo-staging --confirm dtd-cargo-staging --purge-config --evidence /srv/ops/evidencias/destroy-dtd-cargo-staging-<ts>.txt
```

Para recrearla, se vuelve al §2.

## 8 · Pruebas de las piezas

| Prueba | Qué cubre | Necesita |
|---|---|---|
| `bash infra/ops/tests/prueba-scripts-entorno-prueba.sh` | env, aislamiento (con controles rojos), clave, semilla, reset, despliegue y creación, con dobles de docker y curl | bash, openssl, git, node |
| `bash infra/ops/tests/prueba-aplicar-migracion.sh` | contrato del envoltorio y rechazos de `aplicar-migracion.sh`, con dobles | ídem |
| `bash infra/ops/tests/prueba-compose-prueba.sh` | `docker compose config` del overlay: memoria ≤ 3.072 MiB, `noindex` en todos los routers, clave en el web y el buzón | Docker (solo valida) |
| `bash infra/ops/tests/prueba-aplicar-migracion-efimera.sh` | una migración con su fila en una transacción; un error a la mitad no deja ni objeto ni fila | Docker, **corrida pesada** |
| `bash infra/ops/tests/prueba-resetear-base-efimera.sh` | todas las migraciones del HEAD con una fila del ledger por archivo; semilla idempotente y con sus cinco roles | Docker, **corrida pesada**, varios minutos |
| `scripts/__tests__/entorno-prueba-*.test.mjs` y `build-image-prueba-workflow.test.mjs` | overlay, semilla, `prueba.sets`, workflow y este runbook (Vitest, sin Docker) | `pnpm test` |

Las corridas pesadas piden turno al Director: una a la vez.

## 9 · Dependencias y pendientes

- **Fase 2 (producto):** apagar Google Analytics y Ads en el build, el aviso visible «Entorno de prueba» (D11) y, si se pide, el buzón de prueba para los correos de la app (D9).
- **Fase 3 (servidor):** todo el §2 y su aceptación.
- **Producción:** el runbook nuevo de migraciones en el servidor propio, para usar `aplicar-migracion.sh` también ahí (otra PR).
