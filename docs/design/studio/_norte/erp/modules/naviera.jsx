/* global React */
/* ── DTD ERP · Naviera & Consolidación · v1.9.1 ─────────────── */
/* La naviera como entidad: itinerarios, reservas de espacio y   */
/* consolidación de contenedor LCL→FCL con optimización de CBM.  */

function ModuleNaviera({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NavieraData;
  const [tab, setTab] = React.useState('dashboard');

  return (
    <div>
      <U.PageHeader
        eyebrow="OPERACIÓN · LOGÍSTICA MARÍTIMA"
        title="Naviera & Consolidación"
        subtitle={`${N.openSailings().length} salidas con espacio · ${N.consolidating().length} contenedores en consolidación · ${N.totalLooseCbm().toFixed(1)} CBM de carga suelta en CN`}
        actions={
          <>
            <U.Btn variant="secondary" icon={I.refresh(14)}>Sincronizar itinerarios</U.Btn>
            <U.Btn variant="primary" icon={I.plus(14)} onClick={() => setTab('bookings')}>Nueva reserva</U.Btn>
          </>
        }
      />

      <U.Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'dashboard',   label: 'Dashboard' },
          { value: 'sailings',    label: 'Itinerarios', count: N.SAILINGS.length },
          { value: 'bookings',    label: 'Reservas', count: N.BOOKINGS.length },
          { value: 'consolidation', label: 'Consolidación', count: N.consolidating().length },
        ]}
        style={{ marginBottom: 'var(--s-5)' }}
      />

      {tab === 'dashboard'     && <DashboardTab goTo={goTo} setTab={setTab} />}
      {tab === 'sailings'      && <SailingsTab goTo={goTo} />}
      {tab === 'bookings'      && <BookingsTab goTo={goTo} />}
      {tab === 'consolidation' && <ConsolidationTab goTo={goTo} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════════
function DashboardTab({ goTo, setTab }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NavieraData;

  const consol = N.consolidating();
  const avgUtil = consol.length ? consol.reduce((s, c) => s + N.containerStats(c).cbmPct, 0) / consol.length : 0;
  const nextCutoff = N.SAILINGS.filter(s => s.status === 'cutoff' || s.status === 'abierto')
    .sort((a, b) => a.cutoff.localeCompare(b.cutoff))[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <U.KPI label="Salidas con espacio" value={N.openSailings().length} delta={`${N.CARRIERS.length} navieras · CN→VE`} tone="wine" icon={I.ship(18)} />
        <U.KPI label="Contenedores consolidando" value={consol.length} delta={`Utilización media ${avgUtil.toFixed(0)}%`} tone="warning" icon={I.box(18)} />
        <U.KPI label="Carga suelta en CN" value={`${N.totalLooseCbm().toFixed(1)} CBM`} delta={`${N.LOOSE_CARGO.length} embarques sin asignar`} tone="info" icon={I.warehouse(18)} />
        <U.KPI label="Próximo cut-off" value={nextCutoff ? `${N.daysUntil(nextCutoff.cutoff)}d` : '—'} delta={nextCutoff ? `${N.carrier(nextCutoff.carrier).name.split(' ')[0]} · ${nextCutoff.cutoff.slice(5)}` : ''} tone={nextCutoff && N.daysUntil(nextCutoff.cutoff) <= 3 ? 'danger' : 'neutral'} icon={I.clock(18)} />
      </div>

      {/* Consolidación en curso · ocupación */}
      <U.Card padded={false}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="eyebrow eyebrow-wine">CONSOLIDACIÓN EN CURSO</div>
            <div style={{ font: '900 14px/1 var(--f-display)', color: 'var(--ink)', marginTop: 6 }}>Ocupación de contenedores LCL → FCL</div>
          </div>
          <button onClick={() => setTab('consolidation')} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Gestionar {I.arrowR(11)}
          </button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {consol.map(c => {
            const st = N.containerStats(c);
            const s = N.sailing(c.sailing);
            return (
              <div key={c.id} onClick={() => setTab('consolidation')} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{c.ref}</code>
                    <U.Badge tone="neutral" size="sm">{N.ctype(c.type).label}</U.Badge>
                    <span style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{st.clients} clientes · {st.pieces} piezas</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{s ? `${N.port(s.pol).name} → ${N.port(s.pod).name}` : ''}</span>
                    <span style={{ font: '800 13px/1 var(--f-mono)', color: st.cbmPct > 90 ? 'var(--success)' : st.cbmPct > 70 ? 'var(--warning)' : 'var(--wine)' }}>{st.cbmPct.toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <U.Progress value={st.cbmPct} tone={st.cbmPct > 90 ? 'success' : st.cbmPct > 70 ? 'warning' : 'wine'} height={10} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, font: '500 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
                  <span>{st.usedCbm.toFixed(1)} / {st.cap.cbm} CBM</span>
                  <span>Libre: {st.freeCbm.toFixed(1)} CBM · {(st.freeKg / 1000).toFixed(1)} t</span>
                </div>
              </div>
            );
          })}
        </div>
      </U.Card>

      {/* 2-col: próximas salidas + carga suelta */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <U.Card padded={false}>
          <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)' }}>
            <div className="eyebrow eyebrow-wine">PRÓXIMAS SALIDAS</div>
          </div>
          <div>
            {N.openSailings().sort((a, b) => a.cutoff.localeCompare(b.cutoff)).map((s, i) => {
              const car = N.carrier(s.carrier);
              const d = N.daysUntil(s.cutoff);
              return (
                <div key={s.id} onClick={() => setTab('sailings')} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
                  padding: '12px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 0, cursor: 'pointer',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${car.tone})` }} />
                      <span style={{ font: '600 12.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{car.name}</span>
                    </div>
                    <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>
                      {N.port(s.pol).name} → {N.port(s.pod).name} · {s.vessel} {s.voyage}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <U.Badge tone={N.SPACE_TONE[s.space]} size="sm">{s.space === 'cerrada' ? 'sin espacio' : `espacio ${s.space}`}</U.Badge>
                    <div style={{ font: '700 10px/1 var(--f-sans)', color: d <= 3 ? 'var(--danger)' : 'var(--ink-mute)', marginTop: 5 }}>cut-off en {d}d</div>
                  </div>
                </div>
              );
            })}
          </div>
        </U.Card>

        <U.Card padded={false}>
          <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="eyebrow eyebrow-wine">CARGA SUELTA EN CN</div>
            <span style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{N.totalLooseCbm().toFixed(1)} CBM</span>
          </div>
          <div>
            {N.LOOSE_CARGO.map((l, i) => (
              <div key={l.markbox} style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center',
                padding: '12px 20px', borderTop: i > 0 ? '1px solid var(--border)' : 0,
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{l.markbox}</code>
                    <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{l.client}</span>
                  </div>
                  <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{N.port(l.pol).name} · {l.pieces} piezas · listo {l.readyDate.slice(5)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '800 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{l.cbm.toFixed(1)}</div>
                  <div style={{ font: '500 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>CBM</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
            <U.Btn variant="soft" size="sm" full icon={I.plus(12)} onClick={() => setTab('consolidation')}>Asignar a contenedor</U.Btn>
          </div>
        </U.Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Itinerarios (sailings)
// ════════════════════════════════════════════════════════════════
function SailingsTab({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NavieraData;
  const [search, setSearch] = React.useState('');
  const [carrierFilter, setCarrierFilter] = React.useState('all');

  const filtered = N.SAILINGS.filter(s => {
    if (carrierFilter !== 'all' && s.carrier !== carrierFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const car = N.carrier(s.carrier);
      if (!s.vessel.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !car.name.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => a.etd.localeCompare(b.etd));

  return (
    <div>
      <U.Toolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por buque, naviera o ruta…"
        filters={
          <U.Select value={carrierFilter} onChange={(e) => setCarrierFilter(e.target.value)} options={[
            { value: 'all', label: 'Todas las navieras' },
            ...N.CARRIERS.map(c => ({ value: c.id, label: c.name })),
          ]} style={{ minWidth: 190 }} />
        }
      />

      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.3fr 1fr 100px 100px 110px 130px', gap: 14,
          padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span>Naviera · buque</span>
          <span>Ruta</span>
          <span>ETD</span>
          <span>Cut-off</span>
          <span>Tránsito</span>
          <span style={{ textAlign: 'right' }}>Estado</span>
        </div>
        {filtered.map((s, i) => {
          const car = N.carrier(s.carrier);
          const d = N.daysUntil(s.cutoff);
          const st = N.SAILING_STATUS[s.status];
          return (
            <div key={s.id} style={{
              display: 'grid', gridTemplateColumns: '1.3fr 1fr 100px 100px 110px 130px', gap: 14, alignItems: 'center',
              padding: '12px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 0,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: `var(--${car.tone})`, flexShrink: 0 }} />
                  <span style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{car.name}</span>
                  {car.cn && <span style={{ font: '500 10.5px var(--f-cn)', color: 'var(--ink-mute)' }}>{car.cn}</span>}
                </div>
                <div style={{ font: '500 11px/1.3 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 4 }}>{s.vessel} · {s.voyage}</div>
              </div>
              <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
                {N.port(s.pol).name} <span style={{ color: 'var(--ink-mute)' }}>→</span> {N.port(s.pod).name}
              </div>
              <div style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.etd.slice(5)}</div>
              <div>
                <div style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{s.cutoff.slice(5)}</div>
                {['abierto', 'cutoff'].includes(s.status) && (
                  <div style={{ font: '700 9.5px/1 var(--f-sans)', color: d <= 3 ? 'var(--danger)' : 'var(--ink-mute)', marginTop: 3 }}>{d < 0 ? 'cerrado' : `en ${d}d`}</div>
                )}
              </div>
              <div style={{ font: '500 11.5px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{s.transit} días</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <U.Badge tone={st.tone} size="sm" dot>{st.label}</U.Badge>
                {['abierto', 'cutoff'].includes(s.status) && <U.Badge tone={N.SPACE_TONE[s.space]} size="sm">espacio {s.space}</U.Badge>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-mute)' }}>Sin itinerarios con esos filtros.</div>
        )}
      </U.Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Reservas (bookings)
// ════════════════════════════════════════════════════════════════
function BookingsTab({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NavieraData;
  const [selected, setSelected] = React.useState(null);

  const rows = [...N.BOOKINGS].sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div>
      <U.Card padded={false}>
        <div style={{
          display: 'grid', gridTemplateColumns: '130px 1fr 130px 110px 1fr 120px', gap: 14,
          padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span>Booking</span>
          <span>Naviera · ruta</span>
          <span>Contenedor</span>
          <span>BL marítimo</span>
          <span>Shipper · carga</span>
          <span style={{ textAlign: 'right' }}>Estado</span>
        </div>
        {rows.map((b, i) => {
          const car = N.carrier(b.carrier);
          const s = N.sailing(b.sailing);
          const st = N.BOOKING_STATUS[b.status];
          const isSel = selected === b.id;
          return (
            <div key={b.id} onClick={() => setSelected(b.id)} style={{
              display: 'grid', gridTemplateColumns: '130px 1fr 130px 110px 1fr 120px', gap: 14, alignItems: 'center',
              padding: '12px 18px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border)' : 0,
              background: isSel ? 'var(--wine-tint)' : 'transparent', transition: 'background var(--dur-fast) var(--ease)',
            }}
              onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
              onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}
            >
              <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{b.id}</code>
              <div>
                <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{car.name}</div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{s ? `${N.port(s.pol).name} → ${N.port(s.pod).name}` : '—'}</div>
              </div>
              <div>
                <U.Badge tone={b.mode === 'LCL' ? 'info' : 'wine'} size="sm">{b.mode}</U.Badge>
                <span style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)', marginLeft: 6 }}>{N.ctype(b.type).label}</span>
              </div>
              <code style={{ font: '600 10.5px/1 var(--f-mono)', color: b.bl ? 'var(--ink)' : 'var(--ink-mute)' }}>{b.bl || 'pendiente'}</code>
              <div style={{ minWidth: 0 }}>
                <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.shipper}</div>
                <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{b.commodity}{b.cbm > 0 ? ` · ${b.cbm} CBM` : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}><U.Badge tone={st.tone} size="sm" dot>{st.label}</U.Badge></div>
            </div>
          );
        })}
      </U.Card>

      <BookingDrawer
        bk={selected ? N.booking(selected) : null}
        onClose={() => setSelected(null)}
        goTo={goTo}
      />
    </div>
  );
}

function BookingDrawer({ bk, onClose, goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NavieraData;
  if (!bk) return null;
  const car = N.carrier(bk.carrier);
  const s = N.sailing(bk.sailing);
  const st = N.BOOKING_STATUS[bk.status];
  const cont = N.CONTAINERS.find(c => c.id === bk.container);

  return (
    <U.Drawer
      open={!!bk}
      onClose={onClose}
      title={bk.id}
      subtitle={`${car.name} · ${bk.mode} ${N.ctype(bk.type).label}`}
      width={680}
      actions={
        <>
          {!bk.bl && <U.Btn variant="secondary" icon={I.doc(13)}>Generar BL</U.Btn>}
          <U.Btn variant="secondary" icon={I.download(13)}>Booking PDF</U.Btn>
          <U.Btn variant="primary" onClick={onClose}>Cerrar</U.Btn>
        </>
      }
    >
      {/* Ruta */}
      <U.Card padded style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)' }}>{s ? N.port(s.pol).name : '—'}</div>
            <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{s ? s.etd : ''} · ETD</div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ color: 'var(--wine)' }}>{I.ship(22)}</span>
            <div style={{ width: '100%', height: 2, background: 'var(--border-strong)', position: 'relative' }}>
              <span style={{ position: 'absolute', left: '50%', top: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--wine)', transform: 'translateX(-50%)' }} />
            </div>
            <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)' }}>{s ? `${s.transit} días` : ''}</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)' }}>{s ? N.port(s.pod).name : '—'}</div>
            <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 4 }}>{s ? s.eta : ''} · ETA</div>
          </div>
        </div>
      </U.Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
        <U.Field label="Naviera" value={car.name} />
        <U.Field label="Buque · viaje" value={s ? `${s.vessel} ${s.voyage}` : '—'} mono />
        <U.Field label="Modo · contenedor" value={`${bk.mode} · ${N.ctype(bk.type).label}`} />
        <U.Field label="BL marítimo" value={bk.bl || 'Pendiente de emisión'} mono />
        <U.Field label="Shipper" value={bk.shipper} />
        <U.Field label="Commodity" value={bk.commodity} />
        <U.Field label="Estado" value={<U.Badge tone={st.tone} dot>{st.label}</U.Badge>} />
        <U.Field label="Volumen · peso" value={bk.cbm > 0 ? `${bk.cbm} CBM · ${(bk.weight / 1000).toFixed(1)} t` : 'En consolidación'} mono />
      </div>

      {cont && (
        <>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>CONTENEDOR VINCULADO</div>
          <button onClick={() => { onClose(); /* go to consolidation handled by parent tab */ }} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', textAlign: 'left', marginBottom: 18,
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-tint)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
          >
            <span style={{ color: 'var(--wine)', display: 'inline-flex' }}>{I.box(18)}</span>
            <div style={{ flex: 1 }}>
              <code style={{ font: '700 12.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{cont.ref}</code>
              <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{N.containerStats(cont).clients} clientes consolidados · {N.containerStats(cont).cbmPct.toFixed(0)}% ocupación</div>
            </div>
            <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{I.arrowR(14)}</span>
          </button>
        </>
      )}

      {bk.shipments.length > 0 && (
        <>
          <div className="eyebrow eyebrow-wine" style={{ marginBottom: 10 }}>EMBARQUES · {bk.shipments.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bk.shipments.map(sh => (
              <button key={sh} onClick={() => goTo('shipments', sh)} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', textAlign: 'left',
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--wine-tint)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
              >
                <span style={{ color: 'var(--wine)', display: 'inline-flex' }}>{I.box(16)}</span>
                <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)', flex: 1 }}>{sh}</code>
                <span style={{ color: 'var(--ink-mute)', display: 'inline-flex' }}>{I.arrowR(13)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </U.Drawer>
  );
}

// ════════════════════════════════════════════════════════════════
// Consolidación LCL → FCL
// ════════════════════════════════════════════════════════════════
function ConsolidationTab({ goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NavieraData;
  const [selected, setSelected] = React.useState(N.CONTAINERS[0]?.id);
  const cont = N.CONTAINERS.find(c => c.id === selected);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16 }}>
      {/* Lista de contenedores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {N.CONTAINERS.map(c => {
          const st = N.containerStats(c);
          const cst = N.CONTAINER_STATUS[c.status];
          const active = selected === c.id;
          return (
            <button key={c.id} onClick={() => setSelected(c.id)} style={{
              textAlign: 'left', padding: '14px 16px', borderRadius: 'var(--r-lg)',
              background: 'var(--bg-surface)',
              border: `1px solid ${active ? 'var(--wine)' : 'var(--border)'}`,
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
              transition: 'all var(--dur-fast) var(--ease)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <code style={{ font: '700 12px/1 var(--f-mono)', color: active ? 'var(--wine)' : 'var(--ink)' }}>{c.ref}</code>
                <U.Badge tone={cst.tone} size="sm">{cst.label}</U.Badge>
              </div>
              <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginBottom: 8 }}>{N.ctype(c.type).label} · {st.clients} clientes · {st.pieces} pzs</div>
              <U.Progress value={st.cbmPct} tone={st.cbmPct > 90 ? 'success' : st.cbmPct > 70 ? 'warning' : 'wine'} height={6} />
              <div style={{ font: '700 10.5px/1 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 6 }}>{st.cbmPct.toFixed(0)}% · {st.usedCbm.toFixed(1)}/{st.cap.cbm} CBM</div>
            </button>
          );
        })}
      </div>

      {/* Detalle del contenedor seleccionado */}
      {cont && <ContainerDetail cont={cont} goTo={goTo} />}
    </div>
  );
}

function ContainerDetail({ cont, goTo }) {
  const U = window.ERPUI;
  const I = window.Icon;
  const N = window.NavieraData;
  const st = N.containerStats(cont);
  const s = N.sailing(cont.sailing);
  const car = s ? N.carrier(s.carrier) : null;
  const cst = N.CONTAINER_STATUS[cont.status];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header + ocupación */}
      <U.Card padded>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <code style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)' }}>{cont.ref}</code>
              <U.Badge tone={cst.tone} dot>{cst.label}</U.Badge>
            </div>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>
              {N.ctype(cont.type).label} · {car ? car.name : '—'} · {s ? `${N.port(s.pol).name} → ${N.port(s.pod).name}` : '—'} · cut-off {s ? s.cutoff.slice(5) : '—'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {cont.status === 'consolidando' && <U.Btn variant="secondary" size="sm" icon={I.plus(12)}>Agregar carga</U.Btn>}
            {cont.status === 'consolidando' && <U.Btn variant="primary" size="sm" icon={I.check(12)}>Cerrar contenedor</U.Btn>}
          </div>
        </div>

        {/* Barras de ocupación CBM + peso */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Volumen · CBM</span>
              <span style={{ font: '800 13px/1 var(--f-mono)', color: st.cbmPct > 90 ? 'var(--success)' : 'var(--wine)' }}>{st.cbmPct.toFixed(0)}%</span>
            </div>
            <U.Progress value={st.cbmPct} tone={st.cbmPct > 90 ? 'success' : st.cbmPct > 70 ? 'warning' : 'wine'} height={12} />
            <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 6 }}>{st.usedCbm.toFixed(1)} de {st.cap.cbm} CBM · libre {st.freeCbm.toFixed(1)}</div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Peso · kg</span>
              <span style={{ font: '800 13px/1 var(--f-mono)', color: st.kgPct > 90 ? 'var(--danger)' : 'var(--ink)' }}>{st.kgPct.toFixed(0)}%</span>
            </div>
            <U.Progress value={st.kgPct} tone={st.kgPct > 90 ? 'danger' : 'info'} height={12} />
            <div style={{ font: '500 11px/1 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 6 }}>{(st.usedKg / 1000).toFixed(1)} de {(st.cap.kg / 1000).toFixed(1)} t · libre {(st.freeKg / 1000).toFixed(1)} t</div>
          </div>
        </div>

        {st.freeCbm > 3 && cont.status === 'consolidando' && (
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--info-bg)', borderLeft: '3px solid var(--info)', borderRadius: 'var(--r-md)', font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink)' }}>
            Quedan <strong>{st.freeCbm.toFixed(1)} CBM</strong> libres · puedes sumar carga suelta de CN para optimizar el flete antes del cut-off.
          </div>
        )}
      </U.Card>

      {/* Items consolidados */}
      <U.Card padded={false}>
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="eyebrow eyebrow-wine">CARGA CONSOLIDADA · {st.clients} CLIENTES</div>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '110px 1fr 130px 90px 90px 90px', gap: 14,
          padding: '10px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)',
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <span>Shipping Mark</span>
          <span>Cliente · proveedor</span>
          <span>Piezas</span>
          <span style={{ textAlign: 'right' }}>CBM</span>
          <span style={{ textAlign: 'right' }}>Peso</span>
          <span style={{ textAlign: 'right' }}>% cont.</span>
        </div>
        {cont.items.map((it, i) => (
          <div key={it.markbox + i} onClick={() => goTo('clients', it.markbox)} style={{
            display: 'grid', gridTemplateColumns: '110px 1fr 130px 90px 90px 90px', gap: 14, alignItems: 'center',
            padding: '12px 20px', cursor: 'pointer', borderTop: i > 0 ? '1px solid var(--border)' : 0,
          }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{it.markbox}</code>
            <div>
              <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{it.client}</div>
              <div style={{ font: '500 10.5px/1.3 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 3 }}>{it.supplier}</div>
            </div>
            <div style={{ font: '500 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>{it.pieces} piezas</div>
            <div style={{ textAlign: 'right', font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{it.cbm.toFixed(1)}</div>
            <div style={{ textAlign: 'right', font: '600 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{(it.weight / 1000).toFixed(1)}t</div>
            <div style={{ textAlign: 'right', font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>{((it.cbm / st.cap.cbm) * 100).toFixed(0)}%</div>
          </div>
        ))}
        {/* Totales */}
        <div style={{
          display: 'grid', gridTemplateColumns: '110px 1fr 130px 90px 90px 90px', gap: 14, alignItems: 'center',
          padding: '12px 20px', borderTop: '2px solid var(--ink)', background: 'var(--bg-elevated)',
        }}>
          <span style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Total</span>
          <span></span>
          <span style={{ font: '700 11.5px/1 var(--f-sans)', color: 'var(--ink)' }}>{st.pieces} piezas</span>
          <div style={{ textAlign: 'right', font: '900 13px/1 var(--f-mono)', color: 'var(--ink)' }}>{st.usedCbm.toFixed(1)}</div>
          <div style={{ textAlign: 'right', font: '800 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{(st.usedKg / 1000).toFixed(1)}t</div>
          <div style={{ textAlign: 'right', font: '900 13px/1 var(--f-mono)', color: 'var(--wine)' }}>{st.cbmPct.toFixed(0)}%</div>
        </div>
      </U.Card>
    </div>
  );
}

window.ModuleNaviera = ModuleNaviera;
