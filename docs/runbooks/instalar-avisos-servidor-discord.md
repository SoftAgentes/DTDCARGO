# Runbook · Instalar los avisos del servidor a Discord en producción · SDD-0609

**SDD:** [0609](../specs/0609-avisos-servidor-a-discord/spec.md). El corte en sí (qué
avisa, dónde, qué significa cada salida) está en
[avisos-servidor-discord.md](avisos-servidor-discord.md). Este runbook es el **guion
de la ventana**: el orden de los pasos en el VPS de producción `217.216.54.70`, el
respaldo, la prueba con un aviso real en `#publicaciones` y la vuelta atrás. Al
principio tiene la lista de lo que Sam crea o pega.

**Estado al escribirlo (2026-11-07, `main` `7e75f7708`):** el código de la 0609 está
en `main` por la [#381](https://github.com/SoftAgentes/DTDCARGO/pull/381), **sin
instalar**. El guion para pegar la llave es la
[#404](https://github.com/SoftAgentes/DTDCARGO/pull/404), en borrador. **Esta ventana
no se abre antes de que la #404 esté fusionada.**

**Autorizaciones que pide la ventana:** el turno y el OK del Director General para
instalar estos tres scripts desde un commit `M` concreto, y que Sam esté presente para
pegar la llave. No cubre descongelar, encender el timer, publicar una imagen ni la
[#403](https://github.com/SoftAgentes/DTDCARGO/pull/403): cada una lleva su OK.

## 1 · Lista única para Sam

### A · Servidor (esta instalación)

| # | Canal | Webhook | Estado | Qué hace Sam |
|---|---|---|---|---|
| A1 | `#publicaciones` (`1567955265918079096`) | `Servidor · publicaciones` | Creado, **sin pegar** | Lo pega con el comando de abajo, en el paso S de la ventana (§ 3) |
| A2 | `#salud` (`1567955345219780698`) | `Uptime Kuma` | Kuma ya avisa en `#salud`, según la sesión coordinadora; no lo medí | Nada que pegar por PowerShell: esa dirección vive en la interfaz de Kuma. Falta el repaso de los monitores (C2) |

**Cómo pega Sam la de `#publicaciones`**, solo cuando la sesión de Contabo le diga
«listo para pegar»: el guion `guardar-webhook-discord.sh` tiene que estar instalado.

1. En PowerShell de su PC, pega este comando **sin pulsar Enter**:

   ```powershell
   Get-Clipboard | C:\Windows\System32\OpenSSH\ssh.exe -o BatchMode=yes root@217.216.54.70 /srv/ops/web/guardar-webhook-discord.sh
   ```

2. En Discord: `#publicaciones` → Editar canal → Integraciones → Webhooks →
   `Servidor · publicaciones` → **Copiar URL del webhook**. Desde este momento el
   portapapeles tiene la dirección, no el comando.
3. Vuelve a PowerShell y pulsa **Enter**.

La dirección va del portapapeles a la entrada estándar del guion. No pasa por ningún
chat, por el historial de PowerShell ni por una ventana `ssh -t`. Sam lee una sola
línea: `GUARDADA · … caracteres · sha256 … · canal #publicaciones · …` o
`NO GUARDADA: <motivo>`. Con `NO GUARDADA` no cambió nada; la tabla de motivos está en
[avisos-servidor-discord.md § 2](avisos-servidor-discord.md). La sesión de Contabo solo
recibe esa línea, nunca la dirección.

### B · Studio (no es de esta instalación; va aquí para pedírselo a Sam de una vez)

Los avisos del Studio ([SDD-0606](../specs/0606-avisos-studio-a-discord/spec.md), #380)
leen cinco webhooks y `DISCORD_TENANT_ID` del `.env` de la app
(`lib/studio/discord/channels.ts`). Según el handoff de la 0606 (informado el
2026-11-05, sin medir aquí), los cinco canales de Operación existen y los webhooks no.

| # | Canal | Variable en `/srv/dtd-cargo/.env` | Nombre del webhook |
|---|---|---|---|
| B1 | `#registro-clientes` | `DISCORD_WEBHOOK_REGISTRO` | la spec no lo fija; sugerencia: `Studio · registro` |
| B2 | `#conversaciones-portal` | `DISCORD_WEBHOOK_CONVERSACIONES` | sugerencia: `Studio · conversaciones` |
| B3 | `#bugs` | `DISCORD_WEBHOOK_BUGS` | sugerencia: `Studio · bugs` |
| B4 | `#reporte-diario` | `DISCORD_WEBHOOK_REPORTES` | sugerencia: `Studio · reporte diario` |
| B5 | `#avisos-equipo` | `DISCORD_WEBHOOK_EQUIPO` | sugerencia: `Studio · avisos equipo` |

- **Crearlos ya no hace daño:** un webhook que nadie usa no escribe nada.
- **Pegarlos todavía no tiene comando probado por portapapeles.**
  - `infra/ops/migrate/env-set.sh --name` lee de la entrada estándar cuando no hay terminal.
  - Pero no comprueba que lo pegado sea un webhook ni de qué canal es.
  - Después hay que recrear la web, y eso es una operación de producción aparte.
  - Antes de pedirle a Sam que los pegue hace falta un guion como el de la #404 para el `.env` de la app (ver § 6).
- **Antes de confirmarle a Sam que faltan,** contar sin leer valores:
  `grep -cE '^DISCORD_(WEBHOOK_[A-Z]+|TENANT_ID)=' /srv/dtd-cargo/.env`.

### C · Qué le toca a Sam después de la ventana

1. **Confirmar que ve el aviso de prueba en `#publicaciones`** (paso P): «DTD Cargo ·
   prueba de avisos del servidor desde …», sin menciones ni vista previa.
2. **Repasar Kuma** ([uptime-kuma/README.md](../../infra/ops/uptime-kuma/README.md),
   pasos 3 y 4): en cada monitor, solo `Discord #salud` marcada y Telegram desmarcada.
   Kuma no tiene API que lo mida desde el repo.
3. **Decidir a qué canal van los avisos de correo** (§ 5): `#salud`, como dice el plan
   de la oficina, o `#avisos-equipo`, como quedó en el código.
4. **Los OK aparte, cuando el Director General los pida:**
   - descongelar o publicar: con eso llega el primer aviso de una publicación real;
   - instalar la #403, el relevo sin corte.

## 2 · Paquete en la PC (sesión de Contabo, antes de la ventana)

En Git Bash, desde un worktree con `origin` al día. `MSYS_NO_PATHCONV=1` evita que Git
Bash convierta `M:infra/...` en una ruta de Windows.

```bash
export MSYS_NO_PATHCONV=1
git fetch origin && M=$(git rev-parse origin/main) && echo "M=$M"
git cat-file -e "$M:infra/ops/web/guardar-webhook-discord.sh" && echo "la #404 está en M" || echo "FALTA la #404 en M: no sigas"
git log --oneline ea8ca60d7.."$M" -- infra/ops/web/publicar-web.sh
```

- **Qué tiene que salir del `git log`:** el script instalado hoy es el de `ea8ca60d7` (paso V3 del 2026-11-01, sha256 `f71d27594e568f2b…`). Lo esperado es una sola línea: `f69d520b4 feat(ops): SDD-0609 — publicar-web.sh avisa por Discord…`.
- **Si sale algún commit de la #403** (`relevo sin corte`), el `publicar-web.sh` de `M` trae también el relevo:
  - el relevo cambia cómo se publica, porque deja dos web al mismo tiempo;
  - lleva su propio OK y un `free -m` antes;
  - sin ese OK, se para aquí y se lleva al Director General.

```bash
P="$HOME/paquete-0609-${M:0:12}"; mkdir -p "$P"
for f in guardar-webhook-discord.sh aviso-discord.sh publicar-web.sh; do git cat-file blob "$M:infra/ops/web/$f" > "$P/$f"; done
(cd "$P" && sha256sum *.sh | tee SHA256SUMS && for f in *.sh; do bash -n "$f" && echo "sintaxis OK $f"; done)
"/c/Windows/System32/OpenSSH/scp.exe" -o BatchMode=yes -r "$(cygpath -w "$P")" root@217.216.54.70:/root/
```

`git cat-file blob` copia los bytes del commit, con LF. Para cotejar, en `main`
`7e75f7708` (antes de la #404) los sha256 eran: `aviso-discord.sh` `70639acad24ef26b…`
y `publicar-web.sh` `1863b76e71e9f8f8…`. El de `guardar-webhook-discord.sh` se mide
sobre `M`: en la cabeza de la #404 (`b93a80491`) es `e0ca796f4bcd8362…`.

## 3 · Ventana en el VPS (sesión de Contabo, como root)

Cada bloque se pega por separado y se lee su salida antes del siguiente. Si un
`flock` dice `OCUPADO` o una comprobación no da lo esperado, no se pega el bloque
que sigue.

### L · Lectura antes de tocar nada

```bash
hostname; cd /srv/ops/web
sha256sum publicar-web.sh                                  # esperado f71d27594e568f2b…
ls -l aviso-discord.sh guardar-webhook-discord.sh 2>&1     # esperado: no existen
stat -c '%a %U %n' publicar.env; grep -oE '^[A-Z_]+=' publicar.env   # solo NOMBRES de variables, nunca valores
test -f CONGELADO && echo "CONGELADO: $(head -1 CONGELADO)" || echo "congelado: no"
systemctl is-enabled dtd-cargo-publicar.timer; systemctl is-active dtd-cargo-publicar.timer
./publicar-web.sh estado
```

Se copian las salidas al handoff. **Si el sha256 de `publicar-web.sh` no es
`f71d27594e568f2b…`, para:** alguien instaló otro script después del 2026-11-01 y hay
que ver la diferencia antes de seguir. `CONGELADO` y el timer se anotan para
compararlos al final; esta ventana no los cambia.

### I1 · Candado, respaldo y los dos scripts nuevos

```bash
exec 9>/run/lock/dtd-cargo-publicar.lock; flock -n 9 && echo "candado tomado" || echo "OCUPADO: no sigas"
M=<los 40 hex de M>; P=/root/paquete-0609-${M:0:12}
E=/srv/ops/evidencias/instalar-avisos-discord-$(date -u +%Y%m%dT%H%M%SZ); install -d -m 700 "$E"
(cd "$P" && sha256sum -c SHA256SUMS) | tee "$E/paquete.txt"
cd /srv/ops/web
{ date -u +%FT%TZ; echo "M=$M"; stat -c '%n %a %U:%G %s' publicar-web.sh publicar.env; sha256sum publicar-web.sh; } > "$E/antes.txt"
cp -p publicar-web.sh "$E/publicar-web.sh.antes"; sha256sum "$E/publicar-web.sh.antes" >> "$E/antes.txt"
instalar() { local t; t="$(mktemp /srv/ops/web/.instalar-0609.XXXXXX)" || return 1
  if install -m 700 -o root -g root "$P/$1" "$t" && cmp -s "$P/$1" "$t" && bash -n "$t" && mv -f "$t" "/srv/ops/web/$1"; then
    { stat -c '%n %a %U:%G' "/srv/ops/web/$1"; sha256sum "/srv/ops/web/$1"; } | tee -a "$E/despues.txt"
  else rm -f "$t"; echo "NO INSTALADO: $1 · para y revisa"; return 1; fi; }
instalar guardar-webhook-discord.sh && instalar aviso-discord.sh
```

- Los dos son nuevos y nadie los llama todavía.
- El respaldo es solo `publicar-web.sh`: se guarda en la evidencia con hora UTC, modo y sha256.
- **`publicar.env` no se copia a la evidencia:** lleva llaves. Su respaldo lo hace el guion en el paso S, como `publicar.env.antes-0609-<UTC>`, en 600 y en la misma carpeta.

### S · Sam pega la llave

La sesión de Contabo le dice a Sam «listo para pegar», y Sam sigue § 1, A1. Con
`GUARDADA`, comprueba sin ver la llave:

```bash
stat -c '%a %U' publicar.env; grep -c '^PUBLICAR_DISCORD_WEBHOOK=' publicar.env; grep -c '^PUBLICAR_TELEGRAM_' publicar.env   # 600 root · 1 · 0
ls -1 publicar.env.antes-0609-*
/srv/ops/web/aviso-discord.sh --estado                     # → «Discord: configurado» (no envía)
```

**Pierde algo el script viejo:** el guion quita las líneas `PUBLICAR_TELEGRAM_*`, y el
`publicar-web.sh` todavía instalado avisaba por Telegram. Pero el 2026-11-01 su
`estado` ya decía `Telegram: SIN CONFIGURAR`: el script viejo no tenía a dónde avisar.
Lo que mostró el `estado` del paso L lo confirma para hoy.

El candado sigue tomado mientras Sam pega. Si se demora más de ~15 minutos, se suelta
(`exec 9>&-`) y se vuelve a tomar antes de I2.

### I2 · `publicar-web.sh`

```bash
instalar publicar-web.sh && exec 9>&-
./publicar-web.sh estado | tee "$E/estado-despues.txt"     # → «Discord:     configurado»
```

**Después de este paso, el `sha256sum` de los tres scripts tiene que ser igual al de
`SHA256SUMS` del paquete.** Si no, vuelta atrás (§ 4).

### P · Prueba con un aviso real en `#publicaciones`

```bash
/srv/ops/web/aviso-discord.sh --probar 2>&1 | tee "$E/probar.txt"   # → «aviso por Discord: entregado (HTTP 200)»
grep -c webhooks "$E"/*.txt                                          # 0 en cada archivo
```

- **Sam confirma que lo ve en `#publicaciones`.** Ese es el criterio de la ida y vuelta.
- **No se usan `congelar` ni `descongelar` para probar** (D7 de la spec): reescriben o borran el interruptor.

### Cierre

```bash
test -f CONGELADO && echo "CONGELADO: $(head -1 CONGELADO)" || echo "congelado: no"
systemctl is-enabled dtd-cargo-publicar.timer; systemctl is-active dtd-cargo-publicar.timer
(cd "$E" && sha256sum * > MANIFIESTO)
```

- **Comparar con el paso L:** el interruptor y el timer tienen que estar igual.
- **En el handoff se registran por separado:**
  - «scripts instalados», con `M`, los sha256 y la ruta de `$E`;
  - «aviso de prueba entregado y visto por Sam», con la hora UTC.
- **«Publicación» queda aparte:** no hubo ninguna.
- **El paquete de `/root/` puede quedarse:** son copias de archivos del repo, sin llaves.

## 4 · Vuelta atrás

1. **`publicar-web.sh`:** con el mismo candado y la misma función `instalar`, usa
   `P="$E"` y copia `$E/publicar-web.sh.antes` a `$E/publicar-web.sh` antes de llamar
   `instalar publicar-web.sh`. Comprueba que el sha256 final vuelva a ser
   `f71d27594e568f2b…`.
2. **`publicar.env`** (si hace falta quitar la llave): `cp -p publicar.env.antes-0609-<UTC>
   .publicar.env.vuelta && chmod 600 .publicar.env.vuelta && mv -f .publicar.env.vuelta
   publicar.env`.
   - El script viejo no lee `PUBLICAR_DISCORD_WEBHOOK`, así que dejarla no cambia nada.
   - **La vuelta atrás no devuelve avisos de publicación:** el script viejo no tenía Telegram configurado, y la SDD-0606 retira `TELEGRAM_BOT_TOKEN`. Queda solo Kuma en `#salud`.
3. **`aviso-discord.sh` y `guardar-webhook-discord.sh` pueden quedarse:** sin el `publicar-web.sh` nuevo, nadie los llama.
4. **Si la dirección se filtró:** en Discord, borrar el webhook `Servidor · publicaciones` (deja de funcionar al instante), crear otro y repetir el paso S.
5. **Kuma:** [uptime-kuma/README.md § Vuelta atrás](../../infra/ops/uptime-kuma/README.md#vuelta-atrás).

## 5 · `#salud` y los avisos de correo

- **Kuma → `#salud`:** según la sesión coordinadora, ya avisa ahí (no lo medí). Falta C2: confirmar que ningún monitor sigue con Telegram.
  - [chatwoot-vigilancia.md](chatwoot-vigilancia.md) todavía dice «Telegram» en la columna Aviso de sus cuatro monitores.
  - Es documentación del Subdirector de Chatwoot. Esta PR no la toca.
- **Avisos de correo:** el [plan de la oficina](../organizacion/plan-maestro-oficina.md) pone en `#salud` la «herramienta de vigilancia y avisos de correo». En el código no es así:
  - Los avisos de correo son dos crons del Studio:
    - `mail-health`, cada 30 min: correos que no salieron o rebotaron;
    - `alta-health`, cada día: clientes con Shipping Mark y sin acceso al portal.
    - Los dos están en `infra/dtd-cargo/cron/crontab`.
  - Los dos mandan a la categoría `equipo`, o sea a `#avisos-equipo` (`lib/studio/mail/mail-health-notify.ts:85-99`, `app/api/cron/alta-health/route.ts:86-98`). **No van a `#salud`.**
  - El Studio no tiene categoría ni variable para `#salud`. Sus cinco categorías están en `lib/studio/discord/channels.ts:37-45`.
  - Hoy esos avisos no llegan a ningún Discord:
    - para llegar hacen falta `DISCORD_WEBHOOK_EQUIPO` y `DISCORD_TENANT_ID` en el servidor (B5);
    - y que la web publicada corra el código de la #380, fusionada el 2026-11-07 07:47Z. Si ya corre, no lo medí.
  - El Studio ya no manda a Telegram (SDD-0606, D8). Mientras tanto, `mail-health` avisa solo por correo, que es justo lo que vigila. Su propio comentario dice que el canal que importa es el que no depende del correo (`lib/studio/mail/mail-health-notify.ts:8-10`).
  - La [SDD-0610](../specs/0610-resumen-crm-marketing/spec.md) § 6.1 dice que sus fallos avisan en `#salud` por la cola de la 0606. La cola solo acepta `registro`, `bugs` y `reportes` (`lib/studio/alerts/alert-outbox.ts:36-40`).
- **Qué falta, en orden:**
  1. Que Sam decida el canal (C3).
  2. Si es `#salud`: una SDD del Studio con una sexta categoría, su variable y un webhook más en `#salud`, o el cambio del plan para que diga `#avisos-equipo`.
  3. En los dos casos: pegar B5 y `DISCORD_TENANT_ID`, y publicar la web.

## 6 · Lo que este runbook no hace

- **No crea código.** Pegar los webhooks del Studio por portapapeles, con validación del canal, pide un guion nuevo. Puede ser `guardar-webhook-discord.sh` generalizado con `--canal`, `--clave` y `--config` para el `.env` de la app, más el reinicio de la web. Es otra tarea.
- **No instala la #403** ni cambia `CONGELADO`, el timer o la imagen que corre.
- **No toca Kuma:** se configura en su interfaz, y lo hace Sam.
