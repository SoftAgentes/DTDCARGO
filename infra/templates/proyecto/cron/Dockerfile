# infra/templates/proyecto/cron/Dockerfile — crond mínimo que llama a /api/cron/* (SDD-0505).
#
# Reemplaza a los crons de Vercel: BusyBox crond lee /etc/crontabs/root y ejecuta
# cada línea con `sh -c`, que expande ${CRON_SECRET} desde el entorno del
# contenedor (compose › cron › environment). Comprobado el 2026-10-08 con
# alpine:3.24.2 (BusyBox 1.37.0): los jobs heredan el entorno de crond (Vixie
# cron lo vaciaría) y también su stdout/stderr, así que la salida de cada curl
# (el JSON de la ruta o su 403) aparece en `docker logs cron` sin más piezas.
# Por eso el secreto nunca se escribe en el crontab y no hace falta `sendmail`.
#
# OJO si algún día agregas un `sendmail` propio: en Alpine `/usr/sbin/sendmail`
# es un symlink a /bin/busybox y `COPY` sigue el symlink de destino, así que
# copiaría encima de busybox y la imagen se quedaría sin shell (reproducido el
# 2026-10-08: exit 255 en el RUN siguiente). Borra el symlink antes del COPY.
#
# El tag base va fijado; `curl` se instala sin versión exacta porque el repo apk
# de 3.24 rota los parches y un pin exacto rompe el build a las pocas semanas.
FROM alpine:3.24.2

RUN apk add --no-cache curl ca-certificates

COPY crontab /etc/crontabs/root
RUN chmod 0600 /etc/crontabs/root

# Sin servidor ni puertos: solo el demonio. Si crond muere, el healthcheck lo delata
# y `restart: unless-stopped` lo levanta.
HEALTHCHECK --interval=60s --timeout=5s --retries=3 CMD pgrep crond || exit 1

# -f primer plano · -L /dev/stdout a `docker logs` · -l 5 registra cada ejecución
# (la línea que registra lleva `${CRON_SECRET}` sin expandir: no filtra el valor).
CMD ["crond", "-f", "-L", "/dev/stdout", "-l", "5"]
