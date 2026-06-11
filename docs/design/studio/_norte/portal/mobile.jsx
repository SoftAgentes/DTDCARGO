/* global React */
/* ── DTD Portal Cliente · Mobile · shell + Login + Inicio + Envíos ──────
   App de teléfono para el CLIENTE externo (no el equipo DTD).
   Carga DESPUÉS de portal/mobile-extra.jsx. Monta window.PortalMobileApp.
   Reusa tokens + ERPUI + ERPData + Icon. Brand-compliant: logo reverse
   sobre navy, cero hex inventados, fuentes del sistema.                   */

const { useState: pmState, useEffect: pmEffect } = React;

const _pmParams = (() => {try {return new URLSearchParams(window.location.search);} catch (e) {return new URLSearchParams();}})();
const PM_IMPERSONATE = _pmParams.get('as');
const PM_MARKBOX = PM_IMPERSONATE && /^DTD-\d{4}$/.test(PM_IMPERSONATE) ? PM_IMPERSONATE : 'DTD-5452';

// Vibración sutil (si el dispositivo lo soporta) · sensación nativa.
function pmHaptic(ms = 8) {try {if (navigator.vibrate) navigator.vibrate(ms);} catch (e) {}}

// Genera un Shipping Mark secuencial (usa el helper del bridge si está; si no, fallback).
function pmGenMarkbox() {
  try {if (window.DTDData && window.DTDData.nextMarkbox) return window.DTDData.nextMarkbox();} catch (e) {}
  return `DTD-${5500 + Math.floor(Math.random() * 480)}`;
}

// ── Persistencia de cuenta + sesión (sobrevive al refresh) ───
const PM_ACC_KEY = 'dtd-portal-mobile-account';
const PM_SESSION_KEY = 'dtd-portal-mobile-logged';
function pmReadAccount() {try {const r = localStorage.getItem(PM_ACC_KEY);return r ? JSON.parse(r) : null;} catch (e) {return null;}}
function pmWriteAccount(a) {try {if (a) localStorage.setItem(PM_ACC_KEY, JSON.stringify(a));else localStorage.removeItem(PM_ACC_KEY);} catch (e) {}}
function pmReadSession() {try {return localStorage.getItem(PM_SESSION_KEY) === '1';} catch (e) {return false;}}
function pmWriteSession(v) {try {localStorage.setItem(PM_SESSION_KEY, v ? '1' : '0');} catch (e) {}}

// ── Geografía de Venezuela · estados → ciudades → municipios (con CP) ──
// Direcciones EXACTAS de lista (el cliente no escribe estado/ciudad/municipio).
const PM_GEO = [
{ estado: 'Distrito Capital', cities: [
  { ciudad: 'Caracas', municipios: [{ m: 'Libertador', cp: '1010' }, { m: 'Chacao', cp: '1060' }, { m: 'Baruta', cp: '1080' }, { m: 'Sucre', cp: '1071' }] }]
},
{ estado: 'Carabobo', cities: [
  { ciudad: 'Valencia', municipios: [{ m: 'Valencia', cp: '2001' }, { m: 'Naguanagua', cp: '2005' }, { m: 'San Diego', cp: '2006' }, { m: 'Los Guayos', cp: '2009' }] },
  { ciudad: 'Puerto Cabello', municipios: [{ m: 'Puerto Cabello', cp: '2050' }, { m: 'Morón', cp: '2056' }] }]
},
{ estado: 'La Guaira', cities: [
  { ciudad: 'La Guaira', municipios: [{ m: 'Vargas', cp: '1160' }, { m: 'Maiquetía', cp: '1162' }, { m: 'Catia La Mar', cp: '1162' }] }]
},
{ estado: 'Miranda', cities: [
  { ciudad: 'Los Teques', municipios: [{ m: 'Guaicaipuro', cp: '1201' }] },
  { ciudad: 'Guarenas', municipios: [{ m: 'Plaza', cp: '1220' }] },
  { ciudad: 'Charallave', municipios: [{ m: 'Cristóbal Rojas', cp: '1213' }] }]
},
{ estado: 'Aragua', cities: [
  { ciudad: 'Maracay', municipios: [{ m: 'Girardot', cp: '2101' }, { m: 'Mario Briceño Iragorry', cp: '2103' }] },
  { ciudad: 'La Victoria', municipios: [{ m: 'José Félix Ribas', cp: '2121' }] }]
},
{ estado: 'Zulia', cities: [
  { ciudad: 'Maracaibo', municipios: [{ m: 'Maracaibo', cp: '4001' }, { m: 'San Francisco', cp: '4004' }] },
  { ciudad: 'Cabimas', municipios: [{ m: 'Cabimas', cp: '4013' }] }]
},
{ estado: 'Lara', cities: [
  { ciudad: 'Barquisimeto', municipios: [{ m: 'Iribarren', cp: '3001' }, { m: 'Palavecino', cp: '3023' }] }]
},
{ estado: 'Falcón', cities: [
  { ciudad: 'Punto Fijo', municipios: [{ m: 'Carirubana', cp: '4102' }] },
  { ciudad: 'Coro', municipios: [{ m: 'Miranda', cp: '4101' }] }]
},
{ estado: 'Anzoátegui', cities: [
  { ciudad: 'Barcelona', municipios: [{ m: 'Bolívar', cp: '6001' }] },
  { ciudad: 'Puerto La Cruz', municipios: [{ m: 'Sotillo', cp: '6023' }] }]
},
{ estado: 'Táchira', cities: [
  { ciudad: 'San Cristóbal', municipios: [{ m: 'San Cristóbal', cp: '5001' }] }]
}];


// ════════════════════════════════════════════════════════════════
// SHELL
// ════════════════════════════════════════════════════════════════
function PortalMobileApp() {
  const D = window.ERPData;
  const X = window.PMExtra;
  const [logged, setLogged] = pmState(() => !!PM_IMPERSONATE || pmReadSession());
  const [authView, setAuthView] = pmState('welcome'); // welcome | login | register
  const [account, setAccount] = pmState(pmReadAccount); // cuenta registrada (persistida)
  const [verify, setVerify] = pmState(false); // overlay de verificación
  const [toast, setToast] = pmState(null); // aviso flotante (ej. Shipping Mark aprobado)
  const [tab, setTab] = pmState('home');
  const [detail, setDetail] = pmState(null); // shipment id
  const [sub, setSub] = pmState(null); // subpantalla en "Más"
  const [quote, setQuote] = pmState(false); // overlay estimador
  const [notif, setNotif] = pmState(false);
  const [welcome, setWelcome] = pmState(false);
  const [refreshing, setRefreshing] = pmState(false);
  const [refreshKey, setRefreshKey] = pmState(0);
  const [theme, setTheme] = pmState(() => {try {return localStorage.getItem('dtd-portal-mobile-theme') || 'light';} catch (e) {return 'light';}});

  pmEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {localStorage.setItem('dtd-portal-mobile-theme', theme);} catch (e) {}
  }, [theme]);

  pmEffect(() => {pmWriteAccount(account);}, [account]);
  pmEffect(() => {pmWriteSession(logged);}, [logged]);

  const finishLogin = () => {
    const first = (() => {try {return !localStorage.getItem('dtd-portal-mobile-seen');} catch (e) {return false;}})();
    if (first) {try {localStorage.setItem('dtd-portal-mobile-seen', '1');} catch (e) {}setWelcome(true);}
    pmHaptic(12);
    setLogged(true);
  };

  // Registro: crea la cuenta (ENTRA al app) pero SIN Shipping Mark. El Shipping Mark se
  // asigna recién al completar la verificación (dirección + cédula).
  const finishRegister = (acc) => {
    setAccount({ ...acc, markbox: null, status: 'unverified' });
    pmHaptic(12);
    setLogged(true);
    setTab('home');
  };

  // Verificación: envía los documentos → quedan EN REVISIÓN. El Shipping Mark se
  // asigna cuando DTD aprueba (simulado con un timer en esta demo).
  const doVerify = (addr) => {
    pmHaptic(16);
    setAccount((a) => ({ ...a, ...addr, status: 'revision', submittedAt: Date.now() }));
    setVerify(false);
  };

  // Aprobación simulada: al estar EN REVISIÓN, asigna el Shipping Mark a los ~6s.
  // Usa el MISMO backend canónico que el registro web (window.DTDData):
  // nextMarkbox secuencial+validado → publica el cliente al store compartido
  // (lo ve el ERP) → manda el email de bienvenida (template m-05).
  pmEffect(() => {
    if (!account || account.status !== 'revision') return;
    const t = setTimeout(() => {
      const DD = window.DTDData;
      const mb = (DD && DD.nextMarkbox) ? DD.nextMarkbox() : pmGenMarkbox();

      // Publicar al ERP vía bridge compartido (mismo shape que registro.jsx)
      if (DD && DD.clients) {
        try {
          const newClient = {
            markbox: mb, name: account.name, company: account.company || null,
            tipo: account.tipo, cedula: account.rif, email: account.email,
            phone: account.phone, whatsapp: true,
            state: account.estado, municipio: account.municipio, city: account.ciudad,
            postalCode: account.cp, address: account.address, reference: account.reference,
            photoFachada: account.photoFachada || null, photoCedula: account.photoCedula || null,
            tier: 'standard', origin: 'portal-mobile',
            since: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(),
          };
          const cur = DD.clients.read() || [];
          DD.clients.write([newClient, ...cur]);
          if (DD.sendWelcomeEmail) { try { DD.sendWelcomeEmail(newClient); } catch (e) {} }
          if (DD.pushPortalEvent) {
            try {
              DD.pushPortalEvent({
                kind: 'registro', tone: 'wine', markbox: mb,
                title: 'Registro nuevo · ' + (newClient.name || 'cliente'),
                detail: (newClient.company ? newClient.company + ' · ' : '') + 'Esperando aprobación',
                channel: 'portal-mobile',
              });
            } catch (e) {}
          }
        } catch (e) { console.error('[mobile] publish cliente falló:', e); }
      }

      setAccount((a) => a && a.status === 'revision' ? { ...a, status: 'verified', markbox: mb } : a);
      setToast(`Shipping Mark aprobado · ${mb}`);
      pmHaptic(18);
      setTimeout(() => setToast(null), 4200);
    }, 6000);
    return () => clearTimeout(t);
  }, [account && account.status]);

  if (!logged) {
    if (authView === 'login') return <PMLogin onLogin={finishLogin} onRegister={() => setAuthView('register')} onBack={() => setAuthView('welcome')} />;
    if (authView === 'register') return <PMRegister onDone={finishRegister} onBack={() => setAuthView('login')} />;
    return <PMIntro onLogin={() => setAuthView('login')} onRegister={() => setAuthView('register')} />;
  }

  // Cuenta nueva (sin verificar) vs cliente demo/existente (verificado).
  const status = account ? account.status : 'verified';
  const verified = status === 'verified';
  const inReview = status === 'revision';
  const me = account ?
  { name: account.name, company: account.company || account.name, markbox: account.markbox, rif: account.rif, segment: account.tipo === 'empresa' ? 'Empresa' : 'Persona', city: account.city || '—', shipments: 0 } :
  D.byMarkbox(PM_MARKBOX);
  const _pmq = (() => { try { return (window.DTDData && window.DTDData.clientEstimados) ? window.DTDData.clientEstimados(PM_MARKBOX) : []; } catch (e) { return []; } })();
  const ships = account ? [] : [..._pmq, ...D.SHIPMENTS.filter((s) => s.client === PM_MARKBOX)];
  const invs = account ? [] : D.INVOICES.filter((i) => i.client === PM_MARKBOX);
  const alertCount = ships.filter((s) => s.alert || s.status === 'liberado').length;

  const go = (t) => {pmHaptic();setTab(t);setDetail(null);setSub(null);};

  const doRefresh = () => {
    setRefreshing(true);
    pmHaptic(14);
    setTimeout(() => {setRefreshKey((k) => k + 1);setRefreshing(false);}, 850);
  };

  if (verify) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--ink)' }}>
      <PMVerify me={me} onBack={() => setVerify(false)} onSubmit={doVerify} />
    </div>);


  if (quote) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--ink)' }}>
      <X.EstimadorScreen onBack={() => setQuote(false)} me={me} />
    </div>);


  return (
    <div style={{ minHeight: '100vh', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))', background: 'var(--bg-base)', color: 'var(--ink)' }}>
      <PMTopBar me={me} verified={verified} inReview={inReview} alertCount={alertCount} onBell={() => {pmHaptic();setNotif(true);}} />

      <PMPullToRefresh onRefresh={doRefresh} refreshing={refreshing}>
      <main key={tab + (detail || '') + (sub || '') + refreshKey} style={{ animation: 'erp-route-in 220ms var(--ease) both' }}>
        {tab === 'home' && !detail && <PMHome me={me} ships={ships} invs={invs} go={go} openDetail={(id) => {setTab('shipments');setDetail(id);}} openQuote={() => setQuote(true)} onBell={() => setNotif(true)} verified={verified} inReview={inReview} onVerify={() => setVerify(true)} />}
        {tab === 'shipments' && !detail && <PMShipments ships={ships} openDetail={setDetail} />}
        {tab === 'shipments' && detail && <PMDetail id={detail} onBack={() => setDetail(null)} />}
        {tab === 'pay' && <X.PagarScreen invs={invs} />}
        {tab === 'suppliers' && <X.ProveedoresScreen me={me} verified={verified} inReview={inReview} onVerify={() => setVerify(true)} />}
        {tab === 'more' && !sub && <X.MasScreen me={me} theme={theme} setTheme={setTheme} onLogout={() => {setLogged(false);setAuthView('welcome');setTab('home');}} onOpen={setSub} />}
        {tab === 'more' && sub === 'documentos' && <X.DocumentosScreen onBack={() => setSub(null)} ships={ships} />}
        {tab === 'more' && sub === 'referidos' && <X.ReferidosScreen onBack={() => setSub(null)} me={me} />}
        {tab === 'more' && sub === 'soporte' && <X.SoporteScreen onBack={() => setSub(null)} />}
        {tab === 'more' && sub === 'perfil' && <X.PerfilScreen onBack={() => setSub(null)} me={me} />}
      </main>
      </PMPullToRefresh>

      <PMBottomNav tab={tab} onTab={go} payCount={invs.filter((i) => i.balance > 0).length} />
      <X.NotifSheet open={notif} onClose={() => setNotif(false)} ships={ships} />
      <PMWelcome open={welcome} onClose={() => setWelcome(false)} me={me} />
      {toast &&
      <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(84px + env(safe-area-inset-bottom))', zIndex: 70, width: 'min(440px, calc(100% - 24px))', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'var(--bg-sidebar)', color: '#fff', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)', animation: 'mobile-bounce-in 320ms var(--ease) both' }}>
          <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.check(17)}</span>
          <span style={{ flex: 1, font: '700 13px/1.3 var(--f-sans)' }}>{toast}</span>
        </div>
      }
    </div>);

}

// ── Pull-to-refresh ──────────────────────────────────────────
function PMPullToRefresh({ onRefresh, refreshing, children }) {
  const I = window.Icon;
  const [pull, setPull] = pmState(0);
  const start = React.useRef(null);
  const THRESH = 64;

  const onStart = (e) => {if ((window.scrollY || 0) <= 0) start.current = e.touches[0].clientY;};
  const onMove = (e) => {
    if (start.current == null) return;
    const d = e.touches[0].clientY - start.current;
    if (d > 0 && (window.scrollY || 0) <= 0) setPull(Math.min(d * 0.5, 90));else
    start.current = null;
  };
  const onEnd = () => {
    if (pull >= THRESH && !refreshing) onRefresh();
    setPull(0);
    start.current = null;
  };

  const showing = refreshing || pull > 4;
  return (
    <div onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'center',
        height: refreshing ? 44 : pull, overflow: 'hidden', pointerEvents: 'none',
        opacity: showing ? 1 : 0, transition: start.current == null ? 'height 220ms var(--ease)' : 'none'
      }}>
        <span style={{
          marginTop: 12, color: 'var(--wine)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transform: refreshing ? 'none' : `rotate(${pull * 4}deg)`,
          animation: refreshing ? 'erp-spin 700ms linear infinite' : 'none'
        }}>{I.refresh(20)}</span>
      </div>
      <div style={{
        transform: `translateY(${refreshing ? 44 : pull}px)`,
        transition: start.current == null ? 'transform 220ms var(--ease)' : 'none'
      }}>{children}</div>
    </div>);

}

// ── Welcome / onboarding (primera vez) ───────────────────────
function PMWelcome({ open, onClose, me }) {
  const I = window.Icon;
  const items = [
  { icon: 'ship', tone: 'wine', t: 'Sigue tu carga', d: 'Tracking en vivo de cada embarque, etapa por etapa.' },
  { icon: 'invoice', tone: 'warning', t: 'Paga y sube comprobante', d: 'Tus facturas con desglose, sin llamadas.' },
  { icon: 'calc', tone: 'info', t: 'Estima al instante', d: 'Estimación DDP puerta a puerta desde el teléfono.' },
  { icon: 'warehouse', tone: 'success', t: 'Compra en China', d: 'Nueva compra o recompra a tus fábricas con tu Shipping Mark.' }];

  return (
    <window.PM.Sheet open={open} onClose={onClose}>
      <div style={{ textAlign: 'left' }}>
        <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Bienvenido, {me.name.split(' ')[0]}</div>
        <h2 style={{ font: '900 24px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '8px 0 18px' }}>Tu carga, en tu bolsillo.</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--s-5)' }}>
          {items.map((it, i) =>
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', color: `var(--${it.tone})`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I[it.icon]?.(18)}</span>
              <div><div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{it.t}</div><div style={{ font: '500 12px/1.35 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{it.d}</div></div>
            </div>
          )}
        </div>
        <window.ERPUI.Btn variant="primary" full onClick={() => {pmHaptic(12);onClose();}}>Empezar</window.ERPUI.Btn>
      </div>
    </window.PM.Sheet>);

}

// ── Top bar (navy · logo reverse) ────────────────────────────
function PMTopBar({ me, verified, inReview, alertCount, onBell }) {
  const I = window.Icon;
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'var(--bg-sidebar)', color: '#fff',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))'
    }}>
      <img src="assets/dtdcargo-isologo-reverse.png" alt="DTD-Cargo" style={{ height: 26, objectFit: 'contain' }} onError={(e) => {e.target.style.display = 'none';}} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Portal Cliente</div>
        {me.markbox ?
        <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'rgba(255,255,255,0.9)', marginTop: 4, display: 'block' }}>{me.markbox}</code> :
        inReview ?
        <span style={{ font: '700 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.85)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{I.clock(11)} En revisión</span> :
        <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}>{I.warn(11)} Sin verificar</span>}
      </div>
      <button onClick={onBell} aria-label="Avisos" style={{ width: 40, height: 40, borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.08)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {I.bell(18)}
        {alertCount > 0 && <span style={{ position: 'absolute', top: 7, right: 8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '800 9.5px/16px var(--f-sans)', textAlign: 'center' }}>{alertCount}</span>}
      </button>
    </header>);

}

// ── Bottom nav ───────────────────────────────────────────────
function PMBottomNav({ tab, onTab, payCount }) {
  const I = window.Icon;
  const items = [
  { k: 'home', label: 'Inicio', icon: 'dashboard' },
  { k: 'shipments', label: 'Envíos', icon: 'ship' },
  { k: 'pay', label: 'Pagar', icon: 'invoice', badge: payCount },
  { k: 'suppliers', label: 'Proveedores', icon: 'tag' },
  { k: 'more', label: 'Más', icon: 'more' }];

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 480, margin: '0 auto',
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
      background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
      padding: '8px 6px', paddingBottom: 'max(8px, env(safe-area-inset-bottom))', zIndex: 40
    }}>
      {items.map((it) => {
        const active = tab === it.k;
        return (
          <button key={it.k} onClick={() => onTab(it.k)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            padding: '6px 2px', borderRadius: 'var(--r-md)', position: 'relative',
            color: active ? 'var(--wine)' : 'var(--ink-mute)',
            font: `${active ? '700' : '500'} 9.5px/1 var(--f-sans)`
          }}>
            <span style={{ position: 'relative' }}>
              {I[it.icon]?.(21)}
              {it.badge > 0 && <span style={{ position: 'absolute', top: -4, right: -8, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '800 9px/15px var(--f-sans)', textAlign: 'center' }}>{it.badge}</span>}
            </span>
            {it.label}
          </button>);

      })}
    </nav>);

}

// ════════════════════════════════════════════════════════════════
// BIENVENIDA · pantalla de entrada (intro de marca)
// ════════════════════════════════════════════════════════════════
function PMIntro({ onLogin, onRegister }) {
  const I = window.Icon;
  const props = [
  { icon: 'ship', t: 'Tracking en vivo' },
  { icon: 'invoice', t: 'Pagá sin llamadas' },
  { icon: 'calc', t: 'Estima al instante' }];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', padding: '0 24px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 'max(40px, env(safe-area-inset-top))' }}>
        <img src="assets/dtdcargo-isologo-reverse.png" alt="DTD-Cargo" style={{ height: 64, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 32 }} onError={(e) => {e.target.style.display = 'none';}} />
        <h1 style={{ font: '900 36px/1.05 var(--f-display)', letterSpacing: '-0.03em', margin: '0 0 14px' }}>Tu carga,<br />en tu bolsillo.</h1>
        <p style={{ font: '500 15px/1.55 var(--f-sans)', color: 'rgba(255,255,255,0.72)', margin: '0 0 32px', maxWidth: 340 }}>
          El portal de DTD-Cargo para importar desde China sin intermediarios. Con Confianza, de China a tu puerta.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {props.map((p, i) =>
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.08)', color: 'var(--wine-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I[p.icon]?.(18)}</span>
              <span style={{ font: '600 14px/1.2 var(--f-sans)', color: 'rgba(255,255,255,0.9)' }}>{p.t}</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 'calc(28px + env(safe-area-inset-bottom))' }}>
        <button onClick={() => {pmHaptic();onRegister();}} style={{ padding: '15px', borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', font: '800 14.5px/1 var(--f-sans)', cursor: 'pointer' }}>Crear cuenta</button>
        <button onClick={() => {pmHaptic();onLogin();}} style={{ padding: '15px', borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', font: '800 14.5px/1 var(--f-sans)', cursor: 'pointer' }}>Ya tengo cuenta · Entrar</button>
      </div>
    </div>);

}

// ════════════════════════════════════════════════════════════════
// REGISTRO · crear cuenta (datos completos → ENTRA al app, sin Shipping Mark)
// ════════════════════════════════════════════════════════════════
function PMRegister({ onDone, onBack }) {
  const U = window.ERPUI;
  const [step, setStep] = pmState(1);
  const [d, setD] = pmState({ tipo: 'empresa', name: '', company: '', rif: '', email: '', phone: '', city: '', pw: '' });
  const set = (patch) => setD({ ...d, ...patch });

  const step1ok = d.name.trim() && d.rif.trim() && (d.tipo === 'persona' || d.company.trim());
  const step2ok = d.email.trim() && d.phone.trim() && d.city.trim() && d.pw.length >= 4;

  const inStyle = { padding: '13px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 15px/1 var(--f-sans)', width: '100%' };
  const lbl = { font: '700 11px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6, display: 'block' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--ink)' }}>
      <window.PM.SubHeader title="Crear cuenta" subtitle={`Paso ${step} de 2 · datos de la cuenta`} onBack={step === 1 ? onBack : () => setStep(1)} />
      <div style={{ padding: '18px 16px 28px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 'var(--s-6)' }}>
          {[1, 2].map((n) => <span key={n} style={{ flex: 1, height: 4, borderRadius: 'var(--r-pill)', background: n <= step ? 'var(--wine)' : 'var(--border)' }} />)}
        </div>

        {step === 1 &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
            <div>
              <span style={lbl}>Tipo de cliente</span>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['empresa', 'Empresa'], ['persona', 'Persona']].map(([k, t]) =>
              <button key={k} onClick={() => set({ tipo: k })} style={{ flex: 1, padding: '12px', borderRadius: 'var(--r-md)', border: `1px solid ${d.tipo === k ? 'var(--wine)' : 'var(--border)'}`, background: d.tipo === k ? 'var(--wine-tint)' : 'var(--bg-surface)', color: d.tipo === k ? 'var(--wine)' : 'var(--ink-soft)', font: '700 13px/1 var(--f-sans)', cursor: 'pointer' }}>{t}</button>
              )}
              </div>
            </div>
            <div><span style={lbl}>{d.tipo === 'empresa' ? 'Nombre del responsable' : 'Nombre completo'}</span><input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ej. Carlos Méndez" style={inStyle} /></div>
            {d.tipo === 'empresa' && <div><span style={lbl}>Empresa</span><input value={d.company} onChange={(e) => set({ company: e.target.value })} placeholder="Ej. Acindar Comercial CA" style={inStyle} /></div>}
            <div><span style={lbl}>{d.tipo === 'empresa' ? 'RIF' : 'Cédula'}</span><input value={d.rif} onChange={(e) => set({ rif: e.target.value })} placeholder={d.tipo === 'empresa' ? 'J-30182554-9' : 'V-18254663'} style={{ ...inStyle, fontFamily: 'var(--f-mono)' }} /></div>
            <U.Btn variant="primary" full disabled={!step1ok} onClick={() => {pmHaptic();setStep(2);}}>Continuar</U.Btn>
          </div>
        }

        {step === 2 &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-5)' }}>
            <div><span style={lbl}>Email</span><input type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} placeholder="tú@empresa.com" style={inStyle} /></div>
            <div><span style={lbl}>Teléfono / WhatsApp</span><input value={d.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+58 412 000 0000" style={{ ...inStyle, fontFamily: 'var(--f-mono)' }} /></div>
            <div><span style={lbl}>Ciudad en Venezuela</span><input value={d.city} onChange={(e) => set({ city: e.target.value })} placeholder="Valencia · Caracas · Maracaibo…" style={inStyle} /></div>
            <div><span style={lbl}>Contraseña</span><input type="password" value={d.pw} onChange={(e) => set({ pw: e.target.value })} placeholder="Mínimo 4 caracteres" style={inStyle} /></div>
            <U.Btn variant="primary" full disabled={!step2ok} onClick={() => {pmHaptic(12);onDone(d);}}>Crear cuenta y entrar</U.Btn>
            <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: 0, textAlign: 'center' }}>Tu Shipping Mark se asigna después, al verificar tu identidad (dirección + cédula). Al crear la cuenta aceptás los términos de DTD-Cargo.</p>
          </div>
        }
      </div>
    </div>);

}

// ════════════════════════════════════════════════════════════════
// VERIFICACIÓN · dirección + cédula → asigna el Shipping Mark
// ════════════════════════════════════════════════════════════════
function PMVerify({ me, onBack, onSubmit }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [a, setA] = pmState({ estado: '', ciudad: '', municipio: '', cp: '', address: '', reference: '' });
  const [cedula, setCedula] = pmState(null);
  const [fachada, setFachada] = pmState(null);
  const empresa = me.segment === 'Empresa';

  // Cascada estado → ciudad → municipio (con CP automático). Sin texto libre.
  const estadoObj = PM_GEO.find((e) => e.estado === a.estado);
  const cityObj = estadoObj && estadoObj.cities.find((c) => c.ciudad === a.ciudad);
  const estadoOpts = PM_GEO.map((e) => ({ value: e.estado, label: e.estado }));
  const cityOpts = estadoObj ? estadoObj.cities.map((c) => ({ value: c.ciudad, label: c.ciudad })) : [];
  const muniOpts = cityObj ? cityObj.municipios.map((m) => ({ value: m.m, label: m.m, sub: 'CP ' + m.cp })) : [];

  const pickEstado = (v) => setA({ ...a, estado: v, ciudad: '', municipio: '', cp: '' });
  const pickCiudad = (v) => setA({ ...a, ciudad: v, municipio: '', cp: '' });
  const pickMunicipio = (v) => {
    const m = cityObj && cityObj.municipios.find((x) => x.m === v);
    setA({ ...a, municipio: v, cp: m ? m.cp : '' });
  };

  const ok = a.estado && a.ciudad && a.municipio && a.address.trim() && cedula && (!empresa || fachada);

  const inStyle = { padding: '13px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 15px/1 var(--f-sans)', width: '100%' };
  const lbl = { font: '700 11px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6, display: 'block' };

  const Upload = ({ file, onFile, label, desc }) =>
  <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--bg-surface)', border: `1px dashed ${file ? 'var(--success)' : 'var(--border-strong, var(--border))'}`, borderRadius: 'var(--r-lg)', cursor: 'pointer' }}>
      <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', color: file ? 'var(--success)' : 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{file ? I.check(18) : I.upload(18)}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{file ? 'Adjuntado' : label}</span>
        <span style={{ display: 'block', font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file || desc}</span>
      </span>
      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files[0] ? e.target.files[0].name : null)} />
    </label>;


  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--ink)' }}>
      <window.PM.SubHeader title="Verificar identidad" subtitle="Último paso para obtener tu Shipping Mark" onBack={onBack} />
      <div style={{ padding: '16px 16px 28px' }}>
        <div style={{ display: 'flex', gap: 12, padding: 14, marginBottom: 'var(--s-6)', background: 'var(--wine-tint)', borderRadius: 'var(--r-lg)' }}>
          <span style={{ color: 'var(--wine)', flexShrink: 0 }}>{I.info(18)}</span>
          <p style={{ font: '500 12.5px/1.45 var(--f-sans)', color: 'var(--ink)', margin: 0 }}>Necesitamos tu dirección de entrega en Venezuela y tu cédula{empresa ? ' + fachada del local' : ''} para activar tu Shipping Mark y poder importar a tu nombre.</p>
        </div>

        <window.PM.Section title="DIRECCIÓN EN VENEZUELA">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><U.SearchSelect label="Estado" value={a.estado} onChange={pickEstado} options={estadoOpts} placeholder="Elige tu estado" /></div>
              <div style={{ flex: 1 }}><U.SearchSelect label="Ciudad" value={a.ciudad} onChange={pickCiudad} options={cityOpts} placeholder={a.estado ? 'Elige ciudad' : 'Elige estado primero'} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}><U.SearchSelect label="Municipio" value={a.municipio} onChange={pickMunicipio} options={muniOpts} placeholder={a.ciudad ? 'Elige municipio' : 'Elige ciudad primero'} /></div>
              <div style={{ width: 110 }}><span style={lbl}>Código postal</span><input value={a.cp} readOnly placeholder="—" style={{ height: 38, padding: '0 10px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--ink-soft)', font: '500 13px/1 var(--f-mono)', width: '100%', boxSizing: 'border-box', cursor: 'not-allowed' }} /></div>
            </div>
            <div><span style={lbl}>Dirección exacta</span><input value={a.address} onChange={(e) => setA({ ...a, address: e.target.value })} placeholder="Ej. Av. Bolívar, edificio Centro, piso 3, of. 3-B" style={inStyle} /></div>
            <div><span style={lbl}>Punto de referencia</span><input value={a.reference} onChange={(e) => setA({ ...a, reference: e.target.value })} placeholder="Opcional · cerca de…" style={inStyle} /></div>
            <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: 0 }}>Estado, ciudad, municipio y código postal salen de nuestra lista oficial — elegílos para que la entrega sea exacta. Solo escribe la <strong style={{ color: 'var(--ink-soft)' }}>dirección exacta</strong> (avenida, calle, edificio).</p>
          </div>
        </window.PM.Section>

        <window.PM.Section title="DOCUMENTOS">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Upload file={cedula} onFile={setCedula} label="Foto de la cédula" desc="Frente, legible" />
            {empresa && <Upload file={fachada} onFile={setFachada} label="Foto de la fachada" desc="Del local o galpón" />}
          </div>
          {empresa &&
          <div style={{ display: 'flex', gap: 10, marginTop: 10, padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <span style={{ color: 'var(--info)', flexShrink: 0 }}>{I.info(15)}</span>
              <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}><strong style={{ color: 'var(--ink)' }}>¿Por qué la fachada?</strong> Confirma que el local existe y coincide con tu RIF. Así protegemos tus entregas, evitamos fraudes de identidad y el chofer reconoce el lugar al llegar.</p>
            </div>
          }
        </window.PM.Section>

        <U.Btn variant="primary" full disabled={!ok} icon={I.shield(14)} onClick={() => onSubmit(a)}>Obtener mi Shipping Mark</U.Btn>
        {!ok && <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '12px 0 0', textAlign: 'center' }}>Elige estado, ciudad y municipio, escribe la dirección y sube tu cédula{empresa ? ' y fachada' : ''} para continuar.</p>}
      </div>
    </div>);

}

// ════════════════════════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════════════════════════
function PMLogin({ onLogin, onRegister, onBack }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const _saved = pmReadAccount();
  const [markbox, setMarkbox] = pmState(_saved && _saved.markbox || PM_MARKBOX);
  const [pw, setPw] = pmState('');
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 24px', paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
        {onBack && <button onClick={onBack} aria-label="Volver" style={{ position: 'absolute', top: 'max(16px, env(safe-area-inset-top))', left: 16, width: 40, height: 40, borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.1)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.arrowL(18)}</button>}
        <img src="assets/dtdcargo-isologo-reverse.png" alt="DTD-Cargo" style={{ height: 44, objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 24 }} onError={(e) => {e.target.style.display = 'none';}} />
        <h1 style={{ font: '900 28px/1.1 var(--f-display)', letterSpacing: '-0.025em', margin: '0 0 10px' }}>Bienvenido de vuelta.</h1>
        <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.7)', margin: '0 0 28px', maxWidth: 320 }}>
          Entra con tu Shipping Mark para ver tus embarques y facturas.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--r-xl)', padding: 20 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: '700 11px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Tu Shipping Mark</span>
            <input value={markbox} onChange={(e) => setMarkbox(e.target.value)} style={{ padding: '13px 14px', borderRadius: 'var(--r-md)', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#fff', font: '700 15px/1 var(--f-mono)', letterSpacing: '0.02em' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ font: '700 11px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>Contraseña</span>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" style={{ padding: '13px 14px', borderRadius: 'var(--r-md)', border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.06)', color: '#fff', font: '500 15px/1 var(--f-sans)' }} />
          </label>
          <button onClick={onLogin} style={{ marginTop: 4, padding: '14px', borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', font: '800 14px/1 var(--f-sans)', cursor: 'pointer' }}>Entrar</button>
          <button onClick={onLogin} style={{ background: 'none', border: 0, color: 'rgba(255,255,255,0.55)', font: '600 12px/1 var(--f-sans)', cursor: 'pointer' }}>¿Olvidaste tu contraseña?</button>
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: '0 24px calc(24px + env(safe-area-inset-bottom))', font: '500 12.5px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.6)' }}>
        ¿No tienes cuenta? <button onClick={onRegister} style={{ background: 'none', border: 0, color: '#fff', font: '800 12.5px/1 var(--f-sans)', textDecoration: 'underline', cursor: 'pointer' }}>Crear cuenta</button>
      </div>
    </div>);

}

// ════════════════════════════════════════════════════════════════
// INICIO
// ════════════════════════════════════════════════════════════════
function PMHome({ me, ships, invs, go, openDetail, openQuote, verified, inReview, onVerify }) {
  const D = window.ERPData;
  const I = window.Icon;
  const active = ships.filter((s) => !['entregado', 'estimado'].includes(s.status));
  const next = ships.find((s) => s.status === 'tránsito') || ships.find((s) => s.status === 'aduana VE') || active[0];
  const outstanding = invs.reduce((s, i) => s + i.balance, 0);

  return (
    <div style={{ padding: '18px 16px 24px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h1 style={{ font: '900 28px/1.05 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em', margin: '8px 0 6px' }}>Hola, {me.name.split(' ')[0]}.</h1>
        <p style={{ font: '500 13.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}>
          {active.length} {active.length === 1 ? 'envío activo' : 'envíos activos'}{outstanding > 0 ? ` · $${outstanding.toLocaleString()} por pagar` : ' · estás al día'}
        </p>
      </div>

      {/* Banner de verificación · sin Shipping Mark */}
      {!verified && (
      inReview ?
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: 18, marginBottom: 'var(--s-5)', borderRadius: 'var(--r-xl)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', color: 'var(--info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.clock(20)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: '800 14.5px/1.2 var(--f-display)', color: 'var(--ink)' }}>Verificación en revisión</span>
              <span style={{ display: 'block', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Estamos validando tus documentos. Te asignamos tu Shipping Mark apenas aprobemos.</span>
            </span>
          </div> :

      <button onClick={onVerify} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, padding: 18, marginBottom: 'var(--s-5)', borderRadius: 'var(--r-xl)', border: 0, background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', cursor: 'pointer' }}>
            <span style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.1)', color: 'var(--wine-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.shield(20)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', font: '800 14.5px/1.2 var(--f-display)' }}>Obtené tu Shipping Mark</span>
              <span style={{ display: 'block', font: '500 12px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>Completa tu verificación (dirección + cédula) para empezar a importar.</span>
            </span>
            <span style={{ color: 'var(--wine-soft)', flexShrink: 0 }}>{I.chevR(18)}</span>
          </button>)

      }
      {next &&
      <button onClick={() => openDetail(next.id)} style={{ width: '100%', textAlign: 'left', display: 'block', padding: 0, border: 0, borderRadius: 'var(--r-xl)', overflow: 'hidden', background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', marginBottom: 'var(--s-5)', cursor: 'pointer' }}>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Próximo arribo</div>
            <window.ERPUI.StatusBadge status={next.status} size="sm" />
          </div>
          <code style={{ font: '900 24px/1.1 var(--f-mono)', color: '#fff', display: 'block', margin: '12px 0 8px', letterSpacing: '-0.01em' }}>{next.id}</code>
          <div style={{ font: '500 13px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.72)' }}>
            {D.origin(next.origin).name} <span style={{ color: 'var(--wine-soft)' }}>→</span> {D.dest(next.destination).name}
          </div>
          {/* arco de progreso */}
          <svg viewBox="0 0 320 92" style={{ width: '100%', height: 84, margin: '8px 0 4px' }}>
            <path d="M 16 78 Q 160 6 304 78" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" strokeDasharray="4 5" />
            <path d={`M 16 78 Q 160 6 ${16 + 288 * (next.progress / 100)} ${78 - 72 * Math.sin(Math.PI * (next.progress / 100)) * (1 - next.progress / 200)}`} fill="none" stroke="var(--wine-soft)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="16" cy="78" r="5" fill="#fff" />
            <circle cx="304" cy="78" r="5" fill="var(--wine)" />
            <g transform={`translate(${16 + 288 * (next.progress / 100)}, ${78 - 72 * Math.sin(Math.PI * (next.progress / 100)) * (1 - next.progress / 200)})`}>
              <circle r="14" fill="var(--wine-soft)" opacity="0.25"><animate attributeName="r" values="14;20;14" dur="2.4s" repeatCount="indefinite" /></circle>
              <circle r="7" fill="var(--wine)" stroke="#fff" strokeWidth="2" />
            </g>
          </svg>
          <div style={{ display: 'flex', gap: 24 }}>
            <div><div style={{ font: '500 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ETA</div><div style={{ font: '900 18px/1 var(--f-display)', color: '#fff', marginTop: 5 }}>{next.eta || '—'}</div></div>
            <div><div style={{ font: '500 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Progreso</div><div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--wine-soft)', marginTop: 5 }}>{next.progress}%</div></div>
            <div><div style={{ font: '500 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tipo</div><div style={{ font: '900 18px/1 var(--f-display)', color: '#fff', marginTop: 5 }}>{next.type}</div></div>
          </div>
        </div>
        </button>
      }

      {/* KPIs 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 'var(--s-6)' }}>
        <PMMini label="Envíos activos" value={active.length} sub="en curso" tone="wine" onClick={() => go('shipments')} />
        <PMMini label="Entregados" value={ships.filter((s) => s.status === 'entregado').length} sub="100% on-time" tone="success" />
        <PMMini label="Por pagar" value={`$${(outstanding / 1000).toFixed(1)}K`} sub={`${invs.filter((i) => i.balance > 0).length} facturas`} tone={outstanding > 0 ? 'warning' : 'success'} onClick={() => go('pay')} />
        <PMMini label="Facturado YTD" value={`$${(invs.reduce((s, i) => s + i.amount, 0) / 1000).toFixed(0)}K`} sub="2026" tone="info" />
      </div>

      {/* Acciones rápidas */}
      <window.PM.Section title="ACCIONES RÁPIDAS">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <PMAction icon="calc" label="Crear estimado" desc="Estimar nuevo envío" tone="info" onClick={openQuote} />
          <PMAction icon="warehouse" label="Comprar en China" desc="Nueva compra o recompra" tone="wine" onClick={() => go('suppliers')} />
          <PMAction icon="invoice" label="Pagar factura" desc={outstanding > 0 ? `$${(outstanding / 1000).toFixed(1)}K pendiente` : 'Al día'} tone="warning" onClick={() => go('pay')} />
          <PMAction icon="chat" label="Hablar con agente" desc="Martina · en línea" tone="success" onClick={() => go('more')} />
        </div>
      </window.PM.Section>

      {/* Tus envíos */}
      <window.PM.Section title="TUS ENVÍOS" right={<button onClick={() => go('shipments')} style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver todos {window.Icon.arrowR(11)}</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ships.slice(0, 3).map((s) =>
          <PMShipRow key={s.id} s={s} onClick={() => openDetail(s.id)} />
          )}
        </div>
      </window.PM.Section>
    </div>);

}

function PMMini({ label, value, sub, tone = 'wine', onClick }) {
  const tones = { wine: 'var(--wine)', info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)' };
  return (
    <button onClick={onClick} style={{ textAlign: 'left', padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</div>
      <div style={{ font: '900 24px/1 var(--f-display)', color: tones[tone], letterSpacing: '-0.02em', margin: '8px 0 5px' }}>{value}</div>
      <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{sub}</div>
    </button>);

}

function PMAction({ icon, label, desc, tone = 'wine', onClick }) {
  const I = window.Icon;
  const tones = { wine: 'var(--wine)', info: 'var(--info)', success: 'var(--success)', warning: 'var(--warning)' };
  return (
    <button onClick={onClick} style={{ textAlign: 'left', padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <span style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', color: tones[tone], display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I[icon]?.(18)}</span>
      <span><span style={{ display: 'block', font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{label}</span><span style={{ display: 'block', font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{desc}</span></span>
    </button>);

}

function PMShipRow({ s, onClick }) {
  const D = window.ERPData;
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
        <window.ERPUI.StatusBadge status={s.status} size="sm" />
      </div>
      <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)', marginBottom: 10 }}>
        {D.origin(s.origin).name} <span style={{ color: 'var(--wine)' }}>→</span> {D.dest(s.destination).name}
      </div>
      <window.ERPUI.Progress value={s.progress} tone={s.alert ? 'warning' : 'wine'} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
        <span>{s.progress}%</span><span>ETA {s.eta || '—'}</span>
      </div>
    </button>);

}

// ════════════════════════════════════════════════════════════════
// ENVÍOS · lista
// ════════════════════════════════════════════════════════════════
function PMShipments({ ships, openDetail }) {
  const [filter, setFilter] = pmState('active');
  const [q, setQ] = pmState('');
  const I = window.Icon;
  const U = window.ERPUI;
  const list = ships.filter((s) => {
    if (filter === 'active' && s.status === 'entregado') return false;
    if (filter === 'delivered' && s.status !== 'entregado') return false;
    if (q && !s.id.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ padding: '18px 16px 24px' }}>
      <h1 style={{ font: '900 26px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 16px' }}>Mis envíos</h1>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)' }}>{I.search(15)}</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por ID…" style={{ width: '100%', padding: '12px 14px 12px 38px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13.5px/1 var(--f-sans)' }} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--s-5)', overflowX: 'auto', paddingBottom: 2 }}>
        <window.PM.Chip active={filter === 'active'} onClick={() => setFilter('active')} count={ships.filter((s) => s.status !== 'entregado').length}>En curso</window.PM.Chip>
        <window.PM.Chip active={filter === 'all'} onClick={() => setFilter('all')} count={ships.length}>Todos</window.PM.Chip>
        <window.PM.Chip active={filter === 'delivered'} onClick={() => setFilter('delivered')} count={ships.filter((s) => s.status === 'entregado').length}>Entregados</window.PM.Chip>
      </div>

      {list.length === 0 ?
      <U.EmptyState icon={I.ship(22)} title="Sin envíos" body="No hay embarques en esta vista." /> :

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((s) =>
        <PMShipCard key={s.id} s={s} onClick={() => openDetail(s.id)} />
        )}
        </div>
      }
    </div>);

}

function PMShipCard({ s, onClick }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', cursor: 'pointer' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
        <code style={{ font: '900 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
        <window.ERPUI.StatusBadge status={s.status} size="sm" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 11 }}>
        <span style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.origin(s.origin).name}</span>
        <span style={{ color: 'var(--wine)' }}>→</span>
        <span style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.dest(s.destination).name}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
        <U.Badge tone="neutral" size="sm">{s.type}</U.Badge>
        <span style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{s.cbm} CBM</span>
        {s.alert && <U.Badge tone="warning" size="sm" dot>alerta</U.Badge>}
      </div>
      <U.Progress value={s.progress} tone={s.alert ? 'warning' : 'wine'} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
        <span>{s.progress}%</span><span>ETA {s.eta || '—'}</span>
      </div>
    </button>);

}

// ════════════════════════════════════════════════════════════════
// DETALLE · timeline vertical
// ════════════════════════════════════════════════════════════════
function pmLegalDate(iso) {
  const [y, m, d] = iso.split('-');
  const MM = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][parseInt(m) - 1];
  return `${parseInt(d)} ${MM} ${y}`;
}
function PMAcceptFlow({ quote, me, open, onClose, onAccepted }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [checked, setChecked] = pmState(false);
  const [viewing, setViewing] = pmState(null);
  const docs = (window.LegalData && window.LegalData.currentDocs()) || [];
  const close = () => { setChecked(false); setViewing(null); onClose(); };
  const confirm = () => {
    if (!checked) return;
    const ev = {
      id: 'AC-2026-' + String(Math.floor(215 + Math.random() * 80)).padStart(4, '0'),
      client: me.company || me.name, markbox: me.markbox, quote: quote.id, orden: quote.id.replace('E-', 'OV-'),
      cbm: quote.cbm, weight: quote.weight, total: quote.amount,
      docs: docs.map(d => [d.name, d.version]),
      at: (() => { const n = new Date(); const p = x => String(x).padStart(2,'0'); return `${p(n.getDate())}/${p(n.getMonth()+1)}/${n.getFullYear()} ${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`; })(),
      ip: me.ip || '190.142.88.214',
      hash: ('sha256:' + 'a1f' + Math.random().toString(16).slice(2,10) + 'c7' + Math.random().toString(16).slice(2,8)).slice(0,30),
    };
    try { if (window.LegalData) window.LegalData.ACCEPTANCES.unshift(ev); } catch (e) {}
    onAccepted(ev);
  };
  return (
    <React.Fragment>
      <U.Modal open={open && !viewing} onClose={close} width={460} title="Aceptar estimado"
        actions={<div style={{ display: 'flex', gap: 8, width: '100%' }}><U.Btn variant="ghost" full onClick={close}>Cancelar</U.Btn><U.Btn variant="primary" full disabled={!checked} onClick={confirm} icon={I.check(14)}>Confirmar</U.Btn></div>}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', marginBottom: 12 }}>
          <button onClick={() => setChecked(!checked)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: 14, textAlign: 'left', background: checked ? 'var(--wine-tint)' : 'var(--bg-surface)', border: 0 }}>
            <span style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1, borderRadius: 'var(--r-xs)', border: `2px solid ${checked ? 'var(--wine)' : 'var(--border-strong)'}`, background: checked ? 'var(--wine)' : 'var(--bg-surface)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{checked && I.check(13)}</span>
            <div style={{ font: '600 12.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
              He leído y acepto los{' '}
              {docs[0] && <a onClick={(e) => { e.stopPropagation(); setViewing(docs[0]); }} style={{ color: 'var(--wine)', textDecoration: 'underline', fontWeight: 700 }}>Términos y Condiciones de DTD</a>}
              {' '}y las{' '}
              {docs[1] && <a onClick={(e) => { e.stopPropagation(); setViewing(docs[1]); }} style={{ color: 'var(--wine)', textDecoration: 'underline', fontWeight: 700 }}>Condiciones del Operador de Consolidación</a>}.</div>
          </button>
          <div style={{ borderTop: '1px solid var(--border)', padding: '9px 14px', display: 'flex', flexWrap: 'wrap', gap: 6, background: 'var(--bg-elevated)' }}>
            {docs.map(d => <button key={d.key} onClick={() => setViewing(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', font: '600 10px/1 var(--f-sans)', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}><span style={{ color: 'var(--wine)', display: 'flex' }}>{I.doc(10)}</span>{d.version} · vig. {pmLegalDate(d.effective)}</button>)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)' }}>
          <span style={{ color: 'var(--info)', display: 'flex', flexShrink: 0, marginTop: 1 }}>{I.shield(14)}</span>
          <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink)' }}>Registramos tu aceptación como evidencia (cliente, estimado, versión, fecha/hora, IP y hash). Se pide en cada estimado.</div>
        </div>
      </U.Modal>
      <U.Modal open={!!viewing} onClose={() => setViewing(null)} width={520} title={viewing ? `${viewing.name} · ${viewing.version}` : ''} actions={<U.Btn variant="primary" full onClick={() => setViewing(null)}>Cerrar</U.Btn>}>
        {viewing && <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 360, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
          <div style={{ display: 'flex', gap: 8 }}><U.Badge tone="wine" size="sm">{viewing.version}</U.Badge><U.Badge tone="neutral" size="sm">Vigente desde {pmLegalDate(viewing.effective)}</U.Badge></div>
          {viewing.body.map(([h, p], i) => <div key={i}><div style={{ font: '800 12.5px/1.3 var(--f-display)', color: 'var(--ink)', marginBottom: 4 }}>{h}</div><div style={{ font: '500 12px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>{p}</div></div>)}
        </div>}
      </U.Modal>
    </React.Fragment>
  );
}
function PMDetail({ id, onBack }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const s = (() => { try { const q = (window.DTDData && window.DTDData.clientEstimados) ? window.DTDData.clientEstimados(PM_MARKBOX).find(x => x.id === id) : null; return q || D.SHIPMENTS.find((x) => x.id === id); } catch (e) { return D.SHIPMENTS.find((x) => x.id === id); } })();
  const [accepting, setAccepting] = pmState(false);
  const [evidence, setEvidence] = pmState(null);
  const [acuse, setAcuse] = pmState(false);
  if (!s) return null;
  const flow = D.STATUS_FLOW;
  const cur = flow.indexOf(s.status);
  const pmAccepted = (qid) => { try { return (window.LegalData && window.LegalData.ACCEPTANCES.some(a => a.quote === qid)); } catch (e) { return false; } };
  const quote = { id: s.id.startsWith('E-') ? s.id : 'E-2026-' + s.id.slice(-4), route: `${D.origin(s.origin).name} → ${D.dest(s.destination).name}`, cbm: s.cbm, weight: s.weight, amount: s.value, type: s.type, total: '$' + (s.value || 0).toLocaleString('en-US') };
  const meQ = { company: s.clientName, markbox: s.client, ip: '190.142.88.214' };
  const _accForQuote = (() => { try { return (window.LegalData ? window.LegalData.ACCEPTANCES : []).filter(a => a.quote === quote.id); } catch (e) { return []; } })();
  const acceptedCurrent = !!evidence || _accForQuote.some(a => Number(a.cbm) === Number(s.cbm) && Number(a.weight) === Number(s.weight));
  const priorDiff = (!acceptedCurrent && _accForQuote.length > 0) ? _accForQuote[0] : null;
  const inReview = s.status === 'estimado' && s.quoteStage === 'en-proceso';
  const needsAccept = (s.status === 'estimado' || s.status === 'recibido CN') && !acceptedCurrent && !inReview;
  const isMeasured = s.status === 'recibido CN';
  const isReaccept = !!priorDiff;
  const fmtUsd = (n) => '$' + (Number(n) || 0).toLocaleString('en-US');

  return (
    <div>
      <window.PM.SubHeader title={s.id} subtitle={`${D.origin(s.origin).name} → ${D.dest(s.destination).name}`} onBack={onBack} />
      <div style={{ padding: '16px 16px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--s-5)' }}>
          <window.ERPUI.StatusBadge status={s.status} size="md" />
          <U.Badge tone="neutral" size="md">{s.type}</U.Badge>
          <span style={{ font: '600 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{s.cbm} CBM</span>
        </div>

        {inReview &&
        <div style={{ display: 'flex', gap: 12, padding: 14, marginBottom: 'var(--s-5)', background: 'var(--info-bg)', borderRadius: 'var(--r-lg)', borderLeft: '3px solid var(--info)' }}>
            <span style={{ color: 'var(--info)', flexShrink: 0 }}>{I.clock ? I.clock(18) : I.info(18)}</span>
            <div><div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>Estimado en proceso</div><div style={{ font: '500 12px/1.45 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>Tu agente está preparando el estimado formal{s.quoteRef ? ` (ref. ${s.quoteRef})` : ''}. Te avisamos apenas esté lista para aceptar.</div></div>
          </div>
        }

        {needsAccept &&
        <div style={{ display: 'flex', gap: 12, padding: 14, marginBottom: 'var(--s-5)', background: 'var(--wine-tint)', borderRadius: 'var(--r-lg)', borderLeft: '3px solid var(--wine)' }}>
            <span style={{ color: 'var(--wine)', flexShrink: 0 }}>{I.shield(18)}</span>
            <div><div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>{isReaccept ? 'La medida cambió · re-aceptación' : (isMeasured ? 'Llegó y se midió · falta tu aceptación' : 'Estimado pendiente')}</div><div style={{ font: '500 12px/1.45 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{isReaccept ? 'Aceptaste el estimado pero la medida real cambió. Confirma la nuevo estimado para emitir la factura.' : (isMeasured ? `Medimos tu carga (${s.cbm} m³ · ${(s.weight||0).toLocaleString()} kg). Aceptá el estimado con la medida real para emitir tu factura.` : 'Aceptá los términos para generar tu orden de servicio.')}</div>{isReaccept && <div style={{ display: 'flex', gap: 10, marginTop: 10, font: '600 12px/1.3 var(--f-mono)' }}><span style={{ color: 'var(--ink-soft)', textDecoration: 'line-through' }}>{priorDiff.cbm} m³ · {fmtUsd(priorDiff.total)}</span><span style={{ color: 'var(--wine)' }}>→</span><span style={{ color: 'var(--ink)', fontWeight: 800 }}>{s.cbm} m³ · {fmtUsd(s.value)}</span></div>}</div>
          </div>
        }

        {s.alert &&
        <div style={{ display: 'flex', gap: 12, padding: 14, marginBottom: 'var(--s-5)', background: 'var(--warning-bg)', borderRadius: 'var(--r-lg)', borderLeft: '3px solid var(--warning)' }}>
            <span style={{ color: 'var(--warning)', flexShrink: 0 }}>{I.warn(18)}</span>
            <div><div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>Aviso</div><div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{s.alert}. Tu agente sigue el caso.</div></div>
          </div>
        }

        {/* stats */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 'var(--s-6)' }}>
          <PMStat label="Progreso" value={`${s.progress}%`} tone="wine" />
          <PMStat label="ETA" value={s.eta || '—'} mono />
          <PMStat label="Buque" value={s.vessel || 'pendiente'} small />
        </div>

        {/* Timeline vertical */}
        <window.PM.Section title="SEGUIMIENTO">
          <U.Card padded style={{ padding: '20px 18px' }}>
            {flow.map((step, i) => {
              const done = i < cur,current = i === cur,last = i === flow.length - 1;
              return (
                <div key={step} style={{ display: 'flex', gap: 14, minHeight: last ? 'auto' : 38 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: '50%', background: current || done ? 'var(--wine)' : 'var(--bg-elevated)', border: `2px solid ${current || done ? 'var(--wine)' : 'var(--border-strong, var(--border))'}`, color: current || done ? '#fff' : 'var(--ink-mute)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '700 10px/1 var(--f-sans)' }}>
                      {done ? '✓' : i + 1}
                    </span>
                    {!last && <span style={{ width: 2, flex: 1, minHeight: 18, background: done ? 'var(--wine)' : 'var(--border)', margin: '3px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: last ? 0 : 14 }}>
                    <div style={{ font: `${current ? '800' : '600'} 13.5px/1.2 var(--f-sans)`, color: current ? 'var(--ink)' : done ? 'var(--ink-soft)' : 'var(--ink-mute)', textTransform: 'capitalize' }}>{step}</div>
                    {current && <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--wine)', marginTop: 3 }}>Etapa actual</div>}
                  </div>
                </div>);

            })}
          </U.Card>
        </window.PM.Section>

        <div style={{ display: 'flex', gap: 10 }}>
          {inReview ? (
            <U.Btn variant="secondary" full icon={I.clock ? I.clock(14) : I.info(14)} disabled>En revisión por tu agente</U.Btn>
          ) : needsAccept ? (
            <U.Btn variant="primary" full icon={I.check(14)} onClick={() => setAccepting(true)}>{isReaccept ? 'Revisar y re-aceptar' : (isMeasured ? 'Aceptar · medida real' : 'Aceptar estimado')}</U.Btn>
          ) : (
            <React.Fragment>
              {evidence && <U.Btn variant="secondary" full icon={I.shield(14)} onClick={() => setAcuse(true)}>Ver acuse</U.Btn>}
              <U.Btn variant="secondary" full icon={I.download(14)}>Descargar docs</U.Btn>
              <U.Btn variant="primary" full icon={I.chat(14)}>Contactar agente</U.Btn>
            </React.Fragment>
          )}
        </div>

        <PMAcceptFlow quote={quote} me={meQ} open={accepting} onClose={() => setAccepting(false)} onAccepted={(ev) => { setAccepting(false); setEvidence(ev); setAcuse(true); }} />
        <U.Modal open={acuse} onClose={() => setAcuse(false)} width={460} title="Orden generada" actions={<U.Btn variant="primary" full onClick={() => setAcuse(false)} icon={I.check(14)}>Entendido</U.Btn>}>
          {evidence && (() => {
            const Row = ({ k, v }) => <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '8px 0', borderTop: '1px solid var(--border)' }}><span style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', flexShrink: 0 }}>{k}</span><span style={{ font: '600 11.5px/1.4 var(--f-mono)', color: 'var(--ink)', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span></div>;
            return <div><div style={{ textAlign: 'center', padding: '4px 0 14px' }}><div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{I.check(26)}</div><div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)' }}>Estimado aceptado</div><div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>Orden <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{evidence.orden}</code> generada.</div></div><div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '2px 14px 12px' }}><Row k="Cliente" v={`${evidence.client} · ${evidence.markbox}`} /><Row k="Estimado" v={evidence.quote} />{evidence.docs.map((d, i) => <Row key={i} k={i === 0 ? 'Documentos' : ''} v={`${d[0]} ${d[1]}`} />)}<Row k="Fecha / hora" v={evidence.at} /><Row k="IP" v={evidence.ip} /><Row k="Hash" v={evidence.hash} /></div></div>;
          })()}
        </U.Modal>
      </div>
    </div>);

}

function PMStat({ label, value, tone, mono, small }) {
  return (
    <div style={{ flex: 1, padding: '14px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
      <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: `${small ? '700' : '900'} ${small ? '12px' : '17px'}/1.1 ${mono || small ? 'var(--f-mono)' : 'var(--f-display)'}`, color: tone === 'wine' ? 'var(--wine)' : 'var(--ink)', marginTop: 7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>);

}

window.PortalMobileApp = PortalMobileApp;