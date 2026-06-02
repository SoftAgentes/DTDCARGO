/* global React, window */
/* ── DTD · Mapa de proceso · Resúmenes por nodo ─────────────── */
/* Cada nodo tiene su PROPIA lógica de resumen: 2 indicadores +  */
/* 3-4 registros clickeables + una acción que mueve el flujo.    */
/* Lee datos compartidos del ERP (ERPData/Tesorería/...).        */

(function () {
  const D = () => window.ERPData || {};
  const T = () => window.TesoreriaData || {};
  const C = () => window.ContabilidadData || {};
  const safe = (fn, fb) => {try {const v = fn();return v == null ? fb : v;} catch (e) {return fb;}};
  const usd = (v) => '$' + Math.round(v || 0).toLocaleString('en-US');
  const ERP = (hash) => 'DTD Studio · ERP.html' + (hash ? '#' + hash : '');

  // ── Vínculos cliente ↔ cotización ↔ envío ↔ factura ──────────
  const quotesOf = (code) => (D().QUOTES || []).filter((q) => q.client === code);
  const shipsOf = (code) => (D().SHIPMENTS || []).filter((s) => s.client === code);
  const invsOf = (code) => (D().INVOICES || []).filter((i) => i.client === code);

  // ── Órdenes de pedido (origen → almacén China) ───────────────
  // Estados: negociación (WeChat) · confirmada · en tránsito · recibida CN.
  const EST = {
    negociacion: { label: 'En negociación · WeChat', tone: 'neutral', icon: 'chat' },
    confirmada: { label: 'Confirmada', tone: 'info', icon: 'check' },
    transito: { label: 'En tránsito a China', tone: 'wine', icon: 'ship' },
    recibida: { label: 'Recibida en CN', tone: 'success', icon: 'warehouse' }
  };
  const ORDENES = [
  { id: 'OP-2026-0312', cliente: 'Juan Marcano', markbox: 'DTD-5452', estado: 'negociacion', proveedor: 'Yiwu Standard Co', items: 'Repuestos industriales · 3 SKU', valor: 9200, nota: 'Negociando MOQ y precio por WeChat', touch: 'hace 3 h' },
  { id: 'OP-2026-0311', cliente: 'Adriana Pereira', markbox: 'DTD-5418', estado: 'confirmada', proveedor: 'Shenzhen Lights Ltd', items: 'Lámparas LED · 8 cajas', valor: 14200, nota: 'Proveedor confirmó, espera retiro', touch: 'hace 1 día' },
  { id: 'OP-2026-0309', cliente: 'BriceñoTex', markbox: 'DTD-5277', estado: 'transito', proveedor: 'Guangzhou Textile', items: 'Tela de algodón · 22 rollos', valor: 11200, nota: 'En camino al almacén YIW · ETA 02 jun', touch: 'hace 2 días' },
  { id: 'OP-2026-0305', cliente: 'Dist. Andina', markbox: 'DTD-5340', estado: 'negociacion', proveedor: 'Yiwu Trade Mall', items: 'Bolsos sintéticos · 14 cajas', valor: 7400, nota: 'Espera contraoferta del proveedor', touch: 'hace 5 h' },
  { id: 'OP-2026-0303', cliente: 'Tech Solutions', markbox: 'DTD-5371', estado: 'recibida', proveedor: 'Shanghai Tech Corp', items: 'Laptops Lenovo · 24 u', valor: 8400, nota: 'Recibida y pesada · lista para QR', touch: 'recibida hace 1 día' }];

  window.FlowOrdenes = ORDENES;

  // ── Registro de resúmenes ────────────────────────────────────
  // Cada entrada → { kpis:[{k,v,tone}], records:[{icon,title,sub,right,tone,href}],
  //                  action:{kind:'send'|'link', label, href?, items?} }
  const REG = {

    // ░░ COMERCIAL ░░
    'com-lead': () => {
      const leads = D().LEADS || [];
      const open = leads.filter((l) => !['ganado', 'descartado', 'perdido'].includes(l.stage));
      const pot = open.reduce((s, l) => s + (l.value || 0), 0);
      return {
        kpis: [
        { k: 'En pipeline', v: open.length, tone: 'info' },
        { k: 'Valor potencial', v: usd(pot), tone: 'wine' }],

        records: open.slice(0, 4).map((l) => ({
          icon: 'spark', title: l.name, sub: l.company + ' · ' + l.source,
          right: l.value ? usd(l.value) : l.stage, tone: l.stage === 'propuesta' ? 'warning' : 'neutral',
          chip: l.stage, href: ERP('crm')
        })),
        action: { kind: 'link', label: 'Abrir CRM · Leads', href: ERP('crm') }
      };
    },

    'com-quote': () => {
      const qs = D().QUOTES || [];
      const open = qs.filter((q) => ['enviada', 'borrador'].includes(q.status));
      const byType = {};open.forEach((q) => byType[q.type] = (byType[q.type] || 0) + 1);
      const top = Object.entries(byType).sort((a, b) => b[1] - a[1]);
      return {
        kpis: [
        { k: 'En gestión', v: open.length, tone: 'info' },
        { k: 'Aceptadas', v: qs.filter((q) => q.status === 'aceptada').length, tone: 'success' }],

        groupTitle: 'Por servicio',
        groups: top.map(([k, v]) => ({ label: k, value: v })),
        records: open.slice(0, 4).map((q) => ({
          icon: 'calc', title: q.id, sub: q.clientName + ' · ' + q.type,
          right: usd(q.totalUSD), tone: q.status === 'enviada' ? 'info' : 'neutral', chip: q.status, href: ERP('quotes')
        })),
        action: { kind: 'link', label: 'Abrir cotizador', href: ERP('quotes') }
      };
    },

    'com-client': () => {
      const cl = (D().CLIENTS || []).slice().sort((a, b) => (b.since || '').localeCompare(a.since || ''));
      const recent = cl.slice(0, 4);
      return {
        kpis: [
        { k: 'Activos', v: (D().CLIENTS || []).filter((c) => c.status === 'active').length, tone: 'success' },
        { k: 'Por activar', v: (D().CLIENTS || []).filter((c) => c.status === 'pending').length, tone: 'warning' }],

        recordsTitle: 'Últimos registros · y a qué están atados',
        records: recent.map((c) => {
          const q = quotesOf(c.markbox).length,sh = shipsOf(c.markbox).length;
          const links = [q ? q + ' cotiz.' : null, sh ? sh + ' env.' : null].filter(Boolean).join(' · ') || 'sin vínculos aún';
          return {
            icon: 'users', title: c.name, sub: c.company + ' · ' + c.markbox,
            right: links, tone: c.status === 'pending' ? 'warning' : 'neutral',
            chip: c.status === 'pending' ? 'auto · portal' : c.tier, href: ERP('clients')
          };
        }),
        action: { kind: 'link', label: 'Abrir Clientes', href: ERP('clients') }
      };
    },

    'com-post': () => {
      const cl = D().CLIENTS || [];
      return {
        kpis: [
        { k: 'Al día', v: cl.filter((c) => c.status === 'active').length, tone: 'success' },
        { k: 'Reactivar', v: cl.filter((c) => c.status === 'inactive').length, tone: 'warning' }],

        records: cl.filter((c) => c.tier === 'Platinum' || c.tier === 'Gold').slice(0, 3).map((c) => ({
          icon: 'star', title: c.name, sub: c.company + ' · ' + c.tier,
          right: c.shipments + ' env.', tone: 'success', href: ERP('clients')
        })),
        action: { kind: 'link', label: 'Abrir Fidelización', href: ERP('clients') }
      };
    },

    // ░░ OPERATIVIDAD ░░
    'op-pedido': () => {
      const pend = ORDENES.filter((o) => o.estado !== 'recibida');
      return {
        kpis: [
        { k: 'Pendientes', v: pend.length, tone: 'wine' },
        { k: 'En negociación', v: ORDENES.filter((o) => o.estado === 'negociacion').length, tone: 'neutral' }],

        recordsTitle: 'Pedidos · en qué punto están',
        records: ORDENES.slice(0, 4).map((o) => ({
          icon: EST[o.estado].icon, title: o.cliente, sub: o.items + ' · ' + o.proveedor,
          right: EST[o.estado].label, tone: EST[o.estado].tone, chip: o.id, href: ERP('shipments')
        })),
        action: { kind: 'link', label: 'Abrir órdenes de pedido', href: ERP('shipments') }
      };
    },

    'op-recibir': () => {
      const cn = D().WAREHOUSE_CN || [];
      const pend = cn.filter((w) => /pendiente|incidencia/.test(w.status));
      return {
        kpis: [
        { k: 'Recepciones', v: cn.length, tone: 'info' },
        { k: 'Con incidencia', v: cn.filter((w) => w.status === 'incidencia').length, tone: 'danger' }],

        recordsTitle: 'Última mercadería recibida',
        records: cn.slice(0, 4).map((w) => ({
          icon: w.status === 'incidencia' ? 'warn' : 'box', title: w.clientName, sub: w.boxes + ' cajas · ' + w.cbm + ' CBM · ' + w.warehouse,
          right: w.status === 'incidencia' ? 'incidencia' : w.received.slice(5), tone: w.status === 'incidencia' ? 'danger' : 'neutral', href: ERP('warehouse-cn')
        })),
        action: { kind: 'link', label: 'Abrir Almacén CN', href: ERP('warehouse-cn') }
      };
    },

    'op-aduana': () => {
      const sh = (D().SHIPMENTS || []).filter((s) => s.status === 'aduana VE');
      return {
        kpis: [
        { k: 'En aduana', v: sh.length, tone: 'warning' },
        { k: 'Con alerta', v: sh.filter((s) => s.alert).length, tone: 'danger' }],

        recordsTitle: 'En proceso SENIAT',
        records: sh.slice(0, 4).map((s) => ({
          icon: 'shield', title: s.id, sub: s.clientName + ' · ' + s.type,
          right: s.alert ? 'alerta' : s.progress + '%', tone: s.alert ? 'danger' : 'warning', chip: s.destination, href: ERP('customs')
        })),
        action: { kind: 'link', label: 'Abrir Aduana SENIAT', href: ERP('customs') }
      };
    },

    'op-transito': () => {
      const sh = (D().SHIPMENTS || []).filter((s) => ['tránsito', 'zarpado'].includes(s.status));
      return {
        kpis: [
        { k: 'En el mar', v: sh.length, tone: 'wine' },
        { k: 'Próx. arribo', v: sh.length ? sh.sort((a, b) => (a.eta || '').localeCompare(b.eta || ''))[0].eta?.slice(5) : '—', tone: 'info' }],

        recordsTitle: 'Buques en tránsito',
        records: sh.slice(0, 4).map((s) => ({
          icon: 'ship', title: s.id, sub: s.vessel + ' · ' + s.origin + '→' + s.destination,
          right: 'ETA ' + (s.eta ? s.eta.slice(5) : '—'), tone: 'wine', chip: s.progress + '%', href: ERP('tracking')
        })),
        action: { kind: 'link', label: 'Abrir Tracking', href: ERP('tracking') }
      };
    },

    'op-despacho': () => {
      const ve = D().WAREHOUSE_VE || [];
      return {
        kpis: [
        { k: 'Por despachar', v: ve.filter((w) => w.delivery === 'pendiente').length, tone: 'warning' },
        { k: 'Entregados', v: ve.filter((w) => w.status === 'entregado').length, tone: 'success' }],

        recordsTitle: 'Cola de despacho',
        records: ve.slice(0, 4).map((w) => ({
          icon: 'truck', title: w.clientName, sub: w.address + ' · ' + w.port,
          right: w.delivery === 'pendiente' ? 'pendiente' : 'entregado', tone: w.delivery === 'pendiente' ? 'warning' : 'success', href: ERP('despacho')
        })),
        action: { kind: 'link', label: 'Abrir Despacho', href: ERP('despacho') }
      };
    },

    // ░░ CONTABILIDAD ░░
    'con-factura': () => {
      const sh = D().SHIPMENTS || [];
      const porFacturar = sh.filter((s) => s.status === 'recibido CN' && !s.billed);
      const invs = D().INVOICES || [];
      // Facturas listas pero aún no enviadas al cliente (simulado por estado 'emitida').
      const listas = invs.filter((i) => i.status === 'emitida');
      return {
        kpis: [
        { k: 'Por facturar', v: porFacturar.length, tone: 'warning' },
        { k: 'Listas p/ enviar', v: listas.length, tone: 'info' }],

        recordsTitle: 'Facturas · estado de envío',
        records: invs.slice(0, 4).map((i) => ({
          icon: 'invoice', title: i.id, sub: i.clientName + ' · ' + usd(i.amount),
          right: i.status === 'emitida' ? 'enviar' : i.status, tone: i.status === 'emitida' ? 'info' : i.status === 'vencida' ? 'danger' : i.status === 'pagada' ? 'success' : 'neutral',
          sendable: i.status === 'emitida', href: ERP('billing'), payload: i
        })),
        action: listas.length ? { kind: 'send', label: 'Enviar ' + listas.length + ' factura' + (listas.length > 1 ? 's' : '') + ' al cliente', items: listas } : { kind: 'link', label: 'Abrir Facturación', href: ERP('billing') }
      };
    },

    'con-cobro1': () => {
      const invs = D().INVOICES || [];
      const porCobrar = invs.filter((i) => ['emitida', 'parcial'].includes(i.status));
      return {
        kpis: [
        { k: 'Por cobrar', v: porCobrar.length, tone: 'warning' },
        { k: 'Monto abierto', v: usd(porCobrar.reduce((s, i) => s + i.balance, 0)), tone: 'wine' }],

        recordsTitle: 'Cobros en curso',
        records: porCobrar.slice(0, 4).map((i) => ({
          icon: 'check', title: i.id, sub: i.clientName + ' · vence ' + i.due.slice(5),
          right: usd(i.balance), tone: i.status === 'parcial' ? 'info' : 'warning', chip: i.status, href: ERP('billing')
        })),
        action: { kind: 'link', label: 'Abrir Cobranzas', href: ERP('billing') }
      };
    },

    'con-cobrofin': () => {
      const invs = (D().INVOICES || []).filter((i) => i.status === 'vencida');
      return {
        kpis: [
        { k: 'Vencidas', v: invs.length, tone: 'danger' },
        { k: 'Monto vencido', v: usd(invs.reduce((s, i) => s + i.balance, 0)), tone: 'danger' }],

        recordsTitle: 'Saldos vencidos',
        records: invs.slice(0, 4).map((i) => ({
          icon: 'invoice', title: i.id, sub: i.clientName + ' · venció ' + i.due.slice(5),
          right: usd(i.balance), tone: 'danger', href: ERP('billing')
        })),
        action: { kind: 'link', label: 'Abrir Cobranzas', href: ERP('billing') }
      };
    },

    'con-cxpflete': () => cxp('carrier', 'Naviera · flete', 'ship'),
    'con-cxpad': () => cxp('customs', 'Aduana · impuestos', 'shield'),
    'con-cxplocal': () => cxp('transport', 'Transportes · choferes', 'truck'),

    'con-cierre': () => {
      const je = safe(() => C().JOURNAL_ENTRIES, []) || [];
      return {
        kpis: [
        { k: 'Asientos borrador', v: je.filter((e) => e.status === 'borrador').length, tone: 'warning' },
        { k: 'Contabilizados', v: je.filter((e) => e.status !== 'borrador').length, tone: 'success' }],

        recordsTitle: 'Por conciliar',
        records: je.slice(0, 4).map((e) => ({
          icon: 'chart', title: e.id || e.ref || 'Asiento', sub: e.concept || e.memo || e.desc || 'Movimiento contable',
          right: e.status === 'borrador' ? 'borrador' : 'ok', tone: e.status === 'borrador' ? 'warning' : 'success', href: ERP('accounting')
        })),
        action: { kind: 'link', label: 'Abrir Contabilidad', href: ERP('accounting') }
      };
    },

    // ░░ SERVICIO AL CLIENTE ░░
    'sc-conv': () => {
      const CV = () => window.ConversacionesData;
      const conv = safe(() => CV().CONVERSATIONS, []) || [];
      const open = conv.filter((c) => c.status !== 'resuelto');
      const chName = { whatsapp: 'WhatsApp', email: 'Correo', portal: 'Portal' };
      return {
        kpis: [
        { k: 'Abiertas', v: safe(() => CV().byStatus('abierto').length, 0), tone: 'warning' },
        { k: 'Sin leer', v: safe(() => CV().totalUnread(), 0), tone: 'danger' }],

        recordsTitle: 'Conversaciones recientes',
        records: open.slice(0, 4).map((c) => ({
          icon: c.channel === 'whatsapp' ? 'chat' : c.channel === 'email' ? 'mail' : 'globe',
          title: c.client, sub: (chName[c.channel] || c.channel) + ' · ' + c.type,
          right: c.unread ? c.unread + ' sin leer' : c.lastAt, tone: c.priority === 'alta' ? 'danger' : c.status === 'abierto' ? 'warning' : 'neutral',
          chip: c.status, href: ERP('conversations')
        })),
        action: { kind: 'link', label: 'Abrir Conversaciones', href: ERP('conversations') }
      };
    },

    'sc-reclamo': () => {
      const CV = () => window.ConversacionesData;
      const rec = safe(() => CV().openReclamos(), []) || [];
      const inc = safe(() => CV().CONVERSATIONS.filter((c) => c.type === 'incidencia' && c.status !== 'resuelto'), []) || [];
      const all = [...rec, ...inc];
      return {
        kpis: [
        { k: 'Reclamos', v: rec.length, tone: 'danger' },
        { k: 'Incidencias', v: inc.length, tone: 'warning' }],

        recordsTitle: 'Casos abiertos',
        records: all.slice(0, 4).map((c) => ({
          icon: 'warn', title: c.client, sub: c.type + (c.shipment ? ' · ' + c.shipment : ''),
          right: c.priority, tone: c.priority === 'alta' ? 'danger' : 'warning', chip: c.id, href: ERP('conversations')
        })),
        action: { kind: 'link', label: 'Abrir Reclamos', href: ERP('conversations') }
      };
    },

    'sc-csat': () => {
      const CV = () => window.ConversacionesData;
      const conv = safe(() => CV().CONVERSATIONS, []) || [];
      const resueltos = conv.filter((c) => c.status === 'resuelto');
      return {
        kpis: [
        { k: 'Resueltos', v: resueltos.length, tone: 'success' },
        { k: 'Sin asignar', v: safe(() => CV().unassigned().length, 0), tone: 'warning' }],

        recordsTitle: 'Cierres recientes',
        records: resueltos.slice(0, 4).map((c) => ({
          icon: 'star', title: c.client, sub: c.type + ' · ' + (c.channel || ''),
          right: 'resuelto', tone: 'success', href: ERP('conversations')
        })),
        action: { kind: 'link', label: 'Abrir CX · CSAT', href: ERP('conversations') }
      };
    }
  };

  // Helper CxP por tipo de beneficiario.
  function cxp(type, title, icon) {
    const t = T();
    const open = safe(() => t.openPayables(), []) || [];
    const mine = open.filter((p) => safe(() => t.getPayee(p.payee)?.type, null) === type);
    const due = safe(() => t.dueSoon(7), []) || [];
    const dueMine = due.filter((p) => safe(() => t.getPayee(p.payee)?.type, null) === type);
    return {
      kpis: [
      { k: 'CxP abiertas', v: mine.length, tone: 'wine' },
      { k: 'Vence ≤7d', v: dueMine.length, tone: 'warning' }],

      recordsTitle: title,
      records: mine.slice(0, 4).map((p) => ({
        icon, title: safe(() => t.getPayee(p.payee)?.name, null) || p.payee || 'Beneficiario',
        sub: p.concept || p.ref || 'Pago',
        right: usd(p.amountUsd || p.amount || 0), tone: 'wine', href: ERP('treasury')
      })),
      action: { kind: 'link', label: 'Abrir Tesorería', href: ERP('treasury') }
    };
  }

  window.FlowSummaries = { get: (id) => REG[id] ? safe(() => REG[id](), null) : null };
})();
