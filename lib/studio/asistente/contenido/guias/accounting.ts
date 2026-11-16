import { editar, type GuiaModulo, ver } from "../tipos";

/** Guía de Contabilidad (`/studio/contabilidad`). Leída del código el 2026-11-16; corregida tras la revisión de Codex. */
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
      "app/studio/(app)/contabilidad/_components/EntryDrawer.tsx",
      "app/studio/(app)/contabilidad/_components/LibroMayorTab.tsx",
      "app/studio/(app)/contabilidad/_components/PorContabilizarTab.tsx",
      "app/studio/(app)/contabilidad/_components/ConciliacionTab.tsx",
      "app/studio/(app)/contabilidad/_components/StatementDrawer.tsx",
      "app/studio/(app)/contabilidad/_components/AssetDrawer.tsx",
      "app/studio/(app)/contabilidad/_components/ClosingDateDrawer.tsx",
      "app/studio/(app)/contabilidad/_components/AjustesDelCierre.tsx",
      "app/studio/(app)/contabilidad/_components/CamposExcepcionCierre.tsx",
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
      id: "revisar-por-contabilizar",
      titulo: "Ver qué documentos se quedaron sin asiento",
      ruta: "/studio/contabilidad",
      requiere: [ver("accounting")],
      pasos: [
        { texto: "Abre la pestaña «Por contabilizar»." },
        {
          texto:
            "En «Subdiario contra mayor» compara lo que dicen las facturas y las cuentas por pagar contra lo que dice el mayor; la diferencia es lo que falta cuadrar.",
        },
        {
          texto:
            "En «Documentos sin asiento» ves las facturas, recibos, CxP y pagos que no tienen su asiento. Cada bloque tiene «Exportar CSV».",
        },
      ],
      notas: [
        "Esta pestaña solo consulta; no crea asientos.",
        "Aquí aparecen los cobros, gastos y pagos cuyo asiento automático no se pudo generar.",
      ],
    },
    {
      id: "crear-asiento",
      titulo: "Crear un asiento manual",
      ruta: "/studio/contabilidad",
      requiere: [editar("accounting")],
      pasos: [
        { texto: "Abre la pestaña «Libro diario»." },
        { texto: "Pulsa «+ Nuevo asiento»." },
        { texto: "Indica la «Fecha» y el «Concepto»." },
        {
          texto:
            "En «Líneas», pulsa «+ Agregar línea» por cada movimiento y completa Cuenta, Debe o Haber. Hacen falta al menos dos líneas, y solo aparecen las cuentas que admiten movimientos.",
        },
        { texto: "Revisa que el indicador diga «Balanceado»." },
        {
          texto:
            "Deja marcada «Asentar al crear» y pulsa «Crear y asentar». Si la desmarcas, el botón dice «Guardar borrador» y el asiento queda en borrador.",
        },
      ],
      notas: [
        "Las facturas, cobros, pagos a proveedores, gastos y depreciaciones intentan generar su asiento solos. Antes de crear uno a mano para cubrir un faltante, revisa «Por contabilizar».",
      ],
    },
    {
      id: "asentar-anular-asiento",
      titulo: "Asentar un borrador o anular un asiento",
      ruta: "/studio/contabilidad",
      requiere: [editar("accounting")],
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
      id: "cambio-en-periodo-cerrado",
      titulo: "Cambiar un asiento de un período ya cerrado",
      ruta: "/studio/contabilidad",
      requiere: [editar("accounting")],
      pasos: [
        {
          texto:
            "En «Libro diario», los botones de un asiento de período cerrado dicen «Asentar…», «Eliminar…» o «Anular…». Pulsa el que corresponda.",
        },
        {
          texto:
            "En el cuadro que se abre, escribe el «Motivo del cambio» y, si el cierre lo exige, la «Superclave del cierre».",
        },
        { texto: "Confirma con el botón «… con excepción»." },
      ],
      notas: [
        "El cambio queda registrado en la pestaña «Excepciones al cierre».",
        "Definir o cambiar la superclave es de administración; usarla para un cambio autorizado no.",
      ],
    },
    {
      id: "crear-cuenta",
      titulo: "Agregar una cuenta al plan",
      ruta: "/studio/contabilidad",
      requiere: [editar("accounting")],
      pasos: [
        { texto: "En la pestaña «Plan de cuentas», pulsa «+ Cuenta»." },
        { texto: "Escribe el «Código» (numérico jerárquico) y el «Nombre»." },
        { texto: "Elige el «Tipo» y, si aplica, el «Subtipo»." },
        { texto: "Elige la «Cuenta padre (grupo)»." },
        {
          texto:
            "Marca «Postable» si en ella se van a asentar movimientos. Sin marcar, es un grupo que solo suma lo de sus cuentas hijas.",
        },
        { texto: "Pulsa «Crear cuenta»." },
      ],
      notas: ["El código no se puede cambiar después. La cuenta padre debe existir antes."],
    },
    {
      id: "ver-mayor",
      titulo: "Ver los movimientos de una cuenta",
      ruta: "/studio/contabilidad",
      requiere: [ver("accounting")],
      pasos: [
        { texto: "Abre la pestaña «Libro mayor»." },
        { texto: "Elige la cuenta en el selector «Cuenta». Verás sus movimientos asentados con el saldo corrido." },
      ],
    },
    {
      id: "reportes-del-periodo",
      titulo: "Sacar el estado de resultados o el balance",
      ruta: "/studio/contabilidad",
      requiere: [ver("accounting")],
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
      requiere: [editar("accounting")],
      pasos: [
        { texto: "Abre la pestaña «Conciliación» y pulsa «+ Cargar extracto»." },
        { texto: "Elige la «Cuenta banco / caja» y escribe el «Período»." },
        { texto: "Completa «Saldo inicial» y «Saldo final»." },
        {
          texto:
            "Con «+ Agregar movimiento», carga cada línea del extracto: fecha, descripción, si es ingreso o egreso, y monto.",
        },
        { texto: "Cuando el indicador diga «Cuadra», pulsa «Cargar extracto». El panel se cierra." },
        { texto: "En la lista de extractos, pulsa «Abrir» en el que acabas de cargar." },
        { texto: "En cada movimiento, pulsa «Ligar», busca el asiento por código o concepto y confirma." },
      ],
      notas: [
        "Conciliar solo liga el movimiento con un asiento que ya existe; no crea asientos.",
        "Un asiento se liga con un solo movimiento.",
      ],
    },
    {
      id: "registrar-activo",
      titulo: "Registrar un activo fijo",
      ruta: "/studio/contabilidad",
      requiere: [editar("accounting")],
      pasos: [
        { texto: "Abre la pestaña «Activos fijos» y pulsa «+ Activo»." },
        { texto: "Escribe el «Nombre del activo» y elige su cuenta." },
        { texto: "Indica «Costo», «Valor residual» si lo tiene, «Fecha de adquisición» y «Vida útil (meses)»." },
        { texto: "Revisa la cuota mensual que calcula el panel y pulsa «Registrar activo»." },
      ],
    },
    {
      id: "depreciar-mes",
      titulo: "Registrar la depreciación del mes",
      ruta: "/studio/contabilidad",
      requiere: [editar("accounting")],
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
      requiere: [editar("accounting")],
      soloRoles: ["admin"],
      pasos: [
        { texto: "Abre la pestaña «Libro diario» y pulsa «Cerrar período»." },
        { texto: "Indica la fecha en «Cerrar hasta la fecha»." },
        { texto: "Pulsa «Guardar cierre»." },
      ],
      notas: [
        "Los asientos con esa fecha o anteriores quedan cerrados.",
        "En el mismo panel se elige el modo del cierre y se define la superclave.",
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
        "La fecha cae en un período cerrado. Usa una fecha posterior, o haz el cambio con excepción si corresponde.",
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
    "Entran contabilidad y administración, y ambas pueden crear cuentas, asientos, extractos y activos, y hacer cambios con excepción en un período cerrado. Cerrar o reabrir el período, elegir su modo y definir la superclave es solo de administración.",
};
