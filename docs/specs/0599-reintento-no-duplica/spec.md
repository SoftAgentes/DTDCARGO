---
sdd: "0599"
title: "Reintentar un envío del portal no lo duplica"
status: proposed
author: "Sam (founder) + Claude Code"
created: 2026-11-02
updated: 2026-11-02
supersedes: null
superseded_by: null
related: ["0598", "0596", "0365"]
confidencialidad: interno
---

# SDD-0599 · Reintentar un envío del portal no lo duplica

**Estado: propuesta. Falta la aprobación de Sam. No hay migración escrita ni aplicada.**

## Pedido

Sam, 2026-11-02, literal: «Haz esta tarea aquí: "Que reintentar un envío del portal no lo duplique"».

SDD-0598 evita que un corte de red borre el formulario y avisa con honestidad que el envío pudo haberse registrado. Eso reduce el riesgo de duplicar, pero no lo elimina. ERR-01 pide «Reintentar no duplica la mutación» (`err-01.md:31`).

**Límite:** nada que toque portal o registro entra a `main` antes de publicar. Este tramo va después de #358 y #360, y su migración necesita OK nominal de Sam.

## Qué duplica hoy, y cuánto daño hace

Leído en el código y en las migraciones. Sin leer filas de producción.

| Acción | Qué crea cada intento | Daño |
|---|---|---|
| `createPrealertaAction` | Compra con código nuevo (`proveedores/actions.ts:568`). **El trigger crea además sus cajas esperadas, con código definitivo** (`0244:218`, `:155`) | **Alto:** cajas fantasma en bodega, con etiquetas que el proveedor puede imprimir |
| `requestCotizacionAction` | Cotización con código nuevo y otro aviso al asesor (`cotizaciones/actions.ts:71`, `:95`) | Medio: el asesor cotiza dos veces |
| `createPortalClaimAction` | Reclamo con código nuevo (`reclamos/actions.ts:99`) | Medio: dos casos para un solo problema |
| `sendPortalMessageAction` | Mensaje repetido, otro aviso y un no leído más (`0431:110`, `:118`) | Bajo: molesto y visible |
| `addAddressAction` | Dirección repetida (`address-actions.ts:49`) | Bajo: la persona puede borrarla |
| Adjuntos de compra y evidencia de reclamo | Otro archivo y otra fila en cada intento (`proveedores/actions.ts:85`, `:100`; `claim-evidence.ts:115`) | Bajo: un documento repetido |

## Propuesta

### 1. Un identificador por intento, generado en el navegador

`useActionKeepingDraft` genera un `request_id` (UUID) y lo envía en el `FormData`. Lo reutiliza en cada reintento y lo cambia sólo cuando la acción responde `ok`, para que un formulario que queda a la vista, como el de mensajes, no choque consigo mismo.

Es el precedente de `PaymentReportForm` (`PaymentReportForm.tsx:107`), más simple: aquí no hace falta su tabla privada de comandos (`0421:63`), que guarda el recibo de un comando auditado. Lo que debe responder el segundo intento ya está en la fila: el código de la compra, la cotización o el reclamo.

### 2. El candado vive en la misma fila

Columna nueva, sin valor por defecto, y un índice único parcial en **tres tablas**: `prealertas`, `quotes` y `client_claims`.

```sql
alter table public.quotes add column client_request_id uuid;
create unique index quotes_client_request_uidx
  on public.quotes (tenant_id, client_markbox, client_request_id)
  where client_request_id is not null;
```

- **Atómico:** la fila y su candado entran juntos. Dos intentos a la vez no pueden pasar los dos, aunque el primero siga procesándose.
- **Por cliente:** el mismo identificador en otro Shipping Mark no choca ni revela nada.
- **Las filas de hoy no estorban:** quedan en `NULL`, fuera del índice.

### 3. Mensajes: sin columna nueva

`conversation_messages` ya tiene `external_msg_id` y su índice único parcial por tenant (`0106:107`), hecho justo para esto. Se usa `portal:<uuid>`, que no puede chocar con un identificador de proveedor.

Sí cambia la RPC, reescrita desde su última definición (`0431:52`): nueva firma `portal_post_message(text, uuid)`, que dice si fue repetido y entonces no suma un no leído. `mensajes/actions.ts` es su único consumidor. La firma vieja sigue viva hasta que el código nuevo esté publicado, y se retira en otra migración.

### 4. Direcciones y adjuntos: sin migración

Su daño es bajo y no justifica tocar más tablas. Se comparan por contenido, antes de escribir:

- **Dirección:** si ya hay una activa idéntica, responde `ok`, sin insertar otra.
- **Adjunto o evidencia:** si la compra o el reclamo ya tiene un archivo con el mismo tipo, nombre y tamaño, no lo sube otra vez.

Esto no es atómico, y aquí no hace falta: en el peor caso queda lo que ya pasa hoy.

### 5. Qué responde el segundo intento

Lo mismo que el primero, con `replayed: true`: **el mismo código**, sin gastar otro correlativo, sin volver a avisar al asesor. Es lo que ya hace pagos (`reportar/actions.ts:92`). Si faltaron adjuntos porque el primero se cortó a mitad, los completa.

Primero se busca por identificador, antes de pedir un correlativo. Si dos intentos llegan a la vez, el segundo choca en el índice con `23505`, y ese caso se distingue por el nombre del índice del choque de código que `createPrealertaAction` ya reintenta (`proveedores/actions.ts:636`).

**La pantalla lo dice:** la de éxito añade «Ya estaba registrada desde tu primer envío. Si cambiaste algo después, escríbele a tu asesor.»

### 6. El aviso de SDD-0598 cambia

Esas acciones dejan de mandar a revisar en otra pestaña: «No pudimos confirmar si tu cotización se registró. Lo que escribiste sigue aquí. Intenta de nuevo: no se registrará dos veces.»

## Qué sigue sin cubrir

- **Recargar la página:** se pierde el identificador junto con lo escrito. Si la persona vuelve a llenarlo, es un intento nuevo.
- **Envío antes de hidratar o sin JavaScript:** el POST nativo no trae identificador y queda como hoy. El índice lo permite, por el `NULL`.
- **Si la persona cambia el texto tras el corte y el primero sí llegó:** vale el primero, y la pantalla lo dice. Pagos lo rechaza como conflicto (`0421:259`); aquí se perdería lo escrito sin ganar nada.
- **Si el primero murió antes de avisar al asesor:** el reintento no avisa, igual que pagos. Sin una cola de avisos no se puede garantizar, y eso es otra tarea.
- **Candados de proveedor, referido y registro:** siguen siendo leer y después escribir. Dos intentos simultáneos podrían pasar. Fuera de este tramo.

## Alternativa descartada: sin migración

Comparar contenido en vez de usar un candado: «mismo cliente, mismo contenido, últimos minutos», sólo al reintentar.

| | Con candado (propuesta) | Sin migración |
|---|---|---|
| El primer envío sigue procesándose al reintentar | No duplica | **Duplica** |
| La persona cambió una letra | No duplica | **Duplica** |
| Toca la base de producción | Sí, aditivo, con OK nominal | No |
| Cumple «Reintentar no duplica» | Sí, en esas acciones | Sólo lo reduce |

La descarto para compras, cotizaciones y reclamos porque el corte es justo el caso en que el primero puede seguir en curso. Para direcciones y adjuntos sí alcanza.

## Orden de despliegue

La migración va **antes** que el código: la web nueva con la base vieja rompería compras, cotizaciones y reclamos, porque insertaría una columna que no existe. Al revés es seguro: la web vieja ignora las columnas nuevas y sigue usando la firma vieja.

1. Salida a producción: 0496, 0497 y publicación. Después, #358 y #360.
2. Con OK nominal de Sam: aplicar esta migración.
3. Integrar y publicar este tramo.
4. Otra migración retira la firma vieja de `portal_post_message`.

**Riesgo de aplicar:** agregar las columnas sólo toca metadatos (`0269:14`). Crear cada índice bloquea escrituras en esa tabla mientras la recorre. Se aplica con `lock_timeout`, y aborta sin cambios si no consigue el bloqueo. Antes, con OK de conteos, medir cuántas filas tiene cada tabla: hoy no lo sé, porque no leí producción.

## Datos personales

Clasificación previa con `.claude/skills/revisar-datos-ve/SKILL.md`, que se repite sobre el código al implementar. No es asesoría legal.

| Punto | Estado | Evidencia |
|---|---|---|
| El identificador no contiene datos de la persona | `CORRECTO`, por diseño | Es un UUID aleatorio. Falta verlo en el código |
| Sin destinos nuevos ni datos nuevos a terceros | `CORRECTO`, por diseño | Viaja en la misma acción y queda en la misma fila |
| Si el identificador queda en la auditoría | `NO VERIFICABLE` | Los triggers `audit_d3` no se revisaron para esta columna. Mirarlo al implementar |

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| ERR-01, reintento | **no conformidad → se corregiría** en compras, cotizaciones, reclamos y mensajes | `err-01.md:31` |
| ERR-01, conectividad | **no conformidad → se corregiría** en esas acciones | `err-01.md:18`, reintento seguro |
| Migraciones | Requiere OK nominal | `docs/runbooks/aplicar-migraciones-prod.md` |

## Si se aprueba

**Código:** `lib/shared/use-action-keeping-draft.ts`; las acciones de compras, cotizaciones, reclamos, mensajes y direcciones; `lib/studio/reclamos/claim-evidence.ts`; `lib/portal/cotizacion-request.ts`; y las pantallas de éxito de esos formularios. La allowlist exacta se fija al empezar.

**Migración:** una sola: las tres columnas, sus índices y la firma nueva. Hoy la siguiente libre es la 0512, según `sdd:next`, que no la reserva: sólo ve migraciones como archivos. Se confirma al escribirla.

**Pruebas:**
- Contrato SQL en PGlite, con su `.test.sql` y su prueba de migración: el mismo identificador dos veces deja una sola fila y una sola tanda de cajas; otro cliente con el mismo identificador no choca; dos intentos simultáneos dejan una fila; la RPC repetida no suma un no leído; los `NULL` siguen sin chocar.
- Vitest por acción: el segundo intento devuelve el mismo código, no gasta correlativo y no avisa.
- Hook: reutiliza el identificador al reintentar y lo cambia después de `ok`.
- Con turno: mutantes, `next dev` y `verify`.

## Estado

Propuesta. Sin código ni migración hasta que Sam apruebe el diseño. Aprobarlo no autoriza aplicar nada en producción: eso es un OK nominal aparte.
