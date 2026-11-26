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
| A los 45 minutos de caída | Si el ensayo de recuperación o las migraciones siguen avanzando, Sam puede autorizar esperar hasta 60 minutos. Ante fallo explícito o falta de progreso comprobable, decidir volver al origen. |
| Al cierre | Dar visto bueno tras leer versión, readiness, diario, permisos y smoke. Enviar el mensaje de prueba del puente. |

[INFERENCIA] Presupuestar 30–60 min de caída para copia fría, ensayo de la copia concreta, migraciones y comprobaciones; reservar 90 min incluida la contingencia. Ajustar el presupuesto con el ensayo previo y el volumen medido de datos. Si el presupuesto aprobado queda corto para el ensayo del respaldo concreto, volver al origen antes del update. Medir la indisponibilidad desde el stop inicial hasta el smoke del puente. Hermes permanece en su versión actual.

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

Del [§3.2 del guion 1106](oficina-paperclip-1106.md#32-en-el-vps-en-solo-lectura-a-t-15-minutos) reutilizar las lecturas de versión, unidad, salud, disco, huellas de los envoltorios y conteos de skills. Para la base, reutilizar el esquema de consultas por versión y transmitir el programa de lectura desde la PC por stdin a `node -` o SQL por stdin al cliente ya instalado. Ejecutar dentro de `BEGIN READ ONLY`, comprobar `SHOW transaction_read_only` = `on` y cerrar con `ROLLBACK`. Excluir la creación de `/tmp/pc1106-lectura.cjs`, su `chmod` y su borrado. La salida se limita a conteos, booleanos, estados y horas UTC. Un cliente inaccesible, una transacción sin `on` o una consulta fallida dejan la comprobación pendiente.

Registrar el conteo de migraciones y su último asiento, cambios A/B, incidentes, skills, roles efectivos, concesiones de lectura, denegación de altas, resumen de las ocho políticas y horarios de rutinas. Validar previamente el SQL contra la etiqueta del origen. Si la autorización de lectura no cubre esas consultas, completar la ficha en otro turno autorizado antes del stop. Confirmar ubicación efectiva de la base, puerto, sockets, binarios PostgreSQL de la versión embebida y raíces de skills y puente dentro de la cobertura del §4. Identificar previamente el entorno aislado de restauración y la custodia de la copia durable. Ninguna prueba de escritura forma parte de T-15.

**Seguir si** la ruta constatada cae en §1 y los cambios previos de 1012 que se necesiten están aprobados. Preparar fuera de la ventana los controles del §3.3 y el ensayo del §4.2. Ambos requieren comprobaciones específicas de la instalación y un responsable que firme el resultado. Un estado desconocido deja cerrada la puerta de intervención.

### 3.3 Barrera de trabajo antes del primer arranque 1117

Cerrar las entradas **antes de la última lectura del origen**. Detener el puente y productores de jobs documentados, pausar las rutinas y latidos por las funciones soportadas del origen o acreditar que ninguna ejecución puede dispararse hasta el fin previsto más 30 min. Congelar altas. Durante el arranque, permitir acceso a Paperclip solamente desde el loopback bajo el canal administrativo aprobado. Cerrar proxy, túneles y clientes directos de UI/API, incluidas sesiones locales de terceros, y verificar desde cada entrada inventariada que no puede enviar tráfico. Mantener esas barreras hasta §7. Si la instalación comparte el loopback con clientes que no se pueden detener o excluir, parar.

Con las entradas bloqueadas, tomar dos instantáneas de solo lectura, separadas por al menos 30 s. Registrar como **0** cada contador de trabajo ejecutable: corridas no terminales de `heartbeat_runs`, solicitudes despachables o recuperables de `agent_wakeup_requests`, acciones activas de recuperación, reclamos pendientes de reanudación, disparos dentro de la ventana y sus márgenes, y trabajos pendientes de efectos, entregas o recuperación de sesiones. Adaptar nombres de tablas y estados al esquema exacto de los dos tags y a las funciones activadas. Por ejemplo, para corridas, contar por estado y conciliar cada estado presente con el conjunto terminal del tag; un estado nuevo o no clasificado bloquea. Reservar un recibo por cada familia con consulta, tag, contador y hora. Una tabla ausente se clasifica **NO APLICA** solo si el origen no contiene esa función y el ensayo del salto acredita que no aparecen trabajos ejecutables al migrar. No cancelar, borrar o editar filas para obtener cero.

Preparar la matriz de acceso previa de §6 en esta misma lectura. En el ensayo aislado de §4.2, comprobar desde los registros de inicio de 1117 que no se lanzan adaptadores ni rutinas y que los conteos continúan en cero antes de conciliar permisos. Mantener controlados los disparos hasta el primer arranque real. El [servidor 1117](https://github.com/paperclipai/paperclip/blob/v2026.1117.0/server/src/index.ts) abre el listener antes de terminar la recuperación y arranca procesos de recuperación internos. Cerrar solo el proxy o deshabilitar los latidos deja caminos internos abiertos. Si no se puede acreditar alguna de las dos barreras, tráfico externo y trabajo interno, no arrancar la 1117.

## 4. Detener y tomar la copia en frío

Tras el OK de ventana y las lecturas del §3.3, retener las entradas y detener la unidad manual. Mantener el puente detenido. Capturar, antes del stop, los cgroups de la unidad manual, del puente y de los demás escritores inventariados para cotejar su cierre.

~~~bash
sudo -n systemctl stop dtd-alfred-bridge.service
A 'systemctl --user stop paperclip.service'
A 'systemctl --user show paperclip.service -p ActiveState -p MainPID'
sleep 30
A 'systemctl --user show paperclip.service -p ActiveState -p MainPID'
~~~

Debe dar dos veces `inactive` y `MainPID=0`. Completar la puerta fría de §4.1 antes de copiar. Usar los comandos de **respaldo**, sin repetir el arranque o el stop, del [§4 del guion 1106](oficina-paperclip-1106.md#4-detener-y-respaldo-en-frío), con sello 1117, incluyendo la copia root de skills por perfil. Añadir `~/.config/systemd/user/paperclip.service.d/` si existe y anotar su ausencia si no existe. Copiar cualquier almacenamiento de skills o estado del puente fuera de esos archivos en el mismo corte. Conservar dueños y modos en los archivos internos. Proteger el directorio y los archivos de respaldo con 700 y 600, respectivamente.

Verificar `sha256sum -c` y `tar -tzf` en cada archivo de respaldo, manteniendo el listado en el host. Repetir la puerta fría al terminar la copia. Copiar al destino durable acordado y repetir ahí la verificación de huellas y legibilidad. La copia local y la durable deben corresponder al mismo corte. Registrar el directorio de restauración, los archivos, el mapa de orígenes externos y la custodia. Antes del update, aprobar §4.2. Cualquier fallo detiene el update. Con el corte original intacto, el operador autorizado puede reabrir el origen.

### 4.1 Puerta fría para copia y restauración

Antes y después de copiar, y antes de tocar rutas al volver atrás, la misma comprobación exige todos los resultados de esta tabla. Usar las rutas y binarios identificados en §3.2 con el dueño del clúster.

| Comprobación | Condición para seguir |
| --- | --- |
| `systemctl show` / `systemctl --user show` y archivos `cgroup.procs` del grupo capturado y sus hijos | Unidad manual, puente y escritores inventariados detenidos, `MainPID=0`, cero procesos en sus cgroups y ninguna instancia alternativa. Incluir productores directos, timers, sincronizadores, workers y tareas externas sobre los árboles a copiar. |
| `pg_ctl status -D "$pgdata"` y `test ! -e "$pgdata/postmaster.pid"` | `pg_ctl` de la misma versión termina con **3** (servidor detenido), directorio validado y PID file ausente. No borrar un PID file para cumplir la puerta. |
| `LC_ALL=C pg_controldata "$pgdata"` | Código 0 y `Database cluster state: shut down`. Extractar solamente ese estado. |
| `ss -Hlnpt` y `ss -Hlx` | Sin listener en el puerto efectivo de PostgreSQL ni socket de ese clúster. Evaluar por puerto y ruta identificados sin imprimir direcciones. |
| `lsof -t +D` con permisos suficientes sobre PGDATA, estado del puente y almacenamiento respaldado | Sin procesos con archivos abiertos. Enumeración fallida o diagnósticos de acceso dejan el resultado pendiente, incluso si stdout quedó vacío. |

Registrar códigos, estado frío e igualdad entre las dos lecturas. Mantener las fuentes valladas hasta terminar el corte. Si el clúster cerró mal o hay un escritor, conservar evidencia y parar. Un reinicio para limpiar el estado requiere replanificar el corte.

### 4.2 Ensayo de recuperación

Antes de fijar la ventana, ensayar el procedimiento completo con una copia en frío autorizada, en un entorno separado con almacenamiento privado, sin rutas montadas de producción, sin credenciales operativas utilizables y sin salida a integraciones. Confirmar la misma versión mayor de PostgreSQL, la misma distribución de Paperclip de origen y el mismo inventario de clases de archivos. Ensayar restauración en una raíz vacía preservando permisos y enlaces. Confirmar el arranque restringido de 1117 sobre otra copia de ese origen para validar §3.3. Conservar recibo con duración y resultados, únicamente agregados.

Durante la ventana, restaurar **la copia durable de §4** a una raíz vacía en el entorno aislado ya probado. Cotejar por `realpath` que PGDATA, tablaspaces, WAL, sockets y almacenamiento resuelven dentro de esa raíz. Verificar también las rutas absolutas o incluidas de la configuración del clúster. Un enlace o una ruta fuera del aislamiento detiene el ensayo. Usar puerto libre y socket privado. Con el binario PostgreSQL de origen, arrancar solo la base clonada con `pg_ctl -D "$pgdata_ensayo" -o "-c listen_addresses= -p $puerto_ensayo -k $socket_ensayo" -w start`. Lanzar el comando como dueño de la copia, con un directorio de socket privado sin espacios. Conectar `psql -X -v ON_ERROR_STOP=1` al socket y la base explícitos, con una transacción de solo lectura. Verificar conteo y último asiento del diario frente a la línea base, una consulta de conteo de la base de aplicación preacordada, que el launcher restaurado identifica el pin de origen, y que el almacenamiento local de skills y configuración corresponde al mismo corte. Detener con `pg_ctl -D "$pgdata_ensayo" -m fast -w stop` y verificar estado limpio. La aplicación productiva y el puente permanecen detenidos. Si falta el ensayo previo o cualquier control del respaldo actual, no ejecutar el update. Los hashes acreditan integridad de archivos y este ensayo acredita que la base concreta puede abrirse.

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

Con los valores efectivos verificados, la barrera de §3.3 vigente y el ensayo de la copia fría aprobado, arrancar una vez. Las funciones siguientes se definen y ejecutan en el mismo Bash de operación. Un fallo deja las entradas cerradas.

~~~bash
identidad_paperclip() {
  local estado id
  estado=$(A 'systemctl --user show paperclip.service -p ActiveState -p MainPID -p InvocationID -p NRestarts -p Result') || return 1
  grep -qx 'ActiveState=active' <<< "$estado" || return 1
  grep -qx 'Result=success' <<< "$estado" || return 1
  grep -qx 'NRestarts=0' <<< "$estado" || return 1
  grep -Eq '^MainPID=[1-9][0-9]*$' <<< "$estado" || return 1
  grep -Eq '^InvocationID=[0-9a-f]{32}$' <<< "$estado" || return 1
  grep -qx 'InvocationID=00000000000000000000000000000000' <<< "$estado" && return 1
  id=$(grep -E '^(InvocationID|MainPID|NRestarts)=' <<< "$estado" | sort) || return 1
  printf '%s\n' "$id"
}

sondear_ready() {
  local limite=$((SECONDS + 600)) status actual
  while (( SECONDS < limite )); do
    actual=$(identidad_paperclip) || return 1
    [[ "$actual" == "$arranque_paperclip" ]] || return 1
    status=$(curl --max-time 3 -s -o /dev/null -w '%{http_code}' \
      http://127.0.0.1:3100/api/ready) || status=000
    printf '%s ready=%s\n' "$(date -u +%FT%TZ)" "$status"
    if [[ "$status" == 200 ]]; then
      actual=$(identidad_paperclip) || return 1
      [[ "$actual" == "$arranque_paperclip" ]] || return 1
      return 0
    fi
    sleep 10
  done
  printf '%s\n' 'NO DISPONIBLE: /api/ready nunca devolvió 200 en el plazo' >&2
  return 1
}

if A 'systemctl --user start paperclip.service' &&
   arranque_paperclip=$(identidad_paperclip) && sondear_ready; then
  printf '%s\n' 'PASÓ: HTTP 200 y misma invocación sin reinicios'
else
  printf '%s\n' 'FALLÓ: mantener entradas cerradas y aplicar la decisión de parada' >&2
  false
fi
~~~

Leer el journal en el host únicamente para seguir migraciones, tiempos y errores, y trasladar al acta solo el resumen sanitizado. [CÓDIGO] `/api/ready` es la ruta de disponibilidad para arranque; validar además `/api/health` y versión del programa. [Ruta de readiness](https://github.com/paperclipai/paperclip/blob/v2026.1117.0/server/src/routes/ready.ts)

Seguir con código 0, HTTP 200, unidad estable, versión exacta, 450 migraciones y extremo 0451, sin migraciones pendientes ni errores del proceso. Registrar hora UTC y que la identidad y el contador coincidieron al inicio y al llegar a HTTP 200. Tras un vencimiento del sondeo, si las migraciones todavía avanzan y se conserva la misma invocación, la única continuación es volver a observar ese arranque dentro de los umbrales de §2. Cualquier reinicio inesperado, cambio de invocación o pérdida de lease repetida activa §8.

## 6. Permisos, cuotas y proceso

Con la barrera de §3.3 aún vigente, cotejar las altas de `agents:read` atribuibles a 0423 y los eventos de auditoría contra la matriz previa por agente y alcance. Sam o su operador autorizado revoca el exceso. Cero diferencias sin resolver y dos controles por UI/API autorizada: un agente cuyo permiso quedó vigente puede leer dentro de su alcance y otro sin permiso recibe la denegación esperada. Guardar de nuevo **Can create agents** desactivado para el CEO y verificar la denegación por una comprobación de capacidad que no cree agentes; ensayar el rechazo funcional en la instancia aislada. Cerrar el acceso de validación y parar ante un exceso no conciliado o si no se puede comprobar uno de los resultados. Mantener Google Workspace apagado y, si existe `pi_local`, comprobar la lista permitida por nombre de variable. Informar a los operadores del comportamiento de Enter.

Con origen 1012, aplicar la parte pendiente del §6 del guion 1106 conforme a la autorización de Sam. Con origen 1106, comprobar el estado efectivo antes de escribir. Registrar que las ocho políticas aprobadas conservan aviso y estado, y que el trato de uso sin precio es el acordado; conservar su valor cuando ya coincida. Durante los smokes, cotejar por nombre solamente la frontera de entorno descrita en el anexo. Comprobar `DTD_PERFIL`, los datos mínimos de corrida por cada adaptador, ausencia de claves del servidor, envoltorio y UID efectivo. Nunca capturar valores. Una variable excluida que resulte necesaria para un perfil exige detener y revisar ese caso antes de ampliar el paso por sudoers.

## 7. Smoke, parada y reapertura

Usar tareas ficticias con un proyecto explícito, sin texto sensible. Usar 5.1–5.4 y 5.6 de la #409 y el guion 1106, con estos criterios adicionales:

| Prueba | Resultado exigido |
| --- | --- |
| 5.1 ALFRED | `dtd-claude`, perfil y runner legado efectivos, tarea que termina con exit 0, sin retención. |
| 5.2 Auxiliar | `dtd-codex`, identidad y credenciales aisladas, workspace distinto del padre, documento de crítica visible y estado terminal efectivo. Si la respuesta incluye `parentAdjusted`, comprobar el padre recibido y que el consumidor usa ese vínculo. |
| 5.3 GLM | Se reciben instrucciones de Paperclip por el canal previsto, Hermes conserva su versión, estado terminal comprobable y skills enlazadas accesibles. El resultado de coste sin precio respeta la política validada. |
| 5.4 Rutina CEO | Un disparo autorizado crea una tarea y solo una, con último y siguiente UTC correctos respecto de la línea base de hoy. Conservar los otros disparos. |
| 5.6 Cancelación | Corrida de prueba cancelada desde la UI, sin quedarse en pausa o retención, sin incidentes y con cierre verificable de sus procesos. |

El puente permanece detenido durante §6 y los smokes 5.1–5.4 y 5.6. Solo el operador autorizado habilita sus disparos de prueba, valida su cierre y comprueba identidad de unidad y disponibilidad antes de encender el puente. Revisar que el puente no tenga 401, 404 ni 409 inesperados y pedir a Sam un único mensaje ficticio de recepción. Verificar vínculo efectivo y acuse, sin reintentar escrituras a ciegas. Antes de reabrir las entradas normales, ejecutar el control de cierre:

~~~bash
if cierre_paperclip=$(identidad_paperclip) &&
   [[ "$cierre_paperclip" == "$arranque_paperclip" ]] &&
   [[ "$(curl --max-time 3 -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3100/api/ready)" == 200 ]] &&
   cierre_paperclip=$(identidad_paperclip) &&
   [[ "$cierre_paperclip" == "$arranque_paperclip" ]]; then
  printf '%s\n' 'PASÓ: smokes cerrados en la misma invocación sin reinicios'
else
  printf '%s\n' 'FALLÓ: mantener entradas cerradas y volver al §8' >&2
  false
fi
~~~

Registrar el control después de 5.1–5.4 y 5.6, y repetirlo después del acuse del puente. Solo con todos en PASÓ, restaurar las entradas y horarios aprobados. [NOTAS] Un 409 por estado reportado desde finish se comprueba por lectura del estado efectivo. Mantener los runners asignados durante las pruebas. [Contrato de status nativo](https://github.com/paperclipai/paperclip/pull/18411)

Parar ante regresión de permisos o envoltorios, fallo de readiness/diario, tareas duplicadas, error de skills, actualización automática no prevista, copia incompleta, reinicios reiterados o smoke fallido. Mantener las entradas cerradas y aplicar §8 si el error ocurrió tras tocar el programa o la base. Capturar solo códigos, estado y evidencia sanitaria.

## 8. Volver atrás

1. Cerrar entradas, detener el puente y la unidad manual y completar la puerta fría de §4.1, con dos lecturas de `inactive` y `MainPID=0` separadas por 30 s. Si quedan trabajos de smoke vivos, cancelarlos antes del stop cuando el servicio responda. Conservar la evidencia de ensayo de esa misma copia de §4.2.
2. Verificar el corte de §4 por SHA-256 desde la copia de restauración anotada. Conservar en cuarentena, con sello UTC y modo privado, el directorio de instancia 1117, su CLI, configuración y almacenamiento de skills, junto a cualquier estado del puente tocado por el smoke. Usar los movimientos de archivo del [§8 del guion 1106](oficina-paperclip-1106.md#8-volver-atrás-paso-a-paso), sustituyendo 1106 por 1117 para las rutas de cuarentena y usando el respaldo de esta ventana. Apartar el drop-in 1117 completo; una extracción encima dejaría archivos que no estaban en la copia.
3. Restaurar en frío el conjunto exacto de §4: instancia y base, ejecutable gestionado y configuración, unidad y drop-ins previos, skills, rutas externas y, si se modificó desde la copia, estado del puente. Restaurar dueños, permisos y enlaces. Hacer `daemon-reload` y comprobar versión de origen y puerta fría de la base restaurada antes del arranque. `update --rollback` solo cambia el programa y no revierte las migraciones.
4. Arrancar la unidad manual de origen una vez. Confirmar salud y diario de origen, permisos, los checks 5.1–5.4 autorizados, y reabrir el puente tras su smoke. Conservar la cuarentena y el respaldo para revisión. Si no se puede demostrar que el conjunto restaurado pertenece al mismo corte, dejar el servicio detenido y escalar a Sam.

Las escrituras entre la copia y la restauración se pierden. El cierre registra origen, destino, sello del respaldo, horas UTC, resultados individuales, decisión tomada y responsable, sin valores sensibles.

## 9. Evidencia de esta entrega

[MEDIDO] NO EJECUTADO para la Oficina. Este documento se redactó y contrastó localmente. [NOTAS] Tag 1117 y [release oficial](https://github.com/paperclipai/paperclip/releases/tag/v2026.1117.0). [CÓDIGO] Las rutas citadas apuntan al tag exacto; las comprobaciones de instalación y los comandos de esta ventana quedan para la sesión autorizada. [Herramientas de control PostgreSQL](https://www.postgresql.org/docs/current/app-pg-ctl.html) · [Estado del clúster](https://www.postgresql.org/docs/current/app-pgcontroldata.html)
