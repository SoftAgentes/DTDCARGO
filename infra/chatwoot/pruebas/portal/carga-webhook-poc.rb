# infra/chatwoot/pruebas/portal/carga-webhook-poc.rb — PoC-5b de la ida del chat del portal (SDD-0586, 10.5,
# §10.5.15). Corre con `rails runner` en el servicio `prepare` de la instancia EFÍMERA (portal.poc.test.ts), nunca
# en el VPS.
#
# Imprime, del mensaje MENSAJE, la carga que Chatwoot arma para el webhook de cuenta (Message#webhook_data, la que
# WebhookListener entrega con event: message_created): su id, su tipo, su source_id y el tipo de remitente. No
# imprime el texto ni el nombre.
#
# Por qué así y no con el receptor: Chatwoot 4.19.1 rechaza entregar un webhook a un host sin IP pública («Hostname
# 'receptor' has no public ip addresses», medido en Actions el 2026-11-07, run 42415834528), y en el arnés el
# receptor vive en la red interna. En producción la URL del webhook de Studio es pública.
require "json"

mensaje = Message.find(ENV.fetch("MENSAJE").to_i)
carga = mensaje.webhook_data.with_indifferent_access
remitente = carga[:sender].is_a?(Hash) ? carga[:sender] : {}
# El remitente se mide por el modelo (sender_type) y por su id en la carga. La carga de Chatwoot 4.19.1 no trae un
# `type` en el remitente (medido en Actions, run 42416532718): de él solo se imprimen los nombres de sus campos.
puts "CARGA #{JSON.generate(
  id: carga[:id],
  message_type: carga[:message_type],
  source_id: carga[:source_id],
  sender_type: mensaje.sender_type,
  sender_id_en_carga: remitente[:id],
  campos_del_remitente: remitente.keys.sort
)}"
