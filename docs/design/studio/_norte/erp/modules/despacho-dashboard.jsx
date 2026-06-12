/* global React */
/* ── DTD ERP · Despacho · Dashboard de reportes ──────────────── */
(function () {
  const { useState, useMemo, useEffect } = React;

  function ModuleDespachoDashboard({ goTo }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [period, setPeriod] = useState('7d');

    // Mock metrics
    const stats = {
      ods: { total: 142, completed: 128, ontime: 91, late: 14, cancelled: 8 },
      onTimePct: 71,
      avgRouteTime: '5h 24m',
      avgKgPerOD: 4280,
      avgCBMPerOD: 18.4,
    };
    const topCities = [
      { city: 'Caracas',    ods: 58, kg: 24400, late: 6 },
      { city: 'Valencia',   ods: 38, kg: 15200, late: 2 },
      { city: 'Maracaibo',  ods: 22, kg: 18800, late: 4 },
      { city: 'Barquisimeto', ods: 14, kg: 7600, late: 1 },
      { city: 'Maracay',    ods: 10, kg: 3200, late: 1 },
    ];
    const routes = [
      { id: 'R-002', name: 'Valencia → Caracas + 2 ciudades', ods: 24, ontime: 22, costPerKm: 0.42 },
      { id: 'R-001', name: 'Valencia → Caracas',              ods: 34, ontime: 31, costPerKm: 0.38 },
      { id: 'R-003', name: 'Valencia → Maracaibo',            ods: 18, ontime: 16, costPerKm: 0.51 },
      { id: 'R-004', name: 'Valencia → Maracaibo + 2 ciudades', ods: 14, ontime: 11, costPerKm: 0.58 },
    ];

    return (
      <div>
        <U.PageHeader
          eyebrow="REPORTES · DESPACHO"
          title="Dashboard de despacho"
          subtitle="Métricas operativas de los últimos 7 días. Mira qué rutas son más eficientes, dónde hay demoras y cuánto cuesta cada kilómetro."
          actions={
            <U.Select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }} options={[
              { value: '7d', label: 'Últimos 7 días' },
              { value: '30d', label: 'Últimos 30 días' },
              { value: '90d', label: 'Últimos 90 días' },
            ]} />
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 'var(--s-6)' }}>
          <U.KPI label="Total ODs"        value={stats.ods.total}     sub="creadas en periodo" tone="wine"    icon={I.truck(18)} />
          <U.KPI label="Completadas"      value={stats.ods.completed} sub={`${Math.round(stats.ods.completed/stats.ods.total*100)}% del total`} tone="success" icon={I.check(18)} />
          <U.KPI label="On-time"          value={`${stats.onTimePct}%`} sub={`${stats.ods.ontime} a tiempo`} tone="info" icon={I.clock(18)} />
          <U.KPI label="Tarde / Canceladas" value={stats.ods.late + stats.ods.cancelled} sub={`${stats.ods.late} tarde · ${stats.ods.cancelled} canceladas`} tone="warning" icon={I.warn(18)} />
          <U.KPI label="Tiempo prom."      value={stats.avgRouteTime} sub="por ruta completa"     tone="neutral" icon={I.clock(18)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--s-6)' }}>
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>RANKING DE RUTAS · EFICIENCIA</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ruta</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>ODs</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>On-time</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>$/km</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(r => {
                  const pct = Math.round(r.ontime / r.ods * 100);
                  const tone = pct >= 90 ? 'success' : pct >= 75 ? 'warning' : 'danger';
                  return (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px', font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
                        <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)', marginRight: 8 }}>{r.id}</code>
                        {r.name}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', font: '800 14px/1 var(--f-display)', color: 'var(--ink)' }}>{r.ods}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <U.Badge tone={tone} size="sm">{pct}%</U.Badge>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>${r.costPerKm.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </U.Card>

          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>TOP CIUDADES POR VOLUMEN</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topCities.map((c, i) => {
                const maxOds = Math.max(...topCities.map(x => x.ods));
                const pct = (c.ods / maxOds) * 100;
                return (
                  <div key={c.city}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{c.city}</span>
                      <span style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{c.ods} ODs</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? 'var(--wine)' : 'var(--wine-tint)', borderRadius: 999 }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
                      <span>{(c.kg/1000).toFixed(1)}t total</span>
                      {c.late > 0 && <span style={{ color: 'var(--warning)' }}>{c.late} tarde</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </U.Card>
        </div>
      </div>
    );
  }

  window.ModuleDespachoDashboard = ModuleDespachoDashboard;
})();
