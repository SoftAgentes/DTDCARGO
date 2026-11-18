# Runbook · Vigilancia de Chatwoot y del ERP en el mismo VPS · SDD-0583

**SDD:** [0583](../specs/0583-chatwoot-vps-e1/spec.md), paso 1.6 del programa [0582](../specs/0582-chatwoot-piloto/checklist.md)
**Estado:** **en marcha en el VPS desde el 2026-10-29 15:55Z** (puerta P1, «Autorizo P1» de Sam). Timer cada 5 min y monitores Push #6 y #7 en Uptime Kuma, en verde. Las 72 h terminan el **2026-11-01 ~16:00Z**. Los dos monitores HTTP, creados el mismo día tras el DNS (P2), también en verde.
**Reutiliza:** el Uptime Kuma que ya corre en el host (`ops-uptime-kuma-uptime-kuma-1`, `https://vps.dtdcargo.com`, VPS-5 del registro E0). No se instala nada nuevo de monitoreo.

## 1 · Qué se vigila y por qué

Chatwoot vive en el VPS de la producción de DTD (E0-D1). La pregunta de las 72 h no es solo «¿Chatwoot anda?», sino **«¿DTD sigue igual con Chatwoot al lado?»**. **Línea base sin Chatwoot.** La presión de CPU `some` a 5 min rondaba el 29–31 % en E0 (VPS-4, y 29,34 % a las ~09:00Z del 2026-10-29). El mismo día, a las 15:38–15:44Z y **antes** de levantar Chatwoot, ya estaba en **40,7 %, 45,95 % y 44,85 %** (dos muestras de `vigilar.sh` en el CSV). La presión varía mucho durante el día sin Chatwoot: por eso el criterio de §4 compara contra la línea base, no contra un número fijo.

| Monitor en Uptime Kuma | Tipo | Qué mira | Intervalo | Aviso | Estado |
|---|---|---|---|---|---|
| Chatwoot · API | HTTP(s) – palabra clave | `https://chat.dtdcargo.com/api` contiene `"queue_services":"ok","data_services":"ok"` (Redis y Postgres vivos, `api_controller.rb`) | 60 s, 2 reintentos | Telegram de Sam | creado 2026-10-29 16:56Z, verde |
| Chatwoot · versión | HTTP(s) – palabra clave | la misma URL contiene `"version":"4.19.1"`: avisa si alguien cambió la imagen fuera de E3 | 1 h, 1 reintento | Telegram | creado 2026-10-29 16:56Z, verde |
| Chatwoot · recursos del host | Push (#7) | `vigilar.sh` cada 5 min (§2): `up` dentro de umbrales, `down` con el motivo | 900 s, 0 reintentos | Telegram | creado 2026-10-29, verde |
| Respaldo Chatwoot · latido | Push (#6) | `respaldo.sh` al terminar bien | 93.600 s (26 h), 0 reintentos | Telegram | creado 2026-10-29, verde |
| (los de DTD, ya existentes) | — | web, gateway de Supabase, respaldo de DTD | — | sin cambios |

Los monitores HTTP se crean en la UI de Uptime Kuma (no hay API de escritura que valga la pena aquí). Las dos URL Push van al `.env` de Chatwoot (`CHATWOOT_BACKUP_HEARTBEAT_URL`, `CHATWOOT_VIGILANCIA_HEARTBEAT_URL`, 0600, nunca a git).

## 2 · `vigilar.sh` (timer de 5 min)

`infra/chatwoot/vigilar.sh` mide y avisa; **nunca reinicia ni para nada**. Cada corrida agrega una línea a `/var/log/chatwoot-vigilancia.csv`:

- host: presión de CPU (10 s y 5 min), de memoria y de E/S (`/proc/pressure`), carga, memoria disponible, % libre de `/`;
- datos de Chatwoot: MiB de adjuntos y de Postgres;
- por contenedor de Chatwoot (rails, sidekiq, postgres, redis): % de memoria **sobre su límite**, % de CPU, reinicios, OOM;
- tiempo al primer byte de `https://dtdcargo.com/` (el ERP visto desde afuera) y de `/api` de Chatwoot;
- **WhatsApp, por bandeja** (puerta 7 de 4.9, SDD-0582; agregado el 2026-11-06): salientes del mes en curso (UTC) y mensajes en `failed` de las últimas 24 h. Lo lee `infra/chatwoot/vigilar-whatsapp.sql` con `psql` dentro del contenedor de postgres, sin `rails`, en una transacción de solo lectura con tope de 15 s. Solo conteos e IDs de bandeja;
- **token de Instagram** (agregado el 2026-11-06): el estado que deja `renovar-instagram.sh` (§2 bis).

| Umbral (variable) | Por omisión | Pasa a `down` si |
|---|---|---|
| `UMBRAL_PSI_CPU300` | 60 | presión `some` de CPU a 5 min > 60 % (el doble de la línea base) |
| `UMBRAL_MEM_LIMITE` | 90 | un contenedor de Chatwoot pasa el 90 % de su límite |
| `UMBRAL_DISCO_LIBRE` | 15 | queda menos de 15 % libre en `/` |
| `UMBRAL_TTFB_DTD` | 3.0 | la web de DTD tarda más de 3 s en dar el primer byte |
| — | — | un contenedor de Chatwoot no corre o murió por OOM |
| `UMBRAL_CUPO_WHATSAPP` | 800 | una bandeja de WhatsApp llega a 800 salientes en el mes, del cupo de 1.000 de Meta: «WhatsApp bandeja N: S de 1.000 en el mes» |
| `UMBRAL_FALLAS_WHATSAPP` | 1 | una bandeja de WhatsApp tiene 1 mensaje o más en `failed` en 24 h: «WhatsApp bandeja N: F fallas en 24 h» |
| — | — | `psql` falla o devuelve algo que no son tres números («cupo WhatsApp sin lectura»), o no hay ninguna bandeja de WhatsApp («ninguna bandeja de WhatsApp»): un hueco no cuenta como verde |
| `UMBRAL_INSTAGRAM_DIAS` | 10 | al terminar la última renovación le quedaban menos de 10 días al token: «le quedaban D días al renovar» |
| `UMBRAL_INSTAGRAM_HORAS` | 26 | la última renovación fue hace más de 26 h: «sin renovar hace H h» |
| — | — | la renovación salió `falla` («la renovación falló (motivo)»), o falta el estado o no se puede leer («token Instagram sin lectura»), o la renovación no encontró ningún canal («ningún canal de Instagram»): DTD tiene uno, la bandeja 5, así que cero es una lectura rota o una bandeja borrada |

**Columnas nuevas del CSV:** `wa_salientes_max` (la bandeja con más salientes del mes), `wa_fallas_24h` (la suma de fallas) e `ig_dias` (días que le quedan hoy al token). Las de WhatsApp quedan vacías si no hubo lectura: un hueco no es un 0. Si el CSV existente tiene otra cabecera, de la versión anterior, `vigilar.sh` lo renombra a `chatwoot-vigilancia.csv.hasta-<fecha>` y empieza otro: mezclar las dos formas descuadra `--resumen`. El viejo se sigue resumiendo con `--resumen --csv <ese archivo>`.

**Límites.** El cupo es de Meta, por número y por mes, y Chatwoot no guarda el `pricing` de cada mensaje: el conteo es una estimación local, no la factura. Una carga del historial de Kommo (E5) con fechas del mes en curso inflaría el conteo de salientes. El tope inicial de mensajes que inicia DTD no lo vigila este guion: `messaging_limit_tier` se lee por la API de Meta con `leer-clientes-0582.sh` cuando Meta apruebe el nombre visible (fila 4.9).

### 2 bis · Token de Instagram (`renovar-instagram.sh`, timer diario)

Chatwoot 4.19.1 renueva el token de Instagram solo cuando alguien lo lee. `Channel::Instagram#access_token` llama a `Instagram::RefreshOauthTokenService`, que lo renueva si sigue vigente, tiene 24 h o más desde `updated_at` y vence en menos de 10 días. Ningún job lo lee a diario: lo leen el primer mensaje de una persona nueva, un envío desde Chatwoot y la respuesta a una historia. Si vence, Instagram se apaga sin aviso. El token actual vence el **2026-12-30** y la ventana de renovación abre el **2026-12-20**.

`chatwoot-instagram-token.timer` corre a las 07:15 UTC, después de los dos respaldos, `infra/chatwoot/renovar-instagram.sh`. El guion corre `Channel::Instagram.find_each(&:access_token)` en el contenedor de rails, canal por canal, y compara `expires_at` antes y después. **El servicio de Chatwoot se traga el error de la renovación** (`rescue StandardError` y devuelve el token viejo; leído en el código de v4.19.1). Por eso una renovación fallida no aparece como error: se descubre porque el token sigue a menos de 10 días después de intentarlo.

El estado queda en `/var/lib/chatwoot-vigilancia/instagram-token.estado`, en formato clave=valor: `ts`, `resultado` (`ok`/`falla`), `motivo`, `canales`, `renovados`, `fallas`, `vence_min`, `dias_min`. Lo lee `vigilar.sh`. La salida tiene solo conteos y fechas. La salida cruda de `rails runner` (los logs de Rails van a stdout y pueden traer la respuesta de Instagram) se queda en memoria y no se imprime ni se guarda; solo se leen las líneas marcadas `DTDIG`.

**Por qué los días se miden al renovar y no contra la hora actual.** Chatwoot renueva cuando faltan menos de 10 días. Entre dos corridas diarias, un token sano baja hasta ~9 días antes de que la siguiente lo renueve. Una alarma «quedan menos de 10 días» medida contra la hora actual sonaría hasta 24 h en cada ciclo de ~50 días. Por eso `vigilar.sh` toma los días que le quedaban al terminar la última renovación y avisa además si esa renovación tiene más de 26 h. Con las dos cosas, un token que no se renueva hace sonar la alarma el mismo día.

### 2 ter · Instalar las alarmas de 2026-11-06 en el VPS

Lo revisa e instala el Director General; no es parte de la PR. **Instalarlo en producción necesita el OK nominal de Sam**: aprobar o fusionar la PR no lo cubre. **Desde el 2026-12-20**, cuando al token le quedan menos de 10 días antes del 2026-12-30, cada corrida diaria llama a `graph.instagram.com/refresh_access_token` hasta que el token se renueva. Ese es el único contacto de este guion con Meta. El orden importa: si `vigilar.sh` se instala antes de que exista un estado de Instagram, el monitor pasa a `down` («token Instagram sin lectura») hasta la primera renovación.

```bash
# 1. Copiar las piezas (desde el checkout de main integrado), con su huella
install -m 755 infra/chatwoot/renovar-instagram.sh /srv/chatwoot/
install -m 644 infra/chatwoot/vigilar-whatsapp.sql /srv/chatwoot/
install -m 644 infra/chatwoot/systemd/chatwoot-instagram-token.{service,timer} /etc/systemd/system/
systemctl daemon-reload
# 2. Primera renovación a mano y su estado (solo conteos y fechas)
systemctl start chatwoot-instagram-token.service; tail -n 1 /var/log/chatwoot-instagram-token.log
cat /var/lib/chatwoot-vigilancia/instagram-token.estado
# 3. Recién entonces, el timer y el vigilar.sh nuevo
systemctl enable --now chatwoot-instagram-token.timer
install -m 755 infra/chatwoot/vigilar.sh /srv/chatwoot/
/srv/chatwoot/vigilar.sh --dir /srv/chatwoot --csv /var/log/chatwoot-vigilancia.csv --sin-latido   # una corrida a mano
ls /var/log/chatwoot-vigilancia.csv*; tail -n 1 /var/log/chatwoot-vigilancia.csv
```

`chatwoot-vigilancia.service` no cambia: `vigilar.sh` lee el estado de Instagram en esa misma ruta por omisión. Antes de dejarlo, conviene correr `vigilar.sh --resumen --csv <el .hasta-…>`, que confirma que el CSV viejo se conservó. La primera renovación llama a `graph.instagram.com` solo si al token le quedan menos de 10 días; hoy le quedan más, así que no llama.

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

**Capacidad del VPS compartido** (propuesta del 2026-10-30, tras la observación del Director: load average ~9 con 33 sesiones en `who`, cadvisor y varios api-gw arriba en CPU, un `rails runner` de más de 180 s y timeouts de SSH a las 05:19Z y a las 14:36 hora del VPS). Al cierre, además, solo lectura:

```bash
nproc; cat /proc/loadavg; cat /proc/pressure/cpu        # carga frente a núcleos y presión real
who -u | wc -l; who -u                                   # sesiones y su tiempo inactivo
ps -eo pid,etimes,user,cmd --sort=-etimes | grep -E 'sshd: [^ ]+@' | head -40   # sesiones SSH viejas
docker inspect --format '{{.Name}} nanocpus={{.HostConfig.NanoCpus}} quota={{.HostConfig.CpuQuota}} mem={{.HostConfig.Memory}}' $(docker ps -q)
docker stats --no-stream --format '{{.CPUPerc}} {{.MemUsage}} {{.Name}}' | sort -rn | head -15
```

Se lee así: load ÷ `nproc` de forma sostenida > 1 es saturación del host, venga de donde venga. Las sesiones SSH con días de antigüedad y sin tty activo son candidatas a colgadas. Un contenedor con `nanocpus=0` y `quota=0` no tiene tope de CPU. Esto solo se mide y se reporta. Matar sesiones, cambiar límites o tocar contenedores de otros proyectos necesita OK de Sam.

El resumen va al handoff y a la fila 1.6 del checklist. **Criterio** para quedarse en el VPS compartido (decisión G de la SDD-0582):

| Señal | Se queda si | Si no |
|---|---|---|
| Presión de CPU a 5 min | nunca > 60 % más de 15 min seguidos, **y** p95 ≤ línea base + 10 puntos. Línea base: las muestras sin Chatwoot del 2026-10-29 (44,9–46,0 %) y, mejor, una hora de la semana en que Chatwoot esté bajado para una subida de versión. Corregido el 2026-10-29: el primer criterio («p95 ≤ 45 %») lo reprobaba el VPS sin Chatwoot | plan B |
| CPU propia de Chatwoot | suma de rails + sidekiq + postgres + redis (columnas `*_cpu` del CSV, en % de un núcleo) con p95 ≤ 50 %: es lo que Chatwoot le quita a DTD, sin depender del ruido del resto del host | plan B si además falla la fila anterior |
| Web de DTD | p95 del primer byte ≤ 1,5 s (línea base del 2026-10-29: 0,34–0,88 s medido desde el VPS) | plan B |
| OOM o reinicios de Chatwoot | cero | subir el límite del servicio afectado o plan B |
| Memoria de Chatwoot | p95 ≤ 80 % del límite | ajustar límites (cambio de compose, PR) |
| Disco | crecimiento de adjuntos que deje > 6 meses de margen al 15 % libre | R2 para adjuntos (cambio de alcance) |

**Plan B** (decisión G): un Cloud VPS 4 dedicado para Chatwoot, como cambio de alcance con OK de Sam. El respaldo conjunto (runbook de respaldo §3, caso 3a) es el camino de mudanza.

La ventana de 72 h con **poco uso** (antes de E4 no hay canales) subestima la carga. Por eso la vigilancia sigue encendida después y el criterio se vuelve a leer al cerrar E4 (WhatsApp en paralelo).
