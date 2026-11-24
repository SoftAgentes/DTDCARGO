# Fase 4 · Embarques y recepción Venezuela

Base: 8b2dabdac98f9e58efdb58eb21f8beb4949fa514 (#812). Acceso cerrado.
Contrato: conservar el documento operativo CAS de China, identidad de cajas,
cliente, consolidado y preorden. No editar Embarques real ni importar sus acciones.
Facturar abre revisión del documento de ese embarque, aunque otro está seleccionado;
primera confirmación revisa datos, segunda emite el documento seleccionado sin cambiar
líneas ni código. Cancelar no escribe. Estado emitido muestra resultado y enlace al
detalle de práctica; pago bloquea anulación. Edición solo desde Facturación en borrador.
La recepción nueva sigue sin preorden. La avanzada conserva su preorden preparada.
Embarcar requiere shipments edición; recepción VE requiere ve edición, reevaluados
por operación en servidor. Lecturas operativas nunca incluyen detalle financiero.
Ayuda nativa details/summary, teclado y tacto; Faro cerrado, fallback local permanente.
Reanudación usa documento persistido y revisión compartida; sin SQL ni destinos reales.

Allowlist exacta:
- docs/specs/0713-modo-prueba-personal/fase-4.md
- docs/specs/0713-modo-prueba-personal/spec.md
- .agents/handoffs/task_023e299bbf69.md
- lib/studio/practica/china.ts
- lib/studio/practica/servidor.ts
- lib/studio/practica/facturacion.ts
- lib/studio/practica/__tests__/embarques.test.ts
- lib/studio/practica/__tests__/acceso.test.ts
- app/api/practica/[operacion]/route.ts
- app/studio/practica/ChinaPractica.tsx
- app/studio/practica/PracticaPersonal.tsx
- app/studio/practica/FacturacionPractica.tsx

R3: MP-01 y AUD-01 conservación e historial; ERR-01 conflicto explícito;
A11Y-01 ayuda nativa y ConfirmDialog; VIS-01 tokens y estilos existentes.
Clasificación pendiente de pruebas, no aceptación anticipada. Sin excepción nueva.
La operación china existente conserva ambas listas de acceso; no abre otra ruta.

Recargar cargas y permisos revalida primero la proyección completa desde estado.
Si se retira Facturación, se desmonta su detalle y se vacía el resumen financiero;
las cuatro capacidades operativas se vuelven a leer por separado. Con permisos
iguales se conserva el editor montado y el borrador. Un fallo transitorio conserva
la edición oculta y bloqueada, con el reintento existente, sin tratarlo como baja.

## Continuidad entre versiones y dependencia Faro

La normalización de identidad sintética se aplica al leer y antes de escribir,
sin reinicio ni cambio de generación. Solo reconoce las tuplas preparadas de
código/envío; conserva conceptos, pagos, estados e historial. Las cargas nuevas
y las identidades desconocidas no se reasignan. Los snapshots previos permanecen
intactos; el siguiente comando CAS conserva la identidad normalizada.

Faro habilitado: **NO DISPONIBLE** en esta versión. La SDD-0637 sigue propuesta;
el árbol contiene catálogo, guías y registro SQL, sin endpoint ni motor de
conversación reutilizable. Falta un servicio Faro de práctica con autorización,
contexto sintético y registro aislado antes de abrir una ruta en ambas fronteras.
La prueba dinámica habilitada queda **NO EJECUTADA**. La ayuda local permanece
disponible sin ese servicio. El Director confirmó este límite del encargo.

Allowlist adicional de fixtures sintéticos recuperados de Git:
- lib/studio/practica/__tests__/fixtures/fase-2-facturacion.json
- lib/studio/practica/__tests__/fixtures/fase-3-china.json

## Ampliación del ejercicio · China A-Z (encargo del Director)

Aceptación adicional pendiente: seguir dos parciales de la misma carga, mostrar
las cajas efectivas de cada consolidado, conservar cliente/código/preorden y
facturar una sola vez. #812 es dueño de recepción por lector, doble lectura,
asignación por caja, indicadores y tarea documental de origen; #813 consume su
contrato publicado por merge normal y no duplica esas funciones.

SDD-0697 §2.5: Embarques ve indicadores con procedencia CN/VE; Recepción VE
recibe solo manejo físico, incluido Frágil, por origen exacto de sus cajas.
No se infiere por cliente ni contenedor, ni se heredan indicadores a un envío
nuevo sin vínculo de origen. La alerta documental de China no es autorización
aduanal, ni su resolución libera la mercancía o cambia una factura.

Se prepara una incidencia ficticia de destino con motivo, estado pendiente y
resolución auditada por el rol/región autorizado. No representa liberación
formal SENIAT: la SDD-0228 exige módulo/capacidad, estado pagado, seis documentos,
fecha, motivo y transacción del trámite; simular esa liberación requeriría ese
contrato completo. El control de indicadores en el embarque de SDD-0697 exige
admin o warehouse/operations de región ve; editar el módulo por sí solo no
demuestra ese permiso. Falta acordar la capacidad derivada que entrega el origen
y la estructura publicada de los parciales antes de conectar esta parte.

La matriz nueva partirá de Mi perfil y verificará ambos parciales, relectura,
Frágil visible en destino, retención pendiente, rol denegado, resolución y
continuación, en móvil/escritorio y ambos temas. Hasta ejecutar ese recorrido,
la fase y su aceptación ampliada permanecen abiertas.

Reparto confirmado: #812 publica tipos/valores, capacidades derivadas en origen
y proyección segura por superficie; #813 implementa estado y comandos de destino.
El estado de destino se indexa por el identificador recibido del contrato, nunca
por total ni cliente. Se prepara un motor independiente que recibe una lista
autoritativa de cajas por viaje y permisos ya resueltos por servidor. La recepción
se cierra por conteo exacto de esas cajas, sin usar la palabra entrega ni tocar
Facturación. Una observación pendiente impide continuar su propio viaje hasta
la resolución con motivo por capacidad explícita; no avanza otro consolidado.

Allowlist adicional para el motor independiente y sus regresiones:
- lib/studio/practica/destino.ts
- lib/studio/practica/__tests__/destino.test.ts

Al conectar ambos motores, la mutación compartida del receptor debe comprobar
los manifiestos congelados antes del CAS: una estiba posterior no puede añadir,
quitar ni mover cajas de un viaje embarcado. La comparación usa cajas exactas
por consolidado del documento completo; no exige que el motor de China importe
el motor de destino. Origen y destino conservan la misma revisión CAS: quien
perdió una carrera no aplica su snapshot anterior. Se ensayarán ambas órdenes
y el conflicto; un escaneo repetido de A no modifica el avance de B.

Contrato publicado de origen incorporado: #812 `671dc9eca3314bf573394509a6bf462a97b7dcba`.
Se consumen CONSOLIDADOS_CHINA, proyectarCajasChina y leerCajasChina sin otra
lectura de membresía. El estado propio `ChinaPractica.destino` se guarda con
la misma RPC/revisión CAS que el documento completo. POST china con etapa y
consolidado conserva la lectura publicada; el comando aditivo `destino` opera
solo con esos IDs y la capacidad vigente. No abre otra ruta del receptor.
Las respuestas por vista son listas explícitas: ni el viaje de destino ni
las tareas China se devuelven por accidente al consultar otra superficie.

Allowlist adicional de interfaz e integración:
- app/studio/practica/DestinoPractica.tsx
- lib/studio/practica/__tests__/destino-integracion.test.ts
