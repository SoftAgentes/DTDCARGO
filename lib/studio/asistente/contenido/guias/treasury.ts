import type { GuiaModulo } from "../tipos";

/** Guía de Tesorería (`/studio/tesoreria`). Leída del código el 2026-11-16. */
export const GUIA_TREASURY: GuiaModulo = {
  modulo: "treasury",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/tesoreria/page.tsx",
      "app/studio/(app)/tesoreria/actions.ts",
      "app/studio/(app)/tesoreria/_components/TesoreriaClient.tsx",
      "app/studio/(app)/tesoreria/_components/BillDrawer.tsx",
      "lib/studio/treasury/types.ts",
      "lib/studio/treasury-actions.ts",
    ],
  },
  paraQueSirve:
    "Llevar lo que la empresa debe y paga a sus proveedores: cuentas por pagar (CxP), órdenes de pago y remesas. Es el lado del pago; el lado del cobro está en Cobranzas. La conciliación bancaria no está aquí: está en Contabilidad.",
  queSeVe: [
    "Indicadores «Por pagar», «Vencido», «Pagado en el mes» y «Proveedores activos».",
    "Tres pestañas: «Cuentas por pagar», «Pagos» y «Proveedores».",
    "En «Cuentas por pagar»: filtro «Estado» y la tabla con CxP, Proveedor, Concepto, Saldo, Vencimiento y Estado.",
    "En «Pagos»: las órdenes de pago con Orden, Fecha, Proveedor, Método, Monto, CxP origen y Asiento.",
    "En «Proveedores»: la lista con Código, Nombre, Tipo, País y Canal de pago, y el botón «+ Nuevo proveedor».",
    "Arriba, el botón «+ Nueva CxP».",
  ],
  tareas: [
    {
      id: "crear-proveedor",
      titulo: "Dar de alta un proveedor",
      ruta: "/studio/tesoreria",
      pasos: [
        { texto: "Abre la pestaña «Proveedores» y pulsa «+ Nuevo proveedor»." },
        { texto: "Escribe el «Nombre» y elige el «Tipo» y el «País»." },
        { texto: "Indica la «Moneda default» y el «Canal de pago»." },
        { texto: "Si quieres, elige la «Cuenta de gasto por defecto» y completa los datos de contacto." },
        { texto: "Pulsa «Crear proveedor»." },
      ],
    },
    {
      id: "crear-cxp",
      titulo: "Registrar una cuenta por pagar",
      ruta: "/studio/tesoreria",
      pasos: [
        { texto: "Pulsa «+ Nueva CxP»." },
        { texto: "Elige el «Proveedor»." },
        { texto: "Elige la «Cuenta de costo / gasto a imputar»." },
        { texto: "Escribe el «Monto total» y elige la «Moneda». Si no es dólares, indica la tasa." },
        { texto: "Indica «Emisión» y «Vencimiento»." },
        { texto: "Si es un costo de un contenedor, elige el «Contenedor» y «Qué costo cubre»." },
        { texto: "Pulsa «Crear CxP»." },
      ],
      notas: [
        "Al crearla se registra el costo o gasto y la deuda con el proveedor.",
        "Si no hay proveedores, el botón «+ Nueva CxP» está apagado: primero crea uno.",
        "Una CxP ligada a un contenedor cuenta para el cálculo de su costo.",
      ],
    },
    {
      id: "registrar-pago-proveedor",
      titulo: "Registrar un pago a un proveedor",
      ruta: "/studio/tesoreria",
      pasos: [
        { texto: "En «Cuentas por pagar», pulsa la fila de la CxP." },
        { texto: "En el panel, pulsa «Registrar pago»." },
        { texto: "Revisa el «Monto a pagar»: viene con el saldo. Cámbialo si es un abono." },
        { texto: "Elige la «Cuenta de caja / banco que paga» y el «Método»." },
        { texto: "Confirma la «Fecha» y escribe la «Referencia» si la tienes." },
        { texto: "Pulsa «Confirmar pago»." },
      ],
      notas: ["Se genera una orden de pago, baja el saldo de la CxP y se asienta la salida de dinero."],
    },
    {
      id: "anular-pago-o-cxp",
      titulo: "Anular un pago o una cuenta por pagar",
      ruta: "/studio/tesoreria",
      pasos: [
        { texto: "Abre la CxP." },
        { texto: "Para anular un pago, pulsa «Anular» junto a la orden en el historial de pagos." },
        { texto: "Para anular la cuenta, pulsa «Anular CxP»." },
        { texto: "Escribe el motivo y pulsa «Confirmar anulación»." },
      ],
      notas: ["Una CxP con pagos no se anula directamente: primero anula sus órdenes de pago."],
    },
    {
      id: "ligar-cxp-contenedor",
      titulo: "Ligar una cuenta por pagar a un contenedor",
      ruta: "/studio/tesoreria",
      pasos: [
        { texto: "Abre la CxP." },
        { texto: "En «Costo de contenedor», pulsa «Ligar a contenedor»." },
        { texto: "Elige el contenedor y qué costo cubre, y pulsa «Guardar vínculo»." },
      ],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "«El pago no puede superar el saldo»",
      salida: "Escribiste más de lo que se debe en esa CxP. Paga hasta el saldo.",
    },
    {
      sintoma: "«No se puede anular una CxP con pagos. Anula primero las órdenes de pago.»",
      salida: "Anula cada orden de pago desde el historial de la CxP y luego anula la cuenta.",
    },
    {
      sintoma: "«La CxP ya está pagada: otro pago la saldó.»",
      salida: "Alguien más registró el pago. Actualiza la página antes de repetir.",
    },
    {
      sintoma: "«No hay cuentas de caja/banco en el plan de cuentas.» o «No hay cuentas de costo/gasto en el plan.»",
      salida: "Faltan cuentas en el plan. Contabilidad debe crearlas en Contabilidad, en «Plan de cuentas».",
    },
    {
      sintoma: "«Tu rol no puede registrar ni anular pagos a proveedores.»",
      salida: "Tienes acceso de solo consulta. Pide a contabilidad que lo registre.",
    },
  ],
  quienPuede:
    "Entran contabilidad y administración, y ambas pueden crear proveedores y cuentas por pagar, y registrar y anular pagos. Un administrador puede dar acceso adicional a una persona concreta.",
};
