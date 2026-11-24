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


## Componente específico y regresiones A a Z
EjercicioChina se monta en ChinaPractica con el mismo CAS, permisos y bloqueo de
salida. Entrada por el componente real EntradaPractica en perfil sintético del
ensayo; ambas vías (teclado+Enter y manual) hacen el mismo lookup sin escritura.
QR SVG renderizado se captura y se decodifica con sharp/jsQR; se distingue aparato
físico NO PROBADO. Recepción parcial 3/4, A=1/2, segunda llegada y B=3/4, origen de
Frágil por recepción, tarea documental con carta ficticia y retiro auditado.
Una respuesta perdida después de confirmar Frágil se reintenta con el mismo UUID.
Regresión PGlite confirma equivalencia de claves JSON reordenadas sin segunda
mutación, y rechazo de cambios de motivo/cantidad para ese UUID.
Dirigidas locales de dominio/API/SQL: 20 PASÓ, 1 SKIP de navegador explícito;
lint dirigido: PASÓ sin errores. El contrato temprano 671dc9eca pasó focal
45477451268 y TypeScript en Calidad 45477530552; no acredita aún la UI nueva.
El nuevo focal conservará capturas sintéticas por SHA con acción fijada a commit.
No se relajan pruebas anteriores ni se cambia configuración, estado o comandos
de #813: solo el lector tipado y las facultades derivadas comunes.

## Correcciones del lector y de recepción repetida
Antes de cerrar se incorporan msg_7239f1812723, msg_62dd03c3e1bb y
msg_3d0dfd37ff05. El focal b9afd7a5c alcanzó la segunda recepción y falló al
localizar el select de B; los select tienen ahora nombre accesible explícito.
Preparar el lector limpia su texto, conserva consulta separada y la invalida para
confirmación al editar. La matriz escribe dos códigos distintos con caracteres y
Enter desde ese control, sin fill ni borrado manual, además de la vía manual.
Un código ya recibido o montado no permite otra recepción con UUID nuevo; la
regresión conserva revisión/inventario/historial y deja entrar la cuarta solo con
su etiqueta pendiente, conforme a P0131/0245. El replay legítimo original permanece.
Dominio, API/PGlite y guard de .env.example dirigidos: 22 PASÓ, 1 SKIP de navegador
por flag apagado. El guard pasa con PRACTICA_EVIDENCIA documentada sin valor
operativo. El focal siguiente conserva diagnóstico ARIA y captura sintética ante
fallo; la aceptación de navegador sigue pendiente de su corrida efectiva.
