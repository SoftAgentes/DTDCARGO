# frozen_string_literal: true

# SDD-0583 · correo de DTD Cargo en Chatwoot (v4.19.1-ce).
#
# Se monta solo lectura sobre la imagen, igual que zz_dtd_redaccion_logs.rb, y hace dos cosas:
#   1. antepone /app/dtd-correo/views (infra/chatwoot/correo/views) a las vistas de los
#      correos: esas plantillas ganan sobre las de la imagen y sobre las guardadas en la base;
#   2. pone en español, con la marca, los asuntos que Chatwoot escribe en inglés en el código.
# Un correo que no esté aquí sale con su asunto de Chatwoot y con el diseño de DTD (layout).
# Si la carpeta no está montada no cambia nada: Chatwoot sigue con sus plantillas.
module DtdCorreo
  VISTAS = '/app/dtd-correo/views'

  module Asuntos
    def mail(headers = {}, &)
      asunto = DtdCorreo.asunto(self)
      headers = headers.merge(subject: asunto) if asunto
      super
    end
  end

  def self.asunto(mailer)
    n = mailer.instance_variable_get(:@conversation)&.display_id
    case [mailer.class.name, mailer.action_name]
    when %w[Devise::Mailer reset_password_instructions] then 'Elige una contraseña nueva · DTD Cargo'
    when %w[Devise::Mailer confirmation_instructions] then asunto_confirmacion(mailer.instance_variable_get(:@resource))
    when %w[Devise::Mailer password_change] then 'Tu contraseña cambió · DTD Cargo'
    when %w[AgentNotifications::ConversationNotificationsMailer conversation_creation]
      "Conversación nueva ##{n} · DTD Cargo"
    when %w[AgentNotifications::ConversationNotificationsMailer conversation_assignment]
      "Te asignaron la conversación ##{n} · DTD Cargo"
    when %w[AgentNotifications::ConversationNotificationsMailer conversation_mention]
      "Te mencionaron en la conversación ##{n} · DTD Cargo"
    when %w[AgentNotifications::ConversationNotificationsMailer assigned_conversation_new_message]
      "Mensaje nuevo en tu conversación ##{n} · DTD Cargo"
    when %w[AgentNotifications::ConversationNotificationsMailer participating_conversation_new_message]
      "Mensaje nuevo en la conversación ##{n} · DTD Cargo"
    when %w[AdministratorNotifications::ChannelNotificationsMailer whatsapp_disconnect]
      'Se venció la conexión de WhatsApp · DTD Cargo'
    when %w[AdministratorNotifications::ChannelNotificationsMailer instagram_disconnect]
      'Se venció la conexión de Instagram · DTD Cargo'
    when %w[AdministratorNotifications::ChannelNotificationsMailer facebook_disconnect]
      'Se venció la conexión de Facebook · DTD Cargo'
    when %w[AdministratorNotifications::ChannelNotificationsMailer email_disconnect]
      'Se desconectó una bandeja de correo · DTD Cargo'
    when %w[EmailDeliveryTestMailer delivery_test] then 'Correo de prueba · DTD Cargo'
    end
  end

  # Mismos cuatro casos que la plantilla confirmation_instructions.html.erb.
  def self.asunto_confirmacion(usuario)
    return 'Confirma tu correo · DTD Cargo' unless usuario
    return 'Confirma tu correo nuevo · DTD Cargo' if usuario.unconfirmed_email.present?
    return 'Tu cuenta ya está activa · DTD Cargo' if usuario.confirmed?
    return 'Te invitaron al chat de DTD Cargo' if usuario.account_users.first&.inviter.present?

    'Confirma tu correo · DTD Cargo'
  end

  def self.instalar
    return unless File.directory?(VISTAS)

    ApplicationMailer.prepend_view_path(VISTAS) unless ApplicationMailer.view_paths.map(&:to_s).include?(VISTAS)
    ApplicationMailer.prepend(Asuntos) unless ApplicationMailer < Asuntos
  end
end

Rails.application.config.to_prepare { DtdCorreo.instalar }
