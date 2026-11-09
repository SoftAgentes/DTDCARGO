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
#   FASE=concurrencia DIR=<carpeta>  dos cargas a la vez, en dos hilos, sobre una cuenta nueva cuyos contactos ya
#                                 existen: con el candado, una se niega y queda una sola copia (G13).
#   FASE=log-postgres DIR=<carpeta>  4.10: un insert_all que falla por un CHECK inyectado, con un contacto de nombre
#                                 SINT-LOG-<cuenta>-<sal>: la marca no puede salir en el log de Postgres (lo lee la prueba
#                                 con `docker compose logs`). Un control fuera del cargador prueba que el log sí la
#                                 escribiría. Después, la carga con un rol sin superusuario tiene que negarse.
#   Las tres últimas cargan el cargador como biblioteca (CARGADOR_RB, por defecto /tmp/cargador/cargar-portal.rb).
#
# escenario-portal.rb la carga sin FASE y llama a SondaPortal.preparar y .verificar en el mismo proceso. Cada
# escenario usa una cuenta nueva, así que varios pueden correr sobre la misma base. Salida: `HECHO clave=valor`.

require 'fileutils'
require 'json'
require 'securerandom'
require 'stringio'
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
    # Repetir con otro estado en un hilo ya cargado: se actualiza (R4).
    escribir(File.join(dir, 'preparado-estado.ndjson'),
             [cab, *contactos, conversaciones.first.merge(estado: 'resolved'), *conversaciones.drop(1), *mensajes])
    # Un mensaje ya cargado que ahora llega en otro hilo: aborta (G14).
    escribir(File.join(dir, 'preparado-movido.ndjson'), [*todo[0...-1], mensajes.last.merge(hilo: h1)])
    # Las guardas de R4: cada variante cambia el estado de UNA conversación ya cargada que cambió en Chatwoot.
    # La base es la de preparado-estado (h1 ya resolved, como queda en Chatwoot después de R4).
    conv_base = [conversaciones.first.merge(estado: 'resolved'), *conversaciones.drop(1)]
    conv_con = ->(i, estado) { conv_base.each_with_index.map { |c, j| j == i ? c.merge(estado: estado) : c } }
    escribir(File.join(dir, 'preparado-guarda-mensaje.ndjson'), [cab, *contactos, *conv_con.call(1, 'open'), *mensajes])
    escribir(File.join(dir, 'preparado-guarda-asignada.ndjson'), [cab, *contactos, *conv_con.call(2, 'open'), *mensajes])
    escribir(File.join(dir, 'preparado-guarda-snoozed.ndjson'), [cab, *contactos, *conv_con.call(0, 'open'), *mensajes])
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
    # Sin pubsub_token, cada mensaje nuevo al contacto mandaría un token nulo a ActionCableBroadcastJob.
    hecho.call('pubsub_nulos', "#{ContactInbox.where(inbox_id: portal).count}:#{ContactInbox.where(inbox_id: portal, pubsub_token: [nil, '']).count}")
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

  # G13: dos cargas a la vez. Una cuenta nueva cuyos contactos y contact_inboxes ya existen (como si los hubiera
  # creado la cola): así las dos cargas no se esperan en los índices únicos de contactos, y sin el candado las dos
  # insertarían las mismas conversaciones. Una tercera conexión bloquea la tabla de conversaciones hasta que las dos
  # cargas llegan (o una ya terminó): con el candado, la segunda se niega en el acto.
  def concurrencia(dir:)
    cargador!
    sub = File.join(dir, 'concurrencia')
    FileUtils.mkdir_p(sub)
    b = File.open(File.join(sub, 'sonda-preparar.txt'), 'w') { |f| preparar(out: f, dir: sub) }
    portal = Inbox.find(b['portal'])
    File.readlines(File.join(sub, 'preparado.ndjson')).map { |l| JSON.parse(l) }.select { |l| l['tipo'] == 'contacto' }.each do |c|
      ident = "dtd-portal:#{c['identificador']}"
      contacto = Contact.find_by(account_id: b['cuenta'], identifier: ident) ||
                 Contact.create!(account_id: b['cuenta'], name: c['nombre'], identifier: ident)
      ContactInbox.find_or_create_by!(contact: contacto, inbox: portal) { |ci| ci.source_id = "cola-#{SecureRandom.hex(4)}" }
    end
    tabla = ActiveRecord::Base.connection_pool.checkout
    tabla.execute('BEGIN')
    tabla.execute('LOCK TABLE conversations IN EXCLUSIVE MODE')
    salidas = Array.new(2) { StringIO.new }
    inicio = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    pids = Thread::Queue.new
    hilos = salidas.map do |s|
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do |con|
          # El pid y el statement_timeout de la conexión de este hilo: la espera se mide por pid, y el tope sale
          # del timeout (revisión del DG): si Chatwoot lo cambia, la prueba se ajusta sola.
          pids << [con.select_value('SELECT pg_backend_pid()').to_i,
                   con.select_value("SELECT setting::bigint FROM pg_settings WHERE name = 'statement_timeout'").to_i]
          File.open(File.join(sub, 'preparado.ndjson'), encoding: 'UTF-8') do |entrada|
            CargaPortal.principal(env_carga(sub, 'VINCULOS' => '-'), entrada: entrada, salida: s)
          end
        end
      rescue Exception => e # rubocop:disable Lint/RescueException -- diagnóstico: se anota y se sigue
        s.puts "HECHO hilo_excepcion=#{e.class}:#{e.message.to_s[0, 200].tr("\n", ' ')}"
      ensure
        s.puts "HECHO hilo_segundos=#{(Process.clock_gettime(Process::CLOCK_MONOTONIC) - inicio).round(1)}"
      end
    end
    # Los dos pids (o los que lleguen en 10 s) y el timeout de sus conexiones, en milisegundos.
    conexiones = []
    100.times do
      conexiones << pids.pop until pids.empty?
      break if conexiones.size == 2

      sleep 0.1
    end
    timeout_ms = conexiones.map(&:last).max.to_i
    # El tope: la mitad del statement_timeout; sin timeout, 30 s.
    tope_s = timeout_ms.positive? ? timeout_ms / 2000.0 : 30.0
    lista = conexiones.map(&:first).join(',')
    esperando = 0
    esperando_max = 0
    eventos = []
    tablas = []
    vueltas = 0
    reloj = -> { Process.clock_gettime(Process::CLOCK_MONOTONIC) }
    desde = reloj.call
    primera_espera = nil
    # El tope corre desde la PRIMERA espera vista: el statement_timeout corta la sentencia que espera, no al hilo.
    # Hasta ver una espera, el tope es 120 s: en los escenarios de mutantes, cada carga tarda más en llegar al insert.
    # (Que el tope desde el arranque fuera la causa del rojo de G13 resultó falso: era la foto de pg_stat_activity,
    # ver abajo y el run 42515706789.)
    loop do
      ahora = reloj.call
      break if primera_espera.nil? && ahora - desde >= 120
      break if primera_espera && ahora - primera_espera >= tope_s

      vueltas += 1
      # La espera, por pid y por pg_stat_activity. `tabla` está DENTRO de una transacción (el BEGIN del LOCK TABLE), y ahí
      # pg_stat_activity devuelve la foto de su primera lectura hasta el final de la transacción: si el hilo empezaba a
      # esperar después de la primera vuelta, no se lo veía nunca (run 42515706789: 24 escenarios con
      # hasta_la_espera_s=nunca y QueryCanceled a los 14 s). pg_stat_clear_snapshot() descarta la foto en cada vuelta.
      unless lista.empty?
        tabla.execute('SELECT pg_stat_clear_snapshot()')
        filas = tabla.select_rows("SELECT wait_event FROM pg_stat_activity WHERE pid IN (#{lista}) AND wait_event_type = 'Lock'")
        # La tabla que esperan, para la evidencia (pg_locks es en vivo).
        tablas |= tabla.select_values("SELECT DISTINCT relation::regclass::text FROM pg_locks WHERE pid IN (#{lista}) AND NOT granted AND relation IS NOT NULL")
      end
      filas ||= []
      esperando = filas.size
      eventos |= filas.flatten.compact
      esperando_max = [esperando_max, esperando].max
      primera_espera ||= reloj.call if esperando.positive?
      break if esperando + hilos.count { |h| !h.alive? } >= 2

      sleep 0.1
    end
    hasta_espera_s = primera_espera ? (primera_espera - desde).round(1) : 'nunca'
    esperado_s = (reloj.call - (primera_espera || desde)).round(1)
    tabla.execute('ROLLBACK')
    ActiveRecord::Base.connection_pool.checkin(tabla)
    tabla = nil
    hilos.each { |h| h.join(120) }
    convs = Conversation.where(inbox_id: portal.id).where("additional_attributes ? 'dtd_hilo'")
    msgs = Message.where(inbox_id: portal.id).where("source_id LIKE 'dtd:%'")
    File.open(File.join(dir, 'concurrencia.txt'), 'w') do |f|
      f.puts "HECHO concurrencia_esperando=#{esperando}"
      f.puts "HECHO concurrencia_conversaciones=#{convs.count}"
      f.puts "HECHO concurrencia_mensajes=#{msgs.count}"
      f.puts "HECHO concurrencia_negadas=#{salidas.count { |s| s.string.include?('HECHO error=otra carga del portal en curso') }}"
      f.puts "HECHO concurrencia_ok=#{salidas.count { |s| s.string.include?('HECHO carga=ok') }}"
      f.puts "HECHO concurrencia_esperando_max=#{esperando_max}"
      f.puts "HECHO concurrencia_vueltas=#{vueltas}"
      f.puts "HECHO concurrencia_vivos_al_final=#{hilos.count(&:alive?)}"
      f.puts "HECHO concurrencia_statement_timeout_ms=#{timeout_ms}"
      f.puts "HECHO concurrencia_tope_s=#{tope_s}"
      f.puts "HECHO concurrencia_esperado_s=#{esperado_s}"
      f.puts "HECHO concurrencia_hasta_la_espera_s=#{hasta_espera_s}"
      f.puts "HECHO concurrencia_wait_event=#{eventos.empty? ? 'ninguno' : eventos.sort.join(',')}"
      f.puts "HECHO concurrencia_tabla_esperada=#{tablas.empty? ? 'ninguna' : tablas.sort.join(',')}"
      f.puts "HECHO concurrencia_cancelados=#{salidas.count { |s| s.string.include?('QueryCanceled') }}"
      # Las HECHO de cada hilo (solo conteos y errores propios del cargador), para leer la causa de un rojo.
      salidas.each_with_index do |s, i|
        s.string.each_line { |l| f.puts "HILO#{i + 1} #{l}" if l.start_with?('HECHO ') }
      end
    end
  rescue StandardError, ScriptError => e
    File.write(File.join(dir, 'concurrencia.txt'), "HECHO concurrencia=error:#{e.class}\n")
  ensure
    if tabla
      tabla.execute('ROLLBACK') rescue nil
      ActiveRecord::Base.connection_pool.checkin(tabla)
    end
  end

  # C-13 justo después de la carga 1: los estados y la nota, antes de que una repetición pueda corregirlos.
  def estados(out:, dir:)
    b = JSON.parse(File.read(File.join(dir, 'base.json')))
    convs = Conversation.where(inbox_id: b['portal']).where("additional_attributes ? 'dtd_hilo'")
    hilo = ->(h) { convs.find_by("additional_attributes->>'dtd_hilo' = ?", b['hilos'][h]) }
    out.puts "HECHO estados=#{%w[h1 h2 h3 h4].map { |h| hilo.call(h)&.status }.join(',')}"
    nota = Message.where(inbox_id: b['portal']).where("source_id LIKE 'dtd:archivado:%'").pick(:conversation_id)
    out.puts "HECHO nota_en_su_hilo=#{nota && nota == hilo.call('h4')&.id ? 'si' : 'no'}"
  end

  # Las guardas de R4: tres conversaciones ya cargadas que cambiaron en Chatwoot, una por guarda. h2 recibe un
  # mensaje de un agente (sin source_id), h3 queda asignada y h1 queda en snoozed. Sin callbacks donde se puede.
  def guardas(out:, dir:, cual:)
    b = JSON.parse(File.read(File.join(dir, 'base.json')))
    convs = Conversation.where(inbox_id: b['portal']).where("additional_attributes ? 'dtd_hilo'")
    hilo = ->(h) { convs.find_by("additional_attributes->>'dtd_hilo' = ?", b['hilos'][h]) }
    case cual
    when 'mensaje'
      ahora = Time.zone.now
      Message.insert_all([{ account_id: b['cuenta'], inbox_id: b['portal'], conversation_id: hilo.call('h2').id, message_type: 1,
                            content: 'SINT-AGENTE respuesta en Chatwoot', private: false, status: 0, source_id: nil,
                            sender_type: 'User', sender_id: b['agente'], content_attributes: {}, created_at: ahora, updated_at: ahora }])
    when 'asignada' then hilo.call('h3').update_columns(assignee_id: b['agente'])
    when 'snoozed' then hilo.call('h1').update_columns(status: Conversation.statuses.fetch('snoozed'))
    else raise 'guarda desconocida'
    end
    out.puts "HECHO guarda_#{cual}=ok"
  end

  # R4: el estado del hilo 1 en Chatwoot después de repetir la carga con otro estado.
  def estado(out:, dir:)
    b = JSON.parse(File.read(File.join(dir, 'base.json')))
    st = Conversation.where(inbox_id: b['portal']).where("additional_attributes->>'dtd_hilo' = ?", b['hilos']['h1']).pick(:status)
    out.puts "HECHO estado_h1=#{Conversation.statuses.key(st) || st}"
  end

  # L1 a L3 (SDD-0586 4.10). La restricción se nombra por la cuenta y compara md5: ni la marca ni el control quedan
  # escritos en el DDL, y en el log cada escenario tiene su propio nombre de restricción.
  def log_postgres(dir:)
    cargador!
    b = JSON.parse(File.read(File.join(dir, 'base.json')))
    cuenta = Integer(b['cuenta'])
    sal = SecureRandom.hex(4) # con la cuenta sola, SINT-LOG-4 se encontraría dentro de SINT-LOG-40
    marca = "SINT-LOG-#{cuenta}-#{sal}"
    control = "SINT-LOG-CONTROL-#{cuenta}-#{sal}"
    restriccion = "sint_log_#{cuenta}"
    conexion = ActiveRecord::Base.connection
    conexion.execute("ALTER TABLE contacts ADD CONSTRAINT #{restriccion} CHECK (md5(name) NOT IN " \
                     "(#{conexion.quote(Digest::MD5.hexdigest(marca))}, #{conexion.quote(Digest::MD5.hexdigest(control))}))")
    File.open(File.join(dir, 'log-postgres.txt'), 'w') do |out|
      out.puts "HECHO log_restriccion=#{restriccion}"
      out.puts "HECHO log_marca=#{marca}"
      out.puts "HECHO log_control=#{control}"
      # Control: el mismo insert_all, fuera del cargador y sin los SET LOCAL. Tiene que fallar y quedar en el log.
      control_fallo = begin
        ActiveRecord::Base.transaction(requires_new: true) do
          ahora = Time.zone.now
          Contact.insert_all([{ account_id: cuenta, name: control, identifier: "dtd-portal:#{SecureRandom.uuid}",
                                created_at: ahora, updated_at: ahora }])
        end
        'no'
      rescue ActiveRecord::StatementInvalid
        'si'
      end
      out.puts "HECHO log_control_fallo=#{control_fallo}"
    end
    # Un contacto nuevo con la marca en el nombre: el primer insert_all de la carga falla por la restricción.
    lineas = File.readlines(File.join(dir, 'preparado.ndjson'), chomp: true).map { |l| JSON.parse(l) }
    lineas[0]['contactos'] += 1
    nuevo = { 'tipo' => 'contacto', 'cliente' => SecureRandom.uuid, 'identificador' => SecureRandom.uuid, 'nombre' => marca }
    escribir(File.join(dir, 'preparado-log.ndjson'), [lineas[0], nuevo, *lineas.drop(1)])
    cargar_en_proceso(dir: dir, nombre: 'rechazo-log', archivo: 'preparado-log.ndjson')
    # L3: con un rol que no es superusuario no se pueden fijar los dos parámetros, y la carga no entra. El rol lee
    # todo (las comprobaciones de antes de la transacción), pero no escribe.
    sin_super = 'sint_sin_super'
    unless conexion.select_value("SELECT 1 FROM pg_roles WHERE rolname = '#{sin_super}'")
      conexion.execute("CREATE ROLE #{sin_super} NOLOGIN NOSUPERUSER")
    end
    conexion.execute("GRANT SELECT ON ALL TABLES IN SCHEMA public TO #{sin_super}")
    conexion.execute("GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO #{sin_super}")
    begin
      conexion.execute("SET ROLE #{sin_super}")
      cargar_en_proceso(dir: dir, nombre: 'rechazo-sin-super', archivo: 'preparado-log.ndjson')
    ensure
      conexion.execute('RESET ROLE')
    end
    File.open(File.join(dir, 'log-postgres.txt'), 'a') do |out|
      out.puts "HECHO log_contactos_marca=#{Contact.where(account_id: cuenta, name: [marca, control]).count}"
      out.puts 'HECHO log_postgres=ok'
    end
  rescue StandardError, ScriptError => e
    File.open(File.join(dir, 'log-postgres.txt'), 'a') { |out| out.puts "HECHO log_postgres=error:#{e.class}" }
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
when 'concurrencia' then SondaPortal.concurrencia(dir: ENV.fetch('DIR'))
when 'estado' then SondaPortal.estado(out: $stdout, dir: ENV.fetch('DIR'))
when 'estados' then SondaPortal.estados(out: $stdout, dir: ENV.fetch('DIR'))
when 'log-postgres' then SondaPortal.log_postgres(dir: ENV.fetch('DIR'))
when 'guardas' then SondaPortal.guardas(out: $stdout, dir: ENV.fetch('DIR'), cual: ENV.fetch('CUAL'))
end
