# Diagnóstico Director — traza controlada del tag real

Fecha: 2026-10-23. Owner: director-ads-traza-real-20261023. Sesión: /root.
Estado: diagnóstico parcial; objetivo de observar el runtime real NO DISPONIBLE por conectividad.
Rama de coordinación: codex/plan-mejoras-web-20261023, base propia e66b9dec184979512dc316bcb10084d08b6edae6.
Principal observado: d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8.

## Objetivo y autorización

Sam autorizó una traza controlada del tag real para comprobar si usa pagead2.googlesyndication.com. Solo diagnóstico: sin cambiar CSP, código de producto, producción ni cuentas Ads/Analytics. No push, PR, merge o despliegue. Continúa el pendiente específico de SDD-0581, cuya entrega local permanece separada en codex/0581-medicion-ads-csp-offline, HEAD 6e3bbfbe560e97ec216d43788062b490c3cd6bd1.

Director ejecuta observación read-only, no implementación de producto/tests. El único archivo rastreado de este encargo es este handoff propio; helper temporal y recibos quedan fuera del repositorio. No se accedió a sesiones autenticadas, datos privados, anuncios ni URLs con gclid; tampoco se dispararon clics, formularios o conversiones.

## Método y controles

Chromium 1223 / Playwright 1.60.0 ya instalados. Tres contextos nuevos, sin sesión/cookies reales; escenarios sin elección, cookie sintética denied y cookie sintética granted. Navegación pública a https://dtdcargo.com/, espera de 15 s tras DOMContentLoaded por escenario; captura de CSP HTTP real, Network.requestWillBeSent/iniciador, loadingFailed, securitypolicyviolation y comandos consent/config. No se altera ninguna directiva ni respuesta del sitio.

Solo se permite GET de la home, assets públicos necesarios y scripts bootstrap reales www.googletagmanager.com/gtag/js o /gtag/destination. Los envíos de medición y demás recursos se abortan antes de red mediante CDP Fetch; proxy loopback adicional solo permite túneles a los hosts públicos del sitio y del bootstrap. Service workers bloqueados; WebSockets cerrados. No se guardan cookies, cabeceras privadas, cuerpos de hits, parámetros de identificación ni HAR crudo. URLs del recibo conservan host/path y claves de query, redactando IDs numéricos largos; valores guardados se limitan a señales de consentimiento y nombre de evento.

La primera sonda previa mostró que navigator.sendBeacon evitaba context.route de Playwright: el proxy lo denegó antes de salir. No se había navegado al sitio ni cargado tags. Ese resultado se preserva en trace-controls-initial.json y su helper; se reemplazó la interceptación principal por CDP Fetch. Antes de cada visita, tres controles (xhr/fetch, ping/beacon e imagen) fueron abortados por CDP: nueve de nueve en total. No fue necesario permitir medición para hacer el diagnóstico.

## Resultados comprobados

| Comprobación | Resultado |
|---|---|
| Home pública / CSP HTTP | PASÓ: HTTP 200 en los tres contextos; política aplicada real sin pagead2 en img-src/connect-src, sin CSP Report-Only. |
| Preparación local de comandos | PASÓ: gtag/dataLayer presentes, defaults de cuatro señales coherentes y config GA/Ads más page_view en la cola. Esto no prueba ejecución del proveedor. |
| Bootstrap real de Google | NO DISPONIBLE: cero scripts descargados; google_tag_manager ausente en los tres escenarios. |
| Fallo de red observado | En cada escenario se intentó /gtag/js, con un intento cancelado y otro net::ERR_EMPTY_RESPONSE. El proxy permitía ese host y CDP continuaba sus scripts; no fue un bloqueo CSP de Google. |
| Uso de pagead2 por el tag real | INCONCLUSO: cero intentos/violaciones observados, con runtime no ejecutado. No constituye evidencia de que no lo use. |
| Egreso de medición | Cero respuestas Google de medición; controles abortados, sin conversiones/clics de prueba ni cambios en cuentas. |
| Cambios de producto/CSP/producción | NO EJECUTADO. |

Comprobaciones independientes de lectura del bootstrap: Node fetch falla getaddrinfo ENOENT www.googletagmanager.com; curl.exe termina a los 15 s con timeout, HTTP 000 y cero bytes; herramienta web no accede a esa URL; navegador integrado devuelve net::ERR_ADDRESS_INVALID. No se conoce la causa de esta restricción de conectividad y no se atribuye a los usuarios del sitio. No se cambiaron DNS, hosts, certificados, proxy del sistema ni se buscaron IPs alternativas.

La orden de captura original finalizó exit 0 como ejecución del recolector, con cero errores propios, pero NO es un resultado positivo del objetivo: no se cargó el proveedor. El resumen independiente marca expresamente NO DISPONIBLE. El helper conservado para repetir añade una comprobación final de disponibilidad real: devolverá exit 2 si falta el runtime. Solo se ejecutó node --check tras esa adición, sin repetir visitas ni atribuir esa versión al recibo anterior.

## Evidencia local

Directorio temporal propio: `C:/Users/AKX generator/AppData/Local/Temp/dtd-ads-real-tag-20261023-1792780270514`.

- trace.json: captura saneada, 2026-10-23 18:32:23–18:33:26 UTC; SHA-256 739d4d8c0f67c429c92ea9350aea6aa06bc6e73f752a6a864e638697bcd1f1cd.
- summary.json: resultado NO DISPONIBLE y límites explícitos por escenario.
- trace.cjs: procedimiento diagnóstico conservado, con comprobación de runtime para repetición futura.
- trace-controls-initial.json y .cjs: fallo previo del control de beacon y bloqueo por proxy conservados.

Fuente oficial contrastada: https://developers.google.com/tag-platform/security/concepts/consent-mode. Google documenta pagead2 como posible dominio alterno con ad_storage denied; es documentación general, no prueba del comportamiento de esta propiedad hoy.

## Pendientes y fuera de alcance

Pendiente del objetivo: ejecutar el procedimiento desde una conexión donde www.googletagmanager.com pueda descargarse, mantener la intercepción de medición, verificar HTTP 200/hash del JS y runtime real antes de atribuir solicitudes a pagead2. Si no aparece en carga inicial, ampliar observación solo de manera controlada; la sesión actual no llegó a probar el runtime ni flujos de conversión. No se recomienda ampliar CSP con esta captura inconclusa. Autorización para diagnóstico persiste; no implica cambios DNS, cuentas, despliegue o release.

Fuera de alcance detectado: la página pública entregó una referencia a static.cloudflareinsights.com bloqueada por script-src-elem de su CSP real. No se autorizó ni recomienda abrirla por este hecho; no tiene atribución demostrada al código base ni relación probada con pagead2. Otros recursos de terceros fueron denegados por el instrumento. No se inspeccionaron cuentas o proxies de producción para atribuirlos.

## Preservación y conocimiento

knowledge:status inicial de main: ok true, estructura CURRENT, semántica PENDING, Archify CURRENT y Obsidian CURRENT, sobre d410ab2e2. Graphify se consultó read-only para ubicar Analytics y cspHeader; no se regeneró ni publicó ningún derivado. Este nuevo documento de coordinación queda pendiente de incorporar a derivados locales/integración; no se presenta como cobertura semántica completa o revisión visual de Obsidian.

Cierre: comprobar estados de main/0581/coordinación, procesos y proxy propios terminados, commit selectivo de este único handoff y release de su claim. La comprobación final y el SHA del commit que contiene este documento se informan al entregar; sin recursión documental por su propio hash. Rama y worktrees se conservan.

Comprobación final realizada: main y origin/main siguen d410ab2e2 con exactamente los dos untracked previos (.pnpm-store y PDF DPA, sin abrirlo). 0581 sigue 6e3bbfbe5, limpio y claim ausente. El recolector terminó y no queda proceso Node propio de trace.cjs; su finally cerró navegador, túneles y proxy. La pestaña temporal fallida del navegador integrado no se marcó como entrega y se cierra automáticamente al terminar el turno; la política del navegador impidió seleccionar su página de error data:, por lo que no se intentó navegarla ni eludir la restricción.

knowledge:status de cierre leído sobre la rama de coordinación e66b9dec1, con este handoff nuevo sin commit: ok false, estructura INVALID, semántica INVALID, Archify PENDING, Obsidian PENDING. Es estado de sus derivados locales, no de main o de la entrega 0581. No se regeneran/publican por un diagnóstico sin cambios de producto. Pruebas/build de producto NO EJECUTADOS por no aplicar; node --check del auxiliar PASÓ y los nueve controles de interceptación ya descritos PASARON. La verificación del objetivo real permanece NO DISPONIBLE.

## Revalidación controlada — 2026-10-25

Se mantiene el alcance solicitado por Sam: observar el tag público real sin modificar CSP, producto, producción ni cuentas Ads/Analytics. Se reutiliza el procedimiento diagnóstico conservado, copiado a un directorio temporal nuevo para preservar íntegro el recibo del 23 de octubre. No se ejecutan builds, pruebas de producto, push, merge ni despliegue. Owner del documento: director-ads-traza-real-20261023; claim y guard comprobados en esta misma rama antes de editar. HEAD previo de coordinación: dc0205e3a46361b7f2c57ee452fe4c217a259f43.

Captura nueva: 2026-10-25 20:19:33–20:20:27 UTC (16:19:33–16:20:27, Caracas). Directorio: `C:/Users/AKX generator/AppData/Local/Temp/dtd-ads-real-tag-20261025-982788ee`.

| Comprobación nueva | Resultado |
|---|---|
| Contextos nuevos sin elección / denied / granted | Tres navegaciones públicas, HTTP 200 cada una; sin sesión autenticada ni identificadores de clic. |
| Interceptación antes de navegar | PASÓ: nueve controles abortados (fetch/XHR, beacon/ping e imagen; tres por contexto). |
| Comandos locales | Cola js/consent/config/config/event presente en los tres contextos; no acredita ejecución del proveedor. |
| Bootstrap real | NO DISPONIBLE: cero scripts descargados, google_tag_manager ausente en los tres contextos. Cada contexto registra net::ERR_EMPTY_RESPONSE en el loader, además de un intento cancelado. No se atribuye a CSP ni se extrapola a visitantes reales. |
| pagead2 | INCONCLUSO: cero intentos y cero violaciones observados, con runtime real ausente. No prueba que el tag no utilice ese dominio. |
| Medición | Cero respuestas Google de medición; sin clics, formularios ni conversiones. No se habilita egreso para intentar completar el diagnóstico. |
| CSP pública | Capturada sin alteración; pagead2 ausente en los tres documentos. |
| Colector | node --check PASÓ; cero errores propios; exit 2 y diagnosticStatus NO-DISPONIBLE, como corresponde al runtime ausente. |

Recibos nuevos: `trace.json` (SHA-256 `bb0086df232e04de8b22e7cec4c2381523f920e789968e3040b8cb55a1868950`), `summary.json`, `trace.cjs` y `execution.json`. El resumen se calcula por separado desde la captura; conserva controles, fallos del loader y límites. Una comprobación actual independiente con curl también falla al conectar a www.googletagmanager.com:443 (HTTP 000, cero bytes); no se conoce la causa. No se cambian DNS, hosts, certificados o proxy del sistema ni se buscan IPs alternativas. Tras terminar no queda proceso del recolector nuevo.

La fuente oficial de Google fue consultada de nuevo: con ad_storage denied puede emplearse pagead2.googlesyndication.com para evitar cookies de terceros. Es una posibilidad documentada; no demuestra el comportamiento de esta instalación. Decisión: conservar CSP; la observación del runtime real sigue pendiente de una conexión que pueda descargar el bootstrap, manteniendo bloqueados los envíos de medición.

Incidente local de herramientas: `pnpm knowledge:status` activó inesperadamente aprovisionamiento de dependencias en node_modules ignorado del worktree de coordinación. Se interrumpió (exit 1); la salida hasta la interrupción registró cero descargas y reutilización del almacén local. No se presenta como comprobación de conocimiento aprobada ni instalación completada. Git seguía sin cambios rastreados después de detenerlo; no se elimina ni reconstruye ese directorio. Se intentó consultar después directamente con `node scripts/knowledge-sync.mjs status`, sin gestor de paquetes, pero no produjo salida y se interrumpió también (exit 1). Estado de conocimiento de esta revalidación: NO DISPONIBLE, no se hereda el resultado histórico. No se regeneran ni publican derivados.

Comprobación Git de cierre: el único cambio rastreado propio es este agregado al handoff. La rama 0581 continúa limpia en 6e3bbfbe560e97ec216d43788062b490c3cd6bd1. El checkout principal pasó de d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8 al inicio a 4fee15b8478f9c5e89240703d433eab219ac39fd durante trabajo concurrente; esta tarea no ejecutó integración ni escrituras en main. Conserva los mismos dos untracked previos sin abrirlos. El objeto Git de next.config.ts es idéntico en d410, 4fee y 0581: f7ab2023c4368d7f472fa10d14af1fddaf110b46. No se confunde ese objeto local con prueba de despliegue. El cierre propio se limita a commit documental local selectivo, guard y liberación de claim; sin push.

## Procedimiento reproducible preparado — 2026-10-25

Petición siguiente de Sam: preparar la repetición desde otra conexión, con medición bloqueada y sin tocar CSP, producción ni cuentas. Se preparó un artefacto diagnóstico portable fuera del repositorio, no código de producto ni tests de producto. La nueva ejecución real NO EJECUTADA: solo validación sintética local. Continúa el mismo owner/claim de coordinación; HEAD previo 1795b6ee9d60c3d0f968eaa2c58995ec08728da3.

- Carpeta: `C:/Users/AKX generator/Documents/Codex/2026-10-25/traza-tag-real-controlada`.
- Entrega: `C:/Users/AKX generator/Documents/Codex/2026-10-25/traza-tag-real-controlada-v1.zip`, 16.364 bytes; SHA-256 `2f2325b69d1294145d5490136b37f31fc5d1bc485bc05a7294154b2dae4c2802`.
- Contenido: README con pasos PowerShell y criterios; trace.cjs portable; package.json con versiones; verify.cjs; manifest.json; resumen y traza del self-test sintético. No incluye dependencias, secretos, .env, perfiles, HAR ni sesiones.
- Runtime comprobado: Node v24.22.1, Playwright 1.60.0, Chromium 148.0.7778.96 / build 1223 ya instalado. No se ejecutaron gestores ni instalaciones en esta preparación. Para otra máquina la guía ofrece instalación manual exclusivamente en la carpeta independiente si faltan dependencias; no usa aprovisionamiento automático.

El navegador tiene proxy loopback que rechaza toda salida directa, incluidos todos los hosts Google. CDP aborta medición antes de red. Solo el lector HTTPS de Node puede hacer GET de la home pública, assets permitidos y bootstrap exacto de Google con los IDs públicos conocidos, tras revalidar host/método/path/query. No sigue redirecciones, no adjunta cookies/auth/referer, y no permite endpoints de medición. Entrega bytes al navegador con la URL original y conserva las cabeceras CSP; omite Set-Cookie y transporte/compresión. Esta modalidad de relé y su User-Agent propio están explicitados como límites de comparación con una sesión normal. Las respuestas desconocidas fuerzan cierre y error. No hay flag para abrir el egreso.

Antes de cada navegación se exigen cuatro controles abortados y un fetch bloqueado desde Worker; hay además tres pruebas de rechazo del proxy. Los escenarios none/denied/granted conservan ventanas separadas de 15 s. El resultado requiere home HTTP 200, bootstrap HTTP 200 con bytes/hash y runtime presente. Se distinguen intento con iniciador Google, dominio sin atribución, ausencia durante la ventana y runtime no disponible. Una violación CSP puede acreditar un intento sin entregar un hit. La documentación exige no interpretar ausencia como prueba universal ni confundir detección con recepción o atribución de Google.

Validación final PASÓ: node --check de ambos JS; 16 casos de allowlist; 12 controles de transporte (4 × 3); tres Workers bloqueados; tres rechazos de proxy; detección sintética positiva de solicitudes/stack y una violación CSP; cabecera CSP del fixture preservada; cero respuestas inesperadas; cero solicitudes del lector HTTPS externo. Recibo final: `C:/Users/AKX generator/AppData/Local/Temp/dtd-tag-procedure-selftest-05c06ed6`, 2026-10-25 21:09:51–21:09:54 UTC; trace SHA-256 `e907d8018e9a1f5d9af35ddba23883c3efe5ebae612aaeb624ca4d52f2a32874`. Sus copias están dentro del ZIP. SELF_TEST_PASO y OBSERVADO en ese recibo son exclusivamente sintéticos.

Se verificaron los hashes del paquete y de su copia extraída; la alteración deliberada del README de esa copia fue detectada (exit 1). Copia negativa preservada en `C:/Users/AKX generator/AppData/Local/Temp/dtd-tag-procedure-extracted-410ec7d0`; el original y el ZIP no se alteraron. Se probó también el rechazo de un directorio de evidencia existente: exit 1 y hash del recibo intacto. Hash del helper y del recibo concordantes con el resumen/manifest.

Intentos previos preservados: `dtd-tag-procedure-selftest-d2164e54` falló por clasificar una respuesta blob local del Worker como respuesta HTTP inesperada; se corrigió la clasificación para comprobar egreso exclusivamente HTTP/HTTPS, sin permitir ningún nuevo destino. `dtd-tag-procedure-selftest-57232e23` pasó antes de añadir la atribución explícita al iniciador; no sustituye el recibo final. No se borra ni reescribe evidencia fallida.

Pendiente del objetivo original: ejecutar el paquete desde otra conexión que permita leer el bootstrap, revisar los recibos saneados y su iniciador. La guía no autoriza cambios CSP/cuentas, conversiones entregadas ni flujos adicionales. Pruebas/build de producto no aplican; no se tocaron sus archivos, SDD, ramas Worker ni main. El único cambio Git propio de esta preparación es este agregado documental. No push, merge o despliegue. Derivados de conocimiento no se regeneraron ni publicaron; este nuevo texto queda pendiente, sin inventar cobertura frente a la consulta de estado incompleta ya registrada.
