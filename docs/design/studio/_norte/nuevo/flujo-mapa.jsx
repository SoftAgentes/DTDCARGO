/* global React */
/* ── DTD · Mapa de proceso global ───────────────────────────── */
/* Swimlanes de extremo a extremo (Comercial · Operatividad ·    */
/* Contabilidad) con conectores intra-carril y LÍNEAS DE ENLACE  */
/* punteadas que atan un departamento con otro (los handoffs).   */
/* Página aparte del ERP. Diseño propio DTD · solo tokens.       */

const { useState, useLayoutEffect, useRef, useEffect, useMemo } = React;

// ── Lectura defensiva de contadores en vivo (datos compartidos del ERP) ──
function _safe(fn) {try {const v = fn();return v == null || Number.isNaN(v) ? null : v;} catch (e) {return null;}}
function _n(v) {return v && v > 0 ? v : null;}
function _ships(...st) {const D = window.ERPData;return D ? D.SHIPMENTS.filter((s) => st.includes(s.status)).length : null;}

// Badge por nodo → número de pendientes (o null si no aplica / no hay dato).
const BADGE = {
  'com-lead': () => _n(_safe(() => window.ERPData.LEADS.filter((l) => !['ganado', 'perdido', 'cerrado'].includes(l.stage)).length)),
  'com-quote': () => _n(_safe(() => window.ERPData.QUOTES.filter((q) => q.status === 'enviada').length)),
  'com-client': () => _n(_safe(() => window.ERPData.CLIENTS.filter((c) => c.status === 'pending').length)),
  'op-recibir': () => _n(_safe(() => _ships('recibido CN'))),
  'op-pedido': () => _n(_safe(() => _ships('confirmado'))),
  'op-consol': () => _n(_safe(() => window.NavieraData.consolidating().length)),
  'op-booking': () => _n(_safe(() => _ships('consolidado'))),
  'op-transito': () => _n(_safe(() => _ships('tránsito', 'zarpado'))),
  'op-aduana': () => _n(_safe(() => _ships('aduana VE'))),
  'op-veware': () => _n(_safe(() => _ships('liberado'))),
  'con-factura': () => _n(_safe(() => _ships('recibido CN'))),
  'con-cobro1': () => _n(_safe(() => window.ERPData.INVOICES.filter((i) => i.status === 'enviada' || i.status === 'pendiente').length)),
  'con-cxpflete': () => _n(_safe(() => window.TesoreriaData.openPayables().length)),
  'con-cxpad': () => _n(_safe(() => window.TesoreriaData.dueSoon(7).length)),
  'con-cxplocal': () => _n(_safe(() => window.TesoreriaData.openPayables().filter((p) => window.TesoreriaData.getPayee(p.payee)?.type === 'transport').length)),
  'con-cobrofin': () => _n(_safe(() => window.ERPData.INVOICES.filter((i) => i.status === 'vencida').length)),
  'con-cierre': () => _n(_safe(() => window.ContabilidadData.JOURNAL_ENTRIES.filter((e) => e.status === 'borrador').length)),
  'sc-conv': () => _n(_safe(() => window.ConversacionesData.byStatus('abierto').length)),
  'sc-reclamo': () => _n(_safe(() => window.ConversacionesData.openReclamos().length)),
  'sc-csat': () => _n(_safe(() => window.ConversacionesData.unassigned().length))
};

// Desglose opcional por nodo (datos en vivo del ERP). Devuelve {title, total, rows:[{label,value}]}.
const DETAIL = {
  // Cotizaciones abiertas agrupadas por servicio (campo `type` del cotizador).
  'com-quote': () => _safe(() => {
    const open = window.ERPData.QUOTES.filter((q) => ['enviada', 'borrador'].includes(q.status));
    const byType = {};
    open.forEach((q) => {byType[q.type] = (byType[q.type] || 0) + 1;});
    const rows = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
    return rows.length ? { title: 'Cotizaciones en gestión por servicio', total: open.length, rows } : null;
  })
};

// ── Geometría determinística ──────────────────────────────────
const SLOT_W = 132; // ancho de cada paso del eje
const LANE_H = 156; // alto de carril (vista global)
const LANE_EXP = 236; // carril en foco (expandido · tarjetas con detalle)
const LANE_COL = 66; // carril compactado (otros carriles al enfocar uno)
const TOP_AXIS = 60; // banda de fases arriba
const NODE_W = 104;
const NODE_H = 82;
const N_SLOTS = 13;
const NLANES = 4; // Comercial · Operatividad · Contabilidad · Servicio
const STAGE_W = N_SLOTS * SLOT_W;
const HALF_W = NODE_W / 2;
const HALF_H = NODE_H / 2;

const slotX = (s) => s * SLOT_W + SLOT_W / 2;
const _IX = Array.from({ length: NLANES }, (_, i) => i);

// ── Layout dinámico de carriles (foco / compacto) ─────────────
// Se recalcula en cada render de App vía setLaneLayout(selIx) y lo
// consumen laneY + los constructores de path. Síncrono y determinístico.
let _LY = _IX.map((i) => TOP_AXIS + i * LANE_H + LANE_H / 2); // centros Y
let _LH = _IX.map(() => HALF_H); // medias-alturas (anclaje vertical de ties)
let _LHW = _IX.map(() => HALF_W); // medias-anchos (anclaje horizontal)
let _SH = TOP_AXIS + NLANES * LANE_H; // alto total del escenario
const laneY = (l) => _LY[l];
function setLaneLayout(selIx) {
  const heights = _IX.map((i) => selIx == null ? LANE_H : i === selIx ? LANE_EXP : LANE_COL);
  let acc = TOP_AXIS;const tops = [];
  heights.forEach((h) => {tops.push(acc);acc += h;});
  _LY = heights.map((h, i) => tops[i] + h / 2);
  _SH = acc;
  _LH = heights.map((h, i) => selIx == null ? HALF_H : i === selIx ? (LANE_EXP - 26) / 2 : 17);
  _LHW = heights.map((h, i) => selIx == null ? HALF_W : i === selIx ? 60 : 17);
  return { heights, tops };
}

// ── Carriles (línea de negocio) ───────────────────────────────
// tone = token del sistema, usado como IDENTIDAD del carril (no estado).
// Precedente: nuevo/modules/flujo-trabajo.jsx ya usa info/wine/success como tonos de carril.
const LANES = [
{ id: 'comercial', label: 'Comercial', sub: 'Captar y cerrar', tone: 'info', icon: 'spark', resp: 'Ventas · CRM' },
{ id: 'operatividad', label: 'Operatividad', sub: 'Mover la carga · CN → VE', tone: 'wine', icon: 'ship', resp: 'Operaciones · Almacenes' },
{ id: 'contabilidad', label: 'Contabilidad', sub: 'Cobrar, pagar, cerrar', tone: 'success', icon: 'invoice', resp: 'Finanzas' },
{ id: 'servicio', label: 'Servicio', sub: 'Atender · resolver · fidelizar', tone: 'warning', icon: 'chat', resp: 'Soporte · CX' }];

const LANE_IX = { comercial: 0, operatividad: 1, contabilidad: 2, servicio: 3 };
const MARK = { info: 'mk-info', wine: 'mk-wine', success: 'mk-success', warning: 'mk-warning' };

// ── Nodos (pasos del proceso) ─────────────────────────────────
const NODES = [
// Comercial
{ id: 'com-lead', lane: 0, slot: 0, icon: 'spark', label: 'Lead · oportunidad', role: 'Comercial', trig: 'Entra un contacto por web, referido o WhatsApp.', next: 'Cotización DDP', mod: 'CRM · Leads' },
{ id: 'com-quote', lane: 0, slot: 1, icon: 'calc', label: 'Cotización DDP', role: 'Comercial', trig: 'El lead pide precio puerta a puerta.', next: 'Cliente · MARKBOX', mod: 'Cotizador' },
{ id: 'com-client', lane: 0, slot: 2, icon: 'users', label: 'Cliente · MARKBOX', role: 'Comercial', trig: 'El cliente acepta la cotización y se le asigna MARKBOX.', next: 'Recepción CN + Factura', mod: 'Clientes' },
{ id: 'com-post', lane: 0, slot: 12, icon: 'spark', label: 'Postventa · fidelización', role: 'Comercial', trig: 'La entrega se completó y el cliente quedó al día.', next: 'Nuevo ciclo · referidos', mod: 'Fidelización' },
// Operatividad
{ id: 'op-pedido', lane: 1, slot: 2, icon: 'clock', label: 'Orden de pedido', role: 'Operaciones · Comercial', trig: 'La cotización se vuelve real: el cliente confirma (o la creamos nosotros al saber que tiene mercadería y armamos el grupo de búsqueda). Acá se le sigue el rastro a lo que está en tránsito y todavía no llegó a China — qué pasó y por qué. Cuando llega, sale de la lista.', next: 'Recepción · China', mod: 'Embarques · órdenes' },
{ id: 'op-recibir', lane: 1, slot: 3, icon: 'warehouse', label: 'Recepción · China', role: 'Almacén CN', trig: 'Llega mercadería del proveedor con el MARKBOX del cliente.', next: 'Etiqueta QR', mod: 'Almacén CN' },
{ id: 'op-qr', lane: 1, slot: 4, icon: 'tag', label: 'Etiqueta QR', role: 'Almacén CN', trig: 'Bulto recibido, pesado y medido (CBM).', next: 'Consolidación', mod: 'Cola de QR' },
{ id: 'op-consol', lane: 1, slot: 5, icon: 'box', label: 'Consolidación', role: 'Operaciones', trig: 'Hay volumen suficiente para llenar contenedor.', next: 'Booking · zarpe', mod: 'Naviera & Consol.' },
{ id: 'op-booking', lane: 1, slot: 6, icon: 'ship', label: 'Booking · zarpe', role: 'Operaciones', trig: 'Contenedor consolidado y listo para embarcar.', next: 'Tránsito marítimo', mod: 'Naviera & Consol.' },
{ id: 'op-transito', lane: 1, slot: 7, icon: 'radar', label: 'Tránsito marítimo', role: 'Operaciones', trig: 'El buque zarpa del puerto de origen.', next: 'Aduana SENIAT', mod: 'Tracking' },
{ id: 'op-aduana', lane: 1, slot: 8, icon: 'shield', label: 'Aduana · SENIAT', role: 'Operaciones', trig: 'El contenedor arriba a puerto venezolano.', next: 'Almacén VE', mod: 'Aduana SENIAT' },
{ id: 'op-veware', lane: 1, slot: 9, icon: 'warehouse', label: 'Almacén · Venezuela', role: 'Almacén VE', trig: 'Carga nacionalizada y liberada de aduana.', next: 'Despacho', mod: 'Almacén VE' },
{ id: 'op-despacho', lane: 1, slot: 10, icon: 'truck', label: 'Despacho · última milla', role: 'Almacén VE', trig: 'El cliente coordina retiro o entrega.', next: 'Entrega · POD', mod: 'Despacho' },
{ id: 'op-entrega', lane: 1, slot: 11, icon: 'radar', label: 'Entrega · POD', role: 'Operaciones', trig: 'El camión llega al destino final.', next: 'Cobro de saldo', mod: 'Tracking' },
// Contabilidad
{ id: 'con-factura', lane: 2, slot: 3, icon: 'invoice', label: 'Factura DDP', role: 'Contabilidad', trig: 'La mercadería se recibe en el almacén de China — lo que llega, se factura.', next: 'Cobro inicial', mod: 'Facturación' },
{ id: 'con-cobro1', lane: 2, slot: 4, icon: 'check', label: 'Cobro inicial', role: 'Contabilidad', trig: 'Factura emitida (anticipo o contado).', next: 'Cierre del ciclo', mod: 'Cobranzas' },
{ id: 'con-cxpflete', lane: 2, slot: 6, icon: 'ship', label: 'CxP naviera · flete', role: 'Contabilidad', trig: 'Se reserva el booking con la naviera.', next: 'CxP aduana', mod: 'Tesorería' },
{ id: 'con-cxpad', lane: 2, slot: 8, icon: 'shield', label: 'CxP aduana · impuestos', role: 'Contabilidad', trig: 'SENIAT liquida aranceles e IVA.', next: 'Flete local · choferes', mod: 'Tesorería' },
{ id: 'con-cxplocal', lane: 2, slot: 10, icon: 'truck', label: 'CxP transportes', role: 'Contabilidad', trig: 'Se despacha la última milla en Venezuela: flete nacional y pago a choferes.', next: 'Conciliación & cierre', mod: 'Tesorería' },
{ id: 'con-cobrofin', lane: 2, slot: 11, icon: 'invoice', label: 'Cobro de saldo', role: 'Contabilidad', trig: 'Se confirma la entrega (POD).', next: 'Conciliación & cierre', mod: 'Cobranzas' },
{ id: 'con-cierre', lane: 2, slot: 12, icon: 'chart', label: 'Conciliación · cierre', role: 'Contabilidad', trig: 'Cobros y pagos del embarque están completos.', next: 'Postventa', mod: 'Contabilidad' },
// Servicio al cliente
{ id: 'sc-conv', lane: 3, slot: 2, icon: 'chat', label: 'Atención · conversaciones', role: 'Soporte · CX', trig: 'El cliente escribe por WhatsApp, correo o el portal (consulta, seguimiento, cotización).', next: 'Reclamos · incidencias', mod: 'Conversaciones' },
{ id: 'sc-reclamo', lane: 3, slot: 8, icon: 'warn', label: 'Reclamos · incidencias', role: 'Soporte · CX', trig: 'Surge un faltante, demora o problema de entrega que hay que resolver.', next: 'Resolución · CSAT', mod: 'Reclamos' },
{ id: 'sc-csat', lane: 3, slot: 12, icon: 'star', label: 'Resolución · CSAT', role: 'Soporte · CX', trig: 'El caso se cierra y se mide la satisfacción del cliente.', next: 'Postventa · fidelización', mod: 'CX · CSAT' }];

const NODE_BY = Object.fromEntries(NODES.map((n) => [n.id, n]));

// Conectores dentro de un mismo carril (flujo del departamento).
const INTRA = [
['com-lead', 'com-quote'], ['com-quote', 'com-client'],
['op-pedido', 'op-recibir'], ['op-recibir', 'op-qr'], ['op-qr', 'op-consol'], ['op-consol', 'op-booking'],
['op-booking', 'op-transito'], ['op-transito', 'op-aduana'], ['op-aduana', 'op-veware'],
['op-veware', 'op-despacho'], ['op-despacho', 'op-entrega'],
['con-factura', 'con-cobro1'], ['con-cxpflete', 'con-cxpad'], ['con-cxpad', 'con-cxplocal'], ['con-cobrofin', 'con-cierre'],
['sc-conv', 'sc-reclamo'], ['sc-reclamo', 'sc-csat']];


// Líneas de enlace entre departamentos (los handoffs · "lo que ata todo").
const TIES = [
{ from: 'com-client', to: 'op-pedido', dir: 'down', label: 'Genera orden de pedido' },
{ from: 'op-recibir', to: 'con-factura', dir: 'down', label: 'Lo que llega se factura' },
{ from: 'op-booking', to: 'con-cxpflete', dir: 'down', label: 'Flete · CxP' },
{ from: 'op-aduana', to: 'con-cxpad', dir: 'down', label: 'Impuestos · CxP' },
{ from: 'op-despacho', to: 'con-cxplocal', dir: 'down', label: 'Flete · choferes' },
{ from: 'op-entrega', to: 'con-cobrofin', dir: 'down', label: 'POD → cobro saldo' },
{ from: 'con-cierre', to: 'com-post', dir: 'up', label: 'Cliente al día → fidelización' },
{ from: 'com-client', to: 'sc-conv', dir: 'down', label: 'Alta → canal de atención', bow: -86, labelDY: 30 },
{ from: 'op-aduana', to: 'sc-reclamo', dir: 'down', label: 'Incidencia → reclamo', bow: -78, labelDY: 40 },
{ from: 'sc-csat', to: 'com-post', dir: 'up', label: 'CSAT → fidelización', bow: 92, labelDY: 0 }];


// ── Constructores de path ─────────────────────────────────────
function hPath(a, b) {
  const ax = slotX(a.slot) + _LHW[a.lane],ay = laneY(a.lane);
  const bx = slotX(b.slot) - _LHW[b.lane],by = laneY(b.lane);
  const mx = (ax + bx) / 2;
  return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
}
function vPath(a, b, dir, bow = 0) {
  const ax = slotX(a.slot),bx = slotX(b.slot);
  if (dir === 'up') {
    const ay = laneY(a.lane) - _LH[a.lane],by = laneY(b.lane) + _LH[b.lane];
    const my = (ay + by) / 2;
    return `M${ax},${ay} C${ax + bow},${my} ${bx + bow},${my} ${bx},${by}`;
  }
  const ay = laneY(a.lane) + _LH[a.lane],by = laneY(b.lane) - _LH[b.lane];
  const my = (ay + by) / 2;
  return `M${ax},${ay} C${ax + bow},${my} ${bx + bow},${my} ${bx},${by}`;
}

// ── Bandas de fase (eje superior) ─────────────────────────────
const BANDS = [
{ from: 0, to: 0, label: 'Captación' },
{ from: 1, to: 1, label: 'Cierre comercial' },
{ from: 2, to: 2, label: 'Orden de pedido' },
{ from: 3, to: 4, label: 'Origen · China' },
{ from: 5, to: 6, label: 'Consolidación & zarpe' },
{ from: 7, to: 7, label: 'Tránsito' },
{ from: 8, to: 8, label: 'Aduana · Venezuela' },
{ from: 9, to: 10, label: 'Entrega · Venezuela' },
{ from: 11, to: 11, label: 'Entrega final' },
{ from: 12, to: 12, label: 'Cobranza & cierre' }];


// ── Meta en vivo para la tarjeta expandida (modo foco) ────────
// Filas cortas {k,v}. Si un nodo no la define, la tarjeta muestra su `trig`.
const META = {
  'com-lead': () => _safe(() => [{ k: 'En pipeline', v: window.ERPData.LEADS.filter((l) => !['ganado', 'perdido', 'cerrado'].includes(l.stage)).length }, { k: 'Fuente', v: 'Web · referidos' }]),
  'com-quote': () => _safe(() => {
    const open = window.ERPData.QUOTES.filter((q) => ['enviada', 'borrador'].includes(q.status));
    const byType = {};open.forEach((q) => {byType[q.type] = (byType[q.type] || 0) + 1;});
    return Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => ({ k, v }));
  }),
  'com-client': () => _safe(() => [{ k: 'Alta', v: 'Auto · portal' }, { k: 'Activos', v: window.ERPData.CLIENTS.filter((c) => c.status === 'active').length }, { k: 'Por activar', v: window.ERPData.CLIENTS.filter((c) => c.status === 'pending').length }]),
  'con-factura': () => _safe(() => [{ k: 'Por facturar', v: _ships('recibido CN') }, { k: 'Emitidas', v: window.ERPData.INVOICES.length }]),
  'con-cobro1': () => _safe(() => [{ k: 'Por cobrar', v: window.ERPData.INVOICES.filter((i) => i.status === 'enviada' || i.status === 'pendiente').length }, { k: 'Pagadas', v: window.ERPData.INVOICES.filter((i) => i.status === 'pagada').length }]),
  'con-cxpflete': () => _safe(() => [{ k: 'CxP naviera', v: window.TesoreriaData.openPayables().filter((p) => window.TesoreriaData.getPayee(p.payee)?.type === 'carrier').length }, { k: 'Abiertas', v: window.TesoreriaData.openPayables().length }]),
  'con-cxpad': () => _safe(() => [{ k: 'Aduana', v: window.TesoreriaData.openPayables().filter((p) => window.TesoreriaData.getPayee(p.payee)?.type === 'customs').length }, { k: 'Vence ≤7d', v: window.TesoreriaData.dueSoon(7).length }]),
  'con-cxplocal': () => _safe(() => [{ k: 'Transporte · choferes', v: window.TesoreriaData.openPayables().filter((p) => window.TesoreriaData.getPayee(p.payee)?.type === 'transport').length }]),
  'con-cobrofin': () => _safe(() => [{ k: 'Vencidas', v: window.ERPData.INVOICES.filter((i) => i.status === 'vencida').length }]),
  'con-cierre': () => _safe(() => [{ k: 'Asientos borrador', v: window.ContabilidadData.JOURNAL_ENTRIES.filter((e) => e.status === 'borrador').length }])
};

// ── Nodo ──────────────────────────────────────────────────────
function FlowNode({ node, tone, mode, laneH, selected, hot, badge, onClick, onHover }) {
  const I = window.Icon;
  const cx = slotX(node.slot),cy = laneY(node.lane);
  const accent = `var(--${tone})`;
  const fill = selected || hot;
  const hasPending = badge != null && badge > 0;
  const ring = hasPending ? accent : 'var(--border-strong)';
  const ic = hasPending ? accent : 'var(--ink-soft)';
  const trans = 'all var(--dur) var(--ease)';

  // ── Tarjeta expandida (carril en foco) ──
  if (mode === 'focused') {
    const W = 120,H = laneH - 26;
    const rows = (META[node.id] ? META[node.id]() : null) || [];
    return (
      <button onClick={() => onClick(node)} onMouseEnter={() => onHover(node.id)} onMouseLeave={() => onHover(null)}
      style={{
        position: 'absolute', left: cx - W / 2, top: cy - H / 2, width: W, height: H,
        display: 'flex', flexDirection: 'column', gap: 6, padding: 10, textAlign: 'left',
        background: 'var(--bg-surface)', border: `1.5px solid ${selected || hot ? accent : 'var(--border)'}`,
        borderRadius: 'var(--r-lg)', boxShadow: selected ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        cursor: 'pointer', transition: trans, zIndex: 3, overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: hasPending ? accent : 'var(--bg-elevated)', color: hasPending ? '#fff' : ic }}>{I[node.icon] ? I[node.icon](16) : I.box(16)}</span>
          {hasPending &&
          <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '700 10px/18px var(--f-sans)', textAlign: 'center' }}>{badge}</span>}
        </div>
        <div style={{ font: '700 11.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{node.label}</div>
        {rows.length > 0 ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 1 }}>
            {rows.map((r) =>
          <div key={r.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ font: '500 9.5px/1.25 var(--f-sans)', color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.k}</span>
                <span style={{ font: '700 10px/1.3 var(--f-mono)', color: 'var(--ink)', flexShrink: 0 }}>{r.v}</span>
              </div>
          )}
          </div> :

        <div style={{ font: '500 9.5px/1.35 var(--f-sans)', color: 'var(--ink-mute)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{node.trig}</div>
        }
        <span style={{ marginTop: 'auto', font: '700 9px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: accent, display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver detalle {I.arrowR(11)}</span>
      </button>);

  }

  // ── Nodo compactado (otros carriles al enfocar uno) ──
  if (mode === 'collapsed') {
    return (
      <button onClick={() => onClick(node)} onMouseEnter={() => onHover(node.id)} onMouseLeave={() => onHover(null)} title={node.label}
      style={{ position: 'absolute', left: cx - 17, top: cy - 17, width: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', cursor: 'pointer', transition: trans, zIndex: 3 }}>
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: fill ? accent : 'var(--bg-surface)', border: `2px solid ${fill ? accent : ring}`, color: fill ? '#fff' : ic }}>{I[node.icon] ? I[node.icon](15) : I.box(15)}</span>
          {hasPending &&
          <span style={{ position: 'absolute', top: -4, right: -5, minWidth: 14, height: 14, padding: '0 3px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '700 8.5px/14px var(--f-sans)', textAlign: 'center', border: '1.5px solid var(--bg-surface)' }}>{badge}</span>}
        </span>
      </button>);

  }

  // ── Nodo por defecto (vista global) ──
  return (
    <button
      onClick={() => onClick(node)}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: 'absolute', left: cx - HALF_W, top: cy - HALF_H, width: NODE_W, height: NODE_H,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
        background: 'transparent', padding: 0, cursor: 'pointer', transition: trans,
        zIndex: 3
      }}>
      
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <span style={{
          width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: fill ? accent : 'var(--bg-surface)',
          border: `2px solid ${fill ? accent : ring}`,
          color: fill ? '#fff' : ic,
          boxShadow: selected ? `0 0 0 4px var(--${tone}-bg)` : 'var(--shadow-xs)',
          transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)'
        }}>{I[node.icon] ? I[node.icon](21) : I.box(21)}</span>
        {hasPending &&
        <span style={{
          position: 'absolute', top: -5, right: -6, minWidth: 18, height: 18, padding: '0 5px',
          borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff',
          font: '700 10.5px/18px var(--f-sans)', textAlign: 'center', border: '2px solid var(--bg-surface)'
        }}>{badge}</span>
        }
      </span>
      <span style={{
        font: '600 11px/1.2 var(--f-sans)', color: 'var(--ink)', textAlign: 'center',
        textWrap: 'balance', maxWidth: NODE_W
      }}>{node.label}</span>
    </button>);

}

// ── App ───────────────────────────────────────────────────────
function ProcessMapApp() {
  const I = window.Icon;
  const [theme, setTheme] = useState(() => localStorage.getItem('dtd-mapa-theme') || 'light');
  const [filter, setFilter] = useState('global'); // global | comercial | operatividad | contabilidad
  const [sel, setSel] = useState(null); // nodo seleccionado
  const [hover, setHover] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [autoMode, setAutoMode] = useState(false); // modo Automatizaciones
  const [selRule, setSelRule] = useState(null); // regla resaltada
  const RULES = window.FlowRules;
  const RULES_LS = 'dtd-mapa-rules-v1';
  const [rules, setRules] = useState(() => {
    const base = (RULES?.LIST || []).slice();
    try {
      const saved = JSON.parse(localStorage.getItem(RULES_LS) || 'null');
      if (saved?.rules?.length) {
        const ids = new Set(saved.rules.map((r) => r.id));
        const merged = saved.rules.slice();
        base.forEach((r) => {if (!ids.has(r.id)) merged.push(r);});
        return merged;
      }
    } catch (e) {/* noop */}
    return base;
  });
  const [ruleOn, setRuleOn] = useState(() => {
    const m = {};(RULES?.LIST || []).forEach((r) => m[r.id] = r.auto);
    try {
      const saved = JSON.parse(localStorage.getItem(RULES_LS) || 'null');
      if (saved?.rules) saved.rules.forEach((r) => {if (!(r.id in m)) m[r.id] = r.auto ?? true;});
      if (saved?.ruleOn) Object.assign(m, saved.ruleOn);
    } catch (e) {/* noop */}
    return m;
  });
  useEffect(() => {
    try {localStorage.setItem(RULES_LS, JSON.stringify({ v: 1, rules, ruleOn }));} catch (e) {/* noop */}
  }, [rules, ruleOn]);
  const resetRules = () => {
    try {localStorage.removeItem(RULES_LS);} catch (e) {/* noop */}
    const base = (RULES?.LIST || []).slice();
    setRules(base);
    const m = {};base.forEach((r) => m[r.id] = r.auto);setRuleOn(m);
    setSelRule(null);
  };
  const ruleForTie = (t) => rules.find((r) => r.from === t.from && r.to === t.to) || null;

  // Registro de ejecuciones (en vivo). Arranca del seed de window.FlowRules.
  const [log, setLog] = useState(() => (window.FlowRules?.LOG || []).slice());
  const ARTIFACT = { // prefijo de documento según el nodo destino de la regla
    'con-factura': () => 'F-2026-' + (440 + Math.floor(Math.random() * 59)),
    'con-cobro1': () => 'COB-2026-' + (190 + Math.floor(Math.random() * 9)),
    'con-cobrofin': () => 'COB-2026-' + (190 + Math.floor(Math.random() * 9)),
    'con-cxpflete': () => 'CXP-2026-' + (192 + Math.floor(Math.random() * 9)),
    'con-cxpad': () => 'CXP-2026-' + (192 + Math.floor(Math.random() * 9)),
    'con-cxplocal': () => 'CXP-2026-' + (192 + Math.floor(Math.random() * 9)),
    'op-pedido': () => 'OP-2026-' + (314 + Math.floor(Math.random() * 9)),
    'com-quote': () => 'Q-2026-' + (423 + Math.floor(Math.random() * 9)),
    'com-post': () => 'POST-2026-' + (40 + Math.floor(Math.random() * 9))
  };
  const runRule = (rule) => {
    const toN = NODE_BY[rule.to];
    const mk = ARTIFACT[rule.to];
    const artifact = mk ? mk() : (toN?.label || 'documento');
    setLog((prev) => [{ id: rule.id, at: 'recién', summary: rule.action, artifact, module: toN?.mod || rule.category, fresh: true }, ...prev]);
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, runs: (r.runs || 0) + 1 } : r));
  };
  // Metadatos de curvatura/dirección de las líneas predefinidas (para reusar en reglas).
  const tieMeta = useMemo(() => {const m = {};TIES.forEach((t) => m[t.from + '>' + t.to] = t);return m;}, []);
  const scrollRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dtd-mapa-theme', theme);
  }, [theme]);

  const selLaneIx = autoMode ? null : filter === 'global' ? null : LANE_IX[filter];
  const { heights, tops } = setLaneLayout(selLaneIx);
  const tieActive = (t) => selLaneIx == null ||
  NODE_BY[t.from].lane === selLaneIx || NODE_BY[t.to].lane === selLaneIx;
  const intraActive = (a) => selLaneIx == null || NODE_BY[a].lane === selLaneIx;

  // Badges en vivo (datos compartidos del ERP) + totales por carril.
  const badges = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, BADGE[n.id] ? BADGE[n.id]() : null])), []);
  const laneTotals = useMemo(() => LANES.map((_, i) =>
  NODES.filter((n) => n.lane === i).reduce((s, n) => s + (badges[n.id] || 0), 0)), [badges]);

  // nodos resaltados al pasar el mouse por un nodo (sus conectores)
  const isHotConn = (aId, bId) => hover && (hover === aId || hover === bId);

  // Geometría de la línea de una regla (reusa curvatura de la línea predefinida si existe).
  const rulePath = (r) => {
    const a = NODE_BY[r.from], b = NODE_BY[r.to];
    if (!a || !b) return null;
    const meta = tieMeta[r.from + '>' + r.to];
    if (a.lane === b.lane) {
      const lo = a.slot <= b.slot ? a : b, hi = a.slot <= b.slot ? b : a;
      return { d: hPath(lo, hi), mx: (slotX(a.slot) + slotX(b.slot)) / 2, my: laneY(a.lane) - HALF_H - 15, horiz: true };
    }
    const dir = meta?.dir || (b.lane > a.lane ? 'down' : 'up');
    const bow = meta?.bow || 0;
    return { d: vPath(a, b, dir, bow), mx: (slotX(a.slot) + slotX(b.slot)) / 2 + bow, my: (laneY(a.lane) + laneY(b.lane)) / 2 + (meta?.labelDY || 0) };
  };

  const onScroll = (e) => {if (!scrolled && e.target.scrollLeft > 8) setScrolled(true);};

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap',
        padding: '22px var(--s-8) 18px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)'
      }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>MAPA DE PROCESO · DTD-CARGO</div>
          <h1 style={{ margin: 0, font: '800 26px/1.05 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Flujo de trabajo, de extremo a extremo
          </h1>
          <p style={{ margin: '8px 0 0', font: '500 13.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', maxWidth: 640 }}>
            Las tres líneas de negocio y, en punteado, las líneas de enlace que las atan: dónde un
            departamento le pasa el trabajo al siguiente. Con confianza, de China a tu puerta.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => {setAutoMode((v) => !v);setSel(null);setSelRule(null);}} title="Reglas de automatización" style={{
            height: 38, padding: '0 14px', borderRadius: 'var(--r-md)',
            border: `1px solid ${autoMode ? 'var(--wine)' : 'var(--border)'}`,
            display: 'inline-flex', alignItems: 'center', gap: 8, font: '700 12.5px/1 var(--f-sans)',
            color: autoMode ? '#fff' : 'var(--ink)', background: autoMode ? 'var(--wine)' : 'var(--bg-surface)',
            transition: 'all var(--dur-fast) var(--ease)'
          }}>{I.spark(15)} Automatizaciones{RULES && <span style={{ padding: '1px 7px', borderRadius: 'var(--r-pill)', background: autoMode ? 'rgba(255,255,255,0.22)' : 'var(--wine-bg)', color: autoMode ? '#fff' : 'var(--wine)', font: '700 10px/1.5 var(--f-mono)' }}>{Object.values(ruleOn).filter(Boolean).length}</span>}</button>
          <button onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')} title="Cambiar tema" style={{
            width: 38, height: 38, borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)', background: 'var(--bg-surface)'
          }}>{theme === 'dark' ? I.sun(16) : I.moon(16)}</button>
          <a href="Guía del Mapa de Proceso.html" title="Guía de referencia" style={{
            height: 38, padding: '0 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
            display: 'inline-flex', alignItems: 'center', gap: 8, font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)', background: 'var(--bg-surface)'
          }}>{I.info(14)} Guía</a>
          <a href="DTD Studio · ERP.html" style={{
            height: 38, padding: '0 15px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
            display: 'inline-flex', alignItems: 'center', gap: 8, font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)', background: 'var(--bg-surface)'
          }}>{I.arrowL(14)} Volver al ERP</a>
        </div>
      </header>

      {/* ── Toolbar: filtros por línea de negocio ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '14px var(--s-8)', borderBottom: '1px solid var(--border)', background: 'var(--bg-base)'
      }}>
        <span style={{ font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Ver</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
          { id: 'global', label: 'Flujo global', tone: null },
          { id: 'comercial', label: 'Comercial', tone: 'info' },
          { id: 'operatividad', label: 'Operatividad', tone: 'wine' },
          { id: 'contabilidad', label: 'Contabilidad', tone: 'success' },
          { id: 'servicio', label: 'Servicio', tone: 'warning' }].
          map((c) => {
            const on = filter === c.id;
            const ac = c.tone ? `var(--${c.tone})` : 'var(--ink)';
            return (
              <button key={c.id} onClick={() => {setFilter(c.id);setSel(null);}} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                height: 34, padding: '0 14px', borderRadius: 'var(--r-pill)',
                border: `1px solid ${on ? ac : 'var(--border)'}`,
                background: on ? c.tone ? `var(--${c.tone}-bg)` : 'var(--bg-elevated)' : 'var(--bg-surface)',
                color: on ? ac : 'var(--ink-soft)',
                font: `${on ? '700' : '600'} 12.5px/1 var(--f-sans)`,
                transition: 'all var(--dur-fast) var(--ease)'
              }}>
                {c.tone && <span style={{ width: 9, height: 9, borderRadius: '50%', background: ac, flexShrink: 0 }} />}
                {c.label}
              </button>);

          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Legend />
        </div>
      </div>

      {/* ── Canvas: rail de carriles + escenario scrolleable ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* Rail de etiquetas de carril (fijo) */}
        <div style={{ width: 196, flexShrink: 0, paddingTop: TOP_AXIS, background: 'var(--bg-base)', borderRight: '1px solid var(--border)', position: 'relative', zIndex: 5 }}>
          {LANES.map((ln, i) => {
            const ac = `var(--${ln.tone})`;
            const focused = selLaneIx === i;
            const compact = selLaneIx != null && !focused;
            return (
              <button key={ln.id} onClick={() => {setFilter((f) => f === ln.id ? 'global' : ln.id);setSel(null);}}
              style={{
                width: '100%', height: heights[i], padding: compact ? '0 12px' : '0 16px',
                display: 'flex', flexDirection: compact ? 'row' : 'column', alignItems: compact ? 'center' : 'flex-start',
                justifyContent: 'center', gap: compact ? 10 : 8, textAlign: 'left',
                borderBottom: i < NLANES - 1 ? '1px solid var(--border)' : 'none',
                borderLeft: `3px solid ${focused ? ac : 'transparent'}`,
                background: focused ? `var(--${ln.tone}-bg)` : 'transparent',
                transition: 'all var(--dur) var(--ease)', cursor: 'pointer', overflow: 'hidden'
              }}>
                <span style={{ width: compact ? 26 : 34, height: compact ? 26 : 34, borderRadius: 'var(--r-md)', background: `var(--${ln.tone}-bg)`, color: ac, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I[ln.icon]?.(compact ? 15 : 18)}</span>
                {compact ?
                <>
                  <span style={{ font: '800 12.5px/1.1 var(--f-display)', color: 'var(--ink)' }}>{ln.label}</span>
                  {laneTotals[i] > 0 &&
                  <span style={{ marginLeft: 'auto', padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 9.5px/1.5 var(--f-sans)' }}>{laneTotals[i]}</span>}
                </> :

                <>
                  <div>
                    <div style={{ font: '800 14px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{ln.label}</div>
                    <div style={{ font: '500 10.5px/1.25 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{ln.sub}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ font: '600 10px/1 var(--f-sans)', color: ac, letterSpacing: '0.04em' }}>{ln.resp}</span>
                    {laneTotals[i] > 0 &&
                    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 10px/1.5 var(--f-sans)' }}>{laneTotals[i]} pend.</span>}
                  </div>
                </>
                }
              </button>);

          })}
        </div>

        {/* Escenario */}
        <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}>
          <div style={{ position: 'relative', width: STAGE_W, height: _SH, margin: '0 auto', transition: 'height var(--dur) var(--ease)' }}>
            {/* Bandas de fase */}
            {BANDS.map((b, i) =>
            <div key={i} style={{
              position: 'absolute', top: 0, left: b.from * SLOT_W, width: (b.to - b.from + 1) * SLOT_W, height: TOP_AXIS,
              borderLeft: i ? '1px dashed var(--border)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <span style={{ font: '700 9.5px/1.2 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', textAlign: 'center', padding: '0 6px' }}>{b.label}</span>
              </div>
            )}
            {/* Franjas de carril (fondo) */}
            {LANES.map((ln, i) =>
            <div key={ln.id} style={{
              position: 'absolute', left: 0, top: tops[i], width: STAGE_W, height: heights[i],
              background: selLaneIx === i ? `var(--${ln.tone}-bg)` : i % 2 ? 'transparent' : 'var(--bg-surface)',
              borderTop: '1px solid var(--border)', transition: 'all var(--dur) var(--ease)'
            }} />
            )}

            {/* SVG conectores */}
            <svg width={STAGE_W} height={_SH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, overflow: 'visible' }}>
              <defs>
                {['info', 'wine', 'success', 'warning'].map((t) =>
                <marker key={t} id={MARK[t]} markerWidth="9" markerHeight="9" refX="6.5" refY="4.5" orient="auto">
                    <path d="M1 1 L8 4.5 L1 8 Z" style={{ fill: `var(--${t})` }} />
                  </marker>
                )}
                <marker id="mk-tie" markerWidth="9" markerHeight="9" refX="6.5" refY="4.5" orient="auto">
                  <path d="M1 1 L8 4.5 L1 8 Z" style={{ fill: 'var(--wine)' }} />
                </marker>
              </defs>

              {/* Intra-carril */}
              {INTRA.map(([aId, bId], i) => {
                const a = NODE_BY[aId],b = NODE_BY[bId];
                const tone = LANES[a.lane].tone;
                const act = intraActive(aId);
                const hot = isHotConn(aId, bId);
                return (
                  <path key={'in' + i} d={hPath(a, b)} fill="none"
                  stroke={`var(--${tone})`} strokeWidth={hot ? 3.4 : 2.4}
                  markerEnd={`url(#${MARK[tone]})`}
                  style={{ opacity: act ? hover && !hot ? 0.4 : 1 : 0.18, transition: 'opacity var(--dur) var(--ease), stroke-width var(--dur-fast) var(--ease)' }} />);

              })}

              {/* Líneas de enlace (handoffs) · vista normal */}
              {!autoMode && TIES.map((t, i) => {
                const a = NODE_BY[t.from],b = NODE_BY[t.to];
                const act = tieActive(t);
                const hot = isHotConn(t.from, t.to);
                return (
                  <path key={'tie' + i} d={vPath(a, b, t.dir, t.bow || 0)} fill="none"
                  stroke="var(--wine)" strokeWidth={hot ? 2.6 : 1.8} strokeDasharray="2 5" strokeLinecap="round"
                  markerEnd="url(#mk-tie)"
                  style={{ opacity: act ? hover && !hot ? 0.35 : 0.92 : 0.12, transition: 'opacity var(--dur) var(--ease), stroke-width var(--dur-fast) var(--ease)' }} />);

              })}

              {/* Líneas de regla · modo automatización */}
              {autoMode && rules.map((r) => {
                const p = rulePath(r);if (!p) return null;
                const en = ruleOn[r.id];
                const ruleSel = selRule === r.id;
                return (
                  <path key={'rl' + r.id} d={p.d} fill="none"
                  stroke={en ? 'var(--wine)' : 'var(--border-strong)'} strokeWidth={ruleSel ? 3 : 1.8}
                  strokeDasharray="2 5" strokeLinecap="round" markerEnd="url(#mk-tie)"
                  className={en ? 'tie-flow' : ''}
                  style={{ opacity: en ? 1 : 0.45, transition: 'opacity var(--dur) var(--ease), stroke-width var(--dur-fast) var(--ease), stroke var(--dur) var(--ease)' }} />);

              })}
            </svg>

            {/* Etiquetas de enlace · vista normal */}
            {!autoMode && TIES.map((t, i) => {
              const a = NODE_BY[t.from],b = NODE_BY[t.to];
              const mx = (slotX(a.slot) + slotX(b.slot)) / 2 + (t.bow || 0);
              const my = (laneY(a.lane) + laneY(b.lane)) / 2 + (t.labelDY || 0);
              const act = tieActive(t);
              return (
                <span key={'tl' + i} style={{
                  position: 'absolute', left: mx, top: my, transform: 'translate(-50%,-50%)', zIndex: 4,
                  padding: '3px 9px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap',
                  background: 'var(--wine)', color: '#fff', font: '700 9.5px/1.3 var(--f-sans)',
                  boxShadow: 'var(--shadow-sm)', pointerEvents: 'none',
                  opacity: act ? 1 : 0.18, transition: 'opacity var(--dur) var(--ease)'
                }}>{t.label}</span>);

            })}

            {/* Chips de regla · modo automatización */}
            {autoMode && rules.map((r) => {
              const p = rulePath(r);if (!p) return null;
              const en = ruleOn[r.id];
              const ruleSel = selRule === r.id;
              return (
                <button key={'rc' + r.id} onClick={() => {setSelRule(r.id);setSel(null);}} style={{
                  position: 'absolute', left: p.mx, top: p.my, transform: 'translate(-50%,-50%)', zIndex: 5,
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 'var(--r-pill)', whiteSpace: 'nowrap',
                  background: en ? 'var(--wine)' : 'var(--bg-elevated)', color: en ? '#fff' : 'var(--ink-soft)',
                  border: `1.5px solid ${ruleSel ? 'var(--ink)' : en ? 'var(--wine)' : 'var(--border-strong)'}`,
                  font: '700 9.5px/1.3 var(--f-mono)', boxShadow: ruleSel ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                  cursor: 'pointer', transition: 'all var(--dur-fast) var(--ease)'
                }}>{I.spark(11)} {r.id}{!en && <span style={{ font: '700 8px/1 var(--f-sans)', opacity: 0.8 }}>· off</span>}</button>);

            })}

            {/* Nodos */}
            {NODES.map((n) => {
              const mode = selLaneIx == null ? 'default' : n.lane === selLaneIx ? 'focused' : 'collapsed';
              return (
              <FlowNode key={n.id} node={n} tone={LANES[n.lane].tone} mode={mode} laneH={heights[n.lane]}
              selected={sel?.id === n.id} hot={hover === n.id} badge={badges[n.id]}
              onClick={(nd) => {if (autoMode) {const r = RULES?.forNode(nd.id)[0];setSelRule(r ? r.id : null);} else setSel(nd);}}
              onHover={setHover} />);

            })}
          </div>

          {!scrolled &&
          <div style={{
            position: 'absolute', right: 16, bottom: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--r-pill)', background: 'var(--bg-sidebar)', color: '#fff',
            font: '600 11px/1 var(--f-sans)', boxShadow: 'var(--shadow-md)', pointerEvents: 'none'
          }}>Desplazá para ver todo {I.arrowR(13)}</div>
          }
        </div>

        {/* Panel de detalle / reglas */}
        {autoMode ?
        <RulesPanel rules={rules} ruleOn={ruleOn} selRule={selRule}
          onToggle={(id) => setRuleOn((m) => ({ ...m, [id]: !m[id] }))}
          onSelect={setSelRule}
          onSave={(rule) => {
            setRules((prev) => {
              const ix = prev.findIndex((r) => r.id === rule.id);
              if (ix >= 0) {const cp = prev.slice();cp[ix] = rule;return cp;}
              return [...prev, rule];
            });
            setRuleOn((m) => rule.id in m ? m : { ...m, [rule.id]: true });
            setSelRule(rule.id);
          }}
          onDelete={(id) => {
            setRules((prev) => prev.filter((r) => r.id !== id));
            setSelRule(null);
          }}
          onReset={resetRules}
          log={log} onRun={runRule}
          onClose={() => {setAutoMode(false);setSelRule(null);}} /> :
        sel && <DetailPanel node={sel} onClose={() => setSel(null)} />
        }
      </div>
    </div>);

}

// ── Leyenda ───────────────────────────────────────────────────
function Legend() {
  const item = (color, dash, label) =>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
      <svg width="26" height="8" style={{ overflow: 'visible' }}>
        <line x1="1" y1="4" x2="25" y2="4" stroke={color} strokeWidth="2.4" strokeDasharray={dash ? '2 4' : 'none'} strokeLinecap="round" />
      </svg>
      {label}
    </span>;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      {item('var(--ink-soft)', false, 'Flujo del departamento')}
      {item('var(--wine)', true, 'Enlace entre departamentos')}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
        <span style={{ minWidth: 16, height: 16, padding: '0 4px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '700 9.5px/16px var(--f-sans)', textAlign: 'center' }}>N</span>
        Pendientes en vivo
      </span>
    </div>);

}

// ── Canales de envío al cliente ───────────────────────────────
const CHANNELS = [
{ id: 'app', label: 'App móvil', icon: 'bell' },
{ id: 'portal', label: 'Portal', icon: 'globe' },
{ id: 'correo', label: 'Correo', icon: 'mail' },
{ id: 'whatsapp', label: 'WhatsApp', icon: 'chat' }];


// ── Condiciones de regla ──────────────────────────────────────
const COND_FIELDS = [
{ id: 'monto', label: 'Monto', type: 'number', ops: ['>', '≥', '<', '≤'], unit: '$' },
{ id: 'tier', label: 'Tier del cliente', type: 'enum', ops: ['=', '≠'], options: ['Bronze', 'Silver', 'Gold', 'Platinum'] },
{ id: 'servicio', label: 'Tipo de servicio', type: 'enum', ops: ['=', '≠'], options: ['LCL DDP', "FCL 20'", "FCL 40'", "FCL 40'HC"] },
{ id: 'destino', label: 'Destino', type: 'enum', ops: ['=', '≠'], options: ['PBL · Pto Cabello', 'MAR · Maracaibo', 'LGU · La Guaira', 'PFI · Punto Fijo'] }];

const COND_BY = Object.fromEntries(COND_FIELDS.map((f) => [f.id, f]));
const fmtCond = (c) => {
  const f = COND_BY[c.field];if (!f) return '';
  const v = f.unit === '$' ? '$' + Number(c.value).toLocaleString('en-US') : c.value;
  return `${f.label} ${c.op} ${v}`;
};

// ── Panel de detalle (resumen por nodo + acciones) ────────────
function DetailPanel({ node, onClose }) {
  const I = window.Icon;
  const lane = LANES[node.lane];
  const ac = `var(--${lane.tone})`;
  const sum = window.FlowSummaries ? window.FlowSummaries.get(node.id) : null;
  const [modal, setModal] = useState(null); // {items} para enviar
  const [toast, setToast] = useState(null);

  const doSend = (channel) => {
    const ch = CHANNELS.find((c) => c.id === channel);
    const n = modal?.items?.length || 1;
    setModal(null);
    setToast(`${n} factura${n > 1 ? 's' : ''} enviada${n > 1 ? 's' : ''} por ${ch.label}`);
    setTimeout(() => setToast(null), 3200);
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 356, zIndex: 20,
      background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
      display: 'flex', flexDirection: 'column', animation: 'erp-slide-in 220ms var(--ease) both'
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: `var(--${lane.tone}-bg)`, color: ac, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I[node.icon]?.(20)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: ac }}>{lane.label}</div>
          <div style={{ font: '800 17px/1.15 var(--f-display)', color: 'var(--ink)', marginTop: 5, letterSpacing: '-0.01em' }}>{node.label}</div>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', color: 'var(--ink-mute)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.close(16)}</button>
      </div>

      {/* Cuerpo */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* KPIs (2 indicadores) */}
        {sum?.kpis &&
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {sum.kpis.map((k, i) =>
          <div key={i} style={{ padding: '11px 13px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div style={{ font: '800 20px/1 var(--f-display)', color: `var(--${k.tone || 'ink'})` }}>{k.v}</div>
                <div style={{ font: '600 10px/1.2 var(--f-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginTop: 5 }}>{k.k}</div>
              </div>
          )}
          </div>
        }

        {/* Desglose por servicio (cotizaciones) */}
        {sum?.groups && sum.groups.length > 0 &&
        <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>{sum.groupTitle}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {sum.groups.map((g) =>
            <span key={g.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 'var(--r-pill)', background: `var(--${lane.tone}-bg)`, color: ac, font: '700 11px/1 var(--f-sans)' }}>{g.label}<span style={{ font: '700 11px/1 var(--f-mono)' }}>{g.value}</span></span>
            )}
            </div>
          </div>
        }

        {/* Registros (3-4 clickeables) */}
        {sum?.records && sum.records.length > 0 &&
        <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>{sum.recordsTitle || 'Registros'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sum.records.map((r, i) =>
            <RecordRow key={i} r={r} laneTone={lane.tone}
            onSend={r.sendable ? () => setModal({ items: [r.payload] }) : null} />
            )}
            </div>
          </div>
        }

        {/* Sin resumen aún → contexto del nodo */}
        {!sum &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Responsable" value={node.role} />
            <Field label="Se activa cuando" value={node.trig} />
            <Field label="Entrega a" value={node.next} accent={ac} />
          </div>
        }

        {/* Acción del nodo */}
        {sum?.action &&
        <div style={{ marginTop: 2 }}>
            {sum.action.kind === 'send' ?
          <button onClick={() => setModal({ items: sum.action.items })} style={{
            width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 14px',
            borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', font: '700 13px/1 var(--f-sans)', boxShadow: 'var(--shadow-sm)'
          }}>{I.mail(15)} {sum.action.label}</button> :

          <a href={sum.action.href} style={{
            width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 14px',
            borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', font: '700 13px/1 var(--f-sans)', boxShadow: 'var(--shadow-sm)'
          }}>{I.arrowR(15)} {sum.action.label}</a>
          }
          </div>
        }

        {/* Pie: contexto + módulo */}
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ font: '600 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 10 }}>{node.trig}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '600 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>
            <span style={{ color: ac, fontWeight: 700 }}>Entrega a</span> {node.next}
          </div>
        </div>
      </div>

      {modal && <SendModal items={modal.items} onSend={doSend} onClose={() => setModal(null)} />}
      {toast &&
      <div style={{
        position: 'fixed', right: 24, bottom: 24, zIndex: 60, display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--success)', color: '#fff',
        font: '700 12.5px/1.3 var(--f-sans)', boxShadow: 'var(--shadow-pop)', animation: 'erp-slide-in 200ms var(--ease) both'
      }}>{I.check(16)} {toast}</div>
      }
    </div>);

}

// ── Fila de registro ──────────────────────────────────────────
function RecordRow({ r, laneTone, onSend }) {
  const I = window.Icon;
  const tone = r.tone || 'neutral';
  return (
    <a href={r.href || '#'} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 'var(--r-md)',
      background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color var(--dur-fast) var(--ease)'
    }}
    onMouseEnter={(e) => e.currentTarget.style.borderColor = `var(--${tone})`}
    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}>
      <span style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `var(--${tone}-bg)`, color: `var(--${tone})` }}>{I[r.icon] ? I[r.icon](15) : I.box(15)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '700 12px/1.25 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
        <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
      </div>
      {onSend ?
      <button onClick={(e) => {e.preventDefault();onSend();}} title="Enviar al cliente" style={{
        flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 9px', borderRadius: 'var(--r-pill)',
        background: 'var(--wine)', color: '#fff', font: '700 9.5px/1 var(--f-sans)'
      }}>{I.mail(11)} Enviar</button> :

      <span style={{ flexShrink: 0, font: `700 ${/\$|%/.test(String(r.right)) ? '11px/1.2 var(--f-mono)' : '10px/1.2 var(--f-sans)'}`, color: `var(--${tone === 'neutral' ? 'ink-soft' : tone})`, textAlign: 'right', maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.right}</span>
      }
    </a>);

}

// ── Modal de envío al cliente ─────────────────────────────────
function SendModal({ items, onSend, onClose }) {
  const I = window.Icon;
  const [ch, setCh] = useState('correo');
  const total = items.reduce((s, it) => s + (it?.amount || 0), 0);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(15,30,61,0.42)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'erp-fade 160ms var(--ease) both'
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 420, maxWidth: '100%', background: 'var(--bg-surface)', borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--shadow-pop)', overflow: 'hidden', animation: 'erp-slide-up 220ms var(--ease) both'
      }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)' }}>Enviar al cliente</div>
          <div style={{ font: '800 18px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Revisar antes de enviar</div>
        </div>
        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Items */}
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>{items.length} documento{items.length > 1 ? 's' : ''}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 168, overflowY: 'auto' }}>
              {items.map((it, i) =>
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <span style={{ width: 28, height: 28, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--info-bg)', color: 'var(--info)' }}>{I.invoice(15)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 12px/1.2 var(--f-mono)', color: 'var(--ink)' }}>{it?.id || 'Documento'}</div>
                    <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>{it?.clientName || ''}</div>
                  </div>
                  <span style={{ flexShrink: 0, font: '700 12px/1.2 var(--f-mono)', color: 'var(--ink)' }}>{it?.amount ? '$' + it.amount.toLocaleString('en-US') : ''}</span>
                </div>
              )}
            </div>
          </div>
          {/* Canal */}
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 8 }}>Canal de envío</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {CHANNELS.map((c) => {
                const on = ch === c.id;
                return (
                  <button key={c.id} onClick={() => setCh(c.id)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--r-md)',
                    border: `1.5px solid ${on ? 'var(--wine)' : 'var(--border)'}`, background: on ? 'var(--wine-bg)' : 'var(--bg-surface)',
                    color: on ? 'var(--wine)' : 'var(--ink-soft)', font: `${on ? '700' : '600'} 12px/1 var(--f-sans)`, transition: 'all var(--dur-fast) var(--ease)'
                  }}>{I[c.icon]?.(15)} {c.label}</button>);

              })}
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {total > 0 &&
          <div style={{ marginRight: 'auto', font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-mute)' }}>Total <span style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>${total.toLocaleString('en-US')}</span></div>
          }
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 12.5px/1 var(--f-sans)' }}>Cancelar</button>
          <button onClick={() => onSend(ch)} style={{ padding: '10px 18px', borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', font: '700 12.5px/1 var(--f-sans)', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: 'var(--shadow-sm)' }}>{I.arrowR(14)} Enviar</button>
        </div>
      </div>
    </div>);

}

function Field({ label, value, accent }) {
  return (
    <div>
      <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>{label}</div>
      <div style={{ font: '600 13.5px/1.5 var(--f-sans)', color: accent || 'var(--ink)' }}>{value}</div>
    </div>);

}

// ── Panel de Automatizaciones ─────────────────────────────────
function RulesPanel({ rules, ruleOn, selRule, onToggle, onSelect, onSave, onDelete, onReset, log, onRun, onClose }) {
  const I = window.Icon;
  const CH = { app: 'App', portal: 'Portal', correo: 'Correo', whatsapp: 'WhatsApp' };
  const [form, setForm] = useState(null); // {mode, draft}
  const [view, setView] = useState('reglas'); // reglas | registro
  const [toast, setToast] = useState(null);
  const LOG = log || window.FlowRules?.LOG || [];
  const logFor = (id) => LOG.filter((e) => e.id === id);
  const fire = (r) => {onRun(r);setToast(`${r.id} ejecutada`);setTimeout(() => setToast(null), 3000);};
  const cats = [];
  rules.forEach((r) => {if (!cats.includes(r.category)) cats.push(r.category);});
  const active = rules.filter((r) => ruleOn[r.id]).length;

  const nextId = () => {
    let max = 0;rules.forEach((r) => {const m = /AUT-(\d+)/.exec(r.id);if (m) max = Math.max(max, +m[1]);});
    return 'AUT-' + String(max + 1).padStart(2, '0');
  };
  const openNew = () => setForm({ mode: 'new', draft: {
    id: nextId(), from: 'com-quote', to: 'op-pedido', trigger: '', action: '', channels: []
  } });
  const openEdit = (r) => setForm({ mode: 'edit', draft: { ...r, channels: r.channels || [] } });

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 392, zIndex: 20,
      background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
      display: 'flex', flexDirection: 'column', animation: 'erp-slide-in 220ms var(--ease) both'
    }}>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--wine-bg)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.spark(20)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--wine)' }}>Reglas de automatización</div>
          <div style={{ font: '800 17px/1.15 var(--f-display)', color: 'var(--ink)', marginTop: 5 }}>{active} de {rules.length} activas</div>
        </div>
        <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', color: 'var(--ink-mute)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.close(16)}</button>
      </div>

      {form ?
      <RuleForm form={form} onCancel={() => setForm(null)}
        onSubmit={(rule) => {onSave(rule);setForm(null);}} /> :

      <>
        <div style={{ padding: '12px 20px 0', display: 'flex', gap: 6 }}>
          {[['reglas', 'Reglas'], ['registro', 'Registro']].map(([id, label]) => {
            const on = view === id;
            return (
              <button key={id} onClick={() => setView(id)} style={{
                flex: 1, padding: '9px', borderRadius: 'var(--r-md)', border: `1px solid ${on ? 'var(--wine)' : 'var(--border)'}`,
                background: on ? 'var(--wine-bg)' : 'var(--bg-surface)', color: on ? 'var(--wine)' : 'var(--ink-soft)',
                font: `${on ? '700' : '600'} 12px/1 var(--f-sans)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}>{id === 'registro' ? I.clock(13) : I.flow(13)} {label}{id === 'registro' && LOG.length > 0 && <span style={{ padding: '1px 6px', borderRadius: 'var(--r-pill)', background: on ? 'var(--wine)' : 'var(--bg-elevated)', color: on ? '#fff' : 'var(--ink-mute)', font: '700 9px/1.5 var(--f-mono)' }}>{LOG.length}</span>}</button>);

          })}
        </div>

        {view === 'registro' ?
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 22px' }}>
            <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 12 }}>Cada vez que una regla se dispara, queda registrada acá con el documento que generó.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LOG.map((e, k) =>
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--r-md)', background: e.fresh ? 'var(--success-bg)' : 'var(--bg-elevated)', border: `1px solid ${e.fresh ? 'var(--success)' : 'var(--border)'}` }}>
                  <span style={{ flexShrink: 0, font: '700 9.5px/1 var(--f-mono)', color: 'var(--wine)', minWidth: 46 }}>{e.id}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</div>
                    <div style={{ font: '600 10px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}><span style={{ color: 'var(--wine)', fontFamily: 'var(--f-mono)' }}>{e.artifact}</span> · {e.module}</div>
                  </div>
                  <span style={{ flexShrink: 0, font: '500 10px/1.2 var(--f-sans)', color: 'var(--ink-mute)' }}>{e.at}</span>
                </div>
            )}
            </div>
          </div> :

        <>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 10 }}>{I.check(12)} Cambios guardados en este equipo</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={openNew} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', font: '700 12px/1 var(--f-sans)', whiteSpace: 'nowrap', boxShadow: 'var(--shadow-sm)' }}>+ Nueva regla</button>
            {rules.some((r) => r.custom) &&
            <button onClick={onReset} title="Restablecer reglas a las del sistema" style={{ flexShrink: 0, padding: '9px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink-soft)', font: '700 11.5px/1 var(--f-sans)', whiteSpace: 'nowrap' }}>Restablecer</button>
            }
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {cats.map((cat) =>
          <div key={cat}>
              <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 9 }}>{cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rules.filter((r) => r.category === cat).map((r) => {
                  const en = ruleOn[r.id];
                  const sel = selRule === r.id;
                  return (
                    <div key={r.id} onClick={() => onSelect(r.id)} style={{
                      borderRadius: 'var(--r-lg)', border: `1.5px solid ${sel ? 'var(--wine)' : 'var(--border)'}`,
                      background: sel ? 'var(--wine-bg)' : 'var(--bg-elevated)', padding: '12px 13px', cursor: 'pointer',
                      transition: 'all var(--dur-fast) var(--ease)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
                        <span style={{ font: '700 10px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.id}</span>
                        {r.custom && <span style={{ padding: '1px 6px', borderRadius: 'var(--r-pill)', background: 'var(--info-bg)', color: 'var(--info)', font: '700 8.5px/1.4 var(--f-sans)' }}>propia</span>}
                        <span style={{ marginLeft: 'auto' }} onClick={(e) => {e.stopPropagation();onToggle(r.id);}}>
                          <Switch on={en} />
                        </span>
                      </div>
                      <Step icon="info" tone="info" label="Cuando" text={r.trigger} />
                      <div style={{ marginLeft: 13, height: 10, borderLeft: '2px dotted var(--border-strong)' }} />
                      <Step icon="spark" tone="wine" label="Entonces" text={r.action} />
                      {sel &&
                    <div style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 9 }}>
                          {r.detail && <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>{r.detail}</div>}
                          {r.conditions && r.conditions.length > 0 &&
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            <span style={{ font: '600 10px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>Solo si:</span>
                            {r.conditions.map((c, k) =>
                        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'var(--info-bg)', color: 'var(--info)', font: '700 10px/1.3 var(--f-mono)' }}>{I.info(10)} {fmtCond(c)}</span>
                        )}
                          </div>
                      }
                          {r.modules &&
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                            {r.modules.map((m, k) =>
                        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'var(--bg-surface)', border: '1px solid var(--border)', font: '600 10px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{I.box(11)} {m}</span>
                        )}
                          </div>
                      }
                          {r.channels && r.channels.length > 0 &&
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                              <span style={{ font: '600 10px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>Notifica por:</span>
                              {r.channels.map((c) =>
                        <span key={c} style={{ padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'var(--wine-bg)', color: 'var(--wine)', font: '700 10px/1.3 var(--f-sans)' }}>{CH[c] || c}</span>
                        )}
                            </div>
                      }
                          <div style={{ font: '600 10.5px/1.3 var(--f-sans)', color: en ? 'var(--success)' : 'var(--ink-mute)' }}>
                            {en ? `Activa · se ejecutó ${r.runs || 0} ${r.runs === 1 ? 'vez' : 'veces'} este mes` : 'Inactiva · se ejecuta de forma manual'}
                          </div>
                          {(() => {const ex = logFor(r.id);return ex.length > 0 &&
                      <div>
                              <div style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 6 }}>Últimas ejecuciones</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {ex.slice(0, 3).map((e, k) =>
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 'var(--r-sm)', background: e.fresh ? 'var(--success-bg)' : 'var(--bg-surface)', border: `1px solid ${e.fresh ? 'var(--success)' : 'var(--border)'}` }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ font: '600 11px/1.3 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.summary}</div>
                                      <div style={{ font: '600 9.5px/1.3 var(--f-mono)', color: 'var(--wine)' }}>{e.artifact}</div>
                                    </div>
                                    <span style={{ flexShrink: 0, font: '500 9.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)' }}>{e.at}</span>
                                  </div>
                          )}
                              </div>
                            </div>;
                      })()}
                          <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                            <button onClick={(e) => {e.stopPropagation();fire(r);}} disabled={!en} title={en ? 'Simular un disparo de la regla' : 'Activá la regla para ejecutarla'} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-md)', border: 'none', background: en ? 'var(--wine)' : 'var(--border-strong)', color: '#fff', font: '700 11.5px/1 var(--f-sans)', cursor: en ? 'pointer' : 'not-allowed' }}>{I.spark(12)} Ejecutar ahora</button>
                            <button onClick={(e) => {e.stopPropagation();openEdit(r);}} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 11.5px/1 var(--f-sans)' }}>Editar</button>
                            {r.custom &&
                        <button onClick={(e) => {e.stopPropagation();onDelete(r.id);}} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', font: '700 11.5px/1 var(--f-sans)' }}>Eliminar</button>
                        }
                          </div>
                        </div>
                    }
                    </div>);

                })}
              </div>
            </div>
          )}
        </div>
      </>
        }
      </>
      }
      {toast &&
      <div style={{
        position: 'fixed', right: 24, bottom: 24, zIndex: 60, display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--success)', color: '#fff',
        font: '700 12.5px/1.3 var(--f-sans)', boxShadow: 'var(--shadow-pop)', animation: 'erp-slide-in 200ms var(--ease) both'
      }}>{I.spark(16)} {toast} · ver en Registro</div>
      }
    </div>);

}

// ── Formulario crear/editar regla ─────────────────────────────
function RuleForm({ form, onSubmit, onCancel }) {
  const I = window.Icon;
  const isNew = form.mode === 'new';
  const [from, setFrom] = useState(form.draft.from);
  const [to, setTo] = useState(form.draft.to);
  const fromN = NODE_BY[from], toN = NODE_BY[to];
  const defTrigger = fromN ? 'Se completa: ' + fromN.label : '';
  const defAction = toN ? 'Genera/actualiza en ' + toN.label : '';
  const [trigger, setTrigger] = useState(form.draft.trigger || defTrigger);
  const [action, setAction] = useState(form.draft.action || defAction);
  const [channels, setChannels] = useState(form.draft.channels || []);
  const [conditions, setConditions] = useState(form.draft.conditions || []);
  const [touchedT, setTouchedT] = useState(!!form.draft.trigger);
  const [touchedA, setTouchedA] = useState(!!form.draft.action);

  const onFrom = (v) => {setFrom(v);if (!touchedT) {const n = NODE_BY[v];setTrigger(n ? 'Se completa: ' + n.label : '');}};
  const onTo = (v) => {setTo(v);if (!touchedA) {const n = NODE_BY[v];setAction(n ? 'Genera/actualiza en ' + n.label : '');}};

  const cat = (() => {
    if (!fromN || !toN) return '';
    if (fromN.lane === toN.lane) return LANES[fromN.lane].label;
    return LANES[fromN.lane].label + ' → ' + LANES[toN.lane].label;
  })();

  const valid = from && to && from !== to && trigger.trim() && action.trim();
  const submit = () => {
    if (!valid) return;
    onSubmit({
      id: form.draft.id, from, to, category: cat,
      trigger: trigger.trim(), action: action.trim(),
      detail: form.draft.detail || '',
      modules: [fromN.mod, toN.mod].filter(Boolean),
      conditions: conditions.filter((c) => c.field && c.value !== '' && c.value != null),
      channels, auto: true, runs: form.draft.runs || 0, custom: form.draft.custom ?? isNew
    });
  };

  const selSty = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '600 12.5px/1.2 var(--f-sans)' };
  const inSty = { ...selSty };
  const lbl = (t) => <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 7 }}>{t}</div>;
  const opts = LANES.map((ln, li) =>
  <optgroup key={li} label={ln.label}>
      {NODES.filter((n) => n.lane === li).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
    </optgroup>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ font: '800 15px/1.2 var(--f-display)', color: 'var(--ink)' }}>{isNew ? 'Nueva regla · ' + form.draft.id : 'Editar ' + form.draft.id}</div>

      <div>
        {lbl('Disparador · cuando se completa')}
        <select value={from} onChange={(e) => onFrom(e.target.value)} style={selSty}>{opts}</select>
      </div>
      <div>
        {lbl('Condición · texto del disparador')}
        <input value={trigger} onChange={(e) => {setTrigger(e.target.value);setTouchedT(true);}} style={inSty} placeholder="Cuando…" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--wine)' }}>
        <span style={{ height: 1, flex: 1, background: 'var(--border)' }} />
        {I.spark(14)}
        <span style={{ height: 1, flex: 1, background: 'var(--border)' }} />
      </div>

      <div>
        {lbl('Acción · ocurre en')}
        <select value={to} onChange={(e) => onTo(e.target.value)} style={selSty}>{opts}</select>
      </div>
      <div>
        {lbl('Qué hace')}
        <input value={action} onChange={(e) => {setAction(e.target.value);setTouchedA(true);}} style={inSty} placeholder="Entonces…" />
      </div>

      <div>
        {lbl('Condiciones · solo si se cumple (opcional)')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conditions.map((c, i) => {
            const f = COND_BY[c.field] || COND_FIELDS[0];
            const setC = (patch) => setConditions((cs) => cs.map((x, k) => k === i ? { ...x, ...patch } : x));
            return (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select value={c.field} onChange={(e) => {const nf = COND_BY[e.target.value];setC({ field: e.target.value, op: nf.ops[0], value: nf.type === 'enum' ? nf.options[0] : '' });}}
                  style={{ ...selSty, flex: 1.4, padding: '8px 9px' }}>
                  {COND_FIELDS.map((cf) => <option key={cf.id} value={cf.id}>{cf.label}</option>)}
                </select>
                <select value={c.op} onChange={(e) => setC({ op: e.target.value })} style={{ ...selSty, width: 56, padding: '8px 6px', textAlign: 'center' }}>
                  {f.ops.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {f.type === 'enum' ?
                <select value={c.value} onChange={(e) => setC({ value: e.target.value })} style={{ ...selSty, flex: 1.4, padding: '8px 9px' }}>
                    {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select> :

                <input type="number" value={c.value} onChange={(e) => setC({ value: e.target.value })} placeholder={f.unit || ''} style={{ ...inSty, flex: 1.4, padding: '8px 9px' }} />
                }
                <button onClick={() => setConditions((cs) => cs.filter((_, k) => k !== i))} title="Quitar" style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink-mute)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.close(13)}</button>
              </div>);

          })}
          <button onClick={() => setConditions((cs) => [...cs, { field: 'monto', op: '>', value: '' }])} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 'var(--r-md)', border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--ink-soft)', font: '700 11.5px/1 var(--f-sans)' }}>+ Condición</button>
        </div>
      </div>

      <div>
        {lbl('Notificar al cliente por (opcional)')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {CHANNELS.map((c) => {
            const on = channels.includes(c.id);
            return (
              <button key={c.id} onClick={() => setChannels((cs) => on ? cs.filter((x) => x !== c.id) : [...cs, c.id])} style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 'var(--r-md)',
                border: `1.5px solid ${on ? 'var(--wine)' : 'var(--border)'}`, background: on ? 'var(--wine-bg)' : 'var(--bg-surface)',
                color: on ? 'var(--wine)' : 'var(--ink-soft)', font: `${on ? '700' : '600'} 11.5px/1 var(--f-sans)`
              }}>{I[c.icon]?.(14)} {c.label}</button>);

          })}
        </div>
      </div>

      {from === to &&
      <div style={{ font: '600 11px/1.4 var(--f-sans)', color: 'var(--danger)' }}>El disparador y la acción no pueden ser el mismo paso.</div>
      }
      {cat &&
      <div style={{ font: '600 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>Categoría: <span style={{ color: 'var(--ink)' }}>{cat}</span></div>
      }

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 12.5px/1 var(--f-sans)' }}>Cancelar</button>
        <button onClick={submit} disabled={!valid} style={{ flex: 1, padding: '11px', borderRadius: 'var(--r-md)', border: 'none', background: valid ? 'var(--wine)' : 'var(--border-strong)', color: '#fff', font: '700 12.5px/1 var(--f-sans)', cursor: valid ? 'pointer' : 'not-allowed', boxShadow: valid ? 'var(--shadow-sm)' : 'none' }}>{isNew ? 'Crear regla' : 'Guardar cambios'}</button>
      </div>
    </div>);

}

function Step({ icon, tone, label, text }) {
  const I = window.Icon;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
      <span style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `var(--${tone}-bg)`, color: `var(--${tone})` }}>{I[icon]?.(14)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: `var(--${tone})`, marginBottom: 3 }}>{label}</div>
        <div style={{ font: '600 12px/1.35 var(--f-sans)', color: 'var(--ink)' }}>{text}</div>
      </div>
    </div>);

}

function Switch({ on }) {
  return (
    <span style={{
      width: 38, height: 22, borderRadius: 'var(--r-pill)', flexShrink: 0, display: 'inline-block', position: 'relative',
      background: on ? 'var(--wine)' : 'var(--border-strong)', transition: 'background var(--dur-fast) var(--ease)', cursor: 'pointer'
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: '50%',
        background: '#fff', boxShadow: 'var(--shadow-xs)', transition: 'left var(--dur-fast) var(--ease)'
      }} />
    </span>);

}

window.ProcessMapApp = ProcessMapApp;