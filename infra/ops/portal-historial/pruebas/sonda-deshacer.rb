# frozen_string_literal: true

# infra/ops/portal-historial/pruebas/sonda-deshacer.rb — sonda de la prueba de la vuelta atrás dirigida
# (prueba-deshacer.sh, SDD-0586 10.7, PR 2c). Solo datos inventados. Corre con `rails runner` en el servicio `prepare`.
#
#   FASE=otra-bandeja CUENTA BANDEJA OTRA  al primer contacto dtd-portal: de la bandeja le da un contact_inbox, una
#                       conversación y un mensaje en la otra bandeja (OTRA): ese contacto se conserva. Idempotente.
#   FASE=ajeno BANDEJA CUAL=mensaje|contact_inbox  pone en la bandeja algo que la carga no crea: un mensaje sin
#                       source_id en una conversación cargada, o un contact_inbox de la cola (source_id cola-…).
#   FASE=quitar-ajeno BANDEJA  lo quita.
#   FASE=contar CUENTA BANDEJA OTRA  la bandeja, los contactos dtd-portal: de la cuenta, el conservado y la otra bandeja.
# Salida: `HECHO clave=valor`, solo conteos e ids.

require 'securerandom'

def hecho(k, v)
  puts "HECHO #{k}=#{v}"
end

cuenta = ENV['CUENTA'] && Integer(ENV['CUENTA'])
bandeja = Integer(ENV.fetch('BANDEJA'))
otra = ENV['OTRA'] && Integer(ENV['OTRA'])
dtd = ->(c) { Contact.where(account_id: c).where("identifier LIKE 'dtd-portal:%'") }
primero = -> { Contact.where(id: ContactInbox.where(inbox_id: bandeja).select(:contact_id)).where("identifier LIKE 'dtd-portal:%'").order(:id).first }

case ENV.fetch('FASE')
when 'otra-bandeja'
  c = primero.call or raise 'no hay contacto cargado'
  ci = ContactInbox.find_by(contact_id: c.id, inbox_id: otra) ||
       ContactInbox.create!(contact: c, inbox_id: otra, source_id: "sint-otra-#{SecureRandom.hex(4)}")
  unless Conversation.exists?(contact_id: c.id, inbox_id: otra)
    conv = Conversation.create!(account_id: cuenta, inbox_id: otra, contact: c, contact_inbox: ci)
    conv.messages.create!(account_id: cuenta, inbox_id: otra, message_type: :incoming, content: 'SINT otra bandeja', sender: c)
  end
  hecho('conservado', c.id)
when 'ajeno'
  ahora = Time.zone.now
  case ENV.fetch('CUAL')
  when 'mensaje'
    conv = Conversation.where(inbox_id: bandeja).order(:id).first or raise 'no hay conversación cargada'
    Message.insert_all([{ account_id: conv.account_id, inbox_id: bandeja, conversation_id: conv.id, message_type: 1,
                          content: 'SINT ajeno', private: false, status: 0, source_id: nil, content_attributes: {},
                          created_at: ahora, updated_at: ahora }])
  when 'contact_inbox'
    x = Contact.create!(account_id: Inbox.find(bandeja).account_id, name: 'SINT cola')
    ContactInbox.create!(contact: x, inbox_id: bandeja, source_id: "cola-#{SecureRandom.hex(4)}")
  end
  hecho('ajeno', 'ok')
when 'quitar-ajeno'
  Message.where(inbox_id: bandeja, source_id: nil).delete_all
  cis = ContactInbox.where(inbox_id: bandeja).where("source_id NOT LIKE 'dtd-portal:%'")
  ids = cis.pluck(:contact_id)
  cis.delete_all
  Contact.where(id: ids).delete_all
  hecho('quitar_ajeno', 'ok')
when 'contar'
  hecho('bandeja', "conversaciones:#{Conversation.where(inbox_id: bandeja).count},mensajes:#{Message.where(inbox_id: bandeja).count},contact_inboxes:#{ContactInbox.where(inbox_id: bandeja).count}")
  hecho('contactos_dtd', dtd.call(cuenta).count)
  hecho('otra', "conversaciones:#{Conversation.where(inbox_id: otra).count},mensajes:#{Message.where(inbox_id: otra).count},contact_inboxes:#{ContactInbox.where(inbox_id: otra).count}")
  hecho('contar', 'ok')
end
