# frozen_string_literal: true

# infra/ops/kommo-historial/acta-conteos.rb — SDD-0590 paso 5.8: los conteos del acta de conciliación parcial de E5
# sobre la bandeja «Archivo Kommo», por objeto y por canal de Kommo.
#
# SOLO LECTURA. Todo corre dentro de una transacción que se declara READ ONLY y se deshace al final: si algo
# intentara escribir, Postgres lo rechaza. Imprime solo números y los nombres de canal que trae Kommo (`waba`,
# `instagram_business`…), nunca un nombre, un teléfono, un correo, un texto ni un id de Kommo.
#
# En el VPS lo corre el Director General, solo con el OK nominal de Sam (no lo corre un Worker):
#   docker compose cp …/acta-conteos.rb rails:/tmp/acta-conteos.rb
#   docker compose exec -T -e BANDEJA=8 -e COMPARAR=5.7 rails bundle exec rails runner /tmp/acta-conteos.rb
#
# Variables:
#   BANDEJA   id de la bandeja «Archivo Kommo» (obligatoria; en producción, la 8)
#   CUENTA    cuenta de Chatwoot (1 por defecto)
#   COMPARAR  `5.7`: compara cada objeto con lo que dejó la carga del 2026-11-07 (SDD-0590 §10.16) y escribe
#             «coincide» o «NO COINCIDE»; sin la variable, solo cuenta
# Salida: líneas `HECHO clave=valor` y, con COMPARAR, `CONCILIA clave=… esperado=… coincide|NO COINCIDE`. La última
# es `HECHO acta=ok`, o `HECHO acta=error` con el motivo.
#
# Lo prueba pruebas/prueba-cargador.sh (bloque AC) con datos inventados, sobre la imagen real, con sus mutantes.

# La carga en producción del 2026-11-07, de 10:59:02Z a 11:29:40Z (SDD-0590 §10.16, tabla «Carga en producción»).
ESPERADO_5_7 = {
  'conversaciones' => 4780, 'mensajes' => 54_737, 'entrantes' => 29_099, 'salientes' => 25_638,
  'contact_inboxes' => 4258, 'contactos' => 4258, 'adjuntos' => 3639, 'adjuntos_bytes' => 2_134_541_464,
  'miembros' => 2,
  'conversaciones_sin_contact_inbox' => 0, 'mensajes_fuera_de_conversacion' => 0,
  'source_id_repetidos' => 0, 'talk_id_repetidos' => 0
}.freeze

def hecho(clave, valor) = puts("HECHO #{clave}=#{valor}")
def tabla(h) = h.map { |k, v| "#{k.presence || 'sin_canal'}:#{v}" }.sort.join(',')

def contar(cuenta, bandeja)
  # Sin orden: Chatwoot ordena por defecto, y un GROUP BY o un COUNT(DISTINCT) con ese ORDER BY da
  # StatementInvalid (lo mismo que `bandeja-prueba.rb` y `bandeja-vzla.rb` en infra/chatwoot/correo).
  conv = Conversation.where(account_id: cuenta.id, inbox_id: bandeja.id).unscope(:order)
  msgs = Message.where(account_id: cuenta.id, inbox_id: bandeja.id).unscope(:order)
  adjs = Attachment.joins(:message).where(messages: { inbox_id: bandeja.id, account_id: cuenta.id }).unscope(:order) # [bandeja-adjuntos]
  origen = Arel.sql("conversations.additional_attributes->>'kommo_origen'")
  c = {}
  # Si un conteo falla, el error dice cuál fue el último que salió (solo la clave, nunca un valor).
  def c.[]=(clave, valor)
    $ultimo_conteo = clave
    super
  end
  c['conversaciones'] = conv.count
  c['conversaciones_kommo'] = conv.where("conversations.additional_attributes ? 'kommo_talk_id'").count
  c['mensajes'] = msgs.count # [bandeja-mensajes]
  c['mensajes_kommo'] = msgs.where('messages.source_id LIKE ?', 'kommo:%').count
  c['entrantes'] = msgs.where(message_type: :incoming).count
  c['salientes'] = msgs.where(message_type: :outgoing).count
  c['mensajes_otro_tipo'] = msgs.where.not(message_type: %i[incoming outgoing]).count
  c['mensajes_con_adjunto'] = adjs.distinct.count(:message_id)
  c['contact_inboxes'] = ContactInbox.where(inbox_id: bandeja.id).count
  c['contactos'] = ContactInbox.where(inbox_id: bandeja.id).distinct.count(:contact_id)
  c['adjuntos'] = adjs.count
  c['adjuntos_bytes'] = ActiveStorage::Blob.joins(:attachments)
                                           .where(active_storage_attachments: { record_type: 'Attachment', record_id: adjs.select(:id) })
                                           .sum(:byte_size)
  c['blobs_kommo'] = ActiveStorage::Blob.where('filename LIKE ?', 'kommo-%').count
  c['miembros'] = InboxMember.where(inbox_id: bandeja.id).count
  # Huérfanos y repetidos (E-9 y E-7 de §10.4): tienen que dar 0.
  c['conversaciones_sin_contact_inbox'] = conv.where(contact_inbox_id: nil).count
  c['mensajes_fuera_de_conversacion'] = msgs.where.not(conversation_id: conv.select(:id)).count
  c['source_id_repetidos'] = msgs.where.not(source_id: nil).group(:source_id).having('COUNT(*) > 1').count.size
  c['talk_id_repetidos'] = conv.where("conversations.additional_attributes ? 'kommo_talk_id'")
                               .group(Arel.sql("conversations.additional_attributes->>'kommo_talk_id'"))
                               .having('COUNT(*) > 1').count.size
  # Por canal de Kommo (`kommo_origen` de cada conversación).
  c['conversaciones_por_canal'] = tabla(conv.group(origen).count)
  c['mensajes_por_canal'] = tabla(msgs.joins(:conversation).group(origen).count)
  c['conversaciones_por_estado'] = tabla(conv.group(:status).count)
  c
end

def comparar(conteos)
  fallas = 0
  ESPERADO_5_7.each do |clave, esperado|
    dio = conteos[clave]
    ok = dio == esperado
    fallas += 1 unless ok
    puts "CONCILIA #{clave}=#{dio} esperado=#{esperado} #{ok ? 'coincide' : 'NO COINCIDE'}"
  end
  hecho('concilia', fallas.zero? ? 'si' : "no:#{fallas}")
end

begin
  abort_con = ->(motivo) { hecho('acta', 'error'); hecho('motivo', motivo); exit 1 }
  bandeja_id = ENV.fetch('BANDEJA', '')
  abort_con.call('falta BANDEJA (el id de «Archivo Kommo»)') unless bandeja_id.match?(/\A\d+\z/)
  if ENV['COMPARAR'].present? && ENV['COMPARAR'] != '5.7'
    abort_con.call('COMPARAR solo admite 5.7')
  end

  ActiveRecord::Base.transaction do
    ActiveRecord::Base.connection.execute('SET TRANSACTION READ ONLY') # [solo-lectura]
    solo_lectura = ActiveRecord::Base.connection.select_value('SHOW transaction_read_only') == 'on'
    hecho('solo_lectura', solo_lectura ? 'si' : 'no')
    abort_con.call('la transacción no quedó en solo lectura') unless solo_lectura
    cuenta = Account.find_by(id: ENV.fetch('CUENTA', '1'))
    abort_con.call('la cuenta no existe') unless cuenta
    bandeja = cuenta.inboxes.find_by(id: bandeja_id.to_i)
    abort_con.call('la bandeja no existe en esa cuenta') unless bandeja
    abort_con.call('la bandeja no es de canal API: no es el Archivo') unless bandeja.channel_type == 'Channel::Api'
    hecho('cuenta', cuenta.id)
    hecho('bandeja', bandeja.id)
    hecho('webhook_url', bandeja.channel.try(:webhook_url).present? ? 'si' : 'no')

    conteos = contar(cuenta, bandeja)
    conteos.each { |clave, valor| hecho(clave, valor) }
    comparar(conteos) if ENV['COMPARAR'] == '5.7'
    hecho('acta', 'ok')
    raise ActiveRecord::Rollback
  end
rescue StandardError => e
  # Cualquier error, incluido el de Postgres si algo quisiera escribir («cannot execute … in a read-only
  # transaction»): solo la clase, sin el mensaje ni la traza, que podrían traer datos.
  hecho('acta', 'error')
  hecho('motivo', e.class.name)
  hecho('causa', e.cause.class.name) if e.cause
  hecho('ultimo_conteo', $ultimo_conteo || 'ninguno')
  exit 1
end
