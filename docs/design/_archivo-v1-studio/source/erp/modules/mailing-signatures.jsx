/* global React */
/* ── DTD ERP · Mailing · Firmas tab ─────────────────────────── */

function MailingSignatures() {
  const D = window.ERPData;
  const U = window.ERPUI;
  // Default to current user — Carlos V. (u-001)
  const [editingUser, setEditingUser] = React.useState('u-001');
  const [testOpen, setTestOpen] = React.useState(false);

  React.useEffect(() => {
    window.__openMailingEditor = (kind) => { if (kind === 'signature-new') setEditingUser('u-001'); };
    return () => { delete window.__openMailingEditor; };
  }, []);

  const me = D.USERS.find(u => u.id === editingUser);
  const sig = D.SIGNATURES.find(s => s.userId === editingUser);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'flex-start' }}>
        {/* LEFT: user list */}
        <U.Card padded={false}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
            <div className="eyebrow eyebrow-wine">EQUIPO INTERNO</div>
            <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Firmas configuradas</div>
          </div>
          <div>
            {D.USERS.filter(u => u.status === 'active').map(u => {
              const userSig = D.SIGNATURES.find(s => s.userId === u.id);
              const isActive = u.id === editingUser;
              return (
                <button key={u.id} onClick={() => setEditingUser(u.id)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderTop: '1px solid var(--border)',
                  background: isActive ? 'var(--wine-tint)' : 'transparent',
                  textAlign: 'left',
                }}>
                  <U.Avatar initials={u.avatar} color={isActive ? 'wine' : 'neutral'} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{u.name}</div>
                    <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{u.role}</div>
                  </div>
                  {userSig
                    ? <U.Badge tone="success" size="sm">{userSig.layout}</U.Badge>
                    : <U.Badge tone="neutral" size="sm">sin firma</U.Badge>
                  }
                </button>
              );
            })}
          </div>
        </U.Card>

        {/* RIGHT: signature editor */}
        <div>
          {sig && me ? <SignatureEditor key={editingUser} user={me} sig={sig} onTest={() => setTestOpen(true)} /> : (
            <U.EmptyState icon={window.Icon.edit(22)} title="Sin firma configurada" body="Este usuario aún no tiene firma. Creá una desde acá." />
          )}
        </div>
      </div>

      <window.TestSendModal2 open={testOpen} onClose={() => setTestOpen(false)} kind="signature" user={me} />
    </div>
  );
}

function SignatureEditor({ user, sig, onTest }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [layout, setLayout] = React.useState(sig.layout);
  const [name, setName] = React.useState(sig.name);
  const [role, setRole] = React.useState(sig.role);
  const [email, setEmail] = React.useState(sig.email);
  const [phone, setPhone] = React.useState(sig.phone);
  const [lang, setLang] = React.useState(sig.lang);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Layout selector */}
      <U.Card padded>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="eyebrow eyebrow-wine">LAYOUT</div>
            <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Elegí el formato de tu firma</div>
          </div>
          <U.Btn variant="secondary" size="sm" icon={window.Icon.copy(13)}>Copiar HTML</U.Btn>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {D.SIGNATURE_LAYOUTS.map(l => {
            const isActive = layout === l.id;
            return (
              <button key={l.id} onClick={() => setLayout(l.id)} style={{
                padding: '12px 10px', textAlign: 'left',
                background: isActive ? 'var(--wine-tint)' : 'var(--bg-surface)',
                border: `1.5px solid ${isActive ? 'var(--wine)' : 'var(--border)'}`,
                borderRadius: 'var(--r-md)',
                transition: 'all var(--dur-fast) var(--ease)',
              }}>
                <LayoutThumb kind={l.id} active={isActive} />
                <div style={{ font: '700 12px/1.2 var(--f-sans)', color: isActive ? 'var(--wine)' : 'var(--ink)', marginTop: 8 }}>{l.name}</div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{l.desc}</div>
              </button>
            );
          })}
        </div>
      </U.Card>

      {/* Editor form + Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>DATOS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <U.Input label="Nombre" value={name} onChange={(e)=>setName(e.target.value)} />
            <U.Input label="Cargo" value={role} onChange={(e)=>setRole(e.target.value)} />
            <U.Input label="Email" type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
            <U.Input label="Teléfono" value={phone} onChange={(e)=>setPhone(e.target.value)} mono />
            <U.Select label="Idioma por defecto" value={lang} onChange={(e)=>setLang(e.target.value)} options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
              { value: 'zh', label: '中文' },
            ]} />
            {layout === 'foto' && (
              <U.Input label="Foto (URL o iniciales)" value={sig.photo || ''} placeholder="MA o https://..." />
            )}
          </div>
          <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
            <U.Btn variant="secondary" icon={window.Icon.mail(13)} onClick={onTest}>Enviar prueba</U.Btn>
            <U.Btn variant="primary" full style={{ flex: 1 }}>Guardar firma</U.Btn>
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>PREVIEW</div>
          <div style={{ background: '#FBFAF7', padding: 24, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', minHeight: 220 }}>
            <SignatureRender layout={layout} name={name} role={role} email={email} phone={phone} photo={sig.photo} />
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--info)' }}>{window.Icon.info(13)}</span>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
              Tu firma se aplica automáticamente al final de cada email que envíes desde el ERP. Se puede sobreescribir manualmente en Compose.
            </div>
          </div>
        </U.Card>
      </div>
    </div>
  );
}

// ── Layout thumbnails (mini visual) ──────────────────────────
function LayoutThumb({ kind, active }) {
  const bg = active ? 'var(--bg-surface)' : 'var(--bg-elevated)';
  const stripe = active ? 'var(--wine)' : 'var(--wine-soft)';
  const text = active ? 'var(--ink)' : 'var(--ink-soft)';
  const mute = active ? 'var(--ink-soft)' : 'var(--ink-mute)';
  if (kind === 'clasico') return (
    <svg viewBox="0 0 80 56" style={{ width: '100%', height: 56, background: bg, borderRadius: 4 }}>
      <rect x="8" y="10" width="2" height="36" fill={stripe} />
      <rect x="14" y="12" width="40" height="4" rx="1" fill={text} />
      <rect x="14" y="20" width="30" height="3" rx="1" fill={mute} />
      <rect x="14" y="28" width="38" height="2.5" rx="1" fill={mute} />
      <rect x="14" y="34" width="32" height="2.5" rx="1" fill={mute} />
      <rect x="14" y="42" width="22" height="2.5" rx="1" fill={stripe} />
    </svg>
  );
  if (kind === 'compacto') return (
    <svg viewBox="0 0 80 56" style={{ width: '100%', height: 56, background: bg, borderRadius: 4 }}>
      <rect x="6" y="24" width="68" height="2.5" rx="1" fill={text} />
      <rect x="6" y="30" width="50" height="2.5" rx="1" fill={mute} />
    </svg>
  );
  if (kind === 'vertical') return (
    <svg viewBox="0 0 80 56" style={{ width: '100%', height: 56, background: bg, borderRadius: 4 }}>
      <rect x="20" y="6" width="40" height="44" fill="none" stroke={stripe} strokeWidth="1" rx="2" />
      <rect x="26" y="12" width="28" height="3" rx="1" fill={text} />
      <rect x="26" y="20" width="20" height="2.5" rx="1" fill={mute} />
      <rect x="26" y="28" width="28" height="2" rx="1" fill={mute} />
      <rect x="26" y="34" width="22" height="2" rx="1" fill={mute} />
      <rect x="26" y="42" width="14" height="2" rx="1" fill={stripe} />
    </svg>
  );
  if (kind === 'minimo') return (
    <svg viewBox="0 0 80 56" style={{ width: '100%', height: 56, background: bg, borderRadius: 4 }}>
      <rect x="8" y="22" width="38" height="3.5" rx="1" fill={text} />
      <rect x="8" y="30" width="50" height="2.5" rx="1" fill={mute} />
    </svg>
  );
  if (kind === 'foto') return (
    <svg viewBox="0 0 80 56" style={{ width: '100%', height: 56, background: bg, borderRadius: 4 }}>
      <circle cx="18" cy="28" r="10" fill={stripe} />
      <rect x="34" y="18" width="36" height="3" rx="1" fill={text} />
      <rect x="34" y="25" width="28" height="2.5" rx="1" fill={mute} />
      <rect x="34" y="33" width="32" height="2.5" rx="1" fill={mute} />
      <rect x="34" y="40" width="18" height="2" rx="1" fill={stripe} />
    </svg>
  );
  return null;
}

// ── Real signature render (used in template preview + compose + here) ─
function SignatureRender({ layout, name, role, email, phone, photo }) {
  const initials = (name || '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'DC';
  const wine = '#7F0F1A';
  const wineSoft = '#C2747F';
  const ink = '#0F1E3D';
  const mute = '#6B6B6B';

  if (layout === 'clasico') return (
    <table cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td style={{ borderLeft: `3px solid ${wine}`, paddingLeft: 14, font: '500 13px/1.5 Archivo, sans-serif', color: ink }}>
            <div style={{ font: '900 16px/1.1 "Archivo Black", sans-serif', color: ink, letterSpacing: '-0.01em' }}>{name}</div>
            <div style={{ font: '500 12px/1.4 Archivo, sans-serif', color: mute, marginTop: 3 }}>{role}</div>
            <div style={{ marginTop: 8, font: '500 11.5px/1.5 Archivo, sans-serif', color: mute }}>
              {email}<br/>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{phone}</span>
            </div>
            <div style={{ marginTop: 8, font: '700 10.5px/1 Archivo, sans-serif', color: wine, letterSpacing: '0.16em' }}>DTDCARGO.COM</div>
          </td>
        </tr>
      </tbody>
    </table>
  );

  if (layout === 'compacto') return (
    <div style={{ font: '500 12.5px/1.5 Archivo, sans-serif', color: ink }}>
      <div><b style={{ color: ink }}>{name}</b> · <span style={{ color: mute }}>{role}</span></div>
      <div style={{ marginTop: 4, color: mute, fontSize: 11.5 }}>
        {email} · <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{phone}</span> · <b style={{ color: wine, letterSpacing: '0.1em' }}>DTDCARGO.COM</b>
      </div>
    </div>
  );

  if (layout === 'vertical') return (
    <div style={{ display: 'inline-block', padding: '14px 18px', border: `1.5px solid ${ink}`, borderRadius: 4, font: 'Archivo, sans-serif', color: ink, textAlign: 'left' }}>
      <div style={{ font: '900 14px/1 "Archivo Black", sans-serif', letterSpacing: '-0.01em' }}>{name}</div>
      <div style={{ font: '500 11.5px/1.3 Archivo, sans-serif', color: mute, marginTop: 4 }}>{role}</div>
      <div style={{ height: 1, background: '#E8E6E2', margin: '10px 0' }} />
      <div style={{ font: '500 11px/1.5 Archivo, sans-serif', color: mute }}>{email}</div>
      <div style={{ font: '600 11px/1.5 JetBrains Mono, monospace', color: mute }}>{phone}</div>
      <div style={{ marginTop: 8, font: '700 9.5px/1 Archivo, sans-serif', color: wine, letterSpacing: '0.18em' }}>DTDCARGO.COM</div>
    </div>
  );

  if (layout === 'minimo') return (
    <div style={{ font: '500 13px/1.5 Archivo, sans-serif', color: ink }}>
      <div style={{ font: '800 14px/1.2 Archivo, sans-serif', color: ink, letterSpacing: '-0.01em' }}>{name}</div>
      <div style={{ marginTop: 4, color: mute, fontSize: 12 }}>{email}</div>
    </div>
  );

  if (layout === 'foto') return (
    <table cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <tr>
          <td style={{ paddingRight: 14, verticalAlign: 'top' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: wineSoft, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              font: '900 18px/1 "Archivo Black", sans-serif', letterSpacing: '-0.02em',
            }}>{photo && photo.length <= 3 ? photo : initials}</div>
          </td>
          <td style={{ borderLeft: `3px solid ${wine}`, paddingLeft: 14, font: '500 13px/1.5 Archivo, sans-serif', color: ink }}>
            <div style={{ font: '900 16px/1.1 "Archivo Black", sans-serif', color: ink, letterSpacing: '-0.01em' }}>{name}</div>
            <div style={{ font: '500 12px/1.4 Archivo, sans-serif', color: mute, marginTop: 3 }}>{role}</div>
            <div style={{ marginTop: 8, font: '500 11.5px/1.5 Archivo, sans-serif', color: mute }}>
              {email} · <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{phone}</span>
            </div>
            <div style={{ marginTop: 6, font: '700 10.5px/1 Archivo, sans-serif', color: wine, letterSpacing: '0.16em' }}>DTDCARGO.COM</div>
          </td>
        </tr>
      </tbody>
    </table>
  );

  return null;
}

// Simpler version of TestSendModal for signatures
function TestSendModal2({ open, onClose, kind, user }) {
  const U = window.ERPUI;
  const [to, setTo] = React.useState(user?.email || 'cvasquez@dtdcargo.com');
  const [sent, setSent] = React.useState(false);
  React.useEffect(() => { setSent(false); setTo(user?.email || 'cvasquez@dtdcargo.com'); }, [open, user]);
  return (
    <U.Modal open={open} onClose={onClose} title={kind === 'signature' ? 'Probar firma' : 'Enviar prueba'} width={440}
      actions={!sent && (<><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={window.Icon.mail(13)} onClick={()=>setSent(true)}>Enviar</U.Btn></>)}
    >
      {sent ? (
        <div style={{ textAlign: 'center', padding: '14px 0' }}>
          <div style={{ width: 48, height: 48, margin: '0 auto 12px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.check(20)}</div>
          <div style={{ font: '800 15px/1.2 var(--f-display)', color: 'var(--ink)' }}>Prueba enviada a {to}</div>
          <div style={{ marginTop: 14 }}><U.Btn variant="primary" onClick={onClose}>Cerrar</U.Btn></div>
        </div>
      ) : (
        <U.Input label="Enviar a" value={to} onChange={(e)=>setTo(e.target.value)} type="email" />
      )}
    </U.Modal>
  );
}

window.MailingSignatures = MailingSignatures;
window.SignatureRender = SignatureRender;
window.TestSendModal2 = TestSendModal2;
