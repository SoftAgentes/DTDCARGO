/* global React */
/* ── DTD Plataforma · Usuarios de Plataforma (sobre el tenant) ── */
/* Capa superior al tenant. Estos usuarios NO son del tenant —    */
/* operan la plataforma completa (todos los tenants).             */

(function () {
  const { useState } = React;

  // 3 tipos de usuario de plataforma
  const PLATFORM_ROLES = {
    superadmin: {
      label: 'Super Admin',
      tone: 'wine',
      icon: 'shield',
      scope: 'Toda la plataforma · todos los tenants',
      perms: ['Crear / suspender tenants', 'Gestionar Administradores de Tenant', 'Acceso a billing global', 'Config de plataforma', 'Feature flags globales', 'Logs de auditoría cross-tenant'],
    },
    bugmanager: {
      label: 'Gestor de Bugs',
      tone: 'warning',
      icon: 'eye',
      scope: 'Bug Tracker · soporte técnico cross-tenant',
      perms: ['Ver / triagear bugs de todos los tenants', 'Reproducir incidencias (impersonate read-only)', 'Asignar prioridad y dev', 'Cerrar tickets', 'NO modifica datos del tenant'],
    },
    editor: {
      label: 'Editor de Configuración',
      tone: 'info',
      icon: 'cog',
      scope: 'Cambios específicos · alcance acotado por permiso',
      perms: ['Editar SOLO lo asignado (tarifas, rutas, plantillas…)', 'Cambios auditados', 'Sin acceso a usuarios ni billing', 'Scope definido por el Super Admin'],
    },
  };

  const PLATFORM_USERS = [
    { id: 'pu-001', name: 'Andrés Bermúdez', email: 'andres@dtdcargo.io',  role: 'superadmin', twoFa: true,  status: 'active',  last: 'hace 4 min', tenants: 'Todos (3)' },
    { id: 'pu-002', name: 'María Quintero',  email: 'maria@dtdcargo.io',   role: 'superadmin', twoFa: true,  status: 'active',  last: 'hace 2 h',   tenants: 'Todos (3)' },
    { id: 'pu-003', name: 'Dev · Soporte L2', email: 'soporte@dtdcargo.io', role: 'bugmanager', twoFa: true,  status: 'active',  last: 'hace 12 min', tenants: 'Cross-tenant' },
    { id: 'pu-004', name: 'Wenjie Lab',      email: 'wenjie@dtdcargo.io',  role: 'bugmanager', twoFa: false, status: 'active',  last: 'ayer',        tenants: 'Cross-tenant' },
    { id: 'pu-005', name: 'Tarifas · Bot',   email: 'rates-bot@dtdcargo.io', role: 'editor',  twoFa: true,  status: 'active',  last: 'hace 1 h',   tenants: 'DTD-Cargo CA · tarifas' },
    { id: 'pu-006', name: 'Karina Ops',      email: 'karina@dtdcargo.io',  role: 'editor',    twoFa: true,  status: 'pending', last: '—',          tenants: 'DTD-Cargo Zulia · rutas' },
  ];

  // Tenants gestionados por la plataforma
  // Set de módulos activos por tenant (mock · gestionable)
  const TENANTS = [
    { id: 'dtd-ca',    name: 'DTD-Cargo CA',       region: 'Caracas · Valencia', admin: 'Yusneidy Rojas',  users: 9,  status: 'active',    plan: 'Enterprise', active: ['dashboard','shipments','tracking','clients','users','admin','cn','ve','despacho','labels','qrqueue','calendar','estimados','leads','suppliers','rates','invoices','contab','reconcile','seniat','tms','costing','operarios','vault','reports'] },
    { id: 'dtd-zulia', name: 'DTD-Cargo Zulia',    region: 'Maracaibo',          admin: 'Pedro Finol',     users: 4,  status: 'active',    plan: 'Pro',        active: ['dashboard','shipments','tracking','clients','users','admin','cn','ve','despacho','calendar','estimados','leads','suppliers','rates','invoices','contab'] },
    { id: 'dtd-occ',   name: 'DTD-Cargo Occidente',region: 'Barquisimeto',       admin: '— sin asignar',   users: 0,  status: 'onboarding', plan: 'Pro',        active: ['dashboard','shipments','tracking','clients','users','admin'] },
  ];

  // Catálogo de módulos por grupo (compartido wizard + gestión)
  const MODULE_CATALOG = [
    { group: 'Core · siempre activos', locked: true, items: [
      { id: 'dashboard', label: 'Dashboard' }, { id: 'shipments', label: 'Embarques' },
      { id: 'tracking', label: 'Tracking' }, { id: 'clients', label: 'Clientes' },
      { id: 'users', label: 'Usuarios' }, { id: 'admin', label: 'Administración' },
    ]},
    { group: 'Operación · opcionales', minPlan: 'Starter', items: [
      { id: 'cn', label: 'Almacén CN' }, { id: 've', label: 'Almacén VE' },
      { id: 'despacho', label: 'Despacho' }, { id: 'labels', label: 'Etiquetas CN' },
      { id: 'qrqueue', label: 'Cola de QR' }, { id: 'calendar', label: 'Calendario' },
    ]},
    { group: 'Comercial & Finanzas', minPlan: 'Pro', items: [
      { id: 'estimados', label: 'Estimador' }, { id: 'leads', label: 'CRM · Leads' },
      { id: 'suppliers', label: 'Proveedores CN' }, { id: 'rates', label: 'Tarifas' },
      { id: 'invoices', label: 'Facturación' }, { id: 'contab', label: 'Contabilidad' },
      { id: 'reconcile', label: 'Conciliación bancaria' },
    ]},
    { group: 'Premium · Enterprise', minPlan: 'Enterprise', items: [
      { id: 'seniat', label: 'Aduana SENIAT' }, { id: 'tms', label: 'TMS · Transporte' },
      { id: 'costing', label: 'Costing & Margen' }, { id: 'operarios', label: 'Operarios PWA' },
      { id: 'vault', label: 'Vault' }, { id: 'reports', label: 'Reportes avanzados' },
    ]},
  ];
  const PLAN_RANK = { Starter: 1, Pro: 2, Enterprise: 3 };

  function PlatformUsers() {
    const U = window.ERPUI;
    const I = window.Icon;
    const [tab, setTab] = useState('users');
    const [wizard, setWizard] = useState(false);
    const [manageTenant, setManageTenant] = useState(null);

    return (
      <div>
        {/* Banner de capa plataforma */}
        <div style={{
          padding: '14px 18px', borderRadius: 'var(--r-md)', marginBottom: 18,
          background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', color: '#fff',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ width: 38, height: 38, borderRadius: 'var(--r-sm)', background: 'rgba(194,116,127,0.25)', display: 'grid', placeItems: 'center', color: '#C2747F' }}>{I.shield(20)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ font: '800 14px/1.2 var(--f-display)', letterSpacing: '-0.01em' }}>Capa de Plataforma</div>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              Usuarios que operan <b style={{ color: '#fff' }}>por encima</b> de los tenants. Distintos de los usuarios internos de cada tenant.
            </div>
          </div>
          <U.Badge tone="wine" size="sm" dot>{PLATFORM_USERS.length} usuarios</U.Badge>
        </div>

        <U.Tabs value={tab} onChange={setTab} items={[
          { value: 'users',   label: 'Usuarios de plataforma' },
          { value: 'roles',   label: 'Tipos / roles' },
          { value: 'tenants', label: 'Tenants gestionados' },
        ]} style={{ marginBottom: 18 }} />

        {/* ── USERS ── */}
        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PLATFORM_USERS.map(u => {
              const r = PLATFORM_ROLES[u.role];
              return (
                <U.Card key={u.id} padded>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <U.Avatar initials={u.name.split(' ').map(w => w[0]).slice(0,2).join('')} color={r.tone} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{u.name}</span>
                        <U.Badge tone={r.tone} size="sm">{r.label}</U.Badge>
                        {u.status === 'pending' && <U.Badge tone="warning" size="sm" dot>invitación pendiente</U.Badge>}
                      </div>
                      <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                        {u.email} · <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11 }}>{u.tenants}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>2FA</div>
                        <U.Badge tone={u.twoFa ? 'success' : 'neutral'} size="sm">{u.twoFa ? 'ON' : 'OFF'}</U.Badge>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Último acceso</div>
                        <div style={{ font: '500 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{u.last}</div>
                      </div>
                    </div>
                  </div>
                </U.Card>
              );
            })}
          </div>
        )}

        {/* ── ROLES ── */}
        {tab === 'roles' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {Object.entries(PLATFORM_ROLES).map(([key, r]) => (
              <U.Card key={key} padded>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 'var(--r-sm)', background: `var(--${r.tone === 'wine' ? 'wine' : r.tone}-bg, var(--bg-elevated))`, color: `var(--${r.tone === 'wine' ? 'wine' : r.tone})`, display: 'grid', placeItems: 'center' }}>{I[r.icon](18)}</div>
                  <U.Badge tone={r.tone} size="sm">{r.label}</U.Badge>
                </div>
                <div style={{ font: '600 11px/1.4 var(--f-sans)', color: 'var(--ink)', marginBottom: 4 }}>{r.scope}</div>
                <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.perms.map((p, i) => (
                    <li key={i} style={{ display: 'flex', gap: 8, font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
                      <span style={{ color: p.startsWith('NO') || p.startsWith('Sin') ? 'var(--danger)' : 'var(--success)', flexShrink: 0 }}>{p.startsWith('NO') || p.startsWith('Sin') ? '✕' : '✓'}</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </U.Card>
            ))}
          </div>
        )}

        {/* ── TENANTS ── */}
        {tab === 'tenants' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TENANTS.map(t => (
              <U.Card key={t.id} padded>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--bg-sidebar)', display: 'grid', placeItems: 'center' }}>
                    <img src="assets/dtdcargo-isologo-reverse.png" alt="" style={{ width: 24, height: 24, objectFit: 'contain' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ font: '700 14px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{t.name}</span>
                      <U.Badge tone={t.status === 'active' ? 'success' : 'warning'} size="sm" dot>{t.status === 'active' ? 'activo' : 'onboarding'}</U.Badge>
                      <U.Badge tone="neutral" size="sm">{t.plan}</U.Badge>
                    </div>
                    <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                      {t.region} · Admin de Tenant: <b style={{ color: 'var(--ink)' }}>{t.admin}</b>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 8 }}>
                    <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Módulos</div>
                    <div style={{ font: '700 16px/1 var(--f-mono)', color: 'var(--ink)' }}>{t.active.length}</div>
                  </div>
                  <div style={{ textAlign: 'right', marginRight: 12 }}>
                    <div style={{ font: '600 9px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Usuarios</div>
                    <div style={{ font: '700 16px/1 var(--f-mono)', color: 'var(--ink)' }}>{t.users}</div>
                  </div>
                  <U.Btn variant="secondary" size="sm" icon={I.cog(13)} onClick={() => setManageTenant(t)}>Gestionar módulos</U.Btn>
                </div>
              </U.Card>
            ))}
            <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', padding: '4px 2px' }}>
              Solo el <b style={{ color: 'var(--wine)' }}>Super Admin</b> puede crear/suspender tenants y asignar su Administrador de Tenant.
            </div>
            <U.Btn variant="primary" icon={I.plus(14)} onClick={() => setWizard(true)} style={{ alignSelf: 'flex-start', marginTop: 4 }}>Crear tenant nuevo</U.Btn>
          </div>
        )}

        {wizard && <TenantWizard onClose={() => setWizard(false)} />}
        {manageTenant && <TenantModules tenant={manageTenant} catalog={MODULE_CATALOG} planRank={PLAN_RANK} onClose={() => setManageTenant(null)} />}
      </div>
    );
  }

  // ── Wizard de creación de tenant (4 pasos) ──────────────────
  function TenantWizard({ onClose }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [step, setStep] = useState(1);
    const [data, setData] = useState({ name: '', region: '', plan: 'Pro', rif: '', adminName: '', adminEmail: '', modules: ['shipments', 'tracking', 'cn', 've', 'estimados', 'clients', 'invoices'] });
    const set = (k, v) => setData(d => ({ ...d, [k]: v }));

    const STEPS = ['Datos del tenant', 'Plan & módulos', 'Administrador de Tenant', 'Confirmar'];
    // Módulos por nivel · core = siempre on (locked), resto se activa por tenant
    const MODULE_GROUPS = [
      { group: 'Core · siempre activos', locked: true, items: [
        { id: 'dashboard', label: 'Dashboard' }, { id: 'shipments', label: 'Embarques' },
        { id: 'tracking', label: 'Tracking' }, { id: 'clients', label: 'Clientes' },
        { id: 'users', label: 'Usuarios' }, { id: 'admin', label: 'Administración' },
      ]},
      { group: 'Operación · opcionales', minPlan: 'Starter', items: [
        { id: 'cn', label: 'Almacén CN' }, { id: 've', label: 'Almacén VE' },
        { id: 'despacho', label: 'Despacho' }, { id: 'labels', label: 'Etiquetas CN' },
        { id: 'qrqueue', label: 'Cola de QR' }, { id: 'calendar', label: 'Calendario' },
      ]},
      { group: 'Comercial & Finanzas', minPlan: 'Pro', items: [
        { id: 'estimados', label: 'Estimador' }, { id: 'leads', label: 'CRM · Leads' },
        { id: 'suppliers', label: 'Proveedores CN' }, { id: 'rates', label: 'Tarifas' },
        { id: 'invoices', label: 'Facturación' }, { id: 'contab', label: 'Contabilidad' },
        { id: 'reconcile', label: 'Conciliación bancaria' },
      ]},
      { group: 'Premium · Enterprise', minPlan: 'Enterprise', items: [
        { id: 'seniat', label: 'Aduana SENIAT' }, { id: 'tms', label: 'TMS · Transporte' },
        { id: 'costing', label: 'Costing & Margen' }, { id: 'operarios', label: 'Operarios PWA' },
        { id: 'vault', label: 'Vault' }, { id: 'reports', label: 'Reportes avanzados' },
      ]},
    ];
    const PLAN_RANK = { Starter: 1, Pro: 2, Enterprise: 3 };
    const planAllows = (minPlan) => !minPlan || PLAN_RANK[data.plan] >= PLAN_RANK[minPlan];

    const canNext = step === 1 ? data.name && data.region : step === 3 ? data.adminName && data.adminEmail : true;

    return (
      <U.Drawer open onClose={onClose} width={640}
        title="Crear tenant nuevo"
        subtitle={`Paso ${step} de 4 · ${STEPS[step-1]}`}
        actions={
          <>
            {step > 1 && <U.Btn variant="ghost" onClick={() => setStep(s => s-1)}>Atrás</U.Btn>}
            {step < 4
              ? <U.Btn variant="primary" disabled={!canNext} onClick={() => setStep(s => s+1)}>Siguiente</U.Btn>
              : <U.Btn variant="primary" icon={I.check(13)} onClick={onClose}>Crear tenant & enviar invitación</U.Btn>}
          </>
        }
      >
        {/* Stepper */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 22 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ height: 4, borderRadius: 2, background: i+1 <= step ? 'var(--wine)' : 'var(--border)' }} />
              <span style={{ font: '600 9.5px/1.2 var(--f-mono)', color: i+1 === step ? 'var(--wine)' : 'var(--ink-mute)', letterSpacing: '0.04em' }}>{i+1}. {s}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <U.Input label="Nombre del tenant" value={data.name} onChange={e => set('name', e.target.value)} placeholder="DTD-Cargo Occidente" />
            <U.Input label="Región / sede" value={data.region} onChange={e => set('region', e.target.value)} placeholder="Barquisimeto · Lara" />
            <U.Input label="RIF" value={data.rif} onChange={e => set('rif', e.target.value)} placeholder="J-XXXXXXXX-X" />
          </div>
        )}

        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Plan</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {['Starter', 'Pro', 'Enterprise'].map(p => {
                  const sel = data.plan === p;
                  return (
                    <button key={p} onClick={() => set('plan', p)} style={{ padding: 14, textAlign: 'center', background: sel ? 'var(--wine-tint)' : 'var(--bg-surface)', border: `1.5px solid ${sel ? 'var(--wine)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
                      <div style={{ font: '800 14px/1 var(--f-display)', color: sel ? 'var(--wine)' : 'var(--ink)' }}>{p}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Módulos habilitados</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {MODULE_GROUPS.map(g => {
                  const available = g.locked || planAllows(g.minPlan);
                  return (
                    <div key={g.group} style={{ opacity: available ? 1 : 0.45 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{ font: '700 10px/1 var(--f-mono)', color: g.locked ? 'var(--success)' : available ? 'var(--wine)' : 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{g.group}</span>
                        {g.locked && <span style={{ font: '600 9px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>🔒 obligatorio</span>}
                        {!available && <span style={{ font: '600 9px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>requiere plan {g.minPlan}</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                        {g.items.map(m => {
                          const sel = g.locked || data.modules.includes(m.id);
                          const disabled = g.locked || !available;
                          return (
                            <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: sel ? 'var(--wine-tint)' : 'var(--bg-surface)', border: `1px solid ${sel ? 'var(--wine)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', cursor: disabled ? 'default' : 'pointer' }}>
                              <input type="checkbox" checked={sel} disabled={disabled} onChange={() => set('modules', sel ? data.modules.filter(x => x !== m.id) : [...data.modules, m.id])} style={{ accentColor: 'var(--wine)' }} />
                              <span style={{ font: '600 11.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{m.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
              El <b style={{ color: 'var(--ink)' }}>Administrador de Tenant</b> recibe un email de activación y será el primer usuario con acceso total al tenant.
            </div>
            <U.Input label="Nombre del Administrador de Tenant" value={data.adminName} onChange={e => set('adminName', e.target.value)} placeholder="Pedro Finol" />
            <U.Input label="Email" type="email" value={data.adminEmail} onChange={e => set('adminEmail', e.target.value)} placeholder="admin@dtdcargo.com" />
          </div>
        )}

        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '18px 20px', background: 'linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)', color: '#fff', borderRadius: 'var(--r-md)' }}>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>RESUMEN DEL TENANT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, font: '500 13px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.85)' }}>
                <div>✓ Tenant: <b style={{ color: '#fff' }}>{data.name || '—'}</b> · {data.region || '—'}</div>
                <div>✓ Plan: <b style={{ color: '#fff' }}>{data.plan}</b> · {(MODULE_GROUPS.flatMap(g => g.locked ? g.items.length : data.modules.filter(id => g.items.some(it => it.id === id)).length).reduce((a,b)=>a+b,0))} módulos activos</div>
                <div>✓ Admin de Tenant: <b style={{ color: '#fff' }}>{data.adminName || '—'}</b> ({data.adminEmail || '—'})</div>
                <div>✓ Estado inicial: <b style={{ color: '#fff' }}>onboarding</b> hasta que el admin active su cuenta</div>
              </div>
            </div>
            <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
              Al crear: se provisiona el tenant aislado, se aplican los módulos del plan, y se envía la invitación al Administrador de Tenant (vence en 72h).
            </div>
          </div>
        )}
      </U.Drawer>
    );
  }

  // ── Gestión de módulos de un tenant existente ──────────────
  function TenantModules({ tenant, catalog, planRank, onClose }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [active, setActive] = useState(new Set(tenant.active));
    const [dirty, setDirty] = useState(false);

    const planAllows = (minPlan) => !minPlan || planRank[tenant.plan] >= planRank[minPlan];

    function toggle(id) {
      setActive(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      setDirty(true);
    }

    const totalAvailable = catalog.reduce((n, g) => planAllows(g.minPlan) ? n + g.items.length : n, 0);

    return (
      <U.Drawer open onClose={onClose} width={620}
        title={'Módulos · ' + tenant.name}
        subtitle={`Plan ${tenant.plan} · ${active.size} de ${totalAvailable} módulos disponibles activos`}
        actions={
          <>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.check(13)} disabled={!dirty} onClick={() => { tenant.active = [...active]; onClose(); }}>Guardar cambios</U.Btn>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {catalog.map(g => {
            const allowed = planAllows(g.minPlan);
            return (
              <div key={g.group} style={{ opacity: allowed ? 1 : 0.5 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{g.group}</div>
                  {g.locked && <U.Badge tone="neutral" size="sm">obligatorio</U.Badge>}
                  {!allowed && <U.Badge tone="warning" size="sm">requiere {g.minPlan}</U.Badge>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {g.items.map(m => {
                    const on = active.has(m.id);
                    const locked = g.locked || !allowed;
                    return (
                      <button key={m.id} onClick={() => !locked && toggle(m.id)} disabled={locked} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                        padding: '11px 14px', borderRadius: 'var(--r-md)', cursor: locked ? 'default' : 'pointer',
                        border: '1px solid ' + (on ? 'var(--wine)' : 'var(--border)'),
                        background: on ? 'var(--wine-tint)' : 'var(--bg-surface)', textAlign: 'left',
                      }}>
                        <span style={{ font: '600 12.5px/1 var(--f-sans)', color: on ? 'var(--wine)' : 'var(--ink-soft)' }}>{m.label}</span>
                        <span style={{
                          width: 34, height: 20, borderRadius: 999, flexShrink: 0, position: 'relative',
                          background: on ? 'var(--wine)' : 'var(--border)', transition: 'background 140ms',
                        }}>
                          <span style={{
                            position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16,
                            borderRadius: '50%', background: '#fff', transition: 'left 140ms', boxShadow: 'var(--shadow-xs)',
                          }} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)', paddingTop: 4 }}>
            Los módulos Core no se pueden desactivar. Para habilitar grupos superiores, sube el plan del tenant.
          </div>
        </div>
      </U.Drawer>
    );
  }

  window.PlatformUsers = PlatformUsers;
})();
