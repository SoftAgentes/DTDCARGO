#!/usr/bin/env bash
# infra/ops/tests/prueba-respaldo-storage.sh — respaldo y restore de los archivos del
# Storage (SDD-0620): storage-backup.sh, storage-restore.sh y su paso en backup.sh.
#
# Sin VPS, sin bucket y sin la llave de Sam: el Storage es una carpeta sintética
# con marcadores y con los xattrs `user.supabase.*` que pone storage-api; `age` es
# un doble que cifra de verdad con openssl (y espía, al empezar y al terminar, si
# hay algo en claro en disco); rclone es un doble que copia a una carpeta local,
# y docker es un doble que contesta «la base está corriendo». Si hay un `age`
# real en /usr/bin, también se hace la ida y vuelta con él.
#
# Además de los contratos, corre mutantes: copias de los scripts con un defecto
# sembrado que TIENEN que caer; antes de cada uno, el mismo contrato pasa sin mutar.
# Pide Linux con GNU tar, python3, openssl, flock y un sistema de archivos con
# xattrs `user.*` en el directorio temporal: corre en pruebas-linux.sh (CI ubuntu).
# Uso: bash infra/ops/tests/prueba-respaldo-storage.sh
set -uo pipefail
S="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
R="$(cd "${S}/../.." && pwd)"
T="$(mktemp -d)"
pass=0; fail=0
ok() { echo "PASÓ  · $*"; pass=$((pass + 1)); }
ko() { echo "FALLÓ · $*"; fail=$((fail + 1)); }
trap 'rm -rf "${T}" /run/lock/backup-zzst.lock' EXIT

MARCA="contenido-$(openssl rand -hex 8)"     # dentro de los archivos
NOMBRE="nombre$(openssl rand -hex 4)"         # en nombres de archivo
export ESPIA_MARCA="${MARCA}" ESPIA_LOG="${T}/espia.log"

echo "== preparación =="
mkdir -p "${T}/bin" "${T}/ops/backup" "${T}/ops/lib" "${T}/remoto" "${T}/shm" "${T}/rc"
: > "${ESPIA_LOG}"

# Doble de age: cifra con openssl (aes-256-ctr) y una cabecera con la huella de
# la llave, para que la llave equivocada falle como en age. Al cifrar busca la
# marca en las carpetas de ESPIA_DIRS, al empezar y al terminar: si hay un claro
# en disco, lo anota.
cat > "${T}/bin/age" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
modo=cifrar; llave=""
while [ $# -gt 0 ]; do
  case "$1" in -R|-i) llave="$2"; shift 2 ;; -d) modo=descifrar; shift ;; *) echo "age doble: $1" >&2; exit 2 ;; esac
done
pase="$(grep -Eo 'age1[0-9a-z]+' "${llave}" | head -n1)"
[ -n "${pase}" ] || { echo "age doble: sin llave" >&2; exit 1; }
huella="$(printf '%s' "${pase}" | sha256sum | cut -c1-16)"
espiar() { for d in ${ESPIA_DIRS:-}; do grep -rlsF -D skip -- "${ESPIA_MARCA}" "${d}" >> "${ESPIA_LOG}" || true; done; }
if [ "${modo}" = cifrar ]; then
  espiar
  printf 'DOBLE-AGE %s\n' "${huella}"
  openssl enc -aes-256-ctr -pbkdf2 -iter 1000 -pass "pass:${pase}"
  espiar
  exit 0
fi
IFS= read -r cab || true
[ "${cab}" = "DOBLE-AGE ${huella}" ] || { echo "age doble: no es para esta llave" >&2; exit 1; }
exec openssl enc -d -aes-256-ctr -pbkdf2 -iter 1000 -pass "pass:${pase}"
EOF
# Doble de rclone: <remoto>:<ruta> es ${RCLONE_DOBLE_RAIZ}/<ruta>.
cat > "${T}/bin/rclone" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
ruta() { printf '%s/%s' "${RCLONE_DOBLE_RAIZ}" "${1#*:}"; }
printf '%s\n' "$*" >> "${RCLONE_DOBLE_RAIZ}/.llamadas"
cmd="$1"; shift
local_o_remoto() { case "$1" in *:*) ruta "$1" ;; *) printf '%s' "$1" ;; esac; }
case "${cmd}" in
  copy)
    case "$1" in
      *:*) # remoto → remoto (copia del lado del servidor), con --include
        src="$(ruta "$1")"; dst="$(ruta "$2")"; shift 2; inc=""
        while [ $# -gt 0 ]; do case "$1" in --include) inc="${2#/}"; shift 2 ;; *) shift ;; esac; done
        mkdir -p "${dst}"; n=0
        for f in "${src%/}"/${inc}; do [ -f "${f}" ] || continue; cp -p "${f}" "${dst}/"; n=$((n + 1)); done
        [ "${n}" -gt 0 ] || { echo "copy: nada que copiar" >&2; exit 1; } ;;
      *) mkdir -p "$(ruta "$2")"; cp -p "$1" "$(ruta "$2")/" ;;
    esac ;;
  check)
    src="$(local_o_remoto "$1")"; dst="$(ruta "$2")"; shift 2; inc=""
    while [ $# -gt 0 ]; do case "$1" in --include) inc="${2#/}"; shift 2 ;; *) shift ;; esac; done
    n=0; for f in "${src%/}"/${inc}; do [ -f "${f}" ] || continue; n=$((n + 1)); cmp -s "${f}" "${dst}/$(basename "${f}")" || { echo "check: difiere" >&2; exit 1; }; done
    [ "${n}" -gt 0 ] || { echo "check: nada que comparar" >&2; exit 1; } ;;
  delete)
    edad=""; while [ $# -gt 1 ]; do case "$1" in --min-age) edad="${2%d}"; shift 2 ;; *) shift ;; esac; done
    [ -d "$(ruta "$1")" ] && find "$(ruta "$1")" -type f -mtime "+${edad}" -delete ;;
  *) echo "rclone doble: ${cmd}" >&2; exit 2 ;;
esac
EOF
printf '#!/usr/bin/env bash\n[ "$1" = ps ] && echo abc123\nexit 0\n' > "${T}/bin/docker"
chmod 700 "${T}/bin/"*
export PATH="${T}/bin:${PATH}" RCLONE_DOBLE_RAIZ="${T}/remoto" RCLONE_BIN="${T}/bin/rclone" AGE_BIN="${T}/bin/age"
echo "age1pruebadoble$(openssl rand -hex 16)" > "${T}/rec"
cp "${T}/rec" "${T}/id"   # el doble descifra con la misma línea

# Storage sintético: anidado, binario, vacío, con espacios, uno grande, una carpeta
# vacía y los xattrs de storage-api en dos archivos.
SRC="${T}/storage"
mkdir -p "${SRC}/stub/client-docs/u1" "${SRC}/stub/receipt-photos" "${SRC}/stub/documents" "${SRC}/stub/vacia"
{ echo "${MARCA}"; openssl rand 4096; } > "${SRC}/stub/client-docs/u1/cedula-${NOMBRE}.jpg"
{ echo "${MARCA}"; openssl rand 1000; } > "${SRC}/stub/receipt-photos/foto de recepción.png"
: > "${SRC}/stub/documents/vacio.pdf"
{ openssl rand 2097152; echo "${MARCA}"; } > "${SRC}/stub/documents/grande.bin"
echo "${MARCA}" > "${SRC}/stub/client-docs/u1/notas.txt"
if ! python3 - "${SRC}" "${NOMBRE}" <<'PY'
import os, sys
r, n = sys.argv[1], sys.argv[2]
for rel, tipo in ((f"stub/client-docs/u1/cedula-{n}.jpg", b"image/jpeg"), ("stub/receipt-photos/foto de recepción.png", b"image/png")):
    os.setxattr(os.path.join(r, rel), "user.supabase.content-type", tipo)
    os.setxattr(os.path.join(r, rel), "user.supabase.cache-control", b"max-age=3600")
PY
then
  ko "el directorio temporal no admite xattrs user.* (${T}): esta prueba no puede comprobar B1"; echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"; exit 1
fi
N_SRC="$(find "${SRC}" -type f | wc -l | tr -d ' ')"
# Comparación independiente de la lista del script: ruta, sha256 y xattrs user.*.
indep() {
  python3 -I - "$1" <<'PY'
import hashlib, os, sys
r = sys.argv[1]
for b, ds, fs in sorted(os.walk(r)):
    ds.sort()
    for f in sorted(fs):
        p = os.path.join(b, f)
        if not os.path.isfile(p):
            continue
        x = sorted((k, os.getxattr(p, k)) for k in os.listxattr(p) if k.startswith("user."))
        print(os.path.relpath(p, r), hashlib.sha256(open(p, "rb").read()).hexdigest(), x)
PY
}
indep "${SRC}" | grep -c "user.supabase.content-type" | grep -qx 2 && ok "el origen sintético tiene los xattrs de storage-api en 2 archivos" || ko "xattrs del origen"

BK="${S}/backup/storage-backup.sh"
RS="${S}/backup/storage-restore.sh"
# respaldar <script> <out> [opciones]: origen ${FUENTE:-SRC}; salida en ${T}/bk.log y código en ${rc}.
respaldar() {
  ESPIA_DIRS="$2 ${T}/shm ${T}/remoto" bash "$1" --project zzst --source "${FUENTE:-${SRC}}" --remote "${REMOTO:-zz:bucket/storage}" \
    --age-recipients "${T}/rec" --out "$2" --work-dir "${T}/shm" --rclone-config "${T}/rc" "${@:3}" > "${T}/bk.log" 2>&1
  rc=$?
}
ultima_base() { basename "$(ls "$1"/zzst/storage/*.manifiesto 2>/dev/null | sort | tail -n1)" .manifiesto; }

# ── Contratos: cada uno sale 0 si se cumple. Los mutantes los tienen que romper. ──
# C1 · el respaldo deja solo cifrados y un manifiesto sin rutas; nada en claro en disco.
contrato_sin_claro() { # <script de respaldo> <out>
  : > "${ESPIA_LOG}"; respaldar "$1" "$2"; [ "${rc}" = 0 ] || return 1
  [ ! -s "${ESPIA_LOG}" ] || return 1
  ! grep -rqsF -D skip -e "${MARCA}" -e "${NOMBRE}" "$2" "${T}/shm" "${T}/remoto" || return 1
  [ -z "$(ls -A "${T}/shm")" ] || return 1
  [ -z "$(find "$2" -type f ! -name '*.age' ! -name '*.manifiesto' ! -name '*.referencia')" ]
}
# C2 · la restauración devuelve los mismos archivos, con los mismos sha256 y xattrs user.*, que el origen.
contrato_restaura() { # <script de respaldo> <script de restore> <out>
  respaldar "$1" "$3"; [ "${rc}" = 0 ] || return 1
  local b d; b="$(ultima_base "$3")"; d="${T}/restaurado-$RANDOM"
  bash "$2" --dir "${T}/remoto/bucket/storage/zzst" --base "${b}" --age-identity "${T}/id" --destino "${d}" --work-dir "${T}/shm" > "${T}/rs.log" 2>&1 || return 1
  ! grep -qF "${NOMBRE}" "${T}/rs.log" || return 1
  [ "$(indep "${SRC}")" = "$(indep "${d}")" ] && diff -r "${SRC}" "${d}" > /dev/null
}
# C3 · un cifrado dañado se detecta por su sha256 ANTES de descifrar.
contrato_sha_antes() { # <script de restore> <carpeta con el respaldo> <base>
  local c="${T}/danado-$RANDOM"; mkdir -p "${c}"; cp "$2/$3".* "$2/$3"-lista.age "${c}/"
  printf 'x' | dd of="${c}/$3.tar.age" bs=1 seek=200 conv=notrunc 2>/dev/null
  bash "$1" --dir "${c}" --base "$3" --age-identity "${T}/id" --verificar --work-dir "${T}/shm" > "${T}/rs.log" 2>&1
  [ $? = 1 ] && grep -q 'sha256 de los cifrados no coincide' "${T}/rs.log" && ! grep -q 'descifrado y tar' "${T}/rs.log"
}
# C4 · backup.sh respalda el Storage del proyecto (la carpeta de DTD_DATA_DIR) y lo sube.
P="${T}/proyecto"
mkdir -p "${P}/data"; cp -a "${SRC}" "${P}/data/storage"
for s in pg-dump-to-s3.sh config-backup.sh; do printf '#!/usr/bin/env bash\nexit 0\n' > "${T}/ops/backup/${s}"; done
cp "${S}/lib/storage-lista.py" "${T}/ops/lib/"
cat > "${P}/.env" <<EOF
PROYECTO=zzst
OPS_DIR=${T}/ops
POSTGRES_PASSWORD='clave-de-prueba'
BACKUP_HEARTBEAT_URL=
BACKUP_DIR=${T}/out-integ
RCLONE_CONFIG_DIR=${T}/rc
BACKUP_AGE_RECIPIENTS_FILE=${T}/rec
BACKUP_STORAGE_RCLONE_REMOTE=zz:bucket/integ
EOF
contrato_backup_sh() { # <backup.sh> <storage-backup.sh>
  cp "$1" "${P}/backup.sh"; cp "$2" "${T}/ops/backup/storage-backup.sh"; chmod 700 "${P}/backup.sh" "${T}/ops/backup/"*
  rm -rf "${T}/remoto/bucket/integ" "${T}/out-integ"
  bash "${P}/backup.sh" > "${T}/integ.log" 2>&1 || return 1
  grep -q 'RESULTADO: PASÓ' "${T}/integ.log" || return 1
  local m; m="$(ls "${T}"/remoto/bucket/integ/zzst/zzst-storage-*.manifiesto 2>/dev/null | head -n1)"
  [ -n "${m}" ] && grep -qx "archivos=${N_SRC}" "${m}" && ls "${T}"/remoto/bucket/integ/zzst/zzst-storage-*.tar.age > /dev/null 2>&1
}
# C5 · los avisos de tar (que nombran archivos) no llegan al log: solo su conteo.
SRC_SOCK="${T}/storage-socket"
cp -a "${SRC}" "${SRC_SOCK}"
python3 -c 'import socket, sys; s = socket.socket(socket.AF_UNIX); s.bind(sys.argv[1])' "${SRC_SOCK}/stub/documents/aviso-${NOMBRE}.sock"
contrato_log_sin_rutas() { # <script de respaldo> <out>
  FUENTE="${SRC_SOCK}" REMOTO=zz:bucket/socket respaldar "$1" "$2"; [ "${rc}" = 0 ] || return 1
  grep -q 'AVISO: tar escribió [1-9]' "${T}/bk.log" && ! grep -qF "${NOMBRE}" "${T}/bk.log"
}
# C6 · un borrado masivo no se lleva los respaldos buenos: se sube, no hay retención y sale 1, cada día,
# hasta que se acepte con --aceptar-caida=<conteo exacto>; esa corrida retiene antes el último bueno.
SRC_POCO="${T}/storage-poco"
mkdir -p "${SRC_POCO}/stub"; cp -a "${SRC}/stub/documents" "${SRC_POCO}/stub/"
contrato_guarda() { # <script de respaldo>
  local o="${T}/out-g-$RANDOM" ref llam g b1 retl retr
  ref="${o}/zzst/storage/zzst-storage.referencia"; g="guarda-$RANDOM"
  retl="${o}/zzst/storage-retenido"; retr="${T}/remoto/bucket/${g}/zzst-retenido"
  REMOTO="zz:bucket/${g}" respaldar "$1" "${o}" --keep-local 1; [ "${rc}" = 0 ] && grep -qx "archivos=${N_SRC}" "${ref}" || return 1
  b1="$(ultima_base "${o}")"; grep -qx "base=${b1}" "${ref}" || return 1
  for vuelta in 1 2; do
    sleep 1; llam="$(wc -l < "${T}/remoto/.llamadas")"
    FUENTE="${SRC_POCO}" REMOTO="zz:bucket/${g}" respaldar "$1" "${o}" --keep-local 1
    [ "${rc}" = 1 ] && grep -q "cayó de ${N_SRC} a 2 archivos" "${T}/bk.log" || return 1
    [ "$(ls "${T}"/remoto/bucket/${g}/zzst/*.manifiesto | wc -l)" = $((vuelta + 1)) ] || return 1   # se subió igual
    ! tail -n "+$((llam + 1))" "${T}/remoto/.llamadas" | grep -q '^delete' || return 1               # sin retención remota
    [ "$(ls "${o}"/zzst/storage/*.manifiesto | wc -l)" = $((vuelta + 1)) ] || return 1               # ni local
    grep -qx "archivos=${N_SRC}" "${ref}" || return 1                                                 # referencia intacta
  done
  # Sin conteo, se niega; con un conteo que no es el real, no acepta ni borra.
  FUENTE="${SRC_POCO}" REMOTO="zz:bucket/${g}" respaldar "$1" "${o}" --aceptar-caida
  [ "${rc}" = 2 ] && grep -q 'exige el conteo esperado' "${T}/bk.log" || return 1
  sleep 1; llam="$(wc -l < "${T}/remoto/.llamadas")"
  FUENTE="${SRC_POCO}" REMOTO="zz:bucket/${g}" respaldar "$1" "${o}" --keep-local 1 --aceptar-caida=3
  [ "${rc}" = 1 ] && grep -q 'no coincide con los 2 archivos' "${T}/bk.log" && grep -qx "archivos=${N_SRC}" "${ref}" || return 1
  ! tail -n "+$((llam + 1))" "${T}/remoto/.llamadas" | grep -q '^delete' || return 1
  # Aceptada: el último bueno queda fuera del alcance de la retención, en disco y en el remoto.
  sleep 1; FUENTE="${SRC_POCO}" REMOTO="zz:bucket/${g}" respaldar "$1" "${o}" --keep-local 1 --aceptar-caida=2
  [ "${rc}" = 0 ] && grep -qx "archivos=2" "${ref}" && [ "$(ls "${o}"/zzst/storage/*.manifiesto | wc -l)" = 1 ] || return 1
  for f in "${b1}.tar.age" "${b1}-lista.age" "${b1}.manifiesto"; do
    [ -f "${retl}/${f}" ] && [ -f "${retr}/${f}" ] || return 1
  done
  cmp -s "${retl}/${b1}.tar.age" "${retr}/${b1}.tar.age"
}
# C7 · la guarda falla cerrada: una referencia ilegible o vacía frena la retención; sin
# referencia, manda el MÁXIMO de los manifiestos locales, no el más nuevo.
contrato_guarda_cerrada() { # <script de respaldo>
  local o="${T}/out-c-$RANDOM" ref llam g
  ref="${o}/zzst/storage/zzst-storage.referencia"; g="cerrada-$RANDOM"
  REMOTO="zz:bucket/${g}" respaldar "$1" "${o}"; [ "${rc}" = 0 ] || return 1
  for basura in 'basura' 'archivos='; do
    printf '%s\n' "${basura}" > "${ref}"
    sleep 1; llam="$(wc -l < "${T}/remoto/.llamadas")"
    REMOTO="zz:bucket/${g}" respaldar "$1" "${o}"
    [ "${rc}" = 1 ] && grep -q 'no se puede leer' "${T}/bk.log" || return 1
    ! tail -n "+$((llam + 1))" "${T}/remoto/.llamadas" | grep -q '^delete' || return 1
  done
  rm -f "${ref}"
  for vuelta in 1 2; do
    sleep 1; FUENTE="${SRC_POCO}" REMOTO="zz:bucket/${g}" respaldar "$1" "${o}"
    [ "${rc}" = 1 ] && grep -q "cayó de ${N_SRC} a 2 archivos" "${T}/bk.log" || return 1
  done
}

echo; echo "== M0 · scripts sin mutar =="
contrato_sin_claro "${BK}" "${T}/out" && ok "C1 · solo .age y manifiesto; ni la marca ni el nombre en disco, remoto ni /dev/shm; el espía no vio claros" \
  || { ko "C1 sin claro (rc=${rc})"; tail -5 "${T}/bk.log"; cat "${ESPIA_LOG}"; }
B="$(ultima_base "${T}/out")"
M="${T}/out/zzst/storage/${B}.manifiesto"
grep -qx "archivos=${N_SRC}" "${M}" && grep -qx "archivos_en_disco=${N_SRC}" "${M}" && grep -qx "bytes=$(find "${SRC}" -type f -printf '%s\n' | awk '{s+=$1} END {print s}')" "${M}" \
  && ok "el manifiesto cuenta ${N_SRC} archivos y sus bytes" || { ko "manifiesto"; cat "${M}"; }
[ "$(grep -cE '^[0-9a-f]{64}  zzst-storage-' "${M}")" = 2 ] && grep -qE '^flujo_sha256=[0-9a-f]{64}$' "${M}" \
  && ok "el manifiesto trae la huella del flujo y el sha256 de los dos cifrados" || ko "huellas del manifiesto"
[ -f "${T}/remoto/bucket/storage/zzst/${B}.tar.age" ] && [ -f "${T}/remoto/bucket/storage/zzst/${B}-lista.age" ] && [ -f "${T}/remoto/bucket/storage/zzst/${B}.manifiesto" ] \
  && ok "los tres archivos llegan a <remoto>/zzst/" || ko "subida al remoto"
grep -q '^check .* --one-way --include /zzst-storage-' "${T}/remoto/.llamadas" && grep -q '^delete --min-age 30d zz:bucket/storage/zzst/$' "${T}/remoto/.llamadas" \
  && ! grep -q '^sync' "${T}/remoto/.llamadas" && ok "rclone: copy + check, retención acotada a zz:bucket/storage/zzst/ y nunca sync" || { ko "llamadas a rclone"; cat "${T}/remoto/.llamadas"; }
"${T}/bin/age" -d -i "${T}/id" < "${T}/out/zzst/storage/${B}-lista.age" > "${T}/shm/l"
[ "$(grep -cE '^[0-9a-f]{64} [0-9]+ [0-9a-f]{64} \./' "${T}/shm/l")" = 2 ] && [ "$(grep -cE '^[0-9a-f]{64} [0-9]+ - \./' "${T}/shm/l")" = 3 ] \
  && ! grep -q 'image/' "${T}/shm/l" && ok "la lista cifrada lleva la huella de xattrs de los 2 archivos que los tienen, sin sus valores" || { ko "lista con xattrs"; }
rm -f "${T}/shm/l"

bash "${RS}" --dir "${T}/remoto/bucket/storage/zzst" --age-identity "${T}/id" --verificar --work-dir "${T}/shm" > "${T}/rs.log" 2>&1
[ $? = 0 ] && [ "$(grep -c '^PASÓ' "${T}/rs.log")" = 5 ] && [ -z "$(ls -A "${T}/shm")" ] && ! grep -qF "${NOMBRE}" "${T}/rs.log" \
  && ok "--verificar: 5 comprobaciones PASÓ sin escribir archivos, sin rutas en la salida y sin restos en /dev/shm" || { ko "--verificar"; cat "${T}/rs.log"; }
(cd "${T}" && bash "${RS}" --dir remoto/bucket/storage/zzst --age-identity id --verificar --work-dir "${T}/shm" > "${T}/rs.log" 2>&1)
[ $? = 0 ] && ok "--verificar con --dir y --age-identity relativos" || { ko "rutas relativas"; cat "${T}/rs.log"; }
contrato_restaura "${BK}" "${RS}" "${T}/out" && ok "C2 · --destino devuelve los mismos ${N_SRC} archivos, sha256, xattrs user.* y carpetas que el origen" || { ko "C2 restaura"; cat "${T}/rs.log"; }
contrato_sha_antes "${RS}" "${T}/out/zzst/storage" "${B}" && ok "C3 · un byte cambiado en el .tar.age: FALLÓ por sha256 antes de descifrar" || { ko "C3 sha antes"; cat "${T}/rs.log"; }
cp "${T}/rec" "${T}/otra"; sed -i 's/age1pruebadoble/age1pruebaotra/' "${T}/otra"
bash "${RS}" --dir "${T}/out/zzst/storage" --base "${B}" --age-identity "${T}/otra" --verificar --work-dir "${T}/shm" > "${T}/rs.log" 2>&1
[ $? = 1 ] && grep -q 'no se pudo descifrar la lista' "${T}/rs.log" && ok "con otra llave: FALLÓ sin descifrar nada" || { ko "otra llave"; cat "${T}/rs.log"; }
mkdir -p "${T}/ocupada"; touch "${T}/ocupada/algo"
bash "${RS}" --dir "${T}/out/zzst/storage" --age-identity "${T}/id" --destino "${T}/ocupada" > "${T}/rs.log" 2>&1
[ $? = 2 ] && grep -q 'no está vacía' "${T}/rs.log" && ok "--destino ocupado: se niega (2) y no escribe encima" || ko "destino ocupado"
contrato_log_sin_rutas "${BK}" "${T}/out-sock" && ok "C5 · un aviso de tar que nombra un archivo: el log dice cuántos, no la ruta" || { ko "C5 log sin rutas"; cat "${T}/bk.log"; }
contrato_guarda "${BK}" && ok "C6 · caída de ${N_SRC} a 2: sube, sin retención, sale 1 dos días seguidos; --aceptar-caida sin conteo o con otro no acepta; con =2 retiene el último bueno y acepta" || { ko "C6 guarda"; cat "${T}/bk.log"; }
contrato_guarda_cerrada "${BK}" && ok "C7 · referencia ilegible o vacía: sale 1 sin retención; sin referencia, compara contra el máximo de los manifiestos" || { ko "C7 guarda cerrada"; cat "${T}/bk.log"; }
mkdir -p /run/lock 2>/dev/null
contrato_backup_sh "${R}/infra/dtd-cargo/backup.sh" "${BK}" && ok "C4 · backup.sh respalda data/storage del proyecto y lo sube a BACKUP_STORAGE_RCLONE_REMOTE" \
  || { ko "C4 backup.sh"; tail -8 "${T}/integ.log"; }
rm -rf "${P}/data/storage"
bash "${P}/backup.sh" > "${T}/integ.log" 2>&1
[ $? = 1 ] && grep -q 'storage-backup.sh salió 2' "${T}/integ.log" && grep -q 'RESULTADO: FALLÓ' "${T}/integ.log" \
  && ok "backup.sh sin la carpeta del Storage: FALLÓ (no late)" || { ko "backup.sh sin storage"; tail -4 "${T}/integ.log"; }
cp -a "${SRC}" "${P}/data/storage"   # los mutantes corren con el mismo origen que M0

echo; echo "== validaciones del respaldo =="
mkdir -p "${T}/vacio"
bash "${BK}" --project zzst --source "${T}/vacio" --remote zz:bucket/storage --age-recipients "${T}/rec" --out "${T}/out-v" --work-dir "${T}/shm" > "${T}/v.log" 2>&1
[ $? = 2 ] && grep -q 'tiene 0 archivos' "${T}/v.log" && [ ! -e "${T}/out-v" ] && ok "Storage vacío (carpeta equivocada): se niega sin escribir" || { ko "vacío"; cat "${T}/v.log"; }
printf 'AGE-SECRET-KEY-1XXXX\n' > "${T}/priv"
bash "${BK}" --project zzst --source "${SRC}" --remote zz:bucket/storage --age-recipients "${T}/priv" --out "${T}/out-v" > "${T}/v.log" 2>&1
[ $? = 2 ] && grep -q 'clave PRIVADA' "${T}/v.log" && ok "destinatarios con una clave privada: se niega" || ko "clave privada"
bash "${BK}" --project zzst --source "${SRC}" --remote zz:bucket --age-recipients "${T}/rec" --out "${T}/out-v" > "${T}/v.log" 2>&1
[ $? = 2 ] && grep -q 'nunca la raíz del bucket' "${T}/v.log" && ok "remoto sin prefijo: se niega (la retención nunca corre en la raíz)" || ko "remoto sin prefijo"
respaldar "${BK}" "${T}/out-v" --dry-run
[ "${rc}" = 0 ] && grep -q "dry-run: ${N_SRC} archivos" "${T}/bk.log" && [ ! -e "${T}/out-v" ] && ok "--dry-run cuenta los archivos y no escribe nada" || { ko "dry-run"; cat "${T}/bk.log"; }
for i in 1 2 3; do sleep 1; respaldar "${BK}" "${T}/out-ret"; done
r="${T}/out-ret/zzst/storage"
[ "$(ls "${r}"/*.manifiesto | wc -l)" = 2 ] && [ "$(ls "${r}"/*.tar.age | wc -l)" = 2 ] && [ "$(ls "${r}"/*-lista.age | wc -l)" = 2 ] \
  && ok "tres respaldos: en disco local quedan los 2 más nuevos, con su lista" || { ko "retención local"; ls "${r}"; }

if [ -x /usr/bin/age ] && command -v age-keygen > /dev/null 2>&1; then
  echo; echo "== con age real =="
  age-keygen -o "${T}/shm/k.txt" 2> /dev/null; age-keygen -y "${T}/shm/k.txt" > "${T}/rec-real"
  AGE_BIN=/usr/bin/age bash "${BK}" --project zzst --source "${SRC}" --remote zz:bucket/real --age-recipients "${T}/rec-real" --out "${T}/out-real" --work-dir "${T}/shm" > "${T}/bk.log" 2>&1 \
    && AGE_BIN=/usr/bin/age bash "${RS}" --dir "${T}/remoto/bucket/real/zzst" --age-identity "${T}/shm/k.txt" --verificar > "${T}/rs.log" 2>&1 \
    && ok "ida y vuelta con age real: --verificar PASÓ" || { ko "age real"; tail -5 "${T}/bk.log" "${T}/rs.log"; }
  rm -f "${T}/shm/k.txt"
else
  echo "age real no está instalado: la ida y vuelta corre solo con el doble"
fi

echo; echo "== mutantes: cada uno tiene que caer =="
mkdir -p "${T}/mut"
mutar() { # <nombre> <original> <expresión sed> → ruta de la copia; exige que sed cambie algo
  local c="${T}/mut/$1-$(basename "$2")"
  sed "$3" "$2" > "${c}"; chmod 700 "${c}"
  if cmp -s "$2" "${c}"; then echo ""; else echo "${c}"; fi
}
detectado() { # <nombre> <descripción> <comando de contrato…>
  local n="$1" d="$2"; shift 2
  if "$@"; then ko "${n} NO detectado: ${d}"; else ok "${n} detectado: ${d}"; fi
}
# Base limpia: el mismo contrato, con los mismos argumentos y los scripts sin
# mutar, tiene que pasar justo antes. Si no, el mutante «cae» por otra razón.
limpio() { local n="$1"; shift; if "$@"; then ok "${n} · base limpia: el contrato pasa sin mutar"; else ko "${n} · base sucia: el contrato no pasa ni sin mutar"; fi; }
# Los mutantes viven en ${T}/mut y sacan la lista de ${T}/mut/../lib.
mkdir -p "${T}/lib"; cp "${S}/lib/storage-lista.py" "${T}/lib/"
m="$(mutar M1 "${R}/infra/dtd-cargo/backup.sh" '/^"${storage_script}" \\$/,/storage-backup.sh salió/d')"
limpio M1 contrato_backup_sh "${R}/infra/dtd-cargo/backup.sh" "${BK}"
[ -n "${m}" ] && detectado M1 "backup.sh sin el paso del Storage" contrato_backup_sh "${m}" "${BK}" || ko "M1: sed no cambió nada"
m="$(mutar M2 "${BK}" 's#| "${AGE_BIN}" -R "${AGE_RECIPIENTS}" > "${tar_age}.part"#> "${dir}/claro.tar"; "${AGE_BIN}" -R "${AGE_RECIPIENTS}" < "${dir}/claro.tar" > "${tar_age}.part"; rm -f "${dir}/claro.tar"#')"
limpio M2 contrato_sin_claro "${BK}" "${T}/out-m2"
[ -n "${m}" ] && detectado M2 "el tar pasa por disco en claro antes de cifrarse (y se borra)" contrato_sin_claro "${m}" "${T}/out-m2" || ko "M2: sed no cambió nada"
m="$(mutar M3 "${BK}" 's#--numeric-owner -cf - \.#--numeric-owner --exclude=./stub/client-docs -cf - .#')"
limpio M3 contrato_restaura "${BK}" "${RS}" "${T}/out-m3"
[ -n "${m}" ] && detectado M3 "el tar deja fuera una carpeta del Storage" contrato_restaura "${m}" "${RS}" "${T}/out-m3" || ko "M3: sed no cambió nada"
m="$(mutar M4 "${RS}" 's#sha256sum -c --quiet --status#cat#')"
limpio M4 contrato_sha_antes "${RS}" "${T}/out/zzst/storage" "${B}"
[ -n "${m}" ] && detectado M4 "el restore no compara el sha256 de los cifrados" contrato_sha_antes "${m}" "${T}/out/zzst/storage" "${B}" || ko "M4: sed no cambió nada"
m="$(mutar M5 "${RS}" 's#if cmp -s "${work}/lista-respaldo" "${work}/lista-flujo"; then#if true; then#')"
if [ -n "${m}" ]; then
  # Respaldos cuya lista miente: uno con un archivo de menos, otro con la huella de xattrs cambiada.
  adulterar() { # <carpeta> <filtro sed sobre la lista>
    mkdir -p "$1"; cp "${T}/out/zzst/storage/${B}".* "${T}/out/zzst/storage/${B}-lista.age" "$1/"
    "${T}/bin/age" -d -i "${T}/id" < "$1/${B}-lista.age" | sed "$2" | "${T}/bin/age" -R "${T}/rec" > "$1/l"
    mv "$1/l" "$1/${B}-lista.age"
    sed -i "/  ${B}-lista.age\$/d" "$1/${B}.manifiesto"; printf '%s  %s\n' "$(sha256sum < "$1/${B}-lista.age" | cut -c1-64)" "${B}-lista.age" >> "$1/${B}.manifiesto"
  }
  adulterar "${T}/m5" '/notas\.txt$/d'
  adulterar "${T}/m5x" 's/^\([0-9a-f]\{64\} [0-9]* \)[0-9a-f]\{64\} \(.*cedula-\)/\10000000000000000000000000000000000000000000000000000000000000000 \2/'
  lista_cae() { bash "$1" --dir "$2" --base "${B}" --age-identity "${T}/id" --verificar --work-dir "${T}/shm" > "${T}/rs.log" 2>&1; [ $? = 1 ] && grep -q 'no coincide con la lista' "${T}/rs.log"; }
  lista_cae "${RS}" "${T}/m5" && ok "una lista con un archivo de menos: FALLÓ" || { ko "lista distinta"; cat "${T}/rs.log"; }
  lista_cae "${RS}" "${T}/m5x" && ok "una lista con otros xattrs para un archivo: --verificar FALLÓ" || { ko "xattrs distintos"; cat "${T}/rs.log"; }
  detectado M5 "el restore no compara la lista por archivo" lista_cae "${m}" "${T}/m5"
else ko "M5: sed no cambió nada"; fi
m="$(mutar M6a "${BK}" "s#--format=posix --xattrs --xattrs-include=.user\.\*. ##")"
limpio M6a contrato_restaura "${BK}" "${RS}" "${T}/out-m6a"
[ -n "${m}" ] && detectado M6a "el respaldo sin --xattrs (pierde Content-Type y Cache-Control)" contrato_restaura "${m}" "${RS}" "${T}/out-m6a" || ko "M6a: sed no cambió nada"
m="$(mutar M6b "${RS}" "s#--xattrs --xattrs-include=.user\.\*. ##")"
limpio M6b contrato_restaura "${BK}" "${RS}" "${T}/out-m6b"
[ -n "${m}" ] && detectado M6b "el restore sin --xattrs" contrato_restaura "${BK}" "${m}" "${T}/out-m6b" || ko "M6b: sed no cambió nada"
m="$(mutar M7 "${BK}" 's# 2> "${work}/tar.err" | tee# | tee#')"
limpio M7 contrato_log_sin_rutas "${BK}" "${T}/out-m7"
[ -n "${m}" ] && detectado M7 "los avisos de tar van al log con sus rutas" contrato_log_sin_rutas "${m}" "${T}/out-m7" || ko "M7: sed no cambió nada"
m="$(mutar M8 "${BK}" 's#(( archivos \* 100 < previo \* MIN_PCT ))#false#')"
limpio M8 contrato_guarda "${BK}"
[ -n "${m}" ] && detectado M8 "sin la guarda contra un borrado masivo" contrato_guarda "${m}" || ko "M8: sed no cambió nada"

m="$(mutar M9 "${BK}" 's#    ilegible=1; previo=""; bueno=""#    ilegible=0; previo=""; bueno=""#')"
limpio M9 contrato_guarda_cerrada "${BK}"
[ -n "${m}" ] && detectado M9 "una referencia ilegible no frena la retención" contrato_guarda_cerrada "${m}" || ko "M9: sed no cambió nada"
m="$(mutar M10 "${BK}" 's#| sort -n | tail -n1 || true#| sort -n | head -n1 || true#')"
limpio M10 contrato_guarda_cerrada "${BK}"
[ -n "${m}" ] && detectado M10 "sin referencia, compara contra el mínimo (el de después de la caída)" contrato_guarda_cerrada "${m}" || ko "M10: sed no cambió nada"
m="$(mutar M11 "${BK}" 's#if \[\[ "${bueno}" =~ ${patron_base} \]\]; then#if false; then#')"
limpio M11 contrato_guarda "${BK}"
[ -n "${m}" ] && detectado M11 "--aceptar-caida aplica la retención sin retener el último respaldo bueno" contrato_guarda "${m}" || ko "M11: sed no cambió nada"

echo; echo "RESULTADO: ${pass} PASÓ · ${fail} FALLÓ"
[ "${fail}" = 0 ]
