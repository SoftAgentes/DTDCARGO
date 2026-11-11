# frozen_string_literal: true

# DTD Cargo · rebotes y respuestas automáticas del correo fuera de la cola (SDD-0582, paso 4.8, P4).
#
# NO ESTÁ INSTALADO. Instalarlo es una puerta con OK nominal de Sam (e4-correo.md §6.3): se monta en
# solo lectura en /app/config/initializers/zz_dtd_correo_sistema.rb de rails y sidekiq, igual que
# rails/zz_dtd_correo.rb, y se reinicia Chatwoot.
#
# Por qué. Medido en PC-1 (P4) y en la etiqueta v4.19.1 de chatwoot/chatwoot:
#   · app/mailboxes/imap/imap_mailbox.rb crea una conversación APARTE para cada rebote o respuesta
#     automática que no se enhebra, con additional_attributes['auto_reply'] = true
#     (MailPresenter#auto_reply?: cabecera Auto-Submitted distinta de «no», o X-Autoreply: yes).
#   · app/listeners/automation_rule_listener.rb salta esas conversaciones en conversation_created y
#     conversation_opened (ignore_auto_reply_event?) y sus mensajes en message_created
#     (auto_reply_email?). Ninguna regla de Chatwoot puede etiquetarlas ni resolverlas: quedan
#     abiertas en la cola y el rebote cita el correo original completo.
#
# Qué hace. Solo cuando el buzón IMAP acaba de CREAR una conversación automática y sigue abierta:
#   1. le pone la etiqueta «sistema» (la de §4.1 del diseño; la etiqueta se crea en PC-3);
#   2. la resuelve;
#   3. deja una nota de actividad en español que dice por qué.
# No toca nada más:
#   · una respuesta automática que se enhebra a una conversación que ya existía (In-Reply-To o
#     References) la deja como está, porque esa conversación es de alguien;
#   · lo que ya nace resuelto (contacto bloqueado) no se toca;
#   · no borra nada. Si después escribe una persona en ese hilo, Chatwoot reabre la conversación
#     como siempre (Message#reopen_conversation).
#   · las reglas de Chatwoot siguen igual para todo lo demás.
#
# Autor de la acción: Current.executed_by = la bandeja, como hacen los servicios de asignación de
# Chatwoot. Así Chatwoot no escribe su nota «resolved by system due to 0 minutes of inactivity»,
# que sería falsa, y los eventos llevan performed_by = Inbox, que sus listeners ya conocen.
#
# Si cambia en una versión nueva: Imap::ImapMailbox#process o #find_or_create_conversation, o
# ActivityMessageHandler#automation_status_change_activity_content. Si desaparece la clase o uno de
# los dos métodos, el inicializador no hace nada y lo dice en el log: Rails y sidekiq arrancan igual
# y la lectura del correo no se rompe (la clase se busca con safe_constantize, no por su nombre).
#
# Encuesta de satisfacción (CSAT): CsatSurveyListener la manda al resolver si la bandeja la tiene
# encendida. Aquí le llegaría a MAILER-DAEMON o a un contestador, y podría armar un bucle de rebotes.
# Por eso la encuesta de las bandejas de correo queda APAGADA (e4-correo.md §6.3); la sonda comprueba
# que este inicializador no manda ningún correo.
#
# Logs: solo números de conversación y de bandeja, nunca direcciones ni asuntos.
# Prueba con la imagen real, control sin este archivo y mutantes:
# infra/chatwoot/pruebas/prueba-correo-sistema.sh (en GitHub Actions: chatwoot-correo-sistema.yml).
module DtdCorreoSistema
  ETIQUETA = 'sistema'
  NOTA = 'Correo automático (rebote o respuesta automática): DTD le puso la etiqueta «sistema» y ' \
         'lo resolvió. Si es de un cliente, ábrelo otra vez.'

  module Buzon
    def process(*)
      @dtd_conversacion_nueva = false
      resultado = super
      DtdCorreoSistema.ordenar(@conversation) if @dtd_conversacion_nueva
      resultado
    end

    private

    def find_or_create_conversation(*)
      conversacion = super
      @dtd_conversacion_nueva = conversacion.respond_to?(:previously_new_record?) && conversacion.previously_new_record? # [nueva]
      conversacion
    end
  end

  def self.aplica?(conversacion)
    return false if conversacion.nil?
    return false unless conversacion.additional_attributes.to_h['auto_reply'] == true # [automatico]
    return false unless conversacion.open? # [abierta]

    true
  end

  def self.ordenar(conversacion)
    return unless aplica?(conversacion)

    con_autor(conversacion.inbox) do # [autor]
      conversacion.add_labels([ETIQUETA]) # [etiqueta]
      conversacion.resolved! # [resolver]
      ::Conversations::ActivityMessageJob.perform_now( # [nota]
        conversacion,
        { account_id: conversacion.account_id, inbox_id: conversacion.inbox_id, message_type: :activity, content: NOTA }
      )
    end
    Rails.logger.info("[DTD] correo automático: conversación #{conversacion.display_id} de la bandeja " \
                      "#{conversacion.inbox_id} con etiqueta «#{ETIQUETA}» y resuelta")
  rescue StandardError => e
    Rails.logger.error("[DTD] correo automático: no se pudo ordenar la conversación #{conversacion&.id} (#{e.class})")
  end

  def self.con_autor(autor)
    anterior = Current.executed_by
    Current.executed_by = autor
    yield
  ensure
    Current.executed_by = anterior
  end

  CLASE = 'Imap::ImapMailbox'

  # Devuelve true si quedó instalado. Nunca levanta por una clase o un método que falte: lo dice en el log.
  def self.instalar(nombre = CLASE)
    buzon = nombre.safe_constantize # [clase]
    unless buzon.is_a?(Class) && buzon.method_defined?(:process) && buzon.private_method_defined?(:find_or_create_conversation)
      Rails.logger.error("[DTD] correo automático NO activo: falta #{nombre}, o ya no tiene #process o " \
                         '#find_or_create_conversation (revisar zz_dtd_correo_sistema.rb)')
      return false
    end

    buzon.prepend(Buzon) unless buzon <= Buzon
    Rails.logger.info('[DTD] correo automático activo (zz_dtd_correo_sistema.rb)')
    true
  end
end

Rails.application.config.to_prepare { DtdCorreoSistema.instalar }
