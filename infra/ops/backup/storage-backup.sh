#!/usr/bin/env bash
# infra/ops/backup/storage-backup.sh — respaldo CIFRADO de los archivos del Storage de Studio (SDD-0620).
#
# Con STORAGE_BACKEND=file, storage-api guarda los objetos en
# /srv/<proyecto>/data/storage (bind a /var/lib/storage), y en los xattrs
# `user.supabase.*` de cada archivo su Content-Type y su Cache-Control. El dump
# de la base solo trae la metadata (`storage.objects`): los bytes y esos xattrs
# viven en esa carpeta y sin esto no están en ningún respaldo propio.
#
# Qué hace:
#   1. comprueba origen, destinatarios, espacio en disco y que haya archivos
#   2. un solo `tar --format=posix --xattrs` del origen alimenta, por tuberías,
#      tres consumidores:
#        · age → <base>.tar.age                       (el respaldo)
#        · storage-lista.py → age → <base>-lista.age  (sha256, bytes, huella de
#          xattrs y ruta de cada archivo, sacados de los MISMOS bytes que se cifran)
#        · sha256sum → huella del flujo en claro (va al manifiesto)
#      Nada en claro toca el disco: el contenido pasa por tuberías y FIFOs
#      (en --work-dir, /dev/shm por omisión); solo se escriben `.age`.
#   3. <base>.manifiesto, en claro y sin datos personales: sello, conteo, bytes,
#      huella del flujo y sha256 de los dos `.age`. Sin rutas: los nombres de
#      archivo pueden traer nombres de personas y el Shipping Mark.
#   4. rclone copy de los tres a <remoto>/<proyecto>/ (nunca sync) y rclone check
#   5. retención: rclone delete --min-age <N>d SOLO dentro de <remoto>/<proyecto>/;
#      en disco local quedan los --keep-local respaldos más nuevos
#
# Rutas fuera del log: lo que tar o la lista escriben en stderr (avisos que
# nombran archivos) queda en --work-dir y se borra; el log solo dice cuántos.
#
# Guarda contra un borrado masivo, que falla cerrada: si el conteo cae por debajo
# de --min-pct (50) del último respaldo aceptado (`<proyecto>-storage.referencia`),
# el respaldo se sube igual pero NO se aplica la retención (ni remota ni local) y
# sale 1: sin latido, alguien mira. Lo mismo si la referencia no se puede leer.
# Si falta, se compara contra el MÁXIMO de `archivos=` de los manifiestos locales y,
# si tampoco hay manifiestos locales (disco nuevo, --out equivocado), de los del remoto.
# Se repite cada día hasta que alguien corra a mano --aceptar-caida=<conteo>,
# SOLO con OK nominal de Sam. Esa corrida exige que el conteo sea exactamente el
# dicho y, antes de aplicar la retención, saca el último respaldo bueno de su
# alcance: en disco a <out>/<proyecto>/storage-retenido/ y en el remoto a
# <remoto>/<proyecto>-retenido/, prefijos que ninguna retención toca (runbook §5.1).
#
# Consistencia: storage-api sigue sirviendo mientras corre. Un archivo que cambia
# a mitad de lectura hace que tar salga 1: se avisa (aviso_tar=1 en el
# manifiesto) y el respaldo sigue, igual que la lista, que sale del mismo flujo.
# tar ≥ 2 es fallo.
#
# Restaurar o comprobar: storage-restore.sh (mismo directorio).
#
# Uso:
#   storage-backup.sh --project <nombre> --source /srv/<proyecto>/data/storage \
#       --remote <remoto>:<bucket>/<prefijo> --age-recipients <archivo> \
#       [--out /srv/backups] [--work-dir /dev/shm] [--rclone-config /srv/ops/backup/rclone] \
#       [--retention-days 30] [--keep-local 2] [--min-files 1] [--min-pct 50] \
#       [--aviso-gb 10] [--aceptar-caida=<conteo>] [--dry-run]
#
# --dry-run valida todo, cuenta archivos y bytes del origen (solo metadatos) y no
# escribe nada. `AGE_BIN` y `RCLONE_BIN` cambian los binarios (las pruebas usan
# dobles); sin RCLONE_BIN, rclone corre en contenedor como en pg-dump-to-s3.sh.
# Necesita en el host: age, GNU tar, python3 y Docker (para rclone).
# Códigos: 0 hecho · 1 fallo, o caída del conteo · 2 argumentos o entorno inválidos.
set -euo pipefail
umask 077

LISTA="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../lib/storage-lista.py"

PROJECT=""
SOURCE=""
REMOTE=""
OUT="/srv/backups"
WORK_ROOT="/dev/shm"
AGE_RECIPIENTS="${BACKUP_AGE_RECIPIENTS_FILE:-}"
RCLONE_CONFIG="/srv/ops/backup/rclone"
RCLONE_IMAGE="rclone/rclone:1.75.1"
RETENTION_DAYS="30"
KEEP_LOCAL="2"
MIN_FILES="1"
MIN_PCT="50"
AVISO_GB="10"
ACEPTAR_CAIDA=""
ACEPTAR_DADA=0
DRY_RUN=0
AGE_BIN="${AGE_BIN:-age}"
RCLONE_BIN="${RCLONE_BIN:-}"

usage() { sed -n '2,60p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
die() { echo "storage-backup: $*" >&2; exit 2; }
falla() { echo "storage-backup: $*" >&2; exit 1; }
setopt() { local name="$1" value="${2-}"; if [[ -n "${value}" ]]; then printf -v "${name}" '%s' "${value}"; fi; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) setopt PROJECT "${2-}"; shift 2 ;;
    --source) setopt SOURCE "${2-}"; shift 2 ;;
    --remote) setopt REMOTE "${2-}"; shift 2 ;;
    --out) setopt OUT "${2-}"; shift 2 ;;
    --work-dir) setopt WORK_ROOT "${2-}"; shift 2 ;;
    --age-recipients) setopt AGE_RECIPIENTS "${2-}"; shift 2 ;;
    --rclone-config) setopt RCLONE_CONFIG "${2-}"; shift 2 ;;
    --rclone-image) setopt RCLONE_IMAGE "${2-}"; shift 2 ;;
    --retention-days) setopt RETENTION_DAYS "${2-}"; shift 2 ;;
    --keep-local) setopt KEEP_LOCAL "${2-}"; shift 2 ;;
    --min-files) setopt MIN_FILES "${2-}"; shift 2 ;;
    --min-pct) setopt MIN_PCT "${2-}"; shift 2 ;;
    --aviso-gb) setopt AVISO_GB "${2-}"; shift 2 ;;
    --aceptar-caida=*) ACEPTAR_CAIDA="${1#*=}"; ACEPTAR_DADA=1; shift ;;
    --aceptar-caida) die "--aceptar-caida exige el conteo esperado: --aceptar-caida=<archivos> (y el OK nominal de Sam)" ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

# ── Validaciones: todo lo que pueda borrar algo se comprueba antes de empezar ──
[[ "${PROJECT}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--project inválido: '${PROJECT}'"
[[ -n "${SOURCE}" ]] || die "--source es obligatorio (la carpeta del Storage, p. ej. /srv/${PROJECT}/data/storage)"
[[ -d "${SOURCE}" ]] || die "no existe la carpeta del Storage: ${SOURCE}"
SOURCE="$(readlink -f "${SOURCE}")"
# Exige un prefijo detrás del bucket: la retención nunca corre en la raíz.
[[ "${REMOTE}" =~ ^[A-Za-z0-9_-]+:[^/[:space:]]+/[^[:space:]]+$ ]] || die "--remote debe ser <remoto>:<bucket>/<prefijo> (nunca la raíz del bucket): '${REMOTE}'"
for n in RETENTION_DAYS KEEP_LOCAL MIN_FILES AVISO_GB; do
  [[ "${!n}" =~ ^[1-9][0-9]*$ ]] || die "--$(tr '[:upper:]_' '[:lower:]-' <<< "${n}") debe ser un entero ≥ 1"
done
[[ "${MIN_PCT}" =~ ^[0-9]+$ ]] && (( MIN_PCT <= 100 )) || die "--min-pct debe ser un entero entre 0 y 100"
(( ! ACEPTAR_DADA )) || [[ "${ACEPTAR_CAIDA}" =~ ^[1-9][0-9]*$ ]] || die "--aceptar-caida=<archivos> necesita un entero ≥ 1: '${ACEPTAR_CAIDA}'"
[[ "${RCLONE_IMAGE}" != *:latest && "${RCLONE_IMAGE}" == *:* ]] || die "--rclone-image debe llevar tag fijo"
# El cifrado se valida también en dry-run: un timer mal configurado tiene que
# fallar en la prueba, no la primera noche.
[[ -n "${AGE_RECIPIENTS}" ]] || die "--age-recipients es obligatorio (o BACKUP_AGE_RECIPIENTS_FILE): el Storage tiene cédulas y fotos, no sale sin cifrar"
[[ -f "${AGE_RECIPIENTS}" ]] || die "no existe el archivo de destinatarios age: ${AGE_RECIPIENTS}"
if grep -q 'AGE-SECRET-KEY-' "${AGE_RECIPIENTS}"; then
  die "${AGE_RECIPIENTS} contiene una clave PRIVADA: en el servidor solo va la pública"
fi
grep -Eq '^[[:space:]]*(age1[0-9a-z]{20,}|ssh-(ed25519|rsa) [A-Za-z0-9+/=]{20,})' "${AGE_RECIPIENTS}" \
  || die "${AGE_RECIPIENTS} no tiene ninguna clave pública age válida"
command -v "${AGE_BIN}" >/dev/null || die "age no está instalado (${AGE_BIN})"
tar --version 2>/dev/null | grep -q 'GNU tar' || die "hace falta GNU tar (--xattrs)"
command -v python3 >/dev/null || die "hace falta python3 (la lista por archivo)"
[[ -f "${LISTA}" ]] || die "no encuentro ${LISTA}; ¿está desplegado infra/ops/lib?"
[[ -d "${WORK_ROOT}" && -w "${WORK_ROOT}" ]] || die "--work-dir ${WORK_ROOT} no existe o no se puede escribir"
if [[ -z "${RCLONE_BIN}" ]] && (( ! DRY_RUN )); then
  [[ -f "${RCLONE_CONFIG}/rclone.conf" ]] || die "no existe ${RCLONE_CONFIG}/rclone.conf"
  command -v docker >/dev/null || die "docker no está en el PATH"
fi

# Solo metadatos: cuántos archivos y cuántos bytes. No se lee ningún contenido.
# Sin stderr: un archivo que desaparece a mitad del conteo se nombraría en el log.
# Con pipefail, un find que no pudo leer algo saldría 1 sin decir nada: se avisa y sigue.
en_disco="$(find "${SOURCE}" -type f 2>/dev/null | wc -l | tr -d ' ')" \
  || log "AVISO: find no pudo recorrer todo el Storage (archivos que cambiaron o sin permiso): el conteo previo es aproximado"
bytes_disco="$(du -sb "${SOURCE}" 2>/dev/null | cut -f1 || true)"
[[ "${bytes_disco}" =~ ^[0-9]+$ ]] || die "no se pudo medir el tamaño de ${SOURCE}"
(( en_disco >= MIN_FILES )) || die "el Storage tiene ${en_disco} archivos en ${SOURCE} y se esperaban al menos ${MIN_FILES}: ¿es la carpeta correcta?"
if (( bytes_disco > AVISO_GB * 1024 * 1024 * 1024 )); then
  log "AVISO: el Storage pasa de ${AVISO_GB} GB ($(( bytes_disco / 1024 / 1024 )) MB): revisar la estrategia (spec 0620, «Si el Storage crece»)"
fi

REMOTE="${REMOTE%/}"
remote_dir="${REMOTE}/${PROJECT}/"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dir="${OUT%/}/${PROJECT}/storage"
base="${PROJECT}-storage-${stamp}"
tar_age="${dir}/${base}.tar.age"
lista_age="${dir}/${base}-lista.age"
manif="${dir}/${base}.manifiesto"
referencia="${dir}/${PROJECT}-storage.referencia"

if (( DRY_RUN )); then
  log "dry-run: ${en_disco} archivos, $(( bytes_disco / 1024 / 1024 )) MB en ${SOURCE}"
  log "dry-run: tar | age → ${tar_age} (+ -lista.age y .manifiesto), rclone copy → ${remote_dir}, retención ${RETENTION_DAYS} d remota y ${KEEP_LOCAL} locales"
  exit 0
fi

mkdir -p "${dir}"
chmod 700 "${dir}"
# El .tar.age pesa lo mismo que el origen (fotos y PDF no se comprimen).
libre="$(df -PB1 "${dir}" | awk 'NR==2 {print $4}')"
(( libre > bytes_disco + bytes_disco / 10 + 104857600 )) \
  || die "no hay espacio en ${dir}: libres ${libre} bytes, hacen falta ~$(( bytes_disco + bytes_disco / 10 )) más 100 MB"

work="$(mktemp -d "${WORK_ROOT%/}/storage-${PROJECT}-XXXXXX")"
run_label="dtd.backup.run=${PROJECT}-storage-${stamp}-$$"
cleanup() {
  if [[ -z "${RCLONE_BIN}" ]]; then
    docker ps -q --filter "label=${run_label}" | xargs -r docker rm -f >/dev/null 2>&1 || true
  fi
  rm -rf -- "${work}"
  rm -f -- "${tar_age}.part" "${lista_age}.part" "${manif}.part" "${referencia}.part"
}
trap cleanup EXIT

# rclone: binario local (pruebas) o contenedor con la carpeta montada en /data.
if [[ -n "${RCLONE_BIN}" ]]; then
  ldir="${dir}"
  rcl() { "${RCLONE_BIN}" "$@"; }
else
  ldir="/data"
  rcl() {
    docker run --rm --label "${run_label}" -v "${RCLONE_CONFIG}:/config/rclone:ro" -v "${dir}:/data:ro" "${RCLONE_IMAGE}" \
      --contimeout 30s --timeout 5m --retries 3 --low-level-retries 5 "$@"
  }
fi

log "respaldo del Storage de ${PROJECT}: ${en_disco} archivos, $(( bytes_disco / 1024 / 1024 )) MB → ${dir} y ${remote_dir}"

# ── 2. Un tar, tres consumidores. Los FIFOs no guardan datos: solo conectan. ──
# El stderr de tar y de la lista nombra archivos: va a ${work} (RAM) y se borra.
log "1/4 tar | age (sin copia en claro; FIFOs en ${WORK_ROOT})"
mkfifo -m 600 "${work}/a-lista" "${work}/a-sha" "${work}/b-cuenta"
awk '{ n++; b += $2 } END { printf "%d %d\n", n, b }' < "${work}/b-cuenta" > "${work}/cuenta" &
p_cuenta=$!
( python3 -I "${LISTA}" flujo < "${work}/a-lista" 2> "${work}/lista.err" \
    | tee "${work}/b-cuenta" | "${AGE_BIN}" -R "${AGE_RECIPIENTS}" > "${lista_age}.part" ) &
p_lista=$!
( sha256sum < "${work}/a-sha" | cut -c1-64 > "${work}/flujo.sha" ) &
p_sha=$!
set +e
LC_ALL=C tar -C "${SOURCE}" --format=posix --xattrs --xattrs-include='user.*' --numeric-owner -cf - . 2> "${work}/tar.err" | tee "${work}/a-lista" "${work}/a-sha" | "${AGE_BIN}" -R "${AGE_RECIPIENTS}" > "${tar_age}.part"
st=("${PIPESTATUS[@]}")
wait "${p_lista}"; r_lista=$?
wait "${p_sha}"; r_sha=$?
wait "${p_cuenta}"; r_cuenta=$?
set -e
avisos="$(grep -c . "${work}/tar.err" || true)"
if (( avisos > 0 )); then
  log "AVISO: tar escribió ${avisos} línea(s) de aviso; van solo sus tipos, sin la ruta («tar: <ruta>: <tipo>»):"
  # Solo las líneas con ese formato; las demás se cuentan, porque podrían traer una ruta.
  sed -nE 's/^tar: .*: //p' "${work}/tar.err" | sort | uniq -c | sed 's/^/      /'
  otros="$(grep -cvE '^tar: .*: ' "${work}/tar.err" || true)"
  if (( otros > 0 )); then printf '      %s otro(s) aviso(s) fuera de formato, omitidos\n' "${otros}"; fi
fi
aviso_tar=0
case "${st[0]}" in
  0) ;;
  1) aviso_tar=1; log "AVISO: tar salió 1 (un archivo cambió o desapareció mientras se leía); la lista sale del mismo flujo y el respaldo sigue" ;;
  *) falla "tar salió ${st[0]} (${avisos} línea(s) de aviso, omitidas del log)" ;;
esac
(( st[1] == 0 && st[2] == 0 )) || falla "la tubería del respaldo falló (tee ${st[1]}, age ${st[2]})"
(( r_lista == 0 )) || falla "la lista por archivo falló (${r_lista}): $(grep -m1 '^storage-lista:' "${work}/lista.err" || echo 'sin detalle')"
(( r_sha == 0 && r_cuenta == 0 )) || falla "la huella o el conteo del flujo fallaron (${r_sha}/${r_cuenta})"
read -r archivos bytes < "${work}/cuenta"
flujo_sha="$(cat "${work}/flujo.sha")"
[[ "${flujo_sha}" =~ ^[0-9a-f]{64}$ ]] || falla "huella del flujo inválida"
(( archivos >= MIN_FILES )) || falla "el flujo trae ${archivos} archivos y se esperaban al menos ${MIN_FILES}"
mv "${tar_age}.part" "${tar_age}"
mv "${lista_age}.part" "${lista_age}"
rm -rf -- "${work}"
if (( archivos != en_disco )); then
  log "AVISO: el tar trae ${archivos} archivos y la carpeta tenía ${en_disco} al empezar (subidas o borrados durante el respaldo)"
fi

# ── 3. Manifiesto en claro: cifras y huellas, ninguna ruta. ──
log "2/4 manifiesto y sha256"
{
  echo "sello=${stamp}"
  echo "proyecto=${PROJECT}"
  echo "archivos=${archivos}"
  echo "bytes=${bytes}"
  echo "archivos_en_disco=${en_disco}"
  echo "aviso_tar=${aviso_tar}"
  echo "flujo_sha256=${flujo_sha}"
  # Formato de `sha256sum -c` escrito a mano: así no depende de la plataforma.
  for f in "${tar_age}" "${lista_age}"; do printf '%s  %s\n' "$(sha256sum < "${f}" | cut -c1-64)" "$(basename "${f}")"; done
} > "${manif}.part"
mv "${manif}.part" "${manif}"

# ── 4. Subida (copy, nunca sync) y comprobación. ──
log "3/4 rclone copy + check → ${remote_dir}"
for f in "${tar_age}" "${lista_age}" "${manif}"; do
  rcl copy "${ldir}/$(basename "${f}")" "${remote_dir}"
done
rcl check "${ldir}/" "${remote_dir}" --one-way --include "/${base}*"

# ── 5. Guarda contra un borrado masivo, y recién entonces la retención. ──
# Falla cerrada. Una referencia que no se puede leer frena la retención. Sin referencia
# confiable, manda el MÁXIMO de los manifiestos anteriores, locales y del remoto (que su
# retención conserva 30 días): el más nuevo puede ser ya el de después de la caída, y en
# un disco nuevo o con un --out equivocado no hay manifiestos locales.
patron_base="^${PROJECT}-storage-[0-9]{8}T[0-9]{6}Z$"
previo=""; bueno=""; ilegible=0
if [[ -f "${referencia}" ]]; then
  # Sin permisos de lectura, sed falla: con pipefail saldría sin decir nada; así cae en «ilegible».
  previo="$(sed -n 's/^archivos=//p' "${referencia}" 2>/dev/null | tail -n1 || true)"
  bueno="$(sed -n 's/^base=//p' "${referencia}" 2>/dev/null | tail -n1 || true)"
  if ! [[ "${previo}" =~ ^[1-9][0-9]*$ && "${bueno}" =~ ${patron_base} ]]; then ilegible=1; previo=""; bueno=""; fi
fi
if [[ ! -f "${referencia}" ]] || (( ilegible )); then
  # «<archivos> <base>» de cada manifiesto anterior. Los del remoto van en claro y sin rutas;
  # su base sale de `sello=`.
  locales="$(find "${dir}" -maxdepth 1 -type f -name "${PROJECT}-storage-*.manifiesto" ! -name "${base}.manifiesto" \
    | while read -r m; do printf '%s %s\n' "$(sed -n 's/^archivos=//p' "${m}" | tail -n1)" "$(basename "${m}" .manifiesto)"; done || true)"
  remotos="$(rcl cat "${remote_dir}" --filter "- /${base}.manifiesto" --filter "+ /${PROJECT}-storage-*.manifiesto" --filter "- *")" \
    || falla "sin referencia confiable y sin poder leer los manifiestos del remoto (${remote_dir}): no se aplica la retención"
  mejor="$( { printf '%s\n' "${locales}"
              printf '%s\n' "${remotos}" | awk -F= -v p="${PROJECT}" '/^sello=/ { s = $2 } /^archivos=/ { print $2 " " p "-storage-" s }'
            } | grep -E '^[0-9]+ ' | sort -n | tail -n1 || true)"
  if [[ -n "${mejor}" ]]; then
    previo="${mejor%% *}"; bueno="${mejor#* }"
    log "AVISO: sin referencia confiable; se compara contra el máximo de los manifiestos locales y del remoto (${previo} archivos, ${bueno})"
  fi
fi
if [[ -z "${ACEPTAR_CAIDA}" ]]; then
  if (( ilegible )); then
    log "✗ la referencia ${referencia} no se puede leer: el respaldo ${base} se subió, pero NO se aplica la retención"
    log "  hace falta revisarla y correr a mano --aceptar-caida=<archivos> con OK nominal de Sam (runbook §5.1)"
    falla "referencia del Storage ilegible"
  fi
  if [[ -n "${previo}" ]] && (( archivos * 100 < previo * MIN_PCT )); then
    log "✗ el Storage cayó de ${previo} a ${archivos} archivos (menos del ${MIN_PCT} %): el respaldo ${base} se subió, pero NO se aplica la retención para no perder los respaldos buenos"
    log "  si la caída es legítima, se acepta a mano con --aceptar-caida=${archivos}, SOLO con OK nominal de Sam (runbook §5.1)"
    falla "caída del conteo del Storage: ${previo} → ${archivos}"
  fi
else
  (( archivos == ACEPTAR_CAIDA )) \
    || falla "--aceptar-caida=${ACEPTAR_CAIDA} no coincide con los ${archivos} archivos de este respaldo: no se acepta nada ni se aplica la retención"
  # Antes de la retención, el último respaldo bueno sale de su alcance, en el remoto y en disco.
  # Sin uno identificado (referencia ilegible y sin manifiestos, o un --out equivocado) no se acepta nada.
  [[ "${bueno}" =~ ${patron_base} ]] \
    || falla "no hay un respaldo bueno identificado que retener (¿--out correcto? ¿referencia y manifiestos en ${dir}?): no se acepta nada ni se aplica la retención"
  ret_remoto="${REMOTE}/${PROJECT}-retenido/"
  rcl copy "${remote_dir}" "${ret_remoto}" --include "/${bueno}*" \
    || falla "no se pudo retener ${bueno} en ${ret_remoto}: no se aplica la retención"
  rcl check "${remote_dir}" "${ret_remoto}" --one-way --include "/${bueno}*" \
    || falla "la copia retenida de ${bueno} no coincide: no se aplica la retención"
  # rclone sale 0 si no había nada que copiar: se cuentan los tres archivos en el destino.
  en_retenido="$(rcl lsf "${ret_remoto}" --files-only --include "/${bueno}*" | grep -c . || true)"
  [[ "${en_retenido}" == 3 ]] \
    || falla "en ${ret_remoto} hay ${en_retenido} de los 3 archivos de ${bueno}: no se aplica la retención"
  retenido="${OUT%/}/${PROJECT}/storage-retenido"
  mkdir -p "${retenido}"; chmod 700 "${retenido}"
  movidos=0
  for f in "${dir}/${bueno}.tar.age" "${dir}/${bueno}-lista.age" "${dir}/${bueno}.manifiesto"; do
    if [[ -f "${f}" ]]; then mv -- "${f}" "${retenido}/"; movidos=$((movidos + 1)); fi
  done
  if (( movidos == 3 )); then
    log "último respaldo bueno (${bueno}, ${previo:-?} archivos) retenido en ${ret_remoto} y en ${retenido}/; ninguna retención los toca"
  else
    log "AVISO: último respaldo bueno (${bueno}, ${previo:-?} archivos) retenido y verificado en ${ret_remoto}; en disco solo estaban ${movidos} de sus 3 archivos y esos quedaron en ${retenido}/"
  fi
  log "caída aceptada a mano: la referencia pasa de ${previo:-?} a ${archivos} archivos"
fi
printf 'archivos=%s\nbase=%s\nsello=%s\n' "${archivos}" "${base}" "${stamp}" > "${referencia}.part"
mv -- "${referencia}.part" "${referencia}"

log "4/4 retención: ${RETENTION_DAYS} d en ${remote_dir}, ${KEEP_LOCAL} respaldos en ${dir}"
rcl delete --min-age "${RETENTION_DAYS}d" "${remote_dir}"
find "${dir}" -maxdepth 1 -type f -name "${PROJECT}-storage-*.manifiesto" -printf '%T@ %p\n' \
  | sort -rn | tail -n "+$((KEEP_LOCAL + 1))" | cut -d' ' -f2- \
  | while read -r viejo; do b="${viejo%.manifiesto}"; rm -f -- "${viejo}" "${b}.tar.age" "${b}-lista.age"; done

log "listo: ${base} · ${archivos} archivos · ${bytes} bytes · $(du -h "${tar_age}" | cut -f1) cifrado"
