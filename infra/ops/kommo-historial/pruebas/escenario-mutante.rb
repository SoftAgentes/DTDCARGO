# frozen_string_literal: true

# infra/ops/kommo-historial/pruebas/escenario-mutante.rb — un escenario entero de la prueba del cargador en UN
# arranque de Rails (SDD-0590 5.5). Lo usan el control M0 y los mutantes de prueba-cargador.sh.
#
# Corre los mismos pasos que la corrida real (línea base, bandeja dos veces, dos rechazos, seco, dos cargas y la
# verificación), pero llamando a CargaArchivoKommo.principal en el mismo proceso con el archivo de carga como
# entrada, en lugar de un `rails runner` por paso. Deja una salida por paso en SALIDAS, con los mismos nombres
# que la corrida real, para que prueba-cargador.sh las compruebe con las mismas reglas.
#
#   CARGADOR_RB=<copia del cargador, mutada o no>  CARGA_ARCHIVO=<carga.ndjson>  SALIDAS=<carpeta>
#
# Solo datos inventados.

require 'fileutils'
require 'stringio'

load '/tmp/cargador/sonda-cargador.rb'
load ENV.fetch('CARGADOR_RB')

salidas = ENV.fetch('SALIDAS')
carga = ENV.fetch('CARGA_ARCHIVO')
flujo = ENV.fetch('FLUJO_ARCHIVO', '/tmp/estado/flujo.ndjson') # 5.5b: los adjuntos, como los manda flujo-adjuntos
FileUtils.mkdir_p(salidas)
estado = File.join(salidas, 'base.json')
en = ->(nombre, &bloque) { File.open(File.join(salidas, "#{nombre}.txt"), 'w') { |f| bloque.call(f) } }
paso = lambda do |nombre, env, con_carga|
  en.call(nombre) do |f|
    entrada = con_carga ? File.open(con_carga == :flujo ? flujo : carga, encoding: 'UTF-8') : StringIO.new('')
    begin
      CargaArchivoKommo.principal(env, entrada: entrada, salida: f)
    ensure
      entrada.close
    end
  end
end
hecho_de = ->(nombre, clave) { File.read(File.join(salidas, "#{nombre}.txt"))[/^HECHO #{clave}=(.*)$/, 1] }

base = nil
en.call('sonda-preparar') { |f| base = SondaCargador.preparar(out: f, estado: estado) }
cuenta = base['cuenta'].to_s
bandeja_kommo = { 'MODO' => 'crear-bandeja', 'CUENTA' => cuenta, 'NOMBRE' => 'Archivo Kommo' }
paso.call('bandeja-1', bandeja_kommo, false)
bandeja = hecho_de.call('bandeja-1', 'bandeja').to_s
paso.call('bandeja-2', bandeja_kommo, false)
paso.call('rechazo-webhook', { 'MODO' => 'cargar', 'CUENTA' => cuenta, 'BANDEJA' => base['con_webhook'].to_s, 'CARGA' => '-' }, true)
paso.call('rechazo-cuenta', { 'MODO' => 'cargar', 'CUENTA' => '999999', 'BANDEJA' => bandeja, 'CARGA' => '-' }, true)
paso.call('seco', { 'MODO' => 'seco', 'CUENTA' => cuenta, 'BANDEJA' => bandeja, 'CARGA' => '-' }, true)
paso.call('carga-1', { 'MODO' => 'cargar', 'CUENTA' => cuenta, 'BANDEJA' => bandeja, 'CARGA' => '-' }, true)
paso.call('carga-2', { 'MODO' => 'cargar', 'CUENTA' => cuenta, 'BANDEJA' => bandeja, 'CARGA' => '-' }, true)
paso.call('adjuntos-1', { 'MODO' => 'adjuntos', 'CUENTA' => cuenta, 'BANDEJA' => bandeja, 'CARGA' => '-' }, :flujo)
paso.call('adjuntos-2', { 'MODO' => 'adjuntos', 'CUENTA' => cuenta, 'BANDEJA' => bandeja, 'CARGA' => '-' }, :flujo)
en.call('sonda-verificar') do |f|
  SondaCargador.verificar(out: f, estado: estado, bandeja: bandeja)
rescue StandardError => e
  f.puts "HECHO verificar=error:#{e.class}"
end
puts 'HECHO escenario=ok'
