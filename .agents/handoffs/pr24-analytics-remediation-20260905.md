# Worker · PR24 / SDD-0371 · remediación de Analytics

Fecha: 2026-09-05
Estado: lista-para-revision; remediación validada localmente, dos omisiones explícitas
Task: pr24-analytics-remediation-20260905
Owner / sesión: 01a073a6-f21d-7483-9b74-4d9f3464c295
Director: 01a073cc-1278-7422-81da-9f85c2fff047
Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pr24-analytics-remediation-20260905
Rama: codex/pr24-analytics-remediation-20260905
Base: 74bb52ab9677f96908cc032a15f2364ab9d94716
Fuente PR24: 545af5756d61c1da27b6b86336e12f90a2459fd3
SDD: docs/specs/0371-analytics-access-boundary/spec.md

## OBJETIVO ORIGINAL

Combinar PR24 con main preservando historia y corregir la decodificación que permite credenciales anidadas cuando un valor de atribución mezcla escapes válidos y porcentajes malformados. Mantener campañas públicas legítimas, bloquear rutas/URLs sensibles y entregar evidencia rojo a verde con revisión posterior independiente.

## COMPLETADO

- Worktree nuevo creado por harness start desde main; claim y guard del owner verificados antes de editar. A/D/B liberados y árboles ajenos preservados.
- Merge local del HEAD publicado; único conflicto en docs/specs/README.md resuelto con generador. No se cambia la rama publicada codex/analytics-privacy.
- Un único bypass reproducido: id_token%253DSYNTHETIC seguido de %25ZZ o %25 dentro de parámetros permitidos.
- decodeForInspection escapa porcentajes literales sólo en la copia de inspección y decodifica los escapes válidos vecinos. Ante UTF-8 inválido, fragmento malformado o exceso de capas falla cerrado. No reescribe valores de atribución permitidos.
- sanitizeSearch descarta también valores que anidan credenciales; el gate principal sigue excluyendo la vista completa.
- Regresiones de las nueve claves, carga inicial, push/replace, helpers y regreso a público. Controles positivos de campaña, Unicode, porcentajes y click IDs.
- SDD, marketing e inventario de terceros actualizados con límites de evidencia. La SDD sigue in-progress hasta la clasificación de omisiones por Director; publicación e integración se registran por separado.
- Revisión independiente favorable sobre el SHA de código 7d13021224292b4b6379ebdd2f4e9d34b9273166: P1 corregido, 183 casos propios del auditor y ningún nuevo bloqueante demostrado.
- Gate canónico terminado sobre ese mismo SHA: 14/16 pasos reales, sin fallos ni reintentos. Código y tests intactos después de la revisión; este cierre añade sólo evidencia documental.

## Alcance y autorización

Ocho paths de PR24 más este handoff: components/Analytics.tsx, components/Analytics.test.tsx, __tests__/analytics.test.ts, spec0371, docs/specs/README.md generado, docs/marketing/README.md, docs/legal/privacidad/inventario-terceros.md, .agents/handoffs/2026-09-04-analytics-privacy-close.md.

Autorizados: worktree nuevo, merge local, instalación congelada, implementación focal, pruebas y commits locales selectivos. Sin push, merge main, despliegue, datos reales, secretos, DB ni cleanup. Se conservan las mejoras de main y la procedencia de ambos padres.

## VALIDACIÓN

| Comprobación | Estado | Evidencia |
|---|---|---|
| pnpm install --frozen-lockfile | PASÓ | 813 paquetes; lockfile sin cambios. |
| Componente antes de RED | PASÓ | git diff --exit-code 545af575... -- components/Analytics.tsx; blob original intacto. |
| Vitest focal antes de corregir | FALLÓ esperado | 95 fallos / 120 pases en 215 pruebas; variantes de un hallazgo, no 95 vulnerabilidades. |
| Vitest focal después de corregir | PASÓ | 215/215, dos archivos, 5.33 s. |
| Edge sintético con React y next/script real | PASÓ | 20 escenarios; ninguna solicitud llega a Google; sin errores de página. |
| ESLint focal de los tres archivos | PASÓ | Sin errores ni warnings. |
| docs:index / docs:check / numbering | PASÓ | 311 specs; 398 migraciones; excepciones históricas existentes conservadas. |
| pnpm verify de la combinación | PASÓ con omisiones | Exit 0; 14/16 pasos medidos, sin fallos. No equivale a verde completo. |
| Harness / lint / RSC / TypeScript / Edge | PASÓ | 12 pruebas harness; lint 0 errores y 8 warnings históricos; 1586 módulos RSC; tsc; 4 funciones con Deno 2.9.6. |
| Vitest completo | PASÓ | 6359/6359 pruebas en 502 archivos; 974.64 s; sin reintentos. Incluye las 215 focales. |
| Documentación / numeración / constantes / componentes / gobernanza | PASÓ | Cinco gates canónicos sin fallos. |
| SQL / schema-rebuild | PASÓ | 139 contratos con rollback total; 380 migraciones desde cero, 18 sólo-ledger y aislamiento de 219 tablas. Contenedores locales efímeros. |
| Build + postbuild | PASÓ | Compilación, tipos, prerender y Norte; tsconfig restaurado, .next-verify eliminada por runner. |
| Ledger Cloud | NO EJECUTADO — SKIP | Fuera del alcance; sin NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. No se copian ni usan credenciales. |
| E2E general Playwright | NO DISPONIBLE — SKIP | Navegadores gestionados ausentes. Los 20 escenarios focales de Edge no se presentan como esta suite. |
| Revisión independiente del SHA 7d130212 | PASÓ en alcance focal | 129 casos de detector/sanitizador + 54 React/jsdom propios del auditor; no hereda los 215/20 del Worker ni aprueba merge/release. |

Comando focal: node node_modules/vitest/vitest.mjs run __tests__/analytics.test.ts components/Analytics.test.tsx.

Evidencia externa, preservada en C:/Users/AKX generator/AppData/Local/Temp/:

- dtd-pr24-install.log
- dtd-pr24-red-tests.log y dtd-pr24-green-tests.log
- dtd-pr24-browser.cjs, dtd-pr24-browser.log y dtd-pr24-browser/result.json
- dtd-pr24-verify.cjs, dtd-pr24-verify.log y dtd-pr24-verify-result.json
- Informe fuente: DTD-PR24-auditoria-independiente-20260905.md, preparado por el auditor; no se copia íntegro al repo.

Corrida canónica: 2026-09-05 22:39:38 a 23:10:20 America/Caracas (02:39:38.569Z a 03:10:20.106Z del 2026-09-06). Sesión exec 48093 cerrada; NODE_OPTIONS=--max-old-space-size=4096 y VITEST_MAX_WORKERS=2. Sin .env local ni credenciales en el entorno hijo. Docker se recuperó antes de recibir el turno: el SKIP previsto se retiró y ambos gates SQL se midieron realmente. Slot pesado liberado al Director al terminar.

Huellas SHA-256 de evidencia final:

- dtd-pr24-verify.log: 1a797cca0fa8fa543659801d8ebfc0c213cf8f4fecf5cdf7148905f5b7946138
- dtd-pr24-verify-result.json: 97f00b573520afb6642941869b980ec574c78f36b0dcad46cb60b4a587a30432
- Informe independiente: C:/Users/AKX generator/Desktop/Developer/DTD-backups/director-goal-20260905/DTD-PR24-revalidacion-7d130212-20260905.md; SHA-256 95f7b9bffc063d48f281959a004c43e6aadffb149aa14e4e45f4026108e05b7f.

El navegador usa hooks Next adaptados a History en un fixture local y next/script instalado real; el loader se responde con JavaScript inerte mediante intercepción. Dieciocho cargas sensibles no montan tags. Dos recorridos validan un page_view inicial sin gtag preinstalado, carga tardía con ambos destinos desactivados (ga-disable-* = true), observadores antes/después, regreso público, hashchange/popstate y señales legítimas. No es una prueba del proveedor Google ni un E2E de la aplicación Next completa.

Incidencias de preparación: el primer merge se detuvo por falta de identidad Git antes de modificar producto; se usó identidad Codex por comando sin configuración global. Una invocación temprana de pnpm test abrió un preflight de instalación mientras aún se preparaban dependencias y se interrumpió; no produjo evidencia RED. La reproducción válida se ejecutó después de terminar la instalación, mediante el entry de Vitest. dtd-pr24-red.log conserva ese intento de preparación, separado del RED causal.

## Revisión técnica acotada de datos · revisar-datos-ve

Inventario del delta de transporte:

| Campo | Finalidad | Destinatario | Base / retención |
|---|---|---|---|
| page_path / page_location | Atribución pública y navegación | GA4 | Contratos/retención externos NO VERIFICABLES; código en components/Analytics.tsx:275. |
| page_title | Título de la vista pública | GA4 | Igual límite; components/Analytics.tsx:282. |
| conversion / whatsapp_click | Contacto de captación | Ads / GA4 | Valores mínimos de evento; components/Analytics.tsx:342. |
| generate_lead.lead_method | Método de captación | GA4 | No contenido de formulario; components/Analytics.tsx:374. |

- ENCONTRADO: un bypass en el catch del HEAD original components/Analytics.tsx:164, reproducido con marcadores sintéticos. No demuestra fuga real a Google.
- CORRECTO: inspección de escapes mixtos en components/Analytics.tsx:155 y rechazo defensivo del sanitizador en components/Analytics.tsx:110; regresiones causales verdes.
- CORRECTO: guard previo y helpers siguen bloqueando URLs sensibles; positivo público/Unicode/porcentaje conserva el valor original y señales.
- NO VERIFICABLE: configuración/retención/contratos de Google, efectos internos de scripts reales de terceros, tratamiento territorial y borrados históricos. No se revisaron datos de negocio.

Alcance limitado a minimización y salida hacia terceros del cambio asignado; no es auditoría integral de los doce puntos ni certificación de cumplimiento. Consentimiento, almacenamiento, migraciones, identidad y captura no cambian. Esta revisión técnica no es asesoría legal. La revalidación independiente de 7d130212 es favorable en el alcance descrito; no certifica al proveedor ni autoriza integración.

## COMMITS

- 7d13021224292b4b6379ebdd2f4e9d34b9273166: merge local con padres main74bb52ab y PR24 545af575; corrección y evidencia focal. SHA de producto revisado y medido por el gate.
- Commit de cierre que contiene esta versión del documento: sólo handoff y evidencia de SDD-0371; no cambia código ni tests. SHA final comunicado al Director para revisión del delta documental, sin recursión de commits.

## PR / BRANCH

PR fuente: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/24. Rama nueva sólo local: codex/pr24-analytics-remediation-20260905. No publicación autorizada.

## PENDIENTES DE ESTA TAREA

Implementación, pruebas locales disponibles y revalidación independiente focal terminadas. Director debe revisar el delta documental y clasificar las omisiones del gate (E2E general no disponible; ledger Cloud fuera de alcance) antes de aprobar integración. Continuación asignada al recibir el resultado: preparar Chromium de la versión Playwright fijada, inspeccionar entorno E2E local/sintético y entregar comando seguro; no iniciar E2E/build pesado mientras #30 ocupa verify. No cambiar package/lock, usar producción ni ejecutar seed remoto. La SDD conserva in-progress; no se transforma exit 0 en aprobación global. Publicación, CI alojada, base/SHA vigente, merge y release conservan sus gates y permisos separados.

## FUERA DE ALCANCE DETECTADO

Operación interna/retención de Google no verificables con fixtures. Los ocho warnings de lint son históricos y no afectan archivos del delta de remediación. El diagnóstico global de Docker corresponde al Director; su recuperación permitió pruebas efímeras, sin reparación del daemon por este Worker. Los otros nueve PR siguen su coordinación propia.

## HANDOFF AL DIRECTOR

Producto revisado y validado en 7d130212; evidencia final lista para revisión por delta documental. Slot pesado liberado. Claim retenido para la continuación E2E asignada, hasta terminar sus escrituras; no borrar ni reutilizar el worktree. Director conserva ownership de clasificación de omisiones, revisión e integración. El informe independiente permanece enlazado; esta entrega no se autocertifica independiente.
