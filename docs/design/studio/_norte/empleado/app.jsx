/* global React */
/* ── DTD Cargo · App del Empleado · v1.0 ─────────────────────────
   App de teléfono para el EMPLEADO (autoservicio de nómina).
   Login propio → recibo de pago + inbox de comunicaciones (recibo,
   aviso, llamado de atención, amonestación). Reusa tokens + ERPUI +
   ERPData + NominaData + ERPRates. Brand-compliant: logo reverse
   sobre navy, cero hex inventados, fuentes del sistema.            */

const { useState: eaState, useEffect: eaEffect } = React;

const EA_SESSION = 'dtd-emp-session';
const EA_PERIOD = { label: 'Mayo 2026', bono: 40 };

function eaReadSession() { try { return localStorage.getItem(EA_SESSION) || null; } catch (e) { return null; } }
function eaWriteSession(v) { try { if (v) localStorage.setItem(EA_SESSION, v); else localStorage.removeItem(EA_SESSION); } catch (e) {} }
function eaHaptic(ms = 8) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
function eaRegToken() { try { return new URLSearchParams(location.search).get('reg') || null; } catch (e) { return null; } }

// Empleados con login: usuarios rol 'Empleado' enlazados a su ficha (empId),
// más los empleados aprobados por auto-registro (NominaData.empLogins).
function eaEmpUsers() {
  const D = window.ERPData;
  const base = (D.USERS || []).filter(u => u.role === 'Empleado' && u.empId);
  const reg = (window.NominaData.empLogins ? window.NominaData.empLogins() : []);
  const seen = new Set(base.map(u => u.empId));
  return [...base, ...reg.filter(u => !seen.has(u.empId))];
}
function eaEmpById(empId) {
  const N = window.NominaData;
  return N.EMPLOYEES.find(e => e.id === empId);
}

// ════════════════════════════════════════════════════════════════
// Marco de teléfono
// ════════════════════════════════════════════════════════════════
function EAPhone({ children, dark }) {
  return (
    <div style={{
      width: 'min(420px, 100vw)', height: 'min(880px, 100vh)',
      background: dark ? 'var(--ink)' : 'var(--bg-base)',
      borderRadius: 'min(34px, 0px)', overflow: 'hidden', position: 'relative',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 24px 70px -20px rgba(15,30,61,0.45)',
    }}>
      {children}
    </div>
  );
}

function EAStatusBar({ dark }) {
  const fg = dark ? 'rgba(255,255,255,0.92)' : 'var(--ink)';
  return (
    <div style={{ flexShrink: 0, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', font: '700 13px/1 var(--f-sans)', color: fg }}>
      <span>9:41</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ font: '600 11px/1 var(--f-sans)' }}>5G</span>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 11 }}>
          {[5, 7, 9, 11].map((h, i) => <span key={i} style={{ width: 3, height: h, borderRadius: 1, background: fg }} />)}
        </div>
        <div style={{ width: 22, height: 11, borderRadius: 3, border: `1.5px solid ${fg}`, position: 'relative', opacity: 0.9 }}>
          <div style={{ position: 'absolute', inset: 1.5, width: '72%', background: fg, borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// App root
// ════════════════════════════════════════════════════════════════
function EmpleadoApp() {
  const [empId, setEmpId] = eaState(eaReadSession);
  const [tab, setTab] = eaState('inicio');
  const [authView, setAuthView] = eaState(() => (eaRegToken() ? 'registro' : 'login'));
  const [, force] = React.useReducer(x => x + 1, 0);
  const regToken = eaRegToken();

  eaEffect(() => { document.documentElement.setAttribute('data-theme', 'light'); }, []);
  eaEffect(() => {
    const f = () => force();
    window.addEventListener('dtd-nomina-changed', f);
    return () => window.removeEventListener('dtd-nomina-changed', f);
  }, []);

  const emp = empId ? eaEmpById(empId) : null;

  const login = (id) => { eaWriteSession(id); eaHaptic(12); setEmpId(id); setTab('inicio'); };
  const logout = () => { eaWriteSession(null); setEmpId(null); };

  if (!emp) {
    const dark = authView !== 'registro';
    return (
      <EAPhone dark={dark}>
        <EAStatusBar dark={dark} />
        {authView === 'login' && <EALogin onLogin={login} onRegister={() => { eaHaptic(); setAuthView('registro'); }} />}
        {authView === 'registro' && <EARegistro token={regToken} onCancel={() => setAuthView('login')} onDone={() => setAuthView('enviado')} />}
        {authView === 'enviado' && <EARegistroEnviado onBack={() => setAuthView('login')} />}
      </EAPhone>
    );
  }

  return (
    <EAPhone>
      <EAStatusBar />
      <div key={tab} style={{ flex: 1, overflowY: 'auto', animation: 'erp-fade 220ms var(--ease)' }}>
        {tab === 'inicio'   && <EAInicio emp={emp} go={setTab} />}
        {tab === 'recibo'   && <EARecibo emp={emp} />}
        {tab === 'mensajes' && <EAMensajes emp={emp} />}
        {tab === 'perfil'   && <EAPerfil emp={emp} onLogout={logout} />}
      </div>
      <EATabBar tab={tab} setTab={setTab} emp={emp} />
    </EAPhone>
  );
}

// ════════════════════════════════════════════════════════════════
// Login
// ════════════════════════════════════════════════════════════════
function EALogin({ onLogin, onRegister }) {
  const users = eaEmpUsers();
  const [email, setEmail] = eaState(users[0] ? users[0].email : '');
  const [pw, setPw] = eaState('');
  const [err, setErr] = eaState('');

  const submit = () => {
    const u = users.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) { setErr('No encontramos una cuenta de empleado con ese correo.'); eaHaptic(20); return; }
    if (!pw.trim()) { setErr('Ingresa tu contraseña.'); return; }
    setErr('');
    onLogin(u.empId);
  };

  const field = {
    width: '100%', padding: '13px 14px', borderRadius: 'var(--r-md)', border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)', color: '#fff', font: '500 14px/1.2 var(--f-sans)', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 28px 32px', background: 'linear-gradient(135deg, var(--ink), #1F3055)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <img src="assets/dtdcargo-isologo-reverse.png" alt="DTD Cargo" style={{ height: 46, width: 'auto', objectFit: 'contain', alignSelf: 'flex-start', marginBottom: 28 }} />
        <div style={{ font: '800 26px/1.1 var(--f-display)', color: '#fff', letterSpacing: '-0.01em' }}>App del Empleado</div>
        <div style={{ font: '500 13.5px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 8, marginBottom: 30 }}>Tu recibo de pago y tus comunicaciones de RRHH, en un solo lugar.</div>

        <label style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Usuario · correo</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@dtdcargo.com" autoComplete="username" style={{ ...field, marginTop: 7, marginBottom: 14 }} />
        <label style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Contraseña</label>
        <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="••••••••" autoComplete="current-password"
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} style={{ ...field, marginTop: 7 }} />

        {err && <div style={{ font: '600 12px/1.4 var(--f-sans)', color: 'var(--wine-soft)', marginTop: 14 }}>{err}</div>}

        <button onClick={submit} style={{ marginTop: 24, width: '100%', padding: '14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--wine)', color: '#fff', font: '700 15px/1 var(--f-sans)', cursor: 'pointer' }}>Entrar</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 4px' }}>
          <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.14)' }} />
          <span style={{ font: '600 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>¿Primera vez?</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.14)' }} />
        </div>
        <button onClick={onRegister} style={{ width: '100%', padding: '13px', borderRadius: 'var(--r-md)', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.06)', color: '#fff', font: '700 13.5px/1 var(--f-sans)', cursor: 'pointer' }}>Registrarme como empleado</button>

        <div style={{ marginTop: 22, padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Demo · toca para entrar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {users.map(u => {
              const e = eaEmpById(u.empId);
              return (
                <button key={u.id} onClick={() => onLogin(u.empId)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '700 11px/1 var(--f-sans)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{u.avatar}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', font: '600 12.5px/1.2 var(--f-sans)', color: '#fff' }}>{u.name}</span>
                    <span style={{ display: 'block', font: '500 10.5px/1.2 var(--f-sans)', color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{e ? e.cargo : ''}</span>
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{window.Icon.chevR ? window.Icon.chevR(14) : '›'}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Inicio
// ════════════════════════════════════════════════════════════════
function EAInicio({ emp, go }) {
  const N = window.NominaData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const r = N.calcRecibo(emp, EA_PERIOD.bono);
  const totalVes = N.totalCobrarVes(r, rates.bcv);
  const activeLoans = N.activeLoansFor(emp.id);
  const loanSaldo = activeLoans.reduce((s, l) => s + N.loanBalance(l), 0);
  const att = N.attSummary(emp.id, 2026, 4);
  const comms = N.commsFor(emp.id);
  const unread = comms.filter(c => !c.read).length;
  const pend = comms.filter(c => (c.type === 'llamado' || c.type === 'amonestacion') && !c.ack);
  const hour = 9;
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div style={{ padding: '6px 20px 24px' }}>
      <div style={{ font: '500 13px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{greet},</div>
      <div style={{ font: '800 24px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 3 }}>{emp.name.split(' ')[0]}</div>

      {/* Recibo card */}
      <button onClick={() => go('recibo')} style={{ width: '100%', textAlign: 'left', marginTop: 18, border: 'none', cursor: 'pointer', padding: 0, background: 'transparent' }}>
        <div style={{ borderRadius: 'var(--r-xl)', padding: '20px', background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tu pago · {EA_PERIOD.label}</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{window.Icon.chevR ? window.Icon.chevR(16) : '›'}</span>
          </div>
          <div style={{ font: '900 32px/1 var(--f-display)', marginTop: 14 }}>Bs. {totalVes.toLocaleString('es-VE')}</div>
          <div style={{ font: '600 12px/1.3 var(--f-mono)', color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>neto salarial {R.fmtUsd(r.neto)} + no salariales · BCV {rates.bcv.toFixed(2)}</div>
        </div>
      </button>

      {/* Pendientes de confirmar */}
      {pend.length > 0 && (
        <div onClick={() => go('mensajes')} style={{ cursor: 'pointer', marginTop: 16, display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 'var(--r-lg)', background: 'var(--warning-bg)', borderLeft: '3px solid var(--warning)' }}>
          <span style={{ color: 'var(--warning)', flexShrink: 0 }}>{window.Icon.shield ? window.Icon.shield(18) : '!'}</span>
          <div>
            <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>Tienes {pend.length} comunicación{pend.length > 1 ? 'es' : ''} por confirmar</div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>Abre Mensajes y toca "Acuso recibo".</div>
          </div>
        </div>
      )}

      {/* Accesos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        <EATile icon={window.Icon.invoice ? window.Icon.invoice(20) : '$'} label="Mi recibo" sub="Ver desglose" tone="info" onClick={() => go('recibo')} />
        <EATile icon={window.Icon.chat ? window.Icon.chat(20) : '✉'} label="Mensajes" sub={unread ? `${unread} sin leer` : 'Al día'} tone={unread ? 'wine' : 'success'} badge={unread} onClick={() => go('mensajes')} />
      </div>

      {/* Tu préstamo */}
      {activeLoans.length > 0 && (
        <div style={{ marginTop: 16, padding: '16px', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tu préstamo</span>
            <span style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 8px', borderRadius: 'var(--r-pill)', background: 'var(--wine-tint)' }}>{activeLoans.length} activo{activeLoans.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12 }}>
            <div>
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Saldo pendiente</div>
              <div style={{ font: '800 22px/1 var(--f-display)', color: 'var(--ink)', marginTop: 5 }}>{R.fmtUsd(loanSaldo)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>Cuota por pago</div>
              <div style={{ font: '700 14px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 7 }}>{R.fmtUsd(r.prestamo)}</div>
            </div>
          </div>
          <div style={{ font: '500 10.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 12 }}>Se descuenta automáticamente de cada pago hasta saldar.</div>
        </div>
      )}

      {/* Mi asistencia */}
      <div style={{ marginTop: 16, padding: '16px', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>Mi asistencia · mayo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[['Trabajados', att.trabajado, 'success'], ['Ausencias', att.ausente, 'danger'], ['Libres', att.libre, 'neutral']].map(function(it) {
            return (
              <div key={it[0]} style={{ padding: '12px', borderRadius: 'var(--r-md)', background: `var(--${it[2]}-bg)`, textAlign: 'center' }}>
                <div style={{ font: '800 22px/1 var(--f-display)', color: `var(--${it[2]})` }}>{it[1]}</div>
                <div style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{it[0]}</div>
              </div>
            );
          })}
        </div>
        {(att.extra - att.resta) !== 0 && <div style={{ font: '600 11.5px/1.4 var(--f-mono)', color: 'var(--wine)', marginTop: 12, textAlign: 'center' }}>Horas extra netas: {att.extra - att.resta > 0 ? '+' : ''}{att.extra - att.resta} h</div>}
      </div>

      {/* Últimas comunicaciones */}
      <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '24px 0 12px' }}>Últimas comunicaciones</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {comms.slice(0, 3).map(c => <EACommRow key={c.id} c={c} onClick={() => go('mensajes')} />)}
        {comms.length === 0 && <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>No tienes comunicaciones todavía.</div>}
      </div>
    </div>
  );
}

function EATile({ icon, label, sub, tone, badge, onClick }) {
  return (
    <button onClick={onClick} style={{ position: 'relative', textAlign: 'left', cursor: 'pointer', padding: '16px', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
      <span style={{ display: 'inline-flex', width: 38, height: 38, borderRadius: 'var(--r-md)', alignItems: 'center', justifyContent: 'center', background: `var(--${tone}-bg)`, color: `var(--${tone})` }}>{icon}</span>
      <div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 12 }}>{label}</div>
      <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{sub}</div>
      {badge > 0 && <span style={{ position: 'absolute', top: 14, right: 14, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '700 10px/18px var(--f-sans)', textAlign: 'center' }}>{badge}</span>}
    </button>
  );
}

// ════════════════════════════════════════════════════════════════
// Recibo
// ════════════════════════════════════════════════════════════════
function EARecibo({ emp }) {
  const N = window.NominaData;
  const R = window.ERPRates;
  const [rates] = R.useRates();
  const r = N.calcRecibo(emp, EA_PERIOD.bono);
  const bs = (usd) => 'Bs. ' + Math.round(usd * rates.bcv).toLocaleString('es-VE');
  const bsRaw = (v) => 'Bs. ' + Math.round(v).toLocaleString('es-VE');
  const totalVes = N.totalCobrarVes(r, rates.bcv);
  const share = () => { eaHaptic(10); window.open(N.waLink(emp, EA_PERIOD.bono, rates.bcv, EA_PERIOD.label), '_blank'); };

  const SecTitle = ({ children, tag, tone }) => (
    <div style={{ marginTop: 22, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{children}</span>
      {tag && <span style={{ font: '700 8.5px/1 var(--f-sans)', color: `var(--${tone})`, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 'var(--r-pill)', background: `var(--${tone}-bg)` }}>{tag}</span>}
    </div>
  );

  const Row = ({ label, usd, strong, neg }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '11px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ font: `${strong ? '700' : '500'} 13px/1.3 var(--f-sans)`, color: strong ? 'var(--ink)' : 'var(--ink-soft)' }}>{label}</span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ display: 'block', font: `${strong ? '800' : '600'} 13.5px/1 var(--f-mono)`, color: neg ? 'var(--warning)' : 'var(--ink)' }}>{neg ? '−' : ''}{bs(usd)}</span>
        <span style={{ display: 'block', font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>{neg ? '−' : ''}{R.fmtUsd(usd)}</span>
      </span>
    </div>
  );
  const RowBs = ({ label, ves }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '11px 0', borderTop: '1px solid var(--border)' }}>
      <span style={{ font: '500 13px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ font: '600 13.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{bsRaw(ves)}</span>
    </div>
  );

  return (
    <div style={{ padding: '6px 20px 28px' }}>
      <EAHeader title="Mi recibo" sub={EA_PERIOD.label} />

      <div style={{ marginTop: 16, borderRadius: 'var(--r-xl)', padding: '20px', background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff' }}>
        <span style={{ font: '700 10px/1 var(--f-sans)', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Total a cobrar</span>
        <div style={{ font: '900 32px/1 var(--f-display)', marginTop: 12 }}>{bsRaw(totalVes)}</div>
        <div style={{ font: '600 12px/1.3 var(--f-mono)', color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>neto salarial {R.fmtUsd(r.neto)} + no salariales · BCV {rates.bcv.toFixed(2)}</div>
      </div>

      <SecTitle tag="Salarial" tone="info">Asignaciones</SecTitle>
      <Row label="Sueldo base" usd={r.sueldo} />
      {r.bono > 0 && <Row label="Bono" usd={r.bono} />}
      {r.extras !== 0 && <Row label="Horas extra" usd={r.extras} />}
      <Row label="Total asignaciones" usd={r.asignaciones} strong />

      <SecTitle>Deducciones de ley</SecTitle>
      <Row label="Seguro Social (4%)" usd={r.sso} neg />
      <Row label="Paro forzoso · RPE (0,5%)" usd={r.rpe} neg />
      <Row label="FAOV · vivienda (1%)" usd={r.faov} neg />
      <Row label="Total deducciones" usd={r.deducciones} strong neg />
      {r.prestamo > 0 && <Row label="Cuota de préstamo" usd={r.prestamo} neg />}
      <Row label="Neto salarial" usd={r.netoFinal} strong />

      <SecTitle tag="No salarial" tone="success">Otras asignaciones</SecTitle>
      <RowBs label="Cestaticket" ves={r.cestaticketBs} />
      <RowBs label="Bono de guerra" ves={r.bonoGuerraBs} />

      <div style={{ marginTop: 22, padding: '16px', borderRadius: 'var(--r-lg)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>Total a cobrar</span>
        <span style={{ font: '900 19px/1 var(--f-display)', color: 'var(--wine)' }}>{bsRaw(totalVes)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }}>
        <button onClick={() => { eaHaptic(8); window.NominaData.printDoc(window.NominaData.reciboHtml(emp, EA_PERIOD.bono, rates.bcv, EA_PERIOD.label)); }} style={{ padding: '14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 13.5px/1 var(--f-sans)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {window.Icon.download ? window.Icon.download(15) : ''} Descargar PDF
        </button>
        <button onClick={share} style={{ padding: '14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--success)', color: '#fff', font: '700 13.5px/1 var(--f-sans)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {window.Icon.chat ? window.Icon.chat(15) : ''} WhatsApp
        </button>
      </div>
      <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', textAlign: 'center', marginTop: 10 }}>El pago se realiza en bolívares a la tasa BCV del día de pago. El cestaticket y el bono de guerra son no salariales.</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Mensajes (inbox)
// ════════════════════════════════════════════════════════════════
function EAMensajes({ emp }) {
  const N = window.NominaData;
  const comms = N.commsFor(emp.id);
  const [open, setOpen] = eaState(null);
  const current = open ? comms.find(c => c.id === open) : null;

  const openComm = (c) => { if (!c.read) N.markComm(c.id, { read: true }); setOpen(c.id); eaHaptic(); };

  if (current) return <EACommDetail c={current} onBack={() => setOpen(null)} />;

  return (
    <div style={{ padding: '6px 20px 24px' }}>
      <EAHeader title="Mensajes" sub="Comunicaciones de RRHH" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {comms.map(c => <EACommRow key={c.id} c={c} onClick={() => openComm(c)} />)}
        {comms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--ink-mute)' }}>
            <div style={{ font: '600 14px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>Sin mensajes</div>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', marginTop: 6 }}>Cuando RRHH te escriba, lo vas a ver acá.</div>
          </div>
        )}
      </div>
    </div>
  );
}

function EACommRow({ c, onClick }) {
  const N = window.NominaData;
  const t = N.COMM_TYPES[c.type] || {};
  const needsAck = (c.type === 'llamado' || c.type === 'amonestacion') && !c.ack;
  return (
    <button onClick={onClick} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: 12, padding: '14px', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', background: c.read ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
      <span style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `var(--${t.tone || 'info'}-bg)`, color: `var(--${t.tone || 'info'})` }}>
        {(window.Icon[t.icon] && window.Icon[t.icon](17)) || (window.Icon.bell && window.Icon.bell(17))}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ font: '700 11px/1 var(--f-sans)', color: `var(--${t.tone || 'info'})`, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t.label || c.type}</span>
          {!c.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--wine)' }} />}
        </div>
        <div style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
        <div style={{ font: '500 11px/1.3 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>{c.date} · {c.by}</div>
        {needsAck && <div style={{ display: 'inline-block', marginTop: 8, font: '700 9.5px/1 var(--f-sans)', color: 'var(--warning)', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 8px', background: 'var(--warning-bg)', borderRadius: 'var(--r-pill)' }}>Falta confirmar</div>}
      </div>
    </button>
  );
}

function EACommDetail({ c, onBack }) {
  const N = window.NominaData;
  const t = N.COMM_TYPES[c.type] || {};
  const [, force] = React.useReducer(x => x + 1, 0);
  const needsAck = (c.type === 'llamado' || c.type === 'amonestacion') && !c.ack;
  const ack = () => { N.markComm(c.id, { ack: true, read: true }); eaHaptic(16); force(); };

  return (
    <div style={{ padding: '6px 20px 28px', animation: 'erp-slide-in 220ms var(--ease)' }}>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', font: '600 13px/1 var(--f-sans)', color: 'var(--wine)', padding: '6px 0' }}>
        {window.Icon.arrowL ? window.Icon.arrowL(15) : '‹'} Mensajes
      </button>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '6px 12px', borderRadius: 'var(--r-pill)', background: `var(--${t.tone || 'info'}-bg)`, color: `var(--${t.tone || 'info'})` }}>
        {(window.Icon[t.icon] && window.Icon[t.icon](14)) || null}
        <span style={{ font: '700 11px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{t.label || c.type}</span>
      </div>
      <div style={{ font: '800 20px/1.25 var(--f-display)', color: 'var(--ink)', marginTop: 14 }}>{c.title}</div>
      <div style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 8 }}>{c.date} · {c.by}</div>
      <p style={{ font: '500 14px/1.65 var(--f-sans)', color: 'var(--ink)', marginTop: 18, whiteSpace: 'pre-wrap' }}>{c.body}</p>

      {needsAck ? (
        <button onClick={ack} style={{ marginTop: 24, width: '100%', padding: '14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--wine)', color: '#fff', font: '700 14px/1 var(--f-sans)', cursor: 'pointer' }}>Acuso recibo</button>
      ) : c.ack ? (
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', borderRadius: 'var(--r-md)', background: 'var(--success-bg)', color: 'var(--success)', font: '700 13px/1 var(--f-sans)' }}>
          {window.Icon.check ? window.Icon.check(15) : '✓'} Confirmado por tú
        </div>
      ) : null}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Perfil
// ════════════════════════════════════════════════════════════════
function EAPerfil({ emp, onLogout }) {
  const users = eaEmpUsers();
  const u = users.find(x => x.empId === emp.id);
  const N = window.NominaData;
  const [editing, setEditing] = eaState(false);
  const [f, setF] = eaState({ phone: '', email: '', banco: '', tipoCuenta: 'Corriente', cuenta: '' });
  eaEffect(() => { setF({ phone: emp.phone || '+58 ', email: emp.email || (u && u.email) || '', banco: emp.banco || '', tipoCuenta: emp.tipoCuenta || 'Corriente', cuenta: emp.cuenta || '' }); }, [editing, emp.id]);
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const save = () => { N.updateEmployee(emp.id, { phone: f.phone.trim(), email: f.email.trim(), banco: f.banco, tipoCuenta: f.tipoCuenta, cuenta: f.cuenta.trim() }); eaHaptic(12); setEditing(false); };

  const Field = ({ label, value }) => (
    <div style={{ padding: '13px 0', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ font: '500 12.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ font: '600 12.5px/1.3 var(--f-mono)', color: 'var(--ink)', textAlign: 'right' }}>{value || '—'}</span>
    </div>
  );
  const field = { width: '100%', padding: '11px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 13.5px/1.2 var(--f-sans)', outline: 'none', boxSizing: 'border-box' };
  const elbl = { font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6, display: 'block' };

  return (
    <div style={{ padding: '6px 20px 28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <EAHeader title="Mi perfil" />
        {!editing && <button onClick={() => setEditing(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', background: 'var(--bg-surface)', cursor: 'pointer', font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', padding: '8px 12px', borderRadius: 'var(--r-md)' }}>{window.Icon.edit ? window.Icon.edit(13) : ''} Editar</button>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 16 }}>
        <span style={{ width: 60, height: 60, borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '800 22px/1 var(--f-display)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u ? u.avatar : emp.name.slice(0, 2)}</span>
        <div>
          <div style={{ font: '800 18px/1.1 var(--f-display)', color: 'var(--ink)' }}>{emp.name}</div>
          <div style={{ font: '500 12.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{emp.cargo}</div>
        </div>
      </div>

      {!editing ? (
        <React.Fragment>
          <div style={{ marginTop: 22 }}>
            <Field label="Departamento" value={emp.dept} />
            <Field label="Cédula / RIF" value={emp.cedula} />
            <Field label="WhatsApp" value={emp.phone} />
            <Field label="Correo" value={emp.email || (u && u.email)} />
          </div>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '22px 0 4px' }}>Datos bancarios</div>
          <div>
            <Field label="Banco" value={emp.banco} />
            <Field label="Tipo de cuenta" value={emp.tipoCuenta} />
            <Field label="Número de cuenta" value={emp.cuenta} />
            <Field label="Pago" value="Bolívares · tasa BCV" />
          </div>
          <button onClick={onLogout} style={{ marginTop: 28, width: '100%', padding: '13px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--danger)', font: '700 13.5px/1 var(--f-sans)', cursor: 'pointer' }}>Cerrar sesión</button>
        </React.Fragment>
      ) : (
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><span style={elbl}>WhatsApp</span><input value={f.phone} onChange={(e) => set('phone', e.target.value)} style={{ ...field, fontFamily: 'var(--f-mono)' }} /></div>
          <div><span style={elbl}>Correo</span><input value={f.email} onChange={(e) => set('email', e.target.value)} style={field} /></div>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>Datos bancarios</div>
          <div>
            <span style={elbl}>Banco</span>
            <select value={f.banco} onChange={(e) => set('banco', e.target.value)} style={{ ...field, appearance: 'none' }}>
              <option value="">Elige tu banco…</option>
              {(N.VE_BANKS || []).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <span style={elbl}>Tipo de cuenta</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(N.CUENTA_TIPOS || ['Corriente', 'Ahorro']).map(t => {
                const on = f.tipoCuenta === t;
                return <button key={t} onClick={() => set('tipoCuenta', t)} style={{ padding: '11px 8px', borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'), background: on ? 'var(--wine-tint)' : 'var(--bg-surface)', color: on ? 'var(--wine)' : 'var(--ink)', font: `${on ? '700' : '500'} 13px/1 var(--f-sans)` }}>{t}</button>;
              })}
            </div>
          </div>
          <div><span style={elbl}>Número de cuenta</span><input value={f.cuenta} onChange={(e) => set('cuenta', e.target.value)} placeholder="0000 0000 00 0000000000" style={{ ...field, fontFamily: 'var(--f-mono)' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10, marginTop: 6 }}>
            <button onClick={() => setEditing(false)} style={{ padding: '13px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '700 13.5px/1 var(--f-sans)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={save} style={{ padding: '13px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--wine)', color: '#fff', font: '700 13.5px/1 var(--f-sans)', cursor: 'pointer' }}>Guardar cambios</button>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', marginTop: 22, font: '500 10.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>DTD Cargo · App del Empleado v1.0<br />Con Confianza, de China a tu puerta.</div>
    </div>
  );
}

// ── Header de pantalla ────────────────────────────────────────
function EAHeader({ title, sub }) {
  return (
    <div style={{ paddingTop: 6 }}>
      <div style={{ font: '800 22px/1.1 var(--f-display)', color: 'var(--ink)' }}>{title}</div>
      {sub && <div style={{ font: '500 12.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────
function EATabBar({ tab, setTab, emp }) {
  const N = window.NominaData;
  const unread = N.commsFor(emp.id).filter(c => !c.read).length;
  const items = [
    { id: 'inicio', label: 'Inicio', icon: 'box' },
    { id: 'recibo', label: 'Recibo', icon: 'invoice' },
    { id: 'mensajes', label: 'Mensajes', icon: 'chat', badge: unread },
    { id: 'perfil', label: 'Perfil', icon: 'users' },
  ];
  return (
    <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
      {items.map(it => {
        const on = tab === it.id;
        const ico = window.Icon[it.icon] || window.Icon.box;
        return (
          <button key={it.id} onClick={() => { eaHaptic(); setTab(it.id); }} style={{ position: 'relative', border: 'none', background: 'transparent', cursor: 'pointer', padding: '9px 0 11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ color: on ? 'var(--wine)' : 'var(--ink-mute)' }}>{ico(21)}</span>
            <span style={{ font: `${on ? '700' : '500'} 10px/1 var(--f-sans)`, color: on ? 'var(--wine)' : 'var(--ink-mute)' }}>{it.label}</span>
            {it.badge > 0 && <span style={{ position: 'absolute', top: 6, left: 'calc(50% + 8px)', minWidth: 16, height: 16, padding: '0 4px', borderRadius: 'var(--r-pill)', background: 'var(--wine)', color: '#fff', font: '700 9px/16px var(--f-sans)', textAlign: 'center' }}>{it.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Auto-registro del empleado (por link de invitación)
// ════════════════════════════════════════════════════════════════
function EARegistro({ token, onCancel, onDone }) {
  const N = window.NominaData;
  const link = token && N.regLinkByToken ? N.regLinkByToken(token) : null;
  const linkValid = link && link.active;
  const [f, setF] = eaState({
    name: '', cedula: '', birth: '', startDate: '', phone: '+58 ', email: '',
    cargo: (link && link.cargo) || '', dept: (link && link.dept) || '',
    banco: '', tipoCuenta: 'Corriente', cuenta: '', photo: null,
  });
  const [err, setErr] = eaState('');
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => set('photo', rd.result);
    rd.readAsDataURL(file);
  };

  const valid = f.name.trim() && f.cedula.trim() && f.phone.trim() && /\S+@\S+/.test(f.email) && f.cargo.trim();
  const submit = () => {
    if (!valid) { setErr('Completa nombre, cédula, WhatsApp, un correo válido y el cargo.'); eaHaptic(20); return; }
    N.submitRegistration({ ...f, name: f.name.trim(), email: f.email.trim(), token: linkValid ? token : null });
    eaHaptic(16);
    onDone();
  };

  const lbl = { font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 7, display: 'block' };
  const field = { width: '100%', padding: '12px 13px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--ink)', font: '500 14px/1.2 var(--f-sans)', outline: 'none', boxSizing: 'border-box' };
  const mono = { ...field, fontFamily: 'var(--f-mono)' };
  const Group = ({ title, children }) => (
    <div style={{ marginTop: 22 }}>
      <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>{children}</div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-base)' }}>
      <div style={{ padding: '8px 20px 32px' }}>
        <button onClick={onCancel} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', cursor: 'pointer', font: '600 13px/1 var(--f-sans)', color: 'var(--wine)', padding: '6px 0' }}>
          {window.Icon.arrowL ? window.Icon.arrowL(15) : '‹'} Volver
        </button>

        <div style={{ font: '800 24px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 8 }}>Registro de empleado</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
          Carga tus datos. Un administrador los revisa y aprueba tu acceso. Te avisamos cuando esté listo.
        </div>
        {linkValid && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginTop: 12, padding: '6px 11px', borderRadius: 'var(--r-pill)', background: 'var(--success-bg)', color: 'var(--success)' }}>
            {window.Icon.check ? window.Icon.check(13) : '✓'}
            <span style={{ font: '700 10.5px/1 var(--f-sans)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Invitación válida{link.cargo ? ` · ${link.cargo}` : ''}</span>
          </div>
        )}

        {/* Foto */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 22 }}>
          <span style={{ width: 64, height: 64, borderRadius: 'var(--r-pill)', overflow: 'hidden', flexShrink: 0, background: f.photo ? 'transparent' : 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-mute)' }}>
            {f.photo ? <img src={f.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (window.Icon.camera ? window.Icon.camera(22) : '📷')}
          </span>
          <label style={{ cursor: 'pointer', padding: '10px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>
            {f.photo ? 'Cambiar foto' : 'Subir foto'}
            <input type="file" accept="image/*" onChange={onPhoto} style={{ display: 'none' }} />
          </label>
        </div>

        <Group title="Datos personales">
          <div><span style={lbl}>Nombre completo</span><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre y apellido" style={field} /></div>
          <div><span style={lbl}>Cédula</span><input value={f.cedula} onChange={(e) => set('cedula', e.target.value)} placeholder="V-00.000.000" style={mono} /></div>
          <div><span style={lbl}>Fecha de nacimiento</span><input type="date" value={f.birth} onChange={(e) => set('birth', e.target.value)} style={mono} /></div>
        </Group>

        <Group title="Contacto">
          <div><span style={lbl}>WhatsApp</span><input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+58 412 0000000" style={mono} /></div>
          <div><span style={lbl}>Correo</span><input value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="tucorreo@dtdcargo.com" autoComplete="email" style={field} /></div>
        </Group>

        <Group title="Trabajo">
          <div><span style={lbl}>Cargo</span><input value={f.cargo} onChange={(e) => set('cargo', e.target.value)} placeholder="Ej. Asistente de Almacén" style={{ ...field, opacity: linkValid && link.cargo ? 0.75 : 1 }} readOnly={!!(linkValid && link.cargo)} /></div>
          <div><span style={lbl}>Fecha de inicio</span><input type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} style={mono} /></div>
        </Group>

        <Group title="Banco para el pago">
          <div>
            <span style={lbl}>Banco</span>
            <select value={f.banco} onChange={(e) => set('banco', e.target.value)} style={{ ...field, appearance: 'none' }}>
              <option value="">Elige tu banco…</option>
              {(N.VE_BANKS || []).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <span style={lbl}>Tipo de cuenta</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(N.CUENTA_TIPOS || ['Corriente', 'Ahorro']).map(t => {
                const on = f.tipoCuenta === t;
                return <button key={t} onClick={() => set('tipoCuenta', t)} style={{ padding: '11px 8px', borderRadius: 'var(--r-md)', cursor: 'pointer', border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'), background: on ? 'var(--wine-tint)' : 'var(--bg-surface)', color: on ? 'var(--wine)' : 'var(--ink)', font: `${on ? '700' : '500'} 13px/1 var(--f-sans)` }}>{t}</button>;
              })}
            </div>
          </div>
          <div><span style={lbl}>Número de cuenta</span><input value={f.cuenta} onChange={(e) => set('cuenta', e.target.value)} placeholder="0000 0000 00 0000000000" style={mono} /></div>
        </Group>

        {err && <div style={{ font: '600 12px/1.4 var(--f-sans)', color: 'var(--danger)', marginTop: 16 }}>{err}</div>}

        <button onClick={submit} style={{ marginTop: 22, width: '100%', padding: '15px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--wine)', color: '#fff', font: '700 15px/1 var(--f-sans)', cursor: 'pointer' }}>Enviar registro</button>
        <div style={{ font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-mute)', textAlign: 'center', marginTop: 12 }}>Tus datos quedan en revisión. El sueldo lo define la empresa al aprobar.</div>
      </div>
    </div>
  );
}

function EARegistroEnviado({ onBack }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 30px 36px', background: 'linear-gradient(135deg, var(--ink), #1F3055)', textAlign: 'left' }}>
      <span style={{ width: 60, height: 60, borderRadius: 'var(--r-pill)', background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        {window.Icon.check ? window.Icon.check(26) : '✓'}
      </span>
      <div style={{ font: '800 26px/1.15 var(--f-display)', color: '#fff', marginTop: 22, letterSpacing: '-0.01em' }}>Registro enviado</div>
      <div style={{ font: '500 14px/1.6 var(--f-sans)', color: 'rgba(255,255,255,0.72)', marginTop: 12 }}>
        Recibimos tus datos. Un administrador los va a revisar y aprobar tu acceso. Cuando esté listo vas a poder entrar con tu correo y ver tu recibo de pago.
      </div>
      <div style={{ marginTop: 22, padding: '14px 16px', borderRadius: 'var(--r-lg)', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0, marginTop: 1 }}>{window.Icon.clock ? window.Icon.clock(16) : '⏳'}</span>
        <span style={{ font: '500 12.5px/1.55 var(--f-sans)', color: 'rgba(255,255,255,0.72)' }}>Estado: <b style={{ color: '#fff' }}>en revisión</b>. Te avisamos por WhatsApp o correo cuando se apruebe.</span>
      </div>
      <button onClick={onBack} style={{ marginTop: 28, width: '100%', padding: '14px', borderRadius: 'var(--r-md)', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.06)', color: '#fff', font: '700 14px/1 var(--f-sans)', cursor: 'pointer' }}>Volver al inicio</button>
    </div>
  );
}

window.EmpleadoApp = EmpleadoApp;
