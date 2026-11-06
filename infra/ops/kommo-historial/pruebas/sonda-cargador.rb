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
  def trabajos_por_clase
    cuenta = Hash.new(0)
    [*Sidekiq::Queue.all, Sidekiq::ScheduledSet.new, Sidekiq::RetrySet.new].each do |c|
      c.each do |trabajo|
        evento = Array(trabajo.display_args).find { |a| a.is_a?(String) && a.match?(/\A[a-z_]+(\.[a-z_]+)+\z/) }
        cuenta[evento ? "#{trabajo.display_class}(#{evento})" : trabajo.display_class] += 1
      end
    end
    lista = cuenta.map { |clase, n| "#{clase}:#{n}" }.sort
    lista.empty? ? 'ninguno' : lista.join(',')
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
    base = { 'cuenta' => cuenta.id, 'admin' => admin.id, 'viva' => viva.id, 'con_webhook' => con_webhook.id,
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
    como_en_la_api = lambda do |&bloque|
      Current.user = admin
      Current.account = cuenta_ar
      Current.account_user = AccountUser.find_by(account_id: cuenta, user_id: admin.id)
      bloque.call
    ensure
      Current.user = nil
      Current.account = nil
      Current.account_user = nil
    end
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
    encuentra_vieja = lambda do |q|
      como_en_la_api.call do
        r = SearchService.new(current_user: admin, current_account: cuenta_ar, search_type: 'Conversation',
                              params: { q: q }).perform
        Array(r[:conversations]).any? { |c| c.id == vieja&.id } ? 'si' : 'no'
      end
    end
    medir.call('conv_vieja_por_nombre') { encuentra_vieja.call('SINT-NOMBRE-X1') }
    medir.call('conv_vieja_por_telefono') { encuentra_vieja.call('4120000001') }
    medir.call('conv_vieja_por_numero') { encuentra_vieja.call(vieja&.display_id.to_s) }

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

case ENV['FASE']
when 'preparar'
  SondaCargador.preparar(out: $stdout, estado: ENV.fetch('ESTADO', '/tmp/estado/base.json'))
when 'verificar'
  SondaCargador.verificar(out: $stdout, estado: ENV.fetch('ESTADO', '/tmp/estado/base.json'), bandeja: ENV.fetch('BANDEJA'))
end
