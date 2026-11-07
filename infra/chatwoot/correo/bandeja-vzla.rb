# frozen_string_literal: true

# SDD-0582 4.8 · PC-3: bandeja «Correo · vzla@» sobre el buzón vzla@ (opción B, «vzla@ completo», Sam,
# 2026-10-30). NUNCA SE HA CORRIDO EN EL VPS. Cada acción en el Chatwoot vivo pide el OK nominal de Sam que
# nombra docs/specs/0582-chatwoot-piloto/e4-correo.md §6.4. Prueba con datos inventados sobre la imagen
# real: pruebas/prueba-correo-sistema.sh (casos V).
#
#   docker compose cp correo/bandeja-vzla.rb rails:/tmp/bandeja-vzla.rb
#   docker compose exec -T -e DTD_MIEMBROS=<ids> -e DTD_RESPONSABLE_LEGAL=<id> rails \
#     bundle exec rails runner /tmp/bandeja-vzla.rb crear
#   ... estado | reglas | dominios N | apagar-imap
#
# Lo que NO hace: no escribe claves ni enciende el IMAP. La clave de vzla@ la escribe Sam en la pantalla de
# la bandeja (Ajustes → Bandejas → «Correo · vzla@» → Configuración, IMAP y SMTP). Al guardar el IMAP
# encendido empieza la lectura, y para entonces las etiquetas, los miembros y las reglas ya existen.
# Tampoco borra: borrar la bandeja borra lo copiado y lo hace Sam desde el panel, si lo decide.
#
# Imprime solo ids, conteos, estados, nombres de reglas y dominios: nunca direcciones, asuntos ni contenido.
#
# Variables (solo en el comando, nunca en Git):
#   DTD_MIEMBROS             ids de los agentes de la bandeja, separados por coma (decisión 3 del diseño)
#   DTD_RESPONSABLE_LEGAL    id del agente al que la regla «legal» asigna (Sam, 2026-11-03); tiene que ser
#                            miembro, porque Chatwoot solo asigna a miembros de la bandeja
#   DTD_NO_CLIENTE_DOMINIOS  dominios de remitentes «no-cliente», separados por coma, armados con `dominios`.
#                            Sin la variable, la regla «no-cliente» no se crea ni se cambia
#   DTD_SISTEMA_REMITENTES   remitentes de avisos de DTD además de noreply@, notificaciones@ y no-responder@
#                            del dominio. Chatwoot toma como contacto el Reply-To (MailPresenter#original_sender),
#                            así que si el aviso del ERP trae Reply-To, ese es el que va aquí
#   DTD_CUENTA_ID            cuenta de Chatwoot (1 por defecto)
#   DTD_BUZON_VZLA           solo para la prueba con datos inventados; en el VPS sale de SMTP_DOMAIN
module DtdBandejaVzla
  NOMBRE = 'Correo · vzla@'
  DOMINIO = ENV.fetch('SMTP_DOMAIN', 'dtdcargo.com').downcase
  BUZON = ENV['DTD_BUZON_VZLA'].presence || "vzla@#{DOMINIO}"
  ETIQUETAS = %w[legal no-cliente sistema].freeze
  REGLAS = { legal: 'Correo · legal', sistema: 'Correo · sistema', no_cliente: 'Correo · no-cliente' }.freeze
  ASUNTOS_LEGALES = %w[Privacidad Gerencia].freeze
  DOMINIO_VALIDO = /\A[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\z/
  DIRECCION_VALIDA = /\A[a-z0-9._+-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\z/

  module_function

  def cuenta = Account.find(ENV.fetch('DTD_CUENTA_ID', '1'))

  def bandeja(c)
    c.inboxes.where(channel_type: 'Channel::Email').find_by(name: NOMBRE)
  end

  def lista(variable) = ENV[variable].to_s.split(',').map { |v| v.strip.downcase }.reject(&:empty?)

  def miembros(c)
    ids = lista('DTD_MIEMBROS')
    abort 'falta DTD_MIEMBROS: ids de agentes separados por coma' if ids.empty?
    abort 'DTD_MIEMBROS: solo números separados por coma' unless ids.all? { |i| i.match?(/\A\d+\z/) }

    usuarios = c.users.where(id: ids.map(&:to_i)).to_a
    abort "DTD_MIEMBROS: #{ids.size - usuarios.size} id(s) no son agentes de la cuenta #{c.id}" if usuarios.size != ids.uniq.size
    abort 'DTD_MIEMBROS: hay agentes sin confirmar' unless usuarios.all?(&:confirmed?)

    usuarios
  end

  def responsable(c, usuarios_ids, regla_actual = nil)
    valor = ENV['DTD_RESPONSABLE_LEGAL'].presence
    valor ||= regla_actual&.actions&.find { |a| a['action_name'] == 'assign_agent' }&.dig('action_params', 0)&.to_s
    abort 'falta DTD_RESPONSABLE_LEGAL: id del agente de los mensajes legales' if valor.blank?
    abort 'DTD_RESPONSABLE_LEGAL: tiene que ser un número' unless valor.match?(/\A\d+\z/)
    abort 'DTD_RESPONSABLE_LEGAL: tiene que ser miembro de la bandeja' unless usuarios_ids.include?(valor.to_i)
    abort "DTD_RESPONSABLE_LEGAL: no es agente de la cuenta #{c.id}" unless c.users.exists?(id: valor.to_i)

    valor.to_i
  end

  def remitentes_sistema
    extra = lista('DTD_SISTEMA_REMITENTES')
    malos = extra.grep_v(DIRECCION_VALIDA)
    abort "DTD_SISTEMA_REMITENTES: #{malos.size} valor(es) no son direcciones" if malos.any?

    (%w[noreply notificaciones no-responder].map { |u| "#{u}@#{DOMINIO}" } + extra).uniq
  end

  def dominios_no_cliente
    dominios = lista('DTD_NO_CLIENTE_DOMINIOS').map { |d| d.delete_prefix('@') }
    malos = dominios.grep_v(DOMINIO_VALIDO)
    abort "DTD_NO_CLIENTE_DOMINIOS: #{malos.size} valor(es) no son dominios" if malos.any?
    abort "DTD_NO_CLIENTE_DOMINIOS: #{DOMINIO} es el dominio de DTD; sus avisos van por «sistema»" if dominios.include?(DOMINIO)

    dominios.uniq
  end

  # Toda regla empieza por la bandeja (AND) y Chatwoot evalúa en orden: así ninguna toca WhatsApp ni el Archivo.
  # «contains» con varios valores es ILIKE ANY: basta con uno.
  def en_bandeja(inbox)
    { attribute_key: 'inbox_id', filter_operator: 'equal_to', values: [inbox.id], query_operator: 'and' }
  end

  def sin_asunto_legal(operador, asuntos = ASUNTOS_LEGALES)
    { attribute_key: 'mail_subject', filter_operator: 'does_not_contain', values: asuntos, query_operator: operador }
  end

  def guardar_regla(c, nombre, condiciones, acciones)
    regla = AutomationRule.find_or_initialize_by(account: c, name: nombre)
    regla.update!(event_name: 'conversation_created', active: true, description: 'SDD-0582 4.8 PC-3 (bandeja-vzla.rb)',
                  conditions: condiciones, actions: acciones)
    regla
  end

  def reglas(c, inbox, id_responsable)
    guardar_regla(
      c, REGLAS[:legal],
      [en_bandeja(inbox), { attribute_key: 'mail_subject', filter_operator: 'contains', values: ASUNTOS_LEGALES, query_operator: nil }],
      [{ action_name: 'add_label', action_params: ['legal'] }, { action_name: 'change_priority', action_params: ['urgent'] },
       { action_name: 'assign_agent', action_params: [id_responsable] }]
    )
    # Un aviso de DTD nunca debería traer «Privacidad» ni «Gerencia» en el asunto; si lo trae, gana «legal».
    guardar_regla(
      c, REGLAS[:sistema],
      [en_bandeja(inbox), { attribute_key: 'email', filter_operator: 'contains', values: remitentes_sistema, query_operator: 'and' },
       sin_asunto_legal(nil)],
      [{ action_name: 'add_label', action_params: ['sistema'] }, { action_name: 'resolve_conversation', action_params: [] }]
    )
    dominios = dominios_no_cliente
    return puts('regla «no-cliente»: sin DTD_NO_CLIENTE_DOMINIOS, no se crea ni se cambia') if dominios.empty?

    guardar_regla(
      c, REGLAS[:no_cliente],
      [en_bandeja(inbox), { attribute_key: 'email', filter_operator: 'contains', values: dominios.map { |d| "@#{d}" }, query_operator: 'and' },
       sin_asunto_legal(nil, ASUNTOS_LEGALES)], # [no-cliente]
      [{ action_name: 'add_label', action_params: ['no-cliente'] }, { action_name: 'resolve_conversation', action_params: [] }]
    )
  end

  def crear(c)
    if (ya = bandeja(c))
      abort "ya existe la bandeja #{ya.id}: no creo otra"
    end
    abort 'ya hay un canal de correo con ese buzón: no creo otro' if Channel::Email.exists?(email: BUZON)

    usuarios = miembros(c)
    id_responsable = responsable(c, usuarios.map(&:id))
    ActiveRecord::Base.transaction do
      ETIQUETAS.each { |t| Label.find_or_create_by!(account: c, title: t) }
      canal = Channel::Email.create!(
        account: c, email: BUZON,
        imap_enabled: false, imap_address: 'imap.hostinger.com', imap_port: 993, imap_enable_ssl: true,
        imap_login: BUZON, imap_authentication: 'plain',
        smtp_enabled: false, smtp_address: 'smtp.hostinger.com', smtp_port: 587, smtp_login: BUZON, smtp_domain: DOMINIO,
        smtp_enable_starttls_auto: true, smtp_authentication: 'login', smtp_openssl_verify_mode: 'peer'
      )
      inbox = Inbox.create!(account: c, name: NOMBRE, channel: canal, business_name: 'DTD Cargo', sender_name_type: :friendly)
      usuarios.each { |u| InboxMember.create!(inbox: inbox, user: u) }
      reglas(c, inbox, id_responsable)
    end
    estado(c)
  end

  def actualizar_reglas(c)
    inbox = bandeja(c) || abort('sin bandeja «Correo · vzla@»: primero crear')
    id_responsable = responsable(c, inbox.members.pluck(:id), AutomationRule.find_by(account: c, name: REGLAS[:legal]))
    ActiveRecord::Base.transaction { reglas(c, inbox, id_responsable) }
    estado(c)
  end

  def en_esta_bandeja?(regla, inbox)
    primera = regla.conditions.first || {}
    primera['attribute_key'] == 'inbox_id' && primera['filter_operator'] == 'equal_to' &&
      Array(primera['values']).map(&:to_i) == [inbox.id] && primera['query_operator'].to_s.casecmp?('and')
  end

  def etiquetadas(inbox, titulo) = inbox.conversations.tagged_with(titulo, on: :labels).pluck(:id).size

  def estado(c)
    inbox = bandeja(c)
    return puts('sin bandeja «Correo · vzla@»') unless inbox

    ch = inbox.channel
    puts "bandeja #{inbox.id} · canal #{ch.id} · imap #{ch.imap_enabled} · smtp #{ch.smtp_enabled} · " \
         "clave imap #{ch.imap_password.present? ? 'cargada' : 'vacía'} · clave smtp #{ch.smtp_password.present? ? 'cargada' : 'vacía'}"
    puts "remitente: business_name=#{inbox.business_name.inspect} · modo=#{inbox.sender_name_type} · miembros #{inbox.members.count}"
    REGLAS.each_value do |nombre|
      r = AutomationRule.find_by(account: c, name: nombre)
      puts(r ? "regla «#{nombre}» id #{r.id} · activa=#{r.active} · en_bandeja=#{en_esta_bandeja?(r, inbox)} · " \
               "acciones=#{r.actions.map { |a| a['action_name'] }.join('+')}" : "regla «#{nombre}»: no existe")
    end
    puts "etiquetas: #{ETIQUETAS.map { |t| "#{t}=#{Label.exists?(account: c, title: t) ? 'sí' : 'no'}" }.join(' ')}"
    conv = inbox.conversations
    internas = conv.open.joins(:contact).where('LOWER(contacts.email) LIKE ?', "%@#{DOMINIO}").count
    puts "conversaciones #{conv.count} · por estado #{conv.unscope(:order).group(:status).count} · " \
         "por etiqueta #{ETIQUETAS.to_h { |t| [t, etiquetadas(inbox, t)] }} · " \
         "automáticas abiertas #{conv.open.where("additional_attributes ->> 'auto_reply' = 'true'").count} · " \
         "de #{DOMINIO} abiertas #{internas}"
  end

  # Conteo por dominio del remitente para armar la lista «no-cliente» (N1 de PC-2). Sale en la terminal: no va a Git.
  def dominios(c, dias)
    inbox = bandeja(c) || abort('sin bandeja «Correo · vzla@»')
    abort 'dominios N: N son días, de 1 a 31' unless dias.to_s.match?(/\A\d+\z/) && dias.to_i.between?(1, 31)

    correos = inbox.conversations.where('conversations.created_at > ?', dias.to_i.days.ago).joins(:contact).pluck('contacts.email')
    conteo = correos.compact.map { |e| e.split('@').last.to_s.downcase }.tally.sort_by { |d, n| [-n, d] }
    puts "conversaciones de los últimos #{dias} días: #{correos.size} · dominios #{conteo.size}"
    conteo.each { |d, n| puts "  #{n} #{d}" }
  end

  def correr(accion, arg = nil)
    c = cuenta
    case accion
    when 'crear' then crear(c)
    when 'estado' then estado(c)
    when 'reglas' then actualizar_reglas(c)
    when 'dominios' then dominios(c, arg)
    when 'apagar-imap'
      inbox = bandeja(c) || abort('sin bandeja «Correo · vzla@»')
      inbox.channel.update!(imap_enabled: false)
      estado(c)
    else
      abort 'acción: crear | estado | reglas | dominios N | apagar-imap'
    end
  end
end

DtdBandejaVzla.correr(ARGV[0], ARGV[1]) unless defined?(BANDEJA_VZLA_SIN_CORRER)
