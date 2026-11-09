# frozen_string_literal: true

# infra/ops/portal-historial/deshacer-carga.rb — SDD-0586 10.7, PR 2c: la vuelta atrás DIRIGIDA de la carga P4 en
# Chatwoot (sub-paso 4.6b del runbook). Hermano de cargar-portal.rb: corre con `rails runner` dentro del contenedor
# de Chatwoot, lo lanza deshacer.sh. Solo sirve entre la carga (puerta 4) y el encendido (puerta 5): antes del
# encendido, todo lo que hay en la bandeja del portal es de la carga.
#
#   MODO=seco   TENANT=<uuid> CUENTA=<id> BANDEJA=<id> CONSERVADOS=/dev/shm/portal-historial/contactos-conservados.ndjson
#   MODO=borrar TENANT=<uuid> CUENTA=<id> BANDEJA=<id> CONFIRMAR=no|si   < contactos-conservados.ndjson
#
# El orden con Studio (acordado con E10, el desarme de supabase/cargas/portal-historial-deshacer/):
#   1. MODO=seco cuenta lo que se borraría y escribe contactos-conservados.ndjson: los contactos dtd-portal: que
#      tienen otra bandeja (o una conversación fuera de esta) y por eso NO se borran. No borra nada;
#   2. el desarme de Studio lee ese archivo y les conserva el chatwoot_contact_id;
#   3. MODO=borrar recibe el archivo por la entrada estándar, recalcula los conservados dentro de su transacción y
#      ABORTA si no son los del archivo. Con CONFIRMAR=no hace todo y termina en ROLLBACK (el ensayo del DG); con
#      CONFIRMAR=si confirma. En producción lo corre Sam.
#
# Qué borra (MODO=borrar), con delete_all, sin callbacks:
#   · los mensajes, las conversaciones y los contact_inboxes de la bandeja del portal;
#   · los contactos dtd-portal: de la bandeja que no se conservan.
# Aborta sin borrar nada si:
#   · la bandeja no es «Conversaciones del portal» de la cuenta (canal API, sin webhook_url), como el cargador;
#   · hay algo ajeno en la bandeja: un mensaje con source_id nulo o que no es dtd:%, una conversación sin dtd_hilo,
#     un contact_inbox cuyo source_id no es dtd-portal:%, una conversación asignada o en snoozed, o actividad que la
#     carga no crea (adjuntos, menciones, participantes, eventos de reportes, notificaciones);
#   · un contacto de la bandeja no es dtd-portal:<uuid>;
#   · (borrar) el archivo de conservados no es de este tenant, cuenta y bandeja, o la lista cambió.
# El flag chatwoot_portal (encendido ahora o alguna vez) vive en Studio: lo mira deshacer.sh antes de llamar a este.
#
# Toma el candado de la carga (no corre a la vez que una carga) y baja el detalle del log de Postgres como el
# cargador (SDD-0586 4.10). El display_id no se rebobina: quedan huecos, y una carga nueva sigue después.
# HECHO lleva solo conteos: nunca nombres ni textos.

require 'json'
require 'set'

class DeshacerPortal
  NOMBRE_BANDEJA = 'Conversaciones del portal'
  RUTA_CONSERVADOS = '/dev/shm/portal-historial/contactos-conservados.ndjson'
  CANDADO = 58_610_510 # el de cargar-portal.rb: una carga o un deshacer a la vez
  PREFIJO_CONTACTO = 'dtd-portal:'
  UUID = /\A\h{8}-\h{4}-\h{4}-\h{4}-\h{12}\z/
  DETALLE_DEL_LOG = { 'log_min_error_statement' => 'panic', 'log_error_verbosity' => 'terse' }.freeze
  ACTIVIDAD = [
    %w[attachments message_id mensajes], %w[mentions conversation_id conversaciones],
    %w[conversation_participants conversation_id conversaciones], %w[reporting_events conversation_id conversaciones]
  ].freeze

  def self.principal(env, entrada: $stdin, salida: $stdout)
    log_sql = ActiveRecord::Base.logger
    ActiveRecord::Base.logger = nil
    new(env: env, entrada: entrada, salida: salida).correr
    0
  rescue StandardError => e
    salida.puts 'HECHO deshacer=error'
    salida.puts "HECHO error=#{e.instance_of?(RuntimeError) ? e.message : e.class.name}"
    1
  ensure
    ActiveRecord::Base.logger = log_sql
  end

  def initialize(env:, entrada:, salida:)
    @modo = env.fetch('MODO')
    raise 'MODO tiene que ser seco o borrar' unless %w[seco borrar].include?(@modo)

    @tenant = env.fetch('TENANT').to_s
    raise 'TENANT tiene que ser un uuid' unless @tenant.match?(UUID)

    @cuenta_id = Integer(env.fetch('CUENTA'))
    @bandeja_id = Integer(env.fetch('BANDEJA'))
    if @modo == 'borrar'
      @confirmar = env['CONFIRMAR']
      raise 'CONFIRMAR tiene que ser si o no' unless %w[si no].include?(@confirmar)
    else
      @conservados = env['CONSERVADOS']
      raise "CONSERVADOS tiene que ser #{RUTA_CONSERVADOS} o -" unless [RUTA_CONSERVADOS, '-'].include?(@conservados)
      raise 'falta la carpeta de CONSERVADOS' unless @conservados == '-' || File.directory?(File.dirname(RUTA_CONSERVADOS))
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
      raise 'no_se_puede_bajar_el_detalle_del_log' unless conexion.select_value("SHOW #{parametro}") == valor
    end
  rescue ActiveRecord::StatementInvalid
    raise 'no_se_puede_bajar_el_detalle_del_log'
  end

  def comprobar_bandeja!
    bandeja = Inbox.find_by(id: @bandeja_id, account_id: @cuenta_id)
    raise 'la bandeja no existe en esa cuenta' unless bandeja
    raise 'la bandeja no es de canal API' unless bandeja.channel_type == 'Channel::Api'
    raise 'la bandeja tiene webhook_url' if bandeja.channel.webhook_url.present?
    raise 'la bandeja no es «Conversaciones del portal»' unless bandeja.name == NOMBRE_BANDEJA
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
    ajeno = {
      'mensajes' => mensajes.where("source_id IS NULL OR source_id NOT LIKE 'dtd:%'").count,
      'conversaciones_sin_dtd_hilo' => conversaciones.where("NOT (coalesce(additional_attributes, '{}'::jsonb) ? 'dtd_hilo')").count,
      'contact_inboxes' => contact_inboxes.where("source_id NOT LIKE 'dtd-portal:%'").count,
      'asignadas' => conversaciones.where.not(assignee_id: nil).count,
      'snoozed' => conversaciones.where(status: Conversation.statuses.fetch('snoozed')).count
    }
    conexion = ActiveRecord::Base.connection
    actividad = ACTIVIDAD.sum do |tabla, columna, de|
      next 0 unless conexion.table_exists?(tabla)

      ids = de == 'mensajes' ? ids_msg : ids_conv
      ids.empty? ? 0 : conexion.select_value("SELECT count(*) FROM #{tabla} WHERE #{columna} = ANY(ARRAY[#{ids.join(',')}]::bigint[])").to_i
    end
    if conexion.table_exists?('notifications') && !ids_conv.empty?
      actividad += conexion.select_value("SELECT count(*) FROM notifications WHERE primary_actor_type = 'Conversation' AND primary_actor_id = ANY(ARRAY[#{ids_conv.join(',')}]::bigint[])").to_i
    end
    ajeno['actividad'] = actividad
    ajeno.each { |k, v| hecho("ajeno_#{k}", v) }
    return if ajeno.values.all?(&:zero?)

    raise "algo ajeno en la bandeja (#{ajeno.map { |k, v| "#{k} #{v}" }.join(', ')})"
  end

  # Los contactos de la bandeja, todos dtd-portal:<uuid>, y los que se conservan: los que tienen un contact_inbox en
  # otra bandeja o una conversación fuera de esta. [[identificador, contacto_id], …] ordenados.
  def contactos
    ids = contact_inboxes.distinct.pluck(:contact_id)
    filas = Contact.where(id: ids).pluck(:id, :account_id, :identifier)
    raise 'un contact_inbox de la bandeja es de un contacto de otra cuenta' unless filas.all? { |_, cuenta, _| cuenta == @cuenta_id }

    todos = filas.map do |id, _, identifier|
      ident = identifier.to_s.delete_prefix(PREFIJO_CONTACTO)
      raise 'un contacto de la bandeja no es dtd-portal:<uuid>' unless identifier.to_s.start_with?(PREFIJO_CONTACTO) && ident.match?(UUID)

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
    raise 'los conservados no traen cabecera' unless cab && cab['tipo'] == 'cabecera' && cab['version'] == 1
    unless cab['tenant_id'] == @tenant && cab['cuenta'] == @cuenta_id && cab['bandeja'] == @bandeja_id
      raise 'los conservados no son de este tenant, cuenta y bandeja'
    end

    filas = lineas.drop(1)
    raise 'los conservados traen un tipo desconocido' unless filas.all? { |l| l['tipo'] == 'contacto' }
    raise 'la cabecera de los conservados no cuadra con las líneas' unless cab['contactos'] == filas.size

    filas.map { |l| [l['identificador'].to_s, Integer(l['contacto_id'])] }.sort
  end

  def correr
    comprobar_bandeja!
    hecho('modo', @modo)
    ActiveRecord::Base.transaction do
      bajar_detalle_del_log!
      libre = ActiveRecord::Base.connection.select_value("SELECT pg_try_advisory_xact_lock(#{CANDADO})")
      raise 'otra carga o deshacer del portal en curso' unless libre == true || libre == 't'

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

      raise 'la lista de conservados cambió desde el seco' unless leer_conservados == conservados

      ids_borrar = borrar.map(&:last)
      hecho('borrados_mensajes', mensajes.delete_all)
      hecho('borrados_conversaciones', conversaciones.delete_all)
      hecho('borrados_contact_inboxes', contact_inboxes.delete_all)
      hecho('borrados_contactos', Contact.where(id: ids_borrar, account_id: @cuenta_id).delete_all)
      # La verificación, dentro de la transacción: si no cuadra, no se confirma.
      quedan = contar_bandeja
      vivos = Contact.where(id: conservados.map(&:last)).count
      raise 'la verificación no cuadra' unless quedan == 'conversaciones:0,mensajes:0,contact_inboxes:0' &&
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
