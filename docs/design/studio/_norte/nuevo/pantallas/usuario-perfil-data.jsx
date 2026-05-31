/* global React */
/* ── Perfil de usuario interno · standalone ──────────────────── */
/* Abre al click en @mención (comments) u owner (Vault, asignados).  */
/* Patrón espejo de chofer-perfil / camion-perfil / agente-perfil.   */

// ── Líneas corporativas por departamento (dadas por el cliente) ─
const CORP_LINES = {
  'Dirección':  { label: 'CEO · Dirección',        phone: '0414 884 0000' },
  'Ventas':     { label: 'Comercial',              phone: '0412 454 5325' },
  'Op. CN':     { label: 'Logística',              phone: '0414 888 8805' },
  'Op. VE':     { label: 'Transporte',             phone: '0412 495 0884' },
  'Finanzas':   { label: 'Contabilidad',           phone: '0414 887 0000' },
  'CX':         { label: 'CRM · Atención cliente',  phone: '0412 166 8021', whatsappApi: true },
  'Admin':      { label: 'Administración',          phone: '0241 414 7886' },
};

// ── Extra mock data por usuario ───────────────────────────────
// TODO: al consolidar, mover a erp/data.jsx · USER_PROFILES
const USER_PROFILES = {
  'u-001': {
    avatarColor: 'wine', roleIcon: 'bigboss',
    phone: '0414 884 0000', location: 'Caracas · HQ', presence: 'online',
    lastActive: 'activo ahora', joined: '2019-02-01', title: 'Director General · CEO',
    activity: [
      { icon: 'check', text: 'Aprobó cierre de contenedor DTDU-419032', mod: 'cn', when: 'hace 8 min' },
      { icon: 'invoice', text: 'Autorizó nota de crédito F-2026-0418', mod: 'invoices', when: 'hace 1 h' },
      { icon: 'users', text: 'Creó usuario Carolina Méndez (Soporte)', mod: 'users', when: 'hace 3 h' },
      { icon: 'doc', text: 'Firmó BL DTDU472816-OR', mod: 'documents', when: 'ayer 17:40' },
    ],
    owns: { label: 'Aprobaciones pendientes', count: 3, mod: 'dashboard', items: ['Cierre contenedor CN', 'Límite crédito DTD-5392', 'Baja proveedor sup-007'] },
    note: 'Acceso total. Único rol que aprueba límites de crédito y bajas de proveedor.',
  },
  'u-002': {
    avatarColor: 'info', roleIcon: 'compras',
    phone: '0412 454 5325', location: 'Yiwu · CN (viaje)', presence: 'online',
    lastActive: 'activo ahora', joined: '2021-06-14', title: 'Ejecutiva comercial senior',
    activity: [
      { icon: 'box', text: 'Creó cotización Q-2026-0331 · DTD-5418', mod: 'quotes', when: 'hace 4 min' },
      { icon: 'users', text: 'Registró lead Comercial Linares', mod: 'leads', when: 'hace 2 h' },
      { icon: 'mail', text: 'Envió seguimiento a DTD-5371', mod: 'mailing', when: 'hace 5 h' },
    ],
    owns: { label: 'Clientes asignados', count: 12, mod: 'clients', items: ['DTD-5418 Imp. Pereira', 'DTD-5371 Tech Solutions', 'DTD-5263 Comercial Linares'] },
    note: 'De viaje en CN coordinando suppliers. Responde por WhatsApp.',
  },
  'u-003': {
    avatarColor: 'info', roleIcon: 'compras',
    phone: '0412 160 5202', location: 'Caracas · HQ', presence: 'away',
    lastActive: 'hace 2 h', joined: '2022-01-10', title: 'Ejecutivo comercial',
    activity: [
      { icon: 'box', text: 'Actualizó embarque DTDU-388157', mod: 'shipments', when: 'hace 2 h' },
      { icon: 'users', text: 'Movió lead a "negociación"', mod: 'leads', when: 'ayer' },
    ],
    owns: { label: 'Clientes asignados', count: 7, mod: 'clients', items: ['DTD-5298 Vargas & Asoc', 'DTD-5215 Ortiz Cosmetics'] },
    note: '',
  },
  'u-004': {
    avatarColor: 'success', roleIcon: 'logistica',
    phone: '0414 888 8805', location: 'Yiwu · Almacén CN', presence: 'online',
    lastActive: 'activo ahora', joined: '2020-09-22', title: 'Coordinador de operaciones CN',
    activity: [
      { icon: 'warehouse', text: 'Consolidó contenedor · 48.2 CBM', mod: 'cn', when: 'hace 12 min' },
      { icon: 'box', text: 'Procesó recepción de 34 cajas · DTD-5452', mod: 'cn', when: 'hace 1 h' },
      { icon: 'truck', text: 'Cerró despacho DESP-2026-0188', mod: 'despacho', when: 'hace 4 h' },
    ],
    owns: { label: 'Embarques en su hub', count: 9, mod: 'shipments', items: ['DTDU-472816 (consolidando)', 'DTDU-398770 (recibido CN)', 'DTDU-401234 (consolidado)'] },
    note: 'Líder del equipo de Yiwu. Maneja el modo despacho de contenedores.',
  },
  'u-005': {
    avatarColor: 'success', roleIcon: 'almacenista',
    phone: '0412 495 0884', location: 'Puerto Cabello · Almacén VE', presence: 'online',
    lastActive: 'activo ahora', joined: '2021-03-08', title: 'Coordinadora de operaciones VE',
    activity: [
      { icon: 'warehouse', text: 'Desconsolidó DTDU-365044 · 56 CBM', mod: 've', when: 'hace 30 min' },
      { icon: 'truck', text: 'Asignó chofer a entrega Valencia', mod: 'tms', when: 'hace 2 h' },
    ],
    owns: { label: 'Entregas activas', count: 5, mod: 've', items: ['DTDU-365044 → Punto Fijo', 'DTDU-419032 → Maracaibo'] },
    note: '',
  },
  'u-006': {
    avatarColor: 'wine', roleIcon: 'contabilidad',
    phone: '0414 887 0000', location: 'Caracas · HQ', presence: 'away',
    lastActive: 'hace 3 h', joined: '2020-05-18', title: 'Contador general',
    activity: [
      { icon: 'invoice', text: 'Concilió 14 movimientos bancarios', mod: 'reconcile', when: 'hace 3 h' },
      { icon: 'invoice', text: 'Emitió F-2026-0431 · DTD-5354', mod: 'invoices', when: 'ayer' },
      { icon: 'doc', text: 'Cerró período contable abril', mod: 'contab', when: 'hace 2 d' },
    ],
    owns: { label: 'Facturas por cobrar', count: 8, mod: 'invoices', items: ['F-2026-0418 vencida 10d', 'F-2026-0425 vence en 3d'] },
    note: 'Único con permiso de lock de período contable.',
  },
  'u-007': {
    avatarColor: 'neutral', roleIcon: 'almacenista',
    phone: '0414 888 8805', location: 'Yiwu · Almacén CN', presence: 'online',
    lastActive: 'activo ahora', joined: '2022-08-30', title: 'Almacenista CN',
    activity: [
      { icon: 'box', text: 'Escaneó grupo de 20 cajas · DTD-5277', mod: 'cn', when: 'hace 6 min' },
      { icon: 'warehouse', text: 'Etiquetó mercancía frágil', mod: 'cn', when: 'hace 1 h' },
    ],
    owns: { label: 'Recepciones de hoy', count: 6, mod: 'cn', items: ['DTD-5277 · 20 cajas', 'DTD-5452 · 34 cajas'] },
    note: 'Opera la app móvil de Operario CN (escaneo + recepción).',
  },
  'u-008': {
    avatarColor: 'wine', roleIcon: 'administracion',
    phone: '0412 166 8021', location: 'Caracas · HQ', presence: 'offline',
    lastActive: 'invitación pendiente', joined: '—', title: 'Atención al cliente · CRM',
    activity: [],
    owns: { label: 'Tickets asignados', count: 0, mod: 'dashboard', items: [] },
    note: 'Usuaria recién invitada — todavía no activó su cuenta.',
  },
};

const PRESENCE = {
  online:  { tone: 'success', label: 'En línea' },
  away:    { tone: 'warning', label: 'Ausente' },
  offline: { tone: 'neutral', label: 'Desconectado' },
};

window.UsuarioPerfil_DATA = { CORP_LINES, USER_PROFILES, PRESENCE };
