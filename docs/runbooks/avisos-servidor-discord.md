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
| Los cinco webhooks de Operación del Studio (0606) | **No medido.** La 0606 los da por no creados; no se pudo mirar Discord el 2026-11-07 |

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

**A. Crear cinco webhooks** (si ya existen, solo revisar el nombre). En cada canal:
Editar canal → Integraciones → Webhooks → **Nuevo webhook**, con **este nombre
exacto**, porque el guion lo comprueba:

| Canal (categoría Operación) | Nombre del webhook |
|---|---|
| `#registro-clientes` | `Studio registro` |
| `#conversaciones-portal` | `Studio conversaciones` |
| `#bugs` | `Studio bugs` |
| `#reporte-diario` | `Studio reporte diario` |
| `#avisos-equipo` | `Studio avisos equipo` |

`#publicaciones` y `#salud` ya los tienen. Los avatares están en
`Escritorio\avatares-discord` (opcional para los de Operación).

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
| `registro` · `conversaciones` · `bugs` · `reportes` · `equipo` | `/srv/dtd-cargo/.env` | `DISCORD_WEBHOOK_REGISTRO` · `_CONVERSACIONES` · `_BUGS` · `_REPORTES` · `_EQUIPO` | servidor «DTD Cargo», nombre del webhook de la tabla del § 1 y un canal que no sea de Servidor u Oficina. Los IDs de los canales de Operación no están medidos en el repo: por eso el nombre |

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
| `NO GUARDADA (…): el webhook es del canal …` / `se llama «…» y … tiene que llamarse «…»` / `es de un canal de Servidor u Oficina` | Se copió el de otro canal, o el webhook tiene otro nombre. Copia el de la fila, o renómbralo como dice el § 1 |
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

Desde el commit fusionado `M` de `main` que traiga la #381, la #403 y la #404. Con
el procedimiento de solo script de
[publicacion-automatica-web.md § Compatibilidad de identidad](publicacion-automatica-web.md#compatibilidad-de-identidad--preparación-del-2026-10-20).
Ningún paso publica la web ni la descongela.

**Paso 0 · preparar en la máquina de la sesión** (no toca el VPS): sacar los tres
archivos de `M` con sus bytes y anotar sus hashes.

```bash
M=<sha completo de main ya fusionado>
mkdir -p paquete-0609 && for f in aviso-discord.sh guardar-webhook-discord.sh publicar-web.sh; do
  git show "$M:infra/ops/web/$f" > "paquete-0609/$f"; done
( cd paquete-0609 && sha256sum *.sh | tee SHA256SUMS ) && bash -n paquete-0609/*.sh
```

**Paso 1 · instalar los dos guiones nuevos** (nadie los usa todavía). En el VPS, como
root, con `paquete-0609/` copiado a una carpeta root/700 (por ejemplo
`/srv/ops/evidencias/paquete-0609-<fecha>`):

```bash
P=/srv/ops/evidencias/paquete-0609-<fecha>
( cd "$P" && sha256sum -c SHA256SUMS )
for f in aviso-discord.sh guardar-webhook-discord.sh; do
  install -o root -g root -m 700 "$P/$f" "/srv/ops/web/.$f.nuevo" && mv -f "/srv/ops/web/.$f.nuevo" "/srv/ops/web/$f"
done
sha256sum /srv/ops/web/{aviso-discord,guardar-webhook-discord}.sh
```

Avisar a Sam: puede hacer el § 1 B.

**Paso 2 · Sam pega las seis direcciones** (§ 1 B) y la sesión corre la comprobación
del § 2.

**Paso 3 · prueba con un aviso real a `#publicaciones`** (no publica nada):

```bash
/srv/ops/web/aviso-discord.sh --estado      # → «Discord: configurado» (no envía)
/srv/ops/web/aviso-discord.sh --probar      # → «aviso por Discord: entregado (HTTP 200)»
```

En `#publicaciones` aparece «DTD Cargo · prueba de avisos del servidor desde …», sin
menciones ni vista previa. Sam confirma que lo ve.

**Paso 4 · instalar `publicar-web.sh`** (el del relevo y Discord). Con el candado
del publicador, igual que en la ventana del 2026-11-01:

```bash
( flock -w 120 9 || { echo "otra publicación en curso: no se instaló"; exit 1; }
  cp -p /srv/ops/web/publicar-web.sh "/srv/ops/evidencias/publicar-web.sh.antes-0609-$(sha256sum /srv/ops/web/publicar-web.sh | cut -c1-16)" &&
  install -o root -g root -m 700 "$P/publicar-web.sh" /srv/ops/web/.publicar-web.sh.nuevo &&
  mv -f /srv/ops/web/.publicar-web.sh.nuevo /srv/ops/web/publicar-web.sh && sha256sum /srv/ops/web/publicar-web.sh
) 9>/run/lock/dtd-cargo-publicar.lock
/srv/ops/web/publicar-web.sh estado         # → «Discord:     configurado» y «Uptime Kuma: configurado»; CONGELADO sigue
```

**No uses `congelar` / `descongelar` para probar:** la publicación está congelada
desde el 2026-11-01 y `congelar` reescribe el motivo del archivo `CONGELADO`;
`descongelar` la soltaría. El primer aviso real de una publicación llega cuando el
Director General descongele.

**Paso 5 · los cinco del Studio** se leen cuando el web se recrea, es decir, en la
próxima publicación (con el relevo de la #403, sin corte). Antes hacen falta:

- `DISCORD_TENANT_ID` en `/srv/dtd-cargo/.env` (sesión de Contabo, `env-set.sh`);
- la 0606 publicada.

Después, probar un aviso por categoría, como pide el handoff de la 0606.

## 4 · `#salud` y los avisos de correo

- **`#salud` está listo:** Kuma avisa ahí desde el 2026-11-06. La prueba de ida y
  vuelta la hizo Sam con el botón **Test** de Kuma.
- **Los avisos de correo NO van a `#salud`.** El cron `/api/cron/mail-health`
  (`infra/dtd-cargo/cron/crontab`, cada 30 min) avisa «Correos que no llegaron» con
  la categoría `equipo` del Studio (`lib/studio/mail/mail-health-notify.ts`), así que
  cae en **`#avisos-equipo`**. Hoy sigue por Telegram, hasta que la 0606 esté
  publicada y con sus webhooks.
- **Decisión pendiente:** el plan maestro de la oficina pone «avisos de correo» en
  `#salud`, y la SDD-0610 espera avisar fallos en `#salud` «por la cola de la
  0606». La 0606 no tiene una categoría `salud`. Llevar los correos a `#salud` es un
  cambio del Studio, con su SDD, y otro webhook para `#salud` con su variable; no es
  de este runbook. Mientras tanto llegan a `#avisos-equipo`.

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

1. Reinstalar el `publicar-web.sh` anterior desde
   `/srv/ops/evidencias/publicar-web.sh.antes-0609-*` (paso 4 al revés, con el candado).
2. Devolver lo que hubiera en `publicar.env` y en `.env` desde sus respaldos
   `*.antes-0609-*` / `*.antes-0606-*` (en la misma carpeta). El script anterior usa
   `TELEGRAM_BOT_TOKEN` del `.env`: si ya se retiró, la vuelta atrás no tiene a dónde
   avisar y queda solo Kuma.
3. `aviso-discord.sh` y `guardar-webhook-discord.sh` pueden quedarse: nadie los llama solos.
4. En Kuma, la vuelta atrás de [uptime-kuma/README.md](../../infra/ops/uptime-kuma/README.md#vuelta-atrás):
   encender Telegram en los monitores (sigue configurada) y apagar Discord.

Si una dirección de webhook se filtra: borrar ese webhook en Discord (deja de
funcionar al instante), crear otro con el mismo nombre y repetir su fila del § 1 B.
