/* global React */
/* ── DTD ERP · Reportes & Analytics (deep dive) ─────────────── */

function ModuleReports({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const ivaOn = window.DTDConfig ? window.DTDConfig.useCfg('iva') : false;
  const [period, setPeriod] = React.useState('1A');

  const CATS = [
    { id: 'op',  label: 'Operacionales', icon: 'ship', reports: [
      { value: 'overview', label: 'Overview' },
      { value: 'routes',   label: 'Por ruta' },
      { value: 'carriers', label: 'Por naviera' },
      { value: 'services', label: 'Por servicio' },
    ]},
    { id: 'com', label: 'Comerciales', icon: 'users', reports: [
      { value: 'clients', label: 'Por cliente' },
      { value: 'agents',  label: 'Por agente' },
    ]},
    { id: 'con', label: 'Contables & financieros', icon: 'invoice', reports: [
      { value: 'pl',       label: 'Estado de resultados' },
      { value: 'aging',    label: 'Aging CxC / CxP' },
      ...(((window.DTDConfig && window.DTDConfig.get('iva'))) ? [{ value: 'iva', label: 'Posición IVA' }] : []),
      { value: 'cashflow', label: 'Facturado vs cobrado' },
    ]},
    { id: 'mix', label: 'Combinados', icon: 'spark', reports: [
      { value: 'rent-ruta',     label: 'Rentabilidad por ruta' },
      { value: 'margen-cliente', label: 'Margen por cliente' },
      { value: 'costo-cbm',     label: 'Costo por CBM' },
    ]},
    { id: 'build', label: 'Constructor', icon: 'cog', reports: [
      { value: 'builder', label: 'Armar reporte' },
    ]},
  ];
  const [cat, setCat] = React.useState('op');
  const [tab, setTab] = React.useState('overview');
  React.useEffect(() => { if (tab === 'iva' && !ivaOn) setTab('pl'); }, [ivaOn]);
  const activeCat = CATS.find(c => c.id === cat) || CATS[0];
  const selectCat = (id) => { const c = CATS.find(x => x.id === id); setCat(id); setTab(c.reports[0].value); };

  return (
    <div>
      <U.PageHeader
        title="Reportes & Analytics"
        subtitle="Performance operativa, comercial y contable de DTD-Cargo. Categorizado y exportable a Excel y PDF."
        actions={
          <>
            <U.Select value={period} onChange={(e)=>setPeriod(e.target.value)} style={{ width: 130 }} options={[
              { value: '1M', label: 'Último mes' },
              { value: '3M', label: 'Últimos 3 meses' },
              { value: '1A', label: 'Último año' },
              { value: 'YTD', label: 'YTD 2026' },
            ]} />
            <U.Btn variant="primary" icon={window.Icon.download(14)}>Exportar reporte</U.Btn>
          </>
        }
      />

      {/* Nivel 1 · categoría */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {CATS.map(c => {
          const active = cat === c.id;
          return (
            <button key={c.id} onClick={() => selectCat(c.id)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 16px',
              borderRadius: 'var(--r-md)', cursor: 'pointer',
              background: active ? 'var(--wine)' : 'var(--bg-surface)',
              color: active ? '#fff' : 'var(--ink-soft)',
              border: `1px solid ${active ? 'var(--wine)' : 'var(--border-strong)'}`,
              font: '600 13px/1 var(--f-sans)',
              transition: 'all var(--dur-fast) var(--ease)',
            }}>
              <span style={{ display: 'inline-flex', color: active ? '#fff' : 'var(--ink-mute)' }}>{I[c.icon]?.(15)}</span>
              {c.label}
              <span style={{ font: '700 10.5px/1 var(--f-mono)', color: active ? 'rgba(255,255,255,0.7)' : 'var(--ink-mute)' }}>{c.reports.length}</span>
            </button>
          );
        })}
      </div>

      {/* Nivel 2 · reporte dentro de la categoría */}
      <U.Tabs value={tab} onChange={setTab} items={activeCat.reports} style={{ marginBottom: 'var(--s-5)' }} />

      <div key={tab} style={{ animation: 'erp-route-in 200ms var(--ease)' }}>
        {tab === 'overview' && <ReportsOverview />}
        {tab === 'routes'   && <ReportsRoutes />}
        {tab === 'carriers' && <ReportsCarriers />}
        {tab === 'services' && <ReportsServices />}
        {tab === 'clients'  && <ReportsClients goTo={goTo} />}
        {tab === 'agents'   && <ReportsAgents />}
        {tab === 'pl'       && <ReportsPL />}
        {tab === 'aging'    && <ReportsAging goTo={goTo} />}
        {tab === 'iva'      && <ReportsIVA goTo={goTo} />}
        {tab === 'cashflow' && <ReportsFinance />}
        {tab === 'rent-ruta'      && <ReportsRentRuta goTo={goTo} />}
        {tab === 'margen-cliente' && <ReportsMargenCliente goTo={goTo} />}
        {tab === 'costo-cbm'      && <ReportsCostoCBM />}
        {tab === 'builder'        && <ReportsBuilder goTo={goTo} />}
      </div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────
function ReportsOverview() {
  const U = window.ERPUI;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Ingresos" value="$2.84M" delta="↑ 18% vs 2025" tone="success" />
        <U.KPI label="Embarques" value="412" delta="↑ 22%" tone="wine" />
        <U.KPI label="CBM movido" value="4,820" sub="metros cúbicos" tone="neutral" />
        <U.KPI label="On-time" value="99.4%" delta="↑ 0.6 pts" tone="success" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 'var(--s-6)' }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine">VOLUMEN MENSUAL</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', margin: '6px 0 18px' }}>Embarques · CBM · Revenue</div>
          <DualBarChart />
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>SPLIT POR PUERTO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { port: 'Puerto Cabello', pct: 42, n: 173 },
              { port: 'La Guaira',       pct: 22, n: 91 },
              { port: 'Maracaibo',       pct: 20, n: 82 },
              { port: 'Punto Fijo',      pct: 16, n: 66 },
            ].map(r => (
              <div key={r.port}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{r.port}</span>
                  <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.n} · {r.pct}%</span>
                </div>
                <U.Progress value={r.pct} tone="wine" height={8} />
              </div>
            ))}
          </div>
        </U.Card>
      </div>

      <U.Card padded style={{ marginBottom: 'var(--s-6)' }}>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 16 }}>DÍAS DE TRÁNSITO PROMEDIO</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { port: 'Maracaibo', days: 42, change: '−2d' },
            { port: 'Pto Cabello', days: 38, change: '−1d' },
            { port: 'La Guaira', days: 35, change: '−3d' },
            { port: 'Punto Fijo', days: 40, change: '0' },
          ].map(p => (
            <div key={p.port} style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 8 }}>{p.port}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ font: '900 32px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>{p.days}</span>
                <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>días</span>
              </div>
              <div style={{ marginTop: 8, font: '700 11.5px/1 var(--f-sans)', color: p.change.startsWith('−') ? 'var(--success)' : 'var(--ink-soft)' }}>
                {p.change.startsWith('−') ? '↓' : '—'} {p.change} vs Q1
              </div>
            </div>
          ))}
        </div>
      </U.Card>
    </div>
  );
}

// ── Por cliente ──────────────────────────────────────────────
function ReportsClients({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const sorted = [...D.CLIENTS].sort((a,b) => b.billed - a.billed);
  const total = sorted.reduce((s,c) => s + c.billed, 0);
  const top5 = sorted.slice(0, 5);
  const top5Pct = top5.reduce((s,c) => s + c.billed, 0) / total * 100;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Clientes activos" value={D.CLIENTS.filter(c=>c.status==='active').length} sub={`de ${D.CLIENTS.length} totales`} tone="wine" />
        <U.KPI label="Top 5 ingresan" value={`${top5Pct.toFixed(0)}%`} delta="del total facturado" tone="success" />
        <U.KPI label="Nuevos este Q" value="3" delta="onboarding completo" tone="info" />
        <U.KPI label="LTV promedio" value="$94K" delta="↑ 12%" tone="neutral" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <U.Card padded={false}>
          <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--border)' }}>
            <div className="eyebrow eyebrow-wine">RANKING POR FACTURACIÓN</div>
            <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Top 10 clientes · 2026</div>
          </div>
          <div>
            {sorted.slice(0, 10).map((c, i) => {
              const pct = (c.billed / sorted[0].billed) * 100;
              const tierColor = { Platinum: 'wine', Gold: 'warning', Silver: 'info', Bronze: 'neutral' };
              return (
                <div key={c.markbox}
                  onClick={() => goTo?.('clients', c.markbox, 'detail')}
                  style={{
                    display: 'grid', gridTemplateColumns: '30px 1fr 90px 70px 90px',
                    gap: 12, alignItems: 'center',
                    padding: '12px 18px',
                    borderTop: i > 0 ? '1px solid var(--border)' : 0,
                    cursor: goTo ? 'pointer' : 'default',
                    transition: 'background var(--dur-fast) var(--ease)',
                  }}
                  onMouseEnter={(e) => { if (goTo) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ font: '900 14px/1 var(--f-display)', color: i < 3 ? 'var(--wine)' : 'var(--ink-mute)' }}>{i + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
                    <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{c.markbox}</code>
                  </div>
                  <U.Badge tone={tierColor[c.tier]} size="sm">{c.tier}</U.Badge>
                  <span style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{c.shipments} env.</span>
                  <div>
                    <div style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${(c.billed/1000).toFixed(0)}K</div>
                    <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 999, marginTop: 6 }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--wine)', borderRadius: 999 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </U.Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>POR TIER</div>
            {[
              { tier: 'Platinum', n: 1,  rev: 412800, c: 'var(--wine)' },
              { tier: 'Gold',     n: 4,  rev: 754100, c: 'var(--warning)' },
              { tier: 'Silver',   n: 5,  rev: 367200, c: 'var(--info)' },
              { tier: 'Bronze',   n: 2,  rev: 57100, c: 'var(--ink-soft)' },
            ].map(t => (
              <div key={t.tier} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ font: '700 12px/1 var(--f-sans)', color: t.c }}>{t.tier} · {t.n}</span>
                  <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>${(t.rev/1000).toFixed(0)}K</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 999 }}>
                  <div style={{ width: `${(t.rev/754100)*100}%`, height: '100%', background: t.c, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </U.Card>

          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>POR SEGMENTO</div>
            {[
              { seg: 'Industrial',   n: 3, c: 'var(--wine)' },
              { seg: 'Mayorista',    n: 2, c: 'var(--info)' },
              { seg: 'Retail',       n: 2, c: 'var(--warning)' },
              { seg: 'Textil/Belleza/Tech', n: 4, c: 'var(--ink-soft)' },
              { seg: 'Servicios',    n: 1, c: 'var(--success)' },
            ].map(s => (
              <div key={s.seg} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: s.c, flexShrink: 0 }} />
                <span style={{ flex: 1, font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{s.seg}</span>
                <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{s.n}</span>
              </div>
            ))}
          </U.Card>
        </div>
      </div>
    </div>
  );
}

// ── Por agente comercial ─────────────────────────────────────
function ReportsAgents() {
  const U = window.ERPUI;
  const agents = [
    { name: 'Martina Acuña',  avatar: 'MA', quotes: 142, won: 84, revenue: 1240000, conv: 59, tickets: 84,  nps: 9.2 },
    { name: 'Diego Núñez',    avatar: 'DN', quotes:  98, won: 51, revenue:  820000, conv: 52, tickets: 51,  nps: 8.8 },
    { name: 'Carolina Méndez', avatar: 'CM', quotes:  42, won: 18, revenue:  280000, conv: 43, tickets: 22,  nps: 9.4 },
  ];
  const maxRev = Math.max(...agents.map(a => a.revenue));

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Cotizaciones" value={agents.reduce((s,a)=>s+a.quotes,0)} delta="+18 esta sem" tone="wine" />
        <U.KPI label="Ganadas" value={agents.reduce((s,a)=>s+a.won,0)} delta={`${Math.round(agents.reduce((s,a)=>s+a.won,0)/agents.reduce((s,a)=>s+a.quotes,0)*100)}% conv. promedio`} tone="success" />
        <U.KPI label="Revenue equipo" value={`$${(agents.reduce((s,a)=>s+a.revenue,0)/1e6).toFixed(2)}M`} delta="YTD" tone="info" />
        <U.KPI label="NPS comercial" value="9.1" delta="↑ 0.4 vs Q4" tone="success" />
      </div>

      <U.Card padded={false} style={{ marginBottom: 'var(--s-6)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow eyebrow-wine">PERFORMANCE POR AGENTE</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 80px 80px 80px 100px 70px', padding: '10px 18px', gap: 14, borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          {['', 'Agente', 'Cotiz.', 'Ganadas', 'Conv.', 'Revenue', 'NPS'].map(h => (
            <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {agents.map((a, i) => (
          <div key={a.name} style={{
            display: 'grid', gridTemplateColumns: '60px 1fr 80px 80px 80px 100px 70px',
            padding: '14px 18px', gap: 14, alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
          }}>
            <U.Avatar initials={a.avatar} color={i === 0 ? 'wine' : i === 1 ? 'info' : 'success'} size={40} />
            <div>
              <div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{a.name}</div>
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{a.tickets} clientes asignados</div>
            </div>
            <span className="mono" style={{ font: '700 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{a.quotes}</span>
            <span className="mono" style={{ font: '700 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{a.won}</span>
            <span className="mono" style={{ font: '700 14px/1 var(--f-mono)', color: a.conv >= 55 ? 'var(--success)' : 'var(--warning)' }}>{a.conv}%</span>
            <div>
              <span className="mono" style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>${(a.revenue/1000).toFixed(0)}K</span>
              <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 999, marginTop: 5 }}>
                <div style={{ width: `${(a.revenue/maxRev)*100}%`, height: '100%', background: 'var(--wine)', borderRadius: 999 }} />
              </div>
            </div>
            <U.Badge tone={a.nps >= 9 ? 'success' : 'info'} size="sm">{a.nps}</U.Badge>
          </div>
        ))}
      </U.Card>
    </div>
  );
}

// ── Por ruta ─────────────────────────────────────────────────
function ReportsRoutes() {
  const U = window.ERPUI;
  const routes = [
    { from: 'Yiwu',       to: 'Pto Cabello', shipments: 142, cbm: 1820, days: 38, revenue: 980000, rate: 800 },
    { from: 'Guangzhou',  to: 'Maracaibo',   shipments:  88, cbm: 1240, days: 42, revenue: 720000, rate: 880 },
    { from: 'Shenzhen',   to: 'La Guaira',   shipments:  72, cbm:  580, days: 34, revenue: 480000, rate: 790 },
    { from: 'Yiwu',       to: 'Punto Fijo',  shipments:  48, cbm:  720, days: 40, revenue: 380000, rate: 860 },
    { from: 'Shanghai',   to: 'Pto Cabello', shipments:  32, cbm:  280, days: 34, revenue: 220000, rate: 770 },
    { from: 'Guangzhou',  to: 'Pto Cabello', shipments:  30, cbm:  180, days: 36, revenue: 140000, rate: 780 },
  ];
  const max = Math.max(...routes.map(r => r.revenue));

  return (
    <div>
      <U.Card padded style={{ marginBottom: 'var(--s-6)' }}>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>MAPA DEL CORREDOR</div>
        <RoutesMap routes={routes} />
      </U.Card>

      <U.Card padded={false}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow eyebrow-wine">DETALLE POR RUTA</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 80px 80px 80px 1fr 90px', padding: '10px 18px', gap: 14, borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          {['Origen → Destino', 'Envíos', 'CBM', 'Días', 'Revenue', 'Tarifa'].map((h, i) => (
            <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: i >= 1 && i <= 3 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {routes.map((r, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1.5fr 80px 80px 80px 1fr 90px',
            padding: '14px 18px', gap: 14, alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.from}</span>
              <span style={{ color: 'var(--wine)' }}>→</span>
              <span style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.to}</span>
            </div>
            <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', textAlign: 'right' }}>{r.shipments}</span>
            <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', textAlign: 'right', color: 'var(--ink-soft)' }}>{r.cbm.toLocaleString()}</span>
            <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', textAlign: 'right', color: 'var(--ink-soft)' }}>{r.days}d</span>
            <div>
              <span className="mono" style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>${(r.revenue/1000).toFixed(0)}K</span>
              <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 999, marginTop: 5 }}>
                <div style={{ width: `${(r.revenue/max)*100}%`, height: '100%', background: 'var(--wine)', borderRadius: 999 }} />
              </div>
            </div>
            <span className="mono" style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--wine)', textAlign: 'right' }}>${r.rate}/CBM</span>
          </div>
        ))}
      </U.Card>
    </div>
  );
}

function RoutesMap({ routes }) {
  return (
    <svg viewBox="0 0 900 280" style={{ width: '100%', height: 'auto' }}>
      <path d="M30 80 L240 70 L260 130 L210 200 L130 220 L40 180 Z" fill="var(--bg-elevated)" stroke="var(--border)" />
      <path d="M620 70 L860 80 L870 170 L810 220 L700 210 L640 160 Z" fill="var(--bg-elevated)" stroke="var(--border)" />
      <text x="135" y="50" fontFamily="Archivo Black" fontSize="11" fill="var(--ink-soft)" textAnchor="middle" letterSpacing="0.16em">CHINA</text>
      <text x="755" y="50" fontFamily="Archivo Black" fontSize="11" fill="var(--ink-soft)" textAnchor="middle" letterSpacing="0.16em">VENEZUELA</text>

      {[
        { code: 'YIW', x: 220, y: 120, cn: '义乌', name: 'Yiwu' },
        { code: 'CAN', x: 145, y: 175, cn: '广州', name: 'Guangzhou' },
        { code: 'SZX', x: 175, y: 195, cn: '深圳', name: 'Shenzhen' },
        { code: 'SHA', x: 240, y: 95,  cn: '上海', name: 'Shanghai' },
      ].map(o => (
        <g key={o.code}>
          <circle cx={o.x} cy={o.y} r="5" fill="var(--ink)" />
          <text x={o.x} y={o.y - 9} fontFamily="Archivo Black" fontSize="9" fill="var(--ink)" textAnchor="middle">{o.name}</text>
          <text x={o.x} y={o.y + 14} fontFamily="Noto Sans SC" fontSize="8" fill="var(--ink-soft)" textAnchor="middle">{o.cn}</text>
        </g>
      ))}

      {[
        { code: 'PBL', x: 670, y: 140, name: 'Pto Cabello' },
        { code: 'LGU', x: 720, y: 150, name: 'La Guaira' },
        { code: 'MAR', x: 640, y: 110, name: 'Maracaibo' },
        { code: 'PFI', x: 680, y: 95,  name: 'Punto Fijo' },
      ].map(d => (
        <g key={d.code}>
          <circle cx={d.x} cy={d.y} r="5" fill="var(--wine)" />
          <text x={d.x + 10} y={d.y + 3} fontFamily="Archivo Black" fontSize="9" fill="var(--ink)">{d.name}</text>
        </g>
      ))}

      {/* Route arcs sized by volume */}
      {routes.map((r, i) => {
        const origins = { Yiwu: [220, 120], Guangzhou: [145, 175], Shenzhen: [175, 195], Shanghai: [240, 95] };
        const dests = { 'Pto Cabello': [670, 140], 'La Guaira': [720, 150], 'Maracaibo': [640, 110], 'Punto Fijo': [680, 95] };
        const [x1, y1] = origins[r.from] || [220, 120];
        const [x2, y2] = dests[r.to] || [670, 140];
        const cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 30 - i * 6;
        const w = Math.max(1, Math.min(4, r.shipments / 30));
        return <path key={i} d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
          fill="none" stroke="var(--wine)" strokeWidth={w} opacity={0.45 + (r.shipments / 200)} strokeLinecap="round" />;
      })}
    </svg>
  );
}

// ── Por naviera ──────────────────────────────────────────────
function ReportsCarriers() {
  const U = window.ERPUI;
  const carriers = [
    { name: 'COSCO',     shipments: 128, onTime: 99.6, avgDelay: 0.2, alliance: 'OCEAN', tone: 'success' },
    { name: 'MSC',       shipments: 96,  onTime: 98.4, avgDelay: 0.8, alliance: '2M',    tone: 'success' },
    { name: 'CMA CGM',   shipments: 82,  onTime: 99.1, avgDelay: 0.4, alliance: 'OCEAN', tone: 'success' },
    { name: 'ONE',       shipments: 54,  onTime: 97.8, avgDelay: 1.2, alliance: 'THE',   tone: 'info' },
    { name: 'EVERGREEN', shipments: 32,  onTime: 99.4, avgDelay: 0.3, alliance: 'OCEAN', tone: 'success' },
    { name: 'YANG MING', shipments: 20,  onTime: 96.2, avgDelay: 1.8, alliance: 'THE',   tone: 'warning' },
  ];
  const max = Math.max(...carriers.map(c => c.shipments));

  return (
    <div>
      <U.Card padded={false}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow eyebrow-wine">PERFORMANCE POR NAVIERA</div>
          <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>{carriers.length} navieras · {carriers.reduce((s,c) => s+c.shipments, 0)} embarques</div>
        </div>
        <div>
          {carriers.map((c, i) => (
            <div key={c.name} style={{
              display: 'grid', gridTemplateColumns: '160px 1fr 100px 90px 90px',
              gap: 16, alignItems: 'center', padding: '14px 18px',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <div>
                <div style={{ font: '900 14px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{c.name}</div>
                <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>{c.alliance} ALLIANCE</div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Embarques YTD</span>
                  <span style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{c.shipments}</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 999 }}>
                  <div style={{ width: `${(c.shipments/max)*100}%`, height: '100%', background: 'var(--wine)', borderRadius: 999 }} />
                </div>
              </div>
              <div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>On-time</div>
                <div style={{ font: '800 16px/1 var(--f-mono)', color: c.onTime >= 99 ? 'var(--success)' : c.onTime >= 98 ? 'var(--ink)' : 'var(--warning)', marginTop: 4 }}>{c.onTime}%</div>
              </div>
              <div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Demora prom.</div>
                <div style={{ font: '800 16px/1 var(--f-mono)', color: c.avgDelay < 1 ? 'var(--success)' : 'var(--warning)', marginTop: 4 }}>{c.avgDelay}d</div>
              </div>
              <U.Badge tone={c.tone} size="md">{c.tone === 'success' ? 'Recomendada' : c.tone === 'info' ? 'OK' : 'Revisar'}</U.Badge>
            </div>
          ))}
        </div>
      </U.Card>
    </div>
  );
}

// ── Por servicio (LCL vs FCL mix) ────────────────────────────
function ReportsServices() {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>MIX DE SERVICIOS · 2026</div>
        <Donut data={[
          { l: 'LCL DDP',   v: 248, c: 'var(--wine)' },
          { l: "FCL 20'",    v: 78,  c: 'var(--wine-soft)' },
          { l: "FCL 40'",    v: 62,  c: 'var(--ink)' },
          { l: "FCL 40'HC",  v: 24,  c: 'var(--ink-soft)' },
        ]} />
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>REVENUE POR SERVICIO</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { l: 'LCL DDP',  rev: 1240000, c: 'var(--wine)',      avgCBM: 6.8 },
            { l: "FCL 20'",   rev:  840000, c: 'var(--wine-soft)', avgCBM: 28 },
            { l: "FCL 40'",   rev:  620000, c: 'var(--ink)',       avgCBM: 56 },
            { l: "FCL 40'HC", rev:  140000, c: 'var(--ink-soft)',  avgCBM: 68 },
          ].map(s => (
            <div key={s.l}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)' }}>{s.l}</span>
                <span style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>${(s.rev/1000).toFixed(0)}K</span>
              </div>
              <div style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${(s.rev/1240000)*100}%`, height: '100%', background: s.c }} />
              </div>
              <div style={{ marginTop: 5, font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Promedio {s.avgCBM} CBM por embarque</div>
            </div>
          ))}
        </div>
      </U.Card>
    </div>
  );
}

// ── Finanzas (más profundo) ──────────────────────────────────
function ReportsFinance() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const totalBilled = D.INVOICES.reduce((s,i) => s+i.amount, 0);
  const totalCollected = D.INVOICES.reduce((s,i) => s+i.paid, 0);
  const totalOutstanding = D.INVOICES.reduce((s,i) => s+i.balance, 0);
  const totalOverdue = D.INVOICES.filter(i => i.status === 'vencida').reduce((s,i) => s+i.balance, 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Facturado" value={`$${(totalBilled/1000).toFixed(0)}K`} delta="YTD" tone="wine" />
        <U.KPI label="Cobrado" value={`$${(totalCollected/1000).toFixed(0)}K`} delta={`${Math.round(totalCollected/totalBilled*100)}% del facturado`} tone="success" />
        <U.KPI label="Por cobrar" value={`$${(totalOutstanding/1000).toFixed(0)}K`} sub="DSO ~38d" tone="warning" />
        <U.KPI label="Vencido" value={`$${(totalOverdue/1000).toFixed(0)}K`} delta="acción requerida" tone="danger" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16, marginBottom: 'var(--s-6)' }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 16 }}>FACTURADO VS COBRADO · 6 MESES</div>
          <CashflowChart />
        </U.Card>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>ENVEJECIMIENTO DE CARTERA</div>
          {[
            { range: 'Al día (0-15d)',    pct: 62, amount: 184500, c: 'var(--success)' },
            { range: '16-30d',            pct: 22, amount: 64800,  c: 'var(--info)' },
            { range: '31-60d',            pct: 12, amount: 38200,  c: 'var(--warning)' },
            { range: '61+d (vencido)',    pct:  4, amount: 14600,  c: 'var(--danger)' },
          ].map(r => (
            <div key={r.range} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{r.range}</span>
                <span style={{ font: '700 12px/1 var(--f-mono)', color: r.c }}>${(r.amount/1000).toFixed(1)}K</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 999 }}>
                <div style={{ width: `${r.pct}%`, height: '100%', background: r.c, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </U.Card>
      </div>
    </div>
  );
}

// ── Charts helpers ───────────────────────────────────────────
function DualBarChart() {
  const months = ['JUN','JUL','AGO','SEP','OCT','NOV','DIC','ENE','FEB','MAR','ABR','MAY'];
  const vol = [284,312,298,342,388,422,401,358,384,412,442,478];
  const rev = [180,220,198,248,282,312,296,244,274,308,332,358];
  const max = 500;
  const W = 720, H = 220, pad = 36;
  const bw = (W - pad * 2) / months.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto' }}>
      {[0,0.25,0.5,0.75,1].map((p,i) => (
        <line key={i} x1={pad} x2={W-pad} y1={H-p*(H-20)} y2={H-p*(H-20)}
          stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 4'} />
      ))}
      {months.map((m,i) => {
        const cbmH = (vol[i]/max)*(H-20);
        const revH = (rev[i]/max)*(H-20);
        const x = pad + i*bw;
        return (
          <g key={m}>
            <rect x={x+bw*0.18} y={H-cbmH} width={bw*0.30} height={cbmH} fill="var(--wine)" rx="2" />
            <rect x={x+bw*0.52} y={H-revH} width={bw*0.30} height={revH} fill="var(--wine-soft)" rx="2" opacity="0.7" />
            <text x={x+bw/2} y={H+18} fontFamily="Archivo" fontSize="9.5" fontWeight="600" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="0.06em">{m}</text>
          </g>
        );
      })}
      <g transform={`translate(${pad}, ${H + 38})`}>
        <rect width="10" height="10" fill="var(--wine)" rx="1" />
        <text x="16" y="9" fontFamily="Archivo" fontSize="10" fontWeight="600" fill="var(--ink-soft)">CBM movido</text>
        <rect x="100" width="10" height="10" fill="var(--wine-soft)" rx="1" opacity="0.7" />
        <text x="116" y="9" fontFamily="Archivo" fontSize="10" fontWeight="600" fill="var(--ink-soft)">Revenue ($K)</text>
      </g>
    </svg>
  );
}

function CashflowChart() {
  const months = ['DIC','ENE','FEB','MAR','ABR','MAY'];
  const billed   = [284, 296, 312, 348, 384, 412];
  const collected= [262, 282, 298, 332, 358, 372];
  const max = 450;
  const W = 540, H = 220, pad = 32;
  const xStep = (W - pad * 2) / (months.length - 1);
  const pathBilled = billed.map((v,i) => `${i===0?'M':'L'} ${pad+i*xStep} ${H-(v/max)*(H-20)}`).join(' ');
  const pathCollected = collected.map((v,i) => `${i===0?'M':'L'} ${pad+i*xStep} ${H-(v/max)*(H-20)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto' }}>
      {[0,0.25,0.5,0.75,1].map((p,i) => (
        <line key={i} x1={pad} x2={W-pad} y1={H-p*(H-20)} y2={H-p*(H-20)} stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 4'} />
      ))}
      <path d={pathBilled + ` L ${pad+(months.length-1)*xStep} ${H} L ${pad} ${H} Z`} fill="var(--wine)" opacity="0.1" />
      <path d={pathBilled} fill="none" stroke="var(--wine)" strokeWidth="2.5" />
      <path d={pathCollected} fill="none" stroke="var(--success)" strokeWidth="2.5" strokeDasharray="4 4" />
      {billed.map((v,i) => <circle key={'b'+i} cx={pad+i*xStep} cy={H-(v/max)*(H-20)} r="3" fill="var(--wine)" />)}
      {collected.map((v,i) => <circle key={'c'+i} cx={pad+i*xStep} cy={H-(v/max)*(H-20)} r="3" fill="var(--success)" />)}
      {months.map((m,i) => <text key={m} x={pad+i*xStep} y={H+18} fontFamily="Archivo" fontSize="10" fontWeight="600" fill="var(--ink-mute)" textAnchor="middle">{m}</text>)}
      <g transform={`translate(${pad}, ${H + 30})`}>
        <line x1="0" x2="10" y1="6" y2="6" stroke="var(--wine)" strokeWidth="2.5" />
        <text x="16" y="9" fontFamily="Archivo" fontSize="10" fontWeight="600" fill="var(--ink-soft)">Facturado</text>
        <line x1="86" x2="96" y1="6" y2="6" stroke="var(--success)" strokeWidth="2.5" strokeDasharray="4 4" />
        <text x="102" y="9" fontFamily="Archivo" fontSize="10" fontWeight="600" fill="var(--ink-soft)">Cobrado</text>
      </g>
    </svg>
  );
}

function Donut({ data }) {
  const total = data.reduce((s,d) => s+d.v, 0);
  const cx = 110, cy = 110, R = 95, r = 60;
  let acc = 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg viewBox="0 0 220 220" style={{ width: 220, height: 220 }}>
        {data.map((d, i) => {
          const a0 = (acc / total) * 2 * Math.PI - Math.PI / 2;
          acc += d.v;
          const a1 = (acc / total) * 2 * Math.PI - Math.PI / 2;
          const large = (a1 - a0) > Math.PI ? 1 : 0;
          const path = `M ${cx + R*Math.cos(a0)} ${cy + R*Math.sin(a0)}
                        A ${R} ${R} 0 ${large} 1 ${cx + R*Math.cos(a1)} ${cy + R*Math.sin(a1)}
                        L ${cx + r*Math.cos(a1)} ${cy + r*Math.sin(a1)}
                        A ${r} ${r} 0 ${large} 0 ${cx + r*Math.cos(a0)} ${cy + r*Math.sin(a0)}
                        Z`;
          return <path key={i} d={path} fill={d.c} />;
        })}
        <text x={cx} y={cy - 4} fontFamily="Archivo Black" fontSize="22" fill="var(--ink)" textAnchor="middle" letterSpacing="-0.02em">{total}</text>
        <text x={cx} y={cy + 14} fontFamily="Archivo" fontSize="10" fontWeight="600" fill="var(--ink-soft)" textAnchor="middle" letterSpacing="0.1em">EMBARQUES</text>
      </svg>
      <div style={{ flex: 1 }}>
        {data.map(d => (
          <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: d.c, flexShrink: 0 }} />
            <span style={{ flex: 1, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{d.l}</span>
            <span style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{d.v}</span>
            <span style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)', minWidth: 40, textAlign: 'right' }}>{Math.round(d.v/total*100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CONTABLES · cableados a la fuente real (ContabilidadData / Tesorería / FiscalData)
// ════════════════════════════════════════════════════════════════
function ReportsPL() {
  const U = window.ERPUI;
  const R = window.ERPRates;
  const C = window.ContabilidadData;
  const fmt = (n) => (R?.fmtUsd ? R.fmtUsd(n) : '$' + Math.round(n||0).toLocaleString('en-US'));
  if (!C) return <U.EmptyState icon={window.Icon.invoice(22)} title="Contabilidad no disponible" body="No se pudo leer el estado de resultados." />;
  const pl = C.calculatePL();
  const Row = ({ label, val, bold, tone = 'ink', pct }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 90px', gap: 14, padding: bold ? '12px 18px' : '8px 18px', borderTop: '1px solid var(--border)', background: bold ? 'var(--bg-elevated)' : 'transparent' }}>
      <span style={{ font: `${bold ? '800' : '500'} ${bold ? '13' : '12.5'}px/1.3 var(--f-${bold ? 'display' : 'sans'})`, color: `var(--${tone})`, textTransform: bold ? 'uppercase' : 'none', letterSpacing: bold ? '0.02em' : 0 }}>{label}</span>
      <span style={{ textAlign: 'right', font: `${bold ? '800' : '600'} 12.5px/1 var(--f-mono)`, color: `var(--${tone})` }}>{fmt(val)}</span>
      <span style={{ textAlign: 'right', font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{pct != null ? pct + '%' : ''}</span>
    </div>
  );
  const p = (n) => pl.totalIngresos ? Math.round((n / pl.totalIngresos) * 100) : 0;
  return (
    <U.Card padded={false}>
      <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">ESTADO DE RESULTADOS · MAY 2026 · FUENTE: CONTABILIDAD</div>
        <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>DTD-Cargo C.A. · moneda funcional USD</div>
      </div>
      <Row label="Ingresos operativos" val={pl.totalIngresos} bold tone="success" pct={100} />
      <Row label="Costos directos (CGS)" val={pl.totalCgs} tone="warning" pct={p(pl.totalCgs)} />
      <Row label="Utilidad bruta" val={pl.utilidadBruta} bold tone={pl.utilidadBruta >= 0 ? 'success' : 'danger'} pct={p(pl.utilidadBruta)} />
      <Row label="Gastos operativos" val={pl.totalGastos} tone="warning" pct={p(pl.totalGastos)} />
      <Row label="Utilidad operativa" val={pl.utilidadOperativa} bold tone={pl.utilidadOperativa >= 0 ? 'success' : 'danger'} pct={p(pl.utilidadOperativa)} />
      {pl.totalOtros !== 0 && <Row label="Otros resultados" val={pl.totalOtros} tone="info" pct={p(pl.totalOtros)} />}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 90px', gap: 14, padding: '14px 18px', borderTop: '2px solid var(--ink)', background: 'var(--bg-sidebar)', color: '#fff' }}>
        <span style={{ font: '900 14px/1 var(--f-display)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Utilidad neta</span>
        <span style={{ textAlign: 'right', font: '900 16px/1 var(--f-mono)', color: pl.utilidadNeta >= 0 ? '#7CE3A5' : 'var(--wine-soft)' }}>{fmt(pl.utilidadNeta)}</span>
        <span style={{ textAlign: 'right', font: '800 12px/1 var(--f-mono)', color: 'rgba(255,255,255,0.8)' }}>{p(pl.utilidadNeta)}%</span>
      </div>
    </U.Card>
  );
}

function ReportsAging({ goTo }) {
  const U = window.ERPUI;
  const R = window.ERPRates;
  const D = window.ERPData;
  const T = window.TesoreriaData;
  const fmt = (n) => (R?.fmtUsd ? R.fmtUsd(n) : '$' + Math.round(n||0).toLocaleString('en-US'));
  const TODAY = new Date('2026-05-24T00:00:00');
  const daysPast = (dateStr) => { try { return Math.round((TODAY - new Date(dateStr + 'T00:00:00')) / 86400000); } catch (e) { return 0; } };
  const bucketOf = (overdue) => overdue <= 0 ? 0 : overdue <= 30 ? 1 : overdue <= 60 ? 2 : 3;
  const LABELS = ['Corriente', '1–30 días', '31–60 días', '60+ días'];
  const TONES = ['success', 'info', 'warning', 'danger'];

  // CxC desde facturas con saldo
  const cxc = [0, 0, 0, 0];
  (D?.INVOICES || []).filter(i => (i.balance || 0) > 0).forEach(i => { cxc[bucketOf(daysPast(i.due))] += i.balance; });
  // CxP desde Tesorería
  const cxp = [0, 0, 0, 0];
  (T ? T.openPayables() : []).forEach(p => { const od = -1 * (T.daysUntil(p.dueDate)); cxp[bucketOf(od)] += T.outstandingUsd(p); });

  const Bars = ({ title, data, link }) => {
    const total = data.reduce((s, x) => s + x, 0) || 1;
    const overdue = data[1] + data[2] + data[3];
    return (
      <U.Card padded>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
          <div className="eyebrow eyebrow-wine">{title}</div>
          <button onClick={link} style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)' }}>Ver detalle →</button>
        </div>
        <div style={{ font: '900 26px/1 var(--f-display)', color: 'var(--ink)' }}>{fmt(total)}</div>
        <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: overdue > 0 ? 'var(--danger)' : 'var(--success)', marginTop: 4, marginBottom: 16 }}>
          {overdue > 0 ? `${fmt(overdue)} vencido (${Math.round(overdue/total*100)}%)` : 'Todo al día'}
        </div>
        <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', marginBottom: 14 }}>
          {data.map((v, i) => v > 0 && <div key={i} style={{ width: `${v/total*100}%`, background: `var(--${TONES[i]})` }} title={`${LABELS[i]}: ${fmt(v)}`} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 2, background: `var(--${TONES[i]})` }} />
              <span style={{ flex: 1, font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{LABELS[i]}</span>
              <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{fmt(v)}</span>
              <span style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', minWidth: 38, textAlign: 'right' }}>{Math.round(v/total*100)}%</span>
            </div>
          ))}
        </div>
      </U.Card>
    );
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <Bars title="CUENTAS POR COBRAR · AGING" data={cxc} link={() => goTo && goTo('invoices')} />
      <Bars title="CUENTAS POR PAGAR · AGING" data={cxp} link={() => goTo && goTo('tesoreria')} />
    </div>
  );
}

function ReportsIVA({ goTo }) {
  const U = window.ERPUI;
  const R = window.ERPRates;
  const F = window.FiscalData;
  const fmt = (n) => (R?.fmtUsd ? R.fmtUsd(n) : '$' + Math.round(n||0).toLocaleString('en-US'));
  if (!F) return <U.EmptyState icon={window.Icon.shield(22)} title="Fiscal no disponible" body="No se pudo leer la posición de IVA." />;
  const d = F.declaracionIVA();
  const ves = (n) => (R?.fmtBs ? R.fmtBs(R.usdToVes(n)) : '');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignContent: 'start' }}>
        <U.KPI label="Débito fiscal" value={fmt(d.debito)} delta="IVA en ventas" tone="success" icon={window.Icon.invoice(18)} />
        <U.KPI label="Crédito fiscal" value={fmt(d.credito)} delta="IVA en compras" tone="warning" icon={window.Icon.box(18)} />
        <U.KPI label="Cuota tributaria" value={fmt(d.cuota)} delta="débito − crédito" tone="info" icon={window.Icon.chart(18)} />
        <U.KPI label={d.aPagar > 0 ? 'IVA a pagar' : 'Excedente'} value={fmt(d.aPagar > 0 ? d.aPagar : d.excedente)} delta="luego de retenciones" tone={d.aPagar > 0 ? 'wine' : 'success'} icon={window.Icon.shield(18)} />
      </div>
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>POSICIÓN ANTE EL SENIAT · MAY 2026</div>
        <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink)' }}>
          La cuota tributaria del período es <b>{fmt(d.cuota)}</b>. Tras descontar <b>{fmt(d.retSoportadas)}</b> de retenciones de IVA que los clientes nos practicaron (75%), el resultado es <b>{d.aPagar > 0 ? `${fmt(d.aPagar)} a pagar` : `${fmt(d.excedente)} de excedente a favor`}</b>.
        </div>
        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          Equivalente en VES @ BCV: <b style={{ color: 'var(--ink)' }}>{ves(d.aPagar > 0 ? d.aPagar : d.excedente)}</b> · la declaración se presenta en bolívares.
        </div>
        <U.Btn variant="soft" size="sm" icon={window.Icon.arrowR(12)} style={{ marginTop: 14 }} onClick={() => goTo && goTo('contab')}>Ver libros fiscales completos</U.Btn>
      </U.Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// COMBINADOS · cruces operación × finanzas (revenue vs costo directo)
// ════════════════════════════════════════════════════════════════
// Ratio de costo directo por ruta (origen→destino). Lo demás es margen.
const _ROUTE_COST = { default: 0.70 };
function _shipAgg() {
  const D = window.ERPData;
  const ships = (D?.SHIPMENTS || []).filter(s => !['cotizado'].includes(s.status));
  return ships.map(s => {
    const revenue = s.value || 0;
    const ratio = _ROUTE_COST[`${s.origin}-${s.destination}`] || _ROUTE_COST.default;
    // pequeña variación determinística por id para que no sean todos iguales
    const jitter = ((s.id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 9) / 100; // 0–0.08
    const cost = Math.round(revenue * (ratio + jitter - 0.04));
    return { ...s, revenue, cost, margin: revenue - cost };
  });
}

function _MarginTable({ rows, label0, render0 }) {
  const U = window.ERPUI; const R = window.ERPRates;
  const fmt = (n) => (R?.fmtUsd ? R.fmtUsd(n) : '$' + Math.round(n||0).toLocaleString('en-US'));
  return (
    <U.Card padded={false}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 110px 110px 110px 90px', padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', gap: 14 }}>
        <span>{label0}</span>
        <span style={{ textAlign: 'right' }}>Ingreso</span>
        <span style={{ textAlign: 'right' }}>Costo dir.</span>
        <span style={{ textAlign: 'right' }}>Margen</span>
        <span style={{ textAlign: 'right' }}>%</span>
      </div>
      {rows.map((r, i) => {
        const pct = r.revenue ? (r.margin / r.revenue) * 100 : 0;
        const tone = pct >= 30 ? 'success' : pct >= 18 ? 'wine' : pct >= 8 ? 'warning' : 'danger';
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 110px 110px 110px 90px', padding: '11px 18px', gap: 14, alignItems: 'center', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            {render0(r)}
            <div style={{ textAlign: 'right', font: '600 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{fmt(r.revenue)}</div>
            <div style={{ textAlign: 'right', font: '600 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{fmt(r.cost)}</div>
            <div style={{ textAlign: 'right', font: '800 12.5px/1 var(--f-mono)', color: `var(--${tone})` }}>{fmt(r.margin)}</div>
            <div style={{ textAlign: 'right' }}><U.Badge tone={tone} size="sm">{pct.toFixed(0)}%</U.Badge></div>
          </div>
        );
      })}
    </U.Card>
  );
}

function ReportsRentRuta({ goTo }) {
  const U = window.ERPUI; const R = window.ERPRates; const D = window.ERPData;
  const fmt = (n) => (R?.fmtUsd ? R.fmtUsd(n) : '$' + Math.round(n||0).toLocaleString('en-US'));
  const nameO = (c) => (D.ORIGINS || []).find(o => o.code === c)?.name || c;
  const nameD = (c) => (D.DESTINATIONS || []).find(o => o.code === c)?.name || c;
  const map = {};
  _shipAgg().forEach(s => {
    const k = `${s.origin}→${s.destination}`;
    if (!map[k]) map[k] = { key: k, route: `${nameO(s.origin)} → ${nameD(s.destination)}`, revenue: 0, cost: 0, margin: 0, n: 0 };
    map[k].revenue += s.revenue; map[k].cost += s.cost; map[k].margin += s.margin; map[k].n += 1;
  });
  const rows = Object.values(map).sort((a, b) => b.margin - a.margin);
  const tot = rows.reduce((a, r) => ({ revenue: a.revenue + r.revenue, cost: a.cost + r.cost, margin: a.margin + r.margin }), { revenue: 0, cost: 0, margin: 0 });
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 14 }}>
        <U.KPI label="Ingreso total" value={fmt(tot.revenue)} delta={`${rows.length} rutas activas`} tone="success" icon={window.Icon.chart(18)} />
        <U.KPI label="Costo directo" value={fmt(tot.cost)} delta={`${tot.revenue ? Math.round(tot.cost/tot.revenue*100) : 0}% sobre ingreso`} tone="warning" icon={window.Icon.box(18)} />
        <U.KPI label="Margen bruto" value={fmt(tot.margin)} delta={`${tot.revenue ? (tot.margin/tot.revenue*100).toFixed(1) : 0}% margen`} tone="wine" icon={window.Icon.spark(18)} />
      </div>
      <_MarginTable rows={rows} label0="Ruta CN → VE" render0={(r) => (
        <div>
          <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.route}</div>
          <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{r.n} embarque{r.n === 1 ? '' : 's'}</div>
        </div>
      )} />
    </div>
  );
}

function ReportsMargenCliente({ goTo }) {
  const U = window.ERPUI; const D = window.ERPData;
  const map = {};
  _shipAgg().forEach(s => {
    const k = s.client;
    if (!map[k]) map[k] = { key: k, client: s.clientName || s.client, markbox: s.client, revenue: 0, cost: 0, margin: 0, n: 0 };
    map[k].revenue += s.revenue; map[k].cost += s.cost; map[k].margin += s.margin; map[k].n += 1;
  });
  const rows = Object.values(map).sort((a, b) => b.margin - a.margin);
  return (
    <_MarginTable rows={rows} label0="Cliente" render0={(r) => (
      <button onClick={() => goTo && goTo('clients', r.markbox)} style={{ textAlign: 'left', padding: 0 }}>
        <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--wine)' }}>{r.client}</div>
        <code style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)' }}>{r.markbox} · {r.n} env.</code>
      </button>
    )} />
  );
}

function ReportsCostoCBM() {
  const U = window.ERPUI; const R = window.ERPRates; const D = window.ERPData;
  const fmt = (n) => (R?.fmtUsd ? R.fmtUsd(n) : '$' + Math.round(n||0).toLocaleString('en-US'));
  const nameO = (c) => (D.ORIGINS || []).find(o => o.code === c)?.name || c;
  const nameD = (c) => (D.DESTINATIONS || []).find(o => o.code === c)?.name || c;
  const map = {};
  _shipAgg().forEach(s => {
    const k = `${s.origin}→${s.destination}`;
    if (!map[k]) map[k] = { key: k, route: `${nameO(s.origin)} → ${nameD(s.destination)}`, cbm: 0, revenue: 0, cost: 0 };
    map[k].cbm += s.cbm || 0; map[k].revenue += s.revenue; map[k].cost += s.cost;
  });
  const rows = Object.values(map).map(r => ({ ...r, costCbm: r.cbm ? r.cost / r.cbm : 0, revCbm: r.cbm ? r.revenue / r.cbm : 0 })).sort((a, b) => b.revCbm - a.revCbm);
  const maxRev = Math.max(...rows.map(r => r.revCbm), 1);
  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">RENDIMIENTO POR CBM · INGRESO Y COSTO POR METRO CÚBICO</div>
        <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Cuánto rinde cada CBM por ruta — clave para pricing de carga consolidada.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 110px 110px 1fr', padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', gap: 14 }}>
        <span>Ruta</span>
        <span style={{ textAlign: 'right' }}>CBM</span>
        <span style={{ textAlign: 'right' }}>$/CBM ing.</span>
        <span style={{ textAlign: 'right' }}>$/CBM costo</span>
        <span>Margen / CBM</span>
      </div>
      {rows.map((r, i) => {
        const mCbm = r.revCbm - r.costCbm;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 90px 110px 110px 1fr', padding: '11px 18px', gap: 14, alignItems: 'center', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.route}</span>
            <span style={{ textAlign: 'right', font: '600 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.cbm.toFixed(1)}</span>
            <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{fmt(r.revCbm)}</span>
            <span style={{ textAlign: 'right', font: '600 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{fmt(r.costCbm)}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 8, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.max(2, (mCbm / maxRev) * 100)}%`, background: 'var(--wine)', borderRadius: 999 }} />
              </div>
              <span style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)', minWidth: 54, textAlign: 'right' }}>{fmt(mCbm)}</span>
            </div>
          </div>
        );
      })}
    </U.Card>
  );
}

// ════════════════════════════════════════════════════════════════
// CONSTRUCTOR · armador interactivo de reportes
// ════════════════════════════════════════════════════════════════
function _routeName(s) {
  const D = window.ERPData;
  const o = (D.ORIGINS || []).find(x => x.code === s.origin)?.name || s.origin;
  const d = (D.DESTINATIONS || []).find(x => x.code === s.destination)?.name || s.destination;
  return `${o} → ${d}`;
}
const BUILDER_SOURCES = {
  shipments: { label: 'Embarques', icon: 'box', rows: () => (window.ERPData?.SHIPMENTS || []),
    dims: [ { k: 'clientName', l: 'Cliente' }, { k: '_route', l: 'Ruta', get: _routeName }, { k: 'status', l: 'Estado' }, { k: 'type', l: 'Tipo de servicio' } ],
    metrics: [ { k: 'count', l: 'Cantidad de embarques' }, { k: 'value', l: 'Valor total', agg: 'sum', money: true }, { k: 'cbm', l: 'CBM total', agg: 'sum' }, { k: 'cbm', l: 'CBM promedio', agg: 'avg' } ],
    filters: [ { k: 'status', l: 'Estado' }, { k: 'type', l: 'Tipo' } ] },
  invoices: { label: 'Facturas', icon: 'invoice', rows: () => (window.ERPData?.INVOICES || []),
    dims: [ { k: 'clientName', l: 'Cliente' }, { k: 'status', l: 'Estado' } ],
    metrics: [ { k: 'count', l: 'Cantidad' }, { k: 'amount', l: 'Monto total', agg: 'sum', money: true }, { k: 'balance', l: 'Saldo pendiente', agg: 'sum', money: true } ],
    filters: [ { k: 'status', l: 'Estado' } ] },
  clients: { label: 'Clientes', icon: 'users', rows: () => (window.ERPData?.CLIENTS || []),
    dims: [ { k: 'segment', l: 'Segmento' }, { k: 'city', l: 'Ciudad' }, { k: 'status', l: 'Estado' } ],
    metrics: [ { k: 'count', l: 'Cantidad' }, { k: 'billed', l: 'Facturado', agg: 'sum', money: true }, { k: 'shipments', l: 'Embarques', agg: 'sum' } ],
    filters: [ { k: 'segment', l: 'Segmento' }, { k: 'status', l: 'Estado' } ] },
  payables: { label: 'Cuentas por pagar', icon: 'cn', rows: () => (window.TesoreriaData?.PAYABLES || []),
    dims: [ { k: 'status', l: 'Estado' }, { k: 'currency', l: 'Moneda' }, { k: '_payee', l: 'Tipo de beneficiario', get: (p) => window.TesoreriaData?.PAYEE_TYPE[window.TesoreriaData?.getPayee(p.payee)?.type]?.label || '—' } ],
    metrics: [ { k: 'count', l: 'Cantidad' }, { k: 'amountUsd', l: 'Monto (USD)', agg: 'sum', money: true } ],
    filters: [ { k: 'status', l: 'Estado' }, { k: 'currency', l: 'Moneda' } ] },
};

function ReportsBuilder({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const R = window.ERPRates;
  const fmt = (n) => (R?.fmtUsd ? R.fmtUsd(n) : '$' + Math.round(n||0).toLocaleString('en-US'));

  const [sourceK, setSourceK] = React.useState('shipments');
  const src = BUILDER_SOURCES[sourceK];
  const [dimI, setDimI] = React.useState(0);
  const [metI, setMetI] = React.useState(0);
  const [chart, setChart] = React.useState('bars');
  const [filterVal, setFilterVal] = React.useState('all');
  const [filterFieldI, setFilterFieldI] = React.useState(0);
  const [saved, setSaved] = React.useState(() => { try { return JSON.parse(localStorage.getItem('dtd_saved_reports') || '[]'); } catch (e) { return []; } });

  // reset índices al cambiar de fuente
  const changeSource = (k) => { setSourceK(k); setDimI(0); setMetI(0); setFilterFieldI(0); setFilterVal('all'); };

  const dim = src.dims[dimI] || src.dims[0];
  const met = src.metrics[metI] || src.metrics[0];
  const filterField = (src.filters || [])[filterFieldI];
  const filterOpts = filterField ? ['all', ...Array.from(new Set(src.rows().map(r => r[filterField.k]).filter(Boolean)))] : ['all'];

  const result = React.useMemo(() => {
    let rows = src.rows();
    if (filterField && filterVal !== 'all') rows = rows.filter(r => r[filterField.k] === filterVal);
    const groups = {};
    rows.forEach(r => {
      const key = (dim.get ? dim.get(r) : r[dim.k]) ?? '—';
      if (!groups[key]) groups[key] = { key, n: 0, sum: 0 };
      groups[key].n += 1;
      if (met.k !== 'count') groups[key].sum += (Number(r[met.k]) || 0);
    });
    return Object.values(groups).map(g => ({ key: g.key, value: met.k === 'count' ? g.n : (met.agg === 'avg' ? (g.n ? g.sum / g.n : 0) : g.sum), n: g.n }))
      .sort((a, b) => b.value - a.value);
  }, [sourceK, dimI, metI, filterFieldI, filterVal]);

  const total = result.reduce((s, r) => s + r.value, 0);
  const maxV = Math.max(...result.map(r => r.value), 1);
  const fmtV = (v) => met.money ? fmt(v) : (met.agg === 'avg' ? v.toFixed(1) : Math.round(v).toLocaleString('es-VE'));
  const title = `${met.l} por ${dim.l} · ${src.label}`;

  const saveReport = () => {
    const rep = { id: 'R-' + Date.now().toString(36), title, sourceK, dimI, metI, chart, filterFieldI, filterVal };
    const next = [rep, ...saved].slice(0, 8);
    setSaved(next); try { localStorage.setItem('dtd_saved_reports', JSON.stringify(next)); } catch (e) {}
  };
  const applySaved = (r) => { setSourceK(r.sourceK); setDimI(r.dimI); setMetI(r.metI); setChart(r.chart); setFilterFieldI(r.filterFieldI || 0); setFilterVal(r.filterVal || 'all'); };
  const delSaved = (id) => { const next = saved.filter(s => s.id !== id); setSaved(next); try { localStorage.setItem('dtd_saved_reports', JSON.stringify(next)); } catch (e) {} };

  const selWrap = { display: 'flex', flexDirection: 'column', gap: 5 };
  const lblS = { font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Constructor */}
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>ARMÁ TU REPORTE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr)) auto', gap: 12, alignItems: 'end' }}>
          <label style={selWrap}><span style={lblS}>1 · Fuente</span>
            <U.Select value={sourceK} onChange={(e) => changeSource(e.target.value)} options={Object.entries(BUILDER_SOURCES).map(([k, v]) => ({ value: k, label: v.label }))} />
          </label>
          <label style={selWrap}><span style={lblS}>2 · Agrupar por</span>
            <U.Select value={String(dimI)} onChange={(e) => setDimI(+e.target.value)} options={src.dims.map((d, i) => ({ value: String(i), label: d.l }))} />
          </label>
          <label style={selWrap}><span style={lblS}>3 · Métrica</span>
            <U.Select value={String(metI)} onChange={(e) => setMetI(+e.target.value)} options={src.metrics.map((m, i) => ({ value: String(i), label: m.l }))} />
          </label>
          {src.filters && src.filters.length > 0 && (
            <label style={selWrap}><span style={lblS}>4 · Filtro</span>
              <U.Select value={String(filterFieldI)} onChange={(e) => { setFilterFieldI(+e.target.value); setFilterVal('all'); }} options={src.filters.map((f, i) => ({ value: String(i), label: f.l }))} />
            </label>
          )}
          {filterField && (
            <label style={selWrap}><span style={lblS}>{filterField.l} =</span>
              <U.Select value={filterVal} onChange={(e) => setFilterVal(e.target.value)} options={filterOpts.map(o => ({ value: o, label: o === 'all' ? 'Todos' : o }))} />
            </label>
          )}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: 3 }}>
            {[['bars', 'chart'], ['table', 'doc']].map(([v, ic]) => (
              <button key={v} onClick={() => setChart(v)} title={v === 'bars' ? 'Barras' : 'Tabla'} style={{ width: 34, height: 32, borderRadius: 'var(--r-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: chart === v ? 'var(--bg-surface)' : 'transparent', color: chart === v ? 'var(--wine)' : 'var(--ink-mute)', boxShadow: chart === v ? 'var(--shadow-xs)' : 'none' }}>{I[ic](15)}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <U.Btn variant="secondary" size="sm" icon={I.download(12)} onClick={() => {
            window.DTDExport && window.DTDExport.csv(
              `reporte-${sourceK}-${dim.l}`.replace(/\s+/g, '-').toLowerCase(),
              [dim.l, 'Registros', met.l],
              result.map(r => [r.key, r.n, met.money ? Math.round(r.value) : (met.agg === 'avg' ? r.value.toFixed(2) : r.value)])
            );
          }}>Exportar</U.Btn>
          <U.Btn variant="primary" size="sm" icon={I.plus(12)} onClick={saveReport}>Guardar reporte</U.Btn>
        </div>
      </U.Card>

      {/* Resultado */}
      <U.Card padded={false}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ font: '900 15px/1.1 var(--f-display)', color: 'var(--ink)' }}>{title}</div>
            <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{result.length} grupos · total {fmtV(total)}</div>
          </div>
          <U.Badge tone="wine" size="md">{met.k === 'count' ? 'Conteo' : met.agg === 'avg' ? 'Promedio' : 'Suma'}</U.Badge>
        </div>
        {result.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', font: '500 13px var(--f-sans)', color: 'var(--ink-mute)' }}>Sin datos para esta combinación.</div>
        ) : chart === 'bars' ? (
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.slice(0, 14).map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 110px', gap: 12, alignItems: 'center' }}>
                <span style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.key}>{r.key}</span>
                <div style={{ height: 22, background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(2, (r.value / maxV) * 100)}%`, background: i === 0 ? 'var(--wine)' : 'var(--wine-soft)', borderRadius: 'var(--r-sm)', transition: 'width var(--dur-slow) var(--ease)' }} />
                </div>
                <span style={{ textAlign: 'right', font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{fmtV(r.value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px', padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', gap: 12 }}>
              <span>{dim.l}</span><span style={{ textAlign: 'right' }}>Registros</span><span style={{ textAlign: 'right' }}>{met.l}</span>
            </div>
            {result.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 130px', padding: '10px 20px', gap: 12, alignItems: 'center', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                <span style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{r.key}</span>
                <span style={{ textAlign: 'right', font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{r.n}</span>
                <span style={{ textAlign: 'right', font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{fmtV(r.value)}</span>
              </div>
            ))}
          </div>
        )}
      </U.Card>

      {/* Reportes guardados */}
      {saved.length > 0 && (
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>REPORTES GUARDADOS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {saved.map(r => (
              <div key={r.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 10px 7px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)' }}>
                <button onClick={() => applySaved(r)} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{r.title}</button>
                <button onClick={() => delSaved(r.id)} style={{ color: 'var(--ink-mute)', display: 'inline-flex' }} title="Eliminar">{I.close(11)}</button>
              </div>
            ))}
          </div>
        </U.Card>
      )}
    </div>
  );
}

window.ModuleReports = ModuleReports;
