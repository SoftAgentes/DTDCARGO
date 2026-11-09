# Handoff · SDD-0586 4.6b · el desarme de Studio sigue el orden de los .hecho, con la carpeta durable

- **Rama:** `codex/0586-desarme-hecho`, desde `origin/main` `793ee2c17`. Worker 10.5, claim `worker-10.5-desarme-hecho`.
- **Encargo:** el Subdirector Chatwoot, con la secuencia del 4.6b que aprobó el DG el 2026-11-09:
  1. el seco de Chatwoot;
  2. Studio con `MODO=ensayo`;
  3. el borrado de Chatwoot;
  4. Studio con `MODO=aplicar`;
  5. el borrado del `.ndjson` y de los `.hecho`.
- **La carpeta durable:** es la opción (a) que eligió Sam. Su texto literal, según el Subdirector, fue «si protegidos», a las 04:1xZ.
- **Alcance:** solo `deshacer-vinculos.sh`, su contrato y sus mutantes. La SQL no cambia.

## Qué trae

**`supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sh`:**
- **El paso 2** exige `chatwoot-seco.hecho` y escribe `studio-ensayo.hecho`. Solo trabaja en tmpfs.
- **El paso 4** exige `studio-ensayo.hecho`, con el mismo `entorno`, y `chatwoot-borrar.hecho`, con `fin=commit`. Escribe `studio-aplicar.hecho` en tmpfs y en la carpeta durable.
- **Qué comprueba cada `.hecho`:**
  - el `conservados_sha256` del `.ndjson` y el `tenant` de la corrida;
  - en los de Chatwoot, también la `cuenta` y la `bandeja`.
  - Un enlace simbólico no vale. Si algo no cuadra, el guion se niega sin llamar a psql.
- **La foto:** a psql entra una foto del `.ndjson`, con su sha256. Si el `.ndjson` cambia durante la corrida, no deja evidencia.
- **Lo viejo:** la evidencia de un intento anterior se borra al empezar.
- **La escritura:** con `.parcial` + `mv`, en 0600.
- **La carpeta durable `/srv/ops/portal-historial/deshacer/`:**
  - es fija; otra ruta solo se acepta con `DESHACER_PRUEBA=1`, que usa la prueba bash;
  - **solo el paso 4 la lee,** y solo para lo que falta en tmpfs, como el `.ndjson` y los `.hecho` después de un reinicio;
  - si un archivo está en las dos carpetas y no son iguales, se niega (`copias_distintas`);
  - la carpeta tiene que estar en 0700 y no ser un enlace;
  - después de un reinicio, el paso 4 vuelve a crear `/dev/shm/portal-historial` en 0700 para su foto.
- **Las 11 guardas** van marcadas con `# guarda:<nombre>`: `seco`, `sha`, `tenant`, `viejo`, `ensayo`, `borrar`, `despues`, `respaldo`, `distintas`, `durable0700` y `durable_fijo`.

**`infra/ops/tests/prueba-portal-historial.sh`:**
- **Los casos del orden:**
  - el paso 2 sin seco, con otro sha256 y con otro tenant;
  - el ensayo bueno, con su formato y 0600;
  - el ensayo fallido, que no deja el `.hecho` viejo;
  - el paso 4 sin ensayo, con otro sha256, sin el borrado de Chatwoot y con otro tenant;
  - el aplicar bueno;
  - el `.ndjson` que cambia durante la corrida.
- **Los de la carpeta durable:**
  - **un reinicio entre el 3 y el 4:** tmpfs vacío y la copia durable presente. El 4 corre y deja su evidencia en las dos carpetas;
  - **la copia durable alterada:** se niega;
  - **un archivo distinto en las dos:** se niega;
  - **la durable sin 0700:** se niega;
  - **el ensayo no la lee;**
  - **fuera de la prueba, la ruta es fija.**
- **Los casos de antes,** adaptados.
- **11 mutantes,** uno por guarda, con un PISO de 11 y un control con el guion sin mutar.

## Para E5

E5 escribe dos archivos, `chatwoot-seco.hecho` en el paso 1 y `chatwoot-borrar.hecho` en el paso 3:
```
HECHO chatwoot_seco=ok conservados_sha256=… tenant=… cuenta=… bandeja=… utc=…
HECHO chatwoot_borrar=ok conservados_sha256=… tenant=… cuenta=… bandeja=… fin=commit utc=…
```
**Su paso 3, al hacer commit,** copia a `/srv/ops/portal-historial/deshacer/` (root 0700, archivos en 0600) cuatro archivos: el `.ndjson`, `chatwoot-seco.hecho`, `studio-ensayo.hecho` y `chatwoot-borrar.hecho`.

**El paso 5** borra las dos carpetas y comprueba que quedaron vacías. Va en el runbook.

## Revisión de datos personales (`revisar-datos-ve`): el paso de RAM a disco

**Alcance:** solo lo que este guion lee y escribe en la carpeta durable. La copia del paso 3 es de E5.

| Qué | Estado | Evidencia |
|---|---|---|
| **Qué se guarda.** El `.ndjson` trae una cabecera (`tenant_id`, `cuenta`, `bandeja`, `contactos`). Cada línea de contacto trae `identificador` (un uuid seudónimo, la reserva del riesgo 1) y `contacto_id` (el id numérico de Chatwoot). Los `.hecho` traen sha256, tenant, entorno, cuenta, bandeja y hora. No hay nombres, teléfonos, correos ni textos. | CORRECTO para el formato que este guion acepta | `deshacer-vinculos.sql:12-14`. La guarda de la barra invertida está en `deshacer-vinculos.sh`. |
| **¿Es dato personal?** El `identificador` y el `contacto_id` son seudónimos: identifican a una persona solo si se cruzan con Studio o con Chatwoot. Por eso se tratan como dato personal seudonimizado, no como anónimo. | ENCONTRADO: es seudónimo, no anónimo | Por diseño, según la spec 0586 §10.5.10. |
| **Quién lo ve.** Solo root: la carpeta en 0700 y los archivos en 0600. Según la medición del DG del 2026-11-09, root entra solo por la clave del DG, y los agentes no llegan a `/srv/ops`. | CORRECTO en este guion: exige 0700 y escribe en 0600. NO VERIFICABLE en el repo: el acceso real al VPS. | La guarda `durable0700` y el umask 077. La medición del DG está en el runbook, puerta 1. |
| **Cuánto dura.** Desde el paso 3 hasta el paso 5 de la misma vuelta atrás. **Regla del DG:** si el paso 4 no corre dentro de las 24 h siguientes al paso 3, el DG avisa a Sam y deciden juntos si reintentar el 4 o cerrar. El plazo empieza en el `utc=` de `chatwoot-borrar.hecho`. **La copia durable nunca se borra sin que el 4 haya salido con 0.** | CORRECTO en el guion: `limpiar.sh --cierre-4-6b` exige `studio-aplicar.hecho` (la guarda `aplicar`). El aviso a las 24 h es un procedimiento: NO VERIFICABLE en el repo. | La regla está en el 4.6b del runbook, en la vuelta de la #479. |
| **Quién lo borra.** El paso 5, que corre Sam, borra las dos carpetas y comprueba que quedaron vacías. Este guion no borra la durable. Solo borra su propio `.hecho` viejo. | NO VERIFICABLE todavía: el paso 5 no está escrito | Va en el runbook y en `limpiar.sh`, si E5 lo extiende. |
| **Respaldo del disco.** Lo midió el DG hacia las 04:30Z del 2026-11-09. **Los respaldos programados del VPS no incluyen `/srv/ops/portal-historial/`.** `dtd-cargo-backup` hace el dump de la base y `config-backup.sh` (`.env` y el volumen `db-config`). `chatwoot-respaldo` hace el dump y `/app/storage`. **Pero Sam tiene activado el Auto Backup de Contabo** («Sí, está activado»): la copia durable queda también en ese respaldo hasta que caduque. **Según la captura del panel que mandó Sam,** el respaldo es diario, y hay al menos 4 copias seguidas, del 5 al 8 de noviembre, de 72 a 78 GB cada una. Contabo avisa de problemas de rendimiento en US-east: las copias pueden atrasarse y la restauración puede no estar disponible por ahora. **El registro, literal del DG:** «la copia durable de la vuelta atrás quedará en el Auto Backup diario de Contabo durante su retención (no verificada); es un riesgo que ya existía, porque esa copia es del disco entero». | ENCONTRADO, como **riesgo ya existente, sin aumento material.** Ese respaldo es del disco entero y ya contiene las bases de producción de Studio y de Chatwoot con los datos reales. La copia solo agrega uuid seudónimos e ids que ya están ahí. **La retención del Auto Backup de Contabo:** NO VERIFICABLE desde el VPS. | La medición del DG y la respuesta literal de Sam, por medio del Subdirector. |

**Las dos preguntas al DG y a Sam ya tienen respuesta,** y quedan en las dos filas de arriba.

Esta revisión no es asesoría legal.

## Evidencia

| Comprobación | Estado |
|---|---|
| `bash -n` de los dos archivos | PASÓ |
| Cada marca `# guarda:` aparece una sola vez | PASÓ (11) |
| `prueba-portal-historial.sh` en Linux (necesita `/dev/shm`) | NO EJECUTADO todavía. Espera el turno, para correrla en un contenedor Linux o en el CI. |
| `pnpm verify` y `sdd:check` | NO EJECUTADO. Solo cambian un guion de ops y su prueba bash, y la spec no se toca. |

## Pendientes de esta tarea

- **Correr la prueba en Linux** y publicar con el OK, después de mandar el SHA y el `--stat`.
- **El README de `supabase/cargas/portal-historial-deshacer/`:** no se toca en esta PR, por el alcance del encargo. Los `.hecho`, la carpeta durable y el paso 5 van a la spec y al 4.6b, en la vuelta de la #479 o en la pieza siguiente.

## FUERA DE ALCANCE DETECTADO

- **La opción (b), que no se implementa.** Sam eligió la (a). Lo que encontré queda como dato:
  - `cargar-portal.rb:279-285` reconoce el contacto por `identifier = dtd-portal:<identificador>` y lo reusa si existe;
  - en Studio, `chatwoot_portal_contactos.chatwoot_contact_id` lo leen la cola (`0519:267`) y la vinculación (`0519:396-408`, `0523:302-316`).

## La revisión del delta de la #479 (2026-11-09): lo que toca esta PR

- **Quién escribe la durable,** decisión del DG:
  - el paso 3 la **crea**: el `.ndjson`, `chatwoot-seco.hecho` y `studio-ensayo.hecho`, y después `chatwoot-borrar.hecho`;
  - el paso 4 le **agrega** `studio-aplicar.hecho`;
  - nada antes del paso 3 toca el disco.

  El comentario del guion ya lo dice así, y el código ya lo hacía.
- **`limpiar.sh --abandono-4-6b`:** es la salida si el paso 3 falla o no se corre y la vuelta atrás se abandona. Lo corre Sam, con su OK.
  - Borra las dos carpetas **solo si no hay `chatwoot-borrar.hecho`** en ninguna de las dos.
  - Si lo hay, se niega y no toca nada: Chatwoot ya confirmó, y hay que terminar el paso 4.
  - **Sus casos:**
    - el abandono bueno;
    - con `chatwoot-borrar.hecho` en la durable, después de un reinicio;
    - con `chatwoot-borrar.hecho` en tmpfs.
  - **Su mutante:** `abandono`.

## El rojo previo (vuelta 1, `38e4afaba`)

**El job 129062189917, que relanzó el Subdirector:** «Pruebas bash de operaciones» terminó en failure, con `prueba-portal-historial.sh` en **56 PASÓ y 39 FALLÓ**, contra los guiones de `main`.
- **Los 39 FALLÓ son únicos,** y entre ellos no está ninguno de los 9 casos de antes. Así que esos 9 están entre los 56 PASÓ. Los nueve son: sin archivo, MODO, ENTORNO, SISTEMA, el tenant, los números, la barra invertida, el DIR y el archivo sin salto final.
- **Caen, como se esperaba:** los casos del orden y de la durable, los mutantes («la marca no está una sola vez»), «caen 0 de 11», el control y el cierre.
- **Un caso débil que destapó el rojo:**
  - «`--cierre-4-6b` encuentra `studio-aplicar.hecho` en la durable después de un reinicio» dio PASÓ contra el `limpiar.sh` de `main`, que no tiene esa opción.
  - **Por qué:** el caso no se detenía si su preparación fallaba. La durable nunca se creó, y «las dos carpetas ausentes» se cumplía igual.
  - **El arreglo, en la vuelta 2:** los casos del cierre llevan `cierre_listo … || return 1`. El del reinicio exige antes que haya `studio-aplicar.hecho` en la durable y tmpfs vacío, y después la línea `HECHO cierre_4_6b=ok …`.

## La vuelta 2 en el CI (`8b7ac72b5`, run 42595523034, intento 2): 87 PASÓ y 12 FALLÓ, y su arreglo

**Qué pasó:**
- `caso_ensayo_ok` falló en su primera corrida, y con él todos los casos que se apoyan en él.
- **La causa:** la sección de los DIR, más arriba en la prueba, deja `${D}/centinela`. `sin_hecho` solo borraba los `.hecho`, así que el control «en `${D}` quedan solo los 3 archivos esperados» fallaba.
- Después del `limpiar.sh` de su sección, `${D}` ya estaba vacía, y por eso los casos del cierre y del abandono pasaron.
- **Lo peor:** varios mutantes «cayeron» sin probar nada, porque su caso ya fallaba con el guion real. El control sin mutar sí lo detectó, pero solo miraba 4 casos.

**El arreglo:**
- `sin_hecho` deja las dos carpetas vacías de verdad: `rm -rf` de las dos y `mkdir -m 0700 ${D}`.
- **Cada mutante cuenta solo si su caso pasa con el guion real y falla con el mutante.** Si su caso no pasa con el real, sale `ko «control: … no prueba nada»`. Vale en los dos bucles, el de `deshacer-vinculos.sh` y el de `limpiar.sh`, y en el del abandono.
- El control final suma `caso_ensayo_ok` y `caso_ensayo_viejo`.

## Adelanto de la revisión del DG: la base limpia en los tres bucles y el mutante del control (commit local, sin push)

- **`probar_mutante <var> <guion real> <guarda> <caso>`:** una sola función, que usan los tres bucles: el desarme (11), el cierre (2) y el abandono (1). Devuelve:
  - 0 si cae: su caso pasa con el guion real y falla con el mutante;
  - 1 si sobrevive;
  - 2 si el caso no pasa con el guion real: el mutante no prueba nada, y no cuenta para el PISO;
  - 3 si la marca no está una sola vez.

  La exigencia del guion real es la línea `# control:base`.
- **`informar_mutante`** da el mismo texto en los tres bucles. El abandono tiene ahora su PISO: «cae el mutante del abandono».
- **El MUTANTE DEL CONTROL:**
  - saca `probar_mutante` de este mismo archivo sin la línea `# control:base` y la evalúa como `probar_mutante_sin_control`;
  - con `caso_siempre_falla`, el control da 2 y sin control da 0, que sería un mutante vacío contado como caído. La prueba exige las dos cosas;
  - exige además que la marca `control:base` esté una sola vez.
- **Medido en local, sin la prueba entera** (no hay `/dev/shm` real en esta PC): `bash -n` PASÓ. Con un guion falso de una línea, `probar_mutante` da los 5 resultados esperados: 2, 0 sin control, 1, 0 y 3.
