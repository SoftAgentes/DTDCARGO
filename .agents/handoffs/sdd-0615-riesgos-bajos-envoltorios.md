# Handoff — SDD-0615: los tres riesgos BAJOS de la aprobación de la #407

**Fecha:** 2026-11-07. **Quién:** Worker Claude, sesión hija de «Paperclip».
**Alcance:** los tres riesgos BAJOS que dejó el DG al aprobar la #407 (cabeza `1388a7ef4`).
Ninguno es explotable hoy, porque una llave de agente no puede cambiar `args`, `extraArgs`,
`command`, `cwd` ni `env`. Es endurecimiento.

## Qué cambió

| Riesgo | Archivo | Arreglo |
|---|---|---|
| 1. Enlaces dentro de `motores/<perfil>` | `dtd-agente-run` | Revisa otra vez los argumentos de Claude y Codex como el usuario del motor, desde su carpeta y con `realpath -m`. Sale con 66 si uno cae en `/srv/oficina/trabajo`. Hermes y OpenCode no cambian |
| 2. `~` no se expande | `dtd-motor` | Sale con 66 si un argumento, o el valor de `--opción=valor`, empieza por `~` |
| 3. `codex -C` | `dtd-motor` | Sale con 66 si Codex recibe `-C`, `-C<dir>`, `-C=<dir>`, `--cd` o `--cd=<dir>` |

También cambiaron 8 pruebas nuevas (de 46 a 54), 15 mutantes nuevos (de 54 a 69), el README de
los envoltorios, la spec (§ Riesgos BAJOS de la aprobación) y `MINIMO = 54` en
`scripts/tests/oficina-envoltorios.node.mjs`.

**Agregado del co-CEO (2026-11-07), en `dtd-agente-run`.** El `PATH` de Hermes tenía fija la
carpeta `/opt/hermes/tools/node-26.7.0-linux-x64/bin`, pero Hermes 0.23 trae node 26.12.1
(`pm/lock.json`, según el procedimiento de la 0.23 en las notas de la sesión Paperclip). Ahora:

- toma el primer node que exista de una lista cerrada y sin comodines: `node-26.12.1-linux-x64` y
  después `node-26.7.0-linux-x64`, que se queda para volver atrás;
- exige ripgrep 15.2.0;
- si falta node o ripgrep, Hermes sale con 69 en vez de correr sin ellos;
- suma 4 pruebas (de 54 a 58), 8 mutantes y el piso del harness en 58.

**Por qué 69 y no seguir sin node.** Una falla ruidosa se ve en la prueba de humo que sigue a la
instalación. Sin node, Hermes correría a medias y no se notaría. Si el DG prefiere que Hermes
arranque igual y solo avise, basta con cambiar las dos líneas con `exit 69`.

## Por qué así

1. **Riesgo 1.** En `dtd-motor` no hay forma buena de cubrirlo: revisa todos los argumentos
   (`high`, `hola`…) como rutas, y todos pasan por la carpeta 700 que `agentes` no lee. Rechazar
   lo que `agentes` no resuelve lo rechazaría todo. `dtd-agente-run` corre como el usuario del
   motor y ya está en su carpeta. Lo que esa revisión no pueda resolver, el motor tampoco lo
   puede abrir.
2. **Riesgo 2.** Paperclip le manda a Claude el prompt por stdin
   (`adapter-claude-local/dist/server/execute.js`, `stdin: prompt`, medido en el VPS). Por eso
   rechazar todo lo que empiece por `~` no bloquea prompts.
3. **Riesgo 3.** Codex 0.163.0 (tag `rust-v0.163.0`):
   - `-C`/`--cd` es global: `codex-rs/utils/cli/src/shared_options.rs:67`;
   - se resuelve desde el cwd del proceso: `codex-rs/exec/src/lib.rs:359-365`;
   - pasa a ser la carpeta de la sesión. Desde ella se resuelven las `--add-dir` relativas y se
     elige el proyecto activo: `codex-rs/core/src/config/mod.rs:3520-3545`.

   Revisar solo la carpeta contra `trabajo` no alcanza: `-C /tmp/x` mudaría la raíz del proyecto
   fuera de la carpeta que revisa `dtd-agente-run`. `adapter-codex-local` 2026.1012.0 no pasa
   `-C` ni `--cd` (grep en el VPS).

## Evidencia

Todo en el VPS de la oficina, en `/tmp/dtd-0615-bajos.*`, sin tocar lo instalado; las carpetas
se borraron al terminar. Usé Ubuntu, kernel 6.8.0-139, Python 3.12.3, bash 5.2.21, coreutils
9.4 y codex-cli 0.163.0.

- **Riesgo 1, medido con dos usuarios.** Un enlace `notas` → `trabajo/ceo` en una carpeta 700 de
  `sam`. `sam` lo resuelve a `…/trabajo/ceo`, y `sudo -u agentes realpath -m` devuelve
  `…/motores/ceo/notas`. En el VPS real, `agentes` no puede listar `/srv/oficina/motores/ceo`
  (`drwx--S--- agentes-alfred`).
- **Riesgo 2, medido.** Como `agentes`, `…/motores/ceo/~/../../srv/oficina/trabajo` resuelve a
  `…/motores/srv/oficina/trabajo`.
- **Rojo de cada riesgo.** Se quita solo ese arreglo y se corre la suite nueva:
  - **rojo1:** 14 fallas, todas de `test_enlace_dentro_de_la_carpeta_del_motor_hacia_los_glm_no_arranca`
    y `test_ruta_hacia_los_glm_no_arranca_aunque_no_pase_por_dtd_motor`;
  - **rojo2:** 8 fallas, todas de `test_ruta_que_empieza_por_virgulilla_no_corre`;
  - **rojo3:** 6 fallas, todas de `test_codex_no_acepta_cambiar_de_carpeta`.
- **Verde:** `Ran 54 tests`, `OK`, 0 saltadas.
- **Otra vez sobre `main` `7e75f7708` con este commit encima.** Corrió a las ~17:55Z, con el «va» del co-CEO y después de la reinstalación de las 17:52Z. Dio lo mismo: rojo1 14, rojo2 8, rojo3 6, verde 54 sin saltos y 69 de 69 mutantes muertos.
- **Mutantes:** 69 de 69 mueren.
- **En Windows (Git Bash):** 54 pruebas en `OK`, con 13 saltadas por ser solo Linux. El harness
  `node --test scripts/tests/oficina-envoltorios.node.mjs` pasa con el piso de 54.
- **Chequeos:**
  - `node scripts/build-docs-index.mjs --check`: PASÓ;
  - `node scripts/check-numbering.mjs`: PASÓ;
  - `git diff --check`: PASÓ.
- **`pnpm verify`:** NO APLICA, porque no hay código de producto.

## Límites conocidos

- **Riesgo 1, carrera.** La revisión ocurre antes del `exec`. Otra corrida de ALFRED al mismo
  tiempo podría crear el enlace entre la revisión y el arranque. Para eso, ALFRED ya tendría que
  estar comprometido.
- **Arnés en Windows.** MSYS expande una `~` suelta antes de que llegue a bash, y bash resuelve
  el cwd con la ruta 8.3. Esos dos casos solo se prueban en Linux.

## Pendiente de esta tarea

- Reinstalar en el VPS: lo decide Sam por medio del DG. No instalé nada.

## FUERA DE ALCANCE DETECTADO

- **`codex -c clave=valor`** puede fijar en línea rutas y opciones de la configuración. Ni
  `dtd-motor` ni `dtd-agente-run` revisan esos valores. La spec ya dice que no se revisan las
  rutas dentro de un archivo de configuración; esto es lo mismo, pero por argumento.
- **Carpetas que escriben los GLM fuera de `/srv/oficina/trabajo`**, como `/tmp`. La regla solo
  mira `trabajo`. Un `--add-dir /tmp/x` o un `--settings /tmp/x.json` de Claude pasaría.
- **Ruido de `find` en `dtd-motor`.** Si se corre desde una carpeta que `agentes` no puede leer (por ejemplo, desde `/home/sam` por sudo), el `find` de limpieza avisa «Failed to restore initial working directory». No es una falla. Se quita con un `cd` a la carpeta de staging antes de ese `find` (aviso de la sesión Paperclip, 2026-11-07).
- **Comentario viejo en `scripts/tests/oficina-envoltorios.node.mjs`:** dice que en Windows «se
  saltan las dos» pruebas de enlaces y permisos, pero ya son 13.

## Impacto documental

Cambiaron el README de los envoltorios y la spec 0615. Sin cambios para Graphify u Obsidian
hasta que esto llegue a `main`.
