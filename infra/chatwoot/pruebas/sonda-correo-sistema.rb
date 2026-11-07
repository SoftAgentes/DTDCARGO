# frozen_string_literal: true

# SDD-0582 4.8 · P4 · sonda de correo/zz_dtd_correo_sistema.rb sobre la imagen real de Chatwoot.
# La corre prueba-correo-sistema.sh con `rails runner` en `prepare` (red `interna`, sin internet).
# Solo datos inventados (example.test): ningún correo real, nada sale por SMTP ni entra por IMAP.
#
# Mete correos armados a mano por Imap::ImapMailbox#process, el mismo camino que usa
# Inboxes::FetchImapEmailsJob, y escribe lo que quedó como líneas «HECHO clave=valor».
# Los trabajos corren en línea, como los correría sidekiq, para que las reglas de Chatwoot y las
# notas de actividad se vean en la misma corrida. El adaptador en línea de Rails no admite
# diferidos (SendReplyJob espera 2 s si hay adjuntos): aquí se descartan, no hacen falta.
# Los correos de Chatwoot quedan en ActionMailer::Base.deliveries: nada sale por SMTP.
#
# Con SONDA_CARGAR=<archivo> carga ese inicializador al arrancar (lo usan el control M0 y los
# mutantes, que corren sin el montaje) y llama a DtdCorreoSistema.instalar.
#
# Cada trabajo encolado queda en ENCOLADOS, también los diferidos que se descartan: así la sonda ve un correo que
# Chatwoot mandaría más tarde (ActionMailer::MailDeliveryJob) aunque aquí no corra.
ENCOLADOS = [] # rubocop:disable Style/MutableConstant
class AdaptadorEnLinea < ActiveJob::QueueAdapters::InlineAdapter
  def enqueue(job)
    ENCOLADOS << job.class.name
    super
  end

  def enqueue_at(job, _momento)
    ENCOLADOS << job.class.name
    nil
  end
end
ActiveJob::Base.queue_adapter = AdaptadorEnLinea.new
ActionMailer::Base.delivery_method = :test

if ENV['SONDA_CARGAR'].present?
  load ENV.fetch('SONDA_CARGAR')
  DtdCorreoSistema.instalar
end

def hecho(clave, valor) = puts("HECHO #{clave}=#{valor}")

instalado = defined?(DtdCorreoSistema::Buzon) && Imap::ImapMailbox <= DtdCorreoSistema::Buzon
hecho 'inicializador', instalado ? 'si' : 'no'
hecho 'metodos', Imap::ImapMailbox.method_defined?(:process) &&
                 Imap::ImapMailbox.private_method_defined?(:find_or_create_conversation) ? 'ok' : 'faltan'

# Si una versión nueva renombra la clase, `instalar` (lo que corre to_prepare al arrancar) solo avisa en el log:
# un NameError ahí no dejaría arrancar rails ni sidekiq.
if instalado
  ausente = begin
    DtdCorreoSistema.instalar('Imap::BuzonQueNoExiste') ? 'instalo' : 'aviso'
  rescue NameError
    'NameError'
  end
  hecho 'clase_ausente', ausente
end

# Cada corrida crea su cuenta y su buzón (el buzón es único en toda la instalación).
cuenta = Account.create!(name: 'Sonda correo automático')
canal = Channel::Email.create!(account: cuenta, email: "bandeja-#{SecureRandom.hex(4)}@sonda.example.test",
                               imap_enabled: false, smtp_enabled: false)
inbox = Inbox.create!(account: cuenta, name: 'Correo · sonda', channel: canal)
canal.reload
%w[sistema prueba-legal prueba-sistema].each { |t| Label.create!(account: cuenta, title: t) }

# Las dos reglas de la prueba P8 de PC-1 (bandeja-prueba.rb reglas), limitadas a esta bandeja.
en_bandeja = { attribute_key: 'inbox_id', filter_operator: 'equal_to', values: [inbox.id], query_operator: 'and' }
AutomationRule.create!(
  account: cuenta, name: 'Sonda · legal', event_name: 'conversation_created', active: true,
  conditions: [en_bandeja, { attribute_key: 'mail_subject', filter_operator: 'contains', values: ['Privacidad'], query_operator: nil }],
  actions: [{ action_name: 'add_label', action_params: ['prueba-legal'] }]
)
AutomationRule.create!(
  account: cuenta, name: 'Sonda · sistema', event_name: 'conversation_created', active: true,
  conditions: [en_bandeja, { attribute_key: 'email', filter_operator: 'contains', values: ['mailer-daemon'], query_operator: nil }],
  actions: [{ action_name: 'add_label', action_params: ['prueba-sistema'] }, { action_name: 'resolve_conversation', action_params: [] }]
)

def correo(id, de:, asunto:, cabeceras: {}, adjunto: nil)
  base = { 'From' => de, 'To' => 'bandeja@sonda.example.test', 'Subject' => asunto,
           'Message-ID' => "<#{id}@sonda.example.test>", 'Date' => Time.now.utc.rfc2822, 'MIME-Version' => '1.0' }
  cab = base.merge(cabeceras).map { |k, v| "#{k}: #{v}" }.join("\r\n")
  texto = "Texto inventado de la sonda (#{id})."
  crudo = if adjunto
            frontera = "sonda-#{id}"
            "#{cab}\r\nContent-Type: multipart/mixed; boundary=\"#{frontera}\"\r\n\r\n" \
              "--#{frontera}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n#{texto}\r\n" \
              "--#{frontera}\r\nContent-Type: application/pdf; name=\"#{adjunto}\"\r\n" \
              "Content-Disposition: attachment; filename=\"#{adjunto}\"\r\nContent-Transfer-Encoding: base64\r\n\r\n" \
              "#{[%(%PDF-1.4\n% sonda #{id}\n%%EOF\n)].pack('m')}\r\n--#{frontera}--\r\n"
          else
            "#{cab}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n#{texto}\r\n"
          end
  Mail.read_from_string(crudo)
end

procesar = ->(mail) { Imap::ImapMailbox.new.process(mail, canal) }
conversacion_de = ->(id) { inbox.messages.find_by(source_id: "#{id}@sonda.example.test")&.conversation&.reload }
notas = ->(c) { c ? c.messages.activity.where('content LIKE ?', 'Correo automático%').count : -1 }
# Notas de estado que escribe Chatwoot («resolved by system due to N minutes of inactivity»). Se leen en Ruby:
# messages.content_attributes es una columna json que guarda el objeto como TEXTO (Chatwoot mismo la consulta con
# `#>> '{}'`), y `content_attributes -> 'activity'` en SQL da siempre NULL. El caso Z comprueba que esto ve algo.
aviso_estado = lambda do |c|
  c ? c.messages.activity.to_a.count { |m| m.content_attributes.to_h.dig('activity', 'type') == 'conversation_status_changed' } : -1
end
etiquetas = ->(c) { c ? c.label_list.sort.join(',').presence || '-' : 'sin-conversacion' }
informar = lambda do |letra, c|
  hecho "#{letra}_estado", c&.status || 'sin-conversacion'
  hecho "#{letra}_etiquetas", etiquetas.call(c)
  hecho "#{letra}_notas", notas.call(c)
  hecho "#{letra}_aviso_estado", aviso_estado.call(c)
  hecho "#{letra}_auto_reply", c ? c.additional_attributes['auto_reply'].inspect : 'sin-conversacion'
end
# Lo que saldría hacia el remitente, desde una marca: «mensajes/trabajos/correos». Mensajes salientes o de plantilla
# de la conversación (la encuesta CSAT es `template` con content_type input_csat, no `outgoing`), trabajos de
# correo encolados desde la marca (también los diferidos) y correos entregados desde la marca.
salidas = lambda do |c, desde_trabajos, desde_correos|
  mensajes = c ? c.messages.where(message_type: %i[outgoing template]).count : -1
  trabajos = ENCOLADOS.drop(desde_trabajos).count { _1.include?('Mail') }
  "#{mensajes}/#{trabajos}/#{ActionMailer::Base.deliveries.size - desde_correos}"
end

# A · rebote nuevo, como el de mailchannels.net en PC-1 (Auto-Submitted: auto-replied).
rebote = correo('a-rebote', de: 'MAILER-DAEMON@relay.sonda.example.test', asunto: 'Undelivered Mail Returned to Sender',
                            cabeceras: { 'Auto-Submitted' => 'auto-replied' })
marca_trabajos = ENCOLADOS.size
marca_correos = ActionMailer::Base.deliveries.size
procesar.call(rebote)
a = conversacion_de.call('a-rebote')
informar.call('a', a)
# Resolver no manda nada al remitente, con la encuesta CSAT apagada como queda en las bandejas de correo. El caso Y,
# con la encuesta encendida, prueba que esta medida sí ve la salida.
hecho 'a_salientes', salidas.call(a, marca_trabajos, marca_correos)

# P · control positivo de la regla: un aviso de mailer-daemon SIN Auto-Submitted. La regla «Sonda · sistema» SÍ lo
# resuelve; con A no actúa solo porque A es automático. Así el «aunque haya una regla» de C queda demostrado.
procesar.call(correo('p-sin-cabecera', de: 'MAILER-DAEMON@otro-relay.sonda.example.test', asunto: 'Aviso sin cabecera'))
informar.call('p', conversacion_de.call('p-sin-cabecera'))

# B · correo normal de una persona, con asunto «Privacidad»: la regla legal de Chatwoot sigue actuando.
procesar.call(correo('b-cliente', de: 'cliente.b@sonda.example.test', asunto: 'Privacidad: consulta inventada'))
informar.call('b', conversacion_de.call('b-cliente'))

# C · respuesta automática ENHEBRADA a una conversación que ya existía: no se toca.
procesar.call(correo('c1-cliente', de: 'cliente.c@sonda.example.test', asunto: 'Cotizacion inventada'))
c1 = conversacion_de.call('c1-cliente')
procesar.call(correo('c2-automatica', de: 'cliente.c@sonda.example.test', asunto: 'Respuesta automatica: Cotizacion inventada',
                                      cabeceras: { 'Auto-Submitted' => 'auto-replied',
                                                   'In-Reply-To' => '<c1-cliente@sonda.example.test>',
                                                   'References' => '<c1-cliente@sonda.example.test>' }))
c2 = conversacion_de.call('c2-automatica')
hecho 'c_misma', c1 && c2 && c1.id == c2.id ? 'si' : 'no'
informar.call('c', c2)

# D · respuesta automática nueva por la otra cabecera (X-Autoreply: yes).
procesar.call(correo('d-vacaciones', de: 'vacaciones.d@sonda.example.test', asunto: 'Fuera de la oficina',
                                     cabeceras: { 'X-Autoreply' => 'yes' }))
informar.call('d', conversacion_de.call('d-vacaciones'))

# E · el mismo rebote otra vez (otra pasada de IMAP): ni conversación ni nota nuevas.
procesar.call(correo('a-rebote', de: 'MAILER-DAEMON@relay.sonda.example.test', asunto: 'Undelivered Mail Returned to Sender',
                                 cabeceras: { 'Auto-Submitted' => 'auto-replied' }))
hecho 'e_mensajes', inbox.messages.where(source_id: 'a-rebote@sonda.example.test').count
hecho 'e_notas', notas.call(a&.reload)

# F · contacto bloqueado: su conversación nace resuelta (Conversation#determine_conversation_status) y no se toca.
procesar.call(correo('f1-cliente', de: 'bloqueado.f@sonda.example.test', asunto: 'Primer correo inventado'))
conversacion_de.call('f1-cliente')&.contact&.update!(blocked: true)
procesar.call(correo('f2-automatica', de: 'bloqueado.f@sonda.example.test', asunto: 'Respuesta automatica inventada',
                                      cabeceras: { 'Auto-Submitted' => 'auto-generated' }))
informar.call('f', conversacion_de.call('f2-automatica'))

# G · P3 en la imagen real: un PDF como archivo adjunto de entrada (no en línea).
procesar.call(correo('g-adjunto', de: 'cliente.g@sonda.example.test', asunto: 'Factura inventada', adjunto: 'factura-inventada.pdf'))
g = conversacion_de.call('g-adjunto')
mensaje_g = inbox.messages.find_by(source_id: 'g-adjunto@sonda.example.test')
hecho 'g_estado', g&.status || 'sin-conversacion'
hecho 'g_adjuntos', mensaje_g ? mensaje_g.attachments.count : -1
hecho 'g_tipo', mensaje_g&.attachments&.first&.file_type || '-'
hecho 'g_bytes', mensaje_g&.attachments&.first&.file&.blob&.byte_size || 0

# H · una persona escribe en el hilo de una conversación automática y después llega otra respuesta
# automática a ese hilo: Chatwoot la reabre y el inicializador ya no la vuelve a cerrar.
procesar.call(correo('h1-automatica', de: 'robot.h@sonda.example.test', asunto: 'Aviso automatico inventado',
                                      cabeceras: { 'Auto-Submitted' => 'auto-generated' }))
hecho 'h_estado_inicio', conversacion_de.call('h1-automatica')&.status || 'sin-conversacion'
procesar.call(correo('h2-persona', de: 'persona.h@sonda.example.test', asunto: 'Re: Aviso automatico inventado',
                                   cabeceras: { 'In-Reply-To' => '<h1-automatica@sonda.example.test>' }))
hecho 'h_estado_persona', conversacion_de.call('h2-persona')&.status || 'sin-conversacion'
procesar.call(correo('h3-automatica', de: 'robot.h@sonda.example.test', asunto: 'Re: Re: Aviso automatico inventado',
                                      cabeceras: { 'Auto-Submitted' => 'auto-replied',
                                                   'In-Reply-To' => '<h2-persona@sonda.example.test>' }))
h = conversacion_de.call('h3-automatica')
hecho 'h_misma', h && h.id == conversacion_de.call('h1-automatica')&.id ? 'si' : 'no'
informar.call('h', h)

# Z · control del detector: un correo normal que se resuelve SIN autor, como lo haría el inicializador sin
# `con_autor`. Chatwoot TIENE que escribir su nota de estado y `aviso_estado` TIENE que contarla; si da 0, el
# «0 avisos» de A no mide nada.
procesar.call(correo('z-detector', de: 'cliente.z@sonda.example.test', asunto: 'Control del detector'))
z = conversacion_de.call('z-detector')
Current.executed_by = nil
z&.resolved!
hecho 'z_aviso_estado', aviso_estado.call(z&.reload)

hecho 'conversaciones', inbox.conversations.count
# Correos y trabajos de correo de toda la sonda hasta aquí, todo con la encuesta apagada: tienen que ser 0.
hecho 'correos_enviados', "#{ENCOLADOS.count { _1.include?('Mail') }}/#{ActionMailer::Base.deliveries.size}"

# Y · CONTROL de la medida: el mismo rebote en otra bandeja con la encuesta CSAT ENCENDIDA. Al resolverlo, Chatwoot
# manda la encuesta (CsatSurveyListener → CsatSurveyService → mensaje `template`). `salidas` TIENE que verlo: si da
# «0/0/0», el 0 de A no mide nada. Va al final para no tocar `correos_enviados`.
canal_y = Channel::Email.create!(account: cuenta, email: "encuesta-#{SecureRandom.hex(4)}@sonda.example.test",
                                 imap_enabled: false, smtp_enabled: false)
inbox_y = Inbox.create!(account: cuenta, name: 'Sonda · con encuesta', channel: canal_y, csat_survey_enabled: true)
canal_y.reload
marca_trabajos = ENCOLADOS.size
marca_correos = ActionMailer::Base.deliveries.size
Imap::ImapMailbox.new.process(correo('y-rebote', de: 'MAILER-DAEMON@relay-y.sonda.example.test', asunto: 'Undelivered Mail Returned to Sender',
                                                 cabeceras: { 'Auto-Submitted' => 'auto-replied' }), canal_y)
y = inbox_y.messages.find_by(source_id: 'y-rebote@sonda.example.test')&.conversation&.reload
salida_y = salidas.call(y, marca_trabajos, marca_correos)
hecho 'y_estado', y&.status || 'sin-conversacion'
hecho 'y_salidas', salida_y
hecho 'y_csat', salida_y.split('/').map(&:to_i).any?(&:positive?) ? 'si' : 'no'
hecho 'sonda', 'ok'
