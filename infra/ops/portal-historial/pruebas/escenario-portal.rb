# frozen_string_literal: true

# infra/ops/portal-historial/pruebas/escenario-portal.rb — un escenario entero de la prueba del cargador del portal
# en UN arranque de Rails (SDD-0586 §10.5.10). Lo usan el control M0 y los mutantes de prueba-cargador.sh.
#
# Corre los mismos pasos que la corrida real (preparar, rechazos, seco, tres cargas, el candado, el log de SQL y
# verificar), pero llamando a CargaPortal.principal en el mismo proceso. Deja una salida por paso en SALIDAS, con
# los mismos nombres que la corrida real, para que prueba-cargador.sh las compruebe con las mismas reglas.
# Los vínculos se escriben en la ruta fija, /dev/shm/portal-historial/vinculos.ndjson (montada por la prueba), y
# después de cada paso se mueven a SALIDAS/vinculos-<paso>.ndjson.
#
#   CARGADOR_RB=<copia del cargador, mutada o no>  SALIDAS=<carpeta>
#
# Solo datos inventados.

require 'fileutils'
require 'stringio'

CARGA_PORTAL_COMO_BIBLIOTECA = true
load '/tmp/cargador/sonda-portal.rb'
load ENV.fetch('CARGADOR_RB')

dir = ENV.fetch('SALIDAS')
FileUtils.mkdir_p(dir)
fija = SondaPortal::RUTA_VINCULOS
FileUtils.rm_f([fija, "#{fija}.parcial"])
mover = lambda do |nombre|
  FileUtils.mv(fija, File.join(dir, "vinculos-#{nombre}.ndjson")) if File.exist?(fija)
  FileUtils.mv("#{fija}.parcial", File.join(dir, "vinculos-#{nombre}.parcial")) if File.exist?("#{fija}.parcial")
end
paso = lambda do |nombre, archivo = 'preparado.ndjson', extra = {}|
  SondaPortal.cargar_en_proceso(dir: dir, nombre: nombre, archivo: archivo, extra: extra)
  mover.call(nombre)
end

base = nil
File.open(File.join(dir, 'sonda-preparar.txt'), 'w') { |f| base = SondaPortal.preparar(out: f, dir: dir) }
paso.call('rechazo-webhook', 'preparado.ndjson', 'BANDEJA' => base['con_webhook'].to_s)
paso.call('rechazo-cuenta', 'preparado.ndjson', 'CUENTA' => '999999')
paso.call('rechazo-cabecera', 'preparado-otra-cuenta.ndjson')
paso.call('rechazo-conteos', 'preparado-truncado.ndjson')
paso.call('rechazo-hilo', 'preparado-hilo-ausente.ndjson')
paso.call('rechazo-agente', 'preparado-agente-ajeno.ndjson')
paso.call('rechazo-contacto', 'preparado-sin-contacto.ndjson')
paso.call('rechazo-servicio', 'preparado.ndjson', 'AGENTE_SERVICIO' => base['ajeno'].to_s)
paso.call('rechazo-whatsapp', 'preparado-whatsapp.ndjson', 'BANDEJA' => base['viva'].to_s)
paso.call('rechazo-archivo', 'preparado-archivo.ndjson', 'BANDEJA' => base['archivo'].to_s)
paso.call('rechazo-ruta', 'preparado.ndjson', 'VINCULOS' => '/tmp/vinculos-en-otra-ruta.ndjson')
SondaPortal.candado(dir: dir)
mover.call('rechazo-candado')
paso.call('seco', 'preparado.ndjson', 'MODO' => 'seco')
SondaPortal.con_log(dir: dir)
mover.call('carga-1')
File.open(File.join(dir, 'estados-1.txt'), 'w') { |f| SondaPortal.estados(out: f, dir: dir) }
paso.call('carga-2')
# La tercera, con VINCULOS=-: los vínculos salen con el prefijo `VINCULO ` en la salida estándar, y se extraen.
paso.call('carga-3', 'preparado.ndjson', 'VINCULOS' => '-')
File.write(File.join(dir, 'vinculos-carga-3.ndjson'),
           File.readlines(File.join(dir, 'carga-3.txt')).filter_map { |l| l.delete_prefix('VINCULO ') if l.start_with?('VINCULO ') }.join)
paso.call('rechazo-movido', 'preparado-movido.ndjson')
File.open(File.join(dir, 'sonda-verificar.txt'), 'w') do |f|
  SondaPortal.verificar(out: f, dir: dir)
rescue StandardError => e
  f.puts "HECHO verificar=error:#{e.class}"
end
# Después de verificar: los dos encolan o cambian cosas que la verificación no espera.
paso.call('carga-estado', 'preparado-estado.ndjson')
File.open(File.join(dir, 'estado.txt'), 'w') { |f| SondaPortal.estado(out: f, dir: dir) }
# Las guardas de R4, de a una: cada cambio en Chatwoot y su carga, que tiene que abortar.
%w[mensaje asignada snoozed].each do |cual|
  File.open(File.join(dir, "sonda-guarda-#{cual}.txt"), 'w') { |f| SondaPortal.guardas(out: f, dir: dir, cual: cual) }
  paso.call("rechazo-guarda-#{cual}", "preparado-guarda-#{cual}.ndjson")
end
SondaPortal.concurrencia(dir: dir)
# 4.10: al final, porque deja una restricción en contacts (solo para los nombres SINT-LOG-<esta cuenta>).
SondaPortal.log_postgres(dir: dir)
mover.call('rechazo-log')
mover.call('rechazo-show')
mover.call('rechazo-sin-super')
puts 'HECHO escenario=ok'
