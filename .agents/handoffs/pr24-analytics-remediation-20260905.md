# Worker · PR24 / SDD-0371 · remediación de Analytics

Fecha: 2026-09-05
Estado: en-progreso; corrección lista para revisión, verify pendiente de turno
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
- SDD, marketing e inventario de terceros actualizados con límites de evidencia. La SDD sigue in-progress por gates pendientes.

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
| pnpm verify de la combinación | NO EJECUTADO todavía | Turno de recursos reservado a #31 por Director; no se comenzó corrida pesada. |
| SQL / schema-rebuild | NO DISPONIBLE localmente | Docker instalado, daemon falla en Ingest/rename sailor-ingest.sock. No corresponde simular un pase. |
| Ledger Cloud | NO EJECUTADO | Fuera del alcance; no se copian ni usan credenciales. |
| Revisión independiente del nuevo SHA | Pendiente | Director solicitará revisión al auditor de la reproducción original. |

Comando focal: node node_modules/vitest/vitest.mjs run __tests__/analytics.test.ts components/Analytics.test.tsx.

Evidencia externa, preservada en C:/Users/AKX generator/AppData/Local/Temp/:

- dtd-pr24-install.log
- dtd-pr24-red-tests.log y dtd-pr24-green-tests.log
- dtd-pr24-browser.cjs, dtd-pr24-browser.log y dtd-pr24-browser/result.json
- Informe fuente: DTD-PR24-auditoria-independiente-20260905.md, preparado por el auditor; no se copia íntegro al repo.

El navegador usa hooks Next adaptados a History en un fixture local y next/script instalado real; el loader se responde con JavaScript inerte mediante intercepción. Dieciocho cargas sensibles no montan tags. Dos recorridos validan un page_view inicial sin gtag preinstalado, carga tardía con ambos flags apagados, observadores antes/después, regreso público, hashchange/popstate y señales legítimas. No es una prueba del proveedor Google ni un E2E de la aplicación Next completa.

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

Alcance limitado a minimización y salida hacia terceros del cambio asignado; no es auditoría integral de los doce puntos ni certificación de cumplimiento. Consentimiento, almacenamiento, migraciones, identidad y captura no cambian. Esta revisión técnica no es asesoría legal; el nuevo SHA requiere revisión independiente.

## COMMITS

Commit de merge que contiene este documento: padres main74bb52ab y PR24 545af575; corrección y evidencia local focal incluidas. SHA comunicado al Director sin crear recursión documental.

## PR / BRANCH

PR fuente: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/24. Rama nueva sólo local: codex/pr24-analytics-remediation-20260905. No publicación autorizada.

## PENDIENTES DE ESTA TAREA

Gate canónico al liberar turno de recursos; registrar resultados y SKIPs. Revisión independiente del nuevo SHA y correcciones si surgen. Publicación/CI alojada/integración conservan sus gates separados.

## FUERA DE ALCANCE DETECTADO

Operación interna/retención de Google no verificables con fixtures. Docker corresponde a diagnóstico del Director; no se altera su estado. Los otros nueve PR siguen su coordinación propia.

## HANDOFF AL DIRECTOR

Corrección lista para revisar por SHA local; verify aún pendiente. Claim retenido hasta terminar escritura y evidencia canónica. No borrar este worktree ni reutilizarlo. Director conserva ownership de revisión e integración; esta entrega no se autocertifica independiente.
