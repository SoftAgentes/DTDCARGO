# SDD-0586 · P4 (10.7): el cargador del chat del portal a Chatwoot (handoff de Worker)

- **Owner:** Worker de Claude Code (E5), sesión `95191146-c154-4468-af0e-d46ad5a1e391`. Encargo del Director General, relayado por el Subdirector de Chatwoot (`local_535053f4-40c2-4124-a280-63f4fc882820`) el 2026-11-08.
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\0586-portal-historial-cargador`.
- **Rama:** `codex/0586-portal-historial-cargador`, desde `2e2ddeb34`.
- **SDD:** [0586](../../docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md) §10.5.10, pasos 3 y 5.6. La spec la edita E10 en su rama (`codex/0586-e10-7-p4-carga`), así que esta rama no la toca para no compartir archivos con E10. El formato de los dos ndjson quedó cerrado en `6b04182b9`, en la rama de E10, con las tres respuestas y las aclaraciones (i) a (iii) de E5.

## Alcance de esta PR (la primera de E5)

1. `infra/ops/portal-historial/cargar-portal.rb`: una copia adaptada de `kommo-historial/cargar-archivo-kommo.rb`, no un import, porque la 0619 retira esa carpeta. El cargador:
   - lee `preparado.ndjson` y escribe `vinculos.ndjson`, con solo ids;
   - escribe con `insert_all`, sin callbacks y con el log de SQL apagado;
   - antes de escribir, comprueba el archivo entero: la bandeja del portal (número y nombre), la cuenta y la bandeja de la cabecera, los conteos, el hilo de cada mensaje, el contacto de cada conversación, los agentes, `AGENTE_SERVICIO` y la ruta de `VINCULOS`;
   - toma un candado, para que dos cargas no se pisen;
   - reconoce lo ya cargado (contacto, conversación y mensaje) y usa el `contact_inbox` que ya exista;
   - mete la nota de archivo como mensaje de actividad;
   - tiene un modo seco, y sin `MODO` sale con error.
2. La prueba en GitHub Actions: `pruebas/prueba-cargador.sh`, `sonda-portal.rb`, `escenario-portal.rb` y `compose.cargador.yml`, con el workflow `.github/workflows/portal-historial-cargador.yml`. Trae una corrida real con un `rails runner` por paso, el control M0 y 31 mutantes.

## La revisión del DG sobre `50c044e49` (CHANGES_REQUESTED) y qué se hizo

| Punto | Qué se hizo | Prueba |
|---|---|---|
| **B1**, bloqueante: la bandeja del portal | `BANDEJA` es `CHATWOOT_INBOX_PORTAL_ID`, el número que da quien opera, y el cargador lo cruza con el nombre «Conversaciones del portal». Si no coinciden, aborta | G10a (SINT WhatsApp) y G10b («Archivo Kommo», API y sin webhook, como la 8 de producción), cada una con la cabecera de su bandeja; mutante M25 |
| N1: el ejemplo de la cabecera | Recuperé las barras invertidas y los saltos de línea | Lectura |
| N2 y N3: `VINCULOS` | Solo acepta la ruta fija `/dev/shm/portal-historial/vinculos.ndjson` o `-`. Lo valida al construir el cargador, antes de la transacción, y también exige que la carpeta exista | G11, mutante M26 |
| N4: sin `MODO` | El script sale con código 2 y `HECHO error=falta MODO` | N4 |
| N5: dos corridas a la vez | `pg_try_advisory_xact_lock(CANDADO)` dentro de la transacción. Si otra carga lo tiene, sale con «otra carga del portal en curso» | G12: la sonda toma el candado desde otra conexión; mutante M27 |
| N6: el handoff | Este | — |
| N7: el checkout del workflow | `persist-credentials: false` | Lectura |
| El log de Rails (datos personales) | `ActiveRecord::Base.logger = nil` mientras corre, y se restaura al final | F2: la carga 1 corre con el log de SQL en debug hacia `sql.log`. Una consulta de control demuestra que el log escribe, y ninguno de los valores inventados aparece. Mutante M28 |

**La revisión de idempotencia y SQL del par (APPROVED, con tres puntos para esta PR):**

| Punto | Qué se hizo | Prueba |
|---|---|---|
| `contact_inboxes.pubsub_token` quedaba nulo | Se genera al insertar, como `has_secure_token` (`SecureRandom.base58(24)`) | V12: 0 nulos en la bandeja; mutante M29 |
| El candado de N5 sin prueba de concurrencia | Dos cargas a la vez, en dos hilos con su propia conexión, sobre una cuenta nueva cuyos contactos y `contact_inbox` ya existen. Una tercera conexión bloquea la tabla de conversaciones hasta que las dos llegan. Con el candado, una se niega y queda una sola copia | G13; mutante M27, sin el candado: las dos insertan y quedan 8 conversaciones |
| Un mensaje reusado en otra conversación | **Aborta** con «un mensaje ya existe en otra conversación», y no vincula | G14; mutante M30 |
| Una conversación ya cargada con otro estado | **Se actualiza**, con `update_all` y sin callbacks. La carga va antes del encendido, cuando el estado lo pone el Studio; desde el encendido lo decide Chatwoot (E10-D39) y la carga ya no corre. Abortar dejaría trabada la repetición por cualquier cambio de estado en el Studio | R4: el hilo 1 pasa de `open` a `resolved` sin filas ni trabajos nuevos; mutante M31 |

Estas cuatro pruebas no tienen rojo previo propio: llegaron después del commit de pruebas `248efe973`. Su rojo lo da cada mutante, que corre la misma prueba sobre el cargador sin el arreglo.

**El rojo previo.** El commit `248efe973` trae solo las pruebas, con el cargador de `50c044e49`. Lo medí en Actions, en el run 42502431572. El resultado está en «Validación».

## Allowlist

Son 7 archivos, todos nuevos, y ninguno lo comparte con E10. Las copias son adaptaciones de `kommo-historial/`, y se copian porque la 0619 retira esa carpeta.

| Archivo | Origen | Para qué |
|---|---|---|
| `infra/ops/portal-historial/cargar-portal.rb` | Adaptado de `kommo-historial/cargar-archivo-kommo.rb` | El cargador del paso 3: lee el preparado, comprueba, carga sin efectos y devuelve los vínculos |
| `infra/ops/portal-historial/pruebas/prueba-cargador.sh` | Adaptado de `kommo-historial/pruebas/prueba-cargador.sh` | La prueba: el stack de Chatwoot efímero, la corrida real, las comprobaciones, M0 y los mutantes |
| `infra/ops/portal-historial/pruebas/sonda-portal.rb` | Adaptado de `kommo-historial/pruebas/sonda-cargador.rb` | Crea la línea base y el preparado inventado, mide lo cargado y los vínculos, y corre el candado y el log de SQL |
| `infra/ops/portal-historial/pruebas/escenario-portal.rb` | Adaptado de `kommo-historial/pruebas/escenario-mutante.rb` | Un escenario entero en un solo arranque de Rails, para M0 y los mutantes |
| `infra/ops/portal-historial/pruebas/compose.cargador.yml` | Copia de `kommo-historial/pruebas/compose.cargador.yml` | Monta en `prepare` el cargador, el estado y la ruta fija de los vínculos, y fija los digests de Postgres y Redis |
| `.github/workflows/portal-historial-cargador.yml` | Nuevo | Corre la prueba en Actions, porque lleva contenedores |
| `.agents/handoffs/0586-p4-portal-cargador.md` | Nuevo | Este handoff |

## El contrato de los vínculos en el VPS

- **La ruta es fija: `/dev/shm/portal-historial/vinculos.ndjson`.** Lo decidió el Subdirector el 2026-11-08, con lo que confirmó E10.
  - Es el nombre que lee `vincular.sh:21` (`$DIR/vinculos.ndjson`, con `DIR=/dev/shm/portal-historial`), en la misma carpeta 0700 de `preparado.ndjson`.
  - Si el archivo queda en otra ruta, `vincular.sh` sale con `HECHO error=sin_vinculos`. Por eso el cargador no acepta otra (G11).
- **Con `docker exec`, la misma ruta es la del contenedor,** en su `/dev/shm`, que es tmpfs. El esquema:

```sh
docker exec chatwoot-rails-1 install -d -m 0700 /dev/shm/portal-historial
docker exec -i -e MODO=cargar -e CUENTA=<id> -e BANDEJA=<CHATWOOT_INBOX_PORTAL_ID> -e AGENTE_SERVICIO=<id> -e CARGA=- \
  -e VINCULOS=/dev/shm/portal-historial/vinculos.ndjson chatwoot-rails-1 \
  bundle exec rails runner /tmp/cargar-portal.rb < /dev/shm/portal-historial/preparado.ndjson
docker cp chatwoot-rails-1:/dev/shm/portal-historial/vinculos.ndjson /dev/shm/portal-historial/vinculos.ndjson
chmod 0600 /dev/shm/portal-historial/vinculos.ndjson
docker exec chatwoot-rails-1 rm -rf /dev/shm/portal-historial /tmp/cargar-portal.rb
```

- **`VINCULOS=-` queda solo para pruebas.** En el contenedor, la salida de `rails runner` también trae Bundler y los logs de los inicializadores (R3, run 42495310693). Los vínculos salen con el prefijo `VINCULO `.
- **El README de `portal-historial/` es de E10,** así que no lo toco. La invocación queda aquí y en la cabecera de `cargar-portal.rb`.

## Condición de la revisión: la segunda PR, `cargar.sh`, va antes de la puerta 3

Lo pidió el DG en su revisión del 2026-11-08. `infra/ops/portal-historial/cargar.sh` es el puente entre el contenedor y el VPS, y va con el ensayo (5.6). **Tiene que estar fusionado antes de la puerta 3.** Lleva:

- el preparado por la entrada estándar (`docker exec -i … < preparado.ndjson`), sin copiarlo al contenedor;
- una carpeta propia con 0700, y los archivos con 0600;
- el traslado con `docker cp` a `/dev/shm/portal-historial/vinculos.ndjson` del VPS;
- un `trap` que borre del contenedor `/dev/shm/portal-historial` y `/tmp/cargar-portal.rb`, también si algo falla;
- la comprobación final de que no queda nada en el contenedor, ni `vinculos.ndjson.parcial` ni `/tmp/cargar-portal.rb`;
- su prueba en el workflow, con un fallo inyectado.

Además, la revisión de idempotencia pide en esa PR, y en el ensayo:
- **una prueba que una los dos lados**, con datos inventados: el preparado real de la 0523, el cargador y `vincular_carga`. Tiene que incluir repetir la carga con un preparado que trae más mensajes, y el efecto de un mensaje nuevo sobre lo cargado;
- **un mensaje mandado por la API a una conversación cargada,** mirando después `RetrySet` y `DeadSet` (el `pubsub_token`).

Se coordina con E10. Depende de `controles-studio.sql` (#456, de E10), así que se abre cuando la #456 esté en `main`.

## Permisos de los archivos

- `vinculos.ndjson` se escribe con el umask del contenedor y puede quedar 0644. Solo es aceptable porque lleva ids y no datos personales, y porque la carpeta es 0700 (§10.5.10). `cargar.sh` lo deja en 0600 en el VPS. Con 0600 desde root, la prueba no lo podía leer (run 42493739280).
- `preparado.ndjson` sí lleva nombres y textos. Lo crea E10 con 0600, y no pasa por el umask del cargador, que solo lo lee por la entrada estándar.

## Límites

- PR en borrador, sin fusionar.
- Nada en producción ni en el VPS.
- Solo datos inventados.
- No se corrió nada en la PC. Para eso hay que pedirle turno al Subdirector.
- La revisión independiente y la pasada de Codex las lanza el DG.

## Pendientes de esta tarea

- **El ensayo (5.6) y `cargar.sh`:** van en la segunda PR de E5, cuando la #456 esté en `main`.
- **La sección de la spec:** el diseño, la allowlist y la evidencia de esta PR los tiene que llevar la spec 0586, que es de E10.

## Validación

| Comprobación | Resultado |
|---|---|
| `bash -n` de `prueba-cargador.sh` | PASÓ |
| `ruby -c` de los `.rb` | NO DISPONIBLE en la PC, porque no hay Ruby. Los compila la prueba en Actions |
| Cargador sobre `63af8657a` (42492498255) | FALLÓ: la nota de archivo daba `ArgumentError` en `insert_all`, y la prueba comparaba los rechazos contra el `$3` equivocado |
| Cargador sobre `b16bec5e1` (42493739280) | FALLÓ en R2, R3, M0 y M20: los vínculos quedaban en 0600 de root y el runner no los leía |
| Cargador sobre `c46919317` (42495310693) | FALLÓ en R3: con `VINCULOS=-`, los vínculos salían mezclados con los logs de Rails |
| Cargador sobre `71ba22b43` (42496801281) | PASÓ: 0 fallas, M0 con 36 comprobaciones y los 24 mutantes |
| Calidad continua sobre `71ba22b43` | PASÓ |
| Rojo previo de la revisión del DG: las pruebas nuevas con el cargador de `50c044e49` (`248efe973`, 42502431572) | PENDIENTE |
| Cargador con los arreglos | PENDIENTE |
| `pnpm verify` | NO EJECUTADO: el cambio es de `infra/ops` y de un workflow, sin producto |

## FUERA DE ALCANCE DETECTADO

Nada por ahora.

## Estado

En curso: corrige la revisión CHANGES_REQUESTED del DG.
