# Handoff · SDD-0586 10.7, PR 2c: la vuelta atrás dirigida de la carga P4 en Chatwoot

- **Worker:** E5, bajo el Subdirector Chatwoot.
- **Rama:** `codex/0586-deshacer-carga`, desde main `e74cde6fc` (el tren 9).
- **Estado:** en borrador. La revisión independiente del DG sobre `78231bed3` dio CHANGES_REQUESTED, y la vuelta 3 la atiende. No se fusiona desde aquí: la fusiona el DG.
- **Cuándo se usa:** antes de la puerta 4 tiene que estar en main y ensayada. En producción, el borrado lo corre Sam.

## Qué trae

- **`infra/ops/portal-historial/deshacer-carga.rb`.** Es el hermano de `cargar-portal.rb`: corre con `rails runner` en el contenedor de Chatwoot.
  - **`MODO=seco`:** cuenta lo que borraría y escribe `contactos-conservados.ndjson`. Lleva solo ids y usa el formato de E10, con `TENANT` en la cabecera. No borra nada.
  - **`MODO=borrar CONFIRMAR=no|si`:** lee el archivo por la entrada estándar y recalcula los conservados. Si no son los del archivo, aborta. Borra con `delete_all` los mensajes, las conversaciones y los contact_inboxes de la bandeja, y los contactos `dtd-portal:` que no se conservan.
    - `CONFIRMAR=no` termina en ROLLBACK: es el ensayo del DG.
    - `CONFIRMAR=si` confirma.
  - **Aborta** cuando:
    - la bandeja no es la del portal;
    - hay algo ajeno: un mensaje con `source_id` nulo o que no es `dtd:%`, una conversación sin `dtd_hilo`, un contact_inbox sin `dtd-portal:`, una conversación asignada o en snoozed, o actividad que la carga no crea (adjuntos, menciones, participantes, eventos de reportes o notificaciones);
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
- **NO EJECUTADO en la PC:** Ruby y Docker. La prueba corre en Actions, y el run todavía está pendiente.

## Registro de las vueltas en Actions (#478)

| Vuelta | SHA | Run (job) | Resultado | Qué cambió después |
|---|---|---|---|---|
| 1 | `65402ca0c` | job 128935328323 | La corrida real salió verde: P1, D1a, D1b, D6a, D6b, D2 a D5 y F1. De los mutantes, MD0, MD1, MD2 y MD5 pasaron. MD3, MD4 y MD6 a MD9 cayeron además en D2, y MD3 también en D4 | El error era de la prueba, no del guion: `CONSERVADO` estaba fijo desde la primera corrida, y después de que MD3 borra ese contacto, la recarga crea otro con otro id. Ahora cada escenario lee su propio conservado (`otra-bandeja.txt`). MD3 ya no exige D4, que cae en cascada después de D3 |
| 2 | `78231bed3` | 42550597299 (el cargador y el deshacer) y 42550597297 (la calidad) | Verde entero: D1a, D1b, D2 a D6b y F1, y MD0 a MD9 cayendo cada uno en lo suyo. La revisión del DG dio CHANGES_REQUESTED | La vuelta 3 |
| 3 | `1fcc54216` y `26892869b` (las pruebas, para el rojo previo) | 42588248456 (el job deshacer es el 129063191391) | El rojo previo que se esperaba, con 43 fallas: D6c a D6g, D6i, D8, D10, D1f, D1g, D2b y D11a a D14 cayeron; los mutantes de los textos nuevos no se pudieron aplicar. Además, los mutantes de lo ajeno corrían sobre la bandeja vacía, porque no recargaban. El job del cargador cayó en E1 de la punta a punta, con «-1 reintentos», que es ajeno a la 2c | Recargar antes de los mutantes de lo ajeno. Después, la implementación |
| 4 | `7c4e0410b`, `6d20c2555`, `a059725d6` y el arreglo de la recarga | (pendiente) | — | La revisión del DG, la secuencia de 4.6b y la copia durable (ver abajo) |

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
- **N5, la secuencia de 4.6b que aprobó el DG.** Los cinco pasos y sus `.hecho` están en «El orden» más abajo, con lo que prueban D2b, D11a a D11c, D12 y D13 y MD22 a MD26.
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

## El orden del sub-paso 4.6b (runbook, de E10)

1. **`deshacer.sh` con `MODO=seco`.** Lo corre el DG. Escribe el `.ndjson` y `chatwoot-seco.hecho`.
   - (1b, opcional) `MODO=borrar CONFIRMAR=no`, el ensayo suelto del DG. No exige ni escribe `.hecho`.
2. **El ensayo de Studio de E10** (`deshacer-vinculos.sh MODO=ensayo`). Lo corre el DG. Escribe `studio-ensayo.hecho`.
3. **`deshacer.sh` con `MODO=borrar CONFIRMAR=si`. Lo corre Sam.**
   - Exige los dos `.hecho`, con el mismo sha256 y el mismo tenant.
   - Deja la copia durable, borra y escribe `chatwoot-borrar.hecho`.
4. **Studio con `MODO=aplicar`** (E10). Lo corre Sam.
5. **`limpiar.sh --cierre-4-6b`** (E10). Lo corre Sam.

**El disco (decisión del DG):** nada antes del paso 3 toca el disco. El paso 3 crea la copia durable con el `.ndjson`, `chatwoot-seco.hecho` y `studio-ensayo.hecho` antes de borrar, y le suma `chatwoot-borrar.hecho` solo después del COMMIT. Si aborta antes del COMMIT, la copia durable queda sin ese archivo; lo prueban D15 y MD30, y esa copia la borra `limpiar.sh --abandono-4-6b` (E10, #480). El paso 4 suma `studio-aplicar.hecho`. `chatwoot_portal` no se enciende hasta que el paso 4 salga con 0. **El plazo (regla del DG):** si el paso 4 no corre en 24 h desde el `utc=` de `chatwoot-borrar.hecho`, el DG le avisa a Sam, y la copia durable nunca se borra sin que el 4 haya salido con 0. **La copia durable y los respaldos:** los respaldos programados del VPS no incluyen `/srv/ops/portal-historial/` (lo midió el DG), pero el Auto Backup de Contabo está activado, así que la copia queda también ahí hasta que caduque. Es un riesgo que ya existía, sin aumento material, porque la copia lleva solo ids seudónimos. La retención es NO VERIFICABLE. El detalle está en las notas del Subdirector, en `0586-p4-2c-orden-4-6b.md`.

## Pendientes de esta tarea

- El run de la vuelta 3: primero el rojo previo de las pruebas, después la implementación.
- **Para el runbook (E10):**
  - los comandos de 4.6b;
  - la lista de 3.0 suma `deshacer.sh` y `deshacer-carga.rb`.

## FUERA DE ALCANCE DETECTADO

- **El arranque de los dos stacks está tres veces:** en `prueba-deshacer.sh`, en `prueba-punta-a-punta.sh` y en `prueba-ensayo-portal.sh`. Se puede llevar a una función compartida cuando entren la 2b y la 2c.
- **El workflow choca con la 2b:** la 2b y la 2c agregan cada una un job al final de `portal-historial-cargador.yml`. La que entre segunda tiene que traer main.
- **La caché de la cuenta en Chatwoot (inferencia, no medida):** `delete_all` no corre callbacks, así que la caché puede mostrar conteos viejos hasta que venza.
- **Una carrera que no tiene mutante:** el `FOR UPDATE` de N4 no tiene prueba, porque provocarla en CI sería frágil.
