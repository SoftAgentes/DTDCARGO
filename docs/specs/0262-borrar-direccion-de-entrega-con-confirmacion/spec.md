---
sdd: 0262
title: Borrar una dirección de entrega deja de ser un clic sin preguntas
status: in-progress
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0138, 0198, 0246]
confidencialidad: interna
---

# SDD-0262 · Borrar una dirección de entrega deja de ser un clic sin preguntas

## Problema

En la ficha del cliente del Studio, el botón **"Eliminar"** de una dirección de
entrega ejecuta el borrado **de una**, sin confirmación de ningún tipo.

[`DeliveryAddressesCard.tsx:233-261`](<../../../app/studio/(app)/clientes/_components/DeliveryAddressesCard.tsx>):

```tsx
<button
  type="button"
  className="studio-link-quiet"
  onClick={async () => {
    const res = await deleteClientAddressAction(markbox, a.id);   // ← directo
```

Tres cosas se suman:

1. **Fricción cero sobre una acción destructiva.** No hay diálogo, no hay
   Deshacer, no hay motivo.
2. **No se lee como destructiva.** Es `studio-link-quiet` con
   `color: var(--ink-soft)`. Su vecino **"Predeterminar"** —que NO destruye
   nada— va en `var(--wine-text)`. O sea que **la acción peligrosa es la menos
   visible de las dos**. Está invertido.
3. **Se puede borrar la predeterminada.** "Predeterminar" está guardado con
   `{!a.isDefault && …}`, pero "Eliminar" no tiene guarda: la dirección que la
   operación usa para el last-mile se borra igual que cualquier otra.

### Qué cuesta

La tabla `client_delivery_addresses` (migr 0198) es **un recurso compartido por
dos superficies sobre el mismo esquema**: el cliente edita las suyas en
`/portal/perfil` y el asesor las edita en el Studio. Un clic accidental del
asesor **le desaparece la dirección al cliente**, que no participó de la
decisión y no recibe aviso.

## ⚠️ Corrección a la auditoría que originó este SDD

La [auditoría del 2026-08-14](../../design/studio/2026-08-14-auditoria-ui-pro-clientes.md)
describió esto como si fuera un borrado duro. **No lo es.**
`deleteClientAddressAction` llama a `softDeleteClientDeliveryAddress`
([`client-address-queries.ts:147-156`](../../../lib/studio/client-address-queries.ts)),
que sólo escribe `deleted_at`. La fila sobrevive.

Eso **baja la severidad** que le puse: no se pierde el dato. Pero **no elimina
el hallazgo**, y la razón está en la propia MP-01 (§3):

> Si la restauración puede fallar, depende de soporte o pierde datos
> relacionados, la acción **no califica como R1**.

Busqué UI de restauración de direcciones en todo el módulo: **no existe**.
Recuperarla hoy es una operación de base de datos. Por lo tanto **no es R1**
(ejecutar + Deshacer), es **R2**.

## Clasificación MP-01

| Eje | Valor | Fundamento |
|---|---|---|
| **Permanencia** | **P2 · Soft-delete** | Escribe `deleted_at`, conserva identidad y referencias. Coincide con la fila "Maestros" del mapa de MP-01 §5 (*"P2 sólo si todavía no hay referencias"*). |
| **Fricción** | **R2 · Importante** | *"Se puede restaurar, pero el impacto operativo es relevante"* → interacción mínima: **`ConfirmDialog` con nombre del registro y consecuencia**. |
| ¿R3? | **No** | No es evidencia legal, contable ni financiera. No lleva motivo obligatorio ni permiso especial, y **no lleva HTD-01** — la política reserva la presión sostenida para consumidores R3 clasificados. |

⚠️ **Deuda que este SDD NO cierra:** MP-01 dice que P2 *"requiere política de
restauración"*. No la hay para direcciones. Queda registrado; abrirlo es otro SDD.

## Alcance — allowlist exacta

Un solo archivo:
[`app/studio/(app)/clientes/_components/DeliveryAddressesCard.tsx`](<../../../app/studio/(app)/clientes/_components/DeliveryAddressesCard.tsx>)

| # | Cambio | Política |
|---|---|---|
| 1 | El botón "Eliminar" **abre `ConfirmDialog`** en vez de ejecutar. El borrado corre al confirmar. | **MP-01 R2** |
| 2 | El diálogo va en modo `danger`, nombra la dirección y dice la consecuencia (incluye que el cliente la ve en su portal, y que es la predeterminada cuando lo sea). | **MP-01 R2** · SGE-00.11 |
| 3 | `pending` durante el borrado; el error de la action queda **dentro** del diálogo. | ERR-01 · BTN-01 §5 |
| 4 | El botón destructivo pasa de `--ink-soft` a `--danger`. | **BTN-01 §2** (*rol destructivo → variante `danger`*) |

**Componente:** `ConfirmDialog` — **`canonical`** en el registro CMP-01. No se
crea ninguna primitiva. **Cero consumidores nuevos de `deprecated`.**

### Lo que queda FUERA a propósito

| | Por qué |
|---|---|
| `aria-busy` en estos dos botones | El módulo va **0 de 9** archivos (hallazgo 5 de la auditoría). Arreglar 2 sueltos deja el módulo peor de entender que barrerlo entero en su propio slice. |
| Impedir borrar la predeterminada | Es una **regla de negocio**, no de presentación: hay que decidir si se prohíbe o si se reasigna el default. Decisión del founder, SDD propio. Este SDD sólo **avisa** en el diálogo cuando es la predeterminada. |
| Política de restauración P2 | Ver arriba. |
| El menú de la cabecera (piezas B y C) | Dependen de una primitiva que no existe. |

## Criterios de aceptación

1. Pulsar "Eliminar" **no borra nada**: abre el diálogo.
2. El diálogo nombra la dirección (etiqueta si tiene, si no la línea) y dice que
   el cliente también la ve en su portal.
3. Cuando la dirección es la **predeterminada**, el mensaje lo dice.
4. Cancelar **no** borra. Escape cierra. El foco inicial cae en **Cancelar**
   (default `initialFocus="safe"` de `ConfirmDialog` en modo destructivo).
5. Un error de la action se muestra **dentro** del diálogo y el diálogo **queda
   abierto** — no se pierde el contexto.
6. Doble clic no dispara dos borrados (`pending` bloquea).
7. El botón destructivo se ve destructivo: `--danger`, no `--ink-soft`.
8. `pnpm typecheck`, `pnpm lint`, `pnpm test` en verde; `node scripts/verify.mjs`
   de cierre.

## Matriz SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.01 Acción predecible | `cumple` | "Eliminar" conserva su significado de BTN-01 §3; lo que cambia es la fricción. |
| SGE-00.02 No perder trabajo | `cumple` | Cancelar no destruye; el error conserva el diálogo abierto. |
| **SGE-00.03 Riesgo ↔ fricción** | **`no cumple` hoy → lo corrige este SDD** | Es la ley incumplida: destructiva con fricción cero. |
| SGE-00.04 Auditabilidad | **`no aplica` con reserva** | La action no escribe `entity_audit_log`. AUD-01 aplica a acciones "financieras, críticas o de permanencia"; un soft-delete P2/R2 de un dato de contacto no llega a ese umbral. **Si se decide que sí, es otro SDD** — no se resuelve pintando el botón. |
| SGE-00.05 Permisos y tenant | `cumple` | `moduleEditDenial(supabase, "clients")` ya gatea la action en servidor (`actions.ts:828`). La UI no es la única defensa. |
| SGE-00.06 Prevenir antes de informar | `cumple` | El diálogo es exactamente eso. |
| SGE-00.07 Estado visible | `cumple` | `pending` + error dentro del diálogo. |
| SGE-00.09 Reutilizar el patrón | `cumple` | Usa el `ConfirmDialog` canónico, igual que `DuplicadosClient.tsx:195` en el mismo módulo. |
| SGE-00.10 Accesible | `cumple` | Lo aporta `ConfirmDialog`, con teclado y foco ya **verificados** en el registro CMP-01. |
| SGE-00.11 Decir qué pasó y qué sigue | `cumple` | El mensaje nombra el objeto y la consecuencia; el color deja de ser el único portador. |
| SGE-00.12 IA | `no aplica` | — |

## Gobernanza

| Control | Valor |
|---|---|
| Políticas que obligan | **MP-01 v1.1 §3 (R2)** · **SGE-00.03** · **BTN-01 v1.1 §2** — las tres **aprobadas** → bloquean |
| Clasificación del hallazgo | **no conformidad** |
| Componente | `ConfirmDialog` — **`canonical`**, sin cambios en el componente |
| ¿Suma consumidores a un `deprecated`? | **No** |
| ¿HTD-01? | **No.** Reservada a R3 clasificados; esto es R2. |
| Decisiones pendientes del founder | ninguna para ejecutar este SDD |
| Recomendación mía, **no** bloqueante | prohibir el borrado de la predeterminada, y la política de restauración P2 |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Se agrega fricción a una acción frecuente | No es frecuente: es mantenimiento de la ficha. Y SGE-00.03 pide fricción proporcional, que hoy es cero. |
| El diálogo tapa el error y el asesor reintenta a ciegas | Criterio 5: el error vive **dentro** del diálogo, que no se cierra. |
| Se cree que esto cierra el hallazgo de auditoría completo | No lo hace: quedan la restauración P2, el guard de la predeterminada y `aria-busy`. Declarados arriba. |
