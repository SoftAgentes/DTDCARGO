#!/usr/bin/env bash
# infra/chatwoot/pruebas/prueba-correo-sistema.sh — prueba del inicializador de correo automático
# (correo/zz_dtd_correo_sistema.rb, SDD-0582 4.8, P4). Nunca en el VPS. Solo datos inventados, sobre
# la imagen real. Es una corrida pesada (Docker): en la PC, una a la vez; normalmente corre en
# GitHub Actions (.github/workflows/chatwoot-correo-sistema.yml).
#
# Levanta Postgres y Redis del compose real con el overlay local, migra con `prepare` y corre
# pruebas/sonda-correo-sistema.rb con `rails runner` en `prepare`, sin salida a internet:
#
#   T  con el inicializador montado como en el compose real: el rebote y la respuesta automática
#      nuevos quedan con «sistema», resueltos y con la nota; lo demás queda igual
#   C  CONTROL sin el inicializador: el rebote TIENE que quedar abierto y sin etiqueta aunque haya
#      una regla «sistema» (el hallazgo P4 de PC-1). Si no, la sonda no ve el problema
#   M  M0 carga una copia sin cambios con SONDA_CARGAR y TIENE que dar lo mismo que T; cada mutante
#      quita una pieza del inicializador y TIENE que romper su comprobación
#
# Uso:  bash infra/chatwoot/pruebas/prueba-correo-sistema.sh [--conservar]
# Salida: PASÓ/FALLÓ por comprobación en stdout y en $TRABAJO/resumen.txt; sale 0 solo sin fallas.
set -uo pipefail
export MSYS_NO_PATHCONV=1

CONSERVAR=0
for a in "$@"; do
  case "$a" in --conservar) CONSERVAR=1 ;; *) echo "opción desconocida: $a"; exit 2 ;; esac
done

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ORIGEN="$(cd "$AQUI/.." && pwd)"
TRABAJO="${PRUEBA_TRABAJO:-${TEMP:-/tmp}/cw-correo-sistema}"
TRABAJO="$(cd "$(dirname "$TRABAJO")" && pwd)/$(basename "$TRABAJO")"
D="$TRABAJO/stack"
P="chatwoot-correo-sistema"
EDGE="chatwoot_edge_correo_sistema"
FALLAS=0
RESUMEN="$TRABAJO/resumen.txt"

dc() { (cd "$D" && docker compose -p "$P" "$@"); }
bajar_todo() {
  [ -d "$D" ] && dc down -v --remove-orphans >/dev/null 2>&1
  docker network rm "$EDGE" >/dev/null 2>&1
  return 0
}
bajar_todo
rm -rf "$TRABAJO"; mkdir -p "$D"
: >"$RESUMEN"
limpiar() {
  [ "$CONSERVAR" = 1 ] && { echo "(--conservar: stack arriba en $D)"; return; }
  bajar_todo
}
trap limpiar EXIT

log() { echo "$*" | tee -a "$RESUMEN"; }
ok() { log "PASÓ  $1 — $2"; }
mal() { log "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
exigir() { if eval "$2"; then ok "$1" "$3"; else mal "$1" "$3"; fi; return 0; }
cuenta() { grep -c -F -- "$1" "$2" 2>/dev/null || true; }
h() { sed -n "s/^HECHO $2=//p" "$1" | tail -n 1 | tr -d '\r'; }
# es ARCHIVO clave valor: la sonda dijo exactamente eso
es() { [ "$(h "$1" "$2")" = "$3" ]; }

# Lo que tiene que dar el inicializador entero (T y M0). Cada línea es «clave valor».
ESPERADO=(
  "a_estado resolved" "a_etiquetas sistema" "a_notas 1" "a_aviso_estado 0" "a_auto_reply true"
  "b_estado open" "b_etiquetas prueba-legal" "b_notas 0"
  "c_misma si" "c_estado open" "c_etiquetas -" "c_notas 0"
  "d_estado resolved" "d_etiquetas sistema" "d_notas 1" "d_auto_reply true"
  "e_mensajes 1" "e_notas 1"
  "f_estado resolved" "f_etiquetas -" "f_notas 0"
  "g_estado open" "g_adjuntos 1" "g_tipo file"
  "h_estado_inicio resolved" "h_estado_persona open" "h_misma si" "h_estado open" "h_notas 1"
  "conversaciones 8" "sonda ok"
)
# Las que no cumple: «clave=lo que dio» separadas por espacio; vacío si cumple todas.
diferencias() {
  local f="$1" par clave valor salida=""
  for par in "${ESPERADO[@]}"; do
    clave="${par%% *}"; valor="${par#* }"
    es "$f" "$clave" "$valor" || salida="$salida $clave=$(h "$f" "$clave")"
  done
  echo "${salida# }"
}

# ── Preparación: copia como /srv/chatwoot + overlay local + .env de prueba ────
log "== prueba del correo automático · $(date -u +%Y-%m-%dT%H:%M:%SZ) · trabajo $TRABAJO"
cp "$ORIGEN/compose.yml" "$D/"
cp -r "$ORIGEN/rails" "$ORIGEN/marca" "$ORIGEN/correo" "$ORIGEN/pruebas" "$D/"
cp "$ORIGEN/pruebas/compose.local.yml" "$D/compose.override.yml"
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

# Mutantes: una copia del inicializador con una pieza menos. Cada sed TIENE que cambiar el archivo.
ORIG="$D/correo/zz_dtd_correo_sistema.rb"
MUT="$D/pruebas/mutantes"
mkdir -p "$MUT"
cp "$ORIG" "$MUT/m0.rb"
# id · expresión de sed · clave que tiene que romperse · qué pieza quita
MUTANTES=(
  "m1|s/conversacion.previously_new_record? # \[nueva\]/true # [nueva]/|h_estado|sin la guarda «conversación nueva» se vuelve a cerrar el hilo donde escribió una persona"
  "m2|/# \[automatico\]$/d|b_estado|sin la guarda «automático» se cierra el correo de un cliente"
  "m3|/# \[abierta\]$/d|f_notas|sin la guarda «abierta» se toca lo que ya nació resuelto"
  "m4|s/con_autor(conversacion.inbox) do # \[autor\]/[nil].each do # [autor]/|a_aviso_estado|sin el autor Chatwoot escribe su nota falsa de inactividad"
  "m5|/# \[etiqueta\]$/d|a_etiquetas|sin la etiqueta el rebote no queda marcado «sistema»"
  "m6|/# \[resolver\]$/d|a_estado|sin resolver el rebote sigue en la cola"
  "m7|s/::Conversations::ActivityMessageJob.perform_now( # \[nota\]/[].push( # [nota]/|a_notas|sin la nota nadie sabe por qué se cerró"
)
for m in "${MUTANTES[@]}"; do
  IFS='|' read -r id expr _ _ <<<"$m"
  sed -e "$expr" "$ORIG" >"$MUT/$id.rb"
  exigir "${id^^}a" '! cmp -s "$ORIG" "$MUT/$id.rb"' "el mutante $id cambia el archivo (si no, su sed ya no encuentra la línea)"
done

docker network create "$EDGE" >/dev/null || { mal P0 "no se pudo crear la red $EDGE"; exit 1; }
BASE=(-f compose.yml -f compose.override.yml)

if ! dc "${BASE[@]}" up -d --wait postgres redis >"$TRABAJO/up.txt" 2>&1; then
  mal P0 "Postgres/Redis no arrancaron (ver $TRABAJO/up.txt)"; exit 1
fi
if ! dc "${BASE[@]}" run --rm -T prepare >"$TRABAJO/prepare.txt" 2>&1; then
  mal P0 "db:chatwoot_prepare falló (ver $TRABAJO/prepare.txt)"; exit 1
fi

# Cada caso crea su propia cuenta y su propia bandeja (la sonda le pone un sufijo al azar al
# buzón), así que los casos no se pisan aunque compartan la base.
caso() { # nombre overlay [SONDA_CARGAR] → ruta de la salida
  local overlay="$2" cargar="${3:-}" salida="$TRABAJO/caso-$1.txt"
  local entorno=()
  [ -n "$cargar" ] && entorno=(-e "SONDA_CARGAR=$cargar")
  dc "${BASE[@]}" -f "$overlay" run --rm -T "${entorno[@]}" prepare \
    bundle exec rails runner /tmp/pruebas/sonda-correo-sistema.rb >"$salida" 2>&1
  echo "$salida"
}

# ── T. Con el inicializador montado ──────────────────────────────────────────
log "== T. con el inicializador"
F="$(caso con pruebas/compose.correo-sistema.yml)"
exigir T0 'es "$F" inicializador si && es "$F" metodos ok && [ "$(cuenta "[DTD] correo automático activo" "$F")" -ge 1 ]' \
  "carga al arrancar Rails y Imap::ImapMailbox todavía tiene #process y #find_or_create_conversation"
dif="$(diferencias "$F")"
exigir T1 '[ -z "$dif" ]' "las ${#ESPERADO[@]} comprobaciones de la sonda${dif:+ (no cumplen: $dif)}"
exigir T2 'es "$F" a_estado resolved && es "$F" a_etiquetas sistema && es "$F" a_notas 1' \
  "rebote nuevo: etiqueta «sistema», resuelto y con la nota (la regla «Sonda · sistema» de Chatwoot no actúa)"
exigir T3 'es "$F" b_estado open && es "$F" b_etiquetas prueba-legal && es "$F" c_estado open && es "$F" c_etiquetas -' \
  "correo de cliente y respuesta automática enhebrada: abiertos; la regla legal de Chatwoot sigue actuando"
exigir T4 'es "$F" h_estado_persona open && es "$F" h_estado open' \
  "si una persona escribe en el hilo, Chatwoot lo reabre y no se vuelve a cerrar"
exigir T5 'es "$F" g_adjuntos 1 && es "$F" g_tipo file && [ "$(h "$F" g_bytes)" -gt 0 ]' \
  "P3 en la imagen real: el PDF adjunto de entrada queda como 1 adjunto «file» de $(h "$F" g_bytes) bytes"
lineas="$(grep -F '[DTD] correo automático' "$F" || true)"
ordenadas="$(printf "%s\n" "$lineas" | grep -F "con etiqueta" | grep -o "conversación [0-9]* de la bandeja [0-9]*" | sort -u | wc -l | tr -d ' ')"
exigir T6 '[ "$ordenadas" = 3 ] && ! printf "%s" "$lineas" | grep -q "@"' \
  "el log nombra 3 conversaciones ordenadas (A, D y H; dio $ordenadas) y ninguna línea suya lleva una dirección"

# ── C. Control sin el inicializador ──────────────────────────────────────────
log "== C. control sin el inicializador"
F="$(caso control pruebas/compose.correo-sistema-control.yml)"
exigir C0 'es "$F" inicializador no && es "$F" sonda ok' "la sonda corre sin el inicializador"
exigir C1 'es "$F" a_estado open && es "$F" a_etiquetas - && es "$F" a_auto_reply true && es "$F" d_estado open' \
  "sin el inicializador el rebote y la respuesta automática quedan abiertos y sin etiqueta: el hallazgo P4 se reproduce"
exigir C2 'es "$F" b_etiquetas prueba-legal && es "$F" g_adjuntos 1' \
  "la regla legal y el adjunto no dependen del inicializador"

# ── M. Control M0 y mutantes, cargados con SONDA_CARGAR ──────────────────────
log "== M. control M0 y mutantes"
F="$(caso m0 pruebas/compose.correo-sistema-control.yml /tmp/pruebas/mutantes/m0.rb)"
dif="$(diferencias "$F")"
exigir M0 'es "$F" inicializador si && [ -z "$dif" ]' \
  "la copia sin cambios, cargada con SONDA_CARGAR, da lo mismo que T${dif:+ (no cumplen: $dif)}"
for m in "${MUTANTES[@]}"; do
  IFS='|' read -r id _ clave pieza <<<"$m"
  F="$(caso "$id" pruebas/compose.correo-sistema-control.yml "/tmp/pruebas/mutantes/$id.rb")"
  esperado=""
  for par in "${ESPERADO[@]}"; do [ "${par%% *}" = "$clave" ] && esperado="${par#* }"; done
  exigir "${id^^}" 'es "$F" sonda ok && [ -n "$esperado" ] && ! es "$F" "$clave" "$esperado"' \
    "$pieza ($clave dio «$(h "$F" "$clave")», sin el mutante «$esperado»)"
done

log "== resultado: $FALLAS fallas"
[ "$FALLAS" = 0 ]
