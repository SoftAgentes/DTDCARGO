import type { GuiaModulo } from "../tipos";

/** Guía de Reportes (`/studio/reportes`). Leída del código el 2026-11-16. */
export const GUIA_REPORTS: GuiaModulo = {
  modulo: "reports",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/reportes/page.tsx",
      "app/studio/(app)/reportes/_components/ReportesClient.tsx",
      "app/studio/(app)/reportes/_components/BuilderView.tsx",
      "app/studio/(app)/reportes/embarques-sin-facturar/page.tsx",
      "lib/studio/reports/types.ts",
      "lib/studio/reports/queries.ts",
    ],
  },
  paraQueSirve:
    "Consultar el desempeño de la empresa sobre los datos reales del sistema: operación, comercial y finanzas. Es una pantalla de solo consulta; aquí no se registra nada.",
  queSeVe: [
    "Categorías: «Operacionales», «Comerciales», «Contables & financieros», «Constructor» y «Combinados».",
    "Dentro de cada categoría, pestañas con sus reportes. Por ejemplo, en Contables & financieros: «Estado de resultados», «Aging CxC/CxP», «Posición IVA» y «Facturado contra cobrado».",
    "El selector «Período»: «Este mes», «Último mes», «Últimos 3 meses», «Último año» y «Este año (YTD)».",
    "El botón «Exportar CSV», que descarga la vista que tienes abierta.",
    "En Contables & financieros, el enlace «¿Qué falta por facturar? Ver embarques sin facturar».",
  ],
  tareas: [
    {
      id: "ver-reporte",
      titulo: "Ver un reporte de un período",
      ruta: "/studio/reportes",
      pasos: [
        { texto: "Elige la categoría arriba." },
        { texto: "Elige el reporte en las pestañas." },
        { texto: "Cambia el «Período» si lo necesitas." },
      ],
      notas: [
        "En «Por cliente», «Recompra» y «Aging CxC/CxP» el período es fijo y el selector no cambia nada.",
        "«Por agente» está oculto por ahora, mientras ese dato se pasa al CRM.",
      ],
    },
    {
      id: "exportar-reporte",
      titulo: "Descargar un reporte",
      ruta: "/studio/reportes",
      pasos: [
        { texto: "Abre el reporte que quieres." },
        { texto: "Pulsa «Exportar CSV». Se descarga lo que estás viendo, con el período elegido." },
      ],
    },
    {
      id: "armar-reporte",
      titulo: "Armar un reporte a tu medida",
      ruta: "/studio/reportes",
      pasos: [
        { texto: "Abre la categoría «Constructor»." },
        { texto: "En «1 · Fuente», elige «Embarques» o «Facturas»." },
        { texto: "En «2 · Agrupar por», elige cómo agrupar (cliente, ruta, estado…)." },
        { texto: "En «3 · Métrica», elige qué medir." },
        { texto: "En «4 · Filtro», acota si hace falta." },
        { texto: "Pulsa «Exportar CSV», «Exportar PDF» o «Guardar reporte»." },
      ],
      notas: [
        "Los reportes guardados quedan solo en tu navegador: no los ve otra persona ni aparecen en otro equipo.",
      ],
    },
    {
      id: "embarques-sin-facturar",
      titulo: "Ver qué falta por facturar",
      ruta: "/studio/reportes/embarques-sin-facturar",
      pasos: [
        { texto: "En la categoría «Contables & financieros», pulsa «¿Qué falta por facturar? Ver embarques sin facturar»." },
        { texto: "Revisa la lista: cada fila es una recepción sin factura, con su estado y lo que corresponde facturar." },
      ],
      notas: ["Una pre-factura en borrador no cuenta como facturada."],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "«No hay datos para exportar en esta vista.»",
      salida: "El reporte está vacío para ese período. Prueba con un período más amplio.",
    },
    {
      sintoma: "«Conversión incompleta · subtotal conocido»",
      salida:
        "Hay documentos en otra moneda sin tasa de cambio registrada. El total mostrado es parcial hasta que se registre la tasa.",
    },
    {
      sintoma: "«Importe no disponible» en embarques sin facturar",
      salida: "A esa recepción le falta la tarifa. Hay que completarla antes de poder calcular el importe.",
    },
  ],
  quienPuede: "Entran contabilidad y administración. Todo es de consulta.",
};
