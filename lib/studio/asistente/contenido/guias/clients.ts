import type { GuiaModulo } from "../tipos";

/** Guía de Clientes (`/studio/clientes`). Leída del código el 2026-11-16. */
export const GUIA_CLIENTS: GuiaModulo = {
  modulo: "clients",
  estado: "borrador",
  procedencia: {
    revisado: "2026-11-16",
    responsable: "Sesión Lumi (Worker SDD-0637)",
    fuentes: [
      "app/studio/(app)/clientes/page.tsx",
      "app/studio/(app)/clientes/actions.ts",
      "app/studio/(app)/clientes/_components/ClientsClient.tsx",
      "app/studio/(app)/clientes/_components/ClientDrawer.tsx",
      "app/studio/(app)/clientes/_components/ClientDetailClient.tsx",
      "app/studio/(app)/clientes/_components/ClientAccountHeader.tsx",
      "app/studio/(app)/clientes/[markbox]/page.tsx",
      "lib/studio/client-types.ts",
      "lib/studio/client-account.ts",
    ],
  },
  paraQueSirve:
    "Llevar el catálogo de clientes. La cédula o el RIF identifica al cliente y el Shipping Mark identifica sus cajas. Desde la ficha de cada cliente ves sus datos, su acceso al portal y su historial de envíos.",
  queSeVe: [
    "El campo «Buscar» (cédula o RIF, nombre, Shipping Mark, email o teléfono), el filtro «Tier» y el botón «Pendientes de revisar».",
    "La tabla con Shipping Mark, Cédula/RIF, Nombre, Tier, Adjuntos, Contacto y Creado.",
    "Arriba, el menú «Mantenimiento» (con «Posibles duplicados» y «Códigos del legado»), «Exportar» y «+ Nuevo cliente».",
    "La ficha del cliente no tiene pestañas: es una página con tarjetas. Entre ellas: «Datos del cliente», «Perfil del cliente», «Acceso al portal», «Asesor asignado», «Direcciones de entrega», «Verificación de identidad», «Facturación», los adjuntos y el «Historial de envíos».",
    "En la ficha, arriba, las tarjetas «Saldo abierto», «Vencido», «Último pago» y «Embarques en curso».",
  ],
  tareas: [
    {
      id: "crear-cliente",
      titulo: "Crear un cliente",
      ruta: "/studio/clientes",
      pasos: [
        { texto: "Pulsa «+ Nuevo cliente»." },
        {
          texto:
            "Si aparece «Pertenece a», deja el cliente como directo o elige el aliado al que pertenece.",
        },
        { texto: "En «Tipo de cliente», elige «Persona (cédula)» o «Empresa (RIF)»." },
        { texto: "Escribe el «Nombre», o la «Razón social» si es empresa." },
        { texto: "Elige el «Tier»." },
        { texto: "Completa lo que tengas: «Email», «Teléfono», «Dirección», cédula o RIF y «Notas»." },
        {
          texto:
            "Pulsa «Crear y cerrar», «Crear y abrir perfil» o «Crear y empezar otro», según lo que vayas a hacer después.",
        },
      ],
      notas: [
        "El Shipping Mark se asigna solo; no hay que escribirlo.",
        "Si el cliente tiene email, recibe un correo de bienvenida y la invitación al portal.",
        "Si faltan datos, el aviso de creación trae el enlace «Completar perfil».",
      ],
    },
    {
      id: "buscar-cliente",
      titulo: "Encontrar un cliente",
      ruta: "/studio/clientes",
      pasos: [
        { texto: "Escribe en «Buscar» la cédula o RIF, el nombre, el Shipping Mark, el email o el teléfono." },
        { texto: "Si hace falta, acota con «Tier»." },
        { texto: "Pulsa la fila para abrir la ficha." },
      ],
      notas: ["La lista carga por bloques. Para llegar a un cliente puntual, usa el buscador en vez de bajar."],
    },
    {
      id: "editar-cliente",
      titulo: "Corregir los datos de un cliente",
      ruta: "/studio/clientes",
      pasos: [
        { texto: "Abre la ficha del cliente." },
        { texto: "Pulsa «Editar cliente»." },
        { texto: "Cambia lo necesario y pulsa «Guardar cambios»." },
      ],
    },
    {
      id: "invitar-al-portal",
      titulo: "Dar acceso al portal a un cliente",
      ruta: "/studio/clientes",
      pasos: [
        { texto: "Abre la ficha del cliente." },
        { texto: "En la tarjeta «Acceso al portal», pulsa «Invitar al portal» (o «Volver a invitar»)." },
        { texto: "Si prefieres enviarle el enlace tú, usa «Compartir por WhatsApp»." },
      ],
      notas: ["En la misma tarjeta, «Revocar acceso» le quita la entrada al portal."],
    },
    {
      id: "revisar-registros-web",
      titulo: "Revisar los clientes que se registraron solos",
      ruta: "/studio/clientes",
      pasos: [
        { texto: "Pulsa «Pendientes de revisar»." },
        { texto: "Abre cada cliente, revisa sus datos y su verificación de identidad." },
        { texto: "Si un cliente quedó repetido, ve al menú «Mantenimiento» y abre «Posibles duplicados»." },
      ],
    },
    {
      id: "ver-envios-del-cliente",
      titulo: "Ver los envíos de un cliente",
      ruta: "/studio/clientes",
      pasos: [
        { texto: "Abre la ficha del cliente." },
        { texto: "Baja a «Historial de envíos». Cada fila abre el envío." },
      ],
    },
  ],
  erroresFrecuentes: [
    {
      sintoma: "«Ya existe un cliente con ese RIF/cédula»",
      salida: "El cliente ya está cargado. Búscalo por su cédula o RIF en vez de crearlo otra vez.",
    },
    {
      sintoma: "«RIF inválido.» o «Cédula o pasaporte inválido.»",
      salida: "Escribe el documento con su letra y guion al inicio, como indica el ejemplo del campo.",
    },
    {
      sintoma: "«Dos altas tomaron el mismo Shipping Mark al mismo tiempo.»",
      salida: "Otra persona creó un cliente en el mismo instante. Intenta otra vez: el siguiente código ya está libre.",
    },
    {
      sintoma: "«Hay campos requeridos sin completar.»",
      salida: "Falta el nombre (o la razón social) o el tier.",
    },
    {
      sintoma: "No ves el botón «Estado de cuenta» en la ficha.",
      salida: "Ese botón es solo para quien tiene acceso a Facturación: contabilidad y administración.",
    },
    {
      sintoma: "«No tienes permiso para realizar esta acción.» al guardar",
      salida: "Tu acceso a Clientes es de solo consulta.",
    },
  ],
  quienPuede:
    "Entran comercial, operaciones, contabilidad, soporte y administración. Soporte solo consulta. El estado de cuenta es de contabilidad y administración.",
};
