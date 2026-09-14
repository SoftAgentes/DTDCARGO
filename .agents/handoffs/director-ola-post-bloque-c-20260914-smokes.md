# Smokes pendientes — guion para Sam

- Fecha: 2026-09-14. Preparado por la sesión Director `director-ola-post-bloque-c-20260914`.
- Para qué sirve: cada bloque destraba migraciones que ya están en `main` y esperan tu OK nominal.
  Todo se hace en producción con cuentas reales; el Director no entra con cuentas reales.
- Fuentes: esperas de `supabase/migrations-baseline.json` y las secuencias de release de
  `.agents/handoffs/c-l10-recordatorios-cobranzas.md`, `c-l14-portal-comandos-recibos.md` y
  `c-l07-fidelizacion-conversations.md`.

## Antes de empezar

- Cuentas: una de cada rol del Studio que vas a usar (admin, accounting, commercial, support,
  operations), tuyas o del equipo, y una cuenta de cliente del Portal con al menos una factura emitida.
- Horario: los smokes se hacen a cualquier hora. `0415` y `0414` conviene aplicarlas en baja actividad
  de correo y de facturas; eso lo cuido yo al aplicar.
- Si algo falla, anota la pantalla, el rol y lo que viste, y no autorices ese bloque.

## A · Cobranzas → destraba `0415_mail_logs_read_rbac`

Qué cambia la 0415: todo rol distinto de admin deja de leer el historial de correos directo. La vista
previa de recordatorios ya lo lee por la RPC de `0410`, aplicada el 2026-09-13.

1. [ ] Con **accounting**: Studio → Cobranzas → vista previa de recordatorios. Debe mostrar resumen,
   listas y el botón de envío, sin alerta de error, con las señales de spam y de último recordatorio.
2. [ ] Lo mismo con **admin**.
3. **No pulses enviar**: los recordatorios salen a clientes reales.

Después de aplicar la 0415 repites el paso 1 con accounting.

## B · Reportes de pago → destraba `0422_payment_report_command_boundary` y luego `0423_payment_report_historical_identity`

Qué cambia la 0422: la base deja de aceptar escrituras directas sobre reportes de pago y solo pasan
los comandos que la app ya usa desde `0421`. Después de la 0422 no se vuelve atrás revirtiendo solo
la app, por eso se mira antes.

En el Portal, con la cuenta de cliente:

1. [ ] Reportar un pago con comprobante en una factura: queda «Reporte registrado» y el reporte aparece
   en la factura.
2. [ ] Cancelar ese reporte con un motivo: queda «Cancelado» y el comprobante sigue en el historial.

En el Studio, con **accounting**:

3. [ ] Confirmar un reporte con motivo: el saldo de la factura sube. **Esto registra un cobro real.**
   Hazlo solo con un pago que de verdad recibiste, o con un cliente y una factura de prueba.
4. [ ] Rechazar otro reporte: el saldo no cambia.
5. [ ] Opcional: repetir la misma operación dos veces (doble clic o reintento) no duplica el reporte
   ni el recibo.

La 0423 va justo después de la 0422 y la verifico en el catálogo. Su prueba completa exige renombrar
el Shipping Mark de un cliente con reportes sobre facturas archivadas: no lo hagas solo para probar.
Después de aplicar las dos repites los pasos 1 y 2.

Con 0422 y 0423 aplicadas queda lista para integrar la PR #114, que termina de resolver por principal
las lecturas de reportes de pago y la aceptación legal del Portal. Esa fusión necesita tu OK aparte.

## C · Roles → destraba `0414_invoices_read_rbac`

Qué cambia la 0414: solo accounting y admin leen facturas directo; los demás roles ven sus datos por
las RPC de `0411`, `0412` y `0413`, aplicadas el 2026-09-13. Si alguna pantalla desplegada todavía
leyera facturas directo, tras la 0414 esos roles verían clientes en Bronze, saldo 0 y «Facturas · 0»
sin ningún error: por eso se mira antes.

1. [ ] Fidelización, CRM (Dirección) y Reportes → Comercial con **commercial**, **support** y
   **accounting**: niveles y montos de hoy, sin errores.
2. [ ] Panel de Conversaciones con **commercial**, **operations**, **support** y **admin**: el saldo
   pendiente del cliente visible, sin errores.
3. [ ] Drawer de Órdenes de venta con **commercial**, **operations** y **accounting**: sus facturas
   listadas, sin errores.
4. [ ] Portal con la cuenta de cliente: lista y detalle de facturas.

Referencia de lo que sí cambió al desplegar L07: la PR #106, sección «Cambios de comportamiento
visibles al desplegar». Después de aplicar la 0414 repites 1 a 3 con un rol no financiero.

## D · Lo que se integró esta noche (verificación, sin gate)

- PR #116, Facturación: las facturas borradas ya no aparecen en listas, KPIs, costeo, créditos de
  referido ni en la cola de Cobranzas. Eliminar solo funciona con borradores; una emitida, parcial,
  pagada o vencida pide anularse con motivo. Si tienes un borrador de prueba, elimínalo y confirma
  que desaparece. Integrada el 2026-09-14 a las 07:20 UTC (merge `7cd50f4a`).

## E · 0453, helpers del Portal — lista, con tu OK nominal

La PR #115 quedó integrada (merge `4b01ac58`) con el preflight corregido. No se aplicó: te pido el OK con estos datos
a la vista, todos medidos el 2026-09-14 sin leer filas.

- En producción, el cuerpo de la función del trigger de direcciones de entrega no tiene el comentario del archivo de
  `0198`; la migración ahora acepta esa forma y cualquier otra sigue abortando.
- Hay un vínculo activo del Portal cuyo cliente está borrado. La app ya lo manda a `/entrar`; con 0453 la helper le
  devuelve vacío, y ninguna policy la usa ya, así que no cambia ninguna lectura visible.
- Solo toma locks de lectura, entre 63 y 89 ms medidos en local; no necesita ventana ni despliegue.
- Nadie tiene hoy más de una membresía activa, así que el Studio no cambia para nadie.

Antes de aplicarla repito la lectura previa y la foto de advisors.

## Cómo me respondes

Un solo mensaje cuando termines, con los bloques que salieron bien y los nombres exactos. Por ejemplo:

> Smokes A, B y C OK. Autorizo aplicar 0415_mail_logs_read_rbac, 0422_payment_report_command_boundary,
> 0423_payment_report_historical_identity, 0414_invoices_read_rbac y 0453_portal_helpers_principal_determinista, y fusionar
> la PR #114 después de 0423.

Si un bloque falla, déjalo fuera del mensaje y dime qué viste. Aplico de a una, con preflight y
postflight, y te aviso cuándo repetir las pantallas.
