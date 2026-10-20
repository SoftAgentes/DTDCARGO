# Plan contable: avance y pendientes

**Dueño:** Director Codex, para Sam. **Estado:** seguimiento en curso.

**Fecha de corte:** 20 de octubre de 2026, 2:27 p. m. de Caracas. **Clasificación:** interno.

La prioridad sigue siendo llevar la contabilidad completa en Studio y dejar QuickBooks cuando el ERP esté listo. Este documento presenta el avance comprobado de la continuación; las decisiones de negocio permanecen en el [plan maestro](2026-10-18-contabilidad-diagnostico-y-plan.md).

El [registro del Director, §4](../../.agents/handoffs/director-continuidad-codex-20261020.md#4-checklist-vivo-de-continuidad) conserva el checklist vivo y la evidencia de cada cambio. Esta es su vista resumida para Sam.

## Dónde estamos

**GitHub volvió a funcionar.** Pasaron las verificaciones de `main`, tasa única (#301), pruebas PGlite (#304) y tarifa congelada (#307). La nueva revisión de tasa única encontró dos problemas que deben corregirse antes de aplicar su migración.

**El main que estaba pendiente ya quedó publicado**, a la 1:28 p. m., con 14 comprobaciones automáticas aprobadas y cero fallas. La lectura del servidor confirmó que sigue en esa versión. Todavía no se ha integrado ninguna PR nueva de este Director: 0569 y 0572 continúan en sus ramas.

El corte anterior reportaba seis tareas del plan terminadas y cinco extras en producción; ese antecedente se conserva fechado. La comprobación de publicación no sustituye la prueba funcional de cada recorrido dentro de Studio.

## 2.1 · Una sola regla para convertir a dólares

La 2.1 sigue **en curso**. Está dividida para poder revisar cada cambio y comprobar las cifras.

| Parte | Avance comprobado | Próximo paso |
|---|---|---|
| **Tasa única y conversor · 0569** | Código en la [PR #301](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/301). La corrección ya está preparada y su código revisado: distingue tasa de tabla y excepción de la factura, y detecta cambios de otra persona al editar o emitir | Demostrar el fallo previo y la corrección con pruebas, incluyendo cambio de moneda y precisión. Luego validación completa y previa; después se pide el OK nominal de `0495_fx_rates_conversor_usd` |
| **Reemplazar las 13 conversiones · 0572-a** | Avance guardado y publicado. Pasaron 71 pruebas focales, revisión de tipos y revisión estática. Se repararon formatos y datos de prueba incompletos | Incorporar la dependencia 0569 corregida, comprobar el ranking de embarques sin tasa y terminar prueba completa, mutantes y revisión visual. La PR espera a #301 integrada |
| **Conversiones pendientes en SQL · 0572-b** | Identificadas y separadas del cambio anterior | Encargo propio, número de migración coordinado y OK nominal antes de producción |
| **Hora de Caracas** | Pendiente de implementación y de número de tarea | Unificar emisión, asientos, cobros y pagos después del cierre del conversor |
| **Carga diaria del BCV** | Decisión tomada: fuente oficial, carga diaria y respaldo manual. La automatización no está implementada en 0569 | Preparar la tarea y la salida a la fuente oficial. Registrar claramente qué ocurre cuando falta una tasa vigente; no declarar operativa la carga automática |

**USD y USDT se tratan 1:1.** Los bolívares quedan para reportes. La conversión de ventas en el mayor pertenece a 2.3; no se da por resuelta con estos reemplazos.

## Los otros frentes abiertos

| Frente | Estado actual | Qué falta |
|---|---|---|
| **0571 · Tarifa congelada**, #307 | La revisión nueva detectó tres problemas de búsqueda y actualización del formulario. El Worker los está corrigiendo. La validación anterior aprobó 16 de 17 comprobaciones disponibles, con omisiones documentadas | Probar las correcciones; después actualizar base, validación final, nueva previa, OK nominal de `0496_tarifa_congelada_por_embarque`, integración y prueba en el servidor |
| **0573 · Reverso al anular**, 2.5 | Implementación publicada. Se recuperó y guardó el informe completo de revisión; sus hallazgos siguen pendientes | Corregir los controles de anulación, concurrencia, tenant y comparación entre meses; prueba completa y PR. Después revisión, previa y OK nominal de `0497_reverso_al_anular_factura` |
| **0574 · Embarques sin facturar**, 4.5 | Ya implementada sobre 0571. Hay evidencia anterior de diez pruebas y tres mutantes | Preparar dependencias locales y ejecutar la prueba completa con turno. Se integra después de 0571 |
| **0575 · Asientos sin fallos silenciosos**, 2.2 | Cinco decisiones de diseño registradas y publicadas; todavía no está implementada | Contratos, archivos de cada entrega y número de migración; tres PR sucesivas |
| **0570 · Pruebas PGlite**, #304 | GitHub pasó; comparación local de 34 archivos en curso, con las mismas pruebas en ambas versiones | Comprobar los resultados antes de cerrar el criterio de velocidad |
| **Oficina de agentes**, #306 | Correcciones documentales guardadas, publicadas y revisadas; comprobación de GitHub en curso | Actualizar base después de #301. El aislamiento real entre perfiles y la copia filtrada del servidor siguen sin verificar |

Se ejecuta una sola prueba pesada a la vez en la máquina. El carril de embarques puede avanzar en paralelo cuando no compite por ese turno ni cambia contratos del carril contable.

## Secuencia que seguimos

La integración inmediata conserva este orden: **#301 → #304 y #306 → #307 → 0573 → sellos de migración**. Cada integración requiere sus comprobaciones actuales y, cuando cambia la base de datos, la aprobación nominal correspondiente.

Después del conversor, la cola contable sigue así:

1. Hora de Caracas.
2. Asientos sin fallos silenciosos, 2.2.
3. Cobro multimoneda, anticipos y recibo para varias facturas, 2.6.
4. Mayor en USD y bolívares en reportes, 2.3.
5. Reporte de pago del portal que crea recibo y asiento, 2.7. Antes: previa y OK nominal para 0422 y 0423.
6. Notas de crédito y débito, 2.8.
7. Candado del mayor, 2.4.
8. Factura emitida inmutable, 2.9.
9. Paquete de la contadora y conciliación de auxiliares, 2.10.
10. Conciliación bancaria en el ERP.
11. Saldos iniciales y arranque contable, 3.9.
12. Permisos de la contadora y separación de funciones, 5.4.

El carril de embarques continúa con 4.5/0574 y después 4.2.

## Decisiones que tomé por tu delegación

Para **0575**: cada documento se contabiliza en una operación atómica; un período cerrado bloquea salvo la excepción gobernada existente; los fallos se muestran dentro de «Por contabilizar»; el trabajo se entrega en tres PR sucesivas; los gastos entran en el contrato desde la primera parte.

El motivo de un fallo debe permanecer consultable sin dejar un asiento parcial. El mecanismo concreto todavía debe quedar resuelto y probado antes de implementar esa parte.

Para **0569**: la tasa automática de una factura en bolívares debe corresponder al día de emisión. Tener una tasa de un día anterior no basta para emitir. Una excepción elegida expresamente en el documento conserva su identificación y fecha; esa excepción no se deduce del simple hecho de que alguien haya cargado la tasa del catálogo a mano.

Tus decisiones anteriores del plan se conservan: fuente oficial BCV, USD/USDT 1:1, impuestos en pausa y sin conector con QuickBooks.

## Lo que solo puedes aportar tú

- El OK nominal de cada migración, cuando se presente su paquete revisado y su previa.
- La superclave del cierre.
- La carga de tasas BCV del día cuando entre 0569, mientras se completa la automatización.
- La decisión expresa sobre los datos de prueba y la primera fecha de cierre del mes real.
- Los Excel 60 y 64 para la tarea #262, que permanece aparte.

## Diferencias con el documento abierto en Claude

El [plan de Claude](https://claude.ai/artifact/A1hEYVry1GXFZJdnj2ui1z#d53c897e-ffb6), leído directamente el 20 de octubre, conserva un corte de la 1:10 p. m. de Caracas. Se reconcilió con ramas, pruebas y handoffs:

- El pago ya está resuelto.
- Los trece reemplazos son **0572**, aunque una lista todavía los llama 0571.
- 0572 y 0574 ya tienen implementación; no están solo empezando el diseño.
- La prueba final de 0571 ya terminó.
- Las decisiones delegadas de 0575 ya quedaron registradas.
- #301 necesita cerrar los hallazgos nuevos antes de solicitar la aprobación de su migración.

Las verificaciones periódicas, restauraciones del 21 y 22 de octubre y pendientes de la oficina conservan su registro en el handoff del Director. Este seguimiento no crea nuevas autorizaciones ni una automatización.
