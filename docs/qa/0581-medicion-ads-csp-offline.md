# QA SDD-0581 — Medición Ads/CSP offline

Dueño: Worker `worker-0581-ads`. Fecha: 2026-10-23. Estado: validación local terminada; cierre documental pendiente.
Base `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`.

## RED antes de producto

Fixture Next 16.2.11 release con fuentes copiadas byte a byte de la base:
Analytics SHA-256 `822910d3a5c8baf45439bade630b19a1cef534376f663a5e9a5d96219a53e698`;
cookie-consent SHA-256 `3f80c3ef87320e6fe5d56b390d79f354fca8c2fc9092395e252858f8e935b0d0`.
No se ejecutó gtag real. Dos motores, seis casos por motor: **8 FALLARON como
se esperaba / 4 PASARON**. Evidencia raw preservada en
`.codex/qa/ads-cookie-red-playwright.json`, `ads-cookie-red-summary.json`,
`ads-fixture-baseline-sources.json` y `ads-probe.log`.

| Cookie sintética | Init anterior | Helper anterior | Esperado al iniciar |
|---|---|---|---|
| Propia denied + ajena con prefijo granted | granted | denied | denied |
| Solo ajena con prefijo granted | granted | null | denied |
| Propia granted-synthetic | granted | granted | denied |
| Propia granted válida | granted | granted | granted |
| Propia denied válida | denied | denied | denied |

Cambiar el orden de propia/ajena mantuvo el defecto. No se afirma que estas
cookies existan en producción ni que hayan provocado transmisión real.

## Matriz de validación

| Comprobación | Estado actual |
|---|---|
| Dependencias frozen/offline | **PASÓ**, 817 reutilizadas, cero descargas, sin .env reales. |
| Focales Analytics, consentimiento, fallback, off y config | **PASÓ**, 267/267 en ocho archivos. |
| Build real GAoff retenido y headers HTTP | **PASÓ**: release Next real, CSP sin unsafe-eval y defensas conservadas; fixture con CSP HTTP idéntica. 218 chunks estáticos, cero archivos con ID real GA/Ads. |
| E2E fixture activa / CSP / SPA / cookies | **PASÓ 32/32**, Chromium y WebKit, 26,9 s, cero reintentos y cero skips en la selección. |
| Controles finales de red | **PASÓ**: ocho probes Node (incluye stderr y PID del hijo rechazado), dos proxy HTTP/CONNECT y una navegación browser descartable por caso; cero intentos inesperados. |
| Canónico segundo intento | **PASÓ lo medido / CIERRE INCOMPLETO**: 12/17 pasos, cinco SKIPs críticos. Verify exit 0 no equivale a cobertura completa. Build y postbuild PASARON. |
| Vitest general | **PASÓ**: 861 archivos / 12.294 pruebas, un archivo / una prueba omitidos por corpus comercial ausente; 593,78 s, primera pasada, sin reintento. |
| Harness, lint y RSC | **PASÓ**: 237/237 harness; lint cero errores / 15 warnings históricos; 1.706 módulos de frontera. |
| Tipos, docs, numeración, constantes, componentes, gobernanza, símbolos | **PASÓ**. |
| Envoltura offline del segundo intento | **FALLÓ**, exit 1 al cerrar por tres denegaciones Git genéricas; raw original preservado. No falla de producto ni ejecución de fetch real. |
| Clasificador de denegación y recheck focal posterior | **PASÓ**: 36/36 pruebas existentes de ledger, tres denegaciones esperadas, cero inesperadas; cinco controles de clasificación y ocho probes Node. Sin repetir canónico ni suite global. |

Primera E2E posterior al cambio: **16/32 PASÓ**. Los 16 casos Chromium fallaron
antes de sus aserciones de producto por una carrera del harness: la navegación
denegada de la sonda confirmaba `chrome-error` tarde e interrumpía el siguiente
goto local. Los 16 WebKit pasaron. Se conservan log y
`ads-e2e-initial-playwright.json`. La sonda usa ahora una pestaña descartable;
el recheck completo pasó 32/32 usando los builds retenidos y hashes actuales de
las tres fuentes copiadas, sin repetir el build ni cambiar el producto.
`ads-green-playwright.json`, `ads-release-summary.json`, `ads-recheck.log` y
los logs de red/proxy finales guardan la evidencia. El tsconfig de la raíz se
restauró por bytes después del build; no forma parte del diff.

El primer canónico pasó harness 237/237, pero ESLint recorrió los bundles de
`.codex/qa/ads-release` y la fixture porque Git los ignora y ESLint no ignora
`.codex`. Produjo 2.890 errores/38.045 warnings sobre ese entorno contaminado;
se preserva como **FALLÓ / INCOMPLETO**. Tras finalizar lint, se revalidó el árbol
propio runner 27216 → verify 2680 → tsc 26628 y se interrumpió solo ese árbol,
antes de unit/build. Director autorizó un único reinicio completo con el entorno
corregido. No se cambian ESLint, el verificador ni las aserciones para obtener verde.

Los dos derivados se movieron mediante PowerShell nativo a
`C:/Users/AKX generator/AppData/Local/Temp/dtd-0581-qa-cf340175276544b184f596b2ea052d9a/`,
validando orígenes/destino absolutos y sin borrarlos. Manifest con hashes:
`.codex/qa/ads-preserved-builds.json`; release 5.661 entradas (dos enlaces internos
de Next registrados sin seguirlos), fixture 112. Los hashes se calcularon sobre
archivos y referencias de enlaces, no sobre destinos externos. El runner ahora
rechaza esos derivados dentro del repo antes de `verify`. Lint focal de los cinco
archivos propios pasó; tsconfig restaurado, claim propio y puertos libres tras corte.
Log original: `ads-verify-initial-interrupted.log`; PIDs/comandos preservados en
`ads-verify-interrupted-processes.json`. El segundo resultado no reescribe el primero.

### Tres rechazos Git y clasificación posterior

La segunda envoltura detectó tres denegaciones `child-git-remote`, preservadas en
`ads-network-verify-original.jsonl`, y terminó exit 1 después de que verify
concluyó sus 12 pasos medidos sin fallos. El log original solo tiene PID/tipo/host:
no acredita por sí solo el contexto de las tres llamadas.

La reproducción posterior ejecutó el archivo existente
`scripts/check-migrations-applied.test.mjs`: **36/36 PASÓ**. Sus tres casos llaman
`git fetch origin main --quiet` desde un temporal real `gate-migraciones-0548-*`
con GIT_DIR exactamente `<cwd>/no-es-un-repo`, inexistente, y fetch HTTP doble.
El auxiliar ahora clasifica **denegación esperada**, sigue lanzando
`DTD_OFFLINE_DENIED` y nunca ejecuta Git. No es una whitelist ni un permiso de red.
Se conserva `GIT_ALLOW_PROTOCOL=file`; todo otro contexto permanece inesperado.

Cinco controles comprobaron el caso exacto y cuatro rechazos genéricos: cwd del
worktree, otro temporal, argumentos distintos y GIT_DIR existente. Evidencia en
`ads-git-classification-controls.jsonl`; recheck en `ads-ledger.log` y
`ads-network-ledger.jsonl`: tres denegaciones esperadas y cero inesperadas.
Es atribución por reproducción posterior; no se reetiquetan los logs originales.
No se repitió el canónico ni la suite global después de esta clasificación.

### Omisiones del canónico

- **NO EJECUTADO** Edge Functions: `VERIFY_SKIP_EDGE=1`, sin Deno nativo o descarga.
- **NO EJECUTADO** ledger productivo: sin URL/clave service-role, sin consulta real.
- **NO EJECUTADO** contratos SQL y reconstrucción: `VERIFY_SKIP_SQL=1`, sin Docker/DB real.
- **NO EJECUTADO** E2E global: `VERIFY_SKIP_E2E=1`; se ejecutó la selección offline propia.
- Una prueba/archivo de corpus comercial se omite porque `DOCUMENT_IMPORT_CORPUS`
  no está disponible. No se buscaron documentos privados para activarla.

El caso de cookies duplicadas se observó en navegador con mismo nombre y paths
`/` y `/servicios`, para valores contradictorios y para dos granted. Ambos init y
helper fallan cerrado de forma coherente. No se borran cookies de paths/domains
ajenos ni se promete corregir una duplicada persistente sin limpieza independiente.

La matriz separa build GAoff, fixture activa inerte, compatibilidad CSP y eventos.
El loader de Google se sustituye por JS inerte y las respuestas de probes se
generan en memoria. SW bloqueados; WebSockets y popups se cierran. El proxy
backstop registra y rechaza HTTP absoluto y CONNECT que escapen a la intercepción.
Node, DNS, UDP y subprocesos tienen preload loopback y controles negativos previos.
Las barreras no son una sandbox del SO. Los logs guardan host/tipo/PID, sin query,
cookies, cabeceras o payloads personales.

Los controles sintéticos de permisos CSP no prueban necesidad funcional de cada
host de la receta Google. No se modifica `next.config.ts` ni se permiten servicios
extras sin evidencia. Consent Mode denied no equivale a cero pings del proveedor.
La cola observada no certifica recepción, cookies internas, deduplicación o
atribución en Google. Cuentas y producción: **NO EJECUTADO**.

Pendiente específico de CSP: connect/img a `pagead2.googlesyndication.com`
quedaron bloqueados en ambos motores. Google lo documenta como ejemplo de dominio
alterno con ad_storage denied, estado usado aquí. Es una sospecha concreta,
no solo una capacidad genérica; la fixture inerte no acredita qué solicitud
elige realmente esta propiedad. Falta traza controlada de recurso/iniciador para
justificar la apertura con el umbral P3. No se afirma CSP completa correcta ni
ausencia de pérdidas de medición Ads. La política sigue intacta en esta entrega.

### Aislamiento del descubrimiento Playwright

El cierre encontró una regresión del harness: el nombre inicial
`e2e/analytics-csp-offline.spec.ts` era descubierto por la configuración general,
sin la preparación offline específica. RED de `--list`: **48 casos propios**
en sus tres proyectos, conservado en `ads-discovery-red.json`.

Se renombró a `e2e/analytics-csp-offline.offline.ts` y se cambió solamente
`testMatch` de `playwright.analytics-csp-offline.config.ts`. GREEN de `--list`:
**cero casos propios en el general y 32 en la configuración propia**, exit 0 y
cero registros de red en ambos. Resumen: `ads-discovery-green-summary.json`;
JSON completos: `ads-discovery-green-{general,own}.json`.

El SHA-256 del cuerpo antes/después es idéntico:
`ac1dc645708f0a356ce66db8fad3f1e9d4c490fbc94e30f51c903d17a67160a3`.
La ejecución anterior 32/32 comprueba ese mismo contenido. No se repitió suite
general ni canónico, ni se alteraron configuración general, skips o aserciones.
Un primer intento de listado no cargó el preload por barras Windows en
NODE_OPTIONS; se preservó como `ads-discovery-preload-path-error.*` y se corrigió
la ruta de ese comando antes del listado efectivo, sin ejecutar tests o servidores.
