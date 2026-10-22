# Recorrido local de cliente a proveedor · SDD-0473

Demo con identidades y documentos exclusivamente ficticios. No lee `.env`, no usa Supabase remoto
ni credenciales, no llama a Anthropic. Solo escucha en `127.0.0.1`.

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
