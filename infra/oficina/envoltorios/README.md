# Envoltorios de los motores de la oficina (SDD-0615)

Paperclip corre como el usuario `agentes`. Cada agente corre a través de un envoltorio, con
`cwd=/srv/oficina/trabajo/<perfil>` y `env.DTD_PERFIL=<perfil>` en Paperclip, bajo uno de tres
usuarios:

| Usuario | Quién corre | Carpeta donde trabaja |
|---|---|---|
| `agentes-run` | Los agentes de Hermes (GLM) | `/srv/oficina/trabajo/<perfil>` |
| `agentes-alfred` | ALFRED (Claude Code) | `/srv/oficina/motores/ceo` |
| `agentes-auxiliar` | El Auxiliar (Codex) | `/srv/oficina/motores/auxiliar` |

Ningún usuario puede leer las credenciales ni la configuración de otro. **Los procesos sí se
ven:** `/proc` no se monta con `hidepid`, así que cualquiera ve con `ps` los procesos y sus
argumentos.

Esta carpeta versiona los envoltorios de los dos motores nuevos y el `dtd-agente-run` que todos
comparten.

**Por qué los motores no trabajan en `/srv/oficina/trabajo` (revisión del DG, 2026-11-07).**
Esa carpeta es `agentes-run:oficina 2770`, así que cualquier agente GLM puede escribir en ella.
Claude y Codex cargan sin preguntar lo que encuentran en su carpeta: `.claude/settings*.json` con
hooks, `.mcp.json`, `CLAUDE.md`, `.codex/` y `AGENTS.md`. Un hook así correría como
`agentes-alfred`, con el token de Sam, y las reglas `deny` no lo frenan. Por eso:

- los motores trabajan en `/srv/oficina/motores/<perfil>`, que solo escribe su usuario;
- `dtd-agente-run` no arranca el motor (sale con 66) si la carpeta, lo que carga de ella o un
  padre los puede escribir alguien que no sea el usuario del motor o root;
- también sale con 66 si la carpeta o un archivo de configuración es un enlace.

| Archivo | Dónde se instala | Qué hace |
|---|---|---|
| `dtd-claude` | `/usr/local/bin/dtd-claude` (root, 755) | `command` de ALFRED (`claude_local`). Llama a `dtd-motor claude` |
| `dtd-codex` | `/usr/local/bin/dtd-codex` (root, 755) | `command` del Auxiliar (`codex_local`). Llama a `dtd-motor codex` |
| `dtd-motor` | `/usr/local/libexec/dtd-motor` (root, 755) | Corre como `agentes`. Revisa la lista cerrada (`claude:ceo` → `agentes-alfred`, `codex:auxiliar` → `agentes-auxiliar`). Quita `--mcp-config`. Copia a `/srv/oficina/staging/<perfil>/run.*` (750) lo que Paperclip pasa como rutas de `/home/agentes/`, pero solo si la ruta, resuelta con `realpath` y con todo lo que alcanzan sus enlaces, cae en una lista cerrada: el paquete `companies/<id>/claude-prompt-cache/<sha>`, las instrucciones `companies/<id>/agents/<id>/instructions` y las skills de la instancia o de la instalación. Si una ruta protegida cae fuera, por ejemplo un secreto, `..`, un enlace o la casa sola, no copia nada y sale con 66. También sale con 66 si cualquier argumento, una vez resuelto, cae en `/srv/oficina/trabajo`, la carpeta que escriben los GLM (`--settings`, `--add-dir`, `--plugin-dir`…), exista la ruta o no. Las rutas relativas las resuelve desde la carpeta donde trabaja el motor (`/srv/oficina/motores/<perfil>`), que es desde donde las abriría Claude o Codex. También sale con 66 si un argumento, o el valor de `--opción=valor`, empieza por `~`, y si a Codex le llega `-C` o `--cd` en cualquiera de sus formas. Le da lectura al usuario del motor con una ACL (`setfacl u:<usuario>:rX`), porque `agentes` no es de su grupo. Después ejecuta `sudo -n -u <usuario> dtd-agente-run`. Sin la carpeta de staging del perfil sale con 65 |
| `dtd-agente-run` | `/usr/local/libexec/dtd-agente-run` (root, 755) | Tiene una tabla cerrada de herramienta, perfil y usuario. Toma `HOME`, `CLAUDE_CONFIG_DIR` y `CODEX_HOME` del usuario. Lleva a Claude y a Codex a `/srv/oficina/motores/<perfil>` después de comprobar que nadie más la puede escribir; si no, sale con 66. Ya en esa carpeta y como el usuario del motor, vuelve a revisar los argumentos de Claude y Codex: si uno, resuelto con sus enlaces, cae en `/srv/oficina/trabajo`, sale con 66. Borra las llaves de API; solo Claude recibe `CLAUDE_CODE_OAUTH_TOKEN`. La rama `hermes` es la del VPS al 2026-11-06 15:22 UTC, salvo el `PATH`: toma el primer node que exista de una lista cerrada y sin comodines (`node-26.12.1-linux-x64`, el de Hermes 0.23, y después `node-26.7.0-linux-x64`, que se queda para volver atrás) y `ripgrep-15.2.0-linux-x64`. Si falta node o ripgrep, Hermes no arranca y sale con 69 |
| `91-agentes-run` | `/etc/sudoers.d/91-agentes-run` (root, 440) | Con `env_reset`, deja pasar solo 14 variables `PAPERCLIP_` nombradas una por una (las que usan las skills de Paperclip y el adaptador de Hermes), `HERMES_EPHEMERAL_SYSTEM_PROMPT` (preparación para Paperclip 1023+, que manda por ahí las instrucciones de los GLM; `dtd-agente-run` la borra para Claude, Codex y OpenCode), `DTD_PERFIL`, `CLAUDE_CODE_OAUTH_TOKEN` y las de idioma. Nunca `PAPERCLIP_*`: el servidor tiene `PAPERCLIP_AGENT_JWT_SECRET` y `PAPERCLIP_TOOL_ACTION_SIGNING_SECRET`, que con el comodín llegaban a todos los agentes. Con `!log_allowed`, sudo deja de copiar el prompt al registro. `agentes` puede cambiar solo a los tres usuarios, y solo para `dtd-agente-run` |

`dtd-hermes` no cambia.

## Riesgos BAJOS de la aprobación de la #407 (2026-11-07)

El DG aprobó la #407 y dejó tres riesgos BAJOS. Ninguno es explotable hoy: una llave de agente no
puede cambiar `args`, `extraArgs`, `command`, `cwd` ni `env`. Esta corrección es endurecimiento.

1. **Enlaces dentro de la carpeta del motor.** `dtd-motor` corre como `agentes`, que no puede leer
   `/srv/oficina/motores/<perfil>` (700 del usuario del motor). `realpath -m` no ve los enlaces de
   adentro y devuelve la ruta tal cual. Medido en el VPS de la oficina el 2026-11-07, con un
   enlace `notas` → `trabajo/ceo` en una carpeta 700 de `/tmp`: el dueño la resuelve hacia
   `trabajo/ceo` y `agentes` devuelve `motores/ceo/notas`. **Arreglo:** `dtd-agente-run` revisa
   otra vez los argumentos de Claude y Codex, como el usuario del motor y desde su carpeta, que es
   como los abriría el motor. Lo que esa revisión no pueda resolver, el motor tampoco lo puede
   abrir. La alternativa era rechazar en `dtd-motor` las relativas que `agentes` no puede
   resolver. Se descartó porque `dtd-motor` revisa todos los argumentos, también `high` o `hola`,
   y todos pasan por esa carpeta: se habría rechazado todo.
2. **`~` no se expande.** `~/../../srv/oficina/trabajo` se resolvía como una relativa dentro de la
   carpeta del motor (`motores/srv/oficina/trabajo`) y pasaba. El motor puede expandirla a la casa
   de su usuario. **Arreglo:** `dtd-motor` sale con 66 si un argumento, o el valor de
   `--opción=valor`, empieza por `~`. Una `~` en otra parte del argumento no cuenta.
3. **`codex -C <carpeta>`.** En Codex 0.163.0, `-C`/`--cd` es global
   (`codex-rs/utils/cli/src/shared_options.rs:67`). Se resuelve desde el cwd del proceso
   (`codex-rs/exec/src/lib.rs:359-365`) y pasa a ser la carpeta de la sesión. Desde ella se
   resuelven las `--add-dir` relativas y se elige el proyecto activo
   (`codex-rs/core/src/config/mod.rs:3520-3545`). Revisar solo que la carpeta no caiga en
   `/srv/oficina/trabajo` no alcanza: `-C /tmp/x` mudaría la raíz del proyecto fuera de la
   carpeta que revisa `dtd-agente-run`, a un lugar que un GLM puede escribir. **Arreglo:**
   `dtd-motor` sale con 66 si a Codex le llega `-C`, `-C<carpeta>`, `-C=<carpeta>`, `--cd` o
   `--cd=<carpeta>`. El adaptador `codex_local` de Paperclip 2026.1012.0 no pasa `-C` ni `--cd`
   (medido en el VPS de la oficina el 2026-11-07).

Lo instalado en el VPS todavía no tiene estos arreglos. **Reinstalar lo decide Sam por medio del
DG.**

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
   - **Carpetas de los motores**, fuera de `/srv/oficina/trabajo`:
     - `/srv/oficina/motores`, con dueño `root:root` y permisos 755. Todos sus padres, hasta `/`,
       son de root y nadie más los escribe;
     - `/srv/oficina/motores/ceo`, con dueño `agentes-alfred:agentes-alfred` y permisos 700, y su
       `CLAUDE.md` (dueño `root:agentes-alfred`, 640);
     - `/srv/oficina/motores/auxiliar`, con dueño `agentes-auxiliar:agentes-auxiliar`, permisos
       700, git local (`git init`, del mismo usuario) y su `AGENTS.md` (`root:agentes-auxiliar`,
       640);
     - sin ACL de otros usuarios y sin `.claude/`, `.mcp.json`, `.codex/` ni enlaces que no sean
       del motor o de root.
   - En Paperclip, el `cwd` de los dos agentes sigue siendo `/srv/oficina/trabajo/<perfil>`, donde
     solo escribe Paperclip su `.paperclip-runtime/`. El motor no trabaja ahí:
     `dtd-agente-run` lo lleva a su carpeta.
   - Nada de la carpeta de trabajo es secreto. Las credenciales viven solo en la casa de cada
     usuario.
4. **Crear el staging.**
   - `/srv/oficina/staging`, con dueño `root:root` y permisos 755.
   - `/srv/oficina/staging/ceo`, con dueño `agentes:agentes-alfred` y permisos 750.
   - `/srv/oficina/staging/auxiliar`, con dueño `agentes:agentes-auxiliar` y permisos 750.
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
   `agentes-run`:
   - que no puede listar `~agentes-alfred` ni `~agentes-auxiliar`;
   - que no puede crear nada en `/srv/oficina/motores/ceo` ni en `/srv/oficina/motores/auxiliar`.

## Instalado (revisión del DG, 2026-11-07, 14:56 UTC)

Se instaló desde la cabeza `0e80cb77c`. Sam lo autorizó al co-CEO a las 14:40 UTC («Vamos a avanzar e
instalar las actualizaciones bajo tu recomendación…») y lo confirmó en la sesión que instaló («Sí,
instala»). El respaldo quedó en
`/root/respaldo-sdd-0615-dg-20261107T144934Z`:

- `dtd-motor` `09176905…`, `dtd-agente-run` `e3b451c2…` y `91-agentes-run` `66b5cd84…`;
- `visudo` OK;
- `/srv/oficina/motores/{ceo,auxiliar}` creadas.

Pasaron las pruebas de humo de ALFRED, el Auxiliar y el Jefe de gabinete. Ningún proceso de
agente tiene los secretos del servidor. El detalle está en el handoff.

## Pruebas

- **Pruebas:** `python -I -B -m unittest discover -s infra/oficina/envoltorios/tests -v`.
  También corren desde el harness, en `scripts/tests/oficina-envoltorios.node.mjs`. En Linux no
  se salta ninguna.
- **Mutantes:** `python -I -B infra/oficina/envoltorios/tests/mutantes.py`. Los marcados
  «solo Linux» se saltan en Windows.
- **visudo:** la prueba del sudoers corre `visudo -c -f` si está instalado, y si no se salta.

## Instalado (2026-11-06, 21:39 UTC)

La instalación salió del commit `fca430685`, con respaldo en
`/root/respaldo-sdd-0615-20261106T213957Z`. Los sha256 instalados coinciden con los del commit.

**Comprobaciones, todas en verde:**

- Hermes responde con los perfiles `ceo` y `seo`.
- Claude Code (2.1.304) y Codex (0.163.0) corren a través de sus envoltorios.
- Un perfil ajeno da 64.
- `agentes-run` no entra a las casas nuevas ni al staging.
- `agentes-alfred` no lista la carpeta de los GLM.
- sudo no registra `dtd-agente-run`.
- Paperclip responde con 200.

**En Linux (Python 3.12.3):**

- 20 pruebas, sin saltos;
- 29 de 29 mutantes mueren.
