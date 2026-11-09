# frozen_string_literal: true

# infra/ops/kommo-historial/pruebas/sonda-ensayo.rb — sonda del ENSAYO del Archivo Kommo (SDD-0590 5.6), sobre la
# COPIA efímera de la base de Chatwoot de producción que levanta ensayo-archivo.sh. Nunca sobre producción.
#
#   FASE=antes   CUENTA=<id>                  foto de la cuenta antes de cargar → ESTADO (por defecto /tmp/estado/antes.json)
#   FASE=despues CUENTA=<id> BANDEJA=<id>     mide E-4 a E-11 contra esa foto
#   FASE=usuario-real CUENTA BANDEJA ETAPA=antes|despues
#                E-10 con un usuario real de la cuenta (no uno temporal), antes y después de MODO=miembros
#   FASE=busqueda CUENTA BANDEJA          búsqueda de mensajes con la ventana del proceso
#                (SEARCH_TIME_RANGE_LIMIT_DAYS): si encuentra un mensaje viejo del Archivo (palabra_apta) y cuánto tarda
#
# Las búsquedas miden la pertenencia sobre la consulta entera, no sobre una página (en_busqueda, SDD-0590 §10.17).
#
# Trabaja con datos reales: imprime SOLO conteos, huellas (md5) y «si»/«no». Nunca nombres, teléfonos, correos ni
# textos. Lo que crea para medir (un administrador y un agente temporales, una conversación de prueba, dos mensajes
# de referencia) queda en la copia, que se borra entera al terminar.

require 'json'
require 'securerandom'
require 'sidekiq/api'

module SondaEnsayo
  module_function

  def hecho(out, clave, valor)
    out.puts "HECHO #{clave}=#{valor}"
  end

  def sql(texto, *args)
    ActiveRecord::Base.connection.select_value(ActiveRecord::Base.sanitize_sql_array([texto, *args]))
  end

  def huella(tabla, cuenta, hasta_id)
    sql("SELECT md5(coalesce(string_agg(id::text || ':' || updated_at::text, ',' ORDER BY id), '')) FROM #{tabla} " \
        'WHERE account_id = ? AND id <= ?', cuenta, hasta_id)
  end

  def clases_en_cola
    cuenta = Hash.new(0)
    [*Sidekiq::Queue.all, Sidekiq::ScheduledSet.new, Sidekiq::RetrySet.new].each do |c|
      c.each do |trabajo|
        evento = Array(trabajo.display_args).find { |a| a.is_a?(String) && a.match?(/\A[a-z_]+(\.[a-z_]+)+\z/) }
        cuenta[evento ? "#{trabajo.display_class}(#{evento})" : trabajo.display_class] += 1
      end
    end
    cuenta
  end

  def formato(lista)
    lista.empty? ? 'ninguno' : lista.sort.join(',')
  end

  def trabajos_nuevos(antes, despues)
    formato(despues.filter_map { |clase, n| "#{clase}:#{n - antes[clase]}" if n > antes[clase] })
  end

  def repetidos(cuenta)
    contactos = Contact.where(account_id: cuenta)
    {
      'tel' => contactos.where.not(phone_number: [nil, '']).group(:phone_number).having('count(*) > 1').count.size,
      'correo' => contactos.where.not(email: [nil, '']).group(Arel.sql('lower(email)')).having('count(*) > 1').count.size
    }
  end

  def foto(cuenta)
    convs = Conversation.where(account_id: cuenta)
    max_conv = convs.maximum(:id).to_i
    max_contacto = Contact.where(account_id: cuenta).maximum(:id).to_i
    max_mensaje = Message.where(account_id: cuenta).maximum(:id).to_i
    rep = repetidos(cuenta)
    {
      'inicio' => Time.now.to_f,
      'conversaciones' => convs.count, 'mensajes' => Message.where(account_id: cuenta).count,
      'contactos' => Contact.where(account_id: cuenta).count, 'bandejas' => Inbox.where(account_id: cuenta).count,
      'max_conversacion' => max_conv, 'max_contacto' => max_contacto, 'max_mensaje' => max_mensaje,
      'huella_conversaciones' => huella('conversations', cuenta, max_conv),
      'huella_contactos' => huella('contacts', cuenta, max_contacto),
      'huella_mensajes' => huella('messages', cuenta, max_mensaje),
      'tel_repetidos' => rep['tel'], 'correo_repetidos' => rep['correo'],
      'secuencia' => sql("SELECT last_value FROM conv_dpid_seq_#{Integer(cuenta)}").to_i,
      'max_display' => convs.maximum(:display_id).to_i
    }
  end

  def antes(out:, estado:, cuenta:)
    f = foto(cuenta)
    File.write(estado, JSON.generate(f))
    %w[conversaciones mensajes contactos bandejas tel_repetidos correo_repetidos secuencia max_display].each do |k|
      hecho(out, k, f[k])
    end
    %w[huella_conversaciones huella_contactos huella_mensajes].each { |k| hecho(out, k, f[k][0, 12]) }
    hecho(out, 'antes', 'ok')
  end

  # Con Current lleno como en una petición (application_controller.rb:18, ensure_current_account_helper.rb:6 y :25).
  def como(usuario, cuenta_ar)
    Current.user = usuario
    Current.account = cuenta_ar
    Current.account_user = AccountUser.find_by(account_id: cuenta_ar.id, user_id: usuario.id)
    yield
  ensure
    Current.user = nil
    Current.account = nil
    Current.account_user = nil
  end

  def usuario_temporal(cuenta_ar, rol)
    clave = "#{SecureRandom.hex(12)}Aa1!"
    u = User.new(name: "Ensayo #{rol}", email: "ensayo.#{rol}.#{SecureRandom.hex(4)}@example.invalid",
                 password: clave, password_confirmation: clave)
    u.skip_confirmation!
    u.save!
    AccountUser.create!(account: cuenta_ar, user: u, role: rol)
    u
  end

  def despues(out:, estado:, cuenta:, bandeja:)
    @correos_sonda = 0
    ActiveSupport::Notifications.subscribe('deliver.action_mailer') { @correos_sonda += 1 }
    medir = lambda do |k, &bloque|
      hecho(out, k, bloque.call)
    rescue StandardError => e
      hecho(out, k, "error:#{e.class}")
    end
    a = JSON.parse(File.read(estado))
    archivo = Integer(bandeja)
    convs = Conversation.where(inbox_id: archivo)
    msgs = Message.where(inbox_id: archivo)

    # E-4 y E-5: la cola por clase y evento al empezar (prueba la compara con la que deja crear la bandeja).
    hecho(out, 'trabajos_actuales', formato(clases_en_cola.map { |c, n| "#{c}:#{n}" }))

    # E-11: lo que ya existía no cambió (huellas de id y updated_at hasta el máximo id de antes).
    hecho(out, 'conversaciones_existentes_intactas', huella('conversations', cuenta, a['max_conversacion']) == a['huella_conversaciones'] ? 'si' : 'no')
    hecho(out, 'contactos_existentes_intactos', huella('contacts', cuenta, a['max_contacto']) == a['huella_contactos'] ? 'si' : 'no')
    hecho(out, 'mensajes_existentes_intactos', huella('messages', cuenta, a['max_mensaje']) == a['huella_mensajes'] ? 'si' : 'no')
    hecho(out, 'mensajes_fuera_del_archivo', Message.where(account_id: cuenta).where('id > ?', a['max_mensaje']).where.not(inbox_id: archivo).count)

    # 5.5b: los adjuntos del Archivo. Cuántos y cuántos bytes, cuántos íntegros en el almacenamiento de la copia, y
    # ningún huérfano entre los blobs creados desde la foto de antes (los de producción no tienen archivo en la copia).
    adjs = Attachment.joins(:message).where(messages: { inbox_id: archivo })
    hecho(out, 'adjuntos_archivo', adjs.count)
    medir.call('adjuntos_bytes') { adjs.to_a.sum { |x| x.file.attached? ? x.file.blob.byte_size : 0 } }
    medir.call('adjuntos_integros') do
      adjs.find_each.count { |x| x.file.attached? && Digest::MD5.base64digest(x.file.download) == x.file.blob.checksum }
    end
    desde = Time.zone.at(a['inicio'].to_f)
    nuevos = ActiveStorage::Blob.where('active_storage_blobs.created_at >= ?', desde)
    hecho(out, 'blobs_huerfanos', nuevos.left_joins(:attachments).where(active_storage_attachments: { id: nil }).count)
    medir.call('blobs_sin_archivo') { nuevos.to_a.count { |bl| !bl.service.exist?(bl.key) } }
    medir.call('archivos_sin_blob') do
      claves = nuevos.pluck(:key).to_set
      Dir.glob(File.join(ActiveStorage::Blob.service.root, '**', '*')).count { |f| File.file?(f) && !claves.include?(File.basename(f)) }
    end

    # E-6: lo cargado.
    hecho(out, 'archivo_conversaciones', convs.count)
    hecho(out, 'archivo_mensajes', msgs.count)
    hecho(out, 'archivo_resueltas', convs.where(status: :resolved).count)
    hecho(out, 'archivo_asignadas', convs.where.not(assignee_id: nil).count)
    hecho(out, 'json_conv', convs.where("jsonb_typeof(additional_attributes::jsonb) <> 'object'").count)
    medir.call('no_reenviados') { msgs.not_forwarded.count }
    medir.call('no_leidos') { convs.to_a.sum { |c| c.unread_incoming_messages.count } }

    # E-9: sin huérfanos ni cruces, y los repetidos no aumentan.
    hecho(out, 'huerfanos_mensaje', msgs.where.not(conversation_id: Conversation.select(:id)).count)
    hecho(out, 'huerfanos_conversacion', convs.where.not(contact_id: Contact.select(:id)).count)
    hecho(out, 'sin_contact_inbox', convs.where(contact_inbox_id: nil).count)
    hecho(out, 'contact_inbox_cruzado', convs.joins('JOIN contact_inboxes ci ON ci.id = conversations.contact_inbox_id')
                                             .where('ci.contact_id <> conversations.contact_id OR ci.inbox_id <> conversations.inbox_id').count)
    hecho(out, 'remitente_cruzado', msgs.where(message_type: :incoming).joins(:conversation)
                                        .where("messages.sender_type IS DISTINCT FROM 'Contact' OR messages.sender_id IS DISTINCT FROM conversations.contact_id").count)
    rep = repetidos(cuenta)
    hecho(out, 'tel_repetidos', "#{a['tel_repetidos']}->#{rep['tel']}")
    hecho(out, 'correo_repetidos', "#{a['correo_repetidos']}->#{rep['correo']}")
    hecho(out, 'contactos', "#{a['contactos']}->#{Contact.where(account_id: cuenta).count}")
    hecho(out, 'contactos_reusados_en_archivo', convs.where('contact_id <= ?', a['max_contacto']).distinct.count(:contact_id))

    # E-8: números de conversación.
    hecho(out, 'secuencia', "#{a['secuencia']}->#{sql("SELECT last_value FROM conv_dpid_seq_#{Integer(cuenta)}").to_i}")
    hecho(out, 'display_duplicados', Conversation.where(account_id: cuenta).group(:display_id).having('count(*) > 1').count.size)
    orden = convs.order(:display_id).pluck(:created_at).map(&:to_i)
    hecho(out, 'display_en_orden', orden == orden.sort ? 'si' : 'no')

    # E-10: buscar el Archivo, con la ventana por defecto (la de producción), como administrador y como agente.
    cuenta_ar = Account.find(cuenta)
    vieja = convs.order(:created_at).first
    consultas = consultas_de(vieja)
    hecho(out, 'busqueda_consultas', consultas.keys.sort.join(','))
    # «si»/«no» por consulta, y aparte cuántos resultados trae cada una (admin_resultados, agente_..._resultados).
    encuentra = lambda do |usuario, clave|
      r = buscar_conversacion(usuario, cuenta_ar, vieja, consultas)
      hecho(out, "#{clave}_resultados", totales(r))
      si_no(r)
    end
    admin = usuario_temporal(cuenta_ar, :administrator)
    agente = usuario_temporal(cuenta_ar, :agent)
    medir.call('admin_encuentra') { encuentra.call(admin, 'admin') }
    medir.call('agente_sin_ser_miembro') { encuentra.call(agente, 'agente_sin_ser_miembro') }
    medir.call('miembros_trabajos') do
      antes_cola = clases_en_cola
      notificaciones = Notification.count
      Inbox.find(archivo).add_members([agente.id])
      hecho(out, 'miembros_notificaciones', Notification.count - notificaciones)
      trabajos_nuevos(antes_cola, clases_en_cola)
    end
    hecho(out, 'miembros_asignadas', convs.where.not(assignee_id: nil).count)
    medir.call('agente_miembro') { encuentra.call(agente, 'agente_miembro') }

    # E-8: una conversación nueva, creada como la crearía un canal, va después de las del Archivo. En la copia.
    medir.call('display_nueva_mayor') do
      viva = Conversation.where(account_id: cuenta).where.not(inbox_id: archivo).order(:id).last
      if viva
        nueva = Conversation.create!(account_id: cuenta, inbox_id: viva.inbox_id, contact_id: viva.contact_id,
                                     contact_inbox_id: viva.contact_inbox_id)
        nueva.display_id > convs.maximum(:display_id).to_i ? 'si' : 'no'
      else
        'sin_conversacion_viva'
      end
    end

    # Correos: los que esta sonda entregó (ActionMailer) y los que quedaron en cola en todo el ensayo. La copia
    # empieza con Redis vacío y sin Sidekiq, así que lo que haya en cola lo encoló el ensayo. Tiene que dar 0 y 0.
    hecho(out, 'correos_enviados_sonda', @correos_sonda.to_i)
    hecho(out, 'correos_en_cola', clases_en_cola.select { |clase, _| clase.match?(/mail|email/i) }.values.sum)
    hecho(out, 'despues', 'ok')
  end

  # Los usuarios reales de la cuenta: todos menos los temporales de esta sonda (@example.invalid).
  def reales(cuenta)
    AccountUser.where(account_id: cuenta).joins(:user).where.not('users.email LIKE ?', '%@example.invalid')
  end

  # Las consultas de E-10 sobre una conversación: lo que una persona escribiría en el buscador.
  def consultas_de(conversacion)
    contacto = conversacion&.contact
    { 'nombre' => contacto&.name.to_s, 'telefono' => contacto&.phone_number.to_s.delete_prefix('+'),
      'numero' => conversacion&.display_id.to_s }.reject { |_, q| q.empty? }
  end

  # Si la búsqueda de un usuario trae una fila, y cuántas trae en total. Chatwoot filtra con ILIKE '%q%' y pagina de
  # a 15, de la más nueva a la más vieja (search_service.rb:33-48 y :100-107 de la v4.19.1). Con los datos reales,
  # «21», el número de la conversación más vieja, trae cientos de resultados, y la más vieja queda en la última
  # página (SDD-0590 §10.16). Por eso la pertenencia se mide sobre la consulta entera, con los mismos filtros, sin el
  # límite ni el desplazamiento de la página. Se probó así en producción, en solo lectura, el 2026-11-07.
  def en_busqueda(usuario, cuenta_ar, tipo, q, id)
    como(usuario, cuenta_ar) do
      rel = SearchService.new(current_user: usuario, current_account: cuenta_ar, search_type: tipo,
                              params: { q: q, page: 1 }).perform[tipo == 'Message' ? :messages : :conversations]
      [rel.except(:limit, :offset).where(id: id).exists?, rel.total_count]
    end
  end

  def buscar_conversacion(usuario, cuenta_ar, conversacion, consultas)
    consultas.to_h { |k, q| [k, en_busqueda(usuario, cuenta_ar, 'Conversation', q, conversacion.id)] }
  end

  def si_no(resultado)
    resultado.map { |k, (esta, _)| "#{k}:#{esta ? 'si' : 'no'}" }.sort.join(',')
  end

  def totales(resultado)
    resultado.map { |k, (_, n)| "#{k}:#{n}" }.sort.join(',')
  end

  # E-10 con un usuario real (Sam, 2026-11-06: miembros, «todo el equipo»). El de menor id entre los agentes, que
  # solo ven las bandejas de las que son miembros; si no hay agentes, entre los administradores, que ven todas.
  # Imprime el rol y «si»/«no», nunca quién es.
  def usuario_real_fase(out:, cuenta:, bandeja:, etapa:)
    cuenta_ar = Account.find(cuenta)
    archivo = Integer(bandeja)
    vieja = Conversation.where(inbox_id: archivo).order(:created_at).first
    lista = reales(cuenta)
    au = lista.where(role: :agent).order(:user_id).first || lista.where(role: :administrator).order(:user_id).first
    hecho(out, 'etapa', etapa)
    hecho(out, 'usuarios_reales', lista.count)
    hecho(out, 'administradores_reales', lista.where(role: :administrator).count)
    hecho(out, 'agentes_reales', lista.where(role: :agent).count)
    if au.nil? || vieja.nil?
      hecho(out, 'usuario_real_rol', au.nil? ? 'ninguno' : 'sin_conversacion')
    else
      hecho(out, 'usuario_real_rol', au.administrator? ? 'administrador' : 'agente')
      hecho(out, 'usuario_real_miembro', InboxMember.exists?(inbox_id: archivo, user_id: au.user_id) ? 'si' : 'no')
      r = buscar_conversacion(au.user, cuenta_ar, vieja, consultas_de(vieja))
      hecho(out, 'usuario_real_encuentra', si_no(r))
      hecho(out, 'usuario_real_resultados', totales(r))
    end
    hecho(out, 'miembros_archivo', InboxMember.where(inbox_id: archivo).count)
    hecho(out, 'usuario_real_fase', 'ok')
  rescue StandardError => e
    hecho(out, 'usuario_real_fase', "error:#{e.class}")
  end

  # BQ1 busca un mensaje viejo del Archivo por una de sus palabras. Con los datos reales, el mensaje con texto más
  # viejo no tenía ninguna palabra de 5 letras o más, y BQ1 dio «sin_palabra» (SDD-0590 §10.16). Ahora es el primero,
  # del más viejo al más nuevo entre los BQ1_REVISAR más viejos, que tenga una palabra apta: BQ1_PALABRA (6 letras o
  # más) y como mucho BQ1_TOPE coincidencias en la cuenta. De las suyas, la menos frecuente. Es lo que se probó en
  # producción, en solo lectura, el 2026-11-07. Se imprimen la posición y los conteos, nunca la palabra.
  BQ1_REVISAR = 60
  BQ1_PALABRA = /\p{L}{6,}/
  BQ1_TOPE = 60

  def palabra_apta(cuenta, archivo)
    revisados = 0
    Message.where(inbox_id: archivo).where.not(content: [nil, '']).order(:created_at, :id).limit(BQ1_REVISAR).each do |m|
      revisados += 1
      frecuencia = m.content.scan(BQ1_PALABRA).uniq.first(12).to_h do |w|
        [w, Message.where(account_id: cuenta).where('content ILIKE ?', "%#{Message.sanitize_sql_like(w)}%").count]
      end
      palabra, veces = frecuencia.select { |_, n| n <= BQ1_TOPE }.min_by { |_, n| n }
      return { mensaje: m, palabra: palabra, veces: veces, posicion: revisados } if palabra
    end
    { revisados: revisados }
  end

  # Búsqueda de mensajes con la ventana del proceso (SEARCH_TIME_RANGE_LIMIT_DAYS; sin la variable, 90 días), como
  # un administrador temporal: si el mensaje de BQ1 (palabra_apta) está entre los resultados de su palabra, en la
  # consulta entera, y cuánto tarda la primera página (mediana de 3). Otra consulta, sin coincidencias, recorre la
  # ventana entera.
  def busqueda(out:, cuenta:, bandeja:)
    cuenta_ar = Account.find(cuenta)
    archivo = Integer(bandeja)
    dias = Limits.search_time_range_limit_days
    desde = dias.days.ago
    hecho(out, 'ventana_dias', dias)
    hecho(out, 'busqueda_gin', cuenta_ar.feature_enabled?('search_with_gin') ? 'si' : 'no')
    # Sin sql(): sanitize_sql_array sin parámetros usa el texto como formato de String#%, y '%gin%' rompería.
    hecho(out, 'indice_gin_contenido', ActiveRecord::Base.connection.select_value(
      "SELECT count(*) FROM pg_indexes WHERE tablename = 'messages' AND indexdef ILIKE '%gin%' " \
      "AND indexdef ILIKE '%content%'"
    ))
    hecho(out, 'mensajes_cuenta_en_ventana', Message.where(account_id: cuenta).where('created_at >= ?', desde).count)
    hecho(out, 'mensajes_archivo', Message.where(inbox_id: archivo).count)
    hecho(out, 'mensajes_archivo_en_ventana', Message.where(inbox_id: archivo).where('created_at >= ?', desde).count)
    admin = usuario_temporal(cuenta_ar, :administrator)
    buscar = lambda do |q, pagina = 1|
      como(admin, cuenta_ar) do
        SearchService.new(current_user: admin, current_account: cuenta_ar, search_type: 'Message',
                          params: { q: q, page: pagina }).perform[:messages].to_a
      end
    end
    mediana_ms = lambda do |q|
      Array.new(3) do
        t = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        buscar.call(q)
        ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - t) * 1000).round
      end.sort[1]
    end
    elegido = palabra_apta(cuenta, archivo)
    if elegido[:palabra]
      vieja = elegido[:mensaje]
      hecho(out, 'vieja_dias', ((Time.zone.now - vieja.created_at) / 1.day).floor)
      hecho(out, 'vieja_posicion', elegido[:posicion])
      hallada, resultados = en_busqueda(admin, cuenta_ar, 'Message', elegido[:palabra], vieja.id)
      hecho(out, 'vieja_encontrada', hallada ? 'si' : 'no')
      hecho(out, 'palabra_coincidencias_cuenta', elegido[:veces])
      hecho(out, 'palabra_resultados', resultados)
      hecho(out, 'palabra_ms', mediana_ms.call(elegido[:palabra]))
    else
      hecho(out, 'vieja_revisados', elegido[:revisados])
      hecho(out, 'vieja_encontrada', 'sin_palabra')
    end
    hecho(out, 'sin_coincidencias_ms', mediana_ms.call("zq#{SecureRandom.hex(6)}"))
    hecho(out, 'busqueda', 'ok')
  rescue StandardError => e
    hecho(out, 'busqueda', "error:#{e.class}")
  end
end

case ENV['FASE']
when 'antes'
  SondaEnsayo.antes(out: $stdout, estado: ENV.fetch('ESTADO', '/tmp/estado/antes.json'), cuenta: Integer(ENV.fetch('CUENTA')))
when 'despues'
  SondaEnsayo.despues(out: $stdout, estado: ENV.fetch('ESTADO', '/tmp/estado/antes.json'),
                      cuenta: Integer(ENV.fetch('CUENTA')), bandeja: ENV.fetch('BANDEJA'))
when 'usuario-real'
  SondaEnsayo.usuario_real_fase(out: $stdout, cuenta: Integer(ENV.fetch('CUENTA')), bandeja: ENV.fetch('BANDEJA'),
                                etapa: ENV.fetch('ETAPA'))
when 'busqueda'
  SondaEnsayo.busqueda(out: $stdout, cuenta: Integer(ENV.fetch('CUENTA')), bandeja: ENV.fetch('BANDEJA'))
end
