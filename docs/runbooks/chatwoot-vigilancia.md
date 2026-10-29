# Runbook · Vigilancia de Chatwoot y del ERP en el mismo VPS · SDD-0583

**SDD:** [0583](../specs/0583-chatwoot-vps-e1/spec.md), paso 1.6 del programa [0582](../specs/0582-chatwoot-piloto/checklist.md)
**Estado:** plan y script listos; `vigilar.sh` probado en un contenedor Linux contra el stack local (2026-10-29). En el VPS: **pendiente** de la puerta P1. La espera de 72 h empieza el día del despliegue.
**Reutiliza:** el Uptime Kuma que ya corre en el host (`ops-uptime-kuma-uptime-kuma-1`, `https://vps.dtdcargo.com`, VPS-5 del registro E0). No se instala nada nuevo de monitoreo.

## 1 · Qué se vigila y por qué

Chatwoot vive en el VPS de la producción de DTD (E0-D1). La pregunta de las 72 h no es solo «¿Chatwoot anda?», sino **«¿DTD sigue igual con Chatwoot al lado?»**. Antes de Chatwoot la presión de CPU `some` ya rondaba el 29–31 % a 5 min (VPS-4, y 29,34 % leída el 2026-10-29 para este plan).

| Monitor en Uptime Kuma | Tipo | Qué mira | Intervalo | Aviso |
|---|---|---|---|---|
| Chatwoot · API | HTTP(s) – palabra clave | `https://chat.dtdcargo.com/api` contiene `"queue_services":"ok","data_services":"ok"` (Redis y Postgres vivos, `api_controller.rb`) | 60 s, 2 reintentos | Telegram de Sam |
| Chatwoot · versión | HTTP(s) – palabra clave | la misma URL contiene `"version":"4.19.1"`: avisa si alguien cambió la imagen fuera de E3 | 1 h | Telegram |
| Chatwoot · recursos del host | Push | `vigilar.sh` cada 5 min (§2): `up` dentro de umbrales, `down` con el motivo | latido esperado cada 5 min, tolerancia 15 min | Telegram |
| Respaldo Chatwoot · latido | Push | `respaldo.sh` al terminar bien | 26 h, 0 reintentos | Telegram |
| (los de DTD, ya existentes) | — | web, gateway de Supabase, respaldo de DTD | — | sin cambios |

Los monitores HTTP se crean en la UI de Uptime Kuma (no hay API de escritura que valga la pena aquí). Las dos URL Push van al `.env` de Chatwoot (`CHATWOOT_BACKUP_HEARTBEAT_URL`, `CHATWOOT_VIGILANCIA_HEARTBEAT_URL`, 0600, nunca a git).

## 2 · `vigilar.sh` (timer de 5 min)

`infra/chatwoot/vigilar.sh` mide y avisa; **nunca reinicia ni para nada**. Cada corrida agrega una línea a `/var/log/chatwoot-vigilancia.csv`:

- host: presión de CPU (10 s y 5 min), de memoria y de E/S (`/proc/pressure`), carga, memoria disponible, % libre de `/`;
- datos de Chatwoot: MiB de adjuntos y de Postgres;
- por contenedor de Chatwoot (rails, sidekiq, postgres, redis): % de memoria **sobre su límite**, % de CPU, reinicios, OOM;
- tiempo al primer byte de `https://dtdcargo.com/` (el ERP visto desde afuera) y de `/api` de Chatwoot.

| Umbral (variable) | Por omisión | Pasa a `down` si |
|---|---|---|
| `UMBRAL_PSI_CPU300` | 60 | presión `some` de CPU a 5 min > 60 % (el doble de la línea base) |
| `UMBRAL_MEM_LIMITE` | 90 | un contenedor de Chatwoot pasa el 90 % de su límite |
| `UMBRAL_DISCO_LIBRE` | 15 | queda menos de 15 % libre en `/` |
| `UMBRAL_TTFB_DTD` | 3.0 | la web de DTD tarda más de 3 s en dar el primer byte |
| — | — | un contenedor de Chatwoot no corre o murió por OOM |

Instalar (en el VPS, dentro de P1):

```bash
install -m 644 /srv/chatwoot/systemd/chatwoot-vigilancia.{service,timer} /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now chatwoot-vigilancia.timer
tail -n 3 /var/log/chatwoot-vigilancia.log; tail -n 2 /var/log/chatwoot-vigilancia.csv
```

**Línea base (opcional, recomendada).** Encender el timer **unas horas antes** de levantar Chatwoot (sin el proyecto, los contenedores salen como «no corre» y el estado es `down`, así que con `--sin-latido`): da la presión y el TTFB de DTD sin Chatwoot para comparar.

## 3 · Ensayo local (2026-10-29)

En un contenedor `docker:29-cli` con el socket de Docker, contra el stack local `chatwoot-prueba`:

- dos corridas normales → `up · ok`, CSV con las 24 columnas;
- `--resumen` → p50/p95/máx por columna;
- control con umbrales forzados (`UMBRAL_PSI_CPU300=0 UMBRAL_MEM_LIMITE=1`) → `down` con los cinco motivos.

Detalle en el [registro](../specs/0583-chatwoot-vps-e1/investigacion-2026-10-29.md).

## 4 · Las 72 h y la decisión

A las 72 h del despliegue:

```bash
/srv/chatwoot/vigilar.sh --resumen --csv /var/log/chatwoot-vigilancia.csv --desde <inicio ISO>
docker stats --no-stream $(cd /srv/chatwoot && docker compose ps -q)
du -sh /srv/chatwoot/data/*
```

El resumen va al handoff y a la fila 1.6 del checklist. **Criterio** para quedarse en el VPS compartido (decisión G de la SDD-0582):

| Señal | Se queda si | Si no |
|---|---|---|
| Presión de CPU a 5 min | p95 ≤ 45 % y nunca > 60 % más de 15 min seguidos | plan B |
| Web de DTD | p95 del primer byte ≤ 1,5× la línea base (o ≤ 1,5 s si no hubo línea base) | plan B |
| OOM o reinicios de Chatwoot | cero | subir el límite del servicio afectado o plan B |
| Memoria de Chatwoot | p95 ≤ 80 % del límite | ajustar límites (cambio de compose, PR) |
| Disco | crecimiento de adjuntos que deje > 6 meses de margen al 15 % libre | R2 para adjuntos (cambio de alcance) |

**Plan B** (decisión G): un Cloud VPS 4 dedicado para Chatwoot, como cambio de alcance con OK de Sam. El respaldo conjunto (runbook de respaldo §3, caso 3a) es el camino de mudanza.

La ventana de 72 h con **poco uso** (antes de E4 no hay canales) subestima la carga. Por eso la vigilancia sigue encendida después y el criterio se vuelve a leer al cerrar E4 (WhatsApp en paralelo).
