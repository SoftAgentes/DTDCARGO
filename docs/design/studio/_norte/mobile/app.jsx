/* global React */
/* ── DTD-Cargo · Mobile ERP · app general v1.0 ──────────────── */
/* Vista móvil para usuario ERP (Carlos / Admin / Comercial).    */
/* No es para operarios — esa app es Operario CN/VE separada.    */
/* Funciones: tracking · clientes cerca · gastos rápidos · más. */

const MOBILE_LS_KEY = 'dtd_mobile_v1';

// ── Personas demo (switchable desde Más) ──────────────────────
const MOBILE_USERS = [
  { id: 'u-001', name: 'Carlos Vargas',  initials: 'CV', role: 'Admin · Dueño',    avatarTone: 'wine',    location: 'Valencia · VE' },
  { id: 'u-002', name: 'Martina Acuña',  initials: 'MA', role: 'Comercial',         avatarTone: 'info',    location: 'En viaje · Yiwu CN' },
  { id: 'u-003', name: 'Yusneidy Pérez', initials: 'YP', role: 'Operaciones',       avatarTone: 'success', location: 'Maracaibo · VE' },
];

// ── Mock gastos rápidos (persistido) ──────────────────────────
const SEED_EXPENSES = [
  { id: 'EXP-2026-0142', date: '2026-05-23 14:22', user: 'Martina A.', userId: 'u-002', amount: 280, currency: 'CNY',  category: 'comida',    method: 'cash',    shipment: null,           note: 'Almuerzo cliente Yiwu Trading',         billable: false, location: 'Yiwu, CN' },
  { id: 'EXP-2026-0141', date: '2026-05-23 09:18', user: 'Martina A.', userId: 'u-002', amount: 45,  currency: 'USD',  category: 'taxi',      method: 'card',    shipment: null,           note: 'Hotel → fábrica Ningbo',                billable: false, location: 'Ningbo, CN' },
  { id: 'EXP-2026-0140', date: '2026-05-22 17:48', user: 'Carlos V.',  userId: 'u-001', amount: 120, currency: 'USD',  category: 'peaje',     method: 'cash',    shipment: 'DTDU-472816', note: 'Peajes ruta PBL → Caracas',             billable: true,  location: 'Carabobo, VE' },
  { id: 'EXP-2026-0139', date: '2026-05-22 11:04', user: 'Yusneidy P.', userId: 'u-003', amount: 8200, currency: 'VES', category: 'aduana',    method: 'cash',    shipment: 'DTDU-419032', note: 'Gestión depósito SENIAT',              billable: true,  location: 'Maracaibo, VE' },
  { id: 'EXP-2026-0138', date: '2026-05-21 19:30', user: 'Martina A.', userId: 'u-002', amount: 680, currency: 'USD',  category: 'hotel',     method: 'card',    shipment: null,           note: 'Hotel JW Marriott Shanghai · 2 noches', billable: false, location: 'Shanghai, CN' },
  { id: 'EXP-2026-0137', date: '2026-05-20 08:00', user: 'Carlos V.',  userId: 'u-001', amount: 1850, currency: 'USD', category: 'vuelo',     method: 'card',    shipment: null,           note: 'Vuelo CCS → PEK (ida)',                 billable: false, location: 'Caracas, VE' },
];

// ── Categorías de gasto ───────────────────────────────────────
const EXPENSE_CATS = [
  { k: 'taxi',     label: 'Taxi/Transfer', tone: 'info' },
  { k: 'comida',   label: 'Comida',         tone: 'warning' },
  { k: 'hotel',    label: 'Hotel',          tone: 'wine' },
  { k: 'vuelo',    label: 'Vuelo',          tone: 'wine' },
  { k: 'peaje',    label: 'Peaje',          tone: 'neutral' },
  { k: 'combustible', label: 'Combustible', tone: 'warning' },
  { k: 'aduana',   label: 'Aduana',         tone: 'info' },
  { k: 'cliente',  label: 'Visita cliente', tone: 'success' },
  { k: 'otro',     label: 'Otro',           tone: 'neutral' },
];

// ── Helpers de localStorage ───────────────────────────────────
function readExpenses() {
  try {
    const raw = localStorage.getItem(MOBILE_LS_KEY + '_expenses');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return SEED_EXPENSES;
}
function writeExpenses(arr) {
  try { localStorage.setItem(MOBILE_LS_KEY + '_expenses', JSON.stringify(arr)); } catch (e) {}
}

function readCurrentUser() {
  try {
    const raw = localStorage.getItem(MOBILE_LS_KEY + '_user');
    if (raw) {
      const id = JSON.parse(raw);
      return MOBILE_USERS.find(u => u.id === id) || MOBILE_USERS[0];
    }
  } catch (e) {}
  return MOBILE_USERS[0];
}
function writeCurrentUser(user) {
  try { localStorage.setItem(MOBILE_LS_KEY + '_user', JSON.stringify(user.id)); } catch (e) {}
}

// ════════════════════════════════════════════════════════════════
function MobileApp() {
  const [tab, setTab] = React.useState('home');
  const [user, setUser] = React.useState(readCurrentUser);
  const [expenses, setExpenses] = React.useState(readExpenses);
  const [expenseModal, setExpenseModal] = React.useState(false);

  const changeUser = (u) => { setUser(u); writeCurrentUser(u); };
  const addExpense = (e) => {
    const next = [{ ...e, id: `EXP-2026-${String(143 + expenses.length).padStart(4, '0')}` }, ...expenses];
    setExpenses(next);
    writeExpenses(next);
    setExpenseModal(false);
  };

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 76, background: 'var(--bg-base)' }}>
      <MobileTopBar user={user} />
      <main style={{ paddingBottom: 16 }}>
        {tab === 'home'     && <HomeScreen user={user} setTab={setTab} expenses={expenses} onNewExpense={() => setExpenseModal(true)} />}
        {tab === 'tracking' && <TrackingScreen />}
        {tab === 'clients'  && <ClientsScreen user={user} />}
        {tab === 'expenses' && <ExpensesScreen user={user} expenses={expenses} onNew={() => setExpenseModal(true)} />}
        {tab === 'more'     && <MoreScreen user={user} setUser={changeUser} />}
      </main>
      <BottomNav tab={tab} setTab={setTab} />

      {expenseModal && (
        <NewExpenseModal
          user={user}
          onClose={() => setExpenseModal(false)}
          onSave={addExpense}
        />
      )}
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────
function MobileTopBar({ user }) {
  return (
    <header style={{
      padding: '14px 18px 12px',
      background: 'var(--bg-sidebar)',
      color: '#fff', display: 'flex', alignItems: 'center', gap: 12,
      position: 'sticky', top: 0, zIndex: 30,
      paddingTop: 'max(14px, env(safe-area-inset-top))',
    }}>
      <img src="assets/dtdcargo-isologo-reverse.png" alt="DTD-Cargo" style={{ height: 24, objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
      <div style={{ flex: 1 }}>
        <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>DTD-Cargo · Mobile ERP</div>
        <div style={{ font: '500 12px/1 var(--f-sans)', color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{user.location}</div>
      </div>
      <button style={{
        width: 36, height: 36, borderRadius: 'var(--r-pill)',
        background: 'var(--wine-tint)', color: 'var(--wine-soft)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {window.Icon.mail(16)}
        <span style={{ position: 'absolute', top: 4, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)' }} />
      </button>
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--r-pill)',
        background: `var(--${user.avatarTone === 'wine' ? 'wine' : user.avatarTone === 'info' ? 'info' : 'success'})`,
        color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        font: '800 13px/1 var(--f-display)',
      }}>{user.initials}</div>
    </header>
  );
}

// ── Bottom nav ───────────────────────────────────────────────
function BottomNav({ tab, setTab }) {
  const items = [
    { k: 'home',     label: 'Inicio',   icon: 'dashboard' },
    { k: 'tracking', label: 'Tracking', icon: 'radar' },
    { k: 'clients',  label: 'Clientes', icon: 'users' },
    { k: 'expenses', label: 'Gastos',   icon: 'invoice' },
    { k: 'more',     label: 'Más',       icon: 'more' },
  ];
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      maxWidth: 480, margin: '0 auto',
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      padding: '8px 8px',
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      zIndex: 30,
    }}>
      {items.map(it => {
        const active = tab === it.k;
        return (
          <button key={it.k} onClick={() => setTab(it.k)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '6px 4px', borderRadius: 'var(--r-md)',
            color: active ? 'var(--wine)' : 'var(--ink-mute)',
            font: `${active ? '700' : '500'} 10px/1 var(--f-sans)`,
            transition: 'color var(--dur-fast) var(--ease)',
          }}>
            <span style={{ color: active ? 'var(--wine)' : 'var(--ink-mute)' }}>{window.Icon[it.icon]?.(20)}</span>
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}

// ════════════════════════════════════════════════════════════════
// HOME SCREEN
// ════════════════════════════════════════════════════════════════
function HomeScreen({ user, setTab, expenses, onNewExpense }) {
  const D = window.ERPData;
  const R = window.ERPRates;
  const myExpenses = expenses.filter(e => e.userId === user.id);
  const todayExpensesUsd = myExpenses
    .filter(e => e.date.startsWith('2026-05-2'))
    .reduce((s, e) => {
      if (e.currency === 'USD') return s + e.amount;
      if (e.currency === 'VES') return s + R.vesToUsd(e.amount);
      if (e.currency === 'CNY') return s + (e.amount / 7.18);
      return s;
    }, 0);

  // Is current user on a trip? (Martina is in CN)
  const onTrip = user.location.includes('CN') || user.location.includes('Yiwu');

  return (
    <div style={{ padding: '20px 18px' }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>HOLA · {user.role}</div>
        <h1 style={{ font: '900 26px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '6px 0 0' }}>{user.name.split(' ')[0]}</h1>
        <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
          {onTrip
            ? 'Estás en viaje · cualquier gasto se asocia automáticamente al viaje CN.'
            : 'Tienes 24 embarques activos · 4 facturas por cobrar.'}
        </div>
      </div>

      {/* Travel banner */}
      {onTrip && (
        <div style={{
          padding: '14px 16px', marginBottom: 18,
          background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-lg)',
        }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>VIAJE EN CURSO</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)' }}>Yiwu · 4to día</div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
            5 proveedores visitados · 2 reuniones agendadas hoy · vuelta 28 may
          </div>
          <button onClick={onNewExpense} style={{
            marginTop: 10, width: '100%', padding: '10px',
            background: '#fff', color: 'var(--wine)',
            border: 0, borderRadius: 'var(--r-md)',
            font: '700 12.5px/1 var(--f-sans)',
          }}>+ Cargar gasto del viaje</button>
        </div>
      )}

      {/* 4 KPIs en grid 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <MobileMini label="Embarques activos" value="24" delta="+3 sem" tone="wine"    onClick={() => setTab('tracking')} />
        <MobileMini label="Facturas vencidas"  value="4"  delta="$162K"  tone="warning" />
        <MobileMini label="Leads nuevos"       value="18" delta="+5"     tone="info" />
        <MobileMini label="Gastos hoy"          value={`$${todayExpensesUsd.toFixed(0)}`} delta={`${myExpenses.length} total`} tone="success" onClick={() => setTab('expenses')} />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 18 }}>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>ACCIONES RÁPIDAS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <QuickAction icon="plus" label="Cargar gasto" desc="Foto + monto + categoría" tone="wine" onClick={onNewExpense} />
          <QuickAction icon="users" label="Clientes cerca" desc="Visitas imprevistas" tone="success" onClick={() => setTab('clients')} />
          <QuickAction icon="radar" label="Tracking en vivo" desc="Embarques activos" tone="info" onClick={() => setTab('tracking')} />
          <QuickAction icon="check" label="Aprobar (3)" desc="Cotizaciones pendientes" tone="warning" />
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>ACTIVIDAD RECIENTE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { tone: 'success', t: 'Pago recibido · Industrias Polar', m: 'F-2026-0391 · $156.800 · hace 1 h' },
            { tone: 'wine',    t: 'Embarque DTDU-472816 liberado',     m: 'PBL · listo para entrega · hace 3 h' },
            { tone: 'info',    t: 'Nuevo lead asignado',                m: 'Mendoza & Cía CA · hace 5 h' },
            { tone: 'warning', t: 'F-2026-0418 vencida hace 10d',     m: 'Acindar Comercial · $84.200' },
          ].map((a, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 12px', background: 'var(--bg-surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${a.tone})`, marginTop: 6, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{a.t}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{a.m}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobileMini({ label, value, delta, tone = 'wine', onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 14px', background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
      textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <span style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{value}</span>
      <span style={{ font: '700 11px/1 var(--f-sans)', color: `var(--${tone})` }}>{delta}</span>
    </button>
  );
}

function QuickAction({ icon, label, desc, tone, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '14px 14px', background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
      textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 'var(--r-md)',
        background: `var(--${tone}-bg)`, color: `var(--${tone})`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{window.Icon[icon](16)}</span>
      <div>
        <div style={{ font: '700 13px/1.1 var(--f-sans)', color: 'var(--ink)' }}>{label}</div>
        <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{desc}</div>
      </div>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// TRACKING SCREEN
// ════════════════════════════════════════════════════════════════
function TrackingScreen() {
  const D = window.ERPData;
  const [search, setSearch] = React.useState('');
  const [detail, setDetail] = React.useState(null);
  const shipments = D.SHIPMENTS.filter(s => !['entregado', 'cotizado'].includes(s.status));
  const filtered = shipments.filter(s => !search ||
    s.id.toLowerCase().includes(search.toLowerCase()) ||
    s.clientName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ padding: '20px 18px' }}>
      <h1 style={{ font: '900 26px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Tracking</h1>
      <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, marginBottom: 18 }}>
        {shipments.length} embarques activos · ordenados por ETA
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 14px', height: 44,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', marginBottom: 14,
      }}>
        <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.search(16)}</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por DTDU, cliente…"
          style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '500 14px/1 var(--f-sans)', color: 'var(--ink)' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(s => (
          <ShipmentCard key={s.id} s={s} onClick={() => setDetail(s)} />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
            Sin resultados.
          </div>
        )}
      </div>

      {detail && <ShipmentSheet s={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ShipmentCard({ s, onClick }) {
  const D = window.ERPData;
  const statusTone = D.STATUS_TONE[s.status] || 'neutral';
  return (
    <button onClick={onClick} style={{
      padding: '14px 16px',
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderLeft: s.alert ? '4px solid var(--warning)' : '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
      textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '0.02em' }}>{s.id}</code>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '2px 8px', borderRadius: 'var(--r-sm)',
          background: `var(--${statusTone}-bg)`, color: `var(--${statusTone})`,
          font: '700 10.5px/1.4 var(--f-sans)', letterSpacing: '0.02em',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: `var(--${statusTone})` }} />
          {s.status}
        </span>
      </div>
      <div>
        <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.clientName}</div>
        <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
          {D.origin(s.origin).name} → {D.dest(s.destination).name}
        </div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Progreso · {s.progress}%</span>
          <span style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>ETA {s.eta?.slice(5) || '—'}</span>
        </div>
        <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${s.progress}%`, background: s.alert ? 'var(--warning)' : 'var(--wine)' }} />
        </div>
      </div>
    </button>
  );
}

function ShipmentSheet({ s, onClose }) {
  const D = window.ERPData;
  const statusTone = D.STATUS_TONE[s.status] || 'neutral';
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.5)', zIndex: 50,
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
        padding: 18, paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)',
        maxHeight: '88vh', overflow: 'auto',
        animation: 'erp-slide-in 220ms var(--ease)',
      }}>
        <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <code style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '0.02em' }}>{s.id}</code>
            <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 6 }}>{s.clientName}</div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 'var(--r-sm)',
            background: `var(--${statusTone}-bg)`, color: `var(--${statusTone})`,
            font: '700 11px/1.4 var(--f-sans)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: `var(--${statusTone})` }} />
            {s.status}
          </span>
        </div>

        {/* Mock map */}
        <div style={{
          position: 'relative', height: 160, marginBottom: 16,
          background: 'linear-gradient(135deg, var(--bg-sidebar), #1F3055)',
          borderRadius: 'var(--r-md)', overflow: 'hidden',
        }}>
          <svg viewBox="0 0 400 160" style={{ width: '100%', height: '100%' }}>
            <path d="M 60 80 Q 200 30 340 80" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
            <path d={`M 60 80 Q ${60 + (340 - 60) * (s.progress / 100)} ${80 - 35 * Math.sin((s.progress / 100) * Math.PI)} ${60 + (340 - 60) * (s.progress / 100)} ${80 - 35 * Math.sin((s.progress / 100) * Math.PI)}`} stroke="var(--wine-soft)" strokeWidth="2.5" fill="none" />
            <circle cx="60"  cy="80" r="8" fill="var(--success)" />
            <circle cx="340" cy="80" r="8" fill="var(--wine-soft)" opacity="0.5" />
            <circle cx={60 + (340 - 60) * (s.progress / 100)} cy={80 - 35 * Math.sin((s.progress / 100) * Math.PI)} r="6" fill="var(--wine-soft)" />
            <text x="60"  y="105" fontFamily="Archivo" fontSize="9.5" fontWeight="700" fill="rgba(255,255,255,0.7)" textAnchor="middle">{D.origin(s.origin).name}</text>
            <text x="340" y="105" fontFamily="Archivo" fontSize="9.5" fontWeight="700" fill="rgba(255,255,255,0.7)" textAnchor="middle">{D.dest(s.destination).name}</text>
          </svg>
          <div style={{
            position: 'absolute', top: 12, left: 12,
            font: '700 9px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>VISTA EN VIVO · MOCK</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <DetailField label="ETA" value={s.eta?.slice(5) || '—'} mono />
          <DetailField label="Progreso" value={`${s.progress}%`} />
          <DetailField label="Origen" value={D.origin(s.origin).name} />
          <DetailField label="Destino" value={D.dest(s.destination).name} />
          <DetailField label="Valor" value={`$${(s.value / 1000).toFixed(0)}K`} mono />
          <DetailField label="CBM" value={s.cbm || '—'} mono />
        </div>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <a href={`https://wa.me/?text=Hola, tu embarque ${s.id} (${s.clientName}) está en estado ${s.status}, ETA ${s.eta}. Progreso ${s.progress}%.`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
            <button style={{ width: '100%', height: 44, background: 'var(--success)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', font: '700 13px/1 var(--f-sans)' }}>
              Compartir status
            </button>
          </a>
          <button style={{ height: 44, background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', font: '700 13px/1 var(--f-sans)' }}>
            Ver completo
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, mono }) {
  return (
    <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ font: `${mono ? '700' : '600'} 13px/1.2 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`, color: 'var(--ink)' }}>{value}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// CLIENTS SCREEN
// ════════════════════════════════════════════════════════════════
function ClientsScreen({ user }) {
  const D = window.ERPData;
  const [search, setSearch] = React.useState('');
  const [mode, setMode] = React.useState('nearby'); // nearby | all
  // Mock distances (en km, basados en ciudad del cliente)
  const distances = {
    'DTD-5452': 0.4,  'DTD-5418': 2.1, 'DTD-5392': 3.8,
    'DTD-5371': 8.4,  'DTD-5354': 12.6, 'DTD-5340': 18.2,
    'DTD-5321': 22.8, 'DTD-5298': 1.8, 'DTD-5277': 28.4,
  };
  const clients = D.CLIENTS
    .filter(c => mode === 'all' || distances[c.markbox] !== undefined)
    .map(c => ({ ...c, distance: distances[c.markbox] || 999 }))
    .filter(c => !search ||
      c.markbox.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.distance - b.distance);

  return (
    <div style={{ padding: '20px 18px' }}>
      <h1 style={{ font: '900 26px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Clientes</h1>
      <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, marginBottom: 16 }}>
        {mode === 'nearby' ? `${clients.length} cerca de ${user.location.split(' ·')[0]}` : `${clients.length} clientes totales`}
      </div>

      {/* Mode toggle */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
        padding: 4, background: 'var(--bg-elevated)',
        borderRadius: 'var(--r-md)', marginBottom: 14,
      }}>
        {[
          { k: 'nearby', label: '📍 Cerca tuyo' },
          { k: 'all',    label: 'Todos · 187' },
        ].map(o => (
          <button key={o.k} onClick={() => setMode(o.k)} style={{
            padding: '10px 12px', borderRadius: 'var(--r-sm)',
            background: mode === o.k ? 'var(--bg-surface)' : 'transparent',
            color: mode === o.k ? 'var(--ink)' : 'var(--ink-soft)',
            font: `${mode === o.k ? '700' : '500'} 12.5px/1 var(--f-sans)`,
            boxShadow: mode === o.k ? 'var(--shadow-xs)' : 'none',
            transition: 'all var(--dur-fast) var(--ease)',
          }}>{o.label}</button>
        ))}
      </div>

      {/* Geo permission banner */}
      {mode === 'nearby' && (
        <div style={{
          padding: '10px 12px', marginBottom: 14,
          background: 'var(--info-bg)', borderLeft: '3px solid var(--info)',
          borderRadius: 'var(--r-md)',
          font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ color: 'var(--info)' }}>{window.Icon.radar(14)}</span>
          Usando ubicación · {user.location}. Tap en un cliente para coordinar visita.
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 14px', height: 42,
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', marginBottom: 14,
      }}>
        <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.search(16)}</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por Shipping Mark, nombre…"
          style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '500 14px/1 var(--f-sans)', color: 'var(--ink)' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {clients.map(c => <ClientCard key={c.markbox} c={c} showDistance={mode === 'nearby'} />)}
      </div>
    </div>
  );
}

function ClientCard({ c, showDistance }) {
  return (
    <div style={{
      padding: '12px 14px', background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 'var(--r-pill)',
          background: 'var(--wine-tint)', color: 'var(--wine)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          font: '800 12px/1 var(--f-display)', flexShrink: 0,
        }}>{c.company.split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{c.markbox}</code>
            <span style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>· {c.city}</span>
          </div>
        </div>
        {showDistance && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--wine)' }}>{c.distance < 1 ? `${(c.distance * 1000).toFixed(0)}m` : `${c.distance.toFixed(1)}km`}</div>
            <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 3, textTransform: 'uppercase' }}>{c.distance < 5 ? 'cerca' : 'lejos'}</div>
          </div>
        )}
      </div>
      <div style={{
        font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)',
        padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)',
        marginBottom: 10,
      }}>
        <strong style={{ color: 'var(--ink)' }}>{c.shipments}</strong> embarques · facturado <strong style={{ color: 'var(--ink)' }}>${(c.billed / 1000).toFixed(0)}K</strong>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        <a href={`tel:+58${c.markbox.replace(/[^0-9]/g, '')}`} style={{ textDecoration: 'none' }}>
          <button style={{ width: '100%', height: 36, background: 'var(--bg-elevated)', color: 'var(--ink)', border: 0, borderRadius: 'var(--r-md)', font: '600 11.5px/1 var(--f-sans)' }}>
            📞 Llamar
          </button>
        </a>
        <a href={`https://wa.me/?text=Hola ${c.company.split(' ')[0]}, te paso el status de tus envíos.`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <button style={{ width: '100%', height: 36, background: 'var(--success-bg)', color: 'var(--success)', border: 0, borderRadius: 'var(--r-md)', font: '600 11.5px/1 var(--f-sans)' }}>
            WhatsApp
          </button>
        </a>
        <button style={{ height: 36, background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', font: '700 11.5px/1 var(--f-sans)' }}>
          Visitar
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// EXPENSES SCREEN
// ════════════════════════════════════════════════════════════════
function ExpensesScreen({ user, expenses, onNew }) {
  const R = window.ERPRates;
  const [filter, setFilter] = React.useState('me'); // me | all
  const visible = filter === 'me' ? expenses.filter(e => e.userId === user.id) : expenses;

  const toUsd = (e) => {
    if (e.currency === 'USD') return e.amount;
    if (e.currency === 'VES') return R.vesToUsd(e.amount);
    if (e.currency === 'CNY') return e.amount / 7.18;
    return 0;
  };
  const totalUsd = visible.reduce((s, e) => s + toUsd(e), 0);
  const billable = visible.filter(e => e.billable).reduce((s, e) => s + toUsd(e), 0);

  return (
    <div style={{ padding: '20px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ font: '900 26px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Gastos</h1>
          <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
            {visible.length} cargados · {R.fmtUsd(totalUsd)} equivalente
          </div>
        </div>
        <button onClick={onNew} style={{
          width: 44, height: 44, borderRadius: 'var(--r-pill)',
          background: 'var(--wine)', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-md)', flexShrink: 0,
        }}>{window.Icon.plus(18)}</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16, marginBottom: 14 }}>
        <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Total</div>
          <div style={{ font: '900 20px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>{R.fmtUsd(totalUsd)}</div>
          <div style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>{R.fmtBs(R.usdToVes(totalUsd))}</div>
        </div>
        <div style={{ padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-lg)' }}>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Cobrable</div>
          <div style={{ font: '900 20px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>{R.fmtUsd(billable)}</div>
          <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>al cliente</div>
        </div>
      </div>

      {/* Filter toggle */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
        padding: 4, background: 'var(--bg-elevated)',
        borderRadius: 'var(--r-md)', marginBottom: 14,
      }}>
        {[{ k: 'me', label: 'Míos' }, { k: 'all', label: 'Equipo' }].map(o => (
          <button key={o.k} onClick={() => setFilter(o.k)} style={{
            padding: '10px 12px', borderRadius: 'var(--r-sm)',
            background: filter === o.k ? 'var(--bg-surface)' : 'transparent',
            color: filter === o.k ? 'var(--ink)' : 'var(--ink-soft)',
            font: `${filter === o.k ? '700' : '500'} 12.5px/1 var(--f-sans)`,
            boxShadow: filter === o.k ? 'var(--shadow-xs)' : 'none',
          }}>{o.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(e => <ExpenseRow key={e.id} e={e} />)}
        {visible.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
              Sin gastos cargados todavía. Tap el + para empezar.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ e }) {
  const R = window.ERPRates;
  const cat = EXPENSE_CATS.find(c => c.k === e.category) || EXPENSE_CATS[EXPENSE_CATS.length - 1];
  const usdEquiv = e.currency === 'USD' ? e.amount : e.currency === 'VES' ? R.vesToUsd(e.amount) : e.amount / 7.18;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12,
      padding: '12px 14px', background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      alignItems: 'center',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--r-md)',
        background: `var(--${cat.tone}-bg)`, color: `var(--${cat.tone})`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>{cat.label[0]}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{cat.label}</div>
        <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {e.note || '—'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
          <span>{e.date.slice(5, 10)}</span>
          <span>·</span>
          <span>{e.user}</span>
          {e.shipment && <><span>·</span><code style={{ color: 'var(--wine)' }}>{e.shipment}</code></>}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)' }}>
          {e.currency === 'USD' ? '$' : e.currency === 'VES' ? 'Bs. ' : '¥'}{e.amount.toLocaleString('es-VE')}
        </div>
        {e.currency !== 'USD' && (
          <div style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>
            ≈ ${usdEquiv.toFixed(0)}
          </div>
        )}
        {e.billable && (
          <div style={{ marginTop: 5, padding: '1px 6px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--r-sm)', font: '700 9px/1.4 var(--f-sans)', display: 'inline-block' }}>
            COBRABLE
          </div>
        )}
      </div>
    </div>
  );
}

// ── New expense modal ────────────────────────────────────────
function NewExpenseModal({ user, onClose, onSave }) {
  const D = window.ERPData;
  const [amount, setAmount] = React.useState('');
  const [currency, setCurrency] = React.useState('USD');
  const [category, setCategory] = React.useState('taxi');
  const [method, setMethod] = React.useState('cash');
  const [shipment, setShipment] = React.useState('');
  const [note, setNote] = React.useState('');
  const [billable, setBillable] = React.useState(false);

  const canSave = amount && Number(amount) > 0;

  const handleSave = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    onSave({
      date: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
      user: user.name.split(' ')[0] + ' ' + user.name.split(' ')[1]?.[0] + '.',
      userId: user.id,
      amount: Number(amount), currency, category, method,
      shipment: shipment || null,
      note, billable, location: user.location,
    });
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.5)', zIndex: 60,
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, margin: '0 auto',
        background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0',
        padding: 18, paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)',
        maxHeight: '94vh', overflow: 'auto',
        animation: 'erp-slide-in 220ms var(--ease)',
      }}>
        <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 14px' }} />
        <h2 style={{ font: '900 20px/1.1 var(--f-display)', color: 'var(--ink)', margin: '0 0 14px', letterSpacing: '-0.01em' }}>Nuevo gasto</h2>

        {/* Camera placeholder */}
        <button style={{
          width: '100%', padding: '20px',
          background: 'var(--bg-elevated)', border: '2px dashed var(--border-strong)',
          borderRadius: 'var(--r-md)', marginBottom: 14,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 28 }}>📷</span>
          <span style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>Fotografiar recibo</span>
          <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Opcional · ayuda al contador</span>
        </button>

        {/* Monto + moneda */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>MONTO</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
            <input
              type="number" inputMode="decimal"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              style={{
                width: '100%', height: 56, padding: '0 16px',
                background: 'var(--bg-surface)', border: '2px solid var(--wine)',
                borderRadius: 'var(--r-md)', outline: 'none',
                font: '900 24px/1 var(--f-display)', color: 'var(--ink)',
              }}
            />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={{
              height: 56, padding: '0 12px',
              background: 'var(--bg-surface)', border: '2px solid var(--border)',
              borderRadius: 'var(--r-md)', outline: 'none',
              font: '800 16px/1 var(--f-display)', color: 'var(--ink)',
              appearance: 'none', textAlign: 'center',
            }}>
              <option value="USD">USD $</option>
              <option value="VES">VES Bs.</option>
              <option value="CNY">CNY ¥</option>
            </select>
          </div>
        </div>

        {/* Categoría */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>CATEGORÍA</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EXPENSE_CATS.map(c => (
              <button key={c.k} onClick={() => setCategory(c.k)} style={{
                padding: '8px 12px', borderRadius: 'var(--r-pill)',
                background: category === c.k ? `var(--${c.tone}-bg)` : 'var(--bg-elevated)',
                color: category === c.k ? `var(--${c.tone})` : 'var(--ink-soft)',
                border: `1px solid ${category === c.k ? `var(--${c.tone})` : 'transparent'}`,
                font: '600 12px/1 var(--f-sans)',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Método de pago */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>FORMA DE PAGO</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { k: 'cash',     label: 'Efectivo' },
              { k: 'card',     label: 'Tarjeta' },
              { k: 'transfer', label: 'Transfer' },
              { k: 'crypto',   label: 'USDT' },
            ].map(m => (
              <button key={m.k} onClick={() => setMethod(m.k)} style={{
                padding: '10px 4px', borderRadius: 'var(--r-sm)',
                background: method === m.k ? 'var(--wine)' : 'var(--bg-elevated)',
                color: method === m.k ? '#fff' : 'var(--ink-soft)',
                font: `${method === m.k ? '700' : '500'} 11.5px/1 var(--f-sans)`,
              }}>{m.label}</button>
            ))}
          </div>
        </div>

        {/* Embarque (opcional) */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>EMBARQUE ASOCIADO · OPCIONAL</div>
          <select value={shipment} onChange={(e) => setShipment(e.target.value)} style={{
            width: '100%', height: 44, padding: '0 14px',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', outline: 'none',
            font: '500 13.5px/1 var(--f-sans)', color: 'var(--ink)',
            appearance: 'none',
          }}>
            <option value="">— Sin embarque</option>
            {D.SHIPMENTS.filter(s => !['entregado', 'cotizado'].includes(s.status)).slice(0, 8).map(s => (
              <option key={s.id} value={s.id}>{s.id} · {s.clientName}</option>
            ))}
          </select>
        </div>

        {/* Nota */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>NOTA · OPCIONAL</div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Taxi del hotel a la fábrica de Yiwu Trading"
            style={{
              width: '100%', minHeight: 60, padding: '12px',
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', outline: 'none', resize: 'none',
              font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink)',
            }}
          />
        </div>

        {/* Cobrable toggle */}
        <label style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', marginBottom: 18,
          background: billable ? 'var(--success-bg)' : 'var(--bg-elevated)',
          border: `1px solid ${billable ? 'var(--success)' : 'var(--border)'}`,
          borderRadius: 'var(--r-md)', cursor: 'pointer',
        }}>
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)}
            style={{ width: 20, height: 20, accentColor: 'var(--success)' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Cobrable al cliente</div>
            <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Se factura en el cierre del embarque</div>
          </div>
        </label>

        {/* Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
          <button onClick={onClose} style={{ height: 52, background: 'var(--bg-elevated)', color: 'var(--ink)', border: 0, borderRadius: 'var(--r-md)', font: '700 14px/1 var(--f-sans)' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!canSave} style={{
            height: 52, background: canSave ? 'var(--wine)' : 'var(--bg-elevated)',
            color: canSave ? '#fff' : 'var(--ink-mute)',
            border: 0, borderRadius: 'var(--r-md)',
            font: '800 14px/1 var(--f-sans)',
            opacity: canSave ? 1 : 0.6,
          }}>
            Guardar gasto
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// MORE SCREEN
// ════════════════════════════════════════════════════════════════
function MoreScreen({ user, setUser }) {
  return (
    <div style={{ padding: '20px 18px' }}>
      <h1 style={{ font: '900 26px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Más</h1>

      {/* User card */}
      <div style={{
        marginTop: 18, padding: '18px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 'var(--r-pill)',
          background: `var(--${user.avatarTone === 'wine' ? 'wine' : user.avatarTone === 'info' ? 'info' : 'success'})`,
          color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          font: '900 22px/1 var(--f-display)',
        }}>{user.initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)' }}>{user.name}</div>
          <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{user.role}</div>
          <div style={{ font: '500 11px/1.3 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>📍 {user.location}</div>
        </div>
      </div>

      {/* Demo · cambio de persona */}
      <div style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>DEMO · CAMBIAR USUARIO</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {MOBILE_USERS.map(u => (
            <button key={u.id} onClick={() => setUser(u)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 'var(--r-md)',
              background: u.id === user.id ? 'var(--wine-tint)' : 'var(--bg-surface)',
              border: `1px solid ${u.id === user.id ? 'var(--wine)' : 'var(--border)'}`,
              textAlign: 'left',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--r-pill)',
                background: `var(--${u.avatarTone === 'wine' ? 'wine' : u.avatarTone === 'info' ? 'info' : 'success'})`,
                color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                font: '700 11px/1 var(--f-display)',
              }}>{u.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{u.name}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{u.role} · {u.location}</div>
              </div>
              {u.id === user.id && <span style={{ color: 'var(--wine)' }}>{window.Icon.check(14)}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Menu items */}
      <div style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>HERRAMIENTAS</div>
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          {[
            { icon: 'mail',     label: 'Notificaciones',         badge: '12' },
            { icon: 'check',    label: 'Aprobaciones pendientes', badge: '3' },
            { icon: 'doc',      label: 'Mis documentos' },
            { icon: 'shield',   label: 'Audit log' },
            { icon: 'calc',     label: 'Cotizador rápido' },
            { icon: 'chart',    label: 'Reportes' },
          ].map((it, i, arr) => (
            <button key={it.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 14px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 0,
              textAlign: 'left',
            }}>
              <span style={{ color: 'var(--wine)' }}>{window.Icon[it.icon](16)}</span>
              <span style={{ flex: 1, font: '600 13.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{it.label}</span>
              {it.badge && (
                <span style={{ padding: '2px 7px', background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-sm)', font: '700 10px/1.4 var(--f-sans)' }}>{it.badge}</span>
              )}
              <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.chevR(13)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div style={{ marginTop: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>AJUSTES</div>
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          {['Mi perfil', 'Preferencias', 'Cambiar contraseña', 'Cerrar sesión'].map((label, i, arr) => (
            <button key={label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 14px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 0,
              textAlign: 'left',
              color: i === arr.length - 1 ? 'var(--danger)' : 'var(--ink)',
            }}>
              <span style={{ flex: 1, font: '600 13.5px/1 var(--f-sans)' }}>{label}</span>
              {i < arr.length - 1 && <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.chevR(13)}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        marginTop: 24, padding: '12px',
        textAlign: 'center',
        font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)',
      }}>
        DTD-Cargo Mobile · v1.1 · build mayo 2026
      </div>
    </div>
  );
}

window.MobileApp = MobileApp;
