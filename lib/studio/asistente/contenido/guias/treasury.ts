import { editar, type GuiaModulo, ver } from "../tipos";

/** Guía de Tesorería (`/studio/tesoreria`). Leída del código el 2026-11-16; corregida tras la revisión de Codex. */
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
      "app/studio/(app)/tesoreria/_components/SupplierDrawer.tsx",
      "lib/studio/treasury/types.ts",
      "lib/studio/treasury/treasury-actions.ts",
    ],
  },
  paraQueSirve:
    "Llevar lo que la empresa debe y paga a sus proveedores: cuentas por pagar (CxP) y órdenes de pago, incluidas las remesas a China. Es el lado del pago; el lado del cobro está en Cobranzas. La conciliación bancaria no está aquí: está en Contabilidad.",
  queSeVe: [
    "Indicadores «Por pagar», «Vencido», «Pagado en el mes» y «Proveedores activos».",
    "Tres pestañas: «Cuentas por pagar», «Pagos» y «Proveedores».",
    "En «Cuentas por pagar»: filtro «Estado» y la tabla con CxP, Proveedor, Concepto, Saldo, Vencimiento y Estado. Solo muestra las que tienen saldo.",
    "En «Pagos»: el total pagado, el resumen «Remesas a China» y las órdenes de pago con Orden, Fecha, Proveedor, Método, Monto, CxP origen y Asiento.",
    "En «Proveedores»: la lista con Código, Nombre, Tipo, País y Canal de pago, y el botón «+ Nuevo proveedor».",
    "Arriba, el botón «+ Nueva CxP».",
  ],
  tareas: [
    {
      id: "crear-proveedor",
      titulo: "Dar de alta un proveedor",
      ruta: "/studio/tesoreria",
      requiere: [editar("treasury")],
      pasos: [
        { texto: "Abre la pestaña «Proveedores» y pulsa «+ Nuevo proveedor»." },
        { texto: "Escribe el «Nombre» y elige el «Tipo» y el «País»." },
        { texto: "Indica la «Moneda default» y el «Canal de pago»." },
        { texto: "Si quieres, elige la «Cuenta de gasto por defecto» y completa los datos de contacto." },
        { texto: "Pulsa «Crear proveedor»." },
      ],
    },
    {
      id: "editar-proveedor",
      titulo: "Corregir los datos de un proveedor",
      ruta: "/studio/tesoreria",
      requiere: [editar("treasury")],
      pasos: [
        { texto: "Abre la pestaña «Proveedores»." },
        { texto: "Pulsa «Editar» en la fila del proveedor." },
        { texto: "Cambia lo necesario y pulsa «Guardar cambios»." },
      ],
    },
    {
      id: "crear-cxp",
      titulo: "Registrar una cuenta por pagar",
      ruta: "/studio/tesoreria",
      requiere: [editar("treasury")],
      pasos: [
        { texto: "Pulsa «+ Nueva CxP»." },
        { texto: "Elige el «Proveedor»." },
        { texto: "Elige la «Cuenta de costo / gasto a imputar»." },
        { texto: "Escribe un «Concepto» que ayude a reconocer la deuda." },
        { texto: "Escribe el «Monto total» y elige la «Moneda». Si no es dólares, indica la tasa." },
        { texto: "Indica «Emisión» y «Vencimiento», y la «Referencia del proveedor» si la tienes." },
        {
          texto:
            "Si es un costo de un contenedor, elige el «Contenedor», un embarque si es solo de uno (si no, se reparte por volumen) y «Qué costo cubre».",
        },
        { texto: "Pulsa «Crear CxP»." },
      ],
      notas: [
        "Si no hay proveedores, el botón «+ Nueva CxP» está apagado: primero crea uno.",
        "Una CxP ligada a un contenedor reemplaza, en Costing, lo que se haya cargado a mano en esa misma categoría.",
        "El sistema intenta generar el asiento del costo. Si no lo logra, la CxP queda creada igual y aparece en Contabilidad, en «Por contabilizar».",
      ],
    },
    {
      id: "registrar-pago-proveedor",
      titulo: "Registrar un pago a un proveedor",
      ruta: "/studio/tesoreria",
      requiere: [editar("treasury")],
      pasos: [
        { texto: "En «Cuentas por pagar», pulsa la fila de la CxP." },
        { texto: "En el panel, pulsa «Registrar pago»." },
        {
          texto:
            "Revisa el «Monto a pagar»: viene con el saldo y está en la moneda de la CxP. Cámbialo si es un abono.",
        },
        { texto: "Elige la «Cuenta de caja / banco que paga» y el «Método»." },
        { texto: "Confirma la «Fecha» y escribe la «Referencia» si la tienes." },
        { texto: "Pulsa «Confirmar pago»." },
      ],
      notas: [
        "Se genera una orden de pago y baja el saldo de la CxP.",
        "El sistema intenta asentar la salida de dinero. Si no lo logra, el pago queda registrado igual y aparece en «Por contabilizar». No lo repitas para arreglarlo.",
      ],
    },
    {
      id: "anular-pago",
      titulo: "Anular un pago a un proveedor",
      ruta: "/studio/tesoreria",
      requiere: [editar("treasury")],
      pasos: [
        {
          texto:
            "Si la CxP todavía tiene saldo, ábrela desde «Cuentas por pagar». Si el pago la dejó saldada, ya no aparece allí: abre la pestaña «Pagos», busca la orden y pulsa «Ver CxP».",
        },
        { texto: "En el historial de pagos del panel, pulsa «Anular» junto a la orden." },
        { texto: "Escribe el motivo y pulsa «Confirmar anulación»." },
      ],
      notas: ["Al anular la orden, el saldo vuelve a la CxP."],
    },
    {
      id: "anular-cxp",
      titulo: "Anular una cuenta por pagar",
      ruta: "/studio/tesoreria",
      requiere: [editar("treasury")],
      pasos: [
        { texto: "Si la CxP tiene pagos, anula primero cada orden de pago." },
        { texto: "Abre la CxP y pulsa «Anular CxP»." },
        { texto: "Escribe el motivo y pulsa «Confirmar anulación»." },
      ],
    },
    {
      id: "ligar-cxp-contenedor",
      titulo: "Ligar una cuenta por pagar a un contenedor",
      ruta: "/studio/tesoreria",
      requiere: [editar("treasury")],
      pasos: [
        { texto: "Abre la CxP." },
        { texto: "En «Costo de contenedor», pulsa «Ligar a contenedor» (o «Cambiar»)." },
        { texto: "Elige el contenedor, el embarque si aplica y qué costo cubre, y pulsa «Guardar vínculo»." },
      ],
      notas: ["En Costing, esta CxP reemplaza lo cargado a mano en esa categoría."],
    },
    {
      id: "ver-remesas",
      titulo: "Ver los pagos y las remesas a China",
      ruta: "/studio/tesoreria",
      requiere: [ver("treasury")],
      pasos: [
        { texto: "Abre la pestaña «Pagos»." },
        { texto: "Arriba ves el total y el resumen «Remesas a China»; abajo, cada orden con su método." },
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
      sintoma: "No encuentras una CxP ya pagada en «Cuentas por pagar».",
      salida: "Esa lista solo muestra las que tienen saldo. Búscala desde la pestaña «Pagos» con «Ver CxP».",
    },
    {
      sintoma: "«Tu rol no puede registrar ni anular pagos a proveedores.»",
      salida: "Tienes acceso de solo consulta. Pide a contabilidad que lo registre.",
    },
  ],
  quienPuede:
    "Entran contabilidad y administración, y ambas pueden crear proveedores y cuentas por pagar, y registrar y anular pagos. Un administrador puede dar acceso adicional a una persona concreta.",
};
