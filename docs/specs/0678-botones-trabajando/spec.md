---
sdd: "0678"
title: "Botones que muestran que están trabajando: «Guardando…», sin doble envío y con la confirmación a la vista"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
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

## 3. Fase 1 (esta PR): la revisión de la oficina

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

### 3.3 Aceptación

| # | Criterio | Evidencia |
|---|---|---|
| A1 | Mientras corre, el botón dice «Guardando…», con spinner, deshabilitado y `aria-busy` | `FormularioAccion.test.tsx` |
| A2 | No se puede cambiar «Cumple»/«Falló» a mitad; viaja lo marcado | idem |
| A3 | Doble clic y doble `submit` envían una vez | idem |
| A4 | Si la acción falla, el formulario se libera | idem |
| A5 | Con Aprobar/Rechazar, solo el tocado dice «Guardando…» | idem |
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

## 6. Pendientes para la fase 2 (de la revisión independiente del 2026-11-18; no se implementan aquí)

1. Región `aria-live` que anuncie «Guardando…»: hoy el lector lo sabe por `aria-busy` y el texto del botón, pero
   no hay un anuncio explícito como el de `ActionButton`.
2. Foco al deshabilitar: si el botón con foco queda `disabled`, el navegador puede soltar el foco. Evaluar
   `aria-disabled` + bloqueo por candado en vez de `disabled`, manteniendo el bloqueo de los campos.
3. Pruebas que faltan: reapertura del candado tras una excepción (con el formulario aún montado) y desmontaje a
   mitad de la acción (que el efecto no actúe sobre un componente desmontado).
4. Pérdida del motivo escrito cuando la acción vuelve con error: React reinicia el formulario tras la acción.

## 7. Fuera de alcance

- Cambiar las acciones de la oficina a `useActionState` (resultado por tarjeta). La tarjeta de cierre desaparece al
  registrarse, así que el resultado tiene que vivir fuera de ella; el aviso arriba, con foco, lo cubre.
- El borrado del motivo escrito cuando la acción vuelve con error (pendiente 4 de §6).
