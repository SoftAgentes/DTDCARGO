# DTD Cargo · Checklist del plan contable

**Actualizado:** 20 de octubre de 2026, 5:14 p. m. (Caracas). **Responsable:** Director Codex.

**Objetivo:** llevar la contabilidad completa en Studio y dejar QuickBooks cuando el ERP esté listo.

**Dónde vamos:** seis puntos del plan original y cinco mejoras adicionales ya están integrados y publicados. La **2.1 sigue en curso**. La tarifa congelada pasó su revisión local; todavía espera la validación final y su publicación.

**Cómo leerlo:** una casilla marcada significa que se terminó exactamente el paso escrito. En el checklist general, significa integrado y publicado. Dentro de una tarea abierta, una prueba aprobada puede tener ✓ aunque su publicación siga pendiente. Los resultados locales no se presentan como prueba de producción.

## Ahora mismo

- [ ] **Cerrar 2.1 · Tasa única.** La corrección, la revisión independiente, las pruebas locales y GitHub final ya aprobaron, con sus omisiones declaradas. El paquete final y la previa del servidor también pasaron. **Lista para el OK nominal de `0495_fx_rates_conversor_usd`.** Aplicación, integración y publicación siguen pendientes.
- [x] **Completar la comparación local de pruebas contables.** Los mismos 854 casos aprobaron por ambos lados. Tiempo medido: 10 min 42 s → 6 min 2 s. La mejora todavía espera integración.
- [ ] **Completar tarifa congelada.** Las correcciones ya están publicadas en su rama y pasaron 62 pruebas locales; falta validarlas con la base final.

## 2.1 · Conversión a dólares — EN CURSO

### A. Tasa única y conversor · SDD-0569 · PR #301

- [x] Crear la tabla y una sola regla de conversión, con ocho decimales.
- [x] Distinguir la tasa del catálogo de una excepción elegida expresamente en la factura.
- [x] Exigir tasa del día para emitir automáticamente una factura en bolívares.
- [x] Proteger la factura contra dos ediciones simultáneas.
- [x] Corregir el formulario al cambiar entre bolívares y yuanes.
- [x] Aprobar 89 pruebas específicas de aplicación, 32 de SQL local y 39 controles de regresión.
- [x] Completar la prueba general local: 12.277 aprobadas en el reintento y una omitida; construcción aprobada.
- [x] Completar las pruebas de navegación: 176 aprobadas, 20 omitidas y dos aprobadas al reintentar.
- [x] Completar 246 contratos SQL y reconstruir 471 migraciones más 18 registros de historial en una base local desechable.
- [x] Comprobar el formulario visible con datos ficticios.
- [x] Preparar el paquete y pasar la revisión de solo lectura del servidor sobre `eb22e2d4`, a las 3:29 p. m. **Esa revisión no aplicó la migración.**
- [x] Corregir y probar localmente la tasa del aviso: 37 pruebas y dos controles de regresión aprobados. Si se emite con 40, el aviso muestra 40; una excepción expresa de 36 conserva 36.
- [x] Guardar y publicar esa corrección en su rama: versión `6ff0f586`.
- [x] Cerrar la revisión independiente del aviso, sin hallazgos nuevos.
- [x] Terminar la prueba general sobre `6ff0f586`: 14 de 17 pasos ejecutados aprobados, con 12.278 unitarias en el reintento y una omitida; navegación 177 aprobadas, una recuperada al reintentar y 20 omitidas; construcción aprobada.
- [x] Publicar el cierre documental `5d84ec0a`, conservando idénticos el producto, sus pruebas y SQL.
- [x] Aprobar GitHub de la versión final `5d84ec0a`: 12.278 pruebas aprobadas, construcción y controles aprobados; una unitaria y 31 controles Graphify omitidos declarados.
- [x] Regenerar el paquete de `5d84ec0a` y pasar la revisión previa del servidor; renovada a las 5:10 p. m. Solo lectura; no se aplicó la migración.
- [x] Preparar y revisar independientemente el procedimiento de aplicación e integración, con comprobación de la versión y del historial. Su ejecución sigue pendiente.
- [ ] Recibir de Sam el OK nominal de `0495_fx_rates_conversor_usd` en producción. Solicitud presentada a las 5:14 p. m.
- [ ] Aplicar la migración autorizada e integrar la PR enseguida.
- [ ] Comprobar la publicación y las pantallas permitidas de Studio.
- [ ] Registrar el sello de la migración y su evidencia de cierre.

[Ver PR #301](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/301). La última prueba general local corresponde a `6ff0f586`; `5d84ec0a` solo actualiza spec y handoff. El primer intento unitario local falló al iniciar dos procesos de pruebas; el reintento canónico pasó sin cambiar límites. Los tres pasos omitidos fueron ledger productivo y SQL/reconstrucción con Docker detenido. Los 246 contratos SQL y la reconstrucción anteriores conservan su evidencia propia y el mismo SQL; no se presentan como ejecuciones nuevas. [GitHub final aprobó](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/39493600656) a las 5:11 p. m. con una unitaria omitida y 31 pruebas del arnés no disponibles por falta del entorno Graphify; la corrida local del arnés había aprobado las 237. CI verde no equivale a prueba de producción.

### B. Reemplazar las 13 conversiones · SDD-0572-a

- [x] Guardar y publicar la implementación en su rama, versión `9c254107`.
- [x] Aprobar 71 pruebas focales, tipos y revisión estática.
- [x] Definir la retoma y las reglas de totales incompletos: subtotal y aviso visibles, sin certificar cuadre ni rentabilidad cuando falte una tasa. Su implementación y nuevas pruebas siguen pendientes.
- [ ] Incorporar la tasa única corregida después de integrar #301.
- [ ] Comprobar que el ranking, los totales y el control de ingreso no traten como completo un conjunto con facturas sin tasa; conservarlo también al exportar.
- [ ] Terminar validación completa, controles de regresión y revisión visible.
- [ ] Abrir, revisar e integrar su PR; comprobar la publicación.

### C. Resto de la 2.1

- [x] Delimitar los reemplazos SQL, las fechas de Caracas y la carga BCV que faltan, con sus dependencias y criterios de prueba. Es preparación; su implementación sigue pendiente.
- [ ] Reemplazar las conversiones pendientes en SQL, con una entrega separada.
- [ ] Unificar la hora de Caracas para emisión, asientos, cobros y pagos.
- [ ] Implementar la carga diaria desde el BCV oficial y el respaldo manual.
- [ ] Comprobar el comportamiento cuando no exista una tasa vigente.

La regla USD/USDT 1:1 ya está decidida. Los bolívares quedan para reportes. La conversión del mayor pertenece a **2.3** y no se marca terminada al cerrar estos reemplazos.

## Checklist general del plan

### Fase 1 · Base visible — INTEGRADA

- [x] **1.1 · Radiografía repetible de integridad.** SDD-0559, [PR #284](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/284). Una nueva radiografía de producción necesita autorización propia.
- [x] **1.2 · Portal sin facturas anuladas presentadas como deuda.** SDD-0556, [PR #280](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/280).
- [x] **1.3 · Saldo único por cliente y cabecera de su ficha.** SDD-0558, [PR #286](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/286).
- [x] **1.4 · Reportes contables con una cifra de ingreso, diario y comprobación.** SDD-0557, [PR #283](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/283).
- [x] **1.5 · El borrador de factura conserva el embarque.** SDD-0555, [PR #277](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/277).

### Fase 2 · Integridad contable

- [ ] **2.1 · Tasa única y conversión a dólares.** EN CURSO; pasos detallados arriba.
- [ ] **2.2 · Asientos sin fallos silenciosos.** DISEÑO REVISADO: SDD-0575. Cinco decisiones y contrato propuesto guardados en `8a614250`; implementación pendiente.
- [ ] **2.3 · Mayor en USD y equivalentes en bolívares para reportes.** PENDIENTE.
- [ ] **2.4 · Candado del mayor, cuentas y asientos.** PENDIENTE.
- [ ] **2.5 · Reverso contable al anular una factura.** EN REVISIÓN: SDD-0573, implementación guardada y reparación de los 14 hallazgos definida. Se conservará la cifra oficial facturada y se mostrará el ajuste por anulaciones al comparar meses; un asiento borrador debe revisarse antes de anular. Las correcciones y sus pruebas siguen pendientes.
- [ ] **2.6 · Cobros multimoneda, anticipos, un recibo para varias facturas y pagos al proveedor.** PENDIENTE.
- [ ] **2.7 · Reporte de pago del portal que genera recibo y asiento.** PENDIENTE; antes requiere las migraciones 0422 y 0423, cada una autorizada.
- [ ] **2.8 · Notas de crédito y débito, abonos y compensaciones del cliente.** PENDIENTE; la parte de impuestos conserva su pausa.
- [ ] **2.9 · Factura emitida inmutable y segunda aprobación para anular.** PENDIENTE; va después de 2.8.
- [ ] **2.10 · Paquete de la contadora y conciliación de auxiliares.** PENDIENTE.
- [x] **2.11 · Candado del crédito de referido.** SDD-0567, [PR #298](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/298), migración 0494 sellada.

### Fase 3 · Documentos, reportes y arranque

- [ ] **3.1 · Número de control y correlativo al emitir.** PENDIENTE; captura manual y lotes decididos.
- [ ] **3.3 · Líneas reales de factura y cuenta de ingreso por servicio.** PENDIENTE.
- [ ] **3.4 · Libros y exportaciones en bolívares.** PENDIENTE; la posición de IVA sigue EN PAUSA.
- [ ] **3.5 · Reportes del Diario y Mayor en bolívares y paquete ampliado de la contadora.** PENDIENTE; el libro del ERP sigue en USD.
- [ ] **3.6 · Revaluación mensual y diferencia cambiaria.** PENDIENTE.
- [ ] **3.8 · Nómina reflejada en el libro contable.** PENDIENTE.
- [ ] **3.9 · Saldos iniciales, cuentas de apertura y fecha de arranque.** PENDIENTE; adelantado a la puesta en marcha del ERP.
- [ ] **Conciliación bancaria dentro del ERP.** PENDIENTE; requiere tarea propia.

### Fase 4 · Operación de embarques

- [ ] **4.1 · Tarifa congelada por embarque.** VALIDADA LOCALMENTE: SDD-0571, [PR #307](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/307), `ba43747a`. Pasaron 62 pruebas, siete controles y revisión visible. Faltan base final, validación completa, OK de 0496 y publicación; el alcance completo conserva la comparación/importación de Excel del plan maestro.
- [ ] **4.2 · Envío por cliente al consolidar y llegada gobernada.** PENDIENTE; sigue a la tarifa congelada.
- [ ] **4.3 · Aviso y factura al llegar desde cargos confirmados.** PENDIENTE; depende también del número de control.
- [ ] **4.4 · Pre-factura al zarpar, cargos posteriores y cierre al entregar.** PENDIENTE.
- [ ] **4.5 · Embarques sin facturar y tarjetas de Dirección.** IMPLEMENTADO EN RAMA: SDD-0574, `18edcd81`; faltan validación completa y PR después de 0571.
- [ ] **4.6 · Costo y margen real por embarque.** PENDIENTE.
- [ ] **4.7 · Cuenta corriente del socio China y fondos por rendir de la Operadora.** PENDIENTE; revisión de la contadora antes de construir.
- [ ] **4.8 · Compras asistidas y gastos cobrables generan su cargo al cliente.** PENDIENTE.
- [ ] **4.9 · Indemnización, recupero y compensación al cliente.** PENDIENTE.

### Fase 5 y relación con clientes

- [ ] **5.1 · Datos contables, contactos y condiciones de crédito del cliente.** PENDIENTE.
- [ ] **5.2 · Perfil completo del cliente, transacciones, documentos y abonos por fecha real.** PENDIENTE.
- [ ] **5.3 · Reportes y checklist del cierre mensual, con los ocho cuadres.** PENDIENTE.
- [ ] **5.4 · Permisos de la contadora y separación de funciones.** PENDIENTE; adelantado al arranque contable.
- [ ] **7.2 · Historial CRM en la ficha con resumen y enlace a Kommo.** PENDIENTE; sin copiar el chat por defecto.

## Mejoras adicionales ya integradas

- [x] «Por contabilizar» alineado con los recibos y la radiografía. SDD-0562, #287.
- [x] El cuadre conserva las monedas y excluye borradores. SDD-0563, #288.
- [x] Cuenta padre obligatoria: ninguna cuenta queda huérfana. SDD-0565, #291.
- [x] Cierre contable con superclave y reporte de excepciones. SDD-0566, #293. La función existe; Sam todavía debe definir su superclave.
- [x] La ficha de un cliente eliminado muestra correctamente ese estado. SDD-0568, #300.

## Secuencia inmediata de entrega

- [ ] **#301 · Tasa única:** revisión, validación final y previa aprobadas → OK de 0495 → aplicar e integrar → publicación y cierre.
- [ ] **#304 · Pruebas PGlite:** comparación local completa y revisada, 854/854 por lado; cierre documental publicado en `b28e9046` y GitHub aprobado. Falta integrar después de #301.
- [ ] **#306 · Oficina de agentes:** incorporar base final; GitHub aprobó `2f9b336c`. El aislamiento real entre perfiles sigue sin verificar.
- [ ] **#307 · Tarifa congelada:** base y validación final → previa → OK de 0496 → aplicar e integrar → publicación y cierre.
- [ ] **0573 · Reverso al anular:** reparar hallazgos → pruebas y PR → revisión y previa → OK de 0497 → aplicar e integrar.
- [ ] **Sellos de migraciones:** cada uno mediante una PR propia, después de comprobar su aplicación.

Después seguimos: **0572 → hora Caracas → 2.2 → 2.6 → 2.3 → 2.7 → 2.8 → 2.4 → 2.9 → 2.10 → conciliación bancaria → 3.9 → 5.4**. Carril de embarques: **4.5 y luego 4.2**, respetando sus dependencias.

## Lo que necesita Sam

- [x] Resolver el pago o límite de GitHub Actions. Confirmado por Sam y por corridas reales.
- [ ] Dar el OK nominal de cada migración cuando se presente su versión revisada.
- [ ] Definir la superclave del cierre.
- [ ] Cargar la tasa BCV del día cuando se publique 0569, mientras llega la carga automática.
- [ ] Decidir expresamente qué hacer con los datos de prueba; este checklist no autoriza borrarlos.
- [ ] Fijar la primera fecha de cierre del mes real.
- [ ] Entregar los Excel 60 y 64 para #262, que sigue aparte.

## Controles periódicos — cada ejecución se registra aparte

- [ ] Nueva radiografía de integridad, únicamente con autorización escrita.
- [ ] Revisar «Por contabilizar» y resolver lo pendiente.
- [ ] Cuadrar subdiario contra mayor y revisar excepciones al cierre.
- [ ] Revisar respaldos semanales y registrar la evidencia del período.
- [ ] Restore de prueba del **21 de octubre**.
- [ ] Restore de prueba del **22 de octubre**.
- [ ] Ejecutar los ocho cuadres del próximo cierre mensual.

El servicio de respaldo diario del 20 de octubre terminó con código 0 a las 2:06 a. m. Eso no marca como realizado un restore de prueba.

## En pausa o fuera del alcance actual

- **3.2, posición de IVA de 3.4 y 3.7:** impuestos en pausa por decisión de Sam.
- **Fase 6 y 7.1:** conector y corte hacia QuickBooks fuera del plan; el ERP será el libro único.
- **Oficina:** anexo de Telegram en PR posterior a #306; reporte Paperclip preparado, sin enviar. Sus pendientes operativos siguen en el handoff.

## Evidencia y mantenimiento

Este es el checklist que el Director actualiza a medida que verifica cada avance. Los detalles técnicos y las autorizaciones viven en el [registro de continuidad](../../.agents/handoffs/director-continuidad-codex-20261020.md#4-checklist-vivo-de-continuidad); el alcance completo permanece en el [plan maestro](2026-10-18-contabilidad-diagnostico-y-plan.md).

Los seis puntos originales y las cinco mejoras marcadas se contrastaron con sus PR fusionadas y se comprobó que sus commits son antecesores de `origin/main` `8e9e0f50`. El servidor informó esa misma versión publicada en su estado de las **3:40 p. m.**; el recibo general de publicación tiene **14 comprobaciones aprobadas y cero fallas**. No se volvió a probar cada recorrido autenticado en producción durante esta actualización.

Fuente de continuidad: [Plan contable de Claude](https://claude.ai/artifact/A1hEYVry1GXFZJdnj2ui1z#d53c897e-ffb6), leído el 20 de octubre y reconciliado con ramas, pruebas y handoffs. No se reutiliza como cifra actual su antiguo conteo de «36 tareas» sin reconciliar cambios de alcance, partes en pausa y la conciliación bancaria añadida.

El seguimiento queda guardado en esta rama y respaldado mediante la [PR documental #308](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/308). Que este archivo esté publicado en la PR no significa que sus tareas pendientes estén desplegadas.
