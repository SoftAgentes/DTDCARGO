# Handoff · SDD-0564 — paso 4: Paperclip en el VPS de agentes

| Campo | Valor |
|---|---|
| Task ID | `2026-10-20-sdd-0564-vps-paso-4-paperclip` |
| Owner / sesión | Worker «Oficina Paperclip» (Claude Code) · claim `oficina-paperclip` |
| Worktree / rama | `DTD-worktrees/oficina-paperclip-vps-paso-4` · `codex/oficina-paperclip-vps-paso-4` desde `origin/main` `2e0bc4ee` |
| SDD | [0564](../../docs/specs/0564-instalacion-piloto-paperclip-hermes/spec.md), §D3 y §D9 paso 4 |
| Relacionado | Los pasos 1 a 3 están en la PR #294 (`.agents/handoffs/2026-10-20-sdd-0564-vps-pasos-1-2.md`) |
| Estado | paso 4 hecho; Hermes y modelos **sin** instalar ni conectar |

## Autorización (literal)

Sam, 2026-10-20: «Sí, arranca el paso 4 de la SDD-0564: instala Paperclip con versión fijada,
telemetría apagada y modo privado. Todavía no instales Hermes.»

## Qué se instaló y cómo

| Pieza | Estado |
|---|---|
| Node.js | 24.22.0 en `/opt/node`, desde nodejs.org; el archivo coincidió con `SHASUMS256.txt` (no se verificó la firma GPG de ese archivo) |
| Paperclip | **2026.1012.0, fijado**, con el instalador oficial (`paperclipai install --version 2026.1012.0`), canal `pinned`, para el usuario `agentes`. Es posterior a todos los avisos de seguridad publicados (el último se corrigió en 2026.416.0) |
| Scripts de npm | En la primera instalación por npm se permitió solo el de `@embedded-postgres/linux-x64`; `ssh2` y `protobufjs` quedaron bloqueados. Esa copia de npm después se quitó y quedó solo la instalación oficial |
| Servicio | `systemd --user` de `agentes` (`paperclip.service`), con `linger`; arranca solo con el VPS |
| Base de datos | PostgreSQL embebido, en `127.0.0.1:54329` y `[::1]:54329`; respaldo interno cada 60 min con 30 días de retención |

## Configuración de seguridad (§D3)

| Ajuste | Valor comprobado |
|---|---|
| Modo | `authenticated` + `private` (lo confirma `/api/health`) |
| Escucha | solo `127.0.0.1:3100`; nada publicado hacia internet. Se entra por túnel SSH (`ssh -L 3100:127.0.0.1:3100`) |
| Telemetría | **apagada**: `telemetry.enabled=false` en `config.json` y `PAPERCLIP_TELEMETRY_DISABLED=1` y `DO_NOT_TRACK=1` en el entorno del servicio |
| Latidos | `HEARTBEAT_SCHEDULER_ENABLED=false` hasta que existan agentes |
| Registro de cuentas | **cerrado** (`auth.disableSignUp=true`) después de que Sam creara su cuenta |
| Dueño | Sam reclamó la instancia con el enlace de alta de un solo uso, que ya quedó consumido (`bootstrapStatus: ready`, `bootstrapInviteActive: false`) |
| Secretos | `BETTER_AUTH_SECRET`, `PAPERCLIP_AGENT_JWT_SECRET` y `PAPERCLIP_TOOL_ACTION_SIGNING_SECRET` se generaron en el servidor con `openssl rand` y no se imprimieron. Están en `~/.config/paperclip/paperclip.env` (600). La llave maestra está en `secrets/master.key` (600) |

## Incidentes

- La sesión escribió un valor no válido en `$meta.source` del `config.json` y el servicio no
  arrancó hasta corregirlo a `configure`.
- El chequeo de Paperclip rechazó la copia instalada con npm porque faltaba el manifiesto de
  instalación administrada. Se resolvió con el instalador oficial, con la misma versión.

## Pendientes de esta tarea

- **Respaldar la llave maestra** de Paperclip fuera del VPS, en el gestor de contraseñas de
  Sam (§D2.9). Hay que copiarla por un canal seguro, nunca por el chat.
- El asistente de Paperclip pide «Connect a model». **No se conectó:** es el paso 6 y lo
  decide Sam. Esa pantalla ofrece la suscripción personal de Claude, distinta de lo decidido
  (GLM de Z.AI y una llave de Anthropic con límite).
- `/api/health` informa una advertencia del respaldo interno de la base. Hay que revisarla
  antes de cargar datos.

## Handoff al Director

- Sin secretos en este documento: ni el enlace de alta, ni claves, ni contraseñas.
- Siguientes pasos de la SDD-0564, cada uno con OK de Sam: paso 5 (Hermes) y paso 6 (modelos).
