/* global window */
/* ── DTD · Mapa de proceso · Reglas de automatización ────────── */
/* Cada regla viaja sobre una LÍNEA DE ENLACE del flujograma:     */
/* un disparador en un nodo → una acción en otro nodo/módulo.     */
/* "Atadas a los archivos y procesos internos" (módulos del ERP). */

(function () {
  // category: agrupa en el panel. auto: encendida por defecto.
  // from/to: ids de nodo (coinciden con las TIES del mapa).
  const LIST = [
  {
    id: 'AUT-01', from: 'com-lead', to: 'com-quote', category: 'Comercial',
    trigger: 'El cliente solicita una cotización (web · WhatsApp · WeChat)',
    action: 'Genera la cotización DDP y la envía al cliente',
    detail: 'Toma tarifa de Servicios & Tarifas, arma el PDF en el Cotizador y lo envía.',
    modules: ['Cotizador', 'Servicios & Tarifas'],
    channels: ['correo', 'portal'], auto: true, runs: 38
  },  {
    id: 'AUT-02', from: 'com-client', to: 'op-pedido', category: 'Comercial → Operación',
    trigger: 'La cotización se acepta',
    action: 'Crea la orden de pedido y asigna MARKBOX',
    detail: 'Genera OP-2026-XXXX en Embarques · órdenes y la deja en seguimiento.',
    modules: ['Clientes', 'Embarques · órdenes'],
    auto: true, runs: 21
  },
  {
    id: 'AUT-03', from: 'op-pedido', to: 'con-factura', category: 'Operación → Contabilidad',
    trigger: 'Se crea la orden de pedido',
    action: 'Genera la orden de pedido en Contabilidad (borrador de factura)',
    detail: 'Crea un borrador atado a la OP. Queda en espera hasta que la mercadería llegue a China.',
    modules: ['Embarques · órdenes', 'Facturación'],
    auto: true, runs: 21
  },
  {
    id: 'AUT-04', from: 'op-recibir', to: 'con-factura', category: 'Operación → Contabilidad',
    trigger: 'El pedido se recibe en el almacén de China',
    action: 'Convierte el borrador en factura DDP emitida',
    detail: 'Lo que llega se factura: pasa el borrador a F-2026-XXXX y queda lista para enviar.',
    modules: ['Almacén CN', 'Facturación'],
    channels: ['correo', 'portal', 'app'], auto: true, runs: 14
  },
  {
    id: 'AUT-05', from: 'op-booking', to: 'con-cxpflete', category: 'Operación → Contabilidad',
    trigger: 'Se reserva el booking con la naviera',
    action: 'Registra la CxP de flete marítimo en Tesorería',
    detail: 'Crea CXP-2026-XXXX al beneficiario naviera con el monto del flete.',
    modules: ['Naviera & Consol.', 'Tesorería'],
    auto: true, runs: 9
  },
  {
    id: 'AUT-06', from: 'op-aduana', to: 'con-cxpad', category: 'Operación → Contabilidad',
    trigger: 'SENIAT liquida aranceles e IVA',
    action: 'Registra la CxP de impuestos y aduana',
    detail: 'Crea la CxP al agente aduanal con la liquidación.',
    modules: ['Aduana SENIAT', 'Tesorería'],
    auto: false, runs: 0
  },
  {
    id: 'AUT-07', from: 'op-despacho', to: 'con-cxplocal', category: 'Operación → Contabilidad',
    trigger: 'Se despacha la última milla',
    action: 'Registra la CxP de flete local y choferes',
    detail: 'Crea la CxP al transporte interno con el costo de la ruta.',
    modules: ['Despacho', 'Tesorería'],
    auto: false, runs: 0
  },
  {
    id: 'AUT-08', from: 'op-entrega', to: 'con-cobrofin', category: 'Operación → Contabilidad',
    trigger: 'Se confirma la entrega (POD)',
    action: 'Emite el cobro del saldo final y notifica al cliente',
    detail: 'Genera el cobro pendiente y avisa por su canal preferido.',
    modules: ['Tracking', 'Cobranzas'],
    conditions: [{ field: 'monto', op: '>', value: 0 }],
    channels: ['app', 'whatsapp'], auto: true, runs: 11
  },
  {
    id: 'AUT-09', from: 'con-cierre', to: 'com-post', category: 'Contabilidad → Comercial',
    trigger: 'Cobros y pagos del embarque quedan en cero',
    action: 'Activa postventa y suma puntos de fidelización',
    detail: 'Marca el ciclo cerrado y abre la tarea de postventa.',
    modules: ['Contabilidad', 'Fidelización'],
    conditions: [{ field: 'tier', op: '=', value: 'Gold' }],
    auto: false, runs: 0
  },
  {
    id: 'AUT-10', from: 'op-aduana', to: 'sc-reclamo', category: 'Operación → Servicio',
    trigger: 'Se detecta un faltante o demora en aduana',
    action: 'Abre un reclamo y avisa al cliente por su canal',
    detail: 'Crea el caso en Conversaciones · Reclamos y notifica automáticamente.',
    modules: ['Aduana SENIAT', 'Conversaciones'],
    channels: ['whatsapp', 'app'], auto: true, runs: 6
  },
  {
    id: 'AUT-11', from: 'sc-csat', to: 'com-post', category: 'Servicio → Comercial',
    trigger: 'El caso se cierra con CSAT alto',
    action: 'Marca al cliente para postventa y referidos',
    detail: 'Pasa el cliente satisfecho al flujo de fidelización.',
    modules: ['CX · CSAT', 'Fidelización'],
    conditions: [{ field: 'tier', op: '≠', value: 'Bronze' }],
    auto: false, runs: 0
  }];


  const tieKey = (from, to) => from + '→' + to;
  const byTie = {};
  LIST.forEach((r) => byTie[tieKey(r.from, r.to)] = r);

  // ── Registro de ejecuciones (log) ────────────────────────────
  const LOG = [
  { id: 'AUT-04', at: 'hace 12 min', summary: 'Pedido recibido en CN · BriceñoTex', artifact: 'F-2026-0433', module: 'Facturación' },
  { id: 'AUT-01', at: 'hace 38 min', summary: 'Cotización solicitada · Manuel Quintero', artifact: 'Q-2026-0422', module: 'Cotizador' },
  { id: 'AUT-08', at: 'hace 1 h', summary: 'POD confirmado · Castro Hermanos', artifact: 'COB-2026-0188', module: 'Cobranzas' },
  { id: 'AUT-05', at: 'hace 2 h', summary: 'Booking COSCO PISCES · Acindar', artifact: 'CXP-2026-0191', module: 'Tesorería' },
  { id: 'AUT-02', at: 'hace 3 h', summary: 'Cotización aceptada · Imp. Pereira', artifact: 'OP-2026-0313', module: 'Embarques · órdenes' },
  { id: 'AUT-03', at: 'hace 3 h', summary: 'Orden creada · Imp. Pereira', artifact: 'borrador F-2026-0434', module: 'Facturación' },
  { id: 'AUT-01', at: 'hace 5 h', summary: 'Cotización solicitada · Sánchez Cosmetics', artifact: 'Q-2026-0421', module: 'Cotizador' },
  { id: 'AUT-04', at: 'ayer', summary: 'Pedido recibido en CN · Tech Solutions', artifact: 'F-2026-0432', module: 'Facturación' },
  { id: 'AUT-08', at: 'ayer', summary: 'POD confirmado · Vargas & Asoc', artifact: 'COB-2026-0185', module: 'Cobranzas' },
  { id: 'AUT-01', at: 'ayer', summary: 'Cotización solicitada · Daniela Linares', artifact: 'Q-2026-0420', module: 'Cotizador' }];


  window.FlowRules = {
    LIST, LOG,
    logFor: (id) => LOG.filter((e) => e.id === id),
    forTie: (from, to) => byTie[tieKey(from, to)] || null,
    forNode: (id) => LIST.filter((r) => r.from === id),
    count: LIST.length,
    activeCount: () => LIST.filter((r) => r.auto).length
  };
})();
