/* global React */
/* ── DTD ERP · Audit Log con Drill-Down (v1.1) ──────────────── */

// ── Mock log enriquecido con payloads completos ───────────────
// TODO al consolidar: mover a erp/data.jsx · AUDIT_LOG
const AUDIT_ENTRIES = [
  {
    id: 'AL-2026-4421', ts: '2026-05-24 09:56', timeRel: 'hace 4 min',
    actor: { name: 'Martina A.', role: 'Comercial', email: 'martina@dtdcargo.com', initials: 'MA' },
    action: 'edit', entity: 'Cotización', target: 'Q-2026-0421',
    summary: 'Cambió total de $8,400 a $9,200',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'total',          before: 8400,   after: 9200,  type: 'money' },
      { field: 'transport_cost', before: 320,    after: 420,   type: 'money' },
      { field: 'margin',         before: 0.265,  after: 0.298, type: 'pct' },
      { field: 'updated_at',     before: '2026-05-20 14:18', after: '2026-05-24 09:56', type: 'date' },
    ],
    related: [
      { id: 'AL-2026-4395', ts: '2026-05-20 14:18', summary: 'Martina A. creó la cotización' },
      { id: 'AL-2026-4318', ts: '2026-05-18 11:02', summary: 'Carlos V. asignó Martina como owner' },
    ],
  },
  {
    id: 'AL-2026-4420', ts: '2026-05-24 09:42', timeRel: 'hace 18 min',
    actor: { name: 'Carlos V.', role: 'Admin', email: 'carlos@dtdcargo.com', initials: 'CV' },
    action: 'create', entity: 'Cliente', target: 'DTD-5475',
    summary: 'Creó cliente: Mendoza & Cía CA',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'markbox',  before: null, after: 'DTD-5475',         type: 'text' },
      { field: 'company',  before: null, after: 'Mendoza & Cía CA',  type: 'text' },
      { field: 'rif',      before: null, after: 'J-31884201-7',      type: 'text' },
      { field: 'segment',  before: null, after: 'Comercial',         type: 'text' },
      { field: 'city',     before: null, after: 'Valencia',          type: 'text' },
      { field: 'status',   before: null, after: 'active',            type: 'text' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4419', ts: '2026-05-24 09:00', timeRel: 'hace 1 h',
    actor: { name: 'Yusneidy P.', role: 'Operaciones', email: 'yusneidy@dtdcargo.com', initials: 'YP' },
    action: 'edit', entity: 'Embarque', target: 'DTDU-419032',
    summary: 'Estado: aduana VE → liberado',
    ip: '190.124.40.182', city: 'Maracaibo, VE', browser: 'Edge 124 · Windows',
    diff: [
      { field: 'status',     before: 'aduana_ve',  after: 'liberado',  type: 'text' },
      { field: 'cleared_at', before: null,         after: '2026-05-24 09:00', type: 'date' },
      { field: 'duty_paid',  before: 4820,         after: 4820,        type: 'money', unchanged: true },
    ],
    related: [
      { id: 'AL-2026-4382', ts: '2026-05-22 14:22', summary: 'Yoel C. presentó DUA-VE-2026-088421' },
      { id: 'AL-2026-4361', ts: '2026-05-22 09:48', summary: 'Sistema: arribo a MAR confirmado' },
    ],
  },
  {
    id: 'AL-2026-4418', ts: '2026-05-24 08:02', timeRel: 'hace 2 h',
    actor: { name: 'Andrés B.', role: 'Contabilidad', email: 'andres@dtdcargo.com', initials: 'AB' },
    action: 'create', entity: 'Factura', target: 'F-2026-0445',
    summary: 'Emitida por $54,300',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'id',        before: null, after: 'F-2026-0445',  type: 'text' },
      { field: 'client',    before: null, after: 'DTD-5418',      type: 'text' },
      { field: 'amount',    before: null, after: 54300,           type: 'money' },
      { field: 'currency',  before: null, after: 'USD',           type: 'text' },
      { field: 'due',       before: null, after: '2026-06-23',    type: 'date' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4417', ts: '2026-05-24 07:00', timeRel: 'hace 3 h',
    actor: { name: 'Carlos V.', role: 'Admin', email: 'carlos@dtdcargo.com', initials: 'CV' },
    action: 'login', entity: 'Sesión', target: '—',
    summary: 'Login exitoso · IP 190.142.x.x · Caracas',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [],
    related: [],
  },
  {
    id: 'AL-2026-4416', ts: '2026-05-24 06:02', timeRel: 'hace 4 h',
    actor: { name: 'Diego N.', role: 'Comercial', email: 'diego@dtdcargo.com', initials: 'DN' },
    action: 'edit', entity: 'Lead', target: 'L-0140',
    summary: 'Movió de "nuevo" a "demo"',
    ip: '186.94.40.118', city: 'Valencia, VE', browser: 'Chrome 124 · Windows',
    diff: [
      { field: 'stage',         before: 'nuevo', after: 'demo', type: 'text' },
      { field: 'demo_scheduled', before: null,    after: '2026-05-27 10:00', type: 'date' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4415', ts: '2026-05-24 05:00', timeRel: 'hace 5 h',
    actor: { name: 'Carlos V.', role: 'Admin', email: 'carlos@dtdcargo.com', initials: 'CV' },
    action: 'config', entity: 'Sistema', target: 'Mailing',
    summary: 'Activó proveedor Gmail Workspace',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'mail_provider', before: 'sendgrid',          after: 'gmail-workspace', type: 'text' },
      { field: 'mail_from',     before: 'no-reply@dtdcargo.com', after: 'hola@dtdcargo.com', type: 'text' },
      { field: 'mail_quota',    before: 10000,                after: 50000,             type: 'number' },
    ],
    related: [],
    sensitive: true,
  },
  {
    id: 'AL-2026-4414', ts: '2026-05-24 02:00', timeRel: 'hace 8 h',
    actor: { name: 'Wang H.', role: 'Almacén CN', email: 'wang@dtdcargo.cn', initials: 'WH' },
    action: 'create', entity: 'Recepción', target: 'CN-2026-2842',
    summary: 'Recibió 18 cajas en YIW-A1',
    ip: '120.241.18.55', city: 'Yiwu, CN', browser: 'WeChat Browser · Android',
    diff: [
      { field: 'boxes',     before: null, after: 18,      type: 'number' },
      { field: 'location',  before: null, after: 'YIW-A1', type: 'text' },
      { field: 'supplier',  before: null, after: 'Yiwu Trading Hub Co.', type: 'text' },
      { field: 'client',    before: null, after: 'DTD-7842', type: 'text' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4413', ts: '2026-05-23 17:42', timeRel: 'ayer 17:42',
    actor: { name: 'Martina A.', role: 'Comercial', email: 'martina@dtdcargo.com', initials: 'MA' },
    action: 'delete', entity: 'Cotización', target: 'Q-2026-0410',
    summary: 'Eliminó borrador',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'status', before: 'draft', after: 'deleted', type: 'text' },
    ],
    related: [],
    sensitive: true,
  },
  {
    id: 'AL-2026-4412', ts: '2026-05-23 16:18', timeRel: 'ayer 16:18',
    actor: { name: 'Carlos V.', role: 'Admin', email: 'carlos@dtdcargo.com', initials: 'CV' },
    action: 'config', entity: 'Usuario', target: 'u-008',
    summary: 'Invitó: Carolina Méndez (Soporte)',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'name',  before: null, after: 'Carolina Méndez', type: 'text' },
      { field: 'role',  before: null, after: 'Soporte',          type: 'text' },
      { field: 'email', before: null, after: 'c.mendez@dtdcargo.com', type: 'text' },
    ],
    related: [],
  },
  {
    id: 'AL-2026-4411', ts: '2026-05-23 14:05', timeRel: 'ayer 14:05',
    actor: { name: 'Andrés B.', role: 'Contabilidad', email: 'andres@dtdcargo.com', initials: 'AB' },
    action: 'edit', entity: 'Factura', target: 'F-2026-0391',
    summary: 'Registró pago $156,800 · saldo 0',
    ip: '190.142.88.214', city: 'Caracas, VE', browser: 'Chrome 124 · macOS',
    diff: [
      { field: 'paid',    before: 0,        after: 156800, type: 'money' },
      { field: 'balance', before: 156800,   after: 0,      type: 'money' },
      { field: 'status',  before: 'vencida', after: 'pagada', type: 'text' },
      { field: 'paid_at', before: null,     after: '2026-05-23 14:05', type: 'date' },
    ],
    related: [
      { id: 'AL-2026-4282', ts: '2026-05-14 10:00', summary: 'Andrés B. emitió F-2026-0391' },
    ],
  },
  {
    id: 'AL-2026-4410', ts: '2026-05-23 11:30', timeRel: 'ayer 11:30',
    actor: { name: 'Sistema', role: 'Cron', email: '—', initials: 'SY', system: true },
    action: 'auto', entity: 'Backup', target: 'S3 · diario',
    summary: 'Backup completo a S3 · 4.2GB',
    ip: '10.0.0.1', city: 'Servidor', browser: '—',
    diff: [
      { field: 'size_gb',   before: 4.1,  after: 4.2, type: 'number' },
      { field: 'duration_s', before: null, after: 142, type: 'number' },
    ],
    related: [],
  },
];

const ACTION_MAP = {
  create: { tone: 'success', label: 'CREÓ',   verb: 'creó' },
  edit:   { tone: 'info',    label: 'EDITÓ',  verb: 'editó' },
  delete: { tone: 'danger',  label: 'BORRÓ',  verb: 'eliminó' },
  login:  { tone: 'neutral', label: 'LOGIN',  verb: 'inició sesión' },
  config: { tone: 'wine',    label: 'CONFIG', verb: 'cambió config en' },
  auto:   { tone: 'neutral', label: 'AUTO',   verb: 'ejecutó' },
};

function fmtVal(v, type) {
  if (v === null || v === undefined) return '—';
  if (type === 'money')  return `$${Number(v).toLocaleString('es-VE')}`;
  if (type === 'pct')    return `${(Number(v) * 100).toFixed(1)}%`;
  if (type === 'number') return Number(v).toLocaleString('es-VE');
  return String(v);
}

// ════════════════════════════════════════════════════════════════
function ModuleAuditLog({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [search, setSearch] = React.useState('');
  const [actionFilter, setActionFilter] = React.useState('all');
  const [userFilter, setUserFilter] = React.useState('all');
  const [selectedId, setSelectedId] = React.useState(null);

  const users = [...new Set(AUDIT_ENTRIES.map(e => e.actor.name))];

  const filtered = AUDIT_ENTRIES.filter(e => {
    if (actionFilter !== 'all' && e.action !== actionFilter) return false;
    if (userFilter !== 'all' && e.actor.name !== userFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.actor.name.toLowerCase().includes(q) &&
          !e.target.toLowerCase().includes(q) &&
          !e.summary.toLowerCase().includes(q) &&
          !e.entity.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selected = selectedId ? AUDIT_ENTRIES.find(e => e.id === selectedId) : null;

  // KPIs
  const today = AUDIT_ENTRIES.filter(e => e.ts.startsWith('2026-05-24')).length;
  const sensitiveCount = AUDIT_ENTRIES.filter(e => e.sensitive).length;
  const uniqueActors = new Set(AUDIT_ENTRIES.map(e => e.actor.name)).size;

  return (
    <div>
      <U.PageHeader
        eyebrow="COMPLIANCE · 24 MAY 2026"
        title="Audit log"
        subtitle="Cada acción del equipo queda registrada con quién, qué, cuándo y desde dónde. Click en cualquier entrada para ver el detalle completo y el diff de campos."
        actions={
          <>
            <U.Btn variant="secondary" icon={I.download(14)}>Exportar CSV</U.Btn>
            <U.Btn variant="secondary">Configurar retención</U.Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Eventos hoy"          value={today}                  delta={`${AUDIT_ENTRIES.length} totales · 30d`} tone="wine"    icon={I.eye(18)} />
        <U.KPI label="Actores únicos"       value={uniqueActors}            delta="7 humanos · 1 sistema"                  tone="info"    icon={I.users(18)} />
        <U.KPI label="Acciones sensibles"   value={sensitiveCount}          delta="DELETE + CONFIG · 30d"                    tone={sensitiveCount > 0 ? 'warning' : 'success'} icon={I.shield(18)} />
        <U.KPI label="Retención"            value="180d"                    delta="política compliance"                      tone="neutral" icon={I.doc(18)} />
      </div>

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por usuario, target, entidad o detalle…"
        filters={
          <>
            <U.Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ width: 170 }} options={[
              { value: 'all',    label: 'Todas las acciones' },
              { value: 'create', label: 'Crear' },
              { value: 'edit',   label: 'Editar' },
              { value: 'delete', label: 'Borrar' },
              { value: 'config', label: 'Config' },
              { value: 'login',  label: 'Login' },
              { value: 'auto',   label: 'Sistema · auto' },
            ]} />
            <U.Select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={{ width: 170 }} options={[
              { value: 'all', label: 'Todos los usuarios' },
              ...users.map(u => ({ value: u, label: u })),
            ]} />
          </>
        }
      />

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '90px 90px 160px 1fr 130px 24px',
          padding: '10px 18px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
        }}>
          {['Cuando', 'Acción', 'Usuario', 'Target & detalle', 'Origen', ''].map(h => (
            <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {filtered.map((e, i) => {
          const m = ACTION_MAP[e.action];
          return (
            <div key={e.id}
              onClick={() => setSelectedId(e.id)}
              style={{
                display: 'grid', gridTemplateColumns: '90px 90px 160px 1fr 130px 24px',
                padding: '12px 18px', gap: 14, alignItems: 'center',
                borderTop: i > 0 ? '1px solid var(--border)' : 0,
                cursor: 'pointer',
                background: selectedId === e.id ? 'var(--wine-tint)' : 'transparent',
                transition: 'background var(--dur-fast) var(--ease)',
              }}
              onMouseEnter={(ev) => { if (selectedId !== e.id) ev.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(ev) => { if (selectedId !== e.id) ev.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-mute)' }}>{e.timeRel}</span>
              <U.Badge tone={m.tone} size="sm">{m.label}</U.Badge>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <U.Avatar initials={e.actor.initials} size={24} color={e.actor.system ? 'neutral' : 'wine'} />
                <div>
                  <div style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{e.actor.name}</div>
                  <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{e.actor.role}</div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{e.entity}</span>
                  <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{e.target}</code>
                  {e.sensitive && <U.Badge tone="warning" size="sm">SENSIBLE</U.Badge>}
                </div>
                <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{e.summary}</div>
              </div>
              <div>
                <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{e.ip}</div>
                <div style={{ font: '500 10px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{e.city}</div>
              </div>
              <span style={{ color: 'var(--ink-mute)', display: 'flex', justifyContent: 'flex-end' }}>{I.chevR(13)}</span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
            Sin entradas con esos filtros.
          </div>
        )}
      </U.Card>

      <AuditDrillDown
        entry={selected}
        onClose={() => setSelectedId(null)}
        onSelectRelated={(id) => setSelectedId(id)}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Drill-down drawer
// ════════════════════════════════════════════════════════════════
function AuditDrillDown({ entry, onClose, onSelectRelated }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [tab, setTab] = React.useState('overview');
  React.useEffect(() => { setTab('overview'); }, [entry?.id]);

  if (!entry) return null;
  const m = ACTION_MAP[entry.action];

  return (
    <U.Drawer
      open={!!entry}
      onClose={onClose}
      title={`${entry.entity} · ${entry.target}`}
      subtitle={
        <>
          <U.Badge tone={m.tone} size="sm" style={{ marginRight: 8 }}>{m.label}</U.Badge>
          {entry.actor.name} {m.verb} este registro · {entry.timeRel}
        </>
      }
      width={720}
      actions={
        <>
          <U.Btn variant="ghost">Ver registro original</U.Btn>
          <U.Btn variant="secondary" icon={I.download(13)}>Exportar JSON</U.Btn>
          <U.Btn variant="primary" onClick={onClose}>Cerrar</U.Btn>
        </>
      }
    >
      <U.Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Resumen' },
          { value: 'diff',     label: 'Diff de campos', count: entry.diff?.length || 0 },
          { value: 'actor',    label: 'Actor & origen' },
          { value: 'related',  label: 'Relacionados', count: entry.related?.length || 0 },
          { value: 'raw',      label: 'JSON' },
        ]}
        style={{ marginBottom: 20 }}
      />

      {tab === 'overview' && <DrillOverview entry={entry} />}
      {tab === 'diff'     && <DrillDiff entry={entry} />}
      {tab === 'actor'    && <DrillActor entry={entry} />}
      {tab === 'related'  && <DrillRelated entry={entry} onSelectRelated={onSelectRelated} />}
      {tab === 'raw'      && <DrillRaw entry={entry} />}
    </U.Drawer>
  );
}

// ── Overview tab ─────────────────────────────────────────────
function DrillOverview({ entry }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const m = ACTION_MAP[entry.action];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Headline */}
      <div style={{
        padding: '16px 18px',
        background: `var(--${m.tone}-bg)`,
        borderLeft: `4px solid var(--${m.tone})`,
        borderRadius: 'var(--r-md)',
      }}>
        <div style={{ font: '700 11px/1 var(--f-sans)', color: `var(--${m.tone})`, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          {entry.entity.toUpperCase()} · {m.label}
        </div>
        <div style={{ font: '900 17px/1.3 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {entry.summary}
        </div>
        {entry.sensitive && (
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 11px/1 var(--f-sans)', color: 'var(--warning)' }}>
            <span>{I.shield(13)}</span> Acción sensible · requiere review de compliance
          </div>
        )}
      </div>

      {/* Quick fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <U.Field label="Evento ID"    value={entry.id} mono />
        <U.Field label="Timestamp"     value={entry.ts} mono />
        <U.Field label="Entidad"       value={entry.entity} />
        <U.Field label="Target"        value={entry.target} mono />
        <U.Field label="Actor"         value={`${entry.actor.name} · ${entry.actor.role}`} />
        <U.Field label="Acción"        value={m.label} />
      </div>

      {/* Pre/Post snapshot summary */}
      {entry.diff?.length > 0 && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>RESUMEN DEL CAMBIO · {entry.diff.length} CAMPOS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {entry.diff.map((d, i) => (
              <U.Badge key={i} tone={d.unchanged ? 'neutral' : 'info'} size="sm">{d.field}</U.Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Diff tab ─────────────────────────────────────────────────
function DrillDiff({ entry }) {
  const U = window.ERPUI;
  if (!entry.diff || entry.diff.length === 0) {
    return <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)', padding: '12px 0' }}>Esta acción no modificó campos (login / consulta / sin diff).</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '180px 1fr 24px 1fr',
        gap: 12, padding: '10px 14px',
        background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
        font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)',
        letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        <span>Campo</span>
        <span>Antes</span>
        <span></span>
        <span>Después</span>
      </div>
      {entry.diff.map((d, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '180px 1fr 24px 1fr',
          gap: 12, padding: '12px 14px',
          background: d.unchanged ? 'transparent' : 'var(--bg-surface)',
          border: `1px solid ${d.unchanged ? 'var(--border)' : 'var(--border)'}`,
          borderRadius: 'var(--r-md)',
          opacity: d.unchanged ? 0.55 : 1,
          alignItems: 'center',
        }}>
          <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{d.field}</code>
          <div style={{
            padding: '6px 10px',
            background: d.unchanged ? 'transparent' : 'var(--danger-bg)',
            borderRadius: 'var(--r-sm)',
            font: '600 12.5px/1.3 var(--f-mono)',
            color: d.before === null ? 'var(--ink-mute)' : 'var(--ink)',
            textDecoration: d.unchanged ? 'none' : 'line-through',
            textDecorationColor: 'var(--danger)',
          }}>{fmtVal(d.before, d.type)}</div>
          <span style={{ color: 'var(--ink-mute)', textAlign: 'center' }}>→</span>
          <div style={{
            padding: '6px 10px',
            background: d.unchanged ? 'transparent' : 'var(--success-bg)',
            borderRadius: 'var(--r-sm)',
            font: '600 12.5px/1.3 var(--f-mono)',
            color: 'var(--ink)',
          }}>{fmtVal(d.after, d.type)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Actor tab ────────────────────────────────────────────────
function DrillActor({ entry }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <U.Card padded>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <U.Avatar initials={entry.actor.initials} size={56} color={entry.actor.system ? 'neutral' : 'wine'} />
          <div style={{ flex: 1 }}>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)' }}>{entry.actor.name}</div>
            <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{entry.actor.role}</div>
            <code style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 6, display: 'inline-block' }}>{entry.actor.email}</code>
          </div>
        </div>
      </U.Card>

      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>ORIGEN DE LA ACCIÓN</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <U.Field label="IP"           value={entry.ip} mono />
          <U.Field label="Ubicación"     value={entry.city} />
          <U.Field label="Navegador / SO" value={entry.browser} />
          <U.Field label="Timestamp"     value={entry.ts} mono />
        </div>
      </U.Card>

      {/* Mini map placeholder */}
      <U.Card padded style={{ background: 'var(--bg-sidebar)', color: '#fff', border: 0, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--wine-soft)' }}>{I.radar(20)}</span>
          <div>
            <div style={{ font: '700 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>UBICACIÓN APROX.</div>
            <div style={{ font: '900 16px/1 var(--f-display)' }}>{entry.city}</div>
            <code style={{ font: '500 11px/1 var(--f-mono)', color: 'rgba(255,255,255,0.6)', marginTop: 4, display: 'inline-block' }}>{entry.ip}</code>
          </div>
        </div>
      </U.Card>
    </div>
  );
}

// ── Related tab ──────────────────────────────────────────────
function DrillRelated({ entry, onSelectRelated }) {
  const U = window.ERPUI;
  const I = window.Icon;
  if (!entry.related || entry.related.length === 0) {
    return <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin eventos relacionados al mismo target.</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>HISTORIAL DE ESTE TARGET · {entry.target}</div>
      {entry.related.map((r, i) => (
        <button key={r.id} onClick={() => onSelectRelated(r.id)} style={{
          display: 'grid', gridTemplateColumns: 'auto 1fr auto',
          gap: 12, padding: '12px 14px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', textAlign: 'left', alignItems: 'center',
          transition: 'border-color var(--dur-fast) var(--ease)',
        }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.id}</code>
          <div>
            <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{r.summary}</div>
            <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>{r.ts}</div>
          </div>
          <span style={{ color: 'var(--ink-mute)' }}>{I.chevR(13)}</span>
        </button>
      ))}
    </div>
  );
}

// ── Raw JSON tab ─────────────────────────────────────────────
function DrillRaw({ entry }) {
  const json = JSON.stringify({
    id: entry.id, ts: entry.ts,
    actor: entry.actor,
    action: entry.action, entity: entry.entity, target: entry.target,
    summary: entry.summary,
    diff: entry.diff,
    origin: { ip: entry.ip, city: entry.city, browser: entry.browser },
    related: entry.related,
    sensitive: !!entry.sensitive,
  }, null, 2);
  return (
    <pre style={{
      margin: 0, padding: '16px 18px',
      background: 'var(--bg-sidebar)', color: '#fff',
      borderRadius: 'var(--r-md)',
      font: '500 11.5px/1.6 var(--f-mono)',
      maxHeight: 480, overflow: 'auto',
      whiteSpace: 'pre',
    }}>{json}</pre>
  );
}

window.ModuleAuditLog = ModuleAuditLog;
