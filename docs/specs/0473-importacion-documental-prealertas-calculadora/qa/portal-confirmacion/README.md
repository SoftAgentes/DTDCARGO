# Recorrido local de cliente a proveedor · SDD-0473

Demo con identidades y documentos exclusivamente ficticios. El modo predeterminado no lee `.env`, no usa Supabase remoto
ni credenciales, no llama a Anthropic. Solo escucha en `127.0.0.1`.

## S3 GLM TEST — código candidato, ejecución pendiente

S1/50 y S2/13 FULL 350 PASS están cerrados. Esta ampliación es fuente para revisión del Director, aún sin ejecutar tests, DB, servidores, API o lectura/metadatos de credencial. Los comandos históricos siguientes no habilitan S3. Se conserva PR319 sin merge ni producción.

Un GO posterior debe fijar SHA, dependencias, ejecución y tiempos; candidato backend 4323/frontend 4324 con strictPort. `QA_GLM_TEST_ENABLED=true` sólo admite backend 4323, sin proxy ni proveedor legacy. Frontend separado requiere `QA_GLM_TEST_FRONTEND=true`, puerto 4324 y origen exacto 127.0.0.1:4323. Ninguno de estos procesos se inició durante autoría.

Root durable candidato único que debe admitir/provisionar ese GO: `C:/Users/AKX generator/.config/dtdcargo/document-import-glm.test-ledger`. No fue creado ni inspeccionado aquí. No se permite sustituirlo por el output del lote, otro perfil o una carpeta nueva. `global-pipeline.guard`, guardia SHA(bytes) y `global-dispatches.jsonl` sobreviven éxito/error/crash. Nunca borrar, truncar, reclamar por lease ni abrir otro root para reintentar. El código bloquea una nueva reserva global aun después de un resultado recibido; recuperación requiere revisión expresa del General y no está automatizada.

El loader futuro lee sólo el destino privado explícito en memoria del backend, clave/modelo; modelo vacío adopta glm-4.6 y cualquier otro modelo falla. Ninguna llave va a process.env, frontend, logs, Git o UI. Los tests usan lectores sintéticos inyectados. No hay probes de modelos, salud, saldo ni recargas.

Se admiten exclusivamente PDF002 (4855 bytes/SHA256 7fada57b5d00093c5f3950e36de7812226b675a2fc1547d234ca3c790b170b2e, metadata conocida de dos páginas) y XLSXv2 (8178 bytes/SHA256 f1867b0f4b2bdc7024700e502436a55e672e0276360a630e0b1e0db85e42c825). No se parsearon estos inputs durante autoría. Casos PDF/Excel tienen Compra/workspace/token de proveedor distintos; fixture `?case=pdf` / `?case=xlsx`, sin reiniciar el banco S3. El inspector de PDF es específico de esos bytes; no demuestra compatibilidad PDF genérica.

PDF: OCR glm-ocr → tokenizer HTTP remoto explícito → chat glm-4.6 con mensajes idénticos inmutables, thinking deshabilitado y JSON object. Máximo global tres HTTP, sin retry/fallback, 90 s, 16384 entrada/8192 salida. Se registra possibly_sent/fsync antes de fetch y diferencia tokenizer/chat. Excel: nativo, cero IA; múltiples hojas ambiguas fallan para revisión, nunca escalan silenciosamente a IA. Se prepara el tipo antes de transferir y se requiere clic explícito con aviso del proveedor efectivo.

El banco utiliza applyImport/save/confirm reales, SQL ficticio PGlite y motor calcularEnvioLCL real. Snapshot **ficticio** `sdd0473-s3-fictional-20261022-v1` con digest calculado de su JSON y guardado en el estimado; no certifica tarifa online ni precio firme. Declaraciones desconocidas siguen pendientes; cambio de revisión invalida resultado previo.

PDF y etiquetas se generan desde revisión confirmada. El banco S3 obtiene grupo/código físico del mapping SQL real; no asigna grupos por ordinal ni inventa códigos. Etiquetas usan bruto/neto/CBM de su grupo dividido por cajas del grupo; no promedio global. Neto es opcional, independiente del bruto. El renderer conserva el flujo anterior cuando no recibe mapping. Exportación existente mantiene A:N/O neto y privacidad. Después de renderizar se vuelve a comprobar revisión, confirmación, etiquetas y mapping.

Corrección humana opcional adoptada: A4 cajas/60 bruto/48 neto/.36 CBM; B6/96/72/.60; cada A15/12/.09, cada B16/12/.10. No son respuestas para GLM: sólo ediciones humanas posteriores, mapeadas a IDs reales. El precio puede conservarse por mínimos; no se cambian tarifas para forzar diferencias.

Próxima evidencia requerida: suites completas nuevas y heredadas sin red, pnpm verify y sus SKIPs, dos extracciones reales independientes (Excel sin IA), revisión cliente/proveedor, Excel final, PDF/etiquetas nuevos, rasterización completa y decodificación de todos los QR; 375/390/escritorio, claro/oscuro/teclado/foco. Chino operativo/WeChat/impresora física siguen NO EJECUTADO. La fuente no equivale a aceptación funcional.

Desde este worktree:

```powershell
pnpm install --frozen-lockfile
pnpm exec tsx docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts
```

Abre `http://127.0.0.1:4320/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/index.html`.

1. Descarga el ejemplo sin peso; impórtalo en el portal del cliente.
2. Revisa la propuesta: 100 pcs, 10 cajas, USD 350, CBM 0.6 y peso pendiente. Aplícala.
3. Abre el enlace del proveedor desde la barra de demo; cambia idioma si lo necesitas.
4. En Productos y cajas completa el peso bruto TOTAL de 120 kg. Guarda o revisa directamente.
5. Confirma el despacho desde Revisar y confirmar. Imprime las diez etiquetas y el documento.
6. Vuelve al cliente: consulta la misma revisión. Abre dos pestañas para probar conflicto CAS.

El lector de XLSX/CSV, el editor, el servicio `saveWorkspace`, el exportador y `getDocumentLabels`
son los módulos reales. PostgreSQL embebido PGlite ejecuta las funciones originales 0147/0148,
0244/0449 y la migración 0457: persistencia entre pestañas, CAS, comandos idempotentes, historial,
submission y códigos físicos se ejecutan en SQL real. Las tablas previas al dominio son DDL
mínimas sintéticas. Los códigos son emitidos por esas funciones SQL sobre la base efímera.

La adaptación HTTP y las identidades están simuladas de forma explícita. Los archivos se guardan
en memoria local; no hay Storage firmado, auth remota, cron, cuota de producción ni precisión PDF
real acreditados. Los PDF que requieren IA fallan de forma visible; no producen datos inventados.
La base vive durante el proceso; reiniciar demo o detenerlo borra únicamente ese estado sintético.

## Actualizar la interfaz sin reiniciar PostgreSQL

Si se está revisando un despacho ya confirmado, conserva el proceso 4320. En otra terminal:

```powershell
$env:QA_PORT = '4321'
$env:QA_BACKEND_ORIGIN = 'http://127.0.0.1:4320'
pnpm exec tsx docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/vite.config.ts
```

Abre `http://127.0.0.1:4321/docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/index.html`.
4321 sirve la interfaz actual y envía `/api` y `/qa` al mismo PostgreSQL que sigue vivo en 4320.
El proxy solo admite un origen HTTP loopback. Los enlaces `/p/{token}` y las rutas de compra,
documento y etiquetas abren los componentes reales de esta fixture; no simulan una sesión autenticada.
«Ver etiquetas» consulta los códigos sin abrir impresión; «Imprimir etiquetas» revalida la revisión.

Esta evidencia no autoriza activar producción. Chino operativo y WeChat real siguen pendientes.

## Etapa B: descargar archivos PDF reales del confirmado

El código añade «Descargar documento PDF» y «Descargar etiquetas PDF» a las acciones del
confirmado. Las acciones de impresión y la descarga XLSX siguen disponibles. Cada PDF exige
la misma revisión confirmada y los códigos físicos vigentes antes y después del render;409
retira la propuesta obsoleta,503 conserva los datos y permite utilizar la impresión existente.
El interceptor PDF de4321 consulta la autoridad HTTP que continúa en4320: no crea otra base,
no emite códigos y no requiere4322. Auth/almacenamiento siguen adaptados como en el recorrido
anterior; esta fixture no demuestra acceso real al portal de clientes.

El servidor necesita `DOCUMENT_IMPORT_PDF_CJK_FONT_PATH`: ruta absoluta y explícita a una fuente
CJK provisionada por el operador. No hay ruta Windows implícita, descarga o copia de fuente.
Se leen sus flags de embedding y se rechaza una fuente que prohíba embedding, subsetting o
exija bitmaps; también se rechaza cualquier carácter sin glyph. Esos controles no certifican
licencia, redistribución ni portabilidad del entorno de producción. Las fuentes latinas/wordmark
son los assets locales existentes Nunito Sans/Sora/JetBrains Mono/ArchivoBlack y la paleta oficial.
El valor de la variable no se publica al cliente. Sin fuente válida se recibe503 recuperable.

Para una futura aceptación local autorizada: conservar4320; reiniciar **sólo4321** con el
entorno explícito `QA_PORT=4321`, `QA_BACKEND_ORIGIN=http://127.0.0.1:4320` y la ruta CJK elegida.
El proceso lee ese entorno al iniciar; cambiar variables en otra terminal no actualiza un
proceso ya existente. `watch:null` también requiere ese reinicio para cargar el código nuevo.
**En la etapa de autoría B no se reinició ningún proceso, se renderizó un PDF ni se ejecutaron
las pruebas.** El arranque anterior no acredita estas nuevas acciones.

Selección preparada por fuente:49 instancias nuevas en seis archivos, bajo el filtro
`SDD-0473 B`. Distribución: modelo/renderer12; HTTP9; transporte5; proveedor10; portal5;
proxy8. Tres instancias del renderer requieren la fuente explícita: documento corto, etiquetas
y documento largo de60 productos. Sin variable esas tres se omiten explícitamente; no se
presenta46 aprobadas como validación completa de49. No se hizo discovery ni ejecución.

Comando **propuesto, no ejecutado**, sólo después de asignación de ventana y rutas externas:

```powershell
& '.\node_modules\.bin\vitest.CMD' run `
  'lib/studio/document-import/pdf.test.tsx' `
  'lib/studio/document-import/http.test.ts' `
  'components/document-import/document-client.test.ts' `
  'app/p/[token]/SharedSupplierDocument.test.tsx' `
  'app/portal/(app)/compras/[code]/etiquetas/LabelsClient.test.tsx' `
  'docs/specs/0473-importacion-documental-prealertas-calculadora/qa/portal-confirmacion/pdf-proxy.test.ts' `
  -t 'SDD-0473 B' --maxWorkers=1 --no-file-parallelism `
  --reporter=verbose --reporter=json --outputFile.json='<JSON externo asignado>'
```

Presupuesto propuesto: una sola corrida,480s de ejecución y60s de cierre, sin instalaciones,
retry, suite completa ni reutilizar la ventana PACKING9 cerrada. stdout/stderr, exit nativo,
JSON y recibo deben guardarse fueraGit antes de cualquier conclusión. Tipos/lint/verify/UI
requieren su asignación; este filtro no los sustituye.

`DOCUMENT_IMPORT_PDF_TEST_OUTPUT_DIR`, sólo para pruebas, permite escribir los PDF sintéticos
y auditorías de fuente fueraGit. El caso largo escribe `packing-list-largo-60.pdf` y un manifest
con60 códigos esperados, checkpoints LONG-001/LONG-030/LONG-060 y totales para comprobar después
con un lector PDF y renders que no falte ninguna página/línea. Generarlo no acredita por sí solo
esa inspección. Los PDF de test (precios2/.75/2) tienen procedencia diferente de los descargados
del portal durante aceptación (muestra real de prueba con precios1.5/.5/3); no intercambiar evidencia.

La aceptación prevista con Excel/PDF de muestra sigue pendiente de runtime: grupos mixtos
10cajas/220pcs/USD340, corregir A a52kg/.28 y declarado CBM.66→.70 para confirmar130kg/.70.
El PDF de entrada sin Anthropic sigue fallando con error recuperable real: no se simula extracción.
El helper QR conserva `/verificar?c=...&n=...&b=...`, códigos físicos y numeración. La prueba de
payload no acredita decodificación de píxeles, escaneo físico, papel o compatibilidad WeChat.
Contrato de esta demo: Vite define `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:<QA_PORT>` tanto para
la UI como para SSR; el helper GUI/PDF usa esa misma autoridad. En4321 el origen esperado de los
QR es `http://127.0.0.1:4321`, con los únicos parámetros `c`, `n` y `b`. No es una prueba de
trazabilidad web de producción ni debe abrirse producción para validarlo.

## Corrección después de B1: fuentes estáticas exclusivas para PDF

B1sobre93e738ec4 ejecutó49:46aprobadas/3rendersfallidos/0SKIPseleccionado/38fuera del filtro.
El diagnóstico offlinePROBE5 completó cinco reportes: las tres WOFF2variables Nunito/Sora/Mono
reprodujeron DataView RangeError al codificar el subset; DengTTF y ArchivoBlackWOFF2estática
codificaron sus cadenas acotadas, sin glifos faltantes. Eso no acredita PDF completo ni
compatibilidad general de WOFF2. Las evidencias originalesB1/PROBE5 se preservan fueraGit.

La corrección usa las cuatroTTF primarias aprobadas en `lib/font-files/pdf/`: Nunito400,
Sora600, JetBrainsMono400 y ArchivoBlack400. El README de ese directorio contiene procedencia,
pins y cuatroOFLcompletas. No se convierten fuentes, no se alteran las web y no se incorpora
Deng al repositorio. CJK sigue exigiendo la ruta explícita actual y sus glyphs/flags de embedding.
El loader rechaza WOFF2/OTF/CFF/ejes variables con503seguro; la auditoría muestra formato,
ejes y peso de las cinco caras sin sus rutas.

Selección nueva preparada: **51instancias en los mismos seis archivos y filtro `SDD-0473 B`**:
modelo/renderer14, HTTP9, transporte5, proveedor10, portal5, proxy8. Conserva los49oráculos,
incluidos los3renders reales; añade dos negativas de formato/ejes. La negativa latina configurada
como CJK ahora usa la TTFestática para seguir probando glifos ausentes, sin quedar enmascarada
por el rechazo de WOFF2. Los3renders comprobarán las cinco caras TTFsin ejes y pesos400/600/400/400.
Esta selección es **NO EJECUTADA**; B1no se reintenta ni se transforma en verde por el cambio.

El comando futuro conserva los seis archivos del bloque anterior y añade `--retry=0` literal.
Se propone una sola corrida480s+60cierre, con Node24.20.0 y CJKDeng explícita como enB1, JSON,
stdout/stderr y PDFs de test en una carpeta externa nueva. Requiere nuevoGO/ventana; no reinstalar,
no reutilizar salidas deB1 ni compararlas como si fueran descargas de aceptación. No se inició
runtime, render, tests, UI o servidor durante esta autoría. La futura aceptación del portal,
QRde píxeles/papel y producción siguen con sus gates separados.

## Seguimiento P2: PDF de documento compacto y continuación

La aceptación anterior sobre4ee dejó documento2páginas con grupoB huérfano: FALLÓpresentación.
Etiquetas2páginas y QR10/10PASARON; largo7páginas/60códigos íntegro, sin cabeceras repetidas.
Las once PNG fueron revisadas porRoot. B2tiene bitácora recuperada tarde y B3Worker cierre tardío,
con exteriores Root/General oportunos. Se preservan originales, recibos y clasificaciones.

La autoría posterior se limita al layout del documento: proveedor compacto, contexto/columnas
por página, grupo+logística+primer ítem juntos; las filas restantes siguen paginables. Etiquetas,
QR, fuentes/CJK y modelo/cálculos no cambian. Conservar51casos y3renders; añadir dos casos que
observan el layout producido por el renderer real, caso3productos/2grupos y largo60sintruncar.
No usar las salidas nuevas como reemplazo de PDFreales ni cambiar oráculos anteriores para verde.
Todas las pruebas/renders de esta fuente requieren una nueva ventana GO. No reiniciar4320 ni
modificar el workspace rev3/V1/10códigos. La descarga real posterior sólo cambia presentación.
Fuente del fix terminada y todavía NO EJECUTADA: 53 casos en los mismos seis archivos, filtro
SDD-0473 B, reparto16/9/5/10/5/8; cinco renders reales. Los tres renders/archivos/manifiesto
anteriores se conservan. Se agregan packing-list-compact-layout.pdf y
packing-list-pagination-layout.pdf con manifiestos nuevos, sólo en TEST_OUTPUT_DIR externo.
El primero verifica una página para esta muestra compacta, sin imponer límite universal. El
segundo comprueba paginación real, sesenta códigos íntegros, contexto y comienzos de grupos
coherentes. Ninguna observación de layout reemplaza la revisión visual de todas las páginas.
El próximo GO deberá conservar rev3/V1 y sus diez códigos, sin guardar ni confirmar de nuevo.
## Aceptación local cerrada sobre cbe7636 · 2026-10-22

Fuente de producto ejecutada: `cbe76365407fa2ca9608a93d7dbe28f162089011`. El hijo de cierre
sólo toca spec, handoff y este README; no ejecuta ni cambia producto. Datos100%ficticios,
componentes reales y backend SQL de demo; sin producción ni sesión autenticada de cliente real.

- B1:61/61 PASÓ,0fallos,0SKIP seleccionado,38fuera del filtro,6archivos/5renders,una corrida,
  sin retry. Native0/wrapper0,incompleteFalse. Root/General exteriores y devolución oportunos;
  complemento extendido Worker NO EJECUTADO por cap, sin worker-return. Error de fechas del
  watcher Root corregido sólo en metadatos, no fue un reintento del producto.
- B2: recargar proveedor muestra folioDTD-PL-2026-0001,Rev3/V1 automáticamente ANTES de Ver
  etiquetas. Mismos10códigos y datos cliente/proveedor:10cajas/220pcs/USD340/130kg/.70. Una
  descarga real del documento,41579bytes,SHA256063def8bebe704a7920980c16fddb0294325850d3c0e03d826ece3cdffe3e33f.
  No guardar/reconfirmar/reimportar/resetear/backendrestart/print o nueva descarga de etiquetas.
  UIend y exteriores oportunos; extended receipt Root NO EJECUTADO por cap. El suplemento de
  custodia tardío está identificado como tal; no existe run.receipt de B2.
- B3: siete pasos nativos0/wrapper0,incompleteFalse; Root y General vieron TODAS14PNG:
  documento real1página,compacto1,LONG6,PAGE6. PASÓ sin P1/P2; grupoB ya no queda huérfano.
  Documento real220pcs/USD340/Rev3V1; fixtures largos60códigos/600pcs/USD600/Rev4V2. Compacto
  usa precios distintos del portal: no intercambiar sus PDFs como evidencia. P3 menor: acercar
  columnas a productos en primera página; no se modifica el candidato aprobado por ese pulido.
- Etiquetas y QR anteriores se conservan:2páginas,10códigos físicos,10/10 lecturas digitales
  únicas de píxeles, sin navegar destinos. No se realizó nueva decodificación/descarga/impresión.

Artefactos fuera Git bajo C:/Users/AKX generator/.codex/visualizations/2026/10/21/packing-list-portal/:
B1-cbe7636-receipt/, B2-cbe7636-portal-pdf/ y B3-cbe7636-layout/. CapturasB2:01antes,
02recibo tras recarga,03proveedorPDF,04cliente. Descarga original en document-download-original.json;
PDF real en B2 y14PNG en B3/outputs. Hashes completos y cierres clasificados en el handoff de esta tarea.

XLSX DTDv2 funcional en recorrido real; Excel original prefijado sigue como compatibilidad
pendiente, no se declara OOXML inválido. PDF de entrada positivo NO DISPONIBLE sin adaptador;
el error no aplicó datos ni borró el documento. `pnpm verify`/build actuales, papel/cámara,
WeChat/chino humano y licencia/portabilidad CJK de producción siguen pendientes/no acreditados.
La visual local aprobada no autoriza merge, activación ni despliegue. Graphify/Archify/Obsidian
no se actualizaron ni quedaron acreditados en este cierre documental. No reiniciar la demo o
reconfirmar para reproducir una evidencia ya preservada sin una nueva asignación concreta.

## Banco PDF opt-in · fuente nueva desde e060f6d (2026-10-22)

Este modo es un banco de pruebas PDF-only; NO reduce los formatos del portal de producto. La UI
histórica puede mencionar Excel, pero en esta instancia sólo se acepta el PDF ficticio del caso
nuevo. La demo por defecto conserva CSV/XLSX y el error recuperable de PDF deshabilitado.

`QA_PDF_EXTRACTION_ENABLED=true` habilita el lector Anthropic existente únicamente si:

- el proceso recibe ANTHROPIC_API_KEY y DOCUMENT_IMPORT_MODEL de PRUEBAS, ambos no vacíos;
- QA_PORT es un entero entre4322 y65535 (4322 propuesto, disponibilidad NO comprobada todavía);
- QA_BACKEND_ORIGIN no está definido: debe crear su propio PGlite, sin usar4320/4321.

No se carga ningún .env: envFile sigue false y no se usa dotenv/envpull. La configuración no
retorna ni imprime la clave o el modelo. Sin opt-in se eliminan ambas variables heredadas. No
existe un modelo por defecto ni se presume acceso a un modelo declarado en un ejemplo. Una
configuración incompleta falla antes de levantar el servidor. Los botones de PDF final conservan
su configuración CJK independiente; esta etapa no cambia el renderer ni sus fuentes.

El job reserva processing antes de esperar al extractor; uploaded repetido en processing, ready
o failed devuelve su estado y no inicia otra llamada. Un PUT tardío no sustituye bytes durante la
lectura. Reintentar requiere crear un nuevo job explícitamente y una autorización de la prueba;
no hay retry automático en este banco. El lector real mantiene maxRetries0, límites de tokens,
salida estructurada y revisión humana pendiente. La propuesta nunca se aplica/confirma sola.
Los errores DocumentImportError del mismo módulo SSR conservan su código; errores desconocidos
se muestran como extraction_unavailable, sin message/stack/respuesta del proveedor ni secretos.

Disponibilidad revisada, sólo presencia/nombres: no se detectó clave/modelo usable en proceso,
User/Machine o .env del worktree. La raíz canónica sólo tiene declaraciones en .env.example;
no se tomaron valores ni se copiaron secretos. La ejecución IA positiva sigue NO DISPONIBLE hasta
la configuración segura de pruebas; no pedir al usuario que publique la clave en el chat.

### Propuesta de validación, todavía NO EJECUTADA

- 25 casos nuevos escritos:13 de configuración y12 del middleware (incluye concurrentes/PUT tardío,
  ready/failed, constructor SSR, errores seguros y alternativa CSV). Sólo mocks unitarios de IO;
  no acreditan lectura de PDF. Con14 casos existentes del adaptador son39 casos/3archivos.
- Selección: extraction-config.test.ts + server.test.ts de este directorio y
  lib/studio/document-import/anthropic.test.ts, filtro
  `SDD-0473 PDF QA|Anthropic document adapter boundary`, un worker, sin paralelismo de archivos,
  retry0, dependencias instaladas, sin red/clave real. Toda ejecución requiere GO nuevo.
- Receta externa nueva en pdf-import-optin-e060/sample-source/, fueraGit: proforma PI-DEMO-PDF-002,
 2páginas completas. Comercial/proveedor enp1; embalaje explícito enp2. Tres productos:
 72mugs x2.25=162;72lids x.50=36;48bottles x4=192;192pcs/USD390. GrupoA4cajas idénticas,
 18mugs+18lids/caja,56kg bruto/.32m³ total. GrupoB6cajas de8bottles,84kg/.48m³ total.
 Total10cajas/140kg/.80m³; pesos netos48/72 claramente distintos del bruto. Todo100%ficticio.
- Primero se generará y revisará visualmente esa muestra con ReportLab/Poppler existentes, sin
  instalar; marker de authoring PDF exactamente una vez antes de crear. No se genera ahora.
- Aceptación futura: nueva instancia/origen/caso, una carga del PDF nuevo, lector real sin fallback,
  propuesta completa con páginas de procedencia, revisión explícita de incidencias y aplicación
  manual al nuevo documento compartido. Nunca rellenar a mano los valores esperados para hacer
  pasar la extracción. Los prefills pueden producir conflictos legítimos que se deben revisar.
- El caso previo rev3/V1/10códigos y archivos originales (incluido el PDF con peso faltante) no se
  resetean ni reutilizan como muestra positiva. Es una aceptación separada, sin producción.

PDF escaneado positivo, precisión con documentos de otros proveedores, presupuesto/retención de
IA en producción y pnpm verify actual siguen pendientes. Ningún resultado histórico cubre esta
fuente nueva, ni25 mocks significan aceptación IA. No iniciar servidor, llamar al SDK, generar o
rasterizar archivos, ejecutar tests o publicar este checkpoint sin la asignación correspondiente.

## Resultado de GO02 sobre f43 · 2026-10-22

La selección39/3archivos se ejecutó una vez sobre f43ae5e7e9d1ea852d58396844892a70844d446b:
39PASÓ/0fallos/0pendientes/0todo;39títulos stdout/JSON cotejados. Cuatro nativos exit0,
wrapper0/incompleteFalse: tests→markerONCE→crear muestra→Poppler. Los dobles de SDK/IO en las
pruebas unitarias NO acreditan lectura automática de PDF. El hijo actual sólo toca tres docs
(handoff/spec/esteREADME), no es otra fuente de producto ejecutada ni una corrida adicional.

Originales bajo C:/Users/AKX generator/.codex/visualizations/2026/10/21/packing-list-portal/pdf-import-optin-e060/:

- combined-v3-results/formal-return.json: cierre11:43:46.7932444Z, nativeFIN11:43:46.3332261Z.
- focal-v3-results/vitest.result.json:39passed/0failed/0pending/0todo/3files.
- sample-v3-output/proforma-packing-pdf-002-completa.pdf:2páginas,4855bytes,
 SHA2567fada57b5d00093c5f3950e36de7812226b675a2fc1547d234ca3c790b170b2e.
- sample-v3-renders/proforma-pdf-002-1.png y -2.png: AMBOS vistos por Root y General, visualPASÓ,
 sin clipping/superposición. Rootvisual ec93db0914a1c3b28925ad5dd44047df1b8543b6d7fb64535ce6a82a8d143306.
- custody-qa39-sample-02.json y caller-tool-result-qa39-sample-02.json preservan hashes y resultado
 original tool: sesión36567/chunk414c89/exit0/terminada, separado del archivo formal.

RootPOST11:43:48.2826603Z y General11:44:34.659Z fueron oportunos dentro del cap11:44:46.3332261Z.
La custodia corta cerró11:44:41.7683113Z; el recibo de campos tool se guardó después, con su hora
real, sin fingir copia byte a byte de streams. GO01 conservado FALLÓ/WhenAll/0nativos producto;
V3 y GO02 son sucesores, sin reejecución oculta. No se usaron GO antiguos ni se tocaron4320/4321.

Aviso de render: stderr Poppler94bytes contiene No display font for Symbol y ArialUnicode,
SHA2566b76dedf9fefb6759a7c6ef6ed89ea38f6b993e297a0acdcbd6c6c84b47b8b17. Native0 y revisión visual
correcta; no declarar todos los stderr vacíos ni CJK/portabilidad resueltos, no instalar/rerender.
Muestra coherente:192pcs,USD162+36+192=390,10cartons4+6,140kg bruto distinto de120neto,.80CBM.

PDF→IA→propuesta→aplicar→proveedor→confirmación/etiquetas de ESTA muestra: NO DISPONIBLE por falta
de configuración TEST (clave/modelo); no se llamó SDK real ni se llenó a mano para aparentar
extracción. El próximo caso debe ser nuevo y preservar el caso anterior confirmado rev3/V1.
Full pnpm verify/build actual, escaneado, WeChat/chino humano y CJK producción siguen pendientes.
No merge ni producción. Este cierre no consume otra ventana ni ejecuta pruebas/servicios/UI/IA.


### Corrección de la revisión CEF

La hija correctiva conserva case en enlaces/open/etiquetas y no ofrece CSV/reset en GLM. Snapshot local usa guardia SQL atómica por identidad y revisión al insertar. Recuperación completada usa SHA/perfil/contexto: archivo+fence+journal terminal válidos; no desbloquea guardias inciertas ni concede nuevos HTTP. Se devuelve job conocido sólo en contexto válido y nunca se aplica solo. Native XLSX/caché conocida no leen la credencial. Se añadieron pruebas adversariales y render de etiquetas por grupo/neto; ahora seis instancias CJK requieren Deng.ttf explícita en la futura reserva, sin SKIPs ocultos. Todo sigue NO EJECUTADO hasta GO concreto sobre nuevo SHA.
