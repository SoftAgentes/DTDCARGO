#!/usr/bin/env bash
# infra/chatwoot/respaldo.sh — respaldo CONJUNTO de Chatwoot, cifrado (SDD-0583 · paso 1.5).
#
# Un respaldo de Chatwoot son tres piezas que solo sirven juntas:
#   db.dump.age       pg_dump -Fc de chatwoot_production (conversaciones, contactos, cuentas)
#   storage.tar.age   /app/storage: los adjuntos (imágenes, audios, documentos)
#   env.age           el .env: SECRET_KEY_BASE y las tres claves de Active Record
#                     Encryption. Sin ellas, los tokens de WhatsApp/Facebook, las
#                     contraseñas IMAP/SMTP y los secretos de webhooks del dump son
#                     irrecuperables, y Chatwoot no avisa (ensayo: controles R4 y R4b).
#   manifiesto.txt    en claro: fecha, versión, conteos y sha256 de los tres .age.
#                     No lleva ningún dato personal ni secreto.
#
# Las tres piezas van en UNA carpeta con el mismo sello y viajan juntas al remoto.
#
# Datos personales (revisión E1, docs/legal/privacidad/revision-chatwoot-e1-2026-10-29.md):
#   · El dump va a /dev/shm (RAM, fuera del disco y de los snapshots de Contabo) solo
#     mientras se comprueba con `pg_restore --list`; se cifra y se borra. Un trap
#     borra la carpeta de trabajo también si algo falla a la mitad.
#   · Los adjuntos NO tocan el disco en claro: el tar sale del contenedor y entra
#     directo a `age` por una tubería.
#   · Al disco local y al remoto solo llegan `.age` y el manifiesto. La clave privada
#     no vive en el servidor.
#
# Consistencia: primero la base y después los adjuntos. Un adjunto subido entre las
# dos copias queda como archivo huérfano (inofensivo); uno a mitad de subida al
# momento del dump puede quedar como fila sin archivo. RPO declarado en el runbook.
#
# Uso (en el host, con Docker; `age` del paquete de Ubuntu 24.04):
#   respaldo.sh --dir /srv/chatwoot --age-recipients /srv/ops/backup/age-recipients.txt \
#       [--project chatwoot] [--remote b2:dtdcargo-respaldos/chatwoot | --sin-remoto] \
#       [--out /srv/backups/chatwoot] [--work-dir /dev/shm] \
#       [--rclone-config /srv/ops/backup/rclone] [--retention-days 30] \
#       [--local-retention-days 7] [--heartbeat-url URL] [--dry-run]
#
# Los valores por omisión de --remote, --age-recipients y --heartbeat-url salen del
# .env (CHATWOOT_BACKUP_*). `AGE_BIN` permite otro binario de age (la prueba local
# usa uno en contenedor). Sale ≠ 0 ante cualquier fallo y entonces NO late.
set -euo pipefail
umask 077

DIR=""
PROJECT=""
REMOTE=""
SIN_REMOTO=0
AGE_RECIPIENTS=""
OUT=""
WORK_ROOT="/dev/shm"
RCLONE_CONFIG="/srv/ops/backup/rclone"
RCLONE_IMAGE="rclone/rclone:1.75.1"
RETENTION_DAYS="30"
LOCAL_RETENTION_DAYS="7"
HEARTBEAT_URL=""
DRY_RUN=0
AGE_BIN="${AGE_BIN:-age}"

usage() { sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "respaldo: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --project) PROJECT="$2"; shift 2 ;;
    --remote) REMOTE="$2"; shift 2 ;;
    --sin-remoto) SIN_REMOTO=1; shift ;;
    --age-recipients) AGE_RECIPIENTS="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --work-dir) WORK_ROOT="$2"; shift 2 ;;
    --rclone-config) RCLONE_CONFIG="$2"; shift 2 ;;
    --retention-days) RETENTION_DAYS="$2"; shift 2 ;;
    --local-retention-days) LOCAL_RETENTION_DAYS="$2"; shift 2 ;;
    --heartbeat-url) HEARTBEAT_URL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "opción desconocida: $1 (ver --help)" ;;
  esac
done

[ -n "$DIR" ] || die "falta --dir (carpeta del compose, p. ej. /srv/chatwoot)"
[ -f "$DIR/compose.yml" ] || die "no hay compose.yml en $DIR"
[ -f "$DIR/.env" ] || die "no hay .env en $DIR: sin él el respaldo no se puede restaurar"

# Valores del .env sin `source` (el .env no es un script y puede traer espacios).
leer_env() { sed -n "s/^$1=//p" "$DIR/.env" | tail -n 1 | sed 's/^"\(.*\)"$/\1/'; }
[ -n "$REMOTE" ] || REMOTE="$(leer_env CHATWOOT_BACKUP_RCLONE_REMOTE)"
[ -n "$AGE_RECIPIENTS" ] || AGE_RECIPIENTS="$(leer_env CHATWOOT_BACKUP_AGE_RECIPIENTS)"
[ -n "$HEARTBEAT_URL" ] || HEARTBEAT_URL="$(leer_env CHATWOOT_BACKUP_HEARTBEAT_URL)"
[ -n "$OUT" ] || OUT="$DIR/respaldos"
[ "$SIN_REMOTO" = 1 ] || [ -n "$REMOTE" ] || die "falta --remote (o CHATWOOT_BACKUP_RCLONE_REMOTE), o --sin-remoto"

# Destinatarios: solo claves públicas. Una privada aquí sería la llave de todo.
[ -n "$AGE_RECIPIENTS" ] && [ -f "$AGE_RECIPIENTS" ] || die "falta el archivo de destinatarios age: ${AGE_RECIPIENTS:-<vacío>}"
grep -q 'AGE-SECRET-KEY' "$AGE_RECIPIENTS" && die "$AGE_RECIPIENTS contiene una clave PRIVADA; solo van públicas"
grep -Eq '^(age1|ssh-ed25519 |ssh-rsa )' "$AGE_RECIPIENTS" || die "$AGE_RECIPIENTS no tiene ninguna clave pública age/ssh"

# Desde la carpeta del compose: Compose toma su compose.yml, su .env y, si existe,
# compose.override.yml (solo la prueba local lo trae; el servidor no).
compose() { (cd "$DIR" && docker compose ${PROJECT:+-p "$PROJECT"} "$@"); }
correr() { if [ "$DRY_RUN" = 1 ]; then echo "[dry-run] $*"; else "$@"; fi; }
# La salida va por redirección del shell y no por `-o`: así un age en contenedor
# (la prueba local) escribe igual en el disco del host.
cifrar() { "$AGE_BIN" -R "$AGE_RECIPIENTS" >"$1"; }

# Un respaldo a la vez (flock existe en el host; en la prueba local puede faltar).
if command -v flock >/dev/null 2>&1; then
  exec 9>"$DIR/.respaldo.lock"
  flock -n 9 || die "otro respaldo está corriendo"
fi

SELLO="$(date -u +%Y%m%dT%H%M%SZ)"
DESTINO="$OUT/chatwoot-$SELLO"
TRABAJO="$(mktemp -d "$WORK_ROOT/chatwoot-respaldo.XXXXXX")"
trap 'rm -rf "$TRABAJO"' EXIT

echo "respaldo: sello $SELLO → $DESTINO"
compose ps --status running --services | grep -qx postgres || die "postgres no está corriendo"
compose ps --status running --services | grep -qx rails || die "rails no está corriendo (los adjuntos se leen desde su volumen)"
correr mkdir -p "$DESTINO"

# 1. Base: dump en RAM, comprobación y cifrado.
if [ "$DRY_RUN" = 0 ]; then
  compose exec -T postgres pg_dump -U chatwoot -d chatwoot_production -Fc >"$TRABAJO/db.dump"
  ENTRADAS="$(compose exec -T postgres pg_restore --list <"$TRABAJO/db.dump" | grep -vc '^;')"
  [ "$ENTRADAS" -gt 100 ] || die "el dump tiene $ENTRADAS entradas; esperaba más de 100"
  cifrar "$DESTINO/db.dump.age" <"$TRABAJO/db.dump"
  rm -f "$TRABAJO/db.dump"
  CONTEOS="$(compose exec -T postgres psql -U chatwoot -d chatwoot_production -At -F= -c \
    "select 'cuentas', count(*) from accounts union all select 'usuarios', count(*) from users
     union all select 'contactos', count(*) from contacts union all select 'conversaciones', count(*) from conversations
     union all select 'mensajes', count(*) from messages union all select 'adjuntos', count(*) from active_storage_blobs")"
else
  echo "[dry-run] pg_dump → $TRABAJO/db.dump → pg_restore --list → age → $DESTINO/db.dump.age"
  ENTRADAS=0; CONTEOS=""
fi

# 2. Adjuntos: tar del contenedor directo a age, sin copia en claro.
if [ "$DRY_RUN" = 0 ]; then
  ARCHIVOS="$(compose exec -T rails sh -c 'find /app/storage -type f | wc -l' | tr -d '[:space:]')"
  compose exec -T rails tar -C /app/storage -cf - . | cifrar "$DESTINO/storage.tar.age"
else
  echo "[dry-run] tar /app/storage | age → $DESTINO/storage.tar.age"; ARCHIVOS=0
fi

# 3. Claves: el .env completo.
correr cifrar "$DESTINO/env.age" <"$DIR/.env"

# 4. Manifiesto en claro, sin secretos.
if [ "$DRY_RUN" = 0 ]; then
  {
    echo "sello=$SELLO"
    echo "imagen=$(docker inspect --format '{{.Config.Image}}' "$(compose ps -q rails)")"
    echo "version=$(compose exec -T rails cat VERSION_CW | tr -d '[:space:]')"
    echo "dump_entradas=$ENTRADAS"
    echo "storage_archivos=$ARCHIVOS"
    printf '%s\n' "$CONTEOS"
    (cd "$DESTINO" && sha256sum db.dump.age storage.tar.age env.age)
  } >"$DESTINO/manifiesto.txt"
  cat "$DESTINO/manifiesto.txt"
fi

# 5. Al remoto (copy, nunca sync) y retención solo dentro del prefijo de Chatwoot.
if [ "$SIN_REMOTO" = 0 ]; then
  RCLONE=(docker run --rm -v "$RCLONE_CONFIG:/config/rclone:ro" -v "$OUT:/data:ro" "$RCLONE_IMAGE")
  correr "${RCLONE[@]}" copy "/data/chatwoot-$SELLO" "$REMOTE/chatwoot-$SELLO"
  correr "${RCLONE[@]}" check "/data/chatwoot-$SELLO" "$REMOTE/chatwoot-$SELLO" --one-way
  correr "${RCLONE[@]}" delete --min-age "${RETENTION_DAYS}d" "$REMOTE/"
  correr "${RCLONE[@]}" rmdirs --leave-root "$REMOTE/"
fi

# 6. Retención local.
correr find "$OUT" -maxdepth 1 -type d -name 'chatwoot-*' -mtime "+$LOCAL_RETENTION_DAYS" -exec rm -rf {} +

# 7. Latido solo si todo lo anterior salió 0 (set -e).
if [ -n "$HEARTBEAT_URL" ]; then
  # La URL Push de Uptime Kuma ya trae su query (?status=up&msg=OK&ping=), como en
  # infra/dtd-cargo/backup.sh: se llama tal cual.
  correr curl -fsS -m 20 --retry 3 --retry-delay 5 -o /dev/null "$HEARTBEAT_URL"
fi
echo "respaldo: OK chatwoot-$SELLO"
