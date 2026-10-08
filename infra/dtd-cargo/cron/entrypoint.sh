#!/bin/sh
# Entrypoint del contenedor `cron` (SDD-0505).
#
# 1. Exige CRON_SECRET: sin él cada curl daría 401 en silencio durante meses.
# 2. Instala la plantilla TAL CUAL en /etc/crontabs/root, con el `${CRON_SECRET}`
#    sin expandir. BusyBox crond no admite líneas `VAR=valor` en el crontab,
#    pero sí hereda el entorno del contenedor en cada job: lo expande `sh -c`
#    al ejecutar la línea (medido el 2026-10-08 con busybox 1.37 / alpine
#    3.22.6: `echo "${CRON_SECRET}"` desde un job imprime el valor). Y es a
#    propósito que NO se renderice: crond escribe en el log `USER root pid N
#    cmd <línea completa>` en todos los niveles, así que un crontab con el
#    secreto renderizado lo mandaría a `docker logs` 3 veces por minuto. Con el
#    literal, el log muestra `Bearer ${CRON_SECRET}` y nada más.
# 3. `crond -f -d 8`: en primer plano y con el log a stderr (lo que muestra
#    `docker logs`). `-l N` manda el log a syslog, que en el contenedor no
#    existe: un cron que falla con `-l` no lo ve nadie. La salida de cada curl
#    (JSON de la ruta o el error 401/5xx) llega igual a los logs.
set -eu

: "${CRON_SECRET:?CRON_SECRET es obligatorio: lo lee de .env el servicio cron del compose}"

install -m 0600 -o root -g root /etc/dtd/crontab.template /etc/crontabs/root

jobs=$(grep -c -v -E '^(#|$)' /etc/crontabs/root || true)
echo "[cron] crontab instalado: ${jobs} jobs · horarios en UTC · destino http://web:3000"

exec crond -f -d 8
