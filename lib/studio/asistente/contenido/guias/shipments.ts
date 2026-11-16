import type { GuiaModulo } from "../tipos";

/** Guía de Embarques (`/studio/embarques`). Leída del código el 2026-11-16. */
export const GUIA_SHIPMENTS: GuiaModulo = {
  modulo: "shipments",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/embarques/page.tsx",
      "app/studio/(app)/embarques/_components/EmbarquesClient.tsx",
      "app/studio/(app)/embarques/_components/ShipmentDetailDrawer.tsx",
      "lib/shared/shipment-public.ts",
      "lib/studio/documents/adjuntos.ts",
    ],
  },
  paraQueSirve:
    "Ver todos los embarques agrupados por cliente. Es una pantalla de consulta: para crear un embarque, cambiarle el estado, editarlo o cancelarlo se entra a Tracking.",
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
      pasos: [
        { texto: "Pulsa la fila del embarque. Se abre el panel «Detalle del envío»." },
        { texto: "Revisa servicio, origen, destino, peso y volumen." },
        { texto: "Para ver su línea de tiempo o cambiar algo, pulsa «Ir al tracking»." },
      ],
    },
    {
      id: "cambiar-estado-embarque",
      titulo: "Cambiar el estado de un embarque",
      ruta: "/studio/embarques",
      pasos: [
        { texto: "Pulsa la fila del embarque." },
        { texto: "En el panel, pulsa «Ir al tracking»." },
        { texto: "El cambio de estado se hace allí, en la tarjeta «Acciones» del embarque." },
      ],
      notas: [
        "Desde Embarques no se cambia el estado: esta pantalla es de solo lectura.",
        "La entrega al cliente no se marca desde aquí ni desde Tracking: se confirma en Almacén VE.",
      ],
    },
    {
      id: "crear-embarque",
      titulo: "Crear un embarque",
      ruta: "/studio/embarques",
      pasos: [
        {
          texto:
            "Hay dos caminos, y ninguno empieza en esta pantalla: convertir un estimado aceptado desde Estimados, o crear el envío desde Tracking.",
        },
        { texto: "Una vez creado, el embarque aparece aquí, dentro de su cliente." },
      ],
    },
    {
      id: "ver-alertas",
      titulo: "Ver los embarques con problemas",
      ruta: "/studio/embarques",
      pasos: [
        { texto: "Abre la pestaña «Con alertas»." },
        { texto: "Pulsa cada embarque y entra a su tracking para ver qué pasó." },
      ],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "No encuentras cómo editar o cambiar el estado de un embarque.",
      salida: "Esta pantalla solo consulta. Abre el embarque y pulsa «Ir al tracking».",
    },
    {
      sintoma: "No ves el filtro ni la columna «Adjuntos».",
      salida: "Aparecen solo para quien tiene acceso a Tracking.",
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
    "Entran comercial, operaciones, contabilidad, almacén, soporte y administración. Todos consultan; eliminar embarques es solo de administración.",
};
