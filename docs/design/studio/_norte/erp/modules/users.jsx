/* global React */
/* ── DTD ERP · Usuarios & Roles ─────────────────────────────── */

function ModuleUsers({ view, setView }) {
  const U = window.ERPUI;
  const [layer, setLayer] = React.useState('tenant'); // 'platform' | 'tenant'

  return (
    <div>
      {/* Selector de capa · Plataforma vs Tenant */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)', padding: 4, border: '1px solid var(--border)' }}>
          {[
            { v: 'platform', l: 'Plataforma', sub: 'Super Admin · cross-tenant' },
            { v: 'tenant',   l: 'Tenant',     sub: 'Usuarios internos DTD-Cargo' },
          ].map(o => {
            const sel = layer === o.v;
            return (
              <button key={o.v} onClick={() => setLayer(o.v)} title={o.sub} style={{
                font: '700 12.5px/1 var(--f-sans)', padding: '9px 18px', borderRadius: 'var(--r-pill)',
                border: 'none', cursor: 'pointer',
                background: sel ? 'var(--wine)' : 'transparent',
                color: sel ? '#fff' : 'var(--ink-soft)',
              }}>{o.l}</button>
            );
          })}
        </div>
        <span style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
          {layer === 'platform'
            ? 'Operan toda la plataforma — están por encima del tenant.'
            : 'Usuarios internos del tenant. El admin es el Administrador de Tenant.'}
        </span>
      </div>

      {layer === 'platform'
        ? (window.PlatformUsers ? <window.PlatformUsers /> : null)
        : <TenantUsers view={view} setView={setView} />}
    </div>
  );
}

// ── Usuarios del Tenant (internos DTD-Cargo) ────────────────
function TenantUsers({ view, setView }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [search, setSearch] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState('all');
  const [drawerKind, setDrawerKind] = React.useState(null);

  React.useEffect(() => { if (view === 'create') setDrawerKind('create'); }, [view]);

  const filtered = React.useMemo(() => {
    let rows = D.USERS;
    if (roleFilter !== 'all') rows = rows.filter(u => u.role === roleFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }
    return rows;
  }, [search, roleFilter]);

  const roleColors = { 'Administrador de Tenant': 'wine', Admin: 'wine', Comercial: 'info', Operaciones: 'warning', Contabilidad: 'success', 'Almacén CN': 'neutral', Soporte: 'neutral' };
  const roleLabel = (r) => r === 'Admin' ? 'Administrador de Tenant' : r;

  const columns = [
    { label: 'Nombre', key: 'name', render: (r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <U.Avatar initials={r.avatar} color={roleColors[r.role]} size={32} />
        <div>
          <div style={{ font: '600 13px/1.2 var(--f-sans)' }}>{r.name}</div>
          <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 1 }}>{r.email}</div>
        </div>
      </div>
    )},
    { label: 'Rol', key: 'role', render: (r) => <U.Badge tone={roleColors[r.role]} size="sm">{roleLabel(r.role)}</U.Badge>, width: 180 },
    { label: 'Equipo', key: 'team', render: (r) => <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{r.team}</span>, width: 110 },
    { label: '2FA', key: 'twoFa', align: 'center', render: (r) => r.twoFa
      ? <U.Badge tone="success" size="sm">ON</U.Badge>
      : <U.Badge tone="neutral" size="sm">OFF</U.Badge>
    , width: 60 },
    { label: 'Último acceso', key: 'lastLogin', render: (r) => <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{r.lastLogin}</span>, width: 130 },
    { label: 'Estado', key: 'status', render: (r) => (
      <U.Badge tone={r.status === 'active' ? 'success' : 'warning'} size="sm" dot>{r.status === 'active' ? 'activo' : 'invitación pendiente'}</U.Badge>
    ), width: 180 },
    { label: '', key: '_a', render: () => <span style={{ color: 'var(--ink-soft)' }}>{window.Icon.more(14)}</span>, width: 40 },
  ];

  return (
    <div>
      <U.PageHeader
        title="Usuarios del Tenant"
        subtitle={`${D.USERS.length} usuarios internos · El admin es el Administrador de Tenant · acceso por módulo configurable.`}
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.shield(14)}>Permisos por rol</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => { setView('create'); setDrawerKind('create'); }}>Invitar usuario</U.Btn>
          </>
        }
      />

      {/* Roles overview */}
      <U.Card padded style={{ marginBottom: 'var(--s-5)' }}>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>ROLES Y PERMISOS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { name: 'Administrador de Tenant', count: 1, perms: 'Todos los módulos del tenant · gestión usuarios internos · facturación · config' },
            { name: 'Comercial', count: 2, perms: 'Cotizador · Clientes · CRM · ver embarques · ver tarifas' },
            { name: 'Operaciones', count: 2, perms: 'Embarques · Tracking · Almacén CN/VE · Documentos' },
            { name: 'Contabilidad', count: 1, perms: 'Facturación · Pagos · Reportes · ver embarques (lectura)' },
            { name: 'Almacén CN', count: 1, perms: 'Solo Almacén CN · recepciones · consolidación' },
            { name: 'Soporte', count: 1, perms: 'Solo lectura · clientes · tracking · documentos' },
          ].map(r => (
            <div key={r.name} style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <U.Badge tone={roleColors[r.name]} size="sm">{r.name}</U.Badge>
                <span style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.count}</span>
              </div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>{r.perms}</div>
            </div>
          ))}
        </div>
      </U.Card>

      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre o email…"
        filters={
          <U.Select value={roleFilter} onChange={(e)=>setRoleFilter(e.target.value)} style={{ width: 160 }} options={[
            { value: 'all', label: 'Todos los roles' },
            'Admin', 'Comercial', 'Operaciones', 'Contabilidad', 'Almacén CN', 'Soporte',
          ]} />
        }
      />

      <U.Table columns={columns} rows={filtered} onRowClick={(r) => window.__erpOverlay && window.__erpOverlay('perfil', { userId: r.id })} />

      <U.Drawer
        open={drawerKind === 'create'}
        onClose={() => { setDrawerKind(null); setView('list'); }}
        title="Invitar usuario"
        subtitle="Se envía email con link de activación. Vence en 72 horas."
        width={620}
        actions={
          <>
            <U.Btn variant="ghost" onClick={() => { setDrawerKind(null); setView('list'); }}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.mail(13)}>Enviar invitación</U.Btn>
          </>
        }
      >
        <InviteForm />
      </U.Drawer>
    </div>
  );
}

// ── Invite form with scoped warehouse access ────────────────
function InviteForm() {
  const U = window.ERPUI;
  const [role, setRole] = React.useState('Operaciones');
  const [scope, setScope] = React.useState([]); // warehouse codes
  const [permission, setPermission] = React.useState('write');
  const [twoFa, setTwoFa] = React.useState(true);

  // Which roles need scope assignment
  const needsScope = ['Operaciones', 'Almacén CN', 'Almacén VE', 'Soporte'].includes(role);
  const isCN = ['Operaciones', 'Almacén CN'].includes(role);
  const isVE = ['Operaciones', 'Almacén VE'].includes(role);

  const cnWarehouses = [
    { code: 'YIW-A1', flag: '🇨🇳', name: 'Yiwu · A1',    sub: '义乌港二期 · directo' },
    { code: 'YIW-A2', flag: '🇨🇳', name: 'Yiwu · A2',    sub: '义乌港二期 · transferencia' },
    { code: 'CAN-C1', flag: '🇨🇳', name: 'Guangzhou · C1', sub: '南沙 · puerto' },
    { code: 'SZX-A2', flag: '🇨🇳', name: 'Shenzhen · A2', sub: '盐田 · puerto' },
    { code: 'SHA-A1', flag: '🇨🇳', name: 'Shanghai · A1', sub: '浦东 · directo' },
  ];
  const veWarehouses = [
    { code: 'PBL', flag: '🇻🇪', name: 'Puerto Cabello', sub: 'Carabobo · principal' },
    { code: 'LGU', flag: '🇻🇪', name: 'La Guaira',       sub: 'La Guaira · capital' },
    { code: 'MAR', flag: '🇻🇪', name: 'Maracaibo',       sub: 'Zulia · occidente' },
    { code: 'PFI', flag: '🇻🇪', name: 'Punto Fijo',      sub: 'Falcón · oriente' },
  ];

  const toggleScope = (code) => {
    setScope(s => s.includes(code) ? s.filter(x => x !== code) : [...s, code]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <U.Input label="Nombre" />
        <U.Input label="Apellido" />
      </div>
      <U.Input label="Email" type="email" placeholder="usuario@dtdcargo.com" />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <U.Select label="Rol" value={role} onChange={(e) => { setRole(e.target.value); setScope([]); }}
          options={['Admin', 'Comercial', 'Operaciones', 'Contabilidad', 'Almacén CN', 'Almacén VE', 'Soporte']} />
        <U.Select label="Equipo" options={['Dirección', 'Ventas', 'Op. CN', 'Op. VE', 'Finanzas', 'CX']} />
      </div>

      {/* Scope · only for warehouse-bound roles */}
      {needsScope && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Almacén/es asignado/s</span>
            <U.Badge tone="wine" size="sm">{scope.length === 0 ? 'sin definir' : `${scope.length} hub${scope.length > 1 ? 's' : ''}`}</U.Badge>
          </div>
          <div style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 10 }}>
            Este usuario solo verá recepciones y embarques del/los hub/s seleccionados. <b style={{ color: 'var(--ink)' }}>No podrá cambiar de almacén ni ver otros hubs.</b>
          </div>

          {isCN && (
            <>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8, fontSize: '10px' }}>🇨🇳 ALMACENES CHINA</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {cnWarehouses.map(w => {
                  const sel = scope.includes(w.code);
                  return (
                    <label key={w.code} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', cursor: 'pointer',
                      background: sel ? 'var(--wine-tint)' : 'var(--bg-surface)',
                      border: `1px solid ${sel ? 'var(--wine)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-md)',
                    }}>
                      <input type="checkbox" checked={sel} onChange={() => toggleScope(w.code)} style={{ accentColor: 'var(--wine)' }} />
                      <span style={{ fontSize: 16 }}>{w.flag}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{w.name}</div>
                        <div style={{ font: '500 10.5px/1.2 "Noto Sans SC", var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{w.sub}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {isVE && (
            <>
              <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8, fontSize: '10px' }}>🇻🇪 ALMACENES VENEZUELA</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {veWarehouses.map(w => {
                  const sel = scope.includes(w.code);
                  return (
                    <label key={w.code} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', cursor: 'pointer',
                      background: sel ? 'var(--wine-tint)' : 'var(--bg-surface)',
                      border: `1px solid ${sel ? 'var(--wine)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-md)',
                    }}>
                      <input type="checkbox" checked={sel} onChange={() => toggleScope(w.code)} style={{ accentColor: 'var(--wine)' }} />
                      <span style={{ fontSize: 16 }}>{w.flag}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{w.name}</div>
                        <div style={{ font: '500 10.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{w.sub}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          {/* Permission level inside scope */}
          <div style={{ marginTop: 14 }}>
            <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Permiso dentro del almacén</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { v: 'read',  l: 'Solo lectura', d: 'Ver recepciones · no editar' },
                { v: 'write', l: 'Lectura + escritura', d: 'Crear y editar recepciones del hub' },
              ].map(o => {
                const sel = permission === o.v;
                return (
                  <button key={o.v} onClick={() => setPermission(o.v)} style={{
                    padding: 12, textAlign: 'left',
                    background: sel ? 'var(--wine-tint)' : 'var(--bg-surface)',
                    border: `1.5px solid ${sel ? 'var(--wine)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)',
                  }}>
                    <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: sel ? 'var(--wine)' : 'var(--ink)' }}>{o.l}</div>
                    <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{o.d}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
        <input type="checkbox" checked={twoFa} onChange={(e) => setTwoFa(e.target.checked)} style={{ accentColor: 'var(--wine)', width: 16, height: 16 }} />
        <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Requerir 2FA al primer login</span>
      </label>

      {/* Summary */}
      <div style={{
        padding: '14px 16px',
        background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)',
        color: '#fff', borderRadius: 'var(--r-md)',
      }}>
        <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>ESTE USUARIO PODRÁ:</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, font: '500 12.5px/1.6 var(--f-sans)', color: 'rgba(255,255,255,0.85)' }}>
          <div>✓ Rol: <b style={{ color: '#fff' }}>{role}</b></div>
          {needsScope ? (
            scope.length > 0 ? (
              <div>✓ Ver solo: <b style={{ color: '#fff' }}>{scope.join(' · ')}</b> ({permission === 'write' ? 'lectura + escritura' : 'solo lectura'})</div>
            ) : (
              <div style={{ color: 'var(--wine-soft)' }}>⚠ Falta asignar al menos un almacén</div>
            )
          ) : (
            <div>✓ Acceso global · sin restricción por almacén</div>
          )}
          {twoFa && <div>✓ 2FA requerido al primer login</div>}
        </div>
      </div>
    </div>
  );
}

window.ModuleUsers = ModuleUsers;
