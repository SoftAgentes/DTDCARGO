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
- `journal_entries_validate_closing` rechaza INSERT, UPDATE y DELETE de un asiento con `entry_date <= closing_date`, mirando OLD y NEW. `journal_lines_validate_closing` hace lo mismo con las líneas. Los dos corren con cualquier rol, también `service_role`, y no tienen excepción posible: para corregir algo hay que reabrir.
- **Un error del mensaje:** la 0133 escribe `no se puede %s un asiento`, pero `RAISE` solo entiende `%`, así que en producción sale «no se puede **modificars** un asiento» (también «crears» y «borrars»). Lo destapó un mutante de esta SDD.
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

La migración no debilita nada: todos los tenants quedan en `superclave` sin clave, que se comporta igual que el bloqueo de hoy. Pasar a `advertencia` es una decisión explícita del admin y queda en el historial.

### 2. La superclave

- La define el admin, aparte de su clave de usuario, en `accounting_closing_secrets`: una fila por tenant **sin ningún acceso para los roles de API**, ni siquiera `service_role`. Solo la leen y escriben funciones SECURITY DEFINER.
- Se guarda **solo como hash bcrypt**, con `extensions.crypt(clave, extensions.gen_salt('bf', 10))`, como el PIN de operarios (0020). El texto nunca se guarda ni se devuelve.
- **Tiene entre 8 y 64 caracteres, y no más de 72 bytes.** bcrypt usa solo los primeros 72 bytes: con un tope más alto, dos superclaves distintas que comparten ese comienzo serían la misma. Lo valida la base y lo valida la app.
- Para cambiarla hay que dar la actual.
- **Si se olvida:** el admin la restablece sin la actual, con un motivo de al menos 10 caracteres, y queda en el historial como «superclave restablecida». El admin igual puede reabrir el período moviendo la fecha, así que el restablecimiento no le da más poder del que ya tiene. Lo que protege la superclave es que alguien sin rol de admin cambie un período cerrado.
- **Intentos:** 5 fallidos seguidos bloquean la superclave 15 minutos. Cada intento fallido queda en el historial, sin el valor. Un acierto pone el contador en 0.
- **Un intento fallido no lanza un error:** la RPC devuelve `{ok: false, motivo}` para que la transacción confirme el contador y el registro del intento. Si lanzara, el ROLLBACK se llevaría el contador y la fuerza bruta no tendría límite. Hay un mutante que lo prueba.
- **Sin carreras ni pistas de tiempo:**
  - la verificación toma la fila con `for update`, así que dos intentos en paralelo no se saltan el contador;
  - sin fila, compara igual contra un hash recién hecho, para tardar lo mismo;
  - el motivo se valida antes que la clave, para que un motivo inválido no gaste un intento;
  - el texto de la clave no entra en ningún `raise`, comentario, evento, excepción ni evidencia.
- **Mensajes distintos para «sin superclave» y «clave mala».** Que el tenant tenga o no superclave no es secreto: lo ve cualquiera en el cajón del cierre, y quien edita necesita saber que el admin tiene que definirla. Lo que no se distingue es el tiempo.

### 3. Permiso puntual, sin reabrir: la excepción es el permiso

PostgREST corre cada llamada en su propia transacción, así que el permiso solo sirve si la misma RPC verifica y hace el cambio. Cada operación permitida sobre un período cerrado es una RPC que, **en una sola transacción**:

1. verifica el modo y, si corresponde, la superclave (`autorizar_excepcion_al_cierre`);
2. inserta la fila de la excepción en `accounting_closing_exceptions`, con un nonce aleatorio y `txid_current()`;
3. fija el permiso local, `set_config('dtd.excepcion_cierre', nonce, true)`;
4. hace el cambio, con el motivo también como `dtd.audit_reason`, para que el log de auditoría lo lleve (0294);
5. limpia el permiso.

`journal_entries_validate_closing` y `journal_lines_validate_closing` aceptan un cambio en período cerrado **solo si** existe una excepción con ese nonce, en la transacción actual (`txid_current()`) y para ese asiento.

Cualquiera puede llamar a `set_config`, así que el GUC solo no alcanza. Lo que no se puede falsificar es la fila: la tabla no tiene escritura para ningún rol de API, y sin la fila el disparador rechaza. Así, **todo cambio en período cerrado queda en el reporte**: si no hay fila, no hay cambio. Nada queda en la sesión ni en cookies.

### 4. Alcance de esta SDD: los asientos manuales

Las cuatro operaciones de `contabilidad/actions.ts` que hoy se niegan por el cierre pasan a ofrecer la excepción:

| Operación | RPC | Antes y después que se registran |
|---|---|---|
| Crear un asiento con fecha cerrada | `crear_asiento_en_cierre` (cabecera y líneas en un JSON, validadas como en la app) | 0 → total del debe |
| Asentar un borrador de fecha cerrada | `asentar_asiento_en_cierre` (al menos 2 líneas y balanceado) | 0 → total del debe |
| Anular un asiento de fecha cerrada | `anular_asiento_en_cierre` (el motivo de la anulación es el de la excepción) | total → 0 |
| Eliminar un borrador de fecha cerrada | `eliminar_borrador_en_cierre` | total → 0 |

**Las RPC son SECURITY DEFINER**, con las guardas de tenant (`get_user_tenant_id`) y de edición de `accounting` (`contabilidad_edicion_autorizada`, la matriz de `lib/studio/rbac.ts`, como la 0477). La spec decía INVOKER; al implementar se cambió por dos razones: así la función interna de autorización no queda expuesta a la API, y además las RPC siguen funcionando cuando la 2.4 quite UPDATE y DELETE a `authenticated`.

**Fuera de esta SDD, en la misma línea:** los documentos que generan asientos (facturas, recibos, CxP, pagos y gastos), porque cada flujo necesita su propia RPC atómica. Hoy los primeros cuatro ni siquiera miran el cierre en la app (ver *Lo que hay hoy*). Se proponen como SDD de seguimiento, una por flujo. El mecanismo de esta SDD es el que van a usar.

### 5. Lo que ve quien edita

- **En el Libro diario**, un asiento con fecha dentro del cierre muestra «Asentar…», «Eliminar…» o «Anular…». El diálogo muestra «Este período ya cerró contablemente (cierre al DD/MM/AAAA). Para cambiarlo, ingresa la superclave y el motivo.».
  - En modo `advertencia`, pide solo el motivo.
  - Sin superclave definida, explica que el admin tiene que definirla y solo deja cerrar.
- **En «Nuevo asiento»**, con una fecha cerrada, el servidor devuelve el aviso y el mismo formulario pide la superclave y el motivo. El botón pasa a «Crear con excepción».
- **El campo de la superclave** es `type="password"` y `autocomplete="off"`, y se vacía en cuanto se envía. La clave nunca vuelve del servidor.

### 6. Reporte «Excepciones al cierre»

Una pestaña nueva de Contabilidad, con su CSV, que reúne dos cosas:

- **Las excepciones:** cada alta, cambio o borrado con fecha dentro del cierre. Muestra el asiento, la fecha del asiento y la del cierre, el usuario, cómo se autorizó («Con superclave» o «Con advertencia»), cuándo (hora de Caracas), el motivo, y el monto antes y después.
- **El historial del cierre** (`accounting_closing_events`): quién movió la fecha, de cuál a cuál y cuándo; los cambios de modo; cuándo se definió, cambió o restableció la superclave (con el motivo, si lo hay); los intentos fallidos y los bloqueos. Nunca guarda el valor de la clave.

Las dos tablas son de solo lectura para el tenant, y el nonce y el txid no se pueden leer. Las escriben solo las funciones y el disparador de la 0493. Los nombres de los usuarios salen de los miembros del tenant; uno que ya no está activo figura como «Usuario que ya no está activo».

### 7. El modo y la superclave en el cajón del cierre

Solo para el admin, debajo de la fecha:
- el modo, con su explicación;
- la superclave: definir, cambiar dando la actual, o «¿La olvidaste? Restablecer» con el motivo. Muestra si está bloqueada y hasta cuándo.

Cada acción (`setClosingModeAction`, `fijarSuperclaveAction`, `restablecerSuperclaveAction`) llama a `tenantAdminGate` antes de tocar nada.

### 8. El límite: una clave compartida no identifica a quien la tecleó

El reporte dice «usuario X, autorizado con superclave». Si la superclave la conocen varias personas, no dice quién la autorizó, solo quién hizo el cambio. Hay dos opciones:

| Opción | Qué identifica | Costo |
|---|---|---|
| **A. Superclave compartida** (lo que pidió Sam, igual que QuickBooks) | quién hizo el cambio | bajo; se hace en esta SDD |
| **B. El autorizador entra con su propia cuenta** (un admin confirma con su usuario y su clave) | quién hizo el cambio **y** quién lo autorizó | más alto: verificar la clave de otro usuario en el servidor y otra pantalla |

**Recomendación: A en esta SDD**, que es lo que pidió Sam y lo que hace QuickBooks, con estas mitigaciones: el motivo es obligatorio, se registra quién hizo el cambio, la superclave se puede cambiar cuando alguien deja de deber conocerla, y los intentos se bloquean. **Decide Sam.** Si elige B, el mecanismo de las secciones 3 a 6 no cambia: solo cambia la verificación de `autorizar_excepcion_al_cierre`.

### 9. Cruce con la 2.4 (candado del mayor)

La 2.4 del plan pide un «historial de reapertura de período». Esta SDD crea `accounting_closing_events`, que lo cubre para la fecha, el modo y la superclave: la 2.4 debería reusarlo, no duplicarlo. Las RPC de esta SDD son DEFINER, así que siguen funcionando cuando la 2.4 quite UPDATE y DELETE a `authenticated` sobre el mayor.

## Migración `0493_cierre_contable_superclave.sql` (MIGRATE-FIRST)

- `accounting_settings.closing_mode` (`superclave` por defecto, con un check).
- `accounting_closing_secrets`, `accounting_closing_exceptions` y `accounting_closing_events`, con RLS. El tenant lee las dos últimas; nadie lee la primera.
- 14 funciones nuevas, todas con `search_path` vacío:
  - de uso interno, sin EXECUTE para los roles de API: las guardas, la verificación, la autorización y el total del asiento;
  - para `authenticated`: las de la superclave (con la guarda de admin), la del estado y las cuatro operaciones.
- Las dos funciones de validación del cierre se reescriben desde su última definición (la 0133, con el `search_path` de la 0210). Aceptan la excepción de la transacción y corrigen el «%s».
- Un disparador nuevo en `accounting_settings` escribe el historial de la fecha y del modo.
- **Preflight:** compara firma, seguridad, volatilidad, `search_path` y el md5 del cuerpo vigente de las dos funciones que reemplaza y de cuatro que invoca. Si en producción alguna difiere, aborta sin cambiar nada. Hay una prueba que lo hace abortar.
- `lock_timeout` 5 s y `statement_timeout` 30 s.
- Se aplica antes de fusionar, con la previa de solo lectura, el OK nominal de Sam y el runbook. La aplica el Director. La espera está declarada en `supabase/migrations-baseline.json`, y los símbolos que usa la app, en `supabase/pending-migration-symbol-declarations.json`.

**Sin la 0493, la app no se rompe:** la RPC de estado no existe y la página, las acciones y el cajón del cierre vuelven a lo de hoy, sin excepción, sin reporte y sin ajustes.

## Revisión de seguridad de la clave

| Punto | Cómo queda | Evidencia |
|---|---|---|
| Hash | bcrypt, costo 10; el texto nunca se guarda | contrato, aserción «la superclave queda como hash bcrypt» |
| Largo | 8 a 64 caracteres y hasta 72 bytes (el límite de bcrypt) | contrato («más de 72 bytes se rechaza») y prueba de la acción |
| Intentos | 5 seguidos bloquean 15 minutos; `for update`; un acierto limpia el contador; el fallo no lanza | contrato §11 y 4 mutantes |
| Pistas de tiempo | bcrypt también sin fila; el motivo antes que la clave | código de `cierre_verificar_superclave`; mutante del motivo |
| Que no se filtre | ningún `raise`, evento, excepción, prueba ni log trae el texto; la app nunca lo registra | contrato §15; prueba de las acciones que revisa todos los `console.error` |
| Permiso falsificado | sin la fila de la excepción no hay cambio; el nonce, el txid y el asiento se comparan | contrato §3 y §8; 4 mutantes |
| Funciones internas | sin EXECUTE para la API | contrato §5; mutante |
| **Riesgo residual** | si el Postgres del VPS registra los parámetros de las sentencias (`log_statement = 'all'`, o `log_min_duration_statement` con `log_parameter_max_length`), la superclave quedaría en ese log en texto plano | **para revisar en la previa, antes de aplicar** |
| **Riesgo aceptado** | un editor puede bloquear la superclave 15 minutos con 5 intentos fallidos | el admin la restablece o reabre el período |

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0493_cierre_contable_superclave.sql` | la migración |
| `supabase/tests/0493_cierre_contable_superclave.test.sql` | contrato: 75 aserciones |
| `supabase/migrations-baseline.json` | la espera de la 0493 |
| `supabase/pending-migration-symbol-declarations.json` | los 10 símbolos y su degradación |
| `lib/studio/accounting/cierre-excepciones.ts` | lo puro: aviso, mensajes, etiquetas y CSV |
| `lib/studio/accounting/cierre-queries.ts` | el estado, las excepciones y el historial |
| `lib/studio/journal-types.ts` | `cierre` en `JournalActionState` |
| `app/studio/(app)/contabilidad/actions.ts` | las cuatro operaciones con la excepción; el modo y la superclave |
| `app/studio/(app)/contabilidad/page.tsx` | el estado y el reporte |
| `app/studio/(app)/contabilidad/_components/ContabilidadClient.tsx` | la pestaña y el cableado |
| `app/studio/(app)/contabilidad/_components/LibroDiarioTab.tsx` | los botones «…» y el diálogo |
| `app/studio/(app)/contabilidad/_components/EntryDrawer.tsx` | la excepción en el mismo formulario |
| `app/studio/(app)/contabilidad/_components/ClosingDateDrawer.tsx` | el texto según el modo y los ajustes |
| `app/studio/(app)/contabilidad/_components/CamposExcepcionCierre.tsx` | nuevo: los campos |
| `app/studio/(app)/contabilidad/_components/ExcepcionCierreDialog.tsx` | nuevo: el diálogo |
| `app/studio/(app)/contabilidad/_components/AjustesDelCierre.tsx` | nuevo: el modo y la superclave |
| `app/studio/(app)/contabilidad/_components/ExcepcionesCierreTab.tsx` | nuevo: el reporte |
| `lib/studio/__tests__/cierre-contable-superclave.migration.test.ts` | el contrato en PGlite: control rojo, 18 mutantes, preflight y espera |
| `lib/studio/accounting/__tests__/cierre-excepciones.test.ts` | lo puro |
| `app/studio/(app)/contabilidad/__tests__/cierre-excepcion-acciones.test.ts` | las acciones |
| `app/studio/(app)/contabilidad/__tests__/cierre-excepcion-pantalla.test.tsx` | el diario, el reporte y los ajustes |
| `app/studio/(app)/contabilidad/__tests__/cierre-excepcion-cajon-asiento.test.tsx` | el cajón del asiento |
| `lib/studio/rbac-actions-guard.test.ts` | el inventario de acciones, de 435 a 438 |
| `docs/specs/0566-cierre-contable-con-superclave/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0566-cierre-contable-con-superclave.md` | handoff |

## Criterios de aceptación

1. Sin superclave definida y en modo `superclave`, cambiar un asiento de período cerrado sigue siendo imposible, igual que hoy, también con la RPC.
2. Con la superclave correcta y un motivo, cada una de las cuatro operaciones funciona en período cerrado y deja su excepción con el antes y el después. Con la clave mala, no cambia nada.
3. Un `update` directo, o un `set_config` hecho a mano con cualquier valor, no abre el período: sin la fila de la excepción en la misma transacción, el disparador rechaza.
4. El permiso no sobrevive a la transacción ni sirve para otro asiento.
5. Cinco intentos fallidos bloquean la superclave 15 minutos; los intentos quedan registrados sin el valor.
6. La superclave solo existe como hash bcrypt y no pasa de 72 bytes. Ningún log, error, prueba ni evidencia trae su texto.
7. Mover la fecha de cierre, cambiar el modo y definir, cambiar o restablecer la superclave quedan en el historial con quién y cuándo.
8. El reporte muestra las excepciones y el historial, con su CSV.
9. Sin la 0493, la app vuelve a lo de hoy y no se rompe.
10. Control rojo: cada regla de la migración y de la app tiene un mutante que muere.
11. Revisión de seguridad de la clave (tabla de arriba) antes de pedir el OK nominal.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec |
| AUD-01 | cumplimiento | la excepción (un *override* contable) y su cambio son una sola transacción; los cambios de período y de credenciales quedan en el historial. Que el motivo llegue también a `entity_audit_log` (por `dtd.audit_reason`, como la anulación de la 0294) es **INFERIDO** de leer la 0294: el contrato no aplica el escritor de auditoría |
| ERR-01 | cumplimiento | cada mensaje dice qué pasó y qué hacer; un error de la base no llega a la pantalla (prueba y mutante); el error queda dentro del diálogo, no en un toast |
| FRM-01, A11Y-01 | cumplimiento | etiquetas reales, ayuda con `aria-describedby` (una prueba lo destapó), foco atrapado y devuelto con `useDialogA11y`, campo de clave sin autocompletar |
| VIS-01, BTN-01 | cumplimiento | tokens del sistema; botones «…» para lo que abre un paso más; `/ui-check` en el handoff |
| Datos personales | no aplica | la superclave no es un dato personal; los nombres de usuarios internos ya estaban en la app |

## Validación

Ver el handoff `.agents/handoffs/0566-cierre-contable-con-superclave.md`.
