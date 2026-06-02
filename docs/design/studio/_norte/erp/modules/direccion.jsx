/* global React */
/* ── DTD ERP · Dirección · Tablero ejecutivo · v1.9.1 ───────── */
/* Cabina del dueño: consolida finanzas, operación, comercial y  */
/* servicio leyendo los datos de los demás módulos (read-only).  */

function ModuleDireccion({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const R = window.ERPRates;
  const fmt = (n) => (R?.fmtUsd ? R.fmtUsd(n) : '$' + Math.round(n || 0).toLocaleString('en-US'));
  const safe = (fn, fb) => { try { const v = fn(); return (v == null || Number.isNaN(v)) ? fb : v; } catch (e) { return fb; } };

  const C = window.ContabilidadData;
  const T = window.TesoreriaData;
  const N = window.NavieraData;
  const F = window.FidelizacionData;
  const CV = window.ConversacionesData;
  const D = window.ERPData;

  // ── Finanzas ──
  const pl = safe(() => C.calculatePL(), null);
  const ingresos = safe(() => pl.totalIngresos, 0);
  const utilidad = safe(() => pl.utilidadNeta, 0);
  const margen = ingresos ? (utilidad / ingresos) * 100 : 0;
  const cxc = safe(() => C.accountBalance('1.1.10'), 0);
  const caja = safe(() => T.totalCashUsd(), 0);
  const cxp = safe(() => T.totalOpenUsd(), 0);
  const overdue = safe(() => T.overduePayables(), []);
  const overdueUsd = overdue.reduce((s, p) => s + safe(() => T.outstandingUsd(p), 0), 0);
  const posNeta = caja + cxc - cxp;
  const cobertura = cxp ? (caja / cxp) * 100 : 100;
  const forecast = safe(() => T.cashOutForecast(), []);

  // ── Operación ──
  const ships = safe(() => D.SHIPMENTS, []);
  const activos = ships.filter(s => !['entregado', 'liberado', 'cotizado'].includes(s.status));
  const enRuta = activos.reduce((s, x) => s + (x.value || 0), 0);
  const consol = safe(() => N.consolidating(), []);
  const utilMedia = consol.length ? consol.reduce((s, c) => s + safe(() => N.containerStats(c).cbmPct, 0), 0) / consol.length : 0;
  const looseCbm = safe(() => N.totalLooseCbm(), 0);
  const nextCutoff = safe(() => N.openSailings().slice().sort((a, b) => a.cutoff.localeCompare(b.cutoff))[0], null);
  const cutoffDays = nextCutoff ? safe(() => N.daysUntil(nextCutoff.cutoff), null) : null;

  // ── Comercial ──
  const leads = safe(() => D.LEADS, []);
  const pipeline = leads.filter(l => !['ganado', 'descartado'].includes(l.stage)).reduce((s, l) => s + (l.value || 0), 0);
  const tierCounts = safe(() => F.tierCounts(), []);
  const prog = safe(() => F.programStats(), { activos: 0, total: 0 });

  // ── Servicio ──
  const convAbiertas = safe(() => CV.byStatus('abierto').length, 0);
  const reclamos = safe(() => CV.openReclamos().length, 0);
  const sinAsignar = safe(() => CV.unassigned().length, 0);

  // ── Alertas ──
  const alerts = [];
  if (overdue.length) alerts.push({ tone: 'danger', icon: 'invoice', t: `${overdue.length} ${overdue.length === 1 ? 'pago vencido' : 'pagos vencidos'} · ${fmt(overdueUsd)}`, to: () => goTo('tesoreria') });
  if (reclamos) alerts.push({ tone: 'danger', icon: 'shield', t: `${reclamos} ${reclamos === 1 ? 'caso abierto' : 'casos abiertos'}`, to: () => goTo('conversaciones') });
  if (cutoffDays != null && cutoffDays <= 3) alerts.push({ tone: 'warning', icon: 'ship', t: `Cut-off ${nextCutoff.id} en ${cutoffDays}d · ${safe(() => N.carrier(nextCutoff.carrier).name, '')}`, to: () => goTo('naviera') });
  if (sinAsignar) alerts.push({ tone: 'warning', icon: 'chat', t: `${sinAsignar} ${sinAsignar === 1 ? 'conversación sin asignar' : 'conversaciones sin asignar'}`, to: () => goTo('conversaciones') });
  if (looseCbm > 20) alerts.push({ tone: 'info', icon: 'warehouse', t: `${looseCbm.toFixed(1)} CBM de carga suelta para consolidar en CN`, to: () => goTo('naviera') });
  if (alerts.length === 0) alerts.push({ tone: 'success', icon: 'check', t: 'Todo en orden · sin alertas críticas', to: null });

  const today = new Date('2026-05-24T12:00:00');
  const fecha = today.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <U.PageHeader
        eyebrow="DIRECCIÓN · VISTA CONSOLIDADA"
        title="Tablero ejecutivo"
        subtitle={`Estado integral del negocio al ${fecha}. Finanzas, operación, comercial y servicio en una vista.`}
        actions={<U.Btn variant="secondary" icon={I.download(14)}>Exportar resumen</U.Btn>}
      />

      {/* KPIs financieros */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
        <U.KPI label="Ingresos · mes" value={fmt(ingresos)} delta={`${activos.length} embarques activos`} tone="success" icon={I.chart(18)} />
        <U.KPI label="Utilidad neta" value={fmt(utilidad)} delta={`Margen ${margen.toFixed(1)}%`} tone={utilidad >= 0 ? 'wine' : 'danger'} icon={I.spark(18)} />
        <U.KPI label="Caja + bancos" value={fmt(caja)} delta="4 monedas consolidadas" tone="wine" icon={I.star(18)} />
        <U.KPI label="Posición neta" value={fmt(posNeta)} delta="caja + CxC − CxP" tone={posNeta >= 0 ? 'success' : 'danger'} icon={I.invoice(18)} />
      </div>

      {/* Salud financiera + cashflow */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 16 }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>SALUD FINANCIERA</div>
          <FinRow label="Por cobrar (CxC)" value={fmt(cxc)} tone="success" onClick={() => goTo('contab')} />
          <FinRow label="Por pagar (CxP)" value={fmt(cxp)} tone="warning" onClick={() => goTo('tesoreria')} />
          <FinRow label="Vencido" value={fmt(overdueUsd)} tone={overdueUsd > 0 ? 'danger' : 'neutral'} onClick={() => goTo('tesoreria')} />
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Cobertura de pagos con caja</span>
              <span style={{ font: '800 13px/1 var(--f-mono)', color: cobertura >= 100 ? 'var(--success)' : 'var(--warning)' }}>{cobertura.toFixed(0)}%</span>
            </div>
            <U.Progress value={Math.min(100, cobertura)} tone={cobertura >= 100 ? 'success' : 'warning'} height={8} />
          </div>
        </U.Card>

        <U.Card padded>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div className="eyebrow eyebrow-wine">PROYECCIÓN DE SALIDAS · 4 SEMANAS</div>
            <button onClick={() => goTo('tesoreria')} style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Tesorería {I.arrowR(11)}</button>
          </div>
          {forecast.length > 0 ? (() => {
            const maxW = Math.max(...forecast.map(w => w.usd), 1);
            return (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 150 }}>
                {forecast.map((w, i) => {
                  const h = (w.usd / maxW) * 120;
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                      <div style={{ font: '800 10.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{w.usd > 0 ? fmt(w.usd) : '—'}</div>
                      <div style={{ width: '100%', maxWidth: 56, height: Math.max(h, 4), borderRadius: 'var(--r-sm) var(--r-sm) 0 0', background: i === 0 ? 'var(--wine)' : 'var(--wine-soft)', transition: 'height var(--dur-slow) var(--ease)' }} />
                      <div style={{ font: '600 9.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', textAlign: 'center' }}>{w.label}</div>
                    </div>
                  );
                })}
              </div>
            );
          })() : <div style={{ font: '500 12px var(--f-sans)', color: 'var(--ink-mute)' }}>Sin datos de proyección.</div>}
        </U.Card>
      </div>

      {/* Operación + Comercial */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <U.Card padded>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div className="eyebrow eyebrow-wine">OPERACIÓN</div>
            <button onClick={() => goTo('naviera')} style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Naviera {I.arrowR(11)}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MiniStat label="Embarques activos" value={activos.length} sub={fmt(enRuta) + ' en ruta'} icon={I.box(16)} onClick={() => goTo('shipments')} />
            <MiniStat label="Contenedores" value={consol.length} sub={`${utilMedia.toFixed(0)}% ocupación`} icon={I.ship(16)} onClick={() => goTo('naviera')} />
            <MiniStat label="Carga suelta CN" value={looseCbm.toFixed(1)} sub="CBM por consolidar" icon={I.warehouse(16)} onClick={() => goTo('naviera')} />
            <MiniStat label="Próximo cut-off" value={cutoffDays != null ? cutoffDays + 'd' : '—'} sub={nextCutoff ? nextCutoff.id : 'sin salidas'} icon={I.clock(16)} tone={cutoffDays != null && cutoffDays <= 3 ? 'danger' : 'neutral'} onClick={() => goTo('naviera')} />
          </div>
        </U.Card>

        <U.Card padded>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div className="eyebrow eyebrow-wine">COMERCIAL</div>
            <button onClick={() => goTo('fidelizacion')} style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Fidelización {I.arrowR(11)}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <MiniStat label="Pipeline CRM" value={fmt(pipeline)} sub={`${leads.filter(l => !['ganado','descartado'].includes(l.stage)).length} leads activos`} icon={I.spark(16)} onClick={() => goTo('leads')} />
            <MiniStat label="Referidos activos" value={prog.activos} sub={`${prog.total} en programa`} icon={I.users(16)} onClick={() => goTo('fidelizacion')} />
          </div>
          {/* tier mini bars */}
          <div style={{ display: 'flex', gap: 4, height: 36, alignItems: 'flex-end' }}>
            {tierCounts.map(({ tier, count }) => {
              const total = tierCounts.reduce((s, t) => s + t.count, 0) || 1;
              return (
                <div key={tier.id} style={{ flex: count || 0.15, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${tier.label}: ${count}`}>
                  <span style={{ font: '700 10px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{count}</span>
                  <div style={{ width: '100%', height: 8, background: tier.color, borderRadius: 3, opacity: count ? 1 : 0.25 }} />
                  <span style={{ font: '600 8.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{tier.label}</span>
                </div>
              );
            })}
          </div>
        </U.Card>
      </div>

      {/* Servicio + Alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16 }}>
        <U.Card padded>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
            <div className="eyebrow eyebrow-wine">SERVICIO AL CLIENTE</div>
            <button onClick={() => goTo('conversaciones')} style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Bandeja {I.arrowR(11)}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <MiniStat label="Conversaciones abiertas" value={convAbiertas} sub={`${sinAsignar} sin asignar`} icon={I.chat(16)} tone={sinAsignar ? 'warning' : 'neutral'} onClick={() => goTo('conversaciones')} />
            <MiniStat label="Casos abiertos" value={reclamos} sub="requieren atención" icon={I.shield(16)} tone={reclamos ? 'danger' : 'success'} onClick={() => goTo('conversaciones')} />
          </div>
        </U.Card>

        <U.Card padded={false}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)' }}>
            <div className="eyebrow eyebrow-wine">ALERTAS · REQUIEREN ATENCIÓN</div>
          </div>
          <div>
            {alerts.map((a, i) => (
              <button key={i} onClick={a.to || undefined} disabled={!a.to} style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 0,
                cursor: a.to ? 'pointer' : 'default',
                transition: 'background var(--dur-fast) var(--ease)',
              }}
                onMouseEnter={(e) => { if (a.to) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 'var(--r-md)', background: `var(--${a.tone}-bg)`, color: `var(--${a.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon[a.icon]?.(15)}</span>
                <span style={{ flex: 1, font: '600 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{a.t}</span>
                {a.to && <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{I.arrowR(13)}</span>}
              </button>
            ))}
          </div>
        </U.Card>
      </div>
    </div>
  );
}

function FinRow({ label, value, tone, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${tone})` }} />
        <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{label}</span>
      </div>
      <span style={{ font: '800 13.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

function MiniStat({ label, value, sub, icon, tone = 'wine', onClick }) {
  const hoverBg = tone === 'wine' ? 'var(--wine-tint)' : `var(--${tone}-bg)`;
  return (
    <button onClick={onClick} style={{
      textAlign: 'left', padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)',
      transition: 'background var(--dur-fast) var(--ease)', cursor: onClick ? 'pointer' : 'default', width: '100%',
    }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.background = hoverBg; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
        <span style={{ color: `var(--${tone})`, display: 'inline-flex' }}>{icon}</span>
        <span style={{ font: '700 9.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ font: '900 19px/1 var(--f-display)', color: 'var(--ink)' }}>{value}</div>
      {sub && <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{sub}</div>}
    </button>
  );
}

window.ModuleDireccion = ModuleDireccion;
