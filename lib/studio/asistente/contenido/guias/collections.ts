import { editar, type GuiaModulo, ver } from "../tipos";

/** Guía de Cobranzas (`/studio/cobranzas`). Leída del código el 2026-11-16; corregida tras la revisión de Codex. */
export const GUIA_COLLECTIONS: GuiaModulo = {
  modulo: "collections",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/cobranzas/page.tsx",
      "app/studio/(app)/cobranzas/actions.ts",
      "app/studio/(app)/cobranzas/_components/CobranzasClient.tsx",
      "app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx",
      "app/studio/(app)/cobranzas/_components/UnidentifiedPaymentDrawer.tsx",
      "app/studio/(app)/cobranzas/_components/IdentifyPaymentDrawer.tsx",
      "app/studio/(app)/cobranzas/_components/RecordatoriosDrawer.tsx",
      "app/studio/(app)/cobranzas/_components/PendingReportsNotice.tsx",
      "app/studio/(app)/cobranzas/recibo/[code]/page.tsx",
      "lib/studio/payment-types.ts",
      "lib/studio/collections-actions.ts",
      "lib/studio/collections/recordatorios.ts",
    ],
  },
  paraQueSirve:
    "Llevar las cuentas por cobrar: ver qué facturas tienen saldo y cuáles están vencidas, registrar los pagos que llegan de los clientes con su recibo, y anotar la gestión de cobro.",
  queSeVe: [
    "Indicadores «Por cobrar», «Vencido», «En promesa de pago» y «Tasa de cobro».",
    "El saldo por cobrar en dólares y su equivalente en bolívares con la tasa del día.",
    "La tarjeta «Separación de fondos · mandato», con fondos de terceros, ingreso local y pagos sin identificar del mes.",
    "La sección «Sin identificar», cuando hay pagos recibidos que todavía no se cruzaron con una factura.",
    "El filtro «Estado»: Todas, Solo abiertas, Al día, Vencido, Contactado, Promesa de pago y Pagado.",
    "La tabla con Factura, Cliente, Saldo, Vencimiento, Última gestión y Estado, y el botón «Abrir» en cada fila.",
    "Arriba, los botones «Exportar», «Recordatorio masivo» y «Pago sin identificar».",
  ],
  tareas: [
    {
      id: "registrar-cobro",
      titulo: "Registrar un pago recibido de un cliente",
      ruta: "/studio/cobranzas",
      requiere: [editar("collections")],
      pasos: [
        { texto: "Busca la factura del cliente en la tabla y pulsa «Abrir»." },
        {
          texto:
            "Antes de seguir, mira si aparece un aviso amarillo de que el cliente ya reportó ese pago desde su portal. Si aparece, no lo registres aquí: confírmalo desde la factura, en Facturación. Si haces las dos cosas, el pago se cuenta dos veces.",
        },
        { texto: "Pulsa «Registrar cobro»." },
        {
          texto:
            "Revisa el «Monto a cobrar»: viene con el saldo completo. Si el cliente pagó una parte, escribe esa parte y quedará como abono parcial.",
        },
        { texto: "Elige la «Cuenta de caja / banco» donde entró el dinero." },
        { texto: "Elige el «Método»: Transferencia, Zelle, Pago móvil, USDT, Efectivo u Otro." },
        { texto: "Confirma la «Fecha» y, si la tienes, escribe la «Referencia»." },
        {
          texto:
            "En «¿Quién realizó el pago?», deja «Yo mismo (el cliente)» o elige «Un tercero». Con un tercero, escribe su nombre, su relación con el cliente y marca la casilla de la declaración de fondos.",
        },
        { texto: "Pulsa «Confirmar cobro»." },
      ],
      notas: [
        "El cobro se aplica solo a la factura que abriste, en su moneda, y no puede superar su saldo.",
        "Al confirmar se crea el recibo y baja el saldo. No hace falta emitir el recibo aparte.",
        "El sistema intenta también generar el asiento contable. Si no lo logra, el cobro queda registrado igual y aparece en Contabilidad, en «Por contabilizar». No repitas el cobro para arreglarlo: avisa a contabilidad.",
        "En este formulario no se adjunta comprobante.",
      ],
    },
    {
      id: "ver-imprimir-recibo",
      titulo: "Ver o imprimir el recibo de un cobro",
      ruta: "/studio/cobranzas",
      requiere: [ver("collections")],
      pasos: [
        { texto: "Pulsa «Abrir» en la factura." },
        { texto: "En el historial de cobros del panel, pulsa «Ver recibo»." },
        { texto: "En el recibo, pulsa «Imprimir»." },
      ],
      notas: ["El recibo no es una factura fiscal. Un recibo anulado ya no se puede abrir."],
    },
    {
      id: "anular-recibo",
      titulo: "Anular un cobro mal registrado",
      ruta: "/studio/cobranzas",
      requiere: [editar("collections")],
      pasos: [
        { texto: "Pulsa «Abrir» en la factura." },
        { texto: "En el historial de cobros, pulsa «Anular» junto al recibo." },
        { texto: "Escribe el motivo y pulsa «Anular recibo»." },
      ],
      notas: [
        "El recibo no se borra: queda anulado y se revierte el saldo de la factura.",
        "El sistema intenta anular también su asiento. Si no lo logra, la anulación vale igual; contabilidad lo ve en «Por contabilizar».",
      ],
    },
    {
      id: "gestion-de-cobro",
      titulo: "Anotar una gestión de cobro, una nota o una promesa de pago",
      ruta: "/studio/cobranzas",
      requiere: [editar("collections")],
      pasos: [
        { texto: "Pulsa «Abrir» en la factura." },
        {
          texto:
            "En «Gestión de cobranza», pulsa «Registrar contacto» si hablaste con el cliente, o «Enviar recordatorio» para dejar constancia de que se lo recordaste. Ninguno de los dos envía un correo: solo anotan en el historial.",
        },
        {
          texto:
            "Para una promesa, pulsa «Promesa de pago», indica la «Fecha comprometida» y, si quieres, el monto, y pulsa «Confirmar promesa».",
        },
        { texto: "Para dejar un comentario, pulsa «Nota», escribe qué pasó y pulsa «Guardar nota»." },
      ],
      notas: ["Para enviar correos de recordatorio de verdad, usa «Recordatorio masivo»."],
    },
    {
      id: "pago-sin-identificar",
      titulo: "Registrar un pago que no sabes de qué cliente es",
      ruta: "/studio/cobranzas",
      requiere: [editar("collections")],
      pasos: [
        { texto: "Pulsa «Pago sin identificar»." },
        { texto: "Escribe el «Monto recibido» y elige la «Moneda»." },
        { texto: "Si la moneda es bolívares, aparece «Tasa BCV (VES/USD)»: complétala." },
        { texto: "Elige la «Cuenta de caja / banco», el «Método» y la «Fecha de recepción»." },
        { texto: "Agrega la «Referencia bancaria» y las notas que ayuden a reconocerlo." },
        { texto: "Pulsa «Registrar pago»." },
      ],
      notas: ["El pago queda en la sección «Sin identificar» hasta que lo cruces con una factura."],
    },
    {
      id: "identificar-pago",
      titulo: "Asignar un pago sin identificar a su factura",
      ruta: "/studio/cobranzas",
      requiere: [editar("collections")],
      pasos: [
        { texto: "En la sección «Sin identificar», pulsa «Identificar» en la fila del pago." },
        { texto: "Elige el «Cliente» y luego la «Factura»." },
        { texto: "Revisa el resumen y pulsa «Identificar y aplicar»." },
      ],
      notas: [
        "Solo aparecen facturas en la misma moneda y con saldo igual o mayor al pago.",
        "El pago se imputa con la fecha en que se recibieron los fondos.",
      ],
    },
    {
      id: "recordatorio-masivo",
      titulo: "Enviar recordatorios de cobro a varios clientes",
      ruta: "/studio/cobranzas",
      requiere: [editar("collections")],
      pasos: [
        { texto: "Pulsa «Recordatorio masivo»." },
        { texto: "Revisa las listas «Reciben el recordatorio» y «Quedan fuera, y por qué»." },
        { texto: "Pulsa el botón de enviar." },
      ],
      notas: [
        "Queda fuera quien todavía no vence, quien prometió pagar y la fecha no llegó, a quien ya se le recordó hace poco y quien no tiene correo cargado.",
        "El correo solo sale si en Mailing hay una regla activa para facturas vencidas.",
      ],
    },
    {
      id: "exportar-cobranzas",
      titulo: "Descargar la cartera por cobrar",
      ruta: "/studio/cobranzas",
      requiere: [ver("collections")],
      pasos: [{ texto: "Pulsa «Exportar». Se descarga un CSV con toda la cartera, no solo lo que ves filtrado." }],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "«El cobro no puede superar el saldo»",
      salida: "Escribiste más de lo que debe la factura. Registra hasta el saldo; el resto va contra otra factura.",
    },
    {
      sintoma: "«Elige la cuenta de caja o banco que recibió el pago.»",
      salida: "Falta elegir la cuenta. Si la lista está vacía, contabilidad debe crear las cuentas de caja y banco en el plan de cuentas.",
    },
    {
      sintoma: "«Solo se pueden registrar cobros en facturas emitidas o parciales.»",
      salida: "La factura está en borrador, anulada o ya pagada.",
    },
    {
      sintoma: "«La factura ya está pagada: otro cobro o reporte la saldó.» o «El monto supera el saldo vigente»",
      salida: "Alguien más registró un cobro mientras tenías el panel abierto. Actualiza la página y revisa antes de repetir.",
    },
    {
      sintoma: "«No se pudo confirmar si el cobro entró»",
      salida: "Se perdió la comunicación. Recarga la página y revisa la factura antes de intentarlo otra vez, para no duplicar el cobro.",
    },
    {
      sintoma: "«No hay facturas … con saldo … para aplicar este pago.»",
      salida: "Al identificar un pago no hay factura que lo reciba. Primero hay que emitir o corregir la factura.",
    },
    {
      sintoma: "«Tu rol no puede registrar ni anular cobros.»",
      salida: "Tienes acceso de solo consulta. Pide a contabilidad que registre el cobro.",
    },
  ],
  quienPuede:
    "Entran contabilidad y administración, y ambas pueden registrar y anular cobros. Un administrador puede dar acceso adicional a una persona concreta, de consulta o de edición.",
};
