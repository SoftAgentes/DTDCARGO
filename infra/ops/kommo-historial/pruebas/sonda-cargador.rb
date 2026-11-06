# frozen_string_literal: true

# infra/ops/kommo-historial/pruebas/sonda-cargador.rb — sonda de la prueba del cargador (SDD-0590 5.5).
# Solo datos inventados. Corre con `rails runner` en el servicio `prepare` de la prueba, sin Sidekiq corriendo:
# todo trabajo encolado se queda en Redis y se puede contar.
#
#   FASE=preparar  crea una cuenta nueva con una bandeja «viva» (un contacto, una conversación y un mensaje que
#                  ya existían), otro contacto con correo, una bandeja con webhook_url y el webhook de la cuenta.
#                  Deja la línea base en ESTADO (por defecto /tmp/estado/base.json).
#   FASE=verificar BANDEJA=<id> mide E-3, E-4, E-6 a E-11 contra esa línea base.
#
# escenario-mutante.rb la carga sin FASE y llama a SondaCargador.preparar y .verificar en el mismo proceso.
# Cada escenario usa una cuenta nueva, así que varios pueden correr sobre la misma base.
# Salida: líneas `HECHO clave=valor`.

require 'json'
require 'securerandom'
require 'sidekiq/api'

module SondaCargador
  module_function

  def cola
    Sidekiq::Queue.all.sum(&:size) + Sidekiq::ScheduledSet.new.size + Sidekiq::RetrySet.new.size
  end

  # Lo mismo que CargaArchivoKommo#trabajos_por_clase y .formato_trabajos: clase y nombre de evento, nada más.
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

  def trabajos_por_clase
    formato(clases_en_cola.map { |clase, n| "#{clase}:#{n}" })
  end

  def trabajos_nuevos(antes, despues)
    formato(despues.filter_map { |clase, n| "#{clase}:#{n - antes[clase]}" if n > antes[clase] })
  end

  def igual(a, b)
    (a.to_f - b.to_f).abs < 0.001 ? 'si' : 'no'
  end

  def preparar(out:, estado:)
    hecho = ->(k, v) { out.puts "HECHO #{k}=#{v}" }
    marca = SecureRandom.hex(4)
    cuenta = Account.create!(name: "SINT Cuenta Archivo #{marca}")
    clave = "#{SecureRandom.hex(12)}Aa1!"
    admin = User.new(name: 'SINT Admin', email: "sint.admin.#{marca}@example.test", password: clave,
                     password_confirmation: clave)
    admin.skip_confirmation!
    admin.save!
    AccountUser.create!(account: cuenta, user: admin, role: :administrator)
    # Un agente sin rol de administrador: solo ve y busca en las bandejas de las que es miembro.
    agente = User.new(name: 'SINT Agente', email: "sint.agente.#{marca}@example.test", password: clave,
                      password_confirmation: clave)
    agente.skip_confirmation!
    agente.save!
    AccountUser.create!(account: cuenta, user: agente, role: :agent)
    viva = Inbox.create!(account: cuenta, name: 'SINT WhatsApp', channel: Channel::Api.create!(account: cuenta))
    con_webhook = Inbox.create!(account: cuenta, name: 'SINT Con webhook',
                                channel: Channel::Api.create!(account: cuenta, webhook_url: 'https://studio.prueba.test/api'))
    Webhook.create!(account: cuenta, url: "https://studio.prueba.test/hook/#{marca}",
                    subscriptions: %w[conversation_created conversation_status_changed conversation_updated
                                      message_created message_updated contact_created contact_updated])
    x1 = Contact.create!(account: cuenta, name: 'SINT-NOMBRE-X1', phone_number: '+584120000001')
    x2 = Contact.create!(account: cuenta, name: 'SINT-NOMBRE-X2', email: 'sint.existente@example.test')
    ci = ContactInbox.create!(contact: x1, inbox: viva, source_id: "sint-x1-#{marca}")
    antes = cola
    conv = Conversation.create!(account: cuenta, inbox: viva, contact: x1, contact_inbox: ci)
    conv.messages.create!(account: cuenta, inbox: viva, message_type: :incoming, content: 'SINT-EXISTENTE', sender: x1)
    # Control: crear con los modelos SÍ encola trabajos. Si diera 0, la medida de E-3 no vería nada.
    hecho.call('control_cola', cola - antes)
    base = { 'inicio' => Time.now.to_f, 'cuenta' => cuenta.id, 'admin' => admin.id, 'agente' => agente.id, 'viva' => viva.id, 'con_webhook' => con_webhook.id,
             'x1' => x1.id, 'x2' => x2.id, 'conv' => conv.id, 'conv_updated' => conv.reload.updated_at.to_f,
             'x1_updated' => x1.reload.updated_at.to_f, 'x2_updated' => x2.reload.updated_at.to_f,
             'mensajes_vivos' => Message.where(inbox_id: viva.id).count,
             'contactos' => Contact.where(account_id: cuenta.id).count, 'cola' => cola }
    File.write(estado, JSON.generate(base))
    hecho.call('cuenta', cuenta.id)
    hecho.call('con_webhook', con_webhook.id)
    hecho.call('preparar', 'ok')
    base
  end

  def verificar(out:, estado:, bandeja:)
    hecho = ->(k, v) { out.puts "HECHO #{k}=#{v}" }
    medir = lambda do |k, &bloque|
      hecho.call(k, bloque.call)
    rescue StandardError => e
      hecho.call(k, "error:#{e.class}")
    end
    b = JSON.parse(File.read(estado))
    archivo = Integer(bandeja)
    cuenta = b['cuenta']
    convs = Conversation.where(inbox_id: archivo)
    msgs = Message.where(inbox_id: archivo)

    # E-4 y E-5: la cola, antes de que esta sonda cree nada. prueba-cargador.sh la compara con la cola justo
    # después de crear la bandeja: es la línea base de la carga, separada de la de la creación.
    hecho.call('cola_actual', cola)
    hecho.call('trabajos_actuales', trabajos_por_clase)
    hecho.call('cola_delta', cola - b['cola'])
    hecho.call('con_webhook_conversaciones', Conversation.where(inbox_id: b['con_webhook']).count)

    # 5.5b: los adjuntos. Cada uno en su mensaje, con su tipo, el archivo íntegro en el almacenamiento, y ningún
    # huérfano: ni blobs sin adjunto, ni archivos sin blob, ni blobs sin archivo.
    adjs = Attachment.joins(:message).where(messages: { inbox_id: archivo })
    hecho.call('adjuntos_archivo', adjs.count)
    medir.call('adjuntos_por_tipo') { adjs.group(:file_type).count.map { |t, n| "#{t}:#{n}" }.sort.join(',') }
    medir.call('adjuntos_en_su_mensaje') do
      fuentes = adjs.joins(:message).pluck('messages.source_id')
      fuentes.sort == %w[kommo:m5 kommo:m6 kommo:m8] ? 'si' : "no:#{fuentes.size}"
    end
    medir.call('adjuntos_integros') do
      adjs.to_a.count { |a| a.file.attached? && Digest::MD5.base64digest(a.file.download) == a.file.blob.checksum }
    end
    medir.call('adjuntos_analizados') { adjs.to_a.count { |a| a.file.attached? && a.file.blob.analyzed? } }
    # Solo lo creado desde la línea base de este escenario: los escenarios de mutantes comparten base y almacenamiento.
    desde = Time.zone.at(b['inicio'].to_f)
    nuevos = ActiveStorage::Blob.where('active_storage_blobs.created_at >= ?', desde)
    hecho.call('blobs_huerfanos', nuevos.left_joins(:attachments).where(active_storage_attachments: { id: nil }).count)
    medir.call('archivos_sin_blob') do
      raiz = ActiveStorage::Blob.service.root
      claves = ActiveStorage::Blob.pluck(:key).to_set
      Dir.glob(File.join(raiz, '**', '*')).count do |f|
        File.file?(f) && File.mtime(f) >= desde - 1 && !claves.include?(File.basename(f))
      end
    end
    medir.call('blobs_sin_archivo') { nuevos.to_a.count { |bl| !bl.service.exist?(bl.key) } }

    # E-6: lo cargado.
    hecho.call('conversaciones', convs.count)
    hecho.call('mensajes', msgs.count)
    hecho.call('entrantes', msgs.where(message_type: :incoming).count)
    hecho.call('salientes', msgs.where(message_type: :outgoing).count)
    hecho.call('resueltas', convs.where(status: :resolved).count)
    hecho.call('historicas', convs.where('created_at < ?', 400.days.ago).count)
    hecho.call('mensajes_historicos', msgs.where('created_at < ?', 400.days.ago).count)
    medir.call('autores') { msgs.where(message_type: :outgoing).map { |m| m.content_attributes['kommo_autor'] }.compact.sort.join('|') }
    hecho.call('json_conv', convs.where("jsonb_typeof(additional_attributes::jsonb) <> 'object'").count)
    # Un scope de Chatwoot que lee content_attributes en SQL: tiene que funcionar sobre lo cargado.
    medir.call('no_reenviados') { msgs.not_forwarded.count }
    if Message.column_names.include?('processed_message_content')
      hecho.call('procesado_faltante', msgs.where.not(content: nil).where(processed_message_content: nil).count)
    else
      hecho.call('procesado_faltante', 'sin_columna')
    end
    medir.call('no_leidos') { convs.to_a.sum { |c| c.unread_incoming_messages.count } }

    # E-9: sin huérfanos, sin cruces y sin personas duplicadas.
    hecho.call('huerfanos_mensaje', msgs.where.not(conversation_id: Conversation.select(:id)).count)
    hecho.call('huerfanos_conversacion', convs.where.not(contact_id: Contact.select(:id)).count)
    hecho.call('sin_contact_inbox', convs.where(contact_inbox_id: nil).count)
    hecho.call('contact_inbox_cruzado', convs.joins('JOIN contact_inboxes ci ON ci.id = conversations.contact_inbox_id')
                                             .where('ci.contact_id <> conversations.contact_id OR ci.inbox_id <> conversations.inbox_id').count)
    hecho.call('remitente_cruzado', msgs.where(message_type: :incoming).joins(:conversation)
                                        .where("messages.sender_type IS DISTINCT FROM 'Contact' OR messages.sender_id IS DISTINCT FROM conversations.contact_id").count)
    hecho.call('tel_x1', Contact.where(account_id: cuenta, phone_number: '+584120000001').count)
    hecho.call('correo_x2', Contact.where(account_id: cuenta).where('LOWER(email) = ?', 'sint.existente@example.test').count)
    hecho.call('tel_grupo', Contact.where(account_id: cuenta, phone_number: '+584120000002').count)
    talk = ->(tid) { convs.where("additional_attributes->>'kommo_talk_id' = ?", tid.to_s).pick(:contact_id) }
    hecho.call('x1_reusado', talk.call(2001) == b['x1'] ? 'si' : 'no')
    hecho.call('x2_reusado', talk.call(2003) == b['x2'] ? 'si' : 'no')
    hecho.call('grupo_unido', Contact.where(id: talk.call(2002)).pick(:identifier) == 'kommo:1002' ? 'si' : 'no')
    hecho.call('sin_contacto', convs.joins(:contact).where(contacts: { identifier: 'kommo:sin-contacto' }).count)
    hecho.call('contactos_nuevos', Contact.where(account_id: cuenta).count - b['contactos'])

    # E-11: lo que ya existía no cambió.
    hecho.call('conv_viva_intacta', igual(Conversation.find(b['conv']).updated_at, b['conv_updated']))
    hecho.call('x1_intacto', igual(Contact.find(b['x1']).updated_at, b['x1_updated']))
    hecho.call('x2_intacto', igual(Contact.find(b['x2']).updated_at, b['x2_updated']))
    hecho.call('mensajes_vivos_delta', Message.where(inbox_id: b['viva']).count - b['mensajes_vivos'])

    # E-10: búsqueda. ILIKE directo y el buscador de Chatwoot con un administrador.
    hecho.call('ilike_reciente', msgs.where('content ILIKE ?', '%SINTBUSCAR%').count)
    hecho.call('ilike_viejo', msgs.where('content ILIKE ?', '%SINTVIEJO%').count)
    admin = User.find(b['admin'])
    cuenta_ar = Account.find(cuenta)
    # SearchService lee Current (User#assigned_inboxes usa Current.account). En una petición lo llenan
    # application_controller.rb:18 y ensure_current_account_helper.rb:6 y :25; aquí se llena igual.
    como_usuario = lambda do |usuario, &bloque|
      Current.user = usuario
      Current.account = cuenta_ar
      Current.account_user = AccountUser.find_by(account_id: cuenta, user_id: usuario.id)
      bloque.call
    ensure
      Current.user = nil
      Current.account = nil
      Current.account_user = nil
    end
    como_en_la_api = ->(&bloque) { como_usuario.call(admin, &bloque) }
    buscar = lambda do |q|
      como_en_la_api.call do
        r = SearchService.new(current_user: admin, current_account: cuenta_ar, search_type: 'Message', params: { q: q }).perform
        Array(r[:messages]).size
      end
    end
    medir.call('buscador_reciente') { buscar.call('SINTBUSCAR') }
    medir.call('buscador_viejo') { buscar.call('SINTVIEJO') }
    # E-10c: el buscador de mensajes solo mira SEARCH_TIME_RANGE_LIMIT_DAYS días (90 por defecto,
    # lib/limits.rb). Opción 1: subir esa ventana. Limits la lee de ENV en cada búsqueda; se cambia solo en este
    # proceso y se restaura.
    medir.call('buscador_viejo_ventana_1100') do
      previa = ENV.fetch('SEARCH_TIME_RANGE_LIMIT_DAYS', nil)
      ENV['SEARCH_TIME_RANGE_LIMIT_DAYS'] = '1100'
      buscar.call('SINTVIEJO')
    ensure
      previa.nil? ? ENV.delete('SEARCH_TIME_RANGE_LIMIT_DAYS') : ENV['SEARCH_TIME_RANGE_LIMIT_DAYS'] = previa
    end
    # E-10d, la opción 1: buscar el Archivo por la persona y por el número. La búsqueda de conversaciones
    # (search_service.rb:33-38) no tiene ventana de fechas. Se busca la conversación del Archivo de hace 500 días
    # (Kommo 2001, contacto X1 reusado) con la ventana por defecto, la de producción.
    vieja = convs.where("additional_attributes->>'kommo_talk_id' = '2001'").first
    hecho.call('conv_vieja_antigua', vieja && vieja.created_at < 400.days.ago ? 'si' : 'no')
    encuentra_vieja = lambda do |q, usuario = admin|
      como_usuario.call(usuario) do
        r = SearchService.new(current_user: usuario, current_account: cuenta_ar, search_type: 'Conversation',
                              params: { q: q }).perform
        Array(r[:conversations]).any? { |c| c.id == vieja&.id } ? 'si' : 'no'
      end
    end
    medir.call('conv_vieja_por_nombre') { encuentra_vieja.call('SINT-NOMBRE-X1') }
    medir.call('conv_vieja_por_telefono') { encuentra_vieja.call('4120000001') }
    medir.call('conv_vieja_por_numero') { encuentra_vieja.call(vieja&.display_id.to_s) }

    # E-10e: un agente sin rol de administrador solo busca en las bandejas de las que es miembro
    # (User#assigned_inboxes). El Archivo nace sin miembros: sin serlo no lo encuentra; siendo miembro, sí.
    agente = User.find(b['agente'])
    tres = ->(usuario) do
      { 'nombre' => 'SINT-NOMBRE-X1', 'telefono' => '4120000001', 'numero' => vieja&.display_id.to_s }
        .map { |k, q| "#{k}:#{encuentra_vieja.call(q, usuario)}" }.join(',')
    end
    medir.call('agente_sin_ser_miembro') { tres.call(agente) }
    # E-10f: agregarlo como miembro igual que el panel (inbox_members_controller.rb:15 → Inbox#add_members).
    # Se mide lo que encola, las notificaciones y que las conversaciones sigan resueltas y sin asignar.
    medir.call('miembros_trabajos') do
      antes = clases_en_cola
      notificaciones = Notification.count
      Inbox.find(archivo).add_members([agente.id])
      hecho.call('miembros_notificaciones', Notification.count - notificaciones)
      trabajos_nuevos(antes, clases_en_cola)
    end
    hecho.call('miembros_del_archivo', InboxMember.where(inbox_id: archivo).count)
    hecho.call('miembros_asignadas', convs.where.not(assignee_id: nil).count)
    hecho.call('miembros_resueltas', convs.where(status: :resolved).count)
    medir.call('agente_miembro') { tres.call(agente) }

    # E-8: números de conversación. Una conversación nueva, creada como la crearía el canal, va después.
    max_archivo = convs.maximum(:display_id).to_i
    ci = ContactInbox.find_by(contact_id: b['x1'], inbox_id: b['viva'])
    nueva = Conversation.create!(account_id: cuenta, inbox_id: b['viva'], contact_id: b['x1'], contact_inbox: ci)
    hecho.call('display_nueva_mayor', nueva.display_id > max_archivo ? 'si' : 'no')
    hecho.call('display_duplicados', Conversation.where(account_id: cuenta).group(:display_id).having('count(*) > 1').count.size)
    hecho.call('display_nulos', Conversation.where(account_id: cuenta, display_id: nil).count)
    orden = convs.order(:display_id).map { |c| c.created_at.to_i }
    hecho.call('display_en_orden', orden == orden.sort ? 'si' : 'no')

    # E-6: content_attributes queda guardado igual que lo guarda Chatwoot con sus modelos. Chatwoot lo
    # serializa como texto JSON dentro de la columna json (de ahí su scope `#>> '{}'`), así que no se compara
    # contra «objeto» sino contra dos mensajes de referencia creados con el modelo, uno con atributos y otro
    # sin ellos. Va al final: crearlos encola trabajos y toca la conversación viva.
    medir.call('json_msg_como_chatwoot') do
      tipo = Arel.sql('json_typeof(content_attributes::json)')
      viva = Conversation.find(b['conv'])
      lleno = viva.messages.create!(account_id: cuenta, inbox_id: b['viva'], message_type: :outgoing,
                                    content: 'SINT-REFERENCIA', content_attributes: { 'kommo_autor' => 'SINT' })
      vacio = viva.messages.create!(account_id: cuenta, inbox_id: b['viva'], message_type: :incoming,
                                    content: 'SINT-REFERENCIA', sender: Contact.find(b['x1']))
      ref_lleno = Message.where(id: lleno.id).pick(tipo)
      ref_vacio = Message.where(id: vacio.id).pick(tipo)
      salientes = msgs.where(message_type: :outgoing).pluck(tipo).uniq
      entrantes = msgs.where(message_type: :incoming).pluck(tipo).uniq
      ok = salientes == [ref_lleno] && entrantes == [ref_vacio]
      "#{ok ? 'si' : 'no'}:salientes=#{salientes.inspect},ref=#{ref_lleno.inspect};entrantes=#{entrantes.inspect},ref=#{ref_vacio.inspect}"
    end
    hecho.call('verificar', 'ok')
  end
end

module SondaCargador
  module_function

  # 5.5b: que Chatwoot sirva los adjuntos del Archivo por su API, como los ve el panel. Un agente miembro del Archivo
  # (lo agrega `verificar`, E-10f) pide los mensajes de cada conversación con adjuntos y baja cada `data_url`,
  # siguiendo las redirecciones de ActiveStorage, desde el servicio `rails` de la prueba. Un agente que no es
  # miembro no tiene que poder pedirlos. Solo datos inventados.
  def servir(out:, estado:, bandeja:)
    require 'net/http'
    hecho = ->(k, v) { out.puts "HECHO #{k}=#{v}" }
    b = JSON.parse(File.read(estado))
    host = URI(ENV.fetch('FRONTEND_URL')).host
    http = Net::HTTP.new('rails', 3000)
    http.read_timeout = 30
    pedir = lambda do |ruta, token = nil|
      req = Net::HTTP::Get.new(ruta)
      req['Host'] = host
      req['api_access_token'] = token if token
      http.request(req)
    end
    listo = (1..60).any? do
      ok = begin
        pedir.call('/health').code == '200'
      rescue StandardError
        false
      end
      sleep 3 unless ok
      ok
    end
    hecho.call('rails_responde', listo ? 'si' : 'no')
    descargar = lambda do |url|
      5.times do
        r = pedir.call(URI(url).request_uri)
        return r.body if r.code == '200'
        return nil unless r['location']

        url = URI.join("http://#{host}", r['location']).to_s
      end
      nil
    end
    token_de = ->(u) { (u.access_token || AccessToken.create!(owner: u)).token }
    agente = User.find(b['agente'])
    clave = "#{SecureRandom.hex(12)}Aa1!"
    ajeno = User.new(name: 'SINT Ajeno', email: "sint.ajeno.#{SecureRandom.hex(4)}@example.test", password: clave,
                     password_confirmation: clave)
    ajeno.skip_confirmation!
    ajeno.save!
    AccountUser.create!(account_id: b['cuenta'], user: ajeno, role: :agent)
    convs = Conversation.where(inbox_id: Integer(bandeja), id: Message.where(id: Attachment.select(:message_id)).select(:conversation_id))
    total = 0
    servidos = 0
    ajeno_codigos = []
    miniaturas = []
    # Lo que encola Chatwoot al servir: pedir los mensajes, bajar cada original y, para las imágenes, la miniatura
    # que muestra el panel (thumb_url, una variante de ActiveStorage que se genera al primer pedido).
    cola_antes = clases_en_cola
    variantes_antes = defined?(ActiveStorage::VariantRecord) ? ActiveStorage::VariantRecord.count : 0
    convs.each do |c|
      ruta = "/api/v1/accounts/#{c.account_id}/conversations/#{c.display_id}/messages"
      r = pedir.call(ruta, token_de.call(agente))
      Array(JSON.parse(r.body)['payload']).each do |m|
        Array(m['attachments']).each do |a|
          total += 1
          datos = descargar.call(a['data_url'].to_s)
          blob = Attachment.find(a['id']).file.blob
          servidos += 1 if datos && Digest::MD5.base64digest(datos) == blob.checksum
          next unless a['file_type'] == 'image'

          mini = a['thumb_url'].to_s.empty? ? nil : descargar.call(a['thumb_url'].to_s)
          miniaturas << (mini && !mini.empty? ? 'si' : 'no')
        end
      end
      ajeno_codigos << pedir.call(ruta, token_de.call(ajeno)).code
    end
    hecho.call('servidos', "#{servidos}/#{total}")
    hecho.call('ajeno_codigos', ajeno_codigos.uniq.sort.join(','))
    hecho.call('miniaturas', miniaturas.empty? ? 'ninguna' : miniaturas.join(','))
    hecho.call('variantes_nuevas', (defined?(ActiveStorage::VariantRecord) ? ActiveStorage::VariantRecord.count : 0) - variantes_antes)
    hecho.call('trabajos_al_servir', trabajos_nuevos(cola_antes, clases_en_cola))
    hecho.call('servir', 'ok')
  rescue StandardError => e
    out.puts "HECHO servir=error:#{e.class}"
  end
end

case ENV['FASE']
when 'servir'
  SondaCargador.servir(out: $stdout, estado: ENV.fetch('ESTADO', '/tmp/estado/base.json'), bandeja: ENV.fetch('BANDEJA'))
when 'preparar'
  SondaCargador.preparar(out: $stdout, estado: ENV.fetch('ESTADO', '/tmp/estado/base.json'))
when 'verificar'
  SondaCargador.verificar(out: $stdout, estado: ENV.fetch('ESTADO', '/tmp/estado/base.json'), bandeja: ENV.fetch('BANDEJA'))
end
