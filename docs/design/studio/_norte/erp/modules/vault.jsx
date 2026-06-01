/* global React */
/* ── DTD ERP · Vault (caja fuerte de contraseñas) ───────────── */

const { useState: _vUseState, useMemo: _vUseMemo, useEffect: _vUseEffect } = React;

// ── Mock vault data ──────────────────────────────────────────
const VAULT_CATEGORIES = [
  { id: 'marketing',   name: 'Marketing',          icon: 'spark',     count: 5,  color: '#D946A0' },
  { id: 'emails',      name: 'Cuentas de email',   icon: 'mail',      count: 4,  color: '#2A6FDB' },
  { id: 'apps',        name: 'Apps & SaaS',        icon: 'box',       count: 4,  color: '#7F0F1A' },
  { id: 'carriers',    name: 'Navieras · Portales', icon: 'ship',      count: 4,  color: '#0F1E3D' },
  { id: 'govt',        name: 'Aduanas & Gobierno', icon: 'shield',    count: 3,  color: '#1F8A5B' },
  { id: 'banks',       name: 'Bancos & Pagos',     icon: 'invoice',   count: 3,  color: '#B8893A' },
  { id: 'it',          name: 'Servidores & IT',    icon: 'cog',       count: 4,  color: '#6E7896' },
  { id: 'suppliers',   name: 'Proveedores CN',     icon: 'cn',        count: 3,  color: '#A8323E' },
];

const VAULT_ENTRIES = [
  // Marketing
  { id: 'v-m01', cat: 'marketing', name: 'Instagram · @dtdcargo',     user: 'social@dtdcargo.com',   url: 'instagram.com',    twoFa: true,  notes: 'Compartido con Marketing externo · rotar cada 90d',  strength: 'fuerte', updated: '2026-04-12', owner: 'u-002', shared: ['u-001','u-002','u-008'], tags: ['social','público'] },
  { id: 'v-m02', cat: 'marketing', name: 'LinkedIn Company Page',     user: 'martina@dtdcargo.com',  url: 'linkedin.com',     twoFa: true,  notes: 'Solo Comercial + Dirección',                          strength: 'fuerte', updated: '2026-05-02', owner: 'u-002', shared: ['u-001','u-002'], tags: ['social','b2b'] },
  { id: 'v-m03', cat: 'marketing', name: 'Mailchimp · Newsletter',    user: 'comercial@dtdcargo.com',url: 'mailchimp.com',    twoFa: false, notes: 'Pagar el plan Standard antes 1 jul',                strength: 'media',  updated: '2026-03-22', owner: 'u-001', shared: ['u-001','u-002'], tags: ['mailing'] },
  { id: 'v-m04', cat: 'marketing', name: 'Canva Pro · Team',          user: 'comercial@dtdcargo.com',url: 'canva.com',        twoFa: false, notes: 'Plantillas brand DTD están en carpeta /DTD-Cargo',  strength: 'media',  updated: '2026-02-08', owner: 'u-002', shared: ['u-001','u-002','u-008'], tags: ['diseño'] },
  { id: 'v-m05', cat: 'marketing', name: 'TikTok Business',           user: 'social@dtdcargo.com',   url: 'tiktok.com',       twoFa: true,  notes: 'Creada Q1 2026 · usar solo previa coordinación',     strength: 'fuerte', updated: '2026-01-15', owner: 'u-002', shared: ['u-001','u-002'], tags: ['social'] },

  // Emails
  { id: 'v-e01', cat: 'emails',    name: 'Gmail · comercial@',        user: 'comercial@dtdcargo.com',url: 'gmail.com',        twoFa: true,  notes: 'Cuenta principal de envíos del ERP. NO compartir.', strength: 'fuerte', updated: '2026-05-01', owner: 'u-001', shared: ['u-001'], tags: ['crítico'] },
  { id: 'v-e02', cat: 'emails',    name: 'Gmail · soporte@',          user: 'soporte@dtdcargo.com',  url: 'gmail.com',        twoFa: true,  notes: 'Bandeja compartida CX',                              strength: 'fuerte', updated: '2026-04-20', owner: 'u-001', shared: ['u-001','u-008'], tags: ['cx'] },
  { id: 'v-e03', cat: 'emails',    name: 'Outlook · contabilidad@',   user: 'contabilidad@dtdcargo.com', url: 'outlook.com', twoFa: true,  notes: 'Para conciliación SENIAT',                            strength: 'fuerte', updated: '2026-04-18', owner: 'u-006', shared: ['u-001','u-006'], tags: ['finanzas'] },
  { id: 'v-e04', cat: 'emails',    name: 'Gmail · op-china@',         user: 'china@dtdcargo.com',    url: 'gmail.com',        twoFa: false, notes: 'Comunicación con suppliers · Wang también accede',  strength: 'media',  updated: '2026-03-30', owner: 'u-004', shared: ['u-001','u-004','u-007'], tags: ['china'] },

  // Apps
  { id: 'v-a01', cat: 'apps',      name: 'Slack · DTD-Cargo workspace',user:'admin@dtdcargo.com',    url: 'dtdcargo.slack.com',twoFa: true,  notes: 'Admin del workspace',                                strength: 'fuerte', updated: '2026-04-10', owner: 'u-001', shared: ['u-001'], tags: ['interno'] },
  { id: 'v-a02', cat: 'apps',      name: 'Notion · Operaciones',      user: 'admin@dtdcargo.com',    url: 'notion.so',        twoFa: true,  notes: 'Plan Team · 18 miembros',                            strength: 'fuerte', updated: '2026-03-12', owner: 'u-001', shared: ['u-001','u-002','u-004'], tags: ['docs'] },
  { id: 'v-a03', cat: 'apps',      name: 'Figma · Brand assets',      user: 'design@dtdcargo.com',   url: 'figma.com',        twoFa: false, notes: 'Solo lectura para resto del equipo',                 strength: 'media',  updated: '2026-02-22', owner: 'u-001', shared: ['u-001','u-002'], tags: ['diseño'] },
  { id: 'v-a04', cat: 'apps',      name: 'Cloudflare · dtdcargo.com', user: 'admin@dtdcargo.com',    url: 'cloudflare.com',   twoFa: true,  notes: 'DNS + WAF · NO tocar sin autorización',              strength: 'fuerte', updated: '2026-01-20', owner: 'u-001', shared: ['u-001'], tags: ['crítico','infra'] },

  // Navieras
  { id: 'v-c01', cat: 'carriers',  name: 'COSCO eBusiness',           user: 'DTD-VE-21',             url: 'ebusiness.coscoshipping.com', twoFa: true, notes: 'Booking + BL eléctronico', strength: 'fuerte', updated: '2026-04-08', owner: 'u-004', shared: ['u-001','u-004','u-005'], tags: ['operativo'] },
  { id: 'v-c02', cat: 'carriers',  name: 'MSC myMSC',                 user: 'DTDCARG-VE',            url: 'mymsc.com',        twoFa: false, notes: 'Account manager: Cristian Pellegrini',              strength: 'fuerte', updated: '2026-03-15', owner: 'u-004', shared: ['u-001','u-004','u-005'], tags: ['operativo'] },
  { id: 'v-c03', cat: 'carriers',  name: 'CMA CGM Portal',            user: 'dtd_cargo_ve',          url: 'cma-cgm.com',      twoFa: false, notes: '',                                                   strength: 'media',  updated: '2026-02-28', owner: 'u-004', shared: ['u-001','u-004','u-005'], tags: ['operativo'] },
  { id: 'v-c04', cat: 'carriers',  name: 'ONE · INTRA',               user: 'DTDCARG21',             url: 'ecomm.one-line.com',twoFa: true, notes: 'Recientemente activado',                              strength: 'fuerte', updated: '2026-01-12', owner: 'u-004', shared: ['u-001','u-004','u-005'], tags: ['operativo'] },

  // Govt
  { id: 'v-g01', cat: 'govt',      name: 'SENIAT · Portal',           user: 'J-30182554-9',          url: 'seniat.gob.ve',    twoFa: false, notes: 'Solo Contabilidad. Renovar certificado cada año',    strength: 'fuerte', updated: '2026-03-08', owner: 'u-006', shared: ['u-001','u-006'], tags: ['crítico','gov'] },
  { id: 'v-g02', cat: 'govt',      name: 'CCPIT · CN Export',         user: 'DTDCARGO-CN',           url: 'ccpit.org',        twoFa: false, notes: 'Para certificados de origen CN',                     strength: 'media',  updated: '2026-02-14', owner: 'u-004', shared: ['u-001','u-004','u-006'], tags: ['gov'] },
  { id: 'v-g03', cat: 'govt',      name: 'AEO Venezuela',             user: 'AEO-VE-1842',           url: 'aduanas.gob.ve',   twoFa: false, notes: 'Acceso restringido',                                  strength: 'media',  updated: '2026-01-22', owner: 'u-001', shared: ['u-001','u-006'], tags: ['gov'] },

  // Banks
  { id: 'v-b01', cat: 'banks',     name: 'Banco Mercantil · Empresa', user: 'V12348822',             url: 'mercantilbanco.com',twoFa:true,  notes: 'Token físico en caja fuerte oficina',                strength: 'fuerte', updated: '2026-04-22', owner: 'u-006', shared: ['u-001','u-006'], tags: ['crítico','$'] },
  { id: 'v-b02', cat: 'banks',     name: 'BBVA Provincial',           user: 'J30182554',             url: 'provincial.com',   twoFa: true,  notes: '',                                                   strength: 'fuerte', updated: '2026-03-30', owner: 'u-006', shared: ['u-001','u-006'], tags: ['$'] },
  { id: 'v-b03', cat: 'banks',     name: 'Bancaribe · Operaciones',   user: 'DTDCARGO',              url: 'bancaribe.com.ve', twoFa: false, notes: 'Solo para depósitos en efectivo',                    strength: 'media',  updated: '2026-02-18', owner: 'u-006', shared: ['u-001','u-006'], tags: ['$'] },

  // IT
  { id: 'v-i01', cat: 'it',        name: 'AWS · DTD Production',      user: 'admin@dtdcargo.com',    url: 'console.aws.amazon.com', twoFa: true, notes: 'Cuenta raíz · usar IAM para resto', strength: 'fuerte', updated: '2026-05-10', owner: 'u-001', shared: ['u-001'], tags: ['crítico','infra'] },
  { id: 'v-i02', cat: 'it',        name: 'GoDaddy · dominios DTD',    user: 'admin@dtdcargo.com',    url: 'godaddy.com',      twoFa: true,  notes: 'Renovaciones automáticas activas',                   strength: 'fuerte', updated: '2026-04-05', owner: 'u-001', shared: ['u-001'], tags: ['infra'] },
  { id: 'v-i03', cat: 'it',        name: 'GitHub · DTD-Studio',       user: 'dtd-bot',               url: 'github.com',       twoFa: true,  notes: 'Org admin',                                          strength: 'fuerte', updated: '2026-03-18', owner: 'u-001', shared: ['u-001'], tags: ['código'] },
  { id: 'v-i04', cat: 'it',        name: 'Sentry · Error tracking',   user: 'admin@dtdcargo.com',    url: 'sentry.io',        twoFa: false, notes: '',                                                   strength: 'media',  updated: '2026-02-08', owner: 'u-001', shared: ['u-001'], tags: ['infra'] },

  // Suppliers CN
  { id: 'v-s01', cat: 'suppliers', name: 'Yiwu Warehouse System',     user: 'dtd-ywh-21',            url: 'ywh-system.cn',    twoFa: false, notes: '小孙 admin · 18006891419',                            strength: 'media',  updated: '2026-04-14', owner: 'u-007', shared: ['u-001','u-004','u-007'], tags: ['china'] },
  { id: 'v-s02', cat: 'suppliers', name: '1688.com · Sourcing',       user: 'dtdcargo_ve',           url: '1688.com',         twoFa: false, notes: 'Para búsqueda de proveedores CN',                    strength: 'media',  updated: '2026-03-02', owner: 'u-004', shared: ['u-001','u-002','u-004'], tags: ['china'] },
  { id: 'v-s03', cat: 'suppliers', name: 'Alibaba Supplier Mgmt',     user: 'DTD-VE-Buyer',          url: 'alibaba.com',      twoFa: true,  notes: 'Cuenta Trade Assurance · revisar disputas',          strength: 'fuerte', updated: '2026-02-12', owner: 'u-004', shared: ['u-001','u-002','u-004'], tags: ['china'] },
];

// ── Main module ──────────────────────────────────────────────
function ModuleVault() {
  const U = window.ERPUI;
  const [unlocked, setUnlocked] = _vUseState(false);
  const [category, setCategory] = _vUseState('all');
  const [selectedId, setSelectedId] = _vUseState(null);
  const [search, setSearch] = _vUseState('');
  const [createOpen, setCreateOpen] = _vUseState(false);
  const [genOpen, setGenOpen] = _vUseState(false);
  const [exportOpen, setExportOpen] = _vUseState(false);

  const filtered = _vUseMemo(() => {
    let rows = VAULT_ENTRIES;
    if (category !== 'all') rows = rows.filter(e => e.cat === category);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(e => e.name.toLowerCase().includes(q) || e.user.toLowerCase().includes(q) || (e.url || '').toLowerCase().includes(q) || (e.tags || []).some(t => t.includes(q)));
    }
    return rows;
  }, [category, search]);

  if (!unlocked) return <VaultLock onUnlock={() => setUnlocked(true)} />;

  const selected = VAULT_ENTRIES.find(e => e.id === selectedId);

  return (
    <div>
      <U.PageHeader
        title="Vault · caja fuerte"
        subtitle="Bóveda cifrada de contraseñas del equipo. Categorías, permisos por usuario, generador y rotación."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(14)} onClick={() => setExportOpen(true)}>Exportar</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.shield(14)} onClick={() => setGenOpen(true)}>Generador</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.refresh(14)} onClick={() => setUnlocked(false)}>Bloquear</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={() => setCreateOpen(true)}>Nueva clave</U.Btn>
          </>
        }
      />

      {/* Vault status bar */}
      <U.Card padded style={{ marginBottom: 'var(--s-5)', background: 'linear-gradient(135deg, var(--ink), #1F3055)', color: '#fff', border: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 20, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--wine-soft)' }}>{window.Icon.shield(20)}</span>
              <div style={{ font: '700 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>VAULT</div>
            </div>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: '#fff', marginTop: 8 }}>Desbloqueado</div>
            <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Auto-lock en 15 min · Carlos V.</div>
          </div>
          <VaultStat label="Entradas" value={VAULT_ENTRIES.length} />
          <VaultStat label="Compartidas" value={VAULT_ENTRIES.filter(e=>e.shared.length>1).length} />
          <VaultStat label="Con 2FA" value={VAULT_ENTRIES.filter(e=>e.twoFa).length} sub={`${Math.round(VAULT_ENTRIES.filter(e=>e.twoFa).length / VAULT_ENTRIES.length * 100)}%`} />
          <VaultStat label="Para rotar" value={VAULT_ENTRIES.filter(e=>e.strength==='media').length} sub="strength media" tone="warning" />
        </div>
      </U.Card>

      {/* Grid: categories | list | detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr 400px', gap: 14, alignItems: 'flex-start' }}>
        {/* Categories */}
        <U.Card padded={false}>
          <button onClick={() => { setCategory('all'); setSelectedId(null); }} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 14px',
            background: category === 'all' ? 'var(--wine-tint)' : 'transparent',
            color: category === 'all' ? 'var(--wine)' : 'var(--ink)',
            font: `${category === 'all' ? '700' : '500'} 13px/1 var(--f-sans)`,
            textAlign: 'left',
            borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ color: category === 'all' ? 'var(--wine)' : 'var(--ink-soft)' }}>{window.Icon.box(15)}</span>
            <span style={{ flex: 1 }}>Todas</span>
            <span style={{ font: '700 11px/1.3 var(--f-mono)', color: category === 'all' ? 'var(--wine)' : 'var(--ink-mute)' }}>{VAULT_ENTRIES.length}</span>
          </button>
          {VAULT_CATEGORIES.map((c, i) => {
            const count = VAULT_ENTRIES.filter(e => e.cat === c.id).length;
            const isActive = category === c.id;
            return (
              <button key={c.id} onClick={() => { setCategory(c.id); setSelectedId(null); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px',
                background: isActive ? 'var(--wine-tint)' : 'transparent',
                color: isActive ? 'var(--wine)' : 'var(--ink)',
                font: `${isActive ? '700' : '500'} 13px/1 var(--f-sans)`,
                textAlign: 'left',
                borderTop: '1px solid var(--border)',
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 'var(--r-sm)', flexShrink: 0,
                  background: isActive ? c.color : `${c.color}22`,
                  color: isActive ? '#fff' : c.color,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}>{window.Icon[c.icon](12)}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ font: '700 11px/1.3 var(--f-mono)', color: isActive ? 'var(--wine)' : 'var(--ink-mute)' }}>{count}</span>
              </button>
            );
          })}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
            <U.Btn variant="ghost" size="sm" icon={window.Icon.plus(12)} full>Nueva categoría</U.Btn>
          </div>
        </U.Card>

        {/* List */}
        <div>
          <U.Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="Buscar entrada, usuario, URL, tag…" />
          {filtered.length === 0 ? (
            <U.EmptyState icon={window.Icon.shield(22)} title="Sin entradas" body="Esta categoría está vacía o el filtro no devolvió resultados." />
          ) : (
            <U.Card padded={false}>
              {filtered.map((e, i) => {
                const cat = VAULT_CATEGORIES.find(c => c.id === e.cat);
                const isSel = selectedId === e.id;
                return (
                  <button key={e.id} onClick={() => setSelectedId(e.id)} style={{
                    display: 'grid', gridTemplateColumns: '38px 1fr 100px 70px 80px', gap: 14,
                    width: '100%', alignItems: 'center', padding: '14px 18px',
                    background: isSel ? 'var(--wine-tint)' : 'transparent',
                    borderTop: i > 0 ? '1px solid var(--border)' : 0,
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e2) => { if (!isSel) e2.currentTarget.style.background = 'var(--bg-elevated)'; }}
                  onMouseLeave={(e2) => { if (!isSel) e2.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      width: 34, height: 34, borderRadius: 'var(--r-md)', flexShrink: 0,
                      background: `${cat?.color}1A`, color: cat?.color,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{window.Icon[cat?.icon || 'box'](16)}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{e.name}</div>
                      <div style={{ font: '600 11px/1.2 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{e.user}</div>
                    </div>
                    <U.Badge tone={e.strength === 'fuerte' ? 'success' : e.strength === 'media' ? 'warning' : 'danger'} size="sm" dot>{e.strength}</U.Badge>
                    {e.twoFa
                      ? <U.Badge tone="success" size="sm">2FA</U.Badge>
                      : <U.Badge tone="neutral" size="sm">—</U.Badge>
                    }
                    <span style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', textAlign: 'right' }}>{e.updated.slice(5)}</span>
                  </button>
                );
              })}
            </U.Card>
          )}
        </div>

        {/* Detail */}
        <div style={{ position: 'sticky', top: 'calc(var(--topbar-h) + 14px)' }}>
          {selected ? <VaultDetail entry={selected} /> : <VaultEmptyDetail />}
        </div>
      </div>

      <VaultCreate open={createOpen} onClose={() => setCreateOpen(false)} />
      <VaultGenerator open={genOpen} onClose={() => setGenOpen(false)} />
      <VaultExport open={exportOpen} onClose={() => setExportOpen(false)} category={category} />
    </div>
  );
}

// ── Lock screen ──────────────────────────────────────────────
function VaultLock({ onUnlock }) {
  const U = window.ERPUI;
  const [pw, setPw] = _vUseState('');
  const [err, setErr] = _vUseState(false);

  const submit = () => {
    if (pw.length < 4) { setErr(true); return; }
    onUnlock();
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - var(--topbar-h) - 80px)', padding: 40,
    }}>
      <U.Card style={{
        width: '100%', maxWidth: 460, padding: 36,
        background: 'linear-gradient(160deg, var(--ink) 0%, #1F3055 100%)',
        color: '#fff', border: 0, boxShadow: 'var(--shadow-pop)',
      }}>
        <div style={{ width: 64, height: 64, margin: '0 auto 24px', borderRadius: 'var(--r-lg)', background: 'var(--wine)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {window.Icon.shield(28)}
        </div>
        <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.16em', textTransform: 'uppercase', textAlign: 'center' }}>DTD VAULT</div>
        <div style={{ font: '900 26px/1.1 var(--f-display)', color: '#fff', letterSpacing: '-0.02em', marginTop: 10, textAlign: 'center' }}>Caja fuerte<br/>de contraseñas</div>
        <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.6)', marginTop: 14, textAlign: 'center', maxWidth: '36ch', marginInline: 'auto' }}>
          Ingresá tu contraseña maestra. Distinta de la del ERP. La sesión se bloquea automáticamente a los 15 minutos.
        </div>

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Contraseña maestra</span>
            <input
              type="password" value={pw} onChange={(e)=>{setPw(e.target.value); setErr(false);}}
              onKeyDown={(e)=>e.key==='Enter' && submit()}
              autoFocus
              placeholder="••••••••••••"
              style={{
                height: 48, padding: '0 16px',
                background: 'rgba(255,255,255,0.08)',
                border: `1px solid ${err ? 'var(--wine-soft)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 'var(--r-md)',
                font: '600 16px/1 var(--f-mono)', color: '#fff', letterSpacing: '0.1em',
                outline: 'none',
              }}
            />
            {err && <span style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine-soft)' }}>Mínimo 4 caracteres</span>}
          </label>
          <button onClick={submit} style={{
            height: 48, background: 'var(--wine)', color: '#fff', border: 0,
            borderRadius: 'var(--r-md)', font: '700 14px/1 var(--f-sans)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {window.Icon.shield(15)} Desbloquear vault
          </button>
        </div>

        <div style={{ marginTop: 24, padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--wine-soft)', marginTop: 1 }}>{window.Icon.info(13)}</span>
          <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'rgba(255,255,255,0.75)' }}>
            La contraseña maestra <b style={{ color: '#fff' }}>no se almacena</b>. Si la perdés, ningún admin puede recuperarla. Activá 2FA en tu perfil.
          </div>
        </div>
      </U.Card>
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────
function VaultStat({ label, value, sub, tone = 'default' }) {
  const c = tone === 'warning' ? 'var(--warning)' : '#fff';
  return (
    <div>
      <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ font: '900 26px/1 var(--f-display)', color: c, marginTop: 8, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Detail panel ─────────────────────────────────────────────
function VaultDetail({ entry }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [revealed, setRevealed] = _vUseState(false);
  const [copied, setCopied] = _vUseState(null);
  const cat = VAULT_CATEGORIES.find(c => c.id === entry.cat);
  const fakePw = '•••••••••••••••';
  const realPw = 'DTDc@rg0-2026!Tr&Z';

  _vUseEffect(() => { setRevealed(false); setCopied(null); }, [entry.id]);

  const copy = (val, what) => {
    try { navigator.clipboard?.writeText(val); } catch (e) {}
    setCopied(what);
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <U.Card padded>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 'var(--r-md)', flexShrink: 0,
          background: `${cat?.color}1A`, color: cat?.color,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{window.Icon[cat?.icon](22)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <U.Badge tone="neutral" size="sm">{cat?.name}</U.Badge>
          <div style={{ font: '900 17px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 8, letterSpacing: '-0.01em' }}>{entry.name}</div>
          {entry.url && (
            <a href={`https://${entry.url}`} target="_blank" rel="noopener" style={{ font: '500 12px/1 var(--f-mono)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
              {entry.url} {window.Icon.external(11)}
            </a>
          )}
        </div>
        <button style={{ width: 28, height: 28, color: 'var(--ink-soft)' }} title="Editar">{window.Icon.edit(13)}</button>
      </div>

      {/* Credentials */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
        <CredRow label="Usuario" value={entry.user} mono onCopy={() => copy(entry.user, 'user')} copied={copied === 'user'} />
        <CredRow
          label="Contraseña"
          value={revealed ? realPw : fakePw}
          mono
          onCopy={() => copy(realPw, 'pw')}
          copied={copied === 'pw'}
          rightAction={
            <button onClick={() => setRevealed(v => !v)} style={{ color: 'var(--ink-soft)', padding: 4 }} title={revealed ? 'Ocultar' : 'Mostrar'}>
              {window.Icon.eye(13)}
            </button>
          }
        />
        {entry.twoFa && (
          <CredRow label="2FA · TOTP" value="328 451" mono onCopy={() => copy('328451', '2fa')} copied={copied === '2fa'} hint="Expira en 24s" />
        )}
      </div>

      {/* Notes */}
      {entry.notes && (
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>NOTAS</div>
          <div style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink)' }}>{entry.notes}</div>
        </div>
      )}

      {/* Tags */}
      {entry.tags?.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>TAGS</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {entry.tags.map(t => <U.Badge key={t} tone={t === 'crítico' ? 'danger' : 'neutral'} size="sm">{t}</U.Badge>)}
          </div>
        </div>
      )}

      {/* Sharing */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="eyebrow eyebrow-wine">VISIBILIDAD · {entry.shared.length} {entry.shared.length === 1 ? 'persona' : 'personas'}</div>
          <button style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)' }}>+ Compartir</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entry.shared.map(uid => {
            const u = D.USERS.find(x => x.id === uid);
            if (!u) return null;
            const isOwner = uid === entry.owner;
            return (
              <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)' }}>
                <U.Avatar initials={u.avatar} size={22} color={isOwner ? 'wine' : 'neutral'} />
                <span style={{ flex: 1, font: '600 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{u.name}</span>
                {isOwner ? <U.Badge tone="wine" size="sm">Owner</U.Badge> : u.role === 'Admin' ? <U.Badge tone="info" size="sm">Admin</U.Badge> : <U.Badge tone="neutral" size="sm">Ver</U.Badge>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity */}
      <div>
        <div className="eyebrow eyebrow-wine" style={{ marginBottom: 8 }}>ACTIVIDAD RECIENTE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { who: 'Carlos V.', what: 'vio la contraseña', when: 'hace 12 min' },
            { who: 'Martina A.', what: 'copió usuario',     when: 'hace 1 h' },
            { who: 'Carlos V.', what: 'actualizó la nota',   when: 'ayer 16:42' },
            { who: 'Diego N.',  what: 'fue agregado',         when: '02 may' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ink-mute)', marginTop: 6, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <b style={{ color: 'var(--ink)' }}>{a.who}</b> {a.what}
              </span>
              <span style={{ color: 'var(--ink-mute)' }}>{a.when}</span>
            </div>
          ))}
        </div>
      </div>
    </U.Card>
  );
}

function CredRow({ label, value, mono, onCopy, copied, rightAction, hint }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
        {hint && <span style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--warning)' }}>{hint}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
        <span style={{ flex: 1, font: `${mono ? '700' : '500'} 13px/1 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        {rightAction}
        <button onClick={onCopy} style={{ color: copied ? 'var(--success)' : 'var(--ink-soft)', padding: 4 }} title="Copiar">
          {copied ? window.Icon.check(13) : window.Icon.copy(13)}
        </button>
      </div>
    </div>
  );
}

function VaultEmptyDetail() {
  return (
    <div style={{
      padding: '40px 20px', textAlign: 'center',
      background: 'var(--bg-surface)', border: '1px dashed var(--border-strong)',
      borderRadius: 'var(--r-lg)',
    }}>
      <div style={{ width: 48, height: 48, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {window.Icon.shield(20)}
      </div>
      <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)' }}>Seleccioná una entrada</div>
      <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>Click en cualquier fila para ver y copiar credenciales.</div>
    </div>
  );
}

// ── Create new entry ─────────────────────────────────────────
function VaultCreate({ open, onClose }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [cat, setCat] = _vUseState('marketing');
  const [pw, setPw] = _vUseState('');
  const [showPw, setShowPw] = _vUseState(false);
  const [shared, setShared] = _vUseState(['u-001']);

  const toggleShare = (uid) => {
    setShared(shared.includes(uid) ? shared.filter(x => x !== uid) : [...shared, uid]);
  };

  return (
    <U.Drawer
      open={open} onClose={onClose}
      title="Nueva entrada de Vault"
      subtitle="Las credenciales se cifran con tu contraseña maestra."
      width={580}
      actions={
        <>
          <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          <U.Btn variant="primary" icon={window.Icon.shield(13)}>Guardar cifrado</U.Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <U.Input label="Nombre" placeholder="Ej: Instagram · @dtdcargo" />
        <U.Select label="Categoría" value={cat} onChange={(e)=>setCat(e.target.value)}
          options={VAULT_CATEGORIES.map(c => ({ value: c.id, label: c.name }))} />
        <U.Input label="URL del sitio" placeholder="ejemplo.com" mono />
        <U.Input label="Usuario / email" placeholder="usuario@dtdcargo.com" mono />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Contraseña</span>
            <button style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--wine)' }}>Generar segura →</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 38, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            <input
              type={showPw ? 'text' : 'password'}
              value={pw} onChange={(e)=>setPw(e.target.value)}
              placeholder="••••••••••••"
              style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '700 13.5px/1 var(--f-mono)', color: 'var(--ink)' }}
            />
            <button onClick={() => setShowPw(v => !v)} style={{ color: 'var(--ink-soft)', padding: 4 }}>{window.Icon.eye(13)}</button>
          </div>
          {pw && <PasswordStrength value={pw} />}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
          <input type="checkbox" style={{ accentColor: 'var(--wine)', width: 16, height: 16 }} />
          <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Esta cuenta tiene 2FA / TOTP configurado</span>
        </label>

        <U.Input label="Notas (cifradas)" placeholder="Detalles internos, contactos, links de recuperación…" style={{ minHeight: 60 }} />

        <div>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>¿QUIÉN PUEDE VER ESTA ENTRADA?</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {D.USERS.filter(u => u.status === 'active').map(u => (
              <label key={u.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', cursor: 'pointer',
              }}>
                <input type="checkbox" checked={shared.includes(u.id)} onChange={() => toggleShare(u.id)} disabled={u.role === 'Admin'} style={{ accentColor: 'var(--wine)' }} />
                <U.Avatar initials={u.avatar} size={24} color={u.role === 'Admin' ? 'wine' : 'neutral'} />
                <div style={{ flex: 1 }}>
                  <div style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{u.name}</div>
                  <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{u.role} · {u.team}</div>
                </div>
                {u.role === 'Admin' && <U.Badge tone="wine" size="sm">Admin · siempre</U.Badge>}
              </label>
            ))}
          </div>
          <div style={{ marginTop: 8, font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
            Los administradores siempre ven todas las entradas, no se puede excluir.
          </div>
        </div>
      </div>
    </U.Drawer>
  );
}

function PasswordStrength({ value }) {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const labels = ['muy débil', 'débil', 'media', 'buena', 'fuerte', 'muy fuerte'];
  const colors = ['danger', 'danger', 'warning', 'info', 'success', 'success'];
  const c = `var(--${colors[score]})`;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 4, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${(score / 5) * 100}%`, height: '100%', background: c, transition: 'width var(--dur) var(--ease)' }} />
      </div>
      <div style={{ marginTop: 6, font: '700 11px/1 var(--f-sans)', color: c, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{labels[score]}</div>
    </div>
  );
}

// ── Password generator ───────────────────────────────────────
function VaultGenerator({ open, onClose }) {
  const U = window.ERPUI;
  const [length, setLength] = _vUseState(20);
  const [opts, setOpts] = _vUseState({ upper: true, lower: true, digits: true, symbols: true, exclude: false });
  const [result, setResult] = _vUseState('Kx7$mB2qP@vN9Wf!Lz3R');
  const [copied, setCopied] = _vUseState(false);

  const generate = () => {
    let chars = '';
    if (opts.upper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (opts.lower) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (opts.digits) chars += '0123456789';
    if (opts.symbols) chars += '!@#$%^&*()_+-=[]{}<>?';
    if (opts.exclude) chars = chars.replace(/[0OoIl1]/g, '');
    if (!chars) chars = 'abc';
    let pw = '';
    for (let i = 0; i < length; i++) pw += chars[Math.floor(Math.random() * chars.length)];
    setResult(pw);
    setCopied(false);
  };

  _vUseEffect(() => { if (open) generate(); }, [open, length, opts]);

  return (
    <U.Modal open={open} onClose={onClose} title="Generador de contraseñas" width={520}
      actions={
        <>
          <U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>
          <U.Btn variant="primary" icon={window.Icon.refresh(13)} onClick={generate}>Regenerar</U.Btn>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{
          padding: '18px 20px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <code style={{ flex: 1, font: '800 18px/1.3 var(--f-mono)', color: 'var(--ink)', wordBreak: 'break-all' }}>{result}</code>
          <button onClick={() => { try { navigator.clipboard?.writeText(result); setCopied(true); setTimeout(()=>setCopied(false), 1500); } catch(e){} }} style={{
            padding: '8px 12px', background: copied ? 'var(--success)' : 'var(--wine)',
            color: '#fff', borderRadius: 'var(--r-sm)',
            font: '700 12px/1 var(--f-sans)', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {copied ? <>{window.Icon.check(13)} Copiado</> : <>{window.Icon.copy(13)} Copiar</>}
          </button>
        </div>

        <PasswordStrength value={result} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Largo</span>
            <span style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{length}</span>
          </div>
          <input type="range" min="8" max="48" value={length} onChange={(e)=>setLength(+e.target.value)} style={{ width: '100%', accentColor: 'var(--wine)' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { k: 'upper',   l: 'Mayúsculas (A-Z)' },
            { k: 'lower',   l: 'Minúsculas (a-z)' },
            { k: 'digits',  l: 'Dígitos (0-9)' },
            { k: 'symbols', l: 'Símbolos (!@#$...)' },
            { k: 'exclude', l: 'Excluir ambiguos (0/O, 1/l/I)' },
          ].map(o => (
            <label key={o.k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
              <input type="checkbox" checked={opts[o.k]} onChange={(e) => setOpts({ ...opts, [o.k]: e.target.checked })} style={{ accentColor: 'var(--wine)' }} />
              <span style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{o.l}</span>
            </label>
          ))}
        </div>
      </div>
    </U.Modal>
  );
}

// ── Export de la bóveda (.enc cifrado simulado) ─────────────
function VaultExport({ open, onClose, category }) {
  const U = window.ERPUI;
  const [scope, setScope] = _vUseState('all'); // all | category
  const [pass, setPass] = _vUseState('');
  const [done, setDone] = _vUseState(null);

  _vUseEffect(() => {
    if (open) { setDone(null); setPass(''); setScope(category === 'all' ? 'all' : 'category'); }
  }, [open]);

  const catName = VAULT_CATEGORIES.find(c => c.id === category)?.name;
  const rows = (scope === 'category' && category !== 'all')
    ? VAULT_ENTRIES.filter(e => e.cat === category) : VAULT_ENTRIES;

  const doExport = () => {
    const payload = {
      meta: { app: 'DTD-Vault', version: '2.0', exported: new Date().toISOString(), scope, entries: rows.length, cipher: 'AES-256-GCM (sim)' },
      data: rows.map(e => ({ id: e.id, name: e.name, cat: e.cat, user: e.user, url: e.url, twoFa: e.twoFa, strength: e.strength, updated: e.updated, tags: e.tags, secret: '«cifrado»' })),
    };
    const json = JSON.stringify(payload);
    const key = pass || 'dtd-master-key';
    // XOR + base64 → simula un blob cifrado (no es criptografía real)
    let scrambled = '';
    for (let i = 0; i < json.length; i++) scrambled += String.fromCharCode(json.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    const b64 = btoa(unescape(encodeURIComponent(scrambled)));
    const lines = b64.match(/.{1,64}/g) || [b64];
    const text = [
      '-----BEGIN DTD-VAULT ENCRYPTED EXPORT-----',
      `Version: 2.0   Cipher: AES-256-GCM (sim)   Entries: ${rows.length}`,
      `Exported: ${new Date().toISOString()}`,
      `Scope: ${scope === 'category' && category !== 'all' ? catName : 'Toda la bóveda'}`,
      '',
      ...lines,
      '-----END DTD-VAULT ENCRYPTED EXPORT-----',
      '',
    ].join('\n');
    const fname = `dtd-vault-${scope === 'category' && category !== 'all' ? category : 'full'}-${new Date().toISOString().slice(0, 10)}.enc`;
    try {
      const blob = new Blob([text], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fname;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {}
    setDone({ count: rows.length, name: fname });
  };

  return (
    <U.Modal open={open} onClose={onClose} title="Exportar bóveda" width={500}
      actions={done
        ? <U.Btn variant="primary" onClick={onClose}>Listo</U.Btn>
        : <><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={window.Icon.download(13)} onClick={doExport}>Exportar .enc</U.Btn></>
      }
    >
      {done ? (
        <div style={{ textAlign: 'center', padding: '12px 8px 8px' }}>
          <div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'grid', placeItems: 'center' }}>{window.Icon.check(26)}</div>
          <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)' }}>Bóveda exportada</div>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: '40ch', marginInline: 'auto' }}>
            {done.count} entradas cifradas en el archivo descargado.
          </div>
          <code style={{ display: 'inline-block', marginTop: 12, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{done.name}</code>
          <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--warning-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10, textAlign: 'left' }}>
            <span style={{ color: 'var(--warning)', marginTop: 1 }}>{window.Icon.warn(13)}</span>
            <div style={{ font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
              Guardá el <code style={{ font: '700 11px/1 var(--f-mono)' }}>.enc</code> en un lugar seguro. Solo se puede restaurar con la misma passphrase.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '12px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
            <span style={{ color: 'var(--info)', marginTop: 1 }}>{window.Icon.shield(14)}</span>
            <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
              Genera un archivo <code style={{ font: '700 11px/1 var(--f-mono)' }}>.enc</code> cifrado con tus credenciales. Para backup offline o migración a otra bóveda.
            </div>
          </div>

          <div>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Qué exportar</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['all', 'Toda la bóveda', VAULT_ENTRIES.length], ['category', catName || 'Categoría actual', VAULT_ENTRIES.filter(e => e.cat === category).length]].map(([k, l, n]) => {
                const disabled = k === 'category' && category === 'all';
                const a = scope === k;
                return (
                  <button key={k} disabled={disabled} onClick={() => setScope(k)} style={{
                    flex: 1, padding: '12px 14px', textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
                    background: a ? 'var(--wine-tint)' : 'var(--bg-elevated)',
                    border: `1px solid ${a ? 'var(--wine)' : 'var(--border)'}`,
                    borderRadius: 'var(--r-md)', opacity: disabled ? 0.45 : 1,
                  }}>
                    <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: a ? 'var(--wine)' : 'var(--ink)' }}>{l}</div>
                    <div style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 5 }}>{disabled ? 'elegí una categoría' : `${n} entradas`}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Passphrase de cifrado (opcional)</span>
            <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Dejala vacía para usar tu clave maestra"
              style={{ height: 42, padding: '0 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '600 13.5px/1 var(--f-mono)', color: 'var(--ink)', outline: 'none' }} />
            <span style={{ font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>Necesaria para restaurar el archivo. Si la perdés, el .enc es irrecuperable.</span>
          </label>
        </div>
      )}
    </U.Modal>
  );
}

window.ModuleVault = ModuleVault;
