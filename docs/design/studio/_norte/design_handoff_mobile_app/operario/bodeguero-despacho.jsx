/* global React */
/* ── DTD · Bodeguero · Despacho (mobile · route-aware) ──────── */
/* Cola del día asociada a una ruta. Los paquetes se ordenan      */
/* por parada del camión (Maracay → San Juan → Caracas) y dentro  */
/* de cada parada por score. El bodeguero ejecuta en ese orden.   */

(function () {
  const { useState, useMemo, useEffect, useRef } = React;

  // Feature flag · default OFF. Se activa desde Admin → Casos de uso.
  // Cuando esté ON muestra el bloque "Ubicación en bodega" (pasillo · zona · estante)
  // en la card del paquete actual.
  const SHOW_WAREHOUSE_LOCATION = false;

  // ── Ruta del día (en prod la asigna el admin al enviar el lote) ─
  const ROUTE_OF_DAY = {
    id: 'R-002',
    name: 'Valencia → Caracas + 2 paradas',
    type: 'con-paradas',
    hub: 'Valencia · Bodega DTD',
    destination: 'Caracas',
    stops: [
      { city: 'Maracay',                radiusKm: 20, distanceFromHubKm: 152 },
      { city: 'San Juan de los Morros', radiusKm: 15, distanceFromHubKm: 218 },
      // El destino se agrega automáticamente como última "parada lógica"
    ],
    totalKm: 480,
    truck:  { id: 'T-001', plate: 'AC542XK', label: 'Volvo FH · 30t' },
    driver: { id: 'd-001', name: 'Luis Hernández' },
  };

  // ── Cola del día (coherente con la ruta · ordenada por score dentro de cada parada) ─
  const TODAY_QUEUE = [
    // ── Parada 1: Maracay ─────────────────────────────────────
    { order: 'DTD-2026-0155', client: 'Pedro Camacaro',  markbox: 'DTD-5489', city: 'Maracay',  barrio: 'San Jacinto',  pay: 'pagado',  days: 7,  score: 78, tier: null,       loc: { pasillo: 'B', zona: 1, estante: 6 },  boxes: 3, distanceToStopKm: 14, hsCode: '7013.99', aesCode: '8210', description: "Vajilla vidrio templado · juego completo 24 piezas × 3 cajas" },
    { order: 'DTD-2026-0159', client: 'Manuel Sojo',     markbox: 'DTD-5497', city: 'Maracay',  barrio: 'Las Delicias', pay: 'parcial', days: 10, score: 58, tier: null,       loc: { pasillo: 'B', zona: 2, estante: 11 }, boxes: 2, distanceToStopKm: 18, hsCode: '8501.10', aesCode: '7600', description: "Motores eléctricos 0.5HP · 6 cajas con repuestos" },
    { order: 'DTD-2026-0161', client: 'Rocío Aldana',    markbox: 'DTD-5499', city: 'Maracay',  barrio: 'Centro',       pay: 'pagado',  days: 5,  score: 71, tier: null,       loc: { pasillo: 'B', zona: 3, estante: 4 },  boxes: 1, distanceToStopKm: 9, hsCode: '9404.40', aesCode: '8520', description: "Almohadas viscoelásticas · 4 cajas × 20 unidades" },

    // ── Parada 2: San Juan de los Morros ──────────────────────
    { order: 'DTD-2026-0162', client: 'Jorge Estaba',    markbox: 'DTD-5501', city: 'San Juan de los Morros', barrio: 'Casco', pay: 'pagado',  days: 12, score: 74, tier: 'Gold', loc: { pasillo: 'C', zona: 1, estante: 2 }, boxes: 5, distanceToStopKm: 11, hsCode: '6204.62', aesCode: '5012', description: "Pantalones jean unisex · 5 cajas × 60 piezas surtidas" },
    { order: 'DTD-2026-0163', client: 'Sandra Pino',     markbox: 'DTD-5503', city: 'San Juan de los Morros', barrio: 'Pariata',pay: 'parcial', days: 8,  score: 56, tier: null,   loc: { pasillo: 'C', zona: 1, estante: 7 }, boxes: 2, distanceToStopKm: 14, hsCode: '6307.90', aesCode: '5044', description: "Toallas de baño 100% algodón · 2 cajas con sets de 6" },

    // ── Destino: Caracas ──────────────────────────────────────
    { order: 'DTD-2026-0151', client: 'Luis Fernández',  markbox: 'DTD-5392', city: 'Caracas', barrio: 'Las Mercedes',  pay: 'pagado',  days: 8,  score: 92, tier: 'Platinum', loc: { pasillo: 'A', zona: 1, estante: 8 },  boxes: 3, distanceToStopKm: null, hsCode: '8418.50', aesCode: '9200', description: "Heladeras industriales vitrina 600L · acero inox · 3 unidades" },
    { order: 'DTD-2026-0145', client: 'Adriana Pereira', markbox: 'DTD-5418', city: 'Caracas', barrio: 'Chacao',        pay: 'pagado',  days: 12, score: 76, tier: null,       loc: { pasillo: 'A', zona: 2, estante: 12 }, boxes: 5, distanceToStopKm: null, hsCode: '9405.40', aesCode: '8410', description: "Lámparas LED 30W blanco + LED 50W panel · 5 cajas" },
    { order: 'DTD-2026-0148', client: 'Valentina Ortiz', markbox: 'DTD-5215', city: 'Caracas', barrio: 'Altamira',      pay: 'pagado',  days: 11, score: 73, tier: null,       loc: { pasillo: 'A', zona: 3, estante: 5 },  boxes: 3, distanceToStopKm: null, hsCode: '3304.99', aesCode: '4500', description: "Maquillaje · labiales + paletas de sombras · 3 cajas surtidas" },
    { order: 'DTD-2026-0146', client: 'Eduardo Salazar', markbox: 'DTD-5321', city: 'Caracas', barrio: 'Sabana Grande', pay: 'parcial', days: 14, score: 62, tier: null,       loc: { pasillo: 'D', zona: 1, estante: 9 },  boxes: 4, distanceToStopKm: null, hsCode: '4202.92', aesCode: '5180', description: "Bolsos cuero sintético · 7 modelos surtidos · 4 cajas × 50 u/c" },
    { order: 'DTD-2026-0167', client: 'Marisol Toro',    markbox: 'DTD-5505', city: 'Caracas', barrio: 'El Hatillo',    pay: 'pagado',  days: 6,  score: 70, tier: null,       loc: { pasillo: 'D', zona: 2, estante: 3 },  boxes: 2, distanceToStopKm: null, hsCode: '6109.10', aesCode: '5022', description: "Camisetas algodón unisex · 2 cajas × 80 unidades" },
    { order: 'DTD-2026-0168', client: 'Fernando Núñez',  markbox: 'DTD-5507', city: 'Caracas', barrio: 'La Castellana', pay: 'pagado',  days: 4,  score: 66, tier: null,       loc: { pasillo: 'D', zona: 3, estante: 10 }, boxes: 1, distanceToStopKm: null, hsCode: '4901.99', aesCode: '6010', description: "Libros de texto escolar · 1 caja con 120 ejemplares" },
  ];

  // ── Helpers ──────────────────────────────────────────────────
  function priorityLevel(score) {
    if (score >= 80) return { label: 'Crítico', tone: 'danger' };
    if (score >= 65) return { label: 'Alto',    tone: 'wine' };
    if (score >= 45) return { label: 'Medio',   tone: 'warning' };
    return { label: 'Bajo', tone: 'neutral' };
  }
  function payTone(pay) {
    if (pay === 'pagado')  return 'success';
    if (pay === 'parcial') return 'warning';
    return 'danger';
  }
  function payLabel(pay) {
    if (pay === 'pagado')  return 'Pagado';
    if (pay === 'parcial') return 'Abono';
    return 'Pendiente';
  }
  // Build ordered list of stops (paradas intermedias + destino al final)
  function buildStopsList(route) {
    return [
      ...route.stops.map((s, i) => ({ ...s, kind: 'parada', label: `Parada ${i + 1}` })),
      { city: route.destination, kind: 'destino', label: 'Destino', radiusKm: null, distanceFromHubKm: route.totalKm },
    ];
  }
  function stopIndexOf(pkg, stopsList) {
    const i = stopsList.findIndex(s => s.city === pkg.city);
    return i >= 0 ? i : stopsList.length;  // si no matchea, al final
  }

  // ── App ──────────────────────────────────────────────────────
  function BodegueroDespacho({ fixedTheme }) {
    const [internalTheme, setInternalTheme] = useState('dark');
    const theme = fixedTheme || internalTheme;
    const themeControlled = !!fixedTheme;

    // Role picker (login flow): null hasta que el usuario elige
    const [roleSelected, setRoleSelected] = useState(null);
    // Vista dentro del rol bodeguero: 'home' | 'work'
    const [view, setView] = useState('work');

    const stopsList = useMemo(() => buildStopsList(ROUTE_OF_DAY), []);

    // Orden FIJO: por stopIndex asc, luego score desc
    const initialQueue = useMemo(() => {
      return TODAY_QUEUE
        .map(p => ({ ...p, status: 'pending', stopIndex: stopIndexOf(p, stopsList) }))
        .sort((a, b) => a.stopIndex - b.stopIndex || b.score - a.score);
    }, [stopsList]);

    const [mode, setMode]             = useState('cargar');  // 'cargar' (LIFO) | 'despachar' (FIFO)
    const [queue, setQueue]           = useState(initialQueue);
    const [confirm, setConfirm]       = useState(null);
    const [partialFor, setPartialFor] = useState(null);   // pkg id en proceso de split
    const [openDone, setOpenDone]     = useState(false);
    const [celebrating, setCelebrating] = useState(null);
    const confirmTimer = useRef(null);

    const pendingRaw = queue.filter(p => p.status === 'pending' && !p.nextTrip);
    const nextTripPkgs = queue.filter(p => p.status === 'pending' && p.nextTrip);
    const [tripClosed, setTripClosed] = useState(false);
    // Re-ordenar dinámicamente por modo:
    //   cargar    → última parada primero (LIFO · lo último que se entrega va al fondo del camión)
    //   despachar → primera parada primero (FIFO · orden de visita del camión)
    const pending = useMemo(() => {
      const arr = [...pendingRaw];
      arr.sort((a, b) => {
        if (mode === 'cargar') return b.stopIndex - a.stopIndex || b.score - a.score;
        return a.stopIndex - b.stopIndex || b.score - a.score;
      });
      return arr;
    }, [pendingRaw, mode]);
    const done     = queue.filter(p => p.status === 'done');
    // Total del viaje actual: excluye fracciones que quedan en bodega
    const tripPkgs = queue.filter(p => !p.nextTrip);
    const total    = tripPkgs.length;
    const doneCt   = done.length;
    const pct      = (doneCt / total) * 100;
    const allDone  = doneCt === total;
    const current  = pending[0];
    const upNext   = pending.slice(1);

    // Progreso por parada
    const stopsProgress = useMemo(() => stopsList.map((s, i) => {
      const items = queue.filter(p => p.stopIndex === i && !p.nextTrip);
      const d = items.filter(p => p.status === 'done').length;
      return { ...s, total: items.length, done: d, pending: items.length - d };
    }), [queue, stopsList]);

    // Parada actual (la primera con paquetes pendientes)
    const currentStopIndex = current ? current.stopIndex : -1;

    function requestDispatch(id) {
      if (confirm === id) {
        clearTimeout(confirmTimer.current);
        setConfirm(null);
        setCelebrating(id);
        setTimeout(() => {
          setQueue(q => q.map(p => p.order === id ? { ...p, status: 'done', doneAt: new Date() } : p));
          setCelebrating(null);
        }, 600);
      } else {
        setConfirm(id);
        clearTimeout(confirmTimer.current);
        confirmTimer.current = setTimeout(() => setConfirm(null), 2500);
      }
    }
    function undo(id) {
      setQueue(q => q.map(p => p.order === id ? { ...p, status: 'pending', doneAt: null } : p));
    }

    // ── Split por carga parcial ─────────────────────────────────
    // De N cajas, se llevan X en esta carga. El resto queda como
    // "Carga 2 de 2" pendiente al final del mismo grupo de parada.
    function splitPackage(id, boxesShipped) {
      const pkg = queue.find(p => p.order === id);
      if (!pkg || boxesShipped <= 0 || boxesShipped >= pkg.boxes) return;
      const restante = pkg.boxes - boxesShipped;
      const parentOrder = pkg.parentOrder || pkg.order;

      // Si ya es una carga (P1, P2…), aumentamos el contador
      const baseTotal = (pkg.partOf && pkg.partOf.of) ? pkg.partOf.of : 1;
      const baseCurr  = (pkg.partOf && pkg.partOf.i)  ? pkg.partOf.i  : 1;
      const nextOf    = baseTotal + 1;

      // Reemplaza orden actual → marcada como despachada (carga N de M)
      // E inserta una nueva orden detrás de ella con el remanente.
      const newOrder = `${parentOrder}-P${nextOf}`;
      const child = {
        ...pkg,
        order: newOrder,
        boxes: restante,
        status: 'pending',
        nextTrip: true,            // ← queda en bodega · próximo viaje
        doneAt: null,
        partOf: { i: nextOf, of: nextOf },
        parentOrder,
        originalBoxes: pkg.originalBoxes || pkg.boxes,
      };

      const idx = queue.findIndex(p => p.order === id);
      const updated = queue.map((p, i) => i === idx
        ? { ...p, status: 'done', doneAt: new Date(), boxes: boxesShipped, partOf: { i: baseCurr, of: nextOf }, originalBoxes: pkg.originalBoxes || pkg.boxes }
        : p
      );

      // Actualizar 'of' en hermanos previos del mismo parent
      const synced = updated.map(p =>
        (p.parentOrder === parentOrder || p.order === parentOrder) && p.partOf
          ? { ...p, partOf: { ...p.partOf, of: nextOf } }
          : p
      );

      // Insertar el hijo justo después del actual (mismo stopIndex)
      const final = [...synced.slice(0, idx + 1), child, ...synced.slice(idx + 1)];
      setQueue(final);
      setPartialFor(null);
    }

    if (!roleSelected) {
      return (
        <div data-theme={theme} style={{
          maxWidth: 480, margin: '0 auto', minHeight: '100vh',
          background: 'var(--bg-base)', color: 'var(--ink)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          <RolePicker onPick={setRoleSelected} />
        </div>
      );
    }

    if (view === 'home') {
      return (
        <div data-theme={theme} style={{
          maxWidth: 480, margin: '0 auto', minHeight: '100vh',
          background: 'var(--bg-base)', color: 'var(--ink)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          <HomeBodeguero
            doneCount={done.length}
            nextTripCount={nextTripPkgs.length}
            onPickMode={(m) => { setMode(m); setView('work'); }}
            onChangeRole={() => { setRoleSelected(null); setView('work'); }}
          />
        </div>
      );
    }

    return (
      <div data-theme={theme} style={{
        maxWidth: 480, margin: '0 auto', minHeight: '100vh',
        background: 'var(--bg-base)', color: 'var(--ink)',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
        transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
      }}>
        <Header theme={theme} onToggleTheme={themeControlled ? null : () => setInternalTheme(t => t === 'dark' ? 'light' : 'dark')} mode={mode} />
        {mode === 'cargar' && <RouteBanner route={{ ...ROUTE_OF_DAY, totalClients: TODAY_QUEUE.length, totalCities: new Set(TODAY_QUEUE.map(p => p.city)).size }} />}
        {mode === 'cargar' && <ModeToggle mode={mode} onChange={setMode} />}
        {mode === 'cargar' && <ProgressBlock doneCt={doneCt} total={total} pct={pct} allDone={allDone} mode={mode} />}
        {mode === 'cargar' && <StopsTimeline stops={stopsProgress} currentStopIndex={currentStopIndex} mode={mode} />}

        <main style={{ flex: 1, padding: '0 16px 96px' }}>
          {mode === 'despachar' && <ReceiveMode onBackHome={() => setView('home')} />}
          {mode === 'cargar' && (<>
          {allDone && !tripClosed && (
            <CloseTripBlock
              total={pendingRaw.length === 0 ? done.length : total}
              nextTripCount={nextTripPkgs.length}
              mode={mode}
              onClose={() => setTripClosed(true)}
            />
          )}
          {tripClosed && <DoneState total={done.length} nextTripCount={nextTripPkgs.length} />}

          {!allDone && current && (
            <React.Fragment>
              <CurrentStopHeader stop={stopsProgress[current.stopIndex]} mode={mode} />
              <CurrentCard
                pkg={current}
                pos={doneCt + 1}
                mode={mode}
                onDispatch={() => requestDispatch(current.order)}
                onPartial={() => setPartialFor(current.order)}
                confirming={confirm === current.order}
                celebrating={celebrating === current.order}
              />
            </React.Fragment>
          )}

          {upNext.length > 0 && (
            <React.Fragment>
              <SectionLabel>{mode === 'cargar' ? 'Por cargar' : 'Próximos'} · {upNext.length}</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {upNext.map((p, i) => {
                  const isStopChange = i === 0 ? p.stopIndex !== current.stopIndex
                                              : p.stopIndex !== upNext[i-1].stopIndex;
                  return (
                    <React.Fragment key={p.order}>
                      {isStopChange && <StopDivider stop={stopsProgress[p.stopIndex]} />}
                      <QueueRow pkg={p} pos={doneCt + 2 + i} stop={stopsProgress[p.stopIndex]} />
                    </React.Fragment>
                  );
                })}
              </div>
            </React.Fragment>
          )}

          {nextTripPkgs.length > 0 && !tripClosed && (
            <NextTripSection items={nextTripPkgs} />
          )}
          {done.length > 0 && (
            <DoneList items={done} open={openDone} setOpen={setOpenDone} onUndo={undo} mode={mode} />
          )}
          </>)}
        </main>

        {partialFor && (
          <PartialModal
            pkg={queue.find(p => p.order === partialFor)}
            onClose={() => setPartialFor(null)}
            onConfirm={(shipped) => splitPackage(partialFor, shipped)}
          />
        )}
      </div>
    );
  }

  // ── Header (sticky) ─────────────────────────────────────────
  function Header({ theme, onToggleTheme, mode }) {
    return (
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: 'env(safe-area-inset-top) 16px 12px', paddingTop: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>BODEGA · PTO CABELLO</div>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 3 }}>{mode === 'despachar' ? 'Recibir mercancía' : 'Despacho del día'}</div>
            <div style={{ font: '500 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>sáb 24 may · turno mañana</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onToggleTheme && (
              <button onClick={onToggleTheme} aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`} style={{
                width: 36, height: 36, borderRadius: 'var(--r-pill)',
                background: 'var(--bg-elevated)', color: 'var(--ink)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{theme === 'dark' ? window.Icon.sun(15) : window.Icon.moon(15)}</button>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px 6px 6px',
              background: 'var(--bg-elevated)', borderRadius: 'var(--r-pill)',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'var(--wine-tint)', color: 'var(--wine)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                font: '900 11px/1 var(--f-display)',
              }}>YP</div>
              <div style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>Yusneidy</div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // ── Route banner (info de la ruta + camión + chofer) ────────
  function RouteBanner({ route }) {
    const I = window.Icon;
    return (
      <div style={{
        padding: '12px 16px 14px',
        background: 'linear-gradient(135deg, var(--wine) 0%, var(--wine-deep, var(--wine)) 100%)',
        color: '#fff',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ font: '800 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Ruta del día</span>
          <code style={{ font: '800 11px/1 var(--f-mono)', color: '#fff', padding: '2px 6px', background: 'rgba(255,255,255,0.16)', borderRadius: 'var(--r-sm)' }}>{route.id}</code>
        </div>
        <div style={{ font: '900 16px/1.15 var(--f-display)', color: '#fff', letterSpacing: '-0.02em' }}>
          {route.hub.replace(' · Bodega DTD', '')} → {route.destination}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, font: '500 11px/1.2 var(--f-sans)', color: 'rgba(255,255,255,0.85)' }}>
          <span><b style={{ color: '#fff', fontWeight: 800 }}>{route.totalClients}</b> clientes en <b style={{ color: '#fff', fontWeight: 800 }}>{route.totalCities}</b> ciudades</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, font: '500 11px/1.2 var(--f-sans)', color: 'rgba(255,255,255,0.6)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.truck(11)} {route.truck.plate} · {route.truck.label}</span>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>·</span>
          <span>{route.driver.name}</span>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>·</span>
          <span className="mono" style={{ font: '700 11px/1 var(--f-mono)' }}>{route.totalKm}km</span>
        </div>
      </div>
    );
  }

  // ── Top progress block ──────────────────────────────────────
  function ProgressBlock({ doneCt, total, pct, allDone, mode }) {
    return (
      <div style={{ padding: '14px 16px 18px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div>
            <div style={{
              font: '900 36px/1 var(--f-display)',
              color: allDone ? 'var(--success)' : 'var(--ink)',
              letterSpacing: '-0.025em',
            }}>
              {doneCt}<span style={{ color: 'var(--ink-mute)', fontSize: 20 }}> / {total}</span>
            </div>
            <div style={{ font: '600 11.5px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{mode === 'cargar' ? 'paquetes cargados' : 'paquetes despachados'}</div>
          </div>
          <div style={{
            font: '900 22px/1 var(--f-display)',
            color: allDone ? 'var(--success)' : 'var(--wine)',
            letterSpacing: '-0.02em',
          }}>{Math.round(pct)}%</div>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 6, borderRadius: 2,
              background: i < doneCt ? 'var(--success)' : 'var(--bg-elevated)',
              transition: 'background var(--dur) var(--ease)',
            }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Stops timeline (mini-mapa visual) ───────────────────────
  function StopsTimeline({ stops, currentStopIndex, mode }) {
    // En modo cargar, mostramos el orden inverso al recorrido (lo último entra primero al camión)
    const ordered = mode === 'cargar' ? [...stops].reverse() : stops;
    return (
      <div style={{
        padding: '14px 16px 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            {mode === 'cargar' ? 'Orden de carga · LIFO' : 'Recorrido del camión · FIFO'}
          </div>
          <div style={{ font: '500 10px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {mode === 'cargar' ? 'última ciudad → primera' : 'origen → destino'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ordered.map((s) => {
            // i original (stops.indexOf) para el estado visual
            const origIdx = stops.indexOf(s);
            const isDone    = s.done === s.total;
            const isCurrent = origIdx === currentStopIndex;
            const isFuture  = mode === 'cargar' ? origIdx < currentStopIndex : origIdx > currentStopIndex;
            const state     = isDone ? 'done' : isCurrent ? 'current' : 'future';
            const tone      = isDone ? 'var(--success)' : isCurrent ? 'var(--wine)' : 'var(--ink-mute)';
            const bg        = isDone ? 'var(--success-bg)' : isCurrent ? 'var(--wine-tint)' : 'var(--bg-elevated)';
            return (
              <div key={s.city} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'center',
                padding: '8px 10px',
                background: bg, borderRadius: 'var(--r-sm)',
                opacity: isFuture ? 0.7 : 1,
                transition: 'all var(--dur) var(--ease)',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isDone || isCurrent ? tone : 'transparent',
                  border: `2px solid ${tone}`,
                  color: isDone || isCurrent ? '#fff' : tone,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  font: '800 11px/1 var(--f-display)',
                }}>{isDone ? window.Icon.check(11) : origIdx + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{s.city}</div>
                  <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>
                    {s.kind === 'destino' ? 'Destino final' : `Radio ${s.radiusKm}km`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ font: '900 14px/1 var(--f-display)', color: tone, letterSpacing: '-0.01em' }}>
                    {s.done}<span style={{ color: 'var(--ink-mute)', font: '700 11px/1 var(--f-mono)' }}>/{s.total}</span>
                  </div>
                  <div style={{
                    font: '700 9.5px/1 var(--f-sans)', color: tone,
                    letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 3,
                  }}>{state === 'done' ? 'Lista' : state === 'current' ? (mode === 'cargar' ? 'Cargando' : 'En curso') : 'Pendiente'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Current stop header (above the active card) ─────────────
  function CurrentStopHeader({ stop, mode }) {
    if (!stop) return null;
    const eyebrow = mode === 'cargar'
      ? (stop.kind === 'destino' ? 'Cargando para destino · primero al fondo' : 'Cargando para ciudad')
      : (stop.kind === 'destino' ? 'Destino' : 'Ciudad actual');
    return (
      <div style={{
        marginTop: 18, marginBottom: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{eyebrow}</div>
          <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 2 }}>{stop.city}</div>
        </div>
        <div style={{
          padding: '4px 9px', borderRadius: 'var(--r-pill)',
          background: 'var(--wine-tint)', color: 'var(--wine)',
          font: '800 11px/1 var(--f-mono)',
        }}>{stop.done}/{stop.total}</div>
      </div>
    );
  }

  // ── Stop divider (between groups in "Próximos") ─────────────
  function StopDivider({ stop }) {
    return (
      <div style={{
        marginTop: 10, marginBottom: 2,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <div style={{
          padding: '3px 9px', borderRadius: 'var(--r-pill)',
          background: 'var(--bg-elevated)', color: 'var(--ink-soft)',
          font: '700 10px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          {stop.city} · {stop.pending} pendiente{stop.pending === 1 ? '' : 's'}
        </div>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
    );
  }

  function SectionLabel({ children, n, of }) {
    return (
      <div style={{
        margin: '20px 4px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)',
        letterSpacing: '0.14em', textTransform: 'uppercase',
      }}>
        <span>{children}</span>
        {n && of && <span style={{ color: 'var(--ink-mute)', font: '700 11px/1 var(--f-mono)', letterSpacing: 0 }}>{n}/{of}</span>}
      </div>
    );
  }

  // ── Current card (siguiente paquete a despachar) ────────────
  function CurrentCard({ pkg, pos, mode, onDispatch, onPartial, confirming, celebrating }) {
    const I = window.Icon;
    const prio = priorityLevel(pkg.score);
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: `2px solid ${celebrating ? 'var(--success)' : 'var(--wine)'}`,
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
        transition: 'all var(--dur) var(--ease)',
        transform: celebrating ? 'scale(0.98)' : 'scale(1)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '10px 14px',
          background: `var(--${prio.tone === 'neutral' ? 'neutral' : prio.tone}-bg)`,
          color: `var(--${prio.tone === 'neutral' ? 'ink-soft' : prio.tone})`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 28, height: 24, padding: '0 8px',
              background: `var(--${prio.tone === 'neutral' ? 'neutral' : prio.tone})`,
              color: '#fff', borderRadius: 'var(--r-sm)',
              font: '900 12px/1 var(--f-display)', letterSpacing: '-0.01em',
            }}>#{pos}</span>
            <span style={{ font: '800 11px/1 var(--f-sans)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Prioridad {prio.label}</span>
          </div>
          <span style={{ font: '900 14px/1 var(--f-display)', letterSpacing: '-0.02em' }}>{pkg.score}</span>
        </div>

        <div style={{ padding: '18px 16px 14px' }}>
          <code style={{ font: '800 17px/1 var(--f-mono)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{pkg.order}</code>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{ font: '700 16px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{pkg.client}</div>
            {pkg.tier && <TierBadge tier={pkg.tier} />}
            {pkg.partOf && pkg.partOf.of > 1 && <PartBadge partOf={pkg.partOf} />}
          </div>
          <code style={{ font: '600 11.5px/1 var(--f-mono)', color: 'var(--wine)' }}>{pkg.markbox}</code>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
            <window.ERPUI.Badge tone="wine"        size="md">{pkg.city}{pkg.barrio ? ` · ${pkg.barrio}` : ''}</window.ERPUI.Badge>
            <window.ERPUI.Badge tone={payTone(pkg.pay)} dot size="md">{payLabel(pkg.pay)}</window.ERPUI.Badge>
            <window.ERPUI.Badge tone="neutral"     size="md">
              {pkg.boxes} caja{pkg.boxes === 1 ? '' : 's'}
              {pkg.originalBoxes && pkg.originalBoxes !== pkg.boxes && (
                <span style={{ marginLeft: 4, opacity: 0.7 }}>de {pkg.originalBoxes}</span>
              )}
            </window.ERPUI.Badge>
            {pkg.distanceToStopKm != null && (
              <window.ERPUI.Badge tone="info" size="md">{pkg.distanceToStopKm}km al centro</window.ERPUI.Badge>
            )}
          </div>

          {SHOW_WAREHOUSE_LOCATION && (
          <div style={{
            marginTop: 14, padding: '12px 14px',
            background: 'var(--bg-elevated)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--r-md)',
          }}>
            <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
              Ubicación en bodega
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <LocCell label="Pasillo" value={pkg.loc.pasillo} accent />
              <LocCell label="Zona"    value={pkg.loc.zona} />
              <LocCell label="Estante" value={pkg.loc.estante} />
            </div>
          </div>
          )}

          {/* SENIAT · contenido + códigos arancelarios (para mostrar al fiscal) */}
          {(pkg.hsCode || pkg.aesCode || pkg.description) && (
            <div style={{
              marginTop: 14, padding: '12px 14px',
              background: 'var(--info-bg)',
              border: '1px solid transparent',
              borderRadius: 'var(--r-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ color: 'var(--info)' }}>{I.shield(12)}</span>
                <div style={{ font: '800 10px/1 var(--f-sans)', color: 'var(--info)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  Para SENIAT / alcabalas
                </div>
              </div>
              {pkg.description && (
                <div style={{ font: '600 12.5px/1.4 var(--f-sans)', color: 'var(--ink)', marginBottom: 8 }}>{pkg.description}</div>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {pkg.hsCode && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 8px', borderRadius: 'var(--r-sm)',
                    background: 'var(--bg-surface)', color: 'var(--ink)',
                    border: '1px solid var(--border)',
                    font: '700 11px/1 var(--f-mono)',
                  }}>
                    <span style={{ font: '800 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.1em' }}>HS · OMA</span>
                    {pkg.hsCode}
                  </span>
                )}
                {pkg.aesCode && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 8px', borderRadius: 'var(--r-sm)',
                    background: 'var(--wine-tint)', color: 'var(--wine)',
                    border: '1px solid var(--wine)',
                    font: '700 11px/1 var(--f-mono)',
                  }}>
                    <span style={{ font: '800 9.5px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.1em' }}>AES · Arancel VE</span>
                    {pkg.aesCode}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '0 14px 14px' }}>
          <button onClick={onDispatch} style={{
            width: '100%', height: 64,
            background: celebrating ? 'var(--success)' : confirming ? 'var(--warning)' : 'var(--wine)',
            color: '#fff',
            borderRadius: 'var(--r-md)',
            font: '900 16px/1 var(--f-display)', letterSpacing: '-0.01em',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all var(--dur-fast) var(--ease)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            {celebrating
              ? <React.Fragment>{I.check(20)} {mode === 'cargar' ? '¡Cargado!' : '¡Despachado!'}</React.Fragment>
              : confirming
                ? <React.Fragment>{I.check(20)} Toca de nuevo para confirmar</React.Fragment>
                : <React.Fragment>{I.truck(18)} {mode === 'cargar' ? 'Cargado al camión' : 'Marcar despachado'} · {pkg.boxes} caja{pkg.boxes === 1 ? '' : 's'}</React.Fragment>}
          </button>
          {pkg.boxes > 1 && !celebrating && (
            <button onClick={onPartial} style={{
              width: '100%', marginTop: 8, padding: '10px 14px',
              background: 'transparent', color: 'var(--warning)',
              border: '1px dashed var(--warning)', borderRadius: 'var(--r-md)',
              font: '700 12.5px/1 var(--f-sans)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>{I.warn(13)} Fraccionar carga · no entran todas las cajas →</button>
          )}
        </div>
      </div>
    );
  }

  function LocCell({ label, value, accent }) {
    return (
      <div>
        <div style={{ font: '600 9.5px/1 var(--f-sans)', color: 'var(--ink-mute)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{
          font: '900 22px/1 var(--f-display)',
          color: accent ? 'var(--wine)' : 'var(--ink)',
          letterSpacing: '-0.02em',
        }}>{value}</div>
      </div>
    );
  }

  function TierBadge({ tier }) {
    const isPlat = tier === 'Platinum';
    const conf = isPlat
      ? { bg: 'var(--ink)',        fg: 'var(--ink-inv)', dot: 'var(--wine-soft)', label: 'PLAT', border: '1px solid var(--wine)' }
      : { bg: 'var(--warning-bg)', fg: 'var(--warning)', dot: 'var(--warning)',   label: 'GOLD', border: '1px solid transparent' };
    return (
      <span title={`Cliente ${tier}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        height: 16, padding: '0 6px',
        background: conf.bg, color: conf.fg, border: conf.border,
        borderRadius: 'var(--r-sm)',
        font: '800 9px/1 var(--f-sans)', letterSpacing: '0.1em',
      }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: conf.dot }} />
        {conf.label}
      </span>
    );
  }

  // ── Queue row (próximos) ────────────────────────────────────
  function QueueRow({ pkg, pos, stop }) {
    const I = window.Icon;
    const prio = priorityLevel(pkg.score);
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '40px 1fr auto', gap: 12, alignItems: 'center',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: '12px 14px',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 40, height: 40, borderRadius: 'var(--r-md)',
          background: 'var(--bg-elevated)',
          font: '900 15px/1 var(--f-display)', color: 'var(--ink-soft)', letterSpacing: '-0.02em',
        }}>{pos}</div>

        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--ink)' }}>{pkg.order}</code>
            {pkg.tier && <TierBadge tier={pkg.tier} />}
            {pkg.partOf && pkg.partOf.of > 1 && <PartBadge partOf={pkg.partOf} />}
          </div>
          <div style={{ font: '600 13px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pkg.client}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, font: '500 11px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>
            <span>{pkg.barrio || pkg.city}</span>
            {pkg.distanceToStopKm != null && (
              <React.Fragment>
                <span style={{ color: 'var(--ink-mute)' }}>·</span>
                <span className="mono" style={{ font: '600 11px/1 var(--f-mono)' }}>{pkg.distanceToStopKm}km</span>
              </React.Fragment>
            )}
            <span style={{ color: 'var(--ink-mute)' }}>·</span>
            <span style={{ color: `var(--${payTone(pkg.pay)})` }}>{payLabel(pkg.pay)}</span>
            {SHOW_WAREHOUSE_LOCATION && <>
              <span style={{ color: 'var(--ink-mute)' }}>·</span>
              <span className="mono" style={{ font: '600 11px/1 var(--f-mono)' }}>{pkg.loc.pasillo}{pkg.loc.zona}·E{pkg.loc.estante}</span>
            </>}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            font: '900 16px/1 var(--f-display)',
            color: `var(--${prio.tone === 'neutral' ? 'ink-soft' : prio.tone})`,
            letterSpacing: '-0.02em',
          }}>{pkg.score}</div>
          <window.ERPUI.Badge tone={prio.tone} size="sm" style={{ marginTop: 4 }}>{prio.label}</window.ERPUI.Badge>
        </div>
      </div>
    );
  }

  // ── Done list (collapsible) ─────────────────────────────────
  function DoneList({ items, open, setOpen, onUndo, mode }) {
    const I = window.Icon;
    return (
      <div style={{ marginTop: 24 }}>
        <button onClick={() => setOpen(!open)} style={{
          width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '12px 14px',
          background: 'var(--success-bg)', color: 'var(--success)',
          border: '1px solid transparent', borderRadius: 'var(--r-md)',
          font: '800 12.5px/1 var(--f-sans)', letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {I.check(14)} {mode === 'cargar' ? 'Cargados al camión' : 'Completados'} · {items.length}
          </span>
          <span style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform var(--dur) var(--ease)' }}>
            {I.chevD(14)}
          </span>
        </button>
        {open && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(p => (
              <div key={p.order} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                padding: '10px 14px',
                opacity: 0.7,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--success)' }}>{I.check(12)}</span>
                    <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)', textDecoration: 'line-through' }}>{p.order}</code>
                  </div>
                  <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{p.client} · {p.city}</div>
                </div>
                <button onClick={() => onUndo(p.order)} style={{
                  padding: '6px 10px',
                  background: 'transparent', color: 'var(--wine)',
                  border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                  font: '700 11px/1 var(--f-sans)',
                }}>Deshacer</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Done state (all dispatched) ─────────────────────────────
  function DoneState({ total, nextTripCount }) {
    const I = window.Icon;
    return (
      <div style={{
        marginTop: 24, padding: '32px 20px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--success)',
        borderRadius: 'var(--r-lg)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--success-bg)', color: 'var(--success)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 14px',
        }}>{I.truck(36)}</div>
        <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Carga cerrada · transportista en camino
        </div>
        <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: '34ch', margin: '8px auto 0' }}>
          <b style={{ color: 'var(--success)' }}>{total} paquetes</b> al camión. El camionero recibió la orden y arranca la ruta.
          {nextTripCount > 0 && <> Quedan <b style={{ color: 'var(--warning)' }}>{nextTripCount} fracción{nextTripCount === 1 ? '' : 'es'}</b> en bodega para el próximo viaje.</>}
        </div>
      </div>
    );
  }

  // ── Close-trip block (CTA cuando todos los current están cargados) ──
  function CloseTripBlock({ total, nextTripCount, mode, onClose }) {
    const I = window.Icon;
    return (
      <div style={{ marginTop: 24 }}>
        <div style={{
          padding: '20px 18px',
          background: 'var(--success-bg)',
          border: '1px solid var(--success)',
          borderRadius: 'var(--r-lg)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--success)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
          }}>{I.check(28)}</div>
          <div style={{ font: '900 19px/1.15 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            {mode === 'cargar' ? 'Camión cargado · listo para salir' : 'Despacho completo'}
          </div>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: '36ch', margin: '8px auto 0' }}>
            Todos los paquetes de este viaje están {mode === 'cargar' ? 'arriba del camión' : 'entregados'}.
            {nextTripCount > 0 && <> Quedan <b style={{ color: 'var(--warning)' }}>{nextTripCount} fracción{nextTripCount === 1 ? '' : 'es'}</b> en bodega para el próximo viaje.</>}
          </div>
        </div>
        <button onClick={onClose} style={{
          width: '100%', marginTop: 12, height: 60,
          background: 'var(--wine)', color: '#fff',
          borderRadius: 'var(--r-md)',
          font: '900 15px/1 var(--f-display)', letterSpacing: '-0.01em',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: 'var(--shadow-md)',
        }}>
          {I.truck(20)} Cerrar carga · entregar al transportista →
        </button>
        <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-sm)', font: '500 11px/1.5 var(--f-sans)', color: 'var(--ink-soft)', textAlign: 'center' }}>
          Al cerrar, la orden cambia a "lista" y el transportista recibe el push para arrancar la ruta.
        </div>
      </div>
    );
  }

  // ── Próximo viaje section (fracciones que quedan en bodega) ──
  function NextTripSection({ items }) {
    const I = window.Icon;
    return (
      <div style={{ marginTop: 22 }}>
        <div style={{
          margin: '0 4px 10px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          font: '700 10.5px/1 var(--f-sans)', color: 'var(--warning)',
          letterSpacing: '0.14em', textTransform: 'uppercase',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{I.box(12)} Próximo viaje · queda en bodega</span>
          <span style={{ color: 'var(--ink-mute)', font: '700 11px/1 var(--f-mono)', letterSpacing: 0 }}>{items.length}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map(p => (
            <div key={p.order} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px',
              background: 'var(--warning-bg)',
              border: '1px dashed var(--warning)',
              borderRadius: 'var(--r-md)',
            }}>
              <span style={{ color: 'var(--warning)', flexShrink: 0 }}>{I.box(14)}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{p.order}</code>
                  {p.partOf && <PartBadge partOf={p.partOf} />}
                </div>
                <div style={{ font: '600 12px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 3 }}>{p.client}</div>
                <div style={{ font: '500 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>
                  {p.boxes} caja{p.boxes === 1 ? '' : 's'} de {p.originalBoxes || p.boxes} · {p.city}
                </div>
              </div>
              <span style={{
                padding: '3px 8px', borderRadius: 'var(--r-pill)',
                background: 'var(--bg-surface)', color: 'var(--warning)',
                font: '800 10px/1 var(--f-sans)', letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>En bodega</span>
            </div>
          ))}
        </div>
      </div>
    );
  }


  // ── Part badge (Carga N de M) ────────────────────────────────
  function PartBadge({ partOf }) {
    const isComplete = partOf.i === partOf.of;
    return (
      <span title={`Fracción ${partOf.i} de ${partOf.of}`} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 18, padding: '0 8px',
        background: 'var(--warning-bg)', color: 'var(--warning)',
        border: '1px solid var(--warning)',
        borderRadius: 'var(--r-sm)',
        font: '800 10px/1 var(--f-sans)', letterSpacing: '0.1em',
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--warning)' }} />
        FRACCIÓN {partOf.i}/{partOf.of}
      </span>
    );
  }

  // ── Partial Modal (split) ────────────────────────────────────
  function PartialModal({ pkg, onClose, onConfirm }) {
    const I = window.Icon;
    const [shipped, setShipped] = useState(Math.max(1, pkg.boxes - 1));
    const restante = pkg.boxes - shipped;
    const original = pkg.originalBoxes || pkg.boxes;
    const nextPart = (pkg.partOf && pkg.partOf.of ? pkg.partOf.of : 1) + 1;
    const currPart = (pkg.partOf && pkg.partOf.i  ? pkg.partOf.i  : 1);

    return (
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 280,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end',
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          width: '100%', maxWidth: 480, margin: '0 auto',
          background: 'var(--bg-base)',
          borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
          padding: '18px 16px',
          paddingBottom: 'max(18px, env(safe-area-inset-bottom))',
          animation: 'erp-pop 240ms var(--ease)',
        }}>
          <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 14px' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ color: 'var(--warning)' }}>{I.warn(16)}</span>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              Carga fraccionada
            </div>
          </div>
          <div style={{ font: '500 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)' }}>
            {pkg.order} · {pkg.client} · <b style={{ color: 'var(--ink)' }}>{pkg.boxes} cajas a despachar</b>
            {original !== pkg.boxes && <span> (de {original} originales)</span>}
          </div>

          {/* Split visualization */}
          <div style={{ marginTop: 16 }}>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Cuántas cajas entran en el camión
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{
                padding: '14px 12px', borderRadius: 'var(--r-md)',
                background: 'var(--success-bg)', border: '1px solid var(--success)',
              }}>
                <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Ahora · Fracción {currPart}/{nextPart}</div>
                <div style={{ font: '900 32px/1 var(--f-display)', color: 'var(--success)', marginTop: 6, letterSpacing: '-0.02em' }}>{shipped}</div>
                <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>caja{shipped === 1 ? '' : 's'} al camión</div>
              </div>
              <div style={{
                padding: '14px 12px', borderRadius: 'var(--r-md)',
                background: 'var(--warning-bg)', border: '1px solid var(--warning)',
              }}>
                <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--warning)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Queda · Fracción {nextPart}/{nextPart}</div>
                <div style={{ font: '900 32px/1 var(--f-display)', color: 'var(--warning)', marginTop: 6, letterSpacing: '-0.02em' }}>{restante}</div>
                <div style={{ font: '600 11px/1 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>en bodega · próximo viaje</div>
              </div>
            </div>

            {/* Slider */}
            <input
              type="range" min={1} max={pkg.boxes - 1} value={shipped}
              onChange={(e) => setShipped(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--wine)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>
              <span>1</span>
              <span>{pkg.boxes - 1}</span>
            </div>
          </div>

          <div style={{
            marginTop: 14, padding: '10px 12px',
            background: 'var(--info-bg)', color: 'var(--info)',
            borderRadius: 'var(--r-md)',
            font: '500 11.5px/1.4 var(--f-sans)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
            <span>
              Se genera <code style={{ font: '700 11px/1 var(--f-mono)' }}>{(pkg.parentOrder || pkg.order)}-P{nextPart}</code> con las {restante} caja{restante === 1 ? '' : 's'} restantes. El cliente recibe ambas cargas y un aviso de la división.
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{
              flex: 1, height: 48,
              background: 'var(--bg-elevated)', color: 'var(--ink)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              font: '700 13px/1 var(--f-sans)',
            }}>Cancelar</button>
            <button onClick={() => onConfirm(shipped)} style={{
              flex: 2, height: 48,
              background: 'var(--warning)', color: '#fff',
              borderRadius: 'var(--r-md)',
              font: '900 14px/1 var(--f-display)', letterSpacing: '-0.01em',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>{I.check(15)} Confirmar split · despachar {shipped}</button>
          </div>
        </div>
      </div>
    );
  }




  // ── Role Picker (pantalla de login · elige el rol) ──────────
  function RolePicker({ onPick }) {
    const I = window.Icon;
    return (
      <div style={{ padding: '40px 20px 24px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--r-md)',
            background: 'var(--wine)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', font: '900 18px/1 var(--f-display)',
          }}>DTD</div>
          <div style={{ font: '700 10px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>OPERARIO · APP</div>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 10, letterSpacing: '-0.025em' }}>
            Hola, Yusneidy
          </div>
          <div style={{ font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
            ¿Con qué rol vas a trabajar hoy?
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <button onClick={() => onPick('bodeguero')} style={{
            padding: '18px 16px', textAlign: 'left',
            background: 'var(--bg-surface)', border: '2px solid var(--wine)',
            borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-md)',
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            <span style={{ width: 52, height: 52, borderRadius: 'var(--r-md)', background: 'var(--wine)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.warehouse(24)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Bodeguero</div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Despachar al camión · Recibir mercancía</div>
            </div>
            <span style={{ color: 'var(--ink-mute)' }}>{I.arrowR(16)}</span>
          </button>

          <button onClick={() => window.open('Camionero.html', '_blank')} style={{
            padding: '18px 16px', textAlign: 'left',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            <span style={{ width: 52, height: 52, borderRadius: 'var(--r-md)', background: 'var(--info-bg)', color: 'var(--info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.truck(24)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '900 17px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Transportista</div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Ruta del día · GPS · POD</div>
            </div>
            <span style={{ color: 'var(--ink-mute)' }}>{I.arrowR(16)}</span>
          </button>
        </div>

        <div style={{ marginTop: 'auto', textAlign: 'center', font: '500 11px/1.4 var(--f-sans)', color: 'var(--ink-mute)', paddingTop: 24 }}>
          DTD-Cargo · Bodega Pto Cabello
        </div>
      </div>
    );
  }

  // ── Home Bodeguero (post-cierre · menú con sub-modos) ───────
  function HomeBodeguero({ doneCount, nextTripCount, onPickMode, onChangeRole }) {
    const I = window.Icon;
    return (
      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>BODEGA · PTO CABELLO</div>
          <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.02em' }}>Hola, Yusneidy</div>
          <div style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>sáb 24 may · turno mañana</div>
        </header>

        {doneCount > 0 && (
          <div style={{
            marginBottom: 18, padding: '14px 16px',
            background: 'var(--success-bg)', border: '1px solid var(--success)',
            borderRadius: 'var(--r-lg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ color: 'var(--success)' }}>{I.check(14)}</span>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--success)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Último trabajo</div>
            </div>
            <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>
              OD-2026-0142 cerrada · {doneCount} paquetes
            </div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
              Transportista ya arrancó la ruta · entregada al sistema central.
              {nextTripCount > 0 && <> Quedan <b style={{ color: 'var(--warning)' }}>{nextTripCount} fracción{nextTripCount === 1 ? '' : 'es'}</b> en bodega para el próximo viaje.</>}
            </div>
          </div>
        )}

        <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>¿Qué vas a hacer?</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => onPickMode('cargar')} style={{
            padding: '18px 16px', textAlign: 'left',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            <span style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.truck(22)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Despachar al camión</div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Cargar paquetes en orden LIFO · ruta del día</div>
            </div>
            <span style={{ color: 'var(--ink-mute)' }}>{I.arrowR(16)}</span>
          </button>

          <button onClick={() => onPickMode('despachar')} style={{
            padding: '18px 16px', textAlign: 'left',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
            display: 'flex', gap: 14, alignItems: 'center',
          }}>
            <span style={{ width: 48, height: 48, borderRadius: 'var(--r-md)', background: 'var(--info-bg)', color: 'var(--info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{I.box(22)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Recibir mercancía</div>
              <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Escanear cajas de un contenedor que acaba de llegar</div>
            </div>
            <span style={{ color: 'var(--ink-mute)' }}>{I.arrowR(16)}</span>
          </button>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 24, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button onClick={onChangeRole} style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)', padding: '8px 4px' }}>← Cambiar de rol</button>
          <button style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--ink-mute)', padding: '8px 4px' }}>Cerrar sesión</button>
        </div>
      </div>
    );
  }

  function ReceiveMode({ onBackHome }) {
    const I = window.Icon;
    const [type, setType] = useState(null);
    const [picked, setPicked] = useState(null);
    const [expected, setExpected] = useState([
      { client: 'Acindar',       markbox: 'DTD-5452', boxes: 12, scanned: 12 },
      { client: 'Imp. Pereira',  markbox: 'DTD-5418', boxes: 8,  scanned: 5 },
      { client: 'BriceñoTex',    markbox: 'DTD-5277', boxes: 22, scanned: 0 },
      { client: 'Tech Solutions',markbox: 'DTD-5371', boxes: 24, scanned: 0 },
    ]);
    const [scannerOpen, setScannerOpen] = useState(false);
    const [scanResult, setScanResult]   = useState(null);

    function startScan() {
      setScannerOpen(true);
      setScanResult(null);
      // Mock: a los 2.4s "detectamos" un Shipping Mark al azar de los pendientes
      setTimeout(() => {
        const candidates = expected.filter(e => e.scanned < e.boxes);
        if (candidates.length === 0) {
          setScanResult({ ok: false, msg: 'Todas las cajas ya fueron escaneadas.' });
          return;
        }
        const target = candidates[Math.floor(Math.random() * candidates.length)];
        setExpected(expected.map(e => e.markbox === target.markbox ? { ...e, scanned: e.scanned + 1 } : e));
        setScanResult({ ok: true, target, newCount: target.scanned + 1 });
        // Auto-cerrar a los 1.4s
        setTimeout(() => setScannerOpen(false), 1400);
      }, 2400);
    }

    // Mock data: contenedores esperando recepción (por tipo)
    const MONO = [
      { id: 'DTDU-472816', client: 'Polar',       boxes: 42, cbm: 28.4, kg: 12400, arrived: '08:40', warehouse: 'YIW-A1' },
      { id: 'DTDU-501122', client: 'Acindar',     boxes: 28, cbm: 16.2, kg: 6800,  arrived: '11:15', warehouse: 'YIW-A1' },
      { id: 'DTDU-498344', client: 'Castro Hnos', boxes: 18, cbm: 9.4,  kg: 3600,  arrived: '13:50', warehouse: 'YIW-A2' },
    ];
    const LCL_RAW = [
      { id: 'CN-2026-2842', clients: 4, boxes: 32, scanned: 0,  arrived: '09:15', warehouse: 'SZX-B1' }, // sin abrir
      { id: 'CN-2026-2841', clients: 7, boxes: 66, scanned: 17, arrived: '13:20', warehouse: 'YIW-A1' }, // en curso
      { id: 'CN-2026-2843', clients: 5, boxes: 48, scanned: 48, arrived: '16:40', warehouse: 'CAN-C1' }, // completado
      { id: 'CN-2026-2844', clients: 3, boxes: 24, scanned: 0,  arrived: '17:55', warehouse: 'YIW-A1' }, // sin abrir (acabó de llegar)
    ];
    // Helper: status calculation
    const statusOf = (c) => c.scanned === 0 ? 'sin-abrir' : c.scanned === c.boxes ? 'completado' : 'en-curso';
    // Sort: sin-abrir → en-curso → completado, dentro de cada grupo por hora de llegada
    const ORDER = { 'sin-abrir': 0, 'en-curso': 1, 'completado': 2 };
    const LCL = [...LCL_RAW].sort((a, b) => {
      const oa = ORDER[statusOf(a)], ob = ORDER[statusOf(b)];
      if (oa !== ob) return oa - ob;
      return a.arrived.localeCompare(b.arrived);
    });

    // Selector de tipo
    if (!type) {
      return (
        <div>
          <button onClick={onBackHome} style={{ marginTop: 14, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>← Volver al menú del bodeguero</button>
          <div style={{ marginTop: 16, marginBottom: 14, font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Tipo de llegada</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => setType('mono')} style={{ padding: 14, textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', display: 'flex', gap: 12, boxShadow: 'var(--shadow-xs)' }}>
              <span style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--wine-tint)', color: 'var(--wine)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.box(18)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Contenedor mono-cliente</div>
                <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Un contenedor completo de UN solo cliente.</div>
              </div>
            </button>
            <button onClick={() => setType('lcl')} style={{ padding: 14, textAlign: 'left', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', display: 'flex', gap: 12, boxShadow: 'var(--shadow-xs)' }}>
              <span style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: 'var(--info-bg)', color: 'var(--info)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{I.warehouse(18)}</span>
              <div style={{ flex: 1 }}>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Modalidad envío · LCL consolidado</div>
                <div style={{ font: '500 12px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>Contenedor con cajas de varios clientes.</div>
              </div>
            </button>
          </div>
        </div>
      );
    }

    // Picker de contenedor dentro del tipo
    if (!picked) {
      const list = type === 'mono' ? MONO : LCL;
      const title = type === 'mono' ? 'Contenedores mono-cliente esperando' : 'Contenedores LCL esperando';
      return (
        <div>
          <button onClick={() => setType(null)} style={{ marginTop: 14, marginBottom: 12, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>← Otro tipo</button>
          <div style={{ marginBottom: 12, font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{title} · elige cuál procesar</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map(c => {
              if (type === 'mono') {
                return (
                  <button key={c.id} onClick={() => setPicked(c)} style={{
                    padding: 14, textAlign: 'left',
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{c.id}</code>
                      <span style={{ font: '600 10.5px/1 var(--f-mono)', color: 'var(--ink-mute)' }}>llegó {c.arrived}</span>
                    </div>
                    <div style={{ font: '900 15px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.02em' }}>{c.client}</div>
                    <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>{c.boxes} cajas · {c.cbm} CBM · {c.kg.toLocaleString()} kg · {c.warehouse}</div>
                  </button>
                );
              }
              const pct = Math.round((c.scanned / c.boxes) * 100);
              const st  = statusOf(c);
              const tone = st === 'completado' ? 'success' : st === 'en-curso' ? 'warning' : 'wine';
              const label = st === 'completado' ? 'completado' : st === 'en-curso' ? 'en curso' : 'sin abrir';
              return (
                <button key={c.id} onClick={() => setPicked(c)} style={{
                  padding: 14, textAlign: 'left',
                  background: 'var(--bg-surface)',
                  border: `1px solid var(--${tone === 'wine' ? 'border' : tone})`,
                  borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
                  opacity: st === 'completado' ? 0.7 : 1, cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <code style={{ font: '800 11.5px/1 var(--f-mono)', color: 'var(--ink)' }}>{c.id}</code>
                    <span style={{ padding: '3px 8px', borderRadius: 'var(--r-pill)', background: `var(--${tone}-bg)`, color: `var(--${tone})`, font: '800 9.5px/1 var(--f-sans)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
                  </div>
                  <div style={{ font: '500 11.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 8 }}>{c.boxes} cajas · {c.clients} clientes · llegó {c.arrived} · {c.warehouse}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 5, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `var(--${tone})`, borderRadius: 999 }} />
                    </div>
                    <span style={{ font: '700 11px/1 var(--f-mono)', color: `var(--${tone})`, minWidth: 56, textAlign: 'right' }}>{c.scanned}/{c.boxes} cj</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Detalle del contenedor seleccionado
    if (type === 'mono') {
      const c = picked;
      return (
        <div>
          <button onClick={() => setPicked(null)} style={{ marginTop: 14, marginBottom: 8, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>← Otro contenedor</button>
          <div style={{ marginTop: 4, padding: 16, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
            <div className="eyebrow eyebrow-wine">CONTENEDOR ASIGNADO</div>
            <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 6, letterSpacing: '-0.02em' }}>{c.id} · {c.client}</div>
            <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6 }}>{c.boxes} cajas · {c.cbm} CBM · {c.kg.toLocaleString()} kg · {c.warehouse}</div>
            <button style={{ width: '100%', marginTop: 14, height: 60, background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-md)', font: '900 14.5px/1 var(--f-display)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>{I.check(18)} Confirmar recepción completa</button>
          </div>
        </div>
      );
    }
    const c = picked;
    return (
      <div>
        <button onClick={() => setPicked(null)} style={{ marginTop: 14, font: '600 12px/1 var(--f-sans)', color: 'var(--ink-soft)' }}>← Otro contenedor</button>
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
          <div className="eyebrow eyebrow-wine">CONTENEDOR ASIGNADO</div>
          <div style={{ font: '900 16px/1.2 var(--f-display)', color: 'var(--ink)', marginTop: 4, letterSpacing: '-0.02em' }}>{c.id}</div>
        </div>

        {statusOf(c) === 'sin-abrir' && (
          <React.Fragment>
            <button onClick={startScan} style={{ width: '100%', marginTop: 12, height: 72, background: 'var(--wine)', color: '#fff', borderRadius: 'var(--r-md)', font: '900 17px/1 var(--f-display)', letterSpacing: '-0.01em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: 'var(--shadow-md)' }}>{I.eye(22)} Escanear próxima caja</button>
            <button style={{ width: '100%', marginTop: 8, padding: '10px', background: 'transparent', color: 'var(--ink-soft)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', font: '700 12px/1 var(--f-sans)' }}>Reportar incidencia · caja huérfana / dañada</button>
          </React.Fragment>
        )}

        {scannerOpen && <ScannerOverlay onClose={() => setScannerOpen(false)} result={scanResult} />}

        <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)' }}>
          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>{c.scanned} / {c.boxes} cajas escaneadas</div>
          <div style={{ marginTop: 8, height: 6, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(c.scanned/c.boxes)*100}%`, background: 'var(--success)', borderRadius: 999 }} />
          </div>
        </div>
        {statusOf(c) === 'en-curso' && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--warning-bg)', color: 'var(--warning)', borderRadius: 'var(--r-md)', font: '500 12px/1.5 var(--f-sans)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
            <span><b>Contenedor en curso.</b> Otro operario lo está procesando ahora mismo. Puedes ver el contenido esperado pero no escanear desde acá.</span>
          </div>
        )}
        {statusOf(c) === 'completado' && (
          <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--r-md)', font: '500 12px/1.5 var(--f-sans)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.check(13)}</span>
            <span><b>Contenedor completado.</b> Todas las cajas ya fueron escaneadas. Acá puedes ver el desglose final por cliente.</span>
          </div>
        )}

        <div style={{ marginTop: 18, marginBottom: 8, font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Esperados en este contenedor</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {expected.map((e, i) => {
            const isComplete = e.scanned === e.boxes;
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10, alignItems: 'center',
                padding: '10px 12px',
                background: isComplete ? 'var(--success-bg)' : 'var(--bg-surface)',
                border: `1px solid ${isComplete ? 'var(--success)' : 'var(--border)'}`,
                borderRadius: 'var(--r-md)',
              }}>
                <span style={{ color: isComplete ? 'var(--success)' : 'var(--ink-mute)' }}>{isComplete ? I.check(16) : I.box(14)}</span>
                <div>
                  <div style={{ font: '700 12.5px/1.2 var(--f-sans)', color: 'var(--ink)' }}>{e.client}</div>
                  <code style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{e.markbox}</code>
                </div>
                <div style={{ font: '800 12px/1 var(--f-mono)', color: isComplete ? 'var(--success)' : 'var(--ink-soft)' }}>{e.scanned}/{e.boxes}</div>
              </div>
            );
          })}
        </div>

      </div>
    );
  }


  // ── Scanner overlay (simula cámara + lectura Shipping Mark) ────────
  function ScannerOverlay({ onClose, result }) {
    const I = window.Icon;
    return (
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'erp-fade 200ms var(--ease)',
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          width: '100%', maxWidth: 360, background: '#000',
          borderRadius: 'var(--r-xl)', overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Camera viewport */}
          <div style={{
            position: 'relative', aspectRatio: '4/5',
            background: 'linear-gradient(180deg, #1a1f2e 0%, #0d1119 100%)',
            overflow: 'hidden',
          }}>
            {/* Grid pattern como cámara */}
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.15 }}>
              <defs>
                <pattern id="cam-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#fff" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cam-grid)" />
            </svg>

            {/* Caja "mock" en medio */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '60%', aspectRatio: '4/3',
            }}>
              <svg viewBox="0 0 120 90" width="100%" height="100%">
                <rect x="15" y="15" width="90" height="60" fill="#C9A77F" stroke="#8B6F4E" strokeWidth="1.5" />
                <line x1="60" y1="15" x2="60" y2="75" stroke="#8B6F4E" strokeWidth="1" />
                <rect x="38" y="32" width="44" height="14" fill="#FFFFFF" stroke="#8B6F4E" strokeWidth="0.5" />
                {result && result.ok && <text x="60" y="42" fontFamily="JetBrains Mono" fontSize="6" fontWeight="700" fill="#7F0F1A" textAnchor="middle">{result.target.markbox}</text>}
                {(!result || !result.ok) && <g>
                  <rect x="42" y="36" width="36" height="2" fill="#8B6F4E" opacity="0.5" />
                  <rect x="42" y="40" width="28" height="2" fill="#8B6F4E" opacity="0.5" />
                </g>}
              </svg>
            </div>

            {/* Reticle de escaneo (esquinas) */}
            <div style={{ position: 'absolute', inset: '15% 12%', pointerEvents: 'none' }}>
              {[[0,0,'tl'],[0,1,'tr'],[1,0,'bl'],[1,1,'br']].map(([r,c,k]) => (
                <div key={k} style={{
                  position: 'absolute',
                  [r ? 'bottom' : 'top']: 0,
                  [c ? 'right' : 'left']: 0,
                  width: 30, height: 30,
                  [`border${r ? 'Bottom' : 'Top'}`]: '3px solid var(--wine-soft)',
                  [`border${c ? 'Right' : 'Left'}`]: '3px solid var(--wine-soft)',
                  borderTopLeftRadius: !r && !c ? 6 : 0,
                  borderTopRightRadius: !r && c ? 6 : 0,
                  borderBottomLeftRadius: r && !c ? 6 : 0,
                  borderBottomRightRadius: r && c ? 6 : 0,
                }} />
              ))}
            </div>

            {/* Línea de escaneo animada (visible cuando aún no hay resultado) */}
            {!result && (
              <div style={{
                position: 'absolute', left: '12%', right: '12%',
                height: 2, background: 'var(--wine-soft)',
                boxShadow: '0 0 12px var(--wine-soft)',
                animation: 'cam-scan 1.2s ease-in-out infinite alternate',
              }} />
            )}

            {/* Status pill abajo */}
            <div style={{
              position: 'absolute', bottom: 16, left: '50%',
              transform: 'translateX(-50%)',
              padding: '6px 14px',
              background: result?.ok ? 'var(--success)' : result?.ok === false ? 'var(--danger)' : 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              borderRadius: 'var(--r-pill)',
              font: '700 11.5px/1 var(--f-sans)', letterSpacing: '0.06em',
              whiteSpace: 'nowrap',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {result?.ok
                ? <React.Fragment>{I.check(13)} {result.target.markbox} · {result.target.client}</React.Fragment>
                : result
                  ? <React.Fragment>{I.warn(13)} {result.msg}</React.Fragment>
                  : <React.Fragment><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wine-soft)', animation: 'erp-fade 0.8s infinite alternate' }} /> Buscando código…</React.Fragment>}
            </div>
          </div>

          {/* Footer info */}
          <div style={{ padding: '14px 16px', background: '#000', color: '#fff' }}>
            {result?.ok ? (
              <React.Fragment>
                <div style={{ font: '900 16px/1.1 var(--f-display)', letterSpacing: '-0.02em' }}>
                  Caja registrada · {result.target.client}
                </div>
                <div style={{ font: '500 12px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                  Avance: <b style={{ color: '#fff' }}>{result.newCount} / {result.target.boxes}</b> cajas. Cerrando…
                </div>
              </React.Fragment>
            ) : (
              <React.Fragment>
                <div style={{ font: '700 13px/1.2 var(--f-sans)', color: '#fff' }}>Apuntá el lector al código Shipping Mark</div>
                <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>Mantené la caja dentro del recuadro. La detección tarda ~3s.</div>
              </React.Fragment>
            )}
          </div>

          {/* Close button */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 12, right: 12,
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(8px)',
          }}>{I.close(16)}</button>
        </div>
      </div>
    );
  }

  // Side-effect helper: cuando se cierra la carga, avanza OD y crea P2 OD si hace falta
  function BridgeCloseHook({ bridgeOD, nextTripPkgs }) {
    useEffect(() => {
      if (!window.DTDBridge || !bridgeOD) return;
      // 1) Avanzar OD actual a 'lista' (lista para el camionero)
      window.DTDBridge.advance(bridgeOD.id, 'lista', { departedAt: new Date().toISOString() });
      // 2) Si hay fracciones en bodega, crear 2da OD automática
      if (nextTripPkgs.length > 0) {
        const parts = bridgeOD.id.split('-');
        const baseNum = parseInt(parts[2], 10);
        const childId = `${parts[0]}-${parts[1]}-${String(baseNum + 100).padStart(4, '0')}-V2`;
        const totalKg = nextTripPkgs.reduce((s, p) => s + (p.boxes * 50), 0); // estimación
        const totalCBM = nextTripPkgs.reduce((s, p) => s + (p.boxes * 0.4), 0);
        window.DTDBridge.publish({
          id: childId, status: 'creada',
          routeId: bridgeOD.routeId, truckId: null, driverId: null,
          packageIds: nextTripPkgs.map(p => p.order),
          packageCount: nextTripPkgs.length,
          totalKg, totalCBM,
          capacityKg: 30000, capacityCBM: 76,
          createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
          progress: 0,
          cities: Array.from(new Set(nextTripPkgs.map(p => p.city))),
          hub: 'Valencia',
          parentOD: bridgeOD.id,
          autoCreatedFromFractions: true,
        });
      }
    }, [bridgeOD?.id]);
    return null;
  }

  function ModeToggle({ mode, onChange }) {
    const I = window.Icon;
    const opts = [
      { id: 'cargar',    label: 'Despachar al camión', sub: 'carga al camión en orden LIFO', icon: I.truck },
      { id: 'despachar', label: 'Recibir mercancía',   sub: 'escanea cajas del contenedor',  icon: I.box },
    ];
    return (
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>Modo de trabajo</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
          padding: 3, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)',
        }}>
          {opts.map(o => {
            const sel = mode === o.id;
            return (
              <button key={o.id} onClick={() => onChange(o.id)} style={{
                padding: '10px 10px', textAlign: 'left',
                background: sel ? 'var(--bg-surface)' : 'transparent',
                color: sel ? 'var(--ink)' : 'var(--ink-soft)',
                border: `1px solid ${sel ? 'var(--wine)' : 'transparent'}`,
                borderRadius: 'var(--r-sm)',
                boxShadow: sel ? 'var(--shadow-sm)' : 'none',
                display: 'flex', alignItems: 'center', gap: 8,
                transition: 'all var(--dur-fast) var(--ease)',
              }}>
                <span style={{ color: sel ? 'var(--wine)' : 'var(--ink-mute)', flexShrink: 0 }}>{o.icon(15)}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ font: '800 12px/1.1 var(--f-display)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{o.label}</div>
                  <div style={{ font: '500 10px/1.2 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
        {mode === 'cargar' && (
          <div style={{
            marginTop: 8, padding: '8px 10px',
            background: 'var(--warning-bg)', color: 'var(--warning)',
            borderRadius: 'var(--r-sm)',
            font: '500 11px/1.4 var(--f-sans)',
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(11)}</span>
            <span>Carga <b>primero lo que va más lejos</b> (Caracas) para que quede al fondo. Lo último que cargás (Maracay) se baja primero del camión.</span>
          </div>
        )}
      </div>
    );
  }

  window.BodegueroDespacho = BodegueroDespacho;
})();
