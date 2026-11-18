# frozen_string_literal: true

# Sonda de la cuenta de prueba (infra/chatwoot/crear-cuenta-prueba.rb). Nunca en el VPS.
# La corre prueba-cuenta-prueba.sh con `rails runner` en el stack local. Todo es sintético.
#
# Imprime `HECHO clave=valor`. Pide a la app por ActionDispatch::Integration::Session, la misma
# pila de Rack que un pedido real. Los trabajos corren en línea y Webhooks::Trigger se intercepta:
# se ve qué saldría y a dónde, sin mandar nada. El correo queda en ActionMailer::Base.deliveries.

require 'securerandom'

def hecho(clave, valor)
  puts "HECHO #{clave}=#{valor}"
end

# En línea. El adaptador de Rails no admite diferidos: los avisos y correos corren ya, para
# poder contarlos, y los demás diferidos (avatares, reabrir) aquí no hacen falta.
class AdaptadorEnLinea < ActiveJob::QueueAdapters::InlineAdapter
  def enqueue_at(job, _momento)
    return unless job.class.name.start_with?('Notification::') || job.is_a?(ActionMailer::MailDeliveryJob)

    ActiveJob::Base.execute(job.serialize)
  end
end
ActiveJob::Base.queue_adapter = AdaptadorEnLinea.new
ActionMailer::Base.delivery_method = :test
ActionMailer::Base.perform_deliveries = true

ENTREGAS = [] # rubocop:disable Style/MutableConstant
module CapturarEntrega
  def execute(url, payload, webhook_type, **)
    ENTREGAS << [url, payload]
    nil
  end
end
Webhooks::Trigger.singleton_class.prepend(CapturarEntrega)

# La cuenta real, con un agente y una conversación.
real = Account.create!(name: 'DTD Cargo')
app_real = PlatformApp.create!(name: 'Studio real')
app_real.platform_app_permissibles.create!(permissible: real)
agente_real = User.new(name: 'Agente real', email: 'agente-real@example.test', password: "Pw-#{SecureRandom.hex(8)}-a1!")
agente_real.skip_confirmation!
agente_real.save!
app_real.platform_app_permissibles.create!(permissible: agente_real)
AccountUser.create!(account: real, user: agente_real, role: :administrator)
canal_real = Channel::Api.create!(account: real)
bandeja_real = Inbox.create!(account: real, name: 'Clientes real', channel: canal_real)
contacto_real = Contact.create!(account: real, name: 'Cliente real', phone_number: '+15555550100')
ci_real = ContactInbox.create!(contact: contacto_real, inbox: bandeja_real, source_id: SecureRandom.uuid)
Conversation.create!(account: real, inbox: bandeja_real, contact: contacto_real, contact_inbox: ci_real)
foto = lambda do
  [real.reload.updated_at, real.status, real.conversations.count, real.users.count, real.inboxes.count, real.teams.count,
   agente_real.reload.updated_at, agente_real.access_token.token, app_real.access_token.reload.token].map(&:to_s).join('|')
end
foto_antes = foto.call

# Lo que se va a correr en el VPS.
CUENTA_PRUEBA_SIN_CORRER = true
load '/tmp/crear-cuenta-prueba.rb'
r = CuentaPrueba.crear!
hecho :crea, (r[:cuenta].persisted? && r[:app].persisted?) ? 'si' : 'no'
hecho :foto_tras_crear, foto.call == foto_antes ? 'igual' : 'cambio'
begin
  CuentaPrueba.crear!
  hecho :segunda_vez, 'creo'
rescue StandardError => e
  hecho :segunda_vez, e.message.include?('ya existen') ? 'rechaza' : 'otro'
end
hecho :flags_correo, NotificationSetting.where(account_id: r[:cuenta].id).where.not(email_flags: 0).count
hecho :flags_push, NotificationSetting.where(account_id: r[:cuenta].id).where.not(push_flags: 0).count

s = ActionDispatch::Integration::Session.new(Rails.application)
s.host! ENV.fetch('CHATWOOT_HOST', 'chat.prueba.test')
token_app = { 'api_access_token' => r[:app].access_token.token }
token_servicio = { 'api_access_token' => r[:servicio].access_token.token }
pedir = lambda do |metodo, ruta, cabeceras, cuerpo = nil|
  s.public_send(metodo, ruta, params: cuerpo, headers: cabeceras, as: cuerpo ? :json : nil)
  s.response.status
end

# El token de la app de prueba no alcanza lo real.
hecho :app_cuenta_real, pedir.call(:get, "/platform/api/v1/accounts/#{real.id}", token_app)
hecho :app_cuenta_propia, pedir.call(:get, "/platform/api/v1/accounts/#{r[:cuenta].id}", token_app)
hecho :app_usuario_real, pedir.call(:get, "/platform/api/v1/users/#{agente_real.id}", token_app)
hecho :app_login_real, pedir.call(:get, "/platform/api/v1/users/#{agente_real.id}/login", token_app)
hecho :app_miembro_real, pedir.call(:post, "/platform/api/v1/accounts/#{real.id}/account_users", token_app,
                                    { user_id: r[:servicio].id, role: 'administrator' })
hecho :app_borrar_real, pedir.call(:delete, "/platform/api/v1/accounts/#{real.id}", token_app)
s.get('/platform/api/v1/accounts', headers: token_app)
hecho :app_lista, JSON.parse(s.response.body).map { |a| a['id'] }.sort == [r[:cuenta].id] ? 'solo_la_propia' : 'otras'
hecho :servicio_conversaciones_reales, pedir.call(:get, "/api/v1/accounts/#{real.id}/conversations", token_servicio)
hecho :servicio_conversaciones_propias, pedir.call(:get, "/api/v1/accounts/#{r[:cuenta].id}/conversations", token_servicio)

# Webhook de la cuenta de prueba.
url = 'https://prueba.dtdcargo.test/api/chatwoot/webhook'
webhook = Webhook.create!(account: r[:cuenta], url: url,
                          subscriptions: %w[message_created conversation_status_changed conversation_created conversation_updated])
hecho :webhook_secreto, webhook.secret.present? ? 'si' : 'no'
ENTREGAS.clear
ActionMailer::Base.deliveries.clear
base = "/api/v1/accounts/#{r[:cuenta].id}"

pedir.call(:post, "#{base}/contacts", token_servicio,
           { inbox_id: r[:correo].id, name: 'Persona sintética', phone_number: '+15555550111', email: 'persona@example.test' })
contacto = JSON.parse(s.response.body).dig('payload', 'contact')
source = JSON.parse(s.response.body).dig('payload', 'contact_inbox', 'source_id')
hecho :conversacion_correo, pedir.call(:post, "#{base}/conversations", token_servicio,
                                       { inbox_id: r[:correo].id, contact_id: contacto['id'], source_id: source })
conversacion = JSON.parse(s.response.body)
creada = ENTREGAS.find { |(_, p)| p[:event] == 'conversation_created' || p['event'] == 'conversation_created' }&.last
hecho :evento_creada, creada ? 'si' : 'no'
hecho :evento_creada_canal, creada&.dig(:channel) || creada&.dig('channel') || 'sin_canal'
hecho :evento_creada_cuenta, (creada&.dig(:account, :id) || creada&.dig('account', 'id')) == r[:cuenta].id ? 'propia' : 'otra'
hecho :evento_url, ENTREGAS.all? { |(u, _)| u == url } ? 'solo_prueba' : 'otra'

ENTREGAS.clear
hecho :asignar, pedir.call(:post, "#{base}/conversations/#{conversacion['id']}/assignments", token_servicio,
                           { assignee_id: r[:admin].id })
asignada = ENTREGAS.find { |(_, p)| (p[:event] || p['event']) == 'conversation_updated' }&.last
hecho :evento_asignada, asignada ? 'si' : 'no'
hecho :evento_asignada_asignado, (asignada&.dig(:meta, :assignee, :id) || asignada&.dig('meta', 'assignee', 'id')) == r[:admin].id ? 'si' : 'no'

pedir.call(:post, "#{base}/conversations/#{conversacion['id']}/messages", token_servicio,
           { content: 'entrante sintético', message_type: 'incoming' })
hecho :entrante_en_correo, s.response.status

# Bandeja API: mensaje entrante.
pedir.call(:post, "#{base}/contacts", token_servicio, { inbox_id: r[:api].id, name: 'Persona API', phone_number: '+15555550112' })
contacto_api = JSON.parse(s.response.body).dig('payload', 'contact')
source_api = JSON.parse(s.response.body).dig('payload', 'contact_inbox', 'source_id')
pedir.call(:post, "#{base}/conversations", token_servicio, { inbox_id: r[:api].id, contact_id: contacto_api['id'], source_id: source_api })
conv_api = JSON.parse(s.response.body)
ENTREGAS.clear
hecho :entrante_en_api, pedir.call(:post, "#{base}/conversations/#{conv_api['id']}/messages", token_servicio,
                                   { content: 'entrante sintético', message_type: 'incoming' })
entrante = ENTREGAS.find { |(_, p)| (p[:event] || p['event']) == 'message_created' }&.last
hecho :evento_entrante, entrante ? 'si' : 'no'
hecho :evento_entrante_tipo, entrante&.dig(:message_type) || entrante&.dig('message_type') || 'sin_tipo'

hecho :correos_enviados, ActionMailer::Base.deliveries.size

# Control: con el aviso encendido el mismo paso sí manda correo, así que el 0 de arriba mide algo.
ajuste = NotificationSetting.find_by!(account_id: r[:cuenta].id, user_id: r[:admin].id)
ajuste.selected_email_flags = [:email_conversation_assignment]
ajuste.save!
pedir.call(:post, "#{base}/conversations/#{conversacion['id']}/assignments", token_servicio, { assignee_id: r[:servicio].id })
pedir.call(:post, "#{base}/conversations/#{conversacion['id']}/assignments", token_servicio, { assignee_id: r[:admin].id })
hecho :control_correo, ActionMailer::Base.deliveries.size.positive? ? 'si' : 'no'
ajuste.selected_email_flags = []
ajuste.save!
ActionMailer::Base.deliveries.clear

# Lo que pasa en la cuenta real no llega al webhook de prueba.
ENTREGAS.clear
c2 = Contact.create!(account: real, name: 'Otro real', phone_number: '+15555550101')
ci2 = ContactInbox.create!(contact: c2, inbox: bandeja_real, source_id: SecureRandom.uuid)
conv_real = Conversation.create!(account: real, inbox: bandeja_real, contact: c2, contact_inbox: ci2)
Message.create!(account: real, inbox: bandeja_real, conversation: conv_real, message_type: :incoming, content: 'dato real')
hecho :eventos_de_lo_real, ENTREGAS.count { |(u, _)| u == url }

# La trampa: POST /users adopta por correo.
hecho :adopta_status, pedir.call(:post, '/platform/api/v1/users', token_app,
                                 { name: 'x', email: agente_real.email, password: "Pw-#{SecureRandom.hex(8)}-a1!" })
hecho :adopta, r[:app].platform_app_permissibles.exists?(permissible: agente_real) ? 'si' : 'no'
r[:app].platform_app_permissibles.where(permissible: agente_real).destroy_all

# Al terminar: borrar webhook, suspender cuenta y revocar token.
webhook.destroy!
hecho :suspender, pedir.call(:patch, "/platform/api/v1/accounts/#{r[:cuenta].id}", token_app, { status: 'suspended' })
hecho :suspendida, r[:cuenta].reload.suspended? ? 'si' : 'no'
hecho :servicio_suspendida, pedir.call(:get, "#{base}/conversations", token_servicio)
r[:app].access_token.destroy!
hecho :token_revocado, pedir.call(:get, "/platform/api/v1/accounts/#{r[:cuenta].id}", token_app)
hecho :real_activa, real.reload.active? ? 'si' : 'no'
hecho :foto_al_final, [real.reload.status, real.users.count, agente_real.reload.access_token.token.present?, app_real.access_token.reload.token.present?].join('|')
