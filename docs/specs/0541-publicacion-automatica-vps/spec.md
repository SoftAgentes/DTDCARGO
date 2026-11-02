---
sdd: "0541"
title: "Publicación automática de la web en el servidor propio"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-10-16
updated: 2026-11-01
supersedes: null
superseded_by: null
related: ["0505"]
confidencialidad: interno
---

# SDD-0541 — Publicación automática de la web en el servidor propio

> Cada merge a `main` llega solo a `dtdcargo.com` en el VPS de Contabo, sin pasar
> por delante de su migración, con prueba rápida y vuelta atrás automática. GitHub
> decide qué commit se puede publicar y lo marca con la etiqueta `:publicable`; el
> servidor la sigue con un timer de systemd. No hay llave del servidor en GitHub
> ni token de GitHub en el servidor.

## Pedido de Sam

«Que un Worker arme la publicación automática: que cada merge a `main` llegue solo
a la web del servidor propio, coordinado con la sesión de Contabo.»

## Contexto medido el 2026-10-16

- **El corte.** Desde el 2026-10-16 a las 07:05Z, `dtdcargo.com` sirve desde el VPS
  (217.216.54.70), compose `dtd-cargo` en `/srv/dtd-cargo`, detrás de Traefik, con
  la imagen fijada en la línea `DTD_WEB_IMAGE` del `.env`. Vercel se pausa. Hoy la
  sesión de Contabo instala cada imagen a mano.
- **Lo que ya existe.** `.github/workflows/build-image.yml` publica
  `ghcr.io/hailuwaycom-sketch/dtdcargo:sha-<sha>` y mueve `:main` en cada push a
  `main`. No despliega.
- **El script interino de Contabo** (referencia que la sesión de Contabo le pasó
  al Director; no está en el repo y no se leyó). La primera publicación sin
  Vercel fue a las 08:20Z del 2026-10-16, con `sha-8761618d`. La hizo
  `/srv/ops/web/publicar-web.sh <sha>` (700, sha16 `507df8e0155f59c7`), en este
  orden:
  1. pull;
  2. prueba de sharp dentro de la imagen;
  3. copia del `.env`;
  4. `DTD_WEB_IMAGE`;
  5. `up -d --no-deps web`;
  6. healthy, a los 24 s;
  7. `smoke-web.sh --host dtdcargo.com --www`, con 14 PASÓ;
  8. vuelta atrás sola si algo falla.

  Le faltan el gate de migraciones, el interruptor y el aviso. La 0491 se publicó
  así: el Director aplicó la migración, fusionó 3 s después y la web entró a los
  4 min, a mano. Este diseño lo reemplaza en la misma ruta y con la misma
  interfaz (`<sha>` como argumento).
- **Tiempos de los últimos 15 merges** (`gh run list --branch main --event push`):
  - «Imagen Docker» tarda entre 2 min 55 s y 4 min 08 s.
  - «Calidad continua» en `main` tarda entre 14 min 56 s y 30 min 46 s, casi
    siempre alrededor de 28 min.
  - 3 de 15 corridas de «Calidad continua» quedaron canceladas por el merge
    siguiente (`cancel-in-progress: true`): `3e0368e0`, `cbf18acf` y `016e76d6`.
  - La última, la de `6da8aebc` (PR #244), FALLÓ por una prueba inestable
    (`TransportistasPanel.test.tsx › cambio en lote`). Su imagen ya estaba en
    `:main` 4 minutos después del merge. Seguir `:main` habría publicado un
    commit con el CI en rojo.
  - Con Vercel, el status del merge decía «Deployment has completed» entre 82 y
    116 s después (registros de las specs 0522 y 0537).
- **Ramas al día.** En los últimos 30 merges a `main`, la cabeza de la PR ya
  contenía el `main` anterior y el árbol del merge era idéntico al de la cabeza
  (medido con `git merge-base --is-ancestor` y comparando `^{tree}`). La cabeza
  `e40f1396` de la PR #244 pasó «Calidad continua» como `pull_request` (corrida
  38823473266) con el mismo árbol que después falló en `main`.
- **Migrate-first.** El Director aplica la migración en `dtd-cargo-db-1` y fusiona
  segundos después (13 s la 0476, 7 s la 0490). Mientras la web nueva no entra,
  la web vieja trabaja contra la base nueva. Las PR de la 0475 (#212) y de la
  0490 (#241) se fusionaron **con la espera todavía declarada** en
  `supabase/migrations-baseline.json`.
- **Esperas que van después de la web.** `0422_payment_report_command_boundary` y
  `0423_payment_report_historical_identity` están en `pendingBelowCutoff` desde el
  2026-09-13. Su texto dice que se aplican después de desplegar y del smoke.
- **Restricciones de la sesión de Contabo** (dueña de la SDD-0505 y de `infra/`),
  medidas en el VPS en solo lectura y recibidas por el Director como requisitos:
  - `/srv/dtd-cargo/.env` es root:root 600 y `/srv/dtd-cargo` es 700. Compose corre
    como root, no hay usuario de despliegue y por SSH entra solo root con llave.
  - El paquete de GHCR es privado. root tiene `docker login ghcr.io`; su alcance y
    su vencimiento están NO VERIFICADOS.
  - El comando exacto es `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml up -d --no-deps web`,
    desde `/srv/dtd-cargo`, sin `compose.ensayo.yml`. No se tocan `cron` ni los
    9 servicios de Supabase.
  - `DTD_WEB_IMAGE` es una sola línea. Se reemplaza solo esa línea, con copia
    previa, y nunca se escriben líneas `X=` vacías.
  - La prueba rápida es `smoke-web.sh --host dtdcargo.com --www`.
  - **Gate de migraciones:** una PR migrate-first nunca llega a la web antes que
    su migración.
  - Si un merge cambia los compose o el cron, el despliegue lo detecta y avisa en
    vez de seguir.
  - La vuelta atrás es el valor anterior de `DTD_WEB_IMAGE`. Hay 249 GB libres y
    hace falta una política de limpieza.
  - Hace falta `flock` y un interruptor en archivo (`/srv/ops/web/CONGELADO`).
  - Recomendación de Contabo: un timer en el VPS que tire de GHCR, sin llave SSH de
    root en GitHub.
  - No se tocan sin coordinar: `corte-paso2.sh`, `telegram-webhook.sh`, las
    etiquetas de Traefik del compose ni `smoke-web.sh` (a este último solo se le
    pueden sumar cosas).

## Alternativas comparadas

| | (a) Timer en el VPS que sigue `:main` | **(a′) Timer en el VPS que sigue `:publicable`** | (b) Actions empuja por SSH | (c1) Timer con token de GitHub en el VPS | (c2) Runner propio de Actions en el VPS | (c3) Receptor de webhook en el VPS | (c4) Watchtower o Diun |
|---|---|---|---|---|---|---|---|
| Credencial nueva | ninguna (login de GHCR que ya existe) | **ninguna** | llave SSH de root en los secretos de GitHub, más abrir el puerto 22 a GitHub o un túnel | token de lectura del repo privado en el servidor | token de registro del runner; el runner corre con docker (≡ root) | secreto HMAC y un endpoint público | login de GHCR y socket de docker |
| Quién puede publicar | quien empuje a `main` | quien empuje a `main` o mueva `:publicable` | quien edite un workflow o lea el secreto | igual que (a′) | **cualquier rama** con `runs-on: self-hosted` corre código como root en producción | quien conozca el HMAC | quien mueva la etiqueta |
| Exige CI en verde | **no** (`:main` se mueve a los 4 min; el 16-10 quedó en rojo) | **sí** (lo decide GitHub) | sí | sí | sí | sí | no |
| Gate de migraciones y de compose | sí, en el servidor | **sí, en el servidor** | en el servidor o en el workflow | sí | sí | sí | no |
| Merge → web | ~6 min, sin gate de CI | **~6 min** con el atajo de la PR; ~30 min sin él | ~6 min | ~6 min | ~6 min | ~6 min | ~5 min, sin gate |
| Vuelta atrás y prueba rápida | en el servidor | **en el servidor** | remota, por SSH | en el servidor | en el runner | en el servidor | no tiene |
| Si GitHub no responde | sigue lo último | **sigue lo último** | no publica | no publica | no publica | no publica | sigue lo último |

**Recomendación: (a′).** Es la alternativa de Contabo (tirar desde el VPS, sin
llave de root en GitHub) con un solo cambio: el timer sigue una etiqueta que
GitHub mueve solo cuando el CI está en verde, porque `:main` se mueve antes del CI
y el 2026-10-16 quedó apuntando a un commit en rojo.

Descartadas:

- **(b)** guarda en GitHub una llave que abre root en producción y obliga a abrir
  SSH a los rangos de GitHub (hoy entra solo root con llave, detrás de ufw).
- **(c1)** suma un token de GitHub en el servidor para lo mismo que (a′) resuelve
  con el `GITHUB_TOKEN` efímero del workflow. Sería la salida si algún día
  `:publicable` no alcanza.
- **(c2)** le da a cualquier rama del repo una forma de correr código como root en
  producción.
- **(c3)** expone un servicio nuevo a internet.
- **(c4)** no sabe del CI, ni de migraciones, ni de vuelta atrás.

## Diseño

### Flujo y tiempos

| Paso | Dónde | Tiempo |
|---|---|---|
| 1. Merge a `main` (migrate-first: la migración ya está en el ledger) | GitHub | T |
| 2. «Imagen Docker» publica `sha-<sha>` y `:main`, con tres etiquetas nuevas | GitHub | T + 3-4 min (medido) |
| 3. «Imagen publicable» decide y mueve `:publicable` | GitHub | T + 4-5 min (estimado: cola del runner y un minuto de corrida) |
| 4. El timer baja `:publicable`, pasa las puertas y publica solo `web` | VPS | ≤ 60 s de espera, más el pull |
| 5. Prueba de sharp, healthy y prueba rápida | VPS | healthy a los 24 s en la primera publicación sin Vercel (Contabo había medido 12-15 s antes), más la prueba de sharp y la prueba rápida (NO MEDIDAS) |
| **Merge → web** | | **≈ 6-7 min** (estimado). Con `PUBLICABLE_SOLO_CI_DE_MAIN=si`, ≈ 30 min |

Entre el `up -d` y el healthy, la web no responde. Compose para el contenedor
viejo antes de arrancar el nuevo, y se espera que Traefik no le mande tráfico a
un contenedor `starting`. Ese comportamiento no está medido en este servidor. El
corte se estima en 25-30 s por publicación (NO MEDIDO): el healthy tardó 24 s en
la primera publicación sin Vercel, más lo que tarda en parar el viejo. Ver
«Decisiones para Sam».

### GitHub: qué commit es publicable (`infra/ops/web/publicable.mjs`)

`.github/workflows/publicable.yml` corre cuando termina en verde «Imagen Docker» o
«Calidad continua» en `main` (y a mano, con la opción `simular`). Usa solo el
`GITHUB_TOKEN` del workflow (`contents: read`, `actions: read`, `packages: write`).

Un commit de `main` es publicable si:

1. «Imagen Docker» terminó en verde para ese SHA (push o `workflow_dispatch`), y
2. «Calidad continua» terminó en verde para ese SHA como push a `main`, **o**
3. **atajo de la PR**: el commit es un merge, la cabeza de la PR estaba 0 commits
   atrás del `main` anterior (`compare`), el árbol del merge es el de la cabeza, y
   «Calidad continua» terminó en verde en esa cabeza como `pull_request`. Con la
   rama al día, lo que probó el CI de la PR es el mismo árbol que se publica. Se
   apaga con la variable del repo `PUBLICABLE_SOLO_CI_DE_MAIN=si`.

Las corridas se buscan por **archivo** del workflow (`quality.yml`,
`build-image.yml`), evento, SHA y conclusión. Un check con el nombre «Calidad local
sin secretos» se puede crear por API; una corrida de `quality.yml`, no.

**Qué se promueve.** Se recorre `main` por el primer padre, del más nuevo al más
viejo, hasta 20 commits. Se promueve el primero que cumple. Si antes aparece el
commit que ya está en `:publicable`, no se mueve nada. La etiqueta nunca retrocede
y cada corrida decide desde cero: si GitHub descarta una corrida pendiente, la
siguiente no pierde nada. Con dos merges seguidos, primero entra el que terminó
antes y después el último. Un commit intermedio sin imagen o con el CI cancelado
se salta.

**Cómo se promueve.** Por la API del registro (OCI distribution): se lee el
manifiesto de `sha-<sha>` y se sube con los **mismos bytes** como `publicable`. El
digest es el mismo por construcción, sin docker ni buildx en el runner. Una imagen
reconstruida del mismo commit (otro digest) se vuelve a promover.

**Congelar desde GitHub.** Con la variable del repo `PUBLICABLE_CONGELADO=si`,
`:publicable` no se mueve. El Director la puede prender con `gh variable set` sin
entrar al servidor.

### Etiquetas nuevas de la imagen (`build-image.yml`)

- `org.dtdcargo.migraciones=v1:<n>:<nombres>`: todas las migraciones del commit con
  número mayor al `cutoff` (238), **incluidas las declaradas como espera**. Usa el
  mismo `findMissing` del gate `migrations-applied`. Con la 0491 son 252 nombres y
  unos 8,6 KB (medido el 2026-10-16).
- `org.dtdcargo.migraciones-en-espera=v1:<n>:<nombres>`: las que además están en
  `pendingBelowCutoff`. Solo sirven para que el aviso las nombre como espera.
- `org.dtdcargo.fuera-de-imagen=v1:9:<ruta>=<sha256>,…`: huellas de `compose.yml`,
  `compose.supabase.yml`, `cron/Dockerfile`, `cron/crontab`, `cron/entrypoint.sh`,
  `.env.example`, `supabase/templates/`, `supabase/volumes/` (sin `functions/`) y
  `functions/`. Para `functions/` se arma la misma unión que el README de
  `infra/dtd-cargo` al desplegar: el router del upstream y encima
  `supabase/functions/`. Las calcula `infra/ops/web/huellas-fuera-de-imagen.sh`,
  el mismo script que corre el servidor sobre sus copias.

El conteo `<n>` deja ver una etiqueta truncada. Si el paso de las etiquetas falla,
la imagen se construye igual sin ellas, y el servidor no la publica: ni solo ni con
`publicar <sha>` (falla cerrado). Lo mismo pasa con toda imagen anterior a esta
spec. A una imagen sin etiquetas solo se llega con `volver`, si es la anterior, o
editando el `.env` a mano como antes.

### Servidor: `infra/ops/web/publicar-web.sh vigilar`

Lo corre `dtd-cargo-publicar.timer` cada minuto, 60 s después de que termina la
vuelta anterior (`OnUnitInactiveSec`). Además, `flock -n` sobre
`/run/lock/dtd-cargo-publicar.lock`. En cada vuelta:

1. Si existe `/srv/ops/web/CONGELADO`, no hace nada (Kuma: up, «congelado: motivo»).
2. Si existe `/srv/dtd-cargo/compose.ensayo.yml`, no sigue y avisa, como el
   interino. Ni siquiera baja la imagen.
3. Si quedan menos de 10 GB libres en `/var/lib/docker`, se detiene y avisa.
4. `docker pull -q …:publicable`. Si falla, avisa: puede ser el login de GHCR de
   root vencido.
5. Comprueba que la imagen viene de este repo: `org.opencontainers.image.source`,
   un `revision` de 40 hex y un digest de `ghcr.io/hailuwaycom-sketch/dtdcargo`.
6. Si ya corre ese digest, o el mismo commit cuando el `.env` no trae digest, queda
   al día (Kuma: up).
7. Si ese digest falló antes, espera al próximo merge (Kuma: down).
8. **La vuelta atrás tiene que existir antes de publicar.**
   - El `.env` tiene una sola línea `DTD_WEB_IMAGE`, y no está vacía.
   - La imagen de ese valor (la anterior) está en el servidor. Si no está, la baja.
     Si tampoco puede bajarla, no publica: no habría vuelta atrás.
   - Si la anterior es la misma imagen que la nueva (mismo id), no hay a dónde
     volver: lo dice y no hace nada.
9. **Puerta de migraciones.** Lee el ledger con `docker exec <db> psql`, solo los
   nombres y en una transacción de solo lectura. Toda migración de la etiqueta
   tiene que estar en el ledger o aceptada a mano en
   `/srv/ops/web/estado/pendientes-aceptadas`. Si falta alguna, no publica y avisa
   cuáles.
   - Las esperas no se eximen, porque las PR migrate-first se han fusionado con la
     espera todavía declarada.
   - Las que van después de la web se aceptan una por una, con el OK de Sam:
     `publicar-web.sh aceptar-pendiente <nombre>`.
   - Si falta la etiqueta, el ledger sale vacío o la base no corre, no publica.
10. **Puerta de lo que vive fuera de la imagen.**
    - Si difieren los compose o el cron, no publica. Hay que copiar
      `infra/dtd-cargo` de ese commit y, si cambió `cron/`, reconstruir y
      reiniciar el cron a mano.
    - Si difieren `functions/`, las plantillas, los volúmenes o `.env.example`,
      publica y avisa. Las funciones ya se desplegaban aparte de la web en Cloud.
11. **Prueba de sharp.** Usa el mismo código que la etapa `build` del Dockerfile:
    `docker run --rm --network none --entrypoint node -w /app <imagen> -e "require('sharp')(…).webp().toBuffer()…"`.
    A diferencia del interino, que solo hace `require`, convierte de verdad a
    WebP, como `/_next/image`. Si no convierte, no publica: `/_next/image`
    serviría las fotos sin optimizar (hallazgo del ensayo del 2026-10-14).
12. Copia el `.env` en `.env.bak-publicar-<hora>`, el mismo nombre del interino, y
    nunca muestra su contenido.
    - Como llevan secretos, de las copias con ese prefijo se conservan las 3
      últimas (`PUBLICAR_CONSERVAR_COPIAS_ENV`). Esto incluye las que dejó el
      interino.
    - Las demás copias del `.env` (`.env.bak-vacias-*`, `.env.bak-ensayo-*`…) no
      se tocan.
13. Con un archivo temporal (600, mismo dueño) y `mv`, reemplaza **solo**
    `DTD_WEB_IMAGE=…:sha-<sha>@sha256:<digest>`. Antes comprueba que nada más
    cambió. Fijar el digest hace que corra exactamente la imagen que se revisó,
    aunque alguien vuelva a empujar la etiqueta.
14. Corre `compose … config -q` y después el comando exacto de Contabo, desde
    `/srv/dtd-cargo`.
15. Espera healthy hasta 150 s, con el contenedor en la imagen nueva. Corre
    `smoke-web.sh --host dtdcargo.com --www` y, si falla, una segunda vez a los 15 s.
16. **Vuelta atrás automática.** Si el healthy o las dos pruebas rápidas fallan,
    vuelve al valor anterior de `DTD_WEB_IMAGE`, repite el `up` y lo prueba. Esa
    imagen queda rechazada hasta el próximo merge. Si la vuelta atrás también
    falla, escribe `CONGELADO` (sale 2) y avisa URGENTE.
17. Si la publicación sale bien, limpia las imágenes viejas. **Nunca** toca la
    vigente (la nueva), la anterior a ella ni la que corría: las protege por id,
    no por fecha. Ni siquiera intenta borrarlas.

A mano:

- `<sha>` o `publicar <sha>`: la interfaz del interino.
  - Acepta 40 hex o `sha-<40 hex>`; un prefijo corto es un error de uso.
  - La etiqueta `sha-<sha>` tiene que traer ese commit en `revision`.
  - Mientras esté congelado, solo corre con `--aunque-congelado`. Con
    `compose.ensayo.yml`, nunca.
  - Si publica, deja la `:publicable` del momento fuera hasta el próximo merge,
    para que el vigilante no la pise. Si era la misma imagen, no deja nada.
- `volver`: vuelve a la imagen anterior, aunque esté congelado. No corre con
  `compose.ensayo.yml`. Si la anterior es la misma imagen que corre, lo dice y no
  hace nada.
- `revisar [<sha>]`: corre las puertas sin publicar.
- `estado`, `congelar "<motivo>"`, `descongelar` y `aceptar-pendiente`.

### Comparación con el script interino (texto recibido el 2026-10-16, sha16 `507df8e0155f59c7`)

| Paso del interino | El nuevo |
|---|---|
| `publicar-web.sh <SHA>`, sin validar el SHA | la misma interfaz; acepta 40 hex o `sha-<40 hex>` y rechaza el resto (código 3) |
| no sigue si existe `compose.ensayo.yml` | igual: en `vigilar`, a mano y en `volver` |
| `docker pull -q …:sha-<SHA>` | igual a mano; el vigilante baja `:publicable`. Además comprueba que la etiqueta trae ese commit en `revision`, que viene del repo (`source`) y su digest |
| sharp: `require('sharp')` con `-w /app`, sin red | `-w /app`, sin red, y además convierte a WebP |
| `cp -p .env .env.bak-publicar-<hora>`, sin rotar | la misma copia y el mismo nombre; conserva las 3 últimas con ese prefijo y no toca las demás |
| `sed -i` sobre toda línea `DTD_WEB_IMAGE=`, con la etiqueta | exige una sola línea, escribe a un temporal más `mv`, comprueba que nada más cambió y fija el digest |
| `ANT` sin comprobar | `ANT` tiene que estar en el servidor (o se baja) antes de publicar; si es la misma imagen, no hace nada |
| `up -d --no-deps web` | el mismo comando, con `compose … config -q` antes |
| espera healthy 120 s (60 × 2 s) | hasta 150 s, y además el contenedor tiene que estar en la imagen nueva |
| smoke una vez | smoke y un reintento a los 15 s |
| si falla, vuelve a `ANT`, prueba y sale 1 | igual; si la vuelta atrás también falla, congela y avisa URGENTE (sale 2), y la nueva queda rechazada |
| evidencia: `publicar-web-<sha8>-<hora>.txt` (`tee`) | carpeta `publicar-web-<hora>-publicar-<sha8>/` con la salida, cada prueba y `SHA256SUMS`. **Cambia el nombre**: si algo lee las evidencias del interino, hay que ajustarlo |
| — | candado, congelación, gate de migraciones, huellas de compose y cron, avisos por Telegram y Kuma, y limpieza de imágenes |

### Seguridad

- **Credenciales.**
  - GitHub usa solo su `GITHUB_TOKEN` efímero.
  - El servidor usa el login de GHCR de root, que ya existe, y los tokens de
    Telegram y Kuma de `/srv/ops/web/publicar.env` (root, 600). Ningún token viaja
    como argumento de `curl`: van por stdin (`-K -`), como en `telegram-webhook.sh`.
  - No hay llave del servidor en GitHub ni token de GitHub en el servidor.
- **SHA arbitrario.** El vigilante no recibe nada desde afuera: lee una etiqueta de
  GHCR y valida su `revision` y su `source`. A mano solo acepta 40 hex, y la
  etiqueta tiene que traer ese commit. El valor del `.env` se arma con constantes
  más el SHA y el digest ya validados.
- **Lo que queda abierto (riesgo residual).** El límite de confianza es el mismo
  que hoy tienen `:main` y `sha-*`: cualquier workflow del repo con
  `packages: write` puede empujar una etiqueta. Para eso hace falta escribir en el
  repo. Aun así, una imagen forzada tiene que pasar las puertas del servidor
  (origen, migraciones, compose) y la prueba rápida, y queda en la evidencia con
  su digest. Cerrarlo del todo pediría atestaciones firmadas, que en un repo
  privado exigen GitHub Enterprise Cloud: fuera de alcance.

### Interruptores

- Servidor: `/srv/ops/web/CONGELADO` (lo prende la sesión de Contabo con `congelar`).
  Lo prende solo el script si una vuelta atrás falla.
- GitHub: la variable `PUBLICABLE_CONGELADO=si` (la prende el Director). Congela la
  etiqueta y el servidor sigue con lo que tiene.
- Para un corte o una ventana de mantenimiento: congelar en los dos lados antes de
  empezar y descongelar al cerrar.

### Evidencia

Cada publicación y cada vuelta atrás a mano dejan
`/srv/ops/evidencias/publicar-web-<hora>-<tipo>-<sha8>/` (700) con `salida.txt`,
`imagen-antes.txt`, `imagen-nueva.txt`, `migraciones-exigidas.txt`,
`huellas-servidor.txt`, `sharp.txt`, la salida de `compose config` y de
`compose up`, cada prueba rápida y `SHA256SUMS`, que se calcula al final y
verifica. No guarda el `.env` ni secretos.

Las vueltas sin cambios y las retenciones por una puerta no dejan carpeta: van al
journal (`journalctl -u dtd-cargo-publicar.service`), con la lista completa de lo
que falta. Los avisos largos se recortan: Telegram a 3500 caracteres y Kuma a 200.

### Avisos

- **Uptime Kuma** (monitor push «Publicación web DTD · vigilante»), en cada vuelta:
  - `up` si está al día, si acaba de publicar o si está congelado;
  - `down` mientras haya algo retenido o rechazado.

  Si el timer o el servidor se caen, Kuma deja de recibir y lo marca caído. Kuma
  avisa por Telegram con `@dtdcargobot`, como los otros monitores.
- **Telegram directo** (opcional): avisa cada publicación, cada vuelta atrás, cada
  retención (una vez por motivo, no una por minuto) y cada vez que se congela o se
  descongela. Usa el bot del `.env` (`TELEGRAM_BOT_TOKEN`, DTDStudioBot) o
  `PUBLICAR_TELEGRAM_BOT_TOKEN`, hacia `PUBLICAR_TELEGRAM_CHAT_ID`. El chat de
  operaciones está NO VERIFICADO.

### `cron` y `functions`

Solo se publica `web`. `cron` (imagen local construida desde `cron/`) y `functions`
(carpeta montada) no cambian con la imagen. Si un merge cambia el cron, la puerta
de huellas frena la web hasta que Contabo lo sincroniza. Si cambia una función,
avisa y publica la web. Mientras el web se recrea, un cron que caiga justo en esos
segundos falla una vez y el siguiente corre normal.

### Limpieza de imágenes y disco

Después de cada publicación buena se conservan las 5 imágenes más nuevas de
`ghcr.io/hailuwaycom-sketch/dtdcargo` (`PUBLICAR_CONSERVAR_IMAGENES`, mínimo 2),
siempre más la que corre y la anterior. Las demás se borran por referencia
(etiqueta y digest) con `docker rmi` sin `-f`: una imagen en uso no se borra.
Nunca toca imágenes de otros repositorios y no usa `docker image prune`. Cada
imagen ocupa unos 520 MB, así que 7 imágenes son unos 3,6 GB de los 249 libres.
Bajo 10 GB libres (`PUBLICAR_MIN_LIBRE_GB`) el vigilante no baja nada y avisa.

## Decisiones para Sam

1. **Atajo de la PR** (recomendado y encendido por defecto). Publica a los ~6 min
   del merge con el CI de la PR verde sobre el mismo árbol. Sin él, ~30 min, y una
   seguidilla de merges cada menos de 30 min no publica hasta que paren, porque el
   CI de `main` se cancela con cada merge nuevo. Si Sam prefiere esperar el CI de
   `main`: `PUBLICABLE_SOLO_CI_DE_MAIN=si`.
2. **0422 y 0423** se aceptan al instalar como esperas que van después de la web.
   Recomendado, porque así lo dicen sus textos; sin eso, el gate frena toda
   publicación.
3. **Funciones distintas: avisar o frenar.** Recomendado: avisar, como en Cloud,
   donde las funciones se desplegaban aparte.
4. **Chat de Telegram para estos avisos** y bot (DTDStudioBot del `.env` u otro).
   Kuma alcanza para encenderlo; el Telegram directo es opcional.
5. **El corte de 25-30 s por publicación** (estimado). Si molesta, sacarlo pide
   publicar con dos contenedores a la vez y sacar el viejo después. Es una tarea
   aparte, que cambia el comando de Contabo y que no está en este alcance.

## Fuera de alcance

- Instalar en el VPS: lo hace la sesión de Contabo con
  [el plan de instalación](../../runbooks/publicacion-automatica-web.md), después
  del corte y con el OK de Sam.
- El panel de publicaciones del Studio, que hoy lee Vercel: es una tarea aparte
  (handoff).
- `corte-paso2.sh`, `smoke-web.sh` y `telegram-webhook.sh` no se tocan. Las
  etiquetas de Traefik y los servicios del compose tampoco.
- `quality.yml` no cambia.

## Gobernanza

Las políticas del registro (`docs/governance/policies/`) son de UI y de la app.
Este cambio no toca pantallas ni mutaciones de la app: **no aplica**. Datos
personales: el script lee del ledger solo los nombres de las migraciones, ninguna
fila de negocio; la evidencia y los avisos no llevan datos personales (**no
aplica** `revisar-datos-ve`).

## Aceptación

1. [x] `infra/ops/tests/prueba-publicar-web.sh` PASÓ en Linux, con dobles de
   `docker`, `curl` y la prueba rápida (cifras en el handoff).
2. [x] `--mutantes`: el control rojo falla contra un script vacío y todos los
   mutantes del diff mueren.
3. [x] `infra/ops/tests/publicable.test.mjs` PASÓ en Vitest (corre también en
   `pnpm test` del CI). Los mutantes del diff de `publicable.mjs` mueren.
4. [x] actionlint de los workflows, shellcheck (severidad `warning`), `bash -n`,
   `pnpm docs:check`, `pnpm sdd:check` y `git diff --check`, limpios.
5. [ ] Después del merge, que hace el Director con el OK de Sam:
   - la corrida de «Imagen Docker» de ese merge trae las tres etiquetas;
   - «Imagen publicable» (primero a mano con `simular`) mueve `:publicable` a ese
     commit.
6. [ ] La sesión de Contabo instala el plan:
   - `revisar` pasa;
   - la primera publicación sale bien y deja evidencia con `SHA256SUMS`;
   - un simulacro de `volver` y de vuelta adelante sale bien;
   - Kuma muestra el monitor en verde.
7. [ ] Primer merge de producto publicado solo, con su tiempo merge → web medido.

## Allowlist de archivos

Nuevos:

- `infra/ops/web/publicar-web.sh`
- `infra/ops/web/huellas-fuera-de-imagen.sh`
- `infra/ops/web/publicable.mjs`
- `infra/ops/tests/prueba-publicar-web.sh`
- `infra/ops/tests/publicable.test.mjs`
- `infra/dtd-cargo/systemd/dtd-cargo-publicar.service`
- `infra/dtd-cargo/systemd/dtd-cargo-publicar.timer`
- `.github/workflows/publicable.yml`
- `docs/runbooks/publicacion-automatica-web.md`
- `docs/specs/0541-publicacion-automatica-vps/spec.md`
- `.agents/handoffs/0541-publicacion-automatica-vps.md`

Modificados:

- `.github/workflows/build-image.yml`: el paso de las etiquetas, las etiquetas en
  el build y los comentarios.
- `docs/specs/README.md`: el índice regenerado.

## Seguimiento

- **2026-10-16 · decisiones de Sam** (registró el Director). Literal: «1 sí, 2 sí, 3 solo avisa, 5 sí».
  1. **Atajo de la PR: sí.** Queda encendido por defecto, sin `PUBLICABLE_SOLO_CI_DE_MAIN`.
  2. **0422 y 0423: sí.** Se aceptan al instalar como esperas que van después de la web.
  3. **Funciones distintas: solo avisa,** sin frenar la publicación.
  4. **Chat de Telegram: sin respuesta.** Se enciende solo con Uptime Kuma, como permite el diseño, y el Telegram directo queda para después, cuando Sam nombre el chat.
  5. **Corte de 25-30 s por publicación: sí,** aceptado.

  Falta, para encender: el OK literal de Sam («autorizo encender la publicación automática de la web en el servidor propio») y el monitor push de Kuma, cuya URL pega Sam directo en la terminal del servidor.
- **2026-10-16 · diseño e implementación en el repo** (Worker, rama
  `codex/publicacion-automatica-vps`). Las restricciones de Contabo llegaron por el
  Director a mitad del diseño y cambiaron dos cosas:
  - el modelo pasó a tirar desde el VPS;
  - se sumaron las puertas de migraciones y de compose.

  La lectura del baseline cambió una más: las esperas no se eximen. Sin tocar el
  VPS, GHCR con credenciales, Vercel ni producción.
- **2026-10-16 · el texto del interino y las tres notas de Contabo** (PR #250).
  Llegó el texto exacto del interino (32 líneas). El nuevo conserva su contrato;
  ver § Comparación con el script interino. Sobre las notas:
  1. **Sharp:** el nuevo ya convertía a WebP; se suma `-w /app`, como el interino.
     Medido en local con la imagen vieja `dtdcargo:0505-test`, anterior al
     arreglo de libvips: fallan las dos pruebas, el `require` del interino y la
     conversión (`libvips-cpp.so.8.18.3: cannot open shared object file`). El caso
     bueno no se pudo medir en local porque no hay una imagen nueva sin GHCR.
  2. **Copias del `.env`:** se conservan las 3 últimas `.env.bak-publicar-*`, las
     demás copias no se tocan y nunca se muestra su contenido.
  3. **Vuelta atrás segura:** la anterior tiene que estar en el servidor (o se
     baja) antes de publicar; si es la misma imagen, no hace nada; la limpieza
     nunca intenta borrar la vigente, la anterior ni la que corría.

  Además, `compose.ensayo.yml` frena `vigilar`, la publicación a mano y `volver`.
  Cada nota tiene su prueba y su mutante (cifras en el handoff).

## Continuación acotada · identidad del repositorio (2026-10-20)

Estado: **implementado y validado localmente; PR borrador, integración e instalación pendientes**.
Las casillas de aceptación anteriores corresponden al trabajo inicial, no
certifican esta continuación. Registro propio:
[handoff de identidad](../../../.agents/handoffs/0541-publicacion-identidad-softagentes.md).

Sam aclaró que cambió el nombre del perfil de GitHub. La API del 2026-10-20,
22:06:28Z, devuelve `SoftAgentes/DTDCARGO`, repo ID `1246490707`, owner `User`,
login `SoftAgentes`, owner ID `285193249`. La ruta antigua resuelve al mismo repo;
no se afirma traslado a una organización ni cambio de propietario.

La acción de metadatos fijada por `build-image.yml` obtiene
`org.opencontainers.image.source` de `repo.html_url`. El publicador de la base
`d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8` solo admite la URL antigua. El Director
confirmó por lectura del VPS a las **22:07:19Z** que el script instalado conserva
esa constante; la imagen servida y publicable seguían en `8e9e0f50…`. No se ha
observado un fallo real de publicación de una imagen nueva ni esta continuación
constituye una nueva lectura del servidor.

### Contrato y frontera

Opción A aceptada: origen canónico
`https://github.com/SoftAgentes/DTDCARGO` y alias histórico
`https://github.com/hailuwaycom-sketch/DTDCARGO`. Son **dos cadenas exactas**,
comparadas sin distinguir mayúsculas, como el contrato previo. Un origen ajeno,
vacío, con sufijo, barra final o esquema distinto queda fuera. No se consultan
redirecciones HTTP ni se admite una fuente arbitraria mediante entorno o patrones.

Ambas fuentes deben funcionar en publicación automática y manual; la recuperación
conserva las imágenes anteriores. SHA/revisión/digest, migraciones, huellas,
sharp, imagen previa, salud/smoke, rollback, congelación y locks mantienen sus
garantías. El namespace GHCR y los workflows/promotor no cambian; no se fija una
etiqueta antigua en el build. Acceso efectivo al paquete: **NO VERIFICADO**, sin
inferir pérdida de permisos, credenciales o imágenes.

Esta tarea solo prepara código local revisable y PR borrador tras validarlo. No
autoriza instalar, mergear, publicar, modificar cuentas o reaplicar 0495. Se
mantiene la prohibición de merge/deploy durante el bloqueo de GitHub y el orden de
integración del Director. El procedimiento de solo script en el runbook es una
preparación para una ventana posterior autorizada, no una acción ejecutada.

### Aceptación de la continuación

1. [x] ROJO funcional real contra el script original: el origen canónico nuevo
   falla en las rutas automática y manual antes de cambiar el producto.
2. [x] Verde Linux con dobles: ambas fuentes exactas y sus variantes de mayúsculas
   publican el SHA/digest esperado por `vigilar`, `publicar <sha>` y `<sha>`.
3. [x] Fuentes ajenas/vacías/ausentes, sufijos, barra final y `http` se rechazan
   en esos caminos sin `up`, cambio del `.env` sintético ni cambio de contenedor;
   el entorno tampoco puede autorizar una fuente ajena.
4. [x] Smoke fallido de una imagen con origen nuevo vuelve a la imagen histórica;
   la vuelta manual conserva imágenes anteriores de ambas fuentes.
5. [x] Controles rojo/verde y mutantes de la identidad, incluido eliminar su
   comprobación; regresiones previas conservadas, focal pertinente del promotor,
   `bash -n`, docs/SDD y diff sin debilitar comprobaciones.
6. [x] Procedimiento de respaldo/hash/instalación/reversión de solo script
   revisable; handoff con resultados por SHA, pendientes de CI/release y conocimiento.
7. [ ] Revisión del Director sobre el SHA publicado y PR borrador; instalación,
   CI de release, imagen/digest, recibo 14/0 y Studio se registran por separado.

Evidencia local del 2026-10-20, asociada a los blobs del commit
`b6af34a3c88c835d50a8dc40c95b608da0d1f3f8`: ROJO 177/10/0 contra el original;
verde completo 190/0/0 (144 comprobaciones previas y 46 de identidad); control
vacío con 165 fallos; seis mutantes pertinentes muertos/cero vivos; promotor
30/30; sintaxis, docs/SDD y diff correctos. Detalle, hashes y límites en el
handoff. Conocimiento derivado pendiente: lectura de status interrumpida sin
JSON; no se regeneraron Graphify, Archify ni preview de Obsidian. La instalación
operativa y el recibo real 14/0 permanecen **NO EJECUTADOS**.

### Allowlist exclusiva de esta continuación

- `infra/ops/web/publicar-web.sh`
- `infra/ops/tests/prueba-publicar-web.sh`
- `docs/runbooks/publicacion-automatica-web.md`
- `docs/specs/0541-publicacion-automatica-vps/spec.md`
- `.agents/handoffs/0541-publicacion-identidad-softagentes.md` (nuevo)

El listado histórico de la SDD no amplía estas cinco rutas. El handoff inicial
se conserva. Si un check requiere el índice generado u otra ruta, el Worker lo
informa al Director antes de editarla.

## Continuación acotada · dirección de la imagen (2026-11-01)

Estado: **implementado y validado localmente; integración, instalación y encendido
pendientes**. Registro propio:
[handoff de la dirección](../../../.agents/handoffs/0541-imagen-softagentes.md).

Medido por el Director el 2026-11-01 desde el VPS con `docker manifest inspect`:
`ghcr.io/softagentes/dtdcargo:publicable` responde (revisión `8e9e0f505`) y
`ghcr.io/hailuwaycom-sketch/dtdcargo` da «manifest unknown» en `:publicable` y en
`:sha-8e9e0f505322cd57b3230cce6b16b45b5554cb8a`. Eso deja sin efecto, solo en la
dirección de la imagen, la frase de la continuación del 2026-10-20 «el namespace
GHCR y los workflows/promotor no cambian». La parte de las dos fuentes exactas
sigue igual.

### Contrato

- Una sola dirección de imagen: `ghcr.io/softagentes/dtdcargo`, en `build-image.yml`,
  `build-image-prueba.yml`, `publicable.mjs`, `publicar-web.sh` y staging. Sin lista
  de direcciones ni respaldo a la vieja.
- `FUENTE` y `FUENTE_HISTORICA` no cambian: una imagen en la dirección nueva con
  cualquiera de los dos orígenes exactos se acepta, y cualquier otro se rechaza.
- Lo que el servidor ya tiene con el nombre viejo sirve de vuelta atrás mientras esté
  en el disco. Si no está, no se publica, y la limpieza no lo toca.
- Staging rechaza una imagen de la dirección vieja.
- Ninguna huella cambia: `compose.yml` y `.env.example` quedan fuera de esta
  continuación, con su valor por defecto viejo, que producción no usa.

No debilita las validaciones de SHA, digest, identidad, migraciones ni huellas.
No autoriza fusionar, instalar, encender workflows ni el timer, mover etiquetas,
tocar `PUBLICABLE_CONGELADO` ni aplicar migraciones. La ventana está en el
[runbook](../../runbooks/publicacion-automatica-web.md#dirección-de-la-imagen--preparación-del-2026-11-01).

### Aceptación de esta continuación

1. [x] ROJO real: con la prueba nueva contra el script sin cambiar falla, y el
   promotor también.
2. [x] Verde en Linux con dobles que distinguen direcciones: `vigilar`, `publicar`
   y `revisar` bajan y fijan la dirección nueva, con los dos orígenes.
3. [x] Con la anterior en la dirección vieja: publica sin intentar bajarla, la vuelta
   atrás automática y `volver` llegan a ella, y sin copia local no publica.
4. [x] La limpieza no toca la dirección vieja. El mismo digest bajo la dirección
   nueva cuenta como al día.
5. [x] Candado en Vitest: todas las constantes coinciden con la del promotor, y
   workflows, `infra/ops/web` e `infra/ops/staging` no nombran el registro viejo.
6. [x] Mutantes de dirección, origen y limpieza muertos. Huellas idénticas antes y
   después. `docs:check`, `sdd:check` y `git diff --check` limpios.
7. [ ] Después del merge: V1 a V6 del runbook. V4 es lo que demuestra que
   `GITHUB_TOKEN` puede escribir en la dirección nueva, hoy **NO VERIFICADO**.

### Allowlist exclusiva de esta continuación

- `.github/workflows/build-image.yml`, `.github/workflows/build-image-prueba.yml`,
  `.github/workflows/publicable.yml`
- `infra/ops/web/publicar-web.sh`, `infra/ops/web/publicable.mjs`
- `infra/ops/staging/lib-prueba.sh`, `infra/ops/staging/env-prueba.sh`,
  `infra/ops/staging/desplegar-prueba.sh`, `infra/ops/staging/verificar-aislamiento.sh`
- `infra/ops/tests/prueba-publicar-web.sh`,
  `infra/ops/tests/prueba-scripts-entorno-prueba.sh`,
  `infra/ops/tests/publicable.test.mjs`
- `infra/dtd-cargo/README.md`
- `docs/runbooks/publicacion-automatica-web.md`, `docs/runbooks/entorno-prueba.md`,
  `docs/runbooks/servidor-contabo.md`
- `docs/specs/0541-publicacion-automatica-vps/spec.md`
- `.agents/handoffs/0541-imagen-softagentes.md` (nuevo)

## Continuación acotada · commit exacto, marcha atrás y valores por defecto (2026-11-02)

Estado: **implementado y validado localmente; integración e instalación pendientes**.
Sam lo autorizó, literal: «Sí, corrígelos». No cubre instalar en el VPS, descongelar ni
publicar. Registro: [handoff](../../../.agents/handoffs/0541-publicar-commit-exacto.md).

### Contrato

- Publicar un commit elegido no pasa por `descongelar` ni por el timer. Usa
  `publicar <sha> --aunque-congelado`, que ya existe. `publicar-web.sh` no cambia.
- Encender el timer es un paso aparte, y entra lo que diga `:publicable` en ese momento.
- `compose.yml` y `.env.example` pasan a `ghcr.io/softagentes/dtdcargo:main`, y el
  comentario de `compose.yml` deja de nombrar el bot de deploy retirado por la SDD-0551.
- La imagen de `storage` en `compose.supabase.yml` pasa a
  `${DTD_STORAGE_IMAGE:-supabase/storage-api:v1.77.6}`. Es decisión del Director del
  2026-11-02, para no perder la copia que corre el servidor, con Node actualizado y
  `DB_ALLOW_MIGRATION_REFRESH=false`. En un servidor sin la línea va la oficial, y
  `.env.example` la documenta comentada.
- Las huellas de esos tres archivos cambian y las demás no. Instalarlos es parte de la
  ventana de publicar, descrita en el
  [runbook](../../runbooks/publicacion-automatica-web.md#instalar-composeyml-composesupabaseyml-y-envexample):
  primero la línea en el `.env` del servidor, después los archivos.

### Aceptación de esta continuación

1. [x] La prueba cubre los dos literales, con control rojo contra los valores viejos.
2. [x] `infra/dtd-cargo` entra en la lista de carpetas que no nombran el registro viejo.
3. [x] Prueba con dobles del camino real: la web en un id suelto y `CONGELADO` puesto.
   Publica `X`, sigue congelado, el vigilante no lo pisa, un merge posterior sí entra, y
   las dos vueltas atrás llegan al id.
4. [x] Prueba de que `revisar` para en la primera puerta.
5. [x] Mutantes nuevos muertos.
6. [x] La prueba de `storage` falla si vuelve el literal o el id fijo, si cambia el valor por
   defecto, si `.env.example` deja la línea activa, si el overlay de prueba fija la imagen o
   si la prueba de la base efímera deja de encontrarla.
7. [ ] Linux: el CI «Calidad continua» de la PR.
8. [ ] Después del merge: la ventana del runbook, con el OK de Sam.

### Allowlist exclusiva de esta continuación

- `infra/dtd-cargo/compose.yml`, `infra/dtd-cargo/compose.supabase.yml`, `infra/dtd-cargo/.env.example`
- `infra/ops/tests/publicable.test.mjs`, `infra/ops/tests/prueba-publicar-web.sh`,
  `infra/ops/tests/prueba-resetear-base-efimera.sh`
- `scripts/__tests__/entorno-prueba-compose.test.mjs`
- `docs/runbooks/publicacion-automatica-web.md`
- `docs/specs/0541-publicacion-automatica-vps/spec.md`
- `.agents/handoffs/0541-publicar-commit-exacto.md` (nuevo)
