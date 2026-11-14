# SDD-0603 · Tramo 4d · Avisos de Operación y marketing con `Aviso`

Parte del tramo 4 de [la spec](spec.md), en la ola 2. Adopta el componente canónico `Aviso` (`app/studio/_components/ui/Aviso.tsx`, SDD-0628) en los avisos hechos a mano de Operación y marketing. Según BD-037, lo que avisa es una franja plana con icono y sin contorno. Rama `claude/0603-t4d-operacion-e26034`, desde `claude/tren-ae` `4441f65ac`, el tren #540 de la ola 1, que trae `Aviso`.

## Allowlist

- Los 50 archivos de `rebrand-0603-allowlist-t4d-4441f65ac.txt`: el inventario de avisos en `mailing`, `marketing`, `fidelizacion`, `bitacora`, `despacho`, `clientes`, `tms`, `operarios`, `inspecciones`, `reclamos`, `cola-qr`, `servicios` y `etiquetas`. Quedó fuera `VeRowActions`, que está en la PR abierta #318.
- `app/studio/(app)/operarios/_components/EditOperarioDrawer.test.tsx`: tres `getByRole("note")` pasan a `getByRole("status")`, con el mismo texto esperado.
- `app/studio/_components/__tests__/avisos-t4d-contract.test.ts` (nuevo).
- `docs/specs/0603-claridad-controles/tramo-4d.md` y `.agents/handoffs/0603-t4d-operacion.md`.

No se tocaron `studio.css`, `tokens.css`, `Aviso.tsx`, `ErrorAlert.tsx`, `spec.md`, el registro de componentes ni `docs/specs/README.md`. Sin migraciones, rutas, acciones de servidor, dependencias, CSS ni colores nuevos.

## Medición

- **Antes:** había 50 archivos candidatos (regex amplia: fondo de estado, `role="alert"`, `ErrorAlert`, colores de estado). De ellos, 44 tenían al menos un aviso real y 6 solo tenían pastillas, botones o contenido.
- **Después:** quedan 78 `<Aviso>` en 44 archivos. Ningún contorno de estado en línea ni `role` crudo de aviso sigue sin justificación (ver «No aplica»). Lo vigila el contrato.
- **Tonos:** rojo → `error`, dorado → `atencion`, verde → `exito`, azul o neutro → `info`. En drawers y zonas densas se usa `compacto`. «No hay clientes cargados» (ClaimDrawer) conserva `role="alert"` con `urgente`, porque bloquea el formulario.

## Qué se cambió (44 archivos)

| Módulo | Archivo | Avisos |
|---|---|---|
| bitácora | TaskCollabSection | error al subir |
| | TaskDrawer | error del formulario |
| | ActaReview | nota de la IA (atención) |
| | NuevaReunionClient | transcripción no activada (atención) y error de audio |
| clientes | estado-de-cuenta/page | dos notas (atención); el eyebrow pasa a `titulo` |
| | ClientAccountHeader | «Cliente eliminado» (info) y saldo sin calcular (atención) |
| | ClientDrawer | error de geolocalización, cliente creado (atención, con `accion` «Cerrar») y error del formulario |
| | TodosLosAdjuntos | error de carga y error por fila |
| cola-qr | imprimir/page | orden previa a la estiba (atención) y recepción sin cajas (error) |
| | BatchPrintDrawer | error del formulario |
| despacho | CancelOdDrawer | advertencia de cancelación y error |
| | CreateOdDrawer | carga fraccionada (atención, con `titulo`) y error del servidor |
| | RulesClient | error y guardado (éxito) |
| etiquetas | LabelGeneratorClient | nota de impresión (info) |
| fidelización | FidelizacionClient | `StrandedCreditsBanner` (atención, `urgente`) |
| | ReferralDrawer | error y venta anulada (atención) |
| | ReferralSettingsDrawer, RegisterReferralDrawer | `FormError` local (error) y nota de montos (info) |
| inspecciones | InspeccionDrawer, PhotoManager, ReportEditor | error de la acción |
| mailing | BlacklistView | error al agregar, éxito al agregar y error al remover |
| | ComposeView, MailingClient, ScheduledView | error de la acción |
| | ConfigView | error y guardado (éxito) |
| | RuleEditorDrawer | error al guardar y error al borrar |
| | SignaturesView | error, guardado (éxito) y nota del preview (info) |
| | TemplateEditorDrawer | `ErrorBanner` y `SuccessBanner` locales, nota del preview (info) y error y éxito de «Mandar prueba» |
| marketing | CampaignActions, CampaignComposer | error y mensaje de resultado (éxito) |
| | RouteIdeaPanel | error del clasificador y `FlujoBPlaceholder` (info, con `titulo`) |
| | Step3Article | marcas VERIFICAR (atención, con `titulo`) y error de regeneración |
| | EditarNoticiaForm | marcas pendientes (atención; era `status` y se queda en `status`) y error |
| | PublicadasClient | error de carga y error de acción |
| | RetiroForm | error |
| operarios | EditOperarioDrawer | almacén que se quita y rol fuera de región (atención; antes `role="note"`) |
| | PinViewDialog | error general (error, conserva `id`) y PIN heredado (atención, conserva `id` de `aria-describedby`) |
| reclamos | ClaimDrawer | sin clientes (atención `urgente`) y error |
| | ReclamosClient | error de la ficha y error al subir evidencia |
| servicios | ServicioDrawer | error del formulario |
| tms | GpsLiveTab | «Toda la flota operativa · sin alertas» (éxito) |
| | RouteDrawer | sin embarques liberados (atención) y nota de la ruta (info) |
| | TruckDrawer | `FormError` exportado (error). Lo heredan RouteDrawer y `DriverDrawer.tsx`; este último no se edita |

Cuando la caja original traía un icono propio (⚠, ✓ o un svg), se quitó, porque `Aviso` pone el suyo. Por eso el glifo «✓» o «⚠» desaparece al inicio de cinco mensajes; las palabras no cambian. Los márgenes externos se conservan en un `div` envoltorio sin color.

## No aplica

| Archivo | Motivo |
|---|---|
| BitacoraClient | El único fondo de atención es el botón-filtro «Esperando al cliente», que se pulsa |
| DispatchDashboardClient | Tarjetas de indicadores y el texto «N tarde» de una fila: lectura |
| RulesView, TemplatesView | Solo pastillas de estado |
| MarkdownLite | El `<mark>` de `[VERIFICAR]` es contenido del artículo, en línea |
| NewOperarioDrawer | Solo `FieldError` y `ErrorAlert`, que ya pinta con `Aviso` |

Dentro de archivos cambiados, se quedan como están a propósito:

- **Errores de campo:** el texto bajo un input (`FieldError`, `fieldError`) queda como texto. Esto incluye los de TaskDrawer:588, EditOperarioDrawer:279 y NewOperarioDrawer:324.
- **ReclamosClient:1152:** error en línea junto a «Guardar resolución» y «Guardado». Es un span dentro de la fila del botón; como franja de bloque rompería esa fila.
- **RulesClient, «Hold temporal»:** es una sección del formulario con campos. Tampoco cambia la caja de la política en el simulador, que se recalcula con cada peso y como `alert` se anunciaría en cada tecla.
- **ConfigView, «Test mode»:** la caja envuelve el checkbox del formulario; es un control.
- **CreateOdDrawer:** «No hay rutas activas…» y «Excede capacidad…» son pistas pegadas a su control.
- **GpsLiveTab:** las tarjetas de cada alerta de flota son elementos de una lista de lectura. Con `Aviso`, las de tono error pasarían a `role="alert"` al renderizar.
- **ComposeView, `SuccessScreen`:** es una pantalla completa de éxito, no una franja.

## Roles que cambian

- **De `note` o sin rol a `status`:** las notas de atención e info (ActaReview, NuevaReunionClient, estado de cuenta, EditOperarioDrawer, PinViewDialog, GpsLiveTab, RouteDrawer, RouteIdeaPanel, Label, ReferralSettings, RegisterReferral, CancelOd) y los éxitos (BlacklistView, ConfigView, RulesClient, SignaturesView, TemplateEditorDrawer, CampaignActions, CampaignComposer).
- **Sin rol a `alert`:** errores de acción que antes eran texto o caja sin rol (ClientDrawer geo, BatchPrintDrawer, CreateOdDrawer, RulesClient, ReclamosClient evidencia, Step3Article). En una página servidor, «La recepción no tiene cajas registradas» se anuncia al cargar.
- **Sigue `alert`:** todo error que ya lo era, y «No hay clientes cargados» por `urgente`.

## Aceptación

- Los avisos de los 44 archivos van con `<Aviso>`, importado de `@/app/studio/_components/ui/Aviso`. Ninguno lleva color en línea ni contorno.
- `avisos-t4d-contract.test.ts` mira los 50 archivos. Pide cero contornos de estado en línea y cero `role="alert"`/`role="note"` crudos, salvo las excepciones contadas arriba, y un piso de 78 `<Aviso>`.
- Mutantes: volver la caja con contorno, volver un `role="alert"` crudo, cambiar el import o quitar un `<Aviso>` hacen fallar el contrato.
- Las pruebas vecinas que buscan los avisos por rol siguen pasando; EditOperarioDrawer.test se ajustó de `note` a `status`.
- Ningún texto visible cambia, salvo los glifos «✓»/«⚠», que reemplaza el icono de `Aviso`.

## Gate VIS-01

| Punto | Clasificación |
|---|---|
| Presupuesto de énfasis | Cumple: no se suma ningún primario. La única acción nueva dentro de un aviso es «Cerrar» en ClientDrawer, que ya existía y sigue como secundario. |
| Semántica de color | Cumple: el tono sale del significado. Un rojo que no era error pasa a atención (marcas VERIFICAR pendientes en EditarNoticiaForm). |
| Contraste | Cumple por herencia: texto en tinta neutra e icono ≥3:1 en las franjas, medidos por `avisos-contract.test.ts` en claro y oscuro. |
| Tokens | Cumple: ningún token ni color nuevo; se borran colores en línea. |
| Estados sin color | Cumple: cada aviso lleva icono y `role`. |
| Light/dark | Cumple en contrato: todo sale de `.studio-aviso*`, que cubre los dos temas. Falta verlo en pantalla: ver Límites. |
| Objetivo táctil | Cumple: «Cerrar» pasa de `studio-btn-xs` (32 px) a `studio-btn-sm` (36 px, 32 en compacto). |
| Movimiento reducido | Cumple: no se agrega movimiento. |

## Límites

- No se vio en pantalla con datos: el Studio pide sesión y datos, y no se armó imagen de prueba. Hay que revisarlo antes de fusionar, en claro, en oscuro y en compacto. Sobre todo: TemplateEditorDrawer, donde error y éxito de «Mandar prueba» quedan debajo del botón; el estado de cuenta, donde el título ya no va en mayúsculas; y Step3Article.
- Los márgenes que se conservaron del original (6, 10 y 14 px) no están en la escala de 4 px. No se corrigen aquí para no mover maquetación fuera del alcance.
