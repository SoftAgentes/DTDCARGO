/* global React */
/* ── DTD ERP · Wiring helpers · modals globales ──────────────── */
/*                                                                  */
/* Provee modals globales para "Adjuntar archivo", "Programar       */
/* envío", "Mi perfil", "Cambiar contraseña", "Atajos de teclado", */
/* "Generar BL" y flujo OAuth mock para SMTP setup.                 */
/*                                                                  */
/* Cada helper se expone en `window.DTDWiring.openXxx({...})`.      */
/* Se monta en `<body>` un host único que renderiza el modal activo.*/
/* ────────────────────────────────────────────────────────────── */

(function () {
  const { useState, useEffect, useMemo } = React;

  // ── Host único (singleton) ────────────────────────────────
  let __setActive;
  function MountHost() {
    const [active, setActive] = useState(null);
    __setActive = setActive;
    if (!active) return null;
    const Comp = MODALS[active.kind];
    return Comp ? <Comp {...active.props} onClose={() => setActive(null)} /> : null;
  }
  function show(kind, props) {
    if (__setActive) __setActive({ kind, props: props || {} });
  }

  // ═══════════════════════════════════════════════════════════
  // ATTACH FILE MODAL
  // ═══════════════════════════════════════════════════════════
  function AttachModal({ onClose, onSelect }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [files, setFiles] = useState([]);
    const inputRef = React.useRef(null);

    function handleFiles(list) {
      const arr = Array.from(list).map(f => ({
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
        addedAt: new Date().toISOString(),
      }));
      setFiles(prev => [...prev, ...arr]);
    }
    function onDrop(e) {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    }
    function fmtSize(b) {
      if (b < 1024) return b + ' B';
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
      return (b / 1024 / 1024).toFixed(2) + ' MB';
    }
    function confirm() {
      onSelect?.(files);
      onClose();
    }

    return (
      <U.Modal open onClose={onClose} title="Adjuntar archivos" width={560}
        actions={
          <>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.check(13)} onClick={confirm} disabled={files.length === 0}>
              Adjuntar {files.length > 0 ? `(${files.length})` : ''}
            </U.Btn>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <button
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              padding: '32px 18px',
              background: 'var(--bg-elevated)',
              border: '2px dashed var(--border-strong)',
              borderRadius: 'var(--r-md)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              color: 'var(--ink-soft)', textAlign: 'center',
              cursor: 'pointer',
            }}
          >
            {I.upload(28)}
            <div style={{ font: '700 14px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
              Arrastrá archivos acá o hacé click
            </div>
            <div style={{ font: '500 11.5px/1.4 var(--f-sans)', color: 'var(--ink-mute)' }}>
              PDF, DOCX, XLSX, imágenes hasta 25 MB · múltiples archivos OK
            </div>
            <input
              ref={inputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </button>

          {files.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Archivos seleccionados · {files.length}
              </div>
              {files.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)',
                }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 'var(--r-sm)',
                    background: 'var(--wine-tint)', color: 'var(--wine)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>{I.doc(14)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 12.5px/1.2 var(--f-sans)', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    <div style={{ font: '500 11px/1.2 var(--f-mono)', color: 'var(--ink-mute)', marginTop: 2 }}>{fmtSize(f.size)} · {f.type}</div>
                  </div>
                  <button onClick={() => setFiles(files.filter((_, j) => j !== i))} style={{
                    font: '600 11.5px/1 var(--f-sans)', color: 'var(--danger)', padding: '4px 8px',
                  }}>Quitar</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </U.Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SCHEDULE MODAL
  // ═══════════════════════════════════════════════════════════
  function ScheduleModal({ onClose, onSchedule }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10));
    const [time, setTime] = useState('09:00');
    const [tz, setTz] = useState('America/Caracas');

    const presets = [
      { label: 'En 1 hora', getValue: () => {
        const t = new Date(Date.now() + 60 * 60 * 1000);
        return { date: t.toISOString().slice(0, 10), time: t.toTimeString().slice(0, 5) };
      }},
      { label: 'Mañana 9:00', getValue: () => ({ date: tomorrow.toISOString().slice(0, 10), time: '09:00' }) },
      { label: 'Lunes 9:00', getValue: () => {
        const d = new Date();
        d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
        return { date: d.toISOString().slice(0, 10), time: '09:00' };
      }},
    ];

    function confirm() {
      onSchedule?.({ date, time, tz, iso: `${date}T${time}:00` });
      onClose();
    }

    return (
      <U.Modal open onClose={onClose} title="Programar envío" width={520}
        actions={
          <>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.clock(13)} onClick={confirm}>
              Programar
            </U.Btn>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
            El email se guardará en borradores y se enviará automáticamente en el momento programado.
          </div>

          <div>
            <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>Atajos</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {presets.map(p => (
                <button key={p.label} onClick={() => {
                  const v = p.getValue();
                  setDate(v.date); setTime(v.time);
                }} style={{
                  padding: '6px 12px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-pill)',
                  font: '600 11.5px/1 var(--f-sans)',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                }}>{p.label}</button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <U.Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <U.Input label="Hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} mono />
          </div>

          <U.Select label="Zona horaria" value={tz} onChange={(e) => setTz(e.target.value)}
            options={[
              { value: 'America/Caracas', label: 'Caracas · GMT-4' },
              { value: 'Asia/Shanghai', label: 'Shanghai · GMT+8' },
              { value: 'America/New_York', label: 'New York · GMT-5' },
              { value: 'Europe/Madrid', label: 'Madrid · GMT+1' },
            ]}
          />

          <div style={{
            padding: '10px 12px',
            background: 'var(--info-bg)', color: 'var(--info)',
            borderRadius: 'var(--r-sm)',
            font: '500 11.5px/1.4 var(--f-sans)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
            <span>Se enviará el <b>{date}</b> a las <b>{time}</b> ({tz.split('/').pop()}). Podés cancelar el envío desde Borradores hasta 5 min antes.</span>
          </div>
        </div>
      </U.Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // PROFILE MODAL (incluye tab "Cambiar contraseña")
  // ═══════════════════════════════════════════════════════════
  function ProfileModal({ onClose, tab = 'profile' }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const D = window.ERPData;
    const [activeTab, setActiveTab] = useState(tab);
    const user = window.__currentUser || (D.USERS && D.USERS[0]) || { name: 'Usuario', email: '—', role: '—' };

    const [name, setName] = useState(user.name);
    const [email, setEmail] = useState(user.email);
    const [phone, setPhone] = useState(user.phone || '+58 412 000-0000');
    const [saved, setSaved] = useState(false);

    const [pw1, setPw1] = useState('');
    const [pw2, setPw2] = useState('');
    const [pw3, setPw3] = useState('');
    const [pwSaved, setPwSaved] = useState(false);
    const pwOk = pw1.length >= 8 && pw2 === pw3 && pw2.length >= 12;

    return (
      <U.Modal open onClose={onClose} title="Mi perfil" width={580}
        actions={
          <U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>
        }
      >
        <U.Tabs value={activeTab} onChange={setActiveTab} items={[
          { value: 'profile', label: 'Datos personales' },
          { value: 'password', label: 'Contraseña' },
          { value: 'prefs', label: 'Preferencias' },
        ]} style={{ marginBottom: 16 }} />

        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <U.Avatar initials={user.name?.split(' ').map(w => w[0]).slice(0, 2).join('') || 'U'} color="wine" size={56} />
              <div>
                <div style={{ font: '900 16px/1.1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>{user.name}</div>
                <div style={{ font: '600 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 2 }}>{user.role}</div>
                <button style={{ font: '600 11.5px/1 var(--f-sans)', color: 'var(--wine)', marginTop: 4, padding: 0 }}>Cambiar avatar</button>
              </div>
            </div>
            <U.Input label="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
            <U.Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <U.Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} mono />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <U.Btn variant="primary" icon={I.check(13)} onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1800); }}>Guardar cambios</U.Btn>
              {saved && <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--success)' }}>{I.check(13)} Guardado</span>}
            </div>
          </div>
        )}

        {activeTab === 'password' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              padding: '10px 12px',
              background: 'var(--warning-bg)', color: 'var(--warning)',
              borderRadius: 'var(--r-sm)',
              font: '500 11.5px/1.4 var(--f-sans)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ marginTop: 1, flexShrink: 0 }}>{I.info(13)}</span>
              <span>Tu contraseña debe tener al menos <b>12 caracteres</b>, incluir mayúsculas, minúsculas y un número. Después de cambiarla vas a tener que volver a loggear en otros dispositivos.</span>
            </div>
            <U.Input label="Contraseña actual" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} />
            <U.Input label="Nueva contraseña" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} hint={pw2.length > 0 && pw2.length < 12 ? `Faltan ${12 - pw2.length} caracteres` : pw2.length >= 12 ? '✓ Largo OK' : 'Mínimo 12 caracteres'} />
            <U.Input label="Repetir nueva contraseña" type="password" value={pw3} onChange={(e) => setPw3(e.target.value)} error={pw3.length > 0 && pw3 !== pw2 ? 'Las contraseñas no coinciden' : null} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <U.Btn variant="primary" icon={I.shield(13)} disabled={!pwOk} onClick={() => {
                setPwSaved(true);
                setPw1(''); setPw2(''); setPw3('');
                setTimeout(() => setPwSaved(false), 2400);
              }}>Cambiar contraseña</U.Btn>
              {pwSaved && <span style={{ font: '600 12px/1 var(--f-sans)', color: 'var(--success)' }}>{I.check(13)} Contraseña actualizada</span>}
            </div>
          </div>
        )}

        {activeTab === 'prefs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ font: '500 12.5px/1.5 var(--f-sans)', color: 'var(--ink-soft)' }}>
              Configurá notificaciones, idioma y densidad de la interfaz.
            </div>
            <U.Select label="Idioma de la interfaz" defaultValue="es"
              options={[
                { value: 'es', label: 'Español (rioplatense)' },
                { value: 'en', label: 'English' },
                { value: 'zh', label: '中文' },
              ]}
            />
            <U.Select label="Densidad" defaultValue="compact"
              options={[
                { value: 'compact', label: 'Compacta · más info en pantalla' },
                { value: 'comfortable', label: 'Cómoda · más espacio' },
              ]}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: 'var(--wine)' }} />
              Notificaciones por email (resumen diario)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
              <input type="checkbox" defaultChecked style={{ accentColor: 'var(--wine)' }} />
              Push en el navegador para embarques críticos
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: '600 12.5px/1.3 var(--f-sans)', color: 'var(--ink)' }}>
              <input type="checkbox" style={{ accentColor: 'var(--wine)' }} />
              Sonido al recibir notificaciones
            </label>
          </div>
        )}
      </U.Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // SHORTCUTS MODAL
  // ═══════════════════════════════════════════════════════════
  function ShortcutsModal({ onClose }) {
    const U = window.ERPUI;
    const groups = [
      { title: 'NAVEGACIÓN', items: [
        ['⌘ + K', 'Abrir paleta de comandos / búsqueda global'],
        ['G luego D', 'Ir al Dashboard'],
        ['G luego E', 'Ir a Embarques'],
        ['G luego C', 'Ir a Clientes'],
        ['G luego F', 'Ir a Facturación'],
        ['Esc', 'Cerrar modal o drawer activo'],
      ]},
      { title: 'ACCIONES', items: [
        ['N', 'Crear nuevo (contextual al módulo activo)'],
        ['E', 'Editar registro seleccionado'],
        ['/', 'Foco en barra de búsqueda'],
        ['?', 'Abrir esta ventana de atajos'],
      ]},
      { title: 'EMBARQUES', items: [
        ['T', 'Cambiar vista Tabla / Kanban'],
        ['F', 'Abrir panel de filtros'],
        ['↑ / ↓', 'Navegar entre filas'],
        ['Enter', 'Abrir detalle del seleccionado'],
      ]},
      { title: 'EMAIL / COMPOSE', items: [
        ['⌘ + Enter', 'Enviar email'],
        ['⌘ + S', 'Guardar como borrador'],
        ['⌘ + Shift + S', 'Programar envío'],
      ]},
      { title: 'GENERAL', items: [
        ['⌘ + .', 'Toggle tema claro / oscuro'],
        ['⌘ + ,', 'Abrir Mi perfil'],
        ['⌘ + Shift + L', 'Cerrar sesión'],
      ]},
    ];

    return (
      <U.Modal open onClose={onClose} title="Atajos de teclado" width={680}
        actions={<U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {groups.map(g => (
            <div key={g.title}>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--wine)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>
                {g.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.items.map(([k, label]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ font: '500 12px/1.3 var(--f-sans)', color: 'var(--ink-soft)' }}>{label}</span>
                    <kbd style={{
                      padding: '3px 8px',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-strong)',
                      borderBottomWidth: 2,
                      borderRadius: 'var(--r-xs)',
                      font: '700 11px/1 var(--f-mono)',
                      color: 'var(--ink)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}>{k}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </U.Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // GENERATE BL MODAL
  // ═══════════════════════════════════════════════════════════
  function GenerateBLModal({ onClose }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const D = window.ERPData;
    const shipments = (D.SHIPMENTS || []).filter(s => s.status !== 'entregado').slice(0, 12);
    const [shipmentId, setShipmentId] = useState(shipments[0]?.id || '');
    const [blType, setBlType] = useState('original');
    const [generated, setGenerated] = useState(false);

    const shipment = shipments.find(s => s.id === shipmentId);
    const blNumber = `DTDU${shipmentId?.replace(/[^\d]/g, '').slice(-7) || '0000000'}-${blType === 'original' ? 'OR' : blType === 'copy' ? 'CP' : 'SW'}`;

    function generate() {
      setGenerated(true);
    }

    if (generated) {
      return (
        <U.Modal open onClose={onClose} title="Bill of Lading generado" width={620}
          actions={
            <>
              <U.Btn variant="ghost" onClick={onClose}>Cerrar</U.Btn>
              <U.Btn variant="secondary" icon={I.download(13)}>Descargar PDF</U.Btn>
              <U.Btn variant="primary" icon={I.mail(13)} onClick={() => {
                window.openQuickEmail?.({ subject: `BL ${blNumber}`, ctx: { label: blNumber } });
                onClose();
              }}>Enviar al cliente</U.Btn>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '16px 18px', background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--success)', flexShrink: 0 }}>{I.check(22)}</span>
              <div>
                <div style={{ font: '800 14px/1.2 var(--f-display)', color: 'var(--success)' }}>BL generado correctamente</div>
                <code style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--ink)', marginTop: 4, display: 'inline-block' }}>{blNumber}</code>
              </div>
            </div>
            <div style={{
              padding: 24, background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              minHeight: 240,
            }}>
              <div style={{ borderBottom: '2px solid var(--ink)', paddingBottom: 10, marginBottom: 16 }}>
                <div style={{ font: '900 18px/1 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>BILL OF LADING</div>
                <code style={{ font: '700 13px/1 var(--f-mono)', color: 'var(--wine)', marginTop: 6, display: 'inline-block' }}>{blNumber}</code>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <BLField label="Shipper" value="DTD-Cargo Logistics SA" />
                <BLField label="Consignee" value={shipment?.clientName || '—'} />
                <BLField label="Origin" value={D.origin?.(shipment?.origin)?.name || shipment?.origin || '—'} />
                <BLField label="Destination" value={D.dest?.(shipment?.destination)?.name || shipment?.destination || '—'} />
                <BLField label="Vessel" value="MV DTD-Express" mono />
                <BLField label="ETA" value={shipment?.eta || '—'} />
              </div>
            </div>
          </div>
        </U.Modal>
      );
    }

    return (
      <U.Modal open onClose={onClose} title="Generar Bill of Lading" width={560}
        actions={
          <>
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
            <U.Btn variant="primary" icon={I.doc(13)} onClick={generate} disabled={!shipmentId}>
              Generar BL
            </U.Btn>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <U.Select label="Embarque" value={shipmentId} onChange={(e) => setShipmentId(e.target.value)}
            options={shipments.map(s => ({ value: s.id, label: `${s.id} · ${s.clientName}` }))}
          />
          <U.Select label="Tipo de BL" value={blType} onChange={(e) => setBlType(e.target.value)}
            options={[
              { value: 'original', label: 'Original · físico firmado por naviera' },
              { value: 'copy', label: 'Copia · sin firma' },
              { value: 'swb', label: 'SeaWayBill · sin papel, telex release' },
            ]}
          />
          {shipment && (
            <div style={{
              padding: '12px 14px', background: 'var(--bg-elevated)',
              borderRadius: 'var(--r-sm)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ font: '700 10.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>EMBARQUE</div>
              <div style={{ font: '700 13px/1.3 var(--f-sans)', color: 'var(--ink)' }}>{shipment.clientName}</div>
              <code style={{ font: '700 12px/1 var(--f-mono)', color: 'var(--wine)' }}>{shipment.id}</code>
            </div>
          )}
        </div>
      </U.Modal>
    );
  }
  function BLField({ label, value, mono }) {
    return (
      <div>
        <div style={{ font: '700 9.5px/1 var(--f-sans)', color: 'var(--ink-soft)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
        <div style={{ font: `${mono ? '700' : '600'} 12.5px/1.3 ${mono ? 'var(--f-mono)' : 'var(--f-sans)'}`, color: 'var(--ink)' }}>{value}</div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // OAUTH FLOW (mock — 3 pasos)
  // ═══════════════════════════════════════════════════════════
  function OAuthFlow({ onClose, provider }) {
    const U = window.ERPUI;
    const I = window.Icon;
    const [step, setStep] = useState(1);
    const providerName = provider === 'gmail' ? 'Google' : 'Microsoft';
    const providerColor = provider === 'gmail' ? '#EA4335' : '#0078D4';

    useEffect(() => {
      if (step === 2) {
        const t = setTimeout(() => setStep(3), 1800);
        return () => clearTimeout(t);
      }
    }, [step]);

    return (
      <U.Modal open onClose={onClose} title={`Conectar con ${providerName}`} width={500}
        actions={
          step === 3 ? (
            <U.Btn variant="primary" icon={I.check(13)} onClick={onClose}>Listo</U.Btn>
          ) : (
            <U.Btn variant="ghost" onClick={onClose}>Cancelar</U.Btn>
          )
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center', textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 'var(--r-md)',
            background: step === 3 ? 'var(--success)' : providerColor, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            font: '900 22px/1 var(--f-display)',
            transition: 'background 200ms',
          }}>
            {step === 3 ? I.check(28) : (provider === 'gmail' ? 'G' : 'M')}
          </div>

          {step === 1 && (
            <>
              <div>
                <div style={{ font: '900 18px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                  Vamos a redirigirte a {providerName}
                </div>
                <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: 360, margin: '8px auto 0' }}>
                  Vas a ver la pantalla de autorización de {providerName} para permitir que DTD-Cargo envíe emails desde tu cuenta corporativa.
                </div>
              </div>
              <U.Btn variant="primary" size="lg" icon={I.link(13)} onClick={() => setStep(2)}>
                Continuar con {providerName}
              </U.Btn>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <div style={{ font: '900 18px/1.2 var(--f-display)', color: 'var(--ink)', letterSpacing: '-0.02em' }}>
                  Autorizando con {providerName}…
                </div>
                <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8 }}>
                  Esperando confirmación de OAuth
                </div>
              </div>
              <div style={{
                width: 32, height: 32,
                border: '3px solid var(--bg-elevated)',
                borderTop: `3px solid ${providerColor}`,
                borderRadius: '50%',
                animation: 'erp-spin 700ms linear infinite',
              }} />
              <style>{`@keyframes erp-spin { to { transform: rotate(360deg); } }`}</style>
            </>
          )}

          {step === 3 && (
            <div>
              <div style={{ font: '900 18px/1.2 var(--f-display)', color: 'var(--success)', letterSpacing: '-0.02em' }}>
                Conectado correctamente
              </div>
              <div style={{ font: '500 13px/1.5 var(--f-sans)', color: 'var(--ink-soft)', marginTop: 8, maxWidth: 360, margin: '8px auto 0' }}>
                Los emails se van a enviar usando tu cuenta de {providerName}. Podés revocar el acceso desde Mailing → Configuración.
              </div>
            </div>
          )}
        </div>
      </U.Modal>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // EXPORT API
  // ═══════════════════════════════════════════════════════════
  const MODALS = {
    attach: AttachModal,
    schedule: ScheduleModal,
    profile: ProfileModal,
    shortcuts: ShortcutsModal,
    generateBL: GenerateBLModal,
    oauth: OAuthFlow,
  };

  window.DTDWiring = {
    openAttachModal: (opts) => show('attach', opts),
    openScheduleModal: (opts) => show('schedule', opts),
    openProfileModal: (opts) => show('profile', opts),
    openShortcutsModal: (opts) => show('shortcuts', opts),
    openGenerateBLModal: (opts) => show('generateBL', opts),
    openOAuthFlow: (provider) => show('oauth', { provider }),
    MountHost,
  };
})();
