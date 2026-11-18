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

## TERCERA VUELTA · 2026-11-07 (la #404 queda como base; se suma lo útil de la #421)

**Runbook § 3:**

- Lectura previa: `antes.txt` con `stat` y sha256, `CONGELADO`, el timer y los nombres de las variables de `publicar.env`, sin valores. **PARAR** si el `publicar-web.sh` instalado no es `f71d27594e568f2b`.
- Huellas de referencia, `git log ea8ca60d7..M` y paquete desde Git Bash con `MSYS_NO_PATHCONV=1` y `git cat-file blob`.
- Carpeta de evidencia `instalar-avisos-discord-<UTC>` en 700, con `despues.txt`, `MANIFIESTO`, `SHA256SUMS` y `grep -c webhooks` = 0 sobre los `.txt` y el manifiesto. No sobre el paquete: sus guiones nombran la palabra en el código.
- Cada temporal pasa `cmp` y `bash -n` antes del `mv`.
- La #403 queda como opción aparte, con OK del DG y `free -m`.

**§ 4 y § 6 corregidos:**

- **Por dónde sale hoy `mail-health` en producción:** «no medido». Depende de si la web publicada es anterior a la #380 y de si `TELEGRAM_BOT_TOKEN` sigue en el `.env`.
- **Script viejo:** sin `PUBLICAR_TELEGRAM_*`, no avisa aunque el token siga en el `.env`. El 01-nov ya decía «SIN CONFIGURAR».
- **Vuelta atrás:** huella esperada `f71d…`, y `publicar.env` vuelve por un temporal en 600 con `mv`.

**Huellas medidas por mí** (sha256, primeros 16):

| Archivo | Commit | Huella |
|---|---|---|
| `publicar-web.sh` | `ea8ca60d7` | `f71d27594e568f2b` |
| `publicar-web.sh` | `7e75f7708` | `1863b76e71e9f8f8` |
| `publicar-web.sh` | `eef75ebef` | `1863b76e71e9f8f8` |
| `aviso-discord.sh` | `7e75f7708` | `70639acad24ef26b` |
| `aviso-discord.sh` | `eef75ebef` | `70639acad24ef26b` |
| `publicar-web.sh` (#403) | `451363eb8` | `467c5f634af842a8` |
| `guardar-webhook-discord.sh` | `2cf8a60cc` | `fbe2b697bf3aecf1` (**vencida**: la de `b2d26ba80` era `ac56fa683fbca085`. Ya no se fija: ver la quinta vuelta) |

Entre `ea8ca60d7` y `7e75f7708`, el único commit en `publicar-web.sh` es `f69d520b4`. Coincide con lo que dijo el Subdirector.

**Pregunta de la cola de la 0606, medida.** `ALERT_OUTBOX_CATEGORIES` (`lib/studio/alerts/alert-outbox.ts:36-40`) solo decide qué categorías se reintentan por la cola durable: registro, bugs y reportes. Conversaciones y equipo **sí tienen uso**: salen directo por `dispatchAlert`. En `main` `eef75ebef` hay 2 llamadas con «conversaciones» y 9 con «equipo», entre ellas `mail-health` y `alta-health`. Lo que no tienen es reintento por la cola. Por eso sus webhooks hacen falta.

**Canales de Operación, medidos en Discord** (2026-11-07, solo lectura, con la sesión de Sam en el panel):

| Canal | ID |
|---|---|
| `#registro-clientes` | `1567954867878629406` |
| `#conversaciones-portal` | `1567954948333768854` |
| `#bugs` | `1567955017237921883` |
| `#reporte-diario` | `1567955085550428251` |
| `#avisos-equipo` | `1567955151493271785` |

- **El guion exige ahora el `channel_id` exacto en los seis destinos.** Se quitaron la comprobación por nombre, la del servidor y la lista de canales ajenos de la segunda vuelta: el ID exacto las cubre todas, y Sam puede poner cualquier nombre.
- **Webhooks existentes:** `#registro-clientes` tiene 0. Los otros cuatro no se alcanzaron a abrir.
- **Prueba:** 29 PASÓ · 0 FALLÓ · 1 NO VERIFICADO.
- **Mutantes puntuales:** «sin comprobar el canal» da 24/8 y «equipo con el canal de reportes» da 28/1. Los dos MUERTOS.

## FUERA DE ALCANCE DETECTADO

- **`docs/runbooks/chatwoot-vigilancia.md`** todavía dice «Telegram» en los 4 monitores de Kuma de Chatwoot. Desde el 2026-11-06 avisan a Discord `#salud`. Es del Subdirector de Chatwoot.
- **La cola de la 0606** no reintenta conversaciones ni equipo. Si Discord falla, esos avisos no se guardan para después. Decide el DG si entra en otra SDD.
- **Los avisos de correo** van a `#avisos-equipo` y no a `#salud`, como dicen el plan maestro y la 0610. Ver la segunda vuelta.

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

> Desde la tercera vuelta el comando lleva el destino de cada fila, y desde la quinta hay una comprobación de `known_hosts` antes de la fila 1. Lo vigente está en el runbook, § 1 B.

- **Sin `sudo`:** el acceso es como root con la llave del agente de Windows.
- **Sin `-t`:** así la entrada estándar es el portapapeles.

## FUERA DE ALCANCE DETECTADO

- Ninguno nuevo.

## CUARTA VUELTA · 2026-11-07 (revisión de la sesión de la #421)

- **Paso 1:** define `M=` también en el VPS, comprueba que sea un sha de 40 y lo anota en `antes.txt`.
- **Paso 6:** `despues.txt` lleva `M`. El `MANIFIESTO` usa `${M:?…}`: con `M` vacío no se escribe, en lugar de quedar con `M=` en blanco.
- **Paso 2:** ahora es la función `instalar_guiones`, que vuelve al primer `PARAR`. Si el paquete no coincide con `SHA256SUMS`, no se instala nada. Si falla un guion, no se instala ni ese ni los que siguen, y la salida dice cuáles entraron. Usa `return` y no `exit`, para no cerrar la sesión de root.
- **Prueba nueva:** `infra/ops/tests/prueba-runbook-avisos-discord.sh`, registrada en `pruebas-linux.sh`. Corre el bloque del runbook tal cual, ubicado por la marca `<!-- bloque:instalar-guiones -->` y con un piso de 10 líneas. Da 5 PASÓ · 0 FALLÓ.
- **Mutantes sobre el runbook**, los tres MUERTOS: el bucle sigue después de PARAR (4/1), el paquete alterado no corta (4/1) y sin `cmp` ni `bash -n` (3/2).

## QUINTA VUELTA · 2026-11-09 (CHANGES_REQUESTED de la revisión independiente del DG sobre `e618a61bb`)

Escribe la sesión `heuristic-boyd-faed9b` (la de la #421), por encargo del Subdirector, como **único escritor** de la #404. Rama local `claude/0609-guardar-webhook`, desde `origin/codex/guardar-webhook-discord` `b2d26ba80`. El worktree de Codex no se tocó.

**Bloqueantes:**

1. **Huella vencida.** El runbook (`:140`) y este handoff (`:62`) decían `fbe2b697bf3aecf1`, la huella de `2cf8a60cc`. En `b2d26ba80` mide `ac56fa683fbca085`, y con esta vuelta vuelve a cambiar. Ya no se fija: la fila de la tabla dice «sin valor fijo», y el paso 0 imprime la huella desde `M` con `git cat-file`. El paso 0 también pide `git log 7e75f7708..$M -- aviso-discord.sh` vacío.
2. **`known_hosts`, § 1 B antes de la fila 1:**
   - `ssh-keygen -F 217.216.54.70`;
   - si no aparece, un `ssh … exit` y comparar la huella con la que el DG lee en el VPS (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`) y le pasa a Sam;
   - **PARAR** con «REMOTE HOST IDENTIFICATION HAS CHANGED»;
   - nunca `StrictHostKeyChecking=no` ni `accept-new`.
3. **Alcance:**
   - **SDD-0609:** alcance 6 y 7 (el guion escribe en `publicar.env` y en `/srv/dtd-cargo/.env`, solo las cinco `DISCORD_WEBHOOK_*`); lo fuera de alcance, desglosado; D8; criterios A10 a A14; un riesgo nuevo (los dos guiones a la vez).
   - **SDD-0606:** en D1 y en el paso 3 del corte, el cambio de procedimiento. Las cinco direcciones se pegan con el guion; `DISCORD_TENANT_ID` sigue con `env-set.sh`, después de las cinco y nunca a la vez.

**No bloqueantes:**

1. **`trap`:** `limpiar` borra `${nuevo}`, el temporal con todas las llaves, además de `${T}`. Se quitó un `trap 'exit 1' INT TERM HUP`: el mutante que lo borraba sobrevivió, porque bash ya corre el trap de EXIT cuando recibe TERM (medido en Git Bash; el CI Linux lo vuelve a medir con la prueba «cortado»).
2. **Vuelta atrás del `.env`:** el bloque `volver_env` del § 6, marcado `<!-- bloque:volver-env -->`.
   - Elige el respaldo por el sha256 que anotó `antes.txt`, no por nombre ni por fecha.
   - Avisa que se pierden también los cambios intermedios.
   - Guarda el archivo de ese momento como `.antes-vuelta-<UTC>-<sufijo>`.
   - Para sin tocar nada si falta la huella o el respaldo.
   - Los respaldos del guion llevan ahora un sufijo de `mktemp`: dos corridas en el mismo segundo no se pisan.
3. **Evidencia:** `antes.txt` y `despues.txt` incluyen `stat` y sha256 de `/srv/dtd-cargo/.env`. De los dos archivos de variables se guardan **solo los nombres**, con `grep -oE '^…[A-Za-z_][A-Za-z0-9_]*='`, sin valores ni comentarios.
4. **Paquete al VPS:** comando literal con `scp.exe` de Windows a `/root/paquete-0609-<12 del sha>`, y en el VPS `install -m 600` a `$E/paquete` con `sha256sum -c` antes de borrar la copia.
5. **`flock`:** se eligió el orden explícito (§ 2 «Un guion a la vez», pasos 3 y 7, D8). Un candado común obligaba a tocar `env-set.sh`, y Git Bash no trae `flock`.
6. **`grep`:** en `prueba-guardar-webhook-discord.sh`, el `\|` de las líneas 110, 177 y 179 pasó a `grep -F -e … -e …`. `\|` en un patrón básico es extensión de GNU.
7. **Historial de PowerShell:** un aviso en el § 1 B. Si la dirección se pegó en la línea de comandos, rotar ese webhook y borrar la línea del historial.
8. **`:55`:** el guion se instala en el paso 2, no en el 1.
9. Este handoff, puesto al día.

**Validación** (Git Bash, en la PC; ni `verify` ni Docker ni el VPS):

| Comprobación | Resultado |
|---|---|
| `bash infra/ops/tests/prueba-guardar-webhook-discord.sh` | **PASÓ**: 31 PASÓ · 0 FALLÓ · 1 NO VERIFICADO (los permisos 600 en Windows). Antes daba 29/0/1; las dos nuevas son «mismo segundo» y «cortado con TERM» |
| `bash infra/ops/tests/prueba-runbook-avisos-discord.sh` | **PASÓ**: 12 PASÓ · 0 FALLÓ. Antes daba 5/0; las siete nuevas son del bloque `volver-env` |
| Mutantes del guion | m1, `limpiar` sin `${nuevo}`: 30/1, **MUERTO**. m2, respaldo con nombre fijo: 30/1, **MUERTO**. m3, sin `trap 'exit 1' …`: 31/0, **SOBREVIVIÓ**, y la línea se quitó (no bloqueante 1) |
| Mutantes del bloque `volver-env` | r1, el primer respaldo sin mirar la huella: 10/2. r2, sin AVISO: 10/2. r3, sin guardar el archivo actual: 11/1. r4, sin exigir la huella: 11/1. Los cuatro **MUERTOS**. El control sin mutación dio 12/0 |
| `node scripts/build-docs-index.mjs --check` (`docs:check`) | **PASÓ**: 602 specs |
| `node scripts/check-numbering.mjs` (`sdd:check`) | **PASÓ**: solo los choques históricos 0342, 0363 y 0394 |
| `node scripts/build-governance-capsule.mjs --check` (`governance:check`) | **PASÓ**: 28 políticas, cápsula vigente |
| `bash -n` del guion y de `pruebas-linux.sh`; `git diff --check` | **PASÓ** |
| `ci-workflow-contract.test.mjs` | **NO DISPONIBLE** en la PC (sin `node_modules`). Lee la lista `PRUEBAS` sin los comentarios; solo cambió un comentario. Lo corre el CI |
| Comandos del runbook en el VPS | **NO EJECUTADO**: la tarea prohíbe tocar producción |

**Fuera de alcance detectado:**

- **SDD-0606, «Vuelta atrás entre los pasos 3 y 7»:** dice «todo vuelve a Telegram», pero D8 retiró Telegram del Studio. No lo toqué: es de la 0606.
- **`env-set.sh`** escribe los valores entre comillas simples; el guion los escribe sin comillas. Compose lee las dos formas y una dirección de webhook no tiene `$` ni comillas. No es un fallo; queda anotado por si alguien compara los archivos línea por línea.
