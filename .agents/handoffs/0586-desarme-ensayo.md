# Handoff · SDD-0586 · El desarme del ensayo (R0 a R4), decisión A del DG

- **Rama:** `codex/0586-desarme-ensayo`, desde `origin/main` `67148d856`. Worktree `DTD-worktrees/0586-desarme-ensayo`.
- **Quién:** Worker 10.5 (E10), por encargo del Subdirector Chatwoot, con la decisión A del DG del 2026-11-14.
- **Spec:** reutiliza la 0586 §10.5.10. Agrega un párrafo, «El desarme, ensayado en el 3.1», después de «El orden con E5», y una casilla de aceptación. No hace falta un anexo.

## Qué cambia

1. **`infra/ops/portal-historial/ensayo-portal.sh`:** una etapa R, solo en el modo completo, después de K3 y antes de la producción después (P2 y P3). Sobre las copias:
   - **R0, la guarda:** `DB` y `DB_CW` son los contenedores de la copia, con su nombre fijo, del proyecto `portal-ensayo` y solo en la red aislada. Nunca son `dtd-cargo-db-1`, `chatwoot-postgres-1`, `chatwoot-rails-1` ni los `PROD_*`. Si no, la etapa no corre ni escribe nada y deja `HECHO error=desarme_no_es_la_copia`.
   - **R1:** `deshacer.sh` con `MODO=seco`. Su `antes=` tiene que ser el `despues=` de la última carga del ensayo (`carga-2.txt`). No hay números fijos.
   - **R2:** `deshacer.sh` con `MODO=borrar CONFIRMAR=no`. Exige `fin=rollback`, la bandeja de la copia de Chatwoot igual y ningún `chatwoot-borrar.hecho`.
   - **R3:** `deshacer-vinculos.sh` con `ENTORNO=copia MODO=ensayo`. Antes pone la marca `dtd.entorno=copia` en la base de la copia de Studio. Los `ESPERADOS_*` salen de C-8 de la copia y de sus contactos. Exige ROLLBACK, `controles-studio.sql` idéntico antes y después, y los contactos vinculados iguales.
   - **R4:** la copia durable `/srv/ops/portal-historial/deshacer` no se crea ni cambia. Los `.hecho` y el `.ndjson` quedan solo en `/dev/shm/portal-historial`, que borra el `trap`.
   - **G0, dos guardas nuevas:**
     - en el modo completo, exige los cuatro guiones del desarme junto al ensayo;
     - `ENSAYO_SIN_DESARME`, que salta la etapa, vale solo con `ENSAYO_PRUEBA=1` y con nombres de producción que no son los reales; si no, sale con `error=sin_desarme_fuera_de_la_prueba`.
2. **`ensayo-studio-esquema.sql`:** `entity_audit_log` vacía, porque `deshacer.sh` la exige. No entra ninguna fila: no está en `copia-columnas.tsv`.
3. **`pruebas/prueba-ensayo-portal.sh`** (workflow del Cargador, job `ensayo`):
   - **La carpeta de trabajo:** las corridas salen de una carpeta como la del VPS (`$TRABAJO/ph`, con `deshacer-vinculos.sh` y su `.sql`).
   - **Las corridas de siempre** pasan `ENSAYO_SIN_DESARME=1`: su bandeja tiene conversaciones con marcas que no son de la carga, y el seco se niega con ellas, como debe.
   - **G8:** el salto del desarme fuera de la prueba se niega. Su mutante es M33.
   - **La sección R, al final:** borra de la producción simulada lo que la bandeja no tiene de la carga, y corre el ensayo con el desarme. Exige R-R0 a R-R4, RT (sale con 0, limpia todo y no deja `/dev/shm/portal-historial`) y RP (la producción simulada no cambia).
   - **Los mutantes de la guarda, cada uno en su caso:**
     - M30, el desarme apunta al Chatwoot de producción: cae R-R0 y pasan RG y RP;
     - M32, apunta al Studio de producción: lo mismo;
     - M31, sin la guarda: cae RG.
4. **`infra/ops/tests/prueba-portal-historial.sh`** (Calidad): la guarda del desarme, sacada del archivo y corrida con un docker falso. Tiene un caso que pasa, cuatro que se niegan (producción, proyecto, red y nombre) y un mutante por condición. Son 9 casos más, así que **el piso de `pruebas-linux.sh` pasa de 151 a 160**.
5. **Los documentos:**
   - en el runbook, la lista de ids del 3.1 (R0 a R4, y lo que no mide), lo que escribe el 3.1 y la zona «Antes de la puerta 4»;
   - en el guion, el `grep` de la evidencia del 3.1, el «Para seguir» y la lista de ids.

## Revisión de datos personales (revisar-datos-ve)

No es asesoría legal: es un inventario técnico.

**Resumen:** 6 CORRECTO · 0 ENCONTRADO · 3 NO VERIFICABLE.

**Inventario de lo que la etapa toca.** Todo es de las copias efímeras; nada nuevo sale de producción:

| Dato | Qué es | Dónde queda | Quién lo ve | Retención |
|---|---|---|---|---|
| `contactos-conservados.ndjson` | cabecera (tenant, cuenta, bandeja, conteo) y, por contacto conservado, `identificador` `dtd-portal:<uuid>` y `contacto_id` | `/dev/shm/portal-historial` del VPS, 0600, y dentro del contenedor de la copia (0700), mientras corre | root | hasta el `trap` del ensayo |
| `chatwoot-seco.hecho` y `studio-ensayo.hecho` | una línea `HECHO` con sha256, tenant, cuenta, bandeja y conteos | `/dev/shm/portal-historial`, 0600 | root | hasta el `trap` |
| la evidencia `desarme_*` | conteos, `presente:n` o `ausente`, `ok` | `evidencia-ensayo-portal-*.txt` (0600) | root y el DG | la de la evidencia del 3.1 |

**Hallazgos:**
- `CORRECTO` · **El `.ndjson` solo lleva ids, sin nombres ni textos.** Lo escriben `deshacer-carga.rb:202`, con `identificador` y `contacto_id`, y `deshacer.sh:45`, que lo declara.
- `CORRECTO` · **Las salidas solo llevan líneas `HECHO`.** `deshacer.sh:273` filtra la salida del `.rb` a `^HECHO `, y las líneas `HILO` no salen. `deshacer-vinculos.sql:34` y `:233-235` devuelven solo conteos. La etapa las pasa a la evidencia con `paso` (`ensayo-portal.sh`, sección R).
- `CORRECTO` · **La copia durable no se crea en el seco, el 1b ni el ensayo.** `copiar_durable` (`deshacer.sh:235`) solo corre dentro de `MODO=borrar` con `CONFIRMAR=si` (`:213`). Con `CONFIRMAR=no` no escribe `chatwoot-borrar.hecho` (`:261`). R4 lo comprueba en cada corrida (`ensayo-portal.sh:929`).
- `CORRECTO` · **La limpieza borra lo que deja el desarme.**
  - El `trap` del ensayo borra `/dev/shm/portal-historial` (`ensayo-portal.sh:147` y `:183`), y `limpieza_completa` lo mide.
  - Dentro del contenedor de la copia, `deshacer.sh:244` borra su carpeta y el `.rb`.
  - `deshacer-vinculos.sh:157-158` borra su foto del `.ndjson`.
  - En CI, RT exige `! -e /dev/shm/portal-historial`.
- `CORRECTO` · **Nunca toca producción.** La guarda R0 compara con los nombres de producción, con el proyecto, la red y el nombre fijo. Tiene sus mutantes en la Calidad (los 4) y en Actions (M30 a M32).
- `CORRECTO` · **`entity_audit_log` va vacía en la copia** (`ensayo-studio-esquema.sql:108`): no se copia ninguna fila de auditoría, que puede llevar datos.
- `NO VERIFICABLE` · que en el VPS `/dev/shm/portal-historial` quede vacío después del 3.1. Lo mide la prueba de borrado del guion, con `test ! -e`, en la corrida real.
- `NO VERIFICABLE` · que el contenedor de la copia no deje restos en su `/dev/shm`. Desaparece con los contenedores del proyecto; lo mide `limpieza=contenedores=0,…`.
- `NO VERIFICABLE` · quién tiene root mientras corre. Es la misma condición de la puerta 1, que mide el DG.

**Fuera de alcance:** la base de licitud de la copia ya está en los OK 1a y 1b de Sam. Esta etapa no agrega datos nuevos que copiar.

## Pruebas

| Comprobación | Resultado |
|---|---|
| `bash -n` de `ensayo-portal.sh`, `prueba-ensayo-portal.sh` y `prueba-portal-historial.sh` | PASÓ |
| La guarda del desarme con un docker falso (9 casos) | PASÓ en la PC |
| `prueba-portal-historial.sh` completa | NO DISPONIBLE en la PC: Git Bash no escribe en `/dev/shm`, y sin `node_modules` fallan los de PGlite. La mide la Calidad |
| El job `ensayo` del Cargador (R, G8 y M30 a M33) | NO EJECUTADO en la PC: no hay Docker. Lo mide el CI de la PR |
| `docs:check` y `sdd:check` | ver la PR |
| Las huellas de los documentos | runbook `79131b41`, guion `693fb4f3` y la lista `cc1534a8a223e37ab9485451d5ee922c`: iguales. El diff toca 0 líneas «OK nominal» |

## Pendientes de esta tarea

- El CI verde de la PR (Calidad y Cargador), y su revisión independiente, que lanza el DG.
- Después de la fusión, el DG pide un 3.0 nuevo, porque cambia el SHA, y el 3.1, con OK nuevos de Sam.

## FUERA DE ALCANCE DETECTADO

- En el guion, `:124`: `ls migraciones` debería ir con la ruta absoluta, `ls /srv/ops/portal-historial/migraciones`. Es una observación del DG sobre la #556.
- En el runbook, `:49`: «siguiendo el guion» debería decir «siguiendo el orden de ejecución del guion». Es otra observación del DG sobre la #556.
- **«Encendido alguna vez»** no se ensaya en la copia, porque la auditoría va vacía. Para ensayarlo habría que sumar `entity_audit_log` a `copia-columnas.tsv`, lo que cambia el md5 y pide OK nuevos 1a y 1b.

## Impacto documental

Cambian la spec 0586 §10.5.10 (el párrafo y la casilla), el runbook de las puertas (3.1 y «Antes de la puerta 4») y el guion de las puertas 3 y 4 (3.1). No hay cambios en Obsidian ni en Graphify desde esta rama.

## El rojo del job 132577863038 (cabeza 963a7bfc5)

- **Qué pasó:** R1 falló con `HECHO flag=cola` y `HECHO error=la_cola_corrio`. El fixture de la 0523 trae una salida «enviado» de hC (`salida_enviado=1`), y `deshacer.sh` se niega con eso, como debe. R2 y R3 cayeron en cascada, porque faltaba el `.ndjson` del seco (`sin_contactos_conservados`). R4 y RT cayeron por arrastre.
- **El arreglo, solo en la prueba:** igual que `prueba-deshacer.sh:171`, la sección R pasa esa salida a «cargado» en la producción simulada antes de correr. En producción, antes de la puerta 4, la cola nunca corrió (runbook, 4.3). El ensayo no cambia su criterio.
- **El log:** cada paso del desarme (`desarme-seco`, `desarme-1b` y `desarme-studio`) copia a la salida del ensayo todas sus líneas `HECHO`, y la prueba las pasa al log del CI. Son solo conteos, ids de tenant, cuenta y bandeja, y sha256. Las líneas que no son `HECHO` (un error de psql puede citar una fila) no se copian: solo se cuentan.
- **El `mensajes:7` frente a los 6 de E1 y E2, explicado:** el seco cuenta todas las filas de `messages` de la bandeja, igual que el `despues=` de la carga (`filas_en_bandeja`, `cargar-portal.rb:474`). Son las de antes de la carga (0), los mensajes de Studio (`mensajes_nuevos=6`, `:465`, los que vincula `vincular.sh`: `mensajes=6`) y la nota de archivo del hilo archivado (`notas_nuevas=1`, `:467`), que no es un mensaje de Studio ni va en los vínculos. 0 + 6 + 1 = 7.
  - **La regla en el ensayo:** R1 exige además esa suma, y que los vinculados sean los de Studio. Deja `HECHO desarme_mensajes=bandeja:…,antes_de_la_carga:…,de_studio:…,notas_de_archivo:…,al_repetir:…,vinculados:…`.
  - **La regla en la prueba:** RM lee esa línea y exige la suma, al menos una nota de archivo (la producción simulada tiene un hilo archivado), 0 al repetir y los vinculados iguales a los de Studio.
  - No cambió ningún número esperado: la igualdad de R1 con el `despues=` de la carga sigue.
- **R3 compara contra la foto de después de la carga.** Toma `controles-desarme-antes.txt` justo antes de `deshacer-vinculos.sh`, después de la carga y de R1 y R2, que no cambian Studio. Los `ESPERADOS_*` salen de su C-8. No usa `controles-antes.txt` (K), que es de antes de la carga.
