/* global React */
/* ── DTD ERP · Mailing · Templates tab ──────────────────────── */

function MailingTemplates() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [editing, setEditing] = React.useState(null);   // template id or 'new'
  const [search, setSearch] = React.useState('');
  const [channel, setChannel] = React.useState('all');
  const [testOpen, setTestOpen] = React.useState(false);

  React.useEffect(() => {
    window.__openMailingEditor = (kind) => { if (kind === 'template-new') setEditing('new'); };
    return () => { delete window.__openMailingEditor; };
  }, []);

  const filtered = D.MAIL_TEMPLATES.filter(t => {
    if (channel !== 'all' && t.channel !== channel) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const editingTpl = editing === 'new'
    ? { id: 'new', name: '', subject: '', category: 'Operativo', channel: 'email', active: true, langs: { es: true, en: false, zh: false }, body: { es: '' } }
    : D.MAIL_TEMPLATES.find(t => t.id === editing);

  return (
    <div>
      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar template…"
        filters={
          <U.Select value={channel} onChange={(e)=>setChannel(e.target.value)} style={{ width: 160 }} options={[
            { value: 'all', label: 'Todos los canales' },
            { value: 'email', label: 'Email' },
            { value: 'whatsapp', label: 'WhatsApp' },
          ]} />
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {filtered.map(t => <TemplateCard key={t.id} t={t} onEdit={() => setEditing(t.id)} onTest={() => setTestOpen(t)} />)}
      </div>

      {filtered.length === 0 && (
        <U.EmptyState icon={window.Icon.mail(22)} title="Sin templates" body="Creá una plantilla nueva o ajustá el filtro." />
      )}

      <U.Drawer
        open={!!editingTpl}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Nuevo template' : `Editar · ${editingTpl?.name}`}
        subtitle={editing === 'new' ? 'Editor visual + preview en vivo' : `${editingTpl?.category} · ${editingTpl?.channel}`}
        width={920}
        actions={
          <>
            <U.Btn variant="ghost" onClick={() => setEditing(null)}>Cerrar</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.mail(13)} onClick={() => setTestOpen(editingTpl)}>Enviar prueba</U.Btn>
            <U.Btn variant="secondary">Guardar borrador</U.Btn>
            <U.Btn variant="primary">{editing === 'new' ? 'Crear template' : 'Guardar cambios'}</U.Btn>
          </>
        }
      >
        {editingTpl && <TemplateEditor t={editingTpl} />}
      </U.Drawer>

      <TestSendModal open={!!testOpen} onClose={() => setTestOpen(false)} template={testOpen} />
    </div>
  );
}

// ── Template card ────────────────────────────────────────────
function TemplateCard({ t, onEdit, onTest }) {
  const U = window.ERPUI;
  const isWA = t.channel === 'whatsapp';
  return (
    <U.Card hoverable style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              width: 28, height: 28, borderRadius: 'var(--r-sm)',
              background: isWA ? '#25D366' : 'var(--wine-tint)',
              color: isWA ? '#fff' : 'var(--wine)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{isWA ? window.Icon.globe(13) : window.Icon.mail(13)}</span>
            <U.Badge tone="neutral" size="sm">{t.category}</U.Badge>
            {t.active ? <U.Badge tone="success" size="sm" dot>activa</U.Badge> : <U.Badge tone="neutral" size="sm">pausada</U.Badge>}
          </div>
          <div style={{ font: '900 15px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{t.name}</div>
          {!isWA && (
            <div style={{ marginTop: 6, padding: '6px 9px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', font: '500 11px/1.3 var(--f-mono)', color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
          )}
        </div>
        <button onClick={onEdit} style={{ width: 28, height: 28, color: 'var(--ink-soft)', borderRadius: 'var(--r-sm)' }} title="Editar">{window.Icon.edit(13)}</button>
      </div>

      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        <span style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Idiomas</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {['es', 'en', 'zh'].map(l => (
            <span key={l} style={{
              padding: '2px 6px', borderRadius: 3,
              font: '700 10px/1.2 var(--f-mono)',
              background: t.langs?.[l] ? 'var(--wine)' : 'transparent',
              color: t.langs?.[l] ? '#fff' : 'var(--ink-mute)',
              border: `1px solid ${t.langs?.[l] ? 'var(--wine)' : 'var(--border-strong)'}`,
              textTransform: 'uppercase',
            }}>{l}</span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '12px 16px', gap: 4, borderTop: '1px solid var(--border)' }}>
        <Stat label="Enviados" v={t.sent} />
        <Stat label="Abiertos" v={t.opened} tone="success" />
        <Stat label="Clics"    v={t.clicked} tone="info" />
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
        <button onClick={onTest} style={{ flex: 1, padding: '10px', font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', borderRight: '1px solid var(--border)' }}>Test send</button>
        <button onClick={onEdit} style={{ flex: 1, padding: '10px', font: '700 12px/1 var(--f-sans)', color: 'var(--wine)' }}>Editar →</button>
      </div>
    </U.Card>
  );
}

function Stat({ label, v, tone = 'neutral' }) {
  const c = { success: 'var(--success)', info: 'var(--info)', neutral: 'var(--ink)' }[tone];
  return (
    <div>
      <div style={{ font: '700 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '800 13px/1 var(--f-mono)', color: c, marginTop: 4 }}>{v ?? '—'}</div>
    </div>
  );
}

// ── Template editor (rich + preview) ─────────────────────────
function TemplateEditor({ t }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [lang, setLang] = React.useState(Object.keys(t.langs || { es: true })[0]);
  const [name, setName] = React.useState(t.name);
  const [subject, setSubject] = React.useState(t.subject);
  const [category, setCategory] = React.useState(t.category);
  const [channel, setChannel] = React.useState(t.channel);
  const [body, setBody] = React.useState(t.body?.[lang] || '');
  const [previewClient, setPreviewClient] = React.useState(D.CLIENTS[0]?.markbox);

  React.useEffect(() => { setBody(t.body?.[lang] || ''); }, [lang, t.body]);

  const langs = ['es', 'en', 'zh'];

  // Preview substitution
  const sampleClient = D.CLIENTS.find(c => c.markbox === previewClient) || D.CLIENTS[0];
  const sampleShip = D.SHIPMENTS.find(s => s.client === sampleClient?.markbox) || D.SHIPMENTS[0];
  const sub = (s) => (s || '').replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const map = {
      client_name: sampleClient?.name, client_company: sampleClient?.company, markbox: sampleClient?.markbox,
      shipment_id: sampleShip?.id, origin: D.origin(sampleShip?.origin).name,
      destination: D.dest(sampleShip?.destination).name, vessel: sampleShip?.vessel || 'COSCO PISCES',
      eta: sampleShip?.eta || '12 JUN 2026', etd: sampleShip?.etd || '14 MAY 2026',
      cbm: sampleShip?.cbm, transit_days: 38,
      tracking_link: 'https://dtdcargo.com/track/' + sampleShip?.id,
      quote_id: 'Q-2026-0418', total_usd: '14,200', valid_until: '21 JUN 2026',
      accept_link: 'https://dtdcargo.com/q/Q-2026-0418',
      invoice_id: 'F-2026-0418', amount: '84,200', days: 10,
      agent_name: 'Martina Acuña', portal_link: 'https://app.dtdcargo.com',
      signed_by: 'Carlos Méndez', delay_days: 2, delay_reason: 'congestión Canal de Panamá',
      new_eta: '15 JUN 2026',
    };
    return `<span class="var-chip">${map[k] ?? `{{${k}}}`}</span>`;
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, minHeight: 540 }}>
      {/* LEFT: Editor */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
          <U.Input label="Nombre interno" value={name} onChange={(e)=>setName(e.target.value)} />
          <U.Select label="Canal" value={channel} onChange={(e)=>setChannel(e.target.value)} options={[
            { value: 'email', label: 'Email' },
            { value: 'whatsapp', label: 'WhatsApp' },
          ]} />
        </div>

        <U.Select label="Categoría" value={category} onChange={(e)=>setCategory(e.target.value)}
          options={['Cotizaciones', 'Operativo', 'Alertas', 'Onboarding', 'Finanzas']} />

        {/* Lang tabs */}
        <div>
          <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Idioma</div>
          <div style={{ display: 'flex', gap: 4, padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', width: 'fit-content' }}>
            {langs.map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: '6px 14px', borderRadius: 'var(--r-sm)',
                background: lang === l ? 'var(--bg-surface)' : 'transparent',
                color: lang === l ? 'var(--ink)' : 'var(--ink-soft)',
                font: `${lang === l ? '700' : '500'} 12px/1 var(--f-sans)`,
                letterSpacing: '0.04em', textTransform: 'uppercase',
                boxShadow: lang === l ? 'var(--shadow-xs)' : 'none',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {l}
                {t.langs?.[l] ? <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border-strong)' }} />}
              </button>
            ))}
          </div>
        </div>

        {channel === 'email' && (
          <U.Input label="Asunto" value={subject} onChange={(e)=>setSubject(e.target.value)} />
        )}

        {/* Body editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Cuerpo</div>
          <RichEditor value={body} onChange={setBody} />
        </div>
      </div>

      {/* RIGHT: Preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div className="eyebrow eyebrow-wine">PREVIEW EN VIVO · CON DATOS REALES</div>
          <U.Select value={previewClient} onChange={(e)=>setPreviewClient(e.target.value)} style={{ width: 200 }}
            options={D.CLIENTS.slice(0, 8).map(c => ({ value: c.markbox, label: `${c.markbox} · ${c.company}` }))} />
        </div>

        {channel === 'email' ? (
          <div style={{
            flex: 1, background: '#FFFFFF', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: '#F7F5F0' }}>
              <div style={{ font: '600 10.5px/1 Archivo, sans-serif', color: '#6B6B6B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>De: {sampleClient ? 'Martina Acuña <martina@dtdcargo.com>' : '—'}</div>
              <div style={{ font: '600 10.5px/1 Archivo, sans-serif', color: '#6B6B6B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>Para: {sampleClient?.email}</div>
              <div style={{ font: '800 14px/1.3 Archivo, sans-serif', color: '#0F1E3D', letterSpacing: '-0.01em' }} dangerouslySetInnerHTML={{ __html: sub(subject) }} />
            </div>
            <div className="email-preview-body" style={{ padding: 22, flex: 1, overflow: 'auto', font: '500 13.5px/1.7 Archivo, sans-serif', color: '#0F1E3D' }}>
              <div dangerouslySetInnerHTML={{ __html: renderMarkdownish(sub(body)) }} />
              <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid #E8E6E2' }}>
                <SignaturePreview userId="u-002" inline />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, background: '#0B141A', borderRadius: 'var(--r-lg)', padding: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <div style={{ maxWidth: 320, background: '#005C4B', color: '#fff', padding: '10px 12px', borderRadius: '8px 8px 8px 2px', font: '500 13.5px/1.5 Archivo, sans-serif', whiteSpace: 'pre-wrap' }}>
              <div dangerouslySetInnerHTML={{ __html: renderWA(sub(body)) }} />
              <div style={{ marginTop: 6, font: '500 10.5px/1 Archivo, sans-serif', color: 'rgba(255,255,255,0.65)', textAlign: 'right' }}>10:24 ✓✓</div>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .var-chip { display: inline-block; padding: 1px 6px; background: var(--wine-tint); color: var(--wine); border-radius: 3px; font: 700 12px/1.4 var(--f-mono); }
        .email-preview-body a { color: var(--wine); text-decoration: underline; }
        .email-preview-body p { margin: 0 0 12px; }
        .email-preview-body strong { color: var(--ink); }
        .email-preview-body code { padding: 2px 5px; background: #F2F0EC; border-radius: 3px; font: 700 12px/1.4 var(--f-mono); color: var(--wine); }
      `}} />
    </div>
  );
}

// Render a tiny markdown-ish subset (**bold**, *italic*, [link](url), `code`, line breaks)
function renderMarkdownish(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/, '<p>$1</p>');
}
function renderWA(s) {
  return s
    .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');
}

// ── Rich Editor ──────────────────────────────────────────────
function RichEditor({ value, onChange }) {
  const D = window.ERPData;
  const ref = React.useRef(null);
  const [varOpen, setVarOpen] = React.useState(false);

  const insertAtCursor = (text) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  };

  const wrap = (before, after = before) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart, end = el.selectionEnd;
    const selected = value.slice(start, end) || 'texto';
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  };

  const varsByGroup = React.useMemo(() => {
    const m = new Map();
    D.TEMPLATE_VARIABLES.forEach(v => {
      if (!m.has(v.group)) m.set(v.group, []);
      m.get(v.group).push(v);
    });
    return [...m.entries()];
  }, []);

  const ToolBtn = ({ children, onClick, title }) => (
    <button onClick={onClick} title={title} style={{
      width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'var(--r-sm)', color: 'var(--ink-soft)',
      font: '700 13px/1 var(--f-sans)',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--ink)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
    >{children}</button>
  );

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 280,
      background: 'var(--bg-surface)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '6px 8px', borderBottom: '1px solid var(--border)',
      }}>
        <ToolBtn onClick={() => wrap('**')} title="Negrita (Ctrl+B)"><b>B</b></ToolBtn>
        <ToolBtn onClick={() => wrap('*')} title="Cursiva (Ctrl+I)"><i>I</i></ToolBtn>
        <ToolBtn onClick={() => wrap('`')} title="Código"><code style={{ font: '700 11px/1 var(--f-mono)' }}>{'</>'}</code></ToolBtn>
        <Divider />
        <ToolBtn onClick={() => insertAtCursor('\n- ')} title="Lista">•</ToolBtn>
        <ToolBtn onClick={() => insertAtCursor('[texto del link](https://)')} title="Link">🔗</ToolBtn>
        <ToolBtn onClick={() => insertAtCursor('\n![alt](https://imagen)\n')} title="Imagen">🖼</ToolBtn>
        <Divider />

        <div style={{ position: 'relative' }}>
          <button onClick={() => setVarOpen(v => !v)} style={{
            padding: '5px 9px', borderRadius: 'var(--r-sm)',
            background: 'var(--wine-tint)', color: 'var(--wine)',
            font: '700 11px/1 var(--f-sans)', letterSpacing: '0.04em',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ font: '700 11px/1 var(--f-mono)' }}>{'{{'}</span>
            Variable
            {window.Icon.chevD(11)}
          </button>
          {varOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0,
              width: 320, maxHeight: 360, overflow: 'auto', zIndex: 10,
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', padding: 6,
            }}
            onMouseLeave={() => setVarOpen(false)}
            >
              {varsByGroup.map(([g, vs]) => (
                <div key={g}>
                  <div style={{ padding: '6px 10px', font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{g}</div>
                  {vs.map(v => (
                    <button key={v.tag} onClick={() => { insertAtCursor(v.tag); setVarOpen(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '6px 10px', textAlign: 'left', borderRadius: 'var(--r-sm)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <code style={{ font: '700 11px/1.2 var(--f-mono)', color: 'var(--wine)', minWidth: 110 }}>{v.tag}</code>
                      <span style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', flex: 1 }}>{v.desc}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <Divider />
        <ToolBtn onClick={() => insertAtCursor('\n\n— {{agent_name}}')} title="Insertar firma">{window.Icon.edit(13)}</ToolBtn>

        <div style={{ marginLeft: 'auto', font: '600 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
          Markdown · {value.length} chars
        </div>
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Escribí el cuerpo del email. Usá **negrita**, *cursiva*, [link](url) y {{variables}}."
        style={{
          flex: 1, padding: '14px 16px',
          border: 0, outline: 'none', resize: 'none',
          background: 'transparent', color: 'var(--ink)',
          font: '500 13.5px/1.7 var(--f-mono)',
          minHeight: 220,
        }}
      />
    </div>
  );
}
function Divider() {
  return <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 4px' }} />;
}

// ── Test send modal ──────────────────────────────────────────
function TestSendModal({ open, onClose, template }) {
  const U = window.ERPUI;
  const [to, setTo] = React.useState('cvasquez@dtdcargo.com');
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => { setSent(false); }, [open]);

  return (
    <U.Modal
      open={!!open} onClose={onClose}
      title="Enviar prueba"
      width={460}
      actions={!sent && (
        <>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={window.Icon.mail(13)} onClick={() => setSent(true)}>Enviar prueba</U.Btn>
        </>
      )}
    >
      {sent ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.check(22)}</div>
          <div style={{ font: '900 18px/1.2 var(--f-display)', color: 'var(--ink)' }}>Email de prueba enviado</div>
          <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>Llegará a <b style={{ color: 'var(--ink)' }}>{to}</b> en unos segundos.</div>
          <div style={{ marginTop: 18 }}>
            <U.Btn variant="primary" onClick={onClose}>Cerrar</U.Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {template && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Template</div>
              <div style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 5 }}>{template.name}</div>
            </div>
          )}
          <U.Input label="Enviar a" value={to} onChange={(e)=>setTo(e.target.value)} type="email" />
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
            Las variables se rellenan con datos del primer cliente disponible para que veas el resultado real.
          </div>
        </div>
      )}
    </U.Modal>
  );
}

// ── Inline signature preview (reusable across compose / template) ─
function SignaturePreview({ userId, inline = false }) {
  const D = window.ERPData;
  const sig = D.SIGNATURES.find(s => s.userId === userId) || D.SIGNATURES[0];
  if (!sig) return null;
  return (
    <div style={{
      font: '500 12px/1.5 Archivo, sans-serif', color: '#0F1E3D',
      borderTop: inline ? 0 : '1px solid var(--border)',
      paddingTop: inline ? 0 : 12,
    }}>
      <div style={{ font: '800 13px/1.2 Archivo, sans-serif', color: '#0F1E3D' }}>{sig.name}</div>
      <div style={{ font: '500 11.5px/1.3 Archivo, sans-serif', color: '#6B6B6B', marginTop: 2 }}>{sig.role}</div>
      <div style={{ marginTop: 6, font: '500 11px/1.5 Archivo, sans-serif', color: '#6B6B6B' }}>
        {sig.email} · <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{sig.phone}</span>
      </div>
      <div style={{ marginTop: 4, font: '700 10px/1 Archivo, sans-serif', color: '#7F0F1A', letterSpacing: '0.14em' }}>DTDCARGO.COM</div>
    </div>
  );
}

window.MailingTemplates = MailingTemplates;
window.SignaturePreview = SignaturePreview;
window.RichEditor = RichEditor;
