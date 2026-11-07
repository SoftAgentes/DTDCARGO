#!/usr/bin/env bash
# infra/ops/kommo-historial/pruebas/prueba-ensayo.sh — prueba de ensayo-archivo.sh (SDD-0590 5.6) contra una
# «producción» SIMULADA con datos inventados: el compose real de infra/chatwoot levantado como proyecto
# `chatwoot` (contenedores chatwoot-postgres-1 y chatwoot-redis-1, redes chatwoot_*), como en el VPS.
# Corre en GitHub Actions (kommo-historial-cargador.yml). Nunca en el VPS: si encuentra un Chatwoot real, se niega.
#
#   N1  con /dev/shm/cw-ensayo ya existente, el ensayo se niega y no la borra
#   N2  si el proyecto de producción se llamara como el del ensayo, se niega sin crear nada
#   N3  con la carga del equipo por encima del tope, se para antes de crear nada
#   N4  el borrado de otras cuentas (ensayo-otras-cuentas.sql) apuntado a la «producción» simulada, sin la marca de
#       la copia, se niega antes de leer o borrar nada; producción conserva sus 2 cuentas
#   N5  con un contenedor ajeno llamado chatwoot-ensayo-postgres-1, se niega y no lo toca
#   N6  con MemAvailable por debajo de lo que pide el ensayo (inyectado), no arranca y no crea nada
#   T1  `systemctl stop` con un runner del ensayo corriendo (TERM a toda la unidad, como vigia-carga.sh): la unidad
#       termina en Result=exit-code con 143, la evidencia dice senal=TERM y ensayo_codigo=143, y no queda nada
#   T2  TERM solo al proceso principal (como el vigía del ensayo del 2026-11-07): lo mismo
#   T3  con un contenedor ajeno conectado a la red del ensayo: la limpieza no lo toca, dice que no terminó
#       (limpieza_completa=no, FALLÓ L0) y no sale con 0; `--limpiar` tampoco, hasta que el ajeno se va
#   ME1–ME3 mutantes del guion: cada uno tiene que tumbar su comprobación T y dejar pasar la otra
#   R   el ensayo entero pasa contra la producción simulada, con 650 conversaciones de relleno (--relleno)
#   R4  la búsqueda por el número de la más vieja trae más de 600 resultados (más de 40 páginas de 15, como con los
#       datos reales del 2026-11-07) y aun así la encuentran
#   R5  BQ1 busca el tercer mensaje más viejo: el primero no tiene palabras de 6 letras y el segundo solo una con
#       más de 60 coincidencias
#   P   la producción simulada queda intacta: sin «Archivo Kommo», mismas bandejas y conversaciones (huella),
#       contenedores corriendo
#   L   no queda nada del ensayo (contenedores, volúmenes, redes, carpeta) y --limpiar no rompe nada
#   L3  con docker caído, --limpiar no cuenta 0: sale con 4 y dice que no pudo comprobar la limpieza
#   F   la evidencia solo trae líneas HECHO y ningún valor inventado de personas
#
# Uso:  bash infra/ops/kommo-historial/pruebas/prueba-ensayo.sh
set -uo pipefail
export MSYS_NO_PATHCONV=1

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KH="$(cd "$AQUI/.." && pwd)"
CW="$(cd "$KH/../../chatwoot" && pwd)"
PY="${PYTHON:-python3}"
FALLAS=0
log() { echo "$*"; }
ok() { log "PASÓ  $1 — $2"; }
mal() { log "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
exigir() { if eval "$2"; then ok "$1" "$3"; else mal "$1" "$3"; fi; return 0; }

[ "$(uname -s)" = Linux ] || { echo "solo en Linux (usa /dev/shm y el proyecto «chatwoot»)"; exit 2; }
if docker ps -a --format '{{.Names}}' | grep -qxE 'chatwoot-(postgres|rails|redis)-1'; then
  echo "hay contenedores chatwoot-* en este equipo: esta prueba no corre aquí"; exit 2
fi
if [ -e /dev/shm/cw-ensayo ]; then echo "/dev/shm/cw-ensayo ya existe: esta prueba no corre aquí"; exit 2; fi

TRABAJO="$(mktemp -d "${TMPDIR:-/tmp}/cw-ensayo-prueba.XXXXXX")"
S="$(mktemp -d /dev/shm/cw-ensayo-prueba-staging.XXXXXX)"
D="$TRABAJO/prod"
EDGE="chatwoot_edge_prueba"
UNIDADES=()
INTRUSO=cw-prueba-intruso
REDIS_IMG="redis:7.2.11-alpine@sha256:1a34bdba051ecd8a58ec8a3cc460acef697a1605e918149cc53d920673c1a0a7"
dc() { (cd "$D" && docker compose -p chatwoot "$@"); }
# Lo que una corrida T (o un mutante) haya dejado: solo lo del proyecto del ensayo, su carpeta y el ajeno de T3.
restos_fuera() {
  docker rm -f "$INTRUSO" >/dev/null 2>&1
  docker ps -aq --filter label=com.docker.compose.project=chatwoot-ensayo | xargs -r docker rm -f -v >/dev/null 2>&1
  docker network ls -q --filter label=com.docker.compose.project=chatwoot-ensayo | xargs -r docker network rm >/dev/null 2>&1
  docker volume ls -q --filter label=com.docker.compose.project=chatwoot-ensayo | xargs -r docker volume rm >/dev/null 2>&1
  [ -e /dev/shm/cw-ensayo ] && sudo -n rm -rf -- /dev/shm/cw-ensayo
  return 0
}
bajar() {
  local u
  for u in "${UNIDADES[@]}"; do
    sudo -n systemctl stop "$u" >/dev/null 2>&1
    sudo -n systemctl reset-failed "$u" >/dev/null 2>&1
  done
  [ "${#UNIDADES[@]}" -gt 0 ] && restos_fuera
  # El contenedor ajeno de N5, si quedó: solo el que lleva la etiqueta de la prueba.
  [ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' chatwoot-ensayo-postgres-1 2>/dev/null)" = otro ] \
    && docker rm -f chatwoot-ensayo-postgres-1 >/dev/null 2>&1
  [ -f "$D/compose.yml" ] && dc down -v --remove-orphans >/dev/null 2>&1
  docker network rm "$EDGE" >/dev/null 2>&1
  case "$S" in /dev/shm/cw-ensayo-prueba-staging.*) rm -rf -- "$S" ;; esac
  return 0
}
trap bajar EXIT
psql_prod() { docker exec chatwoot-postgres-1 psql -U chatwoot -d chatwoot_production -At -c "$1"; }

log "== prueba del ensayo · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"

# ── Datos inventados y archivo de carga con el extractor real ────────────────
# Con relleno: 650 conversaciones más, para la búsqueda por número a la escala real, y los dos mensajes más viejos
# sin palabra apta para BQ1 (generar-sintetico.py).
"$PY" -I "$AQUI/generar-sintetico.py" "$S" --relleno 650 >"$TRABAJO/generar.txt" 2>&1 \
  || { mal D0 "no se generaron los datos"; exit 1; }
"$PY" -I "$KH/respaldar-historial.py" vincular --staging "$S" --clientes "$S/clientes.ndjson" >"$TRABAJO/vincular.txt" 2>&1 \
  || { mal D0 "vincular falló"; cat "$TRABAJO/vincular.txt"; exit 1; }
"$PY" -I "$KH/respaldar-historial.py" preparar-carga --staging "$S" >"$TRABAJO/preparar.txt" 2>&1 \
  || { mal D0 "preparar-carga falló"; exit 1; }

# ── «Producción» simulada: el compose real como proyecto chatwoot ────────────
mkdir -p "$D/cargador" "$D/estado"
cp "$CW/compose.yml" "$D/"
cp -r "$CW/rails" "$CW/marca" "$CW/correo" "$D/"
cp "$CW/pruebas/compose.local.yml" "$D/compose.override.yml"
cp "$AQUI/compose.cargador.yml" "$D/"
cp "$AQUI/sonda-cargador.rb" "$D/cargador/"
cat >"$D/.env" <<EOF
CHATWOOT_HOST=chat.prueba.test
CHATWOOT_EDGE_NETWORK=$EDGE
CHATWOOT_TLS=false
CHATWOOT_FORCE_SSL=false
CHATWOOT_FRAME_ANCESTORS=https://studio.prueba.test
CHATWOOT_FRONTEND_URL=http://chat.prueba.test
CHATWOOT_SECRET_KEY_BASE=$(openssl rand -hex 64)
CHATWOOT_AR_ENCRYPTION_PRIMARY_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_DETERMINISTIC_KEY=$(openssl rand -hex 16)
CHATWOOT_AR_ENCRYPTION_KEY_DERIVATION_SALT=$(openssl rand -hex 16)
CHATWOOT_POSTGRES_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_REDIS_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_MAILER_SENDER_EMAIL=prueba@example.test
CHATWOOT_SMTP_ADDRESS=mailpit
CHATWOOT_SMTP_PORT=1025
EOF
docker network create "$EDGE" >/dev/null || { mal P0 "no se pudo crear la red $EDGE"; exit 1; }
BASE=(-f compose.yml -f compose.override.yml -f compose.cargador.yml)
dc "${BASE[@]}" up -d --wait postgres redis >"$TRABAJO/up.txt" 2>&1 || { mal P0 "la producción simulada no arrancó"; tail -n 30 "$TRABAJO/up.txt"; exit 1; }
dc "${BASE[@]}" run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1 </dev/null || { mal P0 "db:chatwoot_prepare falló"; tail -n 40 "$TRABAJO/prepare.txt"; exit 1; }
dc "${BASE[@]}" run --rm -T -e FASE=preparar prepare bundle exec rails runner /tmp/cargador/sonda-cargador.rb \
  >"$TRABAJO/sembrar.txt" 2>&1 </dev/null
CUENTA="$(sed -n 's/^HECHO cuenta=//p' "$TRABAJO/sembrar.txt" | tail -n 1)"
# Una segunda cuenta, como la cuenta de prueba de producción: el ensayo la tiene que sacar de la COPIA.
dc "${BASE[@]}" run --rm -T -e FASE=preparar -e ESTADO=/tmp/estado/otra.json prepare bundle exec rails runner \
  /tmp/cargador/sonda-cargador.rb >"$TRABAJO/sembrar-2.txt" 2>&1 </dev/null
OTRA="$(sed -n 's/^HECHO cuenta=//p' "$TRABAJO/sembrar-2.txt" | tail -n 1)"
exigir P0 '[ -n "$CUENTA" ] && [ -n "$OTRA" ] && [ "$CUENTA" != "$OTRA" ]' \
  "producción simulada con dos cuentas ($CUENTA, la del ensayo, y $OTRA), cada una con bandeja viva, contactos y una conversación"
huella_prod() {
  psql_prod "select count(*) from accounts"
  psql_prod "select count(*) filter (where name = 'Archivo Kommo') || ',' || count(*) from inboxes"
  psql_prod "select md5(coalesce(string_agg(id::text || ':' || updated_at::text, ',' order by id), '')) || ',' || count(*) from conversations"
  psql_prod "select count(*) from messages"
}
ANTES="$(huella_prod | tr '\n' ' ')"

ensayo() { # salida → corre el ensayo con la carga inventada
  CARGA="$S/carga.ndjson" INFORME_CARGA="$S/carga-informe.json" INFORME_VINCULO="$S/vinculo-informe.json" STAGING="$S" \
    CUENTA="$CUENTA" CHATWOOT_DIR="$D" EVIDENCIA="$TRABAJO/evidencia-$1.txt" TOPE_CARGA="${TOPE:-32}" \
    bash "$KH/ensayo-archivo.sh" "${@:2}" >"$TRABAJO/ensayo-$1.txt" 2>&1
}
quedan() {
  echo "$(docker ps -aq --filter label=com.docker.compose.project=chatwoot-ensayo | wc -l)," \
       "$(docker volume ls -q --filter label=com.docker.compose.project=chatwoot-ensayo | wc -l)," \
       "$(docker network ls -q --filter label=com.docker.compose.project=chatwoot-ensayo | wc -l)" | tr -d ' '
}

# ── N. Las guardas se niegan ─────────────────────────────────────────────────
log "== N. guardas"
mkdir -m 700 /dev/shm/cw-ensayo && echo marca >/dev/shm/cw-ensayo/marca
ensayo n1; rc=$?
exigir N1 '[ "$rc" != 0 ] && [ -f /dev/shm/cw-ensayo/marca ] && [ "$(quedan)" = 0,0,0 ]' \
  "con /dev/shm/cw-ensayo ya existente se niega (código $rc) y no la borra ni crea nada"
rm -rf -- /dev/shm/cw-ensayo
PROD_PROYECTO=chatwoot-ensayo ensayo n2; rc=$?
exigir N2 '[ "$rc" != 0 ] && [ ! -e /dev/shm/cw-ensayo ] && [ "$(quedan)" = 0,0,0 ]' \
  "si producción se llamara chatwoot-ensayo, se niega (código $rc) sin crear nada"
TOPE=0 ensayo n3; rc=$?
exigir N3 '[ "$rc" = 3 ] && [ ! -e /dev/shm/cw-ensayo ] && [ "$(quedan)" = 0,0,0 ] && grep -q "FALLÓ CARGA" "$TRABAJO/ensayo-n3.txt"' \
  "con la carga por encima del tope se para (código $rc) antes de crear nada"
# N6: la guarda de memoria, con un /proc/meminfo inventado de 1.000 MB disponibles.
printf 'MemTotal:       24000000 kB\nMemAvailable:    1024000 kB\n' >"$TRABAJO/meminfo-poca"
ENSAYO_MEMINFO_DE="$TRABAJO/meminfo-poca" ensayo n6; rc=$?
exigir N6 '[ "$rc" = 3 ] && [ ! -e /dev/shm/cw-ensayo ] && [ "$(quedan)" = 0,0,0 ] && grep -q "FALLÓ MEM0 — MemAvailable 1000 MB no alcanza" "$TRABAJO/ensayo-n6.txt"' \
  "con MemAvailable de 1000 MB no arranca (código $rc), no crea nada y dice cuánto necesita"
# N4: el borrado de otras cuentas, el mismo SQL que usa el ensayo, apuntado a la «producción» simulada, que no
# tiene la marca. Tiene que negarse antes de leer o borrar nada.
docker exec -i chatwoot-postgres-1 psql -U chatwoot -d chatwoot_production -At -v ON_ERROR_STOP=1 \
  -v "cuenta=$CUENTA" -v "marca=$(openssl rand -hex 16)" <"$KH/ensayo-otras-cuentas.sql" >"$TRABAJO/n4.txt" 2>&1
rc=$?
exigir N4 '[ "$rc" != 0 ] && grep -q "sin la marca del ensayo" "$TRABAJO/n4.txt" && ! grep -q "^HECHO" "$TRABAJO/n4.txt" && [ "$(psql_prod "select count(*) from accounts")" = 2 ] && [ -z "$(psql_prod "select to_regclass('"'"'public._dtd_ensayo_marca'"'"')")" ]' \
  "el borrado apuntado a producción, sin la marca, se niega (código $rc), no imprime nada y deja las 2 cuentas"
# N5: un contenedor ajeno con el nombre del Postgres del ensayo. El ensayo se niega y no lo toca.
docker run -d --name chatwoot-ensayo-postgres-1 --label com.docker.compose.project=otro --network none \
  "redis:7.2.11-alpine@sha256:1a34bdba051ecd8a58ec8a3cc460acef697a1605e918149cc53d920673c1a0a7" >/dev/null
ensayo n5; rc=$?
exigir N5 '[ "$rc" != 0 ] && [ "$(docker inspect -f "{{.State.Status}}" chatwoot-ensayo-postgres-1 2>/dev/null)" = running ] && [ ! -e /dev/shm/cw-ensayo ] && [ "$(quedan)" = 0,0,0 ]' \
  "con un contenedor ajeno llamado chatwoot-ensayo-postgres-1, se niega (código $rc) y no lo toca"
[ "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' chatwoot-ensayo-postgres-1 2>/dev/null)" = otro ] \
  && docker rm -f chatwoot-ensayo-postgres-1 >/dev/null

# ── T. Una parada con TERM a mitad, y una limpieza que no puede terminar ─────
# Como en el VPS: el ensayo corre como root, en una unidad de systemd. `corrida` lanza el guion (el real o un
# mutante), espera a ver un runner del ensayo corriendo y lo para con TERM: a toda la unidad (`systemctl stop`, lo
# que hace vigia-carga.sh) o solo al proceso principal (lo que hizo el vigía del ensayo del 2026-11-07). Una unidad
# cuyo bash muere por la señal termina en Result=success, y systemd la descarga: así se vio el intento 3 del
# ensayo (SDD-0590 §10.16).
log "== T. parada y limpieza"
T_OK=1
if [ ! -d /run/systemd/system ] || ! sudo -n true 2>/dev/null; then
  mal T0 "hacen falta systemd y sudo sin clave (los tiene el runner de GitHub Actions)"
  T_OK=0
fi
U_ACTUAL=""
activa() {
  case "$(sudo -n systemctl is-active "$1" 2>/dev/null)" in active | activating | deactivating | reloading) return 0 ;; *) return 1 ;; esac
}
inactiva() { ! activa "$1"; }
vivo() {
  docker ps -q --filter label=com.docker.compose.project=chatwoot-ensayo --filter label=com.docker.compose.oneoff=True | grep -q .
}
para_parar() { vivo || inactiva "$U_ACTUAL"; }
red_lista() { docker network inspect chatwoot-ensayo_aislada >/dev/null 2>&1; }
esperar() { # segundos comando...: hasta que el comando se cumpla, mirando cada 0,2 s
  local n=$(($1 * 5))
  shift
  while [ "$n" -gt 0 ]; do "$@" && return 0; sleep 0.2; n=$((n - 1)); done
  return 1
}
prop() { sudo -n systemctl show -p "$2" --value "$1" 2>/dev/null; }
ver() { sudo -n cat "$1" 2>/dev/null; }
corrida() { # guion id stop|main [intruso]
  local g="$1" id="$2" modo="$3" u="kommo-prueba-ensayo-$$-$2"
  U_ACTUAL="$u"
  UNIDADES+=("$u")
  sudo -n systemd-run --quiet --unit "$u" -p "StandardOutput=truncate:$TRABAJO/ensayo-$id.txt" -p StandardError=inherit \
    --setenv=CARGA="$S/carga.ndjson" --setenv=INFORME_CARGA="$S/carga-informe.json" \
    --setenv=INFORME_VINCULO="$S/vinculo-informe.json" --setenv=STAGING="$S" --setenv=CUENTA="$CUENTA" \
    --setenv=CHATWOOT_DIR="$D" --setenv=EVIDENCIA="$TRABAJO/evidencia-$id.txt" --setenv=TOPE_CARGA=32 \
    bash "$g"
  if [ "${4:-}" = intruso ]; then
    # Un contenedor de otro proyecto conectado a la red del ensayo: la red no se puede borrar sin tocarlo.
    esperar 120 red_lista && docker run -d --name "$INTRUSO" --label com.docker.compose.project=otro \
      --network chatwoot-ensayo_aislada "$REDIS_IMG" >/dev/null
  fi
  if esperar 180 para_parar && vivo; then echo "con un runner vivo" >"$TRABAJO/$id.vivo"; else echo "sin runner vivo" >"$TRABAJO/$id.vivo"; fi
  case "$modo" in
    stop) sudo -n systemctl stop "$u" ;;
    main) sudo -n systemctl kill --kill-whom=main --signal=TERM "$u" ;;
  esac
  esperar 180 inactiva "$u"
  echo "$(prop "$u" Result) $(prop "$u" ExecMainCode) $(prop "$u" ExecMainStatus)" >"$TRABAJO/$id.unidad"
  sudo -n systemctl reset-failed "$u" >/dev/null 2>&1
  return 0
}
# Cada caso deja «si» o «no:<motivo>», el primer requisito que no se cumplió. Así un mutante tiene que caer por el
# motivo que le toca, no por otro.
MOTIVO=""
falta() { MOTIVO="$1"; return 1; }
# T1 y T2: el TERM llegó con un runner del ensayo corriendo (el choque de §10.16); la parada sale con 143 (exited,
# no muerta por la señal) y la unidad queda en exit-code; la evidencia lo dice, y no queda nada.
t_ok() {
  local E="$TRABAJO/evidencia-$1.txt"
  [ "$(cat "$TRABAJO/$1.vivo" 2>/dev/null)" = "con un runner vivo" ] || falta runner || return 1
  [ "$(cat "$TRABAJO/$1.unidad" 2>/dev/null)" = "exit-code 1 143" ] || falta unidad || return 1
  { ver "$E" | grep -qx "HECHO senal=TERM" && ver "$E" | grep -qx "HECHO ensayo_codigo=143" \
    && grep -q "^FALLÓ PARADA — " "$TRABAJO/ensayo-$1.txt"; } || falta senal || return 1
  { ver "$E" | grep -qx "HECHO limpieza_completa=si" && ver "$E" | grep -qx "HECHO limpieza=contenedores=0,volumenes=0,redes=0" \
    && [ "$(quedan)" = 0,0,0 ] && [ ! -e /dev/shm/cw-ensayo ]; } || falta limpieza || return 1
}
# T3: con el ajeno en la red, la limpieza no lo toca, dice que no terminó y no sale con 0. `--limpiar`, igual.
# Cuando el ajeno se va, `--limpiar` deja todo en 0 y sale con 0.
t3_ok() { # guion id
  local g="$1" E="$TRABAJO/evidencia-$2.txt" res cod est rc1 rc2 sigue
  sigue="$(docker inspect -f '{{.State.Status}}' "$INTRUSO" 2>/dev/null)"
  docker network inspect -f '{{range .Containers}}{{.Name}} {{end}}' chatwoot-ensayo_aislada 2>/dev/null | grep -qw "$INTRUSO" \
    || sigue="${sigue:-ausente},fuera-de-la-red"
  echo "el ajeno después del ensayo: $sigue" >"$TRABAJO/$2.limpiar"
  [ "$sigue" = running ] || falta ajeno || return 1
  read -r res cod est <"$TRABAJO/$2.unidad"
  { [ "$res" = exit-code ] && [ "${est:-0}" != 0 ]; } || falta unidad || return 1
  { ver "$E" | grep -qx "HECHO limpieza_completa=no" && ver "$E" | grep -qx "HECHO limpieza=contenedores=0,volumenes=0,redes=1" \
    && grep -q "^FALLÓ L0 — " "$TRABAJO/ensayo-$2.txt"; } || falta completa || return 1
  sudo -n env EVIDENCIA="$TRABAJO/evidencia-$2-l1.txt" bash "$g" --limpiar >"$TRABAJO/ensayo-$2-l1.txt" 2>&1
  rc1=$?
  sigue="$(docker inspect -f '{{.State.Status}}' "$INTRUSO" 2>/dev/null)"
  docker rm -f "$INTRUSO" >/dev/null 2>&1
  sudo -n env EVIDENCIA="$TRABAJO/evidencia-$2-l2.txt" bash "$g" --limpiar >"$TRABAJO/ensayo-$2-l2.txt" 2>&1
  rc2=$?
  echo "el ajeno después del ensayo: running; --limpiar con el ajeno: código $rc1 (ajeno ${sigue:-ausente}); sin el ajeno: código $rc2, quedan $(quedan)" >"$TRABAJO/$2.limpiar"
  { [ "$rc1" != 0 ] && grep -q "^FALLÓ L0 — " "$TRABAJO/ensayo-$2-l1.txt" && [ "$sigue" = running ]; } || falta limpiar || return 1
  { [ "$rc2" = 0 ] && [ "$(quedan)" = 0,0,0 ] && ver "$TRABAJO/evidencia-$2-l2.txt" | grep -qx "HECHO limpieza_completa=si"; } \
    || falta limpiar_sin_ajeno || return 1
}
casos_t() { # guion prefijo ids... → $TRABAJO/t-<prefijo>/<id> = si | no:<motivo>
  local g="$1" p="$2" id r
  shift 2
  rm -rf "$TRABAJO/t-$p"
  mkdir -p "$TRABAJO/t-$p"
  for id in "$@"; do
    MOTIVO=desconocido
    r=""
    case "$id" in
      T1) corrida "$g" "$p-t1" stop && t_ok "$p-t1" && r=si ;;
      T2) corrida "$g" "$p-t2" main && t_ok "$p-t2" && r=si ;;
      T3) corrida "$g" "$p-t3" main intruso && t3_ok "$g" "$p-t3" && r=si ;;
    esac
    echo "${r:-no:$MOTIVO}" >"$TRABAJO/t-$p/$id"
    restos_fuera
  done
}
t_es() { [ "$(cat "$TRABAJO/t-$1/$2" 2>/dev/null)" = si ]; }
t_motivo() { cat "$TRABAJO/t-$1/$2" 2>/dev/null; }
mutar() { # origen destino buscar reemplazo: el texto tiene que aparecer exactamente una vez
  "$PY" -I - "$@" <<'EOF'
import sys
origen, destino, buscar, poner = sys.argv[1:5]
texto = open(origen, encoding="utf-8").read()
n = texto.count(buscar)
if n != 1:
    sys.exit(f"el texto a mutar aparece {n} veces: {buscar!r}")
open(destino, "w", encoding="utf-8").write(texto.replace(buscar, poner))
EOF
}
# id descripción "caen" "pasan" buscar reemplazo. «caen» lleva caso:motivo (T1:unidad): el caso tiene que caer justo
# por ese motivo. «pasan» es el control: casos que el mutante no toca y tienen que seguir pasando.
mutante_t() {
  local id="$1" que="$2" caen="$3" pasan="$4" dir="$TRABAJO/mut-$1" faltan="" otro="" c casos=""
  rm -rf "$dir"
  cp -r "$KH" "$dir"
  if ! mutar "$KH/ensayo-archivo.sh" "$dir/ensayo-archivo.sh" "$5" "$6"; then mal "$id" "no se pudo mutar ($que)"; return; fi
  for c in $caen; do casos="$casos ${c%%:*}"; done
  # shellcheck disable=SC2086
  casos_t "$dir/ensayo-archivo.sh" "$id" $casos $pasan
  for c in $caen; do [ "$(t_motivo "$id" "${c%%:*}")" = "no:${c#*:}" ] || faltan="$faltan $c($(t_motivo "$id" "${c%%:*}"))"; done
  for c in $pasan; do t_es "$id" "$c" || otro="$otro $c($(t_motivo "$id" "$c"))"; done
  if [ -z "$faltan" ] && [ -z "$otro" ]; then
    ok "$id" "$que: caen $caen${pasan:+; pasa $pasan}"
  else
    mal "$id" "$que: no cayeron por su motivo:${faltan:- ninguno}; cayeron de más:${otro:- ninguno}"
  fi
}
if [ "$T_OK" = 1 ]; then
  casos_t "$KH/ensayo-archivo.sh" real T1 T2 T3
  exigir T1 't_es real T1' \
    "systemctl stop $(cat "$TRABAJO/real-t1.vivo" 2>/dev/null): la unidad termina en $(cat "$TRABAJO/real-t1.unidad" 2>/dev/null) (Result, código, estado), la evidencia dice senal=TERM y ensayo_codigo=143, y quedan 0 contenedores, volúmenes y redes ($(t_motivo real T1))"
  exigir T2 't_es real T2' \
    "TERM al proceso principal $(cat "$TRABAJO/real-t2.vivo" 2>/dev/null): la unidad termina en $(cat "$TRABAJO/real-t2.unidad" 2>/dev/null), igual que T1 ($(t_motivo real T2))"
  exigir T3 't_es real T3' \
    "con un contenedor ajeno en la red: la unidad termina en $(cat "$TRABAJO/real-t3.unidad" 2>/dev/null), la evidencia dice limpieza_completa=no y sale FALLÓ L0; $(cat "$TRABAJO/real-t3.limpiar" 2>/dev/null) ($(t_motivo real T3))"
  # ME1, sin trap de TERM: la limpieza la sigue haciendo el trap de EXIT; lo que cae es la unidad (success).
  mutante_t ME1 "sin el trap de TERM (como hasta el 2026-11-07)" "T1:unidad T2:unidad" "" \
    "trap 'parada TERM 143' TERM" ":"
  mutante_t ME2 "la limpieza no mira lo que quedó" "T3:completa" "T1" \
    '[ "$restos" = "$SIN_RESTOS" ] && [ "$carpeta" = ausente ] || completa=no' 'true'
  mutante_t ME3 "para poder borrar la red, saca también al contenedor ajeno" "T3:ajeno" "T2" \
    'docker ps -aq --filter "label=com.docker.compose.project=chatwoot-ensayo" | xargs -r docker rm -f -v' \
    'docker ps -aq --filter "network=chatwoot-ensayo_aislada" | xargs -r docker rm -f -v; docker ps -aq --filter "label=com.docker.compose.project=chatwoot-ensayo" | xargs -r docker rm -f -v'
fi

# ── R. El ensayo ─────────────────────────────────────────────────────────────
log "== R. ensayo"
ensayo r; rc=$?
grep -E '^(PASÓ|FALLÓ|MEDIDA|== resultado|.*NO EJECUTADO)' "$TRABAJO/ensayo-r.txt" | sed 's/^/   /'
pasadas="$(grep -c '^PASÓ ' "$TRABAJO/ensayo-r.txt" || true)"
caidas="$(grep -c '^FALLÓ ' "$TRABAJO/ensayo-r.txt" || true)"
exigir R1 '[ "$rc" = 0 ] && [ "$caidas" = 0 ] && [ "$pasadas" -ge 30 ]' "el ensayo pasa: $pasadas comprobaciones, $caidas fallas (código $rc)"
# R2 (5.5b): que el ensayo de verdad cargó los adjuntos. Un «NO EJECUTADO» no basta: con los 3 adjuntos inventados del
# staging, AD1 a AD3 tienen que estar y pasar.
adjuntos_medidos() {
  local c
  for c in AD1 AD2 AD3; do grep -qE "^PASÓ +$c — " "$TRABAJO/ensayo-r.txt" || return 1; done
  grep -qE "^PASÓ +AD1 — 5\.5b: 3 de 3 adjuntos subidos" "$TRABAJO/ensayo-r.txt"
}
exigir R2 'adjuntos_medidos && ! grep -q "adjuntos: NO EJECUTADO" "$TRABAJO/ensayo-r.txt"' \
  "5.5b: el ensayo carga los 3 adjuntos inventados del staging, dos veces, y pasan AD1 a AD3"
# R3: los miembros y la búsqueda ampliada. La producción simulada tiene un agente y un administrador (sonda-cargador,
# FASE=preparar), así que E-10e se mide con el agente real: no la encuentra antes de ser miembro y sí después. El
# mensaje inventado más viejo es de hace 500 días: con 90 días no aparece y con 3650, sí, y sin coincidencias
# tarda menos de 1.000 ms (BQ2).
pasan_todas() { local c; for c in "$@"; do grep -qE "^PASÓ +$c — " "$TRABAJO/ensayo-r.txt" || return 1; done; }
exigir R3 'pasan_todas MI1 MI2 MI3 E10g BQ1 BQ2 MEM1 && grep -qE "^PASÓ +BQ1 — .*con 3650: si" "$TRABAJO/ensayo-r.txt" && grep -qE "^PASÓ +E10g — E-10e con un usuario real \(agente\)" "$TRABAJO/ensayo-r.txt" && grep -qE "^PASÓ +MI2 — .*\(4 de 4," "$TRABAJO/ensayo-r.txt"' \
  "miembros: todos los usuarios quedan en el Archivo y el agente real la encuentra solo después; búsqueda: con 3650 días aparece el mensaje de hace 500, por debajo de la puerta de 1.000 ms"
# R4 y R5: lo que la corrida real del 2026-11-07 no midió (SDD-0590 §10.16), con el relleno de generar-sintetico.py.
ER="$TRABAJO/evidencia-r.txt"
por_numero="$(sed -n 's/^HECHO admin_resultados=.*numero:\([0-9]*\).*/\1/p' "$ER" 2>/dev/null | tail -n 1)"
exigir R4 '[ "${por_numero:-0}" -gt 600 ] 2>/dev/null && pasan_todas E10d E10e E10g' \
  "búsqueda por el número de la más vieja: ${por_numero:-?} resultados, más de 40 páginas de 15, y aun así la encuentran el administrador, el agente miembro y el usuario real"
exigir R5 '[ "$(grep -c "^HECHO vieja_posicion=3$" "$ER")" = 2 ] && [ "$(grep -c "^HECHO palabra_coincidencias_cuenta=1$" "$ER")" = 2 ] && pasan_todas BQ1' \
  "BQ1 salta el mensaje más viejo (sin palabras de 6 letras) y el segundo (una palabra con más de 60 coincidencias), y busca el tercero, con las dos ventanas"

# ── P. La producción simulada quedó intacta ──────────────────────────────────
DESPUES="$(huella_prod | tr '\n' ' ')"
exigir P1 '[ "$ANTES" = "$DESPUES" ] && [ "$(psql_prod "select count(*) from inboxes where name = '"'"'Archivo Kommo'"'"'")" = 0 ] && [ "$(psql_prod "select count(*) from accounts")" = 2 ]' \
  "producción sigue con sus 2 cuentas, sin «Archivo Kommo» y con las mismas bandejas, conversaciones y mensajes ($DESPUES)"
exigir P2 '[ "$(docker inspect -f "{{.State.Status}}" chatwoot-postgres-1)" = running ] && [ "$(docker inspect -f "{{.State.Status}}" chatwoot-redis-1)" = running ]' \
  "chatwoot-postgres-1 y chatwoot-redis-1 siguen corriendo después del borrado del ensayo"
exigir P3 '[ "$(docker volume ls -q --filter label=com.docker.compose.project=chatwoot | wc -l)" -ge 1 ]' "los volúmenes de producción siguen ahí"

# ── L. No queda nada del ensayo ──────────────────────────────────────────────
exigir L1 '[ "$(quedan)" = 0,0,0 ] && [ ! -e /dev/shm/cw-ensayo ]' "0 contenedores, 0 volúmenes, 0 redes y ninguna carpeta del ensayo"
ensayo limpiar --limpiar; rc=$?
exigir L2 '[ "$rc" = 0 ] && [ "$(quedan)" = 0,0,0 ] && [ "$(huella_prod | tr "\n" " ")" = "$ANTES" ]' "--limpiar sin nada que borrar no rompe nada"
# L3: con docker caído (un docker que no responde, delante en el PATH), --limpiar no puede contar 0 y salir con 0.
mkdir -p "$TRABAJO/docker-caido"
printf '#!/usr/bin/env bash\necho "Cannot connect to the Docker daemon" >&2\nexit 1\n' >"$TRABAJO/docker-caido/docker"
chmod +x "$TRABAJO/docker-caido/docker"
PATH="$TRABAJO/docker-caido:$PATH" ensayo l3 --limpiar; rc=$?
exigir L3 '[ "$rc" = 4 ] && grep -q "^FALLÓ L0 — no se pudo comprobar la limpieza: docker no respondió" "$TRABAJO/ensayo-l3.txt" && grep -qx "HECHO limpieza_completa=no" "$TRABAJO/evidencia-l3.txt"' \
  "--limpiar con docker caído no cuenta 0: sale con $rc y dice que no pudo comprobar la limpieza"

# ── F. La evidencia ──────────────────────────────────────────────────────────
E="$TRABAJO/evidencia-r.txt"
fugas=0
for m in SINT-NOMBRE SINT-TEXTO SINTBUSCAR SINTVIEJO SINT-Asesora SINT-Salesbot SINT-ADJUNTO 4120000001 4120000002 example.test SINT-C1 Pérez kommo.example SINT-RELLENO SINTFRECUENTE 4123000; do
  grep -q -F -- "$m" "$E" && { fugas=$((fugas + 1)); log "   fuga: $m"; }
done
exigir F1 '[ -s "$E" ] && ! grep -qv "^HECHO " "$E" && [ "$fugas" = 0 ]' "la evidencia trae solo líneas HECHO ($(wc -l <"$E")) y ningún valor inventado de personas"
exigir F2 'grep -q "^HECHO dump_sha=" "$E" && grep -q "^HECHO limpieza=contenedores=0,volumenes=0,redes=0" "$E" && grep -q "^HECHO limpieza_carpeta=ausente" "$E"' \
  "la evidencia anota el dump (bytes y sha256) y la limpieza en cero"
exigir F3 'grep -qx "HECHO marca=ok" "$E" && grep -qx "HECHO borrado_contenedor_proyecto=chatwoot-ensayo" "$E" && grep -qx "HECHO borrado_pgdata=tmpfs" "$E" && grep -qx "HECHO otras_cuentas_antes=1" "$E" && grep -qx "HECHO otras_cuentas=0" "$E" && grep -qx "HECHO otras_cuentas_filas=0" "$E" && ! grep -qx "HECHO otras_cuentas_filas_antes=0" "$E"' \
  "el borrado corrió en el Postgres del ensayo (proyecto y tmpfs) con la marca; la copia tenía la otra cuenta con filas y quedó en 0; producción la conserva (P1)"
exigir F4 'grep -qx "HECHO correos_en_cola=0" "$E" && grep -qx "HECHO correos_enviados_sonda=0" "$E" && [ "$(grep -c "^HECHO correos_enviados=0$" "$E")" -ge 4 ]' \
  "0 correos enviados en los pasos y en la sonda, y 0 en cola"

log "== resultado: $FALLAS fallas"
[ "$FALLAS" = 0 ]
