---
sdd: "0628"
title: "Aviso: componente único de avisos del Studio (tramo 4a de SDD-0603)"
status: in-progress
author: "Claude"
created: 2026-11-13
updated: 2026-11-13
supersedes: null
superseded_by: null
related: ["0603", "0441", "0183"]
confidencialidad: interno
---

# SDD-0628 — Aviso: componente único de avisos del Studio

> Un aviso se tiene que ver igual en todo el Studio: una franja plana con icono que no se confunda con un botón.

## Problema

BD-037 (SDD-0603) fija que **lo que avisa es una franja plana con icono, sin contorno ni sombra**, y BRAND §Estados (2026-09-05) fija cómo se pinta cada estado: información en tinta neutra (`--info`), atención en dorado, éxito con icono verde y texto neutro, error con el rojo localizado en el icono. Pero hoy cada pantalla pinta sus avisos a mano, con estilo en línea: fondos, bordes, tamaños e iconos distintos, y `role="alert"` puesto también en mensajes que no son urgentes.

El tramo 4 de SDD-0603 pide un componente único. Este documento es el **tramo 4a**: el componente, sus clases, su contrato y su registro CMP. La adopción en pantallas va después, en otras PR (4b, 4c, 4d), cuando este componente esté en `main`.

## Decisión

Un componente, `Aviso`, en `app/studio/_components/ui/Aviso.tsx`. `ErrorAlert` pasa a pintarse con él sin cambiar su API ni la de sus consumidores.

### API

```tsx
<Aviso
  tono="info" | "atencion" | "exito" | "error"   // por defecto "info"
  titulo?: ReactNode                              // en negrita, antes del mensaje
  accion?: { etiqueta: string; onClick: () => void; disabled?: boolean }
  urgente?: boolean                               // fuerza role="alert" fuera del error
  compacto?: boolean                              // drawers y menús densos
  id?: string
  className?: string
>
  Mensaje: qué ocurrió y qué puede hacer la persona (ERR-01).
</Aviso>
```

Exporta también `rolDeAviso(tono, urgente)` y los tipos `AvisoTono`, `AvisoAccion` y `AvisoProps`.

**Por qué la acción es un objeto y no un hueco libre.** La acción usa siempre el botón secundario que ya existe (`studio-btn studio-btn-ghost studio-btn-sm`, nivel 1 de la enmienda de elevación): es lo único oprimible de la franja y tiene que verse oprimible. Un hueco libre dejaría entrar un primario vino dentro de un aviso y rompería el límite de una acción principal por contexto (VIS-01 §5).

### Tonos

| Tono | Fondo | Icono (forma) | Color del icono | Texto |
|---|---|---|---|---|
| `info` | `--info-bg` | círculo con «i» | `--info` (tinta) | `--ink` |
| `atencion` | `--warning-bg` | triángulo con «!» | claro: `--ink` · oscuro: `--warning` | `--ink` |
| `exito` | `--success-bg` | círculo con visto | `--success` | `--ink` |
| `error` | `--danger-bg` | círculo con equis | `--danger-text` | `--ink` |

Cada tono tiene una **forma** de icono distinta (`StatusIcon`), así que el estado se entiende sin color. El título y el mensaje van siempre en tinta neutra.

**Cero colores nuevos.** Solo tokens que ya existen. Ni `tokens.css` ni la paleta cambian.

**Atención en claro.** El dorado `--warning` (#B8893A) mide 2,79:1 sobre su franja en la tarjeta, 2,68:1 sobre el fondo de página y 2,49:1 sobre la superficie elevada: no llega al 3:1 que pide un icono (A11Y-01 §3). BRAND §Estados resuelve ese caso: «un acento que no alcance contraste se usa decorativamente junto al icono neutro». En claro el icono va en tinta y el dorado queda en el fondo de la franja. En oscuro el dorado (#DCAB6B) mide 4,87:1 o más y vuelve al icono, **solo en pantalla** (`@media screen`): al imprimir, los tokens vuelven a claro y el icono también.

### Forma

Clases en `app/studio/studio.css`, bloque «Aviso · SDD-0628»: `.studio-aviso`, `.studio-aviso-cuerpo`, `.studio-aviso-titulo`, `.studio-aviso-accion`, `.studio-aviso-compacto` y el tono por `data-tono`.

- Franja plana: `border: 0`, `box-shadow: none`, esquinas `--r-md`. Nivel 0 de la tabla de elevación de SDD-0603.
- Icono alineado con la primera línea; el cuerpo crece y la acción baja de línea en pantallas angostas (`flex-wrap`), sin recorte.
- Ningún estilo de color en línea en `Aviso.tsx` ni en `ErrorAlert.tsx`. `StatusIcon` conserva su `flexShrink: 0` en línea, que no es color.

### Semántica ARIA

| Caso | `role` | Por qué |
|---|---|---|
| `error` | `alert` | Un fallo real interrumpe al lector (A11Y-01 §9, ERR-01). |
| `urgente` (cualquier tono) | `alert` | Atención que bloquea la tarea. |
| `info`, `atencion`, `exito` | `status` | El anuncio menos intrusivo que comunica el cambio (A11Y-01 §5). |

El icono es `aria-hidden`: el mensaje lo dice todo. La acción es un `<button type="button">` con su verbo como nombre accesible y se opera con teclado. El aviso no roba el foco: llevar el foco al primer error bloqueante (ERR-01) sigue siendo trabajo del formulario que lo muestra.

## Medidas de contraste

Calculadas sobre los tokens de `tokens.css`, con la franja translúcida compuesta sobre cada superficie donde vive un aviso. Mínimos: texto 4,5:1, icono 3:1. Las vigila `avisos-contract.test.ts`.

| Tema / tono | Texto (tarjeta · página · elevada) | Icono (tarjeta · página · elevada) |
|---|---|---|
| Claro / info | 14,47 · 13,96 · 12,87 | 14,47 · 13,96 · 12,87 |
| Claro / atención | 14,65 · 14,05 · 13,04 | 14,65 · 14,05 · 13,04 (tinta) |
| Claro / éxito | 14,55 · 14,00 · 12,92 | 3,83 · 3,68 · 3,40 |
| Claro / error | 14,15 · 13,56 · 12,48 | 5,65 · 5,41 · 4,98 |
| Oscuro / info | 10,36 · 13,10 · 9,19 | 10,36 · 13,10 · 9,19 |
| Oscuro / atención | 10,06 · 12,71 · 8,91 | 5,50 · 6,94 · 4,87 |
| Oscuro / éxito | 9,79 · 12,43 · 8,66 | 5,77 · 7,33 · 5,10 |
| Oscuro / error | 10,87 · 13,42 · 9,51 | 5,60 · 6,91 · 4,90 |

El margen más corto es el icono de éxito en claro sobre la superficie elevada: 3,40:1.

## ErrorAlert

`ErrorAlert` conserva su API (`state`, `compact`) y su conducta (devuelve `null` sin error; `role="alert"` con error). Ahora devuelve `<Aviso tono="error" compacto={compact}>`. Lo usan once pantallas: `admin/ContainerTypesCatalog`, `bandeja/PortalChatwoot`, `bandeja/VinculosAdmin`, `cn/NewReceiptDrawer`, `crm/TarjetaFichaDrawer`, `gastos/ExpenseDrawer`, `operarios/EditOperarioDrawer`, `operarios/NewOperarioDrawer`, `operarios/ResetPinDrawer`, `usuarios/InviteUserDrawer` y `bug-reporter/BugReportModal`. Ninguna se edita.

**Cambio visible en esas once pantallas, mínimo.** Antes ya era una franja `--danger-bg` sin contorno, con el mismo padding, la misma fuente y el icono en `--danger-text`. Cambian dos cosas: el icono pasa de 14 a 16 px en tamaño normal (14 en compacto, como antes) y se alinea en columna con el texto en vez de ir en línea con él, así que un mensaje de varias líneas ya no se envuelve debajo del icono. Dos de esas pantallas están en el CRM y la bandeja de Chatwoot; el cambio llega allí sin editar sus archivos.

## Registro CMP

`docs/governance/components/aviso.json`, estado **`proposed`** (CMP-01: API y documentación listas, un consumidor verificado: `ErrorAlert`). Pasar a `canonical` exige la revisión de diseño, teclado y lector, móvil y oscuro en pantalla real, y el OK de Sam; se pide con la primera adopción (4b), no aquí.

`tokens` del registro queda vacío a propósito: el validador (`scripts/build-component-registry.mjs`) exige que cada token declarado aparezca como `var(--…)` en el archivo de implementación, y este componente no pinta color en línea. Los tokens que usa están en esta spec y los mide el contrato sobre `studio.css`.

## Allowlist

- `app/studio/_components/ui/Aviso.tsx`, `app/studio/_components/ui/Aviso.test.tsx`
- `app/studio/_components/ui/ErrorAlert.tsx`
- `app/studio/studio.css`
- `app/studio/_components/__tests__/avisos-contract.test.ts`
- `docs/governance/components/aviso.json`, `docs/governance/generated/`
- `app/studio/CLAUDE.md`
- `docs/specs/0628-aviso-studio/spec.md`, `docs/specs/README.md`
- `.agents/handoffs/0628-aviso.md`

**Ampliación del 2026-11-13, autorizada por el Subdirector Rebrand.** El CI de la PR falló porque dos pruebas fijan a propósito la lista de componentes de CMP-01, que pasa de 5 a 6 con `aviso`. Se suman, con el mismo patrón que SDD-0263 (`38665ff5a`):

- `scripts/__tests__/component-registry.test.ts`: el conteo pasa a 6 y `aviso` entra en la lista explícita de ids.
- `.agents/plugins/plugins/erp-studio-governance/scripts/__tests__/policy-registry.test.mjs`: el conteo pasa a 6.
- `.agents/plugins/plugins/erp-studio-governance/references/policy-registry.json`, regenerado con `build-policy-registry.mjs`. Al regenerar entra también SGE-AG-01, que ya estaba aprobada en `main` pero faltaba en este derivado.

No se editan `tokens.css` ni `docs/specs/0603-claridad-controles/spec.md`. Sin migraciones, rutas, acciones de servidor, permisos ni dependencias nuevas. **Ninguna pantalla adopta el componente en este tramo.**

## Aceptación

- `Aviso` existe con los cuatro tonos, título y acción opcionales, `urgente` y `compacto`. Lo prueba `Aviso.test.tsx`.
- `error` y `urgente` son `role="alert"`; el resto, `role="status"`. El icono es `aria-hidden` y cada tono tiene una forma distinta.
- La acción es `studio-btn studio-btn-ghost studio-btn-sm`, `type="button"`, y se oprime con teclado; deshabilitada no se dispara.
- Ni `Aviso` ni `ErrorAlert` pintan color, fondo, borde ni sombra en línea.
- `ErrorAlert` conserva API y conducta; ningún consumidor cambia.
- En claro y oscuro, sobre página, tarjeta y superficie elevada: texto ≥ 4,5:1 e icono ≥ 3:1 en los cuatro tonos (24 mediciones).
- La franja no declara contorno ni sombra, y ninguna regla `.studio-aviso*` lleva un color literal.
- `avisos-contract.test.ts` cuenta lo que mide (piso de 24 mediciones y 13 reglas) y trae cinco mutantes que lo rompen: el dorado vuelve al icono en claro, el texto pasa a tinta apagada, la franja gana contorno y sombra, un tono usa un color literal, la excepción oscura sale de `@media screen`.
- `aviso.json` válido en `pnpm components:check`; `docs/governance/generated/` y el derivado del plugin, regenerados; las pruebas del registro cuentan 6 componentes.

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: el aviso es nivel 0, plano. La acción es secundaria; no suma primarios. |
| Acción dominante | Cumple: la acción del aviso no puede ser primaria (la API no lo permite). |
| Semántica de color | Cumple con BRAND §Estados. Atención en claro lleva icono en tinta y dorado en el fondo: es la regla de BRAND para el acento que no alcanza, no una excepción. |
| Contraste | Cumple: medido arriba y vigilado por contrato. |
| Tokens | Cumple: ningún token nuevo ni color nuevo. |
| Estados sin color | Cumple: forma de icono distinta por tono y mensaje en texto. |
| Light/dark | Cumple en contrato. La revisión visual en pantalla real llega con la primera adopción (4b). |
| Móvil | Cumple en diseño: la acción baja de línea con `flex-wrap`. Sin recorrido en navegador en este tramo: ver Límites. |
| Movimiento reducido | No aplica: el aviso no anima. |

## Adopción posterior (4b, 4c, 4d)

### Medida

Hecha sobre `origin/main` `11f90a32e` con este tramo aplicado, en `app/studio`, archivos `.ts` y `.tsx` sin pruebas, sin contar `Aviso.tsx` ni `ErrorAlert.tsx`:

| Qué | Archivos | Cómo se mide |
|---|---|---|
| Usan `role="alert"` | 119 | `grep -rl 'role="alert"'` |
| Usan un fondo de estado | 175 | `grep -rlE 'var\(--(danger\|warning\|success\|info)-bg'` |
| **Unión: candidatos a revisar** | **206** | las dos anteriores, sin repetir |
| … pintan al menos un aviso | **139** | clasificación de abajo |
| … solo pastillas o estados, no avisos | **67** | clasificación de abajo |

**Clasificación**, por cada aparición de un fondo de estado, mirando seis líneas antes y después:

1. Si hay `role="alert"` o `role="status"` cerca, es **aviso**.
2. Si no, y hay `borderRadius` de pastilla (`999`, `--r-full`, `--r-pill`), `pill`, `chip` o `Badge`, es **pastilla**.
3. Si no, y es un mapa de tonos (`clave: { bg: … }`) o hay `tone`, `STATUS` o `estado` cerca, es **estado**.
4. Lo demás es **aviso**.

Además, todo `role="alert"` sin fondo de estado cerca cuenta como aviso (mensajes de campo y avisos sin franja). Un archivo es «aviso» si tiene al menos una aparición de aviso. La regla es una heurística: cada PR de adopción confirma archivo por archivo y corrige la cuenta en su handoff.

Por módulo, los 139: admin 19, contabilidad 12, componentes compartidos 8, mailing 7, marketing 6, debug 5, proveedores 5; cn, cobranzas, facturación, fidelización y tracking 4 cada uno; el resto, entre 1 y 3. Solo 2 están en el CRM.

### Criterio

- **Se adopta** un bloque que avisa algo de la pantalla o la transacción: error de envío, advertencia, confirmación persistente, información de contexto. Se reemplaza por `<Aviso>` con el tono que dice BRAND §Estados, no el que tenía.
- **No se adopta** lo que no es aviso: pastillas y estados de fila (`Badge`), celdas o tarjetas teñidas por tono, mapas de tonos, el destello de fila (`studio-row-flash-*`), los toasts (`ToastProvider`, AVS-01) y los mensajes de campo debajo de un input (ERR-01 «Campo»: van junto al campo con su relación accesible, no como franja).
- **Revisar el rol.** Muchos `role="alert"` actuales son información o atención: al adoptar pasan a `status`. Un error de transacción sigue en `alert`.
- **Revisar el tono.** Lo que hoy se pinta en rojo o vino por ser pendiente o en tránsito pasa a `info` (BRAND §Estados: pendiente no es riesgo).
- **Tramos.** Por módulo, en lotes que una persona pueda revisar en una sola PR; el CRM y la bandeja van al final, cuando Chatwoot termine ahí. El orden y el tamaño de cada lote los decide el Subdirector Rebrand.
- **Trinquete, propuesta.** Cuando 4b esté en `main`, convendría que el contrato falle si aparece un aviso nuevo pintado a mano fuera de una lista que solo baja. No va en este tramo: con varias PR abiertas tocando pantallas, podría poner en rojo trabajo ajeno.

## Límites

- jsdom no calcula estilos: el contraste se mide sobre los tokens, no sobre píxeles. La revisión en navegador, en claro y oscuro y a 375 px, llega con la primera pantalla que adopte el componente; hoy solo `ErrorAlert` lo usa.
- La medida de adopción es heurística y por archivo, no por aviso.

## Extensión al portal: tramo 4e

El portal del cliente no puede importar del Studio, así que no usa `Aviso`: reproduce su franja con la clase `.portal-aviso` de `app/portal/claridad.css` (mismos cuatro tonos en `data-tono`, `StatusIcon` compartido, sin contorno ni sombra, color del estado en el icono y, en atención, un tinte dorado del fondo). No es un componente nuevo ni entra en CMP-01. Lo adoptan 13 avisos en 11 archivos del portal; lo vigila `app/portal/__tests__/avisos-portal-contract.test.ts`. Detalle, clasificación y medidas en [tramo-4e.md](../0603-claridad-controles/tramo-4e.md).
