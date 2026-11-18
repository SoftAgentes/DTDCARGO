# frozen_string_literal: true

# SDD-0583 · vista previa de los correos de DTD Cargo SIN enviar nada ni escribir en la base.
#
# Arma cada correo con datos inventados (objetos sin guardar) y deja el HTML y el asunto en
# /tmp/dtd-correo/salida. Sirve antes de montar las plantillas (las toma de /tmp) y después
# (las toma de /app/dtd-correo, si /tmp no existe). Uso en el servidor: runbook §2 ter.
#
# Lo que evita a propósito:
#   - entregas: delivery_method :test y perform_deliveries false;
#   - escrituras: la invitación llama set_reset_password_token, que guarda el usuario;
#     aquí se reemplaza en el objeto de prueba;
#   - datos reales: los avisos a administradores leen sus correos de la base; aquí se
#     reemplazan por una dirección de prueba. Solo se lee el nombre de la cuenta 1.
require 'fileutils'

origen = File.directory?('/tmp/dtd-correo/views') ? '/tmp/dtd-correo' : nil
if origen
  fuente = File.read("#{origen}/zz_dtd_correo.rb").sub("'/app/dtd-correo/views'", "'#{origen}/views'")
  Object.send(:remove_const, :DtdCorreo) if defined?(DtdCorreo)
  eval(fuente, TOPLEVEL_BINDING, "#{origen}/zz_dtd_correo.rb") # rubocop:disable Security/Eval
end
DtdCorreo.instalar
puts "Plantillas: #{DtdCorreo::VISTAS}"

ActionMailer::Base.delivery_method = :test
ActionMailer::Base.perform_deliveries = false
AdministratorNotifications::BaseMailer.class_eval do
  private

  def admin_emails = ['prueba@dtdcargo.com']
end

SALIDA = '/tmp/dtd-correo/salida'
FileUtils.rm_rf(SALIDA)
FileUtils.mkdir_p(SALIDA)

cuenta = Account.find(1)
# El id no existe en la base: solo hace falta para consultar la presencia en Redis.
agente = User.new(id: 999_999_999, name: 'Agente de Prueba', email: 'agente.prueba@dtdcargo.com')
bandeja = Inbox.new(name: 'WhatsApp DTD Cargo', account: cuenta)
conversacion = Conversation.new(display_id: 1234, account: cuenta, inbox: bandeja)
mencion = Message.new(account: cuenta, sender: User.new(name: 'Coordinadora de Prueba'), content: 'nota interna')

def usuario_prueba(**atributos)
  u = User.new(name: 'Agente de Prueba', email: 'agente.prueba@dtdcargo.com', **atributos)
  def u.set_reset_password_token = 'TOKEN-DE-PRUEBA'
  u
end

invitado = usuario_prueba
invitado.account_users.build(account: Account.find(1), inviter: User.new(name: 'Sam (prueba)'))
confirmado = usuario_prueba(confirmed_at: Time.current)
cambio = usuario_prueba(confirmed_at: Time.current, unconfirmed_email: 'nuevo.prueba@dtdcargo.com')

AN = AgentNotifications::ConversationNotificationsMailer
CN = AdministratorNotifications::ChannelNotificationsMailer
casos = {
  '01-restablecer-contrasena' => -> { Devise::Mailer.reset_password_instructions(usuario_prueba, 'TOKEN-DE-PRUEBA') },
  '02-invitacion' => -> { Devise::Mailer.confirmation_instructions(invitado, 'TOKEN-DE-PRUEBA') },
  '03-confirmar-correo' => -> { Devise::Mailer.confirmation_instructions(usuario_prueba, 'TOKEN-DE-PRUEBA') },
  '04-confirmar-correo-nuevo' => -> { Devise::Mailer.confirmation_instructions(cambio, 'TOKEN-DE-PRUEBA') },
  '05-cuenta-activa' => -> { Devise::Mailer.confirmation_instructions(confirmado, 'TOKEN-DE-PRUEBA') },
  '06-contrasena-cambiada' => -> { Devise::Mailer.password_change(usuario_prueba) },
  '08-conversacion-nueva' => -> { AN.conversation_creation(conversacion, agente, nil) },
  '09-conversacion-asignada' => -> { AN.conversation_assignment(conversacion, agente, nil) },
  '10-mencion' => -> { AN.conversation_mention(conversacion, agente, mencion) },
  '11-mensaje-asignada' => -> { AN.assigned_conversation_new_message(conversacion, agente, mencion) },
  '12-mensaje-participa' => -> { AN.participating_conversation_new_message(conversacion, agente, mencion) },
  '13-whatsapp-desconectado' => -> { CN.with(account: cuenta).whatsapp_disconnect(bandeja) },
  '14-correo-desconectado' => -> { CN.with(account: cuenta).email_disconnect(bandeja) },
  '15-correo-de-prueba' => -> { EmailDeliveryTestMailer.delivery_test('prueba@dtdcargo.com', 'Prueba') }
}

fallas = 0
indice = []
casos.each do |nombre, armar|
  m = armar.call.message
  html = m.html_part&.decoded || m.body.decoded
  File.write("#{SALIDA}/#{nombre}.html", html)
  problemas = []
  problemas << 'sin diseño DTD' unless html.include?('Con Confianza, de China a tu puerta.')
  problemas << 'dice Chatwoot' if html.gsub('chat.dtdcargo.com', '').match?(/chatwoot/i)
  problemas << 'texto en inglés' if html.match?(/\b(Hello|Hi |Click|here to|This email was sent)\b/)
  problemas << 'asunto sin marca' unless m.subject.to_s.include?('DTD Cargo')
  problemas << 'remitente' unless m[:from].to_s.include?('notificaciones@dtdcargo.com')
  fallas += 1 if problemas.any?
  estado = problemas.empty? ? 'PASÓ' : "FALLÓ (#{problemas.join(', ')})"
  puts format('%-28s %-6s %s', nombre, estado, m.subject)
  indice << [nombre, m.subject]
rescue StandardError => e
  fallas += 1
  puts format('%-28s FALLÓ  %s: %s', nombre, e.class, e.message.lines.first&.strip)
end
File.write("#{SALIDA}/asuntos.tsv", indice.map { |n, s| "#{n}\t#{s}" }.join("\n"))
puts "Fallas: #{fallas}"
exit(fallas.zero? ? 0 : 1)
