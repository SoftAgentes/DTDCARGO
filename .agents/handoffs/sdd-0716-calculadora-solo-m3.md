# Handoff SDD-0716

## OBJETIVO ORIGINAL
Retirar ft³ de tarifario y ayudas; guía m³ con cantidad y ejemplo ficticio.

Owner: codex-sdd-0716-solo-m3-20261124.
Sesión: orca_session_id:3ff1174e-c8ba-4e62-9000-542439567488.
Task: task_797ed2ba9139. Dispatch: ctx_e7a5eacaa2de.
Coordinador: orca_session_id:14b98827-b1e5-41f3-aee0-c72c837f96fc.
Rama: SoftAgentes/sdd-0716-calculadora-solo-m3.
Ruta: C:/Users/AKX generator/Desktop/Developer/Orca/DTDCARGO/sdd-0716-calculadora-solo-m3.
Base reserva: 1e66d2002b41a26c7ba3dad647dba00fd0272a54.
Main asignado: 8580490f8d95872a407ab83ab9acb6b1b265a451.
Autorizados edición, pruebas, commits y PR; merge, deploy y DB fuera del encargo.

## COMPLETADO
Cambios acotados a allowlist de spec. Campo oculto conserva legacy; no cambia
la tarifa por m³ ni funciones de conversión internas. FAQ y widget usan ejemplo
ficticio en metros y cantidad; pulgadas se conserva como longitud física.

## VALIDACIÓN
Guard con owner: PASÓ. Pruebas focales preparadas, NO EJECUTADAS (sin dependencias).
ui-check read-only: tokens, fuentes, controles y estados existentes conservados;
sin nuevos anchos fijos. Veredicto estático OK; render claro/oscuro NO VERIFICADO.
Build, verify y suites: pendientes de turno del Director antes de instalar.
PASÓ: sdd:check (choques históricos exceptuados), docs:check,
governance:check y git diff --check. NO DISPONIBLE: components:check por
ERR_MODULE_NOT_FOUND de ajv (worktree sin node_modules).
Validador del plugin: FALLÓ con «policy-registry.json está desactualizado»;
cápsula normativa local vigente, no se actualizó plugin fuera del alcance.
Governance-check estático: FRM-01, VIS-01/02 y A11Y-01 conservan controles,
tokens y estados (cumplimiento del diff); permisos/PII/integraciones no aplica;
sin excepciones nuevas. Riesgo R2: conservar legacy y validar formulario.
No se infiere conformidad visual del conteo de scripts.

## COMMITS
Pendientes.

## PR / BRANCH
PR draft solicitada; rama propia aislada verificada. Consultar Git/PR para SHA actual.

## PENDIENTES DE ESTA TAREA
Instalación, pruebas focales, render sintético claro/oscuro, verify, commit y PR.
Director asignó turno después de Embarques (msg_e12f9ed11f5e); no iniciar carga
hasta aviso. Si el cierre completo local resulta desproporcionado, lint global,
tipos, suite completa, build y gates de `verify` quedan a CI en cabeza exacta;
la prueba focal y el render sintético siguen pendientes locales antes de ready.

## FUERA DE ALCANCE DETECTADO
Ninguno adicional en las rutas inspeccionadas. Legacy lib/calculadora.ts sin
consumidores públicos que activen pies cúbicos; se conserva sin cambios.

## HANDOFF AL DIRECTOR
Impacto documental: spec y su índice generado; esta evidencia es local.
No se consultaron ni mutaron datos reales. Claim retenido mientras sigue escritura.
