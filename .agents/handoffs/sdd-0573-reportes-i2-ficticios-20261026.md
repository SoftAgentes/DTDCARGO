# SDD-0573 · Reportes: escenarios ficticios I2

Owner: worker-0573core-01a15a4e-ddf0-7d82-8656-d9dc56b58468.
Sesión: 01a1601e-d9fd-7280-8977-6b5d4719a99b, /root/worker_0573_core.
Estado: candidato local para revisión; aceptación funcional pendiente.
Autoridades recibidas íntegras: DIRECTOR-0573-REPORTES-I2-FICTICIOS-20261026 y DIRECTOR-318-PLANNING-FIN-AND-INDEPENDENT-REPORTS-REGRESSION-20261026.

WT: C:/Users/AKX generator/.codex/worktrees/sdd-0573-reportes-i2-ficticios-20261026/DTDCARGO.
Rama: codex/sdd-0573-reportes-i2-ficticios-20261026.
Base: a1a8e966cb4f00de52b14ffe2d3e45a5c455e84d; tree a273c924c181fe3f798c3e16a6e35e2c581c12e0; padre bdb68a6187c682fa00066806453be48690e4bd36.
SDD: docs/specs/0573-reverso-al-anular/spec.md y contrato existente docs/specs/0557-reportes-contables-una-cifra/spec.md. No nuevo ID ni edición de SDD.
Claim nuevo: creado a2026-10-26T01:08:06.1441093Z, 210 bytes/SHA256 f00e5eb851781fe5926c9ae0be20c808ac2c6b8a2378efc6b70692d92b389de3, metadata Git DTDCARGO11/harness-session-claim.json. Exclusión cooperativa, sin afirmación de control global de procesos. El cierre y liberación se acreditan en el recibo externo final, sin anticiparlos aquí.

## OBJETIVO ORIGINAL

Reemplazar sólo el import excluido y los dos escenarios deficientes de Reportes por datos originales FICTICIOS autocontenidos y un doble local que aplique las consultas actuales de I2. Añadir un negativo de evidencia documental incompleta. Mantener el stub compartido y todos los otros escenarios BYTEWHOLE.

## COMPLETADO

Allowlist exacta: lib/studio/reports/__tests__/queries.test.ts y este handoff nuevo. No se cambió producto, SQL, configuración, dependencias ni otros tests.

Se retiró únicamente el import de ingreso-fixture; se verificaron sus usos en ESTE test antes de reemplazarlos. No se abrió esa fuente, ni se copiaron/adaptaron sus constantes. UUIDs sintéticos fa573000-0000-4000-8000-*, tenant, fechas, cuentas, cabeceras y líneas son originales de esta tarea y están rotulados FICTICIOS. No constituyen datos de negocio ni un seed.

Los tres universos y sus expectativas se materializan en constantes antes de los callbacks. No hay lectura de reloj: los escenarios pasan explícitamente una fecha inventada. El doble local no modifica las filas de entrada y nunca invoca Supabase/RPC/SQL/red.

- USD: factura oficial1000, posting de factura600 y manual300 a4.5. Conserva ventas600/ingresos900/otros300/diferencia400. El manual entra en los saldos generales pero queda fuera de candidatos y saldos documentales.
- VES/CNY: tres documentos con movimientos nominales balanceados e identificados:700VES a tasa7,500VES a tasa5 y300CNY. El oficial propio esperado es200, definido antes del test; CNY no se convierte. Ventas nominales1500, manual200 a4.6, ingresos1700, enOtraMoneda3/diferenciaUSDnull/no_comparable. No se convierte el mayor aUSD.
- Evidencia incompleta: el universo USD conserva su factura oficial1000, pero la cabecera refiere explícitamente un documento FICTICIO ausente. La metadata no puede hallarlo por identidad. Se exige subtotal1000 conservado, diferencia/baseUSDnull, requiere_revision/sin_verificar y documento_no_disponible. No se fabrica un [] genérico ni un resultado de éxito.

El doble admite sólo cuatro tablas y doce formas de consulta explícitas, deducidas de las dependencias actuales leídas. Aplica el tenant de sesión FICTICIO y los filtros reales eq/is/in/gte/lte antes de proyectar. Distingue catálogo, saldos, candidatos por fecha, cabeceras por documento, originales/reversos por vínculo, metadata documental, líneas y ascendencia. Rechaza tablas, selects, combinaciones de filtros, RPC o paginación inesperados.

Las páginas devuelven como máximo DOS filas; el paginador real debe avanzar por lo recibido hasta la página vacía. Los oráculos nuevos afirman offsets0/2/3 para los tres candidatos, acceso a páginas posteriores de líneas y lectura de raíces de cuentas. Distractores de tenant, estado, borrado y fechas quedan fuera por sus filtros; no se enruta por nombre del test.

La aserción obsoleta eq(source,invoice) se sustituyó por in(source,[invoice,invoice_reversal]); se conserva y amplía la comprobación de exclusión del manual.

## FUENTES Y PRESERVACIÓN

Base del test: blob6b157cddf3932799d0e14eabfcac7402da333ddf,37264bytes/SHA2568d6aa76c59460333cbb4a27f83eac50781cf95aa1dfab66e8e3ba8f37d4b4c88.
Test nuevo medido:51316bytes/SHA256fca84bb788eed000a2b2bf621208e350198e02655b897fceb76cef7bb5eacd63,996LF y0CRLF.
Native27b213/exit0 acredita inversa WHOLE a la preimagen y todos los bytes fuera del import, inserción local y dos callbacks/regresión idénticos. El cuerpo del stub compartido conserva2562bytes/SHA2565dfac843c30a5d841bb100dde8fea931ee25b02c6ad3df08aeb4278d276dc94f.

Lecturas actuales por pin, completas en sus unidades admitidas: imports/stub compartido y bloque incomeStatement del test; función incomeStatement y sus imports; listAccounts/accountBalances; lector I2; módulo puro ingreso-periodo; paginador; profitAndLoss y helpers de período/filas pertinentes. Esto no recupera el test76KB detenido ni ingreso-fixture, Source03–06, SQL, retornos previos o lectores ajenos.

Incidentes administrativos preservados: Native6418b8/exit1, WHOLE_INVERSE_FAILURE. La primera comprobación reinsertaba el import después de su línea vacía. Se corrigió sólo ese punto del comprobador hacia el offset original, comprobando el prefijo inmutable; cambio count1 e inversa del comando conservados. Native27b213/exit0 pasó. Nativecb7302/exit1 detuvo el pre-stage antes de git add por EXACT_TWO_SCOPE_MISMATCH: la construcción PowerShell del array esperado necesitaba paréntesis explícitos en cada concatenación. El status real mostraba sólo las dos rutas admitidas. Se corrigen sólo los dos arrays de comparación del comando administrativo. No se alteró el test para satisfacer estos comprobadores y ninguno fue una ejecución funcional.

## VALIDACIÓN

Setup b3fccb/exit0: siete Git individuales conformes, rama propia y claim CreateNew/readback exacto. Se observaron nodeModulesExists:false y vitestExists:false en ESTE WT. Focal local NO DISPONIBLE / NO EJECUTADA; cero invocaciones Node/Vitest/SQL. Sin instalar, copiar, junction ni fallback. Versiones Node/Vitest NO MEDIDAS en esta tarea.

Input completo PREPARADO PERO NO INVOCADO, conservado en 0573-reportes:focal-test-NOEJ:

{
  "cmd": "& 'C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe' node_modules/vitest/vitest.mjs run lib/studio/reports/__tests__/queries.test.ts --maxWorkers=1 --no-file-parallelism --reporter=verbose",
  "shell": "C:/Users/AKX generator/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe",
  "login": false,
  "tty": false,
  "workdir": "C:/Users/AKX generator/.codex/worktrees/sdd-0573-reportes-i2-ficticios-20261026/DTDCARGO",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}

Retorno, error, Nativeexit y sesión de esa suite: null porque NO SE INVOCÓ, no por salida desconocida. No hay clocks de ejecución de test que atribuir. Los resultados de los tres escenarios nuevos siguen NO EJECUTADOS; sólo existe revisión estática y prueba administrativa de preservación.

CI previa40249070676/job121336779573/head a1a/attempt1:6–9PASÓ,10UnitariosFALLÓ en los dos escenarios citados y11–20SKIPPED, según General. Se conserva el fallo; no se recuperó su log ni se relanzó esa CI. No se atribuye causalidad temporal global. La CI NUEVA del candidato corresponde a General tras revisión fija.

diff --check pasó en27b213. No se ejecutó pnpm verify, compilación, suites47/29 ni cierre canónico de producto: tarea acotada de harness, dependencias ausentes y ninguna autorización para instalar o ampliar validación.

## GOBERNANZA Y LÍMITES

AGENTS/runbook/AGENT-BRIEF/registro/project-rules se cotejaron en el WT por pins idénticos a las unidades completas ya leídas por el mismo autor. SGE-00v1.0 se leyó completo en esta tarea.

| Principio | Clasificación de ESTA corrección |
|---|---|
| .01 | No aplica: no se cambia semántica de acciones de producto. |
| .02 | Cumplimiento estático: preimagen/inversa y otros escenarios conservados; no es prueba UI de recuperación. |
| .03 | No aplica a fricción UI: sólo harness ficticio; ninguna operación financiera. |
| .04 | No aplica a eventos reales: no hay mutación ni escritor de auditoría. |
| .05 | Cumplimiento estático limitado: doble filtra tenant y rechaza consultas inesperadas; ejecución NOEJ, no certificación RLS real. |
| .06 | Cumplimiento estático: metadata e identidades completas; negativo explícito ante falta de documento. |
| .07 | Cumplimiento del reporte: se distingue NO DISPONIBLE/NOEJ y no se declara éxito funcional. |
| .08 | No aplica: ningún flujo o paso de usuario cambia. |
| .09 | Cumplimiento estático: se reutiliza lector/paginador real, stub compartido intacto; doble sólo local. |
| .10 | No aplica: no cambia UI, foco, teclado o estilos. |
| .11 | Cumplimiento del reporte: causa identificable y siguiente revisión explícitas; no verde supuesto. |
| .12 | Cumplimiento de alcance: dos rutas autorizadas; cero publicación/DB/efecto externo por el autor. |

Estas clasificaciones no aprueban producto ni finanzas. Graphify/Archify/Obsidian, gestores, inventarios y automatización siguen suspendidos; no se invocaron. El handoff guarda evidencia de tarea; integración, cobertura semántica y publicación compartida siguen separadas.

## COMMITS / PR / BRANCH

El commit que contiene este documento fija una modificación del test y un alta de handoff con padre directo a1a8e966cb4f00de52b14ffe2d3e45a5c455e84d. La identidad final, árbol, preservación de otros blobs y liberación exacta del claim quedan en el recibo externo de cierre para evitar autorreferencia.
No push/PR/CI/head-base320/main/merge/deploy por el Worker. Parent coordina publicación normal sólo después de revisar el candidato fijo.

## PENDIENTES DE ESTA TAREA

Revisión semántica del candidato fijo por Parent y aceptación funcional mediante CI nueva por General. Los dos escenarios corregidos y el negativo añadido no tienen pase local acreditado. No se declara 2.1 cerrada, conversión del mayor aUSD, aplicación real de migraciones ni aceptación financiera.

## FUERA DE ALCANCE DETECTADO

ACK/P2-B espera respuesta humana a General; I2 transporte detenido y freshI2 siguen pendientes. #318 conserva su límite de presentación y WT propio. CORE06/QPG17/B mantienen sus estados separados, sin GO nuevo. Ninguna fuente/claim/WT anterior se modifica o se regulariza.

## HANDOFF AL DIRECTOR

Revisar únicamente el fijo con las dos unidades completas, diff y preservación, después coordinar publicación normal y CI NUEVA. Conservar todos los consumidores previos y los fallos originales. Este harness FICTICIO no acredita PRE-AWAIT real, SQL, PostgreSQL concurrente ni estados de negocio.
