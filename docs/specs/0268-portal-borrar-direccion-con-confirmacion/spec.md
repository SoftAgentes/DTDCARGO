---
sdd: 0268
title: En el portal, borrar una dirección también deja de ser un clic sin preguntas
status: in-progress
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0138, 0198, 0262]
confidencialidad: interna
---

# SDD-0268 · En el portal, borrar una dirección también deja de ser un clic sin preguntas

## Problema

Es el **gemelo** del [SDD-0262](../0262-confirmar-borrado-de-direccion/spec.md),
que cerró lo mismo en el Studio. La tabla es la misma
(`client_delivery_addresses`, migr 0198), pero **acá lo pulsa el cliente en su
propio portal**.

[`PortalAddresses.tsx`](<../../../app/portal/(app)/perfil/PortalAddresses.tsx>),
antes:

```tsx
<form action={deleteAddressAction}>
  <input type="hidden" name="addressId" value={address.id} />
  <PendingTextButton idle="Eliminar" pending="Eliminando…" />
</form>
```

Un `<form>` con su submit. **Un clic y la dirección se va.**

Y con la misma inversión visual que tenía el Studio: el botón destructivo iba en
`text-grey-500` mientras **"Predeterminar"** —que no destruye nada— iba en
`text-wine-text`. La acción peligrosa era la menos visible de las dos.

### Por qué importa que sea el portal y no el Studio

En el Studio lo pulsa un asesor entrenado. Acá lo pulsa **el cliente**, con menos
contexto y sin nadie a quien preguntarle. Y SGE-00 §2 cubre el portal
explícitamente: *"Aplica a … portal, correos, facturas…"*.

## Clasificación MP-01

Idéntica a la del SDD-0262, y por las mismas razones medidas:

| Eje | Valor | Fundamento |
|---|---|---|
| **Permanencia** | **P2 · Soft-delete** | `deleteAddressAction` → `deleted_at`. La fila sobrevive. |
| **Fricción** | **R2 · Importante** | MP-01 §3: *"si la restauración depende de soporte … no califica como R1"*. **No hay UI de restauración en ninguna de las dos superficies.** |

## ⚠️ Lo que NO se pudo cumplir al pie de la letra, y por qué

**MP-01 R2 pide literalmente un `ConfirmDialog`. El Portal no tiene esa
primitiva.**

Medido: los cuatro componentes `canonical` del registro CMP-01 viven en
`app/studio/_components/ui/`, y el portal **no importa nada de `app/studio`**
(verificado con grep sobre `origin/main`). Buscar un patrón de confirmación
propio del portal tampoco dio nada: los dos únicos aciertos de "confirmar" en
todo `app/portal` eran **copy**, no interacción.

Las tres salidas eran:

| | Salida | Por qué no |
|---|---|---|
| Cruzar la frontera e importar el del Studio | Rompe el aislamiento por superficie. |
| Crear un `ConfirmDialog` del portal | Primitiva nueva para **un solo consumidor**. SGE-00.09 pide registrar la búsqueda antes de crear; con un consumidor no se justifica todavía. |
| ⭐ **Confirmación en dos pasos, en la propia fila** | Entrega **la sustancia de R2** —confirmación explícita, que nombra el registro y dice la consecuencia— con lo que hay. |

Se eligió la tercera. **Queda declarado que no es un `ConfirmDialog`**: si
aparece un segundo consumidor en el portal, ahí sí corresponde extraer la
primitiva y este sitio se migra.

## Alcance

Un solo archivo:
[`app/portal/(app)/perfil/PortalAddresses.tsx`](<../../../app/portal/(app)/perfil/PortalAddresses.tsx>)

| # | Cambio | Política |
|---|---|---|
| 1 | "Eliminar" pasa a un `<button>` que **arma** la confirmación; el `<form>` que borra sólo se monta al confirmar | **MP-01 R2** |
| 2 | La confirmación nombra la dirección (etiqueta, o la línea si no tiene) y dice la consecuencia | MP-01 R2 · SGE-00.11 |
| 3 | El destructivo pasa de `text-grey-500` a `text-status-danger` | **BTN-01 §2** |
| 4 | El estado de confirmación es **local a la fila** | — |

**Sobre el #4:** con dos direcciones en pantalla, confirmar una no debe armar la
otra. Por eso el `useState` vive en `AddressRow`, no en el componente padre.

**Sobre el #1:** el `<form>` de borrado **no existe en el DOM** hasta confirmar.
No es sólo que el botón esté oculto: no hay submit que disparar, ni por teclado
ni por script.

## Criterios de aceptación

1. Pulsar "Eliminar" **no borra**: pide confirmación.
2. La confirmación nombra la dirección y dice que el asesor deja de verla.
3. Cancelar no borra y vuelve al estado inicial.
4. El submit que borra **no existe** antes de confirmar.
5. El destructivo se lee como destructivo.
6. Las pruebas se validan **con mutación**: con el código viejo deben fallar.
7. `pnpm typecheck`, `pnpm lint`, `pnpm test`; `node scripts/verify.mjs`.

### Verificación hecha

**6 pruebas**, una por criterio, en
[`PortalAddresses.test.tsx`](<../../../app/portal/(app)/perfil/PortalAddresses.test.tsx>).
**Validadas con mutación: revertido el componente al código viejo, fallan las 6.**

⚠️ Un tropiezo del camino que cambió las pruebas: dos aserciones buscaban el
nombre de la dirección suelto (`/Oficina/`) y fallaban por **encontrarlo dos
veces** — sale en la fila **y** en la confirmación. Se ajustaron a la **frase**
completa (`/¿Eliminar «Oficina»\?/`). La versión laxa habría pasado aunque la
confirmación no nombrara nada.

## Matriz SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.02 No perder trabajo | `cumple` | Cancelar no destruye. |
| **SGE-00.03 Riesgo ↔ fricción** | **`no cumple` hoy → lo corrige este SDD** | Destructiva con fricción cero, en la superficie del cliente. |
| SGE-00.04 Auditabilidad | `no aplica` con reserva | La action no escribe `entity_audit_log`. Igual que en el 0262: un soft-delete P2/R2 de un dato de contacto no llega al umbral de AUD-01. Si se decide que sí, es otro SDD **y cubre las dos superficies**. |
| SGE-00.05 Permisos y tenant | `cumple` | La action ya resuelve el cliente por sesión; la UI no es la única defensa. |
| SGE-00.09 Reutilizar el patrón | **`excepción` declarada** | No hay `ConfirmDialog` alcanzable desde el portal. Ver arriba. |
| SGE-00.11 Decir qué pasó y qué sigue | `cumple` | Nombra el objeto y la consecuencia; el color deja de ser el único portador. |

## Gobernanza

| Control | Valor |
|---|---|
| Políticas | **MP-01 v1.1 §3 (R2)** · **SGE-00.03** · **BTN-01 v1.1 §2** — aprobadas |
| Clasificación | **no conformidad** |
| Componente `canonical` | **ninguno alcanzable** desde el portal (los 4 del registro son del Studio) |
| ¿Suma consumidores a un `deprecated`? | **No** |
| Excepción declarada | SGE-00.09 — R2 entregado sin `ConfirmDialog`; revisión al aparecer un segundo consumidor |

## Fuera de alcance

| | Por qué |
|---|---|
| Política de restauración P2 | MP-01 la exige y no existe **en ninguna de las dos superficies**. Deuda compartida con el 0262. |
| Auditar el borrado (AUD-01) | Deuda de la familia entera, no de este sitio. |
| `ConfirmDialog` del portal | Con un consumidor no se justifica. Al segundo, se extrae. |
| Impedir borrar la predeterminada | Regla de negocio, decisión del founder. Igual que en el 0262. |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El cliente cree que ya borró y se va | La confirmación es inline y a la vista, no un modal que tape; el botón dice "Sí, eliminar". |
| Se lee como que esto cierra la familia | No: falta la restauración P2, la auditoría, y el guard de la predeterminada — en **las dos** superficies. |
