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
  300 s y `serverActions.bodySizeLimit` de 12 MB. Las labels del compose piden
  los 300 s y Traefik debe respetarlos
  (`entryPoints.websecure.transport.respondingTimeouts.readTimeout: 300s`). El
  tope de 12 MB lo pone Next, no Traefik: el middleware `buffering` también
  almacena la respuesta y rompía el streaming del Studio (medido el 2026-10-12:
  primer byte a 5,46 s contra 0,60 s sin él), así que el web no lo lleva.
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
con fecha. Es la primera vez que datos reales salen de Supabase Cloud, así que
antes del OK se cumplen las siete condiciones de la
[revisión del traslado](../legal/privacidad/revision-traslado-contabo-2026-10-09.md) §5.
El dump sale de Cloud **directo al VPS** (nunca pasa por la laptop), vive en
memoria mientras se restaura y se borra con evidencia (§2.2). El staging es
**efímero**: se destruye al cerrar el ensayo (§2.6).

Reglas del staging mientras tenga la copia: Storage en archivos (sin el overlay
S3, para no crear otra copia en un bucket), **sin** cron de backup (el respaldo
es de producción, no del ensayo) y **sin** snapshots de Contabo (un snapshot
tomado en ese tiempo se lleva la copia y vive 30 días fuera de nuestro control).

### 2.1 Levantar el stack vacío y reconstruir el schema

1. Copiar `infra/dtd-cargo` a `/srv/dtd-cargo-staging` (700) e `infra/ops/*` a
   `/srv/ops`. Armar `functions/` (router del upstream + `supabase/functions`
   del repo; README de `infra/dtd-cargo` › Arrancar).
2. `.env` con `infra/ops/staging/new-env.sh`: genera en el servidor todos los
   secretos y los JWT `ANON_KEY`/`SERVICE_ROLE_KEY` firmados con el
   `JWT_SECRET` nuevo, y escribe el archivo en 600 sin imprimir valores.
   Ninguno de los secretos demo del compose oficial, que son públicos. Para
   staging, con `--set`: los hosts `staging.dtdcargo.com` y
   `supabase-staging.dtdcargo.com`, `APP_ENV=staging`, `DTD_DATA_DIR`,
   `DISABLE_SIGNUP=true`, `STAGING_ALLOWED_IPS` (las IP de las personas que pueden entrar) y `STAGING_INTERNAL_IPS` (la puerta de enlace de `dtd_edge`, p. ej. `172.18.0.1/32`: por ahí llegan las llamadas del propio web a Supabase; sin ella, todo lo que la app pide desde el servidor da 403);
   las claves `STORAGE_S3_*` quedan como marca con `--allow-placeholder`
   (Storage en archivos).

   Siempre con los tres archivos y el nombre de proyecto:
   `docker compose -p dtd-cargo-staging -f compose.yml -f compose.supabase.yml -f compose.staging.yml`.
   `compose.staging.yml` pone la lista de IP en las dos rutas de Traefik: el
   staging lleva datos reales y no queda abierto a internet. Los routers llevan
   el nombre del proyecto (`dtd-cargo-staging-web`, `dtd-cargo-staging-supabase`;
   en producción `dtd-cargo-*`), así que staging y producción pueden convivir
   detrás del mismo Traefik. La IP de la casa de Sam **cambia** (el 2026-10-11
   pasó de `187.13.210.51` a `187.13.209.203`): si el staging responde 403 desde
   la laptop, compara `STAGING_ALLOWED_IPS` (solo esa; `STAGING_INTERNAL_IPS` no se toca) con la IP actual
   (`echo ${SSH_CLIENT%% *}` dentro del VPS), reemplázala (no la sumes: la vieja
   puede tenerla otro cliente del proveedor) y recrea `api-gw` con
   `up -d --no-deps api-gw`. **El gateway
   (`api-gw`) se levanta recién cuando el DNS de los dos hosts resuelva:**
   Traefik pide el certificado apenas ve la ruta y cada intento fallido cuenta
   contra el límite de Let's Encrypt (5 por hora). `functions` depende de
   `api-gw`, así que también espera.
   **Medido el 2026-10-09:** con `db auth rest realtime storage imgproxy
   functions auth-templates` arriba y `healthy`, el staging vacío usa 1,4 GB
   de RAM; `public` sin tablas, `storage` con 10 y `auth` con 23.
3. Reconstrucción desde cero, en la laptop y antes de tocar el VPS:
   `pnpm schema:rebuild:supabase` (modo Supabase de `check-schema-rebuild`).
   **Al 2026-10-08 PASÓ:** 450 migraciones + 18 sólo-ledger + contrato de
   aislamiento multi-tenant sobre `supabase/postgres:17.6.1.136`, en 26 s.
4. **Default privileges, el punto que más cuidado pide.** La imagen trae los
   defaults abiertos de Supabase: el rol `postgres` concede ALL sobre tablas,
   secuencias y funciones de `public` a `anon` y `authenticated`. Producción
   NO (medido en `pg_default_acl` el 2026-10-08: solo `postgres` y
   `service_role`). Con los defaults de la imagen, cada tabla que cree una
   migración futura en el servidor nacería abierta para los roles cliente.
   Antes de restaurar o aplicar nada, igualarlos a producción con el mismo
   bloque que usa el rebuild (`supabase/tests/_supabase-platform-stubs.supabase.sql`,
   sección «Default privileges del rol `postgres`»), y verificar:
   `select defaclobjtype, defaclacl from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace`
   no debe nombrar `anon` ni `authenticated`.

### 2.2 Dump de producción y restore (con el OK de la fase)

Lo hace `infra/ops/migrate/import-from-cloud.sh`, **en el VPS**, lanzado por
Sam desde su terminal (`ssh -t`), con el orden oficial de Supabase (`supabase db
dump` de roles, schema y datos → `psql --single-transaction` como
`supabase_admin`, con `session_replication_role = replica` para los datos) más
una pieza que el orden oficial no trae: **`supabase db dump` no incluye el
esquema `supabase_migrations`** (ni tabla ni filas; medido el 2026-10-09), así
que el ledger de migraciones va aparte con `pg_dump --schema=supabase_migrations`
dentro de la misma transacción. Tampoco trae los jobs de `pg_cron` (el script
los recrea) ni los datos de `vault.secrets` (se escriben después, ver abajo).
Garantías:

- **Nada pasa por la laptop.** El dump sale de Cloud al VPS y se escribe en
  `/dev/shm` (memoria); un trap lo borra al salir, también si falla o se corta
  la sesión, y al final se comprueba que no quedó nada.
- **Credenciales sin rastro.** La contraseña de la base (o la cadena entera del
  Session pooler, puerto 5432) y la access key S3 **temporal** de Cloud
  (Storage › S3 Connection) se piden con `read -s`; viajan a los contenedores
  por entorno. La única
  excepción: `supabase db dump` solo acepta `--db-url`, así que mientras dura el
  dump la cadena se ve en `ps` del VPS (solo root entra). Recomendación: rotar
  la contraseña de la base de Cloud al cerrar el ensayo.
- **Minimización.** Sin `--include-logs`, los datos de `mail_logs`,
  `sync_logs`, `public_track_log`, `no_olvidar_access_log`,
  `operario_pin_attempts`, `entity_audit_log` y `auth.audit_log_entries` no
  viajan (las tablas llegan vacías). El ensayo no los necesita.
- **Destino a prueba de errores.** Solo escribe en un proyecto `*-staging`,
  vacío (sin tablas en `public`) y con los default privileges de §2.1 paso 4 ya
  aplicados; si no, rechaza (código 3) sin tocar nada. El restore es una sola
  transacción: si falla, no queda nada a medias.
- **Permisos idénticos a Cloud.** El restore crea los objetos como
  `supabase_admin`, y la imagen le da a ese rol default privileges abiertos en
  `public` (ALL para `anon` y `authenticated`); `pg_dump` solo emite los `GRANT`
  que difieren del valor por defecto y no los revoca. Medido el 2026-10-09 con
  un Cloud falso sembrado como producción: `tenants`, con solo `SELECT` de
  `authenticated` en el origen, quedaba con `INSERT/UPDATE/DELETE/TRUNCATE` para
  `anon` y `authenticated`. Por eso, dentro de la misma transacción, el script
  revoca a los roles cliente (`anon`, `authenticated`, `service_role`, `PUBLIC`)
  y vuelve a dar exactamente los grants de Cloud en cada tabla, secuencia,
  función y columna de `public`. La verificación compara la **huella** de todos
  esos permisos (cantidad + md5) entre Cloud y staging.
- **Storage desde el VPS.** rclone copia los 16 buckets de Cloud (incluido
  `bug-replays`, que ninguna migración crea; su fila llega en el dump) por el
  protocolo S3 de los dos lados, para que `storage-api` del staging escriba el
  backend. Las claves van por variables `RCLONE_CONFIG_*`, sin `rclone.conf` en
  disco.
- **Verificación por conteos y evidencia sin datos personales.** Compara Cloud
  contra staging: `count(*)` de cada tabla de `public` (las de log, en 0),
  `auth.users`, `storage.buckets`, `storage.objects` por bucket, `cron.job`
  (recreados con `cron.schedule_in_database`, inactivos en staging salvo
  `--cron-active`), el ledger por huella de `applied_migration_names()`,
  default privileges sin `anon`/`authenticated`, la huella de permisos de
  `public`, ningún `DELETE` de roles cliente sobre `public.tenants`, y objetos
  de rclone en los dos lados. Escribe PASÓ/FALLÓ en
  `/srv/ops/evidencias/import-<proyecto>-<stamp>.txt` (solo nombres y cifras) y
  sale 7 si algo falló. Al final pide escribir `revocada` después de revocar la
  access key S3 temporal, y deja la hora en la evidencia.

Preparación en el VPS, una vez (CLI con versión fijada y sha256 verificado):

```bash
cd /tmp && V=2.118.0
curl -fsSLO https://github.com/supabase/cli/releases/download/v$V/supabase_${V}_linux_amd64.deb
curl -fsSLO https://github.com/supabase/cli/releases/download/v$V/checksums.txt
grep " supabase_${V}_linux_amd64.deb\$" checksums.txt | sha256sum -c - && dpkg -i supabase_${V}_linux_amd64.deb
rm -f supabase_${V}_linux_amd64.deb checksums.txt
```

El ensayo, desde la terminal de Sam (la llave sale del agente de Windows):

```bash
ssh -t -o ServerAliveInterval=15 -o ServerAliveCountMax=8 root@217.216.54.70 tmux new -A -s traslado /srv/ops/migrate/import-from-cloud.sh --project dtd-cargo-staging --cloud-user postgres.xpfuzqombmjmxvprjgmi --cloud-host aws-1-us-east-1.pooler.supabase.com
```

- **Solo la contraseña.** Con `--cloud-user` y `--cloud-host` el script pide
  únicamente la contraseña de la base: sin corchetes y sin la cadena. Arma la
  URL y codifica los caracteres especiales. Una contraseña entre `[ ]` (los
  corchetes del `[YOUR-PASSWORD]` del panel) se rechaza con la explicación.
- **Dentro de `tmux`.** El 2026-10-11 la conexión de la casa se cortó sola con
  el SSH quieto («client_loop: send disconnect: Connection reset»). Lo que Sam
  pegó después fue a PowerShell, que lo mostró y lo guardó en su historial.
  Con `tmux`, el script sigue esperando aunque se caiga el SSH.
- **Si aparece `Connection reset` o `Connection closed`, no pegues nada.**
  Vuelve a correr el mismo comando: `tmux new -A` te devuelve a la misma
  pregunta. Si ya se pegó en PowerShell, borra esas líneas de
  `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt`
  y cierra la pestaña.
- Al terminar, el script espera un Enter para que el resultado no desaparezca
  con la sesión de `tmux`. La evidencia queda igual en `/srv/ops/evidencias/`.

Después del restore, a mano y con su conteo en el handoff:

- **Vault.** Los secretos no vienen en el dump (y, si vinieran, estarían
  cifrados con la raíz de Cloud, que no se exporta): `kommo_cron_key` se genera
  de nuevo y `kommo_token_dtd_v1` lo vuelve a emitir Sam en Kommo
  (backup-restore-servidor.md §4). Se escriben con
  `infra/ops/migrate/vault-set-secret.sh --project dtd-cargo-staging --name kommo_cron_key`:
  pide el valor con `read -s`, lo pasa por entorno, lo crea si falta o hace
  `update_secret` sobre el mismo id si existe, y solo imprime si descifra igual
  (`true`/`false`). Las funciones leen el secreto por nombre. En staging, con la
  sincronización de Kommo apagada (§2.3), basta con un valor de prueba.
- **`functions_base_url`** = `http://api-gw:8000/functions/v1` (red interna,
  como dice `infra/dtd-cargo/README.md`), con el mismo script y
  `--name functions_base_url` (migración 0472): si no existe, lo crea. No la
  URL pública: `pg_net` llama desde la base, y la URL pública del staging pasa
  por la lista de IP de `compose.staging.yml`, que no incluye al propio VPS.
- **Ledger.** Si la 0472 no está aplicada en Cloud, se aplica en staging con
  `psql` y se inserta su fila; si ya lo está, viene en el dump.

Medido el 2026-10-09 con un «Cloud» falso (otro `supabase/postgres` desechable
sembrado con tablas, usuarios, `cron`, Vault y ledger): guardas, dump,
minimización, restore y verificación; detalle en el handoff de SDD-0505. El
ensayo real con producción es el que valida Storage y los conteos verdaderos.

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

### 2.6 Destruir el staging (siempre, al cerrar el ensayo)

El staging con la copia de producción no se queda «por si acaso». Al cerrar
cada ensayo:

```bash
/srv/ops/staging/destroy-staging.sh --project dtd-cargo-staging --confirm dtd-cargo-staging \
  --evidence /srv/ops/evidencias/destroy-dtd-cargo-staging-$(date -u +%Y%m%dT%H%MZ).txt
```

Borra contenedores, volúmenes y redes del proyecto compose, PGDATA y Storage en
archivos (`DTD_DATA_DIR`), dumps locales y restos en `/dev/shm`, y comprueba que
quede cero de cada cosa (sale 6 si quedó algo). Conserva compose y `.env` para
el segundo ensayo (`--purge-config` borra también el `.env`). Se niega con
producción, con proyectos que no terminan en `-staging`, si `--confirm` no
repite el nombre o si `DTD_DATA_DIR` apunta fuera del staging. Si se tomó un
snapshot de Contabo durante el ensayo, se borra en el panel el mismo día.

El restore de prueba mensual **no** usa staging: va en un contenedor desechable
en memoria (backup-restore-servidor.md §3).

## 3 · Fase 3 — Corte y rollback

Requiere el OK de Sam con hora de la ventana. Antes de pedirlo:

- Fase 2 cerrada y su staging destruido (§2.6).
- La cadena de respaldo probada: `infra/ops/tests/prueba-traslado-y-respaldos.sh`
  PASÓ en el VPS y el remoto real (R2 o B2) contratado, con un dump cifrado de
  prueba subido y restaurado con `restore-test.sh`
  ([backup-restore-servidor.md](backup-restore-servidor.md) §3). El cron diario
  se activa sobre producción el día del corte, no antes: el staging no se
  respalda (§2).
- **Política de privacidad corregida y clientes avisados** (decisión de Sam del
  2026-10-09: «antes del corte»). Hoy dice que los datos «se tratan en
  Venezuela» y no menciona los respaldos. El texto nuevo, revisado por el
  abogado, dice que los datos se alojan en servidores en EE. UU. de un
  proveedor de infraestructura, con respaldos cifrados en otro proveedor que
  conservan copias **30 días** después de una supresión (revisión del traslado,
  H4 y H7).
- pgBackRest o WAL continuo: la spec lo deja pendiente. Si no está, el RPO del
  día del corte es de 24 h, y Sam lo acepta por escrito en el mismo OK.
- TTL del DNS bajado a 300 s 24 h antes (Cloudflare o donde esté el DNS).

### 3.1 Preparación (días antes, sin cortar nada)

Hecho el 2026-10-12 (handoff de SDD-0505):

- `/srv/dtd-cargo` armado y **apagado**, con la marca `NO-ENCENDER-HASTA-EL-CORTE.txt`:
  - compose de producción, sin `compose.staging.yml`; `config` validado, routers `dtd-cargo-web` y `dtd-cargo-supabase`;
  - `functions/` armada y `.env` de `new-env.sh` con secretos NUEVOS de este servidor;
  - imágenes de Supabase bajadas y `dtd-cargo-cron:local` construida;
  - 0 contenedores encendidos.

  Encenderlo antes de tiempo pide certificados para `dtdcargo.com` mientras el DNS apunta a Vercel, y Let's Encrypt los rechaza.

Falta, en este orden:

1. **Modo mantenimiento** (`lib/runtime/maintenance.ts`, hecho el 2026-10-12):
   - `MAINTENANCE_MODE=1` corta toda escritura y muestra «Volvemos en unos minutos». Las páginas públicas se siguen leyendo.
   - En Vercel se fijan antes `MAINTENANCE_MODE=off` (Vercel no acepta valores vacíos; el código solo activa el modo con `1`, `true`, `on` o `si`) y `MAINTENANCE_BYPASS_SECRET`, una clave larga que guarda Sam para el smoke.
   - Cambiar la variable en Vercel exige redeploy, unos minutos: se prende antes de la ventana.
2. **Claves iguales a las de hoy**, con `infra/ops/migrate/env-set.sh` (Sam pega; nada se muestra):
   - `--project dtd-cargo --claves-supabase`: JWT secret, anon y service_role de Cloud. El script comprueba la firma HS256 y los roles antes de guardar. **Hecho el 2026-10-13** (evidencia `env-set-dtd-cargo-supabase-20261013T020821Z.txt`; `api-gw` recreado después). Con eso, y con `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE` (ya en la plantilla), las anon/service_role de hoy siguen valiendo. **Ojo con las sesiones abiertas:** el proyecto de Cloud firma los access tokens con una clave ECC P-256 (JWT Signing Keys, desde mayo de 2026); el secreto HS256 solo verifica las keys legacy. Para que las sesiones sobrevivan sin volver a entrar, el stack del servidor tiene que verificar también la clave pública ECC de Cloud (JWKS de `/auth/v1/.well-known/jwks.json`); pendiente de resolver antes del corte (handoff § Claves de Supabase Cloud). Si no se resuelve, cada usuario entra una vez más.
   - **Inventario real de Vercel (leído el 2026-10-13 en el panel, proyecto `dtdcargo`): 24 variables, casi todas de tipo «Secret» (no se pueden volver a leer: «You can't reveal this value after saving»).** Consecuencias:
     - **No existen en Vercel** `EMAIL_UNSUBSCRIBE_SECRET`, `NEWSLETTER_IP_HASH_SECRET`, `MARCA_ACCESS_SECRET`, `DOCUMENT_IMPORT_RATE_SECRET` ni `PAYLOAD_SECRET`: la app usa `SUPABASE_SERVICE_ROLE_KEY` como secreto de respaldo (`unsubscribe-token.ts`, `marca/access.ts`, hash de IP del newsletter). En el servidor van **vacías** (hecho el 2026-10-13; `new-env.sh` las generaba y eso habría roto los enlaces de baja ya enviados). Con la service_role de Cloud, el comportamiento es idéntico.
     - **Se copian de Vercel** (ojo visible): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
     - **Se leen en el proveedor:** `RESEND_WEBHOOK_SECRET` (Resend › Webhooks › Signing secret `whsec_…`), `TELEGRAM_BOT_TOKEN` y `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (BotFather), `CLOUDFLARE_ACCOUNT_ID` (panel de Cloudflare), `SEARATES_API_KEY` y `SEARATES_PLATFORM_ID` (cuenta de SeaRates). `SEARATES_API_BASE=https://rates.searates.com/graphql` ya está puesto.
     - **Se crean nuevas** (Vercel no las devuelve): `RESEND_API_KEY`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN` (Workers AI). `TELEGRAM_WEBHOOK_SECRET` se genera en el servidor y se registra con `setWebhook` **en el paso 2** (la web), no antes: mientras la web esté en Vercel, Telegram tiene que seguir mandando el secreto de Vercel.
     - **Decisión de Sam, no se pueden leer:** `PORTAL_COLD_REMINDER` (`on` enciende el cron de recordatorios fríos del Portal; en Vercel existe) y `BITACORA_ACTA_MODEL` (vacío = `claude-sonnet-4-6`).
     - **Server-only, ya generadas:** `CRON_SECRET`, `DEBUG_HEALTH_SECRET`, `MAINTENANCE_BYPASS_SECRET`. `VERCEL_PROJECT_ID`/`VERCEL_API_TOKEN` no hacen falta.
     - El resto del bloque no existe en Vercel: queda vacío.
     - Ventana: `env-set.sh --project dtd-cargo --integraciones --solo NEXT_PUBLIC_VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY,VAPID_SUBJECT,RESEND_API_KEY,RESEND_WEBHOOK_SECRET,TELEGRAM_BOT_TOKEN,NEXT_PUBLIC_TELEGRAM_BOT_USERNAME,ANTHROPIC_API_KEY,CLOUDFLARE_ACCOUNT_ID,CLOUDFLARE_API_TOKEN,SEARATES_API_KEY,SEARATES_PLATFORM_ID,PORTAL_COLD_REMINDER,BITACORA_ACTA_MODEL`.
   - `--name KOMMO_WEBHOOK_SECRET`: el secreto que las Edge Functions de Kommo esperan (en Cloud vive en los secrets de Edge Functions; Kommo lo manda en cada webhook, ver `setup-kommo-webhook.md`).
   - `--name SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`: Resend por SMTP para los correos de Auth.
3. **Imagen** desde `main` en GHCR (`sha-<sha>`), con las variables del repo (GitHub → Settings → Secrets and variables → Actions → **Variables**; son valores públicos que `next build` inlinea en el bundle, nunca secrets):
   - `NEXT_PUBLIC_SUPABASE_URL=https://supabase.dtdcargo.com`;
   - la anon de Cloud;
   - `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE=sb-xpfuzqombmjmxvprjgmi-auth-token`;
   - **y `NEXT_PUBLIC_SITE_URL=https://dtdcargo.com`, obligatoria:** `app/layout.tsx` hace `new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://dtdcargo.com")`, y un build arg vacío no es `undefined`, así que el build muere con `TypeError: Invalid URL` («Failed to collect page data for /_not-found»). Así falló el primer intento del workflow tras el merge de la PR #194 (2026-10-13, 10:28Z): el repo no tenía ninguna variable.
   - **Hecho el 2026-10-13 (10:33Z):** las seis variables no vacías del `.env` del servidor (`SITE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_AUTH_COOKIE`, `TELEGRAM_BOT_USERNAME`, `VAPID_PUBLIC_KEY`) se crearon con `gh variable set` leyéndolas por SSH, sin pasar por el chat; `HAILUWAY_API`, `GA_ID`, `BUG_REPLAY_ENABLED`, `CONTACT_EMAIL` y `WHATSAPP_NUMBER` quedan sin definir (vacías también en el servidor). `gh variable list` las muestra. Si cambia un valor en el servidor, se cambia también aquí y se relanza el workflow.
4. **DNS de `supabase.dtdcargo.com`** → `217.216.54.70`. **Hecho el 2026-10-13** (registro A en Hostinger, TTL 300). Con el DNS resolviendo se encendió **solo el gateway** (`up -d --no-deps api-gw`: no tiene `depends_on`) y Traefik obtuvo el certificado de Let's Encrypt en 8 s (vence el 2027-01-11). La base **no** se enciende todavía: `db` se inicializa con el `JWT_SECRET` y la contraseña del `.env` del momento, así que primero van las claves de Cloud (punto 2) y recién después `up -d db auth rest realtime storage imgproxy functions auth-templates`, con `api-gw` recreado (`up -d --force-recreate --no-deps api-gw`, porque Envoy incorpora `ANON_KEY`/`SERVICE_ROLE_KEY` al arrancar). La base queda vacía, como la exige `--corte`; antes de importar, igualar los default privileges (§2.1 paso 4).
5. **TTL del DNS de `dtdcargo.com`** a 300 s, 24 h antes del paso 2.
6. **Sesiones abiertas (hecho el 2026-10-13):** `infra/ops/migrate/jwks-set.sh --project dtd-cargo --cloud-ref xpfuzqombmjmxvprjgmi` escribe `JWT_KEYS` y `JWT_JWKS` en el `.env` (el secreto HS256 firma; la clave pública ECC de Cloud, leída de su JWKS público, solo verifica) y el compose las pasa a auth, rest, realtime, storage y functions. Así un access token ES256 emitido por Cloud sigue valiendo en el servidor hasta que vence (1 h) y el cliente lo refresca con su refresh token, que viaja en el dump. Prueba: `infra/ops/tests/prueba-jwks-sesiones.sh` (15 PASÓ en el stack vacío). **El día del corte, antes del paso 1, volver a correr `jwks-set.sh` y recrear esos cinco servicios:** si Cloud rotó su clave entre tanto, el JWKS viejo no verificaría nada.

### 3.2 Paso 1 · base y archivos (ventana de noche, unos 30 minutos)

La web sigue en Vercel y solo cambia a qué Supabase le habla.

1. **Mantenimiento ON** en Vercel: `MAINTENANCE_MODE=1` y redeploy. Se comprueba con `curl -s -o /dev/null -w '%{http_code}' https://dtdcargo.com/studio/login`, que debe dar `503`.
2. **pg_cron de Cloud en pausa** (`update cron.job set active = false` en Cloud). Es una escritura en producción y va con el OK de Sam: si no, los jobs corren en los dos lados.
3. **La base, desde una terminal en tmux**: `import-from-cloud.sh --project dtd-cargo --corte --cloud-user postgres.xpfuzqombmjmxvprjgmi --cloud-host aws-1-us-east-1.pooler.supabase.com`. Pide escribir `CORTE dtd-cargo` y la contraseña. Viajan las tablas de log con datos, los jobs de pg_cron como en Cloud y los secretos de Vault (descifrados en memoria y re-cifrados con la raíz del servidor; se verifican por huella).
4. **Los archivos**: `storage-from-cloud.sh --project dtd-cargo --cloud-ref xpfuzqombmjmxvprjgmi --corte`, con una access key S3 temporal que se revoca al terminar.
5. **El secreto que Cloud no tiene**: `vault-set-secret.sh --project dtd-cargo --name functions_base_url` con `http://api-gw:8000/functions/v1`.
6. **Vercel apunta al VPS**: `NEXT_PUBLIC_SUPABASE_URL=https://supabase.dtdcargo.com`, `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE=sb-xpfuzqombmjmxvprjgmi-auth-token`, **y las claves legadas (JWT `eyJ…`) en `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`** (Supabase → Project Settings → API Keys → «Legacy API keys»). Redeploy. **Hallazgo del ensayo del 2026-10-13:** la app en Vercel manda una clave que el gateway del VPS rechaza con 401 «Unauthorized» antes de llegar a GoTrue (el proyecto tiene además la `sb_publishable_…` nueva, y el self-hosted solo entiende las legadas); con la anon legada el mismo gateway responde 400 `invalid_credentials`, es decir, ya consulta la base. La frase anterior («siguen siendo las mismas») era falsa.
7. **Webhooks de Kommo** a `https://supabase.dtdcargo.com/functions/v1/…` (`setup-kommo-webhook.md`).
8. **Smoke** (20 minutos):
   - Studio con un admin; PWA con un operario; Portal con un cliente de prueba;
   - una subida de archivo y el tiempo real;
   - un cron a mano.
9. **Mantenimiento OFF:** `MAINTENANCE_MODE=off`, en el mismo redeploy del paso 6 si se puede. Para el smoke de antes (paso 8) se entra por `https://dtdcargo.com/mantenimiento/entrar?clave=<MAINTENANCE_BYPASS_SECRET>`, que deja una cookie de 4 h.

### 3.3 Paso 2 · la web (días después, sin mantenimiento)

1. `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d web cron`, con la imagen que ya corre en Vercel (`DTD_WEB_IMAGE=…:sha-<sha>`).
2. **DNS de `dtdcargo.com` y `www`** al VPS. Vercel y el VPS usan la misma base, así que da igual a cuál llegue cada visita mientras el DNS se actualiza. El certificado del VPS sale con las primeras visitas, en segundos.
3. **Los crons de Vercel se apagan** en el mismo momento: deploy con `vercel.json` sin `crons`, o pausar el proyecto cuando ya no llegue tráfico. Si no, corren dos veces.
4. Resend (webhook y entrante) y Telegram apuntan a `dtdcargo.com`: no cambian, pero se verifican.

### 3.4 Rollback

- **Paso 1, limpio** (el smoke falla con el mantenimiento todavía puesto: no hay
  escrituras de negocio en el VPS):
  - en Vercel, `NEXT_PUBLIC_SUPABASE_URL` de vuelta a Cloud y `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE` vacía, y redeploy;
  - pg_cron de Cloud otra vez `active = true`;
  - mantenimiento OFF.

  Cloud nunca se apagó. Minutos.
- **Paso 2, limpio:** DNS de `dtdcargo.com` de vuelta a Vercel. La base no cambia, así que no se pierde nada.
- **Sucio** (ya hubo escrituras en el VPS): hay datos nuevos que Cloud no
  tiene. Volver exige un dump inverso (VPS → Cloud) con su propia autorización
  y una ventana nueva. Por eso el smoke del §3.2.8 va **antes** de
  quitar el mantenimiento.

### 3.5 Después del corte

Vercel y Supabase Cloud quedan encendidos **14 días** como red de seguridad. Con
el pg_cron de Cloud en pausa y los crons de Vercel apagados en el paso 2, nada
corre dos veces; Vercel se pausa (no se borra) cuando ya no le llegue tráfico.
Uptime Kuma (`infra/ops/`) vigila `https://dtdcargo.com/` y
`https://dtdcargo.com/api/debug/health?cheap=1` con el bearer.

### 3.6 Guion del corte de DTD Cargo, con tiempos (propuesta: domingo 2026-10-18, 07:00 de Caracas)

Escrito el 2026-10-13 con el estado real del servidor (handoff de SDD-0505).
Horas en Caracas (UTC−4). Paso 1 dura ~1 h con la app en mantenimiento; el
rollback limpio vale hasta que se quite el mantenimiento. «Sam» = lo hace Sam en
un panel; «VPS» = lo corre el Worker por SSH, en `tmux`, con Sam pegando lo que
sea secreto.

**Antes del viernes 16 (checklist; si falta algo, se corre una semana):**

| # | Qué | Quién | Cómo se comprueba |
|---|---|---|---|
| 1 | PR #194 con `pnpm verify` y merge. **`pnpm verify` PASÓ el 2026-10-13** (14/17 medidos sin fallos sobre `39b2465e`; `sql-tests` 225/225 y `schema-rebuild` 468 migraciones aparte con Docker). Falta el merge, con el OK de Sam | Director | imagen `ghcr.io/hailuwaycom-sketch/dtdcargo:sha-<sha de main>` publicada por el workflow |
| 2 | `MAINTENANCE_MODE=off` y `MAINTENANCE_BYPASS_SECRET` en Vercel, Production y Preview, y un redeploy. **`MAINTENANCE_MODE=off` creada el 2026-10-13** (tipo Config; Vercel no acepta valores vacíos y el código solo activa el modo con `1`, `true`, `on` o `si`). **`MAINTENANCE_BYPASS_SECRET` pegada por Sam el 2026-10-13** (tipo Secret, Production y Preview: «listo, ya pegué la clave en Vercel»; las tres filas se ven en el panel). Falta el redeploy: lo trae el merge de la PR | Sam | el valor del secreto es el de `/srv/dtd-cargo/.env` (`grep ^MAINTENANCE_BYPASS_SECRET`); `curl -s -o /dev/null -w '%{http_code}' https://dtdcargo.com/studio/login` sigue 200 |
| 3 | Aviso a los clientes del cambio de alojamiento (borrador listo en `docs/legal/privacidad/aviso-clientes-traslado-2026-10.md`: Sam aprueba texto y fecha y lo envía); facturas de Supabase al día | Sam | — |
| 4 | Avisos de Uptime Kuma a Telegram configurados (mensaje de prueba recibido). **Hecho el 2026-10-13** (bot `@dtdcargobot`, «Sent Successfully»; el interruptor de Telegram está encendido en los 4 monitores, comprobado en `/edit/1..4`) | Sam | Ajustes → Notificaciones |
| 5 | `jwks-set.sh --project dtd-cargo --cloud-ref xpfuzqombmjmxvprjgmi` y `up -d --force-recreate --no-deps auth rest realtime storage functions` | VPS | `prueba-jwks-sesiones.sh` (vuelve a dejar el JWKS limpio) |
| 6 | `backup.sh --dry-run` imprime la cadena completa; `rclone lsf b2:dtdcargo-respaldos` responde | VPS | — |
| 7 | Access key S3 temporal nueva en Cloud (Storage › S3 › Access keys) para `storage-from-cloud.sh`; se revoca al terminar | Sam | — |
| 8 | TTL de `dtdcargo.com` y `www` a 300 s en Hostinger (para el paso 2 del 25) | Sam o Worker con su OK | `dig +short -t A dtdcargo.com` sigue dando Vercel |

**Ejecución real decidida por Sam el 2026-10-13 (14:35Z): paso 1 el martes 13 a las 22:00 de Caracas (02:00Z del 14).** La tabla de abajo vale igual con las horas corridas (+15 h): 21:50 última mirada · 22:00 mantenimiento ON · 22:06 pausar pg_cron de Cloud · 22:08 `import-from-cloud.sh --corte` · 22:20 `storage-from-cloud.sh --corte` · 22:26 `vault-set-secret.sh` · 22:28 marca fuera, primer respaldo, monitor del latido · 22:32 Vercel (URL, cookie, **claves legadas**) y redeploy · 22:40 webhooks de Kommo · 22:41 `kommo_run_sync` · 22:42 smoke · 23:00 mantenimiento OFF · hasta 01:00 vigilancia. **Lo que Sam tiene a mano desde las 21:45:** factura de Supabase pagada (la organización se factura por el Marketplace de Vercel), aviso corto enviado por la tarde, contraseña de la base de Cloud (pooler, sin corchetes), acceso al panel de Supabase para crear la access key S3 temporal a las 22:18 y a la pestaña Legacy API keys, acceso a Vercel (Production) y a Kommo (webhooks). Rollback limpio hasta las 23:00.

**Domingo 18 (paso 1: base y archivos):**

| Hora | Paso | Quién | Comprobación |
|---|---|---|---|
| 06:50 | Última mirada: 9 contenedores de Supabase `healthy` en el VPS, `auth/v1/health` 200, Cloud accesible (`import-from-cloud.sh` sin `--corte` no se corre: solo se comprueba la contraseña a mano con `psql`) | VPS | — |
| 07:00 | `MAINTENANCE_MODE=1` en Vercel y redeploy | Sam | `/studio/login` → 503; `/` → 200 |
| 07:06 | Pausar pg_cron en Cloud: `update cron.job set active = false` (3 jobs) | Worker por el conector, **con el OK nominal de Sam en el chat** | `select jobname, active from cron.job` → 3 × false |
| 07:08 | `import-from-cloud.sh --project dtd-cargo --corte --cloud-user postgres.xpfuzqombmjmxvprjgmi --cloud-host aws-1-us-east-1.pooler.supabase.com` en tmux; Sam escribe `CORTE dtd-cargo` y pega la contraseña | VPS + Sam | el script termina en PASÓ: conteos iguales por tabla, logs con datos, ledger 478 = Cloud, permisos de `public` por huella, pg_cron 3 activos, Vault copiado |
| 07:20 | `storage-from-cloud.sh --project dtd-cargo --cloud-ref xpfuzqombmjmxvprjgmi --corte`; Sam pega la access key temporal | VPS + Sam | 16 buckets, 638+ objetos y bytes iguales; Sam revoca la access key |
| 07:26 | `vault-set-secret.sh --project dtd-cargo --name functions_base_url` con `http://api-gw:8000/functions/v1` | VPS | `select name from vault.decrypted_secrets` muestra `functions_base_url` y `kommo_cron_key` |
| 07:28 | `rm /srv/dtd-cargo/NO-ENCENDER-HASTA-EL-CORTE.txt`; `systemctl start dtd-cargo-backup.service` (primer respaldo real, con datos); reanudar el monitor «Respaldo diario DTD · latido» en Uptime Kuma | VPS | `tail /var/log/backup-dtd-cargo.log` → PASÓ y «latido enviado»; el monitor en verde |
| 07:32 | Vercel (Production): `NEXT_PUBLIC_SUPABASE_URL=https://supabase.dtdcargo.com`, `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE=sb-xpfuzqombmjmxvprjgmi-auth-token`, **`NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` = las claves LEGADAS (JWT) de Supabase → API Keys → Legacy** (la `sb_publishable_`/`sb_secret_` nueva no sirve en el VPS: hallazgo del ensayo del 13-10); redeploy | Sam | `/studio/login` sigue 503 (mantenimiento); en el `api-gw` del VPS, `POST /auth/v1/token` debe responder 400 o 200, nunca 401 «Unauthorized» (= clave rechazada) |
| 07:40 | Webhooks de Kommo → `https://supabase.dtdcargo.com/functions/v1/kommo-webhook?secret=<el del .env del VPS>` | Sam | `docker logs dtd-cargo-functions-1` recibe un evento de prueba |
| 07:41 | `select public.kommo_run_sync();` una vez en el VPS (como `postgres`): recupera lo que Kommo cambió entre el dump y el cambio de webhooks, que fue a parar a la función de Cloud (revisión §3.7 D.1) | VPS | la RPC termina sin error; `docker logs dtd-cargo-functions-1` muestra `kommo-sync` |
| 07:42 | Smoke con el mantenimiento puesto, entrando por `https://dtdcargo.com/mantenimiento/entrar?clave=<MAINTENANCE_BYPASS_SECRET>` (cookie de 4 h): Studio con un admin (sesión ya abierta: no debe pedir login); Portal con un cliente de prueba; PWA `/m` con PIN; una subida de archivo y su descarga; bitácora en tiempo real; un cron disparado desde el panel de Vercel; un correo de acceso (magic link) | Sam + Worker | todo PASÓ en el handoff; `docker logs` de auth/rest/storage/realtime sin errores |
| 08:00 | `MAINTENANCE_MODE=off` en Vercel y redeploy | Sam | `/studio/login` → 200; Uptime Kuma en verde |
| 08:05 | Avisar al equipo; mirar Kuma y los logs durante 2 h | Sam + Worker | — |

**Rollback limpio (antes de las 08:00):** Vercel vuelve a `NEXT_PUBLIC_SUPABASE_URL` de Cloud, `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE` vacía y las claves que tenía antes en `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` (Vercel no las deja leer: se copian de nuevo de Supabase → API Keys; las legadas también valen en Cloud mientras no se desactiven) (redeploy); `update cron.job set active = true` en Cloud; mantenimiento fuera. El VPS se deja encendido para analizar; antes del siguiente intento, `destroy-staging.sh` **no** sirve (es producción): se vacían los datos a mano con `docker compose down -v` + borrar `/srv/dtd-cargo/data`, con el OK de Sam.

**Después del paso 1:** Cloud y Vercel siguen encendidos 14 días (pg_cron de Cloud en pausa). Lunes 19: `restore-test.sh` con el dump real de la noche (registro en `backup-restore-servidor.md` §8). Se vigila el latido y `supabase.dtdcargo.com` en Kuma.

**Domingo 25 (paso 2: la web, sin mantenimiento):**

| Hora | Paso | Quién |
|---|---|---|
| 07:00 | `DTD_WEB_IMAGE=ghcr.io/hailuwaycom-sketch/dtdcargo:sha-<sha de main>` en el `.env`; `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d web cron`; `web` healthy; `curl -H 'Host: dtdcargo.com' https://217.216.54.70/robots.txt -k` → 200 | VPS |
| 07:10 | Hostinger: `A dtdcargo.com` y `CNAME www` → `217.216.54.70` (TTL 300 desde el 24) | Sam |
| 07:15 | Certificado de `dtdcargo.com` emitido por Traefik con las primeras visitas; `curl -sI https://dtdcargo.com` con emisor Let's Encrypt | VPS |
| 07:20 | Telegram: `setWebhook` con `https://dtdcargo.com/api/telegram/webhook` y `secret_token` = `TELEGRAM_WEBHOOK_SECRET` del `.env` del servidor | VPS (token del `.env`) |
| 07:25 | Apagar los crons de Vercel (deploy con `vercel.json` sin `crons`) o pausar el proyecto cuando ya no llegue tráfico | Sam |
| 07:30 | Smoke público: `/`, `/tarifas`, Studio, Portal, PWA, un correo; Resend (webhook e inbound) y Telegram siguen apuntando a `dtdcargo.com` | Sam + Worker |

Rollback del paso 2: DNS de vuelta a Vercel (TTL 300); la base no cambia.

### 3.7 Revisión de preparación del corte (go/no-go), medida el 2026-10-13

Hecha después del ensayo 2 (handoff § «Ensayo 2»), con cifras tomadas ese día de
Cloud (solo metadatos) y del VPS. Cada fila dice qué se midió, cómo y qué falta.
«OK» = medido y en paridad; «OK·corregido» = estaba mal y se corrigió el mismo
día; «ABIERTO» = decisión o acción pendiente antes del corte.

**A · Datos y esquema (lo que no se ve en un smoke)**

| Qué | Medición | Estado |
|---|---|---|
| Tablas, filas, usuarios, buckets, objetos, ledger | `import-from-cloud.sh --corte`: 279 PASÓ (266 tablas comparadas, 308 usuarios, 643 objetos, ledger 478, `applied_migration_names()` igual `27299b22…`) | OK |
| Archivos de Storage | `storage-from-cloud.sh --corte`: 52 PASÓ, 643 objetos / 474.383.445 bytes iguales, 0 filas sin archivo, mimetypes y dueños iguales | OK |
| Permisos de `public` y default privileges | huella `3295:a1c26667…` igual a Cloud; `pg_default_acl` `4ca2c66f…` igual antes de importar | OK |
| **Secuencias** (el clásico olvidado: inserciones que chocan después del corte) | las 6 secuencias de `public`/`auth`/`storage` existen en los dos lados con el mismo valor al momento del dump (`brand_access_attempts` 1, `operario_pin_attempts` 3, `document_*_outbox` null, `auth.refresh_tokens` 2271 vs 2276 en Cloud, que siguió viva) | OK |
| **URLs absolutas de Cloud guardadas en los datos** (`https://xpfuzqombmjmxvprjgmi.supabase.co/…` en avatares, plantillas, adjuntos) | barrido de todas las columnas `text`/`varchar`/`json`/`jsonb` de `public`, `storage` y `auth` en la copia: **ninguna** fila | OK |
| Publicación de tiempo real | `supabase_realtime` 11 tablas en los dos lados (`…messages_publication` difiere por las particiones diarias: esperado) | OK |
| Roles y sus límites | `anon` 3 s, `authenticated` 8 s, `authenticator` 8 s + `safeupdate`, `service_role` sin límite: iguales | OK |
| Vault | 2 secretos (`kommo_cron_key`, `kommo_token_dtd_v1`) re-cifrados con la raíz del servidor y verificados por huella `2d4254d7…` | OK |
| pg_cron | 3 jobs recreados 1:1; `cron.timezone` GMT en los dos lados; en el corte quedan activos como en Cloud | OK |
| Extensiones | VPS sin `hypopg`/`index_advisor` (herramientas de análisis, no de la app); el restore completo no las necesitó | OK |

**B · Servicios del VPS frente a Cloud (configuración)**

| Qué | Medición | Estado |
|---|---|---|
| Postgres | VPS `shared_buffers` 1 GB, `max_connections` 100, `work_mem` 8 MB (Cloud 256 MB / 60 / 3,5 MB): más holgado. `statement_timeout` de sesión 0 en el VPS vs 2 min en Cloud (solo afecta a `postgres`; los roles de la app llevan el suyo) | OK |
| PostgREST | `db-max-rows` 1000 y `db-schemas` `public,graphql_public` iguales a Cloud; **`db-extra-search-path` era `public` y Cloud usa `public, extensions`** (una RPC que nombre `uuid_generate_v4()` sin esquema fallaría) → `PGRST_DB_EXTRA_SEARCH_PATH=public,extensions` en el `.env` del VPS, `rest` recreado y `.env.example` actualizado | OK·corregido |
| GoTrue | `JWT_EXP` 3600, OTP 3600, SMTP Resend, `URI_ALLOW_LIST` = `https://dtdcargo.com/portal/callback`, que es la única `redirectTo` que usa la app (`app/entrar/actions.ts`, `lib/studio/portal/magic-link.ts`). Sesiones firmadas por Cloud (ES256) aceptadas: 15/15 | OK |
| Storage | backend `file`, límite 50 MB (Cloud lo tiene reducido por el tope de gasto), TUS probado 12 MB en staging | OK |
| Edge Functions | 4 funciones de Kommo cargadas; `VERIFY_JWT=false` con secreto propio (403/403/200); `SUPABASE_URL` interno | OK |
| Memoria | límites por contenedor: db 4 GB, functions 768 MB, realtime 768 MB, storage 512 MB, imgproxy 512 MB, rest 384 MB, auth 256 MB, api-gw 256 MB (≈7,6 GB de 23 GB); uso real 2 GB | OK |
| Host | solo 22/80/443 a la escucha; `ufw` activo; `fail2ban` y `unattended-upgrades` activos; logs de Docker 50 MB × 3; certificados Let's Encrypt en `acme.json` (600, 5 certificados, renovación automática) | OK |
| Respaldo | timer 06:00 UTC encendido con la marca de apagado; cadena contra Backblaze 12/12 con restore; clave restringida verificada tras rotar la maestra | OK |
| Monitoreo | Uptime Kuma: web, auth, storage, latido del respaldo (en pausa hasta el corte); Telegram en los 4 | OK |

**C · La app en Vercel contra el VPS (el camino del domingo)**

| Qué | Medición | Estado |
|---|---|---|
| Claves API | Vercel usa la familia nueva (`sb_publishable_`/`sb_secret_`) y el self-hosted solo acepta las legadas: 401 en el gateway hasta cambiarlas. Con las legadas en el Preview: login 200 | OK·corregido (guion §3.2.6, 07:32 y rollback) |
| Login por contraseña, sesión, datos | GoTrue del VPS registró el login de Sam con su contraseña de siempre; dashboard con datos; `/auth/v1/user` y `/rest/v1` 200 | OK |
| Tiempo real | conexiones activas en realtime del VPS desde el Studio | OK |
| Storage por URL firmada (cliente admin → `service_role` legado) | `POST …/object/sign` 200 (node) + `GET` 200 del navegador, PNG de 1.847 bytes | OK |
| Escritura aislada | tarea creada desde el Preview: VPS 1, Cloud 0 | OK |
| **Modo mantenimiento en Vercel** (nunca encendido antes en Vercel) | `MAINTENANCE_MODE=1` solo en el Preview de la rama: `/studio/login` y `/portal` 503 con «Estamos haciendo una mejora», `/api/*` 503 JSON con `Retry-After: 300`, `/` y `/tarifas` 200, clave de bypass incorrecta → 503 | OK |
| CSP | solo `https://supabase.dtdcargo.com`; sin referencias a Cloud en el código fuera de comentarios | OK |
| No cubierto por el Preview | Portal con cliente, PWA `/m` con PIN, magic link, crons, subida de archivo (pasaron en el staging del 12-10 por el camino Docker); Kommo con un evento real | ABIERTO (riesgo bajo; se cubren en el smoke del corte) |

**D · Mecánica del corte: lo que la revisión cambia en el guion**

1. **Eventos de Kommo durante la ventana.** Entre el dump (07:08) y el cambio de webhooks (07:40) Kommo sigue avisando a la función de **Cloud**, y esos cambios no viajan. Arreglo: después del paso 1 correr una vez `select public.kommo_run_sync();` en el VPS (es lo que hace el job diario `kommo-sync-dtd`): trae de Kommo lo que haya cambiado. Fila nueva en el guion (07:41).
2. **Claves legadas en Vercel** (arriba) y su vuelta en el rollback.
3. **Vaciar la copia del ensayo** antes del corte real, con OK de Sam: `docker compose … down -v` + `rm -rf /srv/dtd-cargo/data/{db,storage}` + `up -d` + igualar default privileges (§2.1 paso 4) + comprobar huella `4ca2c66f…`. **Rotar en el mismo paso** `POSTGRES_PASSWORD` (la base se inicializa con la nueva) y `KOMMO_WEBHOOK_SECRET` (se fija en Kommo recién el día del corte): un listado de env del 13-10 dejó fragmentos de los dos en el transcript local del Worker.
4. **Borrar las 5 variables de la rama en Vercel** (`NEXT_PUBLIC_SUPABASE_URL`, `…_AUTH_COOKIE`, `…_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `MAINTENANCE_MODE`) al cerrar el ensayo; no afectan a producción pero no deben quedar.
5. **Factura de Supabase**: el panel muestra «Outstanding invoice». Un proyecto suspendido por pago no se puede exportar: se paga antes del corte.
6. **CLI de Supabase**: queda en 2.118.0 hasta después del corte (el aviso de 2.120.0 no se atiende entre ensayo y corte).

**E · Decisiones que quedan en Sam**

| Decisión | Opciones | Recomendación del Worker |
|---|---|---|
| Fecha del corte | hoy 21:00 Caracas · domingo 18 07:00 | Técnicamente listo para cualquiera de las dos. Si hoy: factura pagada, aviso corto enviado por la tarde, Sam disponible 20:45-22:00 para pegar la contraseña de Cloud, la access key S3 y las claves legadas en Vercel. Si hay la menor duda, domingo: el ensayo no caduca. |
| Aviso a clientes | enviar hoy · enviar jueves | Enviar el día antes del corte elegido (borrador en `docs/legal/privacidad/aviso-clientes-traslado-2026-10.md`). |
| Paso 2 (la web al VPS) | 25 de octubre · antes | Mantener el 25: el paso 1 ya quita la dependencia de Supabase Cloud; el 2 quita la de Vercel y necesita el TTL bajado 24 h antes y el `docker login` ya hecho (listo). |

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
| 2026-10-09 | 1 (parcial) | Worker SDD-0505, con Sam en el panel | Reinstalado Ubuntu 24.04.5; SSH solo con llave; ufw 22/80/443; fail2ban; actualizaciones automáticas; swap 4 GB; Docker 29.9 + Compose v5.6; `/srv` creado; **benchmark PASÓ** (21.428 IOPS, fsync p95 7,24 ms). Faltan Tailscale, panel/Traefik, snapshot «base limpia» y repetir el benchmark otro día | `.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md` § Fase 1 en el VPS |
| 2026-10-09 → 2026-10-13 | 2 | Worker SDD-0505, con Sam en las ventanas de credenciales | Staging vacío (2026-10-09); base importada desde Cloud con `--skip-storage` (2026-10-12: 277 PASÓ, 266 tablas, 305 usuarios, ledger 477 → 478 con la 0472); archivos con `storage-from-cloud.sh` (638 objetos, 470.562.607 bytes, 51 PASÓ + 1 esperado); smokes con datos (correo de Auth 11/11, TUS y tiempo real 9/9, 19 crons, Studio); sesiones, claves, scripts del corte, mantenimiento y producción armada y apagada; **staging destruido el 2026-10-13 con evidencia** (`/srv/ops/evidencias/destroy-dtd-cargo-staging-20261013T0132Z.txt`: 0 contenedores, 0 volúmenes, 0 redes, 0 datos). Fuera de esta fase: pgBackRest (§7 del runbook de backup) | `.agents/handoffs/0505-dockerizar-dtd-cargo-contabo.md` § Fase 2 |
| — | 3 | — | pendiente: 0472 aplicada en Cloud (2026-10-13), respaldo diario instalado y encendido, texto de privacidad aprobado y **publicado con el merge de la PR #194 (`2035a5fa`, 2026-10-13 10:27Z, OK de Sam: «ok, haz el merge»)**; claves de Cloud e integraciones en el servidor, DNS de `supabase.dtdcargo.com`, sesiones ES256, Kuma con Telegram, `MAINTENANCE_MODE=off` y el secreto de bypass en Vercel, Backblaze limpio (bucket de prueba borrado, maestra rotada); aviso a clientes en borrador; **imagen de `main` publicada** (`ghcr.io/hailuwaycom-sketch/dtdcargo:sha-2035a5faeb7f8b526843b22a9cc4276ee707a479`, cuarto intento del workflow: tres caídas por la descarga de fuentes de Google en el runner, y la primera además por las variables del repo que faltaban, ya creadas). Faltan TTL/registros viejos en Hostinger, facturas, 2FA en Kuma, el `docker login ghcr.io` del servidor y la fecha | handoff § «Con los pendientes, hazlo tú» |
| — | 4 | — | pendiente | — |
