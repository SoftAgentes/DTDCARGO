# frozen_string_literal: true

# Datos SINTÉTICOS para el ensayo de respaldo y restauración (SDD-0583, paso 1.5).
# Corre con `rails runner` en el stack de origen de la prueba local.
#
# Siembra una cuenta, una agente, una bandeja API, un contacto, una conversación con
# mensajes, un adjunto y un webhook con secreto. El secreto se guarda CIFRADO con las
# claves de Active Record Encryption: después de restaurar, leerlo prueba que las
# claves viajaron con el respaldo (y el control sin claves prueba que hacen falta).
# Imprime huellas para verificar.rb; ningún valor es de una persona real.

require 'digest'

cuenta = Account.create!(name: 'Cuenta sintetica E1')
agente = User.create!(name: 'Agente Sintetica', email: 'agente.sintetica.e1@example.test',
                      password: "Pw-#{SecureRandom.hex(8)}-a1!", confirmed_at: Time.current)
AccountUser.create!(account: cuenta, user: agente, role: :administrator)

canal = Channel::Api.create!(account: cuenta)
bandeja = Inbox.create!(account: cuenta, channel: canal, name: 'Bandeja sintetica E1')
contacto = Contact.create!(account: cuenta, name: 'Contacto Sintetico', email: 'contacto.sintetico.e1@example.test',
                           phone_number: '+584125550199')
fuente = ContactInbox.create!(contact: contacto, inbox: bandeja, source_id: SecureRandom.uuid)
conversacion = Conversation.create!(account: cuenta, inbox: bandeja, contact: contacto, contact_inbox: fuente)

3.times do |i|
  Message.create!(account: cuenta, inbox: bandeja, conversation: conversacion, sender: contacto,
                  message_type: :incoming, content: "Mensaje sintetico #{i + 1}")
end

bytes = "ADJUNTO-SINTETICO-E1 #{SecureRandom.hex(64)}"
con_adjunto = Message.new(account: cuenta, inbox: bandeja, conversation: conversacion, sender: agente,
                          message_type: :outgoing, content: 'Mensaje con adjunto sintetico')
con_adjunto.attachments.new(account_id: cuenta.id, file_type: :file,
                            file: { io: StringIO.new(bytes), filename: 'adjunto-sintetico.txt', content_type: 'text/plain' })
con_adjunto.save!

secreto = "SECRETO-SINTETICO-#{SecureRandom.hex(12)}"
webhook = Webhook.create!(account: cuenta, url: 'https://webhook-sintetico.example.test/hook',
                          subscriptions: ['message_created'])
webhook.update_column(:secret, nil) if webhook.secret.present?
webhook.update!(secret: secreto)
crudo = Webhook.connection.select_value("select secret from webhooks where id = #{webhook.id}")

puts "sembrado: cuenta=#{cuenta.id} mensajes=#{Message.count} adjuntos=#{ActiveStorage::Blob.count}"
puts "huella_adjunto=#{Digest::SHA256.hexdigest(bytes)}"
puts "huella_secreto=#{Digest::SHA256.hexdigest(secreto)}"
puts "secreto_cifrado_en_base=#{crudo.to_s.start_with?('{"p":') ? 'si' : 'no'}"
