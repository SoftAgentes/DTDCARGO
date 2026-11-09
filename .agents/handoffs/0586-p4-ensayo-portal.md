# Handoff · SDD-0586 10.7, PR 2b: el ensayo de la carga P4 en copias (`ensayo-portal.sh`)

- **Worker:** E5, bajo el Subdirector Chatwoot.
- **Rama:** `codex/0586-ensayo-portal`, que sale de main `04a295e1d`.
- **Estado:** lista para revisión desde `a43b4267b`. La revisión independiente del DG dio CHANGES_REQUESTED; las vueltas 7 y 8 lo atienden. Ya trae main `e74cde6fc` (el tren 9, con la #468 y la #470).
- **Fusión:** no se fusiona desde aquí; la fusiona el DG.

## Qué trae

- **`infra/ops/portal-historial/copia-columnas.tsv`:** la lista explícita de lo que el ensayo copia de producción. Es la condición 1 del DG.
  - Lleva una línea por tabla, con el lado, la tabla, las columnas (las `col=expresión` son sintéticas) y el filtro.
  - El ensayo arma cada `COPY` con esa lista, y la prueba de marcas la lee y la muta.
- **`infra/ops/portal-historial/ensayo-studio-esquema.sql`:** el esquema de la copia de Studio, sin datos.
  - Es el esquema de `pruebas/studio-fixture.sql` con las migraciones reales, más la 0508 y la 0524.
- **`infra/ops/portal-historial/ensayo-portal.sh`:** el ensayo de la puerta 3. Corre en el VPS.
  - **Guardas:**
    - `DB_CW`, si viene, tiene que ser el contenedor de la copia;
    - `/dev/shm/portal-historial` no puede existir, para no pisar una carga real;
    - carga del VPS, memoria y `TimeoutStopSec`.
  - **Producción** se mide en solo lectura antes y después (P0, P2, P3).
  - **Las copias:**
    - van en el proyecto `portal-ensayo`, en una red interna, sin puertos y con PGDATA en tmpfs;
    - el aislamiento se mide (A1 a A7);
    - el esquema se crea sin datos;
    - los datos entran con `COPY (SELECT <lista> … WHERE <filtro>) TO STDOUT`, en una transacción de solo lectura, por un tubo, a `COPY … FROM STDIN`, con `session_replication_role = replica`. Es la condición 2: el corte está en el `WHERE` de cada `COPY`.
  - **La evidencia** lleva, por tabla, las filas de la copia, las de producción y el md5 de sus columnas, y el md5 de la lista. Es la condición 3.
  - **O1:** 0 filas de otros tenants y otras cuentas.
  - **La carga en las copias:**
    - `extraer.sh`;
    - `cargar.sh`, en seco y después cargando;
    - los casos (a), B1 y B2 con `vincular.sh`, que tienen que dar 22023 sin cambiar Studio;
    - (c): `limpiar.sh` y repetir desde la extracción;
    - `controles-studio.sql` antes y después: C-6, C-7 y C-8.
  - **La limpieza:** el `trap` sale con 4 si no queda limpio.
  - **`--solo-copia`** copia y comprueba sin cargar.
- **`pruebas/prueba-ensayo-portal.sh` y `pruebas/sonda-ensayo-portal.rb`:** la prueba en Actions, con una «producción» simulada.
  - **Studio:** el fixture de la 0523, más `author_name`, un hilo de correo y el tenant T2.
  - **Chatwoot:** dos cuentas, otra bandeja con su contacto y su mensaje, teléfonos, correos, la URL del webhook y el `hmac_token`.
  - **Las comprobaciones:**
    - T1: el ensayo sale con 0;
    - T2: ninguna de las marcas prohibidas está en el volcado de las copias, y lo permitido sí está;
    - T3: la evidencia;
    - T4: lo de otros tenants y cuentas;
    - T5: la producción simulada no cambió;
    - T6: la minimización, que deja del espejo y de los eventos de Studio solo los del portal;
    - E-xx: lo que mide el modo completo sobre la copia, que es E1, E2, CA, B1, B2, C1 a C3 y K1 a K3, y además V10, V12 y V13, que son C-10, C-12 y C-13 sobre lo cargado;
    - G1 a G5: las guardas. G4 es `--limpiar` sin un ensayo, y G5 es `--limpiar` con Docker sin responder.
  - **Los mutantes:**
    - M0 es el control;
    - M1 a M13, M17, M21, M23, M24 y M26 mutan la lista: columnas personales, sintéticos, credenciales y filtros;
    - M14 a M16, M22 y M25 mutan las guardas;
    - M18 a M20 mutan el cargador, en el modo completo.
- **`.github/workflows/portal-historial-cargador.yml`:** el job `ensayo`, en su propio runner.

## Evidencia

- **PASÓ:** `bash -n` de los dos guiones.
- **PASÓ:** cada texto a mutar aparece una vez en su archivo, medido con un doble de `mutante`.
- **PASÓ:** las columnas de Chatwoot de la lista existen en el `db/schema.rb` de Chatwoot v4.19.1, la versión de la imagen fijada.
- **NO EJECUTADO en la PC:** Ruby y Docker. La prueba corre en Actions, y cada vuelta está en el registro de abajo.
- **El verde de la vuelta 8** (`2585e945f`): los runs 42555105883 (cargador y ensayo) y 42555105808 (calidad). La revisión del DG sobre esa cabeza dio APPROVED, sin bloqueantes.
- **Rojo previo:**
  - en la vuelta 1 no aplicaba, porque todo el código era nuevo: el control eran los mutantes;
  - las correcciones de la revisión tienen su rojo previo en la vuelta 7.

## Pendientes de esta tarea

- **La vuelta 10.** La revisión del DG del delta de la vuelta 9 (`2585e945f..aa03979a6`) dio CHANGES_REQUESTED, con B1, G5, N8, el `if:` del job `ensayo` y este handoff. Va primero el rojo previo (`c7d1f6f33`) y después el arreglo.
- **`revisar-datos-ve` sobre la PR:** hecho el 2026-11-08. El registro está en las notas del Subdirector, `0586-p4-2b-revisar-datos-ve.md`: 10 puntos CORRECTO, ninguno ENCONTRADO después de E1, y 3 NO VERIFICABLE que pasan al runbook.
- **Lo que pidió el DG de la #468 y la #470** se hizo en la vuelta 5, con el merge del tren 9: el encabezado de `:301` y el mutante M39 del `SHOW`, con su comprobación L4.
- **Las secciones de la #468 y la #470**, más abajo.
- **El runbook (E10):**
  - la lista de 3.0 tiene que sumar `copia-columnas.tsv`, `ensayo-studio-esquema.sql`, `ensayo-portal.sh` y la carpeta `migraciones/`, con las 10 migraciones que lista la guarda G0;
  - el comando de 3.1 queda así: `TENANT=… CUENTA=1 BANDEJA=… AGENTE_SERVICIO=… bash /srv/ops/portal-historial/ensayo-portal.sh`.

## La revisión independiente del DG sobre `a43b4267b` (CHANGES_REQUESTED) y lo que la atiende

1. **Bloqueante: C-10, C-12 y C-13 no se medían sobre la copia real.** Ahora `ensayo-portal.sh` los mide después de la primera carga:
   - V10: los contactos de la bandeja, sin teléfono ni correo, y 0 huérfanos;
   - V12: el orden de los mensajes de cada hilo, igual al del preparado;
   - V13: el estado de cada conversación, igual al del preparado.

   De la copia de Chatwoot salen solo ids, estados y `source_id`, y del cruce con el preparado (en tmpfs) salen solo conteos. Las comprobaciones son E-V10, E-V12 y E-V13, y los mutantes M18 a M20 mutan el cargador en el modo completo.
2. **`contact_inboxes.pubsub_token`,** que es una credencial, sale sintético (`md5(random())`). Lo prueban la marca SINTPUBSUB en T2 y el mutante M21.
3. **Minimización:** el espejo (`chatwoot_conversations`) y los eventos (`chatwoot_webhook_events`) de Studio se copian solo para los hilos de `chatwoot_portal_hilos`. Lo prueban T6, M23 y M24.
4. **`--limpiar`** borra `/dev/shm/portal-historial` solo si este ensayo corrió o quedó uno que limpiar (`HABIA_ENSAYO`). Lo prueban G4 y M22.
5. **`additional_attributes`:** con `case … ? 'dtd_hilo' … else '{}'`, ya no aparece un `dtd_hilo: null` donde no lo había.
6. **El caso (a)** se llama CA, para que no choque con A2 del aislamiento.
7. **La G0** exige `$CHATWOOT_DIR/correo/views`.
8. **Los nombres de producción en el guion:** P0 es la foto de antes, P0b el flag, P2 Studio después y P3 Chatwoot después. El runbook tiene que usar esos mismos nombres, no «P1 a P3».

**Lo que no bloquea, para la próxima (FUERA DE ALCANCE de esta vuelta):**
- **El swap de 2 GB del VPS frente a «nada pasa por el disco»:** el tmpfs puede ir a parar al swap.
- **`$EVIDENCIA.prod-antes`** se escribe un momento en disco. Lleva solo conteos y md5.
- **La guarda de `ENSAYO_VOLCADO`** compara por nombre, así que con el ID del contenedor se saltaría.
- **MEM0, CARGA y P0b** no tienen prueba.
- **Una foto por tabla** puede dejar huérfanos con actividad, porque los `COPY` son por separado.
- **T3** tiene una comprobación negativa débil, y D2 usa «>0».
- **Hecho en esta vuelta:** el `grep` con `\|` de T3 pasó a `-E`.

## La vuelta 9: lo no bloqueante de la segunda revisión del DG, sobre `2585e945f`

- **N2.** Si Docker no responde, el conteo de recursos da `?`. Ahora `--limpiar` no borra nada, ni siquiera `/dev/shm/portal-historial`, y sale con 6 (`docker_no_responde`). Lo prueban G5, con un `docker` falso al principio del `PATH`, y M25.
- **N1.** En M18, M19 y M20, E-E1 y E-E2 tienen que pasar.
- **N4.** La producción simulada suma una conversación del portal sin `dtd_hilo` y con `browser` marcado `SINT-SIN-HILO`. La copia la trae con `{}`, que es la rama `else`. Lo prueban T2, con 24 marcas, y M26.
  - C3 tenía un falso rojo con esa conversación, porque un `dtd_hilo` nulo no cuenta en `count(distinct …)`. Ahora cuenta solo las que tienen `dtd_hilo`.
- **N7.** Los `paths` del workflow suman `infra/chatwoot/correo/**`.
- **N8.** En `mutante`, un id mal escrito en `caen` o en `pasan` ya no cuenta como caído ni como pasado: sale como `(no existe)`.
- **N6.** Este handoff, al día.

## La vuelta 10: la revisión del DG del delta de la vuelta 9 (CHANGES_REQUESTED)

- **B1, una regresión de N2.** La guarda de Docker sin responder también corría con `CREADO=1`, así que un ensayo real que terminaba con Docker caído salía con 6 sin borrar `/dev/shm/portal-ensayo` ni `/dev/shm/portal-historial`. En la puerta 3, esas carpetas tienen datos de la copia de producción.
  - **Ahora:** el «ante la duda no se borra» vale solo para un `--limpiar` puro. Un ensayo que corrió borra sus dos carpetas igual, conserva su código (o queda en 4, porque la limpieza no se pudo comprobar) y anota `docker_no_responde=si`.
  - **La prueba:** G6 usa un `docker` que pasa al real hasta que existe el `compose.yml` del ensayo, y desde ahí falla. Lo acompaña el mutante M27.
- **G5** siembra su propio centinela.
- **N8** tiene su prueba: la comparación es la función `no_cumplen`, y se prueba sin Docker.
- **El job `ensayo`** no corre en borradores, como el cargador desde la SDD-0621.
- **El código 6** (`--limpiar` con Docker sin responder) tiene que figurar en el runbook, en 3.1. **Lo escribe E10.**

## Lo que se comprueba en la puerta 3, no en CI

- **TimeoutStopSec:** en Actions no hay unidad de systemd, así que la guarda G1 no corre ahí.
- **Los nombres reales de producción:** `dtd-cargo-db-1`, `chatwoot-postgres-1` y `/srv/chatwoot`.
- **Las 10 migraciones** en `/srv/ops/portal-historial/migraciones`, que exige la guarda G0 (`ensayo-portal.sh:215` a `:217`):
  - `0006_clients.sql`, `0106_conversaciones.sql`, `0337_feature_flags_seed_and_trigger.sql` y `0503_chatwoot_bandeja.sql`;
  - `0504_chatwoot_eventos.sql`, `0508_chatwoot_bajas_purga.sql`, `0519_chatwoot_portal.sql` y `0520_chatwoot_portal_vuelta.sql`;
  - `0523_chatwoot_portal_carga.sql` y `0524_chatwoot_portal_puerta4.sql`.
- **Fuera del ensayo:** la parte E del modo completo corre en CI, pero sin mutantes de `cargar.sh` ni de `vincular.sh` dentro del ensayo. Esos los cubren la prueba del cargador y la punta a punta.

## Registro de las vueltas en Actions (#473)

| Vuelta | SHA | Run (job del ensayo) | Resultado | Qué cambió después |
|---|---|---|---|---|
| 1 | `c86e2b03a` | 42535639790 (128899213367) | Rojo: 8 fallas en el ensayo. Se copió una sola tabla por lado. Pasaron las guardas G1 a G3, el aislamiento, la limpieza, T4, T5 y los mutantes de marcas M1 a M4, M6 a M10, M13 y los de las guardas, M14 a M16. Cayeron M0, M5, M11 y M12 | Los `docker exec -i` de `copiar_tabla` leían la entrada estándar y se comían el resto de la lista. Ahora el bucle lee por el descriptor 3 |
| 2 | `530e06386` | 42537233286 (128904191711) | Rojo: solo K3. Todo lo demás pasó: T1 a T5 salvo por K3, M0 a M16 cayendo cada uno en lo suyo, D2 con 16 tablas de Studio y 10 de Chatwoot, O1 en 0, y E1, E2, A2, B1, B2, C1 a C3, K1 y K2. Los datos de C-8 estaban bien (4 hilos y 4 espejos) | `c8` leía `$2` y no `$1`: no encontraba la clave. Lo corregí y lo comprobé con las líneas del run |
| 3 | `903e939a1` | 42538856924 (128909177961) | Verde: P1, T1 a T5, las once E-xx del modo completo, G1 a G3 y M0 a M16 cayendo cada uno en lo suyo. El cargador también pasó | El Subdirector no vio los pasos de la carga en el log: en `pruebas/prueba-ensayo-portal.sh:205`, las líneas del ensayo iban solo a resumen.txt (`>/dev/null`). Las saqué al log también cuando pasa. La cobertura no cambia |
| 4 | `d84c9140f` | sin leer: lo reemplazó la vuelta 5 | — | El tren 9 (`e74cde6fc`) entró a main con la #468 y la #470 |
| 5 | (el merge) | — | — | Un solo merge de `e74cde6fc`, sin conflictos (el workflow se mezcló solo). En el mismo commit: se quita el encabezado vencido «B. el contacto_id nulo: espera la 0524» de `pruebas/prueba-punta-a-punta.sh`, y se suman L4 y el mutante M39, que quita la comparación del `SHOW` en `cargar-portal.rb:186`. L4 hace que el `SHOW` de `log_*` devuelva otro valor dentro de la sonda, así que solo la comparación lo ve. Rojo previo de M39: no se puede tener sin romper el cargador, que ya está en main; el rojo es el del propio mutante |
| 6 | `a43b4267b` | 42549137387 (el cargador y el ensayo) y 42549137368 (la calidad) | Verde entero: T2 con 22 marcas y M17 cayendo en T2 (38 PASÓ en el ensayo). La revisión independiente del DG dio CHANGES_REQUESTED | Las vueltas 7 y 8 |
| 7 | `d31737045` | 42553336609 (job 128953531107) | El rojo previo esperado: T2 (la fuga de SINTPUBSUB), T6 (2 filas de espejo y 2 de eventos), E-CA, E-V10, E-V12, E-V13 y G4. M17 y M21 a M24 no se pudieron aplicar. M0 cayó en T2 y T6, y M18 a M20 cayeron además en T2, por el pubsub | Solo las pruebas de la revisión |
| 8 | `2585e945f` | 42555105883 (cargador y ensayo) y 42555105808 (calidad) | Verde entero. T2 revisó 23 marcas; pasaron T6, E-CA, E-V10, E-V12, E-V13 y G4; M17 y M20 a M24 cayeron cada uno en lo suyo, y M39 en L4. La revisión del DG dio APPROVED | La vuelta 9: las correcciones no bloqueantes |
| 9 | `aa03979a6` | 42588214175 (cargador y ensayo) y 42588213978 (calidad) | Verde entero. La revisión del DG del delta dio CHANGES_REQUESTED: B1, una regresión de N2 | La vuelta 10 |
| 10 | `d3541ef57`, el merge de main `49f15594d`, y `c7d1f6f33`, las pruebas (el rojo previo) | (pendiente) | Rojo previo esperado: G6 y M27 (sin aplicar) | El arreglo de B1 |
| 11 | (el arreglo de B1) | — | — | — |
| 6, el detalle | — | — | — | La vuelta 5 dio verde en el cargador y en el ensayo (run 42546753563). `revisar-datos-ve` sobre la #473 encontró E1, de gravedad baja: `conversations.additional_attributes` se copiaba entero. Ahora se copia solo `jsonb_build_object('dtd_hilo', …)` (`copia-columnas.tsv:45`). La producción simulada suma una conversación del portal con `browser` marcado `SINT-NAVEGADOR`, y el mutante M17 vuelve a copiar el jsonb entero y tiene que caer en T2 |

## #468 · El caso (b) de la punta a punta

- **Rojo previo**, sobre `f1d56c140`: el run 42528572344.
  - Cayeron solo B1 y B2, por `chatwoot_portal_contactos_chatwoot_source_id_check`, la restricción vieja, porque al fixture le faltaba la 0524.
  - A1, A2 y el cargador pasaron.
- **Verde**, sobre `26d02b49e`: el run 42531228893.
  - B1 pasó con «id de contacto inválido» y B2 con «falta el source_id del contacto».
  - La calidad también pasó.
- **Aprobada por el DG sin condiciones.** Va en el tren 8.

## #470 · La prevención del log de Postgres (4.10)

- **Rojo previo**, sobre `ac62bd8f2`: el job 128886080046.
  - L1, el control, pasó.
  - L2 cayó porque la marca SINT-LOG salió 3 veces. L3 cayó por el permiso del insert.
  - M0 cayó por L2 y L3.
  - M35 a M38 no se pudieron aplicar.
- **Verde**, sobre `9e82aa7bb`: los runs 42533753896 (cargador, job 128893410271) y 42533753860 (calidad).
  - L1, L2 y L3 pasaron: la marca sale 0 veces.
  - M0 pasó.
  - M35 a M38 cayeron cada uno en lo suyo.
- **Aprobada por el DG con la condición** de que L1 a L3 y M35 a M38 pasaran, y la cumple: lo verificó el Subdirector. Va en el tren 8 con la #468.

## FUERA DE ALCANCE DETECTADO

- **El esquema de Studio está dos veces:** en `ensayo-studio-esquema.sql` y en `pruebas/studio-fixture.sql`. Unificarlo, para que el fixture haga `\i` del esquema, toca el archivo de la #468, así que va después del tren 8.
- **`IMAGEN_STUDIO` (`postgres:17`) no está fijada por digest.** La evidencia anota el digest que corrió. Fijarla es una decisión del DG.
- **El criterio de la 0590** (DG, 2026-11-08): los próximos ensayos copian de producción en forma mínima, por columnas, y nunca con un `pg_dump` entero. El ensayo 5.6 del Archivo Kommo usó `pg_dump` entero. Ya se corrió y no queda ninguna copia viva.
