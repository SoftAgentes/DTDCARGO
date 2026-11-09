# frozen_string_literal: true

# infra/ops/portal-historial/deshacer-carga.rb — SDD-0586 10.7, PR 2c: la vuelta atrás DIRIGIDA de la carga P4 en
# Chatwoot (sub-paso 4.6b del runbook). Hermano de cargar-portal.rb: corre con `rails runner` dentro del contenedor
# de Chatwoot, lo lanza deshacer.sh. Solo sirve entre la carga (puerta 4) y el encendido (puerta 5): antes del
# encendido, todo lo que hay en la bandeja del portal es de la carga.
#
#   MODO=seco   TENANT=<uuid> CUENTA=<id> BANDEJA=<id> CONSERVADOS=/dev/shm/portal-historial/contactos-conservados.ndjson
#   MODO=borrar TENANT=<uuid> CUENTA=<id> BANDEJA=<id> CONFIRMAR=no|si   < contactos-conservados.ndjson
#
# El orden (revisión del DG, N5: un aborto en Chatwoot no deja a Studio desarmado):
#   1. MODO=seco cuenta lo que se borraría y escribe contactos-conservados.ndjson: los contactos dtd-portal: que
#      tienen otra bandeja (o una conversación fuera de esta) y por eso NO se borran. No borra nada;
#   2. MODO=borrar recibe el archivo por la entrada estándar, recalcula los conservados dentro de su transacción y
#      ABORTA si no son los del archivo. Con CONFIRMAR=no hace todo y termina en ROLLBACK (el ensayo del DG); con
#      CONFIRMAR=si confirma. En producción lo corre Sam. El archivo queda para el paso 3;
#   3. el desarme de Studio (supabase/cargas/portal-historial-deshacer/) lee el archivo y les conserva el
#      chatwoot_contact_id. Después, limpiar.sh borra /dev/shm/portal-historial, con el archivo.
#
# Qué borra (MODO=borrar), con delete_all, sin callbacks:
#   · los mensajes, las conversaciones y los contact_inboxes de la bandeja del portal;
#   · los contactos dtd-portal: de la bandeja que no se conservan.
# Aborta sin borrar nada si:
#   · la bandeja no es «Conversaciones del portal» de la cuenta (canal API, sin webhook_url), como el cargador;
#   · hay algo ajeno en la bandeja: un mensaje con source_id nulo o que no es dtd:%, una conversación sin dtd_hilo,
#     un contact_inbox cuyo source_id no es dtd-portal:%, una conversación asignada o en snoozed, un contacto con
#     teléfono o correo (el cargador nunca los pone), o actividad que la carga no crea (adjuntos, menciones,
#     participantes, eventos de reportes, encuestas, notificaciones, etiquetas, notas y adjuntos de contacto);
#   · un contacto de la bandeja no es dtd-portal:<uuid>;
#   · (borrar) el archivo de conservados no es de este tenant, cuenta y bandeja, o la lista cambió.
# El flag chatwoot_portal, la cola y el espejo viven en Studio: los mira deshacer.sh antes de llamar a este.
#
# Toma el candado de la carga (no corre a la vez que una carga) y baja el detalle del log de Postgres como el
# cargador (SDD-0586 4.10). El display_id no se rebobina: quedan huecos, y una carga nueva sigue después.
# HECHO lleva solo conteos: nunca nombres ni textos.

require 'json'
require 'set'

# Los errores propios: solo de estos se imprime el mensaje (revisión del DG, N7).
class DeshacerError < StandardError; end

class DeshacerPortal
  NOMBRE_BANDEJA = 'Conversaciones del portal'
  RUTA_CONSERVADOS = '/dev/shm/portal-historial/contactos-conservados.ndjson'
  CANDADO = 58_610_510 # el de cargar-portal.rb: una carga o un deshacer a la vez
  PREFIJO_CONTACTO = 'dtd-portal:'
  UUID = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/
  DETALLE_DEL_LOG = { 'log_min_error_statement' => 'panic', 'log_error_verbosity' => 'terse' }.freeze
  # Lo que la carga no crea, por tabla: [tabla, columna, de qué ids] (N1 de la revisión del DG).
  ACTIVIDAD = [
    %w[attachments message_id mensajes],
    %w[mentions conversation_id conversaciones],
    %w[conversation_participants conversation_id conversaciones],
    %w[reporting_events conversation_id conversaciones],
    %w[csat_survey_responses conversation_id conversaciones],
    %w[notes contact_id contactos],
  ].freeze
  # Polimórficas: [tabla, columna del tipo, tipo, columna del id, de qué ids].
  ACTIVIDAD_POLIMORFICA = [
    %w[notifications primary_actor_type Conversation primary_actor_id conversaciones],
    %w[taggings taggable_type Conversation taggable_id conversaciones],
    %w[taggings taggable_type Contact taggable_id contactos],
    %w[active_storage_attachments record_type Contact record_id contactos],
  ].freeze

  def self.principal(env, entrada: $stdin, salida: $stdout)
    log_sql = ActiveRecord::Base.logger
    ActiveRecord::Base.logger = nil
    new(env: env, entrada: entrada, salida: salida).correr
    0
  rescue StandardError => e
    salida.puts 'HECHO deshacer=error'
    salida.puts "HECHO error=#{e.is_a?(DeshacerError) ? e.message : e.class.name}"
    1
  ensure
    ActiveRecord::Base.logger = log_sql
  end

  def initialize(env:, entrada:, salida:)
    @modo = env.fetch('MODO')
    raise DeshacerError, 'MODO tiene que ser seco o borrar' unless %w[seco borrar].include?(@modo)

    @tenant = env.fetch('TENANT').to_s
    raise DeshacerError, 'TENANT tiene que ser un uuid' unless @tenant.match?(UUID)

    @cuenta_id = Integer(env.fetch('CUENTA'), 10)
    @bandeja_id = Integer(env.fetch('BANDEJA'), 10)
    if @modo == 'borrar'
      @confirmar = env['CONFIRMAR']
      raise DeshacerError, 'CONFIRMAR tiene que ser si o no' unless %w[si no].include?(@confirmar)
    else
      @conservados = env['CONSERVADOS']
      raise DeshacerError, "CONSERVADOS tiene que ser #{RUTA_CONSERVADOS} o -" unless [RUTA_CONSERVADOS, '-'].include?(@conservados)
      raise DeshacerError, 'falta la carpeta de CONSERVADOS' unless @conservados == '-' || File.directory?(File.dirname(RUTA_CONSERVADOS))
    end
    @entrada = entrada
    @salida = salida
  end

  def hecho(clave, valor)
    @salida.puts "HECHO #{clave}=#{valor}"
  end

  def bajar_detalle_del_log!
    conexion = ActiveRecord::Base.connection
    DETALLE_DEL_LOG.each do |parametro, valor|
      conexion.execute("SET LOCAL #{parametro} = '#{valor}'")
      raise DeshacerError, 'no_se_puede_bajar_el_detalle_del_log' unless conexion.select_value("SHOW #{parametro}") == valor
    end
  rescue ActiveRecord::StatementInvalid
    raise DeshacerError, 'no_se_puede_bajar_el_detalle_del_log'
  end

  def comprobar_bandeja!
    bandeja = Inbox.find_by(id: @bandeja_id, account_id: @cuenta_id)
    raise DeshacerError, 'la bandeja no existe en esa cuenta' unless bandeja
    raise DeshacerError, 'la bandeja no es de canal API' unless bandeja.channel_type == 'Channel::Api'
    raise DeshacerError, 'la bandeja tiene webhook_url' if bandeja.channel.webhook_url.present?
    raise DeshacerError, 'la bandeja no es «Conversaciones del portal»' unless bandeja.name == NOMBRE_BANDEJA
  end

  def mensajes = Message.where(inbox_id: @bandeja_id)
  def conversaciones = Conversation.where(inbox_id: @bandeja_id)
  def contact_inboxes = ContactInbox.where(inbox_id: @bandeja_id)

  def contar_bandeja
    "conversaciones:#{conversaciones.count},mensajes:#{mensajes.count},contact_inboxes:#{contact_inboxes.count}"
  end

  # Lo ajeno: lo que la carga no crea. Antes del encendido no debería haber nada; si hay, aborta con los conteos.
  def comprobar_ajeno!
    ids_conv = conversaciones.pluck(:id)
    ids_msg = mensajes.pluck(:id)
    ids_contactos = contact_inboxes.distinct.pluck(:contact_id)
    ajeno = {
      'mensajes' => mensajes.where("source_id IS NULL OR source_id NOT LIKE 'dtd:%'").count,
      'conversaciones_sin_dtd_hilo' => conversaciones.where("NOT (coalesce(additional_attributes, '{}'::jsonb) ? 'dtd_hilo')").count,
      'contact_inboxes' => contact_inboxes.where("source_id NOT LIKE 'dtd-portal:%'").count,
      'asignadas' => conversaciones.where.not(assignee_id: nil).count,
      'snoozed' => conversaciones.where(status: Conversation.statuses.fetch('snoozed')).count
    }
    # El cargador nunca pone teléfono ni correo (C-10): si un contacto de la bandeja los tiene, alguien lo tocó.
    ajeno['contactos_con_datos'] = Contact.where(id: ids_contactos).where('phone_number IS NOT NULL OR email IS NOT NULL').count
    conexion = ActiveRecord::Base.connection
    ids_de = { 'mensajes' => ids_msg, 'conversaciones' => ids_conv, 'contactos' => ids_contactos }
    actividad = ACTIVIDAD.sum do |tabla, columna, de|
      next 0 unless conexion.table_exists?(tabla)

      ids = ids_de.fetch(de)
      ids.empty? ? 0 : conexion.select_value("SELECT count(*) FROM #{tabla} WHERE #{columna} = ANY(ARRAY[#{ids.join(',')}]::bigint[])").to_i
    end
    actividad += ACTIVIDAD_POLIMORFICA.sum do |tabla, col_tipo, tipo, col_id, de|
      next 0 unless conexion.table_exists?(tabla)

      ids = ids_de.fetch(de)
      ids.empty? ? 0 : conexion.select_value("SELECT count(*) FROM #{tabla} WHERE #{col_tipo} = '#{tipo}' AND #{col_id} = ANY(ARRAY[#{ids.join(',')}]::bigint[])").to_i
    end
    ajeno['actividad'] = actividad
    ajeno.each { |k, v| hecho("ajeno_#{k}", v) }
    return if ajeno.values.all?(&:zero?)

    raise DeshacerError, "algo ajeno en la bandeja (#{ajeno.map { |k, v| "#{k} #{v}" }.join(', ')})"
  end

  # Los contactos de la bandeja, todos dtd-portal:<uuid>, y los que se conservan: los que tienen un contact_inbox en
  # otra bandeja o una conversación fuera de esta. [[identificador, contacto_id], …] ordenados.
  def contactos
    ids = contact_inboxes.distinct.pluck(:contact_id)
    filas = Contact.where(id: ids).pluck(:id, :account_id, :identifier)
    raise DeshacerError, 'un contact_inbox de la bandeja es de un contacto de otra cuenta' unless filas.all? { |_, cuenta, _| cuenta == @cuenta_id }

    todos = filas.map do |id, _, identifier|
      ident = identifier.to_s.delete_prefix(PREFIJO_CONTACTO)
      raise DeshacerError, 'un contacto de la bandeja no es dtd-portal:<uuid>' unless identifier.to_s.start_with?(PREFIJO_CONTACTO) && ident.match?(UUID)

      [ident, id]
    end
    con_otra = ContactInbox.where(contact_id: ids).where.not(inbox_id: @bandeja_id).distinct.pluck(:contact_id).to_set
    con_otra.merge(Conversation.where(contact_id: ids).where.not(inbox_id: @bandeja_id).distinct.pluck(:contact_id))
    conservados = todos.select { |_, id| con_otra.include?(id) }.sort
    [todos.sort, conservados]
  end

  def lineas_conservados(conservados)
    [{ tipo: 'cabecera', version: 1, tenant_id: @tenant, cuenta: @cuenta_id, bandeja: @bandeja_id, contactos: conservados.size },
     *conservados.map { |ident, id| { tipo: 'contacto', identificador: ident, contacto_id: id } }]
  end

  def escribir_conservados(conservados)
    lineas = lineas_conservados(conservados)
    if @conservados == '-'
      lineas.each { |l| @salida.puts "CONSERVADO #{JSON.generate(l)}" }
    else
      tmp = "#{RUTA_CONSERVADOS}.parcial"
      File.write(tmp, lineas.map { |l| JSON.generate(l) }.join("\n") + "\n")
      File.rename(tmp, RUTA_CONSERVADOS)
    end
    hecho('conservados_lineas', lineas.size)
  end

  # El archivo del seco, por la entrada estándar: tiene que ser de este tenant, cuenta y bandeja, coherente, y la
  # misma lista que se recalcula ahora.
  def leer_conservados
    lineas = @entrada.each_line.map(&:strip).reject(&:empty?).map { |l| JSON.parse(l) }
    cab = lineas.first
    raise DeshacerError, 'los conservados no traen cabecera' unless cab && cab['tipo'] == 'cabecera' && cab['version'] == 1
    unless cab['tenant_id'] == @tenant && cab['cuenta'] == @cuenta_id && cab['bandeja'] == @bandeja_id
      raise DeshacerError, 'los conservados no son de este tenant, cuenta y bandeja'
    end

    filas = lineas.drop(1)
    raise DeshacerError, 'los conservados traen un tipo desconocido' unless filas.all? { |l| l['tipo'] == 'contacto' }
    raise DeshacerError, 'la cabecera de los conservados no cuadra con las líneas' unless cab['contactos'] == filas.size

    filas.map { |l| [l['identificador'].to_s, Integer(l['contacto_id'].to_s, 10)] }.sort
  end

  def correr
    comprobar_bandeja!
    hecho('modo', @modo)
    ActiveRecord::Base.transaction do
      bajar_detalle_del_log!
      libre = ActiveRecord::Base.connection.select_value("SELECT pg_try_advisory_xact_lock(#{CANDADO})")
      raise DeshacerError, 'otra carga o deshacer del portal en curso' unless libre == true || libre == 't'

      # N4 (revisión del DG): en READ COMMITTED, entre mirar lo ajeno y borrar podría entrar algo. Las conversaciones de
      # la bandeja quedan tomadas hasta el fin de la transacción: un mensaje nuevo a una de ellas espera.
      conversaciones.lock('FOR UPDATE').pluck(:id)
      hecho('antes', contar_bandeja)
      comprobar_ajeno!
      todos, conservados = contactos
      borrar = todos - conservados
      hecho('contactos_de_la_bandeja', todos.size)
      hecho('contactos_conservados', conservados.size)
      hecho('contactos_a_borrar', borrar.size)
      if @modo == 'seco'
        escribir_conservados(conservados)
        raise ActiveRecord::Rollback
      end

      raise DeshacerError, 'la lista de conservados cambió desde el seco' unless leer_conservados == conservados

      ids_borrar = borrar.map(&:last)
      hecho('borrados_mensajes', mensajes.delete_all)
      hecho('borrados_conversaciones', conversaciones.delete_all)
      hecho('borrados_contact_inboxes', contact_inboxes.delete_all)
      hecho('borrados_contactos', Contact.where(id: ids_borrar, account_id: @cuenta_id).delete_all)
      # La verificación, dentro de la transacción: si no cuadra, no se confirma.
      quedan = contar_bandeja
      vivos = Contact.where(id: conservados.map(&:last)).count
      raise DeshacerError, 'la verificación no cuadra' unless quedan == 'conversaciones:0,mensajes:0,contact_inboxes:0' &&
                                                 vivos == conservados.size && Contact.where(id: ids_borrar).none?

      hecho('despues', quedan)
      hecho('confirmado', @confirmar)
      raise ActiveRecord::Rollback unless @confirmar == 'si'
    end
    hecho('despues_de_la_transaccion', contar_bandeja)
    hecho('deshacer', 'ok')
  end
end

unless defined?(DESHACER_PORTAL_COMO_BIBLIOTECA)
  if ENV['MODO'].present?
    exit(DeshacerPortal.principal(ENV))
  else
    puts 'HECHO deshacer=error'
    puts 'HECHO error=falta MODO'
    exit 2
  end
end
