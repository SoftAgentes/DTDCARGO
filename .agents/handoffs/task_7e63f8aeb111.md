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

## Recibo definitivo de este intento
Producto entregado: `e0b8f6ea1ae786e17f5a3b3322a9d85b78dc38f2`.
Commits: `2ea43d9c1` (dos P2), `17487914f` (merge normal de fase 2 exacta),
`e0b8f6ea1` (regresión de recorte de permiso para reiniciar).
El commit posterior de cierre contiene solo este recibo y la SDD.

### Resolución semántica del merge
- API: conserva tanto China como leerCuerpoFinanciero/MAX_CUERPO_ACCESO.
- Editor: conserva NumericInput, validación, identidades de línea y texto
  pendiente de #811, más solicitud identificada y callback de reinicio de #812.
- Padre: conserva vista montada y oculta durante revalidación, restauración de
  foco y suspensión financiera, combinados con bloqueos por motivo y el guard
  sincrónico que evita revocar sesión durante una petición operativa.
- Frontera: Facturación mantiene su router de 24 KiB; acceso/China comparten el
  de 2 KiB. Las pruebas de ambas fronteras se conservan.
- Pruebas: se unen sin borrar casos financieros, cambios de pestaña con edición,
  sustitución de sesión y casos operativos; misma sesión real del ensayo en router.

### Resultado por capa
PASÓ: análisis sintáctico TypeScript transpileModule de seis archivos, cero errores;
no equivale a typecheck, ejecución, navegador ni build. PASÓ: git diff --check.
NO EJECUTADO en la cabeza combinada: navegador, pruebas API/SQL, Traefik,
lint, typecheck, suite general y build. Los dos últimos pertenecen a CI por orden
del Director. No se transfiere el verde de 1ee827116 a este producto modificado.
Los PID ajenos 42636 (verify) y 57428 (Vitest general) seguían activos en el corte;
no se detuvieron ni se inició una corrida competidora. Aviso con cabeza y turno:
`msg_1016a49314c5`. El Director gestiona publicación y validación posterior.

Regresiones nuevas escritas: respuestas demoradas para recibir, identificar,
consolidar y reiniciar; intento de pulsar salida durante el pendiente; terminar el
bloqueo financiero mientras sigue el operativo y la situación inversa; recorte a
support sin cerrar sesión; cn consulta/naviera edición y la combinación inversa;
ambos consulta y cn retirado con lectura naviera preservada; escrituras denegadas
por el handler y membresía desactivada. La selección y el reinicio anteriores se
conservan. Comando preparado (no ejecutado aquí): PRACTICA_NAVEGADOR=1 y
PRACTICA_EVIDENCIA=sdd-0713-fase-3-e0b8f6ea, luego pnpm exec vitest run
lib/studio/practica/__tests__/china.test.ts lib/studio/practica/__tests__/acceso.test.ts
--maxWorkers=1. Usar también el ensayo practica-p2.node.ts incorporado de #811.

PENDIENTES: ejecutar esas capas en turno libre/CI, corregir fallos si aparecen y
revisión independiente del SHA publicado. Ninguno de los dos criterios P2 se
considera aceptado solo por estar implementado. No se incorpora aún el defecto
residual de red/503 de #811: su autor y el Director lo mantienen, msg_b5606df351b9.
Impacto documental y allowlist exacta ampliada constan en fase-3.md; no hay cambios
normativos, de SQL del ERP, de permisos efectivos ni de producción.
