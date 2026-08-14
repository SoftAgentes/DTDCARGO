---
sdd: 0262
title: Confirmar el borrado de una dirección de entrega del cliente
status: in-progress
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0138]
confidencialidad: interna
---

# SDD-0262 · Confirmar el borrado de una dirección de entrega del cliente

## Problema

En la ficha del cliente del Studio, borrar una dirección de entrega no pregunta
nada. Un clic y la dirección se fue.

Medido el 2026-08-14 en
[`DeliveryAddressesCard.tsx:233`](../../../app/studio/(app)/clientes/_components/DeliveryAddressesCard.tsx)
(estado de `origin/main`):

| Eslabón | Estado |
|---|---|
| Diálogo de confirmación | **ninguno** — el `onClick` llama a la acción directo |
| Deshacer | **ninguno** |
| Camino de restauración en el Studio | **ninguno** — `actions.ts` tiene alta, predeterminar y borrar; no hay restaurar |
| Señal visual de destructivo | **ninguna** — `studio-link-quiet` en `var(--ink-soft)` |
| Vecino inmediato | **"Predeterminar"**, mismo peso visual, mismo tamaño, al lado |

O sea: la acción que destruye se ve exactamente igual que la que no, está
pegada a ella, y no pide permiso.

Lo encontró la [auditoría del módulo Clientes](../../design/studio/2026-08-14-auditoria-ui-pro-clientes.md)
(hallazgo 2), que lo clasificó como el de mayor riesgo del informe.

### Por qué el soft-delete no lo salva

`deleteClientAddressAction` llama a `softDeleteClientDeliveryAddress`, que sólo
sella `deleted_at`. La fila sobrevive — pero **el producto no ofrece manera de
traerla de vuelta**. MP-01 §3 es explícito: *"Si la restauración puede fallar,
depende de soporte o pierde datos relacionados, la acción no califica como R1"*.
Sin camino de restauración, el patrón "ejecutar y ofrecer Deshacer" no aplica.

### La consecuencia que hoy nadie ve

`softDeleteClientDeliveryAddress` **no reasigna la predeterminada**. Borrar la
dirección predeterminada deja al cliente **sin dirección para el last-mile**, y
el propio texto de la card dice que la predeterminada *"es la que usa la
operación para la entrega"*. Eso ocurre hoy en silencio.

## Decisión

Fricción **R2** de MP-01: `ConfirmDialog` con el nombre del registro y su
consecuencia. No se cambia la permanencia (sigue P2 soft-delete), no se cambia
el servidor, no se agrega un camino de restauración.

### Alcance exacto (allowlist)

| Archivo | Cambio |
|---|---|
| `app/studio/(app)/clientes/_components/DeliveryAddressesCard.tsx` | El botón abre un `ConfirmDialog`; el borrado se ejecuta al confirmar |

**Nada más.** En particular quedan **fuera**:

- `app/portal/(app)/perfil/PortalAddresses.tsx` — tiene el **mismo defecto** sobre
  la misma tabla, en la superficie del cliente. Está en alcance de SGE-00 §2
  (*"portal…"*), pero es otro sistema visual y `ConfirmDialog` es una primitiva
  del Studio: adoptarla ahí es un slice propio. **Deuda declarada, no arreglada
  acá.**
- Los otros 5 hallazgos de la auditoría (tope de 200, tabla sin semántica,
  `aria-busy`, drawer a mano, cabecera sin menú).

### Copy de la confirmación

- **Título:** "Eliminar dirección"
- **Cuerpo:** `«{etiqueta · línea · ciudad}» deja de estar disponible para los
  envíos de {markbox} y no se puede recuperar desde el Studio.`
- **Si es la predeterminada, se agrega:** `Además es la predeterminada: {markbox}
  queda sin dirección de entrega hasta que marques otra.`
- **Confirmar:** "Eliminar dirección" · **Cancelar:** "Cancelar"

El cuerpo **no promete recuperación**. BTN-01 §3 prohíbe expresamente *"prometer
recuperación que depende de soporte"*, y eso es justo lo que sería hoy.

### Contrato `GovernedAction` (BTN-01 §8)

| Campo | Valor |
|---|---|
| `verb` | Eliminar |
| `outcome` | La dirección deja de estar disponible para la operación |
| `role` | `destructive` |
| `risk` | `important` |
| `permanence` | `P2` (soft-delete, `deleted_at`) |
| Permiso | `moduleEditDenial(supabase, "clients")` — ya vigente en la acción |
| Consecuencia | Se pierde la dirección para futuros envíos; si era la predeterminada, el cliente queda sin ninguna |
| Recuperación | **No existe en el Studio.** Declarado como deuda, no prometido al usuario |
| Motivo | No exigido (R2, no R3) |
| Auditoría | Ver SGE-00.04 abajo |

## Gate SGE-00

| Principio | Resultado | Evidencia |
|---|---|---|
| SGE-00.01 Predecible | `cumple` | "Eliminar" conserva su familia de resultado; el objeto ("dirección") se nombra en título y botón |
| SGE-00.02 Sin pérdida silenciosa | `cumple` | El caso que se corrige ES la pérdida silenciosa. Cancelar no ejecuta nada |
| SGE-00.03 Riesgo ↔ fricción | `cumple` | P2 sin restauración → R2 → `ConfirmDialog` con objeto y consecuencia (MP-01 §3) |
| SGE-00.04 Auditable | **`no cumple` · deuda preexistente** | El borrado **no escribe evidencia durable**: la acción sólo hace `update deleted_at` y un toast. SGE-00.04 dice que *"un toast nunca cuenta como auditoría"*. Este SDD **no lo empeora ni lo arregla** — ver "Lo que queda abierto" |
| SGE-00.05 Permisos y tenant | `cumple` | `moduleEditDenial` en el servidor + RLS por `tenant_id` (migr 0198). El diálogo no es la defensa |
| SGE-00.06 Prevenir antes de informar | `cumple` | La consecuencia se muestra **antes** de ejecutar, no después |
| SGE-00.07 Estado visible y verdadero | `cumple` | `pending` bloquea doble ejecución; el error de la acción queda **dentro** del diálogo y no se anuncia éxito antes del resultado |
| SGE-00.08 Frecuencia ↔ pasos | `cumple` | Borrar una dirección es episódico, no un flujo frecuente. El paso agregado está justificado por el riesgo |
| SGE-00.09 Mismo patrón | `cumple` | Usa `ConfirmDialog`, el `canonical` del registro CMP-01; cero primitivas nuevas |
| SGE-00.10 Accesible | `cumple` | Heredado de `ConfirmDialog`: `role="dialog"`, `aria-modal`, focus trap y restauración, Esc cierra, foco inicial en Cancelar por ser destructivo |
| SGE-00.11 Lenguaje | `cumple` | La confirmación expresa la consecuencia; el color no es el único portador (el texto lo dice) |
| SGE-00.12 IA | `no aplica` | No interviene IA |

**El `no cumple` de SGE-00.04 es un bloqueador constitucional** (SGE-00 §5). Se
registra como deuda **preexistente y de alcance mayor que este cambio**: ninguna
de las tres acciones de direcciones audita hoy, ni acá ni en el portal. Cerrarla
requiere decidir el evento de auditoría de la familia completa, que es AUD-01 y
un SDD propio.

## Verificación

- `pnpm verify` (cierre canónico: typecheck, lint, tests, gobernanza,
  componentes, docs).
- Prueba manual con sesión del Studio: abrir la ficha de un cliente con dos
  direcciones, intentar borrar la predeterminada, leer la consecuencia, cancelar
  con Esc y confirmar que sigue ahí.

## Lo que queda abierto

1. **Auditoría del borrado** (SGE-00.04) — no se resuelve acá.
2. **El gemelo del portal** — mismo defecto, misma tabla, superficie del cliente.
3. **Restauración** — MP-01 MP-D2 define ventanas de restauración (0–10 s,
   0–30 días, 31–90 días) que el producto **no implementa** para esta entidad.
