---
sdd: "0473"
title: "Importación documental, borrador compartido y calculadora puerta a puerta"
status: in-progress
author: "Codex"
created: 2026-09-16
updated: 2026-10-23
supersedes: null
superseded_by: null
related: ["0468"]
confidencialidad: interno
---

# SDD-0473 — Importación documental

Plan aprobado por Sam el 2026-09-16. Owner `worker-importacion-0473-20260916`.
Worktree `DTD-worktrees/importacion-documental-0473`, rama `codex/importacion-documental-0473`.
Base `30a9f890`; stub reservado `069d9e417c06b749cb0749a780187a9c358e3edd`.

## Contrato

XLSX/CSV/PDF se extraen como propuestas revisables. La prealerta guarda un documento compartido,
con un estimado de transporte separado y ligado a su revisión guardada. El proveedor confirma el despacho y obtiene Excel/impresión/etiquetas.
La calculadora pública reutiliza los mismos totales para puerta a puerta y aplica mínimos una vez.
No inventar peso, CBM, distribución ni moneda; logística por grupo, valor por producto.
Totales globales sin distribución siguen pendientes. Packing list prima para logística; invoice/PI
para precio; conflictos requieren revisión. Originales privados no se exponen al proveedor.

Migración reservada por Director: **0457_document_import_workspaces.sql**. No aplicar a producción.
Persistencia privada con RLS/service-role; API valida identidad en cada operación. Borrador usa
`expectedRevision`, historial append-only y confirmación atómica. Anónimos expiran en 24 horas.
Subida firmada a bucket privado, máximo 15 MB, lectura posterior verifica firma/tamaño y hash.
Jobs con lease, reintentos acotados, presupuesto y cuotas atómicas fail-closed; cron de recuperación.
Anthropic solo propone JSON validado. Sin key/model no hay simulación: error recuperable.

## Allowlist exacta inicial

- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `.agents/handoffs/0473-importacion-documental-20260916.md`
- `supabase/migrations/0457_document_import_workspaces.sql`
- `lib/shared/document-import.ts`
- `lib/shared/__tests__/document-import.test.ts`
- `lib/studio/document-import/extract.ts`
- `lib/studio/document-import/extract.test.ts`
- `lib/studio/document-import/anthropic.ts`
- `lib/studio/document-import/anthropic.test.ts`
- `lib/studio/document-import/access.ts`
- `lib/studio/document-import/service.ts`
- `lib/studio/document-import/jobs.ts`
- `lib/studio/document-import/export.ts`
- `lib/studio/document-import/http.ts`
- `lib/studio/document-import/estimate.ts`
- `lib/studio/document-import/estimate.test.ts`
- `lib/studio/document-import/http.test.ts`
- `lib/studio/document-import/service.test.ts`
- `lib/studio/document-import/jobs.test.ts`
- `lib/studio/document-import/access.test.ts`
- `lib/studio/document-import/export.test.ts`
- `app/api/document-import/route.ts`
- `app/api/cron/document-import-drain/route.ts`
- `package.json`
- `pnpm-lock.yaml`
- `vercel.json`
- `lib/studio/document-import/migration.test.ts`
- `lib/studio/prealertas/packlist-form.ts`
- `lib/studio/prealertas/queries.ts`
- `app/studio/(app)/proveedores/_components/PackingListDrawer.tsx`
- `app/portal/(app)/compras/[code]/_components/PackingListDelProveedor.tsx`
- `app/p/[token]/packlist/route.ts`
- `app/portal/(app)/compras/[code]/etiquetas/page.tsx`
- `components/document-import/DocumentImportPanel.tsx`
- `components/document-import/DocumentEditor.tsx`
- `components/document-import/DocumentCalculator.tsx`
- `components/document-import/document-client.ts`
- `components/document-import/document-import-demo.ts`
- `components/document-import/document-import.module.css`
- `components/document-import/DocumentImportPanel.test.tsx`
- `components/document-import/DocumentEditor.test.tsx`
- `components/document-import/DocumentCalculator.test.tsx`
- `app/portal/(app)/compras/nueva/PurchaseStepDetalle.tsx`
- `app/portal/(app)/compras/[code]/page.tsx`
- `components/TarifasTabs.tsx`
- `app/p/[token]/page.tsx`
- `app/p/[token]/ProviderShareClient.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/index.html`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/fixture.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/README.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/vite.config.ts`

- `app/p/[token]/PackingListFormSection.tsx`
- `app/p/[token]/supplier-flow.test.tsx`
- `app/portal/(app)/compras/[code]/documento/page.tsx`
- `app/portal/(app)/compras/[code]/documento/DocumentReviewClient.tsx`
- `components/document-import/DocumentEditor.test.tsx`
- `app/portal/(app)/compras/nueva/PurchaseStepDetalle.test.tsx`
- `components/document-import/DocumentImportEntry.tsx`
- `components/document-import/DocumentImportEntry.test.tsx`
- `lib/studio/document-import/corpus.test.ts`
- `lib/studio/prealertas/__tests__/packlist-form.test.ts`
- `.env.example`
- `app/cotizador/page.tsx`
- `app/cotizador/CotizadorClient.tsx`
- `app/cotizador/cotizador.test.tsx`
- `app/portal/(app)/compras/[code]/documento/DocumentReviewClient.test.tsx`
- `eslint.config.mjs`

UI/conexiones delegadas a Worker de 0468 en este mismo worktree después de integrar su commit estable;
backend/SQL/legacy/export/spec/handoff permanecen bajo el owner principal. Allowlist disjunta.

Ampliación 2026-09-16 (sesión Claude, al adoptar el worktree): los once últimos archivos se suman a
la allowlist.

`PackingListFormSection.tsx` recibe una prop `prefill` y nada más: el enlace del proveedor llega
cargado con el documento del cliente. Es el alcance mínimo para que el proveedor no transcriba lo
que ya está. **Se descartó reemplazar ese formulario por `DocumentEditor`**: acaba de salir a
producción con SDD-0468 con borradores locales, historial, impresión y adjuntos, y cambiarlo
tiraría ese trabajo. La precarga se aplica sólo si el dispositivo no tiene borrador propio — el
trabajo en curso del proveedor manda siempre. La ruta `compras/[code]/documento/` es la pantalla donde el cliente revisa lo extraído
antes de compartir el enlace; `DocumentEditor.test.tsx` ya estaba en la lista original y sólo faltaba
escribirlo. `DocumentImportEntry` es el envoltorio que decide si la importación se ofrece: mientras
`DOCUMENT_IMPORT_ENABLED` no sea "true" no renderiza nada, así que cablearlo no cambia el flujo manual. `corpus.test.ts` corre contra documentos reales apuntados por `DOCUMENT_IMPORT_CORPUS`
y se salta sin esa variable: los documentos nunca entran a Git. El test cubre `formatPackingQuantity`, que existe porque `total_qty` puede ser nulo
cuando las unidades son heterogéneas; `.env.example` documenta `DOCUMENT_IMPORT_*`, sin las cuales
la API responde 503 a todo. Ninguno cambia comportamiento de Studio: uno es prueba, el otro es
configuración de ejemplo sin valores reales.

### Ampliación 2026-09-17 · El Cotizador, y por qué NO es la calculadora pública

Sam acotó el alcance en esta sesión, con estas palabras: «no vamos a cambiar la calculadora
pública, solo vamos a hacer algo que se llama **cotizador**… cotizador arrojando un archivo PI y
packing list».

Eso **saca de juego a `components/TarifasTabs.tsx` y `components/CalculadoraForm.tsx`**, que seguían
en la allowlist inicial. Quedan intocables: `/tarifas` salió a producción y su flujo —dos pestañas,
CTA directo a WhatsApp, sin guardar nada— no se toca. Entran en su lugar las tres rutas de
`app/cotizador/`.

Son dos pantallas con públicos distintos, y por eso no se funden en una:

| | `/tarifas` (existe) | `/cotizador` (nuevo) |
|---|---|---|
| Entrada | El visitante escribe CBM y kg | El visitante suelta su PI y su packing list |
| Quién lo usa | Quien todavía no compró | Quien ya tiene la proforma en la mano |
| Qué deja | Nada | Un documento que sobrevive 24 h y puede seguir al proveedor |

Meter la carga de archivos dentro de `/tarifas` habría cargado a todo visitante con un flujo que
sólo le sirve a quien ya cerró con su proveedor. Y el cotizador necesita persistencia —el documento
tiene que poder seguir hacia el enlace del proveedor— mientras que `/tarifas` se define por **no**
guardar nada. Fundirlas obligaría a una de las dos a traicionar lo suyo.

`DocumentCalculator.tsx` no calcula: manda `estimate` al servidor, que corre el mismo
`calcularEnvioLCL` de `/tarifas`. Es la única forma de que las dos pantallas no lleguen a decir dos
precios distintos para un mismo envío. El mínimo facturable se muestra como línea propia del
desglose —escondido, la suma de las otras líneas no llega al total— y el valor de la mercancía se
presenta al lado del flete pero **nunca sumado**: sumarlos daría un «costo de importar» que no
incluye aranceles.

`/cotizador` abre workspace **anónimo** (sin `openParams`), que expira en 24 h. Detrás de
`DOCUMENT_IMPORT_ENABLED`: apagada la bandera, la ruta devuelve 404.

`eslint.config.mjs` entra a la allowlist por una sola línea: `app/cotizador/**` no estaba en el
glob que arma la regla de frontera pública, así que sobre esa ruta la regla **ni se armaba** — un
`import` al ERP habría pasado el lint en verde. La ruta ya respetaba la frontera; lo que faltaba
era el guardia.

### El recibo que se hacía pasar por workspace

`save` y `apply` **no devuelven el workspace**: devuelven un recibo — `save_document_workspace` en
la 0457 hace `return receipt`, con `revision`, `confirmed`, `folio`, `versionNo` y `submissionId`.
Sin `id` y sin `draft`.

Dos llamadores lo tipaban como `DocumentWorkspace` y lo adoptaban entero. TypeScript creyó la
anotación y las pruebas no lo vieron porque el doble de `apply` devolvía un workspace completo —
una fixture más amable que el servidor real. Costaba dos fallas que sólo se ven usando la pantalla:

- `DocumentImportPanel`: aplicar una extracción subía un objeto sin `draft`, y el editor de arriba
  se quedaba vacío justo después de aplicar. Ahora el panel relee el workspace (`GET
  action=workspace`) después de aplicar, porque el borrador fusionado sólo existe en el servidor.
- `DocumentReviewClient`: tras **un** guardado el `id` se perdía y el guardado siguiente salía con
  `workspaceId: undefined` → 404 hasta recargar. Ahora fusiona sólo la revisión sobre el workspace
  que ya tiene; el borrador nuevo es el que acaba de mandar.

Los dobles de prueba se corrigieron para responder como el servidor. Ambos arreglos están fijados
por mutación: revertirlos deja `expected undefined to be '0000…0001'`, que es el defecto mismo.

### Ampliación 2026-09-18 · Encender el cotizador: cadencia y alcance de la bandera

Encargo de Sam: «Encender el cotizador desde la proforma (bandera DOCUMENT_IMPORT_ENABLED de
0473): antes hay que revisar de nuevo la cadencia del cron». Worker
`worker-encender-cotizador-0473-claude-20260918`, rama `codex/encender-cotizador-0473`, base
`78410913`. Handoff: `.agents/handoffs/0473-encender-cotizador-20260918.md`.

**La cadencia vuelve a cada minuto.** El 2026-09-17 bajó a `*/5` (PR #133) porque con la bandera
apagada el cron no hace nada. Encendida, el cron es lo único que reintenta un archivo que falló por
algo pasajero y lo único que rescata uno cuyo proceso murió, y el escalón de reintento
(`attempts × 60 s`) está calibrado para un tick por minuto. Con `*/5` un archivo que falla las tres
veces tiene al visitante hasta ~13 min mirando «En cola» antes del error final, contra ~5 con `*`.
El caudal no era el problema (el tope diario es de 100 lecturas); la espera sí. El escalón queda
nombrado (`RETRY_STEP_MS` en `jobs.ts`) y `cron-cadence.test.ts` lo ata a `vercel.json`, junto con
la regla de que el lease de 3 min cubra el `maxDuration` de las dos rutas que procesan.

**La bandera se parte en dos.** `DOCUMENT_IMPORT_ENABLED` no enciende sólo el cotizador: también
la carga en el paso 2 de la compra del portal. Una compra con documento compartido hace que el POST
de `/p/[token]/packlist` responda 409 (control del Director, se conserva), y ningún componente del
proveedor usa hoy la ruta del documento (`x-supplier-token`): el formulario muestra «No pudimos
confirmar el envío» y el proveedor queda sin vía. Por eso:

- `DOCUMENT_IMPORT_ENABLED=true` sola: el cotizador anónimo, su sitemap, su enlace en el footer y el
  cron. Nada ligado a una compra.
- `DOCUMENT_IMPORT_PORTAL_ENABLED=true` además: documentos de compra (paso 2 del portal, pantalla
  `documento`, enlace del proveedor, estimados combinados o guardados). **No se enciende** hasta
  que exista la confirmación del proveedor desde el documento.

La negación es del servidor, no de la UI: `authorizeWorkspace` niega todo actor no anónimo,
`openWorkspace` no crea documentos de proveedor/compra/sesión, `purchases` y el estimado combinado
o guardado se niegan antes de leer nada, la pantalla `documento` es 404, y la ruta del proveedor
sólo falla cerrada ante una lectura caída cuando el portal está encendido. `capabilities` publica
`portal` y `DocumentImportEntry` exige las dos llaves.

**El borrado no depende de la bandera, y el drenaje sigue inerte apagado.** El cron de drenaje
corta antes de `createAdminClient()` con la bandera apagada: es la garantía con la que se integró la
PR #130, verificada contra producción. Pero eso dejaba sin borrar, sin plazo, lo subido en las
últimas 24 h si se encendía y después se apagaba, y el residuo del Preview (que escribe en la base
de producción y no corre crons). Un primer arreglo movió `cleanupImports` antes del corte; el
Director lo objetó con razón: con `* * * * *` eran 1.440 conexiones diarias a producción con la
bandera apagada, y la cadencia de un minuto se justifica sólo por los reintentos, que sólo existen
encendida. Se evaluaron tres salidas:

1. **Un cron de retención aparte, cada hora (elegida).** `/api/cron/document-import-cleanup`
   (`17 * * * *`) limpia con cualquier bandera; el drenaje vuelve a ser idéntico al de `main`.
2. Un solo cron que limpie apagado sólo en el minuto 0: depende de que Vercel invoque puntual; una
   invocación atrasada al minuto 1 se salta la hora completa. Descartada.
3. Dejar la limpieza cada minuto y justificarla: nada la justifica para un vencimiento de 24 h.

Apagado: 24 conexiones al día en vez de 1.440, y 1.440 invocaciones inertes del drenaje (sin base).
Encendido: el drenaje limpia en cada tick como antes y la pasada horaria es idempotente. El
documento deja de ser accesible exactamente al vencer (`authorizeWorkspace`), y el borrado físico
llega, como mucho, una hora después. `cron-cadence.test.ts` exige que la retención exista, corra al
menos cada hora y no lea la bandera.

**Compuerta de privacidad (no es código).** La revisión acotada con `revisar-datos-ve` encontró que
la pantalla no avisa antes de subir, que `/privacidad` no menciona el cotizador, la lectura con IA
ni a Anthropic como destinatario, y que la transferencia fuera de Venezuela no tiene base
documentada. Son decisiones de Sam (y su abogado) antes de encender en producción; el detalle vive en
el handoff de esta ampliación.

**Descubrimiento.** `/cotizador` deja de declararse excluida de buscadores (apagada ya es 404) y
entra al sitemap y al footer («Cotiza con tu proforma», en «Enlaces rápidos») sólo con la bandera
encendida. **Menú principal (founder 2026-09-18: «agrega el cotizador al menú principal»):**
«Cotizador» va después de «Tarifas», en la barra y en el menú móvil, también sólo con la bandera.
`Nav` es componente de cliente y no puede leer la variable, así que `components/Nav.tsx` pasa a ser
un envoltorio de servidor que la lee y renderiza `components/NavClient.tsx` (el componente de
siempre, movido con su historia); los 30 importadores son componentes de servidor, comprobado uno
por uno. La fila de escritorio no entraba a 1024 px (medido: `scrollWidth` 1021 contra 1009; con
sólo bajar el hueco seguía invadiendo 24 px del margen derecho), así que entre `lg` y `xl`, y sólo
con el cotizador, el hueco pasa a 0 y el relleno a 6 px: a 1024 sobran 18 px y quedan 17 px entre el
logo y el primer enlace. Sin scroll horizontal a 320, 360, 375, 1024, 1100, 1279 y 1280. Con la
bandera apagada las clases y los enlaces son exactamente los de antes (prueba + mutantes).

Allowlist de esta ampliación, además de los archivos ya listados que se modifican (`access.ts`,
`service.ts`, `jobs.ts`, `http.ts`, `estimate.ts` y sus pruebas, `DocumentImportEntry` y su
prueba, `vercel.json`, `.env.example`, `app/cotizador/page.tsx`, `app/p/[token]/packlist/route.ts`,
`app/portal/(app)/compras/[code]/documento/page.tsx`, `PurchaseStepDetalle.tsx`):

- `app/sitemap.ts`
- `components/Footer.tsx`
- `components/Footer.cotizador.test.tsx`
- `app/__tests__/sitemap-cotizador.test.ts`
- `app/p/[token]/packlist/route.test.ts`
- `app/portal/(app)/compras/[code]/documento/page.test.tsx`
- `lib/studio/document-import/cron-cadence.test.ts`
- `app/api/cron/document-import-drain/route.test.ts`
- `app/api/cron/document-import-cleanup/route.ts`
- `app/api/cron/document-import-cleanup/route.test.ts`
- `components/Nav.tsx`
- `components/NavClient.tsx`
- `components/Nav.cotizador.test.tsx`
- `__tests__/seo-remates.test.ts` (sólo la ruta: la lista de enlaces pasó a `NavClient.tsx`)
- `.agents/handoffs/0473-encender-cotizador-20260918.md`

## Aceptación

### Continuación autorizada 2026-10-21 · Portal y confirmación del proveedor

Sam pide terminar el documento compartido antes de activar producción y mejorar la presentación
del portal: cliente carga/revisa/guarda; proveedor abre la revisión compartida, corrige peso bruto
y CBM, confirma e imprime etiquetas. Owner `worker-packing-portal-20261021`, rama
`codex/packing-list-portal-confirmacion-20261021`, base `d410ab2e`.

Esta etapa sustituye la precarga parcial al formulario local para compras gestionadas: el editor
normalizado conserva IDs, fuentes, unidades y moneda; los borradores locales antiguos nunca mandan
sobre el documento compartido. Las compras sin workspace conservan el flujo legacy. Etiquetas
finales requieren revisión confirmada y cajas físicas consultadas en servidor. No se activan
banderas productivas ni se aplican migraciones en esta etapa.

Allowlist exacta de esta etapa:

- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `.agents/handoffs/0473-portal-confirmacion-20261021.md`
- `app/p/[token]/page.tsx`
- `app/p/[token]/ProviderShareClient.tsx`
- `app/p/[token]/SharedSupplierDocument.tsx`
- `app/p/[token]/SharedSupplierDocument.test.tsx`
- `app/p/[token]/page.shared-document.test.tsx`
- `app/p/[token]/SupplierUploadSection.tsx`
- `app/p/[token]/SupplierUploadSection.test.tsx`
- `app/p/[token]/supplier-flow.test.tsx`
- `app/portal/_components/ShareProviderButton.tsx`
- `app/portal/(app)/compras/nueva/PurchaseStepDetalle.tsx`
- `app/portal/(app)/compras/nueva/PurchaseStepDetalle.test.tsx`
- `app/portal/(app)/compras/[code]/page.tsx`
- `app/portal/(app)/compras/[code]/documento/DocumentReviewClient.tsx`
- `app/portal/(app)/compras/[code]/documento/DocumentReviewClient.test.tsx`
- `app/portal/(app)/compras/[code]/_components/PackingListDelProveedor.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/page.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/LabelsClient.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/LabelsClient.test.tsx`
- `app/portal/(app)/compras/[code]/page.test.tsx`
- `components/document-import/DocumentEditor.tsx`
- `components/document-import/DocumentEditor.test.tsx`
- `components/document-import/DocumentImportPanel.tsx`
- `components/document-import/DocumentImportPanel.test.tsx`
- `components/document-import/DocumentImportEntry.tsx`
- `components/document-import/DocumentImportEntry.test.tsx`
- `components/document-import/document-client.ts`
- `components/document-import/document-client.test.ts`
- `components/document-import/document-import.module.css`
- `lib/studio/document-import/service.ts`
- `lib/studio/document-import/service.test.ts`
- `lib/studio/document-import/http.ts`
- `lib/studio/document-import/http.test.ts`
- `lib/studio/document-import/migration.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/index.html`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/fixture.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/server.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/database.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md`

Riesgo R3: identidad por sesión/capacidad, CAS y confirmación transaccional, etiquetas de revisión
vigente. Cumplimiento previsto de FRM-01/ERR-01/LOD-01/A11Y-01/VIS-01/VIS-02/IA-01/AUD-01:
estados explícitos, errores recuperables, foco y controles legibles, revisión humana antes de aplicar
extracción y trazabilidad conservada. No aplica modificar contratos comerciales ni cotizador público.
La fixture usa exclusivamente identidades/documentos sintéticos, persistencia SQL efímera y un
transporte local identificado; no acredita Supabase/Storage/IA productivos ni WeChat.

- Fixtures sintéticas XLSX DTD/ajeno/chino, CSV, PDF digital/escaneado mock explícito; mezcla
  factura+packing, duplicados, unidades, totales y grupos mixtos; no IA real con PII.
- Subir, revisar faltante, corregir, compartir entre dispositivos, proveedor confirmar y exportar.
- Conflictos de revisión, fallo parcial, lease/retry, permisos cruzados, expiración y cuotas.
- Caja física vinculada al grupo sin renumerar recibidos; confirmación y etiquetas bloqueadas si
  falta caja/peso bruto/CBM/asignación. Varias compras calculan un único envío.
- UI-check, 375/390px, teclado/foco, claro/oscuro, pruebas pertinentes y `pnpm verify`.
- Chino operativo y WeChat real NO verificados hasta ejecutarse. Migración/merge/deploy separados.

## Gobernanza y evidencia

Cambio Studio acotado al lector de packing list: mostrar cantidades por unidad y no sumar unidades
heterogéneas. Filas JSONB admiten uom aditivo; totales legacy heterogéneos usan NULL (no cero ficticio).
Sin uom histórico conserva pcs. NUM-01/FRM-01/IA-01: unidad explícita preservada, desconocida pendiente;
grupos idénticos de piezas requieren cantidades enteras por caja.

IA-01 I2: preview humana antes de aplicar; nunca envío/confirmación automática. Datos de documentos
no son instrucciones. Auditoría sin prompts completos, secretos ni contenido de documentos en logs.
Riesgo R3 de identidad/logística; validación proporcional documentada en handoff. Lectura de producción,
llamadas IA reales con datos cliente y publicación en bóveda compartida fuera de autorización.

## Seguimiento local P2 · 2026-10-21 · Checkpoint previo a publicación

Asignación del Director general transmitida por el Director de esta tarea. Owner
`worker-packing-portal-20261021`, misma rama/worktree/PR #319. Padre exacto del checkpoint local:
`b325e203dc7af1f1f93f0c28e2e811f1bc5ba4fa`. Las 38 rutas y evidencias de la entrega anterior se
conservan como historial; no amplían la allowlist de esta ventana.

Allowlist exacta del seguimiento:

- `components/document-import/DocumentImportPanel.tsx`
- `components/document-import/DocumentImportPanel.test.tsx`
- `app/p/[token]/SharedSupplierDocument.tsx`
- `app/p/[token]/SharedSupplierDocument.test.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `.agents/handoffs/0473-portal-confirmacion-20261021.md`

P2_1: recuperar la propuesta de un trabajo ready/partial recibido idempotentemente cuyo primer
GET job falla. El sondeo debe reprogramarse sin volver a subir, sin aplicar automáticamente y
sin perder preview/aplicación manual. Cancelar timers e ignorar respuestas pendientes al desmontar
o cambiar workspace; nunca consultar el job de otra compra con el workspace nuevo. La transición
null → workspace creado por el propio panel debe conservar la carga en un padre que realmente
actualiza esa prop. Las guardas de vida de operaciones se limitan a impedir que aperturas/subidas
de la sesión anterior continúen o publiquen estado después del desmontaje.

P2_2: tras 409 y producto abierto, adoptar explícitamente una revisión borrador o confirmada debe
reiniciar juntos la guarda editingProduct del padre y la identidad del editor editable. Remontar
desde SharedSupplierDocument evita conservar edición, vista o formulario interno del documento
descartado. DocumentEditor se lee pero no se modifica. Los oráculos usan ese componente real y
exigen volver a cargo, sin formulario viejo, con Continuar disponible y datos adoptados.

Secuencia autorizada: lectura/autoría estática y pruebas escritas SIN EJECUTAR → un checkpoint
local con el padre exacto anterior → revisión específica del Director general antes de cualquier
push/actualización de PR o validación posterior. Las validaciones anteriores acreditan b25a4660a,
no este seguimiento. No se ejecutan tests, tipos, lint, verify, build, E2E, navegador, SQL,
instalación ni censo/runtime nuevos. M1 conserva el turno global, supervisión UNKNOWN.
Sin subagentes, cambios de diseño, SQL/RPC/contratos, envíos, main, merge, producción ni reinicio
o alteración de datos de la demo 4320/4321. FRM-01/ERR-01/LOD-01: recuperación y descarte explícitos;
la conformidad ejecutable del seguimiento queda pendiente de la ventana de validación autorizada.

Autoría guardada para revisión: ronda de sondeo secuencial que reprograma el siguiente tick también al
rechazar GET; sesión interna por identidad de workspace y guardas de vida para operaciones
pendientes; generación del editor editable y guarda padre reiniciadas juntas al adoptar una
revisión. El contrato HTTP no incorpora AbortSignal: una solicitud ya emitida puede concluir,
pero su respuesta se ignora y no inicia trabajo posterior en la sesión descartada.
Se escribieron nueve casos de regresión SIN EJECUTAR: ready y partial con primer GET fallido;
cancelación del timer al desmontar; respuesta GET posterior al desmontaje; A→B con GET antiguo
pendiente; padre real null→abierto; apertura tardía descartada; adopción borrador y confirmada
con DocumentEditor real, sin formulario anterior y con navegación/guardado posteriores.

### Dictamen estático y precisión del sondeo · 2026-10-21

Según el Director general y dos peers, ambos P2 originales quedaron atendidos POR FUENTE en
`fd0eeada16157f77f83bf84115ac1d6788bf1aab`; sus hashes y alcance fueron aprobados estáticamente.
Los nueve casos escritos corresponden a los hallazgos y permanecen NO EJECUTADOS. Este dictamen
no acredita aceptación funcional ni autoriza publicación. La evidencia histórica de b25a4660a
no cubre fd0eeada ni este hijo documental; M1 mantiene la espera de validación.

«Secuencial» describe la ronda de cada efecto, no exclusión global de peticiones en vuelo.
Con varios archivos, el patch del primer GET cambia entries y reinicia el efecto mientras otro
GET de la ronda anterior puede seguir pendiente. Si tarda más de pollMs, puede emitirse otro GET
del mismo trabajo. La respuesta vieja se ignora correctamente; HTTP ya emitido no se aborta
físicamente. Según esa revisión, esta interacción YA EXISTÍA antes del checkpoint.

FUERA DE ALCANCE DETECTADO: ese residual preexistente de solicitudes superpuestas entre rondas.
Se registra sin corregir producto, cambiar el sondeo o agregar un décimo caso en este seguimiento.
Hijo documental autorizado de fd0eeada, sin amend, limitado a esta spec y
`.agents/handoffs/0473-portal-confirmacion-20261021.md`; los cuatro blobs de código/pruebas se
conservan exactamente. Sin ejecución, push, actualización remota/PR ni cambios en la demo.

## Etapa B · PDF confirmado y etiquetas · 2026-10-21 · Sólo fuente

Orden directa de Sam, asignada por el Director de Packing; Director general notificado.
Misma rama/worktree/owner y PR #319, base de autoría `53965778c7acf4671d241d1fe3c88d24549f0b20`.
Objetivo: descargar PDF real del Packing List + Factura y de las etiquetas confirmadas desde los
mismos datos y códigos físicos, sin reemplazar impresión o legacy. No modifica SQL/RPC/warehouse.

Contrato aditivo: GET `action=pdf`, `surface=packing-list|labels`, `workspaceId`, `expectedRevision`.
Autorización actual y gate getDocumentLabels antes de renderizar; nueva comprobación después del
render. Una revisión obsoleta produce 409 y ningún PDF. Respuesta application/pdf privada/no-store.
download(workspaceId, options?) conserva XLSX cuando no hay opciones. Botones PDF gestionados se
bloquean al editar/guardar, con cambios locales o revisión no confirmada. Error recuperable en UI.
PDF con compra/revisión/folio/versión, productos y códigos primero; cantidades/importes por
asignación al grupo, logística una sola vez por grupo, totales una sola vez. No incluye fuentes
privadas, identidad del cliente ni códigos inventados. Las etiquetas vienen únicamente del gate.

CJK exige DOCUMENT_IMPORT_PDF_CJK_FONT_PATH explícita del servidor. Sin ruta válida/fuente/glyphs,
503 pdf_font_unavailable; no sustituir ni omitir caracteres silenciosamente. Sólo la futura prueba
local podrá usar Deng existente sin copiarla. No hay fallback Windows ni fuente redistribuida;
portabilidad del servidor sigue pendiente. Se usan renderer/qrcode ya instalados, sin dependencias.

Allowlist exacta ÚNICA de B (17 rutas):

- `.env.example`
- `lib/studio/document-import/pdf.tsx`
- `lib/studio/document-import/pdf.test.tsx`
- `lib/studio/document-import/http.ts`
- `lib/studio/document-import/http.test.ts`
- `components/document-import/document-client.ts`
- `components/document-import/document-client.test.ts`
- `app/p/[token]/SharedSupplierDocument.tsx`
- `app/p/[token]/SharedSupplierDocument.test.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/LabelsClient.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/LabelsClient.test.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/pdf-proxy.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/pdf-proxy.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `.agents/handoffs/0473-portal-confirmacion-20261021.md`

La fixture prepara interceptor PDF SSR en 4321 sobre el backend existente 4320. No nuevo 4322,
no reinicio/reset ahora. PDF de entrada sin IA conserva el fallo recuperable real. El caso previsto
mixto tiene 10 cajas/220 pcs/USD340; corregir grupo A a 52 kg/.28 y revisar el declarado .66 permite
confirmar 130 kg/.70, sin esconder discrepancias. QR: payload/destino/código verificables;
decodificación de píxeles/escaneo físico pendientes, no acreditados por generar QR.

Secuencia autorizada de B: hasta 45 minutos de autoría/inspección y pruebas escritas SIN EJECUTAR,
checkpoint local selectivo, revisión del diff por Director antes de publicar. Sin redes, render,
tests, tipos/lint, verify, instalaciones, servidores ni reinicio de demo hasta GO runtime específico
del Director general. La ventana PACKING9 cerrada no se reutiliza. Las evidencias anteriores sólo
acreditan sus SHAs/casos. FRM-01/ERR-01/LOD-01/IA-01: intención de cumplimiento por fuente;
validación ejecutable de B y aceptación pendientes. Sin merge, despliegue, migraciones ni producción.

### Autoría B preparada para checkpoint · Sin runtime

Se escribieron el renderer cerrado, puerta HTTP y proxy de fixture, transporte compatible con
XLSX y las dos acciones PDF en proveedor/portal. HTTP reautoriza workspace/tenant/compra y relee
revisión/submission/códigos tras renderizar; la fixture relee sus dos recursos de autoridad. Ninguno
envía el buffer si cambian. El modelo usa cantidades asignadas e importes de sus líneas con el
redondeo del exportador XLSX; logística una vez por grupo. El documento largo conserva filas con
salto de página automático; su inspección real permanece pendiente, no inferida de JSX.

Fuente CJK obligatoria: se comprueban archivo, glyphs y flags de embedding noEmbedding,
noSubsetting y bitmapOnly. No acredita licencia ni disponibilidad del servidor de producción.
Wordmark usa ArchivoBlack local con DTD vino/Cargo tinta; latinas y paleta existentes. Los PDF
contienen sólo supplier.company/contact/email/wechat/phone/address/city, productos, grupos,
Shipping Mark, compra/revisión/folio/versión y códigos permitidos; no sources, identidad cliente,
tokens, nombres de originales o rutas del servidor. Finalidad: salida de la compra confirmada;
acceso: los actores que ya autoriza el workspace. Retención del archivo descargado y permisos
reales de producción NO VERIFICABLES en esta demo; no se amplía una auditoría legal ni DB.

Se escribieron49 instancias B en seis archivos, seleccionables por `-t 'SDD-0473 B'`:
pdf.test.tsx12, http.test.ts9, document-client.test.ts5, SharedSupplierDocument.test.tsx10,
LabelsClient.test.tsx5, pdf-proxy.test.ts8. Todas **NO EJECUTADAS**. Tres renders reales requieren
fuente explícita; incluyen60 productos únicos y manifest externo si TEST_OUTPUT_DIR está
configurado. La futura revisión de páginas,60 códigos, QR por píxeles y PDF descargados del portal
es distinta de esos tests sintéticos. El README fija comando, procedencia y presupuesto propuesto
de480s ejecución +60s cierre, una pasada sin retry, sujeto a ventana específica del Director general.
No discovery, parser, render, instalación, prueba o servidor se ejecutó para esta etapa.

La futura actualización requiere reinicio autorizado únicamente de4321, conservando4320/SQL.
FontPath se proporciona explícitamente al iniciar. Vite fija origen de QR de GUI/PDF al loopback
de QA_PORT: en4321 es http://127.0.0.1:4321 con c/n/b; no acredita trazabilidad pública en producción.
PDF entrada/IA, licencia/portabilidad CJK, paginación e inspección visual, QR digital/físico,
chino operativo/WeChat, tipos/lint/verify y aceptación permanecen pendientes. La evidencia
histórica b25/PACKING9 no se presenta como validación de B. Sin publicación hasta revisar el diff.

Contrato de acciones B (BTN-01): download-packing-pdf/download-labels-pdf, verbo Descargar,
salida archivo de la revisión confirmada, rol secundario ghost, riesgo R2 de exportación dentro
del flujo R3 de identidad/revisión. Permanencia/fricción destructivas no aplican: lectura sin
mutación DB ni emisión nueva. Permiso workspace autorizado; precondiciones doble gate, sin
cambios locales/producto abierto/guardado en curso. HTML button type=button, estado Preparando…
y aria-busy, error persistente503/409, afterSuccess=stay. No se anuncia recepción/impresión
completada por disparar una descarga. No se agrega audit de negocio: no cambia documento,
revisión ni códigos; auditoría/retención de exportaciones de producción no se acredita aquí.

## Corrección B1 · Fuentes estáticas para PDF · 2026-10-22 · Sólo autoría

Asignada por Director de Packing con adopción del paquete aprobada por Director general. Padre
directo exigido93e738ec4d94c2ba590728ed82459a641d0034e3, mismo Worker/worktree/rama/PR319.
Autoría iniciada04:50:52Z, máximo30min; checkpoint local selectivo, sin push ni runtime.

Evidencia preservada: B1 ejecutó49,46PASÓ/3FALLÓ/0SKIPseleccionado/38fuera; los tres renders
reales fallaron en fontkit2.0.4 subset/embedding con DataView RangeError. PROBE5 independiente
procesó las cinco fuentes: DengTTF y ArchivoBlackWOFF2estática codificaron sus cadenas; las tres
WOFF2variables Nunito/Sora/JetBrains reprodujeron exactamente el error en subset.encode. Ningún
carácter faltaba en las cinco. Es diagnóstico acotado; no implica compatibilidad universal de
WOFF2 ni aceptación del PDF. No se atribuye el fallo exclusivamente a Deng.

El arreglo incorpora las cuatro TTF estáticas primarias aprobadas, mismas familias y pesos
400/600/400/400, sin conversión ni modificación de sus bytes. Sólo el renderer PDF las consume.
Las cuatro OFL se conservan verbatim dentro de lib/font-files/pdf/README.md con URL, commit,
Gitblob, SHA256 y tamaño. Fuentes web/CJK/env/contratos/QR/SQL permanecen bajo el alcance anterior.
El loader rechaza contenedores/ejes incompatibles con503seguro, sin ruta o detalles internos;
conserva verificación de glyphs y embedding. Audita formatos/ejes/peso de las cinco caras sin paths.

Allowlist exacta de esta corrección,22rutas (17B+5assets, sin autorizar cambios ajenos):

- `.env.example`
- `lib/studio/document-import/pdf.tsx`
- `lib/studio/document-import/pdf.test.tsx`
- `lib/studio/document-import/http.ts`
- `lib/studio/document-import/http.test.ts`
- `components/document-import/document-client.ts`
- `components/document-import/document-client.test.ts`
- `app/p/[token]/SharedSupplierDocument.tsx`
- `app/p/[token]/SharedSupplierDocument.test.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/LabelsClient.tsx`
- `app/portal/(app)/compras/[code]/etiquetas/LabelsClient.test.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/pdf-proxy.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/pdf-proxy.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `.agents/handoffs/0473-portal-confirmacion-20261021.md`
- `lib/font-files/pdf/nunito-sans-400.ttf`
- `lib/font-files/pdf/sora-600.ttf`
- `lib/font-files/pdf/jetbrains-mono-400.ttf`
- `lib/font-files/pdf/archivo-black-400.ttf`
- `lib/font-files/pdf/README.md`

Se conservan los49casos y sus3renders; se añade cobertura negativa de formato/ejes. Esta autoría
no ejecuta tests/render/tipos/lint/verify/UI/servidores ni instala fuentes. La nueva selección exacta
y el checkpoint se entregan para otra ventana480+60propuesta, sin reutilizar B1/PROBE5.

Autoría guardada: cuatroTTF copiadas sin cambio deSHA/Gitblob y cuatroOFLverbatim en README.
El renderer consume únicamente las TTFPDF, rechaza formato/ejes/CFF incompatibles antes de
usar glyphs y audita formato/ejes/peso sin paths. La negativa CJK existente usa ahora NunitoTTF
estática para seguir ejercitando ausencia de glyphs. Se preservan los49casos y sus3renders,
fortalecidos con auditoría de las cinco caras y pesos; dos negativas nuevas cubren contenedores
incompatibles y variaciones. **51instancias propuestas, todas NO EJECUTADAS sobre el nuevo hijo**:
pdf14, HTTP9, transporte5, proveedor10, portal5, proxy8. El filtro y seis archivos siguen iguales.
Fuente/SDD/handoff/readme se cierran con guard/diff estáticos; runtime/aceptación pendientes.

## Seguimiento P2 de presentación PDF · 2026-10-22 · autoría local sin runtime

Autorización del Director general después de revisar las once páginas de B3. Padre directo
exigido:4ee35b9266d2fe999f0ea16d2382d58cefa0f7a9, mismo Worker/worktree/rama/PR319.
Guard y claim propios worker-packing-portal-20261021 a06:37:10Z, sin desplazar owner.

Allowlist exacta de este seguimiento (cinco rutas, subconjunto de las22anteriores):

- `lib/studio/document-import/pdf.tsx`
- `lib/studio/document-import/pdf.test.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md`
- `.agents/handoffs/0473-portal-confirmacion-20261021.md`

Contrato: corregir únicamente presentación del documento. Mantener cabecera y logística del
grupo junto con su primera fila; las demás filas deben poder paginar. Repetir contexto de
compra/Shipping Mark/folio/revisión y columnas en las páginas de continuación. Compactar
proveedor con campos legibles, sin forzar todos los documentos a una página. Conservar nombre
del producto primero/código después y contexto del grupo en las filas que continúan. No perder
productos, datos comerciales/logísticos, monedas ni unidades. No alterar fuentes, CJK, licencias,
modelo, totales, endpoints, revisiones, confirmación, SQL, QR o layout de etiquetas.

Evidencia previa preservada: B1sobre4ee aprobó51/51focales y3renders; su cierre Worker fue
administrativamente tardío. B2generó PDF reales rev3/V1/folioDTD-PL-2026-0001,10cajas/220pcs/
USD340/130kg/.70; bitácora administrativa INCOMPLETA recuperada TARDÍAMENTE. B3ejecutó7pasos
con7exits0, QR10/10y10códigos únicos; Root/General hicieron exteriores oportunos. Cierre Worker
B3 tardío. Revisión manual de TODASlas11PNG: documento2páginas FALLÓ por grupoB huérfano y
exceso de espacio; etiquetas2páginas PASARON; largo7páginas/60códigos íntegros, continuidad a
mejorar. Esa integridad no sustituye la aceptación visual. No reescribir estos resultados.

Plan de autoría: estilos exclusivos del documento, encabezado fijo con columnas, proveedor en
dos columnas y bloque indivisible limitado a cabecera/logística/primera fila de cada grupo.
Cada fila conserva su grupo para identificar las continuaciones. Se preservan51casos/3renders;
se añaden dos regresiones con renderer REAL y observación de sus páginas calculadas: caso
compacto3productos/2grupos y caso largo60filas sin truncar/con encabezados. No tests de espejo
de estilos/props ni cambios de esquemas de salida anteriores. Dos nuevos PDF/manifiestos de
prueba serán artefactos sintéticos separados de las descargas reales.

Sólo se autoriza fuente/lectura estática/commit selectivo hijo de4ee y READY de una futura
selección; pruebas, renders, tipos/lint/verify/UI/descargas/restarts/push NO EJECUTADOS aquí.
El workspace compartido confirmado rev3/V1 y sus10códigos se conservan; no guardar/reconfirmar.
Autoría terminada, sin ejecutar: se aislaron estilos del documento, cabecera/columnas fijas,
proveedor en dos columnas y bloque inicial de cada grupo con su primera fila. Las filas restantes
pueden paginar y llevan identificación del grupo. Rama de etiquetas y StyleSheet anterior
conservados literalmente; fuentes, CJK, modelos, cálculos, QR y contratos sin cambios.

Se conservaron los 51 casos y tres renders originales. Se escribieron dos casos aditivos con
renderer real: muestra de tres productos/dos grupos y siete campos del proveedor más fecha,
compacta en una página para esa muestra; documento de sesenta productos en dos grupos con
cabeceras, columnas, identificación y primera fila coherentes, sin truncar códigos. El adaptador
de prueba sólo observa onRender del renderer instalado, nunca fabrica layout o bytes PDF.
Selección propuesta: 53 instancias / 6 archivos / 5 renders reales, filtro SDD-0473 B,
pdf16 + HTTP9 + transporte5 + proveedor10 + portal5 + proxy8; cero SKIP seleccionado esperado
con la fuente CJK explícita. Todos los nuevos resultados están NO EJECUTADOS. La aceptación
real y visual queda pendiente de nuevo GO, sin reutilizar ventanas cerradas ni salidas previas.
## Seguimiento local: recuperar el recibo confirmado al reabrir · 2026-10-22

Autorización concreta del Director general: opción B, hijo directo de
004a52246771d474deec3ddefb7f7d4fb1d44517, mismo Worker/worktree/rama/PR319. Claim canónico
propio y guard antes de editar; cuatro copias/preimages sellados fuera Git en receipt-hydration-004a.

Allowlist exacta de esta etapa, subconjunto de las 22 rutas previas:

- `app/p/[token]/SharedSupplierDocument.tsx`
- `app/p/[token]/SharedSupplierDocument.test.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `.agents/handoffs/0473-portal-confirmacion-20261021.md`

Diagnóstico por fuente: el DTO workspace no entrega folio/versión; el estado local receipt/labels
comienza vacío y adopt lo limpia. Sólo confirmar o consultar etiquetas recupera esa metadata.
El fallback observado después de recargar ya existía en b25, no es pérdida DB probada ni causado
por el renderer. GET labels existente es lectura, valida revisión y códigos físicos vigentes;
no genera códigos, confirma ni modifica cajas. PDF/proxy usan ese gate, independientes del recibo UI.

Contrato: hidratar sólo metadata estrecha y tipada desde GET labels al cargar una revisión
confirmada, con identidad actual de compra/workspace/transporte/revisión y expectedRevision.
Conservar guardas loaded/dirty/conflict/desmontaje/cancelación; ninguna respuesta vieja puede
restaurar folio o provocar conflicto sobre otra revisión o edición. No fabricar DocumentReceipt,
abrir automáticamente grilla/impresión, alterar save/confirm/descargas, ampliar DTO/endpoints,
generar códigos o modificar el documento. 409 exige comparación explícita; fallo temporal tiene
recuperación sin perder datos. Preservar los 53 oráculos previos y añadir regresiones observables.

Evidencia previa conservada: 53/53 y cinco renders aprobaron sobre 004a; no es aceptación visual
real del PDF actualizado. Layout 4ee falló; etiquetas/QR 10/10 aprobaron. B2 posterior se detuvo
antes de descargar al observar fallback confirmado Rev3 sin folio/versión en AX; PNG02 no
encuadra ese target. Root post 07:20:22 fue oportuno, aviso/custodia TARDÍOS a07:23:54.2261040Z;
General exterior NO EJECUTADO. No rehabilitar ese cierre ni alterar confirmación rev3/V1.

Sólo autoría y Git estático en esta etapa. Ningún test/render/tipo/lint/build/UI/API/restart,
descarga/push o escritura de negocio hasta nuevas autorizaciones específicas.
Autoría terminada sin runtime: ReceiptMetadata es una proyección estrecha de revision/folio/
versionNo, ligada al workspace y scope del transporte inicial. La consulta sólo se inicia con
workspace cargado y confirmado, sin dirty/conflict/edición de producto y con identidad actual.
Se conserva el recibo real de confirmar; GET no fabrica DocumentReceipt ni abre grilla/print.
Generación, limpieza del efecto y mounted impiden adoptar respuestas viejas tras editar/adoptar,
cambiar compra o desmontar. Se comprueba revisión y metadata básica;409 exige comparar y503
ofrece Ver etiquetas como recuperación existente. La cancelación es lógica: no se promete abortar
físicamente un HTTP ya emitido. No se modificó el contrato del cliente o servidor.

Se preservaron las aserciones/títulos originales. El doble GET labels histórico se alineó con
expectedRevision (antes respondía siempre3 incluso para workspace confirmado1); las respuestas
obsoletas tienen ahora una negativa explícita. El helper ready vacía efectos React inmediatos
antes de programar errores de otra acción, sin omitir aserciones ni esperar promesas pendientes.
Se escribieron ocho instancias aditivas: montaje sin grilla; recarga; otra compra/desmontaje;
edición durante lectura; adopción de revisión nueva;409; revisión de respuesta incorrecta;503
recuperable. Selección propuesta61/6, reparto16/9/5/18/5/8, cinco renders anteriores idénticos.
Todas las pruebas de este nuevo hijo están NO EJECUTADAS;53PASÓ sólo acredita004a.
## Cierre de aceptación local · 2026-10-22 · fuente ejecutada cbe7636

Etapa documental autorizada por el Director general, hijo directo de
`cbe76365407fa2ca9608a93d7dbe28f162089011`. Claim canónico propio antes de guard y tres copias
con SHA256 anteriores a la edición. Allowlist exacta de este cierre:

- `.agents/handoffs/0473-portal-confirmacion-20261021.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md`

Este hijo sólo documenta resultados. No representa otra fuente de producto ejecutada, otra
corrida, integración, migración, activación o despliegue. Los registros históricos NO EJECUTADO,
fallos y cierres tardíos anteriores se conservan con su fecha y alcance.

Aceptación local con datos ficticios, componentes reales y autoridad SQL de la demo:

| Comprobación | Resultado y alcance |
| --- | --- |
| B1 sobre cbe7636 | PASÓ:61/61,0 fallos,0 SKIP seleccionado,38 fuera del filtro;6 archivos,5 renders,1 corrida,0 reintentos. Native0 y wrapper0/incompleteFalse. No equivale a toda la suite o verify. |
| Recibo al reabrir | PASÓ: folio DTD-PL-2026-0001 / Rev3 / V1 aparece automáticamente tras recargar, antes de Ver etiquetas. No se volvió a guardar ni confirmar. |
| Cliente y proveedor | PASÓ: mismo documento con10 cajas,220pcs,USD340,130kg y0.70m³; diez códigos físicos originales conservados. |
| Descarga PDF real | PASÓ: una descarga,41579bytes,SHA256063def8bebe704a7920980c16fddb0294325850d3c0e03d826ece3cdffe3e33f. Una página,3 productos/2 grupos; A4cajas/52kg/.28 y B6cajas/78kg/.42. El grupoB huérfano anterior quedó resuelto. |
| B3 y visual completa | PASÓ:7 pasos nativos exit0,wrapper0/incompleteFalse; Root y General revisaron todas las14PNG:documento1+compacto1+LONG6+PAGE6. Sin hallazgosP1/P2. |
| Documentos largos | PASÓ:60 códigos únicos y ordenados en LONG y PAGE,600pcs/USD600/Rev4V2,continuidad legible. Son fixtures sintéticos distintos de la compra real de la demo. |
| Etiquetas y QR conservados | PASÓ digital anterior:10/10 únicos desde píxeles, sin navegar destinos. No se redescargaron ni decodificaron de nuevo en esta aceptación; layout/códigos permanecieron intactos. |

La observación P3 de acercar las columnas a los productos en primera página es pulido futuro;
no se cambió el candidato revisado. Precios del PDF real:120+40+180=340; compacto de test:
160+60+120=340. No intercambiar esos artefactos aunque coincidan los totales.

Custodia clasificada por separado: B1 tuvo ownclosure/RootPOST/formal/General oportunos; el
complemento extendido Worker quedó NO EJECUTADO por cap y no existe worker-return. El watcher
Root corrigió sólo Parse de fechas con DateKind String, sin repetir producto. B2 tuvo UIend y
exteriores oportunos, pero su extended receipt se detuvo al primer control de cap; no existe
run.receipt y su suplemento de custodia se guardó explícitamente tarde. B3 completó recibo y
exteriores dentro de plazo. Esos límites administrativos no se rehabilitan con la visual aprobada.

La muestra XLSX DTDv2 fue funcional en el recorrido real. Extracción positiva de PDF de entrada:
NO DISPONIBLE en la demo sin adaptador; su error conservó datos. El workbook original prefijado
sigue como compatibilidad pendiente, no se declara OOXML inválido. `pnpm verify` sobre cbe7636,
build canónico actual, papel/cámara/WeChat, revisión humana de chino, licencia/portabilidad CJK
servidor y producción siguen NO EJECUTADOS o NO ACREDITADOS. Sin aprobación de merge/deploy.
Evidencia, hashes y pendientes detallados en el handoff propio y README de QA. Graphify,
Archify y publicación/revisión visible en Obsidian no quedaron acreditados por esta aceptación.
## Etapa 2026-10-22 · Lectura PDF real en QA aislada (autoría ligera)

Autorización directa de Sam y asignación del Director de Packing, coordinada con el Director
General. Se adopta el mismo Worker/owner, worktree, rama y PR319 desde e060f6d. Esta etapa no
reabre ningún GO anterior ni cambia la aceptación histórica CBE. Allowlist EXACTA de ocho rutas:

- docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/extraction-config.ts
- docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/extraction-config.test.ts
- docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts
- docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/server.ts
- docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/server.test.ts
- docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md
- docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md
- .agents/handoffs/0473-portal-confirmacion-20261021.md

Contrato: opt-in explícito de QA para usar el lector Anthropic existente con clave/modelo de
pruebas suministrados al proceso, sin envFile ni carga general de .env. La instancia positiva
será independiente y en otro origen; no proxy al backend4320 ni puerto4320/4321. Deshabilitado
por defecto, elimina ambas variables heredadas. La instancia opt-in acepta sólo PDF, mantiene
propuesta/revisión humana y no aplica ni confirma automáticamente. Un uploaded repetido en
processing/ready/failed no vuelve a extraer; retry requiere nuevo job explícito. Errores conocidos
preservan identidad del DocumentImportError exportado por SSR; desconocidos se convierten a
extraction_unavailable, sin mensajes/cuerpos/stacks/credenciales del proveedor en las respuestas.
No cambia lector, DTO, SQL, UI, cálculos ni contratos de producción. Caso previo rev3/V1 y códigos
se preservan. Fuente y pruebas se escribirán sin ejecutarlas; la lectura positiva real necesita
credencial/modelo de pruebas y GO de runtime nuevo. No simular JSON ni inferir éxito por unit tests.
Autoría terminada por fuente, NO EJECUTADA: configureQaExtraction sólo devuelve pdfEnabled; fail-fast
sin clave/modelo o con puerto/proxy no aislados. Vite mantiene envFile:false. Middleware preserva
processing antes del await; repetición terminal no reextrae y PUT comprueba estado de nuevo al
terminar el body. Test nuevo de esa carrera usa stream retenido; CSV/XLSX por defecto conservados.
Se escribieron25 instancias (config13/server12). Con14 casos existentes del adaptador Anthropic,
selección propuesta39 en3 archivos por filtro SDD-0473 PDF QA|Anthropic document adapter boundary,
retry0/1worker/sin paralelismo. Son pruebas unitarias con IO doblado; no acreditan IA real.
Receta externa crea proforma ficticia nueva2p/10cajas/192pcs/USD390/140kg/.80m³, con procedencia
impresa por página y oracle de autoría separado de DocumentDraft. Receta/marker/generación/PNG
siguen NO EJECUTADOS. Presupuesto propuesto: focales180s+60cierre; muestra120s+60cierre, sujetos a
GO nuevo. No hay credencial/modelo de pruebas disponibles en las ubicaciones autorizadas. No se
copiaron valores de .env.example ni secretos, no se consumió el SDK ni se levantó otro proceso.
La prueba digital positiva y cualquier prueba escaneada siguen pendientes. La etapa no modifica
capacidades del portal real ni DTO/lector/SQL; PDF-only corresponde exclusivamente al banco QA.
## Cierre local de QA PDF · GO02 · 2026-10-22

Fuente de producto ejecutada: f43ae5e7e9d1ea852d58396844892a70844d446b. El hijo documental
actual es DIRECTO de f43 y sólo añade resultados en estas tres rutas exactas:

- .agents/handoffs/0473-portal-confirmacion-20261021.md
- docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md
- docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md

GO DIRECTOR-PACKING-PDF-QA39-SAMPLE-20261022-02: una corrida serial,0retry,39 pruebas PASÓ,
0fallos/pendientes/todo,3archivos. Son25 casos QA nuevos y14 del adaptador con IO/SDK doblados;
no fueron llamadas a IA. Los39 títulos se cotejaron entre stdout y JSON. Cuatro nativos exit0
(focales,marker una vez,Python,Poppler),wrapper0/incompleteFalse. Fin11:43:46.3332261Z,
formal propio11:43:46.7932444Z; RootPOST11:43:48.2826603Z y General11:44:34.659Z oportunos,
con cap efectivo11:44:46.3332261Z. El resultado original de sesión36567/chunk414c89 acreditó
exit0 y terminación de la herramienta; no se infirió cierre global desde el archivo formal.

Muestra nueva de2páginas generada,4855bytes,SHA2567fada57b5d00093c5f3950e36de7812226b675a2fc1547d234ca3c790b170b2e.
Root y General vieron ambos PNG originales: PASÓ visual, sin cortes/superposiciones. Contenido
ficticio completo:10cajas/192pcs/USD390/140kg bruto/120kg neto/.80m³; A4cajas mixtas56kg/.32 y
B6cajas84kg/.48. Es oracle de autoría; no es una propuesta extraída ni un documento confirmado.
Poppler emitió94bytes de warnings No display font for Symbol/ArialUnicode con native0; páginas
correctas. No afirmar stderr vacío, cobertura CJK o portabilidad de fuentes de producción.
GO01 quedó FALLÓ por bootstrap WhenAll/0nativos de trabajo, preservado; GO02 no lo rehabilita.

Extracción positiva PDF mediante IA, aplicar esa propuesta, proveedor/confirmación/PDF final/
etiquetas/QR de ESTA muestra: NO DISPONIBLE sin clave/modelo TEST; ninguna llamada al SDK real.
La muestra vieja y workspace4320/4321 rev3/V1 siguen intactos. Próxima aceptación pendiente:
PDF nuevo real→propuesta con evidencia→revisión humana→aplicar→proveedor corrige grupoA→confirma
→documento/etiquetas/QR; nunca llenar valores manuales para fingir extracción. pnpm verify/build
actuales, PDF escaneado, WeChat/chino humano/CJK producción siguen pendientes. Sin merge/deploy.
Hashes y originales fueraGit en pdf-import-optin-e060/ y handoff propio. Las cinco TS de la
etapa y siete runtime/test pins quedan intactos; tres docs cambian por autorización, por lo
que no se afirma que los15 pins anteriores sigan todos idénticos después de este hijo.

## Propuesta 2026-10-22 · Lector GLM · Primera entrega documental

La instrucción humana `01a16397-1de2-7b91-b6ac-9d8d80331447`, leída en el chat Packing,
pide PDF/Excel del proveedor → propuesta Packing List + Factura en el portal DTD, con GLM.
Esta continuación reutiliza SDD-0473; 0468 sigue siendo la presentación relacionada.
No sustituye los resultados históricos ni declara terminada la importación real.

Nueva sesión escritora `01a1639b-cd99-7921-ac27-5d218d0a1516`, owner
`worker-packing-glm-01a1639b-cd99-7921-ac27-5d218d0a1516`, rama
`codex/packing-glm-encargo-20261022`, worktree hermano `DTD-worktrees/packing-glm-encargo-20261022`.
Base inmutable `d42b42de94aa09222b67f342451b2e3cf573e3d4`, árbol
`2a7e4b742e021d5280732b1040972ec0a3993569`. No se adopta la rama/árbol del Worker anterior.

La autorización vigente de esta fase comprende únicamente estas tres rutas documentales:

- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/glm-encargo-20261022.md`
- `.agents/handoffs/0473-glm-encargo-20261022.md`

El [paquete de encargo](glm-encargo-20261022.md) contiene la allowlist de producto **propuesta,
no habilitada**, contratos oficiales, diseño, pruebas y decisiones pendientes del Director.
No se reserva otro SDD ni se ejecuta el gestor de numeración. Inventario Git focal: 349 refs,
247 commits distintos y 91 worktrees; una sola carpeta para 0473 y otra para 0468, sin cambios
sin commit detectados en esas specs al corte. No acredita disponibilidad global de otros IDs.

La autoría de producto espera asignación concreta del Director sobre este paquete. Las pruebas,
instalaciones, servidores y llamadas GLM esperan su GO propio con checkpoint/receta/entorno;
ningún GO anterior permanece abierto. PR319 continúa OPEN/DRAFT en d42. Publicación remota,
integración, migraciones, flags y producción no están autorizadas. No hay clave ni modelo TEST.

Contrato propuesto: Excel determinista primero; PDF digital/escaneado mediante OCR documental
GLM y estructuración validada, sin asumir equivalencia con Anthropic. Campos desconocidos quedan
pendientes; peso neto se conserva separado del bruto y por grupo. Revisión → aplicación explícita
por cliente → revisión/confirmación por proveedor → PDF/etiquetas conserva sus autoridades.
El DTO d42 todavía no admite peso neto; su ampliación y la del aviso de privacidad forman parte
de la propuesta y no de una implementación entregada. El detalle y el handoff distinguen evidencia
de fuente, dobles, futura lectura real y aceptación de extremo a extremo.

### Anexo de coordinación 2026-10-22 · Alcance humano y configuración TEST

Sam instruyó en esta sesión entregar el paquete al Director, coordinar la implementación GLM y
mantener **la misma PR319, sin merge ni producción**. Se entregó el checkpoint documental
`4b45fca00e0b1b031636d4684b2f5227b7775c54`, árbol
`6cd0093fc76b8d4fa37af2416bb7913a3adfccee`, hijo directo de d42. El Director acusó recibo y
revisó el paquete; todavía no ha adoptado la allowlist propuesta de 43 rutas ni habilitado producto.

El General comunicó haber verificado en Packing los mensajes humanos
`01a163a9-53c3-7ad2-b544-c96fb30223a0` (ERP y portal de DTD Cargo) y
`01a163aa-3ca2-7871-8ccf-ff16b86c7ca6` (ubicación segura de API GLM y prueba PDF/Excel hasta
confirmación/etiquetas). Esta evidencia delegada resuelve la referencia a «Contífico»: no hay
integración con un ERP externo. No repetir esa pregunta ni solicitar Anthropic.

Por coordinación posterior, Packing es el único owner del archivo externo a Git
`C:/Users/AKX generator/.config/dtdcargo/document-import-glm.test.env`. Reportó su creación con
los nombres `DOCUMENT_IMPORT_GLM_API_KEY` y `DOCUMENT_IMPORT_GLM_MODEL` inicialmente vacíos,
y permisos restringidos. Este Worker no abrió, leyó, creó, modificó ni inspeccionó permisos de ese
archivo o su carpeta; existencia, estado inicial y ACL son evidencia reportada por el Director,
no verificación propia. La orden posterior sustituyó el encargo inicial de crear una plantilla.

La configuración corresponde al banco TEST futuro: no existe todavía el cargador GLM, llenar
el archivo no activa una llamada ni acredita funcionamiento. Clase de cuenta, modelo habilitado,
límites, costo y parser siguen pendientes de resolución. El Director Packing solicita al usuario
la confirmación y clase de plataforma por su canal; no se duplica la pregunta ni se pide el secreto.
La [propuesta de carga explícita y sus límites](glm-encargo-20261022.md#11-coordinación-posterior-y-carga-test-propuesta)
queda sólo documentada. Se conserva la allowlist activa de tres documentos y la restricción de
runtime, API, instalaciones y pruebas hasta la asignación y el GO correspondientes. Publicar el
head de PR319 requiere decisión explícita de SHA/owner; no se ejecutó push. UI/B1 conserva la
prioridad de ejecución pesada comunicada por el General en esta coordinación.

## GLM S1 · Autoría asignada por el General · 2026-10-22

Se adopta la asignación concreta S1 antes de escribir código. Parent directo:
`86461c79ec37828e3cea301403a170339207be0d`, árbol `ecb1b89ccb48527032d1c1c1be623c734b0c640b`.
Se preservan 4b45 y la base de producto d42. Misma sesión, rama, worktree y owner propios.
Guard/claim, HEAD limpio, tres preimágenes documentales completas en Git y seis ausencias
Git/disco comprobados antes de editar. Allowlist activa S1 exacta (9):

- `lib/studio/document-import/extraction-contract.ts`
- `lib/studio/document-import/extraction-contract.test.ts`
- `lib/studio/document-import/provider.ts`
- `lib/studio/document-import/provider.test.ts`
- `lib/studio/document-import/glm.ts`
- `lib/studio/document-import/glm.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/glm-encargo-20261022.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `.agents/handoffs/0473-glm-encargo-20261022.md`

Contrato: motor neutral y transporte OCR/chat desconectados de todo caller actual; configuración
explícita Z.ai Standard, modelo sin default, sin fallback. Datos intermedios conservan procedencia
y neto sin convertirse al DTO vigente. PDF requiere inspector acotado y reserva confirmada
inyectados antes de red; S1 sólo declara esos contratos y escribe dobles, no los implementa.
Pruebas de protocolo, límites, cobertura, errores e incertidumbre escritas SIN EJECUTAR. No hay
autorización de runtime, instalaciones, parser, dependencias, loader, archivo TEST, UI, DB, API,
conocimiento o push. Ninguna ruta fuera de estas nueve queda habilitada por inferencia.

S1 escrito: tres módulos y tres archivos de prueba, desconectados de los callers existentes.
Salida intermedia con neto/bruto y evidencia; jamás se guarda como DocumentDraft. Transporte
requiere inspección/reservas/contador/mapeo inyectados; dobles no son autoridades productivas.
50 casos declarados por fuente (14 contrato + 11 provider + 25 GLM), todos NO EJECUTADOS.
Detalles, equivalencia futura de errores Anthropic y siguientes tramos en §12 del paquete.
Sam pasó de indicar Coding Plan (`01a163b4-35dd-79f0-b4b4-31f1757e4d4b`) a solicitar preparación
Standard (`01a163b7-f3f9-7260-95ed-b06318f25e1d`), según verificación comunicada por el General.
Packing conserva cuenta/archivo; no se acredita clave, modelo, costo, llamada o configuración real.
Quotas genéricas existentes son reutilizables por fuente, pero caída tras envío y reclaim por
lease requieren decisión durable antes de conectar jobs. Candidato parser/version/licencia y
worker interrumpible sólo propuestos, sin nueva ruta o dependencia añadida fuera de S1.

## ADOPCIÓN S2-P29 · 2026-10-22 · antes de producto

Asignación nominal General con objetivo humano confirmado: portal → documento revisable → Excel y cotización de una misma revisión. Autoría ligera29 habilitada después de cerrar GLM50; puente GLM desconectado de API/jobs. Mismo owner/WT/rama/PR319; primer checkpoint hijo directo9e49, sin commit documental intermedio necesario.

Precondición cerrada:3FULL50/50 PASÓ,0omitidos, native/global0; FIN en primera respuesta61c039 sin session_id. Exterior Worker079b48 yGeneralb902a7 dentro cierre original14:35:39.9575375Z. Custodia fría C:/tmp/sdd0473-glm-custodia-01a1639b-01, manifiestob6a7ebf17a9ab5d18257addb2fb03c0ae67181fd9012faec31975bcfd8978660; no prueba API real/E2E/SQL ni producción.

Guard administrativo77f398/exit0;27preimágenes físicas+27rawGit/2ausencias ANTES de tocar estos documentos, acf7fb a14:37:58.7949944Z. Evidencia externa C:/tmp/sdd0473-s2-p29-adopcion-01a1639b-01 (57artefactos/manifiestoa03e01a04fbc49d7428a8020300fd08c2e0843eea442e3c982183f13c854ba42). No se reconstruyen preimágenes después de escribir.

Contrato A–H íntegro adoptado en glm-encargo-20261022.md: metadatos cerrados/cotados, autoridad manual/tombstones del servidor, declaraciones triestado, recibo autoritativo proyectado, revisión esperada/invalidación, proyección privada común y motor único. No hay autorización de runtime S2 hasta checkpoint fijo/revisión/GO nuevo. Pruebas, typecheck/lint/build/verify, servicios, API, SQL, instalación, push/merge/producción: NO EJECUTADOS para S2. Graphify/Archify/Obsidian y gates documentales se conservan pendientes, sin ejecutar fuera del encargo.

Allowlist activa S2-P29 exacta (las rutas anteriores fuera de esta lista no están habilitadas por esta adopción):
- `lib/shared/document-import.ts`
- `lib/shared/__tests__/document-import.test.ts`
- `lib/studio/document-import/draft-from-extraction.ts`
- `lib/studio/document-import/draft-from-extraction.test.ts`
- `lib/studio/document-import/service.ts`
- `lib/studio/document-import/service.test.ts`
- `lib/studio/document-import/estimate.ts`
- `lib/studio/document-import/estimate.test.ts`
- `lib/studio/document-import/extract.ts`
- `lib/studio/document-import/extract.test.ts`
- `lib/studio/document-import/export.ts`
- `lib/studio/document-import/export.test.ts`
- `lib/studio/document-import/http.ts`
- `lib/studio/document-import/http.test.ts`
- `components/document-import/DocumentEditor.tsx`
- `components/document-import/DocumentEditor.test.tsx`
- `components/document-import/DocumentCalculator.tsx`
- `components/document-import/DocumentCalculator.test.tsx`
- `app/portal/(app)/compras/[code]/documento/DocumentReviewClient.tsx`
- `app/portal/(app)/compras/[code]/documento/DocumentReviewClient.test.tsx`
- `app/cotizador/CotizadorClient.tsx`
- `app/cotizador/cotizador.test.tsx`
- `components/document-import/document-client.ts`
- `components/document-import/document-client.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/glm-encargo-20261022.md`
- `.agents/handoffs/0473-glm-encargo-20261022.md`
- `app/p/[token]/SharedSupplierDocument.tsx`
- `app/p/[token]/SharedSupplierDocument.test.tsx`

## S2-P29 · fuente preparada para revisión · 2026-10-22

La autoría de esta entrega comprende exclusivamente las 29 rutas nominales adoptadas antes de producto. El checkpoint de fuente se fija como hijo directo de `9e49b3c13995e3dd50b60ce79a42f846b37b34fb`; su SHA/árbol se registra en el recibo externo posterior al commit para no autorreferenciar este archivo. Se conserva PR319 y la rama GLM propia; no se ha publicado la rama ni actualizado el head remoto de la PR en esta fase.

**Precisiones nominales del Director incorporadas:**
- Los totales globales revisados de peso bruto y CBM pueden alimentar el flete una sola vez aun si existen grupos con cajas conocidas y peso/volumen parciales. También cubre el caso sin grupos. No se reparte mercancía ni se inventan cantidades, ceros o precios. Subtotales conocidos que exceden el global, desacuerdos numéricos, moneda incierta y pendientes de lectura siguen bloqueando. Faltantes exclusivamente comerciales/de distribución no usados por el motor conservan el despacho pendiente; no otorgan confirmación, PDF ni etiquetas.
- Se conservan únicamente **Shipping Mark y código de compra ya compartidos** por el contrato anterior como identificadores operativos para recogida/PDF/etiquetas/QR. Pueden identificar indirectamente; esta entrega no los califica de anónimos ni de datos no personales, ni establece una nueva base legal. No se agregan lookups, atributos del comprador ni permisos.

**Comportamiento escrito; pendiente de validación funcional S2:**
1. DTO versión1 con neto opcional, bruto independiente, evidencia identificada/observada y decisiones por rutas de IDs estables, con límites cerrados. Ausencia legacy preservada; no se fabrican procedencias para citas antiguas. Se rechazan excesos, referencias incompatibles/huérfanas y rutas no permitidas.
2. Puente nuevo de `IntermediateExtraction` a propuesta: IDs del servidor, celdas/páginas del resultado confiable, unidades/moneda desconocidas pendientes, neto separado y lectura humana obligatoria. Conserva alternativas estructuradas; no copia OCR completo ni ejecuta instrucciones, fórmulas, enlaces o herramientas. Permanece desconectado de GLM/jobs/credenciales. La ruta asistida anterior pierde cualquier autoridad de metadata que intente adjudicarse.
3. Save deriva autoridad manual y tombstones desde el anterior autoritativo y el cambio de negocio, incluso con navegador proveedor sin metadata. Apply fusiona contra ese anterior real por un camino interno; no existe modo público que lo seleccione. Vacíos/null/correcciones/eliminaciones manuales no se sustituyen silenciosamente; identidad incierta falla antes de aplicar. CAS y commandId se conservan; reintentos UI de la misma operación conservan comando.
4. Baterías y carga especial/regulada son declaraciones humanas triestado. Ausencia queda pendiente; nueva importación/cambio de mercancía o embalaje del documento invalida. Un sí prevalece al agregar compras y no se oculta por pendientes; éstos impiden producir una cotización como si fueran no. No hay aprobación regulatoria automática por IA ni cambio de los gates históricos de despacho.
5. Recibo de save/confirm incluye el workspace realmente releído del servidor con proyección según actor. Portal, cotizador y proveedor adoptan ese recibo comprobado; conservan cambios ante error/409/recibo incompleto. El estimado exige revisión esperada por documento, reautoriza/revalida antes/después de tarifa y antes/después de persistir/devolver. Son relecturas explícitas, no un snapshot transaccional de DB. La UI liga selección/revisiones/destino/embalaje/estado de edición/generación y descarta respuestas tardías.
6. Una proyección allowlist común retira sources/fieldDecisions/evidencia/filenames/alternativas e incidencias privadas de workspace e historial del proveedor, recibos y contexto PDF/XLSX. Mantiene mercancía y contacto propio del proveedor. Excel conserva columnas A:N y añade O neto; logística sólo en la líder de cada grupo y en el total. Relectura de libros de14/15columnas contemplada; XLSX y PDF exigen revisión. PDF/QR mantienen confirmación y etiquetas autoritativas previas.
7. El portal de compra incorpora el estimado y el Excel sobre la misma revisión guardada. Se conserva `calcularEnvioLCL` y las consultas/configuración existentes, sin editar fórmula, tarifas, fallback, SQL, dependencias o CSS. Los casos escritos cubren mínimos, batería, densidad, combinación, destino, embalaje y derivaciones del motor. No acreditan paridad con una revisión desplegada ni con tarifas reales de hoy. El valor de mercancía sigue separado del flete.

**Inventario técnico de privacidad (sin auditoría legal):** contacto/email/WeChat/teléfono/dirección/ciudad de `draft.supplier` pertenecen a la información del proveedor compartida en el documento. Fuentes, nombres de archivo, evidencia observada y alternativas se retienen sólo en el lado autorizado del cliente y se proyectan fuera del proveedor y de los archivos generados. No se consultaron filas reales ni PII. Los tests usan canarios ficticios de comprador/OCR/filename/alternativas y prueban conservación de los dos identificadores operativos anteriores. No se alteran políticas de retención ni consentimientos.

**Gobernanza por revisión de fuente:** cumplimiento propuesto de fronteras público/ERP (clientes sólo shared), contrato cerrado, mensajes de error seguros, revisión humana, estados pendientes/errores y primitivas/copy/accesibilidad existentes. No aplica a esta entrega: nueva migración/DB, tarifa, despliegue, rediseño visual y nueva política legal. No se solicita excepción normativa ni se declara conformidad funcional/visual aún. AGENT-BRIEF y políticas aprobadas leídas; la revisión React se aplica a efectos, identidad y respuestas tardías. Inventario/cápsula rastreados no se modifican fuera de29.

**Validación y límites de la evidencia:**
- **PASÓ (S1 anterior, no repetido):** 3FULL50/50, sin omitidos; native/global0, retorno formal y custodia cerrados. Sólo transporte/parser/provider con dobles, sin llamada real GLM.
- **PASÓ (administrativo de esta autoría):** rama/owner/claim propios y allowlist29; cero ruta ajena; revisión textual y `git diff --check` antes de fijar fuente. Esto no prueba que compile ni que las pruebas pasen.
- **NO EJECUTADO (S2):** las13suites completas propuestas, typecheck, lint, build, pnpm verify, UI-check/browser/accesibilidad manual, SQL/DB, demo ni integración con API. Se espera revisión del checkpoint y GO nominal coordinado; no se debilitan oráculos ni se omiten tests para declarar verde. Fuera de esa autorización tampoco se ejecutan generación Graphify/Archify/Obsidian/knowledge:status.
- **NO DISPONIBLE:** evidencia de cuenta/modelo/saldo/API Standard válidos, cobertura OCR/PDF real y aceptación humana del documento final. No se abrió, leyó, hasheó, copió ni cambió el archivo de credenciales.

**Pendientes de esta tarea:** revisión fija por Director; preparación y corrida controlada de13FULL, reparaciones justificadas, validación canónica cuando se asigne; luego en tramo separado conectar el lector/cola, revisar cobro incierto/lease, probar cuenta/documentos reales con la autorización concreta y demostrar flujo completo. El nuevo puente no traduce ni inventa nombres; una traducción adicional de contenido, si se requiere, debe preservar original y evidencia en su encargo posterior. Muestra visual/rediseño Packing List conserva su encargo independiente. Integración en PR319, merge y producción continúan separados; estos dos últimos no están autorizados.

**FUERA DE ALCANCE DETECTADO:** se conserva el pendiente previo sobre recuperación de jobs/cobro incierto en0457. No se lo corrige ni se renumera la migración. No se absorben CORE/UI/B1, PR308 ni servicios de otras sesiones.

**Impacto documental:** spec, encargo y handoff de esta tarea actualizados. Integración Git/PR, estructura Graphify, semántica, mapa Archify y preview/publicación Obsidian siguen pendientes por separado; la bóveda compartida sólo desde main integrada comprobada. Ningún derivado fue presentado como actualizado.

**HANDOFF AL DIRECTOR:** recibir checkpoint fijo y paquete externo de revisión/propuesta13FULL; no runtime S2 hasta GO nuevo. Misma sesión escritora y PR319, sin merge/producción. Conservar preimágenes de adopción y S1/50 cerrado; no volver a correr50 ni renovar su ventana. El recibo externo consigna SHA/árbol/padre, pins y estado real de escritura/claim.
### Adopción nominal de corrección por campo · 2026-10-22

Sam autorizó revisión13FULL/corregirfallos/conexiónreal en su mensaje01a16444-b98d-7240-a647-c198b0400863; Director confirmó una corrección ligera antes de la corrida. Se adopta cobertura logística por campo: CBM global positivo/revisado puede cubrir exclusivamente cbm_missing mientras el peso bruto proviene de todos los grupos; simétrico para bruto global y CBM completo de grupos. Se conserva suma única, distribución pendiente y todos los conflictos, revisiónAI y declaraciones pendientes. Oráculo logístico nominal60+80kg y CBMglobal0.8, sin declaredGross inventado. El precio se compara con el motor/config/rates de las fixtures existentes.

Alcance puntual de esta hija directa5e6875e: estimate.ts, estimate.test.ts y estos tres documentos (spec, encargo, handoff); las otras6320entradas se preservan. Antes de editar: guard y claim210B/a29aa577a954b3744e1eae27618b75393f77834071b72115bd1fb927fd366cbc verificados y5preimágenes físicas+5rawGit selladas en C:/tmp/sdd0473-s2-cobertura-campo-adopcion-01a1639b-01. No se altera DTO/shared/UI/motor/tarifas/S1, ni paquetes READY/custodia ya cerrados. Nuevos tests son aditivos y aún NO EJECUTADOS; la preparación13FULL se refresca después de fijar la hija, sin descubrir/ejecutar ni pedir otro permiso humano genérico. Se conserva la secuencia/recurso exclusivo coordinado por Director; S3-TEST real continúa como siguiente encargo nominal, sin lectura de credenciales/API ahora.
Corrección escrita por campo: se releva cada missing únicamente con su global positivo; ningún otro blocker cambió. Se agregaron14casos estáticos derivados de6tablas literales de2casos y2casos directos: ambos cruces por campo, ambos globales con grupos vacíos/parciales, faltante real/0, subtotales superiores, sumas completas distintas, conflicto explícito, sí+pendiente y recuperación en ambas declaraciones, lecturaIA y recuperación. Los tests heredados/oráculos financieros se conservan completos; se compara entrada y resultado con calcularEnvioLCL/PARAMS/MARACAIBO/rates existentes. Ningún caso fue descubierto ni ejecutado todavía. `git diff --check` administrativo y comparación del resto del árbol se registran en el recibo del checkpoint. Preimágenes/adopción selladas antes de producto (manifest0d5e5a587752474e1f67dbacc6c546b2e90f769809d944e0e65a235085af0af5). El precio y sus gates sólo se acreditarán al ejecutar13FULL y completar los checks posteriores; estos14 son expectativa por fuente, no un resultado PASÓ.
## S3 TEST v2 — adopción de autoría (2026-10-22)

El Director General activó autoría de fuentes en este mismo Worker/chat, rama y worktree; base `b60c8fe9f7e0fd2579b0f5f82f04ed1355163249`, árbol `8f1a0484ef038a86a0884303c266464c34d02f56`, claim A29 conservado. Destino: misma PR319. Sin merge, producción ni push en esta fase. S1/50 y S2/13 FULL (350/350 PASS) permanecen cerrados. S3 fuente en preparación: ejecución funcional y conexión real **NO EJECUTADO**.

Autoridades completas adoptadas antes de comportamiento, en `s3-test-encargo-v2` del paquete del Director Packing: encargo v2 SHA256 `4fae2339334861fc301dff2af0541215ac382383e55db379e26e7fdc26078ae0`; pins base/input `8c6bb4759f513127618dffd62db3b35dd3f4408ee583ed34cdace14e507573a3`; precisión 01 `eb98dcadd3e4d5169ae8dff2edcbb20b659e3bfd8a4b678a8d62098a04f83578`; corrección manual opcional adoptada por General `2c17b99d52c75470249b702e851a7c30fc17dd53690a38ab3e6f90a6afad22e2`. La activación expresa posterior del General habilita autoría; no transforma propuestas de runtime en permisos actuales.

Custodia previa: `C:/tmp/sdd0473-s3-adopcion-01a1639b-01`, 53 artefactos más MANIFEST, SHA256 manifiesto `ace615f4fd1a2e592f6a992ef6903c78ca94673b8cc2e9512c322c142dc08364`. Conserva 23 preimágenes físicas y 23 raw Git, cinco ausencias, cuatro autoridades completas, allowlist y evidencia. Una diferencia de codificación física/raw en estimate.test.ts está documentada; ambas copias verificadas, blob canónico correcto y base limpia. No se borra la evidencia de captura interrumpida. Fuera de los 28 paths: 6302 entradas originales deben permanecer idénticas.

Contrato de implementación adoptado:

- TEST Standard: OCR glm-ocr → tokenizer remoto explícito glm-4.6 → chat glm-4.6, endpoints fijos api.z.ai/paas/v4; mismo objeto de mensajes inmutable tokenizer/chat; conservar contador LOCAL S1 fuera de TEST. Chat stream false, JSON object, thinking disabled, máximo 8192 salida; entrada tokenizer positiva entera hasta 16384. Registrar diferencia de consumo chat, sin margen inventado.
- Tres HTTP globales como máximo, concurrencia uno, 90 segundos pipeline, sin retry/fallback. Ledger durable: guardia global SHA(bytes) independiente de job/workspace/perfil/cuenta/fecha, persistir y fsync possibly_sent, consumo y fencing antes de cada fetch. Crash, truncamiento o lease no liberan envíos inciertos. Root canónico compartido sólo se fija en GO posterior; cambiar root/cache/perfil no autoriza reenviar. USD0.25 es presupuesto operativo, no cap de cuenta probado; tarifa tokenizer no disponible.
- Credencial privada únicamente backend/memoria mediante loader explícito futuro, no abrir ni consultar metadatos ahora. Modelo vacío adopta literal glm-4.6; modelo diferente falla, sin mutación/fallback. Sin variables globales, NEXT_PUBLIC, Vite cliente, logs ni Git con secretos.
- Dos inputs ficticios separados y fijados: PDF002 4855 bytes SHA256 7fada57b5d00093c5f3950e36de7812226b675a2fc1547d234ca3c790b170b2e (inspector TEST exclusivo de esos bytes y dos páginas conocidas, OCR verifica cobertura real); XLSX 8178 bytes SHA256 f1867b0f4b2bdc7024700e502436a55e672e0276360a630e0b1e0db85e42c825, extracción nativa cero IA. Workspaces/Compras independientes; oráculos nunca entran al prompt ni sustituyen respuesta real.
- Reutilizar applyImport/save/confirm de core y PGlite ficticio; calculadora real con snapshot tarifario ficticio identificado y digest, sin duplicar fórmulas ni afirmar paridad online/precio firme. Logística confiable por campo, revisión y conflictos preservados, sin distribuir totales inventando valores de cartón.
- Corrección humana opcional posterior: A cuatro cajas /60 kg bruto/48 neto/.36 CBM, cada una 15/12/.09; B seis /96 bruto/72 neto/.60 CBM, cada una 16/12/.10. Total diez cajas/192 unidades/USD390/156 bruto/120 neto/.96. A18 tazas+18 tapas/caja, B8 botellas/caja. Mapear IDs reales confirmados; ninguna media global por etiqueta. Reestimar con mismo motor/config; mínimos pueden conservar precio.
- Preservar S2 A–H, server prior, delta manual, procedencia privada y controles de revisión/actor/revisión antes y después de resultados. Batería/especial triestado pendiente. Proyección proveedor sólo datos operativos legítimos, ShippingMark/compra, sin buyer/PII/OCR privado. Neto opcional independiente en PDF por grupo y total, nunca requerido universal; Excel A:N estable, O neto aditivo, logística de grupo una vez; QR e identidades existentes.
- Preparar archivo y tipo antes de transferir bytes, envío explícito y proveedor efectivo revelado. Reutilizar componentes/tokens/flujo; etapas reales sin porcentaje ficticio. Sin componentes compartidos adicionales ni cambios a políticas, índices, rutas, DB o jobs de producción.

Matriz SGE-00 / diseño R3 (evidencia de intención de diseño, no aceptación funcional):

| Principio | Decisión / verificación pendiente |
| --- | --- |
| SGE-00.01 Predecibilidad | `DocumentImportPanel`: elegir/preparar, Enviar y leer, Aplicar; fuente revisada, interacción pendiente. |
| SGE-00.02 Conservar trabajo | `service.saveWorkspace` y revisión/recarga existentes; `server.test.ts` prueba fuente de resultado tardío. Runtime pendiente. |
| SGE-00.03 Fricción proporcional | Envío explícito antes de transferencia/costo y confirmación proveedor; no modal adicional ni paso irreversible nuevo. |
| SGE-00.04 Auditoría | `glm-test-ledger.ts`: fence, correlación, SHA y possibly_sent/fsync; core conserva actor/tenant/revisión. Persistencia pendiente de prueba. |
| SGE-00.05 Permisos y privacidad | Proyección proveedor, casos separados y negativas en server/database tests; banco ficticio no certifica RLS productivo. |
| SGE-00.06 Prevención | Pin bytes, tipo/size, tokenización, cap global y revisión antes de exportar; pruebas fuente aditivas. |
| SGE-00.07 Estado verdadero | Prepared/processing/ready/failed y etapas reales de runtime; sin porcentaje inventado, ejecución pendiente. |
| SGE-00.08 Frecuencia y complejidad | Se añade envío explícito por transferencia a tercero/costo; selección de tipo operable antes de bytes. |
| SGE-00.09 Patrón común | Reutiliza panel/editor/botones/tokens, core y motor; no componente compartido nuevo. |
| SGE-00.10 Accesibilidad | Label/select/button nativos, estado anunciado y salida manual; teclado/foco/375/390/200%/movimiento pendiente. |
| SGE-00.11 Lenguaje | Verbos operativos y errores seguros con alternativa manual; revisión de texto fuente, UI pendiente. |
| SGE-00.12 Autoridad humana | Extracción propone; cliente aplica y proveedor confirma; sin aplicación o acción externa autónoma. |

Aplicabilidad: IA-01, UPL-01, PRG-01, SGE-00, FRM-01, A11Y-01, ERR-01, LOD-01 y CMP-01; cumplimiento de diseño en preparación, aceptación runtime **NO EJECUTADO**, sin excepción implícita ni promoción de componentes. Revisión de datos sólo técnica sobre fixtures ficticios, sin certificar cumplimiento legal. Graphify principal es descubrimiento histórico; no actualiza ni demuestra el árbol de este worktree. Publicación Obsidian/main no autorizada aquí.

Frontera actual: sin importación de candidato, parser/AST, discovery, tests, typecheck/lint/build/verify, DB/Docker, servidor, API, lectura/metadatos del secreto, instalación/junction/copia de dependencias ni push. Sólo edición y revisión de fuentes más Git/guard administrativos. Pruebas aditivas sin cambiar títulos/oráculos/timeouts heredados. Primero checkpoint hijo directo b60 y custodia para revisión del General; cada runtime posterior requiere GO concreto. Preservar demos 4320/4321, 26356, 8212–18580 y datasetRev3V1.

Allowlist S3 exacta (28; no todos requieren cambio):
- `lib/studio/document-import/glm.ts`
- `lib/studio/document-import/glm.test.ts`
- `lib/studio/document-import/extract.ts`
- `lib/studio/document-import/extract.test.ts`
- `lib/studio/document-import/estimate.ts`
- `lib/studio/document-import/estimate.test.ts`
- `lib/studio/document-import/http.ts`
- `lib/studio/document-import/http.test.ts`
- `components/document-import/DocumentImportPanel.tsx`
- `components/document-import/DocumentImportPanel.test.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/extraction-config.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/extraction-config.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/glm-test-runtime.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/glm-test-runtime.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/glm-test-ledger.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/glm-test-ledger.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/server.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/server.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/database.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/database.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/fixture.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md`
- `lib/studio/document-import/pdf.tsx`
- `lib/studio/document-import/pdf.test.tsx`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/glm-encargo-20261022.md`
- `.agents/handoffs/0473-glm-encargo-20261022.md`

### S3 checkpoint de fuente — cierre de autoría para revisión

Implementación fuente: modo remoto explícito OCR/tokenizer/chat con mensajes inmutables y sin alterar el contador local S1; ledger con guardias durables global/SHA y fsync antes de envío; loader backend y root candidato único no creado; dos casos ficticios aislados; XLSX nativo sin IA; core applyImport/save/confirm y snapshot tarifario ficticio; tipo antes de bytes/aviso efectivo; neto opcional y etiquetas mapeadas por IDs SQL/códigos físicos reales. El modo legacy QA se conserva separado, incluida su antigua fusión; S3 no lo usa.

Revisión de fuente realizada: límites/importaciones/público-ERP preservados; componentes y tokens existentes, sin primitives nuevas; proyección privada y relectura antes/después de operaciones; contraste/tamaños/375/390/teclado/impresión no medidos. Clasificación de gobernanza: conformidad de diseño sustentada en fuente para IA-01/UPL-01/PRG-01/FRM-01/ERR-01/LOD-01/CMP-01; aceptación funcional/A11Y sigue NO EJECUTADO. No se ha concedido excepción. Los 12 IDs normativos SGE-00 están mapeados arriba; no confundir revisión con pruebas ejecutadas.

Tests nuevos/adaptados en fuente: GLM remoto/mensajes/contadores/gate persistente; ledger tres etapas, reinicios antes/después, truncamiento, concurrencia y callbacks tardíos; loader sin secretos, root/bytes incorrectos; banco PGlite core/compra ajena/edición/confirmación/QR/motor; QA rutas/aislamiento/stale; preparación y aviso de UI; PDF neto/mapping por códigos. Pruebas heredadas conservan títulos, asserts y timeouts. Única adaptación del recorrido UI heredado: capability sintética inyectada y clic de envío en helper de selección, sin relajar oráculos. `http.test.ts` agrega assert al caso existente, no reemplaza su oráculo con flag apagado.

Validación actual:

- PASÓ: guard administrativo y claim A29; diff whitespace; alcance por Git y custodia previa. Ninguno es prueba de producto.
- NO EJECUTADO: tests nuevos/heredados sobre S3, typecheck/lint/build/pnpm verify, validator de gobernanza local, PGlite, extracción de inputs, API GLM, PDF render/QR/visual, knowledge:status/Graphify/Archify/Obsidian. Prohibidos por la activación de autoría hasta checkpoint revisado y GO concreto.
- NO DISPONIBLE: fetch web de Supabase changelog.md rechazado por content-type text/markdown; documentación select consultada. Protocolos primarios Z.AI tokenizer/layout/chat consultados; esto no prueba acceso de cuenta/modelo ni factura/costo.
- S2: 13 FULL /350 PASS pertenece a b60, no certifica este nuevo árbol. S1/50 queda cerrado, pruebas existentes preservadas.

Propuesta siguiente reserva sin ejecutar: 13 suites S2 completas + DocumentImportPanel/pdf/glm/provider/extraction-contract + QA extraction-config/server/glm-test-runtime/glm-test-ledger/database, con dobles de red prohibiendo fetch real, tooling explícito y sin ocultar SKIPs/warnings. Después verify y UI-check con reserva propia; sólo luego GO separado para muestras/API real y raíz nominal. Dependencias físicas de este worktree siguen ausentes; no instalar/copiar/junction ni ejecutar discovery por inferencia.

Pendientes de esta tarea: revisión independiente del checkpoint; validación completa, reparar fallos de esa evidencia, conexión real y las dos aceptaciones completas. Producción, merge, push y traslado de PR319 continúan sin autorización en esta fase.

FUERA DE ALCANCE DETECTADO: inspector PDF genérico, drenador/migración durable de producción y validez de tarifas online; no se implementaron ni se declaran resueltos. Conocimiento integrado/shared Obsidian sólo lo publica Director desde main integrada comprobada con sus permisos; aquí no hay publicación.
### S3 devolución CEF — autoría correctiva autorizada por General

El General devolvió revisión fría de cefb y autorizó al mismo owner hija directa `cefb19b424ae4ac3c252ca8912754eb94d9f5789`, dentro de las mismas 28 rutas, sin gate adicional Sam. Su cotejo 25da98 confirmó 115 sellos, 28 pares físico/raw, patch binario y 6302 entradas ajenas; no ejecutó producto. Se conserva CEF y toda su custodia cerrada.

Antes de esta adopción: guard PASÓ, A29 intacto, CEF limpio; preimágenes de las 28 rutas físicas/raw completas selladas en `C:/tmp/sdd0473-s3-correctiva-preedit-01a1639b-02`, 58 artefactos más MANIFEST SHA256 acbb885b8e76d5e9557974b6eeeeade40a4abbba0e673fdba277db30dd1293de. El paquete procede de las copias CEF frías revalidadas; no se reconstruyeron desde fuentes modificadas.

R1 P2: conservar selección XLSX/PDF en open, enlaces de proveedor, etiquetas y redirects canónicos; resolver por código/token/workspace admitido, no ordinal. Probar cruce negativo y recarga. Mantener ruta PDF directa del proveedor que ya envía workspace correcto. Parent confirmó el caso page=labels&case=xlsx.

R2 P2: snapshot de estimado con guardia atómica al INSERT contra workspace/tenant/client/revisión actuales; cero filas significa conflicto sin snapshot. Relectura antes/después además de la guardia, no TOCTOU de lectura suelta. Sin nuevas migraciones ni cambio del motor/rates. Test adversarial intercalando guardado previo al INSERT.

R3 P2: separar guard global durable de caché completada por SHA+perfil+contexto origen/revisión. Recuperar resultado/job conocido válido sin nueva red; incompatible implica conflicto/manual, nunca autoapply ni nuevo permiso. No recuperar uncertain/truncado/crash por lease, perfil, root o job nuevo. Preservar posiblemente enviado/fsync antes de cada fetch y cap global tres.

R4 fixture: expresar revisión humana de supplier.company/wechat mediante core y resolvedIssueIds verdaderos antes de confirmar. Mantener títulos, aserciones, timeouts y reglas de confirmationIssues. Hallazgos por fuente, no fallos reproducidos aún.

Suplemento Parent autorizado: ocultar ejemplo/copy CSV en GLM que sólo admite PDF/XLSX; recuperación de error coherente con reset bloqueado. Deng.ttf 16324168/SHA256 e051009b42b454352a90ae0c9b8adb58bbdbcd168768750b35bc3357510de141 sólo metadata para futura reserva, sin copiar/renderizar ni certificar licencia/servidor.

Frontera conservada: sólo autoría/Git/guard; sin runtime, parser/AST/discovery/tests/Node producto/DB/API/clave/servicios/install/push. Nuevo checkpoint/custodia y revisión antes de GO23; propuesta FULL23r2 7f678805 sigue UNBOUND. Se incorporará dictamen formal Parent si añade algo material, sin otro escritor ni ruta29.
### S3 corrección CEF — resolución por fuente para segundo checkpoint

R1: CORREGIDO EN FUENTE. `qaCaseRoute` comparte identidades cerradas de compras/tokens; redirects canónicos conservan case, incluido /p/tokenXLSX. La fixture abre con purchaseCode y conserva case al navegar. Servidor rechaza código cruzado/desconocido y tipo de caso ajeno. Regresiones aditivas en extraction-config/server. UX menor: CSV y reinicio retirados del perfil GLM, formatos del panel derivados de capabilities, recuperación coherente sin reset. Ruta PDF directa existente preservada.

R2: CORREGIDO EN FUENTE. `saveEstimateSnapshot` usa una sola sentencia CTE MATERIALIZED con SELECT FOR UPDATE condicionado por workspace/tenant/client/prealerta/anonymous/revisión, seguida de INSERT SELECT. Cero filas devuelve conflicto sin snapshot. Relecturas adicionales antes/después; motor y rates iguales. Pruebas aditivas en adapter PGlite y middleware intercalan cambio antes de persistir, esperan409/cero snapshots y rechazan dueño ajeno. No nueva migración ni ejecución SQL.

R3: CORREGIDO EN FUENTE. Índice completado durable separado de guardia global: clave SHA+perfil+contexto servidor (entidad/dueño/compra/revisión/tipo/nombre). Resultado sólo tras tres respuestas y usage observado, fsync de archivo y marcador terminal; lector verifica secuencia completa, fence/correlaciones/cuenta global/hash de resultado. Truncado, incompleto o incierto no recupera ni reenvía. Contexto/perfil distinto tiene conflicto explícito. Caché válida no lee clave ni hace red; conserva sourceId original y exige revalidación server. SQL local devuelve job conocido sin nuevo registro para igual contexto/SHA; panel adopta jobId autoritativo. Cero aplicación automática. Pruebas de recuperación entre instancias, incompatibilidad, journal truncado y job duplicado agregadas sin modificar oráculos previos.

R4: CORREGIDO EN PREPARACIÓN DEL TEST por fuente. `projectSupplierDocument` convierte code a review_required e IDs a supplier-review-N; la prueba resuelve exactamente company/wechat por sus IDs visibles y pasa resolvedIssueIds al core. Nuevo assert exige ambas revisiones humanas; títulos y aserciones anteriores intactos. Hipótesis de fallo aún NO EJECUTADA.

Dictamen formal Parent leído: `s3-review-cefb-01/S3-root-dictamen.json`,11394B/SHA2562fed6748100abdcef87c21c6919a0717255119fd287fb2e70badd57ec05bb75e, R1/R2/R3 confirmados por fuente, U1 menor y controles restantes favorables con límites. Su suplemento de cobertura y precisión directa General se adoptaron: render aditivo de etiquetas con mapping explícito/códigos físicos y neto por grupos distintos (15/.09 y16/.10), dos páginas y conteos de texto reales, salida PDF+manifest futura para inspección PNG. Conserva las cinco instancias CJK heredadas; ahora hay SEIS instancias condicionadas por fuente explícita, sin ejecutarlas aún. No se afirma clipping ni aceptación visual por fuente.

Todas las correcciones y pruebas siguen sin ejecutar. Diff inverso/custodia preservan CEF; checkpoints y propuestas previas no se modifican. Nuevo SHA y paquete externo fijan el objeto revisable, sin push ni publicación en PR319. No se creó ni inspeccionó root real/credencial, no se instalaron dependencias ni se tocó demo vecina. Próximo paso: revisión fría de hija, re-pin/closure23FULL/caps y GO sin red específico; después su evidencia determina correcciones y GO real GLM, sin nueva puerta Sam.
## Correctiva de fixtures S3 GO01, adopción antes de autoría (2026-10-22)

General y Parent asignaron encargo-tests.json7134B/SHA75b09bb66995b357bbd0f0da45c86b918779888680921c434b86ab20ee15661c después de cerrar y devolver formalmente la custodiaADMIN GO01. Mismo owner/A29/WT/rama, hija DIRECTA de72317435538198a251de74ccdb99324d372614f6. Slice EXACTO de seis rutas: app/cotizador/cotizador.test.tsx; app/portal/(app)/compras/[code]/documento/DocumentReviewClient.test.tsx; QA/portal-confirmacion/database.test.ts dentro de este SDD; este spec, glm-encargo-20261022.md y handoff0473. Sólo las primeras dos pruebas amplían la unión previa28 a30; cero producto. Esta adopción se guarda en las tres fuentes canónicas ANTES de editar pruebas.

Se preservaron seis preimágenes físicas ENTERAS y seis rawGit de723 en C:/tmp/sdd0473-s3-tests-correctiva-preedit-01a1639b-01, MANIFEST708076B/SHAfaef5dbd1f36c47e86a7707cfd7c1bbe01aa4108e55b729ba47842837698ca43. Git real:6330 entradas,6324 fuera de estas seis; no asumir6302. Parent/tree/branch/clean/A29 verificados. La custodia de GO01,34artefactos/MANIFEST7834B/SHAa10a94d0ee3049f34b41144ad00885250bb0be92c077741055f55fe53078b1e1, queda consumida e intacta.

Resultado GO01 REAL sobre723:23FULL exactos,521assertions=508PASÓ+13FALLÓ/0pendingtodo;20filesPASÓ/3FALLÓ. Cotizador11/11falló, ReviewClient1/10falló, database1/3falló. No521fullNames distintos: se preservan identidad y multiplicidad, incluido título con newline. PDF19/19 yseisCJK/12artefactos PASÓ; no aceptación visual ni GLMreal. Nativo1/global1, unaexec/31polls/sinCtrlC; origen19:57:24.5599929Z/fin20:00:04.6735378Z/cierreORIGINAL20:01:24.5599929Z. Exteriores oportunos General851ebf yParent9a04eb recibidos. WrappertoolinputREAL2321/3b337903,call_9a40b95bf85b49eda9b5ff9a5baffe5c, ENTEROidéntico; primerSourceAfterND se conserva yarchivo interiortrue se registra aparte. No renovar reloj ni reusar GO/store/output.

Autoría autorizada: adaptar fixtures PDF reales de UI a capabilities/disclosure/formats sintéticos eficaces, elegir tipo y ENVIAR explícitamente antes de upload/apply, verificando que elegir archivo/tipo no inicia carga. Conservar todos los títulos/oráculos de privacidad, anonimato, autoridad, revisión, conflictos, errores, expiración y mercancía/flete; no autoenvío ni prop confiable para saltarse capabilities. Fixture PGlite: guardar logística cambiada por core, readback/PENDING, revisión humana explícita de ambas declaraciones, SEGUNDO save sin cambiar carga con revisión e ID reales, readback y sólo entonces confirm/estimate; sin defaultfalse ni SQLdirecto. Actor proveedor ya soportado por UI/core. No cambios de reconciliación o gate de negocio.

Sólo autoría ligera y Git/commit SELECTIVO seis rutas. NO EJECUTADO en esta hija: tests, discovery, parser/AST, lint/build/verify, imports o SQL runtime, servidores, API/clave/configprivada/ledgerreal, instalación, push/merge/producción. Los521resultados previos no validan la hija. Pendiente: checkpoint fijo/preimágenes/diff/preservación/clean ypropuesta futura23FULL UNBOUND para revisión General/Parent; ninguna aprobación genérica adicional de Sam. Nueva corrida sólo con nuevo encargo concreto.
Cierre de autoría de esta hija: los dobles de capabilities mantienen available/portal y devuelven disclosure/formats sintéticos por la misma API del componente. Los PDF se preparan, se elige proforma, se comprueba ausencia de upload/apply tras cada selección y se pulsa Enviar después de esperar información efectiva visible/habilitada. El helper público y sus seis llamadas usan await explícito; todos los escenarios anteriores y el apply diferido durante edición conservan sus oráculos. La información del proveedor vive dentro del párrafo de privacidad: el nuevo matcher exige que ese párrafo visible contenga el disclosure literal, sin suponer que sea todo el texto.

PGlite conserva el actor proveedor soportado por editor/core: primer save de logística con commandId propio; readback exige declaraciones NULL y estimator rechaza PENDING; revisión humana de ambas declaraciones con carga idéntica comprobada por sameDocumentCargo; segundo save con otra commandId/revisión, readback confirma false/false; luego confirm/labels/estimate originales. No se cambió código de producto ni se desactivó una validación. Revisión sólo textual/Git; títulos/aserciones heredados se cotejan como texto completo con multiplicidad y no se quitan. No hubo parser/discovery/prueba/SQL runtime de esta hija. Las cifras508/13 siguen perteneciendo sólo al GO01 de723. Commit/tree, seis diffs/pins, preservación6324 ypropuesta23FULL futura UNBOUND se fijan en el paquete externo de entrega; siguiente paso sigue siendo revisión, sin push ni otra PR.

## Correctiva canónica de fixture tras GO03 — adopción previa (2026-10-22)

General asignó esta autoría después de aceptar la custodia GO03 (d8af95/native0, 161 checks sin diferencias) y leer el dictamen Parent5286/51f7b6d7. Mismo owner, worktree, rama y claim A29; hija DIRECTA de 7bca00826a5d674d6eb58db59ea131772f68feb5. Allowlist exacta: qa/portal-confirmacion/database.test.ts de este SDD, este spec, glm-encargo-20261022.md y .agents/handoffs/0473-glm-encargo-20261022.md. Unión de tarea30 sin ampliar. Adopción guardada en las TRES fuentes documentales ANTES de cambiar la prueba.

Se guardaron cuatro preimágenes físicas ENTERAS y cuatro blobs raw Git del padre, con blob/tamaño/SHA separados, más árbol Git real en C:/tmp/sdd0473-s3-canonical-fixture-fuente-01a1639b-01. MANIFEST previo2673B/SHA25641b155766b555cf38223da2aa3b2dbf5201125e0ba7b98e7f1cb7d69f41f2245; guard0/HEAD7bca/treec379/parent723/rama limpia/A29 comprobados antes de autoría.

GO03 REAL sobre7bca: 23 archivos completos, 521 casos=520 PASÓ+1 FALLÓ, 0 pending/todo/SKIP;22 archivos PASÓ/1 FALLÓ. Falló sólo database.test.ts:65:73, precondición sameDocumentCargo(latest.draft RAW, reviewed proyectado), expectedtrue recibiófalse. Pasos posteriores al segundo save/confirm/labels/estimate de ESE caso no se alcanzaron; siguen NO EJECUTADOS allí. Cotizador11/11, Review10/10 y PDF19/19 con seis instancias CJK y doce artefactos requeridos PASARON. Los521 casos preservan518 fullNames distintos, duplicados y newline;71/69/2 son counters de describeSuites, no de archivos.

GO03 consumido: una exec/15polls/sin CtrlC, nativo1/global1; origen22:44:30.3948251Z/FIN nativo22:45:53.1656049Z/duración82770.7798ms/cierre ORIGINAL22:48:30.3948251Z. Primera respuesta exec11272ms; polls posteriores máximo7057ms/gap2ms. Retorno formal antes de conteos/custodia, ambos exteriores oportunos y fuente después4Git0/A29/sourceUnchangedTRUE. Aviso inicial sourceAfterNULL se conserva sin retrofill. INPUT REAL2332/SHA256c53955a95664870513c6b48232b3299eeccb828dc3eab65888da7545255a5652, call_34257dba90374f27a4801702b51842b0, entero igual al fijo sin LF/CRLF adicional. Custodia38 artefactos/MANIFEST7127/SHA25658d5af897901a882df7c748f3749c590386471bec64f94a03966435cabe05e44 queda intacta; GO01/GO02 también.

Dictamen por fuente: cargoIdentity serializa groups completos mediante JSON.stringify; projectSupplierDocument llama parseDocumentDraft y reconstruye grupos. El servicio reconcileDocumentEdit parsea tanto prior como submitted antes de comparar carga. El orden JSONB frente a DTO es HIPÓTESIS sustentada por fuente y contrato de PostgreSQL (https://www.postgresql.org/docs/17/datatype-json.html); no se observaron las claves concretas de esa fila en otra ejecución y no se demuestra un bug de producto.

Se adopta la corrección de fixture por el contrato canónico EXISTENTE: canonical=parseDocumentDraft(latest.draft), reviewed=projectSupplierDocument(canonical), tres comparaciones semánticas profundas de productos/grupos/totales contra el RAW autoritativo, declaración humana explícita false/false y sameDocumentCargo(canonical,reviewed) mantiene expectedtrue. Un cambio real de carga debe hacer fallar las comparaciones profundas. Se conservan NULL y bloqueo del estimado antes de revisión, segundo save con commandId nuevo/revisión/readback falsefalse, confirmación real/revisión vigente, dos códigos físicos únicos,32kg/.24CBM y aislamiento de otra compra. Sin defaultfalse, mock core, nuevo oráculo false, helper de producto, SQL directo ni SKIP.

Esta fase permite sólo autoría ligera/Git/guard/commit selectivo de CUATRO rutas. Los tres asserts aditivos NO son tres casos nuevos; se conservan los521 títulos/casos por fuente sin inventar discovery. NO EJECUTADO en la nueva autoría: producto Node/import/parserAST/discovery/tests/tipos/lint/build/verify/SQL/DB/Docker/servicios/API/configprivada/clave/ledgerreal/install/push/merge/producción. Propuesta futura23FULL UNBOUND con nueva fuente,180+60 sólo propuesta y origen/GO/keys/output/autorizaciónNULL. Nueva corrida con orden concreta posterior; no reuseGO03 ni otra puerta genérica de Sam.

## Arranque aislado GLM — adopción nominal antes de autoría Vite (2026-10-23 UTC)

General asignó al MISMO Worker la hija DIRECTA de `06e236583db0be74f67d36026a8e287ca2e951b6` / tree `f237fb2494176aee8498c5d7e1f4c0ff401a1ccb`, después de revisión `b28a4f/native0`, 404 comprobaciones sin diferencias. Mismo worktree, rama, owner y claim A29; no autorización adicional genérica de Sam. La asignación sólo permite autoría ligera y commit LOCAL selectivo de estas CINCO rutas existentes:

- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/glm-encargo-20261022.md`
- `.agents/handoffs/0473-glm-encargo-20261022.md`

Se adoptan íntegros el contrato baseline32374/SHA2564de3d379cb76c04d7f247f5d30022dc0c167f64286084d4a455d730739490b15, el diseño v2 79937/eb75eb9d5bfb25a2f49ce17feaaf2c4a47ccabed571805855912f4ca4c0226d0 y su metadata28307/4686e0cc7761e8d5dc04e009c073d60b364b9f7b28f5f2fd0468057663270f15, más suplemento CSS16377/d89fa3d2eb9498700120da390ed9dabf6f9d3de8ed3c093fac920f3826575601. Referencias originales fijas: C:/tmp/sdd0473-real-acceptance-contrato-root-06e-01, C:/tmp/sdd0473-real-runtime-diseno-root-06e-02 y C:/tmp/sdd0473-real-runtime-css-diseno-root-06e-03. Sus manifiestos y copias ENTERAS están en `C:/tmp/sdd0473-real-runtime-fuente-01a1639b-01/authorities/`; no se reescribieron los originales.

ANTES de esta adopción se ejecutó guard0 y se verificaron identidad limpia/A29 y cinco preimágenes FÍSICAS más cinco blobs rawGit completos, modos y blobs. Manifest previo10752B/SHA256ac36265d5a0d0ab748a6b79481e52ef79efbede58cc4109a396175cdbf136f61, nativefc54f5/0, 2026-10-23T00:13:53.6280498Z. Árbol6330, fuera de cinco6325; cinco físicos/raw iguales por bytes/SHA, EOL separados en manifest. La unión S3/correctivas30 no cambia.

Mecanismo adoptado: `QA_GLM_TEST_RUNTIME_ROOT` acepta únicamente el root literal prestado packing-list-portal-confirmacion-20261021 y sólo backend4323/frontend4324 GLM, con contexto inválido rechazado ANTES de imports externos. Sin variable se conserva legacy. Node24.19+loader TSX4.22.3 y cuatro argv exactos del contrato; imports ESM físicos Vite8.0.16/React6.0.2/PostCSS4.3.0; quince alias cerrados y stubs next/navigation-link-image protegidos. Cache futura propia bajo XDG_CACHE_HOME, fs allow cerrado a WT propio/node_modules prestado/cache; envFile:false, loopback, strictPort, watch:null. Sólo el transform de OWN globals.css sustituye el import Tailwind por índice físico relativo fijado/source(none), preservando from y cuatro @source OWN. No se edita globals.css ni vendor.

GO04 sobre06e PASÓ: 23 archivos/521 casos aprobados,0fallos/pending/todo/SKIP,6CJK/12artefactos. Custodia39+39copias/manifest7314/9f49f4a185a7a83d235133c0a66c123eb9bb067a992d8fbe7f2e88688b375f2b aceptada por Generalbaf3e2/272checks y Parent1fd94e/126checks. Ese resultado pertenece a06e; NO acredita la nueva hija ni se repetirá por esta orden.

Esta adopción en spec/encargo/handoff precede al cambio Vite. NO EJECUTADO en esta fase: candidatos/imports/probes/require.resolve/parserAST/discovery/tests/tipos/lint/build/verify/SQL/DB/Docker/servicios/browser/API/clave/config privada/ledger/install/push/merge/producción. GO/origen/reserva/entorno/cache/output futuros permanecen UNBOUND. Compatibilidad y cierre transitivo pendientes; no se activa multicompra ni se cambian producto, UI, tests, PDF/CJK, motor, loader privado o caps. Objetivo GLM real permanece abierto después de revisión y entorno/dataset completos.

Cierre de autoría de este slice: Vite incorpora el selector cerrado y validación previa a imports, entrys ESM físicos y quince alias tupleados del diseño; la excepción exacta de tres adaptadores Next conserva el loader local previo. Cache por puerto queda bajo XDG_CACHE_HOME, con guardia de ruta absoluta/no raíz/no solapamiento y fs allow de tres raíces. El transform limita la sustitución CSS al ID OWN (también cuando Vite añade query), exige un único import bare y mantiene las cuatro @source/from; rama legacy conserva resolución/imports y transform previos. README distingue el GO04 aceptado de la hija y fija caller/argv/entorno propuestos. No se creó ninguna cache/perfil ni se ejecutó ese código. Revisión actual sólo textual/Git; los errores de EOF del primer git diff --check se corrigen al completar este cierre documental. Próxima evidencia: checkpoint exact5/6325 fuera de allowlist/inversas completas y revisión General, después validación nominal de harness. Multicompra, pnpm verify/build, demo/GLM real y aceptación final siguen pendientes; no publicar conocimiento compartido desde esta rama.

## Adopción GLM-SSR-NATIVE-FIVE-20261023-01 · 2026-10-23 UTC

Sam mantiene el encargo de avanzar con las 23 suites y la conexión real de GLM en PR319, sin merge ni producción. General activó la autoría nominal del mismo Worker después de revisar la propuesta SSR-interop y el dictamen Root f1b6ef (198 comprobaciones, sin diferencias). Esta adopción se registra en los cuatro documentos antes de modificar Vite.

El padre autorizado es ff74ff5b330c477458029820092283a0d7bb8e9d, árbol 00e9be58b5e594ddbf7a769655868c089ba185de. El slice conserva exactamente cinco rutas existentes: vite.config.ts y README.md de QA portal-confirmacion, spec.md de SDD0473, glm-encargo-20261022.md y .agents/handoffs/0473-glm-encargo-20261022.md. La única implementación será la interoperabilidad SSR del harness: 20 entradas Node físicas verificadas, 11 CommonJS mediante un puente ESM virtual con createRequire local y 9 ESM mediante su archivo Node/import. Se conservan los aliases de navegador, los tres adaptadores Next, las guardas de runtime/perfil/cache/fs/CSS y los contratos del lector, servicios, privacidad, clave y ledger.

La propuesta fija está en C:/tmp/sdd0473-glm-ssr-external-propuesta-01a1639b-01/MANIFEST-PROPOSAL-SSR-INTEROP.json, 2759 bytes, SHA256 370d64a763efaae315ba03d95fc95d934f4960da3a949bb9cb0a5e176132edfd. Reutiliza 15 manifests, 127 fuentes y 55 referencias literales; el escáner de cláusulas es literal y no se presenta como AST. El bridge reexporta el objeto CommonJS real y nombres fijos de la tabla; no modifica globals ni vendor. La compatibilidad del grafo y la causa probable de module is not defined deben comprobarse en el siguiente START real.

Antes de esta adopción se preservaron cinco preimágenes físicas y cinco raw Git, con modos/blobs y comparación entera, en C:/tmp/sdd0473-glm-ssr-interop-fuente-01a1639b-02. HEAD/rama/árbol limpios y claim A29 se verificaron. El intento ADMIN previo 915996 falló al capturar resultados de PowerShell, antes de editar fuentes; su original queda preservado y la captura corregida 2a0b5d terminó con código 0.

Evidencia vigente: las 23 suites de 06e pasaron 521/521 sin SKIP; no son una ejecución de este nuevo slice. START01 falló antes de API. DIAG02 terminó con actor/child 0 y capturó ESM limpio de 10705 bytes; no evaluó el módulo ni extrajo el PDF. Sus originales y la NC de input (2985 = prefijo BOUND de 2984 + LF final) permanecen en custodia aceptada con NC. La propuesta SSR_GRAPH_EVALUATION y sus ventanas fueron retiradas sin activarse.

Estado de este slice al adoptar: EN AUTORÍA. Las comprobaciones de cierre serán diff/inversas completas, prefijos documentales enteros, conteo real de todos los modos/blobs fuera de las cinco rutas y commit selectivo hijo directo de ff74. No se ejecuta Node de producto, parser, import, check, suite, START, SEND, API, instalación, push, merge o producción por esta autoría. El próximo START requiere checkpoint fijo revisado y una orden nominal nueva; su supervisor nuevo tendrá exactamente una LF final, sin normalizar los intentos anteriores.

## QR-QA local y plan E2E Excel — adopción nominal 2026-10-23

General y el Director de Packing asignaron este slice al mismo Worker, worktree, rama y owner A29, como hija directa de 43582b364368dea4bd2e9d48e708451e896150b5 (árbol 3feb72075bb28467d0743e73fa3e52ddd9c6f27d). Se registra esta adopción ANTES de crear comportamiento. Superficie QA del portal, riesgo R2, lectura local; no constituye lanzamiento de producto ni excepción de gobernanza.

Allowlist exacta de CUATRO rutas:

- docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/qr-preview/index.html (nueva).
- docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/qr-preview/qr-preview.js (nueva).
- docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md.
- .agents/handoffs/0473-glm-encargo-20261022.md.

Preimágenes físicas completas y raw Git de ambos documentos, ausencias de ambas rutas QA, árbol mode/type/blob y 23 fijos SEND02/binding preservados en C:/tmp/sdd0473-glm-qr-source-01a1639b-01/MANIFEST-PREIMAGE.json (SHA256 7a2e1eb6b66ecb09eccc221a00106215d44b40ca8d7611a295e6a37d521eb8fc). Conteo actual: 6330 entradas, 6328 fuera de allowlist. Guard y ownership comprobados; no se toma el conteo de otra fase.

Se adopta la propuesta Root completa proposal-UNBOUND.json de 11110 bytes/SHA256 4f2fdecc395103ef41486980ef7f85d6770a09e49eaf03bd5424a4da83c16b72 y la fixture manual ficticia de 3976 bytes/SHA256 6daedf501609a6d5a8b77b83a7c94b049d0b7ccbffacabb76d70dfbaf0c9b1b8, CONDICIONADA a mapping real A=4 cajas VAS-01+TAP-01 (80+80 unidades), B=6 cajas BOT-01 (60 unidades). Totales manuales 138 kg bruto/114 kg neto/.70 m³/10 cajas/220 unidades/USD340; no son mediciones físicas ni datos extraídos. La propuesta original .66 m³ y el peso A ausente se conservan como procedencia. No inferir 52/130. Battery=false y specialCargo=false exigen declaración explícita después del cambio de carga, relectura pendiente y segundo guardado sin otro cambio de carga.

Estado real GLM: guardado protegido SAVED/writeVerified=true y DIAG05 local aceptados; SEND02 FALLÓ OCR, job d7944896-3caa-451e-9e6e-72c3511b7ee4, extraction_unavailable, receipt/propuesta null, causa/HTTP/cuenta NO DISPONIBLES. GO02 consumido. No reenviar PDF, aplicar resultado inexistente, reclamar caché exitosa ni renovar créditos. Las 23 suites/521 casos de 06e pasaron sin SKIP; no acreditan esta hija ni el flujo real completo.

Sólo se autoriza autoría estática, revisión de texto/Git y checkpoint local selectivo. Quedan NO EJECUTADOS hasta revisión de fuente y GO concreto: runtime, parser/import, tests, lint/build/verify, SQL, HTTP, navegador, procesos/CIM, observabilidad de ocho rutas, instalación, push, merge y producción. Se conservan backend56996/frontend52116, perfil03, UUIDs, caché, ledger, credencial y todos los originales. El cierre de conocimiento/Graphify/Archify/Obsidian queda pendiente de integración; no se publica desde esta rama.

### Contrato implementado del visor QA (fuente estática, sin ejecución)

Entrada local prevista: /docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/qr-preview/index.html sobre http://127.0.0.1:4324. HTML/JS nativos, sin imports de Studio/DB/Supabase, sin dependencias nuevas ni CDN. Fuentes WOFF2 existentes de lib/font-files y subconjunto literal de tokens canónicos de app/studio/tokens.css; no se carga el CSS del Norte que importa Google. Esta pantalla es un consumidor QA experimental acotado, no una primitiva compartida ni una promoción CMP. Se consultó generated/component-registry.json: sus canónicos React/Studio (incluido NumericInput) no sirven al entry vanilla aislado. Revisión y versión de identidad posteriores de BRAND.md prevalecen sobre textos históricos del Norte: Nunito/Sora/JetBrains locales y Shipping Mark.

Los UUIDs nominales de Recovery03 se eligen por caso cerrado: Excel7015967d-5c7d-4a58-8dad-7ade1e7784e0/DTD-DEMO-1-2 y PDFf26ee17c-59d4-43ef-9f9b-bcb5f7c2cd29/DTD-DEMO-1-1. No se deduce compra de c/n ni se permite una URL API arbitraria. El QR exige /verificar y exactamente c/n/b, sin credenciales, fragmento, parámetros extra/duplicados, espacios o barras inversas. c=DTD-DEMO, n entero positivo/caja<=total y total10 (límite del dataset autorizado, no regla comercial); b físico DTD-B-dígitos y coincidencia exacta con caja vigente obligatoria. Enteros de revisión/versión son identificadores seguros JS, sin aritmética; NUM-01 de importes no aplica a estos identificadores. La guarda de 2048 caracteres de entrada QR y 200 de folio sólo protege este formulario QA.

Errata de inferencia de host: labelVerifyUrl usa NEXT_PUBLIC_SITE_URL o fallback https://dtdcargo.com; Vite define ese valor por puerto. El host REAL del próximo PDF aún NO FUE OBSERVADO. Se admiten como DATOS exclusivamente https://dtdcargo.com (formato legado documentado), http://127.0.0.1:4323 y :4324 (launchers QA). Nunca se sigue ni se convierte en enlace el URI original. Sólo se consulta API GET en origen4324, path fijo /api/document-import. Orden: workspace(id) → labels(id,expectedRevision EN QUERY) → workspace(id), sin retries. El enlace de consulta que se habilita tras éxito es una ruta local de documento con compra nominal, pestaña nueva anunciada y noopener.

DTOs reales: projectWorkspace devuelve id/revision/draft/confirmedRevision/expiresAt, NO compra/folio/version. getDocumentLabels devuelve revision/folio/versionNo/labels[{code,boxN,totalBoxes,boxCode}], y revalida confirmed_submission_id en servidor. Se exige workspace.id nominal, revisión segura igual a entrada y confirmedRevision, grupos completos/total10, ausencia de issues bloqueantes sin resolver (resolved=true conserva historia sin bloquear, igual a confirmationIssues), conjunto labels10 ordenado1..10 con código de compra exacto y b únicos, folio/V iguales a entradas impresas y b/n/total exactos. Después se compara la proyección workspace entera anterior/posterior. No se inventan propiedades DTO; los dos GET del workspace no contienen folio y la protección del submission es el gate existente del servidor. La consulta no es snapshot transaccional ni promesa perpetua.

Mensaje exacto: **Caja válida en la revisión consultada**, con folio/revisión API y fecha inicio/fin UTC. c/n/b NO codifica versión; un papel anterior con QR idéntico no es discernible automáticamente. Rev/folio/V impresos se comparan por entrada explícita; expectedRevision vieja es un negativo del contexto/API409, no una detección criptográfica de antigüedad del papel. Reimpresión con b/QR estables es compatible. No se cambia labelVerifyUrl.

Toda entrada invalida inmediatamente el resultado; generación de solicitud y AbortController impiden una respuesta tardía. Plazo local15s para toda la secuencia; cancelación segura de lecturas, bloqueo doble submit, MIME/HTTP/DTO/error seguros, sin cuerpo/stack/rutas internas. textContent/createElement, sin innerHTML. No se muestra información parcial ni datos de caja vecina. Inputs se conservan ante fallo; pageshow/pagehide invalidan observaciones restauradas. No se persiste estado en almacenamiento del navegador.

### Matriz SGE-00 v1.0 — doce principios de este delta R2

CUMPLE se limita a la evidencia de fuente indicada. NO CONFORMIDAD de aceptación significa verificación conductual pendiente; no hay aprobación de consumidor PASÓ ni excepciones. El checkpoint se entrega para revisión, no para cierre.

| Principio | Estado efectivo en este checkpoint | Evidencia / razón / gate |
|---|---|---|
| .01 Acción predecible | CUMPLE en fuente | Formulario Comprobar caja realiza lectura; Cancelar consulta aborta lectura; tema sólo cambia presentación. qr-preview.js/read, invalidate y submit. |
| .02 No pérdida silenciosa | CUMPLE en alcance de fuente | Ningún comando de negocio ni guardado. Errores/cancel conservan entradas actuales, eliminan sólo resultado obsoleto. Navegación de consulta en otra pestaña. Persistencia de documentos fuera del visor no se altera. Prueba de conservación en navegador pendiente. |
| .03 Fricción según riesgo | CUMPLE en fuente | GET local reversible, una acción sin confirmación extra; contexto impreso obligatorio por ausencia de versión en QR. No mutación MP. |
| .04 Auditoría crítica | NO APLICA | El visor no ejecuta acciones financieras/críticas/permanencia; fecha observada no se presenta como auditoría de negocio. |
| .05 Permisos/tenant/privacidad/estado | NO CONFORMIDAD de aceptación pendiente | Origen único, casos nominales y DTO/gate de confirmación en fuente; negativas crosscase/401/403/404 aún NO EJECUTADAS. QA ficticia no acredita seguridad de producción. No se muestra draft/PII. |
| .06 Prevenir errores | CUMPLE en fuente | Formato, límites de dataset e identidad física antes de red; blur/submit y corrección viva; comparación de tres lecturas antes de éxito. Pruebas negativas pendientes. |
| .07 Estado verdadero | NO CONFORMIDAD de aceptación pendiente | Diseño pending/error/cancel/timeout/success, generación+abort y limpieza sin éxito parcial. Carrera y doble submit requieren ejecución; no declarar PASÓ por conteo de código. |
| .08 Frecuencia/complejidad | CUMPLE por decisión documentada | Una consulta requiere caso, QR y Rev/folio/V porque QR carece de anclas documentales. No se mide ahorro de clics ni duración sin ejecución. |
| .09 Reutilización | CUMPLE por revisión de fuentes | Registro CMP leído, sin canónico compatible con entry vanilla; reusa tokens/fuentes y elementos nativos. No nuevos consumidores deprecated ni primitiva global. |
| .10 Accesibilidad equivalente | NO CONFORMIDAD de aceptación pendiente | Labels, button/types, Enter submit, errores asociados/foco, aria-live/busy, targets44px, reflow y reduced-motion previstos. Teclado/lector/contraste renderizado/200%/375/390/light-dark NO EJECUTADOS. |
| .11 Lenguaje y recuperación | CUMPLE en fuente | Copy venezolano, explica qué falló y qué sigue, estados con texto/símbolo localizado; no color único ni éxito GLM inventado. |
| .12 Autoridad humana IA | NO APLICA al visor | No modelo, prompt, inferencia ni efecto externo. El plan E2E conserva propuesta humana revisable y fixture ficticia; no habilita GLM. |

Políticas aplicadas al delta: FRM-01v1.1 (pristine→blur/submit→invalid→live correction), ERR-01, LOD-01, A11Y-01v1.1, LNK-01, CMP-01v1.1, BTN-01v1.1, VIS-01 y MOT-01. AUD-01/02, MP-01, IA-01, UPL-01 y TBL-01 no aplican a la lectura del visor; continúan vigentes para acciones de producto de otras fases. No excepción.

Contrato BTN: actionKey=qa.document-box.lookup; verbo Comprobar; resultado lectura contextual; role primary; risk routine (superficie R2 por integridad documental); permanence not-applicable; friction R1; permission not-applicable a cuenta (QA ficticia loopback, no sustituye autorización servidor); precondiciones origen4324/caso nominal/QR y anclas completos; buttonType submit; idleLabel Comprobar caja; loadingLabel Comprobando caja…; successLabel Caja válida en la revisión consultada; recuperación inputs conservados+revisar contexto/servicio; audit.required=false por ausencia de mutación; afterSuccess stay; undo.available=false porque no hay efecto persistido. Cancelar consulta y tema son terciarios button; no borran trabajo documental.

### Plan completo de ejecución E2E aún UNBOUND

Propuesta durable externa: C:/tmp/sdd0473-glm-qr-source-01a1639b-01/E2E-EXECUTION-PROPOSED-UNBOUND.json. Contiene11 fases con presupuesto total PROPUESTO1800s+120s cierre, identidades PID/birth/exe/argv y casos, rutas API/métodos, variables de revisión tomadas de recibos reales, fixture, negativos, artefactos binarios, render/decodificación QR y paquetes de inspección propuestos. GO/aceptaciones/ENTRY/deadlines/dispatch siguen NULL/AUSENTES; no renueva SEND02 ni créditos. Debe fijarse SHA/árbol actual antes del GO.

Recorrido propuesto: preflight conservador → Excel UI/native combinado una vez → propuesta real y apply → borrador incompleto compartido → bloqueos logística → corrección manual ficticia y procedencia → relectura/declaraciones explícitas false/false en segundo save sin cambiar carga → stale409 → confirmación real → recarga cliente/proveedor → motor real estimateDocuments/calcularEnvioLCL con QA_TARIFA_FICTICIA de una compra → XLSX/PDF10etiquetas actuales → render de todas las páginas/decodificar10QR del PDF real → visor local positivos/negativos/reimpresión → revisión visual y teclado.

La propuesta de paquete de inspección es PyMuPDF/Pillow y cv2.QRCodeDetector o zxing-cpp del runtime ya instalado, sujeto a descubrimiento y admisión exactos en la fase ejecutable; NO se han cargado, probado ni instalado. Fuente de URI de generación no es prueba de decodificación de un PDF. Si selección de archivo no tiene API de chooser documentada, se informa NO DISPONIBLE y se presenta alternativa local al Director, sin inyectar DTO/FileEntry ni afirmar prueba UI. Si Vite no sirve el entry, detener esa parte y devolver evidencia/alternativa antes de ampliar rutas.

No se cierra aceptación total con Excel: PDF real sigue FALLÓ OCR sin propuesta/receipt y sin nuevo envío. Tarifa es ficticia, mercancíaUSD340 separada del flete; multicompra/WeChat real/revisión humana china/producción NO EJECUTADOS. pnpm verify/build, governance/components/docs scripts y automatizaciones de conocimiento NO EJECUTADOS durante esta autoría por la orden concreta de fuente sola.

UI-CHECK estático /ui-check: sin hallazgo duro de marca en revisión de fuente; campos/acciones semánticos, copy, fuentes locales y tokens, foco/hover/active/disabled/empty/loading/error/success previstos, layout fluido sin columnas de datos de ancho fijo. Prioridad alta pendiente: contraste real, teclado/lector, reflow200% y viewport375/390, cancelación/carrera y recuperación. Veredicto: fuente revisable, aprobación de consumidor y evidencia visual PENDIENTES; sin capturas ni ejecución de prueba.


## Demo nativa de Excel propio — adopción 2026-10-23

General cerró ROI06-02 y asignó este slice al mismo Worker GLM/owner A29, rama
codex/packing-glm-encargo-20261022, como hija directa de
c1682cc529754c35d001c964b31cdcd59e2bebd0 (árbol
66abc9e787c2f0a284ec1d1ef3e2932fe4996fa0). Guard y cuatro Git individuales
pasaron; las seis preimágenes físicas coinciden byte por byte con raw Git.
La adopción se registra antes de modificar comportamiento. PR319 sigue DRAFT,
sin push en esta fase, merge ni producción.

Allowlist exacta: vite.config.ts, server.ts, fixture.tsx y README.md de esta
carpeta QA; spec.md de SDD0473; .agents/handoffs/0473-glm-encargo-20261022.md.
Ningún componente ni librería de producto cambia.

### Contrato y alcance R2 de esta hija

Superficie: harness QA local del portal; selección/importación revisable y
estimado ficticio. Los esquemas, servicios, extractor, exportador, componentes
de producto y tarifas online permanecen fuera de la allowlist.

- Admisión nativa cerrada: root y runtime existentes, 4325 backend sin proxy /
  4326 frontend con origen exacto 127.0.0.1:4325; GLM/PDF desactivados,
  entorno limpio posterior y cache propia. Se conservan las veinte entradas SSR
  y cuarenta anchors; no nuevos hooks, dependencias o ampliación de fs.allow.
- Middleware con cuarta opción nativeOnly=false por defecto. En modo nativo
  valida metadatos/tamaño/tipo, conserva bytes sólo en RAM, invoca el lector
  existente con {nativeOnly:true} y usa los recibos reales de apply/save.
  Lecturas ambiguas no invocan IA; el error permite revisión manual.
- PDF rechazado antes de cualquier ssrLoadModule PDF. No constructor GLM,
  lectura de configuración/ledger, HTTP externo ni fallback asistido.
- Caso PGlite nuevo; UUID real no conocido hasta startup. No clonación R4,
  reset, restauración o reconfirmación del banco GLM previo.
- Revisiones/confirmación/segundo guardado de declaraciones conservados.
  Peso/CBM/batería/carga especial desconocidos siguen pendientes.
- Estimación mediante motor existente con QA_RATE_SNAPSHOT ficticio y revisión
  ligada al resultado; no precio firme ni paridad comercial online.
- UI reutilizada: aviso XLSX/CSV local sin IA/PDF; reset oculto y bloqueado.
  Sin nueva primitiva, colores, tipografías, jerarquía o flujo de producto.

### Evidencia y aceptación proporcional

ROI06-02 PASÓ: 10 QR originales y 10 de reimpresión distintos/ordinales1..10,
misma URI/código por caja, texto vigente completo, tres etapas nativas0 con EOF.
PDF/DTO/R4 y las fuentes C168 se preservaron. Original8/10 y ReferenceError de
ROI06-01 siguen históricos, sin corregir sus resultados retrospectivamente.
Índice17referencias, 8318/SHA256
59df6a57676a7cb850950150a725e5dc4e284a9caeb1352a3f0a73efef605a79.

Gobernanza: SGE-00/UPL-01/ERR-01 aplican a selección, error y conservación.
CUMPLIMIENTO de fuente: guardas de contexto, carga declarada/validada,
propuesta humana y bloqueo de reset. IA-01: NO APLICA ejecución de IA en
este modo, con obligación de aviso veraz y salida manual conservada.
R3/producción/cuentas/transferencia externa: NO APLICA a esta hija.
Accesibilidad y comportamiento: NO CONFORMIDAD de aceptación pendiente,
sin excepción; conservar roles, controles/labels/foco/carga existentes y
verificar en navegador con archivo ficticio bajo GO. Sin promoción CMP.
BRAND/Norte y AGENT-BRIEF consultados; sin cambio de diseño ni biblioteca.

Comprobaciones de esta fase: revisión textual/Git/preimágenes/allowlist y
preservación de todos los mode/type/blob ajenos. Tests/parser/import/build,
governance/components/docs check y pnpm verify NO EJECUTADOS por la orden
de autoría estática. Para el harness se propone GO específico de startup y
recorrido conductual; el cierre canónico de producto es una fase distinta.
No atribuir los 23 suites/521 previos a esta hija.

Aceptación futura: procesos propios/entorno limpio/listeners4325-26; UUID/R0
nuevo; carga real XLSX/CSV → propuesta/apply/recibo/reload → save/stale409;
PDF/formato/tamaño/CSV inválidos y ambigüedad sin IA; export XLSX; estimado
ficticio y revisión; UI/teclado; ausencia de intervención en 4320/21/23/24.
Código hijo revisado y GO concreto antes de startup. OCR PDF GLM sigue
FALLÓ histórico/causeND, sin reenvío por inferencia.


### Checkpoint nativo de fuente — 2026-10-23

Tres QA implementados; revisión textual del diff y metadata43pines sin diferencias.
Se conserva el modo previo con nativeOnly=false. En nativo se usa storeJob propio
con contexto SHA256 local y applyImport real; metadata/bytes PUT y revisión se
revalidan. No se cambian los servicios ni el extractor de producto. El plan de
arranque900+120s es PROPUESTA en el handoff, no autoridad ni observación runtime.
Incluye validación ficticia y pareja humana fresca, ambas a admitir expresamente.
Parser/tests/compilación/startup/UI y enlace usable siguen NO EJECUTADOS.

## CI319 · cierre candidato de estrechamiento TypeScript · 2026-10-23

Encargo del Director al mismo Worker: corregir los diagnósticos de tipos de
run `40019590003` sobre A26. La CI histórica permanece FALLÓ (TypeScript exit 2);
el resultado de otro SHA no se hereda ni se obtiene reintentando ese run.

Allowlist exacta del candidato: `components/document-import/DocumentImportPanel.tsx`,
`qa/portal-confirmacion/glm-test-ledger.ts`, `qa/portal-confirmacion/glm-test-runtime.ts`
(las dos últimas relativas a esta spec), `lib/studio/document-import/extraction-contract.ts`,
esta spec y el handoff `.agents/handoffs/0473-glm-encargo-20261022.md` del WT nuevo.
No se modifican los cuatro tests existentes ni tsconfig.

Cambios: referencia local no nula al mismo workspace para el callback de sondeo;
retorno explícito de las guardas que ya lanzaban errores en journal/caché;
dirección local de celda y estrechamiento string explícito antes de usarla.
Las condiciones, errores, límites y orden de efectos persistentes se conservan;
esta conclusión es revisión textual razonada, pendiente de verificación de CI.

WT `packing-glm-ci-cierre-20261023`, rama `codex/packing-glm-ci-cierre-20261023`,
desde A26/`a8704347d3397b1da637a95de0b7d7c1de62b9c7`. El WT A26 que sirve HUMAN03
queda sin escrituras ni intervención; el actor no lee app ni documentos de Sam.

La revisión Git/diff no sustituye compilación. Candidato/tests/lint/typecheck/build/
SQL/UI, pnpm verify y gestores/conocimiento están NO EJECUTADOS por el encargo
actual; node_modules está ausente y no se instala ni copia. Gate pendiente:
revisión Parent-General y luego CI automática del respaldo normal de la misma
PR319, base main, sin force, nueva PR, merge ni producción.
