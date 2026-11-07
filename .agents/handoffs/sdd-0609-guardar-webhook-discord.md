# Handoff — SDD-0609 · Guion para guardar el webhook de `#publicaciones` sin pasar por el chat

Fecha: 2026-11-06. Task ID: `sdd-0609-guardar-webhook-discord`.
Owner / sesión escritora: `local_d3ee839a-webhook` (Worker Claude Code), por encargo del Subdirector `local_61442abe-3b66-423e-9af4-8008d5457aa3`. Es la prioridad 5 del Director General.

- **Worktree:** `DTD-worktrees/guardar-webhook-discord`.
- **Rama:** `codex/guardar-webhook-discord`, desde `origin/main` `14040bb87`.
- **SDD:** 0609, el mismo corte a Discord. No hay número nuevo.

## SEGUNDA VUELTA · 2026-11-07 (encargo del Subdirector, línea del Director General)

Pedido: el guion de instalación de la 0609 en el VPS; una lista única de lo que Sam crea o pega; el estado de `#salud` y de los avisos de correo; el estado de la #403 y la #404. Sin ejecutar nada en producción. Gate: CI de GitHub, revisión independiente y lectura del DG. Ni `verify` ni build en la PC.

**Qué cambió:**

- **`guardar-webhook-discord.sh` ahora tiene un destino.** Por defecto es `publicaciones`, que se comporta como antes. Los otros cinco son del Studio de la 0606: `registro`, `conversaciones`, `bugs`, `reportes` y `equipo`, en `/srv/dtd-cargo/.env`, cada uno con su variable `DISCORD_WEBHOOK_*`.
  - **Por qué:** la 0606 pedía pegarlos con `env-set.sh`, que usa `read -s` dentro de `ssh -t`. Es el camino que falló en la oficina, y así Sam recibe un solo pedido.
  - **Cómo se valida el canal:** los IDs de los canales de Operación no están en el repo y no se pudieron medir. Discord pidió sesión en el panel y Claude in Chrome no estaba conectado. Por eso el guion exige el servidor «DTD Cargo», el nombre del webhook que pide el runbook y un canal que no sea de Servidor u Oficina.
  - **Qué toca:** solo reemplaza su variable. No toca `TELEGRAM_BOT_TOKEN` y respalda `.env.antes-0606-<fecha>`.
- **Runbook `avisos-servidor-discord.md`, reescrito:**
  - § 0 estado;
  - § 1 la lista única para Sam: cinco webhooks con nombre exacto y seis vueltas de pegado en orden;
  - § 2 qué hace el guion;
  - § 3 el guion de instalación por pasos, con hashes, candado y la prueba real con `aviso-discord.sh --probar`;
  - § 4 `#salud` y los avisos de correo;
  - § 5 y § 6 las salidas y la vuelta atrás.
- **Prueba:** `prueba-guardar-webhook-discord.sh` pasa de 23 a 32 PASÓ, con 0 FALLÓ y 1 NO VERIFICADO (los permisos 600 en Windows). Cubre los cinco destinos nuevos, un nombre ajeno, otro servidor, un canal de Servidor u Oficina y un destino desconocido. Además, `ls -A` hace que «sin cambios» mire de verdad el respaldo, que es un archivo oculto.
- **Mutantes puntuales, uno por uno:** sin comprobar el nombre, 31/1; sin comprobar el servidor, 31/1; sin la lista de canales ajenos, 30/2. Los tres MUERTOS.

**Hallazgos para el Director General:**

- **Los avisos de correo** («Correos que no llegaron», cron `mail-health`) van con la categoría `equipo`, así que caen en `#avisos-equipo` y no en `#salud`. El plan maestro dice `#salud`. La SDD-0610 también espera `#salud` «por la cola de la 0606», pero la 0606 no tiene esa categoría. Hace falta decidir y, en su caso, abrir una SDD del Studio.
- **`DISCORD_TENANT_ID`** no es de Sam. Lo pone la sesión de Contabo.
- **La #403 y la #404** estaban verdes y se podían fusionar contra `main` `7e75f7708`. Ninguna de las dos necesitaba traer `main`.

## OBJETIVO ORIGINAL

Un guion para que Sam guarde en el VPS de producción la dirección del webhook de `#publicaciones`. La pide así:

- llega por la entrada estándar: `Get-Clipboard | ssh.exe … guion`, porque `read -s` dentro de `ssh -t` falló en la oficina el 2026-11-05;
- se busca con regex dentro de lo pegado y se normaliza a `discord.com`;
- se valida con un `GET` a Discord que exige el `channel_id` de `#publicaciones`;
- se respalda `publicar.env`, se escribe `PUBLICAR_DISCORD_WEBHOOK`, se quitan las líneas `PUBLICAR_TELEGRAM_*` y el archivo queda en 600 root;
- solo imprime «GUARDADA» o «NO GUARDADA», con el largo y la huella.

También pide las pruebas con un doble de Discord y el runbook del paso 2.

## COMPLETADO

- **`infra/ops/web/guardar-webhook-discord.sh`** (nuevo):
  - **Lectura:** stdin, con un tope de 64 KB.
  - **Búsqueda y normalización:** busca con regex por línea (sin CR) y quita repetidas. Exige exactamente una dirección y normaliza `discordapp.com`, `ptb.`, `canary.` y `/api/vN`.
  - **Validación:** `GET` con la dirección por stdin (`-K -`). Exige HTTP 200, el mismo `id` y `channel_id` `1567955265918079096`.
  - **Escritura:** respalda `publicar.env.antes-0609-<UTC>` en 600 en la misma carpeta y escribe por un temporal con `mv` atómico. `chown root:root` si corre como root.
  - **Salida:** solo `GUARDADA · <n> caracteres · sha256 <12> · …` o `NO GUARDADA: <motivo>`. Con NO GUARDADA no cambia nada.
  - **Argumentos:** si llega uno que no conoce, sale 64 sin repetirlo. Un mensaje de error que repetía el argumento lo encontró la prueba y quedó corregido antes del commit.
- **`infra/ops/tests/prueba-guardar-webhook-discord.sh`** (nueva, sin red), registrada en `pruebas-linux.sh`. El doble de Discord responde por id y da 401 si el token no coincide, como Discord.
- **Runbook** `docs/runbooks/avisos-servidor-discord.md`:
  - el § 2 se reescribió con el comando exacto, el orden (pegar sin Enter, copiar en Discord, Enter) y qué significa cada salida;
  - el § 3 agrega la instalación del guion.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `bash infra/ops/tests/prueba-guardar-webhook-discord.sh` (Git Bash) | **PASÓ**: 23 PASÓ · 0 FALLÓ · 1 NO VERIFICADO. Cubre basura, vacío, formas que no son de Discord, dirección válida de **otro canal** (`#salud`), dos distintas, **caracteres de más** (comillas, espacios, texto, CRLF, marcas de pegado `ESC[200~`, `discordapp.com/api/v10`, `ptb.`), token con letras de más (401), id distinto, 429, 500 y sin red. También la **correcta**: contenido, huella, respaldo, sin temporales y la dirección por stdin. Ninguna salida muestra la dirección |
| Permisos 600 del archivo y del respaldo | **NO VERIFICADO en Windows**. Lo comprueba la misma prueba en el CI Linux |
| `scripts/__tests__/ci-workflow-contract.test.mjs` | **NO DISPONIBLE**: este worktree no tiene `node_modules` y el vitest de otro worktree no resuelve la configuración. La prueba nueva está en la lista `PRUEBAS` de `pruebas-linux.sh`, que es lo que exige ese contrato. Lo corre el CI |
| `bash -n` y `git diff --check` | **PASÓ** |

## PARA SAM, CUANDO TOQUE

Primero, la sesión de Contabo instala el guion (§ 3 del runbook, con el OK del Director General). Después, en PowerShell:

```powershell
Get-Clipboard | C:\Windows\System32\OpenSSH\ssh.exe -o BatchMode=yes root@217.216.54.70 /srv/ops/web/guardar-webhook-discord.sh
```

Se pega sin Enter. Después se copia la URL del webhook en Discord y al final se pulsa Enter.

- **Sin `sudo`:** el acceso es como root con la llave del agente de Windows.
- **Sin `-t`:** así la entrada estándar es el portapapeles.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo.
