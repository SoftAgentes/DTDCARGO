#!/usr/bin/env bash
# infra/chatwoot/pruebas/prueba-punta-a-punta.sh — en el VPS, solo contra prueba (SDD-0587, 6.4).
# Chatwoot real → webhook firmado real, por Cloudflare → Studio. Solo la cuenta de prueba y datos
# sintéticos. Imprime ids y códigos, nunca un token. Sale 0 sin fallas.
#
# Antes: variables y secretos de prueba cargados, webhook creado y la ruta abierta en el borde
# (docs/runbooks/chatwoot-bandeja.md). Copiarlo a /srv/ops/paquetes y correrlo con </dev/null.
#
# Uso:  bash prueba-punta-a-punta.sh <N>
#   N: dos dígitos, 53 a 98, y N+1. Teléfonos nuevos +120255501N, para que no haya tarjeta previa.
#   La semilla usa 02, 29, 42, 50, 51 y 52. Ya se usaron 81 a 84.
set -uo pipefail
umask 077
PROJECT_DIR=/srv/dtd-cargo-staging
ENV_FILE=$PROJECT_DIR/.env
URL_WH=https://prueba.dtdcargo.com/api/chatwoot/webhook
die() { echo "e2e: $*" >&2; exit 2; }
refuse() { echo "e2e: RECHAZADO $*" >&2; exit 3; }
source /srv/ops/staging/lib-prueba.sh
N="${1:-}"
[[ "$N" =~ ^(5[3-9]|[6-8][0-9]|9[0-8])$ ]] || die "uso: prueba-punta-a-punta.sh <N de 53 a 98>"
[ "$(prueba_env_valor "$ENV_FILE" CHATWOOT_ACCOUNT_ID)" = 2 ] || refuse "CHATWOOT_ACCOUNT_ID no es la cuenta de prueba"
INICIO="$(date -u +%FT%TZ)"
FALLAS=0
ok() { echo "PASÓ  $1 — $2"; }
mal() { echo "FALLÓ $1 — $2"; FALLAS=$((FALLAS + 1)); }
Q() { docker exec dtd-cargo-staging-db-1 psql -U postgres -d postgres -XAtc "$1" </dev/null 2>&1; }
exigir() { [ "$3" = "$4" ] && ok "$1" "$2: $3" || mal "$1" "$2: dio «$3», esperaba «$4»"; }
# esperar id descripción consulta esperado: Sidekiq entrega en segundos, nunca al instante.
esperar() {
  local v="" i
  for ((i = 0; i < 20; i++)); do
    v="$(Q "$3")"
    [ "$v" = "$4" ] && { ok "$1" "$2: $v"; return 0; }
    sleep 3
  done
  mal "$1" "$2: dio «$v», esperaba «$4»"
  return 1
}

CFG="$(mktemp /dev/shm/e2e.XXXXXX)"; trap 'rm -f "$CFG"' EXIT
printf 'header = "api_access_token: %s"\n' "$(prueba_env_valor "$ENV_FILE" CHATWOOT_ROUTER_TOKEN)" > "$CFG"
api() { curl -s --max-time 30 -K "$CFG" --resolve chat.dtdcargo.com:443:217.216.54.70 -H 'Content-Type: application/json' -X "$1" ${3:+-d "$3"} "https://chat.dtdcargo.com/api/v1/accounts/2$2"; }

T="$(prueba_env_valor "$ENV_FILE" CHATWOOT_TENANT_ID)"
ANTES_C1="$(docker exec chatwoot-rails-1 bundle exec rails runner 'puts "F #{Conversation.where(account_id: 1).maximum(:updated_at).to_f} #{Webhook.where(account_id: 1).count}"' </dev/null 2>/dev/null | grep '^F ')"

# contacto bandeja nombre teléfono correo → «id source_id». Si ya existe, lo reutiliza.
contacto() {
  local cuerpo r id
  if [ -n "$3" ]; then
    id="$(api GET "/contacts/search?q=$(printf '%s' "$3" | sed 's/+/%2B/')" | jq -r '.payload[0].id // empty')"
    if [ -n "$id" ]; then
      r="$(api POST "/contacts/$id/contact_inboxes" "$(jq -cn --argjson b "$1" '{inbox_id:$b}')")"
      echo "$id $(echo "$r" | jq -r '.source_id // empty')"
      return
    fi
  fi
  cuerpo="$(jq -cn --argjson b "$1" --arg n "$2" --arg t "$3" --arg c "$4" '{inbox_id:$b,name:$n} + (if $t != "" then {phone_number:$t} else {} end) + (if $c != "" then {email:$c} else {} end)')"
  r="$(api POST /contacts "$cuerpo")"
  echo "$(echo "$r" | jq -r '.payload.contact.id // empty') $(echo "$r" | jq -r '.payload.contact_inbox.source_id // empty')"
}
conversacion() { api POST /conversations "$(jq -cn --argjson b "$1" --argjson c "$2" --arg s "$3" '{inbox_id:$b,contact_id:$c,source_id:$s}')" | jq -r '.id // empty'; }
entrante() { api POST "/conversations/$1/messages" "$(jq -cn --arg t "$2" '{content:$t,message_type:"incoming"}')" | jq -r '.id // empty'; }
salientes() { api GET "/conversations/$1/messages" | jq -r '[.payload[] | select(.message_type == 1)] | length'; }
equipo() { api GET "/conversations/$1" | jq -r '.meta.team.id // "sin"'; }
etiquetas() { api GET "/conversations/$1/labels" | jq -r '.payload | sort | join(",")'; }

# ── Datos de prueba en Studio ─────────────────────────────────────────────────
Q "update public.feature_flags set enabled = true where tenant_id = '$T' and key = 'chatwoot_inbox'" >/dev/null
ASESOR="$(Q "select ut.user_id from public.user_tenants ut join auth.users u on u.id = ut.user_id where ut.role = 'commercial' and u.email like '%.test' and ut.disabled_at is null and ut.tenant_id = '$T' limit 1")"
[[ "$ASESOR" =~ ^[0-9a-f-]{36}$ ]] || { mal P0 "sin asesor sintético"; exit 1; }
Q "insert into public.chatwoot_agent_links (tenant_id, user_id, chatwoot_user_id) values ('$T', '$ASESOR', 5) on conflict do nothing" >/dev/null
exigir P1 "flag chatwoot_inbox" "$(Q "select enabled from public.feature_flags where tenant_id = '$T' and key = 'chatwoot_inbox'")" t
exigir P2 "vínculo del agente 5" "$(Q "select count(*) from public.chatwoot_agent_links where chatwoot_user_id = 5")" 1

# ── F. La ruta y la firma, por Cloudflare, sin clave ─────────────────────────
r="$(curl -4 -s -X POST --max-time 20 -H 'Content-Type: application/json' -H "x-chatwoot-timestamp: $(date +%s)" -H 'x-chatwoot-signature: sha256=00' -d '{}' -w ' %{http_code}' "$URL_WH")"
exigir F1 "firma mala llega a Studio y la rechaza" "$r" '{"ok":false,"error":"firma"} 401'
r="$(curl -4 -s -o /dev/null -w '%{http_code}' --max-time 20 https://prueba.dtdcargo.com/)"
exigir F2 "lo demás sigue con clave" "$r" 401

# ── E1. conversation_created en la bandeja de correo crea la tarjeta ─────────
read -r C1 S1 <<<"$(contacto 7 'Persona Sintetica Correo' "+120255501$N" "correo-e2e-$N@example.test")"
[ -n "$C1" ] && [ -n "$S1" ] || mal E1 "no se creó el contacto de correo"
V1="$(conversacion 7 "$C1" "$S1")"
[ -n "$V1" ] || mal E1 "no se creó la conversación de correo"
echo "      contacto $C1, conversación $V1"
esperar E1a "evento conversation_created procesado" "select count(*) from public.chatwoot_webhook_events where event = 'conversation_created' and conversation_id = $V1 and status = 'procesado'" 1
esperar E1b "conversación en Studio, bandeja 7" "select inbox_id from public.chatwoot_conversations where conversation_id = $V1" 7
esperar E1c "tarjeta del lead" "select fuente || '|' || etapa_leads || '|' || coalesce(nombre_visible, '-') || '|' || coalesce(phone_last10, '-') || '|' || (client_id is null)::text || '|' || (asesor_id is null)::text from public.crm_tarjetas where chatwoot_contact_id = $C1" "correo|nuevo|Persona Sintetica Correo|20255501$N|true|true"

# Otra conversación del mismo contacto no duplica la tarjeta.
V1B="$(conversacion 7 "$C1" "$S1")"
esperar E1d "segunda conversación procesada" "select count(*) from public.chatwoot_webhook_events where event = 'conversation_created' and conversation_id = ${V1B:-0} and status = 'procesado'" 1
exigir E1e "sigue una sola tarjeta" "$(Q "select count(*) from public.crm_tarjetas where chatwoot_contact_id = $C1")" 1

# Con ficha por teléfono, la tarjeta cuelga de la ficha y no guarda nombre (D6).
read -r C2 S2 <<<"$(contacto 7 'Persona Sintetica Ficha' '+12025550152' 'ficha-e2e@example.test')"
V2="$(conversacion 7 "$C2" "$S2")"
esperar E1f "tarjeta con ficha, sin nombre" "select t.fuente || '|' || coalesce(t.nombre_visible, '-') || '|' || c.markbox from public.crm_tarjetas t join public.clients c on c.id = t.client_id where t.chatwoot_contact_id = $C2 or t.phone_last10 = '2025550152' limit 1" 'correo|-|DTD-1005'

# ── E2. conversation_updated da asesor ───────────────────────────────────────
A4="$(api POST "/conversations/$V1/assignments" '{"assignee_id":4}' | jq -r '.id // empty')"
esperar E2a "asignada al agente 4, sin vínculo" "select assignee_id from public.chatwoot_conversations where conversation_id = $V1" 4
exigir E2b "sin vínculo no hay asesor" "$(Q "select (asesor_id is null)::text from public.crm_tarjetas where chatwoot_contact_id = $C1")" true
A5="$(api POST "/conversations/$V1/assignments" '{"assignee_id":5}' | jq -r '.id // empty')"
esperar E2c "tarjeta con el asesor vinculado" "select (asesor_id = '$ASESOR')::text from public.crm_tarjetas where chatwoot_contact_id = $C1" true
exigir E2d "evento conversation_updated procesado, sin fallidos" "$(Q "select count(*) filter (where status = 'procesado') >= 2 and count(*) filter (where status <> 'procesado') = 0 from public.chatwoot_webhook_events where event = 'conversation_updated' and conversation_id = $V1")" t

# ── E3. conversation_status_changed ──────────────────────────────────────────
api POST "/conversations/$V1/toggle_status" '{"status":"resolved"}' >/dev/null
esperar E3a "estado resuelta en Studio" "select status from public.chatwoot_conversations where conversation_id = $V1" resolved
api POST "/conversations/$V1/toggle_status" '{"status":"open"}' >/dev/null
esperar E3b "abierta otra vez" "select status from public.chatwoot_conversations where conversation_id = $V1" open

# ── E4. Mensaje entrante, bandeja API = leads: contador, aviso, sin tarjeta, lead nuevo ─
read -r C3 S3 <<<"$(contacto 6 'Persona Sintetica Nueva' "+120255501$((N + 1))" '')"
V3="$(conversacion 6 "$C3" "$S3")"
M3="$(entrante "$V3" 'entrante sintetico de lead nuevo')"
echo "      contacto $C3, conversación $V3, mensaje $M3"
esperar E4a "evento message_created procesado" "select count(*) from public.chatwoot_webhook_events where event_key = 'message_created:$M3' and status = 'procesado'" 1
esperar E4b "contador de no leídos" "select unread_count >= 1 from public.chatwoot_conversations where conversation_id = $V3" t
exigir E4c "un aviso push al vinculado, con su clave" "$(Q "select count(*) from public.outbox_push_events where target_id = '$ASESOR' and payload->>'clave_evento' = 'message_created:$M3'")" 1
exigir E4d "sin tarjeta: el canal API no da fuente" "$(Q "select count(*) from public.crm_tarjetas where chatwoot_contact_id = $C3")" 0
exigir E4e "etiqueta" "$(etiquetas "$V3")" lead-nuevo
exigir E4f "equipo leads" "$(equipo "$V3")" 4
exigir E4g "sin respuesta del bot" "$(salientes "$V3")" 0

# ── E5. Cliente: redirección una sola vez, etiqueta y equipo ─────────────────
read -r C4 S4 <<<"$(contacto 6 'Persona Sintetica Cliente' '+12025550102' '')"
V4="$(conversacion 6 "$C4" "$S4")"
M4="$(entrante "$V4" 'entrante sintetico de cliente')"
esperar E5a "evento procesado" "select count(*) from public.chatwoot_webhook_events where event_key = 'message_created:$M4' and status = 'procesado'" 1
exigir E5b "etiqueta" "$(etiquetas "$V4")" cliente
exigir E5c "equipo clientes" "$(equipo "$V4")" 3
exigir E5d0 "un aviso por el primer mensaje" "$(Q "select count(*) from public.outbox_push_events where payload->>'clave_evento' = 'message_created:$M4'")" 1
exigir E5d "una respuesta del bot" "$(salientes "$V4")" 1
exigir E5e "lleva al número de clientes" "$(api GET "/conversations/$V4/messages" | jq -r '[.payload[] | select(.message_type == 1) | .content | contains("wa.me/15555550100")] | all')" true
exigir E5f "reserva cerrada" "$(Q "select tipo || '|' || estado from public.chatwoot_respuestas_bot where conversation_id = $V4")" 'redireccion_cliente|enviada'
M4B="$(entrante "$V4" 'segundo entrante sintetico de cliente')"
esperar E5g "segundo evento procesado" "select count(*) from public.chatwoot_webhook_events where event_key = 'message_created:$M4B' and status = 'procesado'" 1
exigir E5h "no responde dos veces" "$(salientes "$V4")" 1
exigir E5i "otro aviso por el segundo mensaje: es otro evento" "$(Q "select count(*) from public.outbox_push_events where payload->>'clave_evento' = 'message_created:$M4B'")" 1

# ── E6. Lead registrado ──────────────────────────────────────────────────────
read -r C5 S5 <<<"$(contacto 6 'Persona Sintetica Registrada' '+12025550151' '')"
V5="$(conversacion 6 "$C5" "$S5")"
M5="$(entrante "$V5" 'entrante sintetico de lead registrado')"
esperar E6a "evento procesado" "select count(*) from public.chatwoot_webhook_events where event_key = 'message_created:$M5' and status = 'procesado'" 1
exigir E6b "etiqueta" "$(etiquetas "$V5")" lead-registrado
exigir E6c "equipo leads" "$(equipo "$V5")" 4
exigir E6d "sin respuesta del bot" "$(salientes "$V5")" 0

# ── E7. Sin teléfono: respuesta neutra y BSUID ───────────────────────────────
read -r C6 S6 <<<"$(contacto 6 'Persona Sintetica Sin Telefono' '' '')"
V6="$(conversacion 6 "$C6" "$S6")"
M6="$(entrante "$V6" 'entrante sintetico sin telefono')"
esperar E7a "evento procesado" "select count(*) from public.chatwoot_webhook_events where event_key = 'message_created:$M6' and status = 'procesado'" 1
exigir E7b "etiqueta" "$(etiquetas "$V6")" lead-nuevo
exigir E7c "equipo leads" "$(equipo "$V6")" 4
exigir E7d "una respuesta neutra" "$(Q "select tipo || '|' || estado from public.chatwoot_respuestas_bot where conversation_id = $V6")" 'neutra_sin_telefono|enviada'
exigir E7e "BSUID guardado con su source_id" "$(Q "select count(*) from public.chatwoot_contactos_bsuid where conversation_id = $V6 and bsuid = '$S6'")" 1

# ── C. Crons, con token ──────────────────────────────────────────────────────
cron() { docker exec dtd-cargo-staging-cron-1 sh -c "curl -s --max-time 120 -w ' %{http_code}' -H \"Authorization: Bearer \${CRON_SECRET}\" http://web:3000/api/cron/$1" </dev/null 2>&1; }
r="$(cron chatwoot-reintentos)"; echo "      chatwoot-reintentos: $(echo "$r" | cut -c1-120)"
exigir C1 "reintentos sin fallidos" "$(echo "$r" | sed 's/ [0-9]*$//' | jq -r '.fallidos')" 0
r="$(cron chatwoot-agentes)"; echo "      chatwoot-agentes: $(echo "$r" | cut -c1-200)"
exigir C2 "agentes responde" "$(echo "$r" | sed 's/ [0-9]*$//' | jq -r '.ok')" true
exigir C3 "no da de baja a nadie" "$(echo "$r" | sed 's/ [0-9]*$//' | jq -r '.bajas // 0')" 0

# ── A. Aislamiento: nada de la cuenta real ───────────────────────────────────
exigir A1 "ningún evento fallido en Studio" "$(Q "select count(*) from public.chatwoot_webhook_events where status <> 'procesado' and received_at >= '$INICIO'")" 0
exigir A2 "Studio solo ve bandejas de la cuenta 2" "$(Q "select coalesce(string_agg(distinct inbox_id::text, ',' order by inbox_id::text), '-') from public.chatwoot_conversations")" 6,7
DESPUES_C1="$(docker exec chatwoot-rails-1 bundle exec rails runner 'puts "F #{Conversation.where(account_id: 1).maximum(:updated_at).to_f} #{Webhook.where(account_id: 1).count}"' </dev/null 2>/dev/null | grep '^F ')"
echo "      cuenta 1, última conversación y webhooks: antes «$ANTES_C1», después «$DESPUES_C1»"
exigir A3 "la cuenta real sigue sin webhook" "${DESPUES_C1##* }" 0
echo "      eventos por tipo: $(Q "select string_agg(event || '=' || n, ' ' order by event) from (select event, count(*) n from public.chatwoot_webhook_events group by event) x")"
echo "      errores del web: $(docker logs --since 20m dtd-cargo-staging-web-1 2>&1 | grep -ciE '\[chatwoot\]|\[chatwoot-webhook\]')"
docker logs --since 20m dtd-cargo-staging-web-1 2>&1 | grep -iE '\[chatwoot\]|\[chatwoot-webhook\]' | cut -c1-140 | sort | uniq -c | head -8

echo "fallas: $FALLAS"
[ "$FALLAS" = 0 ]
