/* global React */
/* ── DTD ERP · Flujo de trabajo · v1.9.1 ────────────────────── */
/* Mapa de proceso al estilo "workflow view": carriles de nodos  */
/* conectados, clickeables, con badges en vivo. Diseño propio    */
/* DTD (no copia de QuickBooks) · usado en Inicio + Contabilidad. */

// Lectura defensiva de contadores en vivo.
function _safe(fn) { try { const v = fn(); return (v == null || Number.isNaN(v)) ? null : v; } catch (e) { return null; } }
function _n(v) { return (v && v > 0) ? v : null; }

// ── Carriles del flujo ────────────────────────────────────────
// node.to = args para goTo(...). node.badge() = número (o null).
// node.done() = true → check verde (paso al día).
function LANES() {
  const D = window.ERPData;
  const T = window.TesoreriaData;
  const N = window.NavieraData;
  const CV = window.ConversacionesData;
  const C = window.ContabilidadData;

  return [
    {
      id: 'ventas', label: 'Venta', sub: 'Captar y cerrar', icon: 'spark', tone: 'info',
      roles: ['Admin', 'Comercial'],
      nodes: [
        { label: 'Leads', icon: 'spark', to: ['leads'], badge: () => _n(_safe(() => D.LEADS.filter(l => l.stage === 'nuevo').length)) },
        { label: 'Estimado', icon: 'calc', to: ['estimados'] },
        { label: 'Cliente', icon: 'users', to: ['clients'] },
        { label: 'Orden de venta', icon: 'clock', to: ['shipments'] },
        { label: 'Factura', icon: 'invoice', to: ['invoices'] },
      ],
    },
    {
      id: 'entra', label: 'Dinero que entra', sub: 'Cobrar', icon: 'invoice', tone: 'success',
      roles: ['Admin', 'Contabilidad', 'Comercial'], finance: true,
      nodes: [
        { label: 'Crear factura', icon: 'invoice', to: ['invoices', null, 'create'] },
        { label: 'Enviar', icon: 'mail', to: ['mailing'] },
        { label: 'Registrar cobro', icon: 'check', to: ['invoices'] },
        { label: 'Conciliar banco', icon: 'chart', to: ['reconcile'] },
      ],
    },
    {
      id: 'operacion', label: 'Operaciones', sub: 'Mover la carga', icon: 'ship', tone: 'wine', finance: true,
      roles: ['Admin', 'Operaciones', 'Almacén CN', 'Almacén VE'],
      nodes: [
        { label: 'Prealertas', icon: 'box', to: ['cn', null, 'camino'], badge: () => _n(_safe(() => window.ERPData.byTenant(window.ERPData.ORDERS).filter(o => o.status !== 'verificada').length)) },
        { label: 'Recibir en CN', icon: 'warehouse', to: ['cn'] },
        { label: 'Cola de QR', icon: 'tag', to: ['qrqueue'] },
        { label: 'Consolidar', icon: 'box', to: ['naviera'], badge: () => _n(_safe(() => N.consolidating().length)) },
        { label: 'Booking naviera', icon: 'ship', to: ['naviera'] },
        { label: 'Aduana SENIAT', icon: 'shield', to: ['seniat'], badge: () => _n(_safe(() => D.SHIPMENTS.filter(s => s.status === 'aduana VE').length)) },
        { label: 'Despacho', icon: 'truck', to: ['despacho'] },
        { label: 'Entrega', icon: 'radar', to: ['tracking'] },
      ],
    },
    {
      id: 'sale', label: 'Dinero que sale', sub: 'Pagar', icon: 'cn', tone: 'warning',
      roles: ['Admin', 'Contabilidad'], finance: true,
      nodes: [
        { label: 'Registrar CxP', icon: 'invoice', to: ['tesoreria'], badge: () => _n(_safe(() => T.openPayables().length)) },
        { label: 'Programar pago', icon: 'clock', to: ['tesoreria'], badge: () => _n(_safe(() => T.dueSoon(7).length)) },
        { label: 'Remesa a China', icon: 'cn', to: ['tesoreria'] },
        { label: 'Naviera / aduana', icon: 'ship', to: ['tesoreria'] },
      ],
    },
    {
      id: 'cierre', label: 'Cierre y reportes', sub: 'Contabilizar', icon: 'chart', tone: 'wine',
      roles: ['Admin', 'Contabilidad'], finance: true,
      nodes: [
        { label: 'Banco', icon: 'check', to: ['reconcile'] },
        { label: 'Asientos', icon: 'edit', to: ['contab'], badge: () => _n(_safe(() => C.JOURNAL_ENTRIES.filter(e => e.status === 'borrador').length)) },
        { label: 'P&L / Balance', icon: 'chart', to: ['contab'] },
        { label: 'Impuestos', icon: 'shield', to: ['seniat'] },
      ],
    },
    {
      id: 'servicio', label: 'Servicio al cliente', sub: 'Atender', icon: 'chat', tone: 'info',
      roles: ['Admin', 'Soporte', 'Comercial'],
      nodes: [
        { label: 'Conversaciones', icon: 'chat', to: ['conversaciones'], badge: () => _n(_safe(() => CV.byStatus('abierto').length)) },
        { label: 'Reclamos', icon: 'shield', to: ['conversaciones'], badge: () => _n(_safe(() => CV.openReclamos().length)) },
      ],
    },
  ];
}

// ── Nodo individual ───────────────────────────────────────────
function FlowNode({ node, tone, goTo }) {
  const I = window.Icon;
  const badge = node.badge ? node.badge() : null;
  const done = node.done ? node.done() : false;
  // Nodo con pendientes → anillo del tono del carril + badge; sin pendientes → neutro.
  const hasPending = badge != null && badge > 0;
  const ring = hasPending ? `var(--${tone})` : 'var(--border-strong)';
  const ic = hasPending ? `var(--${tone})` : 'var(--ink-soft)';
  return (
    <button
      onClick={() => goTo(...node.to)}
      title={node.label}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        width: 88, flexShrink: 0, padding: '4px 2px', cursor: 'pointer',
        background: 'transparent',
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <span style={{
          width: 46, height: 46, borderRadius: '50%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg-surface)', border: `2px solid ${ring}`, color: ic,
          transition: 'all var(--dur-fast) var(--ease)',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `var(--${tone})`; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = `var(--${tone})`; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = ic; e.currentTarget.style.borderColor = ring; }}
        >{I[node.icon] ? I[node.icon](20) : I.box(20)}</span>
        {badge != null && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff',
            font: '700 10px/18px var(--f-sans)', textAlign: 'center', border: '2px solid var(--bg-surface)',
          }}>{badge}</span>
        )}
        {done && badge == null && (
          <span style={{
            position: 'absolute', top: -3, right: -3, width: 18, height: 18, borderRadius: '50%',
            background: 'var(--success)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--bg-surface)',
          }}>{I.check(10)}</span>
        )}
      </span>
      <span style={{ font: '600 11px/1.25 var(--f-sans)', color: 'var(--ink)', textAlign: 'center' }}>{node.label}</span>
    </button>
  );
}

// ── Carril (lane) ─────────────────────────────────────────────
function FlowLane({ lane, goTo }) {
  const I = window.Icon;
  const pendientes = lane.nodes.reduce((s, n) => s + (n.badge ? (n.badge() || 0) : 0), 0);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '150px 1fr', gap: 16, alignItems: 'center',
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow-xs)', padding: '18px 20px',
    }}>
      {/* Etiqueta del carril */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderRight: '1px solid var(--border)', paddingRight: 16, minHeight: 64, justifyContent: 'center' }}>
        <span style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: `var(--${lane.tone}-bg)`, color: `var(--${lane.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I[lane.icon]?.(17)}</span>
        <div>
          <div style={{ font: '800 13.5px/1.15 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{lane.label}</div>
          <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{lane.sub}</div>
        </div>
        {pendientes > 0 && (
          <span style={{ alignSelf: 'flex-start', padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 10px/1.4 var(--f-sans)' }}>{pendientes} pendiente{pendientes === 1 ? '' : 's'}</span>
        )}
        {pendientes === 0 && (
          <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--success-bg)', color: 'var(--success)', font: '700 10px/1.4 var(--f-sans)' }}>{I.check(10)} Al día</span>
        )}
      </div>
      {/* Nodos + conectores */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, overflowX: 'auto', paddingTop: 4 }}>
        {lane.nodes.map((n, i) => (
          <React.Fragment key={n.label}>
            {i > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--border-strong)', alignSelf: 'center', marginBottom: 22, flexShrink: 0 }}>{I.arrowR(16)}</span>
            )}
            <FlowNode node={n} tone={lane.tone} goTo={goTo} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Mapa reutilizable ─────────────────────────────────────────
function WorkflowMap({ lanes, goTo }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {lanes.map(lane => <FlowLane key={lane.id} lane={lane} goTo={goTo} />)}
    </div>
  );
}

// Subconjunto financiero (para el tab de Contabilidad).
function financeLanes() { return LANES().filter(l => l.finance); }

// ── Módulo Inicio (pantalla de bienvenida por rol) ────────────
function ModuleInicio({ goTo, currentUser }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const role = currentUser?.role || (window.__currentUser?.role) || 'Admin';
  const lanes = LANES().filter(l => l.roles.includes(role));
  const totalPend = lanes.reduce((s, l) => s + l.nodes.reduce((a, n) => a + (n.badge ? (n.badge() || 0) : 0), 0), 0);
  const lanesPend = lanes.filter(l => l.nodes.some(n => n.badge && (n.badge() || 0) > 0)).length;
  const hour = 13;
  const saludo = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const first = (currentUser?.name || 'Equipo').split(' ')[0];

  return (
    <div>
      <U.PageHeader
        eyebrow={`INICIO · ${role.toUpperCase()}`}
        title={`${saludo}, ${first}`}
        subtitle="¿Qué quieres hacer hoy? Elige un paso del flujo. Los números en rojo marcan lo que tiene pendientes."
        actions={<U.Btn variant="secondary" icon={I.dashboard(14)} onClick={() => goTo('dashboard')}>Ver dashboard</U.Btn>}
      />
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '12px 16px',
        borderRadius: 'var(--r-md)',
        background: totalPend > 0 ? 'var(--wine-tint)' : 'var(--success-bg)',
        border: `1px solid ${totalPend > 0 ? 'var(--wine)' : 'var(--success)'}`,
      }}>
        <span style={{ color: totalPend > 0 ? 'var(--wine)' : 'var(--success)', display: 'inline-flex' }}>{totalPend > 0 ? I.bell(16) : I.check(16)}</span>
        <span style={{ font: '600 13px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
          {totalPend > 0
            ? <>Tienes <b>{totalPend}</b> {totalPend === 1 ? 'tarea pendiente' : 'tareas pendientes'} en <b>{lanesPend}</b> {lanesPend === 1 ? 'área' : 'áreas'}. Empezá por los nodos con número.</>
            : <>Todo al día. No hay pendientes en tus áreas — buen trabajo.</>}
        </span>
      </div>
      {lanes.length > 0
        ? <WorkflowMap lanes={lanes} goTo={goTo} />
        : <U.EmptyState icon={I.flow(22)} title="Sin flujo asignado" body="Tu rol no tiene un carril de trabajo configurado. Usa el menú lateral." />}
    </div>
  );
}

window.WorkflowMap = WorkflowMap;
window.WorkflowLanes = LANES;
window.financeLanes = financeLanes;
window.ModuleInicio = ModuleInicio;

// ── Mapa de proceso · integrado (antes abría pestaña aparte) ──
function ModuleMapaProceso() {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 130px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
          Mapa de proceso completo CN → VE, integrado en el ERP. Para editarlo se trabaja sobre <code style={{ font: '600 11px/1 var(--f-mono)' }}>Mapa de Proceso.html</code> — los cambios se ven acá al recargar.
        </div>
        <a href="Mapa de Proceso.html" target="_blank" rel="noopener" style={{ textDecoration: 'none', flexShrink: 0 }}>
          <U.Btn variant="ghost" size="sm" icon={window.Icon.external(12)}>Pestaña aparte</U.Btn>
        </a>
      </div>
      <iframe src="Mapa de Proceso.html" title="Mapa de proceso DTD"
        style={{ flex: 1, width: '100%', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)' }} />
    </div>
  );
}
window.ModuleMapaProceso = ModuleMapaProceso;
