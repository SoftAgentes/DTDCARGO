/* global React */
/* ── DTD ERP · Clientes & MARKBOX ───────────────────────────── */

const { useState: _useStateCli, useMemo: _useMemoCli } = React;

function ModuleClients({ goTo, view, setView, selectedId, setSelectedId }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [search, setSearch] = _useStateCli('');
  const [tier, setTier] = _useStateCli('all');
  const [status, setStatus] = _useStateCli('all');
  const [drawerKind, setDrawerKind] = _useStateCli(null);

  React.useEffect(() => {
    if (selectedId && view === 'detail') setDrawerKind('detail');
    if (view === 'create') setDrawerKind('create');
  }, [selectedId, view]);

  const filtered = _useMemoCli(() => {
    let rows = D.CLIENTS;
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
    { label: 'Facturado', key: 'billed', align: 'right', render: (r) => <span className="mono" style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>${(r.billed/1000).toFixed(1)}K</span>, width: 100 },
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

  return (
    <div>
      <U.PageHeader
        title="Clientes"
        subtitle={`${D.CLIENTS.length} cuentas con código MARKBOX activo. ${D.CLIENTS.filter(c=>c.status==='active').length} activas, ${D.CLIENTS.filter(c=>c.status==='pending').length} pendientes de verificación.`}
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
          </>
        }
      />

      {filtered.length === 0 ? (
        <U.EmptyState
          icon={window.Icon.users(22)}
          title="No hay clientes que coincidan"
          body="Ajustá los filtros o registrá un cliente nuevo. El código MARKBOX se asigna automáticamente."
          action={<U.Btn variant="primary" icon={window.Icon.plus(13)} onClick={() => { setView('create'); setDrawerKind('create'); }}>Crear cliente</U.Btn>}
        />
      ) : (
        <U.Table columns={columns} rows={filtered} onRowClick={(r) => { setSelectedId(r.markbox); setView('detail'); setDrawerKind('detail'); }} />
      )}

      <U.Drawer
        open={drawerKind === 'detail' && detailRecord}
        onClose={() => { setDrawerKind(null); setView('list'); setSelectedId(null); }}
        title={detailRecord?.company}
        subtitle={detailRecord ? `${detailRecord.markbox} · ${detailRecord.name}` : ''}
        width={680}
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.mail(13)} onClick={() => window.openQuickEmail?.({
              to: detailRecord?.email,
              ctx: { client: detailRecord, label: detailRecord?.company }
            })}>Email</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.edit(13)}>Editar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.calc(13)} onClick={() => goTo('quotes', null, 'create')}>Nueva cotización</U.Btn>
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
          <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>${(c.billed/1000).toFixed(1)}K</div>
        </U.Card>
        <U.Card style={{ padding: 14 }}>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Adeudado</div>
          <div style={{ font: '900 18px/1 var(--f-display)', color: totalOutstanding > 0 ? 'var(--warning)' : 'var(--success)', marginTop: 6 }}>${(totalOutstanding/1000).toFixed(1)}K</div>
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

      {/* Comments thread */}
      {window.CommentsThread && <window.CommentsThread recordId={c.markbox} recordType="cliente" />}
    </div>
  );
}

function ClientForm() {
  const U = window.ERPUI;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <U.Input label="Nombre" placeholder="Nombre del contacto" />
        <U.Input label="Apellido" placeholder="Apellido" />
      </div>
      <U.Input label="Empresa" placeholder="Razón social" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <U.Input label="RIF" placeholder="J-00000000-0" mono />
        <U.Select label="Segmento" options={['Industrial', 'Retail', 'Mayorista', 'Tecnología', 'Textil', 'Belleza', 'Comercial', 'Servicios']} />
      </div>
      <U.Input label="Email" type="email" placeholder="contacto@empresa.com" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <U.Input label="Teléfono" placeholder="+58 412 000 0000" mono />
        <U.Select label="Ciudad" options={['Caracas', 'Valencia', 'Maracaibo', 'Punto Fijo', 'Barquisimeto', 'Mérida', 'Maturín']} />
      </div>
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
