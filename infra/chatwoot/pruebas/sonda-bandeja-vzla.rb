# frozen_string_literal: true

# SDD-0582 4.8 · PC-3 · sonda de correo/bandeja-vzla.rb sobre la imagen real de Chatwoot (casos V de
# prueba-correo-sistema.sh). Corre con `rails runner` en `prepare` (red `interna`, sin internet) y solo con
# datos inventados (example.test): ningún correo sale ni entra. Imprime HECHO clave=valor.
#
# Carga el guion sin correrlo (BANDEJA_VZLA_SIN_CORRER) y llama a sus acciones como lo haría el comando del VPS,
# con las variables en ENV. Las negativas tienen que terminar en `abort`. Después mete correos por
# Imap::ImapMailbox#process, con los trabajos en línea, para ver que cada regla actúa solo en su bandeja.
# Con SONDA_VZLA=<archivo> carga ese guion (lo usan los mutantes).
require 'stringio'

class AdaptadorEnLinea < ActiveJob::QueueAdapters::InlineAdapter
  def enqueue_at(*) = nil
end
ActiveJob::Base.queue_adapter = AdaptadorEnLinea.new
ActionMailer::Base.delivery_method = :test

def hecho(clave, valor) = puts("HECHO #{clave}=#{valor}")

marca = SecureRandom.hex(4)
ENV['SMTP_DOMAIN'] = 'sonda.example.test'
ENV['DTD_BUZON_VZLA'] = "vzla-#{marca}@sonda.example.test"
%w[DTD_MIEMBROS DTD_RESPONSABLE_LEGAL DTD_NO_CLIENTE_DOMINIOS DTD_SISTEMA_REMITENTES].each { |v| ENV.delete(v) }

cuenta = Account.create!(name: 'Sonda bandeja vzla')
ENV['DTD_CUENTA_ID'] = cuenta.id.to_s
agente = lambda do |nombre|
  u = User.new(name: nombre, email: "#{nombre}-#{marca}@sonda.example.test", password: "Pw-#{SecureRandom.hex(8)}-a1!")
  u.skip_confirmation!
  u.save!
  AccountUser.create!(account: cuenta, user: u, role: :agent)
  u
end
sam = agente.call('responsable')
otro = agente.call('miembro')
fuera = agente.call('fuera')

BANDEJA_VZLA_SIN_CORRER = true
load ENV.fetch('SONDA_VZLA', '/tmp/correo/bandeja-vzla.rb')

salidas = []
intentar = lambda do |accion, arg = nil|
  anterior = $stdout
  $stdout = StringIO.new
  DtdBandejaVzla.correr(accion, arg)
  texto = $stdout.string
  salidas << texto
  ['ok', texto]
rescue SystemExit => e
  salidas << e.message
  ['abort', e.message]
ensure
  $stdout = anterior
end
contiene = ->(texto, frase) { texto.include?(frase) ? 'si' : 'no' }

# V1-V2 · negativas antes de crear nada.
r, t = intentar.call('crear')
hecho 'v_sin_miembros', "#{r}:#{contiene.call(t, 'falta DTD_MIEMBROS')}"
ENV['DTD_MIEMBROS'] = "#{sam.id},#{otro.id}"
ENV['DTD_RESPONSABLE_LEGAL'] = fuera.id.to_s
r, t = intentar.call('crear')
hecho 'v_responsable_fuera', "#{r}:#{contiene.call(t, 'tiene que ser miembro')}"
hecho 'v_nada_creado', Inbox.where(account: cuenta).count

# V3 · crear de verdad, con una lista «no-cliente» y un remitente de avisos extra (el Reply-To del ERP).
ENV['DTD_RESPONSABLE_LEGAL'] = sam.id.to_s
ENV['DTD_NO_CLIENTE_DOMINIOS'] = 'banco-inventado.example, @proveedor-inventado.example'
ENV['DTD_SISTEMA_REMITENTES'] = 'comercial@sonda.example.test'
r, t = intentar.call('crear')
hecho 'v_crear', r
inbox = cuenta.inboxes.find_by(name: 'Correo · vzla@')
canal = inbox&.channel
hecho 'v_imap_smtp', canal ? "#{canal.imap_enabled}/#{canal.smtp_enabled}" : 'sin-bandeja'
hecho 'v_claves', canal && canal.imap_password.blank? && canal.smtp_password.blank? ? 'vacias' : 'cargadas'
hecho 'v_servidores', canal ? "#{canal.imap_address}:#{canal.imap_port}:#{canal.imap_enable_ssl}|#{canal.smtp_address}:#{canal.smtp_port}" : '-'
hecho 'v_remitente', inbox ? "#{inbox.business_name}/#{inbox.sender_name_type}" : '-'
hecho 'v_csat', inbox ? "#{inbox.csat_survey_enabled}:#{contiene.call(t, 'encuesta CSAT apagada')}" : '-'
hecho 'v_miembros', inbox ? inbox.members.pluck(:id).sort == [sam.id, otro.id].sort : false
reglas = AutomationRule.where(account: cuenta, name: ['Correo · legal', 'Correo · sistema', 'Correo · no-cliente'])
hecho 'v_reglas', reglas.where(active: true).count
hecho 'v_reglas_en_bandeja', inbox ? reglas.count { |x| DtdBandejaVzla.en_esta_bandeja?(x, inbox) } : 0
legal = reglas.find_by(name: 'Correo · legal')
hecho 'v_legal_asigna', legal&.actions&.find { |a| a['action_name'] == 'assign_agent' }&.dig('action_params', 0).to_i == sam.id ? 'si' : 'no'
hecho 'v_etiquetas', Label.where(account: cuenta, title: %w[legal no-cliente sistema]).count
hecho 'v_estado', "#{contiene.call(t, 'clave imap vacía')}:#{contiene.call(t, 'imap false')}"
r, t = intentar.call('crear')
hecho 'v_otra_vez', "#{r}:#{contiene.call(t, 'ya existe la bandeja')}"

# V4 · las reglas actúan solo en la bandeja de vzla@. Otra bandeja de correo de la misma cuenta, como control.
otra_canal = Channel::Email.create!(account: cuenta, email: "otra-#{marca}@sonda.example.test", imap_enabled: false, smtp_enabled: false)
Inbox.create!(account: cuenta, name: 'Otra bandeja de la sonda', channel: otra_canal)
otra_canal.reload
correo = lambda do |id, de:, asunto:, cabeceras: {}|
  cab = { 'From' => de, 'To' => 'buzon@sonda.example.test', 'Subject' => asunto, 'Message-ID' => "<#{id}-#{marca}@sonda.example.test>",
          'Date' => Time.now.utc.rfc2822, 'MIME-Version' => '1.0' }.merge(cabeceras)
  Mail.read_from_string("#{cab.map { |k, v| "#{k}: #{v}" }.join("\r\n")}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\nTexto inventado.\r\n")
end
leer = lambda do |id, ch, **kw|
  Imap::ImapMailbox.new.process(correo.call(id, **kw), ch)
  c = ch.inbox.messages.find_by(source_id: "#{id}-#{marca}@sonda.example.test")&.conversation&.reload
  return 'sin-conversacion' unless c

  [c.status, c.label_list.sort.join(',').presence || '-', c.priority || '-', c.assignee_id == sam.id ? 'sam' : '-'].join('|')
end
hecho 'v_legal', leer.call('v-legal', canal, de: 'cliente.v@sonda.example.test', asunto: 'Privacidad: pedido inventado')
hecho 'v_noreply', leer.call('v-noreply', canal, de: 'noreply@sonda.example.test', asunto: 'Nuevo contacto web inventado')
hecho 'v_replyto', leer.call('v-replyto', canal, de: 'noreply@sonda.example.test', asunto: 'Nueva estimacion inventada',
                                                 cabeceras: { 'Reply-To' => 'comercial@sonda.example.test' })
hecho 'v_banco', leer.call('v-banco', canal, de: 'avisos@banco-inventado.example', asunto: 'Estado de cuenta inventado')
hecho 'v_gerencia', leer.call('v-gerencia', canal, de: 'avisos@banco-inventado.example', asunto: 'Gerencia: reclamo inventado')
hecho 'v_cliente', leer.call('v-cliente', canal, de: 'cliente.w@sonda.example.test', asunto: 'Cotizacion inventada')
hecho 'v_otra', leer.call('v-otra', otra_canal, de: 'noreply@sonda.example.test', asunto: 'Nuevo contacto web inventado')

# V5 · `reglas` sin variables conserva al responsable y no toca la lista «no-cliente».
%w[DTD_RESPONSABLE_LEGAL DTD_NO_CLIENTE_DOMINIOS].each { |v| ENV.delete(v) }
r, t = intentar.call('reglas')
no_cliente = AutomationRule.find_by(account: cuenta, name: 'Correo · no-cliente')
hecho 'v_reglas_sin_variables', "#{r}:#{contiene.call(t, 'no se crea ni se cambia')}"
hecho 'v_no_cliente_valores', no_cliente&.conditions&.dig(1, 'values')&.size.to_i
hecho 'v_legal_sigue', legal&.reload&.actions&.find { |a| a['action_name'] == 'assign_agent' }&.dig('action_params', 0).to_i == sam.id ? 'si' : 'no'
ENV['DTD_NO_CLIENTE_DOMINIOS'] = 'sonda.example.test'
r, t = intentar.call('reglas')
hecho 'v_dominio_propio', "#{r}:#{contiene.call(t, 'es el dominio de DTD')}"
ENV.delete('DTD_NO_CLIENTE_DOMINIOS')

# V6 · conteo por dominio y salida sin direcciones.
r, t = intentar.call('dominios', '7')
hecho 'v_dominios', "#{r}:#{contiene.call(t, '2 banco-inventado.example')}"
r, = intentar.call('dominios', '90')
hecho 'v_dominios_tope', r
hecho 'v_sin_arroba', salidas.none? { |s| s.include?('@') } ? 'si' : 'no'
hecho 'sonda_vzla', 'ok'
