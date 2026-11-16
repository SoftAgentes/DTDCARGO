/**
 * lib/studio/asistente/contenido/catalogo.ts · Estante 1 del minicerebro de
 * Faro (SDD-0637 §5): qué pantallas existen y para qué sirve cada una.
 *
 * Una entrada por módulo de `MODULES` (`lib/studio/modules.ts`); la prueba
 * `__tests__/catalogo.test.ts` falla si falta o sobra alguna. Las descripciones
 * se redactaron leyendo la `page.tsx` de cada pantalla el 2026-11-16.
 *
 * VISIBILIDAD · decisión D-3, aprobada por Sam el 2026-11-16. Cambiarla exige
 * su aprobación y pasa por PR:
 *   - `oculta`    = los cuatro módulos de superadministrador
 *                   (`SUPERADMIN_ONLY_MODULES`). Para quien no entra, no existen.
 *   - `reservada` = los demás solo-administrador (`ADMIN_ONLY_MODULES`) más
 *                   Nómina y Costing & Margen: sueldos, márgenes, permisos y
 *                   tablero del dueño. Preguntar por ellos sin acceso alerta
 *                   de inmediato (§6.3).
 *   - `normal`    = el resto, incluidos los módulos de dinero de uso diario
 *                   (Facturación, Cobranzas, Tesorería, Contabilidad, Fiscal,
 *                   Reportes): que alguien de ventas pregunte «¿cómo se cobra?»
 *                   no es una alerta; queda en el registro como «sin acceso».
 */

import type { EntradaCatalogo, Procedencia, Visibilidad } from "./tipos";

/**
 * Procedencia del catálogo entero. Es una sola para las 57 entradas a
 * propósito: cada descripción sale de la `page.tsx` de la ruta de su módulo
 * (`slug` de `MODULES`), y la prueba comprueba que esa página exista.
 */
export const PROCEDENCIA_CATALOGO: Procedencia = {
  revisado: "2026-11-16",
  responsable: "Sesión Lumi (Worker SDD-0637)",
  fuentes: ["lib/studio/modules.ts", "lib/studio/rbac.ts", "app/studio/(app)"],
};

function e(
  id: string,
  descripcion: string,
  opciones: { visibilidad?: Visibilidad; conGuia?: boolean } = {},
): EntradaCatalogo {
  return {
    id,
    descripcion,
    visibilidad: opciones.visibilidad ?? "normal",
    conGuia: opciones.conGuia ?? false,
  };
}

const RESERVADA = { visibilidad: "reservada" } as const;
const OCULTA = { visibilidad: "oculta" } as const;
const CON_GUIA = { conGuia: true } as const;

export const CATALOGO: readonly EntradaCatalogo[] = [
  // ─── OPERACIÓN ───────────────────────────────────────────────
  e("dashboard", "Tu resumen del día, con los indicadores de los módulos a los que tienes acceso. Lo puedes configurar."),
  e("shipments", "Consulta de embarques agrupados por cliente, con filtros, búsqueda y el detalle de cada uno.", CON_GUIA),
  e("tracking", "Seguimiento de los embarques activos: lista, mapa y línea de tiempo de cada etapa."),
  e("calendar", "Calendario con zarpes, arribos, entregas, feriados y ferias, en vistas de mes, semana y agenda."),
  e("bitacora", "Tablero y lista de tareas del equipo, con responsables y listas de verificación."),
  e("cn", "Recepciones de mercancía en la bodega de China, con sus indicadores."),
  e("qrqueue", "Órdenes de etiquetas QR por imprimir en oficina: filtras, seleccionas y envías a la impresora."),
  e("labels", "Genera etiquetas para los proveedores en China a partir de los clientes y los almacenes."),
  e("ve", "Embarques que ya están en Venezuela: aduana, reparto, entregados y excepciones."),
  e("naviera", "Itinerarios, reservas, contenedores con su ocupación y carga suelta por consolidar."),
  e("seniat", "Trámites aduaneros en cola o liberados, agentes, impuestos del año y detalle de cada trámite."),
  e("tms", "Transporte interno en Venezuela: flota, choferes, rutas, ubicación e incidencias."),
  e("despacho", "Cola priorizada de paquetes por despachar y órdenes de despacho activas."),
  e("despacho-rules", "Reglas con las que se calcula la prioridad de cada paquete por despachar."),
  e("despacho-dashboard", "Indicadores de despacho por período: rutas y ciudades con más volumen."),
  e("admin-rutas", "Rutas de despacho y catálogo de ciudades de destino."),
  e("inventory", "Existencias de la bodega de China y la de Venezuela, en volumen y peso. Solo consulta."),
  e("reclamos", "Reclamos y siniestros de clientes, con su evidencia y seguimiento."),
  e("inspecciones", "Reportes de inspección de calidad con fotos, indicadores del mes e informe imprimible."),

  // ─── COMERCIAL ───────────────────────────────────────────────
  e("quotes", "Estimados de precio para clientes: los creas, los filtras y les das seguimiento.", CON_GUIA),
  e("clients", "Catálogo de clientes con su Shipping Mark; creas y editas la ficha de cada uno.", CON_GUIA),
  e("conversaciones", "Bandeja de atención: conversaciones con clientes, con el hilo y el contexto de cada cliente."),
  e("bandeja", "Bandeja de mensajes de los canales de atención, dentro del Studio."),
  e("kommo", "Tablero de embudos de prospectos y clientes, con tarjetas que mueves entre etapas."),
  e("sales-orders", "Órdenes de venta: se crean desde un estimado o a mano y se les asignan prealertas."),
  e("suppliers", "Consulta de prealertas de servicios por estado y por proveedor."),
  e("purchase-orders", "Compras que la empresa hace por encargo del cliente, y prealertas del cliente."),
  e("service-catalog", "Contenido de los servicios del catálogo: lo editas y lo publicas."),
  e("rates", "Tarifas por servicio y ruta, de la lista de la casa o de la de un aliado."),
  e("fidelizacion", "Niveles de cliente, referidos e indicadores del programa de fidelización."),
  e("club", "Miembros del Club y rondas de compra grupal."),
  e("academia", "Cursos, cohortes en vivo, asistencia y emisión de diplomas."),

  // ─── FINANZAS ────────────────────────────────────────────────
  e("direccion", "Tablero del dueño: ingresos, utilidad, salud financiera, operación y alertas.", RESERVADA),
  e("invoices", "Facturas a clientes: lista con filtros e indicadores, emisión y detalle de cada una.", CON_GUIA),
  e("collections", "Cuentas por cobrar: saldos por antigüedad, registro de pagos recibidos y gestión de cobro.", CON_GUIA),
  e("expenses", "Registro y consulta de gastos, con sus indicadores del mes.", CON_GUIA),
  e("treasury", "Cuentas por pagar a proveedores, órdenes de pago y lista de proveedores.", CON_GUIA),
  e("accounting", "Plan de cuentas, libros diario y mayor, conciliación bancaria y activos fijos.", CON_GUIA),
  e("fiscal", "Libros de ventas y compras, retenciones y configuración fiscal por período."),
  e("costing", "Costo real y margen por embarque y por ruta.", RESERVADA),
  e("reports", "Reportes operativos, comerciales y financieros por período.", CON_GUIA),
  e("nomina", "Empleados, pagos, asistencia, préstamos y amonestaciones del personal.", RESERVADA),
  e("renditions", "Rendición periódica a la operadora: preparación, emisión e historial.", OCULTA),
  e("financiero-china", "Cuenta con el socio de China: conciliación, cuenta corriente y cargos.", OCULTA),

  // ─── MARKETING ───────────────────────────────────────────────
  e("marketing", "Inicio de marketing, con accesos al calendario, las noticias, el boletín, la Academia y el Club."),
  e("noticias-web", "Generador de noticias para la página web: redactas, publicas y retiras."),
  e("marketing-docs", "Lector de los documentos de marketing. Solo consulta."),

  // ─── SISTEMA ─────────────────────────────────────────────────
  e("mentions", "Tus menciones en comentarios; al abrir una te lleva al lugar y la marca como leída."),
  e("documents", "Repositorio central de documentos, con carpetas, búsqueda y filtros."),
  e("mis-bugs", "Los problemas y mejoras que reportaste, con su avance.", CON_GUIA),
  e("bugs", "Todos los reportes de error del equipo, en tablero y tabla, con estadísticas y filtros."),
  e("operarios", "Operarios de la aplicación móvil de bodega: los creas, los editas y les asignas almacén."),
  e("users", "Personas del equipo, sus roles, permisos e invitaciones.", RESERVADA),
  e("admin", "Configuración de la empresa: datos, tarifas, tasas, numeración, auditoría y documentación legal.", RESERVADA),
  e("mailing", "Correos enviados por el sistema, plantillas, reglas, firmas y lista de bloqueo.", RESERVADA),
  e("legal", "Expediente y evidencia de la documentación legal y sus aceptaciones.", OCULTA),
  e("no-olvidar", "Caja fuerte de recuperación. Todavía no está disponible.", OCULTA),
];

const POR_ID: ReadonlyMap<string, EntradaCatalogo> = new Map(
  CATALOGO.map((entrada) => [entrada.id, entrada]),
);

/** Entrada del catálogo de un módulo, o `undefined` si el id no existe. */
export function entradaDe(id: string): EntradaCatalogo | undefined {
  return POR_ID.get(id);
}
