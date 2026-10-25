# Handoff · SDD-0564 — aislamiento de los agentes (fases A y B)

| Campo | Valor |
|---|---|
| Task ID | `2026-10-20-sdd-0564-vps-aislamiento-fases-a-b` |
| Owner / sesión | Worker «Oficina Paperclip» (Claude Code) · claim `oficina-paperclip` |
| Rama | `codex/oficina-paperclip-vps-paso-6` (PR #296) |
| SDD | [0564](../../docs/specs/0564-instalacion-piloto-paperclip-hermes/spec.md), §D10 (hueco) |
| Estado | fases A y B aplicadas y probadas a nivel del sistema; la prueba dentro de Paperclip con un agente de prueba sigue pendiente |

## Autorizaciones (literales)

- Investigar: «Cierra el hueco con un usuario aparte para los agentes, sin acceso a los secretos de Paperclip ni a las llaves. Investiga primero si Paperclip lo permite y propónmelo antes de cambiar nada.»
- Aplicar: «Apruebo la fase A (quitar BETTER_AUTH_SECRET del entorno; vuelvo a entrar al panel) y la fase B (usuario agentes-run con envoltorios, su propia sesión de Codex, carpeta de trabajo compartida y prueba de que no lee los secretos). Primero la A.»

## Hallazgo de la investigación

Paperclip lanza a los agentes con su propio entorno pasado por un filtro que **solo quita las
variables que empiezan con `PAPERCLIP_`**. Por eso `BETTER_AUTH_SECRET` (la que firma las sesiones del
panel) llegaba a todos los agentes. Es un defecto de seguridad de Paperclip; se le sugirió a Sam
reportarlo en privado a sus mantenedores. Los detalles explotables no van en este repositorio.

## Fase A (2026-10-20)

- Se quitó `BETTER_AUTH_SECRET` del entorno del servicio; quedó un respaldo 600 junto al archivo. El
  servidor usa `PAPERCLIP_AGENT_JWT_SECRET`, que el filtro sí quita.
- Comprobado: el servicio arrancó limpio (`/api/health` ok), la variable no está en el proceso ni en
  sus hijos, y **Sam volvió a entrar al panel** («Sí, entré de nuevo al panel de Paperclip sin
  problemas»).
- Variables del servidor que no empiezan con `PAPERCLIP_` (solo nombres): `HOST`, `PORT`,
  `DO_NOT_TRACK` y `HEARTBEAT_SCHEDULER_ENABLED`. Ninguna es sensible.

## Fase B (2026-10-20)

| Pieza | Estado |
|---|---|
| Usuario `agentes-run` | uid 1003, grupo `oficina`, sin `sudo`, sin shell de entrada, home 750 |
| Grupo `oficina` | `agentes` y `agentes-run` |
| Carpeta de trabajo | `/srv/oficina/trabajo`, `agentes-run:oficina`, 2770 |
| Herramientas | Codex 0.163.0 y Claude Code 2.1.304 en `/opt/agentes-cli`, de root y legibles por todos |
| Envoltorios | `/usr/local/bin/dtd-codex` y `/usr/local/bin/dtd-claude` → `sudo -n -u agentes-run /usr/local/libexec/dtd-agente-run` (de root, 755), que fija `HOME`, `PATH`, `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, `umask 007` y apaga la telemetría |
| sudoers | `/etc/sudoers.d/91-agentes-run`: `agentes` solo puede ejecutar el envoltorio como `agentes-run`; `env_reset` y `env_keep = "PAPERCLIP_* TERM LANG LC_ALL LC_CTYPE"`; validado con `visudo -c` |
| Sesión de Codex propia | copia de la sesión de ChatGPT en `/home/agentes-run/.codex/auth.json` (600) |
| AppArmor | perfil `/etc/apparmor.d/opt.agentes-cli.codex-bwrap` **solo** para el `bwrap` de Codex 0.163.0, porque Ubuntu 24.04 restringe los espacios de nombres sin privilegios. **Si se actualiza Codex, cambia la ruta y hay que rehacer el perfil** |

## Pruebas (2026-10-20, sin usar el modelo)

| Prueba | Resultado |
|---|---|
| `agentes-run` lee 8 secretos (`paperclip.env`, `master.key`, `config.json`, las llaves de Z.AI y Anthropic, `.hermes/.env`, la sesión de Codex de Paperclip y la llave de GitHub) | **Permission denied** en los 8; tampoco puede listar `/home/agentes` ni su repositorio |
| Variables que cruzan el envoltorio (con `BETTER_AUTH_SECRET` y `FOO_SECRET` de señuelo) | Solo `PAPERCLIP_API_KEY` y `PAPERCLIP_RUN_ID`, más las del sistema y las que fija el envoltorio. Los señuelos **no** pasaron |
| Sandbox de Codex (`workspace-write`): leer un secreto de `agentes` | Permission denied |
| Sandbox: leer su propia sesión de Codex | La lee (esperado: la necesita) |
| Sandbox: salida a internet | **Bloqueada** (`curl` → `000`) |
| Sandbox y carpeta de trabajo | Escribe y lee bien; los dos usuarios comparten archivos |
| La sesión de Codex por el envoltorio | «Logged in using ChatGPT» |

## Límites (dichos a Sam tal cual)

- El aislamiento protege la llave maestra, la configuración de Paperclip y las demás llaves. **No
  protege la sesión que la propia herramienta usa**: Codex lee su sesión de ChatGPT. Lo que ayuda es
  el sandbox sin red y que el agente no tenga lectura libre fuera de su espacio de trabajo.
- La sesión de ChatGPT existe dos veces: la de Paperclip, en `agentes`, y la copia de
  `agentes-run`. Si una renueva su token, **la otra puede invalidarse**; habría que volver a copiarla.

## Pendientes

- **Prueba dentro de Paperclip con un agente de prueba sin acceso al repositorio**: configurar
  `command`/`agentCommand` = `dtd-codex`, `cwd` dentro de `/srv/oficina/trabajo`, el bypass apagado y
  la red del sandbox apagada. **NO VERIFICADO** todavía: el motor ACP por defecto, los enlaces de
  skills y los permisos de los espacios de trabajo que crea Paperclip.
- Claude Code por el envoltorio cuando Sam inicie sesión, con su propio sandbox por revisar.
- Reporte privado a Paperclip, si Sam lo autoriza.
