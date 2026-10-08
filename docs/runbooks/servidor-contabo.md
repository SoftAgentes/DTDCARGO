# Runbook · Servidor propio en Contabo (Fases 1 a 4) · SDD-0505

**SDD:** [0505](../specs/0505-dockerizar-dtd-cargo-contabo/spec.md)
**Estado:** borrador operativo; ninguna fase ejecutada al 2026-10-08
**Servidor:** Contabo **Cloud VPS 8** · US East · IP `217.216.54.70` · 8 vCPU compartidos · 24 GB RAM · 300 GB SSD · 600 Mbit/s · 3 snapshots incluidos · $22,70/mes
**Dueño:** Sam decide y autoriza cada fase; el Worker que la ejecute deja la evidencia en su handoff

## 0 · Qué cubre y qué no

SDD-0505 (Fase 0) deja el repo listo: imagen Docker de la app, compose de
Supabase self-hosted en `infra/dtd-cargo/`, cierre de los acoplamientos a Vercel y
a Supabase Cloud, plantilla para proyectos nuevos y este runbook. Nada de eso
toca producción.

Este runbook describe lo que viene después, en cuatro fases con autorización
propia cada una:

| Fase | Qué | Toca producción | Autorización |
|---|---|---|---|
| 1 | Preparar el VPS: reinstalar, medir, endurecer, Dokploy/Traefik/Cloudflare, estructura `/srv` | No | Encargo de Sam para la fase |
| 2 | Staging con copia de producción | **Lee** producción (dump + Storage) | OK explícito de Sam para exportar producción, con fecha |
| 3 | Corte y rollback | **Sí** | OK explícito de Sam para la ventana, con hora |
| 4 | Retiro de Vercel y Supabase Cloud | Sí (irreversible al borrar) | OK explícito de Sam, 14 días después del corte como mínimo |

Reglas que no cambian en ninguna fase:

- Producción Supabase es real: no se leen filas de negocio ni PII sin la
  autorización de la Fase 2. El dump de producción es PII completa: viaja
  cifrado y se borra del disco local al terminar el restore.
- Ningún secreto en el repo. El `.env` del servidor vive en `/srv/<proyecto>/.env`
  con permisos `0600`, y su copia de respaldo cifrada fuera del servidor
  ([backup-restore-servidor.md](backup-restore-servidor.md) §4).
- Siempre se dice **VPS**. No es un VDS: la CPU y el disco son compartidos, y por
  eso la Fase 1 mide antes de confiar.
- El plan de arquitectura de 2026-07 (`docs/architecture/migracion-vps-2026-07.md`)
  y la investigación de agosto (`docs/investigacion/contabo-vps-produccion-ago-2026.md`)
  desaconsejaban Contabo para la base de datos. Sam decidió el 2026-10-08 ir con
  este VPS de todas formas; este runbook no discute la decisión, la vuelve
  medible: si el benchmark del día 1 falla, se pide cambio de nodo o reembolso
  dentro de la ventana de 14 días.

## 1 · Fase 1 — Preparar el servidor (día 1)

### 1.1 Reinstalar con llave SSH, antes de cualquier otra cosa

El VPS llega con una imagen y una contraseña de root por correo. No se usa:

1. Genera una llave para el servidor desde la laptop de Sam
   (`ssh-keygen -t ed25519 -C "sam@dtdcargo-vps"`) y súbela al panel de Contabo
   (Account → SSH keys).
2. Panel → VPS → **Reinstall** → Ubuntu 24.04 LTS (imagen oficial, no una
   «1-click app») → marca la llave SSH → **sin** contraseña de root.
3. El modal de Contabo avisa que la IP «puede cambiar» en un reinstall. Por eso
   esto va **primero**: la reputación de IP (§1.3) y el DNS se miran sobre la IP
   con la que terminas, no sobre la del correo de bienvenida. Anota la IP final
   en este runbook si cambió.
4. Primer acceso: `ssh root@217.216.54.70` con la llave. Si pide contraseña,
   la reinstalación no tomó la llave: repite el paso 2.

### 1.2 Benchmark del día 1 (dentro de la ventana de reembolso de 14 días)

Contabo entrega nodos muy distintos entre sí: el mismo plan mide 41.500 IOPS en
un nodo y 2.000 en otro, y el `fsync` que le importa a Postgres pasa de 1-3 ms
en un host tranquilo a 50 ms en hora pico europea (medidas publicadas, ver
`docs/investigacion/contabo-vps-produccion-ago-2026.md` §2). Se mide el día 1,
con el disco vacío y antes de desplegar nada, y se repite 24 h después para ver
la variación.

Umbrales de la casa. Son una propuesta derivada de esas mediciones publicadas,
no de una medición propia; Sam los ajusta con la primera corrida real y la
cifra ajustada se anota aquí.

| Prueba | Cómo | Acepta | Rechaza (pedir cambio de nodo o reembolso) |
|---|---|---|---|
| `fsync` de Postgres | `docker run --rm -v /srv/bench:/bench postgres:17 pg_test_fsync -f /bench/fsync.test` → fila `fdatasync` | ≥ 500 ops/s (≤ 2 ms por fsync) | < 200 ops/s (> 5 ms) en dos corridas a horas distintas |
| Disco 4k aleatorio mixto | `yabs.sh` (fio, bloque 4k, lectura+escritura) | ≥ 10.000 IOPS | < 5.000 IOPS |
| CPU por núcleo | `yabs.sh -g` (Geekbench 6, single-core) | ≥ 1.000 | < 800 |
| CPU steal | `vmstat 60 1440 > /srv/bench/vmstat-24h.log` (24 h), columna `st` | promedio ≤ 5 %, p95 ≤ 15 % | promedio > 10 % |
| Red | `yabs.sh` (iperf3 contra servidores de la costa este de EE. UU.) | ≥ 400 Mbit/s | < 200 Mbit/s |
| Latencia desde la oficina (Valencia, VE) | `mtr -rwc 100 217.216.54.70` desde la laptop | ≤ 90 ms promedio, 0 % de pérdida | > 120 ms o pérdida > 1 % |

Notas:

- `yabs.sh` es un script de terceros (`https://yabs.sh`): léelo antes de
  correrlo y córrelo solo en este paso, con el servidor recién instalado y sin
  datos. Nunca sobre un servidor con producción.
- Guarda las salidas completas en `/srv/bench/` y pega el resumen (las seis
  filas con su cifra) en el handoff de la Fase 1. Un «pasó» sin cifras no vale.
- Si una fila cae en «Rechaza»: ticket a Contabo pidiendo cambio de nodo (o
  reembolso, que solo existe los primeros 14 días). No se despliega nada hasta
  resolverlo.

### 1.3 Reputación de la IP

Las IP de Contabo se reciclan y hay casos de VPS suspendidos el mismo día por el
historial de abuso del inquilino anterior. Se revisa el día 1, sobre la IP final
del §1.1:

1. Listas negras: Spamhaus ZEN (`check.spamhaus.org`), AbuseIPDB, Talos
   Intelligence y el «Blacklist Check» de MXToolbox, las cuatro con la IP.
2. PTR: `dig -x 217.216.54.70 +short` debe devolver un nombre coherente (el de
   Contabo o, cuando lo configures en el panel, `vps.dtdcargo.com`).
3. Resultado en el handoff: «limpia en las cuatro» o la lista en la que
   aparece.

Si aparece en alguna lista: ticket a Contabo pidiendo cambio de IP **antes** de
desplegar y antes de tocar DNS. El correo transaccional sale por Resend, no por
el VPS, así que el puerto 25 no importa; lo que importa es que filtros
corporativos y Safe Browsing no bloqueen `dtdcargo.com` por la IP de origen.

### 1.4 Hardening base

Como `root`, en este orden:

```bash
# Usuario de operación (docker ≡ root: el grupo docker se concede a propósito y a nadie más)
adduser deploy && usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp /root/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh

# SSH: solo llave, sin root
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin no/; s/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh   # prueba `ssh deploy@IP` en OTRA terminal antes de cerrar esta

# Parches de seguridad solos, hora en UTC (los crons del repo están en UTC)
apt-get update && apt-get install -y unattended-upgrades fail2ban
dpkg-reconfigure -plow unattended-upgrades
timedatectl set-timezone UTC

# Swap chica de seguridad: evita que el OOM killer mate a Postgres por un pico
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
printf 'vm.swappiness=10\nnet.core.somaxconn=4096\n' > /etc/sysctl.d/90-dtd.conf && sysctl --system
```

Firewall, en dos capas:

- **Panel de Contabo (fuera de la VM, es el perímetro duro):** entrada solo
  `80/tcp`, `443/tcp` y `22/tcp` desde la IP de la oficina mientras dura la
  instalación. Cuando Tailscale esté arriba (§1.5), quita el `22` público.
- **Dentro de la VM:** Docker escribe sus propias reglas de `iptables` y se salta
  a UFW en la cadena `INPUT`. El compose del repo no publica puertos (solo
  Traefik escucha en 80/443), así que la regla es no confiar en UFW para
  contenedores: si hace falta bloquear algo que Docker publica, va en la cadena
  `DOCKER-USER`, no en UFW.

Docker Engine:

```bash
# Repositorio oficial de Docker (no el paquete de Ubuntu)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
apt-mark hold docker-ce docker-ce-cli containerd.io   # se actualiza a mano, con snapshot previo (§1.7)
usermod -aG docker deploy
printf '{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }\n' > /etc/docker/daemon.json
systemctl restart docker
docker version   # anota la versión instalada en el handoff de la fase
```

### 1.5 Acceso administrativo por Tailscale

Studio de Supabase, el panel de Dokploy y Uptime Kuma nunca se exponen a
internet. Se llega por Tailscale:

```bash
curl -fsSL https://tailscale.com/install.sh | sh   # script oficial; léelo antes
tailscale up --ssh
```

Con el nodo en la tailnet de Sam: `ssh deploy@<nombre-tailscale>` funciona sin
el `22` público, y el panel de Contabo puede cerrar ese puerto. Los servicios
internos se publican en Traefik con una regla que solo acepta la red
`100.64.0.0/10` (IPAllowList) o, más simple, por `--profile studio` del compose
con el puerto atado a la IP de Tailscale.

### 1.6 Dokploy, Traefik y Cloudflare

Dokploy instala Docker Swarm (solo para sí mismo), su Traefik
(`dokploy-traefik`) y la red `dokploy-network`. El compose del repo espera la
red externa `dtd_edge`, compartida solo con Traefik:

```bash
curl -sSL https://dokploy.com/install.sh | sh    # script oficial; léelo antes
docker network create dtd_edge
docker network connect dtd_edge dokploy-traefik
```

Si se prefiere no usar Dokploy, `infra/ops/traefik/` trae el Traefik standalone
con la misma red `dtd_edge` (entregable 6 de la spec).

TLS y headers en Traefik (`/etc/dokploy/traefik/traefik.yml` o el del ops):

- Certificados: Let's Encrypt por HTTP-01 en el entrypoint `web` (lo trae
  Dokploy). Si Cloudflare va delante con proxy, su modo SSL queda en
  **Full (strict)**.
- `entryPoints.websecure.forwardedHeaders.trustedIPs`: **vacío** si no hay
  Cloudflare delante; la lista oficial de rangos de Cloudflare si sí la hay.
  Nunca `insecure: true`.
- Timeouts y cuerpo: la app tiene rutas de importación con `maxDuration` de
  300 s y `serverActions.bodySizeLimit` de 12 MB; las labels del compose ya
  piden 300 s y 12 MB, y Traefik debe respetarlas
  (`entryPoints.websecure.transport.respondingTimeouts.readTimeout: 300s`).
- Cloudflare: delante de `dtdcargo.com` con proxy (nube naranja) es opcional en
  la Fase 1 y recomendado antes del corte (mitigación L7, cache de estáticos,
  Cloudflare ya es el proveedor de R2). Decide en la Fase 2 y deja escrito
  aquí qué se eligió, porque cambia el header de IP (§1.8).

### 1.7 Snapshots de Contabo: conveniencia, no backup

El plan incluye 3 snapshots. Sirven para **antes de un cambio arriesgado**
(actualizar Docker, subir una major de Postgres, cambiar el compose de
Supabase): tomas uno, cambias, y si sale mal vuelves en minutos. No sirven de
backup: viven en el mismo proveedor y el mismo host, **se borran solos a los
30 días** y no se restauran en otro servidor. El backup real está en
[backup-restore-servidor.md](backup-restore-servidor.md).

### 1.8 `REQUEST_IP_HEADER` y la prueba del proxy

La app sella la IP del visitante como evidencia (aceptaciones de T&C, registro
del Portal) leyendo el header que diga `REQUEST_IP_HEADER`
(`lib/http/request-ip.ts`, SDD-0505). Ese header **solo es seguro si el proxy
de confianza lo sobrescribe siempre**; si lo deja pasar tal como llega, un
`curl -H` lo falsifica y la evidencia queda a elección del atacante.

| Topología | `REQUEST_IP_HEADER` | Por qué |
|---|---|---|
| Traefik directo a internet (sin Cloudflare) | `x-real-ip` | Traefik borra el `X-Real-Ip` entrante de cualquier remoto que no esté en `trustedIPs` y lo fija con la IP real |
| Cloudflare (proxy) → Traefik | `cf-connecting-ip` | Cloudflare lo sobrescribe siempre; `x-real-ip` **no** (Cloudflare lo deja pasar) |
| Vercel (hoy) | vacío | Conducta actual: primer `x-forwarded-for` del edge de Vercel |

Con Cloudflare delante hay una condición más: el origen (443 del VPS) debe
aceptar **solo** los rangos de Cloudflare en el firewall del panel de Contabo.
Si alguien llega directo a la IP del VPS, Traefik no borra `CF-Connecting-IP`
(no es un header `X-Forwarded-*`) y la falsificación pasa.

**Prueba, obligatoria al terminar esta fase y después de cualquier cambio de
proxy o de Cloudflare.** Levanta un `whoami` de prueba en la red `dtd_edge`
(imagen `traefik/whoami`, fijada por tag; comprueba el tag vigente en
`hub.docker.com/r/traefik/whoami/tags`) con una regla `Host(\`whoami.dtdcargo.com\`)`
y lanza desde fuera del servidor:

```bash
curl -sS https://whoami.dtdcargo.com/ \
  -H 'x-real-ip: 1.2.3.4' \
  -H 'cf-connecting-ip: 1.2.3.4' \
  -H 'x-forwarded-for: 1.2.3.4'
```

Lee en la respuesta el header elegido para `REQUEST_IP_HEADER`: debe traer la
IP pública desde la que corriste el `curl`, **nunca** `1.2.3.4`. Si trae
`1.2.3.4`, ese header no está protegido en esta topología y no se usa. Repite
el `curl` directo contra la IP del VPS (`--resolve whoami.dtdcargo.com:443:217.216.54.70`)
con Cloudflare delante: debe fallar por el firewall. Borra el `whoami` al
terminar. En la Fase 2 la misma prueba se repite contra la app en staging: una
aceptación de T&C de prueba con esos headers falsificados debe sellar la IP real
en la base de staging (nunca en producción).

### 1.9 Estructura `/srv/<proyecto>`

Un directorio por proyecto, cada uno con su compose, su `.env` y sus datos. Los
secretos no salen de ahí; el repo solo tiene los `.env.example`.

```
/srv/
├── dtd-cargo/                 ← copia desplegada de infra/dtd-cargo/ (project name dtd-cargo)
│   ├── compose.yml · compose.supabase.yml · compose.supabase.s3.yml
│   ├── .env                   ← 0600, dueño deploy; nunca en git
│   ├── supabase/volumes/      ← init de db, gateway, router de functions, pooler (del repo)
│   ├── supabase/templates/    ← plantillas de correo que sirve auth-templates (del repo)
│   ├── cron/crontab           ← generado por scripts/build-crontab.mjs (del repo)
│   ├── data/db/               ← PGDATA (bind mount; solo lo toca el contenedor db)
│   └── backups/               ← dumps locales, 7 días (backup-restore-servidor.md)
├── dtd-cargo-staging/         ← misma estructura, project name dtd-cargo-staging, host staging.dtdcargo.com
├── loop3d/                    ← desde infra/templates/proyecto/ (dos webs, un Supabase)
├── renta-aguada/              ← desde infra/templates/proyecto/ cuando exista código
└── ops/                       ← infra/ops/: traefik standalone (si no hay Dokploy), uptime-kuma, backup/
```

Memoria: la spec fija límites por servicio (`deploy.resources.limits.memory`)
con la suma de DTD Cargo ≤ 12 GB sobre 24 GB totales; Postgres arranca con
`shared_buffers` 1 GB, `effective_cache_size` 3 GB, `work_mem` 8 MB y
`max_connections` 100. Loop 3D y Renta Aguada reparten lo que queda; si la
suma de límites supera 20 GB, hay que subir de plan, no quitar límites.

Imagen de la app: la construye CI en GHCR
(`ghcr.io/hailuwaycom-sketch/dtdcargo:sha-<sha>` y `:main`). El servidor
necesita `docker login ghcr.io` con un token de solo lectura de paquetes
(`read:packages`), guardado en Dokploy (Registries) o en el keyring de
`deploy`, nunca en el `.env` del compose. Desplegar es fijar el tag en `.env`
(la variable está en `infra/dtd-cargo/.env.example`) y correr
`docker compose pull web && docker compose up -d web cron`.

### 1.10 Cierre de la Fase 1

Evidencia en el handoff: IP final, seis cifras del benchmark con fecha y hora,
resultado de las cuatro listas de reputación, versión de Docker, salida del
`curl` del §1.8 y `docker network ls` mostrando `dtd_edge`. Sin eso la fase no
está cerrada.

## 2 · Fase 2 — Staging con copia de producción

Requiere el OK explícito de Sam para **exportar producción** (base + Storage),
con fecha. Es la primera vez que datos reales salen de Supabase Cloud: el dump
viaja por `scp` directo al VPS, se restaura y se borra del disco local.

### 2.1 Levantar el stack vacío y reconstruir el schema

1. `cp -r infra/dtd-cargo /srv/dtd-cargo-staging`, `.env` desde
   `.env.example` con **todos** los secretos nuevos (`openssl rand -hex 32`
   para `POSTGRES_PASSWORD`, `JWT_SECRET`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`;
   `ANON_KEY` y `SERVICE_ROLE_KEY` firmados con ese `JWT_SECRET`). Ninguno de
   los secretos demo del compose oficial de Supabase, que son públicos.
2. `docker compose --env-file .env -f compose.yml -f compose.supabase.yml config`
   debe validar; `up -d db` y `psql` deben entrar.
3. Reconstrucción desde cero: `SQL_TEST_PG_IMAGE=supabase/postgres:17.6.1.136 node scripts/check-schema-rebuild.mjs`.
   **Al 2026-10-08 esto FALLÓ** (`permission denied for schema auth`, 10,8 s;
   bloquean 0038, 0268, 0410 y 0453) porque la imagen de Supabase trae el
   schema `auth` con dueño y ACL propios, distinto del `postgres:17` liso donde
   el mismo rebuild PASÓ (449 migraciones + 18 solo-ledger, 41 s). La decisión
   de cómo cerrarlo (correr en modo Supabase con los roles y hooks que la
   imagen declara, o una migración de ACL explícita) la toma el Director; hasta
   entonces, staging se llena con el dump de producción (§2.2), que ya trae el
   schema aplicado, y el rebuild sobre la imagen de Supabase queda como
   pendiente registrado en la spec.

### 2.2 Dump de producción y restore (con el OK de la fase)

Orden oficial de Supabase para mover un proyecto:

```bash
# Desde la laptop, con la cadena de conexión de producción (nunca el PAT del repo)
supabase db dump --db-url "$PROD_DB_URL" -f roles.sql  --role-only
supabase db dump --db-url "$PROD_DB_URL" -f schema.sql
supabase db dump --db-url "$PROD_DB_URL" -f data.sql   --data-only --use-copy
# Al VPS, cifrado en tránsito, y restore dentro de la red interna
psql "$STAGING_DB_URL" --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' --file data.sql
```

Comprobaciones mínimas después del restore (todas con conteo en el handoff):

- `select count(*) from auth.users` igual al de producción (297 al 2026-10-08).
- `select jobname, schedule from cron.job`: los 3 jobs de `pg_cron`; si el dump
  no los trajo, se recrean desde las migraciones que los agendan.
- `select name from vault.secrets`: crear `functions_base_url` =
  `https://<host-supabase-staging>/functions/v1` (migración 0472).
- Ledger: `select count(*) from supabase_migrations.schema_migrations` igual
  al de producción. Si la 0472 ya se aplicó en Cloud, viene en el dump; si no,
  se aplica en staging con `psql` y se inserta su fila en el ledger.

Storage: los binarios no viajan en el dump. Se copian por el protocolo S3 de
los **dos** stacks (`/storage/v1/s3` de Cloud → `/storage/v1/s3` del staging)
con `rclone sync`, para que `storage-api` del destino sea quien escriba el
backend y mantenga las filas de `storage.objects` coherentes. Al terminar:
`select count(*) from storage.objects` (634 en 15 buckets al 2026-10-08) contra
el conteo de `rclone size`, y una URL firmada de cada bucket abierta desde el
navegador. Esta sección fija el orden y las comprobaciones; el detalle se
ensaya en esta fase y lo que se aprenda se escribe aquí.

### 2.3 Configuración de staging

- `APP_ENV=staging`, `APP_URL=https://staging.dtdcargo.com`,
  `NEXT_PUBLIC_SUPABASE_URL=https://supabase-staging.dtdcargo.com` (la imagen
  se construye por entorno: las `NEXT_PUBLIC_*` se inlinean en build).
- `REQUEST_IP_HEADER` según la topología elegida en §1.8.
- Correo: Resend con el dominio de prueba o un remitente `staging@`, nunca
  el de producción. Kommo: sincronización apagada (sin tokens en el `.env`).
  Crons: contenedor `cron` levantado pero con `CRON_SECRET` propio, para ver
  que disparan sin pegarle a integraciones reales.
- Auth: equivalencias `GOTRUE_*` en
  [setup-portal-auth.md § Self-hosted](setup-portal-auth.md#self-hosted-sdd-0505).

### 2.4 Smoke en staging

El guion vivo de smokes está en
`.agents/handoffs/smokes-app-l14-0454-0472-guion.md`: se extiende con un bloque
«staging en el VPS» en vez de escribir otro. Mínimo para esta fase, por rol:

1. Admin del Studio: entrar, abrir Clientes, Embarques, Tesorería; subir un
   adjunto (TUS directo al host propio: `directTusEndpoint` conserva el host) y
   verlo renderizado (CSP con el origen propio).
2. Operario (PWA `/m/`): foto de recepción con cámara y ver el thumbnail
   (imgproxy).
3. Cliente del Portal: pedir enlace a un correo `invited` y abrirlo en **otro**
   navegador (`/abrir`, camino `token_hash`); Realtime del timeline
   actualizando (websocket `wss://` del origen propio).
4. Crons: en el log del contenedor `cron`, una línea por cron del `crontab`
   con código 200.
5. Prueba del §1.8 contra la app: aceptación de T&C de prueba con headers
   falsificados y lectura de la IP sellada en la base de staging.

### 2.5 Cierre de la Fase 2

Evidencia: conteos del §2.2, el bloque de smokes con PASÓ/FALLÓ por punto,
y el resultado del rebuild sobre `supabase/postgres:17.6.1.136` (PASÓ, o la
decisión del Director que lo deja pendiente con fecha).

## 3 · Fase 3 — Corte y rollback

Requiere el OK de Sam con hora de la ventana. Antes de pedirlo:

- Fase 2 cerrada, con un restore de prueba PASÓ
  ([backup-restore-servidor.md](backup-restore-servidor.md) §3) y el backup
  diario corriendo desde hace al menos 7 días sobre staging.
- pgBackRest o WAL continuo: la spec lo deja pendiente. Si no está, el RPO del
  día del corte es de 24 h, y Sam lo acepta por escrito en el mismo OK.
- TTL del DNS bajado a 300 s 24 h antes (Cloudflare o donde esté el DNS).

### 3.1 Secuencia

1. **Congelar**: aviso al equipo (Valencia y Yiwu), Studio en solo lectura si
   hay banner, Kommo sin cambios de configuración.
2. **Stack de producción** en `/srv/dtd-cargo` con `APP_ENV=production`,
   `APP_URL=https://dtdcargo.com` y la imagen `sha-<sha>` que pasó en staging.
3. **Dump final** de Cloud y restore como en §2.2, más `rclone sync` final de
   Storage (incremental: ya se copió en la Fase 2).
4. **Sesiones**: si se copia el `JWT_SECRET` de Cloud al `.env`, las sesiones y
   las claves `anon`/`service_role` siguen válidas y nadie vuelve a entrar; si
   se generan nuevas, todos vuelven a iniciar sesión. Decide antes y anótalo.
5. **Integraciones que apuntan a nosotros** (cada una con su runbook):
   webhook de Resend (`/api/webhooks/resend`, `setup-resend.md`), correo
   entrante (`/api/conversaciones/email`, `setup-resend-inbound.md`), webhook
   de Telegram (`setup-telegram-bot.md`), webhooks de Kommo
   (`setup-kommo-webhook.md`). Mientras el DNS siga en Vercel llegan a Vercel:
   se verifican después del cambio de DNS, no antes.
6. **DNS**: `dtdcargo.com` y `www` al VPS (A `217.216.54.70`, o proxy de
   Cloudflare). Vercel se deja intacto: es el rollback.
7. **Verificar en producción** (20 minutos): home 200, Studio con un admin,
   PWA con un operario, Portal con un cliente de prueba, un cron disparado a
   mano con `curl -H "Authorization: Bearer $CRON_SECRET"`, el `whoami` del
   §1.8 ya retirado y la prueba de headers repetida contra la app.
8. **Descongelar** y avisar.

### 3.2 Rollback

- **Limpio** (antes de que haya escrituras de negocio en el VPS): DNS de
  vuelta a Vercel y `NEXT_PUBLIC_SUPABASE_URL` de Vercel sin tocar. Cloud
  nunca se apagó. Minutos.
- **Sucio** (ya hubo escrituras en el VPS): hay datos nuevos que Cloud no
  tiene. Volver exige un dump inverso (VPS → Cloud) con su propia autorización
  y una ventana nueva. Por eso la verificación del §3.1.7 va **antes** de
  descongelar.

### 3.3 Después del corte

Vercel y Supabase Cloud quedan encendidos **14 días** como red de seguridad.
`vercel.json` sigue agendando sus 19 crons contra Vercel: pausar el proyecto de
Vercel (no borrarlo) al día siguiente del corte para que no corran dos veces.
Uptime Kuma (`infra/ops/`) vigila `https://dtdcargo.com/` y
`https://dtdcargo.com/api/debug/health?cheap=1` con el bearer.

## 4 · Fase 4 — Retiro de Vercel y Supabase Cloud

Requiere el OK de Sam, con estas condiciones cumplidas y escritas en el handoff:

- 14 días desde el corte sin incidente abierto.
- Un restore de prueba mensual PASÓ sobre un dump tomado **en el VPS**.
- El backup fuera de Contabo verificado (`rclone lsl` del bucket con los
  últimos 7 dumps).
- `docs/runbooks/aplicar-migraciones-prod.md` reescrito para el servidor
  propio: el conector MCP de Supabase y `apply_migration` dejan de existir; el
  ledger `supabase_migrations.schema_migrations` se alimenta con `psql` y la
  fila se inserta a mano o con `supabase migration up --db-url`. Hasta que ese
  runbook exista, no se aplican migraciones en el VPS.

Orden:

1. Supabase Cloud: **pausar** el proyecto (`xpfuzqombmjmxvprjgmi`), no
   borrarlo. Borrar solo 30 días después, con otro OK de Sam, y después de un
   último `supabase db dump` guardado cifrado fuera del servidor.
2. Vercel: quitar el dominio del proyecto, pausar el proyecto, revocar
   `VERCEL_API_TOKEN` (el panel de estado del Studio lee `APP_ENV`/`APP_URL`
   y ya no lo necesita).
3. Cancelar los planes de pago de los dos.
4. Documentación: `setup-portal-auth.md`, `setup-resend.md`,
   `setup-web-push.md`, `setup-kommo-webhook.md` y `e2e-supabase-efimero.md`
   apuntan a dashboards de Cloud; cada uno recibe su nota fechada «desde
   <fecha> esto vive en el VPS» con el enlace a este runbook.
5. `.env.example` raíz: las variables `VERCEL_*` quedan documentadas como
   fallback histórico, no se borran del código (el módulo `lib/runtime/app-env.ts`
   las conserva a propósito).

## 5 · Registro de ejecución

| Fecha | Fase | Quién | Resultado | Evidencia (handoff) |
|---|---|---|---|---|
| 2026-10-08 | 0 | Worker SDD-0505 | Repo preparado; ver spec | `.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md` |
| — | 1 | — | pendiente | — |
| — | 2 | — | pendiente | — |
| — | 3 | — | pendiente | — |
| — | 4 | — | pendiente | — |
