---
sdd: "0603"
title: "Claridad de controles: qué se oprime, qué avisa y qué solo se lee"
status: proposed
author: "Claude"
created: 2026-11-04
updated: 2026-11-04
supersedes: null
superseded_by: null
related: ["0120", "0441"]
confidencialidad: interno
---

# SDD-0603 — Claridad de controles: qué se oprime, qué avisa y qué solo se lee

> En el Studio y el portal no se distingue un botón de un mensaje. Quien opera tiene que saber dónde oprimir sin leer cada palabra.

## Contexto

**Pedido de Sam, 2026-11-04, literal, en el chat de la sesión hija de Director General:**

- «estoy viendo los botones muy pálidos. O sea, entre saber qué oprimir y qué es mensaje»
- Sobre una captura del CRM: «Es una issue del CRM, adentro de eso, y se ve muy pálido. [...] La idea es que lo hagamos en todo el ERP completo, más que en la página web, en el ERP y en el portal del cliente.»
- Tras verlo en prueba, por botón: «Prepara la adopción». Por texto: «Me gusta. Prepara todo y adopción».

Cubre preparar. No cubre fusionar ni publicar: para fusionar, el Director General pide un OK aparte con el tramo a la vista.

**Causa medida** en el DOM, sobre la tarjeta o el panel, en claro y oscuro:

| Qué | Antes | Después |
|---|---|---|
| Contorno del botón secundario (mínimo 3:1) | 1,48 / 1,54 | 16,49 / 13,08 |
| Contorno de un campo (mínimo 3:1) | 1,48 / 1,54 | 5,33 / 6,86 |
| Botón `xs`, alto y letra | 24 px, 10,5 px | 32 px, 13 px |

Además, botones secundarios, avisos y estados compartían el mismo cajón claro con borde fino. `Badge` tenía la forma de un botón pequeño. Otros: `.studio-btn-warning` llevaba blanco sobre oro (3,14:1), y había tres colores inventados en hovers de botón.

**Verificado en prueba** con imágenes de `codex/rediseno-studio-prueba`, que no se fusiona nunca. Recorridas 43 rutas del Studio y 15 del portal con los datos tapados y sin escribir; todas respondieron HTTP 200. La medida de controles sin señal aplica a esa rama, no a este tramo.

## La regla

1. **Lo que se oprime** lleva relleno o contorno de tinta, sombra y un verbo.
2. **Lo que avisa** es una franja plana con icono, sin contorno ni sombra.
3. **Lo que solo se lee** es texto, sin cajón.

Las tarjetas conservan su borde suave: el contorno fuerte queda para lo oprimible. Solo tokens del sistema; ningún color nuevo.

## Decisión de marca pendiente

Cambia la apariencia respecto al Norte, que es la fuente de apariencia, así que pide decisión de Sam. Texto propuesto para `docs/design/studio/_norte/BRAND-DECISIONS.md`:

> **BD-037 · Claridad de controles (Studio y Portal).** Lo que se oprime lleva relleno o contorno de tinta; lo que avisa es una franja plana sin contorno; los estados son texto con icono, sin cajón. El vino queda para la acción principal y la identidad. La selección (pestaña, filtro) va con relleno de tinta; en el menú lateral, blanco con icono vino. Cada persona puede elegir la vista «Compacto»; nada que se oprima baja de 32 px.

**BRAND-CHECK.** VIS-01 §3 y BRAND §Estados asignan la selección al vino. Aquí va en tinta, porque un relleno vino en cada pestaña compite con la acción principal y rompe el límite de una acción E4 por contexto (VIS-01 §5). Sam vio esta versión en prueba. Sin su aprobación explícita del texto, este tramo no se fusiona.

## Tramos

AGENT-BRIEF prohíbe el barrido masivo: la adopción avanza por tramos, cada uno con su PR. Crear un componente nuevo sigue CMP-01 y puede pedir su propio SDD; lo asigna el Director.

| Tramo | Qué | Alcance |
|---|---|---|
| **1** | Piezas compartidas del Studio | Este documento |
| 2 | Portal del cliente | `.btn-ghost`, campos, estados, sub-pestañas, filtros y enlaces, solo bajo `.portal-sys` |
| 3 | Pestañas | Componente único; hoy hay 30 archivos con `role="tab"` y otros hechos a mano |
| 4 | Avisos | Componente único; 59 archivos pintan avisos con fondo de estado y 116 usan `role="alert"` |
| 5 | Filas y pantallas propias | «Abrir» en Embarques y Cobranzas, Dashboard, Contabilidad, Tracking, Almacén CN, Documentos y CRM |

**Fuera de Tramo 1, a propósito:** las pantallas del CRM, porque las tandas de Chatwoot pendientes trabajan ahí; y lo que en la rama de prueba se resolvió con `!important` y selectores sobre el estilo en línea. Esos atajos no se adoptan: los reemplazan los tramos 3 y 4.

**Consecuencia para Sam:** con solo el Tramo 1, las pestañas de la captura del CRM siguen como hoy; lo que cambia ahí son botones, campos, estados y menú lateral. Se arreglan en el Tramo 3.

## Tramo 1

### Allowlist

- `app/studio/studio.css`, `app/studio/tokens.css`
- `app/studio/_components/ui/`: `Badge.tsx`, `Badge.test.tsx`, `ErrorAlert.tsx`, `KpiCard.tsx`, `SegmentedControl.tsx`, `ActionMenu.tsx`, `drawer/DrawerShell.tsx`
- `app/studio/(app)/_components/`: `StudioSidebar.tsx`, `StudioTopbar.tsx`, `NotificationBell.tsx`, `ConversationsIndicator.tsx`, `DensityToggle.tsx`, `DensityToggle.test.tsx`
- `app/studio/_components/__tests__/claridad-controles-contract.test.ts`
- `app/studio/CLAUDE.md`, `docs/governance/components/segmented-control.json`, `docs/governance/generated/`
- `docs/specs/0603-claridad-controles/spec.md`, `docs/specs/README.md`, `.agents/handoffs/0603-claridad-controles.md`
- Al aprobarse la decisión: `BRAND.md`, `docs/design/studio/_norte/BRAND-DECISIONS.md`

Sin migraciones, rutas, acciones de servidor, permisos ni dependencias nuevas. No entran Tailwind, motion ni lenis.

### Aceptación

- El contorno del secundario y de los campos mide al menos 3:1 contra la tarjeta, en claro y oscuro. Lo vigila `claridad-controles-contract.test.ts`.
- El texto de cada botón con relleno mide al menos 4,5:1 en los dos temas.
- Nada que se oprima baja de 32 px, tampoco en la vista compacta.
- `Badge` no pinta fondo, relleno ni borde redondeado.
- «Compacto» se aplica al momento, se recuerda por navegador y comparte la preferencia de Administración › Apariencia (SDD-0120).
- Sin colores inventados en las reglas de botón.

### Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: el contorno sube los secundarios, y el primario sigue siendo el único relleno vino. |
| Acción dominante | Cumple: no cambia la cantidad de primarios. |
| Semántica de color | **Excepción propuesta:** selección en tinta. Ver BRAND-CHECK. |
| Contraste | Cumple: medido y vigilado por contrato. |
| Tokens | Cumple. Dos tokens nuevos de medida, `--sb-item-y` y `--kpi-fs`; ningún color. |
| Estados sin color | Cumple: `Badge` conserva texto e icono. |
| Light/dark | Cumple: el contrato corre en los dos. |
| Móvil | **No conformidad previa, sin resolver:** a 375 px el menú lateral del Studio ocupa casi toda la pantalla y el CRM desborda 145 px. Este tramo no cambia su ancho. |
| Movimiento reducido | Cumple: la transición es de color; `transform` de 1 px al oprimir. |

## Límites

- `pnpm verify` se corre con turno del Director.
- Sin PR hasta que el Director dé turno. La publicación a producción sigue congelada.
- `Badge` lleva letra de 12 a 13,5 px en lugar de 9,5 a 11,5, pero pierde su relleno lateral. Medido con Nunito Sans real: el estado más largo, «En bodega VE», pasa de 97,8 a 99,9 px en tamaño `sm`, y mide 107,2 px en `md`. No se midió pantalla por pantalla; se comprueba en prueba antes de fusionar.
