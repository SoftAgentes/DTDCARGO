/* global React */
/* ── DTD Portal del Cliente · App ──────────────────────────── */
/* Vista que ve el cliente externo (no admin DTD).            */
/* Reusa tokens + componentes del ERP.                         */

const { useState: pUseState, useEffect: pUseEffect } = React;

// Quién es el cliente "logueado" en este mock
const DEMO_MARKBOX = 'DTD-5452';

function PortalApp() {
  const D = window.ERPData;
  const [logged, setLogged] = pUseState(false);
  const [view, setView] = pUseState('home');
  const [detail, setDetail] = pUseState(null);
  const [theme, setTheme] = pUseState('light');

  pUseEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  if (!logged) return <PortalLogin onLogin={() => setLogged(true)} />;

  const me = D.CLIENTS.find(c => c.markbox === DEMO_MARKBOX);
  const myShipments = D.SHIPMENTS.filter(s => s.client === DEMO_MARKBOX);
  const myInvoices = D.INVOICES.filter(i => i.client === DEMO_MARKBOX);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--ink)' }}>
      <PortalTopbar
        me={me}
        view={view} setView={(v) => { setView(v); setDetail(null); }}
        onLogout={() => setLogged(false)}
        theme={theme} setTheme={setTheme}
      />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--s-8) var(--s-6)' }}>
        <div key={view + (detail || '')} style={{ animation: 'erp-route-in 240ms var(--ease)' }}>
          {view === 'home' && <PortalHome me={me} ships={myShipments} invs={myInvoices} setView={setView} setDetail={setDetail} />}
          {view === 'shipments' && !detail && <PortalShipments ships={myShipments} setDetail={setDetail} />}
          {view === 'shipments' && detail && <PortalShipmentDetail id={detail} onBack={() => setDetail(null)} />}
          {view === 'invoices' && <PortalInvoices invs={myInvoices} />}
          {view === 'documents' && <PortalDocuments />}
          {view === 'support' && <PortalSupport />}
          {view === 'profile' && <PortalProfile me={me} />}
        </div>
      </main>

      <PortalFooter />
    </div>
  );
}

// ── Login ────────────────────────────────────────────────────
function PortalLogin({ onLogin }) {
  const [markbox, setMarkbox] = pUseState(DEMO_MARKBOX);
  const [pw, setPw] = pUseState('');
  const [showHelp, setShowHelp] = pUseState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 50%, #0B1428 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative pattern */}
      <svg style={{ position: 'absolute', top: 0, right: 0, opacity: 0.06, pointerEvents: 'none' }} width="500" height="500" viewBox="0 0 500 500">
        <g fill="none" stroke="#fff" strokeWidth="1">
          {[...Array(20)].map((_,i) => <circle key={i} cx="250" cy="250" r={20 + i*22} />)}
        </g>
      </svg>

      <div style={{ width: '100%', maxWidth: 980, display: 'grid', gridTemplateColumns: '1fr 420px', gap: 0, borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-pop)', position: 'relative' }}>
        {/* Left panel — branding */}
        <div style={{ padding: 44, color: '#fff', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <PortalLogo white />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>PORTAL DEL CLIENTE</div>
            <div style={{ font: '900 38px/1 var(--f-display)', color: '#fff', letterSpacing: '-0.025em' }}>
              Tus envíos<br/>desde China,<br/><span style={{ color: 'var(--wine-soft)' }}>en un click.</span>
            </div>
            <div style={{ marginTop: 22, font: '500 14px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.7)', maxWidth: '36ch' }}>
              Cotizá, embarcá y rastreá tus cargas DDP. Facturas, documentos y soporte directo con tu agente.
            </div>
            <div style={{ marginTop: 28, display: 'flex', gap: 18 }}>
              {[
                { v: '99.4%', l: 'On-time' },
                { v: '8.2K', l: 'Cargas/año' },
                { v: '38d', l: 'Tránsito' },
              ].map(s => (
                <div key={s.l}>
                  <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--wine-soft)', letterSpacing: '-0.02em' }}>{s.v}</div>
                  <div style={{ font: '500 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ font: '500 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.35)' }}>DTDCARGO.COM · v1.0 · 2026</div>
        </div>

        {/* Right panel — login form */}
        <div style={{ background: 'var(--bg-surface)', padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Entrá con tu<br/>MARKBOX.</div>
          <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>Es el código que se anota en tus cajas en China.</div>

          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Código MARKBOX</span>
              <input
                value={markbox} onChange={(e) => setMarkbox(e.target.value)}
                placeholder="DTD-XXXX"
                style={{
                  height: 48, padding: '0 14px',
                  background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  font: '800 16px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '0.06em',
                  outline: 'none', textTransform: 'uppercase',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--wine)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Contraseña</span>
              <input
                type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                placeholder="••••••••••"
                style={{
                  height: 48, padding: '0 14px',
                  background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  font: '600 14px/1 var(--f-mono)', color: 'var(--ink)',
                  outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--wine)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </label>
            <button onClick={onLogin} style={{
              height: 48, background: 'var(--wine)', color: '#fff',
              border: 0, borderRadius: 'var(--r-md)',
              font: '700 14px/1 var(--f-sans)', letterSpacing: '0.02em',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 6,
            }}>
              Entrar al portal {window.Icon.arrowR(14)}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 12px/1 var(--f-sans)' }}>
              <a style={{ color: 'var(--wine)', cursor: 'pointer' }}>¿Olvidaste tu contraseña?</a>
              <a style={{ color: 'var(--ink-soft)', cursor: 'pointer' }} onClick={() => setShowHelp(v=>!v)}>¿No tenés MARKBOX?</a>
            </div>
            {showHelp && (
              <div style={{ marginTop: 8, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
                  Solicitá tu MARKBOX en <a style={{ color: 'var(--wine)', fontWeight: 700 }}>dtdcargo.com/registro</a> o por WhatsApp al +58 412 DTD-CARG.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Topbar ───────────────────────────────────────────────────
function PortalTopbar({ me, view, setView, onLogout, theme, setTheme }) {
  const [userOpen, setUserOpen] = pUseState(false);
  const items = [
    { v: 'home',      l: 'Inicio',     icon: 'dashboard' },
    { v: 'shipments', l: 'Mis envíos', icon: 'box' },
    { v: 'invoices',  l: 'Facturas',   icon: 'invoice' },
    { v: 'documents', l: 'Documentos', icon: 'doc' },
    { v: 'support',   l: 'Soporte',    icon: 'mail' },
  ];

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 var(--s-6)',
        display: 'flex', alignItems: 'center', gap: 32, height: 72,
      }}>
        <PortalLogo />
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {items.map(it => (
            <button key={it.v} onClick={() => setView(it.v)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 'var(--r-md)',
              background: view === it.v ? 'var(--wine-tint)' : 'transparent',
              color: view === it.v ? 'var(--wine)' : 'var(--ink-soft)',
              font: `${view === it.v ? '700' : '500'} 13px/1 var(--f-sans)`,
              transition: 'all var(--dur-fast) var(--ease)',
            }}
            onMouseEnter={(e) => { if (view !== it.v) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
            onMouseLeave={(e) => { if (view !== it.v) e.currentTarget.style.background = 'transparent'; }}
            >
              {window.Icon[it.icon](14)} {it.l}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{
            width: 36, height: 36, borderRadius: 'var(--r-md)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-soft)',
          }}>{theme === 'dark' ? window.Icon.sun(15) : window.Icon.moon(15)}</button>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setUserOpen(v => !v)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 12px 4px 4px', borderRadius: 'var(--r-pill)',
              background: 'var(--bg-elevated)', marginLeft: 6,
            }}>
              <window.ERPUI.Avatar initials={me.name.split(' ').map(w=>w[0]).slice(0,2).join('')} size={30} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{me.name}</div>
                <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{me.markbox}</code>
              </div>
              <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.chevD(12)}</span>
            </button>
            {userOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: 240, background: 'var(--bg-surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
                boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
                animation: 'erp-pop 200ms var(--ease)',
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{me.name}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{me.email}</div>
                </div>
                <div style={{ padding: 6 }}>
                  <button onClick={() => { setView('profile'); setUserOpen(false); }} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', font: '500 13px/1 var(--f-sans)', color: 'var(--ink)' }}>Mi perfil</button>
                  <button style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', font: '500 13px/1 var(--f-sans)', color: 'var(--ink)' }}>Cambiar contraseña</button>
                </div>
                <div style={{ padding: 6, borderTop: '1px solid var(--border)' }}>
                  <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', font: '600 13px/1 var(--f-sans)', color: 'var(--danger)' }}>Cerrar sesión</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function PortalLogo({ white }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img src={window.__resources?.dtdIcon || 'assets/dtdcargo-icon-navy.png'} alt="DTD-Cargo"
        style={{
          width: 32, height: 32, objectFit: 'contain',
          filter: white ? 'brightness(0) invert(1)' : 'none',
        }}
      />
      <div style={{ font: '900 19px/1 var(--f-display)', letterSpacing: '-0.02em' }}>
        <span style={{ color: white ? '#C2747F' : 'var(--wine)' }}>DTD</span>
        <span style={{ color: white ? '#fff' : 'var(--ink)' }}>CARGO</span>
      </div>
    </div>
  );
}

// ── Home / Dashboard del cliente ─────────────────────────────
function PortalHome({ me, ships, invs, setView, setDetail }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const active = ships.filter(s => !['entregado','cotizado'].includes(s.status));
  const inTransit = ships.find(s => s.status === 'tránsito') || active[0];
  const outstanding = invs.reduce((s,i) => s+i.balance, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--s-8)' }}>
        <div>
          <div className="eyebrow eyebrow-wine">{new Date().toLocaleDateString('es-VE', { weekday:'long', day:'numeric', month:'long' })}</div>
          <h1 style={{ font: '900 38px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em', margin: '8px 0 6px' }}>Hola {me.name.split(' ')[0]}.</h1>
          <p style={{ font: '500 15px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}>
            {active.length} envíos activos · {invs.filter(i=>i.balance>0).length} {invs.filter(i=>i.balance>0).length === 1 ? 'factura pendiente' : 'facturas pendientes'}
          </p>
        </div>
        <window.ERPUI.Btn variant="primary" icon={window.Icon.plus(14)}>Nueva cotización</window.ERPUI.Btn>
      </div>

      {/* Hero card: next arrival */}
      {inTransit && (
        <U.Card style={{ marginBottom: 'var(--s-6)', padding: 0, overflow: 'hidden', background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', color: '#fff', border: 0, cursor: 'pointer' }}
          onClick={() => { setView('shipments'); setDetail(inTransit.id); }}
        >
          <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28, alignItems: 'center' }}>
            <div>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>PRÓXIMO ARRIBO</div>
              <code style={{ font: '900 28px/1.1 var(--f-mono)', color: '#fff', display: 'block', marginTop: 12, letterSpacing: '-0.01em' }}>{inTransit.id}</code>
              <div style={{ marginTop: 10, font: '500 14px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.7)' }}>
                {D.origin(inTransit.origin).name} <span style={{ color: 'var(--wine-soft)' }}>→</span> {D.dest(inTransit.destination).name} · {inTransit.vessel}
              </div>
              <div style={{ marginTop: 20, display: 'flex', gap: 28 }}>
                <div>
                  <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>ETA</div>
                  <div style={{ font: '900 22px/1 var(--f-display)', color: '#fff', marginTop: 6 }}>{inTransit.eta}</div>
                </div>
                <div>
                  <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Progreso</div>
                  <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--wine-soft)', marginTop: 6 }}>{inTransit.progress}%</div>
                </div>
                <div>
                  <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Tipo</div>
                  <div style={{ font: '900 22px/1 var(--f-display)', color: '#fff', marginTop: 6 }}>{inTransit.type}</div>
                </div>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <svg viewBox="0 0 320 200" style={{ width: '100%', height: 200 }}>
                <path d="M 30 100 Q 160 30 290 100" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="4 4" />
                <path d={`M 30 100 Q 160 30 ${30 + 260 * (inTransit.progress/100)} ${100 - 70 * Math.sin(Math.PI * (inTransit.progress/100))}`} fill="none" stroke="var(--wine-soft)" strokeWidth="3" />
                <circle cx="30" cy="100" r="8" fill="#fff" />
                <circle cx="290" cy="100" r="8" fill="var(--wine)" />
                <g transform={`translate(${30 + 260 * (inTransit.progress/100)}, ${100 - 70 * Math.sin(Math.PI * (inTransit.progress/100))})`}>
                  <circle r="22" fill="var(--wine-soft)" opacity="0.2">
                    <animate attributeName="r" values="22;32;22" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <circle r="10" fill="var(--wine)" stroke="#fff" strokeWidth="2.5" />
                </g>
                <text x="30" y="130" fontFamily="Archivo Black" fontSize="11" fill="rgba(255,255,255,0.8)" textAnchor="middle">{D.origin(inTransit.origin).name}</text>
                <text x="290" y="130" fontFamily="Archivo Black" fontSize="11" fill="rgba(255,255,255,0.8)" textAnchor="middle">{D.dest(inTransit.destination).name}</text>
              </svg>
            </div>
          </div>
        </U.Card>
      )}

      {/* KPIs row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Envíos activos" value={active.length} delta="en curso" tone="wine" icon={window.Icon.box(18)} />
        <U.KPI label="Entregados YTD" value={ships.filter(s=>s.status==='entregado').length} delta="100% on-time" tone="success" icon={window.Icon.check(18)} />
        <U.KPI label="Facturado" value={`$${(invs.reduce((s,i)=>s+i.amount,0)/1000).toFixed(0)}K`} sub="2026 acumulado" tone="info" icon={window.Icon.invoice(18)} />
        <U.KPI label="Saldo pendiente" value={`$${(outstanding/1000).toFixed(1)}K`} delta={outstanding > 0 ? 'pagar' : 'al día'} tone={outstanding > 0 ? 'warning' : 'success'} icon={window.Icon.clock(18)} />
      </div>

      {/* Two col */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Active shipments */}
        <U.Card padded={false}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)' }}>Tus envíos</div>
              <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{active.length} en curso · ordenados por ETA</div>
            </div>
            <button onClick={() => setView('shipments')} style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Ver todos {window.Icon.arrowR(11)}
            </button>
          </div>
          {ships.slice(0, 5).map((s, i) => (
            <div key={s.id} onClick={() => { setView('shipments'); setDetail(s.id); }} style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 100px 110px',
              gap: 14, padding: '14px 20px',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
              alignItems: 'center', cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
              <div>
                <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.origin(s.origin).name} → {D.dest(s.destination).name}</div>
                <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{s.type} · {s.cbm} CBM</div>
              </div>
              <window.ERPUI.StatusBadge status={s.status} size="sm" />
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>ETA</div>
                <div style={{ font: '700 12.5px/1 var(--f-mono)', color: s.alert ? 'var(--warning)' : 'var(--ink)', marginTop: 4 }}>{s.eta || '—'}</div>
              </div>
            </div>
          ))}
        </U.Card>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {outstanding > 0 && (
            <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>SALDO PENDIENTE</div>
              <div style={{ font: '900 28px/1 var(--f-display)', color: 'var(--wine)', letterSpacing: '-0.02em', marginTop: 6 }}>${outstanding.toLocaleString()}</div>
              <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{invs.filter(i=>i.balance>0).length} {invs.filter(i=>i.balance>0).length === 1 ? 'factura por pagar' : 'facturas por pagar'}</div>
              <button onClick={() => setView('invoices')} style={{ marginTop: 14, padding: '10px 14px', background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-md)', font: '700 12.5px/1 var(--f-sans)', width: '100%' }}>Ver facturas →</button>
            </U.Card>
          )}

          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>TU AGENTE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <U.Avatar initials="MA" color="wine" size={48} />
              <div>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Martina Acuña</div>
                <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Account Director · LATAM</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', font: '600 12px/1 var(--f-mono)', color: 'var(--ink)' }}>
                {window.Icon.mail(13)} martina@dtdcargo.com
              </a>
              <a style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', font: '600 12px/1 var(--f-mono)', color: 'var(--ink)' }}>
                {window.Icon.globe(13)} +58 412 166 8021
              </a>
            </div>
            <button onClick={() => setView('support')} style={{ marginTop: 12, width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '600 12px/1 var(--f-sans)', color: 'var(--ink)' }}>
              Abrir chat de soporte
            </button>
          </U.Card>

          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>ACTIVIDAD</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { t: 'DTDU-472816 cruzó Canal de Panamá', m: 'hace 3 min', c: 'var(--wine)' },
                { t: 'Factura F-2026-0432 emitida',         m: 'hace 4 h',  c: 'var(--info)' },
                { t: 'DTDU-388157 entregado · POD adjunto', m: 'ayer 16:42', c: 'var(--success)' },
              ].map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: a.c }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '600 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{a.t}</div>
                    <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{a.m}</div>
                  </div>
                </div>
              ))}
            </div>
          </U.Card>
        </div>
      </div>
    </div>
  );
}

// ── Mis envíos ──────────────────────────────────────────────
function PortalShipments({ ships, setDetail }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [tab, setTab] = pUseState('all');
  const [search, setSearch] = pUseState('');

  const filtered = ships.filter(s => {
    if (tab === 'active' && ['entregado','cotizado'].includes(s.status)) return false;
    if (tab === 'delivered' && s.status !== 'entregado') return false;
    if (search && !s.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Mis envíos</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>{ships.length} embarques totales · {ships.filter(s => !['entregado','cotizado'].includes(s.status)).length} en curso</p>

      <U.Tabs value={tab} onChange={setTab} items={[
        { value: 'all',       label: 'Todos',      count: ships.length },
        { value: 'active',    label: 'En curso',   count: ships.filter(s => !['entregado','cotizado'].includes(s.status)).length },
        { value: 'delivered', label: 'Entregados', count: ships.filter(s => s.status === 'entregado').length },
      ]} style={{ marginBottom: 'var(--s-5)' }} />

      <U.Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Buscar por ID de embarque…" />

      {filtered.length === 0 ? (
        <U.EmptyState icon={window.Icon.box(22)} title="Sin envíos" body="No tenés embarques en esta vista." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {filtered.map(s => (
            <U.Card key={s.id} hoverable onClick={() => setDetail(s.id)} style={{ padding: 18, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <code style={{ font: '900 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
                <window.ERPUI.StatusBadge status={s.status} size="sm" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.origin(s.origin).name}</span>
                <span style={{ color: 'var(--wine)' }}>→</span>
                <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.dest(s.destination).name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <U.Badge tone="neutral" size="sm">{s.type}</U.Badge>
                <span style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{s.cbm} CBM</span>
                {s.alert && <U.Badge tone="warning" size="sm" dot>alerta</U.Badge>}
              </div>
              <U.Progress value={s.progress} tone={s.alert ? 'warning' : 'wine'} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
                <span>{s.progress}%</span>
                <span>ETA {s.eta || '—'}</span>
              </div>
            </U.Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Detalle de un envío ─────────────────────────────────────
function PortalShipmentDetail({ id, onBack }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const s = D.SHIPMENTS.find(x => x.id === id);
  if (!s) return null;
  const flow = D.STATUS_FLOW;
  const cur = flow.indexOf(s.status);

  return (
    <div>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14 }}>
        {window.Icon.arrowL(12)} Volver a mis envíos
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--s-6)' }}>
        <div>
          <code style={{ font: '900 28px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{s.id}</code>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ font: '700 15px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.origin(s.origin).name}</span>
            <span style={{ color: 'var(--wine)' }}>→</span>
            <span style={{ font: '700 15px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.dest(s.destination).name}</span>
            <U.Badge tone="neutral" size="md">{s.type}</U.Badge>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <U.Btn variant="secondary" icon={window.Icon.download(14)}>Descargar docs</U.Btn>
          <U.Btn variant="primary" icon={window.Icon.mail(14)}>Contactar agente</U.Btn>
        </div>
      </div>

      {s.alert && (
        <U.Card padded style={{ marginBottom: 'var(--s-6)', background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(18)}</span>
            <div>
              <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Aviso</div>
              <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{s.alert}. Tu agente ya está siguiendo el caso.</div>
            </div>
          </div>
        </U.Card>
      )}

      {/* Timeline */}
      <U.Card padded style={{ marginBottom: 'var(--s-6)' }}>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 22 }}>SEGUIMIENTO</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${flow.length}, 1fr)`, position: 'relative' }}>
          {flow.map((step, i) => {
            const done = i < cur;
            const current = i === cur;
            return (
              <div key={step} style={{ position: 'relative', textAlign: 'center', paddingTop: 30 }}>
                {i > 0 && (
                  <div style={{ position: 'absolute', top: 13, left: 'calc(-50% + 10px)', right: 'calc(50% + 10px)', height: 2, background: done || current ? 'var(--wine)' : 'var(--border)' }} />
                )}
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 26, height: 26, borderRadius: '50%',
                  background: current || done ? 'var(--wine)' : 'var(--bg-elevated)',
                  border: `2px solid ${current || done ? 'var(--wine)' : 'var(--border-strong)'}`,
                  color: current || done ? '#fff' : 'var(--ink-mute)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: '700 11px/1 var(--f-sans)',
                }}>{done ? '✓' : i+1}</div>
                <div style={{
                  font: `${current ? '800' : '600'} 10.5px/1.3 var(--f-sans)`,
                  color: current ? 'var(--ink)' : done ? 'var(--ink-soft)' : 'var(--ink-mute)',
                  textTransform: 'capitalize',
                }}>{step}</div>
              </div>
            );
          })}
        </div>
      </U.Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DETALLE DE LA CARGA</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <U.Field label="Volumen" value={`${s.cbm} m³`} mono />
            <U.Field label="Peso" value={`${s.weight.toLocaleString()} kg`} mono />
            <U.Field label="Valor declarado" value={`$${s.value.toLocaleString()}`} mono />
            <U.Field label="Naviera" value={s.vessel || '—'} />
            <U.Field label="ETD" value={s.etd || 'pendiente'} mono />
            <U.Field label="ETA" value={s.eta || '—'} mono />
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DOCUMENTOS DISPONIBLES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {D.DOCUMENTS.filter(d => d.shipment === s.id).map(d => (
              <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: 'var(--wine)' }}>{window.Icon.doc(15)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 12.5px/1.2 var(--f-sans)' }}>{d.type}</div>
                  <code style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)' }}>{d.id} · {d.size}</code>
                </div>
                <button style={{ color: 'var(--wine)', padding: 4 }} title="Descargar">{window.Icon.download(13)}</button>
              </div>
            ))}
            {D.DOCUMENTS.filter(d => d.shipment === s.id).length === 0 && (
              <div style={{ padding: '20px 10px', textAlign: 'center', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
                Los documentos se publican cuando la carga zarpa.
              </div>
            )}
          </div>
        </U.Card>
      </div>
    </div>
  );
}

// ── Facturas ─────────────────────────────────────────────────
function PortalInvoices({ invs }) {
  const U = window.ERPUI;
  const statusTone = { pagada: 'success', emitida: 'info', parcial: 'warning', vencida: 'danger' };

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Facturas</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>Estado de cuenta y descarga de comprobantes.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Total facturado" value={`$${(invs.reduce((s,i)=>s+i.amount,0)/1000).toFixed(0)}K`} tone="info" />
        <U.KPI label="Pagado" value={`$${(invs.reduce((s,i)=>s+i.paid,0)/1000).toFixed(0)}K`} tone="success" />
        <U.KPI label="Pendiente" value={`$${(invs.reduce((s,i)=>s+i.balance,0)/1000).toFixed(1)}K`} tone={invs.reduce((s,i)=>s+i.balance,0) > 0 ? 'warning' : 'success'} />
      </div>

      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px 110px 110px 110px 60px', padding: '12px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
          {['Factura', 'Embarque', 'Emitida', 'Vence', 'Monto', 'Estado', ''].map((h, i) => (
            <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: i === 4 ? 'right' : 'left' }}>{h}</span>
          ))}
        </div>
        {invs.map((iv, i) => (
          <div key={iv.id} style={{
            display: 'grid', gridTemplateColumns: '120px 1fr 110px 110px 110px 110px 60px',
            padding: '14px 18px', gap: 14, alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
          }}>
            <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{iv.id}</code>
            <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{iv.shipment}</code>
            <span style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{iv.issued}</span>
            <span style={{ font: '500 11.5px/1 var(--f-mono)', color: iv.status === 'vencida' ? 'var(--danger)' : 'var(--ink-soft)' }}>{iv.due}</span>
            <span style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${iv.amount.toLocaleString()}</span>
            <U.Badge tone={statusTone[iv.status]} size="sm" dot>{iv.status}</U.Badge>
            <button style={{ color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Descargar">{window.Icon.download(14)}</button>
          </div>
        ))}
      </U.Card>
    </div>
  );
}

// ── Documentos ──────────────────────────────────────────────
function PortalDocuments() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const myDocs = D.DOCUMENTS.filter(d => d.client === DEMO_MARKBOX);

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Documentos</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>BL · Packing List · Facturas comerciales · POD. Disponibles 7 años en archivo.</p>

      {myDocs.length === 0
        ? <U.EmptyState icon={window.Icon.doc(22)} title="Sin documentos aún" body="Los documentos se generan al zarpar cada embarque." />
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {myDocs.map(d => (
              <U.Card key={d.id} hoverable style={{ padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.doc(16)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{d.type}</div>
                    <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{d.id}</code>
                  </div>
                </div>
                <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
                  Embarque: <code style={{ fontFamily: 'var(--f-mono)' }}>{d.shipment}</code>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{d.issued} · {d.size}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--wine)', font: '700 11.5px/1 var(--f-sans)' }}>
                    Descargar {window.Icon.download(11)}
                  </span>
                </div>
              </U.Card>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ── Soporte ──────────────────────────────────────────────────
function PortalSupport() {
  const U = window.ERPUI;
  const [msg, setMsg] = pUseState('');
  const [thread, setThread] = pUseState([
    { from: 'agent', text: 'Hola Carlos, ¿en qué te puedo ayudar?', time: 'hace 2 días' },
    { from: 'me',    text: 'Necesitaba saber la fecha exacta de zarpe del DTDU-472816', time: 'hace 2 días' },
    { from: 'agent', text: 'Sí, zarpó el 14 de mayo desde Ningbo a bordo del COSCO PISCES. ETA Puerto Cabello: 12 jun.', time: 'hace 2 días' },
  ]);

  const send = () => {
    if (!msg.trim()) return;
    setThread([...thread, { from: 'me', text: msg, time: 'ahora' }]);
    setMsg('');
    setTimeout(() => {
      setThread(t => [...t, { from: 'agent', text: 'Recibido. Voy a verificar y te respondo en unos minutos.', time: 'ahora' }]);
    }, 1200);
  };

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Soporte</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>Chat directo con tu agente comercial · respuesta promedio 12 min en horario laboral.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <U.Card padded={false} style={{ display: 'flex', flexDirection: 'column', height: 540 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <U.Avatar initials="MA" color="wine" size={36} />
            <div>
              <div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Martina Acuña</div>
              <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--success)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} /> En línea
              </div>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {thread.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '70%',
                  padding: '10px 14px',
                  background: m.from === 'me' ? 'var(--wine)' : 'var(--bg-elevated)',
                  color: m.from === 'me' ? '#fff' : 'var(--ink)',
                  borderRadius: m.from === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  font: '500 13px/1.5 var(--f-sans)',
                }}>
                  {m.text}
                  <div style={{ marginTop: 4, font: '500 10px/1 var(--f-sans)', color: m.from === 'me' ? 'rgba(255,255,255,0.65)' : 'var(--ink-mute)', textAlign: 'right' }}>{m.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input value={msg} onChange={(e)=>setMsg(e.target.value)} onKeyDown={(e)=>e.key === 'Enter' && send()} placeholder="Escribí tu mensaje…"
              style={{ flex: 1, height: 40, padding: '0 14px', background: 'var(--bg-elevated)', border: 0, borderRadius: 'var(--r-md)', font: '500 13px/1 var(--f-sans)', outline: 'none', color: 'var(--ink)' }}
            />
            <U.Btn variant="primary" icon={window.Icon.arrowR(13)} onClick={send}>Enviar</U.Btn>
          </div>
        </U.Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>OTROS CANALES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: '#25D366' }}>{window.Icon.globe(15)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>WhatsApp</div>
                  <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>+58 412 DTD-CARG</code>
                </div>
              </a>
              <a style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: 'var(--wine)' }}>{window.Icon.mail(15)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Email</div>
                  <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>soporte@dtdcargo.com</code>
                </div>
              </a>
            </div>
          </U.Card>
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>HORARIO</div>
            <div style={{ font: '500 13px/1.6 var(--f-sans)', color: 'var(--ink)' }}>
              Lun – Vie<br/>
              <b>08:00 – 18:00</b> (VE) · GMT-4<br/>
              <b>20:00 – 06:00</b> (CN) · GMT+8
            </div>
            <div style={{ marginTop: 10, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
              Para urgencias fuera de horario, WhatsApp 24/7.
            </div>
          </U.Card>
        </div>
      </div>
    </div>
  );
}

// ── Perfil ───────────────────────────────────────────────────
function PortalProfile({ me }) {
  const U = window.ERPUI;
  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Mi perfil</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>Información de cuenta y código MARKBOX para coordinar envíos en China.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <U.Card padded>
          <U.Avatar initials={me.name.split(' ').map(w=>w[0]).slice(0,2).join('')} color="wine" size={72} style={{ margin: '0 auto 14px' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ font: '900 18px/1.2 var(--f-display)', color: 'var(--ink)' }}>{me.name}</div>
            <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{me.company}</div>
          </div>
          <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>TU CÓDIGO</div>
            <code style={{ font: '900 28px/1 var(--f-mono)', color: '#fff', display: 'block', marginTop: 10, letterSpacing: '0.04em' }}>{me.markbox}</code>
            <div style={{ marginTop: 6, font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.6)' }}>Tus proveedores chinos deben anotar este código en cada caja.</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <U.Btn variant="secondary" icon={window.Icon.copy(13)} full>Copiar código</U.Btn>
          </div>
        </U.Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DATOS DE CUENTA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <U.Field label="Nombre" value={me.name} />
              <U.Field label="Empresa" value={me.company} />
              <U.Field label="RIF" value={me.rif} mono />
              <U.Field label="Email" value={me.email} />
              <U.Field label="Teléfono" value={me.phone} mono />
              <U.Field label="Ciudad" value={me.city} />
              <U.Field label="Tier" value={me.tier} />
              <U.Field label="Cliente desde" value={me.since} mono />
            </div>
          </U.Card>

          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DIRECCIÓN DEL ALMACÉN CN</div>
            <pre style={{
              margin: 0, padding: '14px 16px', background: 'var(--bg-elevated)',
              borderRadius: 'var(--r-md)', font: '500 12px/1.6 "Noto Sans SC", sans-serif',
              color: 'var(--ink)', whiteSpace: 'pre-wrap',
            }}>{`仓库地址：义乌市义乌港二期直通仓2栋2号货7--货11
仓库电话：小孙：18006891419
收货时间：周一至周六上午9点到下午5点半
客户编码（MARKBOX）：${me.markbox}`}</pre>
            <U.Btn variant="primary" icon={window.Icon.copy(13)} style={{ marginTop: 10 }} full>Copiar dirección completa</U.Btn>
          </U.Card>
        </div>
      </div>
    </div>
  );
}

// ── Footer ───────────────────────────────────────────────────
function PortalFooter() {
  return (
    <footer style={{ marginTop: 80, padding: '32px var(--s-6)', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <PortalLogo />
        <div style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
          © 2026 DTD-Cargo · Portal del Cliente v1.0 · <a style={{ color: 'var(--wine)' }}>Términos</a> · <a style={{ color: 'var(--wine)' }}>Privacidad</a>
        </div>
      </div>
    </footer>
  );
}

window.PortalApp = PortalApp;
