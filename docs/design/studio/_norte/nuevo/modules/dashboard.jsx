/* global React */
/* ── DTD ERP · Dashboard v1.1 (con Editor) ──────────────────── */
/* Reemplaza window.ModuleDashboard del v1.0. Agrega:           */
/*   · Configurador en drawer (KPIs + widgets + período)        */
/*   · Drag-to-reorder de KPIs                                  */
/*   · Persistencia en localStorage (dtd_dashboard_config_v1)   */
/*   · Reset a defaults                                         */

const DTD_DB_LS_KEY = 'dtd_dashboard_config_v1';

// ── Catálogo de KPIs disponibles ──────────────────────────────
// Cada KPI mapea a un valor en window.ERPData.KPIS o se calcula.
const KPI_CATALOG = [
  // Operación
  { id: 'shipmentsActive', label: 'Embarques activos', icon: 'box',       tone: 'wine',    cat: 'Operación' },
  { id: 'onTime',          label: 'On-time delivery',  icon: 'check',     tone: 'success', cat: 'Operación' },
  { id: 'cbmInTransit',    label: 'CBM en tránsito',   icon: 'ship',      tone: 'neutral', cat: 'Operación' },
  { id: 'avgTransit',      label: 'Tránsito promedio', icon: 'truck',     tone: 'info',    cat: 'Operación' },
  { id: 'openIncidents',   label: 'Incidencias abiertas', icon: 'warn',   tone: 'warning', cat: 'Operación' },
  { id: 'cnStock',         label: 'Bultos en Almacén CN', icon: 'warehouse', tone: 'neutral', cat: 'Operación' },
  // Finanzas
  { id: 'monthRevenue',    label: 'Ingresos mes',      icon: 'chart',     tone: 'success', cat: 'Finanzas' },
  { id: 'invoicesDue',     label: 'Facturas vencidas', icon: 'invoice',   tone: 'warning', cat: 'Finanzas' },
  { id: 'marginYTD',       label: 'Margen YTD',        icon: 'chart',     tone: 'wine',    cat: 'Finanzas' },
  { id: 'pendingCollect',  label: 'Por cobrar',        icon: 'invoice',   tone: 'info',    cat: 'Finanzas' },
  // Comercial
  { id: 'newLeads',        label: 'Leads nuevos',      icon: 'spark',     tone: 'info',    cat: 'Comercial' },
  { id: 'wonQuotes',       label: 'Cotizaciones ganadas (mes)', icon: 'check', tone: 'success', cat: 'Comercial' },
  { id: 'activeClients',   label: 'Clientes activos',  icon: 'users',     tone: 'neutral', cat: 'Comercial' },
  { id: 'avgTicket',       label: 'Ticket promedio',   icon: 'tag',       tone: 'wine',    cat: 'Comercial' },
];

// Valores extra que no están en ERPData.KPIS — inlined acá.
// TODO: al consolidar a v1.0 mover a erp/data.jsx KPIS.
const EXTRA_KPI_VALUES = {
  avgTransit:     { value: '38d',   delta: '↓ 2d vs Q1',     tone: 'info' },
  openIncidents:  { value: 3,       delta: '1 crítica',      tone: 'warning' },
  cnStock:        { value: 1284,    delta: 'bultos',         tone: 'neutral' },
  marginYTD:      { value: '24.6%', delta: '+1.8 pp',        tone: 'wine' },
  pendingCollect: { value: '$162K', delta: '4 fac. vencidas',tone: 'info' },
  wonQuotes:     { value: 11,       delta: '67% win rate',   tone: 'success' },
  activeClients: { value: 47,       delta: '+4 este mes',    tone: 'neutral' },
  avgTicket:     { value: '$24.8K', delta: '+$1.2K vs mes ant.', tone: 'wine' },
};

// ── Catálogo de widgets de las columnas ───────────────────────
const WIDGET_CATALOG = [
  { id: 'chart',           label: 'Volumen embarcado · gráfico', side: 'left',  desc: 'Barras de CBM por mes' },
  { id: 'activeShipments', label: 'Embarques en curso',          side: 'left',  desc: 'Tabla preview ordenada por ETA' },
  { id: 'alerts',          label: 'Atención requerida',          side: 'right', desc: 'ETA en riesgo, facturas vencidas, etc.' },
  { id: 'recentActivity',  label: 'Actividad reciente',          side: 'right', desc: 'Últimas notificaciones' },
  { id: 'quickActions',    label: 'Acciones rápidas',            side: 'right', desc: 'Crear cotización, cliente, recepción…' },
  { id: 'tmsStatus',       label: 'Estado de flota (TMS)',       side: 'right', desc: 'Camiones disponibles vs en ruta' },
  { id: 'upcomingEta',     label: 'Próximos ETA',                side: 'right', desc: 'Embarques que llegan esta semana' },
];

// ── Config por defecto ────────────────────────────────────────
const DEFAULT_CONFIG = {
  kpis: ['shipmentsActive', 'onTime', 'monthRevenue', 'newLeads', 'invoicesDue', 'cbmInTransit'],
  widgets: ['chart', 'activeShipments', 'alerts', 'recentActivity', 'quickActions'],
  chartPeriod: '1A',
};

// ── Hook de persistencia ──────────────────────────────────────
function useDashboardConfig() {
  const [config, setConfig] = React.useState(() => {
    try {
      const raw = localStorage.getItem(DTD_DB_LS_KEY);
      if (!raw) return DEFAULT_CONFIG;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) { return DEFAULT_CONFIG; }
  });
  const update = React.useCallback((patch) => {
    setConfig(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      try { localStorage.setItem(DTD_DB_LS_KEY, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  }, []);
  const reset = React.useCallback(() => {
    try { localStorage.removeItem(DTD_DB_LS_KEY); } catch (e) {}
    setConfig(DEFAULT_CONFIG);
  }, []);
  return [config, update, reset];
}

// ── Resolver valor de KPI por id ──────────────────────────────
function resolveKpiValue(id) {
  const D = window.ERPData;
  if (D.KPIS && D.KPIS[id]) return D.KPIS[id];
  if (EXTRA_KPI_VALUES[id]) return EXTRA_KPI_VALUES[id];
  return { value: '—', delta: '', tone: 'neutral' };
}

// ── Dashboard principal ───────────────────────────────────────
function ModuleDashboard({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const [config, updateConfig, resetConfig] = useDashboardConfig();
  const hideValues = window.ERPUI.useHideValues();
  const setHideValues = (v) => window.ERPUI.setHideValues(typeof v === 'function' ? v(hideValues) : v);
  const [editorOpen, setEditorOpen] = React.useState(false);

  const mask = (v) => hideValues ? '•••••' : v;
  const activeShipments = D.SHIPMENTS.filter(s => !['entregado', 'cotizado'].includes(s.status));

  const visibleKpis = config.kpis
    .map(id => ({ meta: KPI_CATALOG.find(k => k.id === id), data: resolveKpiValue(id) }))
    .filter(x => x.meta);

  const leftWidgets  = config.widgets.filter(w => WIDGET_CATALOG.find(c => c.id === w && c.side === 'left'));
  const rightWidgets = config.widgets.filter(w => WIDGET_CATALOG.find(c => c.id === w && c.side === 'right'));
  const hasLeft = leftWidgets.length > 0;
  const hasRight = rightWidgets.length > 0;

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
            }}>{I.eye(15)}</button>
            <U.Btn variant="secondary" icon={I.edit(13)} onClick={() => setEditorOpen(true)}>Configurar</U.Btn>
            <U.Btn variant="secondary" icon={I.download(14)}>Exportar</U.Btn>
            <U.Btn variant="primary" icon={I.plus(14)} onClick={() => goTo('quotes', null, 'create')}>Nueva cotización</U.Btn>
          </>
        }
      />

      {/* KPI grid (configurable) */}
      {visibleKpis.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-6)' }}>
          {visibleKpis.map(({ meta, data }) => (
            <U.KPI
              key={meta.id}
              label={meta.label}
              value={mask(data.value)}
              delta={hideValues ? '••••' : (data.delta?.startsWith('↑') || data.delta?.startsWith('↓') ? data.delta : (data.delta?.startsWith('+') || data.delta?.startsWith('-') ? `↑ ${data.delta} vs sem ant.` : data.delta))}
              tone={data.tone || meta.tone}
              icon={I[meta.icon]?.(18)}
            />
          ))}
        </div>
      ) : (
        <div style={{ marginBottom: 'var(--s-6)' }}>
          <U.EmptyState
            icon={I.dashboard(24)}
            title="No tenés KPIs visibles"
            body="Activá al menos uno desde Configurar dashboard."
            action={<U.Btn variant="primary" icon={I.edit(13)} onClick={() => setEditorOpen(true)}>Configurar dashboard</U.Btn>}
          />
        </div>
      )}

      {/* Two-column grid de widgets */}
      {(hasLeft || hasRight) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: hasLeft && hasRight ? '2fr 1fr' : '1fr',
          gap: 16,
        }}>
          {hasLeft && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {leftWidgets.map(id => <Widget key={id} id={id} goTo={goTo} config={config} updateConfig={updateConfig} hideValues={hideValues} />)}
            </div>
          )}
          {hasRight && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {rightWidgets.map(id => <Widget key={id} id={id} goTo={goTo} config={config} updateConfig={updateConfig} hideValues={hideValues} />)}
            </div>
          )}
        </div>
      )}

      <DashboardEditorDrawer
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        config={config}
        updateConfig={updateConfig}
        resetConfig={resetConfig}
      />
    </div>
  );
}

// ── Widget switcher ───────────────────────────────────────────
function Widget({ id, goTo, config, updateConfig, hideValues }) {
  if (id === 'chart')           return <ChartWidget config={config} updateConfig={updateConfig} />;
  if (id === 'activeShipments') return <ActiveShipmentsWidget goTo={goTo} hideValues={hideValues} />;
  if (id === 'alerts')          return <AlertsWidget />;
  if (id === 'recentActivity')  return <RecentActivityWidget goTo={goTo} />;
  if (id === 'quickActions')    return <QuickActionsWidget goTo={goTo} />;
  if (id === 'tmsStatus')       return <TMSStatusWidget goTo={goTo} />;
  if (id === 'upcomingEta')     return <UpcomingEtaWidget goTo={goTo} />;
  return null;
}

// ── Widgets individuales ──────────────────────────────────────
function ChartWidget({ config, updateConfig }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div className="eyebrow eyebrow-wine">ÚLTIMOS 12 MESES</div>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 6 }}>Volumen embarcado · CBM</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['1M', '3M', '1A', 'YTD'].map(p => (
            <button key={p}
              onClick={() => updateConfig({ chartPeriod: p })}
              style={{
                padding: '5px 9px', borderRadius: 'var(--r-sm)',
                background: p === config.chartPeriod ? 'var(--wine-tint)' : 'transparent',
                color: p === config.chartPeriod ? 'var(--wine)' : 'var(--ink-soft)',
                font: '600 11.5px/1 var(--f-sans)',
              }}>{p}</button>
          ))}
        </div>
      </div>
      <BarChart period={config.chartPeriod} />
    </U.Card>
  );
}

function ActiveShipmentsWidget({ goTo, hideValues }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const activeShipments = D.SHIPMENTS.filter(s => !['entregado', 'cotizado'].includes(s.status));
  const mask = (v) => hideValues ? '•••' : v;
  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Embarques en curso</div>
          <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{activeShipments.length} activos · ordenados por ETA</div>
        </div>
        <button onClick={() => goTo('shipments')} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Ver todos {I.arrowR(11)}
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
            <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>${mask((s.value/1000).toFixed(0))}K</div>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

function AlertsWidget() {
  const U = window.ERPUI;
  const I = window.Icon;
  const alerts = [
    { icon: I.warn(14),    tone: 'warning', t: 'ETA en riesgo · DTDU-419032', m: '+2 días estimados · Polar' },
    { icon: I.invoice(14), tone: 'danger',  t: 'F-2026-0418 vencida hace 10d', m: 'Acindar · $84.200' },
    { icon: I.doc(14),     tone: 'info',    t: '2 documentos pendientes de firma', m: 'Tech Solutions · BL + Factura' },
    { icon: I.users(14),   tone: 'wine',    t: '3 leads sin asignar', m: 'Recibidos hoy del cotizador' },
  ];
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>ATENCIÓN REQUERIDA</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {alerts.map((a, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 12px', background: `var(--${a.tone}-bg)`,
            borderRadius: 'var(--r-md)', borderLeft: `3px solid var(--${a.tone})`,
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
  );
}

function RecentActivityWidget({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const typeToMod = { tracking: 'tracking', sales: 'quotes', finance: 'invoices', alert: 'tracking', crm: 'leads', warehouse: 'cn' };
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>ACTIVIDAD RECIENTE</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {D.NOTIFS.map(n => {
          const target = typeToMod[n.type];
          return (
            <button key={n.id}
              onClick={() => target && goTo && goTo(target)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '4px 6px', margin: '-4px -6px',
                borderRadius: 'var(--r-sm)',
                cursor: target ? 'pointer' : 'default',
                textAlign: 'left',
                background: 'transparent',
                transition: 'background var(--dur) var(--ease)',
              }}
              onMouseEnter={(e) => { if (target) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                background: n.tone === 'wine' ? 'var(--wine)' : n.tone === 'success' ? 'var(--success)' : n.tone === 'warning' ? 'var(--warning)' : 'var(--info)',
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{n.t}</div>
                <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{n.m}</div>
              </div>
            </button>
          );
        })}
      </div>
    </U.Card>
  );
}

function QuickActionsWidget({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const items = [
    { l: 'Nueva cotización', i: 'calc',      to: 'quotes' },
    { l: 'Nuevo cliente',    i: 'users',     to: 'clients' },
    { l: 'Recepción CN',     i: 'warehouse', to: 'cn' },
    { l: 'Crear factura',    i: 'invoice',   to: 'invoices' },
  ];
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>ACCIONES RÁPIDAS</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {items.map(a => (
          <button key={a.l}
            onClick={() => goTo(a.to, null, 'create')}
            style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '12px 14px', borderRadius: 'var(--r-md)',
              background: 'var(--bg-elevated)', textAlign: 'left',
              transition: 'background var(--dur-fast) var(--ease)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-tint)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          >
            <span style={{ color: 'var(--wine)' }}>{I[a.i](16)}</span>
            <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{a.l}</span>
          </button>
        ))}
      </div>
    </U.Card>
  );
}

function TMSStatusWidget({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const trucks = D.TRUCKS || [];
  const enRuta  = trucks.filter(t => t.status === 'en-ruta').length;
  const dispon  = trucks.filter(t => t.status === 'disponible').length;
  const taller  = trucks.filter(t => t.status === 'taller').length;
  const total   = trucks.length || 1;
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="eyebrow eyebrow-wine">FLOTA · TMS</div>
        <button onClick={() => goTo('tms')} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Ir a TMS {I.arrowR(10)}
        </button>
      </div>
      <div style={{ display: 'flex', height: 8, borderRadius: 'var(--r-pill)', overflow: 'hidden', background: 'var(--bg-elevated)', marginBottom: 12 }}>
        <div style={{ width: `${(enRuta/total)*100}%`,  background: 'var(--wine)' }} />
        <div style={{ width: `${(dispon/total)*100}%`, background: 'var(--success)' }} />
        <div style={{ width: `${(taller/total)*100}%`, background: 'var(--warning)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { l: 'En ruta',     v: enRuta, c: 'var(--wine)' },
          { l: 'Disponibles', v: dispon, c: 'var(--success)' },
          { l: 'En taller',   v: taller, c: 'var(--warning)' },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.c }} />
            <span style={{ flex: 1, font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{r.l}</span>
            <span style={{ font: '800 13px/1 var(--f-display)', color: 'var(--ink)' }}>{r.v}</span>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

function UpcomingEtaWidget({ goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const next = D.SHIPMENTS
    .filter(s => !['entregado', 'cotizado'].includes(s.status) && s.eta)
    .sort((a, b) => (a.eta || '').localeCompare(b.eta || ''))
    .slice(0, 4);
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="eyebrow eyebrow-wine">PRÓXIMOS ETA</div>
        <button onClick={() => goTo('calendar')} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Calendario {I.arrowR(10)}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {next.map(s => (
          <div key={s.id} onClick={() => goTo('shipments', s.id, 'detail')} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
            background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', cursor: 'pointer',
          }}>
            <div style={{ width: 42, textAlign: 'center', flexShrink: 0 }}>
              <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--wine)' }}>{s.eta?.slice(8) || '—'}</div>
              <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 3 }}>
                {['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'][parseInt(s.eta?.slice(5,7)||'1')-1]}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '700 12px/1.2 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</div>
              <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.clientName}</div>
            </div>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

// ── BarChart (igual a v1.0, con período dinámico) ─────────────
function BarChart({ period = '1A' }) {
  const months = ['JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY'];
  const all = [284, 312, 298, 342, 388, 422, 401, 358, 384, 412, 442, 478];
  const slice = period === '1M' ? 1 : period === '3M' ? 3 : period === 'YTD' ? 5 : 12;
  const values = all.slice(-slice);
  const labels = months.slice(-slice);
  const max = Math.max(...values);
  const W = 640, H = 200, pad = 28;
  const bw = (W - pad * 2) / values.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', height: 'auto' }}>
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
              opacity={isLast ? 1 : 0.55} rx="2" />
            {isLast && (
              <text x={x + w/2} y={y - 6} fontFamily="Archivo Black" fontSize="11" fill="var(--wine)" textAnchor="middle" letterSpacing="-0.02em">{v}</text>
            )}
            <text x={x + w/2} y={H + 18} fontFamily="Archivo" fontSize="9.5" fontWeight="600" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="0.08em">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════
// ── Editor de Dashboard (Drawer) ──────────────────────────────
// ════════════════════════════════════════════════════════════════
function DashboardEditorDrawer({ open, onClose, config, updateConfig, resetConfig }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [tab, setTab] = React.useState('kpis');

  const toggleKpi = (id) => {
    updateConfig(prev => ({
      ...prev,
      kpis: prev.kpis.includes(id) ? prev.kpis.filter(k => k !== id) : [...prev.kpis, id],
    }));
  };

  const moveKpi = (fromIdx, toIdx) => {
    updateConfig(prev => {
      const next = [...prev.kpis];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return { ...prev, kpis: next };
    });
  };

  const toggleWidget = (id) => {
    updateConfig(prev => ({
      ...prev,
      widgets: prev.widgets.includes(id) ? prev.widgets.filter(w => w !== id) : [...prev.widgets, id],
    }));
  };

  return (
    <U.Drawer
      open={open}
      onClose={onClose}
      title="Configurar dashboard"
      subtitle={`${config.kpis.length} KPIs · ${config.widgets.length} widgets visibles`}
      width={520}
      actions={
        <>
          <U.Btn variant="ghost" onClick={() => { if (confirm('¿Restaurar configuración por defecto?')) resetConfig(); }}>Restaurar defaults</U.Btn>
          <U.Btn variant="primary" onClick={onClose}>Listo</U.Btn>
        </>
      }
    >
      <U.Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'kpis',    label: 'KPIs',    count: config.kpis.length },
          { value: 'widgets', label: 'Widgets', count: config.widgets.length },
        ]}
        style={{ marginBottom: 20 }}
      />
      {tab === 'kpis'    && <KpiEditor config={config} toggleKpi={toggleKpi} moveKpi={moveKpi} />}
      {tab === 'widgets' && <WidgetEditor config={config} toggleWidget={toggleWidget} />}
    </U.Drawer>
  );
}

// ── Editor de KPIs (con drag) ─────────────────────────────────
function KpiEditor({ config, toggleKpi, moveKpi }) {
  const I = window.Icon;
  const [dragIdx, setDragIdx] = React.useState(null);
  const [overIdx, setOverIdx] = React.useState(null);
  const selectedSet = new Set(config.kpis);
  const available = KPI_CATALOG.filter(k => !selectedSet.has(k.id));
  const byCat = available.reduce((acc, k) => {
    (acc[k.cat] = acc[k.cat] || []).push(k);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Activos / Reordenables */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span className="eyebrow eyebrow-wine">EN EL DASHBOARD · {config.kpis.length}</span>
          <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Arrastrá para reordenar</span>
        </div>
        {config.kpis.length === 0 ? (
          <div style={{
            padding: '20px 16px', textAlign: 'center',
            border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)',
            font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)',
          }}>
            No hay KPIs seleccionados. Agregá alguno desde la lista de abajo.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {config.kpis.map((id, idx) => {
              const meta = KPI_CATALOG.find(k => k.id === id);
              if (!meta) return null;
              const isOver = overIdx === idx && dragIdx !== idx;
              return (
                <div
                  key={id}
                  draggable
                  onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { e.preventDefault(); setOverIdx(idx); }}
                  onDragLeave={() => setOverIdx(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIdx != null && dragIdx !== idx) moveKpi(dragIdx, idx);
                    setDragIdx(null); setOverIdx(null);
                  }}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px',
                    background: isOver ? 'var(--wine-tint)' : 'var(--bg-surface)',
                    border: `1px solid ${isOver ? 'var(--wine)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)',
                    cursor: 'grab',
                    opacity: dragIdx === idx ? 0.4 : 1,
                    transition: 'background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)',
                  }}
                >
                  <span style={{ color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', cursor: 'grab' }} title="Arrastrar">
                    <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
                      <circle cx="3" cy="3" r="1.2" fill="currentColor"/>
                      <circle cx="9" cy="3" r="1.2" fill="currentColor"/>
                      <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
                      <circle cx="9" cy="7" r="1.2" fill="currentColor"/>
                      <circle cx="3" cy="11" r="1.2" fill="currentColor"/>
                      <circle cx="9" cy="11" r="1.2" fill="currentColor"/>
                    </svg>
                  </span>
                  <span style={{
                    width: 28, height: 28, borderRadius: 'var(--r-sm)',
                    background: `var(--${meta.tone}-bg)`, color: `var(--${meta.tone})`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{I[meta.icon]?.(14)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{meta.label}</div>
                    <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{meta.cat}</div>
                  </div>
                  <button onClick={() => toggleKpi(id)} title="Quitar del dashboard" style={{
                    width: 26, height: 26, borderRadius: 'var(--r-sm)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--ink-mute)',
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--danger-bg)'; e.currentTarget.style.color = 'var(--danger)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-mute)'; }}
                  >{I.close(12)}</button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Disponibles agrupados por categoría */}
      {available.length > 0 && (
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span className="eyebrow">DISPONIBLES · {available.length}</span>
            <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {Object.entries(byCat).map(([cat, items]) => (
              <div key={cat}>
                <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>{cat}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {items.map(meta => (
                    <button key={meta.id} onClick={() => toggleKpi(meta.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '8px 12px', borderRadius: 'var(--r-md)',
                      background: 'transparent', textAlign: 'left',
                      transition: 'background var(--dur-fast) var(--ease)',
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{
                        width: 24, height: 24, borderRadius: 'var(--r-sm)',
                        background: `var(--${meta.tone}-bg)`, color: `var(--${meta.tone})`,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>{I[meta.icon]?.(13)}</span>
                      <span style={{ flex: 1, font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{meta.label}</span>
                      <span style={{ color: 'var(--wine)', display: 'inline-flex' }}>{I.plus(13)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Editor de Widgets ─────────────────────────────────────────
function WidgetEditor({ config, toggleWidget }) {
  const I = window.Icon;
  const grouped = { left: [], right: [] };
  WIDGET_CATALOG.forEach(w => grouped[w.side].push(w));

  const Row = ({ w }) => {
    const enabled = config.widgets.includes(w.id);
    return (
      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 14px',
        background: enabled ? 'var(--bg-surface)' : 'transparent',
        border: `1px solid ${enabled ? 'var(--border)' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease)',
      }}>
        <Switch checked={enabled} onChange={() => toggleWidget(w.id)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{w.label}</div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{w.desc}</div>
        </div>
      </label>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <section>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>COLUMNA PRINCIPAL · 2/3</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grouped.left.map(w => <Row key={w.id} w={w} />)}
        </div>
      </section>
      <section>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>COLUMNA LATERAL · 1/3</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grouped.right.map(w => <Row key={w.id} w={w} />)}
        </div>
      </section>
      <div style={{
        padding: '12px 14px', background: 'var(--info-bg)',
        borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--info)',
        font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)',
      }}>
        Si dejás una columna vacía, la otra ocupa todo el ancho automáticamente.
      </div>
    </div>
  );
}

// ── Switch ────────────────────────────────────────────────────
function Switch({ checked, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.preventDefault(); onChange(); }}
      style={{
        width: 34, height: 20, borderRadius: 999,
        background: checked ? 'var(--wine)' : 'var(--border-strong)',
        position: 'relative', flexShrink: 0, marginTop: 1,
        transition: 'background var(--dur-fast) var(--ease)',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? 16 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left var(--dur-fast) var(--ease)',
      }} />
    </button>
  );
}

// ── Override ──────────────────────────────────────────────────
window.ModuleDashboard = ModuleDashboard;
