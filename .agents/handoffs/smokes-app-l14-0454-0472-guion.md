# Tus pruebas en la app — L14, 0454, 0455 y 0456 (SDD-0467, 0469 y 0472)

- Fecha: 2026-09-18. Lo preparó la sesión Worker `claude-smokes-app-20260918`.
- Verificado contra el código de `main` `78410913`. Solo se leyó código: no se entró a producción ni
  con cuentas reales. Las citas `archivo:línea` están en el handoff
  `smokes-app-l14-0454-0472.md`.
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

### Qué queda en producción después de las pruebas

- La factura de prueba, anulada, y su asiento de venta, anulado (bloque 4, paso 1). **Anular la
  factura no anula el asiento**: hay que anularlo aparte en Contabilidad.
- Los reportes de pago con sus comprobantes. Por diseño, no se borran.
- Los clientes de prueba, borrados. El borrado es lógico: la fila y los eventos de auditoría quedan,
  y desde el Studio no se puede restaurar.

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
   - Antes el motivo desaparecía al recargar. Lo arregló la 0464, aplicada el 19-sep a las 01:00
     UTC. Si vuelve a desaparecer, anótalo en «Si algo falló».
3. [ ] Segundo reporte, igual que el paso 1, con la nota «prueba 2». Esta vez pulsa «Reportar pago»
   **dos veces seguidas, rápido**. Esperado: aparece **un solo** reporte nuevo y el equipo recibe un
   solo aviso.
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

## Cómo me respondes

Un solo mensaje cuando termines, con los bloques que salieron bien, lo que anotaste en el bloque 4
paso 5 y los nombres exactos. Por ejemplo:

> Bloques 1 a 4 OK; en el paso 4.5 el cliente borrado [sí / no] seguía en la lista. Autorizo aplicar
> 0422_payment_report_command_boundary y, después de repetir las pruebas, 0423_payment_report_historical_identity,
> y fusionar la PR #114 después de 0423.

Si un bloque falla, déjalo fuera del mensaje y cuéntame qué viste. Las migraciones se aplican de a
una, con preflight y postflight, y te aviso cuándo repetir las pantallas. Antes de fusionarla, la PR
#114 tiene que traerse `main` y volver a validarse: va cuatro días atrás. Fusionarla despliega a
producción.
