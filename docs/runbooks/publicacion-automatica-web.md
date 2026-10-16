# Runbook · Publicación automática de la web en el servidor propio · SDD-0541

**SDD:** [0541](../specs/0541-publicacion-automatica-vps/spec.md) · depende de la
[0505](../specs/0505-dockerizar-dtd-cargo-contabo/spec.md)
**Estado:** NO INSTALADO. El repo tiene las piezas; el servidor, nada.
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
| `/srv/ops/web/publicar-web.sh` | VPS | Si `:publicable` no es lo que corre, pasa las puertas, cambia solo `DTD_WEB_IMAGE`, `up -d --no-deps web`, healthy, prueba rápida y, si falla, vuelve atrás. |
| `/srv/ops/web/huellas-fuera-de-imagen.sh` | GitHub y VPS | Las mismas huellas de los dos lados. |

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
| C2 | Copiar de `M0` los scripts: `install -m 700 publicar-web.sh huellas-fuera-de-imagen.sh /srv/ops/web/`. `smoke-web.sh` ya está | `sha256sum /srv/ops/web/{publicar-web,huellas-fuera-de-imagen}.sh` igual a `git show M0:infra/ops/web/<archivo> \| sha256sum` en la máquina de la sesión |
| C3 | Copiar las unidades: `install -m 644 dtd-cargo-publicar.service dtd-cargo-publicar.timer /etc/systemd/system/ && systemctl daemon-reload`. **No** encender todavía | `systemd-analyze verify /etc/systemd/system/dtd-cargo-publicar.service` sin errores; `systemctl is-enabled dtd-cargo-publicar.timer` → `disabled` |
| C4 | `/srv/ops/web/publicar.env` (root, 600) con `PUBLICAR_KUMA_PUSH_URL=` pegado por Sam sin mostrarlo. Opcional: `PUBLICAR_TELEGRAM_CHAT_ID=`. Ninguna línea vacía: si no hay chat, la línea no va. Mensaje de prueba: `publicar-web.sh congelar "prueba de avisos"` y `publicar-web.sh descongelar` | `stat -c '%a %U' /srv/ops/web/publicar.env` → `600 root`; `publicar-web.sh estado` → «Uptime Kuma: configurado» (y Telegram, si se cargó); llegan los dos mensajes |
| C5 | El login de GHCR | `docker pull -q ghcr.io/hailuwaycom-sketch/dtdcargo:publicable` sale 0. Anotar el vencimiento del token si se puede ver |
| C6 | `publicar-web.sh revisar` | Esperado: «PUERTAS: pasan». Si dice que faltan migraciones: ver C7. Si dice que los compose o el cron difieren: ver C8 |
| C7 | Solo con la decisión B1 de Sam: `publicar-web.sh aceptar-pendiente 0422_payment_report_command_boundary` y `… 0423_payment_report_historical_identity`. **Cualquier otra que falte: parar** y avisar al Director, porque el ledger no tiene algo que `main` espera | `publicar-web.sh revisar` → la lista de faltantes ya no las nombra; `cat /srv/ops/web/estado/aceptadas.log` |
| C8 | Si `revisar` dice que `compose.yml`, `compose.supabase.yml` o `cron/*` difieren: copiar esos archivos de `M0` a `/srv/dtd-cargo/`. Si cambió `cron/`: `docker compose -p dtd-cargo -f compose.yml -f compose.supabase.yml build cron && … up -d --no-deps cron` | `publicar-web.sh revisar` → «huellas: … iguales al repo» o solo avisos |
| C9 | Primera publicación a mano: `publicar-web.sh publicar <M0 completo>` | Sale 0 y dice «PUBLICADA»; `sha256sum -c` en la carpeta de evidencia que imprime; `grep ^DTD_WEB_IMAGE= .env` → `…:sha-M0@sha256:…`; la prueba rápida con 0 FALLÓ; Kuma en verde |
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
| «no pude bajar …:publicable … ¿login de GHCR?» | El pull falló | `docker login ghcr.io` como root con un token nuevo (que lo cree Sam) |
| «… GB libres …» | Poco disco | `docker system df`; borrar a mano lo que sobre. No usar `docker image prune -a`, que borra imágenes de otros proyectos |
| Kuma caído sin aviso de Telegram | El timer no corre, o el servidor se cayó | `systemctl status dtd-cargo-publicar.timer`; `journalctl -u dtd-cargo-publicar.service -n 50` |

### A mano

```bash
/srv/ops/web/publicar-web.sh estado              # qué corre, la anterior, congelado, rechazadas
/srv/ops/web/publicar-web.sh revisar [<sha>]     # las puertas, sin publicar
/srv/ops/web/publicar-web.sh publicar <sha>      # un commit de main (40 hex); queda hasta el próximo merge
/srv/ops/web/publicar-web.sh volver              # la anterior; la de ahora queda rechazada hasta el próximo merge
```

### Apagar

`systemctl disable --now dtd-cargo-publicar.timer`. El `.env` queda con lo último
publicado y la web sigue igual. Se vuelve a publicar a mano como antes.

## Pruebas

- `bash infra/ops/tests/prueba-publicar-web.sh`: dobles de `docker`, `curl` y la
  prueba rápida, en Linux (en Windows, dentro de un contenedor; ver la cabecera del
  script). Con `--mutantes` corre el control rojo y los mutantes.
- `pnpm vitest run infra/ops/tests/publicable.test.mjs`: la decisión de GitHub.
  Entra también en `pnpm test`.
