/* global React */
/* ── DTD · Operario VE · Mobile App (chofer entrega) ────────── */

const { useState, useEffect, useRef } = React;

function OperarioVEApp() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [activeRoute, setActiveRoute] = useState(null);
  const [delivery, setDelivery] = useState({ confirmPhoto: null, signature: null, podPhoto: null, receivedBy: '', receivedDoc: '', notes: '' });

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);
  const resetDelivery = () => setDelivery({ confirmPhoto: null, signature: null, podPhoto: null, receivedBy: '', receivedDoc: '', notes: '' });

  return (
    <div className="op-app">
      {view === 'login'    && <Login onLogin={(u) => { setUser(u); setView('home'); }} />}
      {view === 'home'     && <Home user={user} theme={theme} setTheme={setTheme} onStartRoute={(r) => { resetDelivery(); setActiveRoute(r); setView('s0'); }} onLogout={() => { setUser(null); setView('login'); }} />}
      {view === 's0'       && <Step0Load route={activeRoute} onBack={() => setView('home')} onNext={() => setView('s1')} />}
      {view === 's1'       && <Step1Confirm route={activeRoute} delivery={delivery} setDelivery={setDelivery} onBack={() => setView('s0')} onNext={() => setView('s2')} />}
      {view === 's2'       && <Step2Route route={activeRoute} onBack={() => setView('s1')} onNext={() => setView('s3')} />}
      {view === 's3'       && <Step3Docs route={activeRoute} onBack={() => setView('s2')} onNext={() => setView('s4')} />}
      {view === 's4'       && <Step4Signature route={activeRoute} delivery={delivery} setDelivery={setDelivery} onBack={() => setView('s3')} onNext={() => setView('s5')} />}
      {view === 's5'       && <Step5POD route={activeRoute} delivery={delivery} setDelivery={setDelivery} onBack={() => setView('s4')} onSubmit={() => setView('done')} />}
      {view === 'done'     && <Done route={activeRoute} onHome={() => { setActiveRoute(null); resetDelivery(); setView('home'); }} />}
    </div>
  );
}

// ── Shared chrome ───────────────────────────────────────────
function MobileHeader({ title, subtitle, back, right }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      padding: 'env(safe-area-inset-top) 16px 12px',
      display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: 8, alignItems: 'center', paddingTop: 14,
    }}>
      {back ? (
        <button onClick={back} style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' }}>{window.Icon.arrowL(20)}</button>
      ) : <div />}
      <div style={{ textAlign: 'center', minWidth: 0 }}>
        <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right || <div />}
    </header>
  );
}

function BigButton({ label, onClick, disabled, icon, variant = 'primary' }) {
  const v = {
    primary: { bg: 'var(--wine)', fg: '#fff' },
    secondary: { bg: 'var(--bg-elevated)', fg: 'var(--ink)' },
    success: { bg: 'var(--success)', fg: '#fff' },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 56,
      background: v.bg, color: v.fg,
      borderRadius: 'var(--r-md)',
      font: '800 16px/1 var(--f-sans)', letterSpacing: '-0.01em',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{icon}{label}</button>
  );
}

function BottomActions({ back, next, nextDisabled, submitLabel, onSubmit, variant }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      padding: '12px 16px',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
      background: 'var(--bg-base)', borderTop: '1px solid var(--border)',
      display: 'grid', gridTemplateColumns: back ? '1fr 2fr' : '1fr', gap: 10,
      maxWidth: 480, margin: '0 auto',
    }}>
      {back && <BigButton label="Atrás" onClick={back} variant="secondary" />}
      <BigButton label={submitLabel || 'Siguiente →'} onClick={onSubmit || next} disabled={nextDisabled} variant={variant} />
    </div>
  );
}

function Steps({ current, total = 5 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${total}, 1fr)`, gap: 6, padding: '0 16px 16px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ height: 4, borderRadius: 999, background: i < current ? 'var(--wine)' : 'var(--bg-elevated)' }} />
      ))}
    </div>
  );
}

// ── Login ───────────────────────────────────────────────────
function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const handleDigit = (d) => {
    if (pin.length < 4) {
      const next = pin + d;
      setPin(next);
      if (next.length === 4) setTimeout(() => onLogin({ id: 'd-001', name: 'Luis Hernández', truck: 'AC542XK', hub: 'PBL' }), 300);
    }
  };
  const backspace = () => setPin(pin.slice(0, -1));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--ink) 0%, #1F3055 100%)',
      display: 'flex', flexDirection: 'column', padding: '40px 24px', color: '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <img src="assets/dtdcargo-icon-navy.png" alt="" style={{ width: 40, height: 40, filter: 'brightness(0) invert(1)' }} />
        <div style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', font: '700 10px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>CHOFER</div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>DTD-CARGO · OPERARIO VE</div>
        <div style={{ font: '900 30px/1.05 var(--f-display)', color: '#fff', marginTop: 14, letterSpacing: '-0.025em' }}>Entregas DDP<br/>Venezuela 🚚</div>
        <div style={{ font: '500 14px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>Ingresá tu PIN de 4 dígitos</div>

        <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: '50%',
              background: i < pin.length ? 'var(--wine-soft)' : 'transparent',
              border: '2px solid rgba(255,255,255,0.4)', transition: 'background var(--dur-fast) var(--ease)',
            }} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 14, marginTop: 36 }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handleDigit(String(n))} style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', color: '#fff',
              font: '900 28px/1 var(--f-display)', border: '1px solid rgba(255,255,255,0.12)',
            }}>{n}</button>
          ))}
          <div />
          <button onClick={() => handleDigit('0')} style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: '#fff', font: '900 28px/1 var(--f-display)', border: '1px solid rgba(255,255,255,0.12)' }}>0</button>
          <button onClick={backspace} style={{ width: 72, height: 72, borderRadius: '50%', background: 'transparent', color: 'rgba(255,255,255,0.6)' }}>{window.Icon.close(22)}</button>
        </div>
      </div>

      <div style={{ textAlign: 'center', font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.4)' }}>
        Luis Hernández · AC542XK · Pto Cabello<br/>v1.0 · DTD-CARGO 2026
      </div>
    </div>
  );
}

// ── Home ────────────────────────────────────────────────────
function Home({ user, theme, setTheme, onStartRoute, onLogout }) {
  const D = window.ERPData;
  const myRoutes = (D?.TMS_ROUTES || []).filter(r => r.driver === user.id || true).slice(0, 3);
  const [menuOpen, setMenuOpen] = useState(false);

  // Mock today's routes
  const routes = [
    { id: 'R-2026-0142', shipment: 'DTDU-472816', client: 'Acindar Comercial', from: 'PBL · Terminal', to: 'Valencia · ZI Acindar', distance: 168, eta: '14:30', status: 'pendiente', boxes: 12, cbm: 6.4 },
    { id: 'R-2026-0144', shipment: 'DTDU-364299', client: 'Vargas & Asoc', from: 'PBL · Terminal', to: 'Valencia · Galpón', distance: 142, eta: '17:00', status: 'pendiente', boxes: 8, cbm: 24.2 },
    { id: 'R-2026-0140', shipment: 'DTDU-388157', client: 'Imp. Pereira', from: 'LGU', to: 'Caracas', distance: 32, eta: 'completada · 10:42', status: 'completado', boxes: 8, cbm: 8.2 },
  ];

  return (
    <div>
      <MobileHeader
        title="Mi día"
        subtitle={`${user.truck} · ${user.hub}`}
        right={<button onClick={() => setMenuOpen(true)} style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', color: 'var(--ink-soft)' }}>{window.Icon.menu(20)}</button>}
      />

      <div style={{ padding: 16, paddingBottom: 100 }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>23 May 2026 · 09:42</div>
          <div style={{ font: '900 24px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Hola, {user.name.split(' ')[0]} 🚚</div>
          <div style={{ font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Tenés 2 entregas pendientes hoy · 310 km</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          <KPICard label="Rutas hoy" value="3" tone="wine" />
          <KPICard label="Entregadas" value="1" tone="success" />
          <KPICard label="Km hoy" value="32" tone="info" />
        </div>

        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>Rutas asignadas</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {routes.map(r => {
            const done = r.status === 'completado';
            return (
              <button key={r.id} onClick={() => !done && onStartRoute(r)} disabled={done} style={{
                width: '100%', padding: 14, textAlign: 'left',
                background: done ? 'var(--success-bg)' : 'var(--bg-surface)',
                border: `1px solid ${done ? 'var(--success)' : 'var(--border)'}`,
                borderLeft: `4px solid ${done ? 'var(--success)' : 'var(--wine)'}`,
                borderRadius: 'var(--r-md)',
                opacity: done ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.shipment}</code>
                  {done
                    ? <span style={{ padding: '3px 8px', borderRadius: 3, background: 'var(--success)', color: '#fff', font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.1em' }}>✓ ENTREGADO</span>
                    : <span style={{ font: '700 10.5px/1 var(--f-mono)', color: 'var(--wine)' }}>ETA {r.eta}</span>
                  }
                </div>
                <div style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.client}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>
                  <span>{r.from}</span>
                  <span style={{ color: 'var(--wine)' }}>→</span>
                  <span>{r.to}</span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 14, font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
                  <span>📦 {r.boxes} cj</span>
                  <span>📊 {r.cbm} CBM</span>
                  <span>🛣 {r.distance} km</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 'env(safe-area-inset-bottom)', left: 0, right: 0, padding: '12px 16px 18px', background: 'linear-gradient(0deg, var(--bg-base) 50%, transparent 100%)', maxWidth: 480, margin: '0 auto' }}>
        <BigButton label="Iniciar próxima ruta →" onClick={() => onStartRoute(routes.find(r => r.status === 'pendiente'))} icon={<span style={{ fontSize: 22 }}>🚚</span>} />
      </div>

      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: 20, paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 14px/1 var(--f-display)' }}>LH</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>{user.name}</div>
                <div style={{ font: '500 11px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 2 }}>{user.truck} · {user.hub}</div>
              </div>
            </div>
            <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ font: '600 14px/1 var(--f-sans)', color: 'var(--ink)' }}>Tema</span>
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', font: '600 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{theme === 'dark' ? '☀️ Light' : '🌙 Dark'}</button>
            </div>
            <button onClick={onLogout} style={{ width: '100%', padding: '14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--r-md)', font: '700 14px/1 var(--f-sans)', marginTop: 12 }}>Cerrar sesión</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, tone }) {
  const c = { wine: 'var(--wine)', info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)' }[tone];
  return (
    <div style={{ padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
      <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '900 22px/1 var(--f-display)', color: c, marginTop: 8, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

// ── Step 1 · Confirmar carga ───────────────────────────────
function Step1Confirm({ route, delivery, setDelivery, onBack, onNext }) {
  const hasPhoto = !!delivery.confirmPhoto;
  return (
    <div>
      <MobileHeader title="1 de 5 · Confirmar carga" subtitle={route?.shipment} back={onBack} />
      <Steps current={1} />

      <div style={{ padding: '0 16px 100px' }}>
        <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: 16 }}>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>ENTREGA</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 8, letterSpacing: '-0.01em' }}>{route?.client}</div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6, font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
            <div>📍 <b style={{ color: 'var(--ink)' }}>{route?.to}</b></div>
            <div>📦 {route?.boxes} cajas · {route?.cbm} CBM</div>
            <div>🛣 {route?.distance} km · ETA {route?.eta}</div>
          </div>
        </div>

        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>Foto del camión cargado</div>
        <div style={{ marginBottom: 16 }}>
          {hasPhoto ? (
            <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <span style={{ fontSize: 64, opacity: 0.5 }}>🚛</span>
              <div style={{ position: 'absolute', bottom: 8, left: 8, right: 8, padding: '6px 10px', background: 'var(--ink)', color: '#fff', borderRadius: 4, font: '600 10.5px/1 var(--f-mono)' }}>camion-cargado-{route?.shipment}.jpg</div>
              <button onClick={() => setDelivery({ ...delivery, confirmPhoto: null })} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', background: 'rgba(168,50,62,0.9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.close(14)}</button>
            </div>
          ) : (
            <button onClick={() => setDelivery({ ...delivery, confirmPhoto: 'mock' })} style={{
              width: '100%', aspectRatio: '4/3',
              background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-md)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              font: '800 16px/1 var(--f-sans)',
            }}>
              <span style={{ fontSize: 48 }}>📷</span>
              Tomar foto del camión cargado
            </button>
          )}
        </div>

        <div style={{ padding: '10px 12px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
          <span style={{ color: 'var(--info)' }}>ℹ</span>
          La foto sirve como evidencia de que la carga salió del puerto en condiciones correctas.
        </div>
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={!hasPhoto} />
    </div>
  );
}

// ── Step 2 · En ruta GPS ────────────────────────────────────
function Step2Route({ route, onBack, onNext }) {
  const [arrived, setArrived] = useState(false);
  return (
    <div>
      <MobileHeader title="2 de 5 · En ruta" subtitle={`${route?.from} → ${route?.to}`} back={onBack} />
      <Steps current={2} />

      <div style={{ padding: '0 16px 100px' }}>
        {/* Live GPS card */}
        <div style={{ padding: 16, background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-md)', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>GPS · EN VIVO</div>
              <div style={{ font: '900 18px/1 var(--f-display)', color: '#fff', marginTop: 6 }}>{arrived ? '🎯 Llegaste al destino' : 'Avanzando al destino'}</div>
            </div>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#7CE3A5', animation: 'erp-fade 1.5s infinite alternate' }} />
          </div>

          {/* Mini map mock */}
          <div style={{ aspectRatio: '16/10', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--r-sm)', position: 'relative', overflow: 'hidden' }}>
            <svg viewBox="0 0 400 220" style={{ width: '100%', height: '100%' }}>
              <path d="M 40 180 Q 120 100 220 90 Q 320 80 360 50" fill="none" stroke="rgba(216,154,164,0.4)" strokeWidth="3" strokeDasharray="6 6" />
              <path d="M 40 180 Q 120 100 220 90" fill="none" stroke="#D89AA4" strokeWidth="4" />
              <circle cx="40" cy="180" r="8" fill="#fff" />
              <circle cx="360" cy="50" r="8" fill="var(--wine)" />
              <text x="40" y="200" fontFamily="Archivo Black" fontSize="9" fill="#fff" textAnchor="middle">PBL</text>
              <text x="360" y="38" fontFamily="Archivo Black" fontSize="9" fill="#fff" textAnchor="middle">Valencia</text>
              <g transform={arrived ? 'translate(360 50)' : 'translate(220 90)'}>
                <circle r="20" fill="var(--wine)" opacity="0.3">
                  <animate attributeName="r" values="14;24;14" dur="2s" repeatCount="indefinite" />
                </circle>
                <circle r="10" fill="var(--wine)" stroke="#fff" strokeWidth="2.5" />
                <text y="3" fontSize="10" textAnchor="middle">🚛</text>
              </g>
            </svg>
          </div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Recorrido</div>
              <div style={{ font: '800 16px/1 var(--f-mono)', color: '#fff', marginTop: 5 }}>{arrived ? route?.distance : Math.round(route?.distance * 0.62)} km</div>
            </div>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Restante</div>
              <div style={{ font: '800 16px/1 var(--f-mono)', color: '#fff', marginTop: 5 }}>{arrived ? 0 : Math.round(route?.distance * 0.38)} km</div>
            </div>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ETA</div>
              <div style={{ font: '800 16px/1 var(--f-mono)', color: 'var(--wine-soft)', marginTop: 5 }}>{arrived ? 'AHORA' : route?.eta}</div>
            </div>
          </div>
        </div>

        {/* Contact destination */}
        <div style={{ padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: 14 }}>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Contacto en destino</div>
          <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Carlos Méndez · Acindar</div>
          <div style={{ font: '600 12px/1.2 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 4 }}>+58 412 166 8021</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <a style={{ padding: '10px', background: '#25D366', color: '#fff', borderRadius: 'var(--r-md)', textAlign: 'center', font: '700 12px/1 var(--f-sans)' }}>📱 WhatsApp</a>
            <a style={{ padding: '10px', background: 'var(--bg-elevated)', color: 'var(--ink)', borderRadius: 'var(--r-md)', textAlign: 'center', font: '700 12px/1 var(--f-sans)' }}>📞 Llamar</a>
          </div>
        </div>

        {!arrived && (
          <BigButton label="🎯 Llegué al destino" onClick={() => setArrived(true)} variant="success" />
        )}
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={!arrived} />
    </div>
  );
}

// ── Step 3 · Docs ──────────────────────────────────────────
function Step3Docs({ route, onBack, onNext }) {
  const [downloaded, setDownloaded] = useState({ bl: false, packing: false, factura: false });
  const allDone = downloaded.bl && downloaded.packing && downloaded.factura;
  const docs = [
    { k: 'bl', label: 'BL · Bill of Lading', icon: '📄', size: '482 KB' },
    { k: 'packing', label: 'Packing List', icon: '📋', size: '124 KB' },
    { k: 'factura', label: 'Factura comercial', icon: '🧾', size: '88 KB' },
  ];

  return (
    <div>
      <MobileHeader title="3 de 5 · Entregar docs" subtitle="Documentos al cliente" back={onBack} />
      <Steps current={3} />

      <div style={{ padding: '0 16px 100px' }}>
        <div style={{ padding: '10px 12px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)', marginBottom: 14 }}>
          <span style={{ color: 'var(--info)' }}>ℹ</span>
          Descargá los 3 documentos en tu teléfono · entregá al cliente la factura impresa o digital.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map(d => {
            const done = downloaded[d.k];
            return (
              <button key={d.k} onClick={() => setDownloaded({ ...downloaded, [d.k]: !done })} style={{
                display: 'grid', gridTemplateColumns: '44px 1fr 80px', gap: 12,
                padding: 14, alignItems: 'center', textAlign: 'left',
                background: done ? 'var(--success-bg)' : 'var(--bg-surface)',
                border: `1px solid ${done ? 'var(--success)' : 'var(--border)'}`,
                borderRadius: 'var(--r-md)',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: done ? 'var(--success)' : 'var(--wine-tint)', color: done ? '#fff' : 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {done ? '✓' : d.icon}
                </div>
                <div>
                  <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{d.label}</div>
                  <div style={{ font: '500 11px/1.2 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{d.size}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {done ? (
                    <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.1em' }}>DESCARGADO</span>
                  ) : (
                    <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.04em' }}>⬇ Descargar</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>OPCIONES</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <BigButton label="📧 Email cliente" onClick={() => {}} variant="secondary" />
            <BigButton label="🖨 Imprimir" onClick={() => {}} variant="secondary" />
          </div>
        </div>
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={!allDone} />
    </div>
  );
}

// ── Step 4 · Firma del cliente ─────────────────────────────
function Step4Signature({ route, delivery, setDelivery, onBack, onNext }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!delivery.signature);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#0F1E3D';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
    const y = (e.touches?.[0]?.clientY ?? e.clientY) - rect.top;
    return { x: x * (canvas.width / rect.width), y: y * (canvas.height / rect.height) };
  };

  const start = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
  };
  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
    if (!delivery.signature) setDelivery({ ...delivery, signature: 'drawn' });
  };
  const end = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setDelivery({ ...delivery, signature: null });
  };

  return (
    <div>
      <MobileHeader title="4 de 5 · Firma del cliente" subtitle={route?.client} back={onBack} />
      <Steps current={4} />

      <div style={{ padding: '0 16px 100px' }}>
        <div style={{ padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)', marginBottom: 14 }}>
          <span style={{ color: 'var(--warning)' }}>✍️</span>
          Pedile al cliente que firme abajo confirmando recepción del envío.
        </div>

        <div style={{ position: 'relative', background: '#fff', border: '2px dashed var(--border-strong)', borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: 12 }}>
          <canvas
            ref={canvasRef}
            width="600" height="280"
            onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
            onTouchStart={start} onTouchMove={move} onTouchEnd={end}
            style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none', cursor: 'crosshair' }}
          />
          {!hasSignature && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '500 14px/1 var(--f-sans)', color: 'var(--ink-mute)', pointerEvents: 'none' }}>
              Firmá acá ✍️
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 8, left: 12, right: 12, height: 1, background: 'var(--border)' }} />
          <div style={{ position: 'absolute', bottom: 12, left: 12, font: '500 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>X · Firma del cliente</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <BigButton label="🔄 Borrar" onClick={clear} variant="secondary" />
        </div>

        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>O foto del documento firmado</div>
        <button style={{
          width: '100%', padding: 12, background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)',
          font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>📷 Tomar foto del remito firmado</button>
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={!hasSignature} />
    </div>
  );
}

// ── Step 5 · POD ───────────────────────────────────────────
function Step5POD({ route, delivery, setDelivery, onBack, onSubmit }) {
  const hasPhoto = !!delivery.podPhoto;
  const canSubmit = hasPhoto && delivery.receivedBy.trim().length > 2;

  return (
    <div>
      <MobileHeader title="5 de 5 · POD" subtitle="Proof of Delivery" back={onBack} />
      <Steps current={5} />

      <div style={{ padding: '0 16px 100px' }}>
        {/* POD Photo */}
        <div style={{ marginBottom: 14 }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>Foto carga descargada</div>
          {hasPhoto ? (
            <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <span style={{ fontSize: 64, opacity: 0.5 }}>📦</span>
              <button onClick={() => setDelivery({ ...delivery, podPhoto: null })} style={{ position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', background: 'rgba(168,50,62,0.9)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.close(14)}</button>
            </div>
          ) : (
            <button onClick={() => setDelivery({ ...delivery, podPhoto: 'mock' })} style={{
              width: '100%', aspectRatio: '4/3',
              background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-md)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              font: '800 16px/1 var(--f-sans)',
            }}>
              <span style={{ fontSize: 48 }}>📷</span>
              Foto en el destino
            </button>
          )}
        </div>

        {/* Receiver info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Nombre de quien recibe</span>
            <input
              value={delivery.receivedBy}
              onChange={(e) => setDelivery({ ...delivery, receivedBy: e.target.value })}
              placeholder="Ej: Carlos Méndez"
              style={{ height: 48, padding: '0 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '600 15px/1 var(--f-sans)', color: 'var(--ink)', outline: 'none' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cédula (opcional)</span>
            <input
              value={delivery.receivedDoc}
              onChange={(e) => setDelivery({ ...delivery, receivedDoc: e.target.value })}
              placeholder="V-12.345.678"
              style={{ height: 48, padding: '0 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '700 15px/1 var(--f-mono)', color: 'var(--ink)', outline: 'none' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Observaciones</span>
            <textarea
              value={delivery.notes}
              onChange={(e) => setDelivery({ ...delivery, notes: e.target.value })}
              placeholder="Carga entregada en buenas condiciones · sin daños"
              rows={3}
              style={{ padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '500 14px/1.4 var(--f-sans)', color: 'var(--ink)', outline: 'none', resize: 'vertical' }}
            />
          </label>
        </div>
      </div>

      <BottomActions back={onBack} submitLabel="✓ Confirmar entrega" onSubmit={onSubmit} nextDisabled={!canSubmit} variant="success" />
    </div>
  );
}

// ── Done ───────────────────────────────────────────────────
function Done({ route, onHome }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', background: 'var(--bg-base)' }}>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, fontSize: 48 }}>✓</div>
      <div style={{ font: '900 28px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em' }}>¡Entrega completada!</div>
      <code style={{ font: '800 16px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 14 }}>{route?.shipment}</code>
      <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 16, maxWidth: '32ch' }}>
        El POD se sincronizó al ERP. El cliente recibió el email con la confirmación y los documentos firmados.
      </div>

      <div style={{ marginTop: 28, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', width: '100%', maxWidth: 320 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: 'var(--success)' }}>✓</span>
          <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>Email enviado al cliente</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ color: 'var(--success)' }}>✓</span>
          <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>POD firmado adjunto</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--success)' }}>✓</span>
          <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>Embarque marcado como entregado</span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: 320, marginTop: 28 }}>
        <BigButton label="Volver a Mi día" onClick={onHome} icon={<span style={{ fontSize: 22 }}>🏠</span>} />
      </div>
    </div>
  );
}

window.OperarioVEApp = OperarioVEApp;

// ── Step 0 · Cargar camión (consolidado + parciales) ──────────
function Step0Load({ route, onBack, onNext }) {
  // Multi-stop deliveries del viaje
  const initialDeliveries = [
    { id: 'd1', client: 'Acindar Comercial',  markbox: 'DTD-5452', shipment: 'DTDU-472816', totalBoxes: 12, loadedBoxes: 12, totalCBM: 6.4, address: 'Valencia · ZI Acindar',     order: 1 },
    { id: 'd2', client: 'Polar Planta Sur',    markbox: 'DTD-5392', shipment: 'DTDU-419032', totalBoxes: 80, loadedBoxes: 63, totalCBM: 28.4, address: 'Caracas · Plaza Venezuela', order: 2, reason: 'capacidad' },
    { id: 'd3', client: 'Vargas & Asoc',       markbox: 'DTD-5298', shipment: 'DTDU-364299', totalBoxes: 14, loadedBoxes: 14, totalCBM: 4.8,  address: 'Maracay · Galpón Norte',  order: 3 },
    { id: 'd4', client: 'Dist. Andina',         markbox: 'DTD-5340', shipment: 'DTDU-401234', totalBoxes: 22, loadedBoxes: 22, totalCBM: 5.2,  address: 'Valencia · Centro',       order: 4 },
  ];
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [checked, setChecked] = useState({});
  const [reasonOpen, setReasonOpen] = useState(null);

  const setLoaded = (id, val) => setDeliveries(deliveries.map(d => d.id === id ? { ...d, loadedBoxes: Math.max(0, Math.min(d.totalBoxes, +val || 0)) } : d));
  const toggleCheck = (id) => setChecked({ ...checked, [id]: !checked[id] });
  const setReason = (id, reason) => setDeliveries(deliveries.map(d => d.id === id ? { ...d, reason } : d));

  const totalCBM = deliveries.reduce((s, d) => s + d.totalCBM * (d.loadedBoxes / d.totalBoxes), 0);
  const truckCap = 76;
  const usage = (totalCBM / truckCap) * 100;
  const totalBoxes = deliveries.reduce((s, d) => s + d.loadedBoxes, 0);
  const totalOrig = deliveries.reduce((s, d) => s + d.totalBoxes, 0);
  const allChecked = deliveries.every(d => checked[d.id]);
  const partials = deliveries.filter(d => d.loadedBoxes < d.totalBoxes);
  const needsReason = partials.filter(d => !d.reason);
  const canNext = allChecked && needsReason.length === 0;

  const reasonOptions = [
    { v: 'capacidad', l: 'Sin capacidad en camión' },
    { v: 'dano',     l: 'Cajas dañadas · inspección' },
    { v: 'cliente',  l: 'Pedido del cliente' },
    { v: 'sanitario',l: 'Permisos sanitarios pendientes' },
    { v: 'otro',     l: 'Otro motivo' },
  ];

  return (
    <div>
      <MobileHeader title="Cargar camión" subtitle={`${deliveries.length} entregas · ${route?.from || 'PBL'}`} back={onBack} />
      <Steps current={0} total={6} />

      <div style={{ padding: '0 16px 100px' }}>
        {/* Capacity bar */}
        <div style={{ padding: 14, background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-md)', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <div>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>OCUPACIÓN CAMIÓN</div>
              <div style={{ font: '900 24px/1 var(--f-mono)', color: '#fff', marginTop: 8 }}>{totalCBM.toFixed(1)} / {truckCap} CBM</div>
            </div>
            <div style={{ font: '800 16px/1 var(--f-mono)', color: usage > 95 ? 'var(--warning)' : '#7CE3A5' }}>{usage.toFixed(0)}%</div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, usage)}%`, height: '100%', background: usage > 95 ? 'var(--warning)' : 'var(--wine-soft)', borderRadius: 999 }} />
          </div>
          <div style={{ marginTop: 8, font: '500 11.5px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.65)' }}>
            {totalBoxes} / {totalOrig} cajas cargadas · {deliveries.length} clientes
          </div>
        </div>

        {/* Deliveries checklist */}
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>CHECKLIST DE CARGA</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {deliveries.map(d => {
            const isPartial = d.loadedBoxes < d.totalBoxes;
            const isChecked = checked[d.id];
            const remaining = d.totalBoxes - d.loadedBoxes;
            return (
              <div key={d.id} style={{
                padding: 12,
                background: isChecked ? 'var(--success-bg)' : 'var(--bg-surface)',
                border: `1px solid ${isChecked ? 'var(--success)' : isPartial ? 'var(--warning)' : 'var(--border)'}`,
                borderLeft: `4px solid ${isChecked ? 'var(--success)' : isPartial ? 'var(--warning)' : 'var(--wine)'}`,
                borderRadius: 'var(--r-md)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <button onClick={() => toggleCheck(d.id)} style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isChecked ? 'var(--success)' : 'var(--bg-elevated)',
                    color: isChecked ? '#fff' : 'var(--ink-soft)',
                    border: `2px solid ${isChecked ? 'var(--success)' : 'var(--border-strong)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>{isChecked && '✓'}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ font: '700 9px/1 var(--f-mono)', color: 'var(--wine)', background: 'var(--wine-tint)', padding: '2px 5px', borderRadius: 3 }}>#{d.order}</span>
                      <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{d.client}</div>
                    </div>
                    <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                      📍 {d.address} · <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{d.shipment}</code>
                    </div>
                  </div>
                </div>

                {/* Box input */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Cajas a cargar</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '6px 10px' }}>
                      <input type="number" value={d.loadedBoxes} onChange={(e) => setLoaded(d.id, e.target.value)} inputMode="numeric"
                        style={{ width: 60, border: 0, outline: 'none', background: 'transparent', font: '800 18px/1 var(--f-mono)', color: 'var(--ink)' }}
                      />
                      <span style={{ font: '600 13px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>/ {d.totalBoxes} cj</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CBM</div>
                    <div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 5 }}>{(d.totalCBM * (d.loadedBoxes / d.totalBoxes)).toFixed(1)}</div>
                  </div>
                </div>

                {/* Partial alert */}
                {isPartial && (
                  <div style={{ padding: '8px 10px', background: 'var(--warning-bg)', borderRadius: 'var(--r-sm)', marginTop: 4 }}>
                    <div style={{ font: '700 11px/1.2 var(--f-sans)', color: 'var(--warning)', marginBottom: 4 }}>
                      ⚠️ Entrega parcial · {d.loadedBoxes}/{d.totalBoxes} cajas
                    </div>
                    <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
                      Restan <b>{remaining} cajas</b> en bodega como <code style={{ font: '700 10.5px/1 var(--f-mono)', color: 'var(--warning)' }}>{d.shipment}-P2</code>
                    </div>
                    <button onClick={() => setReasonOpen(reasonOpen === d.id ? null : d.id)} style={{
                      marginTop: 6, padding: '5px 10px', borderRadius: 'var(--r-sm)',
                      background: d.reason ? 'var(--success-bg)' : 'var(--wine)', color: d.reason ? 'var(--success)' : '#fff',
                      font: '700 11px/1 var(--f-sans)',
                    }}>{d.reason ? `✓ ${reasonOptions.find(r => r.v === d.reason)?.l}` : 'Indicar motivo →'}</button>
                    {reasonOpen === d.id && (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {reasonOptions.map(r => (
                          <button key={r.v} onClick={() => { setReason(d.id, r.v); setReasonOpen(null); }} style={{
                            padding: '8px 10px', borderRadius: 'var(--r-sm)', textAlign: 'left',
                            background: d.reason === r.v ? 'var(--wine-tint)' : 'var(--bg-surface)',
                            border: `1px solid ${d.reason === r.v ? 'var(--wine)' : 'var(--border)'}`,
                            font: `${d.reason === r.v ? '700' : '500'} 12px/1.2 var(--f-sans)`, color: 'var(--ink)',
                          }}>{r.l}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Helper banner */}
        {!canNext && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            <span style={{ color: 'var(--warning)' }}>⚠</span>
            {!allChecked && `Faltan ${deliveries.filter(d => !checked[d.id]).length} clientes por confirmar carga`}
            {allChecked && needsReason.length > 0 && `${needsReason.length} parcial${needsReason.length > 1 ? 'es' : ''} sin motivo · indicar antes de continuar`}
          </div>
        )}

        {canNext && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--success-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            <span style={{ color: 'var(--success)' }}>✓</span>
            Todo cargado y confirmado · listos para sellar el camión y arrancar la ruta
          </div>
        )}
      </div>

      <BottomActions back={onBack} submitLabel="🔒 Sellar y arrancar ruta" onSubmit={onNext} nextDisabled={!canNext} variant="success" />
    </div>
  );
}
