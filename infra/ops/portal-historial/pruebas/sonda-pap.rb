# frozen_string_literal: true

# infra/ops/portal-historial/pruebas/sonda-pap.rb — sonda del lado de Chatwoot de la prueba punta a punta
# (prueba-punta-a-punta.sh, SDD-0586 10.7). Solo datos inventados. Corre con `rails runner` en el servicio `prepare`.
#
#   FASE=preparar   crea una cuenta con un administrador (el usuario de servicio), un agente (el vinculado al autor
#                   U1 de Studio) y la bandeja «Conversaciones del portal» (API, sin webhook_url). Imprime sus ids.
#   FASE=contar CUENTA=<id> BANDEJA=<id>   lo cargado en la bandeja: contactos dtd-portal, conversaciones dtd_hilo,
#                   mensajes y notas dtd:, dobles y pubsub_token nulos.
#   FASE=api CUENTA=<id> BANDEJA=<id> HILO=<uuid> AGENTE=<id>   (e) manda un mensaje saliente por la API de Chatwoot,
#                   como el panel, a la conversación cargada de ese hilo, espera a que Sidekiq vacíe las colas y
#                   cuenta RetrySet y DeadSet.
# Salida: `HECHO clave=valor`, solo conteos e ids.

require 'json'
require 'net/http'
require 'securerandom'
require 'sidekiq/api'

module SondaPap
  module_function

  def hecho(k, v)
    puts "HECHO #{k}=#{v}"
  end

  def usuario(nombre, marca)
    clave = "#{SecureRandom.hex(12)}Aa1!"
    u = User.new(name: nombre, email: "#{nombre.downcase.tr(' ', '.')}.#{marca}@example.test", password: clave,
                 password_confirmation: clave)
    u.skip_confirmation!
    u.save!
    u
  end

  def preparar
    marca = SecureRandom.hex(4)
    cuenta = Account.create!(name: "SINT Cuenta Punta a punta #{marca}")
    admin = usuario('SINT Servicio', marca)
    AccountUser.create!(account: cuenta, user: admin, role: :administrator)
    agente = usuario('SINT Agente', marca)
    AccountUser.create!(account: cuenta, user: agente, role: :agent)
    portal = Inbox.create!(account: cuenta, name: 'Conversaciones del portal', channel: Channel::Api.create!(account: cuenta),
                           enable_auto_assignment: false, greeting_enabled: false, csat_survey_enabled: false)
    portal.add_members([agente.id])
    otra = Inbox.create!(account: cuenta, name: 'SINT Otra', channel: Channel::Api.create!(account: cuenta))
    hecho('cuenta', cuenta.id)
    hecho('servicio', admin.id)
    hecho('agente', agente.id)
    hecho('portal', portal.id)
    hecho('otra', otra.id)
    hecho('preparar', 'ok')
  end

  def contar(cuenta:, bandeja:)
    convs = Conversation.where(inbox_id: bandeja).where("additional_attributes ? 'dtd_hilo'")
    msgs = Message.where(inbox_id: bandeja).where("source_id LIKE 'dtd:%' AND source_id NOT LIKE 'dtd:archivado:%'")
    contactos = Contact.where(account_id: cuenta).where("identifier LIKE 'dtd-portal:%'")
    hecho('contactos', contactos.count)
    hecho('contactos_con_datos', contactos.where('phone_number IS NOT NULL OR email IS NOT NULL').count)
    hecho('conversaciones', convs.count)
    hecho('conversaciones_dobles', convs.group(Arel.sql("additional_attributes->>'dtd_hilo'")).having('count(*) > 1').count.size)
    hecho('mensajes', msgs.count)
    hecho('mensajes_dobles', msgs.group(:source_id).having('count(*) > 1').count.size)
    hecho('notas', Message.where(inbox_id: bandeja).where("source_id LIKE 'dtd:archivado:%'").count)
    hecho('pubsub_nulos', ContactInbox.where(inbox_id: bandeja, pubsub_token: [nil, '']).count)
    hecho('contar', 'ok')
  end

  # (e) Un mensaje por la API, como lo manda el panel, y lo que hace Sidekiq con él.
  def api(cuenta:, bandeja:, hilo:, agente:)
    conv = Conversation.where(inbox_id: bandeja).find_by("additional_attributes->>'dtd_hilo' = ?", hilo)
    raise 'no está la conversación cargada del hilo' unless conv

    usuario = User.find(agente)
    token = (usuario.access_token || AccessToken.create!(owner: usuario)).token
    host = URI(ENV.fetch('FRONTEND_URL')).host
    http = Net::HTTP.new('rails', 3000)
    http.read_timeout = 30
    # Lo programado, por clase y sin argumentos (pueden traer ids o textos), antes y después del mensaje.
    por_clase = -> { Sidekiq::ScheduledSet.new.map(&:display_class).tally }
    programados_antes = por_clase.call
    reintentos_antes = Sidekiq::RetrySet.new.size
    muertos_antes = Sidekiq::DeadSet.new.size
    req = Net::HTTP::Post.new("/api/v1/accounts/#{cuenta}/conversations/#{conv.display_id}/messages")
    req['Host'] = host
    req['api_access_token'] = token
    req['Content-Type'] = 'application/json'
    req.body = JSON.generate(content: 'SINT respuesta por la API', message_type: 'outgoing', private: false)
    r = http.request(req)
    hecho('api_codigo', r.code)
    # Sidekiq de la prueba procesa lo encolado: se espera a que las colas y lo programado queden vacíos.
    # Las colas, no lo programado: Chatwoot deja trabajos para más tarde en ScheduledSet, y esos no son de este mensaje.
    vacio = (1..90).any? do
      sleep 1
      Sidekiq::Queue.all.sum(&:size).zero?
    end
    sleep 3 # lo que estaba en proceso termina o pasa a reintentos
    hecho('colas_vacias', vacio ? 'si' : 'no')
    despues = por_clase.call
    nuevos = despues.filter_map { |c, n| "#{c}:#{n - programados_antes.fetch(c, 0)}" if n > programados_antes.fetch(c, 0) }.sort
    hecho('programados_nuevos', nuevos.empty? ? 'ninguno' : nuevos.join(','))
    hecho('reintentos_nuevos', Sidekiq::RetrySet.new.size - reintentos_antes)
    hecho('muertos_nuevos', Sidekiq::DeadSet.new.size - muertos_antes)
    hecho('mensaje_api', Message.where(conversation_id: conv.id, content: 'SINT respuesta por la API').count)
    hecho('api', 'ok')
  rescue StandardError => e
    hecho('api', "error:#{e.class}")
  end
end

case ENV['FASE']
when 'preparar' then SondaPap.preparar
when 'contar' then SondaPap.contar(cuenta: Integer(ENV.fetch('CUENTA')), bandeja: Integer(ENV.fetch('BANDEJA')))
when 'api'
  SondaPap.api(cuenta: Integer(ENV.fetch('CUENTA')), bandeja: Integer(ENV.fetch('BANDEJA')), hilo: ENV.fetch('HILO'),
               agente: Integer(ENV.fetch('AGENTE')))
end
