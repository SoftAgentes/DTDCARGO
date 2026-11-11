# frozen_string_literal: true

# infra/ops/portal-historial/pruebas/sonda-deshacer.rb — sonda de la prueba de la vuelta atrás dirigida
# (prueba-deshacer.sh, SDD-0586 10.7, PR 2c). Solo datos inventados. Corre con `rails runner` en el servicio `prepare`.
#
#   FASE=otra-bandeja CUENTA BANDEJA OTRA  al primer contacto dtd-portal: de la bandeja le da un contact_inbox, una
#                       conversación y un mensaje en la otra bandeja (OTRA): ese contacto se conserva. Idempotente.
#   FASE=ajeno BANDEJA CUAL=…  pone en la bandeja algo que la carga no crea, de a uno:
#                       mensaje        un mensaje sin source_id en una conversación cargada;
#                       contact_inbox  un contact_inbox de la cola (source_id cola-…);
#                       sin-hilo       una conversación sin dtd_hilo;
#                       asignada       una conversación cargada con un agente asignado;
#                       snoozed        una conversación cargada en snoozed;
#                       telefono       un contacto de la bandeja con teléfono (el cargador nunca lo pone);
#                       nota           una nota de un contacto de la bandeja.
#   FASE=quitar-ajeno BANDEJA  lo quita todo.
#   FASE=hilo-cambiado BANDEJA  a la primera conversación cargada le pone otro dtd_hilo (que no es un hilo de Studio);
#                       imprime la conversación y su dtd_hilo de antes.
#   FASE=hilo-restaurar CONV HILO  le devuelve su dtd_hilo.
#   FASE=trampa-poner BANDEJA OTRA  la carrera de N3: un trigger que, cuando se borran los mensajes, mete en la bandeja
#                       una conversación de la otra bandeja (como una que entra a mitad del borrado).
#   FASE=trampa-quitar  lo quita.
#   FASE=contar CUENTA BANDEJA OTRA  la bandeja, los contactos dtd-portal: de la cuenta y la otra bandeja.
# Salida: `HECHO clave=valor`, solo conteos e ids.

require 'securerandom'

def hecho(k, v)
  puts "HECHO #{k}=#{v}"
end

cuenta = ENV['CUENTA'] && Integer(ENV['CUENTA'], 10)
bandeja = Integer(ENV.fetch('BANDEJA'), 10)
otra = ENV['OTRA'] && Integer(ENV['OTRA'], 10)
dtd = ->(c) { Contact.where(account_id: c).where("identifier LIKE 'dtd-portal:%'") }
de_la_bandeja = -> { Contact.where(id: ContactInbox.where(inbox_id: bandeja).select(:contact_id)).where("identifier LIKE 'dtd-portal:%'") }
primero = -> { de_la_bandeja.call.order(:id).first }
cargadas = -> { Conversation.where(inbox_id: bandeja).where("additional_attributes ? 'dtd_hilo'").order(:id) }

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
    conv = cargadas.call.first or raise 'no hay conversación cargada'
    Message.insert_all([{ account_id: conv.account_id, inbox_id: bandeja, conversation_id: conv.id, message_type: 1,
                          content: 'SINT ajeno', private: false, status: 0, source_id: nil, content_attributes: {},
                          created_at: ahora, updated_at: ahora }])
  when 'contact_inbox'
    x = Contact.create!(account_id: Inbox.find(bandeja).account_id, name: 'SINT cola')
    ContactInbox.create!(contact: x, inbox_id: bandeja, source_id: "cola-#{SecureRandom.hex(4)}")
  when 'sin-hilo'
    c = primero.call or raise 'no hay contacto cargado'
    ci = ContactInbox.find_by!(contact_id: c.id, inbox_id: bandeja)
    Conversation.insert_all([{ account_id: c.account_id, inbox_id: bandeja, contact_id: c.id, contact_inbox_id: ci.id,
                               status: 0, additional_attributes: {}, created_at: ahora, updated_at: ahora,
                               last_activity_at: ahora }])
  when 'asignada'
    agente = AccountUser.where(account_id: Inbox.find(bandeja).account_id).order(:user_id).first.user_id
    cargadas.call.first.update_columns(assignee_id: agente)
  when 'snoozed'
    cargadas.call.where(status: Conversation.statuses.fetch('open')).first.update_columns(status: Conversation.statuses.fetch('snoozed'))
  when 'telefono'
    primero.call.update_columns(phone_number: '+584127770005')
  when 'nota'
    c = primero.call
    Note.insert_all([{ content: 'SINT nota', account_id: c.account_id, contact_id: c.id, created_at: ahora, updated_at: ahora }])
  end
  hecho('ajeno', 'ok')
when 'quitar-ajeno'
  Message.where(inbox_id: bandeja, source_id: nil).delete_all
  cis = ContactInbox.where(inbox_id: bandeja).where("source_id NOT LIKE 'dtd-portal:%'")
  ids = cis.pluck(:contact_id)
  cis.delete_all
  Contact.where(id: ids).delete_all
  Conversation.where(inbox_id: bandeja).where("NOT (coalesce(additional_attributes, '{}'::jsonb) ? 'dtd_hilo')").delete_all
  Conversation.where(inbox_id: bandeja).where.not(assignee_id: nil).update_all(assignee_id: nil)
  Conversation.where(inbox_id: bandeja, status: Conversation.statuses.fetch('snoozed')).update_all(status: Conversation.statuses.fetch('open'))
  de_la_bandeja.call.where.not(phone_number: nil).update_all(phone_number: nil)
  Note.where(contact_id: de_la_bandeja.call.select(:id)).delete_all
  hecho('quitar_ajeno', 'ok')
when 'hilo-cambiado'
  conv = cargadas.call.first or raise 'no hay conversación cargada'
  hecho('conv', conv.id)
  hecho('hilo', conv.additional_attributes['dtd_hilo'])
  conv.update_columns(additional_attributes: conv.additional_attributes.merge('dtd_hilo' => SecureRandom.uuid))
  hecho('hilo_cambiado', 'ok')
when 'hilo-restaurar'
  conv = Conversation.find(Integer(ENV.fetch('CONV'), 10))
  conv.update_columns(additional_attributes: conv.additional_attributes.merge('dtd_hilo' => ENV.fetch('HILO')))
  hecho('hilo_restaurado', 'ok')
when 'trampa-poner'
  ActiveRecord::Base.connection.execute(<<~SQL)
    CREATE OR REPLACE FUNCTION sint_trampa() RETURNS trigger LANGUAGE plpgsql AS $f$
    BEGIN
      UPDATE conversations SET inbox_id = #{bandeja}
        WHERE id = (SELECT id FROM conversations WHERE inbox_id = #{otra} ORDER BY id LIMIT 1);
      RETURN NULL;
    END $f$;
    DROP TRIGGER IF EXISTS sint_trampa ON messages;
    CREATE TRIGGER sint_trampa AFTER DELETE ON messages FOR EACH STATEMENT EXECUTE FUNCTION sint_trampa();
  SQL
  hecho('trampa', 'ok')
when 'trampa-quitar'
  ActiveRecord::Base.connection.execute('DROP TRIGGER IF EXISTS sint_trampa ON messages; DROP FUNCTION IF EXISTS sint_trampa();')
  hecho('trampa_quitada', 'ok')
when 'contar'
  hecho('bandeja', "conversaciones:#{Conversation.where(inbox_id: bandeja).count},mensajes:#{Message.where(inbox_id: bandeja).count},contact_inboxes:#{ContactInbox.where(inbox_id: bandeja).count}")
  hecho('contactos_dtd', dtd.call(cuenta).count)
  hecho('otra', "conversaciones:#{Conversation.where(inbox_id: otra).count},mensajes:#{Message.where(inbox_id: otra).count},contact_inboxes:#{ContactInbox.where(inbox_id: otra).count}")
  hecho('contar', 'ok')
end
