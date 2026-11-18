# frozen_string_literal: true

# infra/ops/portal-historial/pruebas/guardas-deshacer.rb — las guardas de deshacer-carga.rb, de a una (N2 de la revisión
# del DG sobre b2508e726, SDD-0586 10.7, PR 2c). Solo datos inventados. Corre con `rails runner` en el servicio
# `prepare` de prueba-deshacer.sh, un solo arranque de Rails para todos los casos.
#
# Carga el guion como biblioteca (GUION, la copia de la carpeta que se prueba: la real o la de un mutante) y corre cada
# caso con DeshacerPortal.principal dentro de una transacción que siempre termina en ROLLBACK: la preparación (filas de
# mentira en la bandeja, una bandeja cambiada) y lo que haga el guion se deshacen, aunque un mutante deje pasar algo.
# El guion abre su propia transacción, que se une a la de afuera.
#
#   R1  BANDEJA que no existe en la cuenta            R6  un contact_inbox de la bandeja de un contacto de otra cuenta
#   R2  la bandeja no es de canal API                 R7  un contacto de la bandeja que no es dtd-portal:<uuid>
#   R3  la bandeja tiene webhook_url                  R8  (borrar) los conservados sin cabecera
#   R4  la bandeja no se llama «Conversaciones…»      R9  (borrar) una línea de tipo desconocido
#   R5  el candado de la carga tomado por otra sesión R10 (borrar) la cabecera no cuadra con las líneas
#   A1-A9  una fila en cada tabla de actividad que la carga no crea (la de notes ya la prueba D1g)
#
# Salida: `HECHO caso_<id>=<el error del guion | ok>`; para lo ajeno, `ajeno actividad=<n>`. Solo ids y conteos.

require 'json'
require 'securerandom'
require 'stringio'

DESHACER_PORTAL_COMO_BIBLIOTECA = true
load ENV.fetch('GUION')

CUENTA = Integer(ENV.fetch('CUENTA'), 10)
BANDEJA = Integer(ENV.fetch('BANDEJA'), 10)
TENANT = ENV.fetch('TENANT')
CON = ActiveRecord::Base.connection

def env_seco(bandeja = BANDEJA)
  { 'MODO' => 'seco', 'TENANT' => TENANT, 'CUENTA' => CUENTA.to_s, 'BANDEJA' => bandeja.to_s, 'CONSERVADOS' => '-' }
end

def env_borrar
  { 'MODO' => 'borrar', 'TENANT' => TENANT, 'CUENTA' => CUENTA.to_s, 'BANDEJA' => BANDEJA.to_s, 'CONFIRMAR' => 'no' }
end

# El resultado del guion: el error que imprimió, «ajeno actividad=<n>» si fue lo ajeno, u «ok».
def correr(env, entrada = '')
  salida = StringIO.new
  DeshacerPortal.principal(env, entrada: StringIO.new(entrada), salida: salida)
  lineas = salida.string.lines.map(&:strip)
  error = lineas.grep(/\AHECHO error=/).last&.delete_prefix('HECHO error=')
  return 'ok' unless error
  return error unless error.start_with?('algo ajeno en la bandeja')

  "ajeno actividad=#{lineas.grep(/\AHECHO ajeno_actividad=/).last&.delete_prefix('HECHO ajeno_actividad=')}"
end

def caso(id)
  resultado = nil
  ActiveRecord::Base.transaction do
    resultado = yield
    raise ActiveRecord::Rollback
  end
  puts "HECHO caso_#{id}=#{resultado}"
rescue StandardError => e
  puts "HECHO caso_#{id}=preparacion:#{e.class.name}"
end

# Una conversación cargada de mentira, como las del cargador: el contacto dtd-portal:<uuid>, su contact_inbox, la
# conversación con dtd_hilo y un mensaje dtd:. Devuelve los ids.
def base
  ahora = Time.zone.now
  u = SecureRandom.uuid
  contacto = Contact.create!(account_id: CUENTA, name: 'SINT guardas', identifier: "dtd-portal:#{u}")
  ci = ContactInbox.create!(contact: contacto, inbox_id: BANDEJA, source_id: "dtd-portal:#{u}")
  Conversation.insert_all([{ account_id: CUENTA, inbox_id: BANDEJA, contact_id: contacto.id, contact_inbox_id: ci.id,
                             status: 0, additional_attributes: { 'dtd_hilo' => u }, created_at: ahora,
                             updated_at: ahora, last_activity_at: ahora }])
  conv = Conversation.where(inbox_id: BANDEJA).where("additional_attributes->>'dtd_hilo' = ?", u).pick(:id)
  Message.insert_all([{ account_id: CUENTA, inbox_id: BANDEJA, conversation_id: conv, message_type: 1,
                        content: 'SINT guardas', private: false, status: 0, source_id: "dtd:#{SecureRandom.uuid}",
                        content_attributes: {}, created_at: ahora, updated_at: ahora }])
  mensaje = Message.where(conversation_id: conv).pick(:id)
  { 'contactos' => contacto.id, 'conversaciones' => conv, 'mensajes' => mensaje }
end

# Una fila en una tabla de Chatwoot: los valores fijos, y para cada columna obligatoria sin valor por defecto, uno de
# mentira (una fila existente si es una llave foránea).
def existente(tabla, prof)
  CON.select_value("SELECT id FROM #{CON.quote_table_name(tabla)} ORDER BY id LIMIT 1") ||
    (prof < 2 ? fila(tabla, {}, prof + 1) : raise("sin fila para #{tabla}"))
end

def fila(tabla, fijos, prof = 0)
  ahora = Time.zone.now
  columnas = CON.columns(tabla)
  nombres = columnas.map(&:name)
  usuario = CON.select_value('SELECT user_id FROM account_users WHERE account_id = ' + CUENTA.to_s + ' ORDER BY user_id LIMIT 1')
  fijos = { 'account_id' => CUENTA, 'user_id' => usuario }.select { |k, _| nombres.include?(k) }.merge(fijos)
  fks = CON.foreign_keys(tabla).to_h { |fk| [fk.column, fk.to_table] }
  valores = {}
  columnas.each do |col|
    next if col.name == 'id'
    next valores[col.name] = fijos[col.name] if fijos.key?(col.name)
    next if col.null || !col.default.nil? || col.default_function

    valores[col.name] =
      if fks[col.name] then existente(fks[col.name], prof)
      else
        case col.type
        when :integer, :bigint, :float, :decimal then 0
        when :datetime, :timestamp, :date, :time then ahora
        when :boolean then false
        when :jsonb, :json then '{}'
        when :uuid then SecureRandom.uuid
        else "sint-#{SecureRandom.hex(4)}"
        end
      end
  end
  cols = valores.keys
  CON.select_value("INSERT INTO #{CON.quote_table_name(tabla)} (#{cols.map { |c| CON.quote_column_name(c) }.join(', ')}) " \
                   "VALUES (#{cols.map { |c| CON.quote(valores[c]) }.join(', ')}) RETURNING id")
end

caso('R1') { correr(env_seco(Inbox.maximum(:id).to_i + 1000)) }
caso('R2') do
  Inbox.where(id: BANDEJA).update_all(channel_type: 'Channel::WebWidget')
  correr(env_seco)
end
caso('R3') do
  Channel::Api.where(id: Inbox.where(id: BANDEJA).pick(:channel_id)).update_all(webhook_url: 'https://sint.test/hook')
  correr(env_seco)
end
caso('R4') do
  Inbox.where(id: BANDEJA).update_all(name: 'SINT otro nombre')
  correr(env_seco)
end
caso('R5') do
  otra = ActiveRecord::Base.connection_pool.checkout
  begin
    otra.execute("SELECT pg_advisory_lock(#{DeshacerPortal::CANDADO})")
    correr(env_seco)
  ensure
    otra.execute("SELECT pg_advisory_unlock(#{DeshacerPortal::CANDADO})")
    ActiveRecord::Base.connection_pool.checkin(otra)
  end
end
caso('R6') do
  ahora = Time.zone.now
  otra_cuenta = Account.create!(name: 'SINT otra cuenta')
  x = Contact.create!(account_id: otra_cuenta.id, name: 'SINT otra cuenta', identifier: "dtd-portal:#{SecureRandom.uuid}")
  ContactInbox.insert_all([{ contact_id: x.id, inbox_id: BANDEJA, source_id: "dtd-portal:#{SecureRandom.uuid}",
                             created_at: ahora, updated_at: ahora }])
  correr(env_seco)
end
caso('R7') do
  x = Contact.create!(account_id: CUENTA, name: 'SINT sin prefijo', identifier: "sint-#{SecureRandom.hex(4)}")
  ContactInbox.create!(contact: x, inbox_id: BANDEJA, source_id: "dtd-portal:#{SecureRandom.uuid}")
  correr(env_seco)
end
cabecera = ->(n) { JSON.generate(tipo: 'cabecera', version: 1, tenant_id: TENANT, cuenta: CUENTA, bandeja: BANDEJA, contactos: n) }
caso('R8') { correr(env_borrar, "#{JSON.generate(tipo: 'contacto')}\n") }
caso('R9') { correr(env_borrar, "#{cabecera.call(1)}\n#{JSON.generate(tipo: 'otro')}\n") }
caso('R10') do
  correr(env_borrar, "#{cabecera.call(2)}\n#{JSON.generate(tipo: 'contacto', identificador: SecureRandom.uuid, contacto_id: 1)}\n")
end

# Lo ajeno, una tabla por caso: [id, tabla, fijos] a partir de los ids de la conversación de mentira.
[
  ['A1', 'attachments', ->(b) { { 'message_id' => b['mensajes'] } }],
  ['A2', 'mentions', ->(b) { { 'conversation_id' => b['conversaciones'], 'mentioned_at' => Time.zone.now } }],
  ['A3', 'conversation_participants', ->(b) { { 'conversation_id' => b['conversaciones'] } }],
  ['A4', 'reporting_events', ->(b) { { 'conversation_id' => b['conversaciones'] } }],
  ['A5', 'csat_survey_responses', lambda { |b|
    { 'conversation_id' => b['conversaciones'], 'message_id' => b['mensajes'], 'contact_id' => b['contactos'] }
  }],
  ['A6', 'notifications', ->(b) { { 'primary_actor_type' => 'Conversation', 'primary_actor_id' => b['conversaciones'] } }],
  ['A7', 'taggings', ->(b) { { 'taggable_type' => 'Conversation', 'taggable_id' => b['conversaciones'] } }],
  ['A8', 'taggings', ->(b) { { 'taggable_type' => 'Contact', 'taggable_id' => b['contactos'] } }],
  ['A9', 'active_storage_attachments', ->(b) { { 'record_type' => 'Contact', 'record_id' => b['contactos'] } }]
].each do |id, tabla, fijos|
  caso(id) do
    b = base
    fila(tabla, fijos.call(b))
    correr(env_seco)
  end
end
puts 'HECHO guardas=ok'
