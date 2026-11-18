# frozen_string_literal: true

# Sonda de la prueba de redacción (SDD-0583, paso 1.7). Solo datos SINTÉTICOS.
# Corre con `rails runner` dentro del contenedor rails de la prueba local.
#
# Ejercita los caminos reales de la imagen, no copias:
#   1. AgentBots::WebhookJob#perform → línea 13 (`payload=#{payload.to_json}`), forzando
#      el RetryableError que la dispara. retry_on vuelve a encolar el trabajo, así que
#      ActiveJob también registra sus argumentos al encolar y Sidekiq al ejecutar.
#   2. Un trabajo de Sidekiq con una clase que no existe: el manejador de errores por
#      defecto vuelca el trabajo con sus `args`.
# El pedido HTTP con correo y teléfono en la query lo hace ensayo-local.sh con curl.

payload = {
  event: 'message_created',
  content: 'MARCA-SINTETICA-E1 necesito cotizar un envio',
  sender: {
    name: 'Ana Sintetica',
    email: 'ana.sintetica.e1@example.test',
    phone_number: '+584125550101'
  }
}

Webhooks::Trigger.class_eval do
  def execute
    raise Webhooks::Trigger::RetryableError.new(status: 500, message: 'falla sintetica de la sonda')
  end
end

begin
  AgentBots::WebhookJob.perform_now('http://webhook-sintetico.invalid/', payload)
rescue StandardError => e
  puts "sonda: perform_now terminó con #{e.class}"
end

Sidekiq::Client.push('class' => 'DtdClaseInexistenteSonda', 'queue' => 'default',
                     'args' => [payload.as_json], 'retry' => false)
puts 'sonda: OK'
