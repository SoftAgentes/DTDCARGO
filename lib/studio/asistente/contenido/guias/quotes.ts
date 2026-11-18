import { editar, type GuiaModulo, ver } from "../tipos";

/** Guía de Estimados (`/studio/cotizador`). Leída del código el 2026-11-16; corregida tras la revisión de Codex. */
export const GUIA_QUOTES: GuiaModulo = {
  modulo: "quotes",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/cotizador/page.tsx",
      "app/studio/(app)/cotizador/actions.ts",
      "app/studio/(app)/cotizador/_components/CotizadorClient.tsx",
      "app/studio/(app)/cotizador/_components/QuoteDrawer.tsx",
      "app/studio/(app)/cotizador/_components/QuoteDetailClient.tsx",
      "app/studio/(app)/cotizador/[code]/page.tsx",
      "lib/studio/quote-types.ts",
      "lib/studio/mail/mail-rule-engine.ts",
      "lib/shared/shipment-public.ts",
    ],
  },
  paraQueSirve:
    "Preparar estimados de precio para los clientes, con el total calculado a partir de la tarifa del catálogo, enviarlos y, cuando el cliente acepta, convertirlos en un embarque.",
  queSeVe: [
    "El campo «Buscar» (código, cliente, Shipping Mark o ruta) y el filtro «Estado»: Todos, Borrador, Enviada, Aceptada, Rechazada y Vencida.",
    "El botón «Web · por revisar», que muestra los estimados que llegaron de la página web y aún no tienen cliente.",
    "La tabla con Código, Cliente, Servicio, Ruta, CBM, Total, Estado y Vigencia.",
    "Arriba, «Exportar» y «+ Nuevo estimado».",
    "En el detalle de un estimado: sus datos y los botones «Editar», «Enviar estimado», «WhatsApp», «PDF» y «Duplicar».",
  ],
  tareas: [
    {
      id: "crear-estimado",
      titulo: "Hacer un estimado",
      ruta: "/studio/cotizador",
      requiere: [editar("quotes")],
      pasos: [
        { texto: "Pulsa «+ Nuevo estimado»." },
        { texto: "En «Servicio», elige la tarjeta del servicio." },
        { texto: "En «Cliente», busca por cédula, nombre o Shipping Mark y elígelo." },
        { texto: "Escribe «Origen» y «Destino»." },
        {
          texto:
            "Completa las medidas. Si el servicio cobra por volumen, pide «CBM», «Peso (kg)» y «Cajas»; si es de tarifa fija, solo «Peso (kg)».",
        },
        {
          texto:
            "Revisa la tarifa: se propone la del catálogo. Si dice «Sin tarifa registrada», escríbela tú.",
        },
        { texto: "Elige el «Embalaje»." },
        { texto: "Indica «Válida hasta»." },
        { texto: "Revisa el «Total estimado» en la tarjeta oscura." },
        { texto: "Pulsa «Crear y cerrar», «Crear y abrir detalle» o «Crear y empezar otra»." },
      ],
      notas: [
        "El estimado nace en Borrador: el cliente no lo recibe hasta que lo envíes.",
        "El embalaje en paleta o en caja de madera suma un costo adicional al total.",
      ],
    },
    {
      id: "enviar-estimado",
      titulo: "Enviar un estimado al cliente",
      ruta: "/studio/cotizador",
      requiere: [editar("quotes")],
      pasos: [
        { texto: "Abre el estimado desde la lista. Debe estar en Borrador." },
        { texto: "Pulsa «Enviar estimado». El estimado pasa a Enviada y el sistema intenta mandarle el correo al cliente." },
      ],
      notas: [
        "Que el estimado diga Enviada no garantiza que el correo salió: depende de que haya una regla activa en Mailing. Si dudas, confírmalo con el cliente.",
        "Una vez enviado ya no se puede editar.",
      ],
    },
    {
      id: "compartir-estimado",
      titulo: "Compartir un estimado por WhatsApp o en PDF",
      ruta: "/studio/cotizador",
      requiere: [ver("quotes")],
      pasos: [
        { texto: "Abre el estimado." },
        { texto: "Pulsa «WhatsApp» para abrir el mensaje con el desglose listo, o «PDF» para abrir el documento." },
      ],
      notas: [
        "Compartirlo así no cambia su estado: si quieres que conste como enviado, pulsa también «Enviar estimado».",
      ],
    },
    {
      id: "aceptar-rechazar-estimado",
      titulo: "Marcar un estimado como aceptado o rechazado",
      ruta: "/studio/cotizador",
      requiere: [editar("quotes")],
      pasos: [
        { texto: "Abre el estimado. Debe estar en Enviada." },
        { texto: "Pulsa «Aceptada» o «Rechazada», según lo que respondió el cliente." },
      ],
    },
    {
      id: "convertir-a-embarque",
      titulo: "Convertir un estimado aceptado en embarque",
      ruta: "/studio/cotizador",
      requiere: [editar("quotes"), ver("tracking")],
      pasos: [
        { texto: "Abre el estimado. Debe estar en Aceptada." },
        { texto: "Pulsa «Convertir a embarque» y confirma con «Sí, convertir»." },
        {
          texto:
            "Se crea el embarque en Borrador con el cliente, la ruta, el peso y el volumen, y te lleva a su página en Tracking.",
        },
      ],
      notas: [
        "La conversión no es automática al aceptar: hay que pulsar el botón.",
        "Un estimado se convierte una sola vez. Después ya no se puede eliminar.",
      ],
    },
    {
      id: "duplicar-estimado",
      titulo: "Hacer un estimado parecido a otro",
      ruta: "/studio/cotizador",
      requiere: [editar("quotes")],
      pasos: [
        { texto: "Abre el estimado que quieres copiar." },
        { texto: "Pulsa «Duplicar». Se crea un Borrador nuevo con la vigencia recalculada." },
        { texto: "Revisa la tarifa y el total antes de enviarlo: se copian del original." },
      ],
    },
    {
      id: "vincular-estimado-web",
      titulo: "Asignar a un cliente un estimado que llegó de la web",
      ruta: "/studio/cotizador",
      requiere: [editar("quotes")],
      pasos: [
        { texto: "Pulsa «Web · por revisar»." },
        { texto: "Abre el estimado y revisa los datos del prospecto." },
        { texto: "En la sección «Vincular a cliente», escribe el Shipping Mark del cliente y pulsa «Vincular»." },
      ],
      notas: ["Si la persona todavía no es cliente, hay que crearla primero en Clientes."],
    },
    {
      id: "eliminar-estimado",
      titulo: "Eliminar un estimado",
      ruta: "/studio/cotizador",
      requiere: [editar("quotes")],
      pasos: [
        { texto: "En la lista, abre el menú de la fila y pulsa «Eliminar»." },
        { texto: "Confirma en el cuadro «Eliminar estimado»." },
      ],
      notas: [
        "Deja de verse en el Studio y en el portal del cliente, y recuperarlo no es sencillo.",
        "No se puede eliminar un estimado ya convertido en embarque ni uno ligado a una orden de venta.",
      ],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "«Sin tarifa registrada — define la tarifa manualmente.»",
      salida: "No hay tarifa en el catálogo para ese servicio y esa ruta. Escríbela en el campo de tarifa, o pide que la carguen en Tarifas.",
    },
    {
      sintoma: "«Solo los estimados en borrador pueden editarse.»",
      salida: "Ya fue enviado. Usa «Duplicar» para hacer uno nuevo con los cambios.",
    },
    {
      sintoma: "Un mensaje que dice que solo se puede pasar a un estado desde otro, con nombres en inglés.",
      salida:
        "El paso está fuera de orden. El orden es Borrador, luego Enviada, y de ahí Aceptada o Rechazada.",
    },
    {
      sintoma: "«Solo estimados aceptados pueden convertirse.»",
      salida: "Marca primero el estimado como «Aceptada».",
    },
    {
      sintoma: "«Eliminar» está apagado en el menú de la fila.",
      salida: "El estimado ya se convirtió en embarque o está ligado a una orden de venta, y se conserva.",
    },
  ],
  quienPuede:
    "Entran comercial, operaciones, contabilidad, soporte y administración. Soporte solo consulta.",
};
