# Director — medición Ads, diagnóstico y correcciones locales

Fecha: 2026-10-23, America/Caracas.
Owner: Director de esta conversación; claim `director-ads-20261023`.
Estado: en progreso; diagnóstico delegado, sin autorización de publicación.

## Encargo y límites

Sam autorizó otro Worker aislado para diagnosticar primero la medición de Ads y aplicar solamente correcciones justificadas, probadas localmente. Se permiten commits locales y un handoff revisable. Se prohíben push, PR, merge, despliegue y cambios en las cuentas de Ads o Analytics. No se accede a cuentas, PII, datos de negocio ni credenciales reales. Las tareas 0579 y 0580 permanecen separadas, sin incorporar su producto.

Director conserva su rol y solo escribe este documento de coordinación en su propio worktree. El Worker `/root/worker_ads` está inicialmente en lectura; no escoge SDD, no escribe en main y no inicia runtimes sin controles de salida. Asignación definitiva tras inventario de PRs, refs y worktrees.

## Evidencia inicial

- Principal y origin/main observados: `d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8`; fetch sin prune ejecutado. Dos untracked preexistentes preservados, sin abrirlos ni limpiarlos.
- Coordinación: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/plan-mejoras-web-20261023`, rama `codex/plan-mejoras-web-20261023`, base de coordinación `9ad05aa21f22b2f5502e386473208d24651f7eee`.
- Inventario Director fechado 2026-10-23T17:11:06Z: GitHub disponible, SoftAgentes/DTDCARGO, 18 PR abiertas incluidas bases distintas de main. Ninguna toca Analytics/CookieConsent/cookie-consent/next.config o sus tests. Diez PR comparten el índice generado; regenerarlo al preparar una integración futura. No se descubren cambios sin commit en esas fuentes. Dos refs históricas de saneamiento conservan implementaciones divergentes; no se adoptan. Actividad de sesiones ajenas NO VERIFICADA.
- knowledge:status inicial PASÓ en principal: ok true, estructura CURRENT, semántica PENDING, Archify CURRENT, archivos Obsidian CURRENT. Esta sesión solo observa esos derivados; no publica ni abre Obsidian.
- Graphify local consultado mediante Python fijado: Analytics.tsx, cookie-consent.ts, next.config.ts y marketing son las fuentes relacionadas; se contrastan con sus archivos reales, no se toma el grafo como prueba de ejecución.
- El código usa gtag directo para GA4 y Ads, gate por URL pública y apagado de ambos con GAoff. CSP pública de release no habilita unsafe-eval; ya permite los hosts clásicos de conversiones. No existe aún un defecto reproducido que justifique abrir hosts adicionales.

## Decisión de diagnóstico

El plan P3 exige inventariar tags, consentimiento, eventos y política efectiva por ruta. Una receta genérica de Google no prueba que la aplicación use todos sus hosts. Pruebas con recursos inertes y valores sintéticos distinguirán bloqueo CSP, contrato de eventos y capacidades no habilitadas. Consent Mode avanzado puede emitir pings restringidos con consentimiento denegado; eso no justifica confundir denied con cero tráfico. La salida externa se bloquea por controles independientes antes de navegar o construir.

Se preparan dos pruebas separadas: build real retenido con GAoff para headers de release y fixture activa inerte para Analytics/consentimiento/SPA/WhatsApp. Esta última no certifica recepción ni atribución en Google. Tampoco se inferirá ROAS, CPC o Quality Score de una prueba de CSP.

Analytics.tsx y el modelo de consentimiento quedan fuera de la allowlist inicial de modificación. Si surge un defecto allí, el Worker debe presentarlo antes de ampliar alcance; duplicados, conversión de negocio o consentimiento no se refactorizan por conveniencia. No se habilitan unsafe-eval, comodines globales, hosts sin uso demostrado ni servicios del auditor que no usa el código.

## Aceptación y pendientes

Reserva local SDD-0581 tras inventario actualizado de 532 refs más worktrees: `codex/sdd-reserve-0581-medicion-ads-csp-offline`, commit `654d972afd3c0766c644340956c92a7e62bd7094`, padre d410ab2e2. Se conserva el aviso de colisiones históricas; no hay renumeración ni publicación. La reserva solo excluye dentro de este clon.

Worker asignado a `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0581-medicion-ads-csp-offline`, rama `codex/0581-medicion-ads-csp-offline`, owner `worker-0581-ads`. Raíz, HEAD, rama y árbol limpio comprobados antes de asignar escritura. Spec propia `docs/specs/0581-medicion-ads-csp-offline/spec.md`; handoff propio `.agents/handoffs/0581-medicion-ads-csp-offline.md`.

Allowlist inicial exacta: `next.config.ts` solo tras evidencia y revisión Director; `lib/runtime/__tests__/next-config.test.ts`; `e2e/analytics-csp-offline.spec.ts`; `playwright.analytics-csp-offline.config.ts`; spec propia; assets propios `offline-network-guard.cjs`, `local-ads-check.mjs`, `fixture-app.mjs`; `docs/qa/0581-medicion-ads-csp-offline.md`; `docs/marketing/diagnostico-medicion-ads-2026-10-23.md`; `docs/marketing/README.md`; `docs/specs/README.md` regenerado; handoff propio. Trazas saneadas ignoradas en .codex/qa, sin añadir secretos ni .env reales. Otros archivos requieren decisión acotada del Director.

Director leyó el RED sintético de Chromium y WebKit: doce escenarios, ocho fallos esperados y cuatro controles válidos aprobados. La copia baseline de Analytics tiene SHA-256 `822910d3a5c8baf45439bade630b19a1cef534376f663a5e9a5d96219a53e698`. Cookie propia denied más cookie ajena prefijada granted inicializa granted; solo la ajena también. Un valor propio granted-synthetic se interpreta como granted tanto en init como en el parser compartido. Orden normal/invertido no lo evita. Ocho probes negativos bloqueados y cero intentos Node remotos inesperados; no se demuestra incidencia en producción.

**Decisión concreta Director:** incorporar este defecto aislado como única corrección de producto justificada hasta ahora. El plan P3 preveía separar consentimiento si aparecía; Sam autorizó ahora diagnosticar y aplicar las correcciones justificadas de medición, y el RED permite delimitar dos expresiones de lectura, sin rediseñar modelo/UI, IDs ni señales. Se registra la adaptación de alcance explícitamente. Allowlist ampliada solo con `components/Analytics.tsx`, `lib/cookie-consent.ts` y nuevo `components/Analytics.consent-cookie.test.tsx`. Deben leer exactamente el nombre y el valor completo, conservar default denied, cuatro señales, rutas privadas, fallback y off. No se autoriza refactor general ni cambio en cuentas. La CSP no se amplía por este hallazgo.

Se exigen RED conservado, GREEN en ambos motores, prueba del script inline real para detectar escapes rotos, parser compartido y controles válidos; nombres prefijados/sufijados, valores inválidos y cookies ajenas con el patrón como valor no pueden otorgar consentimiento. Ambigüedades de cookies duplicadas deben explicarse sin prometer una migración de cookies no implementada. No se afirma fuga, cumplimiento jurídico ni recepción remota.

## Revisión local antes del canónico

Director leyó el diff: init y helper comparan nombre/valor completos y exigen una única cookie visible de ese nombre. Duplicadas se tratan como sin decisión (helper null, init denied), incluso si ambas conceden; no se borran cookies de otros ámbitos. Se exige registrar la limitación de persistencia y demostrarla con distintos paths en navegador. IDs, modelo v2, UI, eventos, exclusiones y apagado conservados. next.config.ts no cambia.

Focales PASÓ 267/267, ocho archivos, incluidos quince contratos nuevos del script inline real y parser. Director revisó el test que ejecuta el JS emitido y compara las cuatro señales antes del primer config.

Primera E2E tras el arreglo: 16 WebKit PASÓ, dieciséis Chromium FALLÓ porque la sonda negativa de navegación abortada confirmaba chrome-error tarde e interrumpía el goto local. Director leyó el error y la reparación acotada del ensayo: sonda en pestaña desechable, comprobación del aborto y cierre antes de navegar a producto. Se conservan los recibos iniciales, sin atribuir ese fallo al producto.

Recheck íntegro PASÓ 32/32 (26,9 s), cero retries/skips/flaky. Director leyó el JSON y adjuntos: Chromium y WebKit, cookies inválidas/ajenas/duplicadas por path, cuatro señales, orden consent/config, loader tardío, page_view inicial y SPA, conversión/lead sintéticos, carga privada/query/hash excluidas y transición SPA sensible sin señales.

Release completo retenido con GAoff PASÓ. HTTP de la home entrega CSP sin unsafe-eval y conserva media/WSS/object/base/form/framing. En ambos motores la CSP de fixture activa coincide exactamente con la cabecera release. Escaneo observado: 218 chunks, cero archivos con IDs reales de GA/Ads. Fixture activa usa fuentes copiadas byte a byte y script de Google inerte; ninguna recepción remota se prueba.

Probes CSP: catorce recursos clásicos permitidos (script/connect/img), cuatro recursos adicionales bloqueados y frame GTM bloqueado, con securitypolicyviolation correspondiente. Demuestran capacidades y restricciones del navegador; no demuestran que la app necesite los recursos adicionales. No se justifica ampliar CSP, activar unsafe-eval o añadir servicios del reporte sin uso demostrado. Barreras: ocho probes Node y dos proxy HTTP/CONNECT bloqueados, sonda navegador por caso; cero intentos inesperados Node/proxy/browser en el recheck. Son controles de ensayo, no sandbox universal del SO.

## Incidencia del entorno y reinicio del canónico

Primera corrida general: harness PASÓ 237/237 (113,65 s). ESLint recorrió los builds/fixture propios bajo .codex/qa, carpeta ignorada por Git pero no por ESLint; produjo 2.890 errores y 38.045 advertencias de código generado. Director comprobó el log. La ubicación que se había elegido para conservar el build fue insuficiente para aislarlo del gate. No se modifica ESLint, su alcance ni los verificadores.

Director autorizó detener exclusivamente el árbol del runner propio tras revalidar identidad, preservar el primer resultado y repetir el canónico una vez con el entorno reparado. La primera comprobación de PIDs detectó que ESLint ya había terminado y no ejecutó el corte. Worker revalidó runner 27216 → verify 2680 → tsc 26628, todos propios, y terminó solo ese árbol. Primer resultado: FALLÓ lint sobre derivados más INCOMPLETO/interrumpido durante tipos; no hubo suite general ni build canónico completo. Recibo y procesos conservados en .codex/qa.

Se movieron únicamente ads-release y ads-fixture, con rutas verificadas, al temporal propio `C:/Users/AKX generator/AppData/Local/Temp/dtd-0581-qa-cf340175276544b184f596b2ea052d9a`, sin borrado. Manifest conserva 5.661 entradas de release y 112 de fixture, incluidos dos links Next registrados sin dereferenciar. tsconfig sin diff, guard OK y puertos libres. El runner verify rechaza esos derivados en el árbol antes de ejecutar el gate. Lint focal de cinco fuentes propias PASÓ sin errores ni warnings. Segundo canónico independiente iniciado, sin extractores ni suites paralelas.

## Pendiente CSP específico

La documentación oficial de Consent Mode (`https://developers.google.com/tag-platform/security/concepts/consent-mode`, actualizada 2026-07-30) menciona pagead2.googlesyndication.com como dominio alterno para evitar cookies de terceros con ad_storage denied. Este modo sí está configurado; su bloqueo local connect/img está demostrado. Por tanto se registra como sospecha específica plausible de pérdida de señales, no como capacidad genérica inútil. El loader inerte no demuestra cuál endpoint elige hoy el tag de esta propiedad. Bajo el umbral P3 de solicitud/iniciador real, falta una traza controlada antes de abrir ese host. No se afirma que CSP completa esté correcta ni que Ads funcione sin incidencia; la corrección local de consentimiento y esa validación remota son resultados distintos.

## Segundo canónico: resultados observados

Director leyó el resumen: **12/17 pasos ejecutados, todos PASÓ; cierre INCOMPLETO por cinco críticos omitidos**, aunque verify devuelve exit 0. Harness 237/237; lint cero errores/quince warnings históricos; RSC 1.706 módulos y tipos PASÓ. Suite general PASÓ en primera pasada: 861 archivos aprobados, uno omitido; 12.294 pruebas aprobadas, una omitida; 593,78 s, sin retry. El corpus comercial ausente es la omisión, sin abrir documentos privados. Docs, numeración, constantes, componentes, gobernanza y símbolos pendientes PASÓ. Build completo de release con postbuild PASÓ.

Omisiones explícitas: Edge, ledger productivo, SQL, reconstrucción de esquema y E2E global. No se presenta el E2E focal 32/32 como sustituto de toda la cobertura general. No se consultó producción para forzar verde ni se modificaron verificadores.

La envoltura offline original del segundo canónico terminó exit 1 porque sus controles registraron tres denegaciones Git genéricas. El código existente de scripts/check-migrations-applied.test.mjs ejecuta gate con fetch doble y GIT_DIR inexistente en gate-migraciones-0548-*; Director leyó ese contrato. El log original de tres PIDs no contiene contexto suficiente para atribuirlos directamente. Se conserva y solo se autoriza una reproducción focal posterior con clasificación estricta del fixture; la denegación debe mantenerse, nunca permiso de red ni whitelist por contador/PID. Ningún nuevo canónico/suite general por cambiar esa clasificación del auxiliar.

Fuente de medición: conversion Ads se dispara al clic efectivo WhatsApp con valor fijo 1.0/USD. Es un valor configurado, no ingresos comprobados. whatsapp_click y generate_lead son señales diferentes; no se verifica su contabilización, carácter primario, importaciones o deduplicación en las cuentas, ni ventas o ROAS.

Fetch final sin prune PASÓ; principal y origin/main siguen d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8, con los dos untracked iniciales intactos. knowledge:status final de principal iniciado, sin publicación ni extracción.

## Revisión inmutable de implementación

**SHA revisado y aceptado localmente: c5a4f253aca4554ed43174fffd9667b3eef8d7e2**, base d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8. Árbol limpio y quince archivos exactos de allowlist. Director leyó producto, contratos nuevos, E2E, fixture, runner, spec/QA/handoff y el delta completo del guard frente a su fuente 0580 ya revisada. Diff-check PASÓ. No hay cambios en next.config.ts, IDs, definición/valor de conversiones, modelos de consentimiento, rutas o backend; sin observaciones bloqueantes en el código de este alcance.

Director leyó también el resumen raw de la suite general (861 archivos, 12.294 pruebas), doce OK del canónico y JSON de E2E/adjuntos (32/32, 218 chunks, cero IDs, CSP fixture igual a release). Reproducción focal posterior de ledger PASÓ 36/36: tres denegaciones esperadas y cero inesperadas. La clasificación del guard comprueba raíz temporal real exacta, GIT_DIR inexistente concreto y argumentos precisos; llama deny y lanza DTD_OFFLINE_DENIED antes de ejecutar Git. Cinco controles del caso válido/cuatro contextos rechazados respaldan el límite. No se reetiqueta el raw original de tres PIDs ni se repite canónico después.

knowledge:status final de principal PASÓ: ok true, estructura CURRENT, semántica PENDING, Archify CURRENT, archivos Obsidian CURRENT, revisión d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8. Esta sesión solo observa esos derivados. No se publica ni se abre la bóveda compartida.

Estado de la rama de coordinación observado sobre 9ad05aa21f22b2f5502e386473208d24651f7eee, con este handoff propio aún sin commit: ok false, estructura y semántica INVALID, Archify y Obsidian PENDING. Es deuda declarada de sus derivados locales, no estado de main ni certificado del Worker. Este documento guarda evidencia y decisiones autorizadas; no añade reglas al proyecto ni publica conocimiento compartido.

## Regresión de descubrimiento detectada antes de entregar

El Worker comprobó posteriormente que la configuración general Playwright descubre todos los .spec.ts de e2e. RED de solo descubrimiento, sin ejecutar servidores/tests: incluye 48 casos offline nuevos (dieciséis por sus tres proyectos), que dependen de dos servidores y guard aislados preparados por el runner propio. Faltaba validar esa integración antes de aceptar el harness completo; el código de consentimiento de c5 mantiene su aceptación local, pero se requiere reparar esta regresión propia.

Director amplía allowlist para reemplazar `e2e/analytics-csp-offline.spec.ts` por `e2e/analytics-csp-offline.offline.ts` y ajustar únicamente el testMatch de `playwright.analytics-csp-offline.config.ts`, más referencias documentales propias. Debe conservar contenido/aserciones por hash (R100), demostrar general cero casos de este archivo y configuración propia 32. Sin editar config general, agregar skips, cambiar producto ni repetir suite global/canónico. La ejecución previa 32/32 corresponde a ese mismo contenido; la nueva ruta/selección se revisará en su nuevo SHA.

La secuencia de conocimiento ya había importado semántica y ejecutado Archify sobre c5 al descubrir el problema. Se conserva ese recibo histórico, se permite terminar la escritura atómica de preview y se refrescarán únicamente los derivados invalidados por la corrección estructural. Esta repetición responde a un cambio real de harness, no a perseguir el hash del último handoff.

Pendientes de esa instantánea: reparación/discovery GREEN, revisión del delta y SHA, conocimiento por capas, documento final, cierre de claim/procesos propios y commit/release de coordinación. Estado de integración y producción sigue separado, sin autorización.

## Recibos de conocimiento previos al ajuste de descubrimiento

Director leyó los recibos de la instantánea c5a4f253: importación semántica APPLIED del README de marketing, quince nodos y catorce relaciones, un documento verificado de 1.325; piloto uno de dieciséis, ambos PENDING. No es cobertura semántica completa. Cluster posterior ejecutado. Archify 2.16.0 build y check PASÓ, nueve checks y once fuentes, estado CURRENT. Preview local PASÓ, 1.324 documentos, cuarenta y tres advertencias históricas de enlaces y cero conflictos. Status observado: ok false, estructura CURRENT, semántica PENDING, Archify CURRENT y Obsidian PREVIEW. No se publicó ni abrió la bóveda compartida.

Estos recibos preceden al cambio real de ruta/configuración de pruebas. Se conservarán como evidencia fechada, sin atribuirlos automáticamente al SHA posterior. Director confirmó también el RED de descubrimiento: cuarenta y ocho casos de este ensayo en la configuración general, sin errores de carga ni ejecución de tests.

## Aceptación inmutable del ajuste del ensayo

Director revisó **bfc36c37b8e42024043c19859718a8cd424963a3**: árbol limpio y cinco paths exactos frente a c5 (rename R100, testMatch propio y tres documentos). El blob Git antes/después es `6038fd53c61437ccad4bfb1644c371d7ce0f65ac`; SHA-256 del contenido `ac1dc645708f0a356ce66db8fad3f1e9d4c490fbc94e30f51c903d17a67160a3`. No se cambian producto, configuración general ni aserciones. Diff-check PASÓ sobre el rango completo de quince archivos frente a main base.

Director contó directamente los JSON de descubrimiento GREEN: configuración general 198 casos totales / cero propios; configuración aislada 32 propios, dieciséis Chromium y dieciséis WebKit. Cero errores de carga y registros de red vacíos en ambos. La ejecución 32/32 previa sigue referida al contenido idéntico; no se repitió suite general ni canónico. Un comando previo de listado no cargó el preload por separadores de ruta Windows; su error se conserva y no se cuenta como ejecución de tests.

**Aceptación local concedida para producto y harness sobre bfc36c37.** Quedan el refresco de derivados por este cambio real, handoff final y cierre de procesos/claims. Commits posteriores únicamente documentales se revisarán como tales. Aceptación local no autoriza integración, publicación ni cuentas.

## Preservación comprobada al cierre

Principal y origin/main siguen en d410ab2e23e74e5bcf7fdc7cc595371b24cc03a8. Los dos untracked iniciales (.pnpm-store y PDF DPA) siguen presentes, sin abrir el PDF ni incorporarlos a Git. Seguimiento 0579 conserva HEAD d069b5b26df962b25f6476bfd7c3c626c4764be2, árbol limpio y claim ausente. Móvil 0580 conserva HEAD c2a933aac5ad8bc6ce3b8d78688e2dcaae9dc780, árbol limpio y claim ausente. Ninguna rama/worktree se elimina o integra; no hay push, PR, merge, despliegue ni cambios de cuentas en este encargo.

## Cierre definitivo revisado

**HEAD final Worker: 6e3bbfbe560e97ec216d43788062b490c3cd6bd1**, rama codex/0581-medicion-ads-csp-offline, conservada localmente. Director leyó el delta completo bfc..6e3: únicamente spec, índice regenerado, QA y handoff, 70 inserciones/14 eliminaciones. Spec pasa a done y el índice refleja ese estado. Diff-check PASÓ. Producto, assets de ensayo, configuración y cuerpo E2E permanecen idénticos a la revisión aceptada bfc. Worker informó docs:index check y numeración PASÓ; no se repitió suite general ni canónico.

Director leyó los recibos bfc: Graphify 0.9.61 record marcado recorded, estructura CURRENT y cero issues, 43.794 nodos/79.875 aristas; semántica PENDING con piloto 1/16 y global 1/1.325. Archify 2.16.0 build/check PASÓ/CURRENT con nueve checks y once fuentes. Preview PASÓ con 1.324 documentos, cuarenta y tres warnings históricos y cero conflictos. Destino comprobado dentro del worktree, graphify-out/obsidian-preview; el campo published de esa orden se refiere a escribir esa preview local, no a la bóveda compartida. Status observado ok false por cobertura semántica pendiente. El último commit de cuatro documentos es posterior a los recibos bfc: revisiones/hashes afectados pendientes, declarados sin repetir derivados para perseguir su propio cierre.

Director leyó ads-final-state.json: HEAD 6e3, árbol limpio, next.config.ts y tsconfig intactos, solo .env.example, secuencia local de conocimiento terminada exit 0, ningún proceso propio y ningún listener de pruebas. Tras release del Worker, Director comprobó por separado archivo claim ausente y puertos 45811/45812 libres. Fetch origin --no-prune final PASÓ; principal y origin/main siguen d410ab2e2 con los dos untracked preexistentes preservados. No existe ref remota origin/codex/0581-medicion-ads-csp-offline.

**Entrega local aceptada y terminada.** Canónico sigue INCOMPLETO por cinco omisiones; primer intento interrumpido y envoltura original exit 1 se conservan, con rechecks acotados ya descritos. No hay cambios locales de producto/harness pendientes de esta tarea. Permanecen fuera de alcance la traza del tag real para pagead2, recepción/atribución/acciones en cuentas y cualquier integración o producción. Se conservan rama, worktree, recibos y builds propios, sin respaldo remoto por instrucción de Sam.

Evidencia durable Worker: docs/marketing/diagnostico-medicion-ads-2026-10-23.md; docs/qa/0581-medicion-ads-csp-offline.md; .agents/handoffs/0581-medicion-ads-csp-offline.md. Este documento de coordinación se commitea selectivamente tras guard del owner director-ads-20261023; se verifica árbol limpio y se libera ese claim como última acción escritora. Sus derivados locales conservan la deuda declarada arriba; no se modifica main ni se publica la bóveda compartida.
