/* global React */
/* ── DTD ERP · Tracking en vivo ─────────────────────────────── */

function ModuleTracking({ goTo, selectedId, setSelectedId }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const active = D.SHIPMENTS.filter(s => !['entregado', 'estimado'].includes(s.status));
  const [selectedShip, setSelectedShip] = React.useState(selectedId || active[0]?.id);

  const ship = active.find(s => s.id === selectedShip) || active[0];

  return (
    <div>
      <U.PageHeader
        title="Tracking en vivo"
        subtitle="Posición actual, ETA y eventos de cada embarque. Datos sincronizados cada 15 minutos vía AIS."
        actions={
          <>
            <U.Btn variant="secondary" icon={window.Icon.refresh(14)}>Actualizar</U.Btn>
            <U.Btn variant="secondary" icon={window.Icon.download(14)}>Reporte diario</U.Btn>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Left: shipment list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <U.Toolbar search="" onSearchChange={()=>{}} searchPlaceholder="Buscar embarque…" style={{ marginBottom: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 580, overflowY: 'auto', paddingRight: 4 }}>
            {active.map(s => {
              const isActive = s.id === selectedShip;
              return (
                <button key={s.id} onClick={() => setSelectedShip(s.id)} style={{
                  width: '100%', textAlign: 'left',
                  padding: '12px 14px',
                  background: isActive ? 'var(--wine-tint)' : 'var(--bg-surface)',
                  border: `1px solid ${isActive ? 'var(--wine)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <code style={{ font: '800 12px/1 var(--f-mono)', color: isActive ? 'var(--wine)' : 'var(--ink)' }}>{s.id}</code>
                    <U.StatusBadge status={s.status} size="sm" />
                  </div>
                  <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{s.clientName}</div>
                  <div style={{ font: '500 11px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                    {D.origin(s.origin).name} → {D.dest(s.destination).name}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <U.Progress value={s.progress} tone={s.alert ? 'warning' : 'wine'} height={4} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
                    <span>{s.progress}%</span>
                    <span>ETA {s.eta?.slice(5) || '—'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: map + timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ship && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <U.Btn variant="secondary" icon={window.Icon.users(13)} onClick={() => goTo('clients', ship.client, 'detail')}>Ver cliente</U.Btn>
              <U.Btn variant="primary" icon={window.Icon.box(13)} onClick={() => goTo('shipments', ship.id, 'detail')}>Ver detalle completo</U.Btn>
            </div>
          )}
          {ship && <TrackingMap ship={ship} />}
          {ship && <TrackingTimeline ship={ship} />}
        </div>
      </div>
    </div>
  );
}

function TrackingMap({ ship }) {
  const D = window.ERPData;
  const U = window.ERPUI;
  const ox = 180, dx = 720, py = 200;
  // Position by progress
  const cx = ox + (dx - ox) * (ship.progress / 100);
  return (
    <U.Card padded={false} style={{ overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>POSICIÓN ACTUAL</div>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>{ship.id} · {ship.vessel || 'sin asignar'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>ETA {D.dest(ship.destination).name}</div>
          <div style={{ font: '800 16px/1 var(--f-mono)', color: ship.alert ? 'var(--warning)' : 'var(--ink)', marginTop: 4 }}>{ship.eta || '—'}</div>
        </div>
      </div>

      <div style={{ position: 'relative', height: 320, background: 'var(--bg-elevated)' }}>
        <svg viewBox="0 0 900 320" style={{ width: '100%', height: '100%' }}>
          {/* Stylized continents */}
          <path d="M30 80 L240 70 L260 120 L210 180 L130 200 L40 170 Z" fill="var(--bg-surface)" stroke="var(--border)" strokeWidth="1" />
          <path d="M620 70 L850 80 L870 160 L810 200 L700 190 L640 150 Z" fill="var(--bg-surface)" stroke="var(--border)" strokeWidth="1" />
          <path d="M270 200 L480 230 L500 280 L380 300 L290 270 Z" fill="var(--bg-surface)" stroke="var(--border)" strokeWidth="1" />

          {/* Route path */}
          <path d={`M ${ox} ${py} Q 450 ${py - 80} ${dx} ${py}`} fill="none" stroke="var(--wine-soft)" strokeWidth="2" strokeDasharray="5 5" />
          <path d={`M ${ox} ${py} Q 450 ${py - 80} ${cx} ${py - (ship.progress < 50 ? ship.progress * 1.6 : (100 - ship.progress) * 1.6)}`}
                fill="none" stroke="var(--wine)" strokeWidth="3" />

          {/* Origin */}
          <circle cx={ox} cy={py} r="9" fill="var(--ink)" />
          <circle cx={ox} cy={py} r="3" fill="#fff" />
          <text x={ox} y={py + 28} fontFamily="Archivo Black" fontSize="11" fill="var(--ink)" textAnchor="middle">{D.origin(ship.origin).name}</text>
          <text x={ox} y={py + 42} fontFamily="Noto Sans SC" fontSize="9" fill="var(--ink-soft)" textAnchor="middle">{D.origin(ship.origin).cn}</text>

          {/* Destination */}
          <circle cx={dx} cy={py} r="9" fill="var(--wine)" />
          <circle cx={dx} cy={py} r="3" fill="#fff" />
          <text x={dx} y={py + 28} fontFamily="Archivo Black" fontSize="11" fill="var(--ink)" textAnchor="middle">{D.dest(ship.destination).name}</text>
          <text x={dx} y={py + 42} fontFamily="Archivo" fontSize="9" fontWeight="600" fill="var(--ink-soft)" textAnchor="middle">Venezuela</text>

          {/* Current vessel */}
          <g transform={`translate(${cx}, ${py - (ship.progress < 50 ? ship.progress * 1.6 : (100 - ship.progress) * 1.6)})`}>
            <circle r="14" fill="var(--wine)" opacity="0.2">
              <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle r="8" fill="var(--wine)" stroke="#fff" strokeWidth="2" />
            <text y="-22" fontFamily="Archivo Black" fontSize="10" fill="var(--wine)" textAnchor="middle">{ship.progress}%</text>
          </g>
        </svg>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', borderTop: '1px solid var(--border)' }}>
        {[
          { l: 'Progreso', v: `${ship.progress}%`, t: ship.alert ? 'warning' : 'wine' },
          { l: 'Días restantes', v: Math.max(0, Math.round((100 - ship.progress) * 0.3)), t: 'neutral' },
          { l: 'Velocidad', v: '17.4 kn', t: 'neutral' },
          { l: 'Próximo hito', v: ship.progress < 30 ? 'Pacífico' : ship.progress < 70 ? 'Canal Panamá' : 'Aduana VE', t: 'neutral' },
        ].map((k, i) => (
          <div key={k.l} style={{ padding: '14px 18px', borderRight: i < 3 ? '1px solid var(--border)' : 0 }}>
            <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{k.l}</div>
            <div style={{ font: '800 18px/1 var(--f-display)', color: k.t === 'wine' ? 'var(--wine)' : k.t === 'warning' ? 'var(--warning)' : 'var(--ink)', marginTop: 6 }}>{k.v}</div>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

function TrackingTimeline({ ship }) {
  const U = window.ERPUI;
  const D = window.ERPData;
  const flow = D.STATUS_FLOW;
  const cur = flow.indexOf(ship.status);
  const events = flow.map((step, i) => ({
    step,
    state: i < cur ? 'done' : i === cur ? 'active' : 'pending',
    meta: i < cur ? 'completado' : i === cur ? 'en curso · HOY' : 'pendiente',
  }));

  return (
    <U.Card>
      <div className="eyebrow eyebrow-wine" style={{ marginBottom: 16 }}>EVENTOS DEL EMBARQUE</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {events.map((e, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, position: 'relative', padding: '10px 0' }}>
            {i < events.length - 1 && (
              <div style={{ position: 'absolute', left: 9, top: 22, bottom: -4, width: 2, background: e.state === 'done' ? 'var(--wine)' : 'var(--border)' }} />
            )}
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: e.state === 'done' || e.state === 'active' ? 'var(--wine)' : 'var(--bg-elevated)',
              border: `2px solid ${e.state === 'done' || e.state === 'active' ? 'var(--wine)' : 'var(--border-strong)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: e.state === 'done' || e.state === 'active' ? '#fff' : 'var(--ink-mute)',
              font: '700 10px/1 var(--f-sans)', marginTop: 2,
              animation: e.state === 'active' ? 'erp-pop 0.5s var(--ease)' : 'none',
            }}>{e.state === 'done' ? '✓' : i + 1}</div>
            <div style={{ flex: 1, paddingBottom: 8 }}>
              <div style={{
                font: `${e.state === 'active' ? '800' : '600'} 13.5px/1.2 var(--f-sans)`,
                color: e.state === 'pending' ? 'var(--ink-mute)' : 'var(--ink)',
                textTransform: 'capitalize',
              }}>{e.step}</div>
              <div style={{ font: '500 11.5px/1 var(--f-sans)', color: e.state === 'active' ? 'var(--wine)' : 'var(--ink-mute)', marginTop: 3, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{e.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </U.Card>
  );
}

window.ModuleTracking = ModuleTracking;
