# frozen_string_literal: true

# DTD Cargo · redacción de logs de Chatwoot (SDD-0583, paso 1.7 del programa SDD-0582).
#
# Se monta en solo lectura en /app/config/initializers/zz_dtd_redaccion_logs.rb
# (infra/chatwoot/compose.yml). El prefijo `zz_` lo hace cargar después de los
# inicializadores de Chatwoot, sobre todo de sidekiq.rb, que fija el formato JSON.
#
# Qué fugas tapa, medidas en la imagen v4.19.1-ce:
#   1. app/jobs/agent_bots/webhook_job.rb:13 escribe `payload=#{payload.to_json}` en
#      cada reintento (CW-4): el mensaje completo del cliente, con su nombre y teléfono.
#   2. ActiveJob escribe los argumentos de cada trabajo al encolarlo y al ejecutarlo
#      (`log_arguments` es true por defecto): los webhooks llevan el payload entero.
#   3. El manejador de errores por defecto de Sidekiq 7.3 (Sidekiq::Config::ERROR_HANDLER)
#      vuelca el trabajo completo, con sus `args`, cuando un trabajo falla.
#   4. Rails filtra contraseñas y tokens de los parámetros (filter_parameter_logging.rb),
#      pero no correos, teléfonos, contenido de mensajes ni búsquedas.
#
# Cómo: (a) apaga los argumentos de ActiveJob, (b) cambia el manejador de errores de
# Sidekiq por uno que no imprime `args`, (c) suma campos a filter_parameters y
# (d) pasa cada línea de log por un filtro de patrones (payload=, correos, teléfonos)
# como segunda red. La prueba con datos sintéticos, con su control sin este archivo,
# es infra/chatwoot/pruebas/prueba-redaccion.sh.

module DtdRedaccion
  MARCA = '[REDACTADO]'

  PATRONES = [
    # Fuga 1: todo lo que sigue a `payload=` hasta el final de la línea.
    [/payload=.*/, "payload=#{MARCA}"],
    # Fuga 3 por si otro manejador la repite: el arreglo `args` del JSON de Sidekiq.
    [/"args":\[.*?\](?=,"[a-z_]+":|\})/, %("args":"#{MARCA}")],
    # Correos.
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, '[correo]'],
    # Teléfonos en E.164 con `+` (con o sin espacios) y los venezolanos y chinos sin `+`
    # (58 o 86 seguidos de 9 a 11 dígitos). No toca fechas ni ids cortos.
    [/\+\d[\d ]{6,16}\d/, '[telefono]'],
    [/(?<!\d)(?:58|86)\d{9,11}(?!\d)/, '[telefono]']
  ].freeze

  def self.limpiar(texto)
    return texto unless texto.is_a?(String)

    PATRONES.reduce(texto) { |acc, (patron, reemplazo)| acc.gsub(patron, reemplazo) }
  rescue StandardError
    # Un log nunca debe tumbar la app; si el filtro falla, no se escribe la línea.
    "#{MARCA} (filtro de logs falló)\n"
  end

  module Formateador
    def call(severity, time, progname, msg)
      DtdRedaccion.limpiar(super)
    end
  end

  def self.envolver(logger)
    return if logger.nil?

    destinos = logger.respond_to?(:broadcasts) ? logger.broadcasts : [logger]
    destinos.each do |destino|
      formateador = destino.formatter
      next if formateador.nil? || formateador.singleton_class.include?(Formateador)

      formateador.singleton_class.prepend(Formateador)
    end
  end

  # Igual que Sidekiq::Config::ERROR_HANDLER, sin el contenido del trabajo.
  MANEJADOR_SIDEKIQ = lambda do |ex, ctx, cfg = Sidekiq.default_configuration|
    trabajo = ctx[:job].is_a?(Hash) ? ctx[:job].slice('class', 'wrapped', 'jid', 'queue', 'retry_count') : nil
    resumen = ctx.except(:job).merge(job: trabajo).compact
    cfg.logger.warn(Sidekiq.dump_json(resumen)) unless resumen.empty?
    cfg.logger.warn("#{ex.class.name}: #{DtdRedaccion.limpiar(ex.message.to_s)}")
    cfg.logger.warn(cfg[:backtrace_cleaner].call(ex.backtrace).join("\n")) unless ex.backtrace.nil?
  end
end

# (a) Sin argumentos de trabajos en los logs de ActiveJob.
ActiveJob::Base.log_arguments = false

# (c) Más campos filtrados en los parámetros que Rails escribe en cada pedido.
Rails.application.config.filter_parameters += %i[
  email phone_number phone content message name q search query identifier
]

# (d) Filtro de patrones en el logger de Rails (también lo usan ActiveJob y ActiveRecord).
DtdRedaccion.envolver(Rails.logger)

if defined?(Sidekiq)
  Sidekiq.configure_server do |config|
    # (b) Fuera el manejador que vuelca `args`; los demás (si Chatwoot agrega alguno) quedan.
    config.error_handlers.delete(Sidekiq::Config::ERROR_HANDLER) if defined?(Sidekiq::Config::ERROR_HANDLER)
    config.error_handlers << DtdRedaccion::MANEJADOR_SIDEKIQ
    DtdRedaccion.envolver(config.logger)
  end
end

Rails.logger.info('[DTD] redacción de logs activa (zz_dtd_redaccion_logs.rb)')
