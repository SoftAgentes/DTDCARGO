# Handoff · SDD-0586 10.7, PR 2b: el ensayo de la carga P4 en copias (`ensayo-portal.sh`)

- **Worker:** E5, bajo el Subdirector Chatwoot.
- **Rama:** `codex/0586-ensayo-portal`, que sale de main `04a295e1d`.
- **Estado:** en curso. La PR va en borrador. Ya trae main `e74cde6fc` (el tren 9, con la #468 y la #470).
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
    - G1 a G3: las guardas.
  - **Los mutantes:** M0 es el control. M1 a M13 mutan la lista: columnas personales, sintéticos y filtros. M14 a M16 mutan las guardas.
- **`.github/workflows/portal-historial-cargador.yml`:** el job `ensayo`, en su propio runner.

## Evidencia

- **PASÓ:** `bash -n` de los dos guiones.
- **PASÓ:** cada texto a mutar aparece una vez en su archivo, medido con un doble de `mutante`.
- **PASÓ:** las columnas de Chatwoot de la lista existen en el `db/schema.rb` de Chatwoot v4.19.1, la versión de la imagen fijada.
- **NO EJECUTADO en la PC:** Ruby y Docker. La prueba corre en Actions. Pendiente: el run, y el rojo o verde de cada mutante.
- **Rojo previo:** no aplica en el sentido de la #468 y la #470, porque todo el código es nuevo. El control son los mutantes.

## Pendientes de esta tarea

- **El primer run de Actions.** Puede pedir ajustes del esquema de Chatwoot en la copia, como columnas NOT NULL de la imagen o secuencias.
- **`revisar-datos-ve` sobre la PR.** La copia lleva `clients.name` y `conversation_messages.body`, que son los datos que la carga necesita.
- **Lo que pidió el DG de la #468 y la #470** se hizo en la vuelta 5, con el merge del tren 9: el encabezado de `:301` y el mutante M39 del `SHOW`, con su comprobación L4.
- **Las secciones de la #468 y la #470**, más abajo.
- **El runbook (E10):**
  - la lista de 3.0 tiene que sumar `copia-columnas.tsv`, `ensayo-studio-esquema.sql`, `ensayo-portal.sh` y la carpeta `migraciones/`, con las 10 migraciones que lista la guarda G0;
  - el comando de 3.1 queda así: `TENANT=… CUENTA=1 BANDEJA=… AGENTE_SERVICIO=… bash /srv/ops/portal-historial/ensayo-portal.sh`.

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
