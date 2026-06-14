/* global React */
/* ── DTD ERP · Conversaciones · Datos & helpers ─────────────── */
/* Bandeja unificada: WhatsApp + Email + Portal en un solo hilo  */
/* por cliente. "Construir confianza cliente a cliente."         */

// ── Canales ───────────────────────────────────────────────────
const CHANNELS = {
  whatsapp: { label: 'WhatsApp', tone: 'success', short: 'WA' },
  email:    { label: 'Email',    tone: 'info',    short: 'EM' },
  portal:   { label: 'Portal',   tone: 'wine',    short: 'PO' },
};

// ── Tipo de conversación ──────────────────────────────────────
const CONV_TYPE = {
  consulta:    { label: 'Consulta',    tone: 'neutral' },
  cotizacion:  { label: 'Estimado',  tone: 'info'    },
  seguimiento: { label: 'Seguimiento', tone: 'success' },
  incidencia:  { label: 'Incidencia',  tone: 'warning' },
  reclamo:     { label: 'Caso',     tone: 'danger'  },
};

// ── Estado ────────────────────────────────────────────────────
const CONV_STATUS = {
  abierto:   { label: 'Abierto',   tone: 'warning' },
  pendiente: { label: 'Pendiente', tone: 'info'    },
  resuelto:  { label: 'Resuelto',  tone: 'success' },
};

// ── Conversaciones ────────────────────────────────────────────
// dir: 'in' (cliente) · 'out' (agente DTD).
const CONVERSATIONS = [
  {
    id: 'CV-2041', markbox: 'DTD-5392', client: 'Industrias Polar', channel: 'whatsapp', type: 'seguimiento',
    status: 'abierto', assignedTo: 'u-002', priority: 'alta', shipment: 'DTDU-419032', unread: 2, lastAt: 'hace 8 min',
    messages: [
      { dir: 'in',  author: 'Luis Fernández', at: '09:12', text: 'Buenos días Martina, ¿alguna novedad del contenedor que está en aduana de Maracaibo?' },
      { dir: 'out', author: 'Martina Acuña',   at: '09:20', text: 'Buen día Luis. El DTDU-419032 está en proceso de aforo. El agente estima liberación en 24-48h.' },
      { dir: 'in',  author: 'Luis Fernández', at: '09:48', text: 'Perfecto. ¿Me puedes avisar apenas tengamos la liberación? Necesito coordinar el camión.' },
      { dir: 'in',  author: 'Luis Fernández', at: '09:49', text: 'Gracias 🙏' },
    ],
  },
  {
    id: 'CV-2040', markbox: 'DTD-5354', client: 'Castro Hermanos', channel: 'whatsapp', type: 'reclamo',
    status: 'abierto', assignedTo: 'u-008', priority: 'alta', shipment: 'DTDU-365044', unread: 1, lastAt: 'hace 22 min',
    messages: [
      { dir: 'in',  author: 'Roberto Castro', at: '08:31', text: 'Recibimos el contenedor pero faltan 2 cajas según el packing. Shipping Mark DTD-5354.' },
      { dir: 'out', author: 'Carolina Méndez', at: '08:44', text: 'Roberto, lamento el inconveniente. Abro el caso ya mismo y reviso con almacén CN el conteo de salida.' },
      { dir: 'in',  author: 'Roberto Castro', at: '08:52', text: 'Te paso las fotos del precinto y del conteo.' },
    ],
  },
  {
    id: 'CV-2039', markbox: 'DTD-5418', client: 'Imp. Pereira', channel: 'email', type: 'cotizacion',
    status: 'pendiente', assignedTo: 'u-003', priority: 'media', shipment: null, unread: 0, lastAt: 'hace 1 h',
    messages: [
      { dir: 'in',  author: 'Adriana Pereira', at: 'Ayer 17:10', text: 'Necesito estimado DDP para 12 CBM de iluminación LED desde Shenzhen a La Guaira.' },
      { dir: 'out', author: 'Diego Núñez',     at: 'Ayer 18:02', text: 'Adriana, con gusto. ¿Tienes el valor FOB de la mercancía para calcular aranceles? Te armo el estimado DDP completa.' },
    ],
  },
  {
    id: 'CV-2038', markbox: 'DTD-5452', client: 'Acindar Comercial', channel: 'whatsapp', type: 'consulta',
    status: 'pendiente', assignedTo: 'u-002', priority: 'media', shipment: 'DTDU-472816', unread: 0, lastAt: 'hace 2 h',
    messages: [
      { dir: 'in',  author: 'Carlos Méndez', at: '07:40', text: '¿El embarque DTDU-472816 ya zarpó de Yiwu?' },
      { dir: 'out', author: 'Martina Acuña',  at: '07:55', text: 'Sí, zarpó el 22/05 en el COSCO HARMONY. ETA Puerto Cabello 24/06. Te comparto el tracking por el portal.' },
    ],
  },
  {
    id: 'CV-2037', markbox: 'DTD-5371', client: 'Tech Solutions', channel: 'portal', type: 'seguimiento',
    status: 'abierto', assignedTo: null, priority: 'baja', shipment: 'DTDU-412908', unread: 1, lastAt: 'hace 3 h',
    messages: [
      { dir: 'in', author: 'María González', at: '06:18', text: 'Hola, ¿cuándo consolidan mi carga? Está en almacén de Shanghai hace una semana.' },
    ],
  },
  {
    id: 'CV-2036', markbox: 'DTD-5340', client: 'Dist. Andina', channel: 'whatsapp', type: 'incidencia',
    status: 'abierto', assignedTo: 'u-005', priority: 'alta', shipment: 'DTDU-401234', unread: 0, lastAt: 'hace 4 h',
    messages: [
      { dir: 'in',  author: 'Patricia Rojas', at: '05:50', text: 'El camión llegó a Mérida pero la dirección de entrega estaba mal en la guía.' },
      { dir: 'out', author: 'Yusneidy Pérez',  at: '06:05', text: 'Patricia, ya corregí la dirección con el transportista. ¿Confirmas que es Av. Las Américas, galpón 14?' },
      { dir: 'in',  author: 'Patricia Rojas', at: '06:12', text: 'Correcto, ese es. Gracias por la rapidez.' },
    ],
  },
  {
    id: 'CV-2035', markbox: 'DTD-5277', client: 'BriceñoTex', channel: 'email', type: 'consulta',
    status: 'resuelto', assignedTo: 'u-003', priority: 'baja', shipment: 'DTDU-398770', unread: 0, lastAt: 'Ayer',
    messages: [
      { dir: 'in',  author: 'Andrés Briceño', at: 'Ayer 11:20', text: '¿Qué documentos necesito para el despacho de mi textil?' },
      { dir: 'out', author: 'Diego Núñez',     at: 'Ayer 11:48', text: 'Factura comercial, packing list y certificado de origen. Te dejé un checklist en el portal.' },
      { dir: 'in',  author: 'Andrés Briceño', at: 'Ayer 12:30', text: 'Perfecto, ya los sube. Gracias.' },
    ],
  },
  {
    id: 'CV-2034', markbox: 'DTD-5215', client: 'Ortiz Cosmetics', channel: 'whatsapp', type: 'cotizacion',
    status: 'resuelto', assignedTo: 'u-002', priority: 'media', shipment: null, unread: 0, lastAt: 'Ayer',
    messages: [
      { dir: 'in',  author: 'Valentina Ortiz', at: 'Ayer 14:00', text: 'Me pasás el estimado para 6 CBM de cosmética?' },
      { dir: 'out', author: 'Martina Acuña',   at: 'Ayer 14:30', text: 'Listo Valentina, te envié el estimado DDP por email. Incluye el certificado sanitario.' },
      { dir: 'in',  author: 'Valentina Ortiz', at: 'Ayer 15:10', text: 'Aprobada, procedan. 👍' },
    ],
  },
];

// ── Respuestas rápidas (plantillas) ───────────────────────────
const QUICK_REPLIES = [
  { id: 'qr-1', label: 'Saludo', text: 'Buenos días, gracias por escribir a DTD-Cargo. ¿En qué puedo ayudarte?' },
  { id: 'qr-2', label: 'ETA en proceso', text: 'Estamos verificando el estatus de tu embarque con la naviera. Te confirmo el ETA en breve.' },
  { id: 'qr-3', label: 'Tracking portal', text: 'Puedes seguir tu embarque en tiempo real desde el portal del cliente con tu Shipping Mark.' },
  { id: 'qr-4', label: 'Caso abierto', text: 'Abre tu caso y lo estoy revisando con el equipo de almacén. Te mantengo al tanto.' },
  { id: 'qr-5', label: 'Cierre', text: '¿Hay algo más en lo que pueda ayudarte? Quedamos atentos. Con Confianza, de China a tu puerta.' },
];

// ── Helpers ───────────────────────────────────────────────────
function agent(userId) {
  return (window.ERPData?.USERS || []).find(u => u.id === userId) || null;
}
function byStatus(s) { return CONVERSATIONS.filter(c => c.status === s); }
function unassigned() { return CONVERSATIONS.filter(c => !c.assignedTo && c.status !== 'resuelto'); }
function openReclamos() { return CONVERSATIONS.filter(c => c.type === 'reclamo' && c.status !== 'resuelto'); }
function totalUnread() { return CONVERSATIONS.reduce((s, c) => s + (c.unread || 0), 0); }
function resolvedToday() { return CONVERSATIONS.filter(c => c.status === 'resuelto' && (c.lastAt || '').toLowerCase().includes('ayer') === false).length; }

window.ConversacionesData = {
  CHANNELS, CONV_TYPE, CONV_STATUS, CONVERSATIONS, QUICK_REPLIES,
  agent, byStatus, unassigned, openReclamos, totalUnread, resolvedToday,
};
