import { editar, type GuiaModulo, ver } from "../tipos";

/** Guía de Embarques (`/studio/embarques`). Leída del código el 2026-11-16; corregida tras la revisión de Codex. */
export const GUIA_SHIPMENTS: GuiaModulo = {
  modulo: "shipments",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/embarques/page.tsx",
      "app/studio/(app)/embarques/actions.ts",
      "app/studio/(app)/embarques/_components/EmbarquesClient.tsx",
      "app/studio/(app)/embarques/_components/ShipmentDetailDrawer.tsx",
      "app/studio/(app)/tracking/nuevo/actions.ts",
      "app/studio/(app)/tracking/[id]/actions.ts",
      "lib/shared/shipment-public.ts",
      "lib/studio/documents/adjuntos.ts",
    ],
  },
  paraQueSirve:
    "Ver todos los embarques agrupados por cliente. Aquí se consulta; crear un embarque, cambiarle el estado, editarlo o cancelarlo se hace en Tracking. La única acción propia de esta pantalla es eliminar embarques, y es solo de administración.",
  queSeVe: [
    "Pestañas con contador: «Todos», «Activos», «Entregados» y «Con alertas».",
    "El campo «Buscar» (cliente, Shipping Mark, código o ruta), el selector de servicio y el filtro «Adjuntos».",
    "Los botones «Expandir todo» y «Colapsar todo».",
    "Una lista agrupada por cliente; dentro de cada cliente, sus embarques con Código, Ruta, Servicio, Estado, Progreso, CBM, Adjuntos y Creado.",
  ],
  tareas: [
    {
      id: "buscar-embarque",
      titulo: "Encontrar un embarque",
      ruta: "/studio/embarques",
      requiere: [ver("shipments")],
      pasos: [
        { texto: "Escribe en «Buscar» el cliente, el Shipping Mark, el código o la ruta." },
        { texto: "Si hace falta, elige una pestaña («Activos», «Entregados», «Con alertas») o un servicio." },
        { texto: "Despliega el cliente para ver sus embarques." },
      ],
    },
    {
      id: "ver-detalle-embarque",
      titulo: "Ver el detalle de un embarque",
      ruta: "/studio/embarques",
      requiere: [ver("shipments")],
      pasos: [
        { texto: "Pulsa la fila del embarque. Se abre el panel «Detalle del envío»." },
        { texto: "Revisa servicio, origen, destino, peso y volumen." },
        { texto: "Para ver su línea de tiempo, pulsa «Ir al tracking»." },
      ],
    },
    {
      id: "cambiar-estado-embarque",
      titulo: "Cambiar el estado de un embarque",
      ruta: "/studio/tracking",
      requiere: [ver("shipments"), editar("tracking")],
      pasos: [
        { texto: "En Embarques, pulsa la fila del embarque y luego «Ir al tracking»." },
        {
          texto:
            "En la página del embarque, usa la tarjeta «Acciones»: los botones dependen del servicio y del estado actual, por ejemplo «→ Marcar en tránsito».",
        },
      ],
      notas: [
        "La entrega al cliente no se marca desde Tracking: se confirma en Almacén VE o con la prueba de entrega sellada de Despacho.",
      ],
    },
    {
      id: "crear-embarque",
      titulo: "Crear un embarque",
      ruta: "/studio/tracking/nuevo",
      requiere: [editar("tracking")],
      pasos: [
        {
          texto:
            "Hay dos caminos, y ninguno empieza en Embarques: convertir un estimado aceptado desde Estimados, o pulsar «+ Envío» en Tracking.",
        },
        {
          texto:
            "En Tracking, completa «Código del envío», «Servicio», el cliente y su Shipping Mark, origen, destino, peso y volumen, y pulsa «CREAR ENVÍO».",
        },
        { texto: "Una vez creado, el embarque aparece en Embarques, dentro de su cliente." },
      ],
    },
    {
      id: "ver-alertas",
      titulo: "Ver los embarques con problemas",
      ruta: "/studio/embarques",
      requiere: [ver("shipments")],
      pasos: [
        { texto: "Abre la pestaña «Con alertas»." },
        { texto: "Pulsa cada embarque y entra a su tracking para ver qué pasó." },
      ],
    },
    {
      id: "eliminar-embarques",
      titulo: "Eliminar embarques",
      ruta: "/studio/embarques",
      requiere: [ver("shipments")],
      capacidad: "delete_shipments",
      soloRoles: ["admin"],
      pasos: [
        { texto: "Marca la casilla de cada embarque que quieres eliminar." },
        { texto: "En la barra que aparece, pulsa «Eliminar…»." },
        {
          texto:
            "Lee el aviso: el embarque deja de verse en varias pantallas y se cancelan sus avisos pendientes. Escribe el motivo, sin datos personales, y confirma.",
        },
      ],
      notas: [
        "Si un embarque no se puede eliminar, el cuadro dice por qué y ofrece «Ver los pasos» para resolverlo.",
      ],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "No encuentras cómo editar o cambiar el estado de un embarque.",
      salida: "Esta pantalla solo consulta. Abre el embarque y pulsa «Ir al tracking».",
    },
    {
      sintoma: "No ves el filtro ni la columna «Adjuntos», o ves «No se pudieron contar los adjuntos».",
      salida:
        "Aparecen solo para quien tiene acceso a Tracking. Si tienes acceso y ves el aviso, el conteo falló: recarga la página.",
    },
    {
      sintoma: "No ves casillas para seleccionar ni el botón de eliminar.",
      salida: "Eliminar embarques es solo de administración.",
    },
    {
      sintoma: "«Aún no hay envíos registrados.»",
      salida: "Todavía no hay embarques. Se crean al convertir un estimado aceptado o desde Tracking.",
    },
  ],
  quienPuede:
    "Entran comercial, operaciones, contabilidad, almacén, soporte y administración. Todos consultan; eliminar embarques es solo de administración. Cambiar estados y crear envíos depende del permiso de edición en Tracking.",
};
