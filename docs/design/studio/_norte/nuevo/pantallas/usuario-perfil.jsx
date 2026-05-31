/* global React */
/* ── Perfil de usuario interno · componente principal ────────── */

const MOD_LABELS = {
  dashboard: 'Dashboard', shipments: 'Embarques', clients: 'Clientes', quotes: 'Cotizador',
  tracking: 'Tracking', calendar: 'Calendario', invoices: 'Facturación', documents: 'Documentos',
  cn: 'Almacén CN', ve: 'Almacén VE', despacho: 'Despacho', leads: 'Leads', mailing: 'Mailing',
  rates: 'Tarifas', users: 'Usuarios', reports: 'Reportes', costing: 'Costing', tms: 'TMS',
  suppliers: 'Proveedores', seniat: 'SENIAT', contab: 'Contabilidad', reconcile: 'Conciliación',
  qrqueue: 'Cola QR', labels: 'Etiquetas', operarios: 'Operarios', vault: 'Vault', auditlog: 'Audit',
  'audit-log': 'Audit', 'despacho-rules': 'Reglas', 'despacho-dashboard': 'Dashboard despacho', admin: 'Admin',
};

function UsuarioPerfil() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  const { CORP_LINES, USER_PROFILES, PRESENCE } = window.UsuarioPerfil_DATA;

  const initialId = React.useMemo(() => {
    try {
      const id = new URLSearchParams(window.location.search).get('id');
      return id && USER_PROFILES[id] ? id : 'u-001';
    } catch (e) { return 'u-001'; }
  }, []);

  const [userId, setUserId] = React.useState(initialId);
  const user = D.USERS.find(u => u.id === userId);
  const profile = USER_PROFILES[userId];
  const [note, setNote] = React.useState('');
  React.useEffect(() => { setNote(profile?.note || ''); }, [userId]);

  if (!user || !profile) return <div style={{ padding: 40 }}>Usuario no encontrado.</div>;

  const corp = CORP_LINES[user.team] || CORP_LINES[user.role] || null;
  const allowed = D.ROLE_MODULES[user.role];
  const modules = allowed === '*' ? Object.keys(MOD_LABELS).filter((v, i, a) => a.indexOf(v) === i) : (allowed || []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <TopBar userId={userId} setUserId={setUserId} users={D.USERS} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 32px 60px' }}>
        <HeroCard user={user} profile={profile} corp={corp} />

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <OwnsCard profile={profile} />
            <ActivityCard profile={profile} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <ContactCard user={user} profile={profile} corp={corp} />
            <AccessCard user={user} modules={modules} isAll={allowed === '*'} />
            <NotesCard note={note} setNote={setNote} />
            <AdminActions user={user} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Top bar ──────────────────────────────────────────────────
function TopBar({ userId, setUserId, users }) {
  const I = window.Icon;
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
      padding: '12px 32px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <a href="../../DTD Studio · ERP.html" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', textDecoration: 'none' }}>
        {I.arrowL(13)} ERP
      </a>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Equipo</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <span style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>Usuarios</span>
      <span style={{ color: 'var(--ink-mute)' }}>/</span>
      <select
        value={userId}
        onChange={(e) => { setUserId(e.target.value); history.replaceState(null, '', `?id=${e.target.value}`); }}
        style={{
          padding: '6px 28px 6px 10px',
          background: 'var(--bg-elevated) url("data:image/svg+xml;utf8,<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"10\\" height=\\"6\\" viewBox=\\"0 0 10 6\\"><path d=\\"M1 1l4 4 4-4\\" stroke=\\"%236B6B6B\\" stroke-width=\\"1.6\\" fill=\\"none\\" stroke-linecap=\\"round\\"/></svg>") no-repeat right 10px center',
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          font: '700 12.5px/1 var(--f-sans)', color: 'var(--ink)',
          appearance: 'none', outline: 'none', cursor: 'pointer',
        }}
      >
        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <div style={{ flex: 1 }} />
      <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Perfil de usuario</span>
    </header>
  );
}

// ── Hero card ────────────────────────────────────────────────
function HeroCard({ user, profile, corp }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const { PRESENCE } = window.UsuarioPerfil_DATA;
  const pres = PRESENCE[profile.presence];
  const initials = user.name.split(' ').map(w => w[0]).slice(0, 2).join('');
  const waPhone = profile.phone.replace(/[^0-9]/g, '');

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', padding: '24px 28px', marginBottom: 'var(--s-6)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center',
    }}>
      <div style={{ position: 'relative' }}>
        <U.Avatar initials={initials} color={profile.avatarColor} size={88} />
        <span style={{
          position: 'absolute', right: 2, bottom: 2, width: 18, height: 18, borderRadius: '50%',
          background: `var(--${pres.tone})`, border: '3px solid var(--bg-surface)',
        }} title={pres.label} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <U.Badge tone={pres.tone} dot>{pres.label}</U.Badge>
          <span className="eyebrow">{user.role.toUpperCase()} · {user.id.toUpperCase()}</span>
        </div>
        <h1 style={{ font: '900 32px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>{user.name}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 10, font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <span>{profile.title}</span>
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--wine)' }}>{I.warehouse(13)}</span>
            <strong style={{ color: 'var(--ink)' }}>{profile.location}</strong>
          </span>
          <span>·</span>
          <span>{profile.lastActive}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <a href={`mailto:${user.email}`} style={{ textDecoration: 'none' }}><U.Btn variant="secondary" icon={I.mail(13)}>Email</U.Btn></a>
        <a href={`tel:${profile.phone.replace(/\s/g, '')}`} style={{ textDecoration: 'none' }}><U.Btn variant="secondary">Llamar</U.Btn></a>
        <a href={`https://wa.me/58${waPhone.replace(/^0/, '')}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><U.Btn variant="primary">WhatsApp</U.Btn></a>
      </div>
    </div>
  );
}

// ── Asignados / owns card ────────────────────────────────────
function OwnsCard({ profile }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const o = profile.owns;
  return (
    <U.Card padded={false}>
      <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div className="eyebrow eyebrow-wine">{o.label.toUpperCase()} · {o.count}</div>
        <a href={`../../DTD Studio · ERP.html#${o.mod}`} style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
          Ver en {MOD_LABELS[o.mod] || o.mod} {I.arrowR(11)}
        </a>
      </div>
      {o.items.length === 0 ? (
        <div style={{ padding: '18px 20px', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin elementos asignados todavía.</div>
      ) : (
        <div>
          {o.items.map((it, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
              borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--wine)', flexShrink: 0 }} />
              <span style={{ font: '600 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{it}</span>
            </div>
          ))}
        </div>
      )}
    </U.Card>
  );
}

// ── Actividad reciente ───────────────────────────────────────
function ActivityCard({ profile }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const icon = (name) => (I[name] ? I[name](14) : I.box(14));
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 14 }}>ACTIVIDAD RECIENTE</div>
      {profile.activity.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
          <span style={{ color: 'var(--ink-mute)' }}>{I.clock ? I.clock(15) : null}</span>
          <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin actividad — la cuenta aún no fue activada.</span>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          <div style={{ position: 'absolute', left: 9, top: 6, bottom: 6, width: 2, background: 'var(--border)' }} />
          {profile.activity.map((a, i) => (
            <div key={i} style={{ position: 'relative', paddingBottom: i < profile.activity.length - 1 ? 16 : 0 }}>
              <span style={{
                position: 'absolute', left: -24, top: 0, width: 20, height: 20, borderRadius: '50%',
                background: 'var(--wine-tint)', color: 'var(--wine)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{icon(a.icon)}</span>
              <div style={{ font: '600 13px/1.35 var(--f-sans)', color: 'var(--ink)' }}>{a.text}</div>
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>
                {MOD_LABELS[a.mod] || a.mod} · {a.when}
              </div>
            </div>
          ))}
        </div>
      )}
    </U.Card>
  );
}

// ── Contacto corporativo ─────────────────────────────────────
function ContactCard({ user, profile, corp }) {
  const U = window.ERPUI;
  const I = window.Icon;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>CONTACTO</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Field label="Email corporativo" value={user.email} />
        <U.Field label="Teléfono directo" value={profile.phone} mono />
        {corp && (
          <div>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Línea de {corp.label}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{corp.phone}</code>
              {corp.whatsappApi && <U.Badge tone="success" size="sm" dot>WhatsApp API</U.Badge>}
            </div>
          </div>
        )}
        <U.Field label="Equipo" value={`${user.team} · ${user.role}`} />
        <U.Field label="Ingreso a DTD" value={profile.joined} mono />
        <div>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Seguridad</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <U.Badge tone={user.twoFa ? 'success' : 'warning'} size="sm" dot>{user.twoFa ? '2FA activo' : '2FA pendiente'}</U.Badge>
            <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Últ. acceso {user.lastLogin}</span>
          </div>
        </div>
      </div>
    </U.Card>
  );
}

// ── Acceso / permisos ────────────────────────────────────────
function AccessCard({ user, modules, isAll }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="eyebrow eyebrow-wine">ACCESO · {user.role.toUpperCase()}</div>
        {isAll && <U.Badge tone="wine" size="sm">Acceso total</U.Badge>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {isAll ? (
          <span style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Ve todos los módulos del ERP (rol Admin).</span>
        ) : modules.map(m => (
          <span key={m} style={{
            padding: '4px 9px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-pill)', font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)',
          }}>{MOD_LABELS[m] || m}</span>
        ))}
      </div>
    </U.Card>
  );
}

// ── Notas internas ───────────────────────────────────────────
function NotesCard({ note, setNote }) {
  const U = window.ERPUI;
  return (
    <U.Card padded>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>NOTAS INTERNAS</div>
      <textarea
        value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Notas privadas sobre este usuario (visibles solo para Admin)…"
        style={{
          width: '100%', minHeight: 80, padding: '10px 12px', boxSizing: 'border-box',
          background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          outline: 'none', resize: 'vertical', font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink)',
        }}
      />
      <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 6 }}>Autoguardado · solo Admin</div>
    </U.Card>
  );
}

// ── Acciones admin ───────────────────────────────────────────
function AdminActions({ user }) {
  const U = window.ERPUI;
  const invited = user.status === 'invited';
  return (
    <U.Card padded>
      <div className="eyebrow" style={{ marginBottom: 10, color: 'var(--ink-soft)' }}>ACCIONES ADMIN</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {invited && <U.Btn variant="primary" full>Reenviar invitación</U.Btn>}
        <U.Btn variant="ghost" full>Editar usuario</U.Btn>
        <U.Btn variant="ghost" full>Cambiar rol / permisos</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--warning)' }}>Restablecer contraseña</U.Btn>
        <U.Btn variant="ghost" full style={{ color: 'var(--danger)' }}>{invited ? 'Cancelar invitación' : 'Suspender acceso'}</U.Btn>
      </div>
    </U.Card>
  );
}

window.UsuarioPerfil = UsuarioPerfil;
