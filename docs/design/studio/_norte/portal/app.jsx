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
  const [theme, setTheme] = pUseState('dark');
  const [collapsed, setCollapsed] = pUseState(false);
  const [calcOpen, setCalcOpen] = pUseState(false);
  // Notificaciones · badges por sección (demo persistida). Se limpian al abrir la sección.
  const [unread, setUnread] = pUseState(() => { try { return JSON.parse(localStorage.getItem('dtd-portal-unread-v2')) || { shipments: 2, support: 1 }; } catch (e) { return { shipments: 2, support: 1 }; } });
  const markRead = (v) => setUnread((u) => { if (!u || !u[v]) return u; const n = { ...u, [v]: 0 }; try { localStorage.setItem('dtd-portal-unread-v2', JSON.stringify(n)); } catch (e) {} return n; });
  const goView = (v) => { setView(v); setDetail(null); markRead(v); };
  const [profileComplete, setProfileComplete] = pUseState(false);
  const [verifying, setVerifying] = pUseState(false);
  const completeProfile = () => { if (verifying || profileComplete) return; setVerifying(true); setTimeout(() => { setVerifying(false); setProfileComplete(true); }, 1400); };

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
    <div className="portal-app">
      <PortalSidebar
        me={me} view={view}
        setView={goView} unread={unread}
        profileComplete={profileComplete}
        collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />

      <div className={`portal-main ${collapsed ? 'collapsed' : ''}`}>
        <PortalTopbar
          me={me}
          view={view} setView={goView}
          onLogout={() => setLogged(false)}
          onTour={() => setTour(true)}
          unread={unread} onOpenView={goView}
          profileComplete={profileComplete} verifying={verifying} onCompleteProfile={completeProfile}
          calcOpen={calcOpen} onCalc={() => setCalcOpen((o) => !o)}
          theme={theme} setTheme={setTheme} />

        <main className="portal-content">
        <div key={view + (detail || '')} style={{ animation: 'erp-route-in 240ms var(--ease)' }}>
          {view === 'home' && <PortalHome me={me} ships={myShipments} invs={myInvoices} setView={setView} setDetail={setDetail} />}
          {view === 'shipments' && <PortalAlertas me={me} ships={myShipments} setDetail={setDetail} detail={detail} setView={setView} defaultTab="envios" />}
          {view === 'suppliers' && <PortalAlertas me={me} ships={myShipments} setDetail={setDetail} detail={detail} setView={setView} defaultTab="compras" />}
          {view === 'nueva-compra' && <PortalNuevaCompra me={me} setView={setView} />}
          {view === 'nueva-orden' && <window.PortalNuevaOrden me={me} setView={setView} />}
          {view === 'invoices' && <PortalInvoices invs={myInvoices} ships={myShipments} />}
          {view === 'reportar-pago' && <window.PortalReportarPago me={me} invs={myInvoices} />}
          {view === 'documents' && (profileComplete ? <PortalDocuments /> : <PortalVerifyGate view="documents" verifying={verifying} onComplete={completeProfile} />)}
          {view === 'referidos' && (profileComplete ? <PortalReferidos me={me} /> : <PortalVerifyGate view="referidos" verifying={verifying} onComplete={completeProfile} />)}
          {view === 'academia' && (profileComplete ? <PortalAcademiaView /> : <PortalVerifyGate view="academia" verifying={verifying} onComplete={completeProfile} />)}
          {view === 'support' && (profileComplete ? <PortalSupport me={me} /> : <PortalVerifyGate view="support" verifying={verifying} onComplete={completeProfile} />)}
          {view === 'profile' && <PortalProfile me={me} profileComplete={profileComplete} verifying={verifying} onCompleteProfile={completeProfile} />}
          {view === 'calculadora' && <PortalCalculadora me={me} setView={setView} ships={myShipments} />}
        </div>
        </main>

        <PortalFooter />
      </div>

      {/* Calculadora flotante (básica) · se abre desde el botón “Calcular” del topbar */}
      <PortalCalcFab markbox={DEMO_MARKBOX} open={calcOpen} setOpen={setCalcOpen} />

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

      <div style={{ background: 'var(--grad-navy)', color: '#fff', borderRadius: 'var(--r-xl)', padding: 'var(--s-8)', marginBottom: 'var(--s-6)', display: 'grid', gridTemplateColumns: '1fr auto', gap: 'var(--s-6)', alignItems: 'center' }}>
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
                <span style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--wine-text)', background: 'var(--wine-tint)', padding: '4px 9px', borderRadius: 'var(--r-pill)' }}>{LEVELS[c.level] || ('Nivel ' + c.level)}{c.flagship ? ' · insignia' : ''}</span>
                {c.free && <span style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--success)' }}>Gratis</span>}
                {dip && <span title="Diploma obtenido" style={{ color: 'var(--success)', display: 'flex' }}>{I.check(15)}</span>}
              </div>
              <div>
                <div style={{ font: '800 16px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{c.title}</div>
                <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{c.tagline}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>
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
                  <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--wine-text)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>Ver curso {I.arrowR(11)}</span>
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
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{A.fmtDate(co.dateISO)} · {co.mode}</div>
                </div>
                <span style={{ font: '600 10.5px/1 var(--f-mono)', color: co.seats - co.taken <= 6 ? 'var(--warning)' : 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{co.seats - co.taken} cupos</span>
              </div>); })}
          </div>
        </U.Card>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>TUS DIPLOMAS</div>
          {A.diplomas.length === 0
            ? <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>Completa un curso para ganar tu primer diploma verificable.</div>
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
  const [sent, setSent] = pUseState(false);
  const [flipped, setFlipped] = pUseState(false);
  const I = window.Icon;
  const chk = <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--wine-soft)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 10 18 20 5" /></svg>;
  const li = (t) => <li key={t}><span className="d">{chk}</span>{t}</li>;

  return (
    <div className="pl-wrap">
      <style>{".pl-wrap{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(135% 105% at 50% -14%,#1F3055 0%,#0F1E3D 46%,#0B1428 100%);position:relative;overflow:hidden}.pl-stage{width:100%;max-width:980px;perspective:1900px}.plcard{position:relative;width:100%;min-height:560px;transform-style:preserve-3d;transition:transform .8s cubic-bezier(.72,0,.2,1)}.plcard.flip{transform:rotateY(180deg)}.plface{position:absolute;inset:0;display:grid;grid-template-columns:1.05fr .95fr;border-radius:var(--r-xl);overflow:hidden;-webkit-backface-visibility:hidden;backface-visibility:hidden;box-shadow:var(--shadow-pop);border:1px solid rgba(255,255,255,.10)}.plface-b{transform:rotateY(180deg)}.pl-form{position:relative;padding:44px 46px;display:flex;flex-direction:column;justify-content:center;background:var(--bg-surface)}.pl-side{position:relative;padding:44px;display:flex;flex-direction:column;justify-content:center;color:#fff;background:linear-gradient(150deg,#16264A 0%,#0F1E3D 52%,#0B1428 100%);overflow:hidden}.pl-side .pat{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,rgba(242,240,236,.10) 1.2px,transparent 1.6px);background-size:22px 22px}.pl-side .glow{position:absolute;right:-70px;bottom:-90px;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--wine) 42%,transparent),transparent 68%);opacity:.5;pointer-events:none}.pl-eyebrow{font:700 10px/1 var(--f-sans);letter-spacing:.18em;text-transform:uppercase;color:var(--wine-text)}.pl-form h2{font:800 27px/1.08 var(--f-display);letter-spacing:-.02em;margin:12px 0 6px;color:var(--ink)}.pl-lede{font:500 13px/1.55 var(--f-sans);color:var(--ink-soft);margin:0 0 22px;max-width:36ch}.pl-lbl{font:700 10px/1 var(--f-sans);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:6px;display:block}.pl-in{width:100%;height:46px;padding:0 14px;border:1.5px solid var(--border);border-radius:var(--r-md);background:var(--bg-surface);font:600 14px/1 var(--f-sans);color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s}.pl-in:focus{border-color:var(--wine-soft);box-shadow:0 0 0 3px color-mix(in srgb,var(--wine-soft) 30%,transparent)}.pl-side .k{position:relative;font:700 10px/1 var(--f-sans);letter-spacing:.16em;text-transform:uppercase;color:var(--wine-soft)}.pl-side h3{position:relative;font:800 29px/1.08 var(--f-display);letter-spacing:-.02em;margin:14px 0 10px}.pl-side p{position:relative;font:500 13.5px/1.6 var(--f-sans);color:rgba(255,255,255,.75);margin:0 0 22px;max-width:32ch}.pl-side ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:11px;position:relative}.pl-side li{display:flex;align-items:center;gap:10px;font:600 12.5px/1.35 var(--f-sans);color:rgba(255,255,255,.85)}.pl-side li .d{width:22px;height:22px;flex-shrink:0;border-radius:50%;background:rgba(255,255,255,.10);display:grid;place-items:center}.pl-cue{display:flex;align-items:center;gap:12px;margin:20px 0 12px}.pl-cue .ln{flex:1;height:1px;background:var(--border)}.pl-cue .tx{font:600 11.5px/1 var(--f-sans);color:var(--ink-soft);white-space:nowrap}.pl-alt{align-self:center;padding:4px 6px;border:0;background:none;color:var(--wine-text);font:800 12.5px/1 var(--f-sans);cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.pl-alt:hover{text-decoration:underline;text-underline-offset:3px}.pl-primary{width:100%;height:50px;border:0;border-radius:var(--r-md);background:var(--grad-wine);color:#fff;font:800 14px/1 var(--f-sans);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;box-shadow:var(--shadow-sm)}.pl-foot{margin-top:22px;font:500 13px/1.4 var(--f-sans);color:var(--ink-soft)}.pl-flipbtn{border:0;background:none;cursor:pointer;color:var(--wine-text);font:800 13px/1 var(--f-sans);display:inline-flex;align-items:center;gap:5px}@media(max-width:820px){.pl-stage{perspective:1400px}.plcard{max-width:440px;margin:0 auto;min-height:610px}.plface{grid-template-columns:1fr;grid-template-rows:auto 1fr}.pl-side{order:-1;padding:24px 28px;min-height:132px}.pl-side ul{display:none}.pl-side h3{font-size:21px;margin:8px 0 6px}.pl-side p{margin-bottom:0}.pl-form{padding:28px 26px}}@media(prefers-reduced-motion:reduce){.plcard{transition:none}}"}</style>
      <div className="pl-stage">
        <div className={'plcard' + (flipped ? ' flip' : '')}>
          <div className="plface" style={{ visibility: flipped ? 'hidden' : 'visible' }}>
            <div className="pl-form">
              <span className="pl-eyebrow">Acceso de cliente</span>
              <h2>Bienvenido de vuelta</h2>
              <p className="pl-lede">Entra sin contraseña: te enviamos un enlace de acceso a tu correo.</p>
              <label>
                <span className="pl-lbl">Tu correo</span>
                <input className="pl-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
              </label>
              <div style={{ marginTop: 16 }}>
                {!sent ?
                <button className="mlink" onClick={(e) => { if (!email) return; const b = e.currentTarget; if (b.classList.contains('go')) return; b.classList.add('go'); setTimeout(() => setSent(true), 2300); }}>
                  <span className="mlink-l mlink-def">Envíame el enlace</span>
                  <span className="mlink-l mlink-ok"><svg viewBox="0 0 12 10"><polyline points="1.5 6 4.5 9 10.5 1"></polyline></svg>Enlace enviado</span>
                  <span className="mlink-env" aria-hidden="true"><i></i><b></b></span>
                </button> :
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)' }}>
                    <span style={{ color: 'var(--success)', flexShrink: 0, marginTop: 1 }}>{I.check(16)}</span>
                    <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>Abre el correo que enviamos a <b style={{ color: 'var(--ink)' }}>{email}</b> y toca el enlace para entrar.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <a onClick={() => setSent(false)} style={{ color: 'var(--wine-text)', cursor: 'pointer', font: '700 12.5px/1 var(--f-sans)' }}>Reenviar enlace</a>
                    <a onClick={onLogin} style={{ color: 'var(--ink-soft)', cursor: 'pointer', font: '600 12px/1 var(--f-sans)', marginLeft: 'auto' }}>Entrar (demo) {I.arrowR(12)}</a>
                  </div>
                </div>}
              </div>
              <div className="pl-cue"><span className="ln"></span><span className="tx">¿No tienes cuenta?</span><span className="ln"></span></div>
              <button className="pl-alt" onClick={() => setFlipped(true)}>Crea tu cuenta gratis {I.arrowR(13)}</button>
            </div>
            <div className="pl-side">
              <span className="pat"></span><span className="glow"></span>
              {!sent ? <React.Fragment>
                <span className="k">De China a tu puerta</span>
                <h3>Con confianza, en cada contenedor.</h3>
                <p>Tu Shipping Mark identifica tu carga de punta a punta. Cotiza Puerta a Puerta, sigue tus envíos y paga, todo en un lugar.</p>
                <ul>{li('Seguimiento por compra y contenedor')}{li('Cotización Puerta a Puerta, todo pagado')}{li('Documentos y facturas al día')}</ul>
              </React.Fragment> : <React.Fragment>
                <span className="k">Casi listo</span>
                <h3>Tu enlace va en camino.</h3>
                <p>Revisa tu correo y toca el enlace para entrar — sin contraseña. Si no lo ves, mira en spam o reenvíalo.</p>
                <ul>{li('Sin contraseñas que recordar')}{li('El enlace vence en 15 minutos')}{li('Entras directo a tu panel')}</ul>
              </React.Fragment>}
            </div>
          </div>
          <div className="plface plface-b" style={{ visibility: flipped ? 'visible' : 'hidden' }}>
            <div className="pl-side">
              <span className="pat"></span><span className="glow"></span>
              <span className="k">Empieza con nosotros</span>
              <h3>Crea tu cuenta y obtén tu Shipping Mark.</h3>
              <p>Un solo código para toda tu carga. Te toma menos de dos minutos.</p>
              <ul>{li('Sin intermediarios')}{li('Atención en español')}{li('Bodega propia en China')}</ul>
            </div>
            <div className="pl-form">
              <span className="pl-eyebrow">Nuevo en DTD</span>
              <h2>Crea tu cuenta</h2>
              <p className="pl-lede">Regístrate en 5 pasos rápidos y recibe tu Shipping Mark para identificar toda tu carga de China a tu puerta.</p>
              <button className="pl-primary" onClick={() => { window.location.href = 'Registro Cliente.html'; }}>Comenzar registro {I.arrowR(14)}</button>
              <div className="pl-foot">¿Ya tienes cuenta? <button className="pl-flipbtn" onClick={() => setFlipped(false)}>Entra {I.arrowR(13)}</button></div>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

// ── Sidebar (metodología ERP · navy fijo) ────────────────────
const PORTAL_NAV = [
{ v: 'home', group: 'INICIO', l: 'Inicio', icon: 'dashboard' },
{ v: 'shipments', group: 'MI CARGA', l: 'Mis envíos', sub: 'Alertas', icon: 'bell' },
{ v: 'suppliers', group: 'MI CARGA', l: 'Mis compras', sub: 'Proveedores', icon: 'bag' },
{ v: 'calculadora', group: 'MI CARGA', l: 'Calculadora', sub: 'Cotiza', icon: 'calc' },
{ v: 'invoices', group: 'FINANZAS', l: 'Finanzas', icon: 'money' },
{ v: 'reportar-pago', group: 'FINANZAS', l: 'Reportar pago', icon: 'upload' },
{ v: 'documents', group: 'FINANZAS', l: 'Documentos', sub: 'Adjuntos', icon: 'doc' },
{ v: 'referidos', group: 'MÁS', l: 'Referidos', icon: 'star' },
{ v: 'academia', group: 'MÁS', l: 'Academia', icon: 'shield' },
{ v: 'support', group: 'MÁS', l: 'Soporte', icon: 'chat' }];
const LOCKED_VIEWS = ['documents', 'referidos', 'academia', 'support'];


function PortalSidebarLogo({ collapsed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="dtd-iso dtd-iso-ondark" style={{ width: 30, height: 30 }}>
        <img className="iso-primary" src="assets/dtdcargo-isologo-primary.png" alt="DTD Cargo" />
        <img className="iso-reverse" src="assets/dtdcargo-isologo-reverse.png" alt="" />
      </span>
      {!collapsed &&
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
        <span style={{ font: '900 17px/1 var(--f-display)', letterSpacing: '-0.02em', color: '#F2F0EC' }}>
          DTD<span style={{ display: 'inline-block', width: '0.15em' }}></span>Cargo
        </span>
        <span style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-nav-soft)', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4 }}>
          Portal · v4.6
        </span>
      </div>}
    </div>);

}

function PortalSidebar({ me, view, setView, collapsed, onToggleCollapse, unread, profileComplete }) {
  const I = window.Icon;
  const [logoHover, setLogoHover] = pUseState(false);
  const asideRef = React.useRef(null);
  // Ancho auto (Sam): la sidebar expandida se ajusta al texto más largo (max-content);
  // sincronizamos el margen del main con el ancho real para que nunca quede desalineado.
  React.useEffect(() => {
    const el = asideRef.current; if (!el || typeof ResizeObserver === 'undefined') return;
    const sync = () => {
      const w = el.offsetWidth;
      document.documentElement.style.setProperty('--sb-live', w + 'px');
      const main = document.querySelector('.portal-main');
      // 'important' para ganarle a cualquier override !important del editor (adopted stylesheets).
      if (main) main.style.setProperty('margin-left', w + 'px', 'important');
    };
    sync();
    const ro = new ResizeObserver(sync); ro.observe(el);
    return () => ro.disconnect();
  }, [collapsed]);
  const groups = [];
  const createRef = React.useRef(null);
  const [createOpen, setCreateOpen] = pUseState(false);
  React.useEffect(() => {
    if (!createOpen) return;
    const h = (e) => { if (createRef.current && !createRef.current.contains(e.target)) setCreateOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [createOpen]);
  // Menú “Crear” · todas las solicitudes del cliente en un solo lugar.
  const CREATE_ITEMS = [
    { v: 'nueva-compra', l: 'Nueva compra', sub: 'Pre-alerta · avisa tu carga', icon: 'bag' },
    { v: 'nueva-orden', l: 'Nueva orden LCL / FCL', sub: 'Consolidado o contenedor completo', icon: 'ship' },
    { v: 'reportar-pago', l: 'Reportar un pago', sub: 'Sube tu comprobante', icon: 'upload' },
    { v: 'calculadora', l: 'Cotizar un servicio', sub: 'Calcula tu envío', icon: 'calc' },
  ];
  PORTAL_NAV.forEach((it) => {
    let g = groups.find((x) => x.name === it.group);
    if (!g) {g = { name: it.group, items: [] };groups.push(g);}
    g.items.push(it);
  });

  const navRef = React.useRef(null);
  // Doble clic en cualquier ítem del nav = alterna colapsar/expandir (listener
  // nativo delegado — el clic simple sigue navegando). Así no hay que subir a la barra.
  React.useEffect(() => {
    const el = navRef.current; if (!el) return;
    const h = (e) => { if (e.target.closest && e.target.closest('button') && onToggleCollapse) onToggleCollapse(); };
    el.addEventListener('dblclick', h);
    return () => el.removeEventListener('dblclick', h);
  }, [onToggleCollapse]);
  const leaf = (it) => {
    const isActive = view === it.v;
    const nUnread = (unread && unread[it.v]) || 0;
    const locked = LOCKED_VIEWS.includes(it.v) && !profileComplete;
    return (
      <button key={it.v} onClick={() => setView(it.v)} title={collapsed ? (it.l + (it.sub ? ' · ' + it.sub : '') + (locked ? ' · se activa al verificar' : '')) : (locked ? 'Se activa al completar tu registro (foto de cédula o RIF)' : undefined)} style={{
        position: 'relative', width: '100%', userSelect: 'none',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: collapsed ? '10px 0' : '9px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        background: isActive ? 'var(--grad-wine)' : 'transparent',
        color: isActive ? '#fff' : 'var(--ink-nav)',
        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
        borderRadius: 'var(--r-md)', border: 0, cursor: 'pointer',
        opacity: (locked && !isActive) ? 0.72 : 1,
        font: `${isActive ? '600' : '500'} 13px/1 var(--f-sans)`,
        transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)'
      }}
      onMouseEnter={(e) => {if (!isActive) e.currentTarget.style.background = 'var(--bg-nav-hover)';}}
      onMouseLeave={(e) => {if (!isActive) e.currentTarget.style.background = 'transparent';}}>
        {isActive && !collapsed &&
        <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, background: '#fff', borderRadius: 2 }} />}
        <span style={{ color: isActive ? '#fff' : 'var(--ink-nav-soft)', flexShrink: 0, display: 'inline-flex', position: 'relative' }}>{I[it.icon](18)}
          {collapsed && nUnread > 0 && !locked && <span style={{ position: 'absolute', top: -3, right: -3, width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--bg-sidebar)' }} />}
          {collapsed && locked && <span style={{ position: 'absolute', top: -4, right: -4, width: 13, height: 13, borderRadius: '50%', background: 'var(--warning)', border: '2px solid var(--bg-sidebar)', color: 'var(--on-warning)', display: 'grid', placeItems: 'center' }}><svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg></span>}
        </span>
        {!collapsed && (it.sub
        ? <span style={{ flex: 1, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 3, lineHeight: 1 }}><span>{it.l}</span><span style={{ font: '700 8.5px/1 var(--f-mono)', letterSpacing: '0.14em', textTransform: 'uppercase', color: isActive ? 'rgba(255,255,255,0.8)' : 'var(--ink-nav-soft)' }}>{it.sub}</span></span>
        : <span style={{ flex: 1, textAlign: 'left' }}>{it.l}</span>)}
        {!collapsed && nUnread > 0 && !locked &&
        <span style={{ flexShrink: 0, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-pill)', background: 'var(--danger)', color: '#fff', font: '800 10px/18px var(--f-sans)', textAlign: 'center' }}>{nUnread}</span>}
        {!collapsed && locked &&
        <span style={{ flexShrink: 0, color: 'var(--warning)', display: 'inline-flex' }} aria-label="Bloqueado"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg></span>}
      </button>);

  };

  return (
    <aside ref={asideRef} className="dtd-nav-navy dtd-on-navy" data-surface="navy" style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: collapsed ? 'var(--sb-collapsed)' : 'max-content',
      minWidth: collapsed ? undefined : '172px', maxWidth: collapsed ? undefined : '320px',
      background: 'var(--grad-navy)', borderRight: '1px solid var(--border-nav)',
      display: 'flex', flexDirection: 'column', zIndex: 50,
      transition: 'width var(--dur) var(--ease)'
    }}>
      {/* Header · colapsado: isologo visible (hover → flecha expandir) · expandido: logo→Inicio + chevron colapsar */}
      <div style={{
        height: 'var(--topbar-h)', padding: collapsed ? '0' : '0 12px 0 16px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between', gap: 8,
        borderBottom: '1px solid var(--border-nav)', flexShrink: 0
      }}>
        {collapsed ?
        <button onClick={onToggleCollapse} title="Expandir sidebar"
          onMouseEnter={() => setLogoHover(true)} onMouseLeave={() => setLogoHover(false)} style={{
            width: 44, height: 44, display: 'grid', placeItems: 'center',
            background: logoHover ? 'var(--bg-nav-hover)' : 'transparent',
            border: 0, borderRadius: 'var(--r-md)', cursor: 'pointer',
            transition: 'background var(--dur-fast) var(--ease)'
          }}>
          {logoHover ?
          <span style={{ color: '#fff', display: 'inline-flex' }}>{I.chevR(18)}</span> :
          <span className="dtd-iso dtd-iso-ondark" style={{ width: 28, height: 28 }}>
            <img className="iso-primary" src="assets/dtdcargo-isologo-primary.png" alt="DTD Cargo" />
            <img className="iso-reverse" src="assets/dtdcargo-isologo-reverse.png" alt="" />
          </span>}
        </button> :
        <React.Fragment>
          <div onClick={() => setView('home')} title="Ir a Inicio" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <PortalSidebarLogo collapsed={false} />
          </div>
          <button onClick={onToggleCollapse} title="Colapsar sidebar" style={{
            width: 26, height: 26, flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--r-sm)', color: 'var(--ink-nav-soft)',
            background: 'var(--bg-nav-hover)', border: 0, cursor: 'pointer'
          }}>
            <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}>{I.chevR(13)}</span>
          </button>
        </React.Fragment>}
      </div>

      {/* Crear · menú de solicitudes del cliente (compra, pago, servicio) */}
      <div ref={createRef} style={{ padding: collapsed ? '12px 0 4px' : '14px 12px 4px', position: 'relative', zIndex: 60 }}>
        <button onClick={() => setCreateOpen((o) => !o)} title={collapsed ? 'Crear' : undefined} aria-expanded={createOpen} style={{
          width: collapsed ? 40 : '100%', height: collapsed ? 40 : 46, margin: collapsed ? '0 auto' : 0,
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10, padding: collapsed ? '0' : '0 14px', borderRadius: collapsed ? '50%' : 'var(--r-md)',
          background: createOpen ? 'color-mix(in srgb, var(--wine) 42%, transparent)' : 'color-mix(in srgb, var(--wine) 26%, transparent)',
          color: '#fff', border: '1px solid color-mix(in srgb, var(--warning) 40%, transparent)', cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)', transition: 'background var(--dur-fast) var(--ease)'
        }}
        onMouseEnter={(e) => { if (!createOpen) e.currentTarget.style.background = 'color-mix(in srgb, var(--wine) 34%, transparent)'; }}
        onMouseLeave={(e) => { if (!createOpen) e.currentTarget.style.background = 'color-mix(in srgb, var(--wine) 26%, transparent)'; }}>
          <span style={{ font: '800 19px/1 var(--f-sans)', marginTop: -1, flexShrink: 0 }}>+</span>
          {!collapsed && <span style={{ flex: 1, textAlign: 'left', font: '700 14px/1 var(--f-sans)' }}>Crear</span>}
          {!collapsed && <span style={{ display: 'inline-flex', transform: createOpen ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform var(--dur-fast) var(--ease)', opacity: 0.85 }}>{I.chevR(13)}</span>}
        </button>
        {createOpen &&
        <div style={{ position: 'absolute', top: collapsed ? 6 : 'calc(100% - 2px)', left: collapsed ? 'calc(100% + 8px)' : 12, right: collapsed ? 'auto' : 12, transform: 'none', minWidth: collapsed ? 236 : 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)', overflow: 'hidden', zIndex: 70, animation: 'erp-fade .14s var(--ease) both' }}>
          {CREATE_ITEMS.map((it, i) => (
            <button key={it.v} onClick={() => { setCreateOpen(false); setView(it.v); }} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '11px 13px', background: 'transparent', border: 0, borderTop: i ? '1px solid var(--border)' : 0, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--wine-tint)', color: 'var(--wine-text)' }}>{I[it.icon](16)}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{it.l}</span>
                <span style={{ display: 'block', font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{it.sub}</span>
              </span>
            </button>
          ))}
        </div>}
      </div>

      {/* Navegación */}
      <nav ref={navRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups.map((g) =>
        <div key={g.name} style={{ marginBottom: 6 }}>
          {!collapsed &&
          <div style={{ font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-nav-soft)', padding: '10px 12px 6px' }}>{g.name}</div>}
          {collapsed && <div style={{ height: 1, background: 'var(--border-nav)', margin: '8px 12px' }} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{g.items.map(leaf)}</div>
        </div>
        )}
      </nav>

      {/* Shipping Mark del cliente */}
      {!collapsed &&
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-nav)', flexShrink: 0 }}>
        <div style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-nav-soft)' }}>Shipping Mark</div>
        <code style={{ font: '700 14px/1 var(--f-mono)', color: '#fff', display: 'block', marginTop: 6, letterSpacing: '0.03em' }}>{me.markbox}</code>
      </div>}

      {/* Colapsar / expandir (abajo) */}
      <div style={{ padding: collapsed ? '10px 0' : '8px 12px 12px', borderTop: '1px solid var(--border-nav)', flexShrink: 0 }}>
        <button onClick={onToggleCollapse} title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'} style={{
          width: collapsed ? 40 : '100%', margin: collapsed ? '0 auto' : 0,
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10,
          padding: collapsed ? '8px 0' : '8px 12px',
          background: 'transparent', color: 'var(--ink-nav-soft)',
          border: 0, borderRadius: 'var(--r-md)', cursor: 'pointer',
          font: '600 12.5px/1 var(--f-sans)',
          transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)'
        }}
        onMouseEnter={(e) => {e.currentTarget.style.background = 'var(--bg-nav-hover)';}}
        onMouseLeave={(e) => {e.currentTarget.style.background = 'transparent';}}>
          <span style={{ transform: collapsed ? 'none' : 'rotate(180deg)', display: 'inline-flex', flexShrink: 0 }}>{I.chevR(14)}</span>
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>);

}

// ── Topbar (slim · título de vista + tema + usuario) ─────────
function PortalTopbar({ me, view, setView, onLogout, theme, setTheme, calcOpen, onCalc, unread, onOpenView, profileComplete, verifying, onCompleteProfile }) {
  const [userOpen, setUserOpen] = pUseState(false);
  const [notifOpen, setNotifOpen] = pUseState(false);
  const I = window.Icon;
  const NOTIF_AREAS = [{ v: 'shipments', l: 'Mis envíos', d: 'nuevas alertas de tus envíos' }, { v: 'support', l: 'Soporte', d: 'respuestas de tu asesor' }];
  const notifTotal = NOTIF_AREAS.reduce((a, x) => a + ((unread && unread[x.v]) || 0), 0);
  const LABELS = {
    home: 'Inicio', shipments: 'Mis envíos', suppliers: 'Mis compras',
    'nueva-compra': 'Nueva compra', 'nueva-orden': 'Nueva orden', invoices: 'Finanzas', 'reportar-pago': 'Reportar pago', documents: 'Documentos',
    referidos: 'Referidos', academia: 'Academia', support: 'Soporte',
    profile: 'Mi perfil', calculadora: 'Calculadora' };

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      height: 'var(--topbar-h)', background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 16, padding: '0 var(--s-6)'
    }}>
      <div style={{ font: '700 16px/1 var(--f-display)', letterSpacing: '-0.01em', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{LABELS[view] || ''}</div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {!profileComplete &&
        <button onClick={() => setView('profile')} title="Ve a tu perfil para subir tu foto de cédula y completar la verificación" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 34, padding: verifying ? '0 14px' : '0 6px 0 12px', borderRadius: 'var(--r-pill)', background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--ink)', cursor: verifying ? 'default' : 'pointer', font: '700 12px/1 var(--f-sans)', whiteSpace: 'nowrap' }}>
          {verifying
            ? <span style={{ width: 15, height: 15, borderRadius: '50%', border: '2.5px solid var(--wine-tint)', borderTopColor: 'var(--wine)', animation: 'erp-spin .7s linear infinite', flexShrink: 0 }} />
            : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }} />}
          <span>{verifying ? 'Verificando…' : 'Falta completar datos'}</span>
          {!verifying && <span style={{ font: '800 11px/1 var(--f-sans)', color: '#fff', background: 'var(--wine)', padding: '5px 9px', borderRadius: 'var(--r-pill)' }}>Completar</span>}
        </button>}
        <NextSailingWidget me={me} setView={setView} />
        <button onClick={onCalc} className="calc-btn-anim" title="Abrir la calculadora" aria-label="Calculadora" aria-pressed={calcOpen} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 38, height: 38, borderRadius: 'var(--r-pill)', cursor: 'pointer',
          color: 'var(--glass-ink)',
          background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
          WebkitBackdropFilter: 'var(--glass-blur)', backdropFilter: 'var(--glass-blur)',
          boxShadow: calcOpen ? 'var(--glass-hi), 0 0 0 2px var(--wine-tint)' : 'var(--glass-hi)'
        }}>
          <span className="calc-ico-anim" style={{ display: 'inline-flex' }}>{I.calc(19)}</span>
        </button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setNotifOpen((v) => !v)} title="Notificaciones" aria-label={'Notificaciones' + (notifTotal ? ' (' + notifTotal + ' sin leer)' : '')} style={{
            position: 'relative', width: 36, height: 36, borderRadius: 'var(--r-md)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: notifOpen ? 'var(--wine-text)' : 'var(--ink-soft)', background: notifOpen ? 'var(--wine-tint)' : 'transparent', border: 0, cursor: 'pointer'
          }}>
            {I.notif(17)}
            {notifTotal > 0 && <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--bg-surface)' }} />}
          </button>
          {notifOpen &&
          <React.Fragment>
            <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 45 }} />
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 46, width: 280, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', animation: 'erp-pop 200ms var(--ease)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ font: '800 13px/1 var(--f-display)', color: 'var(--ink)' }}>Notificaciones</span>
                {notifTotal > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 6px', borderRadius: 'var(--r-pill)', background: 'var(--danger)', color: '#fff', font: '800 10px/18px var(--f-sans)' }}>{notifTotal}</span>}
              </div>
              {notifTotal === 0
                ? <div style={{ padding: '20px 16px', textAlign: 'center', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Estás al día · sin novedades.</div>
                : <div style={{ padding: 6 }}>{NOTIF_AREAS.filter((x) => (unread && unread[x.v]) > 0).map((x) => (
                  <button key={x.v} onClick={() => { setNotifOpen(false); onOpenView && onOpenView(x.v); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '10px 10px', borderRadius: 'var(--r-md)', background: 'transparent', border: 0, cursor: 'pointer' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine-text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I[x.v === 'support' ? 'chat' : 'bell'](15)}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{x.l}</span><span style={{ minWidth: 16, height: 16, padding: '0 5px', borderRadius: 'var(--r-pill)', background: 'var(--danger)', color: '#fff', font: '800 9px/16px var(--f-sans)' }}>{unread[x.v]}</span></span>
                      <span style={{ display: 'block', font: '500 11px/1.35 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{x.d}</span>
                    </span>
                    <span style={{ color: 'var(--ink-mute)', flexShrink: 0 }}>{I.chevR ? I.chevR(14) : I.chevD(14)}</span>
                  </button>))}
                </div>}
            </div>
          </React.Fragment>}
        </div>
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Cambiar tema" style={{
          width: 36, height: 36, borderRadius: 'var(--r-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-soft)', background: 'transparent', border: 0, cursor: 'pointer'
        }}>{theme === 'dark' ? I.sun(15) : I.moon(15)}</button>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setUserOpen((v) => !v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 12px 4px 4px', borderRadius: 'var(--r-pill)',
            background: 'var(--bg-elevated)', border: 0, cursor: 'pointer', marginLeft: 6
          }}>
            <window.ERPUI.Avatar initials={me.name.split(' ').map((w) => w[0]).slice(0, 2).join('')} size={30} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{me.name}</div>
              <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--wine-text)' }}>{me.markbox}</code>
            </div>
            <span style={{ color: 'var(--ink-mute)' }}>{I.chevD(12)}</span>
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
              <button onClick={() => {setView('profile');setUserOpen(false);}} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', font: '500 13px/1 var(--f-sans)', color: 'var(--ink)', background: 'transparent', border: 0, cursor: 'pointer' }}>Mi perfil</button>
            </div>
            <div style={{ padding: 6, borderTop: '1px solid var(--border)' }}>
              <button onClick={onLogout} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', font: '600 13px/1 var(--f-sans)', color: 'var(--danger)', background: 'transparent', border: 0, cursor: 'pointer' }}>Cerrar sesión</button>
            </div>
          </div>}
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
  const svcFicha = (slug) => `Servicios · DTD-Cargo.html#svc/${slug}`;
  const services = [
    { label: 'Nueva orden LCL / FCL', sub: 'Consolidado LCL o contenedor completo', href: `Calculadora CBM · DTD-Cargo.html?mb=${markbox}`, est: true },
    { label: 'Compra asistida', sub: 'Sourcing · te ayudamos a comprar en China', href: svcFicha('compra-asistida') },
    { label: 'Pago asistido', sub: 'Asesoría en pagos a proveedores', href: svcFicha('pago-asistido') },
    { label: 'Inspección de calidad en fábrica', sub: 'PSI · antes del embarque', href: svcFicha('inspeccion-en-fabrica') },
    { label: 'Verificación de proveedores', sub: 'Online + física', href: svcFicha('verificacion-de-proveedores') },
    { label: 'Courier de muestras y documentos', sub: 'Express · no es flete aéreo', href: svcFicha('courier-de-muestras') },
    { label: 'Visado de negocios chino', sub: 'Gestión completa', href: svcFicha('visado-de-negocios') },
    { label: 'Registro de marca en China', sub: 'CNIPA', href: svcFicha('registro-de-marca') },
  ];
  return (
    <div ref={ref} style={{ position: 'relative' }} data-comment-anchor="e60bca81d1-a-329-11">
      <button onClick={() => setOpen((o) => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', cursor: 'pointer'
      }}>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
          <span style={{ font: '700 14.5px/1.1 var(--f-sans)', color: 'var(--ink)' }}>Otros servicios</span>
          <span style={{ font: '700 9px/1 var(--f-mono)', color: 'var(--wine-text)', letterSpacing: '0.14em', marginTop: 4 }}>= ESTIMADO</span>
        </span>
        <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 140ms var(--ease)' }}>▾</span>
      </button>
      {open &&
      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 282, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 40, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', font: '700 9px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Escoger otros servicios · antes o fuera de tu carga</div>
        {services.map((s, i) => (
          <a key={i} href={s.href} target="_blank" rel="noopener" onClick={() => setOpen(false)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '11px 14px', textDecoration: 'none',
            borderBottom: i < services.length - 1 ? '1px solid var(--border)' : 0
          }}>
            <span>
              <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)', display: 'block' }}>{s.label}</span>
              <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{s.sub}</span>
            </span>
            <span style={{ color: 'var(--wine-text)', flexShrink: 0 }}>{window.Icon.external(12)}</span>
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
function NextSailingWidget({ me, setView }) {
  const { N, next } = _clientSailings(me.markbox);
  const [open, setOpen] = pUseState(false);
  if (!N || !next) return null;
  const fmt = _fmtSail;
  const I = window.Icon;
  const U = window.ERPUI;

  const n = N.daysUntil(next.cutoff);
  const urgent = n <= 2;
  const barFill = urgent ? 'var(--warning)' : 'var(--wine)';        // relleno / gráfico (no-texto)
  const bigColor = urgent ? 'var(--warning)' : 'var(--wine-text)';  // texto grande (≥24px) AA
  const txtAcc = urgent ? 'var(--ink)' : 'var(--wine-text)';        // texto chico AA-safe
  const tint = urgent ? 'color-mix(in srgb, var(--warning) 14%, transparent)' : 'var(--wine-tint)';
  const pol = N.port(next.pol), pod = N.port(next.pod);

  const bigNum = n <= 0 ? 'Hoy' : String(n);
  const bigUnit = n <= 0 ? 'cierra hoy' : (n === 1 ? 'día para el cierre' : 'días para el cierre');
  const pillDays = n <= 0 ? 'Hoy' : (n === 1 ? '1 día' : n + ' días');
  const barPct = Math.max(0.08, Math.min(1, (14 - n) / 14));

  const stat = (label, value, strong) => (
    <div>
      <div style={{ font: '600 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '700 15px/1 var(--f-mono)', color: strong ? txtAcc : 'var(--ink)', marginTop: 6 }}>{value}</div>
    </div>);

  return (
    <React.Fragment>
      {/* Pill en la topbar · única señal visible por defecto */}
      <button onClick={() => setOpen(true)} title="Ver próxima salida de contenedor" style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        height: 34, padding: '0 12px', borderRadius: 'var(--r-pill)',
        background: tint, cursor: 'pointer',
        border: '1px solid ' + (urgent ? 'color-mix(in srgb, var(--warning) 42%, transparent)' : 'var(--wine-tint)')
      }}>
        <span style={{ color: barFill, display: 'inline-flex' }}>{I.ship(15)}</span>
        <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.03em' }}>Próxima salida</span>
        <span style={{ font: '800 12.5px/1 var(--f-sans)', color: txtAcc }}>{pillDays}</span>
      </button>

      {/* Panel deslizante · portal a document.body para escapar el stacking context del header (sticky z-40) */}
      {ReactDOM.createPortal(
      <U.Drawer open={open} onClose={() => setOpen(false)} title="Próxima salida" subtitle={pol.name + ' → ' + pod.name} width={420}
        actions={
        <React.Fragment>
          <U.Btn variant="ghost" onClick={() => {setOpen(false);setView('shipments');}}>Ver mis embarques</U.Btn>
          <U.Btn variant="primary" icon={I.arrowR(14)} onClick={() => {setOpen(false);setView('nueva-compra');}}>
            <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}><span>Programar mi compra</span><span style={{ font: '700 8.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.82, marginTop: 4 }}>Pre-alerta</span></span>
          </U.Btn>
        </React.Fragment>
        }>
        {/* Cuenta regresiva */}
        <div style={{ background: tint, borderRadius: 'var(--r-lg)', padding: 'var(--s-5)', display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <div style={{ font: '900 52px/0.9 var(--f-display)', color: bigColor, letterSpacing: '-0.03em' }}>{bigNum}</div>
          <div style={{ font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{bigUnit}</div>
        </div>

        {/* Barra de presión de tiempo */}
        <div style={{ marginTop: 'var(--s-4)', height: 6, borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
          <div style={{ width: (barPct * 100).toFixed(0) + '%', height: '100%', borderRadius: 'var(--r-pill)', background: barFill }} />
        </div>

        {/* Ruta */}
        <div style={{ marginTop: 'var(--s-6)', font: '800 19px/1.2 var(--f-display)', color: 'var(--ink)' }}>
          {pol.name} <span style={{ color: barFill }}>→</span> {pod.name}
        </div>

        {/* Fechas clave */}
        <div style={{ marginTop: 'var(--s-5)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--s-4)' }}>
          {stat('Cierre de carga', fmt(next.cutoff), true)}
          {stat('Zarpa', fmt(next.etd))}
          {stat('Llega aprox.', '~' + fmt(next.eta))}
        </div>

        {/* Nota */}
        <p style={{ marginTop: 'var(--s-6)', font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>
          {urgent ?
          'Tu carga debe estar en bodega CN antes del cierre para entrar en este consolidado.' :
          'Organiza tus compras para que lleguen a bodega CN antes del cierre de carga.'}
        </p>
      </U.Drawer>, document.body)}
    </React.Fragment>);
}

// ── Datos para web de compra (autofill Alibaba/1688) ─────────
// Dirección de bodega CN en campos bilingües, copia por campo +
// "Copiar todo". Fuente: FAQ dtdcargo.com/faq (formato copy-paste).
function PortalCopyField({ zh, es, value, hint, mono = true }) {
  const [done, setDone] = pUseState(false);
  const copy = () => {
    try { navigator.clipboard && navigator.clipboard.writeText(value); } catch (e) {}
    setDone(true); setTimeout(() => setDone(false), 1500);
  };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '700 9px/1.3 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>{zh ? zh + ' · ' : ''}{es}</div>
        <div style={{ font: (mono ? '600 12.5px/1.4 var(--f-mono)' : '600 12.5px/1.4 var(--f-sans)'), color: 'var(--ink)', marginTop: 5, wordBreak: 'break-word' }}>{value}</div>
        {hint && <div style={{ font: '500 10.5px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{hint}</div>}
      </div>
      <button onClick={copy} title="Copiar" style={{ flexShrink: 0, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: done ? 'var(--wine)' : 'var(--bg-surface)', color: done ? '#fff' : 'var(--ink-soft)', cursor: 'pointer', transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)' }}>
        {done ? window.Icon.check(13) : window.Icon.copy(13)}
      </button>
    </div>);
}

function PortalBuyWebData({ me }) {
  const I = window.Icon;
  const U = window.ERPUI;
  const [allDone, setAllDone] = pUseState(false);
  const [mkDone, setMkDone] = pUseState(false);
  const [expanded, setExpanded] = pUseState(false);
  const fields = [
    { zh: '国家/地区', es: 'País / Región', value: 'China' },
    { zh: '收货人', es: 'Destinatario', value: 'DTD Canopy - ' + me.markbox, hint: 'Tu Shipping Mark va al final — sin él no sabemos que la caja es tuya.' },
    { zh: '电话', es: 'Teléfono (+86)', value: '18606891419' },
    { zh: '地址', es: 'Dirección', value: '浙江省义乌市义乌港二期直通仓2栋2号 货7-货11', hint: 'Pégala en chino tal cual, sin traducir — es para el transporte dentro de China.' },
    { zh: '省', es: 'Provincia', value: '浙江省', hint: 'Zhejiang' },
    { zh: '市', es: 'Ciudad', value: '义乌市', hint: 'Yiwu — en el selector aparece bajo 金华市 (Jinhua)' },
    { zh: '邮编', es: 'Código postal', value: '322000' },
    { zh: '仓库联系人', es: 'Contacto de bodega', value: '林冠', hint: 'Lin Guan' },
    { es: 'Email', value: 'info@dtdcargo.com' }];

  const copyAll = () => {
    const txt = 'Shipping Mark (唛头): ' + me.markbox + '\n' +
      fields.map((f) => f.es + ': ' + f.value).join('\n');
    try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (e) {}
    setAllDone(true); setExpanded(true); setTimeout(() => setAllDone(false), 1600);
  };
  const copyMk = () => {
    try { navigator.clipboard && navigator.clipboard.writeText(me.markbox); } catch (e) {}
    setMkDone(true); setTimeout(() => setMkDone(false), 1500);
  };

  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>DATOS PARA WEB DE COMPRA</div>
      <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 12 }}>Pégalos en <b style={{ color: 'var(--ink)' }}>Alibaba, 1688</b> y otras webs que piden dirección de envío. Todo llega a nuestra bodega en China con tu Shipping Mark.</div>

      <div style={{ background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Shipping Mark · 唛头</div>
          <code style={{ font: '800 16px/1 var(--f-mono)', color: 'var(--wine-text)', display: 'block', marginTop: 6 }}>{me.markbox}</code>
        </div>
        <button onClick={copyMk} title="Copiar Shipping Mark" style={{ flexShrink: 0, width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: mkDone ? 'var(--wine)' : 'var(--bg-surface)', color: mkDone ? '#fff' : 'var(--ink-soft)', cursor: 'pointer' }}>{mkDone ? I.check(13) : I.copy(13)}</button>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={() => setExpanded((v) => !v)} aria-expanded={expanded} style={{ flexShrink: 0, padding: '10px 14px', background: 'var(--bg-elevated)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '700 12.5px/1 var(--f-sans)', display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer' }}>
          {expanded ? 'Ocultar' : 'Desplegar'}
          <span style={{ display: 'inline-flex', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-fast) var(--ease)' }}>{I.chevD(12)}</span>
        </button>
        <button onClick={copyAll} style={{ flex: 1, padding: '10px', background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', font: '700 12.5px/1 var(--f-sans)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' }}>
          {allDone ? I.check(14) : I.copy(13)} {allDone ? 'Copiado' : 'Copiar todo'}
        </button>
      </div>

      {expanded &&
      <div style={{ marginTop: 4 }}>
        {fields.map((f, i) => <PortalCopyField key={i} zh={f.zh} es={f.es} value={f.value} hint={f.hint} />)}
      </div>}
    </U.Card>);
}

// ── KPI compacto del portal · sombra + degradado en esquinas (patrón --grad-page) ──
function PortalKPI({ label, value, delta, sub, tone = 'wine', icon }) {
  const tones = { wine: 'var(--wine-text)', success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', info: 'var(--info)', neutral: 'var(--ink-soft)' };
  return (
    <div style={{
      background: 'radial-gradient(90% 80% at 100% 0%, rgba(158,21,34,0.06), transparent 55%), radial-gradient(85% 80% at 0% 100%, rgba(15,30,61,0.05), transparent 55%), var(--grad-card)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--shadow-md)', padding: '13px 15px'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <span style={{ font: '700 9.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
        {icon && <span style={{ color: tones[tone], opacity: 0.75, flexShrink: 0 }}>{icon}</span>}
      </div>
      <div style={{ font: '900 24px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>{value}</div>
      {delta &&
      <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: tones[tone], flexShrink: 0 }} />
        {delta}
      </div>}
      {sub && <div style={{ marginTop: 7, font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{sub}</div>}
    </div>);
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
      <div style={{ marginBottom: 'var(--s-8)' }}>
        <div>
          <div className="eyebrow eyebrow-wine">{new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 style={{ font: '900 38px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em', margin: '8px 0 6px' }}>Hola {me.name.split(' ')[0]}.</h1>
          <p style={{ font: '500 15px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}>
            {active.length} envíos activos · {invs.filter((i) => i.balance > 0).length} {invs.filter((i) => i.balance > 0).length === 1 ? 'factura pendiente' : 'facturas pendientes'}
          </p>
        </div>
      </div>

      {/* Hero card: next arrival */}
      {inTransit &&
      <U.Card style={{ marginBottom: 'var(--s-6)', padding: 0, overflow: 'hidden', background: 'var(--grad-navy)', color: '#fff', border: 0, cursor: 'pointer' }}
      onClick={() => {setView('shipments');setDetail(inTransit.id);}}>
        
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                <span style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.16em', textTransform: 'uppercase', flexShrink: 0 }}>Tu próxima mercancía</span>
                <code style={{ font: '800 17px/1 var(--f-mono)', color: '#fff', letterSpacing: '-0.01em' }}>{inTransit.id}</code>
                <span style={{ font: '600 10px/1 var(--f-mono)', color: 'rgba(255,255,255,0.55)' }}>{inTransit.type}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ font: '500 9px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Llega</span>
                <span style={{ font: '800 15px/1 var(--f-display)', color: '#fff' }}>{inTransit.eta}</span>
              </div>
            </div>

            {/* Progreso del viaje · barra slim (origen → barco → destino) */}
            <div style={{ position: 'relative', height: 22, marginTop: 14 }}>
              <div style={{ position: 'absolute', left: 3, right: 3, top: '50%', transform: 'translateY(-50%)', height: 5, borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.14)' }} />
              <div style={{ position: 'absolute', left: 3, top: '50%', transform: 'translateY(-50%)', width: `calc(${inTransit.progress}% - 6px)`, height: 5, borderRadius: 'var(--r-pill)', background: 'linear-gradient(90deg, var(--wine), var(--wine-soft))' }} />
              <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,0.14)' }} />
              <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 10, height: 10, borderRadius: '50%', background: 'var(--wine)', border: '2px solid #fff' }} />
              <div style={{ position: 'absolute', left: inTransit.progress + '%', top: '50%', transform: 'translate(-50%,-50%)', width: 22, height: 22, borderRadius: '50%', background: 'var(--wine)', border: '2px solid #fff', display: 'grid', placeItems: 'center', color: '#fff', boxShadow: 'var(--shadow-md)' }}>
                {window.Icon.ship(11)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 9 }}>
              <span style={{ font: '600 10.5px/1.2 var(--f-sans)', color: 'rgba(255,255,255,0.6)' }}>Zarpó de China</span>
              <span style={{ font: '700 10.5px/1.2 var(--f-sans)', color: 'var(--wine-soft)' }}><b style={{ font: '800 12px/1 var(--f-display)' }}>{inTransit.progress}%</b> · faltan {100 - inTransit.progress}%</span>
            </div>
          </div>
        </U.Card>
      }

      {/* KPIs row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 'var(--s-6)' }}>
        <PortalKPI label="Envíos activos" value={active.length} delta="en curso" tone="wine" icon={window.Icon.box(16)} />
        <PortalKPI label="Entregados 2026" value={ships.filter((s) => s.status === 'entregado').length} delta="100% on-time" tone="success" icon={window.Icon.check(16)} />
        <PortalKPI label="Facturado" value={`$${(invs.reduce((s, i) => s + i.amount, 0) / 1000).toFixed(0)}K`} sub="2026 acumulado" tone="info" icon={window.Icon.invoice(16)} />
        <PortalKPI label="Saldo pendiente" value={`$${(outstanding / 1000).toFixed(1)}K`} delta={outstanding > 0 ? 'pagar' : 'al día'} tone={outstanding > 0 ? 'warning' : 'success'} icon={window.Icon.clock(16)} />
      </div>

      {/* Two col */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Active shipments */}
        <U.Card padded={false}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)' }}>Tus envíos</div>
              <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{active.length} en curso · ordenados por ETA</div>
            </div>
            <button onClick={() => setView('shipments')} style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--wine-text)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
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
                <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{s.type} · {s.cbm} CBM</div>
              </div>
              <window.ERPUI.StatusBadge status={s.status} size="sm" />
              <div style={{ textAlign: 'right' }}>
                <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Llegada est.</div>
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
              <div style={{ font: '900 28px/1 var(--f-display)', color: 'var(--wine-text)', letterSpacing: '-0.02em', marginTop: 6 }}>${outstanding.toLocaleString()}</div>
              <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{invs.filter((i) => i.balance > 0).length} {invs.filter((i) => i.balance > 0).length === 1 ? 'factura por pagar' : 'facturas por pagar'}</div>
              <button onClick={() => setView('invoices')} style={{ marginTop: 14, padding: '10px 14px', background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-md)', font: '700 12.5px/1 var(--f-sans)', width: '100%' }}>Ver facturas →</button>
            </U.Card>
          }

          <PortalBuyWebData me={me} />

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
              <a href="mailto:martina@dtdcargo.com" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', font: '600 12px/1 var(--f-mono)', color: 'var(--ink)', textDecoration: 'none' }}>
                {window.Icon.mail(13)} martina@dtdcargo.com
              </a>
              <a href="tel:+584121668021" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', font: '600 12px/1 var(--f-mono)', color: 'var(--ink)', textDecoration: 'none' }}>
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
              { t: 'DTDU-472816 cruzó Canal de Panamá', m: 'hace 3 min', c: 'var(--wine-text)' },
              { t: 'Pago acreditado · F-2026-0357', m: 'hace 4 h', c: 'var(--success)' },
              { t: 'DTDU-441088 entregado · POD adjunto', m: 'ayer 16:42', c: 'var(--info)' }].
              map((a, i) =>
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0, background: a.c }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '600 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{a.t}</div>
                    <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{a.m}</div>
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
  prealerta: { label: 'Pre-alerta', icon: 'plus', color: 'var(--wine-text)', bg: 'var(--wine-tint)' },
  alerta: { label: 'Alerta', icon: 'box', color: 'var(--warning)', bg: 'var(--warning-bg)' },
  envio: { label: 'Envío', icon: 'ship', color: 'var(--info)', bg: 'var(--info-bg)' },
  bodegave: { label: 'En casa', icon: 'warehouse', color: 'var(--ink)', bg: 'var(--bg-elevated)' },
  recibido: { label: 'Recibiste', icon: 'check', color: 'var(--success)', bg: 'var(--success-bg)' },
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
          {entries.length === 0 && <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', padding: 'var(--s-8)', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>Aún no tienes envíos en camino.</div>}
          {entries.map((ent) => {
            const k = ent[0], arr = ent[1];
            const consol = arr.length > 1;
            const rep = arr.reduce((a, b) => (FLOW.indexOf(b.status) < FLOW.indexOf(a.status) ? b : a), arr[0]);
            const p = pct(rep.status);
            const cbmTot = arr.reduce((a, s) => a + (s.cbm || 0), 0);
            return (
              <U.Card key={k} padded>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine-text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.ship(18)}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <code style={{ font: '800 13.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{consol ? k : arr[0].id}</code>
                      {consol && <span style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--wine-text)', background: 'var(--wine-tint)', padding: '3px 7px', borderRadius: 'var(--r-pill)' }}>Consolidado · {arr.length} compras</span>}
                    </div>
                    <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{cbmTot.toFixed(1)} CBM · {rep.status}{rep.eta ? ' · ETA ' + rep.eta : ''}</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, height: 6, borderRadius: 999, background: 'var(--bg-elevated)', overflow: 'hidden' }}><div style={{ width: p + '%', height: '100%', background: 'var(--wine)' }} /></div>
                {consol ?
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {arr.map((s) => (
                    <button key={s.id} onClick={() => setDetail(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-base)', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ color: 'var(--wine-text)', display: 'flex', flexShrink: 0 }}>{I.box(13)}</span>
                      <code style={{ flex: 1, font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
                      <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{s.cbm} CBM</span>
                      <span style={{ color: 'var(--ink-mute)', display: 'flex' }}>{I.arrowR(12)}</span>
                    </button>
                  ))}
                </div>
                :
                <button onClick={() => setDetail(arr[0].id)} style={{ marginTop: 10, font: '700 12px/1 var(--f-sans)', color: 'var(--wine-text)', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 0, cursor: 'pointer' }}>Ver seguimiento {I.arrowR(11)}</button>}
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
  // Estatus "en casa" = ya en VE, en nuestra bodega (habilita cobro por bodegaje si no la retira a tiempo).
  const _VE_BODEGA = ['liberado', 'en bodega VE', 'bodega VE'];
  const envios = ships.map((s) => ({ id: s.id, stage: s.status === 'entregado' ? 'recibido' : (_VE_BODEGA.indexOf(s.status) >= 0 ? 'bodegave' : 'envio'), proveedor: s.supplier || s.origin || 'Proveedor', meta: (s.boxes ? s.boxes + ' cajas · ' : '') + (s.cbm ? s.cbm + ' CBM · ' : '') + (s.status || 'en proceso'), ship: s, docs: { packing: true, factura: true, fotos: 2 } }));
  const all = [...pedidos, ...envios];
  const counts = { todas: all.length, prealerta: pedidos.filter((p) => p.stage === 'prealerta').length, alerta: pedidos.filter((p) => p.stage === 'alerta').length, envio: envios.filter((e) => e.stage === 'envio').length, bodegave: envios.filter((e) => e.stage === 'bodegave').length, recibido: envios.filter((e) => e.stage === 'recibido').length };
  const list = stage === 'todas' ? all : all.filter((x) => x.stage === stage);
  // Los filtros ahora son la barra de proceso de arriba (Todas + etapas).

  return (
    <div>
      <div className="eyebrow eyebrow-wine">ALERTAS · MIS ENVÍOS</div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', margin: '8px 0 6px' }}>
        <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Mis envíos</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <ServiceRequestButton markbox={me.markbox || DEMO_MARKBOX} />
          <U.Btn variant="secondary" icon={I.radar(14)} onClick={() => setTrack(true)}>Seguimiento total</U.Btn>
          <U.Btn variant="primary" icon={I.plus(14)} onClick={() => setView('nueva-compra')}><span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}><span>Nueva compra</span><span style={{ font: '700 8.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.82, marginTop: 4 }}>Pre-alerta</span></span></U.Btn>
        </div>
      </div>

      <SailingDeadlineNote me={me} />

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap', background: 'var(--bg-elevated)', borderRadius: 'var(--r-lg)', padding: 12, margin: '0 0 var(--s-6)' }}>
        <button onClick={() => setStage('todas')} aria-pressed={stage === 'todas'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px', minHeight: 52, borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1px solid ' + (stage === 'todas' ? 'var(--wine)' : 'transparent'), background: stage === 'todas' ? 'var(--bg-surface)' : 'transparent', boxShadow: stage === 'todas' ? 'var(--shadow-xs)' : 'none' }}>
          <span style={{ font: (stage === 'todas' ? '700' : '600') + ' 14.5px/1 var(--f-sans)', color: stage === 'todas' ? 'var(--wine-text)' : 'var(--ink)' }}>Todas</span>
          <span style={{ font: '700 11px/1 var(--f-mono)', color: stage === 'todas' ? 'var(--wine-text)' : 'var(--ink-mute)' }}>{counts.todas}</span>
        </button>
        <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)', margin: '4px 2px' }} />
        {[['prealerta', 'La creas tú'], ['alerta', 'Confirmada'], ['envio', 'En camino a ti'], ['bodegave', 'En nuestra bodega'], ['recibido', 'Ya en tu puerta']].map(([k, desc], i, arr) => {
          const on = stage === k; const S = _ALERT_STAGE[k];
          return (
            <React.Fragment key={k}>
              <button onClick={() => setStage(k)} aria-pressed={on} title={'Ver ' + S.label.toLowerCase()} style={{ flex: '1 1 auto', display: 'inline-flex', alignItems: 'center', gap: 10, padding: '0 14px', minHeight: 52, borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left', border: '1px solid ' + (on ? 'var(--wine)' : 'transparent'), background: on ? 'var(--bg-surface)' : 'transparent', boxShadow: on ? 'var(--shadow-xs)' : 'none', transition: 'background var(--dur-fast) var(--ease)' }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: S.bg, color: S.color, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I[S.icon](15)}</span>
                <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.1, minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ font: '700 14.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{S.label}</span>
                    <span style={{ font: '700 10.5px/1 var(--f-mono)', color: on ? 'var(--wine-text)' : 'var(--ink-mute)' }}>{counts[k]}</span>
                  </span>
                  <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 5 }}>{desc}</span>
                </span>
              </button>
              {i < arr.length - 1 && <span style={{ color: 'var(--ink-mute)', alignSelf: 'center', flexShrink: 0 }}>{I.arrowR(16)}</span>}
            </React.Fragment>);
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.length === 0 && <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', padding: 'var(--s-8)', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>No hay ítems en esta etapa.</div>}
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
                    <span style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink)', background: st.bg, padding: '3px 7px', borderRadius: 'var(--r-pill)' }}>{st.label}</span>
                  </div>
                  <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)', marginTop: 5 }}>{it.proveedor}</div>
                  <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{it.meta}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  <button onClick={() => setOpenDocs(open ? null : it.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: open ? 'var(--bg-elevated)' : 'var(--bg-surface)', color: 'var(--ink)', font: '600 12px/1 var(--f-sans)', cursor: 'pointer' }}>
                    {I.doc(13)} Documentos <span style={{ font: '700 10px/1 var(--f-mono)', color: docCount ? 'var(--success)' : 'var(--ink-mute)' }}>{docCount}/3</span>
                  </button>
                  {it.ship && <button onClick={() => setDetail(it.id)} style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--wine-text)', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 2px', cursor: 'pointer' }}>Ver seguimiento {I.arrowR(11)}</button>}
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
                  <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '10px 0 0' }}>Los documentos quedan atados a este ítem durante todo el ciclo — de pre-alerta a envío.</p>
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
                <span style={{ color: 'var(--wine-text)' }}>→</span>
                <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{D.dest(s.destination).name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <U.Badge tone="neutral" size="sm">{s.type}</U.Badge>
                <span style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{s.cbm} CBM</span>
                {s.alert && <U.Badge tone="warning" size="sm" dot>alerta</U.Badge>}
              </div>
              <U.Progress value={s.progress} tone={s.alert ? 'warning' : 'wine'} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>
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
            <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>{I.lock(13)} Paso obligatorio</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <U.Btn variant="ghost" onClick={close}>Cancelar</U.Btn>
              <U.Btn variant="primary" disabled={!checked} onClick={confirm} icon={I.check(14)}>Confirmar y generar orden</U.Btn>
            </div>
          </div>
      }>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', marginBottom: 18 }}>
          <div style={{ width: 42, height: 42, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.doc(20)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <code style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{quote.id}</code>
            <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{quote.route} · {quote.cbm} m³ · {quote.type}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{quote.total}</div>
            <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' }}>DDP total</div>
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <button onClick={() => setChecked(!checked)} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, textAlign: 'left', background: checked ? 'var(--wine-tint)' : 'var(--bg-surface)', border: 0, transition: 'background .15s ease' }}>
            <span style={{ width: 22, height: 22, flexShrink: 0, marginTop: 1, borderRadius: 'var(--r-xs)', border: `2px solid ${checked ? 'var(--wine)' : 'var(--border-strong)'}`, background: checked ? 'var(--wine)' : 'var(--bg-surface)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{checked && I.check(13)}</span>
            <div style={{ font: '600 13px/1.55 var(--f-sans)', color: 'var(--ink)' }}>
              He leído y acepto los{' '}
              {docs[0] && <a onClick={(e) => {e.stopPropagation();setViewing(docs[0]);}} style={{ color: 'var(--wine-text)', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer' }}>Términos y Condiciones de DTD</a>}
              {' '}y las{' '}
              {docs[1] && <a onClick={(e) => {e.stopPropagation();setViewing(docs[1]);}} style={{ color: 'var(--wine-text)', textDecoration: 'underline', fontWeight: 700, cursor: 'pointer' }}>Condiciones del Operador de Consolidación</a>}.
            </div>
          </button>
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px', display: 'flex', flexWrap: 'wrap', gap: 8, background: 'var(--bg-elevated)' }}>
            {docs.map((d) =>
            <button key={d.key} onClick={() => setViewing(d)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 9px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'var(--wine-text)', display: 'flex' }}>{I.doc(11)}</span>{d.version} · vig. {pFmtLegalDate(d.effective)}
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
          Generamos la orden <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--wine-text)' }}>{evidence.orden}</code> ligada a las versiones aceptadas.
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

// Flujo de seguimiento para COMPRA DIRECTA / PREORDEN (sin estimado ni confirmado;
// tampoco aduana ni liberado): prealerta → recibido CN → zarpó → llegada → entregada.
const PREORDEN_FLOW = ['Prealerta activa', 'Recibido en China', 'Zarpó', 'Llegada', 'Entregada'];
const _preordenStep = (st) => ({
  'prealerta': 0, 'confirmado': 0, 'estimado': 0,
  'recibido CN': 1, 'consolidado': 1,
  'zarpado': 2, 'tránsito': 2,
  'aduana VE': 3, 'liberado': 3, 'llegada': 3,
  'entregado': 4
})[st] ?? 0;

// ── Detalle de un envío ─────────────────────────────────────
function PortalShipmentDetail({ id, onBack }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const s = (() => {try {const q = window.DTDData && window.DTDData.clientEstimados ? window.DTDData.clientEstimados(DEMO_MARKBOX).find((x) => x.id === id) : null;return q || D.SHIPMENTS.find((x) => x.id === id);} catch (e) {return D.SHIPMENTS.find((x) => x.id === id);}})();
  const [accepting, setAccepting] = pUseState(false);
  const [evidence, setEvidence] = pUseState(null);
  const [acuse, setAcuse] = pUseState(false);
  if (!s) return null;
  const isDirecta = !!s.directa;
  const flow = isDirecta ? PREORDEN_FLOW : D.STATUS_FLOW;
  const cur = isDirecta ? _preordenStep(s.status) : flow.indexOf(s.status);
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
            <span style={{ color: 'var(--wine-text)' }}>→</span>
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
            <span style={{ color: 'var(--wine-text)', flexShrink: 0, marginTop: 1 }}>{window.Icon.shield(18)}</span>
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
                    <div style={{ font: '600 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Aceptado (estimado)</div>
                    <div style={{ font: '600 13px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 5, textDecoration: 'line-through' }}>{priorDiff.cbm} m³ · {fmtUsd(priorDiff.total)}</div>
                  </div>
                  <span style={{ color: 'var(--wine-text)', alignSelf: 'flex-end', paddingBottom: 2 }}>{window.Icon.arrowR(14)}</span>
                  <div>
                    <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine-text)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Medida real</div>
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
                  textTransform: isDirecta ? 'none' : 'capitalize'
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
                <span style={{ color: 'var(--wine-text)' }}>{window.Icon.doc(15)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 12.5px/1.2 var(--f-sans)' }}>{d.type}</div>
                  <code style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-soft)' }}>{d.id} · {d.size}</code>
                </div>
                <button style={{ color: 'var(--wine-text)', padding: 4 }} title="Descargar">{window.Icon.download(13)}</button>
              </div>
            )}
            {D.DOCUMENTS.filter((d) => d.shipment === s.id).length === 0 &&
            <div style={{ padding: '20px 10px', textAlign: 'center', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
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

// ── Estado de cuenta · libro de movimientos (cargos/abonos + saldo) ──
// Deriva un ledger a partir de las facturas del cliente: cada factura es un
// cargo (+) en su fecha de emisión y su parte pagada es un abono (−). El saldo
// corrido cuadra con el saldo real de las facturas (fuente: ERP).
function StatementLedger({ invs, usd }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const parseD = (s) => { const t = Date.parse(s); return isNaN(t) ? 0 : t; };
  const moves = [];
  invs.forEach((iv) => {
    moves.push({ d: iv.issued, sort: parseD(iv.issued), kind: 'cargo', concept: 'Factura ' + iv.id, ref: iv.shipment, amount: iv.amount });
    if ((iv.paid || 0) > 0) moves.push({ d: iv.due, sort: parseD(iv.due) + 1, kind: 'abono', concept: 'Abono · ' + iv.id, ref: iv.shipment, amount: iv.paid });
  });
  moves.sort((a, b) => a.sort - b.sort);
  let run = 0;
  const rows = moves.map((m) => { run += m.kind === 'cargo' ? m.amount : -m.amount; return { ...m, saldo: run }; });
  const totalCargo = invs.reduce((s, i) => s + i.amount, 0);
  const totalAbono = invs.reduce((s, i) => s + (i.paid || 0), 0);

  if (rows.length === 0) return <div style={{ padding: 'var(--s-8)', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>Sin movimientos todavía.</div>;
  const cols = '96px 1fr 120px 116px 116px 124px';
  const cell = { font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink)' };
  return (
    <U.Card padded={false}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '12px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', gap: 12 }}>
        {['Fecha', 'Concepto', 'Referencia', 'Cargo', 'Abono', 'Saldo'].map((h, i) =>
        <span key={h} style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.09em', textTransform: 'uppercase', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</span>)}
      </div>
      {rows.map((r, i) =>
      <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, padding: '12px 18px', gap: 12, alignItems: 'center', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
        <span style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.d}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ width: 22, height: 22, borderRadius: 'var(--r-sm)', flexShrink: 0, display: 'grid', placeItems: 'center', background: r.kind === 'cargo' ? 'var(--wine-tint)' : 'var(--success-bg)', color: r.kind === 'cargo' ? 'var(--wine-text)' : 'var(--success)' }}>{r.kind === 'cargo' ? I.invoice(12) : I.check(12)}</span>
          <span style={{ ...cell, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.concept}</span>
        </span>
        <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.ref}</code>
        <span style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>{r.kind === 'cargo' ? usd(r.amount) : '—'}</span>
        <span style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--success)', textAlign: 'right' }}>{r.kind === 'abono' ? '−' + usd(r.amount) : '—'}</span>
        <span style={{ font: '800 12.5px/1 var(--f-mono)', color: r.saldo > 0 ? 'var(--ink)' : 'var(--success)', textAlign: 'right' }}>{usd(r.saldo)}</span>
      </div>)}
      <div style={{ display: 'grid', gridTemplateColumns: cols, padding: '14px 18px', gap: 12, alignItems: 'center', borderTop: '2px solid var(--border-strong)', background: 'var(--bg-elevated)' }}>
        <span style={{ gridColumn: '1 / 4', font: '800 11px/1 var(--f-sans)', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Totales</span>
        <span style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>{usd(totalCargo)}</span>
        <span style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--success)', textAlign: 'right' }}>−{usd(totalAbono)}</span>
        <span style={{ font: '900 13px/1 var(--f-mono)', color: (totalCargo - totalAbono) > 0 ? 'var(--wine-text)' : 'var(--success)', textAlign: 'right' }}>{usd(totalCargo - totalAbono)}</span>
      </div>
    </U.Card>);
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
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>Tus facturas, pagos y saldo — tu estado de cuenta.</p>

      <React.Fragment>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 'var(--s-6)' }}>
            {[['TOTAL FACTURADO', totalFact, 'var(--ink)'], ['PAGADO', paid, 'var(--ink)'], ['SALDO PENDIENTE', saldo, saldo > 0 ? 'var(--warning)' : 'var(--success)']].map((kp) => (
              <div key={kp[0]} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '20px 22px', boxShadow: 'var(--shadow-xs)' }}>
                <div style={{ font: '700 11px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>{kp[0]}</div>
                <div style={{ font: '800 30px/1 var(--f-display)', color: kp[2], letterSpacing: '-0.02em', marginTop: 12 }}>{usd(kp[1])}</div>
              </div>
            ))}
          </div>

          {invs.length === 0
            ? <div style={{ padding: 'var(--s-8)', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>Sin facturas todavía.</div>
            : !showTable
              ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {invs.map((iv) => { const p = stPill[iv.status] || stPill.emitida; const att = ((D && D.DOCUMENTS) || []).filter((d) => d.shipment === iv.shipment).length; return (
                    <div key={iv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
                      <div style={{ minWidth: 0 }}>
                        <code style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '0.02em' }}>{iv.id}</code>
                        <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>Envío <code style={{ fontFamily: 'var(--f-mono)' }}>{iv.shipment}</code> · {iv.status === 'pagada' ? 'pagada' : 'vence ' + iv.due}{att > 0 && <span title={att + ' adjunto' + (att > 1 ? 's' : '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 8, verticalAlign: 'middle', padding: '2px 7px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine-text)', font: '700 10.5px/1 var(--f-mono)' }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}><path d="M21 8.5l-9.2 9.2a4 4 0 0 1-5.6-5.6l9.2-9.2a2.5 2.5 0 0 1 3.5 3.5l-9.2 9.2a1 1 0 0 1-1.4-1.4l8.5-8.5" /></svg>{att}</span>}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 7 }}>
                        <span style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--ink)' }}>{usd(iv.amount)}</span>
                        <span style={{ font: '700 10px/1 var(--f-sans)', color: p.c, background: p.bg, padding: '5px 10px', borderRadius: 'var(--r-pill)' }}>{p.l}</span>
                      </div>
                    </div>); })}
                </div>
              : <StatementLedger invs={invs} usd={usd} />}

          {invs.length > 0 &&
          <button onClick={() => setShowTable((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'var(--s-5)', font: '700 13px/1 var(--f-sans)', color: 'var(--wine-text)', background: 'none', border: 0, cursor: 'pointer' }}>
            {showTable ? 'Ver como tarjetas' : 'Ver estado de cuenta'} {I.arrowR(13)}
          </button>}
      </React.Fragment>
    </div>);

}

// ── Documentos ──────────────────────────────────────────────
// ── Gate de verificación · módulos que se activan al completar el registro ──
function PortalVerifyGate({ view, onComplete, verifying }) {
  const MAP = {
    documents: { t: 'Documentos', d: 'Aquí ves y descargas los documentos de tus embarques (BL, packing list, facturas, POD) y los que ya adjuntaste.' },
    referidos: { t: 'Referidos', d: 'Gana recompensas invitando a otros importadores con tu código.' },
    academia: { t: 'Academia', d: 'Cursos para aprender a importar de China con la operación real de DTD detrás.' },
    support: { t: 'Soporte', d: 'Abre casos y chatea directo con tu asesor DTD.' }
  };
  const m = MAP[view] || { t: 'Este módulo', d: '' };
  const lockSvg = <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></svg>;
  const chip = (ok, label) => <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '700 11.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}><span style={{ width: 18, height: 18, borderRadius: '50%', background: ok ? 'var(--success)' : 'var(--warning-bg)', border: ok ? 0 : '1px solid var(--warning)', color: ok ? '#fff' : 'var(--warning)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{ok ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 10 18 20 5" /></svg> : <span style={{ font: '800 9px/1 var(--f-sans)' }}>3</span>}</span>{label}</div>;
  return (
    <div style={{ maxWidth: 620, margin: '0 auto', textAlign: 'center', padding: '36px 0' }}>
      <div style={{ width: 76, height: 76, margin: '0 auto', borderRadius: '50%', background: 'var(--warning-bg)', border: '1px solid var(--warning)', display: 'grid', placeItems: 'center', color: 'var(--warning)' }}>{lockSvg}</div>
      <h1 style={{ font: '900 26px/1.15 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '20px 0 8px' }}>{m.t} se activa al verificar tu identidad</h1>
      <p style={{ font: '500 14px/1.6 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 auto', maxWidth: '48ch' }}>{m.d} Para protegerte, este acceso se desbloquea cuando subes tu <b style={{ color: 'var(--ink)' }}>foto de cédula</b> (o RIF si eres empresa).</p>
      <div style={{ margin: '22px auto 0', maxWidth: 440, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {chip(true, 'Datos básicos')}
        {chip(true, 'Dirección')}
        {chip(false, 'Verificación')}
      </div>
      <button onClick={onComplete} disabled={verifying} style={{ marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 10, height: 50, padding: '0 26px', borderRadius: 'var(--r-md)', background: 'var(--grad-wine)', color: '#fff', border: 0, cursor: verifying ? 'default' : 'pointer', font: '800 15px/1 var(--f-sans)', boxShadow: 'var(--shadow-sm)' }}>
        {verifying
          ? <React.Fragment><span style={{ width: 17, height: 17, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'erp-spin .7s linear infinite' }} />Verificando tu identidad…</React.Fragment>
          : 'Completar verificación'}
      </button>
      <div style={{ marginTop: 14, font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>También se activan: Documentos, Referidos, Academia y Soporte.</div>
    </div>);
}

// Filtrable por tipo (BL · Packing · Factura · POD) y por proveedor —
// pensado para cuando el archivo del cliente empiece a llenarse.
function PortalDocuments() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const DB = window.DTDData;
  const money = (n, c) => (DB && DB.fmtMoney ? DB.fmtMoney(n, c) : 'USD ' + (n || 0));
  const baseDocs = D.DOCUMENTS.filter((d) => d.client === DEMO_MARKBOX);
  // Los comprobantes de pago reportados quedan archivados aquí también.
  const [, forceDocs] = pUseState(0);
  React.useEffect(() => {
    if (!(DB && DB.paymentProofs)) return;
    return DB.paymentProofs.subscribe(() => forceDocs((x) => x + 1));
  }, []);
  const proofDocs = (DB && DB.paymentProofsFor ? DB.paymentProofsFor(DEMO_MARKBOX) : []).map((p) => ({
    id: p.id, type: 'Comprobante de pago', client: DEMO_MARKBOX, supplier: null,
    shipment: (p.invoices || []).map((x) => x.id).join(', ') || 'Anticipo / otro',
    issued: p.paidAt || (p.createdAt || '').slice(0, 10),
    size: p.file ? Math.max(1, Math.round((p.file.size || 0) / 1024)) + ' KB' : '—',
    _proof: p,
  }));
  const allDocs = [...baseDocs, ...proofDocs];

  const [tipo, setTipo] = pUseState('todos');
  const [prov, setProv] = pUseState('todos');
  const [q, setQ] = pUseState('');

  const TYPES = [
    { k: 'todos', l: 'Todos' },
    { k: 'BL', l: 'BL' },
    { k: 'Factura comercial', l: 'Facturación' },
    { k: 'Packing List', l: 'Packing List' },
    { k: 'POD', l: 'Entrega (POD)' },
    { k: 'Comprobante de pago', l: 'Comprobantes de pago' },
  ];
  const suppliers = Array.from(new Set(allDocs.map((d) => d.supplier).filter(Boolean)));
  const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const nq = norm(q);
  const docs = allDocs.filter((d) =>
    (tipo === 'todos' || d.type === tipo) &&
    (prov === 'todos' || d.supplier === prov) &&
    (!nq || norm(d.id + ' ' + d.type + ' ' + d.shipment + ' ' + (d.supplier || '')).indexOf(nq) >= 0));
  const countFor = (k) => k === 'todos' ? allDocs.length : allDocs.filter((d) => d.type === k).length;

  const inputBox = { height: 40, padding: '0 13px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '600 13px/1 var(--f-sans)', boxSizing: 'border-box' };

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Documentos</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-5)' }}>BL · Packing List · Facturas comerciales · POD · comprobantes de pago. Disponibles 7 años en archivo.</p>

      {allDocs.length === 0 ?
      <U.EmptyState icon={window.Icon.doc(22)} title="Sin documentos aún" body="Los documentos se generan al zarpar cada embarque." /> :
      <React.Fragment>

        {/* Filtros · tipo (chips) + proveedor (select) + búsqueda */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 'var(--s-5)' }}>
          <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)', flexWrap: 'wrap' }}>
            {TYPES.map((t) => { const on = tipo === t.k; const n = countFor(t.k); return (
              <button key={t.k} onClick={() => setTipo(t.k)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 'var(--r-pill)', border: 0, cursor: 'pointer', background: on ? 'var(--bg-surface)' : 'transparent', color: on ? 'var(--wine-text)' : 'var(--ink-soft)', font: (on ? '700' : '600') + ' 12.5px/1 var(--f-sans)', boxShadow: on ? 'var(--shadow-xs)' : 'none' }}>
                {t.l}<span style={{ font: '700 10px/1 var(--f-mono)', color: on ? 'var(--wine-text)' : 'var(--ink-mute)' }}>{n}</span>
              </button>); })}
          </div>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 11, color: 'var(--ink-mute)', pointerEvents: 'none', display: 'inline-flex' }}>{I.bag(14)}</span>
            <select value={prov} onChange={(e) => setProv(e.target.value)} style={{ ...inputBox, paddingLeft: 32, paddingRight: 26, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none' }}>
              <option value="todos">Todos los proveedores</option>
              {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 10, color: 'var(--ink-mute)', pointerEvents: 'none' }}>{I.chevD(13)}</span>
          </div>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flex: '1 1 180px', minWidth: 160 }}>
            <span style={{ position: 'absolute', left: 11, color: 'var(--ink-mute)', pointerEvents: 'none', display: 'inline-flex' }}>{I.search ? I.search(14) : null}</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar documento o embarque…" style={{ ...inputBox, width: '100%', paddingLeft: 32 }} />
          </div>
        </div>

        {docs.length === 0 ?
        <div style={{ padding: 'var(--s-8)', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>No hay documentos con esos filtros. Prueba otro tipo o proveedor.</div> :
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {docs.map((d) => { const p = d._proof; const stTone = p ? ({ 'verificado': 'success', 'rechazado': 'danger', 'en revisión': 'warning' }[p.status] || 'warning') : null;
          return (
          <U.Card key={d.id} hoverable style={{ padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: 'var(--grad-wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p ? (I.receipt ? I.receipt(16) : I.wallet(16)) : window.Icon.doc(16)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{d.type}</div>
                <code style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{d.id}</code>
              </div>
              {p && <U.Badge tone={stTone} size="sm" dot>{p.status === 'en revisión' ? 'En revisión' : p.status === 'verificado' ? 'Verificado' : 'Rechazado'}</U.Badge>}
            </div>
            {p
              ? <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ font: '800 16px/1 var(--f-mono)', color: 'var(--ink)' }}>{money(p.amount, p.currency)}</span>
                  <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{p.methodLabel || p.method}</span>
                </div>
              : (d.supplier &&
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', font: '600 10.5px/1 var(--f-sans)', color: 'var(--wine-text)', background: 'var(--wine-tint)', padding: '5px 9px', borderRadius: 'var(--r-pill)' }}>{I.bag(12)} {d.supplier}</div>)}
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
              {p ? 'Aplica a: ' : 'Embarque: '}<code style={{ fontFamily: 'var(--f-mono)' }}>{d.shipment}</code>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px 10px', flexWrap: 'wrap' }}>
              <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>{d.issued} · {d.size}</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--wine-text)', font: '700 11.5px/1 var(--f-sans)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {p ? 'Ver' : 'Descargar'} {window.Icon.download(11)}
              </span>
            </div>
          </U.Card>); })}
        </div>}

      </React.Fragment>}
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
                        <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                          <code style={{ font: '600 11px var(--f-mono)' }}>{c.shipment}</code> · {c.date}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <U.Badge tone={c.status === 'resuelto' ? 'success' : c.status === 'en-revision' ? 'warning' : 'info'} dot>{RECLAMO_STEP_LABEL[c.status]}</U.Badge>
                        <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>Paso {stepIdx + 1} de 3</div>
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
              <a href="https://wa.me/584121668021" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', textDecoration: 'none' }}>
                <span style={{ color: '#25D366' }}>{window.Icon.globe(15)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>WhatsApp</div>
                  <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>+58 412 DTD-CARG</code>
                </div>
              </a>
              <a href="mailto:soporte@dtdcargo.com" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', textDecoration: 'none' }}>
                <span style={{ color: 'var(--wine-text)' }}>{window.Icon.mail(15)}</span>
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
        <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)', maxWidth: '52ch' }}>Recomienda DTD-Cargo y gana crédito en tus embarques.</p>
        <U.Card padded style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ width: 64, height: 64, borderRadius: 'var(--r-lg)', background: 'var(--wine-tint)', color: 'var(--wine-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{I.star ? I.star(30) : I.spark(30)}</div>
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
        <U.Card padded={false} style={{ overflow: 'hidden', background: 'var(--grad-navy)', border: 0, color: '#fff' }}>
          <div style={{ padding: 28 }}>
            <div style={{ font: '700 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>TU CÓDIGO DE REFERIDO</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <code style={{ font: '900 34px/1 var(--f-display)', letterSpacing: '0.02em', color: '#fff' }}>{code}</code>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copy} style={heroBtn(copied)}>{copied ? <span className="pc-pop">{I.check(14)}</span> : I.doc(14)} {copied ? 'Copiado' : 'Copiar'}</button>
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
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', font: '600 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
              {fmt(pending)} en camino · referidos en proceso
            </div>
          }
          <div style={{ marginTop: 14, font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
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
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Tu nivel</div>
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
          <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{myRefs.length} en total</span>
        </div>
        {myRefs.length === 0 ?
        <div style={{ padding: '32px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Todavía no referiste a nadie. Comparte tu código y empezá a ganar.</div> :
        myRefs.map((r, i) => {
          const stt = F.REFERRAL_STATUS[r.status];
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 150px 110px', gap: 14, alignItems: 'center', padding: '13px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
              <div>
                <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.referredName}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{r.referredCompany} · {r.date}</div>
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
    background: active ? 'var(--success)' : outline ? 'transparent' : 'var(--bg-elevated)',
    color: active ? '#fff' : outline ? '#fff' : 'var(--wine-text)',
    border: outline ? '1px solid rgba(255,255,255,0.3)' : 'none'
  };
}

// ── Reclamos formales ────────────────────────────────────────
const RECLAMO_TYPE = {
  facturacion: { label: 'Facturación', tone: 'info' },
  demora: { label: 'Demora en entrega', tone: 'warning' },
  dano: { label: 'Daño en la carga', tone: 'danger' },
  faltante: { label: 'Faltante de mercancía', tone: 'danger' },
  otro: { label: 'Otro', tone: 'neutral' }
};
const RECLAMO_STEPS = ['recibido', 'en-revision', 'resuelto'];
const RECLAMO_STEP_LABEL = { recibido: 'Recibido', 'en-revision': 'En revisión', resuelto: 'Resuelto' };

function NewReclamoForm({ myShipments, onCancel, onSubmit }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [type, setType] = pUseState('facturacion');
  // Embarque por defecto = la última mercancía recibida (entregada más reciente).
  const _recibidos = myShipments.filter((s) => s.status === 'entregado');
  const _defShip = _recibidos.length ? _recibidos.slice().sort((a, b) => (b.eta || '').localeCompare(a.eta || ''))[0] : myShipments[0];
  const [shipment, setShipment] = pUseState(_defShip ? _defShip.id : '');
  const [subject, setSubject] = pUseState('');
  const [desc, setDesc] = pUseState('');
  const [sending, setSending] = pUseState(false);

  const submit = () => {
    if (!subject.trim() || !desc.trim()) {alert('Completa el asunto y la descripción.');return;}
    if (sending) return;
    setSending(true);
    const num = String(Math.floor(40 + Math.random() * 50)).padStart(4, '0');
    setTimeout(() => onSubmit({
      id: 'REC-2026-' + num, type, shipment: shipment || '—', subject: subject.trim(),
      status: 'recibido', date: new Date().toISOString().slice(0, 10),
      messages: [{ from: 'me', text: desc.trim(), time: 'ahora' }]
    }), 2100);
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
        <button onClick={submit} disabled={sending} className={'pcb pcb--wine pcb--case' + (sending ? ' go' : '')}>
          <span className="pcl pcl-def">Enviar caso</span>
          <span className="pcl pcl-ok"><svg className="ck" viewBox="0 0 12 10"><polyline points="1.5 6 4.5 9 10.5 1"></polyline></svg>Caso enviado</span>
          <span className="pctr" aria-hidden="true"></span>
          <span className="pcpl" aria-hidden="true"></span>
        </button>
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
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 13px/1 var(--f-sans)', color: 'var(--wine-text)', marginBottom: 16, cursor: 'pointer' }}>
        {I.arrowL(14)} Volver a soporte
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <code style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)' }}>{claim.id}</code>
        <U.Badge tone={tp.tone} size="sm">{tp.label}</U.Badge>
        <U.Badge tone={claim.status === 'resuelto' ? 'success' : claim.status === 'en-revision' ? 'warning' : 'info'} dot>{RECLAMO_STEP_LABEL[claim.status]}</U.Badge>
      </div>
      <div style={{ font: '600 15px/1.4 var(--f-sans)', color: 'var(--ink)', marginBottom: 4 }}>{claim.subject}</div>
      <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 'var(--s-6)' }}>
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

function PortalProfile({ me, profileComplete, verifying, onCompleteProfile }) {
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
  const eyebrow = { font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-text)', letterSpacing: '0.14em', textTransform: 'uppercase' };
  const docRow = (label, ok) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      <span style={{ color: ok ? 'var(--success)' : 'var(--ink-mute)', flexShrink: 0 }}>{ok ? I.check(15) : I.upload(15)}</span>
      <span style={{ flex: 1, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{label}</span>
      {ok
        ? <button onClick={() => {}} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, cursor: 'pointer', font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine-text)' }}>{I.eye(13)} Ver</button>
        : <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Pendiente</span>}
    </div>);

  return (
    <div>
      <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>Mi perfil</h1>
      <p style={{ font: '500 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 var(--s-6)' }}>Tus datos, tus direcciones de entrega y tu código Shipping Mark.</p>

      {!profileComplete &&
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', marginBottom: 16, background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--r-lg)' }}>
        <span style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 'var(--r-md)', background: 'var(--warning)', color: 'var(--on-warning)', display: 'grid', placeItems: 'center' }}>{I.idcard(20)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '800 14px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Falta verificar tu identidad</div>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '3px 0 12px' }}>Sube tu foto de cédula para activar <b style={{ color: 'var(--ink)' }}>Documentos, Referidos, Academia y Soporte</b>. Es un solo paso.</div>
          <button onClick={onCompleteProfile} disabled={verifying} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 20px', borderRadius: 'var(--r-md)', border: 0, background: 'var(--wine)', color: '#fff', cursor: verifying ? 'default' : 'pointer', font: '800 13px/1 var(--f-sans)' }}>
            {verifying
              ? <React.Fragment><span style={{ width: 15, height: 15, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'erp-spin .7s linear infinite' }} /> Verificando…</React.Fragment>
              : <React.Fragment>{I.upload(15)} Subir cédula y verificar</React.Fragment>}
          </button>
        </div>
      </div>}

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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 10, padding: '4px 10px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)', color: 'var(--wine-text)', font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.04em' }}>
              {esEmpresa ? I.building(12) : I.users(12)} {esEmpresa ? 'Cuenta de empresa' : 'Cuenta personal'}
            </span>
          </div>
          <div style={{ marginTop: 18, padding: '14px 16px', background: 'var(--bg-sidebar)', color: '#fff', borderRadius: 'var(--r-md)', textAlign: 'center' }}>
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
            {docRow('Cédula de identidad', profileComplete)}

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
                <span style={{ color: 'var(--wine-text)', flexShrink: 0, marginTop: 1 }}>{I.building(16)}</span>
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
              <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{addresses.length} de 4</span>
            </div>
            <p style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>
              Tu dirección <b>predeterminada</b> es donde recibes tu mercancía. El costo de entrega (last-mile) se calcula con ella y <b>se recalcula automáticamente</b> si eliges otra.
            </p>

            {/* Costo last-mile de la predeterminada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--wine-tint)', border: '1px solid var(--wine-soft)', borderRadius: 'var(--r-md)', marginBottom: 16 }}>
              <span style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.truck(18)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-text)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Entrega last-mile · {zone.zone}</div>
                <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Hacia <b style={{ color: 'var(--ink)' }}>{def.label}</b> · {def.city} · {zone.days} días hábiles</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--wine-text)' }}>${zone.fee}</div>
                <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>se suma al flete</div>
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
                        <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{a.city} · {a.state}{a.ref ? ' · ' + a.ref : ''} · <span style={{ color: 'var(--ink-soft)' }}>last-mile ${z.fee}</span></div>
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
                  : <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', textAlign: 'center', margin: 0 }}>Llegaste al máximo de 4 direcciones. Elimina una para agregar otra.</p>
              )}
            </div>
          </U.Card>
        </div>
      </div>
    </div>);

}

// ── Footer ───────────────────────────────────────────────────
// ── Calculadora · embebida en el portal (no saca al cliente) ──
// Replica el switch de servicio de Tarifas (DDP / LCL): recolorea + cambia
// la calc embebida (?tarifa=lcl). Tarifas reales del ERP (getCbmTariff).
function PortalCalculadora({ me, setView, ships }) {
  const I = window.Icon;
  const DB = window.DTDData;
  const [tab, setTab] = React.useState('calcular');
  const estimados = (ships || []).filter((s) => s.status === 'estimado');
  const usd = (n) => 'USD ' + (n || 0).toLocaleString('es-ES');
  const [svc, setSvc] = React.useState('ddp');
  const [ifSvc, setIfSvc] = React.useState('ddp'); // servicio del iframe (rezaga tras la “hoja”)
  const leafRef = React.useRef(null);
  const rate = (s) => { try { const t = DB && DB.getCbmTariff && DB.getCbmTariff(s === 'lcl' ? 'lcl' : ''); return (t && t.rate) ? t.rate : (s === 'lcl' ? 600 : 800); } catch (e) { return s === 'lcl' ? 600 : 800; } };
  const price = (s) => '$' + Number(rate(s)).toLocaleString('en-US');
  // Cambio de servicio con transición “hoja” (giro 3D wine↔dorado que enmascara la recarga del iframe).
  const pick = (next) => {
    if (next === svc) return;
    setSvc(next);
    let reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    const leaf = leafRef.current;
    if (reduce || !leaf) { setIfSvc(next); return; }
    const dir = 'to-' + next;
    const tag = leaf.querySelector('.pc-leaf-tag');
    if (tag) tag.textContent = next === 'lcl' ? 'Consolidado' : 'Puerta a puerta';
    leaf.className = 'pc-leaf ' + dir;
    void leaf.offsetWidth;
    leaf.className = 'pc-leaf turning ' + dir;
    setTimeout(() => setIfSvc(next), 340);
    setTimeout(() => { if (leafRef.current) leafRef.current.className = 'pc-leaf'; }, 720);
  };
  const isLcl = svc === 'lcl';
  const accent = isLcl ? 'var(--warning)' : 'var(--wine)';
  const OPTS = [
    { id: 'ddp', name: 'Puerta a puerta', sig: 'DDP', desc: 'Hasta tu puerta · todo incluido',
      ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6.5h11v8H3z" /><path d="M14 9h3.5l3 3v2.5H14z" /><circle cx="7" cy="17.5" r="1.7" /><circle cx="17.5" cy="17.5" r="1.7" /></svg> },
    { id: 'lcl', name: 'Consolidado', sig: 'LCL', desc: 'Hasta el puerto · compartes contenedor',
      ic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><rect x="3" y="7" width="18" height="12" rx="1.4" /><g fill="currentColor" stroke="none"><rect x="5.4" y="13.2" width="3.6" height="4" /><rect x="9.3" y="13.2" width="3.6" height="4" /><rect x="13.2" y="13.2" width="3.6" height="4" /><rect x="5.4" y="9.4" width="3.6" height="3.2" /><rect x="9.3" y="9.4" width="3.6" height="3.2" /></g></svg> },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--topbar-h) - 56px)', minHeight: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14, flexShrink: 0 }}>
        <button onClick={() => setView('home')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Inicio</button>
        <h1 style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Calculadora</h1>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {[['calcular', 'Calcular'], ['estimados', 'Mis estimados']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 'var(--r-pill)', cursor: 'pointer', border: '1px solid ' + (tab === k ? 'var(--wine)' : 'var(--border)'), background: tab === k ? 'var(--wine-tint)' : 'var(--bg-surface)', color: tab === k ? 'var(--wine-text)' : 'var(--ink)', font: '700 12.5px/1 var(--f-sans)' }}>{l}{k === 'estimados' && estimados.length > 0 && <span style={{ font: '700 10px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{estimados.length}</span>}</button>
          ))}
        </div>
      </div>

      {tab === 'calcular' && <React.Fragment>

      {/* Switch de servicio · recolorea y cambia la calc de abajo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(258px, 1fr))', gap: 12, marginBottom: 12, flexShrink: 0 }}>
        {OPTS.map((o) => {
          const on = svc === o.id;
          const acc = o.id === 'lcl' ? 'var(--warning)' : 'var(--wine)';
          const onText = o.id === 'lcl' ? 'var(--on-warning)' : '#fff';
          return (
            <button key={o.id} onClick={() => pick(o.id)} role="tab" aria-selected={on} style={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', cursor: 'pointer',
              padding: '12px 14px', borderRadius: 'var(--r-lg)',
              background: on ? (o.id === 'lcl' ? 'var(--warning-bg)' : 'var(--wine-tint)') : 'var(--bg-surface)',
              border: '2px solid ' + (on ? acc : 'var(--border)'),
              boxShadow: on ? 'var(--shadow-md)' : 'var(--shadow-sm)', transition: 'border-color 160ms var(--ease), background 160ms var(--ease)'
            }}>
              <span style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: 'var(--r-md)', flexShrink: 0, background: acc, color: onText }}>{React.cloneElement(o.ic, { width: 24, height: 24 })}</span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ font: '800 17px/1.05 var(--f-display)', letterSpacing: '-0.01em', color: 'var(--ink)' }}>{o.name}</span>
                  <span style={{ font: '800 10.5px/1 var(--f-sans)', letterSpacing: '0.06em', padding: '3px 7px', borderRadius: 'var(--r-pill)', color: o.id === 'lcl' ? 'var(--ink)' : 'var(--wine-text)', border: '1px solid ' + acc }}>{o.sig}</span>
                </span>
                <span style={{ font: '600 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{o.desc}</span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <span style={{ font: '900 19px/1 var(--f-display)', letterSpacing: '-0.02em', color: 'var(--ink)', whiteSpace: 'nowrap' }}>{price(o.id)}<span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginLeft: 3 }}>/ CBM</span></span>
                {on && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: '800 9px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 9px', borderRadius: 'var(--r-pill)', background: acc, color: onText, whiteSpace: 'nowrap' }}>✓ Estás aquí</span>}
              </span>
            </button>);
        })}
      </div>

      {/* Frame de la calculadora · ocupa el alto restante (una sola pantalla) */}
      <div className="pc-frame" data-mode={svc} style={{ flex: 1, minHeight: 0 }}>
        <div className="pc-leaf" ref={leafRef} aria-hidden="true"><span className="pc-leaf-tag"></span></div>
        <iframe key={ifSvc} title="Calculadora" src={`Calculadora CBM · DTD-Cargo.html?mb=${encodeURIComponent(me.markbox || '')}${ifSvc === 'lcl' ? '&tarifa=lcl' : ''}`} style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
      </div>
      </React.Fragment>}

      {tab === 'estimados' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <p style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 16px' }}>Tus estimados guardados — los generas en <b style={{ color: 'var(--ink)' }}>Calcular</b>. Cuando confirmes uno, pasa a una compra.</p>
          {estimados.length === 0
            ? <div style={{ padding: 'var(--s-8)', textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-lg)', background: 'var(--bg-surface)' }}>
                <div style={{ color: 'var(--wine-text)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{I.calc(24)}</div>
                <div style={{ font: '700 14px/1.3 var(--f-display)', color: 'var(--ink)' }}>Sin estimados todavía</div>
                <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Usa <b style={{ color: 'var(--ink)' }}>Calcular</b> para generar tu primer estimado.</div>
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {estimados.map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px 20px' }}>
                    <span style={{ width: 38, height: 38, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine-text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.calc(16)}</span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <code style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
                      <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{(s.cbm ? s.cbm + ' CBM · ' : '') + (s.type || 'estimado')} · lo pediste tú</div>
                    </div>
                    <div style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--ink)' }}>{usd(s.value)}</div>
                  </div>
                ))}
              </div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--bg-surface)' }}>
            <span style={{ color: 'var(--ink-mute)', display: 'flex' }}>{I.invoice(16)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Cotizaciones formales</div>
              <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Pronto podrás pedir y aprobar cotizaciones en línea.</div>
            </div>
            <span style={{ font: '800 8.5px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg-elevated)', padding: '5px 9px', borderRadius: 'var(--r-pill)' }}>Próximamente</span>
          </div>
        </div>
      )}
    </div>);
}

// ── Calculadora normal (teclado/teclas) · dentro de la ventana flotante ──
function NormalCalc({ glass }) {
  const I = window.Icon;
  const [expr, setExpr] = React.useState('');
  const [copied, setCopied] = React.useState(false);
  const ev = (s) => { try { const c = String(s).replace(/×/g, '*').replace(/÷/g, '/').replace(/%/g, '/100'); if (!/^[-0-9+*/(). ]*$/.test(c) || !c.trim()) return ''; const v = Function('return (' + c + ')')(); return isFinite(v) ? String(Math.round(v * 1e8) / 1e8) : ''; } catch (e) { return ''; } };
  const res = ev(expr);
  const press = (k) => { if (k === 'C') return setExpr(''); if (k === '⌫') return setExpr(expr.slice(0, -1)); if (k === '=') { const r = ev(expr); if (r) setExpr(r); return; } setExpr(expr + k); };
  const copy = () => { const v = res || expr; if (!v) return; try { navigator.clipboard?.writeText(v); } catch (e) {} setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', '.', '%', '+'];
  const ink = glass ? 'var(--glass-ink)' : 'var(--ink)';
  const inkSoft = glass ? 'color-mix(in srgb, var(--glass-ink) 68%, transparent)' : 'var(--ink-soft)';
  const bd = glass ? 'var(--glass-border)' : 'var(--border)';
  const keyBg = glass ? 'var(--glass-key)' : 'var(--bg-surface)';
  const insetBg = glass ? 'var(--glass-inset)' : 'var(--bg-base)';
  const opColor = glass ? 'var(--glass-ink)' : 'var(--wine)';
  return (
    <div style={{ padding: 14 }}>
      <input value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); press('='); } }} inputMode="decimal" placeholder="0" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'right', border: '1px solid ' + bd, borderRadius: 'var(--r-md)', padding: '12px 14px', font: '700 22px/1.1 var(--f-mono)', color: ink, background: insetBg, outline: 'none' }} />
      <div style={{ textAlign: 'right', font: '600 13px/1 var(--f-mono)', color: inkSoft, minHeight: 15, margin: '6px 2px 12px' }}>{res && res !== expr ? '= ' + res : ''}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7 }}>
        {keys.map((k) => { const op = /[÷×\-+]/.test(k); return <button key={k} onClick={() => press(k)} style={{ padding: '12px 0', borderRadius: 'var(--r-md)', border: '1px solid ' + bd, cursor: 'pointer', font: '700 16px/1 var(--f-mono)', background: op ? (glass ? 'var(--glass-key)' : 'var(--wine-tint)') : keyBg, color: op ? opColor : ink }}>{k}</button>; })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 7, marginTop: 7 }}>
        <button onClick={() => press('C')} style={{ padding: '11px 0', borderRadius: 'var(--r-md)', border: '1px solid ' + bd, cursor: 'pointer', font: '700 13px/1 var(--f-sans)', background: keyBg, color: glass ? 'var(--glass-ink)' : 'var(--danger)' }}>C</button>
        <button onClick={() => press('⌫')} style={{ padding: '11px 0', borderRadius: 'var(--r-md)', border: '1px solid ' + bd, cursor: 'pointer', font: '700 15px/1 var(--f-mono)', background: keyBg, color: ink }}>⌫</button>
        <button onClick={() => press('=')} style={{ padding: '11px 0', borderRadius: 'var(--r-md)', border: 0, cursor: 'pointer', font: '800 16px/1 var(--f-mono)', background: 'var(--wine)', color: '#fff' }}>=</button>
      </div>
      <button onClick={copy} style={{ width: '100%', marginTop: 9, padding: '10px 0', borderRadius: 'var(--r-md)', border: '1px solid ' + bd, cursor: 'pointer', font: '700 12px/1 var(--f-sans)', background: keyBg, color: glass ? 'var(--glass-ink)' : 'var(--wine-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>{copied ? I.check(13) : I.copy(13)} {copied ? 'Copiado' : 'Copiar resultado'}</button>
    </div>);
}

// ── Calculadora flotante · FAB siempre visible + ventana móvil (no saca de nada) ──
function PortalCalcFab({ markbox, open, setOpen }) {
  const I = window.Icon;
  const [ppos, setPpos] = pUseState(null);
  const [size, setSize] = pUseState({ w: 372, h: 520 });
  const startPanelDrag = (e) => {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const ox = ppos ? ppos.x : (window.innerWidth - size.w - 24), oy = ppos ? ppos.y : 76;
    const move = (ev) => setPpos({ x: Math.max(8, Math.min(window.innerWidth - size.w, ox + (ev.clientX - sx))), y: Math.max(8, Math.min(window.innerHeight - 80, oy + (ev.clientY - sy))) });
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  };
  const px = ppos ? ppos.x : (window.innerWidth - size.w - 24);
  const py = ppos ? ppos.y : 76;
  const startResize = (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ow = size.w, oh = size.h;
    if (!ppos) setPpos({ x: px, y: py });
    const move = (ev) => setSize({ w: Math.max(300, Math.min(window.innerWidth - 24, ow + (ev.clientX - sx))), h: Math.max(320, Math.min(window.innerHeight - 120, oh + (ev.clientY - sy))) });
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  };
  // Redimensionar desde la esquina inferior IZQUIERDA (borde derecho fijo).
  const startResizeLeft = (e) => {
    e.preventDefault(); e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ow = size.w, oh = size.h;
    const rightEdge = px + size.w;
    if (!ppos) setPpos({ x: px, y: py });
    const move = (ev) => {
      const newW = Math.max(300, Math.min(rightEdge - 8, ow - (ev.clientX - sx)));
      setSize({ w: newW, h: Math.max(320, Math.min(window.innerHeight - 120, oh + (ev.clientY - sy))) });
      setPpos({ x: rightEdge - newW, y: py });
    };
    const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
  };
  return (
    <React.Fragment>
      {open &&
      <div style={{ position: 'fixed', zIndex: 88, left: px, top: py, width: size.w, maxWidth: 'calc(100vw - 16px)', background: 'linear-gradient(color-mix(in srgb, var(--warning) 12%, transparent), color-mix(in srgb, var(--warning) 12%, transparent)), var(--glass-bg)', color: 'var(--glass-ink)', border: '1px solid var(--glass-border)', borderRadius: 'var(--r-lg)', WebkitBackdropFilter: 'var(--glass-blur)', backdropFilter: 'var(--glass-blur)', boxShadow: 'var(--glass-hi), var(--glass-shadow)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div onPointerDown={startPanelDrag} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--glass-border)', color: 'var(--glass-ink)', cursor: 'move', touchAction: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--wine-text)', display: 'flex' }}>{I.calc(15)}</span>
            <span style={{ font: '800 13px/1 var(--f-display)' }}>Calculadora normal</span>
            <span className="drag-hint" style={{ font: '600 9px/1 var(--f-mono)', color: 'color-mix(in srgb, var(--glass-ink) 55%, transparent)', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 4 }}><span className="drag-ico" style={{ display: 'inline-flex' }}>{I.move(11)}</span>arrástrame</span>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Cerrar" style={{ background: 'none', border: 0, color: 'var(--glass-ink)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ maxHeight: size.h, overflowY: 'auto' }}><NormalCalc glass /></div>
        <div onPointerDown={startResizeLeft} title="Arrastra para ampliar" style={{ position: 'absolute', left: 2, bottom: 2, width: 18, height: 18, cursor: 'nesw-resize', touchAction: 'none', background: 'linear-gradient(225deg, transparent 45%, var(--wine) 45%, var(--wine) 60%, transparent 60%, transparent 72%, var(--wine) 72%, var(--wine) 86%, transparent 86%)' }} />
        <div onPointerDown={startResize} title="Arrastra para ampliar" style={{ position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, cursor: 'nwse-resize', touchAction: 'none', background: 'linear-gradient(135deg, transparent 45%, var(--wine) 45%, var(--wine) 60%, transparent 60%, transparent 72%, var(--wine) 72%, var(--wine) 86%, transparent 86%)' }} />
      </div>}
    </React.Fragment>);
}

function PortalFooter() {
  const [legal, setLegal] = pUseState(null);
  const openLegal = (i) => { try { const d = window.LegalData && window.LegalData.currentDocs(); if (d && d.length) setLegal(d[i] || d[0]); } catch (e) {} };
  return (
    <footer style={{ marginTop: 80, padding: '32px var(--s-6)', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <PortalLogo />
        <div style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
          © 2026 DTD-Cargo · Portal del Cliente v4.6 · <a onClick={() => openLegal(0)} style={{ color: 'var(--wine-text)', cursor: 'pointer' }}>Términos</a> · <a onClick={() => openLegal(1)} style={{ color: 'var(--wine-text)', cursor: 'pointer' }}>Privacidad</a>
        </div>
      </div>
      <PortalDocViewer doc={legal} onClose={() => setLegal(null)} />
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

  const [suppliers, setSuppliers] = pUseState(
    window.ERPData?.suppliersFor?.(me.markbox) || [
    { n: 1, name: 'Yiwu Standard Co', orders: 2 },
    { n: 2, name: 'Shenzhen Lights Ltd', orders: 1 }]

  );
  const [createOpen, setCreateOpen] = pUseState(false);
  const FAV_KEY = 'dtd-portal-supp-favs-' + (me.markbox || 'demo');
  const [favs, setFavs] = pUseState(() => { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch (e) { return []; } });
  const [flashN, setFlashN] = pUseState(null);
  const saveFavs = (arr) => { setFavs(arr); try { localStorage.setItem(FAV_KEY, JSON.stringify(arr)); } catch (e) {} };
  const toggleFav = (n) => { if (favs.includes(n)) saveFavs(favs.filter((x) => x !== n)); else if (favs.length < 3) saveFavs([...favs, n]); };
  const addSupplier = (data) => {
    const n = Math.max(0, ...suppliers.map((s) => s.n)) + 1;
    setSuppliers((prev) => [{ n, orders: 0, ...data }, ...prev]);
    setFlashN(n); setTimeout(() => setFlashN((v) => (v === n ? null : v)), 2800);
    setCreateOpen(false);
  };
  const [helpOpen, setHelpOpen] = pUseState(() => { try { return localStorage.getItem('dtd-portal-supp-help') === '1'; } catch (e) { return false; } });
  const [hint, setHint] = pUseState(false);

  const codeFor = (s, order) => `${PREFIX}-${clientNo}-${s.n}-${order}`;
  const favSet = new Set(favs);
  const ordered = [...favs.map((n) => suppliers.find((s) => s.n === n)).filter(Boolean), ...suppliers.filter((s) => !favSet.has(s.n))];
  const favFull = favs.length >= 3;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', margin: '0 0 10px' }}>
        <div>
          <h1 style={{ font: '900 30px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>Tus proveedores</h1>
          <p style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '8px 0 0', maxWidth: '52ch' }}>Cada compra es una <b style={{ color: 'var(--wine-text)' }}>prealerta</b>: generas un código por proveedor y nos avisas que viene tu mercancía.</p>
        </div>
        <U.Btn variant="primary" icon={I.plus(14)} onClick={() => setCreateOpen(true)}>Crear proveedor</U.Btn>
      </div>

      {/* Ayuda interactiva · ventana ámbar con sombra · no confundir con un formulario */}
      <div style={{ border: '1.5px solid var(--warning)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--s-5)', overflow: 'hidden', background: 'var(--warning-bg)', boxShadow: 'var(--shadow-md)' }}>
        <button onClick={() => { const v = !helpOpen; setHelpOpen(v); try { localStorage.setItem('dtd-portal-supp-help', v ? '1' : '0'); } catch (e) {} if (v) { setHint(true); setTimeout(() => setHint(false), 3000); } }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 26, height: 26, borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', border: '1px solid var(--warning)', color: 'var(--ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.info(14)}</span>
          <span style={{ font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>¿Por qué registrar tus proveedores?</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', font: '700 9px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink)', background: 'var(--bg-surface)', border: '1px solid var(--warning)', padding: '4px 8px', borderRadius: 'var(--r-pill)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--warning)' }}></span>Ayuda interactiva</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: 'var(--ink-soft)', transform: helpOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur) var(--ease)' }}>{I.chevD(14)}</span>
        </button>
        {helpOpen &&
        <div style={{ position: 'relative', padding: '16px 16px 18px' }}>
          {hint &&
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(15,30,61,0.55)', borderRadius: '0 0 var(--r-lg) var(--r-lg)', animation: 'dtd-hintfade 3s var(--ease) forwards', pointerEvents: 'none' }}>
            <style>{'@keyframes dtd-hintfade{0%{opacity:0}12%{opacity:1}80%{opacity:1}100%{opacity:0}}'}</style>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 17px', borderRadius: 'var(--r-pill)', background: 'var(--warning-bg)', border: '1.5px solid var(--warning)', boxShadow: 'var(--shadow-pop)' }}>
              <span style={{ color: 'var(--ink)', display: 'flex' }}>{(I.radar || I.info)(16)}</span>
              <span style={{ font: '800 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Esto es una ayuda · toca las compras para probar</span>
            </div>
          </div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            {[
              ['truck', 'Rapidez', 'La caja entra identificada y no espera como “huérfana”.'],
              ['shield', 'Control total', 'Al llegar el envío, el código ya dice de qué proveedor viene.'],
              ['radar', 'Seguimiento por compra', 'Cada compra tiene su código: sabes en qué contenedor viene cada una.'],
              ['doc', 'Historial ordenado', 'Tus compras quedan agrupadas por proveedor, listas para reportes.'],
            ].map((b) =>
            <div key={b[1]} style={{ display: 'flex', gap: 10 }}>
              <span style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine-text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{(I[b[0]] || I.info)(15)}</span>
              <div>
                <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{b[1]}</div>
                <div style={{ font: '500 11px/1.45 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{b[2]}</div>
              </div>
            </div>
            )}
          </div>
          <SupplierTrackingDemo base={`${PREFIX}-${clientNo}-1`} />
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', font: '600 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 12 }}>
            <span style={{ flexShrink: 0, marginTop: 1, color: 'var(--success)' }}>{I.check(14)}</span>
            <span>Copia el código y envíaselo SOLO al proveedor — a nosotros nos llega automático al registrarlo.</span>
          </div>
        </div>}
      </div>

      {/* Lista de proveedores · favoritos fijados arriba, luego más recientes primero */}
      {favs.length > 0 &&
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 8px', font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
        <span style={{ color: 'var(--warning)', display: 'flex' }}>{I.star ? I.star(12) : '★'}</span>
        {favs.length} de 3 favoritos fijados arriba
      </div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ordered.map((s) => {
        const isFav = favSet.has(s.n);
        const isFlash = s.n === flashN;
        return (
        <div key={s.n} style={isFlash ? { borderRadius: 'var(--r-lg)', outline: '2px solid var(--success)', outlineOffset: 2 } : undefined}>
          <U.Card padded>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine-text)', display: 'grid', placeItems: 'center', font: '900 15px/1 var(--f-display)' }}>#{s.n}</div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{s.name}
                  {s.orders === 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: '700 8px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink)', background: 'var(--success-bg)', padding: '3px 7px', borderRadius: 'var(--r-pill)' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }}></span>Nuevo</span>}
                  {isFlash && <span style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--success)' }}>· recién creado</span>}
                </div>
                <div style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>
                  {s.orders > 0
                    ? <React.Fragment>{s.orders} compra{s.orders > 1 ? 's' : ''} · próxima: <b style={{ color: 'var(--wine-text)' }}>{codeFor(s, s.orders + 1)}</b></React.Fragment>
                    : <React.Fragment>Sin compras aún · tu código: <b style={{ color: 'var(--wine-text)' }}>{`${PREFIX}-${clientNo}-${s.n}`}</b> <span style={{ color: 'var(--ink-soft)' }}>· el número de compra se agrega al comprar</span></React.Fragment>}
                </div>
              </div>
              <button type="button" onClick={() => toggleFav(s.n)} disabled={!isFav && favFull} title={isFav ? 'Quitar de favoritos' : (favFull ? 'Máximo 3 favoritos · quita uno para fijar otro' : 'Fijar arriba')} aria-pressed={isFav} style={{ background: 'none', border: 0, padding: 6, cursor: (!isFav && favFull) ? 'default' : 'pointer', color: isFav ? 'var(--warning)' : 'var(--ink-mute)', opacity: (!isFav && favFull) ? 0.3 : 1, display: 'flex', flexShrink: 0 }}>{I.star ? I.star(18) : '★'}</button>
              <U.Btn variant="primary" size="sm" iconRight={I.arrowR(13)} onClick={() => goCompra(s)}>{s.orders > 0 ? 'Re-comprar' : 'Comprar'}</U.Btn>
            </div>
          </U.Card>
        </div>);
        })}
      </div>

      {createOpen && <PortalSupplierCreate onCancel={() => setCreateOpen(false)} onCreate={addSupplier} existingNames={suppliers.map((s) => s.name)} />}
    </div>);

}

function PortalSupplierCreate({ onCancel, onCreate, existingNames }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const [name, setName] = pUseState('');
  const [code, setCode] = pUseState('+86');
  const [digits, setDigits] = pUseState('');
  const [wxOpen, setWxOpen] = pUseState(false);
  const [shot, setShot] = pUseState(null);
  const [dragOver, setDragOver] = pUseState(false);
  const shotRef = React.useRef(null);
  const [sells, setSells] = pUseState('');
  const [origin, setOrigin] = pUseState('');
  const [originNote, setOriginNote] = pUseState('');
  const [history, setHistory] = pUseState('');
  const [note, setNote] = pUseState('');

  const dup = name.trim() && (existingNames || []).some((x) => x.toLowerCase() === name.trim().toLowerCase());
  const needNote = origin === 'Me lo recomendaron' || origin === 'Otro';
  const ok = name.trim() && !dup && sells.trim() && !!origin && !!history && (needNote ? originNote.trim() : true);
  const readShot = (f) => { const r = new FileReader(); r.onload = () => setShot(r.result); r.readAsDataURL(f); };
  const onPhone = (raw) => {
    const s = String(raw);
    if (s.trim().startsWith('+')) {
      const cleaned = '+' + s.trim().slice(1).replace(/[^\d]/g, '');
      const match = _PHONE_CODES.map((o) => o.dial).filter((d) => cleaned.startsWith(d)).sort((a, b) => b.length - a.length)[0];
      if (match) { setCode(match); setDigits(cleaned.slice(match.length)); return; }
    }
    setDigits(s.replace(/[^\d]/g, ''));
  };
  const create = () => { if (!ok) return; onCreate({ name: name.trim(), phone: digits ? code + ' ' + digits : '', wechat: !!shot, sells: sells.trim(), origin, originNote: originNote.trim(), history, note: note.trim() }); };

  const lblS = { display: 'block', font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 7 };
  const optS = { textTransform: 'none', letterSpacing: 0, color: 'var(--ink-soft)', fontWeight: 600 };
  const inS = { width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 14px/1.4 var(--f-sans)' };
  const req = <span style={{ color: 'var(--wine-text)', fontWeight: 800 }}>*</span>;
  const chip = (label, on, onClick) => (
    <button key={label} type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'), background: on ? 'var(--wine-tint)' : 'var(--bg-surface)', color: on ? 'var(--wine-text)' : 'var(--ink-soft)', font: '700 12.5px/1 var(--f-sans)', cursor: 'pointer' }}>{label}</button>);

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(11,20,40,0.6)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-base)', borderRadius: 'var(--r-lg)', width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-base)', zIndex: 1 }}>
          <div>
            <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)' }}>Crear proveedor</div>
            <div style={{ font: '500 11.5px/1.35 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Solo se agrega a tu lista — no registra ninguna compra.</div>
          </div>
          <button onClick={onCancel} aria-label="Cerrar" style={{ background: 'none', border: 0, color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 22 }}>
          <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>Estos datos son para <b style={{ color: 'var(--ink)' }}>tu control</b>: te ayudan a reconocer y organizar a este proveedor. Los campos con {req} son obligatorios.</p>
          <label style={lblS}>Nombre del proveedor {req}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del proveedor" style={{ ...inS, marginBottom: dup ? 6 : 12, borderColor: dup ? 'var(--danger)' : 'var(--border)' }} />
          {dup && <p style={{ font: '600 11px/1.4 var(--f-sans)', color: 'var(--danger)', margin: '0 0 12px', display: 'flex', gap: 6, alignItems: 'center' }}>{I.info(12)} Ya tienes un proveedor con ese nombre.</p>}
          <label style={lblS}>Teléfono <span style={optS}>· opcional · agiliza la logística</span></label>
          <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
            <select value={code} onChange={(e) => setCode(e.target.value)} aria-label="Código de país" style={{ appearance: 'none', WebkitAppearance: 'none', border: 0, outline: 0, backgroundColor: 'var(--bg-elevated)', color: 'var(--wine-text)', font: '700 13px/1 var(--f-mono)', padding: '0 24px 0 12px', cursor: 'pointer', borderRight: '1px solid var(--border)', backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%237F0F1A' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
              {_PHONE_CODES.map((o) => <option key={o.c} value={o.dial}>{o.c} {o.dial}</option>)}
            </select>
            <input value={digits} onChange={(e) => onPhone(e.target.value)} inputMode="tel" placeholder="138 0000 0000" style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', font: '600 13.5px/1.4 var(--f-mono)', color: 'var(--ink)', padding: '12px' }} />
          </div>
          {(wxOpen || shot) ?
          <div style={{ marginTop: 12 }}>
            <label style={lblS}>WeChat <span style={optS}>· opcional (ID o QR)</span></label>
            {shot ?
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--success)', background: 'var(--success-bg)', borderRadius: 'var(--r-md)' }}>
              <img src={shot} alt="WeChat" style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
              <span style={{ flex: 1, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--success)' }}>Captura de WeChat cargada</span>
              <button type="button" onClick={() => setShot(null)} style={{ background: 'none', border: 0, color: 'var(--wine-text)', cursor: 'pointer', font: '600 12px/1 var(--f-sans)', display: 'inline-flex', gap: 5, alignItems: 'center' }}>{I.trash ? I.trash(12) : null} Quitar</button>
            </div>
            :
            <div onClick={() => shotRef.current && shotRef.current.click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readShot(f); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 16px', borderRadius: 'var(--r-md)', border: '2px dashed ' + (dragOver ? 'var(--wine)' : 'var(--border-strong)'), background: dragOver ? 'var(--wine-tint)' : 'var(--bg-surface)', cursor: 'pointer', textAlign: 'center' }}>
              <span style={{ color: 'var(--wine-text)', display: 'flex' }}>{I.camera(20)}</span>
              <span style={{ font: '700 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Sube el ID o QR de WeChat</span>
              <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>Foto o captura · PNG/JPG</span>
            </div>}
            <input ref={shotRef} type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) readShot(f); }} style={{ display: 'none' }} />
          </div>
          :
          <button type="button" onClick={() => setWxOpen(true)} style={{ marginTop: 10, background: 'none', border: 0, padding: 0, color: 'var(--wine-text)', font: '700 12px/1 var(--f-sans)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{I.plus(12)} Agregar WeChat <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>· opcional</span></button>}
          <div style={{ marginTop: 14 }}>
            <label style={lblS}>¿Qué vende? {req}</label>
            <input value={sells} onChange={(e) => setSells(e.target.value)} placeholder="Ej. calzado deportivo, iluminación LED…" style={inS} />
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={lblS}>¿De dónde lo sacaste? {req}</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Alibaba', '1688', 'Feria (Cantón)', 'Me lo recomendaron', 'Otro'].map((o) => chip(o, origin === o, () => setOrigin(o)))}
            </div>
            {needNote &&
            <input value={originNote} onChange={(e) => setOriginNote(e.target.value)} placeholder={origin === 'Me lo recomendaron' ? '¿Quién te lo recomendó?' : '¿Dónde lo encontraste?'} style={{ ...inS, marginTop: 8 }} />}
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={lblS}>¿Ya le habías comprado? {req}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {chip('Primera vez', history === 'nuevo', () => setHistory('nuevo'))}
              {chip('Ya le compraba', history === 'previo', () => setHistory('previo'))}
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={lblS}>Nota del proveedor <span style={optS}>· opcional · queda en su perfil</span></label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: tiene buen precio, responde rápido por WeChat, me lo presentó Juan…" rows={2} style={{ ...inS, resize: 'vertical' }} />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: 'var(--bg-base)' }}>
          <U.Btn variant="ghost" onClick={onCancel}>Cancelar</U.Btn>
          <button type="button" disabled={!ok} onClick={create} style={{ height: 40, padding: '0 18px', border: 0, borderRadius: 'var(--r-md)', background: ok ? 'var(--wine)' : 'var(--bg-elevated)', color: ok ? '#fff' : 'var(--ink-mute)', font: '800 13px/1 var(--f-sans)', cursor: ok ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', gap: 8 }}>{I.check(14)} Crear proveedor</button>
        </div>
      </div>
    </div>);

}

function SupplierTrackingDemo({ base }) {
  const I = window.Icon;
  const [sel, setSel] = pUseState(1);
  const purchases = [
    { ord: 1, cont: 'DTDU-418820', tone: 'success', estado: 'Entregado', meta: 'Recibida · ago 2025', pct: 100 },
    { ord: 2, cont: 'DTDU-472816', tone: 'info', estado: 'En tránsito', meta: 'En el mar · llega 12 jun 2026', pct: 58 },
    { ord: 3, cont: null, tone: 'warning', estado: 'En bodega CN', meta: 'Esperando consolidación', pct: 22 },
  ];
  const TONE = { success: 'var(--success)', info: 'var(--info)', warning: 'var(--warning)' };
  const p = purchases[sel];
  const parts = base.split('-');
  const seg = (val, label, active) => (
    <div style={{ flex: '1 1 0', minWidth: 52, textAlign: 'center', padding: '8px 6px', borderRadius: 'var(--r-sm)', background: active ? 'var(--wine-tint)' : 'var(--bg-surface)', border: '1px solid ' + (active ? 'var(--wine)' : 'var(--border)') }}>
      <div style={{ font: '800 15px/1 var(--f-mono)', color: active ? 'var(--wine-text)' : 'var(--ink)' }}>{val}</div>
      <div style={{ font: '700 8px/1.2 var(--f-sans)', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginTop: 5 }}>{label}</div>
    </div>);
  const dash = <span style={{ color: 'var(--ink-mute)', font: '800 14px/1 var(--f-mono)' }}>-</span>;
  return (
    <div style={{ marginTop: 14, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-base)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: 'var(--wine-text)', display: 'flex' }}>{(I.radar || I.info)(15)}</span>
        <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>Seguimiento por compra</div>
      </div>
      <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 12px' }}>El código no solo dice el proveedor: su última parte identifica <b style={{ color: 'var(--ink)' }}>cada compra</b>. Así sabes en qué contenedor viene cada pedido, aunque le compres varias veces al mismo proveedor.</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        {seg(parts[0], 'empresa', false)}{dash}{seg(parts[1], 'tu cliente', false)}{dash}{seg(parts[2], 'proveedor', false)}{dash}{seg(String(p.ord).padStart(2, '0'), 'compra', true)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {purchases.map((x, i) =>
        <button key={x.ord} type="button" onClick={() => setSel(i)} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (i === sel ? 'var(--wine)' : 'var(--border)'), background: i === sel ? 'var(--wine-tint)' : 'var(--bg-surface)', cursor: 'pointer' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE[x.tone] }}></span>
          <span style={{ font: '700 12px/1 var(--f-sans)', color: i === sel ? 'var(--wine-text)' : 'var(--ink)' }}>Compra {String(x.ord).padStart(2, '0')}</span>
        </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div style={{ flex: '1 1 140px', minWidth: 0 }}>
          <div style={{ font: '700 8px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 5 }}>Contenedor</div>
          <div style={{ font: '800 13px/1 var(--f-mono)', color: p.cont ? 'var(--ink)' : 'var(--ink-soft)' }}>{p.cont || 'Por asignar'}</div>
        </div>
        <div style={{ flex: '1 1 110px', minWidth: 0 }}>
          <div style={{ font: '700 8px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 5 }}>Estado</div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '700 11.5px/1 var(--f-sans)', color: 'var(--ink)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: TONE[p.tone] }}></span>{p.estado}</span>
        </div>
        <div style={{ flex: '2 1 170px', minWidth: 0 }}>
          <div style={{ font: '700 8px/1.3 var(--f-sans)', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>{p.meta}</div>
          <div style={{ height: 6, borderRadius: 'var(--r-pill)', background: 'var(--bg-elevated)', overflow: 'hidden' }}><div style={{ width: p.pct + '%', height: '100%', background: 'var(--grad-wine)', borderRadius: 'var(--r-pill)', transition: 'width .4s var(--ease)' }}></div></div>
        </div>
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

// Servicios de la llegada (§4): se piden DENTRO de la pre-alerta, una vez
// definida la compra/proveedor — así el sistema ya sabe a qué compra atarlos.
// Los 5 servicios de la llegada · independientes entre sí (Validación e Inspección
// ya NO se atan). Único atado: HOLD → Re-Empaque, vía checkbox «este HOLD implica
// reempaque» dentro de la propia tarjeta de HOLD.
const _ADDONS_LLEGADA = [
  { k: 'validacion', nm: 'Validación · verifica y valida al recibir', ds: 'Contamos tu compra contra tu factura o packing list y te enviamos fotos.', vid: 'have', line: 'Cuando llegue a bodega, cuéntenla contra mi factura y envíenme fotos.' },
  { k: 'inspeccion', nm: 'Inspección de calidad al recibir', ds: 'Sacamos una pieza por artículo, la abrimos y hacemos una revisión técnica — tú nos dices qué revisar.', vid: 'have', line: 'Además, saquen una pieza por artículo y hagan una revisión técnica de calidad, según mis instrucciones.' },
  { k: 'etiquetado', nm: 'Etiquetado de piezas', ds: 'Código de barras con tu arte o etiqueta física en cada pieza — lista para vender.', vid: 'soon', line: 'Pónganle a cada pieza su etiqueta o código de barras — que llegue lista para vender.' },
  { k: 'hold', nm: 'HOLD — retener para consolidar', ds: 'Tu carga espera en bodega y viaja junto a tu próxima compra, en el mismo contenedor.', vid: 'have', line: '' },
  { k: 'reempaque', nm: 'Re-Empaque', ds: 'Unificamos tus compras pequeñas de Alibaba en un solo packing list.', vid: 'soon', line: 'Únanme mis compras pequeñas en un solo packing list.' },
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
  const [open, setOpen] = pUseState(false);
  // Ficha del proveedor nuevo
  const [newCode, setNewCode] = pUseState('+86');
  const [newDigits, setNewDigits] = pUseState('');
  const [wxOpen, setWxOpen] = pUseState(false);
  const [shot, setShot] = pUseState(null);
  const [dragOver, setDragOver] = pUseState(false);
  const shotRef = React.useRef(null);
  const [sells, setSells] = pUseState('');
  const [origin, setOrigin] = pUseState('');
  const [originNote, setOriginNote] = pUseState('');
  const [history, setHistory] = pUseState('');
  const [commMethod, setCommMethod] = pUseState('');
  const [provNote, setProvNote] = pUseState('');
  const [provSaved, setProvSaved] = pUseState(false);
  // Comentario de la compra + registro
  const [note, setNote] = pUseState('');
  const [addons, setAddons] = pUseState({});
  const [addonNotes, setAddonNotes] = pUseState({});
  const [holdCount, setHoldCount] = pUseState(2);
  const [holdTie, setHoldTie] = pUseState(false);
  const [extrasOpen, setExtrasOpen] = pUseState(false);
  const [playingKey, setPlayingKey] = pUseState(null);
  const [reempaqueNoteOpen, setReempaqueNoteOpen] = pUseState(false);
  const [registered, setRegistered] = pUseState(null);
  const [submitting, setSubmitting] = pUseState(false);
  // Post-registro · detalle / adjuntos / packing list
  const [linkCopied, setLinkCopied] = pUseState(false);
  const [isWide, setIsWide] = pUseState(typeof window !== 'undefined' ? window.innerWidth >= 860 : true);
  const [wideForm, setWideForm] = pUseState(typeof window !== 'undefined' ? window.innerWidth >= 960 : true);
  const [moreOpen, setMoreOpen] = pUseState(false);
  const [desc, setDesc] = pUseState('');
  const [cajas, setCajas] = pUseState(1);
  const [valor, setValor] = pUseState('');
  const [tracking, setTracking] = pUseState('');
  const [docs, setDocs] = pUseState({ packing: false, factura: false, fotos: false });
  const [docNames, setDocNames] = pUseState({});
  const [dragKey, setDragKey] = pUseState(null);
  const [touched, setTouched] = pUseState({});
  const [lastTouched, setLastTouched] = pUseState(null);
  const touch = (field) => { setTouched((t) => ({ ...t, [field]: true })); setLastTouched({ field, t: Date.now() }); setRegSummaryOpen(true); };
  React.useEffect(() => {
    if (!lastTouched) return;
    const id = setTimeout(() => setLastTouched((lt) => (lt && lt.t === lastTouched.t ? null : lt)), 1400);
    return () => clearTimeout(id);
  }, [lastTouched]);
  const sumRowStyle = (f) => ({ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 7px', borderRadius: 'var(--r-sm)', background: lastTouched && lastTouched.field === f ? 'var(--warning-bg)' : 'transparent', transition: 'background .6s ease' });
  const fmtUSD = (raw) => { if (!raw) return ''; const [i, d] = String(raw).split('.'); const c = i.replace(/\B(?=(\d{3})+(?!\d))/g, ','); return d !== undefined ? `${c}.${d}` : c; };
  const packingRef = React.useRef(null); const facturaRef = React.useRef(null); const fotosRef = React.useRef(null);
  React.useEffect(() => { const f = () => setIsWide(window.innerWidth >= 860); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  React.useEffect(() => { const f = () => setWideForm(window.innerWidth >= 960); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);

  const qraw = query.trim();
  const q = qraw.toLowerCase();
  const filtered = suppliers.filter((s) => s.name.toLowerCase().includes(q));
  const existingSel = suppliers.find((s) => s.name.toLowerCase() === q) || null;
  const isNew = !existingSel && qraw.length > 0;
  const active = !!existingSel || isNew;
  const chipList = existingSel ? suppliers.filter((s) => s.n !== existingSel.n) : (q.length > 0 ? filtered : suppliers);
  const needNote = origin === 'Me lo recomendaron' || origin === 'Otro';
  const newReqOk = sells.trim() && !!origin && !!history && (needNote ? originNote.trim() : true);
  const provOk = active && (!isNew || provSaved);
  const nextN = existingSel ? existingSel.n : suppliers.length + 1;
  const nextOrder = existingSel ? existingSel.orders + 1 : 1;
  const previewCode = active ? `${PREFIX}-${clientNo}-${nextN}-${nextOrder}` : null;

  const provLink = (code) => 'packlist/Packing List + Factura · DTD-Cargo.html?embed=1&order=' + encodeURIComponent(code) + '&mb=' + encodeURIComponent(me.markbox || '') + '&cliente=' + encodeURIComponent(me.name || '') + (existingSel ? '&proveedor=' + encodeURIComponent(existingSel.name) : '') + (cajas ? '&cajas=' + encodeURIComponent(cajas) : '') + (valor ? '&valor=' + encodeURIComponent(fmtUSD(valor)) : '') + (desc.trim() ? '&desc=' + encodeURIComponent(desc.trim()) : '');
  const copyLink = (code) => { try { navigator.clipboard?.writeText('Hola, por favor completa el Packing List + Factura de mi compra DTD-Cargo (código ' + code + '): ' + provLink(code)); } catch (e) {} setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); };
  const readShot = (f) => { const r = new FileReader(); r.onload = () => setShot(r.result); r.readAsDataURL(f); };
  const onPhone = (raw) => {
    const s = String(raw);
    if (s.trim().startsWith('+')) {
      const cleaned = '+' + s.trim().slice(1).replace(/[^\d]/g, '');
      const match = _PHONE_CODES.map((o) => o.dial).filter((d) => cleaned.startsWith(d)).sort((a, b) => b.length - a.length)[0];
      if (match) { setNewCode(match); setNewDigits(cleaned.slice(match.length)); return; }
    }
    setNewDigits(s.replace(/[^\d]/g, ''));
  };
  const submit = () => {
    if (!provOk || submitting) return;
    setSubmitting(true);
    setTimeout(() => { setRegistered(previewCode); setSubmitting(false); }, 2350);
  };


  const lblS = { display: 'block', font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 7 };
  const optS = { textTransform: 'none', letterSpacing: 0, color: 'var(--ink-soft)', fontWeight: 600 };
  const inS = { width: '100%', padding: '12px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 14px/1.4 var(--f-sans)' };
  const req = <span style={{ color: 'var(--wine-text)', fontWeight: 800 }}>*</span>;
  const chip = (label, on, onClick) => (
    <button key={label} type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 'var(--r-pill)', border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'), background: on ? 'var(--wine-tint)' : 'var(--bg-surface)', color: on ? 'var(--wine-text)' : 'var(--ink-soft)', font: '700 12.5px/1 var(--f-sans)', cursor: 'pointer' }}>{label}</button>);
  const lblEtiquetaQR = (seed) => {
    const m = 11; const cell = 100 / m; let r = '';
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
      if (Math.abs(x - m / 2) < 2 && Math.abs(y - m / 2) < 2) continue;
      if (Math.sin((x * 7 + y * 13 + seed) * 1.7) + 1 > 1.05) r += `<rect x="${x * cell}" y="${y * cell}" width="${cell * 0.92}" height="${cell * 0.92}" fill="#0F1E3D"/>`;
    }
    [[0, 0], [m - 7, 0], [0, m - 7]].forEach(([cx, cy]) => { r += `<rect x="${cx * cell}" y="${cy * cell}" width="${cell * 7}" height="${cell * 7}" fill="none" stroke="#7F0F1A" stroke-width="${cell}"/><rect x="${(cx + 2) * cell}" y="${(cy + 2) * cell}" width="${cell * 3}" height="${cell * 3}" fill="#7F0F1A"/>`; });
    return r;
  };
  const dropBox = (k, label, ref) => {
    const filled = !!docs[k];
    const over = dragKey === k;
    return (
      <div key={k} onClick={() => ref.current && ref.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragKey(k); }} onDragLeave={() => setDragKey((d) => d === k ? null : d)}
        onDrop={(e) => { e.preventDefault(); setDragKey(null); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { setDocs((d) => ({ ...d, [k]: true })); setDocNames((n) => ({ ...n, [k]: f.name })); touch(k); } }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, textAlign: 'center', minHeight: 104, padding: '14px 8px', borderRadius: 'var(--r-md)', cursor: 'pointer', border: '2px dashed ' + (filled ? 'var(--success)' : (over ? 'var(--wine)' : 'var(--border-strong)')), background: filled ? 'var(--success-bg)' : (over ? 'var(--wine-tint)' : 'var(--bg-surface)') }}>
        <input ref={ref} type="file" accept="image/*,.pdf" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) { setDocs((d) => ({ ...d, [k]: true })); setDocNames((n) => ({ ...n, [k]: f.name })); touch(k); } }} style={{ display: 'none' }} />
        <span style={{ color: filled ? 'var(--success)' : 'var(--wine-text)', display: 'flex' }}>{filled ? I.check(17) : I.upload(17)}</span>
        <span style={{ font: '700 11.5px/1.25 var(--f-sans)', color: 'var(--ink)' }}>{label}</span>
        <span style={{ font: '600 10px/1.3 var(--f-sans)', color: filled ? 'var(--success)' : 'var(--ink-soft)', wordBreak: 'break-all', padding: '0 2px' }}>{filled ? (docNames[k] || 'Cargado') : 'Arrastra o toca'}</span>
      </div>);
  };
  const stepBtnS = { width: 28, height: 28, borderRadius: 'var(--r-sm)', border: '1.5px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '800 16px/1 var(--f-sans)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const autoGrow = (e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; };
  const holdLine = (n) => n <= 2 ? 'Retengan mi carga en bodega y unifíquenla con la próxima compra que llegue (2 en total).' : `Retengan mi carga en bodega y esperen hasta que lleguen ${n} compras en total antes de autorizar el despacho.`;
  const orderLineFor = (s) => {
    if (s.k === 'hold') return holdLine(holdCount);
    if (s.k === 'reempaque' && holdTie) return `Reempaque de las ${holdCount} compras que estoy consolidando en el HOLD.`;
    return s.line;
  };
  const toggleAddon = (k) => {
    const wasHoldOn = k === 'hold' && addons.hold;
    setAddons((a) => { const on = !a[k]; const next = { ...a, [k]: on }; if (k === 'hold' && !on && holdTie) next.reempaque = false; return next; });
    if (wasHoldOn && holdTie) setHoldTie(false);
  };
  const orderLines = _ADDONS_LLEGADA.filter((s) => addons[s.k]).map((s) => ({ desc: orderLineFor(s), fee: 'Esto lo cotiza y coordina mi asesor.' }));
  const wechatBlock = (shot ?
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--success)', background: 'var(--success-bg)', borderRadius: 'var(--r-md)' }}>
      <img src={shot} alt="WeChat" style={{ width: 44, height: 44, borderRadius: 'var(--r-sm)', objectFit: 'cover', flexShrink: 0 }} />
      <span style={{ flex: 1, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--success)' }}>Captura de WeChat cargada</span>
      <button type="button" onClick={() => setShot(null)} style={{ background: 'none', border: 0, color: 'var(--wine-text)', cursor: 'pointer', font: '600 12px/1 var(--f-sans)', display: 'inline-flex', gap: 5, alignItems: 'center' }}>{I.trash ? I.trash(12) : null} Quitar</button>
    </div>
    :
    <div onClick={() => shotRef.current && shotRef.current.click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readShot(f); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '18px 16px', borderRadius: 'var(--r-md)', border: '2px dashed ' + (dragOver ? 'var(--wine)' : 'var(--border-strong)'), background: dragOver ? 'var(--wine-tint)' : 'var(--bg-surface)', cursor: 'pointer', textAlign: 'center' }}>
      <span style={{ color: 'var(--wine-text)', display: 'flex' }}>{I.camera(20)}</span>
      <span style={{ font: '700 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>Sube el ID o QR de WeChat</span>
      <span style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>Foto o captura · PNG/JPG</span>
    </div>);

  const [regSummaryOpen, setRegSummaryOpen] = pUseState(false);
  const [postPhase, setPostPhase] = pUseState('docs');
  const [advancing, setAdvancing] = pUseState(false);
  const [refOpen, setRefOpen] = pUseState(true);
  const goToConfirm = () => { if (advancing) return; setAdvancing(true); setTimeout(() => { setPostPhase('confirm'); setAdvancing(false); }, 1680); };
  const stepBar = (step) => {
    const items = [
      { n: 1, t: 'Controla tus proveedores', d: 'De dónde salió cada proveedor.' },
      { n: 2, t: 'Sigue tus compras', d: 'Llena el detalle de tu compra.' },
      { n: 3, t: 'Trazabilidad a tu logística', d: 'Sigue tu envío de punta a punta.' },
    ];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 22 }}>
        {items.map((it) => {
          const active = it.n === step;
          return (
            <div key={it.n} style={{ opacity: active ? 1 : .4, transition: 'opacity .25s' }}>
              <div style={{ font: '900 40px/1 var(--f-display)', color: active ? 'var(--wine)' : 'var(--ink-mute)', letterSpacing: '-0.02em' }}>{it.n}</div>
              <div style={{ font: '800 14.5px/1.25 var(--f-sans)', color: active ? 'var(--ink)' : 'var(--ink-soft)', marginTop: 5 }}>{it.t}</div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{it.d}</div>
              <div style={{ height: 3, borderRadius: 2, background: active ? 'var(--wine)' : 'var(--border)', marginTop: 10 }}></div>
            </div>
          );
        })}
      </div>
    );
  };
  if (registered) {
    const summaryPanel = (
      <div style={wideForm ? { position: 'sticky', top: 'calc(var(--topbar-h) + 16px)' } : { marginTop: 'var(--s-5)' }}>
          <button type="button" onClick={() => setRegSummaryOpen((v) => !v)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-lg)', cursor: 'pointer' }}>
            <span style={{ color: 'var(--success)', display: 'flex', flexShrink: 0 }}>{I.check(20)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '800 15px/1.2 var(--f-display)', color: 'var(--ink)' }}>Pre-alerta registrada</div>
              <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Código <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--wine-text)' }}>{registered}</code></div>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, font: '800 12px/1 var(--f-sans)', color: 'var(--wine-text)', background: 'var(--bg-surface)', border: '1px solid var(--wine)', borderRadius: 999, padding: '7px 12px' }}>
              <span>{regSummaryOpen ? 'Ocultar' : 'Revisa aquí'}</span>
              <span style={{ display: 'flex', transform: regSummaryOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{I.chevD(13)}</span>
            </span>
          </button>
          {regSummaryOpen && <div style={{ border: '1.5px solid var(--wine)', borderRadius: 'var(--r-lg)', background: 'var(--wine-tint)', padding: '13px 15px', marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: '800 9.5px/1 var(--f-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--wine-text)', marginBottom: 7 }}>{I.doc(13)}Resumen de tu orden</div>
            <div style={{ font: '600 13px/1.6 var(--f-sans)', color: 'var(--ink)' }}>
              <p style={{ margin: orderLines.length > 0 ? '0 0 8px' : 0 }}>Hola, DTD Cargo. Te aviso que viene mercancía de mi proveedor <b>{existingSel ? existingSel.name : (qraw || 'mi proveedor')}</b> para ser enviada por barco. Compártelo con tu proveedor para que anote el código en cada caja.</p>
              {orderLines.length > 0 && <>
              <p style={{ fontWeight: 800, margin: '0 0 7px' }}>Aparte, pedí:</p>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {orderLines.map((l, i) => <li key={i} style={{ font: '600 12.5px/1.5 var(--f-sans)' }}><b>{l.desc}</b><i style={{ fontStyle: 'normal', color: 'var(--ink-soft)', fontWeight: 500, display: 'block', marginTop: 2 }}>{l.fee}</i></li>)}
              </ol>
              </>}
              {(touched.desc || touched.cajas || touched.valor) && <>
              <p style={{ fontWeight: 800, margin: '10px 0 7px' }}>Datos de tu compra:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
                {touched.desc && desc.trim() && <div style={sumRowStyle('desc')}><span style={{ font: '600 12.5px/1.4 var(--f-sans)' }}>Descripción: <b>{desc}</b></span></div>}
                {touched.cajas && <div style={sumRowStyle('cajas')}><span style={{ font: '600 12.5px/1.4 var(--f-sans)' }}>Cantidad de cajas: <b>{cajas}</b></span></div>}
                {touched.valor && valor.trim() && <div style={sumRowStyle('valor')}><span style={{ font: '600 12.5px/1.4 var(--f-sans)' }}>Valor estimado: <b>${fmtUSD(valor)}</b></span></div>}
              </div>
              </>}
              <p style={{ fontWeight: 800, margin: '10px 0 7px' }}>Checklist:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[['tracking', 'Tracking China', !!tracking.trim()], ['packing', 'Packing List', !!docs.packing], ['factura', 'Factura del proveedor', !!docs.factura], ['fotos', 'Fotos del producto', !!docs.fotos]].map(([k, label, ok]) => (
                  <div key={k} style={sumRowStyle(k)}>
                    <span style={{ color: ok ? 'var(--success)' : 'var(--ink-mute)', display: 'flex', flexShrink: 0 }}>{ok ? I.check(14) : <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid var(--border-strong)', display: 'block' }}></span>}</span>
                    <span style={{ font: '600 12.5px/1.3 var(--f-sans)', color: ok ? 'var(--ink)' : 'var(--ink-soft)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>}
          {postPhase === 'docs'
            ? <button onClick={goToConfirm} disabled={advancing} className={'pcb pcb--wine pcb--nav' + (advancing ? ' go' : '')} style={{ width: '100%', marginTop: 12 }}>
                <span className="pcl pcl-def">Avanzar al paso 3 {I.arrowR(14)}</span>
                <span className="pcl pcl-ok"><svg className="ck" viewBox="0 0 12 10"><polyline points="1.5 6 4.5 9 10.5 1"></polyline></svg>¡Vamos al paso 3!</span>
                <span className="pct" aria-hidden="true"><span className="pct-box"></span><span className="pct-veh"><span className="pct-body"></span><span className="pct-cab"><span className="pct-win"></span></span><span className="pct-wheel pct-wheel1"></span><span className="pct-wheel pct-wheel2"></span></span></span>
              </button>
            : <U.Btn variant="secondary" full style={{ marginTop: 12 }} onClick={() => setView('shipments')}>Listo · ver mis envíos</U.Btn>}
      </div>
    );

    if (postPhase === 'confirm') {
      return (
        <div>
          <button onClick={() => setPostPhase('docs')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14, background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Volver</button>
          <div style={{ marginBottom: 'var(--s-5)' }}>
            {stepBar(3)}
            <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Paso 3: Confirmación</div>
          </div>
          <div style={wideForm ? { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, alignItems: 'start', maxWidth: 1002 } : { display: 'block' }}>
          <div style={{ minWidth: 0 }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--s-6)', maxWidth: wideForm ? 'none' : 680 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ width: 30, height: 30, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine-text)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>{I.doc(15)}</span>
              <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Que tu proveedor lo confirme</div>
            </div>
            <p style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 16px' }}>Así tu proveedor te envía la mercancía <b>bien identificada, sin retrasos</b>.</p>

            <div style={{ font: '800 11px/1 var(--f-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--wine-text)', margin: '0 0 10px' }}>Tus pasos · seguimiento con tu proveedor</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, font: '800 11px/1 var(--f-mono)' }}>1</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: '600 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', margin: 0 }}>Copia el link y envíaselo por chat a tu proveedor.</p>
                  <button onClick={() => copyLink(registered)} className={'pcb pcb--navy pcb--copy' + (linkCopied ? ' go' : '')} style={{ marginTop: 8 }}>
                    <span className="pcl pcl-def">{I.copy(14)}Copiar link para el proveedor</span>
                    <span className="pcl pcl-ok"><svg className="ck" viewBox="0 0 12 10"><polyline points="1.5 6 4.5 9 10.5 1"></polyline></svg>Link copiado</span>
                    <span className="pcp" aria-hidden="true"><span className="pcp-cb"></span><svg className="pcp-ck" viewBox="0 0 12 10"><polyline points="1.5 6 4.5 9 10.5 1"></polyline></svg></span>
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, font: '800 11px/1 var(--f-mono)' }}>2</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ font: '600 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', margin: 0 }}>Hazle seguimiento para asegurarte de que tu proveedor cumpla con lo siguiente:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6, paddingLeft: 2 }}>
                    <span style={{ font: '600 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}><b style={{ color: 'var(--ink)' }}>a.</b> Que llene este formulario.</span>
                    <span style={{ font: '600 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}><b style={{ color: 'var(--ink)' }}>b.</b> Que ponga en las cajas las etiquetas que están en este formulario o en este link.</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ font: '800 11px/1 var(--f-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', margin: '0 0 10px' }}>Tu proveedor · sus confirmaciones</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Abre el link y llena los datos.',
                'Sube su factura final, su packing list final y las fotos del producto terminado.',
                'Nos envía el producto.',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-elevated)', color: 'var(--ink-soft)', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, font: '800 11px/1 var(--f-mono)' }}>{i + 1}</span>
                  <p style={{ font: '600 12.5px/1.5 var(--f-sans)', color: 'var(--ink)', margin: 0, paddingTop: 1 }}>{t}</p>
                </div>
              ))}
            </div>

            <button type="button" onClick={() => setRefOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px dashed var(--border)', background: 'none', border: 0, borderTopStyle: 'dashed', borderTopWidth: 1, borderTopColor: 'var(--border)', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ font: '800 11px/1 var(--f-mono)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Así se ve lo que recibe tu proveedor</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, font: '700 11px/1 var(--f-sans)', color: 'var(--wine-text)' }}>{refOpen ? 'Achicar' : 'Ver ejemplo'}<span style={{ display: 'flex', transform: refOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{I.chevD(13)}</span></span>
            </button>
            {refOpen && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
              <div>
                <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#fff', border: '1px solid var(--border-strong)', padding: 9, display: 'flex', flexDirection: 'column', gap: 5, fontFamily: 'var(--f-mono)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--wine)', paddingBottom: 4 }}>
                    <span style={{ font: '800 7px/1 var(--f-sans)', color: 'var(--wine)' }}>PACKING LIST + FACTURA</span>
                    <span style={{ font: '700 6px/1 var(--f-mono)', color: '#9B9B9B' }}>{registered || 'DTD-XXXX'}</span>
                  </div>
                  {[['Artículo', 'Cant.', 'Precio'], ['Lote A', touched.cajas ? cajas : '—', '$'], ['Lote B', '—', '$']].map((row, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 4, font: (i === 0 ? '700 6.5px/1.3' : '500 6.5px/1.3') + ' var(--f-sans)', color: i === 0 ? '#9B9B9B' : 'var(--ink)', letterSpacing: i === 0 ? '.04em' : 0, textTransform: i === 0 ? 'uppercase' : 'none' }}>
                      <span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span>
                    </div>
                  ))}
                  <div style={{ marginTop: 'auto', paddingTop: 5, borderTop: '1px solid var(--border-strong)', display: 'flex', justifyContent: 'space-between', font: '800 6.5px/1 var(--f-sans)', color: 'var(--wine)' }}><span>TOTAL</span><span>$ —</span></div>
                </div>
                <p style={{ font: '600 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', margin: '6px 0 0', textAlign: 'center' }}>Esto es lo que debe recibir tu proveedor</p>
              </div>
              <div>
                <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 'var(--r-md)', overflow: 'hidden', background: '#fff', border: '1px solid var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 10 }}>
                  <div style={{ border: '1px solid var(--border-strong)', borderRadius: 'var(--r-sm)', padding: 10, background: '#fff', textAlign: 'center', width: 130 }}>
                    <div style={{ font: '700 7px/1 var(--f-sans)', color: '#9B9B9B', letterSpacing: '0.14em', textTransform: 'uppercase' }}>SHIPPING TO DTD-CARGO</div>
                    <svg viewBox="0 0 100 100" style={{ width: 64, height: 64, margin: '6px auto', display: 'block' }} dangerouslySetInnerHTML={{ __html: lblEtiquetaQR(1) }} />
                    <code style={{ font: '800 12px/1 var(--f-mono)', color: '#0F1E3D' }}>{registered || me.markbox || 'DTD-XXXX'}</code>
                    <div style={{ font: '700 10px/1 var(--f-mono)', color: '#7F0F1A', marginTop: 3 }}>Caja 1 / {touched.cajas ? cajas : 'N'}</div>
                    <div style={{ font: '500 8px/1.2 var(--f-sans)', color: '#6B6B6B', marginTop: 2 }}>{me.name}</div>
                  </div>
                </div>
                <p style={{ font: '600 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', margin: '6px 0 0', textAlign: 'center' }}>Estas son las etiquetas que va a recibir tu proveedor</p>
              </div>
            </div>}

          </div>
          </div>

          {summaryPanel}
          </div>
        </div>);
    }

    return (
      <div>
        <button onClick={() => setView('shipments')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14, background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Volver a Alertas · mis envíos</button>
        <div style={wideForm ? { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, alignItems: 'start', maxWidth: 1002 } : { display: 'block' }}>
        <div style={{ minWidth: 0 }}>
        <div style={{ marginBottom: 'var(--s-5)' }}>
          {stepBar(2)}
          <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Paso 2: Documentación</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--s-6)', maxWidth: wideForm ? 'none' : 680 }}>
          <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)', marginBottom: 4 }}>Adelanta lo que ya sabes</div>
          <p style={{ font: '500 12px/1.55 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>Por si nos atoramos con tu proveedor — no es obligatorio, pero ayuda a avanzar.</p>
            <div style={{ marginBottom: 'var(--s-5)' }}>
              <label style={lblS}>Descripción de la compra <span style={optS}>· opcional</span></label>
              <textarea value={desc} onChange={(e) => { setDesc(e.target.value); touch('desc'); }} placeholder="Ej. 3 cajas de zapatos deportivos" rows={2} style={{ ...inS, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 'var(--s-5)' }}>
              <div>
                <label style={lblS}>Total de cajas / bultos</label>
                <input type="number" min="1" value={cajas} onChange={(e) => { setCajas(Math.max(1, parseInt(e.target.value) || 1)); touch('cajas'); }} style={inS} />
              </div>
              <div>
                <label style={lblS}>Valor estimado USD</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', font: '600 14px/1 var(--f-sans)', color: 'var(--ink-soft)', pointerEvents: 'none' }}>$</span>
                  <input inputMode="decimal" value={fmtUSD(valor)} onChange={(e) => { setValor(e.target.value.replace(/[^\d.]/g, '')); touch('valor'); }} placeholder="0" style={{ ...inS, paddingLeft: 25 }} />
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 'var(--s-5)' }}>
              <label style={lblS}>Tracking China</label>
              <input value={tracking} onChange={(e) => { setTracking(e.target.value); touch('tracking'); }} placeholder="Ej. SF1234567890" style={{ ...inS, fontFamily: 'var(--f-mono)' }} />
            </div>
            <label style={lblS}>Adjuntos <span style={optS}>· opcional</span></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {dropBox('packing', 'Packing List', packingRef)}
              {dropBox('factura', 'Factura del proveedor', facturaRef)}
              {dropBox('fotos', 'Fotos del producto', fotosRef)}
            </div>
        </div>
        </div>

        {summaryPanel}
        </div>
      </div>);
  }

  return (
    <div>
      <button onClick={() => setView('shipments')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14, background: 'none', border: 0, cursor: 'pointer' }}>{I.arrowL(12)} Volver a Alertas · mis envíos</button>
      {stepBar(1)}
      <div className="eyebrow eyebrow-wine" style={{ fontSize: 15.75 }}>NUEVA COMPRA · PREALERTA</div>


      <div style={(wideForm && provOk) ? { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, alignItems: 'start', maxWidth: 1002 } : { display: 'block' }}>
      <div style={{ minWidth: 0 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', padding: 'var(--s-6)', maxWidth: (wideForm && provOk) ? 'none' : 680 }}>
        <div style={{ font: '800 15px/1.2 var(--f-display)', color: 'var(--ink)', marginBottom: 14 }}>¿A quién le compras?</div>

        <div style={{ position: 'relative', marginBottom: 8 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', display: 'flex' }}>{I.search ? I.search(16) : null}</span>
            <input value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setOpen(false); } }} placeholder="Escribe el nombre de tu proveedor…" style={{ ...inS, paddingLeft: 38, paddingRight: 44 }} />
            <button type="button" aria-label="Ver mis proveedores" onMouseDown={(e) => { e.preventDefault(); setOpen(!open); }} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 'var(--r-sm)', border: 0, background: open ? 'var(--wine-tint)' : 'transparent', color: open ? 'var(--wine-text)' : 'var(--ink-soft)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><span style={{ display: 'flex', transform: open ? 'rotate(180deg)' : 'none' }}>{I.chevD(16)}</span></button>
          </div>
          {open && (q.length > 0 ? filtered : suppliers).length > 0 &&
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)', overflow: 'hidden', maxHeight: 250, overflowY: 'auto' }}>
            {q.length === 0 && <div style={{ padding: '9px 14px', font: '700 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--bg-elevated)' }}>Tus proveedores</div>}
            {(q.length > 0 ? filtered : suppliers).map((s) => (
              <button key={s.n} type="button" onMouseDown={(e) => { e.preventDefault(); setQuery(s.name); setOpen(false); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'none', border: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: 26, height: 26, borderRadius: 'var(--r-sm)', background: 'var(--wine-tint)', color: 'var(--wine-text)', display: 'grid', placeItems: 'center', font: '800 11px/1 var(--f-display)', flexShrink: 0 }}>#{s.n}</span>
                <span style={{ flex: 1, font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.name}</span>
                <span style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{s.orders} compra{s.orders > 1 ? 's' : ''}</span>
              </button>
            ))}
          </div>}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: active ? 16 : 4 }}>
          {chipList.length > 0 ? chipList.map((s) => (
            <button key={s.n} type="button" onClick={() => { setQuery(s.name); setOpen(false); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: '700 12px/1 var(--f-sans)', color: 'var(--ink)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: '7px 12px 7px 8px', cursor: 'pointer' }}>
              <span style={{ width: 20, height: 20, borderRadius: 6, background: 'var(--wine-tint)', color: 'var(--wine-text)', font: '800 10px/20px var(--f-display)', textAlign: 'center' }}>#{s.n}</span>
              {s.name} · {s.orders} compra{s.orders > 1 ? 's' : ''}
            </button>
          )) : (!existingSel && <span style={{ font: '600 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin coincidencias — se creará como proveedor nuevo</span>)}
        </div>

        {existingSel &&
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16 }}>
          <span style={{ color: 'var(--success)', flexShrink: 0, display: 'flex' }}>{I.check(18)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{existingSel.name}</div>
            <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Proveedor seleccionado · {existingSel.orders} compra{existingSel.orders > 1 ? 's' : ''} anterior{existingSel.orders > 1 ? 'es' : ''}</div>
          </div>
          <button type="button" onClick={() => { setQuery(''); setOpen(true); }} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine-text)', background: 'none', border: 0, cursor: 'pointer', flexShrink: 0 }}>Cambiar</button>
        </div>}

        {isNew && (provSaved ?
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 16 }}>
          <span style={{ color: 'var(--success)', flexShrink: 0, display: 'flex' }}>{I.check(18)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Proveedor guardado</div>
            <div style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{qraw}{newDigits ? ' · ' + newCode + ' ' + newDigits : ''}{sells ? ' · ' + sells : ''}</div>
          </div>
          <button type="button" onClick={() => setProvSaved(false)} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine-text)', background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', gap: 5, alignItems: 'center' }}>{I.edit(12)} Editar</button>
        </div>
        :
        <div style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 'var(--r-md)', padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}><span style={{ color: 'var(--ink)', display: 'flex' }}>{I.plus(14)}</span><span style={{ font: '700 10px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink)' }}>Proveedor nuevo</span></div>
          <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 12px' }}>Estos datos son para <b style={{ color: 'var(--ink)' }}>tu control</b>: te ayudan a reconocer y organizar a este proveedor cuando tengas varios. Los campos con {req} son obligatorios.</p>
          <label style={lblS}>Nombre del proveedor {req}</label>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nombre del proveedor" style={{ ...inS, marginBottom: 12 }} />
          <label style={lblS}>Teléfono <span style={optS}>· opcional · agiliza la logística</span></label>
          <div style={{ display: 'flex', alignItems: 'stretch', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', overflow: 'hidden' }}>
            <select value={newCode} onChange={(e) => setNewCode(e.target.value)} aria-label="Código de país" style={{ appearance: 'none', WebkitAppearance: 'none', border: 0, outline: 0, backgroundColor: 'var(--bg-elevated)', color: 'var(--wine-text)', font: '700 13px/1 var(--f-mono)', padding: '0 24px 0 12px', cursor: 'pointer', borderRight: '1px solid var(--border)', backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%237F0F1A' stroke-width='1.6' fill='none' stroke-linecap='round'/></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}>
              {_PHONE_CODES.map((o) => <option key={o.c} value={o.dial}>{o.c} {o.dial}</option>)}
            </select>
            <input value={newDigits} onChange={(e) => onPhone(e.target.value)} inputMode="tel" placeholder="138 0000 0000" style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', font: '600 13.5px/1.4 var(--f-mono)', color: 'var(--ink)', padding: '12px' }} />
          </div>
          <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '6px 0 0' }}>¿Lo compraste por Alibaba y no tienes su contacto directo? Déjalo en blanco y agrégalo cuando puedas — tener un contacto nos ayuda con la logística.</p>
          {(wxOpen || shot) ?
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ ...lblS, marginBottom: 0 }}>WeChat <span style={optS}>· opcional (ID o QR)</span></label>
              <button type="button" onClick={() => { setWxOpen(false); setShot(null); }} style={{ background: 'none', border: 0, padding: 0, color: 'var(--ink-soft)', font: '700 11px/1 var(--f-sans)', cursor: 'pointer' }}>Cerrar</button>
            </div>
            <div style={{ marginTop: 7 }}>{wechatBlock}</div>
            <input ref={shotRef} type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) readShot(f); }} style={{ display: 'none' }} />
          </div>
          :
          <button type="button" onClick={() => setWxOpen(true)} style={{ marginTop: 10, background: 'none', border: 0, padding: 0, color: 'var(--wine-text)', font: '700 12px/1 var(--f-sans)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>{I.plus(12)} Agregar WeChat <span style={{ color: 'var(--ink-soft)', fontWeight: 500 }}>· opcional</span></button>}
          <div style={{ marginTop: 14 }}>
            <label style={lblS}>¿Qué vende? {req}</label>
            <input value={sells} onChange={(e) => setSells(e.target.value)} placeholder="Ej. calzado deportivo, iluminación LED…" style={inS} />
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={lblS}>¿De dónde lo sacaste? {req}</label>
            <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 8px' }}>Con el tiempo te ayuda a recordar de dónde salió cada proveedor — información valiosa para ti.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {['Alibaba', '1688', 'Feria (Cantón)', 'Me lo recomendaron', 'Otro'].map((o) => chip(o, origin === o, () => setOrigin(o)))}
            </div>
            {needNote &&
            <input value={originNote} onChange={(e) => setOriginNote(e.target.value)} placeholder={origin === 'Me lo recomendaron' ? '¿Quién te lo recomendó?' : '¿Dónde lo encontraste?'} style={{ ...inS, marginTop: 8 }} />}
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={lblS}>¿Ya le habías comprado? {req}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {chip('Primera vez', history === 'nuevo', () => setHistory('nuevo'))}
              {chip('Ya le compraba', history === 'previo', () => setHistory('previo'))}
            </div>
            {history === 'previo' &&
            <div style={{ display: 'flex', gap: 8, marginTop: 8, padding: '9px 11px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)' }}>
              <span style={{ color: 'var(--info)', flexShrink: 0, display: 'flex', marginTop: 1 }}>{I.info(14)}</span>
              <span style={{ font: '500 11.5px/1.45 var(--f-sans)', color: 'var(--ink)' }}>Revisa que no tengas ya a este proveedor registrado arriba, para no duplicarlo. Puedes guardar igual.</span>
            </div>}
            {!!history && <div style={{ marginTop: 10 }}>
              <label style={lblS}>Método de comunicación actual con el proveedor <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 800, color: 'var(--danger)' }}>· obligatorio</span></label>
              <p style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 8px' }}>Esto ayuda a tu proveedor a entender con qué cliente y por qué canal está hablando.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['WhatsApp', 'WeChat', 'Alibaba', 'Otro'].map((o) => chip(o, commMethod === o, () => setCommMethod(o)))}
              </div>
            </div>}
          </div>
          <div style={{ marginTop: 14 }}>
            <label style={lblS}>Nota del proveedor <span style={optS}>· opcional · queda en su perfil</span></label>
            <textarea value={provNote} onChange={(e) => setProvNote(e.target.value)} onInput={autoGrow} placeholder="Ej.: tiene buen precio, responde rápido por WeChat, me lo presentó Juan…" rows={1} style={{ ...inS, resize: 'vertical', overflow: 'hidden' }} />
          </div>
          <button type="button" disabled={!newReqOk} onClick={() => setProvSaved(true)} style={{ marginTop: 16, width: '100%', height: 44, border: 0, borderRadius: 'var(--r-md)', background: newReqOk ? 'var(--wine)' : 'var(--bg-elevated)', color: newReqOk ? '#fff' : 'var(--ink-mute)', font: '800 13px/1 var(--f-sans)', cursor: newReqOk ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{I.check(14)} Guardar proveedor</button>
          {!newReqOk && <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '8px 0 0', textAlign: 'center' }}>Completa los campos con {req} para guardar.</p>}
        </div>)}

        {provOk &&
        <div style={{ marginBottom: 4 }}>
          <label style={lblS}>Nota <span style={optS}>· opcional</span></label>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} onInput={autoGrow} placeholder="Ej.: me dio mejor precio esta vez, pedido urgente, incluye una muestra…" rows={1} style={{ ...inS, resize: 'vertical', overflow: 'hidden' }} />
        </div>}

        {provOk &&
        <div style={{ marginTop: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ font: '800 10px/1 var(--f-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 9 }}>Escoge la modalidad del envío</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', gap: 11, padding: 12, borderRadius: 'var(--r-lg)', border: '1.5px solid var(--success)', background: 'var(--success-bg)' }}>
                <button type="button" onClick={() => setPlayingKey('maritimo')} style={{ width: 56, height: 100, borderRadius: 8, background: '#0B1428', flexShrink: 0, border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 2px 8px rgba(0,0,0,.35)', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ position: 'absolute', top: 3, right: 3, font: '800 7.5px/1 var(--f-mono)', color: '#fff', background: 'rgba(0,0,0,.55)', padding: '2px 4px', borderRadius: 3 }}>0:32</span>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="var(--success)"><path d="M8 5l12 7-12 7z"></path></svg></span>
                </button>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ font: '800 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Prealerta de envío marítimo</span>
                  </div>
                  <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}>Recibimos tu compra en nuestra bodega de Yiwu y la enviamos por barco hasta Venezuela. <b style={{ color: 'var(--ink)' }}>Va incluida en toda pre-alerta</b> — los servicios de abajo son extra.</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 11, padding: 12, borderRadius: 'var(--r-lg)', border: '1.5px solid var(--border-strong)', background: 'var(--bg-base)', opacity: .75 }}>
                <div style={{ width: 56, height: 100, borderRadius: 8, background: 'var(--bg-elevated)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 4px' }}>
                  <span style={{ font: '800 7px/1.3 var(--f-mono)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Video<br />próximamente</span>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ font: '800 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Prealerta de envío aéreo</span>
                    <span style={{ font: '800 8.5px/1 var(--f-mono)', letterSpacing: '.06em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 999, background: 'var(--warning)', color: 'var(--on-warning)', display: 'inline-flex', alignItems: 'center' }}>Próximamente</span>
                  </div>
                  <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}>Aún no disponible — se activa desde la configuración de DTD cuando esté listo.</p>
                </div>
              </div>
            </div>
          </div>

          <button type="button" onClick={() => setExtrasOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', border: '1.5px solid var(--wine)', borderRadius: 'var(--r-lg)', background: 'var(--wine-tint)', cursor: 'pointer', textAlign: 'left', marginBottom: extrasOpen ? 14 : 0 }}>
            <span style={{ font: '800 15.5px/1.3 var(--f-display)', color: 'var(--wine-text)' }}>¿Sabías que puedes pedir servicios extra para esta compra?</span>
            <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--wine)', color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: extrasOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{I.chevD(18)}</span>
          </button>

          {extrasOpen && <div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 16 }}>
              <b style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-soft)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#0B1428' }} />Con video</b>
              <b style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-soft)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)' }} />Próximamente</b>
              <b style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-soft)' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--border-strong)' }} />Sin video (solo texto)</b>
            </div>
            <div style={{ font: '700 10.5px/1 var(--f-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--wine-text)', margin: '2px 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>Servicios extra · esta compra<span style={{ flex: 1, height: 1, background: 'var(--border)' }} /></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {_ADDONS_LLEGADA.map((s) => {
                const tied = s.k === 'reempaque' && holdTie;
                const checked = !!addons[s.k];
                if (tied) {
                  return (
                  <div key={s.k} style={{ border: '1px solid var(--warning)', background: 'var(--warning-bg)', borderRadius: 'var(--r-lg)', padding: '10px 12px' }}>
                    <button type="button" onClick={() => setReempaqueNoteOpen((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                      <span style={{ color: 'var(--ink)', flexShrink: 0, display: 'flex' }}>{I.check(14)}</span>
                      <span style={{ flex: 1, font: '700 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Servicio de reempaque incluido en el HOLD</span>
                      <span style={{ color: 'var(--ink-soft)', flexShrink: 0, display: 'flex', transform: reempaqueNoteOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>{I.chevD(14)}</span>
                    </button>
                    {reempaqueNoteOpen && <textarea value={addonNotes.reempaque || ''} onChange={(e) => setAddonNotes((n) => ({ ...n, reempaque: e.target.value }))} onInput={autoGrow} rows={1} placeholder="¿Quieres agregar algo más a esta nota?" style={{ ...inS, resize: 'vertical', overflow: 'hidden', marginTop: 9 }} />}
                  </div>);
                }
                return (
                <div key={s.k} style={{ border: '1.5px solid ' + (checked ? 'var(--success)' : 'var(--border-strong)'), background: checked ? 'var(--success-bg)' : 'var(--bg-base)', borderRadius: 'var(--r-lg)', padding: 12 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    {s.vid !== 'hidden' && (s.vid === 'have'
                      ? <button type="button" onClick={() => setPlayingKey(s.k)} style={{ width: 58, height: 104, borderRadius: 8, background: '#0B1428', flexShrink: 0, border: '1px solid rgba(255,255,255,.16)', boxShadow: '0 2px 8px rgba(0,0,0,.35)', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ position: 'absolute', top: 3, right: 3, font: '800 7.5px/1 var(--f-mono)', color: '#fff', background: 'rgba(0,0,0,.55)', padding: '2px 4px', borderRadius: 3 }}>0:{28 + _ADDONS_LLEGADA.indexOf(s) * 4}</span>
                          <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="var(--wine)"><path d="M8 5l12 7-12 7z"></path></svg></span>
                        </button>
                      : <div style={{ width: 58, height: 104, borderRadius: 8, background: 'var(--bg-elevated)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 4px' }}>
                          <span style={{ font: '800 7px/1.3 var(--f-mono)', letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Video<br />próximamente</span>
                        </div>)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, font: tied ? '800 9.5px/1 var(--f-sans)' : '800 9px/1 var(--f-mono)', letterSpacing: tied ? 0 : '.08em', textTransform: tied ? 'none' : 'uppercase', color: tied ? 'var(--ink)' : 'var(--wine-text)', marginBottom: 5, background: tied ? 'var(--warning-bg)' : 'transparent', border: tied ? '1px solid var(--warning)' : 'none', borderRadius: tied ? 999 : 0, padding: tied ? '4px 9px' : 0 }}>{tied ? 'Incluido junto con HOLD ↑' : 'Prealerta de servicio extra'}</span>
                      <div style={{ font: '800 13.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{s.nm}</div>
                      <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{s.ds}</div>
                      <button type="button" disabled={tied} onClick={() => toggleAddon(s.k)} style={{ marginTop: 9, display: 'inline-flex', alignItems: 'center', gap: 7, font: '800 11px/1 var(--f-sans)', border: '1.5px solid ' + (tied ? 'var(--warning)' : (checked ? 'var(--success)' : 'var(--wine)')), background: tied ? 'var(--warning-bg)' : (checked ? 'var(--success-bg)' : 'var(--bg-surface)'), color: tied ? 'var(--ink)' : (checked ? 'var(--success)' : 'var(--wine-text)'), borderRadius: 999, padding: '7px 13px', cursor: tied ? 'default' : 'pointer', transition: 'background .2s, border-color .2s, color .2s' }}>{tied ? 'Incluido' : (checked ? <>{I.check(11)} Agregado</> : '+ Pedir este servicio')}</button>
                    </div>
                  </div>
                  {checked && <div style={{ marginTop: 11, paddingTop: 11, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
                      <span style={{ color: 'var(--wine-text)', flexShrink: 0, marginTop: 2, display: 'flex' }}>{I.check(13)}</span>
                      <span>Esto se suma a tu orden: <b style={{ color: 'var(--ink)' }}>“{orderLineFor(s)}”</b></span>
                    </div>
                    {s.k === 'inspeccion' ? <>
                      <textarea value={addonNotes.inspeccion || ''} onChange={(e) => setAddonNotes((n) => ({ ...n, inspeccion: e.target.value }))} onInput={autoGrow} rows={1} placeholder="Explícanos qué quieres que revisemos: qué es calidad para ti y qué debemos verificar exactamente. Mientras más detallado, mejor." style={{ ...inS, resize: 'vertical', overflow: 'hidden' }} />
                      <button type="button" disabled style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: '700 11px/1 var(--f-sans)', color: 'var(--ink-mute)', border: '1.5px dashed var(--border-strong)', background: 'var(--bg-elevated)', borderRadius: 999, padding: '7px 12px', cursor: 'default', width: 'fit-content' }}>{I.upload(13)}Adjuntar ficha técnica <span style={{ font: '800 8px/1 var(--f-mono)', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>Próximamente</span></button>
                    </> : <textarea value={addonNotes[s.k] || ''} onChange={(e) => setAddonNotes((n) => ({ ...n, [s.k]: e.target.value }))} onInput={autoGrow} rows={1} placeholder="¿Quieres agregar algo más a esta nota?" style={{ ...inS, resize: 'vertical', overflow: 'hidden' }} />}
                    {s.k === 'hold' && <>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        <label style={lblS}>¿Cuántas compras vas a unificar en total?</label>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                          <button type="button" onClick={() => setHoldCount((c) => Math.max(2, c - 1))} style={stepBtnS}>−</button>
                          <span style={{ font: '800 15px/1 var(--f-mono)', color: 'var(--ink)', minWidth: 22, textAlign: 'center' }}>{holdCount}</span>
                          <button type="button" onClick={() => setHoldCount((c) => Math.min(10, c + 1))} style={stepBtnS}>+</button>
                        </div>
                        <p style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}>{holdCount <= 2 ? 'Sin especificar, unificamos con la próxima compra que llegue — 2 en total.' : `El despacho queda en espera hasta que las ${holdCount} compras estén en bodega.`}</p>
                      </div>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', paddingTop: 2 }}>
                        <input type="checkbox" checked={holdTie} onChange={(e) => { const on = e.target.checked; setHoldTie(on); setAddons((a) => ({ ...a, reempaque: on ? true : a.reempaque })); }} style={{ width: 15, height: 15, margin: '2px 0 0', accentColor: 'var(--wine)', flexShrink: 0 }} />
                        <span style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Este HOLD implica reempaque</span>
                      </label>
                      {holdTie && <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '700 11px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{I.check(13)}<span>Re-Empaque se activó automáticamente abajo</span></div>}
                    </>}
                    {s.k === 'reempaque' && !holdTie && <input value={addonNotes.reempaqueTracking || ''} onChange={(e) => setAddonNotes((n) => ({ ...n, reempaqueTracking: e.target.value }))} placeholder="Trackings a unificar (separados por coma)" style={inS} />}
                  </div>}
                </div>);
              })}
            </div>
          </div>}
        </div>}
      </div>
      </div>

      <div style={(wideForm && provOk) ? { position: 'sticky', top: 'calc(var(--topbar-h) + 16px)' } : { marginTop: 'var(--s-5)' }}>
          {provOk && <div style={{ border: '1.5px solid var(--wine)', borderRadius: 'var(--r-lg)', background: 'var(--wine-tint)', padding: '13px 15px', margin: '0 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, font: '800 9.5px/1 var(--f-mono)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--wine-text)', marginBottom: 7 }}>{I.doc(13)}Así queda tu orden a DTD — en vivo</div>
            <div style={{ font: '600 13px/1.6 var(--f-sans)', color: 'var(--ink)' }}>
              <p style={{ margin: orderLines.length > 0 ? '0 0 8px' : 0 }}>Hola, DTD Cargo. Te aviso que viene mercancía de mi proveedor <b>{existingSel ? existingSel.name : (qraw || 'mi proveedor')}</b> para ser enviada por barco.</p>
              {orderLines.length > 0 && <>
              <p style={{ fontWeight: 800, margin: '0 0 7px' }}>Aparte, requiero:</p>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {orderLines.map((l, i) => <li key={i} style={{ font: '600 12.5px/1.5 var(--f-sans)' }}><b>{l.desc}</b><i style={{ fontStyle: 'normal', color: 'var(--ink-soft)', fontWeight: 500, display: 'block', marginTop: 2 }}>{l.fee}</i></li>)}
              </ol>
              </>}
            </div>
          </div>}

        <button onClick={submit} disabled={!provOk || submitting} className={'pcb pcb--wine pcb--reg' + (submitting ? ' go' : '')} style={{ width: '100%' }}>
          <span className="pcl pcl-def">Registrar compra {I.arrowR(14)}</span>
          <span className="pcl pcl-ok"><svg className="ck" viewBox="0 0 12 10"><polyline points="1.5 6 4.5 9 10.5 1"></polyline></svg>Compra registrada</span>
          <span className="pct" aria-hidden="true"><span className="pct-box"></span><span className="pct-veh"><span className="pct-body"></span><span className="pct-cab"><span className="pct-win"></span></span><span className="pct-wheel pct-wheel1"></span><span className="pct-wheel pct-wheel2"></span></span></span>
        </button>
        {!provOk && <p style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '10px 0 0', textAlign: 'center' }}>{isNew ? 'Guarda los datos del proveedor para continuar.' : 'Escribe o elige un proveedor para continuar.'}</p>}
      </div>
      </div>
      {playingKey && <div onClick={() => setPlayingKey(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(11,20,40,.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ width: 230, aspectRatio: '9/16', background: '#0B1428', borderRadius: 18, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', font: '700 12px/1.4 var(--f-sans)', textAlign: 'center', padding: '0 18px' }}>
          <span onClick={() => setPlayingKey(null)} style={{ position: 'absolute', top: -40, right: 0, width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 15 }}>✕</span>
          ▶ Reproduciendo short vertical…
        </div>
      </div>}
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
            <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine-text)' }}>{code}</code>
          </div>
          {embedded
            ? <button onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 0, color: 'var(--ink-soft)', cursor: 'pointer', font: '600 12px/1 var(--f-sans)' }}>{I.arrowL(12)} Volver</button>
            : <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 18 }}>×</button>}
        </div>
        <div style={{ padding: 22 }}>
          {phase === 'docs' &&
          <div>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>Paso 1 · Adjunta la compra</div>
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
                    <span style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>Fotos de los productos que estás comprando · ayudan a verificar tu mercancía.</span>
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
            <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', paddingBottom: 10 }}>= <b style={{ color: 'var(--wine-text)' }}>{n} etiqueta{n > 1 ? 's' : ''}</b></div>
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
          {n > 6 && <div style={{ textAlign: 'center', font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>… y {n - 6} etiquetas más (Caja 7/{n} … {n}/{n})</div>}

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