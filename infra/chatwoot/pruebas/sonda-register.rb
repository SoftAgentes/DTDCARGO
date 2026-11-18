# frozen_string_literal: true

# Sonda de la protección de /register (SDD-0584). La corre prueba-register.sh con
# `rails runner` dentro del servicio `prepare`, que vive solo en la red `interna`
# (internal: true): aunque algo se escapara, no hay salida a Meta.
#
# Un servidor HTTP falso, en este mismo proceso, hace de Graph API: BASE_URI del cliente
# de WhatsApp y del de salud apunta a él. Contesta 200 a todo, salvo la consulta de
# verificación (`fields=status,code_verification_status`), que falla con 500 como en
# CW-1: así WebhookSetupService decide llamar a /register por sí solo.
#
# Imprime una línea `HECHO clave=valor` por medición. No imprime IDs ni teléfonos; los
# de aquí son sintéticos. El veredicto lo da el script, que conoce el caso.

require 'socket'

PROTEGIDO = '100000000000001'
LIBRE = '100000000000002'
WABA = '200000000000001'

servidor = TCPServer.new('127.0.0.1', 0)
PUERTO = servidor.addr[1]
LLAMADAS = []
CANDADO = Mutex.new

Thread.new do
  loop do
    conexion = servidor.accept
    metodo, ruta = conexion.gets.to_s.split
    largo = 0
    while (linea = conexion.gets) && linea != "\r\n"
      largo = linea.split(':', 2)[1].to_i if linea.downcase.start_with?('content-length:')
    end
    conexion.read(largo) if largo.positive?
    CANDADO.synchronize { LLAMADAS << "#{metodo} #{ruta}" }
    falla = ruta.to_s.include?('code_verification_status')
    cuerpo = falla ? '{"error":{"message":"falla simulada"}}' : '{"success":true}'
    conexion.write("HTTP/1.1 #{falla ? '500 Internal Server Error' : '200 OK'}\r\n" \
                   "Content-Type: application/json\r\nContent-Length: #{cuerpo.bytesize}\r\n" \
                   "Connection: close\r\n\r\n#{cuerpo}")
    conexion.close
  rescue StandardError
    conexion&.close
  end
end

[Whatsapp::FacebookApiClient, Whatsapp::HealthService].each do |clase|
  clase.send(:remove_const, :BASE_URI)
  clase.const_set(:BASE_URI, "http://127.0.0.1:#{PUERTO}")
end
# Los servicios que leen la base de Graph del entorno (validación del canal al guardar el PIN).
ENV['WHATSAPP_CLOUD_BASE_URL'] = "http://127.0.0.1:#{PUERTO}"

def hecho(clave, valor)
  puts "HECHO #{clave}=#{valor}"
end

# Cuántas llamadas llegaron al servidor falso con ese método y ese final de ruta.
def llegaron(metodo, final)
  CANDADO.synchronize { LLAMADAS.count { |l| l.start_with?("#{metodo} ") && l.split('?').first.end_with?(final) } }
end

def intentar
  yield
  'ok'
rescue StandardError => e
  e.class.name
end

hecho('inicializador', defined?(DtdProteccionRegister) ? 'si' : 'no')
hecho('modo', defined?(DtdProteccionRegister) ? (DtdProteccionRegister.cerrado? ? 'cerrado' : 'lista') : 'ninguno')

# Lectura de la variable (prueba de unidad dentro de la imagen real).
if defined?(DtdProteccionRegister)
  malas = [nil, '', '   ', 'abc', '123', "#{PROTEGIDO};#{LIBRE}", "#{PROTEGIDO},", ',', "#{PROTEGIDO},abc", '1e14', "#{PROTEGIDO}0000000"]
  hecho('lectura_malas_cerradas', malas.all? { |v| DtdProteccionRegister.leer(v).nil? } ? 'si' : 'no')
  buena = DtdProteccionRegister.leer(" #{PROTEGIDO} , #{LIBRE} ")
  hecho('lectura_buena', buena&.size.to_i)
end

cliente = Whatsapp::FacebookApiClient.new('token-falso')

# 1. Cliente directo.
error = nil
begin
  cliente.register_phone_number(PROTEGIDO, 123_456)
rescue StandardError => e
  error = e
end
hecho('reg_protegido_error', error ? error.class.name : 'ok')
hecho('reg_protegido_llamadas', llegaron('POST', "/#{PROTEGIDO}/register"))
hecho('mensaje_sin_id', error && [PROTEGIDO, LIBRE].none? { |id| error.message.include?(id) } ? 'si' : 'no')
hecho('mensaje_con_huella', error&.message.to_s.include?('huella') ? 'si' : 'no')

hecho('reg_libre_error', intentar { cliente.register_phone_number(LIBRE, 123_456) })
hecho('reg_libre_llamadas', llegaron('POST', "/#{LIBRE}/register"))

hecho('dereg_protegido_error', intentar { cliente.deregister_phone_number(PROTEGIDO) })
hecho('dereg_protegido_llamadas', llegaron('POST', "/#{PROTEGIDO}/deregister"))
hecho('dereg_libre_error', intentar { cliente.deregister_phone_number(LIBRE) })
hecho('dereg_libre_llamadas', llegaron('POST', "/#{LIBRE}/deregister"))

# 2. HTTParty directo, sin el cliente (segunda red).
antes = llegaron('POST', "/#{PROTEGIDO}/register")
hecho('http_protegido_error',
      intentar { HTTParty.post("http://127.0.0.1:#{PUERTO}/v22.0/#{PROTEGIDO}/register", body: '{}') })
hecho('http_protegido_llamadas', llegaron('POST', "/#{PROTEGIDO}/register") - antes)

# 3. CW-1 de punta a punta: la verificación falla y el servicio decide registrar.
def canal(phone_number_id, telefono)
  Channel::Whatsapp.new(
    provider: 'whatsapp_cloud',
    phone_number: telefono,
    provider_config: { 'phone_number_id' => phone_number_id, 'business_account_id' => WABA, 'api_key' => 'token-falso' }
  )
end

antes = llegaron('POST', "/#{PROTEGIDO}/register")
servicio = Whatsapp::WebhookSetupService.new(canal(PROTEGIDO, '+15550000001'))
hecho('cw1_protegido_perform', intentar { servicio.perform })
hecho('cw1_protegido_verificacion', llegaron('GET', "/#{PROTEGIDO}"))
hecho('cw1_protegido_register', llegaron('POST', "/#{PROTEGIDO}/register") - antes)
hecho('cw1_protegido_webhook', llegaron('POST', "/#{PROTEGIDO}"))
hecho('cw1_protegido_error', servicio.registration_error ? servicio.registration_error.class.name : 'ninguno')

antes = llegaron('POST', "/#{LIBRE}/register")
servicio = Whatsapp::WebhookSetupService.new(canal(LIBRE, '+15550000002'))
hecho('cw1_libre_perform', intentar { servicio.perform })
hecho('cw1_libre_register', llegaron('POST', "/#{LIBRE}/register") - antes)
hecho('cw1_libre_webhook', llegaron('POST', "/#{LIBRE}"))
