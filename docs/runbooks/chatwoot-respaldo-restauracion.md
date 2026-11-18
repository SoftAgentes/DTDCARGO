# Runbook · Respaldo y restauración conjunta de Chatwoot · SDD-0583

**SDD:** [0583](../specs/0583-chatwoot-vps-e1/spec.md), paso 1.5 del programa [0582](../specs/0582-chatwoot-piloto/checklist.md)
**Estado:** **en el VPS desde el 2026-10-29**: timer diario activo, respaldos en B2 y **P5 hecha** el mismo día (restauración desde B2 en 200 s, §6). Desde el 2026-10-29 los respaldos se cifran para dos llaves: la de Sam (`f0bdbaa9…`, en su gestor) y la de emergencia (`f2b06f66…`, fuera de línea); ver `backup-restore-servidor.md`, «Registro · 2026-10-29».
**RPO:** 24 h (respaldo diario). **RTO objetivo:** ≤ 2 h, de los que la restauración en sí mide ~1 min con datos de prueba (§5).
**Base:** el mismo esquema que [backup-restore-servidor.md](backup-restore-servidor.md) de DTD: `age`, `/dev/shm`, `rclone copy` a B2, latido en Uptime Kuma.

## 1 · Qué es un respaldo de Chatwoot

Tres piezas que **solo sirven juntas**, en una carpeta `chatwoot-<sello>`:

| Pieza | Qué guarda | Sin ella |
|---|---|---|
| `db.dump.age` | `pg_dump -Fc` de `chatwoot_production`: cuentas, usuarios, contactos, conversaciones, mensajes, bandejas, configuración | no hay nada que restaurar |
| `storage.tar.age` | `/app/storage`: adjuntos (imágenes, audios, PDF) | los mensajes quedan con adjuntos rotos |
| `env.age` | el `.env`: `SECRET_KEY_BASE` y las tres claves de cifrado de columnas | tokens de WhatsApp y Facebook, contraseñas IMAP/SMTP, secretos de webhooks y 2FA **no se recuperan**, y Chatwoot no avisa: devuelve el sobre cifrado como valor (controles R4 y R4b del ensayo) |
| `manifiesto.txt` (en claro) | sello, imagen, versión, conteos de filas y archivos, sha256 de las tres piezas | no se puede comprobar la restauración |

El manifiesto no lleva datos personales ni secretos (lo comprueba R1b del ensayo).

**Custodia separada:**
- Las piezas cifradas viven en el VPS 7 días (`/srv/backups/chatwoot/`) y en B2 30 días (`b2:dtdcargo-respaldos/chatwoot/`, prefijo propio, fuera de Contabo).
- La clave **privada** `age` de Sam no vive en el VPS ni en B2: gestor de contraseñas y papel en la caja fuerte (la misma de DTD, §4 de backup-restore-servidor).
- El `.env` además va al gestor de contraseñas de Sam el día que se crea y cada vez que cambia.

## 2 · Respaldo diario (puerta P1)

`infra/chatwoot/respaldo.sh`, con el timer `chatwoot-respaldo.timer` a las 06:30 UTC (media hora después del de DTD, para no solaparse; `Nice=10` y E/S en clase `idle`).

Orden: base → adjuntos → claves → manifiesto → `rclone copy` + `check` → retención → latido.

- El dump va a `/dev/shm` solo mientras `pg_restore --list` lo comprueba; se cifra y se borra. Un `trap` limpia aunque algo falle.
- Los adjuntos no tocan el disco en claro: `tar` sale del contenedor y entra directo a `age`.
- El latido a Uptime Kuma («Respaldo Chatwoot · latido», Push, 26 h, 0 reintentos) solo sale si todo lo anterior salió 0.

Instalar (en el VPS, dentro de P1):

```bash
install -m 644 /srv/chatwoot/systemd/chatwoot-respaldo.{service,timer} /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now chatwoot-respaldo.timer
systemctl start chatwoot-respaldo.service && tail -n 20 /var/log/chatwoot-respaldo.log   # primera corrida a mano
```

Revisión semanal (2 minutos):

```bash
docker run --rm -v /srv/ops/backup/rclone:/config/rclone:ro rclone/rclone:1.75.1 \
  lsd b2:dtdcargo-respaldos/chatwoot/ | tail -7      # 7 carpetas de fechas seguidas
```

**Consistencia.** La base se copia antes que los adjuntos. Un adjunto subido entre las dos copias queda como archivo huérfano (inofensivo). Uno a medio subir en el instante del dump puede quedar como fila sin archivo: se ve como adjunto roto en ese mensaje. Con dos personas atendiendo, la ventana es de segundos; se acepta.

## 3 · Restauración

`infra/chatwoot/restaurar.sh` restaura en un proyecto de Compose **vacío**. Se niega si el destino ya tiene contenedores, tablas o `.env`.

```bash
# 1. La clave privada solo en RAM, solo mientras dura (Sam la pega; no se ve).
read -rs K && umask 077 && printf '%s\n' "$K" >/dev/shm/clave.txt && unset K
# 2. Bajar el respaldo DESDE B2 (prueba toda la cadena, no la copia local).
docker run --rm -v /srv/ops/backup/rclone:/config/rclone:ro -v /srv/restaurar:/data rclone/rclone:1.75.1 \
  copy b2:dtdcargo-respaldos/chatwoot/chatwoot-<sello> /data/chatwoot-<sello>
# 3a. Recuperación real (el VPS o la carpeta se perdieron): carpeta limpia con compose.yml y rails/.
restaurar.sh --desde /srv/restaurar/chatwoot-<sello> --identidad /dev/shm/clave.txt --dir /srv/chatwoot
# 3b. Ensayo en el mismo host (puerta P5): OTRO proyecto, OTRO host y OTRA carpeta de datos.
restaurar.sh --desde /srv/restaurar/chatwoot-<sello> --identidad /dev/shm/clave.txt \
  --dir /srv/chatwoot-ensayo --project chatwoot-ensayo \
  --sobrescribir CHATWOOT_HOST=chat-ensayo.dtdcargo.com \
  --sobrescribir CHATWOOT_FRONTEND_URL=https://chat-ensayo.dtdcargo.com \
  --sobrescribir CHATWOOT_DATA_DIR=/srv/chatwoot-ensayo/data
# 4. Fuera la clave y los cifrados bajados.
shred -u /dev/shm/clave.txt; rm -rf /srv/restaurar/chatwoot-<sello>
```

Con el mismo `CHATWOOT_HOST`, Traefik repartiría el tráfico real entre producción y el ensayo: por eso `--sobrescribir` es obligatorio en 3b. El ensayo en el host no necesita DNS: se comprueba con `curl --resolve chat-ensayo.dtdcargo.com:443:127.0.0.1` (o con TLS por defecto de Traefik) y se baja con `docker compose -p chatwoot-ensayo down -v` al terminar.

Qué hace, en orden: sha256 contra el manifiesto → `.env` 0600 (+ `--sobrescribir`) → `postgres` y `redis` vacíos → `age -d | pg_restore` → `age -d | tar -x` en el volumen de `rails` → `up --wait` (prepare migra si hiciera falta) → conteos y archivos contra el manifiesto → **cuántas columnas cifradas devuelven un sobre** (si alguna, las claves no coinciden y sale ≠ 0). Imprime los segundos de cada fase.

## 4 · RPO y RTO

| | Objetivo | De dónde sale |
|---|---|---|
| **RPO** | 24 h | Respaldo diario. Lo que se pierde en el peor caso son las conversaciones del día **en Chatwoot**; mientras Kommo siga operando (hasta E8), lo que entre por los canales compartidos también queda allá. Si Sam quiere menos, el mismo timer cada 6 h (`OnCalendar=*-*-* 00/6:30:00 UTC`) |
| **RTO** | ≤ 2 h | Restauración medida: ~1 min con datos de prueba (§5). El resto es humano: llegar a la clave, bajar de B2, levantar un VPS si el actual se perdió (el plan B de la decisión G) y cambiar el DNS |

El RTO real con datos reales se mide en la puerta P5 y se anota en §6.

## 5 · Ensayo local (2026-10-29)

`infra/chatwoot/pruebas/ensayo-local.sh`, fase C, con datos sintéticos: una cuenta, una agente, un contacto, una conversación con 4 mensajes, un adjunto y un webhook con secreto **cifrado** en la base.

| Comprobación | Resultado |
|---|---|
| R0 · el secreto quedó cifrado en la base | ver [registro](../specs/0583-chatwoot-vps-e1/investigacion-2026-10-29.md) |
| R1 · `respaldo.sh` deja solo `.age` + manifiesto | ídem |
| R2 · `restaurar.sh` en proyecto nuevo: conteos y archivos iguales | ídem |
| R3 · adjunto y secreto restaurados con la misma huella sha256 | ídem |
| R4 · control: misma base con **otras** claves → secreto ilegible | ídem |

## 6 · Registro de restauraciones

| Fecha | Dónde | Respaldo | Resultado | Tiempos (s) | Quién |
|---|---|---|---|---|---|
| 2026-10-29 | local (Docker Desktop) | sintético | OK: conteos, archivos, huellas y claves (E1-R14 a R16, R20) | 3.ª corrida: claves 2 · base 17 · adjuntos 1 · arranque 31 · verificación 6 · total 57. 4.ª: total 68 | Worker SDD-0583 |
| 2026-10-29 18:37Z | **VPS (P5)**, proyecto `chatwoot-ensayo` sin Traefik | `chatwoot-20261029T183240Z`, bajado de B2 | **OK**: integridad, conteos, archivos y claves (`sobres=0`); `/api` 4.19.1 (T-25) | claves 1 · base 24 · adjuntos 6 · arranque 142 · verificación 27 · total 200 (207 con la bajada) | Worker SDD-0583, llave de emergencia pegada por Sam |
