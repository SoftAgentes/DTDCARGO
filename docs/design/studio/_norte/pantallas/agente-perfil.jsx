/* global React */
/* ── Perfil de Agente Aduanal · standalone ──────────────────── */

// Mirror de los agentes del módulo SENIAT (mismo _seniatData.agents).
const AGENTS_BASE = window.ERPData.CUSTOMS_AGENTS;

// Embarques que aparecen también en el SENIAT module (mismo seed).
const AGENT_SHIPMENTS = [
  { id: 'DTDU-419032', client: 'Industrias Polar',  dua: 'DUA-VE-2026-088421',   port: 'MAR', agent: 'a-003', status: 'liberación',  arrived: '2026-05-22', cleared: null,          totalCost: 4820, agentFee: 380 },
  { id: 'DTDU-472816', client: 'Acindar Comercial', dua: 'DUA-VE-2026-088502',   port: 'PBL', agent: 'a-001', status: 'en revisión', arrived: '2026-05-12', cleared: null,          totalCost: 6240, agentFee: 520 },
  { id: 'DTDU-388157', client: 'Imp. Pereira',       dua: 'DUA-VE-2026-088301',   port: 'LGU', agent: 'a-002', status: 'liberado',    arrived: '2026-04-08', cleared: '2026-04-22',  totalCost: 3180, agentFee: 280 },
  { id: 'DTDU-365044', client: 'Castro Hermanos',    dua: 'DUA-VE-2026-088002',   port: 'PFI', agent: 'a-004', status: 'liberado',    arrived: '2026-04-12', cleared: '2026-05-15',  totalCost: 5410, agentFee: 440 },
  { id: 'DTDU-364299', client: 'Vargas & Asoc',      dua: 'DUA-VE-2026-088421-A', port: 'PBL', agent: 'a-001', status: 'observación', arrived: '2026-05-06', cleared: null,          totalCost: 7100, agentFee: 580 },
];

const AGENT_PROFILES = {
  'a-001': {
    initials: 'AC', avatarColor: 'wine',
    legalName: 'Aduanas Carabobo C.A.', tradeName: 'Aduanas Carabobo',
    founded: '2008-03-14', employees: 18,
    address: 'Av. Bolívar Norte, Edif. Plaza, Piso 4 · Puerto Cabello, Carabobo',
    email: 'info@aduanascarabobo.com.ve',
    website: 'aduanascarabobo.com.ve',
    contactRole: 'Director general · Agente aduanal habilitado',
    contactEmail: 'felipe.briceno@aduanascarabobo.com.ve',
    contactWa: '+584125528841',
    seniat: { number: 'AAH-VE-001284', expiry: '2027-08-15', port: 'PBL · La Aduana de Puerto Cabello' },
    portHabilitations: [
      { port: 'PBL', expiry: '2027-08-15', status: 'activo' },
      { port: 'LGU', expiry: '2026-09-30', status: 'activo' },
    ],
    certifications: [
      { name: 'OEA · Operador Económico Autorizado', issuer: 'SENIAT', expiry: '2027-03-20' },
      { name: 'ISO 9001:2015',                       issuer: 'Fondonorma', expiry: '2027-05-12' },
      { name: 'Seguro de responsabilidad civil',     issuer: 'Mercantil Seguros', expiry: '2026-12-01' },
    ],
    contractStart: '2020-11-04', exclusiveFor: ['Industrias Polar', 'Tech Solutions'],
    sla: { clearanceTargetDays: 12, currentAvg: 9.4 },
    metrics: {
      shipmentsYTD: 84, clearedYTD: 78, observados: 4, demoras: 2,
      avgClearanceDays: 9.4, onTimePct: 96,
      feesYTD: 38400, currentMonthFees: 4820,
      clearanceBy6mo: [11, 10, 9, 9, 10, 8], // ene → may
      feesBy6mo: [3600, 4100, 3900, 4200, 4500, 4820],
    },
    communications: [
      { date: '2026-05-23 16:42', kind: 'whatsapp', subject: 'DUA-VE-2026-088502 enviada · esperando respuesta SENIAT' },
      { date: '2026-05-22 11:15', kind: 'email',    subject: 'Confirmación inspección física DTDU-472816' },
      { date: '2026-05-20 09:30', kind: 'call',     subject: 'Coordinación pago aranceles · Acindar' },
      { date: '2026-05-18 14:08', kind: 'whatsapp', subject: 'Fotos contenedor abierto · sin observaciones' },
    ],
    notes: 'Agente de cabecera de DTD-Cargo desde 2020. Excelente relación con Felipe. SLA de 12d que cumple en 9.4d promedio.',
  },
  'a-002': {
    initials: 'LA', avatarColor: 'info',
    legalName: 'Logística Aduanal VE C.A.', tradeName: 'Logística Aduanal',
    founded: '2014-09-22', employees: 9,
    address: 'Calle Real La Guaira, Centro Comercial Litoral, Local 12 · La Guaira, Vargas',
    email: 'contacto@logaduanalve.com', website: 'logaduanalve.com',
    contactRole: 'Gerente operaciones aduanales',
    contactEmail: 'romina.salas@logaduanalve.com',
    contactWa: '+584142201188',
    seniat: { number: 'AAH-VE-001541', expiry: '2026-11-22', port: 'LGU · Puerto de La Guaira' },
    portHabilitations: [{ port: 'LGU', expiry: '2026-11-22', status: 'activo' }],
    certifications: [
      { name: 'ISO 9001:2015', issuer: 'Fondonorma', expiry: '2026-10-08' },
      { name: 'Seguro responsabilidad civil', issuer: 'Caracas Seguros', expiry: '2027-01-30' },
    ],
    contractStart: '2022-04-12', exclusiveFor: [],
    sla: { clearanceTargetDays: 14, currentAvg: 11.8 },
    metrics: { shipmentsYTD: 62, clearedYTD: 58, observados: 3, demoras: 1, avgClearanceDays: 11.8, onTimePct: 93, feesYTD: 22800, currentMonthFees: 2840, clearanceBy6mo: [13, 12, 12, 11, 12, 11], feesBy6mo: [2200, 2400, 2600, 2700, 2800, 2840] },
    communications: [
      { date: '2026-05-22 09:14', kind: 'email',    subject: 'Liberación DTDU-388157 · documentación enviada' },
      { date: '2026-05-18 17:00', kind: 'whatsapp', subject: 'Confirma aranceles pagados · OK' },
    ],
    notes: '',
  },
  'a-003': {
    initials: 'ZA', avatarColor: 'success',
    legalName: 'Zulia Aduanas S.A.', tradeName: 'Zulia Aduanas',
    founded: '2011-06-30', employees: 12,
    address: 'Av. 5 de Julio, Edif. Caribe, Piso 2 · Maracaibo, Zulia',
    email: 'oficina@zuliaaduanas.com', website: 'zuliaaduanas.com',
    contactRole: 'Agente aduanal · socio fundador',
    contactEmail: 'yoel.castillo@zuliaaduanas.com',
    contactWa: '+584167784477',
    seniat: { number: 'AAH-VE-000981', expiry: '2026-08-04', port: 'MAR · Puerto de Maracaibo' },
    portHabilitations: [{ port: 'MAR', expiry: '2026-08-04', status: 'activo' }],
    certifications: [
      { name: 'OEA · Operador Económico Autorizado', issuer: 'SENIAT', expiry: '2027-01-15' },
      { name: 'Seguro responsabilidad civil',         issuer: 'Mapfre', expiry: '2026-09-20' },
    ],
    contractStart: '2019-08-08', exclusiveFor: [],
    sla: { clearanceTargetDays: 10, currentAvg: 8.2 },
    metrics: { shipmentsYTD: 38, clearedYTD: 36, observados: 2, demoras: 0, avgClearanceDays: 8.2, onTimePct: 97, feesYTD: 14600, currentMonthFees: 2100, clearanceBy6mo: [9, 8, 8, 9, 8, 8], feesBy6mo: [1900, 2000, 2100, 2200, 2050, 2100] },
    communications: [
      { date: '2026-05-22 10:00', kind: 'whatsapp', subject: 'DTDU-419032 en liberación final · llega hoy' },
    ],
    notes: 'Especialista en Zulia. Único agente con presencia 24/7 en MAR.',
  },
  'a-004': {
    initials: 'FC', avatarColor: 'warning',
    legalName: 'Falcón Customs C.A.', tradeName: 'Falcón Customs',
    founded: '2017-11-08', employees: 5,
    address: 'Calle Comercio, Punto Fijo, Falcón',
    email: 'info@falconcustoms.ve', website: 'falconcustoms.ve',
    contactRole: 'Directora · Agente aduanal',
    contactEmail: 'diana.mendez@falconcustoms.ve',
    contactWa: '+584249992200',
    seniat: { number: 'AAH-VE-001721', expiry: '2027-02-18', port: 'PFI · Puerto de Punto Fijo' },
    portHabilitations: [{ port: 'PFI', expiry: '2027-02-18', status: 'activo' }],
    certifications: [
      { name: 'Seguro responsabilidad civil', issuer: 'Bolívar Seguros', expiry: '2026-11-12' },
    ],
    contractStart: '2023-02-20', exclusiveFor: [],
    sla: { clearanceTargetDays: 14, currentAvg: 10.6 },
    metrics: { shipmentsYTD: 24, clearedYTD: 24, observados: 0, demoras: 1, avgClearanceDays: 10.6, onTimePct: 96, feesYTD: 9800, currentMonthFees: 1240, clearanceBy6mo: [12, 11, 11, 10, 11, 10], feesBy6mo: [1400, 1500, 1600, 1700, 1700, 1240] },
    communications: [],
    notes: 'Agente más nuevo. Excelente comunicación a pesar de equipo chico.',
  },
};

const PORT_NAMES = {
  PBL: 'Puerto Cabello',
  LGU: 'La Guaira',
  MAR: 'Maracaibo',
  PFI: 'Punto Fijo',
};
const STATUS_TONE_DUA = {
  'liberado':    'success',
  'liberación':  'wine',
  'en revisión': 'info',
  'observación': 'warning',
};

function daysUntilA(dateStr) {
  if (!dateStr) return null;
  const today = new Date('2026-05-24').getTime();
  return Math.round((new Date(dateStr).getTime() - today) / 86400000);
}
function expiryToneA(dateStr) {
  if (!dateStr) return 'neutral';
  const d = daysUntilA(dateStr);
  if (d < 0) return 'danger';
  if (d < 90) return 'warning';
  return 'success';
}
function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

// ════════════════════════════════════════════════════════════════
function AgentePerfil() {
  const U = window.ERPUI;
  const I = window.Icon;
  const initialId = React.useMemo(() => {
    try {
      const id = new URLSearchParams(window.location.search).get('id');
      return id && AGENT_PROFILES[id] ? id : 'a-001';
    } catch (e) { return 'a-001'; }
  }, []);

  const [agentId, setAgentId] = React.useState(initialId);
  const agent = AGENTS_BASE.find(a => a.id === agentId);
  const profile = AGENT_PROFILES[agentId];
  const [notes, setNotes] = React.useState('');
  React.useEffect(() => { setNotes(profile?.notes || ''); }, [agentId]);

  if (!agent || !profile) return <div style={{ padding: 40 }}>Agente no encontrado.</div>;

  const shipments = AGENT_SHIPMENTS.filter(s => s.agent === agentId);
  const inProcess = shipments.filter(s => s.status !== 'liberado');
  const cleared   = shipments.filter(s => s.status === 'liberado');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <AgentTopBar agentId={agentId} setAgentId={setAgentId} />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 32px 60px' }}>
        <AgentHero agent={agent} profile={profile} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-6)' }}>
          <U.KPI label="Embarques YTD"      value={profile.metrics.shipmentsYTD} delta={`${profile.metrics.clearedYTD} liberados`} tone="wine"    icon={I.shield(18)} />
          <U.KPI label="Tiempo liberación"  value={`${profile.metrics.avgClearanceDays}d`} delta={`Meta SLA ${profile.sla.clearanceTargetDays}d`} tone={profile.metrics.avgClearanceDays <= profile.sla.clearanceTargetDays ? 'success' : 'warning'} icon={I.clock?.(18) || I.spark(18)} />
          <U.KPI label="On-time clearance"  value={`${profile.metrics.onTimePct}%`} delta={`${profile.metrics.observados} en observación`} tone="info" icon={I.check(18)} />
          <U.KPI label="Honorarios YTD"     value={`$${(profile.metrics.feesYTD / 1000).toFixed(1)}K`} delta={`Este mes $${profile.metrics.currentMonthFees.toLocaleString('es-VE')}`} tone="success" icon={I.invoice(18)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <ActiveShipmentsAgent shipments={inProcess} />
            <PerformanceAgent profile={profile} />
            <FeesChart profile={profile} />
            <ShipmentHistoryAgent shipments={shipments} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <ContactAgent agent={agent} profile={profile} />
            <CompanyCard agent={agent} profile={profile} />
            <SeniatHabilitation profile={profile} />
            <CertificationsAgent profile={profile} />
            <RecentComms profile={profile} />
            <AgentNotes notes={notes} setNotes={setNotes} />
            <AgentAdminActions />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────
function AgentTopBar({ agentId, setAgentId }) {
  const I = window.Icon;
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <a href="../DTD Studio · ERP.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
        {I.arrowL(13)} ERP
      </a>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Aduana SENIAT</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>Agentes aduanales</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <select value={agentId} onChange={(e) => { setAgentId(e.target.value); history.replaceState(null, '', `?id=${e.target.value}`); }}
        style={{
          padding: '6px 28px 6px 10px',
          background: 'var(--bg-elevated) url("data:image/svg+xml;utf8,<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"10\\\" height=\\\"6\\\" viewBox=\\\"0 0 10 6\\\"><path d=\\\"M1 1l4 4 4-4\\\" stroke=\\\"%236B6B6B\\\" stroke-width=\\\"1.6\\\" fill=\\\"none\\\" stroke-linecap=\\\"round\\\"/></svg>") no-repeat right 10px center',
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)',
          appearance: 'none', outline: 'none', cursor: 'pointer',
        }}>
        {AGENTS_BASE.map(a => <option key={a.id} value={a.id}>{a.name} · {a.port}</option>)}
      </select>
      <div style={{ flex: 1 }} />
      <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Perfil de agente · v1.1</span>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────
function AgentHero({ agent, profile }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '24px 28px',
      marginBottom: 'var(--s-6)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center',
    }}>
      <U.Avatar initials={profile.initials} color={profile.avatarColor} size={88} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <U.Badge tone="success" dot>Habilitado</U.Badge>
          <U.Badge tone="wine" size="sm">★ {agent.rating}</U.Badge>
          <span className="eyebrow">AGENTE ADUANAL · {agent.id.toUpperCase()}</span>
        </div>
        <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>{agent.name}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 10, font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--wine)' }}>{I.shield(13)}</span>
            Puerto <strong style={{ color: 'var(--ink)' }}>{PORT_NAMES[agent.port]} ({agent.port})</strong>
          </span>
          <span>·</span>
          <span><strong style={{ color: 'var(--ink)' }}>{agent.contact}</strong> · {profile.contactRole}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8, font: '500 12.5px/1.3 var(--f-mono)', color: 'var(--ink-mute)' }}>
          <span>RIF <strong style={{ color: 'var(--ink)' }}>{agent.rif}</strong></span>
          <span>·</span>
          <span>SENIAT <strong style={{ color: 'var(--ink)' }}>{profile.seniat.number}</strong></span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <a href={`mailto:${profile.contactEmail}`} style={{ textDecoration: 'none' }}>
          <U.Btn variant="secondary" icon={I.mail(13)} full>Email</U.Btn>
        </a>
        <a href={`tel:${agent.phone.replace(/\s/g, '')}`} style={{ textDecoration: 'none' }}>
          <U.Btn variant="secondary" full>Llamar</U.Btn>
        </a>
        <a href={`https://wa.me/${profile.contactWa.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <U.Btn variant="primary" full>WhatsApp</U.Btn>
        </a>
      </div>
    </div>
  );
}

// ── Active shipments (left col) ──────────────────────────────
function ActiveShipmentsAgent({ shipments }) {
  const U = window.ERPUI;
  if (shipments.length === 0) {
    return (
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>EN TRÁMITE AHORA</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin embarques activos.</div>
      </U.Card>
    );
  }
  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">EN TRÁMITE AHORA · {shipments.length}</div>
        <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Embarques con este agente</div>
      </div>
      <div>
        {shipments.map((s, i) => {
          const tone = STATUS_TONE_DUA[s.status] || 'neutral';
          const daysIn = daysBetween(s.arrived, '2026-05-24');
          return (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '130px 1fr 1fr 100px 90px',
              gap: 14, alignItems: 'center',
              padding: '14px 20px',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
              cursor: 'pointer',
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <code style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
              <div>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.client}</div>
                <code style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', display: 'inline-block', marginTop: 4 }}>{s.dua}</code>
              </div>
              <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>
                Arribo <strong style={{ color: 'var(--ink)' }}>{s.arrived}</strong><br/>
                <span style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{daysIn}d en trámite</span>
              </div>
              <U.Badge tone={tone} size="sm" dot>{s.status}</U.Badge>
              <div style={{ textAlign: 'right', font: '800 13px/1 var(--f-display)', color: 'var(--ink)' }}>${s.agentFee}</div>
            </div>
          );
        })}
      </div>
    </U.Card>
  );
}

// ── Performance (clearance time) ─────────────────────────────
function PerformanceAgent({ profile }) {
  const U = window.ERPUI;
  const months = ['DIC', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY'];
  const data = profile.metrics.clearanceBy6mo;
  const max = Math.max(...data, profile.sla.clearanceTargetDays);
  const target = profile.sla.clearanceTargetDays;
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow eyebrow-wine">TIEMPO DE LIBERACIÓN · 6 MESES</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.01em' }}>Días promedio por mes</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--wine)' }}>{profile.metrics.avgClearanceDays}d</div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>PROMEDIO · SLA {target}d</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 8, alignItems: 'end', height: 130, marginBottom: 8, position: 'relative' }}>
        {/* SLA target line */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          bottom: `${(target / max) * 100}%`,
          height: 0, borderTop: '1.5px dashed var(--warning)',
          zIndex: 1,
        }}>
          <span style={{
            position: 'absolute', right: 0, top: -16,
            font: '700 9.5px/1 var(--f-sans)', color: 'var(--warning)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
            background: 'var(--bg-surface)', padding: '0 4px',
          }}>SLA {target}d</span>
        </div>
        {data.map((v, i) => {
          const h = (v / max) * 100;
          const isLast = i === data.length - 1;
          const overTarget = v > target;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ font: '800 11px/1 var(--f-display)', color: overTarget ? 'var(--warning)' : 'var(--wine)', marginBottom: 4 }}>{v}d</div>
              <div style={{
                width: '100%', height: `${h}%`,
                background: overTarget ? 'var(--warning)' : (isLast ? 'var(--wine)' : 'var(--wine-soft)'),
                opacity: overTarget ? 0.85 : (isLast ? 1 : 0.55),
                borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length}, 1fr)`, gap: 8 }}>
        {months.map((m, i) => (
          <div key={i} style={{ textAlign: 'center', font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>{m}</div>
        ))}
      </div>
    </U.Card>
  );
}

// ── Fees chart ───────────────────────────────────────────────
function FeesChart({ profile }) {
  const U = window.ERPUI;
  const months = ['DIC', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY'];
  const data = profile.metrics.feesBy6mo;
  const max = Math.max(...data);
  const total = data.reduce((a, b) => a + b, 0);
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow eyebrow-wine">HONORARIOS · 6 MESES</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.01em' }}>Facturado al agente</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--success)' }}>${total.toLocaleString('es-VE')}</div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>SEMESTRE · ${(total/6).toFixed(0)} prom.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.length}, 1fr)`, gap: 8, alignItems: 'end', height: 90, marginBottom: 8 }}>
        {data.map((v, i) => {
          const h = (v / max) * 100;
          const isLast = i === data.length - 1;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ font: '700 9px/1 var(--f-mono)', color: 'var(--ink-mute)', marginBottom: 3 }}>${(v/1000).toFixed(1)}K</div>
              <div style={{
                width: '100%', height: `${h}%`,
                background: isLast ? 'var(--success)' : 'var(--success)',
                opacity: isLast ? 1 : 0.55,
                borderRadius: 'var(--r-sm) var(--r-sm) 0 0',
              }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length}, 1fr)`, gap: 8 }}>
        {months.map((m, i) => (
          <div key={i} style={{ textAlign: 'center', font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em' }}>{m}</div>
        ))}
      </div>
    </U.Card>
  );
}

// ── Shipment history ─────────────────────────────────────────
function ShipmentHistoryAgent({ shipments }) {
  const U = window.ERPUI;
  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">HISTORIAL · {shipments.length}</div>
        <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Embarques recientes con el agente</div>
      </div>
      <div>
        {shipments.map((s, i) => {
          const tone = STATUS_TONE_DUA[s.status] || 'neutral';
          const days = s.cleared ? daysBetween(s.arrived, s.cleared) : daysBetween(s.arrived, '2026-05-24');
          return (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '130px 1fr 110px 80px 70px 80px',
              gap: 14, alignItems: 'center',
              padding: '12px 20px',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
              <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{s.client}</div>
                <code style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3, display: 'inline-block' }}>{s.dua}</code>
              </div>
              <U.Badge tone={tone} size="sm" dot>{s.status}</U.Badge>
              <div style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{days}d</div>
              <div style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{s.port}</div>
              <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>${s.agentFee}</div>
            </div>
          );
        })}
      </div>
    </U.Card>
  );
}

// ── Contact ──────────────────────────────────────────────────
function ContactAgent({ agent, profile }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CONTACTO PRINCIPAL</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Field label="Nombre"       value={agent.contact} />
        <U.Field label="Rol"          value={profile.contactRole} />
        <U.Field label="Email"        value={profile.contactEmail} />
        <U.Field label="WhatsApp"     value={agent.phone} mono />
        <U.Field label="Sitio web"    value={profile.website} mono />
      </div>
    </U.Card>
  );
}

// ── Company card ─────────────────────────────────────────────
function CompanyCard({ agent, profile }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>EMPRESA</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Field label="Razón social"   value={profile.legalName} />
        <U.Field label="RIF"            value={agent.rif} mono />
        <U.Field label="Fundación"      value={profile.founded} mono />
        <U.Field label="Empleados"      value={profile.employees} mono />
        <U.Field label="Dirección"      value={profile.address} />
        <U.Field label="Email corporativo" value={profile.email} />
        <U.Field label="Inicio contrato DTD" value={profile.contractStart} mono />
        {profile.exclusiveFor.length > 0 && (
          <div>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Clientes exclusivos</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {profile.exclusiveFor.map(c => <U.Badge key={c} tone="wine" size="sm">{c}</U.Badge>)}
            </div>
          </div>
        )}
      </div>
    </U.Card>
  );
}

// ── SENIAT habilitation ──────────────────────────────────────
function SeniatHabilitation({ profile }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>HABILITACIÓN SENIAT</div>
      <div style={{
        padding: '12px 14px', background: 'var(--bg-sidebar)', color: '#fff',
        borderRadius: 'var(--r-md)', marginBottom: 14,
      }}>
        <div style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Nº AGENTE ADUANAL</div>
        <code style={{ font: '900 17px/1 var(--f-mono)', letterSpacing: '0.05em' }}>{profile.seniat.number}</code>
        <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>vence {profile.seniat.expiry}</div>
      </div>
      <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Puertos habilitados</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {profile.portHabilitations.map(p => {
          const tone = expiryToneA(p.expiry);
          const days = daysUntilA(p.expiry);
          return (
            <div key={p.port} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${tone})`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{p.port} · {PORT_NAMES[p.port]}</div>
                <div style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>vence {p.expiry}</div>
              </div>
              <U.Badge tone={tone} size="sm">{days < 0 ? 'vencido' : `${days}d`}</U.Badge>
            </div>
          );
        })}
      </div>
    </U.Card>
  );
}

// ── Certifications ───────────────────────────────────────────
function CertificationsAgent({ profile }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CERTIFICACIONES & PÓLIZAS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {profile.certifications.map((c, i) => {
          const tone = expiryToneA(c.expiry);
          return (
            <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${tone})`, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{c.name}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{c.issuer} · vence {c.expiry}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </U.Card>
  );
}

// ── Recent comms ─────────────────────────────────────────────
function RecentComms({ profile }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const kindMeta = {
    whatsapp: { tone: 'success', label: 'WhatsApp', icon: I.mail(12) },
    email:    { tone: 'info',    label: 'Email',    icon: I.mail(12) },
    call:     { tone: 'wine',    label: 'Llamada',  icon: I.spark(12) },
  };
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>COMUNICACIONES RECIENTES</div>
      {profile.communications.length === 0 ? (
        <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin comunicaciones registradas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profile.communications.map((c, i) => {
            const meta = kindMeta[c.kind];
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 'var(--r-sm)',
                  background: `var(--${meta.tone}-bg)`, color: `var(--${meta.tone})`,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{meta.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                    <span style={{ font: '700 10.5px/1 var(--f-sans)', color: `var(--${meta.tone})`, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{meta.label}</span>
                    <span style={{ font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{c.date.slice(5)}</span>
                  </div>
                  <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{c.subject}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </U.Card>
  );
}

function AgentNotes({ notes, setNotes }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>NOTAS INTERNAS</div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas privadas sobre el agente…"
        style={{
          width: '100%', minHeight: 88, padding: '10px 12px',
          background: 'var(--bg-base)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', outline: 'none', resize: 'vertical',
          font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)',
        }}
      />
      <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 6 }}>
        Autoguardado · solo Admin
      </div>
    </U.Card>
  );
}

function AgentAdminActions() {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--ink-soft)' }}>ACCIONES ADMIN</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <U.Btn variant="ghost" full>Editar datos</U.Btn>
        <U.Btn variant="ghost" full>Generar reporte performance</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--warning)' }}>Suspender temporalmente</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--danger)' }}>Dar de baja</U.Btn>
      </div>
    </U.Card>
  );
}

window.AgentePerfil = AgentePerfil;
