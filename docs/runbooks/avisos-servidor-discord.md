# Runbook · Avisos del servidor y webhooks de Discord · SDD-0609 (y la parte de servidor de la 0606)

**SDD:** [0609](../specs/0609-avisos-servidor-a-discord/spec.md) · el Studio en la
[0606](../specs/0606-avisos-studio-a-discord/spec.md) · se apoya en la
[0541](../specs/0541-publicacion-automatica-vps/spec.md) (publicación automática) y
en [publicacion-automatica-web.md](publicacion-automatica-web.md).
**Decisión:** Sam, 2026-11-05: Discord reemplaza a Telegram como central única de
avisos, con **corte directo** (sin semana de doble envío).
**Regla:** nada de esto se ejecuta en el VPS de producción sin el OK del Director
General. La publicación de la web sigue congelada: este runbook no la descongela ni
publica nada.

## 0 · Dónde estamos (2026-11-07)

| Pieza | Estado |
|---|---|
| Webhook `Servidor · publicaciones` en `#publicaciones`, con avatar | **Creado** (Sam, 2026-11-06). Su dirección todavía **no** está en el servidor |
| Webhook `Uptime Kuma` en `#salud`, con avatar | **Creado y en uso** |
| Uptime Kuma → `#salud` | **Hecho** (2026-11-06, con Sam): la notificación `Discord #salud` está en los 9 monitores y es la predeterminada. Telegram quedó apagada en los 9 y sin predeterminado, pero **no se borró** |
| `aviso-discord.sh` y `publicar-web.sh` que avisa por Discord | En `main` (#381), **sin instalar** en el VPS |
| `guardar-webhook-discord.sh` (este runbook, § 2) | PR #404, **sin fusionar** |
| Relevo sin corte al publicar | PR #403, **sin fusionar** |
| Los cinco webhooks de Operación del Studio (0606) | **Por crear.** Medido el 2026-11-07 en Discord: `#registro-clientes` tiene 0 webhooks; los otros cuatro no se alcanzaron a abrir (la 0606 los da por no creados) |

| Aviso | Quién lo manda | Canal |
|---|---|---|
| Cada publicación de la web (publicada, NO se publicó, vuelta atrás, URGENTE, congelada, descongelada) | `/srv/ops/web/publicar-web.sh` por `/srv/ops/web/aviso-discord.sh` | `#publicaciones` (`1567955265918079096`) |
| Caídas y vueltas de la web, Supabase, Chatwoot y el latido del vigilante | Uptime Kuma, notificación nativa | `#salud` (`1567955345219780698`) |
| Registro, conversaciones, bugs, reporte diario, avisos al equipo (incluidos los **correos que no llegaron**, § 4) | El Studio (SDD-0606) | `#registro-clientes`, `#conversaciones-portal`, `#bugs`, `#reporte-diario`, `#avisos-equipo` |

Los IDs de canal no son llaves; las **direcciones de los webhooks sí**: quien las
tenga escribe en el canal. Nunca van al chat, al repo, a un ticket ni a un log.

## 1 · Lo que se le pide a Sam, de una sola vez

Hacerlo en **Chrome**, no en el navegador del panel de Claude: el del panel no
pasa el portapapeles a Windows (2026-11-06).

**A. Crear cinco webhooks**, uno por canal de Operación. En cada canal: Editar canal
→ Integraciones → Webhooks → **Nuevo webhook**. El nombre es libre: el guion
reconoce el canal por su ID, no por el nombre. Se sugieren estos, con su foto:

| Canal (categoría Operación) | ID del canal (no es una llave) | Nombre sugerido |
|---|---|---|
| `#registro-clientes` | `1567954867878629406` | `Studio registro` |
| `#conversaciones-portal` | `1567954948333768854` | `Studio conversaciones` |
| `#bugs` | `1567955017237921883` | `Studio bugs` |
| `#reporte-diario` | `1567955085550428251` | `Studio reporte diario` |
| `#avisos-equipo` | `1567955151493271785` | `Studio avisos equipo` |

`#publicaciones` y `#salud` ya los tienen. Las fotos de los dos primeros están en
`Escritorio\avatares-discord`. A cada bot nuevo le va una foto.

**B. Pegar seis direcciones en el servidor**, cuando el Director General avise que el
guion está instalado (§ 3, paso 1). Una vuelta por fila, **en este orden**:

| # | Destino | Copiar en Discord la URL de… |
|---|---|---|
| 1 | `publicaciones` | `#publicaciones` → `Servidor · publicaciones` |
| 2 | `registro` | `#registro-clientes` → `Studio registro` |
| 3 | `conversaciones` | `#conversaciones-portal` → `Studio conversaciones` |
| 4 | `bugs` | `#bugs` → `Studio bugs` |
| 5 | `reportes` | `#reporte-diario` → `Studio reporte diario` |
| 6 | `equipo` | `#avisos-equipo` → `Studio avisos equipo` |

En cada vuelta, en PowerShell:

1. Pega el comando con el destino de la fila **sin pulsar Enter** (ejemplo, fila 2):

   ```powershell
   Get-Clipboard | C:\Windows\System32\OpenSSH\ssh.exe -o BatchMode=yes root@217.216.54.70 /srv/ops/web/guardar-webhook-discord.sh registro
   ```

2. En Discord, en el webhook de esa fila: **Copiar URL del webhook**. Ahora el
   portapapeles tiene la dirección, no el comando.
3. Vuelve a PowerShell y pulsa **Enter**. Tiene que decir `GUARDADA (registro) · …`.
   Con `NO GUARDADA`, no se cambió nada: la línea dice por qué (tabla del § 2).

Sin `sudo` (se entra como root con la llave del agente de Windows) y sin `-t` (así
la entrada estándar es el portapapeles). La fila 1 sin destino también sirve: es el
valor por defecto.

No es de Sam: `DISCORD_TENANT_ID` (el ID del tenant de DTD Cargo, no es una llave)
lo pone la sesión de Contabo con `infra/ops/migrate/env-set.sh`.

## 2 · Qué hace `guardar-webhook-discord.sh`

| Destino | Archivo | Variable | Cómo sabe que es el canal correcto |
|---|---|---|---|
| `publicaciones` | `/srv/ops/web/publicar.env` | `PUBLICAR_DISCORD_WEBHOOK` | `channel_id` = `1567955265918079096` |
| `registro` · `conversaciones` · `bugs` · `reportes` · `equipo` | `/srv/dtd-cargo/.env` | `DISCORD_WEBHOOK_REGISTRO` · `_CONVERSACIONES` · `_BUGS` · `_REPORTES` · `_EQUIPO` | `channel_id` = el ID de su canal en la tabla del § 1 (leídos en Discord el 2026-11-07) |

1. Busca la dirección dentro de lo pegado (comillas, espacios, saltos de línea,
   marcas de pegado, texto alrededor). Exige exactamente una.
2. La normaliza (`discordapp.com`, `ptb.`, `/api/vN`) a
   `https://discord.com/api/webhooks/<id>/<token>`.
3. `GET` a Discord con la dirección por la entrada estándar de curl; exige 200 y el
   mismo `id`, y la regla del canal de la tabla.
4. Respalda el archivo como `<archivo>.antes-<0609|0606>-<fecha UTC>` (600, en la
   misma carpeta), reemplaza **solo su variable** y deja el archivo en `600 root`.
   En `publicar.env` además quita `PUBLICAR_TELEGRAM_*` (corte directo de la 0609).
   En el `.env` de la app no toca `TELEGRAM_BOT_TOKEN`: retirarlo es un paso aparte
   del Director General (0606).
5. No reinicia nada.

| Salida | Qué hacer |
|---|---|
| `GUARDADA (destino) · 121 caracteres · sha256 1a2b3c4d5e6f · canal … · VARIABLE en … (600 root) · respaldo …` | Listo. La huella sirve para comparar si se vuelve a pegar |
| `NO GUARDADA (…): lo pegado no trae la dirección…` | El portapapeles tenía otra cosa. Repite la vuelta |
| `NO GUARDADA (…): el webhook es del canal …, no de …` | Se copió el webhook de otro canal. Copia el del canal de la fila |
| `NO GUARDADA (…): Discord no reconoce ese webhook (HTTP 401/404)` | Se copió incompleto o se borró. Copia de nuevo o crea otro |
| `NO GUARDADA (…): trae 2 direcciones…` | Copia solo una |
| `NO GUARDADA (…): no pude preguntarle a Discord …` / `HTTP 429` / `HTTP 5xx` | Pasajero. Repite en un minuto |

Comprobación sin ver las llaves (sesión de Contabo):

```bash
stat -c '%a %U' /srv/ops/web/publicar.env /srv/dtd-cargo/.env
grep -c '^PUBLICAR_DISCORD_WEBHOOK=' /srv/ops/web/publicar.env; grep -c '^PUBLICAR_TELEGRAM_' /srv/ops/web/publicar.env
for v in REGISTRO CONVERSACIONES BUGS REPORTES EQUIPO; do printf '%s %s\n' "$v" "$(grep -c "^DISCORD_WEBHOOK_${v}=" /srv/dtd-cargo/.env)"; done
```

Esperado: `600 root` dos veces, `1`, `0`, y `1` en cada variable.

## 3 · Guion de instalación en el VPS (sesión de Contabo, con el OK del Director General)

Desde el commit fusionado `M` de `main` que traiga la #381 y la #404. Con el
procedimiento de solo script de
[publicacion-automatica-web.md § Compatibilidad de identidad](publicacion-automatica-web.md#compatibilidad-de-identidad--preparación-del-2026-10-20).
Ningún paso publica la web ni la descongela.

**Huellas de referencia** (sha256, primeros 16; medidas en el repo el 2026-11-07):

| Archivo | Commit | Huella |
|---|---|---|
| `publicar-web.sh` instalado el 01-nov (V3) | `ea8ca60d7` | `f71d27594e568f2b` (registro de ese día; **hoy no medida en el VPS**) |
| `publicar-web.sh` en `main` (0609, sin relevo) | `7e75f7708` y `eef75ebef` | `1863b76e71e9f8f8` |
| `publicar-web.sh` de la #403 (relevo + 0609) | `451363eb8` | `467c5f634af842a8` |
| `aviso-discord.sh` | `7e75f7708` | `70639acad24ef26b` |
| `guardar-webhook-discord.sh` de la #404 | `2cf8a60cc` | `fbe2b697bf3aecf1` |

Entre lo instalado y `7e75f7708`, `git log ea8ca60d7..7e75f7708 -- infra/ops/web/publicar-web.sh`
da un solo commit: `f69d520b4` (0609, Discord). Con `M` se vuelve a correr:
`git log ea8ca60d7..$M -- infra/ops/web/publicar-web.sh`. Si aparece otro commit, se
lee antes de seguir.

**La #403 (relevo sin corte) es aparte y la decide el Director General.** Cambia la
publicación: durante un relevo corren dos web a la vez, con 2 GB de tope cada uno.
Si entra en esta ventana, va con su OK propio y antes `free -m` en el VPS (Chatwoot
vive en la misma máquina). Sin la #403, `M` instala el `publicar-web.sh` de `main`
(`1863…`): avisa por Discord y sigue recreando el web como hoy.

**Paso 0 · paquete desde Git Bash** (la máquina de la sesión, no toca el VPS). Con
`MSYS_NO_PATHCONV=1` y `git cat-file blob`, que dan los bytes exactos del commit:

```bash
export MSYS_NO_PATHCONV=1
M=<sha completo de main ya fusionado>
mkdir -p paquete-0609 && for f in aviso-discord.sh guardar-webhook-discord.sh publicar-web.sh; do
  git cat-file blob "$M:infra/ops/web/$f" > "paquete-0609/$f"; done
( cd paquete-0609 && sha256sum *.sh | tee SHA256SUMS ) && bash -n paquete-0609/*.sh
git log --oneline ea8ca60d7.."$M" -- infra/ops/web/publicar-web.sh
```

Las huellas del `SHA256SUMS` tienen que coincidir con la tabla (o con la del `M` que
traiga la #403, si el DG la sumó).

**Paso 1 · lectura previa en el VPS** (solo lectura; como root). Si la huella del
`publicar-web.sh` instalado no es `f71d27594e568f2b`, **se para** y se avisa al DG.

```bash
E=/srv/ops/evidencias/instalar-avisos-discord-$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 700 "$E" && cd "$E"
{ date -u +%FT%TZ
  for f in /srv/ops/web/publicar-web.sh /srv/ops/web/aviso-discord.sh /srv/ops/web/guardar-webhook-discord.sh /srv/ops/web/publicar.env; do
    if [ -e "$f" ]; then stat -c '%n %a %U %s %y' "$f"; sha256sum "$f"; else echo "$f NO EXISTE"; fi; done
  echo "CONGELADO: $(head -1 /srv/ops/web/CONGELADO 2>/dev/null || echo 'no')"
  echo "timer: $(systemctl is-enabled dtd-cargo-publicar.timer 2>&1) / $(systemctl is-active dtd-cargo-publicar.timer 2>&1)"
  echo "variables de publicar.env (sin valores):"; cut -d= -f1 /srv/ops/web/publicar.env | sort
} > antes.txt
cat antes.txt
[ "$(sha256sum /srv/ops/web/publicar-web.sh | cut -c1-16)" = f71d27594e568f2b ] && echo "OK: es el instalado el 01-nov" || echo "PARAR: el instalado no es f71d…"
```

**Paso 2 · instalar los dos guiones nuevos** (nadie los usa todavía). Con
`paquete-0609/` copiado a `$E/paquete` (root/700). Cada temporal pasa `cmp` contra
el paquete y `bash -n` antes del `mv`:

```bash
P="$E/paquete"; ( cd "$P" && sha256sum -c SHA256SUMS ) || echo PARAR
for f in aviso-discord.sh guardar-webhook-discord.sh; do
  t="/srv/ops/web/.$f.nuevo"
  install -o root -g root -m 700 "$P/$f" "$t" && cmp "$P/$f" "$t" && bash -n "$t" && mv -f "$t" "/srv/ops/web/$f" || { rm -f "$t"; echo "PARAR en $f"; }
done
sha256sum /srv/ops/web/{aviso-discord,guardar-webhook-discord}.sh
```

Avisar a Sam: puede hacer el § 1 B.

**Paso 3 · Sam pega las seis direcciones** (§ 1 B) y la sesión corre la comprobación
del § 2. Las líneas `PUBLICAR_TELEGRAM_*` que quita el guion no hacen perder
ningún aviso: el 01-nov el script viejo ya decía «Telegram: SIN CONFIGURAR».

**Paso 4 · prueba con un aviso real a `#publicaciones`** (no publica nada):

```bash
/srv/ops/web/aviso-discord.sh --estado      # → «Discord: configurado» (no envía)
/srv/ops/web/aviso-discord.sh --probar      # → «aviso por Discord: entregado (HTTP 200)»
```

En `#publicaciones` aparece «DTD Cargo · prueba de avisos del servidor desde …», sin
menciones ni vista previa. Sam confirma que lo ve.

**Paso 5 · instalar `publicar-web.sh`**, con el candado del publicador. El respaldo
del instalado queda en `$E`:

```bash
( flock -w 120 9 || { echo "otra publicación en curso: no se instaló"; exit 1; }
  cp -p /srv/ops/web/publicar-web.sh "$E/publicar-web.sh.antes-$(sha256sum /srv/ops/web/publicar-web.sh | cut -c1-16)" &&
  t=/srv/ops/web/.publicar-web.sh.nuevo &&
  install -o root -g root -m 700 "$P/publicar-web.sh" "$t" && cmp "$P/publicar-web.sh" "$t" && bash -n "$t" &&
  mv -f "$t" /srv/ops/web/publicar-web.sh && sha256sum /srv/ops/web/publicar-web.sh
) 9>/run/lock/dtd-cargo-publicar.lock
/srv/ops/web/publicar-web.sh estado         # → «Discord:     configurado» y «Uptime Kuma: configurado»; CONGELADO sigue
```

**No uses `congelar` / `descongelar` para probar:** la publicación está congelada
desde el 2026-11-01 y `congelar` reescribe el motivo del archivo `CONGELADO`;
`descongelar` la soltaría. El primer aviso real de una publicación llega cuando el
Director General descongele.

**Paso 6 · cerrar la evidencia.** `despues.txt` igual que `antes.txt`, comparar y
sellar. `CONGELADO` y el timer tienen que quedar como estaban. En `publicar.env`
cambian solo `PUBLICAR_DISCORD_WEBHOOK` (entra) y `PUBLICAR_TELEGRAM_*` (salen):

```bash
cd "$E"
{ date -u +%FT%TZ
  for f in /srv/ops/web/publicar-web.sh /srv/ops/web/aviso-discord.sh /srv/ops/web/guardar-webhook-discord.sh /srv/ops/web/publicar.env; do
    if [ -e "$f" ]; then stat -c '%n %a %U %s %y' "$f"; sha256sum "$f"; else echo "$f NO EXISTE"; fi; done
  echo "CONGELADO: $(head -1 /srv/ops/web/CONGELADO 2>/dev/null || echo 'no')"
  echo "timer: $(systemctl is-enabled dtd-cargo-publicar.timer 2>&1) / $(systemctl is-active dtd-cargo-publicar.timer 2>&1)"
  echo "variables de publicar.env (sin valores):"; cut -d= -f1 /srv/ops/web/publicar.env | sort
} > despues.txt
diff antes.txt despues.txt
printf '%s\n' "M=$M" "paquete: $(cat paquete/SHA256SUMS | tr '\n' ' ')" "instalado por: ${SUDO_USER:-root}" > MANIFIESTO
grep -c webhooks antes.txt despues.txt MANIFIESTO | grep -v ":0$" && echo "PARAR: hay una dirección en la evidencia" || echo "evidencia sin direcciones"
find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%f\0' | LC_ALL=C sort -z | xargs -0 sha256sum > SHA256SUMS
```

`grep -c webhooks` tiene que dar 0 en `antes.txt`, `despues.txt` y `MANIFIESTO` (los guiones del paquete sí nombran la palabra en su código): la evidencia nunca lleva
una dirección.

**Paso 7 · los cinco del Studio** se leen cuando el web se recrea, es decir, en la
próxima publicación. Antes hacen falta:

- `DISCORD_TENANT_ID` en `/srv/dtd-cargo/.env` (sesión de Contabo, `env-set.sh`);
- la 0606 publicada.

Después, probar un aviso por categoría, como pide el handoff de la 0606.

## 4 · `#salud` y los avisos de correo

- **`#salud` está listo:** Kuma avisa ahí desde el 2026-11-06. La prueba de ida y
  vuelta la hizo Sam con el botón **Test** de Kuma.
- **Los avisos de correo no van a `#salud`.** El cron `/api/cron/mail-health`
  (`infra/dtd-cargo/cron/crontab`, cada 30 min) avisa «Correos que no llegaron» con
  la categoría `equipo` del Studio (`lib/studio/mail/mail-health-notify.ts`). En
  `main` eso cae en **`#avisos-equipo`**.
- **Por dónde sale hoy en producción: no medido.** Depende de dos cosas:
  - si la web publicada es anterior a la #380 (0606): en ese caso es el código de Telegram;
  - si `TELEGRAM_BOT_TOKEN` sigue en el `.env`.

  No se leyó la imagen que corre ni el `.env`.
- **Decisión pendiente del DG:** el plan maestro de la oficina pone «avisos de
  correo» en `#salud`, y la SDD-0610 espera avisar fallos en `#salud` «por la cola de
  la 0606». La 0606 no tiene una categoría `salud`. Llevarlos a `#salud` es un cambio
  del Studio, con su SDD, y otro webhook con su variable; no es de este runbook.

## 5 · Qué significa cada salida de `aviso-discord.sh`

También en el journal de `dtd-cargo-publicar.service`.

| Salida | Código | Qué hacer |
|---|---|---|
| `aviso por Discord: entregado (HTTP 200)` | 0 | nada |
| `aviso NO enviado: Discord SIN CONFIGURAR …` / `NO VÁLIDO …` | 2 | repetir la fila 1 del § 1 B |
| `aviso NO enviado: Discord lo rechazó (HTTP 401/404)` | 3 | el webhook se borró o cambió: crear otro y pegarlo |
| `aviso NO enviado: Discord pide esperar …` / `HTTP 5xx` / `no disponible` | 4 | pasajero; los avisos de una vez por motivo se intentan otra vez en la vuelta siguiente del vigilante |
| `aviso incierto: …` | 5 | pudo llegar; mirar el canal antes de repetir a mano |

## 6 · Vuelta atrás

1. **`publicar-web.sh`:** reinstalar `$E/publicar-web.sh.antes-*`, con el paso 5 al
   revés: candado, temporal, `cmp`, `bash -n` y `mv`. La huella esperada después es
   `f71d27594e568f2b`.
2. **`publicar.env`:** vuelve por un temporal en 600 y `mv`, desde
   `/srv/ops/web/publicar.env.antes-0609-*`:
   `install -o root -g root -m 600 <respaldo> /srv/ops/web/.publicar.env.nuevo && mv -f /srv/ops/web/.publicar.env.nuevo /srv/ops/web/publicar.env`.
   El `.env` de la app vuelve igual, desde `/srv/dtd-cargo/.env.antes-0606-*`.
3. **Avisos del script viejo:** sin `PUBLICAR_TELEGRAM_CHAT_ID`, el script viejo
   **no avisa**, aunque `TELEGRAM_BOT_TOKEN` siga en el `.env`. Ya era así el 01-nov:
   «Telegram: SIN CONFIGURAR». Con la vuelta atrás quedan los avisos de Kuma en
   `#salud` y el journal.
4. **Guiones nuevos:** `aviso-discord.sh` y `guardar-webhook-discord.sh` pueden
   quedarse, porque nadie los llama solos.
5. **Kuma:** la vuelta atrás de [uptime-kuma/README.md](../../infra/ops/uptime-kuma/README.md#vuelta-atrás).
   Encender Telegram en los monitores (sigue configurada) y apagar Discord.

Si una dirección de webhook se filtra: borrar ese webhook en Discord (deja de
funcionar al instante), crear otro con el mismo nombre y repetir su fila del § 1 B.
