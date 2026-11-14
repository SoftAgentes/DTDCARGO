# SDD-0603 · Pendientes menores del Studio

Cierra los pendientes que dejaron las revisiones independientes de los tramos [4c](tramo-4c.md), [4d](tramo-4d.md) y [5c](tramo-5c.md) de [la spec](spec.md), más `ExchangeRatesSection`, que quedó fuera del [4b](tramo-4b.md). Rama `claude/0603-m1-menores-studio-31c0c1`, desde `origin/main` `651bdbd73`.

Sin migraciones, rutas, acciones de servidor, permisos, dependencias, CSS, tokens ni colores nuevos. Montos y lógica no se tocan. Los textos visibles no cambian, salvo dos: el voseo corregido (punto 10) y «Abrir» en el Dashboard (punto 5), que es el mismo texto ya aprobado para las filas en el tramo 5.

## Allowlist

Los 17 archivos del encargo (`rebrand-0603-allowlist-m1-studio-651bdbd73.txt`), más pruebas vecinas y documentos:

- `app/studio/_components/ui/Aviso.tsx`, `Aviso.test.tsx`
- `docs/governance/components/aviso.json`, `docs/governance/generated/component-registry.json`
- `app/studio/(app)/nomina/_components/form-bits.tsx` y su `__tests__/form-bits.test.tsx`
- `app/studio/(app)/gastos/_components/GastosClient.tsx`
- `app/studio/(app)/cotizador/[code]/page.tsx`
- `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx` (revisado, sin cambios: ver punto 3)
- `app/studio/(app)/dashboard/_components/DashboardWidgets.tsx`
- `app/studio/(app)/despacho/_components/CreateOdDrawer.tsx`
- `app/studio/(app)/cobranzas/_components/RecordatoriosDrawer.tsx`
- `app/studio/(app)/embarques/_components/AsistenteBorrado.tsx`
- `app/studio/(app)/tracking/_components/ActiveShipmentList.tsx`
- `app/studio/(app)/fidelizacion/_components/RegisterReferralDrawer.tsx`
- `app/studio/(app)/admin/_components/ExchangeRatesSection.tsx`
- `app/studio/_components/__tests__/avisos-t4d-contract.test.ts`
- Pruebas vecinas ajustadas: `admin/_components/ExchangeRatesSection.test.tsx`, `embarques/_components/__tests__/AsistenteBorrado.test.tsx`
- Pruebas vecinas nuevas: `gastos/_components/GastosClient.alertas.test.tsx`, `dashboard/_components/__tests__/DashboardWidgets.atencion.test.tsx`, `despacho/_components/__tests__/CreateOdDrawer.capbar.test.ts`, `cotizador/[code]/__tests__/aviso-embarque.test.ts`
- `docs/specs/0603-claridad-controles/menores-studio.md`, la enmienda en `docs/specs/0628-aviso-studio/spec.md` y `.agents/handoffs/0603-m1-menores-studio.md`

**Ampliación del 2026-11-14, autorizada por el Subdirector Rebrand:** `app/studio/(app)/__tests__/avisos-finanzas-contract.test.ts`. Ese contrato (tramo 4c) fijaba con cuenta exacta que `nomina/form-bits.tsx` tenía 0 `<Aviso>` y una caja a mano como excepción. Al convertir `ErrorBox` (punto 2), `form-bits` pasa a 1, sale de `EXCEPCIONES` y los totales van de 43 archivos y 62 avisos a 44 y 63. Nada más cambia en ese contrato.

## Los diez puntos

| # | Pendiente | Clasificación | Qué cambia |
|---|---|---|---|
| 1 | Enmienda de `Aviso` | Cumple | Acepta `tabIndex` y `ref`, lo mínimo para recibir el foco por programa. No cambian aspecto, clases ni `role`; sin las props el marcado es idéntico. Ficha `aviso.json` y registro generado, actualizados. Nota de enmienda en SDD-0628. |
| 2 | Nómina, `ErrorBox` | Cumple | Pasa de caja a mano con contorno rojo a `<Aviso tono="error" compacto tabIndex={-1}>`. `useDialogA11y` lo sigue encontrando con `[role="alert"][tabindex="-1"]`. Lo usan 15 archivos de Nómina (18 usos), que no se editan. |
| 3 | Botones primarios dentro de avisos | Cumple, caso por caso | Ver «Botones dentro de avisos». |
| 4 | `AlertBanner` de Gastos | Cumple | La franja (`status`) lleva solo el título y la frase fija. La lista de contenedores sale debajo, en un `<ul>`, fuera de toda región viva: al marcar uno como cargado, el lector ya no relee los demás. Mismo arreglo que `SupplierDrawer` (#547). |
| 5 | Dashboard, «Atención requerida» | Cumple, como franja plana | Ver «Atención requerida». |
| 6 | `CreateOdDrawer`, pista de `CapBar` | Cumple | `--ink-inv-mute` → `--ink-side-soft`. Ver «Pista de CapBar». |
| 7 | Contrato `avisos-t4d-contract` | Cumple | El regex `CONTORNO` ve fallbacks, plantillas, `dashed` y `borderColor`. Ver «Contrato T4d». |
| 8 | Observaciones de la #552 | Cumple | `RecordatoriosDrawer`: el aviso de error va `compacto`, como el resto de los drawers. `AsistenteBorrado`: queda una sola región `status` (ver «Roles vivos»). `ActiveShipmentList`: sangría del `<button>` corregida; el cambio es solo de espacios. |
| 9 | `ExchangeRatesSection` | Cumple, con una excepción | «BCV: no se confirmó una tasa para hoy» → `Aviso` informativo con título. El error de la acción → `Aviso` de error. «Fuera de rango» **no** pasa a `Aviso`: ver «Roles vivos». |
| 10 | Voseo en `RegisterReferralDrawer` | Cumple | «acreditá» → «acredita». No hay otro voseo en el archivo. |

## Botones dentro de avisos

Regla: el relleno vino es de la acción principal de la pantalla; dentro de un aviso el botón va secundario (VIS-01 §5, SDD-0628).

| Dónde | Botón | Decisión | Motivo |
|---|---|---|---|
| `GastosClient`, banner de alertas | «Cargar gasto» (`primary`) | **Pasa a secundario** (`ghost -xs`) | El primario de la pantalla es «Nuevo gasto». Con la lista fuera de la franja, cada fila lleva dos secundarios: «Cargar gasto», con su icono, y «Marcar cargado». |
| `cotizador/[code]`, aviso de conversión | «Ver embarque →» (`dark`) | **Pasa a secundario** (`ghost -sm`) | Es un enlace de navegación dentro de un aviso de éxito; no es la acción de la pantalla. |
| `InvoiceDetailClient`, aviso de T&C | «Emitir igual (sin aceptación)» (`ActionButton` `warning`) | **No cambia** | No es vino: es la variante de atención, la que el estándar de botones asigna a una acción significativa y no destructiva. Ese aviso es una confirmación en línea de la acción que la persona acaba de pedir (emitir), con «Cancelar» al lado como secundario. Si los dos fueran secundarios, la decisión que queda en la auditoría de la factura pesaría lo mismo que cancelarla. El primario de la pantalla sigue siendo «Emitir factura». |

## Atención requerida

Cada pendiente del Dashboard era una caja con borde izquierdo de color, icono en color de estado y, si tenía destino, un enlace que envolvía toda la caja sin nada que dijera que se pulsaba.

Ahora cada pendiente es una **franja plana** hecha con las mismas reglas que `Aviso` (BRAND §Estados): fondo suave del tono, sin contorno, texto en tinta e icono `StatusIcon` con forma distinta por tono. En atención el icono va en tinta, porque el dorado no llega a 3:1 sobre su franja en claro. Lo que se pulsa es «Abrir», un secundario `-xs` con contorno de tinta y nombre accesible «Abrir: <título>»; la franja deja de ser un enlace.

**Por qué no es `<Aviso>`.** `Aviso` siempre es una región viva, y con tono de error es `role="alert"`. Esta lista es contenido fijo del tablero, no un anuncio por una acción: con `alert`, «facturas vencidas» interrumpiría al lector cada vez que se abre el Dashboard. Va como lista (`<ul>`) sin `role` vivo.

## Pista de CapBar

La barra de ocupación del camión vive sobre `--bg-sidebar`, oscuro en los dos temas. La pista usaba `--ink-inv-mute`, que voltea con el tema.

| Token de la pista, sobre `--bg-sidebar` | Claro | Oscuro |
|---|---|---|
| `--ink-inv-mute` (antes) | 5,04:1 | 1,07:1 |
| `--ink-side-soft` (ahora) | 5,82:1 | 5,32:1 |

`dark-theme-contrast-contract` pasa, pero no mira este caso: salta los fondos pintados con un token de tinta, porque los trata como divisores. Lo cubre la prueba vecina `CreateOdDrawer.capbar.test.ts`, que mide el contraste de la pista con los valores reales de `tokens.css` en los dos temas y trae su mutante.

## Contrato T4d

`CONTORNO` era `solid var(--danger|warning|success|info)` y cerraba con `)`. No veía:

1. fallbacks: `var(--warning, #B8893A)`;
2. sufijos: `var(--danger-text)`;
3. otros trazos: `dashed`, `dotted`, `double`;
4. plantillas con el token dentro: `` `1px solid ${error ? "var(--danger)" : "var(--border)"}` ``;
5. plantillas que arman el nombre: `` `3px solid var(--${tono})` ``;
6. propiedades de color: `borderColor`, `borderLeftColor`, `outlineColor`, también con el alias `--color-status-*`.

Ahora las ve todas, y la cuenta por archivo es **exacta** (antes era un tope). Al abrirlo aparecieron 11 contornos más en 9 archivos del grupo. Ninguno es un aviso; quedan como excepciones con motivo en el contrato:

| Archivo | n | Motivo |
|---|---|---|
| `mailing/ConfigView`, `RuleEditorDrawer` (2), `TemplateEditorDrawer` (2) | 5 | campo con error |
| `bitacora/nueva/ActaReview` | 1 | campo «responsable» sin asignar |
| `bitacora/BitacoraClient` | 1 | chip de filtro activo |
| `bitacora/TaskDrawer` | 1 | casilla de un ítem hecho |
| `marketing/noticias-web/MarkdownLite` | 1 | marca `[VERIFICAR]` dentro del texto |
| `marketing/noticias-web/Step3Article` | 1 | botón «Copiar» tras copiar |
| `tms/GpsLiveTab` | 1 | tarjetas de alerta de flota (pendiente ya anotado en el 4d) |

Mutantes nuevos: ocho escrituras de contorno que deben romper; cuatro contornos neutros que no deben contar; una excepción que pierde su contorno; y que toda excepción sea de un archivo del grupo y traiga motivo. Límite que queda: no sigue una variable (`const c = "var(--danger)"` y después `` `solid ${c}` ``).

## Roles vivos

- **`AsistenteBorrado`.** Tenía dos regiones `status` a la vez: el canal de anuncio («Listo: …») y la advertencia del paso. `Nota` es ahora siempre `urgente`: la advertencia sale de un paso recién ejecutado o de una lectura que falló, es decir, de una acción. Queda una región `status` (el anuncio) y la advertencia va como `alert`. El contrato `claridad-t5c` no cambia: mismas cuentas de `<Aviso` y de `role` crudo.
- **`ExchangeRatesSection`, «fuera de rango».** Aparece y desaparece mientras se escribe la tasa. No va en una región viva y no es `Aviso`: es un mensaje del campo «Tasa» (ERR-01 «Campo»), texto en tinta con icono de atención, ligado al campo por `aria-describedby`. Antes era una caja dorada con texto dorado (2,79:1 en claro) y sin relación con el campo. Además, con el aviso de BCV visible, un segundo `status` habría repetido el problema del punto 8.
- **`ExchangeRatesSection`, BCV.** Sigue siendo `status`. Deja `aria-live="polite"` y `aria-atomic`, que `role="status"` ya implica.
- **`AlertBanner` de Gastos.** La franja sigue en `status`; la lista sale.
- Ningún secreto ni dato sensible dentro de una región viva.

## Aceptación

- `Aviso.test.tsx`: sin `tabIndex` no es enfocable; con `-1` recibe el foco y conserva rol, clases y tono; `ref` apunta a la franja; el HTML con y sin las props solo difiere en `tabindex`.
- `form-bits.test.tsx`: `ErrorBox` es el aviso canónico, sin estilo en línea, y recibe el foco con el selector de `useDialogA11y`. `PrestamoDrawer.foco.test.tsx` sigue pasando sin tocarse.
- `GastosClient.alertas.test.tsx`: la franja no contiene códigos ni botones; la lista no está dentro de ninguna región viva; los cuatro botones son `ghost -xs`.
- `DashboardWidgets.atencion.test.tsx`: franjas sin contorno, icono con forma distinta, ninguna región viva, «Abrir» secundario con nombre propio.
- `CreateOdDrawer.capbar.test.ts`: pista ≥ 3:1 en claro y oscuro; mutante.
- `aviso-embarque.test.ts`: «Ver embarque» secundario; mutante.
- `AsistenteBorrado.test.tsx`: tras un paso con advertencia hay una sola región `status` y la advertencia es `alert`.
- `ExchangeRatesSection.test.tsx`: BCV y error son avisos canónicos; «fuera de rango» no es región viva y queda ligado al campo.
- `avisos-t4d-contract.test.ts`: 50 archivos, cuenta exacta de contornos y mutantes.
- `pnpm components:check` y `scripts/__tests__/component-registry.test.ts`.
- Nada que se oprima baja de 32 px: «Abrir» y los botones del banner son `-xs` (32); «Ver embarque», `-sm` (36/32).

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: salen un primario vino (Gastos) y un relleno de tinta (cotizador) de dentro de avisos. Ningún primario nuevo. |
| Acción dominante | Cumple: una por pantalla. La excepción de `InvoiceDetailClient` está explicada arriba y no es vino. |
| Semántica de color | Cumple con BRAND §Estados: tono en el fondo y en el icono, texto en tinta. |
| Contraste | Cumple: pista de `CapBar` medida en los dos temas; el resto hereda de `.studio-aviso*` y `studio-btn-ghost`, ya medidos por sus contratos. |
| Tokens | Cumple: ninguno nuevo, ningún color nuevo, sin CSS. |
| Estados sin color | Cumple: icono con forma por tono en avisos, en el Dashboard y en el mensaje de campo. |
| Light/dark | Cumple en contrato. Falta verlo en pantalla (ver Límites). |
| Móvil | Cumple en diseño: la franja del Dashboard y las filas del banner bajan de línea con `flex-wrap`. |
| Movimiento reducido | No aplica: no se agrega movimiento. |

## Límites

- **Pista de `CapBar`.** El contraste medido es el de la pista contra su fondo. El relleno (`--wine-soft`, `--warning`, `--danger`) contra la pista sigue por debajo de 3:1 en los dos temas, como ya pasaba en claro; el porcentaje y los kilos van además en texto encima de cada barra. Mejorarlo pide un token que hoy no existe.
- jsdom no calcula estilos: falta ver en la imagen de prueba, en claro, oscuro y compacto, Nómina (un error de formulario), Gastos (banner), el cotizador convertido, el Dashboard, la creación de OD, el asistente de borrado y Tasas de cambio.

## Fuera de alcance detectado

- `EmpleadoDrawer.tsx:123` usa `ErrorBox` para `state.accessWarning`, que es una advertencia y no un error (ya anotado en el 4c). Con este cambio se ve como aviso de error.
- `GpsLiveTab`: las tarjetas de alerta de flota tienen el mismo patrón que tenía «Atención requerida». La solución de este documento (franja plana sin `role` vivo) les serviría.
- `RegisterReferralDrawer`: el mismo aviso dice «crédito advisory» dos veces; es un anglicismo, no voseo, y no se tocó.
