# frozen_string_literal: true

# Mutantes de la redacción de los canales (SDD-0583, seguimiento del 2026-11-05). Los corre
# prueba-redaccion-canales.sh con `bundle exec ruby` en `prepare`, sin arrancar Rails.
#
# Las líneas son las que escribió la imagen en el control, sin el inicializador: valores
# inventados. Se les pasa el filtro entero y luego el filtro con un patrón menos, y TIENE
# que reaparecer el valor de ese patrón. El camino real por el logger de Rails ya lo prueban
# T y C; aquí se prueba que cada patrón es el que tapa su línea.
#
# Imprime una línea `HECHO clave=valor`. El veredicto lo da el script.

require 'active_support'
require 'active_support/parameter_filter'

FILTRO = '/app/config/initializers/zz_dtd_redaccion_logs.rb'
# Fuera lo que no tapan los patrones: `Parameters:` es de filter_parameters y va aparte, abajo;
# `with arguments:` es de ActiveJob, que con el inicializador no los escribe. Si se quedan, un
# valor «reaparece» sin que el patrón tenga que ver: lo detecta `base_fugas`.
CONTROL = File.readlines('/tmp/pruebas/caso-control.txt')
              .reject { |linea| linea.include?('Parameters:') || linea.include?('with arguments:') }.freeze

# Lo mínimo que el inicializador toca al cargar.
module ActiveJob
  class Base
    class << self
      attr_accessor :log_arguments
    end
  end
end

module Rails
  Config = Struct.new(:filter_parameters)
  App = Struct.new(:config)
  Log = Struct.new(:formatter) do
    def info(_mensaje) = nil
  end

  class << self
    def application = (@application ||= App.new(Config.new([])))
    def logger = (@logger ||= Log.new(nil))
    def reiniciar = (@application = nil)
  end
end

def salida_con(fuente)
  Object.send(:remove_const, :DtdRedaccion) if defined?(DtdRedaccion)
  Rails.reiniciar
  eval(fuente, TOPLEVEL_BINDING, FILTRO) # rubocop:disable Security/Eval
  lineas = CONTROL.map { |linea| DtdRedaccion.limpiar(linea) }.join
  parametros = ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters)
                                             .filter('entry' => [{ 'sender' => { 'id' => 'SINT-WEB-IG-REMITENTE' } }])
  "#{lineas}\n#{parametros}"
end

MUTANTES = [
  ['M1', '(Instagram Events Job Messaging: |', '(NO-COINCIDE|', 'SINT-IG53-TEXTO'],
  ['M2', '|Processing Instagram test webhook event, )', '|NO-COINCIDE)', 'SINT-IGTEST-TEXTO'],
  ['M3', '(Instagram response: .*?)', '(NO-COINCIDE: .*?)', 'SINT-IG65-TEXTO'],
  ['M4', '(ig_scope_id |', '(NO-COINCIDE|', '9900000000067'],
  ['M5', '|IG Scope ID: )', '|NO-COINCIDE)', '9900000000070'],
  ['M6', '(Recieved (?:delivery|read) status', '(NO-COINCIDE (?:delivery|read) status', 'SINT-FB-ACUSE-REMITENTE'],
  ['M6b', '(Recieved (?:delivery|read) status', '(NO-COINCIDE (?:delivery|read) status', 'SINT-FB-LEIDO-REMITENTE'],
  ['M7', '(Whatsapp Error: .* - contact: )', '(NO-COINCIDE: .* - contact: )', '13055550180'],
  ['M8', '(Processing contact: )', '(NO-COINCIDE: )', 'SINT-CAMP55'],
  ['M9', '(Skipping contact )', '(NO-COINCIDE )', 'SINT-CAMP64'],
  ['M9b', '(Skipping contact )', '(NO-COINCIDE )', 'SINT-CAMP86'],
  ['M10', '(liquid template params for contact |', '(NO-COINCIDE|', 'SINT-CAMP90'],
  ['M11', '|WhatsApp template message to )', '|NO-COINCIDE)', '13055550114'],
  ['M12', '(identity rotation: )', '(NO-COINCIDE: )', '13055550136'],
  ['M12b', '(identity rotation: )', '(NO-COINCIDE: )', 'SINT-ROT185'],
  ['M13', '(\[ContactInboxBuilder\] RecordNotUnique )', '(NO-COINCIDE )', 'SINT-CIB70'],
  ['M14', '[/\Aentry\z/]', '[/\ANO-COINCIDE\z/]', 'SINT-WEB-IG-REMITENTE']
].freeze

ORIGINAL = File.read(FILTRO)

# Sin mutar, no aparece ninguno: si no, un «reaparece» de abajo no probaría nada.
base = salida_con(ORIGINAL)
puts "HECHO base_lineas=#{CONTROL.size}"
puts "HECHO base_fugas=#{MUTANTES.count { |(_id, _antes, _despues, marca)| base.include?(marca) }}"

MUTANTES.each do |(id, antes, despues, marca)|
  unless ORIGINAL.include?(antes)
    puts "HECHO #{id}=sin_patron"
    next
  end

  puts "HECHO #{id}=#{salida_con(ORIGINAL.sub(antes) { despues }).include?(marca) ? 'reaparece' : 'no_reaparece'}"
end

puts 'HECHO mutantes=ok'
