# Contenedor `cron` de DTD Cargo (SDD-0505): reemplaza los crons de Vercel.
#
# BusyBox crond (viene en Alpine) + curl para llamar a cada ruta de
# `app/api/cron/*` con el mismo `Authorization: Bearer CRON_SECRET` que ya exigen
# los handlers. El `crontab` de esta carpeta lo GENERA `scripts/build-crontab.mjs`
# desde `vercel.json` (prueba: `scripts/__tests__/build-crontab.test.ts`); acá
# solo se copia y el entrypoint lo instala al arrancar.
#
# Medido el 2026-10-08 (busybox 1.37.0): con `crond -f -d N` los jobs heredan el
# entorno del contenedor (`${CRON_SECRET}` lo expande `sh -c`) y su stdout/stderr
# van directo a `docker logs` — crond no llama a sendmail en ese modo. Por eso
# no hace falta ni envsubst ni un sendmail falso.
#
# Etiqueta fija de Alpine (nunca `latest`). Se construye en el servidor con
# `docker compose build cron`: pesa ~20 MB y no vale la pena publicarla.
FROM alpine:3.22.6

# `tzdata` no hace falta: los horarios son UTC, los mismos que agendaba Vercel.
RUN apk add --no-cache curl

COPY crontab /etc/dtd/crontab.template
COPY entrypoint.sh /usr/local/bin/dtd-cron-entrypoint
RUN chmod 0755 /usr/local/bin/dtd-cron-entrypoint

# Corre como root a propósito: BusyBox crond lee /etc/crontabs/root y necesita
# cambiar de identidad por job. La superficie es mínima (crond + curl en una red
# interna sin puertos publicados) y el único secreto es el que ya conoce `web`.
ENTRYPOINT ["/usr/local/bin/dtd-cron-entrypoint"]
