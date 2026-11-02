# frozen_string_literal: true

# DTD Cargo · revocación de sesiones desde Studio (SDD-0585, paso 2.7, E2-D47).
#
# Se monta en solo lectura en /app/config/initializers/zz_dtd_revocar_sesiones.rb
# (infra/chatwoot/compose.yml), igual que zz_dtd_redaccion_logs.rb y
# zz_dtd_proteccion_register.rb. No toca enterprise/ (otra licencia): solo código MIT.
#
# Por qué: Sam pidió «cierre forzado» de verdad al dar de baja a un agente. La Platform API
# de 4.19.1 no revoca sesiones. Medido en la imagen chatwoot/chatwoot:v4.19.1-ce:
#   · Panel: devise_token_auth 1.2.5 guarda un token por navegador en `users.tokens` (JSON,
#     clave = client). `DeviseTokenAuth::Concerns::SetUserByToken#set_user_by_token` valida
#     cada pedido contra esa columna: sin la entrada, el pedido es 401 y el panel vuelve al
#     login. `users.user_sessions` es el registro visible de esas sesiones (4.x).
#   · API: `access_tokens.token` (AccessTokenable), el token personal del agente.
#   · Tiempo real: `RoomChannel` autentica con `pubsub_token` + `user_id` al suscribirse y
#     después escucha `pubsub_token` y `account_<id>` sin volver a mirar. La conexión
#     (`ApplicationCable::Connection`) no tiene `identified_by`: no hay cómo cortarla por
#     usuario desde afuera.
#
# Qué agrega:
#   1. `POST /platform/api/v1/users/:id/dtd_revocar_sesiones`, en `PlatformController`: el
#      token de la Platform App (`api_access_token`) y que el usuario sea permisible de ESA
#      app (`validate_platform_app_permissible`). Sin token o con el de otra app: 401.
#      Vacía `users.tokens`, borra `user_sessions`, rota `pubsub_token` y el token de API, en
#      una transacción con el usuario bloqueado. Responde cuántas sesiones había.
#   2. Rechaza (409) al usuario de servicio (DTD_CHATWOOT_SERVICIO_ID) y al último
#      administrador humano de una cuenta: sin él nadie la administra. Falla cerrado: sin
#      DTD_CHATWOOT_SERVICIO_ID, o mal formado, responde 503 y no revoca a nadie.
#   3. `RoomChannel` revisa cada 30 s que su `pubsub_token` siga siendo el del usuario. Si
#      cambió, deja de escuchar y cierra la conexión: el tiempo real se corta a lo sumo 30 s
#      después de la revocación.
#
# Logs: solo el id de Chatwoot del usuario y conteos. Nunca correos ni tokens.
# Prueba local con control sin este archivo: infra/chatwoot/pruebas/prueba-revocar-sesiones.sh.

module DtdRevocarSesiones
  VARIABLE = 'DTD_CHATWOOT_SERVICIO_ID'
  FORMATO_ID = /\A[1-9]\d{0,9}\z/
  CADA = 30 # segundos

  # Id del usuario de servicio, o nil si la variable no sirve. Se lee en cada pedido.
  def self.servicio_id
    valor = ENV.fetch(VARIABLE, '').strip
    FORMATO_ID.match?(valor) ? valor.to_i : nil
  end

  # Motivo para no revocar, o nil.
  def self.rechazo(usuario, servicio_id)
    return :servicio if usuario.id == servicio_id

    usuario.account_users.where(role: :administrator).find_each do |au|
      otros = AccountUser.where(account_id: au.account_id, role: :administrator)
                         .where.not(user_id: [usuario.id, servicio_id])
      return :ultimo_admin_humano unless otros.exists?
    end
    nil
  end

  def self.revocar!(usuario)
    usuario.with_lock do
      sesiones = (usuario.tokens || {}).size
      usuario.update_columns(tokens: {}, pubsub_token: User.generate_unique_secure_token, updated_at: Time.current)
      usuario.user_sessions.destroy_all
      usuario.access_token&.regenerate_token
      sesiones
    end
  end

  module Canal
    def dtd_sesion_revocada?
      return false unless @current_user.is_a?(User)

      !User.exists?(id: @current_user.id, pubsub_token: pubsub_token)
    end

    def dtd_verificar_sesion
      return unless dtd_sesion_revocada?

      stop_all_streams
      # Sin reconectar: el panel ya no tiene sesión, y con el pubsub_token viejo no se suscribe.
      connection.close(reason: 'unauthorized', reconnect: false)
    end
  end
end

Rails.application.config.to_prepare do
  next if defined?(Platform::Api::V1::DtdSesionesController)

  # La ruta vive en el namespace de la Platform API, con su autenticación y su candado de
  # permisibles. `set_resource` y `validate_platform_app_permissible` son de PlatformController.
  controlador = Class.new(PlatformController) do
    before_action :set_resource, only: [:revocar]
    before_action :validate_platform_app_permissible, only: [:revocar]

    def revocar
      servicio = DtdRevocarSesiones.servicio_id
      if servicio.nil?
        Rails.logger.error("[DTD] revocar sesiones: #{DtdRevocarSesiones::VARIABLE} vacía o mal formada; no se revoca")
        return render json: { error: 'servicio_sin_configurar' }, status: :service_unavailable
      end

      motivo = DtdRevocarSesiones.rechazo(@resource, servicio)
      if motivo
        Rails.logger.warn("[DTD] revocar sesiones rechazado: usuario #{@resource.id}, #{motivo}")
        return render json: { error: motivo.to_s }, status: :conflict
      end

      sesiones = DtdRevocarSesiones.revocar!(@resource)
      Rails.logger.info("[DTD] sesiones revocadas: usuario #{@resource.id}, #{sesiones} token(s) del panel")
      render json: { revocadas: sesiones }
    end

    private

    def set_resource
      @resource = User.find(params[:id])
    end
  end
  Platform::Api::V1.const_set(:DtdSesionesController, controlador)

  faltan = %i[stop_all_streams pubsub_token].reject { |m| RoomChannel.private_method_defined?(m) || RoomChannel.method_defined?(m) }
  # Si una versión nueva cambia RoomChannel, el arranque se cae aquí y no en silencio: la
  # prueba de E3 lo detecta antes de llegar al VPS.
  raise "[DTD] revocar sesiones: faltan #{faltan.join(', ')} en RoomChannel" if faltan.any?

  unless RoomChannel <= DtdRevocarSesiones::Canal
    RoomChannel.prepend(DtdRevocarSesiones::Canal)
    RoomChannel.periodically :dtd_verificar_sesion, every: DtdRevocarSesiones::CADA
  end
end

Rails.application.routes.prepend do
  post '/platform/api/v1/users/:id/dtd_revocar_sesiones',
       to: 'platform/api/v1/dtd_sesiones#revocar',
       defaults: { format: 'json' }
end

Rails.logger.info('[DTD] revocación de sesiones activa: POST /platform/api/v1/users/:id/dtd_revocar_sesiones')
