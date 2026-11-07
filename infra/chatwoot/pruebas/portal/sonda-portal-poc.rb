# infra/chatwoot/pruebas/portal/sonda-portal-poc.rb — prepara la cuenta de la prueba de concepto de la ida del
# chat del portal (SDD-0586, paso 10.5, §10.5.15: PoC-1, PoC-2, PoC-3 y PoC-5). Corre con `rails runner` en el
# servicio `prepare` de una instancia EFÍMERA de Chatwoot (prueba-portal-poc.sh), nunca en el VPS.
#
# Crea, con datos inventados:
#   · una cuenta y un administrador confirmado, con su token de acceso (el de la API de cuenta, como el usuario
#     de servicio de E10 en producción);
#   · la bandeja API «Conversaciones del portal», sin webhook_url, sin saludo, sin asignación automática y sin
#     encuesta (§10.5.9, puerta 3), con el administrador de miembro;
#   · un webhook de cuenta a WEBHOOK_URL, solo con message_created, como el de Studio (2.3).
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

File.write(salida, <<~FIN)
  cuenta=#{cuenta.id}
  bandeja=#{bandeja.id}
  token=#{token}
  webhook=#{webhook.id}
  webhook_url_del_canal=#{canal.webhook_url.presence ? "si" : "no"}
FIN
puts "HECHO sonda=ok"
