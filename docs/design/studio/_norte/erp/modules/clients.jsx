/* global React */
/* ── DTD ERP · Clientes & MARKBOX ───────────────────────────── */

const { useState: _useStateCli, useMemo: _useMemoCli } = React;

const CLI_COLS_DEFAULT = [
  { key: 'markbox',   visible: true },
  { key: 'name',      visible: true },
  { key: 'tier',      visible: true },
  { key: 'segment',   visible: true },
  { key: 'city',      visible: true },
  { key: 'shipments', visible: true },
  { key: 'billed',    visible: true },
  { key: 'status',    visible: true },
];

function ModuleClients({ goTo, view, setView, selectedId, setSelectedId }) {
  const D = window.ERPData;
  const baseClients = D.byTenant(D.CLIENTS);   // multi-tenant
  const U = window.ERPUI;
  const hide = U.useHideValues();
  const loading = U.useFirstLoad('clients');
  const [search, setSearch] = _useStateCli('');
  const [tier, setTier] = _useStateCli('all');
  const [status, setStatus] = _useStateCli('all');
  const [drawerKind, setDrawerKind] = _useStateCli(null);
  const [colCfg, setColCfg] = U.useColumns('dtd-cli-cols-v1', CLI_COLS_DEFAULT);

  React.useEffect(() => {
    if (selectedId && view === 'detail') setDrawerKind('detail');
    if (view === 'create') setDrawerKind('create');
  }, [selectedId, view]);

  const filtered = _useMemoCli(() => {
    let rows = baseClients;
    if (status !== 'all') rows = rows.filter(c => c.status === status);
    if (tier !== 'all') rows = rows.filter(c => c.tier === tier);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(c => c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q) || c.markbox.toLowerCase().includes(q) || c.rif.toLowerCase().includes(q));
    }
    return rows;
  }, [search, tier, status]);

  const detailRecord = D.CLIENTS.find(c => c.markbox === selectedId);

  const tierColor = { Platinum: 'wine', Gold: 'warning', Silver: 'info', Bronze: 'neutral' };

  const columns = [
    { label: 'MARKBOX', key: 'markbox', render: (r) => <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.markbox}</code>, width: 100 },
    { label: 'Cliente', key: 'name', render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <U.Avatar initials={r.name.split(' ').map(w=>w[0]).slice(0,2).join('')} color={r.status === 'active' ? 'wine' : 'neutral'} size={32} />
        <div>
          <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.name}</div>
          <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 1 }}>{r.company}</div>
        </div>
      </div>
    )},
    { label: 'Tier', key: 'tier', render: (r) => <U.Badge tone={tierColor[r.tier]} size="sm">{r.tier}</U.Badge>, width: 100 },
    { label: 'Segmento', key: 'segment', render: (r) => <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{r.segment}</span>, width: 110 },
    { label: 'Ciudad', key: 'city', width: 110 },
    { label: 'Envíos', key: 'shipments', align: 'right', render: (r) => <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.shipments}</span>, width: 70 },
    { label: 'Facturado', key: 'billed', align: 'right', render: (r) => <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{hide ? '•••' : `$${(r.billed/1000).toFixed(1)}K`}</span>, width: 100 },
    { label: 'Estado', key: 'status', render: (r) => {
      const today = new Date('2026-05-23');
      const last = r.lastLogin ? new Date(r.lastLogin) : null;
      const daysAgo = last ? Math.round((today - last) / (1000 * 60 * 60 * 24)) : null;
      const tone = r.status === 'active' ? 'success' : r.status === 'pending' ? 'warning' : 'danger';
      const label = r.status === 'active' ? 'activo' : r.status === 'pending' ? 'pendiente' : 'inactivo';
      const daysLabel = daysAgo == null ? '—'
        : daysAgo === 0 ? 'hoy'
        : daysAgo === 1 ? 'ayer'
        : daysAgo < 30 ? `hace ${daysAgo}d`
        : daysAgo < 365 ? `hace ${Math.round(daysAgo/30)}m`
        : `hace ${Math.round(daysAgo/365)}a`;
      const isStale = r.status === 'inactive' || (r.status === 'active' && daysAgo > 30);
      return (
        <div>
          <U.Badge tone={tone} size="sm" dot>{label}</U.Badge>
          <div style={{
            marginTop: 4,
            font: '600 10px/1 var(--f-mono)',
            color: isStale ? 'var(--warning)' : 'var(--ink-mute)',
            letterSpacing: '0.04em',
          }}>{r.status === 'inactive' ? 'última conexión ' : ''}{daysLabel}</div>
        </div>
      );
    }, width: 130 },
    { label: '', key: '_action', align: 'right', render: () => <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.chevR(12)}</span>, width: 30 },
  ];
  const actionCol = columns.find(c => c.key === '_action');
  const visibleColumns = [...U.applyColumns(columns, colCfg), actionCol];

  return (
    <div>
      <U.PageHeader
        title="Clientes"
        subtitle={`${baseClients.length} cuentas con código MARKBOX activo. ${baseClients.filter(c=>c.status==='active').length} activas, ${baseClients.filter(c=>c.status==='pending').length} pendientes de verificación.`}
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Exportar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => { setView('create'); setDrawerKind('create'); }}>Nuevo cliente</U.Btn>
          </>
        }
      />

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre, empresa, MARKBOX, RIF…"
        filters={
          <>
            <U.Select value={tier} onChange={(e)=>setTier(e.target.value)} style={{ width: 140 }} options={[
              { value: 'all', label: 'Todos los tiers' },
              { value: 'Platinum', label: 'Platinum' },
              { value: 'Gold', label: 'Gold' },
              { value: 'Silver', label: 'Silver' },
              { value: 'Bronze', label: 'Bronze' },
            ]} />
            <U.Select value={status} onChange={(e)=>setStatus(e.target.value)} style={{ width: 140 }} options={[
              { value: 'all', label: 'Todos los estados' },
              { value: 'active', label: 'Activos' },
              { value: 'pending', label: 'Pendientes' },
              { value: 'inactive', label: 'Inactivos' },
            ]} />
            <U.ColumnManager cfg={colCfg} setCfg={setColCfg} columns={columns} defaultCfg={CLI_COLS_DEFAULT} />
          </>
        }
      />

      {loading ? (
        <U.LoadingRows rows={6} cols={6} />
      ) : filtered.length === 0 ? (
        <U.EmptyState
          icon={window.Icon.users(22)}
          title="No hay clientes que coincidan"
          body="Ajustá los filtros o registrá un cliente nuevo. El código MARKBOX se asigna automáticamente."
          action={<U.Btn variant="primary" icon={window.Icon.plus(13)} onClick={() => { setView('create'); setDrawerKind('create'); }}>Crear cliente</U.Btn>}
        />
      ) : (
        <U.Table columns={visibleColumns} rows={filtered} onRowClick={(r) => { setSelectedId(r.markbox); setView('detail'); setDrawerKind('detail'); }} />
      )}

      <U.Drawer
        open={drawerKind === 'detail' && detailRecord}
        onClose={() => { setDrawerKind(null); setView('list'); setSelectedId(null); }}
        title={detailRecord?.company}
        subtitle={detailRecord ? `${detailRecord.markbox} · ${detailRecord.name}` : ''}
        width={680}
        actions={
          <>
            <U.Btn variant="ghost" icon={window.Icon.invoice(13)} onClick={() => detailRecord && window.__erpOverlay && window.__erpOverlay('estadocuenta', { markbox: detailRecord.markbox })}>Estado de cuenta</U.Btn>
            <U.Btn variant="ghost" icon={window.Icon.tag(13)} onClick={() => detailRecord && goTo('labels', detailRecord.markbox)}>Etiquetas</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.mail(13)} onClick={() => window.openQuickEmail?.({
              to: detailRecord?.email,
              ctx: { client: detailRecord, label: detailRecord?.company }
            })}>Email</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.edit(13)}>Editar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.calc(13)} onClick={() => goTo('estimados', null, 'create')}>Nuevo estimado</U.Btn>
          </>
        }
      >
        {detailRecord && <ClientDetail c={detailRecord} goTo={goTo} />}
      </U.Drawer>

      <U.Drawer
        open={drawerKind === 'create'}
        onClose={() => { setDrawerKind(null); setView('list'); }}
        title="Nuevo cliente"
        subtitle="El código MARKBOX (DTD-XXXX) se asigna automáticamente al guardar"
        width={620}
        actions={
          <>
            <U.Btn variant="ghost" onClick={() => { setDrawerKind(null); setView('list'); }}>Cancelar</U.Btn>
            <U.Btn variant="primary">Crear + asignar MARKBOX</U.Btn>
          </>
        }
      >
        <ClientForm />
      </U.Drawer>
    </div>
  );
}

function ClientDetail({ c, goTo }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const hide = U.useHideValues();
  const myShipments = D.SHIPMENTS.filter(s => s.client === c.markbox);
  const myInvoices = D.INVOICES.filter(i => i.client === c.markbox);
  const totalOutstanding = myInvoices.reduce((sum, i) => sum + i.balance, 0);
  const tierColor = { Platinum: 'wine', Gold: 'warning', Silver: 'info', Bronze: 'neutral' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <U.Card style={{ padding: 14 }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Tier</div>
          <div style={{ marginTop: 8 }}><U.Badge tone={tierColor[c.tier]}>{c.tier}</U.Badge></div>
        </U.Card>
        <U.Card style={{ padding: 14 }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Envíos</div>
          <div style={{ font: '900 22px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>{c.shipments}</div>
        </U.Card>
        <U.Card style={{ padding: 14 }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Facturado</div>
          <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>{hide ? '•••' : `$${(c.billed/1000).toFixed(1)}K`}</div>
        </U.Card>
        <U.Card style={{ padding: 14 }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Adeudado</div>
          <div style={{ font: '900 18px/1 var(--f-display)', color: totalOutstanding > 0 ? 'var(--warning)' : 'var(--success)', marginTop: 6 }}>{hide ? '•••' : `$${(totalOutstanding/1000).toFixed(1)}K`}</div>
        </U.Card>
      </div>

      {/* Info */}
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>INFORMACIÓN</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 18 }}>
          <U.Field label="Empresa" value={c.company} />
          <U.Field label="RIF" value={c.rif} mono />
          <U.Field label="Contacto" value={c.name} />
          <U.Field label="Segmento" value={c.segment} />
          <U.Field label="Email" value={c.email} />
          <U.Field label="Teléfono" value={c.phone} mono />
          <U.Field label="Ciudad" value={c.city} />
          <U.Field label="Cliente desde" value={c.since} mono />
        </div>
      </div>

      {/* Shipments */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="eyebrow eyebrow-wine">EMBARQUES ({myShipments.length})</div>
          <button onClick={() => goTo('shipments')} style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)' }}>Ver todos →</button>
        </div>
        {myShipments.length === 0 ? (
          <U.EmptyState style={{ padding: 20 }} icon={window.Icon.box(18)} title="Sin embarques aún" body="Cuando creés su primer embarque aparecerá acá." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {myShipments.slice(0, 4).map(s => (
              <div key={s.id} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 100px 70px', gap: 10,
                padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
                alignItems: 'center', cursor: 'pointer',
              }}
              onClick={() => goTo('shipments', s.id, 'detail')}
              >
                <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.id}</code>
                <div style={{ font: '500 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{D.origin(s.origin).name} → {D.dest(s.destination).name}</div>
                <U.StatusBadge status={s.status} size="sm" />
                <span style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', textAlign: 'right' }}>${(s.value/1000).toFixed(0)}K</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>ACCESOS RÁPIDOS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['Estado de cuenta', 'Histórico de facturas', 'Reset contraseña portal'].map(a => (
            <button key={a} style={{
              padding: 12, textAlign: 'left', borderRadius: 'var(--r-md)',
              background: 'var(--bg-elevated)',
              font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink)',
            }}>{a} →</button>
          ))}
        </div>
      </div>

      {window.DocsForTransaction && (
        <window.DocsForTransaction kind="cliente" id={c.markbox} goTo={goTo} />
      )}

      {/* Comments thread */}
      {window.CommentsThread && <window.CommentsThread recordId={c.markbox} recordType="cliente" />}
    </div>
  );
}

function ClientForm() {
  const U = window.ERPUI;
  const I = window.Icon;
  const [tipo, setTipo] = React.useState('persona');
  const [whatsapp, setWhatsapp] = React.useState(true);
  const [docCedula, setDocCedula] = React.useState(null);
  const [docRif, setDocRif] = React.useState(null);

  const SectionLabel = ({ children }) => (
    <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: 4 }}>{children}</div>
  );

  // Tile de documento · refleja la cédula/RIF que el cliente cargó en el
  // portal/registro. En alta manual, el admin la adjunta acá.
  const DocTile = ({ value, onChange, title, hint, fileName }) => value ? (
    <div style={{ padding: 12, background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ color: 'var(--success)', display: 'inline-flex' }}>{I.check(16)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--success)' }}>{title}</div>
        <code style={{ font: '500 10.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>{fileName}</code>
      </div>
      <button onClick={() => onChange(null)} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', padding: '4px 8px', cursor: 'pointer' }}>Quitar</button>
    </div>
  ) : (
    <button onClick={() => onChange('mock-doc-' + Date.now())} style={{
      padding: '18px 14px', width: '100%',
      background: 'var(--bg-elevated)', border: '1px dashed var(--border)',
      borderRadius: 'var(--r-md)', color: 'var(--ink-soft)', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      font: '600 12px/1.4 var(--f-sans)', textAlign: 'center',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; e.currentTarget.style.color = 'var(--wine)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
    >
      {I.upload(20)}
      <span style={{ font: '700 12px/1.2 var(--f-sans)' }}>{title}</span>
      <span style={{ font: '500 10.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>{hint}</span>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Tipo de cliente · igual que el registro */}
      <SectionLabel>Tipo de cliente</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { id: 'persona', label: 'Persona natural', desc: 'Importa a título personal', icon: I.users(16) },
          { id: 'empresa', label: 'Empresa', desc: 'Razón social · RIF', icon: I.shield(16) },
        ].map(t => {
          const on = tipo === t.id;
          return (
            <button key={t.id} onClick={() => setTipo(t.id)} style={{
              padding: '12px 14px', textAlign: 'left', cursor: 'pointer',
              border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'),
              background: on ? 'var(--wine-tint)' : 'var(--bg-surface)',
              borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <span style={{ color: on ? 'var(--wine)' : 'var(--ink-soft)', display: 'inline-flex' }}>{t.icon}</span>
              <div>
                <div style={{ font: '800 13px/1.1 var(--f-display)', color: on ? 'var(--wine)' : 'var(--ink)' }}>{t.label}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{t.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Identificación */}
      <SectionLabel>Identificación</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: tipo === 'empresa' ? '1fr 1fr' : '1fr', gap: 14 }}>
        <U.Input label={tipo === 'empresa' ? 'Nombre de contacto' : 'Nombre completo'} placeholder="Carlos Pérez" />
        {tipo === 'empresa' && <U.Input label="Razón social" placeholder="Importadora Pérez CA" />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <U.Input label={tipo === 'empresa' ? 'RIF' : 'Cédula'} placeholder={tipo === 'empresa' ? 'J-00000000-0' : 'V-00000000'} mono />
        <U.Select label="Segmento" options={['Industrial', 'Retail', 'Mayorista', 'Tecnología', 'Textil', 'Belleza', 'Comercial', 'Servicios']} />
      </div>

      {/* Contacto */}
      <SectionLabel>Contacto</SectionLabel>
      <U.Input label="Email" type="email" placeholder="contacto@empresa.com" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <U.Input label="Teléfono" placeholder="+58 412 000 0000" mono />
        <U.Select label="Ciudad" options={['Caracas', 'Valencia', 'Maracaibo', 'Punto Fijo', 'Barquisimeto', 'Mérida', 'Maturín']} />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '2px 2px' }}>
        <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} style={{ accentColor: 'var(--wine)', width: 16, height: 16 }} />
        <span style={{ font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>El teléfono tiene WhatsApp</span>
      </label>

      {/* Documentos · cédula/RIF que el cliente cargó en el registro */}
      <SectionLabel>Documentos de identidad</SectionLabel>
      <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', marginTop: -4 }}>
        En altas desde el portal, el cliente carga {tipo === 'empresa' ? 'el RIF' : 'la cédula'} automáticamente en el registro. En altas manuales, adjuntala acá.
      </div>
      {tipo === 'empresa' ? (
        <DocTile value={docRif} onChange={setDocRif} title="Foto del RIF · ambos lados" hint="JPG o PDF · arrastrá o hacé clic" fileName="rif-empresa.jpg" />
      ) : (
        <DocTile value={docCedula} onChange={setDocCedula} title="Foto de la cédula · anverso y reverso" hint="JPG o PDF · arrastrá o hacé clic" fileName="cedula-cliente.jpg" />
      )}

      <div style={{ padding: '14px 16px', background: 'var(--wine-tint)', borderRadius: 'var(--r-md)', borderLeft: '3px solid var(--wine)' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wine)' }}>{window.Icon.info(14)}</span>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            Al crear el cliente se genera automáticamente un código <b>MARKBOX</b> (DTD-XXXX) único. Se envía por email con instrucciones de uso para envíos desde China.
          </div>
        </div>
      </div>
    </div>
  );
}

window.ModuleClients = ModuleClients;
