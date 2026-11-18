# Guion de ejecución: Paperclip 2026.1012.0 → 2026.1106.0 en la oficina

Dueño: Sam (Junta de la oficina) · Estado: **escrito, sin ejecutar** · Escrito: 2026-11-07 ·
Corregido: 2026-11-09 · review-by: 2026-12-07

Sirve para correr el paso 3 de la evaluación de la PR #409
(`docs/organizacion/oficina-agentes/actualizacion-paperclip-hermes.md`: §3, §5 y §6), que está en
`main` desde el 2026-11-09. Ese documento explica el porqué. Aquí van los comandos, el orden, lo
que tiene que salir en cada paso y qué hace Sam en cada momento.

**Relación con la #409.**

- Este guion sigue su paso 3.
- La revisión del Director General sobre esta PR (2026-11-09) agregó cuatro cosas que la #409 no
  tiene. Son más estrictas y no la contradicen:
  - parar si existe `paperclipai.service` (§3.2);
  - el script de lectura literal (§3.2);
  - las skills, con su respaldo (§3.2, §4 y §8);
  - apartar la configuración de la 1106 antes de restaurar (§8).
- Si en otra cosa los dos no coinciden, manda la #409 y este guion se corrige.

> ⚠️ **Nada de esto es automático.** Se corre en el VPS de la oficina de agentes, en una ventana
> que Sam autoriza aparte y nombrando ese VPS. La autorización que Sam le dio a otra sesión no
> alcanza, y este guion tampoco autoriza nada.

> ⚠️ **Escrito sin entrar al VPS.** Lo marcado [MEDIDO] se midió el 2026-11-07; lo marcado
> [CÓDIGO] se leyó en la etiqueta `v2026.1106.0` de Paperclip. Si lo que encuentras no calza con
> el §1, **para** y avisa: no se improvisa dentro de la ventana.

## 1. Punto de partida: lo que tiene que estar instalado

Todo esto quedó así el 2026-11-07. La comprobación previa (§3) lo mide otra vez.

| Pieza | Estado esperado | De dónde sale |
|---|---|---|
| Paperclip | `2026.1012.0` (managed npm pinned), servicio de usuario `paperclip.service` de `agentes`, `ExecStart=%h/.local/bin/paperclipai run` | [MEDIDO] |
| Hermes | `v0.23.0` (`2bd378ed`) en `/opt/hermes` | §7 de la PR #409 |
| Envoltorios | Los de `main` `7e75f7708`, reinstalados a las 17:52Z | Nota de la reinstalación de la SDD-0615 |
| Cambio A | El sudoers deja pasar `HERMES_EPHEMERAL_SYSTEM_PROMPT` | Va dentro del sudoers `66b5cd84…` |
| Cambio B | Las 8 políticas vivas con `hard_stop_enabled = false`, `warn_percent` 80, aviso encendido y activas | PR #409, paso 2 |

Huellas de los envoltorios (sha256, 16 caracteres), iguales a `main` `7e75f7708`:

| Archivo en el VPS | sha256 |
|---|---|
| `/usr/local/libexec/dtd-motor` | `d522b2ede8758865` |
| `/usr/local/libexec/dtd-agente-run` | `86fb1b5ace6dc019` |
| `/etc/sudoers.d/91-agentes-run` | `66b5cd84990b18ff` |
| `/usr/local/bin/dtd-claude` | `210c507f4aa8eb3f` |
| `/usr/local/bin/dtd-codex` | `0b3d6b032c1eedbd` |
| `~agentes-alfred/.claude/settings.json` | `33ea1a459c2914ae` |

**Si la PR #414 (riesgos bajos de la SDD-0615) ya entró a `main` y se reinstaló,** las huellas
nuevas son las de su commit. Se toman de su nota de instalación, no de esta tabla. Si entró a
`main` pero no se instaló, en el VPS siguen las de esta tabla y está bien.

**Las 8 políticas vivas del cambio B:** ALFRED (4000) y, con 2000, Jefe de gabinete, Puente de
ingeniería, Editor de contenido, Asesor comercial, Community manager asistente, Analista de
CRM/datos y Analista de operaciones. Las 6 de agentes terminados no se tocan.

## 2. Qué hace Sam y cuándo

| Momento | Qué hace Sam |
|---|---|
| El día antes o esa mañana | Lee el resultado de la revisión de issues (§3.1) y elige la hora de la ventana |
| A T-15 minutos | Da el OK nombrando el VPS de la oficina para las lecturas del §3.2, en el chat de la sesión que va a ejecutar. Son solo lecturas, pero en el VPS: sin ese OK no se entra. Puede ser el mismo mensaje que el OK de la ventana si dice las dos cosas |
| Al abrir la ventana | Da el OK nombrando el VPS de la oficina, en el chat de la sesión que va a ejecutar. Con ese OK acepta también: (1) el riesgo de presupuesto, porque sin corte duro a los GLM solo los frena la cuota de z.ai (§6.4 de la PR #409); y (2) **la vuelta atrás completa del §8**, que restaura la base, el programa, la configuración y las skills desde la copia en frío y descarta lo escrito en la 1106. Abre el túnel y su sesión de Paperclip en `localhost:3100` |
| Durante toda la ventana | No escribe en `#alfred` ni crea tareas. Lo que se cree en 1106 se pierde si hay que volver atrás |
| §6 | Pone `unpricedUsagePolicy = allow` en las 8 políticas desde la pantalla de presupuestos, o autoriza que se haga por la API con su sesión, como en el cambio B |
| §7 | Autoriza crear las tareas de prueba (por la API con su sesión, o las crea él) y presiona «Run now» en la rutina de 5.4. En 5.6 cancela la corrida desde la pantalla |
| Al cierre | Escribe una línea en `#alfred` y confirma que la recepción contesta |
| Si la caída pasa de 15 minutos | Decide si se espera hasta 30 o se vuelve atrás (§7.1) |
| Si algo falla | Decide si se vuelve atrás (§8). El OK de la ventana ya incluye esa vuelta atrás, con la restauración de la base: no hace falta otro OK |

## 3. Comprobaciones previas

### 3.1 Revisión de issues del día (desde la PC, sin tocar el VPS)

```bash
gh release list -R paperclipai/paperclip --limit 5
gh search issues --repo paperclipai/paperclip "1106" --state open --limit 40
for n in 18956 18314 18316 19588 17208 19885 19887; do
  gh issue view $n -R paperclipai/paperclip --json number,state,updatedAt; done
```

**Sigue si:**

- **No hay una 1106.1.** Si salió, se para y se evalúa esa con el documento de la PR #409.
- **No hay un reporte nuevo** de pérdida de datos, migración que no termina o agentes que no
  arrancan después de actualizar.
- **#18956, #18314 y #18316:** abiertos está bien, el cambio B y la falta de sesiones guardadas los
  cubren. Si alguno se cerró, se anota y se sigue.
- **#19588** (la subtarea terminada que el padre no ve): se vigila en 5.2.
- **#17208** (la instalación falla con `umask 0002`): mientras siga abierto, `update` va con
  `umask 022` (§5). Si se cerró con un arreglo, se deja igual.
- **#19887** (las variables guardadas como objeto no llegan a la corrida, en la vía ACP): no
  debería tocarnos, porque usamos `engine: cli`. Es un criterio de parada si `DTD_PERFIL` no llega
  (§7.1).
- **#19885** (el cargo sin precio de los adaptadores `process` y `http`): no usamos esos
  adaptadores.

La revisión del 2026-11-07 (hacia las 19:40Z) no encontró una 1106.1 y dejó todos esos abiertos.
El análisis está en el §6.1 de la PR #409. El #19820 no aplica, porque Sam entra por `localhost`
con el túnel.

### 3.2 En el VPS, en solo lectura, a T-15 minutos

**Antes de entrar:** el OK de Sam nombrando el VPS de la oficina para estas lecturas (§2). Se
anota su texto literal. Aquí no se escribe nada en el VPS, salvo el script temporal de la base, que
va a `/tmp` y se borra al terminar.

Todo como el usuario administrador del VPS, con `sudo`. Para no repetir la forma de entrar como
`agentes`:

```bash
A() { sudo -n -u agentes -H env XDG_RUNTIME_DIR=/run/user/$(id -u agentes) bash -lc "$*"; }
```

**Versión y servicio:**

```bash
A 'paperclipai --version'                                  # 2026.1012.0 (managed npm pinned; …)
A 'systemctl --user is-active paperclip.service'           # active
A 'systemctl --user status paperclipai.service --no-pager' # «could not be found»; si existe, NO se abre la ventana
A 'umask'                                                  # si da 0002, el §5 la corrige
A 'node --version'                                         # 24.11.0 o más (la 1106 pide >=24.11.0)
curl -s http://127.0.0.1:3100/api/health; echo             # "status":"ok" y versión 2026.1012.0
df -h / | tail -1                                          # más de 5 GB libres
```

**Ensayo, con el servicio todavía encendido.** No cambia nada:

```bash
A 'paperclipai update --version 2026.1106.0 --dry-run'
```

Tiene que decir «Would update paperclipai 2026.1012.0 → 2026.1106.0».

**Huellas de los envoltorios** contra la tabla del §1:

```bash
for f in /usr/local/libexec/dtd-motor /usr/local/libexec/dtd-agente-run \
  /etc/sudoers.d/91-agentes-run /usr/local/bin/dtd-claude /usr/local/bin/dtd-codex \
  /home/agentes-alfred/.claude/settings.json; do
  printf '%s %s\n' "$(sudo sha256sum "$f" | cut -c1-16)" "$f"; done
sudo -u agentes-run /opt/hermes/bin/hermes --version | head -1   # Hermes Agent v0.23.0
```

**La base, en solo lectura: el script de lectura.** Es el mismo que se usó en la PR #409 para el
cambio B [MEDIDO 2026-11-07], escrito aquí literal para no improvisar en la ventana.

- Usa el driver `postgres` que trae el propio Paperclip.
- Se conecta a la base embebida en `127.0.0.1:54329`, con el usuario y la clave por defecto de esa
  base.
- Va con `default_transaction_read_only: "on"` en la conexión y, además, `SET
  default_transaction_read_only = on` antes de la primera consulta.
- No imprime valores de `adapter_config->'env'`: la consulta 8 solo dice si existen dos nombres.
- Se escribe en `/tmp`, corre como `agentes` y se borra al terminar.

`V` es la versión cuyo driver se usa: `2026.1012.0` antes del §5 y en la vuelta atrás,
`2026.1106.0` después del §5.

```bash
V=2026.1012.0
DRV=$(sudo -u agentes find "/home/agentes/.paperclip/cli/installs/npm/$V" -maxdepth 8 \
  -path '*node_modules/postgres/package.json' 2>/dev/null | head -1)
[ -n "$DRV" ] && echo "driver: $DRV" || echo "SIN DRIVER para $V: parar y avisar"
cat > /tmp/pc1106-lectura.cjs <<'JS'
const { createRequire } = require("module");
const postgres = createRequire(process.env.DRV)("postgres");
const u = "paperclip"; // usuario, clave y base por defecto de la base embebida
const sql = postgres({ host: "127.0.0.1", port: 54329, database: u, username: u, password: u, max: 1,
  connection: { default_transaction_read_only: "on", application_name: "guion-1106-lectura" } });
const consultas = [
  ["0 solo lectura", "show default_transaction_read_only"],
  ["1 corridas vivas o en cola (0 filas)",
   "select status, count(*) from heartbeat_runs where status in ('queued','running') group by 1"],
  ["2 politicas vivas (8, hard_stop_enabled false)",
   "select a.name, bp.amount, bp.warn_percent, bp.hard_stop_enabled, bp.notify_enabled, bp.is_active from budget_policies bp join agents a on a.id = bp.scope_id where bp.scope_type = 'agent' and a.status <> 'terminated' order by a.name"],
  ["3 incidentes (0 abiertos)", "select status, count(*) from budget_incidents group by 1"],
  ["4 migraciones (304 en 1012, 373 en 1106)", "select count(*), max(created_at) from drizzle.__drizzle_migrations"],
  ["5 proximos disparos de rutinas",
   "select r.title, rt.next_run_at from routine_triggers rt join routines r on r.id = rt.routine_id where rt.enabled and r.status = 'active' order by rt.next_run_at"],
  ["6 latidos por tiempo",
   "select name, status, last_heartbeat_at, runtime_config->'heartbeat' as heartbeat from agents where status <> 'terminated' order by name"],
  ["7 motores",
   "select name, adapter_type, adapter_config->>'engine' as engine, adapter_config->>'command' as command from agents where status <> 'terminated' order by name"],
  ["8 GLM con HOME o HERMES_HOME en su entorno (solo si existen, sin valores)",
   "select name, coalesce(adapter_config->'env' ? 'HERMES_HOME', false) as hermes_home, coalesce(adapter_config->'env' ? 'HOME', false) as home from agents where adapter_type = 'hermes_local' and status <> 'terminated' order by name"],
  ["9 retenciones (solo 1106; en 1012 da ERROR de columna)",
   "select name, status, pause_reason, lifecycle_holds from agents where status <> 'terminated' order by name"],
  ["10 uso sin precio (solo 1106; en 1012 da ERROR de columna)",
   "select a.name, bp.hard_stop_enabled, bp.unpriced_usage_policy, bp.notify_enabled, bp.is_active from budget_policies bp join agents a on a.id = bp.scope_id where bp.scope_type = 'agent' and a.status <> 'terminated' order by a.name"],
];
(async () => {
  await sql.unsafe("SET default_transaction_read_only = on");
  for (const [t, s] of consultas) {
    try { const r = await sql.unsafe(s); console.log("-- " + t); for (const f of r) console.log(JSON.stringify(f)); }
    catch (e) { console.log("-- " + t + " ERROR " + e.message); }
  }
  await sql.end();
})().catch(e => { console.log("ERROR " + e.message); process.exit(1); });
JS
chmod 644 /tmp/pc1106-lectura.cjs
sudo -n -u agentes bash -lc "DRV='$DRV' node /tmp/pc1106-lectura.cjs" 2>&1 | cut -c1-400
rm -f /tmp/pc1106-lectura.cjs
```

Más abajo, «la consulta N» es la salida N de este script. El script hace todas las consultas cada
vez que corre.

**Skills, antes de tocar nada:**

```bash
sudo bash -c 'for p in /home/agentes-run/.hermes/profiles/*/; do printf "%s=%s " "$(basename "$p")" "$(ls "$p/skills" | wc -l)"; done'; echo
A 'ls -A "$HOME/.hermes/skills" 2>/dev/null | wc -l; find "$HOME/.hermes/skills" -maxdepth 1 -type l -printf "%f -> %l\n" 2>/dev/null'
```

**Dónde escribe Paperclip sus skills [CÓDIGO].**

- **Quién escribe.** En cada corrida Hermes, el servidor de Paperclip (usuario `agentes`) enlaza
  sus skills (`paperclip` y las que tenga asignadas el agente) en una carpeta de skills de Hermes
  (`packages/adapters/hermes/src/server/skills.ts:216-256` de la 1106; `execute.ts:368-382`).
- **Dónde.**
  - Sin `HERMES_HOME` en el entorno del agente, la carpeta es `<HOME>/.hermes/skills` en las dos
    versiones; con nuestra configuración, `~agentes/.hermes/skills`.
  - **Con `HERMES_HOME`, la 1106 cambia de carpeta** a `$HERMES_HOME/skills`
    (`skills.ts:28-36`), que sería la del perfil. La 1012 lo ignoraba.
  - Nuestros GLM llevan solo `DTD_PERFIL` (hojas de alta en `configuracion-paperclip.md`).
    `HERMES_HOME` lo fija `dtd-agente-run` después de `sudo`, y ahí Paperclip no mira. La
    consulta 8 lo comprueba.
- **Qué pasa en la vuelta atrás.** Un enlace que apunta a una carpeta que ya no existe se repara en
  la corrida siguiente (`ensurePaperclipSkillSymlink`, igual en la 1012 y en la 1106). Así que la
  vuelta atrás funciona aun sin restaurar `~agentes/.hermes/skills`. El §8 lo restaura igual.

**Sigue si:**

- La consulta 0 dice `on`.
- `paperclipai.service` **no existe** («could not be found»).
  - **Si existe, se para aquí y no se abre la ventana.**
  - Con esa unidad, `update` la reinicia y la valida, y si la validación falla vuelve solo a la
    1012 sobre una base que ya pudo haber migrado (§6.7 de la #409 y §5 de este guion).
  - Se avisa a Sam y se evalúa aparte.
- La consulta 1 da 0 filas.
- Las 8 políticas tienen `hard_stop_enabled = false`.
- No hay incidentes abiertos.
- Hay 304 migraciones.
- **Ningún disparo cae dentro de la ventana, más 30 minutos.** Hoy son el «Latido diario del CEO»
  a las 11:00 UTC y el «Parte del viernes» a las 18:00 UTC [MEDIDO]. Las rutinas tienen
  `catch_up_policy = skip_missed` por defecto [CÓDIGO 1012], así que un disparo perdido durante la
  ventana se salta y no se repite.
- **Ningún agente tiene un latido por tiempo** que caiga en la ventana. Las hojas de alta lo dejan
  apagado. La forma de `runtime_config->'heartbeat'` no se midió: si la consulta 6 no la muestra,
  se mira en la pantalla de cada agente.
- **La consulta 7:**
  - ALFRED en `claude_local`, `cli`, `/usr/local/bin/dtd-claude`;
  - el Auxiliar en `codex_local`, `cli`, `/usr/local/bin/dtd-codex`;
  - los GLM en `hermes_local`.
- **La consulta 8** da `hermes_home = false` en todos los GLM. Si alguno da `true`, se para: con
  la 1106 Paperclip escribiría en la carpeta de skills de ese perfil, y eso no se evaluó.
- **Skills por perfil.**
  - Se anota el número de cada uno de los 16 perfiles. El 2026-11-07 eran 13 en todos, antes y
    después de Hermes 0.23 [MEDIDO, con este mismo `ls | wc -l`].
  - Si hoy da otro número, el de hoy pasa a ser la referencia. No es motivo para parar, porque
    Paperclip no los tocó.
  - Se anotan también los enlaces de `~agentes/.hermes/skills`.
    - Se espera que apunten dentro de `.paperclip/cli/installs/npm/2026.1012.0/`, porque la fuente
      es la carpeta del adaptador instalado [INFERENCIA, no medido].
    - Si apuntan a otro lado, se anota y se sigue: es la línea base.

**El puente de ALFRED** (`dtd-alfred-bridge.service`) le habla a Paperclip con la llave de ALFRED.
Su nombre viene del README de `infra/oficina/dtd-alfred` y no se ha comprobado en el VPS:

```bash
systemctl is-active dtd-alfred-bridge.service dtd-hermes-telegram.service
```

## 4. Detener y respaldo en frío

**Sam dio el OK de la ventana:** desde aquí se escribe en el VPS. Desde este punto **Paperclip no
se vuelve a encender hasta después de `update`** (§5, punto 3): lo que se escriba entre la copia y
la actualización se perdería al volver atrás.

1. **Detener el puente y Paperclip, y comprobar que nadie los vuelve a encender:**

   ```bash
   sudo systemctl stop dtd-alfred-bridge.service
   A 'systemctl --user stop paperclip.service'
   A 'systemctl --user is-active paperclip.service'; sleep 30; A 'systemctl --user is-active paperclip.service'
   ```

   - Las dos lecturas tienen que dar `inactive`.
   - Con un `stop` explícito, systemd no reinicia la unidad aunque tenga `Restart=`.
   - El puente le habla a Paperclip con la llave de ALFRED. Detenido, no crea ni comenta tareas
     que se perderían al volver atrás. Sus encargos y avisos quedan guardados en su SQLite.

2. **Respaldo con el servicio detenido y `umask 077`, porque el `.tgz` lleva la base y llaves.** La
   base es PostgreSQL embebido: copiar la carpeta con el servicio parado es la vuelta atrás que no
   depende de Paperclip.

   ```bash
   A 'set -e; umask 077
   sello=$(date -u +%Y%m%dT%H%M%SZ); dest=$HOME/respaldo-paperclip-1106-$sello; mkdir "$dest"
   tar -C "$HOME/.paperclip" -czf "$dest/instancia-default.tgz" instances/default
   tar -C "$HOME/.paperclip" -czf "$dest/cli.tgz" cli
   tar -C "$HOME" -czf "$dest/config.tgz" .config/paperclip/paperclip.env \
     .config/systemd/user/paperclip.service .local/bin/paperclipai .paperclip/auth.json
   if [ -d "$HOME/.hermes/skills" ]; then tar -C "$HOME" -czf "$dest/skills-agentes.tgz" .hermes/skills
   else echo "no había .hermes/skills" > "$dest/skills-agentes.ausente"; fi
   cd "$dest" && sha256sum *.tgz > SHA256SUMS && sha256sum -c SHA256SUMS
   echo "$dest"; cut -c1-16,65- SHA256SUMS'
   ```

   Y, como root, las skills de los perfiles de Hermes, que no son de `agentes`:

   ```bash
   sudo bash -c 'set -e; umask 077; f=/root/respaldo-paperclip-1106-skills-perfiles-$(date -u +%Y%m%dT%H%M%SZ).tgz
   tar -C /home/agentes-run/.hermes -czf "$f" $(cd /home/agentes-run/.hermes && ls -d profiles/*/skills)
   sha256sum "$f" > "$f.sha256" && sha256sum -c "$f.sha256"; echo "$f"; cut -c1-16 "$f.sha256"; du -h "$f"'
   ```

   - **Qué cubre:**
     - la base;
     - el programa, con la 1012 activa;
     - `paperclip.env` con sus secretos;
     - la unidad;
     - el lanzador;
     - la sesión de la CLI;
     - los enlaces de skills de Paperclip en `~agentes/.hermes/skills` (§3.2);
     - las skills de los 16 perfiles, aparte y como root.
   - **Dónde queda:**
     - `SHA256SUMS` cubre los `.tgz` de `dest`, que quedan en la casa de `agentes`, con 700 y 600.
     - El de los perfiles queda en `/root`, con su `.sha256`.
     - Nada sale del VPS. El `cut` imprime solo la huella corta y el nombre.
   - **Cuánto tarda:** la instancia pesa unos 420 MB [MEDIDO], así que tarda unos minutos. El
     tamaño de las skills de los perfiles no se midió: `du` lo muestra.
   - **Qué se anota:** la ruta de `dest`, la del respaldo de los perfiles y todas las huellas
     cortas.

## 5. Actualizar

**Por qué `--no-backup`.**

- `paperclipai update` saca su propio respaldo de la base antes de cambiar nada, y para eso
  necesita la base encendida. Si no la alcanza, se niega [CÓDIGO `cli/src/commands/update.ts:51-63`].
- Encenderla entre la copia en frío y la actualización abre el hueco que el §4 evita.
- La copia en frío del §4 es más completa que esa exportación, y ese es el respaldo.

**Por qué `umask 022`.** Con la `umask 0002` de Ubuntu, la instalación de la 1106 falla con
«Copilot executable has unsafe permissions» (#17208, abierto; en sus comentarios se confirma en la
1106).

**Por qué hay que arrancar a mano [CÓDIGO e INFERENCIA].**

- Al terminar, el comando reinicia y valida solo el servicio que administra él, `paperclipai.service`
  (`cli/src/services/service-manager.ts:120`).
- El nuestro es `paperclip.service`, hecho a mano en la SDD-0564.
- Como `paperclipai.service` no existe (el §3.2 lo exige para abrir la ventana), el comando cambia
  la versión pero no reinicia, no valida y tampoco vuelve solo a la 1012.

1. **Actualizar, con el servicio todavía detenido:**

   ```bash
   A 'umask 022; paperclipai update --version 2026.1106.0 --no-backup'
   ```

   - **Qué tiene que salir:** «Updated paperclipai 2026.1012.0 → 2026.1106.0», **sin** «and
     restarted». La base todavía no se toca.
   - **Si dice «restarted» o «rolled back»:** existe un `paperclipai.service` que no conocíamos.
     Se detienen los dos servicios en el acto y se sigue el §8 desde su punto 2.
   - **Si la instalación falla:** la 1012 sigue activa y la base no migró.
     - Se comprueba que `paperclipai --version` dice `2026.1012.0`.
     - Se arranca el servicio y se enciende el puente.
     - Se cierra la ventana sin restaurar nada.

2. **Comprobar** que `A 'paperclipai --version'` dice `2026.1106.0`.

3. **Arrancar y esperar las migraciones:**

   ```bash
   A 'systemctl --user start paperclip.service'
   for i in $(seq 1 60); do
     r=$(curl -s -m 3 http://127.0.0.1:3100/api/health) && echo "$r" | grep -q '"status":"ok"' && break
     sleep 10; done; echo "$r"
   A 'journalctl --user -u paperclip.service --since "-15 min" --no-pager' | grep -iE 'migrat|error' | tail -20
   ```

   - **Las migraciones se aplican solas.** Sin terminal, el servidor aplica las pendientes al
     arrancar [CÓDIGO `server/src/index.ts:275-278`], porque `paperclip.env` no define
     `PAPERCLIP_MIGRATION_PROMPT` [MEDIDO, solo los nombres].
   - **Son 69, de la `0306` a la `0374`.** Algunas son largas (`0313`, `0343`, `0345`, `0369`) y se
     pueden repetir si se cortan [NOTAS 1023 y 1106]. La espera es de hasta 10 minutos.
   - **Pasa si:** la salud dice `ok` con `2026.1106.0`, el registro muestra las migraciones
     aplicadas y no hay errores.

4. **Conteo de migraciones:** el script del §3.2, con `V=2026.1106.0`, tiene que dar **373** en
   la consulta 4.
   - Es el número de archivos de `packages/db/src/migrations` de la `v2026.1106.0`, igual que las
     entradas de su `_journal.json` [CÓDIGO].
   - En esa misma corrida, las consultas 9 y 10 ya no dan error. Son las que miran el §6 y el §7.1.

5. **ALFRED y el Auxiliar no cambiaron de runner**, con la consulta 7 de esa misma corrida:
   - ALFRED sigue en `claude_local`, `engine` `cli`, `/usr/local/bin/dtd-claude`;
   - el Auxiliar, en `codex_local`, `cli`, `/usr/local/bin/dtd-codex`;
   - `ps -u agentes -o pid=,args=` no muestra procesos de Runner nuevos.

**Si algo de este paso falla, se va al §8.** Los criterios están en el §7.1. No se intenta arreglar
la 1106 dentro de la ventana.

## 6. `unpricedUsagePolicy = allow` en las 8 políticas

Antes de la primera corrida GLM. Con el cambio B no hay corte duro, así que hoy no frena nada;
esto queda puesto por si alguien lo vuelve a encender.

**Desde la pantalla:** Sam abre la pantalla de presupuestos, entra a cada una de las 8 y elige
«allow» en el uso sin precio. El nombre exacto del control en la 1106 no se ha visto.

**Por la API, con la sesión de Sam y su OK:** `POST /api/companies/<empresa>/budgets/policies`, una
vez por política. Se mandan todos los valores actuales y solo cambia el último:

```json
{ "scopeType": "agent", "scopeId": "<agente>", "metric": "billed_cents",
  "windowKind": "calendar_month_utc", "amount": 2000, "warnPercent": 80,
  "hardStopEnabled": false, "notifyEnabled": true, "isActive": true,
  "unpricedUsagePolicy": "allow" }
```

- ALFRED lleva `amount` 4000. Los valores salen de `GET …/budgets/overview` en ese momento, no de
  este ejemplo.
- En la 1106 un campo omitido conserva su valor (`server/src/services/budgets.ts:776-779`)
  [CÓDIGO]. Se repiten igual, para no depender de eso.

**Comprobar en la base:** el script del §3.2 con `V=2026.1106.0`, consultas 3 y 10.

**Pasa si:** las 8 tienen `hard_stop_enabled = false` y `unpriced_usage_policy = 'allow'`, siguen
activas con el aviso, y hay 0 incidentes.

## 7. Pruebas de humo

Son las del §5 de la PR #409. Aquí va lo que hay que cuidar al correrlas en esta ventana.

**Reglas para las tareas de prueba:**

- Título «Prueba de humo — actualización 1106» y la fecha.
- **Con proyecto.** Una tarea sin proyecto corre en el espacio de respaldo de Paperclip, dentro de
  `~agentes`, y no en la carpeta del agente.
- **Sin `[/` en el texto.** Hermes 0.23 sale con exit 1 si la tarea lleva `[/…]` (HAI-51, Hermes
  #98789, abierto). Tampoco se pegan enlaces internos de Paperclip.
- Se crean por la API con la sesión de Sam y su OK, o las crea Sam.

| Prueba | Agente | Qué prueba aquí | Pasa si (resumen; el detalle está en la PR #409) |
|---|---|---|---|
| 5.1 | ALFRED (Claude) | Que la 1106 sigue lanzando `dtd-claude` y no el Runner | `succeeded`, exit 0, `dtd-claude` en el log, `claude` corre como `agentes-alfred`, evento `subscription_included`, sin retención ni incidente, sigue en el runner legado |
| 5.2 | Auxiliar (Codex), subtarea de 5.1 | El chequeo de credenciales de `codex_local` con nuestro `CODEX_HOME` | Sin `configuration incomplete`, corre como `agentes-auxiliar`, documento `critica` creado, subtarea cerrada y **visible como cerrada desde la tarea de 5.1** (#19588) |
| 5.3 | Un GLM en `idle` (Puente de ingeniería) | El cambio A con la 1106: las instrucciones llegan por `HERMES_EPHEMERAL_SYSTEM_PROMPT` | Cita sus instrucciones de Paperclip, cierra la tarea él mismo por la API, `succeeded`, hay un evento `unknown`/`unpriced` **y no queda retenido** |
| 5.4 | «Latido diario del CEO» con «Run now» | Rutinas y su próximo disparo | La rutina crea su tarea, ALFRED la toma, `last_fired_at` cambia, `next_run_at` queda mañana a las 11:00 UTC y el «Parte del viernes» sigue el 2026-11-13 a las 18:00 UTC |
| 5.6 | El mismo GLM, una corrida larga que Sam cancela | Que el cambio B cubre el #18956 | El agente no queda en `pausing` ni retenido, y hay 0 incidentes |

**Procesos.** Antes de 5.3 y a los 15 minutos de terminar: `ps -u agentes-run -o comm= | sort |
uniq -c`. Con Hermes 0.23, cada perfil usado deja un `hermes` y un `engram` que se cierran solos en
10 a 15 minutos [MEDIDO 2026-11-07]. Pasa si vuelve a lo de antes.

**Lo que el agente recibe**, solo nombres de variables, durante la corrida de 5.1 y la de 5.3:

```bash
p=$(pgrep -u agentes-alfred -n claude); sudo cat /proc/$p/environ | tr '\0' '\n' | cut -d= -f1 | sort
```

**Pasa si:**

- No aparecen `PAPERCLIP_AGENT_JWT_SECRET` ni `PAPERCLIP_TOOL_ACTION_SIGNING_SECRET`.
- `HERMES_EPHEMERAL_SYSTEM_PROMPT` le llega a Hermes y no a Claude.
- Tampoco aparece `PAPERCLIP_AGENT_PRIVATE_KEY`: el sudoers de `main` no la nombra (§2.5 y §6.2
  de la PR #409).
- `DTD_PERFIL` sí aparece. Si no llegara, el envoltorio sale con 64 (#19887) y se vuelve atrás.

**Skills, después de 5.3** (la primera corrida Hermes en la 1106): se repiten los dos comandos de
skills del §3.2.

**Pasan si:**

- Cada uno de los 16 perfiles tiene el mismo número que se anotó en el §3.2.
- `~agentes/.hermes/skills` tiene los mismos nombres, ahora apuntando dentro de la instalación de
  la `2026.1106.0`, o en otra carpeta que exista.
- El registro de la corrida de 5.3 no dice «Cannot start without the required Paperclip-managed
  skills».

**Al terminar las pruebas:**

1. Encender el puente: `sudo systemctl start dtd-alfred-bridge.service`.
2. Revisar su registro de los últimos minutos: no tiene que mostrar errores 401 ni 404 contra
   Paperclip.
3. Sam escribe una línea en `#alfred` y la recepción contesta.

### 7.1 Criterios de parada

Cualquiera de estos lleva al §8:

- el conteo de migraciones no da 373;
- la salud no responde `ok` con `2026.1106.0` dentro de los 10 minutos del §5, punto 3;
- aparece un incidente de presupuesto, o un agente vivo queda en `paused` por presupuesto o con
  `lifecycle_holds` no vacío;
- 5.1 o 5.3 fallan por la 1106 y no por la línea base. Por ejemplo, el envoltorio sale con 64 porque
  no llegó `DTD_PERFIL` (#19887);
- ALFRED o el Auxiliar cambian de `adapter_type` o de `engine`, o aparece un proceso de Runner;
- el número de skills de algún perfil cambió, o la corrida de 5.3 no arranca por las skills de
  Paperclip.

**Si la caída pasa de 15 minutos** sin que la salud dé `ok`:

- Si el registro muestra migraciones avanzando, Sam decide si espera hasta 30.
- Si no, se va al §8.

## 8. Volver atrás, paso a paso

**Cuándo:** con un criterio del §7.1. «Asesor comercial» ya estaba en `error` en la línea base, así
que una falla suya no cuenta; el Jefe de gabinete pasó 5.3 con Hermes 0.23.

**Por qué este orden.** Las migraciones no se revierten; lo dice el propio `--rollback` [CÓDIGO].
Por eso se restaura la copia en frío. **Nunca se arranca la 1012 sobre la base migrada**, y por
eso `paperclipai update --rollback` no es el primer paso: cambia el programa pero no la base.

1. **Que no corra nada.** Si el servidor responde, se cancelan las corridas vivas desde la
   pantalla. El puente sigue detenido (`sudo systemctl stop dtd-alfred-bridge.service`).
2. **Detener Paperclip y comprobar que quedó detenido:**

   ```bash
   A 'systemctl --user stop paperclip.service'
   A 'systemctl --user is-active paperclip.service'; sleep 30; A 'systemctl --user is-active paperclip.service'
   ```

   Las dos lecturas dan `inactive`. Si el comando de actualización volvió solo a la 1012, también
   se detiene primero.
3. **Comprobar el respaldo:** `A 'cd <dest> && sha256sum -c SHA256SUMS'` da todo OK.
4. **Poner a un lado lo de la 1106, sin borrarlo:** la base, el programa, la configuración y los
   enlaces de skills.

   ```bash
   A 'set -e; umask 077; s=$(date -u +%Y%m%dT%H%M%SZ); cd "$HOME"
   tar --ignore-failed-read -czf ".paperclip/config.1106-$s.tgz" .config/paperclip/paperclip.env \
     .config/systemd/user/paperclip.service .local/bin/paperclipai .paperclip/auth.json
   if [ -e .hermes/skills ]; then mv .hermes/skills ".hermes/skills.1106-$s"; fi
   cd .paperclip && mv instances/default "instances/default.1106-$s" && mv cli "cli.1106-$s"
   echo "$s"; ls -ld instances/default.1106-* cli.1106-* config.1106-*.tgz'
   ```

   - **La configuración de la 1106 se guarda en un `.tgz`**, y no con `mv`, para no dejar archivos
     sueltos en `~/.config/systemd/user`. Así el `tar -xzf config.tgz` del punto 5 la reemplaza,
     pero lo de la 1106 sigue guardado para mirarlo después.
   - Se anota el sello `s` que imprime.

5. **Restaurar la base, el programa, la configuración y los enlaces de skills**, con `umask 077`:

   ```bash
   A 'set -e; umask 077; tar -C "$HOME/.paperclip" -xzf <dest>/instancia-default.tgz
   tar -C "$HOME/.paperclip" -xzf <dest>/cli.tgz; tar -C "$HOME" -xzf <dest>/config.tgz
   if [ -f <dest>/skills-agentes.tgz ]; then tar -C "$HOME" -xzf <dest>/skills-agentes.tgz; fi
   systemctl --user daemon-reload; paperclipai --version'
   ```

   Restaurar `cli.tgz` ya deja activa la 1012: `paperclipai --version` tiene que decir
   `2026.1012.0` **antes** de arrancar.

   **Las skills de los perfiles se restauran solo si su número cambió** (§7). Como root, con la
   ruta del respaldo del §4:

   ```bash
   sudo bash -c 'set -e; umask 077; f=<respaldo-de-perfiles>.tgz; s=$(date -u +%Y%m%dT%H%M%SZ)
   sha256sum -c "$f.sha256"; cd /home/agentes-run/.hermes
   for d in profiles/*/skills; do mv "$d" "$d.1106-$s"; done
   tar -xzf "$f"; for p in profiles/*/; do printf "%s=%s " "$(basename "$p")" "$(ls "$p/skills" | wc -l)"; done; echo'
   ```

   Como root, `tar` conserva el dueño original de cada archivo. El conteo final tiene que dar el
   número anotado en el §3.2.
6. **Recién ahora, arrancar:** `A 'systemctl --user start paperclip.service'`.
   - La salud responde `ok` con `2026.1012.0`.
   - El script del §3.2, con `V=2026.1012.0`, vuelve a dar **304** en la consulta 4.
   - La consulta 2 sigue con las 8 políticas en `hard_stop_enabled = false`, porque el respaldo es
     posterior al cambio B.
   - Los dos comandos de skills del §3.2 dan lo mismo que antes de la ventana.
7. **Repetir 5.1 a 5.4 contra la 1012**, con tareas nuevas.
8. **Encender el puente** y que Sam confirme en `#alfred`.

**Lo que se pierde:** lo escrito en Paperclip entre la copia en frío y la vuelta atrás. Con la
ventana quieta, son solo las tareas de prueba.

**Se quedan** hasta que Sam decida qué hacer con ellos:

- `default.1106-…`, `cli.1106-…` y `config.1106-….tgz`;
- `~agentes/.hermes/skills.1106-…`;
- las `skills.1106-…` de los perfiles, si se restauraron.

## 9. Lo que no se hace

- **No presionar «Upgrade runner»** en ALFRED ni en el Auxiliar. El Runner no pasa por
  `dtd-claude` ni por `dtd-codex`, y se pierde el aislamiento por usuario. En cualquier alta nueva
  de Claude o Codex se elige «Legacy runner» en Advanced.
- Actualizar Hermes en la misma ventana.
- Saltarse el respaldo en frío.
- Encender Paperclip entre la copia en frío y la actualización.
- Correr `paperclipai update` sin `umask 022` (#17208).
- Arrancar la 1012 sobre la base migrada, o empezar la vuelta atrás con `paperclipai update
  --rollback` con el servicio encendido.
- Encender el corte duro de un presupuesto mientras siga abierto el #18956.
- Correr `pnpm db:migrate` ni poner `PAPERCLIP_MIGRATION_AUTO_APPLY` a mano. El servidor migra solo
  al arrancar.
- Abrir la ventana si existe `paperclipai.service` (§3.2).
- Leer filas de negocio de la base o imprimir valores de `paperclip.env` o de
  `adapter_config->'env'`.
- Borrar lo apartado de la 1106 (`default.1106-…`, `cli.1106-…`, `config.1106-….tgz`, las
  `skills.1106-…`), los respaldos o la versión 1012 guardada.

## 10. Cierre

Se anota en el handoff de la tarea que ejecute este guion:

- la hora de cada paso y la ruta de los dos respaldos con sus huellas cortas;
- la salida de `paperclipai --version` y el conteo de migraciones;
- el número de skills por perfil antes y después, y los enlaces de `~agentes/.hermes/skills`;
- el resultado de cada prueba (PASÓ, FALLÓ o NO EJECUTADO);
- el texto literal de los OK de Sam: el de las lecturas a T-15 y el de la ventana.

Después se actualizan:

- la unidad `paperclip.service`, cuya descripción todavía dice `2026.1012.0` (es solo el texto);
- el estado de este guion y el del documento de la #409 en `main`.
