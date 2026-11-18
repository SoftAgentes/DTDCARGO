# Actualizar la oficina: Paperclip 2026.1106.0 y Hermes v0.23.0

Evaluación del 2026-11-07. Sale de leer las notas de versión, el código de Paperclip en las
etiquetas `v2026.1012.0` y `v2026.1106.0`, el código de Hermes en `v0.22.2` y `v0.23.0`, y de
cuatro conexiones de solo lectura al VPS de la oficina. La base de Paperclip se leyó con
`default_transaction_read_only = on`; no se imprimió ningún secreto.

**Estado al cierre del 2026-11-07:**

- **Hermes v0.23.0:** instalado con el OK de Sam (§7).
- **Cambios A, B y C:** hechos (§3, paso 0 y paso 2).
- **Paperclip:** sigue en 2026.1012.0.
- **Pendiente:** el paso 3. No se ejecuta hasta que el Director General revise el plan y Sam dé el
  aviso.

Contexto: la guía `configuracion-paperclip.md` decía que no convenía pasar a Paperclip 1023 por
el bloqueo del uso sin precio. Este documento mide ese bloqueo y lo demás que cambió. Esa guía
entró a `main` con la PR #407 (`7e75f7708`), y esta PR le cambia esa regla (§3, paso 0).

Las etiquetas dicen de dónde sale cada dato:

- **[CÓDIGO]:** leído en el código de la versión indicada.
- **[NOTAS]:** notas de versión oficiales.
- **[ISSUE]:** issue o PR de GitHub, con su estado al 2026-11-07.
- **[MEDIDO]:** comprobado hoy en el VPS de la oficina.
- **[INFERENCIA]:** deducido, sin comprobar. La prueba de humo lo confirma o lo descarta.

## 1. Veredicto

**Conviene actualizar, en dos pasos y con tres cambios previos.** Ninguna de las cuatro dudas
bloquea, pero apareció un riesgo nuevo que sí bloquea si no se atiende antes (§2.5).

| Pieza | Antes | Destino | Estado |
|---|---|---|---|
| Hermes | v0.22.2 (`d923a5eb`) | v0.23.0 (`2bd378ed`) | **Hecho** el 2026-11-07 (§7) |
| Paperclip | 2026.1012.0 | 2026.1106.0 | Pendiente: el paso 3 (§3), después de «Antes de la ventana» (§6) |

**Lo que había que hacer antes de Paperclip, los tres hechos el 2026-11-07:**

- **A.** Dejar pasar `HERMES_EPHEMERAL_SYSTEM_PROMPT` por sudo. Sin eso, los agentes GLM se
  quedan sin instrucciones. Hecho con la SDD-0615: el sudoers `66b5cd84…` de `main`.
- **B.** Apagar el corte duro de las políticas de presupuesto de los agentes vivos. Sin eso, cada
  agente GLM queda retenido después de su primera corrida. Hecho a las 15:38Z (§3, paso 2).
- **C.** Fusionar la PR #407, para que los envoltorios instalados sean los de `main`.
  - Fusionada en `7e75f7708`.
  - Los envoltorios se reinstalaron desde ese commit entre las 17:51 y las 17:52Z, con huellas
    iguales a `main` (§3, paso 2).

**Cuándo.** La 1106 salió el 2026-11-06, con 515 commits. Va en una ventana sin trabajo vivo y
solo después de cumplir el §6. Hermes ya está instalado.

## 2. Riesgos medidos

### 2.1 El uso sin precio: no retiene a ALFRED ni al Auxiliar; sí a los agentes GLM

**Qué cambia.** Desde la 1023, cada política de presupuesto tiene `unpricedUsagePolicy`, que
vale `block` por defecto. Con `block`, una política activa con corte duro y monto mayor que cero
cuenta como agotada si en su ventana hay un evento sin precio [NOTAS 1023,
`server/src/services/budgets.ts:182-190` en 1106]. En la 1012 el corte duro solo mira el gasto
contra el monto (`budgets.ts:602`, `694`) [CÓDIGO].

**Qué cuenta como «sin precio».** Solo los eventos con `cost_status = 'unpriced'` y
`billing_type <> 'subscription_included'` (`budget-exposure.ts:131`) [CÓDIGO]. El adaptador
reporta `subscription` cuando falta la llave de API, y el servidor lo guarda como
`subscription_included` (`usage-receipts.ts:84`). Un evento `subscription_included` nunca se marca
`unpriced` (`run-cost-accounting.ts:107`) [CÓDIGO]:

- Claude: `subscription` si no hay `ANTHROPIC_API_KEY` (`claude-local/.../execute.ts:172-175`).
- Codex: `subscription` si no hay `OPENAI_API_KEY` (`codex-local/.../execute.ts:199-202`).
- `dtd-agente-run` borra las dos llaves antes de lanzar el motor.

**Lo que hay en la base hoy [MEDIDO]:**

| Motor | `billing_type` | `cost_status` | Eventos (todos del mes) | Con costo |
|---|---|---|---|---|
| Claude (ALFRED) | `subscription_included` | `reported` | 8 | 0 |
| Codex (Auxiliar) | `subscription_included` | `unpriced` | 4 | 0 |
| Hermes (GLM) | — | — | 0, en 8 corridas de 14 días | — |

El «-» de la pantalla de costos es un evento con costo cero o sin costo. Para el bloqueo no
cuenta, porque es `subscription_included`.

**Hermes sí queda retenido.** El adaptador de Hermes no reporta `billingType` ni costo. En 1106,
al cerrar la corrida, el servidor escribe un evento `billing_type = 'unknown'`,
`cost_status = 'unpriced'` (`run-cost-accounting.ts:91-107`) [CÓDIGO]. Hoy esos agentes no tienen
eventos porque la 1012 no los escribe. Desde la primera corrida en 1106, la política del propio
agente lo retiene [INFERENCIA, que la prueba de humo 5.3 confirma].

**Políticas que tenemos [MEDIDO]:** 14, todas por agente, `billed_cents`, mes calendario UTC,
activas, con corte duro y monto mayor que cero. No hay políticas de empresa ni de proyecto.

| Agentes con política | Cuántos |
|---|---|
| ALFRED, Editor de contenido, Puente de ingeniería, Jefe de gabinete, Asesor comercial, Community manager asistente, Analista de CRM/datos, Analista de operaciones | 8 vivos |
| `prueba-opencode`, `prueba-hermes` y cuatro «duplicado, no usar» | 6 terminados (políticas huérfanas, ya anotadas en el handoff de la SDD-0615) |
| Auxiliar de ALFRED | Sin política |

**¿`unpricedUsagePolicy = allow` lo resuelve?** Sí para el uso sin precio: con `allow`,
`unpricedUsageBlocks` devuelve falso. No resuelve el riesgo de §2.2, que es otra condición de la
misma función. Además, la columna solo existe después de la migración `0312`: hasta que alguien la
cambie, la primera corrida GLM ya escribe un evento sin precio y retiene al agente.

**Recomendación (cambio B, hecho el 2026-11-07 por la API; ver §3, paso 2):** apagar el corte duro
(`hardStopEnabled = false`) de las 8 políticas vivas **antes** de actualizar, con la 1012. El aviso
(`notify_enabled`) se puede dejar. Esos topes en dólares nunca frenaron nada: los GLM no se miden
y las suscripciones cuestan cero en Paperclip. El freno real sigue siendo la cuota de cada plan.
Después de actualizar, poner además `unpricedUsagePolicy = allow` en esas mismas políticas, por si
alguien vuelve a encender el corte duro.

### 2.2 El #18956: una corrida cancelada puede congelar, aquí solo a un agente

**Estado:** abierto [ISSUE #18956, última actividad el 2026-11-05]. Es parecido al #18106
(corte duro con gasto cero cuando terminan corridas a la vez), también abierto.

**Mecanismo [CÓDIGO 1106]:**

- Una corrida terminada que no llegó a contabilizarse queda con `cost_accounting_pending = true`.
- Con corte duro, `observedBlocks` retiene el alcance mientras haya una
  (`budgets.ts:189`), sin importar `unpricedUsagePolicy`.
- Para reanudar, `resolveIncident` exige cero pendientes (`budgets.ts:920`). Si el recibo se
  perdió, no hay salida soportada. La única que reportan es apagar el corte duro.

**Lo que tenemos [MEDIDO]:**

- **Alcance:** las políticas son por agente, así que el congelamiento alcanzaría a un agente, no a
  la empresa.
- **Historial:** la migración `0312` agrega `cost_accounting_pending` con `false` por defecto
  [CÓDIGO], así que el historial no queda pendiente al migrar. Este mes hay 0 corridas canceladas
  y no hay incidentes de presupuesto.

**Con el cambio B el riesgo desaparece**, porque `observedBlocks` sale en falso cuando la
política no tiene corte duro. Si algún día se quiere un corte duro real, hay que esperar a que se
cierre el #18956.

### 2.3 El Runner por defecto: no toca a ALFRED ni al Auxiliar

**Qué cambia [NOTAS 1106].** Los agentes **nuevos** de Claude, Codex, OpenCode y Pi nacen en el
Paperclip Runner en hosts calificados. Linux x64 califica con glibc 2.39 o más. El VPS tiene
Ubuntu 24.04.5, glibc 2.39, x86_64 [MEDIDO], así que califica. Los agentes existentes conservan su
runner. Aparece un botón **Upgrade runner** que los convierte.

**Los dos agentes existentes [MEDIDO en la base]:**

| Agente | Adaptador | `engine` | `command` | Variables |
|---|---|---|---|---|
| ALFRED | `claude_local` | `cli` | `/usr/local/bin/dtd-claude` | `DTD_PERFIL` |
| Auxiliar de ALFRED | `codex_local` | `cli` | `/usr/local/bin/dtd-codex` | `CODEX_HOME`, `DTD_PERFIL` |

**Por qué siguen usando los envoltorios [CÓDIGO 1012 contra 1106]:**

- **El comando.** Los dos adaptadores siguen leyendo `config.command`
  (`claude-local/.../execute.ts:181`, `codex-local/.../execute.ts:605`).
- **Los argumentos.** Las banderas que arma Paperclip para Claude son las mismas en las dos
  versiones, así que `dtd-motor` (que quita `--mcp-config` y copia las rutas de `/home/agentes/`)
  sigue sirviendo. En Codex solo aparece `--version`, que corre únicamente con la observabilidad
  de agentes encendida (apagada por defecto, `execute.ts:1094-1097`).
- **El chequeo de credenciales de `codex_local`.** El chequeo previo
  (`heartbeat/run-preparation.ts:654`) y `evaluateCodexCredentialReadiness`
  (`codex-home.ts:950`) son idénticos, igual que `isManagedCodexHomePath` y
  `resolveManagedCodexHomeDir`. Un `CODEX_HOME` fuera de la carpeta administrada sigue dando
  `managed: false, ready: true`, así que el desvío de la SDD-0615 sigue valiendo.
- **La «Existing authentication» de `claude_local`.** Los bloqueos por conexión de IA
  (`ai_connection_unavailable`, `_changed`, `_incompatible`) son los mismos y solo saltan cuando el
  agente tiene una conexión elegida. ALFRED no la tiene.
- **Las versiones fijadas.** No cambian: Claude Agent SDK 2.1.286 y Codex 0.160.0 son del Runner y
  del modo ACP [NOTAS]. Nuestros agentes usan la CLI instalada (Claude 2.1.304, Codex 0.163.0
  [MEDIDO]) a través del envoltorio.

**Reglas nuevas para la oficina:**

- **No presionar «Upgrade runner»** en ALFRED ni en el Auxiliar. El Runner no pasa por
  `dtd-claude` ni por `dtd-codex`, y se perdería el aislamiento por usuario.
- **En cada alta nueva de Claude o Codex, elegir «Legacy runner»** en Advanced. Hay que agregarlo
  a las hojas de alta de la guía.

### 2.4 Hermes 0.23 quita `browser_*`: no nos afecta

**Qué cambia [NOTAS 0.23.0].** Las diez herramientas `browser_*` y agent-browser desaparecen. La
automatización queda en `browser_exec`. Las listas que las nombran hay que cambiarlas.

**Los 16 perfiles [MEDIDO, de `/home/agentes-run/.hermes/profiles/*`]:**

- **`SOUL.md`, contextos, sesiones y memoria:** ninguno nombra `browser_*`.
- **Skills:** las menciones están solo en skills empaquetadas por Hermes (hay
  `.bundled_manifest`). La mayoría son plantillas de `popular-web-designs`; las demás, de
  `computer-use`, `dogfood`, `airtable` y otras que no usamos. Hermes las reemplaza al
  actualizar.
- **`config.yaml`:** solo aparece en comentarios de la plantilla, en la sección de ajustes
  `browser:` y en `known_builtin_toolsets.cli: - browser`, un registro que escribe Hermes y no es
  una lista de herramientas activas.
- **Toolsets activos de la plataforma `cli`:** son `file,terminal,memory,session_search,skills,todo`,
  más `web` en 7 perfiles y `mcpdtd_alfred` en `telegram`. Ninguno incluye `browser`.
- **Lo que manda Paperclip:** pasa `-t` explícito sin `browser` en cada corrida [MEDIDO en la
  base y CÓDIGO].

**Los argumentos que Paperclip pasa a Hermes siguen valiendo [CÓDIGO]:**

- El adaptador arma la misma línea en 1012 y 1106 (`hermes/src/server/execute.ts:458-496`):
  `chat -q … -Q -m … --provider … -t … --max-turns … --source tool --yolo` y, si hubiera sesión,
  `--resume`.
- Todas esas banderas existen en el parser de Hermes v0.23.0 (`hermes_cli/_parser.py`). Lo único
  nuevo son `--cpu-profile`, `--base-url` y `--api-key`, opcionales.

**Lo que sigue abierto en la reanudación de sesiones:**

| Issue | Estado | Qué hace |
|---|---|---|
| #18314 | Abierto. La PR #18434 lo arreglaría y sigue abierta | Con Hermes 0.22.4 o más, Paperclip descarta el id `local-…` y nunca reanuda |
| #18316 | Abierto. La PR #18528 lo arreglaría y sigue abierta | Al reanudar, Paperclip reenvía `-m`, `--provider` y `-t`, y Hermes 0.22.4 o más responde con salida 2 |

**Por qué no frena la actualización:**

- **Hoy ya no se reanuda.** Hay 0 sesiones de tarea guardadas para `hermes_local` y 0 agentes
  Hermes con sesión en su estado [MEDIDO]. Es el «`persistSession` no guarda sesión» del handoff
  de la SDD-0615. Con 0.23 sigue igual: cada despertar empieza una sesión nueva y reenvía la
  historia de la tarea.
- **El #18316 no tiene con qué dispararse:** no hay ids viejos que reanudar.

**Trampa para el futuro.** Si una versión de Paperclip trae la #18434 sin la #18528, las
reanudaciones empiezan a fallar con salida 2. Antes de la siguiente actualización hay que revisar
las dos.

**Otros cambios de 0.23 que tocan a la oficina:**

- **El gateway único.** Cada perfil tiene un solo gateway, y la CLI se conecta a él [NOTAS]. En
  0.23 el cliente le pasa al gateway sus variables de comportamiento, entre ellas
  `HERMES_EPHEMERAL_SYSTEM_PROMPT` (`agent/session_client_env.py:23`) [CÓDIGO].
- **Procesos que sobreviven a la corrida [INFERENCIA].** Puede quedar un proceso de gateway por
  perfil, vivo después de la corrida. Hoy `agentes-run` tiene 1 `hermes` y 2 `python3`
  [MEDIDO]. La prueba 5.3 cuenta procesos antes y después.

### 2.5 Riesgo nuevo, el que más importa: las instrucciones de los GLM no pasarían por sudo

**Qué cambia [NOTAS 1023 #15439, CÓDIGO 1106 `hermes/src/server/execute.ts:507-517`].** Paperclip
ya no pega las instrucciones del agente (la pantalla Instructions) al principio del prompt. Ahora
las manda en la variable `HERMES_EPHEMERAL_SYSTEM_PROMPT`, junto con el bloque que le enseña a
usar la API de Paperclip (`curl … PATCH $api/issues/$PAPERCLIP_TASK_ID`). Si no hay
`promptTemplate`, el `-q` ya no trae la plantilla de antes.

**Por qué se perdía.** `dtd-hermes` corre `sudo -n -u agentes-run … dtd-agente-run hermes`. El
sudoers que estaba instalado al empezar esta evaluación (`52ade946…`) tenía `env_reset` y dejaba
pasar solo `PAPERCLIP_* DTD_PERFIL CLAUDE_CODE_OAUTH_TOKEN TERM LANG LC_ALL LC_CTYPE` [MEDIDO en
`/etc/sudoers.d/91-agentes-run` el 2026-11-07, antes de la SDD-0615]. La variable nueva no empieza
con `PAPERCLIP_`, así que sudo la borraba.

**Hoy ya pasa.** El sudoers de `main` (`66b5cd84…`, instalado por la SDD-0615) no usa el comodín:
nombra 14 variables `PAPERCLIP_` una por una y agrega `HERMES_EPHEMERAL_SYSTEM_PROMPT`. El §6
compara esa lista con lo que manda la 1106.

**Efecto [INFERENCIA, muy probable].** Los agentes GLM corren con su `SOUL.md`, pero:

- sin las instrucciones de su puesto;
- sin saber cómo marcar la tarea en Paperclip.

Las tareas quedarían abiertas o mal cerradas. Hermes v0.22.2 y v0.23.0 leen la variable
(`cli_init_mixin.py`, `gateway/run_config_loaders.py`) [CÓDIGO], así que el arreglo es solo de
sudo.

**Cambio A, hecho.** `HERMES_EPHEMERAL_SYSTEM_PROMPT` está en el `env_keep` de
`infra/oficina/envoltorios/91-agentes-run`, con su prueba y su mutante. Entró con la SDD-0615
(PR #407) y no con una SDD aparte. Con la 1012 no cambia nada, porque la variable no viene.

**`PAPERCLIP_AGENT_PRIVATE_KEY` ya no pasa [NOTAS 1023 #15352, CÓDIGO 1106].** Desde la 1023 cada
corrida recibe la llave privada Ed25519 del agente, junto con `PAPERCLIP_AGENT_KEY_ID` y
`PAPERCLIP_AGENT_PUBLIC_KEY` (`adapter-utils/src/server-utils.ts:3219-3229`).

- Con el comodín del sudoers viejo, habría llegado al usuario de cada motor.
- El sudoers de `main` no la nombra, así que sudo la borra.
- Nuestros agentes no la necesitan: hablan con la API por `curl`, con `PAPERCLIP_API_KEY`.

### 2.6 Otros cambios revisados

| Cambio | Versión | Efecto aquí |
|---|---|---|
| El preset Operator pasa de 1 permiso a 14 | 1023 | Revisar los roles de los miembros. **NO MEDIDO**: la consulta falló por el nombre de la columna. Si solo está Sam como dueño, no cambia nada |
| Migraciones `0306`–`0374` | 1023 y 1106 | La base pesa 102 MB [MEDIDO]. Las largas (`0313`, `0343`, `0345`, `0369`) se pueden repetir si se cortan [NOTAS] |
| La lista de corridas de la API devuelve como máximo 200 filas por defecto | 1106 | Ningún script del repositorio llama a `heartbeat-runs` [MEDIDO con `git grep`] |
| `instructions-file:delete` pide `--yes`; desaparecen las Pipelines; Sentry apagado por defecto | 1106 | No usamos ninguno |
| `commentary:view` para todo humano; se ocultan las tareas creadas por agentes en las listas | 1106 | Solo visual. Para ver las subtareas de ALFRED hay que activar «show agent-created tasks» |
| Limpieza de espacios de trabajo terminados después de 1 h | 1106 | Borra solo lo que el `.gitignore` ignora, no las fuentes. Las carpetas `/srv/oficina/trabajo/<perfil>` no son espacios de Paperclip [INFERENCIA] |
| Hermes: escritorio con Electron 44, Webapp apagada por defecto, `hermes mcp serve` pasa a `hermes mcp-serve` | 0.23 | No usamos el escritorio ni ese servidor MCP |

**Línea base antes de tocar nada [MEDIDO, últimos 14 días]:**

| Motor | Corridas | Bien | Fallaron |
|---|---|---|---|
| Hermes | 8 | 2 | 6 |
| Claude | 37 | 36 | 1 |
| Codex | 5 | 4 | 1 |

- Claude incluye las corridas Hermes de ALFRED de antes del cambio de motor.
- **Al medir la línea base**, «Asesor comercial» y «Jefe de gabinete» estaban en `error`.
- **Después:** el Jefe de gabinete pasó la prueba 5.3 con Hermes 0.23 (HAI-65, §7), así que su
  `error` no viene del motor. El Asesor comercial no se volvió a medir.
- Las pruebas de humo se comparan contra esta línea base, no contra una oficina perfecta.

## 3. Orden de actualización

Cada paso lo autoriza Sam por separado. «Instalar» y «actualizar» son operaciones en el VPS de la
oficina y no están cubiertas por este documento.

### Paso 0 · En el repositorio, sin tocar el VPS (hecho)

1. **C:** la PR #407 entró a `main` en `7e75f7708`.
2. **A:** el cambio de `env_keep`, con su prueba y su mutante, entró en la misma PR #407 (SDD-0615).
3. **Hojas de alta:** esta PR agrega «Legacy runner» y la regla de no presionar «Upgrade runner»
   en `configuracion-paperclip.md`. También cambia las dos reglas que prohibían Paperclip 1023+ y
   Hermes 0.22.4+.

### Paso 1 · Hermes v0.23.0 (ventana corta, Paperclip sigue en 1012)

> **Hecho el 2026-11-07** con el OK de Sam. El resultado y el procedimiento que se corrió están en
> la §7. Esa sección corrige esta: el respaldo también lleva `~agentes/.hermes`, hay que detener
> `dtd-hermes-telegram.service` y hay tres capas que actualizar.

1. **Comprobar que no hay corridas vivas ni en cola** (consulta de §5.0).
2. **Respaldo** como root, con la oficina quieta. Ocupa unos 4 GB y hay 40 GB libres [MEDIDO]:

   ```bash
   sello=$(date -u +%Y%m%dT%H%M%SZ); dest=/root/respaldo-hermes-0230-$sello; mkdir -p "$dest"
   tar -C / -czf "$dest/opt-hermes.tgz" opt/hermes
   tar -C / -czf "$dest/hermes-agentes-run.tgz" home/agentes-run/.hermes
   sha256sum "$dest"/*.tgz > "$dest/SHA256SUMS"
   ```

3. **Instalar** con el mismo método del paso 5 de la SDD-0564: el `install.sh` oficial, leído
   antes de correrlo y con su sha256 anotado, fijado con `--commit
   2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19` (la etiqueta `v0.23.0`).
   - El dueño actual de `/opt/hermes` es root [MEDIDO]. El procedimiento exacto (usuario y
     banderas) se copia del handoff de la SDD-0564, no se improvisa.
4. **Pruebas de humo:** 5.3 (un agente GLM) y 5.5 (Hermes directo).
5. **Volver atrás**, si algo falla:
   - detener a los agentes GLM (pausarlos en Paperclip);
   - restaurar los dos `.tgz` sobre `/` (antes, comprobar `SHA256SUMS`);
   - repetir 5.3.

   Las sesiones y la memoria escritas después del respaldo se pierden: con la oficina quieta, es
   poco o nada.

### Paso 2 · Cambios previos a Paperclip, con la 1012 todavía

1. **A en el VPS:** instalar el `91-agentes-run` nuevo.
   - Comparar antes el sha256 del archivo vivo con el anotado. Al empezar era `52ade946…`; desde
     la SDD-0615 es `66b5cd84…`.
   - Respaldarlo y correr `visudo -c`.
   - Prueba: un agente GLM sigue corriendo con la 1012 (5.3).
2. **B:** Sam apaga el corte duro de las 8 políticas vivas en la pantalla de presupuestos.
   Después se comprueba en la base (§5.0) que las 8 quedaron con `hard_stop_enabled = false`.

> **A, B y C, hechos el 2026-11-07.**
>
> - **A:** la sesión de la SDD-0615 instaló hacia las 14:50Z el sudoers `66b5cd84…`, que ya deja
>   pasar `HERMES_EPHEMERAL_SYSTEM_PROMPT`. Su respaldo está en
>   `/root/respaldo-sdd-0615-dg-20261107T144934Z`.
> - **C:** la PR #407 entró a `main` en `7e75f7708`.
>   - Entre las 17:51 y las 17:52Z se reinstalaron desde ese commit `dtd-motor` (`d522b2ed…`),
>     `dtd-agente-run` (`86fb1b5a…`), el sudoers (`66b5cd84…`), `dtd-claude`, `dtd-codex` y el
>     `settings.json` de ALFRED, con huellas iguales a `main`.
>   - Autorización: Sam, en el chat del DG, «Sí, reinstálalos».
>   - Respaldo: `/root/respaldo-sdd-0615-main-20261107T175112Z`.
>   - Las pruebas de humo pasaron. Con la variable de Hermes puesta, Claude, Codex y Hermes
>     respondieron con exit 0, y la variable le llegó solo a Hermes.
> - **B:** lo hizo la sesión de esta PR a las 15:38Z, con el OK de Sam en su chat, literal
>   «Sí, apágalo».
>   - **Cómo:** `POST /api/companies/<empresa>/budgets/policies` desde la sesión de Sam en el
>     navegador integrado. Se repitieron los valores de cada política y solo cambió
>     `hardStopEnabled: false`.
>   - **Comprobación en la base, en solo lectura:** las 8 vivas tienen `hard_stop_enabled = false`
>     y conservan su monto y el aviso al 80 %. Son ALFRED, Jefe de gabinete, Puente de ingeniería,
>     Editor de contenido, Asesor comercial, Community manager asistente, Analista de CRM/datos y
>     Analista de operaciones.
>   - **Sin tocar:** las 6 de agentes terminados.
>   - **Incidentes:** 0.

### Paso 3 · Paperclip 2026.1106.0 (ventana de unos 30 minutos)

**Requisito:** el §6 («Antes de la ventana») cumplido el mismo día, y el OK de Sam nombrando el VPS
de la oficina.

Todo corre como el usuario administrador del VPS, con `sudo`. Para entrar como `agentes` con su
sesión de systemd:

```bash
A() { sudo -n -u agentes -H env XDG_RUNTIME_DIR=/run/user/$(id -u agentes) bash -lc "$*"; }
```

1. **Comprobar y ensayar, con el servicio encendido.**
   - Las consultas de §5.0: 0 corridas vivas o en cola, 304 migraciones, las 8 políticas con
     `hard_stop_enabled = false` y 0 incidentes.
   - Que ningún disparo de rutina caiga dentro de la ventana, más 30 minutos. Hoy son a las
     11:00 UTC todos los días y el viernes a las 18:00 UTC.
   - El ensayo no cambia nada y tiene que decir «Would update paperclipai 2026.1012.0 →
     2026.1106.0»:

     ```bash
     A 'paperclipai update --version 2026.1106.0 --dry-run'
     ```

2. **Detener el puente y Paperclip, y comprobar que nadie los vuelve a encender.**

   ```bash
   sudo systemctl stop dtd-alfred-bridge.service
   A 'systemctl --user stop paperclip.service'
   A 'systemctl --user is-active paperclip.service'; sleep 30; A 'systemctl --user is-active paperclip.service'
   ```

   - Las dos lecturas tienen que dar `inactive`.
   - Con un `stop` explícito, systemd no reinicia la unidad aunque tenga `Restart=`.
   - El puente le habla a Paperclip con la llave de ALFRED. Detenido, no crea ni comenta tareas
     que se perderían al volver atrás. Guarda sus encargos en su SQLite.

3. **Respaldo en frío, con el servicio detenido y `umask 077`.** El `.tgz` lleva la base y llaves:

   ```bash
   A 'set -e; umask 077
   sello=$(date -u +%Y%m%dT%H%M%SZ); dest=$HOME/respaldo-paperclip-1106-$sello; mkdir "$dest"
   tar -C "$HOME/.paperclip" -czf "$dest/instancia-default.tgz" instances/default
   tar -C "$HOME/.paperclip" -czf "$dest/cli.tgz" cli
   tar -C "$HOME" -czf "$dest/config.tgz" .config/paperclip/paperclip.env \
     .config/systemd/user/paperclip.service .local/bin/paperclipai .paperclip/auth.json
   cd "$dest" && sha256sum instancia-default.tgz cli.tgz config.tgz > SHA256SUMS && sha256sum -c SHA256SUMS
   echo "$dest"'
   ```

   - **Qué cubre:**
     - la base;
     - el programa, con la 1012 activa;
     - la configuración con sus secretos;
     - la unidad;
     - el lanzador;
     - la sesión de la CLI.
   - **Dónde queda:** `SHA256SUMS` cubre los tres archivos. Todo queda en la casa de `agentes`,
     con 700 y 600, y no sale del VPS.
   - **Qué se anota:** la ruta de `dest` y las tres huellas cortas.

4. **Actualizar, con el servicio todavía detenido y `umask 022`.**

   ```bash
   A 'umask 022; paperclipai update --version 2026.1106.0 --no-backup'
   ```

   - **Por qué `umask 022`:** la instalación de la 1106 falla con la `umask 0002` de Ubuntu: «Copilot
     executable has unsafe permissions». El #17208 está abierto y en sus comentarios se confirma
     en la 1106.
   - **Por qué `--no-backup`:**
     - el respaldo propio de `update` necesita la base encendida (`cli/src/commands/update.ts:51-63`)
       [CÓDIGO];
     - encender Paperclip entre la copia en frío y la actualización abre un hueco: lo que se
       escriba ahí se pierde al volver atrás;
     - la copia en frío del punto 3 es más completa que esa exportación.
   - **Qué tiene que salir:** «Updated paperclipai 2026.1012.0 → 2026.1106.0», **sin** «and
     restarted». El comando solo reinicia `paperclipai.service`, el servicio que administra él
     (`cli/src/services/service-manager.ts:120`) [CÓDIGO]. El nuestro es `paperclip.service`, de la
     SDD-0564, y la base todavía no se toca.
   - **Si dice «restarted» o «rolled back»:** existe un `paperclipai.service` que no conocíamos.
     Se detienen los dos servicios en el acto y se sigue la vuelta atrás desde su punto 2.
   - **Si la instalación falla:** la 1012 sigue activa y la base no migró.
     - Se comprueba que `paperclipai --version` dice `2026.1012.0`.
     - Se arranca el servicio y se enciende el puente.
     - Se cierra la ventana sin restaurar nada.

5. **Comprobar** que `A 'paperclipai --version'` dice `2026.1106.0`.

6. **Arrancar y esperar las migraciones:**

   ```bash
   A 'systemctl --user start paperclip.service'
   for i in $(seq 1 60); do
     r=$(curl -s -m 3 http://127.0.0.1:3100/api/health) && echo "$r" | grep -q '"status":"ok"' && break
     sleep 10; done; echo "$r"
   A 'journalctl --user -u paperclip.service --since "-15 min" --no-pager' | grep -iE 'migrat|error' | tail -20
   ```

   - **Las migraciones se aplican solas.** Sin terminal, el servidor las aplica al arrancar
     (`server/src/index.ts:275-278`) [CÓDIGO]. `paperclip.env` no define
     `PAPERCLIP_MIGRATION_PROMPT` [MEDIDO, solo los nombres].
   - **Son 69, de la `0306` a la `0374`.** Las largas (`0313`, `0343`, `0345`, `0369`) se pueden
     repetir si se cortan [NOTAS].

7. **Conteo de migraciones** (§5.0): tiene que dar **373**, el número de archivos de migración de
   la 1106 y de entradas de su `_journal.json` [CÓDIGO]. Hoy hay 304 [MEDIDO, igual a los archivos
   de la 1012].

8. **ALFRED y el Auxiliar no cambiaron de runner** (consulta «motores» de §5.0):
   - ALFRED sigue en `claude_local`, `engine` `cli`, `/usr/local/bin/dtd-claude`;
   - el Auxiliar, en `codex_local`, `cli`, `/usr/local/bin/dtd-codex`;
   - `ps -u agentes -o pid=,args=` no muestra procesos de Runner nuevos.

9. **Poner `unpricedUsagePolicy = allow`** en las 8 políticas vivas, antes de la primera corrida
   GLM.
   - **Cómo:** Sam lo hace en la pantalla de presupuestos, o autoriza hacerlo por la API con su
     sesión, como el cambio B (`POST /api/companies/<empresa>/budgets/policies`).
   - **Por la API se repiten todos los valores actuales:** `scopeType`, `scopeId`, `metric`,
     `windowKind`, `amount`, `warnPercent` 80, `hardStopEnabled: false`, `notifyEnabled: true`,
     `isActive: true`, y se agrega `unpricedUsagePolicy: "allow"`. En la 1106 un campo omitido
     conserva su valor (`server/src/services/budgets.ts:776-779`) [CÓDIGO], pero no se depende de
     eso.
   - **Comprobación:** las 8 con `unpriced_usage_policy = 'allow'` y `hard_stop_enabled = false`.

10. **Pruebas de humo:** 5.1 a 5.4 y, si da el tiempo, 5.6.

11. **Encender el puente** con `sudo systemctl start dtd-alfred-bridge.service`, revisar que su
    registro no muestra errores 401 ni 404 contra Paperclip, y que Sam escriba en `#alfred`.

**Criterios de parada.** Cualquiera de estos lleva a la vuelta atrás:

- el conteo de migraciones no da 373;
- la salud no responde `ok` con `2026.1106.0` dentro de los 10 minutos del punto 6;
- aparece un incidente de presupuesto, un agente vivo queda en `paused` por presupuesto o con
  `lifecycle_holds` no vacío;
- 5.1 o 5.3 fallan por la 1106 y no por la línea base. Por ejemplo, si el envoltorio sale con 64
  porque no llegó `DTD_PERFIL` (#19887);
- ALFRED o el Auxiliar cambian de `adapter_type` o de `engine`, o aparece un proceso de Runner.

**Si la caída pasa de 15 minutos** sin que la salud dé `ok`:

- Si el registro muestra migraciones avanzando, Sam decide si espera hasta 30.
- Si no, se vuelve atrás.

**Volver atrás.** Las migraciones no se revierten; lo dice el propio `--rollback` [CÓDIGO]. Por eso
se restaura la copia en frío. **Nunca se arranca la 1012 sobre la base migrada**, y por eso
`paperclipai update --rollback` no es el primer paso: cambia el programa pero no la base.

1. **Que no corra nada.** Si el servidor responde, se cancelan las corridas vivas desde la
   pantalla. El puente sigue detenido.
2. **Detener Paperclip** y comprobar que quedó detenido:

   ```bash
   A 'systemctl --user stop paperclip.service'
   A 'systemctl --user is-active paperclip.service'; sleep 30; A 'systemctl --user is-active paperclip.service'
   ```

   Las dos lecturas dan `inactive`. Si el comando de actualización volvió solo a la 1012, también
   se detiene primero.
3. **Comprobar el respaldo:** `A 'cd <dest> && sha256sum -c SHA256SUMS'` da todo OK.
4. **Poner a un lado lo de la 1106, sin borrarlo:**

   ```bash
   A 's=$(date -u +%Y%m%dT%H%M%SZ); cd "$HOME/.paperclip" && mv instances/default "instances/default.1106-$s" && mv cli "cli.1106-$s"'
   ```

5. **Restaurar la base, el programa y la configuración**, con `umask 077`:

   ```bash
   A 'set -e; umask 077; tar -C "$HOME/.paperclip" -xzf <dest>/instancia-default.tgz
   tar -C "$HOME/.paperclip" -xzf <dest>/cli.tgz; tar -C "$HOME" -xzf <dest>/config.tgz
   systemctl --user daemon-reload; paperclipai --version'
   ```

   Restaurar `cli.tgz` ya deja activa la 1012: `paperclipai --version` tiene que decir
   `2026.1012.0` **antes** de arrancar.
6. **Recién ahora, arrancar:** `A 'systemctl --user start paperclip.service'`.
   - La salud responde `ok` con `2026.1012.0`.
   - El conteo de migraciones vuelve a **304**.
   - Las 8 políticas siguen sin corte duro: el respaldo es posterior al cambio B.
7. **Repetir 5.1 a 5.4 contra la 1012**, con tareas nuevas.
8. **Encender el puente** y que Sam confirme en `#alfred`.

**Lo que se pierde:** lo escrito en Paperclip entre la copia en frío y la vuelta atrás. Con la
ventana quieta, son solo las tareas de prueba. Las carpetas `default.1106-…` y `cli.1106-…` se
quedan hasta que Sam decida qué hacer con ellas.

## 4. Lo que no se hace

- Actualizar Paperclip sin los cambios A y B instalados.
- Presionar «Upgrade runner» en ALFRED o en el Auxiliar.
- Encender el corte duro de un presupuesto mientras siga abierto el #18956.
- Actualizar Paperclip y Hermes en la misma ventana: si algo falla, no se sabría cuál fue.
- Saltar el respaldo en frío. Es la vuelta atrás que no depende de Paperclip.
- Encender Paperclip entre la copia en frío y la actualización.
- Arrancar la 1012 sobre la base migrada, o empezar la vuelta atrás con `paperclipai update
  --rollback` con el servicio encendido.
- Correr `paperclipai update` sin `umask 022` (#17208).
- Crear tareas de prueba sin proyecto o con `[/` en el texto (HAI-51).
- Ejecutar el paso 3 sin cumplir el §6 el mismo día.

## 5. Pruebas de humo

Cada prueba usa una tarea creada para eso, con el título «Prueba de humo — actualización» y la
fecha. Se asigna desde la pantalla a nombre de Sam, o por la API con su sesión y su OK. Pasa si se
cumple todo lo que dice «Pasa si». Las lecturas de la base van con
`SET default_transaction_read_only = on`.

**Reglas para las tareas de prueba:**

- **Llevan proyecto.** Una tarea sin proyecto corre en el espacio de trabajo de respaldo de
  Paperclip, dentro de `~agentes`, y no en la carpeta del agente (§7).
- **El texto no lleva `[/`.** Hermes 0.23 sale con exit 1 antes de llamar al modelo si la tarea lo
  trae (HAI-51, Hermes #98789, abierto; §7). Tampoco se pegan enlaces internos de Paperclip.

### 5.0 Consultas de control (solo lectura)

```sql
SET default_transaction_read_only = on;
-- corridas vivas o en cola (debe dar 0 filas antes de cada ventana)
select status, count(*) from heartbeat_runs where status in ('queued','running') group by 1;
-- políticas vivas: corte duro y uso sin precio (la segunda columna existe desde 1023)
select a.name, bp.hard_stop_enabled, bp.unpriced_usage_policy
from budget_policies bp join agents a on a.id = bp.scope_id
where bp.scope_type = 'agent' and a.status <> 'terminated';
-- incidentes y retenciones
select status, count(*) from budget_incidents group by 1;
select name, status, pause_reason, lifecycle_holds from agents where status <> 'terminated';
-- última migración
select count(*), max(created_at) from drizzle.__drizzle_migrations;
-- motores: adaptador, engine y comando de los agentes vivos
select name, adapter_type, adapter_config->>'engine' as engine, adapter_config->>'command' as command
from agents where status <> 'terminated' order by name;
-- próximos disparos de rutinas
select r.title, rt.next_run_at from routine_triggers rt join routines r on r.id = rt.routine_id
where rt.enabled and r.status = 'active' order by rt.next_run_at;
-- eventos de costo de las pruebas de hoy
select a.name, ce.billing_type, ce.cost_status, ce.cost_cents
from cost_events ce join agents a on a.id = ce.agent_id
where ce.occurred_at > now() - interval '2 hours' order by ce.occurred_at;
```

`lifecycle_holds` y `unpriced_usage_policy` existen solo desde la 1023; en la 1012 se quitan de la
consulta.

### 5.1 ALFRED (Claude Code)

**Tarea:** «Lee tu bandeja, no crees subtareas, responde "prueba de humo sin novedades" en un
comentario y deja esta tarea en `done`».

**Pasa si:**

- La corrida termina `succeeded` con `exit_code 0`.
- El log muestra `/usr/local/bin/dtd-claude` y el modelo `claude-fable-5-1`.
- Durante la corrida, `ps -o user= -C claude` muestra `agentes-alfred`.
- El comentario aparece y la tarea queda en `done`.
- Hay un evento de costo `subscription_included`.
- ALFRED no queda retenido y no aparece ningún incidente de presupuesto.
- La pantalla de ALFRED sigue en el runner legado: no aparece como Runner.

### 5.2 Auxiliar de ALFRED (Codex)

**Tarea:** una subtarea de la de 5.1, «Crítica de prueba: escribe el documento `critica` con una
línea y cierra con "sin objeciones mayores"», asignada al Auxiliar.

**Pasa si:**

- No aparece `configuration incomplete`, y la corrida termina `succeeded`.
- Codex corre como `agentes-auxiliar`.
- El documento `critica` existe y la subtarea queda cerrada.
- Hay un evento `subscription_included`.
- El Auxiliar no queda retenido.
- **De paso:** ver si sigue el `HTTP 403` de `rmcp` que el handoff dejó como NO VERIFICADO.

### 5.3 Un agente GLM (Hermes)

**Agente:** uno en `idle`, por ejemplo «Puente de ingeniería». No sirven los que están en
`error`.

**Tarea:** «Responde en un comentario: ¿qué no puedes hacer nunca en tu puesto? Después deja esta
tarea en `done`».

**Pasa si:**

- **Las instrucciones llegan.** La respuesta cita lo que dicen sus instrucciones de Paperclip, no
  solo su `SOUL.md`. Es la prueba del cambio A: sin él, en 1106 el agente no sabría responderlo.
- **La API funciona.** La tarea queda en `done` hecha por el propio agente, lo que prueba que
  recibió el bloque de la API.
- **La corrida termina `succeeded`.**
- **En 1106 hay un evento `unknown`/`unpriced` y aun así el agente no queda retenido.** Es la
  prueba del cambio B.
- **No quedan procesos de más.** La cuenta de procesos de `agentes-run` (`ps -u agentes-run -o
  comm= | sort | uniq -c`) vuelve, a los 5 minutos de terminar, a lo que había antes (hoy, 1
  `hermes` y 2 `python3`), o crece en un solo gateway por perfil usado.
- **sudo no guarda el prompt.** El registro de sudo no muestra los argumentos (`!log_allowed`).

### 5.4 Rutinas

1. Con «Run now» en «Latido diario del CEO» (o esperando las 11:00 UTC), la rutina crea su tarea.
2. ALFRED la toma.

**Pasa si:**

- La corrida termina `succeeded`.
- `routine_triggers.last_fired_at` se actualiza.
- `next_run_at` pasa al día siguiente a las 11:00 UTC.
- «Parte del viernes» sigue con `next_run_at` el 2026-11-13 a las 18:00 UTC.
- **Si es 1106:** el disparo sale a su hora y no en el siguiente barrido (#16514 [NOTAS]).

### 5.5 Hermes directo (solo en el paso 1)

1. Como `agentes`, con `DTD_PERFIL=prueba`: `/usr/local/bin/dtd-hermes chat -q "di hola" -Q -m
   glm-5.3 --provider zai -t file,todo --source tool --yolo`.
2. Comprobar que responde, que imprime una línea `session_id:` y que un perfil fuera de la lista
   sigue dando 64.

### 5.6 Cancelación (opcional, después de 5.3 en 1106)

1. Iniciar una corrida GLM larga y cancelarla desde la pantalla.

**Pasa si:** el agente no queda en `pausing` ni retenido, y la consulta de incidentes sigue en
cero. Es la prueba de que el cambio B cubre el #18956.

## 6. Antes de la ventana de Paperclip

El paso 3 no se ejecuta hasta que todo esto esté cumplido o aceptado. Las secciones 6.2 a 6.6 se
midieron en el código el 2026-11-07, sin entrar al VPS. El 6.1 y el 6.7 se repiten el día de la
ventana.

### 6.1 Versión e issues, el mismo día

```bash
gh release list -R paperclipai/paperclip --limit 5
gh search issues --repo paperclipai/paperclip "1106" --state open --limit 40
for n in 18956 18314 18316 19588 17208 19885 19887; do
  gh issue view $n -R paperclipai/paperclip --json number,state,updatedAt; done
```

- **Si salió una 1106.1,** se para y se evalúa esa con este mismo documento.
- **Si aparece un reporte nuevo** de pérdida de datos, migración que no termina o agentes que no
  arrancan después de actualizar, también se para.

**Lo que dio la revisión del 2026-11-07, hacia las 19:40Z [ISSUE]:**

- **Versión:** la última es la `v2026.1106.0`, publicada el 2026-11-06 a las 22:31Z. No hay 1106.1.
- **#18956, #18314 y #18316:** abiertos. Los cubren el cambio B y que no haya sesiones Hermes
  guardadas (§2.2 y §2.4).
- **#17208, abierto:** la actualización de la 1106 falla con `umask 0002`, y en sus comentarios se
  confirma en la 1106. **El paso 3 corre `update` con `umask 022`.**
- **#19887, abierto:** las variables de entorno guardadas como objeto no llegan a la corrida.
  - **Dónde falla:** en el motor ACP y en el chequeo del entorno.
  - **Por qué no debería tocarnos [INFERENCIA]:** nuestros agentes usan `engine: cli`, y la mezcla
    de `config.env` de `claude_local` y `hermes_local` es igual en la 1012 y en la 1106 [CÓDIGO].
  - **Cómo se comprueba:** si `DTD_PERFIL` no llegara, el envoltorio saldría con 64. Lo miden 5.1
    a 5.3, y es un criterio de parada.
- **#19885, abierto:** las corridas de los adaptadores `process` y `http` escriben un cargo sin
  precio de $0 y la política por defecto pausa la empresa. No usamos esos adaptadores, no hay
  políticas de empresa y el cambio B apagó el corte duro.
- **#19588:** la subtarea terminada que el padre no ve. Se vigila en 5.2.
- **#19820:** no aplica, porque Sam entra por `localhost` con el túnel.

### 6.2 Variables que manda la 1106 contra el sudoers de `main` [CÓDIGO 1106]

El sudoers de `main` deja pasar 14 variables `PAPERCLIP_` nombradas una por una,
`HERMES_EPHEMERAL_SYSTEM_PROMPT`, `DTD_PERFIL`, `CLAUDE_CODE_OAUTH_TOKEN` y las de idioma.

| Variable | Quién la manda en la 1106 | ¿Pasa sudo? | Efecto |
|---|---|---|---|
| `PAPERCLIP_API_URL`, `_API_KEY`, `_RUN_ID`, `_TASK_ID`, `_AGENT_ID`, `_COMPANY_ID`, `_WAKE_REASON`, `_WAKE_COMMENT_ID` | Adaptador de Hermes (`hermes/src/server/execute.ts:503-534`) | Sí | Es lo que usa el bloque de la API para cerrar la tarea con `curl` |
| `HERMES_EPHEMERAL_SYSTEM_PROMPT` | Adaptador de Hermes (`execute.ts:507-517`) | Sí (cambio A) | Lleva las instrucciones del puesto y el bloque de la API |
| `PAPERCLIP_WAKE_PAYLOAD_JSON` | La 1106 la borra en Hermes (`execute.ts:524`) | No viene | El contexto del despertar va en el prompt |
| `PAPERCLIP_AGENT_KEY_ID`, `_PUBLIC_KEY`, `_PRIVATE_KEY` | Todas las corridas desde la 1023 | No | No hacen falta. Mejor así: la llave privada no sale de `agentes` |
| `PAPERCLIP_RUNTIME_TOOLS_*` | Solo si el agente tiene herramientas de conexiones de IA | No | No las usamos |
| `PAPERCLIP_ISSUE_WORK_MODE`, `_WORKSPACES_JSON`, `_RUNTIME_SERVICES_JSON`, `_RUNTIME_SERVICE_INTENTS_JSON`, `_RUNTIME_PRIMARY_URL`, `_WORKSPACE_REALIZATION_MODE`, `_WORKSPACE_AUTHORITATIVE_ROOT` | Adaptadores de Claude y Codex | No | Ya las mandaba la 1012 y hoy tampoco pasan. No cambia nada |

**Las skills de la 1106** (`paperclip`, `paperclip-converting-plans-to-tasks` y las demás de
`skills/`):

- usan solo variables de la lista;
- la única excepción es `PAPERCLIP_WORKSPACE_CWD`, en un solo lugar (`paperclip-upload-artifact.sh:117`),
  y ahí es un respaldo que termina en `$PWD`.

**Conclusión:** 5.3 no debería fallar por el sudoers. La prueba 5.3 lo confirma.

### 6.3 El Runner y el `engine` de los agentes existentes [CÓDIGO 1106]

- **Cuándo se elige el Runner:** al crear un agente (`resolveNewAgentRunner`,
  `server/src/services/agent-runner-selection.ts:123`) o con «Upgrade runner». El agente queda
  con `adapter_type = 'paperclip_runner'`.
- **Las migraciones no lo cambian.** Ninguna de la `0306` a la `0374` cambia `adapter_type` ni el
  `engine` de `agents`. Las dos que actualizan `agents` son la `0320` (estado de ciclo de vida,
  sacado de `status` y `pause_reason`) y la `0343` (`created_by_user_id`).
- **No hay Runner propio [INFERENCIA, no se siguió todo el arranque].** El Runner corre bajo el
  proceso de Paperclip, como `agentes` y sin el aislamiento por usuario, solo para los agentes
  `paperclip_runner`. Hoy no tenemos ninguno.
- **Comprobación en la ventana:** la consulta «motores» de §5.0 antes y después, y `ps -u agentes`
  sin procesos nuevos (paso 3, punto 8).

### 6.4 Presupuesto: riesgo que se acepta

- **Ningún tope en dólares frena a nadie.** Con el cambio B ninguna política tiene corte duro.
  Paperclip no le pone precio a nada nuestro: Claude y Codex son `subscription_included` y Hermes
  es `unpriced`.
- **Lo que sí frena:**
  - a los GLM, solo la cuota del plan de z.ai;
  - a ALFRED y al Auxiliar, la de sus planes.
- **El aviso al 80 % queda encendido,** pero con gasto en cero no salta.
- **Sam acepta este riesgo al dar el OK de la ventana.** Mientras siga abierto el #18956, el corte
  duro no se vuelve a encender.
- **`unpricedUsagePolicy = allow`** se fija en el paso 3, punto 9, por pantalla o por la API con
  todos los valores.

### 6.5 Qué pasa durante la caída

| Pieza | Durante la ventana | Qué hacer |
|---|---|---|
| `#alfred` (la recepción, `dtd-hermes-telegram.service`) | Hermes sigue respondiendo, pero lo que pasa por el puente falla: encargar, consultar y comentar tareas | Sam no escribe en `#alfred` durante la ventana |
| Telegram | Cortado desde el 2026-11-05 (`docs/runbooks/oficina-corte-discord.md`). Revocar el bot sigue pendiente | Nada |
| Puente de ALFRED (`dtd-alfred-bridge.service`) | Detenido a propósito (paso 3, punto 2). Guarda encargos y avisos en su SQLite | Se enciende en el punto 11 o al final de la vuelta atrás |
| Rutinas | Un disparo que caiga dentro de la ventana se salta: `catch_up_policy = skip_missed` por defecto [CÓDIGO 1012] | La ventana va lejos de las 11:00 UTC y del viernes a las 18:00 UTC |
| Latidos por tiempo | Apagados en las hojas de alta (`configuracion-paperclip.md`) | La consulta de agentes de §5.0 lo confirma |
| Paperclip | Sin pantalla ni API desde el punto 2 hasta el 6. Con migraciones, unos 5 a 15 minutos [INFERENCIA] | Si pasa de 15 minutos, ver los criterios de parada del paso 3 |

### 6.6 Node y espacio

- **Node:** la 1106 pide `>=24.11.0` (`engines` de `package.json`, `cli` y `server`), igual que la
  1012 [CÓDIGO]. `agentes` tiene `v24.22.1` [MEDIDO 2026-11-07]. Hermes trae su propio Node.
- **Espacio:** hace falta lugar para cuatro cosas:
  - la copia en frío, con la instancia de unos 420 MB sin comprimir [MEDIDO];
  - la carpeta de la 1106, que no se midió;
  - la base migrada que queda a un lado si se vuelve atrás;
  - el respaldo de Hermes que ya ocupa espacio.

  Se pide **más de 5 GB libres** en `/` (`df -h /`). El 2026-11-07, antes de Hermes, había 40 GB
  [MEDIDO].

### 6.7 Comprobaciones en el VPS, en solo lectura, a T-15 minutos

- **Paperclip:** `A 'paperclipai --version'` da `2026.1012.0`, y
  `A 'systemctl --user is-active paperclip.service'` da `active`.
- **Que no haya otro servicio administrado:** `A 'systemctl --user status paperclipai.service'`
  responde «could not be found». Si existe, se para antes de seguir (paso 3, punto 4).
- **La umask:** `A 'umask'`. Si da `0002`, el paso 3 ya la corrige.
- **Los envoltorios:** sus huellas son las de `main` en el momento de la ventana. El 2026-11-07
  eran:
  - `dtd-motor`: `d522b2ed…`;
  - `dtd-agente-run`: `86fb1b5a…`;
  - sudoers: `66b5cd84…`;
  - `dtd-claude`: `210c507f…`;
  - `dtd-codex`: `0b3d6b03…`;
  - `settings.json` de ALFRED: `33ea1a45…`.

  Si entró y se instaló la PR #414, valen las de su nota de instalación.
- **Hermes:** `hermes --version` dice `v0.23.0`.
- **El puente:** `systemctl is-active dtd-alfred-bridge.service dtd-hermes-telegram.service`. El
  nombre del puente sale del README de `infra/oficina/dtd-alfred` y se confirma aquí.
- **La base:** las consultas de §5.0.

## 7. Paso 1 hecho: Hermes v0.23.0 instalado (2026-11-07)

**Autorización:** Sam, en la sesión de esta PR, contestó literalmente «Sí, instálalo» a la pregunta
de si autorizaba instalar Hermes v0.23.0 en el VPS de la oficina. Antes, el Subdirector había
coordinado el orden con Sam: primero la corrección de la PR #407, después Hermes.

**Cómo se hizo.** Se usó el método de la fase H1 de la SDD-0564, con los nombres de versión nuevos:

1. **Instalación como `agentes`, sin sudo:**
   - script `scripts/install.sh` de la etiqueta, con sha256 `abf338605dae6dd2…`;
   - banderas `--commit 2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19 --skip-browser
     --skip-computer-use --non-interactive`.

   Sobre un checkout que ya existe, el script avanza `main` y después fija el commit. `2bd378ed`
   es antecesor de `main`.
2. **root copia a `/opt/hermes`** con `rsync`: `hermes-agent` sin `.git` y las cuatro
   herramientas. Después regenera el lanzador con `sed`.
3. **Refresco de `agentes-run`:**
   - copia de `/opt/hermes/tools` a `~agentes-run/.hermes/tools`, sin `--delete`;
   - `DTD_PERFIL=prueba dtd-hermes pm install`.

0.23 trae Node 26.12.1, Python 3.14.9 y uv 0.13.5. **Las carpetas de Node 26.7.0, Python 3.14.7
y uv 0.12.3 se quedaron**, porque `dtd-agente-run` y `dtd-hermes-telegram.service` tienen escrita
la ruta `node-26.7.0`.

**Resultado [MEDIDO]:**

| Comprobación | Resultado |
|---|---|
| Versión | `Hermes Agent v0.23.0 · upstream 2bd378ed`, desde `/opt/hermes/hermes-agent` |
| Respaldo | `/root/respaldo-hermes-0230-20261107T145930Z`: `/opt/hermes`, `~agentes/.hermes` y `~agentes-run/.hermes` en `.tgz` con `SHA256SUMS`, más copias de los envoltorios, el sudoers y la unidad |
| `#alfred` sin servicio | 9 min 55 s, de 14:59:27Z a 15:09:22Z. Reconectó como ALFRED#4271 a las 15:09:10Z |
| Extras de Hermes | `all, discord, edge-tts, telegram`, los mismos de antes |
| Skills | 13 por perfil en los 16 perfiles, antes y después |
| 5.5 Hermes directo | **PASÓ**: responde, imprime `session_id:` y un perfil fuera de la lista da 64 |
| 5.3 agente GLM (Jefe de gabinete, HAI-65) | **PASÓ**: corrida `succeeded`; cita sus reglas del puesto; cierra la tarea en `done` por la API; sin retenciones ni incidentes |
| HAI-51 | **FALLÓ también en 0.23** (HAI-64 en `blocked`). Ver abajo |
| Procesos de `agentes-run` | Cada perfil usado deja un `hermes` y un `engram` que se cierran solos en 10 a 15 minutos |
| `cua-driver` | Falla su verificación igual que en 0.22.2. Es opcional y no se usa |

**HAI-51 es un bug de Hermes, no del despliegue.**

- **La causa:** `hermes_cli/cli_single_query.py:547` imprime la pregunta con rich sin escaparla:
  `console.print(f"[bold blue]…[/] {_query_label}")`.
- **Cuándo falla:** cualquier tarea de Paperclip cuyo texto lleve `[/…]` hace que Hermes salga con
  exit 1 antes de llamar al modelo. Por ejemplo, la referencia
  `[/HAI/issues/HAI-51#document-plan]` que escribe ALFRED.
- **Por qué no se veía con `-Q`:** ese modo no imprime la pregunta.
- **Upstream:** está reportado y abierto como NousResearch/hermes-agent#98789.
- **Mientras tanto:** los textos de las tareas para agentes Hermes no deben llevar `[/`. La
  corrección de fondo, en Hermes o pasando `-Q` desde el envoltorio, queda para su propia SDD.

**Hallazgos de paso, que no cambian el veredicto:**

- **Los `session_id` de 0.23 tienen la forma `local-…`.** La 1012 los descarta (#18314), igual que
  en 0.22.2, y no había sesiones guardadas que perder.
- **Una tarea sin proyecto corre en el espacio de trabajo de respaldo de Paperclip**, dentro de
  `~agentes`, y no en el `cwd` del agente. Ya se sabía desde la SDD-0564. Las tareas de prueba
  deberían llevar proyecto.

**Volver atrás**, si hiciera falta:

1. Detener `dtd-hermes-telegram.service`.
2. Comprobar `SHA256SUMS`.
3. Mover a un lado (sin borrar) `/opt/hermes`, `~agentes/.hermes` y `~agentes-run/.hermes`.
4. Restaurar los tres `.tgz` sobre `/` y encender el servicio.

## 8. Qué se midió y qué no

**Medido:**

- versiones de Paperclip, Node, Claude, Codex y glibc;
- los envoltorios y sus sha256;
- el `env_keep` de sudo;
- los toolsets y las menciones de `browser` en los 16 perfiles;
- las políticas de presupuesto;
- los agentes y su `command`;
- los eventos de costo por motor;
- las corridas de 14 días;
- las sesiones de tarea;
- las rutinas y sus disparadores;
- el tamaño de la base y de los respaldos.

**Medido después, el 2026-11-07:**

- **La versión de Hermes en el disco:** `Hermes Agent v0.23.0 · upstream 2bd378ed` (§7). Antes de
  instalar no había `.git` ni número de versión en `/opt/hermes/hermes-agent`, y la `v0.22.2`
  (`d923a5eb`) se tomó del handoff de la SDD-0564.
- **Hermes 0.23 bajo sudo, con la 1012:** la prueba 5.3 pasó (HAI-65, §7).
- **La variable de §2.5 con el sudoers de `main`:** en la reinstalación de las 17:52Z, con
  `HERMES_EPHEMERAL_SYSTEM_PROMPT` puesta a mano, le llegó a Hermes y no a Claude ni a Codex.

**NO MEDIDO:**

- **Los roles de los miembros** (§2.6).
- **El efecto real de §2.5 y del §6.2 con la 1106:** que Paperclip mande las instrucciones por esa
  variable y el agente las use. Se deduce del código; lo confirma la prueba 5.3 en la 1106.
- **Lo que el §6 marca como [INFERENCIA]:** el Runner, el #19887, la duración de la caída y el
  tamaño de la carpeta de la 1106.
