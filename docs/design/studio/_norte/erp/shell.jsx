/* global React */
/* ── DTD ERP · Shell (sidebar + topbar + router) ────────────── */

const { useState, useEffect, useRef, useMemo } = React;

// ── Modules registry ──────────────────────────────────────────
// Each module renders itself; the shell just hosts them.
const MODULES = [
  { id: 'inicio',     group: 'INICIO',     label: 'Flujo de trabajo', icon: 'flow' },
  { id: 'mapa-proceso', group: 'INICIO',   label: 'Mapa de proceso',  icon: 'map' },
  { id: 'direccion',  group: 'INICIO',     label: 'Tablero ejecutivo', icon: 'gauge' },

  { id: 'dashboard',  group: 'OPERACIÓN',  label: 'Dashboard',      icon: 'dashboard' },
  { id: 'shipments',  group: 'OPERACIÓN',  label: 'Embarques',      icon: 'box',       badge: '24' },
  { id: 'tracking',   group: 'OPERACIÓN',  label: 'Tracking',       icon: 'radar' },
  { id: 'naviera',    group: 'OPERACIÓN',  label: 'Naviera & Consol.', icon: 'ship' },
  { id: 'calendar',   group: 'OPERACIÓN',  label: 'Calendario',     icon: 'calendar' },
  { id: 'cn',         group: 'OPERACIÓN',  label: 'Almacén CN',     icon: 'warehouse', parent: 'almacenes' },
  { id: 'qrqueue',    group: 'OPERACIÓN',  label: 'Cola de QR',     icon: 'qr',        parent: 'almacenes' },
  { id: 'labels',     group: 'OPERACIÓN',  label: 'Etiquetas CN',   icon: 'tag',       parent: 'almacenes' },
  { id: 've',         group: 'OPERACIÓN',  label: 'Almacén VE',     icon: 'warehouse', parent: 'almacenes' },
  { id: 'despacho',   group: 'OPERACIÓN',  label: 'Despacho',       icon: 'truck',     parent: 'despachogrp' },
  { id: 'despacho-rules', group: 'OPERACIÓN', label: 'Reglas',      icon: 'sliders',   parent: 'despachogrp' },
  { id: 'despacho-dashboard', group: 'OPERACIÓN', label: 'Métricas', icon: 'barchart', parent: 'despachogrp' },
  { id: 'seniat',     group: 'OPERACIÓN',  label: 'Aduana SENIAT',  icon: 'shield' },
  { id: 'tms',        group: 'OPERACIÓN',  label: 'TMS · Transporte', icon: 'route' },

  { id: 'estimados',     group: 'COMERCIAL',  label: 'Estimador',      icon: 'calc' },
  { id: 'clients',    group: 'COMERCIAL',  label: 'Clientes',       icon: 'users',     badge: '187' },
  { id: 'conversaciones', group: 'COMERCIAL', label: 'Conversaciones', icon: 'chat',    badge: '5' },
  { id: 'leads',      group: 'COMERCIAL',  label: 'CRM · Leads',    icon: 'spark' },
  { id: 'fidelizacion', group: 'COMERCIAL', label: 'Fidelización',  icon: 'star' },
  { id: 'suppliers',  group: 'COMERCIAL',  label: 'Proveedores CN', icon: 'cn' },
  { id: 'rates',      group: 'COMERCIAL',  label: 'Servicios y Tarifas', icon: 'tag' },

  { id: 'invoices',   group: 'FINANZAS',   label: 'Facturación',    icon: 'invoice',   badge: '4' },
  { id: 'cobranzas',  group: 'FINANZAS',   label: 'Cobranzas',      icon: 'cash' },
  { id: 'contab',     group: 'FINANZAS',   label: 'Contabilidad',   icon: 'ledger' },
  { id: 'nomina',     group: 'FINANZAS',   label: 'Nómina',         icon: 'idcard' },
  { id: 'tesoreria',  group: 'FINANZAS',   label: 'Tesorería',      icon: 'wallet' },
  { id: 'reconcile',  group: 'FINANZAS',   label: 'Conciliación',   icon: 'reconcile' },
  { id: 'documents',  group: 'FINANZAS',   label: 'Documentos',     icon: 'doc' },
  { id: 'reports',    group: 'FINANZAS',   label: 'Reportes',       icon: 'chart' },
  { id: 'costing',    group: 'FINANZAS',   label: 'Costing & margen', icon: 'margin' },

  { id: 'mailing',    group: 'SISTEMA',    label: 'Mailing',        icon: 'mail' },
  { id: 'vault',      group: 'SISTEMA',    label: 'Vault',          icon: 'lock' },
  { id: 'audit-log',  group: 'SISTEMA',    label: 'Audit log',      icon: 'eye' },
  { id: 'users',      group: 'SISTEMA',    label: 'Usuarios',       icon: 'idcard' },
  { id: 'operarios',  group: 'SISTEMA',    label: 'Operarios PWA',  icon: 'hardhat' },
  { id: 'admin',      group: 'SISTEMA',    label: 'Administración', icon: 'cog' },
];

// ── Sub-grupos (parents anidados dentro de un grupo) ──────────
// Colapsan clusters solapados sin tocar el routing: los hijos
// siguen siendo módulos normales, solo cambia su presentación.
const PARENTS = {
  almacenes:   { id: 'almacenes',   label: 'Almacenes', icon: 'warehouse' },
  despachogrp: { id: 'despachogrp', label: 'Despacho',  icon: 'truck' },
};

// Logo (compact for sidebar)
function DTDLogo({ collapsed = false, dark = true }) {
  const sz = collapsed ? 28 : 30;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="dtd-iso dtd-iso-auto" style={{ width: sz, height: sz }}>
        <img className="iso-primary" src="assets/dtdcargo-isologo-primary.png" alt="DTD-Cargo" />
        <img className="iso-reverse" src="assets/dtdcargo-isologo-reverse.png" alt="" />
      </span>
      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ font: '900 17px/1 var(--f-display)', letterSpacing: '-0.02em' }}>
            <span style={{ color: 'var(--nav-brand)' }}>DTD</span>
            <span style={{ color: 'var(--ink-nav)' }}>STUDIO</span>
          </span>
          <span style={{ font: '600 9.5px/1 var(--f-sans)', color: 'var(--ink-nav-soft)', letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 4 }}>
            ERP · v2.5
          </span>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────
function CreateButton({ collapsed, onSelect, currentUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // Frecuentes · aprende los ítems más usados (persistido por usuario)
  const freqKey = 'dtd-create-freq-' + (currentUser?.id || 'anon');
  const [freq, setFreq] = useState(() => {
    try { return JSON.parse(localStorage.getItem(freqKey) || '{}'); } catch { return {}; }
  });
  const itemIndex = useMemo(() => {
    const ix = {};
    CREATE_GROUPS.forEach(col => col.items.forEach(([label, mod, kind]) => { ix[label] = [mod, kind]; }));
    return ix;
  }, []);

  // Filtrado por rol · reusa ROLE_MODULES (misma fuente que el sidebar)
  const allowedModules = currentUser && currentUser.role !== 'Admin'
    ? (window.ERPData.ROLE_MODULES[currentUser.role] || ['dashboard'])
    : '*';
  const canCreate = (mod) => {
    if (mod === '__tudia') return true;
    if (allowedModules === '*') return true;
    return allowedModules.includes(mod);
  };
  const visibleGroups = useMemo(() =>
    CREATE_GROUPS
      .map(col => ({ ...col, items: col.items.filter(([, mod]) => canCreate(mod)) }))
      .filter(col => col.items.length > 0),
    [currentUser]);
  const topFreq = useMemo(() =>
    Object.entries(freq)
      .filter(([label]) => itemIndex[label] && canCreate(itemIndex[label][0]))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label]) => label),
    [freq, currentUser]);

  const run = (mod, kind, label) => {
    setOpen(false);
    if (label) {
      setFreq(prev => {
        const next = { ...prev, [label]: (prev[label] || 0) + 1 };
        try { localStorage.setItem(freqKey, JSON.stringify(next)); } catch {}
        return next;
      });
    }
    if (mod === '__tudia') { window.__erpOverlay && window.__erpOverlay('tudia', { userId: currentUser?.id || 'u-001' }); return; }
    if (CATALOG_KINDS.includes(kind)) {
      onSelect && onSelect(mod);
      setTimeout(() => window.dispatchEvent(new CustomEvent('dtd-create-catalog', { detail: kind })), 60);
      return;
    }
    onSelect && onSelect(mod);
  };

  return (
    <div ref={ref} style={{ position: 'sticky', top: 0, zIndex: 3, background: 'var(--bg-nav)', padding: '12px 0 10px', marginBottom: 2 }}>
      <button onClick={() => setOpen(v => !v)} title="Crear · se adapta a tu rol"
        style={{ width: collapsed ? 40 : '100%', height: 40, margin: collapsed ? '0 auto' : 0, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 9, padding: collapsed ? 0 : '0 14px', borderRadius: collapsed ? '50%' : 'var(--r-pill)', border: 'none', cursor: 'pointer', background: 'var(--wine)', color: '#fff', font: '800 13px/1 var(--f-sans)', boxShadow: '0 1px 2px rgba(127,15,26,.3), 0 8px 18px -8px rgba(127,15,26,.55)', transition: 'background var(--dur-fast) var(--ease)' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-deep)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--wine)'}>
        <span style={{ font: '800 19px/1 var(--f-sans)', marginTop: -1 }}>+</span>{!collapsed && <span>Crear</span>}
      </button>
      {open && (
        <div style={{ position: 'fixed', left: collapsed ? 74 : 248, top: 60, width: 460, maxHeight: 'calc(100vh - 90px)', overflowY: 'auto', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)', zIndex: 80, padding: 16, animation: 'erp-pop 160ms var(--ease)' }}>
          {topFreq.length > 0 && (
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              <div style={{ font: '800 9px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)', margin: '0 0 8px' }}>Frecuentes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {topFreq.map(label => {
                  const [mod, kind] = itemIndex[label];
                  return (
                    <button key={label} onClick={() => run(mod, kind, label)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', cursor: 'pointer', padding: '6px 11px 6px 9px', borderRadius: 'var(--r-pill)', font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--wine)'; e.currentTarget.style.color = 'var(--wine)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink)'; }}>
                      <span style={{ color: 'var(--wine)', font: '800 13px/1 var(--f-sans)' }}>+</span>{label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 16px' }}>
            {visibleGroups.map(col => (
              <div key={col.g}>
                <div style={{ font: '800 9px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wine)', margin: '8px 0 4px' }}>{col.g}</div>
                {col.items.map(([label, mod, kind]) => (
                  <button key={label} onClick={() => run(mod, kind, label)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', border: 'none', background: 'transparent', cursor: 'pointer', font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', borderRadius: 'var(--r-sm)' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-tint)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ color: 'var(--wine)', font: '800 14px/1 var(--f-sans)' }}>+</span>{label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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

  // ── Acordeón: UN solo grupo abierto a la vez (reduce ruido visual) ──
  const activeGroup = (MODULES.find(m => m.id === active) || {}).group;
  const [openGroup, setOpenGroup] = useState(() => {
    try { return localStorage.getItem('dtd-sidebar-opengroup') || activeGroup || 'INICIO'; }
    catch (e) { return activeGroup || 'INICIO'; }
  });
  useEffect(() => {
    try { localStorage.setItem('dtd-sidebar-opengroup', openGroup || ''); } catch (e) {}
  }, [openGroup]);

  // Ancho del sidebar ajustable con el mouse · escribe la var CSS (contenido se sincroniza)
  // Límite: 200px (el label más largo aún entra en 1 línea) … 280px.
  const SB_MIN = 200, SB_MAX = 280;
  useEffect(() => {
    try { const w = parseInt(localStorage.getItem('dtd-sb-w') || '', 10);
      if (w >= SB_MIN && w <= SB_MAX) document.documentElement.style.setProperty('--sb-expanded', w + 'px'); } catch (e) {}
  }, []);
  const startResize = (e) => {
    e.preventDefault();
    const aside = document.querySelector('aside');
    if (aside) aside.style.transition = 'none';
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    const move = (ev) => {
      const w = Math.max(SB_MIN, Math.min(SB_MAX, Math.round(ev.clientX)));
      document.documentElement.style.setProperty('--sb-expanded', w + 'px');
    };
    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (aside) aside.style.transition = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem('dtd-sb-w', String(parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sb-expanded'), 10) || 248)); } catch (e) {}
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  };
  // Al navegar a un módulo, abrir su grupo (y colapsar los demás).
  useEffect(() => { if (activeGroup) setOpenGroup(activeGroup); }, [activeGroup]);

  const grouped = useMemo(() => {
    const allowed = MODULES.filter(m => isAllowed(m.id));
    const byGroup = new Map();
    allowed.forEach(m => {
      if (!byGroup.has(m.group)) byGroup.set(m.group, []);
      byGroup.get(m.group).push(m);
    });
    // Construir unidades ordenadas: leaf (módulo suelto) o parent (cluster anidado)
    const result = [];
    for (const [group, items] of byGroup) {
      const units = [];
      const emitted = new Set();
      items.forEach(m => {
        if (m.parent && PARENTS[m.parent]) {
          if (!emitted.has(m.parent)) {
            emitted.add(m.parent);
            units.push({ type: 'parent', parent: PARENTS[m.parent], children: items.filter(x => x.parent === m.parent) });
          }
        } else {
          units.push({ type: 'leaf', mod: m });
        }
      });
      result.push([group, units]);
    }
    return result;
  }, [currentUser, flags]);

  // Render de un ítem-hoja (módulo). indent = sangría px para hijos anidados.
  const renderLeaf = (m, indent = 0) => {
    const isActive = active === m.id;
    return (
      <button
        key={m.id}
        onClick={() => m.href ? window.open(m.href, '_blank') : onSelect(m.id)}
        title={collapsed ? m.label : undefined}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: collapsed ? '10px 0' : `8px 12px 8px ${12 + indent}px`,
          justifyContent: collapsed ? 'center' : 'flex-start',
          background: isActive ? 'var(--bg-nav-active)' : 'transparent',
          color: isActive ? 'var(--ink-nav-active)' : 'var(--ink-nav)',
          borderRadius: 'var(--r-md)',
          font: `500 ${indent ? '12.5' : '13'}px/1 var(--f-sans)`,
          position: 'relative',
          transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-nav-hover)'; }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        {isActive && !collapsed && (
          <span style={{ position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, background: 'var(--wine)', borderRadius: 2 }} />
        )}
        <span style={{ color: isActive ? 'var(--wine)' : 'var(--ink-nav-soft)', flexShrink: 0, display: 'inline-flex' }}>
          {window.Icon[m.icon]?.(indent ? 16 : 18)}
        </span>
        {!collapsed && (
          <>
            <span style={{ flex: 1, textAlign: 'left' }}>{m.label}</span>
            {m.href && (
              <span style={{ color: 'var(--ink-nav-soft)', flexShrink: 0, display: 'inline-flex' }} title="Abre en una pestaña aparte">
                {window.Icon.external?.(13)}
              </span>
            )}
            {m.badge && (
              <span style={{
                padding: '2px 7px', borderRadius: 'var(--r-sm)',
                background: isActive ? 'var(--wine)' : 'var(--bg-nav-hover)',
                color: isActive ? '#fff' : 'var(--ink-nav-soft)',
                font: '700 10.5px/1.3 var(--f-sans)',
              }}>{m.badge}</span>
            )}
          </>
        )}
      </button>
    );
  };

  // Render de un sub-grupo (parent) con sus hijos expandibles.
  const renderParent = (u) => {
    if (collapsed) return u.children.map(c => renderLeaf(c, 0));
    const pid = u.parent.id;
    const childActive = u.children.some(c => c.id === active);
    const pOpen = childActive || openGroups['__p_' + pid] === true;
    return (
      <div key={pid}>
        <button
          onClick={() => setOpenGroups({ ...openGroups, ['__p_' + pid]: !pOpen })}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '8px 12px', borderRadius: 'var(--r-md)',
            background: childActive ? 'var(--bg-nav-hover)' : 'transparent',
            color: childActive ? 'var(--ink-nav-active)' : 'var(--ink-nav)',
            font: '600 13px/1 var(--f-sans)',
            transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
          }}
          onMouseEnter={(e) => { if (!childActive) e.currentTarget.style.background = 'var(--bg-nav-hover)'; }}
          onMouseLeave={(e) => { if (!childActive) e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ color: childActive ? 'var(--wine)' : 'var(--ink-nav-soft)', flexShrink: 0, display: 'inline-flex' }}>{window.Icon[u.parent.icon]?.(18)}</span>
          <span style={{ flex: 1, textAlign: 'left' }}>{u.parent.label}</span>
          <span style={{ display: 'inline-flex', color: 'var(--ink-nav-soft)', transform: `rotate(${pOpen ? 0 : -90}deg)`, transition: 'transform var(--dur-fast) var(--ease)' }}>{window.Icon.chevD(12)}</span>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
          {pOpen && u.children.map(c => renderLeaf(c, 16))}
        </div>
      </div>
    );
  };

  return (
    <aside style={{
      position: 'fixed', top: 0, left: 0, bottom: 0,
      width: collapsed ? 'var(--sb-collapsed)' : 'var(--sb-expanded)',
      background: 'var(--bg-nav)',
      borderRight: '1px solid var(--border-nav)',
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
        borderBottom: '1px solid var(--border-nav)',
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
              color: 'var(--ink-nav-soft)',
              background: 'var(--bg-nav-hover)',
              transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--wine)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-nav-hover)'; e.currentTarget.style.color = 'var(--ink-nav-soft)'; }}
          >
            <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}>{window.Icon.chevR(13)}</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <CreateButton collapsed={collapsed} onSelect={onSelect} currentUser={currentUser} />
        {grouped.map(([group, units]) => {
          const open = !collapsed && openGroup === group;
          return (
          <div key={group} style={{ marginBottom: 6 }}>
            {!collapsed && (
              <button
                onClick={() => setOpenGroup(open ? null : group)}
                style={{
                  width: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  padding: '8px 10px 6px',
                  font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-nav-soft)',
                  letterSpacing: '0.16em', textTransform: 'uppercase',
                  background: 'transparent', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ink-nav)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-nav-soft)'; }}
              >
                <span>{group}</span>
                <span style={{ transform: `rotate(${open ? 0 : -90}deg)`, transition: 'transform var(--dur-fast) var(--ease)' }}>{window.Icon.chevD(11)}</span>
              </button>
            )}
            {(collapsed || open) && units.map((u, ui) => (
              <React.Fragment key={u.type === 'leaf' ? u.mod.id : u.parent.id}>
                {u.type === 'leaf' ? renderLeaf(u.mod, 0) : renderParent(u)}
              </React.Fragment>
            ))}
          </div>
          );
        })}
      </nav>

      {/* Footer: collapse toggle + user */}
      <div style={{
        padding: collapsed ? '12px 8px' : '12px 14px',
        borderTop: '1px solid var(--border-nav)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <button
          onClick={onToggleCollapse}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '8px', borderRadius: 'var(--r-md)',
            color: 'var(--ink-nav-soft)',
            background: 'var(--bg-nav-hover)',
            font: '500 12px/1 var(--f-sans)',
          }}
        >
          <span style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', display: 'inline-flex', transition: 'transform var(--dur) var(--ease)' }}>
            {window.Icon.chevR(14)}
          </span>
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>
      {!collapsed && (
        <div onPointerDown={startResize} title="Arrastrá para ajustar el ancho del menú"
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 5, cursor: 'ew-resize', zIndex: 60 }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-soft)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'} />
      )}
    </aside>
  );
}

// ── Tenant switcher (multi-tenant · Topbar) ─────────────────
// Los tenants son EMPRESAS separadas y aisladas (estructura "Highway"),
// NO sucursales de DTD. En DTD el tenant es invisible. "Cambiar de empresa"
// = salir de esta e ingresar a otra. Se dispara desde el menú de usuario.
function CompanyRow({ company, active, onPick, youAreHere }) {
  const U = window.ERPUI; const I = window.Icon;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      border: '1px solid ' + (active ? 'var(--wine)' : 'var(--border)'),
      background: active ? 'var(--wine-tint)' : 'var(--bg-surface)', borderRadius: 'var(--r-md)' }}>
      <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--r-sm)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--wine)' : 'var(--bg-sidebar)', color: '#fff', font: '800 10px/1 var(--f-mono)' }}>{company.short}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: '800 13px/1.2 var(--f-display)', color: active ? 'var(--wine)' : 'var(--ink)' }}>{company.name}</div>
        <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{company.region}</div>
      </div>
      {active ?
        <window.ERPUI.Badge tone="wine" size="sm">Estás acá</window.ERPUI.Badge> :
        <U.Btn variant={youAreHere ? 'secondary' : 'soft'} size="sm" onClick={() => onPick(company.id)}>{youAreHere ? 'Volver' : 'Salir e ingresar'}</U.Btn>}
    </div>
  );
}

function CompanySwitchModal({ open, onClose }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [cur, setCur] = useState(D.currentTenant());
  useEffect(() => {
    const onChg = (e) => setCur(e.detail);
    window.addEventListener('dtd-tenant-changed', onChg);
    return () => window.removeEventListener('dtd-tenant-changed', onChg);
  }, []);
  const home = D.tenant(D.HOME_TENANT);
  const others = (D.COMPANIES || []).filter(c => !c.home);
  const go = (id) => { D.setTenant(id); setCur(id); onClose(); };

  return (
    <U.Modal open={open} onClose={onClose} width={460} title="Cambiar de empresa">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ font: '500 12.5px/1.6 var(--f-sans)', color: 'var(--ink-soft)' }}>
          Cada empresa es un entorno <b>totalmente aislado</b>. Salís de esta para ingresar a otra — no comparten clientes, embarques ni datos.
        </div>
        {home && <CompanyRow company={home} active={cur === home.id} onPick={go} youAreHere />}
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 2 }}>Otras empresas</div>
        {others.map(c => <CompanyRow key={c.id} company={c} active={cur === c.id} onPick={go} />)}
      </div>
    </U.Modal>
  );
}

// Banner: solo aparece cuando operás OTRA empresa (no la home). Montado en App.
function CompanyBanner() {
  const D = window.ERPData;
  const I = window.Icon;
  const [cur, setCur] = useState(D.currentTenant());
  useEffect(() => {
    const onChg = (e) => setCur(e.detail);
    window.addEventListener('dtd-tenant-changed', onChg);
    return () => window.removeEventListener('dtd-tenant-changed', onChg);
  }, []);
  if (!cur || cur === D.HOME_TENANT) return null;
  const company = D.tenant(cur);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px var(--s-6)', background: 'var(--wine)', color: '#fff', zIndex: 35 }}>
      <span style={{ display: 'inline-flex' }}>{window.Icon.warn(15)}</span>
      <div style={{ flex: 1, font: '600 12.5px/1.3 var(--f-sans)' }}>
        Estás operando <b>{company?.name || cur}</b> · entorno aislado (Highway). Esta no es DTD-Cargo.
      </div>
      <button onClick={() => D.setTenant(D.HOME_TENANT)} style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--wine)', background: '#fff', border: 'none', borderRadius: 'var(--r-pill)', padding: '6px 12px', cursor: 'pointer' }}>Volver a DTD-Cargo</button>
    </div>
  );
}

// ── Botón "+ Crear" global (mega-menú · estilo QuickBooks) ───
// Único punto para crear cualquier cosa, agrupado por área. Cada
// ítem navega al módulo en modo 'create'; los del catálogo además
// emiten 'dtd-create-catalog' para que Servicios&Tarifas abra el tipo.
const CREATE_GROUPS = [
  { g: 'Comercial', items: [
    ['Estimado DDP', 'estimados', 'create'],
    ['Cliente (Shipping Mark)', 'clients', 'create'],
    ['Lead / oportunidad', 'leads', 'create'],
    ['Registrar cobro', 'cobranzas', 'list'],
  ] },
  { g: 'Operación CN→VE', items: [
    ['Embarque', 'shipments', 'create'],
    ['Orden esperada', 'cn', 'list'],
    ['Proveedor de cliente · CN', 'suppliers', 'create'],
    ['Consolidación', 'naviera', 'list'],
    ['Etiquetas QR', 'qrqueue', 'list'],
  ] },
  { g: 'Finanzas', items: [
    ['Factura', 'invoices', 'create'],
    ['Pago / Gasto', 'tesoreria', 'list'],
    ['Asiento contable', 'contab', 'list'],
    ['Cuenta contable', 'contab', 'list'],
  ] },
  { g: 'Catálogo', items: [
    ['Servicio', 'rates', 'servicio'],
    ['Producto (inventario)', 'rates', 'inventario'],
    ['Grupo / Paquete', 'rates', 'grupo'],
    ['Tarifa', 'rates', 'tarifa'],
  ] },
  { g: 'Equipo / Otro', items: [
    ['Usuario', 'users', 'create'],
    ['Tarea', '__tudia', null],
  ] },
];
const CATALOG_KINDS = ['servicio', 'inventario', 'grupo', 'tarifa', 'no_inv'];

// ── Topbar ───────────────────────────────────────────────────
function Topbar({ moduleLabel, onSearchFocus, onThemeToggle, theme, notifications, onTweaksToggle, currentUser, onSwitchUser, onPortalAction, onPortalClear }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [langTick, setLangTick] = useState(0);
  const [userOpen, setUserOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
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

      {/* + Crear global vive en el sidebar (CreateButton) */}

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
          <span style={{ flex: 1 }}>Buscar embarques, clientes, Shipping Mark…</span>
          <kbd style={{
            padding: '2px 6px', borderRadius: 4,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            font: '600 10px/1.3 var(--f-mono)', color: 'var(--ink-soft)',
          }}>⌘ K</kbd>
        </button>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Tu día · bandeja personal */}
        <button
          onClick={() => window.__erpOverlay && window.__erpOverlay('tudia', { userId: currentUser?.id || 'u-001' })}
          title="Tu día · pendientes personales"
          style={{
            height: 36, padding: '0 12px', borderRadius: 'var(--r-md)', marginRight: 2,
            display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', cursor: 'pointer',
            background: 'transparent', color: 'var(--ink-soft)', font: '700 12.5px/1 var(--f-sans)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >{window.Icon.check(14)} Tu día</button>

        {/* AI Copilot */}
        <button
          onClick={() => window.__erpOverlay && window.__erpOverlay('copilot')}
          title="AI Copilot · preguntá sobre tus datos"
          style={{
            width: 36, height: 36, borderRadius: 'var(--r-md)', marginRight: 2,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--wine)', background: 'var(--wine-tint)', color: 'var(--wine)', cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--wine)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--wine-tint)'; e.currentTarget.style.color = 'var(--wine)'; }}
        >{window.Icon.spark(16)}</button>

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
            {(() => {
              const portalCount = (notifications || []).filter(n => n.portal).length;
              if (portalCount > 0) return (
                <span style={{
                  position: 'absolute', top: 3, right: 2,
                  minWidth: 16, height: 16, padding: '0 4px', borderRadius: 'var(--r-pill)',
                  background: 'var(--wine)', color: '#fff',
                  font: '700 10px/16px var(--f-sans)', textAlign: 'center',
                  border: '2px solid var(--bg-surface)', boxSizing: 'content-box',
                }}>{portalCount}</span>
              );
              return notifications && notifications.length > 0 ? (
                <span style={{
                  position: 'absolute', top: 8, right: 8,
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--wine)',
                  border: '2px solid var(--bg-surface)',
                }} />
              ) : null;
            })()}
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
                <a onClick={() => { if (onPortalClear) onPortalClear(); }} style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', cursor: 'pointer' }}>Marcar leídas</a>
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {notifications.map(n => {
                  const actionLabel = n.kind === 'cotizacion' ? 'Ver estimado' : n.kind === 'recompra' ? 'Ver compras' : n.kind === 'cne-alert' ? 'Ver cliente' : 'Aprobar registro';
                  return (
                  <div key={n.id} style={{
                    padding: '12px 18px', borderBottom: '1px solid var(--border)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    background: n.portal ? 'var(--wine-tint)' : 'transparent',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                      background: n.tone === 'wine' ? 'var(--wine)' : n.tone === 'success' ? 'var(--success)' : n.tone === 'warning' ? 'var(--warning)' : n.tone === 'danger' ? 'var(--danger)' : 'var(--info)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {n.portal && (
                        <div style={{ font: '700 9px/1 var(--f-sans)', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--wine)', marginBottom: 4 }}>Portal del cliente</div>
                      )}
                      <div style={{ font: '600 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>{n.t}</div>
                      <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{n.m}</div>
                      {n.portal && onPortalAction && (
                        <button onClick={() => { onPortalAction(n); setNotifOpen(false); }} style={{
                          marginTop: 8, padding: '5px 10px', borderRadius: 'var(--r-sm)',
                          background: 'var(--wine)', color: '#fff', border: 0,
                          font: '700 11px/1 var(--f-sans)', cursor: 'pointer',
                        }}>{actionLabel}</button>
                      )}
                    </div>
                  </div>
                  );
                })}
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
                  { label: 'Ver mi perfil completo', action: () => window.__erpOverlay && window.__erpOverlay('perfil', { userId: currentUser?.id || 'u-001' }) },
                  { label: 'Mi perfil',         action: () => window.DTDWiring?.openProfileModal({ tab: 'profile' }) },
                  { label: 'Cambiar contraseña', action: () => window.DTDWiring?.openProfileModal({ tab: 'password' }) },
                  { label: 'Preferencias',      action: () => window.DTDWiring?.openProfileModal({ tab: 'prefs' }) },
                  { label: 'Atajos de teclado', action: () => window.DTDWiring?.openShortcutsModal() },
                  ...((currentUser?.role === 'Admin' || !currentUser) ? [{ label: 'Modo cliente · ver el portal', action: () => window.__erpOverlay && window.__erpOverlay('modocliente') }] : []),
                  { label: 'Cambiar de empresa', action: () => setCompanyOpen(true) },
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
      <CompanySwitchModal open={companyOpen} onClose={() => setCompanyOpen(false)} />
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
    modules.forEach(m => list.push({ kind: 'mod', label: m.label, sub: m.group, action: () => m.href ? window.open(m.href, '_blank') : onSelect(m.id), icon: m.icon }));
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
            placeholder="Buscar módulo, embarque, cliente, Shipping Mark…"
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

// ── Overlay host · monta pantallas full-page DENTRO del ERP ──────
// Reemplaza los window.open(...) por un overlay interno (sin pestañas).
// Se abre vía window.__erpOverlay(kind, params) y se cierra con Esc/✕.
// Intercepta los links "…DTD Studio · ERP.html#mod" de las pantallas
// para navegar el ERP (via __erpGoTo) y cerrar, en vez de recargar.
const OVERLAY_TITLES = { tudia: 'Tu día', perfil: 'Perfil de usuario', hilo: 'Hilo de comentarios', copilot: 'AI Copilot', estadocuenta: 'Estado de cuenta', modocliente: 'Modo cliente' };
function OverlayHost() {
  const [state, setState] = useState(null); // { kind, params }
  const I = window.Icon;
  useEffect(() => {
    window.__erpOverlay = (kind, params = {}) => setState({ kind, params });
    window.__erpCloseOverlay = () => setState(null);
    const onKey = (e) => { if (e.key === 'Escape') setState(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  if (!state) return null;

  const map = {
    tudia: window.TuDia,
    perfil: window.UsuarioPerfil,
    hilo: window.HiloComentario,
    copilot: window.Copilot,
    estadocuenta: window.EstadoCuenta,
    modocliente: window.ModoCliente,
  };
  const Comp = map[state.kind];
  const close = () => setState(null);

  // Interceptar clicks en links hacia el ERP: navegar internamente + cerrar.
  const onClick = (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (href.includes('DTD Studio')) {
      e.preventDefault();
      const hash = href.split('#')[1];
      close();
      if (hash && window.__erpGoTo) setTimeout(() => window.__erpGoTo(hash), 40);
    }
  };

  return (
    <div onClick={onClick} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg-base)',
      overflowY: 'auto', animation: 'erp-fade .18s var(--ease) both',
    }}>
      <button onClick={close} title="Cerrar · Esc" style={{
        position: 'fixed', top: 14, right: 18, zIndex: 210, width: 38, height: 38,
        borderRadius: 'var(--r-pill)', border: '1px solid var(--border)', cursor: 'pointer',
        background: 'var(--bg-surface)', color: 'var(--ink-soft)', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--wine)'; e.currentTarget.style.borderColor = 'var(--wine)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ink-soft)'; e.currentTarget.style.borderColor = 'var(--border)'; }}>
        {I && I.close ? I.close(17) : '✕'}
      </button>
      {Comp
        ? <Comp {...state.params} embedded={true} />
        : <div style={{ padding: 60, font: '600 14px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>Pantalla “{OVERLAY_TITLES[state.kind] || state.kind}” no disponible.</div>}
    </div>
  );
}

window.ERPShell = { MODULES, Sidebar, Topbar, CommandPalette, DTDLogo, CompanyBanner, OverlayHost };
