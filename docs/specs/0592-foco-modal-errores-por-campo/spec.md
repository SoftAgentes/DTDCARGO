---
sdd: "0592"
title: "El foco no se sale del modal durante el envío ni con errores por campo"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-11-02
updated: 2026-11-02
supersedes: null
superseded_by: null
related: ["0537", "0290"]
confidencialidad: interno
---

# SDD-0592 · El foco no se sale del modal

## Pedido

Sam, 2026-11-02, literal: «Haz esta tarea aquí: "Que el foco no se salga del modal con errores por campo"».

Sale de la corrección de SDD-0537 (PR #349), que devolvió el foco al aviso general con un error repetido y dejó anotado este caso.

## Estado medido antes del cambio

Medido en Chrome 152 (panel de Claude Desktop) con ratón y teclado reales, los componentes reales y acciones simuladas, sin producción ni base.

| Situación | Foco | Tab |
|---|---|---|
| `TruckDrawer` (flota, fuera de la calculadora), sólo errores por campo, primer intento | `body` | un botón detrás del modal |
| `TruckDrawer`, durante un envío lento | `body` | un botón detrás del modal, y al terminar el foco sigue ahí |
| `TariffDrawer`, sólo errores por campo, primer intento | `body` | un botón detrás del modal |
| `CityDrawer`, sólo errores por campo, primer intento | `body`, y 0 campos marcados con `aria-invalid` | un botón detrás del modal |
| `ConfirmDialog`, error del servidor | `body` | un botón detrás del modal |

**Causa.** Son dos cosas juntas:

1. El control enfocado se deshabilita durante el envío (`DrawerFooter`, `DrawerShell.tsx:198`, y botones propios) y el navegador suelta el foco a `body`. Nada lo devuelve si la respuesta no trae un aviso general.
2. La trampa de `useDialogA11y` sólo actúa con el foco en el primer o último control. Con el foco en `body` no hace nada, y Tab sigue por la página de detrás.

jsdom no reproduce el punto 1: deja el foco en el botón deshabilitado. Por eso ninguna prueba lo vio.

## Decisión

**Reparar en `useDialogA11y`, no en cada panel.** El origen es uno, y lo heredan los consumidores del hook. Hay unos 25 usos directos y 110 archivos con `DrawerShell`. Repararlo panel por panel sería un barrido, y el siguiente panel nuevo volvería a fallar.

1. **Tab con el foco perdido** va al primer control del panel, y con Mayús al último.
2. **Al terminar `pending` con el foco perdido**, el foco vuelve al panel. Va al primero que pueda recibirlo de estos:
   1. El primer campo con `aria-invalid="true"`, porque ERR-01 pide que el primer error bloqueante reciba foco.
   2. Donde estaba la persona, incluido el foco inicial del diálogo.
   3. El panel.
3. **`CityDrawer` marca `aria-invalid`** en sus cuatro campos. Sin eso, el punto 2 no podía llevar el foco al campo con error.

**«Perdido» es sólo `body`, ningún elemento activo, o un control deshabilitado.** Es el límite que hace seguro tocar un hook compartido: quien tiene el foco en un control válido no lo pierde, tampoco en un menú flotante en un portal. Por eso se usa esta condición y no «fuera del panel».

**El aviso del panel gana.** Si el panel enfoca su propio aviso, su efecto corre después del hook (`DrawerShell` es hijo), o bien el hook ya no encuentra el foco perdido (uso directo). Medido: 1 ms después de que el hook devuelve el foco, el aviso lo recibe.

### Lo que no cambia

- El botón se sigue deshabilitando durante el envío.
- Escape sigue respetando `pending`.
- No cambia ningún texto, apariencia ni acción.
- La API del hook no cambia.

### Descartado

- **Dejar de deshabilitar el botón** (`aria-disabled`): tocaría el contrato anti-doble envío de BTN-01 en todo el Studio.
- **Mover siempre el foco al primer campo con error**, aunque no esté perdido: le quitaría el foco a quien ya pasó a otro campo durante el envío.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| A11Y-01 | **no conformidad → corregida** en la trampa | Punto 2, el foco «no queda oculto» (`a11y-01.md:15`); el foco pasaba a controles detrás de un `aria-modal`. |
| ERR-01 | **no conformidad → corregida en parte** | «El primer error bloqueante recibe foco» (`err-01.md:28`). Corregida cuando el foco se pierde y el campo lleva `aria-invalid`. Queda abierta en los dos casos de «Límites». |
| FRM-01 | **no conformidad → corregida en parte** | Misma regla (`frm-01.md:25`), con el mismo alcance. |
| CMP-01 | cumplimiento | Ningún componente nuevo ni `deprecated`; no cambia la API. `components:check` en verde. |
| BTN-01 | no aplica | El estado de los botones no cambia. |
| AVS-01 | no aplica | No hay avisos ni anuncios nuevos. |
| Resto | no aplica | Sin mutaciones, permisos, datos, migraciones ni cambios visuales. |

## Allowlist

- `app/studio/_components/ui/drawer/useDialogA11y.ts`
- `app/studio/_components/ui/drawer/useDialogA11y.test.tsx` (nuevo)
- `app/studio/(app)/admin/_components/calculator/CityDrawer.tsx` (sólo `aria-invalid`)
- `app/studio/(app)/admin/_components/calculator/__tests__/CityDrawer.test.tsx`
- `app/studio/(app)/admin/_components/calculator/__tests__/TransportistasPanel.test.tsx`
- `docs/specs/0592-foco-modal-errores-por-campo/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/sdd-0592-foco-modal-errores-por-campo.md`

## Aceptación

1. Con el foco perdido, Tab y Mayús+Tab no salen del panel, también durante el envío.
2. Al terminar el envío con el foco perdido, va al primer campo con `aria-invalid`; si no hay, a donde estaba la persona; si no se puede, al panel.
3. Quien tiene el foco en un control válido no lo pierde, dentro o fuera del panel.
4. Si el panel enfoca su propio aviso, el aviso se queda con el foco.
5. Un diálogo que no está encima no se disputa el foco.

## Verificación (2026-11-02, en el worktree; sin producción)

Después del cambio, en el mismo navegador:

| Situación | Foco | Tab |
|---|---|---|
| `TruckDrawer`, sólo errores por campo | «Agregar camión», donde estaba | «Cerrar», dentro del panel |
| `TruckDrawer`, durante un envío lento | `body` hasta pulsar Tab | primer control; Mayús+Tab, el último |
| `TariffDrawer`, sólo errores por campo | primer campo con error | el siguiente campo, dentro del panel |
| `CityDrawer`, sólo errores por campo | primer campo con error (3 marcados) | no se volvió a medir; sí tras un error general: «Cerrar», dentro del panel |
| `CityDrawer`, error general | el aviso | no medido en este paso |
| `ConfirmDialog`, error del servidor | «Cancelar», donde estaba | cicla entre sus dos botones |

Pruebas y mutantes: en el handoff.

## Límites

- **Lector de pantalla:** no se probó con uno.
- **Studio real:** no se probó con sesión y server actions reales; las acciones son simuladas.
- **Otros navegadores:** sólo Chrome. La condición cubre también el navegador que deja el foco en el botón deshabilitado, pero eso se probó sólo en jsdom.
- **Paneles medidos:** cuatro. Los demás heredan el arreglo por usar el hook, sin medición individual.
- **ERR-01 sigue abierto en dos casos**, porque ahí el foco no se pierde o no hay campo marcado:
  1. Con Enter desde un campo de texto, el foco se queda en ese campo aunque el error esté en otro (medido en `TariffDrawer`). Sigue dentro del panel, y hace falta el patrón de `PaymentReportForm.tsx:76-82` panel por panel.
  2. Los paneles que no marcan `aria-invalid` devuelven el foco al botón, no al campo (medido en `TruckDrawer`). De los 110 archivos con `DrawerShell`, 9 lo llevan en el propio archivo; otros podrían heredarlo de campos compartidos, y eso no se contó.

## Estado

Implementada en la PR de esta spec, sin fusionar. `pnpm verify` y la suite completa dependen del turno del Director.
