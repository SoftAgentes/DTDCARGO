---
sdd: "0678"
title: "Botones que muestran que están trabajando: «Guardando…», sin doble envío y con la confirmación a la vista"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-19
supersedes: null
superseded_by: null
related: ["0626", "0603", "0628"]
confidencialidad: interno
---

# SDD-0678 — Botones que muestran que están trabajando

> Pedido de Sam el 2026-11-18, empezando por la oficina. Fase 1 implementada en esta PR. Fase 2: solo inventario.
> Sin migración, sin datos de producción y sin PII.
> Etiquetas: **C** código leído · **M** medido · **I** inferencia · **NV** sin verificar.

## 1. Problema

En la revisión de la oficina (`/studio/admin/oficina`, tanda 1 de la SDD-0626), Sam marcó «Cumple» en los cierres de
las conversaciones 27 y 30 desde el móvil, y quedaron guardados como «Falló». La #25 quedó aprobada por error. Los
datos ya se corrigieron con la 0567 (SDD-0626). **M** (reporte de Sam, 2026-11-18).

Hipótesis, **NV**: el botón no mostraba que estaba guardando, así que se tocó otra vez o se cambió la opción antes de
que terminara la acción. Lo que sí se ve en el código (**C**):

| Hecho | Dónde |
|---|---|
| `TarjetaCierre` y `TarjetaBorrador` usaban `<form action>` con `<button type="submit">` crudo: sin estado pendiente, sin deshabilitar nada | `app/studio/(app)/admin/oficina/_components/*.tsx` (antes de esta PR) |
| Las acciones terminan con `redirect(?r=código)` y el resultado se pintaba como un párrafo **arriba** de la página | `actions.ts`, `page.tsx` |
| El aviso solo decía «Cierre registrado.»: no decía de qué conversación ni qué se guardó | `page.tsx` (`AVISOS.ok_cierre`) |
| Dos cierres seguidos dejaban el mismo `?r=ok_cierre`: el aviso no cambiaba | `actions.ts` |

En el móvil, la tarjeta de cierre queda al final de la lista; el aviso, arriba y fuera de la pantalla. **I**: Sam no
tenía cómo ver que el envío seguía en curso ni qué había quedado guardado.

## 2. Lo que ya existía

- `ActionButton` (`app/studio/_components/ui/ActionButton.tsx`): botón suelto con `onClick`, spinner, deshabilitado y
  `aria-busy`. **No sirve para `<form action>` con `type="submit"`**: es `type="button"`. **C**
- `AbrirButton` / `EntrarButton` del portal usan `useFormStatus` en un botón hijo del formulario. **C**
- CSS: `.studio-btn[aria-busy="true"]` (en progreso, no apagado) y `.studio-spin`. **C**
- `<Aviso>` (SDD-0628) con `tabIndex` y `ref` para llevarle el foco. **C**

## 3. Fase 1 (#695, fusionada): la revisión de la oficina

### 3.1 Componente nuevo del Studio: `FormularioAccion` + `BotonEnvio`

`app/studio/_components/ui/FormularioAccion.tsx`, para que la fase 2 lo extienda:

1. `FormularioAccion` envuelve `<form action>` y mete su contenido en un `<fieldset disabled>` mientras la acción
   corre (`useFormStatus`). Así **nada** del formulario se toca a mitad: ni el botón ni la opción marcada ni el motivo.
2. Candado de doble envío en `onSubmit` (ref): un segundo `submit` antes de que React pinte el pendiente se descarta.
   Se abre cuando la acción termina, bien o mal.
3. `BotonEnvio` (`type="submit"`): mientras corre, el botón tocado dice «Guardando…» (o `textoPendiente`) con spinner y
   `aria-busy="true"`; con varios botones (`name`/`value`), solo el tocado lo dice y los demás quedan deshabilitados.
4. Los valores viajan bien: el `FormData` se arma en el evento `submit`, antes de deshabilitar el fieldset.

### 3.2 La pantalla

- `TarjetaCierre` y `TarjetaBorrador` usan `FormularioAccion` y `BotonEnvio` (mismas clases y textos de antes).
- La acción de cierre vuelve con `c` (conversación) y `v` (lo guardado); todas vuelven con `n`, distinto en cada envío.
- `AvisoResultado` (cliente) pinta el resultado con `<Aviso>` (éxito o error), **se desplaza hasta él y toma el foco**
  al llegar, también en el móvil, y se repite en cada envío. El cierre dice qué quedó:
  «Cierre de la conversación 27 registrado: Cumple.» Un error de cierre dice de qué conversación era.
- Los helpers puros del aviso (`tonoDelResultado`, `detalleDelCierre`) viven en `_components/resultado.ts`, sin
  `"use client"`, porque los usa `page.tsx` (servidor): `scripts/check-rsc-boundary.mjs` lo exige.
- `c` solo se acepta con la forma del número de conversación de la acción (`^[0-9a-f-]{1,40}$`); React escapa el resto.

5. **Ancho estable (BTN-01 §5):** las dos etiquetas («Aprobar» y «Guardando…» con spinner) ocupan la misma celda
   de una rejilla y la que no se ve queda con `visibility: hidden`. El botón mide siempre lo que la más ancha: no
   crece ni encoge al cambiar de estado. Medido en Chrome headless con `studio.css` y `tokens.css` (2026-11-18):
   «Aprobar» primario 140,06 px en reposo y 140,06 px mientras corre; «Rechazar» 140,06 / 140,06; «Registrar el
   cierre» 144,48 / 144,48. **M**

### 3.3 Aceptación

| # | Criterio | Evidencia |
|---|---|---|
| A1 | Mientras corre, el botón dice «Guardando…», con spinner, deshabilitado y `aria-busy` | `FormularioAccion.test.tsx` |
| A2 | No se puede cambiar «Cumple»/«Falló» a mitad; viaja lo marcado | idem |
| A3 | Doble clic y doble `submit` envían una vez | idem |
| A4 | Si la acción falla, el formulario se libera | idem |
| A5 | Con Aprobar/Rechazar, solo el tocado dice «Guardando…» | idem |
| A5b | El botón conserva el ancho entre reposo y «Guardando…» (BTN-01 §5) | `FormularioAccion.test.tsx` (estructura) + medida de §3.1.5 |
| A6 | El resultado se ve y dice qué se guardó, con foco y desplazamiento | `AvisoResultado.test.tsx` |
| A7 | Las pruebas que ya existían de la oficina siguen verdes | `lib/studio/oficina/__tests__`, `lib/studio/__tests__/oficina-*` |
| A8 | Smoke en el móvil por Sam en una base de prueba | **pendiente** (fuera de esta PR) |

## 4. Fase 2 (solo inventario, no se implementa aquí)

Método: `grep` de `<form … action=` en `app/studio` y `app/m` (40 archivos), marcando si el archivo tiene
`useFormStatus`, una variable de pendiente o `ActionButton`. Es estático: **I** hasta abrir cada pantalla.

**Sin ningún estado pendiente (confirmado al leer el archivo, C):**

| Pantalla | Archivo | Riesgo |
|---|---|---|
| Operarios · desactivar | `app/studio/(app)/operarios/_components/OperariosClient.tsx` | Medio: interruptor que cambia estado |
| Móvil · cerrar sesión | `app/m/_components/SettingsMenu.tsx` | Bajo |
| Tracking · buscador | `app/studio/(app)/tracking/_components/BuscadorTracking.tsx` | No aplica: búsqueda, no muta |

**Tienen una variable de pendiente; falta comprobar que el botón la muestre (texto o spinner) y que deshabilite los
campos, no solo el botón (I):** `admin/_components/{ApiIntegrationSection,CompanySection,NumberingSection,PortalBackfillSection}`,
`admin/_components/calculator/{ParametrosPanel,TransportistasPanel}`, `admin/notificaciones/NotificationsClient`,
`admin/rutas/RoutesClient`, `bandeja/PortalChatwoot`, `bugs/BugDrawer`, `clientes/{AliadoCard,AliadoTarifaPanel,ShippingMarkChip}`,
`despacho/reglas/RulesClient`, `fidelizacion/RegisterReferralDrawer`, `fiscal/FiscalConfig`, `inspecciones/ReportEditor`,
`mailing/TemplateEditorDrawer`, `marketing/hub/BrandCatalogManager`, `proveedores/{ProviderLinkDrawer,ServiceRequestDrawer}`,
`tracking/[id]/{ShipmentDataPanel,ShipmentPlanPanel}`, `usuarios/{AgentesBandeja,InvitationsTable,UserDetailDrawer,ficha/RolYAlcanceCard}`,
`(auth)/login/LoginForm`, `_components/wiring/ProfileModal`, y en el móvil `m/emp/{PerfilTab,registro/RegistroForm}`,
`m/erp/MobileErpClient`.

**Fuera del inventario:** los botones con `onClick` que llaman una server action dentro de `startTransition` sin
`ActionButton`. No se pueden listar con `grep` sin falsos positivos; la fase 2 los busca pantalla por pantalla.

Regla propuesta para la fase 2 (**propuesta**, no decidida): todo `<form action>` del Studio que muta datos usa
`FormularioAccion` + `BotonEnvio`; todo botón suelto, `ActionButton`. Un contrato estático como
`fechas-contract.test.ts`, con la lista de pendientes congelada, evitaría que entren nuevos.

## 5. Allowlist exacta (fase 1)

| Archivo | Cambio |
|---|---|
| `app/studio/_components/ui/FormularioAccion.tsx` | nuevo: `FormularioAccion` y `BotonEnvio` |
| `app/studio/_components/ui/FormularioAccion.test.tsx` | nuevo: pendiente, deshabilitado, doble envío, reapertura, error, varios botones |
| `app/studio/(app)/admin/oficina/_components/TarjetaCierre.tsx` | usa `FormularioAccion` y `BotonEnvio` |
| `app/studio/(app)/admin/oficina/_components/TarjetaBorrador.tsx` | usa `FormularioAccion` y `BotonEnvio` |
| `app/studio/(app)/admin/oficina/_components/AvisoResultado.tsx` | nuevo (cliente): aviso con foco y desplazamiento |
| `app/studio/(app)/admin/oficina/_components/resultado.ts` | nuevo (servidor): `tonoDelResultado`, `detalleDelCierre` |
| `app/studio/(app)/admin/oficina/_components/AvisoResultado.test.tsx` | nuevo |
| `app/studio/(app)/admin/oficina/actions.ts` | el redirect lleva `c`, `v` y `n` |
| `app/studio/(app)/admin/oficina/page.tsx` | pinta `AvisoResultado` y valida `c` |
| `docs/specs/0678-botones-trabajando/spec.md` | nuevo |
| `docs/specs/README.md` | índice generado (`pnpm docs:index`) |
| `.agents/handoffs/botones-trabajando-0678.md` | handoff del Worker |

No cambia permisos, RLS, migraciones, datos ni el ciclo de agentes. `app/studio/CLAUDE.md` no se toca en la fase 1.

## 6. Conformidad con BTN-01 v1.1 y LOD-01 v1.0

Clasificación del AGENT-BRIEF sobre lo que toca esta PR. «Preexistente» es lo que ya estaba así antes de la PR y no
se cambia aquí.

| Política · regla | Resultado | Evidencia |
|---|---|---|
| BTN-01 §2 · todo botón declara `type` | cumplimiento | `BotonEnvio` es `type="submit"` |
| BTN-01 §2 · una sola primaria por bloque | cumplimiento | borrador: solo «Aprobar» es `primary`; cierre: ninguna primaria (se mantiene la clase de antes) |
| BTN-01 §3 · vocabulario | cumplimiento | «Registrar el cierre» asienta un hecho; «Aprobar»/«Rechazar» deciden dentro de un flujo y el rechazo guarda motivo |
| BTN-01 §1 y §2 · el destructivo no comparte borde con el positivo; «Rechazar con consecuencia» usa `danger` | no conformidad preexistente | «Rechazar» va junto a «Aprobar» (8 px) y en la variante base. Esta PR no lo cambia; pasa a la fase 2 (§7.5) |
| BTN-01 §5 · Loading: bloquea repetición, conserva ancho, verbo en progreso y `aria-busy` | cumplimiento | §3.1 puntos 1, 2, 3 y 5; A1, A3 y A5b |
| BTN-01 §5 · Pressed: respuesta inmediata sin fingir que terminó | cumplimiento | «Guardando…» hasta que vuelve la acción; el éxito llega después, en el aviso |
| BTN-01 §5 · Disabled: no ejecuta y explica el motivo | cumplimiento | mientras corre, el botón vecino queda deshabilitado y el motivo está a la vista en el botón tocado («Guardando…») |
| BTN-01 §5 · Success solo después del resultado durable | cumplimiento | el aviso sale del `redirect` posterior a la escritura en la base |
| BTN-01 §5 · Error: no anuncia éxito y devuelve el control | cumplimiento | aviso `role="alert"` con la causa; el candado se abre (prueba de reapertura y de excepción) |
| BTN-01 §5 · Focus visible 3:1 | no aplica | no cambia: `.studio-btn:focus-visible` |
| BTN-01 · foco cuando el botón enfocado pasa a `disabled` | no aplica (BTN-01 no lo regula); riesgo abierto de A11Y-01 | el navegador puede soltar el foco. Se estudia `aria-disabled` en la fase 2 (§7.2). No se declara excepción: eso lo aprueba Sam |
| LOD-01 · mutación desde botón: spinner y texto dentro del botón, bloquea repetición | cumplimiento | §3.1 |
| LOD-01 · success solo después del resultado durable | cumplimiento | igual que BTN-01 §5 |
| LOD-01 · el error sustituye la espera, con reintento; nunca spinner infinito | cumplimiento | pruebas «el candado se abre y se puede reintentar» y «si la acción lanza … no queda colgado» |
| LOD-01 · `aria-busy` en el área relevante | cumplimiento | `aria-busy` en el fieldset del formulario y en el botón tocado |
| LOD-01 · skeleton, progreso medible, optimista, pestaña oculta | no aplica | la acción es una mutación corta sin avance medible |

## 7. Pendientes para la fase 2 (de la revisión independiente del 2026-11-18; no se implementan aquí)

1. Región `aria-live` que anuncie «Guardando…»: hoy el lector lo sabe por `aria-busy` y el texto del botón, pero
   no hay un anuncio explícito como el de `ActionButton`.
2. Foco al deshabilitar: si el botón con foco queda `disabled`, el navegador puede soltar el foco. Evaluar
   `aria-disabled` + bloqueo por candado en vez de `disabled`, manteniendo el bloqueo de los campos.
3. Pruebas que faltan: reapertura del candado tras una excepción (con el formulario aún montado) y desmontaje a
   mitad de la acción (que el efecto no actúe sobre un componente desmontado).
4. Pérdida del motivo escrito cuando la acción vuelve con error: React reinicia el formulario tras la acción.
5. «Rechazar» de la oficina: separarlo de «Aprobar» y pasarlo a `danger` (BTN-01 §1 y §2; no conformidad
   preexistente, §6).

## 8. Fuera de alcance

- Cambiar las acciones de la oficina a `useActionState` (resultado por tarjeta). La tarjeta de cierre desaparece al
  registrarse, así que el resultado tiene que vivir fuera de ella; el aviso arriba, con foco, lo cubre.
- El borrado del motivo escrito cuando la acción vuelve con error (pendiente 4 de §7).

## 9. Fase 2 · PR A (2026-11-19): el pie de los drawers y los botones sin ningún estado

Orden aprobado por el DG el 2026-11-19, sobre el inventario estático del 2026-11-19 (notas del DG,
`sdd-0678-f2-inventario-botones-20261119.md`). El inventario es **I**: un escaneo del código, no de la pantalla.

### 9.1 Cambios

- `EtiquetaEstable` (nuevo, `app/studio/_components/ui/EtiquetaEstable.tsx`): la rejilla de dos etiquetas de la fase 1
  sale de `BotonEnvio` a un componente propio, para reutilizarla. `BotonEnvio` la usa sin cambio de conducta.
- `DrawerFooter` (`app/studio/_components/ui/drawer/DrawerShell.tsx`), el submit de **66 archivos**: ya deshabilitaba
  y cambiaba el texto. Ahora además tiene `aria-busy`, spinner y conserva el ancho. Deshabilitado por validación
  (`canSubmit=false`) no se anuncia como trabajando.
- Operarios · desactivar (`operarios/_components/OperariosClient.tsx`): el interruptor iba en un `<form action>` sin
  ningún estado. Ahora va en `FormularioAccion` (bloqueo y candado de doble envío) y, mientras corre, queda
  deshabilitado con `aria-busy`, spinner en la perilla y nombre «Desactivando a …». El ancho es fijo (38 px).
- Inspecciones · eliminar foto (`inspecciones/_components/PhotoManager.tsx`): la × llamaba al servidor sin ningún
  estado y **callaba el error**. Ahora usa `useTransition`: deshabilitada, `aria-busy`, spinner y «Eliminando foto…»;
  si falla, un aviso dice «No se pudo eliminar la foto: …» (LOD-01).
- Libro diario · CSV (`contabilidad/_components/LibroDiarioTab.tsx:578`): **no aplica**. Es un `<form method="get">`
  a `/api/studio/contabilidad/export`, una descarga que no muta nada. No se toca.

### 9.2 Conformidad (BTN-01 §5 y LOD-01)

| Pieza | Deshabilita | `aria-busy` | Verbo en progreso | Conserva ancho | Error visible |
|---|---|---|---|---|---|
| `DrawerFooter` | cumplimiento (ya estaba) | cumplimiento | cumplimiento (ya estaba) + spinner | cumplimiento | no aplica: lo muestra cada drawer |
| Operarios · desactivar | cumplimiento | cumplimiento | cumplimiento (nombre accesible y `title`) | cumplimiento (38 px fijos) | no conformidad preexistente: la acción no devuelve error a la fila; pendiente §10.2 |
| Inspecciones · eliminar foto | cumplimiento | cumplimiento | cumplimiento (nombre accesible y `title`) | cumplimiento (24 px fijos) | cumplimiento (aviso nuevo; también si la acción RECHAZA: `try/catch` con mensaje genérico, para que no suba al límite de errores de React 19) |

### 9.2b Medida del ancho del submit (Chrome headless, 2026-11-19)

Con `studio.css` y `tokens.css` reales, ancho en px del submit primario (reposo / «Creando…»). **M**

| Etiqueta | Antes (reposo / en curso) | Ahora (reposo / en curso) |
|---|---|---|
| «Guardar» | 85,4 / 101,7 | 123,7 / 123,7 |
| «Crear» | 69,0 / 101,7 | 123,7 / 123,7 |
| «Guardar cambios» | 141,4 / 101,7 | 141,4 / 141,4 |
| «Crear y dejar abierta» | 161,6 / 101,7 | 161,6 / 161,6 |
| «Registrar recepción y emitir comprobante» | 290 / 101,7 | 290 / 290 |

El botón ya no cambia de ancho al trabajar (antes saltaba hasta 188 px). El **costo**: una etiqueta corta («Guardar»,
«Crear») queda en el ancho de «Creando…» con spinner (≈124 px) también en reposo: +38 a +55 px. Las largas no cambian en
reposo. En 375 px la más larga de la tabla (290) cabe sola; junto a «Cancelar» ya no cabía antes ni cabe ahora
(preexistente). El submit y «Cancelar» siguen en `flex` sin quiebre: `/ui-check` queda **NO EJECUTADO** en esta
PR (no se abrió el drawer real en el navegador; la medida es de un HTML con los estilos reales).

### 9.3 Allowlist exacta (PR A)

| Archivo | Cambio |
|---|---|
| `app/studio/_components/ui/EtiquetaEstable.tsx` | nuevo |
| `app/studio/_components/ui/FormularioAccion.tsx` | `BotonEnvio` usa `EtiquetaEstable` |
| `app/studio/_components/ui/drawer/DrawerShell.tsx` | `DrawerFooter`: `aria-busy`, spinner y ancho estable |
| `app/studio/_components/ui/drawer/DrawerFooter.test.tsx` | nuevo |
| `app/studio/(app)/operarios/_components/OperariosClient.tsx` | desactivar con `FormularioAccion` y estado |
| `app/studio/(app)/operarios/_components/OperariosClient.desactivar.test.tsx` | nuevo |
| `app/studio/(app)/inspecciones/_components/PhotoManager.tsx` | eliminar foto con estado y error visible |
| `app/studio/(app)/inspecciones/_components/PhotoManager.test.tsx` | nuevo |
| `docs/specs/0678-botones-trabajando/spec.md` | esta sección |
| `.agents/handoffs/botones-trabajando-0678-f2a.md` | handoff |

No cambia permisos, RLS, migraciones ni datos. No toca `usuarios/_components/AgentesBandeja.tsx` (SDD-0680).

## 10. Fase 2 · lo que sigue (orden aprobado por el DG)

1. PR B: los 22 destructivos sin `danger`, con su copy (incluye el «Rechazar» de la oficina, §7.5).
2. Operarios: que desactivar devuelva el error a la fila (hoy la acción no lo muestra).
3. PR C y siguientes: los 102 B2 del inventario, por módulo, empezando por admin.
4. Al final, un contrato estático con la lista congelada.
