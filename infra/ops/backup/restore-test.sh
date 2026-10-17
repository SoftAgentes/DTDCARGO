#!/usr/bin/env bash
# infra/ops/backup/restore-test.sh — restore de prueba en un contenedor DESECHABLE en memoria (SDD-0505).
#
# El restore mensual obligatorio (docs/runbooks/backup-restore-servidor.md §3) sin
# staging permanente: levanta un supabase/postgres efímero con PGDATA en tmpfs (los
# datos restaurados viven en RAM y desaparecen con el contenedor), restaura ahí con
# restore.sh, comprueba y destruye todo. No publica puertos y su red es interna.
#
# Con --config <x-config.tar.age> (de config-backup.sh) monta además la clave raíz
# pgsodium_root.key de ese respaldo: así se prueba que los secretos de Vault del dump
# se pueden leer con la raíz respaldada. Sin --config, Vault queda ilegible (control).
#
# Permisos de public: restore.sh aplica el `-acl.sql.age` que está al lado del dump
# (o --acl) y compara la huella con la del origen; la prueba lo exige («iguales»).
# --dr restaura en una copia de la base `postgres` de la imagen, con sus default
# privileges: es lo que encuentra un DR de verdad (un stack nuevo) y donde
# pg_restore como supabase_admin abre public a anon y authenticated.
# --acl-verify-only compara sin corregir (sirve de control rojo junto con --dr).
#
# Uso:
#   restore-test.sh --file <x.dump.age> --roles <x-roles.sql.age> --age-identity <clave> \
#       [--config <x-config.tar.age>] [--expect <tabla>=<filas>]… [--vault-readable] \
#       [--acl <x-acl.sql.age>] [--dr] [--acl-verify-only] \
#       [--tmpfs-size 2g] [--pg-image …] [--work-dir /dev/shm] [--evidence <archivo>]
#
# --expect auth.users=297 compara el conteo; --vault-readable exige que todos los
# secretos de vault.decrypted_secrets se descifren (necesita --config).
#
# Códigos: 0 todo PASÓ · 2 uso inválido · 7 alguna comprobación FALLÓ.
# El contenedor, la red y los claros en /dev/shm se borran SIEMPRE al salir.
set -euo pipefail
umask 077

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILE=""
ROLES=""
AGE_IDENTITY="${BACKUP_AGE_IDENTITY_FILE:-}"
CONFIG=""
ACL=""
DR=0
ACL_VERIFY_ONLY=0
EXPECTS=()
VAULT_READABLE=0
TMPFS_SIZE="2g"
PG_IMAGE="supabase/postgres:17.6.1.136"
WORK_ROOT="/dev/shm"
EVIDENCE=""

usage() {
  sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "${EVIDENCE:-/dev/null}"
}

die() {
  echo "restore-test: $*" >&2
  exit 2
}

setopt() {
  local name="$1" value="${2-}"
  if [[ -n "${value}" ]]; then
    printf -v "${name}" '%s' "${value}"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) setopt FILE "${2-}"; shift 2 ;;
    --roles) setopt ROLES "${2-}"; shift 2 ;;
    --age-identity) setopt AGE_IDENTITY "${2-}"; shift 2 ;;
    --config) setopt CONFIG "${2-}"; shift 2 ;;
    --expect) [[ -n "${2-}" ]] && EXPECTS+=("$2"); shift 2 ;;
    --vault-readable) VAULT_READABLE=1; shift ;;
    --acl) setopt ACL "${2-}"; shift 2 ;;
    --dr) DR=1; shift ;;
    --acl-verify-only) ACL_VERIFY_ONLY=1; shift ;;
    --tmpfs-size) setopt TMPFS_SIZE "${2-}"; shift 2 ;;
    --pg-image) setopt PG_IMAGE "${2-}"; shift 2 ;;
    --work-dir) setopt WORK_ROOT "${2-}"; shift 2 ;;
    --evidence) setopt EVIDENCE "${2-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

[[ -f "${FILE}" ]] || die "--file no existe: '${FILE}'"
[[ -z "${ROLES}" || -f "${ROLES}" ]] || die "--roles no existe: '${ROLES}'"
[[ -z "${CONFIG}" || -f "${CONFIG}" ]] || die "--config no existe: '${CONFIG}'"
[[ -z "${ACL}" || -f "${ACL}" ]] || die "--acl no existe: '${ACL}'"
[[ "${TMPFS_SIZE}" =~ ^[1-9][0-9]*[mg]$ ]] || die "--tmpfs-size inválido (p. ej. 2g)"
[[ "${PG_IMAGE}" != *:latest && "${PG_IMAGE}" == *:* ]] || die "--pg-image debe llevar tag fijo"
for e in ${EXPECTS[@]+"${EXPECTS[@]}"}; do
  [[ "${e}" =~ ^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?=[0-9]+$ ]] || die "--expect inválido: '${e}' (tabla=filas)"
done
(( ! VAULT_READABLE )) || [[ -n "${CONFIG}" ]] || die "--vault-readable necesita --config (la raíz respaldada)"
if [[ "${FILE}" == *.age || "${ROLES}" == *.age || -n "${CONFIG}" ]]; then
  [[ -n "${AGE_IDENTITY}" && -f "${AGE_IDENTITY}" ]] || die "hace falta --age-identity con la clave privada"
  command -v age >/dev/null || die "age no está instalado en el host"
fi
command -v docker >/dev/null || die "docker no está en el PATH"
if [[ -n "${EVIDENCE}" ]]; then
  : > "${EVIDENCE}"
  chmod 600 "${EVIDENCE}"
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="restore-test-$(date -u +%Y%m%d%H%M%S)-$$"
net="${name}_internal"
cfg_dir=""
cleanup() {
  docker rm -f -v "${name}-db" >/dev/null 2>&1 || true
  docker network rm "${net}" >/dev/null 2>&1 || true
  if [[ -n "${cfg_dir}" && -d "${cfg_dir}" ]]; then
    rm -rf -- "${cfg_dir}"
  fi
  rm -f -- "${WORK_ROOT%/}/${name}.log"
}
trap cleanup EXIT

pass=0; fail=0
check() { # $1 descripción, $2 esperado, $3 obtenido
  if [[ "$2" == "$3" ]]; then
    pass=$((pass + 1)); log "PASÓ  · $1 · $3"
  else
    fail=$((fail + 1)); log "FALLÓ · $1 · esperado '$2', obtenido '$3'"
  fi
}

t0="$(date +%s)"
log "restore-test ${name} · dump $(basename "${FILE}")${CONFIG:+ · raíz de $(basename "${CONFIG}")}"

# 1. Raíz de Vault desde el respaldo de configuración (en memoria).
mount_cfg=()
if [[ -n "${CONFIG}" ]]; then
  cfg_dir="$(mktemp -d "${WORK_ROOT%/}/restore-test-cfg-XXXXXX")"
  age -d -i "${AGE_IDENTITY}" "${CONFIG}" | tar -C "${cfg_dir}" -xf - volume
  [[ -s "${cfg_dir}/volume/pgsodium_root.key" ]] || die "el respaldo de configuración no trae volume/pgsodium_root.key"
  log "1/5 raíz respaldada: sha256 $(sha256sum "${cfg_dir}/volume/pgsodium_root.key" | cut -d' ' -f1)"
  mount_cfg=(-v "${cfg_dir}/volume:/etc/postgresql-custom")
else
  log "1/5 sin --config: el contenedor genera una raíz nueva (Vault del dump no se podrá leer)"
fi

# 2. Contenedor desechable: red interna, sin puertos, PGDATA en tmpfs.
pw="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
docker network create --internal "${net}" >/dev/null
docker run -d --name "${name}-db" --network "${net}" --network-alias db \
  --label "dtd.restore-test=${name}" \
  --tmpfs "/var/lib/postgresql/data:rw,size=${TMPFS_SIZE}" \
  ${mount_cfg[@]+"${mount_cfg[@]}"} \
  -e POSTGRES_PASSWORD="${pw}" "${PG_IMAGE}" \
  postgres -c config_file=/etc/postgresql/postgresql.conf >/dev/null
streak=0
for _ in $(seq 1 180); do
  if docker exec "${name}-db" psql -U postgres -h localhost -Atc "select 1 from pg_roles where rolname = 'supabase_admin'" 2>/dev/null | grep -q 1; then
    streak=$((streak + 1)); (( streak >= 5 )) && break
  else
    streak=0
  fi
  sleep 1
done
(( streak >= 5 )) || die "el contenedor desechable no arrancó (docker logs ${name}-db)"
log "2/5 contenedor desechable listo (PGDATA en tmpfs ${TMPFS_SIZE}, red interna ${net})"

# DR: restore_test nace como copia de la base `postgres` de la imagen, con sus
# esquemas y default privileges. CREATE DATABASE … TEMPLATE exige que nadie esté
# conectado a la plantilla, y los workers de pg_cron/pg_net se reconectan solos:
# se cortan y se reintenta.
if (( DR )); then
  dr_ok=0
  for _ in $(seq 1 20); do
    if docker exec "${name}-db" psql -U supabase_admin -h localhost -d template1 -v ON_ERROR_STOP=1 -Atq \
        -c "select count(pg_catalog.pg_terminate_backend(pid)) from pg_catalog.pg_stat_activity where datname = 'postgres' and pid <> pg_catalog.pg_backend_pid()" \
        -c "create database restore_test template postgres" >/dev/null 2>&1; then
      dr_ok=1; break
    fi
    sleep 1
  done
  (( dr_ok )) || die "no se pudo copiar la base postgres de la imagen como restore_test"
  dr_defaults="$(docker exec "${name}-db" psql -U supabase_admin -h localhost -d restore_test -Atq -c \
    "select count(*) from pg_catalog.pg_default_acl d where d.defaclnamespace = 'public'::pg_catalog.regnamespace and d.defaclacl::text ~ '(^|[{,])(anon|authenticated)='")"
  log "2/5 DR: restore_test es copia de la base postgres de la imagen · default privileges de public que dan a anon/authenticated: ${dr_defaults}"
fi

# 3. Restore con restore.sh, como supabase_admin (los event triggers de Supabase
#    exigen superusuario) y en una base nueva: la guarda no se toca.
log "3/5 restore.sh → ${name}/restore_test"
restore_rc=0
acl_args=()
[[ -n "${ACL}" ]] && acl_args+=(--acl "${ACL}")
(( ACL_VERIFY_ONLY )) && acl_args+=(--acl-verify-only)
PGPASSWORD="${pw}" "${here}/restore.sh" --file "${FILE}" ${ROLES:+--roles "${ROLES}"} \
  ${AGE_IDENTITY:+--age-identity "${AGE_IDENTITY}"} --work-dir "${WORK_ROOT}" \
  ${acl_args[@]+"${acl_args[@]}"} \
  --project "${name}" --network "${net}" --target restore_test --user supabase_admin \
  --pg-image "${PG_IMAGE}" > "${WORK_ROOT%/}/${name}.log" 2>&1 || restore_rc=$?
errors="$(grep -c '^pg_restore: error:' "${WORK_ROOT%/}/${name}.log" || true)"
# `|| true`: con pipefail, cero errores (grep sin coincidencias) no puede matar la prueba.
{ grep '^pg_restore: error:' "${WORK_ROOT%/}/${name}.log" || true; } | sed 's/^pg_restore: error: //' | cut -c1-140 \
  | sort | uniq -c | sort -rn | head -n 8 | while read -r line; do log "      ${line}"; done
if (( restore_rc != 0 && restore_rc != 4 && restore_rc != 8 )); then
  tail -n 15 "${WORK_ROOT%/}/${name}.log" | while read -r line; do log "      ${line}"; done
fi
acl_line="$(grep -o 'permisos de public: .*' "${WORK_ROOT%/}/${name}.log" | tail -n 1 || true)"
rm -f -- "${WORK_ROOT%/}/${name}.log"
log "3/5 restore.sh salió ${restore_rc} con ${errors} errores de pg_restore"
log "      ${acl_line:-permisos de public: restore.sh no informó nada}"
check "restore.sh terminó (0 limpio, 4 con advertencias u 8 con permisos distintos)" "ok" "$( [[ ${restore_rc} == 0 || ${restore_rc} == 4 || ${restore_rc} == 8 ]] && echo ok || echo "${restore_rc}")"
case "${acl_line}" in
  *" · iguales") acl_state="iguales" ;;
  *DISTINTOS*) acl_state="DISTINTOS" ;;
  *) acl_state="no verificados" ;;
esac
check "permisos de public iguales a los del origen (huella)" "iguales" "${acl_state}"

sql() {
  docker exec "${name}-db" psql -U supabase_admin -h localhost -d restore_test -v ON_ERROR_STOP=1 -Atq -c "$1"
}

# 4. Comprobaciones.
log "4/5 comprobaciones"
for e in ${EXPECTS[@]+"${EXPECTS[@]}"}; do
  check "count(*) ${e%%=*}" "${e#*=}" "$(sql "select count(*) from ${e%%=*}" 2>&1 | tail -n1)"
done
vault_total="$(sql "select count(*) from vault.secrets" 2>/dev/null || echo '?')"
vault_ok="$(sql "select count(*) from vault.decrypted_secrets where decrypted_secret is not null" 2>/dev/null || echo 0)"
log "      vault: ${vault_ok} de ${vault_total} secretos legibles"
if (( VAULT_READABLE )); then
  check "todos los secretos de Vault se descifran con la raíz respaldada" "${vault_total}" "${vault_ok}"
fi

# 5. Destrucción y comprobación de que no queda nada.
cleanup
cfg_dir=""
left_c="$(docker ps -aq --filter "label=dtd.restore-test=${name}" | wc -l)"
left_s="$(find "${WORK_ROOT}" -maxdepth 1 \( -name "restore-${name}-*" -o -name 'restore-test-cfg-*' -o -name "${name}.log" \) | wc -l)"
check "contenedor desechable borrado" "0" "${left_c}"
check "nada en ${WORK_ROOT}" "0" "${left_s}"
log "5/5 RTO de la prueba: $(( $(date +%s) - t0 )) s · RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
(( fail == 0 )) || exit 7
