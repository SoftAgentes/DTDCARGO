# frozen_string_literal: true

# infra/ops/kommo-historial/pruebas/sonda-ensayo.rb — sonda del ENSAYO del Archivo Kommo (SDD-0590 5.6), sobre la
# COPIA efímera de la base de Chatwoot de producción que levanta ensayo-archivo.sh. Nunca sobre producción.
#
#   FASE=antes   CUENTA=<id>                  foto de la cuenta antes de cargar → ESTADO (por defecto /tmp/estado/antes.json)
#   FASE=despues CUENTA=<id> BANDEJA=<id>     mide E-4 a E-11 contra esa foto
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
    contacto = vieja&.contact
    consultas = { 'nombre' => contacto&.name.to_s, 'telefono' => contacto&.phone_number.to_s.delete_prefix('+'),
                  'numero' => vieja&.display_id.to_s }.reject { |_, q| q.empty? }
    hecho(out, 'busqueda_consultas', consultas.keys.sort.join(','))
    # La búsqueda pagina de a 15 (search_service.rb:46-47), más nueva primero: se recorren las páginas.
    esta = lambda do |usuario, q|
      (1..40).any? do |pagina|
        r = como(usuario, cuenta_ar) do
          SearchService.new(current_user: usuario, current_account: cuenta_ar, search_type: 'Conversation',
                            params: { q: q, page: pagina }).perform
        end
        lista = Array(r[:conversations])
        break false if lista.empty?

        lista.any? { |c| c.id == vieja.id }
      end
    end
    encuentra = lambda do |usuario|
      consultas.map { |k, q| "#{k}:#{esta.call(usuario, q) ? 'si' : 'no'}" }.sort.join(',')
    end
    admin = usuario_temporal(cuenta_ar, :administrator)
    agente = usuario_temporal(cuenta_ar, :agent)
    medir.call('admin_encuentra') { encuentra.call(admin) }
    medir.call('agente_sin_ser_miembro') { encuentra.call(agente) }
    medir.call('miembros_trabajos') do
      antes_cola = clases_en_cola
      notificaciones = Notification.count
      Inbox.find(archivo).add_members([agente.id])
      hecho(out, 'miembros_notificaciones', Notification.count - notificaciones)
      trabajos_nuevos(antes_cola, clases_en_cola)
    end
    hecho(out, 'miembros_asignadas', convs.where.not(assignee_id: nil).count)
    medir.call('agente_miembro') { encuentra.call(agente) }

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
end

case ENV['FASE']
when 'antes'
  SondaEnsayo.antes(out: $stdout, estado: ENV.fetch('ESTADO', '/tmp/estado/antes.json'), cuenta: Integer(ENV.fetch('CUENTA')))
when 'despues'
  SondaEnsayo.despues(out: $stdout, estado: ENV.fetch('ESTADO', '/tmp/estado/antes.json'),
                      cuenta: Integer(ENV.fetch('CUENTA')), bandeja: ENV.fetch('BANDEJA'))
end
