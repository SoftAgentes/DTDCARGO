/* global React */
/* ── DTD ERP · Mailing · Logs ───────────────────────────────── */

function MailingLogs({ goTo }) {
  const U = window.ERPUI;
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');

  const allLogs = [
    { time: 'hace 4 min',  template: 'POD firmado',              to: 'rcastro@castrohnos.com',     client: 'Castro Hermanos', status: 'entregado', channel: 'email', opens: 0 },
    { time: 'hace 18 min', template: 'Embarque confirmado',      to: 'apereira@imp-pereira.com',   client: 'Imp. Pereira',    status: 'abierto',   channel: 'email', opens: 2 },
    { time: 'hace 32 min', template: 'Aviso ETA WhatsApp',       to: '+58 412 220 5611',            client: 'Imp. Pereira',    status: 'leído',     channel: 'wa',    opens: 1 },
    { time: 'hace 1 h',    template: 'ETA en riesgo',            to: 'lfernandez@polar.com.ve',    client: 'Polar',           status: 'entregado', channel: 'email', opens: 0 },
    { time: 'hace 2 h',    template: 'Recordatorio de pago',     to: 'cmendez@acindar.ve',         client: 'Acindar',         status: 'rebotado',  channel: 'email', opens: 0 },
    { time: 'hace 3 h',    template: 'Cotización enviada',       to: 'vortiz@ortizcosm.com',       client: 'Ortiz Cosmetics', status: 'clic',      channel: 'email', opens: 4 },
    { time: 'hace 4 h',    template: 'Bienvenida MARKBOX',       to: 'esalazar@salazartrading.com', client: 'Salazar Trading', status: 'abierto',   channel: 'email', opens: 3 },
    { time: 'hace 6 h',    template: '— (manual)',                to: 'martina@dtdcargo.com',       client: 'interno',         status: 'entregado', channel: 'email', opens: 0 },
    { time: 'ayer 17:42',  template: 'POD firmado',              to: 'projas@distandina.ve',       client: 'Dist. Andina',    status: 'clic',      channel: 'email', opens: 6 },
  ];

  const filtered = allLogs.filter(l => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search && !(l.to.toLowerCase().includes(search.toLowerCase()) || l.template.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const statusTone = { entregado: 'info', abierto: 'success', clic: 'success', leído: 'success', rebotado: 'danger', spam: 'danger' };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Enviados 24h" value="142" delta="+8 vs ayer" tone="wine" icon={window.Icon.mail(18)} />
        <U.KPI label="Tasa apertura" value="78%" delta="↑ 4 pts" tone="success" icon={window.Icon.eye(18)} />
        <U.KPI label="Tasa clic" value="34%" delta="estable" tone="info" icon={window.Icon.link(18)} />
        <U.KPI label="Rebotes" value="2" sub="0.6% del total" tone="warning" icon={window.Icon.warn(18)} />
      </div>

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por destinatario o template…"
        filters={
          <U.Select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)} style={{ width: 160 }} options={[
            { value: 'all', label: 'Todos los estados' },
            'entregado', 'abierto', 'clic', 'leído', 'rebotado',
          ]} />
        }
      />

      <U.Card padded={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 1.4fr 1fr 70px 110px', padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          {['Cuando', 'Template', 'Destinatario', 'Cliente', 'Opens', 'Estado'].map(h => (
            <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>
        {filtered.map((l, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '110px 1fr 1.4fr 1fr 70px 110px',
            padding: '12px 18px', gap: 14,
            borderTop: i > 0 ? '1px solid var(--border)' : 0, alignItems: 'center',
          }}>
            <span style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-mute)' }}>{l.time}</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 'var(--r-sm)', flexShrink: 0,
                background: l.channel === 'wa' ? '#25D366' : 'var(--wine-tint)',
                color: l.channel === 'wa' ? '#fff' : 'var(--wine)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{l.channel === 'wa' ? window.Icon.globe(11) : window.Icon.mail(11)}</span>
              <span style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{l.template}</span>
            </div>
            <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{l.to}</code>
            <button onClick={() => {
              const c = window.ERPData.CLIENTS.find(c => c.company.toLowerCase().includes(l.client.toLowerCase()));
              if (c && goTo) goTo('clients', c.markbox, 'detail');
            }} style={{ font: '500 12px/1 var(--f-sans)', color: goTo ? 'var(--wine)' : 'var(--ink-soft)', textAlign: 'left', padding: 0, cursor: goTo ? 'pointer' : 'default' }}>{l.client}</button>
            <span style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{l.opens > 0 ? l.opens + 'x' : '—'}</span>
            <U.Badge tone={statusTone[l.status] || 'neutral'} size="sm" dot>{l.status}</U.Badge>
          </div>
        ))}
        {filtered.length === 0 && <U.EmptyState style={{ margin: 18 }} icon={window.Icon.mail(20)} title="Sin envíos" body="No hay registros con estos filtros." />}
      </U.Card>
    </div>
  );
}

window.MailingLogs = MailingLogs;
