# frozen_string_literal: true

# infra/ops/portal-historial/pruebas/escenario-portal.rb — un escenario entero de la prueba del cargador del portal
# en UN arranque de Rails (SDD-0586 §10.5.10). Lo usan el control M0 y los mutantes de prueba-cargador.sh.
#
# Corre los mismos pasos que la corrida real (preparar, rechazos, seco, dos cargas y verificar), pero llamando a
# CargaPortal.principal en el mismo proceso. Deja una salida por paso en SALIDAS, con los mismos nombres que la
# corrida real, para que prueba-cargador.sh las compruebe con las mismas reglas.
#
#   CARGADOR_RB=<copia del cargador, mutada o no>  SALIDAS=<carpeta>
#
# Solo datos inventados.

require 'fileutils'
require 'stringio'

load '/tmp/cargador/sonda-portal.rb'
load ENV.fetch('CARGADOR_RB')

dir = ENV.fetch('SALIDAS')
FileUtils.mkdir_p(dir)
en = ->(nombre, &bloque) { File.open(File.join(dir, "#{nombre}.txt"), 'w') { |f| bloque.call(f) } }
paso = lambda do |nombre, env, archivo|
  en.call(nombre) do |f|
    File.open(File.join(dir, archivo), encoding: 'UTF-8') do |entrada|
      CargaPortal.principal(env, entrada: entrada, salida: f, errores: f)
    end
  end
end

base = nil
en.call('sonda-preparar') { |f| base = SondaPortal.preparar(out: f, dir: dir) }
c = base['cuenta'].to_s
b = base['portal'].to_s
s = base['admin'].to_s
env = ->(modo, extra = {}) { { 'MODO' => modo, 'CUENTA' => c, 'BANDEJA' => b, 'AGENTE_SERVICIO' => s, 'CARGA' => '-' }.merge(extra) }
paso.call('rechazo-webhook', env.call('cargar', 'BANDEJA' => base['con_webhook'].to_s, 'VINCULOS' => "#{dir}/v-x.ndjson"), 'preparado.ndjson')
paso.call('rechazo-cuenta', env.call('cargar', 'CUENTA' => '999999', 'VINCULOS' => "#{dir}/v-x.ndjson"), 'preparado.ndjson')
paso.call('rechazo-cabecera', env.call('cargar', 'VINCULOS' => "#{dir}/v-x.ndjson"), 'preparado-otra-cuenta.ndjson')
paso.call('rechazo-conteos', env.call('cargar', 'VINCULOS' => "#{dir}/v-x.ndjson"), 'preparado-truncado.ndjson')
paso.call('rechazo-hilo', env.call('cargar', 'VINCULOS' => "#{dir}/v-x.ndjson"), 'preparado-hilo-ausente.ndjson')
paso.call('rechazo-agente', env.call('cargar', 'VINCULOS' => "#{dir}/v-x.ndjson"), 'preparado-agente-ajeno.ndjson')
paso.call('rechazo-contacto', env.call('cargar', 'VINCULOS' => "#{dir}/v-x.ndjson"), 'preparado-sin-contacto.ndjson')
paso.call('rechazo-servicio', env.call('cargar', 'AGENTE_SERVICIO' => base['ajeno'].to_s, 'VINCULOS' => "#{dir}/v-x.ndjson"), 'preparado.ndjson')
paso.call('seco', env.call('seco', 'VINCULOS' => "#{dir}/v-seco.ndjson"), 'preparado.ndjson')
paso.call('carga-1', env.call('cargar', 'VINCULOS' => "#{dir}/vinculos-1.ndjson"), 'preparado.ndjson')
paso.call('carga-2', env.call('cargar', 'VINCULOS' => "#{dir}/vinculos-2.ndjson"), 'preparado.ndjson')
# La tercera, con VINCULOS=-: los vínculos van a la salida estándar y los HECHO a la de errores (como en el VPS).
File.open(File.join(dir, 'vinculos-3.ndjson'), 'w') do |v|
  File.open(File.join(dir, 'carga-3.txt'), 'w') do |f|
    File.open(File.join(dir, 'preparado.ndjson'), encoding: 'UTF-8') do |entrada|
      CargaPortal.principal(env.call('cargar', 'VINCULOS' => '-'), entrada: entrada, salida: v, errores: f)
    end
  end
end
en.call('sonda-verificar') do |f|
  SondaPortal.verificar(out: f, dir: dir)
rescue StandardError => e
  f.puts "HECHO verificar=error:#{e.class}"
end
puts 'HECHO escenario=ok'
