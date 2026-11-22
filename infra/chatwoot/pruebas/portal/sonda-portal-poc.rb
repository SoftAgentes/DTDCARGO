# infra/chatwoot/pruebas/portal/sonda-portal-poc.rb — prepara la cuenta de la prueba de concepto de la ida del
# chat del portal (SDD-0586, paso 10.5, §10.5.15: PoC-1, PoC-2, PoC-3 y PoC-5). Corre con `rails runner` en el
# servicio `prepare` de una instancia EFÍMERA de Chatwoot (prueba-portal-poc.sh), nunca en el VPS.
#
# Crea, con datos inventados:
#   · una cuenta y un administrador confirmado, con su token de acceso (el de la API de cuenta, como el usuario
#     de servicio de E10 en producción);
#   · la bandeja API «Conversaciones del portal», sin webhook_url, sin saludo, sin asignación automática y sin
#     encuesta (§10.5.9, puerta 3), con el administrador de miembro;
#   · un webhook de cuenta a WEBHOOK_URL, solo con message_created, como el de Studio (2.3). Con un host sin IP
#     pública, Chatwoot 4.19.1 encola el trabajo pero no lo entrega: es la MEDIDA de la PoC-5. Desde la 1b la
#     URL termina en /api/chatwoot/webhook, como la de Studio, para que la salud del webhook lo reconozca.
#
# Escribe `clave=valor` en SALIDA (un archivo, no la salida estándar): el token no va al log del runner.
require "securerandom"

salida = ENV.fetch("SALIDA")
cuenta = Account.create!(name: "SINT PoC portal #{SecureRandom.hex(3)}")
usuario = User.new(
  name: "SINT-Servicio",
  email: "sint-servicio-#{SecureRandom.hex(4)}@example.test",
  password: "Sint-#{SecureRandom.hex(12)}A1!"
)
usuario.skip_confirmation!
usuario.save!
AccountUser.create!(account: cuenta, user: usuario, role: :administrator)

canal = Channel::Api.create!(account: cuenta)
bandeja = Inbox.create!(
  account: cuenta,
  name: "Conversaciones del portal",
  channel: canal,
  enable_auto_assignment: false,
  greeting_enabled: false,
  csat_survey_enabled: false
)
InboxMember.create!(inbox: bandeja, user: usuario)
webhook = Webhook.create!(account: cuenta, url: ENV.fetch("WEBHOOK_URL"), subscriptions: ["message_created"])

token = usuario.reload.access_token&.token
raise "el administrador no tiene token de acceso" if token.blank?

# SDD-0649: un usuario con rol AGENTE que NO es miembro de ninguna bandeja, para medir qué ve de un contacto
# (sus custom_attributes) y de sus conversaciones. Inventado, y solo en esta instancia efímera.
agente = User.new(
  name: "SINT-Agente",
  email: "sint-agente-#{SecureRandom.hex(4)}@example.test",
  password: "Sint-#{SecureRandom.hex(12)}A1!"
)
agente.skip_confirmation!
agente.save!
AccountUser.create!(account: cuenta, user: agente, role: :agent)
token_agente = agente.reload.access_token&.token
raise "el agente no tiene token de acceso" if token_agente.blank?
raise "el agente no debe ser miembro de ninguna bandeja" if InboxMember.exists?(user: agente)

File.write(salida, <<~FIN)
  cuenta=#{cuenta.id}
  bandeja=#{bandeja.id}
  token=#{token}
  token_agente=#{token_agente}
  usuario=#{usuario.id}
  webhook=#{webhook.id}
  webhook_url_del_canal=#{canal.webhook_url.presence ? "si" : "no"}
FIN
puts "HECHO sonda=ok"
