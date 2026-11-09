# supabase/cargas/portal-historial-deshacer: deshacer en Studio la carga P4 del chat del portal

SDD-0586 10.7, el sub-paso 4.6b del runbook [`docs/runbooks/chatwoot-portal-p4-puertas.md`](../../../docs/runbooks/chatwoot-portal-p4-puertas.md). El diseño está en la spec 0586, §10.5.10, «10.7 · Deshacer la carga en Studio».

**No es una migración y no entra al ledger.** Borra filas de una carga, no cambia esquema. Está en `supabase/cargas/` para que su contrato, `supabase/tests/deshacer_vinculos_portal.test.sql`, lo corra el CI con Postgres 17 (Contratos SQL monta solo `supabase/`). Sigue el mismo patrón que `crm-kommo/`: una función en `pg_temp` que muere con la sesión, y un `.sh` que decide si la transacción se confirma.

**Es un borrado permanente en producción. Lo corre Sam** con `MODO=aplicar`, y antes el DG lo ensaya con `MODO=ensayo`, que termina en `rollback`.

## Archivos

| Archivo | Qué es |
|---|---|
| `deshacer-vinculos.sql` | Define `pg_temp.deshacer_vinculos()`: las guardas, las escrituras y la verificación. Devuelve solo líneas `HECHO` |
| `deshacer-vinculos.sh` | Arma las tablas temporales de entrada (los parámetros y `contactos-conservados.ndjson` por `COPY`), llama a la función y cierra con `commit` o `rollback` |

## Uso

```bash
DB=dtd-cargo-db-1 TENANT=<uuid> CUENTA=1 BANDEJA=<id> \
ESPERADOS_SALIDA=<n> ESPERADOS_HILOS=<n> ESPERADOS_CONTACTOS=<n> ESPERADOS_ESPEJO=<n> \
ENTORNO=produccion SISTEMA=<system_identifier> MODO=ensayo bash deshacer-vinculos.sh
```

- **Los `ESPERADOS_*`** salen del conteo previo de solo lectura (4.6b).
- **`SISTEMA`** es el `system_identifier` de producción y está en el runbook, no en el repo.
- **En la copia del ensayo** va `ENTORNO=copia`, que exige la marca `dtd.entorno = 'copia'` guardada para la base.

**El archivo de E5,** `/dev/shm/portal-historial/contactos-conservados.ndjson`, va en 0600 y lleva solo ids:
- una cabecera: `{"tipo":"cabecera","version":1,"tenant_id","cuenta","bandeja","contactos"}`;
- y una línea por cada contacto `dtd-portal:` que E5 no borra: `{"tipo":"contacto","identificador","contacto_id"}`.

**El orden del 4.6b lo imponen los archivos `.hecho`** (secuencia aprobada por el DG el 2026-11-09; el detalle está en el 4.6b del runbook y en las notas de E5):
1. **el seco de Chatwoot** (la 2c de E5, la #478) escribe el archivo y `chatwoot-seco.hecho`;
2. **este guion con `MODO=ensayo`** exige `chatwoot-seco.hecho` con el mismo sha256 del `.ndjson`, el tenant, la cuenta y la bandeja, y escribe `studio-ensayo.hecho`, solo en tmpfs;
3. **el borrado de Chatwoot** (la 2c) escribe `chatwoot-borrar.inicio` en la durable antes de su transacción, y `chatwoot-borrar.hecho` en las dos copias si confirma;
4. **este guion con `MODO=aplicar`** exige `studio-ensayo.hecho` (el mismo `entorno`) y `chatwoot-borrar.hecho` (`fin=commit`), y escribe `studio-aplicar.hecho` en tmpfs y en la durable;
5. **el cierre:** `limpiar.sh --cierre-4-6b` exige `studio-aplicar.hecho` y borra las dos carpetas. Si se abandona antes de que el paso 3 confirme, `limpiar.sh --abandono-4-6b`, que se niega si hay `chatwoot-borrar.hecho` o `chatwoot-borrar.inicio`.

Cada `.hecho` es una línea `HECHO <paso>=ok conservados_sha256=<64 hex> tenant=<uuid> …`, en 0600, escrita con `.parcial` + `mv`; solo ids, uuid seudónimos y hashes. A psql entra una foto del `.ndjson` con su sha256: si el archivo cambia durante la corrida, no queda evidencia. Un intento que falla borra su propio `.hecho` anterior.

**La copia durable,** `/srv/ops/portal-historial/deshacer/` (root, 0700, archivos 0600; la opción (a) de Sam): la crea el paso 3, el paso 4 le agrega `studio-aplicar.hecho`, y nada antes del paso 3 toca el disco. Solo el paso 4 la lee, y solo para lo que falta en tmpfs después de un reinicio; se niega si un archivo está en las dos y no son iguales, o si la carpeta no es de este usuario, no está en 0700 o es un enlace. La variable es `DESHACER_DURABLE`, la misma de la #478, y vale solo con `DESHACER_PRUEBA=1` (la prueba bash) y terminada en `/deshacer`.

**Las pruebas** están en `infra/ops/tests/prueba-portal-historial.sh` (Linux, «Calidad continua»): los casos del orden, de la durable, del cierre y del abandono, y un mutante por guarda (`# guarda:<nombre>`), que cuenta solo si su caso pasa antes con el guion real.

## Qué hace y qué no

- **Solo sirve antes de encender `chatwoot_portal`:** se niega si el flag está encendido o se encendió alguna vez, o si la cola corrió.
  - **Ojo: un encendido por SQL directo no deja auditoría.** «Se encendió alguna vez» se lee en `entity_audit_log`, que solo escribe el panel. Si alguien encendió y apagó por SQL, esa guarda no lo ve. Lo cubre solo en parte la guarda de la salida: si la cola alcanzó a correr, deja filas que no están `cargado`. Por eso el paso 4.3 del runbook exige las cuatro condiciones juntas, y el flag se enciende solo desde el panel.
  - **La fila del flag queda tomada** (`for update`) mientras dura la transacción, para que nadie la encienda a mitad de la corrida.
- **La guarda de entorno funciona con el rol `postgres` del VPS** (medido el 2026-11-08 por el DG, solo metadata). En producción y en prueba, `postgres` tiene `rolsuper = f`, pero puede leer `pg_control_system()` y `pg_db_role_setting`. El runbook lo comprueba antes del ensayo del 4.6b: si da 42501, se para.
- **Las guardas, que abortan sin escribir:**
  - el entorno;
  - los parámetros;
  - el flag y su auditoría;
  - una salida que no está `cargado`;
  - un trigger no interno en las cinco tablas;
  - los conteos y la bandeja;
  - el archivo de E5.
- **Lo que borra:** las salidas `cargado`, el espejo de `chatwoot_conversations` de los hilos vinculados y `chatwoot_portal_hilos`.
- **Lo que vacía:**
  - el corte y `cargado_at`;
  - en `chatwoot_portal_contactos`, `chatwoot_contact_id` y `chatwoot_source_id`, salvo en los conservados.
- **Las filas de contactos no se borran:** el identificador es la reserva, y una carga nueva lo reusa.
- **No toca** `conversations` ni `conversation_messages`. `entity_audit_log` queda con el mismo número.
