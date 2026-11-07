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
#   V  el guion de PC-3 (correo/bandeja-vzla.rb) con pruebas/sonda-bandeja-vzla.rb: sus negativas
#      terminan en abort, crea la bandeja con IMAP y SMTP apagados y sin claves, y cada regla actúa
#      solo en su bandeja. W1 y W2 son sus mutantes: TIENEN que romper su comprobación sin romper otra
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
  "clase_ausente aviso"
  "a_estado resolved" "a_etiquetas sistema" "a_notas 1" "a_aviso_estado 0" "a_auto_reply true" "a_salientes 0/0/0"
  "p_estado resolved" "p_etiquetas prueba-sistema" "p_notas 0" "p_auto_reply false"
  "b_estado open" "b_etiquetas prueba-legal" "b_notas 0"
  "c_misma si" "c_estado open" "c_etiquetas -" "c_notas 0"
  "d_estado resolved" "d_etiquetas sistema" "d_notas 1" "d_auto_reply true"
  "e_mensajes 1" "e_notas 1"
  "f_estado resolved" "f_etiquetas -" "f_notas 0"
  "g_estado open" "g_adjuntos 1" "g_tipo file"
  "h_estado_inicio resolved" "h_estado_persona open" "h_misma si" "h_estado open" "h_notas 1"
  "z_aviso_estado 1" "conversaciones 10" "correos_enviados 0/0"
  "y_estado resolved" "y_csat si" "sonda ok"
)
# Lo que tiene que dar el guion de PC-3 entero (V). Mismo formato; el valor puede llevar espacios y «|».
ESPERADO_V=(
  "v_sin_miembros abort:si" "v_responsable_fuera abort:si" "v_nada_creado 0"
  "v_crear ok" "v_imap_smtp false/false" "v_claves vacias"
  "v_servidores imap.hostinger.com:993:true|smtp.hostinger.com:587" "v_remitente DTD Cargo/friendly" "v_csat false:si" "v_miembros true"
  "v_reglas 3" "v_reglas_en_bandeja 3" "v_legal_asigna si" "v_etiquetas 3" "v_estado si:si" "v_otra_vez abort:si"
  "v_legal open|legal|urgent|sam" "v_noreply resolved|sistema|-|-" "v_replyto resolved|sistema|-|-"
  "v_banco resolved|no-cliente|-|-" "v_gerencia open|legal|urgent|sam" "v_cliente open|-|-|-" "v_otra open|-|-|-"
  "v_buzon si"
  "v_reglas_sin_variables ok:si" "v_no_cliente_valores 2" "v_legal_sigue si" "v_sistema_conserva si"
  "v_replyto2 resolved|sistema|-|-" "v_no_cliente_suma ok:3" "v_dominio_propio abort:si"
  "v_dominios ok:si" "v_dominios_tope abort" "v_renombrada ok:si" "v_apagar_renombrada ok:false"
  "v_sin_arroba si" "sonda_vzla ok"
)
# diferencias ARCHIVO [ARREGLO]: las que no cumple, «clave=lo que dio» separadas por espacio; vacío si
# cumple todas. El arreglo es ESPERADO si no se dice otro.
diferencias() {
  local f="$1" par clave valor salida=""
  local -n esp="${2:-ESPERADO}"
  for par in "${esp[@]}"; do
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
  "m8|s/nombre.safe_constantize # \[clase\]/nombre.constantize # [clase]/|clase_ausente|sin safe_constantize, una clase renombrada levanta NameError y no arrancan rails ni sidekiq"
)
# mutar ORIGEN DESTINO SED: el sed tiene que terminar bien y cambiar UNA línea (una sola fila borrada, o una
# cambiada). Un sed roto deja el archivo vacío, que también «cambia»: por eso no basta con cmp.
mutar() {
  sed -e "$3" "$1" >"$2" || return 1
  local cambios
  cambios="$(diff "$1" "$2" | grep -c '^[<>]')"
  [ "$cambios" = 1 ] || [ "$cambios" = 2 ]
}
for m in "${MUTANTES[@]}"; do
  IFS='|' read -r id expr _ _ <<<"$m"
  exigir "${id^^}a" 'mutar "$ORIG" "$MUT/$id.rb" "$expr"' "el mutante $id cambia una sola línea (si no, su sed ya no encuentra la suya)"
done
# Mutantes del guion de PC-3. id · sed · clave que tiene que romperse · clave que tiene que seguir igual · qué quita
ORIG_V="$D/correo/bandeja-vzla.rb"
MUTANTES_V=(
  "w1|s/\[en_bandeja(inbox), { attribute_key: 'email', filter_operator: 'contains', values: remitentes_sistema/[{ attribute_key: 'email', filter_operator: 'contains', values: remitentes_sistema/|v_otra|v_noreply|sin la condición de bandeja, «sistema» resuelve los avisos de otra bandeja"
  "w2|s/sin_asunto_legal(nil, ASUNTOS_LEGALES)\], # \[no-cliente\]/sin_asunto_legal(nil, %w[zzz])], # [no-cliente]/|v_gerencia|v_banco|sin la guarda del asunto, «no-cliente» resuelve un reclamo «Gerencia» de un banco"
  "w3|s/(base + valores_actuales(c, REGLAS\[:sistema\]) + extra).uniq # \[conserva-sistema\]/(base + extra).uniq # [conserva-sistema]/|v_sistema_conserva|v_noreply|sin conservar la lista, «reglas» borra en silencio el remitente extra de «sistema»"
  "w4|s/dominios = (anteriores + nuevos).uniq # \[conserva-no-cliente\]/dominios = nuevos.uniq # [conserva-no-cliente]/|v_no_cliente_suma|v_banco|sin conservar la lista, un dominio nuevo borra los «no-cliente» de antes"
  "w5|s/canal = Channel::Email.find_by(account: c, email: BUZON) # \[por-buzon\]/canal = nil # [por-buzon]/|v_renombrada|v_crear|sin buscar por el buzón, una bandeja renombrada se pierde y «apagar-imap» deja de ser vuelta atrás"
)
for m in "${MUTANTES_V[@]}"; do
  IFS='|' read -r id expr _ _ _ <<<"$m"
  exigir "${id^^}a" 'mutar "$ORIG_V" "$MUT/$id.rb" "$expr"' "el mutante $id cambia una sola línea del guion (si no, su sed ya no encuentra la suya)"
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
exigir T7 'es "$F" clase_ausente aviso && [ "$(cuenta "[DTD] correo automático NO activo: falta Imap::BuzonQueNoExiste" "$F")" -ge 1 ]' \
  "si falta la clase, instalar solo avisa en el log y no levanta: rails y sidekiq arrancarían igual"
exigir T8 'es "$F" a_salientes 0/0/0 && es "$F" correos_enviados 0/0' \
  "resolver no manda nada al remitente: 0 mensajes salientes o de plantilla, 0 trabajos de correo y 0 correos (encuesta CSAT apagada)"
exigir T9 'es "$F" y_estado resolved && es "$F" y_csat si' \
  "CONTROL de T8: con la encuesta encendida la sonda SÍ ve la salida ($(h "$F" y_salidas) mensajes/trabajos/correos), así que el 0 de A mide algo"
exigir T6 '[ "$ordenadas" = 3 ] && ! printf "%s" "$lineas" | grep -q "@"' \
  "el log nombra 3 conversaciones ordenadas (A, D y H; dio $ordenadas) y ninguna línea suya lleva una dirección"

# ── C. Control sin el inicializador ──────────────────────────────────────────
log "== C. control sin el inicializador"
F="$(caso control pruebas/compose.correo-sistema-control.yml)"
exigir C0 'es "$F" inicializador no && es "$F" sonda ok && es "$F" z_aviso_estado 1' \
  "la sonda corre sin el inicializador y su detector de notas de estado ve la de Chatwoot (caso Z)"
exigir C1 'es "$F" a_estado open && es "$F" a_etiquetas - && es "$F" a_auto_reply true && es "$F" d_estado open' \
  "sin el inicializador el rebote y la respuesta automática quedan abiertos y sin etiqueta: el hallazgo P4 se reproduce"
exigir C4 'es "$F" y_estado open && es "$F" y_csat no' \
  "sin el inicializador el rebote de la bandeja con encuesta queda abierto y no sale nada: la encuesta de Y la dispara resolverlo"
exigir C3 'es "$F" p_estado resolved && es "$F" p_etiquetas prueba-sistema && es "$F" p_auto_reply false' \
  "la regla «Sonda · sistema» SÍ resuelve un mailer-daemon sin Auto-Submitted: con A no actúa solo porque A es automático"
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

# ── V. Guion de PC-3 (correo/bandeja-vzla.rb), sin el inicializador ─────────────
log "== V. guion de PC-3"
caso_v() { # nombre [SONDA_VZLA] → ruta de la salida
  local salida="$TRABAJO/caso-$1.txt" entorno=()
  [ -n "${2:-}" ] && entorno=(-e "SONDA_VZLA=$2")
  dc "${BASE[@]}" -f pruebas/compose.correo-sistema-control.yml run --rm -T "${entorno[@]}" prepare     bundle exec rails runner /tmp/pruebas/sonda-bandeja-vzla.rb >"$salida" 2>&1
  echo "$salida"
}
F="$(caso_v vzla)"
dif="$(diferencias "$F" ESPERADO_V)"
exigir V0 'es "$F" sonda_vzla ok && [ -z "$dif" ]' "las ${#ESPERADO_V[@]} comprobaciones del guion de PC-3${dif:+ (no cumplen: $dif)}"
exigir V1 'es "$F" v_sin_miembros abort:si && es "$F" v_responsable_fuera abort:si && es "$F" v_nada_creado 0 && es "$F" v_otra_vez abort:si && es "$F" v_dominio_propio abort:si'   "sin miembros, con el responsable fuera de la bandeja, dos veces o con el dominio de DTD como «no-cliente»: no crea nada"
exigir V2 'es "$F" v_imap_smtp false/false && es "$F" v_claves vacias && es "$F" v_reglas_en_bandeja 3'   "crea la bandeja con IMAP y SMTP apagados, sin claves, y las 3 reglas empiezan por la bandeja"
exigir V3 'es "$F" v_legal "open|legal|urgent|sam" && es "$F" v_gerencia "open|legal|urgent|sam" && es "$F" v_banco "resolved|no-cliente|-|-" && es "$F" v_otra "open|-|-|-"'   "«legal» asigna al responsable aunque el remitente sea «no-cliente»; las reglas no tocan otra bandeja"
exigir V4 'es "$F" v_sin_arroba si' "ninguna salida del guion lleva una dirección"
for m in "${MUTANTES_V[@]}"; do
  IFS='|' read -r id _ clave igual pieza <<<"$m"
  F="$(caso_v "$id" "/tmp/pruebas/mutantes/$id.rb")"
  esperado=""; esperado_igual=""
  for par in "${ESPERADO_V[@]}"; do
    [ "${par%% *}" = "$clave" ] && esperado="${par#* }"
    [ "${par%% *}" = "$igual" ] && esperado_igual="${par#* }"
  done
  exigir "${id^^}" 'es "$F" sonda_vzla ok && [ -n "$esperado" ] && ! es "$F" "$clave" "$esperado" && es "$F" "$igual" "$esperado_igual"'     "$pieza ($clave dio «$(h "$F" "$clave")», sin el mutante «$esperado»; $igual sigue «$(h "$F" "$igual")»)"
done

log "== resultado: $FALLAS fallas"
[ "$FALLAS" = 0 ]
