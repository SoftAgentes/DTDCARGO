# frozen_string_literal: true

# SDD-0587, paso 6.4 · Cuenta de Chatwoot solo para el entorno de prueba de Studio.
# Decisión de Sam, 2026-11-03: «Probar WhatsApp al publicar». docs/runbooks/chatwoot-bandeja.md,
# «Prueba no se conecta a la cuenta real». Ensayada en local con
# infra/chatwoot/pruebas/prueba-cuenta-prueba.sh.
#
# Crea una Platform App propia, para que su token no alcance la cuenta real; una cuenta con
# una bandeja API y una de correo sin IMAP ni SMTP; dos equipos, y dos usuarios `example.test`
# con las notificaciones apagadas. No conecta ningún canal, no crea webhooks y no envía nada.
#
# Se corre con `rails runner`. Imprime `OUT clave=valor` sin secretos, y `SECRETO NOMBRE=valor`,
# que quien lo corre guarda en secretos/platform-app-prueba.env sin mostrarlo.

require 'securerandom'

module CuentaPrueba
  CUENTA = 'DTD Prueba'
  APP = 'Studio prueba'
  USUARIOS = {
    servicio: ['Servicio prueba', 'servicio-prueba@example.test'],
    admin: ['Admin prueba', 'admin-prueba@example.test']
  }.freeze
  CORREO_BANDEJA = 'bandeja-prueba@example.test'

  module_function

  def usuario!(app, cuenta, nombre, correo)
    usuario = User.new(name: nombre, email: correo, password: "Pw-#{SecureRandom.hex(24)}-a1!")
    usuario.skip_confirmation!
    usuario.save!
    app.platform_app_permissibles.create!(permissible: usuario)
    AccountUser.create!(account: cuenta, user: usuario, role: :administrator)
    usuario
  end

  def bandeja!(cuenta, nombre, canal)
    Inbox.create!(account: cuenta, name: nombre, channel: canal)
  end

  def crear!
    correos = USUARIOS.values.map(&:last) + [CORREO_BANDEJA]
    raise 'la app o la cuenta de prueba ya existen: no toco nada' if PlatformApp.exists?(name: APP) || Account.exists?(name: CUENTA)
    # POST /users adopta un usuario existente por correo: aquí se exige que no exista.
    raise 'un correo de prueba ya existe: no toco nada' if User.exists?(email: correos) || Channel::Email.exists?(email: CORREO_BANDEJA)

    r = {}
    ActiveRecord::Base.transaction do
      r[:app] = PlatformApp.create!(name: APP)
      r[:cuenta] = Account.create!(name: CUENTA, locale: 'es')
      r[:app].platform_app_permissibles.create!(permissible: r[:cuenta])
      r[:servicio] = usuario!(r[:app], r[:cuenta], *USUARIOS[:servicio])
      r[:admin] = usuario!(r[:app], r[:cuenta], *USUARIOS[:admin])
      r[:api] = bandeja!(r[:cuenta], 'Prueba API', Channel::Api.create!(account: r[:cuenta]))
      r[:correo] = bandeja!(r[:cuenta], 'Prueba correo', Channel::Email.create!(account: r[:cuenta], email: CORREO_BANDEJA))
      r[:clientes] = r[:cuenta].teams.create!(name: 'clientes')
      r[:leads] = r[:cuenta].teams.create!(name: 'leads')
    end
    # El ajuste de notificaciones nace al confirmar la transacción (AccountUser, after_create_commit).
    NotificationSetting.where(account_id: r[:cuenta].id).find_each do |ajuste|
      ajuste.selected_email_flags = []
      ajuste.selected_push_flags = []
      ajuste.save!
    end
    r
  end

  def imprimir(r)
    puts "OUT cuenta=#{r[:cuenta].id}"
    puts "OUT servicio=#{r[:servicio].id}"
    puts "OUT admin=#{r[:admin].id}"
    puts "OUT bandeja_api=#{r[:api].id}"
    puts "OUT bandeja_correo=#{r[:correo].id}"
    puts "OUT equipo_clientes=#{r[:clientes].id}"
    puts "OUT equipo_leads=#{r[:leads].id}"
    puts "SECRETO CHATWOOT_PLATFORM_TOKEN=#{r[:app].access_token.token}"
    puts "SECRETO CHATWOOT_ACCOUNT_ID=#{r[:cuenta].id}"
    puts "SECRETO CHATWOOT_SERVICE_USER_ID=#{r[:servicio].id}"
  end
end

CuentaPrueba.imprimir(CuentaPrueba.crear!) unless defined?(CUENTA_PRUEBA_SIN_CORRER)
