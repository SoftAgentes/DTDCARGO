---
sdd: "0300"
title: "Borrar un estimado desde el listado — y que se pueda borrar el que no se convirtió"
status: in-progress
author: "founder"
created: 2026-08-25
updated: 2026-08-25
supersedes: null
superseded_by: null
related: ["0011", "0061", "0263", "0275", "0281"]
confidencialidad: interno
---

# DTD-0300 — Borrar un estimado desde el listado

> Nace de un pedido del founder: *"tengo estimados que eran pruebas de un
> principio, no tienen cliente, y no veo la opción de borrarlos."*

## El síntoma

El borrado **ya existía** —`softDeleteQuote` vive en
`app/studio/(app)/cotizador/actions.ts` desde SDD-0011— pero para llegar a él
hay que recorrer cinco pasos:

> listado → clic en la fila → detalle `/studio/cotizador/EST-2026-0002` →
> botón **Editar** → drawer → al pie **Eliminar** → *¿Seguro?* → *Sí, eliminar*

Nada de eso se ve desde el listado: cada fila es un `<Link>` pelado, sin menú
de acciones y sin selección múltiple. El founder buscó "borrar" donde ve los
estimados y ahí no estaba.

## Las dos causas, medidas

**1 · El borrado no vive donde el usuario mira.** Está dentro del *drawer de
edición*, que es el lugar de "cambiarle los datos", no el de "que desaparezca".

**2 · El botón Editar sólo aparece para `draft`.** `isEditable()`
(`lib/studio/quote-types.ts`) devuelve `true` únicamente para el estado
borrador, y el borrado cuelga de él. Consecuencia real y no buscada: **un
estimado `sent`, `accepted` o `rejected` no tiene NINGUNA vía de borrado en la
UI**. No se había notado porque las 20 filas vivas en producción al 2026-08-25
son 19 `draft` y 1 `accepted`.

## Lo que hay en producción (medido 2026-08-25, no recordado)

| origen | estado | ¿cliente? | n |
|---|---|---|---|
| studio | draft | sí | 11 |
| **web** | **draft** | **no** | **6** |
| web | draft | sí | 2 |
| studio | accepted | sí | 1 |

20 filas vivas, **0 con `deleted_at`** — el borrado nunca se usó. Los 6 sin
cliente (`EST-2026-0002`, `0004`, `0005`, `0006`, `0007`, `0008`, del 8-jun al
17-jul) son los del pedido: ninguno convertido a embarque, ninguno con orden de
venta.

## La regla: se borra lo que no se convirtió

Decisión del founder. **Ni el estado ni el origen importan** — un `sent` o un
`rejected` sin convertir se borra igual, y ése es justo el caso que la UI no
cubría. Lo único que bloquea es que el estimado **ya haya causado algo**:

| Bloquea | Por qué |
|---|---|
| `converted_to_shipment_id` no nulo | El embarque apunta a este estimado. Borrarlo lo deja apuntando a un hueco: la policy RLS de `quotes` es `using (… and deleted_at is null)`, así que lo borrado desaparece **también** para quien lo borró. |
| `sales_order_id` no nulo | Igual, del lado de la orden de venta (SDD-0072). |

La regla vive en **una** función pura, `quoteDeleteBlockReason()`, que devuelve
el motivo del bloqueo o `null`. La consume la UI (para deshabilitar la opción
con su explicación) **y** la server action (que es quien realmente decide).

## Alcance

### Entra

1. **Menú de acciones por fila** en `/studio/cotizador`, con `ActionMenu`
   (CMP-01 `canonical`, SDD-0263 · panel en portal `position:fixed` desde
   SDD-0275, así que el `overflow:hidden` de la tabla no lo recorta). Dos
   opciones: *Ver detalle* (navega, `href`) y *Eliminar* (ejecuta,
   `role: "destructive"`).
2. **Confirmación con `ConfirmDialog`** (CMP-01 `canonical`), `danger`, que
   nombra el estimado y dice la consecuencia real: deja de verse en el Studio
   **y en el portal del cliente**, y recuperarlo exige entrar a la base de
   datos.
3. **Gate en el servidor.** `softDeleteQuote` lee el estimado y aplica
   `quoteDeleteBlockReason` antes de tocar nada. Que el menú deshabilite la
   opción es cortesía: la server action se puede invocar sin pasar por él.
4. La opción deshabilitada **explica qué falta** (`disabledReason`, BTN-01 §6).

### No entra

- **Borrado en lote.** Seis estimados no justifican una capa de selección
  múltiple con su propia semántica de errores parciales.
- **Papelera / restaurar desde la UI.** El soft delete queda como está: la fila
  sobrevive con `deleted_at`, pero la RLS la oculta. Recuperar sigue siendo una
  operación de base de datos.
- **Borrado duro.** Nada de `delete from quotes`.
- **Tocar el borrado del drawer de edición.** Sigue donde está; ahora corre
  contra el mismo gate del servidor.

## Verificación

### Lo que se midió

| Qué | Dónde | Casos |
|---|---|---|
| La regla pura | `lib/studio/__tests__/quote-delete.test.ts` | 5 |
| El gate del **servidor**, con la acción real contra un cliente de Supabase falso | `app/studio/(app)/cotizador/__tests__/softDeleteQuote.test.ts` | 5 |
| El cableado de la pantalla en jsdom: menú por fila, diálogo que nombra el estimado, opción deshabilitada con su motivo, cancelar | `app/studio/(app)/cotizador/__tests__/CotizadorClient.borrado.test.tsx` | 4 |

**Las tres tandas se validaron por MUTACIÓN**, no por color: neutralizar la
guarda de `converted_to_shipment_id` en la función pura rompe 3 pruebas
(incluida la de componente), y quitar el `if (bloqueo) return` de la server
action rompe 2 — las que afirman que el `update` **no salió**. Una prueba que
sobrevive a que le saquen lo que prueba no prueba nada.

### Lo que NO se midió — y por qué

**El render en un Studio real, con sesión.** `proxy.ts` corta todo
`/studio/**` sin sesión y no tiene bypass de desarrollo; los e2e con sesión de
Studio exigen branch efímero de Supabase + `seed:e2e` + `STUDIO_E2E_*`. Queda
sin medir lo que jsdom no puede: **(a)** que el hueco de 46 px reservado a la
derecha mantenga alineadas las columnas elásticas de la cabecera y las filas, y
**(b)** el objetivo táctil de 44 px del trigger (BTN-01 §7 regla 13). Ambas se
comprueban abriendo `/studio/cotizador` en el navegador — no se dan por buenas
por omisión.

- `node scripts/verify.mjs` verde.
