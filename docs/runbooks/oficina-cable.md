# Runbook · El cable ERP → oficina (SDD-0626, Pasos 0, 2, 3a, 3b y 4)

**SDD:** [0626](../specs/0626-oficina-runtime/spec.md) §3.0 y §9 (primera fila)
**Estado:** Paso 0 montado el 2026-11-14 con el OK de Sam. Desde el 2026-11-16 el agente vive en su usuario propio `agentes-soporte`, sin `--force` (ver §2 y §5).
**Nombre en pantalla:** desde el 2026-11-20 (pedido de Sam) la oficina se llama **Oficina_Virtual** en el ERP: la revisión vive en `/studio/admin/oficina-virtual` y la mini-vista en `/studio/admin/oficina-virtual/vista`. La dirección vieja `/studio/admin/oficina` (y `/vista`) redirige con un 308 permanente. Lo interno no cambia: tablas `office_*`, variables `OFICINA_*`, crons `oficina-*`. En este runbook, «la oficina» sigue siendo también el VPS donde corre el agente.
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
| Usuario `agentes-soporte` | nologin, sin sudo y sin el grupo `oficina`. Solo corre este agente |
| Perfil Hermes `soporte-chatwoot` | `/home/agentes-soporte/.hermes/profiles/soporte-chatwoot` (0700), creado con `hermes profile create soporte-chatwoot --no-skills --no-alias` el 2026-11-16. Solo se copiaron `config.yaml` y `.env` (0600) del perfil viejo, sin sesiones ni memorias. API server solo en `127.0.0.1:8642`, la misma llave de siempre en el `.env` del perfil y `platform_toolsets.api_server: []`. **Paso 3a:** modelo `glm-5.3` (zai), **sin respaldo** hasta la llave propia de DeepSeek (Sam, 16/11/2026); llaves en el `.env` (ver §10); `memory.memory_enabled: false`, `agent.max_turns: 3`, kanban apagado; `SOUL.md` con la esencia del Anexo A y salida JSON |
| Servicio `hermes-gateway-soporte-chatwoot` | `/etc/systemd/system/hermes-gateway-soporte-chatwoot.service`: `User=agentes-soporte` y `hermes gateway run` **sin `--force`**. El nombre importa: Hermes niega un gateway propio a un perfil de `profiles/` (sale con 78/CONFIG) salvo que exista la unidad con el nombre que él espera (`hermes-gateway-<perfil>`). Endurecimiento: `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, `ProtectHome=read-only`, escritura solo en el perfil y en `~/.hermes/installs` (allí Hermes deja sus cerrojos y sin eso no arranca), e `InaccessiblePaths` para `/home/agentes-run`, `/srv/oficina/usuarios`, `/srv/oficina/trabajo` y los demás homes. **Paso 3a:** drop-in `hermes-gateway-soporte-chatwoot.service.d/aislamiento-paso3a.conf` con `ProtectHome=tmpfs` y solo su home montado, así que dentro del servicio `/home` muestra solo `agentes-soporte`; además niega `/srv/oficina/{usuarios,backups,repo,staging,motores,trabajo}`. La unidad no cambia de nombre |
| Timer `hermes-soporte-purga.timer` | Paso 3a: diario a las 04:40 UTC, como `agentes-soporte`. Corre `/usr/local/libexec/hermes-soporte-purga.py`, que borra por la API (`DELETE /api/sessions/<id>`) toda sesión del API server de más de 24 h. Solo imprime conteos. Es la red de seguridad del borrado que hace el despachador en cada llamada (§10) |
| Servicio viejo `dtd-hermes-soporte-chatwoot` | parado y `disabled` desde el 2026-11-16. Era `gateway run --force` como `agentes-run`. Su perfil está archivado (no borrado) en el respaldo de la mudanza |
| Reversión | `/srv/oficina/backups/cable-paso0-20261114/REVERTIR.txt` (montaje), `/srv/oficina/backups/soporte-mudanza-20261116T034030Z/REVERTIR.txt` (mudanza a `agentes-soporte`) y `/srv/oficina/backups/paso3a-agente-20261116T041544Z/REVERTIR.txt` (Paso 3a: aislamiento, modelo, SOUL y purga) |

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
- **El gateway de `soporte-chatwoot` corre como `agentes-soporte`, sin `--force`** (mudanza del 2026-11-16). Solo un
  proceso debe escuchar en el 8642: compruébalo con `ss -ltnp | grep 8642`. No vuelvas a arrancar el servicio
  viejo `dtd-hermes-soporte-chatwoot` mientras el nuevo esté activo, porque los dos piden el mismo puerto.
- **El cron de la raíz de `agentes-soporte` queda en solo lectura** por `ProtectHome=read-only`. El journal avisa
  de que `~/.hermes/cron` no admite escritura. Es lo esperado: este agente no tiene tareas programadas.
- **Después de cada `hermes update` como root, devuelve `install-stamp.json` a 604.** El update de root reescribe
  `/opt/hermes/hermes-agent/install-stamp.json` (y `.hermes-bootstrap-complete`) en modo 600. Entonces todos los
  usuarios no-root, `agentes-soporte` incluido, fallan con «pm-runtime: invalid package install stamp» y el cable
  se cae. Arreglo: `chmod 604` en los dos archivos y reiniciar `hermes-gateway-soporte-chatwoot`; luego, la prueba
  del §6.
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

Tras la mudanza a `agentes-soporte`, el 2026-11-16: antes, a las 03:40 UTC, PASA (4 de 4). Después, a las 03:48,
PASA (4 de 4: 110, 9 y 6 ms; sin llave 401). Tras un `systemctl restart hermes-gateway-soporte-chatwoot`, el
servicio volvió solo en 9 s y la prueba de las 03:49 dio PASA (4 de 4). `GET /v1/toolsets`: 26 toolsets, todos
apagados.

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
| `OFICINA_CHATWOOT_ACCOUNT_ID` | Id numérico de la cuenta de Chatwoot de esa bandeja (la cuenta de prueba). **Propia del cable:** el webhook, el despachador, la lectura y el envío usan solo esta, nunca `CHATWOOT_ACCOUNT_ID` (la cuenta real del ERP, que sigue siendo la de la Bandeja) | Se rechaza todo (503); el despachador y el envío responden `sin_config`. Los avisos de otra cuenta se ignoran |
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
            red chatwoot_interna (rails:3000)                              red dtd-cargo-staging_dtd_internal (dtd-cargo-staging-web-1:3000)
```

- **Código:** `infra/ops/cable-oficina/puente-prueba.mjs` (el puente) y `puente-prueba.sh` (arrancar, parar, estado,
  una-vuelta). Pruebas: `infra/ops/tests/cable-oficina-puente.test.mjs`, contra el código real del ERP.
- **Solo prueba, a la fuerza:** la cuenta (2) y la bandeja (11) están fijas en el código. Si falta
  `PUENTE_ENTORNO=prueba`, el puente sale con código 2. También sale si el destino no es exactamente `http://dtd-cargo-staging-web-1:3000/api/oficina/webhook-chatwoot`, sin el alias `web`, o si `CHATWOOT_API_URL` no es el rails de Chatwoot (`rails` o `chatwoot-rails-1`) en el puerto 3000.
  El lanzador comprueba que en `dtd-cargo-staging_dtd_internal` haya un solo `web`, el de prueba, y que en `chatwoot_interna` no haya ninguno. Borra el contenedor si
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
- **Arrancar / parar:** `/srv/ops/cable-oficina/puente-prueba.sh arrancar` · `… parar` (se para en ~1 s y se borra con `docker rm -f`; si no se pudo borrar lo dice y sale con 5; el cursor
  se queda) · `… estado` · `… una-vuelta` (diagnóstico).
- **Primer arranque:** el cursor empieza en el último mensaje que ya existe, así que la historia no se reenvía.
- **Reintentos:** si el ERP responde 5xx, el puente reintenta en la vuelta siguiente. Con 2xx o 4xx avanza el cursor y deja el código en el log.
- **Revertir:** `parar`; borrar `/etc/dtd-cable/puente-prueba.env` y `/var/lib/dtd-cable/puente-prueba`; borrar el usuario
  del puente en Chatwoot; quitar las `OFICINA_*` del `.env` de prueba y recrear el web. Los comandos exactos están en el
  `REVERTIR.txt` del VPS.

- **Prueba hecha (16/11/2026, 01:26 a 01:29Z):** OK de Sam y luz verde del DG. Un mensaje con texto inventado llegó a
  `event_inbox` (prioridad 2), sin respuesta automática y sin datos personales en los logs. La cuenta 2 se reactivó
  solo durante la prueba y quedó suspendida otra vez. El token del usuario del puente se rotó y su env se borró, así
  que **para volver a usarlo hace falta un token nuevo**. Evidencia: `/srv/ops/evidencias/cable-puente-prueba-20261116T012638Z.txt`.
- **Revisión del DG de la #591, hecha en el Paso 3a:**
  - **O4:** pruebas de `mensajeSeguro`, de las respuestas 4xx de Chatwoot (la vuelta para con la ruta enmascarada) y
    del ERP (avanza el cursor), y de que el puerto, la query, el fragmento o un usuario se rechacen en las dos rutas.
  - **O5:** paginación de Chatwoot. Conversaciones con `?page=N` mientras la página venga llena y `meta.all_count` diga
    que hay más; mensajes hacia atrás con `?before=<id>` solo hasta pasar el cursor. Tope de 40 páginas.

**NO VERIFICADO** en este paso, y pendiente para el Paso 3 o para la prueba en producción: la entrada real del webhook
desde fuera. Es decir, la ruta pública `https://<dominio>/api/oficina/webhook-chatwoot`, su paso por Traefik y Cloudflare, y
la firma emitida **por Chatwoot** (aquí la emite el puente con el mismo algoritmo).

## 10 · Paso 3a: el despachador mínimo (SDD-0626 §3.4 y §3.5; el agente redacta, nada se envía)

**Qué hace.** `/api/cron/oficina-despachador` (el cron lo llama cada minuto) abre una tanda de ticks de 10 s. Cada tick
convierte la bandeja en tareas, toma UNA para `soporte-chatwoot`, lee la conversación de Chatwoot (solo GET, solo la
bandeja de prueba, en memoria), llama al agente por el cable, valida su JSON y lo revisa contra eval.md, y deja un
**borrador** en `office_borradores` con la tarea en «aprobación». **No envía nada a Chatwoot** (eso es el Paso 3b, tras la
aprobación de Sam). Detalle: spec §3.5, «Cómo se construyó §3.4 y §3.5».

### Las variables (solo en el `.env` del entorno; nombres en `.env.example`, sin valores)

| Variable | Para qué |
|---|---|
| `OFICINA_DESPACHADOR_ACTIVO` | El interruptor. Solo `1` o `true` enciende; vacío = apagado |
| `OFICINA_RUNTIME_URL` / `OFICINA_RUNTIME_TOKEN` | El cable (§3); ya están |
| `OFICINA_CHATWOOT_TOKEN_LECTURA` | Token de un usuario **agente** de Chatwoot que solo es miembro de la bandeja de prueba. El despachador solo hace GET con él |
| `OFICINA_CHATWOOT_API_URL` | Opcional: la URL interna de la API de Chatwoot (sin ella, `CHATWOOT_URL`) |
| `OFICINA_CHATWOOT_ACCOUNT_ID` / `OFICINA_CHATWOOT_INBOX_PRUEBA` | La cuenta y la bandeja permitidas (las mismas del webhook). Sin la cuenta, el webhook rechaza todo |
| `OFICINA_TOPE_MENSUAL_USD` | El tope del mes (D5: 15; solo se puede bajar). **Etapa 1: `1`** (Sam, 16/11/2026). Al 80 % la oficina se auto-pausa |
| `OFICINA_TOPE_LLAMADAS_CORRIDA` / `OFICINA_TOPE_TOKENS_CORRIDA` | Topes por corrida (2 y 24000) |
| `OFICINA_PRECIO_ENTRADA_USD_MTOK` / `OFICINA_PRECIO_SALIDA_USD_MTOK` | La tarifa con la que se estima el costo (1,00 y 3,20 USD por millón de tokens). 0, negativo o inválido vale el de por defecto |
| `OFICINA_VACIADO_ACTIVO` | **Requisito:** el despachador no arranca sin él (`sin_vaciado`) |

### Requisitos para encenderlo (con OK de Sam y aviso al DG)

1. La migración **0548** aplicada en esa base (sin ella responde `sin_migracion` y no hace nada).
1. `OFICINA_VACIADO_ACTIVO=1` (la purga diaria de borradores a 90 días, D3). Sin él el despachador responde
   `sin_vaciado` y no hace nada.
2. La oficina despausada por un administrador (`office_cambiar_pausa`). La auto-pausa nunca despausa.
3. El token de lectura de Chatwoot puesto en el `.env` del entorno sin pasar por el chat.
4. Recrear el web para que tome las variables; después, `OFICINA_DESPACHADOR_ACTIVO=1`.

### Qué revisar

- `task_events`: `tarea.creada`, `run.iniciada`, `conversacion.leida`, `modelo.respuesta` (con modelo y costo) y el
  cierre (`run.terminada`, `run.escalada`, `run.abortada` o `run.interrumpida`).
- `eval.reintento` (ficha 0.3): el borrador no empezaba con su acuse y el despachador se lo pidió una vez más al
  agente. Esa corrida tiene dos `modelo.respuesta`, cada una con su costo. Si aparece seguido, revisar las
  instrucciones del agente; si después viene un escalado `eval:sin_acuse`, el segundo intento tampoco lo trajo.
- `office_borradores`: una fila por corrida. Solo un administrador la lee, con service_role (no hay pantalla hasta el 3b).
- `office_gasto_del_mes()`: la suma del mes. La auto-pausa deja en `office_paused` una fila con el motivo «Auto-pausa…».
- En los logs del web solo aparecen códigos (`[oficina-despachador] …`), nunca el texto del cliente.

### Cómo se apaga

- **Pausa (kill switch):** `office_cambiar_pausa(true, motivo)` desde un administrador. El despachador no toma nada
  nuevo y aborta la llamada en vuelo en ≤ 10 s; la tarea vuelve a «listo».
- **Apagado:** `OFICINA_DESPACHADOR_ACTIVO` vacío y recrear el web.

### Qué guarda la oficina (Hermes) de cada llamada

- Hermes v0.23.1 guarda cada turno del API server en el `state.db` del perfil, y no se puede apagar.
- El despachador usa una sesión propia por llamada (`cable-<run>-<intento>`) y la borra al terminar.
- El timer `hermes-soporte-purga` (§2) borra lo que haya quedado con más de 24 h. **Máximo en disco: 48 h.**
- La copia previa a `hermes update` está apagada en el perfil (`updates.pre_update_backup: "off"`).
- Los bytes borrados quedan en páginas libres de SQLite hasta un `VACUUM`: desde el 16/11/2026 hay una compactación semanal (§11; privacidad.md, hallazgo 16).
- Lo demás está en [privacidad.md](../specs/0626-oficina-runtime/privacidad.md), hallazgo 13.

### Llaves del agente (D5)

- Las puso Claude Code en el `.env` del perfil (600), sin imprimirlas.
- **GLM:** la llave compartida de la oficina (plan de código de Z.AI, tarifa plana).
- **DeepSeek:** quitada el 16/11/2026 (era la del perfil personal de Sam), junto con `fallback_model`. Sam crea una
  llave propia del agente con tope de gasto; al llegar, va al `.env` y vuelve el respaldo (REVERTIR, paso 7).
- **Pendiente (R2):** una llave propia de `soporte-chatwoot` en cada proveedor. Las crea Sam en los paneles y las coloca
  Claude Code por un canal seguro.

### Lo que este paso NO hace

- No envía nada a Chatwoot. La página de aprobación y el envío son del Paso 3b (§11).
- La prueba con el modelo real en staging (sección E del pedido) se hizo el 16/11/2026 (spec §3.5).

## 11 · Paso 3b: la revisión de Sam y el envío (SDD-0626 D2 y D4 · AC-1 etapa 1)

**Qué hace.** El despachador deja cada borrador en «aprobación» y avisa a Discord «hay N pendientes» (solo el número).
Sam revisa en **`/studio/admin/oficina-virtual`** (solo `is_platform_admin`): ve el borrador en texto plano, **marca lo que
falló** en los 4 criterios de eval.md (por criterio, «Falló» o «No evaluado»; sin marca = cumple), escribe el motivo y
aprueba o rechaza. El quinto criterio («Cierre o escalado en 3 intercambios o menos») lo registra una vez por
conversación, al cerrarla o escalarla, en «Conversaciones por cerrar» (desde la 0558). Lo aprobado lo envía **`/api/cron/oficina-envio`** (cada minuto),
solo a la bandeja de prueba. Detalle: spec §3.5, «Cómo se construyó el Paso 3b».

### Las variables (solo en el `.env` del entorno; nombres en `.env.example`, sin valores)

| Variable | Para qué |
|---|---|
| `OFICINA_ENVIO_ACTIVO` | El interruptor del envío. Solo `1` o `true` enciende; vacío = apagado. Independiente del despachador |
| `OFICINA_CHATWOOT_TOKEN_ENVIO` | Token de **escritura** de un usuario agente de Chatwoot que solo es miembro de la bandeja de prueba. Chatwoot 4.19.1 no tiene tokens con alcance: el límite es el del usuario |
| `OFICINA_CHATWOOT_ACCOUNT_ID` / `OFICINA_CHATWOOT_INBOX_PRUEBA` | La cuenta y la única bandeja a la que se envía (las del webhook). Si la bandeja coincide con una del ERP (portal, clientes, leads), no hay a dónde enviar |
| `OFICINA_ETAPA` | La etapa de AC-1 en la que se cuentan las revisiones (1 por defecto). 2 solo cuando Sam firme el paso |
| `DISCORD_TENANT_ID` y `DISCORD_WEBHOOK_EQUIPO` | El aviso «hay N pendientes» (SDD-0606). En staging Discord está apagado |

### Requisitos para encenderlo (con OK de Sam y aviso al DG)

1. La migración **0549** aplicada en esa base (sin ella el envío responde `sin_migracion` y la página lo dice) y, para
   revisar con la regla de tres estados, la **0558** (sin ella la página dice «Falta la migración 0558» y no guarda
   revisiones ni cierres; el envío de lo ya aprobado no cambia).
2. Lo del Paso 3a encendido (§10) para que haya borradores.
3. El token de escritura en el `.env` sin pasar por el chat; recrear el web; después `OFICINA_ENVIO_ACTIVO=1`.

### Qué revisar

- `office_revisiones`: una fila por borrador revisado (veredicto, casillas, motivo, revisor, hora). Solo se agregan filas.
  Columna `regla_casillas`: 1 = la regla de la 0549 (5 casillas booleanas); 2 = la de la 0558 (4 criterios: `true` cumple,
  `false` falló, `null` no evaluado; `c_cierre_3` queda `null`). El conteo solo mira criterio 2.
- `office_cierres` (0558): el cierre de cada conversación (cumple o no, motivo, revisor, hora, etapa), uno por
  conversación y etapa. Solo se agregan filas.
- `office_envios`: `enviando` → `enviado` (con el id del mensaje de Chatwoot) o `fallido`; o `bloqueado` (con su código:
  `borrador_cambio`, `conversacion_cambio`, `aprobacion_vencida`, `otra_bandeja`, `ya_contestada`, `cliente_escribio`,
  `forma_desconocida`). Nada de eso se reintenta solo.
  - **`fallido`:** Chatwoot RECHAZÓ el envío (4xx): el mensaje no se entregó. Ver el código, corregir la causa (token,
    bandeja) y, si Sam quiere, redactar de nuevo desde una conversación nueva. No hay botón de reenvío.
  - **`enviando` atascado** (sin `enviado` ni `fallido` detrás, con o sin el evento `envio.incierto`): **el mensaje pudo
    haber llegado.** No reenviarlo. Abrir la conversación en Chatwoot (bandeja de prueba) y mirar si el mensaje está:
    - si está, cerrar como el dueño en su sesión: `select office_cerrar_envio('<revisión>', 'enviado', null, <id del mensaje>)`;
    - si no está, cerrar como `fallido` con el código `no_llego` y dejarlo anotado. Las dos cosas solo con el OK de Sam.
  - **`bloqueado`:** la tarea ya terminó. Si el cliente volvió a escribir, su mensaje abre una tarea nueva.
- `task_events`: `revision.aprobada` / `revision.rechazada` (actor `persona:<uuid>`), `envio.reservado`, `envio.hecho`,
  `envio.fallido`, `envio.bloqueado`.
- El conteo de AC-1 (y AC-7): `office_conteo_revisiones(1)` desde la página, o en la base como el dueño. Con la 0558:
  correcta = aprobada con los 4 criterios en «cumple» y sin un cierre que falló; dato inventado = «Cero datos
  inventados» en `false` explícito; en la etapa 2 solo cuentan las conversaciones con cierre. **Con la 0560** (sin
  aplicar): en un escalado, «Acuse» en «No evaluado» no cuenta en contra (en «Falló» sí); en una respuesta, las cuatro
  en «cumple». **Requisito duro de orden: la 0560 se aplica en producción ANTES de fusionar su PR y de publicar el
  web.** Esa pantalla deja «Acuse» en «No evaluado» en los escalados, justo las filas que harían abortar el preflight
  de la 0560 si llegara después. Las revisiones de la
  prueba F (staging, criterio 1, clics del DG) no cuentan para la etapa 1. **Con la 0567** (aplicada el 2026-11-18 23:43:42Z): las
  conversaciones de `office_conteo_exclusiones` no cuentan y, si un cierre tiene corrección, cuenta la última (§13b).
- En los logs del web solo aparecen códigos (`[oficina-envio] …`), nunca el texto.

### Cómo se apaga

- **Pausa:** `office_cambiar_pausa(true, motivo)`. El envío la mira antes de cada mensaje y otra vez dentro de la reserva.
- **Apagado:** `OFICINA_ENVIO_ACTIVO` vacío y recrear el web. Lo aprobado queda esperando; no se pierde ni se manda luego
  sin que alguien lo encienda.

### Sesiones de una llamada abortada

Si la pausa o el tope de tiempo abortan una llamada (o el `DELETE` falla), el despachador anota la sesión en
`office_sesiones_por_borrar` y la vuelve a borrar en cada tick durante 15 min, también con la oficina pausada. La purga
diaria de la oficina sigue como red de seguridad.

### Compactación semanal del `state.db` (E · hallazgo 16 A, obligatoria antes de la etapa 2)

| Pieza (VPS Oficina) | Detalle |
|---|---|
| `/usr/local/libexec/hermes-soporte-compactar.sh` | root 755. Para `hermes-gateway-soporte-chatwoot`, corre `hermes sessions optimize` (FTS merge + VACUUM) como `agentes-soporte`, vacía el WAL (`wal_checkpoint(TRUNCATE)`) y arranca el gateway **siempre** (trap), esperando a que escuche en `127.0.0.1:8642`. Solo imprime tamaños y conteos |
| `hermes-soporte-compactar.service` / `.timer` | root, oneshot. **Domingos 05:10 UTC**, `Persistent=true` (después de la purga diaria de las 04:40) |
| Ventana | unos 10 s sin agente. Si el despachador está encendido en ese momento, la corrida escala por `runtime:red` |
| Reversión | `/srv/oficina/backups/compactar-soporte-20261116T123857Z/REVERTIR.txt` |

Probado el 2026-11-16 a las 12:39Z: `state.db` de 0,6 a 0,5 MB, 0 páginas libres y WAL en 0; los restos de la marca de
la prueba E (hallazgo 18) pasaron de 1 a 0; el gateway volvió y `GET /v1/models` responde 200 con su llave y 401 sin ella.

### Lo que este paso NO hace

- No sube a la etapa 2: eso lo firma Sam con el conteo y las demás condiciones de AC-1.
- No reintenta un envío fallido ni manda a otra bandeja que no sea la de prueba.
- La prueba F en staging (3 conversaciones; Sam aprueba 2 y rechaza 1) todavía no se hizo: necesita el OK de Sam.

## 12 · Encender la etapa 1 en producción (lista)

La etapa 1 de AC-1 corre en producción, solo en la bandeja de prueba de la **cuenta de prueba** de Chatwoot (no en la
cuenta real del ERP: decisión del DG, 17/11/2026). Todo pide el **OK nominal de Sam en la sesión del DG**, con los
interruptores nombrados. Los valores secretos van de archivo a archivo, nunca por el chat, el repo ni los logs.

**Antes:** la #652 (0558) fusionada y publicada en producción con la prueba rápida en verde; y esta pieza (la cuenta
propia del cable) también publicada. El `cron` ya tiene `oficina-despachador` y `oficina-envio`: no se toca.

### Lo que se pone (servicio `web`, `/srv/dtd-cargo/.env`, root 0600, con copia `.env.bak-<ts>` antes)

| Variable | Valor | Nota |
|---|---|---|
| `OFICINA_CHATWOOT_ACCOUNT_ID` | id de la cuenta de prueba | **No** se toca `CHATWOOT_ACCOUNT_ID` (la del ERP) |
| `OFICINA_CHATWOOT_INBOX_PRUEBA` | id de la bandeja de prueba de esa cuenta | No puede ser `CHATWOOT_INBOX_PORTAL_ID`, `_CLIENTES_ID` ni `_LEADS_ID`: si coincide, el código la anula |
| `OFICINA_WEBHOOK_SECRET` | secreto | El mismo «secret» del webhook de Chatwoot (evento `message_created`, en la cuenta de prueba) que apunta a `/api/oficina/webhook-chatwoot` |
| `OFICINA_CHATWOOT_TOKEN_LECTURA` | secreto | Usuario agente que solo es miembro de la bandeja de prueba; solo GET |
| `OFICINA_CHATWOOT_TOKEN_ENVIO` | secreto | OTRO usuario agente, también solo miembro de la bandeja de prueba (Chatwoot 4.19.1 no tiene tokens con alcance) |
| `OFICINA_TOPE_MENSUAL_USD` | `1` | Al 80 % la oficina se auto-pausa |
| `OFICINA_VACIADO_ACTIVO` | `1` | Requisito del despachador |
| `OFICINA_WEBHOOK_ACTIVO` | `1` | |
| `OFICINA_DESPACHADOR_ACTIVO` | `1` | |
| `OFICINA_ENVIO_ACTIVO` | `1` | |
| `OFICINA_ETAPA` | sin definir | Vale 1 |

`OFICINA_RUNTIME_URL` y `OFICINA_RUNTIME_TOKEN` ya están desde el Paso 0 (§3): no se tocan.

**Antes de recrear:** comprobar, por nombre y sin imprimir los valores, que `OFICINA_CHATWOOT_ACCOUNT_ID` es
**distinta** de `CHATWOOT_ACCOUNT_ID` en producción (por ejemplo, comparando los dos valores dentro de un script que solo
imprima «iguales» o «distintas»). Si son iguales, no se sigue. El código no lo exige, porque staging usa la misma cuenta
de prueba para las dos.

Después, recrear **solo** el `web`.

### En Chatwoot y en la base

1. **Reactivar la cuenta de prueba** con `rails runner` y `Account#update!` (nunca `compose up`), con motivo, hora y
   evidencia root-600.
2. **Crear el webhook en la cuenta de prueba** (no en la cuenta real): URL `https://<dominio del ERP>/api/oficina/webhook-chatwoot`,
   evento `message_created`. Su «secret» va al `.env` como `OFICINA_WEBHOOK_SECRET`, de archivo a archivo.
3. Crear (o rotar) los dos tokens de los usuarios agentes y copiarlos al `.env` de archivo a archivo.
4. Despausar la oficina: `office_cambiar_pausa(false, '<motivo>')`, como platform admin.
5. **Verificar, después de encender:**
   - un aviso firmado de **otra cuenta** (la del ERP) al webhook del cable responde `{"ok":true,"ignorado":"cuenta"}` y no
     escribe;
   - un mensaje de prueba en la bandeja de prueba queda como una fila en la bandeja del cable (la prueba del webhook real
     antes de la conversación 1);
   - `curl` de los crons con la llave: `oficina-despachador` responde `estado` `hecha` u `ocupado` (nunca `sin_config`
     ni `sin_vaciado`); `oficina-envio` responde `hecho` o `pausada` (nunca `apagado` ni `sin_config`).
6. Sam entra en `/studio/admin/oficina-virtual` con su propia cuenta de platform admin y pulsa él. Nadie aprueba por él.

### Vuelta atrás y cierre

- **Al instante, sin recrear nada:** `office_cambiar_pausa(true, '<motivo>')`. El envío la mira antes de cada mensaje y
  dentro de la reserva; el despachador, en cada tanda.
- **Solo el envío:** `OFICINA_ENVIO_ACTIVO` vacío y recrear el `web`. Lo aprobado queda esperando.
- **Todo el cable:** además `OFICINA_DESPACHADOR_ACTIVO` y `OFICINA_WEBHOOK_ACTIVO` vacíos, recrear el `web`; o borrar
  o pausar el webhook en Chatwoot.
- **Quitar `OFICINA_CHATWOOT_ACCOUNT_ID`** (y recrear el `web`) apaga el webhook (503), el despachador y el envío
  (`sin_config`). El cron `oficina-filtro` sigue procesando las filas que ya están en la base: no llama a Chatwoot. Para
  pararlo también, `OFICINA_WEBHOOK_ACTIVO` vacío.
- **Al cerrar la etapa (o si algo sale mal):** volver a **suspender la cuenta de prueba** (`Account#update!`, con
  motivo, hora y evidencia), **rotar los dos tokens** (lectura y envío) y borrarlos del `.env`, y dejar la oficina
  pausada. La base no se toca: no hay desarme, las filas solo se agregan.

### Staging

Staging usa la misma pieza: antes de la próxima prueba en staging hay que definir ahí `OFICINA_CHATWOOT_ACCOUNT_ID`
(la cuenta de prueba). Sin ella, el cable de staging queda apagado (503 / `sin_config`).

## 13 · Paso 4: la mini-vista (SDD-0626 §3.6, solo lectura)

`/studio/admin/oficina-virtual/vista` muestra lo que hay en las 4 tablas del cable: la bandera (pausada o despausada, sus
últimos 10 cambios y el gasto del mes contra el tope), la cola (`office_tasks`), los eventos (`event_inbox`) y la
bitácora (`task_events`). Es de **solo lectura**: no tiene botones ni formularios, y **no pausa ni despausa**.

### La variable (solo en el `.env` del entorno; el nombre está en `.env.example`, sin valor)

| Variable | Valor | Qué hace |
|---|---|---|
| `OFICINA_VISTA_ACTIVA` | vacío (apagada) · `1` para encender | Apagada, la página es un 404 y la revisión no la enlaza |

No pide ninguna migración ni ningún secreto nuevo. Lee con el `service_role` que el web ya tiene, y solo después de que
la base contesta que quien mira es `is_platform_admin()`.

### Cómo se enciende (con OK de Sam y aviso al DG)

1. Copia del `.env` (`.env.bak-<ts>`, 0600).
2. `OFICINA_VISTA_ACTIVA=1` en `/srv/dtd-cargo/.env`.
3. Relevar el contenedor `web` (solo ese).
4. Sam entra en `/studio/admin/oficina-virtual`: aparece el enlace «Ver la cola, los eventos y la bitácora del cable».

### Qué revisar

- Con la variable apagada, `/studio/admin/oficina-virtual/vista` responde 404 para todos.
- Encendida, un administrador del tenant que no es superadministrador recibe 404.
- La bandera coincide con `office_esta_pausada()` y el gasto con `office_gasto_del_mes()`.
- En ninguna fila aparece el texto de un cliente ni un dato de contacto: solo referencias, estados, horas y costos.

### Cómo se apaga

Vaciar `OFICINA_VISTA_ACTIVA` y relevar el `web`. No hay nada que deshacer en la base: la vista no escribe.

### Lo que este paso NO hace

- No pausa ni despausa la oficina: sigue siendo `office_cambiar_pausa`, de un superadministrador.
- No muestra el borrador ni el texto del cliente (eso es de la revisión, §11).
- No se actualiza sola: para ver lo último se recarga la página.

## 13b · Excluir una conversación del conteo o corregir un cierre (la 0567)

Para cuando el conteo de AC-1 o AC-7 tiene una conversación que no debe contar (una prueba del encendido) o un cierre
guardado con el valor equivocado. Nada se borra ni se edita: se agrega una fila con motivo, actor y fecha. Requiere la
0567 aplicada (lo está desde el 2026-11-18 23:43:42Z).

### Antes de escribir

- **OK nominal de Sam en el chat del DG**, que nombre la conversación, la etapa, lo que se hace (excluir, o corregir a
  «cumple» o a «falló») y el motivo. Un OK por lote; un OK de otro día no vale.
- Se corre como el dueño, en una sesión directa a la base de producción (la del runbook `aplicar-migraciones-prod`).
  Las dos funciones no tienen EXECUTE para la API: desde la página o con la llave del servidor fallan.

### Cómo

```sql
begin;
-- La conversación no cuenta en la etapa 1 (una vez; repetirla falla).
select public.office_excluir_conversacion('<conversación>', 1::smallint, '<motivo>', '<actor: quién y con qué OK>');
-- El cierre que cuenta pasa a «cumple» (si hay varias, manda la última; el cierre original queda).
select public.office_corregir_cierre('<conversación>', 1::smallint, true, '<motivo>', '<actor>');
-- Revisar el conteo antes de confirmar (como el dueño no pasa por office_exigir_admin: leer las tablas).
select * from public.office_conteo_exclusiones order by excluida_en;
select * from public.office_cierres_correcciones order by orden;
commit;
```

Sam ve el conteo nuevo en la página de revisión (`office_conteo_revisiones(1)`) **recién después del `commit`**:
antes, la página sigue mostrando el conteo viejo.

**Antes de aplicar la 0567**, en la misma sesión del runbook, medir los cuerpos vivos en el catálogo (solo lectura):

```sql
select p.proname, md5(p.prosrc) from pg_proc p
 where p.oid in ('public.office_conteo_revisiones(smallint)'::regprocedure,
                 'public.office_conversaciones_por_cerrar(smallint)'::regprocedure);
```

Lo esperado: el conteo en `a936f1ab6c7dd3a58a4c14ce58f9af36` (0560) y la lista de por cerrar en
`7bc6356c6e653c2109cca49cbecba9b3` (0558). Si cualquiera de los dos es distinto, no se aplica: el preflight de la
0567 abortaría igual. En ese caso, avisar al DG.

### El primer lote (tanda 1 de la etapa 1, 18/11/2026; escritas el 2026-11-18 a las 23:45:50Z con el OK de Sam «Sí, corrige 25, 27, 30»)

- Excluir la conversación de la prueba del encendido, motivo «prueba del encendido; decisión del DG, 2026-11-18».
- Corregir a «cumple» los cierres de las dos conversaciones en que Sam marcó «Cumple» y quedó guardado «Falló», motivo
  «Sam marcó Cumple; quedó guardado Falló; 2026-11-18».
- Resultado esperado: 4 conversaciones contadas y 3 correctas.

### Deshacer

No se deshace una fila: se agrega otra. Una corrección equivocada se arregla con otra corrección (manda la última).
Una exclusión no se revierte desde la API; si hiciera falta, la decide el DG con Sam y queda escrita en el
desarme de la 0567 (`supabase/desarmes/0567_desarme.sql`), que hace que el conteo deje de mirar las dos tablas.
