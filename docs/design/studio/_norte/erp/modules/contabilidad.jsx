/* global React */
/* ── DTD ERP · Contabilidad · v2.5 ──────────────────────────── */
/* Módulo contable estilo QuickBooks Online · libros USD ·       */
/* VES referencia con tasa del día · plan de cuentas VE editable */

function ModuleContabilidad({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const ivaOn = window.DTDConfig ? window.DTDConfig.useCfg('iva') : false;
  const [tab, setTab] = React.useState('flujo');
  React.useEffect(() => { if (tab === 'fiscal' && !ivaOn) setTab('flujo'); }, [ivaOn]);
  const [lock, setLock] = React.useState(C.readLock());
  React.useEffect(() => {
    const handler = (e) => setLock(e.detail || C.readLock());
    window.addEventListener('dtd-contab-lock', handler);
    return () => window.removeEventListener('dtd-contab-lock', handler);
  }, []);
  const unlocked = !lock.locked || (lock.unlockedUntil && new Date(lock.unlockedUntil).getTime() > Date.now());

  // v2.5 · drawers de escritura + re-render al mutar el libro diario
  const [drawer, setDrawer] = React.useState(null); // { kind:'entry'|'pay'|'expense', entry? }
  const [, forceJ] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => forceJ();
    window.addEventListener('dtd-journal-changed', f);
    return () => window.removeEventListener('dtd-journal-changed', f);
  }, []);
  const openEntry = (entry = null) => setDrawer({ kind: 'entry', entry });
  const openPay = () => setDrawer({ kind: 'pay' });
  const openExpense = () => setDrawer({ kind: 'expense' });
  const closeDrawer = () => setDrawer(null);
  const Forms = window.ContabForms || {};
  const askDelete = (id) => {
    if (!unlocked) { alert('Activa "Edición abierta" para eliminar asientos.'); return; }
    if (window.confirm('¿Eliminar el asiento ' + id + '? Queda registrado en el audit log.')) {
      C.deleteEntry(id);
    }
  };

  return (
    <div>
      <U.PageHeader
        eyebrow="FINANZAS · LIBROS EN USD"
        title="Contabilidad"
        subtitle={`Plan de cuentas freight forwarder VE · ${C.JOURNAL_ENTRIES.length} asientos contabilizados · tasa BCV ${rates.bcv.toFixed(2)} · paralelo ${rates.parallel.toFixed(2)}`}
        actions={
          <>
            <U.Btn variant="secondary" icon={I.download(14)}>Exportar libros</U.Btn>
            <LockButton lock={lock} setLock={setLock} />
            <U.Btn variant="primary" icon={I.plus(14)} onClick={() => openEntry()}>Nuevo asiento</U.Btn>
          </>
        }
      />

      <U.Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'flujo',     label: 'Flujo de trabajo' },
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'journal',   label: 'Libro diario', count: C.JOURNAL_ENTRIES.length },
          { value: 'coa',       label: 'Plan de cuentas', count: C.CHART_OF_ACCOUNTS.filter(a => a.level === 3).length },
          { value: 'ledger',    label: 'Libro mayor' },
          { value: 'reports',   label: 'Reportes' },
          { value: 'cierre',    label: 'Cierre & ajustes' },
          { value: 'activos',   label: 'Activos fijos' },
          { value: 'subdiario', label: 'Por contabilizar' },
          ...(ivaOn ? [{ value: 'fiscal', label: 'Fiscal · SENIAT' }] : []),
          { value: 'config',    label: 'Configuración' },
        ]}
        style={{ marginBottom: 'var(--s-5)' }}
      />

      {tab === 'flujo'     && <FlujoTab goTo={goTo} />}
      {tab === 'dashboard' && <DashboardTab goTo={goTo} setTab={setTab} openEntry={openEntry} openPay={openPay} openExpense={openExpense} />}
      {tab === 'journal'   && <JournalTab unlocked={unlocked} onEdit={openEntry} onDelete={askDelete} />}
      {tab === 'coa'       && <CoATab unlocked={unlocked} />}
      {tab === 'ledger'    && <LedgerTab />}
      {tab === 'reports'   && <ReportsTab />}
      {tab === 'cierre'    && <CierreTab unlocked={unlocked} />}
      {tab === 'activos'   && <AssetsTab unlocked={unlocked} />}
      {tab === 'subdiario' && <PorContabilizarTab unlocked={unlocked} />}
      {tab === 'fiscal'    && (window.FiscalTab ? <window.FiscalTab /> : null)}
      {tab === 'config'    && <ConfigTab lock={lock} setLock={setLock} />}

      {Forms.EntryDrawer && <Forms.EntryDrawer open={drawer && drawer.kind === 'entry'} editEntry={drawer && drawer.entry} onClose={closeDrawer} />}
      {Forms.QuickPayDrawer && <Forms.QuickPayDrawer open={drawer && drawer.kind === 'pay'} onClose={closeDrawer} />}
      {Forms.QuickExpenseDrawer && <Forms.QuickExpenseDrawer open={drawer && drawer.kind === 'expense'} onClose={closeDrawer} />}
    </div>
  );
}

// ── Flujo de trabajo (workflow view · carriles financieros) ──
function FlujoTab({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const lanes = window.financeLanes ? window.financeLanes() : [];
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
        <span style={{ color: 'var(--wine)', display: 'inline-flex' }}>{I.flow ? I.flow(18) : I.chart(18)}</span>
        <span style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          El ciclo contable de DTD-Cargo de un vistazo. Haz click en cualquier paso para ir a la acción · los números en rojo marcan pendientes.
        </span>
      </div>
      {window.WorkflowMap
        ? <window.WorkflowMap lanes={lanes} goTo={goTo} />
        : <U.EmptyState icon={I.chart(22)} title="Flujo no disponible" body="El módulo de flujo de trabajo no está cargado." />}
    </div>
  );
}

// ── Lock button ──────────────────────────────────────────────
function LockButton({ lock, setLock }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const unlocked = !lock.locked || (lock.unlockedUntil && new Date(lock.unlockedUntil).getTime() > Date.now());
  const handle = () => {
    if (unlocked) {
      C.writeLock({ locked: true, unlockedBy: null, unlockedUntil: null });
      setLock({ locked: true, unlockedBy: null, unlockedUntil: null });
      return;
    }
    const pwd = window.prompt('Modo edición · Ingresar contraseña de Contabilidad o Admin:');
    if (pwd && pwd.length >= 4) {
      const until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const newState = { locked: false, unlockedBy: 'Andrés B. (Contabilidad)', unlockedUntil: until };
      C.writeLock(newState);
      setLock(newState);
    } else if (pwd !== null) {
      alert('Contraseña incorrecta');
    }
  };
  return (
    <U.Btn
      variant={unlocked ? 'soft' : 'secondary'}
      icon={unlocked ? I.check(13) : I.shield(13)}
      onClick={handle}
    >
      {unlocked ? 'Edición abierta · 30 min' : 'Modo seguro'}
    </U.Btn>
  );
}

// ════════════════════════════════════════════════════════════════
// Dashboard (QuickBooks-style)
// ════════════════════════════════════════════════════════════════
function DashboardTab({ goTo, setTab, openEntry, openPay, openExpense }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const pl = C.calculatePL();
  const grpUsd   = C.accountBalance('1.04'); // USD: bancos + USDT
  const grpVes   = C.accountBalance('1.01'); // Bolívar (VES)
  const grpChina = C.accountBalance('1.03'); // China (Alipay / cambistas)
  const grpCaja  = C.accountBalance('1.02'); // Caja / efectivo
  const cxc = C.accountBalance('1.05');      // Cuentas por cobrar
  const cxp = C.accountBalance('2.01');      // Cuentas por pagar
  const totalCaja = grpUsd + grpVes + grpChina + grpCaja;

  const quickActions = [
    { label: 'Nueva factura',       icon: I.invoice(20), to: () => goTo('invoices', null, 'create'), tone: 'wine' },
    { label: 'Registrar pago',       icon: I.check(20),   to: () => openPay(),     tone: 'success' },
    { label: 'Registrar gasto',      icon: I.plus(20),    to: () => openExpense(), tone: 'info' },
    { label: 'Conciliar banco',      icon: I.chart(20),   to: () => goTo('reconcile'),               tone: 'warning' },
    { label: 'Nuevo asiento manual', icon: I.edit(20),    to: () => openEntry(),                      tone: 'neutral' },
    { label: 'Ver reportes',         icon: I.chart(20),   to: () => setTab('reports'),                tone: 'wine' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <U.KPI label="Ingresos · mes"     value={R.fmtUsd(pl.totalIngresos)}    delta={R.fmtBs(R.usdToVes(pl.totalIngresos))} tone="success" icon={I.chart(18)} />
        <U.KPI label="Costos directos"    value={R.fmtUsd(pl.totalCgs)}         delta={`${((pl.totalCgs / pl.totalIngresos) * 100).toFixed(0)}% sobre ingresos`} tone="warning" icon={I.box(18)} />
        <U.KPI label="Gastos operativos"  value={R.fmtUsd(pl.totalGastos)}      delta={`${((pl.totalGastos / pl.totalIngresos) * 100).toFixed(0)}% sobre ingresos`} tone="info" icon={I.invoice(18)} />
        <U.KPI label="Utilidad neta"      value={R.fmtUsd(pl.utilidadNeta)}     delta={`Margen ${((pl.utilidadNeta / pl.totalIngresos) * 100).toFixed(1)}%`} tone={pl.utilidadNeta > 0 ? 'wine' : 'danger'} icon={I.spark(18)} />
      </div>

      {/* Quick actions */}
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>ACCIONES RÁPIDAS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {quickActions.map(a => (
            <button key={a.label} onClick={a.to} style={{
              display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start',
              padding: '14px 14px', borderRadius: 'var(--r-md)',
              background: 'var(--bg-elevated)', textAlign: 'left',
              transition: 'background var(--dur-fast) var(--ease)',
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = `var(--${a.tone}-bg)`}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
            >
              <span style={{ color: `var(--${a.tone})` }}>{a.icon}</span>
              <span style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{a.label}</span>
            </button>
          ))}
        </div>
      </U.Card>

      {/* 2-col: Bank balances + AR/AP */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CUENTAS BANCARIAS · SALDOS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { code: '1.04', label: 'USD · bancos + USDT',     tone: 'wine',    balance: grpUsd,   currency: 'USD' },
              { code: '1.01', label: 'Bolívar · VES',           tone: 'info',    balance: grpVes,   currency: 'USD', ves: true },
              { code: '1.03', label: 'China · Alipay/cambistas', tone: 'success', balance: grpChina, currency: 'USD' },
              { code: '1.02', label: 'Caja · efectivo',         tone: 'neutral', balance: grpCaja,  currency: 'USD' },
            ].map(b => (
              <div key={b.code} style={{
                display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 12, alignItems: 'center',
                padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
              }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--${b.tone})` }} />
                <div>
                  <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{b.label}</div>
                  <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4, display: 'inline-block' }}>{b.code}</code>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '800 14px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(b.balance)}</div>
                  {b.ves && b.balance > 0 && (
                    <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>{R.fmtBs(R.usdToVes(b.balance))}</div>
                  )}
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 6, padding: '12px 14px', background: 'var(--bg-sidebar)', color: '#fff',
              borderRadius: 'var(--r-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>TOTAL CAJA + BANCOS</div>
                <div style={{ font: '500 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)' }}>Liquidez disponible</div>
              </div>
              <div style={{ font: '900 22px/1 var(--f-display)' }}>{R.fmtUsd(totalCaja)}</div>
            </div>
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CUENTAS POR COBRAR / PAGAR</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '14px 16px', background: 'var(--success-bg)', borderLeft: '4px solid var(--success)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CxC · Por cobrar</span>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>1.05</code>
              </div>
              <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(cxc)}</div>
              <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
                Equivalente a {R.fmtBs(R.usdToVes(cxc))} @ BCV
              </div>
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--warning-bg)', borderLeft: '4px solid var(--warning)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--warning)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CxP · Por pagar</span>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>2.01</code>
              </div>
              <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(cxp)}</div>
              <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
                Equivalente a {R.fmtBs(R.usdToVes(cxp))} @ BCV
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>Posición neta (CxC − CxP)</span>
                <span style={{ font: '900 16px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(cxc - cxp)}</span>
              </div>
            </div>
          </div>
        </U.Card>
      </div>

      {/* Recent journal entries */}
      <U.Card padded={false}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="eyebrow eyebrow-wine">ÚLTIMOS ASIENTOS</div>
            <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Actividad reciente del libro diario</div>
          </div>
          <button onClick={() => setTab('journal')} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Ver libro diario {I.arrowR(11)}
          </button>
        </div>
        <div>
          {C.JOURNAL_ENTRIES.slice(0, 5).map((e, i) => {
            const totalDebit = e.lines.reduce((s, l) => s + l.debit, 0);
            return (
              <div key={e.id} style={{
                display: 'grid', gridTemplateColumns: '110px 90px 1fr 110px 90px',
                gap: 14, alignItems: 'center', padding: '12px 20px',
                borderTop: i > 0 ? '1px solid var(--border)' : 0,
              }}>
                <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{e.id}</code>
                <div style={{ font: '500 11px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{e.date.slice(5)}</div>
                <div style={{ font: '500 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{e.concept}</div>
                <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(totalDebit)}</div>
                <U.Badge tone={e.status === 'contabilizado' ? 'success' : 'warning'} size="sm" dot>{e.status}</U.Badge>
              </div>
            );
          })}
        </div>
      </U.Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Libro diario (Journal entries)
// ════════════════════════════════════════════════════════════════
function JournalTab({ unlocked, onEdit, onDelete }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [selected, setSelected] = React.useState(null);

  const filtered = C.JOURNAL_ENTRIES.filter(e => {
    if (typeFilter !== 'all' && e.refType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.id.toLowerCase().includes(q) && !e.concept.toLowerCase().includes(q) && !e.ref.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por asiento, concepto o referencia…"
        filters={
          <U.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[
            { value: 'all',         label: 'Todos los tipos' },
            { value: 'invoice',     label: 'Facturas emitidas' },
            { value: 'payment',     label: 'Pagos USD' },
            { value: 'payment-ves', label: 'Pagos VES' },
            { value: 'expense',     label: 'Gastos' },
            { value: 'unclassified', label: 'Por clasificar' },
          ]} style={{ minWidth: 200 }} />
        }
      />

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '110px 90px 1fr 100px 110px 110px 90px',
          padding: '10px 18px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)',
          letterSpacing: '0.1em', textTransform: 'uppercase', gap: 14,
        }}>
          <span>Asiento</span>
          <span>Fecha</span>
          <span>Concepto</span>
          <span>Referencia</span>
          <span style={{ textAlign: 'right' }}>Débito</span>
          <span style={{ textAlign: 'right' }}>Crédito</span>
          <span>Estado</span>
        </div>
        {filtered.map((e, i) => {
          const totalDebit = e.lines.reduce((s, l) => s + l.debit, 0);
          const totalCredit = e.lines.reduce((s, l) => s + l.credit, 0);
          return (
            <div key={e.id} onClick={() => setSelected(e.id)} style={{
              display: 'grid', gridTemplateColumns: '110px 90px 1fr 100px 110px 110px 90px',
              padding: '12px 18px', gap: 14, alignItems: 'center', cursor: 'pointer',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
              background: selected === e.id ? 'var(--wine-tint)' : (e.flagged ? 'var(--danger-bg)' : 'transparent'),
              transition: 'background var(--dur-fast) var(--ease)',
            }}
              onMouseEnter={(ev) => { if (selected !== e.id && !e.flagged) ev.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(ev) => { if (selected !== e.id && !e.flagged) ev.currentTarget.style.background = 'transparent'; }}
            >
              <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{e.id}</code>
              <div style={{ font: '500 11px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{e.date.slice(5)}</div>
              <div>
                <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{e.concept}</div>
                {e.forex && (
                  <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>
                    Bs. {e.forex.originalAmount.toLocaleString('es-VE')} @ {e.forex.rate.toFixed(2)} ({e.forex.rateSource})
                  </div>
                )}
              </div>
              <code style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{e.ref}</code>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(totalDebit)}</div>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(totalCredit)}</div>
              <U.Badge tone={e.status === 'contabilizado' ? 'success' : 'warning'} size="sm" dot>{e.status}</U.Badge>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
            Sin asientos con esos filtros.
          </div>
        )}
      </U.Card>

      <JournalDetailDrawer
        entry={selected ? C.JOURNAL_ENTRIES.find(e => e.id === selected) : null}
        onClose={() => setSelected(null)}
        unlocked={unlocked}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  );
}

function JournalDetailDrawer({ entry, onClose, unlocked, onEdit, onDelete }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  if (!entry) return null;
  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0);
  return (
    <U.Drawer
      open={!!entry}
      onClose={onClose}
      title={entry.id}
      subtitle={`${entry.date} · ${entry.concept}`}
      width={720}
      actions={
        <>
          <U.Btn variant="ghost" disabled={!unlocked} style={{ color: 'var(--danger)' }} onClick={() => { onDelete && onDelete(entry.id); }}>Eliminar asiento</U.Btn>
          <U.Btn variant="secondary" disabled={!unlocked} onClick={() => { onEdit && onEdit(entry); onClose(); }}>Editar</U.Btn>
          <U.Btn variant="secondary" icon={I.download(13)}>Imprimir</U.Btn>
          <U.Btn variant="primary" onClick={onClose}>Cerrar</U.Btn>
        </>
      }
    >
      {!unlocked && (
        <div style={{
          padding: '10px 12px', marginBottom: 16,
          background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)', borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ color: 'var(--warning)' }}>{I.shield(14)}</span>
          <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            <strong>Modo seguro activo.</strong> Activa "Edición abierta" en el header con la contraseña de Contabilidad o Admin para editar.
          </span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <U.Field label="Fecha contable" value={entry.date} mono />
        <U.Field label="Referencia"      value={entry.ref} mono />
        <U.Field label="Creado por"     value={entry.user} />
        <U.Field label="Creado"          value={entry.createdAt} mono />
        <U.Field label="Estado"          value={<U.Badge tone={entry.status === 'contabilizado' ? 'success' : 'warning'} dot>{entry.status}</U.Badge>} />
        <U.Field label="Tipo"            value={entry.refType} />
      </div>

      {entry.forex && (
        <div style={{
          marginBottom: 18, padding: '12px 14px',
          background: 'var(--info-bg)', borderLeft: '3px solid var(--info)', borderRadius: 'var(--r-md)',
        }}>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--info)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>CONVERSIÓN A USD</div>
          <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            Monto original: <strong>Bs. {entry.forex.originalAmount.toLocaleString('es-VE')}</strong> · Tasa aplicada: <strong>{entry.forex.rate.toFixed(2)}</strong> ({entry.forex.rateSource}) → <strong>{R.fmtUsd(totalDebit)}</strong>
          </div>
        </div>
      )}

      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>LÍNEAS DEL ASIENTO · {entry.lines.length}</div>
      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '110px 1fr 1fr 110px 110px',
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)',
          letterSpacing: '0.1em', textTransform: 'uppercase', gap: 14,
        }}>
          <span>Cuenta</span>
          <span>Nombre</span>
          <span>Memo</span>
          <span style={{ textAlign: 'right' }}>Débito</span>
          <span style={{ textAlign: 'right' }}>Crédito</span>
        </div>
        {entry.lines.map((l, i) => {
          const acc = C.getAccount(l.account);
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '110px 1fr 1fr 110px 110px',
              padding: '10px 16px', gap: 14, alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{l.account}</code>
              <span style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{acc?.name || '—'}</span>
              <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{l.memo}</span>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: l.debit > 0 ? 'var(--ink)' : 'var(--ink-mute)' }}>{l.debit > 0 ? R.fmtUsd(l.debit) : '—'}</div>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: l.credit > 0 ? 'var(--ink)' : 'var(--ink-mute)' }}>{l.credit > 0 ? R.fmtUsd(l.credit) : '—'}</div>
            </div>
          );
        })}
        <div style={{
          display: 'grid', gridTemplateColumns: '110px 1fr 1fr 110px 110px',
          padding: '12px 16px', gap: 14, alignItems: 'center',
          borderTop: '2px solid var(--ink)', background: 'var(--bg-elevated)',
          font: '900 13px/1 var(--f-display)',
        }}>
          <span></span>
          <span></span>
          <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Totales</span>
          <div style={{ textAlign: 'right', font: '900 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(totalDebit)}</div>
          <div style={{ textAlign: 'right', font: '900 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(totalCredit)}</div>
        </div>
      </U.Card>

      {totalDebit !== totalCredit && (
        <div style={{
          marginTop: 12, padding: '10px 12px', background: 'var(--danger-bg)', borderLeft: '3px solid var(--danger)', borderRadius: 'var(--r-md)',
          font: '600 12px/1.4 var(--f-sans)', color: 'var(--danger)',
        }}>
          ⚠ Asiento descuadrado · diferencia {R.fmtUsd(Math.abs(totalDebit - totalCredit))}
        </div>
      )}
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Plan de Cuentas (CoA)
// ════════════════════════════════════════════════════════════════
function CoATab({ unlocked }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editCode, setEditCode] = React.useState(null);
  const [hideInactive, setHideInactive] = React.useState(false);
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-coa-changed', f);
    return () => window.removeEventListener('dtd-coa-changed', f);
  }, []);

  const filtered = C.CHART_OF_ACCOUNTS.filter(a => {
    if (hideInactive && a.inactive) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar cuenta por código o nombre…"
        filters={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <U.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[
              { value: 'all', label: 'Todos los tipos' },
              ...Object.entries(C.TYPE_LABEL).map(([k, v]) => ({ value: k, label: v.label })),
            ]} style={{ minWidth: 180 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={hideInactive} onChange={(e) => setHideInactive(e.target.checked)} style={{ accentColor: 'var(--wine)', width: 15, height: 15 }} />
              Ocultar inactivas
            </label>
          </div>
        }
        actions={<U.Btn variant="primary" size="sm" icon={I.plus(12)} onClick={() => setCreateOpen(true)}>Nueva cuenta</U.Btn>}
      />

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 1fr 130px 130px 88px',
          padding: '10px 18px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)',
          letterSpacing: '0.1em', textTransform: 'uppercase', gap: 14,
        }}>
          <span>Código</span>
          <span>Nombre</span>
          <span>Tipo</span>
          <span style={{ textAlign: 'right' }}>Saldo</span>
          <span></span>
        </div>
        {filtered.map((a, i) => {
          const meta = C.TYPE_LABEL[a.type];
          const leaf = C.isLeaf(a.code);
          const balance = leaf ? C.accountBalance(a.code) : 0;
          return (
            <div key={a.code} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr 130px 130px 88px',
              padding: '10px 18px', gap: 14, alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
              background: a.level === 1 ? 'var(--bg-elevated)' : 'transparent',
              opacity: a.inactive ? 0.5 : 1,
            }}>
              <code style={{
                font: `${a.level === 1 ? '900' : a.level === 2 ? '700' : '600'} ${a.level === 1 ? '13' : '11.5'}px/1 var(--f-mono)`,
                color: a.level === 1 ? 'var(--wine)' : 'var(--ink)',
                paddingLeft: (a.level - 1) * 14,
              }}>{a.code}</code>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, paddingLeft: (a.level - 1) * 14 }}>
                <span style={{
                  font: `${a.level === 1 ? '900' : a.level === 2 ? '700' : '500'} ${a.level === 1 ? '13' : '12.5'}px/1.2 var(--f-${a.level === 1 ? 'display' : 'sans'})`,
                  color: 'var(--ink)',
                  letterSpacing: a.level === 1 ? '0.04em' : 0,
                  textTransform: a.level === 1 ? 'uppercase' : 'none',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{a.name}</span>
                {a.inactive && <U.Badge tone="neutral" size="sm">Inactiva</U.Badge>}
                {a.custom && !a.inactive && <U.Badge tone="info" size="sm">Propia</U.Badge>}
              </span>
              <U.Badge tone={meta?.tone || 'neutral'} size="sm">{meta?.label || a.type}</U.Badge>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: balance !== 0 ? 'var(--ink)' : 'var(--ink-mute)' }}>
                {leaf ? R.fmtUsd(balance) : '—'}
              </div>
              <div style={{ textAlign: 'right' }}>
                {leaf && (
                  <button onClick={() => setEditCode(a.code)} title="Editar cuenta" style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    {I.edit(12)} Editar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </U.Card>
      <NewAccountDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditAccountDrawer code={editCode} unlocked={unlocked} onClose={() => setEditCode(null)} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Libro Mayor (General Ledger)
// ════════════════════════════════════════════════════════════════
function NewAccountDrawer({ open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const TYPES = [['A', 'Activo'], ['P', 'Pasivo'], ['PT', 'Patrimonio'], ['I', 'Ingreso'], ['CGS', 'Costo directo'], ['G', 'Gasto']];
  const parentsFor = (t) => C.CHART_OF_ACCOUNTS.filter(a => a.type === t && (a.level === 2 || (a.level === 1 && !C.CHART_OF_ACCOUNTS.some(x => x.parent === a.code && x.level === 2))));

  const [type, setType] = React.useState('A');
  const [detailId, setDetailId] = React.useState('banco');
  const [parent, setParent] = React.useState('1.1');
  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [currency, setCurrency] = React.useState('USD');
  const [methods, setMethods] = React.useState([]);
  const [defMethod, setDefMethod] = React.useState(null);
  const [opening, setOpening] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [done, setDone] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    const dl = C.ACCOUNT_DETAIL_TYPES['A']; const ps = parentsFor('A');
    setType('A'); setDetailId(dl[0]?.id); setParent(ps[0]?.code); setName('');
    setCode(C.nextAccountCode(ps[0]?.code)); setCurrency('USD'); setMethods([]); setDefMethod(null);
    setOpening(''); setDesc(''); setDone(null);
  }, [open]);

  const detailList = C.ACCOUNT_DETAIL_TYPES[type] || [];
  const detail = detailList.find(d => d.id === detailId) || detailList[0];
  const isBank = !!detail?.bank;
  const parents = parentsFor(type);

  const onType = (t) => {
    const dl = C.ACCOUNT_DETAIL_TYPES[t] || []; const ps = parentsFor(t);
    setType(t); setDetailId(dl[0]?.id); setParent(ps[0]?.code); setCode(C.nextAccountCode(ps[0]?.code));
  };
  const onParent = (p) => { setParent(p); setCode(C.nextAccountCode(p)); };
  const toggleMethod = (id) => {
    setMethods(ms => {
      const has = ms.includes(id);
      const next = has ? ms.filter(m => m !== id) : [...ms, id];
      if (has && defMethod === id) setDefMethod(next[0] || null);
      if (!has && !defMethod) setDefMethod(id);
      return next;
    });
  };

  const canCreate = name.trim() && code.trim() && parent && (!isBank || methods.length > 0);
  const create = () => {
    setDone(C.createAccount({
      code: code.trim(), name: name.trim(), type, parent, detail: detailId,
      ...(isBank ? { currency, methods, defaultMethod: defMethod || methods[0], opening: Number(opening) || 0 } : {}),
      desc: desc.trim() || undefined,
    }));
  };

  const Label = ({ children, hint }) => (
    <div style={{ marginBottom: 6 }}>
      <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</span>
      {hint && <span style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginLeft: 8 }}>{hint}</span>}
    </div>
  );
  const inputBox = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.3 var(--f-sans)' };
  const methodCcy = { USD: 'success', VES: 'info', USDT: 'wine' };

  return (
    <U.Drawer open={open} onClose={onClose} width={560}
      title={done ? 'Cuenta creada' : 'Nueva cuenta'}
      subtitle={done ? null : 'Tipo → detalle → cuenta, como en QuickBooks'}
      actions={done ?
        <U.Btn variant="primary" onClick={onClose}>Listo</U.Btn> :
        <React.Fragment>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={I.check(14)} disabled={!canCreate} onClick={create}>Crear cuenta</U.Btn>
        </React.Fragment>}
    >
      {done ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: 16, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--success)' }}>{I.check(18)}</span>
            <div style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
              <b><code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{done.code}</code> · {done.name}</b> quedó en el plan de cuentas bajo <b>{C.getAccount(done.parent)?.name}</b>.
              {done.methods && <span> Recibe {done.methods.length} método(s) de pago · predeterminado <b>{(C.PAYMENT_METHODS.find(m => m.id === done.defaultMethod) || {}).label}</b>.</span>}
            </div>
          </div>
        </div> :
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '10px 13px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            El <b>tipo</b> define dónde cae en los estados (activo, pasivo…); el <b>detalle</b> afina el comportamiento. Si eliges <b>Banco</b> o <b>Caja</b>, puedes vincularle los métodos de pago que recibe.
          </div>

          <div>
            <Label>Tipo de cuenta</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {TYPES.map(([id, lbl]) => {
                const on = type === id;
                return (
                  <button key={id} onClick={() => onType(id)} style={{
                    padding: '9px 8px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                    border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'),
                    background: on ? 'var(--wine-tint)' : 'var(--bg-surface)',
                    color: on ? 'var(--wine)' : 'var(--ink)', font: `${on ? '700' : '500'} 12px/1 var(--f-sans)`,
                  }}>{lbl}</button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Detalle</Label>
              <U.Select value={detailId} onChange={(e) => setDetailId(e.target.value)} options={detailList.map(d => ({ value: d.id, label: d.label }))} />
            </div>
            <div>
              <Label>Cuenta padre</Label>
              <U.Select value={parent} onChange={(e) => onParent(e.target.value)} options={parents.map(p => ({ value: p.code, label: `${p.code} · ${p.name}` }))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
            <div>
              <Label>Nombre de la cuenta</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isBank ? 'Ej. Banco Provincial · USD' : 'Nombre de la cuenta'} style={inputBox} />
            </div>
            <div>
              <Label hint="auto">Código</Label>
              <input value={code} onChange={(e) => setCode(e.target.value)} style={{ ...inputBox, fontFamily: 'var(--f-mono)', fontWeight: 700 }} />
            </div>
          </div>

          {isBank &&
          <React.Fragment>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Label>Moneda</Label>
                <U.Select value={currency} onChange={(e) => setCurrency(e.target.value)} options={[{ value: 'USD', label: 'USD · dólares' }, { value: 'VES', label: 'VES · bolívares' }, { value: 'USDT', label: 'USDT · cripto' }]} />
              </div>
              <div>
                <Label hint="opcional">Saldo inicial</Label>
                <window.ERPUI.CalcInput value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" style={{ ...inputBox, fontFamily: 'var(--f-mono)', fontWeight: 700 }} />
              </div>
            </div>

            <div>
              <Label>Métodos de pago que recibe</Label>
              <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: -2, marginBottom: 8 }}>
                Marca los que entran a esta cuenta. Uno queda <b>por defecto</b> (se usa al cobrar/pagar sin tener que elegirlo); el resto quedan opcionales.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {C.PAYMENT_METHODS.map(m => {
                  const on = methods.includes(m.id);
                  const isDef = defMethod === m.id;
                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 'var(--r-md)',
                      border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'),
                      background: on ? 'var(--wine-tint)' : 'var(--bg-surface)',
                    }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0 }}>
                        <input type="checkbox" checked={on} onChange={() => toggleMethod(m.id)} style={{ accentColor: 'var(--wine)', width: 16, height: 16 }} />
                        <span style={{ font: `${on ? '600' : '500'} 12.5px/1.2 var(--f-sans)`, color: 'var(--ink)' }}>{m.label}</span>
                        <window.ERPUI.Badge tone={methodCcy[m.ccy] || 'neutral'} size="sm">{m.ccy}</window.ERPUI.Badge>
                      </label>
                      <button onClick={() => on && setDefMethod(m.id)} disabled={!on} title="Marcar por defecto" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: on ? 'pointer' : 'not-allowed',
                        opacity: on ? 1 : 0.4, font: '700 10px/1 var(--f-sans)', letterSpacing: '0.04em',
                        color: isDef ? 'var(--wine)' : 'var(--ink-mute)', background: 'transparent', border: 'none',
                      }}>
                        <span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid ' + (isDef ? 'var(--wine)' : 'var(--border)'), background: isDef ? 'var(--wine)' : 'transparent', boxShadow: isDef ? 'inset 0 0 0 2px var(--bg-surface)' : 'none' }} />
                        {isDef ? 'POR DEFECTO' : 'Predeterminar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </React.Fragment>}

          {!isBank &&
          <div>
            <Label hint="opcional">Descripción</Label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Para qué se usa esta cuenta" style={inputBox} />
          </div>}

          {/* Preview */}
          <div style={{ padding: '11px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Quedará así</span>
            <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{code || '—'}</code>
            <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || 'Nombre de la cuenta'}</span>
            <window.ERPUI.Badge tone={C.TYPE_LABEL[type]?.tone || 'neutral'} size="sm">{C.TYPE_LABEL[type]?.label}</window.ERPUI.Badge>
          </div>
        </div>}
    </U.Drawer>
  );
}

// ── Editar / inactivar cuenta (v2.5) ─────────────────────────
function EditAccountDrawer({ code, unlocked, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const acc = code ? C.getAccount(code) : null;
  const [name, setName] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [active, setActive] = React.useState(true);
  React.useEffect(() => {
    if (acc) { setName(acc.name || ''); setDesc(acc.desc || ''); setActive(!acc.inactive); }
  }, [code]);
  if (!acc) return null;
  const meta = C.TYPE_LABEL[acc.type];
  const bal = C.accountBalance(code);
  const parent = acc.parent ? C.getAccount(acc.parent) : null;
  const save = () => {
    C.updateAccount(code, { name: name.trim() || acc.name, desc: desc.trim() || undefined });
    C.setAccountActive(code, active);
    onClose();
  };
  const inputBox = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.3 var(--f-sans)' };
  const Label = ({ children, hint }) => (
    <div style={{ marginBottom: 6 }}>
      <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{children}</span>
      {hint && <span style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginLeft: 8 }}>{hint}</span>}
    </div>
  );
  return (
    <U.Drawer open={!!code} onClose={onClose} width={520}
      title={`Editar ${code}`}
      subtitle={acc.name}
      actions={
        <React.Fragment>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={I.check(14)} disabled={!unlocked} onClick={save}>Guardar</U.Btn>
        </React.Fragment>
      }
    >
      {!unlocked && (
        <div style={{ padding: '10px 12px', marginBottom: 16, background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--warning)' }}>{I.shield(14)}</span>
          <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            <strong>Modo seguro activo.</strong> Activa "Edición abierta" en el header para guardar cambios.
          </span>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Field label="Código" value={acc.code} mono />
          <U.Field label="Tipo" value={<U.Badge tone={meta?.tone || 'neutral'} size="sm">{meta?.label || acc.type}</U.Badge>} />
          {parent && <U.Field label="Cuenta padre" value={`${parent.code} · ${parent.name}`} />}
          <U.Field label="Saldo actual" value={R.fmtUsd(bal)} mono />
        </div>
        <div>
          <Label>Nombre de la cuenta</Label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputBox} />
        </div>
        <div>
          <Label hint="opcional">Descripción</Label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Para qué se usa esta cuenta" style={inputBox} />
        </div>
        <div>
          <Label>Estado</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['activa', true], ['inactiva', false]].map(([lbl, val]) => {
              const on = active === val;
              return (
                <button key={lbl} onClick={() => setActive(val)} style={{
                  padding: '9px 8px', borderRadius: 'var(--r-md)', cursor: 'pointer', textTransform: 'capitalize',
                  border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'),
                  background: on ? 'var(--wine-tint)' : 'var(--bg-surface)',
                  color: on ? 'var(--wine)' : 'var(--ink)', font: `${on ? '700' : '500'} 12.5px/1 var(--f-sans)`,
                }}>{lbl}</button>
              );
            })}
          </div>
          <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 8 }}>
            Una cuenta <b>inactiva</b> no aparece al cargar asientos, pagos ni gastos. Su saldo e historial se conservan en los reportes.
          </div>
        </div>
      </div>
    </U.Drawer>
  );
}

function LedgerTab() {
  const U = window.ERPUI;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const realAccounts = C.CHART_OF_ACCOUNTS.filter(a => a.level === 3);
  const [code, setCode] = React.useState(realAccounts[0]?.code);
  const account = C.getAccount(code);
  const movs = C.accountMovements(code).sort((a, b) => a.date.localeCompare(b.date));
  const meta = C.TYPE_LABEL[account?.type];

  let running = 0;
  const movsWithBal = movs.map(m => {
    const acc = C.getAccount(m.account);
    const isDeudor = ['A', 'G', 'CGS'].includes(acc?.type);
    if (isDeudor) running += (m.debit || 0) - (m.credit || 0);
    else running += (m.credit || 0) - (m.debit || 0);
    return { ...m, runBal: running };
  });

  return (
    <div>
      <U.Card padded style={{ marginBottom: 14, display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 18, alignItems: 'center' }}>
        <U.Select value={code} onChange={(e) => setCode(e.target.value)}
          options={realAccounts.map(a => ({ value: a.code, label: `${a.code} · ${a.name}` }))}
          label="Cuenta"
        />
        {account && (
          <>
            <div>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Tipo</div>
              <U.Badge tone={meta?.tone || 'neutral'}>{meta?.label}</U.Badge>
            </div>
            <div>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Movimientos</div>
              <span style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)' }}>{movs.length}</span>
            </div>
            <div>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Saldo actual</div>
              <span style={{ font: '900 18px/1 var(--f-display)', color: 'var(--wine)' }}>{R.fmtUsd(C.accountBalance(code))}</span>
            </div>
          </>
        )}
      </U.Card>

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 110px 1fr 100px 100px 110px',
          padding: '10px 18px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)',
          letterSpacing: '0.1em', textTransform: 'uppercase', gap: 14,
        }}>
          <span>Fecha</span>
          <span>Asiento</span>
          <span>Concepto</span>
          <span style={{ textAlign: 'right' }}>Débito</span>
          <span style={{ textAlign: 'right' }}>Crédito</span>
          <span style={{ textAlign: 'right' }}>Saldo</span>
        </div>
        {movsWithBal.length === 0 && (
          <div style={{ padding: '30px 20px', textAlign: 'center', font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
            Sin movimientos en esta cuenta.
          </div>
        )}
        {movsWithBal.map((m, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '90px 110px 1fr 100px 100px 110px',
            padding: '10px 18px', gap: 14, alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
          }}>
            <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{m.date.slice(5)}</span>
            <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{m.entryId}</code>
            <span style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{m.memo} <span style={{ color: 'var(--ink-mute)' }}>· {m.concept}</span></span>
            <div style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: m.debit > 0 ? 'var(--ink)' : 'var(--ink-mute)' }}>{m.debit > 0 ? R.fmtUsd(m.debit) : '—'}</div>
            <div style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: m.credit > 0 ? 'var(--ink)' : 'var(--ink-mute)' }}>{m.credit > 0 ? R.fmtUsd(m.credit) : '—'}</div>
            <div style={{ textAlign: 'right', font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(m.runBal)}</div>
          </div>
        ))}
      </U.Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Reportes
// ════════════════════════════════════════════════════════════════
function ReportsTab() {
  const U = window.ERPUI;
  const [sub, setSub] = React.useState('pl');
  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <U.Tabs
          value={sub}
          onChange={setSub}
          items={[
            { value: 'pl',      label: 'Estado de Resultados' },
            { value: 'bs',      label: 'Balance General' },
            { value: 'cf',      label: 'Flujo de caja' },
            { value: 'margin',  label: 'Margen por embarque' },
          ]}
        />
      </div>
      {sub === 'pl'     && <PLReport />}
      {sub === 'bs'     && <BSReport />}
      {sub === 'cf'     && <CFReport />}
      {sub === 'margin' && <MarginReport />}
    </div>
  );
}

function PLReport() {
  const U = window.ERPUI;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const pl = C.calculatePL();
  const Row = ({ label, value, bold, indent, tone = 'ink' }) => (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14,
      padding: '8px 18px', borderTop: '1px solid var(--border)',
      background: bold ? 'var(--bg-elevated)' : 'transparent',
    }}>
      <span style={{
        font: `${bold ? '900' : '500'} ${bold ? '13' : '12.5'}px/1.3 var(--f-${bold ? 'display' : 'sans'})`,
        color: `var(--${tone})`,
        paddingLeft: (indent || 0) * 16,
        letterSpacing: bold ? '0.02em' : 0,
        textTransform: bold ? 'uppercase' : 'none',
      }}>{label}</span>
      <span style={{ textAlign: 'right', font: `${bold ? '900' : '600'} ${bold ? '13' : '12'}px/1 var(--f-mono)`, color: `var(--${tone})` }}>{R.fmtUsd(value)}</span>
    </div>
  );
  return (
    <U.Card padded={false}>
      <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">ESTADO DE RESULTADOS · MAY 2026</div>
        <div style={{ font: '900 20px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>DTD-Cargo C.A.</div>
        <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
          Período: 01 may 2026 → 24 may 2026 · Moneda funcional: USD · Tasa de referencia BCV
        </div>
      </div>
      <Row label="INGRESOS" bold tone="success" />
      {pl.ingresos.filter(r => r.balance !== 0).map(r => <Row key={r.account.code} label={`${r.account.code} · ${r.account.name}`} value={r.balance} indent={1} />)}
      <Row label="Total ingresos" value={pl.totalIngresos} bold tone="success" />
      <Row label="COSTOS DIRECTOS" bold tone="wine" />
      {pl.cgs.filter(r => r.balance !== 0).map(r => <Row key={r.account.code} label={`${r.account.code} · ${r.account.name}`} value={r.balance} indent={1} />)}
      <Row label="Total costos directos" value={pl.totalCgs} bold tone="wine" />
      <Row label="UTILIDAD BRUTA" value={pl.utilidadBruta} bold tone={pl.utilidadBruta > 0 ? 'success' : 'danger'} />
      <Row label="GASTOS OPERATIVOS" bold tone="warning" />
      {pl.gastos.filter(r => r.balance !== 0).map(r => <Row key={r.account.code} label={`${r.account.code} · ${r.account.name}`} value={r.balance} indent={1} />)}
      <Row label="Total gastos operativos" value={pl.totalGastos} bold tone="warning" />
      <Row label="UTILIDAD OPERATIVA" value={pl.utilidadOperativa} bold tone={pl.utilidadOperativa > 0 ? 'success' : 'danger'} />
      {pl.otros.filter(r => r.balance !== 0).length > 0 && <>
        <Row label="OTROS RESULTADOS" bold tone="info" />
        {pl.otros.filter(r => r.balance !== 0).map(r => <Row key={r.account.code} label={`${r.account.code} · ${r.account.name}`} value={r.balance} indent={1} />)}
      </>}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14,
        padding: '14px 18px', borderTop: '2px solid var(--ink)',
        background: 'var(--bg-sidebar)', color: '#fff',
      }}>
        <span style={{ font: '900 15px/1 var(--f-display)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>UTILIDAD NETA</span>
        <span style={{ textAlign: 'right', font: '900 18px/1 var(--f-mono)', color: pl.utilidadNeta > 0 ? 'var(--success)' : 'var(--danger)' }}>{R.fmtUsd(pl.utilidadNeta)}</span>
      </div>
      <div style={{ padding: '10px 18px', font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)', background: 'var(--bg-elevated)' }}>
        Equivalente en VES: {R.fmtBs(R.usdToVes(pl.utilidadNeta))} @ tasa BCV del cierre · Margen neto {((pl.utilidadNeta / pl.totalIngresos) * 100).toFixed(2)}%
      </div>
    </U.Card>
  );
}

function BSReport() {
  const U = window.ERPUI;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const bs = C.calculateBS();
  const Row = ({ label, value, bold, indent, tone = 'ink' }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14, padding: '8px 18px', borderTop: '1px solid var(--border)', background: bold ? 'var(--bg-elevated)' : 'transparent' }}>
      <span style={{
        font: `${bold ? '900' : '500'} ${bold ? '13' : '12.5'}px/1.3 var(--f-${bold ? 'display' : 'sans'})`,
        color: `var(--${tone})`,
        paddingLeft: (indent || 0) * 16,
        letterSpacing: bold ? '0.02em' : 0,
        textTransform: bold ? 'uppercase' : 'none',
      }}>{label}</span>
      <span style={{ textAlign: 'right', font: `${bold ? '900' : '600'} ${bold ? '13' : '12'}px/1 var(--f-mono)`, color: `var(--${tone})` }}>{R.fmtUsd(value)}</span>
    </div>
  );
  return (
    <U.Card padded={false}>
      <div style={{ padding: '20px 18px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">BALANCE GENERAL · AL 24 MAY 2026</div>
        <div style={{ font: '900 20px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>DTD-Cargo C.A.</div>
      </div>
      <Row label="ACTIVO" bold tone="wine" />
      {bs.activos.filter(r => r.balance !== 0).map(r => <Row key={r.account.code} label={`${r.account.code} · ${r.account.name}`} value={r.balance} indent={1} />)}
      <Row label="TOTAL ACTIVO" value={bs.totalActivos} bold tone="success" />

      <Row label="PASIVO" bold tone="warning" />
      {bs.pasivos.filter(r => r.balance !== 0).map(r => <Row key={r.account.code} label={`${r.account.code} · ${r.account.name}`} value={r.balance} indent={1} />)}
      <Row label="TOTAL PASIVO" value={bs.totalPasivos} bold tone="warning" />

      <Row label="PATRIMONIO" bold />
      {bs.patrimonio.filter(r => r.balance !== 0).map((r, i) => <Row key={r.account.code + i} label={`${r.account.code} · ${r.account.name}${r.calculated ? ' ★' : ''}`} value={r.balance} indent={1} tone={r.calculated ? 'wine' : 'ink'} />)}
      <Row label="TOTAL PATRIMONIO" value={bs.totalPatrimonio} bold tone="info" />

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 160px', gap: 14,
        padding: '14px 18px', borderTop: '2px solid var(--ink)',
        background: 'var(--bg-sidebar)', color: '#fff',
      }}>
        <span style={{ font: '900 15px/1 var(--f-display)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>PASIVO + PATRIMONIO</span>
        <span style={{ textAlign: 'right', font: '900 18px/1 var(--f-mono)' }}>{R.fmtUsd(bs.totalPasivos + bs.totalPatrimonio)}</span>
      </div>
      {Math.abs(bs.totalActivos - (bs.totalPasivos + bs.totalPatrimonio)) > 1 && (
        <div style={{ padding: '10px 18px', background: 'var(--danger-bg)', font: '600 12px/1.4 var(--f-sans)', color: 'var(--danger)' }}>
          ⚠ Balance descuadrado · diferencia {R.fmtUsd(Math.abs(bs.totalActivos - (bs.totalPasivos + bs.totalPatrimonio)))} · revisar asientos
        </div>
      )}
    </U.Card>
  );
}

function CFReport() {
  const U = window.ERPUI;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  // Flujo simplificado · entradas vs salidas en cuentas de caja/banco (hojas reales)
  const bankCodes = ['1.04.01', '1.01.02', '1.04.02', '1.02.01'];
  const flows = bankCodes.map(code => {
    const acc = C.getAccount(code);
    const movs = C.accountMovements(code);
    const inflow = movs.reduce((s, m) => s + (m.debit || 0), 0);
    const outflow = movs.reduce((s, m) => s + (m.credit || 0), 0);
    return { acc, inflow, outflow, net: inflow - outflow };
  });
  const totalIn = flows.reduce((s, f) => s + f.inflow, 0);
  const totalOut = flows.reduce((s, f) => s + f.outflow, 0);
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>FLUJO DE CAJA · MAY 2026</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
        <U.KPI label="Entradas" value={R.fmtUsd(totalIn)} tone="success" />
        <U.KPI label="Salidas"  value={R.fmtUsd(totalOut)} tone="warning" />
        <U.KPI label="Flujo neto" value={R.fmtUsd(totalIn - totalOut)} tone={totalIn > totalOut ? 'wine' : 'danger'} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {flows.map(f => (
          <div key={f.acc.code} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', alignItems: 'center' }}>
            <div>
              <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{f.acc.code}</code>
              <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{f.acc.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Entradas</div>
              <div style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{R.fmtUsd(f.inflow)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--warning)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Salidas</div>
              <div style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{R.fmtUsd(f.outflow)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Neto</div>
              <div style={{ font: '900 14px/1 var(--f-mono)', color: f.net >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 4 }}>{R.fmtUsd(f.net)}</div>
            </div>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

function MarginReport() {
  const U = window.ERPUI;
  const R = window.ERPRates;
  // Mock cruce con embarques (Costing data)
  const shipments = [
    { id: 'DTDU-472816', client: 'Acindar', revenue: 84200, cost: 58400, margin: 25800 },
    { id: 'DTDU-419032', client: 'Industrias Polar', revenue: 156800, cost: 102400, margin: 54400 },
    { id: 'DTDU-388157', client: 'Imp. Pereira', revenue: 38200, cost: 27800, margin: 10400 },
    { id: 'DTDU-365044', client: 'Castro Hermanos', revenue: 48200, cost: 32100, margin: 16100 },
    { id: 'DTDU-364299', client: 'Vargas & Asoc', revenue: 71000, cost: 54200, margin: 16800 },
  ];
  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">MARGEN POR EMBARQUE · MAY 2026</div>
        <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Cruzado con datos de Costing · ingresos del flete vs costos directos imputados</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 120px 120px 100px', padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', gap: 14 }}>
        <span>Embarque</span>
        <span>Cliente</span>
        <span style={{ textAlign: 'right' }}>Ingreso</span>
        <span style={{ textAlign: 'right' }}>Costo</span>
        <span style={{ textAlign: 'right' }}>Margen</span>
        <span style={{ textAlign: 'right' }}>%</span>
      </div>
      {shipments.map((s, i) => {
        const pct = (s.margin / s.revenue) * 100;
        const tone = pct > 30 ? 'success' : pct > 15 ? 'wine' : 'warning';
        return (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px 120px 120px 100px', padding: '12px 18px', gap: 14, alignItems: 'center', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{s.id}</code>
            <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.client}</span>
            <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(s.revenue)}</div>
            <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{R.fmtUsd(s.cost)}</div>
            <div style={{ textAlign: 'right', font: '800 13px/1 var(--f-mono)', color: `var(--${tone})` }}>{R.fmtUsd(s.margin)}</div>
            <div style={{ textAlign: 'right' }}><U.Badge tone={tone} size="sm">{pct.toFixed(1)}%</U.Badge></div>
          </div>
        );
      })}
    </U.Card>
  );
}

// ════════════════════════════════════════════════════════════════
// Por contabilizar (v2.5) · puente subdiario → mayor
// ════════════════════════════════════════════════════════════════
function PorContabilizarTab({ unlocked }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-journal-changed', f);
    window.addEventListener('dtd-tesoreria-changed', f);
    window.addEventListener('dtd-cobranzas-changed', f);
    return () => { window.removeEventListener('dtd-journal-changed', f); window.removeEventListener('dtd-tesoreria-changed', f); window.removeEventListener('dtd-cobranzas-changed', f); };
  }, []);

  const cobros = C.pendingCollections();
  const pagos = C.pendingPayments();
  const pendCob = cobros.filter(c => !c.posted);
  const pendPag = pagos.filter(p => !p.posted);

  const guard = () => { if (!unlocked) { alert('Activa "Edición abierta" en el header para contabilizar.'); return false; } return true; };
  const postAllCob = () => { if (!guard()) return; let n = 0; pendCob.forEach(c => { if (C.postCollection(c)) n++; }); alert(n ? `${n} cobro(s) contabilizado(s).` : 'Nada por contabilizar.'); };
  const postAllPag = () => { if (!guard()) return; let n = 0; pendPag.forEach(p => { if (C.postPayment(p)) n++; }); alert(n ? `${n} pago(s) contabilizado(s).` : 'Nada por contabilizar.'); };

  const T = window.TesoreriaData;
  const acctShort = (id) => { const a = T && T.getAccount ? T.getAccount(id) : null; return a ? a.short : id; };
  const payeeName = (id) => { const p = T && T.getPayee ? T.getPayee(id) : null; return p ? p.name : id; };

  const Section = ({ title, sub, items, pending, cols, header, row, onPost, postLabel }) => (
    <U.Card padded={false}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="eyebrow eyebrow-wine">{title}</div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{sub}</div>
        </div>
        <U.Btn variant="primary" size="sm" icon={I.check(12)} disabled={!unlocked || pending === 0} onClick={onPost}>{postLabel} ({pending})</U.Btn>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: '22px 20px', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>No hay movimientos en el subdiario.</div>
      ) : (
        <React.Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '9px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', gap: 12 }}>{header}</div>
          {items.map((it, i) => (
            <div key={it.ref} style={{ display: 'grid', gridTemplateColumns: cols, padding: '10px 20px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0, opacity: it.posted ? 0.55 : 1 }}>{row(it)}</div>
          ))}
        </React.Fragment>
      )}
    </U.Card>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
        <span style={{ color: 'var(--wine)' }}>{I.flow ? I.flow(16) : I.chart(16)}</span>
        <span style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          Cobros (Cobranzas) y pagos (Tesorería) que todavía no tienen asiento en el libro diario. Contabilizalos para reflejarlos en el mayor · cada uno genera su asiento de partida doble.
        </span>
      </div>

      <Section
        title="COBROS · COBRANZAS → MAYOR"
        sub="Debita banco/caja · cancela CxC clientes (1.05.01)"
        items={cobros} pending={pendCob.length}
        cols="100px 1fr 130px 120px 90px"
        header={<><span>Factura</span><span>Cuenta destino</span><span style={{ textAlign: 'right' }}>Monto USD</span><span>Método</span><span style={{ textAlign: 'right' }}>Estado</span></>}
        row={(it) => (<>
          <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{it.invoice}</code>
          <span style={{ font: '500 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{acctShort(it.accountId)} <code style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{((T && T.getAccount && T.getAccount(it.accountId)) || {}).coa || ''}</code></span>
          <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(it.amountUsd)}</span>
          <span style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{it.method || '—'}</span>
          <span style={{ textAlign: 'right' }}>{it.posted ? <U.Badge tone="success" size="sm" dot>Contabilizado</U.Badge> : <U.Badge tone="warning" size="sm" dot>Pendiente</U.Badge>}</span>
        </>)}
        onPost={postAllCob} postLabel="Contabilizar cobros"
      />

      <Section
        title="PAGOS · TESORERÍA → MAYOR"
        sub="Debita CxP proveedores (2.01.06) · acredita banco/caja"
        items={pagos} pending={pendPag.length}
        cols="120px 1fr 130px 120px 90px"
        header={<><span>Orden</span><span>Beneficiario</span><span style={{ textAlign: 'right' }}>Monto USD</span><span>Desde</span><span style={{ textAlign: 'right' }}>Estado</span></>}
        row={(it) => (<>
          <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{it.id}</code>
          <span style={{ font: '500 12px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payeeName(it.payee)}</span>
          <span style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(it.amountUsd)}</span>
          <span style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{acctShort(it.fromAccount)}</span>
          <span style={{ textAlign: 'right' }}>{it.posted ? <U.Badge tone="success" size="sm" dot>Contabilizado</U.Badge> : <U.Badge tone="warning" size="sm" dot>Pendiente</U.Badge>}</span>
        </>)}
        onPost={postAllPag} postLabel="Contabilizar pagos"
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Activos fijos & depreciación (v2.5)
// ════════════════════════════════════════════════════════════════
function AssetsTab({ unlocked }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const [createOpen, setCreateOpen] = React.useState(false);
  const [depDate, setDepDate] = React.useState('2026-05-31');
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-assets-changed', f);
    window.addEventListener('dtd-journal-changed', f);
    return () => { window.removeEventListener('dtd-assets-changed', f); window.removeEventListener('dtd-journal-changed', f); };
  }, []);

  const rows = C.FIXED_ASSETS.map(a => ({ a, d: C.assetDepreciation(a, depDate) }));
  const totCost = rows.reduce((s, r) => s + r.a.cost, 0);
  const totAccum = rows.reduce((s, r) => s + r.d.accum, 0);
  const totNet = rows.reduce((s, r) => s + r.d.net, 0);
  const totMonthly = rows.filter(r => r.d.elapsed < r.a.months).reduce((s, r) => s + r.d.monthly, 0);

  const postDep = () => {
    if (!unlocked) { alert('Activa "Edición abierta" en el header para contabilizar la depreciación.'); return; }
    const entry = C.buildDepreciationEntry(depDate);
    if (!entry) { alert('No hay depreciación pendiente para el período.'); return; }
    C.createEntry(entry);
    alert('Depreciación del mes contabilizada · débito 6.06 / crédito 1.11.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <U.KPI label="Costo de adquisición" value={R.fmtUsd(totCost)} tone="info" icon={I.box(18)} />
        <U.KPI label="Depreciación acumulada" value={R.fmtUsd(totAccum)} tone="warning" icon={I.chart(18)} />
        <U.KPI label="Valor neto en libros" value={R.fmtUsd(totNet)} tone="wine" icon={I.spark(18)} />
        <U.KPI label="Depreciación mensual" value={R.fmtUsd(totMonthly)} tone="neutral" icon={I.invoice(18)} />
      </div>

      <U.Card padded={false}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="eyebrow eyebrow-wine">BIENES DE USO</div>
            <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Registro de activos fijos · depreciación lineal</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div>
              <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Al período</div>
              <input type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} style={{ width: 150, padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 12px/1 var(--f-mono)' }} />
            </div>
            <U.Btn variant="secondary" size="sm" icon={I.plus(12)} onClick={() => setCreateOpen(true)}>Registrar activo</U.Btn>
            <U.Btn variant="primary" size="sm" icon={I.check(12)} disabled={!unlocked || totMonthly <= 0} onClick={postDep}>Contabilizar depreciación</U.Btn>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 90px 110px 110px 110px', padding: '9px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', gap: 12 }}>
          <span>Activo</span><span>Cuenta</span><span style={{ textAlign: 'right' }}>Costo</span><span style={{ textAlign: 'right' }}>Vida</span><span style={{ textAlign: 'right' }}>Dep. mes</span><span style={{ textAlign: 'right' }}>Acumulada</span><span style={{ textAlign: 'right' }}>Neto</span>
        </div>
        {rows.map((r, i) => {
          const done = r.d.elapsed >= r.a.months;
          return (
            <div key={r.a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 90px 110px 110px 110px', padding: '11px 20px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.a.name}</span>
                {done && <U.Badge tone="neutral" size="sm">Depreciado</U.Badge>}
              </div>
              <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.a.acc}</code>
              <div style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(r.a.cost)}</div>
              <div style={{ textAlign: 'right', font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.a.months}m</div>
              <div style={{ textAlign: 'right', font: '500 11.5px/1 var(--f-mono)', color: done ? 'var(--ink-mute)' : 'var(--ink)' }}>{done ? '—' : R.fmtUsd(r.d.monthly)}</div>
              <div style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: 'var(--warning)' }}>{R.fmtUsd(r.d.accum)}</div>
              <div style={{ textAlign: 'right', font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(r.d.net)}</div>
            </div>
          );
        })}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px 90px 110px 110px 110px', padding: '12px 20px', alignItems: 'center', gap: 12, borderTop: '2px solid var(--ink)', background: 'var(--bg-elevated)', font: '900 12px/1 var(--f-mono)', color: 'var(--ink)' }}>
          <span style={{ font: '700 11px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Totales</span>
          <span></span>
          <span style={{ textAlign: 'right' }}>{R.fmtUsd(totCost)}</span>
          <span></span>
          <span style={{ textAlign: 'right' }}>{R.fmtUsd(totMonthly)}</span>
          <span style={{ textAlign: 'right', color: 'var(--warning)' }}>{R.fmtUsd(totAccum)}</span>
          <span style={{ textAlign: 'right' }}>{R.fmtUsd(totNet)}</span>
        </div>
      </U.Card>
      <AssetDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function AssetDrawer({ open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const ppe = C.CHART_OF_ACCOUNTS.filter(a => C.isLeaf(a.code) && /^1\.12\./.test(a.code));
  const [name, setName] = React.useState('');
  const [acc, setAcc] = React.useState(ppe[0] ? ppe[0].code : '');
  const [cost, setCost] = React.useState('');
  const [start, setStart] = React.useState('2026-05-01');
  const [months, setMonths] = React.useState('60');
  React.useEffect(() => { if (open) { setName(''); setAcc(ppe[0] ? ppe[0].code : ''); setCost(''); setStart('2026-05-01'); setMonths('60'); } }, [open]);
  const valid = name.trim() && acc && Number(cost) > 0 && Number(months) > 0;
  const inputBox = { width: '100%', padding: '9px 11px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1.3 var(--f-sans)' };
  const Label = ({ children }) => (<div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{children}</div>);
  const save = () => { C.createAsset({ name: name.trim(), acc, cost: Number(cost), start, months: Number(months) }); onClose(); };
  return (
    <U.Drawer open={open} onClose={onClose} width={520} title="Registrar activo fijo" subtitle="Se deprecia en línea recta sobre su vida útil"
      actions={<React.Fragment><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={I.check(14)} disabled={!valid} onClick={save}>Registrar</U.Btn></React.Fragment>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><Label>Nombre del activo</Label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Montacargas eléctrico" style={inputBox} /></div>
        <div><Label>Cuenta de activo (PPE)</Label><U.Select value={acc} onChange={(e) => setAcc(e.target.value)} options={ppe.map(a => ({ value: a.code, label: `${a.code} · ${a.name}` }))} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 110px', gap: 12 }}>
          <div><Label>Costo (USD)</Label><U.CalcInput value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" style={{ ...inputBox, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' }} /></div>
          <div><Label>Alta</Label><input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inputBox, fontFamily: 'var(--f-mono)' }} /></div>
          <div><Label>Vida (meses)</Label><U.CalcInput value={months} onChange={(e) => setMonths(e.target.value)} placeholder="60" style={{ ...inputBox, fontFamily: 'var(--f-mono)', fontWeight: 700, textAlign: 'right' }} /></div>
        </div>
        <div style={{ padding: '11px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
          La depreciación se contabiliza con débito a <b>6.06</b> (gasto) y crédito a <b>1.11</b> (depreciación acumulada). Depreciación mensual estimada: <b>{Number(cost) > 0 && Number(months) > 0 ? window.ERPRates.fmtUsd(Number(cost) / Number(months)) : '—'}</b>.
        </div>
      </div>
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Cierre & ajustes (v2.5) · diferencia cambiaria + cierre de ejercicio
// ════════════════════════════════════════════════════════════════
function CierreTab({ unlocked }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const [, force] = React.useReducer(x => x + 1, 0);
  React.useEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-journal-changed', f);
    return () => window.removeEventListener('dtd-journal-changed', f);
  }, []);

  const [rateVes, setRateVes] = React.useState(rates.bcv);
  const [rateCny, setRateCny] = React.useState(rates.cny);
  const [fxDate, setFxDate] = React.useState('2026-05-31');
  const [closeDate, setCloseDate] = React.useState('2026-12-31');

  const positions = C.foreignPositions();
  const closeInfo = C.readClose();
  const pl = C.calculatePL();
  const ganRet = C.accountBalance('3.04');

  const num = (v) => Number(v) || 0;
  const fxRows = positions.map(p => {
    const cr = p.ccy === 'VES' ? num(rateVes) : num(rateCny);
    const reval = cr ? p.notional / cr : p.bookUsd;
    const diff = Math.round((reval - p.bookUsd) * 100) / 100;
    return { ...p, cr, reval, diff };
  });
  const fxNet = Math.round(fxRows.reduce((s, r) => s + r.diff, 0) * 100) / 100;
  const hasFx = fxRows.some(r => r.diff !== 0);

  const guard = () => { if (!unlocked) { alert('Activa "Edición abierta" en el header para generar asientos de cierre.'); return false; } return true; };

  const postFx = () => {
    if (!guard()) return;
    const entry = C.buildRevaluationEntry({ VES: num(rateVes), CNY: num(rateCny) }, fxDate);
    if (!entry) { alert('No hay diferencias a la tasa indicada.'); return; }
    C.createEntry(entry);
    C.writeClose({ ...(closeInfo || {}), fxAt: new Date().toISOString().slice(0, 16).replace('T', ' '), fxNet, fxDate });
    alert('Asiento de diferencia cambiaria contabilizado.');
  };
  const postClose = () => {
    if (!guard()) return;
    if (!window.confirm(`¿Cerrar el ejercicio al ${closeDate}? Se cancelan ingresos/costos/gastos contra Ganancias Retenidas.`)) return;
    const entry = C.buildClosingEntry(closeDate);
    C.createEntry(entry);
    C.writeClose({ ...(C.readClose() || {}), closedAt: new Date().toISOString().slice(0, 16).replace('T', ' '), closeDate, utilidad: entry.utilidad, by: 'Andrés B. (Contabilidad)' });
    alert('Ejercicio cerrado · resultado traspasado a Ganancias Retenidas (3.04).');
  };

  const rateBox = { width: '100%', padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 13px/1 var(--f-mono)', textAlign: 'right' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!unlocked && (
        <div style={{ padding: '11px 14px', background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--warning)' }}>{I.shield(15)}</span>
          <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            <strong>Modo seguro.</strong> Para generar los asientos de cierre, activa "Edición abierta" en el header.
          </span>
        </div>
      )}

      {/* ── Diferencia cambiaria ── */}
      <U.Card padded={false}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="eyebrow eyebrow-wine">AJUSTE · DIFERENCIA CAMBIARIA</div>
            <div style={{ font: '900 15px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Revaluación de saldos en moneda extranjera</div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Reprecia las cuentas monetarias VES/CNY a la tasa de cierre. La diferencia va a 6.04.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div><div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Tasa VES</div><input value={rateVes} onChange={(e) => setRateVes(e.target.value)} style={{ ...rateBox, width: 90 }} /></div>
            <div><div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Fecha</div><input type="date" value={fxDate} onChange={(e) => setFxDate(e.target.value)} style={{ ...rateBox, width: 140, fontWeight: 500 }} /></div>
          </div>
        </div>
        {fxRows.length === 0 ? (
          <div style={{ padding: '24px 20px', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>No hay posiciones monetarias en moneda extranjera con movimiento en el período.</div>
        ) : (
          <React.Fragment>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 90px 120px 120px', padding: '9px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', gap: 12 }}>
              <span>Cuenta</span><span style={{ textAlign: 'right' }}>Saldo moneda</span><span style={{ textAlign: 'right' }}>T. libro</span><span style={{ textAlign: 'right' }}>T. cierre</span><span style={{ textAlign: 'right' }}>USD libros</span><span style={{ textAlign: 'right' }}>Diferencia</span>
            </div>
            {fxRows.map((r, i) => (
              <div key={r.code} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 90px 90px 120px 120px', padding: '10px 20px', alignItems: 'center', gap: 12, borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                <div><code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.code}</code> <span style={{ font: '500 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.name}</span></div>
                <div style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.notional.toLocaleString('es-VE')} {r.ccy}</div>
                <div style={{ textAlign: 'right', font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{r.bookRate.toFixed(2)}</div>
                <div style={{ textAlign: 'right', font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.cr.toFixed(2)}</div>
                <div style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{R.fmtUsd(r.bookUsd)}</div>
                <div style={{ textAlign: 'right', font: '800 12px/1 var(--f-mono)', color: r.diff === 0 ? 'var(--ink-mute)' : r.diff > 0 ? 'var(--success)' : 'var(--danger)' }}>{r.diff > 0 ? '+' : ''}{R.fmtUsd(r.diff)}</div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderTop: '2px solid var(--ink)', background: 'var(--bg-elevated)' }}>
              <div style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>
                Diferencia neta a 6.04 · <b style={{ color: fxNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fxNet > 0 ? 'ganancia' : fxNet < 0 ? 'pérdida' : 'sin efecto'}</b>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <span style={{ font: '900 16px/1 var(--f-display)', color: fxNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fxNet > 0 ? '+' : ''}{R.fmtUsd(fxNet)}</span>
                <U.Btn variant="primary" icon={I.check(13)} disabled={!hasFx || !unlocked} onClick={postFx}>Contabilizar diferencia</U.Btn>
              </div>
            </div>
          </React.Fragment>
        )}
        {closeInfo && closeInfo.fxAt && (
          <div style={{ padding: '9px 20px', font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)' }}>
            Último ajuste cambiario: {closeInfo.fxAt} · neto {R.fmtUsd(closeInfo.fxNet || 0)}
          </div>
        )}
      </U.Card>

      {/* ── Cierre de ejercicio ── */}
      <U.Card padded={false}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow eyebrow-wine">CIERRE DE EJERCICIO</div>
          <div style={{ font: '900 15px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Traspaso del resultado a Ganancias Retenidas</div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Cancela las cuentas de resultado (ingresos, costos, gastos) contra la cuenta 3.04.</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '16px 20px' }}>
          <U.KPI label="Ingresos" value={R.fmtUsd(pl.totalIngresos)} tone="success" />
          <U.KPI label="Costos + gastos" value={R.fmtUsd(pl.totalCgs + pl.totalGastos)} tone="warning" />
          <U.KPI label="Resultado del período" value={R.fmtUsd(pl.utilidadNeta)} tone={pl.utilidadNeta >= 0 ? 'wine' : 'danger'} />
          <U.KPI label="Ganancias Retenidas (3.04)" value={R.fmtUsd(ganRet)} tone="info" />
        </div>
        {closeInfo && closeInfo.closedAt ? (
          <div style={{ margin: '0 20px 18px', padding: '14px 16px', background: 'var(--success-bg)', borderLeft: '4px solid var(--success)', borderRadius: 'var(--r-md)' }}>
            <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Ejercicio cerrado</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', marginTop: 5 }}>
              Cerrado al <b>{closeInfo.closeDate}</b> el {closeInfo.closedAt} por {closeInfo.by} · resultado traspasado <b>{R.fmtUsd(closeInfo.utilidad || 0)}</b>. El resultado del período quedó en cero y la utilidad vive en Ganancias Retenidas.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 20px 18px' }}>
            <div>
              <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Fecha de cierre</div>
              <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} style={{ ...rateBox, width: 160, fontWeight: 500 }} />
            </div>
            <U.Btn variant="primary" icon={I.shield(13)} disabled={!unlocked || pl.totalIngresos === 0} onClick={postClose}>Cerrar ejercicio</U.Btn>
          </div>
        )}
      </U.Card>

      <ProvisionesFiscales unlocked={unlocked} pl={pl} />
    </div>
  );
}

// ── Provisiones fiscales · ISLR / municipal / ajuste por inflación ──
function ProvisionesFiscales({ unlocked, pl }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const cfg = C.PROVISION_CFG;
  const [kind, setKind] = React.useState('islr');
  const [base, setBase] = React.useState(Math.round(pl.utilidadNeta));
  const [rate, setRate] = React.useState(cfg.islr.defRate);
  const [date, setDate] = React.useState('2026-05-31');

  React.useEffect(() => {
    const c = cfg[kind];
    setRate(c.defRate == null ? '' : c.defRate);
    setBase(kind === 'islr' ? Math.round(pl.utilidadNeta) : kind === 'municipal' ? Math.round(pl.totalIngresos) : 0);
  }, [kind]);

  const c = cfg[kind];
  const isAmount = c.defRate == null;
  const monto = isAmount ? (Number(base) || 0) : Math.round((Number(base) || 0) * (Number(rate) || 0) / 100 * 100) / 100;
  const acc = (code) => C.getAccount(code);
  const guard = () => { if (!unlocked) { alert('Activa "Edición abierta" en el header para contabilizar la provisión.'); return false; } return true; };
  const post = () => {
    if (!guard()) return;
    const entry = C.buildProvisionEntry(kind, base, rate, date);
    if (!entry) { alert('Ingresa una base/monto válido.'); return; }
    C.createEntry(entry);
    alert(`Provisión ${c.label} contabilizada · ${R.fmtUsd(monto)}.`);
  };
  const box = { padding: '8px 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 13px/1 var(--f-mono)', textAlign: 'right', width: '100%' };

  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 4 }}>PROVISIONES FISCALES</div>
      <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14 }}>Reconoce el gasto y la cuenta por pagar a SENIAT / alcaldía. Débito al gasto · crédito al pasivo.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        {Object.entries(cfg).map(([k, v]) => {
          const on = kind === k;
          return (
            <button key={k} onClick={() => setKind(k)} style={{
              padding: '10px 10px', borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left',
              border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'),
              background: on ? 'var(--wine-tint)' : 'var(--bg-surface)',
            }}>
              <div style={{ font: `${on ? '700' : '600'} 12.5px/1.1 var(--f-sans)`, color: on ? 'var(--wine)' : 'var(--ink)' }}>{v.label}</div>
              <div style={{ font: '500 10px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>{v.gasto} → {v.pasivo}</div>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isAmount ? '1fr 150px' : '1fr 110px 150px', gap: 12, alignItems: 'end' }}>
        <div>
          <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{c.baseLabel} (USD)</div>
          <window.ERPUI.CalcInput value={base} onChange={(e) => setBase(e.target.value)} style={box} />
        </div>
        {!isAmount && (
          <div>
            <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Alícuota %</div>
            <window.ERPUI.CalcInput value={rate} onChange={(e) => setRate(e.target.value)} style={box} />
          </div>
        )}
        <div>
          <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>Fecha</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...box, fontWeight: 500, textAlign: 'left' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
        <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
          Débito <b style={{ color: 'var(--ink)' }}>{c.gasto}</b> {acc(c.gasto) ? '· ' + acc(c.gasto).name : ''} · Crédito <b style={{ color: 'var(--ink)' }}>{c.pasivo}</b>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ font: '900 18px/1 var(--f-display)', color: 'var(--wine)' }}>{R.fmtUsd(monto)}</span>
          <U.Btn variant="primary" icon={I.check(13)} disabled={!unlocked || monto <= 0} onClick={post}>Contabilizar provisión</U.Btn>
        </div>
      </div>
    </U.Card>
  );
}

// ════════════════════════════════════════════════════════════════
// Configuración
// ════════════════════════════════════════════════════════════════
function ConfigTab({ lock, setLock }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const unlocked = !lock.locked || (lock.unlockedUntil && new Date(lock.unlockedUntil).getTime() > Date.now());
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>SEGURIDAD · MODO DE EDICIÓN</div>
        <div style={{
          padding: '16px 18px', borderRadius: 'var(--r-md)',
          background: unlocked ? 'var(--warning-bg)' : 'var(--success-bg)',
          borderLeft: `4px solid var(--${unlocked ? 'warning' : 'success'})`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: `var(--${unlocked ? 'warning' : 'success'})` }}>{I.shield(20)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)' }}>{unlocked ? 'Edición abierta · sesión de 30 minutos' : 'Modo seguro activo'}</div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
                {unlocked
                  ? `Desbloqueado por ${lock.unlockedBy}. Todos los asientos están editables y eliminables hasta ${new Date(lock.unlockedUntil).toLocaleString('es-VE')}. Cada cambio queda en audit log.`
                  : 'Asientos contabilizados están protegidos. Para editar o eliminar un asiento se requiere autenticación de Contabilidad o Admin. La sesión dura 30 min · luego vuelve automáticamente a modo seguro.'}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
          <U.Field label="Usuario autorizado · edición"   value="Andrés B. (Contabilidad)" />
          <U.Field label="Usuario autorizado · eliminación" value="Carlos V. (Admin)" />
          <U.Field label="Duración de sesión desbloqueada"  value="30 minutos · auto-cierre" />
          <U.Field label="Audit log"                          value="Cada acción se registra (ver módulo Audit log)" />
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>EJERCICIO FISCAL</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <U.Field label="Inicio de ejercicio"    value="01 ene 2026" mono />
          <U.Field label="Cierre de ejercicio"    value="31 dic 2026" mono />
          <U.Field label="Período activo"         value="MAY 2026 (en curso)" />
          <U.Field label="Moneda funcional"        value="USD · libros principales" />
          <U.Field label="Moneda de referencia"    value="VES · BCV oficial" />
          <U.Field label="Última diferencia cambiaria" value={(() => { const ci = C.readClose(); return ci && ci.fxAt ? `${ci.fxAt} · ${window.ERPRates.fmtUsd(ci.fxNet || 0)}` : 'Pendiente · ver "Cierre & ajustes"'; })()} />
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>NUMERACIÓN AUTOMÁTICA</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <U.Field label="Prefijo asientos"     value="AS-2026-" mono />
          <U.Field label="Próximo número"        value={C.nextEntryId()} mono />
          <U.Field label="Total contabilizados"  value={C.JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado').length} mono />
        </div>
      </U.Card>
    </div>
  );
}

window.ModuleContabilidad = ModuleContabilidad;
