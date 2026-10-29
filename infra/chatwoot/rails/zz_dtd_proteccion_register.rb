# frozen_string_literal: true

# DTD Cargo · protección de /register y /deregister de WhatsApp (SDD-0584, paso 4.2 del
# programa SDD-0582).
#
# Se monta en solo lectura en /app/config/initializers/zz_dtd_proteccion_register.rb
# (infra/chatwoot/compose.yml), igual que zz_dtd_redaccion_logs.rb.
#
# Por qué (decisión B de SDD-0582): el número principal de WhatsApp se COMPARTE con Kommo,
# no se migra. Kommo lo registró en Meta con su PIN; si Chatwoot llama a /register con
# otro PIN, o a /deregister, el número puede desconectarse de Kommo. Medido en la etiqueta
# v4.19.1 de chatwoot/chatwoot (commit caab07a8f000):
#   · CW-1. app/services/whatsapp/webhook_setup_service.rb: si la consulta de verificación
#     falla, `phone_number_verified?` cae en `rescue … false`, `should_register_phone_number?`
#     da true y `register_phone_number` llama a /register con un PIN aleatorio propio.
#   · app/services/whatsapp/webhook_teardown_service.rb: al borrar una bandeja creada por
#     Embedded Signup, llama a /deregister.
#   · Las dos llamadas salen de app/services/whatsapp/facebook_api_client.rb
#     (`register_phone_number` y `deregister_phone_number`), con HTTParty.
#
# Cómo: dos redes.
#   1. `Whatsapp::FacebookApiClient#register_phone_number` y `#deregister_phone_number`
#      levantan DtdProteccionRegister::Bloqueado antes de armar el pedido si el Phone
#      Number ID está protegido. Chatwoot rescata el error en los dos servicios: la bandeja
#      sigue (el webhook se configura) y el error queda en `registration_error`, que la
#      configuración manual muestra.
#   2. Cualquier POST de HTTParty a una ruta `/<id>/register` o `/<id>/deregister` pasa por el
#      mismo control, por si una versión futura llama a Meta sin el cliente.
#
# Configuración: DTD_WHATSAPP_IDS_PROTEGIDOS, Phone Number IDs separados por coma (de 10 a
# 20 dígitos cada uno). Los IDs viven solo en el .env del servidor, nunca en Git.
# Falla cerrado: si la variable está vacía, no existe o tiene un elemento mal formado, se
# bloquean /register y /deregister para TODOS los números. Los logs llevan una huella de 8
# caracteres del ID (SHA-256), nunca el ID ni el teléfono.
#
# Prueba con servidor falso y control sin este archivo: infra/chatwoot/pruebas/prueba-register.sh.

require 'digest'
require 'set'

module DtdProteccionRegister
  VARIABLE = 'DTD_WHATSAPP_IDS_PROTEGIDOS'
  FORMATO_ID = /\A\d{10,20}\z/
  RUTA_PROTEGIDA = %r{/(\d+)/(register|deregister)/?\z}

  class Bloqueado < StandardError; end

  # Conjunto de IDs protegidos, o nil cuando la variable no sirve (modo cerrado).
  # `split(',', -1)` conserva los vacíos: «123…,» o «,» son mal formados, no una lista corta.
  def self.leer(valor)
    return nil if valor.nil? || valor.strip.empty?

    ids = valor.split(',', -1).map(&:strip)
    return nil unless ids.all? { |id| FORMATO_ID.match?(id) }

    ids.to_set.freeze
  end

  PROTEGIDOS = leer(ENV.fetch(VARIABLE, nil))

  def self.cerrado?
    PROTEGIDOS.nil?
  end

  def self.protegido?(phone_number_id)
    cerrado? || PROTEGIDOS.include?(phone_number_id.to_s.strip)
  end

  def self.huella(phone_number_id)
    Digest::SHA256.hexdigest(phone_number_id.to_s.strip)[0, 8]
  end

  def self.verificar!(operacion, phone_number_id)
    return unless protegido?(phone_number_id)

    motivo = cerrado? ? "#{VARIABLE} vacía o mal formada, bloqueo para todos los números" : 'Phone Number ID protegido'
    mensaje = "[DTD] /#{operacion} bloqueado (#{motivo}; huella #{huella(phone_number_id)}). " \
              'El número lo opera otro socio y esta llamada podría desconectarlo. ' \
              'Ver docs/runbooks/chatwoot-servidor.md §8.'
    Rails.logger.error(mensaje)
    raise Bloqueado, mensaje
  end

  module Cliente
    def register_phone_number(phone_number_id, *resto)
      DtdProteccionRegister.verificar!('register', phone_number_id)
      super
    end

    def deregister_phone_number(phone_number_id, *resto)
      DtdProteccionRegister.verificar!('deregister', phone_number_id)
      super
    end
  end

  module PeticionHttp
    def perform(&)
      if http_method == Net::HTTP::Post && (ruta = RUTA_PROTEGIDA.match(uri.path.to_s))
        DtdProteccionRegister.verificar!(ruta[2], ruta[1])
      end
      super
    end
  end
end

# Red 2: todo POST de HTTParty. La gema no se recarga, así que va una sola vez.
HTTParty::Request.prepend(DtdProteccionRegister::PeticionHttp)

# Red 1: el cliente de Meta es código de la app (Zeitwerk); se toca en to_prepare, que es
# donde Rails permite cargarlo durante el arranque.
Rails.application.config.to_prepare do
  cliente = Whatsapp::FacebookApiClient
  faltan = %i[register_phone_number deregister_phone_number].reject { |m| cliente.method_defined?(m) }
  # Si una versión nueva renombra los métodos, el arranque se cae aquí y no en silencio:
  # la prueba de E3 lo detecta antes de llegar al VPS.
  raise "[DTD] protección de /register: faltan #{faltan.join(', ')} en #{cliente}" if faltan.any?

  cliente.prepend(DtdProteccionRegister::Cliente) unless cliente <= DtdProteccionRegister::Cliente
end

if DtdProteccionRegister.cerrado?
  Rails.logger.warn("[DTD] protección de /register activa en modo cerrado: #{DtdProteccionRegister::VARIABLE} " \
                    'vacía o mal formada; /register y /deregister quedan bloqueados para todos los números')
else
  Rails.logger.info("[DTD] protección de /register activa: #{DtdProteccionRegister::PROTEGIDOS.size} " \
                    'Phone Number IDs protegidos (zz_dtd_proteccion_register.rb)')
end
