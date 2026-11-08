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

**El orden con E5:**
1. la 2c de E5 corre en seco y escribe el archivo;
2. este guion lo lee;
3. la 2c borra en Chatwoot, recalcula los conservados, y aborta si no coinciden.

## Qué hace y qué no

- **Solo sirve antes de encender `chatwoot_portal`:** se niega si el flag está encendido o se encendió alguna vez, o si la cola corrió.
  - **Ojo: un encendido por SQL directo no deja auditoría.** «Se encendió alguna vez» se lee en `entity_audit_log`, que solo escribe el panel. Si alguien encendió y apagó por SQL, esa guarda no lo ve. Lo cubre solo en parte la guarda de la salida: si la cola alcanzó a correr, deja filas que no están `cargado`. Por eso el paso 4.3 del runbook exige las cuatro condiciones juntas, y el flag se enciende solo desde el panel.
  - **La fila del flag queda tomada** (`for update`) mientras dura la transacción, para que nadie la encienda a mitad de la corrida.
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
