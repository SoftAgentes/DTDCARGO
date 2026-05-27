/* global React */
/* ── DTD ERP · Reportes & Analytics (deep dive) ─────────────── */

function ModuleReports({ goTo }) {
  const U = window.ERPUI;
  const [period, setPeriod] = React.useState('1A');
  const [tab, setTab] = React.useState('overview');

  const tabs = [
    { value: 'overview',  label: 'Overview' },
    { value: 'clients',   label: 'Por cliente' },
    { value: 'agents',    label: 'Por agente' },
    { value: 'routes',    label: 'Por ruta' },
    { value: 'carriers',  label: 'Por naviera' },
    { value: 'services',  label: 'Por servicio' },
    { value: 'finance',   label: 'Finanzas' },
  ];

  return (
    <div>
      <U.PageHeader
        title="Reportes & Analytics"
        subtitle="Performance operativa, comercial y financiera de DTD-Cargo. Exportable a Excel y PDF."
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

      <U.Tabs value={tab} onChange={setTab} items={tabs} style={{ marginBottom: 'var(--s-5)' }} />

      <div key={tab} style={{ animation: 'erp-route-in 200ms var(--ease)' }}>
        {tab === 'overview' && <ReportsOverview />}
        {tab === 'clients'  && <ReportsClients goTo={goTo} />}
        {tab === 'agents'   && <ReportsAgents />}
        {tab === 'routes'   && <ReportsRoutes />}
        {tab === 'carriers' && <ReportsCarriers />}
        {tab === 'services' && <ReportsServices />}
        {tab === 'finance'  && <ReportsFinance />}
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

window.ModuleReports = ModuleReports;
