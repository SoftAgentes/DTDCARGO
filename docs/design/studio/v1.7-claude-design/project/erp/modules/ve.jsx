/* global React */
/* ── DTD ERP · Almacén VE (desconsolidación & entrega) ──────── */

function ModuleVE({ goTo, view, setView, selectedId, setSelectedId, currentUser }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [search, setSearch] = React.useState('');
  const [portFilter, setPortFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    const u = currentUser || window.__currentUser;
    let rows = D.WAREHOUSE_VE;
    if (u?.scope?.type === 'scoped' && u.scope.hubs.length > 0) {
      rows = rows.filter(r => u.scope.hubs.includes(r.port));
    }
    if (portFilter !== 'all') rows = rows.filter(r => r.port === portFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.id.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q) || r.shipment.toLowerCase().includes(q));
    }
    return rows;
  }, [search, portFilter, currentUser]);

  const statusTone = (s) => s.includes('entregado') ? 'success' : s.includes('aduana') ? 'warning' : s.includes('liberado') ? 'info' : 'neutral';

  const columns = [
    { label: 'ID', key: 'id', render: (r) => <code style={{ font: '800 11.5px/1 var(--f-mono)' }}>{r.id}</code>, width: 130 },
    { label: 'Embarque', key: 'shipment', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); goTo('shipments', r.shipment, 'detail'); }} style={{ padding: 0 }}>
        <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.shipment}</code>
      </button>
    ), width: 130 },
    { label: 'Cliente', key: 'clientName', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); goTo('clients', r.client, 'detail'); }} style={{ textAlign: 'left', padding: 0 }}>
        <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.clientName}</div>
        <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.client}</code>
      </button>
    )},
    { label: 'Puerto', key: 'port', render: (r) => <U.Badge tone="wine" size="sm">{D.dest(r.port).name}</U.Badge>, width: 130 },
    { label: 'Cajas', key: 'boxes', align: 'right', render: (r) => <span className="mono">{r.boxes}</span>, width: 60 },
    { label: 'CBM', key: 'cbm', align: 'right', render: (r) => <span className="mono" style={{ font: '700 12.5px/1 var(--f-mono)' }}>{r.cbm}</span>, width: 60 },
    { label: 'Recibido', key: 'received', render: (r) => <span className="mono" style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.received || '—'}</span>, width: 100 },
    { label: 'Entrega', key: 'delivery', render: (r) => <span className="mono" style={{ font: '500 11.5px/1 var(--f-mono)', color: r.delivery && r.delivery !== 'pendiente' ? 'var(--success)' : 'var(--ink-mute)' }}>{r.delivery || 'pendiente'}</span>, width: 100 },
    { label: 'Dirección final', key: 'address', render: (r) => <span style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{r.address}</span> },
    { label: 'Estado', key: 'status', render: (r) => <U.Badge tone={statusTone(r.status)} size="sm" dot>{r.status}</U.Badge>, width: 200 },
  ];

  return (
    <div>
      <U.PageHeader
        title="Almacén VE · Venezuela"
        subtitle="Recepción en puertos · trámites aduana SENIAT · desconsolidación · entrega DDP final."
        actions={<U.Btn variant="primary" icon={window.Icon.truck(14)}>Asignar reparto</U.Btn>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="En aduana VE" value={D.WAREHOUSE_VE.filter(r=>r.status.includes('aduana')).length} sub="trámite SENIAT" tone="warning" icon={window.Icon.shield(18)} />
        <U.KPI label="Listos retiro" value={D.WAREHOUSE_VE.filter(r=>r.status.includes('liberado')).length} sub="liberados" tone="info" icon={window.Icon.flag(18)} />
        <U.KPI label="En reparto" value={1} sub="DDP final" tone="wine" icon={window.Icon.truck(18)} />
        <U.KPI label="Entregados mes" value={D.WAREHOUSE_VE.filter(r=>r.status==='entregado').length} delta="POD firmado" tone="success" icon={window.Icon.check(18)} />
      </div>

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar embarque o cliente…"
        filters={
          <U.Select value={portFilter} onChange={(e)=>setPortFilter(e.target.value)} style={{ width: 200 }} options={[
            { value: 'all', label: 'Todos los puertos' },
            ...D.DESTINATIONS.map(d => ({ value: d.code, label: `${d.name}, ${d.state}` })),
          ]} />
        }
      />

      {filtered.length === 0
        ? <U.EmptyState icon={window.Icon.truck(22)} title="Sin recepciones en VE" body="Las cargas que arriban a puertos VE aparecen acá hasta su entrega final." />
        : <U.Table columns={columns} rows={filtered} />
      }
    </div>
  );
}

window.ModuleVE = ModuleVE;
