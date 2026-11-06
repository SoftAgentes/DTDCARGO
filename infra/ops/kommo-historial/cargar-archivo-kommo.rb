# frozen_string_literal: true

# infra/ops/kommo-historial/cargar-archivo-kommo.rb — SDD-0590 paso 5.5: carga el historial de Kommo en la
# bandeja «Archivo Kommo» de Chatwoot SIN EFECTOS. Corre con `rails runner` dentro del contenedor de Chatwoot.
# El archivo de carga entra por la entrada estándar, para que los datos no se copien al disco del contenedor:
#
#   MODO=crear-bandeja CUENTA=1 NOMBRE='Archivo Kommo' bundle exec rails runner cargar-archivo-kommo.rb
#   MODO=seco|cargar   CUENTA=1 BANDEJA=<id> CARGA=-  bundle exec rails runner cargar-archivo-kommo.rb < carga.ndjson
#
# Sin efectos quiere decir:
#   · escribe con `insert_all`, que no corre callbacks de ActiveRecord: ni webhooks, ni notificaciones, ni
#     SendReplyJob, ni eventos de reportes. Nada sale a un cliente ni a Studio;
#   · la bandeja tiene que ser de canal API y sin `webhook_url`; si no, no carga nada;
#   · no toca conversaciones ni mensajes que ya existían: salta lo cargado por `source_id` (`kommo:<id>`)
#     y por `kommo_talk_id`, así que correrlo dos veces no duplica nada;
#   · reusa el contacto que ya existe en la cuenta con el mismo teléfono o correo, para no duplicar personas;
#   · MODO=seco no escribe nada, ni siquiera consume la secuencia de números de conversación: solo cuenta.
#
# Salida: líneas `HECHO clave=valor` con conteos. Nunca nombres, teléfonos, correos ni textos.
# Los adjuntos quedan pendientes (SDD-0590 §10.6): la extracción los cifra y el servidor no los puede leer.

require 'json'
require 'set'

class CargaArchivoKommo
  LOTE = 200
  SIN_CONTACTO = 'kommo:sin-contacto'
  ENTRANTE = 0 # Message.message_types[:incoming]
  SALIENTE = 1 # Message.message_types[:outgoing]

  # Punto de entrada: el script lo llama con ENV, $stdin y $stdout; la prueba de mutantes, con un Hash y archivos.
  # Devuelve el código de salida.
  def self.principal(env, entrada: $stdin, salida: $stdout)
    modo = env.fetch('MODO')
    cargador = new(cuenta_id: env.fetch('CUENTA'), bandeja_id: env['BANDEJA'].presence, modo: modo,
                   entrada: entrada, salida: salida)
    if modo == 'crear-bandeja'
      cargador.crear_bandeja(env.fetch('NOMBRE', 'Archivo Kommo'))
    else
      cargador.cargar(env.fetch('CARGA'))
    end
    0
  rescue StandardError => e
    # Solo los mensajes propios; de los demás, la clase: los errores de la base pueden traer valores de la fila.
    salida.puts 'HECHO carga=error'
    salida.puts "HECHO error=#{e.instance_of?(RuntimeError) ? e.message : e.class.name}"
    1
  end

  def initialize(cuenta_id:, bandeja_id: nil, modo: 'seco', entrada: $stdin, salida: $stdout)
    @cuenta_id = Integer(cuenta_id)
    @bandeja_id = bandeja_id && Integer(bandeja_id)
    @modo = modo
    @entrada = entrada
    @salida = salida
    @cuenta = Hash.new(0)
    @falso = 0
    @contacto_de_conv = {}
  end

  def hecho(clave, valor)
    @salida.puts "HECHO #{clave}=#{valor}"
  end

  def seco?
    @modo == 'seco'
  end

  # Ids negativos para el modo seco: nunca chocan con uno real.
  def falso
    @falso -= 1
  end

  # Trabajos esperando en Sidekiq. En la prueba local no hay Sidekiq corriendo y el número es exacto; en el
  # servidor, con Sidekiq vivo, solo orienta.
  def trabajos_en_cola
    require 'sidekiq/api'
    Sidekiq::Queue.all.sum(&:size) + Sidekiq::ScheduledSet.new.size + Sidekiq::RetrySet.new.size
  rescue StandardError
    -1
  end

  def secuencia
    ActiveRecord::Base.connection.select_value("SELECT last_value FROM conv_dpid_seq_#{@cuenta_id}").to_i
  end

  def leer(ruta)
    personas = []
    conversaciones = []
    mensajes = []
    fuente = ruta == '-' ? @entrada : File.open(ruta, encoding: 'UTF-8')
    fuente.each_line do |linea|
      next if linea.strip.empty?

      fila = JSON.parse(linea)
      case fila['tipo']
      when 'persona' then personas << fila
      when 'conversacion' then conversaciones << fila
      when 'mensaje' then mensajes << fila
      end
    end
    [personas, conversaciones, mensajes]
  ensure
    fuente.close if fuente.is_a?(File)
  end

  def comprobar_bandeja!
    bandeja = Inbox.find_by(id: @bandeja_id, account_id: @cuenta_id)
    raise 'la bandeja no existe en esa cuenta' unless bandeja
    raise 'la bandeja no es de canal API' unless bandeja.channel_type == 'Channel::Api'
    raise 'la bandeja tiene webhook_url: no se carga' if bandeja.channel.webhook_url.present?

    bandeja
  end

  def instante(segundos)
    segundos ? Time.zone.at(segundos.to_i) : Time.zone.now
  end

  # Personas: reusa por teléfono, por correo o por una carga anterior; si no, crea. { grupo => contact_id }.
  def cargar_personas(personas)
    ahora = Time.zone.now
    por_grupo = {}
    nuevas = []
    personas.each do |p|
      telefono = p['telefono'].presence
      correo = p['correo'].presence&.downcase
      existente = nil
      existente = Contact.where(account_id: @cuenta_id, phone_number: telefono).order(:id).pick(:id) if telefono
      existente ||= Contact.where(account_id: @cuenta_id).where('LOWER(email) = ?', correo).order(:id).pick(:id) if correo
      existente ||= Contact.where(account_id: @cuenta_id, identifier: "kommo:#{p['grupo']}").pick(:id)
      if existente
        por_grupo[p['grupo']] = existente
        @cuenta[:personas_reusadas] += 1
      else
        nuevas << { account_id: @cuenta_id, name: p['nombre'].presence || 'Contacto de Kommo',
                    phone_number: telefono, email: correo, identifier: "kommo:#{p['grupo']}",
                    additional_attributes: { 'kommo_contact_ids' => p['kommo_contact_ids'], 'client_id' => p['client_id'] }.compact,
                    created_at: ahora, updated_at: ahora }
      end
    end
    nuevas.each_slice(LOTE) do |lote|
      filas = if seco?
                lote.map { |f| { 'id' => falso, 'identifier' => f[:identifier] } }
              else
                Contact.insert_all(lote, returning: %w[id identifier]).to_a
              end
      filas.each { |f| por_grupo[f['identifier'].delete_prefix('kommo:').to_i] = f['id'].to_i }
      @cuenta[:personas_nuevas] += filas.size
      @cuenta[:personas_omitidas] += lote.size - filas.size
    end
    por_grupo
  end

  def contacto_sin_contacto
    id = Contact.where(account_id: @cuenta_id, identifier: SIN_CONTACTO).pick(:id)
    return id if id

    @cuenta[:personas_nuevas] += 1
    return falso if seco?

    ahora = Time.zone.now
    Contact.insert_all([{ account_id: @cuenta_id, name: 'Sin contacto en Kommo', identifier: SIN_CONTACTO,
                          created_at: ahora, updated_at: ahora }], returning: %w[id]).first['id'].to_i
  end

  # Un contact_inbox por contacto en la bandeja Archivo. { contact_id => contact_inbox_id }.
  def cargar_contact_inboxes(contact_ids)
    reales = contact_ids.select(&:positive?)
    existentes = ContactInbox.where(inbox_id: @bandeja_id, contact_id: reales).pluck(:contact_id, :id).to_h
    faltan = contact_ids.uniq - existentes.keys
    ahora = Time.zone.now
    faltan.each_slice(LOTE) do |lote|
      filas = lote.map { |cid| { contact_id: cid, inbox_id: @bandeja_id, source_id: "kommo:#{cid}", created_at: ahora, updated_at: ahora } }
      creadas = if seco?
                  filas.map { |f| { 'id' => falso, 'contact_id' => f[:contact_id] } }
                else
                  ContactInbox.insert_all(filas, returning: %w[id contact_id]).to_a
                end
      creadas.each { |f| existentes[f['contact_id'].to_i] = f['id'].to_i }
      @cuenta[:contact_inboxes_nuevos] += creadas.size
      @cuenta[:contact_inboxes_omitidos] += filas.size - creadas.size
    end
    existentes
  end

  # Conversaciones cerradas, una por conversación de Kommo, en orden de creación para que los números
  # sigan el tiempo. { kommo_talk_id => conversation_id }.
  def cargar_conversaciones(conversaciones, contacto_de, ci_de, sin_contacto)
    ya = {}
    Conversation.where(inbox_id: @bandeja_id).where("additional_attributes ? 'kommo_talk_id'")
                .pluck(Arel.sql("(additional_attributes->>'kommo_talk_id')::bigint"), :id, :contact_id)
                .each do |tid, id, cid|
      ya[tid.to_i] = id
      @contacto_de_conv[id] = cid
    end
    ahora = Time.zone.now
    nuevas = []
    conversaciones.sort_by { |c| [c['creada'].to_i, c['kommo_talk_id'].to_i] }.each do |c|
      tid = Integer(c['kommo_talk_id'])
      if ya.key?(tid)
        @cuenta[:conversaciones_existentes] += 1
        next
      end
      contacto = c['grupo'] ? contacto_de[c['grupo']] : nil
      if contacto.nil?
        contacto = sin_contacto
        @cuenta[:conversaciones_sin_contacto] += 1
      end
      ultima = instante(c['actualizada'] || c['creada'])
      # agent_last_seen_at = ahora: sin eso, cada entrante viejo cuenta como no leído en la bandeja.
      nuevas << { account_id: @cuenta_id, inbox_id: @bandeja_id, contact_id: contacto, contact_inbox_id: ci_de[contacto],
                  status: Conversation.statuses[:resolved], created_at: instante(c['creada']), updated_at: ultima,
                  last_activity_at: ultima, agent_last_seen_at: ahora,
                  additional_attributes: { 'kommo_talk_id' => tid, 'kommo_origen' => c['origen'] }.compact }
    end
    nuevas.each_slice(LOTE) do |lote|
      contacto_por_tid = lote.to_h { |f| [f[:additional_attributes]['kommo_talk_id'], f[:contact_id]] }
      filas = if seco?
                lote.map { |f| { 'id' => falso, 'tid' => f[:additional_attributes]['kommo_talk_id'] } }
              else
                Conversation.insert_all(lote, returning: Arel.sql("id, (additional_attributes->>'kommo_talk_id')::bigint AS tid")).to_a
              end
      filas.each do |f|
        tid = f['tid'].to_i
        ya[tid] = f['id'].to_i
        @contacto_de_conv[ya[tid]] = contacto_por_tid[tid]
      end
      @cuenta[:conversaciones_nuevas] += filas.size
      @cuenta[:conversaciones_omitidas] += lote.size - filas.size
    end
    ya
  end

  def cargar_mensajes(mensajes, conv_de)
    ya = Set.new
    mensajes.map { |m| m['source_id'] }.each_slice(5_000) do |lote|
      ya.merge(Message.where(inbox_id: @bandeja_id, source_id: lote).pluck(:source_id))
    end
    procesado = Message.column_names.include?('processed_message_content')
    filas = []
    orden = mensajes.sort_by { |m| [m['kommo_talk_id'].to_i, m['creado'].to_i, m['source_id'].to_s] }
    orden.each do |m|
      if ya.include?(m['source_id'])
        @cuenta[:mensajes_existentes] += 1
        next
      end
      conv = conv_de[m['kommo_talk_id'].to_i]
      unless conv
        @cuenta[:mensajes_sin_conversacion] += 1
        next
      end
      ya << m['source_id']
      entrante = m['entrante'] == true
      cuando = instante(m['creado'])
      @cuenta[:adjuntos_pendientes] += 1 if m['adjunto'].present?
      @cuenta[:mensajes_sin_texto] += 1 if m['texto'].blank?
      fila = { account_id: @cuenta_id, inbox_id: @bandeja_id, conversation_id: conv,
               message_type: entrante ? ENTRANTE : SALIENTE, content: m['texto'], private: false,
               status: Message.statuses[:delivered], source_id: m['source_id'],
               sender_type: entrante ? 'Contact' : nil, sender_id: entrante ? @contacto_de_conv[conv] : nil,
               content_attributes: entrante ? {} : { 'kommo_autor' => m['autor'] },
               created_at: cuando, updated_at: cuando }
      fila[:processed_message_content] = m['texto']&.truncate(150_000) if procesado
      filas << fila
    end
    filas.each_slice(LOTE) do |lote|
      n = seco? ? lote.size : Message.insert_all(lote, returning: %w[id]).length
      @cuenta[:mensajes_nuevos] += n
      @cuenta[:mensajes_omitidos] += lote.size - n
    end
  end

  def filas_en_bandeja
    "conversaciones:#{Conversation.where(inbox_id: @bandeja_id).count}," \
      "mensajes:#{Message.where(inbox_id: @bandeja_id).count}," \
      "contact_inboxes:#{ContactInbox.where(inbox_id: @bandeja_id).count}"
  end

  def cargar(ruta)
    raise 'MODO tiene que ser seco o cargar' unless %w[seco cargar].include?(@modo)

    comprobar_bandeja!
    personas, conversaciones, mensajes = leer(ruta)
    hecho('leidas', "personas:#{personas.size},conversaciones:#{conversaciones.size},mensajes:#{mensajes.size}")
    hecho('antes', filas_en_bandeja)
    cola_antes = trabajos_en_cola
    secuencia_antes = secuencia
    ActiveRecord::Base.transaction do
      contacto_de = cargar_personas(personas)
      sin_grupo = conversaciones.any? { |c| c['grupo'].nil? || !contacto_de.key?(c['grupo']) }
      sin_contacto = sin_grupo ? contacto_sin_contacto : nil
      ci_de = cargar_contact_inboxes((contacto_de.values + [sin_contacto].compact).uniq)
      conv_de = cargar_conversaciones(conversaciones, contacto_de, ci_de, sin_contacto)
      cargar_mensajes(mensajes, conv_de)
      raise ActiveRecord::Rollback if seco? # por si acaso: en seco no se escribió nada
    end
    @cuenta.sort.each { |k, v| hecho(k, v) }
    hecho('despues', filas_en_bandeja)
    hecho('secuencia', "#{secuencia_antes}->#{secuencia}")
    hecho('cola', "#{cola_antes}->#{trabajos_en_cola}")
    hecho('modo', @modo)
    hecho('carga', 'ok')
  end

  # La bandeja «Archivo Kommo»: canal API sin webhook_url, sin asignación automática, sin saludo ni encuesta.
  # Si ya existe una bandeja API con ese nombre en la cuenta, la devuelve sin tocarla.
  def crear_bandeja(nombre)
    raise 'falta NOMBRE' if nombre.blank?

    existente = Inbox.where(account_id: @cuenta_id, name: nombre, channel_type: 'Channel::Api').order(:id).first
    cola_antes = trabajos_en_cola
    if existente
      hecho('bandeja_existia', 'si')
      bandeja = existente
    else
      cuenta = Account.find(@cuenta_id)
      bandeja = nil
      ActiveRecord::Base.transaction do
        canal = Channel::Api.create!(account: cuenta)
        bandeja = Inbox.create!(account: cuenta, channel: canal, name: nombre, enable_auto_assignment: false,
                                greeting_enabled: false, csat_survey_enabled: false)
      end
      hecho('bandeja_existia', 'no')
    end
    hecho('bandeja', bandeja.id)
    hecho('webhook_url', bandeja.channel.webhook_url.present? ? 'si' : 'no')
    hecho('miembros', InboxMember.where(inbox_id: bandeja.id).count)
    hecho('cola', "#{cola_antes}->#{trabajos_en_cola}")
    hecho('carga', 'ok')
  end
end

exit(CargaArchivoKommo.principal(ENV)) if ENV['MODO']
