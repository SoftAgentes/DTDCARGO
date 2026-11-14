# Runbook · El cable ERP → oficina (SDD-0626, Paso 0)

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
  → SSH tunel-dtd@13.140.227.228:22 (llave restringida a permitopen 127.0.0.1:8642)
  → 127.0.0.1:8642 en la oficina: API server del gateway soporte-chatwoot (con llave y sin herramientas)
```

## 2 · Qué existe fuera del repo

### VPS DTD (217.216.54.70; es también el salto SSH hacia la oficina)

| Pieza | Detalle |
|---|---|
| Usuario `tunel-oficina` | nologin, home `/var/lib/tunel-oficina`. Tiene su llave ed25519 propia (no sale de DTD) y `known_hosts` fijado a la llave de host de la oficina |
| Servicio `oficina-cable-tunel` | `ssh -N -L 127.0.0.1:18642:127.0.0.1:8642 tunel-dtd@13.140.227.228` con `ExitOnForwardFailure`, `ServerAliveInterval=15` y `ServerAliveCountMax=3`, `Restart=always` y `RestartSec=15` |
| Drop-in `oficina-cable-tunel.service.d/erp-puente.conf` | agrega `-L 172.19.0.1:18642:127.0.0.1:8642` (§4) y `After=docker.service`. Es una sola sesión SSH con los dos escuchas |
| Regla ufw | `allow in on br-0fac7b3a83c3 from 172.19.0.0/16 to 172.19.0.1 port 18642 proto tcp`, comentario `SDD-0626 cable` (§4) |
| Puerto 18642 | solo en `127.0.0.1` y `172.19.0.1`. Nunca en `0.0.0.0` ni en la IP pública. Desde fuera del servidor no responde (medido el 2026-11-14 desde la PC de Sam, antes y después del §4: `TcpTestSucceeded: False`) |
| `/etc/dtd-cable/oficina-runtime.env` | root, 0600: `OFICINA_RUNTIME_URL=http://127.0.0.1:18642` y `OFICINA_RUNTIME_TOKEN`. Sirve para probar desde el host. El ERP **no** lo lee |
| `/srv/dtd-cargo/.env` | convención de secretos del ERP (root, 0600, `env_file` del servicio `web`). Lleva `OFICINA_RUNTIME_URL=http://172.19.0.1:18642` y `OFICINA_RUNTIME_TOKEN` al final, bajo el comentario `# SDD-0626 Paso 0`. La copia previa es `.env.bak-cable-20261114T211808Z`. Ver §3 |
| Copia de la prueba | `/root/cable-paso0-20261114/prueba-paso0.mjs`, la del PR #569. Tras integrar, la oficial es `/srv/ops/cable-oficina/prueba-paso0.mjs` |
| Reversión | `/root/cable-paso0-20261114/REVERTIR.txt` |

### VPS Oficina (13.140.227.228)

| Pieza | Detalle |
|---|---|
| Usuario `tunel-dtd` | una sola llave en `authorized_keys`, con `restrict,port-forwarding,permitopen="127.0.0.1:8642",from="217.216.54.70"`. No tiene shell útil ni otro destino |
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
  oficina, entrando por la vía de Sam (NordVPN): `fail2ban-client set sshd unbanip 217.216.54.70` (confirma el
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
que el `web` las recibirá por `env_file`. Hasta integrar el PR, el script se pasa desde
`/root/cable-paso0-20261114/prueba-paso0.mjs`.

Primera corrida, el 2026-11-14 a las 21:18 UTC, en `dtd-cargo-web-1` como `uid=1000 usuario=node`: 3 de 3 con
200 y `soporte-chatwoot` (88, 9 y 8 ms), sin llave 401 (7 ms). `RESULTADO: PASA (4 de 4)`, exit 0. El `web`
no se reinició: su `StartedAt` siguió en 15:51:30 UTC.

## 7 · Revertir

Los dos `REVERTIR.txt` (§2) tienen cada paso con su comando, en orden inverso. En DTD, lo del §4 se revierte con
`ufw delete allow in on br-0fac7b3a83c3 from 172.19.0.0/16 to 172.19.0.1 port 18642 proto tcp` y borrando el
drop-in `erp-puente.conf` (después, `systemctl daemon-reload` y `systemctl restart oficina-cable-tunel`). Las dos líneas `OFICINA_RUNTIME_*` se borran del `.env` (queda su respaldo). Nada de
esto toca la base, las migraciones ni el código del ERP.
