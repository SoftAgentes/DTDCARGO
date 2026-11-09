# frozen_string_literal: true

# infra/ops/portal-historial/pruebas/sonda-ensayo-portal.rb — la «producción» simulada de Chatwoot de la prueba del
# ensayo (prueba-ensayo-portal.sh, SDD-0586 10.7, PR 2b). Solo datos inventados. Corre con `rails runner` en el
# servicio `prepare` del Chatwoot simulado.
#
# Crea la cuenta del portal y, alrededor, todo lo que el ensayo NO puede copiar, con marcas que la prueba busca en el
# volcado de las copias:
#   · la bandeja «Conversaciones del portal» (API, sin webhook_url), con su hmac_token SINT-HMAC;
#   · el usuario de servicio y un agente, con correos y nombres marcados (sint-servicio-real, sint-agente-real);
#   · un contacto dtd-portal: con teléfono y correo marcados (+584127770002, sint-real-dtd@x.invalid), y una
#     conversación suya en la bandeja del portal con additional_attributes.browser marcado (SINT-NAVEGADOR);
#   · otra bandeja API (SINT WhatsApp) con un contacto con teléfono (+584127770001) y correo marcados y un mensaje SINT-WHATSAPP;
#   · el webhook de la cuenta con una URL marcada (sint-token);
#   · otra cuenta con un contacto dtd-portal: SINT-OTRA-CUENTA, su bandeja y un mensaje SINT-OTRA-MENSAJE.
# Salida: `HECHO clave=valor`, solo ids.

require 'securerandom'

def hecho(k, v)
  puts "HECHO #{k}=#{v}"
end

def usuario(nombre, correo)
  clave = "#{SecureRandom.hex(12)}Aa1!"
  u = User.new(name: nombre, email: correo, password: clave, password_confirmation: clave)
  u.skip_confirmation!
  u.save!
  u
end

def bandeja(cuenta, nombre)
  Inbox.create!(account: cuenta, name: nombre, channel: Channel::Api.create!(account: cuenta),
                enable_auto_assignment: false, greeting_enabled: false, csat_survey_enabled: false)
end

cuenta = Account.create!(name: 'SINT-CUENTA-REAL')
servicio = usuario('SINT-SERVICIO-REAL', 'sint-servicio-real@x.invalid')
AccountUser.create!(account: cuenta, user: servicio, role: :administrator)
agente = usuario('SINT-AGENTE-REAL', 'sint-agente-real@x.invalid')
AccountUser.create!(account: cuenta, user: agente, role: :agent)
portal = bandeja(cuenta, 'Conversaciones del portal')
portal.channel.update_columns(hmac_token: 'SINT-HMAC')
dtd = Contact.create!(account: cuenta, name: 'SINT-DTD-NOMBRE', identifier: "dtd-portal:#{SecureRandom.uuid}",
                      phone_number: '+584127770002', email: 'sint-real-dtd@x.invalid')
# Una conversación de la bandeja del portal con datos del navegador en additional_attributes: la copia trae solo
# dtd_hilo (revisar-datos-ve de la #473, E1).
ci_dtd = ContactInbox.create!(contact: dtd, inbox: portal, source_id: "dtd-portal:#{SecureRandom.uuid}")
# pubsub_token es una credencial (el canal de ActionCable del contacto): la copia lo trae sintético (revisión del DG).
ci_dtd.update_columns(pubsub_token: 'SINTPUBSUB0000000000000a')
Conversation.create!(account: cuenta, inbox: portal, contact: dtd, contact_inbox: ci_dtd,
                     additional_attributes: { 'dtd_hilo' => SecureRandom.uuid, 'browser' => { 'name' => 'SINT-NAVEGADOR' } })
viva = bandeja(cuenta, 'SINT WhatsApp')
x = Contact.create!(account: cuenta, name: 'SINT-WHATSAPP-NOMBRE', phone_number: '+584127770001', email: 'sint-real@x.invalid')
ci = ContactInbox.create!(contact: x, inbox: viva, source_id: "sint-#{SecureRandom.hex(4)}")
conv = Conversation.create!(account: cuenta, inbox: viva, contact: x, contact_inbox: ci)
conv.messages.create!(account: cuenta, inbox: viva, message_type: :incoming, content: 'SINT-WHATSAPP', sender: x)
Webhook.create!(account: cuenta, url: 'https://sint-token.invalid/hook', subscriptions: %w[message_created])

otra = Account.create!(name: 'SINT-OTRA-CUENTA')
otra_bandeja = bandeja(otra, 'Conversaciones del portal')
y = Contact.create!(account: otra, name: 'SINT-OTRA-CUENTA', identifier: "dtd-portal:#{SecureRandom.uuid}")
ci2 = ContactInbox.create!(contact: y, inbox: otra_bandeja, source_id: "dtd-portal:#{SecureRandom.uuid}")
conv2 = Conversation.create!(account: otra, inbox: otra_bandeja, contact: y, contact_inbox: ci2)
conv2.messages.create!(account: otra, inbox: otra_bandeja, message_type: :incoming, content: 'SINT-OTRA-MENSAJE', sender: y)

hecho('cuenta', cuenta.id)
hecho('portal', portal.id)
hecho('servicio', servicio.id)
hecho('agente', agente.id)
hecho('otra', otra.id)
hecho('preparar', 'ok')
