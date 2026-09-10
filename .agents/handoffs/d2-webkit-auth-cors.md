DICTAMEN PARCIAL: HTTPS REAL PASA CORS EN AMBOS MOTORES; con el puerto local cerrado se reproduce la firma por fallo de transporte del preflight. El mecanismo exacto de H2 histórico sigue INCONCLUSO: no se conserva respuesta Auth de WebKit.

# d2-webkit-auth-cors

- Fecha de apertura: 2026-09-10.
- Owner/sesión escritora: `codex-d2-webkit-auth-cors-20260910`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/d2-webkit-auth-cors`.
- Rama: `codex/d2-webkit-auth-cors`.
- Base verificada: `710a8e0695f416700d75e7bc42e8e5cb889751e8`.
- Estado: revisión parcial; aceptación 2 pendiente. No declarar tarea completada.
- SDD: no aplica a la determinación; no reservar número. Un defecto real exige otra tarea del Director.
- Objetivo: determinar si H2 (`/auth/v1/user` rechazado por WebKit) afecta Safari móvil contra Supabase HTTPS real o es una limitación local; comprobar la relación con el `beforeEach` >90 s.
- Aceptación: matriz WebKit/iPhone 14 y Chromium/Pixel 7 contra 127.0.0.1:55431, localhost y HTTPS real; salida cruda, mecanismo concreto, dictamen y documentación; relación temporal del hook; instalación congelada y verify con límites explícitos.
- Alcance: sonda y artefactos de diagnóstico, `e2e/README.md`, este handoff y documentación del dictamen.
- Excluido: producto, `lib/db/client.ts`, `playwright.config.ts`, `supabase/**`, cutoff/baseline/ruleset, producción autenticada, filas reales, escrituras de datos, copia de secretos, numeración SDD.
- Dependencias: ninguna declarada; D1 trabaja `/m/erp` en otro worktree. Subagente de lectura asignado a recibos y tiempos; no hay solapamiento escritor.
- Permisos: instalación congelada, diagnóstico anónimo `GET /auth/v1/user` con anon key pública, commits selectivos, push de esta rama a sí misma, PR draft contra main. Sin merge/deploy/cleanup.
- Preflight: árbol inicialmente limpio, linked worktree y rama/base correctos; guard PASÓ; procesos vinculados observados corresponden a la sesión Codex; claim exclusivo adquirido.
- Último resultado: dos matrices nativas completas y controles, primarios E/H extraídos, verify 15/17 sin fallos medidos; servicio auxiliar cerrado.
- Siguiente paso: Director revisa evidencia parcial y decide autorización adicional para reproducir fielmente el flujo histórico autenticado local, sin producción.

## OBJETIVO ORIGINAL

Determinar si H2 afecta a Safari móvil contra Supabase real HTTPS o es limitación local, nombrar su mecanismo y comprobar relación con beforeEach >90 s. Es una determinación, sin arreglo ni SDD nuevo.

## COMPLETADO

[Dictamen completo](../../docs/qa/d2-webkit-auth-cors.md): se midió CORS anónimo real, la disponibilidad local, el servicio local por transporte auxiliar y se separaron E/H con primarios y hashes. README actualizado junto a la nota de HMR. No se modificó producto ni se silencian errores genéricos.

Cada matriz usa los proyectos configurados mobile-chrome/Pixel 7 y mobile-safari/iPhone 14, contexto limpio, fetch nativo sin intercepción, anon key y sin cuerpos/sesión. Dos perfiles: `apikey-only` y forma SDK con Bearer anon y nombres de cabeceras reales. Los 403 de este último son respuestas visibles; no se atribuye su causa porque no se leyó el cuerpo.

### Matriz completa principal

Documento `http://localhost:56712`, perfil `apikey-only`:

| Navegador | Supabase 127.0.0.1:55431 directo | Supabase localhost:55431 directo | Supabase real HTTPS |
|---|---|---|---|
| mobile-chrome | NO DISPONIBLE: conexión rechazada, TypeError | NO DISPONIBLE: conexión rechazada, TypeError | PASÓ CORS: 401 / 1067,3 ms |
| mobile-safari | NO DISPONIBLE: conexión rechazada, Load failed | NO DISPONIBLE: conexión rechazada, Load failed | PASÓ CORS: 401 / 708 ms |

[Salida cruda 04](../../docs/qa/assets/d2-webkit-auth-cors/04-matrix-native-direct.json): 28 filas, incluidos documento IP, ambos perfiles y origen HTTPS sintético. Los 12 casos HTTPS resuelven; 16 locales fallan por transporte. No hay respuesta local para evaluar cabeceras.

Documento `http://localhost:50117`, servicio existente accesible por transporte diagnóstico loopback:

| Navegador | Supabase 127.0.0.1:55431 vía sonda | Supabase localhost:55431 vía sonda | Supabase real HTTPS |
|---|---|---|---|
| mobile-chrome | PASÓ CORS: 401 / 6260,5 ms | PASÓ CORS: 401 / 6706,4 ms | PASÓ CORS: 401 / 605,6 ms |
| mobile-safari | PASÓ CORS: 401 / 6365 ms | PASÓ CORS: 401 / 6392 ms | PASÓ CORS: 401 / 555 ms |

[Salida cruda 05](../../docs/qa/assets/d2-webkit-auth-cors/05-matrix-native-diagnostic-transport.json): 28/28 respuestas visibles; 14 × 401 y 14 × 403. También pasan ambos destinos locales desde documento IP. [Recibo del transporte](../../docs/qa/assets/d2-webkit-auth-cors/05-local-transport.json): 16 OPTIONS y 17 GET, incluido control previo de disponibilidad. Conserva Host/Origin/CORS, fuerza Connection close y no reproduce la publicación Docker de H ni mide rendimiento de producto.

Desde documento sintético `https://dtdcargo.com`, la matriz directa da 401/739,7 ms Chromium y 401/730 ms WebKit. No se cargó CSP, sesión ni service worker del producto. Seis controles por matriz PASARON: CORS permitido expone 401; faltar ACAO o autorización de la cabecera Authorization provoca TypeError e impide GET en ambos motores.

**Mecanismo medido:** no falta cabecera requerida en el servicio accesible. HTTPS refleja Origin en GET y autoriza nombres de cabeceras en OPTIONS; local responde ACAO `*`, válido con credentials omit. WebKit puede reclasificar error de transporte del preflight como AccessControl; ambos motores fallan al conectar con puerto cerrado, aunque sus mensajes difieren. Eso no demuestra la causa del H2 histórico.

**Comprobación 5 PASÓ:** E tenía un hook que solo registra addInitScript, previo a cargar producto. H completó el hook en 149,707 ms; los errores aparecen después durante goto de Studio a móvil. El bloqueo interno E sigue sin causa determinada y no equivale al cierre conocido de workers. [Primarios seleccionados con SHA256](../../docs/qa/assets/d2-webkit-auth-cors/03-historical-evidence.json).

## VALIDACIÓN

Base local/remota `710a8e0695f416700d75e7bc42e8e5cb889751e8`, producto sin cambios. El gate corrió mientras se preparaba documentación/sondas; las sondas finales se validaron focalmente después. [Salida del gate, espacios/EOL normalizados](../../docs/qa/assets/d2-webkit-auth-cors/08-verify-output.txt).

| Comprobación | Estado | Evidencia / límite |
|---|---|---|
| corepack pnpm install --frozen-lockfile | PASÓ | Node 24.20.0, Corepack 0.35.0, pnpm 12.3.4; 813 paquetes, lockfile intacto |
| Matrices nativas 04/05 | PASÓ ejecución | 28 filas + 6 controles cada una; 04 distingue servicio local no disponible de CORS |
| Extractor E/H | PASÓ | 5 primarios sellados, repetición byte a byte; sin bodies/cookies/keys |
| Sintaxis y lint focal de 3 sondas | PASÓ | node --check y ESLint explícito sin ignores: 0 errores / warnings; lint general ignora e2e/** |
| corepack pnpm verify con VERIFY_SKIP_E2E=1 | PASÓ lo ejecutado; CIERRE INCOMPLETO | exit 0, **15/17** pasos, no verde completo |
| harness | PASÓ | 18 tests Node |
| lint / rsc-boundary / typecheck | PASÓ | 8 warnings lint preexistentes, 0 errores |
| edge-functions | PASÓ | 4 funciones, chequeo estático |
| test | PASÓ | 6526 tests / 521 archivos |
| docs:check / numbering / feature-constants / components:check / governance:check | PASÓ | Docs revalidado tras cambios, sin SDD nuevo |
| pending-migration-symbols | PASÓ | 0 rojo / 0 amarillo |
| migrations-applied | **NO DISPONIBLE** | Sin credenciales; ledger real no consultado |
| sql-tests | PASÓ | 156 contratos con rollback en Postgres efímero |
| schema-rebuild | PASÓ | 396 migraciones desde cero + 18 solo-ledger; aislamiento en DB efímera |
| E2E general / Auth18 | **NO EJECUTADO** | VERIFY_SKIP_E2E=1 elegido explícitamente por alcance documental y protocolo anónimo; matrices independientes sí ejecutadas |
| build | PASÓ | Next 16.2.11 y postbuild completos; avisos por env Supabase ausente. Runner restauró tsconfig |
| diff --check / allowlist / guard | PASÓ | Revalidación antes de commit; ninguna ruta excluida modificada |
| Cierre transporte | PASÓ | Cero listeners y nc; siete servicios preexistentes conservados; postflight 06 |

Login, permisos/filas, journeys de portal y Safari físico: NO EJECUTADO. No aplican al cambio documental/sonda y exceden el método anónimo usado; unitarios/build/SQL no sustituyen esa cobertura. Los intentos 01/02 FALLARON como instrumento (intercepción y EOF prematuro de nc); se conservan descartados, no son fallos de producto.

## COMMITS

Commit que contiene este documento: diagnóstico, recibos y documentación. SHA final en PR para evitar autorreferencia.

## PR / BRANCH

`codex/d2-webkit-auth-cors` contra `main`, PR draft autorizado. Consultar la PR de esta rama para URL y SHA final. Sin merge ni deploy manual; los checks/previews del proveedor pueden dispararse por los archivos de sonda, sin modificar el pipeline.

## PENDIENTES DE ESTA TAREA

**Aceptación 2 no satisfecha:** falta adjudicar el mecanismo exacto de H2 y su clasificación definitiva. La traza H no conserva respuesta Auth de WebKit; mensaje genérico, coincidencia con navegación y matriz actual no llenan ese hueco. El diagnóstico anónimo real sí está medido.

Una nueva captura tendría que determinar si se emitió OPTIONS, qué respondió o por qué terminó, y su relación temporal con la navegación. Repetir fielmente el flujo histórico autenticado requiere autorización adicional al método sin sesión del encargo; sería exclusivamente local con fixtures, sin usuarios ni datos de producción. Un control sintético de cancelación tampoco demuestra por sí solo la causa de H. No pedir SDD ni implementar producto sin observar defecto real.

## FUERA DE ALCANCE DETECTADO

- H1 y cruce de layouts `/m/erp`: D1; no editados.
- Causa interna de inicialización WebKit E: distinta de H2, no determinada; no equivale al cierre conocido del worker.
- Kong no publicaba el puerto en red Internal. Sin cambios de plataforma/red; transporte diagnóstico ya cerrado.
- Ocho warnings lint preexistentes y avisos de build sin env: no corregidos.

## HANDOFF AL DIRECTOR

Revisar dictamen parcial y recibos válidos 03/04/05/06/07/08. El protocolo anónimo no reproduce rechazo HTTPS real; no se entrega arreglo. Decidir ampliación diagnóstica para aceptación 2. Publicación solo draft, sin integración ni numeración SDD.

Sin consumidores ni listeners auxiliares D2 pendientes; siete servicios compartidos preservados. Claim se libera al terminar escritura y publicación; verificar recibo de cierre de sesión antes de retomar. No borrar rama/worktree.
