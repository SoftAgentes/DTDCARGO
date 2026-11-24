# Correcciones P2 de fase 3

Owner: ee6252bd-3872-4022-aa72-48ebd93b3a09.
Coordinador: c8393b96-a33a-490a-80ed-d07121569581.
Task: task_7e63f8aeb111; dispatch: ctx_0cb55e90be8b.
Rama: SoftAgentes/sdd-0713-china-consolidado.
Base revisada: 8b2dabdac98f9e58efdb58eb21f8beb4949fa514.

## OBJETIVO ORIGINAL
Corregir bloqueo de salida durante operaciones y refrescar permisos cn/naviera
por separado, conservando selección, reinicio y las correcciones de #811.

## COMPLETADO
Bloqueos financiero/operativo independientes en el padre, con guard antes de salir.
China publica pendiente hasta resolver la petición y libera solo su motivo.
La respuesta de servidor incluye permisos operativos vigentes; la lectura conserva
el módulo aún autorizado y cada escritura exige su permiso exacto. La pantalla
retira acciones recortadas sin perder lecturas permitidas.

## VALIDACIÓN
Regresiones escritas para respuestas demoradas de recepción, identificación,
consolidación y reinicio, dos motivos de bloqueo, recortes sin cerrar sesión y
permisos distintos para cn/naviera con denegación/conservación en servidor.
Ejecución y SHA combinado pendientes. Suite/build general quedan en CI.

## COMMITS
Se registran al cerrar. Merge normal autorizado de fase 2 exacta
fbc5ca252fee8a5e9700dc16be78f276ea1b2330.

## PR / BRANCH
PR #812 sobre #811; el Director publica la nueva cabeza, sin push del Worker.

## PENDIENTES DE ESTA TAREA
Resolver merge semántico, probar cabeza combinada y registrar evidencia y límites.

## FUERA DE ALCANCE DETECTADO
Sin producción ni cambios a permisos reales. No se duplica verify/build local.

## HANDOFF AL DIRECTOR
Allowlist de corrección en fase-3.md; el merge incluye cambios de #811 solo por
la cabeza expresamente asignada. Pruebas previas conservadas con sus SHAs.
