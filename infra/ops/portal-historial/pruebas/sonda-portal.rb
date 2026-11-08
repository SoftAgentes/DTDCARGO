# frozen_string_literal: true

# infra/ops/portal-historial/pruebas/sonda-portal.rb — sonda de la prueba del cargador del portal (SDD-0586
# §10.5.10). Solo datos inventados. Corre con `rails runner` en el servicio `prepare` de la prueba, sin Sidekiq
# corriendo: todo trabajo encolado se queda en Redis y se puede contar.
#
#   FASE=preparar DIR=<carpeta>  crea una cuenta nueva con:
#     · la bandeja «Conversaciones del portal» (canal API) y, en ella, un contacto que ya existía con su
#       contact_inbox y una conversación viva con un mensaje, como si los hubiera creado la cola;
#     · otra bandeja viva con su conversación, una bandeja con webhook_url y el webhook de la cuenta;
#     · un administrador (el usuario de servicio), un agente vinculado y un usuario de otra cuenta.
#     Escribe en DIR el preparado (el formato de E10) y sus variantes malas, y la línea base en DIR/base.json.
#   FASE=verificar DIR=<carpeta>  mide C-2, C-4, C-5 y C-9 a C-14, y los vínculos, contra esa línea base.
#   FASE=con-log DIR=<carpeta>    la carga 1, en este proceso, con el log de SQL de ActiveRecord en debug hacia
#                                 DIR/sql.log: nada de lo cargado (nombres, textos) puede salir allí (F2).
#   FASE=candado DIR=<carpeta>    con el candado de la carga tomado desde otra conexión, una carga tiene que
#                                 negarse sin escribir (G12).
#   Las dos últimas cargan el cargador como biblioteca (CARGADOR_RB, por defecto /tmp/cargador/cargar-portal.rb).
#
# escenario-portal.rb la carga sin FASE y llama a SondaPortal.preparar y .verificar en el mismo proceso. Cada
# escenario usa una cuenta nueva, así que varios pueden correr sobre la misma base. Salida: `HECHO clave=valor`.

require 'json'
require 'securerandom'
require 'sidekiq/api'

module SondaPortal
  module_function

  NOTA = 'Hilo archivado en el Studio. El cliente ya no lo ve: lo que se escriba aquí no le llega.'

  def cola
    Sidekiq::Queue.all.sum(&:size) + Sidekiq::ScheduledSet.new.size + Sidekiq::RetrySet.new.size
  end

  def trabajos_por_clase
    cuenta = Hash.new(0)
    [*Sidekiq::Queue.all, Sidekiq::ScheduledSet.new, Sidekiq::RetrySet.new].each do |c|
      c.each do |trabajo|
        evento = Array(trabajo.display_args).find { |a| a.is_a?(String) && a.match?(/\A[a-z_]+(\.[a-z_]+)+\z/) }
        cuenta[evento ? "#{trabajo.display_class}(#{evento})" : trabajo.display_class] += 1
      end
    end
    lista = cuenta.map { |clase, n| "#{clase}:#{n}" }
    lista.empty? ? 'ninguno' : lista.sort.join(',')
  end

  def igual(a, b)
    (a.to_f - b.to_f).abs < 0.001 ? 'si' : 'no'
  end

  def usuario(nombre, marca)
    clave = "#{SecureRandom.hex(12)}Aa1!"
    u = User.new(name: nombre, email: "#{nombre.downcase.tr(' ', '.')}.#{marca}@example.test", password: clave,
                 password_confirmation: clave)
    u.skip_confirmation!
    u.save!
    u
  end

  def escribir(ruta, lineas)
    File.write(ruta, lineas.map { |l| JSON.generate(l) }.join("\n") + "\n")
  end

  def preparar(out:, dir:)
    hecho = ->(k, v) { out.puts "HECHO #{k}=#{v}" }
    marca = SecureRandom.hex(4)
    cuenta = Account.create!(name: "SINT Cuenta Portal #{marca}")
    admin = usuario('SINT Admin', marca)
    AccountUser.create!(account: cuenta, user: admin, role: :administrator)
    agente = usuario('SINT Agente', marca)
    AccountUser.create!(account: cuenta, user: agente, role: :agent)
    ajeno = usuario('SINT Ajeno', marca) # sin AccountUser en esta cuenta
    portal = Inbox.create!(account: cuenta, name: 'Conversaciones del portal', channel: Channel::Api.create!(account: cuenta),
                           enable_auto_assignment: false, greeting_enabled: false, csat_survey_enabled: false)
    viva = Inbox.create!(account: cuenta, name: 'SINT WhatsApp', channel: Channel::Api.create!(account: cuenta))
    # Otra bandeja API sin webhook, como el Archivo Kommo (la bandeja 8 en producción): no es la del portal.
    archivo = Inbox.create!(account: cuenta, name: 'Archivo Kommo', channel: Channel::Api.create!(account: cuenta))
    con_webhook = Inbox.create!(account: cuenta, name: 'SINT Con webhook',
                                channel: Channel::Api.create!(account: cuenta, webhook_url: 'https://studio.prueba.test/api'))
    Webhook.create!(account: cuenta, url: "https://studio.prueba.test/hook/#{marca}",
                    subscriptions: %w[conversation_created conversation_status_changed conversation_updated
                                      message_created message_updated contact_created contact_updated])

    k1, k2, k3 = Array.new(3) { SecureRandom.uuid }
    i1, i2, i3 = Array.new(3) { SecureRandom.uuid }
    h1, h2, h3, h4 = Array.new(4) { SecureRandom.uuid }
    m = Array.new(8) { SecureRandom.uuid }
    tenant = SecureRandom.uuid

    # Lo que ya había: el contacto del cliente 3 con su contact_inbox de la cola, y su conversación viva.
    c3 = Contact.create!(account: cuenta, name: 'SINT-NOMBRE-3', identifier: "dtd-portal:#{i3}")
    ci3 = ContactInbox.create!(contact: c3, inbox: portal, source_id: "cola-#{marca}")
    cola_conv = Conversation.create!(account: cuenta, inbox: portal, contact: c3, contact_inbox: ci3)
    cola_conv.messages.create!(account: cuenta, inbox: portal, message_type: :incoming, content: 'SINT-COLA', sender: c3)
    x1 = Contact.create!(account: cuenta, name: 'SINT-NOMBRE-X1', phone_number: '+584120000001')
    civ = ContactInbox.create!(contact: x1, inbox: viva, source_id: "sint-x1-#{marca}")
    antes = cola
    conv_viva = Conversation.create!(account: cuenta, inbox: viva, contact: x1, contact_inbox: civ)
    conv_viva.messages.create!(account: cuenta, inbox: viva, message_type: :incoming, content: 'SINT-EXISTENTE', sender: x1)
    # Control: crear con los modelos SÍ encola trabajos. Si diera 0, la medida de C-4 y C-5 no vería nada.
    hecho.call('control_cola', cola - antes)

    # Fechas relativas a hoy: el buscador de mensajes solo mira los últimos 90 días (SEARCH_TIME_RANGE_LIMIT_DAYS).
    hace = ->(dias, min = 0) { (Time.now.utc.change(sec: 0) - dias.days + min.minutes).iso8601 }
    cab = { tipo: 'cabecera', version: 1, tenant_id: tenant, cuenta: cuenta.id, bandeja: portal.id,
            corte: '2026-11-10T14:00:00Z', contactos: 3, conversaciones: 4, mensajes: 8 }
    contactos = [
      { tipo: 'contacto', cliente: k1, identificador: i1, nombre: 'SINT-NOMBRE-1' },
      { tipo: 'contacto', cliente: k2, identificador: i2, nombre: 'SINT-NOMBRE-2' },
      { tipo: 'contacto', cliente: k3, identificador: i3, nombre: 'SINT-NOMBRE-3' }
    ]
    conversaciones = [
      { tipo: 'conversacion', hilo: h1, cliente: k1, estado: 'open', creada_at: hace.call(150), archivado_at: nil, nota_archivo: nil },
      { tipo: 'conversacion', hilo: h2, cliente: k1, estado: 'resolved', creada_at: hace.call(120), archivado_at: nil, nota_archivo: nil },
      { tipo: 'conversacion', hilo: h3, cliente: k2, estado: 'pending', creada_at: hace.call(90), archivado_at: nil, nota_archivo: nil },
      { tipo: 'conversacion', hilo: h4, cliente: k3, estado: 'resolved', creada_at: hace.call(30),
        archivado_at: hace.call(5),
        nota_archivo: { source_id: "dtd:archivado:#{h4}", texto: NOTA, created_at: hace.call(5) } }
    ]
    msj = lambda do |i, hilo, sentido, texto, cuando, ag|
      { tipo: 'mensaje', hilo: hilo, mensaje: m[i], source_id: "dtd:#{m[i]}", sentido: sentido, texto: texto,
        created_at: cuando, agente: ag }
    end
    mensajes = [
      msj.call(0, h1, 'entrante', 'SINT-TEXTO-1 ¿Llegó mi caja?', hace.call(150), nil),
      msj.call(1, h1, 'saliente', 'SINT-TEXTO-2 Sí, llegó.', hace.call(150, 5), agente.id),
      # m3 y m4 a la misma hora: el orden lo da el archivo (sent_at y después id en Studio).
      msj.call(2, h2, 'entrante', 'SINT-TEXTO-3', hace.call(120), nil),
      msj.call(3, h2, 'saliente', 'SINT-TEXTO-4', hace.call(120), nil),
      msj.call(4, h2, 'entrante', 'SINT-TEXTO-5', hace.call(120, 30), nil),
      msj.call(5, h3, 'entrante', 'SINT-TEXTO-6', hace.call(90), nil),
      msj.call(6, h4, 'entrante', 'SINT-TEXTO-7', hace.call(30), nil),
      msj.call(7, h4, 'saliente', 'SINT-TEXTO-8 SINTBUSCAR', hace.call(30, 10), agente.id)
    ]
    todo = [cab, *contactos, *conversaciones, *mensajes]
    escribir(File.join(dir, 'preparado.ndjson'), todo)
    escribir(File.join(dir, 'preparado-otra-cuenta.ndjson'), [cab.merge(cuenta: cuenta.id + 100_000), *todo.drop(1)])
    escribir(File.join(dir, 'preparado-truncado.ndjson'), todo[0...-1])
    escribir(File.join(dir, 'preparado-hilo-ausente.ndjson'), [*todo[0...-1], mensajes.last.merge(hilo: SecureRandom.uuid)])
    escribir(File.join(dir, 'preparado-agente-ajeno.ndjson'), [*todo[0...-1], mensajes.last.merge(agente: ajeno.id)])
    # Con la cabecera de otra bandeja API sin webhook: la cabecera cuadra con BANDEJA, pero no es la del portal (G10).
    escribir(File.join(dir, 'preparado-whatsapp.ndjson'), [cab.merge(bandeja: viva.id), *todo.drop(1)])
    escribir(File.join(dir, 'preparado-archivo.ndjson'), [cab.merge(bandeja: archivo.id), *todo.drop(1)])
    escribir(File.join(dir, 'preparado-sin-contacto.ndjson'),
             [cab, *contactos, *conversaciones[0...-1], conversaciones.last.merge(cliente: SecureRandom.uuid), *mensajes])

    base = { 'cuenta' => cuenta.id, 'portal' => portal.id, 'viva' => viva.id, 'archivo' => archivo.id, 'con_webhook' => con_webhook.id,
             'admin' => admin.id, 'agente' => agente.id, 'ajeno' => ajeno.id, 'c3' => c3.id, 'ci3' => ci3.id,
             'ci3_source' => ci3.source_id, 'cola_conv' => cola_conv.id, 'conv_viva' => conv_viva.id,
             'cola_conv_updated' => cola_conv.reload.updated_at.to_f, 'conv_viva_updated' => conv_viva.reload.updated_at.to_f,
             'c3_updated' => c3.reload.updated_at.to_f, 'mensajes_viva' => Message.where(inbox_id: viva.id).count,
             'hilos' => { 'h1' => h1, 'h2' => h2, 'h3' => h3, 'h4' => h4 }, 'k3' => k3,
             'orden' => conversaciones.to_h { |c| [c[:hilo], mensajes.select { |x| x[:hilo] == c[:hilo] }.map { |x| x[:source_id] }] },
             'servicio_firma' => "dtd:#{m[3]}", 'agente_firma' => ["dtd:#{m[1]}", "dtd:#{m[7]}"],
             'cola_base' => cola, 'trabajos_base' => trabajos_por_clase }
    File.write(File.join(dir, 'base.json'), JSON.generate(base))
    %w[cuenta portal viva archivo con_webhook admin ajeno].each { |k| hecho.call(k, base[k]) }
    hecho.call('preparar', 'ok')
    base
  end

  def verificar(out:, dir:)
    hecho = ->(k, v) { out.puts "HECHO #{k}=#{v}" }
    medir = lambda do |k, &bloque|
      hecho.call(k, bloque.call)
    rescue StandardError => e
      hecho.call(k, "error:#{e.class}")
    end
    b = JSON.parse(File.read(File.join(dir, 'base.json')))
    cuenta = b['cuenta']
    portal = b['portal']
    convs = Conversation.where(inbox_id: portal).where("additional_attributes ? 'dtd_hilo'")
    msgs = Message.where(inbox_id: portal).where("source_id LIKE 'dtd:%' AND source_id NOT LIKE 'dtd:archivado:%'")
    notas = Message.where(inbox_id: portal).where("source_id LIKE 'dtd:archivado:%'")

    # C-4 y C-5: la cola, antes de que esta sonda cree nada, frente a la línea base de preparar.
    hecho.call('cola_igual', cola == b['cola_base'] && trabajos_por_clase == b['trabajos_base'] ? 'si' : 'no')
    hecho.call('con_webhook_conversaciones', Conversation.where(inbox_id: b['con_webhook']).count)

    # C-2: lo cargado coincide con el preparado.
    hecho.call('conversaciones', convs.count)
    hecho.call('mensajes', msgs.count)
    hecho.call('entrantes', msgs.where(message_type: :incoming).count)
    hecho.call('salientes', msgs.where(message_type: :outgoing).count)
    hecho.call('notas', "#{notas.count}:#{notas.where(message_type: :activity, private: false, content: NOTA).count}")
    hecho.call('contactos_portal', Contact.where(account_id: cuenta).where("identifier LIKE 'dtd-portal:%'").count)
    # C-13: los estados, ya traducidos; el archivado, resolved y con su nota en su conversación.
    hilo = ->(h) { convs.find_by("additional_attributes->>'dtd_hilo' = ?", b['hilos'][h]) }
    medir.call('estados') { %w[h1 h2 h3 h4].map { |h| hilo.call(h)&.status }.join(',') }
    medir.call('nota_en_su_hilo') { notas.pick(:conversation_id) == hilo.call('h4')&.id ? 'si' : 'no' }
    # C-12: el orden. En cada hilo, el orden de Chatwoot (created_at e id) es el del preparado, sin la nota.
    medir.call('orden_diferencias') do
      b['orden'].count do |h, esperado|
        c = convs.find_by("additional_attributes->>'dtd_hilo' = ?", h)
        c.nil? || msgs.where(conversation_id: c.id).order(:created_at, :id).pluck(:source_id) != esperado
      end
    end
    # Las fechas son las de Studio, no las de la carga.
    hecho.call('fechas_de_studio', msgs.where('created_at > ?', 1.day.ago).count.zero? &&
                                   convs.where('created_at > ?', 1.day.ago).count.zero? ? 'si' : 'no')
    # Los remitentes: el entrante es el contacto de su conversación; el saliente, su agente o el de servicio.
    hecho.call('remitente_cruzado', msgs.where(message_type: :incoming).joins(:conversation)
                                        .where("messages.sender_type IS DISTINCT FROM 'Contact' OR messages.sender_id IS DISTINCT FROM conversations.contact_id").count)
    medir.call('firma_servicio') { msgs.where(source_id: b['servicio_firma']).pick(:sender_type, :sender_id) == ['User', b['admin']] ? 'si' : 'no' }
    medir.call('firma_agente') { msgs.where(source_id: b['agente_firma']).pluck(:sender_type, :sender_id).uniq == [['User', b['agente']]] ? 'si' : 'no' }
    # C-10: un contacto por cliente, sin teléfono ni correo, y el que ya existía se reusa con su contact_inbox.
    portal_contactos = Contact.where(account_id: cuenta).where("identifier LIKE 'dtd-portal:%'")
    hecho.call('contactos_con_datos', portal_contactos.where('phone_number IS NOT NULL OR email IS NOT NULL').count)
    hecho.call('c3_reusado', hilo.call('h4')&.contact_id == b['c3'] ? 'si' : 'no')
    hecho.call('ci3_reusado', hilo.call('h4')&.contact_inbox_id == b['ci3'] && ContactInbox.where(contact_id: b['c3'], inbox_id: portal).count == 1 ? 'si' : 'no')
    hecho.call('huerfanos', msgs.where.not(conversation_id: Conversation.select(:id)).count + convs.where.not(contact_id: Contact.select(:id)).count)
    hecho.call('contact_inbox_cruzado', convs.joins('JOIN contact_inboxes ci ON ci.id = conversations.contact_inbox_id')
                                             .where('ci.contact_id <> conversations.contact_id OR ci.inbox_id <> conversations.inbox_id').count)
    hecho.call('json_conv', convs.where("jsonb_typeof(additional_attributes::jsonb) <> 'object'").count)
    medir.call('no_leidos') { convs.to_a.sum { |c| c.unread_incoming_messages.count } }

    # C-11: lo que ya había no cambió.
    hecho.call('previo_intacto', [igual(Conversation.find(b['cola_conv']).updated_at, b['cola_conv_updated']),
                                  igual(Conversation.find(b['conv_viva']).updated_at, b['conv_viva_updated']),
                                  igual(Contact.find(b['c3']).updated_at, b['c3_updated']),
                                  Message.where(inbox_id: b['viva']).count == b['mensajes_viva'] ? 'si' : 'no'].join(','))

    # Los vínculos: solo ids, y cada id es el de Chatwoot.
    medir.call('vinculos') do
      lineas = File.readlines(File.join(dir, 'vinculos-carga-1.ndjson'), chomp: true).reject(&:empty?).map { |l| JSON.parse(l) }
      claves = { 'cabecera' => %w[tipo version tenant_id cuenta bandeja corte contactos conversaciones mensajes],
                 'contacto' => %w[tipo cliente identificador contacto_id source_id],
                 'conversacion' => %w[tipo hilo conversacion_id], 'mensaje' => %w[tipo mensaje mensaje_id] }
      malas = lineas.count { |l| claves[l['tipo']] != l.keys }
      ok = lineas.count do |l|
        case l['tipo']
        when 'cabecera' then l['cuenta'] == cuenta && l['bandeja'] == portal && l['conversaciones'] == 4 && l['mensajes'] == 8 && l['contactos'] == 3
        when 'contacto'
          ci = ContactInbox.find_by(contact_id: l['contacto_id'], inbox_id: portal)
          ci && ci.source_id == l['source_id'] && Contact.where(id: l['contacto_id'], identifier: "dtd-portal:#{l['identificador']}").exists?
        when 'conversacion' then convs.where("additional_attributes->>'dtd_hilo' = ?", l['hilo']).pick(:display_id) == l['conversacion_id']
        when 'mensaje' then msgs.where(id: l['mensaje_id'], source_id: "dtd:#{l['mensaje']}").exists?
        end
      end
      c3 = lineas.find { |l| l['tipo'] == 'contacto' && l['cliente'] == b['k3'] }
      "lineas:#{lineas.size},claves_malas:#{malas},ids_ok:#{ok},c3_source:#{c3 && c3['source_id'] == b['ci3_source'] ? 'si' : 'no'}"
    end

    # C-14: el buscador de Chatwoot encuentra lo cargado, como administrador.
    medir.call('buscador') do
      admin = User.find(b['admin'])
      cuenta_ar = Account.find(cuenta)
      Current.user = admin
      Current.account = cuenta_ar
      Current.account_user = AccountUser.find_by(account_id: cuenta, user_id: admin.id)
      r = SearchService.new(current_user: admin, current_account: cuenta_ar, search_type: 'Message', params: { q: 'SINTBUSCAR' }).perform
      Array(r[:messages]).size
    ensure
      Current.user = nil
      Current.account = nil
      Current.account_user = nil
    end

    # C-9: los números de conversación. Una conversación nueva, creada como la crearía el canal, va después.
    max_portal = convs.maximum(:display_id).to_i
    ci = ContactInbox.find(b['ci3'])
    nueva = Conversation.create!(account_id: cuenta, inbox_id: portal, contact_id: b['c3'], contact_inbox: ci)
    hecho.call('display_nueva_mayor', nueva.display_id > max_portal ? 'si' : 'no')
    hecho.call('display_duplicados', Conversation.where(account_id: cuenta).group(:display_id).having('count(*) > 1').count.size)
    orden = convs.order(:display_id).map { |c| c.created_at.to_i }
    hecho.call('display_en_orden', orden == orden.sort ? 'si' : 'no')
    hecho.call('verificar', 'ok')
  end
end

module SondaPortal
  module_function

  # El cargador como biblioteca: sin ejecutar su punto de entrada al cargarlo.
  def cargador!
    return if defined?(CargaPortal)

    Object.const_set(:CARGA_PORTAL_COMO_BIBLIOTECA, true) unless defined?(CARGA_PORTAL_COMO_BIBLIOTECA)
    load ENV.fetch('CARGADOR_RB', '/tmp/cargador/cargar-portal.rb')
  end

  def env_carga(dir, extra = {})
    b = JSON.parse(File.read(File.join(dir, 'base.json')))
    { 'MODO' => 'cargar', 'CUENTA' => b['cuenta'].to_s, 'BANDEJA' => b['portal'].to_s, 'AGENTE_SERVICIO' => b['admin'].to_s,
      'CARGA' => '-', 'VINCULOS' => RUTA_VINCULOS }.merge(extra)
  end

  RUTA_VINCULOS = '/dev/shm/portal-historial/vinculos.ndjson'

  def cargar_en_proceso(dir:, nombre:, archivo: 'preparado.ndjson', extra: {})
    cargador!
    File.open(File.join(dir, "#{nombre}.txt"), 'w') do |f|
      File.open(File.join(dir, archivo), encoding: 'UTF-8') do |entrada|
        CargaPortal.principal(env_carga(dir, extra), entrada: entrada, salida: f)
      end
    rescue StandardError, ScriptError => e
      f.puts 'HECHO carga=error'
      f.puts "HECHO error=sonda:#{e.class}"
    end
  end

  # F2: el log de SQL en debug, como lo dejaría LOG_LEVEL=debug. Una consulta de control prueba que el log sí escribe;
  # después, la carga 1.
  def con_log(dir:)
    previo = ActiveRecord::Base.logger
    log = Logger.new(File.join(dir, 'sql.log'))
    log.level = Logger::DEBUG
    ActiveRecord::Base.logger = log
    ActiveRecord::Base.connection.select_value("SELECT 'SINT-CONTROL-LOG'")
    cargar_en_proceso(dir: dir, nombre: 'carga-1')
  ensure
    ActiveRecord::Base.logger = previo
    log&.close
  end

  # G12: el candado de la carga, tomado desde otra conexión.
  def candado(dir:)
    cargador!
    llave = CargaPortal::CANDADO
    otra = ActiveRecord::Base.connection_pool.checkout
    otra.execute("SELECT pg_advisory_lock(#{Integer(llave)})")
    cargar_en_proceso(dir: dir, nombre: 'rechazo-candado')
  rescue StandardError, ScriptError => e
    File.write(File.join(dir, 'rechazo-candado.txt'), "HECHO carga=error\nHECHO error=sonda:#{e.class}\n")
  ensure
    if otra
      otra.execute("SELECT pg_advisory_unlock_all()")
      ActiveRecord::Base.connection_pool.checkin(otra)
    end
  end
end

case ENV['FASE']
when 'preparar' then SondaPortal.preparar(out: $stdout, dir: ENV.fetch('DIR'))
when 'verificar' then SondaPortal.verificar(out: $stdout, dir: ENV.fetch('DIR'))
when 'con-log' then SondaPortal.con_log(dir: ENV.fetch('DIR'))
when 'candado' then SondaPortal.candado(dir: ENV.fetch('DIR'))
end
