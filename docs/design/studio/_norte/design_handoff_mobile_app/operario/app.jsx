/* global React */
/* ── DTD · Operario CN · Mobile App ─────────────────────────── */

const { useState, useEffect } = React;

function OperarioApp() {
  const [view, setView] = useState('login');
  const [lang, setLang] = useState('es'); // 'es' | 'cn'
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [reception, setReception] = useState({ photos: [], client: '', orphan: false, marks: '', boxes: '', cbm: '', weight: '', supplier: '', desc: '', ranges: [], incident: false, incidentNote: '' });

  useEffect(() => {document.documentElement.setAttribute('data-theme', theme);}, [theme]);

  const t = (es, cn) => lang === 'cn' ? cn : es;

  const reset = () => setReception({ photos: [], client: '', orphan: false, marks: '', boxes: '', cbm: '', weight: '', supplier: '', desc: '', ranges: [], incident: false, incidentNote: '' });

  return (
    <div className="op-app">
      {view === 'login' && <Login onLogin={(u) => {setUser(u);setView('home');}} lang={lang} setLang={setLang} t={t} />}
      {view === 'home' && <Home user={user} t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} onStart={(mode) => {reset();setView(mode === 'manual' ? 'step1' : 'scan');}} onDispatch={() => setView('dispatch')} onLogout={() => {setUser(null);setView('login');}} />}
      {view === 'scan' && <ScanReceive t={t} onMatch={() => {setReception((r) => ({ ...r, scanned: true }));setView('step1');}} onManual={() => setView('step1')} onBack={() => setView('home')} />}
      {view === 'dispatch' && <DispatchFlow t={t} lang={lang} onBack={() => setView('home')} onDone={() => setView('home')} />}
      {view === 'step1' && <Step1Photos t={t} reception={reception} setReception={setReception} onBack={() => setView('home')} onNext={() => setView('step2')} />}
      {view === 'step2' && <Step2Identify t={t} reception={reception} setReception={setReception} onBack={() => setView('step1')} onNext={() => setView('step3')} />}
      {view === 'step3' && <Step3Data t={t} reception={reception} setReception={setReception} onBack={() => setView('step2')} onNext={() => setView('step4')} />}
      {view === 'step4' && <Step4Confirm t={t} reception={reception} setReception={setReception} onBack={() => setView('step3')} onSubmit={() => setView('done')} />}
      {view === 'done' && <Done t={t} onNew={() => {reset();setView('step1');}} onHome={() => setView('home')} />}
    </div>);

}

// ── Shared chrome components ─────────────────────────────────
function MobileHeader({ title, subtitle, back, right }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 10,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      padding: 'env(safe-area-inset-top) 16px 12px',
      display: 'grid', gridTemplateColumns: '44px 1fr 44px', gap: 8,
      alignItems: 'center', paddingTop: 14
    }}>
      {back ?
      <button onClick={back} style={{
        width: 44, height: 44, borderRadius: 'var(--r-md)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-soft)'
      }}>{window.Icon.arrowL(20)}</button> :
      <div />}
      <div style={{ textAlign: 'center', minWidth: 0 }}>
        <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
        {subtitle && <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right || <div />}
    </header>);

}

function BigButton({ label, onClick, disabled, icon, variant = 'primary' }) {
  const v = {
    primary: { bg: 'var(--wine)', fg: '#fff' },
    secondary: { bg: 'var(--bg-elevated)', fg: 'var(--ink)' },
    ghost: { bg: 'transparent', fg: 'var(--ink)' },
    success: { bg: 'var(--success)', fg: '#fff' }
  }[variant] || { bg: 'var(--wine)', fg: '#fff' };
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 56,
      background: v.bg, color: v.fg,
      borderRadius: 'var(--r-md)',
      font: '800 16px/1 var(--f-sans)',
      letterSpacing: '-0.01em',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer'
    }}>
      {icon}
      {label}
    </button>);

}

function LangSwitch({ lang, setLang }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      {[
      { v: 'es', l: 'ES' },
      { v: 'cn', l: '中文' }].
      map((o) =>
      <button key={o.v} onClick={() => setLang(o.v)} style={{
        padding: '6px 12px', borderRadius: 'var(--r-sm)',
        background: lang === o.v ? 'var(--wine)' : 'transparent',
        color: lang === o.v ? '#fff' : 'var(--ink-soft)',
        font: `700 12px/1 ${o.v === 'cn' ? '"Noto Sans SC"' : 'var(--f-sans)'}`
      }}>{o.l}</button>
      )}
    </div>);

}

// ── Login ───────────────────────────────────────────────────
function Login({ onLogin, lang, setLang, t }) {
  const [pin, setPin] = useState('');
  const handleDigit = (d) => {
    if (pin.length < 4) {
      const next = pin + d;
      setPin(next);
      if (next.length === 4) setTimeout(() => onLogin({ name: 'Wang Hua', cn: '王华', hub: 'YIW-A1' }), 300);
    }
  };
  const backspace = () => setPin(pin.slice(0, -1));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, var(--ink) 0%, #1F3055 100%)',
      display: 'flex', flexDirection: 'column',
      padding: '40px 24px',
      color: '#fff'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <img src="assets/dtdcargo-isologo-reverse.png" alt="DTD Cargo" style={{ height: 32, display: 'block' }} />
        <LangSwitch lang={lang} setLang={setLang} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>DTD-CARGO · 操作员</div>
        <div style={{ font: '900 26px/1.3 var(--f-display)', color: '#fff', marginTop: 14, letterSpacing: '-0.02em' }}>{t('Almacén Yiwu', '义乌仓库')}</div>
        <div style={{ font: '500 14px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 12 }}>{t('Ingresa tu PIN de 4 dígitos', '请输入4位PIN密码')}</div>

        {/* PIN dots */}
        <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
          {[0, 1, 2, 3].map((i) =>
          <div key={i} style={{
            width: 18, height: 18, borderRadius: '50%',
            background: i < pin.length ? 'var(--wine-soft)' : 'transparent',
            border: '2px solid rgba(255,255,255,0.4)',
            transition: 'background var(--dur-fast) var(--ease)'
          }} />
          )}
        </div>

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 14, marginTop: 36 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
          <button key={n} onClick={() => handleDigit(String(n))} style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            font: '900 28px/1 var(--f-display)',
            border: '1px solid rgba(255,255,255,0.12)'
          }}>{n}</button>
          )}
          <div />
          <button onClick={() => handleDigit('0')} style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            font: '900 28px/1 var(--f-display)',
            border: '1px solid rgba(255,255,255,0.12)'
          }}>0</button>
          <button onClick={backspace} style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'transparent', color: 'rgba(255,255,255,0.6)'
          }}>{window.Icon.close(22)}</button>
        </div>
      </div>

      <div style={{ textAlign: 'center', font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.4)' }}>
        {t('Wang Hua · 王华 · YIW-A1', 'Wang Hua · 王华 · YIW-A1')}<br />
        v2.0 · DTD-CARGO 2026
      </div>
    </div>);

}

// ── Home ────────────────────────────────────────────────────
function Home({ user, t, lang, setLang, theme, setTheme, onStart, onDispatch, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [trackRec, setTrackRec] = useState(null);
  const [avisosOpen, setAvisosOpen] = useState(false);
  const Avisos = window.OperarioAvisos;
  const avisos = React.useMemo(() => Avisos ? Avisos.seed(t) : [], [lang]);
  const onAviso = (act) => {if (act === 'dispatch') onDispatch();else if (act === 'print') setPrintOpen(true);};
  return (
    <div>
      <MobileHeader
        title={t('Mi día', '今日工作')}
        subtitle="YIW-A1 · 义乌港二期"
        right={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginRight: -8 }}>
            {Avisos && <Avisos.Bell items={avisos} onOpen={() => setAvisosOpen(true)} />}
            <button onClick={() => setMenuOpen(true)} style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', color: 'var(--ink-soft)', background: 'transparent', border: 0 }}>{window.Icon.menu(20)}</button>
          </div>
        } />
      

      <div style={{ padding: 16, paddingBottom: 100 }}>
        {/* Greeting */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
            23 May 2026 · 09:42
          </div>
          <div style={{ font: '900 24px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {t('Hola', '你好')}, {user.name.split(' ')[0]}
          </div>
          <div style={{ font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
            {t('Hoy llevas 3 recepciones · 18 cajas · 12.4 CBM', '今日已收 3 件 · 18 箱 · 12.4 CBM')}
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          <KPICard label={t('Recepciones', '接收')} value="3" tone="wine" />
          <KPICard label="CBM" value="12.4" tone="info" />
          <KPICard label={t('Pendientes', '待处理')} value="4" tone="warning" />
        </div>

        {/* Recent receptions */}
        <div style={{ marginBottom: 16 }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>{t('Acciones rápidas', '快捷操作')}</div>
          <button onClick={onDispatch} style={{
            width: '100%', padding: 14, marginBottom: 10,
            background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', border: 0,
            borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'rgba(216,154,164,0.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.box(22)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 13px/1.2 var(--f-display)', color: '#fff' }}>{t('Modo despacho · armar contenedor', '发货模式 · 装柜')}</div>
              <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>{t('Consolidá cajas recibidas · puedes partir en parciales', '合并已收箱子 · 可拆分为部分')}</div>
            </div>
            <span style={{ color: 'var(--wine-soft)' }}>→</span>
          </button>
          <button onClick={() => setPrintOpen(true)} style={{
            width: '100%', padding: 14, marginBottom: 10,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderLeft: '4px solid var(--wine)', borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left'
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.print(22)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>{t('Imprimir códigos QR', '打印QR码')}</div>
              <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{t('Elige cliente y cantidad → cola de impresión (local u oficina)', '选择客户和数量 → 打印队列 (本地或办公室)')}</div>
            </div>
            <span style={{ color: 'var(--wine)' }}>→</span>
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>{t('Últimas recepciones', '最近接收')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
            { id: 'CN-2026-2842', client: 'Acindar', cn: '阿辛达尔', boxes: 12, cbm: 6.4, time: t('hace 12 min', '12分钟前'), photos: 3 },
            { id: 'CN-2026-2841', client: 'Imp. Pereira', cn: '佩雷拉进口', boxes: 8, cbm: 4.2, time: t('hace 1 h', '1小时前'), photos: 2 },
            { id: 'CN-2026-2840', client: 'Dist. Andina', cn: '安第纳分销', boxes: 14, cbm: 5.4, time: t('hace 2 h', '2小时前'), photos: 4 }].
            map((r) =>
            <div key={r.id} onClick={() => setTrackRec(r)} style={{
              display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12,
              padding: 12, background: 'var(--bg-surface)', cursor: 'pointer',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              alignItems: 'center'
            }}>
                <div style={{
                width: 40, height: 40, borderRadius: 'var(--r-sm)',
                background: 'var(--wine-tint)', color: 'var(--wine)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                font: '800 12px/1 var(--f-display)'
              }}>{window.Icon.box(18)}</div>
                <div style={{ minWidth: 0 }}>
                  <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}</code>
                  <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 3 }}>
                    {lang === 'cn' ? r.cn : r.client}
                  </div>
                  <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>
                    {r.boxes}{t('cj', '箱')} · {r.cbm} CBM · {r.photos} {t('fotos', '照片')} · {r.time}
                  </div>
                </div>
                <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.chevR(14)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB */}
      <div style={{
        position: 'fixed', bottom: 'env(safe-area-inset-bottom)', left: 0, right: 0,
        padding: '12px 16px 18px',
        background: 'linear-gradient(0deg, var(--bg-base) 60%, transparent 100%)',
        display: 'flex', flexDirection: 'column', gap: 8
      }}>
        <BigButton label={t('Escanear código', '扫描代码')} onClick={() => onStart('scan')} icon={window.Icon.camera(20)} />
        <button onClick={() => onStart('manual')} style={{
          height: 46, width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', font: '700 13px/1 var(--f-sans)', color: 'var(--ink-soft)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>{window.Icon.edit(15)}{t('Recibir sin código (manual)', '手动接收 (无代码)')}</button>
      </div>

      {/* Menu modal */}
      {/* Menu modal */}
      {menuOpen &&
      <div onClick={() => setMenuOpen(false)} style={{
        position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.4)', zIndex: 50,
        display: 'flex', alignItems: 'flex-end'
      }}>
          <div onClick={(e) => e.stopPropagation()} style={{
          width: '100%', background: 'var(--bg-surface)',
          borderRadius: '20px 20px 0 0', padding: 20,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)'
        }}>
            <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 14px/1 var(--f-display)' }}>WH</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Wang Hua · 王华</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>Almacén CN · YIW-A1</div>
              </div>
            </div>
            <div style={{ padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ font: '600 14px/1 var(--f-sans)', color: 'var(--ink)' }}>{t('Idioma', '语言')}</span>
                <LangSwitch lang={lang} setLang={setLang} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
                <span style={{ font: '600 14px/1 var(--f-sans)', color: 'var(--ink)' }}>{t('Tema', '主题')}</span>
                <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} style={{ padding: '8px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', font: '600 12px/1 var(--f-sans)', color: 'var(--ink)' }}>
                  {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                </button>
              </div>
            </div>
            <button onClick={onLogout} style={{
            width: '100%', padding: '14px',
            background: 'var(--danger-bg)', color: 'var(--danger)',
            borderRadius: 'var(--r-md)', font: '700 14px/1 var(--f-sans)',
            marginTop: 12
          }}>{t('Cerrar sesión', '退出登录')}</button>
          </div>
        </div>
      }

      {window.PrintQRSheet && <window.PrintQRSheet open={printOpen} onClose={() => setPrintOpen(false)} t={t} lang={lang} />}
      {Avisos && <Avisos.Sheet open={avisosOpen} onClose={() => setAvisosOpen(false)} t={t} lang={lang} items={avisos} onAction={onAviso} />}
      {trackRec && <TrackSheet rec={trackRec} t={t} lang={lang} onClose={() => setTrackRec(null)} onPrint={() => {setTrackRec(null);setPrintOpen(true);}} />}
    </div>);

}

// ── Seguimiento de una recepción · timeline ─────────────────
function TrackSheet({ rec, t, lang, onClose, onPrint }) {
  // El momento ya pasó: la caja fue recibida y va avanzando en la cadena.
  const steps = [
  { k: 'recibido', icon: window.Icon.box(16), title: t('Recibido en almacén CN', '已在中国仓库接收'), sub: `${rec.boxes}${t('cj', '箱')} · ${rec.cbm} CBM · ${rec.photos} ${t('fotos', '照片')}`, time: rec.time, done: true },
  { k: 'verificado', icon: window.Icon.check(16), title: t('Verificado y fotografiado', '已核验并拍照'), sub: t('Datos y alertas de carga confirmados', '数据和货物警报已确认'), time: t('hace 1 h', '1小时前'), done: true },
  { k: 'bodega', icon: window.Icon.warehouse(16), title: t('En bodega · esperando consolidación', '在仓库 · 等待合并'), sub: t('Listo para armar contenedor', '准备装柜'), time: t('ahora', '现在'), done: true, current: true },
  { k: 'consolidado', icon: window.Icon.box(16), title: t('Consolidado en contenedor', '已装入集装箱'), sub: t('Pendiente', '待处理'), time: '—', done: false },
  { k: 'zarpe', icon: window.Icon.globe(16), title: t('Zarpe a Venezuela', '发往委内瑞拉'), sub: t('Pendiente', '待处理'), time: '—', done: false }];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.4)', zIndex: 60, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--bg-base)', borderRadius: '20px 20px 0 0', padding: 20, paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)', maxHeight: '86vh', overflow: 'auto' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'grid', placeItems: 'center' }}>{window.Icon.box(20)}</div>
          <div style={{ flex: 1 }}>
            <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{rec.id}</code>
            <div style={{ font: '700 15px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 3 }}>{lang === 'cn' ? rec.cn : rec.client}</div>
          </div>
          <span style={{ font: '700 9.5px/1 var(--f-sans)', padding: '5px 9px', borderRadius: 999, background: 'var(--info-bg)', color: 'var(--info)' }}>{t('en bodega', '在仓库')}</span>
        </div>

        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>{t('Seguimiento', '跟踪')}</div>
        <div style={{ position: 'relative', paddingLeft: 8 }}>
          {steps.map((s, i) =>
          <div key={s.k} style={{ display: 'flex', gap: 12, paddingBottom: i === steps.length - 1 ? 0 : 18, position: 'relative' }}>
              {i < steps.length - 1 && <div style={{ position: 'absolute', left: 15, top: 30, bottom: 0, width: 2, background: s.done ? 'var(--wine)' : 'var(--border)' }} />}
              <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontSize: 14, background: s.current ? 'var(--wine)' : s.done ? 'var(--wine-tint)' : 'var(--bg-elevated)', color: s.current ? '#fff' : s.done ? 'var(--wine)' : 'var(--ink-mute)', border: s.current ? '3px solid var(--wine-tint)' : 'none', zIndex: 1 }}>{s.icon}</div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ font: '700 13px/1.2 var(--f-sans)', color: s.done ? 'var(--ink)' : 'var(--ink-mute)' }}>{s.title}</div>
                <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{s.sub}</div>
              </div>
              <span style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', paddingTop: 3, whiteSpace: 'nowrap' }}>{s.time}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onPrint} style={{ flex: 1, height: 50, background: 'var(--bg-surface)', color: 'var(--wine)', border: '1px solid var(--wine)', borderRadius: 'var(--r-md)', font: '800 13.5px/1 var(--f-sans)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>{t('Imprimir códigos QR', '打印QR码')}</button>
          <button onClick={onClose} style={{ flex: 1, height: 50, background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', font: '800 14px/1 var(--f-sans)', cursor: 'pointer' }}>{t('Cerrar', '关闭')}</button>
        </div>
      </div>
    </div>);

}

function KPICard({ label, value, tone }) {
  const c = { wine: 'var(--wine)', info: 'var(--info)', warning: 'var(--warning)' }[tone];
  return (
    <div style={{
      padding: 12, background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      textAlign: 'left'
    }}>
      <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '900 22px/1 var(--f-display)', color: c, marginTop: 8, letterSpacing: '-0.02em' }}>{value}</div>
    </div>);

}

// ── Step indicator ─────────────────────────────────────────
function Steps({ current }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '0 16px 16px' }}>
      {[1, 2, 3, 4].map((n) =>
      <div key={n} style={{
        height: 4, borderRadius: 999,
        background: n <= current ? 'var(--wine)' : 'var(--bg-elevated)'
      }} />
      )}
    </div>);

}

// ── Step 1: Photos ────────────────────────────────────────
function Step1Photos({ t, reception, setReception, onBack, onNext }) {
  const photos = reception.photos;
  const addPhoto = () => setReception({ ...reception, photos: [...photos, { id: Date.now(), preview: ['box-front', 'label', 'inside', 'damage'][photos.length % 4] }] });
  const removePhoto = (id) => setReception({ ...reception, photos: photos.filter((p) => p.id !== id) });

  return (
    <div>
      <MobileHeader title={t('1 de 4 · Fotos', '1/4 · 拍照')} subtitle={t('Toma 3 fotos mínimo', '至少拍3张照片')} back={onBack} />
      <Steps current={1} />

      <div style={{ padding: '0 16px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {photos.map((p) =>
          <div key={p.id} style={{
            position: 'relative', aspectRatio: '4/3',
            background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
              <PhotoMock kind={p.preview} />
              <button onClick={() => removePhoto(p.id)} style={{
              position: 'absolute', top: 6, right: 6,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(168,50,62,0.9)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>{window.Icon.close(12)}</button>
            </div>
          )}
          <button onClick={addPhoto} style={{
            aspectRatio: '4/3',
            background: 'var(--wine)',
            color: '#fff', borderRadius: 'var(--r-md)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            font: '800 14px/1 var(--f-sans)'
          }}>
            <span style={{ display: 'inline-flex' }}>{window.Icon.camera(30)}</span>
            {t('Tomar foto', '拍照')}
          </button>
        </div>

        {photos.length > 0 && photos.length < 3 &&
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            <span style={{ color: 'var(--warning)', display: 'flex' }}>{window.Icon.warn(15)}</span>
            {t(`Faltan ${3 - photos.length} fotos · mínimo 3 para registrar`, `还需${3 - photos.length}张照片 · 至少3张`)}
          </div>
        }

        {photos.length >= 3 &&
        <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--success-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            <span style={{ color: 'var(--success)' }}>✓</span>
            {t('Fotos suficientes · puedes seguir', '照片足够 · 可以继续')}
          </div>
        }

        <div style={{ marginTop: 14, font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
          {t('Toma: 1) frente con etiqueta · 2) supplier label · 3) contenido · 4) daños si hay', '拍摄：1) 正面带标签 · 2) 供应商标签 · 3) 内容 · 4) 损坏（如有）')}
        </div>
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={photos.length < 3} t={t} />
    </div>);

}

function PhotoMock({ kind }) {
  // Simple SVG mockup
  const map = { 'box-front': window.Icon.box, 'label': window.Icon.tag, 'inside': window.Icon.doc, 'damage': window.Icon.warn };
  return (
    <div style={{ opacity: 0.4, color: 'var(--ink-mute)' }}>{(map[kind] || window.Icon.box)(44)}</div>);

}

function BottomActions({ back, next, nextDisabled, t, submitLabel, onSubmit }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      padding: '12px 16px',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
      background: 'var(--bg-base)',
      borderTop: '1px solid var(--border)',
      display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10
    }}>
      <BigButton label={t('Atrás', '上一步')} onClick={back} variant="secondary" />
      <BigButton
        label={submitLabel || t('Siguiente →', '下一步 →')}
        onClick={onSubmit || next}
        disabled={nextDisabled} />
      
    </div>);

}

// ── Step 2: Identify (client or orphan) ───────────────────
function Step2Identify({ t, reception, setReception, onBack, onNext }) {
  const D = window.ERPData;
  const clients = D?.CLIENTS || [];
  const [search, setSearch] = useState('');
  const filtered = clients.filter((c) => c.markbox.toLowerCase().includes(search.toLowerCase()) || c.company.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

  const setOrphan = (v) => setReception({ ...reception, orphan: v, client: '' });
  const setClient = (mb) => setReception({ ...reception, client: mb, orphan: false });

  const canNext = reception.orphan ? reception.marks.length > 0 : reception.client.length > 0;

  return (
    <div>
      <MobileHeader title={t('2 de 4 · Identificar', '2/4 · 识别')} subtitle={t('¿De quién es esta caja?', '这箱子是谁的?')} back={onBack} />
      <Steps current={2} />

      <div style={{ padding: '0 16px 100px' }}>
        {/* Orphan toggle */}
        <button onClick={() => setOrphan(!reception.orphan)} style={{
          width: '100%', padding: '12px 14px', marginBottom: 16,
          background: reception.orphan ? 'var(--warning-bg)' : 'var(--bg-elevated)',
          border: `1px solid ${reception.orphan ? 'var(--warning)' : 'var(--border)'}`,
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left'
        }}>
          <input type="checkbox" checked={reception.orphan} readOnly style={{ accentColor: 'var(--warning)', width: 18, height: 18 }} />
          <span style={{ flex: 1, font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
            {t('Caja sin código · huérfana', '无编码 · 孤箱')}
          </span>
        </button>

        {reception.orphan ?
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MobileInput
            label={t('Marcas visibles en la caja', '箱子上可见标记')}
            value={reception.marks}
            onChange={(v) => setReception({ ...reception, marks: v })}
            placeholder={t('Ej: ACINDAR-VLN-04 · etiqueta china', '例: ACINDAR-VLN-04 · 中文标签')} />
          
            <MobileInput
            label={t('¿Quién la trajo?', '谁送的?')}
            value=""
            onChange={() => {}}
            placeholder={t('Chofer o courier', '司机或快递')} />
          
          </div> :

        <div>
            <MobileInput
            label={t('Buscar cliente · Shipping Mark', '查找客户 · Shipping Mark')}
            value={search}
            onChange={setSearch}
            placeholder="DTD-XXXX"
            mono />
          
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map((c) => {
              const sel = reception.client === c.markbox;
              return (
                <button key={c.markbox} onClick={() => setClient(c.markbox)} style={{
                  display: 'grid', gridTemplateColumns: '90px 1fr 22px', gap: 10,
                  padding: '12px 14px',
                  background: sel ? 'var(--wine-tint)' : 'var(--bg-surface)',
                  border: `1px solid ${sel ? 'var(--wine)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)',
                  alignItems: 'center', textAlign: 'left'
                }}>
                    <code style={{ font: '800 12px/1 var(--f-mono)', color: sel ? 'var(--wine)' : 'var(--ink)' }}>{c.markbox}</code>
                    <span style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</span>
                    {sel && <span style={{ color: 'var(--wine)' }}>{window.Icon.check(14)}</span>}
                  </button>);

            })}
            </div>
          </div>
        }
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={!canNext} t={t} />
    </div>);

}

// ── Step 3: Box data ──────────────────────────────────────
function Step3Data({ t, reception, setReception, onBack, onNext }) {
  const set = (k, v) => setReception({ ...reception, [k]: v });
  const canNext = reception.boxes && reception.cbm;
  const ranges = reception.ranges || [];

  const addRange = () => {
    const lastTo = ranges.length ? parseInt(ranges[ranges.length - 1].to) || 0 : 0;
    const totalBoxes = parseInt(reception.boxes) || 0;
    const seedDesc = ranges.length === 0 ? (reception.desc || '') : '';
    const next = [...ranges, { from: String(lastTo + 1), to: totalBoxes ? String(Math.min(lastTo + 5, totalBoxes)) : '', desc: seedDesc, weight: '', cbm: '' }];
    setReception({ ...reception, ranges: next, ...(ranges.length === 0 ? { desc: '' } : {}) });
  };
  const updRange = (i, k, v) => {
    const next = ranges.map((r, idx) => idx === i ? { ...r, [k]: v } : r);
    setReception({ ...reception, ranges: next });
  };
  const delRange = (i) => {
    const next = ranges.filter((_, idx) => idx !== i);
    if (next.length === 0) {
      const restored = (ranges[i] && ranges[i].desc) ? ranges[i].desc : (reception.desc || '');
      setReception({ ...reception, ranges: next, desc: restored });
    } else {
      setReception({ ...reception, ranges: next });
    }
  };
  const boxesIn = (r) => { const a = parseInt(r.from), b = parseInt(r.to); return (a && b && b >= a) ? b - a + 1 : 0; };
  const boxesCovered = ranges.reduce((s, r) => s + boxesIn(r), 0);
  // Prorrateo: rangos con valor explícito se respetan; los vacíos reparten el remanente del total por cantidad de cajas.
  const distribute = (metric, total) => {
    const specified = ranges.reduce((s, r) => s + ((r[metric] !== '' && r[metric] != null) ? (parseFloat(r[metric]) || 0) : 0), 0);
    const blankBoxes = ranges.reduce((s, r) => s + ((r[metric] === '' || r[metric] == null) ? boxesIn(r) : 0), 0);
    const remaining = Math.max(0, total - specified);
    return ranges.map((r) => {
      const has = r[metric] !== '' && r[metric] != null;
      if (has) return { value: parseFloat(r[metric]) || 0, auto: false };
      return { value: blankBoxes > 0 ? remaining * (boxesIn(r) / blankBoxes) : 0, auto: true };
    });
  };
  const wDist = distribute('weight', parseFloat(reception.weight) || 0);
  const cDist = distribute('cbm', parseFloat(reception.cbm) || 0);
  const fmtN = (n) => (Number.isInteger(n) ? String(n) : (+n.toFixed(2)).toString());

  return (
    <div>
      <MobileHeader title={t('3 de 4 · Datos', '3/4 · 数据')} subtitle={t('Dimensiones y supplier', '尺寸和供应商')} back={onBack} />
      <Steps current={3} />

      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MobileInput label={t('Proveedor chino', '中国供应商')} value={reception.supplier} onChange={(v) => set('supplier', v)} placeholder={t('Nombre del supplier', '供应商名称')} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <MobileInput label={t('Cajas', '箱数')} value={reception.boxes} onChange={(v) => set('boxes', v)} placeholder="0" mono numeric calc />
          <MobileInput label="CBM" value={reception.cbm} onChange={(v) => set('cbm', v)} placeholder="0.0" mono numeric suffix="m³" calc />
        </div>

        <MobileInput label={t('Peso total', '总重量')} value={reception.weight} onChange={(v) => set('weight', v)} placeholder="0" mono numeric suffix="kg" calc />

        {/* Descripción de la mercancía + desglose por rango (reemplaza HS code) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('Descripción de la mercancía', '货物描述')}</span>
            <button onClick={addRange} title={t('Separar la descripción por número de caja', '按箱号分开描述')} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 'var(--r-sm)', border: '1px solid var(--wine)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 11px/1 var(--f-sans)', cursor: 'pointer' }}>+ {t('Rango', '范围')}</button>
          </div>
          {ranges.length === 0 ?
          <input value={reception.desc || ''} onChange={(e) => set('desc', e.target.value)} placeholder={t('ej. zapatos deportivos, repuestos, textil…', '例如 运动鞋、配件、纺织…')} style={{ width: '100%', height: 48, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '600 15px/1 var(--f-sans)', color: 'var(--ink)', background: 'var(--bg-surface)', boxSizing: 'border-box' }} />
          :
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--ink-mute)', display: 'flex' }}>{window.Icon.info(14)}</span>
            <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{t('La descripción quedó desglosada por rango abajo.', '描述已按范围拆分如下。')}</span>
          </div>
          }
          <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{ranges.length === 0
            ? t('¿Un solo artículo? Describilo acá. Si la caja trae cosas distintas, toca “Rango” y se separa por número de caja.', '单一物品？在此描述。如箱内不同，点“范围”按箱号分开。')
            : t('Edita la descripción de cada rango abajo. Peso y CBM por rango son opcionales (vacío = prorrateo).', '在下方编辑每个范围的描述。每个范围的重量和体积可选（留空=分摊）。')}</div>
        </div>

        {ranges.length > 0 &&
        <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>{t('Desglose por rango de cajas', '按箱号范围')}</div>

          {ranges.map((r, i) =>
          <div key={i} style={{ marginTop: i ? 10 : 0, padding: 12, background: 'var(--bg-surface)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{t('Cajas', '箱')}</span>
                <input value={r.from} onChange={(e) => updRange(i, 'from', e.target.value)} inputMode="numeric" placeholder="1" style={{ width: 46, padding: '8px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: '700 13px/1 var(--f-mono)', color: 'var(--ink)', background: 'var(--bg-base)' }} />
                <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>–</span>
                <input value={r.to} onChange={(e) => updRange(i, 'to', e.target.value)} inputMode="numeric" placeholder="5" style={{ width: 46, padding: '8px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: '700 13px/1 var(--f-mono)', color: 'var(--ink)', background: 'var(--bg-base)' }} />
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-base)' }}>
                    <input value={r.weight} onChange={(e) => updRange(i, 'weight', e.target.value)} inputMode="decimal" placeholder={wDist[i] && wDist[i].auto ? fmtN(wDist[i].value) : '0'} title={t('Peso · vacío = prorrateo', '重量 · 留空=分摊')} style={{ width: 40, padding: '8px 2px 8px 8px', textAlign: 'right', border: 0, outline: 'none', background: 'transparent', font: '600 12px/1 var(--f-mono)', color: r.weight ? 'var(--ink)' : 'var(--ink-mute)' }} />
                    <span style={{ font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', padding: '0 7px 0 2px' }}>kg</span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-base)' }}>
                    <input value={r.cbm} onChange={(e) => updRange(i, 'cbm', e.target.value)} inputMode="decimal" placeholder={cDist[i] && cDist[i].auto ? fmtN(cDist[i].value) : '0'} title={t('CBM · vacío = prorrateo', '体积 · 留空=分摊')} style={{ width: 40, padding: '8px 2px 8px 8px', textAlign: 'right', border: 0, outline: 'none', background: 'transparent', font: '600 12px/1 var(--f-mono)', color: r.cbm ? 'var(--ink)' : 'var(--ink-mute)' }} />
                    <span style={{ font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', padding: '0 7px 0 2px' }}>m³</span>
                  </div>
                  <button onClick={() => delRange(i)} style={{ width: 30, height: 30, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--danger)', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              </div>
              <input value={r.desc} onChange={(e) => updRange(i, 'desc', e.target.value)} placeholder={t('Descripción de este rango', '该范围的描述')} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: '500 13px/1 var(--f-sans)', color: 'var(--ink)', background: 'var(--bg-base)', boxSizing: 'border-box' }} />
            </div>
          )}

          <div style={{ marginTop: 12, display: 'flex', gap: 16, alignItems: 'center', font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', flexWrap: 'wrap' }}>
              <span>{t('Cajas cubiertas', '覆盖箱数')}: <b style={{ color: boxesCovered === (parseInt(reception.boxes) || 0) && boxesCovered > 0 ? 'var(--success)' : 'var(--ink)' }}>{boxesCovered}/{reception.boxes || 0}</b></span>
              <span style={{ color: 'var(--ink-mute)' }}>{t('Vacío = prorrateo automático', '留空 = 自动分摊')}</span>
            </div>
        </div>
        }

        {/* ── Issues / alertas de carga · color ── */}
        {(() => {
          const CATS = [
          { id: 'peligrosa', es: 'Mercancía peligrosa', cn: '危险品', color: '#A8323E' },
          { id: 'fragil', es: 'Frágil / delicada', cn: '易碎品', color: '#B8893A' },
          { id: 'licencia', es: 'Requiere licencia', cn: '需许可证', color: '#2A6FDB' },
          { id: 'marca', es: 'Marca · réplica?', cn: '品牌·仿品?', color: '#7F0F1A' },
          { id: 'defectuosa', es: 'Defectuosa', cn: '次品', color: '#6B6B6B' },
          { id: 'otros', es: 'Otros', cn: '其他', color: '#1F8A5B' }];

          const flags = reception.flags || [];
          const toggle = (id) => set('flags', flags.includes(id) ? flags.filter((x) => x !== id) : [...flags, id]);
          return (
            <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t('Alertas de carga', '货物警报')}</div>
              <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-soft)', margin: '4px 0 12px' }}>{t('Opcional · marca si la mercancía tiene algún tema', '可选 · 如有问题请标记')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {CATS.map((c) => {
                  const on = flags.includes(c.id);
                  return (
                    <button key={c.id} onClick={() => toggle(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', textAlign: 'left', border: `1px solid ${on ? c.color : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: on ? c.color + '14' : 'var(--bg-surface)', cursor: 'pointer' }}>
                      <span style={{ width: 14, height: 14, borderRadius: 4, background: c.color, flexShrink: 0, boxShadow: on ? `0 0 0 3px ${c.color}33` : 'none' }} />
                      <span style={{ font: '700 12px/1.2 var(--f-sans)', color: on ? c.color : 'var(--ink)', flex: 1 }}>{t(c.es, c.cn)}</span>
                      {on && <span style={{ color: c.color, font: '700 12px/1' }}>✓</span>}
                    </button>);

                })}
              </div>
              {flags.length > 0 &&
              <input value={reception.flagNote || ''} onChange={(e) => set('flagNote', e.target.value)} placeholder={t('Comentario sobre la alerta…', '关于警报的评论…')} style={{ width: '100%', marginTop: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink)', background: 'var(--bg-surface)', boxSizing: 'border-box' }} />
              }
            </div>);

        })()}
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={!canNext} t={t} />
    </div>);

}

function MobileInput({ label, value, onChange, placeholder, mono, large, numeric, suffix, readOnly, calc }) {
  const [raw, setRaw] = useState(null);
  const calcOn = calc && !readOnly;
  const evalSum = (s) => {
    const m = String(s).match(/[+\-]?\s*\d*\.?\d+/g);
    if (!m) return '';
    const tot = m.reduce((a, tk) => a + (parseFloat(tk.replace(/\s/g, '')) || 0), 0);
    return String(Number.isInteger(tot) ? tot : +tot.toFixed(2));
  };
  const display = calcOn && raw !== null ? raw : value;
  const hasOp = calcOn && raw !== null && /\d\s*[+\-]\s*\d/.test(raw);
  const handle = (txt) => {
    if (calcOn) {setRaw(txt);onChange(evalSum(txt));} else {onChange(txt);}
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
        height: large ? 56 : 48, padding: '0 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--r-md)'
      }}>
        <input
          value={display}
          onChange={(e) => handle(e.target.value)}
          onFocus={() => {if (calcOn) setRaw(value ? String(value) : '');}}
          onBlur={() => {if (calcOn) setRaw(null);}}
          placeholder={placeholder}
          readOnly={readOnly}
          inputMode={numeric ? 'decimal' : 'text'}
          style={{
            flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent',
            font: `${mono ? '700' : '600'} ${large ? 24 : 15}px/1 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`,
            color: readOnly ? 'var(--ink-soft)' : 'var(--ink)'
          }} />
        {hasOp && <span style={{ font: '700 14px/1 var(--f-mono)', color: 'var(--wine)', whiteSpace: 'nowrap' }}>= {evalSum(raw)}</span>}
        {suffix && <span style={{ font: '600 13px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{suffix}</span>}
      </div>
    </label>);

}

// ── Step 4: Confirm + incident ─────────────────────────────
function Step4Confirm({ t, reception, setReception, onBack, onSubmit }) {
  const D = window.ERPData;
  const client = reception.client ? D?.CLIENTS?.find((c) => c.markbox === reception.client) : null;

  return (
    <div>
      <MobileHeader title={t('4 de 4 · Confirmar', '4/4 · 确认')} subtitle={t('Revisa y guarda', '检查并保存')} back={onBack} />
      <Steps current={4} />

      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Summary */}
        <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>{t('Resumen', '总结')}</div>
          <SummaryRow label={t('Fotos', '照片')} value={`${reception.photos.length}`} />
          <SummaryRow label={t('Cliente', '客户')} value={reception.orphan ? t('Huérfana · ' + reception.marks, '孤箱') : client?.company || reception.client} />
          <SummaryRow label={t('Supplier', '供应商')} value={reception.supplier || '—'} />
          <SummaryRow label={t('Cajas', '箱')} value={reception.boxes} />
          <SummaryRow label="CBM" value={`${reception.cbm} m³`} />
          {reception.weight && <SummaryRow label={t('Peso', '重量')} value={`${reception.weight} kg`} />}
          {reception.desc
            ? <SummaryRow label={t('Descripción', '描述')} value={reception.desc} />
            : (reception.ranges && reception.ranges.length > 0) && <SummaryRow label={t('Descripción', '描述')} value={reception.ranges.map((r) => `${r.from}–${r.to}${r.desc ? ': ' + r.desc : ''}`).join(' · ')} />}
          {reception.flags && reception.flags.length > 0 &&
          <SummaryRow label={t('Alertas', '警报')} value={reception.flags.map((f) => t({ peligrosa: 'Mercancía peligrosa', fragil: 'Frágil / delicada', licencia: 'Requiere licencia', marca: 'Marca · réplica?', defectuosa: 'Defectuosa', otros: 'Otros' }[f] || f, { peligrosa: '危险品', fragil: '易碎品', licencia: '需许可证', marca: '品牌·仿品?', defectuosa: '次品', otros: '其他' }[f] || f)).join(' · ') + (reception.flagNote ? ` — ${reception.flagNote}` : '')} />}
        </div>

        {/* Incident toggle */}
        <button onClick={() => setReception({ ...reception, incident: !reception.incident })} style={{
          padding: '14px 16px',
          background: reception.incident ? 'var(--danger-bg)' : 'var(--bg-elevated)',
          border: `1px solid ${reception.incident ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left'
        }}>
          <input type="checkbox" checked={reception.incident} readOnly style={{ accentColor: 'var(--danger)', width: 18, height: 18 }} />
          <span style={{ flex: 1, font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
            {t('Reportar daño / incidencia', '报告损坏/事故')}
          </span>
        </button>

        {reception.incident &&
        <MobileInput
          label={t('Descripción de la incidencia', '事故描述')}
          value={reception.incidentNote}
          onChange={(v) => setReception({ ...reception, incidentNote: v })}
          placeholder={t('Ej: caja golpeada · contenido mojado', '例: 箱子损坏 · 内容潮湿')} />

        }
      </div>

      <BottomActions back={onBack} t={t} submitLabel={t('✓ Guardar recepción', '✓ 保存接收')} onSubmit={onSubmit} />
    </div>);

}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ font: '700 13px/1.4 var(--f-sans)', color: 'var(--ink)', textAlign: 'right' }}>{value}</span>
    </div>);

}

// ── Modo Despacho · armar contenedor + parciales nombrados ────
function DispatchFlow({ t, lang, onBack, onDone }) {
  const [step, setStep] = useState(0); // 0 precinto · 1 seleccionar · 2 partir · 3 confirmar
  const [sel, setSel] = useState({});
  const [splits, setSplits] = useState({}); // { recId: { name, boxes } }
  const [doneOpen, setDoneOpen] = useState(false);
  const [sealPhotos, setSealPhotos] = useState([]);
  const [sealNo, setSealNo] = useState('');
  const [containerNo, setContainerNo] = useState('');
  const [sealOk, setSealOk] = useState(false);
  const addSealPhoto = () => setSealPhotos((p) => [...p, { id: Date.now() + Math.random(), kind: ['Precinto', 'Vacío', 'Detalle', 'Puerta'][p.length % 4] }]);

  const pending = [
  { id: 'CN-2026-2842', client: 'Acindar', cn: '阿辛达尔', markbox: 'DTD-5452', boxes: 12, cbm: 6.4, weight: 980 },
  { id: 'CN-2026-2841', client: 'Imp. Pereira', cn: '佩雷拉进口', markbox: 'DTD-5418', boxes: 8, cbm: 4.2, weight: 620 },
  { id: 'CN-2026-2838', client: 'BriceñoTex', cn: '布里塞尼奥', markbox: 'DTD-5277', boxes: 22, cbm: 6.2, weight: 2400 },
  { id: 'CN-2026-2837', client: 'Dist. Andina', cn: '安第纳分销', markbox: 'DTD-5340', boxes: 14, cbm: 5.4, weight: 2100 }];


  const selected = pending.filter((r) => sel[r.id]);
  const effBoxes = (r) => splits[r.id] ? parseInt(splits[r.id].boxes) || r.boxes : r.boxes;
  const ratio = (r) => effBoxes(r) / r.boxes;
  const totCBM = selected.reduce((s, r) => s + r.cbm * ratio(r), 0);
  const totBoxes = selected.reduce((s, r) => s + effBoxes(r), 0);
  const totWeight = selected.reduce((s, r) => s + Math.round(r.weight * ratio(r)), 0);

  const toggleSel = (id) => setSel((p) => ({ ...p, [id]: !p[id] }));
  const [scanPrompt, setScanPrompt] = useState(null);
  const scanNext = () => {
    const next = pending.find((r) => !sel[r.id]);
    if (next) setScanPrompt(next);
  };
  const setSplit = (r, on) => setSplits((p) => {
    const n = { ...p };
    if (on) n[r.id] = { name: `${r.markbox} · ${t('Parte', '部分')} 1`, boxes: String(Math.ceil(r.boxes / 2)) };else
    delete n[r.id];
    return n;
  });
  const updSplit = (id, k, v) => setSplits((p) => ({ ...p, [id]: { ...p[id], [k]: v } }));

  return (
    <div>
      <MobileHeader title={t('Modo despacho', '发货模式')} subtitle={t(`Paso ${step + 1} de 4`, `第 ${step + 1}/4 步`)} back={step === 0 ? onBack : () => setStep(step - 1)} />

      {/* Stepper */}
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 14px' }}>
        {[t('Precinto', '铅封'), t('Seleccionar', '选择'), t('Partir', '拆分'), t('Confirmar', '确认')].map((l, i) =>
        <div key={i} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, background: step >= i ? 'var(--wine)' : 'var(--border)' }} />
            <div style={{ font: '600 9.5px/1.3 var(--f-sans)', color: step >= i ? 'var(--wine)' : 'var(--ink-mute)', marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 120px' }}>
        {/* STEP 0 · Precinto en vacío */}
        {step === 0 &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: 14, background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
              {t('Antes de cargar: revisa el precinto del contenedor vacío y toma varias fotos. Asegúrate de que esté en buen estado.', '装货前: 检查空柜的铅封并拍摄多张照片。确保其状态良好。')}
            </div>

            <div>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>{t('Fotos del precinto', '铅封照片')} ({sealPhotos.length})</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {sealPhotos.map((ph) =>
              <div key={ph.id} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 'var(--r-sm)', background: 'linear-gradient(135deg, #6B5B43 0%, rgba(0,0,0,0.4) 130%)', overflow: 'hidden' }}>
                    <span style={{ position: 'absolute', top: 4, left: 4, font: '700 8px/1 var(--f-mono)', color: '#fff', background: 'rgba(0,0,0,0.4)', padding: '2px 5px', borderRadius: 2 }}>{ph.kind}</span>
                    <button onClick={() => setSealPhotos(sealPhotos.filter((x) => x.id !== ph.id))} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.5)', color: '#fff', cursor: 'pointer', fontSize: 12 }}>×</button>
                  </div>
              )}
                <button onClick={addSealPhoto} style={{ aspectRatio: '1/1', borderRadius: 'var(--r-sm)', border: '2px dashed var(--border)', background: 'var(--bg-elevated)', color: 'var(--wine)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>{window.Icon.camera(22)}<span style={{ font: '700 9px/1 var(--f-sans)' }}>+ {t('Foto', '照片')}</span></button>
              </div>
            </div>

            <div>
              <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{t('Número de precinto (provisional)', '铅封号 (临时)')}</div>
              <input value={sealNo} onChange={(e) => setSealNo(e.target.value)} placeholder={t('Ej. CN-SEAL-88421', '例 CN-SEAL-88421')} style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '700 15px/1 var(--f-mono)', color: 'var(--ink)', background: 'var(--bg-surface)', boxSizing: 'border-box' }} />
              <div style={{ marginTop: 6, font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
                {t('Este número es provisional. Se confirma el definitivo después de pesar en la cinta.', '此号码为临时号码。在传送带称重后确认最终号码。')}
              </div>
            </div>

            <div>
              <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{t('Número de contenedor', '集装箱号')}</div>
              <input value={containerNo} onChange={(e) => setContainerNo(e.target.value.toUpperCase())} placeholder={t('Ej. DTDU-4729188', '例 DTDU-4729188')} style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '700 15px/1 var(--f-mono)', color: 'var(--ink)', background: 'var(--bg-surface)', boxSizing: 'border-box' }} />
              <div style={{ marginTop: 6, font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
                {t('Sirve como número de rastreo. La oficina lo busca después para registrar el BL.', '作为追踪号。办公室稍后用它登记提单。')}
              </div>
            </div>

            <button onClick={() => setSealOk(!sealOk)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: sealOk ? 'var(--success-bg)' : 'var(--bg-elevated)', border: `1px solid ${sealOk ? 'var(--success)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${sealOk ? 'var(--success)' : 'var(--border)'}`, background: sealOk ? 'var(--success)' : 'transparent', color: '#fff', display: 'grid', placeItems: 'center', font: '700 13px/1' }}>{sealOk ? '✓' : ''}</div>
              <span style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{t('Confirmo que el precinto está en buen estado', '我确认铅封状态良好')}</span>
            </button>
          </div>
        }

        {/* Resumen */}
        {step >= 1 && selected.length > 0 &&
        <div style={{ padding: 14, background: 'var(--ink)', color: '#fff', borderRadius: 'var(--r-md)', marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[[t('Cajas', '箱数'), totBoxes], ['CBM', totCBM.toFixed(1)], [t('Peso', '重量'), totWeight + 'kg']].map(([l, v]) =>
          <div key={l}>
                <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{l}</div>
                <div style={{ font: '900 18px/1 var(--f-mono)', color: '#fff', marginTop: 5 }}>{v}</div>
              </div>
          )}
          </div>
        }

        {/* STEP 1 · Seleccionar */}
        {step === 1 &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="eyebrow eyebrow-wine">{t('Recepciones en bodega', '仓库中的接收')}</div>
              <button onClick={scanNext} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 'var(--r-sm)', border: '1px solid var(--wine)', background: 'var(--wine-tint)', color: 'var(--wine)', font: '700 12px/1 var(--f-sans)', cursor: 'pointer' }}>{window.Icon.camera(14)}{t('Escanear', '扫描')}</button>
            </div>
            {pending.map((r) =>
          <button key={r.id} onClick={() => toggleSel(r.id)} style={{
            display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 12, padding: 14, textAlign: 'left',
            background: sel[r.id] ? 'var(--wine-tint)' : 'var(--bg-surface)',
            border: `1px solid ${sel[r.id] ? 'var(--wine)' : 'var(--border)'}`, borderRadius: 'var(--r-md)'
          }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${sel[r.id] ? 'var(--wine)' : 'var(--border)'}`, background: sel[r.id] ? 'var(--wine)' : 'transparent', color: '#fff', display: 'grid', placeItems: 'center', font: '700 12px/1' }}>{sel[r.id] ? '✓' : ''}</div>
                <div style={{ minWidth: 0 }}>
                  <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}</code>
                  <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 3 }}>{lang === 'cn' ? r.cn : r.client} · <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.markbox}</code></div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.cbm} CBM</div>
                  <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{r.boxes}{t('cj', '箱')}</div>
                </div>
              </button>
          )}
          </div>
        }

        {/* STEP 2 · Partir / parciales */}
        {step === 2 &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="eyebrow eyebrow-wine">{t('¿Partir alguna recepción?', '拆分某个接收?')}</div>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 4 }}>
              {t('Si una recepción no entra completa en este contenedor, partila. La parte restante queda como parcial nombrado.', '如果某接收无法完整装入此柜, 可拆分。剩余部分作为命名的部分保留。')}
            </div>
            {selected.map((r) => {
            const on = !!splits[r.id];
            const here = effBoxes(r);
            const rest = r.boxes - here;
            return (
              <div key={r.id} style={{ padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{lang === 'cn' ? r.cn : r.client}</div>
                      <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.markbox} · {r.boxes}{t('cj', '箱')}</code>
                    </div>
                    <button onClick={() => setSplit(r, !on)} style={{ padding: '8px 12px', borderRadius: 'var(--r-sm)', border: `1px solid ${on ? 'var(--wine)' : 'var(--border)'}`, background: on ? 'var(--wine)' : 'transparent', color: on ? '#fff' : 'var(--ink-soft)', font: '700 12px/1 var(--f-sans)', cursor: 'pointer' }}>{on ? t('Partido', '已拆分') : t('Partir', '拆分')}</button>
                  </div>
                  {on &&
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{t('Cajas en este envío', '此次发货箱数')}</span>
                        <input value={splits[r.id].boxes} onChange={(e) => updSplit(r.id, 'boxes', e.target.value)} inputMode="numeric" style={{ width: 56, padding: 8, textAlign: 'center', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: '700 13px/1 var(--f-mono)', color: 'var(--ink)', background: 'var(--bg-base)' }} />
                        <span style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>/ {r.boxes}</span>
                      </div>
                      <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{t('Nombre del parcial', '部分名称')}</div>
                      <input value={splits[r.id].name} onChange={(e) => updSplit(r.id, 'name', e.target.value)} placeholder={`${r.markbox} · ${t('Parte', '部分')} 1`} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: '600 13px/1 var(--f-sans)', color: 'var(--ink)', background: 'var(--bg-base)', boxSizing: 'border-box' }} />
                      <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--wine-tint)', borderRadius: 'var(--r-sm)', font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
                        {t('Van', '装')} <b>{here}{t('cj', '箱')}</b> · {t('quedan en bodega', '留仓')} <b>{rest}{t('cj', '箱')}</b> {t('como', '作为')} <b>"{r.markbox} · {t('Parte', '部分')} 2"</b>
                      </div>
                    </div>
                }
                </div>);

          })}
          </div>
        }

        {/* STEP 3 · Confirmar */}
        {step === 3 &&
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="eyebrow eyebrow-wine">{t('Resumen del contenedor', '柜子摘要')}</div>
            {selected.map((r) =>
          <div key={r.id} style={{ padding: 12, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{lang === 'cn' ? r.cn : r.client}</span>
                  <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{effBoxes(r)}{t('cj', '箱')}</span>
                </div>
                {splits[r.id] &&
            <div style={{ marginTop: 6, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
                    🔀 {t('Parcial', '部分')}: <b style={{ color: 'var(--ink)' }}>{splits[r.id].name}</b> · {t('resto queda como Parte 2', '剩余作为部分2')}
                  </div>
            }
              </div>
          )}
            <div style={{ padding: 14, background: 'var(--success-bg)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
              ✓ {t('Al confirmar se crea el embarque consolidado y los parciales nombrados quedan pendientes en bodega para el próximo contenedor.', '确认后将创建合并货运, 命名的部分将留在仓库等待下一个柜子。')}
            </div>
          </div>
        }
      </div>

      {/* Bottom action */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)', background: 'var(--bg-base)', borderTop: '1px solid var(--border)', maxWidth: 480, margin: '0 auto' }}>
        {step < 3 ?
        <BigButton label={t('Siguiente', '下一步')} onClick={() => setStep(step + 1)} disabled={step === 0 && (!sealOk || sealPhotos.length === 0 || !sealNo || !containerNo) || step === 1 && selected.length === 0} /> :
        <BigButton label={t('✓ Crear contenedor', '✓ 创建柜子')} onClick={() => setDoneOpen(true)} variant="success" />}
      </div>

      {/* Group-scan confirm sheet (despacho) */}
      {scanPrompt &&
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }} onClick={() => setScanPrompt(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--bg-base)', borderRadius: '20px 20px 0 0', padding: '22px 18px', paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)', boxShadow: '0 -8px 32px rgba(0,0,0,0.25)' }}>
            <div style={{ width: 38, height: 4, background: 'var(--border)', borderRadius: 2, margin: '0 auto 18px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', display: 'grid', placeItems: 'center', font: '900 20px/1 var(--f-mono)', flexShrink: 0 }}>{scanPrompt.boxes}</div>
              <div>
                <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)' }}>{t('¿Cargar el grupo completo?', '装载整个组?')}</div>
                <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{lang === 'cn' ? scanPrompt.cn : scanPrompt.client} · <code style={{ font: '600 11px/1 var(--f-mono)' }}>{scanPrompt.markbox}</code></div>
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', marginBottom: 16, font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
              {t('Escaneaste 1 bulto de este cliente. ¿Cargo las', '您扫描了该客户的1个包裹。装载全部')} <b>{scanPrompt.boxes} {t('cajas', '箱')}</b> {t('del grupo a este contenedor?', '到此柜?')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
              <button onClick={() => setScanPrompt(null)} style={{ padding: 14, borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '700 13px/1 var(--f-sans)', color: 'var(--ink-soft)', cursor: 'pointer' }}>{t('No, una por una', '不, 逐个')}</button>
              <button onClick={() => {setSel((p) => ({ ...p, [scanPrompt.id]: true }));setScanPrompt(null);}} style={{ padding: 14, borderRadius: 'var(--r-md)', border: 'none', background: 'var(--wine)', font: '700 13px/1 var(--f-sans)', color: '#fff', cursor: 'pointer' }}>{t('Sí, cargar', '是, 装载')} {scanPrompt.boxes} {t('cajas', '箱')}</button>
            </div>
          </div>
        </div>
      }

      {/* Done sheet */}
      {doneOpen &&
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,20,40,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--bg-base)', borderRadius: 'var(--r-lg)', padding: 28, textAlign: 'center', maxWidth: 320 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 14px', fontSize: 26 }}>✓</div>
            <div style={{ font: '900 18px/1.2 var(--f-display)', color: 'var(--ink)' }}>{t('Contenedor armado', '柜子已装好')}</div>
            <code style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--wine)', display: 'block', marginTop: 8 }}>DTDU-{472900 + Math.floor(Math.random() * 99)}</code>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 10 }}>
              {selected.length} {t('recepciones', '接收')} · {totBoxes}{t('cj', '箱')} · {totCBM.toFixed(1)} CBM
              <br />{t('Precinto', '铅封')}: <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{sealNo}</code> <span style={{ opacity: 0.7 }}>({t('provisional', '临时')})</span>
              <br />{t('Contenedor', '集装箱')}: <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{containerNo}</code> <span style={{ opacity: 0.7 }}>({t('rastreo', '追踪')})</span>
              {Object.keys(splits).length > 0 && <><br />{Object.keys(splits).length} {t('parciales nombrados en bodega', '命名部分留仓')}</>}
            </div>
            <button onClick={onDone} style={{ marginTop: 18, width: '100%', padding: 14, borderRadius: 'var(--r-md)', border: 'none', background: 'var(--wine)', color: '#fff', font: '700 14px/1 var(--f-sans)', cursor: 'pointer' }}>{t('Listo', '完成')}</button>
          </div>
        </div>
      }
    </div>);

}

// ── Scan-first · recepción por escaneo o manual ─────────────
function ScanReceive({ t, onMatch, onManual, onBack }) {
  const [scanning, setScanning] = useState(false);
  return (
    <div>
      <MobileHeader title={t('Escanear código', '扫描代码')} subtitle={t('Recepción en bodega', '仓库接收')} back={onBack} />
      <div style={{ padding: '0 16px 100px' }}>
        <div onClick={() => {setScanning(true);setTimeout(() => {setScanning(false);onMatch();}, 1400);}} style={{
          aspectRatio: '1/1', maxWidth: 320, margin: '20px auto', background: 'var(--ink)', borderRadius: 'var(--r-lg)',
          position: 'relative', overflow: 'hidden', cursor: 'pointer', display: 'grid', placeItems: 'center'
        }}>
          <div style={{ position: 'absolute', inset: 36, border: '3px solid var(--wine-soft)', borderRadius: 12 }} />
          {scanning && <div style={{ position: 'absolute', left: 36, right: 36, top: '50%', height: 2, background: 'var(--wine)', boxShadow: '0 0 16px var(--wine)', animation: 'erp-shimmer 1.4s infinite linear' }} />}
          <div style={{ textAlign: 'center', color: '#fff', zIndex: 1 }}>
            <div style={{ color: '#fff', display: 'flex', justifyContent: 'center' }}>{window.Icon.camera(38)}</div>
            <div style={{ font: '700 13px/1.4 var(--f-sans)', marginTop: 8, color: 'rgba(255,255,255,0.85)' }}>{scanning ? t('Leyendo código…', '读取代码…') : t('Toca para escanear la caja', '点击扫描箱子')}</div>
          </div>
        </div>
        <div style={{ padding: '12px 14px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.5 var(--f-sans)', marginBottom: 16, maxWidth: 320, margin: '0 auto 16px' }}>
          {t('Si la caja trae el código DTD del proveedor, el escaneo autocompleta cliente y datos. Si no lo trae, recibila manual.', '如果箱子有供应商的DTD代码, 扫描会自动填充客户和数据。如果没有, 请手动接收。')}
        </div>
        <button onClick={onManual} style={{
          height: 48, width: '100%', maxWidth: 320, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          font: '700 13.5px/1 var(--f-sans)', color: 'var(--ink-soft)', cursor: 'pointer'
        }}>{window.Icon.edit(15)}{t('Sin código · recibir manual', '无代码 · 手动接收')}</button>
      </div>
    </div>);

}

// ── Done screen ────────────────────────────────────────────
function Done({ t, onNew, onHome }) {
  const id = `CN-2026-${2843 + Math.floor(Math.random() * 50)}`;
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, textAlign: 'center', background: 'var(--bg-base)' }}>
      <div style={{
        width: 96, height: 96, borderRadius: '50%',
        background: 'var(--success-bg)', color: 'var(--success)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24, fontSize: 48
      }}>✓</div>
      <div style={{ font: '900 28px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em' }}>
        {t('¡Recepción registrada!', '接收已登记!')}
      </div>
      <code style={{ font: '800 18px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 14 }}>{id}</code>
      <div style={{ font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 16, maxWidth: '32ch' }}>
        {t('Las fotos se subieron al servidor · admin ya puede verla en Almacén CN', '照片已上传到服务器 · 管理员现在可以在仓库查看')}
      </div>

      <div style={{ width: '100%', maxWidth: 320, marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <BigButton label={t('+ Nueva recepción', '+ 新接收')} onClick={onNew} icon={window.Icon.camera(20)} />
        <BigButton label={t('Volver al inicio', '返回首页')} onClick={onHome} variant="secondary" />
      </div>
    </div>);

}

window.OperarioApp = OperarioApp;

// ── Print QR sheet ──────────────────────────────────────────
window.__PrintQRSheet = null; // placeholder

// Inject inside Home via portal-like usage. Since Home is local, expose component:
function PrintQRSheet({ open, onClose, t, lang }) {
  const [boxes, setBoxes] = React.useState(12);
  const [target, setTarget] = React.useState('local'); // local | office
  const [sent, setSent] = React.useState(false);
  const [client, setClient] = React.useState('');
  const RECENT = [
  { id: 'DTD-5452-1-2', mb: 'DTD-5452', client: 'Acindar', cn: '阿辛达尔', boxes: 12 },
  { id: 'DTD-5418-1-1', mb: 'DTD-5418', client: 'Imp. Pereira', cn: '佩雷拉进口', boxes: 8 },
  { id: 'DTD-5277-2-1', mb: 'DTD-5277', client: 'Dist. Andina', cn: '安第纳分销', boxes: 14 }];

  const QUEUE = [
  { code: 'QR-2026-1087', mb: 'DTD-5392', qty: 10, target: 'office', state: 'imprimiendo' },
  { code: 'QR-2026-1086', mb: 'DTD-5452', qty: 12, target: 'local', state: 'en cola' }];

  React.useEffect(() => {if (open) {setSent(false);setBoxes(12);setTarget('local');}}, [open]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: 18, paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 16px' }} />

        {sent ?
        <div style={{ textAlign: 'center', padding: '20px 12px' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>✓</div>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)' }}>
              {target === 'local' ?
            t('Imprimiendo en tu impresora local', '正在本地打印机打印') :
            t('Listo para imprimir en la oficina', '可在办公室打印')}
            </div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: '34ch', margin: '8px auto 0' }}>
              {target === 'local' ?
            t(`${boxes} etiquetas QR · ~30 seg`, `${boxes}张QR标签 · 约30秒`) :
            t(`Sube a la oficina, conecta por Bluetooth e imprime las ${boxes} etiquetas tú mismo.`, `上楼到办公室，通过蓝牙连接并自行打印${boxes}张标签。`)}
            </div>
            <code style={{ display: 'block', marginTop: 12, font: '700 13px/1 var(--f-mono)', color: 'var(--wine)' }}>QR-2026-{1042 + Math.floor(Math.random() * 100)}</code>
            <div style={{ marginTop: 22 }}>
              <button onClick={onClose} style={{ width: '100%', height: 52, background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', font: '800 15px/1 var(--f-sans)' }}>{t('Cerrar', '关闭')}</button>
            </div>
          </div> :

        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.print(20)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t('Imprimir códigos QR', '打印QR码')}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{t('Elige cliente → se manda a la cola de impresión', '选择客户 → 发送到打印队列')}</div>
              </div>
            </div>

            {/* Últimas recepciones · selección rápida */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{t('Compras registradas · toca para cargar', '已登记采购 · 点击加载')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {RECENT.map((r) => {
                const on = client === r.mb;
                return (
                  <button key={r.id} onClick={() => {setClient(r.mb);setBoxes(r.boxes);}} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', textAlign: 'left',
                    background: on ? 'var(--wine-tint)' : 'var(--bg-surface)',
                    border: `1px solid ${on ? 'var(--wine)' : 'var(--border)'}`, borderRadius: 'var(--r-md)'
                  }}>
                      <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.id}</code>
                      <span style={{ flex: 1, font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{lang === 'cn' ? r.cn : r.client}</span>
                      <span style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.boxes} {t('cj', '箱')}</span>
                      {on && <span style={{ color: 'var(--wine)', font: '700 12px/1' }}>✓</span>}
                    </button>);

              })}
              </div>
            </div>

            {/* Cliente */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('Cliente · Shipping Mark', '客户 · Shipping Mark')}</span>
              <select value={client} onChange={(e) => setClient(e.target.value)} style={{ height: 44, padding: '0 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '600 13px/1 var(--f-sans)', color: 'var(--ink)' }}>
                <option value="">{t('Selecciona cliente…', '选择客户…')}</option>
                <option value="DTD-5452">DTD-5452 · Acindar Comercial</option>
                <option value="DTD-5392">DTD-5392 · Industrias Polar</option>
                <option value="DTD-5418">DTD-5418 · Imp. Pereira</option>
                <option value="DTD-5277">DTD-5277 · BriceñoTex</option>
              </select>
            </label>

            {/* Cantidad */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('Cantidad de etiquetas QR', 'QR标签数量')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setBoxes(Math.max(1, boxes - 1))} style={{ width: 44, height: 44, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '800 22px/1 var(--f-display)', color: 'var(--ink)' }}>−</button>
                <input type="number" value={boxes} onChange={(e) => setBoxes(Math.max(1, +e.target.value || 1))} inputMode="numeric"
              style={{ flex: 1, height: 44, padding: '0 14px', textAlign: 'center', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '900 22px/1 var(--f-mono)', color: 'var(--ink)', outline: 'none' }} />
                <button onClick={() => setBoxes(boxes + 1)} style={{ width: 44, height: 44, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '800 22px/1 var(--f-display)', color: 'var(--ink)' }}>+</button>
              </div>
              <span style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>{t('Una etiqueta por cada caja recibida', '每个收到的箱子一张标签')}</span>
            </label>

            {/* Preview QR */}
            <div style={{ padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 72, height: 72, background: '#fff', border: '2px solid var(--ink)', borderRadius: 4, padding: 6 }}>
                <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                  {Array.from({ length: 100 }).map((_, i) => {
                  const x = i % 10 * 10;const y = Math.floor(i / 10) * 10;
                  const fill = i * 7 % 13 < 6 || i % 10 === 0 || i % 10 === 9;
                  return fill ? <rect key={i} x={x} y={y} width="10" height="10" fill="#0F1E3D" /> : null;
                })}
                  <rect x="0" y="0" width="30" height="30" fill="#fff" /><rect x="5" y="5" width="20" height="20" fill="#0F1E3D" /><rect x="10" y="10" width="10" height="10" fill="#fff" />
                  <rect x="70" y="0" width="30" height="30" fill="#fff" /><rect x="75" y="5" width="20" height="20" fill="#0F1E3D" /><rect x="80" y="10" width="10" height="10" fill="#fff" />
                  <rect x="0" y="70" width="30" height="30" fill="#fff" /><rect x="5" y="75" width="20" height="20" fill="#0F1E3D" /><rect x="10" y="80" width="10" height="10" fill="#fff" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t('Preview', '预览')}</div>
                <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 6, display: 'block' }}>{client || 'DTD-XXXX'} · 1/{boxes}</code>
                <div style={{ font: '500 10.5px/1.3 "Noto Sans SC", var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>义乌仓库 · DTD-CARGO</div>
                <div style={{ font: '500 10px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>4cm × 4cm · adhesiva</div>
              </div>
            </div>

            {/* Destino impresión */}
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>{t('¿Dónde imprimir?', '在哪里打印?')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <button onClick={() => setTarget('local')} style={{
              padding: 14, textAlign: 'left',
              background: target === 'local' ? 'var(--wine-tint)' : 'var(--bg-surface)',
              border: `1.5px solid ${target === 'local' ? 'var(--wine)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)'
            }}>
                <div style={{ color: target === 'local' ? 'var(--wine)' : 'var(--ink-soft)' }}>{window.Icon.print(24)}</div>
                <div style={{ font: '800 12.5px/1.2 var(--f-display)', color: target === 'local' ? 'var(--wine)' : 'var(--ink)', marginTop: 6 }}>{t('Impresora local', '本地打印机')}</div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{t('Brother QL-820 · YIW-A1', 'Brother QL-820 · YIW-A1')}</div>
                <div style={{ marginTop: 6, padding: '2px 6px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 3, font: '700 9px/1 var(--f-sans)', display: 'inline-block' }}>{t('● ONLINE', '● 在线')}</div>
              </button>
              <button onClick={() => setTarget('office')} style={{
              padding: 14, textAlign: 'left',
              background: target === 'office' ? 'var(--wine-tint)' : 'var(--bg-surface)',
              border: `1.5px solid ${target === 'office' ? 'var(--wine)' : 'var(--border)'}`,
              borderRadius: 'var(--r-md)'
            }}>
                <div style={{ color: target === 'office' ? 'var(--wine)' : 'var(--ink-soft)' }}>{window.Icon.building(24)}</div>
                <div style={{ font: '800 12.5px/1.2 var(--f-display)', color: target === 'office' ? 'var(--wine)' : 'var(--ink)', marginTop: 6 }}>{t('Oficina · autoservicio', '办公室 · 自助')}</div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{t('Subes y conectás por Bluetooth', '上楼通过蓝牙连接')}</div>
                <div style={{ marginTop: 6, padding: '2px 6px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 3, font: '700 9px/1 var(--f-sans)', display: 'inline-block' }}>{t('cola: 2 órdenes', '队列: 2个订单')}</div>
              </button>
            </div>

            {target === 'office' &&
          <div style={{ padding: '10px 12px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', marginBottom: 12, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
                {t('Subes a la oficina, te conectás a la impresora por Bluetooth e imprimís tú mismo — sin que nadie intervenga. Ahí ves la cola y todas las recepciones.', '上楼到办公室，通过蓝牙连接打印机自行打印 — 无需他人干预。在那里可查看队列和所有接收。')}
              </div>
          }

            <button onClick={() => {
            // Push to ERP queue (B2)
            if (target === 'office') {
              try {
                const QR_LS_KEY = 'dtd_qrqueue_v1';
                const existing = JSON.parse(localStorage.getItem(QR_LS_KEY) || '[]');
                const clientObj = window.ERPData?.byMarkbox?.(client);
                const seq = 1118 + existing.length + 1;
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                const sentAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
                const newOrder = {
                  id: `QR-2026-${seq}`,
                  markbox: client,
                  client: clientObj?.company || client,
                  bultos: boxes,
                  warehouse: 'cn-yiwu',
                  supplier: 'Pendiente · taggear en oficina',
                  sentBy: 'Liu Wei',
                  sentByPhone: '+86 138 8829',
                  sentAt,
                  priority: 'normal',
                  status: 'pendiente',
                  notes: ''
                };
                localStorage.setItem(QR_LS_KEY, JSON.stringify([newOrder, ...existing]));
              } catch (e) {/* silent — móvil sigue mostrando OK */}
            }
            setSent(true);
          }} disabled={!client} style={{
            width: '100%', height: 56,
            background: client ? 'var(--wine)' : 'var(--bg-elevated)',
            color: client ? '#fff' : 'var(--ink-mute)',
            border: 0, borderRadius: 'var(--r-md)',
            font: '800 15px/1 var(--f-sans)',
            opacity: client ? 1 : 0.6, cursor: client ? 'pointer' : 'not-allowed'
          }}>
              {target === 'local' ? `${t('Imprimir acá', '在这里打印')} (${boxes})` : `${t('Imprimir en oficina', '在办公室打印')} (${boxes})`}
            </button>

            {/* Cola pendiente por imprimir */}
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('Cola pendiente por imprimir', '待打印队列')}</span>
                <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine)', padding: '3px 7px', background: 'var(--wine-tint)', borderRadius: 999 }}>{QUEUE.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {QUEUE.map((q) => {
                const printing = q.state === 'imprimiendo';
                return (
                  <div key={q.code} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                      <span style={{ display: 'flex' }}>{q.target === 'office' ? window.Icon.building(16) : window.Icon.print(16)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <code style={{ font: '800 11px/1 var(--f-mono)', color: 'var(--ink)' }}>{q.code}</code>
                        <div style={{ font: '500 10.5px/1.2 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 2 }}>{q.mb} · {q.qty} {t('etiquetas', '标签')}</div>
                      </div>
                      <span style={{ font: '700 9.5px/1 var(--f-sans)', padding: '4px 8px', borderRadius: 999, background: printing ? 'var(--info-bg)' : 'var(--bg-elevated)', color: printing ? 'var(--info)' : 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                        {printing ? `● ${t('imprimiendo', '打印中')}` : t('en cola', '排队中')}
                      </span>
                    </div>);

              })}
              </div>
            </div>
          </>
        }
      </div>
    </div>);

}

window.PrintQRSheet = PrintQRSheet;