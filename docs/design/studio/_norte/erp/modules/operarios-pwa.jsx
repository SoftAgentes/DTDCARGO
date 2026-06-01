/* ── DTD ERP · Operarios PWA · centro de control de apps móviles ── */
(function () {
  const { useState } = React;

  // Mock de operarios de campo
  const OPERARIOS = [
    { id: 'op-001', name: 'Wei Chen',          role: 'almacenista',   roleLabel: 'Almacenista', site: 'Yiwu · A1', app: 'Operario CN', ver: '1.4.2', status: 'online',  battery: 82, lastSync: 'hace 2 min',  scans: 47, pending: 3, device: 'Redmi Note 12' },
    { id: 'op-002', name: 'Liang Wu',          role: 'almacenista',   roleLabel: 'Almacenista', site: 'Yiwu · A1', app: 'Operario CN', ver: '1.4.2', status: 'online',  battery: 64, lastSync: 'hace 5 min',  scans: 38, pending: 1, device: 'Redmi Note 12' },
    { id: 'op-003', name: 'José Materán',       role: 'transportista', roleLabel: 'Chofer',      site: 'Valencia',  app: 'Operario VE', ver: '1.4.0', status: 'ruta',    battery: 45, lastSync: 'hace 18 min', scans: 12, pending: 5, device: 'Galaxy A24' },
    { id: 'op-004', name: 'Luis Fernández',     role: 'transportista', roleLabel: 'Chofer',      site: 'Caracas',   app: 'Operario VE', ver: '1.4.0', status: 'ruta',    battery: 71, lastSync: 'hace 9 min',  scans: 9,  pending: 2, device: 'Moto G54' },
    { id: 'op-005', name: 'Yusneidy Rojas',     role: 'almacenista',   roleLabel: 'Bodeguera',   site: 'Valencia',  app: 'Almacenista',   ver: '1.4.1', status: 'online',  battery: 90, lastSync: 'hace 1 min',  scans: 54, pending: 0, device: 'iPad 9' },
    { id: 'op-006', name: 'Carlos Pérez',       role: 'transportista', roleLabel: 'Chofer',      site: 'Maracay',   app: 'Operario VE', ver: '1.3.8', status: 'offline', battery: 12, lastSync: 'hace 3 h',    scans: 0,  pending: 4, device: 'Galaxy A14' },
    { id: 'op-007', name: 'Sun Li',             role: 'almacenista',   roleLabel: 'Almacenista', site: 'Yiwu · B2', app: 'Operario CN', ver: '1.4.2', status: 'fuera',   battery: 0,  lastSync: 'hace 11 h',   scans: 0,  pending: 0, device: 'Redmi 10' },
  ];

  const APPS = [
    { id: 'cn', name: 'Operario CN', file: 'Operario CN.html', desc: 'Recepción e inspección en bodega Yiwu · escaneo de cajas, fotos QC.', users: 3, color: '#7F0F1A' },
    { id: 've', name: 'Operario VE', file: 'Operario VE.html', desc: 'Chofer / despacho Venezuela · ruta, POD, confirmación de entrega.', users: 3, color: '#0F1E3D' },
    { id: 'bod', name: 'Almacenista',  file: 'Almacenista VE.html', desc: 'Almacén Valencia · picking, packing, reexpedición a cliente final.', users: 1, color: '#1F8A5B' },
    { id: 'cam', name: 'Transportista',  file: 'Transportista.html', desc: 'Ruta activa con GPS · navegación, POD por parada, alerta de ubicación.', users: 2, color: '#B8893A' },
    { id: 'multi', name: 'Operario Multi', file: 'Operario Multi.html', desc: 'Launcher multi-rol · cambia entre recepción, bodega y ruta en un dispositivo.', users: 1, color: '#2A6FDB' },
  ];

  const STATUS = {
    online:  { label: 'En línea', tone: 'success', dot: true },
    ruta:    { label: 'En ruta',  tone: 'info',    dot: true },
    offline: { label: 'Sin sync', tone: 'warning', dot: false },
    fuera:   { label: 'Fuera de turno', tone: 'neutral', dot: false },
  };

  function batteryColor(b) {
    if (b <= 15) return 'var(--danger)';
    if (b <= 40) return 'var(--warning)';
    return 'var(--success)';
  }

  function ModuleOperariosPWA() {
    const U = window.ERPUI;
    const I = window.Icon;
    const [tab, setTab] = useState('directorio');
    const [siteFilter, setSiteFilter] = useState('all');

    const online = OPERARIOS.filter(o => o.status === 'online' || o.status === 'ruta').length;
    const alerts = OPERARIOS.filter(o => o.status === 'offline' || o.battery <= 15).length;
    const totalScans = OPERARIOS.reduce((s, o) => s + o.scans, 0);
    const totalPending = OPERARIOS.reduce((s, o) => s + o.pending, 0);

    return (
      <div style={{ padding: '24px 28px', maxWidth: 1160, margin: '0 auto' }}>
        <U.PageHeader
          title="Operarios PWA"
          subtitle="Centro de control de las apps móviles de campo · bodega, recepción y ruta"
          actions={<U.Btn variant="primary" icon={I.plus(14)}>Nuevo operario</U.Btn>}
        />

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, margin: '18px 0 24px' }}>
          <U.KPI label="En actividad" value={online + ' / ' + OPERARIOS.length} tone="success" sub="operarios conectados" />
          <U.KPI label="Escaneos hoy" value={totalScans} tone="wine" sub="cajas · fotos · POD" />
          <U.KPI label="Tareas pendientes" value={totalPending} tone="info" sub="asignadas sin cerrar" />
          <U.KPI label="Alertas" value={alerts} tone={alerts > 0 ? 'warning' : 'success'} sub="sin sync / batería baja" />
        </div>

        <U.Tabs value={tab} onChange={setTab} items={[
          { value: 'directorio', label: 'Directorio + estado' },
          { value: 'apps',       label: 'Apps PWA' },
          { value: 'actividad',  label: 'Actividad' },
          { value: 'acceso',     label: 'Gestión de acceso' },
        ]} style={{ marginBottom: 20 }} />

        {/* ── DIRECTORIO ── */}
        {tab === 'directorio' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
              {['all', 'Yiwu', 'Valencia', 'Caracas', 'Maracay'].map(s => (
                <button key={s} onClick={() => setSiteFilter(s)} style={{
                  font: '600 11.5px/1 var(--f-sans)', padding: '7px 12px', borderRadius: 'var(--r-pill)',
                  border: '1px solid ' + (siteFilter === s ? 'var(--wine)' : 'var(--border)'),
                  background: siteFilter === s ? 'var(--wine)' : 'var(--bg-surface)',
                  color: siteFilter === s ? '#fff' : 'var(--ink-soft)', cursor: 'pointer',
                }}>{s === 'all' ? 'Todos' : s}</button>
              ))}
            </div>
            {OPERARIOS.filter(o => siteFilter === 'all' || o.site.includes(siteFilter)).map(o => {
              const st = STATUS[o.status];
              return (
                <U.Card key={o.id} padded>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <U.Avatar initials={o.name.split(' ').map(w => w[0]).slice(0,2).join('')} color={o.role === 'transportista' ? 'info' : 'wine'} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{o.name}</span>
                        <U.Badge tone={st.tone} size="sm" dot={st.dot}>{st.label}</U.Badge>
                      </div>
                      <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                        {o.roleLabel} · {o.site} · <code style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }}>{o.app} v{o.ver}</code>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, auto)', gap: 22, alignItems: 'center' }}>
                      <Stat label="Batería" value={o.battery + '%'} color={batteryColor(o.battery)} mono />
                      <Stat label="Escaneos" value={o.scans} mono />
                      <Stat label="Pendientes" value={o.pending} color={o.pending > 0 ? 'var(--warning)' : 'var(--ink)'} mono />
                      <Stat label="Última sync" value={o.lastSync} small />
                    </div>
                  </div>
                </U.Card>
              );
            })}
          </div>
        )}

        {/* ── APPS ── */}
        {tab === 'apps' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {APPS.map(a => (
                <U.Card key={a.id} padded>
                  <div style={{ width: 44, height: 44, borderRadius: 'var(--r-md)', background: a.color, color: '#fff', display: 'grid', placeItems: 'center', marginBottom: 14 }}>{I.box(22)}</div>
                  <h3 style={{ font: '900 16px/1.2 var(--f-display)', margin: '0 0 6px', color: 'var(--ink)' }}>{a.name}</h3>
                  <p style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: '0 0 14px' }}>{a.desc}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                    <span style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{a.users} operario{a.users > 1 ? 's' : ''}</span>
                    <a href={a.file} style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>Abrir app ↗</a>
                  </div>
                </U.Card>
              ))}
            </div>
            <U.Card padded style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 88, height: 88, borderRadius: 'var(--r-md)', background: '#fff', border: '1px solid var(--border)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--f-mono)', color: 'var(--ink-mute)', textAlign: 'center', lineHeight: 1.3 }}>QR<br/>install</div>
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ font: '700 14px/1.2 var(--f-sans)', margin: '0 0 4px', color: 'var(--ink)' }}>Instalar PWA en un dispositivo nuevo</h4>
                  <p style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', margin: 0 }}>Escaneá el QR desde el teléfono del operario para instalar la app. Las credenciales temporales se generan en "Gestión de acceso".</p>
                </div>
                <U.Btn variant="secondary" icon={I.tag(14)}>Generar QR</U.Btn>
              </div>
            </U.Card>
          </div>
        )}

        {/* ── ACTIVIDAD ── */}
        {tab === 'actividad' && (
          <U.Card padded>
            <h4 style={{ font: '700 13px/1 var(--f-sans)', color: 'var(--ink)', margin: '0 0 16px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Actividad de hoy</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { who: 'Yusneidy Rojas', act: 'Confirmó despacho OD-2026-0151 · 11 paquetes', t: '14:32', tone: 'success' },
                { who: 'Wei Chen', act: 'Recibió 18 cajas · DTDU-472819 · 4 fotos QC', t: '13:58', tone: 'wine' },
                { who: 'José Materán', act: 'POD entregado · cliente Mendoza & Cía', t: '12:40', tone: 'info' },
                { who: 'Liang Wu', act: 'Escaneó lote A1-027 · 12 cajas', t: '11:15', tone: 'wine' },
                { who: 'Carlos Pérez', act: 'Sin sincronizar hace 3h · última ruta Maracay', t: '09:02', tone: 'warning' },
              ].map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--' + e.tone + ')', flexShrink: 0 }} />
                  <span style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', minWidth: 130 }}>{e.who}</span>
                  <span style={{ font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)', flex: 1 }}>{e.act}</span>
                  <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{e.t}</code>
                </div>
              ))}
            </div>
          </U.Card>
        )}

        {/* ── ACCESO ── */}
        {tab === 'acceso' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {OPERARIOS.map(o => (
              <U.Card key={o.id} padded>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <U.Avatar initials={o.name.split(' ').map(w => w[0]).slice(0,2).join('')} color={o.role === 'transportista' ? 'info' : 'wine'} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ font: '700 13.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{o.name}</div>
                    <div style={{ font: '500 11.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{o.device} · {o.app}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <U.Btn variant="ghost" size="sm">Resetear PIN</U.Btn>
                    <U.Btn variant="ghost" size="sm">Forzar re-login</U.Btn>
                    <U.Btn variant={o.status === 'fuera' ? 'secondary' : 'danger'} size="sm">{o.status === 'fuera' ? 'Reactivar' : 'Revocar acceso'}</U.Btn>
                  </div>
                </div>
              </U.Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  function Stat({ label, value, color, mono, small }) {
    return (
      <div style={{ textAlign: 'right' }}>
        <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ font: (small ? '500 11px' : '700 14px') + '/1 ' + (mono ? 'var(--f-mono)' : 'var(--f-sans)'), color: color || 'var(--ink)' }}>{value}</div>
      </div>
    );
  }

  window.ModuleOperariosPWA = ModuleOperariosPWA;
})();
