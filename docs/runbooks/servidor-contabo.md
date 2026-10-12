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
   - En Vercel se fijan antes `MAINTENANCE_MODE` (vacía) y `MAINTENANCE_BYPASS_SECRET`, una clave larga que guarda Sam para el smoke.
   - Cambiar la variable en Vercel exige redeploy, unos minutos: se prende antes de la ventana.
2. **Claves iguales a las de hoy**, con `infra/ops/migrate/env-set.sh` (Sam pega; nada se muestra):
   - `--project dtd-cargo --claves-supabase`: JWT secret, anon y service_role de Cloud. El script comprueba la firma HS256 y los roles antes de guardar. Con eso, y con `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE` (ya en la plantilla), **las sesiones abiertas siguen valiendo**.
   - `--project dtd-cargo --integraciones --todas`: las de Vercel. Tienen que ser las MISMAS:
     - `EMAIL_UNSUBSCRIBE_SECRET`, que firma los enlaces de baja de correos ya enviados;
     - `NEWSLETTER_IP_HASH_SECRET`, `MARCA_ACCESS_SECRET` y `DOCUMENT_IMPORT_RATE_SECRET`;
     - las `VAPID_*`, sin las cuales las notificaciones push dejan de llegar a los teléfonos ya suscritos.
   - `--name SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`: Resend por SMTP para los correos de Auth.
3. **Imagen** desde `main` en GHCR (`sha-<sha>`), con las variables del repo:
   - `NEXT_PUBLIC_SUPABASE_URL=https://supabase.dtdcargo.com`;
   - la anon de Cloud;
   - `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE=sb-xpfuzqombmjmxvprjgmi-auth-token`.
4. **DNS de `supabase.dtdcargo.com`** → `217.216.54.70`. Ese nombre no existe hoy, así que se puede crear antes. Después se encienden solo los servicios de Supabase (no `web` ni `cron`): el certificado sale antes del día del corte y la base queda vacía, como la exige `--corte`.
5. **TTL del DNS de `dtdcargo.com`** a 300 s, 24 h antes del paso 2.

### 3.2 Paso 1 · base y archivos (ventana de noche, unos 30 minutos)

La web sigue en Vercel y solo cambia a qué Supabase le habla.

1. **Mantenimiento ON** en Vercel: `MAINTENANCE_MODE=1` y redeploy. Se comprueba con `curl -s -o /dev/null -w '%{http_code}' https://dtdcargo.com/studio/login`, que debe dar `503`.
2. **pg_cron de Cloud en pausa** (`update cron.job set active = false` en Cloud). Es una escritura en producción y va con el OK de Sam: si no, los jobs corren en los dos lados.
3. **La base, desde una terminal en tmux**: `import-from-cloud.sh --project dtd-cargo --corte --cloud-user postgres.xpfuzqombmjmxvprjgmi --cloud-host aws-1-us-east-1.pooler.supabase.com`. Pide escribir `CORTE dtd-cargo` y la contraseña. Viajan las tablas de log con datos, los jobs de pg_cron como en Cloud y los secretos de Vault (descifrados en memoria y re-cifrados con la raíz del servidor; se verifican por huella).
4. **Los archivos**: `storage-from-cloud.sh --project dtd-cargo --cloud-ref xpfuzqombmjmxvprjgmi --corte`, con una access key S3 temporal que se revoca al terminar.
5. **El secreto que Cloud no tiene**: `vault-set-secret.sh --project dtd-cargo --name functions_base_url` con `http://api-gw:8000/functions/v1`.
6. **Vercel apunta al VPS**: `NEXT_PUBLIC_SUPABASE_URL=https://supabase.dtdcargo.com` y `NEXT_PUBLIC_SUPABASE_AUTH_COOKIE=sb-xpfuzqombmjmxvprjgmi-auth-token`. La anon y la service_role siguen siendo las mismas. Redeploy.
7. **Webhooks de Kommo** a `https://supabase.dtdcargo.com/functions/v1/…` (`setup-kommo-webhook.md`).
8. **Smoke** (20 minutos):
   - Studio con un admin; PWA con un operario; Portal con un cliente de prueba;
   - una subida de archivo y el tiempo real;
   - un cron a mano.
9. **Mantenimiento OFF:** `MAINTENANCE_MODE` vacía, en el mismo redeploy del paso 6 si se puede. Para el smoke de antes (paso 8) se entra por `https://dtdcargo.com/mantenimiento/entrar?clave=<MAINTENANCE_BYPASS_SECRET>`, que deja una cookie de 4 h.

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
| — | 2 | — | pendiente | — |
| — | 3 | — | pendiente | — |
| — | 4 | — | pendiente | — |
