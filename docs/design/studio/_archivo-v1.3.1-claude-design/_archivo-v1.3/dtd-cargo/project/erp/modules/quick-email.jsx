/* global React */
/* ── DTD ERP · Quick Email modal ────────────────────────────── */
/* Singleton modal abrible desde cualquier vista vía:           */
/*   window.openQuickEmail({ to, subject, template, ctx })       */
/* donde ctx puede ser { client, shipment, invoice } para        */
/* prerellenar variables.                                        */

function QuickEmailModal() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [opts, setOpts] = React.useState(null);
  const [body, setBody] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [to, setTo] = React.useState('');
  const [template, setTemplate] = React.useState('');
  const [signature, setSignature] = React.useState('u-001');
  const [channel, setChannel] = React.useState('email');
  const [sent, setSent] = React.useState(false);

  // Listen for open events from anywhere
  React.useEffect(() => {
    const handler = (e) => {
      const o = e.detail || {};
      setOpts(o);
      setTo(o.to || '');
      setSubject(o.subject || '');
      setBody(o.body || '');
      setTemplate(o.template || '');
      setSignature(o.signature || 'u-002');
      setChannel(o.channel || 'email');
      setSent(false);
    };
    window.addEventListener('quickemail:open', handler);
    return () => window.removeEventListener('quickemail:open', handler);
  }, []);

  if (!opts) return null;

  // Build context for variable substitution
  const ctx = opts.ctx || {};
  const client = ctx.client || D.CLIENTS.find(c => c.email === to);
  const shipment = ctx.shipment;
  const invoice = ctx.invoice;
  const agent = D.USERS.find(u => u.id === signature) || D.USERS[1];

  const subRule = (s) => (s || '').replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const map = {
      client_name: client?.name,
      client_company: client?.company,
      markbox: client?.markbox,
      client_email: client?.email,
      shipment_id: shipment?.id,
      origin: shipment ? D.origin(shipment.origin).name : '',
      destination: shipment ? D.dest(shipment.destination).name : '',
      vessel: shipment?.vessel,
      eta: shipment?.eta,
      etd: shipment?.etd,
      cbm: shipment?.cbm,
      invoice_id: invoice?.id,
      amount: invoice?.amount ? `${invoice.amount.toLocaleString()}` : '',
      days: invoice ? 10 : '',
      agent_name: agent?.name,
      portal_link: 'https://app.dtdcargo.com',
      tracking_link: shipment ? `https://dtdcargo.com/track/${shipment.id}` : '',
    };
    return map[k] ?? `{{${k}}}`;
  });

  const applyTemplate = (id) => {
    setTemplate(id);
    const tpl = D.MAIL_TEMPLATES.find(t => t.id === id);
    if (!tpl) return;
    setChannel(tpl.channel);
    setSubject(tpl.subject);
    setBody(tpl.body?.es || '');
  };

  const close = () => { setOpts(null); setSent(false); };

  // Filter templates that are relevant to context
  const relevantTemplates = D.MAIL_TEMPLATES.filter(t => {
    if (t.channel !== channel) return false;
    if (shipment && ['Operativo', 'Alertas'].includes(t.category)) return true;
    if (invoice && t.category === 'Finanzas') return true;
    if (client && !shipment && !invoice) return true; // all for generic client email
    return true;
  });

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.5)',
      backdropFilter: 'blur(4px)', zIndex: 130,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '8vh',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 720,
        background: 'var(--bg-surface)', borderRadius: 'var(--r-xl)',
        boxShadow: 'var(--shadow-pop)', border: '1px solid var(--border)',
        animation: 'erp-pop 200ms var(--ease)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <header style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
          background: 'var(--bg-elevated)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: 'var(--wine)' }}>{window.Icon.mail(18)}</span>
            <div>
              <div style={{ font: '900 15px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Email rápido</div>
              <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                {ctx.label || (client?.company || 'Nuevo correo')}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--bg-surface)', borderRadius: 'var(--r-md)' }}>
              {[
                { v: 'email', l: 'Email', i: 'mail' },
                { v: 'whatsapp', l: 'WhatsApp', i: 'globe' },
              ].map(c => (
                <button key={c.v} onClick={() => setChannel(c.v)} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 'var(--r-sm)',
                  background: channel === c.v ? 'var(--bg-elevated)' : 'transparent',
                  color: channel === c.v ? 'var(--ink)' : 'var(--ink-soft)',
                  font: `${channel === c.v ? '700' : '500'} 11.5px/1 var(--f-sans)`,
                }}>{window.Icon[c.i](11)} {c.l}</button>
              ))}
            </div>
            <button onClick={close} style={{ width: 28, height: 28, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.close(14)}</button>
          </div>
        </header>

        {sent ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.check(26)}</div>
            <div style={{ font: '900 20px/1.2 var(--f-display)', color: 'var(--ink)' }}>Correo enviado</div>
            <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>Llegó a <b style={{ color: 'var(--ink)' }}>{to}</b> y quedó registrado en logs.</div>
            <div style={{ marginTop: 22 }}><U.Btn variant="primary" onClick={close}>Cerrar</U.Btn></div>
          </div>
        ) : (
          <div style={{ padding: '18px 22px' }}>
            {/* Template picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <U.Select value={template} onChange={(e)=>applyTemplate(e.target.value)} style={{ flex: 1 }} options={[
                { value: '', label: 'Sin template (escribir manualmente)' },
                ...relevantTemplates.map(t => ({ value: t.id, label: t.name })),
              ]} />
              {channel === 'email' && (
                <U.Select value={signature} onChange={(e)=>setSignature(e.target.value)} style={{ width: 200 }} options={
                  D.SIGNATURES.map(s => {
                    const u = D.USERS.find(u => u.id === s.userId);
                    return { value: s.userId, label: `Firma · ${u?.name?.split(' ')[0]}` };
                  })
                } />
              )}
            </div>

            {/* To */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: 30 }}>Para</span>
              <input value={to} onChange={(e)=>setTo(e.target.value)} placeholder={channel === 'whatsapp' ? '+58 412 000 0000' : 'cliente@empresa.com'}
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '600 13.5px/1.4 var(--f-sans)', color: 'var(--ink)' }} />
              {client?.markbox && <U.Badge tone="wine" size="sm">{client.markbox}</U.Badge>}
            </div>

            {/* Subject */}
            {channel === 'email' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 14 }}>
                <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', minWidth: 30 }}>Asunto</span>
                <input value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="Asunto del correo"
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '700 14px/1.4 var(--f-sans)', color: 'var(--ink)' }} />
              </div>
            )}

            {/* Preview if template applied */}
            {(subject || body) && (
              <div style={{
                padding: 14, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
                marginBottom: 12, maxHeight: 220, overflow: 'auto',
              }}>
                {channel === 'email' && subject && (
                  <div style={{ font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)', marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: highlightVars(subRule(subject)) }} />
                )}
                <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink)', whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: renderMD(highlightVars(subRule(body))) }}
                />
                {channel === 'email' && signature && (
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <window.SignatureRender
                      layout={D.SIGNATURES.find(s=>s.userId===signature)?.layout || 'clasico'}
                      name={D.SIGNATURES.find(s=>s.userId===signature)?.name}
                      role={D.SIGNATURES.find(s=>s.userId===signature)?.role}
                      email={D.SIGNATURES.find(s=>s.userId===signature)?.email}
                      phone={D.SIGNATURES.find(s=>s.userId===signature)?.phone}
                      photo={D.SIGNATURES.find(s=>s.userId===signature)?.photo}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Body editor (rich) */}
            <window.RichEditor value={body} onChange={setBody} />

            {/* Context chips */}
            {(shipment || invoice) && (
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)' }}>
                <span style={{ color: 'var(--info)' }}>{window.Icon.info(13)}</span>
                <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink)', flex: 1 }}>
                  Variables disponibles para este contexto:
                  <span style={{ fontFamily: 'var(--f-mono)', fontWeight: 700, color: 'var(--wine)', marginLeft: 6 }}>
                    {ctx.client && '{{client_name}} {{markbox}} '}
                    {shipment && '{{shipment_id}} {{eta}} {{vessel}} '}
                    {invoice && '{{invoice_id}} {{amount}} '}
                  </span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 14, marginTop: 14, borderTop: '1px solid var(--border)' }}>
              <U.Btn variant="primary" icon={window.Icon.arrowR(13)} onClick={() => setSent(true)} disabled={!to.trim()}>
                Enviar {channel === 'whatsapp' ? 'WhatsApp' : 'correo'}
              </U.Btn>
              <U.Btn variant="ghost" icon={window.Icon.upload(13)}>Adjuntar</U.Btn>
              <U.Btn variant="ghost" onClick={close}>Cancelar</U.Btn>
              <div style={{ marginLeft: 'auto', font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)', textAlign: 'right' }}>
                {channel === 'email' ? <>Desde <b style={{ color: 'var(--ink)' }}>comercial@dtdcargo.com</b></> : <>WhatsApp Business · <b style={{ color: 'var(--ink)' }}>+58 412 DTD-CARG</b></>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Highlight variables that didn't resolve
function highlightVars(s) {
  return (s || '').replace(/\{\{(\w+)\}\}/g, '<span style="background:var(--warning-bg);color:var(--warning);padding:1px 4px;border-radius:3px;font-family:var(--f-mono);font-weight:700;font-size:0.9em">{{$1}}</span>');
}

function renderMD(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(127,15,26,0.08);color:var(--wine);padding:1px 5px;border-radius:3px;font-family:var(--f-mono);font-weight:600">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:var(--wine);text-decoration:underline">$1</a>')
    .replace(/\n/g, '<br/>');
}

// Global API
window.openQuickEmail = (opts = {}) => {
  window.dispatchEvent(new CustomEvent('quickemail:open', { detail: opts }));
};

window.QuickEmailModal = QuickEmailModal;
