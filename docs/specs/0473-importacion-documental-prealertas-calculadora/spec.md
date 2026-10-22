---
sdd: "0473"
title: "Importación documental, borrador compartido y calculadora puerta a puerta"
status: in-progress
author: "Codex"
created: 2026-09-16
updated: 2026-10-21
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
sin cotizar transporte. El proveedor confirma el despacho y obtiene Excel/impresión/etiquetas.
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