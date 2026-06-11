/* global React */
/* ── DTD ERP · Embarques (LCL · FCL · DDP) ──────────────────── */

const { useState, useMemo } = React;

// Config de columnas (orden + visibilidad) · todas visibles por default.
const SHIP_COLS_DEFAULT = [
  { key: 'id',         visible: true },
  { key: 'type',       visible: true },
  { key: 'clientName', visible: true },
  { key: 'route',      visible: true },
  { key: 'cbm',        visible: true },
  { key: 'status',     visible: true },
  { key: 'progress',   visible: true },
  { key: 'eta',        visible: true },
  { key: 'value',      visible: true },
];

function ModuleShipments({ goTo, view, setView, selectedId, setSelectedId, currentUser }) {
  const D = window.ERPData;
  const baseShipments = D.byTenant(D.SHIPMENTS);   // multi-tenant
  const U = window.ERPUI;
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [moreOpen, setMoreOpen] = useState(false);
  const [destFilter, setDestFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cbmMin, setCbmMin] = useState('');
  const [selected, setSelected] = useState([]);
  const [drawerKind, setDrawerKind] = useState(null); // 'detail' | 'create' | null
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'
  const hideValues = window.ERPUI.useHideValues();
  const loadingTable = window.ERPUI.useFirstLoad('shipments');
  const [colCfg, setColCfg] = window.ERPUI.useColumns('dtd-ship-cols-v1', SHIP_COLS_DEFAULT);

  // Sync from props (e.g. command palette selection)
  React.useEffect(() => {
    if (selectedId && view === 'detail') setDrawerKind('detail');
    if (view === 'create') setDrawerKind('create');
  }, [selectedId, view]);

  const filtered = useMemo(() => {
    const u = currentUser || window.__currentUser;
    let rows = baseShipments;
    // Scope by user's assigned hubs (CN origins or VE destinations)
    if (u?.scope?.type === 'scoped' && u.scope.hubs.length > 0) {
      // CN hubs format YIW-A1 / CAN-C1 / SZX-A2 / SHA-A1 → origin codes
      const cnOrigins = [...new Set(u.scope.hubs.filter(h => h.includes('-')).map(h => h.split('-')[0]))];
      // VE ports are directly PBL / LGU / MAR / PFI
      const vePorts = u.scope.hubs.filter(h => !h.includes('-'));
      rows = rows.filter(s =>
        (cnOrigins.length > 0 && cnOrigins.includes(s.origin)) ||
        (vePorts.length > 0 && vePorts.includes(s.destination))
      );
    }
    if (tab !== 'all') {
      if (tab === 'active') rows = rows.filter(s => !['entregado', 'estimado'].includes(s.status));
      else if (tab === 'delivered') rows = rows.filter(s => s.status === 'entregado');
      else if (tab === 'alerts') rows = rows.filter(s => s.alert);
    }
    if (typeFilter !== 'all') {
      rows = rows.filter(s => s.type.startsWith(typeFilter));
    }
    if (destFilter !== 'all') rows = rows.filter(s => s.destination === destFilter);
    if (statusFilter !== 'all') rows = rows.filter(s => s.status === statusFilter);
    if (cbmMin !== '' && !isNaN(parseFloat(cbmMin))) rows = rows.filter(s => s.cbm >= parseFloat(cbmMin));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(s => s.id.toLowerCase().includes(q) || s.clientName.toLowerCase().includes(q) || s.client.toLowerCase().includes(q));
    }
    return rows;
  }, [tab, typeFilter, destFilter, statusFilter, cbmMin, search, currentUser]);

  const activeFilters = [typeFilter !== 'all', destFilter !== 'all', statusFilter !== 'all', cbmMin !== ''].filter(Boolean).length;

  // Totales de lo filtrado
  const totals = React.useMemo(() => ({
    count: filtered.length,
    cbm: filtered.reduce((s, r) => s + (r.cbm || 0), 0),
    weight: filtered.reduce((s, r) => s + (r.weight || 0), 0),
    value: filtered.reduce((s, r) => s + (r.value || 0), 0),
  }), [filtered]);

  function exportCSV() {
    const head = ['ID', 'Tipo', 'Cliente', 'Shipping Mark', 'Origen', 'Destino', 'CBM', 'Peso kg', 'Estado', 'Progreso %', 'ETD', 'ETA', 'Valor USD'];
    const lines = filtered.map(r => [
      r.id, r.type, r.clientName, r.client,
      D.origin(r.origin).name, D.dest(r.destination).name,
      r.cbm, r.weight, r.status, r.progress, r.etd || '', r.eta || '', r.value,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [head.join(','), ...lines].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `embarques-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const detailRecord = D.SHIPMENTS.find(s => s.id === selectedId);

  const columns = [
    { label: 'ID', key: 'id', render: (r) => <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}</code>, width: 140 },
    { label: 'Tipo', key: 'type', render: (r) => <U.Badge tone="neutral" size="sm">{r.type}</U.Badge>, width: 80 },
    { label: 'Cliente', key: 'clientName', render: (r) => (
      <div>
        <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.clientName}</div>
        <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{r.client}</code>
      </div>
    ), sortKey: 'clientName' },
    { label: 'Ruta', key: 'route', sortValue: (r) => D.origin(r.origin).name, render: (r) => (
      <span style={{ font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
        {D.origin(r.origin).name} <span style={{ color: 'var(--ink-mute)' }}>→</span> {D.dest(r.destination).name}
      </span>
    )},
    { label: 'CBM', key: 'cbm', align: 'right', render: (r) => <span className="mono" style={{ font: '600 12.5px/1 var(--f-mono)' }}>{r.cbm}</span>, width: 70 },
    { label: 'Estado', key: 'status', render: (r) => <U.StatusBadge status={r.status} size="sm" />, width: 130 },
    { label: 'Progreso', key: 'progress', render: (r) => (
      <div style={{ width: 100 }}>
        <U.Progress value={r.progress} tone={r.alert ? 'warning' : 'wine'} />
        <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{r.progress}%</div>
      </div>
    ), width: 120 },
    { label: 'ETA', key: 'eta', render: (r) => (
      <span style={{ font: '600 12px/1 var(--f-mono)', color: r.alert ? 'var(--warning)' : 'var(--ink-soft)' }}>{r.eta || '—'}</span>
    ), width: 100 },
    { label: 'Valor', key: 'value', align: 'right', render: (r) => <span className="mono" style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{hideValues ? '•••' : `$${(r.value/1000).toFixed(0)}K`}</span>, width: 80 },
  ];
  const visibleColumns = U.applyColumns(columns, colCfg);

  const tabs = [
    { value: 'all', label: 'Todos', count: baseShipments.length },
    { value: 'active', label: 'Activos', count: baseShipments.filter(s => !['entregado', 'estimado'].includes(s.status)).length },
    { value: 'delivered', label: 'Entregados', count: baseShipments.filter(s => s.status === 'entregado').length },
    { value: 'alerts', label: 'Con alertas', count: baseShipments.filter(s => s.alert).length },
  ];

  return (
    <div>
      <U.PageHeader
        title="Embarques"
        subtitle="LCL DDP · FCL 20' · FCL 40' / 40'HC. Trazabilidad puerta a puerta desde origen CN."
        actions={
          <>
            <ViewToggle value={viewMode} onChange={setViewMode} />
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar CSV</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => { setView('create'); setDrawerKind('create'); }}>
              Nuevo embarque
            </U.Btn>
          </>
        }
      />

      <U.Tabs value={tab} onChange={setTab} items={tabs} style={{ marginBottom: 'var(--s-5)' }} />

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por ID, cliente o Shipping Mark…"
        filters={
          <>
            <U.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos los tipos' },
              { value: 'LCL', label: 'LCL DDP' },
              { value: 'FCL', label: 'FCL (20\' / 40\')' },
            ]} style={{ width: 180 }} />
          </>
        }
        actions={
          <>
            {selected.length > 0 && (
              <U.Badge tone="wine">{selected.length} seleccionados</U.Badge>
            )}
            <U.Btn variant="ghost" size="sm" icon={window.Icon.filter(14)} onClick={() => setMoreOpen(o => !o)}>Más filtros{activeFilters > 0 ? ` · ${activeFilters}` : ''}</U.Btn>
            <U.Btn variant="ghost" size="sm" icon={window.Icon.download ? window.Icon.download(14) : null} onClick={exportCSV}>Exportar CSV</U.Btn>
            <U.ColumnManager cfg={colCfg} setCfg={setColCfg} columns={columns} defaultCfg={SHIP_COLS_DEFAULT} />
          </>
        }
      />

      {/* Panel "Más filtros" */}
      {moreOpen && (
        <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '16px 18px', marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: 14, alignItems: 'end' }}>
          <div>
            <label style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Puerto destino</label>
            <U.Select value={destFilter} onChange={(e) => setDestFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos los puertos' },
              { value: 'PBL', label: 'Puerto Cabello' }, { value: 'LGU', label: 'La Guaira' },
              { value: 'MAR', label: 'Maracaibo' }, { value: 'PFI', label: 'Punto Fijo' },
            ]} />
          </div>
          <div>
            <label style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Estado</label>
            <U.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos los estados' },
              'estimado', 'confirmado', 'recibido CN', 'consolidado', 'zarpado', 'tránsito', 'aduana VE', 'liberado', 'entregado',
            ]} />
          </div>
          <div>
            <label style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>CBM mínimo</label>
            <U.Input type="number" value={cbmMin} onChange={(e) => setCbmMin(e.target.value)} placeholder="ej. 10" />
          </div>
          <U.Btn variant="ghost" size="sm" onClick={() => { setDestFilter('all'); setStatusFilter('all'); setCbmMin(''); }}>Limpiar</U.Btn>
        </div>
      )}

      {filtered.length === 0 ? (
        <U.EmptyState
          icon={window.Icon.box(22)}
          title="No hay embarques que coincidan"
          body="Ajusta los filtros o crea un embarque nuevo desde un estimado aceptado."
          action={<U.Btn variant="primary" onClick={() => { setSearch(''); setTab('all'); setTypeFilter('all'); }}>Limpiar filtros</U.Btn>}
        />
      ) : viewMode === 'kanban' ? (
        <KanbanView rows={filtered} onOpen={(r) => { setSelectedId(r.id); setView('detail'); setDrawerKind('detail'); }} />
      ) : (
        <U.Table
          columns={visibleColumns}
          rows={loadingTable ? [] : filtered}
          selectable
          selected={selected}
          onSelectChange={setSelected}
          onRowClick={(r) => { setSelectedId(r.id); setView('detail'); setDrawerKind('detail'); }}
          empty={loadingTable ? <U.LoadingRows rows={7} cols={visibleColumns.length} /> : undefined}
        />
      )}

      {/* Totales del filtro */}
      {filtered.length > 0 && viewMode === 'table' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '12px 18px', marginTop: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', flexWrap: 'wrap' }}>
          <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Totales · {totals.count} embarques</span>
          <Tot label="Σ CBM" value={totals.cbm.toFixed(1) + ' m³'} />
          <Tot label="Σ Peso" value={totals.weight.toLocaleString() + ' kg'} />
          <Tot label="Σ Valor" value={'$' + totals.value.toLocaleString()} />
        </div>
      )}

      {/* Detail Drawer */}
      <U.Drawer
        open={drawerKind === 'detail' && detailRecord}
        onClose={() => { setDrawerKind(null); setView('list'); setSelectedId(null); }}
        title={detailRecord?.id}
        subtitle={detailRecord ? `${detailRecord.type} · ${detailRecord.clientName}` : ''}
        width={680}
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.mail(13)} onClick={() => {
              const client = D.CLIENTS.find(c => c.markbox === detailRecord?.client);
              window.openQuickEmail?.({
                to: client?.email, template: 'm-02',
                ctx: { client, shipment: detailRecord, label: `Embarque ${detailRecord?.id}` }
              });
            }}>Email</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.copy(13)}>Duplicar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.radar(13)} onClick={() => goTo('tracking', detailRecord?.id, 'detail')}>Ver en tracking</U.Btn>
          </>
        }
      >
        {detailRecord && <ShipmentDetail s={detailRecord} />}
      </U.Drawer>

      {/* Create Drawer */}
      <U.Drawer
        open={drawerKind === 'create'}
        onClose={() => { setDrawerKind(null); setView('list'); }}
        title="Nuevo embarque"
        subtitle="Generar a partir de un estimado aceptado o desde cero"
        width={640}
        actions={
          <>
            <U.Btn variant="ghost" onClick={() => { setDrawerKind(null); setView('list'); }}>Cancelar</U.Btn>
            <U.Btn variant="secondary">Guardar borrador</U.Btn>
            <U.Btn variant="primary">Crear embarque</U.Btn>
          </>
        }
      >
        <ShipmentForm />
      </U.Drawer>
    </div>
  );
}

// ── Shipment detail body ──────────────────────────────────────
function ShipmentDetail({ s }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const flowIdx = D.STATUS_FLOW.indexOf(s.status);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Alert if any */}
      {s.alert && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: 'var(--warning-bg)',
          borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--warning)',
        }}>
          <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(15)}</span>
          <div style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{s.alert}</div>
        </div>
      )}

      {/* Status timeline */}
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>ESTADO DEL EMBARQUE</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${D.STATUS_FLOW.length}, 1fr)`, gap: 0, position: 'relative' }}>
          {D.STATUS_FLOW.map((step, i) => {
            const done = i < flowIdx;
            const current = i === flowIdx;
            return (
              <div key={step} style={{ position: 'relative', textAlign: 'center', paddingTop: 28 }}>
                {i > 0 && (
                  <div style={{
                    position: 'absolute', top: 11, left: 'calc(-50% + 8px)', right: 'calc(50% + 8px)',
                    height: 2, background: done || current ? 'var(--wine)' : 'var(--border)',
                  }} />
                )}
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 22, height: 22, borderRadius: '50%',
                  background: current ? 'var(--wine)' : done ? 'var(--wine)' : 'var(--bg-elevated)',
                  border: `2px solid ${current || done ? 'var(--wine)' : 'var(--border-strong)'}`,
                  color: current || done ? '#fff' : 'var(--ink-mute)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: '700 10px/1 var(--f-sans)',
                }}>
                  {done ? '✓' : current ? '●' : i + 1}
                </div>
                <div style={{
                  font: `${current ? '700' : '500'} 9.5px/1.2 var(--f-sans)`,
                  color: current ? 'var(--ink)' : done ? 'var(--ink-soft)' : 'var(--ink-mute)',
                  letterSpacing: '0.02em', textTransform: 'capitalize',
                }}>{step}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key fields */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
        <U.Field label="Cliente" value={s.clientName} />
        <U.Field label="Shipping Mark" value={s.client} mono />
        <U.Field label="Tipo" value={s.type} />
        <U.Field label="Origen" value={`${D.origin(s.origin).name} (${D.origin(s.origin).cn})`} />
        <U.Field label="Destino" value={D.dest(s.destination).name} />
        <U.Field label="Naviera" value={s.vessel || '—'} />
        <U.Field label="CBM" value={`${s.cbm} m³`} mono />
        <U.Field label="Peso" value={`${s.weight.toLocaleString()} kg`} mono />
        <U.Field label="Valor declarado" value={`$${s.value.toLocaleString()}`} mono />
        <U.Field label="ETD (zarpe)" value={s.etd || 'pendiente'} mono />
        <U.Field label="ETA (arribo)" value={s.eta || '—'} mono />
        <U.Field label="Progreso" value={`${s.progress}%`} mono />
      </div>

      {/* Consolidated receptions linked to this shipment */}
      <ConsolidatedReceptions shipmentId={s.id} />

      {/* Documents (hub central · adjuntos de esta transacción) */}
      <div>
        {window.DocsForTransaction
          ? <window.DocsForTransaction kind="embarque" id={s.id} goTo={window.__erpGoTo} />
          : (
            <>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>DOCUMENTOS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {window.ERPData.DOCUMENTS.filter(d => d.shipment === s.id).map(d => (
                  <div key={d.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', background: 'var(--bg-elevated)',
                    borderRadius: 'var(--r-md)',
                  }}>
                    <span style={{ color: 'var(--wine)' }}>{window.Icon.doc(18)}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{d.type} · <span style={{ color: 'var(--ink-mute)', fontFamily: 'var(--f-mono)' }}>{d.id}</span></div>
                      <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{d.issued} · {d.size}</div>
                    </div>
                    <U.Badge tone={d.status === 'firmado' ? 'success' : 'warning'} size="sm">{d.status}</U.Badge>
                    <button style={{ color: 'var(--ink-soft)', padding: 6 }}>{window.Icon.download(14)}</button>
                  </div>
                ))}
              </div>
            </>
          )}
      </div>

      {/* Financial summary */}
      {s.invoice && (
        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>FACTURACIÓN</div>
          <U.Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <code style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.invoice}</code>
                <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{s.billed ? 'Emitida' : 'Pendiente'} · {s.paid ? 'Pagada' : 'Por cobrar'}</div>
              </div>
              <U.Btn variant="ghost" size="sm" iconRight={window.Icon.arrowR(12)}>Ver factura</U.Btn>
            </div>
          </U.Card>
        </div>
      )}

      {/* Comments thread */}
      {window.CommentsThread && <window.CommentsThread recordId={s.id} recordType="embarque" />}

      {/* Profitability section */}
      <ShipmentProfitability shipment={s} />
    </div>
  );
}

// ── Profitability snapshot inside shipment detail ────────────
function ShipmentProfitability({ shipment }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const eco = D.shipmentEconomics(shipment);
  const isLoss = eco.margin < 0;
  const tone = isLoss ? 'danger' : eco.marginPct >= 25 ? 'success' : eco.marginPct >= 15 ? 'info' : 'warning';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="eyebrow eyebrow-wine">RENTABILIDAD</div>
        <button onClick={() => window.__erpGoTo?.('costing')} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)' }}>Ver módulo Costing →</button>
      </div>

      <U.Card padded style={{ background: isLoss ? 'var(--danger-bg)' : 'var(--bg-elevated)', borderLeft: `3px solid var(--${tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'info'})` }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Revenue</div>
            <div style={{ font: '800 18px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 6 }}>${(eco.revenue/1000).toFixed(1)}K</div>
          </div>
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Costo</div>
            <div style={{ font: '800 18px/1 var(--f-mono)', color: 'var(--warning)', marginTop: 6 }}>${(eco.totalCost/1000).toFixed(1)}K</div>
          </div>
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Margen $</div>
            <div style={{ font: '800 18px/1 var(--f-mono)', color: isLoss ? 'var(--danger)' : 'var(--success)', marginTop: 6 }}>${(eco.margin/1000).toFixed(1)}K</div>
          </div>
          <div>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Margen %</div>
            <div style={{ marginTop: 6 }}><U.Badge tone={tone} size="md">{eco.marginPct.toFixed(1)}%</U.Badge></div>
          </div>
        </div>
        {/* Mini breakdown bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { l: 'Flete naviera',  v: eco.freight,    c: '#7F0F1A' },
            { l: 'Aduana',         v: eco.customs,    c: '#A8323E' },
            { l: 'Transporte VE',  v: eco.transport,  c: '#C2747F' },
            { l: 'Handling',       v: eco.handling,   c: '#B8893A' },
            { l: 'Seguro',         v: eco.insurance,  c: '#2A6FDB' },
            { l: 'Comisión',       v: eco.commission, c: '#1F8A5B' },
            { l: 'Otros',          v: eco.other,      c: '#6B6B6B' },
          ].map(c => (
            <div key={c.l} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 80px', gap: 10, alignItems: 'center' }}>
              <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{c.l}</span>
              <div style={{ height: 6, background: 'var(--bg-surface)', borderRadius: 999 }}>
                <div style={{ height: '100%', width: `${(c.v / eco.totalCost) * 100}%`, background: c.c, borderRadius: 999 }} />
              </div>
              <span className="mono" style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>${c.v.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </U.Card>
    </div>
  );
}

// ── Shipment create form ──────────────────────────────────────
function ShipmentForm() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [type, setType] = useState('LCL DDP');
  const [origin, setOrigin] = useState('YIW');
  const [destination, setDestination] = useState('PBL');
  const [cbm, setCbm] = useState('');
  const [weight, setWeight] = useState('');
  const [client, setClient] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>TIPO DE SERVICIO</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['LCL DDP', "FCL 20'", "FCL 40'HC"].map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              padding: '14px 12px', textAlign: 'left',
              background: type === t ? 'var(--wine-tint)' : 'var(--bg-surface)',
              border: `1px solid ${type === t ? 'var(--wine)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
            }}>
              <div style={{ font: '700 13px/1.1 var(--f-sans)', color: type === t ? 'var(--wine)' : 'var(--ink)' }}>{t}</div>
              <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
                {t === 'LCL DDP' ? 'Carga suelta' : t.startsWith("FCL 20") ? '~28 CBM' : '~68 CBM'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <U.Select label="Cliente · Shipping Mark" value={client} onChange={(e) => setClient(e.target.value)} options={[
        { value: '', label: 'Selecciona cliente…' },
        ...D.CLIENTS.map(c => ({ value: c.markbox, label: `${c.markbox} · ${c.company}` })),
      ]} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <U.Select label="Origen" value={origin} onChange={(e) => setOrigin(e.target.value)}
          options={D.ORIGINS.map(o => ({ value: o.code, label: `${o.name} (${o.cn}) · ${o.port}` }))} />
        <U.Select label="Destino" value={destination} onChange={(e) => setDestination(e.target.value)}
          options={D.DESTINATIONS.map(d => ({ value: d.code, label: `${d.name}, ${d.state}` }))} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <U.Input label="Volumen" value={cbm} onChange={(e) => setCbm(e.target.value)} placeholder="0.0" suffix="CBM" mono />
        <U.Input label="Peso total" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0" suffix="kg" mono />
      </div>

      <U.Input label="Valor declarado" placeholder="0.00" prefix="$" suffix="USD" mono />
      <U.Input label="Naviera (si conocida)" placeholder="Ej: COSCO PISCES" />

      <div style={{ padding: '14px 16px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--info)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--info)' }}>{window.Icon.info(14)}</span>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            El embarque queda en estado <b>estimado</b>. Se actualiza automáticamente al recibir la mercadería en almacén CN.
          </div>
        </div>
      </div>
    </div>
  );
}

window.ModuleShipments = ModuleShipments;

// ── Consolidated receptions linked to a shipment ─────────────
function Tot({ label, value }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
      <span style={{ font: '700 10px/1 var(--f-mono)', color: 'var(--ink-mute)', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--wine)' }}>{value}</span>
    </span>
  );
}

function ConsolidatedReceptions({ shipmentId }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const linked = D.WAREHOUSE_CN.filter(r => r.shipment === shipmentId);
  const [expanded, setExpanded] = React.useState(null);
  const [lightbox, setLightbox] = React.useState(null);
  if (linked.length === 0) return null;

  // Mock de adjuntos de recepción China · en producción vienen del upload del almacén CN
  const photosFor = (r) => {
    const n = Math.min(6, Math.max(3, Math.round(r.boxes / 4)));
    const tones = ['#B0967A', '#6B5B43', '#8A7A5C', '#9B8463', '#7A6A4E', '#A89372'];
    return Array.from({ length: n }, (_, i) => ({
      id: r.id + '-ph-' + i,
      tone: tones[i % tones.length],
      label: r.warehouse + ' · ' + String(i + 1).padStart(2, '0'),
      kind: i === 0 ? 'Recepción' : i === 1 ? 'QC' : 'Caja',
    }));
  };
  const docsFor = (r) => ([
    { name: 'Packing list', code: 'PL-' + r.id.slice(-4), size: '64 KB' },
    { name: 'Factura proveedor', code: 'INV-' + r.id.slice(-4), size: '112 KB' },
  ]);

  return (
    <div>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>RECEPCIONES CONSOLIDADAS ({linked.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {linked.map(r => {
          const isOpen = expanded === r.id;
          const photos = photosFor(r);
          return (
            <div key={r.id} style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <button
                onClick={() => setExpanded(isOpen ? null : r.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 60px 70px 64px 24px',
                  gap: 10, padding: '10px 12px', width: '100%',
                  background: isOpen ? 'var(--wine-tint)' : 'transparent', border: 'none',
                  alignItems: 'center', textAlign: 'left', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'var(--wine-tint)'; }}
                onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
              >
                <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}</code>
                <div>
                  <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.supplier}</div>
                  <div style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 2 }}>{r.received} · {r.warehouse}</div>
                </div>
                <span style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--wine)', textAlign: 'right' }}>{window.Icon.box(11)} {photos.length}</span>
                <span style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>{r.boxes}cj</span>
                <span style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)', textAlign: 'right' }}>{r.cbm} CBM</span>
                <span style={{ color: 'var(--ink-mute)', textAlign: 'right', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 160ms' }}>{window.Icon.chevR(12)}</span>
              </button>

              {isOpen && (
                <div style={{ padding: '4px 14px 16px', borderTop: '1px solid var(--border)' }}>
                  {/* Fotos */}
                  <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '14px 0 10px' }}>
                    Fotos de recepción · {r.warehouse}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
                    {photos.map(ph => (
                      <button key={ph.id} onClick={() => setLightbox({ ...ph, reception: r })} style={{
                        position: 'relative', aspectRatio: '1/1', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, ' + ph.tone + ' 0%, rgba(0,0,0,0.4) 130%)', overflow: 'hidden', padding: 0,
                      }}>
                        <span style={{ position: 'absolute', top: 4, left: 4, font: '700 7px/1 var(--f-mono)', color: 'rgba(255,255,255,0.9)', background: 'rgba(0,0,0,0.35)', padding: '2px 4px', borderRadius: 2 }}>{ph.kind}</span>
                        <span style={{ position: 'absolute', bottom: 3, right: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                          <img src="assets/dtdcargo-isologo-mono-light.png" alt="" style={{ width: 9, height: 9, objectFit: 'contain', opacity: 0.85 }} />
                        </span>
                      </button>
                    ))}
                  </div>
                  {/* Docs de la recepción */}
                  <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '16px 0 10px' }}>
                    Documentos de la recepción
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {docsFor(r).map(d => (
                      <div key={d.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--wine)' }}>{window.Icon.doc(14)}</span>
                        <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink)', flex: 1 }}>{d.name}</span>
                        <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{d.code} · {d.size}</code>
                        <span style={{ color: 'var(--ink-soft)' }}>{window.Icon.download ? window.Icon.download(13) : '↓'}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, font: '500 10.5px/1.4 var(--f-mono)', color: 'var(--ink-mute)' }}>
                    Subido por almacén CN · {r.received} · {r.warehouse}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--success-bg)', borderRadius: 'var(--r-sm)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ color: 'var(--success)' }}>{window.Icon.check(12)}</span>
        <span style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
          Total consolidado: <b>{linked.reduce((s,r) => s+r.cbm, 0).toFixed(1)} CBM</b> · {linked.reduce((s,r) => s+r.boxes, 0)} cajas · {linked.reduce((s,r) => s+r.weight, 0).toLocaleString()} kg
        </span>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(11,20,40,0.85)',
          display: 'grid', placeItems: 'center', padding: 40, backdropFilter: 'blur(4px)',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: '100%' }}>
            <div style={{
              position: 'relative', aspectRatio: '4/3', borderRadius: 'var(--r-lg)', overflow: 'hidden',
              background: 'linear-gradient(135deg, ' + lightbox.tone + ' 0%, rgba(0,0,0,0.5) 140%)',
            }}>
              <div style={{ position: 'absolute', top: 14, left: 14, font: '600 11px/1 var(--f-mono)', color: '#fff', background: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 'var(--r-pill)' }}>{lightbox.kind} · {lightbox.label}</div>
              <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px 6px 6px', background: 'rgba(0,0,0,0.4)', borderRadius: 'var(--r-pill)', color: '#fff', font: '600 10.5px/1.2 var(--f-mono)' }}>
                <img src="assets/dtdcargo-isologo-mono-light.png" alt="" style={{ width: 20, objectFit: 'contain' }} />
                <span>{shipmentId}<br/><span style={{ opacity: 0.7, fontSize: 9 }}>{lightbox.reception.received} · {lightbox.reception.warehouse}</span></span>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.85)' }}>
                {lightbox.reception.supplier} · {lightbox.reception.id}
              </span>
              <button onClick={() => setLightbox(null)} style={{ font: '700 12px/1 var(--f-sans)', color: '#fff', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--r-sm)', padding: '8px 16px', cursor: 'pointer' }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── View toggle (Tabla | Kanban) ─────────────────────────────
function ViewToggle({ value, onChange }) {
  const opts = [
    { v: 'table', l: 'Tabla', i: 'menu' },
    { v: 'kanban', l: 'Kanban', i: 'dashboard' },
  ];
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      {opts.map(o => {
        const active = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--r-sm)',
            background: active ? 'var(--bg-surface)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--ink-soft)',
            font: `${active ? '700' : '500'} 12.5px/1 var(--f-sans)`,
            boxShadow: active ? 'var(--shadow-xs)' : 'none',
            transition: 'all var(--dur-fast) var(--ease)',
          }}>
            {window.Icon[o.i](13)} {o.l}
          </button>
        );
      })}
    </div>
  );
}

// ── Kanban view ──────────────────────────────────────────────
function KanbanView({ rows, onOpen }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  // Group by status, using STATUS_FLOW order
  const cols = D.STATUS_FLOW.map(status => ({
    status,
    rows: rows.filter(r => r.status === status),
  }));

  const [dragId, setDragId] = React.useState(null);
  const [dragOver, setDragOver] = React.useState(null);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8, margin: '0 -8px', padding: '0 8px 8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 280px)`, gap: 12, alignItems: 'flex-start' }}>
        {cols.map(col => {
          const tone = D.STATUS_TONE[col.status] || 'neutral';
          const isOver = dragOver === col.status;
          return (
            <div key={col.status}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.status); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={() => { setDragOver(null); setDragId(null); }}
              style={{ minWidth: 0 }}
            >
              {/* Column header */}
              <div style={{
                padding: '10px 12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md) var(--r-md) 0 0',
                borderBottom: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: tone === 'wine' ? 'var(--wine)' : tone === 'success' ? 'var(--success)' : tone === 'warning' ? 'var(--warning)' : tone === 'info' ? 'var(--info)' : tone === 'danger' ? 'var(--danger)' : 'var(--ink-mute)',
                  }} />
                  <span style={{ font: '700 11px/1.2 var(--f-sans)', color: 'var(--ink)', letterSpacing: '0.04em', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.status}</span>
                </div>
                <span style={{ padding: '2px 7px', borderRadius: 'var(--r-sm)', background: 'var(--bg-elevated)', font: '700 11px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{col.rows.length}</span>
              </div>

              {/* Column body */}
              <div style={{
                background: isOver ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderTop: 0,
                borderRadius: '0 0 var(--r-md) var(--r-md)',
                padding: 8, minHeight: 200,
                display: 'flex', flexDirection: 'column', gap: 8,
                transition: 'background var(--dur-fast) var(--ease)',
              }}>
                {col.rows.length === 0 ? (
                  <div style={{ padding: '20px 8px', textAlign: 'center', font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>—</div>
                ) : col.rows.map(s => (
                  <KanbanCard key={s.id} s={s} onOpen={() => onOpen(s)}
                    onDragStart={() => setDragId(s.id)}
                    onDragEnd={() => { setDragId(null); setDragOver(null); }}
                    isDragging={dragId === s.id}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ color: 'var(--info)' }}>{window.Icon.info(13)}</span>
        <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
          Arrastrá las tarjetas entre columnas para cambiar el estado. Los cambios disparan automáticamente las reglas de Mailing (cliente + interno) configuradas.
        </div>
      </div>
    </div>
  );
}

// ── Kanban card ──────────────────────────────────────────────
function KanbanCard({ s, onOpen, onDragStart, onDragEnd, isDragging }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      style={{
        background: 'var(--bg-surface)',
        border: `1px solid ${s.alert ? 'var(--warning)' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)',
        padding: '11px 12px',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        boxShadow: isDragging ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transition: 'opacity var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      {/* Top row: ID + alert */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
        {s.alert && <span style={{ color: 'var(--warning)' }} title={s.alert}>{window.Icon.warn(12)}</span>}
      </div>

      {/* Client */}
      <div>
        <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.clientName}</div>
        <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{s.client}</code>
      </div>

      {/* Route */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>
        <span>{D.origin(s.origin).name}</span>
        <span style={{ color: 'var(--ink-mute)' }}>→</span>
        <span>{D.dest(s.destination).name}</span>
      </div>

      {/* Bottom: type + cbm + eta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
        <U.Badge tone="neutral" size="sm">{s.type}</U.Badge>
        <span style={{ font: '700 10.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{s.cbm} CBM</span>
        {s.eta && <span style={{ marginLeft: 'auto', font: '600 10.5px/1 var(--f-mono)', color: s.alert ? 'var(--warning)' : 'var(--ink-soft)' }}>ETA {s.eta.slice(5)}</span>}
      </div>

      {/* Progress */}
      {s.progress > 0 && s.progress < 100 && (
        <U.Progress value={s.progress} tone={s.alert ? 'warning' : 'wine'} height={3} />
      )}
    </div>
  );
}
