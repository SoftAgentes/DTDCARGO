# Runbook · El cable ERP → oficina (SDD-0626, Pasos 0 y 2)

**SDD:** [0626](../specs/0626-oficina-runtime/spec.md) §3.0 y §9 (primera fila)
**Estado:** Paso 0 montado el 2026-11-14 con el OK de Sam. Es provisional hasta que termine la actualización de Hermes (ver §5).
**Sin secretos:** este archivo solo nombra servicios, usuarios, puertos y rutas. La llave vive en los servidores y nunca va al repo, a un log, a un PR ni a un chat.

## 1 · Qué es

El ERP de DTD llama al agente Hermes `soporte-chatwoot` del VPS Oficina por un túnel SSH. El Paso 0 solo
prueba la conexión con `GET /v1/models`, que no corre el modelo y gasta 0 tokens. Sin el Paso 0 en verde no se
sigue con §3.1 (migraciones), ni con el webhook ni con el despachador.

```
contenedor web del ERP (dtd-cargo-web-1, usuario node)
  → http://172.19.0.1:18642   IP del puente de dtd-cargo_dtd_internal (br-0fac7b3a83c3), §4
  → ssh -L de tunel-oficina en el host DTD (también escucha en 127.0.0.1:18642)
  → SSH tunel-dtd@<IP de la oficina: ver REVERTIR.txt en el VPS DTD>:22 (llave restringida a permitopen 127.0.0.1:8642)
  → 127.0.0.1:8642 en la oficina: API server del gateway soporte-chatwoot (con llave y sin herramientas)
```

## 2 · Qué existe fuera del repo

### VPS DTD (IP pública del VPS DTD: ver el servidor; es también el salto SSH hacia la oficina)

| Pieza | Detalle |
|---|---|
| Usuario `tunel-oficina` | nologin, home `/var/lib/tunel-oficina`. Tiene su llave ed25519 propia (no sale de DTD) y `known_hosts` fijado a la llave de host de la oficina |
| Servicio `oficina-cable-tunel` | `ssh -N -L 127.0.0.1:18642:127.0.0.1:8642 tunel-dtd@<IP de la oficina: ver REVERTIR.txt en el VPS DTD>` con `ExitOnForwardFailure`, `ServerAliveInterval=15` y `ServerAliveCountMax=3`, `Restart=always` y `RestartSec=15` |
| Drop-in `oficina-cable-tunel.service.d/erp-puente.conf` | agrega `-L 172.19.0.1:18642:127.0.0.1:8642` (§4) y `After=docker.service`. Es una sola sesión SSH con los dos escuchas |
| Regla ufw | `allow in on br-0fac7b3a83c3 from 172.19.0.0/16 to 172.19.0.1 port 18642 proto tcp`, comentario `SDD-0626 cable` (§4) |
| Puerto 18642 | solo en `127.0.0.1` y `172.19.0.1`. Nunca en `0.0.0.0` ni en la IP pública. Desde fuera del servidor no responde (medido el 2026-11-14 desde la PC de Sam, antes y después del §4: `TcpTestSucceeded: False`) |
| `/etc/dtd-cable/oficina-runtime.env` | root, 0600: `OFICINA_RUNTIME_URL=http://127.0.0.1:18642` y `OFICINA_RUNTIME_TOKEN`. Sirve para probar desde el host. El ERP **no** lo lee |
| `/srv/dtd-cargo/.env` | convención de secretos del ERP (root, 0600, `env_file` del servicio `web`). Lleva `OFICINA_RUNTIME_URL=http://172.19.0.1:18642` y `OFICINA_RUNTIME_TOKEN` al final, bajo el comentario `# SDD-0626 Paso 0`. La copia previa es `.env.bak-cable-20261114T211808Z`. Ver §3 |
| Copia de la prueba | La oficial es `/srv/ops/cable-oficina/prueba-paso0.mjs` (root, 0700), copiada de `infra/ops/cable-oficina/` de `main` el 2026-11-15 (Paso 1). Queda la de `/root/cable-paso0-20261114/`, la del PR #569, con el mismo sha256 |
| Reversión | `/root/cable-paso0-20261114/REVERTIR.txt` |

### VPS Oficina (IP de la oficina: ver REVERTIR.txt en el VPS DTD)

| Pieza | Detalle |
|---|---|
| Usuario `tunel-dtd` | una sola llave en `authorized_keys`, con `restrict,port-forwarding,permitopen="127.0.0.1:8642",from="IP pública del VPS DTD (ver el servidor)"`. No tiene shell útil ni otro destino |
| Perfil Hermes `soporte-chatwoot` | bajo el usuario `agentes-run` (**provisional**; el destino es `agentes-soporte`, ya creado y vacío). API server solo en `127.0.0.1:8642`, con llave en el `.env` del perfil (0600) y `platform_toolsets.api_server: []` |
| Servicio `dtd-hermes-soporte-chatwoot` | `hermes gateway run --force` del perfil. El `--force` hace falta porque Hermes no abre un segundo gateway del mismo usuario sin él |
| Reversión | `/srv/oficina/backups/cable-paso0-20261114/REVERTIR.txt` |

## 3 · Secretos del ERP

- Van en `/srv/dtd-cargo/.env` con los nombres de `.env.example` (`OFICINA_RUNTIME_URL`, `OFICINA_RUNTIME_TOKEN`).
  El valor de la llave es el mismo de `/etc/dtd-cable/oficina-runtime.env` y se copia en el servidor, de archivo
  a archivo, sin mostrarlo. Antes se respalda el `.env` (`.env.bak-cable-<ts>`).
- El contenedor `web` recibe el `.env` al crearse. Un `web` que ya corre **no** ve variables nuevas hasta que se
  recrea, lo que pasa en la próxima publicación (`publicar-web.sh`, que solo cambia `DTD_WEB_IMAGE`). Para el
  Paso 0 no se reinicia el ERP: la prueba (§6) pasa las dos variables al proceso que lanza dentro del mismo
  contenedor con `docker exec --env-file`.
- Entorno de prueba (`dtd-cargo-staging`): **no** las lleva. `verificar-aislamiento.sh` exige que las claves de
  integración estén ausentes o vacías allí.

## 4 · Cómo llega el contenedor al túnel

El `127.0.0.1` del host no le sirve al contenedor. La única vía autorizada es que el túnel escuche además en la
IP del puente de la red del ERP. Se elige `dtd-cargo_dtd_internal` (`172.19.0.1`, interfaz `br-0fac7b3a83c3`),
que solo tienen los contenedores de producción de DTD Cargo. No se usa `dtd_edge`, que también llega a prueba,
a Traefik y a Uptime Kuma.

**ufw bloquea el paso del contenedor al host** (medido el 2026-11-14 con un escucha temporal en
`172.19.0.1:18643`: `[UFW BLOCK] IN=br-0fac7b3a83c3 SRC=172.19.0.9 DST=172.19.0.1`). Por eso, además del
`-L 172.19.0.1:18642:127.0.0.1:8642` (drop-in `erp-puente.conf`), hay una regla que deja entrar solo ese puerto,
desde esa red y por esa interfaz. Se aplicó con el OK de Sam del 2026-11-14 («Sí, aplica la A»):

```bash
ufw allow in on br-0fac7b3a83c3 from 172.19.0.0/16 to 172.19.0.1 port 18642 proto tcp comment 'SDD-0626 cable: ERP -> tunel oficina'
```

Medido después de aplicarla: el web del ERP pasa la prueba del §6. El web de prueba
(`dtd-cargo-staging-web-1`, que está en `dtd_edge` y no en esta red) no llega ni a `172.19.0.1:18642` ni a
`172.18.0.1:18642`: los dos se agotan a los 5 s. Desde fuera, el puerto sigue sin responder.

Si la red se recrea (`docker compose down` del proyecto), cambian el id de la interfaz y quizá la subred. En ese
caso hay que actualizar la regla, el `-L` del servicio y `OFICINA_RUNTIME_URL`.

## 5 · Avisos de operación

- **Tras un corte, el túnel tarda ~16 s en volver** (`RestartSec=15` más la conexión). En ese rato las llamadas
  fallan con «nada responde» (ECONNREFUSED) o «aceptó y cerró» (el `ssh -L` acepta, pero no logra abrir el
  canal). Quien llame (el despachador de §3.4) tiene que reintentar con espera, no darse por vencido al primer
  fallo.
- **Si la oficina rechaza la llave del túnel, fail2ban de la oficina bloquea la IP de DTD durante 1 h.** Con
  `Restart=always` cada 15 s, el bloqueo llega en ~75 s. Mientras dure, DTD tampoco sirve de salto SSH hacia la
  oficina. Arreglo: corrige la llave (`authorized_keys` de `tunel-dtd` en la oficina) y desbloquea a mano desde la
  oficina, entrando por la vía de Sam (NordVPN): `fail2ban-client set sshd unbanip IP pública del VPS DTD (ver el servidor)` (confirma el
  nombre de la jaula con `fail2ban-client status`). Si vas a tocar la llave, primero
  `systemctl stop oficina-cable-tunel` en DTD.
- **El gateway de `soporte-chatwoot` arranca con `--force` y comparte el usuario `agentes-run`.** Es provisional
  hasta completar la actualización de Hermes. Después se muda al usuario `agentes-soporte`. Mientras tanto, otro
  gateway de `agentes-run` no debe reclamar el puerto 8642.
- La oficina tiene `ufw limit` en SSH: no abras ráfagas de conexiones desde DTD.

## 6 · Prueba del Paso 0

Script: [`infra/ops/cable-oficina/prueba-paso0.mjs`](../../infra/ops/cable-oficina/prueba-paso0.mjs), sin
dependencias, con el Node de la imagen del ERP. Hace 3 `GET /v1/models` con la llave (cada uno tiene que dar 200
en ≤ 10 s con `soporte-chatwoot` en la lista) y 1 sin llave, que tiene que dar 401. Imprime los tiempos y PASA o
FALLA, nunca la llave. Sale con 0 si todo pasa, 1 si algo falla, 2 si falta configuración y 3 si el túnel está
caído. Lo cubre `infra/ops/tests/cable-oficina-paso0.test.mjs`, con un runtime de mentira y sus mutantes.

Se corre en el contexto del ERP (dentro de `dtd-cargo-web-1`, como `node`), no como root en el host:

```bash
docker exec -i --env-file <(grep -E '^OFICINA_RUNTIME_(URL|TOKEN)=' /srv/dtd-cargo/.env) \
  dtd-cargo-web-1 node --input-type=module - < /srv/ops/cable-oficina/prueba-paso0.mjs
```

`--env-file` lo lee el cliente de Docker en el host. El proceso de la prueba solo recibe las dos variables, igual
que el `web` las recibirá por `env_file`.

Primera corrida, el 2026-11-14 a las 21:18 UTC, en `dtd-cargo-web-1` como `uid=1000 usuario=node`: 3 de 3 con
200 y `soporte-chatwoot` (88, 9 y 8 ms), sin llave 401 (7 ms). `RESULTADO: PASA (4 de 4)`, exit 0. El `web`
no se reinició: su `StartedAt` siguió en 15:51:30 UTC.

Segunda corrida, ya desde `/srv/ops/cable-oficina/`, el 2026-11-15 a las 03:37 UTC, igual que arriba: 3 de 3
con 200 (103, 9 y 10 ms), sin llave 401 (7 ms). `RESULTADO: PASA (4 de 4)`, exit 0. El `web` siguió sin
reiniciarse. Está anotada como paso 8 en `/root/cable-paso0-20261114/REVERTIR.txt`.

## 7 · Revertir

Los dos `REVERTIR.txt` (§2) tienen cada paso con su comando, en orden inverso. En DTD, lo del §4 se revierte con
`ufw delete allow in on br-0fac7b3a83c3 from 172.19.0.0/16 to 172.19.0.1 port 18642 proto tcp` y borrando el
drop-in `erp-puente.conf` (después, `systemctl daemon-reload` y `systemctl restart oficina-cable-tunel`). Las dos líneas `OFICINA_RUNTIME_*` se borran del `.env` (queda su respaldo). Nada de
esto toca la base, las migraciones ni el código del ERP.

## 8 · Webhook, filtro y vaciado (SDD-0626 Paso 2: §3.2 y §3.3)

**Estado:** construido en el Paso 2, con todo **apagado**. Si este código llega a producción con una publicación
manual, no hace nada hasta que Sam encienda cada interruptor. **Aplicadas en producción el 2026-11-15, con el OK de Sam («Autorizo ambas»):** la migración 0541 (tablas, 20:51:38Z, md5 `e43598906754dd582fa3fb4162b012e2`) y la 0544 (cuota del filtro, 20:52:17Z, md5 `fd984a13dd2056bcaa6d1665b27b2094`). Están selladas en `migrations.lock.json` y ya no son esperas. La oficina **nace pausada** y todos los interruptores siguen apagados.

```
Chatwoot (bandeja de prueba)  ──POST firmado──▶  /api/oficina/webhook-chatwoot  ──▶  event_inbox  (guardar y salir)
cron del servidor, cada minuto ─────────────▶  /api/cron/oficina-filtro  ──▶  office_filtrar_bandeja()  (hasta 20/h a «triaje»)
cron del servidor, diario 04:15 UTC ────────▶  /api/cron/oficina-vaciado ──▶  office_vaciar_resumenes_viejos()
```

### Las variables (solo en `/srv/dtd-cargo/.env`; los nombres están en `.env.example`, sin valores)

| Variable | Qué hace | Apagado / vacío |
|---|---|---|
| `OFICINA_WEBHOOK_ACTIVO` | Enciende el webhook y el filtro. Solo vale `1` o `true` (cualquier otra cosa, apagado) | El webhook responde 200 sin hacer nada y no escribe; el filtro no llama a la base |
| `OFICINA_WEBHOOK_SECRET` | El «secret» del webhook de Chatwoot que apunta a este endpoint. **Propio del cable**, no el de `/api/chatwoot/webhook` | Se rechaza todo (503) |
| `OFICINA_CHATWOOT_INBOX_PRUEBA` | Id numérico de la única bandeja que el cable atiende | Se rechaza todo (503). Cualquier otra bandeja se ignora |
| `OFICINA_ETIQUETAS_DINERO`, `OFICINA_ETIQUETAS_INTERNO` | Etiquetas de Chatwoot (separadas por comas) que dan prioridad 3 (dinero) o 1 (interno). Opcionales | Valen las del código: dinero, pago, cobro, cobranza, factura, reembolso / interno, prueba. Sin etiqueta clara, cliente (2) |
| `OFICINA_VACIADO_ACTIVO` | Enciende el vaciado diario del resumen. **Interruptor propio**: no lo enciende el del webhook. Solo vale `1` o `true` | No llama a la base |

Se leen en cada llamada: **apagar** una pieza es poner su variable vacía y recrear el `web` (las variables del
`.env` entran al recrearlo, §3). Hasta entonces el proceso sigue con lo anterior.

### Cómo se enciende (con OK de Sam, y solo cuando estén las 5 piezas del Paso 2b)

El orden importa; cada paso se comprueba antes del siguiente.
1. **La base.** Aplicar la 0541 y la 0544 (OK nominal de Sam, runbook de migraciones). La oficina **nace pausada**: eso
   no se cambia hasta la etapa de prueba, y solo lo despausa un `is_platform_admin()`.
2. **Chatwoot.** Crear, en la cuenta, un webhook que apunte a `https://<dominio del ERP>/api/oficina/webhook-chatwoot`
   con el evento `message_created` y su «secret». El secret **no se escribe en el chat ni en el repo**: lo pega la
   persona que opera en `/srv/dtd-cargo/.env` como `OFICINA_WEBHOOK_SECRET`.
3. **El `.env`.** Poner `OFICINA_CHATWOOT_INBOX_PRUEBA` (id de la bandeja de prueba) y `OFICINA_WEBHOOK_SECRET`, con
   copia previa del `.env` (`.env.bak-cable-<ts>`, §3). Después `OFICINA_WEBHOOK_ACTIVO=1`. Recrear el `web`
   (publicación). El crontab nuevo NO se toma solo: `infra/dtd-cargo/cron/Dockerfile` lo copia dentro de la imagen del contenedor `cron`, así que hay que reconstruirla (secuencia C8 de [publicacion-automatica-web.md](publicacion-automatica-web.md)): copiar `cron/` del repo a `/srv/dtd-cargo/`, luego `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml build cron` y luego `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps cron`. **Está prohibido un `compose up` suelto.** Sin esto, el filtro y el vaciado no corren.
4. **El vaciado** se enciende aparte (`OFICINA_VACIADO_ACTIVO=1`) cuando la 0541 esté aplicada. Sin la 0541 no hace nada.

### Qué revisar

- **Que llega:** un mensaje del cliente en la bandeja de prueba deja UNA fila en `event_inbox` con
  `payload_ref = chatwoot:conversations/<id>/messages/<id>`. Si la fila trae algo más que una referencia, es un
  error: apagar y avisar (R5).
- **Que no escribe de más:** un mensaje de otra bandeja, una nota interna o un mensaje nuestro no dejan fila.
- **Que el filtro respeta la pausa:** con `office_paused` en verdadero, las filas se quedan en «nuevo».
- **Cuota:** como máximo 20 filas pasan a «triaje» por hora (`triaje_en`). Lo demás espera en «nuevo»: la cuota no descarta.
- **Duplicados:** la misma conversación + mensaje no entra dos veces, llegue cuando llegue (`clave_dedupe` única).
- **El log**, solo con códigos, nunca con el texto del cliente:
  - `[oficina-cable] el webhook no guarda nada: falta la 0541` / `el filtro no mueve nada: falta la 0541 o la 0544` /
    `el vaciado no hace nada: falta la 0541`: una sola vez por proceso. Significa que la base no tiene la migración.
  - `[oficina-cable] no se guarda: <códigos> (SDD-0626 §3.1, R5)`: `exigirTextosDelCable` rechazó algo (422).
    No debería ocurrir con el webhook; si pasa, revisar de dónde vino el dato.
  - `el webhook no pudo guardar el aviso (<código>)`: error de la base (500). Chatwoot 4.19.1 no reintenta webhooks de
    cuenta: el mensaje queda sin fila; se ve en Chatwoot.
- **El vaciado:** `curl` del cron con la llave devuelve `{"ok":true,"estado":"ok","cantidad":N}`. Repetirlo da `0`.
  Corre con la oficina pausada. Las filas se quedan; solo el `resumen` de las de más de 90 días pasa a vacío.

### Cómo se apaga

- **Todo el cable de entrada:** `OFICINA_WEBHOOK_ACTIVO=` (vacío) y recrear el `web`. El webhook responde 200 sin
  escribir y el filtro deja de moverse. Las filas ya guardadas quedan como están.
- **Solo el vaciado:** `OFICINA_VACIADO_ACTIVO=` (vacío) y recrear el `web`.
- **Parar el trabajo sin apagar el webhook:** pausar la oficina (`office_cambiar_pausa(true, '<motivo>')`, solo un
  administrador). El aviso se sigue guardando para no perder mensajes, pero nada avanza.
- **Quitar el webhook en Chatwoot** (borrarlo o pausarlo en su pantalla de webhooks) corta la entrada en el origen.
- **Revertir el código:** el desarme de la 0544 (`supabase/desarmes/0544_desarme.sql`, antes que el de la 0541) pierde
  solo la hora de triaje. El código sin las migraciones no hace nada.

### Lo que este paso NO hace

No responde nada en Chatwoot, no tiene repartidor, modelo ni herramientas, y no usa `OFICINA_RUNTIME_*`. La prueba
con un mensaje real del inbox de prueba es el **Paso 2b** y espera las 5 piezas de Chatwoot de Sam.

## 9 · Paso 2b: puente interno de prueba (SDD-0626, «Opción 3: puente» de Sam, 2026-11-15)

**Solo prueba.** En lugar de un webhook de Chatwoot por la ruta pública, un puente lee la API de Chatwoot por la red
interna y entrega al web de **prueba** el mismo `message_created` firmado que mandaría Chatwoot 4.19.1. Así el ERP
valida la firma igual que con un webhook real.

```
Chatwoot (cuenta 2 «DTD Prueba», bandeja 11 «Prueba Oficina») ──GET──▶ puente ──POST firmado──▶ web de prueba /api/oficina/webhook-chatwoot
            red chatwoot_interna (rails:3000)                              red dtd-cargo-staging_dtd_internal (web:3000)
```

- **Código:** `infra/ops/cable-oficina/puente-prueba.mjs` (el puente) y `puente-prueba.sh` (arrancar, parar, estado,
  una-vuelta). Pruebas: `infra/ops/tests/cable-oficina-puente.test.mjs`, contra el código real del ERP.
- **Solo prueba, a la fuerza:** la cuenta (2) y la bandeja (11) están fijas en el código. Si falta
  `PUENTE_ENTORNO=prueba`, el puente sale con código 2. También sale si el destino no es `http://web:3000/api/oficina/webhook-chatwoot`.
  El lanzador comprueba que en `dtd-cargo-staging_dtd_internal` haya un solo `web`, el de prueba, y borra el contenedor si
  quedara en otra red. La red de producción `dtd-cargo_dtd_internal` está prohibida. No hay compose ni reinicio
  automático (`--restart no`).
- **No escribe en Chatwoot:** solo pide GET. No contesta.
- **Datos:** el cuerpo que entrega no lleva `content`, `sender` ni el contacto; solo ids, tipo, estado y
  etiquetas, que es todo lo que lee `interpretarEvento`. En disco solo guarda el cursor
  (`/var/lib/dtd-cable/puente-prueba/cursor`, el último id entregado). En el log solo ids y códigos.
- **Secretos** (`/etc/dtd-cable/puente-prueba.env`, root 600; nunca en Git, en el log ni en el chat):
  - `CHATWOOT_API_TOKEN`: el de un usuario agente que solo tiene la cuenta 2, solo la bandeja 11 y ninguna notificación;
  - `OFICINA_WEBHOOK_SECRET`: el mismo que el `.env` del web de prueba.
- **Contenedor:** `docker create` va con `--env-file`, así que `docker inspect` del contenedor muestra las variables.
  Solo root lo ve, pero no se pega su salida en ningún lado.
- **Arrancar / parar:** `/srv/ops/cable-oficina/puente-prueba.sh arrancar` · `… parar` (se para en ~1 s y se borra; el cursor
  se queda) · `… estado` · `… una-vuelta` (diagnóstico).
- **Primer arranque:** el cursor empieza en el último mensaje que ya existe, así que la historia no se reenvía.
- **Reintentos:** si el ERP responde 5xx, el puente reintenta en la vuelta siguiente. Con 2xx o 4xx avanza el cursor y deja el código en el log.
- **Revertir:** `parar`; borrar `/etc/dtd-cable/puente-prueba.env` y `/var/lib/dtd-cable/puente-prueba`; borrar el usuario
  del puente en Chatwoot; quitar las `OFICINA_*` del `.env` de prueba y recrear el web. Los comandos exactos están en el
  `REVERTIR.txt` del VPS.

**NO VERIFICADO** en este paso, y pendiente para el Paso 3 o para la prueba en producción: la entrada real del webhook
desde fuera. Es decir, la ruta pública `https://<dominio>/api/oficina/webhook-chatwoot`, su paso por Traefik y Cloudflare, y
la firma emitida **por Chatwoot** (aquí la emite el puente con el mismo algoritmo).
