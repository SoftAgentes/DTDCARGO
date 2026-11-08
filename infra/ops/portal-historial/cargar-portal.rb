# frozen_string_literal: true

# infra/ops/portal-historial/cargar-portal.rb — SDD-0586 §10.5.10, paso 3: carga a Chatwoot, SIN EFECTOS, los hilos
# del chat del portal que ya existen en Studio, en la bandeja «Conversaciones del portal». Corre con `rails runner`
# dentro del contenedor de Chatwoot. Es una copia adaptada de infra/ops/kommo-historial/cargar-archivo-kommo.rb
# (SDD-0590 5.5): no depende de esa carpeta, que retira la 0619.
#
#   MODO=seco|cargar CUENTA=<id> BANDEJA=<CHATWOOT_INBOX_PORTAL_ID> AGENTE_SERVICIO=<user id> CARGA=- \
#     VINCULOS=/dev/shm/portal-historial/vinculos.ndjson bundle exec rails runner cargar-portal.rb < preparado.ndjson
#
# Entrada: `preparado.ndjson`, el formato de E10 (SDD-0586 §10.5.10, «Los dos archivos»): cabecera, contacto,
# conversacion y mensaje. Salida: `vinculos.ndjson`, SOLO ids (cabecera, contacto, conversacion y mensaje). En
# MODO=seco no se escribe. Sin MODO, el script no hace nada y sale con error.
#
# La bandeja (revisión del DG, B1): BANDEJA es el número que da quien opera, CHATWOOT_INBOX_PORTAL_ID, y el cargador lo
# cruza con el nombre «Conversaciones del portal». Si no coinciden, no carga: otra bandeja API sin webhook, como la
# del Archivo Kommo, no pasa.
#
# Los vínculos (contrato con E10, Subdirector 2026-11-08): VINCULOS solo acepta la ruta fija
# /dev/shm/portal-historial/vinculos.ndjson, el nombre que lee `vincular.sh` (`$DIR/vinculos.ndjson`), o `-`, que es
# SOLO PARA PRUEBAS (cada línea sale con el prefijo `VINCULO ` entre los logs de Rails). Se valida antes de abrir la
# transacción. Con `docker exec`, la ruta es la del contenedor, en su /dev/shm (tmpfs); el traslado a la misma ruta
# del VPS, con `docker cp`, 0600 y el borrado en el contenedor, lo hace `cargar.sh` (segunda PR de E5):
#
#   docker exec chatwoot-rails-1 install -d -m 0700 /dev/shm/portal-historial
#   docker exec -i -e MODO=cargar -e CUENTA=<id> -e BANDEJA=<id> -e AGENTE_SERVICIO=<id> -e CARGA=- \
#     -e VINCULOS=/dev/shm/portal-historial/vinculos.ndjson chatwoot-rails-1 \
#     bundle exec rails runner /tmp/cargar-portal.rb < /dev/shm/portal-historial/preparado.ndjson
#   docker cp chatwoot-rails-1:/dev/shm/portal-historial/vinculos.ndjson /dev/shm/portal-historial/vinculos.ndjson
#   chmod 0600 /dev/shm/portal-historial/vinculos.ndjson
#   docker exec chatwoot-rails-1 rm -rf /dev/shm/portal-historial /tmp/cargar-portal.rb
#
# Si el archivo queda en otra ruta, `vincular.sh` sale con `HECHO error=sin_vinculos` y no escribe nada.
#
# Dos corridas no se pisan: la transacción toma un candado (pg_try_advisory_xact_lock(CANDADO)); si otra lo tiene,
# no carga. El log de SQL de ActiveRecord se apaga mientras corre: con LOG_LEVEL=debug, el SQL de los insert_all
# llevaría nombres y textos.
#
# Sin efectos quiere decir:
#   · escribe con `insert_all`, que no corre callbacks de ActiveRecord: ni webhooks, ni notificaciones, ni
#     SendReplyJob, ni eventos de reportes. Nada sale a un cliente ni a Studio;
#   · antes de escribir nada comprueba el archivo entero: la cabecera es de esta cuenta y esta bandeja, los conteos
#     coinciden con las líneas, cada conversación tiene su contacto, cada mensaje su conversación, y cada agente es
#     un usuario de la cuenta. Si algo no cuadra, no carga nada;
#   · no duplica: reconoce el contacto por `identifier = dtd-portal:<identificador>`, la conversación por
#     `additional_attributes.dtd_hilo` y el mensaje por `source_id`. Repetir la carga devuelve los mismos ids;
#   · los contactos no llevan teléfono ni correo (C-10);
#   · MODO=seco no escribe nada, ni consume la secuencia de números de conversación: solo cuenta.
#
# HECHO lleva solo conteos: nunca nombres ni textos.

require 'json'
require 'securerandom'
require 'set'

class CargaPortal
  LOTE = 200
  ENTRANTE = 0 # Message.message_types[:incoming]
  SALIENTE = 1 # Message.message_types[:outgoing]
  ACTIVIDAD = 2 # Message.message_types[:activity]
  ESTADOS = %w[open pending resolved].freeze
  NOMBRE_BANDEJA = 'Conversaciones del portal'
  RUTA_VINCULOS = '/dev/shm/portal-historial/vinculos.ndjson'
  CANDADO = 58_610_510 # pg_try_advisory_xact_lock: una carga del portal a la vez
  SENTIDOS = %w[entrante saliente].freeze
  PREFIJO_CONTACTO = 'dtd-portal:'
  UUID = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/

  # Punto de entrada: el script lo llama con ENV, $stdin y $stdout; el escenario de mutantes, con un Hash y archivos.
  # Devuelve el código de salida.
  def self.principal(env, entrada: $stdin, salida: $stdout)
    a_vinculos = env['VINCULOS'] == '-'
    hechos = salida
    correos = 0
    suscripcion = ActiveSupport::Notifications.subscribe('deliver.action_mailer') { correos += 1 }
    # Sin log de SQL mientras corre: en debug, los insert_all llevarían nombres y textos (revisión de datos personales).
    log_sql = ActiveRecord::Base.logger
    ActiveRecord::Base.logger = nil
    begin
      modo = env.fetch('MODO')
      cargador = new(env: env, modo: modo, entrada: entrada, hechos: hechos, vinculos: a_vinculos ? salida : nil)
      cargador.cargar
      0
    rescue StandardError => e
      # Solo los mensajes propios; de los demás, la clase: los errores de la base pueden traer valores de la fila.
      hechos.puts 'HECHO carga=error'
      hechos.puts "HECHO error=#{e.instance_of?(RuntimeError) ? e.message : e.class.name}"
      1
    ensure
      hechos.puts "HECHO correos_enviados=#{correos}"
      hechos.puts "HECHO rss_pico_kb=#{rss_pico_kb}"
      ActiveSupport::Notifications.unsubscribe(suscripcion)
      ActiveRecord::Base.logger = log_sql
    end
  end

  def self.rss_pico_kb
    File.read('/proc/self/status')[/^VmHWM:\s+(\d+)/, 1] || 'desconocido'
  rescue StandardError
    'desconocido'
  end

  def initialize(env:, modo:, entrada:, hechos:, vinculos: nil)
    raise 'MODO tiene que ser seco o cargar' unless %w[seco cargar].include?(modo)

    @cuenta_id = Integer(env.fetch('CUENTA'))
    @bandeja_id = Integer(env.fetch('BANDEJA'))
    @servicio_id = Integer(env.fetch('AGENTE_SERVICIO'))
    @ruta_carga = env.fetch('CARGA')
    @ruta_vinculos = env['VINCULOS']
    # Antes de abrir la transacción: la ruta fija que lee vincular.sh, o `-` (solo pruebas).
    unless [RUTA_VINCULOS, '-'].include?(@ruta_vinculos)
      raise "VINCULOS tiene que ser #{RUTA_VINCULOS} o -"
    end
    # Sin la carpeta, la carga entraría y los vínculos no se podrían escribir después del commit.
    raise 'falta la carpeta de VINCULOS' unless @ruta_vinculos == '-' || File.directory?(File.dirname(RUTA_VINCULOS))

    @modo = modo
    @entrada = entrada
    @hechos = hechos
    @salida_vinculos = vinculos
    @cuenta = Hash.new(0)
    @falso = 0
  end

  def hecho(clave, valor)
    @hechos.puts "HECHO #{clave}=#{valor}"
  end

  def seco?
    @modo == 'seco'
  end

  # Ids negativos para el modo seco: nunca chocan con uno real.
  def falso
    @falso -= 1
  end

  def trabajos_en_cola
    require 'sidekiq/api'
    Sidekiq::Queue.all.sum(&:size) + Sidekiq::ScheduledSet.new.size + Sidekiq::RetrySet.new.size
  rescue StandardError
    -1
  end

  # Trabajos en Sidekiq por clase y evento de Chatwoot. Nada más de los argumentos: llevan tokens y datos.
  EVENTO = /\A[a-z_]+(\.[a-z_]+)+\z/

  def trabajos_por_clase
    require 'sidekiq/api'
    cuenta = Hash.new(0)
    [*Sidekiq::Queue.all, Sidekiq::ScheduledSet.new, Sidekiq::RetrySet.new].each do |cola|
      cola.each do |trabajo|
        evento = Array(trabajo.display_args).find { |a| a.is_a?(String) && a.match?(EVENTO) }
        cuenta[evento ? "#{trabajo.display_class}(#{evento})" : trabajo.display_class] += 1
      end
    end
    cuenta
  rescue StandardError
    nil
  end

  def trabajos_nuevos(antes, despues)
    return 'desconocido' unless antes && despues

    nuevos = despues.filter_map { |clase, n| "#{clase}:#{n - antes[clase]}" if n > antes[clase] }.sort
    nuevos.empty? ? 'ninguno' : nuevos.join(',')
  end

  def secuencia
    ActiveRecord::Base.connection.select_value("SELECT last_value FROM conv_dpid_seq_#{@cuenta_id}").to_i
  end

  def instante(iso)
    Time.zone.parse(iso.to_s) || raise('fecha ilegible')
  end

  # ── Lectura y comprobación del archivo entero, antes de escribir nada ──────
  def leer
    filas = { 'cabecera' => [], 'contacto' => [], 'conversacion' => [], 'mensaje' => [] }
    fuente = @ruta_carga == '-' ? @entrada : File.open(@ruta_carga, encoding: 'UTF-8')
    fuente.each_line do |linea|
      next if linea.strip.empty?

      fila = JSON.parse(linea)
      lista = filas[fila['tipo']] or raise 'el preparado trae un tipo desconocido'
      lista << fila
    end
    filas
  ensure
    fuente.close if fuente.is_a?(File)
  end

  def comprobar_bandeja!
    bandeja = Inbox.find_by(id: @bandeja_id, account_id: @cuenta_id)
    raise 'la bandeja no existe en esa cuenta' unless bandeja
    raise 'la bandeja no es de canal API' unless bandeja.channel_type == 'Channel::Api'
    raise 'la bandeja tiene webhook_url: no se carga' if bandeja.channel.webhook_url.present?
    # B1: la del portal y ninguna otra. El número lo da quien opera; el nombre lo confirma.
    raise 'la bandeja no es «Conversaciones del portal»' unless bandeja.name == NOMBRE_BANDEJA

    bandeja
  end

  def usuario_de_la_cuenta?(id)
    AccountUser.exists?(account_id: @cuenta_id, user_id: id)
  end

  def comprobar!(filas)
    raise 'el preparado tiene que traer una cabecera' unless filas['cabecera'].size == 1

    cab = filas['cabecera'].first
    raise 'el preparado no es de la versión 1' unless cab['version'] == 1
    raise 'la cabecera no es de esta cuenta y esta bandeja' unless cab['cuenta'] == @cuenta_id && cab['bandeja'] == @bandeja_id
    raise 'la cabecera no trae tenant_id o corte' if cab['tenant_id'].to_s !~ UUID || cab['corte'].blank?

    { 'contactos' => 'contacto', 'conversaciones' => 'conversacion', 'mensajes' => 'mensaje' }.each do |clave, tipo|
      raise 'los conteos de la cabecera no coinciden con las líneas' unless cab[clave] == filas[tipo].size
    end
    raise 'AGENTE_SERVICIO no es un usuario de la cuenta' unless usuario_de_la_cuenta?(@servicio_id)

    clientes = filas['contacto'].map { |c| c['cliente'] }
    raise 'un cliente trae dos contactos' unless clientes.uniq.size == clientes.size
    raise 'un contacto no trae identificador' unless filas['contacto'].all? { |c| c['identificador'].to_s.match?(UUID) }

    clientes = clientes.to_set
    hilos = filas['conversacion'].map { |c| c['hilo'] }
    raise 'un hilo viene dos veces' unless hilos.uniq.size == hilos.size

    filas['conversacion'].each do |c|
      raise 'una conversación es de un cliente sin contacto' unless clientes.include?(c['cliente'])
      raise 'una conversación trae un estado desconocido' unless ESTADOS.include?(c['estado'])
      raise 'un hilo archivado tiene que ir resolved y con su nota' if c['archivado_at'] && (c['estado'] != 'resolved' || c['nota_archivo'].nil?)
      raise 'una nota de archivo sin hilo archivado' if c['archivado_at'].nil? && !c['nota_archivo'].nil?
    end
    hilos = hilos.to_set
    agentes = Set.new
    filas['mensaje'].each do |m|
      raise 'un mensaje es de un hilo que no está en el archivo' unless hilos.include?(m['hilo'])
      raise 'un mensaje trae un sentido desconocido' unless SENTIDOS.include?(m['sentido'])
      raise 'un mensaje no trae source_id dtd:<mensaje>' unless m['source_id'] == "dtd:#{m['mensaje']}"
      raise 'un entrante trae agente' if m['sentido'] == 'entrante' && !m['agente'].nil?

      agentes << Integer(m['agente']) if m['agente']
    end
    raise 'agente_desconocido' unless agentes.all? { |id| usuario_de_la_cuenta?(id) }

    cab
  end

  # ── Contactos: uno por cliente, sin teléfono ni correo ─────────────────────
  # { cliente => { contacto_id:, identificador: } }
  def cargar_contactos(contactos)
    ahora = Time.zone.now
    por_cliente = {}
    nuevos = []
    identificadores = contactos.map { |c| "#{PREFIJO_CONTACTO}#{c['identificador']}" }
    ya = Contact.where(account_id: @cuenta_id, identifier: identificadores).pluck(:identifier, :id).to_h
    contactos.each do |c|
      ident = "#{PREFIJO_CONTACTO}#{c['identificador']}"
      if ya.key?(ident)
        por_cliente[c['cliente']] = { contacto_id: ya[ident], identificador: c['identificador'] }
        @cuenta[:contactos_reusados] += 1
      else
        nuevos << { account_id: @cuenta_id, name: c['nombre'].presence || 'Cliente del portal', identifier: ident,
                    created_at: ahora, updated_at: ahora, '_cliente' => c['cliente'], '_ident' => c['identificador'] }
      end
    end
    nuevos.each_slice(LOTE) do |lote|
      datos = lote.map { |f| f.except('_cliente', '_ident') }
      filas = if seco?
                datos.map { |f| { 'id' => falso, 'identifier' => f[:identifier] } }
              else
                Contact.insert_all(datos, returning: %w[id identifier]).to_a
              end
      de_ident = lote.to_h { |f| [f[:identifier], f] }
      filas.each do |f|
        origen = de_ident.fetch(f['identifier'])
        por_cliente[origen['_cliente']] = { contacto_id: f['id'].to_i, identificador: origen['_ident'] }
      end
      @cuenta[:contactos_nuevos] += filas.size
      @cuenta[:contactos_omitidos] += lote.size - filas.size
    end
    por_cliente
  end

  # Un contact_inbox por contacto en la bandeja del portal. Si ya tiene uno (por ejemplo, lo creó la cola), se usa
  # ese, con su source_id. { contacto_id => { id:, source_id: } }
  def cargar_contact_inboxes(por_cliente)
    pares = por_cliente.values
    reales = pares.map { |p| p[:contacto_id] }.select(&:positive?)
    existentes = ContactInbox.where(inbox_id: @bandeja_id, contact_id: reales)
                             .pluck(:contact_id, :id, :source_id).to_h { |cid, id, sid| [cid, { id: id, source_id: sid }] }
    @cuenta[:contact_inboxes_existentes] += existentes.size
    ahora = Time.zone.now
    faltan = pares.reject { |p| existentes.key?(p[:contacto_id]) }
    faltan.each_slice(LOTE) do |lote|
      filas = lote.map do |p|
        # pubsub_token como lo genera ContactInbox (has_secure_token): sin él, cada mensaje nuevo al contacto
        # mandaría un token nulo a ActionCableBroadcastJob (revisión de idempotencia, 2026-11-08).
        { contact_id: p[:contacto_id], inbox_id: @bandeja_id, source_id: "#{PREFIJO_CONTACTO}#{p[:identificador]}",
          pubsub_token: SecureRandom.base58(24), created_at: ahora, updated_at: ahora }
      end
      creadas = if seco?
                  filas.map { |f| { 'id' => falso, 'contact_id' => f[:contact_id], 'source_id' => f[:source_id] } }
                else
                  ContactInbox.insert_all(filas, returning: %w[id contact_id source_id]).to_a
                end
      creadas.each { |f| existentes[f['contact_id'].to_i] = { id: f['id'].to_i, source_id: f['source_id'] } }
      @cuenta[:contact_inboxes_nuevos] += creadas.size
      @cuenta[:contact_inboxes_omitidos] += filas.size - creadas.size
    end
    existentes
  end

  # Conversaciones, una por hilo, en orden de creación para que los números sigan el tiempo.
  # { hilo => { id:, display_id:, contacto_id: } }
  def cargar_conversaciones(conversaciones, mensajes, por_cliente, ci_de)
    ya = {}
    Conversation.where(inbox_id: @bandeja_id).where("additional_attributes ? 'dtd_hilo'")
                .pluck(Arel.sql("additional_attributes->>'dtd_hilo'"), :id, :display_id, :contact_id, :status)
                .each { |hilo, id, did, cid, st| ya[hilo] = { id: id, display_id: did, contacto_id: cid, estado: st } }
    cambiar = Hash.new { |h, k| h[k] = [] }
    # La última actividad de cada hilo: su último mensaje o su nota de archivo.
    ultima = Hash.new { |h, k| h[k] = nil }
    mensajes.each { |m| ultima[m['hilo']] = [ultima[m['hilo']], instante(m['created_at'])].compact.max }
    ahora = Time.zone.now
    nuevas = []
    conversaciones.sort_by { |c| [instante(c['creada_at']), c['hilo']] }.each do |c|
      if ya.key?(c['hilo'])
        @cuenta[:conversaciones_existentes] += 1
        # Ya cargada con otro estado: se actualiza (sin callbacks). La carga va antes del encendido, cuando el estado
        # lo pone el Studio; desde el encendido lo decide Chatwoot (E10-D39) y la carga ya no corre. Abortar dejaría
        # trabada la repetición por cualquier cambio de estado en el Studio.
        cambiar[c['estado']] << ya[c['hilo']][:id] if (Conversation.statuses.key(ya[c['hilo']][:estado]) || ya[c['hilo']][:estado].to_s) != c['estado']
        next
      end
      contacto = por_cliente.fetch(c['cliente'])[:contacto_id]
      creada = instante(c['creada_at'])
      nota = c['nota_archivo'] && instante(c['nota_archivo']['created_at'])
      fin = [creada, ultima[c['hilo']], nota].compact.max
      # agent_last_seen_at = ahora: sin eso, cada entrante viejo cuenta como no leído en la bandeja.
      nuevas << { account_id: @cuenta_id, inbox_id: @bandeja_id, contact_id: contacto, contact_inbox_id: ci_de.fetch(contacto)[:id],
                  status: Conversation.statuses.fetch(c['estado']), created_at: creada, updated_at: fin,
                  last_activity_at: fin, agent_last_seen_at: ahora,
                  additional_attributes: { 'dtd_hilo' => c['hilo'] } }
    end
    nuevas.each_slice(LOTE) do |lote|
      contacto_de_hilo = lote.to_h { |f| [f[:additional_attributes]['dtd_hilo'], f[:contact_id]] }
      filas = if seco?
                lote.map { |f| { 'id' => falso, 'display_id' => falso, 'hilo' => f[:additional_attributes]['dtd_hilo'] } }
              else
                Conversation.insert_all(lote, returning: Arel.sql("id, display_id, additional_attributes->>'dtd_hilo' AS hilo")).to_a
              end
      filas.each do |f|
        ya[f['hilo']] = { id: f['id'].to_i, display_id: f['display_id'].to_i, contacto_id: contacto_de_hilo[f['hilo']] }
      end
      @cuenta[:conversaciones_nuevas] += filas.size
      @cuenta[:conversaciones_omitidas] += lote.size - filas.size
    end
    cambiar.each do |estado, ids|
      Conversation.where(id: ids).update_all(status: Conversation.statuses.fetch(estado)) unless seco?
      @cuenta[:conversaciones_estado_actualizado] += ids.size
    end
    ya
  end

  # Mensajes y notas de archivo. Devuelve { mensaje de Studio => messages.id } (las notas no van en los vínculos).
  def cargar_mensajes(mensajes, conversaciones, conv_de)
    fuentes = mensajes.map { |m| m['source_id'] } + conversaciones.filter_map { |c| c.dig('nota_archivo', 'source_id') }
    ya = {}
    en_conv = {}
    fuentes.each_slice(5_000) do |lote|
      Message.where(inbox_id: @bandeja_id, source_id: lote).pluck(:source_id, :id, :conversation_id)
             .each { |sid, id, cid| ya[sid] = id; en_conv[sid] = cid }
    end
    # Un mensaje que ya existe en otra conversación no se vincula: algo no cuadra entre Studio y Chatwoot.
    otra = mensajes.any? { |m| en_conv.key?(m['source_id']) && en_conv[m['source_id']] != conv_de.fetch(m['hilo'])[:id] } ||
           conversaciones.any? { |c| (s = c.dig('nota_archivo', 'source_id')) && en_conv.key?(s) && en_conv[s] != conv_de.fetch(c['hilo'])[:id] }
    raise 'un mensaje ya existe en otra conversación' if otra
    procesado = Message.column_names.include?('processed_message_content')
    filas = []
    de_studio = {}
    # El orden del archivo es el de Studio (sent_at y después id): las filas se insertan en ese orden, así que en
    # Chatwoot el orden por created_at e id es el mismo (C-12).
    mensajes.each do |m|
      if ya.key?(m['source_id'])
        @cuenta[:mensajes_existentes] += 1
        de_studio[m['mensaje']] = ya[m['source_id']]
        next
      end
      conv = conv_de.fetch(m['hilo'])
      entrante = m['sentido'] == 'entrante'
      remitente = entrante ? conv[:contacto_id] : (m['agente'] ? Integer(m['agente']) : @servicio_id)
      @cuenta[:firmados_por_servicio] += 1 if !entrante && m['agente'].nil?
      cuando = instante(m['created_at'])
      fila = { account_id: @cuenta_id, inbox_id: @bandeja_id, conversation_id: conv[:id],
               message_type: entrante ? ENTRANTE : SALIENTE, content: m['texto'], private: false,
               status: Message.statuses[:delivered], source_id: m['source_id'],
               sender_type: entrante ? 'Contact' : 'User', sender_id: remitente,
               content_attributes: {}, created_at: cuando, updated_at: cuando }
      fila[:processed_message_content] = m['texto']&.truncate(150_000) if procesado
      filas << [m['mensaje'], fila]
    end
    conversaciones.each do |c|
      nota = c['nota_archivo'] or next
      if ya.key?(nota['source_id'])
        @cuenta[:notas_existentes] += 1
        next
      end
      cuando = instante(nota['created_at'])
      fila = { account_id: @cuenta_id, inbox_id: @bandeja_id, conversation_id: conv_de.fetch(c['hilo'])[:id],
               message_type: ACTIVIDAD, content: nota['texto'], private: false, status: Message.statuses[:sent],
               source_id: nota['source_id'], sender_type: nil, sender_id: nil, content_attributes: {},
               created_at: cuando, updated_at: cuando }
      fila[:processed_message_content] = nota['texto']&.truncate(150_000) if procesado
      filas << [nil, fila]
    end
    filas.each_slice(LOTE) do |lote|
      ids = if seco?
              lote.map { falso }
            else
              Message.insert_all(lote.map(&:last), returning: %w[id source_id]).to_a.to_h { |f| [f['source_id'], f['id'].to_i] }
                     .then { |por_fuente| lote.map { |_, f| por_fuente[f[:source_id]] } }
            end
      lote.zip(ids).each do |(mensaje, _fila), id|
        if id.nil?
          @cuenta[:mensajes_omitidos] += 1
        elsif mensaje
          de_studio[mensaje] = id
          @cuenta[:mensajes_nuevos] += 1
        else
          @cuenta[:notas_nuevas] += 1
        end
      end
    end
    de_studio
  end

  def filas_en_bandeja
    "conversaciones:#{Conversation.where(inbox_id: @bandeja_id).count}," \
      "mensajes:#{Message.where(inbox_id: @bandeja_id).count}," \
      "contact_inboxes:#{ContactInbox.where(inbox_id: @bandeja_id).count}"
  end

  # vinculos.ndjson: solo ids. Va a un archivo temporal y se renombra al final, para que un archivo a medias nunca
  # parezca completo. Los permisos son los del umask (puede quedar 0644), y la prueba lo lee desde fuera del
  # contenedor. Es aceptable solo porque lleva ids y no datos personales, y porque la carpeta es 0700 (/dev/shm/…,
  # §10.5.10). El preparado, que sí lleva nombres y textos, lo crea E10 con 0600 y no pasa por este umask.
  def escribir_vinculos(cab, filas, por_cliente, ci_de, conv_de, de_studio)
    lineas = []
    lineas << { tipo: 'cabecera', version: 1, tenant_id: cab['tenant_id'], cuenta: cab['cuenta'], bandeja: cab['bandeja'],
                corte: cab['corte'], contactos: filas['contacto'].size, conversaciones: filas['conversacion'].size,
                mensajes: filas['mensaje'].size }
    filas['contacto'].each do |c|
      p = por_cliente.fetch(c['cliente'])
      lineas << { tipo: 'contacto', cliente: c['cliente'], identificador: c['identificador'], contacto_id: p[:contacto_id],
                  source_id: ci_de.fetch(p[:contacto_id])[:source_id] }
    end
    filas['conversacion'].each do |c|
      lineas << { tipo: 'conversacion', hilo: c['hilo'], conversacion_id: conv_de.fetch(c['hilo'])[:display_id] }
    end
    filas['mensaje'].each { |m| lineas << { tipo: 'mensaje', mensaje: m['mensaje'], mensaje_id: de_studio.fetch(m['mensaje']) } }
    texto = lineas.map { |l| JSON.generate(l) }.join("\n") + "\n"
    if @salida_vinculos
      lineas.each { |l| @salida_vinculos.puts "VINCULO #{JSON.generate(l)}" }
    else
      tmp = "#{@ruta_vinculos}.parcial"
      File.write(tmp, texto)
      File.rename(tmp, @ruta_vinculos)
    end
    hecho('vinculos', lineas.size)
  end

  def cargar
    comprobar_bandeja!
    filas = leer
    cab = comprobar!(filas)
    hecho('leidas', "contactos:#{filas['contacto'].size},conversaciones:#{filas['conversacion'].size},mensajes:#{filas['mensaje'].size}")
    hecho('antes', filas_en_bandeja)
    cola_antes = trabajos_en_cola
    clases_antes = trabajos_por_clase
    secuencia_antes = secuencia
    resultado = nil
    ActiveRecord::Base.transaction do
      # Una carga a la vez: el candado se suelta solo al terminar la transacción.
      libre = ActiveRecord::Base.connection.select_value("SELECT pg_try_advisory_xact_lock(#{CANDADO})")
      raise 'otra carga del portal en curso' unless libre == true || libre == 't'

      por_cliente = cargar_contactos(filas['contacto'])
      ci_de = cargar_contact_inboxes(por_cliente)
      conv_de = cargar_conversaciones(filas['conversacion'], filas['mensaje'], por_cliente, ci_de)
      de_studio = cargar_mensajes(filas['mensaje'], filas['conversacion'], conv_de)
      resultado = [por_cliente, ci_de, conv_de, de_studio]
      raise ActiveRecord::Rollback if seco? # por si acaso: en seco no se escribió nada
    end
    @cuenta.sort.each { |k, v| hecho(k, v) }
    hecho('despues', filas_en_bandeja)
    hecho('secuencia', "#{secuencia_antes}->#{secuencia}")
    hecho('cola', "#{cola_antes}->#{trabajos_en_cola}")
    hecho('trabajos_nuevos', trabajos_nuevos(clases_antes, trabajos_por_clase))
    escribir_vinculos(cab, filas, *resultado) unless seco?
    hecho('modo', @modo)
    hecho('carga', 'ok')
  end
end

# Como biblioteca (la sonda y el escenario de la prueba) no corre. Como script, sin MODO sale con error.
unless defined?(CARGA_PORTAL_COMO_BIBLIOTECA)
  if ENV['MODO'].present?
    exit(CargaPortal.principal(ENV))
  else
    puts 'HECHO carga=error'
    puts 'HECHO error=falta MODO'
    exit 2
  end
end
