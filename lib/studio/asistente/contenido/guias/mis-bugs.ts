import type { GuiaModulo } from "../tipos";

/** Guía de Mis reportes (`/studio/mis-bugs`). Leída del código el 2026-11-16. */
export const GUIA_MIS_BUGS: GuiaModulo = {
  modulo: "mis-bugs",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/mis-bugs/page.tsx",
      "app/studio/(app)/mis-bugs/actions.ts",
      "app/studio/(app)/mis-bugs/_components/BugCard.tsx",
      "app/studio/_components/bug-reporter/BugFABButton.tsx",
      "app/studio/_components/bug-reporter/BugReportModal.tsx",
      "app/studio/_components/StudioTopbar.tsx",
      "lib/studio/bug-types.ts",
      "lib/i18n/es-VE/bug-reporter.ts",
    ],
  },
  paraQueSirve:
    "Ver los errores, mejoras y sugerencias que reportaste y cómo van. Cuando un administrador avanza con uno, te llega un aviso a la campana.",
  queSeVe: [
    "Un resumen con el total y un contador por estado: Nuevo, Triaje, Esperando info, En progreso y Resuelto.",
    "Una tarjeta por reporte, de la más reciente a la más antigua, con su folio, la pantalla donde ocurrió, el estado, el título, la descripción, el «Progreso», la categoría y la severidad.",
  ],
  tareas: [
    {
      id: "reportar-problema",
      titulo: "Reportar un error o sugerir una mejora",
      ruta: "/studio/mis-bugs",
      pasos: [
        {
          texto:
            "Ve a la pantalla donde ocurrió el problema: el reporte guarda solo en qué pantalla estabas.",
        },
        {
          texto:
            "Abre tu menú de usuario, arriba, y pulsa «Reportar un problema». También puedes pulsar Alt+B para mostrar el botón flotante de reportes y hacer clic en él.",
        },
        { texto: "En «Tipo de reporte», elige Error, Mejora, Sugerencia o Pregunta." },
        { texto: "Si es un error, elige la «Severidad»: Baja, Media, Alta o Crítica." },
        { texto: "Escribe un «Título» corto." },
        { texto: "En «Descripción», cuenta qué intentabas hacer, qué pasó y qué esperabas que pasara." },
        { texto: "Pulsa «Enviar reporte»." },
      ],
      notas: [
        "Recibes un folio. Si alguien ya había reportado lo mismo, tu reporte se suma al existente.",
        "La dirección de la pantalla y los datos técnicos se adjuntan solos; no hace falta copiarlos.",
        "No escribas contraseñas ni datos personales de clientes en la descripción.",
      ],
    },
    {
      id: "ver-estado-reporte",
      titulo: "Ver cómo va un reporte",
      ruta: "/studio/mis-bugs",
      pasos: [
        { texto: "Abre «Mis reportes», en el grupo Sistema del menú." },
        { texto: "Busca la tarjeta del reporte: muestra el estado y el porcentaje de «Progreso»." },
      ],
      notas: [
        "Los estados van de Nuevo a Triaje, En progreso y Resuelto. «Esperando info» significa que hace falta un dato tuyo.",
      ],
    },
    {
      id: "mover-boton-reportes",
      titulo: "Mover u ocultar el botón flotante de reportes",
      ruta: "/studio/mis-bugs",
      pasos: [
        { texto: "Pulsa Alt+B para mostrarlo u ocultarlo." },
        { texto: "Arrástralo para llevarlo a otra esquina, o haz clic derecho sobre él y elige la esquina." },
      ],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "«Título muy corto» o «Descripción muy corta.»",
      salida: "Escribe un título de al menos unas palabras y una descripción que explique el problema.",
    },
    {
      sintoma: "No ves el botón flotante de reportes.",
      salida: "Arranca oculto. Pulsa Alt+B, o usa «Reportar un problema» en tu menú de usuario.",
    },
    {
      sintoma: "«Ya estaba reportado»",
      salida: "No es un error: tu aviso se sumó al reporte que ya existía.",
    },
    {
      sintoma: "«No se pudo crear el reporte. Reintenta.»",
      salida: "Vuelve a enviarlo. Si sigue fallando, avisa a un administrador por otra vía.",
    },
  ],
  quienPuede: "Todo el equipo puede reportar y ver sus propios reportes. Ver los de todos es del «Bug Tracker».",
};
