/* global React */
/* ── Perfil de Camión · standalone ──────────────────────────── */

// ── Extra mock data por camión ─────────────────────────────────
// TODO: al consolidar, mover a erp/data.jsx · TRUCK_PROFILES
const TRUCK_PROFILES = {
  'T-001': {
    year: 2019, vin: 'YV2RT40A9KB823441', engine: 'D13K 460 CV · 6 cil.',
    dimensions: { length: 13.6, width: 2.5, height: 2.9 }, // metros
    tare: 8500, axles: 3,
    purchaseDate: '2019-08-14', purchaseValue: 145000,
    docs: {
      circulacion:  { expiry: '2026-12-31' },
      soat:         { expiry: '2026-09-15' },
      rtv:          { expiry: '2026-11-08' },
      seguroFlota:  { expiry: '2027-02-20' },
      rifVehicular: { expiry: null },
    },
    nextServiceKm: 200000, nextServiceDate: '2026-06-30',
    serviceHistory: [
      { date: '2026-04-12', km: 178200, type: 'preventivo', desc: 'Aceite + filtros · revisión frenos', cost: 480 },
      { date: '2026-02-08', km: 168400, type: 'preventivo', desc: 'Aceite + neumáticos delanteros', cost: 1240 },
      { date: '2025-12-15', km: 158100, type: 'correctivo', desc: 'Cambio embrague completo', cost: 2800 },
      { date: '2025-10-22', km: 148900, type: 'preventivo', desc: 'Aceite + filtros + frenos traseros', cost: 720 },
    ],
    costBreakdown: { fuel: 4820, maint: 480, salary: 1850, tolls: 420, other: 180 }, // último mes
    trips30d: 22, utilization: 84,
    incidents: [
      { date: '2026-04-30', type: 'menor', desc: 'Roce lateral en patio Polar · sin daños mayores', cost: 0, severity: 'low' },
    ],
    recentTrips: [
      { date: '2026-05-23', route: 'PBL → Valencia · ZI Acindar', driver: 'd-001', km: 168, fuel: 27, onTime: true },
      { date: '2026-05-21', route: 'PBL → Caracas · CCS Polar Center', driver: 'd-001', km: 215, fuel: 35, onTime: true },
      { date: '2026-05-19', route: 'PBL → Maracay · Tech Solutions', driver: 'd-001', km: 142, fuel: 23, onTime: false },
      { date: '2026-05-17', route: 'PBL → Valencia · ZI Acindar', driver: 'd-001', km: 168, fuel: 27, onTime: true },
      { date: '2026-05-15', route: 'PBL → Caracas · Farmacia La Vista', driver: 'd-001', km: 215, fuel: 36, onTime: true },
      { date: '2026-05-13', route: 'PBL → Valencia · MAVECA', driver: 'd-001', km: 168, fuel: 28, onTime: true },
    ],
    notes: 'Camión emblema de la flota. Volvo veterano pero muy confiable. Mantener el plan de servicios cada 10.000 km.',
  },
  'T-002': { year: 2021, vin: 'WDB9701141L228874', engine: 'OM 924 LA · 240 CV · 4 cil.', dimensions: { length: 9.2, width: 2.4, height: 2.7 }, tare: 4200, axles: 2, purchaseDate: '2021-03-22', purchaseValue: 68000, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-08-30' }, rtv: { expiry: '2027-01-14' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 100000, nextServiceDate: '2026-08-15', serviceHistory: [{ date: '2026-05-02', km: 88200, type: 'preventivo', desc: 'Aceite + filtros', cost: 380 }], costBreakdown: { fuel: 3120, maint: 380, salary: 1850, tolls: 320, other: 120 }, trips30d: 18, utilization: 72, incidents: [], recentTrips: [], notes: '' },
  'T-003': { year: 2022, vin: 'ZCFC50AAA00582114', engine: '3.0 HPI · 170 CV', dimensions: { length: 7.4, width: 2.1, height: 2.5 }, tare: 2800, axles: 2, purchaseDate: '2022-07-08', purchaseValue: 52000, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-07-20' }, rtv: { expiry: '2026-10-12' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 70000, nextServiceDate: '2026-07-04', serviceHistory: [{ date: '2026-04-28', km: 62400, type: 'preventivo', desc: 'Aceite + filtros + alineación', cost: 320 }], costBreakdown: { fuel: 2420, maint: 320, salary: 1850, tolls: 280, other: 100 }, trips30d: 16, utilization: 68, incidents: [], recentTrips: [], notes: '' },
  'T-004': { year: 2017, vin: 'YS2R6X20009422118', engine: 'DC13 · 450 CV · 6 cil.', dimensions: { length: 13.6, width: 2.5, height: 2.9 }, tare: 8800, axles: 3, purchaseDate: null, purchaseValue: null, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-08-04' }, rtv: { expiry: '2026-06-30' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 220000, nextServiceDate: '2026-06-08', serviceHistory: [{ date: '2026-03-14', km: 208400, type: 'preventivo', desc: 'Aceite + filtros + revisión turbo', cost: 540 }], costBreakdown: { fuel: 5210, maint: 540, salary: 0, tolls: 480, other: 200 }, trips30d: 24, utilization: 91, incidents: [{ date: '2026-05-18', type: 'multa', desc: 'Exceso velocidad ruta MAR', cost: 120, severity: 'medium' }], recentTrips: [], notes: 'Camión contratado · revisar contrato Scania en septiembre.' },
  'T-005': { year: 2020, vin: 'JHFRR1JFLLKZ20088', engine: 'J05E-UF · 165 CV · 4 cil.', dimensions: { length: 6.2, width: 2.0, height: 2.3 }, tare: 2100, axles: 2, purchaseDate: '2020-11-30', purchaseValue: 38000, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-10-22' }, rtv: { expiry: '2026-09-04' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 145000, nextServiceDate: '2026-06-22', serviceHistory: [{ date: '2026-05-22', km: 142000, type: 'correctivo', desc: 'Cambio bomba aceite · en taller hoy', cost: 1800 }], costBreakdown: { fuel: 1820, maint: 1800, salary: 1850, tolls: 220, other: 80 }, trips30d: 14, utilization: 58, incidents: [{ date: '2026-05-22', type: 'mecánica', desc: 'Falla bomba de aceite · en taller', cost: 1800, severity: 'high' }], recentTrips: [], notes: 'En taller esta semana. Falla en bomba de aceite.' },
  'T-006': { year: 2016, vin: '1XKAD49X4GJ455882', engine: 'Cummins X15 · 510 CV', dimensions: { length: 14.2, width: 2.5, height: 3.0 }, tare: 9200, axles: 3, purchaseDate: null, purchaseValue: null, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-11-18' }, rtv: { expiry: '2026-08-22' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 315000, nextServiceDate: '2026-06-15', serviceHistory: [{ date: '2026-04-20', km: 298400, type: 'preventivo', desc: 'Aceite + 4 neumáticos traseros', cost: 1820 }], costBreakdown: { fuel: 6080, maint: 1820, salary: 0, tolls: 520, other: 220 }, trips30d: 20, utilization: 78, incidents: [], recentTrips: [], notes: 'Camión contratado · de alto kilometraje pero confiable.' },
  'T-007': { year: 2023, vin: 'WDB9701141L312441', engine: 'OM 924 LA · 240 CV · 4 cil.', dimensions: { length: 9.2, width: 2.4, height: 2.7 }, tare: 4200, axles: 2, purchaseDate: '2023-05-18', purchaseValue: 72000, docs: { circulacion: { expiry: '2026-12-31' }, soat: { expiry: '2026-12-04' }, rtv: { expiry: '2027-03-12' }, seguroFlota: { expiry: '2027-02-20' }, rifVehicular: { expiry: null } }, nextServiceKm: 60000, nextServiceDate: '2026-08-30', serviceHistory: [{ date: '2026-05-08', km: 44200, type: 'preventivo', desc: 'Aceite + filtros (primer service)', cost: 420 }], costBreakdown: { fuel: 1820, maint: 420, salary: 1850, tolls: 180, other: 100 }, trips30d: 12, utilization: 51, incidents: [], recentTrips: [], notes: 'El más nuevo de la flota.' },
};

const STATUS_TONE_T = { 'en ruta': 'wine', 'disponible': 'success', 'cargando': 'info', 'mantenimiento': 'warning' };
const HUB_NAMES_T = {
  PBL: 'Puerto Cabello',
  LGU: 'La Guaira',
  MAR: 'Maracaibo',
  PFI: 'Punto Fijo',
};

function daysUntilT(dateStr) {
  if (!dateStr) return null;
  const today = new Date('2026-05-24').getTime();
  return Math.round((new Date(dateStr).getTime() - today) / 86400000);
}
function expiryToneT(dateStr) {
  if (!dateStr) return 'neutral';
  const d = daysUntilT(dateStr);
  if (d < 0) return 'danger';
  if (d < 45) return 'warning';
  return 'success';
}

// ════════════════════════════════════════════════════════════════
function CamionPerfil() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;

  const initialId = React.useMemo(() => {
    try {
      const id = new URLSearchParams(window.location.search).get('id');
      return id && TRUCK_PROFILES[id] ? id : 'T-001';
    } catch (e) { return 'T-001'; }
  }, []);

  const [truckId, setTruckId] = React.useState(initialId);
  const truck = D.TRUCKS.find(t => t.id === truckId);
  const profile = TRUCK_PROFILES[truckId];
  const [notes, setNotes] = React.useState('');
  React.useEffect(() => { setNotes(profile?.notes || ''); }, [truckId]);

  if (!truck || !profile) return <div style={{ padding: 40 }}>Camión no encontrado.</div>;

  const driver = truck.driver ? D.DRIVERS.find(d => d.id === truck.driver) : null;
  const activeRoute = D.TMS_ROUTES.find(r => r.truck === truckId && r.status === 'en ruta');
  const totalCost = Object.values(profile.costBreakdown).reduce((a, b) => a + b, 0);
  const costPerKm = totalCost / (profile.recentTrips.reduce((s, t) => s + t.km, 0) || (profile.trips30d * 180));
  const kmToService = Math.max(0, profile.nextServiceKm - truck.km);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <TruckTopBar truckId={truckId} setTruckId={setTruckId} />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 32px 60px' }}>
        <TruckHero truck={truck} profile={profile} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-6)' }}>
          <U.KPI label="Km totales"          value={truck.km.toLocaleString('es-VE')} delta={`+${Math.round(profile.trips30d * 180 / 1000)}K últimos 30d`} tone="wine"    icon={I.radar(18)} />
          <U.KPI label="Viajes · 30 días"    value={profile.trips30d}                 delta={`Utilización ${profile.utilization}%`}                       tone="info"    icon={I.truck(18)} />
          <U.KPI label="Costo por km"         value={`$${costPerKm.toFixed(2)}`}      delta={`Total mes $${totalCost.toLocaleString('es-VE')}`}            tone="success" icon={I.chart(18)} />
          <U.KPI label="Próximo service"     value={`${kmToService.toLocaleString('es-VE')} km`} delta={`o el ${profile.nextServiceDate}`}                tone={kmToService < 3000 ? 'warning' : 'neutral'} icon={I.cog?.(18) || I.spark(18)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {activeRoute && <TruckActiveRoute route={activeRoute} driver={driver} />}
            <TruckSpecs truck={truck} profile={profile} />
            <CostBreakdown profile={profile} totalCost={totalCost} costPerKm={costPerKm} />
            <ServiceHistory profile={profile} truck={truck} />
            <TruckRecentTrips profile={profile} D={D} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <AssignedDriver driver={driver} />
            <Documents profile={profile} />
            <NextService profile={profile} truck={truck} kmToService={kmToService} />
            <TruckIncidents incidents={profile.incidents} />
            <TruckNotes notes={notes} setNotes={setNotes} />
            <TruckAdminActions />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────
function TruckTopBar({ truckId, setTruckId }) {
  const D = window.ERPData;
  const I = window.Icon;
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <a href="../../DTD Studio · ERP.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
        {I.arrowL(13)} ERP
      </a>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>TMS</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>Flota</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <select value={truckId} onChange={(e) => { setTruckId(e.target.value); history.replaceState(null, '', `?id=${e.target.value}`); }}
        style={{
          padding: '6px 28px 6px 10px',
          background: 'var(--bg-elevated) url("data:image/svg+xml;utf8,<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"10\\\" height=\\\"6\\\" viewBox=\\\"0 0 10 6\\\"><path d=\\\"M1 1l4 4 4-4\\\" stroke=\\\"%236B6B6B\\\" stroke-width=\\\"1.6\\\" fill=\\\"none\\\" stroke-linecap=\\\"round\\\"/></svg>") no-repeat right 10px center',
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)',
          appearance: 'none', outline: 'none', cursor: 'pointer',
        }}>
        {D.TRUCKS.map(t => <option key={t.id} value={t.id}>{t.plate} · {t.brand}</option>)}
      </select>
      <div style={{ flex: 1 }} />
      <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Perfil de camión · v1.1</span>
    </header>
  );
}

// ── Hero ─────────────────────────────────────────────────────
function TruckHero({ truck, profile }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '24px 28px',
      marginBottom: 'var(--s-6)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center',
    }}>
      {/* Photo placeholder */}
      <div style={{
        width: 160, height: 110, borderRadius: 'var(--r-md)',
        background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, position: 'relative', overflow: 'hidden',
      }}>
        <span style={{ color: 'var(--wine)', opacity: 0.6 }}>{I.truck(56)}</span>
        <span style={{
          position: 'absolute', bottom: 6, right: 6,
          font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>+ FOTO</span>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <U.Badge tone={STATUS_TONE_T[truck.status]} dot>{truck.status}</U.Badge>
          <U.Badge tone={truck.owned ? 'success' : 'info'} size="sm">{truck.owned ? 'Propio' : 'Contratado'}</U.Badge>
          <span className="eyebrow">CAMIÓN · {truck.id}</span>
        </div>
        <h1 style={{ font: '900 36px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '0.02em', margin: 0 }}>{truck.plate}</h1>
        <div style={{ font: '700 16px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 8 }}>
          {truck.brand} <span style={{ color: 'var(--ink-mute)', font: '500 16px/1 var(--f-sans)' }}>· {truck.type}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 8, font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--wine)' }}>{I.warehouse(13)}</span>
            Hub <strong style={{ color: 'var(--ink)' }}>{HUB_NAMES_T[truck.hub]} ({truck.hub})</strong>
          </span>
          <span>·</span>
          <span><strong style={{ color: 'var(--ink)' }}>{truck.capacityKg.toLocaleString('es-VE')} kg</strong> · {truck.capacityCBM} CBM</span>
          <span>·</span>
          <span><strong style={{ color: 'var(--ink)' }}>{profile.year}</strong></span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
        <U.Btn variant="primary">Asignar a ruta</U.Btn>
        <U.Btn variant="secondary">Reportar incidencia</U.Btn>
        <U.Btn variant="ghost">Editar datos</U.Btn>
      </div>
    </div>
  );
}

// ── Active route ─────────────────────────────────────────────
function TruckActiveRoute({ route, driver }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="eyebrow eyebrow-wine">EN RUTA AHORA</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.01em' }}>
            Ruta <code style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--wine)' }}>{route.id}</code>
          </div>
        </div>
        <U.Badge tone="wine" dot>en ruta</U.Badge>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
        <U.Field label="Embarque" value={<code style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{route.shipment}</code>} />
        <U.Field label="Chofer" value={driver?.name || '—'} />
        <U.Field label="Distancia" value={`${route.distance} km`} />
        <U.Field label="ETA" value={route.eta.slice(11)} mono />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Progreso</span>
          <span style={{ font: '800 13px/1 var(--f-display)', color: 'var(--wine)' }}>{route.progress}%</span>
        </div>
        <U.Progress value={route.progress} tone="wine" />
        <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
          {route.stops.join('  →  ')}
        </div>
      </div>
    </U.Card>
  );
}

// ── Technical specs ──────────────────────────────────────────
function TruckSpecs({ truck, profile }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 16 }}>ESPECIFICACIONES TÉCNICAS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <U.Field label="Año modelo"      value={profile.year} mono />
        <U.Field label="Tipo"            value={truck.type} />
        <U.Field label="Tracción"        value={`${profile.axles} ejes`} />
        <U.Field label="Motor"           value={profile.engine} />
        <U.Field label="Combustible"     value={truck.fuel} />
        <U.Field label="Rendimiento"     value={`${truck.mpg} km/L`} mono />
        <U.Field label="Capacidad carga" value={`${truck.capacityKg.toLocaleString('es-VE')} kg`} mono />
        <U.Field label="Volumen"         value={`${truck.capacityCBM} CBM`} mono />
        <U.Field label="Tara"            value={`${profile.tare.toLocaleString('es-VE')} kg`} mono />
        <U.Field label="Largo · Ancho · Alto" value={`${profile.dimensions.length}m · ${profile.dimensions.width}m · ${profile.dimensions.height}m`} mono />
        <U.Field label="VIN / Serial"    value={profile.vin} mono />
        <U.Field label="Compra"          value={profile.purchaseDate ? `${profile.purchaseDate} · $${profile.purchaseValue?.toLocaleString('es-VE')}` : 'Contratado'} />
      </div>
    </U.Card>
  );
}

// ── Cost breakdown ───────────────────────────────────────────
function CostBreakdown({ profile, totalCost, costPerKm }) {
  const U = window.ERPUI;
  const items = [
    { k: 'fuel',    label: 'Combustible',   tone: 'wine' },
    { k: 'maint',   label: 'Mantenimiento', tone: 'warning' },
    { k: 'salary',  label: 'Salario chofer', tone: 'info' },
    { k: 'tolls',   label: 'Peajes',        tone: 'neutral' },
    { k: 'other',   label: 'Otros',         tone: 'neutral' },
  ];
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow eyebrow-wine">COSTOS · ÚLTIMOS 30 DÍAS</div>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.01em' }}>
            ${totalCost.toLocaleString('es-VE')}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '900 16px/1 var(--f-display)', color: 'var(--wine)' }}>${costPerKm.toFixed(2)} /km</div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>COSTO MARGINAL</div>
        </div>
      </div>

      {/* Stacked bar */}
      <div style={{ display: 'flex', height: 14, borderRadius: 'var(--r-pill)', overflow: 'hidden', marginBottom: 16, background: 'var(--bg-elevated)' }}>
        {items.map(it => {
          const v = profile.costBreakdown[it.k];
          const w = (v / totalCost) * 100;
          return v > 0 ? <div key={it.k} style={{ width: `${w}%`, background: `var(--${it.tone})` }} title={`${it.label}: $${v}`} /> : null;
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {items.map(it => {
          const v = profile.costBreakdown[it.k];
          const pct = ((v / totalCost) * 100).toFixed(0);
          return (
            <div key={it.k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--${it.tone})`, flexShrink: 0 }} />
              <span style={{ flex: 1, font: '500 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{it.label}</span>
              <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{pct}%</span>
              <span style={{ font: '800 13px/1 var(--f-display)', color: 'var(--ink)', minWidth: 70, textAlign: 'right' }}>${v.toLocaleString('es-VE')}</span>
            </div>
          );
        })}
      </div>
    </U.Card>
  );
}

// ── Service history ──────────────────────────────────────────
function ServiceHistory({ profile, truck }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const totalServiceCost = profile.serviceHistory.reduce((s, h) => s + h.cost, 0);
  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div className="eyebrow eyebrow-wine">HISTORIAL DE SERVICIOS · {profile.serviceHistory.length}</div>
          <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Último: {profile.serviceHistory[0]?.date} · {(truck.km - profile.serviceHistory[0]?.km).toLocaleString('es-VE')} km hace</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '900 16px/1 var(--f-display)', color: 'var(--wine)' }}>${totalServiceCost.toLocaleString('es-VE')}</div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>YTD</div>
        </div>
      </div>
      <div>
        {profile.serviceHistory.map((h, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '90px 80px 1fr 80px',
            gap: 14, alignItems: 'center',
            padding: '12px 20px',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
          }}>
            <div style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{h.date}</div>
            <U.Badge tone={h.type === 'correctivo' ? 'warning' : 'success'} size="sm">{h.type}</U.Badge>
            <div>
              <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{h.desc}</div>
              <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>{h.km.toLocaleString('es-VE')} km</div>
            </div>
            <div style={{ textAlign: 'right', font: '800 13px/1 var(--f-display)', color: 'var(--ink)' }}>${h.cost}</div>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

// ── Recent trips ─────────────────────────────────────────────
function TruckRecentTrips({ profile, D }) {
  const U = window.ERPUI;
  if (profile.recentTrips.length === 0) {
    return (
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>VIAJES RECIENTES</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin viajes registrados en el período.</div>
      </U.Card>
    );
  }
  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">VIAJES RECIENTES · {profile.recentTrips.length}</div>
      </div>
      <div>
        {profile.recentTrips.map((t, i) => {
          const driver = D.DRIVERS.find(d => d.id === t.driver);
          return (
            <div key={i} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr 120px 70px 70px',
              gap: 14, alignItems: 'center',
              padding: '12px 20px',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <div style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{t.date.slice(5)}</div>
              <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{t.route}</div>
              <div style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{driver?.name}</div>
              <div style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{t.km} km</div>
              <U.Badge tone={t.onTime ? 'success' : 'warning'} size="sm" dot>{t.onTime ? 'OK' : 'demora'}</U.Badge>
            </div>
          );
        })}
      </div>
    </U.Card>
  );
}

// ── Assigned driver (right col) ──────────────────────────────
function AssignedDriver({ driver }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="eyebrow eyebrow-wine">CHOFER ASIGNADO</div>
        {driver && (
          <a href={`chofer-perfil.html?id=${driver.id}`} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Ver perfil {I.arrowR(11)}
          </a>
        )}
      </div>
      {driver ? (
        <a href={`chofer-perfil.html?id=${driver.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', padding: '8px 0' }}>
          <U.Avatar initials={driver.name.split(' ').map(w => w[0]).slice(0, 2).join('')} color="wine" size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{driver.name}</div>
            <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
              ★ {driver.rating} · {driver.exp}a exp · {driver.trips30d} viajes /30d
            </div>
          </div>
        </a>
      ) : (
        <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', padding: '8px 0' }}>Sin chofer asignado.</div>
      )}
    </U.Card>
  );
}

// ── Documents ────────────────────────────────────────────────
function Documents({ profile }) {
  const U = window.ERPUI;
  const docs = [
    { k: 'circulacion',  label: 'Certif. circulación' },
    { k: 'soat',         label: 'SOAT' },
    { k: 'rtv',          label: 'RTV · revisión' },
    { k: 'seguroFlota',  label: 'Seguro flota' },
    { k: 'rifVehicular', label: 'RIF vehicular' },
  ];
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>DOCUMENTACIÓN</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {docs.map(d => {
          const exp = profile.docs[d.k]?.expiry;
          const tone = expiryToneT(exp);
          const days = daysUntilT(exp);
          return (
            <div key={d.k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${tone})`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{d.label}</div>
                <div style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>
                  {exp ? `vence ${exp}` : 'sin fecha'}
                </div>
              </div>
              <U.Badge tone={tone} size="sm">{exp ? (days < 0 ? 'vencido' : `${days}d`) : 'N/A'}</U.Badge>
            </div>
          );
        })}
      </div>
    </U.Card>
  );
}

// ── Next service ─────────────────────────────────────────────
function NextService({ profile, truck, kmToService }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const tone = kmToService < 3000 ? 'warning' : kmToService < 10000 ? 'info' : 'success';
  const checklist = [
    { label: 'Aceite + filtro de aceite', done: false },
    { label: 'Filtro de aire', done: false },
    { label: 'Revisión frenos delanteros', done: false },
    { label: 'Revisión presión neumáticos', done: false },
    { label: 'Niveles refrigerante / hidráulico', done: false },
  ];
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>PRÓXIMO SERVICE</div>
      <div style={{
        padding: '12px 14px', background: `var(--${tone}-bg)`,
        borderLeft: `3px solid var(--${tone})`, borderRadius: 'var(--r-md)',
        marginBottom: 14,
      }}>
        <div style={{ font: '900 20px/1 var(--f-display)', color: `var(--${tone})` }}>{kmToService.toLocaleString('es-VE')} km</div>
        <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink)', marginTop: 6 }}>
          o el <strong>{profile.nextServiceDate}</strong> · lo que ocurra primero
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {checklist.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 14, height: 14, borderRadius: 3,
              border: '1.5px solid var(--border-strong)', flexShrink: 0,
            }} />
            <span style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{c.label}</span>
          </div>
        ))}
      </div>
      <U.Btn variant="secondary" full style={{ marginTop: 14 }} icon={I.plus(13)}>Agendar service</U.Btn>
    </U.Card>
  );
}

// ── Incidents ────────────────────────────────────────────────
function TruckIncidents({ incidents }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>INCIDENCIAS · {incidents.length}</div>
      {incidents.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--success)' }}>{I.check(15)}</span>
          <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>Sin incidencias.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {incidents.map((inc, i) => {
            const tone = inc.severity === 'high' ? 'danger' : inc.severity === 'medium' ? 'warning' : 'info';
            return (
              <div key={i} style={{ padding: '10px 12px', background: `var(--${tone}-bg)`, borderLeft: `3px solid var(--${tone})`, borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <U.Badge tone={tone} size="sm">{inc.type}</U.Badge>
                  <span style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{inc.date}</span>
                  {inc.cost > 0 && <span style={{ marginLeft: 'auto', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>${inc.cost}</span>}
                </div>
                <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{inc.desc}</div>
              </div>
            );
          })}
        </div>
      )}
    </U.Card>
  );
}

function TruckNotes({ notes, setNotes }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>NOTAS INTERNAS</div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas privadas sobre el vehículo…"
        style={{
          width: '100%', minHeight: 88, padding: '10px 12px',
          background: 'var(--bg-base)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', outline: 'none', resize: 'vertical',
          font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)',
        }}
      />
      <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 6 }}>
        Autoguardado · solo Admin y Operaciones
      </div>
    </U.Card>
  );
}

function TruckAdminActions() {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--ink-soft)' }}>ACCIONES ADMIN</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <U.Btn variant="ghost" full>Reasignar chofer</U.Btn>
        <U.Btn variant="ghost" full>Enviar al taller</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--warning)' }}>Marcar fuera de servicio</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--danger)' }}>Dar de baja</U.Btn>
      </div>
    </U.Card>
  );
}

window.CamionPerfil = CamionPerfil;
