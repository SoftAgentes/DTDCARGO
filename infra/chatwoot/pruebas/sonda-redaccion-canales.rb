# frozen_string_literal: true

# Sonda de la redacción de las líneas de los canales (SDD-0583, seguimiento del 2026-11-05).
# La corre prueba-redaccion-canales.sh con `rails runner` en el servicio `prepare`, que vive
# solo en la red `interna` (internal: true): no hay salida a Meta. Solo valores inventados.
#
# Ejercita las líneas de la imagen, no copias:
#   · por su camino real: el job de Instagram, el envío fallido, los acuses de Messenger, el
#     evento de WhatsApp con error y los dos webhooks de Meta, con `Rack::MockRequest`.
#   · el resto necesita una campaña o una carrera: se lee la línea de la imagen por su texto y
#     se ejecuta con valores inventados. Si una versión nueva cambia el texto, sale
#     `HECHO falta=` y la prueba queda en rojo.
#
# Imprime una línea `HECHO clave=valor` por medición. El veredicto lo da el script.

Persona = Struct.new(:id, :name, :phone_number, :account_id, :contact_id, keyword_init: true)

class Caja
  def initialize(variables)
    @__locales = {}
    variables.each do |clave, valor|
      if clave.to_s.start_with?('@')
        instance_variable_set(clave, valor)
      else
        @__locales[clave] = valor
      end
    end
  end

  def correr(fuente)
    caja = binding
    @__locales.each { |clave, valor| caja.local_variable_set(clave, valor) }
    caja.eval(fuente) # rubocop:disable Security/Eval
  end
end

def correr_linea(archivo, fragmento, antes: 0, despues: 0, **variables)
  lineas = File.readlines(Rails.root.join(archivo))
  indice = lineas.index { |linea| linea.include?(fragmento) }
  if indice.nil?
    puts "HECHO falta=#{archivo}"
    return nil
  end

  Caja.new(variables).correr(lineas[(indice - antes)..(indice + despues)].join)
end

# ── Instagram ───────────────────────────────────────────────────────────────
evento = {
  sender: { id: 'SINT-IG53-REMITENTE' }, recipient: { id: 'SINT-IG53-DESTINO' }, timestamp: 1,
  message: { mid: 'SINT-IG53-MID', text: 'SINT-IG53-TEXTO' }
}
Webhooks::InstagramEventsJob.new.process_entries([{ id: '1', time: 1, messaging: [evento] }])

prueba_meta = {
  sender: { id: 'SINT-IGTEST-REMITENTE' }, recipient: { id: 'SINT-IGTEST-DESTINO' }, timestamp: '1',
  message: { mid: 'SINT-IGTEST-MID', text: 'SINT-IGTEST-TEXTO' }
}
Webhooks::InstagramEventsJob.new.process_entries([{ id: '0', time: 1, changes: [{ field: 'messages', value: prueba_meta }] }])

Messages::StatusUpdateService.class_eval do
  def perform; end
end
respuesta = Struct.new(:parsed_response) { def success? = false }
            .new({ 'error' => { 'message' => 'Error sintetico de Meta', 'code' => 100 } })
Instagram::BaseSendService.allocate.send(
  :process_response, respuesta,
  { recipient: { id: 'SINT-IG65-DESTINO' }, message: { text: "SINT-IG65-TEXTO\ncon un salto de línea" } }
)

inbox = Persona.new(id: 5, account_id: 1)
correr_linea('app/services/instagram/message_text.rb', 'ig_scope_id #{ig_scope_id}',
             :@inbox => inbox, ig_scope_id: '9900000000067')
excepcion = correr_linea('app/services/instagram/message_text.rb', 'IG Scope ID: #{ig_scope_id}',
                         error_message: 'Error sintetico', error_code: 1, ig_scope_id: '9900000000070')
ChatwootExceptionTracker.new(excepcion).capture_exception if excepcion

# ── Messenger ───────────────────────────────────────────────────────────────
Facebook::Messenger::Bot.receive(
  'sender' => { 'id' => 'SINT-FB-ACUSE-REMITENTE' }, 'recipient' => { 'id' => '1' }, 'timestamp' => 1,
  'delivery' => { 'mids' => ['m'], 'watermark' => 1, 'seq' => 1 }
)
Facebook::Messenger::Bot.receive(
  'sender' => { 'id' => 'SINT-FB-LEIDO-REMITENTE' }, 'recipient' => { 'id' => '1' }, 'timestamp' => 1,
  'read' => { 'watermark' => 1, 'seq' => 1 }
)

# ── WhatsApp ────────────────────────────────────────────────────────────────
Object.new.extend(Whatsapp::IncomingMessageServiceHelpers).send(
  :log_error, { 'errors' => [{ 'title' => 'Titulo sintetico' }], 'from' => '13055550180' }
)

campana = 'app/services/whatsapp/oneoff_campaign_service.rb'
correr_linea(campana, 'Processing contact:', contact: Persona.new(name: 'SINT-CAMP55', phone_number: '13055550155'))
correr_linea(campana, 'no template_params found', contact: Persona.new(name: 'SINT-CAMP64'))
correr_linea(campana, 'liquid variables resolved to blank', contact: Persona.new(name: 'SINT-CAMP86'),
                                                            processed_template_params: nil)
correr_linea(campana, 'Failed to process liquid template params', contact: Persona.new(name: 'SINT-CAMP90'),
                                                                  e: StandardError.new('Error sintetico liquid'))
correr_linea(campana, 'Failed to send WhatsApp template message', to: '13055550114',
                                                                  e: StandardError.new('Error sintetico envio'))

rotacion = 'app/services/whatsapp/user_id_rotation_service.rb'
correr_linea(rotacion, 'already belongs to contact #{conflicting_contact.id}', antes: 1, despues: 2,
             phone_number: '13055550136', conflicting_contact: Persona.new(id: 31),
             contact: Persona.new(id: 32, account_id: 1))
correr_linea(rotacion, 'already belongs to contact #{existing.contact_id}', antes: 1, despues: 2,
             source_id: 'SINT-ROT185', existing: Persona.new(contact_id: 33), inbox: inbox,
             contact: Persona.new(id: 34))

# ── Todos los canales ───────────────────────────────────────────────────────
correr_linea('app/builders/contact_inbox_builder.rb', 'RecordNotUnique #{@source_id}',
             :@source_id => 'SINT-CIB70', :@contact => Persona.new(id: 35), :@inbox => inbox)

# ── Webhooks de Meta: la línea `Parameters:` sale antes de revisar la firma ─────
web = Rack::MockRequest.new(Rails.application)
cabeceras = { 'CONTENT_TYPE' => 'application/json', 'HTTP_HOST' => 'chat.prueba.test' }
instagram = {
  object: 'instagram',
  entry: [{ id: '1', time: 1, messaging: [{
    sender: { id: 'SINT-WEB-IG-REMITENTE' }, recipient: { id: '1' }, timestamp: 1,
    message: { mid: 'm', text: 'SINT-WEB-IG-TEXTO' }
  }] }]
}
whatsapp = {
  object: 'whatsapp_business_account',
  entry: [{ id: '1', changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp',
    metadata: { display_phone_number: '15550001111', phone_number_id: '1' },
    contacts: [{ profile: { name: 'SINT-WEB-WA-NOMBRE' }, wa_id: '13055550190' }],
    statuses: [{ id: 'w', status: 'delivered', timestamp: '1', recipient_id: '13055550191' }],
    messages: [{ from: '13055550192', id: 'w', timestamp: '1', type: 'text', text: { body: 'SINT-WEB-WA-TEXTO' } }]
  } }] }]
}
puts "HECHO web_instagram=#{web.post('/webhooks/instagram', cabeceras.merge(input: instagram.to_json)).status}"
puts "HECHO web_whatsapp=#{web.post('/webhooks/whatsapp/15550001111', cabeceras.merge(input: whatsapp.to_json)).status}"

# ── El resto del log sigue igual ─────────────────────────────────────────────
Rails.logger.info('NORMAL-1 [IMAP::FETCH_EMAIL_SERVICE] Job started for inbox 7')
Rails.logger.warn('NORMAL-2 Skipping campaign recipient contact_id=12: motivo sintetico')
Rails.logger.info('NORMAL-3 Instagram webhook received events')
Rails.logger.error('NORMAL-4 [WHATSAPP] Webhook setup failed: motivo sintetico')

puts 'HECHO sonda=ok'
