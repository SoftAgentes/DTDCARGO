/* @iife */ (function(){
/* global React */
/* ── Tu día · bandeja personal cross-módulo, consciente del rol ─ */
/* Standalone para review. Cada usuario ve SU día (deriva de datos    */
/* reales: SHIPMENTS, INVOICES, QUOTES, NOTIFS). Wiring al ERP: TODO.  */

const TD_MOD_LABELS = {
  dashboard: 'Dashboard', shipments: 'Embarques', invoices: 'Facturación', cn: 'Almacén CN',
  ve: 'Almacén VE', despacho: 'Despacho', quotes: 'Cotizador', leads: 'Leads', clients: 'Clientes',
  reconcile: 'Conciliación', contab: 'Contabilidad', tms: 'TMS', documents: 'Documentos', users: 'Usuarios',
};

const GROUPS = {
  approvals: { label: 'Aprobaciones', icon: 'check',     tone: 'wine' },
  shipments: { label: 'Embarques que requieren acción', icon: 'box', tone: 'info' },
  invoices:  { label: 'Cobranzas', icon: 'invoice',      tone: 'warning' },
  quotes:    { label: 'Cotizaciones por seguir', icon: 'box', tone: 'info' },
  alerts:    { label: 'Alertas operativas', icon: 'radar', tone: 'danger' },
  notifs:    { label: 'Notificaciones', icon: 'bell',    tone: 'neutral' },
};

// ── Generador de tareas por rol ───────────────────────────────
function generateTasks(user, D) {
  const role = user.role;
  const isAdmin = role === 'Admin';
  const tasks = [];
  const can = (...roles) => isAdmin || roles.includes(role);

  // 1 · Aprobaciones (Admin / Dirección)
  if (isAdmin) {
    tasks.push(
      { group: 'approvals', priority: 1, mod: 'cn', title: 'Cierre de contenedor CN · 48.2 CBM', sub: 'Yiwu pide booking · supera umbral de 45 CBM', action: 'Revisar' },
      { group: 'approvals', priority: 1, mod: 'clients', title: 'Aumento de límite de crédito · DTD-5392', sub: 'Industrias Polar solicita +$50K', action: 'Aprobar' },
      { group: 'approvals', priority: 2, mod: 'invoices', title: 'Nota de crédito F-2026-0418', sub: 'Acindar · ajuste por diferencia de flete', action: 'Autorizar' },
    );
  }

  // 2 · Embarques que requieren acción (Ops / Almacén / Admin)
  if (can('Operaciones', 'Almacén CN', 'Almacén VE')) {
    const actionMap = {
      'recibido CN':  { sub: 'Listo para consolidar en contenedor', mod: 'cn',  do: 'Consolidar' },
      'consolidado':  { sub: 'Listo para despacho de contenedor',   mod: 'cn',  do: 'Despachar' },
      'aduana VE':    { sub: 'En aduana VE · gestionar liberación', mod: 've',  do: 'Liberar' },
      'liberado':     { sub: 'Liberado · programar entrega final',  mod: 've',  do: 'Programar' },
    };
    const hubFilter = (s) => {
      if (role === 'Almacén CN') return ['recibido CN', 'consolidado'].includes(s.status);
      if (role === 'Almacén VE') return ['aduana VE', 'liberado'].includes(s.status);
      return actionMap[s.status];
    };
    D.SHIPMENTS.filter(s => actionMap[s.status] && hubFilter(s)).slice(0, 5).forEach(s => {
      const a = actionMap[s.status];
      tasks.push({ group: 'shipments', priority: 2, mod: a.mod, code: s.id, title: `${s.id} · ${s.clientName}`, sub: a.sub, badge: s.status, action: a.do });
    });
  }

  // 3 · Cobranzas (Contabilidad / Admin)
  if (can('Contabilidad')) {
    D.INVOICES.filter(inv => inv.status === 'vencida' || (inv.status !== 'pagada' && daysTo(inv.due) <= 7)).slice(0, 5).forEach(inv => {
      const overdue = inv.status === 'vencida' || daysTo(inv.due) < 0;
      tasks.push({
        group: 'invoices', priority: overdue ? 1 : 2, mod: 'invoices', code: inv.id,
        title: `${inv.id} · ${inv.clientName}`,
        sub: overdue ? `Vencida hace ${Math.abs(daysTo(inv.due))} días · $${(inv.amount/1000).toFixed(0)}K` : `Vence en ${daysTo(inv.due)} días · $${(inv.amount/1000).toFixed(0)}K`,
        badge: overdue ? 'vencida' : 'por vencer', action: 'Gestionar cobro',
      });
    });
  }

  // 4 · Cotizaciones por seguir (Comercial / Admin)
  if (can('Comercial')) {
    D.QUOTES.filter(q => (isAdmin || q.agent === user.name) && ['enviada', 'borrador'].includes(q.status)).slice(0, 5).forEach(q => {
      tasks.push({
        group: 'quotes', priority: q.status === 'enviada' ? 2 : 3, mod: 'quotes', code: q.id,
        title: `${q.id} · ${q.clientName}`,
        sub: q.status === 'enviada' ? `Enviada · $${(q.totalUSD/1000).toFixed(1)}K · sin respuesta` : `Borrador sin enviar · $${(q.totalUSD/1000).toFixed(1)}K`,
        badge: q.status, action: q.status === 'enviada' ? 'Dar seguimiento' : 'Completar',
      });
    });
  }

  // 5 · Alertas operativas (todos los roles operativos / admin)
  if (can('Operaciones', 'Almacén CN', 'Almacén VE', 'Contabilidad')) {
    tasks.push({ group: 'alerts', priority: 1, mod: 'cn', title: 'Contenedor CN al 91% · 48.2 / 53 CBM', sub: 'Cerrar pronto y pedir reserva de booking', badge: 'crítico', action: 'Ver consolidación' });
    if (can('Operaciones', 'Almacén VE')) {
      tasks.push({ group: 'alerts', priority: 2, mod: 'shipments', code: 'DTDU-419032', title: 'DTDU-419032 · ETA +2 días', sub: 'Industrias Polar · demora naviera · avisar cliente', badge: 'demora', action: 'Notificar' });
    }
  }

  // 6 · Notificaciones sin leer (todos)
  D.NOTIFS.slice(0, 4).forEach(n => {
    tasks.push({ group: 'notifs', priority: 4, mod: notifMod(n.type), title: n.t, sub: n.m, badge: null, action: null, tone: n.tone });
  });

  return tasks;
}

function daysTo(dateStr) {
  const today = new Date('2026-05-31').getTime();
  return Math.round((new Date(dateStr).getTime() - today) / 86400000);
}
function notifMod(type) {
  return { tracking: 'shipments', sales: 'quotes', finance: 'invoices', alert: 'shipments', crm: 'leads', warehouse: 'cn' }[type] || 'dashboard';
}

// ════════════════════════════════════════════════════════════════
function TuDia({ userId: pid } = {}) {
  const D = window.ERPData;
  const U = window.ERPUI;

  const initialId = React.useMemo(() => {
    if (pid && D.USERS.find(u => u.id === pid)) return pid;
    try { const id = new URLSearchParams(window.location.search).get('id'); return id && D.USERS.find(u => u.id === id) ? id : 'u-001'; }
    catch (e) { return 'u-001'; }
  }, []);
  const [userId, setUserId] = React.useState(initialId);
  const [done, setDone] = React.useState({});

  const user = D.USERS.find(u => u.id === userId);
  const allTasks = React.useMemo(() => generateTasks(user, D), [userId]);
  const tasks = allTasks.filter((t, i) => !done[taskKey(t, i)]);

  const actionable = tasks.filter(t => t.group !== 'notifs');
  const grouped = {};
  tasks.forEach((t, i) => { (grouped[t.group] = grouped[t.group] || []).push({ ...t, _i: allTasks.indexOf(t) }); });
  const order = ['approvals', 'alerts', 'shipments', 'invoices', 'quotes', 'notifs'];

  const firstName = user.name.split(' ')[0];
  const hour = 9;
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <TopBar userId={userId} setUserId={setUserId} users={D.USERS} />

      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 32px 60px' }}>
        {/* Greeting header */}
        <div style={{ marginBottom: 24, animation: 'td-rise .4s var(--ease) both' }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>TU DÍA · SÁBADO 31 MAYO 2026</div>
          <h1 style={{ font: '900 30px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>
            {greeting}, {firstName}.
          </h1>
          <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '8px 0 0', maxWidth: 560 }}>
            {actionable.length === 0
              ? 'Estás al día — no tenés pendientes que requieran acción ahora mismo. 🎯'.replace(' 🎯', '.')
              : <>Tenés <strong style={{ color: 'var(--wine)' }}>{actionable.length} {actionable.length === 1 ? 'pendiente' : 'pendientes'}</strong> que requieren tu acción. Empecemos por lo más urgente.</>}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>
          {/* Main · task groups */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {actionable.length === 0 && (
              <U.Card padded>
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.check(26)}</div>
                  <div style={{ font: '800 16px/1.2 var(--f-display)', color: 'var(--ink)' }}>Bandeja vacía</div>
                  <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>No tenés pendientes asignados a tu rol hoy.</div>
                </div>
              </U.Card>
            )}
            {order.filter(g => grouped[g]).map(g => (
              <TaskGroup key={g} groupKey={g} items={grouped[g]} onDone={(i) => setDone(d => ({ ...d, [taskKey(allTasks[i], i)]: true }))} />
            ))}
          </div>

          {/* Right rail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 84 }}>
            <SummaryCard tasks={allTasks} doneCount={Object.keys(done).length} />
            <AgendaCard />
            <QuickLinks role={user.role} />
          </div>
        </div>
      </div>
    </div>
  );
}

function taskKey(t, i) { return `${t.group}-${t.code || t.title}-${i}`; }

// ── Top bar ──────────────────────────────────────────────────
function TopBar({ userId, setUserId, users }) {
  const I = window.Icon;
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <a href="../DTD Studio · ERP.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', textDecoration: 'none' }}>{I.arrowL(13)} ERP</a>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>Tu día</span>
      <div style={{ flex: 1 }} />
      <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Viendo como:</span>
      <select value={userId} onChange={(e) => { setUserId(e.target.value); history.replaceState(null, '', `?id=${e.target.value}`); }}
        style={{ padding: '6px 28px 6px 10px', background: 'var(--bg-elevated) url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"10\\" height=\\"6\\" viewBox=\\"0 0 10 6\\"><path d=\\"M1 1l4 4 4-4\\" stroke=\\"%236B6B6B\\" stroke-width=\\"1.6\\" fill=\\"none\\" stroke-linecap=\\"round\\"/></svg>") no-repeat right 10px center', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)', appearance: 'none', outline: 'none', cursor: 'pointer' }}>
        {users.map(u => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}
      </select>
    </header>
  );
}

// ── Task group ───────────────────────────────────────────────
function TaskGroup({ groupKey, items, onDone }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const g = GROUPS[groupKey];
  const isNotif = groupKey === 'notifs';
  return (
    <U.Card padded={false}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', background: `var(--${g.tone}-bg, var(--bg-elevated))`, color: `var(--${g.tone}, var(--ink-soft))`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{I[g.icon] ? I[g.icon](14) : null}</span>
        <span style={{ font: '800 13px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{g.label}</span>
        <span style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-mute)', padding: '3px 7px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)' }}>{items.length}</span>
      </div>
      <div>
        {items.map((t, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
            {!isNotif && <PriorityDot p={t.priority} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ font: '600 13.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{t.title}</span>
                {t.badge && <U.Badge tone={badgeTone(t.badge)} size="sm" dot>{t.badge}</U.Badge>}
              </div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{t.sub}</div>
            </div>
            {t.action ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <a href={`../DTD Studio · ERP.html#${t.mod}`} style={{ textDecoration: 'none' }}><U.Btn variant="secondary" size="sm">{t.action}</U.Btn></a>
                <button onClick={() => onDone(t._i)} title="Marcar como hecho" style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink-mute)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{I.check(13)}</button>
              </div>
            ) : (
              <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-mute)', flexShrink: 0 }}>{TD_MOD_LABELS[t.mod] || ''}</span>
            )}
          </div>
        ))}
      </div>
    </U.Card>
  );
}

function PriorityDot({ p }) {
  const tone = p === 1 ? 'danger' : p === 2 ? 'warning' : 'neutral';
  const label = p === 1 ? 'Urgente' : p === 2 ? 'Hoy' : 'Pronto';
  return <span title={label} style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${tone})`, flexShrink: 0 }} />;
}
function badgeTone(b) {
  return { 'vencida': 'danger', 'por vencer': 'warning', 'crítico': 'danger', 'demora': 'warning', 'enviada': 'info', 'borrador': 'neutral', 'recibido CN': 'info', 'consolidado': 'wine', 'aduana VE': 'warning', 'liberado': 'success' }[b] || 'neutral';
}

// ── Summary card ─────────────────────────────────────────────
function SummaryCard({ tasks, doneCount }) {
  const U = window.ERPUI;
  const actionable = tasks.filter(t => t.group !== 'notifs');
  const urgent = actionable.filter(t => t.priority === 1).length;
  const total = actionable.length + doneCount;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>RESUMEN DEL DÍA</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ font: '900 34px/1 var(--f-display)', color: 'var(--wine)' }}>{actionable.length}</span>
        <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>pendientes</span>
      </div>
      <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14 }}>{urgent > 0 ? <><strong style={{ color: 'var(--danger)' }}>{urgent} urgente{urgent > 1 ? 's' : ''}</strong> · resto para hoy</> : 'Nada urgente — buen momento.'}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Completado hoy</span>
        <span style={{ font: '800 12px/1 var(--f-display)', color: 'var(--success)' }}>{doneCount}</span>
      </div>
      <U.Progress value={pct} tone="success" />
    </U.Card>
  );
}

// ── Agenda card ──────────────────────────────────────────────
function AgendaCard() {
  const events = [
    { time: '09:30', text: 'Call con Yiwu · consolidación', tone: 'wine' },
    { time: '12:00', text: 'Cierre contenedor DTDU-472816', tone: 'info' },
    { time: '15:00', text: 'Revisión cobranzas semana', tone: 'warning' },
  ];
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>AGENDA DE HOY</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {events.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <code style={{ font: '700 11px/1.4 var(--f-mono)', color: 'var(--ink-soft)', flexShrink: 0, width: 38 }}>{e.time}</code>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${e.tone})`, marginTop: 4, flexShrink: 0 }} />
            <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{e.text}</span>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

// ── Quick links by role ──────────────────────────────────────
function QuickLinks({ role }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const byRole = {
    'Admin':        [['dashboard', 'Dashboard'], ['users', 'Usuarios'], ['reports', 'Reportes']],
    'Comercial':    [['quotes', 'Nueva cotización'], ['leads', 'Leads'], ['clients', 'Clientes']],
    'Operaciones':  [['cn', 'Almacén CN'], ['despacho', 'Despacho'], ['tms', 'TMS']],
    'Contabilidad': [['invoices', 'Facturación'], ['reconcile', 'Conciliación'], ['contab', 'Contabilidad']],
    'Almacén CN':   [['cn', 'Almacén CN'], ['qrqueue', 'Cola QR'], ['labels', 'Etiquetas']],
    'Almacén VE':   [['ve', 'Almacén VE'], ['despacho', 'Despacho']],
    'Soporte':      [['clients', 'Clientes'], ['documents', 'Documentos']],
  };
  const links = byRole[role] || [['dashboard', 'Dashboard']];
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>ACCESOS RÁPIDOS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {links.map(([mod, label]) => (
          <a key={mod} href={`../DTD Studio · ERP.html#${mod}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)', textDecoration: 'none' }}>
            {label} <span style={{ color: 'var(--ink-mute)' }}>{I.arrowR(12)}</span>
          </a>
        ))}
      </div>
    </U.Card>
  );
}

window.TuDia = TuDia;

})();
