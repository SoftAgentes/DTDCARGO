import { editar, type GuiaModulo, ver } from "../tipos";

/** Guía de Facturación (`/studio/facturacion`). Leída del código el 2026-11-16; corregida tras la revisión de Codex. */
export const GUIA_INVOICES: GuiaModulo = {
  modulo: "invoices",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/facturacion/page.tsx",
      "app/studio/(app)/facturacion/actions.ts",
      "app/studio/(app)/facturacion/payment-report-actions.ts",
      "app/studio/(app)/facturacion/_components/FacturacionClient.tsx",
      "app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx",
      "app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx",
      "app/studio/(app)/facturacion/_components/StudioInvoicePaymentReports.tsx",
      "app/studio/(app)/facturacion/[code]/page.tsx",
      "app/studio/(app)/facturacion/[code]/pdf/route.ts",
      "lib/studio/invoice-types.ts",
      "lib/studio/legal/gate-config.ts",
    ],
  },
  paraQueSirve:
    "Crear y emitir las facturas a los clientes, seguir sus vencimientos y su saldo, y resolver los pagos que el cliente reporta desde su portal.",
  queSeVe: [
    "Indicadores «Facturado YTD», «Por cobrar» y «Vencido».",
    "Pestañas «Todas», «Por cobrar», «Vencidas» y «Pagadas», cada una con su contador.",
    "El campo «Buscar» (factura, cliente, Shipping Mark o embarque) y el botón «Limpiar».",
    "La tabla con Factura, Cliente, Embarque, Emitida, Vence, Total, Saldo y Estado. Cada fila abre el detalle.",
    "Estados de una factura: Borrador, Emitida, Parcial, Pagada, Vencida y Anulada.",
    "Arriba, los botones «Exportar» y «+ Nueva factura».",
    "En el detalle: el total, las líneas, los recibos de cobranza, los pagos reportados por el cliente y las notas.",
  ],
  tareas: [
    {
      id: "crear-factura",
      titulo: "Crear una factura",
      ruta: "/studio/facturacion",
      requiere: [editar("invoices")],
      pasos: [
        { texto: "Pulsa «+ Nueva factura»." },
        {
          texto:
            "Si la factura es de un embarque, escribe primero su código en «Embarque (opcional)»: si existe, llena los datos del cliente que estén vacíos.",
        },
        { texto: "Revisa o completa el «Shipping Mark» y el «Nombre del cliente»." },
        {
          texto:
            "Si aparece «Titular de la factura», elige a nombre de quién sale. Queda fijo al emitir; si eliges distinto de la preferencia del cliente, queda registrado.",
        },
        { texto: "Elige la «Moneda». Si no es dólares, puedes indicar la tasa o dejarla vacía para usar la vigente." },
        {
          texto:
            "En las líneas, escribe Descripción, Cantidad y Precio unitario. Usa «+ Agregar línea» para cada concepto.",
        },
        { texto: "Si quieres, indica «Vence» y «Notas»." },
        { texto: "Revisa el «Total a facturar»." },
        {
          texto:
            "Marca «Emitir al crear» y pulsa «Crear y emitir», o déjala sin marcar y pulsa «Crear borrador» para revisarla después.",
        },
      ],
      notas: [
        "Si emites sin fecha de vencimiento, se fija a treinta días de la emisión.",
        "Si el embarque exige que el cliente haya aceptado los términos y condiciones y todavía no lo hizo, la factura se crea pero queda en borrador aunque hayas marcado emitir.",
      ],
    },
    {
      id: "corregir-borrador",
      titulo: "Corregir una factura en borrador",
      ruta: "/studio/facturacion",
      requiere: [editar("invoices")],
      pasos: [
        { texto: "Abre la factura desde la lista." },
        { texto: "Pulsa «Editar», cambia lo necesario y pulsa «Guardar cambios»." },
        { texto: "Si el borrador no va, en el mismo panel pulsa «Eliminar» y confirma con «Sí, eliminar»." },
      ],
      notas: ["Solo un borrador se edita o se elimina. Una factura emitida se anula con un motivo."],
    },
    {
      id: "emitir-factura",
      titulo: "Emitir una factura que está en borrador",
      ruta: "/studio/facturacion",
      requiere: [editar("invoices")],
      pasos: [
        { texto: "Abre la factura desde la lista y revisa los datos." },
        { texto: "Pulsa «Emitir factura»." },
      ],
      notas: ["Una vez emitida ya no se edita ni se elimina: si está mal, se anula con un motivo."],
    },
    {
      id: "registrar-pago-desde-factura",
      titulo: "Registrar un pago desde la factura",
      ruta: "/studio/facturacion",
      requiere: [editar("invoices")],
      pasos: [
        { texto: "Abre la factura." },
        {
          texto:
            "Mira primero si hay pagos reportados por el cliente sin revisar. Si el pago que vas a registrar es uno de esos, confírmalo desde allí en vez de registrarlo, para no contarlo dos veces.",
        },
        { texto: "Pulsa «Registrar pago»." },
        { texto: "Completa monto, «Cuenta de caja / banco», «Método», «Fecha» y «Referencia»." },
        { texto: "Pulsa «Registrar cobro»." },
      ],
      notas: ["Es el mismo cobro que se registra en Cobranzas: crea el recibo y baja el saldo."],
    },
    {
      id: "resolver-pago-reportado",
      titulo: "Confirmar o rechazar un pago que reportó el cliente",
      ruta: "/studio/facturacion",
      requiere: [editar("invoices")],
      pasos: [
        { texto: "Abre la factura y ubica el pago reportado." },
        { texto: "Pulsa «Ver comprobante» para revisarlo." },
        { texto: "Si es correcto, elige la «Cuenta donde entró el dinero» y pulsa «Confirmar pago»." },
        { texto: "Si no lo es, pulsa «Rechazar»." },
        {
          texto:
            "En el cuadro que se abre, escribe el motivo, que es obligatorio en los dos casos, y pulsa «Confirmar pago» o «Rechazar reporte».",
        },
      ],
      notas: [
        "Confirmar crea el recibo y suma el pago a la factura; no lo registres también en Cobranzas.",
        "Rechazar no cambia el saldo; el comprobante y la nota del cliente se conservan.",
      ],
    },
    {
      id: "abrir-pdf",
      titulo: "Abrir o descargar la factura en PDF",
      ruta: "/studio/facturacion",
      requiere: [ver("invoices")],
      pasos: [
        { texto: "Abre la factura." },
        { texto: "Pulsa «PDF». Se abre en otra pestaña, desde donde la guardas o la imprimes." },
      ],
      notas: ["Un borrador no tiene PDF: primero hay que emitirlo."],
    },
    {
      id: "anular-factura",
      titulo: "Anular una factura",
      ruta: "/studio/facturacion",
      requiere: [editar("invoices")],
      pasos: [
        {
          texto:
            "Antes de empezar: si la factura tiene cobros registrados, primero hay que anularlos en Cobranzas. Una factura pagada no se anula.",
        },
        { texto: "Abre la factura y pulsa «Anular»." },
        { texto: "Escribe el motivo." },
        { texto: "Mantén presionado el botón «Anular factura» para confirmar." },
      ],
      notas: ["La factura queda anulada en el historial y su asiento se revierte."],
    },
    {
      id: "duplicar-factura",
      titulo: "Hacer una factura parecida a otra",
      ruta: "/studio/facturacion",
      requiere: [editar("invoices")],
      pasos: [
        { texto: "Abre la factura que quieres copiar." },
        { texto: "Pulsa «Duplicar». Se crea otra en borrador para que la ajustes." },
      ],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "«Agrega al menos una línea con descripción y monto.»",
      salida: "La factura necesita al menos una línea completa y un total mayor que cero.",
    },
    {
      sintoma: "«No se puede emitir: falta la tasa…»",
      salida: "La factura está en otra moneda y no hay tasa para esa fecha. Cárgala en Administración, en Tasas, o escríbela en el borrador.",
    },
    {
      sintoma: "«No se puede emitir: este embarque DDP no tiene una aceptación de T&C vigente del cliente.»",
      salida: "El cliente debe aceptar los términos desde su portal. Hasta entonces la factura se queda en borrador.",
    },
    {
      sintoma: "«Solo las facturas en borrador pueden editarse.»",
      salida: "La factura ya fue emitida. Si está mal, anúlala con un motivo y crea otra (puedes usar «Duplicar»).",
    },
    {
      sintoma: "El botón «Anular» está apagado y dice que tiene cobros vivos.",
      salida: "Anula primero esos cobros en Cobranzas y vuelve a intentarlo.",
    },
    {
      sintoma: "«La factura cambió mientras trabajabas.»",
      salida: "Otra persona la modificó. Recarga la página y revisa los datos antes de repetir.",
    },
    {
      sintoma: "«Escribe un motivo de 4 a 500 caracteres.» al resolver un pago reportado",
      salida: "El motivo es obligatorio tanto para confirmar como para rechazar.",
    },
  ],
  quienPuede:
    "Entran contabilidad y administración, y ambas pueden crear, emitir, cobrar y anular. Un administrador puede dar acceso adicional a una persona concreta.",
};
