#!/usr/bin/env bash
# infra/ops/backup/storage-restore.sh — comprueba o restaura un respaldo del Storage (SDD-0620).
#
# Trabaja sobre una carpeta con los tres archivos de un respaldo de
# storage-backup.sh (<base>.tar.age, <base>-lista.age y <base>.manifiesto), ya
# bajados del bucket con rclone copy (docs/runbooks/backup-restore-servidor.md §5).
#
# Dos modos, los dos con las mismas comprobaciones:
#   --verificar          descifra y recorre el flujo SIN escribir ningún archivo:
#                        la lista por archivo sale del flujo (storage-lista.py)
#   --destino <carpeta>  restaura en esa carpeta (vacía o inexistente), con los
#                        xattrs `user.*` (Content-Type y Cache-Control de
#                        storage-api), y lee la lista de lo que quedó en disco.
#                        Para la prueba mensual, una carpeta desechable en
#                        /dev/shm; para un restore real, una carpeta nueva al
#                        lado de data/storage (§5.3).
#
# Comprobaciones (cada una imprime PASÓ o FALLÓ):
#   1. sha256 de los dos .age contra el manifiesto, ANTES de descifrar
#   2. descifrado y tar sin errores
#   3. huella sha256 del flujo descifrado = flujo_sha256 del manifiesto
#   4. lista restaurada = lista cifrada del respaldo: mismas rutas, bytes,
#      sha256 y xattrs `user.*` (comparados por huella; los valores no se imprimen)
#   5. conteo y bytes = los del manifiesto
#
# La lista descifrada (rutas que pueden traer nombres de personas), los avisos
# de tar (que nombran archivos) y la clave viven solo en --work-dir (/dev/shm);
# un trap borra la carpeta al salir. La salida solo trae cifras.
#
# Uso:
#   storage-restore.sh --dir <carpeta> --age-identity /dev/shm/clave.txt \
#       (--verificar | --destino <carpeta>) [--base <proyecto>-storage-<sello>] [--work-dir /dev/shm]
# Sin --base usa el manifiesto más nuevo de --dir. `AGE_BIN` cambia el binario de age.
# Códigos: 0 PASÓ · 1 FALLÓ · 2 argumentos inválidos.
set -euo pipefail
umask 077

LISTA="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/../lib/storage-lista.py"

DIR=""
BASE=""
IDENTITY=""
MODO=""
DESTINO=""
WORK_ROOT="/dev/shm"
AGE_BIN="${AGE_BIN:-age}"

usage() { sed -n '2,35p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
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
# Rutas absolutas: el modo --verificar trabaja desde --work-dir.
DIR="$(readlink -f "${DIR}")"
IDENTITY="$(readlink -f "${IDENTITY}")"
if [[ "${MODO}" == destino ]]; then
  [[ -n "${DESTINO}" ]] || die "--destino necesita una carpeta"
  if [[ -e "${DESTINO}" ]]; then
    [[ -d "${DESTINO}" && -z "$(ls -A "${DESTINO}")" ]] || die "--destino ${DESTINO} existe y no está vacía: nunca se restaura encima de nada"
  else
    mkdir -m 700 -p "${DESTINO}"
  fi
  DESTINO="$(readlink -f "${DESTINO}")"
fi
[[ -d "${WORK_ROOT}" && -w "${WORK_ROOT}" ]] || die "--work-dir ${WORK_ROOT} no existe o no se puede escribir"
tar --version 2>/dev/null | grep -q 'GNU tar' || die "hace falta GNU tar (--xattrs)"
command -v python3 >/dev/null || die "hace falta python3 (la lista por archivo)"
[[ -f "${LISTA}" ]] || die "no encuentro ${LISTA}; ¿está desplegado infra/ops/lib?"
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

# 2-5. Descifrar la lista (a RAM) y el flujo (a tuberías, o a --destino).
if ! "${AGE_BIN}" -d -i "${IDENTITY}" < "${lista_age}" > "${work}/lista-respaldo" 2> "${work}/age.err"; then
  ko "no se pudo descifrar la lista con esa clave"; termina
fi
mkfifo -m 600 "${work}/a-sha"
( sha256sum < "${work}/a-sha" | cut -c1-64 > "${work}/flujo.sha" ) &
p_sha=$!
set +e
if [[ "${MODO}" == verificar ]]; then
  (cd "${work}" && "${AGE_BIN}" -d -i "${IDENTITY}" < "${tar_age}" | tee "${work}/a-sha" \
    | python3 -I "${LISTA}" flujo > "${work}/lista-flujo") 2> "${work}/flujo.err"
else
  "${AGE_BIN}" -d -i "${IDENTITY}" < "${tar_age}" 2> "${work}/age.err" | tee "${work}/a-sha" \
    | LC_ALL=C tar -C "${DESTINO}" --xattrs --xattrs-include='user.*' --numeric-owner -xf - 2> "${work}/flujo.err"
fi
r=$?
wait "${p_sha}"; r_sha=$?
set -e
avisos="$(grep -c . "${work}/flujo.err" || true)"
if (( r == 0 && r_sha == 0 )); then ok "descifrado y tar sin errores"; else ko "descifrado o tar fallaron (${r}/${r_sha}; ${avisos} línea(s) de error; van solo sus tipos, sin la ruta)"; fi
if (( avisos > 0 )); then
  sed -nE 's/^tar: .*: //p' "${work}/flujo.err" | sort | uniq -c | sed 's/^/      /'
  otros="$(grep -cvE '^tar: .*: ' "${work}/flujo.err" || true)"
  if (( otros > 0 )); then printf '      %s otro(s) aviso(s) fuera de formato, omitidos\n' "${otros}"; fi
fi
if [[ "${MODO}" == destino ]]; then
  python3 -I "${LISTA}" carpeta "${DESTINO}" > "${work}/lista-flujo" 2> "${work}/carpeta.err" \
    || ko "no se pudo leer la carpeta restaurada: $(grep -m1 '^storage-lista:' "${work}/carpeta.err" || echo 'sin detalle')"
fi

[[ "$(cat "${work}/flujo.sha" 2>/dev/null)" == "${m_sha}" ]] \
  && ok "huella del flujo descifrado = la del manifiesto" || ko "huella del flujo descifrado distinta de la del manifiesto"
if cmp -s "${work}/lista-respaldo" "${work}/lista-flujo"; then
  ok "los archivos restaurados son los del respaldo: mismas rutas, bytes, sha256 y xattrs user.*"
else
  faltan="$(LC_ALL=C comm -23 "${work}/lista-respaldo" "${work}/lista-flujo" | wc -l)"
  sobran="$(LC_ALL=C comm -13 "${work}/lista-respaldo" "${work}/lista-flujo" | wc -l)"
  ko "lo restaurado no coincide con la lista del respaldo: ${faltan} faltan o cambian (contenido o xattrs), ${sobran} sobran"
fi
n="$(wc -l < "${work}/lista-flujo" | tr -d ' ')"
b="$(awk '{ s += $2 } END { printf "%d", s }' "${work}/lista-flujo")"
[[ "${n}" == "${m_archivos}" && "${b}" == "${m_bytes}" ]] \
  && ok "conteo y bytes = manifiesto (${n} archivos, ${b} bytes)" || ko "conteo o bytes distintos: ${n}/${b} contra ${m_archivos}/${m_bytes}"
termina
