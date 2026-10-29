#!/usr/bin/env bash
# infra/chatwoot/pruebas/ensayo-local.sh — prueba LOCAL de E1 con Docker (SDD-0583).
# Nunca en el VPS. Solo datos sintéticos. Es una corrida pesada: una a la vez.
#
# Fases y comprobaciones (cada una imprime PASÓ o FALLÓ):
#   A  control SIN redacción: los datos sintéticos TIENEN que aparecer en los logs
#   B  stack real:
#      C1 GET /api → versión 4.19.1           C5 access log: whoami sí, Chatwoot no
#      C2 registro cerrado (valor efectivo)    C6 redacción: cero datos sintéticos en logs
#      C3 sin X-Frame-Options, frame-ancestors C7 MAX_USER_SESSIONS y telemetría
#      C4 /super_admin: 403 desde «internet»,  C8 consumo con docker stats
#         200 desde la «tailnet»
#   C  respaldo conjunto + restauración en un proyecto nuevo:
#      R1 respaldo.sh cifrado, R2 restaurar.sh con conteos iguales, R3 adjunto y
#      secreto cifrado idénticos, R4 control: con otras claves el secreto no se recupera
#      y R4b restaurar.sh lo detecta y sale ≠ 0
#   D  Cloudflare Access (P3 sin Tailscale): D1 token válido abre /super_admin y nada más
#      lo abre; D2 tokens malos y forjados → 403; D3 verificador caído → cierra; D4 log
#      sin tokens ni correos
#
# Uso:  bash infra/chatwoot/pruebas/ensayo-local.sh [--conservar] [--solo-b]
#   --conservar  no baja los stacks al final (para mirar a mano)
#   --solo-b     se salta el control A (solo para iterar; el cierre exige A)
# Salida: el resumen va a stdout y a $TRABAJO/resumen.txt.
set -uo pipefail
export MSYS_NO_PATHCONV=1

CONSERVAR=0; SOLO_B=0
for a in "$@"; do
  case "$a" in --conservar) CONSERVAR=1 ;; --solo-b) SOLO_B=1 ;; *) echo "opción desconocida: $a"; exit 2 ;; esac
done

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIGEN="$(cd "$AQUI/.." && pwd)"
TRABAJO="${ENSAYO_TRABAJO:-${TEMP:-/tmp}/cw-e1}"
TRABAJO="$(cd "$(dirname "$TRABAJO")" && pwd)/$(basename "$TRABAJO")"
HOST_CHAT="chat.prueba.test"
HOST_RESTAURADO="chat-restaurado.prueba.test"
URL="http://127.0.0.1:18080"
FALLAS=0
RESUMEN="$TRABAJO/resumen.txt"

mkdir -p "$TRABAJO"
log() { echo "$*" | tee -a "$RESUMEN"; }
ok() { log "PASÓ  $1 — $2"; }
mal() { log "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
check() { if [ "$2" = 0 ]; then ok "$1" "$3"; else mal "$1" "$3"; fi; }

# Copia de infra/chatwoot como la del servidor (/srv/chatwoot) + overlay local.
preparar_carpeta() {
  local dir="$1"
  mkdir -p "$dir"
  cp "$ORIGEN/compose.yml" "$ORIGEN/respaldo.sh" "$ORIGEN/restaurar.sh" "$dir/"
  cp -r "$ORIGEN/rails" "$ORIGEN/cf-access" "$ORIGEN/pruebas" "$dir/"
  cp "$ORIGEN/pruebas/compose.local.yml" "$dir/compose.override.yml"
}

# .env de prueba: secretos aleatorios, nada del .env.example de producción.
generar_env() {
  local dir="$1" host="$2"
  local pk dk salt
  pk="$(openssl rand -hex 16)"; dk="$(openssl rand -hex 16)"; salt="$(openssl rand -hex 16)"
  cat >"$dir/.env" <<EOF
CHATWOOT_HOST=$host
CHATWOOT_EDGE_NETWORK=chatwoot_edge_prueba
TRAEFIK_ENTRYPOINT=websecure
CHATWOOT_TLS=false
CHATWOOT_FORCE_SSL=false
CHATWOOT_FRAME_ANCESTORS=https://studio.prueba.test
CHATWOOT_FRONTEND_URL=http://$host
CHATWOOT_SECRET_KEY_BASE=$(openssl rand -hex 64)
CHATWOOT_MAX_USER_SESSIONS=5
CHATWOOT_AR_ENCRYPTION_PRIMARY_KEY=$pk
CHATWOOT_AR_ENCRYPTION_DETERMINISTIC_KEY=$dk
CHATWOOT_AR_ENCRYPTION_KEY_DERIVATION_SALT=$salt
CHATWOOT_POSTGRES_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_REDIS_PASSWORD=$(openssl rand -hex 24)
CHATWOOT_MAILER_SENDER_EMAIL=prueba@example.test
CHATWOOT_SMTP_ADDRESS=mailpit
CHATWOOT_SMTP_PORT=1025
CHATWOOT_SMTP_AUTHENTICATION=
CHATWOOT_SMTP_ENABLE_STARTTLS_AUTO=false
CHATWOOT_SMTP_OPENSSL_VERIFY_MODE=none
CHATWOOT_BACKUP_AGE_RECIPIENTS=$TRABAJO/claves/destinatarios.txt
EOF
}

dc() { local dir="$1" p="$2"; shift 2; (cd "$dir" && docker compose -p "$p" "$@"); }
runner() { # dir proyecto archivo.rb (ruta RELATIVA a dir: docker.exe no entiende /tmp/... de Git Bash)
  dc "$1" "$2" cp "$3" rails:/tmp/sonda.rb >/dev/null && dc "$1" "$2" exec -T rails bundle exec rails runner /tmp/sonda.rb
}
contar() { grep -c -- "$1" "$2" 2>/dev/null || true; }
bajar() { dc "$1" "$2" down -v --remove-orphans >/dev/null 2>&1; }

bajar_todo() {
  for p in chatwoot-control:control chatwoot-prueba:origen chatwoot-restaurado:restaurado chatwoot-sin-claves:sin-claves; do
    [ -d "$TRABAJO/${p#*:}" ] && bajar "$TRABAJO/${p#*:}" "${p%%:*}"
  done
  (cd "$ORIGEN/pruebas" && docker compose -f compose.traefik-prueba.yml down >/dev/null 2>&1)
  docker rm -f jwks-prueba >/dev/null 2>&1
  docker network rm chatwoot_edge_prueba internet_prueba >/dev/null 2>&1
  return 0
}
limpiar() {
  [ "$CONSERVAR" = 1 ] && { log "(--conservar: stacks arriba en $TRABAJO)"; return; }
  bajar_todo
}
# Restos de una corrida anterior con --conservar: abajo antes de empezar.
bajar_todo
rm -rf "$TRABAJO"; mkdir -p "$TRABAJO"
: >"$RESUMEN"
trap limpiar EXIT

# ── Preparación ──────────────────────────────────────────────────────────────
log "== ensayo local E1 · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
docker build -q -t dtd-age:local - >/dev/null <<'EOF'
FROM alpine:3.22
RUN apk add --no-cache age
EOF
mkdir -p "$TRABAJO/claves"
docker run --rm dtd-age:local age-keygen 2>/dev/null >"$TRABAJO/claves/clave.txt"
grep -o 'age1[0-9a-z]*' "$TRABAJO/claves/clave.txt" | head -n 1 >"$TRABAJO/claves/destinatarios.txt"
export AGE_KEYDIR="$TRABAJO/claves" AGE_BIN="$ORIGEN/pruebas/age-en-docker.sh"

docker network create --subnet 100.64.250.0/24 chatwoot_edge_prueba >/dev/null
docker network create internet_prueba >/dev/null
(cd "$ORIGEN/pruebas" && docker compose -f compose.traefik-prueba.yml up -d --wait >/dev/null) \
  || { mal P0 "no arrancó el Traefik de prueba"; exit 1; }

sonda_logs() { # dir proyecto → escribe $TRABAJO/<proyecto>-logs.txt
  local dir="$1" p="$2" salida="$TRABAJO/$2-logs.txt"
  runner "$dir" "$p" pruebas/sonda-redaccion.rb >"$TRABAJO/$p-runner.txt" 2>&1
  curl -s -o /dev/null -H "Host: $(sed -n 's/^CHATWOOT_HOST=//p' "$dir/.env")" \
    "$URL/api/v1/accounts/1/contacts/search?q=%2B584125550101&email=ana.sintetica.e1%40example.test&content=MARCA-SINTETICA-E1"
  sleep 20 # retry_on espera 3 s; Sidekiq toma el trabajo y la clase inexistente
  { cat "$TRABAJO/$p-runner.txt"; dc "$dir" "$p" logs --no-color rails sidekiq; } >"$salida" 2>&1
  echo "$salida"
}
marcas() { # archivo → "correo teléfono contenido payload="
  echo "$(contar 'ana.sintetica.e1@example.test' "$1") $(contar '584125550101' "$1") $(contar 'MARCA-SINTETICA-E1' "$1") $(contar 'payload={' "$1")"
}

# ── A. Control sin redacción ─────────────────────────────────────────────────
if [ "$SOLO_B" = 0 ]; then
  log "== A. control sin redacción"
  D="$TRABAJO/control"; preparar_carpeta "$D"; generar_env "$D" "$HOST_CHAT"
  if dc "$D" chatwoot-control -f compose.yml -f compose.override.yml -f pruebas/compose.sin-redaccion.yml up -d --wait >"$TRABAJO/control-up.txt" 2>&1; then
    L="$(sonda_logs "$D" chatwoot-control)"
    read -r c t m p <<<"$(marcas "$L")"
    log "   control: correo=$c teléfono=$t contenido=$m payload==$p"
    [ "$c" -gt 0 ] && [ "$t" -gt 0 ] && [ "$m" -gt 0 ] && [ "$p" -gt 0 ]
    check A1 $? "sin redacción, la sonda ENCUENTRA correo, teléfono, contenido y payload= en los logs (la prueba sabe detectar la fuga)"
  else
    mal A1 "el stack de control no arrancó (ver $TRABAJO/control-up.txt)"
  fi
  bajar "$D" chatwoot-control
fi

# ── B. Stack real ────────────────────────────────────────────────────────────
log "== B. stack real"
D="$TRABAJO/origen"; preparar_carpeta "$D"; generar_env "$D" "$HOST_CHAT"
T0="$(date +%s)"
if ! dc "$D" chatwoot-prueba up -d --wait >"$TRABAJO/origen-up.txt" 2>&1; then
  mal B0 "el stack no arrancó (ver $TRABAJO/origen-up.txt)"; exit 1
fi
log "   arranque desde cero (prepare + rails + sidekiq): $(( $(date +%s) - T0 )) s"

API="$(curl -s -H "Host: $HOST_CHAT" "$URL/api")"
echo "$API" | grep -q '"version":"4.19.1"'
check C1 $? "GET /api por Traefik → $(echo "$API" | grep -o '"version":"[^"]*"')"

SIGNUP="$(dc "$D" chatwoot-prueba exec -T rails bundle exec rails runner 'print GlobalConfigService.account_signup_enabled?' 2>/dev/null | tail -n 1)"
COD_ALTA="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $HOST_CHAT" -H 'Content-Type: application/json' \
  -d '{"account_name":"x","user_full_name":"x","email":"alta.sintetica@example.test","password":"Pw-123456-a!"}' "$URL/api/v1/accounts")"
[ "$SIGNUP" = "false" ] && [ "$COD_ALTA" != 200 ]
check C2 $? "registro cerrado: valor efectivo=$SIGNUP; POST /api/v1/accounts → $COD_ALTA"

CAB="$(curl -s -D - -o /dev/null -H "Host: $HOST_CHAT" "$URL/app/login")"
echo "$CAB" | grep -qi '^x-frame-options' ; NO_XFO=$?
echo "$CAB" | grep -qi "^content-security-policy: frame-ancestors 'self' https://studio.prueba.test" ; CSP=$?
[ "$NO_XFO" != 0 ] && [ "$CSP" = 0 ]
check C3 $? "cabeceras de /app/login: $(echo "$CAB" | grep -i -E '^(x-frame-options|content-security-policy|strict-transport-security)' | tr -d '\r' | tr '\n' ';')"

COD_INTERNET="$(docker run --rm --network internet_prueba curlimages/curl:8.17.0 -s -o /dev/null -w '%{http_code}' -H "Host: $HOST_CHAT" http://chatwoot-traefik-prueba-traefik-1/super_admin/sign_in)"
COD_MONITOR="$(docker run --rm --network internet_prueba curlimages/curl:8.17.0 -s -o /dev/null -w '%{http_code}' -H "Host: $HOST_CHAT" http://chatwoot-traefik-prueba-traefik-1/monitoring/sidekiq)"
COD_TAILNET="$(docker run --rm --network chatwoot_edge_prueba --ip 100.64.250.200 curlimages/curl:8.17.0 -s -o /dev/null -w '%{http_code}' -H "Host: $HOST_CHAT" http://chatwoot-traefik-prueba-traefik-1/super_admin/sign_in)"
COD_ONB_I="$(docker run --rm --network internet_prueba curlimages/curl:8.17.0 -s -o /dev/null -w '%{http_code}' -H "Host: $HOST_CHAT" http://chatwoot-traefik-prueba-traefik-1/installation/onboarding)"
COD_ONB_T="$(docker run --rm --network chatwoot_edge_prueba --ip 100.64.250.200 curlimages/curl:8.17.0 -s -o /dev/null -w '%{http_code}' -H "Host: $HOST_CHAT" http://chatwoot-traefik-prueba-traefik-1/installation/onboarding)"
[ "$COD_INTERNET" = 403 ] && [ "$COD_MONITOR" = 403 ] && [ "$COD_TAILNET" = 200 ] && [ "$COD_ONB_I" = 403 ] && [ "$COD_ONB_T" = 200 ]
check C4 $? "desde internet: /super_admin $COD_INTERNET, /monitoring $COD_MONITOR, /installation/onboarding $COD_ONB_I; desde 100.64.250.200: /super_admin $COD_TAILNET, /installation/onboarding $COD_ONB_T"

# Cierre del onboarding por consola, como en el runbook (§5): sin él, /app/login manda
# a /installation/onboarding, donde el primer visitante crearía el super admin.
dc "$D" chatwoot-prueba exec -T rails bundle exec rails runner 'Redis::Alfred.delete(Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING)' >/dev/null 2>&1
COD_ONB_T2="$(docker run --rm --network chatwoot_edge_prueba --ip 100.64.250.200 curlimages/curl:8.17.0 -s -o /dev/null -w '%{http_code}' -H "Host: $HOST_CHAT" http://chatwoot-traefik-prueba-traefik-1/installation/onboarding)"
COD_APP="$(docker run --rm --network internet_prueba curlimages/curl:8.17.0 -s -o /dev/null -w '%{http_code}' -H "Host: $HOST_CHAT" http://chatwoot-traefik-prueba-traefik-1/app/login)"
[ "$COD_ONB_T2" = 302 ] && [ "$COD_APP" = 200 ]
check C4b $? "onboarding cerrado por consola: /installation/onboarding desde la tailnet → $COD_ONB_T2; /app/login desde internet → $COD_APP"

curl -s -o /dev/null -H 'Host: whoami.prueba.test' "$URL/control-access-log"
sleep 2
TLOG="$TRABAJO/traefik-logs.txt"
(cd "$ORIGEN/pruebas" && docker compose -f compose.traefik-prueba.yml logs --no-color traefik) >"$TLOG" 2>&1
N_WHOAMI="$(contar 'whoami.prueba.test' "$TLOG")"; N_CHAT="$(contar "\"RequestHost\":\"$HOST_CHAT\"" "$TLOG")"
[ "$N_WHOAMI" -gt 0 ] && [ "$N_CHAT" = 0 ]
check C5 $? "access log de Traefik: whoami=$N_WHOAMI líneas (control), $HOST_CHAT=$N_CHAT"

L="$(sonda_logs "$D" chatwoot-prueba)"
read -r c t m p <<<"$(marcas "$L")"
N_TLOG_PII="$(( $(contar 'ana.sintetica.e1' "$TLOG") + $(contar '584125550101' "$TLOG") ))"
grep -q 'redacción de logs activa' "$L"; ACTIVA=$?
[ "$c" = 0 ] && [ "$t" = 0 ] && [ "$m" = 0 ] && [ "$p" = 0 ] && [ "$N_TLOG_PII" = 0 ] && [ "$ACTIVA" = 0 ]
check C6 $? "con redacción: correo=$c teléfono=$t contenido=$m payload==$p en Rails+Sidekiq; en Traefik=$N_TLOG_PII; marcas [REDACTADO]=$(contar 'REDACTADO' "$L"), [FILTERED]=$(contar 'FILTERED' "$L")"

ENV_RAILS="$(dc "$D" chatwoot-prueba exec -T rails printenv MAX_USER_SESSIONS DISABLE_TELEMETRY ENABLE_PUSH_RELAY_SERVER ENABLE_ACCOUNT_SIGNUP DISABLE_GRAVATAR | tr -d '\r' | tr '\n' ' ')"
GRAVATAR="$(dc "$D" chatwoot-prueba exec -T rails bundle exec rails runner "print 'gravatar_apagado=', GlobalConfigService.load('DISABLE_GRAVATAR', '').present?" 2>/dev/null | grep -o 'gravatar_apagado=[a-z]*')"
[ "$ENV_RAILS" = "5 true false false true " ] && [ "$GRAVATAR" = "gravatar_apagado=true" ]
check C7 $? "entorno de rails: MAX_USER_SESSIONS DISABLE_TELEMETRY ENABLE_PUSH_RELAY_SERVER ENABLE_ACCOUNT_SIGNUP DISABLE_GRAVATAR = $ENV_RAILS; valor efectivo: $GRAVATAR"

sleep 30
docker stats --no-stream --format '{{.Name}} cpu={{.CPUPerc}} mem={{.MemUsage}}' $(dc "$D" chatwoot-prueba ps -q) >"$TRABAJO/stats.txt"
log "   C8 consumo en reposo (docker stats):"; sed 's/^/      /' "$TRABAJO/stats.txt" | tee -a "$RESUMEN" >/dev/null
docker inspect --format '{{.Name}} cpus={{.HostConfig.NanoCpus}} mem={{.HostConfig.Memory}} shares={{.HostConfig.CpuShares}} oom={{.HostConfig.OomScoreAdj}} pids={{.HostConfig.PidsLimit}}' \
  $(dc "$D" chatwoot-prueba ps -q) | sed 's/^/      /' | tee -a "$RESUMEN" >/dev/null
ok C8 "límites aplicados (ver líneas de arriba)"

# ── C. Respaldo conjunto y restauración ─────────────────────────────────────
log "== C. respaldo y restauración"
SEMBRADO="$(runner "$D" chatwoot-prueba pruebas/sembrar.rb 2>&1 | grep -E '^(sembrado|huella|secreto)')"
echo "$SEMBRADO" | sed 's/^/   /' | tee -a "$RESUMEN" >/dev/null
echo "$SEMBRADO" | grep -q 'secreto_cifrado_en_base=si'
check R0 $? "el secreto del webhook quedó cifrado en la base (no en claro)"

bash "$D/respaldo.sh" --dir "$D" --project chatwoot-prueba --sin-remoto --work-dir "$TRABAJO" >"$TRABAJO/respaldo.txt" 2>&1
RC=$?; RESP="$(ls -d "$D"/respaldos/chatwoot-* 2>/dev/null | head -n 1)"
[ "$RC" = 0 ] && [ -n "$RESP" ] && ! ls "$RESP" | grep -v -E '\.age$|^manifiesto\.txt$' | grep -q .
check R1 $? "respaldo.sh salió $RC; piezas: $(ls "$RESP" 2>/dev/null | tr '\n' ' ')"
grep -E '^(dump_entradas|storage_archivos|cuentas|mensajes|adjuntos)=' "$RESP/manifiesto.txt" 2>/dev/null | sed 's/^/   /' | tee -a "$RESUMEN" >/dev/null
# Correos (el `@sha256:` del digest de la imagen no cuenta: no lleva punto después).
[ "$(grep -c -E 'MARCA|Sintetic|[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.' "$RESP/manifiesto.txt" || true)" = 0 ]
check R1b $? "el manifiesto en claro no lleva datos de contacto ni contenido"

R="$TRABAJO/restaurado"; mkdir -p "$R"; preparar_carpeta "$R"
T0="$(date +%s)"
bash "$R/restaurar.sh" --desde "$RESP" --identidad "$TRABAJO/claves/clave.txt" --dir "$R" --project chatwoot-restaurado \
  --sobrescribir "CHATWOOT_HOST=$HOST_RESTAURADO" --sobrescribir "CHATWOOT_FRONTEND_URL=http://$HOST_RESTAURADO" \
  >"$TRABAJO/restaurar.txt" 2>&1
RC=$?; RTO=$(( $(date +%s) - T0 ))
sed 's/^/   /' "$TRABAJO/restaurar.txt" | grep -E 'OK|DISTINTO|tiempos|restaurar:' | tee -a "$RESUMEN" >/dev/null
check R2 $RC "restaurar.sh en proyecto nuevo: conteos y archivos contra el manifiesto ($RTO s de punta a punta)"

VERIF="$(runner "$R" chatwoot-restaurado pruebas/verificar.rb 2>&1 | grep '^huella')"
H_ADJ_O="$(echo "$SEMBRADO" | sed -n 's/^huella_adjunto=//p')"; H_ADJ_R="$(echo "$VERIF" | sed -n 's/^huella_adjunto=//p')"
H_SEC_O="$(echo "$SEMBRADO" | sed -n 's/^huella_secreto=//p')"; H_SEC_R="$(echo "$VERIF" | sed -n 's/^huella_secreto=//p')"
[ -n "$H_ADJ_O" ] && [ "$H_ADJ_O" = "$H_ADJ_R" ] && [ -n "$H_SEC_O" ] && [ "$H_SEC_O" = "$H_SEC_R" ]
check R3 $? "restaurado: adjunto ${H_ADJ_R:0:12}… = origen ${H_ADJ_O:0:12}…; secreto cifrado ${H_SEC_R:0:12}… = origen ${H_SEC_O:0:12}…"
API_R="$(curl -s -H "Host: $HOST_RESTAURADO" "$URL/api" | grep -o '"version":"[^"]*"')"
[ "$API_R" = '"version":"4.19.1"' ]
check R3b $? "el restaurado responde por Traefik en su propio host: $API_R"

# Control: misma base y adjuntos, OTRAS claves → el secreto no se puede leer.
S="$TRABAJO/sin-claves"; mkdir -p "$S"; preparar_carpeta "$S"; generar_env "$S" "chat-sin-claves.prueba.test"
bash "$S/restaurar.sh" --desde "$RESP" --identidad "$TRABAJO/claves/clave.txt" --dir "$S" --project chatwoot-sin-claves \
  --usar-env-destino >"$TRABAJO/sin-claves.txt" 2>&1
RC_S=$?
[ "$RC_S" != 0 ] && grep -q 'NO abren las columnas cifradas' "$TRABAJO/sin-claves.txt"
check R4b $? "restaurar.sh con otras claves sale $RC_S y lo dice: $(grep -o 'CLAVES total=[0-9]* sobres=[0-9]*' "$TRABAJO/sin-claves.txt")"
# Chatwoot no lanza error (support_unencrypted_data): devuelve el sobre cifrado como si
# fuera el valor. Lo que se exige es que NO salga el secreto original.
VERIF_S="$(runner "$S" chatwoot-sin-claves pruebas/verificar.rb 2>&1 | grep -E '^(huella_secreto|secreto_es_sobre)')"
H_SEC_S="$(echo "$VERIF_S" | sed -n 's/^huella_secreto=//p')"
[ -n "$H_SEC_S" ] && [ "$H_SEC_S" != "$H_SEC_O" ]
check R4 $? "control con otras claves: secreto ${H_SEC_S:0:12}… ≠ origen ${H_SEC_O:0:12}…; $(echo "$VERIF_S" | grep sobre) (sin las claves del .env el secreto no se recupera, y Chatwoot no avisa)"

# ── D. Cloudflare Access en lugar de Tailscale (P3) ─────────────────────────
# El stack real pasa al modo Access: perfil cf-access (servicio `acceso`) y el router de
# administración con <proyecto>-cf-access@docker. «Cloudflare» lo simulan un servidor de
# claves falso (jwks-prueba, en la red edge) y tokens firmados aquí; el cliente manda la
# cabecera Cf-Access-Jwt-Assertion como la mandaría Cloudflare.
log "== D. Cloudflare Access (forwardAuth al verificador del JWT)"
J="$TRABAJO/jwks"; TEAM="http://jwks-prueba:8080"; AUD="aud-prueba-0583"; CORREO="sam.sintetico@example.test"
# Ruta de Windows para node y docker: con MSYS_NO_PATHCONV, node lee «/tmp/…» como C:\tmp\…,
# que no es el /tmp de Git Bash (se medía: claves y tokens quedaban en otra carpeta).
mkdir -p "$J"; JW="$(cd "$J" && pwd -W 2>/dev/null || pwd)"
node "$(cd "$ORIGEN/pruebas" && pwd -W 2>/dev/null || pwd)/firmar-jwt-prueba.mjs" "$JW" "$TEAM" "$AUD" "$CORREO" >/dev/null
[ -s "$J/tokens.env" ] && [ -s "$J/cdn-cgi/access/certs" ] || mal D0 "no se generaron las claves y los tokens de prueba en $J"
docker run -d --rm --name jwks-prueba --network chatwoot_edge_prueba -v "$JW:/srv:ro" \
  node:24.22.1-alpine node -e "const h=require('http'),f=require('fs');h.createServer((q,s)=>{try{s.writeHead(200,{'content-type':'application/json'});s.end(f.readFileSync('/srv'+q.url.split('?')[0]))}catch{s.writeHead(404);s.end()}}).listen(8080)" >/dev/null
cat >>"$D/.env" <<EOF
CHATWOOT_CF_ACCESS_TEAM_DOMAIN=$TEAM
CHATWOOT_CF_ACCESS_AUD=$AUD
CHATWOOT_CF_ACCESS_EMAILS=$CORREO
CHATWOOT_CF_ACCESS_PERMITIR_HTTP=1
CHATWOOT_ADMIN_ALLOWLIST_MIDDLEWARE=chatwoot-prueba-cf-access@docker
COMPOSE_PROFILES=cf-access
EOF
dc "$D" chatwoot-prueba up -d --wait >"$TRABAJO/access-up.txt" 2>&1; RC=$?
check D0 $RC "modo Access arriba: servicio acceso sano y rails recreado con el middleware"
tok() { sed -n "s/^$1=//p" "$J/tokens.env"; }
admin() { # red ip ruta [token]
  local red="$1" ip="$2" ruta="$3" t="${4:-}"
  docker run --rm --network "$red" ${ip:+--ip "$ip"} curlimages/curl:8.17.0 -s -o /dev/null -w '%{http_code}' \
    -H "Host: $HOST_CHAT" ${t:+-H "Cf-Access-Jwt-Assertion: $t"} "http://chatwoot-traefik-prueba-traefik-1$ruta"
}
SIN="$(admin internet_prueba "" /super_admin/sign_in)"
OK="$(admin internet_prueba "" /super_admin/sign_in "$(tok VALIDO)")"
MON="$(admin internet_prueba "" /monitoring/sidekiq)"
TAIL="$(admin chatwoot_edge_prueba 100.64.250.201 /super_admin/sign_in)"
[ "$SIN" = 403 ] && [ "$OK" = 200 ] && [ "$MON" = 403 ] && [ "$TAIL" = 403 ]
check D1 $? "sin token /super_admin $SIN; con token válido $OK; /monitoring sin token $MON; desde la «tailnet» sin token $TAIL (Tailscale ya no abre)"
MALOS=""; for c in AUD_MALA ISS_MALO VENCIDO FIRMA_AJENA CORREO_AJENO; do MALOS="$MALOS $c=$(admin internet_prueba "" /super_admin/sign_in "$(tok $c)")"; done
FORJADO="$(admin internet_prueba "" /super_admin/sign_in "eyJhbGciOiJub25lIn0.eyJhdWQiOiJ4In0.")"
# Solo vale si el token válido abre (D1): si nada abre, «todos 403» no prueba nada.
[ "$OK" = 200 ] && [ "$(echo "$MALOS" | grep -o '=403' | wc -l | tr -d ' ')" = 5 ] && [ "$FORJADO" = 403 ]
check D2 $? "tokens malos →$MALOS; forjado sin firma=$FORJADO"
dc "$D" chatwoot-prueba stop acceso >/dev/null 2>&1
CAIDO="$(admin internet_prueba "" /super_admin/sign_in "$(tok VALIDO)")"
dc "$D" chatwoot-prueba start acceso >/dev/null 2>&1
# Solo vale si D1 abrió con el token válido: si todo daba 404, «cierra» no prueba nada.
[ "$OK" = 200 ] && [ "$CAIDO" != 200 ]
check D3 $? "con el verificador caído, el mismo token válido que abría ($OK) da $CAIDO (cierra, no abre)"
ALOG="$(dc "$D" chatwoot-prueba logs --no-color acceso 2>&1)"
echo "$ALOG" | grep -q 'denegado: aud distinta' && ! echo "$ALOG" | grep -q -E "example\.test|$(tok VALIDO | cut -c1-24)"
check D4 $? "el log del verificador da la razón ($(echo "$ALOG" | grep -o 'denegado: [a-zñáéíóú ]*' | sort -u | tr '\n' ';')) y no muestra tokens ni correos"
docker rm -f jwks-prueba >/dev/null 2>&1

log "== resultado: $FALLAS falla(s)"
exit "$FALLAS"
