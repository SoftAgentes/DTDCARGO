---
sdd: 0266
title: La cabecera de Clientes deja de competir consigo misma
status: in-progress
author: Claude (ventana 2026-08-14)
created: 2026-08-14
updated: 2026-08-14
supersedes: null
superseded_by: null
related: [0246, 0258, 0263, 0265]
confidencialidad: interna
---

# SDD-0266 · La cabecera de Clientes deja de competir consigo misma

## Problema

[`ClientsClient.tsx`](<../../../app/studio/(app)/clientes/_components/ClientsClient.tsx>)
tenía tres controles en el mismo renglón:

```
[ Posibles duplicados ]  [ Códigos del legado ]  [ + Nuevo cliente ]
      ghost                    ghost                  primario
```

BTN-01 v1.1 §4, fila **Header de página**: *"Navegación/terciarias primero;
secundarias después; primaria al extremo derecho. **Acciones raras pasan al
menú.**"*

Fusionar duplicados (SDD-0246) y migrar códigos del legado (SDD-0258) son
mantenimiento episódico. Ocupaban permanentemente el mismo peso visual que la
única acción que un comercial usa todos los días.

Es el hallazgo ⭐1 de la
[auditoría del módulo](../../design/studio/2026-08-14-auditoria-ui-pro-clientes.md),
y el que originó la revisión: *"no me gusta cómo está actualmente el menú"*.

### Los destinos eran callejones sin salida

| | `/clientes/duplicados` | `/clientes/migrar-legado` |
|---|---|---|
| Enlace de vuelta | **ninguno** | **ninguno** |
| Entrada en el nav lateral | **ninguna** | **ninguna** |
| Migaja | decía "Comercial" | decía "Clientes" |

Se entraba por un botón gris, se llegaba a una página que no está en el menú
lateral, y ahí no había manera de volver dentro de la página.

## Alcance

| # | Cambio | Archivo | Política |
|---|---|---|---|
| 1 | Las dos acciones raras pasan a un `ActionMenu` etiquetado **"Mantenimiento"**; la primaria queda sola | `ClientsClient.tsx:139-168` | **BTN-01 §4** |
| 2 | Enlace **"← Clientes"** en las dos sub-páginas | `DuplicadosClient.tsx` · `MigrarLegadoClient.tsx` | SGE-00.08 |
| 3 | Migaja consistente: las dos dicen **"Clientes"** | ídem | VIS-01 |
| 4 | `ActionMenu` acepta opciones que **navegan** | `ActionMenu.tsx` | **BTN-01 §2** |
| 5 | `ActionMenu` pasa a **`canonical`** en CMP-01 | `action-menu.json` | **CMP-01** |

## El primer consumidor destapó un hueco de la API

`ActionMenu` nació sólo con `onSelect`, o sea **botones**. Pero "Posibles
duplicados" y "Códigos del legado" son **rutas**.

Meterlas como `onSelect: () => router.push(...)` habría sido un botón disfrazado
de enlace — justo lo que **BTN-01 §2** separa:

> Un botón **ejecuta una acción o cambia el estado**; un enlace **navega a un
> recurso o ubicación**. La apariencia no cambia esa semántica.

Un botón que navega rompe cosas concretas: no se puede abrir en pestaña nueva, no
se puede copiar el enlace, y el lector de pantalla lo anuncia como botón.

Así que el tipo ahora obliga la distinción:

```ts
| (OpcionBase & { onSelect: () => void | Promise<void>; href?: never })
| (OpcionBase & { href: string; onSelect?: never })
```

**`href` renderiza `<a>`; `onSelect` renderiza `<button>`. No se pueden pasar los
dos** — lo impide el tipo, no una convención.

Dos detalles que salieron de ahí:

- **Al navegar NO se devuelve el foco al trigger.** La página cambia y el foco
  viaja con ella; devolverlo pelearía con el enrutador. En las de ejecutar sí se
  devuelve.
- **Un `href` deshabilitado vuelve a `<button>`**, porque un `<a>` con
  `aria-disabled` sigue siendo navegable con Enter. Se probó.

Esto es exactamente para lo que existe el estado `proposed` de CMP-01: *"API y
documentación listas para prueba en uno o dos consumidores"*. El consumidor probó
la API y encontró lo que faltaba.

## Promoción a `canonical`

CMP-01 exige para promover: *"revisión de diseño, teclado/lector, mobile/dark,
tests y al menos un consumidor verificado"*.

| Requisito | Evidencia |
|---|---|
| Teclado y foco | 21 pruebas; 8 mutaciones muertas (SDD-0263) |
| Lector de pantalla | roles, `aria-haspopup`, `aria-expanded`, `aria-disabled` y nombres bajo prueba |
| Claro / oscuro | contraste medido en los dos temas del Studio; todo el texto pasa AA |
| Tests | `ActionMenu.test.tsx` |
| **Consumidor verificado** | **`ClientsClient.tsx` — este SDD** |
| Revisión de diseño | founder, 2026-08-14 |

⚠️ **Sigue sin reducirse a un número:** el panel usa `--bg-surface`, el mismo
relleno que la card sobre la que flota; lo separan el borde (1,25:1) y la sombra.
Una sombra no se mide como razón de contraste. Se promueve **con eso declarado**,
no escondido.

## Criterios de aceptación

1. La cabecera tiene **una sola** acción primaria visible.
2. Las dos tareas de mantenimiento siguen alcanzables, ahora desde el menú.
3. Las dos opciones del menú son `<a href>` reales: se abren en pestaña nueva y
   se puede copiar el enlace.
4. Las dos sub-páginas tienen enlace de vuelta y migaja "Clientes".
5. `ActionMenu` figura `canonical` con **un** consumidor verificado.
6. `pnpm typecheck`, `pnpm lint`, `pnpm test`; `node scripts/verify.mjs`.

## Fuera de alcance

| | Por qué |
|---|---|
| Migrar los 5 menús a mano | Cada uno es un slice con su riesgo (SDD-0263). |
| Entrada en el nav lateral para las sub-páginas | El nav se alimenta de `lib/studio/modules.ts` y sumar hojas ahí cambia RBAC y el buscador. Es otro SDD. |
| Los hallazgos 4, 5 y 6 de la auditoría | La tabla sin semántica, `aria-busy` del módulo y el drawer a mano. Independientes. |

## Gobernanza

| Control | Valor |
|---|---|
| Políticas | **BTN-01 v1.1 §2 y §4** · **CMP-01 v1.1** · SGE-00.08 y .09 — aprobadas |
| Clasificación | **no conformidad** → corregida |
| Componente | `ActionMenu` — pasa `proposed` → **`canonical`** |
| ¿Suma consumidores a un `deprecated`? | **No** |
| Aprobación de la promoción | founder, 2026-08-14 (CMP-01: un script nunca aprueba una promoción) |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Esconder una tarea en un menú la vuelve invisible | Son mantenimiento episódico, no trabajo diario. BTN-01 §4 lo prescribe justamente para este caso. El trigger dice "Mantenimiento", no "···". |
| Un `href` deshabilitado sigue navegando con Enter | Vuelve a `<button>` cuando está deshabilitado. Probado. |
| Se promueve a `canonical` con evidencia incompleta | La tabla de promoción lista la evidencia una por una, y declara lo que no se pudo medir. |
