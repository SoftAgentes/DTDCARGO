#!/usr/bin/env bash
# infra/ops/backup/storage-restore.sh — comprueba o restaura un respaldo del Storage (SDD-0620).
#
# Trabaja sobre una carpeta con los tres archivos de un respaldo de
# storage-backup.sh (<base>.tar.age, <base>-lista.age y <base>.manifiesto), ya
# bajados del bucket con rclone copy (docs/runbooks/backup-restore-servidor.md §5).
#
# Dos modos, los dos con las mismas comprobaciones:
#   --verificar          descifra y recorre el flujo SIN escribir ningún archivo:
#                        la lista por archivo sale del flujo con tar --to-command
#   --destino <carpeta>  restaura en esa carpeta (vacía o inexistente) y lee la
#                        lista de lo que quedó en disco. Para la prueba mensual,
#                        una carpeta desechable en /dev/shm; para un restore real,
#                        una carpeta nueva al lado de data/storage (§5).
#
# Comprobaciones (cada una imprime PASÓ o FALLÓ):
#   1. sha256 de los dos .age contra el manifiesto, ANTES de descifrar
#   2. huella sha256 del flujo descifrado = flujo_sha256 del manifiesto
#   3. lista restaurada = lista cifrada del respaldo (mismos archivos, mismos sha256)
#   4. conteo y bytes = los del manifiesto
#
# La lista descifrada (rutas que pueden traer nombres de personas) y la clave
# viven solo en --work-dir (/dev/shm); un trap borra la carpeta al salir.
#
# Uso:
#   storage-restore.sh --dir <carpeta> --age-identity /dev/shm/clave.txt \
#       (--verificar | --destino <carpeta>) [--base <proyecto>-storage-<sello>] [--work-dir /dev/shm]
# Sin --base usa el manifiesto más nuevo de --dir. `AGE_BIN` cambia el binario de age.
# Códigos: 0 PASÓ · 1 FALLÓ · 2 argumentos inválidos.
set -euo pipefail
umask 077

# shellcheck source=../lib/storage-lista.sh
source "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../lib/storage-lista.sh"

DIR=""
BASE=""
IDENTITY=""
MODO=""
DESTINO=""
WORK_ROOT="/dev/shm"
AGE_BIN="${AGE_BIN:-age}"

usage() { sed -n '2,29p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "storage-restore: $*" >&2; exit 2; }
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
termina() { echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"; (( fail == 0 )) && exit 0 || exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) DIR="${2-}"; shift 2 ;;
    --base) BASE="${2-}"; shift 2 ;;
    --age-identity) IDENTITY="${2-}"; shift 2 ;;
    --verificar) MODO=verificar; shift ;;
    --destino) MODO=destino; DESTINO="${2-}"; shift 2 ;;
    --work-dir) WORK_ROOT="${2-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

[[ -d "${DIR}" ]] || die "--dir no es una carpeta: '${DIR}'"
[[ -f "${IDENTITY}" ]] || die "--age-identity no existe: '${IDENTITY}'"
[[ -n "${MODO}" ]] || die "falta --verificar o --destino <carpeta>"
if [[ "${MODO}" == destino ]]; then
  [[ -n "${DESTINO}" ]] || die "--destino necesita una carpeta"
  if [[ -e "${DESTINO}" ]]; then
    [[ -d "${DESTINO}" && -z "$(ls -A "${DESTINO}")" ]] || die "--destino ${DESTINO} existe y no está vacía: nunca se restaura encima de nada"
  else
    mkdir -m 700 -p "${DESTINO}"
  fi
fi
[[ -d "${WORK_ROOT}" && -w "${WORK_ROOT}" ]] || die "--work-dir ${WORK_ROOT} no existe o no se puede escribir"
tar --version 2>/dev/null | grep -q 'GNU tar' || die "hace falta GNU tar (--to-command)"
if [[ -z "${BASE}" ]]; then
  m="$(find "${DIR}" -maxdepth 1 -type f -name '*-storage-*.manifiesto' | sort | tail -n1)"
  [[ -n "${m}" ]] || die "no hay ningún *-storage-*.manifiesto en ${DIR}"
  BASE="$(basename "${m}" .manifiesto)"
fi
manif="${DIR}/${BASE}.manifiesto"
tar_age="${DIR}/${BASE}.tar.age"
lista_age="${DIR}/${BASE}-lista.age"
for f in "${manif}" "${tar_age}" "${lista_age}"; do [[ -f "${f}" ]] || die "falta ${f}"; done
campo() { sed -n "s/^$1=//p" "${manif}" | tail -n1; }
m_archivos="$(campo archivos)"; m_bytes="$(campo bytes)"; m_sha="$(campo flujo_sha256)"
[[ "${m_archivos}" =~ ^[0-9]+$ && "${m_bytes}" =~ ^[0-9]+$ && "${m_sha}" =~ ^[0-9a-f]{64}$ ]] || die "manifiesto ilegible: ${manif}"

work="$(mktemp -d "${WORK_ROOT%/}/storage-restore-XXXXXX")"
trap 'rm -rf -- "${work}"' EXIT
echo "storage-restore: ${BASE} · modo ${MODO}${DESTINO:+ → ${DESTINO}}"

# 1. Huellas de los cifrados antes de descifrar nada.
if (cd "${DIR}" && grep -E '^[0-9a-f]{64}  ' "${manif}" | sha256sum -c --quiet --status 2>/dev/null) \
   && [[ "$(grep -cE '^[0-9a-f]{64}  ' "${manif}")" == 2 ]]; then
  ok "sha256 de los dos cifrados coincide con el manifiesto"
else
  ko "sha256 de los cifrados no coincide con el manifiesto: archivo dañado o cambiado; no se descifra"
  termina
fi

# 2-4. Descifrar la lista (a RAM) y el flujo (a tuberías, o a --destino).
if ! "${AGE_BIN}" -d -i "${IDENTITY}" < "${lista_age}" | LC_ALL=C sort > "${work}/lista-respaldo"; then
  ko "no se pudo descifrar la lista con esa clave"; termina
fi
mkfifo -m 600 "${work}/a-sha"
( sha256sum < "${work}/a-sha" | cut -c1-64 > "${work}/flujo.sha" ) &
p_sha=$!
set +e
if [[ "${MODO}" == verificar ]]; then
  (cd "${work}" && "${AGE_BIN}" -d -i "${IDENTITY}" < "${tar_age}" | tee "${work}/a-sha" \
    | LC_ALL=C tar -xf - --to-command="${STORAGE_LISTA_CMD}" > "${work}/lista-flujo")
else
  "${AGE_BIN}" -d -i "${IDENTITY}" < "${tar_age}" | tee "${work}/a-sha" | LC_ALL=C tar -C "${DESTINO}" --numeric-owner -xf -
fi
r=$?
wait "${p_sha}"; r_sha=$?
set -e
if (( r == 0 && r_sha == 0 )); then ok "descifrado y tar sin errores"; else ko "descifrado o tar fallaron (${r}/${r_sha})"; fi
if [[ "${MODO}" == destino ]]; then storage_lista_de_carpeta "${DESTINO}" > "${work}/lista-flujo"; fi
LC_ALL=C sort -o "${work}/lista-flujo" "${work}/lista-flujo"

[[ "$(cat "${work}/flujo.sha" 2>/dev/null)" == "${m_sha}" ]] \
  && ok "huella del flujo descifrado = la del manifiesto" || ko "huella del flujo descifrado distinta de la del manifiesto"
if cmp -s "${work}/lista-respaldo" "${work}/lista-flujo"; then
  ok "los archivos restaurados son los del respaldo: mismas rutas, bytes y sha256"
else
  ko "lo restaurado no coincide con la lista del respaldo: $(LC_ALL=C comm -23 "${work}/lista-respaldo" "${work}/lista-flujo" | wc -l) faltan o cambian, $(LC_ALL=C comm -13 "${work}/lista-respaldo" "${work}/lista-flujo" | wc -l) sobran"
fi
n="$(wc -l < "${work}/lista-flujo" | tr -d ' ')"
b="$(awk '{ s += $2 } END { printf "%d", s }' "${work}/lista-flujo")"
[[ "${n}" == "${m_archivos}" && "${b}" == "${m_bytes}" ]] \
  && ok "conteo y bytes = manifiesto (${n} archivos, ${b} bytes)" || ko "conteo o bytes distintos: ${n}/${b} contra ${m_archivos}/${m_bytes}"
termina
