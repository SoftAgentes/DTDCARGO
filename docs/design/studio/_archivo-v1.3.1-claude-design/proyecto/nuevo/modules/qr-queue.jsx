/* global React */
/* ── DTD ERP · QR Print Queue (vista oficina) ───────────────── */
/* Recibe las órdenes de impresión que Operario CN manda al     */
/* tildar "Enviar a oficina" en el sheet de QR.                 */
/* Estado se persiste en localStorage (dtd_qrqueue_v1) para     */
/* simular el push del móvil al ERP.                            */

const QR_LS_KEY = 'dtd_qrqueue_v1';

// ── Mock seed (se hidrata 1ª vez si no hay localStorage) ──────
// TODO: al consolidar, mover a erp/data.jsx · PRINT_ORDERS
const SEED_ORDERS = [
  { id: 'QR-2026-1118', markbox: 'DTD-7842', client: 'Polar C.A.',           bultos: 18, warehouse: 'cn-yiwu',      supplier: 'Yiwu Trading Hub Co.',    sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-24 09:42', priority: 'urgent', status: 'pendiente', notes: 'Cliente pasa esta tarde — armar paquete listo' },
  { id: 'QR-2026-1117', markbox: 'DTD-7842', client: 'Polar C.A.',           bultos: 24, warehouse: 'cn-yiwu',      supplier: 'Ningbo Textile Group',    sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-24 09:38', priority: 'urgent', status: 'pendiente', notes: '' },
  { id: 'QR-2026-1116', markbox: 'DTD-9104', client: 'Acindar Industrial',   bultos: 12, warehouse: 'cn-guangzhou', supplier: 'Foshan Steel Parts',      sentBy: 'Chen Min',   sentByPhone: '+86 159 2147', sentAt: '2026-05-24 09:14', priority: 'normal', status: 'pendiente', notes: '' },
  { id: 'QR-2026-1115', markbox: 'DTD-5621', client: 'Tech Solutions',       bultos:  6, warehouse: 'cn-yiwu',      supplier: 'Shenzhen Electronics Ltd', sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-24 08:51', priority: 'normal', status: 'pendiente', notes: 'Frágil — etiqueta verde extra' },
  { id: 'QR-2026-1114', markbox: 'DTD-3308', client: 'Distribuidora MAVECA', bultos: 30, warehouse: 'cn-yiwu',      supplier: 'Hangzhou Plastics',       sentBy: 'Wang Lei',   sentByPhone: '+86 187 4421', sentAt: '2026-05-24 08:33', priority: 'normal', status: 'imprimiendo', assignedPrinter: 'HP LaserJet · Oficina 2', notes: '' },
  { id: 'QR-2026-1113', markbox: 'DTD-7842', client: 'Polar C.A.',           bultos:  8, warehouse: 'cn-guangzhou', supplier: 'Foshan Steel Parts',      sentBy: 'Chen Min',   sentByPhone: '+86 159 2147', sentAt: '2026-05-24 08:12', priority: 'normal', status: 'imprimiendo', assignedPrinter: 'Zebra ZT411 · Oficina 1', notes: '' },
  { id: 'QR-2026-1112', markbox: 'DTD-2017', client: 'Farmacia La Vista',    bultos: 14, warehouse: 'cn-yiwu',      supplier: 'Yiwu Trading Hub Co.',    sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-23 17:48', priority: 'normal', status: 'impreso',     assignedPrinter: 'HP LaserJet · Oficina 2', printedAt: '2026-05-23 18:05', printedBy: 'Andrea M.', notes: '' },
  { id: 'QR-2026-1111', markbox: 'DTD-9104', client: 'Acindar Industrial',   bultos: 22, warehouse: 'cn-guangzhou', supplier: 'Dongguan Hardware',       sentBy: 'Chen Min',   sentByPhone: '+86 159 2147', sentAt: '2026-05-23 16:22', priority: 'normal', status: 'impreso',     assignedPrinter: 'Zebra ZT411 · Oficina 1', printedAt: '2026-05-23 16:38', printedBy: 'Andrea M.', notes: '' },
  { id: 'QR-2026-1110', markbox: 'DTD-5621', client: 'Tech Solutions',       bultos: 10, warehouse: 'cn-yiwu',      supplier: 'Shenzhen Electronics Ltd', sentBy: 'Liu Wei',    sentByPhone: '+86 138 8829', sentAt: '2026-05-23 15:11', priority: 'normal', status: 'entregado',   assignedPrinter: 'HP LaserJet · Oficina 2', printedAt: '2026-05-23 15:28', printedBy: 'Andrea M.', deliveredAt: '2026-05-23 17:50', notes: '' },
  { id: 'QR-2026-1109', markbox: 'DTD-3308', client: 'Distribuidora MAVECA', bultos: 16, warehouse: 'cn-yiwu',      supplier: 'Hangzhou Plastics',       sentBy: 'Wang Lei',   sentByPhone: '+86 187 4421', sentAt: '2026-05-23 14:02', priority: 'normal', status: 'entregado',   assignedPrinter: 'HP LaserJet · Oficina 2', printedAt: '2026-05-23 14:17', printedBy: 'Andrea M.', deliveredAt: '2026-05-23 16:30', notes: '' },
];

// ── Hook de persistencia ──────────────────────────────────────
function useQrQueue() {
  const [orders, setOrders] = React.useState(() => {
    try {
      const raw = localStorage.getItem(QR_LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return SEED_ORDERS;
  });
  React.useEffect(() => {
    try { localStorage.setItem(QR_LS_KEY, JSON.stringify(orders)); } catch (e) {}
  }, [orders]);
  return [orders, setOrders];
}

// ── Helpers ───────────────────────────────────────────────────
const WAREHOUSES = {
  'cn-yiwu':      { name: 'Yiwu',      flag: '🇨🇳' },
  'cn-guangzhou': { name: 'Guangzhou', flag: '🇨🇳' },
};
const PRINTERS = [
  { id: 'hp-lj-2',    label: 'HP LaserJet · Oficina 2', online: true,  type: 'A4' },
  { id: 'zebra-zt-1', label: 'Zebra ZT411 · Oficina 1', online: true,  type: 'Térmica' },
  { id: 'zebra-zt-2', label: 'Zebra ZT411 · Almacén',   online: false, type: 'Térmica' },
];
const STATUS_TONE = {
  pendiente:   'warning',
  imprimiendo: 'info',
  impreso:     'success',
  entregado:   'neutral',
  cancelado:   'danger',
};
function timeAgo(ts) {
  const now = new Date('2026-05-24 10:00').getTime();
  const t = new Date(ts.replace(' ', 'T')).getTime();
  const m = Math.floor((now - t) / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ════════════════════════════════════════════════════════════════
// Main module
// ════════════════════════════════════════════════════════════════
function ModuleQrQueue({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [orders, setOrders] = useQrQueue();
  const [view, setView]         = React.useState('cola');     // cola | historial
  const [search, setSearch]     = React.useState('');
  const [whFilter, setWhFilter] = React.useState('all');
  const [priFilter, setPriFilter] = React.useState('all');
  const [selected, setSelected] = React.useState([]);
  const [detailId, setDetailId] = React.useState(null);
  const [printModal, setPrintModal] = React.useState(false);

  // Filtros
  const filtered = orders.filter(o => {
    const inView = view === 'cola'
      ? ['pendiente', 'imprimiendo'].includes(o.status)
      : ['impreso', 'entregado', 'cancelado'].includes(o.status);
    if (!inView) return false;
    if (whFilter !== 'all' && o.warehouse !== whFilter) return false;
    if (priFilter !== 'all' && o.priority !== priFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!o.id.toLowerCase().includes(q) && !o.markbox.toLowerCase().includes(q) &&
          !o.client.toLowerCase().includes(q) && !(o.supplier || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    // urgentes arriba, después por fecha desc
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (a.priority !== 'urgent' && b.priority === 'urgent') return 1;
    return b.sentAt.localeCompare(a.sentAt);
  });

  // KPIs
  const pendientes = orders.filter(o => o.status === 'pendiente').length;
  const urgentes   = orders.filter(o => o.status === 'pendiente' && o.priority === 'urgent').length;
  const imprimiendo = orders.filter(o => o.status === 'imprimiendo').length;
  const impresosHoy = orders.filter(o => o.status !== 'pendiente' && o.printedAt?.startsWith('2026-05-24')).length;
  const totalBultosCola = orders.filter(o => ['pendiente', 'imprimiendo'].includes(o.status)).reduce((s, o) => s + o.bultos, 0);

  // Selección
  const selectedOrders = orders.filter(o => selected.includes(o.id));
  const selectedBultos = selectedOrders.reduce((s, o) => s + o.bultos, 0);
  const detail = orders.find(o => o.id === detailId);

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAllVisible = () => {
    const ids = filtered.filter(o => o.status === 'pendiente').map(o => o.id);
    setSelected(prev => prev.length === ids.length ? [] : ids);
  };

  // Acciones
  const updateOrders = (ids, patch) => {
    setOrders(prev => prev.map(o => ids.includes(o.id) ? { ...o, ...patch } : o));
  };
  const handleBatchPrint = (printerId) => {
    const printerLabel = PRINTERS.find(p => p.id === printerId)?.label || '';
    updateOrders(selected, { status: 'imprimiendo', assignedPrinter: printerLabel });
    setPrintModal(false);
    setSelected([]);
  };
  const handleMarkPrinted = (ids) => {
    const now = '2026-05-24 10:02';
    updateOrders(ids, { status: 'impreso', printedAt: now, printedBy: 'Andrea M.' });
    setSelected([]);
  };
  const handleMarkDelivered = (ids) => {
    updateOrders(ids, { status: 'entregado', deliveredAt: '2026-05-24 10:05' });
  };
  const handleCancel = (id) => {
    if (confirm('¿Cancelar esta orden de impresión? El operario va a recibir un aviso.')) {
      updateOrders([id], { status: 'cancelado' });
      setDetailId(null);
    }
  };

  return (
    <div>
      <U.PageHeader
        eyebrow="ALMACÉN CN · Cola de impresión"
        title="Cola de QR"
        subtitle={`${pendientes} pendientes${urgentes > 0 ? ` · ${urgentes} urgentes` : ''} · ${totalBultosCola} etiquetas en cola`}
        actions={
          <>
            <U.Btn variant="secondary" icon={I.download(14)}>Exportar historial</U.Btn>
            <U.Btn variant="secondary" icon={I.cog?.(14) || I.more(14)}>Impresoras</U.Btn>
          </>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Pendientes"    value={pendientes}    delta={`${urgentes} urgentes`} tone={urgentes > 0 ? 'warning' : 'wine'} icon={I.tag(18)} />
        <U.KPI label="Imprimiendo"   value={imprimiendo}   delta="en cola activa"          tone="info"    icon={I.spark(18)} />
        <U.KPI label="Bultos en cola" value={totalBultosCola} delta="etiquetas pendientes" tone="neutral" icon={I.box(18)} />
        <U.KPI label="Impresos hoy"  value={impresosHoy}   delta="último: 09:48"           tone="success" icon={I.check(18)} />
      </div>

      {/* Tabs view + toolbar */}
      <div style={{ marginBottom: 14 }}>
        <U.Tabs
          value={view}
          onChange={(v) => { setView(v); setSelected([]); setDetailId(null); }}
          items={[
            { value: 'cola',      label: 'Cola activa', count: orders.filter(o => ['pendiente', 'imprimiendo'].includes(o.status)).length },
            { value: 'historial', label: 'Historial',   count: orders.filter(o => ['impreso', 'entregado', 'cancelado'].includes(o.status)).length },
          ]}
        />
      </div>

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por orden, MARKBOX, cliente o supplier…"
        filters={
          <>
            <U.Select value={whFilter} onChange={(e) => setWhFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos los almacenes' },
              { value: 'cn-yiwu',      label: 'CN · Yiwu' },
              { value: 'cn-guangzhou', label: 'CN · Guangzhou' },
            ]} style={{ minWidth: 180 }} />
            {view === 'cola' && (
              <U.Select value={priFilter} onChange={(e) => setPriFilter(e.target.value)} options={[
                { value: 'all',    label: 'Todas las prioridades' },
                { value: 'urgent', label: '🟡 Solo urgentes' },
                { value: 'normal', label: 'Solo normales' },
              ]} style={{ minWidth: 180 }} />
            )}
          </>
        }
        actions={view === 'cola' && filtered.some(o => o.status === 'pendiente') && (
          <U.Btn size="sm" variant="ghost" onClick={selectAllVisible}>
            {selected.length === filtered.filter(o => o.status === 'pendiente').length ? 'Deseleccionar' : 'Seleccionar todos pendientes'}
          </U.Btn>
        )}
      />

      {/* Layout 2col: lista + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: detailId ? '1fr 380px' : '1fr', gap: 16, marginBottom: selected.length > 0 ? 90 : 0 }}>
        <div>
          {filtered.length === 0 ? (
            <U.EmptyState
              icon={I.tag(24)}
              title={view === 'cola' ? 'No hay órdenes de impresión' : 'No hay historial con estos filtros'}
              body={view === 'cola' ? 'Cuando Operario CN envíe una orden de impresión, aparece acá.' : 'Probá cambiar los filtros.'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtered.map(o => (
                <OrderCard
                  key={o.id}
                  order={o}
                  selected={selected.includes(o.id)}
                  active={detailId === o.id}
                  selectable={view === 'cola' && o.status === 'pendiente'}
                  onSelect={() => toggleSelect(o.id)}
                  onClick={() => setDetailId(o.id === detailId ? null : o.id)}
                  onMarkPrinted={() => handleMarkPrinted([o.id])}
                  onMarkDelivered={() => handleMarkDelivered([o.id])}
                />
              ))}
            </div>
          )}
        </div>

        {detail && (
          <OrderDetail
            order={detail}
            onClose={() => setDetailId(null)}
            onMarkPrinted={() => handleMarkPrinted([detail.id])}
            onMarkDelivered={() => handleMarkDelivered([detail.id])}
            onCancel={() => handleCancel(detail.id)}
            goTo={goTo}
          />
        )}
      </div>

      {/* Sticky bulk-action bar */}
      {selected.length > 0 && (
        <BulkBar
          count={selected.length}
          bultos={selectedBultos}
          onPrint={() => setPrintModal(true)}
          onClear={() => setSelected([])}
        />
      )}

      <BatchPrintModal
        open={printModal}
        onClose={() => setPrintModal(false)}
        orders={selectedOrders}
        bultos={selectedBultos}
        onConfirm={handleBatchPrint}
      />
    </div>
  );
}

// ── Order card ────────────────────────────────────────────────
function OrderCard({ order: o, selected, active, selectable, onSelect, onClick, onMarkPrinted, onMarkDelivered }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const tone = STATUS_TONE[o.status];
  const isUrgent = o.priority === 'urgent' && o.status === 'pendiente';

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 1fr auto',
        gap: 14, alignItems: 'center',
        padding: '14px 18px',
        background: active ? 'var(--wine-tint)' : 'var(--bg-surface)',
        border: `1px solid ${active ? 'var(--wine)' : (isUrgent ? 'var(--warning)' : 'var(--border)')}`,
        borderLeft: isUrgent ? '4px solid var(--warning)' : (active ? '4px solid var(--wine)' : `1px solid ${active ? 'var(--wine)' : 'var(--border)'}`),
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-surface)'; }}
    >
      {selectable ? (
        <input
          type="checkbox" checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={onSelect}
          style={{ width: 18, height: 18, accentColor: 'var(--wine)', cursor: 'pointer', justifySelf: 'center' }}
        />
      ) : <span style={{ width: 18, justifySelf: 'center', color: 'var(--ink-mute)' }}>{I.tag(15)}</span>}

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '0.02em' }}>{o.id}</code>
          <U.Badge tone={tone} size="sm" dot>{o.status}</U.Badge>
          {isUrgent && <U.Badge tone="warning" size="sm">URGENTE</U.Badge>}
          <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>· {timeAgo(o.sentAt)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <code style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{o.markbox}</code>
          <span style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{o.client}</span>
        </div>
        <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
          {WAREHOUSES[o.warehouse]?.flag} {WAREHOUSES[o.warehouse]?.name} · {o.supplier} · enviado por {o.sentBy}
        </div>
        {o.assignedPrinter && (
          <div style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--info)', marginTop: 6 }}>
            ↳ {o.assignedPrinter}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)' }}>{o.bultos}</div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 3 }}>ETIQUETAS</div>
        </div>
        {o.status === 'imprimiendo' && (
          <button onClick={(e) => { e.stopPropagation(); onMarkPrinted(); }} title="Marcar como impreso"
            style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: 'var(--success-bg)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {I.check(15)}
          </button>
        )}
        {o.status === 'impreso' && (
          <button onClick={(e) => { e.stopPropagation(); onMarkDelivered(); }} title="Marcar entregado al operario"
            style={{ height: 30, padding: '0 10px', borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 11px/1 var(--f-sans)' }}>
            Entregado
          </button>
        )}
      </div>
    </div>
  );
}

// ── Detail panel (right side) ────────────────────────────────
function OrderDetail({ order: o, onClose, onMarkPrinted, onMarkDelivered, onCancel, goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <aside style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      padding: 0,
      position: 'sticky', top: 76,
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow eyebrow-wine">ORDEN DE IMPRESIÓN</div>
          <code style={{ display: 'block', marginTop: 6, font: '900 16px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '0.02em' }}>{o.id}</code>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 'var(--r-md)', color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {I.close(14)}
        </button>
      </header>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* QR preview */}
        <div style={{
          padding: 16, background: 'var(--bg-elevated)',
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <QRPreview value={`${o.markbox}-${o.id}`} size={72} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <code style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--wine)' }}>{o.markbox}</code>
            <div style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)', marginTop: 6 }}>{o.client}</div>
            <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
              <strong style={{ color: 'var(--ink)' }}>{o.bultos}</strong> etiquetas idénticas · A4
            </div>
          </div>
        </div>

        {/* Meta fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <U.Field label="Estado" value={<U.StatusBadge status={o.status} />} />
          <U.Field label="Prioridad" value={
            <U.Badge tone={o.priority === 'urgent' ? 'warning' : 'neutral'}>
              {o.priority === 'urgent' ? '🟡 Urgente' : 'Normal'}
            </U.Badge>
          } />
          <U.Field label="Almacén origen" value={`${WAREHOUSES[o.warehouse]?.flag} ${WAREHOUSES[o.warehouse]?.name}`} />
          <U.Field label="Supplier" value={o.supplier} />
          <U.Field label="Enviado por" value={o.sentBy} />
          <U.Field label="Hace" value={timeAgo(o.sentAt)} />
        </div>

        {o.notes && (
          <div style={{ padding: '10px 12px', background: 'var(--info-bg)', borderLeft: '3px solid var(--info)', borderRadius: 'var(--r-md)' }}>
            <div className="eyebrow" style={{ color: 'var(--info)', marginBottom: 4 }}>NOTA DEL OPERARIO</div>
            <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{o.notes}</div>
          </div>
        )}

        {o.assignedPrinter && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>IMPRESORA ASIGNADA</div>
            <div style={{ font: '700 13px/1.3 var(--f-mono)', color: 'var(--ink)' }}>{o.assignedPrinter}</div>
            {o.printedAt && <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Impreso a las {o.printedAt.slice(11)} por {o.printedBy}</div>}
            {o.deliveredAt && <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--success)', marginTop: 2 }}>✓ Entregado a las {o.deliveredAt.slice(11)}</div>}
          </div>
        )}

        {/* Timeline */}
        <Timeline order={o} />

        {/* Linked client */}
        <button onClick={() => goTo('clients', o.markbox, 'detail')} style={{
          padding: '10px 14px', background: 'var(--bg-elevated)',
          borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left', font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)',
        }}>
          <span style={{ color: 'var(--wine)' }}>{I.users(14)}</span>
          Ver cliente {o.client}
          <span style={{ marginLeft: 'auto', color: 'var(--ink-mute)' }}>{I.chevR(13)}</span>
        </button>
      </div>

      {/* Actions footer */}
      <footer style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, background: 'var(--bg-base)' }}>
        {o.status === 'pendiente' && (
          <>
            <U.Btn variant="ghost" onClick={onCancel}>Cancelar</U.Btn>
            <U.Btn variant="primary" full icon={I.tag(13)}>Imprimir ahora</U.Btn>
          </>
        )}
        {o.status === 'imprimiendo' && (
          <U.Btn variant="primary" full icon={I.check(13)} onClick={onMarkPrinted}>Marcar como impreso</U.Btn>
        )}
        {o.status === 'impreso' && (
          <U.Btn variant="primary" full icon={I.check(13)} onClick={onMarkDelivered}>Marcar entregado al operario</U.Btn>
        )}
        {(o.status === 'entregado' || o.status === 'cancelado') && (
          <U.Btn variant="secondary" full>Reimprimir</U.Btn>
        )}
      </footer>
    </aside>
  );
}

// ── Timeline ─────────────────────────────────────────────────
function Timeline({ order: o }) {
  const steps = [
    { label: 'Recibida en oficina', at: o.sentAt, done: true },
    { label: 'Imprimiendo',         at: o.assignedPrinter ? o.sentAt : null, done: ['imprimiendo', 'impreso', 'entregado'].includes(o.status) },
    { label: 'Impresa',             at: o.printedAt,    done: ['impreso', 'entregado'].includes(o.status) },
    { label: 'Entregada al operario', at: o.deliveredAt, done: o.status === 'entregado' },
  ];
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 10 }}>HISTORIAL</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <span style={{
                width: 14, height: 14, borderRadius: '50%',
                background: s.done ? 'var(--wine)' : 'var(--bg-elevated)',
                border: s.done ? 0 : '2px solid var(--border-strong)',
              }} />
              {i < steps.length - 1 && (
                <span style={{ width: 2, flex: 1, minHeight: 14, background: s.done ? 'var(--wine)' : 'var(--border)', marginTop: 2 }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 8 : 0 }}>
              <div style={{ font: '600 12px/1.2 var(--f-sans)', color: s.done ? 'var(--ink)' : 'var(--ink-mute)' }}>{s.label}</div>
              {s.at && <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 2 }}>{s.at.slice(5)}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── QR preview (stylized) ─────────────────────────────────────
function QRPreview({ value, size = 72 }) {
  // Pseudo QR via deterministic grid from string hash
  const cells = 11;
  const cellSize = (size - 8) / cells;
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) & 0xffffffff;
  const grid = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      // Position markers in 3 corners
      const isMarker = (r < 3 && c < 3) || (r < 3 && c > cells - 4) || (r > cells - 4 && c < 3);
      if (isMarker) {
        const inMarker = (r % 7 === 0 || r % 7 === 2 || c % 7 === 0 || c % 7 === 2 || (r % 7 >= 2 && r % 7 <= 4 && c % 7 >= 2 && c % 7 <= 4));
        // simplified: outer ring + center
        const rr = r < 3 ? r : cells - 1 - r;
        const cc = c < (cells/2) ? c : cells - 1 - c;
        const fill = (rr === 0 || rr === 2 || cc === 0 || cc === 2 || (rr === 1 && cc === 1 && false));
        // simpler: fill border + center 1x1
        if (rr === 0 || (rr === 2 && (c < 3 || c > cells - 4)) || cc === 0 || cc === 2) {} 
        grid.push({ r, c, fill: true });
        continue;
      }
      hash = (hash * 1103515245 + 12345) & 0x7fffffff;
      if ((hash >> (r * 3 + c)) & 1) grid.push({ r, c, fill: true });
    }
  }
  return (
    <div style={{ width: size, height: size, background: '#fff', border: '2px solid var(--ink)', borderRadius: 4, padding: 4, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${cells} ${cells}`} style={{ width: '100%', height: '100%' }}>
        {grid.map((g, i) => (
          <rect key={i} x={g.c} y={g.r} width="1" height="1" fill="var(--ink)" />
        ))}
        {/* 3 position markers */}
        {[[0, 0], [0, cells - 3], [cells - 3, 0]].map(([r, c], i) => (
          <g key={`m${i}`}>
            <rect x={c} y={r} width="3" height="3" fill="var(--ink)" />
            <rect x={c + 0.5} y={r + 0.5} width="2" height="2" fill="#fff" />
            <rect x={c + 1} y={r + 1} width="1" height="1" fill="var(--ink)" />
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Sticky bulk action bar ───────────────────────────────────
function BulkBar({ count, bultos, onPrint, onClear }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <div style={{
      position: 'fixed', left: 'var(--sb-expanded)', right: 0, bottom: 0,
      padding: '14px 32px',
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border-strong)',
      boxShadow: 'var(--shadow-md)',
      display: 'flex', alignItems: 'center', gap: 14,
      zIndex: 30,
      animation: 'erp-slide-in 220ms var(--ease)',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 'var(--r-md)',
        background: 'var(--wine)', color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        font: '800 13px/1 var(--f-display)',
      }}>{count}</div>
      <div>
        <div style={{ font: '800 14px/1.1 var(--f-display)', color: 'var(--ink)' }}>{count} {count === 1 ? 'orden' : 'órdenes'} seleccionadas</div>
        <div style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{bultos} etiquetas en total · A4</div>
      </div>
      <div style={{ flex: 1 }} />
      <U.Btn variant="ghost" onClick={onClear}>Cancelar selección</U.Btn>
      <U.Btn variant="primary" icon={I.tag(13)} onClick={onPrint}>Imprimir selección</U.Btn>
    </div>
  );
}

// ── Batch print modal ────────────────────────────────────────
function BatchPrintModal({ open, onClose, orders, bultos, onConfirm }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [printer, setPrinter] = React.useState('hp-lj-2');
  const [notify, setNotify] = React.useState(true);

  return (
    <U.Modal
      open={open}
      onClose={onClose}
      title="Imprimir lote de QR"
      width={520}
      actions={
        <>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={I.tag(13)} onClick={() => onConfirm(printer)}>Enviar a impresora</U.Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '12px 14px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)' }}>
          <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--wine)' }}>{bultos} etiquetas</div>
          <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)', marginTop: 6 }}>
            {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'} · {orders.map(o => o.markbox).join(' · ')}
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>IMPRESORA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {PRINTERS.map(p => (
              <label key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: printer === p.id ? 'var(--wine-tint)' : 'var(--bg-surface)',
                border: `1px solid ${printer === p.id ? 'var(--wine)' : 'var(--border)'}`,
                borderRadius: 'var(--r-md)',
                cursor: p.online ? 'pointer' : 'not-allowed',
                opacity: p.online ? 1 : 0.45,
              }}>
                <input type="radio" name="printer" checked={printer === p.id} disabled={!p.online}
                  onChange={() => setPrinter(p.id)}
                  style={{ accentColor: 'var(--wine)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)' }}>{p.label}</div>
                  <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{p.type}</div>
                </div>
                <U.Badge tone={p.online ? 'success' : 'neutral'} size="sm" dot>{p.online ? 'online' : 'offline'}</U.Badge>
              </label>
            ))}
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} style={{ accentColor: 'var(--wine)' }} />
          <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            Avisar por WhatsApp al operario cuando estén listas
          </span>
        </label>
      </div>
    </U.Modal>
  );
}

window.ModuleQrQueue = ModuleQrQueue;
