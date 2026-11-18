#!/usr/bin/env bash
# infra/chatwoot/pruebas/prueba-reproceso.sh — en el VPS, solo contra prueba (SDD-0585, E2-D26 y D55).
# Va después de prueba-punta-a-punta.sh, con el mismo N: reutiliza sus conversaciones.
#
# El estado se fuerza por SQL, igual al que deja un fallo o un proceso muerto. Lo demás es el
# camino real: cron → chatwoot_tomar_pendientes → manejadores → Chatwoot → chatwoot_cerrar_evento.
# Un aviso por evento: el que encoló y falló no repite, y el que falló antes de encolar sí avisa.
#
# Uso:  bash prueba-reproceso.sh <N>
set -uo pipefail
umask 077
ENV_FILE=/srv/dtd-cargo-staging/.env
die() { echo "reproceso: $*" >&2; exit 2; }
refuse() { echo "reproceso: RECHAZADO $*" >&2; exit 3; }
source /srv/ops/staging/lib-prueba.sh
N="${1:-}"
[[ "$N" =~ ^[0-9]{2}$ ]] || die "uso: prueba-reproceso.sh <N>"
[ "$(prueba_env_valor "$ENV_FILE" CHATWOOT_ACCOUNT_ID)" = 2 ] || refuse "CHATWOOT_ACCOUNT_ID no es la cuenta de prueba"
T="$(prueba_env_valor "$ENV_FILE" CHATWOOT_TENANT_ID)"
FALLAS=0
ok() { echo "PASÓ  $1 — $2"; }
mal() { echo "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
Q() { docker exec dtd-cargo-staging-db-1 psql -U postgres -d postgres -XAtc "$1" </dev/null 2>&1; }
exigir() { [ "$3" = "$4" ] && ok "$1" "$2: $3" || mal "$1" "$2: dio «$3», esperaba «$4»"; }
CFG="$(mktemp /dev/shm/e2e.XXXXXX)"; trap 'rm -f "$CFG"' EXIT
printf 'header = "api_access_token: %s"\n' "$(prueba_env_valor "$ENV_FILE" CHATWOOT_ROUTER_TOKEN)" > "$CFG"
api() { curl -s --max-time 30 -K "$CFG" --resolve chat.dtdcargo.com:443:217.216.54.70 -H 'Content-Type: application/json' -X "$1" "https://chat.dtdcargo.com/api/v1/accounts/2$2"; }
salientes() { api GET "/conversations/$1/messages" | jq -r '[.payload[] | select(.message_type == 1)] | length'; }
cron() { docker exec dtd-cargo-staging-cron-1 sh -c "curl -s --max-time 120 -H \"Authorization: Bearer \${CRON_SECRET}\" http://web:3000/api/cron/chatwoot-reintentos" </dev/null 2>&1; }
tomados() { echo "$1" | jq -c '{tomados,procesados,fallidos}'; }
vencer() { Q "update public.chatwoot_webhook_events set status = 'fallido', attempts = $2, next_attempt_at = now() - interval '1 minute' where event_key = '$1'" >/dev/null; }
colgar() { Q "update public.chatwoot_webhook_events set status = 'procesando', attempts = 1, next_attempt_at = null, updated_at = now() - interval '10 minutes' where event_key = '$1'" >/dev/null; }
sembrar() { # clave conversación estado: como un primer intento que falló o murió antes de encolar
  Q "insert into public.chatwoot_webhook_events (tenant_id, event_key, event, conversation_id, status, attempts, message_id, avisar, next_attempt_at, updated_at)
     values ('$T', '$1', 'message_created', $2, '$3', 1, ${1#*:}, true, now() - interval '1 minute', now() - interval '10 minutes')" >/dev/null
}
estado() { Q "select status || '|' || attempts from public.chatwoot_webhook_events where event_key = '$1'"; }
avisos() { Q "select count(*) from public.outbox_push_events where payload->>'clave_evento' = '$1'"; }
UNO='{"tomados":1,"procesados":1,"fallidos":0}'

VC="$(Q "select conversation_id from public.chatwoot_conversations where inbox_id = 7 order by updated_at desc limit 1")"
VL="$(Q "select conversation_id from public.chatwoot_respuestas_bot where tipo = 'redireccion_cliente' order by reservada_at desc limit 1")"
VN="$(Q "select c.conversation_id from public.chatwoot_conversations c where c.inbox_id = 6 and not exists (select 1 from public.chatwoot_respuestas_bot r where r.conversation_id = c.conversation_id) order by c.conversation_id desc limit 1")"
CC="$(api GET "/conversations/$VC" | jq -r '.meta.sender.id // empty')"
[ -n "$VC" ] && [ -n "$VL" ] && [ -n "$VN" ] && [ -n "$CC" ] || { mal P0 "faltan conversaciones: corre antes prueba-punta-a-punta.sh"; exit 1; }
echo "      correo $VC (contacto $CC), cliente $VL, lead nuevo $VN"

# ── N. Control: con el plazo sin vencer no se toca ───────────────────────────
K1="conversation_created:$VC"
Q "update public.chatwoot_webhook_events set status = 'fallido', attempts = 1, next_attempt_at = now() + interval '1 hour' where event_key = '$K1'" >/dev/null
exigir N1 "cron con el plazo sin vencer" "$(tomados "$(cron)")" '{"tomados":0,"procesados":0,"fallidos":0}'
exigir N2 "sigue fallido" "$(estado "$K1")" 'fallido|1'

# ── T. La tarjeta no se duplica ──────────────────────────────────────────────
A1="$(Q "select coalesce(asesor_id::text, 'sin') from public.crm_tarjetas where chatwoot_contact_id = $CC")"
vencer "$K1" 1
exigir T1 "cron" "$(tomados "$(cron)")" "$UNO"
exigir T2 "evento" "$(estado "$K1")" 'procesado|2'
exigir T3 "sigue una tarjeta" "$(Q "select count(*) from public.crm_tarjetas where chatwoot_contact_id = $CC")" 1
exigir T4 "conserva el asesor" "$(Q "select coalesce(asesor_id::text, 'sin') from public.crm_tarjetas where chatwoot_contact_id = $CC")" "$A1"

# ── A. Encoló y falló después: no repite, tampoco si el aviso ya salió ───────
M="$(Q "select min(message_id) from public.chatwoot_webhook_events where conversation_id = $VL and event = 'message_created' and avisar")"
KA="message_created:$M"
S0="$(salientes "$VL")"
exigir A0 "un aviso antes de reprocesar" "$(avisos "$KA")" 1
vencer "$KA" 1
exigir A1 "cron" "$(tomados "$(cron)")" "$UNO"
exigir A2 "evento" "$(estado "$KA")" 'procesado|2'
exigir A3 "sigue un aviso" "$(avisos "$KA")" 1
exigir A4 "el bot no responde otra vez" "$(salientes "$VL")" "$S0"
exigir A5 "etiqueta sigue" "$(api GET "/conversations/$VL/labels" | jq -r '.payload | join(",")')" cliente
exigir A6 "equipo sigue" "$(api GET "/conversations/$VL" | jq -r '.meta.team.id // "sin"')" 3
vencer "$KA" 2
exigir A7 "otro reintento" "$(tomados "$(cron)")" "$UNO"
exigir A8 "sigue un aviso" "$(avisos "$KA")" 1

# ── B. Falló antes de encolar: el reintento sí avisa, una vez ────────────────
KB="message_created:$((999800 + 10#$N))"
sembrar "$KB" "$VN" fallido
exigir B0 "sin aviso antes" "$(avisos "$KB")" 0
exigir B1 "cron" "$(tomados "$(cron)")" "$UNO"
exigir B2 "evento" "$(estado "$KB")" 'procesado|2'
exigir B3 "avisa una vez" "$(avisos "$KB")" 1
vencer "$KB" 2
exigir B4 "otro reintento" "$(tomados "$(cron)")" "$UNO"
exigir B5 "sigue un aviso" "$(avisos "$KB")" 1

# ── C. Colgado en «procesando» más de 5 min ──────────────────────────────────
colgar "$KA"
exigir C1 "después de encolar: cron" "$(tomados "$(cron)")" "$UNO"
exigir C2 "evento" "$(estado "$KA")" 'procesado|2'
exigir C3 "sigue un aviso" "$(avisos "$KA")" 1
KC="message_created:$((999700 + 10#$N))"
sembrar "$KC" "$VN" procesando
exigir C4 "antes de encolar: sin aviso" "$(avisos "$KC")" 0
exigir C5 "cron" "$(tomados "$(cron)")" "$UNO"
exigir C6 "avisa una vez" "$(avisos "$KC")" 1

# ── D. Fallo real hasta descartar: la conversación no existe en Chatwoot ─────
# `clasificarContacto` la pide a Chatwoot y recibe 404: nada simula el fallo.
V9=$((999900 + 10#$N)); K9="message_created:$V9"
sembrar "$K9" "$V9" fallido
exigir D0 "evento sintético" "$(estado "$K9")" 'fallido|1'
for n in 2 3 4; do
  r="$(tomados "$(cron)")"
  m="$(Q "select round(extract(epoch from next_attempt_at - updated_at) / 60) from public.chatwoot_webhook_events where event_key = '$K9'")"
  exigir "D$n" "intento $n falla y espera $((2 ** (n - 1))) min ($r)" "$(estado "$K9")|$m" "fallido|$n|$((2 ** (n - 1)))"
  Q "update public.chatwoot_webhook_events set next_attempt_at = now() - interval '1 minute' where event_key = '$K9'" >/dev/null
done
r="$(tomados "$(cron)")"
exigir D5 "intento 5 descarta ($r)" "$(estado "$K9")" 'descartado|5'
exigir D6 "un aviso en cinco intentos" "$(avisos "$K9")" 1
exigir D7 "un descartado no se vuelve a tomar" "$(tomados "$(cron)")" '{"tomados":0,"procesados":0,"fallidos":0}'
exigir D8 "no hay tarjeta por ese evento" "$(Q "select count(*) from public.crm_tarjetas where chatwoot_contact_id = $V9")" 0

echo "      logs del web: $(docker logs --since 10m dtd-cargo-staging-web-1 2>&1 | grep -E '\[chatwoot\]' | cut -c1-110 | sort | uniq -c | tr '\n' ';')"
echo "fallas: $FALLAS"
[ "$FALLAS" = 0 ]
