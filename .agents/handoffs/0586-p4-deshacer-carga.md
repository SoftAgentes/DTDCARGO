# Handoff · SDD-0586 10.7, PR 2c: la vuelta atrás dirigida de la carga P4 en Chatwoot

- **Worker:** E5, bajo el Subdirector Chatwoot.
- **Rama:** `codex/0586-deshacer-carga`, desde main `e74cde6fc` (el tren 9).
- **Estado:** lista para revisión, no en borrador. La revisión del DG sobre `b2508e726` (verde entero) pidió cambios: un bloqueante (B1, el entorno y la huella del paso 3) y cinco no bloqueantes, que atiende la vuelta de abajo. No se fusiona desde aquí: la fusiona el DG.
- **Cuándo se usa:** antes de la puerta 4 tiene que estar en main y ensayada. En producción, el borrado lo corre Sam.

## Qué trae

- **`infra/ops/portal-historial/deshacer-carga.rb`.** Es el hermano de `cargar-portal.rb`: corre con `rails runner` en el contenedor de Chatwoot.
  - **`MODO=seco`:** cuenta lo que borraría y escribe `contactos-conservados.ndjson`. Lleva solo ids y usa el formato de E10, con `TENANT` en la cabecera. No borra nada.
  - **`MODO=borrar CONFIRMAR=no|si`:** lee el archivo por la entrada estándar y recalcula los conservados. Si no son los del archivo, aborta. Borra con `delete_all` los mensajes, las conversaciones y los contact_inboxes de la bandeja, y los contactos `dtd-portal:` que no se conservan.
    - `CONFIRMAR=no` termina en ROLLBACK: es el ensayo del DG.
    - `CONFIRMAR=si` confirma.
  - **Aborta** cuando:
    - la bandeja no es la del portal;
    - hay algo ajeno: un mensaje con `source_id` nulo o que no es `dtd:%`, una conversación sin `dtd_hilo`, un contact_inbox sin `dtd-portal:`, una conversación asignada o en snoozed, un contacto con teléfono o correo, o actividad que la carga no crea (adjuntos, menciones, participantes, eventos de reportes, encuestas, notificaciones, etiquetas, notas y adjuntos de contacto; `deshacer-carga.rb:24-28`);
    - un contacto no es `dtd-portal:<uuid>`;
    - el archivo es de otro tenant, de otra cuenta o de otra bandeja.
  - **Como el cargador,** toma el mismo candado y baja el detalle del log de Postgres.
- **`infra/ops/portal-historial/deshacer.sh`.** Es el hermano de `cargar.sh`.
  - **El flag:** antes de tocar Chatwoot, mira en Studio, en solo lectura, que `chatwoot_portal` no esté encendido ni se haya encendido alguna vez (`feature_flags` y `entity_audit_log`, la misma guarda que el desarme de E10). Si no lo puede comprobar, no corre.
  - **El archivo de conservados:** con `docker exec … cat` lo trae a un `.parcial`, comprueba la cabecera y que no haya barras invertidas, lo deja en 0600 y en el borrado lo pasa por la entrada estándar.
  - **El trap** limpia el contenedor y lo comprueba, y sale con 4 si no quedó limpio.
- **`pruebas/prueba-deshacer.sh` y `pruebas/sonda-deshacer.rb`.** Es la prueba en Actions, en su propio job (`deshacer`).
  - **La base:** Studio con el fixture de la 0523 y un Chatwoot efímero con rails y sidekiq. La carga es la real: extraer, cargar y vincular.
  - **Las comprobaciones:**
    - D1a y D1b: algo ajeno;
    - D6a y D6b: el flag, encendido ahora y alguna vez;
    - D2: el seco;
    - D3: la lista cambió;
    - D4: `CONFIRMAR=no`;
    - D5: `CONFIRMAR=si`;
    - F1: sin nombres ni textos.
  - **Los mutantes:** MD0 es el control y MD1 a MD9 mutan las guardas, los filtros y los modos.

## Evidencia

- **PASÓ:** `bash -n` de los dos guiones.
- **PASÓ:** cada texto que cambian los mutantes aparece una sola vez en su archivo.
- **NO EJECUTADO en la PC:** Ruby y Docker. La prueba corre en Actions; los runs están en la tabla de abajo.

## Registro de las vueltas en Actions (#478)

| Vuelta | SHA | Run (job) | Resultado | Qué cambió después |
|---|---|---|---|---|
| 1 | `65402ca0c` | job 128935328323 | La corrida real salió verde: P1, D1a, D1b, D6a, D6b, D2 a D5 y F1. De los mutantes, MD0, MD1, MD2 y MD5 pasaron. MD3, MD4 y MD6 a MD9 cayeron además en D2, y MD3 también en D4 | El error era de la prueba, no del guion: `CONSERVADO` estaba fijo desde la primera corrida, y después de que MD3 borra ese contacto, la recarga crea otro con otro id. Ahora cada escenario lee su propio conservado (`otra-bandeja.txt`). MD3 ya no exige D4, que cae en cascada después de D3 |
| 2 | `78231bed3` | 42550597299 (el cargador y el deshacer) y 42550597297 (la calidad) | Verde entero: D1a, D1b, D2 a D6b y F1, y MD0 a MD9 cayendo cada uno en lo suyo. La revisión del DG dio CHANGES_REQUESTED | La vuelta 3 |
| 3 | `1fcc54216` y `26892869b` (las pruebas, para el rojo previo) | 42588248456 (el job deshacer es el 129063191391) | El rojo previo que se esperaba, con 43 fallas: D6c a D6g, D6i, D8, D10, D1f, D1g, D2b y D11a a D14 cayeron; los mutantes de los textos nuevos no se pudieron aplicar. Además, los mutantes de lo ajeno corrían sobre la bandeja vacía, porque no recargaban. El job del cargador cayó en E1 de la punta a punta, con «-1 reintentos», que es ajeno a la 2c | Recargar antes de los mutantes de lo ajeno. Después, la implementación |
| 4 a 6 | de `7c4e0410b` a `25843e6b8` | 42603611740, 42618396536 y 42618396542 | La parte b cayó por arrastre de la prueba (D5 por otro camino en MD25, MD26, MD27 y MD30) | La limpieza de tmpfs antes de D15 y D5, y MD27 con la carpeta sin los archivos |
| 7 | `38e76b761` y `e4fd689e2` | 42628321142 (el cargador y las partes a, b y c) y 42628320972 (la calidad) | Verde entero. La parte b tardó 54 de 60 min | El merge de main `b5669b1a5` y el reparto de MD27, MD28 y MD30 a la parte a |
| 8 | `7c5121132`, `7b001a601` y `b2508e726` | 42637555397 (el cargador, el ensayo y las partes a, b y c) y 42637555182 (la calidad) | Verde entero: a 35,7 min, b 45,5, c 43,7. La revisión del DG pidió cambios (B1 y N1 a N5) | La vuelta 9 |

## La revisión del DG sobre `78231bed3` (CHANGES_REQUESTED) y lo que la atiende

- **B1, la guarda de `deshacer.sh`.** Mira en Studio, en solo lectura:
  - que exista la fila de `chatwoot_portal` del tenant;
  - el flag encendido ahora o alguna vez;
  - que la cola no haya corrido (ninguna salida que no esté `cargado`; también vale «enviado», D6i);
  - que el tenant tenga hilos vinculados;
  - que el espejo de cada hilo tenga `inbox_id = BANDEJA`.

  `DB` no tiene valor por defecto. Lo prueban D6a a D6i y D8, con MD8 a MD14 y MD29.
- **B2, `revisar-datos-ve`.** El registro está en las notas del Subdirector, `0586-p4-2c-revisar-datos-ve.md`. Su paso 3 es D7, que busca las marcas de lo borrado en toda la base de Chatwoot.
- **N1, lo ajeno.** Suma notas, etiquetas, encuestas, adjuntos de contacto y contactos con teléfono o correo. Lo prueban D1a a D1g, con MD1, MD2 y MD15 a MD19.
- **N4.** Las conversaciones de la bandeja se toman `FOR UPDATE` antes de mirar lo ajeno.
- **N5, la secuencia de 4.6b que aprobó el DG.** Los cinco pasos y sus `.hecho` están en «El orden» más abajo, con lo que prueban D2b, D11a a D11c y D13 y MD22, MD24, MD25 y MD26 (D12 y MD23 se fueron; ver más abajo).
- **N6.** `Integer(x, 10)`, y el shell rechaza los ceros a la izquierda. Lo prueban D10 y MD20.
- **N7.** Los errores propios son `DeshacerError`; de los demás, solo se imprime la clase.
- **N8.** Lo de la caché de la cuenta queda como inferencia (FUERA DE ALCANCE).
- **N2 y la copia durable, la (a) de Sam («si protegidos»).** Va en `/srv/ops/portal-historial/deshacer/`, root 0700 y archivos 0600, comparados con los de tmpfs. Lo prueban D14, MD27 y MD28. El `.ndjson` y los `.hecho` los borra el paso 5, `limpiar.sh --cierre-4-6b`, de E10.

## B1 de la revisión del DG de la #480: el `.inicio` del paso 3

- **El defecto:** el abandono de E10 borraba la durable si faltaba `chatwoot-borrar.hecho`, pero ese archivo podía faltar aunque Chatwoot ya hubiera confirmado. Pasaba por dos caminos:
  - un corte entre el COMMIT y el `.hecho`;
  - un segundo `MODO=borrar`, que al empezar borraba el `.hecho`.
- **El arreglo:**
  - **el `.inicio`:** el paso 3 escribe `chatwoot-borrar.inicio` en la durable antes de la transacción, con su línea `INICIO …` (el formato está en `0586-p4-2c-orden-4-6b.md`). Se retira solo si el `.rb` dice `fin=rollback`, un ROLLBACK comprobado;
  - **el `.rb` dice si confirmó** (`HECHO fin=commit|rollback`), también cuando falla después del COMMIT;
  - **la evidencia anterior nunca se borra:** con un `.hecho` o un `.inicio` sin cerrar, otro `MODO=borrar` se niega (`ya_hay_un_borrado_en_la_copia_durable`), aunque sea `CONFIRMAR=no`;
  - **`DESHACER_DURABLE`** vale solo con `DESHACER_PRUEBA=1`, como en E10.
- **Las pruebas:**

  | Caso | Qué prueba | Mutante |
  |---|---|---|
  | D16 | el corte: la escritura del `.hecho` falla después del COMMIT | MD31 |
  | D17b | otro `MODO=borrar` después del corte | MD31 |
  | D17 | otro `MODO=borrar` después del borrado | MD32 |
  | D15 | el `.inicio` se retira con un ROLLBACK comprobado | MD33 |

  D12 y MD23 se fueron, porque el `.hecho` viejo ya no se borra.
- **El job:** la prueba corre en tres partes, porque la parte a ya tardaba 59 min:
  - a: la corrida real, el control y las guardas;
  - b: el borrado;
  - c: lo ajeno y el corte.

  En e4fd689e2 (run 42628321142), la parte b tardó 54 de 60 min, la a 28 y la c 42. Por eso MD27, MD28 y MD30, de
  unos 4 min cada uno, pasaron de la b a la a. Los casos y los mutantes no cambian, y no hay job nuevo.

## La revisión del DG sobre `b2508e726` (vuelta 9)

- **B1, el paso 3 con un ensayo de copia y sin huella.** `deshacer.sh` no leía `entorno=` de `studio-ensayo.hecho`, así que un ensayo sobre una copia habilitaba borrar Chatwoot de producción, y después el paso 4 de la #480 se negaba: el estado partido. El arreglo, en el paso 3 y antes de escribir nada:
  - el ensayo de Studio tiene que decir `entorno=produccion` (D18, MD34);
  - **la huella SISTEMA de Studio, igual que la #480:**
    - el archivo de root `/srv/ops/portal-historial/sistema-produccion`, en 0600 y de uid 0, con solo cifras y a lo sumo un salto (D19a a D19d, MD35 a MD38);
    - su sha corto, con la fórmula del DG (printf), igual a `b4fbe1b236` (D19e, MD39), y la línea impresa con printf y no con echo (D19f, MD42);
    - la base de Studio misma: `pg_control_system()` tiene que dar ese valor, que entra a psql por la entrada estándar (`\set`) (D19f, MD40);
    - `SISTEMA` en el entorno se rechaza (D19g, MD41).
  - **En la prueba:** con `DESHACER_PRUEBA=1` el archivo, el sha esperado y el uid son los de la prueba. El valor es el `system_identifier` del Postgres efímero de Studio, porque la guarda lo compara con la base de verdad. El valor de mentira de la #480 (sha corto `deb576f0d6`) es «otra base» en D19f.
  - **Los casos que fijaban el defecto se invirtieron:** los ensayos de Studio de la prueba (D11, D15, D5 y el corte) ahora dicen `entorno=produccion`, y D5 exige además el sha corto esperado, `studio_es_produccion=si` y que el valor no se imprima.
  - **Los casos de la huella son livianos:** no necesitan la carga, porque arman un `.ndjson` de mentira cuya cabecera no cuadra. Si un mutante deja pasar una guarda, el `.rb` aborta sin borrar y el caso cae, porque se creó la durable.
- **N4:** `DB_CW` ya no tiene valor por defecto, igual que `DB` (D6j, MD43).
- **N5:** este handoff al día, y la spec 0586 ya no dice «‹por confirmar›» sobre el formato de los conservados.
- **El reparto de los mutantes nuevos:** MD34 a MD38 y MD43 van en la parte a, y MD39 a MD42 en la c. La b no cambia.

## El orden del sub-paso 4.6b (runbook, de E10)

1. **`deshacer.sh` con `MODO=seco`.** Lo corre el DG. Escribe el `.ndjson` y `chatwoot-seco.hecho`.
   - (1b, opcional) `MODO=borrar CONFIRMAR=no`, el ensayo suelto del DG. No exige ni escribe `.hecho`.
2. **El ensayo de Studio de E10** (`deshacer-vinculos.sh MODO=ensayo`). Lo corre el DG. Escribe `studio-ensayo.hecho`.
3. **`deshacer.sh` con `MODO=borrar CONFIRMAR=si`. Lo corre Sam.**
   - Exige los dos `.hecho`, con el mismo sha256 y el mismo tenant, el ensayo de Studio con `entorno=produccion`, y la huella SISTEMA de Studio (B1 de la vuelta 9).
   - Deja la copia durable, borra y escribe `chatwoot-borrar.hecho`.
4. **Studio con `MODO=aplicar`** (E10). Lo corre Sam.
5. **`limpiar.sh --cierre-4-6b`** (E10). Lo corre Sam.

**El disco (decisión del DG):** nada antes del paso 3 toca el disco. El paso 3 crea la copia durable con el `.ndjson`, `chatwoot-seco.hecho` y `studio-ensayo.hecho` antes de borrar, y le suma `chatwoot-borrar.hecho` solo después del COMMIT. Si aborta antes del COMMIT, la copia durable queda sin ese archivo; lo prueban D15 y MD30, y esa copia la borra `limpiar.sh --abandono-4-6b` (E10, #480). El paso 4 suma `studio-aplicar.hecho`. `chatwoot_portal` no se enciende hasta que el paso 4 salga con 0. **El plazo (regla del DG):** si el paso 4 no corre en 24 h desde el `utc=` de `chatwoot-borrar.hecho`, el DG le avisa a Sam, y la copia durable nunca se borra sin que el 4 haya salido con 0. **La copia durable y los respaldos:** los respaldos programados del VPS no incluyen `/srv/ops/portal-historial/` (lo midió el DG), pero el Auto Backup de Contabo está activado, así que la copia queda también ahí hasta que caduque. Es un riesgo que ya existía, sin aumento material, porque la copia lleva solo ids seudónimos. La retención es NO VERIFICABLE. El detalle está en las notas del Subdirector, en `0586-p4-2c-orden-4-6b.md`.

## Pendientes de esta tarea

- **Al cierre del 2026-11-09 (todo parado hasta el sábado 2026-11-14, por orden del DG):**
  - la cabeza publicada es `e64bfef6533e504d5543016ab109059f115d5262` (la vuelta 9 y main `27fac70db`);
  - **el CI de `e64bfef65` terminó: un rojo, de la prueba y no del guion.**
    - El cargador, run 42655332802: **failure**, solo por la parte a (job 129292212612, 47,0 min). La parte b (35,4 min), la c (42,6 min), el cargador (26,0 min) y el ensayo (16,7 min) dieron success.
    - La calidad, run 42655332606 (job 129292211072): success, 49,0 min.
    - **La causa:** la parte a tuvo una sola falla, MD38: «tienen que caer [D19d] — SOBREVIVEN: D19d(sistema) · cayeron: D19D». En `comprobar_sistema`, el id del caso se arma con `tr d D`, que cambia todas las «d», así que d19d queda como «D19D». El mutante sí tumbó su caso, pero bajo otro nombre, y la comparación no lo encuentra. Los demás casos y mutantes, la corrida real incluida, pasaron.
    - **El arreglo, sin empezar:** armar el id con `"D${c#d}"` en vez de `tr d D`. Es solo de la prueba.
  - **Cabeza de cierre en draft;** el verde que cuenta es el de `e64bfef65`, con el rojo de MD38 y su causa de arriba. Al volver: el arreglo de MD38, ready y CI sobre la cabeza nueva. Después, la revisión del DG;
  - **la #489:** el handoff con N-a a N-d está en el commit local `f73c83cc5` de `codex/0586-ensayo-portal-nb`, sin subir. No va encima de la cabeza APPROVED mientras siga abierto el tren #494. Se sube al volver;
  - **el DG aceptó la desviación de la prueba:** el sha esperado es el del `system_identifier` del Postgres efímero, no `deb576f0d6` fijo. `DESHACER_SISTEMA_SHA` (como `DESHACER_SISTEMA` y `DESHACER_SISTEMA_UID`) se ignora fuera de `DESHACER_PRUEBA=1` (`deshacer.sh:115-119`);
  - N1 a N3 siguen en «Pendiente posterior», abajo.
- **Para el runbook (E10):**
  - los comandos de 4.6b;
  - la lista de 3.0 suma `deshacer.sh` y `deshacer-carga.rb`;
  - el paso 3 exige el archivo de SISTEMA del sub-paso 3.0, el mismo que usa el paso 4 de la #480.

### Pendiente posterior (no bloqueante de la revisión del DG sobre `b2508e726`)

No caben en esta vuelta sin inflar el CI o sin cambiar el `.rb` más allá de B1:
- **N1, los pisos en Chatwoot:** comparar `borrados_*` con los conteos de antes y las conversaciones con los hilos de Studio, y guardar esos conteos en `chatwoot-seco.hecho` (`deshacer.sh`, el `escribir_hecho` del seco).
- **N2, las guardas sin mutante:**
  - en `deshacer-carga.rb`: `:121-127` (la bandeja; D8 no llega), `:177`, `:181`, `:258-259`, `:230-231`, `:111-119`, 9 de las 10 tablas de actividad (`:51-65`) y `:213-220`;
  - en `deshacer.sh`: las líneas que citó el DG sobre `b2508e726` (`:177`, `:179`, `:185`, `:110/:232`, `:112`, `:72/:79-84` y `:201`). Las de `:179-185` ganaron caso y mutante con B1, en lo que toca al entorno y a la huella.

  Cada mutante del `.rb` necesita la carga (unos 4 min), así que suman más de una parte entera.
- **N3, la carrera:** el `FOR UPDATE` (`deshacer-carga.rb:235`) no impide que entre una conversación nueva entre la mirada a lo ajeno y el `delete_all`. La detectaría N1.

## FUERA DE ALCANCE DETECTADO

- **El arranque de los dos stacks está tres veces:** en `prueba-deshacer.sh`, en `prueba-punta-a-punta.sh` y en `prueba-ensayo-portal.sh`. Se puede llevar a una función compartida cuando entren la 2b y la 2c.
- **El workflow choca con la 2b:** la 2b y la 2c agregan cada una un job al final de `portal-historial-cargador.yml`. La que entre segunda tiene que traer main.
- **La caché de la cuenta en Chatwoot (inferencia, no medida):** `delete_all` no corre callbacks, así que la caché puede mostrar conteos viejos hasta que venza.
- **Una carrera que no tiene mutante:** el `FOR UPDATE` de N4 no tiene prueba, porque provocarla en CI sería frágil. El DG la volvió a marcar sobre `b2508e726` (N3): va en «Pendiente posterior».
