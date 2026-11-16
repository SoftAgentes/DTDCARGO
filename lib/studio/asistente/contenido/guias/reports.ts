import { type GuiaModulo, ver } from "../tipos";

/** Guía de Reportes (`/studio/reportes`). Leída del código el 2026-11-16; corregida tras la revisión de Codex. */
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
    "Consultar el desempeño de la empresa sobre los datos reales del sistema: operación, comercial y finanzas. No cambia ningún documento del negocio; lo único que se guarda son configuraciones de reportes, en tu navegador.",
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
      requiere: [ver("reports")],
      pasos: [
        { texto: "Elige la categoría arriba." },
        { texto: "Elige el reporte en las pestañas." },
        { texto: "Cambia el «Período» si lo necesitas." },
      ],
      notas: [
        "«Por cliente», «Recompra» y «Aging CxC/CxP» muestran un período fijo: en lugar del selector ves un rótulo.",
        "«Por agente» está oculto por ahora, mientras ese dato se pasa al CRM.",
      ],
    },
    {
      id: "exportar-reporte",
      titulo: "Descargar un reporte",
      ruta: "/studio/reportes",
      requiere: [ver("reports")],
      pasos: [
        { texto: "Abre el reporte que quieres." },
        { texto: "Pulsa «Exportar CSV». Se descarga lo que estás viendo, con el período elegido." },
      ],
    },
    {
      id: "armar-reporte",
      titulo: "Armar un reporte a tu medida",
      ruta: "/studio/reportes",
      requiere: [ver("reports")],
      pasos: [
        { texto: "Abre la categoría «Constructor»." },
        { texto: "En «1 · Fuente», elige «Embarques» o «Facturas»." },
        { texto: "En «2 · Agrupar por», elige cómo agrupar (cliente, ruta, estado…)." },
        { texto: "En «3 · Métrica», elige qué medir." },
        { texto: "En «4 · Filtro», acota si hace falta." },
        {
          texto:
            "Para llevártelo, pulsa «Exportar CSV», o «Exportar PDF», que abre la impresión del navegador: allí eliges guardar como PDF.",
        },
        { texto: "Para usarlo otra vez, pulsa «Guardar reporte»." },
      ],
      notas: [
        "«Guardar reporte» guarda la combinación elegida, no los resultados: al abrirlo de nuevo se calcula con los datos del momento.",
        "Se guarda solo en este navegador: no se sincroniza a otro equipo y lo puede ver quien use el mismo navegador. En un equipo compartido, no le pongas nombres con datos sensibles.",
      ],
    },
    {
      id: "usar-reporte-guardado",
      titulo: "Abrir o borrar un reporte guardado",
      ruta: "/studio/reportes",
      requiere: [ver("reports")],
      pasos: [
        { texto: "Abre la categoría «Constructor»." },
        { texto: "En «Reportes guardados», pulsa el que quieres para aplicarlo, o su botón de eliminar para borrarlo." },
      ],
    },
    {
      id: "embarques-sin-facturar",
      titulo: "Ver qué falta por facturar",
      ruta: "/studio/reportes/embarques-sin-facturar",
      requiere: [ver("reports")],
      pasos: [
        { texto: "En la categoría «Contables & financieros», pulsa «¿Qué falta por facturar? Ver embarques sin facturar»." },
        { texto: "Revisa la lista: cada fila es una recepción sin factura, con su estado y lo que corresponde facturar." },
      ],
      notas: [
        "Una pre-factura en borrador no cuenta como facturada.",
        "Si aparece un aviso de «Lectura parcial», la lista está incompleta: no asumas que no hay más pendientes.",
      ],
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
      salida:
        "Puede faltar la tarifa de esa recepción, o el sistema todavía no tiene disponible la tarifa congelada. Lee el aviso de arriba de la lista.",
    },
  ],
  quienPuede: "Entran contabilidad y administración. Todo es de consulta.",
};
