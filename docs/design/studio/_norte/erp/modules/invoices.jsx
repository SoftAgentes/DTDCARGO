/* global React */
/* ── DTD ERP · Facturación ──────────────────────────────────── */

const INV_COLS_DEFAULT = [
  { key: 'id',         visible: true },
  { key: 'clientName', visible: true },
  { key: 'shipment',   visible: true },
  { key: 'issued',     visible: true },
  { key: 'due',        visible: true },
  { key: 'amount',     visible: true },
  { key: 'balance',    visible: true },
  { key: 'status',     visible: true },
];

function ModuleInvoices({ goTo, view, setView, selectedId, setSelectedId }) {
  const stop = (e) => e.stopPropagation();
  const D = window.ERPData;
  const U = window.ERPUI;
  const [search, setSearch] = React.useState('');
  const [tab, setTab] = React.useState('all');
  const [drawerKind, setDrawerKind] = React.useState(null);
  const [colCfg, setColCfg] = U.useColumns('dtd-inv-cols-v1', INV_COLS_DEFAULT);
  const hideValues = U.useHideValues();
  const loadingTable = U.useFirstLoad('invoices');

  React.useEffect(() => {
    if (view === 'create') setDrawerKind('create');
    else if (selectedId && view === 'detail') setDrawerKind('detail');
  }, [view, selectedId]);

  const filtered = React.useMemo(() => {
    let rows = D.INVOICES;
    if (tab === 'pending') rows = rows.filter(i => i.balance > 0 && i.status !== 'vencida');
    if (tab === 'overdue') rows = rows.filter(i => i.status === 'vencida');
    if (tab === 'paid') rows = rows.filter(i => i.status === 'pagada');
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.id.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q));
    }
    return rows;
  }, [search, tab]);

  const total = D.INVOICES.reduce((s, i) => s + i.amount, 0);
  const outstanding = D.INVOICES.reduce((s, i) => s + i.balance, 0);
  const overdue = D.INVOICES.filter(i => i.status === 'vencida').reduce((s, i) => s + i.balance, 0);

  const statusTone = { pagada: 'success', emitida: 'info', parcial: 'warning', vencida: 'danger' };

  const detailRecord = D.INVOICES.find(i => i.id === selectedId);

  const columns = [
    { label: 'Factura', key: 'id', render: (r) => <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}</code>, width: 140 },
    { label: 'Cliente', key: 'clientName', render: (r) => (
      <button onClick={(e) => { stop(e); goTo('clients', r.client, 'detail'); }} style={{ textAlign: 'left', padding: 0 }}>
        <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color var(--dur-fast)' }}
          onMouseEnter={(e) => e.currentTarget.style.textDecorationColor = 'var(--wine)'}
          onMouseLeave={(e) => e.currentTarget.style.textDecorationColor = 'transparent'}
        >{r.clientName}</div>
        <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.client}</code>
      </button>
    )},
    { label: 'Embarque', key: 'shipment', render: (r) => (
      <button onClick={(e) => { stop(e); goTo('shipments', r.shipment, 'detail'); }} style={{ padding: 0 }}>
        <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)', textDecoration: 'underline', textDecorationColor: 'transparent', transition: 'text-decoration-color var(--dur-fast)' }}
          onMouseEnter={(e) => e.currentTarget.style.textDecorationColor = 'var(--wine)'}
          onMouseLeave={(e) => e.currentTarget.style.textDecorationColor = 'transparent'}
        >{r.shipment}</code>
      </button>
    ), width: 140 },
    { label: 'Emitida', key: 'issued', render: (r) => <span className="mono" style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.issued}</span>, width: 95 },
    { label: 'Vence', key: 'due', render: (r) => <span className="mono" style={{ font: '500 11.5px/1 var(--f-mono)', color: r.status === 'vencida' ? 'var(--danger)' : 'var(--ink-soft)' }}>{r.due}</span>, width: 95 },
    { label: 'Monto', key: 'amount', align: 'right', render: (r) => <span className="mono" style={{ font: '700 13px/1 var(--f-mono)' }}>{hideValues ? '•••' : `$${(r.amount/1000).toFixed(1)}K`}</span>, width: 80 },
    { label: 'Saldo', key: 'balance', align: 'right', render: (r) => <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', color: r.balance > 0 ? 'var(--wine)' : 'var(--ink-mute)' }}>{hideValues ? '•••' : `$${(r.balance/1000).toFixed(1)}K`}</span>, width: 80 },
    { label: 'Estado', key: 'status', render: (r) => <U.Badge tone={statusTone[r.status]} size="sm" dot>{r.status}</U.Badge>, width: 100 },
  ];
  const visibleColumns = U.applyColumns(columns, colCfg);

  return (
    <div>
      <U.PageHeader
        title="Facturación"
        subtitle="Estados de cuenta, facturas emitidas, vencimientos y conciliación. Integración con SENIAT y bancos."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => { setView('create'); setDrawerKind('create'); }}>Nueva factura</U.Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Facturado YTD" value={`$${(total/1000).toFixed(0)}K`} delta="+12% vs Q1" tone="success" icon={window.Icon.invoice(18)} />
        <U.KPI label="Por cobrar" value={`$${(outstanding/1000).toFixed(0)}K`} delta={`${D.INVOICES.filter(i=>i.balance>0).length} facturas`} tone="warning" icon={window.Icon.clock(18)} />
        <U.KPI label="Vencido" value={`$${(overdue/1000).toFixed(0)}K`} delta="acción requerida" tone="danger" icon={window.Icon.warn(18)} />
      </div>

      <U.Tabs value={tab} onChange={setTab} items={[
        { value: 'all', label: 'Todas', count: D.INVOICES.length },
        { value: 'pending', label: 'Por cobrar', count: D.INVOICES.filter(i=>i.balance>0 && i.status !== 'vencida').length },
        { value: 'overdue', label: 'Vencidas', count: D.INVOICES.filter(i=>i.status==='vencida').length },
        { value: 'paid', label: 'Pagadas', count: D.INVOICES.filter(i=>i.status==='pagada').length },
      ]} style={{ marginBottom: 'var(--s-5)' }} />

      <U.Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Buscar factura o cliente…" filters={<U.ColumnManager cfg={colCfg} setCfg={setColCfg} columns={columns} defaultCfg={INV_COLS_DEFAULT} />} />

      {filtered.length === 0 ? (
        loadingTable ? <U.LoadingRows rows={6} cols={visibleColumns.length} /> : <U.EmptyState icon={window.Icon.invoice(22)} title="Sin facturas en esta vista" body="Ajustá los filtros o emití una factura nueva." />
      ) : loadingTable ? (
        <U.LoadingRows rows={6} cols={visibleColumns.length} />
      ) : (
        <U.Table columns={visibleColumns} rows={filtered} onRowClick={(r) => { setSelectedId(r.id); setView('detail'); setDrawerKind('detail'); }} />
      )}

      <U.Drawer
        open={drawerKind === 'detail' && detailRecord}
        onClose={() => { setDrawerKind(null); setView('list'); setSelectedId(null); }}
        title={detailRecord?.id}
        subtitle={detailRecord ? `${detailRecord.clientName}` : ''}
        width={580}
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(13)}>PDF</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.mail(13)} onClick={() => {
              const client = window.ERPData.CLIENTS.find(c => c.markbox === detailRecord?.client);
              window.openQuickEmail?.({
                to: client?.email, template: 'm-06',
                ctx: { client, invoice: detailRecord, label: `Factura ${detailRecord?.id}` }
              });
            }}>Recordatorio</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.check(13)}>Registrar pago</U.Btn>
          </>
        }
      >
        {detailRecord && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <U.Card style={{ background: 'var(--ink)', color: '#fff', border: 0, padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ font: '600 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Monto total</div>
                  <div style={{ font: '900 32px/1 var(--f-display)', color: '#fff', marginTop: 6 }}>${detailRecord.amount.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '600 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Saldo</div>
                  <div style={{ font: '900 32px/1 var(--f-display)', color: detailRecord.balance > 0 ? 'var(--wine-soft)' : '#7CE3A5', marginTop: 6 }}>${detailRecord.balance.toLocaleString()}</div>
                </div>
              </div>
            </U.Card>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <U.Field label="Cliente" value={detailRecord.clientName} />
              <U.Field label="MARKBOX" value={detailRecord.client} mono />
              <U.Field label="Embarque" value={detailRecord.shipment} mono />
              <U.Field label="Estado" value={detailRecord.status} />
              <U.Field label="Emitida" value={detailRecord.issued} mono />
              <U.Field label="Vence" value={detailRecord.due} mono />
              <U.Field label="Pagado" value={`$${detailRecord.paid.toLocaleString()}`} mono />
              <U.Field label="Moneda" value={detailRecord.currency} />
            </div>
            {window.CommentsThread && <window.CommentsThread recordId={detailRecord.id} recordType="factura" />}
          </div>
        )}
      </U.Drawer>

      <U.Drawer
        open={drawerKind === 'create'}
        onClose={() => { setDrawerKind(null); setView('list'); }}
        title="Nueva factura"
        subtitle="Generá a partir de un embarque entregado o de forma manual"
        width={560}
        actions={
          <>
            <U.Btn variant="ghost" onClick={() => { setDrawerKind(null); setView('list'); }}>Cancelar</U.Btn>
            <U.Btn variant="secondary">Guardar borrador</U.Btn>
            <U.Btn variant="primary">Emitir factura</U.Btn>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <U.Select label="Embarque a facturar" options={[
            { value: '', label: 'Seleccioná embarque…' },
            ...D.SHIPMENTS.filter(s => !s.billed).map(s => ({ value: s.id, label: `${s.id} · ${s.clientName} · $${s.value.toLocaleString()}` })),
          ]} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <U.Input label="Fecha emisión" type="date" mono />
            <U.Input label="Vencimiento" type="date" mono />
          </div>
          <U.Input label="Monto" placeholder="0.00" prefix="$" suffix="USD" mono />
          <U.Input label="Notas" placeholder="Concepto, referencias internas…" />
        </div>
      </U.Drawer>
    </div>
  );
}

window.ModuleInvoices = ModuleInvoices;
