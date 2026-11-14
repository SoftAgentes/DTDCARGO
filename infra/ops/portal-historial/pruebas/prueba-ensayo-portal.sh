#!/usr/bin/env bash
# infra/ops/portal-historial/pruebas/prueba-ensayo-portal.sh — la prueba del ensayo de la carga P4 (ensayo-portal.sh,
# SDD-0586 10.7, PR 2b). Corre en GitHub Actions (portal-historial-cargador.yml); nunca en el VPS. Solo datos
# inventados: una «producción» simulada de Studio (el fixture de la 0523 con marcas) y otra de Chatwoot (dos cuentas,
# sonda-ensayo-portal.rb), con columnas de más llenas de marcas que la copia nunca puede traer.
#
#   T1  el ensayo completo sobre la producción simulada sale con 0, con la limpieza completa
#   T2  ninguna marca prohibida está en el volcado de las copias (ENSAYO_VOLCADO), y lo que sí se copia está (piso)
#   T3  la evidencia: el md5 de la lista, una línea copia_* por tabla de la lista, y sin nombres ni textos
#   T4  0 filas de otros tenants y otras cuentas en las copias (O1)
#   T5  la producción simulada no cambió (P2 y P3 del ensayo, y la foto de la prueba)
#   T6  minimización: el espejo y los eventos de Chatwoot de Studio, solo los de los hilos del portal
#   E   el modo completo, sobre la copia: E1, E2, CA (el caso a), B1, B2, C1 a C3, K1 a K3 y, sobre lo cargado,
#       V10 (C-10), V12 (C-12) y V13 (C-13)
#   G1  DB_CW de producción: se niega · G2 /dev/shm/portal-historial ya existe: se niega y no lo toca
#   G3  ENSAYO_VOLCADO con los nombres reales de producción: se niega
#   G4  --limpiar sin un ensayo que limpiar no toca /dev/shm/portal-historial
#   G5  --limpiar con docker sin responder no borra nada y sale con 6
#   G6  un ensayo que ya creó sus carpetas y termina con docker sin responder: borra las dos (también
#       /dev/shm/portal-historial), conserva su código
#       y anota docker_no_responde (revisión del DG de la vuelta 9, B1)
#   G7  docker colgado en la limpieza: las carpetas se borran antes de esperarlo
#   T7  los tipos de las columnas de la lista son los mismos en producción y en la copia (S3 y S4), y las dos filas de
#       crm_historial_etapas (id bigint) se copian
#   T8  solo en el mutante M29 (el esquema de la copia con crm_historial_etapas.id uuid): el ensayo se para con 7 antes
#       de copiar, dice qué columna difiere y limpia todo
#   N8  la comparación de los mutantes: un id que no existe sale como «(no existe)»
#   M   mutantes de la lista (copia-columnas.tsv) y del guion: cada uno tiene que tumbar lo suyo
#
# Uso:  bash infra/ops/portal-historial/pruebas/prueba-ensayo-portal.sh [--conservar] [--sin-mutantes]
set -uo pipefail
export MSYS_NO_PATHCONV=1

CONSERVAR=0
MUTANTES=1
for a in "$@"; do
  case "$a" in
    --conservar) CONSERVAR=1 ;;
    --sin-mutantes) MUTANTES=0 ;;
    *) echo "opción desconocida: $a"; exit 2 ;;
  esac
done

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PH="$(cd "$AQUI/.." && pwd)"
RAIZ="$(cd "$PH/../../.." && pwd)"
CW="$RAIZ/infra/chatwoot"
for d in /dev/shm/portal-historial /dev/shm/portal-ensayo; do
  [ -e "$d" ] && { echo "se niega: ya existe $d"; exit 2; }
done
TRABAJO="$(mktemp -d "${TEMP:-/tmp}/cw-ensayo-portal.XXXXXX")"
D="$TRABAJO/sim"
P="chatwoot-sim"
EDGE="chatwoot_edge_sim"
STUDIO_SIM="studio-sim-$$"
FALLAS=0
RESUMEN="$TRABAJO/resumen.txt"
declare -A RES=()
MODO_LOG=1

dc() { (cd "$D" && docker compose -p "$P" "$@"); }
BASE=(-f compose.yml -f compose.override.yml)
limpiar() {
  rm -rf -- /dev/shm/portal-historial
  [ "$CONSERVAR" = 1 ] && { echo "(--conservar: la producción simulada sigue en $D y $STUDIO_SIM)"; return; }
  bash "$PH/ensayo-portal.sh" --limpiar >/dev/null 2>&1
  [ -f "$D/compose.yml" ] && dc down -v --remove-orphans >/dev/null 2>&1
  docker network rm "$EDGE" >/dev/null 2>&1
  docker rm -f "$STUDIO_SIM" >/dev/null 2>&1
  return 0
}
trap limpiar EXIT

log() { echo "$*" | tee -a "$RESUMEN"; }
mal() { log "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
exigir() {
  local r=FALLÓ
  if eval "$2"; then r=PASÓ; fi
  RES["$1"]=$r
  if [ "$MODO_LOG" = 1 ]; then
    if [ "$r" = PASÓ ]; then log "PASÓ  $1 — $3"; else mal "$1" "$3"; fi
  fi
  return 0
}
h() { sed -n "s/^HECHO $2=//p" "$1" 2>/dev/null | tail -n 1 | tr -d '\r'; }
qs() { docker exec -i "$STUDIO_SIM" psql -X -q -At -U postgres -d postgres -c "$1"; }

# Las marcas que el ensayo NUNCA puede copiar. Cada una vive en una columna o una fila fuera de la lista.
PROHIBIDAS=(
  5550101                 # clients.phone (fixture)
  DTD-SA                  # clients.markbox real (fixture): en la copia va sintético
  SINT-AUTOR              # conversation_messages.author_name
  SINT-CORREO             # un mensaje de un hilo de correo (channel <> 'portal')
  'SINT otro tenant'      # el mensaje del tenant T2
  'Cliente Z'             # la ficha del tenant T2
  SINT-CUENTA-REAL        # accounts.name
  SINT-SERVICIO-REAL sint-servicio-real SINT-AGENTE-REAL sint-agente-real # users.name y users.email
  SINT-DTD-NOMBRE 7770002 sint-real-dtd # el contacto dtd-portal: con nombre, teléfono y correo
  SINT-WHATSAPP 7770001 sint-real@x # la otra bandeja, su contacto y su mensaje
  sint-token              # webhooks.url
  SINT-HMAC               # channel_api.hmac_token
  SINT-NAVEGADOR          # conversations.additional_attributes, fuera de dtd_hilo
  SINTPUBSUB              # contact_inboxes.pubsub_token, una credencial
  SINT-SIN-HILO           # additional_attributes de una conversación del portal sin dtd_hilo
  SINT-OTRA-CUENTA SINT-OTRA-MENSAJE # la otra cuenta
)
# Lo que sí se copia (piso: sin esto, un volcado vacío pasaría T2).
PERMITIDAS_STUDIO=('Cliente A' 'SINT pregunta a1' 'SINT respuesta a2')
PERMITIDAS_CW=('Conversaciones del portal' 'SINT contacto' 'sint-' 'copia.invalid')

log "== prueba del ensayo de la carga P4 · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"

# ── La producción simulada de Studio: el fixture de la 0523 y las marcas ─────
# En C.UTF-8, y la copia del ensayo en el en_US.utf8 de postgres:17: la guarda de tipos tiene que ordenar igual en las
# dos (revisión del DG de la #563, B1). T7 comprueba que la mezcla de ordenaciones de verdad está.
docker run -d --name "$STUDIO_SIM" -e POSTGRES_PASSWORD="$(openssl rand -hex 16)" -e POSTGRES_INITDB_ARGS=--locale=C.UTF-8 -v "$RAIZ/supabase:/supabase:ro" postgres:17 >/dev/null \
  || { mal P0 "no arrancó el Studio simulado"; exit 1; }
for _ in $(seq 1 60); do docker exec "$STUDIO_SIM" pg_isready -q -h 127.0.0.1 -U postgres && break; sleep 1; done
docker exec -i "$STUDIO_SIM" psql -X -q -U postgres -d postgres -f - <"$AQUI/studio-fixture.sql" >"$TRABAJO/fixture.txt" 2>&1 \
  || { mal P0 "el fixture no se aplicó"; tail -n 30 "$TRABAJO/fixture.txt"; exit 1; }
TENANT="$(qs "select md5('0523-sintetico-T1')::uuid")"
qs "update public.conversation_messages set author_name = 'SINT-AUTOR';
    insert into public.conversation_messages (id, tenant_id, conversation_id, direction, author_name, body, sent_at)
    values (md5('ensayo-correo')::uuid, md5('0523-sintetico-T1')::uuid, md5('0523-sintetico-hE')::uuid, 'in', 'SINT-AUTOR', 'SINT-CORREO', now() - interval '1 hour');" >/dev/null
# T7: dos filas de crm_historial_etapas del tenant, como en producción (id bigint identity). Con 0 filas, un tipo
# distinto en la copia no se veía: el COPY de nada no falla (el --solo-copia del 2026-11-14).
qs "insert into public.crm_historial_etapas (tenant_id) values (md5('0523-sintetico-T1')::uuid), (md5('0523-sintetico-T1')::uuid);" >/dev/null

# ── La producción simulada de Chatwoot ───────────────────────────────────────
mkdir -p "$D/cargador"
cp "$CW/compose.yml" "$D/"
cp -r "$CW/rails" "$CW/marca" "$CW/correo" "$D/"
cp "$CW/pruebas/compose.local.yml" "$D/compose.override.yml"
cp "$AQUI/sonda-ensayo-portal.rb" "$D/cargador/"
cat >"$D/compose.sonda.yml" <<'EOF'
services:
  prepare:
    volumes:
      - ./cargador:/tmp/cargador:ro
EOF
cat >"$D/.env" <<EOF
CHATWOOT_HOST=chat.sim.test
CHATWOOT_EDGE_NETWORK=$EDGE
CHATWOOT_TLS=false
CHATWOOT_FORCE_SSL=false
CHATWOOT_FRAME_ANCESTORS=https://studio.sim.test
CHATWOOT_FRONTEND_URL=http://chat.sim.test
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
BASE=(-f compose.yml -f compose.override.yml -f compose.sonda.yml)
dc "${BASE[@]}" up -d --wait postgres redis >"$TRABAJO/up.txt" 2>&1 || { mal P0 "el Chatwoot simulado no arrancó"; tail -n 30 "$TRABAJO/up.txt"; exit 1; }
dc "${BASE[@]}" run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1 </dev/null || { mal P0 "db:chatwoot_prepare falló"; tail -n 40 "$TRABAJO/prepare.txt"; exit 1; }
dc "${BASE[@]}" run --rm -T prepare bundle exec rails runner /tmp/cargador/sonda-ensayo-portal.rb >"$TRABAJO/sim.txt" 2>&1 </dev/null
CUENTA="$(h "$TRABAJO/sim.txt" cuenta)"
BANDEJA="$(h "$TRABAJO/sim.txt" portal)"
SERVICIO="$(h "$TRABAJO/sim.txt" servicio)"
AGENTE="$(h "$TRABAJO/sim.txt" agente)"
PG_SIM="$P-postgres-1"
exigir P1 '[ "$(h "$TRABAJO/sim.txt" preparar)" = ok ] && [ -n "$TENANT" ] && docker inspect "$PG_SIM" >/dev/null 2>&1' \
  "producción simulada: Studio con el fixture y las marcas; Chatwoot con la cuenta $CUENTA, la bandeja $BANDEJA y otra cuenta"
[ "$FALLAS" = 0 ] || { tail -n 30 "$TRABAJO/sim.txt"; exit 1; }
# El agente vinculado (U1) y el espejo de hC, como en la prueba punta a punta.
qs "insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id) values ('$TENANT', md5('0523-sintetico-U1')::uuid, $AGENTE);
    insert into public.chatwoot_conversations (tenant_id, conversation_id, inbox_id, status, client_id)
    values ('$TENANT', 1100, $BANDEJA, 'open', md5('0523-sintetico-C')::uuid) on conflict do nothing;" >/dev/null
# T6: un espejo y un evento de una conversación de Chatwoot que no es del portal (2200), y un evento de hC (1100).
qs "insert into public.chatwoot_conversations (tenant_id, conversation_id, inbox_id, status, client_id)
    values ('$TENANT', 2200, 99, 'open', md5('0523-sintetico-A')::uuid);
    insert into public.chatwoot_webhook_events (tenant_id, event_key, event, conversation_id)
    values ('$TENANT', 'sim-1100', 'message_created', 1100), ('$TENANT', 'sim-2200', 'message_created', 2200);" >/dev/null
foto_sim() {
  qs "select count(*) || ':' || md5(string_agg(t::text, ',' order by t::text)) from (
        select row(c.*)::text t from public.clients c union all select row(m.*)::text from public.conversation_messages m
        union all select row(x.*)::text from public.chatwoot_portal_contactos x union all select row(e.*)::text from public.chatwoot_portal_estado e) s"
  docker exec -i "$PG_SIM" psql -X -q -At -U chatwoot -d chatwoot_production -c \
    "select (select count(*) from contacts) || ',' || (select count(*) from conversations) || ',' || (select count(*) from messages) || ',' || (select count(*) from accounts)"
}
foto_sim >"$TRABAJO/sim-antes.txt" 2>&1

# El ensayo, con la producción simulada. Las entradas que cambian por caso van por argumento.
ensayo() { # carpeta salida [VAR=valor...] -- [opciones]
  local carpeta="$1" salida="$2" envs=()
  shift 2
  while [ "${1:-}" != "--" ]; do envs+=("$1"); shift; done
  shift
  env TENANT="$TENANT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" AGENTE_SERVICIO="$SERVICIO" \
      PROD_STUDIO="$STUDIO_SIM" PROD_PG="$PG_SIM" PROD_RAILS="$P-rails-1" PROD_PROYECTO="$P" \
      CHATWOOT_DIR="$CW" MIGRACIONES="$RAIZ/supabase/migrations" TOPE_CARGA=64 \
      EVIDENCIA="$salida.evidencia" "${envs[@]}" bash "$carpeta/ensayo-portal.sh" "$@" >"$salida" 2>&1
  echo "HECHO salida_proceso=$?" >>"$salida"
}

# ── Las comprobaciones de una corrida del ensayo ─────────────────────────────
comprobar() { # salida volcado
  local S="$1" V="$2" E="$1.evidencia" m fugas=0 piso=0 tablas
  exigir T1 '[ "$(h "$S" salida_proceso)" = 0 ] && [ "$(h "$E" ensayo_fallas)" = 0 ] && [ "$(h "$E" limpieza_completa)" = si ] && [ "$(h "$E" ensayo_codigo)" = 0 ]' \
    "el ensayo sale con 0 ($(h "$S" salida_proceso)), sin fallas ($(h "$E" ensayo_fallas)) y con la limpieza completa ($(h "$E" limpieza_completa))"
  for m in "${PROHIBIDAS[@]}"; do
    if grep -q -F -- "$m" "$V/studio.sql" "$V/chatwoot.sql" 2>/dev/null; then
      fugas=$((fugas + 1)); [ "$MODO_LOG" = 1 ] && log "   fuga: $m"
    fi
  done
  for m in "${PERMITIDAS_STUDIO[@]}"; do grep -q -F -- "$m" "$V/studio.sql" 2>/dev/null && piso=$((piso + 1)); done
  for m in "${PERMITIDAS_CW[@]}"; do grep -q -F -- "$m" "$V/chatwoot.sql" 2>/dev/null && piso=$((piso + 1)); done
  exigir T2 '[ "$fugas" = 0 ] && [ "$piso" = $(( ${#PERMITIDAS_STUDIO[@]} + ${#PERMITIDAS_CW[@]} )) ]' \
    "ninguna de las ${#PROHIBIDAS[@]} marcas prohibidas en el volcado de las copias ($fugas), y lo que sí se copia está ($piso)"
  tablas="$(grep -vE '^(#|$)' "$PH/copia-columnas.tsv" | grep -c .)"
  exigir T3 '[ "$(h "$E" lista_md5)" = "$(md5sum "$LISTA_DE" | cut -c1-32)" ] && [ "$(grep -cE "^HECHO copia_(studio|chatwoot)_[a-z]*\.[a-z_]*=filas:" "$E")" = "$tablas" ] && ! grep -q -F -e "Cliente A" -e "SINT pregunta" -e "SINT respuesta" "$E"' \
    "la evidencia trae el md5 de la lista y $tablas líneas copia_* (filas y md5 de columnas), sin nombres ni textos"
  exigir T4 '[ "$(h "$E" otras_filas_studio)" = 0 ] && [ "$(h "$E" otras_filas_chatwoot)" = 0 ]' \
    "0 filas de otros tenants y cuentas en las copias ($(h "$E" otras_filas_studio), $(h "$E" otras_filas_chatwoot))"
  foto_sim >"$S.sim-despues" 2>&1
  local espejo eventos
  espejo="$(h "$E" copia_studio_public.chatwoot_conversations)"
  eventos="$(h "$E" copia_studio_public.chatwoot_webhook_events)"
  exigir T6 '[ "${espejo%%,*}" = filas:1 ] && [ "${eventos%%,*}" = filas:1 ]' \
    "minimización: del espejo y de los eventos de Studio, solo los del hilo del portal ($espejo · $eventos)"
  exigir T5 'cmp -s "$TRABAJO/sim-antes.txt" "$S.sim-despues" && grep -q "^PASÓ  P2" "$S" && grep -q "^PASÓ  P3" "$S"' \
    "la producción simulada no cambió (foto de la prueba, y P2 y P3 del ensayo)"
  local etapas orden_sim
  etapas="$(h "$E" copia_studio_public.crm_historial_etapas)"
  orden_sim="$(qs "select datcollate from pg_database where datname = current_database()")"
  exigir T7 '[ "$(h "$E" tipos_studio)" = iguales ] && [ "$(h "$E" tipos_chatwoot)" = iguales ] && [ "${etapas%,columnas_md5:*}" = filas:2,produccion:2 ] && [ "$orden_sim" = C.UTF-8 ]' \
    "los tipos de la lista son los mismos en producción ($orden_sim) y en la copia ($(h "$E" tipos_studio), $(h "$E" tipos_chatwoot)), y crm_historial_etapas, con id bigint, se copia entera ($etapas)"
  return 0
}

# ── T. El ensayo completo ────────────────────────────────────────────────────
log "== T. el ensayo completo sobre la producción simulada"
LISTA_DE="$PH/copia-columnas.tsv"
ensayo "$PH" "$TRABAJO/ensayo.txt" ENSAYO_PRUEBA=1 "ENSAYO_VOLCADO=$TRABAJO/volcado" --
comprobar "$TRABAJO/ensayo.txt" "$TRABAJO/volcado"
grep -E '^(PASÓ|FALLÓ) ' "$TRABAJO/ensayo.txt" | sed 's/^/   ensayo: /' | tee -a "$RESUMEN" # también en el log del CI cuando pasa (el run 42538856924 no las mostraba)
# Lo que el ensayo completo tiene que haber medido en la copia (y pasado).
E_LISTA="E1 E2 CA B1 B2 C1 C2 C3 K1 K2 K3 V10 V12 V13"
comprobar_e() { # salida del ensayo
  local c SAL="$1" # dentro del eval de exigir, $1 sería el id
  for c in $E_LISTA; do
    exigir "E-$c" 'grep -q "^PASÓ  $c " "$SAL"' "el ensayo midió $c en la copia"
  done
}
comprobar_e "$TRABAJO/ensayo.txt"

# ── G. Las guardas de entrada ────────────────────────────────────────────────
log "== G. las guardas"
guardas() { # carpeta prefijo
  local C="$1" X="$2"
  ensayo "$C" "$TRABAJO/$X-g1.txt" DB_CW="$P-rails-1" TENANT=no-es-uuid --
  exigir G1 '[ "$(h "$TRABAJO/$X-g1.txt" salida_proceso)" = 2 ] && [ "$(h "$TRABAJO/$X-g1.txt.evidencia" error)" = db_cw_no_es_la_copia ]' \
    "DB_CW de producción: se niega ($(h "$TRABAJO/$X-g1.txt.evidencia" error))"
  mkdir -m 700 /dev/shm/portal-historial && echo centinela >/dev/shm/portal-historial/centinela
  ensayo "$C" "$TRABAJO/$X-g2.txt" TENANT=no-es-uuid --
  exigir G2 '[ "$(h "$TRABAJO/$X-g2.txt" salida_proceso)" = 2 ] && [ "$(h "$TRABAJO/$X-g2.txt.evidencia" error)" = ya_existe_portal_historial ] && [ "$(cat /dev/shm/portal-historial/centinela 2>/dev/null)" = centinela ]' \
    "/dev/shm/portal-historial ya existe: se niega y no lo toca ($(h "$TRABAJO/$X-g2.txt.evidencia" error))"
  rm -rf -- /dev/shm/portal-historial
  # G4: --limpiar sin un ensayo que limpiar (sin /dev/shm/portal-ensayo ni contenedores del proyecto) no toca la carpeta.
  mkdir -m 700 /dev/shm/portal-historial && echo centinela >/dev/shm/portal-historial/centinela
  ensayo "$C" "$TRABAJO/$X-g4.txt" -- --limpiar
  exigir G4 '[ "$(cat /dev/shm/portal-historial/centinela 2>/dev/null)" = centinela ]' \
    "--limpiar sin un ensayo que limpiar no toca /dev/shm/portal-historial"
  # G5: un docker que no responde (uno falso, primero en el PATH): ante la duda no se borra nada. Su propio centinela.
  rm -rf -- /dev/shm/portal-historial
  mkdir -m 700 /dev/shm/portal-historial && echo centinela >/dev/shm/portal-historial/centinela
  mkdir -p "$TRABAJO/docker-caido" && printf '#!/bin/sh\nexit 1\n' >"$TRABAJO/docker-caido/docker" && chmod +x "$TRABAJO/docker-caido/docker"
  ensayo "$C" "$TRABAJO/$X-g5.txt" "PATH=$TRABAJO/docker-caido:$PATH" -- --limpiar
  exigir G5 '[ "$(h "$TRABAJO/$X-g5.txt" salida_proceso)" = 6 ] && [ "$(h "$TRABAJO/$X-g5.txt.evidencia" error)" = docker_no_responde ] && [ "$(cat /dev/shm/portal-historial/centinela 2>/dev/null)" = centinela ]' \
    "--limpiar con docker sin responder: no borra nada y sale con 6 ($(h "$TRABAJO/$X-g5.txt" salida_proceso))"
  rm -rf -- /dev/shm/portal-historial
  # G6: un ensayo de verdad que ya creó /dev/shm/portal-ensayo (CREADO=1) y en el que docker deja de responder justo
  # después: un docker que pasa al real hasta que existe el compose.yml del ensayo, y desde ahí falla. Las copias no
  # arrancan (P1, código 1) y la limpieza encuentra docker caído: tiene que borrar la carpeta igual, salir con 1 (no
  # con 6) y anotar docker_no_responde.
  # El docker caído es pegajoso: la limpieza borra la carpeta antes de llamar a docker (N1), así que desde que ve el
  # compose.yml deja una marca y sigue caído aunque la carpeta ya no esté (el rojo del job 129203440274). El centinela
  # de la carga a medias se crea solo mientras existe el compose.yml, para no recrearlo después de la limpieza.
  mkdir -p "$TRABAJO/docker-se-cae"
  rm -f -- "$TRABAJO/docker-se-cae/caido" "$TRABAJO/docker-se-cae/caido.sin_carpeta"
  printf '#!/bin/sh\nM=%s\nif [ -e /dev/shm/portal-ensayo/compose.yml ]; then : >"$M"; mkdir -p /dev/shm/portal-historial; echo centinela >/dev/shm/portal-historial/centinela; fi\nif [ -e "$M" ]; then [ -e /dev/shm/portal-ensayo/compose.yml ] || : >"$M.sin_carpeta"; exit 1; fi\nexec %s "$@"\n' "$TRABAJO/docker-se-cae/caido" "$(command -v docker)" >"$TRABAJO/docker-se-cae/docker"
  chmod +x "$TRABAJO/docker-se-cae/docker"
  ensayo "$C" "$TRABAJO/$X-g6.txt" "PATH=$TRABAJO/docker-se-cae:$PATH" --
  [ -e /dev/shm/portal-ensayo ] && echo "HECHO carpeta_ensayo=queda" >>"$TRABAJO/$X-g6.txt"
  [ -e /dev/shm/portal-historial ] && echo "HECHO carpeta_historial=queda" >>"$TRABAJO/$X-g6.txt"
  rm -rf -- /dev/shm/portal-ensayo /dev/shm/portal-historial
  exigir G6 '[ "$(h "$TRABAJO/$X-g6.txt" salida_proceso)" = 1 ] && [ "$(h "$TRABAJO/$X-g6.txt.evidencia" ensayo_codigo)" = 1 ] && [ "$(h "$TRABAJO/$X-g6.txt.evidencia" docker_no_responde)" = si ] && [ -z "$(h "$TRABAJO/$X-g6.txt" carpeta_ensayo)" ] && [ -z "$(h "$TRABAJO/$X-g6.txt" carpeta_historial)" ] && [ -e "$TRABAJO/docker-se-cae/caido.sin_carpeta" ]' \
    "un ensayo que termina con docker sin responder: borra sus carpetas igual y sale con su código ($(h "$TRABAJO/$X-g6.txt" salida_proceso), no 6); el falso siguió caído sin la carpeta: $([ -e "$TRABAJO/docker-se-cae/caido.sin_carpeta" ] && echo si || echo no)"
  # G7 (N1 de la revisión del DG): docker se CUELGA en la limpieza (los conteos no vuelven). Con CREADO=1 las dos
  # carpetas se borran antes de llamar a docker, así que a los 15 s ya no están, aunque la limpieza siga esperando.
  # Después se mata el ensayo con SIGKILL, como lo haría un operador.
  # Pegajoso, como el de G6: después del borrado previo los conteos se siguen colgando (si no, irían al docker real y
  # G7 no mediría el cuelgue).
  mkdir -p "$TRABAJO/docker-se-cuelga"
  rm -f -- "$TRABAJO/docker-se-cuelga/colgado" "$TRABAJO/docker-se-cuelga/colgado.sin_carpeta"
  printf '#!/bin/sh\nM=%s\nif [ -e /dev/shm/portal-ensayo/compose.yml ]; then : >"$M"; mkdir -p /dev/shm/portal-historial; fi\nif [ -e "$M" ]; then case " $* " in *" ps "*|*" ls "*) [ -e /dev/shm/portal-ensayo/compose.yml ] || : >"$M.sin_carpeta"; sleep 120 ;; esac; exit 1; fi\nexec %s "$@"\n' "$TRABAJO/docker-se-cuelga/colgado" "$(command -v docker)" >"$TRABAJO/docker-se-cuelga/docker"
  chmod +x "$TRABAJO/docker-se-cuelga/docker"
  ( ensayo "$C" "$TRABAJO/$X-g7.txt" "PATH=$TRABAJO/docker-se-cuelga:$PATH" -- ) &
  local g7=$! _
  for _ in $(seq 1 60); do [ -e /dev/shm/portal-ensayo/compose.yml ] && break; sleep 1; done
  sleep 15
  local g7_quedan=no
  { [ -e /dev/shm/portal-ensayo ] || [ -e /dev/shm/portal-historial ]; } && g7_quedan=si
  pkill -9 -f "$C/ensayo-portal.sh" 2>/dev/null
  pkill -9 -f "sleep 120" 2>/dev/null
  wait "$g7" 2>/dev/null
  rm -rf -- /dev/shm/portal-ensayo /dev/shm/portal-historial
  local g7_colgo=no
  [ -e "$TRABAJO/docker-se-cuelga/colgado.sin_carpeta" ] && g7_colgo=si
  exigir G7 '[ "$g7_quedan" = no ] && [ "$g7_colgo" = si ]' \
    "docker colgado en la limpieza: las dos carpetas ya no están antes de que vuelvan los conteos (quedan: $g7_quedan; el falso se colgó sin la carpeta: $g7_colgo)"
  ensayo "$C" "$TRABAJO/$X-g3.txt" ENSAYO_PRUEBA=1 "ENSAYO_VOLCADO=$TRABAJO/no" PROD_PG=chatwoot-postgres-1 --
  exigir G3 '[ "$(h "$TRABAJO/$X-g3.txt" salida_proceso)" = 2 ] && [ "$(h "$TRABAJO/$X-g3.txt.evidencia" error)" = volcado_fuera_de_la_prueba ] && [ ! -e "$TRABAJO/no" ]' \
    "ENSAYO_VOLCADO con el nombre real de producción: se niega ($(h "$TRABAJO/$X-g3.txt.evidencia" error))"
}
guardas "$PH" real

# ── M. Mutantes ──────────────────────────────────────────────────────────────
mutar() { # archivo buscar reemplazo: el texto tiene que aparecer exactamente una vez
  python3 -I -c 'import sys
a, b, r = sys.argv[1:4]
t = open(a, encoding="utf-8").read()
n = t.count(b)
if n != 1:
    print(f"el texto a mutar aparece {n} veces"); sys.exit(1)
open(a, "w", encoding="utf-8", newline="\n").write(t.replace(b, r))' "$1" "$2" "$3"
}
cayeron_en() { local k; for k in "${!RES[@]}"; do [ "${RES[$k]}" = FALLÓ ] && echo "$k"; done | sort | tr '\n' ' '; }
# no_cumplen estado id…: los ids cuyo resultado no es ese estado. Un id que no existe (mal escrito) no cuenta como caído
# ni como pasado: sale como «id(no existe)» (N8 del DG).
no_cumplen() {
  local quiere="$1" c
  shift
  for c in "$@"; do
    case "${RES[$c]:-}" in "$quiere") ;; FALLÓ | PASÓ) printf ' %s' "$c" ;; *) printf ' %s(no existe)' "$c" ;; esac
  done
}
# N8: la prueba de la comparación, sin Docker: T1 cayó, T2 pasó, T9 no existe.
RES=([T1]=FALLÓ [T2]=PASÓ)
n8_caen="$(no_cumplen FALLÓ T1 T2 T9)"
n8_pasan="$(no_cumplen PASÓ T2 T1 T9)"
RES=()
exigir N8 '[ "$n8_caen" = " T2 T9(no existe)" ] && [ "$n8_pasan" = " T1 T9(no existe)" ]' \
  "la comparación de los mutantes: un id que no existe sale como «(no existe)» ([$n8_caen] y [$n8_pasan])"
# mutante id qué archivo(copia-columnas.tsv|ensayo-portal.sh) caen pasan buscar reemplazo [guardas]
mutante() {
  local id="$1" que="$2" arch="$3" caen="$4" pasan="$5" C="$TRABAJO/m/$1" faltan="" otro="" c
  rm -rf -- "$C"; mkdir -p "$C"; cp -r "$PH/." "$C/"
  if ! mutar "$C/$arch" "$6" "$7" >"$C.mutar.txt" 2>&1; then
    mal "$id" "$que: no se pudo aplicar ($(cat "$C.mutar.txt"))"; return 0
  fi
  RES=(); MODO_LOG=0
  LISTA_DE="$C/copia-columnas.tsv"
  if [ "${8:-}" = guardas ]; then
    guardas "$C" "$id"
  elif [ "${8:-}" = completo ]; then
    ensayo "$C" "$TRABAJO/$id.txt" ENSAYO_PRUEBA=1 "ENSAYO_VOLCADO=$TRABAJO/$id-volcado" --
    comprobar "$TRABAJO/$id.txt" "$TRABAJO/$id-volcado"
    comprobar_e "$TRABAJO/$id.txt"
  else
    ensayo "$C" "$TRABAJO/$id.txt" ENSAYO_PRUEBA=1 "ENSAYO_VOLCADO=$TRABAJO/$id-volcado" -- --solo-copia
    comprobar "$TRABAJO/$id.txt" "$TRABAJO/$id-volcado"
    if [ "${8:-}" = tipos ]; then
      # T8: la guarda de tipos paró el ensayo con 7, antes de copiar ninguna tabla, nombró la columna y limpió todo.
      local Mt="$TRABAJO/$id.txt" Me="$TRABAJO/$id.txt.evidencia"
      exigir T8 '[ "$(h "$Mt" salida_proceso)" = 7 ] && [ "$(h "$Me" ensayo_codigo)" = 7 ] && [ "$(h "$Me" error)" = tipos_distintos ] && [ "$(h "$Me" tipos_studio_distintos)" = 1:public.crm_historial_etapas.id ] && ! grep -q "^HECHO copia_" "$Me" && [ "$(h "$Me" limpieza_completa)" = si ]' \
        "la guarda de tipos para con 7 antes de copiar ($(h "$Mt" salida_proceso), $(h "$Me" error), $(h "$Me" tipos_studio_distintos)) y limpia ($(h "$Me" limpieza_completa))"
    fi
  fi
  MODO_LOG=1
  faltan="$(no_cumplen FALLÓ $caen)"
  otro="$(no_cumplen PASÓ $pasan)"
  exigir "$id" '[ -z "$faltan" ] && [ -z "$otro" ]' \
    "$que: tienen que caer [$caen]${faltan:+ — SOBREVIVEN:$faltan}${otro:+ — CAEN POR OTRO CAMINO:$otro} · cayeron: $(cayeron_en)"
}

if [ "$MUTANTES" = 1 ]; then
  log "== M. mutantes"
  # M0, control: la lista sin cambios, con --solo-copia, pasa T1 a T5.
  mutante M0 "control: la lista y el guion sin cambios (solo-copia)" copia-columnas.tsv "" "T1 T2 T3 T4 T5" \
    "# ── Studio" "# ── Studio"
  mutante M1 "trae clients.phone" copia-columnas.tsv "T2" "T1 T4" \
    "id;tenant_id;name;deleted_at;markbox=" "id;tenant_id;name;deleted_at;phone;markbox="
  mutante M2 "trae el Shipping Mark real" copia-columnas.tsv "T2" "T1 T4" \
    "markbox='SINT-' || left(md5(id::text), 12)" "markbox"
  mutante M3 "trae author_name" copia-columnas.tsv "T2" "T1 T4" \
    "id;tenant_id;conversation_id;direction;body;sent_at;external_msg_id;author_user_id" "id;tenant_id;conversation_id;direction;body;sent_at;external_msg_id;author_user_id;author_name"
  mutante M4 "trae los mensajes de hilos que no son del portal" copia-columnas.tsv "T2" "T1" \
    "tenant_id = :'tenant' and conversation_id in (select c.id from public.conversations c where c.tenant_id = :'tenant' and c.channel = 'portal')" \
    "tenant_id = :'tenant'"
  mutante M5 "trae los mensajes de otro tenant" copia-columnas.tsv "T2 T4" "" \
    "tenant_id = :'tenant' and conversation_id in (select c.id from public.conversations c where c.tenant_id = :'tenant' and c.channel = 'portal')" \
    "conversation_id in (select c.id from public.conversations c where c.channel = 'portal')"
  mutante M6 "trae contacts.phone_number" copia-columnas.tsv "T2" "T1 T4" \
    "id;account_id;identifier;name='SINT contacto ' || id;" "id;account_id;identifier;phone_number;name='SINT contacto ' || id;"
  mutante M7 "trae el nombre real del contacto" copia-columnas.tsv "T2" "T1 T4" \
    "name='SINT contacto ' || id" "name"
  mutante M8 "trae los correos reales de los usuarios" copia-columnas.tsv "T2" "T1 T4" \
    "email='sint-' || id || '@copia.invalid'" "email"
  mutante M9 "trae la URL real del webhook" copia-columnas.tsv "T2" "T1 T4" \
    "url='https://copia.invalid/hook'" "url"
  mutante M10 "trae el hmac_token de la bandeja" copia-columnas.tsv "T2" "T1 T4" \
    "chatwoot	public.channel_api	id;account_id;" "chatwoot	public.channel_api	id;account_id;hmac_token;"
  mutante M11 "contactos de cualquier cuenta" copia-columnas.tsv "T1 T4" "" \
    "account_id = :cuenta and identifier like 'dtd-portal:%'" "identifier like 'dtd-portal:%'"
  mutante M12 "mensajes de cualquier bandeja de la cuenta" copia-columnas.tsv "T1 T4" "" \
    "chatwoot	public.messages	id;account_id;inbox_id;conversation_id;message_type;source_id;sender_type;sender_id;created_at;updated_at	inbox_id = :bandeja and account_id = :cuenta" \
    "chatwoot	public.messages	id;account_id;inbox_id;conversation_id;message_type;source_id;sender_type;sender_id;created_at;updated_at	account_id = :cuenta"
  mutante M13 "el nombre real de la cuenta" copia-columnas.tsv "T2" "T1 T4" \
    "id;name='SINT cuenta';locale" "id;name;locale"
  mutante M17 "copia additional_attributes entero" copia-columnas.tsv "T2" "T1 T4" \
    "additional_attributes=case when additional_attributes ? 'dtd_hilo' then jsonb_build_object('dtd_hilo', additional_attributes->'dtd_hilo') else '{}'::jsonb end" \
    "additional_attributes"
  # Revisión del DG de la #473 (a43b4267b): pubsub_token es una credencial; minimización del espejo y los eventos.
  mutante M21 "copia el pubsub_token real" copia-columnas.tsv "T2" "T1 T4" \
    "pubsub_token=md5(random()::text || id::text)" "pubsub_token"
  mutante M23 "copia el espejo de todo el tenant" copia-columnas.tsv "T6" "T1 T2 T4" \
    "client_id;last_activity_at;source_updated_at	tenant_id = :'tenant' and conversation_id in" \
    "client_id;last_activity_at;source_updated_at	tenant_id = :'tenant' or conversation_id in"
  mutante M24 "copia los eventos de todo el tenant" copia-columnas.tsv "T6" "T1 T2 T4" \
    "status;received_at	tenant_id = :'tenant' and conversation_id in" "status;received_at	tenant_id = :'tenant' or conversation_id in"
  # El modo completo, con el cargador mutado: C-10, C-12 y C-13 se miden sobre la copia real (bloqueante del DG).
  mutante M18 "el cargador carga todo como resolved" cargar-portal.rb "E-V13" "T2 T4 E-E1 E-E2" \
    "status: Conversation.statuses.fetch(c['estado'])," "status: Conversation.statuses.fetch('resolved')," completo
  mutante M19 "el cargador invierte el orden de los mensajes" cargar-portal.rb "E-V12" "T2 T4 E-E1 E-E2" \
    "cuando = instante(m['created_at'])" "cuando = Time.zone.now - mensajes.index(m)" completo
  mutante M20 "el cargador pone teléfono a los contactos" cargar-portal.rb "E-V10" "T2 T4 E-E1 E-E2" \
    "name: c['nombre'].presence || 'Cliente del portal', identifier: ident," \
    "name: c['nombre'].presence || 'Cliente del portal', identifier: ident, phone_number: '+584127770009'," completo
  mutante M27 "con docker caído, un ensayo de verdad no borra sus carpetas" ensayo-portal.sh "G6" "G1 G2 G3 G4 G5" \
    'if [ "$CREADO" != 1 ]; then # --limpiar puro: ante la duda no se borra' 'if true; then' guardas
  mutante M28 "con docker colgado, borra las carpetas después de esperarlo" ensayo-portal.sh "G7" "G1 G2 G3 G4 G5 G6" \
    '    rm -rf -- /dev/shm/portal-ensayo /dev/shm/portal-historial
  fi
  RECURSOS_ANTES=' '    :
  fi
  RECURSOS_ANTES=' guardas
  mutante M25 "--limpiar borra aunque docker no responda" ensayo-portal.sh "G5" "G1 G2 G3 G4" \
    "case \"\$RECURSOS_ANTES\" in *'?'*)" "case \"\$RECURSOS_ANTES\" in *'nunca'*)" guardas
  mutante M26 "copia additional_attributes entero cuando no hay dtd_hilo" copia-columnas.tsv "T2" "T1 T4" \
    "else '{}'::jsonb end" "else additional_attributes end"
  mutante M22 "--limpiar borra /dev/shm/portal-historial sin un ensayo" ensayo-portal.sh "G4" "G1 G2 G3" \
    'if [ "$CREADO" = 1 ] || [ "$HABIA_ENSAYO" = si ]; then' 'if true; then' guardas
  mutante M14 "sin la guarda de DB_CW" ensayo-portal.sh "G1" "G2 G3" \
    'if [ -n "${DB_CW:-}" ] && [ "$DB_CW" != "$RAILS_COPIA" ]; then' 'if false; then' guardas
  mutante M15 "sin la guarda de /dev/shm/portal-historial" ensayo-portal.sh "G2" "G1 G3" \
    'if [ -e "$SHM" ]; then' 'if false; then' guardas
  # El --solo-copia del 2026-11-14: el esquema de la copia con el tipo inventado. Sin la guarda, el COPY falla a medias
  # (código 1, D1); con ella, se para con 7 antes de copiar nada (T8).
  mutante M29 "el esquema de la copia con crm_historial_etapas.id uuid" ensayo-studio-esquema.sql "T7" "T8" \
    "  id           bigint generated by default as identity primary key," "  id           uuid primary key default gen_random_uuid()," tipos
  mutante M16 "vuelca fuera de la prueba" ensayo-portal.sh "G3" "G1 G2" \
    'if [ "${ENSAYO_PRUEBA:-}" != 1 ] || [ "$PROD_STUDIO" = dtd-cargo-db-1 ] || [ "$PROD_PG" = chatwoot-postgres-1 ]; then' 'if false; then' guardas
else
  log "== M. mutantes NO EJECUTADOS (--sin-mutantes)"
fi

if [ "$FALLAS" -gt 0 ] && [ "${CI:-}" = true ]; then
  # Solo datos inventados: la salida del ensayo ayuda a leer el rojo desde el log del CI.
  for f in "$TRABAJO"/ensayo.txt "$TRABAJO"/*.txt.evidencia; do echo "--- $(basename "$f")"; tail -n 40 "$f"; done
fi
log "== resultado: $FALLAS fallas · salidas en $TRABAJO"
[ "$FALLAS" = 0 ]
