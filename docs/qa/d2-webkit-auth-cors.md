DICTAMEN PARCIAL: HTTPS REAL PASA CORS EN AMBOS MOTORES; con el puerto local cerrado, la sonda actual reproduce la firma mediante un fallo de transporte del preflight. El mecanismo exacto de H2 histórico sigue INCONCLUSO: su traza no conserva la respuesta Auth de WebKit.

# D2 — `/auth/v1/user` en WebKit

Dueño: Worker `codex-d2-webkit-auth-cors-20260910` · Fecha: 2026-09-10 · Estado: dictamen parcial para revisión del Director · Clasificación: interno.

La sonda anónima no reprodujo un rechazo CORS contra HTTPS real que sustente un arreglo de compatibilidad. Tampoco se declara que el evento histórico H esté causalmente resuelto. La distinción importa: reproducir el mismo texto con un puerto cerrado no demuestra qué interrumpió la petición de H, donde Chromium sí recibió 200.

## Método y alcance medido

- Base: `710a8e0695f416700d75e7bc42e8e5cb889751e8`. Node 24.20.0, Playwright 1.60.0, Chromium 148.0.7778.96, WebKit 26.4/revisión 2287, Windows.
- Se importan los proyectos reales de `playwright.config.ts`: `mobile-chrome`/Pixel 7 y `mobile-safari`/iPhone 14. No se modifica el config.
- Cada combinación usa contexto limpio, documento vacío estable y `fetch` nativo. No se llama a `getUser()` sin sesión: el SDK puede devolver `AuthSessionMissingError` sin emitir HTTP. Se envía explícitamente `GET /auth/v1/user`, `mode: cors`, `credentials: omit`, sin sesión y sin consumir el cuerpo.
- Perfil principal: solamente `apikey` con la anon key correspondiente. Control adicional: `Authorization: Bearer <anon>`, `X-Client-Info: supabase-ssr/0.5.2`, `X-Supabase-Api-Version: 2024-01-01`. Ese Bearer no es un JWT de usuario. Su 403 es una respuesta HTTP visible, no un error CORS; no se leyó su cuerpo para atribuirle otra causa.
- URL real: `https://xpfuzqombmjmxvprjgmi.supabase.co`, identificada por el guard del proyecto (`scripts/e2e/sdd-0168-fixture.ts:169`). Anon pública activa obtenida por `get_publishable_keys`, sin solicitar otras claves. Anon local: exclusivamente `ANON_KEY` del Storage existente, la misma fuente que el ejecutor histórico H. Valores conservados fuera de Git; no entró ningún PAT ni service-role al worktree.
- Orígenes de documento: `http://localhost:<puerto>`, `http://127.0.0.1:<puerto>` y, para HTTPS real, `https://dtdcargo.com`. Este último se crea como documento vacío con `route.fulfill`; toda intercepción se retira **antes** de `fetch`. No se cargan páginas de producto, CSP de la app, sesiones ni service workers.
- Es WebKit de Playwright en Windows, con emulación de iPhone; no un Safari ejecutado en un iPhone físico. El alcance es el protocolo anónimo solicitado, no una certificación del portal completo. [Límite oficial de WebKit en Playwright](https://playwright.dev/docs/browsers#webkit).

## Matriz principal y controles

La salida cruda válida vive en [04 — transporte directo](assets/d2-webkit-auth-cors/04-matrix-native-direct.json). Son 28 filas: 2 motores × 2 orígenes de documento locales × 3 destinos × 2 perfiles de cabeceras, más 4 filas del origen HTTPS sintético. En cada fila se conservan estado visible desde JavaScript, tiempos, errores y cabeceras de respuesta permitidas; nunca cookies, claves o cuerpos.

Documento `http://localhost:56712`, perfil principal `apikey-only`:

| Navegador | `127.0.0.1:55431` directo | `localhost:55431` directo | Supabase real HTTPS |
|---|---|---|---|
| Chromium / Pixel 7 | `TypeError: Failed to fetch`, 2051,4 ms; conexión rechazada | `TypeError: Failed to fetch`, 2421,8 ms; conexión rechazada | **401 visible**, 1067,3 ms; CORS PASÓ |
| WebKit / iPhone 14 | `TypeError: Load failed`, 2073 ms; `Could not connect to server` | `TypeError: Load failed`, 2273 ms; `Could not connect to server` | **401 visible**, 708 ms; CORS PASÓ |

Los dos destinos locales directos son **NO DISPONIBLE como servicio**, no una prueba de rechazo CORS. El TCP directo devolvió `ECONNREFUSED` para ambos nombres y Docker reportó `NetworkSettings.Ports = {"8000/tcp":[]}` para Kong. `localhost` resolvía `::1` y `127.0.0.1`. Cambiar el nombre no publica el puerto.

En las 12 filas HTTPS válidas (dos perfiles y tres orígenes), ambos motores reciben respuesta: 6 × 401 con anon sola y 6 × 403 con forma SDK. Desde `https://dtdcargo.com`, anon sola da Chromium 401/739,7 ms y WebKit 401/730 ms.

Antes de cada matriz, ambos motores pasan tres controles independientes con servidor local de diagnóstico:

| Control | Chromium | WebKit | Recibo del servidor |
|---|---|---|---|
| CORS permitido | 401 visible | 401 visible | OPTIONS y GET |
| Falta `Access-Control-Allow-Origin` | TypeError | TypeError / Load failed | Solo OPTIONS; GET no emitido |
| Falta `authorization` en `Access-Control-Allow-Headers` | TypeError | TypeError / Load failed | Solo OPTIONS; GET no emitido |

Los seis controles PASARON. Validan que la sonda permite al motor aplicar CORS y que un error real de cabeceras no se convierte en un verde artificial.

### Servicio local mediante transporte diagnóstico

Para medir el servicio ya existente sin modificar contenedores, redes, configuración, semillas ni datos, la sonda auxiliar publica temporalmente **solo loopback** IPv4/IPv6:55431 y transporta únicamente GET/OPTIONS anónimos de `/auth/v1/user` hacia Kong mediante `docker exec -i <ID verificado> nc 127.0.0.1 8000`. Rechaza cookies, claves ajenas, cabeceras duplicadas, cuerpos y otras rutas/métodos. Conserva Host, Origin y cabeceras CORS; fuerza `Connection: close`. No relaja la red Internal ni crea servicios de plataforma.

Esta topología adicional no reproduce fielmente la publicación de puertos de H. Permite contrastar las cabeceras del servicio con ambos hostnames, con el costo de arranque de `docker exec` incluido en la latencia. La matriz y el recibo se conservan por separado; no sustituyen el resultado directo.

Resultado final: **28/28 solicitudes exponen respuesta HTTP**, 14 × 401 con anon sola y 14 × 403 con forma SDK. Los seis controles de CORS PASARON. Documento `http://localhost:50117`, perfil principal:

| Navegador | `127.0.0.1:55431` vía sonda | `localhost:55431` vía sonda | HTTPS real |
|---|---|---|---|
| Chromium / Pixel 7 | **401**, 6260,5 ms | **401**, 6706,4 ms | **401**, 605,6 ms |
| WebKit / iPhone 14 | **401**, 6365 ms | **401**, 6392 ms | **401**, 555 ms |

Con documento `http://127.0.0.1:50117` también pasan ambos destinos locales y ambos motores. El perfil SDK obtiene 403 visible en las mismas combinaciones. El servicio local devuelve `Access-Control-Allow-Origin: *` y autoriza las cabeceras solicitadas en OPTIONS. **El hostname `127.0.0.1` por sí solo no reproduce H2 cuando el transporte está disponible.** No hay diferencia CORS entre ambos hostnames en esta medición. La latencia adicional de la sonda no se presenta como rendimiento del producto.

Evidencia: [05 — matriz nativa con transporte diagnóstico](assets/d2-webkit-auth-cors/05-matrix-native-diagnostic-transport.json), [05 — solicitudes OPTIONS/GET, cabeceras y cierre del transporte](assets/d2-webkit-auth-cors/05-local-transport.json). El postflight comprueba que los listeners auxiliares se cerraron y que los siete servicios preexistentes se conservaron.

## Regla concreta y mecanismo

`apikey` no está en la safelist de CORS: exige OPTIONS. El perfil SDK también exige autorización de sus cabeceras; `Authorization` tiene que figurar explícitamente en `Access-Control-Allow-Headers`. La respuesta final necesita un `Access-Control-Allow-Origin` compatible; `*` es válido con `credentials: omit`. Un GET puede haber llegado al servidor y aun así su respuesta quedar inaccesible. Solo el `fetch` que resuelve y expone `response.status` prueba el paso de CORS. Un TypeError también puede representar un fallo de red: no prueba el inverso. [Fetch: preflight](https://fetch.spec.whatwg.org/#cors-preflight-fetch), [Fetch: CORS check](https://fetch.spec.whatwg.org/#cors-check).

En HTTPS real **no falta ninguna cabecera requerida para estas solicitudes**:

```text
OPTIONS 200
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: apikey
# En perfil SDK: apikey,authorization,x-client-info,x-supabase-api-version
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS,TRACE,CONNECT

GET 401 (o 403 con Bearer anon)
Access-Control-Allow-Origin: <Origin exacto del documento>
Access-Control-Allow-Credentials: true
Vary: Origin
```

El [recibo OPTIONS real](assets/d2-webkit-auth-cors/07-real-preflight-headers.json) es observación HTTP de Node, complementaria al resultado del navegador, no su sustituto.

La divergencia de **mensajes** tiene una explicación verificable. En la base WebKit fijada por Playwright 1.60, `NetworkCORSPreflightChecker::didCompleteWithError` convierte un error general de transporte en `ResourceError::Type::AccessControl` antes de validar la respuesta del preflight. En el control con puerto cerrado, WebKit emite “access control checks” junto con “Could not connect to server”; Chromium expresa conexión rechazada/“Failed to fetch”. **Los dos fallan al conectar**. No es una regla más estricta aplicada únicamente por Safari ni una cabecera omitida por el servidor. [Pin de Playwright](https://github.com/microsoft/playwright/blob/v1.60.0/browser_patches/webkit/UPSTREAM_CONFIG.sh), [mecanismo en WebKit fijado](https://github.com/WebKit/WebKit/blob/6b34ac51510516bd6a3ec2f5edc97413758d3ab1/Source/WebKit/NetworkProcess/NetworkCORSPreflightChecker.cpp#L140).

La ruta WebCore también puede reclasificar una cancelación, mientras otras rutas conservan `Cancellation` y no emiten ese mensaje. Por eso no se atribuye H2 a navegación solo por coincidencia temporal. [WebCore preflight](https://github.com/WebKit/WebKit/blob/6b34ac51510516bd6a3ec2f5edc97413758d3ab1/Source/WebCore/loader/CrossOriginPreflightChecker.cpp#L104).

La nota previa de `e2e/README.md` sobre `127.0.0.1` trata del HMR de Next. Ninguna medición anterior convierte ese bloqueo de HMR en el mecanismo de CORS de Supabase.

## H2 original y el hook de 90 segundos

El [extractor histórico](../../e2e/diagnostics/d2-extract-historical-evidence.mjs) conserva SHA256 de cinco archivos primarios y proyecta únicamente metadatos permitidos en [03 — evidencia histórica](assets/d2-webkit-auth-cors/03-historical-evidence.json). No publica ZIP, resources, snapshots, bodies, cookies ni cabeceras de solicitud.

| Evento H, WebKit | Tiempo monotónico (ms) |
|---|---:|
| beforeEach | 108478,771 → 108628,478 (**149,707 ms**) |
| `BrowserContext.newPage` | 108502,183 → 108620,472 |
| `Page.addInitScript` | 108622,384 → 108628,166 |
| Empieza `goto /m/erp?tab=expenses` desde `/studio/gastos` | 111119,524 |
| Primer error `/auth/v1/user` | 111371,916 |
| Mismo “access control checks” contra Next **same-origin** `/__nextjs_original-stack-frames` | 111397,290 |
| Resuelve el goto | 111672,152 |

H conserva dos GET Auth 200 en Chromium, de 70,911 y 65,171 ms, con `Access-Control-Allow-Origin: *`. WebKit conserva dos errores Auth, pero **ninguna respuesta Auth en el archivo network**. El primer error corresponde aproximadamente a `2026-09-08T15:44:02.149Z`. La fase y la coincidencia con navegación están medidas; la interrupción exacta no.

El `beforeEach` de 90000 ms corresponde a **otra corrida, E**. Su `error-context.md` preserva además un timeout separado de 90000 ms al desmontar context. El hook congelado de E únicamente registra `page.addInitScript` para colapsar la barra lateral; el login/navegación vive después, en el test. E no conserva trace, de modo que el primario no distingue creación de fixture de ejecución de `addInitScript`; la atribución a crear context/page proviene del auditor histórico.

**Comprobación 5: son fenómenos distintos en la evidencia disponible.** El hook E todavía no cargaba la aplicación que emite Auth; el hook H ya había terminado antes del error. Esto separa las dos incidencias, pero no repara ni determina la causa interna del bloqueo de inicialización E. Tampoco se confunde con el límite conocido de un worker para el cierre de WebKit en Windows.

## Reproducibilidad y límites de los intentos

```powershell
corepack pnpm install --frozen-lockfile
# JSON externo: url HTTPS del proyecto, key de rol anon y localKey de rol anon.
# Solo valores públicos; nunca credenciales de usuario, PAT ni service-role.
$env:D2_PUBLIC_CONFIG = '<ruta-fuera-de-Git>/public-config.json'
$env:D2_OUTPUT = '<ruta-del-recibo.json>'
$env:E2E_START_WEB_SERVER = '0'
node --import tsx e2e/diagnostics/d2-webkit-auth-cors.mjs
node e2e/diagnostics/d2-extract-historical-evidence.mjs
```

El transporte opcional requiere además `D2_KONG_ID` completo verificado y `D2_TRANSPORT_RECEIPT`; se ejecuta con `node e2e/diagnostics/d2-local-auth-transport.mjs`, acepta `stop` por stdin y tiene cierre automático a diez minutos. No debe usarse para activar una plataforma, ejecutar Auth18, sembrar ni cambiar redes. La clave local tiene que corresponder al servicio. Es herramienta de diagnóstico, no infraestructura de producto.

Los recibos `01-*` y `02-*` son **preliminares descartados como evidencia de CORS**: el primero interceptaba solicitudes y el segundo, además, sufrió un defecto de EOF del `nc` auxiliar. La ausencia de OPTIONS en el relay reveló el sesgo. La corrida 02 se interrumpió sobre su árbol de procesos identificado; no se atribuyen sus timeouts a Supabase. Se conservan para no borrar la historia del instrumento. Solo `04-*`, la matriz final de transporte diagnóstico y sus controles sustentan el dictamen.

## Decisión pendiente

La pregunta anónima contra HTTPS tiene respuesta: el navegador permite el intercambio en ambos motores. No se observó una pantalla ni pérdida de funcionalidad de usuarios reales, porque no se ejecutó producto autenticado. No se puede declarar impacto total/intermitente ni ausencia universal de defectos Safari a partir de esta sonda.

Para adjudicar el mecanismo **exacto** de H2 falta una captura que determine si se emitió el preflight, qué respondió o por qué terminó, y cómo se relacionó con la navegación entre layouts. Una sonda anónima adicional puede contrastar mecanismos de cancelación sin atribuir automáticamente su resultado a H. Repetir fielmente el flujo histórico autenticado requiere una autorización aparte del método anónimo indicado en el encargo. Se devuelve al Director con los primarios y esta limitación; no se reserva SDD ni se implementa arreglo. Hasta esa decisión, H2 no debe emitirse como defecto de producto confirmado ni borrarse como resuelto.
