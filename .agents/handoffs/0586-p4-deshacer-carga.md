# Handoff · SDD-0586 10.7, PR 2c: la vuelta atrás dirigida de la carga P4 en Chatwoot

- **Worker:** E5, bajo el Subdirector Chatwoot.
- **Rama:** `codex/0586-deshacer-carga`, desde main `e74cde6fc` (el tren 9).
- **Estado:** en curso. No se fusiona desde aquí: la fusiona el DG.
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

## El orden del sub-paso 4.6b (runbook, de E10)

1. `deshacer.sh` con `MODO=seco` escribe `/dev/shm/portal-historial/contactos-conservados.ndjson`.
2. El desarme de Studio (`supabase/cargas/portal-historial-deshacer/deshacer-vinculos.sh`) lee ese archivo.
3. `deshacer.sh` con `MODO=borrar`: primero `CONFIRMAR=no` (el ensayo del DG) y después `CONFIRMAR=si`, que lo corre Sam.

## Pendientes de esta tarea

- El primer run de Actions.
- Pasarla por `revisar-datos-ve`. El archivo de conservados lleva solo ids.
- **Para el runbook (E10):**
  - los comandos de 4.6b;
  - la lista de 3.0 suma `deshacer.sh` y `deshacer-carga.rb`.

## FUERA DE ALCANCE DETECTADO

- **El arranque de los dos stacks está tres veces:** en `prueba-deshacer.sh`, en `prueba-punta-a-punta.sh` y en `prueba-ensayo-portal.sh`. Se puede llevar a una función compartida cuando entren la 2b y la 2c.
- **El workflow choca con la 2b:** la 2b y la 2c agregan cada una un job al final de `portal-historial-cargador.yml`. La que entre segunda tiene que traer main.
- **La caché de la cuenta en Chatwoot:** `delete_all` no corre callbacks, así que la caché puede mostrar conteos viejos hasta que venza.
