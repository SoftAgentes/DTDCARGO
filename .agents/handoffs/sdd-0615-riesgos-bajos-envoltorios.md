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

Esa primera tanda sumó 8 pruebas (de 46 a 54) y 15 mutantes (de 54 a 69), y cambió el README de
los envoltorios y la spec (§ Riesgos BAJOS de la aprobación). Con lo que vino después, la cabeza
tiene **63 pruebas, 87 mutantes y `MINIMO = 63`** en `scripts/tests/oficina-envoltorios.node.mjs`.

**Agregado del co-CEO (2026-11-07), en `dtd-agente-run`.** El `PATH` de Hermes tenía fija la
carpeta `/opt/hermes/tools/node-26.7.0-linux-x64/bin`, pero Hermes 0.23 trae node 26.12.1
(`pm/lock.json`, según el procedimiento de la 0.23 en las notas de la sesión Paperclip). Ahora:

- toma el primer node que exista de una lista cerrada y sin comodines: `node-26.12.1-linux-x64` y
  después `node-26.7.0-linux-x64`, que se queda para volver atrás;
- si no hay node, Hermes sale con 69 en vez de correr sin él;
- ripgrep queda como estaba. La primera versión también lo exigía, pero la corrida en el VPS
  (2026-11-07, solo lectura) midió que `/opt/hermes/tools/ripgrep-15.2.0-linux-x64/bin/rg` no
  existe: exigirlo habría dejado a todos los GLM sin arrancar. No se publicó;
- suma 5 pruebas (de 54 a 59), 8 mutantes y el piso del harness en 59.

**Revisión del DG sobre `dbe4a5576` (2026-11-07, ~19:45Z).** El DG confirmó que el código cierra
los tres riesgos y pidió cinco cosas antes de aprobar. Las cinco van en este commit:

1. **Evidencia al día.** La de abajo es de la cabeza nueva. Las cifras viejas (54 pruebas y 69
   mutantes) quedan solo como historia.
2. **node 26.12.1, medido en el VPS en solo lectura:** existe
   `/opt/hermes/tools/node-26.12.1-linux-x64/bin/node` y `--version` da `v26.12.1`. Las carpetas
   `node-*` son exactamente `node-26.12.1-linux-x64` y `node-26.7.0-linux-x64`, así que la lista
   no cambia. **La caída a 26.7.0 ahora avisa:** deja una línea en stderr,
   `dtd-agente-run: aviso: falta …/node-26.12.1-linux-x64/bin/node; Hermes usa node-26.7.0-linux-x64`.
   Va a stderr y no a stdout, que es por donde habla Hermes.
3. **Opciones cortas con la ruta pegada** (`-i<ruta>`, `-i=<ruta>`). `dtd-motor` revisa el valor
   pegado como si viniera aparte y sale con 66 si empieza por `~` o cae en
   `/srv/oficina/trabajo`. `dtd-agente-run` lo revisa otra vez como el usuario del motor, con
   sus enlaces. Una opción corta sin valor (`-p`, `-v`) o con una ruta inocente
   (`-inotas/x.png`) pasa igual que antes.
4. **El comentario del harness** ya dice que en Windows se saltan 13 pruebas y no «las dos».
5. **Diseño conocido**, anotado en la spec y en el README: llamar a `dtd-agente-run` directo se
   salta las revisiones de `dtd-motor`. No agrega riesgo, porque el sudoers solo se lo permite a
   `agentes`, que es quien corre `dtd-motor`.

Suma 4 pruebas (de 59 a 63) y 10 mutantes (de 77 a 87). El piso del harness queda en 63.

**Por qué 69 y no seguir sin node.** Una falla ruidosa se ve en la prueba de humo que sigue a la
instalación. Sin node, Hermes correría a medias y no se notaría. Si el DG prefiere que Hermes
arranque igual y solo avise, basta con cambiar la línea con `exit 69`.

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
- **Corrida sobre la cabeza nueva** (2026-11-07, 19:48Z a 19:50Z, con el «va» del co-CEO). Corrió
  en `/tmp/dtd-0615-bajos.OAnC1B`, que quedó borrada (`limpio: si`). Se midieron estos archivos,
  que son idénticos a los del commit; el handoff no viaja en el paquete:

  | Archivo | sha256 (12) |
  |---|---|
  | `dtd-motor` | `c3e66819024f` |
  | `dtd-agente-run` | `f2da72382f46` |
  | `tests/test_envoltorios.py` | `d8db56516490` |
  | `tests/mutantes.py` | `0eee04c03165` |

  En cada rojo se quita solo ese arreglo y se corre la suite entera:

  | Variante | Qué le falta | Resultado | Pruebas que fallan |
  |---|---|---|---|
  | rojo1 | `sin_rutas_de_los_glm` en Claude y Codex | 24 fallas | `test_enlace_dentro_de_la_carpeta_del_motor_hacia_los_glm_no_arranca` (8), `test_ruta_hacia_los_glm_no_arranca_aunque_no_pase_por_dtd_motor` (6), `test_opcion_corta_con_ruta_pegada_hacia_los_glm_no_arranca` (10) |
  | rojo2 | el rechazo de `~` | 8 fallas | `test_ruta_que_empieza_por_virgulilla_no_corre` |
  | rojo3 | el rechazo de `-C`/`--cd` | 6 fallas | `test_codex_no_acepta_cambiar_de_carpeta` |
  | rojo4 | el `PATH` viejo de node, fijo | 5 fallas | las cuatro de node y `test_herramientas_de_hermes_sin_comodines` |
  | rojo5 | la revisión de opciones cortas, en los dos scripts | 24 fallas | `test_opcion_corta_con_ruta_pegada_no_corre` (14), `test_opcion_corta_con_ruta_pegada_hacia_los_glm_no_arranca` (10) |
  | rojo6 | el aviso de la caída a 26.7.0 | 1 falla | `test_hermes_avisa_cuando_vuelve_al_node_viejo` |

  Ningún rojo hace fallar pruebas de otro riesgo. rojo1 también tumba la prueba de opciones
  cortas de `dtd-agente-run`, porque esa revisión vive en la misma función.
- **Verde:** `Ran 63 tests`, `OK`, 0 saltadas.
- **Mutantes:** `87 de 87 mueren`.
- **Historia.** Antes de la revisión del DG, sobre `dbe4a5576`, dieron 59 pruebas y 77 mutantes.
  Antes del node, 54 pruebas y 69 mutantes, también sobre `main` `7e75f7708`. Esas corridas ya no
  describen la cabeza.
- **En Windows (Git Bash):** `Ran 63 tests`, `OK (skipped=13)`, saltadas por ser solo Linux. El
  harness `node --test scripts/tests/oficina-envoltorios.node.mjs` pasa con el piso de 63 (1 de 1).
  Mutantes: `77 de 77 mueren`, y los 10 marcados «solo Linux» quedan saltados; en Linux mueren
  los 87.
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
- **ripgrep de Hermes.** El `PATH` vivo apunta a `/opt/hermes/tools/ripgrep-15.2.0-linux-x64/bin`, pero ahí no hay `rg` (medido el 2026-11-07). Hay que medir dónde quedó `rg` (o si Hermes lo usa) y corregirlo en una PR aparte.

## Impacto documental

Cambiaron el README de los envoltorios y la spec 0615. Sin cambios para Graphify u Obsidian
hasta que esto llegue a `main`.
