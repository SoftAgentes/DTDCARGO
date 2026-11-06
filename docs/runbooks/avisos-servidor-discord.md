# Runbook · Avisos del servidor: de Telegram a Discord · SDD-0609

**SDD:** [0609](../specs/0609-avisos-servidor-a-discord/spec.md) · se apoya en la
[0541](../specs/0541-publicacion-automatica-vps/spec.md) (publicación automática) y
en [publicacion-automatica-web.md](publicacion-automatica-web.md).
**Estado:** preparado en la rama, **sin instalar**. Nada de esto se hace antes de
que la PR esté fusionada y el Director General autorice instalar el script en el
VPS de producción. La publicación de la web sigue congelada: este corte no la
descongela ni publica nada.
**Decisión:** Sam, 2026-11-05: Discord reemplaza a Telegram como central única de
avisos, con **corte directo** (sin semana de doble envío).

| Aviso | Quién lo manda | Canal de Discord |
|---|---|---|
| Cada publicación de la web (publicada, NO se publicó, vuelta atrás, URGENTE, congelada, descongelada) | `/srv/ops/web/publicar-web.sh` por `/srv/ops/web/aviso-discord.sh` | `#publicaciones` (`1567955265918079096`) |
| Caídas y vueltas de la web, Supabase, Chatwoot y el latido del vigilante | Uptime Kuma, notificación nativa | `#salud` (`1567955345219780698`) |

Los dos canales están en la categoría privada «Servidor» del servidor «DTD Cargo»
(`1534936818951262390`). Los IDs no son llaves; las **direcciones de los webhooks
sí**: quien las tenga escribe en el canal. Nunca van al chat, al repo, a un ticket
ni a un log.

## 1 · Qué crea Sam en Discord

1. `#publicaciones` → Editar canal → Integraciones → Webhooks → **Nuevo webhook**,
   nombre `Servidor · publicaciones`. «Copiar URL del webhook» solo en el momento
   del paso 2.
2. `#salud` → lo mismo, nombre `Uptime Kuma`. Se pega en Kuma
   ([infra/ops/uptime-kuma/README.md](../../infra/ops/uptime-kuma/README.md)).

Los canales siguen privados: solo Sam (y quien él agregue) los ve.

## 2 · Dónde pega Sam la llave en el VPS de producción

Con `infra/ops/web/guardar-webhook-discord.sh`. La sesión de Contabo lo instala
antes en `/srv/ops/web/` (root, 700), con el mismo procedimiento del § 3.

La dirección no pasa por ningún chat ni por una ventana de `ssh -t`. El
2026-11-05, en la oficina, pegar dentro de `ssh -t` desde la consola de Windows no
llegó bien a `read -s`. Ahora viaja del portapapeles de Sam a la entrada estándar
del guion.

**Sam, en PowerShell de su PC, en este orden:**

1. Pega este comando en PowerShell **sin pulsar Enter**:

   ```powershell
   Get-Clipboard | C:\Windows\System32\OpenSSH\ssh.exe -o BatchMode=yes root@217.216.54.70 /srv/ops/web/guardar-webhook-discord.sh
   ```

2. En Discord: `#publicaciones` → Editar canal → Integraciones → Webhooks →
   `Servidor · publicaciones` → **Copiar URL del webhook**. Ahora el portapapeles
   tiene la dirección, no el comando.
3. Vuelve a PowerShell y pulsa **Enter**.

**Qué hace el guion:**

- busca la dirección dentro de lo pegado, aunque traiga comillas, espacios, saltos de línea o texto alrededor;
- normaliza `discordapp.com`, `ptb.` y `/api/vN` a `https://discord.com/api/webhooks/<id>/<token>`;
- le pregunta a Discord (`GET` al webhook) y exige que sea del canal `#publicaciones` (`1567955265918079096`);
- respalda `publicar.env` como `publicar.env.antes-0609-<fecha UTC>`, en la misma carpeta y en 600, porque lleva llaves;
- escribe `PUBLICAR_DISCORD_WEBHOOK`, quita las líneas `PUBLICAR_TELEGRAM_*` y deja el archivo en `600 root`.

Responde una sola línea, sin la dirección:

| Salida | Qué hacer |
|---|---|
| `GUARDADA · 121 caracteres · sha256 1a2b3c4d5e6f · canal #publicaciones · … en 600 root · respaldo …` | Listo. La huella sirve para comparar si se vuelve a pegar, sin mostrar la dirección |
| `NO GUARDADA: lo pegado no trae la dirección…` | El portapapeles tenía otra cosa. Repite desde el paso 1 |
| `NO GUARDADA: el webhook es del canal …, no de #publicaciones` | Se copió el webhook de otro canal (por ejemplo `#salud`). Copia el de `#publicaciones` |
| `NO GUARDADA: Discord no reconoce ese webhook (HTTP 401/404)` | Se copió incompleto o el webhook se borró. Copia de nuevo o crea otro (§ 1) |
| `NO GUARDADA: trae 2 direcciones…` | Copia solo una |
| `NO GUARDADA: no pude preguntarle a Discord …` / `HTTP 429` / `HTTP 5xx` | Pasajero. Repite en un minuto |

Con `NO GUARDADA` no se cambió nada: ni el archivo ni el respaldo. El `TELEGRAM_BOT_TOKEN` del `.env` de la app **no se toca**: lo usa el Studio hasta que la SDD-0606 lo retire.

Comprobación sin ver la llave, desde la sesión de Contabo:

```bash
stat -c '%a %U' /srv/ops/web/publicar.env; grep -c '^PUBLICAR_DISCORD_WEBHOOK=' /srv/ops/web/publicar.env; grep -c '^PUBLICAR_TELEGRAM_' /srv/ops/web/publicar.env
```

Esperado: `600 root`, `1`, `0`.

## 3 · Instalar los scripts (sesión de Contabo, con el OK del Director General)

Desde el commit fusionado `M` de `main`, con el procedimiento de solo script de
[publicacion-automatica-web.md § Compatibilidad de identidad](publicacion-automatica-web.md#compatibilidad-de-identidad--preparación-del-2026-10-20):
candado `/run/lock/dtd-cargo-publicar.lock`, respaldo con hash en
`/srv/ops/evidencias/`, temporal root/700 en `/srv/ops/web/` y renombrado atómico.

1. **Primero** `guardar-webhook-discord.sh` y `aviso-discord.sh` (nuevos, root 700):
   no los usa nadie todavía. Con el primero, Sam hace el § 2.
2. **Después** `publicar-web.sh`. Si se instala antes del § 2, cada aviso dice
   en el journal «aviso NO enviado: Discord SIN CONFIGURAR» y la publicación sigue
   igual.

Comprobación: `sha256sum /srv/ops/web/{guardar-webhook-discord,aviso-discord,publicar-web}.sh` igual a
`git show M:infra/ops/web/<archivo> | sha256sum`.

## 4 · Prueba de ida y vuelta

**No uses `congelar` / `descongelar` para probar:** la publicación está congelada
desde el 2026-11-01 y `congelar` reescribe el motivo del archivo `CONGELADO`;
`descongelar` la soltaría.

```bash
/srv/ops/web/aviso-discord.sh --estado      # → «Discord: configurado» (no envía)
/srv/ops/web/aviso-discord.sh --probar      # → «aviso por Discord: entregado (HTTP 200)»
/srv/ops/web/publicar-web.sh estado         # → «Discord:     configurado» y «Uptime Kuma: configurado»
```

- En `#publicaciones` aparece «DTD Cargo · prueba de avisos del servidor desde …».
  Sam confirma que lo ve. Sin menciones ni vista previa.
- Ninguna de las tres salidas muestra la dirección (`grep -c webhooks` sobre lo
  que se copió al handoff da 0).
- Kuma: botón **Probar** de la notificación `Discord #salud` → llega a `#salud`.

El primer aviso real llega con la próxima publicación, que decide el Director
General al descongelar.

Qué significa cada salida de `aviso-discord.sh` (también en el journal de
`dtd-cargo-publicar.service`):

| Salida | Código | Qué hacer |
|---|---|---|
| `aviso por Discord: entregado (HTTP 200)` | 0 | nada |
| `aviso NO enviado: Discord SIN CONFIGURAR …` / `NO VÁLIDO …` | 2 | repetir el paso 2 |
| `aviso NO enviado: Discord lo rechazó (HTTP 401/404)` | 3 | el webhook se borró o cambió: crear otro (paso 1) y pegarlo (paso 2) |
| `aviso NO enviado: Discord pide esperar …` / `HTTP 5xx` / `no disponible` | 4 | pasajero; los avisos de una vez por motivo se intentan otra vez en la vuelta siguiente del vigilante |
| `aviso incierto: …` | 5 | pudo llegar; mirar el canal antes de repetir a mano |

## 5 · Vuelta atrás

1. Reinstalar el `publicar-web.sh` anterior desde el respaldo del paso 3 (mismo
   procedimiento de solo script; comprobar su sha256 contra el registrado).
2. Devolver las líneas `PUBLICAR_TELEGRAM_*` desde
   `/srv/ops/web/publicar.env.antes-0609-*` (o volver a pegarlas). El script
   anterior usa `TELEGRAM_BOT_TOKEN` del `.env`: si la SDD-0606 ya retiró ese bot,
   la vuelta atrás no tiene a dónde avisar y queda solo Kuma.
3. `aviso-discord.sh` puede quedarse: sin `publicar-web.sh` nuevo, nadie lo llama.
4. En Kuma, la vuelta atrás de [uptime-kuma/README.md](../../infra/ops/uptime-kuma/README.md#vuelta-atrás).

Si una dirección de webhook se filtra: borrar ese webhook en Discord (deja de
funcionar al instante), crear otro y repetir el paso 2 o el de Kuma.
