/* global React */
/* ── DTD ERP · Mailing · Configuración (SMTP/OAuth + blacklist) ─ */

function MailingConfig() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [section, setSection] = React.useState('senders');
  const [setupOpen, setSetupOpen] = React.useState(null);
  const [blacklist, setBlacklist] = React.useState(D.BLACKLIST);
  const [newEmail, setNewEmail] = React.useState('');

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'flex-start' }}>
        {/* Side nav */}
        <U.Card padded={false}>
          {[
            { id: 'senders',   label: 'Proveedores',     icon: 'mail',  count: D.SMTP_PROVIDERS.filter(p => p.configured).length },
            { id: 'whatsapp',  label: 'WhatsApp',        icon: 'globe', count: 1 },
            { id: 'limits',    label: 'Límites & throttle', icon: 'clock' },
            { id: 'blacklist', label: 'Blacklist',       icon: 'shield', count: blacklist.length },
            { id: 'branding',  label: 'Branding × cliente', icon: 'tag', count: 3 },
          ].map((s, i) => (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              width: '100%', textAlign: 'left',
              background: section === s.id ? 'var(--wine-tint)' : 'transparent',
              color: section === s.id ? 'var(--wine)' : 'var(--ink)',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
              font: `${section === s.id ? '700' : '500'} 13px/1 var(--f-sans)`,
            }}>
              <span style={{ color: section === s.id ? 'var(--wine)' : 'var(--ink-soft)' }}>{window.Icon[s.icon](16)}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
              {s.count != null && (
                <span style={{
                  padding: '2px 7px', borderRadius: 'var(--r-sm)',
                  background: section === s.id ? 'var(--wine)' : 'var(--bg-elevated)',
                  color: section === s.id ? '#fff' : 'var(--ink-mute)',
                  font: '700 10.5px/1.3 var(--f-mono)',
                }}>{s.count}</span>
              )}
            </button>
          ))}
        </U.Card>

        {/* Section content */}
        <div>
          {section === 'senders' && <SectionSenders providers={D.SMTP_PROVIDERS} onSetup={setSetupOpen} />}
          {section === 'whatsapp' && <SectionWhatsApp />}
          {section === 'limits' && <SectionLimits />}
          {section === 'blacklist' && <SectionBlacklist blacklist={blacklist} setBlacklist={setBlacklist} newEmail={newEmail} setNewEmail={setNewEmail} />}
          {section === 'branding' && <SectionBranding />}
        </div>
      </div>

      <U.Drawer
        open={!!setupOpen}
        onClose={() => setSetupOpen(null)}
        title={`Configurar ${setupOpen?.name || ''}`}
        subtitle={setupOpen ? `Tipo: ${setupOpen.type.toUpperCase()}` : ''}
        width={540}
        actions={
          <>
            <U.Btn variant="ghost" onClick={() => setSetupOpen(null)}>Cancelar</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.refresh(13)}>Test conexión</U.Btn>
            <U.Btn variant="primary">Guardar y activar</U.Btn>
          </>
        }
      >
        {setupOpen && <ProviderSetup p={setupOpen} />}
      </U.Drawer>
    </div>
  );
}

// ── Senders section ──────────────────────────────────────────
function SectionSenders({ providers, onSetup }) {
  const U = window.ERPUI;
  const emailProviders = providers.filter(p => p.id !== 'whatsapp');
  return (
    <div>
      <U.Card padded style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--info)' }}>{window.Icon.info(15)}</span>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            El ERP soporta varios proveedores. <b>El que esté marcado como "activo"</b> es el que envía los correos. Los demás quedan configurados para alternar rápido.
          </div>
        </div>
      </U.Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {emailProviders.map(p => (
          <U.Card key={p.id} hoverable style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--r-md)',
                background: p.active ? 'var(--wine)' : 'var(--bg-elevated)',
                color: p.active ? '#fff' : 'var(--ink-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{window.Icon[p.icon](18)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ font: '800 14px/1.1 var(--f-display)', color: 'var(--ink)' }}>{p.name}</div>
                  <U.Badge tone="neutral" size="sm">{p.type.toUpperCase()}</U.Badge>
                  {p.active && <U.Badge tone="success" size="sm" dot>activo</U.Badge>}
                </div>
                {p.configured ? (
                  <div style={{ font: '500 11.5px/1.4 var(--f-mono)', color: 'var(--ink-soft)' }}>{p.account}</div>
                ) : (
                  <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>No configurado</div>
                )}
                {p.configured && (
                  <div style={{ marginTop: 6, font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>
                    {p.sent30d.toLocaleString()} enviados · últimos 30 días
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {p.configured && !p.active && <U.Btn variant="primary" size="sm" full>Activar</U.Btn>}
              {p.active && <U.Btn variant="secondary" size="sm" full disabled>Activo</U.Btn>}
              <U.Btn variant={p.configured ? 'ghost' : 'primary'} size="sm" onClick={() => onSetup(p)} full={!p.configured}>
                {p.configured ? 'Editar' : 'Configurar'}
              </U.Btn>
            </div>
          </U.Card>
        ))}
      </div>
    </div>
  );
}

function ProviderSetup({ p }) {
  const U = window.ERPUI;
  if (p.type === 'oauth') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '14px 16px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--info)' }}>{window.Icon.info(14)}</span>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            {p.name} se conecta por OAuth. Vas a ser redirigido a {p.id === 'gmail' ? 'Google' : 'Microsoft'} para autorizar el envío.
          </div>
        </div>
      </div>
      <U.Input label="Cuenta a usar" value={p.account || ''} placeholder="usuario@dtdcargo.com" />
      <U.Select label="Permisos" options={['Solo enviar', 'Enviar + leer respuestas', 'Acceso completo (no recomendado)']} />
      <U.Btn variant="primary" full icon={window.Icon.link(13)} onClick={() => window.DTDWiring?.openOAuthFlow(p.id)}>Conectar con {p.id === 'gmail' ? 'Google' : 'Microsoft'}</U.Btn>
    </div>
  );
  if (p.type === 'smtp') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <U.Input label="Servidor SMTP" placeholder="smtp.dtdcargo.com" mono />
        <U.Input label="Puerto" placeholder="587" mono />
      </div>
      <U.Input label="Usuario" placeholder="comercial@dtdcargo.com" />
      <U.Input label="Password" type="password" placeholder="••••••••••••" />
      <U.Select label="Encriptación" options={['STARTTLS', 'SSL/TLS', 'Ninguna']} />
      <U.Input label="Remitente por defecto" placeholder="DTD-Cargo <comercial@dtdcargo.com>" />
    </div>
  );
  if (p.type === 'api') return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <U.Input label="API Key" type="password" placeholder="••••••••" mono />
      <U.Input label="Dominio verificado" placeholder="dtdcargo.com" mono />
      <U.Input label="Remitente por defecto" placeholder="DTD-Cargo <comercial@dtdcargo.com>" />
      <div style={{ padding: '12px 14px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--warning)' }}>{window.Icon.warn(13)}</span>
          <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            Verificá el dominio en {p.name} y agregá los registros SPF/DKIM antes de activar.
          </div>
        </div>
      </div>
    </div>
  );
  return null;
}

// ── WhatsApp section ─────────────────────────────────────────
function SectionWhatsApp() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const wa = D.SMTP_PROVIDERS.find(p => p.id === 'whatsapp');
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18 }}>
        <div style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: '#25D366', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{window.Icon.globe(22)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)' }}>WhatsApp Business</div>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Canal paralelo al email para alertas operativas y comunicaciones cortas con clientes.</div>
        </div>
        <U.Badge tone="success" dot>conectado</U.Badge>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 16 }}>
        <U.Field label="Número Business" value={wa?.account} mono />
        <U.Field label="Cuenta verificada" value="Sí · Meta Business Manager" />
        <U.Field label="Templates aprobados" value="4 · estimado, ETA, POD, demora" />
        <U.Field label="Mensajes 30d" value={`${wa?.sent30d || 0} enviados`} mono />
      </div>

      <div style={{ padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>RESTRICCIONES IMPORTANTES</div>
        <ul style={{ margin: 0, paddingLeft: 18, font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <li>Solo se pueden enviar templates pre-aprobados por Meta fuera de la ventana de 24h</li>
          <li>El cliente debe haber iniciado conversación para mensajes libres (ventana de 24h)</li>
          <li>Los templates con variables deben aprobarse caso por caso</li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <U.Btn variant="secondary" icon={window.Icon.refresh(13)}>Sincronizar templates</U.Btn>
        <U.Btn variant="ghost" icon={window.Icon.external(12)}>Abrir Meta Business</U.Btn>
      </div>
    </U.Card>
  );
}

// ── Limits section ───────────────────────────────────────────
function SectionLimits() {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 18 }}>LÍMITES DE ENVÍO</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 22 }}>
        <U.Input label="Máx. correos / hora" defaultValue="500" suffix="emails/h" mono />
        <U.Input label="Máx. correos / día" defaultValue="5000" suffix="emails/d" mono />
        <U.Input label="Throttle entre envíos" defaultValue="200" suffix="ms" mono />
        <U.Input label="Reintentos en rebote" defaultValue="3" suffix="intentos" mono />
      </div>

      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>HORARIOS PERMITIDOS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <U.Input label="Inicio (VE)" defaultValue="08:00" mono />
        <U.Input label="Fin (VE)" defaultValue="20:00" mono />
        <U.Select label="Días" options={['Todos los días', 'Lun a Sáb', 'Lun a Vie']} />
      </div>

      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>EXCEPCIONES</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { l: 'Alertas críticas (ETA en riesgo) ignoran horarios', def: true },
          { l: 'Estimados se envían inmediatamente sin throttle',  def: true },
          { l: 'Cuenta atrás SLA suspende límites diarios',           def: false },
        ].map(o => (
          <label key={o.l} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
            <input type="checkbox" defaultChecked={o.def} style={{ accentColor: 'var(--wine)', width: 16, height: 16 }} />
            <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{o.l}</span>
          </label>
        ))}
      </div>
    </U.Card>
  );
}

// ── Blacklist section ────────────────────────────────────────
function SectionBlacklist({ blacklist, setBlacklist, newEmail, setNewEmail }) {
  const U = window.ERPUI;
  const add = () => {
    if (!newEmail.trim()) return;
    setBlacklist([...blacklist, { email: newEmail, reason: 'agregado manualmente', added: '2026-05-23', addedBy: 'Carlos V.' }]);
    setNewEmail('');
  };
  const remove = (email) => setBlacklist(blacklist.filter(b => b.email !== email));

  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 6 }}>BLACKLIST</div>
        <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 14 }}>
          Direcciones que <b style={{ color: 'var(--ink)' }}>nunca</b> recibirán correos del ERP. Incluye rebotes permanentes, opt-outs y excepciones manuales.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <U.Input value={newEmail} onChange={(e)=>setNewEmail(e.target.value)} placeholder="email@dominio.com" type="email" style={{ flex: 1 }} />
          <U.Btn variant="primary" icon={window.Icon.plus(13)} onClick={add}>Agregar</U.Btn>
        </div>
      </div>
      <div>
        {blacklist.length === 0
          ? <U.EmptyState style={{ margin: 18 }} icon={window.Icon.shield(20)} title="Blacklist vacía" body="No hay direcciones bloqueadas." />
          : blacklist.map((b, i) => (
            <div key={b.email} style={{
              display: 'grid', gridTemplateColumns: '1.4fr 1fr 100px 110px 40px',
              gap: 16, padding: '12px 18px',
              borderTop: i > 0 ? '1px solid var(--border)' : 0, alignItems: 'center',
            }}>
              <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{b.email}</code>
              <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{b.reason}</span>
              <span style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{b.added}</span>
              <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{b.addedBy}</span>
              <button onClick={() => remove(b.email)} style={{ color: 'var(--ink-soft)', width: 28, height: 28 }} title="Quitar de blacklist">{window.Icon.trash(13)}</button>
            </div>
          ))
        }
      </div>
    </U.Card>
  );
}

// ── Branding × cliente ───────────────────────────────────────
function SectionBranding() {
  const D = window.ERPData;
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="eyebrow eyebrow-wine">BRANDING × CLIENTE</div>
          <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>White-label para clientes premium</div>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '54ch' }}>
            Algunos clientes Platinum reciben correos con su propio branding en vez del de DTD-Cargo. Útil cuando el cliente reenvía a sus propios consumidores finales.
          </div>
        </div>
        <U.Btn variant="primary" icon={window.Icon.plus(13)} size="sm">Agregar branding</U.Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {[
          { client: 'Industrias Polar SA',   markbox: 'DTD-5392', primary: '#0A4D8C', logo: 'POLAR', from: 'logistica@polar.com.ve',  active: true },
          { client: 'Castro Hermanos CA',    markbox: 'DTD-5354', primary: '#1A4D2E', logo: 'CASTRO', from: 'compras@castrohnos.com',  active: true },
          { client: 'Acindar Comercial CA',  markbox: 'DTD-5452', primary: '#7F0F1A', logo: 'ACINDAR', from: 'cmendez@acindar.ve',     active: false },
        ].map(b => (
          <div key={b.markbox} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--r-sm)',
                background: b.primary, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                font: '900 9.5px/1 var(--f-display)', letterSpacing: '0.05em',
              }}>{b.logo}</div>
              <div style={{ flex: 1 }}>
                <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{b.client}</div>
                <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{b.markbox}</code>
              </div>
              <U.Badge tone={b.active ? 'success' : 'neutral'} size="sm" dot>{b.active ? 'activo' : 'pausado'}</U.Badge>
            </div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
              <div>Color: <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: b.primary, verticalAlign: 'middle', marginRight: 4 }} /><code style={{ fontFamily: 'var(--f-mono)' }}>{b.primary}</code></div>
              <div style={{ marginTop: 3 }}>From: <code style={{ fontFamily: 'var(--f-mono)' }}>{b.from}</code></div>
            </div>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

window.MailingConfig = MailingConfig;
