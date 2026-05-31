/* global React */
/* ── DTD ERP · Shell (sidebar + topbar + router) ────────────── */

const { useState, useEffect, useRef, useMemo } = React;

// ── Modules registry ──────────────────────────────────────────
// Each module renders itself; the shell just hosts them.
const MODULES = [
  { id: 'dashboard',  group: 'OPERACIÓN',  label: 'Dashboard',      icon: 'dashboard' },
  { id: 'shipments',  group: 'OPERACIÓN',  label: 'Embarques',      icon: 'box',       badge: '24' },
  { id: 'tracking',   group: 'OPERACIÓN',  label: 'Tracking',       icon: 'radar' },
  { id: 'calendar',   group: 'OPERACIÓN',  label: 'Calendario',     icon: 'clock' },
  { id: 'cn',         group: 'OPERACIÓN',  label: 'Almacén CN',     icon: 'warehouse' },
  { id: 'qrqueue',    group: 'OPERACIÓN',  label: 'Cola de QR',     icon: 'tag' },
  { id: 'labels',     group: 'OPERACIÓN',  label: 'Etiquetas CN',   icon: 'tag' },
  { id: 've',         group: 'OPERACIÓN',  label: 'Almacén VE',     icon: 'warehouse' },
  { id: 'despacho',   group: 'OPERACIÓN',  label: 'Despacho',       icon: 'truck' },
  { id: 'despacho-rules', group: 'OPERACIÓN', label: 'Reglas de despacho', icon: 'cog' },
  { id: 'despacho-dashboard', group: 'OPERACIÓN', label: 'Dashboard despacho', icon: 'chart' },
  { id: 'seniat',     group: 'OPERACIÓN',  label: 'Aduana SENIAT',  icon: 'shield' },
  { id: 'tms',        group: 'OPERACIÓN',  label: 'TMS · Transporte', icon: 'truck' },

  { id: 'quotes',     group: 'COMERCIAL',  label: 'Cotizador',      icon: 'calc' },
  { id: 'clients',    group: 'COMERCIAL',  label: 'Clientes',       icon: 'users',     badge: '187' },
  { id: 'leads',      group: 'COMERCIAL',  label: 'CRM · Leads',    icon: 'spark' },
  { id: 'suppliers',  group: 'COMERCIAL',  label: 'Proveedores CN', icon: 'cn' },
  { id: 'rates',      group: 'COMERCIAL',  label: 'Tarifas',        icon: 'tag' },

  { id: 'invoices',   group: 'FINANZAS',   label: 'Facturación',    icon: 'invoice',   badge: '4' },
  { id: 'contab',     group: 'FINANZAS',   label: 'Contabilidad',   icon: 'invoice' },
  { id: 'reconcile',  group: 'FINANZAS',   label: 'Conciliación bancaria', icon: 'check' },
  { id: 'documents',  group: 'FINANZAS',   label: 'Documentos',     icon: 'doc' },
  { id: 'reports',    group: 'FINANZAS',   label: 'Reportes',       icon: 'chart' },
  { id: 'costing',    group: 'FINANZAS',   label: 'Costing & Margen', icon: 'star' },

  { id: 'mailing',    group: 'SISTEMA',    label: 'Mailing',        icon: 'mail' },
  { id: 'vault',      group: 'SISTEMA',    label: 'Vault',          icon: 'lock' },
  { id: 'audit-log',  group: 'SISTEMA',    label: 'Audit log',      icon: 'eye' },
  { id: 'users',      group: 'SISTEMA',    label: 'Usuarios',       icon: 'shield' },
  { id: 'operarios',  group: 'SISTEMA',    label: 'Operarios PWA',  icon: 'users' },
  { id: 'admin',      group: 'SISTEMA',    label: 'Administración', icon: 'cog' },
];

// Logo (compact for sidebar)
function DTDLogo({ collapsed = false, dark = true }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <img src="assets/dtdcargo-icon-navy.png" alt="DTD-Cargo"
        style={{
          width: collapsed ? 28 : 30, height: collapsed ? 28 : 30, objectFit: 'contain',
          filter: dark ? 'brightness(0) invert(1)' : 'none',
          flexShrink: 0,
        }}
      />
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ font: '900 17px/1 var(--f-display)', letterSpacing: '-0.02em' }}>
            <span style={{ color: dark ? '#C2747F' : 'var(--wine)' }}>DTD</span>
            <span style={{ color: dark ? '#fff' : 'var(--ink)' }}>STUDIO</span>
          </span>
          <span style={{ font: '600 9.5px/1 var(--f-sans)', color: dark ? 'rgba(255,255,255,0.55)' : 'var(--ink-soft)', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4 }}>
            ERP · v1.8
          </span>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────
function Sidebar({ active, onSelect, collapsed, onToggleCollapse, currentUser }) {
  // Re-render when feature flags change
  const [flags] = (window.DTDFlags?.useFeatureFlags?.()) || [{}, null, null];
  const flagMap = window.MODULE_FLAG_MAP || {};
  const allowedModules = currentUser && currentUser.role !== 'Admin'
    ? (window.ERPData.ROLE_MODULES[currentUser.role] || ['dashboard'])
    : '*';
  const isAllowed = (id) => {
    if (allowedModules !== '*' && !allowedModules.includes(id)) return false;
    const flag = flagMap[id];
    if (flag && !flags[flag]) return false;
    return true;
  };

  // Estado de grupos plegados (persistido en localStorage)
  const [openGroups, setOpenGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dtd-sidebar-groups') || '{}'); } catch (e) { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem('dtd-sidebar-groups', JSON.stringify(openGroups)); } catch (e) {}
  }, [openGroups]);

  const grouped = useMemo(() => {
    const map = new Map();
    MODULES.filter(m => isAllowed(m.id)).forEach(m => {
      if (!map.has(m.group)) map.set(m.group, []);
      map.get(m.group).push(m);
    });
    return [...map.entries()];
  }, [currentUser, flags]);

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: collapsed ? 'var(--sb-collapsed)' : 'var(--sb-expanded)',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-side)',
      display: 'flex', flexDirection: 'column', zIndex: 50,
      transition: 'width var(--dur) var(--ease)',
      overflow: 'hidden',
    }}>
      {/* Logo + top collapse button */}
      <div style={{
        height: 'var(--topbar-h)', padding: collapsed ? '0' : '0 12px 0 16px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 8,
        borderBottom: '1px solid var(--border-side)',
        position: 'relative',
        cursor: collapsed ? 'pointer' : 'default',
      }}
      onClick={collapsed ? onToggleCollapse : undefined}
      title={collapsed ? 'Expandir sidebar' : undefined}
      >
        <DTDLogo collapsed={collapsed} />
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            title="Colapsar sidebar"
            style={{
              width: 26, height: 26, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r-sm)',
              color: 'var(--ink-side-soft)',
              background: 'rgba(255,255,255,0.04)',
              transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = 'var(--ink-side-soft)'; }}
          >
            <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}>{window.Icon.chevR(13)}</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {grouped.map(([group, items]) => {
          const open = !collapsed && openGroups[group] !== false;
          return (
          <div key={group} style={{ marginBottom: 6 }}>
            {!collapsed && (
              <button
                onClick={() => setOpenGroups({ ...openGroups, [group]: !open })}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 10px 6px',
                  font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-side-soft)',
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  background: 'transparent', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-side-soft)'; }}
              >
                <span>{group}</span>
                <span style={{ transform: `rotate(${open ? 0 : -90}deg)`, transition: 'transform var(--dur-fast) var(--ease)' }}>{window.Icon.chevD(11)}</span>
              </button>
            )}
            {(collapsed || open) && items.map(m => {
              const isActive = active === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => onSelect(m.id)}
                  title={collapsed ? m.label : undefined}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: collapsed ? '10px 0' : '9px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    background: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--ink-side)',
                    borderRadius: 'var(--r-md)',
                    font: '500 13px/1 var(--f-sans)',
                    position: 'relative',
                    transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-sidebar-hover)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {isActive && !collapsed && (
                    <span style={{
                      position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
                      background: 'var(--wine-soft)', borderRadius: 2,
                    }} />
                  )}
                  <span style={{ color: isActive ? 'var(--wine-soft)' : 'var(--ink-side-soft)', flexShrink: 0, display: 'inline-flex' }}>
                    {window.Icon[m.icon]?.(18)}
                  </span>
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1, textAlign: 'left' }}>{m.label}</span>
                      {m.badge && (
                        <span style={{
                          padding: '2px 7px', borderRadius: 'var(--r-sm)',
                          background: isActive ? 'rgba(216,154,164,0.2)' : 'rgba(255,255,255,0.08)',
                          color: isActive ? 'var(--wine-soft)' : 'var(--ink-side-soft)',
                          font: '700 10.5px/1.3 var(--f-sans)',
                        }}>{m.badge}</span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
          );
        })}
      </nav>

      {/* Footer: collapse toggle + user */}
      <div style={{
        padding: collapsed ? '12px 8px' : '12px 14px',
        borderTop: '1px solid var(--border-side)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <button
          onClick={onToggleCollapse}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px', borderRadius: 'var(--r-md)',
            color: 'var(--ink-side-soft)',
            background: 'rgba(255,255,255,0.04)',
            font: '500 12px/1 var(--f-sans)',
          }}
        >
          <span style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', display: 'inline-flex', transition: 'transform var(--dur) var(--ease)' }}>
            {window.Icon.chevR(14)}
          </span>
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
    </aside>
  );
}

// ── Topbar ───────────────────────────────────────────────────
function Topbar({ moduleLabel, onSearchFocus, onThemeToggle, theme, notifications, onTweaksToggle, currentUser, onSwitchUser }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [langTick, setLangTick] = useState(0);
  const [userOpen, setUserOpen] = useState(false);
  const notifRef = useRef(null);
  const userRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <header style={{
      position: 'sticky', top: 0,
      height: 'var(--topbar-h)',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '0 var(--s-6)',
      zIndex: 40,
    }}>
      {/* Module label */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Módulo</span>
        <span style={{ font: '900 16px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{moduleLabel}</span>
      </div>

      {/* Search */}
      <div style={{ flex: 1, maxWidth: 520, marginLeft: 24 }}>
        <button
          onClick={onSearchFocus}
          style={{
            width: '100%', height: 36, padding: '0 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            color: 'var(--ink-mute)',
            font: '500 13px/1 var(--f-sans)',
            textAlign: 'left',
          }}
        >
          {window.Icon.search(14)}
          <span style={{ flex: 1 }}>Buscar embarques, clientes, MARKBOX…</span>
          <kbd style={{
            padding: '2px 6px', borderRadius: 4,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            font: '600 10px/1.3 var(--f-mono)', color: 'var(--ink-soft)',
          }}>⌘ K</kbd>
        </button>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Language toggle · ES / 中文 (global) */}
        <button
          onClick={() => { window.DTDTranslate?.toggle(); setLangTick(t => t + 1); }}
          title="翻译成中文 · Traducir al chino simplificado"
          data-no-translate
          style={{
            height: 36, padding: '0 12px', borderRadius: 'var(--r-md)',
            display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border)', cursor: 'pointer',
            background: (window.DTDTranslate?.isActive?.()) ? 'var(--wine)' : 'transparent',
            color: (window.DTDTranslate?.isActive?.()) ? '#fff' : 'var(--ink-soft)',
            font: '800 13px/1 var(--f-sans)', transition: 'all 120ms',
          }}
        >{(window.DTDTranslate?.isActive?.()) ? 'ES' : '中文'}</button>
        {/* Theme toggle */}
        <button onClick={onThemeToggle} title="Cambiar tema" style={{
          width: 36, height: 36, borderRadius: 'var(--r-md)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--ink-soft)',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {theme === 'dark' ? window.Icon.sun(16) : window.Icon.moon(16)}
        </button>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button onClick={() => setNotifOpen(v => !v)} style={{
            width: 36, height: 36, borderRadius: 'var(--r-md)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-soft)', position: 'relative',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {window.Icon.bell(16)}
            {notifications && notifications.length > 0 && (
              <span style={{
                position: 'absolute', top: 8, right: 8,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--wine)',
                border: '2px solid var(--bg-surface)',
              }} />
            )}
          </button>
          {notifOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 340, background: 'var(--bg-surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-lg)', zIndex: 70,
              animation: 'erp-pop 200ms var(--ease)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ font: '800 13px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Notificaciones</div>
                <a style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', cursor: 'pointer' }}>Marcar leídas</a>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.map(n => (
                  <div key={n.id} style={{
                    padding: '12px 18px', borderBottom: '1px solid var(--border)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                      background: n.tone === 'wine' ? 'var(--wine)' : n.tone === 'success' ? 'var(--success)' : n.tone === 'warning' ? 'var(--warning)' : 'var(--info)',
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ font: '600 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{n.t}</div>
                      <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{n.m}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div ref={userRef} style={{ position: 'relative', marginLeft: 6 }}>
          <button onClick={() => setUserOpen(v => !v)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '4px 10px 4px 4px', borderRadius: 'var(--r-pill)',
            background: 'var(--bg-elevated)',
          }}>
            <window.ERPUI.Avatar initials={currentUser?.avatar || 'CV'} size={28} />
            <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{currentUser?.name?.split(' ')[0] || 'Carlos V.'}</span>
            <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{window.Icon.chevD(12)}</span>
          </button>
          {userOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: 280, background: 'var(--bg-surface)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-lg)',
              boxShadow: 'var(--shadow-lg)', zIndex: 70,
              animation: 'erp-pop 200ms var(--ease)', overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ font: '800 13px/1.2 var(--f-display)', color: 'var(--ink)' }}>{currentUser?.name || 'Carlos Vásquez'}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{currentUser?.email || 'cvasquez@dtdcargo.com'}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <window.ERPUI.Badge tone={currentUser?.role === 'Admin' ? 'wine' : 'info'} size="sm">{currentUser?.role || 'Admin'}</window.ERPUI.Badge>
                  {currentUser?.scope?.type === 'scoped' && (
                    <window.ERPUI.Badge tone="warning" size="sm">Scope: {currentUser.scope.hubs.join(', ')}</window.ERPUI.Badge>
                  )}
                </div>
              </div>
              <div style={{ padding: 6 }}>
                {[
                  { label: 'Mi perfil',         action: () => window.DTDWiring?.openProfileModal({ tab: 'profile' }) },
                  { label: 'Cambiar contraseña', action: () => window.DTDWiring?.openProfileModal({ tab: 'password' }) },
                  { label: 'Preferencias',      action: () => window.DTDWiring?.openProfileModal({ tab: 'prefs' }) },
                  { label: 'Atajos de teclado', action: () => window.DTDWiring?.openShortcutsModal() },
                ].map(it => (
                  <button key={it.label}
                    onClick={() => { it.action(); setUserOpen(false); }}
                    style={{
                      width: '100%', textAlign: 'left',
                      padding: '8px 10px', borderRadius: 'var(--r-sm)',
                      font: '500 13px/1 var(--f-sans)', color: 'var(--ink)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >{it.label}</button>
                ))}
              </div>
              {/* View as switcher (admin only) */}
              <div style={{ padding: '8px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <div style={{ padding: '4px 10px 8px', font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>VER COMO… (demo scope)</div>
                {window.ERPData.USERS.filter(u => u.status === 'active').map(u => {
                  const active = currentUser?.id === u.id;
                  return (
                    <button key={u.id} onClick={() => { onSwitchUser(u); setUserOpen(false); }} style={{
                      width: '100%', textAlign: 'left',
                      padding: '6px 10px', borderRadius: 'var(--r-sm)',
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: active ? 'var(--wine-tint)' : 'transparent',
                      color: active ? 'var(--wine)' : 'var(--ink)',
                      font: `${active ? '700' : '500'} 12px/1 var(--f-sans)`,
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <window.ERPUI.Avatar initials={u.avatar} size={20} color={u.role === 'Admin' ? 'wine' : 'neutral'} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                      <span style={{ font: '600 10px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{u.role.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: '6px 8px', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => { if (window.confirm('¿Cerrar sesión?')) { window.location.reload(); } }} style={{ width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--r-sm)', font: '600 13px/1 var(--f-sans)', color: 'var(--danger)', cursor: 'pointer' }}>Cerrar sesión</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Command palette (⌘K) ─────────────────────────────────────
function CommandPalette({ open, onClose, modules, onSelect }) {
  const [q, setQ] = useState('');
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else setQ('');
  }, [open]);

  const results = useMemo(() => {
    const data = window.ERPData;
    const list = [];
    modules.forEach(m => list.push({ kind: 'mod', label: m.label, sub: m.group, action: () => onSelect(m.id), icon: m.icon }));
    data.SHIPMENTS.slice(0, 30).forEach(s => list.push({ kind: 'ship', label: s.id, sub: `${s.clientName} · ${data.origin(s.origin).name} → ${data.dest(s.destination).name}`, action: () => onSelect('shipments', s.id), icon: 'box' }));
    data.CLIENTS.slice(0, 30).forEach(c => list.push({ kind: 'cli', label: `${c.markbox} · ${c.company}`, sub: c.city, action: () => onSelect('clients', c.markbox), icon: 'users' }));
    if (!q) return list.slice(0, 8);
    const qq = q.toLowerCase();
    return list.filter(r => r.label.toLowerCase().includes(qq) || (r.sub && r.sub.toLowerCase().includes(qq))).slice(0, 12);
  }, [q, modules, onSelect]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && results[0]) { results[0].action(); onClose(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, results]);

  if (!open) return null;
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,30,61,0.5)', backdropFilter: 'blur(4px)',
      zIndex: 120, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 560,
        background: 'var(--bg-surface)', borderRadius: 'var(--r-xl)',
        border: '1px solid var(--border)', boxShadow: 'var(--shadow-pop)',
        overflow: 'hidden', animation: 'erp-pop 200ms var(--ease)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ color: 'var(--ink-mute)' }}>{window.Icon.search(18)}</span>
          <input
            ref={inputRef}
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar módulo, embarque, cliente, MARKBOX…"
            style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', font: '500 15px/1 var(--f-sans)', color: 'var(--ink)' }}
          />
          <kbd style={{ padding: '3px 7px', borderRadius: 4, background: 'var(--bg-elevated)', font: '600 10.5px/1.3 var(--f-mono)', color: 'var(--ink-soft)' }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: 8 }}>
          {results.length === 0 ? (
            <div style={{ padding: '40px 18px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin resultados.</div>
          ) : results.map((r, i) => (
            <button key={i} onClick={() => { r.action(); onClose(); }} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 'var(--r-md)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ color: 'var(--wine)', flexShrink: 0 }}>{window.Icon[r.icon]?.(16)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 13.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
              </div>
              <span style={{
                font: '700 10.5px/1.2 var(--f-sans)', color: 'var(--ink-mute)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>{r.kind === 'mod' ? 'IR' : r.kind === 'ship' ? 'EMBARQUE' : 'CLIENTE'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main shell wrapper ──────────────────────────────────────
function Shell({ initialModule = 'dashboard', children }) {
  const moduleLabel = MODULES.find(m => m.id === window.__erpState?.module)?.label || 'Dashboard';
  return null; // unused, App handles layout
}

window.ERPShell = { MODULES, Sidebar, Topbar, CommandPalette, DTDLogo };
