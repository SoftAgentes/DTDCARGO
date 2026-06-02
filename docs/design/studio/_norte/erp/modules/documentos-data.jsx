/* global React */
/* ── DTD ERP · Documentos · Datos & helpers ─────────────────── */
/* Hub central de adjuntos. Cada documento pertenece a una       */
/* carpeta y está adjunto a una transacción (embarque, factura,  */
/* pago, asiento, cliente). Transversal: no vive en Contabilidad.*/

// ── Árbol de carpetas ─────────────────────────────────────────
const FOLDERS = [
  { id: 'op', label: 'Operacionales', icon: 'users', tone: 'info', children: [
    { id: 'op-kyc',      label: 'Clientes · KYC & RIF' },
    { id: 'op-contratos', label: 'Contratos & poderes' },
    { id: 'op-autoriz',  label: 'Autorizaciones' },
  ]},
  { id: 'log', label: 'Logísticas', icon: 'ship', tone: 'wine', children: [
    { id: 'log-bl',      label: 'BL & conocimiento' },
    { id: 'log-packing', label: 'Packing & factura comercial' },
    { id: 'log-origen',  label: 'Certificados de origen' },
    { id: 'log-fotos',   label: 'Fotos de carga & precinto' },
  ]},
  { id: 'con', label: 'Contables & financieras', icon: 'invoice', tone: 'success', children: [
    { id: 'con-fact',    label: 'Facturas emitidas' },
    { id: 'con-pagos',   label: 'Comprobantes de pago / cobro' },
    { id: 'con-remesas', label: 'Remesas a China' },
    { id: 'con-retenc',  label: 'Retenciones IVA / ISLR' },
  ]},
  { id: 'adu', label: 'Aduaneras · SENIAT', icon: 'shield', tone: 'warning', children: [
    { id: 'adu-dua',     label: 'Declaración / DUA' },
    { id: 'adu-aranceles', label: 'Liquidación de aranceles' },
    { id: 'adu-permisos', label: 'Permisos & certificados' },
  ]},
  { id: 'otr', label: 'Otras', icon: 'doc', tone: 'neutral', children: [
    { id: 'otr-plantillas', label: 'Plantillas' },
    { id: 'otr-internos',   label: 'Internos' },
  ]},
];

// ── Tipos de archivo ──────────────────────────────────────────
const EXT_META = {
  pdf:  { tone: 'danger',  label: 'PDF' },
  jpg:  { tone: 'info',    label: 'JPG' },
  png:  { tone: 'info',    label: 'PNG' },
  xlsx: { tone: 'success', label: 'XLS' },
  docx: { tone: 'info',    label: 'DOC' },
  zip:  { tone: 'neutral', label: 'ZIP' },
};

// ── Vínculo a transacción ─────────────────────────────────────
// kind → módulo destino para goTo.
const LINK_KIND = {
  embarque:  { label: 'Embarque',  module: 'shipments',     icon: 'box' },
  factura:   { label: 'Factura',   module: 'invoices',      icon: 'invoice' },
  pago:      { label: 'Pago / CxP', module: 'tesoreria',    icon: 'cn' },
  asiento:   { label: 'Asiento',   module: 'contab',        icon: 'edit' },
  cliente:   { label: 'Cliente',   module: 'clients',       icon: 'users' },
  proveedor: { label: 'Proveedor', module: 'suppliers',     icon: 'cn' },
  ninguno:   { label: 'Sin transacción', module: null,      icon: 'doc' },
};

const DOC_STATUS = {
  firmado:   { label: 'Firmado',   tone: 'success' },
  vigente:   { label: 'Vigente',   tone: 'success' },
  pendiente: { label: 'Pendiente', tone: 'warning' },
  borrador:  { label: 'Borrador',  tone: 'neutral' },
  vencido:   { label: 'Vencido',   tone: 'danger'  },
  'por-vencer': { label: 'Por vencer', tone: 'warning' },
};

// ── Documentos (seed) ─────────────────────────────────────────
const DOCUMENTS = [
  // Logísticas
  { id: 'DOC-2051', name: 'BL COSCO · DTDU-419032', ext: 'pdf', folder: 'log-bl', type: 'BL marítimo', link: { kind: 'embarque', id: 'DTDU-419032' }, size: '248 KB', date: '2026-05-22', by: 'Luis Yáñez', status: 'firmado' },
  { id: 'DOC-2050', name: 'Packing List · DTDU-419032', ext: 'xlsx', folder: 'log-packing', type: 'Packing list', link: { kind: 'embarque', id: 'DTDU-419032' }, size: '64 KB', date: '2026-05-21', by: 'Wang Hua', status: 'firmado' },
  { id: 'DOC-2049', name: 'Factura comercial proveedor · Industrial CN', ext: 'pdf', folder: 'log-packing', type: 'Factura comercial', link: { kind: 'proveedor', id: 'sup-007' }, size: '180 KB', date: '2026-05-20', by: 'Luis Yáñez', status: 'firmado' },
  { id: 'DOC-2048', name: 'Certificado de origen · DTDU-419032', ext: 'pdf', folder: 'log-origen', type: 'Certificado origen', link: { kind: 'embarque', id: 'DTDU-419032' }, size: '120 KB', date: '2026-05-20', by: 'Luis Yáñez', status: 'firmado' },
  { id: 'DOC-2047', name: 'Fotos precinto contenedor · DTDU-472816', ext: 'jpg', folder: 'log-fotos', type: 'Foto precinto', link: { kind: 'embarque', id: 'DTDU-472816' }, size: '2.1 MB', date: '2026-05-22', by: 'Wang Hua', status: 'vigente' },
  { id: 'DOC-2046', name: 'BL Maersk · DTDU-472816', ext: 'pdf', folder: 'log-bl', type: 'BL marítimo', link: { kind: 'embarque', id: 'DTDU-472816' }, size: '232 KB', date: '2026-05-15', by: 'Luis Yáñez', status: 'firmado' },
  { id: 'DOC-2045', name: 'Booking COSCO · BKG-2026-0418', ext: 'pdf', folder: 'log-bl', type: 'Booking', link: { kind: 'embarque', id: 'DTDU-419032' }, size: '96 KB', date: '2026-05-18', by: 'Luis Yáñez', status: 'firmado' },

  // Contables & financieras
  { id: 'DOC-2044', name: 'Factura F-2026-0391 · Industrias Polar', ext: 'pdf', folder: 'con-fact', type: 'Factura emitida', link: { kind: 'factura', id: 'F-2026-0391' }, size: '88 KB', date: '2026-05-22', by: 'Andrés Briceño', status: 'firmado' },
  { id: 'DOC-2043', name: 'Comprobante transferencia · WIRE-9982', ext: 'pdf', folder: 'con-pagos', type: 'Comprobante de cobro', link: { kind: 'factura', id: 'F-2026-0391' }, size: '54 KB', date: '2026-05-22', by: 'Andrés Briceño', status: 'firmado' },
  { id: 'DOC-2042', name: 'Comprobante USDT TRC20 · OP-2026-0312', ext: 'png', folder: 'con-remesas', type: 'Remesa CN', link: { kind: 'pago', id: 'CXP-2026-0186' }, size: '320 KB', date: '2026-05-15', by: 'Carlos Vásquez', status: 'firmado' },
  { id: 'DOC-2041', name: 'Comprobante Alipay CNY · OP-2026-0310', ext: 'png', folder: 'con-remesas', type: 'Remesa CN', link: { kind: 'pago', id: 'CXP-2026-0184' }, size: '288 KB', date: '2026-05-20', by: 'Andrés Briceño', status: 'firmado' },
  { id: 'DOC-2040', name: 'Retención IVA · F-2026-0391', ext: 'pdf', folder: 'con-retenc', type: 'Retención IVA', link: { kind: 'factura', id: 'F-2026-0391' }, size: '42 KB', date: '2026-05-23', by: 'Andrés Briceño', status: 'pendiente' },
  { id: 'DOC-2039', name: 'Estado de cuenta Banco Mercantil · mayo', ext: 'pdf', folder: 'con-pagos', type: 'Estado de cuenta', link: { kind: 'ninguno', id: null }, size: '410 KB', date: '2026-05-24', by: 'Andrés Briceño', status: 'vigente' },

  // Aduaneras · SENIAT
  { id: 'DOC-2038', name: 'Declaración Única de Aduanas · DTDU-419032', ext: 'pdf', folder: 'adu-dua', type: 'DUA', link: { kind: 'embarque', id: 'DTDU-419032' }, size: '156 KB', date: '2026-05-23', by: 'Yusneidy Pérez', status: 'pendiente' },
  { id: 'DOC-2037', name: 'Liquidación de aranceles · DTDU-419032', ext: 'pdf', folder: 'adu-aranceles', type: 'Liquidación', link: { kind: 'embarque', id: 'DTDU-419032' }, size: '98 KB', date: '2026-05-23', by: 'Yusneidy Pérez', status: 'pendiente' },
  { id: 'DOC-2036', name: 'Certificado sanitario · Ortiz Cosmetics', ext: 'pdf', folder: 'adu-permisos', type: 'Permiso sanitario', link: { kind: 'cliente', id: 'DTD-5215' }, size: '210 KB', date: '2026-04-12', by: 'Yusneidy Pérez', status: 'por-vencer' },
  { id: 'DOC-2035', name: 'Permiso importación · Tech Solutions', ext: 'pdf', folder: 'adu-permisos', type: 'Permiso', link: { kind: 'cliente', id: 'DTD-5371' }, size: '174 KB', date: '2026-02-01', by: 'Yusneidy Pérez', status: 'vencido' },

  // Operacionales
  { id: 'DOC-2034', name: 'RIF · Industrias Polar SA', ext: 'pdf', folder: 'op-kyc', type: 'RIF', link: { kind: 'cliente', id: 'DTD-5392' }, size: '72 KB', date: '2026-01-15', by: 'Martina Acuña', status: 'vigente' },
  { id: 'DOC-2033', name: 'Registro mercantil · Acindar Comercial', ext: 'pdf', folder: 'op-kyc', type: 'Registro mercantil', link: { kind: 'cliente', id: 'DTD-5452' }, size: '1.2 MB', date: '2026-01-20', by: 'Martina Acuña', status: 'vigente' },
  { id: 'DOC-2032', name: 'Contrato de servicio DDP · Castro Hermanos', ext: 'pdf', folder: 'op-contratos', type: 'Contrato', link: { kind: 'cliente', id: 'DTD-5354' }, size: '340 KB', date: '2026-03-02', by: 'Carlos Vásquez', status: 'firmado' },
  { id: 'DOC-2031', name: 'Poder de representación aduanal', ext: 'pdf', folder: 'op-autoriz', type: 'Poder', link: { kind: 'cliente', id: 'DTD-5392' }, size: '128 KB', date: '2026-03-10', by: 'Carlos Vásquez', status: 'vigente' },

  // Otras
  { id: 'DOC-2030', name: 'Plantilla factura comercial (ES/中文)', ext: 'docx', folder: 'otr-plantillas', type: 'Plantilla', link: { kind: 'ninguno', id: null }, size: '56 KB', date: '2026-02-28', by: 'Andrés Briceño', status: 'vigente' },
  { id: 'DOC-2029', name: 'Procedimiento interno de despacho', ext: 'pdf', folder: 'otr-internos', type: 'Interno', link: { kind: 'ninguno', id: null }, size: '480 KB', date: '2026-04-01', by: 'Carlos Vásquez', status: 'vigente' },
];

// ── Helpers ───────────────────────────────────────────────────
function topOf(folderId) { return FOLDERS.find(f => f.id === folderId || f.children.some(c => c.id === folderId)); }
function subIds(topId) { const t = FOLDERS.find(f => f.id === topId); return t ? t.children.map(c => c.id) : []; }

function docsIn(folderId) {
  if (!folderId || folderId === 'all') return DOCUMENTS;
  // top-level → todos sus subfolders; subfolder → match exacto
  const top = FOLDERS.find(f => f.id === folderId);
  if (top) { const ids = top.children.map(c => c.id); return DOCUMENTS.filter(d => ids.includes(d.folder)); }
  return DOCUMENTS.filter(d => d.folder === folderId);
}
function folderCount(folderId) { return docsIn(folderId).length; }
function unlinked() { return DOCUMENTS.filter(d => d.link.kind === 'ninguno'); }
function expiring() { return DOCUMENTS.filter(d => d.status === 'por-vencer' || d.status === 'vencido'); }
function pending() { return DOCUMENTS.filter(d => d.status === 'pendiente'); }
function folderLabel(folderId) {
  for (const f of FOLDERS) { if (f.id === folderId) return f.label; const c = f.children.find(c => c.id === folderId); if (c) return c.label; }
  return '—';
}

window.DocumentosData = {
  FOLDERS, EXT_META, LINK_KIND, DOC_STATUS, DOCUMENTS,
  topOf, subIds, docsIn, folderCount, unlinked, expiring, pending, folderLabel,
};
