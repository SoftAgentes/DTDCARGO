---
sdd: "0566"
title: "Cierre contable con superclave y reporte de excepciones"
status: in-progress
author: "founder"
created: 2026-10-19
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0080", "0123", "0187", "0565"]
confidencialidad: interno
---

# SDD-0566 — Cierre contable con superclave y reporte de excepciones

> Un período cerrado se cambia solo con advertencia y, si el admin lo pide, con una superclave distinta de la clave del usuario. Cada cambio queda en un reporte de excepciones, como en QuickBooks.

## Contexto

### Decisiones de Sam del 2026-10-19, registradas por el Director

- **Período cerrado como en QuickBooks:** advertencia y una «superclave de autorización» distinta de la clave del usuario, para cambiar algo de un período cerrado.
- **Sin impuestos por ahora:** «vamos a empezar todo sin temas de IVA ni nada de impuestos». Esta SDD no calcula ni registra IVA, IGTF ni retenciones.
- **QuickBooks solo está de paso** y «no nos interesa que viaje a QuickBooks»: no hay conector. El reporte y el cierre viven en el ERP.

### Lo que hay hoy (SDD-0080, migración `0133_period_close.sql`)

- `accounting_settings.closing_date` por tenant. Solo el admin la mueve o la quita, con `setClosingDateAction` (`app/studio/(app)/contabilidad/actions.ts`, con `tenantAdminGate`). Quitarla reabre el período para todos.
- `journal_entries_validate_closing` rechaza INSERT, UPDATE y DELETE de un asiento con `entry_date <= closing_date`, mirando OLD y NEW. `journal_lines_validate_closing` hace lo mismo con las líneas de un asiento cerrado. Los dos corren con cualquier rol, también `service_role`, y no tienen excepción posible: para corregir algo hay que reabrir.
- **Los cambios de la fecha de cierre no se auditan:** ninguna migración posterior a la 0133 audita `accounting_settings`.
- **Quién mira el cierre en la app (`isPeriodClosed`), según `git grep`:**
  - los asientos manuales (`contabilidad/actions.ts`: crear, asentar, anular, eliminar);
  - gastos (`gastos/actions.ts`);
  - activos y depreciación (`assets-actions.ts`, `depreciation-posting.ts`);
  - nómina (`nomina/actions.ts`);
  - el ERP móvil (`app/m/erp/actions.ts`);
  - los reclamos (`claim-posting.ts`, que se apoya en el disparador).
- **Facturas, recibos, CxP y pagos a proveedor no lo miran en la app.** Su asiento automático (`*-posting.ts`, best-effort) choca con el disparador y falla en silencio. El documento queda sin asiento y aparece en «Por contabilizar».

### QuickBooks Online (referencia)

En *Account and settings › Advanced › Accounting › Close the books* hay dos modos: «Allow changes after viewing a warning» y «Allow changes after viewing a warning and entering password». El reporte «Exceptions to Closing Date» lista lo que cambió con fecha dentro del cierre.

## Decisión

### 1. El modo del cierre lo fija el admin

`accounting_settings.closing_mode`, con dos valores:

| Modo | Qué pasa al tocar un período cerrado |
|---|---|
| `superclave` (por defecto) | Advertencia, superclave y motivo. **Sin superclave definida, no se puede cambiar nada, como hoy.** |
| `advertencia` | Advertencia y motivo, sin clave. |

Por eso la migración no debilita nada: todos los tenants quedan en `superclave` sin clave, que se comporta igual que el bloqueo de hoy. Pasar a `advertencia` es una decisión explícita del admin y queda en el historial.

### 2. La superclave

- La define el admin, aparte de su clave de usuario, en `accounting_closing_secrets`: una fila por tenant **sin ningún acceso para `authenticated`**. Solo la leen y escriben funciones SECURITY DEFINER.
- Se guarda **solo como hash bcrypt**: `extensions.crypt(clave, extensions.gen_salt('bf', 10))`, como el PIN de operarios (0020). El texto nunca se guarda ni se devuelve.
- Mínimo 8 caracteres. Para cambiarla hay que dar la actual.
- **Si se olvida:** el admin la restablece sin la actual, con un motivo de al menos 10 caracteres, y queda en el historial como «superclave restablecida». El admin igual puede reabrir el período moviendo la fecha, así que el restablecimiento no le da más poder del que ya tiene. Lo que protege la superclave es que alguien sin rol de admin cambie un período cerrado.
- **Intentos:** 5 fallidos seguidos bloquean la superclave 15 minutos. Cada intento, bueno o malo, queda registrado sin el valor. Un acierto pone el contador en 0.
- **Sin carreras ni pistas de tiempo:**
  - la verificación toma la fila con `for update`, así que dos intentos en paralelo no se saltan el contador;
  - sin fila, compara igual contra un hash fijo, para tardar lo mismo;
  - el mensaje de error es el mismo para clave mala y para tenant sin clave;
  - el texto de la clave no entra en ningún `raise`, `notice`, comentario ni evidencia.

### 3. Permiso puntual, sin reabrir: la excepción es el permiso

PostgREST corre cada llamada en su propia transacción, así que el permiso solo sirve si la misma RPC verifica y hace el cambio. Cada operación permitida sobre un período cerrado es una RPC que, **en una sola transacción**:

1. verifica el modo y, si corresponde, la superclave (`autorizar_excepcion_al_cierre`, SECURITY DEFINER);
2. inserta la fila de la excepción en `accounting_closing_exceptions`, con un nonce aleatorio y `txid_current()`;
3. fija el permiso local, `set_config('dtd.excepcion_cierre', nonce, true)`;
4. hace el cambio;
5. limpia el permiso.

`journal_entries_validate_closing` y `journal_lines_validate_closing` aceptan un cambio en período cerrado **solo si** existe una excepción con ese nonce, en la transacción actual (`txid_current()`) y para ese asiento.

Cualquiera puede llamar a `set_config`, así que el GUC solo no alcanza. Lo que no se puede falsificar es la fila: la tabla no tiene escritura para `authenticated`, y sin la fila el disparador rechaza. Así, **todo cambio en período cerrado queda en el reporte**: si no hay fila, no hay cambio. Nada queda en la sesión ni en cookies.

### 4. Alcance de esta SDD: los asientos manuales

Las cuatro operaciones de `contabilidad/actions.ts` que hoy se niegan por el cierre pasan a ofrecer la excepción:

| Operación | RPC | Antes y después que se registran |
|---|---|---|
| Crear un asiento con fecha cerrada | `crear_asiento_en_cierre` (cabecera y líneas en un JSON) | 0 → total del debe |
| Asentar un borrador de fecha cerrada | `asentar_asiento_en_cierre` | borrador → asentado, con su total |
| Anular un asiento de fecha cerrada | `anular_asiento_en_cierre` (usa el motivo también como `dtd.audit_reason`, como `void_journal_entry_with_audit_reason`) | total → 0 |
| Eliminar un borrador de fecha cerrada | `eliminar_borrador_en_cierre` | total → 0 |

Las RPC de operación son SECURITY INVOKER: corren como el usuario, con su RLS. Además exigen permiso de edición sobre `accounting`, como `moduleEditDenial`.

**Fuera de esta SDD, en la misma línea:** los documentos que generan asientos (facturas, recibos, CxP, pagos y gastos), porque cada flujo necesita su propia RPC atómica. Hoy los primeros cuatro ni siquiera miran el cierre en la app (ver *Lo que hay hoy*). Se proponen como SDD de seguimiento, una por flujo. El mecanismo de esta SDD es el que van a usar.

### 5. Lo que ve quien edita

Cuando una de las cuatro operaciones cae en período cerrado, el cajón del asiento muestra: «Este período ya cerró contablemente (cierre al DD/MM/AAAA). Para cambiarlo, ingresa la superclave y el motivo.». En modo `advertencia` pide solo el motivo, y sin superclave definida explica que el admin tiene que definirla.

El campo de la superclave es `type="password"` y `autocomplete="off"`, y se vacía al cerrar el cajón. La clave nunca vuelve del servidor.

### 6. Reporte «Excepciones al cierre»

Una pestaña nueva de Contabilidad, con su CSV, que reúne dos cosas:

- **Las excepciones:** cada alta, cambio o borrado con fecha dentro del cierre. Muestra el documento, la fecha del asiento, el usuario, cómo se autorizó («superclave» o «advertencia»), cuándo, el motivo, y el monto antes y después.
- **El historial del cierre** (`accounting_closing_events`): quién movió la fecha, de cuál a cuál y cuándo; los cambios de modo; cuándo se definió, cambió o restableció la superclave; los intentos fallidos y los bloqueos. Nunca guarda el valor de la clave.

Las dos tablas son de solo lectura para el tenant. Las escriben solo las funciones y los disparadores de la 0493.

### 7. El límite: una clave compartida no identifica a quien la tecleó

El reporte dice «usuario X, autorizado con superclave». Si la superclave la conocen varias personas, no dice quién la autorizó, solo quién hizo el cambio. Hay dos opciones:

| Opción | Qué identifica | Costo |
|---|---|---|
| **A. Superclave compartida** (lo que pidió Sam, igual que QuickBooks) | quién hizo el cambio | bajo; se hace en esta SDD |
| **B. El autorizador entra con su propia cuenta** (un admin confirma con su usuario y su clave) | quién hizo el cambio **y** quién lo autorizó | más alto: verificar la clave de otro usuario en el servidor y otra pantalla |

**Recomendación: A en esta SDD**, que es lo que pidió Sam y lo que hace QuickBooks, con estas mitigaciones: el motivo es obligatorio, se registra quién hizo el cambio, la superclave se puede cambiar cuando alguien deja de deber conocerla, y los intentos se bloquean. **Decide Sam.** Si elige B, el mecanismo de las secciones 3 a 6 no cambia: solo cambia la verificación de `autorizar_excepcion_al_cierre`.

### 8. Cruce con la 2.4 (candado del mayor)

La 2.4 del plan pide un «historial de reapertura de período». Esta SDD crea `accounting_closing_events`, que lo cubre para la fecha, el modo y la superclave: la 2.4 debería reusarlo, no duplicarlo. La 2.4 también va a quitar UPDATE y DELETE a `authenticated` sobre el mayor. Las RPC de esta SDD son INVOKER, así que, cuando eso entre, tendrán que pasar a DEFINER con sus propias guardas de rol, o la 2.4 les tiene que dejar su camino. Queda anotado para que la 2.4 lo resuelva.

## Migración `0493_cierre_contable_superclave.sql` (MIGRATE-FIRST)

- `accounting_settings.closing_mode` (`superclave` por defecto, con un check).
- `accounting_closing_secrets`, `accounting_closing_exceptions` y `accounting_closing_events`, con RLS. El tenant lee las dos últimas y nadie lee la primera.
- Funciones:
  - `fijar_superclave_de_cierre`, `restablecer_superclave_de_cierre` y `autorizar_excepcion_al_cierre`: DEFINER, solo para el admin donde corresponde, `search_path` fijo y `revoke` de `public` y `anon`;
  - las cuatro RPC de operación, INVOKER.
- Las dos funciones de validación del cierre se reescriben desde su última definición (0133, con el `search_path` fijado en la 0210 y siguientes) y aceptan la excepción de la transacción.
- Un disparador nuevo en `accounting_settings` escribe el historial de la fecha y del modo.
- Se aplica antes de fusionar, con la previa de solo lectura, el OK nominal de Sam y el runbook. La aplica el Director. La PR queda en borrador con la espera declarada (`pending-migration-symbols`).

## Allowlist exacta

Se completa al implementar. La spec se actualiza con la lista final antes de pedir el `verify`.

## Criterios de aceptación

1. Sin superclave definida y en modo `superclave`, cambiar un asiento de período cerrado sigue siendo imposible, igual que hoy, también con la RPC.
2. Con la superclave correcta y un motivo, cada una de las cuatro operaciones funciona en período cerrado y deja su excepción con el antes y el después. Con la clave mala, no cambia nada.
3. Un `update` directo, o un `set_config` hecho a mano con cualquier valor, no abre el período: sin la fila de la excepción en la misma transacción, el disparador rechaza.
4. El permiso no sobrevive a la transacción ni sirve para otro asiento.
5. Cinco intentos fallidos bloquean la superclave 15 minutos; los intentos quedan registrados sin el valor.
6. La superclave solo existe como hash bcrypt. Ningún log, error, prueba ni evidencia trae su texto.
7. Mover la fecha de cierre, cambiar el modo y definir, cambiar o restablecer la superclave quedan en el historial con quién y cuándo.
8. El reporte muestra las excepciones y el historial, con su CSV.
9. Control rojo: cada regla de la migración y de la app tiene un mutante que muere.
10. Revisión de seguridad de la clave antes de pedir el OK nominal: hash, intentos, filtraciones y pistas de tiempo.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec |
| AUD-01 | cumplimiento | la excepción (un *override* contable) y su cambio son una sola transacción; los cambios de período y de credenciales quedan en el historial |
| ERR-01 | cumplimiento | mensajes que dicen qué pasó y qué hacer; un error de la base no llega a la pantalla |
| FRM-01, A11Y-01, BTN-01, VIS-01 | cumplimiento | el cajón del asiento y el del cierre; pasan por `/ui-check` |
| Datos personales | no aplica | la superclave no es un dato personal; los usuarios ya están en el log de auditoría |

## Validación

Ver el handoff `.agents/handoffs/0566-cierre-contable-con-superclave.md`.
