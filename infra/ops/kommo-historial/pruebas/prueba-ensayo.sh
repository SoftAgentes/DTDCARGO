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
#   R   el ensayo entero pasa contra la producción simulada
#   P   la producción simulada queda intacta: sin «Archivo Kommo», mismas bandejas y conversaciones (huella),
#       contenedores corriendo
#   L   no queda nada del ensayo (contenedores, volúmenes, redes, carpeta) y --limpiar no rompe nada
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
dc() { (cd "$D" && docker compose -p chatwoot "$@"); }
bajar() {
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
"$PY" -I "$AQUI/generar-sintetico.py" "$S" >"$TRABAJO/generar.txt" 2>&1 || { mal D0 "no se generaron los datos"; exit 1; }
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

# ── R. El ensayo ─────────────────────────────────────────────────────────────
log "== R. ensayo"
ensayo r; rc=$?
grep -E '^(PASÓ|FALLÓ|== resultado|.*NO EJECUTADO)' "$TRABAJO/ensayo-r.txt" | sed 's/^/   /'
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

# ── F. La evidencia ──────────────────────────────────────────────────────────
E="$TRABAJO/evidencia-r.txt"
fugas=0
for m in SINT-NOMBRE SINT-TEXTO SINTBUSCAR SINTVIEJO SINT-Asesora SINT-Salesbot SINT-ADJUNTO 4120000001 4120000002 example.test SINT-C1 Pérez kommo.example; do
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
