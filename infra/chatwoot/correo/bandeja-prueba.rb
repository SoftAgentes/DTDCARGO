# frozen_string_literal: true

# SDD-0582 4.8 · bandeja de correo TEMPORAL para las pruebas P1–P8 (puerta PC-1, «Autorizo la
# prueba» de Sam, 2026-10-30). Usa el buzón notificaciones@ con el usuario y la clave SMTP que
# el contenedor ya tiene en su entorno: la clave no se escribe ni se imprime.
#
#   docker compose cp correo/bandeja-prueba.rb rails:/tmp/bandeja-prueba.rb
#   docker compose exec -T rails bundle exec rails runner /tmp/bandeja-prueba.rb crear
#   ... estado | apagar-imap | encender-imap | recuperar N | duplicados | borrar
#
# Imprime solo ids, conteos y dominios de remitente: nunca direcciones, asuntos ni contenido.
NOMBRE = 'Correo · pruebas'
CORREO = ENV.fetch('SMTP_USERNAME')

def bandeja
  Inbox.joins("INNER JOIN channel_email ON channel_email.id = inboxes.channel_id AND inboxes.channel_type = 'Channel::Email'")
       .find_by(name: NOMBRE, channel_email: { email: CORREO })
end

def estado(inbox)
  return puts('sin bandeja de prueba') unless inbox

  conversaciones = inbox.conversations
  dominios = inbox.contacts.where.not(email: nil).pluck(:email).map { |e| e.split('@').last }.tally
  puts "bandeja #{inbox.id} · canal #{inbox.channel_id} · imap #{inbox.channel.imap_enabled} · smtp #{inbox.channel.smtp_enabled}"
  puts "conversaciones #{conversaciones.count} · mensajes #{inbox.messages.count} · contactos por dominio #{dominios}"
  conversaciones.order(:id).each do |c|
    attrs = c.additional_attributes || {}
    puts "  conv ##{c.display_id} estado=#{c.status} etiquetas=#{c.cached_label_list} prioridad=#{c.priority.inspect} " \
         "auto_reply=#{attrs['auto_reply'].inspect} mensajes=#{c.messages.count} " \
         "adjuntos=#{Attachment.where(message_id: c.messages.select(:id)).count} " \
         "entrantes=#{c.messages.incoming.count} salientes=#{c.messages.outgoing.count}"
  end
end

accion = ARGV[0]
cuenta = Account.find(1)

case accion
when 'crear'
  abort "ya existe la bandeja #{bandeja.id}: no creo otra" if bandeja
  abort 'ya hay un canal de correo con ese buzón: no creo otro' if Channel::Email.exists?(email: CORREO)

  canal = Channel::Email.create!(
    account: cuenta, email: CORREO,
    imap_enabled: true, imap_address: 'imap.hostinger.com', imap_port: 993, imap_enable_ssl: true,
    imap_login: CORREO, imap_password: ENV.fetch('SMTP_PASSWORD'), imap_authentication: 'plain',
    smtp_enabled: true, smtp_address: ENV.fetch('SMTP_ADDRESS'), smtp_port: ENV.fetch('SMTP_PORT').to_i,
    smtp_login: CORREO, smtp_password: ENV.fetch('SMTP_PASSWORD'), smtp_domain: ENV.fetch('SMTP_DOMAIN'),
    smtp_enable_starttls_auto: true, smtp_authentication: ENV.fetch('SMTP_AUTHENTICATION'),
    smtp_openssl_verify_mode: 'peer'
  )
  Inbox.create!(account: cuenta, name: NOMBRE, channel: canal)
  Inboxes::FetchImapEmailsJob.perform_now(canal)
  estado(bandeja)
when 'estado' then estado(bandeja)
when 'traer'
  Inboxes::FetchImapEmailsJob.perform_now(bandeja.channel)
  estado(bandeja)
when 'apagar-imap', 'encender-imap'
  bandeja.channel.update!(imap_enabled: accion == 'encender-imap')
  estado(bandeja)
when 'reglas'
  # P8: las dos reglas de §4.1, limitadas a esta bandeja y con etiquetas de prueba.
  inbox = bandeja
  %w[prueba-legal prueba-sistema].each { |t| Label.find_or_create_by!(account: cuenta, title: t) }
  en_bandeja = { attribute_key: 'inbox_id', filter_operator: 'equal_to', values: [inbox.id], query_operator: 'and' }
  AutomationRule.find_or_initialize_by(account: cuenta, name: 'Prueba correo · legal').update!(
    event_name: 'conversation_created', active: true, description: 'SDD-0582 4.8 P8 (temporal)',
    conditions: [en_bandeja, { attribute_key: 'mail_subject', filter_operator: 'contains', values: ['Privacidad'], query_operator: nil }],
    actions: [{ action_name: 'add_label', action_params: ['prueba-legal'] }, { action_name: 'change_priority', action_params: ['urgent'] }]
  )
  AutomationRule.find_or_initialize_by(account: cuenta, name: 'Prueba correo · sistema').update!(
    event_name: 'conversation_created', active: true, description: 'SDD-0582 4.8 P8 (temporal)',
    conditions: [en_bandeja, { attribute_key: 'email', filter_operator: 'contains', values: ['mailer-daemon'], query_operator: nil }],
    actions: [{ action_name: 'add_label', action_params: ['prueba-sistema'] }, { action_name: 'resolve_conversation', action_params: [] }]
  )
  puts "reglas: #{AutomationRule.where(account: cuenta).where("name LIKE 'Prueba correo ·%'").pluck(:id, :name, :active)}"
when 'rebote'
  # P4: conversación saliente a una dirección inventada que no existe; el rebote debe volver por IMAP.
  inbox = bandeja
  destino = ARGV.fetch(1)
  agente = cuenta.administrators.order(:id).first
  contacto = Contact.create!(account: cuenta, name: 'Rebote de prueba', email: destino)
  ci = ContactInbox.create!(contact: contacto, inbox: inbox, source_id: destino)
  conv = Conversation.create!(account: cuenta, inbox: inbox, contact: contacto, contact_inbox: ci,
                              additional_attributes: { 'mail_subject' => 'Prueba de rebote (SDD-0582 4.8)' })
  conv.messages.create!(account: cuenta, inbox: inbox, sender: agente, message_type: :outgoing,
                        content: 'Prueba de rebote: esta dirección no existe.')
  puts "rebote: conversación ##{conv.display_id} creada; el envío lo hace sidekiq"
when 'responder'
  # P2: responde desde Chatwoot a la conversación indicada (por display_id).
  conv = bandeja.conversations.find_by!(display_id: ARGV.fetch(1).to_i)
  conv.messages.create!(account: cuenta, inbox: bandeja, sender: cuenta.administrators.order(:id).first, message_type: :outgoing,
                        content: 'Respuesta de prueba desde el chat de DTD Cargo (SDD-0582 4.8). Respóndela con cualquier texto.')
  puts "respuesta creada en la conversación ##{conv.display_id}; el envío lo hace sidekiq"
when 'recuperar'
  Inboxes::FetchImapEmailsJob.perform_now(bandeja.channel, ARGV.fetch(1).to_i)
  estado(bandeja)
when 'duplicados'
  # P7: después de recuperar, ningún Message-ID entrante debe estar dos veces.
  repetidos = bandeja.messages.incoming.where.not(source_id: nil).unscope(:order)
                     .group(:source_id).having('COUNT(*) > 1').count
  puts "mensajes entrantes #{bandeja.messages.incoming.count} · Message-ID repetidos #{repetidos.size}"
when 'borrar'
  inbox = bandeja
  abort 'sin bandeja de prueba' unless inbox
  AutomationRule.where(account: cuenta).where("name LIKE 'Prueba correo ·%'").destroy_all
  Label.where(account: cuenta, title: %w[prueba-legal prueba-sistema]).destroy_all
  contactos = inbox.contacts.to_a
  inbox.destroy!
  # Los contactos que esta bandeja creó y que no tienen otra conversación se van con ella.
  contactos.each { |c| c.destroy! if c.conversations.reload.none? }
  puts "borrada la bandeja #{inbox.id}; quedan #{Channel::Email.where(email: CORREO).count} canales con ese buzón"
else
  abort 'acción: crear | estado | traer | apagar-imap | encender-imap | reglas | rebote DIR | responder N | recuperar N | duplicados | borrar'
end
