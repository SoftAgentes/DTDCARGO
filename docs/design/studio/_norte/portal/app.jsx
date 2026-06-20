/* global React */
/* ── DTD Portal del Cliente · App ──────────────────────────── */
/* Vista que ve el cliente externo (no admin DTD).            */
/* Reusa tokens + componentes del ERP.                         */

const { useState: pUseState, useEffect: pUseEffect } = React;
const { useTweaks: pUseTweaks, TweaksPanel: TPanel, TweakSection: TSection, TweakRadio: TRadio } = window;

// Defaults de Tweaks · capa de “sensación” (todo dentro del sistema de marca).
const PORTAL_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "densidad": "regular",
  "titulares": "sora",
  "forma": "equilibrado"
}/*EDITMODE-END*/;

// Quién es el cliente "logueado" en este mock.
// Soporta impersonación admin vía ?as=DTD-XXXX (modo cliente · demo).
const _portalParams = (() => {try {return new URLSearchParams(window.location.search);} catch (e) {return new URLSearchParams();}})();
const IMPERSONATE = _portalParams.get('as');
const DEMO_MARKBOX = IMPERSONATE && /^DTD-\d{4}$/.test(IMPERSONATE) ? IMPERSONATE : 'DTD-5452';

function PortalApp() {
  const D = window.ERPData;
  const [logged, setLogged] = pUseState(!!IMPERSONATE);
  const [showPwTip, setShowPwTip] = pUseState(false);
  const [tour, setTour] = pUseState(false);
  const [view, setView] = pUseState('home');
  const [detail, setDetail] = pUseState(null);
  const [theme, setTheme] = pUseState('light');

  pUseEffect(() => {document.documentElement.setAttribute('data-theme', theme);}, [theme]);

  // ── Tweaks · reshape de “sensación” (densidad / titulares / forma) ──
  const [tw, setTweak] = pUseTweaks(PORTAL_TWEAK_DEFAULTS);
  pUseEffect(() => {
    const el = document.documentElement;
    // Densidad → seam data-density de tokens.css
    if (tw.densidad === 'compacta') el.setAttribute('data-density', 'compact');
    else if (tw.densidad === 'espaciosa') el.setAttribute('data-density', 'spacious');
    else el.removeAttribute('data-density');
    // Titulares → --f-display (ambas fuentes son del sistema aprobado)
    el.style.setProperty('--f-display', tw.titulares === 'marca'
      ? "'Archivo Black', 'Archivo', sans-serif"
      : "'Sora', 'Nunito Sans', sans-serif");
    // Forma → remapeo de radios dentro de la escala (sin pasar de 20px)
    const R = {
      tecnico:     { xs: '2px', sm: '3px', md: '4px', lg: '6px',  xl: '9px'  },
      equilibrado: { xs: '3px', sm: '5px', md: '7px', lg: '10px', xl: '14px' },
      amable:      { xs: '5px', sm: '9px', md: '12px', lg: '16px', xl: '20px' }
    }[tw.forma];
    if (R) ['xs', 'sm', 'md', 'lg', 'xl'].forEach((k) => el.style.setProperty('--r-' + k, R[k]));
  }, [tw.densidad, tw.titulares, tw.forma]);

  if (!logged) return <PortalLogin onLogin={() => {
    const firstTime = !localStorage.getItem('dtd-portal-visited');
    localStorage.setItem('dtd-portal-visited', '1');
    sessionStorage.removeItem('dtd-from-registro'); // el hint “es tu cédula” no vuelve a aparecer
    setShowPwTip(firstTime);
    setTour(firstTime);
    setLogged(true);
  }} />;

  const me = D.CLIENTS.find((c) => c.markbox === DEMO_MARKBOX);
  const _pq = (() => {try {return window.DTDData && window.DTDData.clientEstimados ? window.DTDData.clientEstimados(DEMO_MARKBOX) : [];} catch (e) {return [];}})();
  const myShipments = [..._pq, ...D.SHIPMENTS.filter((s) => s.client === DEMO_MARKBOX)];
  const myInvoices = D.INVOICES.filter((i) => i.client === DEMO_MARKBOX);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--ink)' }}>
      <PortalTopbar
        me={me}
        view={view} setView={(v) => {setView(v);setDetail(null);}}
        onLogout={() => setLogged(false)}
        onTour={() => setTour(true)}
        theme={theme} setTheme={setTheme} />
      

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 'var(--s-8) var(--s-6)' }}>
        {showPwTip &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', marginBottom: 'var(--s-5)', background: 'var(--info-bg)', border: '1px solid var(--info)', borderRadius: 'var(--r-md)' }}>
            <span style={{ color: 'var(--info)' }}>{window.Icon.info(16)}</span>
            <span style={{ flex: 1, font: '600 13px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Recomendamos cambiar tu contraseña <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>· entra a tu perfil para hacerlo (es solo una sugerencia)</span></span>
            <button onClick={() => setShowPwTip(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
        }
        <div key={view + (detail || '')} style={{ animation: 'erp-route-in 240ms var(--ease)' }}>
          {view === 'home' && <PortalHome me={me} ships={myShipments} invs={myInvoices} setView={setView} setDetail={setDetail} />}
          {view === 'shipments' && <PortalAlertas me={me} ships={myShipments} setDetail={setDetail} detail={detail} setView={setView} defaultTab="envios" />}
          {view === 'suppliers' && <PortalAlertas me={me} ships={myShipments} setDetail={setDetail} detail={detail} setView={setView} defaultTab="compras" />}
          {view === 'nueva-compra' && <PortalNuevaCompra me={me} setView={setView} />}
          {view === 'invoices' && <PortalInvoices invs={myInvoices} ships={myShipments} />}
          {view === 'documents' && <PortalDocuments />}
          {view === 'referidos' && <PortalReferidos me={me} />}
          {view === 'academia' && <PortalAcademiaView />}
          {view === 'support' && <PortalSupport me={me} />}
          {view === 'profile' && <PortalProfile me={me} />}
          {view === 'calculadora' && <PortalCalculadora me={me} setView={setView} />}
        </div>
      </main>

      <PortalFooter />
      <PortalCalcFab markbox={DEMO_MARKBOX} />

      {/* Panel de Tweaks · solo visible cuando el usuario activa “Tweaks” */}
      <TPanel title="Tweaks">
        <TSection label="Sensación" />
        <TRadio label="Densidad" value={tw.densidad}
          options={[{ value: 'compacta', label: 'Compacta' }, { value: 'regular', label: 'Media' }, { value: 'espaciosa', label: 'Amplia' }]}
          onChange={(v) => setTweak('densidad', v)} />
        <TRadio label="Titulares" value={tw.titulares}
          options={[{ value: 'sora', label: 'Sistema' }, { value: 'marca', label: 'Marca' }]}
          onChange={(v) => setTweak('titulares', v)} />
        <TRadio label="Forma" value={tw.forma}
          options={[{ value: 'tecnico', label: 'Técnico' }, { value: 'equilibrado', label: 'Medio' }, { value: 'amable', label: 'Amable' }]}
          onChange={(v) => setTweak('forma', v)} />
      </TPanel>
    </div>);

}

// ── Academia · vista del alumno (desktop: catálogo + progreso) ──
function PortalAcademiaView() {
  const A = window.AcademiaData;
  const I = window.Icon;
  const U = window.ERPUI;
  const [full, setFull] = pUseState(false);

  if (!A) {
    return (
      <div style={{ padding: 24, font: '500 13px var(--f-sans)', color: 'var(--ink-soft)' }}>Cargando Academia…</div>);
  }

  if (full) {
    const Aca = window.PortalAcademia;
    return (
      <div>
        <button onClick={() => setFull(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14, background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Volver a la Academia</button>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: 420, height: 'min(780px, calc(100vh - 210px))', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
            {Aca ? <Aca topInset={0} bottomInset={0} /> : <div style={{ padding: 24, font: '500 13px var(--f-sans)', color: 'var(--ink-soft)' }}>Cargando Academia…</div>}
          </div>
        </div>
      </div>);
  }

  const LEVELS = ['Curso 0', 'Nivel 1', 'Nivel 2', 'Nivel 3'];
  const rec = A.recommended();
  const recP = A.courseProgress(rec);
  const next = A.nextLesson(rec);
  const open = () => setFull(true);

  return (
    <div>
      <div className="eyebrow eyebrow-wine">ACADEMIA DTD</div>
      <h1 style={{ font: '900 32px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em', margin: '8px 0 6px' }}>Tu Academia</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)', maxWidth: '64ch' }}>Aprende a importar de China con la operación real de DTD detrás. Tu progreso, tus cursos y tus diplomas en un solo lugar.</p>

      <div style={{ background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', borderRadius: 'var(--r-xl)', padding: 'var(--s-8)', marginBottom: 'var(--s-6)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--s-6)', alignItems: 'center' }}>
        <div>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wine-soft)' }}>{recP.pct > 0 ? 'Continúa donde quedaste' : 'Tu próximo curso'}</div>
          <div style={{ font: '900 24px/1.1 var(--f-display)', margin: '12px 0 6px', letterSpacing: '-0.02em' }}>{rec.title}</div>
          <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.72)', maxWidth: '52ch' }}>{recP.pct > 0 ? 'Sigue en: ' + next.title : rec.tagline}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18, maxWidth: 420 }}>
            <div style={{ flex: 1, height: 7, borderRadius: 999, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}><div style={{ width: recP.pct + '%', height: '100%', background: 'var(--wine-soft)' }} /></div>
            <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine-soft)' }}>{recP.pct}%</span>
          </div>
        </div>
        <button onClick={open} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 22px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', border: 0, cursor: 'pointer', font: '700 13.5px/1 var(--f-sans)', whiteSpace: 'nowrap' }}>{recP.pct > 0 ? 'Continuar' : 'Empezar'} {I.arrowR(14)}</button>
      </div>

      <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', margin: '0 0 14px' }}>Tu ruta de aprendizaje</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 'var(--s-8)' }}>
        {A.COURSES.map((c) => {
          const p = A.courseProgress(c);
          const enrolled = A.isEnrolled(c.id);
          const dip = A.hasDiploma(c.id);
          return (
            <div key={c.id} onClick={open} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--s-6)', boxShadow: 'var(--shadow-xs)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--wine)', background: 'var(--wine-tint)', padding: '4px 9px', borderRadius: 'var(--r-pill)' }}>{LEVELS[c.level] || ('Nivel ' + c.level)}{c.flagship ? ' · insignia' : ''}</span>
                {c.free && <span style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--success)' }}>Gratis</span>}
                {dip && <span title="Diploma obtenido" style={{ color: 'var(--success)', display: 'flex' }}>{I.check(15)}</span>}
              </div>
              <div>
                <div style={{ font: '800 16px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{c.title}</div>
                <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{c.tagline}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{I.clock(12)} {c.hours} h</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{I.doc(12)} {A.lessonCount(c)} lecciones</span>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                {enrolled ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}><div style={{ width: p.pct + '%', height: '100%', background: p.pct === 100 ? 'var(--success)' : 'var(--wine)' }} /></div>
                    <span style={{ font: '700 11px/1 var(--f-mono)', color: p.pct === 100 ? 'var(--success)' : 'var(--ink-soft)' }}>{p.pct === 100 ? 'Completo' : p.pct + '%'}</span>
                  </div>
                ) : (
                  <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>Ver curso {I.arrowR(11)}</span>
                )}
              </div>
            </div>);
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>PRÓXIMAS COHORTES EN VIVO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {A.COHORTS.map((co, i) => { const c = A.course(co.courseId); return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{c.title}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{A.fmtDate(co.dateISO)} · {co.mode}</div>
                </div>
                <span style={{ font: '600 10.5px/1 var(--f-mono)', color: co.seats - co.taken <= 6 ? 'var(--warning)' : 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{co.seats - co.taken} cupos</span>
              </div>); })}
          </div>
        </U.Card>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>TUS DIPLOMAS</div>
          {A.diplomas.length === 0
            ? <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-mute)' }}>Completa un curso para ganar tu primer diploma verificable.</div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {A.diplomas.map((d, i) => { const c = A.course(d.courseId); return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', border: '1px solid var(--success)', background: 'var(--success-bg)', borderRadius: 'var(--r-md)' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', color: 'var(--success)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.check(16)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{c.title}</div>
                      <code style={{ font: '500 10.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{d.folio} · {A.fmtDate(d.dateISO)}</code>
                    </div>
                  </div>); })}
              </div>}
        </U.Card>
      </div>
    </div>);
}

// ── Login ────────────────────────────────────────────────────
function PortalLogin({ onLogin }) {
  const _demo = (window.ERPData?.CLIENTS || []).find((c) => c.markbox === DEMO_MARKBOX);
  const [email, setEmail] = pUseState(_demo?.email || '');
  const [pw, setPw] = pUseState('');
  const [sent, setSent] = pUseState(false);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 50%, #0B1428 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden'
    }}>
      {/* Decorative pattern */}
      <svg style={{ position: 'absolute', top: 0, right: 0, opacity: 0.06, pointerEvents: 'none' }} width="500" height="500" viewBox="0 0 500 500">
        <g fill="none" stroke="#fff" strokeWidth="1">
          {[...Array(20)].map((_, i) => <circle key={i} cx="250" cy="250" r={20 + i * 22} />)}
        </g>
      </svg>

      <div style={{ width: '100%', maxWidth: 980, display: 'grid', gridTemplateColumns: '1fr 420px', gap: 0, borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--shadow-pop)', position: 'relative' }}>
        {/* Left panel — branding */}
        <div style={{ padding: 44, color: '#fff', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <PortalLogo white />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>PORTAL DEL CLIENTE</div>
            <div style={{ font: '900 38px/1 var(--f-display)', color: '#fff', letterSpacing: '-0.025em' }}>
              Tus envíos<br />desde China,<br /><span style={{ color: 'var(--wine-soft)' }}>en un click.</span>
            </div>
            <div style={{ marginTop: 22, font: '500 14px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.7)', maxWidth: '36ch' }}>
              Estima, embarca y rastrea tus cargas DDP. Facturas, documentos y soporte directo con tu agente.
            </div>
            <div style={{ marginTop: 28, display: 'flex', gap: 18 }}>
              {[
              { v: '99.4%', l: 'On-time' },
              { v: '8.2K', l: 'Cargas/año' },
              { v: '38d', l: 'Tránsito' }].
              map((s) =>
              <div key={s.l}>
                  <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--wine-soft)', letterSpacing: '-0.02em' }}>{s.v}</div>
                  <div style={{ font: '500 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>{s.l}</div>
                </div>
              )}
            </div>
          </div>
          <div style={{ font: '500 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.35)' }}>DTDCARGO.COM · v1.0 · 2026</div>
        </div>

        {/* Right panel — login form */}
        <div style={{ background: 'var(--bg-surface)', padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Entra con tu<br />correo.</div>
          <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>Te mandamos un enlace de acceso a tu correo — entras con un clic, sin contraseñas que recordar.</div>

          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Tu email</span>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && email && setSent(true)}
                placeholder="tu@empresa.com"
                style={{
                  height: 48, padding: '0 14px',
                  background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  font: '600 15px/1 var(--f-sans)', color: 'var(--ink)',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--wine)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
              
            </label>
            {!sent ?
            <button onClick={() => email && setSent(true)} style={{
              height: 48, background: 'var(--wine)', color: '#fff',
              border: 0, borderRadius: 'var(--r-md)',
              font: '700 14px/1 var(--f-sans)', letterSpacing: '0.02em',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginTop: 2
            }}>
              Enviarme el enlace de acceso {window.Icon.arrowR(14)}
            </button> :
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 2 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>{window.Icon.check(16)}</span>
                <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>Te enviamos el enlace · Abre el correo que mandamos a <b style={{ color: 'var(--ink)' }}>{email}</b> y haz clic para entrar.</div>
              </div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <a onClick={() => setSent(false)} style={{ color: 'var(--wine)', cursor: 'pointer', font: '700 12.5px/1 var(--f-sans)' }}>Reenviar enlace</a>
                <a onClick={onLogin} style={{ color: 'var(--ink-mute)', cursor: 'pointer', font: '600 12px/1 var(--f-sans)', marginLeft: 'auto' }}>Entrar (demo) {window.Icon.arrowR(12)}</a>
              </div>
            </div>
            }
            {/* CTA de registro · puerta única: quien no tiene Shipping Mark se registra acá */}
            <div style={{ marginTop: 4, padding: '12px 14px', background: 'var(--wine-tint)', border: '1px solid var(--wine)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ font: '600 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>¿No tienes cuenta?</span>
              <a
                onClick={() => {window.location.href = 'Registro Cliente.html';}}
                style={{ font: '800 13px/1 var(--f-sans)', color: 'var(--wine)', textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                Regístrate {window.Icon.arrowR(13)}</a>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

// ── Topbar ───────────────────────────────────────────────────
function PortalTopbar({ me, view, setView, onLogout, theme, setTheme }) {
  const [userOpen, setUserOpen] = pUseState(false);
  const items = [
  { v: 'home', l: 'Inicio', icon: 'dashboard' },
  { v: 'shipments', l: 'Alertas mis envíos', icon: 'box' },
  { v: 'invoices', l: 'Finanzas', icon: 'invoice' },
  { v: 'referidos', l: 'Referidos', icon: 'star' },
  { v: 'academia', l: 'Academia', icon: 'shield' },
  { v: 'support', l: 'Soporte', icon: 'chat' }];


  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 var(--s-6)',
        display: 'flex', alignItems: 'center', gap: 32, height: 72
      }}>
        <PortalLogo />
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {items.map((it) =>
          <button key={it.v} onClick={() => setView(it.v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 14px', borderRadius: 'var(--r-md)',
            background: view === it.v ? 'var(--wine-tint)' : 'transparent',
            color: view === it.v ? 'var(--wine)' : 'var(--ink-soft)',
            font: `${view === it.v ? '700' : '500'} 13px/1 var(--f-sans)`,
            transition: 'all var(--dur-fast) var(--ease)'
          }}
          onMouseEnter={(e) => {if (view !== it.v) e.currentTarget.style.background = 'var(--bg-elevated)';}}
          onMouseLeave={(e) => {if (view !== it.v) e.currentTarget.style.background = 'transparent';}}>
            
              {window.Icon[it.icon](14)} {it.l}
            </button>
          )}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{
            width: 36, height: 36, borderRadius: 'var(--r-md)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-soft)'
          }}>{theme === 'dark' ? window.Icon.sun(15) : window.Icon.moon(15)}</button>

          <div style={{ position: 'relative' }}>
            <button onClick={() => setUserOpen((v) => !v)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 12px 4px 4px', borderRadius: 'var(--r-pill)',
              background: 'var(--bg-elevated)', marginLeft: 6
            }}>
              <window.ERPUI.Avatar initials={me.name.split(' ').map((w) => w[0]).slice(0, 2).join('')} size={30} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{me.name}</div>
                <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{me.markbox}</code>
              </div>
              <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.chevD(12)}</span>
            </button>
            {userOpen &&
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 240, background: 'var(--bg-surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
              animation: 'erp-pop 200ms var(--ease)'
            }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{me.name}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{me.email}</div>
                </div>
                <div style={{ padding: 6 }}>
                  <button onClick={() => {setView('profile');setUserOpen(false);}} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', font: '500 13px/1 var(--f-sans)', color: 'var(--ink)' }}>Mi perfil</button>
                  <button style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', font: '500 13px/1 var(--f-sans)', color: 'var(--ink)' }}>Cambiar contraseña</button>
                </div>
                <div style={{ padding: 6, borderTop: '1px solid var(--border)' }}>
                  <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', font: '600 13px/1 var(--f-sans)', color: 'var(--danger)' }}>Cerrar sesión</button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </header>);

}

// Sam (2026-06): "Nueva cotización" es en realidad SOLICITAR UN SERVICIO →
// despliega el menú de servicios. Todo termina en un estimado (solo el cliente
// genera estimados; al aprobar la cotización lo pasamos nosotros).
function ServiceRequestButton({ markbox }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  const wa = (msg) => 'https://wa.me/584121668021?text=' + encodeURIComponent(msg);
  const services = [
    { label: 'Importación de carga', sub: 'LCL / FCL · puerta a puerta', href: `Calculadora CBM · DTD-Cargo.html?mb=${markbox}`, est: true },
    { label: 'Compra asistida', sub: 'Te ayudamos a comprar en China', href: wa('Hola, quiero solicitar el servicio de compra asistida.') },
    { label: 'Inspección en fábrica', sub: 'Verificamos tu mercancía antes de embarcar', href: wa('Hola, quiero solicitar una inspección en fábrica.') },
    { label: 'Consolidación / almacenaje', sub: 'Juntamos tu carga en bodega China', href: wa('Hola, quiero solicitar consolidación / almacenaje.') },
  ];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', cursor: 'pointer'
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
          <span style={{ font: '700 14.5px/1.1 var(--f-sans)', color: 'var(--ink)' }}>Solicitar un servicio</span>
          <span style={{ font: '700 9px/1 var(--f-mono)', color: 'var(--wine)', letterSpacing: '0.14em', marginTop: 4 }}>= ESTIMADO</span>
        </span>
        <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 140ms var(--ease)' }}>▾</span>
      </button>
      {open &&
      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 282, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 40, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', font: '700 9px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Servicios DTD-Cargo · genera un estimado</div>
        {services.map((s, i) => (
          <a key={i} href={s.href} target="_blank" rel="noopener" onClick={() => setOpen(false)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', textDecoration: 'none',
            borderBottom: i < services.length - 1 ? '1px solid var(--border)' : 0
          }}>
            <span>
              <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)', display: 'block' }}>{s.label}</span>
              <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{s.sub}</span>
            </span>
            <span style={{ color: 'var(--wine)', flexShrink: 0 }}>{window.Icon.external(12)}</span>
          </a>
        ))}
      </div>
      }
    </div>
  );
}

function PortalLogo({ white }) {
  // white → superficie navy fija (hero login): siempre reverse + cream.
  // sin white → sigue el tema (primary/wine en light, reverse/cream en dark).
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className={'dtd-iso ' + (white ? 'dtd-iso-ondark' : 'dtd-iso-auto')} style={{ width: 32, height: 32 }}>
        <img className="iso-primary" src="assets/dtdcargo-isologo-primary.png" alt="DTD Cargo" />
        <img className="iso-reverse" src="assets/dtdcargo-isologo-reverse.png" alt="" />
      </span>
      <div style={{ font: '900 19px/1 var(--f-display)', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
        <span style={{ color: white ? '#F2F0EC' : 'var(--wordmark-dtd)' }}>DTD</span>
        <span style={{ display: 'inline-block', width: '0.15em' }}></span>
        <span style={{ color: white ? '#F2F0EC' : 'var(--wordmark-cargo)' }}>Cargo</span>
      </div>
    </div>);

}

// ── Helpers de salidas del cliente ───────────────────────────
// Próxima(s) salida(s) ABIERTAS del puerto del cliente (derivado de
// su carga suelta en almacén CN); fallback: la salida abierta más cercana.
function _clientSailings(markbox) {
  const N = window.NavieraData;
  if (!N) return { N: null };
  const mine = (N.LOOSE_CARGO || []).filter((l) => l.client === markbox);
  const myPol = mine.length ? mine[0].pol : null;
  const open = N.openSailings().slice().sort((a, b) => a.cutoff.localeCompare(b.cutoff));
  const pref = myPol && open.some((s) => s.pol === myPol) ? open.filter((s) => s.pol === myPol) : open;
  const next = pref[0] || null;
  const following = next ? pref[1] || open.find((s) => s.id !== next.id) || null : null;
  return { N, next, following, myPol };
}
function _fmtSail(d) {
  return new Date(d + 'T00:00:00')
    .toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '');
}

// ── Eco del cut-off dentro de "Nueva compra / prealerta" ──────
// Apoyo a la decisión en el momento exacto: cuándo debe llegar la
// mercancía a bodega CN para entrar en el próximo consolidado.
function SailingDeadlineNote({ me }) {
  const { N, next, following } = _clientSailings(me.markbox);
  if (!N || !next) return null;
  const n = N.daysUntil(next.cutoff);
  const urgent = n <= 2;
  const accent = urgent ? 'var(--warning)' : 'var(--wine)';
  const tint = urgent ? 'color-mix(in srgb, var(--warning) 12%, transparent)' : 'var(--wine-tint)';
  const pol = N.port(next.pol), pod = N.port(next.pod);
  const dleft = n <= 0 ? 'cierra hoy' : n === 1 ? 'falta 1 día' : `faltan ${n} días`;
  const mono = { fontFamily: 'var(--f-mono)' };
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', background: tint, border: `1px solid ${accent}`, borderRadius: 'var(--r-md)', marginBottom: 'var(--s-5)' }}>
      <span style={{ color: accent, flexShrink: 0, marginTop: 1 }}>{window.Icon.ship(16)}</span>
      <div style={{ flex: 1 }}>
        <div style={{ font: '800 12.5px/1.3 var(--f-display)', color: 'var(--ink)' }}>
          Próximo consolidado · {pol.name} → {pod.name}
        </div>
        <p style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink-soft)', margin: '4px 0 0' }}>
          Si tu mercancía llega a bodega CN antes del <b style={{ ...mono, color: accent }}>{_fmtSail(next.cutoff)}</b> ({dleft}) entra en el barco que zarpa el <b style={{ ...mono, color: 'var(--ink)' }}>{_fmtSail(next.etd)}</b> y llega aprox. el <b style={{ ...mono, color: 'var(--ink)' }}>{_fmtSail(next.eta)}</b>.{following ? <> El siguiente cierra el <b style={{ ...mono, color: 'var(--ink)' }}>{_fmtSail(following.cutoff)}</b>.</> : null}
        </p>
      </div>
    </div>);
}

// ── Próxima salida de contenedor ─────────────────────────────
// El cliente, apenas entra, ve cuándo cierra la carga del próximo
// consolidado de SU puerto, para organizar sus compras. Cuenta al
// CUT-OFF (cierre de carga), granularidad en días; <48h → urgencia
// en dorado (warning). Datos reales de NavieraData (no inventados).
function NextSailingCard({ me, setView }) {
  const { N, next } = _clientSailings(me.markbox);
  if (!N || !next) return null;
  const fmt = _fmtSail;

  const n = N.daysUntil(next.cutoff);
  const urgent = n <= 2;
  const accent = urgent ? 'var(--warning)' : 'var(--wine)';
  const tint = urgent ? 'color-mix(in srgb, var(--warning) 14%, transparent)' : 'var(--wine-tint)';
  const pol = N.port(next.pol), pod = N.port(next.pod), car = N.carrier(next.carrier);

  const spaceLbl = { alta: 'Espacio amplio', media: 'Espacio medio', baja: 'Espacio limitado', cerrada: 'Cerrado' }[next.space] || 'Disponible';
  const spaceToneVar = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', neutral: 'var(--ink-mute)' }[N.SPACE_TONE[next.space]] || 'var(--ink-mute)';

  const bigNum = n <= 0 ? 'Hoy' : String(n);
  const bigUnit = n <= 0 ? 'cierra hoy' : (n === 1 ? 'día para el cierre' : 'días para el cierre');
  const barPct = Math.max(0.08, Math.min(1, (14 - n) / 14));

  const stat = (label, value, strong) => (
    <div>
      <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: `700 13.5px/1 var(--f-mono)`, color: strong ? accent : 'var(--ink)', marginTop: 7 }}>{value}</div>
    </div>);

  return (
    <window.ERPUI.Card padded={false} style={{ marginBottom: 'var(--s-6)', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr auto', alignItems: 'stretch', gap: 0 }}>
        {/* Bloque cuenta regresiva */}
        <div style={{ background: tint, padding: 'var(--s-5) var(--s-4)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', borderRight: '1px solid var(--border)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: accent }}>
            {window.Icon.ship(15)}
            <span style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Próxima salida</span>
          </div>
          <div style={{ font: '900 46px/0.95 var(--f-display)', color: accent, letterSpacing: '-0.03em', marginTop: 12 }}>{bigNum}</div>
          <div style={{ font: '600 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{bigUnit}</div>
        </div>

        {/* Detalles */}
        <div style={{ padding: 'var(--s-5) var(--s-5)', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 4 }}>
            <span style={{ font: '800 16px/1.2 var(--f-display)', color: 'var(--ink)', whiteSpace: 'nowrap' }}>
              {pol.name} <span style={{ color: accent }}>→</span> {pod.name}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', font: '700 10px/1 var(--f-sans)', color: spaceToneVar }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: spaceToneVar }} /> {spaceLbl}
            </span>
          </div>
          <div style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 8 }}>
            {car ? car.name : ''} · {next.vessel} · {next.voyage}
          </div>

          <div style={{ display: 'flex', gap: 'var(--s-8)', marginTop: 'var(--s-4)' }}>
            {stat('Cierre de carga', fmt(next.cutoff), true)}
            {stat('Zarpa', fmt(next.etd))}
            {stat('Llega aprox.', '~' + fmt(next.eta))}
          </div>

          {/* Barra de presión de tiempo (días, no segundos) */}
          <div style={{ marginTop: 'var(--s-4)', height: 5, borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <div style={{ width: (barPct * 100).toFixed(0) + '%', height: '100%', borderRadius: 'var(--r-pill)', background: accent }} />
          </div>
        </div>

        {/* CTA */}
        <div style={{ padding: 'var(--s-5) var(--s-5)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', gap: 8, borderLeft: '1px solid var(--border)', minWidth: 220 }}>
          <div style={{ font: '500 11.5px/1.45 var(--f-sans)', color: 'var(--ink-soft)', textAlign: 'right', maxWidth: 200 }}>
            {urgent
              ? 'Tu mercancía debe estar en bodega CN antes del cierre para entrar en este consolidado.'
              : 'Organiza tus compras para que lleguen a bodega CN antes del cierre.'}
          </div>
          <window.ERPUI.Btn variant="primary" icon={window.Icon.arrowR(14)} onClick={() => setView('nueva-compra')}>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}><span>Programar mi compra</span><span style={{ font: '700 8.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.82, marginTop: 4 }}>Pre-alerta</span></span>
          </window.ERPUI.Btn>
        </div>
      </div>
    </window.ERPUI.Card>);
}

// ── Home / Dashboard del cliente ─────────────────────────────
function PortalHome({ me, ships, invs, setView, setDetail }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const active = ships.filter((s) => !['entregado', 'estimado'].includes(s.status));
  const inTransit = ships.find((s) => s.status === 'tránsito') || active[0];
  const outstanding = invs.reduce((s, i) => s + i.balance, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 'var(--s-8)' }}>
        <div>
          <div className="eyebrow eyebrow-wine">{new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 style={{ font: '900 38px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em', margin: '8px 0 6px' }}>Hola {me.name.split(' ')[0]}.</h1>
          <p style={{ font: '500 15px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}>
            {active.length} envíos activos · {invs.filter((i) => i.balance > 0).length} {invs.filter((i) => i.balance > 0).length === 1 ? 'factura pendiente' : 'facturas pendientes'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          <ServiceRequestButton markbox={DEMO_MARKBOX} />
          <button onClick={() => setView('calculadora')} title="Estimado de carga nueva" style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', cursor: 'pointer',
            background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)'
          }}>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
              <span style={{ font: '700 14.5px/1.1 var(--f-sans)', color: 'var(--ink)' }}>Calculadora CBM</span>
              <span style={{ font: '700 9px/1 var(--f-mono)', color: 'var(--wine)', letterSpacing: '0.14em', marginTop: 4 }}>GENERAR ESTIMADO</span>
            </span>
            <span style={{ color: 'var(--wine)', display: 'flex' }}>{window.Icon.calc(14)}</span>
          </button>
        </div>
      </div>

      {/* Próxima salida de contenedor · lo primero que ve el cliente */}
      <NextSailingCard me={me} setView={setView} />

      {/* Hero card: next arrival */}
      {inTransit &&
      <U.Card style={{ marginBottom: 'var(--s-6)', padding: 0, overflow: 'hidden', background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', color: '#fff', border: 0, cursor: 'pointer' }}
      onClick={() => {setView('shipments');setDetail(inTransit.id);}}>
        
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
                <path d={`M 30 100 Q 160 30 ${30 + 260 * (inTransit.progress / 100)} ${100 - 70 * Math.sin(Math.PI * (inTransit.progress / 100))}`} fill="none" stroke="var(--wine-soft)" strokeWidth="3" />
                <circle cx="30" cy="100" r="8" fill="#fff" />
                <circle cx="290" cy="100" r="8" fill="var(--wine)" />
                <g transform={`translate(${30 + 260 * (inTransit.progress / 100)}, ${100 - 70 * Math.sin(Math.PI * (inTransit.progress / 100))})`}>
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
      }

      {/* KPIs row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-6)' }}>
        <U.KPI label="Envíos activos" value={active.length} delta="en curso" tone="wine" icon={window.Icon.box(18)} />
        <U.KPI label="Entregados YTD" value={ships.filter((s) => s.status === 'entregado').length} delta="100% on-time" tone="success" icon={window.Icon.check(18)} />
        <U.KPI label="Facturado" value={`$${(invs.reduce((s, i) => s + i.amount, 0) / 1000).toFixed(0)}K`} sub="2026 acumulado" tone="info" icon={window.Icon.invoice(18)} />
        <U.KPI label="Saldo pendiente" value={`$${(outstanding / 1000).toFixed(1)}K`} delta={outstanding > 0 ? 'pagar' : 'al día'} tone={outstanding > 0 ? 'warning' : 'success'} icon={window.Icon.clock(18)} />
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
          {ships.slice(0, 5).map((s, i) =>
          <div key={s.id} onClick={() => {setView('shipments');setDetail(s.id);}} style={{
            display: 'grid', gridTemplateColumns: '120px 1fr 100px 110px',
            gap: 14, padding: '14px 20px',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
            alignItems: 'center', cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            
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
          )}
        </U.Card>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {outstanding > 0 &&
          <U.Card padded>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>SALDO PENDIENTE</div>
              <div style={{ font: '900 28px/1 var(--f-display)', color: 'var(--wine)', letterSpacing: '-0.02em', marginTop: 6 }}>${outstanding.toLocaleString()}</div>
              <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{invs.filter((i) => i.balance > 0).length} {invs.filter((i) => i.balance > 0).length === 1 ? 'factura por pagar' : 'facturas por pagar'}</div>
              <button onClick={() => setView('invoices')} style={{ marginTop: 14, padding: '10px 14px', background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-md)', font: '700 12.5px/1 var(--f-sans)', width: '100%' }}>Ver facturas →</button>
            </U.Card>
          }

          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>DATOS PARA TU PROVEEDOR</div>
            <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 12 }}>Esto es lo que tu proveedor en China necesita: pega tu <b style={{ color: 'var(--ink)' }}>Shipping Mark</b> en cada caja y envía a la bodega.</div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Shipping Mark · 唛头</div>
              <code style={{ font: '800 18px/1 var(--f-mono)', color: 'var(--wine)', display: 'block', marginTop: 8 }}>{me.markbox}</code>
            </div>
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Bodega DTD · 义乌仓库</div>
              <div style={{ font: '600 12px/1.5 var(--f-mono)', color: 'var(--ink)', marginTop: 8 }}>浙江省义乌市福田街道<br />物流大道 DTD 仓 · {me.markbox}<br /><span style={{ color: 'var(--ink-soft)' }}>+86 579 8550 1788</span></div>
            </div>
            <button onClick={() => { try { navigator.clipboard?.writeText('Shipping Mark (唛头): ' + me.markbox + '\n\n收货地址 / Bodega DTD:\n浙江省义乌市福田街道物流大道 DTD 仓 · ' + me.markbox + '\n电话 +86 579 8550 1788\n\n请在每个箱子上写 Shipping Mark。'); } catch (e) {} const b = event.currentTarget; const o = b.textContent; b.textContent = '✓ Copiado'; setTimeout(() => { b.textContent = o; }, 1600); }}
              style={{ marginTop: 12, width: '100%', padding: '10px', background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-md)', font: '700 12.5px/1 var(--f-sans)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              {window.Icon.copy(13)} Copiar texto para WeChat
            </button>
          </U.Card>

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
              { t: 'Factura F-2026-0432 emitida', m: 'hace 4 h', c: 'var(--info)' },
              { t: 'DTDU-388157 entregado · POD adjunto', m: 'ayer 16:42', c: 'var(--success)' }].
              map((a, i) =>
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: a.c }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '600 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{a.t}</div>
                    <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{a.m}</div>
                  </div>
                </div>
              )}
            </div>
          </U.Card>
        </div>
      </div>
    </div>);

}

// ── Alertas · mis envíos · ciclo Pre-alerta → Alerta → Envío ──
// El cliente crea una PRE-ALERTA (un pedido/order con su proveedor).
// Al confirmarse pasa a ALERTA; cuando la carga llega a DTD, a ENVÍO.
// Proveedores y documentos viven DENTRO de este módulo: proveedor por
// pre-alerta, documentos adjuntos por ítem a lo largo de todo el ciclo.
const _ALERT_STAGE = {
  prealerta: { label: 'Pre-alerta', icon: 'plus', color: 'var(--wine)', bg: 'var(--wine-tint)' },
  alerta: { label: 'Alerta', icon: 'box', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  envio: { label: 'Envío', icon: 'ship', color: 'var(--info)', bg: 'var(--info-bg)' },
};

function PortalAlertas({ me, ships, setDetail, detail, defaultTab, setView }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const screen = defaultTab === 'compras' ? 'compras' : 'list';
  const [stage, setStage] = pUseState('todas');
  const [openDocs, setOpenDocs] = pUseState(null);
  const [track, setTrack] = pUseState(false);

  if (detail) return <PortalShipmentDetail id={detail} onBack={() => setDetail(null)} />;
  if (screen === 'compras') {
    return (
      <div>
        <button onClick={() => setView('shipments')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14 }}>{I.arrowL(12)} Volver a Alertas · mis envíos</button>
        <PortalSuppliers me={me} setView={setView} />
      </div>);
  }

  if (track) {
    const containerKey = (s) => s.container || ((s.type || '').startsWith('LCL') ? 'CONSOL-' + s.origin + s.destination : s.id);
    const FLOW = ['confirmado', 'recibido CN', 'consolidado', 'zarpado', 'tránsito', 'aduana VE', 'liberado', 'entregado'];
    const pct = (st) => { const i = FLOW.indexOf(st); return i < 0 ? 8 : Math.round(((i + 1) / FLOW.length) * 100); };
    const groups = {};
    ships.forEach((s) => { if (s.status === 'estimado') return; const k = containerKey(s); (groups[k] = groups[k] || []).push(s); });
    const entries = Object.entries(groups);
    return (
      <div>
        <button onClick={() => setTrack(false)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14, background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Volver a Alertas · mis envíos</button>
        <div className="eyebrow eyebrow-wine">SEGUIMIENTO TOTAL</div>
        <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '8px 0 6px' }}>Mis envíos en camino</h1>
        <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)', maxWidth: '60ch' }}>Tus cargas agrupadas por contenedor. Cuando varias compras viajan consolidadas, las ves como un solo seguimiento.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.length === 0 && <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)', padding: 'var(--s-8)', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>Aún no tienes envíos en camino.</div>}
          {entries.map((ent) => {
            const k = ent[0], arr = ent[1];
            const consol = arr.length > 1;
            const rep = arr.reduce((a, b) => (FLOW.indexOf(b.status) < FLOW.indexOf(a.status) ? b : a), arr[0]);
            const p = pct(rep.status);
            const cbmTot = arr.reduce((a, s) => a + (s.cbm || 0), 0);
            return (
              <U.Card key={k} padded>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.ship(18)}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <code style={{ font: '800 13.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{consol ? k : arr[0].id}</code>
                      {consol && <span style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--wine)', background: 'var(--wine-tint)', padding: '3px 7px', borderRadius: 'var(--r-pill)' }}>Consolidado · {arr.length} compras</span>}
                    </div>
                    <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{cbmTot.toFixed(1)} CBM · {rep.status}{rep.eta ? ' · ETA ' + rep.eta : ''}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}><div style={{ width: p + '%', height: '100%', background: 'var(--wine)' }} /></div>
                {consol ?
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {arr.map((s) => (
                    <button key={s.id} onClick={() => setDetail(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-base)', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ color: 'var(--wine)', display: 'flex', flexShrink: 0 }}>{I.box(13)}</span>
                      <code style={{ flex: 1, font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
                      <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{s.cbm} CBM</span>
                      <span style={{ color: 'var(--ink-mute)', display: 'flex' }}>{I.arrowR(12)}</span>
                    </button>
                  ))}
                </div>
                :
                <button onClick={() => setDetail(arr[0].id)} style={{ marginTop: 10, font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 0, cursor: 'pointer' }}>Ver seguimiento {I.arrowR(11)}</button>}
              </U.Card>);
          })}
        </div>
      </div>);
  }

  const PREFIX = me.markbox || 'DTD-5452';
  // Pre-alertas y alertas (pedidos del cliente · ciclo en curso).
  const pedidos = [
    { id: PREFIX + '-3-1', stage: 'prealerta', proveedor: 'Guangzhou Textile Co', meta: 'Creada hace 2 días · esperando packing del proveedor', docs: { packing: false, factura: false, fotos: 0 } },
    { id: PREFIX + '-1-3', stage: 'alerta', proveedor: 'Yiwu Standard Co', meta: '14 cajas · 7.2 CBM · rumbo a bodega CN', docs: { packing: true, factura: true, fotos: 3 } },
  ];
  // Envíos reales (ya recibidos por DTD / en tránsito).
  const envios = ships.map((s) => ({ id: s.id, stage: 'envio', proveedor: s.supplier || s.origin || 'Proveedor', meta: (s.boxes ? s.boxes + ' cajas · ' : '') + (s.cbm ? s.cbm + ' CBM · ' : '') + (s.status || 'en proceso'), ship: s, docs: { packing: true, factura: true, fotos: 2 } }));
  const all = [...pedidos, ...envios];
  const counts = { todas: all.length, prealerta: pedidos.filter((p) => p.stage === 'prealerta').length, alerta: pedidos.filter((p) => p.stage === 'alerta').length, envio: envios.length };
  const list = stage === 'todas' ? all : all.filter((x) => x.stage === stage);
  const filters = [{ k: 'todas', l: 'Todas' }, { k: 'prealerta', l: 'Pre-alertas' }, { k: 'alerta', l: 'Alertas' }, { k: 'envio', l: 'Envíos' }];

  return (
    <div>
      <div className="eyebrow eyebrow-wine">ALERTAS · MIS ENVÍOS</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', margin: '8px 0 6px' }}>
        <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Mis envíos</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <U.Btn variant="secondary" icon={I.radar(14)} onClick={() => setTrack(true)}>Seguimiento total</U.Btn>
          <U.Btn variant="secondary" icon={I.truck(14)} onClick={() => setView('suppliers')}>Mis proveedores</U.Btn>
          <U.Btn variant="primary" icon={I.plus(14)} onClick={() => setView('nueva-compra')}><span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}><span>Nueva compra</span><span style={{ font: '700 8.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.82, marginTop: 4 }}>Pre-alerta</span></span></U.Btn>
        </div>
      </div>

      <SailingDeadlineNote me={me} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '15px 20px', margin: '0 0 var(--s-6)' }}>
        {[['prealerta', 'La creas tú'], ['alerta', 'Confirmada'], ['envio', 'En camino a ti']].map(([k, desc], i, arr) => (
          <React.Fragment key={k}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 29, height: 29, borderRadius: '50%', background: _ALERT_STAGE[k].bg, color: _ALERT_STAGE[k].color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I[_ALERT_STAGE[k].icon](14)}</span>
              <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ font: '700 14.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{_ALERT_STAGE[k].label}</span>
                <span style={{ font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{desc}</span>
              </span>
            </span>
            {i < arr.length - 1 && <span style={{ color: 'var(--ink-mute)' }}>{I.arrowR(16)}</span>}
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)', marginBottom: 'var(--s-5)', flexWrap: 'wrap', maxWidth: '100%' }}>
        {filters.map((f) => {
          const on = stage === f.k;
          return (
            <button key={f.k} onClick={() => setStage(f.k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 'var(--r-pill)', background: on ? 'var(--bg-surface)' : 'transparent', color: on ? 'var(--wine)' : 'var(--ink-soft)', font: (on ? '700' : '600') + ' 12.5px/1 var(--f-sans)', boxShadow: on ? 'var(--shadow-xs)' : 'none', cursor: 'pointer' }}>
              {f.l}<span style={{ font: '700 10px/1 var(--f-mono)', color: on ? 'var(--wine)' : 'var(--ink-mute)' }}>{counts[f.k]}</span>
            </button>);
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 && <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)', padding: 'var(--s-8)', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>No hay ítems en esta etapa.</div>}
        {list.map((it) => {
          const st = _ALERT_STAGE[it.stage];
          const docCount = (it.docs.packing ? 1 : 0) + (it.docs.factura ? 1 : 0) + (it.docs.fotos ? 1 : 0);
          const open = openDocs === it.id;
          return (
            <U.Card key={it.id} padded>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: st.bg, color: st.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I[st.icon](16)}</span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <code style={{ font: '800 13.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{it.id}</code>
                    <span style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: st.color, background: st.bg, padding: '3px 7px', borderRadius: 'var(--r-pill)' }}>{st.label}</span>
                  </div>
                  <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)', marginTop: 5 }}>{it.proveedor}</div>
                  <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{it.meta}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <button onClick={() => setOpenDocs(open ? null : it.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: open ? 'var(--bg-elevated)' : 'var(--bg-surface)', color: 'var(--ink)', font: '600 12px/1 var(--f-sans)', cursor: 'pointer' }}>
                    {I.doc(13)} Documentos <span style={{ font: '700 10px/1 var(--f-mono)', color: docCount ? 'var(--success)' : 'var(--ink-mute)' }}>{docCount}/3</span>
                  </button>
                  {it.ship && <button onClick={() => setDetail(it.id)} style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 2px', cursor: 'pointer' }}>Ver seguimiento {I.arrowR(11)}</button>}
                </div>
              </div>
              {open && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>Documentos de este ítem</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
                    {[['packing', 'Packing list', it.docs.packing], ['factura', 'Factura', it.docs.factura], ['fotos', 'Fotos', !!it.docs.fotos]].map(([k, label, ok]) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--r-md)', background: ok ? 'var(--success-bg)' : 'var(--bg-elevated)' }}>
                        <span style={{ color: ok ? 'var(--success)' : 'var(--ink-mute)' }}>{ok ? I.check(14) : I.upload(14)}</span>
                        <span style={{ flex: 1, font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{label}</span>
                        <span style={{ font: '600 11px/1 var(--f-sans)', color: ok ? 'var(--success)' : 'var(--wine)', cursor: 'pointer' }}>{ok ? 'Ver' : 'Subir'}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '10px 0 0' }}>Los documentos quedan atados a este ítem durante todo el ciclo — de pre-alerta a envío.</p>
                </div>
              )}
            </U.Card>);
        })}
      </div>
    </div>);

}

// ── Mis envíos ──────────────────────────────────────────────
function PortalShipments({ ships, setDetail }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [tab, setTab] = pUseState('all');
  const [search, setSearch] = pUseState('');

  const filtered = ships.filter((s) => {
    if (tab === 'active' && s.status === 'entregado') return false;
    if (tab === 'delivered' && s.status !== 'entregado') return false;
    if (search && !s.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Mis envíos</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>{ships.length} embarques totales · {ships.filter((s) => !['entregado', 'estimado'].includes(s.status)).length} en curso</p>

      <U.Tabs value={tab} onChange={setTab} items={[
      { value: 'all', label: 'Todos', count: ships.length },
      { value: 'active', label: 'En curso', count: ships.filter((s) => s.status !== 'entregado').length },
      { value: 'delivered', label: 'Entregados', count: ships.filter((s) => s.status === 'entregado').length }]
      } style={{ marginBottom: 'var(--s-5)' }} />

      <U.Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Buscar por ID de embarque…" />

      {filtered.length === 0 ?
      <U.EmptyState icon={window.Icon.box(22)} title="Sin envíos" body="No tienes embarques en esta vista." /> :

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
          {filtered.map((s) =>
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
        )}
        </div>
      }
    </div>);

}

// ── Aceptación legal de estimado (T&C + Operador) ──────────
function pFmtLegalDate(iso) {
  const [y, m, d] = iso.split('-');
  const MM = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][parseInt(m) - 1];
  return `${parseInt(d)} ${MM} ${y}`;
}
function pNowStamp() {
  const n = new Date();const p = (x) => String(x).padStart(2, '0');
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
      {doc &&
      <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <U.Badge tone="wine" size="sm">{doc.version}</U.Badge>
            <U.Badge tone="neutral" size="sm">Vigente desde {pFmtLegalDate(doc.effective)}</U.Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 360, overflowY: 'auto', overflowX: 'hidden', paddingRight: 6 }}>
            {doc.body.map(([h, p], i) =>
          <div key={i}>
                <div style={{ font: '800 13px/1.3 var(--f-display)', color: 'var(--ink)', marginBottom: 5 }}>{h}</div>
                <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>{p}</div>
              </div>
          )}
          </div>
        </div>
      }
    </U.Modal>);

}

function PortalAcceptModal({ quote, me, open, onClose, onAccepted }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [checked, setChecked] = pUseState(false);
  const [viewing, setViewing] = pUseState(null);
  const docs = window.LegalData && window.LegalData.currentDocs() || [];

  const close = () => {setChecked(false);setViewing(null);onClose();};
  const confirm = () => {
    if (!checked) return;
    const evidence = {
      id: 'AC-2026-' + String(Math.floor(215 + Math.random() * 80)).padStart(4, '0'),
      client: me.company || me.name, markbox: me.markbox,
      quote: quote.id, orden: quote.id.replace('E-', 'OV-'),
      cbm: quote.cbm, weight: quote.weight, total: quote.amount,
      docs: docs.map((d) => [d.name, d.version]),
      at: pNowStamp(), ip: me.ip || '190.142.88.214', hash: pFakeHash()
    };
    try {if (window.LegalData) window.LegalData.ACCEPTANCES.unshift(evidence);} catch (e) {}
    onAccepted(evidence);
  };

  return (
    <React.Fragment>
      <U.Modal open={open && !viewing} onClose={close} width={560} title="Aceptar estimado"
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
              {docs[0] && <a onClick={(e) => {e.stopPropagation();setViewing(docs[0]);}} style={{ color: 'var(--wine)', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer' }}>Términos y Condiciones de DTD</a>}
              {' '}y las{' '}
              {docs[1] && <a onClick={(e) => {e.stopPropagation();setViewing(docs[1]);}} style={{ color: 'var(--wine)', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer' }}>Condiciones del Operador de Consolidación</a>}.
            </div>
          </button>
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, background: 'var(--bg-elevated)' }}>
            {docs.map((d) =>
            <button key={d.key} onClick={() => setViewing(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--wine)', display: 'flex' }}>{I.doc(11)}</span>{d.version} · vig. {pFmtLegalDate(d.effective)}
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 14, padding: '11px 13px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)' }}>
          <span style={{ color: 'var(--info)', display: 'flex', flexShrink: 0, marginTop: 1 }}>{I.shield(15)}</span>
          <div style={{ font: '500 11.5px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
            Al confirmar registramos tu aceptación como evidencia legal: cliente, estimado, documento y versión, fecha/hora, IP y un hash de integridad. Se solicita en <b>cada</b> estimado.
          </div>
        </div>
      </U.Modal>
      <PortalDocViewer doc={viewing} onClose={() => setViewing(null)} />
    </React.Fragment>);

}

function PortalAcuseModal({ evidence, open, onClose }) {
  const U = window.ERPUI;
  const I = window.Icon;
  if (!evidence) return null;
  const Row = ({ k, v }) =>
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', flexShrink: 0 }}>{k}</span>
      <span style={{ font: '600 12px/1.4 var(--f-mono)', color: 'var(--ink)', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
    </div>;

  return (
    <U.Modal open={open} onClose={onClose} width={520} title="Orden de servicio generada"
    actions={<U.Btn variant="primary" full onClick={onClose} icon={I.check(14)}>Entendido</U.Btn>}>
      <div style={{ textAlign: 'center', padding: '6px 0 18px' }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>{I.check(30)}</div>
        <div style={{ font: '900 20px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Estimado aceptado</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
          Generamos la orden <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{evidence.orden}</code> ligada a las versiones aceptadas.
        </div>
      </div>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '4px 16px 14px' }}>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '14px 0 6px' }}>Acuse de aceptación · evidencia</div>
        <Row k="Cliente" v={`${evidence.client} · ${evidence.markbox}`} />
        <Row k="Estimado" v={evidence.quote} />
        {evidence.docs.map((d, i) => <Row key={i} k={i === 0 ? 'Documentos' : ''} v={`${d[0]} ${d[1]}`} />)}
        <Row k="Fecha / hora" v={evidence.at} />
        <Row k="IP" v={evidence.ip} />
        <Row k="Hash" v={evidence.hash} />
      </div>
    </U.Modal>);

}

// ── Detalle de un envío ─────────────────────────────────────
function PortalShipmentDetail({ id, onBack }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const s = (() => {try {const q = window.DTDData && window.DTDData.clientEstimados ? window.DTDData.clientEstimados(DEMO_MARKBOX).find((x) => x.id === id) : null;return q || D.SHIPMENTS.find((x) => x.id === id);} catch (e) {return D.SHIPMENTS.find((x) => x.id === id);}})();
  const [accepting, setAccepting] = pUseState(false);
  const [evidence, setEvidence] = pUseState(null);
  const [acuse, setAcuse] = pUseState(false);
  if (!s) return null;
  const flow = D.STATUS_FLOW;
  const cur = flow.indexOf(s.status);
  const pLegalAccepted = (qid) => {try {return window.LegalData && window.LegalData.ACCEPTANCES.some((a) => a.quote === qid);} catch (e) {return false;}};
  const quote = {
    id: s.id.startsWith('E-') ? s.id : 'E-2026-' + s.id.slice(-4), route: `${D.origin(s.origin).name} → ${D.dest(s.destination).name}`,
    cbm: s.cbm, weight: s.weight, amount: s.value, type: s.type, total: '$' + (s.value || 0).toLocaleString('en-US')
  };
  const meQ = { company: s.clientName, markbox: s.client, ip: '190.142.88.214' };
  // Gate de firma · atado a la MEDIDA aceptada (no solo al ID).
  const accForQuote = (() => {try {return (window.LegalData ? window.LegalData.ACCEPTANCES : []).filter((a) => a.quote === quote.id);} catch (e) {return [];}})();
  const acceptedCurrent = !!evidence || accForQuote.some((a) => Number(a.cbm) === Number(s.cbm) && Number(a.weight) === Number(s.weight));
  const priorDiff = !acceptedCurrent && accForQuote.length > 0 ? accForQuote[0] : null; // aceptó antes, pero la medida cambió
  const inReview = s.status === 'estimado' && s.quoteStage === 'en-proceso'; // recién solicitada · el agente la prepara
  const needsAccept = (s.status === 'estimado' || s.status === 'recibido CN') && !acceptedCurrent && !inReview;
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
          {inReview ?
          <U.Btn variant="secondary" icon={window.Icon.clock ? window.Icon.clock(14) : window.Icon.info(14)} disabled>En revisión</U.Btn> :
          needsAccept ?
          <React.Fragment>
              <U.Btn variant="secondary" icon={window.Icon.download(14)}>Descargar PDF</U.Btn>
              <U.Btn variant="primary" icon={window.Icon.check(14)} onClick={() => setAccepting(true)}>{isReaccept ? 'Revisar y re-aceptar' : isMeasured ? 'Aceptar estimado · medida real' : 'Aceptar estimado'}</U.Btn>
            </React.Fragment> :

          <React.Fragment>
              {evidence && <U.Btn variant="secondary" icon={window.Icon.shield(14)} onClick={() => setAcuse(true)}>Ver acuse</U.Btn>}
              <U.Btn variant="secondary" icon={window.Icon.download(14)}>Descargar docs</U.Btn>
              <U.Btn variant="primary" icon={window.Icon.mail(14)}>Contactar agente</U.Btn>
            </React.Fragment>
          }
        </div>
      </div>

      {inReview &&
      <U.Card padded style={{ marginBottom: 'var(--s-6)', background: 'var(--info-bg)', borderLeft: '3px solid var(--info)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }}>{window.Icon.clock ? window.Icon.clock(18) : window.Icon.info(18)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Estimado en proceso</div>
              <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>
                Recibimos tu solicitud y tu agente está preparando el estimado formal{s.quoteRef ? ` (ref. ${s.quoteRef})` : ''}. Te avisamos apenas esté lista para aceptar.
              </div>
            </div>
          </div>
        </U.Card>
      }

      {needsAccept &&
      <U.Card padded style={{ marginBottom: 'var(--s-6)', background: 'var(--wine-tint)', borderLeft: '3px solid var(--wine)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <span style={{ color: 'var(--wine)', flexShrink: 0, marginTop: 1 }}>{window.Icon.shield(18)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>{isReaccept ? 'La medida real cambió · re-aceptación requerida' : isMeasured ? 'Tu carga llegó y se midió · falta tu aceptación' : 'Estimado pendiente de aceptación'}</div>
              <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>
                {isReaccept ?
              'Aceptaste un estimado por la medida estimada, pero al medir tu carga en China el volumen/peso real cambió. Confirma la nuevo estimado para que emitamos la factura. La factura no se emite hasta que aceptes la diferencia.' :
              isMeasured ?
              `Recibimos tu carga en China y medimos el volumen y peso reales (${s.cbm} m³ · ${(s.weight || 0).toLocaleString()} kg). Aceptá el estimado con la medida real para que emitamos tu factura DDP. La factura no se emite hasta que firmes.` :
              'Revisa el estimado y aceptá los términos para generar tu orden de servicio.'}
              </div>
              {isReaccept &&
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
            }
            </div>
          </div>
        </U.Card>
      }

      {s.alert &&
      <U.Card padded style={{ marginBottom: 'var(--s-6)', background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(18)}</span>
            <div>
              <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Aviso</div>
              <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{s.alert}. Tu agente ya está siguiendo el caso.</div>
            </div>
          </div>
        </U.Card>
      }

      {/* Timeline */}
      <U.Card padded style={{ marginBottom: 'var(--s-6)' }}>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 22 }}>SEGUIMIENTO</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${flow.length}, 1fr)`, position: 'relative' }}>
          {flow.map((step, i) => {
            const done = i < cur;
            const current = i === cur;
            return (
              <div key={step} style={{ position: 'relative', textAlign: 'center', paddingTop: 30 }}>
                {i > 0 &&
                <div style={{ position: 'absolute', top: 13, left: 'calc(-50% + 10px)', right: 'calc(50% + 10px)', height: 2, background: done || current ? 'var(--wine)' : 'var(--border)' }} />
                }
                <div style={{
                  position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                  width: 26, height: 26, borderRadius: '50%',
                  background: current || done ? 'var(--wine)' : 'var(--bg-elevated)',
                  border: `2px solid ${current || done ? 'var(--wine)' : 'var(--border-strong)'}`,
                  color: current || done ? '#fff' : 'var(--ink-mute)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: '700 11px/1 var(--f-sans)'
                }}>{done ? '✓' : i + 1}</div>
                <div style={{
                  font: `${current ? '800' : '600'} 10.5px/1.3 var(--f-sans)`,
                  color: current ? 'var(--ink)' : done ? 'var(--ink-soft)' : 'var(--ink-mute)',
                  textTransform: 'capitalize'
                }}>{step}</div>
              </div>);

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
            {D.DOCUMENTS.filter((d) => d.shipment === s.id).map((d) =>
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: 'var(--wine)' }}>{window.Icon.doc(15)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 12.5px/1.2 var(--f-sans)' }}>{d.type}</div>
                  <code style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-mute)' }}>{d.id} · {d.size}</code>
                </div>
                <button style={{ color: 'var(--wine)', padding: 4 }} title="Descargar">{window.Icon.download(13)}</button>
              </div>
            )}
            {D.DOCUMENTS.filter((d) => d.shipment === s.id).length === 0 &&
            <div style={{ padding: '20px 10px', textAlign: 'center', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
                Los documentos se publican cuando la carga zarpa.
              </div>
            }
          </div>
        </U.Card>
      </div>

      <PortalAcceptModal quote={quote} me={meQ} open={accepting}
      onClose={() => setAccepting(false)}
      onAccepted={(ev) => {setAccepting(false);setEvidence(ev);setAcuse(true);}} />
      <PortalAcuseModal evidence={evidence} open={acuse} onClose={() => setAcuse(false)} />
    </div>);

}

// ── Facturas ─────────────────────────────────────────────────
function PortalInvoices({ invs, ships }) {
  const U = window.ERPUI;
  const statusTone = { pagada: 'success', emitida: 'info', parcial: 'warning', vencida: 'danger' };
  const I = window.Icon;
  const [tab, setTab] = pUseState('facturas');
  const [showTable, setShowTable] = pUseState(false);
  const D = window.ERPData;
  const usd = (n) => 'USD ' + (n || 0).toLocaleString('es-ES');
  const totalFact = invs.reduce((s, i) => s + i.amount, 0);
  const paid = invs.reduce((s, i) => s + i.paid, 0);
  const saldo = invs.reduce((s, i) => s + i.balance, 0);
  const stPill = { pagada: { l: 'Pagada', c: 'var(--success)', bg: 'var(--success-bg)' }, parcial: { l: 'Parcial', c: 'var(--warning)', bg: 'var(--warning-bg)' }, emitida: { l: 'Pendiente', c: 'var(--warning)', bg: 'var(--warning-bg)' }, vencida: { l: 'Vencida', c: 'var(--danger)', bg: 'var(--danger-bg)' } };

  // Sam (2026-06): ciclo dinámico del cliente · Estimado → Aprobado → Facturado.
  const estimados = (ships || []).filter((s) => s.status === 'estimado');
  const aprobados = (ships || []).filter((s) => s.status !== 'estimado' && s.status !== 'entregado');
  const sum = (arr, k) => arr.reduce((a, s) => a + (s[k] || 0), 0);
  const fmtK = (n) => '$' + (n || 0).toLocaleString();
  const flujo = [
    { k: 'Estimados', n: estimados.length, s: estimados.length ? fmtK(sum(estimados, 'value')) + ' · los pediste tú' : 'aún ninguno', tone: 'var(--ink-soft)' },
    { k: 'Aprobados', n: aprobados.length, s: aprobados.length ? 'en proceso' : '—', tone: 'var(--wine)' },
    { k: 'Facturados', n: invs.length, s: invs.length ? fmtK(sum(invs, 'amount')) : '—', tone: 'var(--success)' },
  ];

  return (
    <div>
      <div className="eyebrow eyebrow-wine">TU DINERO</div>
      <h1 style={{ font: '900 34px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em', margin: '8px 0 6px' }}>Finanzas</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>Tus facturas y saldos. Estimados y cotizaciones, a un clic.</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 'var(--s-6)' }}>
        <button onClick={() => setTab(tab === 'estimados' ? 'facturas' : 'estimados')} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '10px 18px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (tab === 'estimados' ? 'var(--wine)' : 'var(--border)'), background: tab === 'estimados' ? 'var(--wine-tint)' : 'var(--bg-surface)', cursor: 'pointer' }}>
          <span style={{ color: 'var(--wine)', display: 'flex' }}>{I.calc(15)}</span>
          <span style={{ font: '700 13px/1 var(--f-sans)', color: tab === 'estimados' ? 'var(--wine)' : 'var(--ink)' }}>Estimados</span>
          {estimados.length > 0 && <span style={{ font: '700 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{estimados.length}</span>}
        </button>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '10px 18px', borderRadius: 'var(--r-pill)', border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <span style={{ color: 'var(--ink-mute)', display: 'flex' }}>{I.invoice(15)}</span>
          <span style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Cotizaciones</span>
          <span style={{ font: '700 8.5px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-mute)', background: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: 'var(--r-pill)' }}>Próximamente</span>
        </span>
      </div>

      {tab === 'estimados' ? (
        <React.Fragment>
          <button onClick={() => setTab('facturas')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14, background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Volver a facturas</button>
          {estimados.length === 0
            ? <U.EmptyState icon={I.calc(22)} title="Sin estimados aún" body="Genera uno desde la Calculadora CBM o solicitando un servicio." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {estimados.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.calc(16)}</span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
                      <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{(s.cbm ? s.cbm + ' CBM · ' : '') + (s.type || 'estimado')} · lo pediste tú</div>
                    </div>
                    <div style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--ink)' }}>{usd(s.value)}</div>
                  </div>
                ))}
              </div>}
        </React.Fragment>
      ) : (
        <React.Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 'var(--s-6)' }}>
            {[['TOTAL FACTURADO', totalFact, 'var(--ink)'], ['PAGADO', paid, 'var(--ink)'], ['SALDO PENDIENTE', saldo, saldo > 0 ? 'var(--warning)' : 'var(--success)']].map((kp) => (
              <div key={kp[0]} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ font: '700 11px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{kp[0]}</div>
                <div style={{ font: '800 30px/1 var(--f-display)', color: kp[2], letterSpacing: '-0.02em', marginTop: 12 }}>{usd(kp[1])}</div>
              </div>
            ))}
          </div>

          {invs.length === 0
            ? <div style={{ padding: 'var(--s-8)', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>Sin facturas todavía.</div>
            : !showTable
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {invs.map((iv) => { const p = stPill[iv.status] || stPill.emitida; const att = ((D && D.DOCUMENTS) || []).filter((d) => d.shipment === iv.shipment).length; return (
                    <div key={iv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
                      <div style={{ minWidth: 0 }}>
                        <code style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '0.02em' }}>{iv.id}</code>
                        <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 6 }}>Envío <code style={{ fontFamily: 'var(--f-mono)' }}>{iv.shipment}</code> · {iv.status === 'pagada' ? 'pagada' : 'vence ' + iv.due}{att > 0 && <span title={att + ' adjunto' + (att > 1 ? 's' : '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, verticalAlign: 'middle', padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 10.5px/1 var(--f-mono)' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M21 8.5l-9.2 9.2a4 4 0 0 1-5.6-5.6l9.2-9.2a2.5 2.5 0 0 1 3.5 3.5l-9.2 9.2a1 1 0 0 1-1.4-1.4l8.5-8.5" /></svg>{att}</span>}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
                        <span style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--ink)' }}>{usd(iv.amount)}</span>
                        <span style={{ font: '700 10px/1 var(--f-sans)', color: p.c, background: p.bg, padding: '5px 10px', borderRadius: 'var(--r-pill)' }}>{p.l}</span>
                      </div>
                    </div>); })}
                </div>
              : <U.Card padded={false}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px 110px 110px 110px 60px', padding: '12px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                    {['Factura', 'Embarque', 'Emitida', 'Vence', 'Monto', 'Estado', ''].map((h, i) =>
                    <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: i === 4 ? 'right' : 'left' }}>{h}</span>
                    )}
                  </div>
                  {invs.map((iv, i) =>
                  <div key={iv.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px 110px 110px 110px 60px', padding: '14px 18px', gap: 14, alignItems: 'center', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                      <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{iv.id}</code>
                      <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{iv.shipment}</code>
                      <span style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{iv.issued}</span>
                      <span style={{ font: '500 11.5px/1 var(--f-mono)', color: iv.status === 'vencida' ? 'var(--danger)' : 'var(--ink-soft)' }}>{iv.due}</span>
                      <span style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>${iv.amount.toLocaleString()}</span>
                      <U.Badge tone={statusTone[iv.status]} size="sm" dot>{iv.status}</U.Badge>
                      <button style={{ color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Descargar">{window.Icon.download(14)}</button>
                    </div>
                  )}
                </U.Card>}

          {invs.length > 0 &&
          <button onClick={() => setShowTable((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'var(--s-5)', font: '700 13px/1 var(--f-sans)', color: 'var(--wine)', background: 'none', border: 0, cursor: 'pointer' }}>
            {showTable ? 'Ver como tarjetas' : 'Ver tabla completa'} {I.arrowR(13)}
          </button>}
        </React.Fragment>
      )}
    </div>);

}

// ── Documentos ──────────────────────────────────────────────
function PortalDocuments() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const myDocs = D.DOCUMENTS.filter((d) => d.client === DEMO_MARKBOX);

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Documentos</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>BL · Packing List · Facturas comerciales · POD. Disponibles 7 años en archivo.</p>

      {myDocs.length === 0 ?
      <U.EmptyState icon={window.Icon.doc(22)} title="Sin documentos aún" body="Los documentos se generan al zarpar cada embarque." /> :

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {myDocs.map((d) =>
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
        )}
          </div>

      }
    </div>);

}

// ── Soporte ──────────────────────────────────────────────────
// ── Soporte (agente + casos · fusión Reclamos + Soporte) ─────
function PortalSupport({ me }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const D = window.ERPData;
  const myShipments = (D.SHIPMENTS || []).filter((s) => s.client === me.markbox);

  const [msg, setMsg] = pUseState('');
  const [thread, setThread] = pUseState([
  { from: 'agent', text: 'Hola Carlos, ¿en qué te puedo ayudar?', time: 'hace 2 días' },
  { from: 'me', text: 'Necesitaba saber la fecha exacta de zarpe del DTDU-472816', time: 'hace 2 días' },
  { from: 'agent', text: 'Sí, zarpó el 14 de mayo desde Ningbo a bordo del COSCO PISCES. ETA Puerto Cabello: 12 jun.', time: 'hace 2 días' }]
  );
  const send = () => {
    if (!msg.trim()) return;
    setThread([...thread, { from: 'me', text: msg, time: 'ahora' }]);
    setMsg('');
    setTimeout(() => setThread((t) => [...t, { from: 'agent', text: 'Recibido. Voy a verificar y te respondo en unos minutos.', time: 'ahora' }]), 1200);
  };

  const [claims, setClaims] = pUseState([
  { id: 'SP-2026-0042', type: 'faltante', shipment: myShipments[0]?.id || 'DTDU-472816', subject: 'Faltan 2 cajas según packing list', status: 'en-revision', date: '2026-05-22',
    messages: [
    { from: 'me', text: 'Recibí el contenedor pero faltan 2 cajas según el packing. Adjunto fotos del precinto.', time: '22 may · 08:31' },
    { from: 'agent', text: 'Roberto, lamento el inconveniente. Abre tu caso y estoy revisando con almacén CN el conteo de salida.', time: '22 may · 08:44' }]
  },
  { id: 'SP-2026-0031', type: 'demora', shipment: 'DTDU-365044', subject: 'El despacho tardó más del ETA informado', status: 'resuelto', date: '2026-05-10',
    messages: [
    { from: 'me', text: 'El ETA era el 5 y recién entregaron el 9. ¿Qué pasó?', time: '10 may · 10:10' },
    { from: 'agent', text: 'Hubo congestión en Puerto Cabello. Te aplicamos un crédito de almacenaje como compensación.', time: '10 may · 14:02' }],
    resolution: 'Crédito de $120 aplicado a tu próxima factura.' }]
  );
  const [selected, setSelected] = pUseState(null);
  const [creating, setCreating] = pUseState(false);
  const sel = selected ? claims.find((c) => c.id === selected) : null;
  if (sel) return <ReclamoDetail claim={sel} onBack={() => setSelected(null)} />;

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Soporte</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)', maxWidth: '54ch' }}>Habla con tu agente o abre un caso con seguimiento. Cada caso tiene número, estado y respuesta.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        {/* ── Casos ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div className="eyebrow eyebrow-wine">TUS CASOS</div>
            <U.Btn variant="primary" size="sm" icon={I.plus(13)} onClick={() => setCreating((c) => !c)}>Nuevo caso</U.Btn>
          </div>
          {creating && <NewReclamoForm myShipments={myShipments} onCancel={() => setCreating(false)} onSubmit={(claim) => {setClaims([claim, ...claims]);setCreating(false);}} />}
          {claims.length === 0 ?
          <U.EmptyState icon={I.chat(22)} title="Sin casos" body="No tienes casos abiertos. Si tuviste un problema con un embarque, abre uno acá." /> :

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {claims.map((c) => {
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
                  </U.Card>);

            })}
            </div>
          }
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
              {thread.map((m, i) =>
              <div key={i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '78%', padding: '9px 13px', background: m.from === 'me' ? 'var(--wine)' : 'var(--bg-elevated)', color: m.from === 'me' ? '#fff' : 'var(--ink)', borderRadius: m.from === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', font: '500 12.5px/1.5 var(--f-sans)' }}>
                    {m.text}
                    <div style={{ marginTop: 4, font: '500 10px/1 var(--f-sans)', color: m.from === 'me' ? 'rgba(255,255,255,0.65)' : 'var(--ink-mute)', textAlign: 'right' }}>{m.time}</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Escribe tu mensaje…"
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
    </div>);

}

// ── Referidos (programa de lealtad) ──────────────────────────
function PortalReferidos({ me }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const F = window.FidelizacionData;
  const fmt = (n) => '$' + (Number(n) || 0).toLocaleString('en-US');
  const [copied, setCopied] = pUseState(false);

  // Feature flag · si está OFF, el cliente ve "Próximamente"
  const flags = window.DTDFlags && window.DTDFlags.getFlags() || {};
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
      </div>);

  }

  if (!F) return <div style={{ font: '500 13px var(--f-sans)', color: 'var(--ink-soft)' }}>Programa de referidos no disponible.</div>;

  const code = F.referralCode(me.markbox);
  const prog = F.tierProgress(me.billed);
  const myRefs = F.referralsByReferrer(me.markbox);
  const credits = F.creditsEarned(me.markbox);
  const pending = F.pendingCredits(me.markbox);

  const copy = () => {
    try {navigator.clipboard.writeText(code);} catch (e) {}
    setCopied(true);setTimeout(() => setCopied(false), 1600);
  };
  const share = () => {
    const txt = `Importa de China con DTD-Cargo y usa mi código ${code} para ${fmt(F.REFERRAL_RULES.referredReward)} de descuento en tu primer embarque. Con Confianza, de China a tu puerta.`;
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
  };

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Referidos</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)', maxWidth: '54ch' }}>
        Recomienda DTD-Cargo y gana crédito. Cada importador que sumas fortalece la comunidad — contenedor a contenedor.
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
                <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>de crédito para tú al acreditarse</div>
              </div>
            </div>
          </div>
        </U.Card>

        {/* Créditos */}
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>TUS CRÉDITOS</div>
          <div style={{ font: '900 32px/1 var(--f-display)', color: 'var(--success)', letterSpacing: '-0.02em' }}>{fmt(credits)}</div>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>acreditados a tu cuenta</div>
          {pending > 0 &&
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', font: '600 12px/1.4 var(--f-sans)', color: 'var(--warning)' }}>
              {fmt(pending)} en camino · referidos en proceso
            </div>
          }
          <div style={{ marginTop: 14, font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
            Los créditos se descuentan automaticamente de tu próxima factura.
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
            {prog.tier.benefits.map((b, i) =>
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)', font: '600 11px/1 var(--f-sans)', color: 'var(--ink)' }}>
                <span style={{ color: prog.tier.color }}>{I.check(11)}</span>{b}
              </span>
            )}
          </div>
        </div>
        {prog.next &&
        <div>
            <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ height: '100%', width: `${prog.pct}%`, background: prog.next.color, borderRadius: 999, transition: 'width var(--dur-slow) var(--ease)' }} />
            </div>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
              Te faltan <b style={{ color: 'var(--ink)' }}>{fmt(prog.toNext)}</b> de facturación para alcanzar <b style={{ color: prog.next.color }}>{prog.next.label}</b>.
            </div>
          </div>
        }
      </U.Card>

      {/* Tus referidos */}
      <U.Card padded={false}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="eyebrow eyebrow-wine">TUS REFERIDOS</div>
          <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{myRefs.length} en total</span>
        </div>
        {myRefs.length === 0 ?
        <div style={{ padding: '32px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Todavía no referiste a nadie. Comparte tu código y empezá a ganar.</div> :
        myRefs.map((r, i) => {
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
            </div>);

        })}
      </U.Card>
    </div>);

}

function heroBtn(active, outline) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-md)',
    font: '700 12.5px/1 var(--f-sans)', cursor: 'pointer',
    background: active ? 'var(--success)' : outline ? 'transparent' : '#fff',
    color: active ? '#fff' : outline ? '#fff' : 'var(--ink)',
    border: outline ? '1px solid rgba(255,255,255,0.3)' : 'none'
  };
}

// ── Reclamos formales ────────────────────────────────────────
const RECLAMO_TYPE = {
  faltante: { label: 'Faltante de mercancía', tone: 'danger' },
  dano: { label: 'Daño en la carga', tone: 'danger' },
  demora: { label: 'Demora en entrega', tone: 'warning' },
  facturacion: { label: 'Facturación', tone: 'info' },
  otro: { label: 'Otro', tone: 'neutral' }
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
    if (!subject.trim() || !desc.trim()) {alert('Completa el asunto y la descripción.');return;}
    const num = String(Math.floor(40 + Math.random() * 50)).padStart(4, '0');
    onSubmit({
      id: 'REC-2026-' + num, type, shipment: shipment || '—', subject: subject.trim(),
      status: 'recibido', date: new Date().toISOString().slice(0, 10),
      messages: [{ from: 'me', text: desc.trim(), time: 'ahora' }]
    });
  };

  return (
    <U.Card padded style={{ marginBottom: 16, border: '1px solid var(--wine)', background: 'var(--wine-tint)' }}>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>NUEVO CASO</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <U.Select label="Tipo de caso" value={type} onChange={(e) => setType(e.target.value)} options={Object.entries(RECLAMO_TYPE).map(([k, v]) => ({ value: k, label: v.label }))} />
        <U.Select label="Embarque relacionado" value={shipment} onChange={(e) => setShipment(e.target.value)} options={[{ value: '', label: 'Sin embarque' }, ...myShipments.map((s) => ({ value: s.id, label: s.id }))]} />
      </div>
      <U.Input label="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resumí el problema en una línea" style={{ marginBottom: 12 }} />
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Descripción</span>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4} placeholder="Cuéntanos qué pasó. Si tienes fotos o el packing, mencionalo." style={{
          resize: 'vertical', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink)', outline: 'none'
        }} />
      </label>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <U.Btn variant="ghost" onClick={onCancel}>Cancelar</U.Btn>
        <U.Btn variant="primary" icon={I.check(13)} onClick={submit}>Enviar caso</U.Btn>
      </div>
    </U.Card>);

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
              </React.Fragment>);

          })}
        </div>
        {claim.resolution &&
        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--success-bg)', borderRadius: 'var(--r-md)', font: '600 12.5px/1.5 var(--f-sans)', color: 'var(--success)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>{I.check(15)}</span>
            <span><b>Resuelto:</b> {claim.resolution}</span>
          </div>
        }
      </U.Card>

      {/* Hilo */}
      <U.Card padded={false} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', font: '700 12px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Conversación del reclamo</div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
          {thread.map((m, i) =>
          <div key={i} style={{ display: 'flex', justifyContent: m.from === 'me' ? 'flex-end' : 'flex-start' }}>
              <div style={{
              maxWidth: '74%', padding: '10px 14px',
              background: m.from === 'me' ? 'var(--wine)' : 'var(--bg-elevated)',
              color: m.from === 'me' ? '#fff' : 'var(--ink)',
              borderRadius: m.from === 'me' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              font: '500 13px/1.5 var(--f-sans)'
            }}>
                {m.text}
                <div style={{ marginTop: 4, font: '500 10px/1 var(--f-sans)', color: m.from === 'me' ? 'rgba(255,255,255,0.65)' : 'var(--ink-mute)', textAlign: 'right' }}>{m.time}</div>
              </div>
            </div>
          )}
        </div>
        {claim.status !== 'resuelto' &&
        <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Agregar un mensaje al reclamo…" style={{ flex: 1, height: 40, padding: '0 14px', background: 'var(--bg-elevated)', border: 0, borderRadius: 'var(--r-md)', font: '500 13px/1 var(--f-sans)', outline: 'none', color: 'var(--ink)' }} />
            <U.Btn variant="primary" icon={I.arrowR(13)} onClick={send}>Enviar</U.Btn>
          </div>
        }
      </U.Card>
    </div>);

}

// ── Perfil ───────────────────────────────────────────────────
// Costo de entrega (last-mile) por zona · mock realista VE.
// En producción esto lo calcula el backend según la dirección predeterminada.
function _lastMileZone(city, state) {
  const k = ((city || '') + ' ' + (state || '')).toLowerCase();
  if (/valencia|carabobo|puerto cabello|guacara|naguanagua/.test(k)) return { fee: 8, days: '2–3', zone: 'Carabobo' };
  if (/maracay|aragua|cagua|turmero/.test(k)) return { fee: 12, days: '2–4', zone: 'Aragua' };
  if (/caracas|miranda|guaira|distrito|guarenas|los teques/.test(k)) return { fee: 18, days: '3–4', zone: 'Capital' };
  if (/barquisimeto|lara|cabudare/.test(k)) return { fee: 20, days: '3–5', zone: 'Lara' };
  if (/maracaibo|zulia|cabimas/.test(k)) return { fee: 25, days: '4–6', zone: 'Zulia' };
  if (/mérida|merida|táchira|tachira|san cristóbal|trujillo/.test(k)) return { fee: 30, days: '5–7', zone: 'Andes' };
  if (/maturín|maturin|monagas|barcelona|puerto la cruz|anzoátegui|anzoategui/.test(k)) return { fee: 26, days: '5–7', zone: 'Oriente' };
  return { fee: 28, days: '5–7', zone: 'Interior' };
}

const _PORTAL_CITIES = [
  ['Valencia', 'Carabobo'], ['Maracay', 'Aragua'], ['Caracas', 'Distrito Capital'],
  ['Barquisimeto', 'Lara'], ['Maracaibo', 'Zulia'], ['Mérida', 'Mérida'],
  ['San Cristóbal', 'Táchira'], ['Maturín', 'Monagas'], ['Puerto La Cruz', 'Anzoátegui'],
];

function PortalProfile({ me }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const esEmpresa = !!(me.company && me.company !== me.name);

  // Datos de cuenta (con fallbacks · CLIENTS demo no trae todos los campos)
  const firstName = (me.name || 'cliente').split(' ')[0].toLowerCase();
  const email = me.email || `${firstName}@${esEmpresa ? 'empresa' : 'correo'}.com`;
  const phone = me.phone || '+58 412 555 0102';
  const cedula = me.cedula || 'V-15.482.661';

  // ── Foto de perfil (sube el cliente · persiste por Shipping Mark) ──
  const photoKey = 'dtd-portal-photo-' + (me.markbox || 'anon');
  const [photo, setPhoto] = pUseState(() => { try { return localStorage.getItem(photoKey) || null; } catch (e) { return null; } });
  const fileRef = React.useRef(null);
  const onPhoto = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { const d = r.result; setPhoto(d); try { localStorage.setItem(photoKey, d); } catch (er) {} };
    r.readAsDataURL(f);
  };

  // ── Direcciones de entrega (VE) · una predeterminada calcula el last-mile ──
  const [addresses, setAddresses] = pUseState([
    { id: 'a1', label: esEmpresa ? 'Local principal' : 'Casa', principal: true,
      line: me.address || 'Av. Bolívar Norte, C.C. Camoruco, nivel PB, local 14',
      city: me.city || 'Valencia', state: me.state || 'Carabobo', ref: 'Frente a la Plaza de Toros' },
    { id: 'a2', label: 'Depósito', principal: false,
      line: 'Zona Industrial Castillito, galpón 7', city: 'Caracas', state: 'Distrito Capital', ref: 'Portón azul nº 2' },
  ]);
  const [defaultId, setDefaultId] = pUseState('a1');
  const [adding, setAdding] = pUseState(false);
  const [draft, setDraft] = pUseState({ label: '', cityIdx: 0, line: '', ref: '' });
  const [copied, setCopied] = pUseState(false);

  const def = addresses.find((a) => a.id === defaultId) || addresses[0];
  const zone = _lastMileZone(def.city, def.state);

  const copyCode = () => { try { navigator.clipboard?.writeText(me.markbox); } catch (e) {} setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const removeAddr = (id) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id));
    if (defaultId === id) { const rest = addresses.filter((a) => a.id !== id); if (rest[0]) setDefaultId(rest[0].id); }
  };
  const addAddr = () => {
    if (!draft.label.trim() || !draft.line.trim()) return;
    const [city, state] = _PORTAL_CITIES[draft.cityIdx];
    const id = 'a' + Date.now();
    setAddresses((prev) => [...prev, { id, label: draft.label.trim(), principal: false, line: draft.line.trim(), city, state, ref: draft.ref.trim() }]);
    setDraft({ label: '', cityIdx: 0, line: '', ref: '' });
    setAdding(false);
  };

  const initials = (me.name || '').split(' ').map((w) => w[0]).slice(0, 2).join('');
  const eyebrow = { font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase' };
  const docRow = (label, ok) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      <span style={{ color: ok ? 'var(--success)' : 'var(--ink-mute)', flexShrink: 0 }}>{ok ? I.check(15) : I.upload(15)}</span>
      <span style={{ flex: 1, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{label}</span>
      {ok
        ? <button onClick={() => {}} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, cursor: 'pointer', font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)' }}>{I.eye(13)} Ver</button>
        : <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Pendiente</span>}
    </div>);

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Mi perfil</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>Tus datos, tus direcciones de entrega y tu código Shipping Mark.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* ── Identidad ── */}
        <U.Card padded>
          <div style={{ position: 'relative', width: 92, height: 92, margin: '0 auto 14px' }}>
            {photo
              ? <img src={photo} alt={me.name} style={{ width: 92, height: 92, borderRadius: '50%', objectFit: 'cover', display: 'block', border: '2px solid var(--border)' }} />
              : <U.Avatar initials={initials} color="wine" size={92} />}
            <button onClick={() => fileRef.current && fileRef.current.click()} title="Cambiar foto"
              style={{ position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: '50%', background: 'var(--wine)', color: '#fff', border: '2px solid var(--bg-surface)', display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
              {I.camera(14)}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ font: '900 18px/1.2 var(--f-display)', color: 'var(--ink)' }}>{me.name}</div>
            <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{esEmpresa ? me.company : 'Persona natural'}</div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, padding: '4px 10px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.04em' }}>
              {esEmpresa ? I.building(12) : I.users(12)} {esEmpresa ? 'Cuenta de empresa' : 'Cuenta personal'}
            </span>
          </div>
          <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>TU CÓDIGO</div>
            <code style={{ font: '900 28px/1 var(--f-mono)', color: '#fff', display: 'block', marginTop: 10, letterSpacing: '0.04em' }}>{me.markbox}</code>
            <div style={{ marginTop: 6, font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.6)' }}>Tus proveedores chinos deben anotar este código en cada caja.</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <U.Btn variant="secondary" icon={I.copy(13)} full onClick={copyCode}>{copied ? '✓ Copiado' : 'Copiar código'}</U.Btn>
          </div>
        </U.Card>

        {/* ── Columna derecha ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Datos de cuenta (sin clasificación interna) */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DATOS DE CUENTA</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <U.Field label="Nombre" value={me.name} />
              <U.Field label="Email" value={email} />
              <U.Field label="Teléfono" value={phone} mono />
              <U.Field label="Ciudad" value={me.city || def.city} />
            </div>
          </U.Card>

          {/* Identidad · persona y, si aplica, empresa */}
          <U.Card padded>
            <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>IDENTIDAD Y DOCUMENTOS</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: 'var(--ink-soft)' }}>{I.idcard(15)}</span>
              <span style={{ ...eyebrow }}>Datos personales</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
              <U.Field label="Nombre completo" value={me.name} />
              <U.Field label="Cédula" value={cedula} mono />
            </div>
            {docRow('Cédula de identidad', true)}

            {esEmpresa ? (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ color: 'var(--ink-soft)' }}>{I.building(15)}</span>
                  <span style={{ ...eyebrow }}>Datos de empresa</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 12 }}>
                  <U.Field label="Razón social" value={me.company} />
                  <U.Field label="RIF" value={me.rif} mono />
                </div>
                {docRow('Fachada del local', true)}
              </div>
            ) : (
              <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: 'var(--wine)', flexShrink: 0, marginTop: 1 }}>{I.building(16)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>¿Importas para tu negocio?</div>
                  <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '3px 0 10px' }}>Registra tu empresa para facturar a su nombre, sin dejar de usar tu cuenta personal.</div>
                  <U.Btn variant="secondary" size="sm" icon={I.plus(13)}>Registrar empresa</U.Btn>
                </div>
              </div>
            )}
          </U.Card>

          {/* Direcciones de entrega · last-mile recalculable */}
          <U.Card padded>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
              <div className="eyebrow eyebrow-wine">DIRECCIONES DE ENTREGA</div>
              <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{addresses.length} de 4</span>
            </div>
            <p style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
              Tu dirección <b>predeterminada</b> es donde recibes tu mercancía. El costo de entrega (last-mile) se calcula con ella y <b>se recalcula automáticamente</b> si eliges otra.
            </p>

            {/* Costo last-mile de la predeterminada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--wine-tint)', border: '1px solid var(--wine-soft)', borderRadius: 'var(--r-md)', marginBottom: 16 }}>
              <span style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.truck(18)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Entrega last-mile · {zone.zone}</div>
                <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Hacia <b style={{ color: 'var(--ink)' }}>{def.label}</b> · {def.city} · {zone.days} días hábiles</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--wine)' }}>${zone.fee}</div>
                <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>se suma al flete</div>
              </div>
            </div>

            {/* Lista de direcciones */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {addresses.map((a) => {
                const isDef = a.id === defaultId;
                const z = _lastMileZone(a.city, a.state);
                return (
                  <div key={a.id} style={{ border: '1px solid ' + (isDef ? 'var(--wine)' : 'var(--border)'), borderRadius: 'var(--r-md)', padding: 14, background: isDef ? 'var(--wine-tint)' : 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <span style={{ color: isDef ? 'var(--wine)' : 'var(--ink-mute)', flexShrink: 0, marginTop: 1 }}>{I.pin(16)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ font: '700 13.5px/1.2 var(--f-display)', color: 'var(--ink)' }}>{a.label}</span>
                          {a.principal && <span style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg-elevated)', padding: '3px 7px', borderRadius: 'var(--r-pill)' }}>Principal</span>}
                          {isDef && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '700 9px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: '#fff', background: 'var(--wine)', padding: '3px 7px', borderRadius: 'var(--r-pill)' }}>{I.star(10)} Predeterminada</span>}
                        </div>
                        <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{a.line}</div>
                        <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{a.city} · {a.state}{a.ref ? ' · ' + a.ref : ''} · <span style={{ color: 'var(--ink-soft)' }}>last-mile ${z.fee}</span></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {!isDef && <U.Btn variant="primary" size="sm" icon={I.star(12)} onClick={() => setDefaultId(a.id)}>Usar como predeterminada</U.Btn>}
                      {isDef && <span style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 0' }}>{I.check(13)} Calculando tu envío con esta</span>}
                      <U.Btn variant="ghost" size="sm" icon={I.edit(12)}>Editar</U.Btn>
                      {!a.principal && <U.Btn variant="ghost" size="sm" icon={I.trash(12)} onClick={() => removeAddr(a.id)}>Eliminar</U.Btn>}
                    </div>
                  </div>);
              })}
            </div>

            {/* Agregar dirección */}
            <div style={{ marginTop: 12 }}>
              {adding ? (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <U.Input label="Nombre (Casa, Local…)" value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Ej. Depósito 2" />
                    <div>
                      <label style={{ display: 'block', font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 7 }}>Ciudad</label>
                      <select value={draft.cityIdx} onChange={(e) => setDraft({ ...draft, cityIdx: parseInt(e.target.value) })}
                        style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13px/1 var(--f-sans)' }}>
                        {_PORTAL_CITIES.map((c, i) => <option key={i} value={i}>{c[0]} · ${_lastMileZone(c[0], c[1]).fee} last-mile</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <U.Input label="Dirección exacta" value={draft.line} onChange={(e) => setDraft({ ...draft, line: e.target.value })} placeholder="Av. principal, edificio, piso, local" />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <U.Input label="Punto de referencia (opcional)" value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })} placeholder="Cerca de…" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <U.Btn variant="primary" size="sm" icon={I.check(13)} onClick={addAddr} disabled={!draft.label.trim() || !draft.line.trim()}>Guardar dirección</U.Btn>
                    <U.Btn variant="ghost" size="sm" onClick={() => { setAdding(false); setDraft({ label: '', cityIdx: 0, line: '', ref: '' }); }}>Cancelar</U.Btn>
                  </div>
                </div>
              ) : (
                addresses.length < 4
                  ? <U.Btn variant="secondary" icon={I.plus(14)} full onClick={() => setAdding(true)}>Agregar dirección de entrega</U.Btn>
                  : <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', textAlign: 'center', margin: 0 }}>Llegaste al máximo de 4 direcciones. Elimina una para agregar otra.</p>
              )}
            </div>
          </U.Card>
        </div>
      </div>
    </div>);

}

// ── Footer ───────────────────────────────────────────────────
// ── Calculadora CBM · embebida en el portal (no saca al cliente) ──
function PortalCalculadora({ me, setView }) {
  const I = window.Icon;
  return (
    <div>
      <button onClick={() => setView('home')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14, background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Volver al inicio</button>
      <div className="eyebrow eyebrow-wine">HERRAMIENTA</div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '8px 0 6px' }}>Calculadora CBM</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-5)', maxWidth: '60ch' }}>Saca el costo estimado de tu envío sin salir del portal.</p>
      <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', background: 'var(--bg-surface)' }}>
        <iframe title="Calculadora CBM" src={`Calculadora CBM · DTD-Cargo.html?mb=${encodeURIComponent(me.markbox || '')}`} style={{ width: '100%', height: 'calc(100vh - 240px)', minHeight: 680, border: 0, display: 'block' }} />
      </div>
    </div>);
}

// ── Calculadora normal (teclado/teclas) · dentro de la ventana flotante ──
function NormalCalc() {
  const I = window.Icon;
  const [expr, setExpr] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const ev = (s) => { try { const c = String(s).replace(/×/g, '*').replace(/÷/g, '/').replace(/%/g, '/100'); if (!/^[-0-9+*/(). ]*$/.test(c) || !c.trim()) return ''; const v = Function('return (' + c + ')')(); return isFinite(v) ? String(Math.round(v * 1e8) / 1e8) : ''; } catch (e) { return ''; } };
  const res = ev(expr);
  const press = (k) => { if (k === 'C') return setExpr(''); if (k === '⌫') return setExpr(expr.slice(0, -1)); if (k === '=') { const r = ev(expr); if (r) setExpr(r); return; } setExpr(expr + k); };
  const copy = () => { const v = res || expr; if (!v) return; try { navigator.clipboard?.writeText(v); } catch (e) {} setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '%', '+'];
  return (
    <div style={{ padding: 14 }}>
      <input value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); press('='); } }} inputMode="decimal" placeholder="0" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'right', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 14px', font: '700 22px/1.1 var(--f-mono)', color: 'var(--ink)', background: 'var(--bg-base)', outline: 'none' }} />
      <div style={{ textAlign: 'right', font: '600 13px/1 var(--f-mono)', color: 'var(--ink-mute)', minHeight: 15, margin: '6px 2px 12px' }}>{res && res !== expr ? '= ' + res : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
        {keys.map((k) => { const op = /[÷×\-+]/.test(k); return <button key={k} onClick={() => press(k)} style={{ padding: '12px 0', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', cursor: 'pointer', font: '700 16px/1 var(--f-mono)', background: op ? 'var(--wine-tint)' : 'var(--bg-surface)', color: op ? 'var(--wine)' : 'var(--ink)' }}>{k}</button>; })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginTop: 7 }}>
        <button onClick={() => press('C')} style={{ padding: '11px 0', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', cursor: 'pointer', font: '700 13px/1 var(--f-sans)', background: 'var(--bg-surface)', color: 'var(--danger)' }}>C</button>
        <button onClick={() => press('⌫')} style={{ padding: '11px 0', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', cursor: 'pointer', font: '700 15px/1 var(--f-mono)', background: 'var(--bg-surface)', color: 'var(--ink)' }}>⌫</button>
        <button onClick={() => press('=')} style={{ padding: '11px 0', borderRadius: 'var(--r-md)', border: 0, cursor: 'pointer', font: '800 16px/1 var(--f-mono)', background: 'var(--wine)', color: '#fff' }}>=</button>
      </div>
      <button onClick={copy} style={{ width: '100%', marginTop: 9, padding: '10px 0', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', cursor: 'pointer', font: '700 12px/1 var(--f-sans)', background: 'var(--bg-surface)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{copied ? I.check(13) : I.copy(13)} {copied ? 'Copiado' : 'Copiar resultado'}</button>
    </div>);
}

// ── Calculadora flotante · FAB siempre visible + ventana móvil (no saca de nada) ──
function PortalCalcFab({ markbox }) {
  const I = window.Icon;
  const [open, setOpen] = pUseState(false);
  const [calcTab, setCalcTab] = pUseState('cbm');
  const [fpos, setFpos] = pUseState(null);
  const [ppos, setPpos] = pUseState(null);
  const [size, setSize] = pUseState({ w: 372, h: 520 });
  const draggedRef = React.useRef(false);
  const startFabDrag = (e) => {
    draggedRef.current = false;
    const sx = e.clientX, sy = e.clientY;
    const ox = fpos ? fpos.x : (window.innerWidth - 168), oy = fpos ? fpos.y : (window.innerHeight - 64);
    const move = (ev) => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) draggedRef.current = true; setFpos({ x: Math.max(8, Math.min(window.innerWidth - 60, ox + (ev.clientX - sx))), y: Math.max(8, Math.min(window.innerHeight - 56, oy + (ev.clientY - sy))) }); };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  };
  const startPanelDrag = (e) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const ox = ppos ? ppos.x : (window.innerWidth - size.w - 24), oy = ppos ? ppos.y : (window.innerHeight - size.h - 92);
    const move = (ev) => setPpos({ x: Math.max(8, Math.min(window.innerWidth - size.w, ox + (ev.clientX - sx))), y: Math.max(8, Math.min(window.innerHeight - 80, oy + (ev.clientY - sy))) });
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  };
  const fabStyle = fpos ? { left: fpos.x, top: fpos.y } : { right: 24, bottom: 24 };
  const px = ppos ? ppos.x : (window.innerWidth - size.w - 24);
  const py = ppos ? ppos.y : (window.innerHeight - size.h - 92);
  const startResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ow = size.w, oh = size.h;
    if (!ppos) setPpos({ x: px, y: py });
    const move = (ev) => setSize({ w: Math.max(300, Math.min(window.innerWidth - 24, ow + (ev.clientX - sx))), h: Math.max(320, Math.min(window.innerHeight - 120, oh + (ev.clientY - sy))) });
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  };
  return (
    <React.Fragment>
      {open &&
      <div style={{ position: 'fixed', zIndex: 250, left: px, top: py, width: size.w, maxWidth: 'calc(100vw - 16px)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div onPointerDown={startPanelDrag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--ink)', color: '#fff', cursor: 'move', touchAction: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--wine-soft)', display: 'flex' }}>{I.calc(15)}</span>
            <span style={{ font: '800 13px/1 var(--f-display)' }}>Calculadora CBM</span>
            <span style={{ font: '600 9px/1 var(--f-mono)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em' }}>· arrastra</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Cerrar" style={{ background: 'none', border: 0, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
          {[['cbm', 'CBM'], ['normal', 'Normal']].map((t) => <button key={t[0]} onClick={() => setCalcTab(t[0])} style={{ font: (calcTab === t[0] ? '700' : '600') + ' 11px/1 var(--f-sans)', padding: '5px 11px', borderRadius: 'var(--r-pill)', border: 0, cursor: 'pointer', background: calcTab === t[0] ? 'var(--wine)' : 'transparent', color: calcTab === t[0] ? '#fff' : 'var(--ink-soft)' }}>{t[1]}</button>)}
          <span style={{ marginLeft: 'auto', font: '600 9.5px/1 var(--f-sans)', padding: '5px 9px', borderRadius: 'var(--r-pill)', color: 'var(--ink-mute)', background: 'var(--bg-surface)' }}>Contenedor · pronto</span>
        </div>
        {calcTab === 'cbm'
          ? <iframe title="Calculadora CBM" src={`Calculadora CBM · DTD-Cargo.html?mb=${encodeURIComponent(markbox || '')}`} style={{ width: '100%', height: size.h, border: 0, display: 'block', background: '#fff' }} />
          : <div style={{ maxHeight: size.h, overflowY: 'auto' }}><NormalCalc /></div>}
        <div onPointerDown={startResize} title="Arrastra para ampliar" style={{ position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, cursor: 'nwse-resize', touchAction: 'none', background: 'linear-gradient(135deg, transparent 45%, var(--wine) 45%, var(--wine) 60%, transparent 60%, transparent 72%, var(--wine) 72%, var(--wine) 86%, transparent 86%)' }} />
      </div>}
      <button onPointerDown={startFabDrag} onClick={() => { if (!draggedRef.current) setOpen((o) => !o); }} title="Calculadora CBM · arrastra para mover" style={{ position: 'fixed', zIndex: 251, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 'var(--r-pill)', background: open ? 'var(--wine-deep)' : 'var(--wine)', color: '#fff', border: '2px solid var(--bg-surface)', boxShadow: 'var(--shadow-pop)', cursor: 'grab', font: '700 13px/1 var(--f-sans)', touchAction: 'none', ...fabStyle }}>
        {I.calc(16)} Calculadora
      </button>
    </React.Fragment>);
}

function PortalFooter() {
  return (
    <footer style={{ marginTop: 80, padding: '32px var(--s-6)', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <PortalLogo />
        <div style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
          © 2026 DTD-Cargo · Portal del Cliente v1.0 · <a style={{ color: 'var(--wine)' }}>Términos</a> · <a style={{ color: 'var(--wine)' }}>Privacidad</a>
        </div>
      </div>
    </footer>);

}

// ── Tus proveedores · re-compra + alta + etiquetas ──────────
function PortalSuppliers({ me, setView }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const goCompra = (s) => { _preselectProv = { n: s.n, name: s.name, orders: s.orders }; if (setView) setView('nueva-compra'); };
  // Prefijo del tenant · aliados = DTD fijo · otros tenants configurable en Admin
  const PREFIX = window.ERPData?.tenantCodePrefix?.() || (me.markbox || 'DTD-5502').split('-')[0];
  const clientNo = (me.markbox || 'DTD-5502').split('-')[1];

  const [suppliers] = pUseState(
    window.ERPData?.suppliersFor?.(me.markbox) || [
    { n: 1, name: 'Yiwu Standard Co', orders: 2 },
    { n: 2, name: 'Shenzhen Lights Ltd', orders: 1 }]

  );
  const [helpOpen, setHelpOpen] = pUseState(() => { try { return localStorage.getItem('dtd-portal-supp-help') === '1'; } catch (e) { return false; } });

  const codeFor = (s, order) => `${PREFIX}-${clientNo}-${s.n}-${order}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', margin: '0 0 10px' }}>
        <div>
          <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Tus proveedores</h1>
          <p style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '8px 0 0', maxWidth: '52ch' }}>Cada compra es una <b style={{ color: 'var(--wine)' }}>prealerta</b>: generas un código por proveedor y nos avisas que viene tu mercancía.</p>
        </div>
        <U.Btn variant="primary" icon={I.plus(14)} onClick={() => setView && setView('nueva-compra')}>Nueva compra</U.Btn>
      </div>

      {/* Cómo funciona · plegable (no satura una vez visto) */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: 'var(--s-5)', overflow: 'hidden' }}>
        <button onClick={() => { const v = !helpOpen; setHelpOpen(v); try { localStorage.setItem('dtd-portal-supp-help', v ? '1' : '0'); } catch (e) {} }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--bg-elevated)', border: 0, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ color: 'var(--wine)', flexShrink: 0 }}>{I.info(14)}</span>
          <span style={{ flex: 1, font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>¿Cómo funciona registrar un proveedor?</span>
          <span style={{ color: 'var(--ink-mute)', transform: helpOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur) var(--ease)' }}>{I.chevD(14)}</span>
        </button>
        {helpOpen &&
        <div style={{ padding: '16px 16px 18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.truck(15)}</span>
              <div>
                <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Rapidez</div>
                <div style={{ font: '500 11px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>La caja entra identificada y no espera como “huérfana”.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.shield(15)}</span>
              <div>
                <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Control total</div>
                <div style={{ font: '500 11px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>Al llegar el envío, el código ya dice de qué proveedor viene.</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', font: '600 12px/1.5 var(--f-sans)', color: 'var(--success)' }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>{I.check(14)}</span>
            <span>Copia el código y envíaselo SOLO al proveedor — a nosotros nos llega automático al registrarlo.</span>
          </div>
        </div>}
      </div>

      {/* Lista de proveedores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {suppliers.map((s) =>
        <U.Card key={s.n} padded>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', font: '900 15px/1 var(--f-display)' }}>#{s.n}</div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.name}</div>
                <div style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>
                  {s.orders} compra{s.orders > 1 ? 's' : ''} · próxima: <b style={{ color: 'var(--wine)' }}>{codeFor(s, s.orders + 1)}</b>
                </div>
              </div>
              <U.Btn variant="primary" size="sm" iconRight={I.arrowR(13)} onClick={() => goCompra(s)}>Re-comprar</U.Btn>
            </div>
          </U.Card>
        )}
      </div>

      {/* Agregar proveedor nuevo */}
      <div style={{ marginTop: 'var(--s-4)' }}>
        <U.Btn variant="secondary" icon={I.plus(14)} onClick={() => setView && setView('nueva-compra')}>Agregar proveedor nuevo</U.Btn>
      </div>
    </div>);

}

let _preselectProv = null;

// ── Códigos de país · proveedor (China primero · +86 por defecto) ──
const _PHONE_CODES = [
  { c: 'CN', dial: '+86', name: 'China' },
  { c: 'HK', dial: '+852', name: 'Hong Kong' },
  { c: 'TW', dial: '+886', name: 'Taiwán' },
  { c: 'VE', dial: '+58', name: 'Venezuela' },
  { c: 'US', dial: '+1', name: 'EE.UU. / Canadá' },
  { c: 'CO', dial: '+57', name: 'Colombia' },
  { c: 'IN', dial: '+91', name: 'India' },
  { c: 'TR', dial: '+90', name: 'Turquía' },
];

// ── Nueva compra · pantalla completa · formulario "Registra tu compra" ──
function PortalNuevaCompra({ me, setView }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const PREFIX = window.ERPData?.tenantCodePrefix?.() || (me.markbox || 'DTD-5502').split('-')[0];
  const clientNo = (me.markbox || 'DTD-5502').split('-')[1];
  const [suppliers] = pUseState(window.ERPData?.suppliersFor?.(me.markbox) || [
    { n: 1, name: 'Yiwu Standard Co', orders: 2 },
    { n: 2, name: 'Shenzhen Lights Ltd', orders: 1 },
  ]);
  const _pre = _preselectProv; _preselectProv = null;
  const [query, setQuery] = pUseState(_pre ? _pre.name : '');
  const [chosen, setChosen] = pUseState(_pre ? { n: _pre.n, name: _pre.name, orders: _pre.orders } : null);
  const [open, setOpen] = pUseState(false);
  const [newCode, setNewCode] = pUseState('+86');
  const [newDigits, setNewDigits] = pUseState('');
  const [provSaved, setProvSaved] = pUseState(false);
  const [step, setStep] = pUseState(1);
  const [showInfo, setShowInfo] = pUseState(true);
  const [pulse, setPulse] = pUseState(false);
  const pulsedRef = React.useRef(false);
  const [plOpen, setPlOpen] = pUseState(false);
  const [isWide, setIsWide] = pUseState(typeof window !== 'undefined' ? window.innerWidth >= 860 : true);
  React.useEffect(() => { const t = setTimeout(() => setShowInfo(false), 6000); return () => clearTimeout(t); }, []);
  React.useEffect(() => { const f = () => setIsWide(window.innerWidth >= 860); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  React.useEffect(() => { if (showInfo || pulsedRef.current) return; pulsedRef.current = true; setPulse(true); try { if (navigator.vibrate) navigator.vibrate([60, 120, 60, 120, 60, 200, 80]); } catch (e) {} const t = setTimeout(() => setPulse(false), 8000); return () => clearTimeout(t); }, [showInfo]);
  const [newCity, setNewCity] = pUseState('');
  const [newAccount, setNewAccount] = pUseState('');
  const [linkCopied, setLinkCopied] = pUseState(false);
  const [wechat, setWechat] = pUseState('');
  const [shot, setShot] = pUseState(null);
  const [dragOver, setDragOver] = pUseState(false);
  const shotRef = React.useRef(null);
  const [desc, setDesc] = pUseState('');
  const [cajas, setCajas] = pUseState(1);
  const [valor, setValor] = pUseState('');
  const [tracking, setTracking] = pUseState('');
  const [docs, setDocs] = pUseState({ packing: false, factura: false, fotos: false });
  const [registered, setRegistered] = pUseState(null);

  const provOk = !!chosen && (!chosen.isNew || provSaved);
  const submit = () => {
    if (!provOk) return;
    const c = chosen.isNew
      ? `${PREFIX}-${clientNo}-${suppliers.length + 1}-1`
      : `${PREFIX}-${clientNo}-${chosen.n}-${chosen.orders + 1}`;
    setRegistered(c);
  };
  const previewCode = chosen ? (chosen.isNew ? `${PREFIX}-${clientNo}-${suppliers.length + 1}-1` : `${PREFIX}-${clientNo}-${chosen.n}-${chosen.orders + 1}`) : null;
  const provLink = (code) => 'packlist/Packing List + Factura · DTD-Cargo.html?order=' + encodeURIComponent(code) + '&mb=' + encodeURIComponent(me.markbox || '') + '&cliente=' + encodeURIComponent(me.name || '');
  const copyLink = (code) => { try { navigator.clipboard?.writeText('Hola, por favor completa el Packing List + Factura de mi compra DTD-Cargo (código ' + code + '): ' + provLink(code)); } catch (e) {} setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };
  const packlistPanel = (code) => !plOpen ? null : (isWide ?
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ color: 'var(--wine)', display: 'flex', flexShrink: 0 }}>{I.doc(16)}</span>
          <span style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Packing List + Factura</span>
          <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{code}</code>
        </div>
        <U.Btn variant="ghost" icon={I.close ? I.close(14) : I.arrowL(14)} onClick={() => setPlOpen(false)}>Cerrar</U.Btn>
      </div>
      <iframe title="Packing List + Factura" src={provLink(code)} style={{ flex: 1, width: '100%', border: 0, display: 'block', background: '#fff' }} />
    </div>
    :
    <div style={{ marginTop: 12, borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <iframe title="Packing List + Factura" src={provLink(code)} style={{ width: '100%', height: 520, border: 0, display: 'block', background: '#fff' }} />
    </div>);

  const lblS = { display: 'block', font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 8 };
  const optS = { textTransform: 'none', letterSpacing: 0, color: 'var(--ink-mute)', fontWeight: 600 };
  const inS = { width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 14px/1.4 var(--f-sans)' };
  const upRow = (k, label, ok, onClick) => (
    <button key={k} type="button" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid ' + (ok ? 'var(--success)' : 'var(--border)'), background: ok ? 'var(--success-bg)' : 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ color: ok ? 'var(--success)' : 'var(--ink-mute)', display: 'flex' }}>{ok ? I.check(15) : I.doc(15)}</span>
      <span style={{ flex: 1, font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{label}</span>
      <span style={{ font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: ok ? 'var(--success)' : 'var(--wine)' }}>{ok ? 'Cargado' : 'Subir'}</span>
    </button>);

  const q = query.trim().toLowerCase();
  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(q));
  const exact = suppliers.find((s) => s.name.toLowerCase() === q);
  const choose = (s) => { setChosen(s); setQuery(s.name); setOpen(false); };
  const createNew = () => { const name = query.trim(); if (!name) return; setChosen({ isNew: true, name }); setProvSaved(false); setOpen(false); };
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); if (exact) choose(exact); else if (query.trim()) createNew(); } };
  const onPhone = (raw) => {
    const s = String(raw);
    if (s.trim().startsWith('+')) {
      const cleaned = '+' + s.trim().slice(1).replace(/[^\d]/g, '');
      const match = _PHONE_CODES.map((o) => o.dial).filter((d) => cleaned.startsWith(d)).sort((a, b) => b.length - a.length)[0];
      if (match) { setNewCode(match); setNewDigits(cleaned.slice(match.length)); return; }
    }
    setNewDigits(s.replace(/[^\d]/g, ''));
  };
  const readShot = (f) => { const r = new FileReader(); r.onload = () => setShot(r.result); r.readAsDataURL(f); };

  const step1Done = provOk;
  const step2Done = desc.trim().length > 0;
  const step3Done = docs.packing || docs.factura || docs.fotos;
  const doneArr = [provOk, step > 2, step3Done];
  const steps = [{ n: 1, l: 'Proveedor' }, { n: 2, l: 'Detalle' }, { n: 3, l: 'Adjuntos' }];
  const activeIdx = step - 1;
  const modS = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--s-6)', marginBottom: 'var(--s-5)' };
  const modHead = (n, title, sub, state) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 'var(--s-5)' }}>
      <span style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', font: '800 13px/1 var(--f-display)', background: state === 'done' ? 'var(--wine)' : state === 'active' ? 'var(--wine-tint)' : 'var(--bg-elevated)', color: state === 'done' ? '#fff' : state === 'active' ? 'var(--wine)' : 'var(--ink-mute)', border: '1px solid ' + (state === 'active' ? 'var(--wine)' : 'transparent') }}>{state === 'done' ? I.check(14) : n}</span>
      <div>
        <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>{title}</div>
        <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{sub}</div>
      </div>
    </div>);

  if (registered) {
    return (
      <div>
        <button onClick={() => setView('shipments')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14, background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Volver a Alertas · mis envíos</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'var(--success-bg)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--s-6)', maxWidth: 680 }}>
          <span style={{ color: 'var(--success)', display: 'flex', flexShrink: 0 }}>{I.check(20)}</span>
          <div>
            <div style={{ font: '800 15px/1.2 var(--f-display)', color: 'var(--ink)' }}>Pre-alerta registrada</div>
            <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Tu código es <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{registered}</code> · genera y envía las etiquetas a tu proveedor.</div>
          </div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--s-6)', marginBottom: 'var(--s-6)', maxWidth: 680 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.doc(15)}</span>
            <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Que tu proveedor complete el detalle</div>
          </div>
          <p style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>Envíale este link a tu proveedor para que llene el <b>Packing List + Factura</b> (medidas, cantidades y valor reales). Así se completa tu compra sin que tengas que pedirle los datos por chat.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <U.Btn variant="primary" icon={linkCopied ? I.check(14) : I.copy(14)} onClick={() => copyLink(registered)}>{linkCopied ? 'Link copiado' : 'Copiar link para el proveedor'}</U.Btn>
            <U.Btn variant="secondary" icon={plOpen ? I.chevU(13) : I.doc(13)} onClick={() => setPlOpen(!plOpen)}>{plOpen ? 'Cerrar Packing List' : 'Abrir Packing List + Factura'}</U.Btn>
          </div>
          <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '12px 0 0' }}>Las <b>etiquetas que el proveedor pega en cada caja</b> se generan dentro del Packing List, según las cajas que él confirme. No hace falta imprimirlas aquí.</p>
          {packlistPanel(registered)}
        </div>
      </div>);
  }

  return (
    <div>
      <button onClick={() => setView('shipments')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14, background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Volver a Alertas · mis envíos</button>
      <div className="eyebrow eyebrow-wine">NUEVA COMPRA · PREALERTA</div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '8px 0 6px' }}>Registra tu compra</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-5)', maxWidth: '60ch' }}>Cuéntanos qué viene de China. Esto crea una <b style={{ color: 'var(--wine)' }}>prealerta</b> y genera el código y las etiquetas para tu proveedor.</p>

      {showInfo ?
      <div style={{ display: 'flex', gap: 12, padding: '14px 16px', background: 'var(--info-bg)', border: '1px solid var(--info)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--s-6)', maxWidth: 680 }}>
        <span style={{ color: 'var(--info)', flexShrink: 0, marginTop: 1 }}>{I.info(16)}</span>
        <div style={{ flex: 1 }}>
          <div style={{ font: '800 13px/1.3 var(--f-display)', color: 'var(--ink)' }}>Esto es un prellenado</div>
          <p style={{ font: '500 12px/1.55 var(--f-sans)', color: 'var(--ink-soft)', margin: '4px 0 0' }}>Con el <b>proveedor y su teléfono</b> ya creas la pre-alerta — no necesitas tenerlo todo ahora. Los datos fuertes (medidas, cantidades, factura) los <b>termina tu proveedor</b> en el Packing List + Factura; al registrar te damos el link para enviárselo.</p>
        </div>
        <button type="button" onClick={() => setShowInfo(false)} aria-label="Cerrar" style={{ background: 'none', border: 0, color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>
      :
      <React.Fragment>
        <style>{'@keyframes dtd-hb{0%,100%{transform:scale(1)}12%{transform:scale(1.07)}24%{transform:scale(1)}38%{transform:scale(1.07)}60%{transform:scale(1)}}'}</style>
        <button type="button" onClick={() => { setShowInfo(true); setPulse(false); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 13px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (pulse ? 'var(--wine)' : 'var(--border)'), background: pulse ? 'var(--wine-tint)' : 'var(--bg-surface)', color: pulse ? 'var(--wine)' : 'var(--ink-soft)', font: '600 12px/1 var(--f-sans)', cursor: 'pointer', marginBottom: 'var(--s-6)', transformOrigin: 'left center', animation: pulse ? 'dtd-hb 1s ease-in-out 6' : 'none' }}>
          <span style={{ color: pulse ? 'var(--wine)' : 'var(--info)', display: 'flex' }}>{I.info(13)}</span> Esto es un prellenado · cómo funciona
        </button>
      </React.Fragment>}

      <div style={{ maxWidth: 680 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--s-6)' }}>
          {steps.map((st, i, arr) => (
            <React.Fragment key={st.n}>
              <button type="button" onClick={() => { const t = i + 1; if (t <= step || provOk) setStep(t); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', font: '800 11px/1 var(--f-display)', flexShrink: 0, background: doneArr[i] ? 'var(--wine)' : i === activeIdx ? 'var(--wine-tint)' : 'var(--bg-elevated)', color: doneArr[i] ? '#fff' : i === activeIdx ? 'var(--wine)' : 'var(--ink-mute)', border: '1px solid ' + (i === activeIdx && !doneArr[i] ? 'var(--wine)' : 'transparent') }}>{doneArr[i] ? I.check(12) : st.n}</span>
                <span style={{ font: (i === activeIdx ? '700' : '600') + ' 12px/1 var(--f-sans)', color: doneArr[i] ? 'var(--wine)' : i === activeIdx ? 'var(--ink)' : 'var(--ink-mute)' }}>{st.l}</span>
              </button>
              {i < arr.length - 1 && <span style={{ flex: 1, height: 2, background: 'var(--border)', borderRadius: 2, minWidth: 14 }} />}
            </React.Fragment>
          ))}
        </div>

        <div style={{ ...modS, display: step === 1 ? 'block' : 'none' }}>
          {modHead(1, 'Proveedor', 'A quién le compras esta vez', step1Done ? 'done' : 'active')}
          <div style={{ position: 'relative', marginBottom: 'var(--s-5)' }}>
            <label style={lblS}>Proveedor</label>
            <input value={query} onChange={(e) => { setQuery(e.target.value); setChosen(null); setProvSaved(false); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)} onKeyDown={onKey} placeholder="Escribe para buscar tu proveedor…" style={inS} />
            {chosen &&
            <div style={{ font: '600 11.5px/1.4 var(--f-sans)', color: chosen.isNew ? 'var(--wine)' : 'var(--success)', marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {chosen.isNew ? <React.Fragment>{I.plus(12)} Se creará un proveedor nuevo: «{chosen.name}»</React.Fragment> : <React.Fragment>{I.check(12)} Proveedor existente seleccionado</React.Fragment>}
            </div>}
            {open && (query.length > 0 || filtered.length > 0) &&
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
              {filtered.map((s) => (
                <button key={s.n} type="button" onMouseDown={(e) => { e.preventDefault(); choose(s); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'none', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center', font: '800 11px/1 var(--f-display)', flexShrink: 0 }}>#{s.n}</span>
                  <span style={{ flex: 1, font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.name}</span>
                </button>
              ))}
              {query.trim() && !exact &&
              <button type="button" onMouseDown={(e) => { e.preventDefault(); createNew(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--wine-tint)', border: 0, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ color: 'var(--wine)', display: 'flex' }}>{I.plus(14)}</span>
                <span style={{ flex: 1, font: '700 13px/1.2 var(--f-sans)', color: 'var(--wine)' }}>Crear «{query.trim()}»</span>
                <span style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>Enter</span>
              </button>}
              {filtered.length === 0 && !query.trim() &&
              <div style={{ padding: '11px 14px', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Escribe el nombre de tu proveedor.</div>}
            </div>}
          </div>
          {chosen && chosen.isNew && (provSaved ?
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--success-bg)', border: '1px solid rgba(31,138,91,0.3)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 'var(--s-5)' }}>
            <span style={{ color: 'var(--success)', flexShrink: 0, display: 'flex' }}>{I.check(18)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Proveedor nuevo guardado</div>
              <div style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{chosen.name}{newDigits ? ' · ' + newCode + ' ' + newDigits : ''}{shot ? ' · WeChat (captura)' : ''}{newCity ? ' · ' + newCity : ''}</div>
            </div>
            <button type="button" onClick={() => setProvSaved(false)} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine)', background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{I.edit(12)} Editar</button>
          </div>
          :
          <div style={{ background: 'var(--wine-tint)', border: '1px solid var(--wine-soft)', borderRadius: 'var(--r-md)', padding: 16, marginBottom: 'var(--s-5)' }}>
            <div style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--wine)', marginBottom: 12 }}>Datos del proveedor nuevo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lblS}>Teléfono <span style={optS}>· recomendado</span></label>
                <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
                  <select value={newCode} onChange={(e) => setNewCode(e.target.value)} aria-label="Código de país" style={{ appearance: 'none', WebkitAppearance: 'none', border: 0, outline: 0, backgroundColor: 'var(--bg-elevated)', color: 'var(--wine)', font: '700 13px/1 var(--f-mono)', padding: '0 24px 0 12px', cursor: 'pointer', borderRight: '1px solid var(--border)', backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%237F0F1A' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
                    {_PHONE_CODES.map((o) => <option key={o.c} value={o.dial}>{o.c} {o.dial}</option>)}
                  </select>
                  <input value={newDigits} onChange={(e) => onPhone(e.target.value)} inputMode="tel" placeholder="138 0000 0000" style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', font: '600 13.5px/1.4 var(--f-mono)', color: 'var(--ink)', padding: '12px' }} />
                </div>
              </div>
              <div>
                <label style={lblS}>Ciudad <span style={optS}>· opcional</span></label>
                <input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Yiwu · Shenzhen · Guangzhou…" style={inS} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lblS}>WeChat del proveedor <span style={optS}>· captura del ID o QR</span></label>
              <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '0 0 8px' }}>Si tu proveedor no tiene número, sube o toma una foto de su <b>ID o código QR de WeChat</b> — así lo contactamos y agilizamos tu compra.</p>
              {shot ?
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--success)', background: 'var(--success-bg)', borderRadius: 'var(--r-md)' }}>
                <img src={shot} alt="WeChat" style={{ width: 48, height: 48, borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
                <span style={{ flex: 1, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--success)' }}>Captura cargada</span>
                <button type="button" onClick={() => setShot(null)} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine)', background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>{I.trash(12)} Quitar</button>
              </div>
              :
              <div onClick={() => shotRef.current && shotRef.current.click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readShot(f); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '20px 16px', borderRadius: 'var(--r-md)', border: '2px dashed ' + (dragOver ? 'var(--wine)' : 'var(--border-strong)'), background: dragOver ? 'var(--wine-tint)' : 'var(--bg-base)', cursor: 'pointer', textAlign: 'center' }}>
                <span style={{ color: 'var(--wine)', display: 'flex' }}>{I.camera(20)}</span>
                <span style={{ font: '700 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Arrastra la imagen o haz clic</span>
                <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)' }}>Sube una foto o tómala con la cámara · PNG/JPG</span>
              </div>}
              <input ref={shotRef} type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) readShot(f); }} style={{ display: 'none' }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lblS}>Cuenta Alibaba o contacto <span style={optS}>· opcional</span></label>
              <input value={newAccount} onChange={(e) => setNewAccount(e.target.value)} placeholder="Link de su tienda en Alibaba, o cómo lo contactas" style={inS} />
            </div>
            <U.Btn variant="primary" icon={I.check(14)} disabled={!(newDigits.trim() || shot)} onClick={() => setProvSaved(true)}>Guardar proveedor</U.Btn>
            {!(newDigits.trim() || shot) && <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '8px 0 0' }}>Pon al menos un contacto: teléfono (recomendado) o una captura del WeChat (ID o QR).</p>}
          </div>
          )}
        </div>

        <div style={{ ...modS, display: step === 2 ? 'block' : 'none' }}>
          {modHead(2, 'Detalle de la compra', 'Opcional · tu proveedor termina el detalle', step1Done ? (step2Done ? 'done' : 'active') : 'idle')}
          <div style={{ marginBottom: 'var(--s-5)' }}>
            <label style={lblS}>Descripción de la compra</label>
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej. 3 cajas de zapatos deportivos" rows={3} style={{ ...inS, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 'var(--s-5)' }}>
            <div>
              <label style={lblS}>Cajas</label>
              <input type="number" min="1" value={cajas} onChange={(e) => setCajas(Math.max(1, parseInt(e.target.value) || 1))} style={inS} />
            </div>
            <div>
              <label style={lblS}>Valor estimado USD <span style={optS}>· opcional</span></label>
              <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="—" style={inS} />
            </div>
          </div>
          <div>
            <label style={lblS}>Tracking China <span style={optS}>· opcional</span></label>
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Ej. SF1234567890" style={{ ...inS, fontFamily: 'var(--f-mono)' }} />
          </div>
        </div>

        <div style={{ ...modS, display: step === 3 ? 'block' : 'none' }}>
          {modHead(3, 'Adjuntos y link al proveedor', 'Opcional · acelera tu compra', step3Done ? 'done' : 'active')}
          <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '0 0 12px' }}>No son obligatorios, pero si los subes procesamos tu compra más rápido y te quedan de recordatorio en tu portal.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upRow('packing', 'Packing list', docs.packing, () => setDocs({ ...docs, packing: !docs.packing }))}
            {upRow('factura', 'Factura del proveedor', docs.factura, () => setDocs({ ...docs, factura: !docs.factura }))}
            {upRow('fotos', 'Fotos del producto', docs.fotos, () => setDocs({ ...docs, fotos: !docs.fotos }))}
          </div>
          {previewCode &&
          <div style={{ marginTop: 'var(--s-5)', paddingTop: 'var(--s-5)', borderTop: '1px solid var(--border)' }}>
            <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)', marginBottom: 6 }}>Que tu proveedor complete el detalle</div>
            <p style={{ font: '500 12px/1.55 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 12px' }}>Si no tienes todos los datos, envíale este link a tu proveedor para que llene el <b>Packing List + Factura</b>. Así se completa tu compra.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <U.Btn variant="secondary" icon={linkCopied ? I.check(14) : I.copy(14)} onClick={() => copyLink(previewCode)}>{linkCopied ? 'Link copiado' : 'Copiar link para el proveedor'}</U.Btn>
              <U.Btn variant="ghost" icon={plOpen ? I.chevU(13) : I.doc(13)} onClick={() => setPlOpen(!plOpen)}>{plOpen ? 'Cerrar Packing List' : 'Abrir Packing List + Factura'}</U.Btn>
            </div>
            <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '10px 0 0' }}>Las etiquetas que el proveedor pega en cada caja se generan dentro del Packing List.</p>
            {packlistPanel(previewCode)}
          </div>}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 'var(--s-2)' }}>
          {step > 1 && <U.Btn variant="ghost" icon={I.arrowL(14)} onClick={() => setStep(step - 1)}>Atrás</U.Btn>}
          <div style={{ flex: 1 }} />
          {step < 3 && <U.Btn variant="primary" iconRight={I.arrowR(14)} disabled={step === 1 && !provOk} onClick={() => setStep(step + 1)}>Siguiente</U.Btn>}
          {step === 3 && <U.Btn variant="primary" iconRight={I.arrowR(14)} disabled={!provOk} onClick={submit}>Registrar compra</U.Btn>}
        </div>
        {step === 1 && !provOk && <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', margin: '10px 0 0' }}>{chosen && chosen.isNew ? 'Guarda los datos de tu proveedor nuevo para continuar.' : 'Elige (o agrega) un proveedor para continuar.'}</p>}
      </div>
    </div>);
}

// ── Generador de etiquetas (código + QR · una por caja) ──────
function LabelGenerator({ code, me, onClose, embedded, startPhase, initialBoxes }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [phase, setPhase] = pUseState(startPhase || 'docs'); // docs → labels
  const [docs, setDocs] = pUseState({ packing: false, factura: false, fotos: 0 });
  const [boxes, setBoxes] = pUseState(initialBoxes || 30);
  const n = Math.max(1, Math.min(500, parseInt(boxes) || 1));

  // QR procedural (estilizado · el QR real lo genera el backend)
  const qr = (seed) => {
    const m = 11;const cell = 100 / m;let r = '';
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
      if (Math.abs(x - m / 2) < 2 && Math.abs(y - m / 2) < 2) continue;
      if (Math.sin((x * 7 + y * 13 + seed) * 1.7) + 1 > 1.05) r += `<rect x="${x * cell}" y="${y * cell}" width="${cell * 0.92}" height="${cell * 0.92}" fill="#0F1E3D"/>`;
    }
    [[0, 0], [m - 7, 0], [0, m - 7]].forEach(([cx, cy]) => {r += `<rect x="${cx * cell}" y="${cy * cell}" width="${cell * 7}" height="${cell * 7}" fill="none" stroke="#7F0F1A" stroke-width="${cell}"/><rect x="${(cx + 2) * cell}" y="${(cy + 2) * cell}" width="${cell * 3}" height="${cell * 3}" fill="#7F0F1A"/>`;});
    return r;
  };

  return (
    <div onClick={embedded ? undefined : onClose} style={embedded ? {} : { position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(11,20,40,0.6)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-base)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: embedded ? 680 : 560, maxHeight: embedded ? 'none' : '88vh', overflow: embedded ? 'visible' : 'auto', boxShadow: embedded ? 'none' : 'var(--shadow-lg)', border: embedded ? '1px solid var(--border)' : 0 }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)' }}>Etiquetas para el proveedor</div>
            <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{code}</code>
          </div>
          {embedded
            ? <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, color: 'var(--ink-soft)', cursor: 'pointer', font: '600 12px/1 var(--f-sans)' }}>{I.arrowL(12)} Volver</button>
            : <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', cursor: 'pointer', fontSize: 18 }}>×</button>}
        </div>
        <div style={{ padding: 22 }}>
          {phase === 'docs' &&
          <div>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Paso 1 · Adjuntá la compra</div>
              <p style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
                Antes de generar el código, sube los documentos de la compra. <b>El packing list es lo mínimo</b> — fotos y factura son recomendables para mejor trazabilidad.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
              { k: 'packing', label: 'Packing list', req: true },
              { k: 'factura', label: 'Factura proveedor', req: false }].
              map((d) =>
              <button key={d.k} onClick={() => setDocs({ ...docs, [d.k]: !docs[d.k] })} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', textAlign: 'left', border: `1px solid ${docs[d.k] ? 'var(--success)' : d.req ? 'var(--wine)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: docs[d.k] ? 'var(--success-bg)' : 'var(--bg-surface)', cursor: 'pointer' }}>
                    <span style={{ color: docs[d.k] ? 'var(--success)' : 'var(--ink-mute)' }}>{docs[d.k] ? I.check(15) : I.upload(15)}</span>
                    <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: docs[d.k] ? 'var(--success)' : 'var(--ink)' }}>{d.label}{d.req && !docs[d.k] ? ' ·  obligatorio' : ''}{docs[d.k] ? ' ✓' : ''}</span>
                  </button>
              )}
                <button onClick={() => setDocs({ ...docs, fotos: docs.fotos + 1 })} style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', textAlign: 'left', border: `1px solid ${docs.fotos ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: docs.fotos ? 'var(--success-bg)' : 'var(--bg-surface)', cursor: 'pointer' }}>
                  <span style={{ color: docs.fotos ? 'var(--success)' : 'var(--ink-mute)', marginTop: 1, flexShrink: 0 }}>{I.upload(15)}</span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: docs.fotos ? 'var(--success)' : 'var(--ink)' }}>Fotos de los artículos {docs.fotos ? `· ${docs.fotos} cargada${docs.fotos > 1 ? 's' : ''}` : '· recomendado'}</span>
                    <span style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Fotos de los productos que estás comprando · ayudan a verificar tu mercancía.</span>
                  </span>
                </button>
              </div>
              <U.Btn variant="primary" full size="lg" iconRight={I.arrowR(14)} style={{ marginTop: 16 }} disabled={!docs.packing} onClick={() => setPhase('labels')}>
                {docs.packing ? 'Continuar · indicar cajas' : 'Sube el packing list para seguir'}
              </U.Btn>
            </div>
          }

          {phase === 'labels' && <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}><U.Input label="¿Cuántas cajas?" value={boxes} onChange={(e) => setBoxes(e.target.value)} mono numeric /></div>
            <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', paddingBottom: 10 }}>= <b style={{ color: 'var(--wine)' }}>{n} etiqueta{n > 1 ? 's' : ''}</b></div>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 'var(--r-md)', font: '500 11.5px/1.5 var(--f-sans)', marginBottom: 16 }}>
            {I.info(12)} El proveedor pega una etiqueta en cada caja (frente visible). Cada una lleva el código + QR para que el almacén CN la asocie a tu cuenta.
          </div>

          {/* Preview de etiquetas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 280, overflow: 'auto', padding: 2 }}>
            {Array.from({ length: Math.min(n, 6) }, (_, i) =>
              <div key={i} style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', padding: 10, background: '#fff', textAlign: 'center' }}>
                <div style={{ font: '700 7px/1 var(--f-sans)', color: '#9B9B9B', letterSpacing: '0.14em', textTransform: 'uppercase' }}>SHIPPING TO DTD-CARGO</div>
                <svg viewBox="0 0 100 100" style={{ width: 64, height: 64, margin: '6px auto', display: 'block' }} dangerouslySetInnerHTML={{ __html: qr(i) }} />
                <code style={{ font: '800 12px/1 var(--f-mono)', color: '#0F1E3D' }}>{code}</code>
                <div style={{ font: '700 10px/1 var(--f-mono)', color: '#7F0F1A', marginTop: 3 }}>Caja {i + 1} / {n}</div>
                <div style={{ font: '500 8px/1.2 var(--f-sans)', color: '#6B6B6B', marginTop: 2 }}>{me.name}</div>
              </div>
              )}
          </div>
          {n > 6 && <div style={{ textAlign: 'center', font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 8 }}>… y {n - 6} etiquetas más (Caja 7/{n} … {n}/{n})</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
            <U.Btn variant="secondary" icon={I.copy(13)} onClick={() => navigator.clipboard?.writeText(code)}>Copiar código</U.Btn>
            <U.Btn variant="primary" icon={I.download(13)} onClick={() => window.print()}>Descargar {n} etiquetas (PDF)</U.Btn>
          </div>
          </>}
        </div>
      </div>
    </div>);

}

window.PortalApp = PortalApp;