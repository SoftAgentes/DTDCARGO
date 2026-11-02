---
sdd: "0599"
title: "Reintentar un envío del portal no lo duplica"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-02
updated: 2026-11-02
supersedes: null
superseded_by: null
related: ["0598", "0596", "0365"]
confidencialidad: interno
---

# SDD-0599 · Reintentar un envío del portal no lo duplica

**Estado: implementado en una PR en borrador. La migración 0512 está escrita y sin aplicar. Sam aprobó el diseño, no aplicarlo.**

## Pedido

Sam, 2026-11-02, literal: «Haz esta tarea aquí: "Que reintentar un envío del portal no lo duplique"».

SDD-0598 evita que un corte de red borre el formulario y avisa con honestidad que el envío pudo haberse registrado. Eso reduce el riesgo de duplicar, pero no lo elimina. ERR-01 pide «Reintentar no duplica la mutación» (`err-01.md:31`).

**Decisión de Sam, literal: «Sí, con candado»,** a la pregunta «¿Apruebas el diseño con candado en la base?», con esta spec en propuesta y su alternativa a la vista. No autoriza aplicar nada en producción: eso es un OK nominal aparte.

**Límite:** nada que toque portal o registro entra a `main` antes de publicar. Este tramo va después de #358 y #360, sobre las que está apilado.

## Qué duplicaba, y cuánto daño hacía

Leído en el código y en las migraciones. Sin leer filas de producción.

| Acción | Qué creaba cada intento | Daño |
|---|---|---|
| `createPrealertaAction` | Compra con código nuevo. **El trigger crea además sus cajas esperadas, con código definitivo** (`0244:218`, `:155`) | **Alto:** cajas fantasma en bodega, con etiquetas que el proveedor puede imprimir |
| `requestCotizacionAction` | Cotización con código nuevo y otro aviso al asesor | Medio: el asesor cotiza dos veces |
| `createPortalClaimAction` | Reclamo con código nuevo | Medio: dos casos para un solo problema |
| `sendPortalMessageAction` | Mensaje repetido, otro aviso y un no leído más | Bajo: molesto y visible |
| `addAddressAction` | Dirección repetida | Bajo: la persona puede borrarla |
| Adjuntos de compra y evidencia de reclamo | Otro archivo y otra fila en cada intento | Bajo: un documento repetido |

## Decisión

### 1. Un identificador por intento, generado en el navegador

`useActionKeepingDraft(..., { requestId: true })` genera un UUID y lo envía como `request_id` (`use-action-keeping-draft.ts:85`). Lo reutiliza en cada reintento, también si la persona cambió el texto, y lo cambia sólo cuando la acción responde `ok` (`:68`), para que un formulario que queda a la vista no choque consigo mismo.

El servidor lo valida (`client-request.ts:10`): sin identificador, o con uno inválido, el envío va sin candado, como hoy.

Es el precedente de `PaymentReportForm` (`PaymentReportForm.tsx:107`), más simple: aquí no hace falta su tabla privada de comandos (`0421:63`), que guarda el recibo de un comando auditado. Lo que debe responder el segundo intento ya está en la fila.

### 2. El candado vive en la misma fila

Migración `0512_portal_intento_sin_duplicar.sql`: columna `client_request_id uuid`, sin default, e índice único parcial por `(tenant_id, client_markbox, client_request_id)` en **`prealertas`, `quotes` y `client_claims`** (`0512:95`, `:98`, `:101`).

- **Atómico:** la fila y su candado entran juntos. Dos intentos a la vez no pueden pasar los dos, aunque el primero siga procesándose.
- **Por cliente:** el mismo identificador en otro Shipping Mark no choca ni revela nada.
- **Las filas de hoy no estorban:** quedan en `NULL`, fuera del índice.

### 3. Mensajes: sin columna nueva

`conversation_messages` ya tiene `external_msg_id` y su índice único parcial por tenant (`0106:107`), hecho justo para esto. La firma nueva `portal_post_message(text, uuid)`, escrita desde la última definición (`0431:52`):

- Guarda `portal:<cliente>:<uuid>` (`0512:162`): no choca con un identificador de proveedor, y el cliente va en el valor porque el índice es por tenant.
- Busca antes de crear nada (`0512:167`) y usa `on conflict` para dos intentos a la vez (`0512:193`).
- Responde `{conversation_id, replayed}`. Si es repetido, no suma un no leído, no reabre el hilo ni cambia su fecha.

`mensajes/actions.ts` es su único consumidor. La firma vieja sigue viva para la web anterior, y se retira en otra migración.

### 4. Direcciones y adjuntos: sin migración

Su daño es bajo y no justifica tocar más tablas. Se comparan por contenido, antes de escribir:

- **Dirección** (`client-address-queries.ts:63`): si ya hay una activa idéntica, responde `ok` sin insertar otra. Si se pidió como predeterminada, la marca.
- **Adjunto** (`proveedores/actions.ts:165`) **o evidencia** (`claim-evidence.ts:171`): si ya hay uno con el mismo nombre y tamaño, y en adjuntos el mismo tipo, no lo sube otra vez.

No es atómico, y aquí no hace falta: en el peor caso queda lo que ya pasa hoy.

### 5. Qué responde el segundo intento

Lo mismo que el primero, con `replayed: true`: **el mismo código**, sin gastar otro correlativo y sin volver a avisar. Es lo que ya hace pagos (`reportar/actions.ts:92`). Si faltaron adjuntos o evidencia porque el primero se cortó a mitad, los completa.

Primero se busca por identificador, antes de pedir un correlativo (`proveedores/actions.ts:614`). Si dos intentos llegan a la vez, el segundo choca en el índice, y ese caso se distingue por el nombre del índice (`client-request.ts:18`) del choque de código que `createPrealertaAction` ya reintenta (`proveedores/actions.ts:716`).

**La pantalla lo dice:** «Ya estaba registrada desde tu primer envío. Si cambiaste algo después, escríbele a tu asesor.» En reclamos, «registrado». En mensajes, «Tu mensaje ya había llegado en tu primer envío. Si lo cambiaste después, envía el cambio en otro mensaje.»

### 6. El aviso de SDD-0598 cambia

Esas acciones dejan de mandar a revisar en otra pestaña: «No pudimos confirmar si tu cotización se registró. Lo que escribiste sigue aquí. Intenta de nuevo: no se registrará dos veces.»

### 7. El código tolera una base sin 0512

El orden previsto es aplicar la migración primero. Aun así, si faltara, nada se rompe: la lectura por identificador falla y sigue como envío nuevo, la inserción reintenta sin la columna (`client-request.ts:23`), y mensajes cae a la firma vieja (`mensajes/actions.ts:39`). **En esa ventana el aviso prometería algo que no se cumple:** «no se registrará dos veces». Por eso sigue siendo migrate-first.

Es lo que el gate exige para salir en verde antes de aplicar: `supabase/pending-migration-symbol-declarations.json`, grupo `sdd-0599-intento-sin-duplicar`.

### Descartado: sin migración

Comparar contenido en vez de usar un candado: «mismo cliente, mismo contenido, últimos minutos», sólo al reintentar.

| | Con candado (elegido) | Sin migración |
|---|---|---|
| El primer envío sigue procesándose al reintentar | No duplica | **Duplica** |
| La persona cambió una letra | No duplica | **Duplica** |
| Toca la base de producción | Sí, aditivo, con OK nominal | No |
| Cumple «Reintentar no duplica» | Sí, en esas acciones | Sólo lo reduce |

## Qué sigue sin cubrir

- **Recargar la página:** se pierde el identificador junto con lo escrito. Si la persona vuelve a llenarlo, es un intento nuevo.
- **Envío antes de hidratar o sin JavaScript:** el POST nativo no trae identificador y queda como hoy.
- **Si la persona cambia el texto tras el corte y el primero sí llegó:** vale el primero, y la pantalla lo dice. Pagos lo rechaza como conflicto (`0421:259`); aquí se perdería lo escrito sin ganar nada.
- **Si el primero murió antes de avisar al asesor:** el reintento no avisa, igual que pagos. Sin una cola de avisos no se puede garantizar.
- **Candados de proveedor, referido y registro:** siguen siendo leer y después escribir. Dos intentos simultáneos podrían pasar.
- **Si un operador borró la fila entre un intento y otro:** el índice incluye las filas borradas, la búsqueda no las ve y el reintento responde «No pudimos registrar…». El caso es muy raro y no duplica.

## Orden de despliegue

1. Salida a producción: 0496, 0497 y publicación. Después, #358 y #360.
2. Con OK nominal de Sam: aplicar la 0512, con su lectura previa.
3. Integrar y publicar este tramo. Retirar la espera con `infra/ops/migraciones/retirar-espera.mjs`.
4. Otra migración retira la firma vieja de `portal_post_message`.

**Riesgo de aplicar:** agregar las columnas sólo toca metadatos (`0269:14`). Crear cada índice bloquea escrituras en esa tabla mientras la recorre. Se aplica con `lock_timeout` y `set local` (`0512:31`), y aborta sin cambios si no consigue el bloqueo. Antes, con OK de conteos, medir cuántas filas tiene cada tabla: hoy no lo sé, porque no leí producción.

## Datos personales

Clasificación con `.claude/skills/revisar-datos-ve/SKILL.md`, limitada a lo que cambia este tramo. Sin filas de producción: todas las medidas usan datos sintéticos. No es asesoría legal: es un inventario técnico para saber qué preguntarle a un abogado.

| Punto | Estado | Evidencia |
|---|---|---|
| El identificador no contiene datos de la persona | `CORRECTO` | UUID aleatorio (`use-action-keeping-draft.ts:85`), validado por formato (`client-request.ts:10`) |
| Sin destinos nuevos ni datos nuevos a terceros | `CORRECTO` | Viaja en la misma acción y queda en la misma fila (`0512:95`) |
| Un cliente no alcanza la fila de otro con un identificador ajeno | `CORRECTO` | Índice y búsqueda por Shipping Mark (`0512:95`, `proveedores/actions.ts:531`), y el cliente en el valor del mensaje (`0512:162`). Probado en el contrato y en `reintento-no-duplica.test.ts` |
| El identificador no llega a la auditoría de una compra | `CORRECTO` | `audit_d3_commercial_change` lee la fila, pero guarda sólo `prealert_id` y `sales_order_id` (`0291:227`) |
| El identificador no se guarda en otra tabla | `CORRECTO` | Vive y se borra con su fila: no hay otra tabla que purgar (`0512:95`) |
| Si el texto cambió entre intentos, el segundo no se guarda | `ENCONTRADO` | Vale el primero (`0512:167`). Es lo que la persona escribió, y la pantalla le avisa |
| Otros disparadores que copien estas filas | `NO VERIFICABLE` | Revisé los de `to_jsonb` en esas tablas (`0291`, `0319`), no todo trigger posible. La guarda de `0319:119` compara filas sólo al pagar, y esta columna no cambia |

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| ERR-01, reintento | **no conformidad → corregida** en compras, cotizaciones, reclamos y mensajes, una vez aplicada la 0512 | `err-01.md:31` |
| ERR-01, conectividad | **no conformidad → corregida** en esas acciones, una vez aplicada | `err-01.md:18`, reintento seguro |
| Direcciones y adjuntos | excepción | Comparación por contenido, no atómica, por su daño bajo. Ver «Decisión» |
| Migraciones | Requiere OK nominal | `docs/runbooks/aplicar-migraciones-prod.md` |
| CMP-01, BTN-01 | no aplica | Sin componentes ni botones nuevos |

`/ui-check` del diff: sin tokens ni maquetación nuevos. Los avisos usan tamaños que ya están en esos formularios; el copy va en tuteo. Sin hallazgos.

## Allowlist

**Migración y base:**
- `supabase/migrations/0512_portal_intento_sin_duplicar.sql` (nueva)
- `supabase/tests/0512_portal_intento_sin_duplicar.test.sql` (nuevo)
- `supabase/migrations-baseline.json`, `supabase/pending-migration-symbol-declarations.json`

**Código:**
- `lib/shared/client-request.ts` (nuevo), `lib/shared/use-action-keeping-draft.ts`
- `lib/studio/client-address-queries.ts`, `lib/studio/prealertas/types.ts`, `lib/studio/reclamos/claim-evidence.ts`
- `app/portal/(app)/proveedores/actions.ts`, `cotizaciones/actions.ts`, `reclamos/actions.ts`, `mensajes/actions.ts`, `perfil/address-actions.ts`
- `app/portal/(app)/compras/nueva/NewPurchaseForm.tsx`, `NewPurchaseWizard.tsx`
- `app/portal/(app)/cotizaciones/CotizacionRequestForm.tsx`
- `app/portal/(app)/mensajes/PortalMessageForm.tsx`
- `app/portal/(app)/perfil/PortalAddresses.tsx`
- `app/portal/(app)/reclamos/_components/PortalClaims.tsx`

**Pruebas:**
- `lib/portal/__tests__/portal-intento-sin-duplicar.migration.test.ts` (nueva)
- `app/portal/reintento-no-duplica.test.ts` (nueva)
- `app/portal/la-accion-lanza.test.tsx`, `lib/shared/__tests__/use-action-keeping-draft.test.tsx`

**Documentos:** `docs/specs/0599-reintento-no-duplica/spec.md`, `docs/specs/README.md`, `.agents/handoffs/sdd-0599-reintento-no-duplica.md`

## Aceptación

1. El mismo intento deja una sola compra, cotización, reclamo o mensaje, con el mismo código, sin otro correlativo ni otro aviso.
2. Otro intento, o el mismo identificador en otro Shipping Mark, es otra fila.
3. Dos intentos a la vez: el que choca responde la fila del otro.
4. El choque de un correlativo sigue reintentando con otro.
5. Un reintento completa lo que el primero dejó a medias, sin repetir adjuntos ni evidencia.
6. La misma dirección otra vez no crea otra fila.
7. La pantalla dice cuando el envío ya estaba registrado.
8. Sin la 0512, nada se rompe: todo entra sin candado, como hoy.
9. La migración no cambia filas, y un reintento de mensaje no suma un no leído.

## Verificación (2026-11-02, en el worktree; sin producción)

| Comprobación | Resultado |
|---|---|
| Contrato SQL en PGlite, con los `.sql` reales | PASÓ, 39 aserciones |
| Control rojo sin 0512, 8 mutantes de la migración, postflight y preflight | PASÓ, 12 de 12 casos: todos rojos donde debían |
| `reintento-no-duplica.test.ts` | PASÓ, 25 de 25 |
| La misma prueba con el identificador anulado | FALLÓ, como se esperaba: 9 de 25 en rojo, los que dependen de él |
| `la-accion-lanza.test.tsx` y `use-action-keeping-draft.test.tsx` | PASÓ, 46 de 46 |
| Pruebas vecinas: `principal-tenant-actions`, `actions-tenant-scope`, `PortalClaims`, `PortalAddresses`, `NewPurchaseWizard` | PASÓ, 38 de 38 |
| ESLint de los archivos tocados | PASÓ |
| `tsc` limitado a los archivos tocados | Sin errores en ellos. 1 error ajeno, de la configuración limitada: `DocumentImportPanel.tsx`, módulo CSS |
| `check-pending-migration-symbols.mjs` | PASÓ: `0 ROJO` |
| `docs:check`, `sdd:check` | PASÓ |

**Límite de PGlite:** tiene una sola conexión. Dos intentos simultáneos se prueban en serie; los da el índice único y `on conflict`. Corre además como superusuario.

**Pendiente de turno del Director General:** `next dev` con Server Action real, el contrato en `supabase/postgres` con el rol real, mutantes de las acciones, `tsc` completo y `pnpm verify`.

**Pendiente de OK de Sam:** conteo de filas y lectura previa en producción, y aplicar.

**Sin medir:** lector de pantalla, portal con sesión real, y un corte real contra esta acción.

## Estado

Implementado en PR en borrador, apilada sobre #360 y retenida. No se integra antes de publicar, y no funciona hasta aplicar la 0512.
