/* global React */
/* ── DTD ERP · Documentos ───────────────────────────────────── */

function ModuleDocuments({ goTo, view, setView, selectedId, setSelectedId }) {
  const stop = (e) => e.stopPropagation();
  const D = window.ERPData;
  const U = window.ERPUI;
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const filtered = React.useMemo(() => {
    let rows = D.DOCUMENTS;
    if (typeFilter !== 'all') rows = rows.filter(d => d.type === typeFilter);
    if (statusFilter !== 'all') rows = rows.filter(d => d.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(d => d.id.toLowerCase().includes(q) || d.shipment.toLowerCase().includes(q) || d.clientName.toLowerCase().includes(q));
    }
    return rows;
  }, [search, typeFilter, statusFilter]);

  const typeIcon = { 'BL': 'ship', 'Packing List': 'box', 'Factura comercial': 'invoice', 'POD': 'check' };

  const columns = [
    { label: 'ID', key: 'id', render: (r) => <code style={{ font: '800 12px/1 var(--f-mono)' }}>{r.id}</code>, width: 130 },
    { label: 'Tipo', key: 'type', render: (r) => (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--wine)' }}>{window.Icon[typeIcon[r.type]]?.(14) || window.Icon.doc(14)}</span>
        <span style={{ font: '600 12.5px/1 var(--f-sans)' }}>{r.type}</span>
      </div>
    )},
    { label: 'Embarque', key: 'shipment', render: (r) => (
      <button onClick={(e) => { stop(e); goTo('shipments', r.shipment, 'detail'); }} style={{ padding: 0 }}>
        <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.shipment}</code>
      </button>
    ) },
    { label: 'Cliente', key: 'clientName', render: (r) => (
      <button onClick={(e) => { stop(e); goTo('clients', r.client, 'detail'); }} style={{ padding: 0 }}>
        <span style={{ font: '500 12.5px/1 var(--f-sans)', color: 'var(--wine)' }}>{r.clientName}</span>
      </button>
    ) },
    { label: 'Emitido', key: 'issued', render: (r) => <span className="mono" style={{ font: '500 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.issued}</span>, width: 95 },
    { label: 'Tamaño', key: 'size', align: 'right', render: (r) => <span style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{r.size}</span>, width: 80 },
    { label: 'Estado', key: 'status', render: (r) => <U.Badge tone={r.status === 'firmado' ? 'success' : 'warning'} size="sm" dot>{r.status}</U.Badge>, width: 130 },
    { label: '', key: '_a', render: () => (
      <div style={{ display: 'inline-flex', gap: 4 }}>
        <button style={{ width: 28, height: 28, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Ver">{window.Icon.eye(13)}</button>
        <button style={{ width: 28, height: 28, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Descargar">{window.Icon.download(13)}</button>
      </div>
    ), width: 70 },
  ];

  return (
    <div>
      <U.PageHeader
        title="Documentos"
        subtitle="BL, Packing List, Factura comercial, POD. Adjuntos por embarque y firma digital."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.upload(14)}>Subir documento</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)}>Generar BL</U.Btn>
          </>
        }
      />

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por ID, embarque o cliente…"
        filters={
          <>
            <U.Select value={typeFilter} onChange={(e)=>setTypeFilter(e.target.value)} style={{ width: 180 }} options={[
              { value: 'all', label: 'Todos los tipos' },
              'BL', 'Packing List', 'Factura comercial', 'POD',
            ]} />
            <U.Select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} style={{ width: 180 }} options={[
              { value: 'all', label: 'Todos los estados' },
              'firmado', 'pendiente firma',
            ]} />
          </>
        }
      />

      {filtered.length === 0
        ? <U.EmptyState icon={window.Icon.doc(22)} title="Sin documentos" body="Los documentos aparecen al adjuntarlos a un embarque." />
        : <U.Table columns={columns} rows={filtered} />
      }
    </div>
  );
}

window.ModuleDocuments = ModuleDocuments;
