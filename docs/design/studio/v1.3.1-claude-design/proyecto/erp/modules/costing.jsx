/* global React */
/* ── DTD ERP · Costing & Margen ─────────────────────────────── */

const { useState: _kUseState, useMemo: _kUseMemo } = React;

function ModuleCosting({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [tab, setTab] = _kUseState('overview');
  const [sortBy, setSortBy] = _kUseState('margin-pct-desc');
  const [editorShip, setEditorShip] = _kUseState(null);
  const [currency, setCurrency] = _kUseState('USD'); // USD | VES
  const VES_RATE = 36.45; // BCV rate (from Admin → Tasas)

  // Currency conversion helper (for display)
  const fx = (usd) => currency === 'VES' ? usd * VES_RATE : usd;
  const fxLabel = (usd, divisor = 1000) => {
    const v = fx(usd) / divisor;
    return currency === 'VES' ? `Bs.${v.toFixed(0)}K` : `$${v.toFixed(0)}K`;
  };

  // Build economics for all shipments
  const data = _kUseMemo(() => D.SHIPMENTS.map(s => ({ ship: s, eco: D.shipmentEconomics(s) })), []);

  const totalRevenue = data.reduce((a, x) => a + x.eco.revenue, 0);
  const totalCost    = data.reduce((a, x) => a + x.eco.totalCost, 0);
  const totalMargin  = totalRevenue - totalCost;
  const avgMarginPct = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;
  const profitable   = data.filter(x => x.eco.margin > 0).length;
  const losing       = data.filter(x => x.eco.margin < 0).length;

  // Cost category breakdown (totals)
  const catTotals = data.reduce((a, x) => ({
    freight:    a.freight    + x.eco.freight,
    customs:    a.customs    + x.eco.customs,
    transport:  a.transport  + x.eco.transport,
    handling:   a.handling   + x.eco.handling,
    insurance:  a.insurance  + x.eco.insurance,
    commission: a.commission + x.eco.commission,
    other:      a.other      + x.eco.other,
  }), { freight: 0, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 });

  return (
    <div>
      <U.PageHeader
        title="Costing & Margen"
        subtitle="Rentabilidad real por embarque. Desglose de costos vs revenue. Identificá los rentables y los que dejan plata sobre la mesa."
        actions={
          <>
            <CurrencyToggle value={currency} onChange={setCurrency} rate={VES_RATE} />
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar análisis</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.edit(14)} onClick={() => setEditorShip(D.SHIPMENTS[0])}>Editar costos</U.Btn>
          </>
        }
      />

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Revenue total" value={fxLabel(totalRevenue)} delta="YTD 2026" tone="wine" icon={window.Icon.chart(18)} />
        <U.KPI label="Costo total" value={fxLabel(totalCost)} delta={`${Math.round(totalCost/totalRevenue*100)}% del revenue`} tone="warning" icon={window.Icon.invoice(18)} />
        <U.KPI label="Margen bruto" value={fxLabel(totalMargin)} delta={`${avgMarginPct.toFixed(1)}% promedio`} tone="success" icon={window.Icon.star(18)} />
        <U.KPI label="Embarques OK" value={`${profitable}/${data.length}`} delta={losing > 0 ? `${losing} en pérdida` : 'todos en verde'} tone={losing > 0 ? 'danger' : 'success'} icon={window.Icon.check(18)} />
      </div>

      <U.Tabs value={tab} onChange={setTab} items={[
        { value: 'overview',  label: 'Overview' },
        { value: 'ranking',   label: 'Ranking de embarques' },
        { value: 'breakdown', label: 'Desglose por categoría' },
        { value: 'routes',    label: 'Margen por ruta' },
        { value: 'templates', label: 'Templates por ruta' },
        { value: 'forecast',  label: 'Forecast pipeline' },
      ]} style={{ marginBottom: 'var(--s-5)' }} />

      {tab === 'overview'  && <OverviewSection data={data} catTotals={catTotals} totalCost={totalCost} totalRevenue={totalRevenue} totalMargin={totalMargin} avgMarginPct={avgMarginPct} />}
      {tab === 'ranking'   && <RankingSection data={data} sortBy={sortBy} setSortBy={setSortBy} goTo={goTo} onEdit={setEditorShip} />}
      {tab === 'breakdown' && <BreakdownSection catTotals={catTotals} totalCost={totalCost} />}
      {tab === 'routes'    && <RoutesMarginSection data={data} />}
      {tab === 'templates' && <TemplatesSection />}
      {tab === 'forecast'  && <ForecastSection />}

      <CostEditor ship={editorShip} onClose={() => setEditorShip(null)} />
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────
function OverviewSection({ data, catTotals, totalCost, totalRevenue, totalMargin, avgMarginPct }) {
  const U = window.ERPUI;
  const D = window.ERPData;
  const sorted = [...data].sort((a, b) => b.eco.margin - a.eco.margin);
  const top3 = sorted.slice(0, 3);
  const worst3 = sorted.slice(-3).reverse();

  // Period comparison (mock: vs prev quarter)
  const prev = { revenue: 484000, cost: 396000, margin: 88000, marginPct: 18.2 };
  const dRev = ((totalRevenue - prev.revenue) / prev.revenue) * 100;
  const dCost = ((totalCost - prev.cost) / prev.cost) * 100;
  const dMargin = ((totalMargin - prev.margin) / prev.margin) * 100;
  const dPct = avgMarginPct - prev.marginPct;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Period comparison */}
      <U.Card padded>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="eyebrow eyebrow-wine">COMPARATIVA · YTD 2026 VS Q4 2025</div>
            <div style={{ font: '900 14px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Performance vs período anterior</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <PeriodMetric label="Revenue"    cur={`$${(totalRevenue/1000).toFixed(0)}K`} prev={`$${(prev.revenue/1000).toFixed(0)}K`} delta={dRev}    suffix="%" positiveIsGood />
          <PeriodMetric label="Costo total" cur={`$${(totalCost/1000).toFixed(0)}K`}    prev={`$${(prev.cost/1000).toFixed(0)}K`}    delta={dCost}   suffix="%" positiveIsGood={false} />
          <PeriodMetric label="Margen $"    cur={`$${(totalMargin/1000).toFixed(0)}K`}  prev={`$${(prev.margin/1000).toFixed(0)}K`}  delta={dMargin} suffix="%" positiveIsGood />
          <PeriodMetric label="Margen %"    cur={`${avgMarginPct.toFixed(1)}%`}          prev={`${prev.marginPct.toFixed(1)}%`}        delta={dPct}    suffix=" pts" positiveIsGood />
        </div>
      </U.Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
      {/* Revenue vs Cost composition */}
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>COMPOSICIÓN · REVENUE VS COSTO</div>
        <CompositionChart catTotals={catTotals} totalCost={totalCost} totalRevenue={totalRevenue} />
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          Por cada <b style={{ color: 'var(--ink)' }}>$100</b> facturados, <b style={{ color: 'var(--warning)' }}>${(totalCost/totalRevenue*100).toFixed(0)}</b> se van en costos y <b style={{ color: 'var(--success)' }}>${((totalRevenue-totalCost)/totalRevenue*100).toFixed(0)}</b> quedan de margen bruto.
        </div>
      </U.Card>

      {/* Top & worst */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>🏆 TOP 3 MÁS RENTABLES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {top3.map(({ ship, eco }, i) => (
              <div key={ship.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px', gap: 10, alignItems: 'center', padding: '8px 10px', background: 'var(--success-bg)', borderRadius: 'var(--r-sm)' }}>
                <span style={{ font: '900 14px/1 var(--f-display)', color: 'var(--success)' }}>{i+1}</span>
                <div>
                  <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{ship.id}</code>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{ship.clientName}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--success)' }}>${(eco.margin/1000).toFixed(1)}K</div>
                  <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>{eco.marginPct.toFixed(0)}%</div>
                </div>
              </div>
            ))}
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>⚠️ 3 PEORES MÁRGENES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {worst3.map(({ ship, eco }, i) => {
              const isLoss = eco.margin < 0;
              return (
                <div key={ship.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px', gap: 10, alignItems: 'center', padding: '8px 10px', background: isLoss ? 'var(--danger-bg)' : 'var(--warning-bg)', borderRadius: 'var(--r-sm)' }}>
                  <span style={{ color: isLoss ? 'var(--danger)' : 'var(--warning)' }}>{window.Icon.warn(13)}</span>
                  <div>
                    <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{ship.id}</code>
                    <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{ship.clientName}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: '800 13px/1 var(--f-mono)', color: isLoss ? 'var(--danger)' : 'var(--warning)' }}>${(eco.margin/1000).toFixed(1)}K</div>
                    <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>{eco.marginPct.toFixed(0)}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </U.Card>
      </div>
    </div>
    </div>
  );
}

function PeriodMetric({ label, cur, prev, delta, suffix, positiveIsGood }) {
  const isPositive = delta > 0;
  const isGood = positiveIsGood ? isPositive : !isPositive;
  const tone = Math.abs(delta) < 0.1 ? 'neutral' : isGood ? 'success' : 'danger';
  const arrow = isPositive ? '↑' : '↓';
  const c = tone === 'success' ? 'var(--success)' : tone === 'danger' ? 'var(--danger)' : 'var(--ink-soft)';
  return (
    <div>
      <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '800 22px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 8, letterSpacing: '-0.01em' }}>{cur}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
        <span style={{ font: '700 12px/1 var(--f-mono)', color: c }}>{arrow} {Math.abs(delta).toFixed(1)}{suffix}</span>
        <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>vs {prev}</span>
      </div>
    </div>
  );
}

function CompositionChart({ catTotals, totalCost, totalRevenue }) {
  const margin = totalRevenue - totalCost;
  const totalH = 280;
  const W = 540;
  // Bar 1: Revenue (full) // Bar 2: Cost (composed) // Bar 3: Margin
  return (
    <svg viewBox={`0 0 ${W} ${totalH + 40}`} style={{ width: '100%', height: 'auto' }}>
      {/* Revenue */}
      <g transform="translate(60, 0)">
        <rect x="0" y="0" width="100" height={totalH} fill="var(--bg-elevated)" rx="4" />
        <rect x="0" y="0" width="100" height={totalH} fill="var(--wine)" rx="4" />
        <text x="50" y={totalH + 18} fontFamily="Archivo" fontSize="11" fontWeight="700" fill="var(--ink)" textAnchor="middle">REVENUE</text>
        <text x="50" y={totalH + 32} fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" fill="var(--wine)" textAnchor="middle">${(totalRevenue/1000).toFixed(0)}K</text>
      </g>

      {/* Cost stacked */}
      <g transform="translate(220, 0)">
        {(() => {
          const cats = [
            { l: 'Flete naviera', v: catTotals.freight,    c: '#7F0F1A' },
            { l: 'Aduana',        v: catTotals.customs,    c: '#A8323E' },
            { l: 'Transporte VE', v: catTotals.transport,  c: '#C2747F' },
            { l: 'Handling',      v: catTotals.handling,   c: '#B8893A' },
            { l: 'Seguro',        v: catTotals.insurance,  c: '#2A6FDB' },
            { l: 'Comisión',      v: catTotals.commission, c: '#1F8A5B' },
            { l: 'Otros',         v: catTotals.other,      c: '#6B6B6B' },
          ];
          let acc = 0;
          return cats.map(c => {
            const h = (c.v / totalRevenue) * totalH;
            const r = <rect key={c.l} x="0" y={acc} width="100" height={h} fill={c.c} />;
            acc += h;
            return r;
          });
        })()}
        <text x="50" y={totalH + 18} fontFamily="Archivo" fontSize="11" fontWeight="700" fill="var(--ink)" textAnchor="middle">COSTOS</text>
        <text x="50" y={totalH + 32} fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" fill="var(--warning)" textAnchor="middle">${(totalCost/1000).toFixed(0)}K</text>
      </g>

      {/* Margin */}
      <g transform="translate(380, 0)">
        {(() => {
          const mH = (margin / totalRevenue) * totalH;
          return (
            <>
              <rect x="0" y={totalH - mH} width="100" height={mH} fill="var(--success)" rx="4" />
              <rect x="0" y="0" width="100" height={totalH - mH} fill="var(--bg-elevated)" />
            </>
          );
        })()}
        <text x="50" y={totalH + 18} fontFamily="Archivo" fontSize="11" fontWeight="700" fill="var(--ink)" textAnchor="middle">MARGEN</text>
        <text x="50" y={totalH + 32} fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" fill="var(--success)" textAnchor="middle">${(margin/1000).toFixed(0)}K</text>
      </g>

      {/* Legend */}
      <g transform={`translate(60, ${totalH + 50})`}>
        <text x="0" y="0" fontFamily="Archivo" fontSize="9" fontWeight="700" fill="var(--ink-soft)" letterSpacing="0.1em">CATEGORÍAS DE COSTO →</text>
      </g>
    </svg>
  );
}

// ── Ranking ───────────────────────────────────────────────────
function RankingSection({ data, sortBy, setSortBy, goTo, onEdit }) {
  const U = window.ERPUI;
  const D = window.ERPData;
  const sorted = [...data].sort((a, b) => {
    if (sortBy === 'margin-pct-desc')   return b.eco.marginPct - a.eco.marginPct;
    if (sortBy === 'margin-pct-asc')    return a.eco.marginPct - b.eco.marginPct;
    if (sortBy === 'margin-abs-desc')   return b.eco.margin - a.eco.margin;
    if (sortBy === 'revenue-desc')      return b.eco.revenue - a.eco.revenue;
    return 0;
  });

  return (
    <U.Card padded={false}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="eyebrow eyebrow-wine">{sorted.length} EMBARQUES · ORDENADOS POR {sortBy.includes('pct') ? 'MARGEN %' : sortBy.includes('abs') ? 'MARGEN $' : 'REVENUE'}</div>
        <U.Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 220 }} options={[
          { value: 'margin-pct-desc', label: 'Margen % · mayor primero' },
          { value: 'margin-pct-asc',  label: 'Margen % · menor primero' },
          { value: 'margin-abs-desc', label: 'Margen $ · mayor primero' },
          { value: 'revenue-desc',    label: 'Revenue · mayor primero' },
        ]} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 100px 100px 100px 110px', padding: '10px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
        {['ID', 'Cliente · Ruta', 'Revenue', 'Costo', 'Margen $', 'Margen %'].map((h, i) => (
          <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {sorted.map(({ ship, eco }, i) => {
        const isLoss = eco.margin < 0;
        const isGood = eco.marginPct >= 25;
        return (
          <button key={ship.id}
            onClick={() => goTo?.('shipments', ship.id, 'detail')}
            style={{
              display: 'grid', gridTemplateColumns: '140px 1fr 100px 100px 100px 110px',
              padding: '12px 18px', gap: 14, alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
              width: '100%', textAlign: 'left', cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{ship.id}</code>
            <div>
              <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{ship.clientName}</div>
              <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{D.origin(ship.origin).name} → {D.dest(ship.destination).name} · {ship.type}</div>
            </div>
            <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${(eco.revenue/1000).toFixed(1)}K</span>
            <span className="mono" style={{ font: '600 12px/1 var(--f-mono)', color: 'var(--warning)', textAlign: 'right' }}>${(eco.totalCost/1000).toFixed(1)}K</span>
            <span className="mono" style={{ font: '800 13px/1 var(--f-mono)', color: isLoss ? 'var(--danger)' : 'var(--success)', textAlign: 'right' }}>${(eco.margin/1000).toFixed(1)}K</span>
            <div style={{ textAlign: 'right' }}>
              <U.Badge tone={isLoss ? 'danger' : isGood ? 'success' : eco.marginPct >= 15 ? 'info' : 'warning'} size="md">
                {eco.marginPct.toFixed(1)}%
              </U.Badge>
              <button onClick={(e) => { e.stopPropagation(); onEdit?.(ship); }} style={{ marginLeft: 6, color: 'var(--ink-soft)', padding: 4 }} title="Editar costos">{window.Icon.edit(12)}</button>
            </div>
          </button>
        );
      })}
    </U.Card>
  );
}

// ── Breakdown por categoría ──────────────────────────────────
function BreakdownSection({ catTotals, totalCost }) {
  const U = window.ERPUI;
  const cats = [
    { l: 'Flete naviera',  k: 'freight',    c: '#7F0F1A', desc: 'Pago directo a COSCO/MSC/CMA' },
    { l: 'Aduana SENIAT',  k: 'customs',    c: '#A8323E', desc: 'Aranceles, IVA, IGTF, agente aduanal' },
    { l: 'Transporte VE',  k: 'transport',  c: '#C2747F', desc: 'Última milla desde puerto al cliente' },
    { l: 'Handling CN',    k: 'handling',   c: '#B8893A', desc: 'Recepción, consolidación, almacenaje' },
    { l: 'Seguro de carga',k: 'insurance',  c: '#2A6FDB', desc: 'Cobertura por daño/pérdida' },
    { l: 'Comisión comercial', k: 'commission', c: '#1F8A5B', desc: 'Variable según agente (Martina/Diego)' },
    { l: 'Otros',          k: 'other',      c: '#6B6B6B', desc: 'Documentación, despacho, varios' },
  ];

  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 18 }}>DESGLOSE DE COSTOS · {cats.length} CATEGORÍAS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {cats.map(cat => {
          const v = catTotals[cat.k];
          const pct = (v / totalCost) * 100;
          return (
            <div key={cat.k}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 3, background: cat.c }} />
                  <div>
                    <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{cat.l}</div>
                    <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{cat.desc}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>${(v/1000).toFixed(1)}K</div>
                  <div style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{pct.toFixed(1)}% del total</div>
                </div>
              </div>
              <div style={{ height: 10, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: cat.c, borderRadius: 999, transition: 'width var(--dur-slow) var(--ease)' }} />
              </div>
            </div>
          );
        })}
      </div>
    </U.Card>
  );
}

// ── Margen por ruta ──────────────────────────────────────────
function RoutesMarginSection({ data }) {
  const U = window.ERPUI;
  const D = window.ERPData;
  const byRoute = new Map();
  data.forEach(({ ship, eco }) => {
    const key = `${ship.origin}→${ship.destination}`;
    const cur = byRoute.get(key) || { origin: ship.origin, dest: ship.destination, count: 0, revenue: 0, cost: 0 };
    cur.count++;
    cur.revenue += eco.revenue;
    cur.cost += eco.totalCost;
    byRoute.set(key, cur);
  });
  const routes = [...byRoute.values()].map(r => ({ ...r, margin: r.revenue - r.cost, marginPct: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0 }));
  routes.sort((a, b) => b.marginPct - a.marginPct);

  return (
    <U.Card padded={false}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">{routes.length} RUTAS · ORDENADAS POR MARGEN %</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 70px 100px 100px 100px 110px', padding: '10px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
        {['Ruta', 'Envíos', 'Revenue', 'Costo', 'Margen $', 'Margen %'].map((h, i) => (
          <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: i >= 1 ? 'right' : 'left' }}>{h}</span>
        ))}
      </div>
      {routes.map((r, i) => {
        const tone = r.marginPct >= 30 ? 'success' : r.marginPct >= 15 ? 'info' : r.marginPct >= 0 ? 'warning' : 'danger';
        return (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '1.4fr 70px 100px 100px 100px 110px',
            padding: '14px 18px', gap: 14, alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.origin(r.origin).name}</span>
              <span style={{ color: 'var(--wine)' }}>→</span>
              <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.dest(r.dest).name}</span>
            </div>
            <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', textAlign: 'right' }}>{r.count}</span>
            <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${(r.revenue/1000).toFixed(0)}K</span>
            <span className="mono" style={{ font: '600 12px/1 var(--f-mono)', color: 'var(--warning)', textAlign: 'right' }}>${(r.cost/1000).toFixed(0)}K</span>
            <span className="mono" style={{ font: '800 13px/1 var(--f-mono)', color: r.margin < 0 ? 'var(--danger)' : 'var(--success)', textAlign: 'right' }}>${(r.margin/1000).toFixed(0)}K</span>
            <div style={{ textAlign: 'right' }}>
              <U.Badge tone={tone} size="md">{r.marginPct.toFixed(1)}%</U.Badge>
            </div>
          </div>
        );
      })}
    </U.Card>
  );
}

window.ModuleCosting = ModuleCosting;

// ── Currency toggle USD ↔ VES ───────────────────────────────
function CurrencyToggle({ value, onChange, rate }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 36, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-surface)', borderRadius: 'var(--r-sm)', gap: 2 }}>
        {['USD', 'VES'].map(c => {
          const a = value === c;
          return (
            <button key={c} onClick={() => onChange(c)} style={{
              padding: '4px 10px', borderRadius: 3,
              background: a ? 'var(--wine)' : 'transparent',
              color: a ? '#fff' : 'var(--ink-soft)',
              font: '700 11px/1 var(--f-mono)', letterSpacing: '0.04em',
            }}>{c}</button>
          );
        })}
      </div>
      <span style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>BCV {rate}</span>
    </div>
  );
}

// ── Templates por ruta section ──────────────────────────────
function TemplatesSection() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const templates = Object.entries(D.ROUTE_COST_TEMPLATES).map(([k, v]) => ({ key: k, ...v }));

  return (
    <div>
      <U.Card padded style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span style={{ color: 'var(--info)', marginTop: 4 }}>{window.Icon.info(15)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>¿Para qué sirven los templates?</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '70ch' }}>
              Definí costos default por <b>ruta + tipo de servicio</b>. Cuando registres un embarque nuevo en esa combinación, los costos se prellenan automáticamente. Después ajustás si hay diferencias específicas (gaceta SENIAT cambió un arancel, naviera te subió el flete, etc.).
            </div>
          </div>
          <U.Btn variant="primary" size="sm" icon={window.Icon.plus(12)}>Nuevo template</U.Btn>
        </div>
      </U.Card>

      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px 80px 80px 90px', padding: '12px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
          {['Ruta · Servicio', 'Flete', 'Aduana', 'Transp.', 'Handling', 'Seguro', 'Comis.', 'Otros', 'Costo total'].map((h, i) => (
            <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: i === 0 ? 'left' : 'right' }}>{h}</span>
          ))}
        </div>
        {templates.map((t, i) => {
          const total = t.freight + t.customs + t.transport + t.handling + t.insurance + t.commission + t.other;
          return (
            <div key={t.key} style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px 80px 80px 80px 90px',
              padding: '14px 18px', gap: 8, alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <div>
                <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{t.name}</div>
                <code style={{ font: '600 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)' }}>{t.key}</code>
              </div>
              <Cell v={t.freight} />
              <Cell v={t.customs} />
              <Cell v={t.transport} />
              <Cell v={t.handling} />
              <Cell v={t.insurance} />
              <Cell v={t.commission} />
              <Cell v={t.other} />
              <span className="mono" style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)', textAlign: 'right' }}>${total.toLocaleString()}</span>
            </div>
          );
        })}
      </U.Card>
    </div>
  );
}
function Cell({ v }) {
  return <span className="mono" style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>${(v/1000).toFixed(1)}K</span>;
}

// ── Forecast section ────────────────────────────────────────
function ForecastSection() {
  const D = window.ERPData;
  const U = window.ERPUI;
  // Pipeline: shipments in cotizado/confirmado/recibido CN status + accepted quotes
  const pipeline = D.SHIPMENTS.filter(s => ['cotizado', 'confirmado', 'recibido CN', 'consolidado'].includes(s.status))
    .map(s => ({ ship: s, eco: D.shipmentEconomics(s) }));
  const acceptedQuotes = D.QUOTES.filter(q => q.status === 'aceptada');

  const projRevenue = pipeline.reduce((a, x) => a + x.eco.revenue, 0) + acceptedQuotes.reduce((a, q) => a + q.totalUSD, 0);
  const projCost    = pipeline.reduce((a, x) => a + x.eco.totalCost, 0) + acceptedQuotes.reduce((a, q) => a + q.totalUSD * 0.78, 0); // ~22% margen estimado
  const projMargin  = projRevenue - projCost;
  const projMarginPct = projRevenue > 0 ? (projMargin / projRevenue) * 100 : 0;

  // Por status
  const byStatus = ['cotizado', 'confirmado', 'recibido CN', 'consolidado'].map(st => {
    const items = pipeline.filter(x => x.ship.status === st);
    return { status: st, count: items.length, revenue: items.reduce((s, x) => s + x.eco.revenue, 0), margin: items.reduce((s, x) => s + x.eco.margin, 0) };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Card padded style={{ background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', border: 0, color: '#fff' }}>
        <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>FORECAST · PRÓXIMOS 60 DÍAS</div>
        <div style={{ font: '900 18px/1.1 var(--f-display)', color: '#fff', marginTop: 6, marginBottom: 16 }}>Pipeline proyectado en cierre</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { l: 'Revenue proyectado', v: `$${(projRevenue/1000).toFixed(0)}K`,    c: '#fff' },
            { l: 'Costo proyectado',   v: `$${(projCost/1000).toFixed(0)}K`,       c: 'var(--warning)' },
            { l: 'Margen proyectado',  v: `$${(projMargin/1000).toFixed(0)}K`,     c: '#7CE3A5' },
            { l: 'Margen % estimado',  v: `${projMarginPct.toFixed(1)}%`,           c: 'var(--wine-soft)' },
          ].map(k => (
            <div key={k.l}>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{k.l}</div>
              <div style={{ font: '900 22px/1 var(--f-mono)', color: k.c, marginTop: 8 }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', font: '500 12px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.7)' }}>
          Basado en {pipeline.length} embarques en pipeline + {acceptedQuotes.length} cotizaciones aceptadas pendientes de embarcar. Confianza ~85% (asume todos cierran).
        </div>
      </U.Card>

      {/* Funnel by status */}
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>FUNNEL POR ESTADO · CUÁNTO QUEDA</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {byStatus.map(s => (
            <div key={s.status}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <U.Badge tone={D.STATUS_TONE[s.status] || 'neutral'} size="sm" dot>{s.status}</U.Badge>
                  <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{s.count} embarques</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <div style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>${(s.revenue/1000).toFixed(1)}K rev</div>
                  <div style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--success)' }}>${(s.margin/1000).toFixed(1)}K mgn</div>
                </div>
              </div>
              <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 999 }}>
                <div style={{ width: `${(s.revenue / projRevenue) * 100}%`, height: '100%', background: 'var(--wine)', borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      </U.Card>

      {/* Accepted quotes pending shipment */}
      {acceptedQuotes.length > 0 && (
        <U.Card padded={false}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <div className="eyebrow eyebrow-wine">{acceptedQuotes.length} COTIZACIONES ACEPTADAS · PENDIENTES DE EMBARCAR</div>
          </div>
          {acceptedQuotes.map((q, i) => {
            const estMargin = q.totalUSD * 0.22;
            return (
              <div key={q.id} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 100px 100px 100px',
                padding: '12px 18px', gap: 14, alignItems: 'center',
                borderTop: i > 0 ? '1px solid var(--border)' : 0,
              }}>
                <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{q.id}</code>
                <div>
                  <div style={{ font: '700 12.5px/1.2 var(--f-sans)' }}>{q.clientName}</div>
                  <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{q.type} · {D.origin(q.origin).name} → {D.dest(q.destination).name}</div>
                </div>
                <span className="mono" style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${(q.totalUSD/1000).toFixed(1)}K</span>
                <span className="mono" style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--success)', textAlign: 'right' }}>+${(estMargin/1000).toFixed(1)}K</span>
                <U.Badge tone="info" size="sm">est. 22%</U.Badge>
              </div>
            );
          })}
        </U.Card>
      )}
    </div>
  );
}

// ── Cost editor drawer ──────────────────────────────────────
function CostEditor({ ship, onClose }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const initial = ship ? (D.SHIPMENT_COSTS[ship.id] || { freight: 0, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 }) : null;
  const [costs, setCosts] = React.useState(initial);
  React.useEffect(() => { if (ship) setCosts(D.SHIPMENT_COSTS[ship.id] || { freight: 0, customs: 0, transport: 0, handling: 0, insurance: 0, commission: 0, other: 0 }); }, [ship?.id]);

  if (!ship || !costs) return null;
  const total = Object.values(costs).reduce((s, v) => s + (+v || 0), 0);
  const margin = ship.value - total;
  const marginPct = ship.value > 0 ? (margin / ship.value) * 100 : 0;
  const set = (k, v) => setCosts(c => ({ ...c, [k]: +v || 0 }));

  const cats = [
    { k: 'freight',    l: 'Flete naviera',    desc: 'Pago directo a COSCO/MSC/CMA' },
    { k: 'customs',    l: 'Aduana SENIAT',    desc: 'Aranceles, IVA, IGTF, agente aduanal' },
    { k: 'transport',  l: 'Transporte VE',    desc: 'Última milla desde puerto al cliente' },
    { k: 'handling',   l: 'Handling CN',      desc: 'Recepción, consolidación, almacenaje' },
    { k: 'insurance',  l: 'Seguro de carga',  desc: 'Cobertura por daño/pérdida' },
    { k: 'commission', l: 'Comisión comercial', desc: 'Variable según agente comercial' },
    { k: 'other',      l: 'Otros',            desc: 'Documentación, despacho, varios' },
  ];

  return (
    <U.Drawer
      open={!!ship}
      onClose={onClose}
      title={`Editar costos · ${ship.id}`}
      subtitle={`${ship.clientName} · ${D.origin(ship.origin).name} → ${D.dest(ship.destination).name}`}
      width={620}
      actions={
        <>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={window.Icon.check(13)} onClick={() => { if (ship) D.SHIPMENT_COSTS[ship.id] = costs; onClose(); }}>Guardar costos</U.Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Revenue header */}
        <U.Card padded style={{ background: 'var(--ink)', color: '#fff', border: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Revenue</div>
              <div style={{ font: '900 22px/1 var(--f-mono)', color: '#fff', marginTop: 6 }}>${(ship.value/1000).toFixed(1)}K</div>
            </div>
            <div>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Costo total</div>
              <div style={{ font: '900 22px/1 var(--f-mono)', color: 'var(--warning)', marginTop: 6 }}>${(total/1000).toFixed(1)}K</div>
            </div>
            <div>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Margen</div>
              <div style={{ font: '900 22px/1 var(--f-mono)', color: margin < 0 ? 'var(--wine-soft)' : '#7CE3A5', marginTop: 6 }}>${(margin/1000).toFixed(1)}K</div>
              <div style={{ font: '700 11px/1 var(--f-mono)', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{marginPct.toFixed(1)}%</div>
            </div>
          </div>
        </U.Card>

        {/* Cost inputs */}
        {cats.map(c => (
          <div key={c.k} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14, alignItems: 'center' }}>
            <div>
              <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{c.l}</div>
              <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{c.desc}</div>
            </div>
            <U.Input value={costs[c.k]} onChange={(e) => set(c.k, e.target.value)} type="number" prefix="$" mono />
          </div>
        ))}

        <div style={{ padding: '10px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
          <span style={{ color: 'var(--info)' }}>{window.Icon.info(13)}</span>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            Los costos se editan en tiempo real · el margen se recalcula al instante arriba.
          </div>
        </div>
      </div>
    </U.Drawer>
  );
}
