/* global React */
/* ── DTD ERP · Mailing · Envío manual (Compose) ─────────────── */

function MailingCompose() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [to, setTo] = React.useState('');
  const [cc, setCc] = React.useState('');
  const [bcc, setBcc] = React.useState('');
  const [ccVisible, setCcVisible] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [template, setTemplate] = React.useState('');
  const [signature, setSignature] = React.useState('u-001');
  const [channel, setChannel] = React.useState('email');
  const [sentOk, setSentOk] = React.useState(false);
  const [scheduledOk, setScheduledOk] = React.useState(null);
  const [attachments, setAttachments] = React.useState([]);
  const [showHistory, setShowHistory] = React.useState(false);

  const applyTemplate = (id) => {
    setTemplate(id);
    const tpl = D.MAIL_TEMPLATES.find(t => t.id === id);
    if (!tpl) return;
    setChannel(tpl.channel);
    if (tpl.channel === 'email') setSubject(tpl.subject);
    setBody(tpl.body?.es || '');
  };

  if (scheduledOk) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{window.Icon.clock(28)}</div>
        <div style={{ font: '900 22px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Envío programado</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 10, maxWidth: '42ch' }}>
          Se enviará a <b style={{ color: 'var(--ink)' }}>{scheduledOk.to.split(',')[0]}</b> el <b style={{ color: 'var(--ink)' }}>{scheduledOk.date} {scheduledOk.time}</b> ({scheduledOk.tz}). Lo puedes ver y cancelar en la pestaña <b style={{ color: 'var(--wine)' }}>Programados</b>.
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
          <U.Btn variant="secondary" onClick={() => { setScheduledOk(null); setTo(''); setSubject(''); setBody(''); setTemplate(''); setAttachments([]); }}>Redactar otro</U.Btn>
        </div>
      </div>
    );
  }

  if (sentOk) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>{window.Icon.check(28)}</div>
        <div style={{ font: '900 22px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Correo enviado</div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 10, maxWidth: '40ch' }}>
          Llegó a <b style={{ color: 'var(--ink)' }}>{to.split(',')[0]}</b> y fue registrado en el log de envíos.
        </div>
        <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
          <U.Btn variant="secondary" onClick={() => { setSentOk(false); setTo(''); setSubject(''); setBody(''); setTemplate(''); }}>Enviar otro</U.Btn>
          <U.Btn variant="primary" onClick={() => setSentOk(false)}>Ver bandeja</U.Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'flex-start' }}>
      {/* LEFT: compose */}
      <U.Card padded={false}>
        {/* Channel switch */}
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow eyebrow-wine">CANAL</div>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
            {[
              { v: 'email', l: 'Email', i: 'mail' },
              { v: 'whatsapp', l: 'WhatsApp', i: 'globe' },
            ].map(c => (
              <button key={c.v} onClick={() => setChannel(c.v)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 'var(--r-sm)',
                background: channel === c.v ? 'var(--bg-surface)' : 'transparent',
                color: channel === c.v ? 'var(--ink)' : 'var(--ink-soft)',
                font: `${channel === c.v ? '700' : '500'} 12.5px/1 var(--f-sans)`,
                boxShadow: channel === c.v ? 'var(--shadow-xs)' : 'none',
              }}>
                {window.Icon[c.i](13)} {c.l}
              </button>
            ))}
          </div>
          <U.Select value={template} onChange={(e)=>applyTemplate(e.target.value)} style={{ marginLeft: 'auto', width: 240 }} options={[
            { value: '', label: 'Usar template…' },
            ...D.MAIL_TEMPLATES.filter(t => t.channel === channel).map(t => ({ value: t.id, label: t.name })),
          ]} />
        </div>

        <div style={{ padding: '18px 22px' }}>
          {/* To/Cc/Bcc */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 32 }}>Para</span>
            <input value={to} onChange={(e)=>setTo(e.target.value)} placeholder={channel === 'whatsapp' ? '+58 412 000 0000' : 'cliente@empresa.com  (o pega varios separados por coma)'}
              style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '500 13.5px/1.5 var(--f-sans)', color: 'var(--ink)' }} />
            {channel === 'email' && !ccVisible && (
              <button onClick={() => setCcVisible(true)} style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)' }}>+ CC / BCC</button>
            )}
          </div>

          {channel === 'email' && ccVisible && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 32 }}>CC</span>
                <input value={cc} onChange={(e)=>setCc(e.target.value)} placeholder="cc@empresa.com"
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '500 13.5px/1.5 var(--f-sans)', color: 'var(--ink)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 32 }}>BCC</span>
                <input value={bcc} onChange={(e)=>setBcc(e.target.value)} placeholder="oculto@empresa.com"
                  style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '500 13.5px/1.5 var(--f-sans)', color: 'var(--ink)' }} />
              </div>
            </>
          )}

          {channel === 'email' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
              <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 32 }}>Asunto</span>
              <input value={subject} onChange={(e)=>setSubject(e.target.value)} placeholder="Asunto del correo"
                style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '600 14px/1.4 var(--f-sans)', color: 'var(--ink)' }} />
            </div>
          )}

          {/* Body */}
          <div style={{ marginTop: 14 }}>
            <window.RichEditor value={body} onChange={setBody} />
          </div>

          {/* Signature block (auto-attached) */}
          {channel === 'email' && (
            <div style={{ marginTop: 14, padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Firma adjunta</span>
                <U.Select value={signature} onChange={(e)=>setSignature(e.target.value)} style={{ width: 200 }} options={
                  D.SIGNATURES.map(s => {
                    const u = D.USERS.find(u => u.id === s.userId);
                    return { value: s.userId, label: `${u?.name} (${s.layout})` };
                  })
                } />
              </div>
              <div style={{ padding: 14, background: '#fff', borderRadius: 4 }}>
                <window.SignatureRender
                  layout={D.SIGNATURES.find(s=>s.userId===signature)?.layout || 'clasico'}
                  name={D.SIGNATURES.find(s=>s.userId===signature)?.name}
                  role={D.SIGNATURES.find(s=>s.userId===signature)?.role}
                  email={D.SIGNATURES.find(s=>s.userId===signature)?.email}
                  phone={D.SIGNATURES.find(s=>s.userId===signature)?.phone}
                  photo={D.SIGNATURES.find(s=>s.userId===signature)?.photo}
                />
              </div>
            </div>
          )}

          {/* Adjuntos */}
          {attachments.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {attachments.map((f, i) => (
                <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                  <span style={{ color: 'var(--wine)' }}>{window.Icon.doc ? window.Icon.doc(13) : null}</span>
                  <span style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name || f}</span>
                  {f.size && <span style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{(f.size/1024).toFixed(0)} KB</span>}
                  <button onClick={() => setAttachments(a => a.filter((_, j) => j !== i))} title="Quitar" style={{ color: 'var(--ink-mute)', background: 'transparent', border: 0, cursor: 'pointer', display: 'inline-flex' }}>{window.Icon.x ? window.Icon.x(12) : '×'}</button>
                </div>
              ))}
            </div>
          )}

          {/* Footer actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 16, marginTop: 16, borderTop: '1px solid var(--border)' }}>
            <U.Btn variant="primary" icon={window.Icon.arrowR(13)} onClick={() => setSentOk(true)} disabled={!to.trim()}>Enviar ahora</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.clock(13)} onClick={() => window.DTDWiring?.openScheduleModal({ onSchedule: (s) => {
              const item = { id: 'sch-' + Date.now(), iso: s.iso, date: s.date, time: s.time, tz: s.tz, to: to, subject: channel === 'email' ? (subject || '(sin asunto)') : 'WhatsApp', channel, status: 'queued', attachments: attachments.length };
              window.__scheduledEmails = window.__scheduledEmails || [];
              window.__scheduledEmails.unshift(item);
              try { window.dispatchEvent(new CustomEvent('dtd-scheduled-changed')); } catch (e) {}
              setScheduledOk(item);
            } })} disabled={!to.trim()}>Programar</U.Btn>
            <U.Btn variant="ghost" icon={window.Icon.upload(13)} onClick={() => window.DTDWiring?.openAttachModal({ onSelect: (files) => setAttachments(prev => [...prev, ...(files || [])]) })}>Adjuntar{attachments.length > 0 ? ` · ${attachments.length}` : ''}</U.Btn>
            <div style={{ marginLeft: 'auto', font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
              {channel === 'email' && <>Saliendo desde <b style={{ color: 'var(--ink)' }}>comercial@dtdcargo.com</b></>}
              {channel === 'whatsapp' && <>WhatsApp Business · <b style={{ color: 'var(--ink)' }}>+58 412 DTD-CARG</b></>}
            </div>
          </div>
        </div>
      </U.Card>

      {/* RIGHT: helpers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>DESTINATARIO RÁPIDO</div>
          <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 12 }}>Elige un cliente o lead y se autocompleta el destinatario.</div>
          <U.Select value="" onChange={(e) => {
            const c = D.CLIENTS.find(x => x.markbox === e.target.value);
            if (c) setTo(c.email);
          }} options={[
            { value: '', label: 'Cliente…' },
            ...D.CLIENTS.map(c => ({ value: c.markbox, label: `${c.markbox} · ${c.company}` })),
          ]} />
          <div style={{ marginTop: 8 }}>
            <U.Select value="" onChange={() => {}} options={[
              { value: '', label: 'Lead…' },
              ...D.LEADS.map(l => ({ value: l.id, label: l.company })),
            ]} />
          </div>
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>ENVÍOS RECIENTES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { to: 'cmendez@acindar.ve',   subject: 'Estimado DTD-Cargo · E-2026-0418', time: 'hace 4 min' },
              { to: 'apereira@imp-pereira.com', subject: 'Tu carga zarpó · DTDU-472816', time: 'hace 18 min' },
              { to: 'lfernandez@polar.com.ve', subject: 'ETA en riesgo · DTDU-419032', time: 'hace 1 h' },
            ].map((e, i) => (
              <div key={i} style={{ padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)' }}>
                <div style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</div>
                <div style={{ font: '500 10.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{e.to}</div>
                <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{e.time}</div>
              </div>
            ))}
          </div>
        </U.Card>

        <U.Card padded>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ color: 'var(--info)' }}>{window.Icon.info(14)}</span>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
              También puedes abrir un compose rápido desde cualquier vista (cliente, embarque, factura) con el botón <b>Email</b>.
            </div>
          </div>
        </U.Card>
      </div>
    </div>
  );
}

window.MailingCompose = MailingCompose;
