import type { GuiaModulo } from "../tipos";

/** Guía de Gastos (`/studio/gastos`). Leída del código el 2026-11-16. */
export const GUIA_EXPENSES: GuiaModulo = {
  modulo: "expenses",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/gastos/page.tsx",
      "app/studio/(app)/gastos/actions.ts",
      "app/studio/(app)/gastos/_components/GastosClient.tsx",
      "app/studio/(app)/gastos/_components/ExpenseDrawer.tsx",
      "app/studio/(app)/gastos/_components/ExpenseRowActions.tsx",
      "lib/studio/expense-types.ts",
      "lib/studio/expense-void.ts",
      "lib/i18n/es-VE/expenses.ts",
    ],
  },
  paraQueSirve:
    "Registrar y consultar los gastos de la operación: los que pertenecen a un contenedor (transporte local, aduana) y los operativos (alquiler, servicios, suministros). Cada gasto guardado genera su asiento contable.",
  queSeVe: [
    "Tarjetas del mes: «Total del mes (USD)», «Por contenedor», «Operativos» y «Gastos cargados».",
    "Un aviso cuando hay contenedores esperando gastos, con los botones «Cargar gasto» y «Marcar cargado».",
    "Dos pestañas: «Por contenedor» y «Operativos».",
    "Filtros «Buscar» (código, nota, proveedor) y «Mes».",
    "Botones «Exportar mes» y «+ Nuevo gasto».",
    "Tabla con Código, Contenedor, Categoría, Detalle, Monto, USD, Método, Recibo y Acciones.",
  ],
  tareas: [
    {
      id: "registrar-gasto",
      titulo: "Registrar un gasto",
      ruta: "/studio/gastos",
      pasos: [
        { texto: "Pulsa «+ Nuevo gasto»." },
        {
          texto:
            "Elige el tipo: «Gasto de contenedor» si pertenece a un embarque, o «Gasto operativo» si es de oficina o bodega.",
        },
        { texto: "Si es de contenedor, elige el embarque en «Contenedor (embarque)»." },
        { texto: "Elige la «Categoría»." },
        { texto: "Escribe el «Monto» y elige la «Moneda»." },
        {
          texto:
            "Si la moneda no es dólares, completa el «Tipo de cambio». El sistema propone el último usado; confirma que sigue vigente.",
        },
        { texto: "Elige el «Método de pago»: Efectivo, Tarjeta, Transferencia o USDT." },
        { texto: "Escribe el «Detalle / descripción» y, si quieres, la «Ubicación»." },
        { texto: "Adjunta la foto del comprobante en «Adjuntar recibo / foto»." },
        { texto: "Marca «Cobrable al cliente» si el gasto se le va a cobrar." },
        { texto: "Pulsa «Guardar gasto»." },
      ],
      notas: [
        "El gasto se fecha con el día de hoy; no hay campo de fecha.",
        "El botón «Guardar gasto» se activa cuando hay monto, contenedor (si aplica) y tipo de cambio (si la moneda no es dólares).",
        "Un gasto de contenedor cierra solo el aviso de ese contenedor.",
      ],
    },
    {
      id: "editar-gasto",
      titulo: "Corregir un gasto ya guardado",
      ruta: "/studio/gastos",
      pasos: [
        { texto: "Busca el gasto en la tabla." },
        { texto: "Abre el menú «Acciones» de su fila y pulsa «Editar»." },
        { texto: "Cambia lo necesario y guarda." },
      ],
      notas: ["Al editar no se puede cambiar el comprobante."],
    },
    {
      id: "anular-gasto",
      titulo: "Anular un gasto",
      ruta: "/studio/gastos",
      soloRoles: ["admin", "accounting"],
      pasos: [
        { texto: "Abre el menú «Acciones» de la fila y pulsa «Anular gasto»." },
        { texto: "Escribe el «Motivo de la anulación»." },
        {
          texto:
            "Mantén presionado el botón para confirmar, o marca la casilla para anular con un clic y pulsa «Anular gasto».",
        },
      ],
      notas: [
        "El registro y su recibo se conservan. El asiento contable queda anulado y deja de afectar los saldos.",
      ],
    },
    {
      id: "exportar-mes",
      titulo: "Descargar los gastos del mes",
      ruta: "/studio/gastos",
      pasos: [
        { texto: "Elige el mes en el filtro «Mes»." },
        { texto: "Pulsa «Exportar mes». Se descarga un archivo CSV con los gastos de contenedor y los operativos." },
      ],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "«Período contable cerrado … no puedes cargar gastos en un período cerrado.»",
      salida:
        "El gasto se fecha hoy y hoy cae dentro de un período que contabilidad ya cerró. Habla con contabilidad.",
    },
    {
      sintoma: "«Indica el tipo de cambio.»",
      salida: "La moneda no es dólares y falta la tasa. Complétala en «Tipo de cambio».",
    },
    {
      sintoma: "«Tipo de cambio fuera del rango histórico … ¿Es correcto?»",
      salida: "Es una advertencia, no bloquea. Revisa que no hayas invertido la tasa o puesto un cero de más.",
    },
    {
      sintoma: "«Formato inválido (JPG/PNG/WebP/HEIC).» o «Foto demasiado pesada»",
      salida: "El comprobante debe ser una foto en uno de esos formatos y de tamaño moderado. Vuelve a tomarla o redúcela.",
    },
    {
      sintoma: "No aparece «Anular gasto» en el menú.",
      salida: "Solo contabilidad y administración pueden anular.",
    },
  ],
  quienPuede:
    "Entran contabilidad, operaciones, almacén y administración. Registrar, editar y exportar requiere permiso de edición. Anular es solo de contabilidad y administración.",
};
