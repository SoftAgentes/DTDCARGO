# Tus pruebas en la app — L14, 0454, 0455, 0456, Tesorería, Cobranzas y el ensayo 0492–0497

- Fecha: 2026-09-18 los bloques 1 a 4; **2026-09-20 los bloques 5 y 6**; **2026-11-01 el bloque 7**.
- **El bloque 7 va en el entorno de prueba, no en producción.** Los bloques 1 a 6 son de producción
  y ya tienen su historia. Si vienes por el bloque 7, salta directo a él: no comparte nada con ellos.
- Bloques 1 a 4: los preparó la sesión Worker `claude-smokes-app-20260918`, verificados contra el
  código de `main` `78410913`. Sus citas `archivo:línea` están en el handoff
  `smokes-app-l14-0454-0472.md`.
- Bloques 5 y 6: los agregó la sesión Worker `claude-smokes-tesoreria-cobranzas-20260920`,
  verificados contra el código de `main` `f56e5245`. Sus citas están en el handoff
  `smokes-tesoreria-cobranzas-0488-0489-0492.md`.
- En los dos casos solo se leyó código: no se entró a producción ni con cuentas reales.
- Sustituye el bloque B del guion del 2026-09-14 (`director-ola-post-bloque-c-20260914-smokes.md`),
  que quedó incompleto frente al código actual. Los bloques A (0415) y C (0414) de ese guion siguen
  pendientes y no forman parte de este.

## Qué destraba cada bloque

| Bloque | Qué prueba | Estado en producción | Qué destraba |
|---|---|---|---|
| 1 | Crear y editar clientes por rol (0456, SDD-0472) | Aplicada el 2026-09-16 | Evidencia de que la 0456 no rompió a ningún rol que sí debe editar |
| 2 | Preparación: factura de prueba y Portal del cliente | — | Los bloques 3 y 4 |
| 3 | Reportes de pago del Portal y del Studio (L14) | 0420 y 0421 aplicadas el 2026-09-13; **0422 y 0423 en espera** | **0422**, después **0423** y, con OK aparte, **la PR #114** |
| 4 | Borrar un cliente: revoca el Portal y deja auditoría (0454, SDD-0467; 0455, SDD-0469) | Aplicadas el 2026-09-15 | El cierre de SDD-0467 y la evidencia que falta en SDD-0469 |
| 5 | Tesorería: pagar y anular órdenes de pago a proveedores (0468, SDD-0489; 0470, SDD-0492) | 0468 aplicada el 2026-09-19 a las 20:05; 0470 el 2026-09-19 a las 22:13 | El último paso del release de SDD-0489, que es este smoke |
| 6 | Cobranzas: cobrar, identificar un pago sin referencia y anular un recibo (0467, SDD-0488) | Aplicada el 2026-09-18 a las 22:19 | El último paso del release de SDD-0488, que es este smoke |
| 7 | Portal y registro primero; después facturas, cobros y libro diario, con la web nueva y la base nueva, en prueba (0497, SDD-0573). **Omitiste tu parte: R10 y los pasos 1, 2 y 7** | **Sin aplicar en producción** | Nada con tu aceptación. El Director cita tu omisión y lo medido al pedirte el OK nominal, y no lo reemplazan |

Los bloques 5 y 6 son independientes de los bloques 1 a 4 y entre sí: no comparten cliente, factura
ni proveedor, y puedes hacerlos en cualquier orden o en otro día. Las horas son de Caracas.

En la tabla, el primer número es la **migración** y el segundo la **SDD**, que son series distintas
y se cruzan: la migración 0454 es la SDD-0467, y la migración 0467 es la SDD-0488. No son lo mismo
aunque se repita el 0467.

## Antes de empezar

- **Cuentas del Studio:** admin (la tuya), accounting y commercial. Support es opcional (bloque 1,
  paso 4).
- **Un correo tuyo que no sea de ningún cliente**, para el cliente de prueba. Por ejemplo, un alias
  «+prueba» de tu Gmail. No lo escribas en ningún documento del repo.
- **Dos ventanas:** el Studio en tu navegador de siempre y el Portal en una ventana de incógnito o en
  otro navegador, para que las dos sesiones no se mezclen.
- **Avisa al equipo antes del bloque 3.** Cada reporte de pago que crees manda un correo a todos los
  admin («Pago reportado · {código} — {monto}») y un mensaje al Telegram del equipo. Cancelar,
  confirmar o rechazar no le avisa a nadie. Al cliente no le llega nada.
- **Correos que salen a tu alias:** al crear el cliente con email salen la bienvenida y la invitación
  al Portal. Al emitir la factura puede salir otro, según las reglas de Studio › Mailing.
- **Textos:** pon «PRUEBA» en nombres, notas y motivos, sin datos personales. **El motivo con el que
  confirmas o rechazas un reporte lo ve el cliente en el Portal.**
- **Si algo falla:** anota la pantalla, el rol, lo que viste y el código que muestre el error
  (`PAGO-…`). Detén ese bloque y déjalo fuera de tu autorización.

### Solo para los bloques 5 y 6

- **Rol:** los dos módulos son de dinero y solo los ven **accounting** o **admin**
  (`lib/studio/rbac.ts:117,119`). Con cualquier otro rol la pantalla ni siquiera abre.
- **Plan de cuentas sembrado en Contabilidad.** Sin él no se puede registrar ni un pago ni un cobro:
  - **cuentas de caja/banco**, que son las postables con `qbo_type = Bank` o con código que empieza
    en `1.1.1` (`lib/studio/payment-queries.ts:631`). Las usan los dos bloques;
  - **cuentas de costo/gasto**, que son las postables de tipo costo de ventas o gasto, o con código
    que empieza en `5.` o `6.` (`lib/studio/treasury/bill-queries.ts:357-369`). Solo las usa el
    bloque 5, para causar la CxP.

  Si falta alguna, el formulario te lo dice en amarillo en vez del selector y no te deja seguir.
- **Un solo navegador basta.** Estos dos bloques no usan el Portal.
- **No hace falta avisarle al equipo:** ni Tesorería ni Cobranzas mandan correos ni Telegram.
- **Las cabeceras de las migraciones mienten.** Los archivos `0467_cobro_factura_atomico.sql`,
  `0468_pago_proveedor_atomico.sql` y `0470_rls_escritura_cobros_proveedores.sql` todavía empiezan
  con «⚠️ NO APLICADA A PRODUCCIÓN». Es texto viejo que **no se edita por política**: el ledger
  guarda el texto exacto con el que se aplicó cada migración, y corregirlo rompería la identidad por
  md5. El estado real vive en el ledger y en `supabase/migrations-baseline.json`, donde las únicas
  esperas que quedan son `0422` y `0423`. Las tres están aplicadas.

### Qué queda en producción después de las pruebas

- La factura de prueba, anulada, y su asiento de venta, anulado (bloque 4, paso 1). **Anular la
  factura no anula el asiento**: hay que anularlo aparte en Contabilidad.
- Los reportes de pago con sus comprobantes. Por diseño, no se borran.
- Los clientes de prueba, borrados. El borrado es lógico: la fila y los eventos de auditoría quedan,
  y desde el Studio no se puede restaurar.

Del bloque 5 (Tesorería):

- **Un proveedor de prueba**, que **no se puede borrar ni desactivar desde la pantalla**: el tab
  Proveedores solo tiene «Editar». Va a quedar en la lista de proveedores para siempre; por eso el
  nombre lleva «PRUEBA».
- **Una CxP de prueba, pagada**, con sus **dos órdenes de pago**: una anulada y otra vigente. Las
  órdenes anuladas no se borran, y la CxP pagada sale de la cola pero queda en la base.
- **Los asientos contables** de la causación de la CxP y de la salida de caja de cada orden. Igual
  que con la factura del bloque 4, **anular la orden de pago no anula su asiento**: si quieres
  dejar la contabilidad limpia, hay que anularlo aparte en Contabilidad › Libro diario.

Del bloque 6 (Cobranzas):

- **Los recibos de cobro** de la factura de prueba, incluido el anulado. Por diseño, no se borran, y
  su numeración `R-AAAA-NNNN` consume números de la serie del año.
- **El pago sin identificar** que crees para el paso de identificación, ya identificado.

## Bloque 1 · Crear y editar clientes por rol (0456, SDD-0472)

La 0456 ya está aplicada. Este bloque comprueba que los roles que deben editar clientes todavía
pueden hacerlo.

1. [ ] Con **commercial**: Studio › Clientes › «+ Nuevo cliente».
   - Tipo «Persona (cédula)», Nombre «PRUEBA SMOKE 18-SEP», Tier «Regular» y, en Email, tu alias.
   - Pulsa «Crear y abrir perfil».
   - Esperado: aviso «Cliente DTD-XXXX creado» y la ficha abierta. **Anota el Shipping Mark.**
2. [ ] Con el mismo rol: «Editar cliente», cambia Notas a «prueba de edición» y pulsa «Guardar
   cambios». Esperado: se guarda sin error.
3. [ ] Con **accounting** u **operations**: repite el paso 2. Esperado: se guarda.
4. [ ] Opcional, con **support**:
   - «Editar cliente» › «Guardar cambios». Esperado: «No tienes permiso para realizar esta acción.»
     en el recuadro rojo.
   - «Eliminar» › «Eliminar cliente». Esperado: el mismo mensaje dentro del diálogo, y el cliente
     sigue ahí.
   - Los botones se ven igual para support: el bloqueo aparece al guardar, no antes.
5. [ ] En la ficha, la tarjeta «Acceso al portal» dice «Invitado», porque la invitación salió al
   crear. Si dice «Sin habilitar», pulsa «Invitar al portal».

Si los pasos 1 a 3 fallan con un error de permisos, es una regresión de la 0456. Para ahí y avísame
antes de seguir. Lo mismo si te pasa con admin: desde la 0453, un admin con más de una membresía
activa no resuelve su tenant.

## Bloque 2 · Preparación: factura de prueba y Portal del cliente

1. [ ] Con **accounting** o admin: Studio › Facturación › «+ Nueva factura».
   - Shipping Mark: el del bloque 1. Nombre del cliente: «PRUEBA SMOKE 18-SEP». Moneda: USD.
   - Una línea: descripción «Prueba smoke», cantidad 1, precio 10.00.
   - «Crear borrador» y, en el detalle, «Emitir factura».
   - Esperado: la factura queda «Emitida». **Anota su código.**
   - Emitirla genera un asiento de venta en Contabilidad. Se anula en el bloque 4.
2. [ ] En la ventana de incógnito, abre el correo de invitación que llegó a tu alias (el enlace vale
   una hora) y entra al Portal. Esperado: ves el Portal y, en el Studio, la tarjeta «Acceso al portal»
   pasa a «Activo».

## Bloque 3 · Reportes de pago (L14) → destraba 0422, luego 0423 y la PR #114

Qué cambia la 0422: la base deja de aceptar escrituras directas sobre los reportes de pago, y solo
pasan los comandos que la app ya usa desde la 0421. Después de la 0422, revertir solo la app no es
una vuelta atrás segura; por eso se prueba antes. Revisé el código de `main`: ninguna pantalla
escribe directo sobre los reportes, así que la 0422 no debería romper nada de lo que usa el equipo.

**Portal**, en la ventana de incógnito, con el cliente de prueba:

1. [ ] Facturas › la factura de prueba › «Reportar pago».
   - «Monto pagado» 1.00; en «¿Cómo pagaste?», Transferencia; «Fecha del pago», hoy.
   - «Comprobante»: una imagen o un PDF cualquiera, sin datos personales. Por ejemplo, una captura
     con la palabra PRUEBA.
   - «Nota (opcional)»: «prueba 1».
   - Pulsa «Reportar pago».
   - Esperado: «Reporte registrado.». Con «Volver a la factura», en «Tus reportes de pago» aparece un
     reporte «Pago reportado».
2. [ ] En ese reporte: «Cancelar reporte», Motivo «prueba de cancelación», y pulsa **«Cancelar
   reporte»**. El botón gris «Cancelar» sólo cierra el diálogo.
   - Esperado: pasa a «Cancelado» y sigue así al recargar. **Nuevo:** el «Motivo: prueba de
     cancelación» también sigue visible después de recargar.
   - **El reporte cancelado NO desaparece de la lista: se conserva por diseño**, con su chip
     «Cancelado». A partir de aquí vas a ver ese reporte junto a los que crees después; eso es
     correcto y no es una duplicación.
   - Antes el motivo desaparecía al recargar. Lo arregló la 0464, aplicada el 19-sep a las 01:00
     UTC. Si vuelve a desaparecer, anótalo en «Si algo falló».
3. [ ] Segundo reporte, igual que el paso 1, con la nota «prueba 2». Esta vez pulsa «Reportar pago»
   **dos veces seguidas, rápido**.
   - Esperado: se crea **un solo** reporte nuevo y el equipo recibe un solo aviso.
   - **En pantalla quedan dos reportes en total**, y eso es lo correcto: «prueba 1» con el chip
     «Cancelado» (el del paso 2, que se conserva) y «prueba 2» con «Pago reportado».
   - Sería falla ver **dos** «prueba 2», las dos como «Pago reportado», o que al equipo le lleguen
     dos avisos de ese mismo reporte.
4. [ ] Tercer reporte, igual que el paso 1, con la nota «prueba 3». Esperado: hay tres reportes, uno
   «Cancelado» y dos «Pago reportado».

**Studio**, con **accounting**:

5. [ ] Facturación › la factura de prueba › sección «Reportes de pago del cliente · 3». En el
   reporte cancelado, «Ver comprobante» abre el archivo: el comprobante sigue en el historial. El
   enlace caduca a los 5 minutos; si falla, recarga la página.
6. [ ] Opcional: abre la misma factura en una segunda pestaña y no la toques.
7. [ ] En «prueba 2»: «Confirmar pago», Motivo «Pago verificado (prueba)», y «Confirmar pago».
   - Esperado: «Pago confirmado».
   - La factura pasa a «Parcial» y el pagado sube 1,00.
   - No se crea recibo ni movimiento de caja: así funciona desde la 0421.
8. [ ] Opcional: en la segunda pestaña, sin recargar, «Confirmar pago» sobre el mismo reporte.
   Esperado: un error con el código `PAGO-ESTADO`. El pagado sigue en 1,00: no se suma dos veces.
9. [ ] En «prueba 3»: «Rechazar», Motivo «Reporte de prueba», y «Rechazar reporte». Esperado:
   «Reporte rechazado», y el pagado no cambia.

**Portal**, otra vez:

10. [ ] Recarga la factura. Esperado: «prueba 2» dice «Pago confirmado», con su motivo; «prueba 3»,
    «Reporte rechazado»; y «prueba 1», «Cancelado». El Portal no le muestra el comprobante al
    cliente: eso es así por diseño.

**Avisos:**

11. [ ] Los admin recibieron tres correos «Pago reportado · …» (uno por reporte creado), y el
    Telegram del equipo tres mensajes. No hubo avisos por cancelar, confirmar ni rechazar.

**Después de tu OK:**

- El Director aplica la 0422 y te avisa. Creas tres reportes nuevos de 1,00: cancelas uno (paso 2),
  confirmas otro (paso 7) y rechazas el tercero (paso 9).
- Después aplica la 0423. Creas dos reportes: cancelas uno y confirmas el otro.
- La 0423 la verifica el Director en el catálogo. Su prueba completa exige renombrar el Shipping Mark
  de un cliente con reportes sobre facturas archivadas, y eso no se hace solo para probar.

La factura necesita tener menos de 10,00 pagado para poder anularla al final: una factura
«Pagada» ya no se anula. Con las repeticiones llegas a 3,00; no confirmes montos mayores.

## Bloque 4 · Borrar un cliente (0454 → SDD-0467; 0455 → SDD-0469)

Hazlo **al final**, cuando el bloque 3 y sus repeticiones estén cerrados: borrar el cliente le
revoca el Portal. Si quieres cerrarlo hoy sin esperar a la 0422 y la 0423, usa otro cliente de prueba
con otro alias (por ejemplo «+prueba2»), invitado al Portal y con sesión abierta como en el bloque 2.
Entonces el paso 1 no aplica.

1. [ ] Limpieza, solo si usas el cliente de los bloques 1 a 3:
   - Facturación › la factura de prueba › «Anular factura», con el motivo «Factura de prueba del
     smoke».
   - Contabilidad › «Libro diario» › el asiento de venta de esa factura › «Anular asiento», con el
     mismo motivo.
2. [ ] Deja el Portal del cliente de prueba abierto en la ventana de incógnito.
3. [ ] Studio, con **commercial** o admin: la ficha del cliente › «Editar cliente» › «Eliminar».
   - El diálogo dice: «Vas a eliminar a PRUEBA SMOKE 18-SEP (Shipping Mark DTD-XXXX). Sale de las
     listas del Studio y pierde su acceso al Portal: se revocan su vínculo y sus códigos de acceso.
     Desde el Studio no se puede restaurar.»
   - Motivo: «Cliente de prueba del smoke». Pulsa «Eliminar cliente».
   - Esperado: «Cliente DTD-XXXX eliminado. Ya no aparece en las listas.»
4. [ ] En el Portal, recarga. Esperado: te manda a la página de entrada. Si pides un enlace nuevo
   con tu alias, la pantalla dice «Revisa tu correo», pero no llega nada. Eso es a propósito.
5. [ ] Studio › Clientes: recarga y busca el Shipping Mark. **Anota si el cliente borrado sigue
   apareciendo.** Según el código, lo más probable es que sí: la lista y la ficha no filtran los
   borrados. No bloquea nada de esto; va como hallazgo aparte.
6. [ ] Si la ficha todavía abre:
   - La tarjeta «Acceso al portal» debe decir «Revocado».
   - Pulsa «Eliminar» otra vez, sin motivo. Esperado: «No se eliminó ningún cliente: ya estaba
     eliminado, no existe o no tienes acceso a él. Recarga la lista.»
7. [ ] Con **admin**: Administración › «Audit log», o directo
   `/studio/admin?section=audit&auditEntity=client&auditEvent=client_deleted`.
   - Esperado: un evento «client» · «Client deleted», con tu nombre en «Actor» y «Completado» en
     «Resultado».
   - Con Entidad «portal_invitation» aparece a la misma hora «Portal access status changed».
   - **El motivo no se ve en pantalla**: el visor no expone el contenido del evento. Si quieres
     confirmarlo, autoriza al Director a leer por SQL el motivo de esos eventos de prueba. Es una
     lectura de producción y hay que nombrarla.
8. [ ] Borrado sin motivo. Crea otro cliente, «PRUEBA SIN MOTIVO 18-SEP», **sin email** (así no sale
   ningún correo), y elimínalo con el motivo vacío.
   - Esperado: se borra, y en «Audit log» aparece otro «Client deleted».
   - El motivo por defecto, «Cliente eliminado sin motivo indicado (SDD-0469).», solo se ve por SQL.

## Bloque 5 · Tesorería: pagar y anular órdenes de pago (0468 → SDD-0489; 0470 → SDD-0492)

Las dos migraciones ya están aplicadas: la 0468 el 19-sep a las 20:05 y la 0470 el 19-sep a las
22:13, hora de Caracas. Este smoke es el último paso del release de SDD-0489. La 0468 puso el pago
y la anulación en **una sola transacción**, con la CxP tomada con candado; la 0470 dejó la escritura
de proveedores y cuentas por pagar solo para accounting y admin.

Todo Tesorería vive en **una sola pantalla**, `/studio/tesoreria`: los tres tabs («Cuentas por
pagar», «Pagos», «Proveedores») y los paneles laterales son estado de la pantalla, no direcciones
distintas. Si recargas, vuelves al primer tab y se cierra el panel que tuvieras abierto. **No lo
confundas con Studio › Proveedores, que es otro módulo.**

1. [ ] Con **accounting** o admin: Studio › Tesorería.
   - Esperado: el título «Tesorería.», cuatro tarjetas arriba («Por pagar», «Vencido», «Pagado en
     el mes», «Proveedores activos») y los tres tabs. **Anota el valor de «Pagado en el mes».**
2. [ ] Tab «Proveedores» › «+ Nuevo proveedor».
   - Nombre «PRUEBA TESORERIA 20-SEP», Tipo «Servicio», País «Venezuela (VE)». El resto, como venga.
   - «Crear proveedor». Esperado: aviso «Proveedor PRV-NNNN creado». **Anota el código.**
   - Ojo: **el proveedor no se puede borrar ni desactivar** desde la pantalla. Queda en la lista.
3. [ ] «+ Nueva CxP» (arriba a la derecha).
   - Proveedor: el del paso 2. Cuenta de costo / gasto a imputar: cualquiera del plan.
   - Concepto «Prueba smoke». Monto total **20.00**. Moneda **USD** (así no pide tasa).
   - Emisión: hoy. Vencimiento: hoy o mañana.
   - «Crear CxP». Esperado: aviso «CxP CXP-2026-NNNN creada · asiento de causación» y la CxP en la cola
     del tab «Cuentas por pagar». **Anota su código.**
4. [ ] Opcional, para la carrera del paso 10: abre `/studio/tesoreria` en una **segunda pestaña**,
   abre esa misma CxP y **no la toques más**.
5. [ ] **Pago parcial.** En la cola, pulsa la fila de la CxP › «Registrar pago».
   - «Monto a pagar (USD)» viene con el saldo completo: cámbialo a **5.00**. Debajo debe decir
     «Abono parcial · quedan $15.00 pendientes.».
   - «Cuenta de caja / banco que paga»: cualquiera. «Método»: Transferencia. «Fecha»: hoy.
     «Referencia (opcional)»: «PRUEBA».
   - Pulsa «Confirmar pago».
   - Esperado: aviso «Pago parcial registrado en CXP-2026-NNNN · orden OP-2026-NNNN». La CxP pasa a «Parcial»
     y el saldo baja a 15,00. **Anota el código de la orden.**
6. [ ] **Anular esa orden de pago.** En el mismo panel, en «Órdenes de pago · 1», pulsa «Anular» en
   la orden.
   - El diálogo dice «Anular orden de pago» y «La orden OP-2026-NNNN se anulará y se revertirá su saldo.
     Indica el motivo.».
   - **El campo dice «Motivo (opcional)» pero es obligatorio.** Prueba primero dejarlo vacío: el
     diálogo no te deja confirmar y no muestra ningún mensaje. Luego escribe «ab» (dos letras) y
     confirma: debe salir «Indica un motivo de al menos 4 caracteres.».
   - Escribe «Orden de prueba del smoke» y pulsa «Confirmar anulación».
   - Esperado: aviso «Orden OP-2026-NNNN anulada · se revirtió el saldo». La CxP vuelve a «Pendiente» y
     el saldo vuelve a 20,00.
7. [ ] **La orden anulada desaparece (cambió con SDD-0494).** Mira el historial de pagos del panel
   y el tab «Pagos».
   - Esperado: la orden que acabas de anular **ya no está**, ni en el historial del panel ni en el
     tab «Pagos». No queda botón «Anular» que pulsar, porque no queda fila.
   - Hasta esta tarea la orden anulada seguía listada con su «Anular» visible. Si la ves, **eso sí
     es falla ahora** — es justo lo que se arregló.
   - El guard del servidor sigue existiendo para las carreras (dos pestañas anulando a la vez):
     responde «Esta orden ya está anulada.» y no descuenta dos veces. Ya no se llega a él pulsando.
8. [ ] **Pago que salda la CxP, y cómo volver a abrirla (cambió con SDD-0494).** «Registrar pago»
   otra vez, con el monto completo **20.00**. Debajo debe decir «Pago total · salda la CxP.». Pulsa
   «Confirmar pago».
   - Esperado: aviso «Pago total registrado en CXP-2026-NNNN · orden OP-2026-MMMM», y **el panel se cierra
     solo y la CxP desaparece de la cola**: una CxP sin saldo sale de la lista. Eso sigue igual.
   - **Lo que cambió:** ahora sí puedes volver a ella. Ve al tab «Pagos», busca la fila de esa orden
     —la última columna dice **«Ver CxP»**— y púlsala (o llega con el tabulador y dale Enter).
   - Esperado: se abre el panel de la CxP saldada, con su historial. **No** debe ofrecer «Registrar
     pago» (no tiene saldo) ni «Anular CxP» (tiene pagos); **sí** debe ofrecer «Anular» sobre la
     orden. Ése es el camino que antes no existía.
   - Anúlala desde ahí, motivo «Pago devuelto». Esperado: la CxP **vuelve a la cola** con saldo
     20,00, y el panel pasa a mostrar ese saldo, no 0,00.
9. [ ] **Los totales.** Mira «Pagado en el mes» y compáralo con el valor que anotaste en el paso 1.
   - Esperado: la diferencia corresponde **solo a las órdenes vivas**. La orden que anulaste en el
     paso 6 **no** suma. Ese total incluye los pagos reales del mes, así que lo que importa es la
     diferencia, no el número.
   - En el tab «Pagos», «Pagado (histórico)» tampoco cuenta las anuladas.
   - Hasta esta tarea ambos totales las contaban. **Si al anular una orden el total no baja, es
     falla.** «Por pagar» y «Vencido» deben seguir correctos, como antes.
10. [ ] Opcional, **la carrera**: en la segunda pestaña del paso 4, sin recargar, «Registrar pago»
    sobre la misma CxP por **20.00** y «Confirmar pago».
    - Esperado: el error **«La CxP ya está pagada: otro pago la saldó. Actualiza la página.»**
    - Si en vez de ese sale «El monto supera el saldo vigente de la CxP: otro pago lo cambió.
      Actualiza la página.», también está bien: depende de en qué momento quedó la pestaña.
    - Lo que **no** puede pasar es que el pago entre y la CxP quede con 40,00 pagados. Eso sí sería
      falla, y es justo lo que arregló la 0468.
11. [ ] **Permisos por rol.** Cierra sesión y entra con **commercial** (o operations, warehouse o
    support). Escribe a mano la dirección `/studio/tesoreria`.
    - Esperado: **no ves Tesorería**. Te manda al Dashboard con el aviso «No tienes acceso a ese
      módulo. Si lo necesitas, pídele acceso a un administrador.». En el menú lateral tampoco
      aparece.
    - Repite con **accounting**: ahí sí debe abrir.

Si un pago entra por duplicado, si el saldo queda mal después de anular, o si un rol que no es
accounting ni admin logra entrar o registrar un pago, **para el bloque y avísame**: eso sí es una
regresión de la 0468 o de la 0470.

## Bloque 6 · Cobranzas: cobrar, identificar y anular recibos (0467 → SDD-0488)

La 0467 está aplicada desde el 18-sep a las 22:19, hora de Caracas. Este smoke es el último paso del
release de SDD-0488. Puso el cobro, la identificación y la anulación en **una sola transacción**,
con la factura tomada con candado, y serializó la numeración de los recibos.

Cobranzas vive en `/studio/cobranzas`. **No hay una lista general de recibos**: un recibo se ve en
el panel de su factura, en el detalle de la factura (Facturación), en la bandeja «Sin identificar»
mientras no tenga factura, y por el buscador **⌘K** (faceta «Pagos»), que lleva a su página
imprimible `/studio/cobranzas/recibo/<código>`.

1. [ ] **Preparación.** Con **accounting** o admin, crea un cliente de prueba **sin email** (así no
   sale ningún correo), «PRUEBA COBRANZAS 20-SEP», y emítele una factura como en el bloque 2, pero
   de **30.00 USD** (descripción «Prueba smoke», cantidad 1, precio 30.00). **Anota el código de la
   factura y el Shipping Mark.**
   - Es un cliente y una factura aparte: este bloque no toca nada de los bloques 1 a 4.
2. [ ] Studio › Cobranzas.
   - Esperado: el título «Cobranzas.», cuatro tarjetas («Por cobrar», «Vencido», «En promesa de
     pago», «Tasa de cobro»), la tarjeta «Separación de fondos · mandato» y la cola con tu factura.
3. [ ] Opcional, para la carrera del paso 9: abre `/studio/cobranzas` en una **segunda pestaña**,
   abre esa misma factura y **no la toques más**.
4. [ ] **Cobro parcial.** Pulsa la fila de la factura › «Registrar cobro».
   - «Monto a cobrar (USD)»: **5.00**. Debajo debe decir «Abono parcial · quedan $25.00
     pendientes.».
   - «Cuenta de caja / banco»: cualquiera. «Método»: Transferencia. «Fecha»: hoy.
     «Referencia (opcional)»: «PRUEBA».
   - En «¿Quién realizó el pago?» deja **«Yo mismo (el cliente)»**. Si eliges «Un tercero» tienes
     que llenar nombre, relación y marcar la casilla de origen lícito, y eso queda guardado.
   - Pulsa «Confirmar cobro».
   - Esperado: la factura pasa a «Parcial», el saldo baja a 25,00 y en «Recibos · 1» aparece un
     recibo **`R-2026-NNNN`**. **Anota su código.**
   - El año del código sale de la fecha del servidor, no de la «Fecha» que pusiste.
5. [ ] **Anular ese recibo.** En «Recibos · 1», pulsa «Anular».
   - El diálogo dice «Anular recibo» y «El recibo R-2026-NNNN se anulará y se revertirá su saldo.
     Indica el motivo.». Igual que en Tesorería, **el campo dice «Motivo (opcional)» pero es
     obligatorio** y pide al menos 4 caracteres.
   - Motivo «Recibo de prueba del smoke» › «Anular recibo».
   - Esperado: aviso «Recibo R-2026-NNNN anulado · se revirtió el saldo». La factura vuelve a
     **«Emitida»** y el saldo vuelve a 30,00.
   - Vuelve a «Emitida» aunque la factura esté vencida: es así por diseño.
6. [ ] **El recibo anulado desaparece (cambió con SDD-0494).** Antes de esta tarea el recibo anulado
   se quedaba en «Recibos · 1» con su «Anular» visible y sin marca de anulado, y su página «Ver
   recibo» abría igual. Ahora no. Comprueba las cuatro cosas:
   - **Historial del panel**: debe decir «Sin cobros registrados todavía.» — el recibo anulado ya
     no está.
   - **Detalle de la factura** (`/studio/facturacion/<código>`): el bloque «Recibos de cobranza»
     tampoco lo muestra.
   - **Su página imprimible**: entra a `/studio/cobranzas/recibo/<código del recibo anulado>`.
     Esperado: **«No existe ese recibo.»**. Esto es lo más importante del bloque: antes abría e
     imprimía, y un recibo anulado impreso se le podía entregar a un cliente.
   - **Buscador ⌘K**: buscar ese código no debe devolverlo.
   - Si alguna de las cuatro te muestra el recibo anulado, **es falla**.
   - El guard del servidor («Este recibo ya está anulado.») sigue existiendo para las carreras —dos
     pestañas anulando a la vez— y no devuelve el saldo dos veces. Ya no se llega a él pulsando.
   - Mira también la tarjeta «Separación de fondos · mandato»: el recibo anulado **ya no suma** ahí,
     ni en «Sin identificar» si era un pago sin referencia. Las cuatro tarjetas de arriba deben
     seguir correctas, como antes.
7. [ ] **Pago sin referencia.** Arriba, pulsa «Pago sin identificar».
   - «Monto recibido» **10.00**, «Moneda» **USD**, «Cuenta de caja / banco» cualquiera, «Canal»
     Transferencia, «Fecha de recepción» hoy, «Notas (opcional)» «prueba sin referencia».
   - Pulsa «Registrar pago».
   - Esperado: aparece la sección **«Sin identificar · 1»** con ese pago. **Anota su código de
     recibo.** La sección solo existe cuando hay pagos sin identificar.
8. [ ] **Identificarlo.** En esa fila, pulsa «Identificar».
   - Elige el cliente «PRUEBA COBRANZAS 20-SEP» y la factura del paso 1.
   - Debe mostrarte un resumen del estilo «Se aplican $10.00 a <FACTURA> con imputación retroactiva
     al <fecha> (fecha de recepción de fondos). Quedará un saldo de $20.00.».
   - Pulsa «Identificar y aplicar».
   - Esperado: la bandeja «Sin identificar» desaparece (ya no queda ninguno), la factura pasa a
     «Parcial» y el saldo queda en 20,00.
   - Solo te ofrece facturas de la **misma moneda** y con **saldo ≥ el monto del pago**. Si no ves
     tu factura, revisa eso antes de anotarlo como falla.
9. [ ] **Cobro que salda la factura.** «Registrar cobro» con **20.00**. Debajo debe decir «Cobro
   total · salda la factura.». Pulsa «Confirmar cobro».
   - Esperado: **el panel se cierra solo y la factura desaparece de la cola**, igual que la CxP del
     bloque 5. Queda «Pagada».
   - Antes de que el panel se cierre, **anota el código del último recibo**; lo necesitas en el
     paso 11. Si se te pasó, lo encuentras en Facturación › la factura › «Recibos de cobranza».
10. [ ] Opcional, **la carrera**: en la segunda pestaña del paso 3, sin recargar, «Registrar cobro»
    por **20.00** y «Confirmar cobro».
    - Esperado: el error **«La factura ya está pagada: otro cobro o reporte la saldó. Actualiza la
      página.»**, o bien «El monto supera el saldo vigente de la factura: otro cobro o reporte lo
      cambió. Actualiza la página.», según en qué momento quedó la pestaña.
    - Lo que **no** puede pasar es que el cobro entre y la factura quede con más de 30,00 cobrados.
      Eso sí sería falla, y es lo que arregló la 0467.
11. [ ] **Busca el recibo por ⌘K.** Abre el buscador con ⌘K (Ctrl+K en Windows) y escribe el código
    del recibo del paso 9, o el nombre del cliente.
    - Esperado: aparece bajo la faceta **«Pagos»** y al abrirlo te lleva a la página imprimible del
      recibo, con el botón «Imprimir».
12. [ ] **Permisos por rol.** Igual que el paso 11 del bloque 5, pero con `/studio/cobranzas`: con
    **commercial** (u operations, warehouse, support) te manda al Dashboard con «No tienes acceso a
    ese módulo…»; con **accounting** abre.
    - Con un rol sin acceso, en el buscador ⌘K la faceta «Pagos» aparece **con candado**, sin
      resultados.

Si un cobro entra por duplicado, si el saldo de la factura queda mal después de anular o de
identificar, si un recibo sale con un código repetido, o si un rol que no es accounting ni admin
logra entrar o cobrar, **para el bloque y avísame**: eso sí es una regresión de la 0467 o de la 0470.

## Bloque 7 · Ensayo en prueba: portal y registro primero, después facturas (SDD-0573)

**Omitiste tu parte.** Literal: «Sí, omítela», a «¿Omito tu revisión y sigo solo con la medición?»,
2026-11-03 ~00:05Z, leído por el Director General. R10 y los pasos 1, 2 y 7 quedan **omitidos, no
aprobados,** y eso no autoriza aplicar ni publicar. Solo aceptaste una línea, la de `/privacidad`: está abajo,
en R10. El texto de tu parte queda como referencia, por si quieres hacerla después. Lo demás lo corrió la
sesión Worker de la SDD-0573 con un navegador automático, comparando contra la base: abajo dice qué
aceptación se omite.

Lo preparó esa sesión el 2026-11-01 y 02, sobre la imagen
`prueba-sha-db84f6ffdfae5cad8222ef99b81f58f52cf87d5d`, con la 0497 final ya aplicada en prueba. Los pasos 1,
2, 7a y 7b ya los recorrí el 2026-11-02 con un navegador automático, en facturas gemelas: `F-2026-0034`,
`F-0573-1008`, `F-0573-5003` y `F-0573-5002`. Salieron como dice abajo, y las tuyas siguen sin tocar. Lo que
falta es tu ojo: que lo que se ve tenga sentido para quien factura.

**Qué cambia, en una frase.** Desde la 0497, anular una factura deja su asiento de venta intacto y
crea un **reverso** que lo cancela, y la base deja de aceptar asientos automáticos editados a mano.

**Dónde y con qué:**

- **Dirección:** `https://prueba.dtdcargo.com`. Arriba de cada pantalla sale el aviso «Entorno de
  prueba». Si no lo ves, no sigas.
- **Puerta:** el navegador te pide usuario y clave antes de la página. Están en el servidor, en
  `/srv/dtd-cargo-staging/secretos/clave-web.txt` (`usuario:clave`). **Si ves «Forbidden» antes de que te
  pida la clave,** tu IP no está en la lista de prueba: no es un fallo del bloque, avísale al Director y para.
- **Cuenta:** `contabilidad@prueba.example.test`, rol accounting. Su clave está en
  `/srv/dtd-cargo-staging/secretos/cuentas-prueba.txt`, línea `clave_contabilidad`. Se lee por SSH y
  no va al chat ni a un documento.
- **No sale nada real:** sin Resend, Telegram ni Kommo. Los correos de la web quedan en cola, sin salir: no
  te llegará ninguno, ni hace falta para esta parte.
- **Datos:** usa solo el cliente `DTD-9001` («Cliente PRUEBA C.A.») y las facturas de abajo. Las otras
  facturas en borrador son de los consolidados reales que cargaste en octubre: no las toques. El libro
  diario trae 160 asientos «PRUEBA ensayo 0573: relleno», que puse para que las tablas tuvieran el
  tamaño de producción.

**Si algo falla:** anota el paso, lo que viste y el texto exacto. Para ese paso y sigue con el
siguiente.

### Primero: portal y registro

Entre `929cabf51` y `main`, ningún archivo de producto cambia en `app/portal`, `app/registro` ni
`lib/portal`; los alcanzan el consentimiento de cookies, un CTA móvil y tipos. Aun así va primero:
`smoke-web.sh` no mira estas rutas, y publicar podría romperlas con todo en verde. R1 a R9 ya los corrió el
Worker el 2026-11-02, con un navegador automático y contra la base. **R10 era tuyo y lo omitiste;** abajo está
su pasada automática, que no reemplaza tu opinión.

| # | Quién | Pantalla | Qué debe pasar | Obtenido |
|---|---|---|---|---|
| R1 | Anónimo | `/registro` | Alta express: Shipping Mark `DTD-NNNN` al instante, con su fila en `clients` y `client_users`. La bienvenida no sale en prueba: queda en cola | PASÓ. `DTD-9039`, aprobado, 1 acceso, de 47 a 48 clientes |
| R2 | Anónimo | `/registro`, repetido | Con el mismo documento, aviso y sin segunda fila. Con el campo trampa lleno, nada se escribe | PASÓ. «Esta cédula ya tiene una cuenta en DTD Cargo» y no deja seguir. Si el aviso no llega a tiempo, el servidor lo rechaza igual: siguen 48. El campo trampa está en la página; lleno no lo envié, lo cubre `register-antiabuse.test.ts` |
| R3 | Anónimo | `/api/registro/check` | Responde a un documento libre y a uno usado | PASÓ. Con la letra, `V-…`: libre `exists:false`, usado `exists:true`. Sin la letra responde `false`, por diseño: no lo chequea |
| R4 | Cliente nuevo | `/entrar`, con el enlace → `/portal` | Entra sin pantalla de espera | **El enlace no llega al buzón de prueba: FALLÓ, ver abajo.** Con un enlace acuñado en memoria, `/abrir` › «Entrar a mi portal» lleva a `/portal`: PASÓ |
| R5 | Cliente nuevo | `/portal`, `/perfil`, `/perfil/empresa`, `/envios`, `/facturas`, `/finanzas`, `/documentos`, `/mensajes`, `/soporte` | Todas abren vacías o «Al día», sin error | PASÓ, 9 de 9. `/mensajes` lleva a `/soporte` |
| R6 | Cliente con factura: `DTD-9001` | `/portal/facturas`, su detalle, `/aceptar`, `/reportar`, `/comprobante`, `/finanzas` | El saldo coincide con `client_outstanding` | PASÓ. El saldo de `/finanzas` es `open_amount`. No lista el borrador. **`/aceptar` no se vio:** `F-0573-1004` no está por aceptar, y devuelve a la lista |
| R7 | Cliente con factura anulada: `DTD-9001` | `/portal/facturas` | Una anulada con reverso no suma al saldo | PASÓ. `F-0573-1008` tiene su venta y su reverso; el portal la lista, y el saldo no la suma |
| R8 | commercial, admin | Studio › Clientes › ficha de `DTD-9039` | Aparece, con «Acceso al portal» y la revisión de identidad | PASÓ en los dos. support: NO DISPONIBLE, prueba no tiene cuenta de ese rol |
| R9 | Anónimo | Banner en `/registro` y `/entrar`: aceptar, rechazar, recargar. CTA en `/`, móvil 375 px y zoom 200 % | La decisión persiste, y el CTA a `/registro` no se corta | PASÓ, 12 de 12. El banner sale solo en esas dos rutas, por diseño; en `/` no. Zoom aproximado con un viewport de 188 px: el CTA entra, y la página mide 287 px de ancho |

**R4, por qué el enlace no llega.** `/entrar` acuña el enlace y lo manda por Resend, que prueba no tiene. Cae al
plan B, y Auth lo rechaza: `429`, «you can only request this after 59 seconds», porque acuñar ya contó como
envío. La pantalla igual dice «Revisa tu correo». No te frena: R10 no entra al portal.

R10. [ ] **Tu ojo sobre el registro** (5 min, omitido). En una ventana de incógnito:
   - `/privacidad`: cambió una línea, de «código de rastreo» a «Shipping Mark o número de envío». Es texto
     legal: dime si te parece bien.
   - `/registro`: llénalo con «PRUEBA Sam» y datos inventados, no los tuyos: cédula `31000573`, un WhatsApp y
     un correo cualquiera. Al entrar verás el aviso de cookies; elige lo que quieras. Dime si se entiende y si
     algo te frena.

**R10, pasada automática, 2026-11-03, 01:16Z, sin cuenta real.** No reemplaza tu opinión sobre el texto: esa
te la pregunta el Director.

| Qué | Obtenido |
|---|---|
| `/privacidad`, como la ve un visitante | Fila «Seguimiento de envío», literal: «El Shipping Mark o el número de envío que nos indicas al consultar con nuestro equipo el estado de tu carga.» «código de rastreo» ya no aparece |
| Tu aceptación de esa línea | Literal: «Sí, va bien», a «¿Te parece bien "Shipping Mark o número de envío" en /privacidad?». **Cubre solo esa línea.** La pregunta la resumía: la frase completa es la de la fila de arriba |
| `/registro` con «PRUEBA Sam», cédula `31000573` y datos inventados | PASÓ. `DTD-9040`, `V-31000573`, canal portal, aprobado. `clients` de 48 a 49 y `client_users` de 2 a 3: una fila en cada una, con 1 acceso activo. Salió el aviso de cookies; elegí Rechazar. 0 errores de página |
| Si se entiende y si algo frena | NO EJECUTADO: el navegador no opina |

### Tu parte, con contabilidad: omitida

No la hiciste: `F-0573-1005`, `F-0573-3001` y `F-0573-5001` siguen como se sembraron, medido en la base el
2026-11-03 a las 01:15Z. Hasta que corrí mis pasos, a las 01:10Z, la cuenta de contabilidad no tenía accesos
desde el 2026-11-02 a las 14:42Z. Lo que hay son las gemelas de arriba, con un navegador automático; no son tu
revisión.

1. [ ] **Emitir** (4 min). Facturación › «+ Nueva factura».
   - Shipping Mark `DTD-9001`, Nombre «Cliente PRUEBA C.A.», Moneda USD.
   - Una línea: «PRUEBA Sam», cantidad 1, precio 10.00.
   - Marca «Emitir al crear» y pulsa «Crear y emitir».
   - Esperado: aviso «Factura F-2026-NNNN creada». **Anota el código.**
   - Contabilidad › Libro diario: busca el código con Ctrl+F. Debe haber un asiento «Factura
     F-2026-NNNN», tipo Factura, «Asentado». **Si no está, es la falla más importante del bloque:**
     es lo que le pasa a la web vieja, y la nueva existe para que no pase.
2. [ ] **Anular sin cobros** (2 min). Abre `/studio/facturacion/F-0573-1005` › «Anular».
   - Motivo «PRUEBA Sam». Marca «Entiendo que la factura quedará anulada…» y confirma, o mantén
     presionado el botón.
   - Esperado: aviso «Factura F-0573-1005 anulada».
   - Libro diario, Ctrl+F `F-0573-1005`: **dos** asientos. La venta sigue «Asentado» y aparece «Reverso
     de la factura F-0573-1005 (asiento A-2026-NNNN del …)», con «Original y reverso identificados».
7. [ ] **Lo que la guarda frena, y lo que no** (4 min). Son dos casos distintos.
   - **7a. Sin venta: no se frena.** `F-0573-3001` no tiene ningún asiento de venta y está «Parcial», con
     5.00 cobrados.
     - Cobranzas › su fila › «Registrar cobro» por **5.00**. Esperado: «Cobro total registrado en
       F-0573-3001 · recibo R-2026-NNNN», y queda «Pagada».
     - Si no hay asientos, la base no tiene qué revisar. Lo que lo delata es Contabilidad › «Por
       contabilizar», que la sigue listando como «Sin asiento».
   - **7b. Con la venta inválida: se frena.** `F-0573-5001` está «Emitida» y su asiento de venta está
     anulado. La sembré así a propósito.
     - Contabilidad › «Por contabilizar»: la lista con la marca «Asiento anulado».
     - Cobranzas › su fila › «Registrar cobro» por **5.00**. Esperado: **no entra,** y la factura sigue
       «Emitida», sin recibo. Arriba del panel sale un aviso rojo: **«No se pudo registrar el cobro.»**, sin
       decir por qué. La base sí da el motivo, «La venta original requiere revisión.», pero ese texto no
       llega a la pantalla, y el panel sigue abierto, con la factura «Al día». **Dime si eso le alcanza a
       quien cobra, o qué debería decir.**
   - **La regla exacta, desde que dijiste «Sí, quítalo»:** toda escritura de una factura se revisa al
     guardar. Si su venta no cuadra, no se guarda: ni un cobro, ni un renombre de marca, ni anular un
     recibo. Antes habías elegido «Ajustar la guarda», que dejaba pasar esos cobros para no congelar
     las facturas de antes; esas facturas ya no existen. Hoy, en producción, este cobro todavía pasa,
     porque la guarda no se ha aplicado.
   - **Lo que lo vigila:** el control `scripts/qa/0497-control-posterior.sql`, que corre el Director. Ve lo
     que nadie toca: una factura sin venta, y una venta que quedó inválida. Dice cómo está cada factura,
     no de dónde vino.
   - **Lo que sigue abierto:** cualquier rol del sistema, con un cambio a mano, puede dejar inválida la
     venta de una factura sana tocando su cuenta en el plan de cuentas. Con esta regla esa factura deja
     de cobrarse hasta volver el valor. La guarda sobre el plan de cuentas es una tarea aparte; tu
     condición es que esté antes del uso real del ERP.

### Lo que corrió el Worker, sin tu parte

Corrió el 2026-11-03, 01:10–01:15Z, con un navegador automático, después de `verify` y con 0 corridas pesadas.
Cada número se saca de la base justo antes de leer la pantalla, y se comparan los dos. **30 PASÓ y 1 FALLÓ, que
es de mi comparación:** ver la tarifa, en el paso 9.

**Cambió el alcance de los pasos 6 y 9,** porque tu parte no se hizo y tus tres facturas siguen sin tocar.
`F-0573-1005` no se lista en «Por contabilizar» porque sigue emitida con su venta viva, no porque esté anulada.
El saldo del paso 9 cuenta las tres como vivas. Lo esperado sale de la base, así que no hubo que cambiar ningún
valor; cambia lo que significan.

| Paso | Qué hace, con qué cuenta | Esperado | Obtenido |
|---|---|---|---|
| 3 | Contabilidad: cobra 5.00 de `F-0573-1006`, intenta anular, anula el recibo y anula la factura | «Anular» deshabilitado con «Tiene 1 cobro(s) vivo(s): para anularla, anúlalos primero en Cobranzas.»; al final, anulada, con venta y reverso | PASÓ. Recibo `R-2026-0002`; «Anular» deshabilitado con ese texto; recibo anulado; `F-0573-1006` anulada, con venta y reverso, según la base. El aviso de la anulación no lo capturé |
| 4 | Contabilidad: libro diario, venta de `F-0573-1007` | «Anular» deshabilitado con «Asiento automático o vinculado protegido. Revísalo desde la factura; no admite cambios manuales.» | PASÓ. `A-2026-0007`: deshabilitado, con el motivo |
| 5 | Contabilidad: anula un asiento «PRUEBA ensayo 0573: relleno» | «Asiento A-2026-NNNN anulado», y en la base `anulado` | PASÓ. «Asiento A-2026-0179 anulado», y en la base `anulado` |
| 6 | Contabilidad: «Por contabilizar» | «Factura: X sin asiento de N vivas», igual a la consulta a la base; lista las sin venta y `F-0573-5001`, y no `F-0573-1005` | PASÓ. 8 sin asiento de 23 vivas y 3 anuladas aparte, igual a la base. `F-0573-5001` «Asiento anulado», `F-0573-3001` «Sin asiento», y `F-0573-1005` no se lista |
| 6 | Contabilidad: Reportes › «Ingreso del período», mes en curso | Cifra grande = suma de `base_amount` de las vivas emitidas en el período. Control 4.5 = `credit - debit` de los asientos de venta y reverso vivos. **El control tiene que decir «Requiere revisión»,** porque prueba tiene ventas anuladas sembradas | PASÓ. Del 2026-11-01 al 03: cifra grande 230.00 y mayor 4.5 150.00, iguales a la base. El control dice «Requiere revisión» |
| 8 | Comercial: `/studio/facturacion`, `/studio/contabilidad`, `/studio/cobranzas` | Cada una vuelve al Dashboard | PASÓ. Las tres terminan en `/studio/dashboard` |
| 9 | Admin: saldo de `DTD-9001` (0492) | «Saldo abierto» = suma de `total_amount - paid_amount` de sus facturas vivas, igual a `client_outstanding` | PASÓ. USD 175.00, 19 facturas. Igual a la suma de la base y a `client_outstanding`, leído con la identidad de admin |
| 9 | Admin: Contabilidad › «Tasas de cambio» (0495) | Primero, factura en VES sin tasa: no se crea, con «Falta la tasa de bolívares para el AAAA-MM-DD: escríbela aquí o cárgala en Admin › Tasas.». Después, registra una tasa sintética y `fx_rate_on` la devuelve | PASÓ. En VES sin tasa, el error literal con `2026-11-03`, y 60 facturas antes y después. «Tasa registrada», y `fx_rate_on` devuelve 100 |
| 9 | Admin: Almacén CN › «Tarifa · a facturar» (0496), con una recepción y una tarifa sintéticas: 2,5 m³, 1.500 kg, 100.00 por m³, mínimo 50.00 | Vista previa: a facturar **250.00** y **250 kg** de exceso. Congelar: «Tarifa de WR-… congelada: a facturar $250.00», y una fila en `shipment_rate_snapshots` con esos números | PASÓ en pantalla y en la base. `WR-2026-0001`: vista previa 250.00 y 250 kg; «Tarifa de WR-2026-0001 congelada: a facturar $250.00»; fila `casa, 100.00, 50.00, 2.500, 1500.00, 250.00, 250.00`. **El FALLÓ es mío:** mi esperado traía 3 decimales, y `weight_kg` y `excess_weight_kg` guardan 2. Los números coinciden |

### Qué aceptación humana se omite

Literal: «Sí, omítela». Nadie con criterio de negocio miró R10 ni los pasos 1, 2, 3, 4, 5, 6, 7, 8 y 9. R1 a R9
y las gemelas de 1, 2, 7a y 7b son lo que hay, con un navegador automático: no son tu revisión. El navegador
comprueba que está el texto esperado y que el número coincide con la base. **No comprueba:**

- que el registro se entienda, ni si algo frena a quien lo llena;
- que emitir y anular una factura tengan sentido para quien factura, ni si «No se pudo registrar el cobro.» le
  alcanza a quien cobra;
- que los mensajes de Cobranzas y del libro diario se entiendan;
- que «Ingreso del período», «Por contabilizar» y el saldo del cliente tengan sentido para quien
  factura;
- que el cajón de tarifa se entienda, ni que su vista previa alcance para decidir antes de congelar.

Eso queda sin aceptar, y no se registra como aceptado por ti. Puedes mirarlo en prueba cuando quieras.

### Qué no cubre este bloque

- **Período cerrado con superclave (0493):** no lo probé en prueba, porque cierra la contabilidad de
  todo el entorno. Lo cubren las pruebas automáticas.
- **Crédito de referido aplicado:** no lo probé en prueba. Lo probé con el rol real en local.
- **La factura de Almacén CN, la que sale al consolidar una recepción con orden de venta:** no la recorro en
  pantalla. Tiene su prueba automática, con su asiento, su cobro y su anulación. En producción hay 0 órdenes
  de venta.
- **La ventana con la web vieja:** ya la probé con la web de producción, y está en el informe del
  Director.

### Qué queda en prueba después

Las facturas y asientos de este bloque, sus recibos, las dos cuentas nuevas, la tasa, la recepción y la
tarifa sintéticas, y los clientes y las facturas del recorrido de portal y registro, incluido `DTD-9040`, de
R10. Nada de esto toca producción. Si después quieres dejar prueba como estaba, hay un respaldo de antes del ensayo en el
servidor; volver a él borra todo lo que se haya hecho desde entonces.

### Cómo queda este bloque

No hace falta que respondas nada de esta parte: la omitiste. Lo que sigue abierto te lo pregunta el Director.
Si un día haces tu parte, el Worker comprueba en la base de prueba que ocurrió antes de registrarla. Nada de
esto autoriza aplicar en producción: el OK nominal de 0496 y 0497 te lo pide el Director aparte, con lo que el
ensayo midió y con lo que quedó sin aceptar.

## Cómo me respondes

Un solo mensaje cuando termines, con los bloques que salieron bien, lo que anotaste en el bloque 4
paso 5 y los nombres exactos. Por ejemplo:

> Bloques 1 a 4 OK; en el paso 4.5 el cliente borrado [sí / no] seguía en la lista. Autorizo aplicar
> 0422_payment_report_command_boundary y, después de repetir las pruebas, 0423_payment_report_historical_identity,
> y fusionar la PR #114 después de 0423.

Los bloques 5 y 6 van aparte y no piden autorizar nada: son el cierre del release de SDD-0489 y de
SDD-0488, cuyas migraciones ya están aplicadas. Con un «Bloques 5 y 6 OK» alcanza. Si algo no
coincide, dime el paso, el rol y el texto exacto del error.

Si un bloque falla, déjalo fuera del mensaje y cuéntame qué viste. Las migraciones se aplican de a
una, con preflight y postflight, y te aviso cuándo repetir las pantallas.

Sobre la **PR #114**: fusionarla despliega a producción, así que sigue necesitando tu OK aparte.
Lo que decía este guion el 18-sep —que «va cuatro días atrás» y que hay que traerse `main` y
volver a validarla— quedó viejo. Medido contra `main` `f56e5245` el 2026-09-20:

- su rama fusiona con `main` **limpio, sin conflictos**;
- **ninguno** de los 11 archivos que toca cambió en `main` desde su base (`b07ad98b`), aunque desde
  entonces entraron 565 commits.

O sea, arrastrarla no es riesgoso: está atrás en el tiempo, no en contenido. GitHub igual la marca
«BEHIND», que solo quiere decir que su rama no tiene los commits nuevos de `main`; el Director la
pone al día y la valida antes de fusionar, como con cualquier otra.
