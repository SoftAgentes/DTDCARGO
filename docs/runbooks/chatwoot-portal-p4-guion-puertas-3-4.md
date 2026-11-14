# Guion · Las puertas 3 y 4 de la carga P4, en el orden en que se corren (SDD-0586 §10.5.10)

> **Para qué es.** Es el checklist del DG para la puerta 3 (el ensayo) y la puerta 4 (la carga real), con los comandos listos para copiar. **No reemplaza al runbook:** las condiciones, las vueltas atrás completas y los textos de los OK están en [`chatwoot-portal-p4-puertas.md`](chatwoot-portal-p4-puertas.md), y cada paso de este guion lo cita. Si este guion y el runbook no dicen lo mismo, vale el runbook y se para.
>
> Lo armó el Worker de la 10.5 el 2026-11-11, por pedido del DG pasado por el Subdirector de Chatwoot. **Este guion no corre nada.** Cada bloque con ⛔ va con el OK nominal de Sam para ese bloque. Un OK no cubre el bloque siguiente.

## Cómo se usa

- **Dónde:** cada comando se corre en el VPS como root, en una terminal interactiva (`ssh -t root@217.216.54.70`), salvo los que dicen «en la PC del DG».
- **`ssh … bash -s < archivo` no sirve aquí:** un `docker exec -i` dentro se come el resto del guion por la entrada estándar (nota del DG, 2026-11-11). Los comandos se pegan de a uno.
- **Una casilla `[ ]` por paso.** Se marca solo si salió lo que dice «Para seguir». Si no sale, se para y se avisa al DG.
- **Las variables de la puerta 2,** que hizo el DG por runner el 2026-11-11 (evidencia en `/srv/ops/evidencias/p4-bandeja-20261111T122059Z`):
  - `BANDEJA=10`: «Conversaciones del portal», `Channel::Api`, sin `webhook_url`, sin saludo, sin asignación automática ni encuesta, con 1 miembro;
  - `AGENTE_SERVICIO=1`: el `CHATWOOT_SERVICE_USER_ID`, administrador de la cuenta 1;
  - `CUENTA=1`;
  - `TENANT=<uuid>`: el del tenant de producción; no es un secreto.

  Al empezar cada sesión de terminal, **después de que el 3.0 cree la carpeta** (`/srv/ops/portal-historial` no existe en el VPS hasta ese sub-paso, y antes el `cd` falla):

  ```bash
  cd /srv/ops/portal-historial && TENANT=<uuid> && CUENTA=1 && BANDEJA=10 && AGENTE_SERVICIO=1 && echo "HECHO cuenta=$CUENTA bandeja=$BANDEJA agente_servicio=$AGENTE_SERVICIO"
  ```

- **El token del enrutador no hace falta aquí.** Ningún guion de las puertas 3 y 4 usa `CHATWOOT_ROUTER_TOKEN` ni la API HTTP de Chatwoot: todos entran a los contenedores con `docker exec` (`extraer.sh:47`, `vincular.sh:51`, `cargar.sh:64`, `deshacer-vinculos.sh:200`, `ensayo-portal.sh:318` y `:322`). Su arreglo va en la puerta 5, sub-paso 5a, con su propio OK.

---

## Puerta 3 · El ensayo

### Antes de empezar

- [ ] **La puerta 2 está hecha:** `BANDEJA=10` y `AGENTE_SERVICIO=1`, con su evidencia.
- [ ] **La #504 está en `main`.** El orden es fijo: primero la #504, porque cambia `deshacer.sh` y `deshacer-carga.rb`, y después el 3.0, desde un `main` que la incluya. Sin ella no se empieza.

### 3.0 · ⛔ Los scripts en el VPS

Es el texto del runbook, puerta 3, sub-paso 3.0, con su OK nominal.

- [ ] **El checkout limpio, en la PC del DG,** desde la carpeta del repo:

  ```bash
  git fetch origin && git worktree add --detach ../portal-3-0 origin/main
  ```

  ```bash
  git -C ../portal-3-0 rev-parse HEAD && git -C ../portal-3-0 status --porcelain --ignored | wc -l
  ```

  **Para seguir:** el SHA, que va a la evidencia y al OK, y `0`.

- [ ] **La carpeta y los archivos,** en la PC del DG, con `cd ../portal-3-0`. Son los cuatro `scp` del runbook, en este orden:

  ```bash
  ssh root@217.216.54.70 install -d -m 700 /srv/ops/portal-historial
  ```

  ```bash
  scp infra/ops/portal-historial/extraer.sh infra/ops/portal-historial/vincular.sh infra/ops/portal-historial/limpiar.sh infra/ops/portal-historial/reservar.sql infra/ops/portal-historial/extraer.sql infra/ops/portal-historial/controles-studio.sql infra/ops/portal-historial/conteo-portal.sql infra/ops/portal-historial/cola-y-flag.sql infra/ops/portal-historial/cargar.sh infra/ops/portal-historial/cargar-portal.rb root@217.216.54.70:/srv/ops/portal-historial/
  ```

  ```bash
  scp infra/ops/portal-historial/ensayo-portal.sh infra/ops/portal-historial/copia-columnas.tsv infra/ops/portal-historial/ensayo-studio-esquema.sql root@217.216.54.70:/srv/ops/portal-historial/
  ```

  ```bash
  scp infra/ops/portal-historial/deshacer.sh infra/ops/portal-historial/deshacer-carga.rb root@217.216.54.70:/srv/ops/portal-historial/
  ```

  ```bash
  ssh root@217.216.54.70 install -d -m 700 /srv/ops/portal-historial/migraciones
  ```

  ```bash
  scp supabase/migrations/0006_clients.sql supabase/migrations/0106_conversaciones.sql supabase/migrations/0337_feature_flags_seed_and_trigger.sql supabase/migrations/0503_chatwoot_bandeja.sql supabase/migrations/0504_chatwoot_eventos.sql supabase/migrations/0508_chatwoot_bajas_purga.sql supabase/migrations/0519_chatwoot_portal.sql supabase/migrations/0520_chatwoot_portal_vuelta.sql supabase/migrations/0523_chatwoot_portal_carga.sql supabase/migrations/0524_chatwoot_portal_puerta4.sql root@217.216.54.70:/srv/ops/portal-historial/migraciones/
  ```

  ```bash
  scp supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sql supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sh root@217.216.54.70:/srv/ops/portal-historial/
  ```

- [ ] **El archivo de `SISTEMA`:** es el comando del runbook, con sus dos comprobaciones.

  ```bash
  ssh root@217.216.54.70 "umask 077; docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -U postgres -d postgres -c 'select system_identifier from pg_control_system()' | tr -d '\n' > /srv/ops/portal-historial/sistema-produccion.parcial && chmod 0600 /srv/ops/portal-historial/sistema-produccion.parcial && mv -f /srv/ops/portal-historial/sistema-produccion.parcial /srv/ops/portal-historial/sistema-produccion"
  ```

  ```bash
  ssh root@217.216.54.70 'grep -qxE "[0-9]+" /srv/ops/portal-historial/sistema-produccion && echo solo_cifras || echo no_son_solo_cifras'
  ```

  ```bash
  ssh root@217.216.54.70 'v=$(cat /srv/ops/portal-historial/sistema-produccion); printf "%s" "$v" | sha256sum | cut -c1-10'
  ```

  **Para seguir:** `solo_cifras` y `b4fbe1b236`. **Si no,** se corre `ssh root@217.216.54.70 rm -f /srv/ops/portal-historial/sistema-produccion`, se para y se avisa al DG.

- [ ] **Los permisos:**

  ```bash
  ssh root@217.216.54.70 chmod -R go-rwx /srv/ops/portal-historial
  ```

- [ ] **Comparar los sha256 de los 27 archivos**: 15 de `infra/ops/portal-historial/`, 2 de `supabase/cargas/portal-historial-deshacer/` y las 10 migraciones. Se hace en la PC del DG, dentro de `../portal-3-0`, con el SHA anotado. Cada lado se lista como «sha256 nombre», ordenado, y `diff` no tiene que mostrar nada.

  ```bash
  sha256sum infra/ops/portal-historial/{extraer.sh,vincular.sh,limpiar.sh,reservar.sql,extraer.sql,controles-studio.sql,conteo-portal.sql,cola-y-flag.sql,cargar.sh,cargar-portal.rb,ensayo-portal.sh,copia-columnas.tsv,ensayo-studio-esquema.sql,deshacer.sh,deshacer-carga.rb} supabase/cargas/portal-historial-deshacer/deshacer-vinculos.{sql,sh} supabase/migrations/{0006_clients,0106_conversaciones,0337_feature_flags_seed_and_trigger,0503_chatwoot_bandeja,0504_chatwoot_eventos,0508_chatwoot_bajas_purga,0519_chatwoot_portal,0520_chatwoot_portal_vuelta,0523_chatwoot_portal_carga,0524_chatwoot_portal_puerta4}.sql | sed -E 's#^([0-9a-f]{64}) [ *](.*/)?#\1  #' | sort > /tmp/portal-3-0-repo.txt; wc -l < /tmp/portal-3-0-repo.txt
  ```

  ```bash
  ssh root@217.216.54.70 'cd /srv/ops/portal-historial && sha256sum $(ls -A | grep -vx -e migraciones -e sistema-produccion -e deshacer) migraciones/*' | sed -E 's#^([0-9a-f]{64}) [ *](.*/)?#\1  #' | sort > /tmp/portal-3-0-vps.txt; diff /tmp/portal-3-0-repo.txt /tmp/portal-3-0-vps.txt && echo iguales
  ```

  **Para seguir:**
  - el primero da `27`;
  - el `diff` da `iguales`, sin ninguna línea antes. Una línea de más en el VPS, por ejemplo un `README.md`, también es una diferencia y se para.

  **Por qué ese `sed`:** el `sha256sum` de Git Bash escribe `hash *ruta`, y el de Linux, `hash  ruta`. El `sed` deja los dos como `hash  nombre`, sin la carpeta. El nombre `/tmp/portal-3-0-*.txt` es de la PC del DG; se puede cambiar por la carpeta temporal de la sesión.

  **Probado el 2026-11-11 en la PC, con Git Bash** (`sha256sum (GNU coreutils) 8.32`): el lado del repo da `27`. Un «VPS simulado», que es una carpeta local con los 27 archivos, `migraciones/`, `sistema-produccion` y `deshacer/`, da `iguales`. Con un `README.md` de más, o con un archivo cambiado, el `diff` muestra la diferencia. El lado del VPS no se probó en el VPS.

- [ ] **Lo que se mira en el VPS:**

  ```bash
  stat -c '%a %n' /srv/ops/portal-historial /srv/ops/portal-historial/migraciones; ls migraciones | wc -l; find /srv/ops/portal-historial -perm /077 | wc -l
  ```

  **Para seguir:** los dos en `700`, `10` migraciones y `0` archivos con permisos de grupo u otros.

- [ ] **El cierre del checkout, en la PC del DG,** desde la carpeta del repo y nunca desde adentro de `../portal-3-0`:

  ```bash
  git worktree remove ../portal-3-0 && test ! -e ../portal-3-0 && echo borrado
  ```

- [ ] **La evidencia del 3.0:** el SHA, las dos listas de sha256 y el `iguales`.

### Antes de correr el ensayo: lo que el CI no prueba

Es el runbook, puerta 3, «Lo que el CI no puede probar».

- [ ] **Los nombres de producción** son los que el guion toma por defecto:

  ```bash
  docker inspect -f '{{.Name}}' dtd-cargo-db-1 chatwoot-postgres-1 chatwoot-rails-1; test -d /srv/chatwoot && echo chatwoot_dir
  ```

  **Para seguir:** los tres nombres y `chatwoot_dir`. Si alguno no está, se para: no se cambia por una variable sin OK del DG.

- [ ] **Los cuatro inicializadores que exige la G0,** sin abrirlos:

  ```bash
  ls /srv/chatwoot/rails/zz_dtd_redaccion_logs.rb /srv/chatwoot/rails/zz_dtd_proteccion_register.rb /srv/chatwoot/rails/zz_dtd_revocar_sesiones.rb /srv/chatwoot/rails/zz_dtd_correo.rb
  ```

- [ ] **No hay una carga ni un ensayo a medias:**

  ```bash
  test ! -e /dev/shm/portal-historial && test ! -e /dev/shm/portal-ensayo && echo libre; systemctl is-active portal-p4-ensayo.service 2>/dev/null || true
  ```

  **Para seguir:** `libre`, y la unidad en `inactive` o desconocida.

  Se anota cuántos archivos hay en `/tmp` del Chatwoot de producción, para compararlo en la prueba de borrado:

  ```bash
  for c in chatwoot-rails-1 chatwoot-postgres-1; do echo "HECHO tmp_$c=$(docker exec "$c" sh -c 'ls -A /tmp | wc -l')"; done
  ```

### 1 · La comprobación `--solo-copia`, con los OK 1a y 1b

- [ ] **Los dos OK de la puerta 1 están dados,** el 1a y después el 1b, después del 3.0 y antes de la primera corrida. Los textos están en el runbook, en la puerta 1.

Copia y comprueba sin cargar (`ensayo-portal.sh:24`). Corre como unidad de systemd, igual que el ensayo:
- `TimeoutStopSec` de 600 s, porque la G1 exige 300 o más (`ensayo-portal.sh:77`);
- Nice 10;
- las entradas por `--setenv`. Ninguna es un secreto.

- [ ] **Lanzarla:**

  ```bash
  systemctl reset-failed portal-p4-ensayo.service 2>/dev/null; systemd-run --unit portal-p4-ensayo -p TimeoutStopSec=600s -p Nice=10 -p WorkingDirectory=/srv/ops/portal-historial --setenv=TENANT="$TENANT" --setenv=CUENTA="$CUENTA" --setenv=BANDEJA="$BANDEJA" --setenv=AGENTE_SERVICIO="$AGENTE_SERVICIO" /bin/bash /srv/ops/portal-historial/ensayo-portal.sh --solo-copia
  ```

- [ ] **Mirarla hasta que termine.** Solo salen `PASÓ` y `FALLÓ`, sin nombres ni textos (`ensayo-portal.sh:27-28`):

  ```bash
  journalctl -u portal-p4-ensayo -f -o cat
  ```

- [ ] **Su evidencia:**

  ```bash
  E=$(ls -t /srv/ops/portal-historial/evidencia-ensayo-portal-*.txt | head -n 1); echo "$E"; grep -E '^HECHO (ensayo_codigo|modo|lista_md5|unidad|limpieza_completa|error|tipos_studio_distintos|tipos_chatwoot_distintos|tipos_studio_consulta|tipos_chatwoot_consulta|tipos_studio_ausentes|tipos_chatwoot_ausentes)=' "$E"
  ```

  **Para seguir:**
  - `HECHO modo=solo-copia`;
  - `HECHO lista_md5=cc1534a8a223e37ab9485451d5ee922c`. **Si no es ese, los OK de la puerta 1 no cubren la corrida;**
  - `HECHO unidad=portal-p4-ensayo.service`;
  - `HECHO limpieza_completa=si`;
  - `HECHO ensayo_codigo=0`;
  - y, en el journal, ningún `FALLÓ`.

- [ ] **La prueba de borrado:**

  ```bash
  test ! -e /dev/shm/portal-historial && test ! -e /dev/shm/portal-ensayo && echo vacio; docker ps -aq --filter label=com.docker.compose.project=portal-ensayo | wc -l; docker volume ls -q --filter label=com.docker.compose.project=portal-ensayo | wc -l; docker network ls -q --filter label=com.docker.compose.project=portal-ensayo | wc -l; for c in chatwoot-rails-1 chatwoot-postgres-1; do echo "HECHO tmp_$c=$(docker exec "$c" sh -c 'ls -A /tmp | wc -l')"; done
  ```

  **Para seguir:** `vacio`, tres `0`, y los dos `tmp_` iguales a los que se anotaron antes de la corrida, en «No hay una carga ni un ensayo a medias». Es la parte de la prueba de borrado del runbook que pide «nada en `/tmp` del Chatwoot de producción». El ensayo lee producción por un tubo (`COPY … TO STDOUT`), sin dejar archivos ahí: el conteo lo comprueba.

  **Si el journal se cortó sin la línea `HECHO ensayo_codigo`** (la unidad murió por KILL, sin `trap`): se corre `bash /srv/ops/portal-historial/ensayo-portal.sh --limpiar` y esta misma prueba, antes de cualquier otro paso. Con el código 6, Docker no responde: se espera a que vuelva y se repite el `--limpiar` (runbook, 3.1, «Vuelta atrás»).

### 3.1 · ⛔ El ensayo completo

Es el runbook, puerta 3, sub-paso 3.1, con su OK nominal.

- [ ] **Lanzarlo:** el mismo comando, sin `--solo-copia`.

  ```bash
  systemctl reset-failed portal-p4-ensayo.service 2>/dev/null; systemd-run --unit portal-p4-ensayo -p TimeoutStopSec=600s -p Nice=10 -p WorkingDirectory=/srv/ops/portal-historial --setenv=TENANT="$TENANT" --setenv=CUENTA="$CUENTA" --setenv=BANDEJA="$BANDEJA" --setenv=AGENTE_SERVICIO="$AGENTE_SERVICIO" /bin/bash /srv/ops/portal-historial/ensayo-portal.sh
  ```

  ```bash
  journalctl -u portal-p4-ensayo -f -o cat
  ```

- [ ] **La evidencia:** el mismo `grep` de arriba, más el resumen:

  ```bash
  E=$(ls -t /srv/ops/portal-historial/evidencia-ensayo-portal-*.txt | head -n 1); grep -E '^HECHO (ensayo_codigo|modo|lista_md5|unidad|unidad_timeout_stop_s|limpieza_completa|error|tipos_studio_distintos|tipos_chatwoot_distintos|tipos_studio_consulta|tipos_chatwoot_consulta|tipos_studio_ausentes|tipos_chatwoot_ausentes|desarme_guarda|desarme_esperados|desarme_cw_antes|desarme_cw_despues|desarme_durable_antes|desarme_durable_despues)=' "$E"; journalctl -u portal-p4-ensayo -o cat --since today | grep -cE '^FALLÓ'
  ```

  **Para seguir:**
  - `modo=completo`;
  - el mismo `lista_md5`;
  - `unidad=portal-p4-ensayo.service`, con `unidad_timeout_stop_s=600`;
  - `limpieza_completa=si` y `ensayo_codigo=0`;
  - el desarme (decisión A del DG): `desarme_guarda=ok`, `desarme_cw_antes` igual a `desarme_cw_despues`, y `desarme_durable_antes=ausente` y `desarme_durable_despues=ausente`;
  - `0` líneas `FALLÓ`.

  Además, **salen en `PASÓ`** los ids de la lista del runbook (3.1, «Qué mide el ensayo»): `P0`, `P2`, `P3`, `A1` a `A7`, `S1`, `S2`, `D2`, `O1`, `E0`, `E1`, `E2`, `V10`, `V12`, `V13`, `CA`, `B1`, `B2`, `C1` a `C3`, `K1` a `K3` y `R0` a `R4`. `R0` a `R4` son el desarme del 4.6b sin el paso que borra: los pasos 1, 1b y 2, sobre las copias.

- [ ] **La prueba de borrado,** la misma de la comprobación.
- [ ] **El DG recibe la evidencia** antes de pedir la puerta 4. Lleva solo líneas `HECHO`, con conteos y md5.

---

## Puerta 4 · La carga real

### 4.0 · Antes de pedir el OK de la puerta 4

Son las condiciones del runbook, puerta 4. Sin todas, el DG no le pide la puerta a Sam.

- [ ] **La puerta 3 salió con `ensayo_codigo=0`,** y el DG tiene su evidencia.
- [ ] **Las dos vueltas atrás dirigidas están en `main` y ensayadas** por el DG con `rollback`: la de Studio (`deshacer-vinculos.sh`) y la de Chatwoot (`deshacer.sh`, con la #504, que ya está en `main` desde antes del 3.0).
- [ ] **El cargador tiene la prevención del log en `main`.** La línea tiene que estar:

  ```bash
  grep -c "log_min_error_statement" /srv/ops/portal-historial/cargar-portal.rb
  ```

  **Para seguir:** más de `0`. Su sha256 ya se comparó en el 3.0.

- [ ] **El rol de Rails es superusuario:**

  ```bash
  docker exec chatwoot-postgres-1 psql -X -At -v ON_ERROR_STOP=1 -U chatwoot -c 'SELECT rolsuper FROM pg_roles WHERE rolname = current_user'
  ```

  **Para seguir:** `t`.

- [ ] **El flag `chatwoot_portal` está apagado.** Se mira en 4.3.
- [ ] **El DG avisó al equipo, con la hora,** que entre la foto (4.4) y el encendido (puerta 5) no se responde desde Studio.
- [ ] **El `md5` del conteo de la spec:**

  ```bash
  md5sum /srv/ops/portal-historial/conteo-portal.sql
  ```

  **Para seguir:** `a5da12512b23b4662678e6eb5926c632`.

### 4.1 a 4.10 · ⛔ La carga, todo seguido y el mismo día

Los cubre un solo OK: el de la puerta 4 del runbook. **No cubre la 4.10a.** Se corre desde `/srv/ops/portal-historial/`, con las variables de arriba.

- [ ] **4.1 · Los dos respaldos.** Se anota la **hora de 4.1**.

  ```bash
  date -u +%FT%TZ; /srv/dtd-cargo/backup.sh; echo "studio=$?"
  ```

  ```bash
  systemctl start chatwoot-respaldo.service; echo "chatwoot=$?"; tail -n 20 /var/log/chatwoot-respaldo.log
  ```

  **Para seguir:** `studio=0` y `chatwoot=0`. Los dos archivos locales, en `/srv/backups/dtd-cargo/` y `/srv/backups/chatwoot/`, tienen una fecha posterior a la hora de 4.1. A la evidencia van el nombre, el tamaño y el sha256 de cada uno.

- [ ] **4.2 · La lectura previa:** C-6, C-7 y C-8, y C-1.

  ```bash
  docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant="$TENANT" -U postgres -d postgres -f - < controles-studio.sql
  ```

  ```bash
  docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant="$TENANT" -U postgres -d postgres -f - < conteo-portal.sql
  ```

  **Para seguir:** sale con 0. Se guardan las dos salidas: son la base de 4.8 y de los `ESPERADOS_*` del 4.6b.

- [ ] **4.3 · La cola y el flag:**

  ```bash
  docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant="$TENANT" -U postgres -d postgres -f - < cola-y-flag.sql
  ```

  **Para seguir:** `cola_y_flag=ok`. **Si da `NO`, no se extrae** y se avisa al DG.

- [ ] **4.4 · Extraer.** Se anota la **hora de 4.4**, que es la ventana del log de 4.10.

  ```bash
  date -u +%FT%TZ; DB=dtd-cargo-db-1 TENANT="$TENANT" CUENTA="$CUENTA" BANDEJA="$BANDEJA" bash extraer.sh
  ```

  **Para seguir:** código 0, `HECHO reservados=…` y `HECHO lineas=…`.

- [ ] **4.5 · Cargar en seco:**

  ```bash
  DB_CW=chatwoot-rails-1 CUENTA="$CUENTA" BANDEJA="$BANDEJA" AGENTE_SERVICIO="$AGENTE_SERVICIO" MODO=seco bash cargar.sh
  ```

  **Para seguir:**
  - código 0, `carga=ok` y `contenedor_limpio=si`;
  - `leidas` igual a la cabecera;
  - `conversaciones_existentes` y `conversaciones_estado_actualizado` ausentes, o en 0;
  - `secuencia` en `X->X`, sin avanzar;
  - `trabajos_nuevos=ninguno` y `correos_enviados=0`;
  - **en la primera corrida,** `contactos_nuevos`, `conversaciones_nuevas` y `mensajes_nuevos` iguales al preparado.

  **Si algo de eso no da, se para:** había algo antes en la bandeja, o `BANDEJA` no es la 10.

- [ ] **4.6 · Cargar.** Es el mismo comando, con `MODO=cargar`:

  ```bash
  DB_CW=chatwoot-rails-1 CUENTA="$CUENTA" BANDEJA="$BANDEJA" AGENTE_SERVICIO="$AGENTE_SERVICIO" MODO=cargar bash cargar.sh; stat -c %a /dev/shm/portal-historial/vinculos.ndjson
  ```

  **Para seguir:**
  - código 0, `carga=ok` y `contenedor_limpio=si`;
  - los `*_nuevos` iguales a los del seco;
  - `secuencia` avanza exactamente `conversaciones_nuevas`;
  - `trabajos_nuevos=ninguno` y `correos_enviados=0`;
  - `vinculos_lineas` es 1 + contactos + conversaciones + mensajes;
  - `600`.

  **Si falla:** se repite 4.6 sin limpiar, porque no duplica (runbook, 4.6, «Vuelta atrás», camino 1). Si la carga quedó mal, va el 4.6b, que tiene sus propios OK.

- [ ] **4.7 · Vincular, sin pausa después de 4.6:**

  ```bash
  DB=dtd-cargo-db-1 TENANT="$TENANT" bash vincular.sh
  ```

  **Para seguir:**
  - código 0;
  - `HECHO contactos=… hilos=… mensajes=…`, con los números del preparado;
  - `HECHO borrado=/dev/shm/portal-historial`.

  **Si falla, Studio no cambió:** se corre `limpiar.sh` y se repite desde 4.4, o se corre `limpiar.sh` y no se repite. Repetir se decide con el DG (runbook, 4.7).

- [ ] **4.8 · Los conteos:** es el mismo `controles-studio.sql` de 4.2.

  ```bash
  docker exec -i dtd-cargo-db-1 psql -X -q -At -v ON_ERROR_STOP=1 -v tenant="$TENANT" -U postgres -d postgres -f - < controles-studio.sql
  ```

  **Para seguir:**
  - C-6 y C-7 iguales a 4.2;
  - en C-8, `hilos_vinculados` igual a las conversaciones cargadas y `salida_cargado` igual a los mensajes.

- [ ] **4.9 · El cierre de los archivos:**

  ```bash
  test ! -e /dev/shm/portal-historial && echo vacio; docker exec chatwoot-rails-1 sh -c 'test ! -e /dev/shm/portal-historial && test ! -e /tmp/cargar-portal.rb && echo limpio'
  ```

  **Para seguir:** `vacio` y `limpio`.

- [ ] **4.10 · El log de Postgres de Chatwoot.** Se cuentan las líneas, sin copiarlas.

  ```bash
  docker exec chatwoot-postgres-1 psql -X -At -U chatwoot -c 'SHOW logging_collector'
  ```

  Con `off`, el log es la salida del contenedor, desde la hora de 4.4:

  ```bash
  docker logs --since <hora de 4.4, en UTC> chatwoot-postgres-1 2>&1 | grep -c -E 'Failing row|DETAIL: +Key|STATEMENT: +INSERT'
  ```

  Con `on`, se usa el bloque «4.10, el conteo del log» del runbook, con su advertencia sobre `log_directory`.

  **Para seguir:** `0`, anotado como «revisado, 0 líneas». **Más de 0 con `carga=ok`** son errores ajenos a la carga, y se anota el número. **Más de 0 con `carga=error`** abre la 4.10a: se para y se define con el DG, con su propio OK.

- [ ] **La evidencia de la puerta 4,** en `/srv/ops/evidencias/` (root 0700, archivos 0600). Lleva:
  - las horas de 4.1 y de 4.4;
  - las líneas `HECHO`;
  - los conteos de 4.2 y de 4.8;
  - «revisado, N líneas».

  Nada de nombres ni de textos.

### 4.6b · La vuelta atrás dirigida, el borrado

**Se corre solo si la carga quedó mal,** con un OK de Sam para cada paso que borra. Su guion completo está en el runbook, puerta 4, sub-paso 4.6b:
- los cinco pasos;
- los `.hecho` y la copia durable;
- `SISTEMA`;
- los caminos A y B del `.inicio`;
- el abandono.

**Aquí no se copia:** dos copias de un borrado permanente no pueden quedar distintas, así que su única versión es la del runbook. Ya trae la #504, en `main` desde `8f2029a80`. Antes de usarlo, se lee en el runbook de `main` y se compara con la cabecera del `deshacer.sh` que quedó en el VPS en el 3.0.

---

## De dónde sale cada cosa

- **Los comandos:** el runbook de puertas, puertas 3 y 4, en `main` (`326be27fe`, con la #504 y este guion). Los comandos que este guion agrega:
  - la comparación de los sha256 del 3.0;
  - el lanzamiento con `systemd-run`, sus lecturas del journal y de la evidencia;
  - la prueba de borrado por etiqueta de compose.
- **El lanzamiento como unidad:** el ensayo exige `TimeoutStopSec` de 300 s o más si corre como unidad (`ensayo-portal.sh:77` y `:290-305`). El valor y el Nice son los de `infra/ops/kommo-historial/lanzar-unidad.sh:32` y `:84`. **Ese lanzador no se reusa:** solo acepta las unidades del Archivo Kommo (`:60-63`).
- **El proyecto del ensayo:** `portal-ensayo` (`ensayo-portal.sh:10`), y la evidencia `evidencia-ensayo-portal-<UTC>.txt` en la carpeta del guion (`:79`).
- **La puerta 2:** la evidencia del DG del 2026-11-11, pasada por el Subdirector.
