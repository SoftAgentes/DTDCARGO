/* global React */
/* ── DTD ERP · Tarifas ──────────────────────────────────────── */

function ModuleRates({ view, setView }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [search, setSearch] = React.useState('');
  const [service, setService] = React.useState('all');
  const [drawerKind, setDrawerKind] = React.useState(null);

  React.useEffect(() => { if (view === 'create') setDrawerKind('create'); }, [view]);

  const filtered = React.useMemo(() => {
    let rows = D.RATES;
    if (service !== 'all') rows = rows.filter(r => r.service === service);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.id.toLowerCase().includes(q) || D.origin(r.origin).name.toLowerCase().includes(q) || D.dest(r.destination).name.toLowerCase().includes(q));
    }
    return rows;
  }, [search, service]);

  const columns = [
    { label: 'Servicio', key: 'service', render: (r) => <U.Badge tone="wine" size="sm">{r.service}</U.Badge>, width: 110 },
    { label: 'Origen', key: 'origin', render: (r) => (
      <div>
        <div style={{ font: '600 12.5px/1.2 var(--f-sans)' }}>{D.origin(r.origin).name}</div>
        <div style={{ font: '500 11px/1.2 "Noto Sans SC"', color: 'var(--ink-mute)', marginTop: 2 }}>{D.origin(r.origin).cn}</div>
      </div>
    )},
    { label: 'Destino', key: 'destination', render: (r) => (
      <div>
        <div style={{ font: '600 12.5px/1.2 var(--f-sans)' }}>{D.dest(r.destination).name}</div>
        <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{D.dest(r.destination).state}</div>
      </div>
    )},
    { label: 'Tarifa', key: 'rate', align: 'right', render: (r) => (
      <span className="mono" style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--wine)' }}>
        {r.perCBM ? `$${r.perCBM}/CBM` : `$${r.flatRate.toLocaleString()}/ctr`}
      </span>
    ), width: 140 },
    { label: 'Min charge', key: 'minCharge', align: 'right', render: (r) => <span className="mono" style={{ color: 'var(--ink-soft)' }}>{r.minCharge ? `$${r.minCharge}` : '—'}</span>, width: 100 },
    { label: 'Tránsito', key: 'transit', align: 'right', render: (r) => <span className="mono" style={{ font: '600 12.5px/1 var(--f-mono)' }}>{r.transit}d</span>, width: 80 },
    { label: 'Válida hasta', key: 'valid', render: (r) => <span className="mono" style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.valid}</span>, width: 110 },
    { label: '', key: '_a', render: () => (
      <div style={{ display: 'inline-flex', gap: 4 }}>
        <button style={{ width: 28, height: 28, color: 'var(--ink-soft)' }} title="Editar">{window.Icon.edit(13)}</button>
        <button style={{ width: 28, height: 28, color: 'var(--ink-soft)' }} title="Duplicar">{window.Icon.copy(13)}</button>
      </div>
    ), width: 70 },
  ];

  return (
    <div>
      <U.PageHeader
        title="Tarifas"
        subtitle="LCL por CBM · FCL tarifa cerrada. Editables por ruta. Vigentes hasta fin de año fiscal."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar tarifario</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => { setView('create'); setDrawerKind('create'); }}>Nueva tarifa</U.Btn>
          </>
        }
      />

      <CalcTariffCard />

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar ruta…"
        filters={
          <U.Select value={service} onChange={(e)=>setService(e.target.value)} style={{ width: 180 }} options={[
            { value: 'all', label: 'Todos los servicios' },
            'LCL DDP', "FCL 20'", "FCL 40'", "FCL 40'HC",
          ]} />
        }
      />

      {filtered.length === 0
        ? <U.EmptyState icon={window.Icon.tag(22)} title="Sin tarifas" body="Agrega tarifas por origen/destino. Se aplican automaticamente en el estimador." />
        : <U.Table columns={columns} rows={filtered} />
      }

      <U.Drawer
        open={drawerKind === 'create'}
        onClose={() => { setDrawerKind(null); setView('list'); }}
        title="Nueva tarifa"
        width={560}
        actions={
          <>
            <U.Btn variant="ghost" onClick={() => { setDrawerKind(null); setView('list'); }}>Cancelar</U.Btn>
            <U.Btn variant="primary">Crear tarifa</U.Btn>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <U.Select label="Servicio" options={['LCL DDP', "FCL 20'", "FCL 40'", "FCL 40'HC"]} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <U.Select label="Origen" options={D.ORIGINS.map(o => ({ value: o.code, label: o.name }))} />
            <U.Select label="Destino" options={D.DESTINATIONS.map(d => ({ value: d.code, label: d.name }))} />
          </div>
          <U.Input label="Tarifa por CBM" placeholder="800" prefix="$" suffix="USD" mono />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <U.Input label="Min charge" placeholder="380" prefix="$" mono />
            <U.Input label="Tránsito" placeholder="38" suffix="días" mono />
          </div>
          <U.Input label="Válida hasta" type="date" mono />
        </div>
      </U.Drawer>
    </div>
  );
}

// ── Tarifa base de la calculadora pública (LCL DDP) · puente al cliente ──
function CalcTariffCard() {
  const U = window.ERPUI;
  const DD = window.DTDData;
  const init = (DD && DD.getCbmTariff) ? DD.getCbmTariff() : { rate: 800, validUntil: '2026-12-31' };
  const [rate, setRate] = React.useState(String(init.rate));
  const [valid, setValid] = React.useState(init.validUntil || '');
  const [saved, setSaved] = React.useState(false);
  const expired = init.validUntil && init.validUntil < new Date().toISOString().slice(0, 10);
  function save() {
    if (!(DD && DD.setCbmTariff)) return;
    DD.setCbmTariff({ rate: parseFloat(rate) || init.rate, validUntil: valid || init.validUntil });
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  }
  return (
    <U.Card padded style={{ marginBottom: 16, borderLeft: '3px solid var(--wine)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 260px' }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 6 }}>TARIFA BASE · CALCULADORA PÚBLICA</div>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
            El <b>$/CBM</b> que toma la calculadora del cliente (LCL DDP puerta a puerta). Al guardar, se aplica en la calculadora con su fecha de vigencia.
          </div>
          {expired && <div style={{ marginTop: 6, font: '700 11px/1.3 var(--f-sans)', color: 'var(--danger)' }}>⚠ Vencida — actualiza la vigencia para que la calculadora la siga mostrando como vigente.</div>}
        </div>
        <div style={{ width: 160 }}><U.Input label="Tarifa por CBM" value={rate} onChange={(e) => setRate(e.target.value)} prefix="$" suffix="USD/CBM" mono /></div>
        <div style={{ width: 170 }}><U.Input label="Válida hasta" type="date" value={valid} onChange={(e) => setValid(e.target.value)} mono /></div>
        <U.Btn variant="primary" onClick={save}>{saved ? 'Guardado ✓' : 'Guardar'}</U.Btn>
      </div>
    </U.Card>
  );
}

window.ModuleRates = ModuleRates;