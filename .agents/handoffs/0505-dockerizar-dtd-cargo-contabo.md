# Handoff · SDD-0505 — Dockerizar DTD Cargo para el servidor propio en Contabo (Fase 0)

- **Owner:** Claude Worker (sesión `claude-76245a75`), por encargo directo de Sam el 2026-10-08.
- **Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\dockerizar-dtd-cargo-contabo`
- **Rama:** `codex/dockerizar-dtd-cargo-contabo` (desde `origin/main` = `c3d37a8e`), reserva `codex/sdd-reserve-0505-dockerizar-dtd-cargo-contabo` (`1f9ea0d9`, local, sin push).
- **Claim:** `node scripts/harness-worktree.mjs claim --owner claude-76245a75` adquirido el 2026-10-08.
- **Objetivo:** Fase 0 del plan de transferencia a Contabo: imagen Docker de la app, compose de Supabase self-hosted, cierre de acoplamientos a Vercel y Supabase Cloud, plantilla multi-proyecto, CI de imagen, runbooks de servidor y backup. Sin tocar producción.
- **SDD:** `docs/specs/0505-dockerizar-dtd-cargo-contabo/spec.md` (aceptación y allowlist ahí; § Seguimiento con la evidencia fechada).
- **Permisos:** Sam aprobó el plan completo (ventana de planificación, 2026-10-08), incluida la PR al final. No autoriza aplicar la migración 0472 a producción, ni exportar producción, ni cambiar DNS, ni pausar Vercel/Cloud.
- **Dependencias:** Docker Desktop para `check-schema-rebuild`/`sql-tests`/build local; turno del Director para `pnpm verify` completo (una corrida pesada a la vez).
- **Construcción en paralelo:** varias áreas (infra, código, migración, CI, docs) escriben en este mismo worktree sobre archivos asignados sin solapamiento. Este handoff lo mantiene el área docs; cada casilla de «Estado» se marca **solo** cuando el archivo existe en el worktree y su prueba focalizada reporta PASÓ con conteo, y se anota quién lo midió.

## Estado consolidado (Worker, 2026-10-08, después de que la construcción en paralelo se cortara por errores de red y se retomara a mano)

- [x] **Infra:** `Dockerfile`, `.dockerignore`, `infra/dtd-cargo/` (compose, Supabase self-hosted, overlay S3, cron, plantillas de Auth, `.env.example`, README), `infra/templates/proyecto/`, `infra/ops/` (Traefik, Uptime Kuma, backup). Evidencia abajo.
- [x] **Código:** `lib/runtime/*`, `deployActions`, `env-status`, `sender`, `unsubscribe-request`, `request-ip`, `next.config.ts`, con sus pruebas. Evidencia abajo.
- [x] **Migración 0472 + pruebas SQL/PGlite**, con la espera declarada en `pendingBelowCutoff` (MIGRATE-FIRST). Evidencia abajo.
- [x] **CI build-image** (`.github/workflows/build-image.yml`). No se ejecutó en GitHub: corre en push a `main` o con `workflow_dispatch`.
- [x] **Docs:** runbooks, `setup-portal-auth`, `.env.example`, índices.
- [ ] **Validación:** todo lo focalizado PASÓ, incluido el rebuild sobre `supabase/postgres:17.6.1.136` (aceptación 2b, cerrada). **NO EJECUTADO:** `pnpm verify` completo (pide turno del Director: una corrida pesada a la vez).
- [ ] **Commits + PR:** commits selectivos hechos (`f82554b1`, `1ec7c377`, `ef955fc2`, `5dfe4a3b` + el de la migración y este handoff). PR: draft, porque falta `verify` completo y la decisión 2b.

## Evidencia consolidada · Worker (2026-10-08, sobre el árbol completo antes de los commits)

| Comprobación | Comando | Resultado literal |
|---|---|---|
| Lint | `corepack pnpm lint` | PASÓ · exit 0 · 0 errores, 15 warnings, todos en archivos que esta tarea no toca |
| Tipos | `NODE_OPTIONS=--max-old-space-size=4096 corepack pnpm typecheck` | PASÓ · exit 0 |
| Frontera RSC | `node scripts/check-rsc-boundary.mjs` | PASÓ · exit 0 |
| Índice de docs | `corepack pnpm docs:check` | PASÓ · exit 0 |
| Numeración | `corepack pnpm sdd:check` | PASÓ · exit 0 · sin números repetidos |
| Símbolos pendientes | `node scripts/check-pending-migration-symbols.mjs` | PASÓ · 0 ROJO · 0 AMARILLO (la 0472 no crea símbolos y la app no llama a esas funciones) |
| Espacios | `git diff --check` | PASÓ · exit 0 |
| Pruebas focalizadas | `vitest run lib/runtime lib/http lib/studio/newsletter lib/studio/attachments "app/studio/(app)/_actions" scripts/__tests__/build-crontab.test.ts scripts/__tests__/infra-env-example.test.ts lib/studio/__tests__/kommo-functions-base-url.migration.test.ts --pool=forks` | PASÓ · 22 archivos · 222 pruebas |
| 0472 en PGlite | `vitest run lib/studio/__tests__/kommo-functions-base-url.migration.test.ts --pool=forks --maxWorkers=1` | PASÓ · 12/12 (control rojo, mutantes y comparación línea a línea con 0084/0136) |
| Crontab | `node scripts/build-crontab.mjs --check` | PASÓ · exit 0 |
| Compose DTD | `docker compose -f infra/dtd-cargo/compose.yml -f …compose.supabase.yml -f …compose.supabase.s3.yml --env-file <copia de .env.example> config` | PASÓ · exit 0 · 11 servicios + Studio por profile · ningún `ports:` ni `container_name` · red de la base `internal: true` · límites de memoria ≈9,5 GB |
| Compose plantilla | `docker compose -f infra/templates/proyecto/compose.yml --env-file <.env.example con valores de prueba> config` | PASÓ · 9 servicios (Supabase recortado + web + cron) · sin puertos · red interna. Con el `.env.example` vacío FALLA a propósito: exige `CRON_SECRET` |
| Compose ops | `docker compose config` en `infra/ops/traefik` e `infra/ops/uptime-kuma` | PASÓ · exit 0 |
| Scripts | `bash -n` de `infra/ops/backup/*.sh`, `infra/templates/proyecto/backup.sh`, `infra/dtd-cargo/cron/entrypoint.sh` | PASÓ |
| Imagen | `docker build -t dtdcargo:0505-test --build-arg NEXT_PUBLIC_SUPABASE_URL=https://api.example.test …` | PASÓ · 138 s (deps en caché; `next build` completo: 162 páginas) · 518 MB descomprimida (127 MB de contenido) · usuario `node` |
| Arranque de la imagen | `docker run … dtdcargo:0505-test` + `curl` | PASÓ · `/robots.txt` 200 a los ~2 s · `/` 200 · `/tarifas` 200 · `/entrar` 200 · `/studio` 307 → `/studio/login` · CSP, `X-Frame-Options: DENY` y HSTS presentes · healthcheck `healthy` |
| CSP con origen propio | encabezado de la imagen construida con `NEXT_PUBLIC_SUPABASE_URL=https://api.example.test` | PASÓ · `img-src`/`media-src` con `https://api.example.test`; `connect-src` con `https://` y `wss://api.example.test`; `*.supabase.co` se conserva |
| Rebuild sobre `postgres:17` | `node scripts/check-schema-rebuild.mjs` | PASÓ · 30 s · 450 migraciones aplicadas desde cero + 18 sólo-ledger = 468 (0472 incluida) |
| Contratos SQL | `node scripts/run-sql-tests.mjs` | PASÓ · 86 s · 225 contratos, `0472_kommo_functions_base_url.test.sql` incluido · rollback total |
| Rebuild sobre `supabase/postgres:17.6.1.136` | `corepack pnpm schema:rebuild:supabase` | PASÓ · 26 s · 450 migraciones + 18 sólo-ledger + aislamiento multi-tenant (219 tablas). Antes FALLABA: primero en los stubs de `postgres:17` (línea 43) y, con los stubs reducidos, en los guardarraíles de 0268 y 0410 por los default privileges abiertos de la imagen. Cierre en § Cierre de 2b |
| `pnpm verify` completo | — | NO EJECUTADO · requiere turno del Director |

**2b cerrado** (ver § Cierre de 2b). La recomendación anterior, migración aditiva, se descartó al implementarla, porque correría después del guardarraíl de la 0268 que aborta.

## Fase 1 en el VPS (2026-10-09, autorizada por Sam en el plan aprobado; Sam hizo los pasos con contraseña)

**Servidor:** Contabo Cloud VPS 8 · US East (Carlstadt) · `217.216.54.70` · hostname `vmi3518023` · Ubuntu 24.04.5 LTS · kernel 6.8.0-146 · 8 vCPU AMD EPYC (KVM, 1 hilo por núcleo) · 23 GiB RAM · 300 GB SSD (`sda`, no rotacional) · huella ED25519 `SHA256:LVwj61Yj2fItwhdzdAQB8cOj+OXcteFwwKtPpn/5EWA` (después de la reinstalación).

**Acceso:** la reinstalación avanzada con llave no llegó a aplicarse (Sam terminó instalando desde la pestaña estándar, que solo pide contraseña). La llave `sam-contabo-vps-2026-10` (`~/.ssh/contabo` en la laptop de Sam) se agregó a `/root/.ssh/authorized_keys` con la contraseña root, desde PowerShell. El terminal integrado de la app no sirvió: le falta su script de integración en esta máquina.

**Auditoría antes de endurecer:** 10.068 intentos fallidos de contraseña en 24 h (bots; los que más: `77.239.124.49` con 2.376 y `77.239.124.69` con 1.155). Accesos aceptados desde el arranque: solo desde `187.13.210.51` (la IP de Sam): uno con contraseña a las 19:13 al subir la llave y el resto con la llave. Ninguno en el arranque anterior. Sin usuarios extra, llaves ajenas ni crontabs. El usuario `ubuntu` de la imagen tiene la contraseña bloqueada y ninguna llave (tiene `sudo NOPASSWD`, pero no tiene forma de entrar).

| Paso | Resultado verificado |
|---|---|
| Paquetes base | `apt upgrade` + ufw 0.36.2, fail2ban 1.0.2, unattended-upgrades 2.9.1, fio 3.36 |
| SSH | `/etc/ssh/sshd_config.d/00-dtd-hardening.conf`: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`, `MaxAuthTries 3`. Con una conexión nueva: la llave entra y la contraseña sale `Permission denied (publickey)` |
| Firewall | ufw activo: entrada denegada salvo 22, 80 y 443 (v4 y v6) |
| fail2ban | jail `sshd` (5 fallos en 10 min ⇒ 1 h); al arrancar ya bloqueó `195.178.110.232` |
| Actualizaciones | `unattended-upgrades` activo con `20auto-upgrades` |
| Swap | `/swapfile` de 4 GB, `vm.swappiness=10` |
| Docker | 29.9.0 + Compose v5.6.0 desde `download.docker.com`; `daemon.json` con rotación `50m × 3` y `live-restore`; cgroup v2, overlayfs; `hello-world` OK |
| `/srv` | `edge`, `ops`, `dtd-cargo`, `loop-3d`, `renta-aguada` (750, root) |

**Benchmark del día 1** (2026-10-09 17:19 UTC, dentro de la hora pico europea; script en `/srv/ops/bench` sobre el mismo disco):

| Medida | Resultado | Umbral (runbook §1.2) | |
|---|---|---|---|
| Steal de CPU, 30 s en reposo | 0,00 % | < 10 % | PASÓ |
| fio 4k randrw 70/30, iodepth 32, direct, 60 s | 14.995 lectura + 6.432 escritura = **21.428 IOPS**; lectura p95 3,26 ms | ≥ 20.000 | PASÓ (justo) |
| fio 8k con fsync por escritura, 60 s | 302 fsync/s · p50 2,47 ms · **p95 7,24 ms** · p99 13,3 ms · máx 147,94 ms | p95 ≤ 10 ms | PASÓ |
| `pg_test_fsync` (postgres:17, 5 s) | open_datasync 1.982 ops/s (504 µs) · **fdatasync 1.859 ops/s (538 µs)** · fsync 524 ops/s · open_sync 548 ops/s | — | referencia |

**Lectura:** la base de DTD puede vivir en este VPS; no hace falta comprar el VDS. Matices: las IOPS pasan por poco y hay colas de 13-148 ms en fsync, aceptables para el volumen de escritura del ERP (la base mide 69 MB y cabe en `shared_buffers`). **Pendiente:** repetir el benchmark otro día y a otra hora, porque el rendimiento en Contabo varía por nodo y empeora con el tiempo según los reportes de la investigación.

**Pendiente de la Fase 1:** Tailscale (necesita la cuenta de Sam), panel (Dokploy) o Traefik solo, igualar los default privileges cuando se levante Supabase (§2.1 paso 4), snapshot «base limpia» desde el panel y firewall del panel de Contabo como segunda capa. **Ojo con Docker:** los puertos que publica un contenedor saltan ufw. Solo Traefik puede publicar (80/443); un panel en el 3000 quedaría expuesto aunque ufw diga que no.

### Traefik y snapshot (2026-10-09, decisión de Sam: «Traefik solo y saca el snapshot»)

- **Traefik** `v3.7.14` desde `infra/ops/traefik` (commit `a6109b01`) en `/srv/edge/traefik`; red `dtd_edge`; `.env` con `ACME_EMAIL=ops@example.com` a propósito: Let's Encrypt rechaza ese dominio, así que ningún certificado sale hasta que Sam elija correo y dominio. Dentro del servidor: `healthy`, `:80` → 301 a https, `:443` → 404 con «TRAEFIK DEFAULT CERT». Solo Traefik publica puertos (80/443).
- **Desde afuera, 80/443 no responden:** tcpdump en `eth0` capturó 0 paquetes de `187.13.210.51` al puerto 80, así que se cortan antes del VPS. Causa: el **firewall del panel de Contabo** «HailuwayVPS» (activo, último cambio 18 ago 2026) solo acepta TCP 22 y TCP 5900-5999 (`VNC_IA`) y bloquea todo lo demás. **Resuelto con OK de Sam** (2026-10-09: «sí, agrega 80 y 443 y borra VNC_IA»): en `new.contabo.com` → Firewall → HailuwayVPS se agregaron `HTTPS` (ACCEPT TCP 443, origen cualquiera) y `HTTP` (ACCEPT TCP 80, origen cualquiera), y se borró `VNC_IA`. Reglas finales: HTTPS 443 · HTTP 80 · SSH 22 · Block all traffic (DROP). Comprobado desde la laptop de Sam a las 17:47:41 UTC, en el primer intento: `http://217.216.54.70/` → 301 a https; `https://217.216.54.70/` → 404 de Traefik (sin sitios todavía); `:5900` → sin respuesta (cerrado); SSH con la llave sigue entrando.
- **Snapshot** `base-limpia-2026-10-09` creado desde el panel clásico (*VPS control* → *Snapshots*): 09.10.2026 19:37 CEST, borrado automático el 08.11.2026. Antes se hizo `sync` en el servidor. El diálogo del panel nuevo no tomó los valores (el formulario está oculto y no registra lo cargado): usar el panel clásico. El servidor sigue arriba después del snapshot.

### TLS de punta a punta en vps.dtdcargo.com (2026-10-09, decisión de Sam: «usa vps.dtdcargo.com, yo lo creo en Hostinger»)

- **DNS:** Sam creó en Hostinger el registro A `vps` → `217.216.54.70`. Los NS autoritativos (`apollo`/`athena.dns-parking.com`) daban NXDOMAIN con el serial SOA `2026100801` a las 17:55 UTC; Cloudflare y Google DoH resolvieron al VPS a las 18:00:57 UTC.
- **ACME:** `ACME_EMAIL=ops@dtdcargo.com` en `/srv/edge/traefik/.env` (Sam puede cambiarlo). Servicio de prueba `/srv/ops/whoami` (`traefik/whoami:v1.12.0`, red `dtd_edge`, router `Host(vps.dtdcargo.com)`, `security-headers@file`), encendido solo después de que el DNS resolviera, para no gastar reintentos de Let's Encrypt.
- **Certificado:** emisor `Let's Encrypt, CN=YR1`, sujeto `CN=vps.dtdcargo.com`, válido del 2026-10-09 17:02:47 GMT al 2027-01-07 17:02:46 GMT.
- **Pruebas desde la laptop de Sam** (con `--resolve`, porque el resolvedor local seguía con el NXDOMAIN en caché): `http://` → 301 a `https://vps.dtdcargo.com/`; `https://` → 200 con `ssl_verify_result=0`; cabeceras `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, sin `X-Powered-By`. **Spoof de IP:** con `X-Real-Ip: 1.2.3.4` y `X-Forwarded-For: 1.2.3.4` el backend recibió `X-Real-Ip: 187.13.210.51` y `X-Forwarded-For: 187.13.210.51` (la IP real), así que `REQUEST_IP_HEADER=x-real-ip` es seguro detrás de este Traefik sin Cloudflare.

## Cuatro condiciones previas a exportar producción (2026-10-09, decisión de Sam: «sí, arranca con tus cuatro condiciones»)

Origen: revisión `revisar-datos-ve` del traslado (`docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md` §5, condiciones 2-5; las 1, 6 y 7 son de Sam). Todo probado en el VPS con **datos sintéticos** y contenedores desechables: nada de producción se leyó ni se exportó.

**Entregables** (`infra/ops/`):

| Condición | Scripts | Qué garantizan |
|---|---|---|
| 2 · respaldo cifrado (H1) | `backup/pg-dump-to-s3.sh`, `backup/restore.sh` | Claros solo en `/dev/shm`; `age` obligatorio (rechaza sin destinatarios, archivo vacío o clave privada, también en `--dry-run`); al remoto solo `.age` + `.sha256`; restore compara sha256 (código 5) y descifra en memoria; los roles se aplican sin `PASSWORD`; trap de EXIT que borra `/dev/shm` y los contenedores etiquetados de la corrida; rclone con plazos. |
| 3 · raíz de Vault (H2) | `backup/config-backup.sh`, `backup/restore-test.sh --config`, `migrate/vault-set-secret.sh` | `.env` + volumen `db-config` (con `pgsodium_root.key`) cifrados, en prefijo propio, solo si cambiaron; huella de la raíz en el log; secretos escritos con `read -s` y por entorno. |
| 4 · procedimiento del dump (H5, H11) | `migrate/import-from-cloud.sh` | En el VPS, dump en `/dev/shm`, credenciales con `read -s`, tablas de log fuera, ledger y cron aparte, permisos iguales a Cloud, Storage con rclone por `RCLONE_CONFIG_*`, verificación y evidencia sin PII, aviso de revocar la clave S3. |
| 5 · staging efímero (H6) | `staging/destroy-staging.sh`, `backup/restore-test.sh` | Borrado con guardas y comprobación de cero restos; restore mensual en contenedor desechable con PGDATA en tmpfs. |
| prueba | `tests/prueba-traslado-y-respaldos.sh` | Integración de todo lo anterior; corre como root en el VPS. |

**Resultado** (VPS `217.216.54.70`, `age 1.1.1`, CLI de Supabase 2.118.0 instalada con sha256 verificado, `supabase/postgres:17.6.1.136`, `rclone/rclone:1.75.1`): corrida de las 19:39 UTC **53 PASÓ · 0 FALLÓ**, repetida a las 19:44 UTC desde la estructura del repo (`/srv/ops/bench/ops-pr194/tests/prueba-traslado-y-respaldos.sh`, los 8 scripts con el mismo sha256 que el worktree) con el mismo **53 PASÓ · 0 FALLÓ** y salida 0; limpieza en 0 restos en `/dev/shm`, 0 contenedores y 0 volúmenes de prueba. Cifras:

- **C1:** dump de prueba 76K cifrado; remoto con solo `.age`/`.sha256`; `pg_restore --list` falla sobre el `.age`; cifrado alterado → 5; clave equivocada y contraseña mala → fallan sin restos; `kill -TERM` durante la subida → 143 en 1 s, rclone bajado, `/dev/shm` vacío.
- **C2:** huella impresa = sha256 real de `pgsodium_root.key`; segunda corrida sin cambios no sube; `--force` sube; volumen sin raíz → 2.
- **restore-test:** como `supabase_admin` en base nueva, 0 errores de `pg_restore`; filas iguales; Vault **0 de 1** sin `--config` (control) y **1 de 1** con la raíz respaldada; RTO 21-29 s.
- **C3 contra un Cloud falso sembrado como producción** (default privileges cerrados; `public` y ledger creados por `postgres`): 15/15 comprobaciones del script; `mail_logs` vacía (minimización); ledger idéntico por huella de `applied_migration_names()`; cron 1 recreado e inactivo; huella de permisos de `public` `33:9f8be157…` igual en los dos lados; `tenants` con solo `authenticated=SELECT`; la evidencia no contiene la contraseña ni el marcador de datos personales; `vault-set-secret` crea, actualiza sobre el mismo id y no imprime el valor.
- **C4:** rechaza producción, nombres sin `-staging`, `--confirm` distinto y `DTD_DATA_DIR` de producción (3); dry-run no borra; corrida real 0 en todo y no toca otro proyecto compose.

**Lo que encontró el ensayo y quedó corregido** (cada uno con su corrida roja antes):

1. `supabase db dump` **no** trae el esquema `supabase_migrations` (ledger), ni `cron.job`, ni `vault.secrets` → `pg_dump --schema=supabase_migrations` aparte, `cron.schedule_in_database` (inactivos en staging salvo `--cron-active`) y `vault-set-secret.sh`. Responde N3 de la revisión.
2. **Permisos:** restaurando como `supabase_admin` (se eligió porque, como `postgres`, cualquier objeto de un rol de plataforma en el dump aborta con «must be able to SET ROLE supabase_admin», como pasó en un ensayo con objetos del Cloud falso creados por `supabase_admin`, y porque `session_replication_role` exige superusuario), los default privileges de la imagen abren `public`; `tenants` quedó con `INSERT/UPDATE/DELETE/TRUNCATE` para `anon` y `authenticated` (corrida de las 19:32, control rojo). Ahora el script iguala los permisos de los roles cliente a los de Cloud y los compara por huella.
3. Defectos propios atrapados por la prueba: `docker run -i` se comía la entrada estándar antes de pedir la cadena; un trap de `TERM` hacía esperar al `docker run` en curso (se quitó: el EXIT corre igual); con `pipefail`, un `grep` sin coincidencias mataba `restore-test`; `format('%s', false)` daba `f`; Docker 29 ya no llena `.NetworkSettings.IPAddress`.

**Condiciones de Sam:** (1) DPA **generado** en el panel de Contabo el 2026-10-09 (Sam: «listo, ya generé el DPA en Contabo») y **leído** el mismo día a pedido de Sam (PDF en su carpeta de descargas, fuera del repo). Cubre subencargados, brechas, borrado y la transferencia a EE. UU., pero el anexo 1 solo marca «Users» como personas afectadas y lleva un texto suelto en «Other data». Sam lo **recreó** dos veces en el portal el mismo día. La versión vigente, de las 21:50 UTC+1, cubre todas las personas, y de las categorías especiales solo deja «biométricos». Sam informa que la revisión del abogado está hecha («listo verificacion del abogado list», 2026-10-09); el Worker no vio el dictamen. Condición 1: cumplida según Sam. Detalle en la revisión del traslado §5.1. Revisión legal: del abogado. Contabo agregado a `inventario-terceros.md`. (6) **Frase de paso hecha** el 2026-10-09: la llave ya no abre sin frase y queda cargada en el agente de Windows. Desde esta laptop, al VPS se entra con `C:\Windows\System32\OpenSSH\ssh.exe`; el `ssh` de Git Bash ya no puede usar la llave. **2FA de Contabo activo** el mismo día (verificado en *Seguridad y acceso*): condición 6 completa. (7) Decisiones de Sam del 2026-10-09: **retención de 30 días** y **política corregida antes del corte**; quedaron en `backup-restore-servidor.md` §2.1 y en los requisitos de la Fase 3 (`servidor-contabo.md` §3). **Las siete condiciones están cumplidas**; falta el OK nominal para exportar producción al ensayo.

**Pendientes de esta tarea:**

- Ensayo real de la Fase 2 con producción (necesita el OK de exportar de Sam y las condiciones 1, 6 y 7): valida Storage (rclone contra `storage-api`, que aquí no se levantó) y los conteos verdaderos.
- ~~DR real sobre la base `postgres` de un stack nuevo: el mismo mecanismo de permisos lo afectaría (NO VERIFICADO)~~ → verificado y resuelto el 2026-10-11 (sección «DR · permisos de public»).
- Retención (H7): decisión de Sam; el runbook ya dice que vale la del script (30 días) y no promete semanales/mensuales.

## Fase 2 · staging vacío en el VPS (2026-10-09, sin datos de producción)

- **DNS:** los registros A `staging` y `supabase-staging` → `217.216.54.70` (TTL 300) los cargó el Worker en el hPanel de Hostinger con autorización de Sam en el chat («Tú dale, yo le voy dando a aceptar»). Un primer intento de Sam no se había guardado. Ya los sirven los dos NS autoritativos.
- **Stack:** `/srv/dtd-cargo-staging` (700), proyecto `dtd-cargo-staging`, `.env` generado en el VPS con `infra/ops/staging/new-env.sh` (19 secretos + 2 JWT; los valores no salieron del VPS), `functions/` armada (router del upstream + funciones del repo). Arriba y `healthy`: db, auth, rest, realtime, storage, imgproxy, functions, api-gw y auth-templates. Sin web ni cron (falta la imagen) y sin studio/meta/pooler (perfiles). 1,4 GB de RAM.
- **Base:** default privileges de `postgres` en `public` iguales a producción (`r`/`S`/`f` solo para postgres y service_role; 0 con anon/authenticated); `public` sin tablas, `storage` con 10 y `auth` con 23. Login por red como `supabase_admin` y `postgres`: OK.
- **TLS y acceso:** certificado de Let's Encrypt para `supabase-staging.dtdcargo.com`, válido del 2026-10-09 21:02 GMT al 2027-01-07. Un intento fallido previo: el gateway arrancó como dependencia de functions antes de que el DNS resolviera. Desde la IP de Sam (`187.13.210.51`): `/auth/v1/health` y `/rest/v1/` → 401 (pide apikey), `/storage/v1/status` → 200, `/realtime/v1/api/tenants`, `/pg/` y `/` → 404. Desde el propio VPS (IP no permitida): 403.
- **Defectos de Fase 0 que destapó el staging, corregidos en la PR** (ninguno lo veía `compose config`):
  1. `functions` no arrancaba: montaje de archivos dentro de un montaje de solo lectura, y ruta al repo que en el servidor no existe → una carpeta `${DTD_FUNCTIONS_DIR}`.
  2. Traefik no admite `serversTransports` en labels de Docker: `dtd-long@docker` rompía las rutas de web y de Supabase → `slow-300s@file` del proveedor de archivo.
  3. `functions_base_url` debe ser la URL interna (`http://api-gw:8000/functions/v1`).
  4. Los nombres de router de Traefik son fijos: staging y producción no pueden ir a la vez detrás del mismo Traefik (pendiente: parametrizarlos).
- **OK nominal de Sam para exportar producción:** «OK exportar producción al staging del ensayo» (2026-10-09, ~22:09 UTC). Alcance: un traslado de Cloud al `dtd-cargo-staging` del VPS con `import-from-cloud.sh`, que corre Sam desde su PowerShell (pide la cadena de conexión y las claves S3 temporales). Solo lectura sobre producción, sin escribir en Cloud; el staging se destruye al cerrar el ensayo (§2.6). Scripts verificados por sha256 contra la PR antes de correr.
- **Intentos de importación (2026-10-09/11):** seis sesiones llegaron a la pregunta de la cadena y ninguna pasó de ahí. Tres veces rechazó lo pegado («no parece una URL de Postgres»: salto de línea, pegado vacío o pegado en la terminal de la app); `4f382bb5` limpia la entrada y explica qué llegó sin mostrar la contraseña. Las otras sesiones se cerraron sin recibir nada. Ninguna leyó producción: las evidencias (`/srv/ops/evidencias/import-dtd-cargo-staging-*.txt`) terminan en «0/6 staging vacío». El 2026-10-11 a las 02:26 UTC quedó abierta otra sesión esperando a Sam.
- **`functions` detenido (2026-10-11):** el contenedor estaba en `Exited (15)` desde el 2026-10-09 21:42 UTC. Se paró junto al gateway mientras se esperaba el DNS y no volvió a arrancar. Se arrancó con `docker start` y quedó `healthy`.

## DR · permisos de public (2026-10-11, pendiente propio de la tarea)

El riesgo anotado como NO VERIFICADO se midió y se cerró, con datos sintéticos en el VPS:

- **Qué cambió:**
  - `infra/ops/lib/acl.sh` nuevo, con el SQL de permisos que antes estaba solo en el import. Lo cargan `import-from-cloud.sh`, `pg-dump-to-s3.sh` y `restore.sh`.
  - `pg-dump-to-s3.sh` guarda `<x>-acl.sql.age`, cifrado y en el `.sha256`, con la huella en la primera línea.
  - `restore.sh` lo busca al lado del dump (o `--acl`), lo aplica en una transacción y compara la huella. Sale 8 si difieren. Rechaza (3) un destino destructivo sin archivo de permisos antes de pedir la confirmación. Opciones nuevas: `--acl-verify-only` y `--skip-acl`.
  - `restore-test.sh` exige «iguales» y suma `--dr`: copia la base `postgres` de la imagen como destino.
  - La limpieza de la prueba ya no toca corridas reales: filtra por el valor de la etiqueta y por los prefijos de `/dev/shm`.
- **Prueba:** `infra/ops/tests/prueba-traslado-y-respaldos.sh`, corrida desde `/srv/ops/bench/src-dr` (copia del árbol de trabajo, sin tocar `/srv/ops`). Resultado: **60 PASÓ · 0 FALLÓ** (antes 53; los 7 nuevos son los de permisos). El origen sintético tiene default privileges de `postgres` cerrados, `tenants` con SELECT solo para `authenticated` y una función para `service_role`.

  | Corrida | Origen | Restaurada | Resultado |
  |---|---|---|---|
  | Base nueva (prueba mensual) | `35:b5acf91ec157aaabb74c112b2cd317e8` | `35:b5acf91ec157aaabb74c112b2cd317e8` | iguales |
  | `--dr --acl-verify-only` (control rojo; 6 default privileges de `public` con anon/authenticated en la copia) | `35:b5acf91e…` | `52:2abba70b98952708f01b1d9974f996ef` | DISTINTOS: 17 permisos de más |
  | `--dr` | `35:b5acf91e…` | `35:b5acf91e…` | iguales |

- **No verificado:** un DR completo con la app encima (servicios, Storage, Vault con la raíz) sobre un stack nuevo. Esta prueba cubre la base y sus permisos.
- **Despliegue al VPS:** `lib/`, `backup/` y `tests/` se copian a `/srv/ops` cuando termine la importación; `import-from-cloud.sh` nuevo, también después (la sesión abierta usa el anterior, idéntico en comportamiento).

## Cierre de 2b · Worker (2026-10-08, decisión de Sam: «sigue con la migración recomendada»)

La migración aditiva no servía: correría después de la 0268, cuyo guardarraíl es el que aborta. Lo que cerró 2b, en orden de medición:

| Paso | Hallazgo | Cambio |
|---|---|---|
| 1 | La imagen perdía `shared_preload_libraries` (pg_cron/pg_net no cargaban) al recibir `-c fsync=off` sin su `config_file` | Modo Supabase arranca con `postgres -c config_file=/etc/postgresql/postgresql.conf` |
| 2 | La imagen reinicia Postgres al terminar el initdb; un `select 1` aislado llegaba en el reinicio | Espera de cinco lecturas seguidas de `supabase_admin` |
| 3 | Con stubs reducidos + revoke antes de 0268: 388 migraciones y la 0410 aborta (escritura de `authenticated` en `mail_logs`; su revoke vive en la 0415) | — |
| 4 | `pg_default_acl` de producción (catálogo, sin filas): `postgres` en `public` concede tablas `arwdDxtm`, secuencias `rwU` y funciones `X` SOLO a `postgres` y `service_role`; la imagen las da también a `anon`/`authenticated` | Los stubs reducidos fijan esos mismos defaults: 450/450 sin hooks |
| 5 | El contrato de aislamiento fallaba por «RLS de más»: fijaba la identidad solo en `test.uid` (stub) y el `auth.uid()` real lee `request.jwt.claim.sub` | El contrato fija también `request.jwt.claim.sub` y `request.jwt.claims` |
| 6 | El chequeo `get_user_tenant_id() <> …` pasaba con identidad nula (`null <> x` es null) | Ahora `is distinct from` |

Resultado: `node scripts/check-schema-rebuild.mjs` (postgres:17) PASÓ en 28 s; `pnpm schema:rebuild:supabase` PASÓ en 26 s; `node scripts/run-sql-tests.mjs` PASÓ 225/225 en 87 s. **Consecuencia operativa** (añadida a `servidor-contabo.md` §2.1 paso 4): en el servidor hay que igualar los default privileges a los de producción antes de aplicar nada, o cada tabla que cree una migración futura nace abierta para los roles cliente.

## Evidencia · área docs (2026-10-08, pasada de corrección)

| Comprobación | Comando | Resultado literal |
|---|---|---|
| Índice de specs regenerado | `corepack pnpm docs:index` | PASÓ · «índice regenerado en docs\specs\README.md — 490 specs, 15 huecos» · diff: fila `0505 … in-progress · interno`, conteo 489→490, `0504` añadido a huecos |
| Índice sincronizado | `corepack pnpm docs:check` | PASÓ · exit 0 · «docs:check — índice sincronizado con 490 specs» (antes de la pasada: FALLÓ exit 1, «índice desactualizado») |
| Numeración SDD/migraciones | `corepack pnpm sdd:check` | PASÓ · exit 0 · «490 specs · 468 migraciones» · «numbering: sin números repetidos» (los 11 ⏸ son choques históricos ya aplicados, no se renumeran) |
| Voseo en lo nuevo | `grep -nE '\b(vos|tenés|andá|revisá|poné|hacé|mirá|copiá|completá|dejá|pegá|…)\b'` sobre los dos runbooks nuevos, la sección Self-hosted y el bloque nuevo de `.env.example` | PASÓ · 0 coincidencias |
| «VDS» en los runbooks nuevos | `grep -n VDS docs/runbooks/servidor-contabo.md docs/runbooks/backup-restore-servidor.md` | PASÓ · 1 coincidencia, la frase que dice «No es un VDS» (servidor-contabo.md:33) |
| Secretos o valores reales | `grep -rn 'sbp_\|eyJhbGci'` sobre los cinco archivos tocados | PASÓ · 0 coincidencias fuera de la frase de la aceptación 6 que nombra el patrón |
| Espacios colgantes | `git diff --check` (árbol completo) y `grep -nE '[[:space:]]+$'` sobre los archivos nuevos del área | PASÓ · exit 0 · 0 coincidencias |
| Pruebas Vitest del área | — | NO APLICA · el área docs no tiene pruebas Vitest; `scripts/build-docs-index.mjs --check` es su gate |
| `pnpm verify` completo | — | NO EJECUTADO · requiere turno del Director (una corrida pesada a la vez) |

Archivos de esta pasada (área docs):

- Nuevos: `docs/runbooks/servidor-contabo.md` (Fases 1-4: reinstalación con llave, benchmark del día 1 con umbrales numéricos, reputación de la IP `217.216.54.70`, hardening, Tailscale, Dokploy/Traefik/Cloudflare, snapshots como conveniencia, `REQUEST_IP_HEADER` con la prueba `curl -H`, estructura `/srv`, staging con copia de producción, corte y rollback limpio/sucio, retiro), `docs/runbooks/backup-restore-servidor.md` (dump diario + `age` + `rclone` fuera de Contabo, latido en Uptime Kuma, restore mensual obligatorio en staging con conteos y RTO, secretos irreemplazables, copia semanal de Storage a otro proveedor, snapshot ≠ backup, pgBackRest pendiente con decisión antes del corte).
- Modificados: `docs/runbooks/setup-portal-auth.md` (sección «Self-hosted (SDD-0505)» con la tabla dashboard → compose → `GOTRUE_*`, qué necesita el camino `token_hash` y qué el plan B PKCE, prueba de humo en otro navegador), `.env.example` raíz (bloque «Runtime fuera de Vercel (SDD-0505)» con `APP_ENV`, `APP_URL`, `REQUEST_IP_HEADER` y la nota de que `DTD_STANDALONE=1` es solo de build), `docs/specs/0505-dockerizar-dtd-cargo-contabo/spec.md` (HEALTHCHECK fijado a `GET /robots.txt`; criterio de aceptación 2 reescrito con la evidencia medida y las dos opciones de cierre para el Director; § Seguimiento nuevo), `docs/specs/README.md` (regenerado, no editado a mano), este handoff.

## Evidencia reportada por el revisor de infra (`infra-dtd`), fase de verificación del 2026-10-08

Literales tal como los entregó el revisor; **el área docs no los reprodujo** (Docker y corridas pesadas piden turno) y los registra para que la spec y este handoff no afirmen más de lo medido:

| Comprobación | Resultado |
|---|---|
| `docker compose -f infra/dtd-cargo/compose.yml -f infra/dtd-cargo/compose.supabase.yml config` | NO EJECUTADO · archivos de compose ausentes en el worktree |
| `SQL_TEST_PG_IMAGE=supabase/postgres:17.6.1.136 node scripts/check-schema-rebuild.mjs` | FALLÓ · «permission denied for schema auth» · 10,8 s · bloquean 0038, 0268, 0410 y 0453 (la imagen trae `auth` con dueño/ACL propios) |
| `node scripts/check-schema-rebuild.mjs` (sobre `postgres:17`) | PASÓ · 449 migraciones + 18 solo-ledger (= 467) · 41 s |
| `node scripts/run-sql-tests.mjs` (sobre `postgres:17`) | PASÓ · 224/224 · ~3 min · todavía sin la 0472 |
| Imagen `dtdcargo:local` | NO DISPONIBLE · sin `Dockerfile` |

Consecuencia registrada en la spec (aceptación 2 y § Seguimiento): la variante sobre `supabase/postgres:17.6.1.136` queda **pendiente de decisión del Director** entre correr el rebuild «en modo Supabase» (roles y hooks que la imagen ya declara) o una migración de ACL explícita con su prueba. El área docs no inventó esa decisión: la spec deja las dos opciones y prohíbe afirmar (b) como PASÓ hasta que exista.

## Hallazgos de la fase de corrección (área docs) y su cierre

1. **Runbooks ausentes, sección Self-hosted, variables en `.env.example`, handoff stub** (alta) → cerrado con los archivos de arriba.
2. **`docs/specs/README.md` desactualizado** (media) → `docs:index` corrido; `docs:check` exit 0.
3. **Handoff sin evidencia y criterio 2 falso** (media) → evidencia literal registrada (propia y la reportada), criterio 2 reescrito; la decisión del Director sigue pendiente y así queda escrito.
4. **El orquestador afirmó «todos los constructores terminaron» con resumen vacío** (baja) → no se corrige con un archivo. Regla para la siguiente fase, anotada en la cabecera de este handoff: antes de abrir la fase de validación, el orquestador adjunta la salida literal de `git -C <worktree> status --short --untracked-files=all` y el JSON de cada constructor; una casilla se marca solo con ruta + comando + PASÓ/FALLÓ con conteo.
5. **No abrir PR ni pasar a validación con dos módulos sueltos** (alta) → vigente: al 21:08 UTC faltan compose (tres archivos), `.env.example` de infra, `README.md` de infra, plantilla y ops, y ninguna área salvo docs ha dejado evidencia de PASÓ en este handoff. La PR no se abre hasta que cada área entregue su JSON con PASÓ y el orquestador adjunte el `git status` literal.
6. **Runbooks con VPS, snapshots y `REQUEST_IP_HEADER` bien dichos** (alta) → cerrado; ver grep de «VDS» y §1.7/§1.8 de `servidor-contabo.md`.
7. **Self-hosted en `setup-portal-auth.md`** (media) → cerrado; la tabla cubre los dos caminos y los valores medidos (3600 s, 60 s).
8. **`.env.example` sin las tres variables** (media) → cerrado.
9. **HEALTHCHECK contra un `/api/health` que no existe** (baja) → cerrado en la spec: `GET /robots.txt`, timeout 5 s, start-period 40 s; `app/api/debug/health` descartado con sus códigos (503/401).

## FUERA DE ALCANCE DETECTADO

- ~~Archivos fuera de la allowlist~~ (cerrado por el Worker): `.gitattributes`, `eslint.config.mjs` y `tsconfig.json` ya figuran en la allowlist de la spec con su motivo (excluir el router Deno copiado del upstream y conservar la copia verbatim).
- ~~Espera de la 0472 sin verificar~~ (cerrado por el Worker): la entrada en `pendingBelowCutoff` sigue la forma de 0422/0423 y la prueba PGlite da 12/12.
- ~~**Fase 2 · grants después del restore**~~ (cerrado por el Worker el 2026-10-09): se confirmó que el restore SÍ los abre (el dump no revoca lo que agregan los default privileges de la imagen); `import-from-cloud.sh` iguala los permisos a Cloud y los compara por huella. Queda el caso del DR, anotado en los pendientes de esta tarea.
- **`origin/main` avanzó** desde la base de esta rama (`c3d37a8e` → incluye SDD-0504, `68b2a864`). Antes de integrar hay que traer `main` a esta rama y repetir lo afectado.
- `docs/investigacion/contabo-vps-produccion-ago-2026.md` lleva el banner «⛔ CERRADA — NO SE IMPLEMENTA» (decisión del 2026-08-23) que la decisión de Sam del 2026-10-08 (spec § Objetivo) deja superada. `docs/architecture/migracion-vps-2026-07.md` desaconseja Contabo para la base. Ninguno se tocó: el runbook nuevo los cita como fuente de los umbrales y deja la decisión como está. El Director decide si se les anota la fecha de la nueva decisión.
- `docs/runbooks/aplicar-migraciones-prod.md` asume el conector MCP de Supabase Cloud (`apply_migration`, ledger por md5). Para el servidor propio hace falta una versión con `psql` y alta manual del ledger; `servidor-contabo.md` §4 la pone como condición de la Fase 4. No es de esta spec.
- Voseo preexistente en `docs/runbooks/setup-portal-auth.md` (pasos 1-5, troubleshooting, plantillas: «Dejá», «conectá», «pegá», «pedile») y en `.env.example:4` («Copiá… completá»). Solo lo nuevo va en tuteo; reescribir lo viejo es otra tarea.
- `setup-portal-auth.md` § «Cómo funciona» cita `app/portal/(auth)/login/actions.ts` con `shouldCreateUser: true`; hoy el plan B vive en `app/entrar/actions.ts:44-50` con `shouldCreateUser: false`. Desactualizado; no se tocó.
- Dos supuestos del runbook del servidor que se validan en la Fase 1, no en el repo: que Dokploy exponga su Traefik como `dokploy-traefik` y acepte `docker network connect dtd_edge`, y el tag vigente de `traefik/whoami` para la prueba del header (el runbook pide comprobarlo en el registro).
- `app/api/cron/searates-refresh` existe y no está en `vercel.json` (sin agendar en Vercel); en el crontab del servidor sí va semanal.
- PGlite 0.5.8 embebe PG 18.3 mientras producción y el harness Docker están en 17: las pruebas de CI corren en una major distinta de producción.
