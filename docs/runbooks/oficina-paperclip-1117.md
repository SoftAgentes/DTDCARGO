# Guion de ejecución · Paperclip 2026.1117.0 en la Oficina

Dueño de la decisión: Sam (Junta de la Oficina) · Estado: **escrito, sin ejecutar** · 2026-11-26

Acompaña el [anexo de evaluación](../organizacion/oficina-agentes/actualizacion-paperclip-hermes.md#anexo-del-26-de-noviembre-de-2026--destino-paperclip-202611170), la [PR #409](https://github.com/SoftAgentes/DTDCARGO/pull/409) y el [guion 1106](oficina-paperclip-1106.md). Las lecturas y la intervención requieren sus respectivos OK de Sam, con el VPS de la Oficina nombrado en el chat de quien opera. Una lectura de DTD Cargo y un OK de documentación tienen alcances distintos.

## 1. Punto de partida y salida esperada

| Pieza | Línea base [MEDIDO] | Puerta |
| --- | --- | --- |
| Paperclip y modo de instalación | NO EJECUTADO | 2026.1012.0 o 2026.1106.0, gestionado por npm, unidad manual |
| Base y almacenamiento de skills | NO EJECUTADO | PostgreSQL embebido, rutas dentro de las copias aprobadas, diario y activos verificados |
| Node del servicio y CLI bajo cada perfil | NO EJECUTADO | Node ≥24.11.0, binarios y perfiles existentes identificados |
| Unidad, envoltorios, puente, políticas, rutinas y permisos | NO EJECUTADO | Vía de acceso y huellas cotejadas con la Oficina, perfiles legados, permisos de cada actor documentados |
| Resultado de la ventana | NO EJECUTADO | 1117, 450 migraciones, unidad estable, readiness y smoke de §7 |

[CÓDIGO] Con 1012 se preparan las comprobaciones y cambios de la #409, y se instala directamente 1117. Diario esperado en origen 304 entradas, por confirmar contra el corte y consultas del guion 1106. Con 1106, verificar su origen de 373 entradas y aplicar 77 pendientes. En ambos casos la versión y el último asiento importan tanto como el conteo. [Diario 1117](https://github.com/paperclipai/paperclip/blob/v2026.1117.0/packages/db/src/migrations/meta/_journal.json)

## 2. Qué decide Sam

| Momento | Decisión |
| --- | --- |
| Antes de T-15 | Nombrar el VPS de la Oficina y autorizar sus lecturas. Confirmar operador y ventana sin escrituras concurrentes. |
| Al abrir | Autorizar la intervención y una vuelta atrás completa. Confirmar destino de la copia durable independiente, congelación de altas, corte de entradas y las pruebas de §7 que crean o cancelan tareas. Confirmar el responsable de permisos de §6. |
| A los 30 minutos de caída | Con migraciones observadas avanzando, Sam puede autorizar esperar hasta 45 minutos. Ante fallo explícito o falta de progreso comprobable, decidir retroceder. |
| Al cierre | Dar visto bueno tras leer versión, readiness, diario, permisos y smoke. Enviar el mensaje de prueba del puente. |

[INFERENCIA] Estimación de caída de 20–45 min, incluida la copia verificada y comprobaciones antes de reabrir las entradas. Reservar 60 min y margen para restaurar. Medir tamaños y velocidad de copia antes de fijar la ventana. Tomar la duración real desde el stop inicial al smoke del puente. Hermes permanece en su versión actual.

## 3. T-15 · lecturas y preparación

### 3.1 Desde la PC

~~~bash
gh release view v2026.1117.0 -R paperclipai/paperclip --json tagName,publishedAt,isPrerelease
gh release view -R paperclipai/paperclip --json tagName,publishedAt
gh issue view 17208 -R paperclipai/paperclip --json number,state,updatedAt
gh search issues --repo paperclipai/paperclip "1117" --state open --limit 40
~~~

Revisar los reportes sobre migración, restauración, arranque del runner, permisos y salida de pausa. Si 1117 tiene un parche estable posterior o hay un defecto que afecta la ruta de la Oficina, aplazar y reevaluar el pin. [ISSUE] #17208 seguía abierto el 26 de noviembre. [Issue del umask](https://github.com/paperclipai/paperclip/issues/17208)

### 3.2 En el VPS de la Oficina, tras el OK de lectura

En Bash del operador, usar la misma cuenta de servicio y directorio de runtime que el guion 1106:

~~~bash
A() { sudo -n -u agentes -H env XDG_RUNTIME_DIR="/run/user/$(id -u agentes)" bash -lc "$1"; }
A 'paperclipai --version; node --version'
A 'paperclipai update --help | grep -E -- "--(version|dry-run|no-backup)"'
A 'systemctl --user show paperclip.service -p LoadState -p ActiveState -p Type -p KillMode -p Restart -p RestartUSec -p TimeoutStopUSec'
A 'systemctl --user show paperclipai.service -p LoadState'
sudo -n systemctl show paperclipai.service -p LoadState
sudo -n systemctl is-active dtd-alfred-bridge.service dtd-hermes-telegram.service
~~~

La unidad manual tiene que estar activa y la gestionada `paperclipai.service` ausente en ambos ámbitos. Confirmar que el Node de la unidad y el de las lecturas coinciden, así como el modo de instalación y el almacenamiento real. Confirmar help antes de usar `A 'paperclipai update --version 2026.1117.0 --dry-run'`. La salida del dry-run debe identificar el pin exacto y el modo gestionado npm. Guardar resultados resumidos, sin volcar entornos o configuración.

Usar los chequeos de solo lectura del [§3.2 del guion 1106](oficina-paperclip-1106.md#32-en-el-vps-en-solo-lectura-a-t-15-minutos), con el binario y el diario del origen. La comprobación del diario se hace en una transacción de solo lectura; si el script necesita adaptación a 1117, validarla con el esquema del tag antes de la ventana. Registrar el conteo de migraciones, cambios A/B, incidentes, skills, roles efectivos de los agentes, concesiones de lectura y denegación de altas, resumen de las ocho políticas y horarios de rutinas. Si la autorización de lectura no cubre esas consultas, completar la ficha en otro turno autorizado antes del stop. Nunca copiar valores de claves. Comprobar que el almacenamiento de skills, de la base y las rutas externas del §4 están cubiertos, que el destino durable acepta la copia y que se puede verificar y restaurar.

**Seguir si** hay cero corridas activas, ningún disparo hasta el final más 30 min, envoltorios efectivos y perfiles legados identificados, ausencia de entrada simultánea, sin operaciones ajenas en el host y con una copia durable independiente disponible. Si la ruta constatada difiere de §1 o la ventana depende de cambios previos de 1012 todavía sin aprobar, parar antes de modificar el VPS.

## 4. Detener y tomar la copia en frío

Tras el OK de ventana, pausar entradas por la Oficina, congelar altas y vaciar corridas sin dejar trabajos que deban recuperarse al arrancar. Detener puente y unidad manual:

~~~bash
sudo -n systemctl stop dtd-alfred-bridge.service
A 'systemctl --user stop paperclip.service'
A 'systemctl --user show paperclip.service -p ActiveState -p MainPID'
sleep 30
A 'systemctl --user show paperclip.service -p ActiveState -p MainPID'
~~~

Debe dar dos veces `inactive` y `MainPID=0`; comprobar también que PostgreSQL embebido cerró y que las entradas del puente quedaron retenidas. Mantenerlo detenido hasta §7. Respaldar ahora los árboles completos. Usar el procedimiento y comandos del [§4 del guion 1106](oficina-paperclip-1106.md#4-detener-y-respaldo-en-frío), con sello 1117, sin arranque intermedio, incluyendo la copia root de skills por perfil. Añadir `~/.config/systemd/user/paperclip.service.d/` si existe y anotar su ausencia si no existe. Inventariar y copiar cualquier almacenamiento de skills o estado del puente fuera de los archivos del §4 en el mismo punto en frío. Conservar dueño/modos y archivos de la cuenta de servicio en el dominio privado aprobado, con directorios 700 y archivos 600 como máximo.

Verificar `sha256sum -c` y `tar -tzf` en cada archivo de respaldo, manteniendo el listado en el host y registrando únicamente el resultado. Hacer la copia al destino durable acordado y repetir ahí la verificación de huellas y legibilidad. La copia local y la durable deben corresponder al mismo corte. Antes del update deben constar el directorio exacto de restauración, los archivos, el mapa de orígenes externos y la identidad de quien custodia la copia. Cualquier falta en esta etapa detiene el update; si todavía se conserva el corte original intacto, volver a arrancar el origen por decisión del operador.

## 5. Instalar y arrancar el destino

Instalar el pin con la unidad manual detenida y la copia fría verificada.

~~~bash
A 'umask 022; paperclipai update --version 2026.1117.0 --no-backup'
A 'paperclipai --version'
A 'paperclipai update --help | grep -E -- "--(version|dry-run|no-backup)"'
A 'systemctl --user show paperclip.service -p ActiveState -p MainPID'
~~~

Debe identificar 2026.1117.0 y dejar la unidad detenida. Si el instalador dice que reinició o hizo rollback, detener inmediatamente, preservar observaciones y aplicar §8. [CÓDIGO] La CLI puede reiniciar una unidad gestionada activa y revertir solo el programa si falla su validación. [Implementación del actualizador](https://github.com/paperclipai/paperclip/blob/v2026.1117.0/cli/src/commands/update.ts)

Aplicar el drop-in únicamente a la unidad manual. Si ya existe un archivo con ese nombre o hay una unidad de tipo incompatible, parar y revisar el plan de reemplazo. Conservar `ExecStart`, el entorno y la configuración de la unidad real.

~~~bash
A '
set -e
umask 077
dir="$HOME/.config/systemd/user/paperclip.service.d"
mkdir -p "$dir"
file="$dir/90-paperclip-1117.conf"
test ! -e "$file"
(
  set -o noclobber
  cat > "$file" <<EOF
[Unit]
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
KillMode=mixed
Restart=on-failure
RestartSec=5s
TimeoutStopSec=300s
EOF
)
systemctl --user daemon-reload
systemctl --user show paperclip.service -p Type -p KillMode -p Restart -p RestartUSec -p TimeoutStopUSec -p StartLimitIntervalUSec -p StartLimitBurst
'
~~~

Con los valores efectivos verificados, arrancar una vez y observar:

~~~bash
A 'systemctl --user start paperclip.service'
A 'systemctl --user show paperclip.service -p ActiveState -p SubState -p NRestarts -p Result'
for i in $(seq 1 60); do
  status=$(curl --max-time 3 -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/ready)
  printf '%s ready=%s\n' "$(date -u +%FT%TZ)" "$status"
  test "$status" = 200 && break
  sleep 10
done
~~~

Leer el journal en el host únicamente para seguir migraciones, tiempos y errores, y trasladar al acta solo el resumen sanitizado. [CÓDIGO] `/api/ready` es la ruta de disponibilidad para arranque; validar además `/api/health` y versión del programa. [Ruta de readiness](https://github.com/paperclipai/paperclip/blob/v2026.1117.0/server/src/routes/ready.ts)

Seguir con HTTP 200, unidad estable, versión exacta, 450 migraciones y extremo 0451, sin migraciones pendientes ni errores del proceso. Los 10 minutos del primer sondeo son un punto de inspección, no un permiso para reiniciar. Con migraciones avanzando, mantener el arranque original; si persiste al umbral de §2, aplicar la decisión pactada. Cualquier reinicio inesperado o pérdida de lease repetida activa §8.

## 6. Permisos, cuotas y proceso

Antes de permitir trabajo normal, cotejar las altas de `agents:read` atribuibles a 0423 en los eventos de auditoría. Sam o su operador autorizado revoca el exceso conforme a la matriz previa; comprobar por UI/API autorizada una denegación y un permiso esperado. Guardar de nuevo **Can create agents** desactivado para el CEO y comprobar el rechazo, sin crear un agente. Mantener Google Workspace apagado y, si existe `pi_local`, comprobar la lista permitida por nombre de variable. Informar a los operadores del comportamiento de Enter.

Con origen 1012, aplicar la parte pendiente del §6 del guion 1106 conforme a la autorización de Sam. Con origen 1106, comprobar el estado efectivo antes de escribir. Registrar que las ocho políticas aprobadas conservan aviso y estado, y que el trato de uso sin precio es el acordado; conservar su valor cuando ya coincida. Confirmar que los nombres de claves del servidor quedan fuera de los procesos de los perfiles, que llegan `DTD_PERFIL` y los datos mínimos de corrida, y que se mantienen los envoltorios y los UID efectivos. Completar los checks por nombre con las observaciones de los smokes de esta misma ventana.

## 7. Smoke, parada y reapertura

Usar tareas ficticias con un proyecto explícito, sin texto sensible. Usar 5.1–5.4 y 5.6 de la #409 y el guion 1106, con estos criterios adicionales:

| Prueba | Resultado exigido |
| --- | --- |
| 5.1 ALFRED | `dtd-claude`, perfil y runner legado efectivos, tarea que termina con exit 0, sin retención. |
| 5.2 Auxiliar | `dtd-codex`, identidad y credenciales aisladas, workspace distinto del padre, documento de crítica visible y estado terminal efectivo. Si la respuesta incluye `parentAdjusted`, comprobar el padre recibido y que el consumidor usa ese vínculo. |
| 5.3 GLM | Se reciben instrucciones de Paperclip por el canal previsto, Hermes conserva su versión, estado terminal comprobable y skills enlazadas accesibles. El resultado de coste sin precio respeta la política validada. |
| 5.4 Rutina CEO | Un disparo autorizado crea una tarea y solo una, con último y siguiente UTC correctos respecto de la línea base de hoy. Conservar los otros disparos. |
| 5.6 Cancelación | Corrida de prueba cancelada desde la UI, sin quedarse en pausa o retención, sin incidentes y con cierre verificable de sus procesos. |

El puente permanece detenido mientras se prueban permisos, tareas y rutinas. Al terminar, iniciarlo, revisar que no haya 401, 404 ni 409 inesperados, y pedir a Sam un único mensaje ficticio de recepción en el canal. Verificar vínculo efectivo y acuse, sin reintentar escrituras a ciegas. Reabrir entradas normales solo tras todos los checks. [NOTAS] Cuando una corrida nativa devuelve 409 por estado reportado desde finish, comprobar lectura y estado de cierre; esa ruta es un diagnóstico si aparece, no un cambio de runner para provocar el error. [Contrato de status nativo](https://github.com/paperclipai/paperclip/pull/18411)

Parar ante regresión de permisos o envoltorios, fallo de readiness/diario, tareas duplicadas, error de skills, actualización automática no prevista, copia incompleta, reinicios reiterados o smoke fallido. Mantener las entradas cerradas y aplicar §8 si el error ocurrió tras tocar el programa o la base. Capturar solo códigos, estado y evidencia sanitaria.

## 8. Volver atrás

1. Conservar el puente detenido, detener la unidad manual, confirmar dos lecturas de `inactive` y `MainPID=0` y la base embebida cerrada. Si hubo trabajos de smoke vivos, cancelarlos antes cuando el servicio responda.
2. Verificar el corte de §4 por SHA-256 desde la copia de restauración anotada. Conservar en cuarentena, con sello UTC y modo privado, el directorio de instancia 1117, su CLI, configuración y almacenamiento de skills, junto a cualquier estado del puente tocado por el smoke. Usar los movimientos de archivo del [§8 del guion 1106](oficina-paperclip-1106.md#8-volver-atrás-paso-a-paso), sustituyendo 1106 por 1117 para las rutas de cuarentena y usando el respaldo de esta ventana. Apartar el drop-in 1117 completo; una extracción encima dejaría archivos que no estaban en la copia.
3. Restaurar en frío el conjunto exacto de §4: instancia y base, ejecutable gestionado y configuración, unidad y drop-ins previos, skills, rutas externas y, si se modificó desde la copia, estado del puente. Restaurar dueños, permisos y enlaces. Hacer `daemon-reload` y comprobar versión de origen antes del arranque. `update --rollback` solo cambia el programa y no revierte las migraciones.
4. Arrancar la unidad manual de origen una vez. Confirmar salud y diario de origen, permisos, los checks 5.1–5.4 autorizados, y reabrir el puente tras su smoke. Conservar la cuarentena y el respaldo para revisión. Si no se puede demostrar que el conjunto restaurado pertenece al mismo corte, dejar el servicio detenido y escalar a Sam.

Las escrituras entre la copia y la restauración se pierden. El cierre registra origen, destino, sello del respaldo, horas UTC, resultados individuales, decisión tomada y responsable, sin valores sensibles.

## 9. Evidencia de esta entrega

[MEDIDO] NO EJECUTADO para la Oficina. Este documento se redactó y contrastó localmente. [NOTAS] Tag 1117 y [release oficial](https://github.com/paperclipai/paperclip/releases/tag/v2026.1117.0). [CÓDIGO] Las rutas citadas apuntan al tag exacto; las comprobaciones de instalación y los comandos de esta ventana quedan para la sesión autorizada.
