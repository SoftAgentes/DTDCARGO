#!/usr/bin/env bash
# infra/dtd-cargo/backup.sh — respaldo diario CIFRADO de DTD Cargo en el servidor (SDD-0505).
#
# Lo corre el timer de systemd (systemd/dtd-cargo-backup.timer, 06:00 UTC = 02:00
# en Caracas) desde /srv/dtd-cargo. Envuelve los tres scripts de /srv/ops/backup
# con los valores del `.env` que está al lado:
#   1. pg-dump-to-s3.sh: dump de la base + roles + permisos de public, cifrados
#      con age para la clave pública de Sam, al bucket de Backblaze; retención
#      30 días en el bucket y 7 en el disco.
#   2. config-backup.sh: este .env + la clave raíz de pgsodium/Vault, cifrados,
#      solo cuando cambiaron.
#   3. storage-backup.sh: los ARCHIVOS del Storage (data/storage con
#      STORAGE_BACKEND=file; el dump solo trae su metadata), tar | age sin copia
#      en claro, a su propio prefijo del bucket (SDD-0620).
#   4. Si los tres salieron 0 y BACKUP_HEARTBEAT_URL está en el .env, manda el
#      latido a Uptime Kuma. Un respaldo que falla no late: así se nota.
#
# Antes del corte, producción está apagada y existe la marca
# NO-ENCENDER-HASTA-EL-CORTE.txt: el script lo dice y sale 0 sin respaldar nada
# (el timer ya queda encendido y se ve en el log que corre cada día). Sin la
# marca, una base que no está corriendo es un fallo (1): no hay nada que dumpear
# y alguien tiene que mirar.
#
# Valores del .env (los demás tienen el valor de DTD por defecto):
#   POSTGRES_PASSWORD        obligatorio; viaja por el entorno, nunca por argumento
#   BACKUP_RCLONE_REMOTE     b2:dtdcargo-respaldos/db
#   BACKUP_HEARTBEAT_URL     vacío = sin latido
#   BACKUP_STORAGE_RCLONE_REMOTE  b2:dtdcargo-respaldos/storage
#   BACKUP_STORAGE_DIR       por omisión <DTD_DATA_DIR>/storage (el bind de storage-api)
#   BACKUP_STORAGE_MIN_FILES 1: con menos archivos el respaldo falla (carpeta equivocada)
#   BACKUP_STORAGE_KEEP_LOCAL 2 respaldos del Storage en disco local
#   OPS_DIR / BACKUP_DIR / RCLONE_CONFIG_DIR / BACKUP_AGE_RECIPIENTS_FILE /
#   BACKUP_RETENTION_DAYS / BACKUP_LOCAL_RETENTION_DAYS / BACKUP_DB_CONFIG_VOLUME
#
# Uso: backup.sh [--dry-run]   (dry-run imprime los comandos del dump y no toca nada)
# Códigos: 0 respaldo hecho (o producción apagada) · 1 fallo · 3 ya hay otro corriendo
set -euo pipefail
umask 077

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="${here}/.env"
log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { log "✗ $*"; log "RESULTADO: FALLÓ"; exit 1; }
[[ -f "${env_file}" ]] || die "falta ${env_file}"

# Lee una clave del .env sin `source` (compose admite valores que el shell
# interpretaría). Quita comillas simples o dobles alrededor: env-set.sh escribe
# los valores entre comillas simples.
envget() {
  local v
  v="$(grep -E "^${1}=" "${env_file}" | tail -n1 | cut -d= -f2- || true)"
  if [[ "${v}" == \'*\' || "${v}" == \"*\" ]]; then v="${v:1:${#v}-2}"; fi
  printf '%s' "${v}"
}
valor() { local v; v="$(envget "$1")"; printf '%s' "${v:-$2}"; }

dry_run=0
for a in "$@"; do [[ "${a}" == --dry-run ]] && dry_run=1; done

proyecto="$(valor PROYECTO dtd-cargo)"
ops_dir="$(valor OPS_DIR /srv/ops)"
dump_script="${ops_dir}/backup/pg-dump-to-s3.sh"
config_script="${ops_dir}/backup/config-backup.sh"
storage_script="${ops_dir}/backup/storage-backup.sh"
remote="$(valor BACKUP_RCLONE_REMOTE b2:dtdcargo-respaldos/db)"
recipients="$(valor BACKUP_AGE_RECIPIENTS_FILE /srv/ops/backup/age-recipients.txt)"
rclone_dir="$(valor RCLONE_CONFIG_DIR /srv/ops/backup/rclone)"
out_dir="$(valor BACKUP_DIR /srv/backups)"
heartbeat="$(valor BACKUP_HEARTBEAT_URL '')"
marca="${here}/NO-ENCENDER-HASTA-EL-CORTE.txt"

log "respaldo de ${proyecto} → ${remote}"
# Con la marca, el dry-run sigue imprimiendo los comandos: sirve para revisar el
# .env real antes del corte sin tocar nada.
if [[ -f "${marca}" ]] && (( ! dry_run )); then
  log "producción apagada (existe $(basename "${marca}")): no hay nada que respaldar. RESULTADO: APAGADO"
  exit 0
fi
for s in "${dump_script}" "${config_script}" "${storage_script}"; do
  [[ -x "${s}" ]] || die "no encuentro ${s} (OPS_DIR=${ops_dir}); ¿está desplegado infra/ops?"
done
password="$(envget POSTGRES_PASSWORD)"
[[ -n "${password}" ]] || die "POSTGRES_PASSWORD está vacío en ${env_file}"

# Dos corridas a la vez (un timer atrasado más una a mano) se pisarían en
# /dev/shm y en el remoto: la segunda espera a la próxima.
exec 9> "/run/lock/backup-${proyecto}.lock"
if ! flock -n 9; then log "ya hay un respaldo de ${proyecto} corriendo: salgo (3)"; exit 3; fi

if (( ! dry_run )); then
  vivos="$(docker ps -q --filter "label=com.docker.compose.project=${proyecto}" \
    --filter "label=com.docker.compose.service=db" --filter status=running | wc -l)"
  (( vivos >= 1 )) || die "la base de ${proyecto} no está corriendo y no existe la marca de apagado: no se puede respaldar"
fi

PGPASSWORD="${password}"
export PGPASSWORD
unset password
rc=0
"${dump_script}" \
  --project "${proyecto}" \
  --network "${proyecto}_dtd_internal" \
  --host "$(valor POSTGRES_HOST db)" \
  --db "$(valor POSTGRES_DB postgres)" \
  --out "${out_dir}" \
  --remote "${remote}" \
  --age-recipients "${recipients}" \
  --rclone-config "${rclone_dir}" \
  --retention-days "$(valor BACKUP_RETENTION_DAYS 30)" \
  --local-retention-days "$(valor BACKUP_LOCAL_RETENTION_DAYS 7)" \
  "$@" || rc=$?
unset PGPASSWORD
(( rc == 0 )) || die "pg-dump-to-s3.sh salió ${rc}"
if (( dry_run )); then log "dry-run: no se respalda la configuración ni se manda latido. RESULTADO: DRY-RUN"; exit 0; fi

"${config_script}" \
  --project "${proyecto}" \
  --project-dir "${here}" \
  --volume "$(valor BACKUP_DB_CONFIG_VOLUME "${proyecto}_db-config")" \
  --out "${out_dir}" \
  --remote "${remote}" \
  --age-recipients "${recipients}" \
  --rclone-config "${rclone_dir}" || rc=$?
(( rc == 0 )) || die "config-backup.sh salió ${rc}"

# Los archivos del Storage, después de la base: un archivo subido entre las dos
# copias queda huérfano (inofensivo). La carpeta sale del mismo DTD_DATA_DIR que
# usa compose para el bind de storage-api.
datos="$(valor DTD_DATA_DIR ./data)"
[[ "${datos}" == /* ]] || datos="${here}/${datos#./}"
"${storage_script}" \
  --project "${proyecto}" \
  --source "$(valor BACKUP_STORAGE_DIR "${datos%/}/storage")" \
  --remote "$(valor BACKUP_STORAGE_RCLONE_REMOTE b2:dtdcargo-respaldos/storage)" \
  --out "${out_dir}" \
  --age-recipients "${recipients}" \
  --rclone-config "${rclone_dir}" \
  --retention-days "$(valor BACKUP_RETENTION_DAYS 30)" \
  --keep-local "$(valor BACKUP_STORAGE_KEEP_LOCAL 2)" \
  --min-files "$(valor BACKUP_STORAGE_MIN_FILES 1)" || rc=$?
(( rc == 0 )) || die "storage-backup.sh salió ${rc}"

if [[ -n "${heartbeat}" ]]; then
  if curl -fsS -m 15 --retry 3 --retry-delay 5 -o /dev/null "${heartbeat}"; then
    log "latido enviado al monitor"
  else
    # El respaldo sí se hizo; lo que falló es el aviso. Se dice y se sale 1 para
    # que el timer lo marque, porque sin latido Uptime Kuma va a avisar igual.
    die "el respaldo terminó pero el latido al monitor falló"
  fi
else
  log "sin BACKUP_HEARTBEAT_URL: no se manda latido (configúralo cuando exista el monitor)"
fi
log "RESULTADO: PASÓ"
