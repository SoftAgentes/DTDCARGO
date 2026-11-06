---
sdd: "0609"
title: "Avisos del servidor: de Telegram a Discord"
status: in-progress
author: "Claude"
created: 2026-11-05
updated: 2026-11-05
supersedes: null
superseded_by: null
related: ["0505", "0541", "0547", "0606", "0607"]
confidencialidad: interno
---

# SDD-0609 — Avisos del servidor: de Telegram a Discord

> Cada publicación de la web avisa al canal `#publicaciones` de Discord y Uptime Kuma avisa a `#salud`. Telegram deja de usarse para estos avisos, sin semana de doble envío.

## Contexto

Decisión de Sam (2026-11-05): Discord reemplaza a Telegram como central única de avisos, con **corte directo**. El plan tiene tres piezas: la oficina de agentes (SDD-0605/0607, cortada ese día), los avisos del Studio (SDD-0606) y los avisos del **servidor de producción**, que son esta spec.

Estado antes de esta spec, medido en `main` `fff7249fc`:

| Qué | Dónde | Cómo avisaba |
|---|---|---|
| Publicación automática de la web | `infra/ops/web/publicar-web.sh`, función `telegram()` | `sendMessage` de Telegram con `PUBLICAR_TELEGRAM_CHAT_ID` de `/srv/ops/web/publicar.env` y el token `PUBLICAR_TELEGRAM_BOT_TOKEN` o, si faltaba, el `TELEGRAM_BOT_TOKEN` del `.env` de la app. 8 llamadas: publicada, vuelta atrás, URGENTE (2), vuelta atrás a mano, congelada, descongelada y los avisos de una vez por motivo (puertas, `.env`, pull, disco, imagen, ensayo) |
| Monitores de disponibilidad | Uptime Kuma (`infra/ops/uptime-kuma/`), configurado en su interfaz | notificación de Telegram de Kuma |
| `infra/ops/web/telegram-webhook.sh` | registra el webhook **entrante** del bot de la app (`/api/telegram/webhook`) | no es un aviso del servidor: **no aplica** (ver D6) |

Los avisos de publicación llevan SHA, motivo técnico (migraciones que faltan, archivo distinto, error de docker), el enlace al commit en GitHub y la ruta de la evidencia en el servidor. **No llevan datos de personas**, así que no requieren la revisión de `revisar-datos-ve`.

Datos de Discord (no son llaves): servidor «DTD Cargo» `1534936818951262390`; categoría privada «Servidor»; `#publicaciones` `1567955265918079096`; `#salud` `1567955345219780698`.

## Alcance

1. `infra/ops/web/aviso-discord.sh` (nuevo): manda un aviso a un webhook de Discord.
2. `infra/ops/web/publicar-web.sh`: avisa por ese script en lugar de Telegram.
3. `infra/ops/uptime-kuma/`: documentar el paso manual de Sam para apuntar la notificación nativa de Kuma a `#salud` y retirar Telegram de lo que dice la carpeta.
4. Runbook del corte: [docs/runbooks/avisos-servidor-discord.md](../../runbooks/avisos-servidor-discord.md).
5. Pruebas sin red: `infra/ops/tests/prueba-aviso-discord.sh` (nueva) y `infra/ops/tests/prueba-publicar-web.sh` (adaptada).

Fuera de alcance: instalar en el VPS, crear los webhooks, configurar Kuma (son pasos de Sam y de la sesión de Contabo con el runbook); los avisos del Studio (SDD-0606); el bot de Telegram de la app y su webhook entrante.

## Decisiones

### D1 · Un script aparte para el envío

`aviso-discord.sh` recibe el texto por stdin y responde una línea y un código. `publicar-web.sh` lo llama con `bash`, así que un archivo sin permiso de ejecución también sirve.

- Se prueba solo, en Linux y en Git Bash, sin `flock` ni el escenario completo de publicación.
- Sam tiene una prueba de ida y vuelta que no toca la publicación: `aviso-discord.sh --probar`. La publicación está congelada y `congelar`/`descongelar` no sirven para probar (D7).
- Otro script del servidor puede reutilizarlo con `--config` y `--clave`.

Costo: un archivo más que instalar en `/srv/ops/web/`. Si falta, `publicar-web.sh` lo dice en el log y publica igual.

### D2 · El mismo criterio de envío que la 0606 y la 0607

| Regla | Cómo |
|---|---|
| La dirección es una llave | Vive solo en `/srv/ops/web/publicar.env` (root, 600) como `PUBLICAR_DISCORD_WEBHOOK`. La lee `aviso-discord.sh`, no `publicar-web.sh`. Viaja a curl por stdin (`-K -`), nunca en la línea de comandos. curl corre con stderr a `/dev/null`. Ninguna salida ni error la muestra |
| Validación entera | La forma de `isDiscordWebhookUrl` de la 0606: `https`, `discord.com`/`discordapp.com`/`canary.`/`ptb.`, ruta `/api[/vN]/webhooks/<17-20 dígitos>/<token de 20-100>`, sin usuario, puerto, query ni fragmento. Otro valor es «NO VÁLIDO» y no se envía nada |
| Sin menciones | `allowed_mentions: {parse: []}`. Además `flags: 4` (sin vista previa de enlaces), como la 0606 y la 0607 |
| `?wait=true` | Solo cuenta como entregado lo que vuelve 2xx **con** el `id` del mensaje. Un 2xx sin id es «incierto» |
| User-Agent | `DiscordBot (https://dtdcargo.com, 1.0)` |
| 429 | Espera `Retry-After` (hacia arriba, mínimo 1 s) y reintenta, hasta 3 intentos, si la espera no pasa de 10 s. Si pide más, «reintentable» sin esperar: el vigilante corre cada minuto bajo un candado |
| Recorte a 2.000 | Se corta a 2.000 **bytes** sin partir un carácter UTF-8 y se agrega «…». Un carácter ocupa al menos un byte y nunca más unidades UTF-16 que bytes: no pasa el tope se cuente como se cuente. El texto completo queda en el journal y en la evidencia |
| JSON sin `jq` | Escapa `\`, `"`, tab y salto de línea. Borra el CR y los demás controles. No agrega dependencias al servidor |

Códigos de salida: `0` entregado · `2` sin configurar o no válido · `3` rechazado (texto vacío o 4xx) · `4` reintentable (429 largo, 5xx, sin conexión: curl 6, 7 o 35) · `5` incierto (otro error de curl después de conectar, o 2xx sin id) · `64` uso.

### D3 · Corte directo y falla visible

`publicar-web.sh` ya no lee ninguna variable de Telegram ni cae a Telegram si Discord falla. Si falta la credencial, el script o la dirección no es válida:

- el log (journal y `salida.txt` de la evidencia) dice `aviso NO enviado: …`;
- `publicar-web.sh estado` dice `Discord: SIN CONFIGURAR`, `NO VÁLIDO` o `SIN INSTALAR`;
- **la publicación termina con el mismo código que si el aviso hubiera salido**. `avisar()` siempre devuelve 0. Antes, `congelar` y `descongelar` terminaban con el código del envío a Telegram porque era su última orden.

### D4 · Un aviso de una vez por motivo se recuerda solo si salió

`avisar_una_vez` guardaba la clave del aviso aunque no hubiera salido. Ahora la guarda solo con «entregado» o «incierto»:

- Sin Discord, el aviso de una imagen retenida se vuelve a intentar en cada vuelta: queda visible en el log cada minuto.
- Cuando Sam pega la llave, el aviso pendiente sale una vez.
- Un «incierto» no se repite: pudo haber llegado.

### D5 · Uptime Kuma: notificación nativa, paso manual

Kuma 2.5.5 trae notificación de Discord por webhook. Configurarla es un paso de Sam en la interfaz ([infra/ops/uptime-kuma/README.md](../../../infra/ops/uptime-kuma/README.md)), con el prefijo vacío (sin `@everyone`), «aplicar en todos los monitores» y la de Telegram desactivada. El repo no guarda la configuración de Kuma: vive en su base SQLite.

### D6 · `telegram-webhook.sh` no se toca

Registra a qué URL entrega Telegram los mensajes **entrantes** del bot de la app. No es un aviso del servidor. Se retira con el bot, en la SDD-0606 o la que la siga. La línea de `corte-paso2.sh` que lo menciona es del corte de la 0505, ya hecho.

### D7 · La prueba de ida y vuelta no toca el interruptor

La publicación está congelada desde el 2026-11-01. `congelar` reescribe el motivo de `CONGELADO` y `descongelar` lo borra, así que la prueba del runbook usa `aviso-discord.sh --estado`, `aviso-discord.sh --probar` y `publicar-web.sh estado`.

## Diseño

```
publicar-web.sh ──avisar "texto"──► enviar_discord ──stdin──► aviso-discord.sh --config publicar.env
                                       │                              │ valida, recorta, JSON
                                       │◄── una línea + código ───────┤ curl -K - (dirección por stdin)
                                       ▼                              ▼
                                   log (journal, evidencia)     Discord #publicaciones (?wait=true)
Uptime Kuma ──notificación nativa──► Discord #salud
```

## Criterios de aceptación

| # | Criterio | Evidencia |
|---|---|---|
| A1 | `publicar-web.sh` no envía nada a Telegram ni lee sus variables | `grep -ci telegram infra/ops/web/publicar-web.sh` → solo el comentario histórico; prueba «corte directo: nada sale a Telegram» |
| A2 | Cada aviso de publicación sale una vez a Discord con `?wait=true`, la dirección por stdin y el log dice «entregado» | `prueba-publicar-web.sh` § publicar |
| A3 | Sin credencial, con dirección no válida o sin `aviso-discord.sh`: publica igual (mismo código), lo dice el log y no cae a Telegram; `congelar`/`descongelar` salen 0 | `prueba-publicar-web.sh` § avisos sin Discord |
| A4 | Sin menciones, sin vista previa, User-Agent, recorte a 2.000 en UTF-8 válido, JSON válido con comillas y controles | `prueba-aviso-discord.sh` § envío y § recorte |
| A5 | 429 con espera corta reintenta; con espera larga o tres seguidos, sale 4; 4xx, 5xx, 2xx sin id y errores de curl con su código | `prueba-aviso-discord.sh` § 429 y errores |
| A6 | La dirección no aparece en ninguna salida, argumento de curl ni evidencia, ni siquiera cuando curl falla con un error que la trae | las dos pruebas; mutantes «la dirección como argumento», «errores de curl a la vista», «anota la dirección del webhook» |
| A7 | Kuma documentado hacia `#salud`; la carpeta `uptime-kuma/` ya no dice Telegram como canal vigente | `infra/ops/uptime-kuma/README.md`, comentario de `compose.yml` |
| A8 | Runbook con lo que crea Sam, dónde pega la llave, prueba de ida y vuelta y vuelta atrás | [avisos-servidor-discord.md](../../runbooks/avisos-servidor-discord.md) |
| A9 | Las pruebas corren en el CI Linux | `prueba-aviso-discord.sh` en `infra/ops/tests/pruebas-linux.sh` (contrato de `scripts/__tests__/ci-workflow-contract.test.mjs`) |

`done` exige además la instalación en el VPS, la prueba de ida y vuelta de Sam en los dos canales y la configuración de Kuma. Se registran en el handoff y en el runbook, no en esta PR.

## Riesgos

- **Discord caído durante un incidente.** Kuma sigue con su propio estado en el panel, y el journal tiene cada aviso. El corte directo fue decisión de Sam.
- **Webhook borrado o filtrado.** Un 401/404 sale como «rechazado (HTTP …)» en el log. Rotar = borrar el webhook en Discord, crear otro y pegarlo (runbook § 2).
- **Vuelta atrás a Telegram** depende de que el bot de la app siga vivo (SDD-0606).
