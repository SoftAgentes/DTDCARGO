# Contrato aditivo de lectura · China completa · SDD-0713 fase 3

La copia mantiene `ChinaPractica.cargas/eventos` de las entregas anteriores.
Se añade `ejercicio?: EjercicioChina` al mismo documento CAS. La lectura
de un documento antiguo proyecta la semilla aditiva en memoria, conserva revisión
y avance; la primera escritura CAS persiste el campo. La consulta por etiqueta nunca crea ni actualiza datos.
Reiniciar invalida el documento completo con la misma generación financiera.

## Identidades y estados

Compra única `PRA-COMPRA-CHINA-001`, markbox `DTD-PRA-CHINA`, cuatro cajas
canónicas `DTD-B-99007131` a `DTD-B-99007134`. El parser aprobado
`parseScannedLabel` identifica códigos DTD-B (pelados o transportados en b=).
Nunca se abre la URL ni se consulta el ERP. Proveedor con solo c= se rechaza
como identificador de recepción; un código fuera de esta semilla es desconocido.
Las etiquetas muestran Datos inventados, código visible y QR del código DTD-B.
Lector QR compatible en modo teclado + Enter; manual produce el mismo lookup.
Aparato físico NO PROBADO.

`ejercicio.version = china-completa-1`; `compra`, `markbox` y `cajas` son estables.
Cada caja tiene `codigo`, `secuencia`, `recepcion?: id` y
`estiba?: {consolidado, lote, orden, ancho}`. Ausencia de recepción = por llegar;
recepción sin estiba = disponible en China. Una caja tiene como máximo una estiba.
Cada recepción conserva ID, códigos adoptados y los indicadores de origen CN.
Cada lote agrupa la compra, códigos, cantidad, consolidado A/B, ancho 0/1/2 y
orden de carga incremental por consolidado, como SDD-0155 §3 y migración 0246.

Lectura para fase 4: por consolidado, devolver cada caja con compra/markbox,
recepción y lote de origen y los indicadores vivos consultados desde esa recepción.
En Embarques VE se ven todos los indicadores; en Almacén VE, Frágil.
No copiar ni crear factura/preorden/cobro al adoptar o montar cajas. La referencia
financiera preparada de los ejercicios anteriores permanece independiente.

## Mutaciones y rastro

Solo acciones del ejercicio con idempotency ID UUID, revisión vigente y sesión
propietaria. El servidor consulta el permiso efectivo CN y la habilitación del
rol/área CN antes de cada escritura. Consulta sin edición conserva lookup y detalle.
Recibir N exige una etiqueta pendiente: adopta primero la caja escaneada y luego
las demás esperadas por secuencia (0245, paso 6). Una etiqueta recibida o montada
se rechaza aunque quede otra pendiente; el replay del UUID original no muta. Cargar N
incluye primero la caja escaneada y luego las recibidas disponibles por secuencia
a un lote, conforme a 0246:131-157. Reintentar el mismo ID y payload
recupera el resultado; reutilizar ID con otro payload se rechaza.

Eventos con ID, hora del servidor, fuente práctica, acción, motivo y antes/después
se confirman en el mismo CAS. Estados y evidencias son sintéticos y persistentes.
Frágil / 易碎: gris, texto e icono; efecto ninguno, origen CN; aplicar/retirar audita.
Marca sin autorización: efecto tarea; abre pendiente → en revisión → resuelta,
con evidencia elegida `PRA-CARTA-001` y motivo; al resolver se retira el indicador
sin borrar tarea ni rastro. No se atribuye bloqueo aduanal automático.

## Ensayo mínimo

Cuatro anunciadas → recibir tres → montar dos en A: queda una en China y una
por llegar → recibir la cuarta → montar dos en B. Probar repetición, desconocido,
proveedor sin DTD-B, cancelar antes de recibir, parciales inválidos y doble estiba.
Los estados se reanudan sin mezclar personas y el reinicio conserva su aislamiento.
La disponibilidad de estos indicadores en el ERP real no se infiere de la práctica;
se muestra la ayuda local y la referencia a SDD-0697 sin activar servicios reales.

## Interfaz estable para fase 4

Exportaciones en `lib/studio/practica/ejercicio-china.ts`:
`CONSOLIDADOS_CHINA = [PRA-CON-CN-A, PRA-CON-CN-B]`, `CajaChinaLectura`,
`EtapaLecturaChina = shipments | ve`, `proyectarCajasChina(estado, consolidado, etapa)`.
Servicio `leerCajasChina(cfg, sesion, espacio, consolidado, etapa)` en servidor.ts.
API POST `/api/practica/china` con `{espacio, etapa, consolidado}`, sin comando.
Respuesta `{revision, generacion, etapa, consolidado, incidenciaDestino, cajas}`.
Cada caja: codigo/secuencia/compra/markbox/recepcion/fechaRecepcion/lote/consolidado/
orden/ancho e `indicadores:[{codigo,nombre,origen:CN}]`. No incluye ejercicio,
recepciones brutas, tareas, evidencia ni historial interno. `shipments` permite
Frágil y Marca sin autorización; `ve` solo Frágil. Un código de indicador es
`fragil` o `marca_sin_autorizacion`. Ejemplo de caja 3 en B: recepción 001,
lote 002, orden 0, ancho elegido y Frágil; la caja 4 conserva recepción 002 y
no hereda el Frágil de la recepción 001.

Facultades aditivas en PermisoPractica: `ejercicioCn?: boolean` solo cn y
`incidenciaDestino?: boolean` en ve/shipments. Se computan en origen por membresía
activa usuario/tenant y user_tenants.region, rol, edición efectiva y scope.
CN: admin o warehouse/operations de región cn con edición cn. Destino: admin o
warehouse/operations de región ve con edición de la superficie solicitada.
Ausencia no concede capacidad; nunca inferir región desde scope. Destino es dueño
de sus comandos y estado: debe consultar el origen por operación y exigir true.
Este lector también devuelve incidenciaDestino como proyección de esa facultad;
no convierte una lectura en permiso para mutar los indicadores de origen CN.
