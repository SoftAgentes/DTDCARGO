/* global React */
/* ── DTD · Transportista (mobile · GPS + entregas en ruta) ───────── */
/* App del transportista. Visualiza ruta del día con GPS, ve     */
/* foto de fachada del cliente, marca llegada y POD por parada.  */

(function () {
  const { useState, useEffect, useRef } = React;

  // ── Ruta asignada por el almacenista ───────────────────────────
  const ROUTE = {
    id: 'R-002',
    name: 'Valencia → Caracas + 2 paradas',
    hub: 'Valencia',
    destination: 'Caracas',
    totalKm: 480,
    truck:  { id: 'T-001', plate: 'AC542XK', label: 'Volvo FH · 30t' },
    driver: { id: 'd-001', name: 'Luis Hernández', avatar: 'LH' },
  };

  // ── Paquetes a entregar (con foto fachada + GPS exacto) ──────
  const DELIVERIES = [
    { order: 'DTD-2026-0155', client: 'Pedro Camacaro',  phone: '+58 414 552 1188', whatsapp: true,  city: 'Maracay', barrio: 'San Jacinto', addr: 'Calle Bolívar 24, casa azul con portón blanco', ref: 'Frente a la panadería La Espiga', coords: '10.2469, -67.5912', photoTone: '#7F0F1A', icon: 'A' },
    { order: 'DTD-2026-0161', client: 'Rocío Aldana',    phone: '+58 412 884 7700', whatsapp: true,  city: 'Maracay', barrio: 'Centro',      addr: 'Av. Las Delicias, Quinta Aldana, casa de rejas verdes', ref: 'A 50m de la plaza central', coords: '10.2461, -67.5895', photoTone: '#5E0A12', icon: 'B' },
    { order: 'DTD-2026-0162', client: 'Jorge Estaba',    phone: '+58 416 339 5512', whatsapp: false, city: 'San Juan de los Morros', barrio: 'Casco', addr: 'Carrera 5 con Calle 8, edificio Tía Mary, apto 4-B', ref: 'Edificio con balcones marrones', coords: '9.9111, -67.3567', photoTone: '#1F8A5B', icon: 'C' },
    { order: 'DTD-2026-0151', client: 'Luis Fernández',  phone: '+58 212 949 1100', whatsapp: false, city: 'Caracas', barrio: 'Las Mercedes', addr: 'Av. Río de Janeiro, Torre Polar, Mezz. oficina 12', ref: 'Torre corporativa con logo azul', coords: '10.4892, -66.8553', photoTone: '#2A6FDB', icon: 'D' },
    { order: 'DTD-2026-0145', client: 'Adriana Pereira', phone: '+58 414 220 5611', whatsapp: true,  city: 'Caracas', barrio: 'Chacao',       addr: 'Av. Francisco de Miranda con 2da Transversal, Edif. Centro Plaza, local 18', ref: 'Local junto a Farmatodo', coords: '10.4992, -66.8589', photoTone: '#B8893A', icon: 'E' },
  ];

  // ── App ──────────────────────────────────────────────────────
  function TransportistaApp({ fixedTheme }) {
    const [internalTheme, setInternalTheme] = useState('dark');
    const theme = fixedTheme || internalTheme;
    const themeControlled = !!fixedTheme;

    const [deliveries, setDeliveries] = useState(() => DELIVERIES.map(d => ({ ...d, status: 'pending' })));
    const [gpsOn, setGpsOn]           = useState(true);
    const [showGpsAlert, setShowGpsAlert] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [podOpen, setPodOpen]       = useState(false);
    const [toast, setToast]           = useState(null);
    const [avisosOpen, setAvisosOpen]  = useState(false);
    const Avisos = window.OperarioAvisos;
    const avisos = (Avisos && Avisos.seedCamion) ? Avisos.seedCamion() : [];

    const pending = deliveries.filter(d => d.status === 'pending');
    const done    = deliveries.filter(d => d.status === 'done');
    const total   = deliveries.length;
    const doneCt  = done.length;
    const allDone = doneCt === total;
    const current = pending[0];

    useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);

    // Simular notificación push cuando GPS se apaga
    useEffect(() => {
      if (!gpsOn) setShowGpsAlert(true);
      else setShowGpsAlert(false);
    }, [gpsOn]);

    function markDelivered(id) {
      setDeliveries(ds => {
        const next = ds.map(d => d.order === id ? { ...d, status: 'done', deliveredAt: new Date() } : d);
        // Si TODAS quedan en 'done' y hay OD activa en bridge, marcarla como entregada
        const allDone = next.every(d => d.status === 'done');
        if (allDone && bridgeOD && window.DTDBridge) {
          window.DTDBridge.advance(bridgeOD.id, 'entregada', { completedAt: new Date().toISOString() });
        }
        return next;
      });
      setPodOpen(false);
      setToast('Entrega registrada · POD subido');
    }

    return (
      <div data-theme={theme} style={{
        maxWidth: 480, margin: '0 auto', minHeight: '100vh',
        background: 'var(--bg-base)', color: 'var(--ink)',
        display: 'flex', flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <Header theme={theme} onToggleTheme={themeControlled ? null : () => setInternalTheme(t => t === 'dark' ? 'light' : 'dark')} driver={ROUTE.driver} truck={ROUTE.truck} avisos={avisos} onAvisos={() => setAvisosOpen(true)} />
        <RouteBlock route={ROUTE} done={doneCt} total={total} />
        <GPSBlock gpsOn={gpsOn} onToggle={() => setGpsOn(!gpsOn)} current={current} />

        <main style={{ flex: 1, padding: '0 16px 96px' }}>
          {allDone && <DoneState total={total} />}

          {!allDone && current && (
            <React.Fragment>
              <SectionLabel n={doneCt + 1} of={total}>Próxima entrega</SectionLabel>
              <CurrentDelivery
                pkg={current}
                gpsOn={gpsOn}
                onArrive={() => setPodOpen(true)}
              />
            </React.Fragment>
          )}

          {pending.length > 1 && (
            <React.Fragment>
              <SectionLabel>Próximas paradas · {pending.length - 1}</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.slice(1).map((p, i) => (
                  <QueueRow key={p.order} pkg={p} pos={doneCt + 2 + i} />
                ))}
              </div>
            </React.Fragment>
          )}

          {done.length > 0 && (
            <SectionLabel>Entregadas · {done.length}</SectionLabel>
          )}
          {done.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {done.map(p => (
                <DoneRow key={p.order} pkg={p} />
              ))}
            </div>
          )}
        </main>

        {/* Push notification overlay si GPS se apagó */}
        {showGpsAlert && !gpsOn && (
          <GPSPushAlert onTurnOn={() => { setGpsOn(true); setShowGpsAlert(false); }} onDismiss={() => setShowGpsAlert(false)} />
        )}

        {Avisos && <Avisos.Sheet open={avisosOpen} onClose={() => setAvisosOpen(false)} t={(es) => es} lang="es" items={avisos} />}

        {/* Modal POD (Llegada + foto + firma) */}
        {podOpen && current && (
          <PODModal pkg={current} onClose={() => setPodOpen(false)} onConfirm={() => markDelivered(current.order)} />
        )}

        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--success)', color: '#fff', padding: '12px 20px',
            borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-lg)', zIndex: 300,
            font: '700 13px/1 var(--f-sans)',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            animation: 'erp-pop 200ms var(--ease)',
          }}>{window.Icon.check(16)} {toast}</div>
        )}
      </div>
    );
  }

  // ── Header sticky ────────────────────────────────────────────
  function Header({ theme, onToggleTheme, driver, truck, avisos, onAvisos }) {
    const I = window.Icon;
    return (
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        padding: 'env(safe-area-inset-top) 16px 12px', paddingTop: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--wine-soft)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>TRANSPORTISTA · DTD</div>
            <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 3 }}>Ruta del día</div>
            <div style={{ font: '500 11.5px/1.2 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 3 }}>{truck.plate} · {truck.label}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {window.OperarioAvisos && onAvisos && <window.OperarioAvisos.Bell items={avisos || []} onOpen={onAvisos} />}
            {onToggleTheme && (
              <button onClick={onToggleTheme} aria-label="Toggle tema" style={{
                width: 36, height: 36, borderRadius: 'var(--r-pill)',
                background: 'var(--bg-elevated)', color: 'var(--ink)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{theme === 'dark' ? I.sun(15) : I.moon(15)}</button>
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
              }}>{driver.avatar}</div>
              <div style={{ font: '700 12px/1 var(--f-sans)', color: 'var(--ink)' }}>{driver.name.split(' ')[0]}</div>
            </div>
          </div>
        </div>
      </header>
    );
  }

  // ── Route info banner ────────────────────────────────────────
  function RouteBlock({ route, done, total }) {
    const I = window.Icon;
    const pct = (done / total) * 100;
    return (
      <div style={{
        padding: '12px 16px 14px',
        background: 'linear-gradient(135deg, var(--wine) 0%, var(--wine-deep, var(--wine)) 100%)',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ font: '800 9.5px/1 var(--f-sans)', color: 'rgba(255,255,255,0.7)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Ruta asignada</span>
          <code style={{ font: '800 11px/1 var(--f-mono)', color: '#fff', padding: '2px 6px', background: 'rgba(255,255,255,0.16)', borderRadius: 'var(--r-sm)' }}>{route.id}</code>
        </div>
        <div style={{ font: '900 16px/1.15 var(--f-display)', color: '#fff', letterSpacing: '-0.02em' }}>
          {route.hub} → {route.destination}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, font: '500 11px/1.2 var(--f-sans)', color: 'rgba(255,255,255,0.8)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.box(11)} {total} entregas</span>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>·</span>
          <span className="mono" style={{ font: '700 11px/1 var(--f-mono)' }}>{route.totalKm}km</span>
          <span style={{ marginLeft: 'auto', font: '800 12px/1 var(--f-display)', color: '#fff' }}>{done}/{total}</span>
        </div>
        <div style={{ marginTop: 8, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--wine-soft)', borderRadius: 999, transition: 'width var(--dur) var(--ease)' }} />
        </div>
      </div>
    );
  }

  // ── GPS status block ────────────────────────────────────────
  function GPSBlock({ gpsOn, onToggle, current }) {
    const I = window.Icon;
    return (
      <div style={{
        padding: '14px 16px',
        background: gpsOn ? 'var(--success-bg)' : 'var(--danger-bg)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: gpsOn ? 'var(--success)' : 'var(--danger)',
            color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            {I.pin(14)}
            {gpsOn && <span style={{
              position: 'absolute', inset: -4,
              border: '2px solid var(--success)',
              borderRadius: '50%',
              animation: 'cam-pulse 1.6s ease-out infinite',
            }} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '800 13px/1.1 var(--f-display)', color: gpsOn ? 'var(--success)' : 'var(--danger)', letterSpacing: '-0.01em' }}>
              GPS {gpsOn ? 'activo · tracking en vivo' : 'apagado'}
            </div>
            <div style={{ font: '500 11px/1.3 var(--f-mono)', color: 'var(--ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {gpsOn && current ? `${current.coords} · → ${current.city}` : 'enciende el GPS para que DTD pueda rastrear el envío'}
            </div>
          </div>
        </div>
        <SwitchPill on={gpsOn} onChange={onToggle} />
      </div>
    );
  }

  function SwitchPill({ on, onChange }) {
    return (
      <button onClick={onChange} role="switch" aria-checked={on} style={{
        position: 'relative',
        width: 48, height: 26, borderRadius: 999, flexShrink: 0,
        background: on ? 'var(--success)' : 'var(--bg-elevated)',
        border: `1px solid ${on ? 'var(--success)' : 'var(--border-strong)'}`,
        transition: 'all var(--dur-fast) var(--ease)',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 24 : 2,
          width: 20, height: 20, borderRadius: '50%',
          background: '#fff', boxShadow: 'var(--shadow-sm)',
          transition: 'left var(--dur-fast) var(--ease)',
        }} />
      </button>
    );
  }

  // ── Section label ───────────────────────────────────────────
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

  // ── Current delivery (foto + contacto + acciones) ───────────
  function CurrentDelivery({ pkg, gpsOn, onArrive }) {
    const I = window.Icon;
    return (
      <div style={{
        background: 'var(--bg-surface)',
        border: '2px solid var(--wine)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}>
        {/* Foto de fachada (placeholder estilizado) */}
        <FacadePhoto tone={pkg.photoTone} icon={pkg.icon} city={pkg.city} barrio={pkg.barrio} />

        {/* Datos */}
        <div style={{ padding: '14px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <code style={{ font: '800 14px/1 var(--f-mono)', color: 'var(--ink)' }}>{pkg.order}</code>
            <span style={{ font: '600 11px/1 var(--f-mono)', color: 'var(--wine)' }}>{pkg.coords}</span>
          </div>
          <div style={{ font: '900 19px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em', marginTop: 6 }}>{pkg.client}</div>
          <div style={{ font: '600 12.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4 }}>
            {pkg.city} · {pkg.barrio}
          </div>

          <div style={{
            marginTop: 12, padding: '10px 12px',
            background: 'var(--bg-elevated)',
            border: '1px dashed var(--border-strong)',
            borderRadius: 'var(--r-md)',
          }}>
            <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Dirección</div>
            <div style={{ font: '600 13px/1.45 var(--f-sans)', color: 'var(--ink)' }}>{pkg.addr}</div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 6, display: 'inline-flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ marginTop: 1, flexShrink: 0, color: 'var(--warning)' }}>{I.pin(11)}</span>
              <span><b style={{ color: 'var(--ink)' }}>Referencia:</b> {pkg.ref}</span>
            </div>
          </div>

          {/* Contacto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <a href={`tel:${pkg.phone.replace(/\s+/g, '')}`} style={{
              padding: '10px 12px', borderRadius: 'var(--r-md)',
              background: 'var(--bg-elevated)', color: 'var(--ink)',
              border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              font: '700 12.5px/1 var(--f-sans)',
            }}>
              {I.bell(13)} Llamar
            </a>
            <a href={`https://wa.me/${pkg.phone.replace(/\D/g, '')}`} style={{
              padding: '10px 12px', borderRadius: 'var(--r-md)',
              background: pkg.whatsapp ? 'var(--success-bg)' : 'var(--bg-elevated)',
              color: pkg.whatsapp ? 'var(--success)' : 'var(--ink-mute)',
              border: '1px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              font: '700 12.5px/1 var(--f-sans)',
              pointerEvents: pkg.whatsapp ? 'auto' : 'none',
            }}>
              {I.mail(13)} WhatsApp
            </a>
          </div>
        </div>

        {/* CTA principal */}
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onArrive} disabled={!gpsOn} style={{
            width: '100%', height: 60,
            background: gpsOn ? 'var(--wine)' : 'var(--bg-elevated)',
            color: gpsOn ? '#fff' : 'var(--ink-mute)',
            borderRadius: 'var(--r-md)',
            font: '900 15px/1 var(--f-display)', letterSpacing: '-0.01em',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: 'var(--shadow-sm)',
            cursor: gpsOn ? 'pointer' : 'not-allowed',
          }}>
            {I.check(18)} Llegué · registrar entrega
          </button>
          {!gpsOn && (
            <div style={{
              padding: '8px 10px', borderRadius: 'var(--r-sm)',
              background: 'var(--danger-bg)', color: 'var(--danger)',
              font: '600 11px/1.3 var(--f-sans)', textAlign: 'center',
            }}>⚠ Encendé el GPS para poder registrar la entrega</div>
          )}
        </div>
      </div>
    );
  }

  // ── Facade photo placeholder ────────────────────────────────
  function FacadePhoto({ tone, icon, city, barrio }) {
    return (
      <div style={{
        height: 160, position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${tone}, ${tone}cc)`,
      }}>
        {/* Pattern de casa simplificada */}
        <svg width="100%" height="100%" viewBox="0 0 480 160" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <pattern id={`bricks-${icon}`} x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
              <rect width="40" height="20" fill="rgba(0,0,0,0.18)" />
              <rect x="0" y="0" width="38" height="9" fill="rgba(255,255,255,0.05)" />
              <rect x="20" y="11" width="18" height="9" fill="rgba(255,255,255,0.05)" />
              <rect x="0" y="11" width="18" height="9" fill="rgba(255,255,255,0.05)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#bricks-${icon})`} />
          {/* Puerta + ventana */}
          <rect x="180" y="60" width="50" height="80" fill="rgba(0,0,0,0.35)" rx="2" />
          <rect x="190" y="70" width="30" height="60" fill="rgba(255,255,255,0.12)" rx="2" />
          <circle cx="220" cy="100" r="2.2" fill="#fff" />
          <rect x="260" y="60" width="60" height="40" fill="rgba(255,255,255,0.18)" rx="2" />
          <line x1="290" y1="60" x2="290" y2="100" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
          <line x1="260" y1="80" x2="320" y2="80" stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" />
          {/* Techo en V */}
          <polygon points="120,60 380,60 350,30 150,30" fill="rgba(0,0,0,0.3)" />
        </svg>

        {/* Overlay foto-de-cliente label */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          padding: '4px 8px', borderRadius: 'var(--r-sm)',
          background: 'rgba(0,0,0,0.5)', color: '#fff',
          backdropFilter: 'blur(8px)',
          font: '800 9.5px/1 var(--f-sans)', letterSpacing: '0.14em', textTransform: 'uppercase',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--wine-soft)' }} />
          FOTO DE FACHADA · subida por cliente
        </div>
        <div style={{
          position: 'absolute', bottom: 10, left: 12,
          color: '#fff',
        }}>
          <div style={{ font: '900 13px/1.1 var(--f-display)', letterSpacing: '-0.01em', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{city}</div>
          <div style={{ font: '600 11px/1 var(--f-sans)', color: 'rgba(255,255,255,0.9)', marginTop: 2, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{barrio}</div>
        </div>
      </div>
    );
  }

  // ── Próxima parada (compacta) ───────────────────────────────
  function QueueRow({ pkg, pos }) {
    return (
      <div style={{
        display: 'grid', gridTemplateColumns: '56px 1fr', gap: 12,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        overflow: 'hidden',
      }}>
        {/* Mini-thumbnail con número */}
        <div style={{
          background: `linear-gradient(135deg, ${pkg.photoTone}, ${pkg.photoTone}88)`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          font: '900 18px/1 var(--f-display)', letterSpacing: '-0.02em',
        }}>{pos}</div>

        <div style={{ padding: '10px 12px 10px 0', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <code style={{ font: '700 11.5px/1 var(--f-mono)', color: 'var(--ink-soft)' }}>{pkg.order}</code>
          </div>
          <div style={{ font: '700 13px/1.2 var(--f-sans)', color: 'var(--ink)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pkg.client}</div>
          <div style={{ font: '500 11px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pkg.city} · {pkg.barrio}
          </div>
        </div>
      </div>
    );
  }

  function DoneRow({ pkg }) {
    const I = window.Icon;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        opacity: 0.7,
      }}>
        <span style={{ color: 'var(--success)' }}>{I.check(14)}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: '700 12px/1.2 var(--f-sans)', color: 'var(--ink-soft)', textDecoration: 'line-through' }}>{pkg.client}</div>
          <div style={{ font: '500 11px/1 var(--f-sans)', color: 'var(--ink-mute)', marginTop: 2 }}>{pkg.city} · {pkg.barrio}</div>
        </div>
      </div>
    );
  }

  function DoneState({ total }) {
    const I = window.Icon;
    return (
      <div style={{
        marginTop: 32, padding: '32px 20px',
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
        }}>{I.check(36)}</div>
        <div style={{ font: '900 22px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>¡Ruta completada!</div>
        <div style={{ font: '500 13px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
          Entregaste los <b style={{ color: 'var(--success)' }}>{total} paquetes</b>. Ya puedes volver a Valencia.
        </div>
      </div>
    );
  }

  // ── Push notification overlay (GPS off) ─────────────────────
  function GPSPushAlert({ onTurnOn, onDismiss }) {
    const I = window.Icon;
    return (
      <div style={{
        position: 'fixed', top: 12, left: 12, right: 12,
        maxWidth: 456, margin: '0 auto', zIndex: 250,
        padding: '14px 16px',
        background: 'var(--danger)', color: '#fff',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-pop)',
        display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 12, alignItems: 'center',
        animation: 'cam-slide-down 240ms var(--ease)',
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.18)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{I.pin(18)}</div>
        <div>
          <div style={{ font: '900 13.5px/1.1 var(--f-display)', letterSpacing: '-0.01em' }}>GPS apagado</div>
          <div style={{ font: '600 11.5px/1.3 var(--f-sans)', opacity: 0.92, marginTop: 3 }}>DTD-Cargo necesita ubicación activa para rastrear la ruta hasta el cliente.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={onTurnOn} style={{
            padding: '7px 12px', borderRadius: 'var(--r-sm)',
            background: '#fff', color: 'var(--danger)',
            font: '800 11.5px/1 var(--f-sans)',
          }}>Encender</button>
          <button onClick={onDismiss} style={{
            padding: '5px 12px', borderRadius: 'var(--r-sm)',
            color: 'rgba(255,255,255,0.85)',
            font: '600 11px/1 var(--f-sans)',
          }}>Después</button>
        </div>
      </div>
    );
  }

  // ── POD Modal ───────────────────────────────────────────────
  function PODModal({ pkg, onClose, onConfirm }) {
    const I = window.Icon;
    const [step, setStep] = useState('photo');     // 'photo' | 'signature' | 'confirm'
    const [hasPhoto, setHasPhoto]       = useState(false);
    const [hasSignature, setHasSignature] = useState(false);

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
          animation: 'cam-slide-up 280ms var(--ease)',
          maxHeight: '92vh', overflowY: 'auto',
        }}>
          <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 999, margin: '0 auto 14px' }} />

          <div style={{ font: '900 18px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>Registrar entrega</div>
          <div style={{ font: '500 12.5px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 3 }}>{pkg.order} · {pkg.client}</div>

          {/* Foto del paquete entregado */}
          <Block
            label="Foto del paquete entregado"
            sub="Saca una foto del paquete recibido en mano del cliente."
            done={hasPhoto}
          >
            <button onClick={() => setHasPhoto(true)} style={{
              width: '100%', padding: hasPhoto ? '14px' : '36px 14px',
              background: hasPhoto ? 'var(--success-bg)' : 'var(--bg-elevated)',
              color: hasPhoto ? 'var(--success)' : 'var(--ink-soft)',
              border: `1px dashed ${hasPhoto ? 'var(--success)' : 'var(--border-strong)'}`,
              borderRadius: 'var(--r-md)',
              font: '700 13px/1.3 var(--f-sans)',
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              {hasPhoto ? <React.Fragment>{I.check(20)} Foto capturada</React.Fragment>
                        : <React.Fragment>{I.eye(20)} Abrir cámara</React.Fragment>}
            </button>
          </Block>

          {/* Firma */}
          <Block
            label="Firma del cliente"
            sub="El cliente firma en pantalla con el dedo."
            done={hasSignature}
          >
            <button onClick={() => setHasSignature(true)} style={{
              width: '100%', padding: hasSignature ? '14px' : '36px 14px',
              background: hasSignature ? 'var(--success-bg)' : 'var(--bg-elevated)',
              color: hasSignature ? 'var(--success)' : 'var(--ink-soft)',
              border: `1px dashed ${hasSignature ? 'var(--success)' : 'var(--border-strong)'}`,
              borderRadius: 'var(--r-md)',
              font: '700 13px/1.3 var(--f-sans)',
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              {hasSignature ? <React.Fragment>{I.check(20)} Firma capturada</React.Fragment>
                            : <React.Fragment>{I.edit(20)} Abrir pad de firma</React.Fragment>}
            </button>
          </Block>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{
              flex: 1, height: 48,
              background: 'var(--bg-elevated)', color: 'var(--ink)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              font: '700 13px/1 var(--f-sans)',
            }}>Cancelar</button>
            <button onClick={onConfirm} disabled={!hasPhoto || !hasSignature} style={{
              flex: 2, height: 48,
              background: hasPhoto && hasSignature ? 'var(--success)' : 'var(--bg-elevated)',
              color: hasPhoto && hasSignature ? '#fff' : 'var(--ink-mute)',
              borderRadius: 'var(--r-md)',
              font: '900 14px/1 var(--f-display)', letterSpacing: '-0.01em',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: hasPhoto && hasSignature ? 'pointer' : 'not-allowed',
            }}>{I.check(15)} Confirmar entrega</button>
          </div>
        </div>
      </div>
    );
  }

  function Block({ label, sub, done, children }) {
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
          <div style={{ font: '700 11px/1 var(--f-sans)', color: done ? 'var(--success)' : 'var(--ink-soft)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
        </div>
        <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-soft)', marginBottom: 8 }}>{sub}</div>
        {children}
      </div>
    );
  }

  // Inyecta animaciones del transportista
  if (typeof document !== 'undefined' && !document.getElementById('__cam-anim')) {
    const s = document.createElement('style');
    s.id = '__cam-anim';
    s.textContent = `
      @keyframes cam-pulse { 0% { opacity: 0.8; transform: scale(0.85); } 100% { opacity: 0; transform: scale(1.6); } }
      @keyframes cam-slide-down { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes cam-slide-up { from { transform: translateY(40px); } to { transform: translateY(0); } }
    `;
    document.head.appendChild(s);
  }

  window.TransportistaApp = TransportistaApp;
})();
