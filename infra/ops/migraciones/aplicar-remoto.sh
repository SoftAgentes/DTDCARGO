#!/usr/bin/env bash
# infra/ops/migraciones/aplicar-remoto.sh — lleva uno o varios paquetes al VPS y corre aplicar.sh por ssh (SDD-0546).
#
# Corre en el equipo del operador (Git Bash en Windows o Linux), desde un
# checkout del repo. Por cada paquete de preparar.mjs, EN ORDEN:
#   1. comprueba en local SHA256SUMS, que IDENTIDAD.txt sea de la migración
#      esperada y del proyecto, y lee su md5 de aplicar.sql;
#   2. comprueba que /srv/ops/migraciones/aplicar.sh y /srv/ops/lib/migracion.sh
#      del servidor sean byte a byte los de este checkout (sha256): el servidor
#      corre lo revisado, o no corre;
#   3. copia el paquete a /srv/ops/paquetes/migraciones/<nombre>-<ts>/ (y la
#      autorización, fuera de SHA256SUMS);
#   4. corre `aplicar.sh --paso <paso>` allí, por ssh.
# Para en la primera falla y sale con su código: con varias migraciones, cada una
# va en SU transacción y con SU evidencia (de a una, nunca en bundle); las que
# siguen a la que falló no se tocan.
#
# Uso:
#   aplicar-remoto.sh --host root@217.216.54.70 --proyecto dtd-cargo --confirm dtd-cargo \
#       --esperada <NNNN_nombre> --paquete <dir> [--esperada … --paquete …] \
#       [--paso previa|aplicar] [--autorizacion <archivo>] [--en-seco]
#
# En Windows, el ssh con el agente de Windows es el de System32:
#   MIGRACIONES_SSH=/c/Windows/System32/OpenSSH/ssh.exe \
#   MIGRACIONES_SCP=/c/Windows/System32/OpenSSH/scp.exe aplicar-remoto.sh …
# (las rutas locales se convierten con cygpath para el scp.exe). No exportes
# MSYS_NO_PATHCONV para este script.
#
# --en-seco: comprueba todo en local e imprime los comandos, sin ssh ni scp.
# Códigos: los de aplicar.sh (0 · 2 · 3 · 4 · 5 · 6 · 7), y 3 también si el
# servidor no tiene instalada la versión de este checkout o si ssh/scp fallan.
set -uo pipefail

S="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
SSH="${MIGRACIONES_SSH:-ssh}"
SCP="${MIGRACIONES_SCP:-scp}"
OPS_REMOTO="${MIGRACIONES_OPS_REMOTO:-/srv/ops}"
PAQUETES_REMOTO="${MIGRACIONES_PAQUETES_REMOTO:-${OPS_REMOTO}/paquetes/migraciones}"
PROD="${PROD_COMPOSE_PROJECT:-dtd-cargo}"

HOST=""; PROYECTO=""; CONFIRM=""; PASO="aplicar"; AUTORIZACION=""; EN_SECO=0
ESPERADAS=(); PAQUETES=()

uso() { sed -n '2,31p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "aplicar-remoto: $*" >&2; exit 2; }
refuse() { echo "aplicar-remoto: RECHAZADO · $*" >&2; exit 3; }
valor() { [[ -n "${2-}" && "${2}" != --* ]] || die "falta el valor de $1"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) valor "$1" "${2-}"; HOST="$2"; shift 2 ;;
    --proyecto) valor "$1" "${2-}"; PROYECTO="$2"; shift 2 ;;
    --confirm) valor "$1" "${2-}"; CONFIRM="$2"; shift 2 ;;
    --esperada) valor "$1" "${2-}"; ESPERADAS+=("${2%.sql}"); shift 2 ;;
    --paquete) valor "$1" "${2-}"; PAQUETES+=("${2%/}"); shift 2 ;;
    --paso) valor "$1" "${2-}"; PASO="$2"; shift 2 ;;
    --autorizacion) valor "$1" "${2-}"; AUTORIZACION="$2"; shift 2 ;;
    --en-seco) EN_SECO=1; shift ;;
    -h|--help) uso; exit 0 ;;
    *) die "argumento desconocido: $1 (ver --help)" ;;
  esac
done

[[ "${HOST}" =~ ^[A-Za-z0-9._-]+@[A-Za-z0-9.:_-]+$ ]] || die "--host tiene que ser usuario@servidor: '${HOST}'"
[[ "${PROYECTO}" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || die "--proyecto inválido: '${PROYECTO}'"
[[ "${PROYECTO}" == "${PROD}" || "${PROYECTO}" == *-staging ]] || refuse "${PROYECTO} no es producción (${PROD}) ni termina en -staging"
[[ "${CONFIRM}" == "${PROYECTO}" ]] || refuse "--confirm tiene que repetir el proyecto (${PROYECTO})"
[[ "${PASO}" == previa || "${PASO}" == aplicar ]] || die "--paso tiene que ser previa o aplicar"
(( ${#PAQUETES[@]} > 0 )) || die "falta al menos un --paquete"
(( ${#PAQUETES[@]} == ${#ESPERADAS[@]} )) || die "cada --paquete va con su --esperada, en el mismo orden (${#PAQUETES[@]} paquetes, ${#ESPERADAS[@]} esperadas)"
if [[ "${PASO}" == aplicar && "${PROYECTO}" == "${PROD}" ]]; then
  [[ -n "${AUTORIZACION}" ]] || refuse "aplicar en producción exige --autorizacion <archivo> con el OK literal de Sam"
fi
[[ -z "${AUTORIZACION}" || -s "${AUTORIZACION}" ]] || refuse "la autorización ${AUTORIZACION} no existe o está vacía"

# ── Comprobaciones locales de todos los paquetes, antes de tocar el servidor ──
MD5S=()
for i in "${!PAQUETES[@]}"; do
  p="${PAQUETES[$i]}"; e="${ESPERADAS[$i]}"
  [[ "${e}" =~ ^[0-9]{4}[a-z]?_[a-z0-9_]+$ ]] || die "--esperada tiene que ser el nombre exacto, sin .sql: '${e}'"
  [[ -f "${p}/SHA256SUMS" && -f "${p}/IDENTIDAD.txt" ]] || refuse "${p} no es un paquete de preparar.mjs"
  ( cd "${p}" && sha256sum --check --quiet --strict SHA256SUMS ) > /dev/null 2>&1 || { echo "aplicar-remoto: INTEGRIDAD · SHA256SUMS no coincide en ${p}" >&2; exit 4; }
  nombre="$(grep -E '^nombre=' "${p}/IDENTIDAD.txt" | tail -n1 | cut -d= -f2-)"
  proy="$(grep -E '^proyecto=' "${p}/IDENTIDAD.txt" | tail -n1 | cut -d= -f2-)"
  m="$(grep -E '^aplicar_md5=' "${p}/IDENTIDAD.txt" | tail -n1 | cut -d= -f2-)"
  [[ "${nombre}" == "${e}" ]] || refuse "el paquete ${p} es de ${nombre}, no de ${e}"
  [[ "${proy}" == "${PROYECTO}" ]] || refuse "el paquete ${p} se preparó para ${proy}, no para ${PROYECTO}"
  [[ "${m}" =~ ^[0-9a-f]{32}$ ]] || refuse "IDENTIDAD.txt de ${p} sin aplicar_md5"
  if [[ -n "${AUTORIZACION}" ]]; then
    n="${e%%_*}"
    grep -qE "(^|[^0-9A-Za-z])${n}([^0-9A-Za-z]|$)" -- "${AUTORIZACION}" || refuse "la autorización no nombra la ${n}: el OK de Sam tiene que nombrar cada migración"
  fi
  MD5S+=("${m}")
done
for i in "${!ESPERADAS[@]}"; do
  for j in "${!ESPERADAS[@]}"; do
    (( i < j )) && [[ "${ESPERADAS[$i]}" == "${ESPERADAS[$j]}" ]] && die "${ESPERADAS[$i]} aparece dos veces"
  done
done

LOCAL_APLICAR="$(sha256sum < "${S}/migraciones/aplicar.sh" | cut -c1-64)"
LOCAL_LIB="$(sha256sum < "${S}/lib/migracion.sh" | cut -c1-64)"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
q() { printf '%q ' "$@"; }
# scp.exe de Windows no entiende /c/Users/…: se le pasa C:/Users/….
ruta_local() { if [[ "${SCP}" == *.exe ]] && command -v cygpath > /dev/null 2>&1; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

if (( EN_SECO )); then
  echo "aplicar-remoto: EN SECO · ${#PAQUETES[@]} paquete(s) para ${PROYECTO} en ${HOST} (${PASO}) · comprobaciones locales PASÓ"
  echo "+ ${SSH} -o BatchMode=yes ${HOST} sha256sum ${OPS_REMOTO}/migraciones/aplicar.sh ${OPS_REMOTO}/lib/migracion.sh   (esperado ${LOCAL_APLICAR:0:12}… y ${LOCAL_LIB:0:12}…)"
  for i in "${!PAQUETES[@]}"; do
    dest="${PAQUETES_REMOTO}/${ESPERADAS[$i]}-${TS}"
    echo "+ ${SCP} … ${PAQUETES[$i]}/{migracion.sql,previa.sql,aplicar.sql,verificar.sql,IDENTIDAD.txt,SHA256SUMS} ${HOST}:${dest}/"
    echo "+ ${SSH} -o BatchMode=yes ${HOST} bash ${OPS_REMOTO}/migraciones/aplicar.sh --proyecto ${PROYECTO} --confirm ${PROYECTO} --migracion ${ESPERADAS[$i]} --paquete ${dest} --md5 ${MD5S[$i]} --paso ${PASO} --evidencias ${OPS_REMOTO}/evidencias${AUTORIZACION:+ --autorizacion ${dest}/AUTORIZACION.txt}"
  done
  exit 0
fi

# ── El servidor corre lo de este checkout ──────────────────────────────────────
remoto="$("${SSH}" -o BatchMode=yes "${HOST}" "$(q sha256sum "${OPS_REMOTO}/migraciones/aplicar.sh" "${OPS_REMOTO}/lib/migracion.sh")" 2>&1)" \
  || refuse "no pude leer los scripts instalados en ${HOST}: ${remoto:0:300}"
# sha256sum en modo binario antepone «*» a la ruta.
r_aplicar="$(awk -v f="${OPS_REMOTO}/migraciones/aplicar.sh" '{ sub(/^\*/, "", $2) } $2 == f { print $1 }' <<< "${remoto}")"
r_lib="$(awk -v f="${OPS_REMOTO}/lib/migracion.sh" '{ sub(/^\*/, "", $2) } $2 == f { print $1 }' <<< "${remoto}")"
if [[ "${r_aplicar}" != "${LOCAL_APLICAR}" || "${r_lib}" != "${LOCAL_LIB}" ]]; then
  refuse "los scripts del servidor no son los de este checkout (aplicar.sh ${r_aplicar:0:12}… vs ${LOCAL_APLICAR:0:12}…, migracion.sh ${r_lib:0:12}… vs ${LOCAL_LIB:0:12}…). Instálalos desde main (runbook §1) o corre desde el checkout que coincide"
fi
echo "aplicar-remoto: el servidor tiene aplicar.sh ${LOCAL_APLICAR:0:12}… y migracion.sh ${LOCAL_LIB:0:12}…, iguales a este checkout"

for i in "${!PAQUETES[@]}"; do
  p="${PAQUETES[$i]}"; e="${ESPERADAS[$i]}"
  dest="${PAQUETES_REMOTO}/${e}-${TS}"
  echo "aplicar-remoto: ── ${e} ($((i + 1)) de ${#PAQUETES[@]}) · paso ${PASO} · md5 de aplicar.sql ${MD5S[$i]}"
  "${SSH}" -o BatchMode=yes "${HOST}" "$(q mkdir -p -- "${dest}")" || refuse "ssh: no pude crear ${dest}"
  archivos=()
  for f in migracion.sql previa.sql aplicar.sql verificar.sql IDENTIDAD.txt SHA256SUMS; do archivos+=("$(ruta_local "${p}/${f}")"); done
  "${SCP}" -q -o BatchMode=yes "${archivos[@]}" "${HOST}:${dest}/" || refuse "scp: no pude copiar ${p}"
  args=(bash "${OPS_REMOTO}/migraciones/aplicar.sh" --proyecto "${PROYECTO}" --confirm "${CONFIRM}" --migracion "${e}" --paquete "${dest}" --md5 "${MD5S[$i]}" --paso "${PASO}" --evidencias "${OPS_REMOTO}/evidencias")
  if [[ -n "${AUTORIZACION}" ]]; then
    "${SCP}" -q -o BatchMode=yes "$(ruta_local "${AUTORIZACION}")" "${HOST}:${dest}/AUTORIZACION.txt" || refuse "scp: no pude copiar la autorización"
    args+=(--autorizacion "${dest}/AUTORIZACION.txt")
  fi
  "${SSH}" -o BatchMode=yes "${HOST}" "$(q "${args[@]}")"; rc=$?
  if (( rc == 255 )); then
    # ssh cayó: no se sabe si el apply llegó al COMMIT. No se repite a ciegas.
    echo "aplicar-remoto: SSH FALLÓ (255) durante ${e}: no se sabe si se aplicó. Corre --paso previa: si dice «ya está en el ledger», se aplicó; mira la evidencia en ${OPS_REMOTO}/evidencias del servidor" >&2
    exit 255
  fi
  if (( rc != 0 )); then
    resto=$(( ${#PAQUETES[@]} - i - 1 ))
    echo "aplicar-remoto: PARADO en ${e} (código ${rc}).$( (( resto > 0 )) && echo " No se tocaron las ${resto} siguientes.")" >&2
    exit "${rc}"
  fi
done
echo "aplicar-remoto: ${#PAQUETES[@]} de ${#PAQUETES[@]} · paso ${PASO} PASÓ"
