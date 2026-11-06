# frozen_string_literal: true

# infra/ops/kommo-historial/pruebas/sonda-cargador.rb — sonda de la prueba LOCAL del cargador (SDD-0590 5.5).
# Solo datos inventados. Corre con `rails runner` en el servicio `prepare` de la prueba, sin Sidekiq corriendo:
# todo trabajo encolado se queda en Redis y se puede contar.
#
#   FASE=preparar  crea la cuenta, una bandeja «viva» con un contacto, una conversación y un mensaje que ya
#                  existían, otro contacto con correo, una bandeja con webhook_url y el webhook de la cuenta.
#                  Deja la línea base en /tmp/estado/base.json.
#   FASE=verificar BANDEJA=<id> mide E-3, E-4, E-8, E-9, E-10 y E-11 contra esa línea base.
#
# Salida: líneas `HECHO clave=valor`.

require 'json'
require 'securerandom'
require 'sidekiq/api'

ESTADO = '/tmp/estado/base.json'

def hecho(clave, valor)
  puts "HECHO #{clave}=#{valor}"
end

def cola
  Sidekiq::Queue.all.sum(&:size) + Sidekiq::ScheduledSet.new.size + Sidekiq::RetrySet.new.size
end

def igual(a, b)
  (a.to_f - b.to_f).abs < 0.001 ? 'si' : 'no'
end

def medir(clave)
  hecho(clave, yield)
rescue StandardError => e
  hecho(clave, "error:#{e.class}")
end

case ENV.fetch('FASE')
when 'preparar'
  cuenta = Account.create!(name: 'SINT Cuenta Archivo')
  clave = "#{SecureRandom.hex(12)}Aa1!"
  admin = User.new(name: 'SINT Admin', email: 'sint.admin@example.test', password: clave, password_confirmation: clave)
  admin.skip_confirmation!
  admin.save!
  AccountUser.create!(account: cuenta, user: admin, role: :administrator)
  viva = Inbox.create!(account: cuenta, name: 'SINT WhatsApp', channel: Channel::Api.create!(account: cuenta))
  con_webhook = Inbox.create!(account: cuenta, name: 'SINT Con webhook',
                              channel: Channel::Api.create!(account: cuenta, webhook_url: 'https://studio.prueba.test/api'))
  Webhook.create!(account: cuenta, url: 'https://studio.prueba.test/hook',
                  subscriptions: %w[conversation_created conversation_status_changed conversation_updated
                                    message_created message_updated contact_created contact_updated])
  x1 = Contact.create!(account: cuenta, name: 'SINT-NOMBRE-X1', phone_number: '+584120000001')
  x2 = Contact.create!(account: cuenta, name: 'SINT-NOMBRE-X2', email: 'sint.existente@example.test')
  ci = ContactInbox.create!(contact: x1, inbox: viva, source_id: 'sint-x1')
  antes = cola
  conv = Conversation.create!(account: cuenta, inbox: viva, contact: x1, contact_inbox: ci)
  conv.messages.create!(account: cuenta, inbox: viva, message_type: :incoming, content: 'SINT-EXISTENTE', sender: x1)
  # Control: crear con los modelos SÍ encola trabajos. Si diera 0, la medida de E-3 no vería nada.
  hecho('control_cola', cola - antes)
  base = { cuenta: cuenta.id, admin: admin.id, viva: viva.id, con_webhook: con_webhook.id, x1: x1.id, x2: x2.id,
           conv: conv.id, conv_updated: conv.reload.updated_at.to_f, x1_updated: x1.reload.updated_at.to_f,
           x2_updated: x2.reload.updated_at.to_f, mensajes_vivos: Message.where(inbox_id: viva.id).count,
           contactos: Contact.where(account_id: cuenta.id).count, cola: cola }
  File.write(ESTADO, JSON.generate(base))
  hecho('cuenta', cuenta.id)
  hecho('con_webhook', con_webhook.id)
  hecho('preparar', 'ok')

when 'verificar'
  b = JSON.parse(File.read(ESTADO))
  archivo = Integer(ENV.fetch('BANDEJA'))
  cuenta = b['cuenta']
  convs = Conversation.where(inbox_id: archivo)
  msgs = Message.where(inbox_id: archivo)

  # E-3: ningún trabajo encolado desde la línea base (crear la bandeja, seco, dos cargas y los rechazos).
  hecho('cola_delta', cola - b['cola'])
  hecho('con_webhook_conversaciones', Conversation.where(inbox_id: b['con_webhook']).count)

  # E-4: lo cargado.
  hecho('conversaciones', convs.count)
  hecho('mensajes', msgs.count)
  hecho('entrantes', msgs.where(message_type: :incoming).count)
  hecho('salientes', msgs.where(message_type: :outgoing).count)
  hecho('resueltas', convs.where(status: :resolved).count)
  hecho('historicas', convs.where('created_at < ?', 400.days.ago).count)
  hecho('mensajes_historicos', msgs.where('created_at < ?', 400.days.ago).count)
  hecho('autores', msgs.where(message_type: :outgoing).map { |m| m.content_attributes['kommo_autor'] }.compact.sort.join('|'))
  hecho('json_conv', convs.where("jsonb_typeof(additional_attributes::jsonb) <> 'object'").count)
  hecho('json_msg', msgs.where("json_typeof(content_attributes::json) <> 'object'").count)
  if Message.column_names.include?('processed_message_content')
    hecho('procesado_faltante', msgs.where.not(content: nil).where(processed_message_content: nil).count)
  else
    hecho('procesado_faltante', 'sin_columna')
  end
  medir('no_leidos') { convs.to_a.sum { |c| c.unread_incoming_messages.count } }

  # E-9: sin huérfanos, sin cruces y sin personas duplicadas.
  hecho('huerfanos_mensaje', msgs.where.not(conversation_id: Conversation.select(:id)).count)
  hecho('huerfanos_conversacion', convs.where.not(contact_id: Contact.select(:id)).count)
  hecho('sin_contact_inbox', convs.where(contact_inbox_id: nil).count)
  hecho('contact_inbox_cruzado', convs.joins('JOIN contact_inboxes ci ON ci.id = conversations.contact_inbox_id')
                                      .where('ci.contact_id <> conversations.contact_id OR ci.inbox_id <> conversations.inbox_id').count)
  hecho('remitente_cruzado', msgs.where(message_type: :incoming).joins(:conversation)
                                 .where("messages.sender_type IS DISTINCT FROM 'Contact' OR messages.sender_id IS DISTINCT FROM conversations.contact_id").count)
  hecho('tel_x1', Contact.where(account_id: cuenta, phone_number: '+584120000001').count)
  hecho('correo_x2', Contact.where(account_id: cuenta).where('LOWER(email) = ?', 'sint.existente@example.test').count)
  hecho('tel_grupo', Contact.where(account_id: cuenta, phone_number: '+584120000002').count)
  talk = ->(tid) { convs.where("additional_attributes->>'kommo_talk_id' = ?", tid.to_s).pick(:contact_id) }
  hecho('x1_reusado', talk.call(2001) == b['x1'] ? 'si' : 'no')
  hecho('x2_reusado', talk.call(2003) == b['x2'] ? 'si' : 'no')
  hecho('grupo_unido', Contact.where(id: talk.call(2002)).pick(:identifier) == 'kommo:1002' ? 'si' : 'no')
  hecho('sin_contacto', convs.joins(:contact).where(contacts: { identifier: 'kommo:sin-contacto' }).count)
  hecho('contactos_nuevos', Contact.where(account_id: cuenta).count - b['contactos'])

  # E-11: lo que ya existía no cambió.
  hecho('conv_viva_intacta', igual(Conversation.find(b['conv']).updated_at, b['conv_updated']))
  hecho('x1_intacto', igual(Contact.find(b['x1']).updated_at, b['x1_updated']))
  hecho('x2_intacto', igual(Contact.find(b['x2']).updated_at, b['x2_updated']))
  hecho('mensajes_vivos_delta', Message.where(inbox_id: b['viva']).count - b['mensajes_vivos'])

  # E-10: búsqueda. ILIKE directo y el buscador de Chatwoot con un administrador.
  hecho('ilike_reciente', msgs.where('content ILIKE ?', '%SINTBUSCAR%').count)
  hecho('ilike_viejo', msgs.where('content ILIKE ?', '%SINTVIEJO%').count)
  admin = User.find(b['admin'])
  cuenta_ar = Account.find(cuenta)
  buscar = lambda do |q|
    r = SearchService.new(current_user: admin, current_account: cuenta_ar, search_type: 'Message', params: { q: q }).perform
    Array(r[:messages]).size
  end
  medir('buscador_reciente') { buscar.call('SINTBUSCAR') }
  medir('buscador_viejo') { buscar.call('SINTVIEJO') }

  # E-8: números de conversación. Una conversación nueva, creada como la crearía el canal, va después.
  max_archivo = convs.maximum(:display_id)
  ci = ContactInbox.find_by(contact_id: b['x1'], inbox_id: b['viva'])
  nueva = Conversation.create!(account_id: cuenta, inbox_id: b['viva'], contact_id: b['x1'], contact_inbox: ci)
  hecho('display_nueva_mayor', nueva.display_id > max_archivo ? 'si' : 'no')
  hecho('display_duplicados', Conversation.where(account_id: cuenta).group(:display_id).having('count(*) > 1').count.size)
  hecho('display_nulos', Conversation.where(account_id: cuenta, display_id: nil).count)
  orden = convs.order(:display_id).map { |c| c.created_at.to_i }
  hecho('display_en_orden', orden == orden.sort ? 'si' : 'no')
  hecho('verificar', 'ok')
end
