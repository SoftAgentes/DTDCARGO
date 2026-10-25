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
