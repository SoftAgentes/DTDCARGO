/* global React */
/* ── DTD ERP · Cotizador ────────────────────────────────────── */

function ModuleQuotes({ goTo, view, setView, selectedId, setSelectedId }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [drawerKind, setDrawerKind] = React.useState(null);

  React.useEffect(() => {
    if (view === 'create') setDrawerKind('create');
    else if (selectedId && view === 'detail') setDrawerKind('detail');
  }, [view, selectedId]);

  const filtered = React.useMemo(() => {
    let rows = D.byTenant(D.QUOTES);
    if (status !== 'all') rows = rows.filter(q => q.status === status);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.id.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q));
    }
    return rows;
  }, [search, status]);

  const detailRecord = D.QUOTES.find(q => q.id === selectedId);

  const statusTone = { borrador: 'neutral', enviada: 'info', aceptada: 'success', rechazada: 'danger', vencida: 'warning' };

  const columns = [
    { label: 'ID', key: 'id', render: (r) => <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}</code>, width: 140 },
    { label: 'Cliente', key: 'clientName', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); goTo('clients', r.client, 'detail'); }} style={{ textAlign: 'left', padding: 0 }}>
        <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.clientName}</div>
        <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.client}</code>
      </button>
    )},
    { label: 'Tipo', key: 'type', render: (r) => <U.Badge tone="neutral" size="sm">{r.type}</U.Badge>, width: 90 },
    { label: 'Ruta', key: 'route', render: (r) => <span style={{ font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{D.origin(r.origin).name} → {D.dest(r.destination).name}</span> },
    { label: 'CBM', key: 'cbm', align: 'right', render: (r) => <span className="mono" style={{ font: '600 12.5px/1 var(--f-mono)' }}>{r.cbm}</span>, width: 70 },
    { label: 'Total', key: 'totalUSD', align: 'right', render: (r) => <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>${r.totalUSD.toLocaleString()}</span>, width: 100 },
    { label: 'Estado', key: 'status', render: (r) => <U.Badge tone={statusTone[r.status]} size="sm" dot>{r.status}</U.Badge>, width: 110 },
    { label: 'Válida', key: 'validUntil', render: (r) => <span style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.validUntil}</span>, width: 100 },
  ];

  return (
    <div>
      <U.PageHeader
        title="Cotizador"
        subtitle="LCL DDP a $800/CBM · FCL con tarifa cerrada. Cotizá en menos de 60 segundos."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => { setView('create'); setDrawerKind('create'); }}>Nueva cotización</U.Btn>
          </>
        }
      />

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por ID o cliente…"
        filters={
          <U.Select value={status} onChange={(e)=>setStatus(e.target.value)} style={{ width: 160 }} options={[
            { value: 'all', label: 'Todos los estados' },
            { value: 'borrador', label: 'Borradores' },
            { value: 'enviada', label: 'Enviadas' },
            { value: 'aceptada', label: 'Aceptadas' },
            { value: 'rechazada', label: 'Rechazadas' },
          ]} />
        }
      />

      {filtered.length === 0 ? (
        <U.EmptyState icon={window.Icon.calc(22)} title="No hay cotizaciones" body="Creá una cotización nueva. Las aceptadas se convierten automáticamente en embarques." action={<U.Btn variant="primary" onClick={() => { setView('create'); setDrawerKind('create'); }}>Nueva cotización</U.Btn>} />
      ) : (
        <U.Table columns={columns} rows={filtered} onRowClick={(r) => { setSelectedId(r.id); setView('detail'); setDrawerKind('detail'); }} />
      )}

      <U.Drawer
        open={drawerKind === 'create'}
        onClose={() => { setDrawerKind(null); setView('list'); }}
        title="Nueva cotización"
        subtitle="Calculá el total en vivo. Al enviarla queda registrada y se notifica al cliente."
        width={680}
        actions={
          <>
            <U.Btn variant="ghost" onClick={() => { setDrawerKind(null); setView('list'); }}>Cancelar</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.copy(13)}>Guardar borrador</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.mail(13)}>Enviar al cliente</U.Btn>
          </>
        }
      >
        <QuoteCalculator />
      </U.Drawer>

      <U.Drawer
        open={drawerKind === 'detail' && detailRecord}
        onClose={() => { setDrawerKind(null); setView('list'); setSelectedId(null); }}
        title={detailRecord?.id}
        subtitle={detailRecord ? `${detailRecord.clientName} · ${detailRecord.type}` : ''}
        width={620}
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(13)}>PDF</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.copy(13)}>Duplicar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.box(13)}>Convertir a embarque</U.Btn>
          </>
        }
      >
        {detailRecord && <QuoteDetail q={detailRecord} />}
      </U.Drawer>
    </div>
  );
}

function QuoteCalculator() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [type, setType] = React.useState('LCL DDP');
  const [origin, setOrigin] = React.useState('YIW');
  const [destination, setDestination] = React.useState('PBL');
  const [cbm, setCbm] = React.useState('3.4');
  const [boxes, setBoxes] = React.useState('4');
  const [length, setLength] = React.useState('60');
  const [width, setWidth] = React.useState('40');
  const [height, setHeight] = React.useState('50');
  const [weight, setWeight] = React.useState('450');
  const [embalaje, setEmbalaje] = React.useState('carton');
  const [rate, setRate] = React.useState('800');
  const [extraSubtotal, setExtraSubtotal] = React.useState(0);

  const numCbm = parseFloat(cbm) || 0;
  const numRate = parseFloat(rate) || 800;
  const embalajeCost = embalaje === 'carton' ? 0 : 60;
  const subtotal = type.startsWith('LCL') ? numCbm * numRate : (type === "FCL 20'" ? 3200 : 5400);
  const total = subtotal + embalajeCost + extraSubtotal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>SERVICIO</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['LCL DDP', "FCL 20'", "FCL 40'HC"].map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              padding: '12px 10px', textAlign: 'left',
              background: type === t ? 'var(--wine-tint)' : 'var(--bg-surface)',
              border: `1px solid ${type === t ? 'var(--wine)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
            }}>
              <div style={{ font: '700 12.5px/1.1 var(--f-sans)', color: type === t ? 'var(--wine)' : 'var(--ink)' }}>{t}</div>
              <div style={{ font: '600 11px/1.3 var(--f-mono)', color: type === t ? 'var(--wine)' : 'var(--ink-mute)', marginTop: 5 }}>
                {t === 'LCL DDP' ? '$800/CBM' : t.startsWith("FCL 20") ? '$3,200/ctr' : '$5,400/ctr'}
              </div>
            </button>
          ))}
        </div>
      </div>

      <window.ERPUI.SearchSelect label="Cliente · MARKBOX" placeholder="Buscá o creá un cliente…" createLabel="Crear nuevo cliente" quickCreateClient
        options={D.CLIENTS.map(c => ({ value: c.markbox, label: `${c.markbox} · ${c.company}`, sub: 'Cliente' }))} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <U.Select label="Origen" value={origin} onChange={(e)=>setOrigin(e.target.value)}
          options={D.ORIGINS.map(o => ({ value: o.code, label: `${o.name} (${o.cn})` }))} />
        <U.Select label="Destino" value={destination} onChange={(e)=>setDestination(e.target.value)}
          options={D.DESTINATIONS.map(d => ({ value: d.code, label: d.name }))} />
      </div>

      {type.startsWith('LCL') && (
        <>
          <div>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>DIMENSIONES POR CAJA (CM)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <U.Input label="Largo" value={length} onChange={(e)=>setLength(e.target.value)} mono suffix="cm" />
              <U.Input label="Ancho" value={width} onChange={(e)=>setWidth(e.target.value)} mono suffix="cm" />
              <U.Input label="Alto"  value={height} onChange={(e)=>setHeight(e.target.value)} mono suffix="cm" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <U.Input label="Peso total" value={weight} onChange={(e)=>setWeight(e.target.value)} mono suffix="kg" />
            <U.Input label="Cantidad de cajas" value={boxes} onChange={(e)=>setBoxes(e.target.value)} mono />
          </div>

          <div>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>EMBALAJE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { id: 'carton', label: 'Cartón (estándar)', extra: 0 },
                { id: 'paleta', label: 'Sobre paleta (palet)', extra: 60 },
                { id: 'madera', label: 'Caja de madera', extra: 60 },
              ].map(e => (
                <label key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', borderRadius: 'var(--r-md)',
                  background: 'var(--bg-surface)',
                  border: `1px solid ${embalaje === e.id ? 'var(--wine)' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}>
                  <input type="radio" name="embalaje" checked={embalaje === e.id} onChange={() => setEmbalaje(e.id)} style={{ accentColor: 'var(--wine)' }} />
                  <span style={{ flex: 1, font: '600 13px/1 var(--f-sans)', color: 'var(--ink)' }}>{e.label}</span>
                  {e.extra > 0 && <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine-soft)' }}>+${e.extra}</span>}
                </label>
              ))}
            </div>
          </div>

          <U.Input label="Tarifa por CBM" value={rate} onChange={(e)=>setRate(e.target.value)} prefix="$" suffix="USD/CBM" mono
            hint="Tarifa estándar LCL DDP: $800/CBM. Editá si tu cotización es distinta (FCL prorrateado, promo, etc.)" />
        </>
      )}

      {window.ERPUI.CatalogLines && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <window.ERPUI.CatalogLines title="Servicios adicionales" addLabel="Agregar servicio del catálogo"
            emptyHint="Sumá servicios del catálogo (despacho, seguro, almacenaje…) al flete. Cada uno toma su tarifa vigente."
            onChange={(lines, st) => setExtraSubtotal(st)} />
        </div>
      )}

      {/* Total */}
      <div style={{
        padding: '18px 20px', background: 'var(--ink)', color: '#fff',
        borderRadius: 'var(--r-lg)', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 13px/1 var(--f-sans)', color: 'rgba(255,255,255,0.75)' }}>
          <span>Subtotal flete</span>
          <span className="mono">${subtotal.toLocaleString()}</span>
        </div>
        {embalajeCost > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 13px/1 var(--f-sans)', color: 'rgba(255,255,255,0.75)' }}>
            <span>Embalaje</span>
            <span className="mono">+${embalajeCost}</span>
          </div>
        )}
        {extraSubtotal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', font: '500 13px/1 var(--f-sans)', color: 'rgba(255,255,255,0.75)' }}>
            <span>Servicios adicionales</span>
            <span className="mono">+${extraSubtotal.toLocaleString()}</span>
          </div>
        )}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '600 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>TOTAL DDP</div>
            <div style={{ font: '900 36px/1 var(--f-display)', color: '#fff', letterSpacing: '-0.02em', marginTop: 4 }}>${total.toLocaleString()}</div>
          </div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.55)', textAlign: 'right' }}>
            Incluye flete, aduana<br/>e impuestos<br/>
            <span style={{ color: 'var(--wine-soft)', fontWeight: 700 }}>Válida 30 días</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteDetail({ q }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <U.Card style={{ padding: 24, background: 'var(--ink)', color: '#fff', border: 0 }}>
        <div style={{ font: '600 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Total DDP</div>
        <div style={{ font: '900 42px/1 var(--f-display)', color: '#fff', letterSpacing: '-0.02em', marginTop: 8 }}>${q.totalUSD.toLocaleString()}</div>
        <div style={{ marginTop: 8, font: '500 12px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.6)' }}>Tarifa: {q.ratePerCBM ? `$${q.ratePerCBM}/CBM` : 'FCL tarifa cerrada'} · Válida hasta {q.validUntil}</div>
      </U.Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        <U.Field label="Cliente" value={q.clientName} />
        <U.Field label="MARKBOX" value={q.client} mono />
        <U.Field label="Servicio" value={q.type} />
        <U.Field label="Agente" value={q.agent} />
        <U.Field label="Origen" value={`${D.origin(q.origin).name} (${D.origin(q.origin).cn})`} />
        <U.Field label="Destino" value={D.dest(q.destination).name} />
        <U.Field label="Volumen" value={`${q.cbm} m³`} mono />
        <U.Field label="Peso" value={`${q.weight} kg`} mono />
        <U.Field label="Items" value={q.items} mono />
        <U.Field label="Creada" value={q.created} mono />
      </div>
    </div>
  );
}

window.ModuleQuotes = ModuleQuotes;
