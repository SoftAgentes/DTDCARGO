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

Autoría guardada para revisión: sondeo secuencial que reprograma el siguiente tick también al
rechazar GET; sesión interna por identidad de workspace y guardas de vida para operaciones
pendientes; generación del editor editable y guarda padre reiniciadas juntas al adoptar una
revisión. El contrato HTTP no incorpora AbortSignal: una solicitud ya emitida puede concluir,
pero su respuesta se ignora y no inicia trabajo posterior en la sesión descartada.
Se escribieron nueve casos de regresión SIN EJECUTAR: ready y partial con primer GET fallido;
cancelación del timer al desmontar; respuesta GET posterior al desmontaje; A→B con GET antiguo
pendiente; padre real null→abierto; apertura tardía descartada; adopción borrador y confirmada
con DocumentEditor real, sin formulario anterior y con navegación/guardado posteriores.
