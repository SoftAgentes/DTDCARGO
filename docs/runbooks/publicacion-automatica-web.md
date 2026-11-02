# Runbook · Publicación automática de la web en el servidor propio · SDD-0541

**SDD:** [0541](../specs/0541-publicacion-automatica-vps/spec.md) · depende de la
[0505](../specs/0505-dockerizar-dtd-cargo-contabo/spec.md)
**Estado:** INSTALADO Y ENCENDIDO el 2026-10-16 a las 14:23:41Z (timer `dtd-cargo-publicar.timer`). El registro de la instalación está al final de este runbook. **La publicación sigue detenida a propósito desde el 2026-10-25.** Al cerrar la ventana del 2026-11-01: `build-image.yml` y `publicable.yml` encendidos, `PUBLICABLE_CONGELADO` borrada, script nuevo instalado, `CONGELADO` puesto en el VPS, timer apagado y la web en `929cabf51`. Cada merge a `main` arma imagen y, con el CI en verde, mueve `:publicable`, sin tocar la web. Resultados y lo que falta para publicar: [Dirección de la imagen](#dirección-de-la-imagen--preparación-del-2026-11-01).
**Quién:**

- La sesión de Contabo instala y opera en el VPS.
- Sam decide, crea el monitor y pega lo que es secreto.
- El Director fusiona y congela desde GitHub.

**Cuándo:** después de cerrar el corte (paso 2, `corte-paso2.sh cierre`) y con el
OK de Sam para encender.

## Cómo funciona, en una línea por pieza

| Pieza | Dónde | Qué hace |
|---|---|---|
| `build-image.yml` | GitHub | Construye `sha-<sha>` con tres etiquetas nuevas: las migraciones del commit, las que están en espera y las huellas de los compose, el cron y las funciones. |
| `publicable.yml` + `infra/ops/web/publicable.mjs` | GitHub | Mueve `:publicable` al commit más nuevo de `main` con imagen y CI en verde (o el verde de su PR con el mismo árbol). Nunca retrocede. |
| `dtd-cargo-publicar.timer` | VPS | Cada minuto, `publicar-web.sh vigilar`. |
| `/srv/ops/web/publicar-web.sh` | VPS | Si `:publicable` no es lo que corre, pasa las puertas (migraciones, compose y cron, sharp), cambia solo `DTD_WEB_IMAGE`, `up -d --no-deps web`, healthy, prueba rápida y, si falla, vuelve atrás. Reemplaza al interino de la misma ruta y conserva su interfaz `publicar-web.sh <sha>`. |
| `/srv/ops/web/huellas-fuera-de-imagen.sh` | GitHub y VPS | Las mismas huellas de los dos lados. |
| `/srv/dtd-cargo/estado-publicacion/publicaciones.json` | VPS → Studio | Lo escribe `publicar-web.sh` al final de `vigilar`, `publicar`, `volver`, `congelar` y `descongelar` ([SDD-0547](../specs/0547-panel-publicaciones-servidor/spec.md) §4). El web lo ve en solo lectura y `/studio/debug` › Estado lo muestra. Ver [Estado para el Studio](#estado-para-el-studio-sdd-0547). |

## Plan de instalación

Cada paso tiene su comprobación. Si una comprobación no da lo esperado, se para y
se avisa al Director. No se sigue «a ver qué pasa».

### A · Repo y Director (antes de tocar el servidor)

| # | Paso | Comprobación |
|---|---|---|
| A1 | Merge de la PR de la SDD-0541, con el OK de Sam. Llamemos `M0` a su commit de merge | `git log -1 origin/main` = `M0` |
| A2 | Esperar «Imagen Docker» de `M0` | `gh run list --workflow build-image.yml --branch main -L 1` → `success` para `M0`. En el log del paso «Etiquetas para el servidor (SDD-0541)» se ven las tres líneas `org.dtdcargo.*` |
| A3 | «Imagen publicable» corre sola al terminar A2. Antes, si se quiere ver qué haría: `gh workflow run publicable.yml -f simular=true` | El resumen de la corrida dice «`:publicable` → `M0` (ci-de-la-pr)» o «(ci-de-main)». Si dice «Ningún commit reciente…», leer la tabla de motivos |
| A4 | Variables del repo: no crear ninguna (vacías = apagadas). Si Sam eligió esperar el CI de main: `gh variable set PUBLICABLE_SOLO_CI_DE_MAIN --body si` | `gh variable list` |

### B · Sam (lo que carga, decide o paga)

| # | Paso | Comprobación |
|---|---|---|
| B1 | Decidir los puntos 1 a 5 de «Decisiones para Sam» de la spec (atajo de la PR, 0422 y 0423, funciones, chat de Telegram, corte breve) | Respuesta literal de Sam en el handoff |
| B2 | En Uptime Kuma (`vps.dtdcargo.com`) crear el monitor **Push** «Publicación web DTD · vigilante»: intervalo de latido 300 s, 1 reintento, notificación de Telegram encendida. Copiar su URL de push. No pegarla en el chat: se pega en la terminal del paso C4 | El monitor aparece en «pendiente» |
| B3 | Opcional: el chat de Telegram para los avisos de cada publicación. El bot (DTDStudioBot u otro) tiene que estar en ese chat | El mensaje de prueba de C4 llega |
| B4 | El OK para encender, nombrando qué: «autorizo encender la publicación automática de la web en el servidor propio» | Texto literal en el handoff |

No hay nada que pagar ni secretos nuevos en GitHub. La única credencial del
servidor es el login de GHCR que root ya tiene. Su alcance y su vencimiento están
NO VERIFICADOS: anotar en el paso C5 cuándo vence.

### C · Sesión de Contabo (en el VPS, como root, en tmux)

| # | Paso | Comprobación |
|---|---|---|
| C1 | Corte cerrado, sin `compose.ensayo.yml` | `ls /srv/dtd-cargo/compose.ensayo.yml` → no existe; `grep ^DTD_WEB_IMAGE= /srv/dtd-cargo/.env` → una sola línea |
| C2a | **Antes de reemplazar el interino.** `/srv/ops/web/publicar-web.sh` hoy es el script interino de la sesión de Contabo (700, sha16 `507df8e0155f59c7`, primera publicación sin Vercel el 2026-10-16 08:20Z). La comparación paso a paso con el texto que Contabo mandó ya está en la spec, § Comparación con el script interino. Lo que queda: confirmar que el archivo del servidor es ese texto, guardarlo (`cp -p /srv/ops/web/publicar-web.sh /srv/ops/evidencias/publicar-web.interino-$(date -u +%Y%m%dT%H%M%SZ).sh`) y revisar si algo lee sus evidencias `publicar-web-<sha8>-<hora>.txt`, porque el nuevo deja carpetas con otro nombre | `sha256sum /srv/ops/web/publicar-web.sh \| cut -c1-16` → `507df8e0155f59c7`; la copia existe; anotar en el handoff de la 0541 «sin diferencias de contrato» o lo que falte |
| C2 | Copiar de `M0` los scripts: `install -m 700 publicar-web.sh huellas-fuera-de-imagen.sh /srv/ops/web/`. `smoke-web.sh` ya está. La interfaz del interino se conserva: `publicar-web.sh <sha>` | `sha256sum /srv/ops/web/{publicar-web,huellas-fuera-de-imagen}.sh` igual a `git show M0:infra/ops/web/<archivo> \| sha256sum` en la máquina de la sesión |
| C3 | Copiar las unidades: `install -m 644 dtd-cargo-publicar.service dtd-cargo-publicar.timer /etc/systemd/system/ && systemctl daemon-reload`. **No** encender todavía | `systemd-analyze verify /etc/systemd/system/dtd-cargo-publicar.service` sin errores; `systemctl is-enabled dtd-cargo-publicar.timer` → `disabled` |
| C4 | `/srv/ops/web/publicar.env` (root, 600) con `PUBLICAR_KUMA_PUSH_URL=` pegado por Sam sin mostrarlo. Opcional: `PUBLICAR_TELEGRAM_CHAT_ID=`. Ninguna línea vacía: si no hay chat, la línea no va. Prueba de avisos, sin riesgo de publicar: `publicar-web.sh congelar "prueba de avisos"`, después `publicar-web.sh vigilar` (congelado, solo le avisa a Kuma) y `publicar-web.sh descongelar` | `stat -c '%a %U' /srv/ops/web/publicar.env` → `600 root`; `publicar-web.sh estado` → «Uptime Kuma: configurado» (y Telegram, si se cargó); el monitor de Kuma pasa a verde con «congelado: prueba de avisos»; si hay chat, llegan los mensajes de congelar y descongelar |
| C5 | El login de GHCR | `docker pull -q ghcr.io/softagentes/dtdcargo:publicable` sale 0. Anotar el vencimiento del token si se puede ver |
| C6 | `publicar-web.sh revisar` | Esperado: «PUERTAS: pasan». Si dice que faltan migraciones: ver C7. Si dice que los compose o el cron difieren: ver C8 |
| C7 | Solo con la decisión B1 de Sam: `publicar-web.sh aceptar-pendiente 0422_payment_report_command_boundary` y `… 0423_payment_report_historical_identity`. **Cualquier otra que falte: parar** y avisar al Director, porque el ledger no tiene algo que `main` espera | `publicar-web.sh revisar` → la lista de faltantes ya no las nombra; `cat /srv/ops/web/estado/aceptadas.log` |
| C8 | Si `revisar` dice que `compose.yml`, `compose.supabase.yml` o `cron/*` difieren: copiar esos archivos de `M0` a `/srv/dtd-cargo/`. Si cambió `cron/`: `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml build cron && … up -d --no-deps cron` | `publicar-web.sh revisar` → «huellas: … iguales al repo» o solo avisos |
| C9 | Primera publicación a mano, con la misma forma del interino: `publicar-web.sh <M0 completo>` | Sale 0 y dice «PUBLICADA»; `sha256sum -c` en la carpeta de evidencia que imprime; `grep ^DTD_WEB_IMAGE= .env` → `…:sha-M0@sha256:…`; la prueba rápida con 0 FALLÓ; Kuma en verde |
| C10 | Simulacro de vuelta atrás: `publicar-web.sh volver` y después `publicar-web.sh publicar <M0>` otra vez | La web vuelve a la imagen anterior y pasa la prueba rápida; después vuelve a `M0`. Medir los segundos sin respuesta con `curl` en un bucle desde otra ventana (es el corte breve de la decisión 5) |
| C11 | Encender: `systemctl enable --now dtd-cargo-publicar.timer` | `systemctl list-timers dtd-cargo-publicar.timer` muestra la próxima vuelta; `journalctl -u dtd-cargo-publicar.service -n 20` → «al día: <M0>» |
| C12 | Registrar en el handoff de la 0541: hora, `M0`, las carpetas de evidencia, la medida del corte breve y el vencimiento del login de GHCR | — |

### D · Primer merge de producto

El Director fusiona como siempre (migrate-first: primero la migración, después el
merge). Comprobaciones:

- Queda registrada la hora del merge, la de «Imagen publicable» y la de la carpeta
  `publicar-web-*` en el VPS. La resta es el tiempo merge → web.
- El aviso de Kuma, o el de Telegram si está, llega.

## Operación

### Congelar (un corte, una ventana de mantenimiento)

```bash
/srv/ops/web/publicar-web.sh congelar "corte de la base, Director"    # servidor (sesión de Contabo)
gh variable set PUBLICABLE_CONGELADO --body si                       # GitHub (Director)
```

Para descongelar, al revés: `publicar-web.sh descongelar`,
`gh variable delete PUBLICABLE_CONGELADO` y `gh workflow run publicable.yml` para
ponerse al día. Mientras está congelado, `volver` funciona igual, y
`publicar <sha>` solo con `--aunque-congelado`.

### Qué hacer con cada aviso

| Aviso | Qué pasó | Qué hacer |
|---|---|---|
| «publicada X» | Todo bien | Nada |
| «NO se publicó X: faltan en la base … migraciones» | El merge llegó antes que su migración | Si es migrate-first: aplicarla (con el OK nominal de Sam y el runbook de producción); la web entra al minuto siguiente. Si va después de la web: con el OK de Sam, `aceptar-pendiente <nombre>` |
| «NO se publicó X: el servidor no tiene la misma copia … compose.yml» (o `cron/…`) | El merge cambió algo que vive fuera de la imagen | Copiar esos archivos de ese commit a `/srv/dtd-cargo` (y reconstruir y reiniciar el cron si cambió `cron/`); la web entra al minuto siguiente |
| «publicada X · OJO, el servidor difiere del repo en: functions/» | La web entró; las funciones del servidor son de otro commit | Sincronizar `functions/` y recrear `functions` cuando corresponda |
| «vuelta atrás: X falló (…)» | La nueva no quedó healthy o falló la prueba rápida dos veces; la web volvió a la anterior y la pasó | Leer la evidencia que nombra el aviso. Arreglar con otro merge, o reintentar a mano `publicar X` si fue algo pasajero |
| «URGENTE … TAMBIÉN la vuelta atrás» | Quedó congelado | Mirar la web ya: `docker ps`, `docker logs` del web y la evidencia. Volver a mano a una imagen conocida con `publicar <sha>` |
| «publicación automática detenida: hay un compose.ensayo.yml…» | El override del ensayo de la web sigue en `/srv/dtd-cargo` | Retirarlo (`corte-paso2.sh cierre` lo guarda en evidencias) o esperar a que termine el ensayo; la web entra al minuto siguiente |
| «NO se publicó X: la imagen anterior (…) no está en el servidor y no se pudo bajar: no habría vuelta atrás» | El valor actual de `DTD_WEB_IMAGE` no tiene imagen local ni en GHCR | Revisar el `.env` (¿alguien escribió un valor a mano?) y el login de GHCR; con una anterior válida, entra al minuto siguiente |
| «no pude bajar …:publicable … ¿login de GHCR?» | El pull falló | `docker login ghcr.io` como root con un token nuevo (que lo cree Sam) |
| «… GB libres …» | Poco disco | `docker system df`; borrar a mano lo que sobre. No usar `docker image prune -a`, que borra imágenes de otros proyectos |
| Kuma caído sin aviso de Telegram | El timer no corre, o el servidor se cayó | `systemctl status dtd-cargo-publicar.timer`; `journalctl -u dtd-cargo-publicar.service -n 50` |

### A mano

```bash
/srv/ops/web/publicar-web.sh estado              # qué corre, la anterior, congelado, rechazadas
/srv/ops/web/publicar-web.sh revisar [<sha>]     # las puertas, sin publicar
/srv/ops/web/publicar-web.sh <sha>               # un commit de main (40 hex), como el interino; queda hasta el próximo merge
/srv/ops/web/publicar-web.sh volver              # la anterior; la de ahora queda rechazada hasta el próximo merge
```

### Compatibilidad de identidad · preparación del 2026-10-20

**Estado: script instalado el 2026-11-01, en el paso V3 de [Dirección de la imagen](#dirección-de-la-imagen--preparación-del-2026-11-01); publicación pendiente.** Lo demás de esta sección es el registro del 2026-10-20.
Sam aclaró un cambio de nombre del perfil, no un traslado de propietario. La API
del 2026-10-20 a las 22:06:28Z identifica `SoftAgentes/DTDCARGO`, repo `1246490707`,
owner `User`/`SoftAgentes`/`285193249`; la referencia antigua sigue resolviendo al
mismo repo. El Director comprobó a las 22:07:19Z que el script del VPS aún exige
el origen antiguo y que servido/publicable siguen en `8e9e0f50…`. Son observaciones
fechadas, no una garantía sobre el estado que tendrá el servidor al instalar.

La continuación de SDD-0541 admite en el script candidato el origen canónico
`https://github.com/SoftAgentes/DTDCARGO` junto al alias histórico exacto
`https://github.com/hailuwaycom-sketch/DTDCARGO`. La comparación conserva igualdad
sin distinguir mayúsculas, con un conjunto cerrado de dos fuentes. No se elimina
el gate ni se resuelven redirecciones para decidir confianza. El build conservará
su origen canónico natural; el paquete sigue en el namespace GHCR existente.
Su acceso efectivo tras el cambio de nombre está **NO VERIFICADO**.

El candidato del commit `b6af34a3c88c835d50a8dc40c95b608da0d1f3f8` pasó 190
comprobaciones del harness local, seis mutantes de identidad y 30 pruebas del
promotor, con dobles y sin registro/VPS/DB real. Eso no certifica el script
instalado ni un nuevo deploy; los hashes y límites están en el handoff enlazado.

Procedimiento para **reemplazar solo el script**, usado por primera vez en el paso V3 del 2026-11-01:

1. GitHub Actions debe haberse recuperado conforme al prompt final de Sam y debe
   existir autorización vigente para esta instalación concreta. El Director
   comprueba esas condiciones y aprueba la revisión, el SHA y la ventana; no puede
   revocar por sí solo la prohibición de Sam. Cualquier excepción exige una
   autorización explícita de Sam. Coordinar una ventana con la
   publicación congelada y sin trabajo operativo activo; documentar ese estado.
   Esta preparación no activa congelación, cambia timers ni reanuda publicaciones.
   La congelación evita que instalar el nuevo validador publique de inmediato una
   imagen que ya estuviera retenida por el origen anterior.
2. Preparar `infra/ops/web/publicar-web.sh` desde el **objeto Git exacto aprobado**,
   conservando sus bytes, y registrar SHA Git, blob y SHA256 en el paquete. Validar
   sintaxis y pruebas locales antes de transferirlo. Cotejar la identidad del
   repositorio y el hash del script actualmente instalado; si no coincide con el
   estado revisado de la ventana, detenerse y revisar la diferencia.
3. En la ventana autorizada, adquirir el mismo lock exclusivo
   `/run/lock/dtd-cargo-publicar.lock` que usa el publicador. Mientras se conserve
   ese lock, respaldar únicamente `/srv/ops/web/publicar-web.sh` en una carpeta de
   evidencia protegida de `/srv/ops/evidencias/`, con fecha UTC, propietario, modo y
   SHA256. No copiar `.env`, credenciales ni estado de negocio.
4. Copiar el candidato a un archivo temporal **en `/srv/ops/web/`**, con propietario
   root y modo `700`. Comprobar su SHA256 contra el paquete aprobado y `bash -n`.
   Sustituir el script mediante renombrado atómico dentro del mismo directorio,
   nunca escribiendo sobre el archivo que otra shell pudiera estar leyendo.
   Verificar nuevamente hash, propietario y modo finales, cerrar el manifiesto de
   evidencia y liberar el lock. Cualquier discrepancia impide avanzar.
5. Registrar por separado «script instalado» e «imagen publicada». Mantener la
   congelación hasta que el Director compruebe identidad/CI/imagen y acceso GHCR
   y autorice continuar. La publicación posterior sigue pasando por sus puertas,
   referencia SHA/digest, imagen previa, salud y smoke 14/0; después corresponde
   la revisión visible del Studio. Este procedimiento no promueve tags ni publica.
6. **Reversión del archivo:** en la misma condición de congelación y lock, verificar
   el SHA256 del respaldo, preparar un temporal root/700 y restaurar atómicamente
   solo el script, comprobando el hash final. Restaurar el script no revierte una
   imagen ni la DB; el validador antiguo volverá a rechazar orígenes canónicos
   nuevos. Si ya cambió la imagen, el Director debe evaluar la recuperación de la
   web por su procedimiento separado antes de reanudar.

La restricción de merge/deploy durante el bloqueo de GitHub permanece vigente.
No se reaplica 0495. Resultados y ownership de esta continuación:
[handoff de identidad](../../.agents/handoffs/0541-publicacion-identidad-softagentes.md).

### Dirección de la imagen · preparación del 2026-11-01

**Estado: integrado en la PR #345 y ventana V1 a V6 ejecutada el 2026-11-01, de 19:17Z a 19:26Z, con el OK de Sam. La publicación sigue detenida y es otro paso.**
El paquete se mudó con el nombre del perfil. Medido por el Director el 2026-11-01
desde el VPS con `docker manifest inspect`: `ghcr.io/softagentes/dtdcargo:publicable`
responde (revisión `8e9e0f505`) y `ghcr.io/hailuwaycom-sketch/dtdcargo` da «manifest
unknown». Workflows, promotor, script, staging, pruebas y runbooks pasan a
`ghcr.io/softagentes/dtdcargo`. Resultados: [handoff](../../.agents/handoffs/0541-imagen-softagentes.md).

| Qué | Cómo queda |
|---|---|
| Dirección de la imagen | Una sola, `ghcr.io/softagentes/dtdcargo`. No hay lista de direcciones aceptadas ni respaldo a la vieja |
| Origen (`org.opencontainers.image.source`) | Sigue aceptando las dos fuentes exactas. El `:publicable` de antes de la ventana (`8e9e0f505`) era una imagen en la dirección nueva con el origen viejo, y pasaba |
| Lo que el servidor ya tiene con el nombre viejo | Sirve de vuelta atrás mientras esté en el disco, porque no hace falta bajarlo. Si no está, el script no publica: «la imagen anterior … no está en el servidor y no se pudo bajar» |
| Limpieza | Solo borra imágenes de la dirección nueva. Las de la vieja se quedan hasta que alguien las borre a mano (unos 520 MB cada una) |
| Huellas | Esta preparación no cambia ninguna: el sha256 de `huellas-fuera-de-imagen.sh repo . --etiqueta` es el mismo antes y después. Por eso `infra/dtd-cargo/compose.yml:47` y `.env.example:36` conservan la dirección vieja como valor por defecto. En producción no se usan, porque el script exige una línea `DTD_WEB_IMAGE` no vacía. Se repuntan en la PR #348, instalada en su ventana |

**Comprobado en V4: `GITHUB_TOKEN` escribe en la dirección nueva.** La corrida
`41341050688` es la primera de `build-image.yml` desde el 2026-10-20, antes del
cambio de nombre, y salió en verde.

**Si se repite una vuelta de congelamiento, no enciendas el timer antes de V5.** Antes
de la ventana, `:publicable` estaba en `8e9e0f505`, un ancestro de lo que corre
(`929cabf51`). El vigilante no compara antigüedad: publica cualquier digest distinto
del que corre. Las puertas tampoco lo frenaban: entre esos dos commits no cambian los
compose ni el cron, y la última migración de `8e9e0f505` es la 0494, ya aplicada. La
web habría retrocedido sola.

La ventana, con `M` = un commit de `main` que ya trae este cambio. Los workflows
corren desde `main`, así que nada de esto sirve antes del merge. Todo necesita el
OK de Sam para esta ventana. Se ejecutó con `M` = `1c2286f1f`; los resultados están
debajo de la tabla, que se conserva por si hay que repetirla.

| # | Quién | Paso | Comprobación |
|---|---|---|---|
| V1 | Sesión de Contabo | Lectura. La imagen que corre y la anterior están en el disco: `docker image inspect -f '{{.Id}}' "$(grep '^DTD_WEB_IMAGE=' /srv/dtd-cargo/.env \| cut -d= -f2-)"`, y lo mismo con el valor de `/srv/ops/web/estado/anterior` | Responde un id igual a `docker inspect -f '{{.Image}}' dtd-cargo-web-1`. Si la que corre no está, parar: nada se puede publicar |
| V2 | Sesión de Contabo | Timer apagado y congelado: `systemctl is-enabled dtd-cargo-publicar.timer`; `test -f /srv/ops/web/CONGELADO`. Es lectura salvo que falte el archivo: entonces, antes de V3, `publicar-web.sh congelar "instalación de la dirección softagentes"`. No lo supongas: `PUBLICABLE_CONGELADO` y los workflows son llaves de GitHub, y este archivo es otra llave, la del servidor | `disabled`, y el archivo existe |
| V3 | Sesión de Contabo | Instalar solo `publicar-web.sh` de `M`, con los pasos 2 a 5 del [procedimiento de solo script](#compatibilidad-de-identidad--preparación-del-2026-10-20): candado, respaldo con hash, temporal root/700 y renombrado atómico. `huellas-fuera-de-imagen.sh` no cambió desde la instalación | `sha256sum /srv/ops/web/publicar-web.sh` igual a `git show M:infra/ops/web/publicar-web.sh \| sha256sum`; `sha256sum` de huellas empieza con `f813a73425fee9ff`; `publicar-web.sh estado` responde |
| V4 | Director | `gh workflow enable build-image.yml -R SoftAgentes/DTDCARGO`, después `gh workflow run build-image.yml -R SoftAgentes/DTDCARGO --ref main` y `gh run watch <id> --exit-status`. Desde aquí cada merge a `main` arma imagen y mueve `:main`, sin tocar la web | Sale 0, y el paso «Etiquetas para el servidor» muestra las tres `org.dtdcargo.*`. En el VPS, `docker manifest inspect ghcr.io/softagentes/dtdcargo:sha-<M>` responde. Si dice `denied`: Sam, en los ajustes del paquete › Manage Actions access, le da rol Write a `DTDCARGO` |
| V5 | Director | `gh workflow enable publicable.yml -R SoftAgentes/DTDCARGO`, `gh variable delete PUBLICABLE_CONGELADO -R SoftAgentes/DTDCARGO`, `gh workflow run publicable.yml -R SoftAgentes/DTDCARGO -f simular=true` y, si el resumen da `M`, otra vez sin `simular`. Con la variable puesta, `simular` solo responde «congelado» y no decide | El resumen dice «`:publicable` → `M`». Desde aquí la etiqueta se mueve sola con cada verde: sin el timer no publica nada |
| V6 | Sesión de Contabo | `publicar-web.sh revisar` | «imagen: …:publicable → commit `M`», sin «no viene de» ni «no pude bajar». Mientras falten 0496 y 0497: «PUERTAS: NO · faltan en la base …», que es lo esperado |

Aquí termina la ventana: el timer sigue apagado y `CONGELADO` sigue puesto. La
publicación es otro paso, después de las migraciones y con su propio OK, y se hace por
commit exacto: `publicar-web.sh publicar <sha> --aunque-congelado`. Encender es un paso
aparte, también con su OK: `publicar-web.sh descongelar` y
`systemctl enable --now dtd-cargo-publicar.timer`. Esos dos solos no fijan qué sale:
entra lo que diga `:publicable` en ese minuto. El procedimiento llega con la PR #348.

**Resultado del 2026-11-01.** Lo informó el Director. Corridas, estado de los
workflows, variable y hashes de Git se cotejaron después con `gh` y `git`. Lo de dentro
del VPS se volvió a medir el 2026-11-02 a las 00:14Z, solo lectura y sin abrir el
`.env`: digest de `:publicable`, imágenes en disco, hora de `CONGELADO`, timer, script,
huellas y salud de la web coinciden. `revisar` no se repitió.

| # | Resultado |
|---|---|
| V1 | La imagen que corre está en el disco y su id coincide con el del contenedor. La anterior también está |
| V2 | Timer `disabled`. `CONGELADO` no existía: el estado de este runbook decía «congelado» sin distinguir esta llave de las de GitHub. Se puso con `congelar` a las 19:17:36Z |
| V3 | Instalado sha16 `f71d27594e568f2b` (blob `397dbc7b565eb8be004d0e215b37971fdb2d6c40`, de `M`), con candado, respaldo y renombrado. El anterior era `663f9e7e946caec9`, igual al de `1bb7ab9fa`. Huellas `f813a73425fee9ff`. Evidencia: `/srv/ops/evidencias/instalar-publicar-web-softagentes-20261101T191736Z` |
| V4 | Corrida `41341050688` en verde, con las tres etiquetas. `docker manifest inspect ghcr.io/softagentes/dtdcargo:sha-<M>` responde en el VPS |
| V5 | La simulación `41341563619` dio `M`, por «Calidad continua» en verde en `main` (`41334833317`). La corrida `41341633174` movió `:publicable` a `1c2286f1f`, digest `sha256:b2d48a17…` |
| V6 | `revisar`: «imagen → commit M» y «PUERTAS: NO · faltan en la base 2 de 258 migraciones», lo esperado |
| Al cerrar | `CONGELADO` puesto, timer `disabled` e `inactive`, web en `929cabf51` y `healthy` |

**Antes de publicar.**

- `:publicable` ya no es fija: se mueve con cada merge a `main` en verde. Lo que entra
  al encender el timer es esa punta, no `1c2286f1f`. Para salir con un commit elegido
  se publica por sha, con el timer apagado, corriendo `publicar-web.sh revisar "<sha>"`
  justo antes.
- Las puertas lo frenan mientras falten migraciones. Ni publicar ni encender el timer
  autoriza aplicarlas; tienen su propio OK.
- `revisar` responde con la primera puerta cerrada, en este orden: migraciones, huellas
  y sharp. «Faltan en la base…» no dice nada de las otras dos, y hoy tapa una:
  `compose.supabase.yml` difiere del repo en la imagen de `storage`, un parche local de
  Node 24.22.1 editado en el servidor el 2026-10-25. Medido el 2026-11-02 con
  `huellas-fuera-de-imagen.sh servidor /srv/dtd-cargo`. **Bloquea publicar** en cuanto se
  apliquen la 0496 y la 0497, y copiar el archivo del repo quitaría el parche en el
  próximo `up` de `storage`. Lo resuelve la PR #348, con la variable `DTD_STORAGE_IMAGE`
  y una línea en el `.env` durante la ventana. Hasta instalarla, no copiar ese archivo.
- `M` no retrocede lo que corre, aunque `git merge-base --is-ancestor 929cabf51 M` diga
  que no es ancestro. `929cabf51` tiene un solo commit fuera de `M`, y ya está por
  contenido: `git cherry M 929cabf51` da `-`, y sus cinco archivos son iguales en `M`.

**Marcha atrás.** Script: el paso 6 del procedimiento de solo script (el validador
y la dirección viejos vuelven a dar «manifest unknown»). Workflows:
`gh variable set PUBLICABLE_CONGELADO --body si -R SoftAgentes/DTDCARGO`, y
`gh workflow disable` de los dos. Las imágenes y las etiquetas no se borran.

**Staging.** Los scripts de `/srv/ops/staging/` también cambian de dirección. Se
copian de `M` la próxima vez que se usen; no bloquean la publicación. Desde ahí no
aceptan una imagen de la dirección vieja, así que hay que armar una con
`build-image-prueba.yml`.

Las imágenes construidas antes de la SDD-0541 no traen las etiquetas, así que el
script no las publica: ni solo ni a mano. A una de ellas solo se vuelve con
`volver`, si es la anterior (por ejemplo, `sha-8761618d…` después de la primera
publicación del paso C9), o editando el `.env` a mano como antes.

### Apagar

`systemctl disable --now dtd-cargo-publicar.timer`. El `.env` queda con lo último
publicado y la web sigue igual. Se vuelve a publicar a mano como antes.

## Estado para el Studio (SDD-0547)

`publicar-web.sh` deja `publicaciones.json` en `/srv/dtd-cargo/estado-publicacion/`.
El servicio `web` monta esa carpeta en `/var/lib/dtd-cargo/publicacion`, en solo
lectura (`infra/dtd-cargo/compose.yml`). El contrato es el de la spec 0547, §4.

| Qué | Cómo |
|---|---|
| Valores | Solo SHA de 40 hex, horas UTC, códigos de la lista de §4.4 y nombres de migración. El texto de cada negativa (rutas, errores de docker o de `psql`) sigue yendo al journal, a la evidencia y a los avisos: nunca al archivo. Cada `MOTIVO=` del script lleva su `CODIGO=` |
| Escritura | Temporal en la misma carpeta, `chmod 644` y `mv -f`. Carpeta `755`. El web corre como `node` y solo lee. Si la escritura falla, el script lo dice en el journal y la publicación sigue igual: nunca cambia el código de salida |
| Historial | `/srv/ops/web/estado/historial.jsonl`, con las 200 líneas más nuevas; el archivo lleva las 20 más nuevas. `retenida` se anota una vez por motivo, con la misma clave del aviso de Telegram |
| Vigilante | El de la última vuelta, guardado en `estado/vigilante.json`. `publicar`, `volver`, `congelar` y `descongelar` lo reusan; con `CONGELADO` dice `congelado`, y al descongelar queda en `null` hasta la vuelta siguiente |
| Congelado | `desde` es la hora del archivo `CONGELADO`. `automatico` es `true` solo si lo congeló el script al fallar una vuelta atrás (`estado/congelado-automatico`, no más viejo que `CONGELADO`) |
| Prueba | Su compose monta su propia `./estado-publicacion`, vacía: la card de prueba dice «Sin datos» y nunca muestra el estado de producción |

### Instalación (K5): en la misma ventana del merge

`compose.yml` es huella **bloqueante**. Si el merge de la PR del escritor llega a
`:publicable` sin que el servidor tenga su `compose.yml`, esa publicación queda
retenida con motivo `huellas`. `.env.example` también es huella, pero solo avisa.
Llamemos `M` al commit de merge. Antes de que `:publicable` llegue a `M` (unos 5 min):

| # | Paso (root, en el VPS) | Comprobación |
|---|---|---|
| K5.1 | Guardar lo que hay: `cp -p /srv/ops/web/publicar-web.sh /srv/ops/evidencias/publicacion-automatica/publicar-web.sh.antes-0547-$(sha256sum /srv/ops/web/publicar-web.sh \| cut -c1-16)`, y lo mismo con `/srv/dtd-cargo/compose.yml` y `.env.example` | Las copias existen |
| K5.2 | Copiar de `M`: `install -m 700 publicar-web.sh /srv/ops/web/` y `install -m 644 compose.yml .env.example /srv/dtd-cargo/` | `sha256sum` de los tres igual a `git show M:<ruta> \| sha256sum` |
| K5.3 | `publicar-web.sh revisar` | Con `:publicable` todavía en el commit anterior, «PUERTAS: NO · … compose.yml» es lo esperado: el servidor ya tiene el de `M`. Con `:publicable` en `M`: «PUERTAS: pasan» |
| K5.4 | Esperar la vuelta que publica `M`. Recrea el web con el montaje | `journalctl -u dtd-cargo-publicar.service -n 20` → «PUBLICADA <M>» |
| K5.5 | El archivo | `ls -l /srv/dtd-cargo/estado-publicacion/` → `-rw-r--r-- root … publicaciones.json`; `docker exec dtd-cargo-web-1 node -e 'JSON.parse(require("fs").readFileSync("/var/lib/dtd-cargo/publicacion/publicaciones.json","utf8"))' && echo ok` → `ok` |
| K5.6 | La pantalla | `/studio/debug` › Estado › «Publicaciones del servidor»: «Al día» y el commit `M` |

Si el script nuevo falla en algo: restaurar la copia de K5.1 (`install -m 700`) y
avisar al Director. La web no depende del archivo: sin él, la card dice «Sin datos».

## Pruebas

- `bash infra/ops/tests/prueba-publicar-web.sh`: dobles de `docker`, `curl` y la
  prueba rápida, en Linux (en Windows, dentro de un contenedor; ver la cabecera del
  script). Con `--mutantes` corre el control rojo y los mutantes. Las secciones
  «estado para el Studio» prueban el archivo de la SDD-0547: formas, permisos, `mv`,
  un evento por motivo, topes y fallas. Si `lib/studio/publicaciones-types.ts` está
  en el árbol, también lo pasan por el parser del Studio; si no, lo marcan NO
  VERIFICADO. Desde la SDD-0550 la corre el CI «Calidad continua» en cada PR, con
  `infra/ops/tests/pruebas-linux.sh` (paso «Pruebas bash de operaciones»).
- `pnpm vitest run infra/ops/tests/publicable.test.mjs`: la decisión de GitHub.
  Entra también en `pnpm test`.

## Registro de instalación · 2026-10-16 (sesión de Contabo)

Autorización de Sam, dada en la sesión Director y registrada a su nombre: «autorizo encender la publicación automática de la web en el servidor propio». Decisiones: «1 sí, 2 sí, 3 solo avisa, 5 sí». La 4, el chat de Telegram, quedó sin respuesta, así que los avisos van solo por Uptime Kuma. `M0` = `03e0e078ef18b0c2c1a217a07c8d4e0eeb14d1c7` (merge de la #250). Evidencias en `/srv/ops/evidencias/publicacion-automatica/` y en las carpetas `publicar-web-*`.

| Paso | Hora (UTC) | Resultado |
|---|---|---|
| C1 | 13:36 | PASÓ: sin `compose.ensayo.yml`, con una sola línea `DTD_WEB_IMAGE` |
| C2a | 16-10, mañana | PASÓ: el interino es `507df8e0155f59c7`; copia en `publicacion-automatica/publicar-web.sh.interino-507df8e0155f59c7`. Nada leía sus evidencias `.txt` |
| C2 | 13:36 | PASÓ: `publicar-web.sh` `4b7fed5b28bfb5d0` y `huellas-fuera-de-imagen.sh` `f813a73425fee9ff`, iguales a `git show M0:…` |
| C3 | 13:36 | PASÓ: unidades instaladas, `systemd-analyze verify` sin errores, timer `disabled` |
| C5 | 13:36 | PASÓ: el pull de `:publicable` responde con la revision `03e0e078…`. El vencimiento del token de GHCR **NO VERIFICADO**: `/root/.docker/config.json` no lo muestra |
| C6-C7 | 13:37 | Al principio faltaban la 0422 y la 0423, como se esperaba. Se aceptaron con `aceptar-pendiente` según la decisión 2, y quedó «PUERTAS: pasan». Las huellas diferían en `.env.example` y en `functions/`: de los 22 archivos de runtime ninguno cambiaba y solo faltaba `_shared/__tests__/kommo-reapertura.test.ts`. Se copiaron de `M0` y quedó «iguales al repo» |
| C9 | 13:38 | PASÓ: `publicar-web.sh 03e0e078…`, healthy a los 6 s, prueba rápida 14/0 y `DTD_WEB_IMAGE` fijado por digest |
| C10 | 13:39 | PASÓ: `volver` llevó a `8761618d` (healthy a los 15 s, 14/0) y `publicar` devolvió a `03e0e078` (6 s, 14/0). **Corte medido:** 37 de 91 muestras sin 200, una cada 0,5 s, unos 18 s en total entre los dos cambios (502 y luego 404 de Traefik). Está dentro de lo que se aceptó en la decisión 5 |
| C4 | 14:22-14:23 | Sam pegó la URL del monitor Push en una ventana tmux sin eco. `publicar.env` quedó en 600 root, 1 línea y sin vacías. Kuma respondió `ok: true`. La secuencia congelar → vigilar → descongelar salió bien |
| C11 | 14:23:41 | Timer encendido. Primera vuelta: «al día: 03e0e078» |
| D | 14:23:38 → 14:28:58 | **Primer merge de producto (#249, `abb41625`) publicado solo**: imagen 14:23:41 → 14:27:22, `:publicable` 14:27:24 → 14:27:42, VPS 14:28:39 → «PUBLICADA» a las 14:28:58, healthy en 6 s, prueba rápida 14/0. **Del merge a la web: 5 min 20 s** |

Detalles que no bloquean, pasados al Director para el Worker de la 0541:
- `estado`, antes de la primera aceptación, imprime «No such file or directory» al no encontrar `estado/pendientes-aceptadas`.
- «última evidencia» elige por nombre: muestra el `.txt` del interino (`publicar-web-8761618d-…`) en lugar de la carpeta más nueva.

