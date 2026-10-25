# Handoff · SDD-0564 — paso 5: Hermes en el VPS de agentes

| Campo | Valor |
|---|---|
| Task ID | `2026-10-20-sdd-0564-vps-paso-5-hermes` |
| Owner / sesión | Worker «Oficina Paperclip» (Claude Code) · claim `oficina-paperclip` |
| Worktree / rama | `DTD-worktrees/oficina-paperclip-vps-paso-5` · `codex/oficina-paperclip-vps-paso-5` desde `origin/main` `2e0bc4ee` |
| SDD | [0564](../../docs/specs/0564-instalacion-piloto-paperclip-hermes/spec.md), §D4 y §D9 paso 5 |
| Relacionado | Pasos 1 a 3 en la PR #294; paso 4 (Paperclip) en la PR #295 |
| Estado | paso 5 hecho; **sin modelo conectado** y sin mensajería |

## Autorización (literal)

Sam, 2026-10-20: «Sí, arranca el paso 5 de la SDD-0564: instala Hermes fijado, con backend
Docker y herramientas recortadas, sin modelo conectado todavía.»

## Instalación

| Pieza | Estado |
|---|---|
| Método | Script oficial `install.sh` de hermes-agent.nousresearch.com. La sesión lo leyó antes de ejecutarlo (1.298 líneas; sha256 empieza con `20f44240ebada354`) y corrió **esa misma copia** como el usuario `agentes`, sin `sudo` |
| Versión | **Hermes Agent v0.22.2, fijado al commit `d923a5eb487a17c0a68801bba9ef0f56c81040a8`** (la etiqueta `v0.22.2` de GitHub, publicada el 2026-10-15), con `--commit`; queda en estado «detached», sin seguir una rama |
| Opciones | `--skip-browser` (sin Chromium ni Playwright) y `--non-interactive` (sin asistente ni mensajería) |
| Por qué no PyPI | El paquete `hermes-agent` de PyPI está en 0.19.0, atrasado frente a GitHub |
| Dependencias que bajó el script | uv 0.12.3 (verificado por su sha256 interno), Python 3.14.7 privado, ripgrep, ffmpeg y las dependencias de Python verificadas por hash (`uv.lock`) |
| Librería del sistema | `libatomic1` (instalada con `sam`): la necesita el Node que trae Hermes |
| No instalado | `cua-driver` (control de pantalla) falló por una librería gráfica ausente y **se dejó así a propósito** |

## Configuración (§D4)

| Ajuste | Valor comprobado |
|---|---|
| Ejecución de comandos | `terminal.backend: docker` y `TERMINAL_ENV=docker`. Usa el Docker **sin privilegios** de `agentes` (contexto `rootless`) |
| Herramientas activas | `web`, `file`, `skills`, `todo`, `memory`, `session_search`, `clarify` |
| Herramientas apagadas | `terminal`, `browser`, `code_execution`, `computer_use`, `cronjob`, `connections`, `image_gen`, `tts`, `vision`, `delegation` (además de las que ya venían apagadas) |
| Telemetría | `telemetry.shared_metrics.enabled: false` y `send: false` (ya venía así; se dejó fijo) |
| Búsqueda de actualizaciones | `updates.check: false`; la versión solo cambia con `hermes update` a mano |
| Mantenimiento automático de skills | `hermes curator pause` |
| Modelo | **ninguno conectado**: no hay llaves en `.env` (600) ni `auth.json`. El `config.yaml` trae un modelo de ejemplo por defecto, sin credenciales, que no funciona |
| Servicio y puertos | Hermes no corre como servicio ni abre puertos; la mensajería (gateway) y su servidor de API no se instalaron |

## Pendientes

- **Paso 6 (modelos):** la llave de Z.AI (GLM) y la de Anthropic con límite las crea y carga
  Sam en el VPS. Después se ajusta `model` en `config.yaml` y se conecta Hermes con Paperclip
  (`hermes_local`).
- Elegir la imagen del contenedor de Docker de Hermes (el valor por defecto es una imagen de
  terceros) antes de activar una herramienta que lo use.
- Las tareas programadas de Hermes (`cron`) están apagadas como herramienta. Revisar si su
  programador interno arranca solo cuando Hermes corra como servicio.

## Handoff al Director

- Sin secretos en este documento.
- Siguiente paso de la SDD-0564, con OK de Sam: el paso 6 (modelos y topes de gasto).
