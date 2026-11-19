# Relleno de las uniones del portal (SDD-0676, después de la 0566)

**No es una migración.** Escribe filas en producción y por eso lleva un **OK nominal de Sam aparte** del de la 0566. Lo corre quien aplique migraciones en producción, con el [runbook de producción](../../../docs/runbooks/aplicar-migraciones-prod.md) a la vista.

## Para qué

La 0566 deja un solo registro de vínculos, `chatwoot_contact_links`, también para el chat del portal: desde que se aplica, `chatwoot_portal_vincular` escribe ahí la unión de cada contacto nuevo. Los contactos del portal que **ya existían** no se migran dentro de la 0566; los pasa este relleno.

No es urgente. Sin el relleno el portal sigue funcionando: con la 0566 ningún evento automático le quita el cliente a una conversación. El relleno sirve para que esos contactos se reconozcan por su unión, como los demás, y para que la ficha del cliente muestre el chip «Portal».

## Qué escribe

| Tabla | Qué | Cuánto |
|---|---|---|
| `chatwoot_contact_links` | Una unión (origen y canal `portal`) por contacto del portal de una ficha viva que todavía no tiene unión | El dato 5 del conteo |
| `entity_audit_log` | Un evento `chatwoot_contact_linked` por unión creada, con actor `system` | Igual |
| `chatwoot_conversations` | `chat_contact_id` en las conversaciones del portal que no lo tienen | El dato 6 del conteo |

No toca una unión que ya existe, no crea uniones de fichas borradas, no cambia el cliente de ninguna conversación y no llama a Chatwoot. Solo maneja ids.

## Antes de pedir el OK: el conteo de solo lectura

`conteo.sql` (en esta carpeta) es una sola consulta que devuelve **conteos**, sin nombres, teléfonos, correos, textos ni ids. No crea nada, ni siquiera tablas temporales, y termina en `rollback`. Es lo que se le lleva a Sam para decidir:

```bash
psql -v ON_ERROR_STOP=1 -v tenant=<TENANT> -f supabase/cargas/portal-uniones-0566/conteo.sql
```

Son 8 filas. El dato 5 es el número que el relleno espera crear; el dato 3 debe ser cero. Sin la 0566 aplicada falla con «column does not exist» y no devuelve nada.

## Pasos

Todo en una sola sesión de `psql` contra la base, porque las funciones son temporales. `<TENANT>` es el tenant dueño de la cuenta de Chatwoot (`CHATWOOT_TENANT_ID`).

1. Cargar las funciones (no escribe nada):

   ```sql
   \i supabase/cargas/portal-uniones-0566/uniones-portal.sql
   ```

2. Conteo previo, de solo lectura. Anotar el dato 5 (`ESPERADAS`) y mirar el 3:

   ```sql
   select * from pg_temp.contar_uniones_portal('<TENANT>');
   ```

   Si el dato 3 no es cero, hay contactos del portal que alguien unió a mano a otra ficha. El relleno no los toca: se resuelven uno por uno desde la ficha del cliente antes o después, no aquí.

3. Ensayo, que termina en `rollback`:

   ```sql
   begin;
   select * from pg_temp.rellenar_uniones_portal('<TENANT>', <ESPERADAS>);
   select * from pg_temp.contar_uniones_portal('<TENANT>');
   rollback;
   ```

   El segundo conteo debe dar 0 en los datos 5 y 6.

4. Con el OK de Sam para este relleno, lo mismo con `commit`:

   ```sql
   begin;
   select * from pg_temp.rellenar_uniones_portal('<TENANT>', <ESPERADAS>);
   commit;
   ```

Si el número de uniones que salen no es el esperado, la función aborta y no guarda nada: se repite desde el paso 2.

## Repetirlo

Es idempotente: una segunda corrida espera 0 uniones y no vuelve a auditar. Si entre el conteo y el relleno un cliente nuevo escribe por el portal, `chatwoot_portal_vincular` ya creó su unión y el número baja: el relleno aborta y se vuelve a contar.

## Deshacer

Las uniones del portal se van solas con el desarme de la 0566 (`supabase/desarmes/0566_desarme.sql`), que borra todas las de origen `portal`. El dato de qué contacto es de qué ficha sigue completo en `chatwoot_portal_contactos`.

## Ensayo automático

`lib/studio/__tests__/chatwoot-vincular-canal.migration.test.ts`, prueba «relleno de uniones del portal»: crea una unión, respeta la que ya existía y la de una ficha borrada, anota el contacto en la conversación, no hace nada la segunda vez y aborta si el número esperado no coincide.
