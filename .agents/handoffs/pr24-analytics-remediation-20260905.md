# Worker · PR24 / SDD-0371 · remediación de Analytics

Fecha: 2026-09-05
Última actualización: 2026-09-06
Estado: lista-para-revision; remediación y 129 E2E validados, 39 E2E pendientes de entorno real
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
- Continuación E2E acotada sobre b787b6f: 129/129 casos aprobados en tres proyectos, un worker, un único intento por caso. Los 21 casos con configuración Supabase y los 18 autenticados no se incluyeron ni se presentan como aprobados.

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
| E2E general Playwright | NO EJECUTADO — SKIP del gate | Navegadores ausentes durante verify; instalados después en la continuación descrita abajo. Los 20 escenarios focales de Edge no se presentan como esta suite. |
| E2E acotado sin backend, posterior al gate | PASÓ | 129/129 en 11.0 min; 43 por proyecto; 129 intentos, 0 fallos, 0 flaky, 0 skips dentro de la selección. Quedan 39 fuera de esta corrida. |
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

## Preparación E2E · 2026-09-05, anterior a la corrida acotada

Director autorizó instalar los navegadores de la versión Playwright fijada y preparar los tres proyectos, conservando #30 el slot pesado. `pnpm exec playwright install chromium` y `pnpm exec playwright install webkit` terminaron exit 0 sin cambios de package/lockfile/config/tests. API de Playwright 1.60.0 y arranque headless de `about:blank` verificaron:

- Chromium 148.0.7778.96: C:/Users/AKX generator/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe.
- Headless Shell: C:/Users/AKX generator/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe.
- WebKit 26.4: C:/Users/AKX generator/AppData/Local/ms-playwright/webkit-2287/Playwright.exe.

La caché es compartida; se notificó a Director y owner #30. No se levantó Next ni se ejecutó E2E. La colección `--list` conserva 168 casos/14 archivos, 56 por proyecto (chromium, mobile-chrome, mobile-safari). Clasificación estática por código de 93df9bbe, no resultados PASS:

| Grupo | Lógicos | Tres proyectos | Requisito |
|---|---:|---:|---|
| Contratos públicos/negativos sin backend de negocio | 43 | 129 | Fallbacks reales, Analytics apagado en dev, piloto adjuntos apagado. |
| Rutas con URL/anon requerida para render sano | 7 | 21 | Configuración Supabase real efímera/local autorizada, sin claves ficticias. |
| Journeys autenticados | 6 | 18 | Entorno efímero, esquema, seed y usuarios sintéticos autorizados. |

Los siete con configuración son cuatro logins Studio/Back/Portal, global-search Tier 1, attachments network y smoke `/track` hasta `/entrar`. `proxy.ts:69-73` y `lib/db/server.ts:22-24` exigen URL/key; el SDK instalado rechazó sus ausencias sin hacer red. Los dos casos lógicos network y `/track` (seis ejecuciones) podrían no detectar un 500 por sus aserciones: no contarlos como auth válida con stub. Los seis autenticados están en comments-lifecycle (1), gastos-expense-void (2), global-search (2) y nomina-settlement-void (1).

Comandos preparados fuera del repo:

```powershell
# Ya ejecutado: colección segura, no inicia servidor.
& 'C:/Users/AKX generator/AppData/Local/Temp/dtd-pr24-e2e-ready.ps1'
# NO EJECUTADO: sólo con slot y fixture real preparado/autorizado.
& 'C:/Users/AKX generator/AppData/Local/Temp/dtd-pr24-e2e-ready.ps1' -Run
```

El runner conserva los tres proyectos y `--workers=1`, valida source/árbol/ausencia de .env/guard efímero real, usa localhost y puerto propio, no imprime variables y deja logs/traces en TEMP. Se comprobó que `-Run` falla antes de levantar Next si falta E2E_SUPABASE_PROJECT_REF. No crea entorno, claves, seed ni migraciones. El guard actual exige HTTPS+ref coincidente; Docker/Postgres por sí solo no habilita los tiers Supabase.

Informe completo y matriz por caso: C:/Users/AKX generator/AppData/Local/Temp/dtd-pr24-e2e-preparacion.md y dtd-pr24-e2e-matrix.csv/.json. CSV SHA-256: af5a9e3279d21831513d435daece227fac5b384cf5e94900a19aabedf185ab09. Evidencia de arranque: dtd-pr24-browser-preflight.json, SHA-256 75548561fc1b55f2010f10f413a012789c1be1d20c6d6a3be0d75790adfdc075. Logs de instalación: dtd-pr24-playwright-install.log y dtd-pr24-webkit-install.log. Ambos listados y el script quedan en TEMP; el informe detalla comandos del guard/seed previstos y no ejecutados.

Una adaptación completamente local pertenece a SDD-0440/#28: falta configuración/runtime Supabase local real, claves de esa instancia y soporte explícito en el guard, conservando rechazo de producción. Debe incluir GoTrue/PostgREST/DB, puertos propios, seed idempotente y dependencias #29→#28 para esquema y defaults de calculadora. La PR28 sigue en 80eea11e, verificada por gh; se leyó su spec/diff y no se integró. No se implementa esta ampliación dentro de PR24.

## E2E acotado ejecutado · cierre 2026-09-06

Director asignó el turno y autorizó ejecutar exclusivamente los 129 casos sin backend. SHA medido: b787b6f15762ee94a98150a7f49a3c4a1c2e546b; código idéntico a 7d130212. El árbol estaba limpio y el claim fue recuperado por el mismo owner.

Runner separado: C:/Users/AKX generator/AppData/Local/Temp/dtd-pr24-e2e-129-runner.cjs, copiado también al respaldo. No usa ni altera el guard del fixture autenticado. Expande 35 ubicaciones exactas archivo:línea a 43 casos lógicos; `--list` y comparación por proyecto/archivo/línea/título confirmaron los 129 de la matriz antes del arranque. Tres proyectos originales, `--workers=1` y el único retry local ya definido en config (no se necesitó). No cambió config, test, producto ni aserciones.

Entorno hijo sin credenciales ni valores Supabase ficticios; NODE_ENV=development, NEXT_PUBLIC_GA_ID vacío, DTD_ATTACHMENTS_GASTOS_PILOT=0. Next dev --webpack propio en http://localhost:3715. Sesión exec 19058; PID Playwright 15708. Inicio 2026-09-05 23:56:43 America/Caracas; cierre 2026-09-06 00:07:45 (03:56:43.488Z a 04:07:45.025Z). JSON: 659701.441 ms; exit 0; errors=[]; expected=129, unexpected=0, flaky=0, skipped=0. Cada resultado tiene status=passed y retry=0: 129 intentos totales. Chromium, mobile-chrome y mobile-safari aportan 43 casos cada uno. No se declara cubierta la suite de 168.

Comparación solicitada con #30: CBM y toggle de calculadora-hidratacion.spec.ts:42/61 pasaron al primer intento en los tres proyectos. En mobile-chrome tardaron 5858/6528 ms; desktop 6120/6600 ms; WebKit 7830/10130 ms. Los dos fallos reportados por #30 con 11 workers no se reprodujeron aquí. Esto no demuestra por sí solo que la concurrencia sea la causa; haría falta comparar su SHA y entorno. No hubo un bug ajeno reproducido que absorber en PR24.

Respaldo persistente completo, fuera de TEMP:
C:/Users/AKX generator/Desktop/Developer/DTD-backups/pr24-e2e-129-20260906T035639378Z/.

- playwright.json: reporte completo; SHA-256 b736c57f00c292da7635b97f7ed53adb2a737cd5864426ccd311c96de7d59830.
- stdout.log: salida completa, incluidos avisos de fuentes/timeouts y fallbacks por ausencia de Supabase; SHA-256 a19b229567711b28a95045ad371128cc35ae904e0a20cb765affa20b26f0f36e.
- validated-summary.json: resumen contrastado con los 129 resultados; SHA-256 5728e48935c478e76f770562e4d17452c1914ae4fe80005eff18b2cb5f4bc6b6.
- metadata.json, selected-cases.json, preflight-list.log, runner.cjs y result.json conservan selección, comando, SHA, entorno declarado, tiempos y salida.
- test-results/ queda preservado. No hubo trazas de fallo: la política vigente es on-first-retry y ningún caso falló ni reintentó. No se borró evidencia entre pasos.

Playwright/WebKit cerraron normalmente. No quedó lock Next ni listener del puerto; un bind local verificó 3715 libre. El árbol siguió limpio, sin modificación de tsconfig.json, package/lockfile o tests. Slot pesado liberado al Director antes del cierre documental. No se repite verify completo por cambios de evidencia.

Pendiente real: los otros 39 E2E (21 con configuración y 18 autenticados), el ledger productivo fuera de alcance y la clasificación de integración del Director. Los 129 pasan como selección autorizada; no convierten retrospectivamente el gate 14/16 en una corrida completa ni validan Google, porque Analytics permaneció apagado en este E2E general.

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
- 93df9bbed6524a83fa0ccbfd196b670e64a0a1b3: cierre documental de verify y revisión independiente; sólo handoff y spec.
- b787b6f15762ee94a98150a7f49a3c4a1c2e546b: preparación E2E y límites, sólo handoff y spec; SHA de la corrida de 129 casos.
- Commit que contiene esta versión del documento: resultado de E2E acotado en handoff/spec; índice regenerado sin delta. No cambia código, configuración ni tests. SHA final comunicado al Director para revisión del delta documental, sin recursión de commits.

## PR / BRANCH

PR fuente: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/24. Rama nueva sólo local: codex/pr24-analytics-remediation-20260905. No publicación autorizada.

## PENDIENTES DE ESTA TAREA

Implementación, validaciones medidas, revisión independiente focal y corrida de 129 E2E sin backend terminadas. Quedan 39 E2E pendientes de entorno real: 21 necesitan configuración Supabase y 18 requieren además fixture/seed. Una adaptación local del harness se coordina bajo SDD0440/#28, fuera de esta implementación. Director revisa el delta documental y clasifica omisiones antes de aprobar integración. La SDD conserva in-progress; no se transforma exit 0 en aprobación global. Publicación, CI alojada, base/SHA vigente, merge y release conservan sus gates y permisos separados.

## FUERA DE ALCANCE DETECTADO

Operación interna/retención de Google no verificables con fixtures. Los ocho warnings de lint son históricos y no afectan archivos del delta de remediación. El diagnóstico global de Docker corresponde al Director; su recuperación permitió pruebas efímeras, sin reparación del daemon por este Worker. Los otros nueve PR siguen su coordinación propia.

## HANDOFF AL DIRECTOR

Producto revisado y validado en 7d130212; 129 E2E medidos sobre b787b6f. Evidencia final lista para revisión por delta documental. Slot pesado liberado y corrida acotada concluida. Tras el commit final se libera claim y se confirma en el mensaje al Director; al retomar se reclama de nuevo. No borrar ni reutilizar el worktree. Director conserva ownership de entorno/slot, clasificación de omisiones, revisión e integración. El informe independiente permanece enlazado; esta entrega no se autocertifica independiente.
