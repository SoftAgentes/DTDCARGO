/* global React */
/* ── Perfil de Chofer · standalone ───────────────────────────── */

// ── Extra mock data por chofer (vencimientos, training, etc.) ─
const DRIVER_PROFILES = window.ERPData.DRIVER_PROFILES;

const STATUS_TONE = { 'en ruta': 'wine', 'disponible': 'success', 'cargando': 'info', 'descanso': 'neutral' };
const HUB_NAMES = {
  PBL: 'Puerto Cabello',
  LGU: 'La Guaira',
  MAR: 'Maracaibo',
  PFI: 'Punto Fijo',
};

// ── Days until + tone helper ──────────────────────────────────
function daysUntil(dateStr) {
  const today = new Date('2026-05-24').getTime();
  const d = new Date(dateStr).getTime();
  return Math.round((d - today) / 86400000);
}
function expiryTone(dateStr) {
  const d = daysUntil(dateStr);
  if (d < 0) return 'danger';
  if (d < 60) return 'warning';
  return 'success';
}

// ════════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════════
function ChoferPerfil() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;

  // Read ?id= from URL
  const initialId = React.useMemo(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      return id && DRIVER_PROFILES[id] ? id : 'd-001';
    } catch (e) { return 'd-001'; }
  }, []);

  const [driverId, setDriverId] = React.useState(initialId);
  const [notes, setNotes] = React.useState('');

  const driver = D.DRIVERS.find(d => d.id === driverId);
  const profile = DRIVER_PROFILES[driverId];
  React.useEffect(() => { setNotes(profile?.notes || ''); }, [driverId]);

  if (!driver || !profile) {
    return <div style={{ padding: 40 }}>Chofer no encontrado.</div>;
  }

  const activeRoute = D.TMS_ROUTES.find(r => r.driver === driverId && r.status === 'en ruta');
  const truck = profile.assignedTruck ? D.TRUCKS.find(t => t.id === profile.assignedTruck) : null;
  const avgRating = profile.recentTrips.length > 0
    ? (profile.recentTrips.reduce((s, t) => s + t.rating, 0) / profile.recentTrips.length).toFixed(1)
    : driver.rating;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <TopBar driverId={driverId} setDriverId={setDriverId} />

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 32px 60px' }}>
        <HeroCard driver={driver} profile={profile} avgRating={avgRating} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 'var(--s-6)' }}>
          <U.KPI label="Viajes · últimos 30d" value={driver.trips30d}      delta="+3 vs mes ant."   tone="wine"    icon={I.truck(18)} />
          <U.KPI label="On-time delivery"     value={`${profile.onTimePct}%`} delta="↑ 1.2 pp"    tone="success" icon={I.check(18)} />
          <U.KPI label="Km totales"           value={`${(profile.kmTotal / 1000).toFixed(0)}K`} delta={`Consumo ${profile.fuelAvg} km/L`} tone="info" icon={I.radar(18)} />
          <U.KPI label="Antigüedad"           value={`${driver.exp} años`} delta={`Desde ${profile.hireDate.slice(0, 4)}`} tone="neutral" icon={I.users(18)} />
        </div>

        {/* 2-column layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {activeRoute && <ActiveRouteCard route={activeRoute} truck={truck} />}
            <PerformanceCard profile={profile} />
            {truck && <AssignedTruckCard truck={truck} />}
            <RecentTripsCard profile={profile} />
            <IncidentsCard incidents={profile.incidents} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <LicenseCard driver={driver} profile={profile} />
            <ContactCard driver={driver} profile={profile} />
            <CertificationsCard profile={profile} />
            <NotesCard notes={notes} setNotes={setNotes} />
            <DangerZone />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────
function TopBar({ driverId, setDriverId }) {
  const D = window.ERPData;
  const I = window.Icon;
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      padding: '12px 32px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <a href="../DTD Studio · ERP.html" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)',
      }}>
        {I.arrowL(13)} ERP
      </a>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>TMS</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>Choferes</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <select
        value={driverId} onChange={(e) => {
          setDriverId(e.target.value);
          history.replaceState(null, '', `?id=${e.target.value}`);
        }}
        style={{
          padding: '6px 28px 6px 10px',
          background: 'var(--bg-elevated) url(\"data:image/svg+xml;utf8,<svg xmlns=\\\"http://www.w3.org/2000/svg\\\" width=\\\"10\\\" height=\\\"6\\\" viewBox=\\\"0 0 10 6\\\"><path d=\\\"M1 1l4 4 4-4\\\" stroke=\\\"%236B6B6B\\\" stroke-width=\\\"1.6\\\" fill=\\\"none\\\" stroke-linecap=\\\"round\\\"/></svg>\") no-repeat right 10px center',
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)',
          appearance: 'none', outline: 'none', cursor: 'pointer',
        }}
      >
        {D.DRIVERS.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>
      <div style={{ flex: 1 }} />
      <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Perfil de chofer · v1.1
      </span>
    </header>
  );
}

// ── Hero card ────────────────────────────────────────────────
function HeroCard({ driver, profile, avgRating }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const tone = STATUS_TONE[driver.status];
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '24px 28px',
      marginBottom: 'var(--s-6)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center',
    }}>
      <U.Avatar initials={profile.initials} color={profile.avatarColor} size={88} />
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <U.Badge tone={tone} dot>{driver.status}</U.Badge>
          <span className="eyebrow">CHOFER · {driver.id.toUpperCase()}</span>
        </div>
        <h1 style={{ font: '900 32px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>{driver.name}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 10, font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--wine)' }}>{I.warehouse(13)}</span>
            Hub <strong style={{ color: 'var(--ink)' }}>{HUB_NAMES[driver.hub]} ({driver.hub})</strong>
          </span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--warning)' }}>★</span>
            <strong style={{ color: 'var(--ink)' }}>{avgRating}</strong> rating · {profile.recentTrips.length || driver.trips30d} viajes
          </span>
          <span>·</span>
          <span>Licencia <strong style={{ color: 'var(--ink)' }}>{driver.license}</strong></span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <U.Btn variant="secondary" icon={I.mail(13)}>Email</U.Btn>
        <a href={`tel:${driver.phone.replace(/\s/g, '')}`} style={{ textDecoration: 'none' }}>
          <U.Btn variant="secondary">Llamar</U.Btn>
        </a>
        <a href={`https://wa.me/${driver.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          <U.Btn variant="primary">WhatsApp</U.Btn>
        </a>
      </div>
    </div>
  );
}

// ── Active route card ────────────────────────────────────────
function ActiveRouteCard({ route, truck }) {
  const U = window.ERPUI;
  const I = window.Icon;
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
        <U.Field label="Embarque" value={<code style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{route.shipment}</code>} />
        <U.Field label="Camión" value={truck?.plate || '—'} mono />
        <U.Field label="Distancia" value={`${route.distance} km`} />
        <U.Field label="ETA" value={route.eta.slice(11)} mono />
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>PARADAS · {route.stops.length}</div>
        <div style={{ position: 'relative', paddingLeft: 18 }}>
          <div style={{ position: 'absolute', left: 6, top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
          {route.stops.map((stop, i) => (
            <div key={i} style={{ position: 'relative', paddingBottom: i < route.stops.length - 1 ? 14 : 0 }}>
              <span style={{
                position: 'absolute', left: -16, top: 4,
                width: 12, height: 12, borderRadius: '50%',
                background: i === 0 ? 'var(--success)' : (i < route.stops.length - 1 ? 'var(--wine)' : 'var(--bg-elevated)'),
                border: i === route.stops.length - 1 ? '2px solid var(--border-strong)' : 0,
              }} />
              <div style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{stop}</div>
              <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>
                {i === 0 ? 'origen · 08:30' : `parada ${i} · ETA ${route.eta.slice(11)}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Progreso</span>
          <span style={{ font: '800 13px/1 var(--f-display)', color: 'var(--wine)' }}>{route.progress}%</span>
        </div>
        <U.Progress value={route.progress} tone="wine" />
      </div>
    </U.Card>
  );
}

// ── Performance card ─────────────────────────────────────────
function PerformanceCard({ profile }) {
  const U = window.ERPUI;
  const months = ['DIC', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY'];
  const max = Math.max(...profile.trips6mo);
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div className="eyebrow eyebrow-wine">PERFORMANCE · 6 MESES</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.01em' }}>Viajes por mes</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '900 24px/1 var(--f-display)', color: 'var(--wine)' }}>{profile.trips6mo.reduce((a, b) => a + b, 0)}</div>
          <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', marginTop: 4 }}>TOTAL · {(profile.trips6mo.reduce((a,b) => a+b, 0) / 6).toFixed(1)} prom.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${profile.trips6mo.length}, 1fr)`, gap: 8, alignItems: 'end', height: 120, marginBottom: 8 }}>
        {profile.trips6mo.map((v, i) => {
          const h = (v / max) * 100;
          const isLast = i === profile.trips6mo.length - 1;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ font: '800 11px/1 var(--f-display)', color: 'var(--wine)', marginBottom: 4 }}>{v}</div>
              <div style={{
                width: '100%', height: `${h}%`,
                background: isLast ? 'var(--wine)' : 'var(--wine-soft)',
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

// ── Assigned truck card ──────────────────────────────────────
function AssignedTruckCard({ truck }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="eyebrow eyebrow-wine">CAMIÓN ASIGNADO</div>
        <a href={`camion-perfil.html?id=${truck.id}`} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          Ver perfil del camión {I.arrowR(11)}
        </a>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 'var(--r-md)',
          background: 'var(--wine-tint)', color: 'var(--wine)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{I.truck(28)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <code style={{ font: '900 18px/1 var(--f-mono)', color: 'var(--ink)' }}>{truck.plate}</code>
            <U.Badge tone={STATUS_TONE[truck.status] || 'neutral'} size="sm" dot>{truck.status}</U.Badge>
          </div>
          <div style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{truck.brand} · {truck.type}</div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
            {truck.capacityKg.toLocaleString('es-VE')} kg · {truck.capacityCBM} CBM · {truck.km.toLocaleString('es-VE')} km · {truck.owned ? 'Propio' : 'Contratado'}
          </div>
        </div>
      </div>
    </U.Card>
  );
}

// ── Recent trips card ────────────────────────────────────────
function RecentTripsCard({ profile }) {
  const U = window.ERPUI;
  if (profile.recentTrips.length === 0) {
    return (
      <U.Card padded>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>VIAJES RECIENTES</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)', padding: '12px 0' }}>Sin viajes registrados en el período.</div>
      </U.Card>
    );
  }
  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine">VIAJES RECIENTES · {profile.recentTrips.length}</div>
      </div>
      <div>
        {profile.recentTrips.map((t, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '90px 1fr 100px 70px 80px',
            gap: 14, alignItems: 'center',
            padding: '12px 20px',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
            cursor: 'pointer',
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{t.date.slice(5)}</div>
            <div>
              <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{t.route}</div>
              <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 4, display: 'inline-block' }}>{t.shipment}</code>
            </div>
            <div style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{t.km} km</div>
            <U.Badge tone={t.onTime ? 'success' : 'warning'} size="sm" dot>{t.onTime ? 'a tiempo' : 'demora'}</U.Badge>
            <div style={{ textAlign: 'right', font: '700 14px/1 var(--f-display)', color: 'var(--warning)' }}>★ {t.rating}</div>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

// ── Incidents card ───────────────────────────────────────────
function IncidentsCard({ incidents }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>INCIDENCIAS · {incidents.length}</div>
      {incidents.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
          <span style={{ color: 'var(--success)' }}>{I.check(15)}</span>
          <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>Sin incidencias registradas.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {incidents.map((inc, i) => {
            const tone = inc.severity === 'high' ? 'danger' : inc.severity === 'medium' ? 'warning' : 'info';
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', background: `var(--${tone}-bg)`,
                borderLeft: `3px solid var(--${tone})`, borderRadius: 'var(--r-md)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <U.Badge tone={tone} size="sm">{inc.type}</U.Badge>
                    <span style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{inc.date}</span>
                  </div>
                  <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{inc.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </U.Card>
  );
}

// ── License card ─────────────────────────────────────────────
function LicenseCard({ driver, profile }) {
  const U = window.ERPUI;
  const items = [
    { label: 'Licencia de conducir',  expiry: profile.licenseExpiry },
    { label: 'Certificado médico',    expiry: profile.medicalExpiry },
    { label: 'Examen psicotécnico',   expiry: profile.psychExpiry },
  ];
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>LICENCIA & SALUD</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {profile.licenseCategories.map(cat => (
          <span key={cat} style={{
            width: 30, height: 30, borderRadius: 'var(--r-sm)',
            background: 'var(--bg-sidebar)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            font: '900 13px/1 var(--f-display)',
          }}>{cat}</span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((it, i) => {
          const tone = expiryTone(it.expiry);
          const d = daysUntil(it.expiry);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${tone})`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{it.label}</div>
                <div style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>vence {it.expiry}</div>
              </div>
              <U.Badge tone={tone} size="sm">{d < 0 ? 'vencido' : `${d}d`}</U.Badge>
            </div>
          );
        })}
      </div>
    </U.Card>
  );
}

// ── Contact card ─────────────────────────────────────────────
function ContactCard({ driver, profile }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>DATOS DE CONTACTO</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Field label="Teléfono"        value={driver.phone}              mono />
        <U.Field label="Email"           value={profile.email} />
        <U.Field label="RIF · Cédula"    value={profile.rif}               mono />
        <U.Field label="Fecha nacimiento" value={profile.dob}              mono />
        <U.Field label="Ingreso a DTD"   value={profile.hireDate}          mono />
        <U.Field label="Dirección"       value={profile.address} />
        <div>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Contacto de emergencia</div>
          <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{profile.emergencyContact}</div>
        </div>
      </div>
    </U.Card>
  );
}

// ── Certifications card ──────────────────────────────────────
function CertificationsCard({ profile }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CAPACITACIONES</div>
      {profile.certifications.length === 0 ? (
        <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin capacitaciones cargadas.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {profile.certifications.map((c, i) => {
            const tone = expiryTone(c.expiry);
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', background: 'var(--bg-elevated)',
                borderRadius: 'var(--r-md)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${tone})`, marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{c.name}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{c.issuer} · vence {c.expiry}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </U.Card>
  );
}

// ── Notes card ───────────────────────────────────────────────
function NotesCard({ notes, setNotes }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>NOTAS INTERNAS</div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas privadas sobre el chofer (visibles solo para Admin y Operaciones)…"
        style={{
          width: '100%', minHeight: 88, padding: '10px 12px',
          background: 'var(--bg-base)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', outline: 'none', resize: 'vertical',
          font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)',
        }}
      />
      <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 6 }}>
        Autoguardado hace 2 min · solo Admin
      </div>
    </U.Card>
  );
}

// ── Danger zone (admin actions) ──────────────────────────────
function DangerZone() {
  const U = window.ERPUI;
  return (
    <U.Card padded style={{ borderColor: 'var(--border)' }}>
      <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--ink-soft)' }}>ACCIONES ADMIN</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <U.Btn variant="ghost" full>Editar datos del chofer</U.Btn>
        <U.Btn variant="ghost" full>Reasignar camión</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--warning)' }}>Marcar de licencia / vacaciones</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--danger)' }}>Dar de baja</U.Btn>
      </div>
    </U.Card>
  );
}

window.ChoferPerfil = ChoferPerfil;
