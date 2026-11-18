---
sdd: "0660"
title: "Estándar de fechas del Studio: campo con máscara, calendario y atajos"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-18
updated: 2026-11-18
supersedes: null
superseded_by: null
related: ["0141", "0217", "0223", "0569", "0603"]
confidencialidad: interno
---

# SDD-0660 — Estándar de fechas del Studio: campo con máscara, calendario y atajos

> Sam pidió en la reunión con la oficina del 2026-11-18 un solo estándar para los campos de fecha de todo el ERP. No le gustan las rayas «---------- de ----» que pinta el campo de mes del navegador (Conversaciones, resúmenes mensuales).

## Contexto

- El Studio usa los campos nativos `<input type="date">`, `type="month"` y `type="datetime-local"`. Cada navegador los pinta distinto: Chrome en español pone `dd/mm/aaaa` con segmentos y el de mes como «---------- de ----»; Safari y Firefox, otra cosa. No hay atajos y el calendario depende del navegador.
- Inventario sobre `main` en `9b64478b1` (2026-11-18): **74 campos de día, 7 de mes y 4 de fecha y hora en 63 archivos** de `app/studio` y `components/` (más 1 de día en `components/document-import` y 4 fuera del Studio: portal, móvil y formulario público de packing list). Dos componentes genéricos aceptan `type: "date"` como propiedad (`AuditLogSection` y `inspecciones/builder-fields`).
- Política que gobierna: **DAT-01 v1.0** (selector de fecha y rango) con CAL-01, A11Y-01 y FRM-01. DAT-01 ya pide que escribir y abrir el calendario representen el mismo valor, que la fecha inválida no se corrija en silencio y el patrón de teclado del WAI Date Picker.
- Investigación de la sesión de la reunión (2026-11-18): QuickBooks documenta Alt+↓ para abrir el calendario, **T** para hoy y **+ / −** para un día más o menos. Escribir los números seguidos sin barras no está documentado por QuickBooks; la pauta de «escribir con el calendario al lado» viene de SAP Fiori, ICDS y Toyota CDS.

## Alcance

**Entra:**
1. Componente compartido `<DateField>` (`app/studio/_components/ui/DateField.tsx`) con modo día (`date`) y mes (`month`), y su lógica pura en `lib/studio/util/date-mask.ts`.
2. Prueba de contrato `app/studio/_components/__tests__/fechas-contract.test.ts` que prohíbe `type="date"`, `type="month"` y `type="datetime-local"` en `app/studio`, con la lista de pendientes **congelada**: no puede crecer ni puede quedar desactualizada cuando un archivo se migra.
3. Migración de Conversaciones (lo que vio Sam) y de los campos de la tanda 1 (abajo).
4. Registro del componente en el catálogo CMP como `proposed` y actualización de `app/studio/CLAUDE.md` (decía «usar `<input type="date">` nativo»).

**No entra:**
- Fecha y hora (`datetime-local`): 4 campos (Mailing «Programar», TMS rutas, plan de embarque y línea de tiempo del tracking). Quedan en la lista congelada para la tanda 3 (ver «Fecha y hora»).
- El portal del cliente, la app móvil (`app/m`) y el formulario público de packing list (`app/p`). **Decisión:** quedan fuera. Razón: el estándar lo pidió la oficina para el ERP; el portal tiene su propia marca y su propio sistema visual (Norte del portal, SDD-0654 versión light), sus usuarios entran desde el teléfono, donde el selector nativo del sistema es el que conocen, y el portal no puede importar `@/app/studio` (frontera ESLint Público ↔ ERP). Si se quiere el mismo comportamiento allá, se mueve la lógica pura a `lib/shared/` en una SDD aparte.
- Rangos de fechas como un solo control (inicio–fin): hoy son dos campos sueltos y siguen siéndolo, cada uno con `<DateField>`.
- Migraciones de base de datos, server actions y validadores: **no cambian**.

## Diseño

### Lo que ve y hace el operador

| Pedido de Sam | Cómo queda |
|---|---|
| 1. Formato en gris de fondo, sin rayas | El campo es un texto. Detrás, en gris (`--studio-text-soft`, el mismo del placeholder) y con letra monoespaciada, se pinta `dd/mm/aaaa` (meses: `mm/aaaa`). Lo que se escribe tapa su parte: tras `18` se ve `18/mm/aaaa`. |
| 2. Números seguidos, barras solas | `18112026` → `18/11/2026`. La barra se inserta al empezar el grupo siguiente (`181` → `18/1`), no al terminar el anterior: así Retroceso nunca choca con una barra que se vuelve a poner sola. Una barra escrita tras un solo dígito lo completa con cero (`1/` → `01`). |
| 3. Calendario con el icono o Alt+↓ | El icono a la derecha del campo y **Alt+↓** abren el calendario. Escape lo cierra y el foco vuelve al campo. |
| 4. Atajos estilo QuickBooks | **T** = hoy (también **H**, de «hoy»); **+** y **−** = un día más o menos; en meses, un mes. Sin fecha escrita, + y − arrancan en hoy. Respetan `min` y `max`. A medio escribir, **«-» es un separador** (`18-11-2025` → `18/11/2025`) y + no hace nada; con una fecha imposible, ninguno de los dos hace nada. |
| 5. Escribir y elegir sincronizados | El calendario abre en la fecha escrita y la marca como elegida; si se escribe con el calendario abierto, el calendario la sigue. Elegir un día la escribe en el campo. |

**Pegar:** se aceptan `18/11/2026`, `18-11-2026`, `18.11.2026`, `1/2/2026`, `18112026` y el ISO `2026-11-18` (también con hora detrás, que se ignora).

**Fecha inválida (DAT-01):** `31/02/2026` queda escrita tal cual; al salir del campo aparece «Ese día no existe: febrero de 2026 tiene 28 días.» y el formulario no se envía (validez del campo con `setCustomValidity`). Otros mensajes: «Completa la fecha: dd/mm/aaaa.», «El mes va de 01 a 12.», «El año va de 1900 a 2100.», «La fecha mínima es …», «La fecha máxima es …», y con `required` vacío, «Escribe una fecha.». El error se anuncia con `role="alert"` y se enlaza con `aria-describedby`.

**Borrar:** vaciar el campo deja el valor en blanco; nunca equivale a «hoy» (DAT-01).

### Decisión: el doble clic no abre el calendario

Sam mencionó el doble clic. **Decisión: no lo abre.** En cualquier campo de texto, el doble clic selecciona lo escrito para reemplazarlo, y el operador lo usa para eso; si abriera el calendario, corregir una fecha con el ratón costaría un clic extra para cerrarlo. El calendario ya tiene dos entradas que no chocan con nada: el icono del campo (un clic) y Alt+↓. Hay una prueba que lo fija.

### Decisión: el icono no es una parada de Tab

El botón del icono lleva `tabIndex={-1}`. En formularios de captura con varios campos de fecha, una parada de Tab extra por campo frena a quien escribe. El teclado abre el calendario con Alt+↓, que se anuncia en la descripción del campo («… Alt más flecha abajo abre el calendario»), y el botón conserva su nombre («Abrir calendario») para ratón, toque y lector de pantalla.

### Lo que viaja en el formulario

- `<input type="hidden" name={name}>` con ISO: `AAAA-MM-DD` (meses `AAAA-MM`). Es el mismo formato que mandaba el campo nativo, así que **los validadores y las server actions no cambian**.
- Mientras la fecha está vacía, incompleta o es inválida, el oculto va vacío.
- `onChange` entrega el ISO de una fecha válida y `""` al vaciar el campo o al completar una fecha imposible. **A medio escribir no avisa**: el padre conserva el último valor (así un filtro por mes no se vacía al reescribirlo). `onValidityChange(valida)` sirve a los formularios por pasos que desmontan el campo (Amonestación).
- `form.reset()` (también el que hace React 19 tras una `<form action>`) lo devuelve a `defaultValue`, como a un campo nativo. Si el campo lleva `form="…"`, escucha ese formulario.
- **Dentro de un `<form>`**, una fecha incompleta o imposible bloquea el envío (validez del campo visible). **Fuera de un `<form>`** nada lo bloquea y el padre conserva el último valor válido, así que la acción que usa ese valor espera a `onValidityChange`: «Depreciar mes» en Activos fijos, «Asentar período», «Anular asiento» y exportar en Fiscal, «Exportar» en Gastos, y exportar y «Nuevo comprobante» en Retenciones.
- API: `mode`, `name`, `id`, `value` / `defaultValue` (ISO; acepta un ISO con hora detrás), `onChange(iso)`, `onBlur`, `min`, `max`, `required`, `disabled`, `autoFocus`, `form`, `aria-label`, `aria-labelledby`, `aria-describedby` (se suma a la del formato), `aria-invalid`, `style` (contenedor), `inputStyle` (campo), `data-testid`.
- Controlado: el texto solo se reescribe cuando el padre **cambia** la prop a algo que no sea el eco de lo que el propio campo acaba de avisar: a otra fecha, la muestra; a `""`, limpia el campo aunque haya algo a medio escribir. El eco no reescribe: un «31/02/2026» avisa `""`, el padre guarda `""` y la fecha imposible sigue escrita con su error (DAT-01).

### Calendario (patrón WAI «Date Picker Dialog»)

- Diálogo (`role="dialog"`, `aria-modal`, título del mes con `aria-live`), anclado debajo del campo; rejilla `role="grid"` con la semana de **lunes a domingo** (como el calendario del Studio, `lib/studio/calendar-helpers.ts`).
- Teclado: flechas = día (±1, ±7); Inicio/Fin = lunes/domingo; RePág/AvPág = mes (con Mayús, año); Intro o Espacio = elegir; Escape = cerrar devolviendo el foco; Tab recorre los controles del diálogo en círculo.
- Hoy lleva contorno y `aria-current="date"`; el elegido, fondo vino y `aria-selected`; fuera de `min`/`max`, tachado y `aria-disabled`. Botones «Mes anterior», «Mes siguiente», «Hoy» y «Cerrar».
- Meses: rejilla de 12 meses (3 × 4), flechas ±1 / ±3, RePág/AvPág = año, «Este mes».
- **Hoy es el día de negocio en Caracas** (`fechaCaracas` de `lib/shared/fechas-caracas.ts`), como el resto del Studio: ni UTC (de 20:00 a medianoche de Venezuela ya sería «mañana») ni la zona del navegador (un operador en China vería otro día). La aritmética de días va en UTC para no saltar por horario de verano.

### Tokens y marca

Solo tokens del Studio: `--bg-surface`, `--bg-elevated`, `--border-strong`, `--ink`, `--ink-soft`, `--studio-text-soft`, `--wine`, `--wine-tint`, `--wine-text`, `--ink-side-strong` (texto sobre vino, blanco en los dos temas: lo exige `dark-theme-contrast-contract`), `--danger-text`, `--info` (foco), `--shadow-pop`, `--r-sm`, `--r-md`, `--r-lg`, `--f-mono`, `--f-sans`. Estilos en `studio.css` (`.studio-date-field__*`), con la densidad compacta.

### Fecha y hora (tanda 3, fuera de esta PR)

Los 4 `datetime-local` son instantes con zona (CAL-01: «todo evento declara si es fecha local o instante con timezone»). Propuesta: `<DateTimeField>` = `<DateField>` + un campo `hh:mm` con la misma máscara (24 h), que arme el mismo `AAAA-MM-DDTHH:mm` que hoy manda el nativo y muestre la zona cuando pueda cambiar el día. Se decide en su tanda, con la prueba de zona VE/CN que pide CAL-01.

## Plan por tandas

| Tanda | Qué | Estado |
|---|---|---|
| 1 (esta PR) | Componente, contrato con lista congelada, Conversaciones y los campos de la lista «Migrados en la tanda 1» del handoff | en curso |
| 2 | El resto de los campos de día y mes del Studio, módulo por módulo, sacándolos de la lista congelada (cada archivo que sale obliga a borrarlo de la lista) | pendiente |
| 3 | Fecha y hora (`<DateTimeField>`), con la prueba de zona | pendiente |
| 4 | Los dos componentes genéricos que reciben `type: "date"` (`AuditLogSection`, `inspecciones/builder-fields`) y `components/document-import` | pendiente |

Cada tanda reduce la lista de `fechas-contract.test.ts`; cuando llegue a cero, la lista se borra y el contrato queda como prohibición pura.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| DAT-01 escribir y calendario = mismo valor | cumplimiento | `DateField.test.tsx` «el calendario abre en la fecha escrita», «elegir un día lo escribe» |
| DAT-01 inválida no se corrige en silencio | cumplimiento | `date-mask.test.ts` y `DateField.test.tsx` «31/02 no se corrige» |
| DAT-01 min/max en UI y servidor | cumplimiento en UI; el servidor conserva sus validadores actuales | pruebas de min/max; las server actions no cambian |
| DAT-01 teclado grid, cambio de mes, Escape y retorno de foco | cumplimiento | pruebas de calendario |
| DAT-01 borrar no equivale a hoy | cumplimiento | prueba «borrar deja el campo vacío» |
| DAT-01 móvil: sheet/dialog con acción Aplicar | **excepción**: el calendario es un diálogo con celdas de 36–40 px; tocar un día es la acción de aplicar y «Cerrar» cancela. No hay botón «Aplicar» aparte porque elegir es un solo toque. Se revisa con `/ui-check` a 375 px | captura del handoff |
| DAT-01 rangos, presets y timezone | no aplica en esta tanda (no hay control de rango; timezone llega con fecha y hora) | — |
| A11Y-01 nombre, descripción, error, foco visible, teclado | cumplimiento | pruebas de accesibilidad; foco con `--info` |
| CMP-01 componente nuevo | `proposed` (no `canonical`): la promoción exige revisión de diseño y consumidores verificados | `docs/governance/components/date-field.json` |

## Aceptación

1. `<DateField>` cumple los cinco pedidos de Sam y las pruebas de interacción pasan: escribir dígitos, barras automáticas, T, +, −, Alt+↓, pegar, borrar y 31/02.
2. `fechas-contract.test.ts` falla si aparece un `type="date|month|datetime-local"` nuevo en `app/studio`, si un archivo de la lista suma campos o si un archivo migrado sigue en la lista.
3. Conversaciones (resúmenes mensuales) usa `<DateField mode="month">` y la acción recibe `AAAA-MM` como antes.
4. El valor que reciben las server actions de los campos migrados no cambia de formato.
5. `/ui-check` sin bloqueantes; `pnpm verify` en verde con turno del DG.
