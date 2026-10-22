# SDD-0473 · Encargo GLM para revisión del Director

Fecha: 2026-10-22, America/Caracas. Estado: **propuesto; primera fase documental terminada**.
Owner: `worker-packing-glm-01a1639b-cd99-7921-ac27-5d218d0a1516`.
Este documento propone autoría; no habilita producto, runtime, API ni publicación por sí mismo.

## 1. Resultado y autoridad

El cliente carga el PDF o Excel de packing/proforma de su proveedor. El portal prepara una
propuesta de Packing List + Factura, conserva fuentes y pendientes, permite revisar/corregir y
exige aplicación explícita. El proveedor revisa el mismo borrador y confirma el despacho; sólo
la revisión confirmada habilita los PDF/etiquetas con identificadores autoritativos existentes.

Se verificó el mensaje humano `01a16397-1de2-7b91-b6ac-9d8d80331447` mediante `read_thread`
en Packing `01a0ab1b-863a-7322-aaa1-db2025e796cd`: Sam cambia Anthropic por GLM y solicita una
tarea en segundo plano. El mensaje `01a1633d-c551-72d3-9482-86ba55d4e969` conserva la preferencia
por la misma PR y por una muestra real, sin merge ni producción. La interpretación de
«Contífico» ya se consulta en Packing; aquí sólo se prepara el portal DTD, sin otra cuenta/ERP.

Director General: `01a160e3-92b0-76f0-bc3c-20000e81ff16`. Coordinación Packing: chat citado arriba.
Esta es la única nueva sesión escritora de la etapa. No se crearon otros chats ni subagentes.
La habilitación posterior de autoría reversible corresponde al Director sobre la allowlist
revisada; no se solicita otra aprobación genérica a Sam.

## 2. Base fija, aislamiento y SDD

| Objeto | Evidencia actual |
|---|---|
| Base Packing | `d42b42de94aa09222b67f342451b2e3cf573e3d4` |
| Árbol de la base | `2a7e4b742e021d5280732b1040972ec0a3993569` |
| Asunto del commit | `docs(studio): cierre QA PDF39 y muestra completa revisada` |
| PR existente | [PR319](https://github.com/SoftAgentes/DTDCARGO/pull/319), OPEN/DRAFT; head d42 |
| Base de PR319 al consultar | `main`, `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8` |
| Rama de autoría nueva | `codex/packing-glm-encargo-20261022`, sin upstream |
| Worktree propio | `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/packing-glm-encargo-20261022` |
| Sesión nueva | `01a1639b-cd99-7921-ac27-5d218d0a1516` |
| Claim | Adquirido y comprobado con guard; se libera al terminar esta escritura documental |

`list_artifacts` devolvió cero adjuntos. Se usó el harness administrativo vigente:
`start packing-glm-encargo-20261022 --from d42b42de94aa09222b67f342451b2e3cf573e3d4`,
después guard, claim y guard con owner. Raíz/rama/árbol inicial limpios comprobados antes de editar.
No se copiaron dependencias, entorno ni secretos. El nuevo árbol contiene los archivos versionados
de d42; no incluye cambios sin commit de otros árboles ni un merge de main.

`git fetch origin --no-prune` terminó correctamente. El conector GitHub no estaba conectado;
la consulta de PR mediante `gh` sí respondió. El remoto local usa la URL histórica
`hailuwaycom-sketch/DTDCARGO`, mientras GitHub devuelve la URL canónica `SoftAgentes/DTDCARGO`.
No se cambió la configuración del remoto.

Inventario focal mediante objetos Git, no mediante `sdd:next`: **349 refs locales/remotas,
247 commits distintos, 91 worktrees y 18 PR abiertas**. Se encontró una única carpeta
`0473-importacion-documental-prealertas-calculadora` y una única `0468-portal-enlace-proveedor-ux`
en esas refs, cada una presente en 336 refs; no se encontraron modificaciones sin commit en
esas dos familias de specs al corte. Se reutiliza 0473, sin reserva ni nuevo ID. Esto no es una
declaración de ausencia de colisiones en todos los demás SDD o en clones externos.

PR320/M7/CORE, PR308 documental y Contabilidad UI/B1 quedan fuera. Sus tiempos, pruebas y GO
no se heredan. El árbol Packing anterior y sus procesos 4320/4321 no se inspeccionaron ni alteraron.

## 3. Reutilización comprobada en d42

| Fuente fija | Función reutilizable y límite observado |
|---|---|
| `lib/studio/document-import/extract.ts:15,70,441` | ZIP/XLSX acotado, ExcelJS, CSV, celdas y parseo determinista. PDF y hojas ambiguas llaman directamente a Anthropic. XLS antiguo exige conversión. |
| `lib/studio/document-import/anthropic.ts:5,13,36` | Error/tipos, schema, prompt y validación están acoplados al adaptador. Usa `countTokens`, `output_config`, `stop_reason`; no son el protocolo GLM. |
| `lib/shared/document-import.ts:5,61,123,179` | DTO cerrado, procedencia página/celda, totales por grupo, incidencias, fusión y adaptador legacy. No hay `netWeightKg`. |
| `lib/studio/document-import/jobs.ts:24,81` | Hash, deduplicación que falla cerrada, reserva de cuota, lease y guardado del resultado. Reserva fija de 200000 tokens ligada al supuesto anterior. |
| `lib/studio/document-import/service.ts:118,123,149` | Proveedor sin fuentes, CAS/commandId, apply explícito, confirmación exclusiva del proveedor y guardado del borrador JSON. |
| `components/document-import/DocumentImportPanel.tsx:160,375,421` | Ciclo de carga, invalidación al cambiar workspace, aplicación y relectura del recibo. Aviso al usuario nombra Anthropic. |
| `components/document-import/DocumentEditor.tsx:36,53` | Resumen, revisión de incidencias, grupos y fuentes; sólo bruto/CBM. Las fuentes visibles se limitan a cinco ubicaciones. |
| `app/portal/(app)/compras/[code]/documento/DocumentReviewClient.tsx:219` | Bloquea importar mientras hay edición local y conserva cambios frente a respuestas tardías. Reutilizar y verificar por regresión. |
| `lib/studio/document-import/export.ts:35` | Excel por asignación; logística sólo en la primera línea del grupo. No incluye peso neto. |
| `lib/studio/document-import/pdf.tsx:25,170` | PDF desde revisión confirmada, cantidades por asignación y etiquetas existentes. No incluye peso neto. |
| `supabase/migrations/0457_document_import_workspaces.sql:166,224` | Conserva draft JSON completo, revisiones y confirmación atómica. Lectura de fuente, no ejecución SQL ni prueba de DB real. |
| `qa/portal-confirmacion/extraction-config.ts`, `server.ts`, `vite.config.ts` | Banco QA aislado, opt-in PDF, `envFile:false`, protección de duplicados/cargas tardías; configuración actual sólo Anthropic. |

Las tres últimas rutas QA son relativas a la carpeta de esta spec. El grafo existente del checkout
principal contiene 43953 nodos; se consultó en lectura con los términos de su vocabulario
`document, import, extract, anthropic, packing, invoice, portal`. Sus aristas EXTRACTED enlazan
`processImportJob → extractDocument → extractWithAnthropic/readXlsx/parseCsv/parseSheet` y
`extractWithAnthropic → parseDocumentDraft`. Las fuentes d42 confirman esas relaciones.
No se afirma vigencia completa del grafo para d42 ni se regeneró/exportó nada.

### Brechas que hacen insuficiente un cambio de endpoint

1. **Peso neto:** no existe en el DTO, parser, editor ni exportadores. El test de Excel que dice
   distinguir neto/bruto sólo prueba que el neto no se use como bruto; no acredita su conservación.
2. **Cambios manuales:** `mergeDocuments.choose` puede preferir el dato entrante por rango de la
   fuente, incluso ante conflicto. Se propone conservar el valor actual y presentar la alternativa
   para resolución humana. La protección UI de cambios sin guardar sí existe y se conserva.
3. **Identidad entre PI/PL:** coincidencia sólo por nombre/código o etiqueta de grupo es insuficiente
   para afirmar misma mercancía entre proveedores/documentos. La fusión necesita pruebas y reglas
   conservadoras de identidad; ambigüedad produce incidencia, no suma ni reparto automático.
4. **Privacidad:** el aviso fijo Anthropic sería incorrecto al usar GLM. Debe mostrar el destinatario
   efectivo antes de transferir bytes, sin exponer configuración sensible.
5. **Presupuesto:** OCR + estructuración son operaciones distintas. La reserva anterior y el
   conteo Anthropic no prueban costos ni límites GLM; un `request_id` no acredita idempotencia de cobro.

## 4. Contratos oficiales consultados

Consulta de documentación pública: 2026-10-22. **CONSULTADO** no equivale a cuenta habilitada ni
a llamada de prueba. No se utilizó ninguna credencial o API de inferencia.

| Fuente oficial | Contrato verificado e implicación |
|---|---|
| [Z.ai API introduction](https://docs.z.ai/api-reference/introduction) | API general `https://api.z.ai/api/paas/v4`, Bearer con Standard API Key. Un paquete agotado puede seguir facturando por consumo; el control local debe fallar cerrado. |
| [Coding Plan quick start](https://docs.z.ai/devpack/quick-start) | Claves Standard, Individual Coding Plan y Team Coding Plan se gestionan separadas; las nuevas no son intercambiables. Coding ofrece bases Anthropic `/api/anthropic`, chat `/api/coding/paas/v4` y Responses `/api/v1`. No son el endpoint documental. |
| [Coding Plan usage](https://docs.z.ai/devpack/usage-policy) | Sus beneficios se limitan a herramientas/productos soportados. No se presume licencia/capacidad para atender este portal multiusuario. |
| [Índice Z.ai](https://docs.z.ai/llms.txt) | Anuncia separación de claves desde 2026-10-16. La página específica de gestión no fue accesible; la no intercambiabilidad sí se verificó en Quick Start. |
| [GLM-OCR overview](https://docs.z.ai/guides/vlm/glm-ocr) | Entrada PDF/JPG/PNG, hasta 50 MB por PDF y 100 páginas en la guía; describe OCR de escaneados/tablas. No equivale a extraer un DTO DTD validado. |
| [Layout Parsing API](https://docs.z.ai/api-reference/tools/layout-parsing) | `POST /layout_parsing`, JSON con `model:"glm-ocr"` y `file` URL/base64; Bearer. El endpoint limita a 30 páginas, frente a 100 en la guía. Devuelve `md_results`, `layout_details`, `data_info`, `usage`, `request_id`. Rango de páginas comienza en 1. |
| [Chat Completion](https://docs.z.ai/api-reference/llm/chat-completion) | `POST /chat/completions`, `messages`, `model`; respuesta `choices[].message.content`, `finish_reason` y `usage`. No es `messages.create` de Anthropic. Rechazar tool calls y finales incompletos. |
| [Structured output](https://docs.z.ai/guides/capabilities/struct-output) | `response_format:{type:"json_object"}` y validación posterior de schema. JSON válido no garantiza propiedades, evidencia o coherencia del negocio. |
| [GLM-4.6V](https://docs.z.ai/guides/vlm/glm-4.6v) | Familia multimodal con imagen/texto/video/archivo; ejemplo de chat `image_url`. No se verificó un payload PDF inline utilizable por este adaptador: no trasladar el bloque `document/base64` de Anthropic. |
| [Tokenizer](https://docs.z.ai/api-reference/tools/tokenizer) | Endpoint distinto `/tokenizer`; el enum consultado documenta `glm-4.6`. No asumir soporte de cualquier modelo ni que cuente el costo OCR. |
| [BigModel HTTP](https://docs.bigmodel.cn/cn/guide/develop/http/introduction) | Otra plataforma/base: `https://open.bigmodel.cn/api/paas/v4/`; documentación general con Bearer API key/JWT. No se asume portabilidad de una clave Z.ai. |
| [BigModel GLM-OCR](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-ocr) | Publica `/layout_parsing` en open.bigmodel.cn. Su ejemplo OCR usa Authorization directo y la guía HTTP usa Bearer: discrepancia a resolver si la cuenta futura es de esa plataforma. |

El perfil recomendado para el primer adaptador es **Z.ai Standard + OCR + chat estructurador
explícito**. Es una propuesta, no una selección de modelo/cuenta habilitada. BigModel y la vía
de visión directa requieren perfil revisado antes de activarse. No hay fallback automático entre
plataformas, protocolos, modelos ni Anthropic.

Felina: `/es/cotizar` no fue accesible con la herramienta; [su página pública](https://felinalogistics.com/en)
promociona carga de proforma/packing, y [/en/cotizar](https://felinalogistics.com/en/cotizar) sólo devolvió
acceso a iniciar sesión. No se enviaron formularios ni archivos. Sirve como referencia declarada
de entrada por documento; no prueba su backend, exactitud, paridad ni una obligación de copiar DDP/HS.

## 5. Diseño propuesto

### Entrada y procesamiento

- **XLSX/CSV conocidos:** conservar el lector determinista y sus celdas. No pagar OCR ni enviar
  un Excel como imagen. Extender neto donde las columnas lo indiquen inequívocamente.
- **XLSX/CSV ambiguos o varias hojas:** enviar únicamente las celdas normalizadas/acotadas al
  estructurador GLM. Mantener hojas/celdas, fórmulas sin cache como desconocidas, y revisión de
  duplicados. No ejecutar macros, fórmulas, vínculos ni instrucciones de celdas.
- **PDF digital y PDF escaneado:** misma entrada documental OCR; después estructuración hacia
  el DTO. No se promete que un PDF con texto prescinda de OCR ni que el escaneado tenga igual
  calidad. Se prueban por separado, con evidencia de cobertura de páginas.
- **XLS antiguo, fotos directas y otros formatos:** no ampliar entrada en esta etapa. Mantener
  conversión explícita a XLSX/PDF y recuperación manual.

Separar `extraction-contract.ts` (error, tipos, schema, prompt de datos y validador) de
`provider.ts` (selección/configuración explícita) y `glm.ts` (HTTP OCR/chat sin herramientas).
`extract.ts` conserva límites y parseo nativo. El adaptador Anthropic conserva compatibilidad
de importaciones/tests, pero no se invoca por ausencia/fallo de GLM ni se exige su clave a Sam.

Para PDF, mantener 15 MiB de límite DTD y techo conservador de 30 páginas, reducible por perfil
TEST. Contar páginas/rechazar cifrado antes de transferir mediante un parser local acotado;
[PDF-LIB documenta load/getPageCount](https://pdf-lib.js.org/docs/api/classes/pdfdocument), pero el
paquete no declara hoy ese parser. Se propone `pdf-inspection.ts` y una dependencia fijada tras
revisión de versión/licencia y límites. No instalar ahora. El conteo no se sustituye por regex.
Timeout debe interrumpir realmente el parser; un Promise.race que lo deja ejecutándose no basta.

El request OCR usa bytes/base64, sin URLs externas del documento y sin hacer público Storage.
Fijar `return_crop_images:false`, `need_layout_visualization:false`, rango 1..N y correlación
opaca por intento. No ejecutar ni descargar HTML, imágenes o URLs devueltas por OCR. Los bloques
se pasan al modelo como datos inertes con identificadores de evidencia asignados por servidor.
La correspondencia de los arrays `layout_details` con páginas, y la codificación base64 exacta,
se deben comprobar en el contrato real; si falta cobertura verificable se rechaza o deja parcial,
sin inventar páginas. No confundir `layout_details.index` (elemento) con número de página.

El estructurador devuelve un objeto cerrado: validar JSON, tamaño, campos, tipos, números finitos,
referencias internas, fuentes, páginas/celdas existentes y coherencia. No aceptar markdown cercado,
tools, HTML como UI, campos adicionales, JSON reparado silenciosamente, `resolved:true` ni IDs
propuestos por el modelo como identidad de negocio. El servidor impone sourceId/nombre y remapea
IDs locales. Cada dato conserva evidencia real; un número de página existente no prueba exactitud.

### Datos, revisión y concurrencia

- Añadir `netWeightKg` nullable por grupo y a totales declarados/calculados. Lecturas v1 antiguas
  sin ese campo se normalizan a null. Es independiente del bruto; no duplicarlo por producto ni
  inferirlo a partir del bruto. Si ambos existen, neto mayor al bruto o totales incompatibles
  generan incidencia bloqueante. Neto desconocido queda visible como pendiente; no convertirlo
  automáticamente en nuevo requisito de confirmación para todos los documentos históricos.
- Conservar valor de mercancía por moneda/unidad; no convertir monedas, usar `$` ambiguo como USD,
  traducir productos ni mezclar cargos de transporte con precios. Cuando un importe se derive,
  citar todos los operandos explícitos; si no bastan, dejar precio/cantidad pendiente.
- Cajas simples/mixtas guardan totales por grupo. Un total global sin distribución no se reparte.
  Mostrar bruto, neto y CBM en revisión, Excel y PDF del documento; etiquetas mantienen su contrato.
- Fusionar PI/PL sólo cuando identidad de proveedor/producto/unidad y composición sea inequívoca.
  Nombre parecido, etiqueta A repetida o misma cantidad no prueban identidad. Conservar ambos
  candidatos/procedencias con incidencia cuando haya conflicto; no sumar la misma mercancía.
- No reemplazar un valor actual distinto por rango de documento. La propuesta y el conflicto
  deben permitir resolución explícita sin perder una corrección manual guardada. Conservar CAS,
  commandId, lease, hash y protecciones de respuestas/cargas tardías del banco y portal.
- El contenido extraído siempre conserva `ai_review_required`. Una revisión parcial puede
  guardarse/compartirse como borrador; nunca implica despacho confirmado. Aplicar/releer un recibo
  no debe presentar éxito de hidratación si falló la relectura ni ocultar lo ya aplicado.
- `DocumentEditor` debe permitir inspeccionar evidencia de campos, sin limitar la revisión a las
  primeras cinco ubicaciones. Proveedor sigue sin originales, nombres de archivos ni fuentes.

El draft JSON completo puede conservar neto sin modificar la migración 0457 según su fuente.
Esto requiere prueba de ida/vuelta en entorno efímero autorizado. No ampliar payload legacy,
tablas de operaciones/contabilidad ni QR para transportar neto; la fuente autoritativa del nuevo
flujo es la revisión del workspace, no una reconstrucción desde filas legacy que pierda campos.
Si la verificación demuestra que hace falta SQL nuevo, detener ese tramo y revisar alcance/ID.

### Configuración y costo

Propuesta de variables de servidor, nunca NEXT_PUBLIC ni accesibles al navegador:

| Variable propuesta | Semántica |
|---|---|
| `DOCUMENT_IMPORT_PROVIDER` | `glm` explícito; sin selección, lectura asistida indisponible. Nativo sigue operando. |
| `DOCUMENT_IMPORT_GLM_PLATFORM` | Perfil revisado `zai-standard`; otros perfiles rechazados hasta validación explícita. |
| `DOCUMENT_IMPORT_GLM_API_KEY` | Secreto TEST suministrado al proceso por canal local seguro; sin valores en chat, Git o handoff. |
| `DOCUMENT_IMPORT_GLM_MODEL` | Modelo de estructuración exacto confirmado por cuenta, sin default ni alias heredado. |
| `DOCUMENT_IMPORT_GLM_OCR_MODEL` | `glm-ocr` explícito cuando el modo documental esté habilitado. |
| `DOCUMENT_IMPORT_GLM_PDF_MODE` | `ocr_then_text`; no activar visión directa por inferencia. |
| `DOCUMENT_IMPORT_GLM_MAX_PAGES` | Entero positivo, techo 30; para la primera muestra se propone 2. |
| `DOCUMENT_IMPORT_GLM_TIMEOUT_MS` | Presupuesto agregado OCR/conteo/estructura menor al lease y a duración de ruta. Propuesta inicial 90 s total; validar capacidad, no prometer SLA. |
| `DOCUMENT_IMPORT_GLM_MAX_INPUT_TOKENS`, `DOCUMENT_IMPORT_GLM_MAX_OUTPUT_TOKENS` | Límites del modelo elegido; medir/reservar antes de generar. Un contador no soportado hace fallar cerrado. |
| `DOCUMENT_IMPORT_GLM_MAX_OCR_PAGES_PER_DAY` | Reserva atómica aparte del presupuesto de texto; no representa un monto monetario por sí sola. |
| `QA_PDF_EXTRACTION_ENABLED` | Opt-in del banco nuevo, puerto libre >=4322, sin proxy4320/4321 y con envFile:false. |

Los endpoints los fija el perfil del servidor; no se reciben de formularios/documentos ni hay
fallback entre dominios. `.env.example` sólo documenta nombres sin valores de credenciales.
Fuera del opt-in QA se eliminan variables de IA heredadas antes de importar el extractor.
La UI consulta capabilities sanitizadas (proveedor efectivo/disponibilidad/formatos), no secretos,
modelos internos o saldo. Si no puede establecer a quién se enviará el documento, no transfiere.

Mantener cuota diaria existente y añadir reserva de OCR/estimación máxima del pipeline antes de
la primera llamada. Contar/reservar la etapa de texto para el modelo soportado; no asumir que
los 200000 tokens históricos cubren OCR + texto. La tarifa monetaria y el máximo TEST quedan
pendientes de cuenta/modelo; no anunciar costo cero. Proponer un solo pipeline/concurrencia1,
sin retries internos. Timeout/conexión cortada tras enviar produce resultado incierto y no
reintento automático facturable; 401/403/modelo inválido son configuración, no éxito ni fallback.
429/5xx sólo se reintentan por el runner bajo cuota/política explícita y sin inventar idempotencia
remota. Lease perdido descarta el resultado y no devuelve éxito durable.

## 6. Allowlist exacta PROPUESTA para producto

No está activa. El Director debe fijar este conjunto o un subconjunto con sus dependencias.
Una ruta fuera de la lista exige revisión concreta. No se adoptan los 17 candidatos referidos
sin contrastar: neto, aviso, presupuesto y protección manual justifican la ampliación siguiente.

### A. Motor y contratos

| Ruta | Cambio permitido propuesto |
|---|---|
| `lib/studio/document-import/extraction-contract.ts` | Nuevo contrato/validación neutral con procedencia estricta. |
| `lib/studio/document-import/extraction-contract.test.ts` | Nuevos casos de schema, evidencia y respuesta incierta. |
| `lib/studio/document-import/provider.ts` | Nueva selección/configuración/capabilities sanitizadas. |
| `lib/studio/document-import/provider.test.ts` | Config incompleta, claves de clase incorrecta y ausencia de fallback. |
| `lib/studio/document-import/glm.ts` | Nuevo transporte OCR/chat, límites, errores y correlación. |
| `lib/studio/document-import/glm.test.ts` | Dobles HTTP de las dos fases; nunca declararlos extracción real. |
| `lib/studio/document-import/pdf-inspection.ts` | Nuevo preflight de PDF acotado y sin raster. |
| `lib/studio/document-import/pdf-inspection.test.ts` | PDF cifrado/corrupto/excesivo y cobertura de páginas. |
| `lib/studio/document-import/extract.ts` | Enrutamiento neutral y captura determinista del neto. |
| `lib/studio/document-import/extract.test.ts` | Reglas Excel/CSV y conservación neto/bruto. |
| `lib/studio/document-import/anthropic.ts` | Extraer código común conservando su frontera propia y sin nueva API real. |
| `lib/studio/document-import/anthropic.test.ts` | Compatibilidad del adaptador anterior, sin debilitar assertions. |
| `lib/studio/document-import/jobs.ts` | Cuotas del pipeline, errores inciertos, lease y estado durable. |
| `lib/studio/document-import/jobs.test.ts` | Concurrencia/dedup/costo/lease, IO doblado. |
| `lib/shared/document-import.ts` | Neto, totales, mezcla conservadora e identidad/procedencia. |
| `lib/shared/__tests__/document-import.test.ts` | v1 compatible, grupos mixtos, neto, fusión/manualidad. |
| `lib/studio/document-import/service.test.ts` | Roundtrip del draft y permisos/autoridad sin cambiar servicios por inferencia. |
| `lib/studio/document-import/migration.test.ts` | Casos efímeros de draft/neto/CAS; sin editar ni ejecutar SQL en esta fase. |

### B. Presentación y salida estrictamente derivadas del mismo documento

| Ruta | Cambio permitido propuesto |
|---|---|
| `lib/studio/document-import/http.ts` | Sólo capabilities sanitizadas del proveedor/límites efectivos. |
| `lib/studio/document-import/http.test.ts` | Capabilities sin secretos y conservación de gates. |
| `components/document-import/document-client.ts` | Tipo compartido de capabilities, sin imports de Studio. |
| `components/document-import/document-client.test.ts` | Transporte/capabilities y errores recuperables. |
| `components/document-import/DocumentImportPanel.tsx` | Aviso del proveedor efectivo antes de envío y estados de extracción. |
| `components/document-import/DocumentImportPanel.test.tsx` | Aviso, sin envío anticipado, cambios tardíos, doble aplicación. |
| `components/document-import/DocumentEditor.tsx` | Neto separado y consulta suficiente de evidencias para revisión. |
| `components/document-import/DocumentEditor.test.tsx` | Pendientes, neto y fuentes; preservar idiomas/accesibilidad. |
| `lib/studio/document-import/export.ts` | Neto por grupo en Excel, sin desplazar columnas históricas. |
| `lib/studio/document-import/export.test.ts` | Exportar/releer con neto y logística contada una vez. |
| `lib/studio/document-import/pdf.tsx` | Neto del documento confirmado; conservar renderer de etiquetas/QR. |
| `lib/studio/document-import/pdf.test.tsx` | Neto, bruto, totales y no regresión de documento/etiquetas. |

### C. Banco aislado, dependencias y documentación

- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/extraction-config.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/extraction-config.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/server.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/server.test.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/README.md`
- `.env.example`
- `package.json`
- `pnpm-lock.yaml`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/spec.md`
- `docs/specs/0473-importacion-documental-prealertas-calculadora/glm-encargo-20261022.md`
- `.agents/handoffs/0473-glm-encargo-20261022.md`
- `docs/specs/README.md`

QA: adaptar selección GLM y su frontera sin tocar demo4320/4321 ni datasets anteriores.
Package/lock: sólo parser PDF aprobado y fijado; transporte HTTP nativo evita añadir SDK GLM.
Índice: únicamente generación canónica futura autorizada, nunca edición manual.
No se propone editar servicio, access, rutas de compra/proveedor, calculadoras, tarifas, cron,
fuentes PDF, CSS global, negocio contable, migraciones existentes ni flags desplegados.
Si una dependencia de aceptación exige esas rutas, registrarla y volver al Director.

## 7. Selección de pruebas por fuente y futuras reservas

**Ninguna prueba de producto se ejecutó en esta entrega.** No se heredan los 39/61 casos históricos,
GO, benchmarks ni resultados de M7. Los tests nuevos todavía son una propuesta; no hay conteo
inventado de casos. Cada corrida necesita checkpoint completo, receta/selección, entorno,
presupuesto de tiempo/uso y GO nuevo; una pesada a la vez, prioridad CORE ante READY válidas.

| Paquete futuro | Selección de fuentes/pruebas | Qué puede acreditar |
|---|---|---|
| Contrato GLM | Nuevos `extraction-contract.test.ts`, `provider.test.ts`, `glm.test.ts`, `pdf-inspection.test.ts`; `anthropic.test.ts` | Schema, llamadas previstas, desactivación, errores, inyección, páginas y límites con dobles. No precisión OCR. |
| Entrada nativa | `extract.test.ts`, `export.test.ts`, `lib/shared/__tests__/document-import.test.ts` | Excel/CSV, fórmulas cacheadas/no disponibles, chino, unidades, neto, grupos, identidad y no duplicación. |
| Persistencia | `jobs.test.ts`, `service.test.ts`, `http.test.ts`; `migration.test.ts` separado | Hash, cuota, timeout incierto, lease, CAS, autoridad y roundtrip. SQL sólo efímero con GO propio; no producción. |
| UI/client | `DocumentImportPanel.test.tsx`, `DocumentEditor.test.tsx`, `document-client.test.ts`; regresión existente `DocumentImportEntry.test.tsx`, `app/portal/(app)/compras/[code]/documento/DocumentReviewClient.test.tsx` | Manualidad, aviso, review/apply, cambios tardíos, conflictos y transporte; no recorrido visible real. |
| QA opt-in | `qa/portal-confirmacion/extraction-config.test.ts`, `server.test.ts` | Sin red con opt-in apagado, fallo cerrado, puerto independiente, repetición terminal y PUT tardío. |
| Documento | `pdf.test.tsx`, `export.test.ts` más regresión HTTP/proveedor existente | Datos del modelo de salida y permiso de confirmación; archivos descargados/QR requieren aceptación aparte. |
| Cierre canónico | `pnpm verify` con desglose de gates/SKIPs, incluyendo build; `/ui-check` si cambia UI | Calidad local del SHA probado. Ledger real no se usa para forzar migración antes de PR. |

Receta focal propuesta: `pnpm exec vitest run <lista exacta del paquete aprobado> --maxWorkers=1
--no-file-parallelism --retry=0`. Antes del GO se sustituye la lista, se fija SHA y se revisa la
compatibilidad con la versión instalada; la línea no autoriza discovery ni ejecución ahora.
No instalar ni reutilizar node_modules de otro Worker sin preparación explícita. Logs/artefactos
van fuera de Git, con marca temporal, SHA, tipo de doble o servicio real y código de salida.

### Aceptación real separada

Muestra existente, sin regenerarla ni rasterizarla en esta fase:

`C:/Users/AKX generator/.codex/visualizations/2026/10/21/packing-list-portal/pdf-import-optin-e060/sample-v3-output/proforma-packing-pdf-002-completa.pdf`

Se comprobaron **4855 bytes** y SHA256
`7fada57b5d00093c5f3950e36de7812226b675a2fc1547d234ca3c790b170b2e`.
Contenido/oráculo referido por el Director y registrado en d42: 2 páginas, 192 pcs, USD390,
10 cajas, 140 kg bruto, 120 kg neto, 0.80 m³; grupo A mixto4cajas/56bruto/48neto/.32,
grupo B6cajas/84bruto/72neto/.48. Esta entrega verificó bytes/hash, no volvió a leer o visualizar
el PDF. El oráculo de autoría es independiente del extractor y nunca se envía como respuesta esperada.

1. Con perfil/credencial TEST y tope de gasto explícitos, subir la muestra a un origen nuevo.
2. Registrar llamadas GLM reales (OCR y estructuración), modelo/request IDs/uso sin secreto ni
   cuerpo crudo en Git. Contrastar todos los campos/páginas con el oráculo; ningún relleno manual
   durante esta etapa se acredita como extracción. Un campo faltante es un resultado parcial.
3. Revisar propuesta e incidencias; aplicar por acción humana. Probar que una edición en curso y
   una respuesta tardía no se pierden, y que repetir upload/apply no duplica extracción/mercancía.
4. Abrir el mismo borrador como proveedor, sin originales/procedencias privadas. Registrar aparte
   cualquier corrección humana prevista de grupo A. Confirmar una sola revisión por el proveedor.
5. Descargar PDF y etiquetas de esa revisión; cotejar datos/folio/códigos y lectura digital QR.
   No reconfirmar o importar sobre el workspace histórico 4320/4321.
6. PDF escaneado y Excel ambiguo necesitan muestras y resultados propios. Chino humano, WeChat,
   papel y escaneo físico se informan aparte; no se deducen del PDF digital o de dobles.

## 8. Gobernanza y privacidad de esta propuesta

| Tema | Clasificación y evidencia |
|---|---|
| Aislamiento/SGE/SDD | Cumplimiento de fase documental: tres rutas propias, guard/claim, base fija, sin producto. |
| IA-01 I2 | Diseño propuesto de preview/revisión/aplicación; runtime NO EJECUTADO. No atribuir confirmación a IA. |
| UPL-01, ERR-01, LOD-01, PRG-01 | Reutilizar límites/estados existentes; incidencias recuperables y éxito sólo durable. Validación futura. |
| Aviso Anthropic al cambiar a GLM | No conformidad futura identificada por fuente; `DocumentImportPanel.tsx:421` exige corrección antes de transferir. |
| Neto y cambios manuales | No conformidades con el nuevo objetivo por fuente; requieren los cambios propuestos y evidencia. |
| Producción, flags, migraciones, cuentas | No aplica a la ejecución autorizada de esta entrega. No se realizaron. |
| Excepciones | Ninguna solicitada/aprobada. La restricción de runtime proviene del encargo, no de una regla nueva. |

Inventario técnico acotado por la skill revisar-datos-ve: `DocumentDraft.supplier` contiene
contacto/email/WeChat/teléfono/dirección; finalidad: proveedor y documento de la compra. `sources`
incluye nombre del archivo y evidencia; archivo original puede contener datos ajenos a esa finalidad.
Lectura de código: minimización del prompt y fuentes ocultas al proveedor son CORRECTO por fuente
en `anthropic.ts:26` y `service.ts:118`; no es auditoría legal ni prueba de eliminación real.

ENCONTRADO: aviso al tercero actual debe actualizarse; el DTO omite neto. NO VERIFICABLE: región,
retención/entrenamiento/subprocesadores del servicio GLM contratado, consentimiento y avisos
aplicables, derechos de contactos del proveedor y eliminación remota efectiva. Deben resolverse
antes de documentos reales; pruebas sólo ficticias. No prometer cumplimiento legal por política
de código, por prompt que excluye PII o por no guardar logs: el PDF completo transferido puede
contener datos. No leer negocio/PII para completar este inventario.

Las reglas locales IA/privacidad y el skill Supabase se consultaron. El changelog Supabase no fue
accesible por web; no se implementa ni cambia API/SQL en esta entrega. Refresh documental y
pruebas de persistencia quedan pendientes antes de autoría que dependa de API nueva.

## 9. Respaldo propuesto que conserva PR319

Estado actual: commits sólo locales de esta rama; **no existe respaldo remoto de esta etapa**.
No se ha cambiado PR319, su head, su base ni su descripción; tampoco se publica otra PR.

Mecanismo propuesto para decisión explícita del General:

1. Mantener autoría exclusivamente en esta rama propia descendiente de d42. Conservar el árbol
   y rama local del Worker anterior en d42 para su demo/historial, sin reset ni traslado.
2. Revisar un SHA candidato completo y la allowlist; verificar otra vez PR319 head/base y que d42
   sea ancestro. Fijar por escrito owner y SHA del único publicador de la actualización remota.
3. Si se autoriza conservar la misma PR, el General publica **por avance fast-forward** ese SHA
   descendiente a la rama remota ya usada por PR319, desde su contexto de integración autorizado.
   Es publicación del head de una PR existente, no merge a main. No force, no edición del árbol
   Packing anterior ni cambio de su rama local. Si el head remoto cambió, detener y reconciliar.
4. Verificar head resultante/PR y registrar respaldo. Esta tarea continúa editando sólo su rama;
   no publica cruzado por iniciativa propia ni crea una PR alternativa. El General debe asignar
   expresamente esa operación y comprobar sus efectos de CI/preview antes de ejecutarla.

Este mecanismo preserva la preferencia de Sam y el aislamiento local, pero **no está autorizado
ni ejecutado**. Si el General decide otro mecanismo, queda como decisión explícita con base y owner.

## 10. Pendientes concretos y estado de evidencia

| Comprobación | Estado de esta entrega |
|---|---|
| Mensaje humano, base/árbol y PR319 | PASÓ: lectura directa y Git/metadata actuales. |
| Aislamiento/guard/claim | PASÓ; propiedad exclusiva de este árbol. |
| Inventario focal SDD refs/worktrees/PRs | PASÓ, alcance/cifras arriba; sin reservar número. |
| Lectura de fuentes y documentación GLM | PASÓ con discrepancias/limitaciones declaradas. No prueba de cuenta. |
| Archivo ficticio tamaño/hash | PASÓ. Contenido visual se refiere al recibo d42, no se reejecutó. |
| Conector GitHub | NO DISPONIBLE; fallback gh PASÓ. |
| GLM real/modelo/credencial TEST | NO DISPONIBLE; cero llamadas de inferencia. |
| Autoría de producto, tests/discovery/tipos/lint/build/verify/SQL/DB | NO EJECUTADO por frontera de esta fase. |
| Servidores/UI/raster/descargas de artefactos | NO EJECUTADO. |
| Graphify estructural/semántico, Archify, preview/publicación Obsidian | NO EJECUTADO; consulta del grafo existente no actualiza esas capas. |
| pnpm knowledge:status, docs:index/check, sdd:check | NO EJECUTADO bajo la preparación ligera; se registra impacto, no vigencia global. |
| Push/PR nueva/merge/deploy/migración/flags | NO EJECUTADO; sin autorización para esta etapa. |

Siguiente paso del Director: resolver la allowlist completa (incluido neto/aviso/presupuesto),
activar autoría local sobre este aislamiento y fijar el mecanismo de respaldo. Preparación del
perfil TEST/credencial/costo y selección del parser preceden al primer GO real; no pedir clave
por chat. Ninguno de esos pendientes impide entregar y revisar ahora este paquete documental.

Impacto documental guardado en la spec, este paquete y el handoff propio. Integración, índice,
Graphify, Archify y Obsidian siguen separados y pendientes. La bóveda compartida sólo podrá
publicarse desde main integrado comprobado, nunca desde esta propuesta.
