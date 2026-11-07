# Actualizar la oficina: Paperclip 2026.1106.0 y Hermes v0.23.0

Evaluación del 2026-11-07, sin instalar nada. Sale de leer las notas de versión, el código de
Paperclip en las etiquetas `v2026.1012.0` y `v2026.1106.0`, el código de Hermes en `v0.22.2` y
`v0.23.0`, y de cuatro conexiones de solo lectura al VPS de la oficina. La base de Paperclip se
leyó con `default_transaction_read_only = on`; no se imprimió ningún secreto.

Contexto: la guía `configuracion-paperclip.md` y el handoff
`.agents/handoffs/sdd-0615-oficina-motores-claude-codex.md` (los dos en la PR #407, todavía sin
fusionar) decían que no convenía pasar a Paperclip 1023 por el bloqueo del uso sin precio. Este
documento mide ese bloqueo y lo demás que cambió.

Las etiquetas dicen de dónde sale cada dato:

- **[CÓDIGO]:** leído en el código de la versión indicada.
- **[NOTAS]:** notas de versión oficiales.
- **[ISSUE]:** issue o PR de GitHub, con su estado al 2026-11-07.
- **[MEDIDO]:** comprobado hoy en el VPS de la oficina.
- **[INFERENCIA]:** deducido, sin comprobar. La prueba de humo lo confirma o lo descarta.

## 1. Veredicto

**Conviene actualizar, en dos pasos y con tres cambios previos.** Ninguna de las cuatro dudas
bloquea, pero apareció un riesgo nuevo que sí bloquea si no se atiende antes (§2.5).

| Pieza | Hoy | Destino | ¿Conviene? |
|---|---|---|---|
| Hermes | v0.22.2 (`d923a5eb`) | v0.23.0 (`2bd378ed`) | Sí, primero y solo. Lo que se rompe no lo usamos |
| Paperclip | 2026.1012.0 | 2026.1106.0 | Sí, después de Hermes y de los cambios A, B y C (§3) |

**Lo que hay que hacer antes de Paperclip:**

- **A.** Dejar pasar `HERMES_EPHEMERAL_SYSTEM_PROMPT` por sudo. Sin eso, los agentes GLM se
  quedan sin instrucciones.
- **B.** Apagar el corte duro de las políticas de presupuesto de los agentes vivos. Sin eso, cada
  agente GLM queda retenido después de su primera corrida.
- **C.** Fusionar la PR #407, para que los envoltorios instalados sean los de `main`.

**Cuándo.** La 1106 salió ayer, con 515 commits. Conviene esperar unos días a que aparezcan
reportes (§6) y hacerla en una ventana sin trabajo vivo. Hermes puede ir antes.

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

**Recomendación (cambio B):** apagar el corte duro (`hardStopEnabled = false`) de las 8 políticas
vivas **antes** de actualizar, desde la pantalla de presupuestos de la 1012. El aviso
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

**Por qué se pierde.** `dtd-hermes` corre `sudo -n -u agentes-run … dtd-agente-run hermes`. El
sudoers instalado tiene `env_reset` y deja pasar solo
`PAPERCLIP_* DTD_PERFIL CLAUDE_CODE_OAUTH_TOKEN TERM LANG LC_ALL LC_CTYPE` [MEDIDO en
`/etc/sudoers.d/91-agentes-run`]. La variable nueva no empieza con `PAPERCLIP_`, así que sudo la
borra.

**Efecto [INFERENCIA, muy probable].** Los agentes GLM corren con su `SOUL.md`, pero:

- sin las instrucciones de su puesto;
- sin saber cómo marcar la tarea en Paperclip.

Las tareas quedarían abiertas o mal cerradas. Hermes v0.22.2 y v0.23.0 leen la variable
(`cli_init_mixin.py`, `gateway/run_config_loaders.py`) [CÓDIGO], así que el arreglo es solo de
sudo.

**Cambio A.** Agregar `HERMES_EPHEMERAL_SYSTEM_PROMPT` al `env_keep` de
`infra/oficina/envoltorios/91-agentes-run`, con una prueba en
`infra/oficina/envoltorios/tests/` y un mutante que la quite.

- Con la 1012 no cambia nada, porque la variable no viene.
- Va en su propia SDD (o en una enmienda de la 0615), porque toca un archivo de esa allowlist.

**Otra variable que hoy sí pasa [NOTAS 1023 #15352].** Desde la 1023 cada corrida recibe
`PAPERCLIP_AGENT_PRIVATE_KEY`, la llave privada Ed25519 del agente. Por el comodín `PAPERCLIP_*`
llega al usuario de cada motor. Es la llave del propio agente y no la ve otro usuario, así que se
acepta. Queda anotado.

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
- «Asesor comercial» y «Jefe de gabinete» están en `error`.
- Las pruebas de humo se comparan contra esta línea base, no contra una oficina perfecta.

## 3. Orden de actualización

Cada paso lo autoriza Sam por separado. «Instalar» y «actualizar» son operaciones en el VPS de la
oficina y no están cubiertas por este documento.

### Paso 0 · En el repositorio, sin tocar el VPS

1. **C:** fusionar la PR #407. Lo decide el Director General.
2. **A:** una SDD con el cambio de `env_keep`, su prueba y su mutante. PR aparte.
3. **Hojas de alta:** agregar «Legacy runner» a la guía y la regla de no presionar «Upgrade
   runner».

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
   - Comparar antes el sha256 del archivo vivo con el anotado (`52ade946…`).
   - Respaldarlo y correr `visudo -c`.
   - Prueba: un agente GLM sigue corriendo con la 1012 (5.3).
2. **B:** Sam apaga el corte duro de las 8 políticas vivas en la pantalla de presupuestos.
   Después se comprueba en la base (§5.0) que las 8 quedaron con `hard_stop_enabled = false`.

### Paso 3 · Paperclip 2026.1106.0 (ventana, unos 15 minutos)

1. **Comprobar** que no hay corridas vivas ni en cola, y que el próximo latido no cae dentro de la
   ventana. Hoy es a las 11:00 UTC; el parte del viernes, a las 18:00 UTC.
2. **Respaldo en frío** como `agentes`, con el servicio detenido. La copia de la carpeta de datos
   es la vuelta atrás segura, porque la base es PostgreSQL embebido:

   ```bash
   systemctl --user stop paperclip.service
   sello=$(date -u +%Y%m%dT%H%M%SZ); dest=$HOME/respaldo-paperclip-1106-$sello; mkdir -p "$dest"
   tar -C "$HOME/.paperclip" -czf "$dest/instancia-default.tgz" instances/default
   cp -a "$HOME/.config/paperclip/paperclip.env" "$dest/"
   cp -a "$HOME/.paperclip/cli" "$dest/cli"
   sha256sum "$dest"/instancia-default.tgz > "$dest/SHA256SUMS"
   systemctl --user start paperclip.service
   ```

   La instancia pesa unos 420 MB con los respaldos internos [MEDIDO]. `paperclip.env` tiene
   secretos: queda con permisos 600, dentro de la casa de `agentes`, y no sale del VPS.
3. **Actualizar** como `agentes`: `paperclipai update --version 2026.1106.0`.
   - El comando hace su propio respaldo de la base antes de cambiar nada.
   - Guarda la versión anterior y, si el servicio no valida al reiniciar, vuelve solo a la
     versión anterior (`cli/src/commands/update.ts`) [CÓDIGO 1012].
4. **Comprobar** la salud (200) y `paperclipai --version`. El conteo de
   `drizzle.__drizzle_migrations` (§5.0) debe pasar de 304 [MEDIDO, igual a los archivos de la
   1012] a 373, los archivos de migración de la 1106 [CÓDIGO].
5. **Poner `unpricedUsagePolicy = allow`** en las 8 políticas vivas. Sam lo hace en la pantalla,
   antes de la primera corrida GLM.
6. **Pruebas de humo:** 5.1 a 5.4.

**Volver atrás en Paperclip.** Las migraciones no se revierten; el mismo comando lo advierte
[CÓDIGO]:

1. `paperclipai update --rollback`, que vuelve a la versión 1012.
2. `systemctl --user stop paperclip.service`.
3. Mover `instances/default` a un lado (no borrarlo) y restaurar `instancia-default.tgz` del
   respaldo en frío, después de comprobar `SHA256SUMS`.
4. `systemctl --user start paperclip.service` y repetir 5.1 a 5.4 contra la 1012.

Lo escrito en Paperclip entre la actualización y la vuelta atrás se pierde. Por eso la ventana va
sin trabajo vivo y las pruebas usan tareas de prueba. No se arranca nunca la 1012 sobre la base
migrada.

## 4. Lo que no se hace

- Actualizar Paperclip sin los cambios A y B instalados.
- Presionar «Upgrade runner» en ALFRED o en el Auxiliar.
- Encender el corte duro de un presupuesto mientras siga abierto el #18956.
- Actualizar Paperclip y Hermes en la misma ventana: si algo falla, no se sabría cuál fue.
- Saltar el respaldo en frío porque `paperclipai update` ya hace uno. El de Paperclip es una
  exportación lógica; el de la carpeta es la vuelta atrás que no depende de Paperclip.

## 5. Pruebas de humo

Cada prueba usa una tarea creada para eso, con el título «Prueba de humo — actualización» y la
fecha, asignada desde la pantalla a nombre de Sam. Pasa si se cumple todo lo que dice «Pasa si».
Las lecturas de la base van con `SET default_transaction_read_only = on`.

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

Revisar si hay reportes nuevos contra la 1106 y el estado de los issues que importan:

```bash
gh search issues --repo paperclipai/paperclip "2026.1106.0" --state open --limit 30
gh issue view 18956 -R paperclipai/paperclip --json state,updatedAt
gh issue view 18314 -R paperclipai/paperclip --json state,updatedAt
gh issue view 18316 -R paperclipai/paperclip --json state,updatedAt
```

Si sale una 1106.1, se evalúa esa en lugar de la 1106.0, con este mismo documento.

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

**NO MEDIDO:**

- **La versión de Hermes en el disco.** No hay `.git` ni número de versión en
  `/opt/hermes/hermes-agent`. Se toma del handoff de la SDD-0564 (`d923a5eb`, `v0.22.2`).
- **Los roles de los miembros** (§2.6).
- **El comportamiento real del gateway de 0.23 bajo sudo** (§2.4, prueba 5.3).
- **El efecto real de §2.5.** Se deduce del código y del sudoers instalado; lo confirma la prueba
  5.3 en 1106.
