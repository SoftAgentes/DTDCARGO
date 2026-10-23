# SDD-0473 · Encargo GLM para revisión del Director

Fecha: 2026-10-22, America/Caracas. Estado actual: **S1 PASÓ50/50; S2-P29 fuente para revisión, sin ejecución funcional ni conexión GLM**.
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

## 11. Coordinación posterior y carga TEST propuesta

Este anexo actualiza los pendientes de la primera entrega sin modificar su evidencia fechada.
Sam pidió directamente entregar el paquete al Director y coordinar el alcance para implementar
GLM, conservando **PR319, sin merge ni producción**. El General recibió y revisó el checkpoint
`4b45fca00e0b1b031636d4684b2f5227b7775c54`, árbol
`6cd0093fc76b8d4fa37af2416bb7913a3adfccee`, hijo directo de d42. La lista de 43 rutas sigue
siendo propuesta: no hay todavía autoría de producto, instalación, runtime o llamada real habilitada.

### Aclaración del objetivo y ownership de configuración

El General informó haber leído en Packing los mensajes humanos
`01a163a9-53c3-7ad2-b544-c96fb30223a0` y `01a163aa-3ca2-7871-8ccf-ff16b86c7ca6`.
El primero precisa **ERP y portal de DTD Cargo**; la referencia previa a «Contífico» queda resuelta
sin integración externa. El segundo pide una ubicación segura para configurar GLM y recorrer
PDF/Excel → revisión → aplicación → proveedor → confirmación → PDF/etiquetas, sin merge ni
producción. Esta precisión procede de evidencia humana verificada por el General; este Worker
no volvió a leer esos dos mensajes. No se solicita otra aprobación genérica para implementar.

El General asignó primero una plantilla local sin secretos y luego corrigió la coordinación:
**Packing ya creó el archivo y es su único owner operativo**. La instrucción posterior sustituye
la creación/inspección previstas; este Worker no toca el archivo ni la carpeta. Destino único:

`C:/Users/AKX generator/.config/dtdcargo/document-import-glm.test.env`

Según el recibo del General, se creó con dos nombres, inicialmente sin valores:

- `DOCUMENT_IMPORT_GLM_API_KEY`
- `DOCUMENT_IMPORT_GLM_MODEL`

También reportó ACL restringida. Son datos de coordinación, no una inspección propia del archivo
ni de sus permisos. No se conoce, valida o publica aquí ningún valor actual. No copiar el archivo
al repositorio/worktree, abrir otros `.env`, imprimirlo, versionarlo ni modificar su ACL. El
usuario introduce el secreto localmente; Packing centraliza la confirmación de configuración y
clase de plataforma. Este Worker no duplica la pregunta ni pide claves por chat.

Los demás nombres de §5 conservan su carácter propuesto para un futuro runner. La clase de
cuenta no se deduce de una suscripción: `zai-standard` sigue siendo una propuesta de perfil,
no una elección confirmada. Modelo habilitado, endpoint admitido, límites y costo no se infieren
del archivo. No se amplía ahora la plantilla, no se activa `QA_PDF_EXTRACTION_ENABLED` y no se
introduce un fallback a Anthropic.

### Carga explícita propuesta para el banco futuro — no implementada

1. El General asigna primero rutas, parser/dependencias, perfil de cuenta, modelos y límites.
   Antes de ejecutar fija SHA/árbol, receta, entorno aislado, muestra ficticia, presupuesto y GO
   nuevo. La carga no forma parte del arranque normal del portal ni de las demos 4320/4321.
2. Un runner TEST del servidor acepta ese destino explícito; no descubre archivos por directorios,
   no autoimporta `.env` de ROOT/Packing/worktrees y no usa un endpoint aportado por el documento.
   Su implementación deberá mantener `envFile: false` y separar la configuración del navegador.
3. Antes de importar el extractor, el runner construye la configuración del proceso aislado con
   sólo los dos nombres permitidos del archivo y los parámetros no secretos del perfil revisado.
   No carga ni mezcla credenciales heredadas, no añade propiedades `NEXT_PUBLIC_*` y no serializa
   el entorno a capabilities, respuestas, bundler, mensajes de error, logs o artefactos.
4. Perfil y modelo sin confirmar, archivo/campo ausente, parser no preparado o presupuesto sin
   adoptar producen indisponibilidad clara antes de cualquier petición. Los nombres completos
   `DOCUMENT_IMPORT_GLM_TIMEOUT_MS`, `DOCUMENT_IMPORT_GLM_MAX_INPUT_TOKENS`,
   `DOCUMENT_IMPORT_GLM_MAX_OUTPUT_TOKENS` y `DOCUMENT_IMPORT_GLM_MAX_OCR_PAGES_PER_DAY`
   siguen pendientes; no asumir los límites históricos de Anthropic ni valores monetarios.
5. Configurar o cargar el archivo no ejecuta OCR, inferencia, tokenización ni otra prueba de red.
   El caso real requiere opt-in separado, GO vigente y acción explícita sobre la muestra acordada.
   El runner usa un puerto libre independiente >=4322, sin proxy, reinicio o tráfico a 4320/4321.
6. La evidencia pública del runner se limita a estado sanitizado, perfil efectivo y límites
   aprobados; los recibos de prueba distinguen dobles, GLM real, revisión humana y confirmación.
   Nunca acreditan extracción por valores rellenados manualmente o por la mera presencia de una key.

Esta receta es una propuesta documental, no un script, cargador o permiso de ejecución. No se
añadieron dependencias, comandos de inicio, endpoints ni configuración al producto. El General
mantiene pendientes la allowlist de producto y el parser, presupuestos y privacidad del proveedor.
UI/B1 conserva la prioridad de pesada comunicada en esta coordinación; no hay reserva GLM abierta.

### Estado de esta continuación

| Comprobación | Evidencia y límite |
|---|---|
| Entrega al General | PASÓ: mensaje autorizado por Sam, checkpoint fijo y respuesta recibida. |
| Aclaración ERP/portal | RESUELTA por el mensaje humano verificado y comunicado por el General. |
| Archivo TEST y ACL | REPORTADOS por Packing/General; inspección propia NO EJECUTADA por coordinación. |
| Clave, clase de cuenta y modelos habilitados | NO VERIFICADOS por este Worker; no se leyeron valores. |
| Cargador/autoría de producto | NO EJECUTADO; sólo propuesta y actualización de tres documentos. |
| API, pruebas, instalaciones, servidores y aceptación visible | NO EJECUTADO; sin consumo de inferencia de esta sesión. |
| PR319 | Única PR indicada por Sam; publicación de SHA/owner aún pendiente, sin push ni PR nueva. |

El siguiente checkpoint es documental y descendiente de 4b45, sin amend. Guard/claim y revisión
del diff se registran en su entrega; el SHA resultante se comunica fuera del propio commit. Se
preservan la base d42, las demos previas, ramas/worktrees ajenos, flags, datos y producción.

## 12. S1 asignado y escrito · Contrato y transporte desconectados

Asignación del General recibida después de su lectura fija de 4b45 y verificación del mensaje
humano `01a163ac-4321-7d30-aeb4-66f3ef203c50`. Se adopta sobre el hijo documental preservado
`86461c79ec37828e3cea301403a170339207be0d` (parent 4b45, árbol
`ecb1b89ccb48527032d1c1c1be623c734b0c640b`). Antes del código se leyeron enteras las tres
preimágenes desde Git, se comprobaron las seis ausencias Git/disco, identidad/HEAD/estado/claim
y se registró la adopción en spec/handoff. La allowlist activa exacta está en la spec: seis
rutas de contrato/proveedor/GLM y sus tests, más estas tres docs. Las otras rutas de §6 siguen
sin habilitar; S1 no modifica ningún archivo de producto preexistente.

### Contrato efectivamente escrito

- `extraction-contract.ts`: códigos seguros compatibles con los existentes, JSON acotado en
  bytes/profundidad, metadatos de origen y celdas validados, referencias locales y evidencia.
  Su salida es `IntermediateExtraction`: observaciones por proveedor/documento/producto/grupo/
  asignación/total, con `netWeightKg` independiente, incidencias y revisión obligatoria. **No es
  DocumentDraft**: el validador de negocio y su conversión siguen pendientes. Conserva contenido
  OCR/celdas sólo en memoria privada del servidor; no se escribe en Git, logs ni UI.
- `provider.ts`: entradas explícitas sin leer process.env o archivos; sólo perfil `zai-standard`,
  OCR y modo explícitos, modelo estructurador sin default, límites enteros y credencial privada
  en closure. Serializar configuración no incluye el secreto. El resumen declara expresamente
  `accountVerified:false` y `readyForPortal:false`. No reconoce clase de clave por prefijo.
- `glm.ts`: HTTP nativo a dos destinos constantes, sin SDK, tools, redirects, cookies ni retries.
  PDF requiere inspector con cancelación real declarada y mapeo revisado de páginas antes de
  red. Toda entrada requiere reserva confirmada de OCR/texto y contador local específico del
  modelo. Snapshot/digest enlazan bytes, inspección y reserva. Se limita el body efectivamente
  leído, UTF-8/JSON, cobertura, coordenadas, tokens, finish reason y referencias. Descartar el
  cuerpo de error evita propagar secretos o documentos; un resultado incierto nunca es retryable.

Los recibos de inspector/reserva/contador son contratos inyectados, **no implementaciones de
autoridad**. No hay dependencias de producción que los satisfagan todavía. `abortStopsWork:true`
en un doble no demuestra terminación del parser; la carrera con AbortSignal evita continuar el
pipeline después del timeout, pero no convierte un callback arbitrario en proceso interrumpible.
El mapeo OCR tampoco deduce página de `block.index` ni de posición del array: exige función
revisada y cobertura completa 1..N; esa función real permanece pendiente. Base64 sin prefijo es
la codificación escrita para el contrato documentado, aún sin aceptación de cuenta real. Una
página vacía o sólo imagen se rechaza conservadoramente, sin fingir cobertura de su contenido.

Se reutilizan los nombres duraderos `configuration_missing`, `configuration_invalid`,
`file_size`, `invalid_metadata`, `invalid_pdf`, `token_limits`, `extraction_invalid`,
`extraction_incomplete` y `extraction_unavailable`; no se crea otra taxonomía persistida.
`outcome:not_sent|received|uncertain` es metadata transitoria separada. En el siguiente tramo,
con allowlist para Anthropic/extract/tests, se extraerá/reexportará la clase canónica preservando
su identidad `instanceof` y contratos previos. S1 no importa ni altera Anthropic ni duplica su
schema DocumentDraft; su schema intermedio tiene otra finalidad y nunca se guarda como draft.

La respuesta del modelo no certifica el dato sólo por citar una evidencia existente. S1 valida
forma y referencias; exactitud OCR, interpretación de unidades, sumas, fusión, correcciones
manuales y autorizaciones de negocio necesitan sus etapas y revisión humana. Los identificadores
locales de sujetos no se adoptan como IDs de negocio. HTML/URLs son datos inertes: no se ejecutan,
descargan o renderizan. El contenido intermedio no constituye una respuesta pública del portal.

### Acceso TEST: actualizaciones humanas, sin tocar la cuenta

El General verificó dos instrucciones posteriores en Packing:

1. `01a163b4-35dd-79f0-b4b4-31f1757e4d4b`: Sam identificó **GLM Coding Plan**. La pregunta quedó
   respondida, sin habilitar uso de Coding para el portal ni afirmar que esa clave sea Standard.
2. `01a163b7-f3f9-7260-95ed-b06318f25e1d`: Sam pidió preparar **Standard API** y guardar la clave
   de forma segura para el recorrido PDF/Excel hasta confirmar/etiquetas, sin merge/producción.
   Reemplaza la elección operativa anterior por preparación Standard; no acredita creación,
   guardado, modelo habilitado, saldo o GO. Packing conserva la gestión de cuenta/archivo.

Consulta oficial renovada el 2026-10-22: [autenticación Standard](https://docs.z.ai/api-reference/introduction)
y [claves separadas de Coding Plan](https://docs.z.ai/devpack/quick-start). Es documentación,
no evidencia de capacidad de la cuenta. Se mantiene el destino externo de §11 sin abrirlo,
copiarlo, inspeccionar ACL o leer/hash de contenido. No se repite la pregunta ni se solicita
secreto por chat. La falta de acceso no impide autoría S1, pero bloquea una prueba real.

### Próximos tramos propuestos para asignación — no activos

**S2, inspección PDF y cuotas antes de conexión:** candidato `pdf-lib` **1.17.1**, versión exacta
del [manifest oficial](https://raw.githubusercontent.com/Hopding/pdf-lib/v1.17.1/package.json),
[licencia MIT](https://raw.githubusercontent.com/Hopding/pdf-lib/v1.17.1/LICENSE.md), consultados
2026-10-22. Es candidato revisable, no afirmación de versión más nueva o libre de vulnerabilidades.
Declarar sin caret; regeneración controlada de pnpm-lock fijaría integridades y transitivas
(`@pdf-lib/standard-fonts`, `@pdf-lib/upng`, `pako`, `tslib`), sin resolverlas a mano ni instalar ahora.
Aceptar la dependencia exige revisión de transitivas y runtime real de Node (package exige >=24;
no se ejecutó Node de producto ni se verificó su versión efectiva en esta fase).

Propuesta de rutas: `pdf-inspection.ts`/su test y **nueva ruta no autorizada todavía**
`lib/studio/document-import/pdf-inspection-worker.cjs`, más package/lock. El worker tendría sólo
bytes acotados, cero red/credenciales/env heredado, validación de cifrado/páginas/digest y salida
estrecha. El coordinador terminaría el worker ante deadline/cancelación y esperaría su salida
real con [worker.terminate](https://nodejs.org/api/worker_threads.html#workerterminate), sin dejar
un parser corriendo por resolver sólo una Promise.race. `resourceLimits` limita heap JS, **no
todos los buffers externos**: memoria total y descompresión requieren aislamiento/límite efectivo
o un parser alternativo antes de declarar el inspector acotado. Validación de empaquetado Next/QA,
terminación, PDFs malformados/cifrados/bombas y ausencia de red queda pendiente de GO. No se crea
ese worker ni se acepta un contrato de inspector real por la mera selección de la librería.

Lectura fija: `access.ts:reserveLimit` llama a `reserve_document_import_limit`; SQL0457:125–134
reserva atómicamente por scope/ventana mediante INSERT/ON CONFLICT condicionado. Sólo service_role
puede ejecutar (235–240). Propuesta: scopes OCR-páginas y texto-tokens diarios, ambos confirmados
antes del primer fetch. Si falla la segunda reserva, la primera puede quedar consumida de forma
conservadora, sin afirmar atomicidad conjunta o liberar gasto no comprobado. No exige inferir
una migración para admitir esos scopes. Una cuota monetaria requiere tarifas/modelo y tope
aprobados; páginas/tokens por sí solos no son dólares ni prueba de saldo.

**Riesgo durable a resolver antes de conectar jobs:** SQL0457:137–148 reclama jobs processing con
lease vencido y attempts<3. `retryable:false` evita reintento de un error retornado, pero no el
reenvío tras muerte del proceso después de una petición facturable. El siguiente encargo debe
fijar la marca durable previa al envío y cómo la autoridad de claim/manual retry conserva el
estado incierto. No se presume que error_code en memoria, request_id o CAS final lo solucionen.
Si la solución requiere SQL nuevo, volver al Director para allowlist/SDD/ID; no modificar 0457.

**S3, datos y revisión:** productor y validador deben avanzar juntos: neto nullable compatible en
DTO/parseo/exportadores, referencias campo por campo, conservación manual ante fusión, conflictos
de identidad y aviso del proveedor efectivo antes de transferir. El documento del proveedor
sigue sin fuentes privadas; etiquetas conservan códigos autoritativos. No conectar salida
intermedia de S1 directamente al DTO actual ni descartar neto para forzar compatibilidad.

**S4, banco conectado y aceptación:** cargador de servidor explícito del destino de §11, perfil
Standard verificado por su responsable, modelos/costo/límites, puerto nuevo aislado y sin secretos
de cliente. Sólo después de revisión de S2/S3 y GO se usaría la muestra ficticia acordada; PDF,
Excel y escaneado tienen resultados separados, con revisión/aplicación/confirmación humana y
PDF/etiquetas propios. El presupuesto/GO de UI/B1 tiene prioridad y no se hereda una ventana libre.

### Validación escrita y cierre S1

Conteo por lectura de declaraciones de tests, **no discovery/ejecución**:

| Archivo | Casos escritos | Cobertura pretendida |
|---|---:|---|
| `extraction-contract.test.ts` | 14 | Neto/bruto, evidencia, desconocidos, referencias, moneda, límites, fórmulas y JSON. |
| `provider.test.ts` | 11 | Configuración explícita, Coding rechazado, ausencia de defaults, secretos y límites. |
| `glm.test.ts` | 25 | HTTP doblado OCR/chat, orden y reservas, snapshot, cobertura, inyección, cuerpos, timeout y errores. |
| Total | 50 | Todos NO EJECUTADOS; no prueba funcional, OCR real o cuenta habilitada. |

Receta focal futura propuesta, sujeta a revisión del checkpoint, dependencias disponibles y GO:
`pnpm exec vitest run lib/studio/document-import/extraction-contract.test.ts lib/studio/document-import/provider.test.ts lib/studio/document-import/glm.test.ts --maxWorkers=1 --no-file-parallelism --retry=0`.
No se ejecutó, ni su discovery, tipos, lint, build/verify, DB/SQL, instalación, API o servidor.
Los 50 casos no heredan ningún PASÓ previo. El tiempo propuesto para admisión es 180 s más 60 s
de cierre, una corrida sin retry; no hay reserva abierta ni autorización de consumo real.

Revisión por lectura y Git comprueba alcance nuevo/aditivo, preservación de fuentes anteriores y
ausencia de conexión al portal. No reemplaza typecheck, ejecución o revisión independiente. El
handoff entrega parent/árbol/blobs y estado limpio después del commit selectivo de nueve rutas.
PR319 conserva destino y head previo: su publicación futura requiere único publicador nominal,
SHA/base/ref comprobados y avance normal fast-forward. Sin PR alternativa, push, merge o producción.

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

### Encargo nominal y precisiones completas

# Encargo adoptado S2-P29 — 2026-10-22

Asignación nominal del Director Orquestador, thread01a160e3-92b0-76f0-bc3c-20000e81ff16, posterior a la instrucción humana01a163f0-fc99 y01a163f6-3456. No es una ampliación autónoma de alcance.

Owner worker-packing-glm-01a1639b-cd99-7921-ac27-5d218d0a1516; WT C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/packing-glm-encargo-20261022; rama codex/packing-glm-encargo-20261022; misma PR319. Hija directa9e49b3c13995e3dd50b60ce79a42f846b37b34fb; cualquier base diferente debe declararse antes. Una sesión escritora.

Condición previa satisfecha: GLM50 terminó una vez, native0/global0,3FULL50PASÓ0omitidos; FIN/retornoformal/exteriorWorker079b48 yGeneralb902a7 dentrodeadlineORIGINAL14:35:39.9575375Z; custodia fría524bdb después,19copias22artefactos/manifiestob6a7ebf17a9ab5d18257addb2fb03c0ae67181fd9012faec31975bcfd8978660. La custodia no renueva reloj. Source9e49 limpio/claim propio preservados. Guard administrativo77f398 exit0 a14:36:38.1128241Z.

Entregable: una revisión autoritativa de compra produce Excel y estimado mediante calcularEnvioLCL actual, con neto/bruto/CBM separados, desconocidos explícitos y precio invalidado al cambiar datos. Puente IntermediateExtraction→DocumentDraft disponible, desconectado de GLM/API/jobs. No declarar objetivo integral terminado por este slice.

## Contrato A–H adoptado

A. SchemaVersion1 con aditivos opcionales y ausencia legacy preservada. Neto number|null independiente; no hacerlo requisito universal de confirmar. A:N XLSX sin cambios/O neto/relectura14/15. Totales una vez por grupo mixto y workspace único. Nunca copiar PDFexpected a Excel.

B. locations.evidenceId máximo128 y gramática identifier existente; observedValue sólo string|number|null compatible con campo real (texto acotado por límite del campo, número finito/rango existente). No objetos/arrays. fieldDecisions máximo10000; path máximo300 y gramática CERRADA de campos existentes/referenciasIDs estables; nunca ordinal/arbitrario/proto. origin manual|source; references {sourceId,evidenceId}, máximo20 distintas/existentes/coherentes con sujeto/campo. Source exige evidencia; legacy sin ella no inventa origin. Mantener50sources/20000locationsporfuente y límitesHTTP. Rechazar límite excedido, sin truncar silenciosamente. No OCR entero, credenciales, rawpayloads ni blobs.

C. Sólo servidor crea/conserva/quita autoridad comparando prior AUTORITATIVO y delta de negocio. Ignorar o rechazar metadataforjada del navegador, incluido proveedor sin metadata. applyImport no pasa mergedWorkspace como prior ni body.mode público para simular manual; contexto interno no falsificable. Conservar null/vacío/false manuales. Eliminaciones manuales de producto/grupo/asignación no resucitan: tombstone en fieldDecisions mediante deleted?:true, sólo servidor/IDs previamente existentes/path de entidad permitido, sin valores privados duplicados. Correlación incierta produce conflicto explícito antesapply; no adivinar identidad ni resucitar. CAS/commandId intactos.

D. transportDeclarations battery/specialCargo boolean|null, humanos/servidor; ausencia pending. Importación/cambio mercancía o embalaje invalida afectadas en servidor. Nunca false por omisión. True de un documento no se oculta por pending de otro ni pending se conviertefalse para cotizar; resolver estado seguro explícito antesprecio. Sin regla nueva de regulación/tarifa; IA propone, no autoriza transporte.

E. Guardado devuelve draft/revision PROYECTADOS del servidor; portal/proveedor los adoptan, no reconstruyen éxito con draft viejo. Conservar dirty/conflict/cancel/unmount/409, datos propios en error y mensajes seguros. Estimate exige expectedRevision por workspace; revalida autorización/revisión antes/despuésawaittarifas/antespersistir-retornar. No afirmar snapshotDB/RLSglobal. UI liga IDs+revision/selección+inputs+requestgeneration; descarta tardías y reinicia al editar/aplicar/cambiarproveedor/destino/embalaje/compra.

F. Proyección por allowlist común para workspace/history/save-confirm/PDF-XLSX: sin sources/decisions/evidence/filenames/OCR/identidadcomprador. Issues.message no interpola alternativas privadas para proveedor. Mantener mercancía/contacto PROPIO de proveedor legítimos, no borrar todo. Tests con canariosficticios en todas las respuestas y navegador proveedor que omite metadata. Sin PII/secrets reales en Git.

G. Misma instantánea inputs/config → motor vigente con mismos resultados: mínimo/batería/densidad/combinaciones/destino/embalaje/derivación. /tarifas y estimate difieren en disponibilidad: no afirmar paridad desplegada ni cambiar fallbacktarifas. Transporte separado de mercancía. Estimado no confirma despacho ni adquiere gatesPDF/QR.

H. Governance/AGENTBRIEF y revisar-datos-ve: inventario técnico acotado supplier.contact/email/wechat/phone/address vs comprador/fuentesprivadas. Sin auditoría legal general/producción/excepciónnueva. Preservar primitivas/copy/teclado/foco/accesibilidad; no editar sharedcomponents fuera29.

## Límites

Allowlist29 exacta en allowlist.json; incluye SharedSupplierDocument y test únicamente para recibo autoritativo/proyección/invalidez, no rediseño. Preservar matemática, tarifas, SQL, acceso, dependencias, CSS, demos, S1/transporte y50. Guard/claim y27preimágenes físicas+rawGit/2ausencias antes de adopción S/H/encargo y producto.

Autorizada AUTORÍA LIGERA29 y checkpoints coherentes. No Nodeproducto/parser/discovery/tests/typecheck/lint/build/verify/SQL/servicios/API/install/push de S2 hasta checkpointfijo/revisión/GO nuevo. Excepción limitada: comandos administrativos guard/claim/release según ownership. Conteos futuros sólo por lectura de fuente, sin cuota de éxito inventada. Nuevas rutas indispensables requieren evidencia/alternativa anteseditar, sin ampliación automática.

S2-P no activaGLM. API/demo/E2E son fase posterior con contrato/GO TEST concreto; clave guardada no se pide/abre/copia/hash. Merge y producción siguen excluidos. Sin escrituras en main ni publicación de bóveda/Graphify/Archify en esta fase; validaciones pendientes se documentan.

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
