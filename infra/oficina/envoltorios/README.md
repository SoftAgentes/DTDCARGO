# Envoltorios de los motores de la oficina (SDD-0615)

Paperclip corre como el usuario `agentes`. Cada agente corre a través de un envoltorio, con
`cwd=/srv/oficina/trabajo/<perfil>` y `env.DTD_PERFIL=<perfil>`, bajo uno de tres usuarios:

| Usuario | Quién corre |
|---|---|
| `agentes-run` | Los agentes de Hermes (GLM) |
| `agentes-alfred` | ALFRED (Claude Code) |
| `agentes-auxiliar` | El Auxiliar (Codex) |

Ningún usuario puede leer las credenciales, la configuración ni los procesos de otro. Esta
carpeta versiona los envoltorios de los dos motores nuevos y el `dtd-agente-run` que todos
comparten.

| Archivo | Dónde se instala | Qué hace |
|---|---|---|
| `dtd-claude` | `/usr/local/bin/dtd-claude` (root, 755) | `command` de ALFRED (`claude_local`). Llama a `dtd-motor claude` |
| `dtd-codex` | `/usr/local/bin/dtd-codex` (root, 755) | `command` del Auxiliar (`codex_local`). Llama a `dtd-motor codex` |
| `dtd-motor` | `/usr/local/libexec/dtd-motor` (root, 755) | Corre como `agentes`. Revisa la lista cerrada (`claude:ceo` → `agentes-alfred`, `codex:auxiliar` → `agentes-auxiliar`). Copia a `/srv/oficina/staging/<perfil>/run.*` lo que Paperclip pasa como rutas de `/home/agentes/` y quita `--mcp-config`. Después ejecuta `sudo -n -u <usuario> dtd-agente-run`. Sin la carpeta de staging del perfil sale con 65 |
| `dtd-agente-run` | `/usr/local/libexec/dtd-agente-run` (root, 755) | Tiene una tabla cerrada de herramienta, perfil y usuario. Toma `HOME`, `CLAUDE_CONFIG_DIR` y `CODEX_HOME` del usuario y fija la carpeta de trabajo de Claude y Codex. Borra las llaves de API; solo Claude recibe `CLAUDE_CODE_OAUTH_TOKEN`. La rama `hermes` es la misma que la del VPS al 2026-11-06 15:22 UTC |
| `91-agentes-run` | `/etc/sudoers.d/91-agentes-run` (root, 440) | Con `env_reset`, deja pasar solo `PAPERCLIP_*`, `DTD_PERFIL`, `CLAUDE_CODE_OAUTH_TOKEN` y las variables de idioma. Con `!log_allowed`, sudo deja de copiar el prompt al registro. `agentes` puede cambiar solo a los tres usuarios, y solo para `dtd-agente-run` |

`dtd-hermes` no cambia.

## Por qué hace falta copiar archivos

Paperclip pasa por ruta tres cosas que viven en `/home/agentes/.paperclip`, una carpeta con
permisos 700 que `agentes-run` no puede leer:

- las instrucciones (`--append-system-prompt-file`);
- las skills (`--add-dir`);
- la configuración de MCP.

Por eso falló `prueba-opencode` el 2026-10-20. El servidor MCP de Paperclip también vive ahí, así
que se quita `--mcp-config`: ALFRED usa la API con `curl` y la skill `paperclip`.

## Instalar

El orden completo está en la [SDD-0615](../../../docs/specs/0615-oficina-motores-claude-codex/spec.md#orden-de-instalación).
En el VPS de la oficina se instala desde el commit revisado y con respaldo.

1. **Respaldar los archivos que se reemplazan:** `/usr/local/bin/dtd-{claude,codex}`,
   `/usr/local/libexec/dtd-agente-run` y `/etc/sudoers.d/91-agentes-run`.
2. **Comparar el `dtd-agente-run` vivo con el que se usó de base** (su sha256 está en el
   handoff). Si cambió, se fusiona a mano antes de seguir.
3. **Crear los usuarios.**
   - `agentes-alfred` y `agentes-auxiliar`, cada uno con su grupo y con home 700.
   - Ninguno de los dos entra en el grupo `oficina`. La biblioteca es `root:root 2755` y se lee
     sin él, mientras que el grupo daría acceso a `/srv/oficina/trabajo`, la carpeta de los GLM
     (`agentes-run:oficina 2770`, medido el 2026-11-06).
   - Su carpeta de trabajo (`ceo` pasa a `agentes-alfred`, y se crea `auxiliar`) queda con
     dueño propio, el grupo del motor, permisos 2770 y git local.
   - `agentes` entra en los grupos `agentes-alfred` y `agentes-auxiliar`, porque Paperclip
     escribe `.paperclip-runtime/` en la carpeta de trabajo. `agentes-run` no entra.
   - La vuelta atrás a Hermes devuelve `ceo` a su dueño anterior. Se anota antes de cambiarlo.
4. **Crear el staging.**
   - `/srv/oficina/staging`, con dueño `root:root` y permisos 755.
   - `/srv/oficina/staging/ceo`, con dueño `agentes:agentes-alfred` y permisos 2750.
   - `/srv/oficina/staging/auxiliar`, con dueño `agentes:agentes-auxiliar` y permisos 2750.
5. **Copiar los archivos de esta carpeta** con su dueño y sus permisos, y comprobar que el sha256
   de cada uno es el del commit.
6. **Comprobar el sudoers** con `visudo -cf /etc/sudoers.d/91-agentes-run`.
7. **Preparar la configuración de cada motor.**
   - `~agentes-alfred/.claude/settings.json`, que sale de `claude-settings.json`, con dueño
     `root:agentes-alfred` y permisos 640. Es defensa en profundidad: el agente no lo puede
     escribir, pero sí podría renombrarlo dentro de su carpeta.
   - La skill `paperclip` en `~agentes-auxiliar/.codex/skills/`.
8. **Probar como `agentes`:** `DTD_PERFIL=ceo /usr/local/bin/dtd-claude --version` y
   `DTD_PERFIL=auxiliar /usr/local/bin/dtd-codex --version`. Después comprobar como
   `agentes-run` que no puede listar `~agentes-alfred` ni `~agentes-auxiliar`.

## Pruebas

- **Pruebas:** `python -I -B -m unittest discover -s infra/oficina/envoltorios/tests -v`.
  También corren desde el harness, en `scripts/tests/oficina-envoltorios.node.mjs`. En Linux no
  se salta ninguna.
- **Mutantes:** `python -I -B infra/oficina/envoltorios/tests/mutantes.py`. Los dos marcados
  «solo Linux» corren en el VPS o en el CI.
