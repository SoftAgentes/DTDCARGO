/* global React */
/* ── DTD · Bodeguero VE · Mobile (arma camiones) ────────────── */

const { useState, useEffect } = React;

function BodegueroApp() {
  const [view, setView] = useState('login');
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [activeTruck, setActiveTruck] = useState(null);
  const [activeDriver, setActiveDriver] = useState(null);
  const [loadout, setLoadout] = useState({ items: [], sealed: false });
  const [activeContainer, setActiveContainer] = useState(null);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  return (
    <div className="op-app">
      {view === 'login'        && <Login onLogin={(u) => { setUser(u); setView('home'); }} />}
      {view === 'home'         && <Home user={user} theme={theme} setTheme={setTheme} onDispatch={() => setView('truck')} onReception={() => setView('rcp-list')} onLogout={() => setView('login')} />}
      {view === 'rcp-list'     && <ReceptionList onPick={(c) => { setActiveContainer(c); setView('rcp-scan'); }} onBack={() => setView('home')} />}
      {view === 'rcp-scan'     && <ReceptionScan container={activeContainer} onBack={() => setView('rcp-list')} onDone={() => setView('home')} />}
      {view === 'truck'        && <PickTruck onPick={(t) => { setActiveTruck(t); setView('driver'); }} onBack={() => setView('home')} />}
      {view === 'driver'  && <PickDriver truck={activeTruck} onPick={(d) => { setActiveDriver(d); setView('items'); }} onBack={() => setView('truck')} />}
      {view === 'items'   && <PickItems truck={activeTruck} driver={activeDriver} loadout={loadout} setLoadout={setLoadout} onBack={() => setView('driver')} onSeal={() => setView('handoff')} />}
      {view === 'handoff' && <Handoff truck={activeTruck} driver={activeDriver} loadout={loadout} onDone={() => { setView('home'); setLoadout({ items: [], sealed: false }); }} />}
    </div>
  );
}

function MobileHeader({ title, subtitle, back, right }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      padding: 'env(safe-area-inset-top) 16px 12px',
      display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: 8, alignItems: 'center', paddingTop: 14,
    }}>
      {back ? <button onClick={back} style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)' }}>{window.Icon.arrowL(20)}</button> : <div />}
      <div style={{ textAlign: 'center', minWidth: 0 }}>
        <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right || <div />}
    </header>
  );
}

function BigButton({ label, onClick, disabled, icon, variant = 'primary' }) {
  const v = { primary: { bg: 'var(--wine)', fg: '#fff' }, secondary: { bg: 'var(--bg-elevated)', fg: 'var(--ink)' }, success: { bg: 'var(--success)', fg: '#fff' } }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 56, background: v.bg, color: v.fg,
      borderRadius: 'var(--r-md)', font: '800 16px/1 var(--f-sans)', letterSpacing: '-0.01em',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
    }}>{icon}{label}</button>
  );
}

function Steps({ current, labels }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${labels.length}, 1fr)`, gap: 4, padding: '0 16px 14px' }}>
      {labels.map((l, i) => (
        <div key={l} style={{
          padding: '6px 4px',
          background: i + 1 === current ? 'var(--wine-tint)' : i + 1 < current ? 'var(--success-bg)' : 'var(--bg-elevated)',
          borderRadius: 'var(--r-sm)',
          borderBottom: `2px solid ${i + 1 === current ? 'var(--wine)' : i + 1 < current ? 'var(--success)' : 'var(--border)'}`,
        }}>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center' }}>{i + 1}. {l}</div>
        </div>
      ))}
    </div>
  );
}

// ── Login ───────────────────────────────────────────────────
function Login({ onLogin }) {
  const [pin, setPin] = useState('');
  const handle = (d) => {
    if (pin.length < 4) {
      const next = pin + d;
      setPin(next);
      if (next.length === 4) setTimeout(() => onLogin({ id: 'u-005', name: 'Yusneidy Pérez', hub: 'PBL' }), 300);
    }
  };
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, var(--ink) 0%, #1F3055 100%)', display: 'flex', flexDirection: 'column', padding: '40px 24px', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <img src="assets/dtdcargo-isologo-reverse.png" alt="DTD Cargo" style={{ height: 32, display: 'block' }} />
        <div style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.1)', font: '700 10px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>BODEGUERO</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>BODEGA · ALMACÉN VE</div>
        <div style={{ font: '900 26px/1.3 var(--f-display)', color: '#fff', marginTop: 14, letterSpacing: '-0.02em' }}>Armar camiones</div>
        <div style={{ font: '500 14px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 12 }}>PIN de 4 dígitos</div>
        <div style={{ display: 'flex', gap: 14, marginTop: 32 }}>
          {[0,1,2,3].map(i => <div key={i} style={{ width: 18, height: 18, borderRadius: '50%', background: i < pin.length ? 'var(--wine-soft)' : 'transparent', border: '2px solid rgba(255,255,255,0.4)' }} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 14, marginTop: 32 }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handle(String(n))} style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: '#fff', font: '900 28px/1 var(--f-display)', border: '1px solid rgba(255,255,255,0.12)' }}>{n}</button>
          ))}
          <div />
          <button onClick={() => handle('0')} style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', color: '#fff', font: '900 28px/1 var(--f-display)', border: '1px solid rgba(255,255,255,0.12)' }}>0</button>
          <button onClick={() => setPin(pin.slice(0, -1))} style={{ width: 72, height: 72, borderRadius: '50%', background: 'transparent', color: 'rgba(255,255,255,0.6)' }}>{window.Icon.close(22)}</button>
        </div>
      </div>
      <div style={{ textAlign: 'center', font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.4)' }}>Yusneidy Pérez · Bodega Pto Cabello</div>
    </div>
  );
}

// ── Home ────────────────────────────────────────────────────
function Home({ user, theme, setTheme, onDispatch, onReception, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [avisosOpen, setAvisosOpen] = useState(false);
  const Avisos = window.OperarioAvisos;
  const tt = (es) => es;
  const avisos = (Avisos && Avisos.seedBodega) ? Avisos.seedBodega() : [];
  const onAviso = (act) => { if (act === 'dispatch') onDispatch(); };
  return (
    <div>
      <MobileHeader title="Mi día · Bodega" subtitle="Pto Cabello · YP" right={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginRight: -8 }}>{Avisos && <Avisos.Bell items={avisos} onOpen={() => setAvisosOpen(true)} />}<button onClick={() => setMenuOpen(true)} style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', color: 'var(--ink-soft)', background: 'transparent', border: 0 }}>{window.Icon.menu(20)}</button></div>} />
      {Avisos && <Avisos.Sheet open={avisosOpen} onClose={() => setAvisosOpen(false)} t={tt} lang="es" items={avisos} onAction={onAviso} />}
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>23 May 2026 · 06:42</div>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Hola, Yusneidy</div>
          <div style={{ font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>2 contenedores por recibir · 3 camiones por armar</div>
        </div>

        {/* Mode picker */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10, marginBottom: 18 }}>
          <button onClick={onReception} style={{
            padding: 18, background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)',
            border: 0, color: '#fff', borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
          }}>
            <div style={{ width: 52, height: 52, borderRadius: 'var(--r-md)', background: 'rgba(216,154,164,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wine-soft)' }}>{window.Icon.box(28)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '900 16px/1.1 var(--f-display)', color: '#fff', letterSpacing: '-0.01em' }}>Recibir contenedor</div>
              <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>Escanéa cajas · confirma cantidad y CBM</div>
              <div style={{ marginTop: 6, padding: '2px 8px', display: 'inline-block', background: 'var(--wine-soft)', color: 'var(--ink)', borderRadius: 3, font: '700 10px/1.2 var(--f-sans)' }}>2 contenedores hoy</div>
            </div>
            <span style={{ color: 'var(--wine-soft)' }}>{window.Icon.chevR(18)}</span>
          </button>
          <button onClick={onDispatch} style={{
            padding: 18, background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderLeft: '4px solid var(--wine)',
            borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
          }}>
            <div style={{ width: 52, height: 52, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.truck(28)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Despachar camión</div>
              <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Arma camión · asigna chofer · pase QR</div>
              <div style={{ marginTop: 6, padding: '2px 8px', display: 'inline-block', background: 'var(--wine-tint)', color: 'var(--wine)', borderRadius: 3, font: '700 10px/1.2 var(--f-sans)' }}>3 camiones por armar</div>
            </div>
            <span style={{ color: 'var(--wine)' }}>{window.Icon.chevR(18)}</span>
          </button>
        </div>

        {/* KPIs row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <KPI label="Cajas hoy" value="142" tone="wine" />
          <KPI label="CBM movido" value="68.4" tone="info" />
          <KPI label="Incidencias" value="0" tone="success" />
        </div>
      </div>

      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.4)', zIndex: 50, display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: 20, paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
            <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 14px/1 var(--f-display)' }}>YP</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 14px/1.2 var(--f-display)' }}>{user.name}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>Bodega Pto Cabello · {user.hub}</div>
              </div>
            </div>
            <div style={{ padding: '12px 0', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ font: '600 14px/1 var(--f-sans)' }}>Tema</span>
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', font: '600 12px/1 var(--f-sans)' }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            </div>
            <button onClick={onLogout} style={{ width: '100%', padding: '14px', background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--r-md)', font: '700 14px/1 var(--f-sans)', marginTop: 12 }}>Cerrar sesión</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, tone }) {
  const c = { wine: 'var(--wine)', info: 'var(--info)', success: 'var(--success)' }[tone];
  return (
    <div style={{ padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
      <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '900 22px/1 var(--f-display)', color: c, marginTop: 8 }}>{value}</div>
    </div>
  );
}

// ── Step 1 · Elegir camión ─────────────────────────────────
function PickTruck({ onPick, onBack }) {
  const trucks = [
    { id: 'T-001', plate: 'AC542XK', type: 'Semi 40\'',   capCBM: 76, available: true, hub: 'PBL' },
    { id: 'T-002', plate: 'AD188PL', type: 'Furgón 24\'', capCBM: 38, available: true, hub: 'PBL' },
    { id: 'T-003', plate: 'AE204JR', type: 'Furgón 18\'', capCBM: 22, available: false, hub: 'LGU' },
    { id: 'T-006', plate: 'AH445BR', type: 'Semi 40\'HC', capCBM: 92, available: true, hub: 'PBL' },
  ];
  return (
    <div>
      <MobileHeader title="¿Qué camión vas a armar?" back={onBack} />
      <Steps current={1} labels={['Camión', 'Chofer', 'Items', 'Sellar']} />
      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {trucks.filter(t => t.available && t.hub === 'PBL').map(t => (
          <button key={t.id} onClick={() => onPick(t)} style={{
            padding: 16, textAlign: 'left',
            background: 'var(--bg-surface)', border: '1.5px solid var(--border)', borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 52, height: 52, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.truck(28)}</div>
            <div style={{ flex: 1 }}>
              <code style={{ font: '900 16px/1 var(--f-mono)', color: 'var(--ink)' }}>{t.plate}</code>
              <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{t.type} · {t.capCBM} CBM</div>
            </div>
            <span style={{ color: 'var(--wine)' }}>{window.Icon.chevR(16)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2 · Elegir chofer ─────────────────────────────────
function PickDriver({ truck, onPick, onBack }) {
  const drivers = [
    { id: 'd-001', name: 'Luis Hernández',  exp: 18, rating: 4.9, status: 'disponible', phone: '+58 414 552 1188', external: false },
    { id: 'd-002', name: 'José Velásquez',  exp: 9,  rating: 4.7, status: 'disponible', phone: '+58 412 884 7700', external: false },
    { id: 'd-005', name: 'Mario Castillo',  exp: 8,  rating: 4.6, status: 'disponible', phone: '+58 412 668 2200', external: false },
    { id: 'd-008', name: 'Pedro Rojas',      exp: 14, rating: 4.7, status: 'disponible', phone: '+58 416 884 0099', external: true },
    { id: 'd-009', name: 'Antonio Linares',  exp: 11, rating: 4.5, status: 'no contactado', phone: '+58 426 712 5544', external: true },
    { id: 'd-003', name: 'Carlos Salinas',  exp: 12, rating: 4.8, status: 'en ruta',     phone: '+58 416 339 5512', external: false },
  ];
  const [waOpen, setWaOpen] = useState(null);

  return (
    <div>
      <MobileHeader title={`Chofer para ${truck.plate}`} subtitle={truck.type} back={onBack} />
      <Steps current={2} labels={['Camión', 'Chofer', 'Items', 'Sellar']} />
      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {drivers.map(d => {
          const disabled = d.status === 'en ruta';
          const needsConfirm = d.status === 'no contactado';
          return (
            <div key={d.id} style={{
              padding: 14,
              background: 'var(--bg-surface)',
              border: `1.5px solid ${needsConfirm ? 'var(--warning)' : 'var(--border)'}`,
              borderLeft: d.external ? '4px solid var(--warning)' : '4px solid var(--wine)',
              borderRadius: 'var(--r-md)', opacity: disabled ? 0.4 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 16px/1 var(--f-display)', flexShrink: 0 }}>{d.name.split(' ').map(w=>w[0]).slice(0,2).join('')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ font: '800 14px/1.1 var(--f-display)', color: 'var(--ink)' }}>{d.name}</div>
                    {d.external && <span style={{ padding: '1px 6px', borderRadius: 3, background: 'var(--warning-bg)', color: 'var(--warning)', font: '700 9px/1 var(--f-sans)', letterSpacing: '0.06em' }}>EXTERNO</span>}
                  </div>
                  <div style={{ font: '600 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>★ {d.rating} · {d.exp}a exp · <span style={{ color: disabled ? 'var(--warning)' : needsConfirm ? 'var(--warning)' : 'var(--success)' }}>{d.status}</span></div>
                </div>
              </div>
              {!disabled && (
                <div style={{ display: 'grid', gridTemplateColumns: needsConfirm ? '1fr 1fr' : '1fr auto', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setWaOpen(d)} style={{
                    padding: '10px 12px', background: '#25D366', color: '#fff',
                    border: 0, borderRadius: 'var(--r-md)',
                    font: '700 12.5px/1 var(--f-sans)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>WhatsApp {needsConfirm && '· confirmar'}</button>
                  {!needsConfirm && (
                    <button onClick={() => onPick(d)} style={{
                      padding: '10px 16px', background: 'var(--wine)', color: '#fff',
                      border: 0, borderRadius: 'var(--r-md)',
                      font: '700 12.5px/1 var(--f-sans)',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>Asignar →</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {waOpen && <WhatsAppSheet driver={waOpen} truck={truck} onClose={() => setWaOpen(null)} onAssign={() => { onPick(waOpen); setWaOpen(null); }} />}
    </div>
  );
}

function WhatsAppSheet({ driver, truck, onClose, onAssign }) {
  const [msg, setMsg] = useState(
`Hola ${driver.name.split(' ')[0]}, soy Yusneidy de DTD-Cargo bodega Pto Cabello.

Tenemos un despacho para hoy:

🚛 Camión: ${truck.plate} (${truck.type})
📍 Destino principal: Valencia · ZI Acindar
📦 Carga: ~18 CBM · 4 paradas
⏰ Salida estimada: hoy 07:30

¿Tienes disponibilidad para hacer la ruta?

Maps: https://maps.app.goo.gl/dtd-pbl-valencia`
  );
  const [sent, setSent] = useState(false);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: 18, paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 16px' }} />
        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: '50%', background: '#25D36622', color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>✓</div>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)' }}>WhatsApp enviado</div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: '32ch', margin: '8px auto 0' }}>Esperando confirmación de {driver.name.split(' ')[0]} para asignar.</div>
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <BigButton label="Cerrar" onClick={onClose} variant="secondary" />
              <BigButton label="Asignar igual" onClick={onAssign} variant="success" />
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>💬</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 14px/1.1 var(--f-display)', color: 'var(--ink)' }}>Enviar a {driver.name}</div>
                <code style={{ font: '600 11px/1.2 var(--f-mono)', color: 'var(--ink-soft)' }}>{driver.phone}</code>
              </div>
              {driver.external && <span style={{ padding: '2px 8px', borderRadius: 3, background: 'var(--warning-bg)', color: 'var(--warning)', font: '700 9.5px/1 var(--f-sans)' }}>EXTERNO</span>}
            </div>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={10}
              style={{ width: '100%', padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink)', outline: 'none', resize: 'vertical' }}
            />
            <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--info-bg)', borderRadius: 'var(--r-sm)', font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
              Incluye link de Google Maps con el destino y resumen de la carga. Edita antes de enviar si necesitas.
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <BigButton label="Cancelar" onClick={onClose} variant="secondary" />
              <BigButton label="Enviar WhatsApp" onClick={() => setSent(true)} variant="success" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Step 3 · Elegir items ───────────────────────────────────
function PickItems({ truck, driver, loadout, setLoadout, onBack, onSeal }) {
  // Available items in bodega (ready for delivery)
  const available = [
    { id: 'I-001', shipment: 'DTDU-472816', client: 'Acindar Comercial',  markbox: 'DTD-5452', totalBoxes: 12, totalCBM: 6.4,  addr: 'Valencia · ZI Acindar',     priority: 'alta',  daysWait: 8 },
    { id: 'I-002', shipment: 'DTDU-419032', client: 'Industrias Polar',   markbox: 'DTD-5392', totalBoxes: 80, totalCBM: 28.4, addr: 'Caracas · Plaza Venezuela', priority: 'alta',  daysWait: 12 },
    { id: 'I-003', shipment: 'DTDU-364299', client: 'Vargas & Asoc',      markbox: 'DTD-5298', totalBoxes: 14, totalCBM: 4.8,  addr: 'Maracay · Galpón Norte',     priority: 'media', daysWait: 4 },
    { id: 'I-004', shipment: 'DTDU-401234', client: 'Dist. Andina',        markbox: 'DTD-5340', totalBoxes: 22, totalCBM: 5.2,  addr: 'Valencia · Centro',          priority: 'media', daysWait: 3 },
    { id: 'I-005', shipment: 'DTDU-365044', client: 'Castro Hermanos',     markbox: 'DTD-5354', totalBoxes: 18, totalCBM: 8.2,  addr: 'Pto Cabello · Local',        priority: 'baja',  daysWait: 1 },
  ];

  const [picks, setPicks] = useState({}); // { itemId: { boxes, reason } }
  const [scanOpen, setScanOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState(null);

  const togglePick = (item) => {
    if (picks[item.id]) {
      const n = { ...picks }; delete n[item.id]; setPicks(n);
    } else {
      setPicks({ ...picks, [item.id]: { boxes: item.totalBoxes, reason: null } });
    }
  };

  const setBoxes = (id, b, total) => setPicks({ ...picks, [id]: { ...picks[id], boxes: Math.max(0, Math.min(total, +b || 0)) } });
  const setReason = (id, r) => setPicks({ ...picks, [id]: { ...picks[id], reason: r } });

  const totalLoadedCBM = available.filter(i => picks[i.id]).reduce((s, i) => s + i.totalCBM * (picks[i.id].boxes / i.totalBoxes), 0);
  const usage = (totalLoadedCBM / truck.capCBM) * 100;
  const picksList = available.filter(i => picks[i.id]);
  const partialsNeedingReason = picksList.filter(i => picks[i.id].boxes < i.totalBoxes && !picks[i.id].reason);
  const canSeal = picksList.length > 0 && partialsNeedingReason.length === 0 && usage <= 100;

  const priorityTone = { alta: 'danger', media: 'warning', baja: 'neutral' };
  const reasonOptions = [
    { v: 'capacidad', l: 'Sin capacidad' }, { v: 'dano', l: 'Daño · inspección' }, { v: 'cliente', l: 'Pedido cliente' }, { v: 'sanitario', l: 'Permisos pendientes' }, { v: 'otro', l: 'Otro' },
  ];

  return (
    <div>
      <MobileHeader title="¿Qué cargás?" subtitle={`${truck.plate} · ${driver.name.split(' ')[0]}`} back={onBack} right={<button onClick={() => setScanOpen(true)} style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', color: 'var(--wine)', fontSize: 18 }}>📷</button>} />
      <Steps current={3} labels={['Camión', 'Chofer', 'Items', 'Sellar']} />

      {/* Capacity bar */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ padding: 12, background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em' }}>OCUPACIÓN</span>
            <span style={{ font: '800 14px/1 var(--f-mono)', color: usage > 100 ? 'var(--danger)' : usage > 90 ? 'var(--warning)' : '#7CE3A5' }}>{totalLoadedCBM.toFixed(1)} / {truck.capCBM} CBM · {usage.toFixed(0)}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, usage)}%`, height: '100%', background: usage > 100 ? 'var(--danger)' : usage > 90 ? 'var(--warning)' : 'var(--wine-soft)' }} />
          </div>
          {usage > 100 && <div style={{ marginTop: 6, font: '700 11px/1.3 var(--f-sans)', color: 'var(--warning)' }}>Excede capacidad · marca parciales</div>}
        </div>
      </div>

      {/* Items list */}
      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>DISPONIBLE EN BODEGA · {available.length} ITEMS</div>
        {available.map(item => {
          const picked = !!picks[item.id];
          const p = picks[item.id];
          const isPartial = picked && p.boxes < item.totalBoxes;
          return (
            <div key={item.id} style={{
              padding: 12,
              background: picked ? (isPartial ? 'var(--warning-bg)' : 'var(--success-bg)') : 'var(--bg-surface)',
              border: `1.5px solid ${picked ? (isPartial ? 'var(--warning)' : 'var(--success)') : 'var(--border)'}`,
              borderRadius: 'var(--r-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <button onClick={() => togglePick(item)} style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: picked ? 'var(--success)' : 'var(--bg-elevated)',
                  color: picked ? '#fff' : 'var(--ink-soft)',
                  border: `2px solid ${picked ? 'var(--success)' : 'var(--border-strong)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{picked && '✓'}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{item.shipment}</code>
                    <span style={{ padding: '1px 6px', borderRadius: 3, background: `var(--${priorityTone[item.priority]}-bg)`, color: `var(--${priorityTone[item.priority]})`, font: '700 9px/1 var(--f-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{item.priority}</span>
                    {item.daysWait >= 5 && <span style={{ font: '700 10px/1 var(--f-mono)', color: 'var(--warning)' }}>{item.daysWait}d</span>}
                  </div>
                  <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{item.client}</div>
                  <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{item.addr} · <code style={{ font: '600 10.5px/1 var(--f-mono)' }}>{item.markbox}</code></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{item.totalBoxes}cj</div>
                  <div style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{item.totalCBM} CBM</div>
                </div>
              </div>

              {picked && (
                <>
                  <div style={{ paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cajas:</span>
                    <input type="number" value={p.boxes} onChange={(e) => setBoxes(item.id, e.target.value, item.totalBoxes)} inputMode="numeric"
                      style={{ width: 70, height: 36, padding: '0 10px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: '800 16px/1 var(--f-mono)', color: 'var(--ink)', outline: 'none' }}
                    />
                    <span style={{ font: '600 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>/ {item.totalBoxes}</span>
                    <button onClick={() => setBoxes(item.id, item.totalBoxes, item.totalBoxes)} style={{ marginLeft: 'auto', font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', padding: '4px 8px' }}>Todo →</button>
                  </div>

                  {isPartial && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.6)', borderRadius: 'var(--r-sm)' }}>
                      <div style={{ font: '700 11px/1.3 var(--f-sans)', color: 'var(--warning)', marginBottom: 4 }}>
                        Parcial · {p.boxes}/{item.totalBoxes} · resta como <code style={{ font: '700 10px/1 var(--f-mono)' }}>{item.shipment}-P2</code>
                      </div>
                      <button onClick={() => setReasonOpen(reasonOpen === item.id ? null : item.id)} style={{ padding: '4px 9px', borderRadius: 'var(--r-sm)', background: p.reason ? 'var(--success-bg)' : 'var(--wine)', color: p.reason ? 'var(--success)' : '#fff', font: '700 11px/1 var(--f-sans)' }}>
                        {p.reason ? `✓ ${reasonOptions.find(r => r.v === p.reason)?.l}` : 'Motivo →'}
                      </button>
                      {reasonOpen === item.id && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {reasonOptions.map(r => (
                            <button key={r.v} onClick={() => { setReason(item.id, r.v); setReasonOpen(null); }} style={{ padding: '8px 10px', borderRadius: 'var(--r-sm)', textAlign: 'left', background: p.reason === r.v ? 'var(--wine-tint)' : '#fff', border: `1px solid ${p.reason === r.v ? 'var(--wine)' : 'var(--border)'}`, font: `${p.reason === r.v ? '700' : '500'} 12px/1.2 var(--f-sans)`, color: 'var(--ink)' }}>{r.l}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Scanner modal */}
      {scanOpen && (
        <div onClick={() => setScanOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 320, aspectRatio: '1', background: 'var(--ink)', borderRadius: 'var(--r-md)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 30, border: '3px solid var(--wine-soft)', borderRadius: 8 }} />
            <div style={{ position: 'absolute', left: 30, right: 30, top: '50%', height: 2, background: 'var(--wine)', boxShadow: '0 0 16px var(--wine)', animation: 'erp-shimmer 2s infinite linear' }} />
            <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', font: '700 12px/1 var(--f-sans)', color: '#fff' }}>Escanea el QR del bulto</div>
          </div>
        </div>
      )}

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', background: 'var(--bg-base)', borderTop: '1px solid var(--border)', maxWidth: 480, margin: '0 auto' }}>
        <BigButton label={`🔒 Sellar camión · ${picksList.length} clientes`} onClick={onSeal} disabled={!canSeal} variant="success" />
      </div>
    </div>
  );
}

// ── Step 4 · Handoff (QR para chofer) ───────────────────────
function Handoff({ truck, driver, loadout, onDone }) {
  const sealId = `CARGA-2026-${1042 + Math.floor(Math.random() * 100)}`;
  return (
    <div>
      <MobileHeader title="Pase al chofer" subtitle={truck.plate} />
      <Steps current={4} labels={['Camión', 'Chofer', 'Items', 'Sellar']} />
      <div style={{ padding: '0 16px 100px', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, margin: '0 auto 18px' }}>🔒</div>
        <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Camión sellado</div>
        <code style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--wine)', display: 'block', marginTop: 8 }}>{sealId}</code>
        <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 14, maxWidth: '36ch', margin: '14px auto 0' }}>
          Mostrale este QR a <b>{driver.name}</b> para que reciba la carga sellada en su teléfono.
        </div>

        {/* QR code mock */}
        <div style={{ width: 220, height: 220, margin: '24px auto', background: '#fff', border: '2px solid var(--ink)', borderRadius: 'var(--r-md)', padding: 12, position: 'relative' }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
            {Array.from({ length: 100 }).map((_, i) => {
              const x = (i % 10) * 10;
              const y = Math.floor(i / 10) * 10;
              const fill = ((i * 7) % 13 < 6) || (i < 3 || i > 96) || (i % 10 === 0 || i % 10 === 9);
              return fill ? <rect key={i} x={x} y={y} width="10" height="10" fill="#0F1E3D" /> : null;
            })}
            <rect x="0" y="0" width="30" height="30" fill="#fff" />
            <rect x="5" y="5" width="20" height="20" fill="#0F1E3D" />
            <rect x="10" y="10" width="10" height="10" fill="#fff" />
            <rect x="70" y="0" width="30" height="30" fill="#fff" />
            <rect x="75" y="5" width="20" height="20" fill="#0F1E3D" />
            <rect x="80" y="10" width="10" height="10" fill="#fff" />
            <rect x="0" y="70" width="30" height="30" fill="#fff" />
            <rect x="5" y="75" width="20" height="20" fill="#0F1E3D" />
            <rect x="10" y="80" width="10" height="10" fill="#fff" />
          </svg>
        </div>

        <div style={{ padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', textAlign: 'left' }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>RESUMEN DE LA CARGA</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Camión</span>
            <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{truck.plate}</code>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Chofer</span>
            <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{driver.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Sellado</span>
            <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>23 may · 06:42</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Sello</span>
            <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{sealId}</code>
          </div>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', background: 'var(--bg-base)', borderTop: '1px solid var(--border)', maxWidth: 480, margin: '0 auto' }}>
        <BigButton label="✓ Listo · volver a Mi día" onClick={onDone} variant="success" />
      </div>
    </div>
  );
}

window.BodegueroApp = BodegueroApp;

// ── Reception list ─────────────────────────────────
function ReceptionList({ onPick, onBack }) {
  const containers = [
    { id: 'DTDU-419032', vessel: 'MSC TIANSHAN', port: 'PBL', eta: 'Arribó 06:30', cbm: 68.2, expectedBoxes: 142, clients: 3, status: 'en muelle' },
    { id: 'DTDU-388501', vessel: 'COSCO PISCES', port: 'PBL', eta: '14:00 hoy',     cbm: 64.8, expectedBoxes: 124, clients: 2, status: 'esperando' },
  ];
  return (
    <div>
      <MobileHeader title="Recibir contenedor" subtitle={`${containers.length} contenedores hoy`} back={onBack} />
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {containers.map(c => (
          <button key={c.id} onClick={() => c.status === 'en muelle' && onPick(c)} disabled={c.status !== 'en muelle'} style={{
            padding: 16, textAlign: 'left',
            background: 'var(--bg-surface)',
            border: '1.5px solid var(--border)',
            borderLeft: `4px solid ${c.status === 'en muelle' ? 'var(--wine)' : 'var(--warning)'}`,
            borderRadius: 'var(--r-md)',
            opacity: c.status === 'en muelle' ? 1 : 0.6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <code style={{ font: '900 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{c.id}</code>
              <span style={{ padding: '3px 8px', borderRadius: 3, background: c.status === 'en muelle' ? 'var(--success)' : 'var(--warning)', color: '#fff', font: '700 9.5px/1 var(--f-sans)' }}>{c.status === 'en muelle' ? '✓ LISTO' : c.eta}</span>
            </div>
            <div style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{c.vessel}</div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              <div><div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Cajas</div><div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{c.expectedBoxes}</div></div>
              <div><div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>CBM</div><div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{c.cbm}</div></div>
              <div><div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Clientes</div><div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{c.clients}</div></div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Reception scan ──────────────────────────────────
function ReceptionScan({ container, onBack, onDone }) {
  const [scanned, setScanned] = useState({});
  const [scanOpen, setScanOpen] = useState(false);
  const [reportIncident, setReportIncident] = useState(false);
  const [groupPrompt, setGroupPrompt] = useState(null); // { client, boxes, remaining }

  // Mock expected boxes from manifiesto
  const expectedBoxes = [
    { id: 'B-001', code: 'DTDU-419032-001', markbox: 'DTD-5392', client: 'Polar',    cbm: 0.48 },
    { id: 'B-002', code: 'DTDU-419032-002', markbox: 'DTD-5392', client: 'Polar',    cbm: 0.48 },
    { id: 'B-003', code: 'DTDU-419032-003', markbox: 'DTD-5392', client: 'Polar',    cbm: 0.48 },
    { id: 'B-004', code: 'DTDU-419032-004', markbox: 'DTD-5298', client: 'Vargas',   cbm: 0.40 },
    { id: 'B-005', code: 'DTDU-419032-005', markbox: 'DTD-5298', client: 'Vargas',   cbm: 0.40 },
    { id: 'B-006', code: 'DTDU-419032-006', markbox: 'DTD-5298', client: 'Vargas',   cbm: 0.40 },
    { id: 'B-007', code: 'DTDU-419032-007', markbox: 'DTD-5340', client: 'Andina',   cbm: 0.36 },
    { id: 'B-008', code: 'DTDU-419032-008', markbox: 'DTD-5340', client: 'Andina',   cbm: 0.36 },
  ];
  const expectedCBM = expectedBoxes.reduce((s, b) => s + b.cbm, 0);
  const scannedBoxes = expectedBoxes.filter(b => scanned[b.id]);
  const scannedCBM = scannedBoxes.reduce((s, b) => s + b.cbm, 0);
  const progress = (scannedBoxes.length / expectedBoxes.length) * 100;
  const missingCount = expectedBoxes.length - scannedBoxes.length;

  const simulateScan = () => {
    const next = expectedBoxes.find(b => !scanned[b.id]);
    if (!next) return;
    setScanned(prev => ({ ...prev, [next.id]: true }));
    // ¿El bulto escaneado pertenece a un grupo con más cajas pendientes?
    const groupBoxes = expectedBoxes.filter(b => b.client === next.client);
    const remaining = groupBoxes.filter(b => b.id !== next.id && !scanned[b.id]);
    if (remaining.length > 0) {
      setGroupPrompt({ client: next.client, markbox: groupBoxes[0].markbox, total: groupBoxes.length, remaining });
    }
  };

  const confirmGroup = () => {
    if (!groupPrompt) return;
    setScanned(prev => {
      const next = { ...prev };
      groupPrompt.remaining.forEach(b => { next[b.id] = true; });
      return next;
    });
    setGroupPrompt(null);
  };

  // Group by client
  const byClient = {};
  expectedBoxes.forEach(b => { if (!byClient[b.client]) byClient[b.client] = []; byClient[b.client].push(b); });

  return (
    <div>
      <MobileHeader title={container.id} subtitle={container.vessel} back={onBack} right={<button onClick={() => setScanOpen(true)} style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', color: 'var(--wine)', fontSize: 18 }}>📷</button>} />

      {/* Progress hero */}
      <div style={{ padding: '0 16px 12px' }}>
        <div style={{ padding: 16, background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>RECIBIDAS</div>
              <div style={{ font: '900 28px/1 var(--f-mono)', color: '#fff', marginTop: 8 }}>{scannedBoxes.length} / {expectedBoxes.length}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>CBM</div>
              <div style={{ font: '900 18px/1 var(--f-mono)', color: '#fff', marginTop: 8 }}>{scannedCBM.toFixed(1)} / {expectedCBM.toFixed(1)}</div>
            </div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: progress === 100 ? '#7CE3A5' : 'var(--wine-soft)', borderRadius: 999, transition: 'width var(--dur) var(--ease)' }} />
          </div>
          {missingCount > 0 && progress < 100 && (
            <div style={{ marginTop: 10, font: '500 12px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)' }}>Faltan {missingCount} cajas · escanéa el QR de cada bulto</div>
          )}
          {progress === 100 && (
            <div style={{ marginTop: 10, font: '700 13px/1.2 var(--f-sans)', color: '#7CE3A5' }}>✓ Contenedor completo · listo para sellar recepción</div>
          )}
        </div>
      </div>

      {/* Scan button */}
      <div style={{ padding: '0 16px 12px' }}>
        <BigButton label="📷 Escanear próxima caja" onClick={() => { setScanOpen(true); setTimeout(() => { simulateScan(); setScanOpen(false); }, 1200); }} disabled={missingCount === 0} />
      </div>

      {/* Boxes grouped by client */}
      <div style={{ padding: '0 16px 100px' }}>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>CAJAS POR CLIENTE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(byClient).map(([client, boxes]) => {
            const scannedInGroup = boxes.filter(b => scanned[b.id]).length;
            return (
              <div key={client} style={{ padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>{client}</div>
                    <code style={{ font: '600 11px/1.2 var(--f-mono)', color: 'var(--ink-mute)' }}>{boxes[0].markbox}</code>
                  </div>
                  <div style={{ font: '800 14px/1 var(--f-mono)', color: scannedInGroup === boxes.length ? 'var(--success)' : 'var(--ink)' }}>{scannedInGroup}/{boxes.length}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {boxes.map(b => (
                    <div key={b.id} style={{
                      padding: '6px 4px', textAlign: 'center', borderRadius: 'var(--r-sm)',
                      background: scanned[b.id] ? 'var(--success-bg)' : 'var(--bg-elevated)',
                      border: `1px solid ${scanned[b.id] ? 'var(--success)' : 'var(--border)'}`,
                      font: '700 9.5px/1.2 var(--f-mono)', color: scanned[b.id] ? 'var(--success)' : 'var(--ink-mute)',
                    }}>{scanned[b.id] ? '✓' : '▯'}<br/>{b.id.slice(-3)}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Incident toggle */}
        <button onClick={() => setReportIncident(!reportIncident)} style={{
          marginTop: 14, width: '100%', padding: '12px 14px',
          background: reportIncident ? 'var(--danger-bg)' : 'var(--bg-elevated)',
          border: `1px solid ${reportIncident ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
        }}>
          <input type="checkbox" checked={reportIncident} readOnly style={{ accentColor: 'var(--danger)', width: 18, height: 18 }} />
          <span style={{ flex: 1, font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Reportar caja faltante / dañada</span>
        </button>
      </div>

      {/* Scanner modal */}
      {scanOpen && (
        <div onClick={() => setScanOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 320, aspectRatio: '1', background: 'var(--ink)', borderRadius: 'var(--r-md)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 30, border: '3px solid var(--wine-soft)', borderRadius: 8 }} />
            <div style={{ position: 'absolute', left: 30, right: 30, top: '50%', height: 2, background: 'var(--wine)', boxShadow: '0 0 16px var(--wine)', animation: 'erp-shimmer 2s infinite linear' }} />
            <div style={{ position: 'absolute', bottom: 20, left: 0, right: 0, textAlign: 'center', font: '700 12px/1 var(--f-sans)', color: '#fff' }}>Escaneando QR del bulto…</div>
          </div>
        </div>
      )}

      {/* Group-scan confirm sheet */}
      {groupPrompt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 120, display: 'flex', alignItems: 'flex-end' }} onClick={() => setGroupPrompt(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--bg-base)', borderRadius: '20px 20px 0 0', padding: '22px 18px',
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)', boxShadow: '0 -8px 32px rgba(0,0,0,0.25)',
          }}>
            <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', display: 'grid', placeItems: 'center', font: '900 20px/1 var(--f-mono)', flexShrink: 0 }}>{groupPrompt.total}</div>
              <div>
                <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)' }}>¿Mandar el grupo completo?</div>
                <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                  {groupPrompt.client} · <code style={{ font: '600 11px/1 var(--f-mono)' }}>{groupPrompt.markbox}</code>
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', marginBottom: 16, font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
              Escaneaste 1 bulto de este cliente. Quedan <b>{groupPrompt.remaining.length} cajas</b> del mismo grupo. ¿Las marco todas como recibidas sin escanear una por una?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
              <button onClick={() => setGroupPrompt(null)} style={{
                padding: '14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)',
                font: '700 13px/1 var(--f-sans)', color: 'var(--ink-soft)', cursor: 'pointer',
              }}>No, una por una</button>
              <button onClick={confirmGroup} style={{
                padding: '14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--wine)',
                font: '700 13px/1 var(--f-sans)', color: '#fff', cursor: 'pointer',
              }}>Sí, mandar {groupPrompt.total} cajas</button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom action */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', background: 'var(--bg-base)', borderTop: '1px solid var(--border)', maxWidth: 480, margin: '0 auto' }}>
        <BigButton label={progress === 100 ? '✓ Sellar recepción' : `Sellar con ${missingCount} faltantes`} onClick={onDone} variant="success" disabled={scannedBoxes.length === 0} />
      </div>
    </div>
  );
}

// ── Flujos reutilizables para el shell multi-rol ─────────────
// Exponen los sub-flujos de Recepción y Despacho SIN el login/home
// propios de BodegueroApp, para incrustarlos en otra app
// (p. ej. Operario Multi). onExit vuelve al home del modo.
function ReceptionFlow({ onExit }) {
  const [view, setView] = useState('list');
  const [container, setContainer] = useState(null);
  if (view === 'scan') return <ReceptionScan container={container} onBack={() => setView('list')} onDone={onExit} />;
  return <ReceptionList onPick={(c) => { setContainer(c); setView('scan'); }} onBack={onExit} />;
}

function DispatchFlow({ onExit }) {
  const [view, setView] = useState('truck');
  const [truck, setTruck] = useState(null);
  const [driver, setDriver] = useState(null);
  const [loadout, setLoadout] = useState({ items: [], sealed: false });
  if (view === 'driver')  return <PickDriver truck={truck} onPick={(d) => { setDriver(d); setView('items'); }} onBack={() => setView('truck')} />;
  if (view === 'items')   return <PickItems truck={truck} driver={driver} loadout={loadout} setLoadout={setLoadout} onBack={() => setView('driver')} onSeal={() => setView('handoff')} />;
  if (view === 'handoff') return <Handoff truck={truck} driver={driver} loadout={loadout} onDone={onExit} />;
  return <PickTruck onPick={(t) => { setTruck(t); setView('driver'); }} onBack={onExit} />;
}

window.BodegueroFlows = { ReceptionFlow, DispatchFlow };
