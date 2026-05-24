/* global React */
/* ── DTD · Operario CN · Mobile App ─────────────────────────── */

const { useState, useEffect } = React;

function OperarioApp() {
  const [view, setView] = useState('login');
  const [lang, setLang] = useState('es'); // 'es' | 'cn'
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [reception, setReception] = useState({ photos: [], client: '', orphan: false, marks: '', boxes: '', cbm: '', weight: '', supplier: '', hs: '', incident: false, incidentNote: '' });

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const t = (es, cn) => lang === 'cn' ? cn : es;

  const reset = () => setReception({ photos: [], client: '', orphan: false, marks: '', boxes: '', cbm: '', weight: '', supplier: '', hs: '', incident: false, incidentNote: '' });

  return (
    <div className="op-app">
      {view === 'login'    && <Login onLogin={(u) => { setUser(u); setView('home'); }} lang={lang} setLang={setLang} t={t} />}
      {view === 'home'     && <Home user={user} t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} onStart={() => { reset(); setView('step1'); }} onLogout={() => { setUser(null); setView('login'); }} />}
      {view === 'step1'    && <Step1Photos t={t} reception={reception} setReception={setReception} onBack={() => setView('home')} onNext={() => setView('step2')} />}
      {view === 'step2'    && <Step2Identify t={t} reception={reception} setReception={setReception} onBack={() => setView('step1')} onNext={() => setView('step3')} />}
      {view === 'step3'    && <Step3Data t={t} reception={reception} setReception={setReception} onBack={() => setView('step2')} onNext={() => setView('step4')} />}
      {view === 'step4'    && <Step4Confirm t={t} reception={reception} setReception={setReception} onBack={() => setView('step3')} onSubmit={() => setView('done')} />}
      {view === 'done'     && <Done t={t} onNew={() => { reset(); setView('step1'); }} onHome={() => setView('home')} />}
    </div>
  );
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
      alignItems: 'center', paddingTop: 14,
    }}>
      {back ? (
        <button onClick={back} style={{
          width: 44, height: 44, borderRadius: 'var(--r-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-soft)',
        }}>{window.Icon.arrowL(20)}</button>
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
    ghost: { bg: 'transparent', fg: 'var(--ink)' },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 56,
      background: v.bg, color: v.fg,
      borderRadius: 'var(--r-md)',
      font: '800 16px/1 var(--f-sans)',
      letterSpacing: '-0.01em',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      {icon}
      {label}
    </button>
  );
}

function LangSwitch({ lang, setLang }) {
  return (
    <div style={{ display: 'inline-flex', padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      {[
        { v: 'es', l: 'ES' },
        { v: 'cn', l: '中文' },
      ].map(o => (
        <button key={o.v} onClick={() => setLang(o.v)} style={{
          padding: '6px 12px', borderRadius: 'var(--r-sm)',
          background: lang === o.v ? 'var(--wine)' : 'transparent',
          color: lang === o.v ? '#fff' : 'var(--ink-soft)',
          font: `700 12px/1 ${o.v === 'cn' ? '"Noto Sans SC"' : 'var(--f-sans)'}`,
        }}>{o.l}</button>
      ))}
    </div>
  );
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
      color: '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <img src="assets/dtdcargo-icon-navy.png" alt="" style={{ width: 40, height: 40, filter: 'brightness(0) invert(1)' }} />
        <LangSwitch lang={lang} setLang={setLang} />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>DTD-CARGO · 操作员</div>
        <div style={{ font: '900 32px/1.05 var(--f-display)', color: '#fff', marginTop: 14, letterSpacing: '-0.025em' }}>{t('Almacén Yiwu', '义乌仓库')}</div>
        <div style={{ font: '500 14px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>{t('Ingresá tu PIN de 4 dígitos', '请输入4位PIN密码')}</div>

        {/* PIN dots */}
        <div style={{ display: 'flex', gap: 14, marginTop: 36 }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{
              width: 18, height: 18, borderRadius: '50%',
              background: i < pin.length ? 'var(--wine-soft)' : 'transparent',
              border: '2px solid rgba(255,255,255,0.4)',
              transition: 'background var(--dur-fast) var(--ease)',
            }} />
          ))}
        </div>

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 14, marginTop: 36 }}>
          {[1,2,3,4,5,6,7,8,9].map(n => (
            <button key={n} onClick={() => handleDigit(String(n))} style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', color: '#fff',
              font: '900 28px/1 var(--f-display)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}>{n}</button>
          ))}
          <div />
          <button onClick={() => handleDigit('0')} style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)', color: '#fff',
            font: '900 28px/1 var(--f-display)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}>0</button>
          <button onClick={backspace} style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'transparent', color: 'rgba(255,255,255,0.6)',
          }}>{window.Icon.close(22)}</button>
        </div>
      </div>

      <div style={{ textAlign: 'center', font: '500 11px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.4)' }}>
        {t('Wang Hua · 王华 · YIW-A1', 'Wang Hua · 王华 · YIW-A1')}<br/>
        v1.0 · DTD-CARGO 2026
      </div>
    </div>
  );
}

// ── Home ────────────────────────────────────────────────────
function Home({ user, t, lang, setLang, theme, setTheme, onStart, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  return (
    <div>
      <MobileHeader
        title={t('Mi día', '今日工作')}
        subtitle="YIW-A1 · 义乌港二期"
        right={
          <button onClick={() => setMenuOpen(true)} style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', color: 'var(--ink-soft)' }}>{window.Icon.menu(20)}</button>
        }
      />

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
            {t('Hoy llevás 3 recepciones · 18 cajas · 12.4 CBM', '今日已收 3 件 · 18 箱 · 12.4 CBM')}
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
          <button onClick={() => setPrintOpen(true)} style={{
            width: '100%', padding: 14, marginBottom: 10,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderLeft: '4px solid var(--wine)', borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
          }}>
            <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖨</div>
            <div style={{ flex: 1 }}>
              <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>{t('Imprimir códigos QR', '打印QR码')}</div>
              <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{t('Etiquetas DTD para pegar en cada caja', '用于贴在每个箱子上的DTD标签')}</div>
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
              { id: 'CN-2026-2840', client: 'Dist. Andina', cn: '安第纳分销', boxes: 14, cbm: 5.4, time: t('hace 2 h', '2小时前'), photos: 4 },
            ].map(r => (
              <div key={r.id} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12,
                padding: 12, background: 'var(--bg-surface)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                alignItems: 'center',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--r-sm)',
                  background: 'var(--wine-tint)', color: 'var(--wine)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: '800 12px/1 var(--f-display)',
                }}>📦</div>
                <div style={{ minWidth: 0 }}>
                  <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}</code>
                  <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 3 }}>
                    {lang === 'cn' ? r.cn : r.client}
                  </div>
                  <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>
                    {r.boxes}{t('cj', '箱')} · {r.cbm} CBM · 📸 {r.photos} · {r.time}
                  </div>
                </div>
                <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.chevR(14)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAB */}
      <div style={{
        position: 'fixed', bottom: 'env(safe-area-inset-bottom)', left: 0, right: 0,
        padding: '12px 16px 18px',
        background: 'linear-gradient(0deg, var(--bg-base) 50%, transparent 100%)',
      }}>
        <BigButton label={t('+ Nueva recepción', '+ 新接收')} onClick={onStart} icon={<span style={{ fontSize: 22 }}>📷</span>} />
      </div>

      {/* Menu modal */}
      {/* Menu modal */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.4)', zIndex: 50,
          display: 'flex', alignItems: 'flex-end',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', background: 'var(--bg-surface)',
            borderRadius: '20px 20px 0 0', padding: 20,
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
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
              marginTop: 12,
            }}>{t('Cerrar sesión', '退出登录')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, tone }) {
  const c = { wine: 'var(--wine)', info: 'var(--info)', warning: 'var(--warning)' }[tone];
  return (
    <div style={{
      padding: 12, background: 'var(--bg-surface)',
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      textAlign: 'left',
    }}>
      <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '900 22px/1 var(--f-display)', color: c, marginTop: 8, letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────
function Steps({ current }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '0 16px 16px' }}>
      {[1,2,3,4].map(n => (
        <div key={n} style={{
          height: 4, borderRadius: 999,
          background: n <= current ? 'var(--wine)' : 'var(--bg-elevated)',
        }} />
      ))}
    </div>
  );
}

// ── Step 1: Photos ────────────────────────────────────────
function Step1Photos({ t, reception, setReception, onBack, onNext }) {
  const photos = reception.photos;
  const addPhoto = () => setReception({ ...reception, photos: [...photos, { id: Date.now(), preview: ['box-front', 'label', 'inside', 'damage'][photos.length % 4] }] });
  const removePhoto = (id) => setReception({ ...reception, photos: photos.filter(p => p.id !== id) });

  return (
    <div>
      <MobileHeader title={t('1 de 4 · Fotos', '1/4 · 拍照')} subtitle={t('Tomá 3 fotos mínimo', '至少拍3张照片')} back={onBack} />
      <Steps current={1} />

      <div style={{ padding: '0 16px 100px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {photos.map(p => (
            <div key={p.id} style={{
              position: 'relative', aspectRatio: '4/3',
              background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
              border: '1px solid var(--border)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <PhotoMock kind={p.preview} />
              <button onClick={() => removePhoto(p.id)} style={{
                position: 'absolute', top: 6, right: 6,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(168,50,62,0.9)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{window.Icon.close(12)}</button>
            </div>
          ))}
          <button onClick={addPhoto} style={{
            aspectRatio: '4/3',
            background: 'var(--wine)',
            color: '#fff', borderRadius: 'var(--r-md)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            font: '800 14px/1 var(--f-sans)',
          }}>
            <span style={{ fontSize: 32 }}>📷</span>
            {t('Tomar foto', '拍照')}
          </button>
        </div>

        {photos.length > 0 && photos.length < 3 && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            <span style={{ color: 'var(--warning)' }}>⚠</span>
            {t(`Faltan ${3 - photos.length} fotos · mínimo 3 para registrar`, `还需${3 - photos.length}张照片 · 至少3张`)}
          </div>
        )}

        {photos.length >= 3 && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--success-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            <span style={{ color: 'var(--success)' }}>✓</span>
            {t('Fotos suficientes · podés seguir', '照片足够 · 可以继续')}
          </div>
        )}

        <div style={{ marginTop: 14, font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
          {t('Tomá: 1) frente con etiqueta · 2) supplier label · 3) contenido · 4) daños si hay', '拍摄：1) 正面带标签 · 2) 供应商标签 · 3) 内容 · 4) 损坏（如有）')}
        </div>
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={photos.length < 3} t={t} />
    </div>
  );
}

function PhotoMock({ kind }) {
  // Simple SVG mockup
  const map = { 'box-front': '📦', 'label': '🏷', 'inside': '📋', 'damage': '⚠️' };
  return (
    <div style={{ fontSize: 48, opacity: 0.4 }}>{map[kind] || '📦'}</div>
  );
}

function BottomActions({ back, next, nextDisabled, t, submitLabel, onSubmit }) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      padding: '12px 16px',
      paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
      background: 'var(--bg-base)',
      borderTop: '1px solid var(--border)',
      display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10,
    }}>
      <BigButton label={t('Atrás', '上一步')} onClick={back} variant="secondary" />
      <BigButton
        label={submitLabel || t('Siguiente →', '下一步 →')}
        onClick={onSubmit || next}
        disabled={nextDisabled}
      />
    </div>
  );
}

// ── Step 2: Identify (client or orphan) ───────────────────
function Step2Identify({ t, reception, setReception, onBack, onNext }) {
  const D = window.ERPData;
  const clients = D?.CLIENTS || [];
  const [search, setSearch] = useState('');
  const filtered = clients.filter(c => c.markbox.toLowerCase().includes(search.toLowerCase()) || c.company.toLowerCase().includes(search.toLowerCase())).slice(0, 8);

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
          textAlign: 'left',
        }}>
          <input type="checkbox" checked={reception.orphan} readOnly style={{ accentColor: 'var(--warning)', width: 18, height: 18 }} />
          <span style={{ flex: 1, font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
            📦 {t('Caja sin código · huérfana', '无编码 · 孤箱')}
          </span>
        </button>

        {reception.orphan ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <MobileInput
              label={t('Marcas visibles en la caja', '箱子上可见标记')}
              value={reception.marks}
              onChange={(v) => setReception({ ...reception, marks: v })}
              placeholder={t('Ej: ACINDAR-VLN-04 · etiqueta china', '例: ACINDAR-VLN-04 · 中文标签')}
            />
            <MobileInput
              label={t('¿Quién la trajo?', '谁送的?')}
              value=""
              onChange={() => {}}
              placeholder={t('Chofer o courier', '司机或快递')}
            />
          </div>
        ) : (
          <div>
            <MobileInput
              label={t('Buscar cliente · MARKBOX', '查找客户 · MARKBOX')}
              value={search}
              onChange={setSearch}
              placeholder="DTD-XXXX"
              mono
            />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(c => {
                const sel = reception.client === c.markbox;
                return (
                  <button key={c.markbox} onClick={() => setClient(c.markbox)} style={{
                    display: 'grid', gridTemplateColumns: '90px 1fr 22px', gap: 10,
                    padding: '12px 14px',
                    background: sel ? 'var(--wine-tint)' : 'var(--bg-surface)',
                    border: `1px solid ${sel ? 'var(--wine)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)',
                    alignItems: 'center', textAlign: 'left',
                  }}>
                    <code style={{ font: '800 12px/1 var(--f-mono)', color: sel ? 'var(--wine)' : 'var(--ink)' }}>{c.markbox}</code>
                    <span style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</span>
                    {sel && <span style={{ color: 'var(--wine)' }}>{window.Icon.check(14)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={!canNext} t={t} />
    </div>
  );
}

// ── Step 3: Box data ──────────────────────────────────────
function Step3Data({ t, reception, setReception, onBack, onNext }) {
  const set = (k, v) => setReception({ ...reception, [k]: v });
  const canNext = reception.boxes && reception.cbm;

  return (
    <div>
      <MobileHeader title={t('3 de 4 · Datos', '3/4 · 数据')} subtitle={t('Dimensiones y supplier', '尺寸和供应商')} back={onBack} />
      <Steps current={3} />

      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MobileInput label={t('Proveedor chino', '中国供应商')} value={reception.supplier} onChange={(v) => set('supplier', v)} placeholder={t('Nombre del supplier', '供应商名称')} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <MobileInput label={t('Cajas', '箱数')} value={reception.boxes} onChange={(v) => set('boxes', v)} placeholder="0" mono large numeric />
          <MobileInput label="CBM" value={reception.cbm} onChange={(v) => set('cbm', v)} placeholder="0.0" mono large numeric suffix="m³" />
        </div>

        <MobileInput label={t('Peso total', '总重量')} value={reception.weight} onChange={(v) => set('weight', v)} placeholder="0" mono numeric suffix="kg" />

        <MobileInput label={t('HS Code (opcional · del supplier)', 'HS编码 (可选 · 来自供应商)')} value={reception.hs} onChange={(v) => set('hs', v)} placeholder="0000.00" mono />
      </div>

      <BottomActions back={onBack} next={onNext} nextDisabled={!canNext} t={t} />
    </div>
  );
}

function MobileInput({ label, value, onChange, placeholder, mono, large, numeric, suffix }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: large ? 56 : 48, padding: '0 14px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      }}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={numeric ? 'decimal' : 'text'}
          style={{
            flex: 1, height: '100%', border: 0, outline: 'none', background: 'transparent',
            font: `${mono ? '700' : '600'} ${large ? 24 : 15}px/1 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`,
            color: 'var(--ink)',
          }}
        />
        {suffix && <span style={{ font: '600 13px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{suffix}</span>}
      </div>
    </label>
  );
}

// ── Step 4: Confirm + incident ─────────────────────────────
function Step4Confirm({ t, reception, setReception, onBack, onSubmit }) {
  const D = window.ERPData;
  const client = reception.client ? D?.CLIENTS?.find(c => c.markbox === reception.client) : null;

  return (
    <div>
      <MobileHeader title={t('4 de 4 · Confirmar', '4/4 · 确认')} subtitle={t('Revisá y guardá', '检查并保存')} back={onBack} />
      <Steps current={4} />

      <div style={{ padding: '0 16px 100px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Summary */}
        <div style={{ padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>{t('Resumen', '总结')}</div>
          <SummaryRow label="📷 Fotos" value={`${reception.photos.length}`} />
          <SummaryRow label={t('Cliente', '客户')} value={reception.orphan ? `🟠 ${t('Huérfana · ' + reception.marks, '孤箱')}` : client?.company || reception.client} />
          <SummaryRow label={t('Supplier', '供应商')} value={reception.supplier || '—'} />
          <SummaryRow label={t('Cajas', '箱')} value={reception.boxes} />
          <SummaryRow label="CBM" value={`${reception.cbm} m³`} />
          {reception.weight && <SummaryRow label={t('Peso', '重量')} value={`${reception.weight} kg`} />}
          {reception.hs && <SummaryRow label="HS" value={reception.hs} />}
        </div>

        {/* Incident toggle */}
        <button onClick={() => setReception({ ...reception, incident: !reception.incident })} style={{
          padding: '14px 16px',
          background: reception.incident ? 'var(--danger-bg)' : 'var(--bg-elevated)',
          border: `1px solid ${reception.incident ? 'var(--danger)' : 'var(--border)'}`,
          borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 10,
          textAlign: 'left',
        }}>
          <input type="checkbox" checked={reception.incident} readOnly style={{ accentColor: 'var(--danger)', width: 18, height: 18 }} />
          <span style={{ flex: 1, font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
            ⚠️ {t('Reportar daño / incidencia', '报告损坏/事故')}
          </span>
        </button>

        {reception.incident && (
          <MobileInput
            label={t('Descripción de la incidencia', '事故描述')}
            value={reception.incidentNote}
            onChange={(v) => setReception({ ...reception, incidentNote: v })}
            placeholder={t('Ej: caja golpeada · contenido mojado', '例: 箱子损坏 · 内容潮湿')}
          />
        )}
      </div>

      <BottomActions back={onBack} t={t} submitLabel={t('✓ Guardar recepción', '✓ 保存接收')} onSubmit={onSubmit} />
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ font: '700 13px/1.4 var(--f-sans)', color: 'var(--ink)', textAlign: 'right' }}>{value}</span>
    </div>
  );
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
        marginBottom: 24, fontSize: 48,
      }}>✓</div>
      <div style={{ font: '900 28px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.025em' }}>
        {t('¡Recepción registrada!', '接收已登记!')}
      </div>
      <code style={{ font: '800 18px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 14 }}>{id}</code>
      <div style={{ font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 16, maxWidth: '32ch' }}>
        {t('Las fotos se subieron al servidor · admin ya puede verla en Almacén CN', '照片已上传到服务器 · 管理员现在可以在仓库查看')}
      </div>

      <div style={{ width: '100%', maxWidth: 320, marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <BigButton label={t('+ Nueva recepción', '+ 新接收')} onClick={onNew} icon={<span style={{ fontSize: 22 }}>📷</span>} />
        <BigButton label={t('Volver al inicio', '返回首页')} onClick={onHome} variant="secondary" />
      </div>
    </div>
  );
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
  React.useEffect(() => { if (open) { setSent(false); setBoxes(12); setTarget('local'); } }, [open]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 auto', background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', padding: 18, paddingBottom: 'calc(env(safe-area-inset-bottom) + 18px)', maxHeight: '92vh', overflow: 'auto' }}>
        <div style={{ width: 40, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 16px' }} />

        {sent ? (
          <div style={{ textAlign: 'center', padding: '20px 12px' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>✓</div>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)' }}>
              {target === 'local'
                ? t('Imprimiendo en tu impresora local', '正在本地打印机打印')
                : t('Orden enviada a la oficina', '订单已发送到办公室')}
            </div>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: '34ch', margin: '8px auto 0' }}>
              {target === 'local'
                ? t(`${boxes} etiquetas QR · ~30 seg`, `${boxes}张QR标签 · 约30秒`)
                : t(`La oficina va a imprimir ${boxes} QR y avisarte cuando estén listos.`, `办公室将打印${boxes}张QR并通知您。`)}
            </div>
            <code style={{ display: 'block', marginTop: 12, font: '700 13px/1 var(--f-mono)', color: 'var(--wine)' }}>QR-2026-{1042 + Math.floor(Math.random() * 100)}</code>
            <div style={{ marginTop: 22 }}>
              <button onClick={onClose} style={{ width: '100%', height: 52, background: 'var(--wine)', color: '#fff', border: 0, borderRadius: 'var(--r-md)', font: '800 15px/1 var(--f-sans)' }}>{t('Cerrar', '关闭')}</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🖨</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t('Imprimir códigos QR', '打印QR码')}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{t('Etiquetas DTD para pegar en cajas', '用于贴在箱子上的DTD标签')}</div>
              </div>
            </div>

            {/* Cliente */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('Cliente · MARKBOX', '客户 · MARKBOX')}</span>
              <select value={client} onChange={(e) => setClient(e.target.value)} style={{ height: 44, padding: '0 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '600 13px/1 var(--f-sans)', color: 'var(--ink)' }}>
                <option value="">{t('Seleccioná cliente…', '选择客户…')}</option>
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
                    const x = (i % 10) * 10; const y = Math.floor(i / 10) * 10;
                    const fill = ((i * 7) % 13 < 6) || (i % 10 === 0 || i % 10 === 9);
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
                borderRadius: 'var(--r-md)',
              }}>
                <div style={{ fontSize: 24 }}>🖨</div>
                <div style={{ font: '800 12.5px/1.2 var(--f-display)', color: target === 'local' ? 'var(--wine)' : 'var(--ink)', marginTop: 6 }}>{t('Impresora local', '本地打印机')}</div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{t('Brother QL-820 · YIW-A1', 'Brother QL-820 · YIW-A1')}</div>
                <div style={{ marginTop: 6, padding: '2px 6px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 3, font: '700 9px/1 var(--f-sans)', display: 'inline-block' }}>{t('● ONLINE', '● 在线')}</div>
              </button>
              <button onClick={() => setTarget('office')} style={{
                padding: 14, textAlign: 'left',
                background: target === 'office' ? 'var(--wine-tint)' : 'var(--bg-surface)',
                border: `1.5px solid ${target === 'office' ? 'var(--wine)' : 'var(--border)'}`,
                borderRadius: 'var(--r-md)',
              }}>
                <div style={{ fontSize: 24 }}>🏢</div>
                <div style={{ font: '800 12.5px/1.2 var(--f-display)', color: target === 'office' ? 'var(--wine)' : 'var(--ink)', marginTop: 6 }}>{t('Oficina DTD', 'DTD办公室')}</div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{t('Yiwu · oficina central', '义乌 · 总部办公室')}</div>
                <div style={{ marginTop: 6, padding: '2px 6px', background: 'var(--info-bg)', color: 'var(--info)', borderRadius: 3, font: '700 9px/1 var(--f-sans)', display: 'inline-block' }}>{t('cola: 2 órdenes', '队列: 2个订单')}</div>
              </button>
            </div>

            {target === 'office' && (
              <div style={{ padding: '10px 12px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', marginBottom: 12, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
                ℹ {t('La oficina recibe la orden, imprime, y te avisa por WhatsApp cuando podés pasar a buscarlas.', '办公室收到订单后打印，并通过WhatsApp通知您何时可以取。')}
              </div>
            )}

            <button onClick={() => setSent(true)} disabled={!client} style={{
              width: '100%', height: 56,
              background: client ? 'var(--wine)' : 'var(--bg-elevated)',
              color: client ? '#fff' : 'var(--ink-mute)',
              border: 0, borderRadius: 'var(--r-md)',
              font: '800 15px/1 var(--f-sans)',
              opacity: client ? 1 : 0.6, cursor: client ? 'pointer' : 'not-allowed',
            }}>
              {target === 'local' ? `🖨 ${t('Imprimir acá', '在这里打印')} (${boxes})` : `🏢 ${t('Enviar a oficina', '发送到办公室')} (${boxes})`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

window.PrintQRSheet = PrintQRSheet;
