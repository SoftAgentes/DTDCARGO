# frozen_string_literal: true

# Sonda de la revocación de sesiones (SDD-0585, paso 2.7). Nunca en el VPS.
# La corre prueba-revocar-sesiones.sh con `rails runner` en el stack local, con y sin
# rails/zz_dtd_revocar_sesiones.rb. Todo es sintético y se borra al final.
#
# Imprime líneas `HECHO clave=valor` que el script compara. Pide a la app por
# ActionDispatch::Integration::Session: la misma pila de Rack que un pedido real (rutas,
# PlatformController, devise_token_auth), sin levantar un servidor.

require 'securerandom'

def hecho(clave, valor)
  puts "HECHO #{clave}=#{valor}"
end

clave = -> { "Pw-#{SecureRandom.hex(8)}-a1!" }
sufijo = SecureRandom.hex(4)
usuario = lambda do |nombre, rol, cuenta, app|
  u = User.create!(name: nombre, email: "#{nombre}.#{sufijo}@example.test", password: clave.call, confirmed_at: Time.current)
  AccountUser.create!(account: cuenta, user: u, role: rol)
  app&.platform_app_permissibles&.create!(permissible: u)
  u
end

cuenta = Account.create!(name: "Cuenta revocar #{sufijo}")
app = PlatformApp.create!(name: "Studio prueba #{sufijo}")
otra = PlatformApp.create!(name: "Otra app #{sufijo}")
servicio = usuario.call('servicio', :administrator, cuenta, app)
humano = usuario.call('humano', :administrator, cuenta, app)
agente = usuario.call('agente', :agent, cuenta, app)
ENV['DTD_CHATWOOT_SERVICIO_ID'] = servicio.id.to_s

s = ActionDispatch::Integration::Session.new(Rails.application)
s.host! ENV.fetch('CHATWOOT_HOST', 'chat.prueba.test')
ruta = ->(u) { "/platform/api/v1/users/#{u.id}/dtd_revocar_sesiones" }
revocar = lambda do |u, token|
  cabeceras = token ? { 'api_access_token' => token } : {}
  s.post(ruta.call(u), headers: cabeceras)
  s.response.status
end
perfil = lambda do |cabeceras|
  s.get('/api/v1/profile', headers: cabeceras)
  s.response.status
end

hecho :inicializador, defined?(DtdRevocarSesiones) ? 'si' : 'no'

# Dos sesiones del panel abiertas (como dos navegadores) y su registro visible.
sesion1 = agente.create_new_auth_token
sesion2 = agente.create_new_auth_token
[sesion1, sesion2].each { |h| UserSession.create!(user: agente, client_id: h['client']) }
agente.reload
api_antes = agente.access_token.token
pubsub_antes = agente.pubsub_token
hecho :perfil_antes, perfil.call(sesion1)
hecho :sesiones_antes, agente.tokens.size

# Autenticación y candados.
hecho :sin_token, revocar.call(agente, nil)
hecho :otra_app, revocar.call(agente, otra.access_token.token)
hecho :perfil_tras_rechazos, perfil.call(sesion1)
hecho :servicio, revocar.call(servicio, app.access_token.token)
hecho :servicio_cuerpo, s.response.body.to_s[0, 60]
hecho :ultimo_admin, revocar.call(humano, app.access_token.token)
hecho :ultimo_admin_cuerpo, s.response.body.to_s[0, 60]
ENV['DTD_CHATWOOT_SERVICIO_ID'] = ''
hecho :sin_servicio, revocar.call(agente, app.access_token.token)
hecho :perfil_tras_sin_servicio, perfil.call(sesion1)
ENV['DTD_CHATWOOT_SERVICIO_ID'] = servicio.id.to_s

# La revocación.
hecho :revocar, revocar.call(agente, app.access_token.token)
hecho :revocar_cuerpo, s.response.body.to_s[0, 60]
agente.reload
hecho :perfil_sesion1, perfil.call(sesion1)
hecho :perfil_sesion2, perfil.call(sesion2)
hecho :tokens_despues, (agente.tokens || {}).size
hecho :user_sessions_despues, UserSession.where(user_id: agente.id).count
hecho :pubsub_rotado, agente.pubsub_token == pubsub_antes ? 'no' : 'si'
hecho :api_rotado, agente.access_token.token == api_antes ? 'no' : 'si'
hecho :api_vieja, perfil.call({ 'api_access_token' => api_antes })
hecho :api_nueva, perfil.call({ 'api_access_token' => agente.access_token.token })

# Con otro admin humano, el primero sí se puede revocar.
otro_humano = usuario.call('otro', :administrator, cuenta, app)
hecho :admin_con_otro, revocar.call(humano, app.access_token.token)

# Tiempo real: RoomChannel revisa su pubsub_token cada 30 s.
if defined?(DtdRevocarSesiones)
  canal = RoomChannel.allocate
  canal.instance_variable_set(:@current_user, agente)
  canal.instance_variable_set(:@pubsub_token, pubsub_antes)
  hecho :canal_viejo_revocado, canal.dtd_sesion_revocada? ? 'si' : 'no'
  canal.instance_variable_set(:@pubsub_token, agente.pubsub_token)
  hecho :canal_nuevo_revocado, canal.dtd_sesion_revocada? ? 'si' : 'no'
  hecho :canal_temporizador, RoomChannel.periodic_timers.any? { |t, _| t == :dtd_verificar_sesion } ? 'si' : 'no'
else
  hecho :canal_viejo_revocado, 'no'
  hecho :canal_temporizador, 'no'
end

# Limpieza: nada sintético queda en la base del stack (que además se borra entero al final).
begin
  [agente, humano, otro_humano, servicio].each { |u| u.reload.destroy }
  [app, otra].each(&:destroy)
  cuenta.destroy
  hecho :limpieza, 'ok'
rescue StandardError => e
  hecho :limpieza, e.class.name
end
