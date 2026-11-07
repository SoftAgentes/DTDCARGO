# Guion de ejecución: Paperclip 2026.1012.0 → 2026.1106.0 en la oficina

Dueño: Sam (Junta de la oficina) · Estado: **escrito, sin ejecutar** · Escrito: 2026-11-07 ·
review-by: 2026-12-07

Sirve para correr el paso 3 de la evaluación de la PR #409
(`docs/organizacion/oficina-agentes/actualizacion-paperclip-hermes.md`, §3 y §5). Ese documento
explica el porqué. Aquí van los comandos, el orden, lo que tiene que salir en cada paso y qué hace
Sam en cada momento.

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
| Al abrir la ventana | Da el OK nombrando el VPS de la oficina, en el chat de la sesión que va a ejecutar. Abre el túnel y su sesión de Paperclip en `localhost:3100` |
| Durante toda la ventana | No escribe en `#alfred` ni crea tareas. Lo que se cree en 1106 se pierde si hay que volver atrás |
| Paso 5 | Pone `unpricedUsagePolicy = allow` en las 8 políticas desde la pantalla de presupuestos, o autoriza que se haga por la API con su sesión, como en el cambio B |
| Paso 6 | Autoriza crear las tareas de prueba (por la API con su sesión, o las crea él) y presiona «Run now» en la rutina de 5.4. En 5.6 cancela la corrida desde la pantalla |
| Al cierre | Escribe una línea en `#alfred` y confirma que la recepción contesta |
| Si algo falla | Decide si se vuelve atrás (§8). Con el OK de la ventana alcanza: no hace falta otro |

## 3. Comprobaciones previas

### 3.1 Revisión de issues del día (desde la PC, sin tocar el VPS)

```bash
gh release list -R paperclipai/paperclip --limit 5
gh search issues --repo paperclipai/paperclip "2026.1106.0" --state open --limit 30
gh issue view 18956 -R paperclipai/paperclip --json state,updatedAt
gh issue view 18314 -R paperclipai/paperclip --json state,updatedAt
gh issue view 18316 -R paperclipai/paperclip --json state,updatedAt
gh issue view 19588 -R paperclipai/paperclip --json state,updatedAt
```

**Sigue si:**

- **No hay una 1106.1.** Si salió, se para y se evalúa esa con el documento de la PR #409.
- **No hay un reporte nuevo** de pérdida de datos, migración que no termina o agentes que no
  arrancan después de actualizar.
- **#18956, #18314 y #18316:** abiertos está bien, el cambio B y la falta de sesiones guardadas los
  cubren. Si alguno se cerró, se anota y se sigue.
- **#19588** (la subtarea terminada que el padre no ve): se vigila en 5.2.

La revisión del 2026-11-07 no encontró una 1106.1 y dejó los tres primeros abiertos. El #19820 no
aplica, porque Sam entra por `localhost` con el túnel.

### 3.2 En el VPS, en solo lectura, a T-15 minutos

Todo como el usuario administrador del VPS, con `sudo`. Para no repetir la forma de entrar como
`agentes`:

```bash
A() { sudo -n -u agentes -H env XDG_RUNTIME_DIR=/run/user/$(id -u agentes) bash -lc "$*"; }
```

**Versión y servicio:**

```bash
A 'paperclipai --version'                                  # 2026.1012.0 (managed npm pinned; …)
A 'systemctl --user is-active paperclip.service'           # active
A 'systemctl --user status paperclipai.service --no-pager' # «could not be found»: ver §5
curl -s http://127.0.0.1:3100/api/health; echo             # "status":"ok" y versión 2026.1012.0
df -h / | tail -1                                          # más de 5 GB libres
```

**Huellas de los envoltorios** contra la tabla del §1:

```bash
for f in /usr/local/libexec/dtd-motor /usr/local/libexec/dtd-agente-run \
  /etc/sudoers.d/91-agentes-run /usr/local/bin/dtd-claude /usr/local/bin/dtd-codex \
  /home/agentes-alfred/.claude/settings.json; do
  printf '%s %s\n' "$(sudo sha256sum "$f" | cut -c1-16)" "$f"; done
sudo -u agentes-run /opt/hermes/bin/hermes --version | head -1   # Hermes Agent v0.23.0
```

**La base, en solo lectura.** Se usa un script de Node con el driver `postgres` que trae el propio
Paperclip, igual que en la PR #409. La conexión es la de la base embebida, en `127.0.0.1:54329`,
con usuario y clave por defecto; no se escribe aquí. Siempre con
`default_transaction_read_only: "on"` en la conexión y, además, `SET default_transaction_read_only
= on` antes de la primera consulta. El script se borra al terminar.

```bash
DRV=$(sudo -u agentes find /home/agentes/.paperclip/cli/installs/npm -maxdepth 8 \
  -path '*node_modules/postgres/package.json' 2>/dev/null | head -1)
```

```sql
SET default_transaction_read_only = on;
-- 1. corridas vivas o en cola: 0 filas
select status, count(*) from heartbeat_runs where status in ('queued','running') group by 1;
-- 2. políticas vivas: las 8 con hard_stop_enabled = false (cambio B)
select a.name, bp.amount, bp.warn_percent, bp.hard_stop_enabled, bp.notify_enabled, bp.is_active
from budget_policies bp join agents a on a.id = bp.scope_id
where bp.scope_type = 'agent' and a.status <> 'terminated' order by a.name;
-- 3. incidentes: 0 abiertos
select status, count(*) from budget_incidents group by 1;
-- 4. migraciones: 304
select count(*) from drizzle.__drizzle_migrations;
-- 5. próximos disparos de rutinas: ninguno dentro de la ventana
select r.title, rt.next_run_at from routine_triggers rt join routines r on r.id = rt.routine_id
where rt.enabled and r.status = 'active' order by rt.next_run_at;
-- 6. latidos por tiempo de los agentes vivos
select name, status, last_heartbeat_at, runtime_config->'heartbeat' as heartbeat
from agents where status <> 'terminated' order by name;
```

**Sigue si:**

- La consulta 1 da 0 filas.
- Las 8 políticas tienen `hard_stop_enabled = false`.
- No hay incidentes abiertos.
- Hay 304 migraciones.
- **Ningún disparo cae dentro de la ventana, más 30 minutos.** Hoy son el «Latido diario del CEO»
  a las 11:00 UTC y el «Parte del viernes» a las 18:00 UTC [MEDIDO]. Las rutinas tienen
  `catch_up_policy = skip_missed` por defecto [CÓDIGO 1012], así que un disparo perdido durante la
  ventana se salta y no se repite.
- **Ningún agente tiene un latido por tiempo** que caiga en la ventana. La forma de
  `runtime_config->'heartbeat'` no se midió: si la consulta 6 no la muestra, se mira en la pantalla
  de cada agente.

**El puente de ALFRED** (`dtd-alfred-bridge.service`) le habla a Paperclip con la llave de ALFRED.
Su nombre viene del README de `infra/oficina/dtd-alfred` y no se ha comprobado en el VPS:

```bash
systemctl is-active dtd-alfred-bridge.service dtd-hermes-telegram.service
```

## 4. Respaldo en frío

**Sam dio el OK de la ventana:** desde aquí se escribe en el VPS.

1. **Detener el puente**, para que no cree ni comente tareas que se perderían si se vuelve atrás.
   Sus encargos y avisos quedan guardados en su SQLite:

   ```bash
   sudo systemctl stop dtd-alfred-bridge.service
   ```

2. **Respaldo con Paperclip detenido.** La base es PostgreSQL embebido: copiar la carpeta con el
   servicio parado es la vuelta atrás que no depende de Paperclip.

   ```bash
   A 'set -e
   systemctl --user stop paperclip.service
   sello=$(date -u +%Y%m%dT%H%M%SZ); dest=$HOME/respaldo-paperclip-1106-$sello
   mkdir -m 700 "$dest"
   tar -C "$HOME/.paperclip" -czf "$dest/instancia-default.tgz" instances/default
   tar -C "$HOME/.paperclip" -czf "$dest/cli.tgz" cli
   cp -a "$HOME/.config/paperclip/paperclip.env" "$dest/"
   cp -a "$HOME/.config/systemd/user/paperclip.service" "$dest/"
   (cd "$dest" && sha256sum instancia-default.tgz cli.tgz paperclip.env paperclip.service > SHA256SUMS)
   systemctl --user start paperclip.service
   echo "$dest"; cut -c1-16,65- "$dest/SHA256SUMS"'
   ```

   - La instancia pesa unos 420 MB [MEDIDO]; el respaldo tarda unos minutos.
   - `paperclip.env` tiene secretos. Se queda en la casa de `agentes`, con 600, y no sale del VPS.
     El `cut` imprime solo la huella corta y el nombre.
   - **Anotar** la ruta de `dest` y las cuatro huellas cortas.

3. **Comprobar que volvió:** `curl -s http://127.0.0.1:3100/api/health` responde `ok` con
   `2026.1012.0`.

## 5. Actualizar

**Por qué el servicio tiene que estar encendido.** `paperclipai update` saca su propio respaldo de
la base antes de cambiar nada, y para eso necesita la base viva. Si no la alcanza, se niega
[CÓDIGO `cli/src/commands/update.ts:51-63`]. No se usa `--no-backup`.

**Por qué hay que reiniciar a mano [CÓDIGO e INFERENCIA].** Al terminar, el comando reinicia y
valida solo el servicio que él mismo administra, que se llama `paperclipai.service`
(`cli/src/services/service-manager.ts:120`). El nuestro es `paperclip.service`, hecho a mano en la
SDD-0564. Si `paperclipai.service` no existe (§3.2), el comando cambia la versión pero no reinicia
ni valida nada, y tampoco vuelve solo a la 1012 si algo falla. Lo hacemos nosotros en el paso 4.

1. **Ensayo, sin cambiar nada:**

   ```bash
   A 'paperclipai update --version 2026.1106.0 --dry-run'
   ```

   Tiene que decir «Would update paperclipai 2026.1012.0 → 2026.1106.0 after a database backup».

2. **Actualizar:**

   ```bash
   A 'paperclipai update --version 2026.1106.0'
   ```

   - Sale «Updated paperclipai 2026.1012.0 → 2026.1106.0», **sin** «and restarted the active
     service». Si dice que reinició, existe un `paperclipai.service`: se para y se revisa antes de
     seguir.
   - El proceso que corre sigue siendo el de la 1012 hasta el reinicio. La base todavía no migra.
   - La 1012 se queda guardada como versión anterior, para `--rollback`.

3. **Comprobar:** `A 'paperclipai --version'` da `2026.1106.0`.

4. **Reiniciar y esperar las migraciones:**

   ```bash
   A 'systemctl --user restart paperclip.service'
   for i in $(seq 1 60); do
     r=$(curl -s -m 3 http://127.0.0.1:3100/api/health) && echo "$r" | grep -q '"status":"ok"' && break
     sleep 10; done; echo "$r"
   A 'journalctl --user -u paperclip.service --since "-15 min" --no-pager' | grep -iE 'migrat|error' | tail -20
   ```

   - Sin terminal, el servidor aplica solo las migraciones pendientes al arrancar
     [CÓDIGO `server/src/index.ts:275-278`], porque `paperclip.env` no define
     `PAPERCLIP_MIGRATION_PROMPT` [MEDIDO, solo los nombres].
   - Son 69 migraciones, de la `0306` a la `0374`. Algunas son largas (`0313`, `0343`, `0345`,
     `0369`) y se pueden repetir si se cortan [NOTAS 1023 y 1106]. La espera es de hasta 10
     minutos.
   - **Pasa si:** la salud dice `ok` con `2026.1106.0`, el registro muestra las migraciones
     aplicadas y no hay errores.

5. **Conteo de migraciones**, con la consulta 4 del §3.2: **373**. Son los archivos de
   `packages/db/src/migrations` de la `v2026.1106.0`, igual que su `_journal.json` [CÓDIGO]. La
   consulta busca el driver de nuevo, porque ahora también está el de la 1106.

**Si algo de este paso falla, se va al §8.** No se intenta arreglar la 1106 dentro de la ventana.

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

**Comprobar en la base**, en solo lectura:

```sql
SET default_transaction_read_only = on;
select a.name, bp.hard_stop_enabled, bp.unpriced_usage_policy, bp.notify_enabled, bp.is_active
from budget_policies bp join agents a on a.id = bp.scope_id
where bp.scope_type = 'agent' and a.status <> 'terminated' order by a.name;
select status, count(*) from budget_incidents group by 1;
```

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

**Pasa si:** no aparecen `PAPERCLIP_AGENT_JWT_SECRET` ni `PAPERCLIP_TOOL_ACTION_SIGNING_SECRET`.
`HERMES_EPHEMERAL_SYSTEM_PROMPT` le llega a Hermes y no a Claude. `PAPERCLIP_AGENT_PRIVATE_KEY` sí
puede aparecer: es la llave del propio agente (§2.5 de la PR #409).

**Al terminar las pruebas:**

1. Encender el puente: `sudo systemctl start dtd-alfred-bridge.service`.
2. Revisar su registro de los últimos minutos: no tiene que mostrar errores 401 ni 404 contra
   Paperclip.
3. Sam escribe una línea en `#alfred` y la recepción contesta.

## 8. Volver atrás, paso a paso

Se vuelve atrás si falla el paso 5, o si una prueba del §7 falla por la 1106 y no por la línea
base: «Asesor comercial» y «Jefe de gabinete» ya estaban en `error`.

**Las migraciones no se revierten** [CÓDIGO, lo dice el propio `--rollback`]. Por eso se restaura
la carpeta del respaldo en frío. **Nunca se arranca la 1012 sobre la base migrada.**

1. **Que no corra nada.** Si hay corridas vivas, se cancelan desde la pantalla. El puente sigue
   detenido (`sudo systemctl stop dtd-alfred-bridge.service`).
2. **Detener Paperclip:** `A 'systemctl --user stop paperclip.service'`.
3. **Volver el programa a la 1012:** `A 'paperclipai update --rollback'`. Con el servicio detenido,
   no lo reinicia. Comprobar con `A 'paperclipai --version'` que da `2026.1012.0`.
   - Si `--rollback` falla, se restaura `cli.tgz`: mover `~agentes/.paperclip/cli` a un lado y
     sacar el `.tgz` en `~agentes/.paperclip`.
4. **Comprobar el respaldo:** `A 'cd <dest> && sha256sum -c SHA256SUMS'` da todo OK.
5. **Poner a un lado la base migrada, sin borrarla:**

   ```bash
   A 'mv "$HOME/.paperclip/instances/default" "$HOME/.paperclip/instances/default.1106-$(date -u +%Y%m%dT%H%M%SZ)"'
   ```

6. **Restaurar:** `A 'tar -C "$HOME/.paperclip" -xzf <dest>/instancia-default.tgz'`.
7. **Arrancar:** `A 'systemctl --user start paperclip.service'`. La salud responde `ok` con
   `2026.1012.0`, y la consulta 4 vuelve a dar **304**.
8. **Comprobar el cambio B:** la consulta 2 sigue con las 8 en `hard_stop_enabled = false`. El
   respaldo es posterior al cambio B.
9. **Repetir 5.1 a 5.4 contra la 1012**, con tareas nuevas.
10. **Encender el puente** y que Sam confirme en `#alfred`.

**Lo que se pierde:** lo escrito en Paperclip entre el respaldo en frío y la vuelta atrás. Con la
ventana quieta, son las tareas de prueba.

**La carpeta `default.1106-…` se queda** hasta que Sam decida qué hacer con ella. Ocupa lo mismo
que la instancia.

## 9. Lo que no se hace

- **No presionar «Upgrade runner»** en ALFRED ni en el Auxiliar. El Runner no pasa por
  `dtd-claude` ni por `dtd-codex`, y se pierde el aislamiento por usuario. En cualquier alta nueva
  de Claude o Codex se elige «Legacy runner» en Advanced.
- Actualizar Hermes en la misma ventana.
- Usar `--no-backup` o saltarse el respaldo en frío.
- Encender el corte duro de un presupuesto mientras siga abierto el #18956.
- Correr `pnpm db:migrate` ni poner `PAPERCLIP_MIGRATION_AUTO_APPLY` a mano. El servidor migra solo
  al arrancar.
- Leer filas de negocio de la base o imprimir valores de `paperclip.env`.
- Borrar `default.1106-…`, los respaldos o la versión 1012 guardada.

## 10. Cierre

Se anota en el handoff de la tarea que ejecute este guion:

- la hora de cada paso y la ruta del respaldo con sus huellas cortas;
- la salida de `paperclipai --version` y el conteo de migraciones;
- el resultado de cada prueba (PASÓ, FALLÓ o NO EJECUTADO);
- el texto literal del OK de Sam.

Después se actualizan:

- la unidad `paperclip.service`, cuya descripción todavía dice `2026.1012.0` (es solo el texto);
- el estado de este guion y el de la PR #409.
