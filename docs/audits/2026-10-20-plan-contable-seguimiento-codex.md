# DTD Cargo · Checklist del plan contable

**Actualizado:** 20 de octubre de 2026, 11:55 p. m. (Caracas). **Responsable:** Director Codex.

**Objetivo:** llevar la contabilidad completa en Studio y dejar QuickBooks cuando el ERP esté listo.

**Dónde vamos:** seis puntos del plan original y cinco mejoras adicionales ya están integrados y publicados. La **2.1 sigue en curso**: reportes y reemplazos están respaldados en la PR #310; el cálculo anual y sus pantallas quedaron entregados localmente en la **PR #311 en borrador, versión final `8729f7f4`**, con construcción aprobada y cierre incompleto **16/17** por historial productivo sin medir, más omisiones y avisos declarados. **El primer tramo de Caracas está en la PR #312 en borrador, candidato `9cbe8749`:** revisiones, pruebas focales de aplicación, SQL/API local y revisión visible acotada completadas. La segunda validación general está en marcha después de corregir una expectativa de prueba heredada; todavía falta su resultado y cierre documental. Caracas anual, gastos móviles y BCV siguen preparados, sin implementar. Push y PR funcionan; las comprobaciones de GitHub siguen sin arrancar. La tarifa congelada conserva sus pendientes de base final y publicación.

**Cómo leerlo:** una casilla marcada significa que se terminó exactamente el paso escrito. En el checklist general, significa integrado y publicado. Dentro de una tarea abierta, una prueba aprobada puede tener ✓ aunque su publicación siga pendiente. Los resultados locales no se presentan como prueba de producción.

## Ahora mismo

- [ ] **Cerrar 2.1 · Tasa única.** Sam autorizó `0495_fx_rates_conversor_usd`; se aplicó y verificó a las 5:31 p. m. y la PR #301 se integró enseguida. **Falta publicar la web:** GitHub bloqueó el arranque. Sam aclaró que la tarjeta es rechazada y GitHub le exige esperar 48 horas para cambiarla por otra; ese plazo no garantiza todavía la habilitación. La web sigue en la versión anterior; el cierre permanece abierto.
- [x] **Completar la comparación local de pruebas contables.** Los mismos 854 casos aprobaron por ambos lados. Tiempo medido: 10 min 42 s → 6 min 2 s. La mejora todavía espera integración.
- [ ] **Completar tarifa congelada.** Las correcciones ya están publicadas en su rama y pasaron 62 pruebas locales; falta validarlas con la base final.

### Trabajo durante la espera de GitHub

- [x] Recibir la instrucción de Sam de continuar localmente la 2.1 y subir entregas en PR en borrador. Se conservan separados implementación, pruebas, integración y publicación.
- [x] Confirmar el motivo con Sam: tarjeta rechazada y espera de 48 horas para cambiarla por otra. No se cambió ningún pago ni límite.
- [x] **Comprobar que el push sí funciona.** GitHub conserva reportes `a30d8585`, publicador `021e96cd` y este seguimiento en la PR #308, además de las PR #309 y #310 creadas durante el bloqueo. El bloqueo observado afecta a Actions; el código puede seguir respaldándose y las entregas revisables pueden quedar en PR en borrador.
- [x] Asignar la retoma local de **0572-a**: incorporar #301 y probar reportes, rankings, totales y exportaciones con facturas sin tasa. La implementación nueva y sus pruebas se marcarán por separado al comprobarse.
- [ ] Completar la cobertura pendiente de esa entrega local y aprobar sus comprobaciones de GitHub cuando arranquen. La implementación y su revisión local ya están respaldadas en la PR #310; los límites de la corrida se detallan abajo.
- [x] Revisar una alternativa de publicación: el comando manual requiere una imagen ya construida y admitida por GitHub. No se encontró una vía habilitada que sustituya esa comprobación; el prompt también condiciona publicar a recuperar GitHub. Ninguna alternativa ejecutada.
- [x] Aclarar el cambio de GitHub: Sam cambió el nombre del perfil. GitHub confirma el mismo repositorio bajo `SoftAgentes/DTDCARGO`, en una cuenta de usuario, y los enlaces anteriores redirigen. La compatibilidad del publicador con ese nombre se está revisando por separado.
- [x] Comprobar que el publicador instalado todavía espera el nombre anterior y asignar un ajuste aislado que reconozca el nuevo y conserve las imágenes históricas.
- [x] Preparar 43 combinaciones de prueba del publicador y respaldarlas en su rama, `297d566a`. Su script de producción todavía no cambió en ese punto; la ejecución local tiene ahora el turno.
- [x] Reproducir la incompatibilidad y aprobar la reparación local del publicador: primero 10 fallos de aceptación y después **190/190 controles aprobados**, sin omisiones, con datos simulados y red deshabilitada. El servidor sigue sin cambios.
- [x] Completar los controles locales del publicador: **seis errores intencionales detectados**, **30/30 pruebas del promotor aprobadas**, sintaxis e índices aprobados. Revisión independiente del código y de la instalación propuesta aprobada; código `b6af34a3` y cierre documental `021e96cd` respaldados en su rama.
- [x] Validar ese ajuste y dejar la [PR #309](https://github.com/SoftAgentes/DTDCARGO/pull/309) preparada en borrador, versión `021e96cd`. La creación de PR también funciona. GitHub todavía no tiene resultado aprobado de esa versión; no se modificó el publicador del servidor.
- [ ] Aprobar las comprobaciones remotas del ajuste y decidir su integración e instalación concreta cuando se recupere Actions. Su preparación no autoriza producción; la recuperación requerirá comprobarlo además del pago.
- [ ] Recuperar la publicación normal de #301 cuando se habilite GitHub y comprobar la versión realmente servida. **La migración 0495 ya está aplicada y no se repite.**

Se adelanta trabajo local, se respalda cada rama y se preparan PR en borrador durante la espera; la secuencia de integración de abajo se conserva. GitHub documenta que el uso de Actions puede quedar bloqueado al agotar la cuota sin un medio de pago válido; no se confunde ese servicio con el respaldo de código. [Documentación oficial de Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions). 0572 deberá volver a contrastarse con la base que incluya las entregas anteriores, especialmente el reverso de 0573.

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
- [x] Preparar y revisar independientemente el procedimiento de aplicación e integración, con comprobación de la versión y del historial.
- [x] Recibir de Sam el OK nominal de `0495_fx_rates_conversor_usd` en producción.
- [x] Aplicar y verificar la migración: versión de historial `20261020213122`, archivo y funciones iguales a los aprobados; conteo anterior conservado 0 → 0.
- [x] Integrar enseguida la PR #301: `d410ab2e`, a las 5:31:24 p. m.
- [x] Comprobar el acceso básico de la web anterior después de aplicar: login disponible y acceso sin sesión al Dashboard redirigido al login. Esto no prueba aún las nuevas funciones.
- [ ] Comprobar la publicación y las pantallas permitidas de Studio. GitHub bloqueó el arranque por pago o límite; la web todavía sirve `8e9e0f50`.
- [ ] Registrar el sello de la migración y su evidencia de cierre.

[Ver PR #301](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/301). La última prueba general local corresponde a `6ff0f586`; `5d84ec0a` solo actualiza spec y handoff. El primer intento unitario local falló al iniciar dos procesos de pruebas; el reintento canónico pasó sin cambiar límites. Los tres pasos omitidos fueron ledger productivo y SQL/reconstrucción con Docker detenido. Los 246 contratos SQL y la reconstrucción anteriores conservan su evidencia propia y el mismo SQL; no se presentan como ejecuciones nuevas. [GitHub final aprobó](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/39493600656) a las 5:11 p. m. con una unitaria omitida y 31 pruebas del arnés no disponibles por falta del entorno Graphify; la corrida local del arnés había aprobado las 237. CI verde no equivale a prueba de producción.

### B. Reemplazar las 13 conversiones · SDD-0572-a

- [x] Guardar y publicar la implementación en su rama, versión `9c254107`.
- [x] Aprobar 71 pruebas focales, tipos y revisión estática.
- [x] Definir la retoma y las reglas de totales incompletos: subtotal y aviso visibles, sin certificar cuadre ni rentabilidad cuando falte una tasa. Su implementación y sus pruebas se comprobaron en los pasos posteriores.
- [x] Activar el encargo de retoma después de integrar #301, con alcance y pruebas definidos; ejecución local durante la revisión del pago.
- [x] Incorporar la tasa única corregida después de integrar #301: merge local `2df9d22d`, con `d410ab2e` como padre. Adopción, limpieza inicial y propiedad comprobadas; las funciones compartidas conservadas.
- [x] Preparar diez escenarios y reproducir los problemas sobre el código anterior: 23 comprobaciones fallaron y 179 pasaron en 40 segundos, sin fallos de arranque ni de infraestructura. Las protecciones ante lecturas truncadas pasaron; la propagación del estado incompleto y su presentación requieren corrección.
- [x] Aprobar la comprobación focal de ranking, totales, control de ingreso y exportación con facturas sin tasa: **202/202 pruebas**, sin omisiones. Las mismas 23 comprobaciones que fallaban ahora pasan; validación general todavía pendiente.
- [x] Ampliar la regresión a **632/632 pruebas**, sin omisiones; detectar los **21 errores intencionales**, restaurar los archivos y aprobar tipos y revisión estática.
- [x] Revisar los componentes reales con datos ficticios en claro y oscuro, incluido ingreso incompleto, mayor vacío y nominal mixto. El ranking permite consultar sus columnas en un contenedor de 390 píxeles; no se certifica con ello un teléfono real.
- [x] Guardar y respaldar la corrección inicial en `220a2c3e`, con 58 archivos permitidos y las pruebas anteriores identificadas por esa versión.
- [x] Investigar los dos fallos observados en la validación general: contratos de pruebas anteriores al filtro «Tasa» y a la eliminación de una lectura de facturas. Su actualización exacta queda autorizada.
- [x] Reproducir los seis hallazgos nuevos antes de corregir: nueve archivos con 43 comprobaciones fallidas y 141 aprobadas, sin omisiones. Se ajustaron cuatro selectores de pruebas y se confirmaron los fallos funcionales de esas pantallas; no se confunden con defectos de arranque. Reparaciones comprobadas en los pasos siguientes.
- [x] Corregir y probar localmente el contador al mezclar dos facturas distintas, una vinculada por identificador y otra por código, conservando la pertenencia a cada embarque.
- [x] Conservar y probar estado y contador en Reportes/Mixto y CSV; no afirmar que no hay saldos cuando solo falta convertirlos.
- [x] Evitar y probar que el constructor presente un importe sin conversión como cero definitivo, aunque se agrupe por cliente; conservar el cero conocido y los conteos.
- [x] Mostrar y probar la incompletitud de fondos en Cobranzas y contar los cobros por identificar aunque carezcan de tasa.
- [x] Aprobar las nueve suites de los seis hallazgos nuevos: **184/184 pruebas**, sin omisiones, después de reproducirlos sobre la versión anterior.
- [x] Ampliar la regresión nueva a **751/751 pruebas en 35 archivos**, sin omisiones, incluida la conservación del redondeo anterior del total de volumen.
- [x] Detectar los **22 errores intencionales de las correcciones** y comprobar otra vez los **21 controles anteriores**, con archivos restaurados. Un caso de Aging se repitió con la suite que contiene sus tres escenarios; los recibos iniciales se conservan.
- [x] Aprobar tipos y revisión estática de 61 archivos, sin advertencias; comprobar 65/65 rutas permitidas y respaldar el nuevo código y sus pruebas en `3c36a7b2`.
- [x] Corregir la disposición estrecha de Mixto, CBM y Constructor y el pie que todavía decía «CNY → 0»: `4dbdb21b` respaldada en GitHub. Última columna consultable en contenedor de 390 píxeles y sin desborde de página, con datos ficticios; 18 pruebas de los tres componentes, tipos y revisión estática aprobados. No certifica teléfono físico ni Studio autenticado.
- [x] Completar la revisión visible y la revisión independiente de `4dbdb21b`: sin hallazgos materiales adicionales. Los seis hallazgos financieros quedaron corregidos; el delta visual conserva sus cálculos y las otras 61 rutas. Dictamen local condicionado a la prueba general pendiente.
- [x] Aprobar las pruebas generales de la aplicación sobre `4dbdb21b`: **12.378 aprobadas y una omitida**, sin reintento, en 9 min 42 s. El control auxiliar terminó dentro de su límite y sus archivos conservan los mismos bytes de la base.
- [x] Registrar el cierre de navegación: **177 aprobadas, una recuperada al reintentar y 20 omitidas**, en 10,3 minutos. Playwright forzó el cierre de un proceso; el verificador aceptó el paso **con aviso**, bajo su política existente. El log queda conservado; no se presenta como una ejecución sin incidencias ni se atribuye una causa no demostrada.
- [x] **Terminar y documentar la corrida general local sobre `4dbdb21b`:** de 7:10 a 7:37 p. m., **14 de 17 pasos medidos sin fallos y construcción aprobada**. El verificador declara **CIERRE INCOMPLETO**: historial productivo, SQL y reconstrucción quedaron sin medir por falta de credenciales o Docker. Conserva también el aviso de navegación y sus omisiones. La salida 0 no significa validación verde completa.
- [x] Abrir la [PR #310](https://github.com/SoftAgentes/DTDCARGO/pull/310) en borrador y completar su documentación: cabeza final `a30d8585`, producto y pruebas idénticos a `4dbdb21b`, base `d410ab2e`. Director comprobó el delta documental, rama remota, descripción, alcance 65/65 y árbol limpio; procesos cerrados y propiedad de escritura liberada. Su creación y sus push funcionaron durante el bloqueo. La ejecución remota de la versión final volvió a fallar antes de arrancar.
- [ ] Completar las comprobaciones pendientes para el cierre íntegro, revalidar la base final después de las entregas anteriores, especialmente 0573, y aprobar sus comprobaciones de GitHub.
- [ ] Integrar su PR y comprobar la publicación.

La primera validación general de `220a2c3e` quedó **interrumpida e incompleta** después de observar los dos fallos y recibir los hallazgos independientes. No hay resultado global aprobado. Las pruebas focales y la revisión visible anteriores conservan su evidencia de esa versión; las correcciones nuevas requieren pruebas y revisión propias.

### C. Resto de la 2.1

- [x] Delimitar los reemplazos SQL, las fechas de Caracas y la carga BCV que faltan, con sus dependencias y criterios de prueba. Es preparación; su implementación sigue pendiente.
- [x] Preparar un árbol aislado para **0572-b**, desde la entrega `a30d8585` de #310, y comprobar las dependencias actuales. La revisión de diseño confirma una transición compatible que conserva la interfaz anterior; la allowlist final y la implementación se registrarán por separado.
- [x] Asignar al tramo SQL la migración **`0498_annual_billing_fx_v2`**, después de inventariar 480 refs y los archivos de los worktrees. Se reutiliza SDD-0572. Esta asignación no autoriza aplicarla en producción.
- [x] Aprobar y enviar la asignación completa de **0572-b** al Worker: 41 rutas exactas, transición compatible, subtotal decimal, estados y contadores hasta los cuatro consumidores, pruebas locales PostgreSQL/PostgREST y revisión independiente. Un solo turno pesado; ejecución asignada, resultados aún pendientes.
- [x] Cerrar la revisión independiente del diseño y comprobar la adopción del Worker antes de producto, con árbol propio y contrato guardado. Preparación de dependencias aprobada sin cambiar el archivo de versiones.
- [x] Reproducir **cinco fallos funcionales** sobre el producto anterior `a30d8585`: el Portal pierde el estado v2 y confunde error con ausencia; Fidelización descarta solo excluidas y suma claves repetidas; el cruce CRM acepta páginas truncadas. **27 comprobaciones aprobadas, cero omitidas**. Los cinco fallos son los problemas a reparar, sin fallos de infraestructura.
- [x] Aprobar la primera corrección acotada de las tres consultas: **31/31 comprobaciones, sin omisiones**, incluidos los cinco fallos reproducidos. La prueba anterior que confundía error con ausencia fue sustituida por su contrato de rechazo explícito. **SQL, interfaz HTTP, pantallas y cierre general siguen pendientes**; todavía no es un candidato final.
- [x] Aprobar el primer contrato SQL embebido con datos sintéticos: **2/2 controles PGlite**, con compatibilidad y rechazo sin la ampliación. Se corrigió la preparación de la prueba; **esto todavía no acredita PostgreSQL, JWT, caché HTTP ni producción**.
- [x] Corregir el caso de importe grande y aprobar **29 comprobaciones del código compartido**: mantiene los centavos exactos y rechaza un cálculo numérico que los perdería. La regresión ampliada anterior, 161 aprobadas y una fallida, conserva su recibo; no se presenta como verde general.
- [x] Aprobar **31 comprobaciones suplementarias de componentes y páginas**, sin omisiones, para Fidelización, CRM y Portal. La revisión visual y el conjunto completo siguen pendientes.
- [x] Ampliar el contrato embebido a **18/18 controles**, sin omisiones: incluye rechazos de instalación, compatibilidad y **13 errores intencionales detectados** con la fuente SQL conservada. El nuevo control discrimina el fallback UTC de la zona de sesión; los recibos anteriores de 17 controles se conservan.
- [x] Aprobar el conjunto focal de **247/247 comprobaciones en 18 archivos, sin omisiones**, incluyendo consultas, componentes, páginas, precisión y SQL. No sustituye la revisión completa ni el cierre canónico.
- [x] Implementar las fachadas SQL y llevar subtotal, contador y estado hasta Portal, Fidelización, Reportes y CRM: código respaldado en la PR #311, candidato corregido `3b1de986`. Esto completa implementación, no su validación general ni publicación.
- [x] Probar compatibilidad, permisos, paginación y casos sin tasa con datos sintéticos; cerrar la revisión independiente del código y registrar las omisiones reales de la corrida general. La comprobación de historial productivo sigue pendiente de release, sin aprobación de producción.
- [x] Respaldar el primer bloque SQL en `f9cc1dd1` y abrir la [PR #311 en borrador](https://github.com/SoftAgentes/DTDCARGO/pull/311), dependiente de #310: seis rutas con migración, contrato, PGlite y documentación. La adaptación de app y pantallas todavía está en desarrollo y no forma parte de ese checkpoint. Revisión SQL independiente en curso.
- [x] Aprobar el contrato en **PostgreSQL 17.11 local: 37 aserciones y reversión de los datos sintéticos**. Se corrigió la referencia temporal de la prueba; el recibo del primer fallo se conserva y la migración sigue idéntica a `f9cc1dd1`.
- [x] Aprobar las pruebas HTTP con **PostgREST 14.17 local**: función nueva ausente antes de instalar, disponible después de confirmar la migración y recargar el mismo proceso; decimal exacto, compatibilidad anterior y lectura de **1.202 grupos en páginas 500/500/202/0**. Se conserva el intento intermedio que falló por la paginación del arnés. Son identidades sintéticas; no certifica Auth alojado ni producción.
- [x] Guardar el suplemento `3b74e42b` en esa misma PR y cerrar su revisión SQL independiente junto con `f9cc1dd1`: sin hallazgos materiales nuevos en permisos, identidad, compatibilidad o errores. Reparación temporal y arnés cotejados; instrumentación adicional de recibos declarada como todavía no ejecutada.
- [x] Corregir y comprobar los recortes del cambio en navegador con datos ficticios: regiones recorribles por teclado y cifras completas en contenedores de 390 píxeles, más vista de escritorio. **28 comprobaciones posteriores aprobadas en cuatro archivos**. La aproximación de zoom no certifica zoom nativo ni accesibilidad integral; el recorte anterior de la tarjeta de recompensa Portal se comprobó idéntico en la base y se conserva fuera de alcance.
- [x] Detectar los **13 errores intencionales de la app**, restaurando las fuentes. La primera corrida tuvo tres sobrevivientes: se añadieron dos escenarios ausentes y se corrigió el foco del tercero; el suplemento detectó los tres por su aserción funcional. Los recibos iniciales se conservan; no se confunden con fallos del producto.
- [x] Respaldar la app y las pantallas en **`a734aa61`**, en la misma [PR #311 en borrador](https://github.com/SoftAgentes/DTDCARGO/pull/311): 40 rutas dentro de las 41 permitidas, rama local/remota iguales y árbol limpio en ese checkpoint. Tipos y corrección de revisión estática aprobados; se declaran dos advertencias anteriores al cambio.
- [x] Cotejar el suplemento SQL **`0de51227`** con revisión independiente: cambio exclusivo del nombre privado, sin alterar cálculos ni permisos. **18/18 controles embebidos, 13 errores intencionales, 37 aserciones PostgreSQL y API local aprobados**. La corrida nueva conserva doce respuestas negativas y las horas de inicio iguales del proceso antes y después de recargar. La migración 0498 continúa sin aplicar en producción.
- [x] Corregir y respaldar los **dos hallazgos de CRM y Portal** en **`3b1de986`**, misma PR #311 en borrador. CRM conserva la estimación legítima del prospecto cuando el cruce lo identifica y solo falla el cálculo anual; Portal muestra un aviso ante una respuesta inválida en vez de quedar vacío. **118/118 comprobaciones en nueve archivos, cero omisiones; diez errores intencionales detectados y fuentes restauradas; tipos y revisión estática aprobados**, con dos advertencias previas declaradas. Se conservan los intentos y errores de preparación de pruebas anteriores.
- [x] Cerrar por lectura los dos hallazgos de revisión sobre `3b1de986`, sin otros P1/P2 materiales en el delta acotado. Addendum financiero independiente guardado; la revisión SQL/contratos conserva sus límites propios. No sustituye la prueba general.
- [x] Completar el suplemento visual local de CRM y Portal con datos ficticios: ocho escenarios CRM y siete Portal, sin desborde de página a 390 píxeles. El intento inicial falló por exigir visibilidad a una sección vacía del caso null; el suplemento corrigió solo esa espera y aprobó los dos casos restantes. Recibos conservados, servidores propios cerrados. No acredita Auth, datos reales, teléfono físico ni accesibilidad integral.
- [x] Aprobar los primeros controles de la validación general sobre `3b1de986`: **237/237 del arnés, sin omisiones**, revisión estática, frontera de componentes de servidor, tipos y compilación de las cuatro funciones auxiliares. Es el resultado de esa etapa, separado del cierre global.
- [x] Aprobar la suite general de la aplicación sobre ese candidato: **12.538 pruebas aprobadas y una omitida**, 876 archivos aprobados y uno omitido, en 8 min 45 s y sin reintento. La omisión pertenece a la suite condicional del corpus real de proformas, no disponible. Documentación, numeración, banderas, componentes, gobernanza y referencias pendientes también aprobados. El historial productivo se omitió por falta de credenciales; no se consultó la base real. El resultado general está registrado en el paso de cierre siguiente.
- [x] Aprobar los **247/247 contratos SQL generales**, incluida 0498, con reversión total en PostgreSQL 17 local desechable. Es una comprobación distinta de las 247 pruebas focales anteriores.
- [x] Reconstruir y comprobar el esquema desde sus **490 migraciones: 472 aplicadas y 18 de historial verificadas**, con aislamiento de 219 tablas y dos tenants de prueba. Las radiografías corrieron sobre ese esquema efímero; no son una radiografía de producción.
- [x] Cerrar la navegación local **aceptada con aviso** bajo la política existente: **177 aprobadas, una recuperada al reintentar y 20 omitidas**, en 9,7 minutos. El primer intento de acceso dio navegación abortada; el sistema forzó cerrar un proceso que no terminó tras cinco minutos. Se conserva el log, sin atribuir una causa no demostrada. El informe JSON temporal original no quedó disponible; no se presenta una captura reconstruida como original.
- [x] **Terminar y documentar la corrida general local sobre `3b1de986`**, de 9:35:58 a 10:02:55 p. m., 26 min 57 s. **Construcción aprobada, 16/17 controles medidos y CIERRE INCOMPLETO** por historial productivo sin credenciales. Se conservan la unitaria omitida, las 20 omisiones de navegación, la recuperada al reintentar y el aviso de cierre forzado. Salida 0 no significa aprobación verde completa. GitHub confirma el borrador; las corridas de esa versión y del cierre final fallaron antes de arrancar, sin aprobación remota.
- [x] Guardar y cotejar el cierre documental final **`8729f7f4`**: únicamente spec y handoff cambiaron frente a `3b1de986`, con producto, pruebas y SQL idénticos. Revisión independiente sin hallazgo material nuevo; local, remoto y PR iguales, árbol limpio, propiedad de escritura liberada y cero procesos propios pendientes. El estado de conocimiento se registró con sus pendientes; no se publicó la bóveda. Turno de pruebas devuelto expresamente.
- [x] **Entregar localmente los reemplazos SQL y sus consumidores** en la PR #311 en borrador. Mantiene compatibilidad, importes exactos, subtotal, contador y aviso cuando falta tasa. La migración **0498 no está aplicada**. Esta casilla acredita la entrega local; integración, CI, comprobación del historial real y publicación siguen pendientes.
- [ ] Aprobar CI y la base final de #311 después de las entregas anteriores; revisar y autorizar por nombre 0498, integrar y comprobar publicación y recorridos con los permisos correspondientes.
- [x] Reservar y respaldar la **SDD-0576, hora Caracas**, tras inventario de 483 refs y worktrees. Diseño C1 revisado y C2 anual delimitado, preservando las ventanas distintas; 60 y 12 rutas respectivamente. Se incluye solo el manifiesto necesario para mantener referencias verificables de migraciones pendientes, sin debilitar controles. La asignación concreta se registra en el paso siguiente.
- [x] **Asignar Caracas C1 al Worker en árbol aislado**, desde `8729f7f4`, rama `codex/sdd-0576-fechas-caracas-operaciones`, con 60 rutas exactas y contrato completo enviado. Inventario final de 486 refs y worktrees confirma **0499_fechas_caracas_operaciones**, asignada solo a esta tarea, sin aplicación real. Turno de pruebas concedido después de terminar b y la consulta del Director.
- [x] Comprobar la adopción del Worker C1: propiedad y rama correctas, stub reservado adoptado en `eecfbbb1`, contrato íntegro guardado antes de producto y 60 rutas únicas. Recibo de las 10:19 p. m.; sin env copiados.
- [x] Preparar las dependencias propias de C1 con versiones congeladas: instalación aprobada, archivo de versiones idéntico antes y después y sin enlaces a dependencias de otro árbol.
- [x] Reproducir los primeros errores de Caracas antes de corregir: **20 fallos funcionales y 190 comprobaciones aprobadas en seis archivos**, más **seis fallos y 38 aprobadas en otros dos**, sin omisiones. Casos de vencimiento anticipado, fecha vacía/inválida, rangos de gastos, reporte futuro/reintento y factura/CxP que cambian de día después de una espera. Las correcciones y sus pruebas aprobadas todavía están pendientes; habrá regresiones adicionales para historia de gastos, asientos, emisión automática y replay SQL.
- [x] Ampliar las regresiones antes de sus respectivas correcciones: guarda histórica de gastos, **ocho fallos y una aprobada**; contexto de creación/recuperación Portal, **nueve fallos y 254 aprobadas**, sin omisiones. Comparten casos con las corridas anteriores; no se suman como pruebas distintas.
- [x] **Aprobar el primer bloque corregido de C1: 543/543 pruebas en 12 archivos, sin omisiones.** Incluye primitiva IANA y cambio histórico de offset, fechas/FX entre esperas, límites de gastos, guarda estricta de historia y Portal con recuperación del comprobante sin recrearlo. Recibo finalizado a las 10:31:36 p. m. Es un resultado acotado; todavía no es cierre general ni aceptación de la entrega completa.
- [ ] Reproducir los errores de fecha y corregir C1; probar emisión, asientos, cobros, pagos y recuperación del reporte Portal, sin cambiar fechas explícitas ni re-fechar historia.
- [x] Corregir y probar las fechas de los asientos y del emisor automático: **56/56 comprobaciones en dos archivos, sin omisiones**, después de reproducir 22 fallos funcionales. Los nueve fallbacks capturan el día antes de esperar; una fecha explícita y el instante de auditoría se conservan. El asiento automático toma la fecha realmente guardada en la factura, o queda pendiente con explicación si no puede comprobarla, sin repetir la emisión.
- [x] Aprobar las pruebas funcionales de los formularios reales: **31/31 en dos archivos, sin omisiones**, después de reproducir nueve fallos válidos. Fechas predeterminadas, edición y fila de gasto en distintas zonas comprobadas; el botón de reintento conserva IDs, datos y archivo aunque la fecha previa supere el nuevo máximo. Se conserva aparte el primer error de selector de la prueba. **Todavía falta navegador real y revisión visible**, sin certificarlos por estas pruebas.
- [x] Corregir la captura antes de esperas en los delegados de Cobros/Tesorería, dentro de las cuatro rutas adicionales autorizadas: **47/47 pruebas aprobadas**, después de reproducir 13 fallos funcionales. Fechas explícitas/vacías, permisos, payload original e importes conservados.
- [x] Autorizar y actualizar exclusivamente el inventario de la lectura acotada de fecha emitida: **20 archivos y 44 llamadas**, con el analizador y los controles intactos. Quinta ruta adicional; alcance de 65 rutas antes del siguiente ajuste.
- [x] Cotejar la regresión ampliada de aplicación: **697/697 casos en 19 archivos, sin omisiones**, terminada a las 10:54 p. m. Tipos y revisión estática pasaron; también el control de símbolos pendientes, con dos grupos declarados todavía sin aplicar. Son resultados sobre la versión en desarrollo, anteriores al ajuste del aviso que sigue; no sustituyen la validación final.
- [x] Delimitar la corrección del aviso de Warehouse: la factura emitida con asiento pendiente debe mostrarse como tal. **Alcance vigente: 68 rutas**, después de autorizar tipo, caller visible y prueba real de propagación. Misma tarea, rama y 0499; sin nueva automatización ni efectos financieros.
- [x] Corregir y probar el aviso de factura emitida/asiento pendiente: **48/48 comprobaciones en tres archivos, sin omisiones**, después de reproducir los dos mensajes contradictorios. El recorrido CN usa el resultado real del emisor y no repite emisión ni asiento. Tipos y revisión estática del ajuste aprobados.
- [x] Congelar y respaldar el primer candidato de aplicación **`5dadb103` en la [PR #312 en borrador](https://github.com/SoftAgentes/DTDCARGO/pull/312)**, apilada sobre #311 `8729f7f4`. Local/remoto coinciden, 62 rutas dentro de 68 permitidas y ninguna ajena. Dos revisores examinan esa versión fija mientras el único Worker continúa SQL. **Es una entrega parcial: SQL/HTTP, mutantes, navegador y cierre general siguen pendientes.**
- [x] Terminar las dos revisiones iniciales de aplicación por versión fija: finanzas y fechas sin hallazgos materiales nuevos; Portal/Gastos con un P2 concreto de respuesta malformada, devuelto al Worker. No se aprueba la guarda histórica de `5dadb103` mientras ese ajuste siga sin revisión por versión nueva.
- [x] Reproducir, corregir y revisar el P2 de Gastos en **`d5f28fde`**, ya respaldado en la PR #312: cuatro fallos funcionales y después **18/18 aprobadas, sin omisiones**, con cero modificaciones, anulación o asiento ante ese error. Revisión independiente del delta de tres rutas cerrada, sin nuevo hallazgo; la PR sigue parcial y en borrador.
- [x] Reproducir los errores SQL sobre las funciones anteriores en PGlite local: cinco grupos fallan por fecha/default, cobro, emisión, cierre histórico y creación futura Portal. El replay idéntico aceptado también falla antes de la reparación. Se conserva el ensayo seleccionado con cinco grupos omitidos expresamente por su filtro; **todavía no acredita PostgreSQL real ni API HTTP**.
- [x] Aprobar los **seis grupos SQL funcionales de PGlite local, sin omisiones**, después de incorporar la reparación: defaults, operaciones, emisión automática, gasto histórico, nueva creación Portal y recuperación idéntica. Resultado terminado a las 11:11:15 p. m.; el candidato SQL y su identidad/revisión independiente todavía deben cerrarse. No sustituye PostgreSQL real, permisos y transporte HTTP.
- [x] Respaldar el candidato SQL **`b7148218` en la PR #312 en borrador**, con las 68 rutas dentro del alcance. Huella exacta de 0499 cotejada desde Git. Los dos contratos ampliados pasaron **8/8 pruebas, sin omisiones**; incluyen controles permanentes que reconocen el comportamiento anterior. Revisión SQL independiente en curso; PostgreSQL y API local ya iniciaron, sin resultado todavía al corte.
- [x] Ejecutar 0499 real en PostgreSQL 17.11 y API local PostgREST 14.17: **95 aserciones SQL, 39 controles del arnés y 41 respuestas HTTP** registradas. Versión antes/después en el mismo servicio, permisos/tenant/replay comprobados y recursos propios retirados. Paquete respaldado en **`de8b1961`**; no acredita Auth alojado, bytes actuales de Storage desde SQL ni producción.
- [x] Comprobar que el contrato SQL detecta **14/14 errores intencionales**, con la fuente original intacta. El caso de la guarda histórica también conserva el bloqueo del trigger restante; no se presenta como prueba de que ese error permitiría guardar un estado inválido.
- [x] Cerrar la revisión independiente del SQL `b7148218` y su suplemento HTTP `de8b1961`: sin hallazgos materiales nuevos, con identidad y límites de las pruebas documentados. La revisión exige comprobar por separado la composición con el cierre 0493 vigente; no declara C1 terminada.
- [x] Ejecutar la composición acotada de 0499 con el cierre **0493 real**: **33 aserciones PostgreSQL y reversión completa de la prueba**, con OLD/NEW, borrado, líneas, excepción autorizada e intentos inválidos; cinco errores intencionales adicionales detectados, fuentes intactas. PGlite focal: una prueba aprobada y cinco omitidas por selección, sin atribuirle una repetición completa. Suplemento respaldado en **`fd6e8146`**, solo pruebas, arnés y documentación; producto y 0499 iguales.
- [x] Cerrar la revisión independiente del suplemento hasta **`46c64bd0`**: dos negativas adicionales de 0493 probadas, **37 aserciones PostgreSQL** y recursos retirados. La revisión detectó una interferencia entre grupos de prueba; se reprodujo con dos fallos y siete aprobadas y se corrigió con **9/9 en los dos archivos completos, sin omisiones**. Producto y 0499 conservados; sin hallazgos materiales nuevos.
- [x] Completar los **29 controles de errores intencionales de aplicación**, con archivos originales restaurados: 25 reconocidos inicialmente, dos fallos funcionales de formularios reclasificados con evidencia y dos huecos de cobertura cerrados mediante regresiones de comprobante/replay. Estas últimas pasaron **265/265 pruebas en dos archivos, sin omisiones**, y detectaron ambos errores al repetirlos. Se conserva el primer resultado incompleto.
- [x] Completar la revisión visible acotada con componentes y estilos reales, datos ficticios y acciones simuladas: fechas en **390 y 1.280 píxeles, claro/oscuro**, rechazo de nueva fecha futura y reintento por Enter conservando fecha, IDs, datos y comprobante. Inspección del Director en navegador y teclado sin hallazgo material nuevo; se conservaron fallos de selectores y su suplemento aprobado. **Zoom nativo al 200 % no disponible; teléfono físico y Studio autenticado no ejecutados.** No certifica accesibilidad completa ni producción.
- [x] Registrar el primer intento general sobre **`46c64bd0`**, iniciado a las 11:39:19 p. m. y **INTERRUMPIDO/INCOMPLETO** al detectar una prueba que esperaba “hoy” para fecha vacía. Los 237 controles del entorno aprobaron; la suite general no terminó y sus resultados no se suman a otra corrida. Procesos propios retirados.
- [x] Autorizar una única ruta adicional de prueba, **69 en total**, y corregir el contrato heredado: vacío da error; omisión o `undefined` toman el día de Caracas. Primero **33 aprobadas y una fallida**; después **36/36, sin omisiones**, con los dos bordes de medianoche, monto, moneda y fecha explícita conservados. Tipos y revisión estática aprobados. Director revisó el delta mínimo **`9cbe8749`**, respaldado en la PR #312; aplicación y SQL intactos.
- [x] Iniciar la segunda validación general sobre **`9cbe8749`**, a las 11:49:03 p. m., con fuentes congeladas y manifiesto de identidad. Pasaron **237/237 controles del entorno sin omisiones**, revisión estática, fronteras, tipos y las cuatro funciones de backend; conserva 15 advertencias anteriores de revisión estática y cero errores. **La suite de aplicación sigue en curso, sin resultado global aprobado.** Es la única corrida pesada activa.
- [ ] Terminar las pruebas generales y el cierre documental de C1, conservando sus revisiones aprobadas, y completar la PR #312 en borrador. GitHub no aprobó el checkpoint: sus dos intentos medidos terminaron antes de arrancar, por `startup_failure`.
- [ ] Implementar después Caracas C2 para los cálculos anuales, con número de migración coordinado por inventario nuevo y las ventanas propias de Portal y Studio conservadas.
- [ ] Cerrar un slice posterior acotado de gastos móviles antes de certificar toda la hora Caracas: el caller activo conserva fechas UTC explícitas y guardas anteriores. Detectado y cotejado por lectura, fuera de las 68 rutas de C1; sin implementación ni autorización de datos reales.
- [x] Preparar y revisar el diseño del slice móvil: siete rutas propuestas, sin bloqueante estructural ni nueva migración identificada. Conserva propiedad del gasto, fotos y datos al rechazar, y pone todas las guardas antes de modificar la evidencia. Base final, encargo y pruebas de implementación posteriores a C2 siguen pendientes.
- [ ] Unificar la hora de Caracas para emisión, asientos, cobros y pagos.
- [x] Consultar el origen oficial del BCV desde esta máquina y comprobar que publica una **fecha de valor** propia: en la lectura de las 8:28 p. m. del 20 mostró el 21. Esto no carga ninguna tasa ni acredita disponibilidad diaria o conexión desde el servidor; la tarea debe tratar expresamente las fechas futuras.
- [x] Revisar y aprobar el diseño acotado de la carga BCV: fecha exacta de hoy Caracas, decimal completo, protección de cambios concurrentes, ensayo sin escritura y respaldo manual. Reutiliza SDD-0569, 27 rutas propuestas al incluir el manifiesto de referencias pendientes, sin nueva migración. Todavía no existe importador ni agenda instalada.
- [ ] Implementar la carga diaria desde el BCV oficial y el respaldo manual.
- [ ] Comprobar el comportamiento cuando no exista una tasa vigente.

**Conocimiento, separado del producto:** la consulta del Director sobre main `d410ab2e` terminó a las 10:13 p. m.: estructura Graphify y Archify vigentes, semántica piloto 15/16 y global 15/1.322; Obsidian pendiente. La rama #311 no tiene grafo propio ni runtime Archify y conserva su comprobación incompleta. No se publicaron borradores en la bóveda compartida ni se presenta salida 0 como cobertura completa.

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

- [ ] **#301 · Tasa única:** migración autorizada, aplicada y verificada; PR integrada. Publicación retenida por GitHub; cierre pendiente.
- [ ] **#304 · Pruebas PGlite:** comparación local completa y revisada, 854/854 por lado; el verde de `b28e9046` es anterior. La rama incorporó #301 en `8fb4edee`; su nuevo arranque quedó bloqueado por GitHub. Revalidar esa cabeza antes de integrar y esperar la publicación de #301.
- [ ] **#306 · Oficina de agentes:** incorporar base final; GitHub aprobó `2f9b336c`. El aislamiento real entre perfiles sigue sin verificar.
- [ ] **#307 · Tarifa congelada:** base y validación final → previa → OK de 0496 → aplicar e integrar → publicación y cierre.
- [ ] **0573 · Reverso al anular:** reparar hallazgos → pruebas y PR → revisión y previa → OK de 0497 → aplicar e integrar.
- [ ] **Sellos de migraciones:** cada uno mediante una PR propia, después de comprobar su aplicación.

Después seguimos: **0572 → hora Caracas → 2.2 → 2.6 → 2.3 → 2.7 → 2.8 → 2.4 → 2.9 → 2.10 → conciliación bancaria → 3.9 → 5.4**. Carril de embarques: **4.5 y luego 4.2**, respetando sus dependencias.

## Lo que necesita Sam

- [x] Resolver el bloqueo anterior de GitHub Actions. Confirmado en su momento por Sam y por corridas reales.
- [x] Aclarar el bloqueo actual de GitHub Actions: Sam confirmó tarjeta rechazada y espera de 48 horas para cambiarla, en el perfil renombrado.
- [ ] Confirmar la habilitación de Actions cuando se resuelva el pago; las 48 horas informadas no se presentan como resolución comprobada.
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
