/* global React */
/* ── DTD ERP · Dashboard module ─────────────────────────────── */

function ModuleDashboard({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [hideValues, setHideValues] = React.useState(false);
  const mask = (v) => hideValues ? '•••••' : v;

  const activeShipments = D.SHIPMENTS.filter(s => !['entregado', 'cotizado'].includes(s.status));

  return (
    <div>
      <U.PageHeader
        eyebrow="Operación · 23 May 2026"
        title="Buenos días, Carlos."
        subtitle="Tenés 24 embarques activos, 4 facturas por cobrar y 18 leads nuevos esta semana."
        actions={
          <>
            <button onClick={() => setHideValues(!hideValues)} title={hideValues ? 'Mostrar valores' : 'Ocultar valores'} style={{
              width: 36, height: 36, borderRadius: 'var(--r-md)',
              background: hideValues ? 'var(--wine-tint)' : 'var(--bg-elevated)',
              color: hideValues ? 'var(--wine)' : 'var(--ink-soft)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: hideValues ? '1px solid var(--wine)' : '1px solid var(--border)',
            }}>{hideValues ? '👁‍🗨' : window.Icon.eye(15)}</button>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => goTo('quotes', null, 'create')}>Nueva cotización</U.Btn>
          </>
        }
      />

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Embarques activos" value={mask(D.KPIS.shipmentsActive.value)} delta={hideValues ? '••••' : `↑ ${D.KPIS.shipmentsActive.delta} vs sem ant.`} tone="wine" icon={window.Icon.box(18)} />
        <U.KPI label="On-time delivery"  value={mask(D.KPIS.onTime.value)}         delta={hideValues ? '••••' : `↑ ${D.KPIS.onTime.delta}`}         tone="success" icon={window.Icon.check(18)} />
        <U.KPI label="Ingresos mes"      value={mask(D.KPIS.monthRevenue.value)}  delta={hideValues ? '••••' : `↑ ${D.KPIS.monthRevenue.delta}`}   tone="success" icon={window.Icon.chart(18)} />
        <U.KPI label="Leads nuevos"      value={mask(D.KPIS.newLeads.value)}      delta={hideValues ? '••••' : D.KPIS.newLeads.delta}              tone="info"    icon={window.Icon.spark(18)} />
        <U.KPI label="Facturas vencidas" value={mask(D.KPIS.invoicesDue.value)}   delta={hideValues ? '••••' : D.KPIS.invoicesDue.delta}           tone="warning" icon={window.Icon.invoice(18)} />
        <U.KPI label="CBM en tránsito"   value={mask(D.KPIS.cbmInTransit.value)}  delta={hideValues ? '••••' : D.KPIS.cbmInTransit.delta}          tone="neutral" icon={window.Icon.ship(18)} />
      </div>

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* LEFT — Active shipments + chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Chart card */}
          <U.Card padded>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <div className="eyebrow eyebrow-wine">ÚLTIMOS 12 MESES</div>
                <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 6 }}>Volumen embarcado · CBM</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['1M', '3M', '1A', 'YTD'].map(p => (
                  <button key={p} style={{
                    padding: '5px 9px', borderRadius: 'var(--r-sm)',
                    background: p === '1A' ? 'var(--wine-tint)' : 'transparent',
                    color: p === '1A' ? 'var(--wine)' : 'var(--ink-soft)',
                    font: '600 11.5px/1 var(--f-sans)',
                  }}>{p}</button>
                ))}
              </div>
            </div>
            <BarChart />
          </U.Card>

          {/* Active shipments preview */}
          <U.Card padded={false}>
            <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Embarques en curso</div>
                <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{activeShipments.length} activos · ordenados por ETA</div>
              </div>
              <button onClick={() => goTo('shipments')} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Ver todos {window.Icon.arrowR(11)}
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {activeShipments.slice(0, 6).map((s, i) => (
                <div key={s.id}
                  onClick={() => goTo('shipments', s.id, 'detail')}
                  style={{
                    display: 'grid', gridTemplateColumns: '140px 1fr 1fr 100px 88px',
                    gap: 14, padding: '14px 20px',
                    borderTop: i > 0 ? '1px solid var(--border)' : 0,
                    alignItems: 'center', cursor: 'pointer',
                    transition: 'background var(--dur-fast) var(--ease)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <code style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '0.02em' }}>{s.id}</code>
                  <div>
                    <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.clientName}</div>
                    <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{D.origin(s.origin).name} → {D.dest(s.destination).name}</div>
                  </div>
                  <div>
                    <U.Progress value={s.progress} tone={s.alert ? 'warning' : 'wine'} />
                    <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 5 }}>{s.progress}% · ETA {s.eta?.slice(5) || '—'}</div>
                  </div>
                  <U.StatusBadge status={s.status} size="sm" />
                  <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>${(s.value/1000).toFixed(0)}K</div>
                </div>
              ))}
            </div>
          </U.Card>
        </div>

        {/* RIGHT — alerts + recent activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Alerts */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>ATENCIÓN REQUERIDA</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: window.Icon.warn(14), tone: 'warning', t: 'ETA en riesgo · DTDU-419032', m: '+2 días estimados · Polar' },
                { icon: window.Icon.invoice(14), tone: 'danger', t: 'F-2026-0418 vencida hace 10d', m: 'Acindar · $84.200' },
                { icon: window.Icon.doc(14), tone: 'info', t: '2 documentos pendientes de firma', m: 'Tech Solutions · BL + Factura' },
                { icon: window.Icon.users(14), tone: 'wine', t: '3 leads sin asignar', m: 'Recibidos hoy del cotizador' },
              ].map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px',
                  background: `var(--${a.tone}-bg)`,
                  borderRadius: 'var(--r-md)',
                  borderLeft: `3px solid var(--${a.tone})`,
                  cursor: 'pointer',
                }}>
                  <span style={{ color: `var(--${a.tone})`, marginTop: 1 }}>{a.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '700 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{a.t}</div>
                    <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{a.m}</div>
                  </div>
                </div>
              ))}
            </div>
          </U.Card>

          {/* Recent activity */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>ACTIVIDAD RECIENTE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {D.NOTIFS.map((n, i) => (
                <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                    background: n.tone === 'wine' ? 'var(--wine)' : n.tone === 'success' ? 'var(--success)' : n.tone === 'warning' ? 'var(--warning)' : 'var(--info)',
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '600 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{n.t}</div>
                    <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{n.m}</div>
                  </div>
                </div>
              ))}
            </div>
          </U.Card>

          {/* Quick actions */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>ACCIONES RÁPIDAS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { l: 'Nueva cotización', i: 'calc',     to: 'quotes' },
                { l: 'Nuevo cliente',    i: 'users',    to: 'clients' },
                { l: 'Recepción CN',     i: 'warehouse',to: 'cn' },
                { l: 'Crear factura',    i: 'invoice',  to: 'invoices' },
              ].map(a => (
                <button key={a.l}
                  onClick={() => goTo(a.to, null, 'create')}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: '12px 14px', borderRadius: 'var(--r-md)',
                    background: 'var(--bg-elevated)',
                    textAlign: 'left',
                    transition: 'background var(--dur-fast) var(--ease)',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-tint)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                >
                  <span style={{ color: 'var(--wine)' }}>{window.Icon[a.i](16)}</span>
                  <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{a.l}</span>
                </button>
              ))}
            </div>
          </U.Card>
        </div>
      </div>
    </div>
  );
}

// ── Bar chart (SVG) ───────────────────────────────────────────
function BarChart() {
  const months = ['JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY'];
  const values = [284, 312, 298, 342, 388, 422, 401, 358, 384, 412, 442, 478];
  const max = Math.max(...values);
  const W = 640, H = 200, pad = 28;
  const bw = (W - pad * 2) / values.length;

  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto' }}>
      {/* Y grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line key={i} x1={pad} x2={W - pad} y1={H - p * (H - 20)} y2={H - p * (H - 20)}
          stroke="var(--border)" strokeWidth="1" strokeDasharray={i === 0 ? '0' : '2 4'} />
      ))}
      {values.map((v, i) => {
        const h = (v / max) * (H - 20);
        const x = pad + i * bw + bw * 0.15;
        const w = bw * 0.7;
        const y = H - h;
        const isLast = i === values.length - 1;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h}
              fill={isLast ? 'var(--wine)' : 'var(--wine-soft)'}
              opacity={isLast ? 1 : 0.55}
              rx="2" />
            {isLast && (
              <text x={x + w/2} y={y - 6} fontFamily="Archivo Black" fontSize="11" fill="var(--wine)" textAnchor="middle" letterSpacing="-0.02em">{v}</text>
            )}
            <text x={x + w/2} y={H + 18} fontFamily="Archivo" fontSize="9.5" fontWeight="600" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="0.08em">{months[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

window.ModuleDashboard = ModuleDashboard;
