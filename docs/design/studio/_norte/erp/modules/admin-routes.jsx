/* global React */
/* ── DTD ERP · Admin → Administrar rutas ────────────────────── */
/* Sección del nivel BÁSICO del módulo Admin. Dos sub-tabs:      */
/*   1) Rutas              CRUD de rutas (directa | con paradas) */
/*   2) Configurable       Catálogo de ciudades del tenant con   */
/*      por ciudad         radio default y flag HQ.              */

(function () {
  const { useState, useMemo } = React;

  // ── Hubs (sedes · prep para multi-bodega) ───────────────────
  const HUBS_DEFAULT = [
    { id: 'HUB-VAL', name: 'Valencia · Bodega DTD',   city: 'Valencia', active: true },
    // futuro: { id: 'HUB-CCS', name: 'Caracas · …', city: 'Caracas', active: false },
  ];

  // ── Catálogo de ciudades default (per-tenant en prod) ───────
  // Estructura venezolana de direcciones: Estado → Municipio → Parroquia → Ciudad → Barrio/Urbanización
  // Códigos postales IPOSTEL · 4 dígitos (a veces con sufijo -A)
  const CITY_CATALOG_DEFAULT = [
    { city: 'Valencia',               state: 'Carabobo',         municipio: 'Valencia',           parroquia: 'San José',     postalCode: '2001', defaultRadiusKm: 0,  isHQ: true,  active: true,  barrios: ['El Viñedo', 'Naguanagua', 'Trigal Norte', 'San José', 'Prebo', 'El Recreo'] },
    { city: 'Caracas',                state: 'Distrito Capital', municipio: 'Chacao',             parroquia: 'Chacao',       postalCode: '1060', defaultRadiusKm: 25, isHQ: false, active: true,  barrios: ['Chacao', 'Las Mercedes', 'Altamira', 'La Castellana', 'Sabana Grande', 'El Hatillo'] },
    { city: 'Maracay',                state: 'Aragua',           municipio: 'Girardot',           parroquia: 'Las Delicias', postalCode: '2101', defaultRadiusKm: 20, isHQ: false, active: true,  barrios: ['San Jacinto', 'Las Delicias', 'El Castaño', 'Caña de Azúcar', 'La Soledad'] },
    { city: 'San Juan de los Morros', state: 'Guárico',          municipio: 'Juan Germán Roscio', parroquia: 'San Juan',     postalCode: '2301', defaultRadiusKm: 15, isHQ: false, active: true,  barrios: ['Casco Central', 'Pariata', 'La Toscana'] },
    { city: 'Maracaibo',              state: 'Zulia',            municipio: 'Maracaibo',          parroquia: 'Chiquinquirá', postalCode: '4001', defaultRadiusKm: 30, isHQ: false, active: true,  barrios: ['Bella Vista', 'Tierra Negra', 'El Milagro', 'Indio Mara'] },
    { city: 'Barquisimeto',           state: 'Lara',             municipio: 'Iribarren',          parroquia: 'Catedral',     postalCode: '3001', defaultRadiusKm: 25, isHQ: false, active: true,  barrios: ['Centro', 'El Tostado', 'Las Trinitarias'] },
    { city: 'Coro',                   state: 'Falcón',           municipio: 'Miranda',            parroquia: 'Santa Ana',    postalCode: '4101', defaultRadiusKm: 25, isHQ: false, active: true,  barrios: ['Centro', 'Cruz Verde', 'Curazaito'] },
    { city: 'Punto Fijo',             state: 'Falcón',           municipio: 'Carirubana',         parroquia: 'Carirubana',   postalCode: '4102', defaultRadiusKm: 20, isHQ: false, active: true,  barrios: ['Centro', 'Las Pioneras', 'Cardón'] },
    { city: 'Maturín',                state: 'Monagas',          municipio: 'Maturín',            parroquia: 'San Simón',    postalCode: '6201', defaultRadiusKm: 30, isHQ: false, active: false, barrios: ['La Floresta', 'Tipuro', 'Las Avenidas'] },
    { city: 'Mérida',                 state: 'Mérida',           municipio: 'Libertador',         parroquia: 'El Llano',     postalCode: '5101', defaultRadiusKm: 25, isHQ: false, active: false, barrios: ['La Hechicera', 'Belensate', 'Glorias Patrias'] },
  ];

  // ── Rutas default ───────────────────────────────────────────
  const ROUTES_DEFAULT = [
    { id: 'R-001', name: 'Valencia → Caracas',                type: 'directa',     hubId: 'HUB-VAL', destination: 'Caracas',   stops: [], active: true,  updated: '2026-05-12' },
    { id: 'R-002', name: 'Valencia → Caracas + 2 paradas',    type: 'con-paradas', hubId: 'HUB-VAL', destination: 'Caracas',   stops: [{ city: 'Maracay', radiusKm: 20 }, { city: 'San Juan de los Morros', radiusKm: 15 }], active: true,  updated: '2026-05-18' },
    { id: 'R-003', name: 'Valencia → Maracaibo',              type: 'directa',     hubId: 'HUB-VAL', destination: 'Maracaibo', stops: [], active: true,  updated: '2026-05-03' },
    { id: 'R-004', name: 'Valencia → Maracaibo + 2 paradas',  type: 'con-paradas', hubId: 'HUB-VAL', destination: 'Maracaibo', stops: [{ city: 'Barquisimeto', radiusKm: 30 }, { city: 'Coro', radiusKm: 25 }], active: false, updated: '2026-04-21' },
  ];

  // ──────────────────────────────────────────────────────────────
  // MAIN
  // ──────────────────────────────────────────────────────────────
  function AdminSectionRoutes() {
    const U = window.ERPUI;
    const I = window.Icon;

    const [tab, setTab]         = useState('routes');
    const [tenant, setTenant]   = useState('dtd-ca');
    const [routes, setRoutes]   = useState(() => {
      if (window.DTDData) {
        const saved = window.DTDData.routes.read();
        if (saved && saved.length) return saved;
      }
      return ROUTES_DEFAULT;
    });
    const [cities, setCities]   = useState(() => {
      if (window.DTDData) {
        const saved = window.DTDData.cities.read();
        if (saved && saved.length) return saved;
      }
      return CITY_CATALOG_DEFAULT;
    });

    // Persist al bridge
    React.useEffect(() => { if (window.DTDData) window.DTDData.routes.write(routes); }, [routes]);
    React.useEffect(() => { if (window.DTDData) window.DTDData.cities.write(cities); }, [cities]);
    const [editing, setEditing] = useState(null);   // null | { id?, mode: 'new' | 'edit' }
    const [toast, setToast]     = useState(null);
    const [search, setSearch]   = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    React.useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);

    function showToast(msg) { setToast(msg); }

    // ── Route handlers ─────────────────────────────────────────
    function openNewRoute() {
      setEditing({
        mode: 'new',
        route: {
          id: nextRouteId(routes),
          name: '',
          type: 'directa',
          hubId: 'HUB-VAL',
          destination: '',
          stops: [],
          active: true,
        },
      });
    }
    function openEditRoute(r) { setEditing({ mode: 'edit', route: { ...r, stops: r.stops.map(s => ({ ...s })) } }); }
    function closeEditor() { setEditing(null); }

    function saveRoute(updated) {
      if (editing.mode === 'new') {
        setRoutes([...routes, updated]);
        showToast(`Ruta ${updated.id} creada`);
      } else {
        setRoutes(routes.map(r => r.id === updated.id ? updated : r));
        showToast(`Ruta ${updated.id} actualizada`);
      }
      closeEditor();
    }
    function archiveRoute(id) {
      setRoutes(routes.map(r => r.id === id ? { ...r, active: !r.active } : r));
      showToast(`Ruta ${id} ${routes.find(r => r.id === id).active ? 'archivada' : 'reactivada'}`);
    }
    function deleteRoute(id) {
      if (!confirm(`¿Eliminar la ruta ${id}? No se puede deshacer.`)) return;
      setRoutes(routes.filter(r => r.id !== id));
      showToast(`Ruta ${id} eliminada`);
    }

    // ── City catalog handlers ──────────────────────────────────
    function updateCity(idx, patch) { setCities(cities.map((c, i) => i === idx ? { ...c, ...patch } : c)); }
    function deleteCity(idx) {
      const c = cities[idx];
      const usage = routesUsingCity(routes, c.city);
      if (usage.length > 0) { showToast(`No se puede eliminar ${c.city}: usada en ${usage.length} ruta${usage.length === 1 ? '' : 's'}`); return; }
      if (!confirm(`¿Eliminar ${c.city} del catálogo?`)) return;
      setCities(cities.filter((_, i) => i !== idx));
      showToast(`${c.city} eliminada del catálogo`);
    }
    function addCity() {
      setCities([...cities, { city: 'Nueva ciudad', state: '', municipio: '', parroquia: '', postalCode: '', defaultRadiusKm: 20, isHQ: false, active: true, barrios: [] }]);
    }
    function addCityFromEditor(newCity) {
      setCities([...cities, newCity]);
      showToast(`${newCity.city} agregada al catálogo`);
    }

    // ── Stats ─────────────────────────────────────────────────
    const stats = useMemo(() => ({
      total:      routes.length,
      active:     routes.filter(r => r.active).length,
      direct:     routes.filter(r => r.type === 'directa').length,
      withStops:  routes.filter(r => r.type === 'con-paradas').length,
      stopsAvg:   (() => {
        const cp = routes.filter(r => r.type === 'con-paradas');
        if (cp.length === 0) return 0;
        return Math.round(cp.reduce((s, r) => s + r.stops.length, 0) / cp.length * 10) / 10;
      })(),
    }), [routes]);

    return (
      <div>
        {/* ── Tenant + Tabs ────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          marginBottom: 'var(--s-5)', flexWrap: 'wrap',
        }}>
          <U.Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'routes', label: 'Rutas',                 count: stats.total },
              { value: 'cities', label: 'Configurable por ciudad', count: cities.length },
            ]}
            style={{ flex: 1, minWidth: 280, border: 0 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Tenant</span>
            <U.Select value={tenant} onChange={(e) => setTenant(e.target.value)} style={{ width: 220 }} options={[
              { value: 'dtd-ca',    label: 'DTD-Cargo CA · Caracas' },
              { value: 'dtd-zulia', label: 'DTD-Cargo Zulia · Maracaibo' },
              { value: 'dtd-occ',   label: 'DTD-Cargo Occidente · Pto Fijo' },
            ]} />
          </div>
        </div>

        {tab === 'routes' && (
          <RoutesTab
            routes={routes}
            cities={cities}
            stats={stats}
            search={search}
            setSearch={setSearch}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            onNew={openNewRoute}
            onEdit={openEditRoute}
            onArchive={archiveRoute}
            onDelete={deleteRoute}
          />
        )}

        {tab === 'cities' && (
          <CitiesTab
            cities={cities}
            routes={routes}
            tenant={tenant}
            onUpdate={updateCity}
            onAdd={addCity}
            onDelete={deleteCity}
          />
        )}

        {/* Drawer editor */}
        {editing && (
          <RouteEditor
            initial={editing.route}
            mode={editing.mode}
            cities={cities}
            hubs={HUBS_DEFAULT}
            onSave={saveRoute}
            onAddCity={addCityFromEditor}
            onClose={closeEditor}
          />
        )}

        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--success)', color: '#fff', padding: '12px 20px',
            borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', zIndex: 200,
            font: '700 13px/1 var(--f-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            animation: 'erp-pop 200ms var(--ease)',
          }}>{I.check(16)} {toast}</div>
        )}
      </div>
    );
  }

  function nextRouteId(routes) {
    const max = routes.reduce((m, r) => Math.max(m, parseInt(r.id.replace('R-', ''), 10) || 0), 0);
    return `R-${String(max + 1).padStart(3, '0')}`;
  }
  function routesUsingCity(routes, city) {
    return routes.filter(r => r.destination === city || r.stops.some(s => s.city === city));
  }

  // ──────────────────────────────────────────────────────────────
  // RoutesTab
  // ──────────────────────────────────────────────────────────────
  function RoutesTab({ routes, cities, stats, search, setSearch, typeFilter, setTypeFilter, onNew, onEdit, onArchive, onDelete }) {
    const U = window.ERPUI;
    const I = window.Icon;

    const filtered = useMemo(() => {
      return routes.filter(r => {
        if (typeFilter === 'directa'     && r.type !== 'directa')     return false;
        if (typeFilter === 'con-paradas' && r.type !== 'con-paradas') return false;
        if (typeFilter === 'inactive'    && r.active)                 return false;
        if (typeFilter === 'active'      && !r.active)                return false;
        if (search) {
          const q = search.toLowerCase();
          const hit = r.name.toLowerCase().includes(q)
                   || r.destination.toLowerCase().includes(q)
                   || r.id.toLowerCase().includes(q)
                   || r.stops.some(s => s.city.toLowerCase().includes(q));
          if (!hit) return false;
        }
        return true;
      });
    }, [routes, typeFilter, search]);

    return (
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 'var(--s-5)' }}>
          <U.KPI label="Total rutas"      value={stats.total}     sub={`${stats.active} activas`}             tone="wine"    icon={I.truck(16)} />
          <U.KPI label="Directas"          value={stats.direct}    sub="sin paradas intermedias"               tone="info"    icon={I.arrowR(16)} />
          <U.KPI label="Con ciudades"      value={stats.withStops} sub={`promedio ${stats.stopsAvg} ciudades`} tone="warning" icon={I.pin(16)} />
          <U.KPI label="Cobertura"          value={`${stats.active}/${stats.total}`} sub="activas / totales"   tone="success" icon={I.check(16)} />
        </div>

        <U.Toolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar ruta, destino, parada…"
          filters={
            <U.Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 180 }} options={[
              { value: 'all',         label: 'Todas las rutas' },
              { value: 'active',      label: 'Solo activas' },
              { value: 'inactive',    label: 'Solo inactivas' },
              { value: 'directa',     label: 'Directas' },
              { value: 'con-paradas', label: 'Con ciudades' },
            ]} />
          }
          actions={
            <U.Btn variant="primary" size="md" icon={I.plus(14)} onClick={onNew}>Nueva ruta</U.Btn>
          }
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => (
            <RouteRowCard key={r.id} route={r} onEdit={() => onEdit(r)} onArchive={() => onArchive(r.id)} onDelete={() => onDelete(r.id)} />
          ))}
          {filtered.length === 0 && (
            <U.EmptyState
              icon={I.truck(22)}
              title="No hay rutas con esos filtros"
              body="Ajustá los filtros o creá una ruta nueva."
              action={<U.Btn variant="primary" icon={I.plus(14)} onClick={onNew}>Nueva ruta</U.Btn>}
            />
          )}
        </div>
      </div>
    );
  }

  function RouteRowCard({ route, onEdit, onArchive, onDelete }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const isDir = route.type === 'directa';
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)',
        padding: '14px 18px',
        opacity: route.active ? 1 : 0.65,
        transition: 'all var(--dur-fast) var(--ease)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
              <code style={{ font: '800 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{route.id}</code>
              <div style={{ font: '800 15px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{route.name}</div>
              <span style={{
                padding: '3px 8px', borderRadius: 'var(--r-sm)',
                background: isDir ? 'var(--info-bg)' : 'var(--warning-bg)',
                color: isDir ? 'var(--info)' : 'var(--warning)',
                font: '800 10px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>{isDir ? 'Directa' : 'Con ciudades'}</span>
              {!route.active && <U.Badge tone="neutral" size="sm">Archivada</U.Badge>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
              <span>Origen: <b style={{ color: 'var(--ink)' }}>Valencia · Bodega DTD</b></span>
              <span style={{ color: 'var(--ink-mute)' }}>·</span>
              <span>Destino: <b style={{ color: 'var(--ink)' }}>{route.destination}</b></span>
              <span style={{ color: 'var(--ink-mute)' }}>·</span>
              <span>Actualizada {route.updated}</span>
            </div>
            {!isDir && route.stops.length > 0 && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase', alignSelf: 'center' }}>Ciudades:</span>
                {route.stops.map((s, i) => (
                  <span key={i} style={{
                    padding: '4px 8px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}>
                    <span style={{ color: 'var(--ink)', font: '600 12px/1 var(--f-sans)' }}>{s.city}</span>
                    <span style={{ color: 'var(--wine)', font: '700 11px/1 var(--f-mono)' }}>{s.radiusKm}km</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
            <U.Btn variant="ghost"  size="sm" icon={I.edit(13)}    onClick={onEdit}>Editar</U.Btn>
            <U.Btn variant="ghost"  size="sm" icon={route.active ? I.eye(13) : I.refresh(13)} onClick={onArchive}>{route.active ? 'Archivar' : 'Reactivar'}</U.Btn>
            <U.Btn variant="ghost"  size="sm" icon={I.trash(13)}    onClick={onDelete} style={{ color: 'var(--danger)' }}>Eliminar</U.Btn>
          </div>
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // RouteEditor (drawer)
  // ──────────────────────────────────────────────────────────────
  function RouteEditor({ initial, mode, cities, hubs, onSave, onAddCity, onClose }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [draft, setDraft] = useState(initial);

    const activeCities = cities.filter(c => c.active);
    const destinations = activeCities.filter(c => !c.isHQ);  // no puedes tener Valencia como destino
    const stopOptions = useMemo(() => {
      const used = new Set([...draft.stops.map(s => s.city), draft.destination, 'Valencia']);
      return activeCities.filter(c => !used.has(c.city));
    }, [activeCities, draft.stops, draft.destination]);

    function update(patch) { setDraft({ ...draft, ...patch }); }
    function setType(type) {
      if (type === 'directa') update({ type, stops: [] });
      else update({ type });
    }
    function addStop(city) {
      const def = cities.find(c => c.city === city);
      const radius = def ? def.defaultRadiusKm : 20;
      update({ stops: [...draft.stops, { city, radiusKm: radius }] });
    }
    function updateStopRadius(idx, val) {
      const next = draft.stops.map((s, i) => i === idx ? { ...s, radiusKm: val } : s);
      update({ stops: next });
    }
    function removeStop(idx) { update({ stops: draft.stops.filter((_, i) => i !== idx) }); }

    function handleSave() {
      if (!draft.destination) { alert('Elige un destino.'); return; }
      if (draft.type === 'con-paradas' && draft.stops.length === 0) { alert('Una ruta con ciudades intermedias necesita al menos una ciudad.'); return; }
      const name = draft.name || `Valencia → ${draft.destination}${draft.type === 'con-paradas' ? ` + ${draft.stops.length} ciudad${draft.stops.length === 1 ? '' : 'es'}` : ''}`;
      onSave({ ...draft, name, updated: new Date().toISOString().slice(0, 10) });
    }

    return (
      <U.Drawer
        open
        onClose={onClose}
        title={mode === 'new' ? 'Nueva ruta' : `Editar ruta · ${draft.id}`}
        subtitle="Las ciudades intermedias heredan el radio default del catálogo. Puedes overridearlo solo para esta ruta."
        width={680}
        actions={
          <React.Fragment>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.check(14)} onClick={handleSave}>{mode === 'new' ? 'Crear ruta' : 'Guardar cambios'}</U.Btn>
          </React.Fragment>
        }
      >
        {/* ── Identificación ─────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>IDENTIFICACIÓN</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <U.Input label="ID de ruta" value={draft.id} mono disabled />
            <U.Input label="Nombre (opcional · se genera automáticamente)" value={draft.name} placeholder={`Valencia → ${draft.destination || '…'}`} onChange={(e) => update({ name: e.target.value })} />
          </div>
        </div>

        {/* ── Tipo (segmented) ───────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>TIPO DE RUTA</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { id: 'directa',     label: 'Directa',     desc: 'Solo paquetes con destino exacto. Sin paradas.', icon: I.arrowR, tone: 'info' },
              { id: 'con-paradas', label: 'Con ciudades', desc: 'Paquetes del destino + los del radio de cada ciudad intermedia.', icon: I.pin, tone: 'warning' },
            ].map(t => {
              const active = draft.type === t.id;
              return (
                <button key={t.id} onClick={() => setType(t.id)} style={{
                  padding: '12px 14px', textAlign: 'left',
                  background: active ? `var(--${t.tone}-bg)` : 'var(--bg-elevated)',
                  border: `1px solid ${active ? `var(--${t.tone})` : 'transparent'}`,
                  borderRadius: 'var(--r-md)', cursor: 'pointer',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <span style={{ color: `var(--${t.tone})`, marginTop: 2 }}>{t.icon(15)}</span>
                  <div>
                    <div style={{ font: '800 13px/1.1 var(--f-display)', color: active ? `var(--${t.tone})` : 'var(--ink)', letterSpacing: '-0.01em' }}>{t.label}</div>
                    <div style={{ font: '500 11px/1.4 var(--f-sans)', color: active ? `var(--${t.tone})` : 'var(--ink-soft)', marginTop: 3 }}>{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Origen + destino ───────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>ORIGEN Y DESTINO</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <U.Select label="Origen (sede)" value={draft.hubId} onChange={(e) => update({ hubId: e.target.value })} options={hubs.map(h => ({ value: h.id, label: h.name }))} />
            <CityPicker
              label="Destino"
              value={draft.destination}
              onChange={(v) => update({ destination: v })}
              cities={destinations}
              onAddCity={onAddCity}
              placeholder="— Elegir destino —"
            />
          </div>
          <div style={{ marginTop: 8, font: '500 11.5px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>
            {I.info(11)} Por ahora todas las rutas salen de Valencia. El selector queda preparado para multi-bodega.
          </div>
        </div>

        {/* ── Paradas (solo si con-paradas) ──────────────── */}
        {draft.type === 'con-paradas' && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="eyebrow eyebrow-wine">CIUDADES INTERMEDIAS</div>
              <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
                {draft.stops.length} ciudad{draft.stops.length === 1 ? '' : 'es'} configurada{draft.stops.length === 1 ? '' : 's'}
              </div>
            </div>

            {draft.stops.length === 0 && (
              <div style={{
                padding: '14px 16px', textAlign: 'center',
                background: 'var(--bg-elevated)', border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--r-md)',
                font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)',
                marginBottom: 10,
              }}>
                Todavía no agregaste ciudades intermedias. Elige una del selector de abajo.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              {draft.stops.map((s, i) => {
                const def = cities.find(c => c.city === s.city);
                const isOverride = def && def.defaultRadiusKm !== s.radiusKm;
                return (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: '32px 1fr 160px 28px', gap: 10, alignItems: 'center',
                    padding: '10px 12px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                  }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: 'var(--warning-bg)', color: 'var(--warning)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      font: '800 12px/1 var(--f-display)',
                    }}>{i + 1}</span>
                    <div>
                      <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.city}</div>
                      <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>
                        {def ? `default catálogo: ${def.defaultRadiusKm} km` : 'sin default'}
                        {isOverride && <span style={{ color: 'var(--wine)', marginLeft: 6, font: '700 10.5px/1 var(--f-sans)' }}> · override en esta ruta</span>}
                      </div>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifySelf: 'end' }}>
                      <input type="number" min={1} max={200} value={s.radiusKm}
                        onChange={(e) => updateStopRadius(i, parseInt(e.target.value || '0', 10))}
                        style={{
                          width: 60, height: 30, padding: '0 8px',
                          background: 'var(--bg-surface)', color: 'var(--ink)',
                          border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                          font: '700 13px/1 var(--f-mono)', textAlign: 'center', outline: 'none',
                        }} />
                      <span style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>km de radio</span>
                    </div>
                    <button onClick={() => removeStop(i)} aria-label="Quitar ciudad" style={{
                      width: 28, height: 28, borderRadius: 'var(--r-sm)',
                      color: 'var(--danger)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{I.close(14)}</button>
                  </div>
                );
              })}
            </div>

            <CityPicker
              label="Agregar ciudad intermedia"
              value=""
              onChange={(v) => { if (v) addStop(v); }}
              cities={stopOptions}
              onAddCity={onAddCity}
              placeholder="— Elige una ciudad —"
              showDefaultRadius
            />
          </div>
        )}

        {/* ── Estado ─────────────────────────────────────── */}
        <div style={{
          padding: '12px 14px', background: 'var(--bg-elevated)',
          border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div>
            <div style={{ font: '800 12.5px/1.1 var(--f-sans)', color: 'var(--ink)' }}>Ruta activa</div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>
              Solo las activas aparecen en el filtro de la cola de despacho.
            </div>
          </div>
          <DrawerSwitch on={draft.active} onChange={() => update({ active: !draft.active })} />
        </div>
      </U.Drawer>
    );
  }

  function DrawerSwitch({ on, onChange }) {
    return (
      <button onClick={onChange} role="switch" aria-checked={on} style={{
        position: 'relative',
        width: 44, height: 24, borderRadius: 999,
        background: on ? 'var(--wine)' : 'var(--bg-elevated)',
        border: `1px solid ${on ? 'var(--wine)' : 'var(--border-strong)'}`,
        transition: 'all var(--dur-fast) var(--ease)',
        flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 22 : 2,
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff', boxShadow: 'var(--shadow-sm)',
          transition: 'left var(--dur-fast) var(--ease)',
        }} />
      </button>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // CitiesTab
  // ──────────────────────────────────────────────────────────────
  function CitiesTab({ cities, routes, tenant, onUpdate, onAdd, onDelete }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const tenantLabel = tenant === 'dtd-ca' ? 'DTD-Cargo CA' : tenant === 'dtd-zulia' ? 'DTD-Cargo Zulia' : 'DTD-Cargo Occidente';

    return (
      <div>
        <U.Card padded>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <div className="eyebrow eyebrow-wine">CATÁLOGO PER-TENANT · {tenantLabel}</div>
              <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 4 }}>
                Configurable por ciudad
              </div>
              <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, maxWidth: '70ch' }}>
                Cada tenant define su catálogo de ciudades operables siguiendo la estructura venezolana <b style={{ color: 'var(--ink)' }}>Estado → Municipio → Parroquia → Ciudad → Barrio</b>. El radio default se precarga cuando agregás esa ciudad como parada en una ruta — editable después por ruta sin tocar el catálogo.
              </div>
            </div>
            <U.Btn variant="primary" size="md" icon={I.plus(14)} onClick={onAdd}>Agregar ciudad</U.Btn>
          </div>

          <div style={{
            marginBottom: 14, padding: '10px 14px',
            background: 'var(--info-bg)', color: 'var(--info)',
            borderRadius: 'var(--r-md)',
            font: '500 11.5px/1.5 var(--f-sans)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
            <span>
              <b>Códigos postales venezolanos (IPOSTEL):</b> 4 dígitos, a veces con sufijo <code style={{ font: '700 11px/1 var(--f-mono)' }}>-A</code> para zonas dentro del mismo código. Caracas centro 1010 · Chacao 1060 · Valencia 2001 · Maracaibo 4001. El campo Barrios suma las urbanizaciones registradas para el filtro de la cola de despacho.
            </span>
          </div>

          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  <th style={cityTh({ w: 220 })}>Ciudad</th>
                  <th style={cityTh({ w: 160 })}>Estado</th>
                  <th style={cityTh({ w: 170 })}>Municipio</th>
                  <th style={cityTh({ w: 90,  align: 'center' })}>CP</th>
                  <th style={cityTh({ w: 110, align: 'center' })}>Barrios</th>
                  <th style={cityTh({ w: 160, align: 'center' })}>Radio default</th>
                  <th style={cityTh({ w: 76,  align: 'center' })}>HQ</th>
                  <th style={cityTh({ w: 88,  align: 'center' })}>Activa</th>
                  <th style={cityTh({ w: 120, align: 'center' })}>Uso</th>
                  <th style={cityTh({ w: 50 })}></th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c, i) => {
                  const usage = routesUsingCity(routes, c.city);
                  return (
                    <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 0 }}>
                      <td style={cityTd()}>
                        <input value={c.city} onChange={(e) => onUpdate(i, { city: e.target.value })}
                          style={inlineInput({ font: '700 13px/1 var(--f-sans)' })} />
                      </td>
                      <td style={cityTd()}>
                        <input value={c.state} onChange={(e) => onUpdate(i, { state: e.target.value })}
                          style={inlineInput({ font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)' })} />
                      </td>
                      <td style={cityTd()}>
                        <input value={c.municipio || ''} onChange={(e) => onUpdate(i, { municipio: e.target.value })}
                          placeholder="—"
                          style={inlineInput({ font: '500 12.5px/1 var(--f-sans)', color: 'var(--ink-soft)' })} />
                      </td>
                      <td style={cityTd({ align: 'center' })}>
                        <input value={c.postalCode || ''} onChange={(e) => onUpdate(i, { postalCode: e.target.value })}
                          placeholder="—"
                          style={{
                            ...inlineInput({}),
                            width: 64, margin: '0 auto', display: 'block',
                            font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)',
                            textAlign: 'center',
                          }} />
                      </td>
                      <td style={cityTd({ align: 'center' })}>
                        {(c.barrios && c.barrios.length > 0) ? (
                          <span title={c.barrios.join(' · ')} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', borderRadius: 'var(--r-sm)',
                            background: 'var(--bg-elevated)', color: 'var(--ink-soft)',
                            font: '700 11px/1 var(--f-sans)', cursor: 'help',
                          }}>{I.pin(10)} {c.barrios.length}</span>
                        ) : (
                          <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>—</span>
                        )}
                      </td>
                      <td style={cityTd({ align: 'center' })}>
                        {c.isHQ ? (
                          <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>— (HQ)</span>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <input type="number" min={1} max={200} value={c.defaultRadiusKm}
                              onChange={(e) => onUpdate(i, { defaultRadiusKm: parseInt(e.target.value || '0', 10) })}
                              style={{
                                width: 58, height: 28, padding: '0 6px',
                                background: 'var(--bg-surface)', color: 'var(--ink)',
                                border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                                font: '700 13px/1 var(--f-mono)', textAlign: 'center', outline: 'none',
                              }} />
                            <span style={{ font: '700 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>km</span>
                          </div>
                        )}
                      </td>
                      <td style={cityTd({ align: 'center' })}>
                        <CompactToggle on={c.isHQ} onChange={() => onUpdate(i, { isHQ: !c.isHQ })} />
                      </td>
                      <td style={cityTd({ align: 'center' })}>
                        <CompactToggle on={c.active} onChange={() => onUpdate(i, { active: !c.active })} />
                      </td>
                      <td style={cityTd({ align: 'center' })}>
                        {usage.length === 0 ? (
                          <span style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin uso</span>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 8px', borderRadius: 'var(--r-sm)',
                            background: 'var(--wine-tint)', color: 'var(--wine)',
                            font: '800 11px/1 var(--f-sans)',
                          }}>{usage.length} ruta{usage.length === 1 ? '' : 's'}</span>
                        )}
                      </td>
                      <td style={cityTd({ align: 'center' })}>
                        <button onClick={() => onDelete(i)} aria-label="Eliminar"
                          style={{ width: 26, height: 26, color: 'var(--danger)', borderRadius: 'var(--r-sm)' }}
                        >{I.trash(13)}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: 'var(--info-bg)', color: 'var(--info)',
            borderRadius: 'var(--r-md)',
            font: '500 11.5px/1.5 var(--f-sans)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
            <span>
              <b>¿Cómo se usa el radio?</b> Cuando un cliente está dentro del radio km de una parada, califica para esa ruta. Por ejemplo, si <code style={{ font: '700 11.5px/1 var(--f-mono)' }}>Maracay</code> tiene radio 20km, los clientes a más de 20km no aparecen como elegibles para una ruta que pase por Maracay.
            </span>
          </div>
        </U.Card>
      </div>
    );
  }

  function CompactToggle({ on, onChange }) {
    return (
      <button onClick={onChange} role="switch" aria-checked={on} style={{
        position: 'relative',
        width: 32, height: 18, borderRadius: 999,
        background: on ? 'var(--wine)' : 'var(--bg-elevated)',
        border: `1px solid ${on ? 'var(--wine)' : 'var(--border-strong)'}`,
        transition: 'all var(--dur-fast) var(--ease)',
      }}>
        <span style={{
          position: 'absolute', top: 1, left: on ? 15 : 1,
          width: 14, height: 14, borderRadius: '50%',
          background: '#fff', boxShadow: 'var(--shadow-sm)',
          transition: 'left var(--dur-fast) var(--ease)',
        }} />
      </button>
    );
  }

  function cityTh({ w, align }) {
    return {
      padding: '12px 14px', textAlign: align || 'left',
      font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)',
      letterSpacing: '0.1em', textTransform: 'uppercase',
      borderBottom: '1px solid var(--border)',
      width: w, whiteSpace: 'nowrap',
    };
  }
  function cityTd({ align } = {}) {
    return {
      padding: '10px 14px', textAlign: align || 'left',
      font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink)',
      whiteSpace: 'nowrap',
    };
  }
  function inlineInput(extra = {}) {
    return {
      width: '100%', padding: '4px 6px',
      background: 'transparent', color: 'var(--ink)',
      border: '1px solid transparent', borderRadius: 'var(--r-sm)',
      font: '500 12.5px/1 var(--f-sans)', outline: 'none',
      transition: 'all var(--dur-fast) var(--ease)',
      ...extra,
    };
  }

  // ──────────────────────────────────────────────────────────────
  // CityPicker — dropdown custom con opción "+ Agregar nueva ciudad"
  // ──────────────────────────────────────────────────────────────
  function CityPicker({ label, value, onChange, cities, onAddCity, placeholder = '— Elegir —', showDefaultRadius }) {
    const I = window.Icon;
    const U = window.ERPUI;
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState('list');   // 'list' | 'add'
    const [q, setQ] = useState('');
    const [draft, setDraft] = useState({ city: '', state: '', municipio: '', postalCode: '', defaultRadiusKm: 20 });
    const wrapRef = React.useRef(null);

    // Outside click → close
    React.useEffect(() => {
      if (!open) return;
      function onDown(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(); }
      function onKey(e) { if (e.key === 'Escape') close(); }
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
      return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    function close() { setOpen(false); setMode('list'); setQ(''); setDraft({ city: '', state: '', municipio: '', postalCode: '', defaultRadiusKm: 20 }); }

    function pick(city) { onChange(city); close(); }

    function handleAdd() {
      const name = draft.city.trim();
      if (!name) { alert('Ingresa el nombre de la ciudad.'); return; }
      const newCity = {
        city: name,
        state: draft.state.trim(),
        municipio: draft.municipio.trim(),
        parroquia: '',
        postalCode: draft.postalCode.trim(),
        defaultRadiusKm: Math.max(1, Math.min(200, parseInt(draft.defaultRadiusKm || '20', 10))),
        isHQ: false,
        active: true,
        barrios: [],
      };
      onAddCity && onAddCity(newCity);
      pick(name);
    }

    const filtered = cities.filter(c => {
      if (!q) return true;
      const s = q.toLowerCase();
      return c.city.toLowerCase().includes(s) || (c.state || '').toLowerCase().includes(s);
    });

    const selectedLabel = value
      ? (() => {
          const c = cities.find(x => x.city === value);
          return c ? `${c.city}${c.state ? `, ${c.state}` : ''}` : value;
        })()
      : placeholder;

    return (
      <div ref={wrapRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {label && (
          <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
        )}
        <button
          onClick={() => setOpen(!open)}
          style={{
            height: 38, padding: '0 12px',
            background: 'var(--bg-surface)',
            border: `1px solid ${open ? 'var(--wine)' : 'var(--border)'}`,
            borderRadius: 'var(--r-md)',
            font: '500 13.5px/1 var(--f-sans)',
            color: value ? 'var(--ink)' : 'var(--ink-mute)',
            textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            boxShadow: open ? '0 0 0 3px var(--wine-tint)' : 'none',
            transition: 'all var(--dur-fast) var(--ease)',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
          <span style={{ color: 'var(--ink-mute)', transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform var(--dur-fast) var(--ease)' }}>{I.chevD(14)}</span>
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
            zIndex: 200,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-pop)',
            overflow: 'hidden',
            animation: 'erp-pop 160ms var(--ease)',
            maxHeight: 380, display: 'flex', flexDirection: 'column',
          }}>
            {mode === 'list' ? (
              <React.Fragment>
                {/* Search */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                }}>
                  <span style={{ color: 'var(--ink-mute)' }}>{I.search(13)}</span>
                  <input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar ciudad…"
                    style={{ flex: 1, height: 24, border: 0, outline: 'none', background: 'transparent', font: '500 13px/1 var(--f-sans)', color: 'var(--ink)' }}
                  />
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', minHeight: 60 }}>
                  {filtered.length === 0 && (
                    <div style={{ padding: '14px 14px', font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-mute)', textAlign: 'center' }}>
                      Ninguna ciudad coincide con “{q}”. Agregala con el botón de abajo.
                    </div>
                  )}
                  {filtered.map(c => {
                    const sel = c.city === value;
                    return (
                      <button
                        key={c.city}
                        onClick={() => pick(c.city)}
                        style={{
                          width: '100%', padding: '9px 12px', textAlign: 'left',
                          background: sel ? 'var(--wine-tint)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          font: `${sel ? '700' : '500'} 13px/1.2 var(--f-sans)`,
                          color: sel ? 'var(--wine)' : 'var(--ink)',
                          borderBottom: '1px solid var(--border)',
                          transition: 'background var(--dur-fast) var(--ease)',
                        }}
                        onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                        onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.city}</div>
                          {c.state && <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{c.state}</div>}
                        </div>
                        {showDefaultRadius && (
                          <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink-soft)', flexShrink: 0 }}>{c.defaultRadiusKm}km</code>
                        )}
                        {sel && <span style={{ color: 'var(--wine)' }}>{I.check(13)}</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Add new */}
                <button
                  onClick={() => { setMode('add'); setDraft({ city: q, state: '', defaultRadiusKm: 20 }); }}
                  style={{
                    padding: '11px 12px',
                    background: 'var(--bg-elevated)',
                    color: 'var(--wine)',
                    borderTop: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    font: '700 12.5px/1 var(--f-sans)',
                  }}
                >
                  {I.plus(13)} Agregar nueva ciudad al catálogo
                </button>
              </React.Fragment>
            ) : (
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  paddingBottom: 8, borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ font: '800 13px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
                    Nueva ciudad al catálogo
                  </div>
                  <button onClick={() => setMode('list')} aria-label="Volver a la lista" style={{ color: 'var(--ink-soft)', fontSize: 12, font: '600 12px/1 var(--f-sans)' }}>
                    ← Volver
                  </button>
                </div>

                <U.Input
                  label="Ciudad"
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                  placeholder="ej: Acarigua"
                  autoFocus
                />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <U.Input
                    label="Estado"
                    value={draft.state}
                    onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                    placeholder="ej: Portuguesa"
                  />
                  <U.Input
                    label="Código postal"
                    value={draft.postalCode}
                    onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })}
                    placeholder="4 dígitos"
                    mono
                  />
                </div>
                <U.Input
                  label="Municipio (IPOSTEL)"
                  value={draft.municipio}
                  onChange={(e) => setDraft({ ...draft, municipio: e.target.value })}
                  placeholder="ej: Araure"
                />
                <U.Input
                  label="Radio default"
                  type="number"
                  value={String(draft.defaultRadiusKm)}
                  onChange={(e) => setDraft({ ...draft, defaultRadiusKm: e.target.value })}
                  suffix="km"
                  hint="Se precarga cuando uses esta ciudad como parada. Editable después en cada ruta."
                  mono
                />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <U.Btn variant="ghost" size="sm" onClick={() => setMode('list')}>Cancelar</U.Btn>
                  <U.Btn variant="primary" size="sm" icon={I.plus(12)} onClick={handleAdd}>
                    Agregar y seleccionar
                  </U.Btn>
                </div>

                <div style={{
                  marginTop: 4, padding: '8px 10px',
                  background: 'var(--info-bg)', color: 'var(--info)',
                  borderRadius: 'var(--r-sm)',
                  font: '500 10.5px/1.4 var(--f-sans)',
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(11)}</span>
                  <span>Quedará agregada al <b>Catálogo per-tenant</b>. Podrás editar el estado HQ y desactivarla desde la pestaña "Configurable por ciudad".</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Expose ───────────────────────────────────────────────────
  window.AdminSectionRoutes = AdminSectionRoutes;
})();
