/* global React */
/* ── DTD ERP · Contabilidad · v1.1 ──────────────────────────── */
/* Módulo contable estilo QuickBooks Online · libros USD ·       */
/* VES referencia con tasa del día · plan de cuentas VE editable */

function ModuleContabilidad({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const [tab, setTab] = React.useState('dashboard');
  const [lock, setLock] = React.useState(C.readLock());
  React.useEffect(() => {
    const handler = (e) => setLock(e.detail || C.readLock());
    window.addEventListener('dtd-contab-lock', handler);
    return () => window.removeEventListener('dtd-contab-lock', handler);
  }, []);
  const unlocked = !lock.locked || (lock.unlockedUntil && new Date(lock.unlockedUntil).getTime() > Date.now());

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
            <U.Btn variant="primary" icon={I.plus(14)}>Nuevo asiento</U.Btn>
          </>
        }
      />

      <U.Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'journal',   label: 'Libro diario', count: C.JOURNAL_ENTRIES.length },
          { value: 'coa',       label: 'Plan de cuentas', count: C.CHART_OF_ACCOUNTS.filter(a => a.level === 3).length },
          { value: 'ledger',    label: 'Libro mayor' },
          { value: 'reports',   label: 'Reportes' },
          { value: 'config',    label: 'Configuración' },
        ]}
        style={{ marginBottom: 'var(--s-5)' }}
      />

      {tab === 'dashboard' && <DashboardTab goTo={goTo} setTab={setTab} />}
      {tab === 'journal'   && <JournalTab unlocked={unlocked} />}
      {tab === 'coa'       && <CoATab unlocked={unlocked} />}
      {tab === 'ledger'    && <LedgerTab />}
      {tab === 'reports'   && <ReportsTab />}
      {tab === 'config'    && <ConfigTab lock={lock} setLock={setLock} />}
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
function DashboardTab({ goTo, setTab }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const C = window.ContabilidadData;
  const R = window.ERPRates;
  const pl = C.calculatePL();
  const bankUsd = C.accountBalance('1.1.01');
  const bankVes = C.accountBalance('1.1.02');
  const usdt = C.accountBalance('1.1.03');
  const cxc = C.accountBalance('1.1.10');
  const cxp = C.accountBalance('2.1.01');

  const quickActions = [
    { label: 'Nueva factura',       icon: I.invoice(20), to: () => goTo('invoices', null, 'create'), tone: 'wine' },
    { label: 'Registrar pago',       icon: I.check(20),   to: () => alert('Quick-pay coming soon'),  tone: 'success' },
    { label: 'Registrar gasto',      icon: I.plus(20),    to: () => alert('Quick-expense coming soon'), tone: 'info' },
    { label: 'Conciliar banco',      icon: I.chart(20),   to: () => goTo('reconcile'),               tone: 'warning' },
    { label: 'Nuevo asiento manual', icon: I.edit(20),    to: () => setTab('journal'),                tone: 'neutral' },
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
              { code: '1.1.01', label: 'Banco Mercantil · USD', tone: 'wine',    balance: bankUsd, currency: 'USD' },
              { code: '1.1.02', label: 'Banco Banesco · VES',   tone: 'info',    balance: bankVes, currency: 'USD', ves: true },
              { code: '1.1.03', label: 'USDT · TRC20',           tone: 'success', balance: usdt,    currency: 'USD' },
              { code: '1.1.04', label: 'Caja Chica USD',         tone: 'neutral', balance: C.accountBalance('1.1.04'), currency: 'USD' },
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
              <div style={{ font: '900 22px/1 var(--f-display)' }}>{R.fmtUsd(bankUsd + bankVes + usdt + C.accountBalance('1.1.04'))}</div>
            </div>
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CUENTAS POR COBRAR / PAGAR</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '14px 16px', background: 'var(--success-bg)', borderLeft: '4px solid var(--success)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CxC · Por cobrar</span>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>1.1.10</code>
              </div>
              <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)' }}>{R.fmtUsd(cxc)}</div>
              <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
                Equivalente a {R.fmtBs(R.usdToVes(cxc))} @ BCV
              </div>
            </div>
            <div style={{ padding: '14px 16px', background: 'var(--warning-bg)', borderLeft: '4px solid var(--warning)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--warning)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CxP · Por pagar</span>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>2.1.01</code>
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
function JournalTab({ unlocked }) {
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
      />
    </div>
  );
}

function JournalDetailDrawer({ entry, onClose, unlocked }) {
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
          <U.Btn variant="ghost" disabled={!unlocked} style={{ color: 'var(--danger)' }}>Eliminar asiento</U.Btn>
          <U.Btn variant="secondary" disabled={!unlocked}>Editar</U.Btn>
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
            <strong>Modo seguro activo.</strong> Activá "Edición abierta" en el header con la contraseña de Contabilidad o Admin para editar.
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

  const filtered = C.CHART_OF_ACCOUNTS.filter(a => {
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
          <U.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={[
            { value: 'all', label: 'Todos los tipos' },
            ...Object.entries(C.TYPE_LABEL).map(([k, v]) => ({ value: k, label: v.label })),
          ]} style={{ minWidth: 180 }} />
        }
        actions={<U.Btn variant="primary" size="sm" icon={I.plus(12)} disabled={!unlocked}>Nueva cuenta</U.Btn>}
      />

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 1fr 140px 140px 24px',
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
          const balance = a.level === 3 ? C.accountBalance(a.code) : 0;
          return (
            <div key={a.code} style={{
              display: 'grid', gridTemplateColumns: '90px 1fr 140px 140px 24px',
              padding: '10px 18px', gap: 14, alignItems: 'center',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
              background: a.level === 1 ? 'var(--bg-elevated)' : a.level === 2 ? 'transparent' : 'transparent',
            }}>
              <code style={{
                font: `${a.level === 1 ? '900' : a.level === 2 ? '700' : '600'} ${a.level === 1 ? '13' : '11.5'}px/1 var(--f-mono)`,
                color: a.level === 1 ? 'var(--wine)' : 'var(--ink)',
                paddingLeft: (a.level - 1) * 14,
              }}>{a.code}</code>
              <span style={{
                font: `${a.level === 1 ? '900' : a.level === 2 ? '700' : '500'} ${a.level === 1 ? '13' : '12.5'}px/1.2 var(--f-${a.level === 1 ? 'display' : 'sans'})`,
                color: 'var(--ink)',
                letterSpacing: a.level === 1 ? '0.04em' : 0,
                textTransform: a.level === 1 ? 'uppercase' : 'none',
                paddingLeft: (a.level - 1) * 14,
              }}>{a.name}</span>
              <U.Badge tone={meta?.tone || 'neutral'} size="sm">{meta?.label || a.type}</U.Badge>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: balance !== 0 ? 'var(--ink)' : 'var(--ink-mute)' }}>
                {a.level === 3 ? R.fmtUsd(balance) : '—'}
              </div>
              <span style={{ color: 'var(--ink-mute)' }}>{a.level === 3 && I.chevR(12)}</span>
            </div>
          );
        })}
      </U.Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Libro Mayor (General Ledger)
// ════════════════════════════════════════════════════════════════
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
      <Row label="ACTIVO" bold />
      <Row label="Activo Corriente" bold indent={0} tone="wine" />
      {bs.activosC.filter(r => r.balance !== 0).map(r => <Row key={r.account.code} label={`${r.account.code} · ${r.account.name}`} value={r.balance} indent={1} />)}
      <Row label="Total activo corriente" value={bs.totalActivosC} bold indent={0} tone="wine" />
      {bs.activosNC.filter(r => r.balance !== 0).length > 0 && <>
        <Row label="Activo No Corriente" bold tone="wine" />
        {bs.activosNC.filter(r => r.balance !== 0).map(r => <Row key={r.account.code} label={`${r.account.code} · ${r.account.name}`} value={r.balance} indent={1} />)}
        <Row label="Total activo no corriente" value={bs.totalActivosNC} bold tone="wine" />
      </>}
      <Row label="TOTAL ACTIVO" value={bs.totalActivos} bold tone="success" />

      <Row label="PASIVO" bold />
      <Row label="Pasivo Corriente" bold tone="warning" />
      {bs.pasivosC.filter(r => r.balance !== 0).map(r => <Row key={r.account.code} label={`${r.account.code} · ${r.account.name}`} value={r.balance} indent={1} />)}
      <Row label="Total pasivo corriente" value={bs.totalPasivosC} bold tone="warning" />
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
  // Flujo simplificado · entradas vs salidas en cuentas de bancos
  const bankCodes = ['1.1.01', '1.1.02', '1.1.03', '1.1.04'];
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
          <U.Field label="Última diferencia cambiaria" value="Pendiente · al cierre del mes" />
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>NUMERACIÓN AUTOMÁTICA</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <U.Field label="Prefijo asientos"     value="AS-2026-" mono />
          <U.Field label="Próximo número"        value="AS-2026-0423" mono />
          <U.Field label="Total contabilizados"  value={C.JOURNAL_ENTRIES.filter(e => e.status === 'contabilizado').length} mono />
        </div>
      </U.Card>
    </div>
  );
}

window.ModuleContabilidad = ModuleContabilidad;
