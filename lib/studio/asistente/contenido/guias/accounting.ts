import type { GuiaModulo } from "../tipos";

/** Guía de Contabilidad (`/studio/contabilidad`). Leída del código el 2026-11-16. */
export const GUIA_ACCOUNTING: GuiaModulo = {
  modulo: "accounting",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/contabilidad/page.tsx",
      "app/studio/(app)/contabilidad/actions.ts",
      "app/studio/(app)/contabilidad/_components/ContabilidadClient.tsx",
      "app/studio/(app)/contabilidad/_components/PlanCuentasTab.tsx",
      "app/studio/(app)/contabilidad/_components/LibroMayorTab.tsx",
      "app/studio/(app)/contabilidad/_components/PorContabilizarTab.tsx",
      "app/studio/(app)/contabilidad/_components/AjustesDelCierre.tsx",
      "lib/studio/journal-types.ts",
      "lib/studio/account-types.ts",
    ],
  },
  paraQueSirve:
    "Llevar los libros de la empresa en dólares: plan de cuentas, libro diario por doble partida, libro mayor, reportes del período, conciliación bancaria y activos fijos con su depreciación.",
  queSeVe: [
    "Pestañas: «Plan de cuentas», «Libro diario», «Libro mayor», «Reportes», «Por contabilizar», «Conciliación», «Activos fijos», «Excepciones al cierre» y «Tasas de cambio».",
    "El botón de la cabecera cambia con la pestaña: «+ Cuenta», «+ Nuevo asiento», «+ Cargar extracto» o «+ Activo».",
    "En «Libro diario», la etiqueta «Cerrado hasta» con la fecha del último cierre, si lo hay.",
    "En «Libro diario», columnas Asiento, Fecha, Concepto, Origen, Monto, Estado y Acciones. Los estados son Borrador, Asentado y Anulado.",
  ],
  tareas: [
    {
      id: "crear-asiento",
      titulo: "Crear un asiento manual",
      ruta: "/studio/contabilidad",
      pasos: [
        { texto: "Abre la pestaña «Libro diario»." },
        { texto: "Pulsa «+ Nuevo asiento»." },
        { texto: "Indica la «Fecha» y el «Concepto»." },
        {
          texto:
            "En «Líneas», pulsa «+ Agregar línea» por cada movimiento y completa Cuenta, Debe o Haber. Hacen falta al menos dos líneas.",
        },
        { texto: "Revisa que el indicador diga «Balanceado»." },
        {
          texto:
            "Deja marcada «Asentar al crear» y pulsa «Crear y asentar». Si la desmarcas, el botón dice «Guardar borrador» y el asiento queda en borrador.",
        },
      ],
      notas: [
        "Solo se asienta en cuentas postables (las hojas del plan).",
        "Las facturas, cobros, pagos a proveedores, gastos y depreciaciones generan su asiento solos; no hace falta crearlos a mano.",
      ],
    },
    {
      id: "asentar-anular-asiento",
      titulo: "Asentar un borrador o anular un asiento",
      ruta: "/studio/contabilidad",
      pasos: [
        { texto: "Abre la pestaña «Libro diario» y ubica el asiento." },
        { texto: "Si está en Borrador, pulsa «Asentar» (o «Eliminar» si no va)." },
        { texto: "Si está Asentado, pulsa «Anular» y escribe el motivo contable." },
      ],
      notas: [
        "Un asiento anulado queda en el historial.",
        "Los asientos que nacen de una factura o de su reverso están protegidos: se corrigen desde la factura.",
      ],
    },
    {
      id: "crear-cuenta",
      titulo: "Agregar una cuenta al plan",
      ruta: "/studio/contabilidad",
      pasos: [
        { texto: "En la pestaña «Plan de cuentas», pulsa «+ Cuenta»." },
        { texto: "Escribe el «Código» (numérico jerárquico) y el «Nombre»." },
        { texto: "Elige el «Tipo» y, si aplica, el «Subtipo»." },
        { texto: "Elige la «Cuenta padre (grupo)»." },
        { texto: "Marca «Postable» si en ella se van a asentar movimientos. Sin marcar, es un grupo que solo suma." },
        { texto: "Pulsa «Crear cuenta»." },
      ],
      notas: ["El código no se puede cambiar después. La cuenta padre debe existir antes."],
    },
    {
      id: "ver-mayor",
      titulo: "Ver los movimientos de una cuenta",
      ruta: "/studio/contabilidad",
      pasos: [
        { texto: "Abre la pestaña «Libro mayor»." },
        { texto: "Elige la cuenta en el selector «Cuenta». Verás sus movimientos asentados con el saldo corrido." },
      ],
    },
    {
      id: "reportes-del-periodo",
      titulo: "Sacar el estado de resultados o el balance",
      ruta: "/studio/contabilidad",
      pasos: [
        { texto: "Abre la pestaña «Reportes»." },
        { texto: "Indica «Desde» y «Hasta (corte)» y pulsa «Aplicar». Sin fechas, usa el mes en curso." },
        {
          texto:
            "Revisa «Estado de resultados», «Balance general» y «Balance de comprobación». Este último tiene «Exportar CSV».",
        },
      ],
    },
    {
      id: "conciliar-banco",
      titulo: "Conciliar un extracto bancario",
      ruta: "/studio/contabilidad",
      pasos: [
        { texto: "Abre la pestaña «Conciliación» y pulsa «+ Cargar extracto»." },
        { texto: "Elige la «Cuenta banco / caja» y escribe el «Período»." },
        { texto: "Completa «Saldo inicial» y «Saldo final», y agrega cada movimiento con «+ Agregar movimiento»." },
        { texto: "Cuando el indicador diga «Cuadra», pulsa «Cargar extracto»." },
        { texto: "En cada movimiento, pulsa «Ligar», busca el asiento por código o concepto y confirma." },
      ],
      notas: [
        "Conciliar solo liga el movimiento con un asiento que ya existe; no crea asientos.",
        "Un asiento se liga con un solo movimiento.",
      ],
    },
    {
      id: "depreciar-mes",
      titulo: "Registrar la depreciación del mes",
      ruta: "/studio/contabilidad",
      pasos: [
        { texto: "Abre la pestaña «Activos fijos»." },
        { texto: "Elige el mes en «Mes a depreciar» y pulsa «Depreciar mes»." },
      ],
      notas: ["Si ya se hizo ese mes, no se repite: avisa que no hay nada que depreciar."],
    },
    {
      id: "cerrar-periodo",
      titulo: "Cerrar un período contable",
      ruta: "/studio/contabilidad",
      soloRoles: ["admin"],
      pasos: [
        { texto: "Abre la pestaña «Libro diario» y pulsa «Cerrar período»." },
        { texto: "Indica la fecha en «Cerrar hasta la fecha»." },
        { texto: "Pulsa «Guardar cierre»." },
      ],
      notas: [
        "Los asientos con esa fecha o anteriores quedan cerrados.",
        "Para cambiar algo de un período cerrado hace falta un motivo y, según el modo del cierre, la superclave. El cambio queda en «Excepciones al cierre».",
        "«Reabrir período» quita el cierre.",
      ],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "El botón de crear el asiento está apagado, o sale «El asiento no balancea».",
      salida: "El asiento necesita al menos dos líneas y que el total del debe sea igual al del haber.",
    },
    {
      sintoma: "«Período contable cerrado … no puedes crear asientos con esa fecha o anteriores.»",
      salida:
        "La fecha cae en un período cerrado. Usa una fecha posterior, o haz el cambio con excepción si corresponde y tienes la autorización.",
    },
    {
      sintoma: "«Este asiento está protegido por una factura o un vínculo de reverso.»",
      salida: "No admite cambios manuales. Corrígelo desde la factura, en Facturación.",
    },
    {
      sintoma: "«Ya existe una cuenta con ese código.» o «Primero crea la cuenta … padre»",
      salida: "Revisa el código: debe ser único y su cuenta padre debe existir.",
    },
    {
      sintoma: "«La superclave no es correcta.»",
      salida:
        "Revísala con calma: tras varios intentos fallidos se bloquea, y cada bloqueo dura más que el anterior. Si se olvidó, la administración puede restablecerla.",
    },
    {
      sintoma: "No ves el botón «Cerrar período».",
      salida: "Solo la administración cierra y reabre períodos. Contabilidad ve hasta qué fecha está cerrado.",
    },
  ],
  quienPuede:
    "Entran contabilidad y administración, y ambas pueden crear cuentas, asientos, extractos y activos. El cierre de período, su modo y la superclave son solo de administración.",
};
