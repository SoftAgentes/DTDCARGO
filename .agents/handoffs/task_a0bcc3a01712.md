# Unión y supervisión CI de fase 3

Owner: ee6252bd-3872-4022-aa72-48ebd93b3a09.
Task: task_a0bcc3a01712; dispatch: ctx_dcc0f96672eb.
Coordinador: c8393b96-a33a-490a-80ed-d07121569581.
Rama: SoftAgentes/sdd-0713-china-consolidado; PR #812, base #811.
Base propia: f66b5ad5ed670b3efcf7b811668dc4dc0f3280ea.
Dependencia exacta: 0c0b5a8ed81127cce21e4f9c51c695441720175f.

## OBJETIVO ORIGINAL
Unir la nueva #811 sin reescritura, conservar ambas fases y supervisar el CI focal
y general sobre la misma cabeza publicada con avance normal de la rama propia.

## COMPLETADO
Merge normal con resolución semántica del padre y de acceso.test.ts. Se conservan
bloqueos por módulo y guard de salida (incluida recuperación), permisos cn/naviera,
preorden, reinicio, editor financiero, recuperación de red/identidad y todas las
pruebas negativas. El gate focal exige suite no vacía, ninguna omisión y los cuatro
recibos de viewport/tema. No se toca el motor de permisos del ERP ni producción.

## VALIDACIÓN
Sintaxis de seis archivos: PASÓ, cero errores; no equivale a typecheck.
Diff check: PASÓ. No se ejecutan suite general ni build locales.
El SHA final es el merge que contiene este archivo; su valor exacto y resultados
se entregan en recibo Orca y comentario de #812 después de las corridas, sin
mutar Git con otro commit solo de recibo. La corrida focal y Calidad deben
verificar exactamente esa cabeza; un resultado de otra cabeza no es cobertura.

## COMMITS
Merge normal de la dependencia exacta indicada; conservación de toda la historia.

## PR / BRANCH
Push delegado explícitamente solo de la rama propia a sí misma. No merge de PR,
activación ni despliegue. El Director recibe SHA publicado para #813.

## PENDIENTES DE ESTA TAREA
Supervisar CI focal, lanzar Calidad solo si no existe en el mismo SHA, revisar
logs y corregir defectos propios; si el defecto es de #811, escalar con evidencia.
Resultados efectivos y omisiones quedan en el recibo final, no supuestos aquí.

## FUERA DE ALCANCE DETECTADO
No acceso a datos reales ni SQL compartido. No correcciones divergentes de #811.

## HANDOFF AL DIRECTOR
Allowlist ampliada por unión en fase-3.md y evidencia final asociada al SHA de PR.
Los estados de tareas anteriores conservan su evidencia histórica, sin trasladar
sus resultados a esta cabeza. La aceptación e integración requieren revisión.


## Ampliación autorizada: China completa y contrato temprano
Mensajes msg_9b6b07676dfb, msg_088600871fd5 y msg_28cb7bd0bbaa.
Contrato aditivo estable en fase-3-china-contrato.md, tipos de ejercicio-china.ts,
servicio leerCajasChina y API de lectura por etapa. Regiones desde membresía real;
facultades ejercicioCn e incidenciaDestino transportadas de forma derivada.
Documento histórico proyectado en memoria; lookup nunca escribe y el primer CAS
persiste la ampliación sin tocar el avance anterior. SQL desechable ajusta lectura
vacía para que tampoco cree una fila; sin SQL en servidores compartidos.
Prueba dirigida local de contrato: 20 PASÓ, 1 SKIP explícito de navegador, antes
de montar la UI nueva. Incluye QR PNG realmente decodificado con jsQR, parciales
4/3/A2/segunda llegada/B2, prioridad de caja escaneada en recepción y estiba,
indicadores por recepción, idempotencia, roles/región y JSON limitado en servidor.
jsqr 1.4.0 solo de desarrollo; lockfile conserva versiones preexistentes y la
instalación congelada prefer-offline PASÓ. La UI y su matriz se entregan después.
El general anterior 45473465438 terminó FALLÓ por opciones de ensayo ausentes en
.env.example; la nueva cabeza de #811 b43f9b7901e799eb4a3157b74fb8b199c422761f
fue asignada para incorporar ese arreglo mediante merge normal.
