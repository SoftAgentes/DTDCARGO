# infra/ops/portal-historial: la carga a Chatwoot del chat del portal que ya existe (SDD-0586 10.7, P4)

Spec: `docs/specs/0586-chatwoot-enrutamiento-segmento-e10/spec.md`, §10.5.10. Ahí están el formato cerrado con E5, los dos riesgos con su arreglo y la revisión de datos personales.

**Dos dueños y ningún archivo compartido.** Cada uno tiene sus archivos en esta carpeta, en su propia rama:
- **El Worker de la 10.5:** la migración 0523 y lo de este README (`reservar.sql`, `extraer.sql`, `extraer.sh`, `vincular.sh`, `limpiar.sh` y `controles-studio.sql`).
- **E5:** el cargador de Chatwoot y el ensayo, adaptados de `infra/ops/kommo-historial/`.

Se pasan dos archivos, en `/dev/shm/portal-historial/` (tmpfs, 0700):
- `preparado.ndjson`, de `extraer.sh` al cargador. Lleva nombres de fichas y textos de mensajes.
- `vinculos.ndjson`, del cargador a `vincular.sh`. Lleva solo ids.

## Orden

Todo con `chatwoot_portal` **apagado**: la 0523 se niega si está encendido.

1. **`extraer.sh`**
   - `reservar.sql` **escribe** en Studio el identificador de cada ficha por cargar. Así una repetición reusa el mismo contacto en Chatwoot.
   - `extraer.sql` **lee** en una transacción de solo lectura y deja `preparado.ndjson`.
2. **El cargador de E5:** con `MODO=seco` primero, y después `cargar`. Lee `preparado.ndjson` y escribe `vinculos.ndjson`.
   - **El contrato de los vínculos:** el cargador los deja en `/dev/shm/portal-historial/vinculos.ndjson`. Es el nombre fijo que lee `vincular.sh`, que no mira ninguna variable `VINCULOS`. `VINCULOS=-`, que es la salida estándar de `rails runner` mezclada con logs, queda solo para pruebas.
   - **El puente entre el contenedor de Chatwoot y el VPS es de E5**, en su segunda PR y en un archivo suyo: `docker exec -i`, `VINCULOS` en el `/dev/shm` del contenedor, `docker cp` a esta carpeta y el borrado del contenedor con `trap`. Va entre `extraer.sh` y `vincular.sh`.
3. **`vincular.sh`** **escribe** en Studio los vínculos, marca `cargado` los mensajes y fija el corte (`chatwoot_portal_vincular_carga`). Si sale bien, borra `/dev/shm/portal-historial`.
4. **Si algo quedó a medias:** `limpiar.sh`. Si la vinculación falla, los archivos quedan en `/dev/shm` para poder reintentar. **Si no se reintenta, se corre `limpiar.sh`:** en un tmpfs, los datos de clientes siguen ahí hasta que alguien los borre o se reinicie el VPS.
5. **El cierre:** comprobar que `/dev/shm/portal-historial` ya no existe (`test ! -e /dev/shm/portal-historial && echo vacio`) y dejarlo en la evidencia.

**En el ensayo**, `controles-studio.sql` (solo lectura, con conteos y md5) se corre antes y después: C-6 y C-7 tienen que dar igual, y C-8, lo nuevo.

```bash
DB=dtd-cargo-staging-db-1 TENANT=<uuid> CUENTA=2 BANDEJA=<id> bash infra/ops/portal-historial/extraer.sh
DB=dtd-cargo-staging-db-1 TENANT=<uuid> bash infra/ops/portal-historial/vincular.sh
```

## Puertas (cada una con su OK nominal de Sam, §10.5.10)

- **En producción**, `extraer.sh` lee el chat del portal (puerta 1, para el ensayo) y su reserva escribe (puerta 4).
- **`vincular.sh` en producción** es la puerta 4: respaldo de Chatwoot y de Studio antes, de a una, y conteos después.
- **Nada de esto se corre** contra producción sin el OK de esa puerta.

**Las salidas** llevan solo `HECHO clave=valor`, con conteos: nunca nombres ni textos.
