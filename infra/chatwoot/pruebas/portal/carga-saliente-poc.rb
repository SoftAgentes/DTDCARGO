# infra/chatwoot/pruebas/portal/carga-saliente-poc.rb — la vuelta del chat del portal (SDD-0586, 10.5, PR 1b,
# §10.5.15). Corre con `rails runner` en el servicio `prepare` de la instancia EFÍMERA (portal-vuelta.poc.test.ts),
# nunca en el VPS.
#
# Imprime, del mensaje MENSAJE, la carga que Chatwoot arma para el webhook de cuenta (Message#webhook_data,
# serializada con to_json como la entrega WebhookJob), reducida a los campos que lee la vuelta de Studio
# (`interpretarMensajePortal`): tipo, si es privado, source_id, texto, tipo de contenido, hora, remitente (id y
# type), bandeja, conversación y adjuntos. Aparte, con nombres que la vuelta no lee (`modelo_sender_type` y
# `campos_del_remitente`), el sender_type del modelo y los campos del remitente, para medir cómo viene un agente
# sin que la medida le preste a la carga un campo que la entrega real no trae. Solo datos inventados («SINT-…»).
#
# Por qué la carga y no la entrega: Chatwoot 4.19.1 no entrega un webhook a un host sin IP pública (medido en la
# 1a, run 42415834528), y en el arnés el receptor vive en la red interna.
require "json"

mensaje = Message.find(ENV.fetch("MENSAJE").to_i)
carga = JSON.parse(mensaje.webhook_data.to_json)
remitente = carga["sender"].is_a?(Hash) ? carga["sender"] : {}
reducida = {
  "event" => "message_created",
  "id" => carga["id"],
  "message_type" => carga["message_type"],
  "private" => carga["private"],
  "source_id" => carga["source_id"],
  "content" => carga["content"],
  "content_type" => carga["content_type"],
  "created_at" => carga["created_at"],
  "sender" => remitente.slice("id", "type"),
  "inbox" => (carga["inbox"].is_a?(Hash) ? carga["inbox"] : {}).slice("id"),
  "conversation" => (carga["conversation"].is_a?(Hash) ? carga["conversation"] : {}).slice("id", "inbox_id"),
  "attachments" => Array(carga["attachments"]).map { |a| a.is_a?(Hash) ? a.slice("file_type") : {} },
  "modelo_sender_type" => mensaje.sender_type,
  "campos_del_remitente" => remitente.keys.sort
}
puts "CARGA_SALIENTE #{JSON.generate(reducida)}"
