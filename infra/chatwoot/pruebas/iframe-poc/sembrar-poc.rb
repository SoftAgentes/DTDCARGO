# frozen_string_literal: true

# Datos SINTÉTICOS para la PoC del iframe (SDD-0585, paso 2.1). Corre con `rails runner`
# en el Chatwoot local de levantar.sh, después de crear la cuenta y la agente por la
# Platform API. Deja una bandeja API con la agente como miembro y una conversación
# abierta, para abrir el cuadro de respuesta y su grabadora de notas de voz.
# Ningún valor es de una persona real.

cuenta = Account.find(ENV.fetch('CUENTA_ID'))
agente = User.find(ENV.fetch('USUARIO_ID'))

canal = Channel::Api.create!(account: cuenta)
bandeja = Inbox.create!(account: cuenta, channel: canal, name: 'Bandeja sintetica E2')
InboxMember.create!(inbox: bandeja, user: agente)
contacto = Contact.create!(account: cuenta, name: 'Contacto Sintetico E2', email: 'contacto.sintetico.e2@example.test')
fuente = ContactInbox.create!(contact: contacto, inbox: bandeja, source_id: SecureRandom.uuid)
conversacion = Conversation.create!(account: cuenta, inbox: bandeja, contact: contacto, contact_inbox: fuente,
                                    assignee: agente)
Message.create!(account: cuenta, inbox: bandeja, conversation: conversacion, sender: contacto,
                message_type: :incoming, content: 'Mensaje sintetico E2')

puts "POC:#{conversacion.display_id}"
