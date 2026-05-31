/* global React */
/* ── DTD ERP · TMS · Transporte interno VE ──────────────────── */

const { useState: _tUseState, useMemo: _tUseMemo } = React;

function ModuleTMS({ goTo, currentUser }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [tab, setTab] = _tUseState('overview');
  const [drawer, setDrawer] = _tUseState(null); // 'truck' | 'driver' | 'route' | null

  const trucks = D.TRUCKS;
  const drivers = D.DRIVERS;
  const routes = D.TMS_ROUTES;
  const inRoute = trucks.filter(t => t.status === 'en ruta').length;
  const available = trucks.filter(t => t.status === 'disponible').length;
  const maintenance = trucks.filter(t => t.status === 'mantenimiento').length;
  const driversInRoute = drivers.filter(d => d.status === 'en ruta').length;

  const newBtnLabel = { fleet: 'Nuevo camión', drivers: 'Nuevo chofer', routes: 'Nueva ruta' }[tab] || 'Nueva ruta';
  const newBtnAction = () => {
    if (tab === 'fleet') setDrawer('truck');
    else if (tab === 'drivers') setDrawer('driver');
    else setDrawer('route');
  };

  return (
    <div>
      <U.PageHeader
        title="TMS · Transporte interno VE"
        subtitle="Gestión de la última milla. Flota, choferes, rutas optimizadas y GPS en vivo para entregas DDP."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Reporte semanal</U.Btn>
            <U.Btn variant="primary" icon={window.Icon.plus(14)} onClick={newBtnAction}>{newBtnLabel}</U.Btn>
          </>
        }
      />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Flota total" value={trucks.length} sub={`${trucks.filter(t=>t.owned).length} propios · ${trucks.filter(t=>!t.owned).length} contratados`} tone="wine" icon={window.Icon.truck(18)} />
        <U.KPI label="En ruta ahora" value={inRoute} delta={`${driversInRoute} choferes activos`} tone="info" icon={window.Icon.radar(18)} />
        <U.KPI label="Disponibles" value={available} sub="listos para asignar" tone="success" icon={window.Icon.check(18)} />
        <U.KPI label="Mantenimiento" value={maintenance} delta={maintenance > 0 ? 'requiere atención' : 'todos OK'} tone={maintenance > 0 ? 'warning' : 'success'} icon={window.Icon.cog(18)} />
      </div>

      <U.Tabs value={tab} onChange={setTab} items={[
        { value: 'overview', label: 'GPS en vivo' },
        { value: 'fleet',    label: 'Flota',    count: trucks.length },
        { value: 'drivers',  label: 'Choferes', count: drivers.length },
        { value: 'routes',   label: 'Rutas',    count: routes.length },
        { value: 'incidents',label: 'Incidencias & costos' },
      ]} style={{ marginBottom: 'var(--s-5)' }} />

      {tab === 'overview'  && <GPSLive trucks={trucks} drivers={drivers} routes={routes} goTo={goTo} />}
      {tab === 'fleet'     && <FleetTab trucks={trucks} drivers={drivers} />}
      {tab === 'drivers'   && <DriversTab drivers={drivers} />}
      {tab === 'routes'    && <RoutesTab routes={routes} trucks={trucks} drivers={drivers} goTo={goTo} />}
      {tab === 'incidents' && <IncidentsTab />}

      <TruckForm open={drawer === 'truck'} onClose={() => setDrawer(null)} />
      <DriverForm open={drawer === 'driver'} onClose={() => setDrawer(null)} />
      <RouteForm open={drawer === 'route'} onClose={() => setDrawer(null)} trucks={trucks} drivers={drivers} />
    </div>
  );
}

// ── GPS Live (map + active trucks) ───────────────────────────
function GPSLive({ trucks, drivers, routes, goTo }) {
  const U = window.ERPUI;
  const D = window.ERPData;
  const activeRoutes = routes.filter(r => r.status === 'en ruta');

  // Mock positions on a VE map
  const positions = {
    'T-001': { x: 420, y: 200, label: 'Valencia approach · Acindar' },
    'T-004': { x: 180, y: 130, label: 'Maracaibo · entrando a planta Polar' },
    'T-006': { x: 405, y: 215, label: 'Pto Cabello · cargando contenedor' },
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 14 }}>
      <U.Card padded>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div className="eyebrow eyebrow-wine">MAPA EN VIVO · {activeRoutes.length + 1} VEHÍCULOS</div>
            <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Venezuela · Rutas activas</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'erp-fade 1.5s infinite alternate' }} />
            Actualizado hace 12 seg
          </div>
        </div>

        <VEMap trucks={trucks} positions={positions} />

        <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', display: 'flex', gap: 14, font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
          <span>● <b style={{ color: 'var(--wine)' }}>Wine</b>: en ruta activa</span>
          <span>● <b style={{ color: 'var(--success)' }}>Verde</b>: cargando origen</span>
          <span>● <b style={{ color: 'var(--info)' }}>Azul</b>: ruta planificada</span>
          <span style={{ marginLeft: 'auto' }}>📍 PBL · LGU · MAR · PFI · Caracas · Valencia · Maracay</span>
        </div>
      </U.Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 12 }}>RUTAS ACTIVAS</div>
          {activeRoutes.map(r => {
            const truck = D.TRUCKS.find(t => t.id === r.truck);
            const driver = D.DRIVERS.find(d => d.id === r.driver);
            return (
              <button key={r.id} onClick={() => goTo?.('shipments', r.shipment, 'detail')} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '12px 14px', marginBottom: 8,
                background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--wine)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{truck?.plate}</code>
                  <U.Badge tone="wine" size="sm" dot>en ruta</U.Badge>
                </div>
                <div style={{ font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{driver?.name}</div>
                <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
                  Embarque <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.shipment}</code>
                </div>
                <U.Progress value={r.progress} tone="wine" height={4} style={{ marginTop: 8 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
                  <span>{r.progress}% · {r.distance}km</span>
                  <span>ETA {r.eta.slice(11, 16)}</span>
                </div>
              </button>
            );
          })}
        </U.Card>

        <U.Card padded>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>ALERTAS DE FLOTA</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: 'cog',  tone: 'warning', t: 'T-005 en mantenimiento · 1 día restante', m: 'Vuelve disponible 24 may' },
              { icon: 'warn', tone: 'info',    t: 'T-001 supera 180.000 km',                  m: 'Programar service mayor' },
              { icon: 'clock',tone: 'wine',    t: 'T-006 espera turno cargando',              m: 'PBL · cola 32 min' },
            ].map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 10px', background: `var(--${a.tone}-bg)`, borderRadius: 'var(--r-sm)', borderLeft: `3px solid var(--${a.tone})` }}>
                <span style={{ color: `var(--${a.tone})` }}>{window.Icon[a.icon](13)}</span>
                <div>
                  <div style={{ font: '700 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{a.t}</div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{a.m}</div>
                </div>
              </div>
            ))}
          </div>
        </U.Card>
      </div>
    </div>
  );
}

// VE Map (stylized SVG)
function VEMap({ trucks, positions }) {
  const ports = [
    { code: 'PBL', x: 405, y: 215, label: 'Pto Cabello' },
    { code: 'LGU', x: 480, y: 220, label: 'La Guaira' },
    { code: 'MAR', x: 195, y: 145, label: 'Maracaibo' },
    { code: 'PFI', x: 285, y: 140, label: 'Punto Fijo' },
  ];
  const cities = [
    { name: 'Caracas',   x: 510, y: 230 },
    { name: 'Valencia',  x: 425, y: 235 },
    { name: 'Maracay',   x: 470, y: 240 },
    { name: 'Barquisimeto', x: 330, y: 215 },
  ];

  return (
    <svg viewBox="0 0 720 340" style={{ width: '100%', height: 'auto', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
      {/* Stylized VE shape */}
      <path d="M 120 120 Q 80 180 130 240 Q 200 290 320 285 Q 460 285 560 260 Q 640 240 620 200 Q 580 140 480 130 Q 380 110 280 110 Q 180 105 120 120 Z"
        fill="var(--bg-surface)" stroke="var(--border-strong)" strokeWidth="1.5" />

      {/* Caribbean (north) */}
      <text x="360" y="70" fontFamily="Archivo" fontSize="9.5" fontWeight="700" fill="var(--ink-mute)" textAnchor="middle" letterSpacing="0.2em">MAR CARIBE</text>

      {/* Ports */}
      {ports.map(p => (
        <g key={p.code}>
          <circle cx={p.x} cy={p.y} r="5" fill="var(--ink)" />
          <circle cx={p.x} cy={p.y} r="9" fill="none" stroke="var(--ink)" strokeWidth="1" opacity="0.3" />
          <text x={p.x} y={p.y - 12} fontFamily="Archivo Black" fontSize="9" fill="var(--ink)" textAnchor="middle">{p.label}</text>
        </g>
      ))}

      {/* Cities */}
      {cities.map(c => (
        <g key={c.name}>
          <circle cx={c.x} cy={c.y} r="3" fill="var(--ink-soft)" />
          <text x={c.x + 6} y={c.y + 3} fontFamily="Archivo" fontSize="9" fontWeight="600" fill="var(--ink-soft)">{c.name}</text>
        </g>
      ))}

      {/* Trucks */}
      {Object.entries(positions).map(([id, p]) => {
        const truck = trucks.find(t => t.id === id);
        if (!truck) return null;
        const color = truck.status === 'en ruta' ? 'var(--wine)' : truck.status === 'cargando' ? 'var(--success)' : 'var(--info)';
        return (
          <g key={id}>
            <circle cx={p.x} cy={p.y} r="18" fill={color} opacity="0.15">
              <animate attributeName="r" values="14;22;14" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={p.x} cy={p.y} r="9" fill={color} stroke="#fff" strokeWidth="2.5" />
            <text x={p.x} y={p.y + 3} fontFamily="Archivo Black" fontSize="8" fill="#fff" textAnchor="middle">🚚</text>
            <text x={p.x} y={p.y - 22} fontFamily="Archivo Black" fontSize="9" fill={color} textAnchor="middle">{truck.plate}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Fleet tab ─────────────────────────────────────────────────
function FleetTab({ trucks, drivers }) {
  const U = window.ERPUI;
  const statusTone = { 'en ruta': 'wine', 'disponible': 'success', 'cargando': 'info', 'mantenimiento': 'warning' };
  const cols = [
    { label: 'Patente', key: 'plate', render: (r) => <code style={{ font: '800 12.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.plate}</code>, width: 100 },
    { label: 'Vehículo', key: 'brand', render: (r) => (
      <div>
        <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{r.brand}</div>
        <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{r.type}</div>
      </div>
    )},
    { label: 'Hub', key: 'hub', render: (r) => <U.Badge tone="info" size="sm">{r.hub}</U.Badge>, width: 70 },
    { label: 'Propiedad', key: 'owned', render: (r) => r.owned ? <U.Badge tone="success" size="sm">propio</U.Badge> : <U.Badge tone="warning" size="sm">contratado</U.Badge>, width: 100 },
    { label: 'Capacidad', key: 'cap', render: (r) => (
      <div>
        <div className="mono" style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.capacityCBM} CBM</div>
        <div style={{ font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 3 }}>{(r.capacityKg/1000).toFixed(0)}t</div>
      </div>
    )},
    { label: 'Chofer', key: 'driver', render: (r) => {
      const d = drivers.find(x => x.id === r.driver);
      return d ? (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <U.Avatar initials={d.name.split(' ').map(w=>w[0]).slice(0,2).join('')} size={24} color="wine" />
          <span style={{ font: '500 12px/1 var(--f-sans)' }}>{d.name.split(' ')[0]}</span>
        </div>
      ) : <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>—</span>;
    }},
    { label: 'Km', key: 'km', align: 'right', render: (r) => <span className="mono" style={{ font: '600 11.5px/1 var(--f-mono)', color: r.km > 200000 ? 'var(--warning)' : 'var(--ink-soft)' }}>{(r.km/1000).toFixed(0)}K</span>, width: 70 },
    { label: 'Estado', key: 'status', render: (r) => <U.Badge tone={statusTone[r.status]} size="sm" dot>{r.status}</U.Badge>, width: 130 },
  ];

  return <U.Table columns={cols} rows={trucks} onRowClick={(r) => window.open(`nuevo/pantallas/camion-perfil.html?id=${r.id}`, '_blank')} />;
}

// ── Drivers tab ──────────────────────────────────────────────
function DriversTab({ drivers }) {
  const U = window.ERPUI;
  const statusTone = { 'en ruta': 'wine', 'disponible': 'success', 'cargando': 'info', 'descanso': 'neutral' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
      {drivers.map(d => (
        <U.Card key={d.id} padded hoverable
          onClick={() => window.open(`nuevo/pantallas/chofer-perfil.html?id=${d.id}`, '_blank')}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <U.Avatar initials={d.name.split(' ').map(w=>w[0]).slice(0,2).join('')} size={44} color="wine" />
            <div style={{ flex: 1 }}>
              <div style={{ font: '900 14px/1.1 var(--f-display)', color: 'var(--ink)' }}>{d.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <U.Badge tone={statusTone[d.status]} size="sm" dot>{d.status}</U.Badge>
                <span style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>· {d.exp}a exp</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ font: '900 16px/1 var(--f-display)', color: 'var(--wine)' }}>★ {d.rating}</div>
              <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>rating</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Licencia</div>
              <div style={{ font: '700 11px/1.2 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{d.license}</div>
            </div>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Hub base</div>
              <div style={{ font: '700 11.5px/1 var(--f-sans)', color: 'var(--ink)', marginTop: 4 }}>{d.hub}</div>
            </div>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Viajes 30d</div>
              <div style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4 }}>{d.trips30d}</div>
            </div>
            <div>
              <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Teléfono</div>
              <code style={{ font: '700 11px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4, display: 'block' }}>{d.phone}</code>
            </div>
          </div>
          <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
            Último viaje: <span style={{ color: 'var(--ink)' }}>{d.lastTrip}</span>
          </div>
        </U.Card>
      ))}
    </div>
  );
}

// ── Routes tab ───────────────────────────────────────────────
function RoutesTab({ routes, trucks, drivers, goTo }) {
  const U = window.ERPUI;
  const statusTone = { 'en ruta': 'wine', 'completado': 'success', 'planificado': 'info' };
  return (
    <U.Card padded={false}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 130px 1fr 100px 90px 110px', padding: '12px 18px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
        {['Ruta', 'Embarque', 'Paradas', 'Distancia', 'Progreso', 'Estado'].map(h => (
          <span key={h} style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</span>
        ))}
      </div>
      {routes.map((r, i) => {
        const truck = trucks.find(t => t.id === r.truck);
        const driver = drivers.find(d => d.id === r.driver);
        return (
          <div key={r.id} style={{
            display: 'grid', gridTemplateColumns: '120px 130px 1fr 100px 90px 110px',
            padding: '14px 18px', gap: 14, alignItems: 'center',
            borderTop: i > 0 ? '1px solid var(--border)' : 0, cursor: 'pointer',
          }}
          onClick={() => goTo?.('shipments', r.shipment, 'detail')}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{r.id}</code>
              <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{truck?.plate}</div>
            </div>
            <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{r.shipment}</code>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {r.stops.map((s, j) => (
                <React.Fragment key={j}>
                  {j > 0 && <span style={{ color: 'var(--wine)' }}>→</span>}
                  <span style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)' }}>{s.split('·')[1]?.trim() || s}</span>
                </React.Fragment>
              ))}
            </div>
            <span className="mono" style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{r.distance} km</span>
            <div style={{ width: 80 }}>
              <U.Progress value={r.progress} tone={r.progress === 100 ? 'success' : 'wine'} height={4} />
              <div style={{ font: '600 10px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4, textAlign: 'right' }}>{r.progress}%</div>
            </div>
            <U.Badge tone={statusTone[r.status]} size="sm" dot>{r.status}</U.Badge>
          </div>
        );
      })}
    </U.Card>
  );
}

// ── Incidents tab ────────────────────────────────────────────
function IncidentsTab() {
  const D = window.ERPData;
  const U = window.ERPUI;
  const I = window.Icon;
  window.__tmsIncidents = window.__tmsIncidents || D.TMS_INCIDENTS.map(x => ({ ...x }));
  const [list, setList] = React.useState(window.__tmsIncidents);
  const [editing, setEditing] = React.useState(null); // incident object or {} for new
  const total = list.reduce((s, i) => s + (Number(i.cost) || 0), 0);
  const typeTone = { mantenimiento: 'warning', multa: 'danger', combustible: 'info', otro: 'neutral' };

  const save = (inc) => {
    setList(prev => {
      let next;
      if (inc.id && prev.some(x => x.id === inc.id)) next = prev.map(x => x.id === inc.id ? inc : x);
      else next = [{ ...inc, id: inc.id || ('INC-' + Date.now()) }, ...prev];
      window.__tmsIncidents = next;
      return next;
    });
    setEditing(null);
  };
  const remove = (id) => {
    setList(prev => { const next = prev.filter(x => x.id !== id); window.__tmsIncidents = next; return next; });
    setEditing(null);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 'var(--s-5)' }}>
        <U.KPI label="Total mes" value={`$${total}`} sub={`${list.length} eventos`} tone="warning" icon={window.Icon.invoice(18)} />
        <U.KPI label="Combustible" value={`$${list.filter(i=>i.type==='combustible').reduce((s,i)=>s+(Number(i.cost)||0),0)}`} sub="mensual" tone="info" />
        <U.KPI label="Mantenimientos" value={list.filter(i=>i.type==='mantenimiento').length} sub="programados" tone="wine" />
        <U.KPI label="Multas" value={list.filter(i=>i.type==='multa').length} delta={`$${list.filter(i=>i.type==='multa').reduce((s,i)=>s+(Number(i.cost)||0),0)} acumulado`} tone="danger" />
      </div>

      <U.Card padded={false}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="eyebrow eyebrow-wine">INCIDENCIAS · ÚLTIMOS 30 DÍAS</div>
          <U.Btn variant="primary" size="sm" icon={I.plus(13)} onClick={() => setEditing({ type: 'mantenimiento', status: 'abierta', date: '2026-05-31', severity: 'media' })}>Registrar incidencia</U.Btn>
        </div>
        {list.length === 0 ? (
          <div style={{ padding: '24px 18px', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin incidencias registradas. Tocá "Registrar incidencia" para agregar una.</div>
        ) : list.map((inc, i) => (
          <div key={inc.id} onClick={() => setEditing(inc)} style={{
            display: 'grid', gridTemplateColumns: '110px 80px 100px 1fr 100px 90px',
            padding: '14px 18px', gap: 14, alignItems: 'center', cursor: 'pointer',
            borderTop: i > 0 ? '1px solid var(--border)' : 0,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{inc.id}</code>
            <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{inc.truck}</code>
            <span className="mono" style={{ font: '500 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{inc.date}</span>
            <div>
              <U.Badge tone={typeTone[inc.type]} size="sm">{inc.type}</U.Badge>
              <span style={{ marginLeft: 10, font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{inc.desc}</span>
            </div>
            <span className="mono" style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--warning)', textAlign: 'right' }}>${inc.cost}</span>
            <U.Badge tone="neutral" size="sm">{inc.status}</U.Badge>
          </div>
        ))}
      </U.Card>

      <IncidentEditor incident={editing} onClose={() => setEditing(null)} onSave={save} onDelete={remove} />
    </div>
  );
}

// ── Incident editor (drawer) ─────────────────────────────────
function IncidentEditor({ incident, onClose, onSave, onDelete }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const D = window.ERPData;
  const isEdit = incident && incident.id;
  const [f, setF] = React.useState(incident || {});
  React.useEffect(() => { setF(incident || {}); }, [incident]);
  if (!incident) return null;
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const trucks = (D.TRUCKS || []).map(t => t.plate);

  return (
    <U.Drawer open={!!incident} onClose={onClose} title={isEdit ? `Incidencia ${incident.id}` : 'Registrar incidencia'} subtitle="Mantenimiento · multa · combustible · otros costos de flota" width={560}
      actions={<>
        {isEdit && <U.Btn variant="ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => onDelete(incident.id)}>Eliminar</U.Btn>}
        <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
        <U.Btn variant="primary" icon={I.check(13)} disabled={!f.truck || !f.desc} onClick={() => onSave(f)}>{isEdit ? 'Guardar cambios' : 'Registrar'}</U.Btn>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Tipo" value={f.type || 'mantenimiento'} onChange={(e) => set('type', e.target.value)} options={[
            { value: 'mantenimiento', label: 'Mantenimiento' }, { value: 'multa', label: 'Multa' }, { value: 'combustible', label: 'Combustible' }, { value: 'otro', label: 'Otro' },
          ]} />
          <U.Select label="Severidad" value={f.severity || 'media'} onChange={(e) => set('severity', e.target.value)} options={[
            { value: 'baja', label: 'Baja' }, { value: 'media', label: 'Media' }, { value: 'alta', label: 'Alta' },
          ]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Camión" value={f.truck || ''} onChange={(e) => set('truck', e.target.value)} options={[{ value: '', label: 'Seleccioná patente…' }, ...trucks.map(p => ({ value: p, label: p }))]} />
          <U.Input label="Fecha" type="date" value={f.date || ''} onChange={(e) => set('date', e.target.value)} mono />
        </div>
        <U.Input label="Descripción" value={f.desc || ''} onChange={(e) => set('desc', e.target.value)} placeholder="Ej: Cambio de frenos delanteros · revisión preventiva" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Costo" type="number" value={f.cost || ''} onChange={(e) => set('cost', Number(e.target.value))} prefix="$" mono />
          <U.Select label="Estado" value={f.status || 'abierta'} onChange={(e) => set('status', e.target.value)} options={[
            { value: 'abierta', label: 'Abierta' }, { value: 'en proceso', label: 'En proceso' }, { value: 'resuelta', label: 'Resuelta' }, { value: 'pagada', label: 'Pagada' },
          ]} />
        </div>
      </div>
    </U.Drawer>
  );
}

window.ModuleTMS = ModuleTMS;

// ── Truck form ──────────────────────────────────────────────
function TruckForm({ open, onClose }) {
  const U = window.ERPUI;
  return (
    <U.Drawer open={open} onClose={onClose} title="Nuevo camión" subtitle="Agregar vehículo a la flota DTD-Cargo" width={580}
      actions={<><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={window.Icon.check(13)}>Agregar a flota</U.Btn></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Patente" placeholder="AB123CD" mono />
          <U.Select label="Tipo" options={["Semi 40'", "Semi 40'HC", "Furgón 24'", "Furgón 18'", "Camión 350", "Camión 750"]} />
        </div>
        <U.Input label="Marca y modelo" placeholder="Ej: Volvo FH · Mercedes Atego · Iveco Daily" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Hub base" options={['PBL · Puerto Cabello', 'LGU · La Guaira', 'MAR · Maracaibo', 'PFI · Punto Fijo']} />
          <U.Select label="Propiedad" options={['Propio · DTD-Cargo', 'Contratado · proveedor externo']} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <U.Input label="Capacidad" placeholder="30000" suffix="kg" mono />
          <U.Input label="Volumen" placeholder="76" suffix="m³" mono />
          <U.Input label="Km actuales" placeholder="0" mono />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Combustible" options={['Diesel', 'Gasolina 95', 'Gasolina 91', 'Gas (GNC/GLP)']} />
          <U.Input label="Rendimiento" placeholder="8.0" suffix="km/l" mono />
        </div>
        <U.Input label="Próximo service" type="date" mono />
        <U.Input label="Notas" placeholder="Seguro, RPC, observaciones técnicas, restricciones de carga…" />
      </div>
    </U.Drawer>
  );
}

// ── Driver form ─────────────────────────────────────────────
function DriverForm({ open, onClose }) {
  const U = window.ERPUI;
  return (
    <U.Drawer open={open} onClose={onClose} title="Nuevo chofer" subtitle="Alta de conductor para flota DTD" width={560}
      actions={<><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="primary" icon={window.Icon.check(13)}>Crear chofer</U.Btn></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Nombre" />
          <U.Input label="Apellido" />
        </div>
        <U.Input label="Cédula" placeholder="V-12.345.678" mono />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Teléfono" placeholder="+58 412 000 0000" mono />
          <U.Input label="Email (opcional)" type="email" placeholder="chofer@dtdcargo.com" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Licencia de conducir" options={['A · B · C', 'A · B · C · D', 'A · B · C · D · E', 'B · C · D']} />
          <U.Input label="Vence licencia" type="date" mono />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Hub base" options={['PBL', 'LGU', 'MAR', 'PFI']} />
          <U.Input label="Años de experiencia" placeholder="5" mono />
        </div>
        <U.Input label="Dirección" placeholder="Av. Bolívar, Valencia" />
        <U.Input label="Contacto de emergencia" placeholder="Nombre · teléfono" />
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
          <input type="checkbox" defaultChecked style={{ accentColor: 'var(--wine)', width: 16, height: 16 }} />
          <span style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink)' }}>Cuenta con cursos de seguridad vial vigentes</span>
        </label>
      </div>
    </U.Drawer>
  );
}

// ── Route form ──────────────────────────────────────────────
function RouteForm({ open, onClose, trucks, drivers }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const [stops, setStops] = React.useState(['', '']);
  React.useEffect(() => { if (open) setStops(['', '']); }, [open]);

  const addStop = () => setStops([...stops, '']);
  const removeStop = (i) => setStops(stops.filter((_, idx) => idx !== i));
  const setStop = (i, v) => setStops(stops.map((s, idx) => idx === i ? v : s));

  return (
    <U.Drawer open={open} onClose={onClose} title="Nueva ruta de entrega" subtitle="Asignar embarque + camión + chofer + paradas" width={640}
      actions={<><U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn><U.Btn variant="secondary">Guardar borrador</U.Btn><U.Btn variant="primary" icon={window.Icon.truck(13)}>Crear ruta</U.Btn></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <U.Select label="Embarque a entregar" options={[
          { value: '', label: 'Seleccioná embarque liberado…' },
          ...D.SHIPMENTS.filter(s => ['liberado', 'aduana VE'].includes(s.status)).map(s => ({ value: s.id, label: `${s.id} · ${s.clientName} · ${D.dest(s.destination).name}` })),
        ]} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Select label="Camión asignado" options={[
            { value: '', label: 'Elegí camión disponible…' },
            ...trucks.filter(t => t.status === 'disponible').map(t => ({ value: t.id, label: `${t.plate} · ${t.brand} (${t.capacityCBM} CBM)` })),
          ]} />
          <U.Select label="Chofer" options={[
            { value: '', label: 'Elegí chofer disponible…' },
            ...drivers.filter(d => d.status === 'disponible').map(d => ({ value: d.id, label: `${d.name} · ★ ${d.rating}` })),
          ]} />
        </div>

        {/* Stops builder */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Paradas de la ruta</span>
            <U.Badge tone="wine" size="sm">{stops.length} {stops.length === 1 ? 'parada' : 'paradas'}</U.Badge>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {stops.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 36px', gap: 8, alignItems: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: i === 0 ? 'var(--ink)' : i === stops.length - 1 ? 'var(--wine)' : 'var(--bg-elevated)',
                  color: i === 0 || i === stops.length - 1 ? '#fff' : 'var(--ink)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  font: '800 12px/1 var(--f-mono)',
                }}>{i + 1}</div>
                <input value={s} onChange={(e) => setStop(i, e.target.value)} placeholder={i === 0 ? 'Puerto de origen (ej: PBL · Terminal Bolipuertos)' : i === stops.length - 1 ? 'Destino final (ej: Valencia · ZI Acindar)' : 'Parada intermedia'}
                  style={{ height: 38, padding: '0 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '500 13px/1 var(--f-sans)', color: 'var(--ink)', outline: 'none' }}
                />
                {stops.length > 2 && (
                  <button onClick={() => removeStop(i)} style={{ width: 32, height: 32, color: 'var(--ink-soft)', borderRadius: 'var(--r-sm)' }} title="Quitar parada">{window.Icon.trash(13)}</button>
                )}
                {stops.length <= 2 && <div />}
              </div>
            ))}
          </div>
          <button onClick={addStop} style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 'var(--r-md)',
            border: '1px dashed var(--border-strong)',
            font: '600 12px/1 var(--f-sans)', color: 'var(--wine)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>{window.Icon.plus(11)} Agregar parada intermedia</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <U.Input label="Distancia estimada" placeholder="168" suffix="km" mono />
          <U.Input label="ETA salida" type="datetime-local" mono />
        </div>

        <U.Input label="Notas para el chofer" placeholder="Horarios de carga, contacto en destino, observaciones…" />

        <div style={{ padding: '12px 14px', background: 'var(--info-bg)', borderRadius: 'var(--r-md)', display: 'flex', gap: 10 }}>
          <span style={{ color: 'var(--info)' }}>{window.Icon.info(13)}</span>
          <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink)' }}>
            Al crear la ruta se notifica automáticamente al chofer por WhatsApp con las paradas + Google Maps link. El camión queda <b>asignado</b> hasta completar.
          </div>
        </div>
      </div>
    </U.Drawer>
  );
}
