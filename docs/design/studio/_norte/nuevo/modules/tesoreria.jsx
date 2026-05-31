/* global React */
/* ── DTD ERP · Tesorería · v1.2 ─────────────────────────────── */
/* La otra mitad del libro: caja multi-moneda + lo que pagamos.  */
/* Dashboard · Cuentas por pagar · Pagos & remesas · Cuentas.    */

function ModuleTesoreria({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const T = window.TesoreriaData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const [tab, setTab] = React.useState('dashboard');

  const overdue = T.overduePayables().length;

  return (
    <div>
      <U.PageHeader
        eyebrow="FINANZAS · CUENTAS POR PAGAR"
        title="Tesorería"
        subtitle={`Caja multi-moneda · ${T.openPayables().length} cuentas por pagar abiertas · BCV ${rates.bcv.toFixed(2)} · CNY ${rates.cny.toFixed(2)}`}
        actions={
          <>
            <U.Btn variant="secondary" icon={I.download(14)}>Exportar</U.Btn>
            <U.Btn variant="primary" icon={I.plus(14)} onClick={() => setTab('payables')}>Programar pago</U.Btn>
          </>
        }
      />

      <U.Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'payables',  label: 'Cuentas por pagar', count: T.openPayables().length },
          { value: 'payments',  label: 'Pagos & remesas', count: T.PAYMENT_ORDERS.length },
          { value: 'accounts',  label: 'Cuentas', count: T.CASH_ACCOUNTS.length },
        ]}
        style={{ marginBottom: 'var(--s-5)' }}
      />

      {tab === 'dashboard' && <DashboardTab goTo={goTo} setTab={setTab} />}
      {tab === 'payables'  && <PayablesTab goTo={goTo} />}
      {tab === 'payments'  && <PaymentsTab />}
      {tab === 'accounts'  && <AccountsTab />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════════
function DashboardTab({ goTo, setTab }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const T = window.TesoreriaData;
  const R = window.ERPRates;

  const totalCash = T.totalCashUsd();
  const totalOpen = T.totalOpenUsd();
  const overdue = T.overduePayables();
  const overdueUsd = overdue.reduce((s, p) => s + T.outstandingUsd(p), 0);
  const soon = T.dueSoon(7);
  const soonUsd = soon.reduce((s, p) => s + T.outstandingUsd(p), 0);
  const byCurrency = T.cashByCurrency();
  const byType = T.openByType();
  const forecast = T.cashOutForecast();
  const maxWeek = Math.max(...forecast.map(w => w.usd), 1);

  const currencyMeta = {
    USD:  { label: 'Dólares',  tone: 'wine',    fmt: (v) => R.fmtUsd(v) },
    VES:  { label: 'Bolívares', tone: 'info',   fmt: (v, raw) => R.fmtBs(raw) },
    USDT: { label: 'USDT',     tone: 'success', fmt: (v) => R.fmtUsd(v) },
    CNY:  { label: 'Yuan 人民币', tone: 'warning', fmt: (v, raw) => T.fmtCny(raw) },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <U.KPI label="Caja + bancos · total" value={R.fmtUsd(totalCash)} delta={`${T.CASH_ACCOUNTS.length} cuentas · 4 monedas`} tone="wine" icon={I.chart(18)} />
        <U.KPI label="Por pagar · abierto" value={R.fmtUsd(totalOpen)} delta={`${T.openPayables().length} CxP`} tone="warning" icon={I.invoice(18)} />
        <U.KPI label="Vencido" value={R.fmtUsd(overdueUsd)} delta={overdue.length ? `${overdue.length} cuentas · acción urgente` : 'Sin vencidos'} tone={overdue.length ? 'danger' : 'success'} icon={I.shield(18)} />
        <U.KPI label="Vence en 7 días" value={R.fmtUsd(soonUsd)} delta={`${soon.length} próximos pagos`} tone="info" icon={I.clock ? I.clock(18) : I.check(18)} />
      </div>

      {/* 2-col: posición de caja multi-moneda + CxP por tipo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16 }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>POSICIÓN DE CAJA · POR MONEDA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {byCurrency.map(c => {
              const meta = currencyMeta[c.currency] || { label: c.currency, tone: 'neutral', fmt: (v) => R.fmtUsd(v) };
              const pct = (c.balanceUsd / totalCash) * 100;
              return (
                <div key={c.currency} style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--${meta.tone})` }} />
                      <span style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)' }}>{meta.label}</span>
                      <U.Badge tone="neutral" size="sm">{c.accounts} {c.accounts === 1 ? 'cuenta' : 'cuentas'}</U.Badge>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(c.balanceUsd)}</div>
                      {c.currency !== 'USD' && c.currency !== 'USDT' && (
                        <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>{meta.fmt(c.balanceUsd, c.balance)}</div>
                      )}
                    </div>
                  </div>
                  <U.Progress value={pct} tone={meta.tone} height={5} />
                </div>
              );
            })}
            <div style={{
              marginTop: 4, padding: '12px 14px', background: 'var(--bg-sidebar)', color: '#fff',
              borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>LIQUIDEZ TOTAL</div>
                <div style={{ font: '500 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)' }}>Equivalente en USD a tasa del día</div>
              </div>
              <div style={{ font: '900 22px/1 var(--f-display)' }}>{R.fmtUsd(totalCash)}</div>
            </div>
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>POR PAGAR · POR BENEFICIARIO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {byType.map(t => {
              const meta = T.PAYEE_TYPE[t.type];
              const pct = (t.usd / totalOpen) * 100;
              return (
                <div key={t.type} onClick={() => setTab('payables')} style={{
                  padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', cursor: 'pointer',
                  transition: 'background var(--dur-fast) var(--ease)',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = `var(--${meta.tone}-bg)`}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: `var(--${meta.tone})`, display: 'inline-flex' }}>{window.Icon[meta.icon]?.(16)}</span>
                      <span style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)' }}>{meta.label}</span>
                      <U.Badge tone={meta.tone} size="sm">{t.count}</U.Badge>
                    </div>
                    <div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(t.usd)}</div>
                  </div>
                  <U.Progress value={pct} tone={meta.tone} height={5} />
                </div>
              );
            })}
          </div>
        </U.Card>
      </div>

      {/* Proyección de salidas + acciones */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <U.Card padded>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
            <div className="eyebrow eyebrow-wine">PROYECCIÓN DE SALIDAS · 4 SEMANAS</div>
            <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Según vencimientos de CxP abiertas</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: 160, padding: '0 4px' }}>
            {forecast.map((w, i) => {
              const h = (w.usd / maxWeek) * 130;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--ink)' }}>{w.usd > 0 ? R.fmtUsd(w.usd) : '—'}</div>
                  <div style={{
                    width: '100%', maxWidth: 64, height: Math.max(h, 4), borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
                    background: i === 0 ? 'var(--wine)' : 'var(--wine-soft)',
                    transition: 'height var(--dur-slow) var(--ease)',
                  }} />
                  <div style={{ font: '600 10px/1.3 var(--f-sans)', color: 'var(--ink-soft)', textAlign: 'center' }}>{w.label}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
              Caja disponible cubre <strong style={{ color: 'var(--success)' }}>{((T.totalCashUsd() / Math.max(T.totalOpenUsd(), 1)) * 100).toFixed(0)}%</strong> del total por pagar.
            </span>
            <U.Btn variant="soft" size="sm" onClick={() => setTab('payables')}>Ver pipeline</U.Btn>
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>ACCIONES RÁPIDAS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Programar pago a proveedor', icon: I.cn(18), tone: 'wine', to: () => setTab('payables') },
              { label: 'Remesa USDT a China', icon: I.spark(18), tone: 'success', to: () => setTab('payables') },
              { label: 'Pagar naviera', icon: I.box(18), tone: 'info', to: () => setTab('payables') },
              { label: 'Ver órdenes de pago', icon: I.invoice(18), tone: 'neutral', to: () => setTab('payments') },
              { label: 'Conciliar banco', icon: I.check(18), tone: 'warning', to: () => goTo('reconcile') },
            ].map(a => (
              <button key={a.label} onClick={a.to} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 'var(--r-md)',
                background: 'var(--bg-elevated)', textAlign: 'left', width: '100%',
                transition: 'background var(--dur-fast) var(--ease)',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = `var(--${a.tone}-bg)`}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              >
                <span style={{ color: `var(--${a.tone})`, display: 'inline-flex' }}>{a.icon}</span>
                <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', flex: 1 }}>{a.label}</span>
                <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{I.chevR(13)}</span>
              </button>
            ))}
          </div>
        </U.Card>
      </div>

      {/* Próximos vencimientos */}
      <U.Card padded={false}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="eyebrow eyebrow-wine">PRÓXIMOS VENCIMIENTOS</div>
            <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Pagos que requieren atención esta semana</div>
          </div>
          <button onClick={() => setTab('payables')} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Ver todas {I.arrowR(11)}
          </button>
        </div>
        <div>
          {[...T.overduePayables(), ...T.dueSoon(7)].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i).slice(0, 6).map((p, i) => {
            const payee = T.getPayee(p.payee);
            const meta = T.PAYEE_TYPE[payee?.type];
            const d = T.daysUntil(p.dueDate);
            const st = T.PAYABLE_STATUS[p.status];
            return (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 130px 110px 110px', gap: 14, alignItems: 'center',
                padding: '12px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 0,
              }}>
                <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{p.id}</code>
                <div>
                  <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{payee?.name}{payee?.cn && <span style={{ font: '500 11px var(--f-cn)', color: 'var(--ink-mute)', marginLeft: 6 }}>{payee.cn}</span>}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{p.concept}</div>
                </div>
                <U.Badge tone={meta?.tone} size="sm">{meta?.label}</U.Badge>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{window.ERPRates.fmtUsd(T.outstandingUsd(p))}</div>
                  <div style={{ font: `700 10px/1 var(--f-sans)`, color: d < 0 ? 'var(--danger)' : d <= 2 ? 'var(--warning)' : 'var(--ink-mute)', marginTop: 3 }}>
                    {d < 0 ? `Vencido ${Math.abs(d)}d` : d === 0 ? 'Vence hoy' : `En ${d}d`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}><U.Badge tone={st?.tone} size="sm" dot>{st?.label}</U.Badge></div>
              </div>
            );
          })}
        </div>
      </U.Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Cuentas por pagar (CxP)
// ════════════════════════════════════════════════════════════════
function PayablesTab({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const T = window.TesoreriaData;
  const R = window.ERPRates;
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(null);

  const filtered = T.PAYABLES.filter(p => {
    const payee = T.getPayee(p.payee);
    if (typeFilter !== 'all' && payee?.type !== typeFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.id.toLowerCase().includes(q) && !p.concept.toLowerCase().includes(q) && !(payee?.name || '').toLowerCase().includes(q) && !(p.invoice || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const currencyTag = (cur) => ({ USD: 'wine', USDT: 'success', CNY: 'warning', VES: 'info' }[cur] || 'neutral');

  return (
    <div>
      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por CxP, beneficiario, concepto o factura…"
        filters={
          <>
            <U.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos los tipos' },
              ...Object.entries(T.PAYEE_TYPE).map(([k, v]) => ({ value: k, label: v.label })),
            ]} style={{ minWidth: 160 }} />
            <U.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos los estados' },
              ...Object.entries(T.PAYABLE_STATUS).map(([k, v]) => ({ value: k, label: v.label })),
            ]} style={{ minWidth: 160 }} />
          </>
        }
        actions={<U.Btn variant="primary" size="sm" icon={I.plus(12)}>Nueva CxP</U.Btn>}
      />

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '120px 1fr 120px 130px 120px 110px', gap: 14,
          padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span>CxP</span>
          <span>Beneficiario · concepto</span>
          <span>Tipo</span>
          <span style={{ textAlign: 'right' }}>Saldo (USD)</span>
          <span>Vence</span>
          <span style={{ textAlign: 'right' }}>Estado</span>
        </div>
        {filtered.map((p, i) => {
          const payee = T.getPayee(p.payee);
          const meta = T.PAYEE_TYPE[payee?.type];
          const st = T.PAYABLE_STATUS[p.status];
          const d = T.daysUntil(p.dueDate);
          const isSel = selected === p.id;
          return (
            <div key={p.id} onClick={() => setSelected(p.id)} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 120px 130px 120px 110px', gap: 14, alignItems: 'center',
              padding: '12px 18px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border)' : 0,
              background: isSel ? 'var(--wine-tint)' : (p.status === 'vencido' ? 'var(--danger-bg)' : 'transparent'),
              transition: 'background var(--dur-fast) var(--ease)',
            }}
              onMouseEnter={(e) => { if (!isSel && p.status !== 'vencido') e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (!isSel && p.status !== 'vencido') e.currentTarget.style.background = 'transparent'; }}
            >
              <div>
                <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{p.id}</code>
                <div style={{ marginTop: 5 }}><U.Badge tone={currencyTag(p.currency)} size="sm">{p.currency}</U.Badge></div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{payee?.name}{payee?.cn && <span style={{ font: '500 11px var(--f-cn)', color: 'var(--ink-mute)', marginLeft: 6 }}>{payee.cn}</span>}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{p.concept} · <code style={{ font: '500 10.5px var(--f-mono)' }}>{p.invoice}</code></div>
              </div>
              <U.Badge tone={meta?.tone} size="sm">{meta?.label}</U.Badge>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(T.outstandingUsd(p))}</div>
                {p.status === 'parcial' && <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>de {R.fmtUsd(p.amountUsd)}</div>}
              </div>
              <div>
                <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{p.dueDate.slice(5)}</div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: d < 0 ? 'var(--danger)' : d <= 2 ? 'var(--warning)' : 'var(--ink-mute)', marginTop: 3 }}>
                  {d < 0 ? `−${Math.abs(d)}d` : d === 0 ? 'hoy' : `${d}d`}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}><U.Badge tone={st?.tone} size="sm" dot>{st?.label}</U.Badge></div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
            Sin cuentas por pagar con esos filtros.
          </div>
        )}
      </U.Card>

      <PayableDrawer
        payable={selected ? T.PAYABLES.find(p => p.id === selected) : null}
        onClose={() => setSelected(null)}
        goTo={goTo}
      />
    </div>
  );
}

function PayableDrawer({ payable, onClose, goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const T = window.TesoreriaData;
  const R = window.ERPRates;
  const [scheduling, setScheduling] = React.useState(false);
  if (!payable) return null;
  const payee = T.getPayee(payable.payee);
  const meta = T.PAYEE_TYPE[payee?.type];
  const st = T.PAYABLE_STATUS[payable.status];
  const d = T.daysUntil(payable.dueDate);
  const outstanding = T.outstandingUsd(payable);
  const paid = payable.status === 'pagado';

  const origLine = () => {
    if (payable.currency === 'CNY') return `${T.fmtCny(payable.amount)} @ ${(window.ERPRates.read().cny).toFixed(2)} → ${R.fmtUsd(payable.amountUsd)}`;
    if (payable.currency === 'VES') return `${R.fmtBs(payable.amount)} @ BCV → ${R.fmtUsd(payable.amountUsd)}`;
    return R.fmtUsd(payable.amountUsd);
  };

  return (
    <U.Drawer
      open={!!payable}
      onClose={onClose}
      title={payable.id}
      subtitle={`${payee?.name} · ${payable.concept}`}
      width={680}
      actions={
        paid ? (
          <U.Btn variant="primary" onClick={onClose}>Cerrar</U.Btn>
        ) : (
          <>
            <U.Btn variant="ghost" style={{ color: 'var(--danger)' }}>Anular</U.Btn>
            <U.Btn variant="secondary" icon={I.edit(13)}>Editar</U.Btn>
            <U.Btn variant="primary" icon={I.check(13)} onClick={() => setScheduling(s => !s)}>Programar pago</U.Btn>
          </>
        )
      }
    >
      {/* Estado destacado */}
      <div style={{
        padding: '14px 16px', marginBottom: 18, borderRadius: 'var(--r-md)',
        background: `var(--${st?.tone}-bg)`, borderLeft: `4px solid var(--${st?.tone})`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <U.Badge tone={st?.tone} dot>{st?.label}</U.Badge>
            <span style={{ font: '600 12px/1 var(--f-sans)', color: d < 0 && !paid ? 'var(--danger)' : 'var(--ink-soft)' }}>
              {paid ? 'Cancelado en su totalidad' : d < 0 ? `Vencido hace ${Math.abs(d)} días` : d === 0 ? 'Vence hoy' : `Vence en ${d} días`}
            </span>
          </div>
          <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>{origLine()}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{paid ? 'Pagado' : 'Saldo a pagar'}</div>
          <div style={{ font: '900 24px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(outstanding || payable.amountUsd)}</div>
        </div>
      </div>

      {/* Programar pago (inline) */}
      {scheduling && !paid && (
        <U.Card padded style={{ marginBottom: 18, border: '1px solid var(--wine)', background: 'var(--wine-tint)' }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>PROGRAMAR ORDEN DE PAGO</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <U.Select label="Cuenta de origen" options={T.CASH_ACCOUNTS.map(a => ({ value: a.id, label: `${a.short} · ${R.fmtUsd(a.balanceUsd)}` }))} />
            <U.Select label="Método" options={Object.entries(T.PO_METHOD).map(([k, v]) => ({ value: k, label: v.label }))} />
            <U.Input label="Monto a pagar (USD)" defaultValue={String(Math.round(outstanding))} mono prefix="$" />
            <U.Input label="Fecha de ejecución" defaultValue={T.TODAY} mono />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <U.Btn variant="ghost" size="sm" onClick={() => setScheduling(false)}>Cancelar</U.Btn>
            <U.Btn variant="primary" size="sm" icon={I.check(12)} onClick={() => { setScheduling(false); alert('Orden de pago creada (demo). En producción se envía a aprobación de Admin.'); }}>Crear orden</U.Btn>
          </div>
        </U.Card>
      )}

      {/* Detalle */}
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>BENEFICIARIO</div>
      <U.Card padded style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: `var(--${meta?.tone}-bg)`, color: `var(--${meta?.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{window.Icon[meta?.icon]?.(20)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{payee?.name}{payee?.cn && <span style={{ font: '500 12px var(--f-cn)', color: 'var(--ink-soft)', marginLeft: 8 }}>{payee.cn}</span>}</div>
            <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{meta?.label} · canal de pago: {payee?.channel}</div>
          </div>
          {payee?.type === 'supplier' && (
            <U.Btn variant="ghost" size="sm" iconRight={I.arrowR(12)} onClick={() => goTo('suppliers', payee.ref)}>Ver proveedor</U.Btn>
          )}
        </div>
      </U.Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <U.Field label="Factura proforma" value={payable.invoice} mono />
        <U.Field label="Términos de pago" value={payable.terms} />
        <U.Field label="Emitida" value={payable.issueDate} mono />
        <U.Field label="Vencimiento" value={payable.dueDate} mono />
        <U.Field label="Moneda original" value={payable.currency} />
        <U.Field label="Prioridad" value={<U.Badge tone={payable.priority === 'alta' ? 'danger' : payable.priority === 'media' ? 'warning' : 'neutral'} size="sm">{payable.priority}</U.Badge>} />
      </div>

      {payable.shipment && (
        <>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>EMBARQUE VINCULADO</div>
          <button onClick={() => goTo('shipments', payable.shipment)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', textAlign: 'left',
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-tint)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          >
            <span style={{ color: 'var(--wine)', display: 'inline-flex' }}>{I.box(18)}</span>
            <div style={{ flex: 1 }}>
              <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{payable.shipment}</code>
              <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>Este pago imputa al costo directo del embarque</div>
            </div>
            <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{I.arrowR(14)}</span>
          </button>
        </>
      )}

      {window.DocsForTransaction && (
        <div style={{ marginTop: 18 }}>
          <window.DocsForTransaction kind="pago" id={payable.id} goTo={goTo} />
        </div>
      )}
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Pagos & remesas (órdenes de pago)
// ════════════════════════════════════════════════════════════════
function PaymentsTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const T = window.TesoreriaData;
  const R = window.ERPRates;
  const [selected, setSelected] = React.useState(null);

  const orders = [...T.PAYMENT_ORDERS].sort((a, b) => b.date.localeCompare(a.date));
  const completed = orders.filter(o => o.status === 'completado');
  const inProcess = orders.filter(o => o.status === 'en-proceso');
  const totalOut = completed.reduce((s, o) => s + o.amountUsd, 0);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Pagado · mes" value={R.fmtUsd(totalOut)} delta={`${completed.length} órdenes completadas`} tone="wine" icon={I.check(18)} />
        <U.KPI label="En proceso" value={R.fmtUsd(inProcess.reduce((s, o) => s + o.amountUsd, 0))} delta={`${inProcess.length} esperando confirmación`} tone="warning" icon={I.clock ? I.clock(18) : I.invoice(18)} />
        <U.KPI label="Remesas a China" value={R.fmtUsd(completed.filter(o => ['usdt','alipay-cny','wire-cny'].includes(o.method)).reduce((s, o) => s + o.amountUsd, 0))} delta="USDT + CNY" tone="success" icon={I.cn(18)} />
      </div>

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '120px 90px 1fr 140px 130px 110px', gap: 14,
          padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span>Orden</span>
          <span>Fecha</span>
          <span>Beneficiario · concepto</span>
          <span>Método</span>
          <span style={{ textAlign: 'right' }}>Monto (USD)</span>
          <span style={{ textAlign: 'right' }}>Estado</span>
        </div>
        {orders.map((o, i) => {
          const payee = T.getPayee(o.payee);
          const m = T.PO_METHOD[o.method];
          const st = T.PO_STATUS[o.status];
          const isSel = selected === o.id;
          return (
            <div key={o.id} onClick={() => setSelected(o.id)} style={{
              display: 'grid', gridTemplateColumns: '120px 90px 1fr 140px 130px 110px', gap: 14, alignItems: 'center',
              padding: '12px 18px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border)' : 0,
              background: isSel ? 'var(--wine-tint)' : 'transparent', transition: 'background var(--dur-fast) var(--ease)',
            }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
            >
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{o.id}</code>
              <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{o.date.slice(5)}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{payee?.name}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{o.concept}</div>
              </div>
              <U.Badge tone={m?.tone} size="sm">{m?.label}</U.Badge>
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(o.amountUsd)}</div>
                {o.currency !== 'USD' && o.currency !== 'USDT' && (
                  <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>
                    {o.currency === 'CNY' ? T.fmtCny(o.amountOriginal) : R.fmtBs(o.amountOriginal)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}><U.Badge tone={st?.tone} size="sm" dot>{st?.label}</U.Badge></div>
            </div>
          );
        })}
      </U.Card>

      <PaymentDrawer
        order={selected ? T.PAYMENT_ORDERS.find(o => o.id === selected) : null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function PaymentDrawer({ order, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const T = window.TesoreriaData;
  const R = window.ERPRates;
  if (!order) return null;
  const payee = T.getPayee(order.payee);
  const m = T.PO_METHOD[order.method];
  const st = T.PO_STATUS[order.status];
  const acc = T.getAccount(order.fromAccount);

  return (
    <U.Drawer
      open={!!order}
      onClose={onClose}
      title={order.id}
      subtitle={`${order.date} · ${payee?.name}`}
      width={620}
      actions={
        <>
          <U.Btn variant="secondary" icon={I.download(13)}>Comprobante</U.Btn>
          {order.status === 'en-proceso' && <U.Btn variant="primary" icon={I.check(13)}>Marcar completado</U.Btn>}
          {order.status === 'completado' && <U.Btn variant="primary" onClick={onClose}>Cerrar</U.Btn>}
        </>
      }
    >
      <div style={{
        padding: '16px 18px', marginBottom: 18, borderRadius: 'var(--r-md)',
        background: 'var(--bg-sidebar)', color: '#fff',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>MONTO PAGADO</div>
          <div style={{ font: '900 26px/1 var(--f-display)' }}>{R.fmtUsd(order.amountUsd)}</div>
          {order.currency !== 'USD' && order.currency !== 'USDT' && (
            <div style={{ font: '500 12px/1 var(--f-mono)', color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
              {order.currency === 'CNY' ? T.fmtCny(order.amountOriginal) : R.fmtBs(order.amountOriginal)} @ {order.rate.toFixed(2)}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <U.Badge tone={st?.tone} dot>{st?.label}</U.Badge>
          <div style={{ marginTop: 8 }}><U.Badge tone={m?.tone} size="sm">{m?.label}</U.Badge></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <U.Field label="Beneficiario" value={payee?.name} />
        <U.Field label="CxP origen" value={order.payable} mono />
        <U.Field label="Cuenta de origen" value={acc?.name} />
        <U.Field label="Referencia" value={order.reference} mono />
        <U.Field label="Aprobado por" value={order.approvedBy} />
        <U.Field label="Concepto" value={order.concept} />
      </div>

      <div style={{
        padding: '12px 14px', background: 'var(--info-bg)', borderLeft: '3px solid var(--info)', borderRadius: 'var(--r-md)',
        font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)',
      }}>
        Esta orden de pago genera automáticamente el asiento contable de salida (débito a CxP, crédito a {acc?.name}) y queda registrada en el audit log.
      </div>
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Cuentas (cash accounts)
// ════════════════════════════════════════════════════════════════
function AccountsTab() {
  const U = window.ERPUI;
  const I = window.Icon;
  const T = window.TesoreriaData;
  const R = window.ERPRates;

  const kindMeta = {
    banco:  { label: 'Banco',  icon: 'invoice' },
    cripto: { label: 'Digital', icon: 'spark' },
    caja:   { label: 'Caja',   icon: 'box' },
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {T.CASH_ACCOUNTS.map(a => {
          const km = kindMeta[a.kind];
          return (
            <U.Card key={a.id} padded hoverable>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: `var(--${a.tone}-bg)`, color: `var(--${a.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon[km.icon]?.(18)}</span>
                  <div>
                    <div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{a.name}</div>
                    <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{a.coa}</code>
                  </div>
                </div>
                <U.Badge tone="neutral" size="sm">{a.currency}</U.Badge>
              </div>
              <div style={{ font: '900 26px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(a.balanceUsd)}</div>
              {a.currency !== 'USD' && a.currency !== 'USDT' && (
                <div style={{ font: '500 12px/1 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 6 }}>
                  {a.currency === 'CNY' ? T.fmtCny(a.balance) : R.fmtBs(a.balance)}
                </div>
              )}
              <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>{a.detail}</div>
            </U.Card>
          );
        })}
      </div>

      <div style={{
        marginTop: 16, padding: '16px 20px', background: 'var(--bg-sidebar)', color: '#fff', borderRadius: 'var(--r-lg)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>LIQUIDEZ TOTAL · TODAS LAS CUENTAS</div>
          <div style={{ font: '500 12px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)' }}>USD · VES · USDT · CNY consolidado a tasa del día</div>
        </div>
        <div style={{ font: '900 28px/1 var(--f-display)' }}>{R.fmtUsd(T.totalCashUsd())}</div>
      </div>
    </div>
  );
}

window.ModuleTesoreria = ModuleTesoreria;
