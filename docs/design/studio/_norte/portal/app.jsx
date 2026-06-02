/* global React */
/* ── DTD Portal del Cliente · App ──────────────────────────── */
/* Vista que ve el cliente externo (no admin DTD).            */
/* Reusa tokens + componentes del ERP.                         */

const { useState: pUseState, useEffect: pUseEffect } = React;

// Quién es el cliente "logueado" en este mock.
// Soporta impersonación admin vía ?as=DTD-XXXX (modo cliente · demo).
const _portalParams = (() => { try { return new URLSearchParams(window.location.search); } catch (e) { return new URLSearchParams(); } })();
const IMPERSONATE = _portalParams.get('as');
const DEMO_MARKBOX = (IMPERSONATE && /^DTD-\d{4}$/.test(IMPERSONATE)) ? IMPERSONATE : 'DTD-5452';

function PortalApp() {
  const D = window.ERPData;
  const [logged, setLogged] = pUseState(!!IMPERSONATE);
  const [showPwTip, setShowPwTip] = pUseState(false);
  const [tour, setTour] = pUseState(false);
  const [view, setView] = pUseState('home');
  const [detail, setDetail] = pUseState(null);
  const [theme, setTheme] = pUseState('light');

  pUseEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  if (!logged) return <PortalLogin onLogin={() => {
    const firstTime = !localStorage.getItem('dtd-portal-visited');
    localStorage.setItem('dtd-portal-visited', '1');
    sessionStorage.removeItem('dtd-from-registro'); // el hint “es tu cédula” no vuelve a aparecer
    setShowPwTip(firstTime);
    setTour(firstTime);
    setLogged(true);
  }} />;

  const me = D.CLIENTS.find(c => c.markbox === DEMO_MARKBOX);
  const _pq = (() => { try { return (window.DTDData && window.DTDData.clientQuotes) ? window.DTDData.clientQuotes(DEMO_MARKBOX) : []; } catch (e) { return []; } })();
  const myShipments = [..._pq, ...D.SHIPMENTS.filter(s => s.client === DEMO_MARKBOX)];
  const myInvoices = D.INVOICES.filter(i => i.client === DEMO_MARKBOX);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--ink)' }}>
      <PortalTopbar
        me={me}
        view={view} setView={(v) => { setView(v); setDetail(null); }}
        onLogout={() => setLogged(false)}
        onTour={() => setTour(true)}
        theme={theme} setTheme={setTheme}
      />

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--s-8) var(--s-6)' }}>
        {showPwTip && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 'var(--s-5)', background: 'var(--info-bg)', border: '1px solid var(--info)', borderRadius: 'var(--r-md)' }}>
            <span style={{ color: 'var(--info)' }}>{window.Icon.info(16)}</span>
            <span style={{ flex: 1, font: '600 13px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Recomendamos cambiar tu contraseña <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>· entrá a tu perfil para hacerlo (es solo una sugerencia)</span></span>
            <button onClick={() => setShowPwTip(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        )}
        <div key={view + (detail || '')} style={{ animation: 'erp-route-in 240ms var(--ease)' }}>
          {view === 'home' && <PortalHome me={me} ships={myShipments} invs={myInvoices} setView={setView} setDetail={setDetail} />}
          {view === 'shipments' && !detail && <PortalShipments ships={myShipments} setDetail={setDetail} />}
          {view === 'shipments' && detail && <PortalShipmentDetail id={detail} onBack={() => setDetail(null)} />}
          {view === 'suppliers' && <PortalSuppliers me={me} />}
          {view === 'invoices' && <PortalInvoices invs={myInvoices} />}
          {view === 'documents' && <PortalDocuments />}
          {view === 'referidos' && <PortalReferidos me={me} />}
          {view === 'support' && <PortalSupport me={me} />}
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
              {sessionStorage.getItem('dtd-from-registro') && (
                <span className="guide-pulse" style={{ display: 'inline-block', marginTop: 2, padding: '5px 10px', background: 'var(--wine-tint)', color: 'var(--wine)', borderRadius: 'var(--r-pill)', font: '700 11px/1 var(--f-sans)', width: 'fit-content' }}>💡 Es tu cédula</span>
              )}
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
            <div style={{ font: '600 12px/1 var(--f-sans)' }}>
              <a style={{ color: 'var(--ink-soft)', cursor: 'pointer' }}>¿Olvidaste tu contraseña?</a>
            </div>
            {/* CTA de registro · puerta única: quien no tiene MARKBOX se registra acá */}
            <div style={{ marginTop: 4, padding: '12px 14px', background: 'var(--wine-tint)', border: '1px solid var(--wine)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ font: '600 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>¿No tienes MARKBOX?</span>
              <a
                onClick={() => { window.location.href = 'Registro Cliente.html'; }}
                style={{ font: '800 13px/1 var(--f-sans)', color: 'var(--wine)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >Regístrate {window.Icon.arrowR(13)}</a>
            </div>
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
    { v: 'suppliers', l: 'Tus proveedores', icon: 'truck' },
    { v: 'invoices',  l: 'Facturas',   icon: 'invoice' },
    { v: 'documents', l: 'Documentos', icon: 'doc' },
    { v: 'referidos', l: 'Referidos',  icon: 'star' },
    { v: 'support',   l: 'Soporte',    icon: 'chat' },
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
      <img src="assets/dtdcargo-icon-navy.png" alt="DTD-Cargo"
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
        <div style={{ display: 'flex', gap: 10 }}>
          <window.ERPUI.Btn variant="secondary" icon={window.Icon.plus(14)} onClick={() => setView('suppliers')}>Nueva compra · nuevo código</window.ERPUI.Btn>
          <window.ERPUI.Btn variant="primary" icon={window.Icon.plus(14)}>Nueva cotización</window.ERPUI.Btn>
        </div>
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
    if (tab === 'active' && s.status === 'entregado') return false;
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
        { value: 'active',    label: 'En curso',   count: ships.filter(s => s.status !== 'entregado').length },
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

// ── Aceptación legal de cotización (T&C + Operador) ──────────
function pFmtLegalDate(iso) {
  const [y, m, d] = iso.split('-');
  const MM = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][parseInt(m) - 1];
  return `${parseInt(d)} ${MM} ${y}`;
}
function pNowStamp() {
  const n = new Date(); const p = (x) => String(x).padStart(2, '0');
  return `${p(n.getDate())}/${p(n.getMonth() + 1)}/${n.getFullYear()} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
}
function pFakeHash() {
  return ('sha256:' + 'a1f' + Math.random().toString(16).slice(2, 10) + 'c7' + Math.random().toString(16).slice(2, 8)).slice(0, 30);
}

function PortalDocViewer({ doc, onClose }) {
  const U = window.ERPUI;
  return (
    <U.Modal open={!!doc} onClose={onClose} width={620}
      title={doc ? `${doc.name} · ${doc.version}` : ''}
      actions={<U.Btn variant="primary" onClick={onClose}>Cerrar</U.Btn>}>
      {doc && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <U.Badge tone="wine" size="sm">{doc.version}</U.Badge>
            <U.Badge tone="neutral" size="sm">Vigente desde {pFmtLegalDate(doc.effective)}</U.Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 360, overflowY: 'auto', overflowX: 'hidden', paddingRight: 6 }}>
            {doc.body.map(([h, p], i) => (
              <div key={i}>
                <div style={{ font: '800 13px/1.3 var(--f-display)', color: 'var(--ink)', marginBottom: 5 }}>{h}</div>
                <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>{p}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </U.Modal>
  );
}

function PortalAcceptModal({ quote, me, open, onClose, onAccepted }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [checked, setChecked] = pUseState(false);
  const [viewing, setViewing] = pUseState(null);
  const docs = (window.LegalData && window.LegalData.currentDocs()) || [];

  const close = () => { setChecked(false); setViewing(null); onClose(); };
  const confirm = () => {
    if (!checked) return;
    const evidence = {
      id: 'AC-2026-' + String(Math.floor(215 + Math.random() * 80)).padStart(4, '0'),
      client: me.company || me.name, markbox: me.markbox,
      quote: quote.id, orden: quote.id.replace('Q-', 'OS-'),
      cbm: quote.cbm, weight: quote.weight, total: quote.amount,
      docs: docs.map(d => [d.name, d.version]),
      at: pNowStamp(), ip: me.ip || '190.142.88.214', hash: pFakeHash(),
    };
    try { if (window.LegalData) window.LegalData.ACCEPTANCES.unshift(evidence); } catch (e) {}
    onAccepted(evidence);
  };

  return (
    <React.Fragment>
      <U.Modal open={open && !viewing} onClose={close} width={560} title="Aceptar cotización"
        actions={
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 6 }}>{I.lock(13)} Paso obligatorio</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <U.Btn variant="ghost" onClick={close}>Cancelar</U.Btn>
              <U.Btn variant="primary" disabled={!checked} onClick={confirm} icon={I.check(14)}>Confirmar y generar orden</U.Btn>
            </div>
          </div>
        }>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', marginBottom: 18 }}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.doc(20)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <code style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{quote.id}</code>
            <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{quote.route} · {quote.cbm} m³ · {quote.type}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{quote.total}</div>
            <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>DDP total</div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <button onClick={() => setChecked(!checked)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, textAlign: 'left', background: checked ? 'var(--wine-tint)' : 'var(--bg-surface)', border: 0, transition: 'background .15s ease' }}>
            <span style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1, borderRadius: 'var(--r-xs)', border: `2px solid ${checked ? 'var(--wine)' : 'var(--border-strong)'}`, background: checked ? 'var(--wine)' : 'var(--bg-surface)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{checked && I.check(13)}</span>
            <div style={{ font: '600 13px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
              He leído y acepto los{' '}
              {docs[0] && <a onClick={(e) => { e.stopPropagation(); setViewing(docs[0]); }} style={{ color: 'var(--wine)', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer' }}>Términos y Condiciones de DTD</a>}
              {' '}y las{' '}
              {docs[1] && <a onClick={(e) => { e.stopPropagation(); setViewing(docs[1]); }} style={{ color: 'var(--wine)', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer' }}>Condiciones del Operador de Consolidación</a>}.
            </div>
          </button>
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, background: 'var(--bg-elevated)' }}>
            {docs.map(d => (
              <button key={d.key} onClick={() => setViewing(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--wine)', display: 'flex' }}>{I.doc(11)}</span>{d.version} · vig. {pFmtLegalDate(d.effective)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, padding: '11px 13px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)' }}>
          <span style={{ color: 'var(--info)', display: 'flex', flexShrink: 0, marginTop: 1 }}>{I.shield(15)}</span>
          <div style={{ font: '500 11.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
            Al confirmar registramos tu aceptación como evidencia legal: cliente, cotización, documento y versión, fecha/hora, IP y un hash de integridad. Se solicita en <b>cada</b> cotización.
          </div>
        </div>
      </U.Modal>
      <PortalDocViewer doc={viewing} onClose={() => setViewing(null)} />
    </React.Fragment>
  );
}

function PortalAcuseModal({ evidence, open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  if (!evidence) return null;
  const Row = ({ k, v }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', flexShrink: 0 }}>{k}</span>
      <span style={{ font: '600 12px/1.4 var(--f-mono)', color: 'var(--ink)', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
    </div>
  );
  return (
    <U.Modal open={open} onClose={onClose} width={520} title="Orden de servicio generada"
      actions={<U.Btn variant="primary" full onClick={onClose} icon={I.check(14)}>Entendido</U.Btn>}>
      <div style={{ textAlign: 'center', padding: '6px 0 18px' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{I.check(30)}</div>
        <div style={{ font: '900 20px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Cotización aceptada</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
          Generamos la orden <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{evidence.orden}</code> ligada a las versiones aceptadas.
        </div>
      </div>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '4px 16px 14px' }}>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '14px 0 6px' }}>Acuse de aceptación · evidencia</div>
        <Row k="Cliente" v={`${evidence.client} · ${evidence.markbox}`} />
        <Row k="Cotización" v={evidence.quote} />
        {evidence.docs.map((d, i) => <Row key={i} k={i === 0 ? 'Documentos' : ''} v={`${d[0]} ${d[1]}`} />)}
        <Row k="Fecha / hora" v={evidence.at} />
        <Row k="IP" v={evidence.ip} />
        <Row k="Hash" v={evidence.hash} />
      </div>
    </U.Modal>
  );
}

// ── Detalle de un envío ─────────────────────────────────────
function PortalShipmentDetail({ id, onBack }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const s = (() => { try { const q = (window.DTDData && window.DTDData.clientQuotes) ? window.DTDData.clientQuotes(DEMO_MARKBOX).find(x => x.id === id) : null; return q || D.SHIPMENTS.find(x => x.id === id); } catch (e) { return D.SHIPMENTS.find(x => x.id === id); } })();
  const [accepting, setAccepting] = pUseState(false);
  const [evidence, setEvidence] = pUseState(null);
  const [acuse, setAcuse] = pUseState(false);
  if (!s) return null;
  const flow = D.STATUS_FLOW;
  const cur = flow.indexOf(s.status);
  const pLegalAccepted = (qid) => { try { return (window.LegalData && window.LegalData.ACCEPTANCES.some(a => a.quote === qid)); } catch (e) { return false; } };
  const quote = {
    id: s.id.startsWith('Q-') ? s.id : 'Q-2026-' + s.id.slice(-4), route: `${D.origin(s.origin).name} → ${D.dest(s.destination).name}`,
    cbm: s.cbm, weight: s.weight, amount: s.value, type: s.type, total: '$' + (s.value || 0).toLocaleString('en-US'),
  };
  const meQ = { company: s.clientName, markbox: s.client, ip: '190.142.88.214' };
  // Gate de firma · atado a la MEDIDA aceptada (no solo al ID).
  const accForQuote = (() => { try { return (window.LegalData ? window.LegalData.ACCEPTANCES : []).filter(a => a.quote === quote.id); } catch (e) { return []; } })();
  const acceptedCurrent = !!evidence || accForQuote.some(a => Number(a.cbm) === Number(s.cbm) && Number(a.weight) === Number(s.weight));
  const priorDiff = (!acceptedCurrent && accForQuote.length > 0) ? accForQuote[0] : null; // aceptó antes, pero la medida cambió
  const inReview = s.status === 'cotizado' && s.quoteStage === 'en-proceso'; // recién solicitada · el agente la prepara
  const needsAccept = (s.status === 'cotizado' || s.status === 'recibido CN') && !acceptedCurrent && !inReview;
  const isMeasured = s.status === 'recibido CN';
  const isReaccept = !!priorDiff;
  const fmtUsd = (n) => '$' + (Number(n) || 0).toLocaleString('en-US');

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
          {inReview ? (
            <U.Btn variant="secondary" icon={window.Icon.clock ? window.Icon.clock(14) : window.Icon.info(14)} disabled>En revisión</U.Btn>
          ) : needsAccept ? (
            <React.Fragment>
              <U.Btn variant="secondary" icon={window.Icon.download(14)}>Descargar PDF</U.Btn>
              <U.Btn variant="primary" icon={window.Icon.check(14)} onClick={() => setAccepting(true)}>{isReaccept ? 'Revisar y re-aceptar' : (isMeasured ? 'Aceptar cotización · medida real' : 'Aceptar cotización')}</U.Btn>
            </React.Fragment>
          ) : (
            <React.Fragment>
              {evidence && <U.Btn variant="secondary" icon={window.Icon.shield(14)} onClick={() => setAcuse(true)}>Ver acuse</U.Btn>}
              <U.Btn variant="secondary" icon={window.Icon.download(14)}>Descargar docs</U.Btn>
              <U.Btn variant="primary" icon={window.Icon.mail(14)}>Contactar agente</U.Btn>
            </React.Fragment>
          )}
        </div>
      </div>

      {inReview && (
        <U.Card padded style={{ marginBottom: 'var(--s-6)', background: 'var(--info-bg)', borderLeft: '3px solid var(--info)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }}>{window.Icon.clock ? window.Icon.clock(18) : window.Icon.info(18)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Cotización en proceso</div>
              <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>
                Recibimos tu solicitud y tu agente está preparando la cotización formal{s.quoteRef ? ` (ref. ${s.quoteRef})` : ''}. Te avisamos apenas esté lista para aceptar.
              </div>
            </div>
          </div>
        </U.Card>
      )}

      {needsAccept && (
        <U.Card padded style={{ marginBottom: 'var(--s-6)', background: 'var(--wine-tint)', borderLeft: '3px solid var(--wine)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ color: 'var(--wine)', flexShrink: 0, marginTop: 1 }}>{window.Icon.shield(18)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>{isReaccept ? 'La medida real cambió · re-aceptación requerida' : (isMeasured ? 'Tu carga llegó y se midió · falta tu aceptación' : 'Cotización pendiente de aceptación')}</div>
              <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>
                {isReaccept
                  ? 'Aceptaste una cotización por la medida estimada, pero al medir tu carga en China el volumen/peso real cambió. Confirmá la nueva cotización para que emitamos la factura. La factura no se emite hasta que aceptes la diferencia.'
                  : (isMeasured
                    ? `Recibimos tu carga en China y medimos el volumen y peso reales (${s.cbm} m³ · ${(s.weight||0).toLocaleString()} kg). Aceptá la cotización con la medida real para que emitamos tu factura DDP. La factura no se emite hasta que firmes.`
                    : 'Revisá la cotización y aceptá los términos para generar tu orden de servicio.')}
              </div>
              {isReaccept && (
                <div style={{ display: 'flex', gap: 18, marginTop: 12 }}>
                  <div>
                    <div style={{ font: '600 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Aceptado (estimado)</div>
                    <div style={{ font: '600 13px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 5, textDecoration: 'line-through' }}>{priorDiff.cbm} m³ · {fmtUsd(priorDiff.total)}</div>
                  </div>
                  <span style={{ color: 'var(--wine)', alignSelf: 'flex-end', paddingBottom: 2 }}>{window.Icon.arrowR(14)}</span>
                  <div>
                    <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Medida real</div>
                    <div style={{ font: '800 13px/1.3 var(--f-mono)', color: 'var(--ink)', marginTop: 5 }}>{s.cbm} m³ · {fmtUsd(s.value)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </U.Card>
      )}

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

      <PortalAcceptModal quote={quote} me={meQ} open={accepting}
        onClose={() => setAccepting(false)}
        onAccepted={(ev) => { setAccepting(false); setEvidence(ev); setAcuse(true); }} />
      <PortalAcuseModal evidence={evidence} open={acuse} onClose={() => setAcuse(false)} />
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
// ── Soporte (agente + casos · fusión Reclamos + Soporte) ─────
function PortalSupport({ me }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const D = window.ERPData;
  const myShipments = (D.SHIPMENTS || []).filter(s => s.client === me.markbox);

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
    setTimeout(() => setThread(t => [...t, { from: 'agent', text: 'Recibido. Voy a verificar y te respondo en unos minutos.', time: 'ahora' }]), 1200);
  };

  const [claims, setClaims] = pUseState([
    { id: 'SP-2026-0042', type: 'faltante', shipment: myShipments[0]?.id || 'DTDU-472816', subject: 'Faltan 2 cajas según packing list', status: 'en-revision', date: '2026-05-22',
      messages: [
        { from: 'me',    text: 'Recibí el contenedor pero faltan 2 cajas según el packing. Adjunto fotos del precinto.', time: '22 may · 08:31' },
        { from: 'agent', text: 'Roberto, lamento el inconveniente. Abrí tu caso y estoy revisando con almacén CN el conteo de salida.', time: '22 may · 08:44' },
      ] },
    { id: 'SP-2026-0031', type: 'demora', shipment: 'DTDU-365044', subject: 'El despacho tardó más del ETA informado', status: 'resuelto', date: '2026-05-10',
      messages: [
        { from: 'me',    text: 'El ETA era el 5 y recién entregaron el 9. ¿Qué pasó?', time: '10 may · 10:10' },
        { from: 'agent', text: 'Hubo congestión en Puerto Cabello. Te aplicamos un crédito de almacenaje como compensación.', time: '10 may · 14:02' },
      ], resolution: 'Crédito de $120 aplicado a tu próxima factura.' },
  ]);
  const [selected, setSelected] = pUseState(null);
  const [creating, setCreating] = pUseState(false);
  const sel = selected ? claims.find(c => c.id === selected) : null;
  if (sel) return <ReclamoDetail claim={sel} onBack={() => setSelected(null)} />;

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Soporte</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)', maxWidth: '54ch' }}>Hablá con tu agente o abrí un caso con seguimiento. Cada caso tiene número, estado y respuesta.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* ── Casos ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="eyebrow eyebrow-wine">TUS CASOS</div>
            <U.Btn variant="primary" size="sm" icon={I.plus(13)} onClick={() => setCreating(c => !c)}>Nuevo caso</U.Btn>
          </div>
          {creating && <NewReclamoForm myShipments={myShipments} onCancel={() => setCreating(false)} onSubmit={(claim) => { setClaims([claim, ...claims]); setCreating(false); }} />}
          {claims.length === 0 ? (
            <U.EmptyState icon={I.chat(22)} title="Sin casos" body="No tenés casos abiertos. Si tuviste un problema con un embarque, abrí uno acá." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {claims.map(c => {
                const tp = RECLAMO_TYPE[c.type];
                const stepIdx = RECLAMO_STEPS.indexOf(c.status);
                return (
                  <U.Card key={c.id} hoverable onClick={() => setSelected(c.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-md)', background: `var(--${tp.tone}-bg)`, color: `var(--${tp.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.chat(20)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{c.id}</code>
                          <U.Badge tone={tp.tone} size="sm">{tp.label}</U.Badge>
                        </div>
                        <div style={{ font: '600 13.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{c.subject}</div>
                        <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>
                          <code style={{ font: '600 11px var(--f-mono)' }}>{c.shipment}</code> · {c.date}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <U.Badge tone={c.status === 'resuelto' ? 'success' : c.status === 'en-revision' ? 'warning' : 'info'} dot>{RECLAMO_STEP_LABEL[c.status]}</U.Badge>
                        <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 8 }}>Paso {stepIdx + 1} de 3</div>
                      </div>
                      <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{I.chevR(16)}</span>
                    </div>
                  </U.Card>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Agente + canales ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <U.Card padded={false} style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <U.Avatar initials="MA" color="wine" size={36} />
              <div>
                <div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Martina Acuña</div>
                <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--success)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} /> En línea
                </div>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {thread.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '78%', padding: '9px 13px', background: m.from === 'me' ? 'var(--wine)' : 'var(--bg-elevated)', color: m.from === 'me' ? '#fff' : 'var(--ink)', borderRadius: m.from === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', font: '500 12.5px/1.5 var(--f-sans)' }}>
                    {m.text}
                    <div style={{ marginTop: 4, font: '500 10px/1 var(--f-sans)', color: m.from === 'me' ? 'rgba(255,255,255,0.65)' : 'var(--ink-mute)', textAlign: 'right' }}>{m.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input value={msg} onChange={(e)=>setMsg(e.target.value)} onKeyDown={(e)=>e.key === 'Enter' && send()} placeholder="Escribí tu mensaje…"
                style={{ flex: 1, height: 38, padding: '0 12px', background: 'var(--bg-elevated)', border: 0, borderRadius: 'var(--r-md)', font: '500 12.5px/1 var(--f-sans)', outline: 'none', color: 'var(--ink)' }} />
              <U.Btn variant="primary" size="sm" icon={window.Icon.arrowR(13)} onClick={send}>Enviar</U.Btn>
            </div>
          </U.Card>
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
        </div>
      </div>
    </div>
  );
}

// ── Referidos (programa de lealtad) ──────────────────────────
function PortalReferidos({ me }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FidelizacionData;
  const fmt = (n) => '$' + (Number(n) || 0).toLocaleString('en-US');
  const [copied, setCopied] = pUseState(false);

  // Feature flag · si está OFF, el cliente ve "Próximamente"
  const flags = (window.DTDFlags && window.DTDFlags.getFlags()) || {};
  if (!flags.referidos) {
    return (
      <div>
        <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Referidos</h1>
        <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)', maxWidth: '52ch' }}>Recomendá DTD-Cargo y ganá crédito en tus embarques.</p>
        <U.Card padded style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--r-lg)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{I.star ? I.star(30) : I.spark(30)}</div>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Próximamente</div>
          <div style={{ font: '500 13.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 10, maxWidth: '42ch', marginInline: 'auto' }}>
            Estamos afinando el programa de referidos. Muy pronto vas a poder invitar a otros importadores y ganar crédito por cada uno. Te avisamos cuando esté disponible.
          </div>
        </U.Card>
      </div>
    );
  }

  if (!F) return <div style={{ font: '500 13px var(--f-sans)', color: 'var(--ink-soft)' }}>Programa de referidos no disponible.</div>;

  const code = F.referralCode(me.markbox);
  const prog = F.tierProgress(me.billed);
  const myRefs = F.referralsByReferrer(me.markbox);
  const credits = F.creditsEarned(me.markbox);
  const pending = F.pendingCredits(me.markbox);

  const copy = () => {
    try { navigator.clipboard.writeText(code); } catch (e) {}
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  const share = () => {
    const txt = `Importá de China con DTD-Cargo y usá mi código ${code} para ${fmt(F.REFERRAL_RULES.referredReward)} de descuento en tu primer embarque. Con confianza, de China a tu puerta.`;
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
  };

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Referidos</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)', maxWidth: '54ch' }}>
        Recomendá DTD-Cargo y ganá crédito. Cada importador que sumás fortalece la comunidad — contenedor a contenedor.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, marginBottom: 16 }}>
        {/* Hero: tu código */}
        <U.Card padded={false} style={{ overflow: 'hidden', background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', border: 0, color: '#fff' }}>
          <div style={{ padding: 28 }}>
            <div style={{ font: '700 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>TU CÓDIGO DE REFERIDO</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <code style={{ font: '900 34px/1 var(--f-display)', letterSpacing: '0.02em', color: '#fff' }}>{code}</code>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copy} style={heroBtn(copied)}>{copied ? I.check(14) : I.doc(14)} {copied ? 'Copiado' : 'Copiar'}</button>
                <button onClick={share} style={heroBtn(false, true)}>{I.globe(14)} Compartir</button>
              </div>
            </div>
            <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--r-md)' }}>
                <div style={{ font: '900 22px/1 var(--f-display)', color: '#fff' }}>{fmt(F.REFERRAL_RULES.referredReward)}</div>
                <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>para tu referido en su 1er embarque</div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.08)', borderRadius: 'var(--r-md)' }}>
                <div style={{ font: '900 22px/1 var(--f-display)', color: '#fff' }}>{fmt(F.REFERRAL_RULES.referrerReward)}</div>
                <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>de crédito para vos al acreditarse</div>
              </div>
            </div>
          </div>
        </U.Card>

        {/* Créditos */}
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>TUS CRÉDITOS</div>
          <div style={{ font: '900 32px/1 var(--f-display)', color: 'var(--success)', letterSpacing: '-0.02em' }}>{fmt(credits)}</div>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>acreditados a tu cuenta</div>
          {pending > 0 && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', font: '600 12px/1.4 var(--f-sans)', color: 'var(--warning)' }}>
              {fmt(pending)} en camino · referidos en proceso
            </div>
          )}
          <div style={{ marginTop: 14, font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
            Los créditos se descuentan automáticamente de tu próxima factura.
          </div>
        </U.Card>
      </div>

      {/* Nivel actual */}
      <U.Card padded style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: prog.next ? 16 : 0, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: `var(--${prog.tier.tone}-bg)`, color: prog.tier.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.star(22)}</span>
            <div>
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Tu nivel</div>
              <div style={{ font: '900 22px/1 var(--f-display)', color: prog.tier.color, marginTop: 4 }}>{prog.tier.label}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 460, justifyContent: 'flex-end' }}>
            {prog.tier.benefits.map((b, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)', font: '600 11px/1 var(--f-sans)', color: 'var(--ink)' }}>
                <span style={{ color: prog.tier.color }}>{I.check(11)}</span>{b}
              </span>
            ))}
          </div>
        </div>
        {prog.next && (
          <div>
            <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${prog.pct}%`, background: prog.next.color, borderRadius: 999, transition: 'width var(--dur-slow) var(--ease)' }} />
            </div>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
              Te faltan <b style={{ color: 'var(--ink)' }}>{fmt(prog.toNext)}</b> de facturación para alcanzar <b style={{ color: prog.next.color }}>{prog.next.label}</b>.
            </div>
          </div>
        )}
      </U.Card>

      {/* Tus referidos */}
      <U.Card padded={false}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="eyebrow eyebrow-wine">TUS REFERIDOS</div>
          <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{myRefs.length} en total</span>
        </div>
        {myRefs.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Todavía no referiste a nadie. Compartí tu código y empezá a ganar.</div>
        ) : myRefs.map((r, i) => {
          const stt = F.REFERRAL_STATUS[r.status];
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 110px', gap: 14, alignItems: 'center', padding: '13px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
              <div>
                <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.referredName}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{r.referredCompany} · {r.date}</div>
              </div>
              <U.Badge tone={stt.tone} size="sm" dot>{stt.label}</U.Badge>
              <div style={{ textAlign: 'right', font: '700 13px/1 var(--f-mono)', color: r.status === 'acreditado' ? 'var(--success)' : 'var(--ink-mute)' }}>
                {r.status === 'acreditado' ? '+' + fmt(r.rewardUsd) : '—'}
              </div>
            </div>
          );
        })}
      </U.Card>
    </div>
  );
}

function heroBtn(active, outline) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-md)',
    font: '700 12.5px/1 var(--f-sans)', cursor: 'pointer',
    background: active ? 'var(--success)' : (outline ? 'transparent' : '#fff'),
    color: active ? '#fff' : (outline ? '#fff' : 'var(--ink)'),
    border: outline ? '1px solid rgba(255,255,255,0.3)' : 'none',
  };
}

// ── Reclamos formales ────────────────────────────────────────
const RECLAMO_TYPE = {
  faltante:    { label: 'Faltante de mercancía', tone: 'danger'  },
  dano:        { label: 'Daño en la carga',      tone: 'danger'  },
  demora:      { label: 'Demora en entrega',     tone: 'warning' },
  facturacion: { label: 'Facturación',           tone: 'info'    },
  otro:        { label: 'Otro',                  tone: 'neutral' },
};
const RECLAMO_STEPS = ['recibido', 'en-revision', 'resuelto'];
const RECLAMO_STEP_LABEL = { recibido: 'Recibido', 'en-revision': 'En revisión', resuelto: 'Resuelto' };

function NewReclamoForm({ myShipments, onCancel, onSubmit }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [type, setType] = pUseState('faltante');
  const [shipment, setShipment] = pUseState(myShipments[0]?.id || '');
  const [subject, setSubject] = pUseState('');
  const [desc, setDesc] = pUseState('');

  const submit = () => {
    if (!subject.trim() || !desc.trim()) { alert('Completá el asunto y la descripción.'); return; }
    const num = String(Math.floor(40 + Math.random() * 50)).padStart(4, '0');
    onSubmit({
      id: 'REC-2026-' + num, type, shipment: shipment || '—', subject: subject.trim(),
      status: 'recibido', date: new Date().toISOString().slice(0, 10),
      messages: [{ from: 'me', text: desc.trim(), time: 'ahora' }],
    });
  };

  return (
    <U.Card padded style={{ marginBottom: 16, border: '1px solid var(--wine)', background: 'var(--wine-tint)' }}>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>NUEVO CASO</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <U.Select label="Tipo de caso" value={type} onChange={(e) => setType(e.target.value)} options={Object.entries(RECLAMO_TYPE).map(([k, v]) => ({ value: k, label: v.label }))} />
        <U.Select label="Embarque relacionado" value={shipment} onChange={(e) => setShipment(e.target.value)} options={[{ value: '', label: 'Sin embarque' }, ...myShipments.map(s => ({ value: s.id, label: s.id }))]} />
      </div>
      <U.Input label="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumí el problema en una línea" style={{ marginBottom: 12 }} />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Descripción</span>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="Contanos qué pasó. Si tenés fotos o el packing, mencionalo." style={{
          resize: 'vertical', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink)', outline: 'none',
        }} />
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <U.Btn variant="ghost" onClick={onCancel}>Cancelar</U.Btn>
        <U.Btn variant="primary" icon={I.check(13)} onClick={submit}>Enviar caso</U.Btn>
      </div>
    </U.Card>
  );
}

function ReclamoDetail({ claim, onBack }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [msg, setMsg] = pUseState('');
  const [thread, setThread] = pUseState(claim.messages);
  const tp = RECLAMO_TYPE[claim.type];
  const stepIdx = RECLAMO_STEPS.indexOf(claim.status);

  const send = () => {
    if (!msg.trim()) return;
    setThread([...thread, { from: 'me', text: msg.trim(), time: 'ahora' }]);
    setMsg('');
  };

  return (
    <div>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 13px/1 var(--f-sans)', color: 'var(--wine)', marginBottom: 16, cursor: 'pointer' }}>
        {I.arrowL(14)} Volver a soporte
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <code style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)' }}>{claim.id}</code>
        <U.Badge tone={tp.tone} size="sm">{tp.label}</U.Badge>
        <U.Badge tone={claim.status === 'resuelto' ? 'success' : claim.status === 'en-revision' ? 'warning' : 'info'} dot>{RECLAMO_STEP_LABEL[claim.status]}</U.Badge>
      </div>
      <div style={{ font: '600 15px/1.4 var(--f-sans)', color: 'var(--ink)', marginBottom: 4 }}>{claim.subject}</div>
      <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 'var(--s-6)' }}>
        <code style={{ font: '600 12px var(--f-mono)' }}>{claim.shipment}</code> · abierto el {claim.date}
      </div>

      {/* Timeline */}
      <U.Card padded style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {RECLAMO_STEPS.map((s, i) => {
            const done = i <= stepIdx;
            return (
              <React.Fragment key={s}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: done ? 'var(--wine)' : 'var(--bg-elevated)', color: done ? '#fff' : 'var(--ink-mute)', border: done ? 'none' : '1px solid var(--border)' }}>
                    {done ? I.check(15) : <span style={{ font: '700 12px/1 var(--f-sans)' }}>{i + 1}</span>}
                  </span>
                  <span style={{ font: `${i === stepIdx ? '700' : '500'} 11.5px/1 var(--f-sans)`, color: i === stepIdx ? 'var(--wine)' : done ? 'var(--ink)' : 'var(--ink-mute)' }}>{RECLAMO_STEP_LABEL[s]}</span>
                </div>
                {i < RECLAMO_STEPS.length - 1 && <div style={{ flex: 1, height: 2, background: i < stepIdx ? 'var(--wine)' : 'var(--border)', margin: '0 8px', marginBottom: 22 }} />}
              </React.Fragment>
            );
          })}
        </div>
        {claim.resolution && (
          <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--success-bg)', borderRadius: 'var(--r-md)', font: '600 12.5px/1.5 var(--f-sans)', color: 'var(--success)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>{I.check(15)}</span>
            <span><b>Resuelto:</b> {claim.resolution}</span>
          </div>
        )}
      </U.Card>

      {/* Hilo */}
      <U.Card padded={false} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', font: '700 12px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Conversación del reclamo</div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
          {thread.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '74%', padding: '10px 14px',
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
        {claim.status !== 'resuelto' && (
          <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Agregar un mensaje al reclamo…" style={{ flex: 1, height: 40, padding: '0 14px', background: 'var(--bg-elevated)', border: 0, borderRadius: 'var(--r-md)', font: '500 13px/1 var(--f-sans)', outline: 'none', color: 'var(--ink)' }} />
            <U.Btn variant="primary" icon={I.arrowR(13)} onClick={send}>Enviar</U.Btn>
          </div>
        )}
      </U.Card>
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
客户 Shipping Mark 代码：${me.markbox}`}</pre>
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

// ── Tus proveedores · re-compra + alta + etiquetas ──────────
function PortalSuppliers({ me }) {
  const U = window.ERPUI;
  const I = window.Icon;
  // Prefijo del tenant · aliados = DTD fijo · otros tenants configurable en Admin
  const PREFIX = (window.ERPData?.tenantCodePrefix?.() || (me.markbox || 'DTD-5502').split('-')[0]);
  const clientNo = (me.markbox || 'DTD-5502').split('-')[1];

  const [suppliers, setSuppliers] = pUseState(
    (window.ERPData?.suppliersFor?.(me.markbox)) || [
      { n: 1, name: 'Yiwu Standard Co', orders: 2 },
      { n: 2, name: 'Shenzhen Lights Ltd', orders: 1 },
    ]
  );
  const [copied, setCopied] = pUseState('');
  const [adding, setAdding] = pUseState(false);
  const [newName, setNewName] = pUseState('');
  const [labelFor, setLabelFor] = pUseState(null); // { code, boxes }

  const codeFor = (s, order) => `${PREFIX}-${clientNo}-${s.n}-${order}`;
  const copy = (code) => { navigator.clipboard?.writeText(code); setCopied(code); setTimeout(() => setCopied(''), 2000); };

  const rebuy = (s) => {
    const next = s.orders + 1;
    setSuppliers(prev => prev.map(x => x.n === s.n ? { ...x, orders: next } : x));
    const code = codeFor(s, next);
    copy(code);
    setLabelFor({ code, boxes: 1 });
  };
  const addSupplier = () => {
    if (!newName.trim()) return;
    const n = suppliers.length + 1;
    setSuppliers(prev => [...prev, { n, name: newName.trim(), orders: 1 }]);
    const code = `${PREFIX}-${clientNo}-${n}-1`;
    copy(code);
    setLabelFor({ code, boxes: 1 });
    setNewName(''); setAdding(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', margin: '0 0 8px' }}>
        <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Tus proveedores</h1>
        <U.Btn variant="primary" icon={I.plus(14)} onClick={() => setAdding(true)}>Nueva compra</U.Btn>
      </div>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-5)' }}>
        Cada <b>compra</b> es una <b style={{ color: 'var(--wine)' }}>prealerta</b>: nos avisás que viene mercancía de China para esperarla y procesarla más rápido (lo que las "puerta a puerta" de EE.UU. llaman pre-alerta). Generá el código y las etiquetas para tus proveedores, o re-comprá a uno existente.
      </p>

      {/* Por qué importa · trazabilidad */}
      <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '18px 20px', marginBottom: 'var(--s-5)' }}>
        <div style={{ font: '800 13.5px/1.2 var(--f-display)', color: 'var(--ink)', marginBottom: 4 }}>Por qué registrar a tu proveedor importa</div>
        <p style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
          En comercio internacional, cómo gestionás tu información define qué tan rápido y seguro llega tu mercancía.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.truck(16)}</span>
            <div>
              <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Rapidez</div>
              <div style={{ font: '500 11.5px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>Tus productos llegan a tiempo: la caja entra identificada y no espera en "huérfanas".</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.shield(16)}</span>
            <div>
              <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Control total</div>
              <div style={{ font: '500 11.5px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>Al llegar el envío sabés automáticamente quién es el proveedor y todos los detalles, vía el código.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mensaje clave verde */}
      <div style={{ padding: '12px 14px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--r-md)', font: '600 12.5px/1.5 var(--f-sans)', marginBottom: 'var(--s-5)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>{I.check(15)}</span>
        <span>Copialo y enviáselo SOLO al proveedor — a nosotros nos llega automático al registrarlo.</span>
      </div>

      {/* Lista de proveedores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suppliers.map(s => (
          <U.Card key={s.n} padded>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', font: '900 15px/1 var(--f-display)' }}>#{s.n}</div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.name}</div>
                <div style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>
                  {s.orders} compra{s.orders > 1 ? 's' : ''} · próxima: <b style={{ color: 'var(--wine)' }}>{codeFor(s, s.orders + 1)}</b>
                </div>
              </div>
              <U.Btn variant="primary" size="sm" icon={I.copy(13)} onClick={() => rebuy(s)}>
                {copied === codeFor(s, s.orders + 1) ? '✓ Copiado' : 'Re-comprar'}
              </U.Btn>
            </div>
          </U.Card>
        ))}
      </div>

      {/* Agregar proveedor nuevo */}
      <div style={{ marginTop: 'var(--s-4)' }}>
        {adding ? (
          <U.Card padded>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <U.Input label="Nombre del proveedor" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej. Guangzhou Textile Co" autoFocus />
              </div>
              <U.Btn variant="primary" icon={I.check(14)} onClick={addSupplier} disabled={!newName.trim()}>Crear y generar código</U.Btn>
              <U.Btn variant="ghost" onClick={() => { setAdding(false); setNewName(''); }}>Cancelar</U.Btn>
            </div>
          </U.Card>
        ) : (
          <U.Btn variant="secondary" icon={I.plus(14)} onClick={() => setAdding(true)}>Agregar proveedor nuevo</U.Btn>
        )}
      </div>

      {/* Generador de etiquetas */}
      {labelFor && <LabelGenerator code={labelFor.code} me={me} onClose={() => setLabelFor(null)} />}
    </div>
  );
}

// ── Generador de etiquetas (código + QR · una por caja) ──────
function LabelGenerator({ code, me, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [phase, setPhase] = pUseState('docs'); // docs → labels
  const [docs, setDocs] = pUseState({ packing: false, factura: false, fotos: 0 });
  const [boxes, setBoxes] = pUseState(30);
  const n = Math.max(1, Math.min(500, parseInt(boxes) || 1));

  // QR procedural (estilizado · el QR real lo genera el backend)
  const qr = (seed) => {
    const m = 11; const cell = 100 / m; let r = '';
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
      if (Math.abs(x - m/2) < 2 && Math.abs(y - m/2) < 2) continue;
      if ((Math.sin((x * 7 + y * 13 + seed) * 1.7) + 1) > 1.05) r += `<rect x="${x*cell}" y="${y*cell}" width="${cell*0.92}" height="${cell*0.92}" fill="#0F1E3D"/>`;
    }
    [[0,0],[m-7,0],[0,m-7]].forEach(([cx,cy]) => { r += `<rect x="${cx*cell}" y="${cy*cell}" width="${cell*7}" height="${cell*7}" fill="none" stroke="#7F0F1A" stroke-width="${cell}"/><rect x="${(cx+2)*cell}" y="${(cy+2)*cell}" width="${cell*3}" height="${cell*3}" fill="#7F0F1A"/>`; });
    return r;
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(11,20,40,0.6)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-base)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 560, maxHeight: '88vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)' }}>Etiquetas para el proveedor</div>
            <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{code}</code>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          {phase === 'docs' && (
            <div>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Paso 1 · Adjuntá la compra</div>
              <p style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
                Antes de generar el código, subí los documentos de la compra. <b>El packing list es lo mínimo</b> — fotos y factura son recomendables para mejor trazabilidad.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { k: 'packing', label: 'Packing list', req: true },
                  { k: 'factura', label: 'Factura proveedor', req: false },
                ].map(d => (
                  <button key={d.k} onClick={() => setDocs({ ...docs, [d.k]: !docs[d.k] })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left', border: `1px solid ${docs[d.k] ? 'var(--success)' : (d.req ? 'var(--wine)' : 'var(--border)')}`, borderRadius: 'var(--r-md)', background: docs[d.k] ? 'var(--success-bg)' : 'var(--bg-surface)', cursor: 'pointer' }}>
                    <span style={{ color: docs[d.k] ? 'var(--success)' : 'var(--ink-mute)' }}>{docs[d.k] ? I.check(15) : I.upload(15)}</span>
                    <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: docs[d.k] ? 'var(--success)' : 'var(--ink)' }}>{d.label}{d.req && !docs[d.k] ? ' ·  obligatorio' : ''}{docs[d.k] ? ' ✓' : ''}</span>
                  </button>
                ))}
                <button onClick={() => setDocs({ ...docs, fotos: docs.fotos + 1 })} style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', textAlign: 'left', border: `1px solid ${docs.fotos ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: docs.fotos ? 'var(--success-bg)' : 'var(--bg-surface)', cursor: 'pointer' }}>
                  <span style={{ color: docs.fotos ? 'var(--success)' : 'var(--ink-mute)', marginTop: 1, flexShrink: 0 }}>{I.upload(15)}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: docs.fotos ? 'var(--success)' : 'var(--ink)' }}>Fotos de los artículos {docs.fotos ? `· ${docs.fotos} cargada${docs.fotos > 1 ? 's' : ''}` : '· recomendado'}</span>
                    <span style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Fotos de los productos que estás comprando · ayudan a verificar tu mercancía.</span>
                  </span>
                </button>
              </div>
              <U.Btn variant="primary" full size="lg" iconRight={I.arrowR(14)} style={{ marginTop: 16 }} disabled={!docs.packing} onClick={() => setPhase('labels')}>
                {docs.packing ? 'Continuar · indicar cajas' : 'Subí el packing list para seguir'}
              </U.Btn>
            </div>
          )}

          {phase === 'labels' && (<>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}><U.Input label="¿Cuántas cajas?" value={boxes} onChange={(e) => setBoxes(e.target.value)} mono numeric /></div>
            <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', paddingBottom: 10 }}>= <b style={{ color: 'var(--wine)' }}>{n} etiqueta{n > 1 ? 's' : ''}</b></div>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 'var(--r-md)', font: '500 11.5px/1.5 var(--f-sans)', marginBottom: 16 }}>
            {I.info(12)} El proveedor pega una etiqueta en cada caja (frente visible). Cada una lleva el código + QR para que el almacén CN la asocie a tu cuenta.
          </div>

          {/* Preview de etiquetas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 280, overflow: 'auto', padding: 2 }}>
            {Array.from({ length: Math.min(n, 6) }, (_, i) => (
              <div key={i} style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', padding: 10, background: '#fff', textAlign: 'center' }}>
                <div style={{ font: '700 7px/1 var(--f-sans)', color: '#9B9B9B', letterSpacing: '0.14em', textTransform: 'uppercase' }}>SHIPPING TO DTD-CARGO</div>
                <svg viewBox="0 0 100 100" style={{ width: 64, height: 64, margin: '6px auto', display: 'block' }} dangerouslySetInnerHTML={{ __html: qr(i) }} />
                <code style={{ font: '800 12px/1 var(--f-mono)', color: '#0F1E3D' }}>{code}</code>
                <div style={{ font: '700 10px/1 var(--f-mono)', color: '#7F0F1A', marginTop: 3 }}>Caja {i + 1} / {n}</div>
                <div style={{ font: '500 8px/1.2 var(--f-sans)', color: '#6B6B6B', marginTop: 2 }}>{me.name}</div>
              </div>
            ))}
          </div>
          {n > 6 && <div style={{ textAlign: 'center', font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 8 }}>… y {n - 6} etiquetas más (Caja 7/{n} … {n}/{n})</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
            <U.Btn variant="secondary" icon={I.copy(13)} onClick={() => navigator.clipboard?.writeText(code)}>Copiar código</U.Btn>
            <U.Btn variant="primary" icon={I.download(13)} onClick={() => window.print()}>Descargar {n} etiquetas (PDF)</U.Btn>
          </div>
          </>)}
        </div>
      </div>
    </div>
  );
}

window.PortalApp = PortalApp;